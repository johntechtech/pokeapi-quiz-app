export type Difficulty = "kids" | "adult" | "professor" | "trainer";

export type StatKey =
  | "hp"
  | "attack"
  | "defense"
  | "special-attack"
  | "special-defense"
  | "speed";

export interface PokemonStat {
  key: StatKey;
  labelJa: string;
  value: number;
}

export interface TypeMatchups {
  weaknessesJa: string[];
  resistancesJa: string[];
  immunitiesJa: string[];
}

export interface PokemonQuizData {
  id: number;
  apiName: string;
  displayNameJa: string;
  displayNameHira: string;
  spriteUrl: string;
  artworkUrl: string;
  typesJa: string[];
  abilitiesJa: string[];
  heightM: number;
  weightKg: number;
  flavorTextJa: string;
  genusJa: string;
  generationJa: string;
  cryUrl: string;
  stats: PokemonStat[];
  moves: string[];
  matchups: TypeMatchups;
}

export type ClueKind = "fact" | "name" | "image" | "audio";

export interface QuizClue {
  id: string;
  label: string;
  value: string;
  kind: ClueKind;
}

export interface QuizRound {
  answer: string;
  difficulty: Difficulty;
  pokemon: PokemonQuizData;
  revealedHints: number;
  initialClues: QuizClue[];
  hintClues: QuizClue[];
  maxHints: number;
  score: number;
}

export interface RankingEntry {
  difficulty: Difficulty;
  playerName: string;
  score: number;
  hintsUsed: number;
  elapsedMs: number;
  completedAt: string;
}
