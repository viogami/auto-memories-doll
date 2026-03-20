export const TIER_ORDER = ["S", "A", "B", "C", "Unrated"] as const;

export type Tier = (typeof TIER_ORDER)[number];

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
