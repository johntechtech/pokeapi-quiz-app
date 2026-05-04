import type { PokemonQuizData, PokemonStat, StatKey, TypeMatchups } from "./types";

const API_BASE = "https://pokeapi.co/api/v2";
const CACHE_PREFIX = "poke-quiz-api-cache:v1:";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;
export const NO_INFORMATION = "情報がありません";
export const CORE_TYPE_NAMES = [
  "normal",
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
  "steel",
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
  "dark",
  "fairy",
] as const;

export type CoreTypeName = (typeof CORE_TYPE_NAMES)[number];

interface NamedResource {
  name: string;
  url: string;
}

interface LocalizedName {
  name: string;
  language: NamedResource;
}

interface PokemonListResponse {
  count: number;
}

interface ResourceListResponse {
  count: number;
  results: NamedResource[];
}

interface PokemonSpeciesResponse {
  id: number;
  name: string;
  names: LocalizedName[];
  flavor_text_entries: Array<{
    flavor_text: string;
    language: NamedResource;
  }>;
  genera: Array<{
    genus: string;
    language: NamedResource;
  }>;
  generation: NamedResource;
  evolution_chain: {
    url: string;
  };
  varieties: Array<{
    is_default: boolean;
    pokemon: NamedResource;
  }>;
}

interface EvolutionChainLink {
  species: NamedResource;
  evolves_to: EvolutionChainLink[];
}

interface EvolutionChainResponse {
  id: number;
  chain: EvolutionChainLink;
}

interface PokemonResponse {
  id: number;
  name: string;
  height: number;
  weight: number;
  sprites: {
    front_default: string | null;
    other?: {
      "official-artwork"?: {
        front_default: string | null;
      };
    };
  };
  types: Array<{
    slot: number;
    type: NamedResource;
  }>;
  abilities: Array<{
    ability: NamedResource;
    is_hidden: boolean;
    slot: number;
  }>;
  stats: Array<{
    base_stat: number;
    stat: NamedResource;
  }>;
  moves: Array<{
    move: NamedResource;
  }>;
  cries?: {
    latest?: string | null;
    legacy?: string | null;
  };
}

interface TypeResponse {
  id: number;
  name: string;
  names: LocalizedName[];
  damage_relations: {
    double_damage_to: NamedResource[];
    half_damage_to: NamedResource[];
    no_damage_to: NamedResource[];
    double_damage_from: NamedResource[];
    half_damage_from: NamedResource[];
    no_damage_from: NamedResource[];
  };
  moves: NamedResource[];
}

interface AbilityResponse {
  id: number;
  name: string;
  names: LocalizedName[];
  flavor_text_entries?: Array<{
    flavor_text: string;
    language: NamedResource;
  }>;
  effect_entries?: Array<{
    effect: string;
    short_effect: string;
    language: NamedResource;
  }>;
}

interface MoveResponse {
  id: number;
  name: string;
  names: LocalizedName[];
  accuracy: number | null;
  power: number | null;
  priority: number;
  type: NamedResource;
  damage_class: NamedResource;
}

interface NatureResponse {
  id: number;
  name: string;
  names: LocalizedName[];
  increased_stat: NamedResource | null;
  decreased_stat: NamedResource | null;
}

export interface BattleType {
  apiName: CoreTypeName;
  nameJa: string;
}

export interface BattleMove {
  apiName: string;
  nameJa: string;
  typeApiName: CoreTypeName;
  typeJa: string;
  power: number | null;
  accuracy: number | null;
  priority: number;
}

export interface BattleAbility {
  apiName: string;
  nameJa: string;
  descriptionJa: string;
}

export interface BattleNature {
  apiName: string;
  nameJa: string;
  increasedStat: Exclude<StatKey, "hp"> | null;
  decreasedStat: Exclude<StatKey, "hp"> | null;
  increasedStatJa: string;
  decreasedStatJa: string;
}

export interface FetchPokemonQuizDataOptions {
  includeProfessorData?: boolean;
  includeBattleData?: boolean;
  candidateSpeciesIds?: number[];
}

