import { create } from "zustand";

import { computeTier } from "./rank";
import type { Anime, AnimeItem, HistoryRecord, Tier } from "./types";

type AnimeStore = {
  list: AnimeItem[];
  history: HistoryRecord[];
  selectedTag: string;
  setList: (list: AnimeItem[]) => void;
  setHistory: (history: HistoryRecord[]) => void;
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
  selectedTag: "all",
  setList: (list) =>
    set(() => ({
      list,
    })),
  setHistory: (history) =>
    set(() => ({
      history,
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

      return {
        list: [record, ...state.list],
        history: [
          {
            animeId: record.id,
            name: record.name,
            cover: record.cover,
            addedAt: record.addedAt,
            action: "add",
          },
          ...state.history,
        ],
      };
    }),
  removeAnime: (id) =>
    set((state) => {
      const target = state.list.find((item) => item.id === id);
      if (!target) {
        return state;
      }

      return {
        list: state.list.filter((item) => item.id !== id),
        history: [
          {
            animeId: target.id,
            name: target.name,
            cover: target.cover,
            addedAt: new Date().toISOString(),
            action: "remove",
          },
          ...state.history,
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
