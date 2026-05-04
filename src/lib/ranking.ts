import type {
  Difficulty,
  ProfessorLevel,
  RankingEntry,
  RankingKey,
  SilhouetteLevel,
  TrainerLevel,
} from "./types";

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
  "silhouette-kage-searcher",
  "silhouette-shadow-runner",
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
    "silhouette-kage-searcher": [],
    "silhouette-shadow-runner": [],
  };
}

export function getRankingKey(
  difficulty: Difficulty,
  professorLevel: ProfessorLevel = "exam",
  trainerLevel: TrainerLevel = "gymLeader",
  silhouetteLevel: SilhouetteLevel = "kageSearcher",
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

  if (difficulty === "silhouette") {
    const keyByLevel: Record<SilhouetteLevel, RankingKey> = {
      kageSearcher: "silhouette-kage-searcher",
      shadowRunner: "silhouette-shadow-runner",
    };

    return keyByLevel[silhouetteLevel];
  }

  return difficulty;
}

function metadataForRankingKey(
  key: RankingKey,
): Pick<RankingEntry, "difficulty" | "professorLevel" | "trainerLevel" | "silhouetteLevel"> {
  if (key === "professor-apprentice") {
    return {
      difficulty: "professor",
      professorLevel: "apprentice",
      trainerLevel: undefined,
      silhouetteLevel: undefined,
    };
  }

  if (key === "professor-training") {
    return {
      difficulty: "professor",
      professorLevel: "training",
      trainerLevel: undefined,
      silhouetteLevel: undefined,
    };
  }

  if (key === "professor-exam") {
    return {
      difficulty: "professor",
      professorLevel: "exam",
      trainerLevel: undefined,
      silhouetteLevel: undefined,
    };
  }

  if (key === "trainer-masara") {
    return {
      difficulty: "trainer",
      professorLevel: undefined,
      trainerLevel: "masara",
      silhouetteLevel: undefined,
    };
  }

  if (key === "trainer-gym-leader") {
    return {
      difficulty: "trainer",
      professorLevel: undefined,
      trainerLevel: "gymLeader",
      silhouetteLevel: undefined,
    };
  }

  if (key === "trainer-elite-four") {
    return {
      difficulty: "trainer",
      professorLevel: undefined,
      trainerLevel: "eliteFour",
      silhouetteLevel: undefined,
    };
  }

  if (key === "trainer-champion") {
    return {
      difficulty: "trainer",
      professorLevel: undefined,
      trainerLevel: "champion",
      silhouetteLevel: undefined,
    };
  }

  if (key === "silhouette-kage-searcher") {
    return {
      difficulty: "silhouette",
      professorLevel: undefined,
      trainerLevel: undefined,
      silhouetteLevel: "kageSearcher",
    };
  }

  if (key === "silhouette-shadow-runner") {
    return {
      difficulty: "silhouette",
      professorLevel: undefined,
      trainerLevel: undefined,
      silhouetteLevel: "shadowRunner",
    };
  }

  return { difficulty: key, professorLevel: undefined, trainerLevel: undefined, silhouetteLevel: undefined };
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
  const key = getRankingKey(entry.difficulty, entry.professorLevel, entry.trainerLevel, entry.silhouetteLevel);
  const normalizedEntry =
    entry.difficulty === "professor"
      ? { ...entry, professorLevel: entry.professorLevel ?? "exam", trainerLevel: undefined, silhouetteLevel: undefined }
      : entry.difficulty === "trainer"
        ? { ...entry, professorLevel: undefined, trainerLevel: entry.trainerLevel ?? "gymLeader", silhouetteLevel: undefined }
        : entry.difficulty === "silhouette"
          ? { ...entry, professorLevel: undefined, trainerLevel: undefined, silhouetteLevel: entry.silhouetteLevel ?? "kageSearcher" }
          : { ...entry, professorLevel: undefined, trainerLevel: undefined, silhouetteLevel: undefined };

  store[key] = sortEntries([...store[key], normalizedEntry]);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
}