export const statLabels: Record<StatKey, string> = {
  hp: "HP",
  attack: "こうげき",
  defense: "ぼうぎょ",
  "special-attack": "とくこう",
  "special-defense": "とくぼう",
  speed: "すばやさ",
};

const generationLabels: Record<string, string> = {
  "generation-i": "第1世代",
  "generation-ii": "第2世代",
  "generation-iii": "第3世代",
  "generation-iv": "第4世代",
  "generation-v": "第5世代",
  "generation-vi": "第6世代",
  "generation-vii": "第7世代",
  "generation-viii": "第8世代",
  "generation-ix": "第9世代",
};

const typeFallbacks: Record<string, string> = {
  normal: "ノーマル",
  fighting: "かくとう",
  flying: "ひこう",
  poison: "どく",
  ground: "じめん",
  rock: "いわ",
  bug: "むし",
  ghost: "ゴースト",
  steel: "はがね",
  fire: "ほのお",
  water: "みず",
  grass: "くさ",
  electric: "でんき",
  psychic: "エスパー",
  ice: "こおり",
  dragon: "ドラゴン",
  dark: "あく",
  fairy: "フェアリー",
};

const battleStatKeys: Array<Exclude<StatKey, "hp">> = [
  "attack",
  "defense",
  "special-attack",
  "special-defense",
  "speed",
];

let battleTypesCache: Promise<BattleType[]> | null = null;
let battleNaturesCache: Promise<BattleNature[]> | null = null;

export function katakanaToHiragana(value: string): string {
  return value.replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

export function hiraganaToKatakana(value: string): string {
  return value.replace(/[\u3041-\u3096]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60),
  );
}

async function fetchJsonCached<T>(url: string): Promise<T> {
  const cacheKey = `${CACHE_PREFIX}${url}`;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { savedAt: number; data: T };
      if (Date.now() - parsed.savedAt < CACHE_MAX_AGE_MS) {
        return parsed.data;
      }
    }
  } catch {
    // localStorage can be unavailable in private browsing modes.
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PokeAPI request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as T;
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Cache quota is best-effort only.
  }
  return data;
}

function getLocalizedName(names: LocalizedName[], fallback: string): string {
  return (
    names.find((entry) => entry.language.name === "ja-Hrkt")?.name ??
    names.find((entry) => entry.language.name === "ja")?.name ??
    names.find((entry) => entry.language.name === "en")?.name ??
    fallback
  );
}

function cleanFlavorText(value: string): string {
  return value.replace(/\f/g, " ").replace(/\s+/g, " ").trim();
}

function generationToJa(name: string): string {
  return generationLabels[name] ?? name;
}

function collectEvolutionPaths(link: EvolutionChainLink): string[][] {
  if (link.evolves_to.length === 0) {
    return [[link.species.name]];
  }

  return link.evolves_to.flatMap((nextLink) =>
    collectEvolutionPaths(nextLink).map((path) => [link.species.name, ...path]),
  );
}

async function fetchEvolutionOrderJa(species: PokemonSpeciesResponse): Promise<string> {
  try {
    const evolution = await fetchJsonCached<EvolutionChainResponse>(species.evolution_chain.url);
    const paths = collectEvolutionPaths(evolution.chain)
      .filter((path) => path.includes(species.name))
      .sort((a, b) => b.length - a.length);
    const path = paths[0];

    if (!path) {
      return NO_INFORMATION;
    }

    if (path.length <= 1) {
      return "進化なし";
    }

    const stageIndex = path.indexOf(species.name) + 1;
    return `${path.length}段進化の${stageIndex}番目`;
  } catch {
    return NO_INFORMATION;
  }
}

function mapStats(stats: PokemonResponse["stats"]): PokemonStat[] {
  return stats
    .map((entry) => {
      const key = entry.stat.name as StatKey;
      if (!statLabels[key]) {
        return null;
      }
      return {
        key,
        labelJa: statLabels[key],
        value: entry.base_stat,
      };
    })
    .filter((entry): entry is PokemonStat => Boolean(entry));
}

