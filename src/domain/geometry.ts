export type Cell = readonly [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export type Direction = 1 | -1;

const ROTATIONS: Record<Axis, (c: Cell) => Cell> = {
  x: ([x, y, z]) => [x, -z, y],
  y: ([x, y, z]) => [z, y, -x],
  z: ([x, y, z]) => [-y, x, z],
};

/** Rotates a cell 90 degrees around the given axis through the origin (positive = counter-clockwise). */
export function rotateCell(cell: Cell, axis: Axis, dir: Direction): Cell {
  const quarter = ROTATIONS[axis];
  const [x, y, z] = dir === 1 ? quarter(cell) : quarter(quarter(quarter(cell)));
  return [x || 0, y || 0, z || 0]; // normalise -0

}

export function translate(cells: readonly Cell[], [dx, dy, dz]: Cell): Cell[] {
  return cells.map(([x, y, z]) => [x + dx, y + dy, z + dz] as const);
}

export interface Bounds {
  min: Cell;
  max: Cell;
}

export function bounds(cells: readonly Cell[]): Bounds {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const c of cells) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], c[i]);
      max[i] = Math.max(max[i], c[i]);
    }
  }
  return { min: min as unknown as Cell, max: max as unknown as Cell };
}

/** Doubled bounding-box center, kept integer to avoid rounding drift. */
function doubledCenter(cells: readonly Cell[]): Cell {
  const { min, max } = bounds(cells);
  return [min[0] + max[0], min[1] + max[1], min[2] + max[2]];
}

/** Rotates a set of absolute cells in place around its own bounding-box center. */
export function rotateCells(cells: readonly Cell[], axis: Axis, dir: Direction): Cell[] {
  const before = doubledCenter(cells);
  const rotated = cells.map((c) => rotateCell(c, axis, dir));
  const after = doubledCenter(rotated);
  // Opposite rounding per direction makes a rotation and its inverse cancel exactly.
  const round = dir === 1 ? Math.floor : Math.ceil;
  const shift: Cell = [
    round((before[0] - after[0]) / 2),
    round((before[1] - after[1]) / 2),
    round((before[2] - after[2]) / 2),
  ];
  return translate(rotated, shift);
}

export const cellKey = ([x, y, z]: Cell): string => `${x},${y},${z}`;
