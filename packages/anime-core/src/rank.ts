import { TIER_ORDER, type AnimeItem, type Tier } from "./types";

function getTierRank(tier: Tier): number {
  const index = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]);
  return index === -1 ? TIER_ORDER.length + 1 : index;
}

export function computeTier(score: number, availableTiers?: Tier[]): Tier {
  const tiers =
    Array.isArray(availableTiers) && availableTiers.length > 0
      ? Array.from(
          new Set(
            availableTiers
              .map((item) => item.trim())
              .filter((item): item is Tier => item.length > 0),
          ),
        )
      : [...TIER_ORDER];

  if (tiers.length === 0) {
    return "Unrated";
  }

  const fallbackTier = tiers[tiers.length - 1] || "Unrated";
  if (!Number.isFinite(score) || score < 5) {
    return fallbackTier;
  }

  const clampedScore = Math.max(5, Math.min(10, score));
  const sliceSize = 5 / tiers.length;
  const offset = 10 - clampedScore;
  const index = Math.min(tiers.length - 1, Math.floor(offset / sliceSize));

  return tiers[index] || fallbackTier;
}

export function sortByTierAndScore(items: AnimeItem[]): AnimeItem[] {
  return [...items].sort((a, b) => {
    const tierA = getTierRank(a.tier);
    const tierB = getTierRank(b.tier);

    if (tierA !== tierB) {
      return tierA - tierB;
    }

    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.name.localeCompare(b.name);
  });
}

export function moveItem<T>(
  list: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);

  if (typeof moved === "undefined") {
    return list;
  }

  next.splice(toIndex, 0, moved);
  return next;
}
