import type { Cell } from './geometry';
import { bounds } from './geometry';

export type BlockSet = 'flat' | 'basic' | 'extended';

export interface PieceShape {
  readonly id: string;
  readonly cells: readonly Cell[];
}

interface PieceDef extends PieceShape {
  readonly flat: boolean;
  readonly basic: boolean;
}

const def = (id: string, flat: boolean, basic: boolean, cells: Cell[]): PieceDef => ({ id, flat, basic, cells });

// Same 41 polycubes as BlockOut II (checked by playing blockout.nu); Extended uses all of them.
const PIECES: PieceDef[] = [
  def('1-cube', true, false, [[0, 0, 0]]),
  def('Domino', true, false, [[0, 0, 0], [0, 1, 0]]),
  def('I3', true, false, [[0, 0, 0], [0, 1, 0], [0, 2, 0]]),
  def('I4', false, false, [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0]]),
  def('I5', false, false, [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0], [0, 4, 0]]),
  def('L3', true, true, [[0, 0, 0], [1, 0, 0], [1, 1, 0]]),
  def('O', true, false, [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]]),
  def('T', true, true, [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0]]),
  def('S', true, true, [[1, 0, 0], [2, 0, 0], [0, 1, 0], [1, 1, 0]]),
  def('L4', true, true, [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0]]),
  def('#10', false, false, [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 2, 0]]),
  def('#11', false, false, [[2, 0, 0], [0, 1, 0], [1, 1, 0], [2, 1, 0], [2, 2, 0]]),
  def('#12', false, false, [[2, 0, 0], [0, 1, 0], [1, 1, 0], [2, 1, 0], [1, 2, 0]]),
  def('#13', false, false, [[1, 0, 0], [2, 0, 0], [1, 1, 0], [0, 2, 0], [1, 2, 0]]),
  def('#14', false, false, [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0], [2, 2, 0]]),
  def('#15', false, false, [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 2, 0], [1, 3, 0]]),
  def('#16', false, false, [[1, 0, 0], [0, 1, 0], [1, 1, 0], [1, 2, 0], [1, 3, 0]]),
  def('#17', false, false, [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 2, 0], [0, 2, 0]]),
  def('#18', false, false, [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [1, 2, 0]]),
  def('#19', false, false, [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0]]),
  def('X5', false, false, [[1, 0, 0], [0, 1, 0], [1, 1, 0], [2, 1, 0], [1, 2, 0]]),
  def('#21', false, false, [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [1, 2, 1]]),
  def('#22', false, false, [[1, 0, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [0, 2, 1]]),
  def('#23', false, false, [[0, 1, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1], [1, 2, 1]]),
  def('#24', false, false, [[1, 1, 0], [1, 0, 1], [1, 1, 1], [1, 2, 1], [0, 2, 1]]),
  def('#25', false, false, [[1, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [1, 2, 1]]),
  def('#26', false, false, [[1, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 2, 1]]),
  def('#27', false, false, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 2, 1]]),
  def('#28', false, false, [[1, 1, 0], [1, 2, 0], [0, 0, 1], [0, 1, 1], [1, 1, 1]]),
  def('#29', false, false, [[0, 1, 0], [0, 2, 0], [1, 0, 1], [1, 1, 1], [0, 1, 1]]),
  def('#30', false, false, [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 2, 1], [0, 2, 1]]),
  def('#31', false, false, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 2, 1], [1, 2, 1]]),
  def('3D-T1', false, true, [[1, 0, 0], [1, 0, 1], [0, 0, 1], [0, 1, 1]]),
  def('3D-T2', false, true, [[1, 0, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]]),
  def('3D-T3', false, true, [[1, 0, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1]]),
  def('#35', false, false, [[1, 1, 0], [0, 1, 1], [1, 1, 1], [1, 0, 1], [1, 2, 1]]),
  def('#36', false, false, [[1, 0, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]),
  def('#37', false, false, [[1, 0, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [1, 2, 1]]),
  def('#38', false, false, [[1, 0, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1], [1, 2, 1]]),
  def('#39', false, false, [[1, 1, 0], [1, 2, 0], [1, 0, 1], [1, 1, 1], [0, 1, 1]]),
  def('#40', false, false, [[0, 0, 0], [1, 1, 0], [0, 0, 1], [0, 1, 1], [1, 1, 1]]),
];

const SETS: Record<BlockSet, PieceDef[]> = {
  flat: PIECES.filter((p) => p.flat),
  basic: PIECES.filter((p) => p.basic),
  extended: PIECES,
};

const extent = ({ cells }: PieceShape): number => {
  const { min, max } = bounds(cells);
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) + 1;
};

/** Shapes of the set whose largest extent fits the pit floor (as the original does). */
export function shapesFor(set: BlockSet, width: number, height: number): PieceShape[] {
  return SETS[set].filter((p) => extent(p) <= Math.min(width, height));
}
