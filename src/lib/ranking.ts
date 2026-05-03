import type { Difficulty, ProfessorLevel, RankingEntry, RankingKey, TrainerLevel } from "./types";

const STORAGE_KEY = "poke-quiz-rankings:v1";
const rankingKeys: RankingKey[] = [
  "kids",
  "adult",
  "professor-apprentice",
  "professor-training",
  "professor-exam",
  "trainer-masara",
  "trainer-gym-leader",
  "trainer-elite-four",
  "trainer-champion",
];

export type RankingStore = Record<RankingKey, RankingEntry[]>;

function emptyStore(): RankingStore {
  return {
    kids: [],
    adult: [],
    "professor-apprentice": [],
    "professor-training": [],
    "professor-exam": [],
    "trainer-masara": [],
    "trainer-gym-leader": [],
    "trainer-elite-four": [],
    "trainer-champion": [],
  };
}

export function getRankingKey(
  difficulty: Difficulty,
  professorLevel: ProfessorLevel = "exam",
  trainerLevel: TrainerLevel = "gymLeader",
): RankingKey {
  if (difficulty === "professor") {
    return `professor-${professorLevel}`;
  }

  if (difficulty === "trainer") {
    const keyByLevel: Record<TrainerLevel, RankingKey> = {
      masara: "trainer-masara",
      gymLeader: "trainer-gym-leader",
      eliteFour: "trainer-elite-four",
      champion: "trainer-champion",
    };

    return keyByLevel[trainerLevel];
  }

  return difficulty;
}

function metadataForRankingKey(
  key: RankingKey,
): Pick<RankingEntry, "difficulty" | "professorLevel" | "trainerLevel"> {
  if (key === "professor-apprentice") {
    return { difficulty: "professor", professorLevel: "apprentice", trainerLevel: undefined };
  }

  if (key === "professor-training") {
    return { difficulty: "professor", professorLevel: "training", trainerLevel: undefined };
  }

  if (key === "professor-exam") {
    return { difficulty: "professor", professorLevel: "exam", trainerLevel: undefined };
  }

  if (key === "trainer-masara") {
    return { difficulty: "trainer", professorLevel: undefined, trainerLevel: "masara" };
  }

  if (key === "trainer-gym-leader") {
    return { difficulty: "trainer", professorLevel: undefined, trainerLevel: "gymLeader" };
  }

  if (key === "trainer-elite-four") {
    return { difficulty: "trainer", professorLevel: undefined, trainerLevel: "eliteFour" };
  }

  if (key === "trainer-champion") {
    return { difficulty: "trainer", professorLevel: undefined, trainerLevel: "champion" };
  }

  return { difficulty: key, professorLevel: undefined, trainerLevel: undefined };
}

function normalizeEntry(entry: RankingEntry, key: RankingKey): RankingEntry | null {
  if (!entry?.completedAt) {
    return null;
  }

  return {
    ...entry,
    ...metadataForRankingKey(key),
  };
}

function sortEntries(entries: RankingEntry[]): RankingEntry[] {
  return entries.sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs).slice(0, 10);
}

export function loadRankings(): RankingStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyStore();
    }

    const parsed = JSON.parse(raw) as Partial<RankingStore> & {
      professor?: RankingEntry[];
      trainer?: RankingEntry[];
    };
    const store = emptyStore();

    for (const key of rankingKeys) {
      const entries = (parsed[key] ?? [])
        .map((entry) => normalizeEntry(entry, key))
        .filter((entry): entry is RankingEntry => Boolean(entry));

      if (key === "professor-exam") {
        entries.push(
          ...(parsed.professor ?? [])
            .map((entry) => normalizeEntry(entry, "professor-exam"))
            .filter((entry): entry is RankingEntry => Boolean(entry)),
        );
      }

      if (key === "trainer-gym-leader") {
        entries.push(
          ...(parsed.trainer ?? [])
            .map((entry) => normalizeEntry(entry, "trainer-gym-leader"))
            .filter((entry): entry is RankingEntry => Boolean(entry)),
        );
      }

      store[key] = sortEntries(entries);
    }

    return store;
  } catch {
    return emptyStore();
  }
}

export function saveRankingEntry(entry: RankingEntry): RankingStore {
  const store = loadRankings();
  const key = getRankingKey(entry.difficulty, entry.professorLevel, entry.trainerLevel);
  const normalizedEntry =
    entry.difficulty === "professor"
      ? { ...entry, professorLevel: entry.professorLevel ?? "exam", trainerLevel: undefined }
      : entry.difficulty === "trainer"
        ? { ...entry, professorLevel: undefined, trainerLevel: entry.trainerLevel ?? "gymLeader" }
        : { ...entry, professorLevel: undefined, trainerLevel: undefined };

  store[key] = sortEntries([...store[key], normalizedEntry]);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
}
