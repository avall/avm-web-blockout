import './styles.css';
import type { Action, Settings } from './app/settings';
import { ROTATIONS, actionFor, loadSettings, saveSettings } from './app/settings';
import { Sound } from './app/sound';
import { Game } from './domain/game';
import type { Cell } from './domain/geometry';
import type { PieceHint } from './render/pitRenderer';
import { PitRenderer } from './render/pitRenderer';
import { Hud } from './ui/hud';
import { Panels } from './ui/panels';

const params = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>('#pit')!;
const frame = document.querySelector<HTMLElement>('#game-frame')!;
const pitWrap = document.querySelector<HTMLElement>('.pit-wrap')!;
const overlay = document.querySelector<HTMLElement>('.overlay')!;
const holeAlert = document.querySelector<HTMLElement>('[data-testid="hole-alert"]')!;

let settings: Settings = loadSettings();
const renderer = new PitRenderer(canvas);
const hud = new Hud();
const sound = new Sound();
// High scores are session-only on purpose: nothing is persisted or sent anywhere.
const highScores = new Map<string, number>();
let game: Game | null = null;
let lastPiece: Game['piece'] = null;
let pendingHint: PieceHint = { type: 'none' };
let stackDirty = true;

/** Deterministic PRNG (mulberry32) so tests can pass ?seed=. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const setupKey = () => {
  const { width, height, depth, blockSet } = settings.setup;
  return `${width}x${height}x${depth}-${blockSet}`;
};

function applySettings(next: Settings): void {
  settings = next;
  saveSettings(settings);
  sound.enabled = settings.sound;
  renderer.setStyle(settings);
  stackDirty = true;
  const { width, height, depth, blockSet } = settings.setup;
  document.querySelector('[data-chip="pit"]')!.textContent = `Pit ${width}×${height}×${depth}`;
  document.querySelector('[data-chip="set"]')!.textContent = `${blockSet[0].toUpperCase()}${blockSet.slice(1)} set`;
  if (!game || game.status === 'over') showPit(width, height, depth);
}

function showPit(width: number, height: number, depth: number): void {
  pitWrap.style.setProperty('--pit-aspect', String(width / height));
  frame.style.setProperty('--pit-aspect', String(width / height));
  renderer.configure(width, height, depth);
  hud.setPit(depth);
}

function showOverlay(title: string, sub: string): void {
  overlay.hidden = false;
  overlay.querySelector('.overlay-title')!.textContent = title;
  overlay.querySelector('.overlay-sub')!.textContent = sub;
}

function startGame(): void {
  const seed = Number(params.get('seed'));
  const { setup } = settings;
  game = new Game({ ...setup, random: Number.isFinite(seed) && params.has('seed') ? seeded(seed) : Math.random });
  showPit(setup.width, setup.height, setup.depth);
  game.onEvent((e) => {
    if (e.type === 'rotate') sound.rotate();
    if (e.type === 'lock') {
      sound.lock();
      stackDirty = true;
    }
    if (e.type === 'clear') sound.clear(e.layers);
    if (e.type === 'levelUp') sound.levelUp();
    if (e.type === 'gameOver') {
      sound.gameOver();
      showOverlay('Game over', `Score ${game!.score} · press Enter or tap to play again`);
    }
  });
  lastPiece = null;
  stackDirty = true;
  overlay.hidden = true;
  game.start();
  canvas.focus({ preventScroll: true });
}

function togglePause(): void {
  if (!game || game.status === 'over') return;
  game.togglePause();
  if (game.status === 'paused') showOverlay('Paused', 'Press P, Esc or tap to resume');
  else overlay.hidden = true;
}

function perform(action: Action): void {
  if (!game) return;
  if (action === 'pause') return togglePause();
  if (game.status !== 'playing') return;
  if (action === 'drop') return game.drop();
  if (action in ROTATIONS) {
    const { axis, dir } = ROTATIONS[action as keyof typeof ROTATIONS];
    if (game.rotate(axis, dir)) pendingHint = { type: 'rotate', axis, dir };
    return;
  }
  const delta: Record<string, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] };
  const [dx, dy] = delta[action];
  if (game.move(dx, dy)) pendingHint = { type: 'shift', delta: [-dx, -dy, 0] };
}

function sameShift(prev: readonly Cell[], next: readonly Cell[]): boolean {
  return prev.length === next.length && prev.every((c, i) => c[0] === next[i][0] && c[1] === next[i][1] && c[2] === next[i][2] + 1);
}

function syncScene(): void {
  if (!game) return;
  if (stackDirty) {
    renderer.setStack(game.pit.occupiedCells());
    stackDirty = false;
  }
  if (game.piece !== lastPiece) {
    let hint = pendingHint;
    if (hint.type === 'none' && lastPiece && game.piece && lastPiece.shape === game.piece.shape && sameShift(lastPiece.cells, game.piece.cells)) {
      hint = { type: 'shift', delta: [0, 0, 1] };
    }
    renderer.setPiece(game.piece?.cells ?? null, hint);
    lastPiece = game.piece;
  }
  pendingHint = { type: 'none' };
  const high = Math.max(highScores.get(setupKey()) ?? 0, game.score);
  highScores.set(setupKey(), high);
  hud.update(game, high);
  holeAlert.hidden = !(game.status === 'playing' && game.holeWarning().length > 0);
}

let previous = performance.now();
function frameLoop(now: number): void {
  const elapsed = Math.min(now - previous, 250);
  previous = now;
  game?.update(elapsed);
  syncScene();
  renderer.render(now);
  requestAnimationFrame(frameLoop);
}

// Input
window.addEventListener('keydown', (e) => {
  if (panels.captureKey(e.key)) {
    e.preventDefault();
    return;
  }
  const target = e.target as HTMLElement;
  if (target.closest('input, select, textarea')) return;
  if (e.key === 'Enter' && (!game || game.status === 'over')) {
    e.preventDefault();
    startGame();
    return;
  }
  if (!game || game.status === 'over') return;
  const action = e.key === 'Escape' ? 'pause' : actionFor(e.key, settings.keys);
  if (!action) return;
  e.preventDefault();
  if (e.repeat && (action === 'drop' || action === 'pause')) return;
  perform(action);
});

overlay.addEventListener('click', () => {
  if (game?.status === 'paused') togglePause();
  else startGame();
});

document.querySelectorAll<HTMLElement>('[data-action="start"]').forEach((el) =>
  el.addEventListener('click', () => {
    startGame();
    frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }),
);

document.querySelectorAll<HTMLElement>('[data-action="fullscreen"]').forEach((el) =>
  el.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.querySelector<HTMLElement>('.tool-preview')!.requestFullscreen?.().catch(() => undefined);
  }),
);

document.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach((btn) =>
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!game || game.status === 'over') return startGame();
    perform(btn.dataset.touch as Action);
  }),
);

// Redraw in the same frame as the resize so the pit never shows a stretched image while dragging the window.
new ResizeObserver(() => {
  renderer.resize();
  renderer.render();
}).observe(pitWrap);
canvas.tabIndex = 0;

const panels = new Panels(settings, applySettings);
applySettings(settings);
requestAnimationFrame(frameLoop);

// Test hook, only exposed with ?test=1.
if (params.has('test')) {
  Object.assign(window, {
    __blockout: {
      state: () =>
        game && {
          status: game.status,
          level: game.level,
          score: game.score,
          piece: game.piece?.cells ?? null,
          holes: game.holeWarning(),
        },
      spawn: (cells: Cell[]) => game?.spawn({ id: 'TEST', cells }),
    },
  });
}