function selectMoveUrls(moves: PokemonResponse["moves"]): string[] {
  if (moves.length <= 4) {
    return moves.map((entry) => entry.move.url);
  }

  const step = Math.max(1, Math.floor(moves.length / 4));
  return [0, step, step * 2, step * 3]
    .map((index) => moves[index]?.move.url)
    .filter((url): url is string => Boolean(url));
}

async function fetchAbilityNames(abilities: PokemonResponse["abilities"]): Promise<string[]> {
  const selected = abilities
    .slice()
    .sort((a, b) => Number(a.is_hidden) - Number(b.is_hidden) || a.slot - b.slot)
    .slice(0, 3);

  const results = await Promise.all(
    selected.map(async (entry) => {
      const ability = await fetchJsonCached<AbilityResponse>(entry.ability.url);
      return getLocalizedName(ability.names, entry.ability.name);
    }),
  );

  return Array.from(new Set(results));
}

function abilityApiNames(abilities: PokemonResponse["abilities"]): string[] {
  return abilities
    .slice()
    .sort((a, b) => Number(a.is_hidden) - Number(b.is_hidden) || a.slot - b.slot)
    .map((entry) => entry.ability.name);
}

async function fetchMoveNames(moves: PokemonResponse["moves"]): Promise<string[]> {
  const urls = selectMoveUrls(moves);
  const results = await Promise.all(
    urls.map(async (url) => {
      const move = await fetchJsonCached<MoveResponse>(url);
      return getLocalizedName(move.names, url.split("/").filter(Boolean).at(-1) ?? "技");
    }),
  );

  return Array.from(new Set(results)).slice(0, 4);
}

function moveApiNames(moves: PokemonResponse["moves"]): string[] {
  return moves.map((entry) => entry.move.name);
}

async function fetchTypeDetail(nameOrUrl: string): Promise<TypeResponse> {
  const isUrl = nameOrUrl.startsWith("http");
  const url = isUrl ? nameOrUrl : `${API_BASE}/type/${nameOrUrl}`;
  return fetchJsonCached<TypeResponse>(url);
}

async function fetchTypeNameJa(typeName: string): Promise<string> {
  try {
    const type = await fetchTypeDetail(typeName);
    return getLocalizedName(type.names, typeFallbacks[typeName] ?? typeName);
  } catch {
    return typeFallbacks[typeName] ?? typeName;
  }
}

function isCoreTypeName(value: string): value is CoreTypeName {
  return (CORE_TYPE_NAMES as readonly string[]).includes(value);
}

export function getBattleStatOptions(): Array<{ key: Exclude<StatKey, "hp">; label: string }> {
  return battleStatKeys.map((key) => ({ key, label: statLabels[key] }));
}

export async function getCoreBattleTypes(): Promise<BattleType[]> {
  battleTypesCache ??= Promise.all(
    CORE_TYPE_NAMES.map(async (apiName) => ({
      apiName,
      nameJa: await fetchTypeNameJa(apiName),
    })),
  );

  return battleTypesCache;
}

export async function calculateAttackMultiplier(
  attackTypeName: string,
  targetTypeNames: string[],
): Promise<number> {
  const attackType = await fetchTypeDetail(attackTypeName);
  let multiplier = 1;

  for (const targetTypeName of targetTypeNames) {
    if (includesResource(attackType.damage_relations.no_damage_to, targetTypeName)) {
      multiplier *= 0;
    } else if (includesResource(attackType.damage_relations.double_damage_to, targetTypeName)) {
      multiplier *= 2;
    } else if (includesResource(attackType.damage_relations.half_damage_to, targetTypeName)) {
      multiplier *= 0.5;
    }
  }

  return multiplier;
}

async function fetchMoveDetail(nameOrUrl: string): Promise<BattleMove> {
  const isUrl = nameOrUrl.startsWith("http");
  const url = isUrl ? nameOrUrl : `${API_BASE}/move/${nameOrUrl}`;
  const move = await fetchJsonCached<MoveResponse>(url);
  if (!isCoreTypeName(move.type.name)) {
    throw new Error(`Unsupported move type: ${move.type.name}`);
  }

  return {
    apiName: move.name,
    nameJa: getLocalizedName(move.names, move.name),
    typeApiName: move.type.name,
    typeJa: await fetchTypeNameJa(move.type.name),
    power: move.power,
    accuracy: move.accuracy,
    priority: move.priority,
  };
}

