import { describe, expect, it } from 'vitest';
import type { Cell } from '../../src/domain/geometry';
import { cellKey } from '../../src/domain/geometry';
import { Game, fallInterval } from '../../src/domain/game';
import { predictedHoles } from '../../src/domain/holes';
import { shapesFor } from '../../src/domain/pieces';
import { Pit } from '../../src/domain/pit';

const shape = (id: string) => shapesFor('extended', 7, 7).find((s) => s.id === id)!;
const newGame = (startLevel = 0, size = 5) =>
  new Game({ width: size, height: size, depth: 10, blockSet: 'basic', startLevel, random: () => 0 });
const keys = (cells: readonly Cell[]) => cells.map(cellKey).sort();

describe('Pit', () => {
  it('clears full layers and shifts the stack down', () => {
    const pit = new Pit(2, 2, 4);
    pit.fill([[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1]]);
    expect(pit.clearFullLayers()).toBe(1);
    expect(keys(pit.occupiedCells())).toEqual(['0,0,0']);
  });

  it('clears several non-adjacent full layers', () => {
    const pit = new Pit(1, 1, 4);
    pit.fill([[0, 0, 0], [0, 0, 1], [0, 0, 3]]);
    expect(pit.clearFullLayers()).toBe(3);
    expect(pit.isEmpty()).toBe(true);
  });
});

describe('shapesFor', () => {
  it('drops shapes that cannot fit a narrow pit', () => {
    expect(shapesFor('flat', 2, 2).map((s) => s.id)).toEqual(['1-cube', 'Domino', 'L3', 'O']);
  });

  it.each([
    ['flat', 8, ['1-cube', 'Domino', 'I3', 'L3', 'O', 'T', 'S', 'L4']],
    ['basic', 7, ['L3', 'T', 'S', 'L4', '3D-T1', '3D-T2', '3D-T3']],
  ] as const)('%s set matches the original %i pieces', (set, count, ids) => {
    expect(shapesFor(set, 7, 7).map((s) => s.id)).toEqual(ids);
    expect(ids).toHaveLength(count);
  });

  it('extended set offers all 41 pieces in a 5x5 pit and drops I5 in 3x3', () => {
    expect(shapesFor('extended', 5, 5)).toHaveLength(41);
    expect(shapesFor('extended', 3, 3).map((s) => s.id)).not.toContain('I5');
  });
});

describe('Game', () => {
  it('spawns the piece in the corner of the top layer', () => {
    const game = newGame();
    game.spawn(shape('I3'));
    expect(keys(game.piece!.cells)).toEqual(['0,0,9', '0,1,9', '0,2,9']);
  });

  it('blocks moves through the walls', () => {
    const game = newGame();
    game.spawn(shape('I3'));
    expect(game.move(-1, 0)).toBe(false);
    expect(game.move(0, -1)).toBe(false);
    expect(game.move(1, 0)).toBe(true);
  });

  it('falls one layer per interval and locks on the floor', () => {
    const game = newGame();
    game.spawn(shape('Domino'));
    game.update(fallInterval(0));
    expect(game.piece!.cells[0][2]).toBe(8);
    game.drop();
    expect(game.cubesPlayed).toBe(2);
    expect(game.pit.occupied([0, 0, 0])).toBe(true);
  });

  it('scores a cleared layer and levels up after enough layers', () => {
    const game = new Game({ width: 2, height: 2, depth: 6, blockSet: 'flat', startLevel: 0, random: () => 0 });
    for (let i = 0; i < 3; i++) {
      game.spawn(shape('O'));
      game.drop();
    }
    expect(game.layersCleared).toBe(3);
    expect(game.level).toBe(1);
    expect(game.pit.isEmpty()).toBe(true);
    expect(game.score).toBeGreaterThanOrEqual(3 * (40 + 200)); // layer bonus + empty-pit bonus
  });

  it('ends the game when a new piece does not fit', () => {
    const game = new Game({ width: 3, height: 3, depth: 6, blockSet: 'flat', startLevel: 0, random: () => 0 });
    game.pit.fill([[0, 1, 5]]);
    game.spawn(shape('I3'));
    expect(game.status).toBe('over');
  });

  it('ignores input while paused', () => {
    const game = newGame();
    game.spawn(shape('Domino'));
    game.togglePause();
    expect(game.move(1, 0)).toBe(false);
    game.update(10_000);
    expect(game.piece!.cells[0][2]).toBe(9);
  });
});

describe('hole prediction', () => {
  it('flags the empty cell under an overhang', () => {
    const pit = new Pit(5, 5, 10);
    // L standing in the xz plane with its foot up: x = 1 column bottom sits at z = 2.
    const piece: Cell[] = [[0, 0, 7], [0, 0, 8], [0, 0, 9], [1, 0, 9]];
    expect(keys(predictedHoles(pit, piece))).toEqual(['1,0,1']);
  });

  it('reports nothing for a flat piece on the floor', () => {
    expect(predictedHoles(new Pit(5, 5, 10), [[0, 0, 9], [1, 0, 9], [2, 0, 9]])).toEqual([]);
  });

  it('detects a gap left in the existing stack', () => {
    const pit = new Pit(3, 3, 6);
    pit.fill([[0, 0, 0]]);
    expect(keys(predictedHoles(pit, [[0, 0, 5], [1, 0, 5]]))).toEqual(['1,0,0']);
  });

  it.each([
    [0, 1],
    [2, 1],
    [3, 0],
  ])('at level %i warns about %i hole(s)', (level, count) => {
    const game = newGame(level);
    game.spawn({ id: 'TEST', cells: [[0, 0, 0], [0, 0, 1], [0, 0, 2], [1, 0, 2]] });
    expect(game.holeWarning()).toHaveLength(count);
  });

  it('warning disappears after rotating into a safe orientation', () => {
    const game = newGame(0);
    game.spawn({ id: 'TEST', cells: [[0, 0, 0], [0, 0, 1], [0, 0, 2], [1, 0, 2]] });
    expect(game.holeWarning()).not.toHaveLength(0);
    game.rotate('y', 1);
    game.rotate('y', 1);
    expect(game.holeWarning()).toHaveLength(0);
  });
});

describe('fallInterval', () => {
  it.each([
    [0, 5510],
    [1, 3526.4],
    [5, 591.6],
    [10, 63.3],
    [15, 63.3],
  ])('level %i falls one layer every ~%f ms', (level, ms) => {
    expect(fallInterval(level)).toBeCloseTo(ms, 0);
  });
});
