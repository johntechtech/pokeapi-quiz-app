import type {
  Difficulty,
  ProfessorLevel,
  RankingEntry,
  RankingKey,
  SilhouetteLevel,
  TrainerLevel,
} from "./types";

const STORAGE_KEY = "poke-quiz-rankings:v2";
const LEGACY_STORAGE_KEYS = ["poke-quiz-rankings:v1", "poke-quiz-rankings"];
const USERS_KEY = "poke-quiz-users:v1";
const FRIENDS_KEY = "poke-quiz-friends:v1";
const DEFAULT_TRAINER_NAME = "ななしのトレーナー";

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
export type RankingScope = "global" | "friends";
export type RankingDraft = Omit<RankingEntry, "userId" | "displayName">;

export interface AuthUser {
  id: string;
  displayName: string;
}

export interface FriendRelation {
  userId: string;
  friendUserId: string;
  status: "pending" | "accepted" | "blocked";
}

export interface RankingQuery {
  difficulty: Difficulty;
  professorLevel?: ProfessorLevel;
  trainerLevel?: TrainerLevel;
  silhouetteLevel?: SilhouetteLevel;
  scope: RankingScope;
  viewerUserId: string;
}

type StoredRankingEntry = Partial<RankingEntry> & {
  difficulty?: Difficulty;
  playerName?: string;
  score?: number;
  hintsUsed?: number;
  elapsedMs?: number;
  completedAt?: string;
};

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

function createUserId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readAuthenticatedUser(): AuthUser {
  const raw = localStorage.getItem(USERS_KEY);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<AuthUser>;
      if (parsed.id && parsed.displayName) {
        return { id: parsed.id, displayName: parsed.displayName };
      }
    } catch {
      // Fall through and replace a corrupted local profile.
    }
  }

  const seed: AuthUser = { id: createUserId(), displayName: DEFAULT_TRAINER_NAME };
  localStorage.setItem(USERS_KEY, JSON.stringify(seed));
  return seed;
}

export async function getAuthenticatedUser(): Promise<AuthUser> {
  return readAuthenticatedUser();
}

function updateAuthenticatedUser(displayName: string): AuthUser {
  const user = readAuthenticatedUser();
  const nextUser = { ...user, displayName: displayName.trim() || DEFAULT_TRAINER_NAME };
  localStorage.setItem(USERS_KEY, JSON.stringify(nextUser));
  return nextUser;
}

function normalizeEntry(entry: StoredRankingEntry, key: RankingKey): RankingEntry | null {
  if (!entry?.completedAt || typeof entry.elapsedMs !== "number") {
    return null;
  }

  const playerName =
    typeof entry.playerName === "string" && entry.playerName.trim()
      ? entry.playerName.trim()
      : DEFAULT_TRAINER_NAME;
  const currentUser = readAuthenticatedUser();

  return {
    ...entry,
    ...metadataForRankingKey(key),
    userId: typeof entry.userId === "string" && entry.userId ? entry.userId : currentUser.id,
    displayName:
      typeof entry.displayName === "string" && entry.displayName.trim()
        ? entry.displayName.trim()
        : playerName,
    playerName,
    score: typeof entry.score === "number" ? entry.score : 0,
    hintsUsed: typeof entry.hintsUsed === "number" ? entry.hintsUsed : 0,
    elapsedMs: entry.elapsedMs,
    completedAt: entry.completedAt,
  };
}

function normalizeEntryForSave(entry: RankingDraft, user: AuthUser): RankingEntry {
  const baseEntry = {
    ...entry,
    userId: user.id,
    displayName: user.displayName,
    playerName: entry.playerName.trim() || DEFAULT_TRAINER_NAME,
  };

  if (entry.difficulty === "professor") {
    return {
      ...baseEntry,
      professorLevel: entry.professorLevel ?? "exam",
      trainerLevel: undefined,
      silhouetteLevel: undefined,
    };
  }

  if (entry.difficulty === "trainer") {
    return {
      ...baseEntry,
      professorLevel: undefined,
      trainerLevel: entry.trainerLevel ?? "gymLeader",
      silhouetteLevel: undefined,
    };
  }

  if (entry.difficulty === "silhouette") {
    return {
      ...baseEntry,
      professorLevel: undefined,
      trainerLevel: undefined,
      silhouetteLevel: entry.silhouetteLevel ?? "kageSearcher",
    };
  }

  return {
    ...baseEntry,
    professorLevel: undefined,
    trainerLevel: undefined,
    silhouetteLevel: undefined,
  };
}

function sortEntries(entries: RankingEntry[], key: RankingKey): RankingEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (key.startsWith("silhouette-")) {
      return a.elapsedMs - b.elapsedMs || b.score - a.score;
    }

    return b.score - a.score || a.elapsedMs - b.elapsedMs;
  });

  return sorted.slice(0, 10);
}

function readStoredRankings(): Partial<Record<RankingKey | "professor" | "trainer", StoredRankingEntry[]>> | null {
  const currentRaw = localStorage.getItem(STORAGE_KEY);

  if (currentRaw) {
    return JSON.parse(currentRaw) as Partial<Record<RankingKey | "professor" | "trainer", StoredRankingEntry[]>>;
  }

  for (const key of LEGACY_STORAGE_KEYS) {
    const legacyRaw = localStorage.getItem(key);
    if (legacyRaw) {
      return JSON.parse(legacyRaw) as Partial<Record<RankingKey | "professor" | "trainer", StoredRankingEntry[]>>;
    }
  }

  return null;
}

function saveStore(store: RankingStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function loadRankings(): RankingStore {
  try {
    const parsed = readStoredRankings();
    if (!parsed) {
      return emptyStore();
    }

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

      store[key] = sortEntries(entries, key);
    }

    saveStore(store);
    return store;
  } catch {
    return emptyStore();
  }
}

function loadFriendRelations(): FriendRelation[] {
  try {
    const raw = localStorage.getItem(FRIENDS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as FriendRelation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function acceptedFriendIds(viewerUserId: string): Set<string> {
  const ids = new Set<string>();

  for (const relation of loadFriendRelations()) {
    if (relation.status !== "accepted") {
      continue;
    }

    if (relation.userId === viewerUserId) {
      ids.add(relation.friendUserId);
    }

    if (relation.friendUserId === viewerUserId) {
      ids.add(relation.userId);
    }
  }

  return ids;
}

export async function fetchRankings(query: RankingQuery): Promise<RankingEntry[]> {
  const key = getRankingKey(query.difficulty, query.professorLevel, query.trainerLevel, query.silhouetteLevel);
  const entries = loadRankings()[key] ?? [];

  if (query.scope === "global") {
    return entries;
  }

  const friendIds = acceptedFriendIds(query.viewerUserId);
  return entries.filter((entry) => entry.userId === query.viewerUserId || friendIds.has(entry.userId));
}

export async function saveRankingEntry(entry: RankingDraft): Promise<RankingStore> {
  const user = updateAuthenticatedUser(entry.playerName);
  const store = loadRankings();
  const key = getRankingKey(entry.difficulty, entry.professorLevel, entry.trainerLevel, entry.silhouetteLevel);
  const normalizedEntry = normalizeEntryForSave(entry, user);

  store[key] = sortEntries([...store[key], normalizedEntry], key);
  saveStore(store);
  return store;
}