async function getMoveCount(): Promise<number> {
  const result = await fetchJsonCached<ResourceListResponse>(`${API_BASE}/move?limit=1`);
  return result.count;
}

export async function fetchBattleMove(nameOrUrl: string): Promise<BattleMove> {
  return fetchMoveDetail(nameOrUrl);
}

export async function fetchBattleMovesByNames(names: string[]): Promise<BattleMove[]> {
  const moves = await Promise.all(
    names.map(async (name) => {
      try {
        return await fetchMoveDetail(name);
      } catch {
        return null;
      }
    }),
  );

  return moves.filter((move): move is BattleMove => Boolean(move));
}

export async function fetchRandomBattleMove({
  typeName,
  excludeApiNames = [],
  requirePower = false,
  requireAccuracy = false,
}: {
  typeName?: CoreTypeName;
  excludeApiNames?: string[];
  requirePower?: boolean;
  requireAccuracy?: boolean;
} = {}): Promise<BattleMove> {
  const excluded = new Set(excludeApiNames);
  const moveResources = typeName ? (await fetchTypeDetail(typeName)).moves : null;
  const maxAttempts = 36;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = moveResources?.length
      ? moveResources[Math.floor(Math.random() * moveResources.length)].url
      : String(Math.floor(Math.random() * (await getMoveCount())) + 1);

    try {
      const move = await fetchMoveDetail(candidate);
      if (excluded.has(move.apiName)) {
        continue;
      }

      if (requirePower && move.power === null) {
        continue;
      }

      if (requireAccuracy && move.accuracy === null) {
        continue;
      }

      return move;
    } catch {
      // Some older contest/status data can be sparse. Keep sampling.
    }
  }

  throw new Error("条件に合う技データを取得できませんでした。");
}

function cleanBattleText(value: string): string {
  return value.replace(/\f/g, " ").replace(/\s+/g, " ").trim();
}

function getAbilityDescriptionJa(ability: AbilityResponse): string {
  const flavor =
    ability.flavor_text_entries
      ?.filter((entry) => entry.language.name === "ja-Hrkt" || entry.language.name === "ja")
      .map((entry) => cleanBattleText(entry.flavor_text))
      .find(Boolean) ?? "";

  if (flavor) {
    return flavor;
  }

  return (
    ability.effect_entries
      ?.filter((entry) => entry.language.name === "ja-Hrkt" || entry.language.name === "ja")
      .map((entry) => cleanBattleText(entry.short_effect || entry.effect))
      .find(Boolean) ?? ""
  );
}

async function fetchAbilityDetail(nameOrUrl: string): Promise<BattleAbility> {
  const isUrl = nameOrUrl.startsWith("http");
  const url = isUrl ? nameOrUrl : `${API_BASE}/ability/${nameOrUrl}`;
  const ability = await fetchJsonCached<AbilityResponse>(url);
  const descriptionJa = getAbilityDescriptionJa(ability);

  if (!descriptionJa) {
    throw new Error("特性の説明データを取得できませんでした。");
  }

  return {
    apiName: ability.name,
    nameJa: getLocalizedName(ability.names, ability.name),
    descriptionJa,
  };
}

export async function fetchBattleAbility(nameOrUrl: string): Promise<BattleAbility> {
  return fetchAbilityDetail(nameOrUrl);
}

async function getAbilityCount(): Promise<number> {
  const result = await fetchJsonCached<ResourceListResponse>(`${API_BASE}/ability?limit=1`);
  return result.count;
}

export async function fetchRandomBattleAbility(excludeApiNames: string[] = []): Promise<BattleAbility> {
  const excluded = new Set(excludeApiNames);
  const count = await getAbilityCount();
  const maxAttempts = 36;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const ability = await fetchAbilityDetail(`${Math.floor(Math.random() * count) + 1}`);
      if (excluded.has(ability.apiName)) {
        continue;
      }

      return ability;
    } catch {
      // Try another ability.
    }
  }

  throw new Error("条件に合う特性データを取得できませんでした。");
}

