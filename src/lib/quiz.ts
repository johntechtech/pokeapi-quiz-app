import {
  CORE_TYPE_NAMES,
  NO_INFORMATION,
  calculateAttackMultiplier,
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
  StatKey,
  TrainerLevel,
  TrainerQuestionKind,
} from "./types";

export const TOTAL_QUESTIONS = 8;

export const difficultyLabels: Record<Difficulty, string> = {
  kids: "キッズ",
  adult: "大人",
  professor: "博士",
  trainer: "トレーナー",
};

export const difficultyDescriptions: Record<Difficulty, string> = {
  kids: "ひらがなと姿でゆっくり遊べます。はじめての一匹にもやさしいです。",
  adult: "姿・タイプ・ヒントから当てる標準モードです。記憶の引き出しを軽く開けます。",
  professor: "分類や図鑑説明から推理します。白衣はなくても参加できます。",
  trainer: "タイプ相性・技・特性・種族値で戦うバトル知識モードです。目指せ脳内チャンピオンロード。",
};

export const professorLevelOrder: ProfessorLevel[] = ["apprentice", "training", "exam"];

export const professorLevelLabels: Record<ProfessorLevel, string> = {
  apprentice: "見習い中",
  training: "修行中",
  exam: "博士検定",
};

export const professorLevelDescriptions: Record<ProfessorLevel, string> = {
  apprentice: "分類・図鑑説明・名前からじっくり推理",
  training: "鳴き声と名前を手がかりに絞り込む",
  exam: "現行博士モードのまま挑む本番",
};

export const trainerLevelOrder: TrainerLevel[] = ["masara", "gymLeader", "eliteFour", "champion"];

export const trainerLevelLabels: Record<TrainerLevel, string> = {
  masara: "マサラタウン",
  gymLeader: "ジムリーダー",
  eliteFour: "四天王",
  champion: "チャンピオン",
};

export const trainerLevelDescriptions: Record<TrainerLevel, string> = {
  masara: "タイプ相性の入口。まずは草むら一歩目から。",
  gymLeader: "技・特性まで見る実戦入門。バッジは気持ち多めで。",
  eliteFour: "性格補正と相性を読む上級戦。回復アイテムは心の中に。",
  champion: "種族値・命中・威力・優先度で勝負。知識の殿堂入りへ。",
};

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
    generation: clue("professor-generation", "追加世代", pokemon.generationJa || NO_INFORMATION),
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
  let hintClues: QuizClue[];

  if (professorLevel === "apprentice") {
    initialClues = [facts.genus, facts.flavor, nameClue];
    hintClues = [
      facts.size,
      ...shuffle([facts.id, facts.abilities, facts.types, facts.generation, facts.cry]),
      silhouetteClue,
    ];
  } else if (professorLevel === "training") {
    initialClues = [facts.cry, nameClue];
    hintClues = [
      ...shuffle([
        facts.id,
        facts.size,
        facts.abilities,
        facts.types,
        facts.flavor,
        facts.genus,
        facts.generation,
      ]),
      silhouetteClue,
    ];
  } else {
    const shuffledFacts = shuffle(Object.values(facts));
    initialClues = [shuffledFacts[0]];
    hintClues = [...shuffledFacts.slice(1), nameClue, silhouetteClue];
  }

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
    maxHints: hintClues.length,
    score: 100,
  };
}

function speedBand(speed: number): string {
  if (speed >= 120) return "かなり速い";
  if (speed >= 90) return "速い";
  if (speed >= 60) return "標準的";
  if (speed >= 35) return "遅め";
  return "かなり遅い";
}

function highestStat(pokemon: PokemonQuizData): string {
  const highest = pokemon.stats.reduce((best, stat) => (stat.value > best.value ? stat : best));
  return `${highest.labelJa} ${highest.value}`;
}

function trainerFacts(pokemon: PokemonQuizData): QuizClue[] {
  const speed = pokemon.stats.find((stat) => stat.key === "speed")?.value ?? 0;
  const weaknessText = pokemon.matchups.weaknessesJa.slice(0, 8).join(" / ") || "目立った弱点なし";
  const resistanceParts = [
    pokemon.matchups.resistancesJa.slice(0, 8).join(" / "),
    pokemon.matchups.immunitiesJa.length > 0
      ? `無効: ${pokemon.matchups.immunitiesJa.join(" / ")}`
      : "",
  ].filter(Boolean);

  return [
    clue("trainer-types", "タイプ", pokemon.typesJa.join(" / ") || NO_INFORMATION),
    clue("trainer-weakness", "弱点", weaknessText),
    clue("trainer-resistance", "耐性", resistanceParts.join(" / ") || "大きな耐性なし"),
    clue("trainer-best-stat", "高い能力", highestStat(pokemon)),
    clue("trainer-speed", "素早さの目安", `${speed}。${speedBand(speed)}ポケモン`),
    clue("trainer-abilities", "特性", pokemon.abilitiesJa.join(" / ") || NO_INFORMATION),
    clue("trainer-moves", "覚える技の例", pokemon.moves.join(" / ") || NO_INFORMATION),
  ];
}

