import type { Axis, Cell, Direction } from './geometry';
import { bounds, rotateCells, translate } from './geometry';
import { landing, predictedHoles } from './holes';
import type { BlockSet, PieceShape } from './pieces';
import { shapesFor } from './pieces';
import { Pit } from './pit';

export interface GameConfig {
  width: number;
  height: number;
  depth: number;
  blockSet: BlockSet;
  startLevel: number;
  random?: () => number;
}

export type GameStatus = 'playing' | 'paused' | 'over';

export type GameEvent =
  | { type: 'spawn' }
  | { type: 'move' }
  | { type: 'rotate'; axis: Axis; dir: Direction }
  | { type: 'lock'; cubes: number; points: number }
  | { type: 'clear'; layers: number; points: number }
  | { type: 'levelUp'; level: number }
  | { type: 'gameOver' };

export interface FallingPiece {
  readonly shape: PieceShape;
  readonly cells: readonly Cell[];
}

export const MAX_LEVEL = 10;
export const LAYERS_PER_LEVEL = 3;
export const HOLE_WARNING_MAX_LEVEL = 2;
const KICKS: Cell[] = [
  [0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
  [2, 0, 0], [-2, 0, 0], [0, 2, 0], [0, -2, 0], [0, 0, -1], [0, 0, -2],
];

/** Milliseconds a piece needs to fall one layer, as in the original (5.51 s at level 0, x0.64 per level). */
export const fallInterval = (level: number): number => 5510 * 0.64 ** Math.min(level, MAX_LEVEL);

/** Pure Blockout rules: no rendering, no timers of its own; the caller feeds elapsed time. */
export class Game {
  readonly pit: Pit;
  readonly shapes: PieceShape[];
  status: GameStatus = 'playing';
  piece: FallingPiece | null = null;
  level: number;
  score = 0;
  lastGain = 0;
  cubesPlayed = 0;
  layersCleared = 0;
  private fallClock = 0;
  private readonly random: () => number;
  private readonly listeners: ((e: GameEvent) => void)[] = [];

  constructor(readonly config: GameConfig) {
    this.pit = new Pit(config.width, config.height, config.depth);
    this.shapes = shapesFor(config.blockSet, config.width, config.height);
    this.level = Math.min(config.startLevel, MAX_LEVEL);
    this.random = config.random ?? Math.random;
  }

  onEvent(listener: (e: GameEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(e: GameEvent): void {
    this.listeners.forEach((l) => l(e));
  }

  start(): void {
    this.spawn();
  }

  /** Places a shape in the (0, 0) corner of the top layer, as the original does; ends the game when it does not fit. */
  spawn(shape: PieceShape = this.shapes[Math.floor(this.random() * this.shapes.length)]): void {
    const { min, max } = bounds(shape.cells);
    const offset: Cell = [
      -min[0],
      -min[1],
      this.pit.depth - 1 - max[2],
    ];
    const cells = translate(shape.cells, offset);
    this.fallClock = 0;
    if (!this.pit.fits(cells)) {
      this.piece = null;
      this.status = 'over';
      this.emit({ type: 'gameOver' });
      return;
    }
    this.piece = { shape, cells };
    this.emit({ type: 'spawn' });
  }

  private tryPlace(cells: Cell[]): boolean {
    if (!this.piece || this.status !== 'playing' || !this.pit.fits(cells)) return false;
    this.piece = { ...this.piece, cells };
    return true;
  }

  move(dx: number, dy: number): boolean {
    if (!this.piece) return false;
    const moved = this.tryPlace(translate(this.piece.cells, [dx, dy, 0]));
    if (moved) this.emit({ type: 'move' });
    return moved;
  }

  rotate(axis: Axis, dir: Direction): boolean {
    if (!this.piece || this.status !== 'playing') return false;
    const rotated = rotateCells(this.piece.cells, axis, dir);
    const rotatedOk = KICKS.some((kick) => this.tryPlace(translate(rotated, kick)));
    if (rotatedOk) this.emit({ type: 'rotate', axis, dir });
    return rotatedOk;
  }

  /** Drops the piece to the bottom and locks it immediately. */
  drop(): void {
    if (!this.piece || this.status !== 'playing') return;
    const fallen = this.piece.cells[0][2] - landing(this.pit, this.piece.cells)[0][2];
    this.piece = { ...this.piece, cells: landing(this.pit, this.piece.cells) };
    this.lock(fallen);
  }

  /** Advances gravity by elapsed milliseconds. */
  update(elapsedMs: number): void {
    if (!this.piece || this.status !== 'playing') return;
    this.fallClock += elapsedMs;
    while (this.piece && this.status === 'playing' && this.fallClock >= fallInterval(this.level)) {
      this.fallClock -= fallInterval(this.level);
      if (!this.tryPlace(translate(this.piece.cells, [0, 0, -1]))) this.lock(0);
    }
  }

  togglePause(): void {
    if (this.status === 'over') return;
    this.status = this.status === 'paused' ? 'playing' : 'paused';
  }

  private lock(droppedLayers: number): void {
    if (!this.piece) return;
    const cubes = this.piece.cells.length;
    this.pit.fill(this.piece.cells);
    this.cubesPlayed += cubes;
    const lockPoints = (cubes + droppedLayers) * (this.level + 1);
    this.lastGain = lockPoints;
    this.score += lockPoints;
    this.emit({ type: 'lock', cubes, points: lockPoints });

    const layers = this.pit.clearFullLayers();
    if (layers > 0) {
      const area = this.pit.width * this.pit.height;
      let clearPoints = layers * layers * area * 10 * (this.level + 1);
      if (this.pit.isEmpty()) clearPoints += 50 * area * (this.level + 1);
      this.score += clearPoints;
      this.lastGain += clearPoints;
      this.emit({ type: 'clear', layers, points: clearPoints });
      const before = Math.floor(this.layersCleared / LAYERS_PER_LEVEL);
      this.layersCleared += layers;
      const gained = Math.floor(this.layersCleared / LAYERS_PER_LEVEL) - before;
      if (gained > 0 && this.level < MAX_LEVEL) {
        this.level = Math.min(MAX_LEVEL, this.level + gained);
        this.emit({ type: 'levelUp', level: this.level });
      }
    }
    this.spawn();
  }

  /** Holes the current piece would leave if dropped now; only reported on beginner levels. */
  holeWarning(): Cell[] {
    if (!this.piece || this.level > HOLE_WARNING_MAX_LEVEL) return [];
    return predictedHoles(this.pit, this.piece.cells);
  }

  landingCells(): Cell[] {
    return this.piece ? landing(this.pit, this.piece.cells) : [];
  }
}
