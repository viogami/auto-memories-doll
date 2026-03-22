export const TIER_ORDER = ["S", "A", "B", "C", "Unrated"] as const;

export type Tier = string;

export type Anime = {
  id: number;
  name: string;
  cover: string;
  score: number;
};

export type AnimeItem = Anime & {
  tier: Tier;
  tags: string[];
  addedAt: string;
};

export type HistoryAction = "add" | "remove";

export type HistoryRecord = {
  animeId: number;
  name: string;
  cover: string;
  addedAt: string;
  action?: HistoryAction;
};