function createTrainerRound(pokemon: PokemonQuizData): QuizRound {
  const facts = shuffle(trainerFacts(pokemon));
  const hintClues = [
    ...facts.slice(1),
    clue("trainer-mask", "なまえ", maskName(pokemon.displayNameJa, 0), "name"),
    clue("trainer-silhouette", "すがた", "シルエットが表示されました", "image"),
  ];

  return {
    answer: pokemon.displayNameJa,
    difficulty: "trainer",
    trainerLevel: "gymLeader",
    trainerQuestionKind: "pokemon-guess",
    answerFormat: "text",
    pokemon,
    revealedHints: 0,
    wrongAttempts: 0,
    initialClues: [facts[0]],
    hintClues,
    maxHints: hintClues.length,
    score: 100,
  };
}

function quizChoice(value: string, label: string, description?: string): QuizChoice {
  return { value, label, description };
}

function getStatValue(pokemon: PokemonQuizData, key: StatKey): number {
  return pokemon.stats.find((stat) => stat.key === key)?.value ?? 0;
}

function statsSummary(pokemon: PokemonQuizData): string {
  return pokemon.stats.map((stat) => `${stat.labelJa} ${stat.value}`).join(" / ");
}

function createTrainerPokemonGuessRound(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
): QuizRound {
  const facts = {
    types: clue("trainer-types", "タイプ", pokemon.typesJa.join(" / ") || NO_INFORMATION),
    name: clue("trainer-mask", "なまえ", maskName(pokemon.displayNameJa, 0), "name"),
    generation: clue("trainer-generation", "世代", pokemon.generationJa || NO_INFORMATION),
    moves: clue("trainer-moves", "覚える技の例", pokemon.moves.join(" / ") || NO_INFORMATION),
    abilities: clue("trainer-abilities", "特性", pokemon.abilitiesJa.join(" / ") || NO_INFORMATION),
    weakness: clue("trainer-weakness", "弱点", pokemon.matchups.weaknessesJa.slice(0, 8).join(" / ") || NO_INFORMATION),
    resistance: clue(
      "trainer-resistance",
      "耐性",
      [
        pokemon.matchups.resistancesJa.slice(0, 8).join(" / "),
        pokemon.matchups.immunitiesJa.length > 0 ? `無効: ${pokemon.matchups.immunitiesJa.join(" / ")}` : "",
      ]
        .filter(Boolean)
        .join(" / ") || NO_INFORMATION,
    ),
    bestStat: clue("trainer-best-stat", "高い能力", highestStat(pokemon)),
    stats: clue("trainer-stats", "種族値", statsSummary(pokemon)),
    image: clue("trainer-silhouette", "すがた", "シルエットが表示されました", "image"),
  };

  let initialClues: QuizClue[];
  let hintClues: QuizClue[];

  if (trainerLevel === "masara") {
    initialClues = [facts.types, facts.name, facts.generation];
    hintClues = [facts.moves, facts.abilities, facts.image];
  } else if (trainerLevel === "eliteFour") {
    initialClues = [facts.weakness, facts.resistance, facts.bestStat];
    hintClues = [facts.types, facts.name, facts.image];
  } else if (trainerLevel === "champion") {
    initialClues = [facts.stats];
    hintClues = [facts.types, facts.abilities, facts.name];
  } else {
    initialClues = [facts.types, facts.weakness];
    hintClues = [facts.bestStat, facts.abilities, facts.name, facts.image];
  }

  return {
    answer: pokemon.displayNameJa,
    difficulty: "trainer",
    trainerLevel,
    trainerQuestionKind: "pokemon-guess",
    answerFormat: "text",
    prompt: {
      title: "ポケモン当て",
      body: "バトルで使う情報からポケモン名を当ててください。",
    },
    pokemon,
    revealedHints: 0,
    wrongAttempts: 0,
    initialClues,
    hintClues,
    maxHints: hintClues.length,
    score: 100,
  };
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
  showPokemonVisual = false,
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
    return ["pokemon-guess", "type-matchup", "move-effectiveness"];
  }

  if (trainerLevel === "eliteFour") {
    return ["pokemon-guess", "nature-stat", "move-effectiveness"];
  }

  if (trainerLevel === "champion") {
    return ["pokemon-guess", "move-accuracy", "move-power", "stat-comparison", "move-priority"];
  }

  return ["pokemon-guess", "move-type", "ability-description", "move-effectiveness"];
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
  const types = shuffle(await getCoreBattleTypes());

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
          body: `相手が「${targetType.nameJa}」タイプの場合、${relationText}になる攻撃タイプはどれ？`,
        },
        initialClues: [
          clue("type-target", "相手のタイプ", targetType.nameJa),
          clue("type-relation", "狙う効果", relationText),
        ],
        choices,
        correctAnswerValue: answer.apiName,
        correctAnswerLabel: `${answer.nameJa}（${relationText}）`,
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
  const move = await fetchRandomBattleMove({ requirePower: true });
  const typeOptions = (await getCoreBattleTypes()).map((type) => quizChoice(type.apiName, type.nameJa));

  return createTrainerKnowledgeRound({
    pokemon,
    trainerLevel,
    trainerQuestionKind: "move-type",
    answer: move.typeJa,
    answerFormat: "select",
    prompt: {
      title: "技のタイプ",
      body: `「${move.nameJa}」のタイプは？`,
    },
    initialClues: [clue("move-name", "技", move.nameJa)],
    selectOptions: typeOptions,
    correctAnswerValue: move.typeApiName,
    correctAnswerLabel: `${move.nameJa}: ${move.typeJa}`,
  });
}

