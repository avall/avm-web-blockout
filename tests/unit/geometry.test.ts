import { describe, expect, it } from 'vitest';
import type { Axis, Cell, Direction } from '../../src/domain/geometry';
import { bounds, cellKey, rotateCell, rotateCells } from '../../src/domain/geometry';
import { shapesFor } from '../../src/domain/pieces';

const sorted = (cells: readonly Cell[]) => cells.map(cellKey).sort();
const AXES: Axis[] = ['x', 'y', 'z'];

describe('rotateCell', () => {
  it.each([
    ['x', [0, 1, 0], [0, 0, 1]],
    ['y', [0, 0, 1], [1, 0, 0]],
    ['z', [1, 0, 0], [0, 1, 0]],
  ] as const)('rotates a quarter turn around %s', (axis, from, to) => {
    expect(rotateCell(from, axis, 1)).toEqual(to);
  });

  it.each(AXES)('four quarter turns around %s return to the start', (axis) => {
    let c: Cell = [1, 2, 3];
    for (let i = 0; i < 4; i++) c = rotateCell(c, axis, 1);
    expect(c).toEqual([1, 2, 3]);
  });
});

describe('rotateCells', () => {
  const shapes = shapesFor('extended', 7, 7);
  const cases = shapes.flatMap((s) => AXES.flatMap((a) => ([1, -1] as Direction[]).map((d) => [s.id, a, d, s.cells] as const)));

  it.each(cases)('%s around %s (%i) is undone by the inverse rotation', (_id, axis, dir, cells) => {
    const start = cells.map(([x, y, z]) => [x + 3, y + 3, z + 3] as const);
    const back = rotateCells(rotateCells(start, axis, dir), axis, (-dir) as Direction);
    expect(sorted(back)).toEqual(sorted(start));
  });

  it('keeps the piece near its own centre', () => {
    const start: Cell[] = [[2, 2, 5], [3, 2, 5], [4, 2, 5]];
    const { min, max } = bounds(rotateCells(start, 'z', 1));
    expect([min, max]).toEqual([[3, 1, 5], [3, 3, 5]]);
  });
});
