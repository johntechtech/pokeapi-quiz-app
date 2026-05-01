import type { Difficulty, RankingEntry } from "./types";

const STORAGE_KEY = "poke-quiz-rankings:v1";
const difficulties: Difficulty[] = ["kids", "adult", "professor", "trainer"];

export type RankingStore = Record<Difficulty, RankingEntry[]>;

function emptyStore(): RankingStore {
  return {
    kids: [],
    adult: [],
    professor: [],
    trainer: [],
  };
}

export function loadRankings(): RankingStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyStore();
    }

    const parsed = JSON.parse(raw) as Partial<RankingStore>;
    const store = emptyStore();

    for (const difficulty of difficulties) {
      store[difficulty] = (parsed[difficulty] ?? [])
        .filter((entry): entry is RankingEntry => Boolean(entry?.completedAt))
        .sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs)
        .slice(0, 10);
    }

    return store;
  } catch {
    return emptyStore();
  }
}

export function saveRankingEntry(entry: RankingEntry): RankingStore {
  const store = loadRankings();
  store[entry.difficulty] = [...store[entry.difficulty], entry]
    .sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs)
    .slice(0, 10);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
}
