import type { Game } from '../domain/game';
import { layerColor } from '../render/pitRenderer';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const fmt = (n: number) => n.toLocaleString('en-US').replace(/,/g, ' ');
const SET_NAMES = { flat: 'Flat', basic: 'Basic', extended: 'Extended' } as const;

/** Blockout-style side panels: level, pit gauge, score and stats. */
export class Hud {
  private last = '';

  setPit(depth: number): void {
    const gauge = $('[data-hud="gauge"]');
    gauge.replaceChildren(
      ...Array.from({ length: depth }, () => Object.assign(document.createElement('div'), { className: 'gauge-slot' })),
    );
    this.last = '';
  }

  update(game: Game, highScore: number): void {
    const { width, height, depth, blockSet } = game.config;
    const stack = game.pit.stackHeight();
    const snapshot = [game.level, game.score, game.lastGain, game.cubesPlayed, highScore, stack, width, height, depth, blockSet].join('|');
    if (snapshot === this.last) return;
    this.last = snapshot;
    $('[data-hud="level"]').textContent = String(game.level);
    $('[data-hud="score"]').textContent = fmt(game.score);
    $('[data-hud="gain"]').textContent = game.lastGain ? `+${fmt(game.lastGain)}` : '';
    $('[data-hud="cubes"]').textContent = fmt(game.cubesPlayed);
    $('[data-hud="high"]').textContent = fmt(highScore);
    $('[data-hud="pit"]').textContent = `${width}x${height}x${depth}`;
    $('[data-hud="set"]').textContent = SET_NAMES[blockSet];
    document.querySelectorAll<HTMLElement>('.gauge-slot').forEach((slot, z) => {
      const filled = z < stack;
      slot.classList.toggle('filled', filled);
      slot.style.background = filled ? layerColor(z) : '';
    });
  }
}
