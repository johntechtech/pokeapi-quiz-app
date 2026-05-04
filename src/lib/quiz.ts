import {
  CORE_TYPE_NAMES,
  NO_INFORMATION,
  calculateAttackMultiplier,
  fetchBattleAbility,
  fetchBattleMove,
  fetchBattleMovesByNames,
  fetchRandomBattleAbility,
  fetchRandomBattleMove,
  fetchRandomBattleNature,
  fetchRandomPokemonQuizData,
  getBattleStatOptions,
  getCoreBattleTypes,
  hiraganaToKatakana,
  type BattleAbility,
  type BattleMove,
  type BattleType,
  type CoreTypeName,
} from "./pokeapi";
import type {
  AnswerFormat,
  Difficulty,
  PokemonQuizData,
  ProfessorLevel,
  QuizChoice,
  QuizClue,
  QuizRound,
  SilhouetteLevel,
  StatKey,
  TrainerLevel,
  TrainerQuestionKind,
} from "./types";

export const DEFAULT_TOTAL_QUESTIONS = 8;

export const difficultyLabels: Record<Difficulty, string> = {
  kids: "キッズ",
  adult: "大人",
  professor: "博士",
  trainer: "トレーナー",
  silhouette: "シルエットTA",
};

export const difficultyDescriptions: Record<Difficulty, string> = {
  kids: "ひらがなと姿でゆっくり遊べます。はじめての一匹にもやさしいです。",
  adult: "姿・タイプ・ヒントから当てる標準モードです。記憶の引き出しを軽く開けます。",
  professor: "分類や図鑑説明から推理します。白衣はなくても参加できます。",
  trainer: "タイプ相性・技・特性・種族値で戦うバトル知識モードです。目指せ脳内チャンピオンロード。",
  silhouette: "黒い影から一気に見抜く短期決戦。10問の集中力で勝負します。",
};

export const professorLevelOrder: ProfessorLevel[] = ["apprentice", "training", "exam"];

export const professorLevelLabels: Record<ProfessorLevel, string> = {
  apprentice: "見習い中",
  training: "修行中",
  exam: "博士検定",
};

export const professorLevelDescriptions: Record<ProfessorLevel, string> = {
  apprentice: "情報多めの7問。分類・説明・タイプからじっくり推理",
  training: "基礎データを読み切る10問。進化順まで観察します",
  exam: "鳴き声も含む13問。最後まで博士らしく読み切ります",
};

export const trainerLevelOrder: TrainerLevel[] = ["masara", "gymLeader", "eliteFour", "champion"];

export const trainerLevelLabels: Record<TrainerLevel, string> = {
  masara: "マサラタウン",
  gymLeader: "ジムリーダー",
  eliteFour: "四天王",
  champion: "チャンピオン",
};

export const trainerLevelDescriptions: Record<TrainerLevel, string> = {
  masara: "7問でタイプ相性の入口。まずは草むら一歩目から。",
  gymLeader: "9問で技・特性まで見る実戦入門。バッジは気持ち多めで。",
  eliteFour: "11問で性格補正と相性を読む上級戦。回復アイテムは心の中に。",
  champion: "13問で全形式に挑む総力戦。知識の殿堂入りへ。",
};

export const silhouetteLevelOrder: SilhouetteLevel[] = ["kageSearcher", "shadowRunner"];

export const silhouetteLevelLabels: Record<SilhouetteLevel, string> = {
  kageSearcher: "カゲサーチャー",
  shadowRunner: "シャドウランナー",
};

export const silhouetteLevelDescriptions: Record<SilhouetteLevel, string> = {
  kageSearcher: "名前を見て、4つの黒シルエットから姿を探す10問",
  shadowRunner: "黒シルエットだけを見て、4つの名前から選ぶ10問",
};

export function totalQuestionsForMode(
  difficulty: Difficulty,
  professorLevel?: ProfessorLevel | null,
  trainerLevel?: TrainerLevel | null,
  silhouetteLevel?: SilhouetteLevel | null,
): number {
  if (difficulty === "professor") {
    const counts: Record<ProfessorLevel, number> = {
      apprentice: 7,
      training: 10,
      exam: 13,
    };
    return counts[professorLevel ?? "exam"];
  }

  if (difficulty === "trainer") {
    const counts: Record<TrainerLevel, number> = {
      masara: 7,
      gymLeader: 9,
      eliteFour: 11,
      champion: 13,
    };
    return counts[trainerLevel ?? "gymLeader"];
  }

  if (difficulty === "silhouette") {
    return 10;
  }

  return DEFAULT_TOTAL_QUESTIONS;
}

export function calculateRoundScore(hintsUsed: number, wrongAttempts = 0): number {
  const hintAdjustedScore = Math.max(20, 100 - hintsUsed * 15);
  return Math.max(0, hintAdjustedScore - wrongAttempts * 10);
}

