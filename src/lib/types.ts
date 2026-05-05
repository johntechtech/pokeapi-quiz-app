export type Difficulty = "kids" | "adult" | "professor" | "trainer" | "silhouette";
export type ProfessorLevel = "apprentice" | "training" | "exam";
export type TrainerLevel = "masara" | "gymLeader" | "eliteFour" | "champion";
export type SilhouetteLevel = "kageSearcher" | "shadowRunner";
export type TrainerQuestionKind =
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
  | "trainer-champion"
  | "silhouette-kage-searcher"
  | "silhouette-shadow-runner";

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
  abilityNamesApi: string[];
  abilitiesJa: string[];
  moveNamesApi: string[];
  heightM: number;
  weightKg: number;
  flavorTextJa: string;
  genusJa: string;
  generationJa: string;
  evolutionOrderJa: string;
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
  imageUrl?: string;
  imageAlt?: string;
  imageTone?: "color" | "black";
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
  silhouetteLevel?: SilhouetteLevel;
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
  forceBlackSilhouette?: boolean;
  hidePokemonVisual?: boolean;
  wrongChoiceValues?: string[];
  pokemon: PokemonQuizData;
  revealedHints: number;
  wrongAttempts: number;
  initialClues: QuizClue[];
  hintClues: QuizClue[];
  hintClueGroups?: QuizClue[][];
  maxHints: number;
  score: number;
}

export interface RankingEntry {
  difficulty: Difficulty;
  professorLevel?: ProfessorLevel;
  trainerLevel?: TrainerLevel;
  silhouetteLevel?: SilhouetteLevel;
  userId: string;
  displayName: string;
  playerName: string;
  score: number;
  hintsUsed: number;
  elapsedMs: number;
  completedAt: string;
  customConditionSummary?: string;
}
