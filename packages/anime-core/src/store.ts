import { create } from "zustand";

import { computeTier } from "./rank";
import type { Anime, AnimeItem, Tier } from "./types";

type AnimeStore = {
  list: AnimeItem[];
  history: Array<{
    animeId: number;
    name: string;
    cover: string;
    addedAt: string;
  }>;
  selectedTag: string;
  addAnime: (anime: Anime) => void;
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
  addAnime: (anime) =>
    set((state) => {
      const existed = state.list.some((item) => item.id === anime.id);

      if (existed) {
        return state;
      }

      const record: AnimeItem = {
        ...anime,
        tier: computeTier(anime.score),
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
          },
          ...state.history,
        ],
      };
    }),
  removeAnime: (id) =>
    set((state) => ({
      list: state.list.filter((item) => item.id !== id),
    })),
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
