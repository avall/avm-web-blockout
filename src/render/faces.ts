import type { Cell } from '../domain/geometry';
import { cellKey } from '../domain/geometry';

export type Vec3 = [number, number, number];

export interface Face {
  cell: Cell;
  /** Axis index of the normal (0 = x, 1 = y, 2 = z) and its sign. */
  axis: 0 | 1 | 2;
  sign: 1 | -1;
  /** Counter-clockwise corners seen from outside. */
  corners: [Vec3, Vec3, Vec3, Vec3];
}

const DIRECTIONS: { axis: 0 | 1 | 2; sign: 1 | -1 }[] = [
  { axis: 0, sign: 1 }, { axis: 0, sign: -1 },
  { axis: 1, sign: 1 }, { axis: 1, sign: -1 },
  { axis: 2, sign: 1 }, { axis: 2, sign: -1 },
];

function faceCorners([x, y, z]: Cell, axis: 0 | 1 | 2, sign: 1 | -1): [Vec3, Vec3, Vec3, Vec3] {
  const base: Vec3 = [x, y, z];
  if (sign === 1) base[axis] += 1;
  const u = ((axis + 1) % 3) as 0 | 1 | 2;
  const v = ((axis + 2) % 3) as 0 | 1 | 2;
  const at = (du: number, dv: number): Vec3 => {
    const p: Vec3 = [...base];
    p[u] += du;
    p[v] += dv;
    return p;
  };
  const quad: [Vec3, Vec3, Vec3, Vec3] = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
  return sign === 1 ? quad : [quad[0], quad[3], quad[2], quad[1]];
}

/** Faces of the cell set that are not shared with another cell of the same set. */
export function exposedFaces(cells: readonly Cell[]): Face[] {
  const set = new Set(cells.map(cellKey));
  const faces: Face[] = [];
  for (const cell of cells) {
    for (const { axis, sign } of DIRECTIONS) {
      const n: [number, number, number] = [cell[0], cell[1], cell[2]];
      n[axis] += sign;
      if (!set.has(cellKey(n))) faces.push({ cell, axis, sign, corners: faceCorners(cell, axis, sign) });
    }
  }
  return faces;
}

/** Silhouette and crease edges: edges between exposed faces that are not coplanar. */
export function outlineEdges(cells: readonly Cell[]): [Vec3, Vec3][] {
  const edges = new Map<string, { a: Vec3; b: Vec3; normals: string[] }>();
  for (const face of exposedFaces(cells)) {
    const normal = `${face.axis}${face.sign}`;
    face.corners.forEach((a, i) => {
      const b = face.corners[(i + 1) % 4];
      const key = [a.join(','), b.join(',')].sort().join('|');
      const entry = edges.get(key) ?? { a, b, normals: [] };
      entry.normals.push(normal);
      edges.set(key, entry);
    });
  }
  return [...edges.values()]
    .filter(({ normals }) => !(normals.length === 2 && normals[0] === normals[1]))
    .map(({ a, b }) => [a, b]);
}