async function fetchBattleNatures(): Promise<BattleNature[]> {
  if (!battleNaturesCache) {
    battleNaturesCache = (async (): Promise<BattleNature[]> => {
    const list = await fetchJsonCached<ResourceListResponse>(`${API_BASE}/nature?limit=25`);
    const natures: Array<BattleNature | null> = await Promise.all(
      list.results.map(async (resource) => {
        const nature = await fetchJsonCached<NatureResponse>(resource.url);
        const increased = nature.increased_stat?.name ?? null;
        const decreased = nature.decreased_stat?.name ?? null;
        if (!increased || !decreased || !isBattleStatKey(increased) || !isBattleStatKey(decreased)) {
          return null;
        }

        return {
          apiName: nature.name,
          nameJa: getLocalizedName(nature.names, nature.name),
          increasedStat: increased,
          decreasedStat: decreased,
          increasedStatJa: statLabels[increased],
          decreasedStatJa: statLabels[decreased],
        };
      }),
    );

    return natures.filter((nature): nature is BattleNature => Boolean(nature));
    })();
  }

  return battleNaturesCache;
}

function isBattleStatKey(value: string): value is Exclude<StatKey, "hp"> {
  return battleStatKeys.includes(value as Exclude<StatKey, "hp">);
}

export async function fetchRandomBattleNature(): Promise<BattleNature> {
  const natures = await fetchBattleNatures();
  if (natures.length === 0) {
    throw new Error("性格データを取得できませんでした。");
  }

  return natures[Math.floor(Math.random() * natures.length)];
}

function includesResource(resources: NamedResource[], typeName: string): boolean {
  return resources.some((resource) => resource.name === typeName);
}

async function getTypeMatchups(targetTypeNames: string[]): Promise<TypeMatchups> {
  const attackTypes = await Promise.all(CORE_TYPE_NAMES.map((name) => fetchTypeDetail(name)));
  const typeNameByApiName = new Map<string, string>();

  await Promise.all(
    attackTypes.map(async (type) => {
      typeNameByApiName.set(type.name, getLocalizedName(type.names, typeFallbacks[type.name] ?? type.name));
    }),
  );

  const weaknessesJa: string[] = [];
  const resistancesJa: string[] = [];
  const immunitiesJa: string[] = [];

  for (const attackType of attackTypes) {
    let multiplier = 1;

    for (const targetType of targetTypeNames) {
      if (includesResource(attackType.damage_relations.no_damage_to, targetType)) {
        multiplier *= 0;
      } else if (includesResource(attackType.damage_relations.double_damage_to, targetType)) {
        multiplier *= 2;
      } else if (includesResource(attackType.damage_relations.half_damage_to, targetType)) {
        multiplier *= 0.5;
      }
    }

    const nameJa = typeNameByApiName.get(attackType.name) ?? attackType.name;
    if (multiplier === 0) {
      immunitiesJa.push(nameJa);
    } else if (multiplier > 1) {
      weaknessesJa.push(multiplier >= 4 ? `${nameJa} x4` : nameJa);
    } else if (multiplier < 1) {
      resistancesJa.push(multiplier <= 0.25 ? `${nameJa} x0.25` : nameJa);
    }
  }

  return {
    weaknessesJa,
    resistancesJa,
    immunitiesJa,
  };
}

export async function getSpeciesCount(): Promise<number> {
  const result = await fetchJsonCached<PokemonListResponse>(`${API_BASE}/pokemon-species?limit=1`);
  return result.count;
}

