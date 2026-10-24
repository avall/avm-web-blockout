import type { Cell } from './geometry';
import type { Pit } from './pit';

/** Lowest z the piece can fall to (hard drop target). */
export function landing(pit: Pit, cells: readonly Cell[]): Cell[] {
  let current = cells.map((c) => [...c] as unknown as Cell);
  for (;;) {
    const next = current.map(([x, y, z]) => [x, y, z - 1] as const);
    if (!pit.fits(next)) return current;
    current = next;
  }
}

/** Cubes with the lowest z inside each (x, y) column of the piece: the faces that will touch the ground. */
export function bottomCells(cells: readonly Cell[]): Cell[] {
  const lowest = new Map<string, Cell>();
  for (const c of cells) {
    const key = `${c[0]},${c[1]}`;
    const prev = lowest.get(key);
    if (!prev || c[2] < prev[2]) lowest.set(key, c);
  }
  return [...lowest.values()];
}

/** Empty cells that would be left covered right under the piece once it lands. */
export function predictedHoles(pit: Pit, cells: readonly Cell[]): Cell[] {
  return bottomCells(landing(pit, cells))
    .map(([x, y, z]) => [x, y, z - 1] as const)
    .filter((below) => below[2] >= 0 && !pit.occupied(below));
}
