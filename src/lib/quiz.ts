import { hiraganaToKatakana } from "./pokeapi";
import type { Difficulty, PokemonQuizData, QuizClue, QuizRound } from "./types";

export const TOTAL_QUESTIONS = 8;

export const difficultyLabels: Record<Difficulty, string> = {
  kids: "キッズ",
  adult: "大人",
  professor: "博士",
  trainer: "トレーナー",
};

export const difficultyDescriptions: Record<Difficulty, string> = {
  kids: "ひらがなでポケモン名を覚える",
  adult: "姿とタイプからポケモンを知る",
  professor: "図鑑・生態・分類で知識を競う",
  trainer: "タイプ相性とバトル知識を鍛える",
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
    clue("adult-types", "タイプ", pokemon.typesJa.join(" / ")),
    clue("adult-mask", "なまえ", maskName(name, 0), "name"),
    clue("adult-color", "すがた", "カラーの姿が表示されました", "image"),
    clue("adult-first-letter", "なまえ", maskName(name, 1), "name"),
  ];

  return {
    answer: pokemon.displayNameJa,
    difficulty: "adult",
    pokemon,
    revealedHints: 0,
    wrongAttempts: 0,
    initialClues: [clue("adult-image", "すがた", "シルエットが表示されています", "image")],
    hintClues,
    maxHints: hintClues.length,
    score: 100,
  };
}

function professorFacts(pokemon: PokemonQuizData): QuizClue[] {
  const cryClue = pokemon.cryUrl
    ? clue("professor-cry", "鳴き声", pokemon.cryUrl, "audio")
    : clue("professor-cry", "鳴き声", "PokeAPIに鳴き声データなし");

  return [
    clue("professor-id", "図鑑No.", String(pokemon.id)),
    clue(
      "professor-size",
      "身長・重さ",
      `${pokemon.heightM.toFixed(1)}m / ${pokemon.weightKg.toFixed(1)}kg`,
    ),
    clue("professor-abilities", "特性", pokemon.abilitiesJa.join(" / ") || "不明"),
    clue("professor-types", "タイプ", pokemon.typesJa.join(" / ")),
    clue("professor-flavor", "図鑑説明", pokemon.flavorTextJa),
    clue("professor-genus", "分類", pokemon.genusJa),
    clue("professor-generation", "追加世代", pokemon.generationJa),
    cryClue,
  ];
}

function createProfessorRound(pokemon: PokemonQuizData): QuizRound {
  const facts = shuffle(professorFacts(pokemon));
  const hintClues = [
    ...facts.slice(1),
    clue("professor-mask", "なまえ", maskName(pokemon.displayNameJa, 0), "name"),
    clue("professor-silhouette", "すがた", "シルエットが表示されました", "image"),
  ];

  return {
    answer: pokemon.displayNameJa,
    difficulty: "professor",
    pokemon,
    revealedHints: 0,
    wrongAttempts: 0,
    initialClues: [facts[0]],
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
    clue("trainer-types", "タイプ", pokemon.typesJa.join(" / ")),
    clue("trainer-weakness", "弱点", weaknessText),
    clue("trainer-resistance", "耐性", resistanceParts.join(" / ") || "大きな耐性なし"),
    clue("trainer-best-stat", "高い能力", highestStat(pokemon)),
    clue("trainer-speed", "素早さの目安", `${speed}。${speedBand(speed)}ポケモン`),
    clue("trainer-abilities", "特性", pokemon.abilitiesJa.join(" / ") || "不明"),
    clue("trainer-moves", "覚える技の例", pokemon.moves.join(" / ") || "技データなし"),
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
    pokemon,
    revealedHints: 0,
    wrongAttempts: 0,
    initialClues: [facts[0]],
    hintClues,
    maxHints: hintClues.length,
    score: 100,
  };
}

export function createQuizRound(pokemon: PokemonQuizData, difficulty: Difficulty): QuizRound {
  switch (difficulty) {
    case "kids":
      return createKidsRound(pokemon);
    case "adult":
      return createAdultRound(pokemon);
    case "professor":
      return createProfessorRound(pokemon);
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
  if (round.difficulty === "kids" || round.difficulty === "adult") {
    return true;
  }

  return visibleClues(round).some((entry) => entry.kind === "image");
}

export function shouldUseBlackSilhouette(round: QuizRound): boolean {
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

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