export async function fetchPokemonQuizData(
  speciesId: number,
  options: FetchPokemonQuizDataOptions = {
    includeProfessorData: true,
    includeBattleData: true,
  },
): Promise<PokemonQuizData> {
  const species = await fetchJsonCached<PokemonSpeciesResponse>(
    `${API_BASE}/pokemon-species/${speciesId}`,
  );
  const defaultVariety = species.varieties.find((entry) => entry.is_default) ?? species.varieties[0];
  const pokemonUrl = defaultVariety?.pokemon.url ?? `${API_BASE}/pokemon/${species.name}`;
  const pokemon = await fetchJsonCached<PokemonResponse>(pokemonUrl);

  const displayNameJa = getLocalizedName(species.names, species.name);
  const displayNameHira = katakanaToHiragana(displayNameJa);
  const artworkUrl =
    pokemon.sprites.other?.["official-artwork"]?.front_default ??
    pokemon.sprites.front_default ??
    "";
  const spriteUrl = pokemon.sprites.front_default ?? artworkUrl;
  const typeNamesApi = pokemon.types
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => entry.type.name);

  const includeProfessorData = options.includeProfessorData ?? true;
  const includeBattleData = options.includeBattleData ?? true;
  const abilityNamesApi = includeProfessorData || includeBattleData ? abilityApiNames(pokemon.abilities) : [];
  const moveNamesApi = includeBattleData ? moveApiNames(pokemon.moves) : [];

  const [typesJa, abilitiesJa, moves, matchups, evolutionOrderJa] = await Promise.all([
    Promise.all(typeNamesApi.map((name) => fetchTypeNameJa(name))),
    includeProfessorData || includeBattleData ? fetchAbilityNames(pokemon.abilities) : Promise.resolve([]),
    includeBattleData ? fetchMoveNames(pokemon.moves) : Promise.resolve([]),
    includeBattleData
      ? getTypeMatchups(typeNamesApi)
      : Promise.resolve({ weaknessesJa: [], resistancesJa: [], immunitiesJa: [] }),
    includeProfessorData ? fetchEvolutionOrderJa(species) : Promise.resolve(NO_INFORMATION),
  ]);

  const flavorTextJa =
    species.flavor_text_entries
      .filter((entry) => entry.language.name === "ja-Hrkt" || entry.language.name === "ja")
      .map((entry) => cleanFlavorText(entry.flavor_text))
      .find(Boolean) ?? NO_INFORMATION;

  const genusJa =
    species.genera.find((entry) => entry.language.name === "ja-Hrkt")?.genus ??
    species.genera.find((entry) => entry.language.name === "ja")?.genus ??
    NO_INFORMATION;

  return {
    id: species.id,
    apiName: pokemon.name,
    displayNameJa,
    displayNameHira,
    spriteUrl,
    artworkUrl,
    typeNamesApi,
    typesJa,
    abilityNamesApi,
    abilitiesJa,
    moveNamesApi,
    heightM: pokemon.height / 10,
    weightKg: pokemon.weight / 10,
    flavorTextJa,
    genusJa,
    generationJa: generationToJa(species.generation.name),
    evolutionOrderJa,
    cryUrl: pokemon.cries?.latest ?? pokemon.cries?.legacy ?? "",
    stats: mapStats(pokemon.stats),
    moves,
    matchups,
  };
}

export async function fetchRandomPokemonQuizData(
  excludedIds: number[],
  options?: FetchPokemonQuizDataOptions,
): Promise<PokemonQuizData> {
  const candidateSpeciesIds = options?.candidateSpeciesIds?.filter((id) => Number.isInteger(id) && id > 0);
  const count = candidateSpeciesIds?.length ? candidateSpeciesIds.length : await getSpeciesCount();
  const excluded = new Set(excludedIds);
  const maxAttempts = 16;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidateId = candidateSpeciesIds?.length
      ? candidateSpeciesIds[Math.floor(Math.random() * candidateSpeciesIds.length)]
      : Math.floor(Math.random() * count) + 1;
    if (excluded.has(candidateId) && excluded.size < count) {
      continue;
    }

    try {
      return await fetchPokemonQuizData(candidateId, options);
    } catch {
      // Some edge species can miss a resource. Try another species.
    }
  }

  const fallbackId = candidateSpeciesIds?.length
    ? candidateSpeciesIds[Math.floor(Math.random() * candidateSpeciesIds.length)]
    : Math.floor(Math.random() * count) + 1;
  return fetchPokemonQuizData(fallbackId, options);
}
