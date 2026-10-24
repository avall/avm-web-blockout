import { describe, expect, it } from 'vitest';
import type { Cell } from '../../src/domain/geometry';
import { exposedFaces, outlineEdges } from '../../src/render/faces';

describe('exposedFaces', () => {
  it.each([
    [[[0, 0, 0]], 6],
    [[[0, 0, 0], [1, 0, 0]], 10],
    [[[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]], 16],
  ] as [Cell[], number][])('hides shared faces (%j)', (cells, count) => {
    expect(exposedFaces(cells)).toHaveLength(count);
  });
});

describe('outlineEdges', () => {
  it.each([
    [[[0, 0, 0]], 12],
    [[[0, 0, 0], [1, 0, 0]], 16],
    [[[0, 0, 0], [1, 0, 0], [0, 1, 0]], 22],
  ] as [Cell[], number][])('draws only silhouette unit edges (%j)', (cells, count) => {
    expect(outlineEdges(cells)).toHaveLength(count);
  });
});
