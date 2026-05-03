export type Difficulty = "kids" | "adult" | "professor" | "trainer";
export type ProfessorLevel = "apprentice" | "training" | "exam";
export type TrainerLevel = "masara" | "gymLeader" | "eliteFour" | "champion";
export type TrainerQuestionKind =
  | "pokemon-guess"
  | "type-matchup"
  | "move-effectiveness"
  | "move-type"
  | "ability-description"
  | "nature-stat"
  | "move-accuracy"
  | "move-power"
  | "stat-comparison"
  | "move-priority";
export type AnswerFormat = "text" | "choice" | "select" | "dual-select";
export type RankingKey =
  | "kids"
  | "adult"
  | "professor-apprentice"
  | "professor-training"
  | "professor-exam"
  | "trainer-masara"
  | "trainer-gym-leader"
  | "trainer-elite-four"
  | "trainer-champion";

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
  typeNamesApi: string[];
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

export interface QuizChoice {
  value: string;
  label: string;
  description?: string;
}

export interface QuizPrompt {
  title: string;
  body: string;
  detail?: string;
}

export interface DualSelectConfig {
  firstLabel: string;
  secondLabel: string;
  firstOptions: QuizChoice[];
  secondOptions: QuizChoice[];
}

export interface QuizRound {
  answer: string;
  difficulty: Difficulty;
  professorLevel?: ProfessorLevel;
  trainerLevel?: TrainerLevel;
  trainerQuestionKind?: TrainerQuestionKind;
  answerFormat: AnswerFormat;
  prompt?: QuizPrompt;
  choices?: QuizChoice[];
  selectOptions?: QuizChoice[];
  dualSelect?: DualSelectConfig;
  correctAnswerValue?: string;
  correctAnswerValues?: {
    first: string;
    second: string;
  };
  correctAnswerLabel?: string;
  resultDetail?: string;
  showPokemonVisual?: boolean;
  pokemon: PokemonQuizData;
  revealedHints: number;
  wrongAttempts: number;
  initialClues: QuizClue[];
  hintClues: QuizClue[];
  maxHints: number;
  score: number;
}

export interface RankingEntry {
  difficulty: Difficulty;
  professorLevel?: ProfessorLevel;
  trainerLevel?: TrainerLevel;
  playerName: string;
  score: number;
  hintsUsed: number;
  elapsedMs: number;
  completedAt: string;
}
