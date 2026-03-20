import type { AnimeItem } from "./types";

export type GridCell = AnimeItem | null;

export function toNineGrid(items: AnimeItem[]): GridCell[] {
  const cells: GridCell[] = new Array(9).fill(null);

  for (let i = 0; i < 9; i += 1) {
    cells[i] = items[i] ?? null;
  }

  return cells;
}

export function compactGrid(cells: GridCell[]): GridCell[] {
  const compacted = cells.filter((item): item is AnimeItem => item !== null);
  return [...compacted, ...new Array(9 - compacted.length).fill(null)].slice(
    0,
    9,
  );
}
