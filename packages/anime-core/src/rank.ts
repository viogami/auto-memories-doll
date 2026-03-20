import { TIER_ORDER, type AnimeItem, type Tier } from "./types";

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
    const tierA = TIER_ORDER.indexOf(a.tier);
    const tierB = TIER_ORDER.indexOf(b.tier);

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
