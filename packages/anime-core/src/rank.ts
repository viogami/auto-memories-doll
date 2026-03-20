import { TIER_ORDER, type AnimeItem, type Tier } from "./types";

function getTierRank(tier: Tier): number {
  const index = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]);
  return index === -1 ? TIER_ORDER.length + 1 : index;
}

export function computeTier(score: number): Tier {
  if (score >= 8.8) {
    return "S";
  }

  if (score >= 8) {
    return "A";
  }

  if (score >= 7) {
    return "B";
  }

  if (score > 0) {
    return "C";
  }

  return "Unrated";
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
