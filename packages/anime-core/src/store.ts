import { create } from "zustand";

import { computeTier } from "./rank";
import type {
  Anime,
  AnimeItem,
  HistoryRecord,
  RemovedHistoryRecord,
  Tier,
} from "./types";

const normalizeHistory = (history: HistoryRecord[]): HistoryRecord[] => {
  const byAnime = new Map<number, HistoryRecord>();

  for (const item of history) {
    const existed = byAnime.get(item.animeId);
    if (!existed) {
      byAnime.set(item.animeId, item);
      continue;
    }

    const existedTs = new Date(existed.addedAt).getTime();
    const currentTs = new Date(item.addedAt).getTime();
    if (Number.isNaN(existedTs) || currentTs >= existedTs) {
      byAnime.set(item.animeId, item);
    }
  }

  return [...byAnime.values()];
};

type AnimeStore = {
  list: AnimeItem[];
  history: HistoryRecord[];
  removedHistory: RemovedHistoryRecord[];
  selectedTag: string;
  setList: (list: AnimeItem[]) => void;
  setHistory: (history: HistoryRecord[]) => void;
  setRemovedHistory: (history: RemovedHistoryRecord[]) => void;
  addAnime: (anime: Anime, availableTiers?: Tier[]) => void;
  removeAnime: (id: number) => void;
  reorder: (next: AnimeItem[]) => void;
  updateTier: (id: number, tier: Tier) => void;
  remapTier: (fromTier: Tier, toTier: Tier) => void;
  setTags: (id: number, tags: string[]) => void;
  setSelectedTag: (tag: string) => void;
};

export const useAnimeStore = create<AnimeStore>((set) => ({
  list: [],
  history: [],
  removedHistory: [],
  selectedTag: "all",
  setList: (list) =>
    set(() => ({
      list,
    })),
  setHistory: (history) =>
    set(() => ({
      history: normalizeHistory(history),
    })),
  setRemovedHistory: (history) =>
    set(() => ({
      removedHistory: history,
    })),
  addAnime: (anime, availableTiers) =>
    set((state) => {
      const existed = state.list.some((item) => item.id === anime.id);

      if (existed) {
        return state;
      }

      const record: AnimeItem = {
        ...anime,
        tier: computeTier(anime.score, availableTiers),
        tags: [],
        addedAt: new Date().toISOString(),
      };
      const historyRecord: HistoryRecord = {
        animeId: record.id,
        name: record.name,
        cover: record.cover,
        addedAt: record.addedAt,
      };

      return {
        list: [record, ...state.list],
        history: [...state.history, historyRecord],
        removedHistory: state.removedHistory.filter(
          (item) => item.animeId !== anime.id,
        ),
      };
    }),
  removeAnime: (id) =>
    set((state) => {
      const target = state.list.find((item) => item.id === id);
      if (!target) {
        return state;
      }

      const lastAddedRecord = [...state.history]
        .reverse()
        .find((item) => item.animeId === id);

      return {
        list: state.list.filter((item) => item.id !== id),
        history: state.history.filter((item) => item.animeId !== id),
        removedHistory: [
          ...state.removedHistory,
          {
            animeId: target.id,
            name: target.name,
            cover: target.cover,
            removedAt: new Date().toISOString(),
            addedAt: lastAddedRecord?.addedAt,
          },
        ],
      };
    }),
  reorder: (next) =>
    set(() => ({
      list: next,
    })),
  updateTier: (id, tier) =>
    set((state) => ({
      list: state.list.map((item) =>
        item.id === id
          ? {
              ...item,
              tier,
            }
          : item,
      ),
    })),
  remapTier: (fromTier, toTier) =>
    set((state) => ({
      list: state.list.map((item) =>
        item.tier === fromTier
          ? {
              ...item,
              tier: toTier,
            }
          : item,
      ),
    })),
  setTags: (id, tags) =>
    set((state) => ({
      list: state.list.map((item) =>
        item.id === id
          ? {
              ...item,
              tags,
            }
          : item,
      ),
    })),
  setSelectedTag: (tag) =>
    set(() => ({
      selectedTag: tag,
    })),
}));
