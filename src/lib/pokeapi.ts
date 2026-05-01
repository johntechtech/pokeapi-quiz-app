import type { PokemonQuizData, PokemonStat, StatKey, TypeMatchups } from "./types";

const API_BASE = "https://pokeapi.co/api/v2";
const CACHE_PREFIX = "poke-quiz-api-cache:v1:";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;
const CORE_TYPE_NAMES = [
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

type CoreTypeName = (typeof CORE_TYPE_NAMES)[number];

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
  varieties: Array<{
    is_default: boolean;
    pokemon: NamedResource;
  }>;
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
  };
}

interface AbilityResponse {
  names: LocalizedName[];
}

interface MoveResponse {
  names: LocalizedName[];
}

export interface FetchPokemonQuizDataOptions {
  includeProfessorData?: boolean;
  includeBattleData?: boolean;
}

const statLabels: Record<StatKey, string> = {
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

  const [typesJa, abilitiesJa, moves, matchups] = await Promise.all([
    Promise.all(typeNamesApi.map((name) => fetchTypeNameJa(name))),
    includeProfessorData || includeBattleData ? fetchAbilityNames(pokemon.abilities) : Promise.resolve([]),
    includeBattleData ? fetchMoveNames(pokemon.moves) : Promise.resolve([]),
    includeBattleData
      ? getTypeMatchups(typeNamesApi)
      : Promise.resolve({ weaknessesJa: [], resistancesJa: [], immunitiesJa: [] }),
  ]);

  const flavorTextJa =
    species.flavor_text_entries
      .filter((entry) => entry.language.name === "ja-Hrkt" || entry.language.name === "ja")
      .map((entry) => cleanFlavorText(entry.flavor_text))
      .find(Boolean) ?? "PokeAPIに日本語の図鑑説明が登録されていません";

  const genusJa =
    species.genera.find((entry) => entry.language.name === "ja-Hrkt")?.genus ??
    species.genera.find((entry) => entry.language.name === "ja")?.genus ??
    "分類不明";

  return {
    id: species.id,
    apiName: pokemon.name,
    displayNameJa,
    displayNameHira,
    spriteUrl,
    artworkUrl,
    typesJa,
    abilitiesJa,
    heightM: pokemon.height / 10,
    weightKg: pokemon.weight / 10,
    flavorTextJa,
    genusJa,
    generationJa: generationToJa(species.generation.name),
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
  const count = await getSpeciesCount();
  const excluded = new Set(excludedIds);
  const maxAttempts = 16;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidateId = Math.floor(Math.random() * count) + 1;
    if (excluded.has(candidateId) && excluded.size < count) {
      continue;
    }

    try {
      return await fetchPokemonQuizData(candidateId, options);
    } catch {
      // Some edge species can miss a resource. Try another species.
    }
  }

  return fetchPokemonQuizData(Math.floor(Math.random() * count) + 1, options);
}