async function createAbilityDescriptionRound(
  pokemon: PokemonQuizData,
  trainerLevel: TrainerLevel,
): Promise<QuizRound> {
  const abilities: BattleAbility[] = [];
  for (let attempt = 0; attempt < 8 && abilities.length < 4; attempt += 1) {
    const ability = await fetchRandomBattleAbility(abilities.map((entry) => entry.apiName));
    if (!abilities.some((entry) => entry.descriptionJa === ability.descriptionJa)) {
      abilities.push(ability);
    }
  }

  if (abilities.length < 4) {
    throw new Error("特性クイズの選択肢を作成できませんでした。");
  }

  const answer = abilities[0];

  return createTrainerKnowledgeRound({
    pokemon,
    trainerLevel,
    trainerQuestionKind: "ability-description",
    answer: answer.descriptionJa,
    answerFormat: "choice",
    prompt: {
      title: "特性クイズ",
      body: `特性「${answer.nameJa}」の説明はどれ？`,
    },
    initialClues: [clue("ability-name", "特性", answer.nameJa)],
    choices: shuffle(abilities).map((ability) => quizChoice(ability.apiName, ability.descriptionJa)),
    correctAnswerValue: answer.apiName,
    correctAnswerLabel: `${answer.nameJa}: ${answer.descriptionJa}`,
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
      body: `性格「${nature.nameJa}」で上がる能力・下がる能力は？`,
    },
    initialClues: [clue("nature-name", "性格", nature.nameJa)],
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
  const move = await fetchRandomBattleMove({
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
  const body = kind === "move-accuracy" ? `「${move.nameJa}」の命中率は？` : `「${move.nameJa}」の威力は？`;

  return createTrainerKnowledgeRound({
    pokemon,
    trainerLevel,
    trainerQuestionKind: kind,
    answer: `${value}${suffix}`,
    answerFormat: "choice",
    prompt: { title, body },
    initialClues: [clue("move-name", "技", move.nameJa)],
    choices: numericChoices(value, kind === "move-accuracy" ? accuracyValues : powerValues, suffix),
    correctAnswerValue: String(value),
    correctAnswerLabel: `${move.nameJa}: ${value}${suffix}`,
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
  const moves = await fetchBattleMovesByNames(priorityMoveNames);

  for (const anchor of shuffle(moves)) {
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
          body: `「${anchor.nameJa}」より優先度が${relationText}技はどれ？`,
        },
        initialClues: [
          clue("anchor-move", "基準の技", anchor.nameJa),
          clue("anchor-priority", "基準の優先度", String(anchor.priority)),
        ],
        choices,
        correctAnswerValue: answer.apiName,
        correctAnswerLabel: `${answer.nameJa}（優先度 ${answer.priority}）`,
      });
    }
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
    case "pokemon-guess":
      return createTrainerPokemonGuessRound(pokemon, trainerLevel);
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

  return createTrainerPokemonGuessRound(pokemon, trainerLevel);
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
      return createTrainerRound(pokemon);
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
  return [...round.initialClues, ...round.hintClues.slice(0, round.revealedHints)];
}

export function shouldShowPokemonImage(round: QuizRound): boolean {
  if (round.showPokemonVisual !== undefined) {
    return round.showPokemonVisual;
  }

  if (round.difficulty === "kids" || round.difficulty === "adult") {
    return true;
  }

  return visibleClues(round).some((entry) => entry.kind === "image");
}

export function shouldUseBlackSilhouette(round: QuizRound): boolean {
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