function shuffle<T>(items: T[]): T[] {
  return items
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function charArray(value: string): string[] {
  return Array.from(value);
}

export function maskName(name: string, revealedChars: number): string {
  const chars = charArray(name);
  const maxReveal = Math.max(0, Math.min(revealedChars, chars.length - 1));

  return chars
    .map((char, index) => (index < maxReveal ? char : "◯"))
    .join("");
}

function clue(id: string, label: string, value: string, kind: QuizClue["kind"] = "fact"): QuizClue {
  return { id, label, value, kind };
}

function createKidsRound(pokemon: PokemonQuizData): QuizRound {
  const name = pokemon.displayNameHira;
  const hintClues = charArray(name).map((_, index) =>
    clue(`kids-name-${index}`, "なまえ", maskName(name, index), "name"),
  );

  return {
    answer: pokemon.displayNameJa,
    difficulty: "kids",
    answerFormat: "text",
    pokemon,
    revealedHints: 0,
    wrongAttempts: 0,
    initialClues: [clue("kids-image", "すがた", "カラーの姿が表示されています", "image")],
    hintClues,
    maxHints: hintClues.length,
    score: 100,
  };
}

function createAdultRound(pokemon: PokemonQuizData): QuizRound {
  const name = pokemon.displayNameJa;
  const hintClues = [
    clue("adult-types", "タイプ", pokemon.typesJa.join(" / ") || NO_INFORMATION),
    clue("adult-mask", "なまえ", maskName(name, 0), "name"),
    clue("adult-color", "すがた", "カラーの姿が表示されました", "image"),
    clue("adult-first-letter", "なまえ", maskName(name, 1), "name"),
  ];

  return {
    answer: pokemon.displayNameJa,
    difficulty: "adult",
    answerFormat: "text",
    pokemon,
    revealedHints: 0,
    wrongAttempts: 0,
    initialClues: [clue("adult-image", "すがた", "シルエットが表示されています", "image")],
    hintClues,
    maxHints: hintClues.length,
    score: 100,
  };
}

function professorFacts(pokemon: PokemonQuizData): Record<string, QuizClue> {
  const cryClue = pokemon.cryUrl
    ? clue("professor-cry", "鳴き声", pokemon.cryUrl, "audio")
    : clue("professor-cry", "鳴き声", NO_INFORMATION);

  return {
    id: clue("professor-id", "図鑑No.", String(pokemon.id)),
    size: clue(
      "professor-size",
      "身長・重さ",
      `${pokemon.heightM.toFixed(1)}m / ${pokemon.weightKg.toFixed(1)}kg`,
    ),
    abilities: clue("professor-abilities", "特性", pokemon.abilitiesJa.join(" / ") || NO_INFORMATION),
    types: clue("professor-types", "タイプ", pokemon.typesJa.join(" / ") || NO_INFORMATION),
    flavor: clue("professor-flavor", "図鑑説明", pokemon.flavorTextJa || NO_INFORMATION),
    genus: clue("professor-genus", "分類", pokemon.genusJa || NO_INFORMATION),
    generation: clue("professor-generation", "世代", pokemon.generationJa || NO_INFORMATION),
    evolution: clue("professor-evolution", "進化の順番", pokemon.evolutionOrderJa || NO_INFORMATION),
    cry: cryClue,
  };
}

function createProfessorRound(
  pokemon: PokemonQuizData,
  professorLevel: ProfessorLevel = "exam",
): QuizRound {
  const facts = professorFacts(pokemon);
  const nameClue = clue("professor-mask", "なまえ", maskName(pokemon.displayNameJa, 0), "name");
  const silhouetteClue = clue("professor-silhouette", "すがた", "シルエットが表示されました", "image");
  let initialClues: QuizClue[];
  let hintClueGroups: QuizClue[][];

  if (professorLevel === "apprentice") {
    initialClues = [facts.genus, facts.flavor, nameClue, facts.types, facts.evolution];
    hintClueGroups = [
      [facts.generation, facts.id, facts.abilities, facts.size],
      [silhouetteClue],
    ];
  } else if (professorLevel === "training") {
    initialClues = [facts.types, facts.generation, facts.id, facts.abilities, facts.genus, facts.size];
    hintClueGroups = [
      [nameClue, facts.flavor],
      [facts.evolution],
      [silhouetteClue],
    ];
  } else {
    initialClues = [facts.cry, nameClue, facts.types];
    hintClueGroups = [
      [facts.id, facts.generation, facts.abilities],
      [facts.flavor],
      [facts.evolution],
    ];
  }
  const hintClues = hintClueGroups.flat();

  return {
    answer: pokemon.displayNameJa,
    difficulty: "professor",
    professorLevel,
    answerFormat: "text",
    pokemon,
    revealedHints: 0,
    wrongAttempts: 0,
    initialClues,
    hintClues,
    hintClueGroups,
    maxHints: hintClueGroups.length,
    score: 100,
  };
}

function quizChoice(
  value: string,
  label: string,
  description?: string,
  imageUrl?: string,
  imageAlt?: string,
  imageTone?: QuizChoice["imageTone"],
): QuizChoice {
  return { value, label, description, imageUrl, imageAlt, imageTone };
}

function getStatValue(pokemon: PokemonQuizData, key: StatKey): number {
  return pokemon.stats.find((stat) => stat.key === key)?.value ?? 0;
}

function statsSummary(pokemon: PokemonQuizData): string {
  return pokemon.stats.map((stat) => `${stat.labelJa} ${stat.value}`).join(" / ");
}

async function fetchBattleMoveKnownByPokemon(
  pokemon: PokemonQuizData,
  {
    requirePower = false,
    requireAccuracy = false,
    candidateNames,
  }: {
    requirePower?: boolean;
    requireAccuracy?: boolean;
    candidateNames?: string[];
  } = {},
): Promise<BattleMove> {
  const knownMoveNames = candidateNames
    ? pokemon.moveNamesApi.filter((name) => candidateNames.includes(name))
    : pokemon.moveNamesApi;

  for (const moveName of shuffle(knownMoveNames).slice(0, 72)) {
    try {
      const move = await fetchBattleMove(moveName);
      if (requirePower && move.power === null) {
        continue;
      }

      if (requireAccuracy && move.accuracy === null) {
        continue;
      }

      return move;
    } catch {
      // Try another move known by this Pokemon.
    }
  }

  throw new Error("このポケモンが使える条件付きの技を取得できませんでした。");
}

async function fetchBattleAbilityForPokemon(pokemon: PokemonQuizData): Promise<BattleAbility> {
  for (const abilityName of shuffle(pokemon.abilityNamesApi)) {
    try {
      return await fetchBattleAbility(abilityName);
    } catch {
      // Try another ability this Pokemon can have.
    }
  }

  throw new Error("このポケモンの特性データを取得できませんでした。");
}

function createTrainerKnowledgeRound({
  pokemon,
  trainerLevel,
  trainerQuestionKind,
  answer,
  answerFormat,
  prompt,
  initialClues,
  choices,
  selectOptions,
  dualSelect,
  correctAnswerValue,
  correctAnswerValues,
  correctAnswerLabel,
  resultDetail,
  showPokemonVisual = true,
}: {
  pokemon: PokemonQuizData;
  trainerLevel: TrainerLevel;
  trainerQuestionKind: TrainerQuestionKind;
  answer: string;
  answerFormat: AnswerFormat;
  prompt: QuizRound["prompt"];
  initialClues: QuizClue[];
  choices?: QuizChoice[];
  selectOptions?: QuizChoice[];
  dualSelect?: QuizRound["dualSelect"];
  correctAnswerValue?: string;
  correctAnswerValues?: QuizRound["correctAnswerValues"];
  correctAnswerLabel?: string;
  resultDetail?: string;
  showPokemonVisual?: boolean;
}): QuizRound {
  return {
    answer,
    difficulty: "trainer",
    trainerLevel,
    trainerQuestionKind,
    answerFormat,
    prompt,
    choices,
    selectOptions,
    dualSelect,
    correctAnswerValue,
    correctAnswerValues,
    correctAnswerLabel,
    resultDetail,
    showPokemonVisual,
    pokemon,
    revealedHints: 0,
    wrongAttempts: 0,
    initialClues,
    hintClues: [],
    maxHints: 0,
    score: 100,
  };
}

function trainerQuestionKinds(trainerLevel: TrainerLevel): TrainerQuestionKind[] {
  if (trainerLevel === "masara") {
    return ["type-matchup", "move-effectiveness"];
  }

  if (trainerLevel === "eliteFour") {
    return ["nature-stat", "move-effectiveness", "stat-comparison"];
  }

  if (trainerLevel === "champion") {
    return [
      "type-matchup",
      "move-effectiveness",
      "move-type",
      "ability-description",
      "nature-stat",
      "move-accuracy",
      "move-power",
      "stat-comparison",
      "move-priority",
    ];
  }

  return ["move-type", "ability-description", "move-effectiveness"];
}

async function typeMatchCandidates(
  targetType: BattleType,
  relation: "super" | "none",
): Promise<{ correct: BattleType[]; wrong: BattleType[] }> {
  const types = await getCoreBattleTypes();
  const results = await Promise.all(
    types.map(async (type) => ({
      type,
      multiplier: await calculateAttackMultiplier(type.apiName, [targetType.apiName]),
    })),
  );
  const isCorrect = (multiplier: number) => (relation === "super" ? multiplier > 1 : multiplier === 0);

  return {
    correct: results.filter((entry) => isCorrect(entry.multiplier)).map((entry) => entry.type),
    wrong: results.filter((entry) => !isCorrect(entry.multiplier)).map((entry) => entry.type),
  };
}

async function createTypeMatchupRound(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
): Promise<QuizRound> {
  const coreTypes = await getCoreBattleTypes();
  const types = shuffle(
    pokemon.typeNamesApi
      .map((typeName) => coreTypes.find((type) => type.apiName === typeName))
      .filter((type): type is BattleType => Boolean(type)),
  );

  for (const targetType of types) {
    for (const relation of shuffle<"super" | "none">(["super", "none"])) {
      const candidates = await typeMatchCandidates(targetType, relation);
      if (candidates.correct.length < 1 || candidates.wrong.length < 3) {
        continue;
      }

      const answer = shuffle(candidates.correct)[0];
      const choices = shuffle([answer, ...shuffle(candidates.wrong).slice(0, 3)]).map((type) =>
        quizChoice(type.apiName, type.nameJa),
      );
      const relationText = relation === "super" ? "効果抜群" : "効果なし";

      return createTrainerKnowledgeRound({
        pokemon,
        trainerLevel,
        trainerQuestionKind: "type-matchup",
        answer: answer.nameJa,
        answerFormat: "choice",
        prompt: {
          title: "タイプ相性",
          body: `${pokemon.displayNameJa}の「${targetType.nameJa}」タイプに対して、${relationText}になる攻撃タイプはどれ？`,
        },
        initialClues: [
          clue("type-target-pokemon", "相手ポケモン", pokemon.displayNameJa),
          clue("type-target", "相手のタイプ", targetType.nameJa),
          clue("type-relation", "狙う効果", relationText),
        ],
        choices,
        correctAnswerValue: answer.apiName,
        correctAnswerLabel: `${answer.nameJa}（${relationText}）`,
        showPokemonVisual: true,
      });
    }
  }

  throw new Error("タイプ相性問題を作成できませんでした。");
}

async function fetchMoveOptionsForEffectiveness(
  targetTypeNames: string[],
): Promise<{ answer: BattleMove; wrongMoves: BattleMove[] }> {
  const multipliers = await Promise.all(
    CORE_TYPE_NAMES.map(async (typeName) => ({
      typeName,
      multiplier: await calculateAttackMultiplier(typeName, targetTypeNames),
    })),
  );
  const superTypes = shuffle(multipliers.filter((entry) => entry.multiplier > 1).map((entry) => entry.typeName));
  const otherTypes = shuffle(multipliers.filter((entry) => entry.multiplier <= 1).map((entry) => entry.typeName));

  let answer: BattleMove | null = null;
  const excludedMoves: string[] = [];
  for (const typeName of superTypes) {
    try {
      answer = await fetchRandomBattleMove({ typeName, requirePower: true, excludeApiNames: excludedMoves });
      excludedMoves.push(answer.apiName);
      break;
    } catch {
      // Try another super-effective type.
    }
  }

  if (!answer) {
    throw new Error("効果抜群になる技を取得できませんでした。");
  }

  const wrongMoves: BattleMove[] = [];
  for (const typeName of otherTypes) {
    if (wrongMoves.length >= 3) {
      break;
    }

    try {
      const move = await fetchRandomBattleMove({
        typeName,
        requirePower: true,
        excludeApiNames: [answer.apiName, ...wrongMoves.map((entry) => entry.apiName)],
      });
      wrongMoves.push(move);
    } catch {
      // Keep collecting.
    }
  }

  if (wrongMoves.length < 3) {
    throw new Error("技タイプ相性の選択肢を作成できませんでした。");
  }

  return { answer, wrongMoves };
}

async function createMoveEffectivenessRound(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
): Promise<QuizRound> {
  const { answer, wrongMoves } = await fetchMoveOptionsForEffectiveness(pokemon.typeNamesApi);
  const showPokemonTypes = trainerLevel === "masara" || trainerLevel === "gymLeader";
  const showMoveTypes = trainerLevel === "masara";
  const choices = shuffle([answer, ...wrongMoves]).map((move) =>
    quizChoice(
      move.apiName,
      move.nameJa,
      showMoveTypes ? `タイプ: ${move.typeJa}` : undefined,
    ),
  );

  return createTrainerKnowledgeRound({
    pokemon,
    trainerLevel,
    trainerQuestionKind: "move-effectiveness",
    answer: answer.nameJa,
    answerFormat: "choice",
    prompt: {
      title: "技タイプ相性",
      body: `${pokemon.displayNameJa}に効果抜群になる技を選んでください。`,
      detail: showMoveTypes ? "技タイプも見えているので、落ち着いて弱点を突きましょう。" : undefined,
    },
    initialClues: [
      clue("target-pokemon", "相手ポケモン", pokemon.displayNameJa),
      ...(showPokemonTypes ? [clue("target-types", "相手のタイプ", pokemon.typesJa.join(" / "))] : []),
    ],
    choices,
    correctAnswerValue: answer.apiName,
    correctAnswerLabel: `${answer.nameJa}（${answer.typeJa}）`,
    resultDetail: `${pokemon.displayNameJa}には${answer.typeJa}タイプが効果抜群です。`,
    showPokemonVisual: true,
  });
}

async function createMoveTypeRound(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
): Promise<QuizRound> {
  const move = await fetchBattleMoveKnownByPokemon(pokemon, { requirePower: true });
  const typeOptions = (await getCoreBattleTypes()).map((type) => quizChoice(type.apiName, type.nameJa));

  return createTrainerKnowledgeRound({
    pokemon,
    trainerLevel,
    trainerQuestionKind: "move-type",
    answer: move.typeJa,
    answerFormat: "select",
    prompt: {
      title: "技のタイプ",
      body: `${pokemon.displayNameJa}が使える「${move.nameJa}」のタイプは？`,
    },
    initialClues: [
      clue("move-pokemon", "関連ポケモン", pokemon.displayNameJa),
      clue("move-name", "技", move.nameJa),
    ],
    selectOptions: typeOptions,
    correctAnswerValue: move.typeApiName,
    correctAnswerLabel: `${move.nameJa}: ${move.typeJa}`,
    showPokemonVisual: true,
  });
}

async function createAbilityDescriptionRound(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
): Promise<QuizRound> {
  const answer = await fetchBattleAbilityForPokemon(pokemon);
  const abilities: BattleAbility[] = [answer];

  for (let attempt = 0; attempt < 8 && abilities.length < 4; attempt += 1) {
    const ability = await fetchRandomBattleAbility(abilities.map((entry) => entry.apiName));
    if (!abilities.some((entry) => entry.descriptionJa === ability.descriptionJa)) {
      abilities.push(ability);
    }
  }

  if (abilities.length < 4) {
    throw new Error("特性クイズの選択肢を作成できませんでした。");
  }

  return createTrainerKnowledgeRound({
    pokemon,
    trainerLevel,
    trainerQuestionKind: "ability-description",
    answer: answer.descriptionJa,
    answerFormat: "choice",
    prompt: {
      title: "特性クイズ",
      body: `${pokemon.displayNameJa}の特性「${answer.nameJa}」の説明はどれ？`,
    },
    initialClues: [
      clue("ability-pokemon", "関連ポケモン", pokemon.displayNameJa),
      clue("ability-name", "特性", answer.nameJa),
    ],
    choices: shuffle(abilities).map((ability) => quizChoice(ability.apiName, ability.descriptionJa)),
    correctAnswerValue: answer.apiName,
    correctAnswerLabel: `${answer.nameJa}: ${answer.descriptionJa}`,
    showPokemonVisual: true,
  });
}

async function createNatureStatRound(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
): Promise<QuizRound> {
  const nature = await fetchRandomBattleNature();
  const statOptions = getBattleStatOptions().map((stat) => quizChoice(stat.key, stat.label));

  return createTrainerKnowledgeRound({
    pokemon,
    trainerLevel,
    trainerQuestionKind: "nature-stat",
    answer: `${nature.increasedStatJa}↑ / ${nature.decreasedStatJa}↓`,
    answerFormat: "dual-select",
    prompt: {
      title: "性格補正",
      body: `${pokemon.displayNameJa}を育てる時、性格「${nature.nameJa}」で上がる能力・下がる能力は？`,
    },
    initialClues: [
      clue("nature-pokemon", "育成対象", pokemon.displayNameJa),
      clue("nature-name", "性格", nature.nameJa),
    ],
    dualSelect: {
      firstLabel: "上がる能力",
      secondLabel: "下がる能力",
      firstOptions: statOptions,
      secondOptions: statOptions,
    },
    correctAnswerValues: {
      first: nature.increasedStat ?? "",
      second: nature.decreasedStat ?? "",
    },
    correctAnswerLabel: `${nature.nameJa}: ${nature.increasedStatJa}↑ / ${nature.decreasedStatJa}↓`,
    showPokemonVisual: true,
  });
}

function numericChoices(correctValue: number, candidates: number[], suffix = ""): QuizChoice[] {
  const wrongValues = shuffle(Array.from(new Set(candidates.filter((value) => value !== correctValue)))).slice(0, 3);
  return shuffle([correctValue, ...wrongValues]).map((value) =>
    quizChoice(String(value), `${value}${suffix}`),
  );
}

async function createMoveNumberRound(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
  kind: "move-accuracy" | "move-power",
): Promise<QuizRound> {
  const move = await fetchBattleMoveKnownByPokemon(pokemon, {
    requireAccuracy: kind === "move-accuracy",
    requirePower: kind === "move-power",
  });
  const value = kind === "move-accuracy" ? move.accuracy : move.power;
  if (value === null) {
    throw new Error("技の数値データを取得できませんでした。");
  }

  const accuracyValues = [30, 50, 55, 60, 70, 75, 80, 85, 90, 95, 100];
  const powerValues = [20, 40, 50, 60, 70, 75, 80, 90, 95, 100, 110, 120, 150];
  const suffix = kind === "move-accuracy" ? "%" : "";
  const title = kind === "move-accuracy" ? "技命中率" : "技威力";
  const body =
    kind === "move-accuracy"
      ? `${pokemon.displayNameJa}が使える「${move.nameJa}」の命中率は？`
      : `${pokemon.displayNameJa}が使える「${move.nameJa}」の威力は？`;

  return createTrainerKnowledgeRound({
    pokemon,
    trainerLevel,
    trainerQuestionKind: kind,
    answer: `${value}${suffix}`,
    answerFormat: "choice",
    prompt: { title, body },
    initialClues: [
      clue("move-pokemon", "関連ポケモン", pokemon.displayNameJa),
      clue("move-name", "技", move.nameJa),
    ],
    choices: numericChoices(value, kind === "move-accuracy" ? accuracyValues : powerValues, suffix),
    correctAnswerValue: String(value),
    correctAnswerLabel: `${move.nameJa}: ${value}${suffix}`,
    showPokemonVisual: true,
  });
}

async function createStatComparisonRound(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
  candidateSpeciesIds: number[],
): Promise<QuizRound> {
  const stat = shuffle(pokemon.stats)[0];
  const direction = Math.random() > 0.5 ? "higher" : "lower";
  const targetValue = stat.value;
  const sampledIds = [pokemon.id];
  let answer: PokemonQuizData | null = null;
  const wrongPokemon: PokemonQuizData[] = [];

  for (let attempt = 0; attempt < 56 && (!answer || wrongPokemon.length < 3); attempt += 1) {
    const candidate = await fetchRandomPokemonQuizData(sampledIds, {
      candidateSpeciesIds,
      includeProfessorData: false,
      includeBattleData: false,
    });
    sampledIds.push(candidate.id);
    const candidateValue = getStatValue(candidate, stat.key);
    const isCorrect = direction === "higher" ? candidateValue > targetValue : candidateValue < targetValue;

    if (isCorrect && !answer) {
      answer = candidate;
    } else if (!isCorrect && wrongPokemon.length < 3) {
      wrongPokemon.push(candidate);
    }
  }

  if (!answer || wrongPokemon.length < 3) {
    throw new Error("比較クイズの選択肢を作成できませんでした。");
  }

  const answerValue = getStatValue(answer, stat.key);
  const relationText = direction === "higher" ? "高い" : "低い";
  const choices = shuffle([answer, ...wrongPokemon]).map((entry) =>
    quizChoice(String(entry.id), entry.displayNameJa),
  );

  return createTrainerKnowledgeRound({
    pokemon,
    trainerLevel,
    trainerQuestionKind: "stat-comparison",
    answer: answer.displayNameJa,
    answerFormat: "choice",
    prompt: {
      title: "比較クイズ",
      body: `${pokemon.displayNameJa}の${stat.labelJa}は${targetValue}。これより${relationText}ポケモンはどれ？`,
    },
    initialClues: [
      clue("target-pokemon", "基準ポケモン", pokemon.displayNameJa),
      clue("target-stat", stat.labelJa, String(targetValue)),
    ],
    choices,
    correctAnswerValue: String(answer.id),
    correctAnswerLabel: `${answer.displayNameJa}（${stat.labelJa} ${answerValue}）`,
    resultDetail: `${pokemon.displayNameJa}の${stat.labelJa} ${targetValue}に対して、${answer.displayNameJa}は${answerValue}です。`,
    showPokemonVisual: true,
  });
}

async function createMovePriorityRound(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
): Promise<QuizRound> {
  const priorityMoveNames = [
    "tackle",
    "water-gun",
    "quick-attack",
    "mach-punch",
    "sucker-punch",
    "extreme-speed",
    "fake-out",
    "protect",
    "detect",
    "helping-hand",
    "counter",
    "roar",
    "trick-room",
  ];
  const anchor = await fetchBattleMoveKnownByPokemon(pokemon, { candidateNames: priorityMoveNames });
  const moves = await fetchBattleMovesByNames(priorityMoveNames);

  for (const direction of shuffle<"higher" | "lower">(["higher", "lower"])) {
    const correctMoves = moves.filter((move) =>
      direction === "higher" ? move.priority > anchor.priority : move.priority < anchor.priority,
    );
    const wrongMoves = moves.filter((move) =>
      move.apiName !== anchor.apiName &&
      (direction === "higher" ? move.priority <= anchor.priority : move.priority >= anchor.priority),
    );

    if (correctMoves.length < 1 || wrongMoves.length < 3) {
      continue;
    }

    const answer = shuffle(correctMoves)[0];
    const choices = shuffle([answer, ...shuffle(wrongMoves).slice(0, 3)]).map((move) =>
      quizChoice(move.apiName, move.nameJa),
    );
    const relationText = direction === "higher" ? "高い" : "低い";

    return createTrainerKnowledgeRound({
      pokemon,
      trainerLevel,
      trainerQuestionKind: "move-priority",
      answer: answer.nameJa,
      answerFormat: "choice",
      prompt: {
        title: "技の優先度",
        body: `${pokemon.displayNameJa}が使える「${anchor.nameJa}」より優先度が${relationText}技はどれ？`,
      },
      initialClues: [
        clue("priority-pokemon", "関連ポケモン", pokemon.displayNameJa),
        clue("anchor-move", "基準の技", anchor.nameJa),
        clue("anchor-priority", "基準の優先度", String(anchor.priority)),
      ],
      choices,
      correctAnswerValue: answer.apiName,
      correctAnswerLabel: `${answer.nameJa}（優先度 ${answer.priority}）`,
      showPokemonVisual: true,
    });
  }

  throw new Error("技の優先度クイズを作成できませんでした。");
}

async function createTrainerRoundByKind(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
  kind: TrainerQuestionKind,
  candidateSpeciesIds: number[],
): Promise<QuizRound> {
  switch (kind) {
    case "type-matchup":
      return createTypeMatchupRound(pokemon, trainerLevel);
    case "move-effectiveness":
      return createMoveEffectivenessRound(pokemon, trainerLevel);
    case "move-type":
      return createMoveTypeRound(pokemon, trainerLevel);
    case "ability-description":
      return createAbilityDescriptionRound(pokemon, trainerLevel);
    case "nature-stat":
      return createNatureStatRound(pokemon, trainerLevel);
    case "move-accuracy":
      return createMoveNumberRound(pokemon, trainerLevel, "move-accuracy");
    case "move-power":
      return createMoveNumberRound(pokemon, trainerLevel, "move-power");
    case "stat-comparison":
      return createStatComparisonRound(pokemon, trainerLevel, candidateSpeciesIds);
    case "move-priority":
      return createMovePriorityRound(pokemon, trainerLevel);
  }
}

export async function createTrainerQuizRound(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
  candidateSpeciesIds: number[],
): Promise<QuizRound> {
  const allowedKinds = trainerQuestionKinds(trainerLevel);
  const firstKind = allowedKinds[Math.floor(Math.random() * allowedKinds.length)];
  const fallbackKinds = [firstKind, ...shuffle(allowedKinds.filter((kind) => kind !== firstKind))];

  for (const kind of fallbackKinds) {
    try {
      return await createTrainerRoundByKind(pokemon, trainerLevel, kind, candidateSpeciesIds);
    } catch {
      // Candidate data can be sparse. Try another trainer question kind.
    }
  }

  throw new Error("トレーナークイズを作成できませんでした。");
}

async function fetchSilhouetteChoicePokemon(
  pokemon: PokemonQuizData,
  candidateSpeciesIds: number[],
): Promise<PokemonQuizData[]> {
  const choices = [pokemon];
  const sampledIds = [pokemon.id];

  for (let attempt = 0; attempt < 36 && choices.length < 4; attempt += 1) {
    const candidate = await fetchRandomPokemonQuizData(sampledIds, {
      candidateSpeciesIds,
      includeProfessorData: false,
      includeBattleData: false,
    });
    sampledIds.push(candidate.id);

    if (!choices.some((entry) => entry.id === candidate.id)) {
      choices.push(candidate);
    }
  }

  if (choices.length < 4) {
    throw new Error("シルエット問題の選択肢を作成できませんでした。");
  }

  return shuffle(choices);
}

export async function createSilhouetteQuizRound(
  pokemon: PokemonQuizData,
  silhouetteLevel: SilhouetteLevel,
  candidateSpeciesIds: number[],
): Promise<QuizRound> {
  const choicePokemon = await fetchSilhouetteChoicePokemon(pokemon, candidateSpeciesIds);

  if (silhouetteLevel === "kageSearcher") {
    const choices = choicePokemon.map((entry, index) =>
      quizChoice(
        String(entry.id),
        `候補 ${index + 1}`,
        undefined,
        entry.artworkUrl || entry.spriteUrl,
        `${entry.displayNameJa}のシルエット`,
        "black",
      ),
    );

    return {
      answer: pokemon.displayNameJa,
      difficulty: "silhouette",
      silhouetteLevel,
      answerFormat: "choice",
      prompt: {
        title: silhouetteLevelLabels[silhouetteLevel],
        body: `「${pokemon.displayNameJa}」のシルエットはどれ？`,
      },
      choices,
      correctAnswerValue: String(pokemon.id),
      correctAnswerLabel: pokemon.displayNameJa,
      resultDetail: `${pokemon.displayNameJa}の姿を見抜きました。`,
      showPokemonVisual: false,
      hidePokemonVisual: true,
      pokemon,
      revealedHints: 0,
      wrongAttempts: 0,
      initialClues: [clue("silhouette-name", "なまえ", pokemon.displayNameJa, "name")],
      hintClues: [],
      maxHints: 0,
      score: 100,
    };
  }

  return {
    answer: pokemon.displayNameJa,
    difficulty: "silhouette",
    silhouetteLevel,
    answerFormat: "choice",
    prompt: {
      title: silhouetteLevelLabels[silhouetteLevel],
      body: "黒シルエットのポケモンはどれ？",
    },
    choices: choicePokemon.map((entry) => quizChoice(String(entry.id), entry.displayNameJa)),
    correctAnswerValue: String(pokemon.id),
    correctAnswerLabel: pokemon.displayNameJa,
    resultDetail: `${pokemon.displayNameJa}のシルエットでした。`,
    showPokemonVisual: true,
    forceBlackSilhouette: true,
    pokemon,
    revealedHints: 0,
    wrongAttempts: 0,
    initialClues: [clue("silhouette-black", "すがた", "黒シルエットが表示されています", "image")],
    hintClues: [],
    maxHints: 0,
    score: 100,
  };
}

export function createQuizRound(
  pokemon: PokemonQuizData,
  difficulty: Difficulty,
  professorLevel?: ProfessorLevel,
): QuizRound {
  switch (difficulty) {
    case "kids":
      return createKidsRound(pokemon);
    case "adult":
      return createAdultRound(pokemon);
    case "professor":
      return createProfessorRound(pokemon, professorLevel);
    case "trainer":
      throw new Error("トレーナーモードはバトルクイズ生成を使用してください。");
    case "silhouette":
      throw new Error("シルエットタイムアタックは専用の生成処理を使用してください。");
  }
}

export function revealNextHint(round: QuizRound): QuizRound {
  const revealedHints = Math.min(round.revealedHints + 1, round.maxHints);
  return {
    ...round,
    revealedHints,
    score: calculateRoundScore(revealedHints, round.wrongAttempts),
  };
}

export function registerWrongAnswer(round: QuizRound): QuizRound {
  const wrongAttempts = round.wrongAttempts + 1;
  return {
    ...round,
    wrongAttempts,
    score: calculateRoundScore(round.revealedHints, wrongAttempts),
  };
}

export function visibleClues(round: QuizRound): QuizClue[] {
  const hintGroups = round.hintClueGroups ?? round.hintClues.map((hint) => [hint]);
  return [...round.initialClues, ...hintGroups.slice(0, round.revealedHints).flat()];
}

export function shouldShowPokemonImage(round: QuizRound): boolean {
  if (round.hidePokemonVisual) {
    return false;
  }

  if (round.showPokemonVisual !== undefined) {
    return round.showPokemonVisual;
  }

  if (round.difficulty === "kids" || round.difficulty === "adult") {
    return true;
  }

  return visibleClues(round).some((entry) => entry.kind === "image");
}

export function shouldUseBlackSilhouette(round: QuizRound): boolean {
  if (round.forceBlackSilhouette) {
    return true;
  }

  if (round.showPokemonVisual !== undefined) {
    return false;
  }

  if (round.difficulty === "kids") {
    return false;
  }

  if (round.difficulty === "adult") {
    return round.revealedHints < 3;
  }

  return visibleClues(round).some((entry) => entry.kind === "image");
}

export function normalizeAnswer(value: string): string {
  return hiraganaToKatakana(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizeApiName(value: string): string {
  return value.normalize("NFKC").trim().replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function isCorrectAnswer(input: string, pokemon: PokemonQuizData): boolean {
  const normalized = normalizeAnswer(input);
  const acceptedKana = [pokemon.displayNameJa, pokemon.displayNameHira].map(normalizeAnswer);
  const acceptedApiName = normalizeApiName(pokemon.apiName);

  return acceptedKana.includes(normalized) || normalizeApiName(input) === acceptedApiName;
}

export function isTextAnswerRound(round: QuizRound): boolean {
  return round.answerFormat === "text";
}

export function isCorrectStructuredAnswer(
  round: QuizRound,
  answerValue: string,
  secondAnswerValue?: string,
): boolean {
  if (round.answerFormat === "dual-select") {
    return (
      round.correctAnswerValues?.first === answerValue &&
      round.correctAnswerValues?.second === secondAnswerValue
    );
  }

  return round.correctAnswerValue === answerValue;
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
