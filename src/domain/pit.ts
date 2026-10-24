import type { Cell } from './geometry';

/** Occupancy grid of the pit; z = 0 is the floor, z = depth - 1 the top layer. */
export class Pit {
  private readonly cells: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly depth: number,
  ) {
    this.cells = new Uint8Array(width * height * depth);
  }

  private index(x: number, y: number, z: number): number {
    return (z * this.height + y) * this.width + x;
  }

  inside([x, y, z]: Cell): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.width && y < this.height && z < this.depth;
  }

  occupied(cell: Cell): boolean {
    return this.inside(cell) && this.cells[this.index(...cell)] === 1;
  }

  /** True when every cell is inside the pit and empty. */
  fits(cells: readonly Cell[]): boolean {
    return cells.every((c) => this.inside(c) && !this.occupied(c));
  }

  fill(cells: readonly Cell[]): void {
    for (const c of cells) this.cells[this.index(...c)] = 1;
  }

  layerCount(z: number): number {
    let count = 0;
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) count += this.cells[this.index(x, y, z)];
    return count;
  }

  /** Removes full layers, shifting the ones above down. Returns the number of cleared layers. */
  clearFullLayers(): number {
    const area = this.width * this.height;
    let cleared = 0;
    for (let z = 0; z < this.depth; ) {
      if (this.layerCount(z) === area) {
        this.cells.copyWithin(z * area, (z + 1) * area);
        this.cells.fill(0, (this.depth - 1) * area);
        cleared++;
      } else {
        z++;
      }
    }
    return cleared;
  }

  isEmpty(): boolean {
    return this.cells.every((v) => v === 0);
  }

  /** Highest occupied layer + 1 (0 when the pit is empty). */
  stackHeight(): number {
    for (let z = this.depth - 1; z >= 0; z--) if (this.layerCount(z) > 0) return z + 1;
    return 0;
  }

  occupiedCells(): Cell[] {
    const out: Cell[] = [];
    for (let z = 0; z < this.depth; z++)
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++) if (this.cells[this.index(x, y, z)]) out.push([x, y, z]);
    return out;
  }
}
