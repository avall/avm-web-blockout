import { expect, test, type Page } from '@playwright/test';

type Cell = [number, number, number];
interface State {
  status: string;
  level: number;
  score: number;
  piece: Cell[] | null;
  holes: Cell[];
}

// Upside-down L standing on the x/z plane: its foot leaves an empty cell under it.
const OVERHANG: Cell[] = [[0, 0, 0], [0, 0, 1], [0, 0, 2], [1, 0, 2]];

const state = (page: Page) => page.evaluate(() => (window as unknown as { __blockout: { state(): State } }).__blockout.state());
const spawn = (page: Page, cells: Cell[]) =>
  page.evaluate((c) => (window as unknown as { __blockout: { spawn(c: Cell[]): void } }).__blockout.spawn(c), cells);

async function startGame(page: Page) {
  await page.locator('.overlay').click();
  await expect(page.locator('.overlay')).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?test=1&seed=7');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('renders the page chrome with the mermaid.jandrinet.cloud look and no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.reload();
  await expect(page.locator('h1')).toHaveCSS('font-family', /Space Grotesk/);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(7, 9, 13)');
  await expect(page.locator('.btn-primary').first()).toHaveCSS('background-color', 'rgb(45, 212, 191)');
  await expect(page.locator('canvas#pit')).toBeVisible();
  expect(errors).toEqual([]);
});

test('arrows move and Q/W/E rotate the falling piece', async ({ page }) => {
  await startGame(page);
  await spawn(page, [[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
  expect((await state(page)).piece).toEqual([[0, 0, 11], [1, 0, 11], [2, 0, 11]]);
  await page.keyboard.press('ArrowLeft');
  expect((await state(page)).piece).toContainEqual([0, 0, 11]); // already against the wall
  await page.keyboard.press('ArrowRight');
  expect((await state(page)).piece).toContainEqual([3, 0, 11]);
  await page.keyboard.press('ArrowUp');
  expect((await state(page)).piece).toContainEqual([3, 1, 11]);
  const before = (await state(page)).piece;
  await page.keyboard.press('e');
  const after = (await state(page)).piece!;
  expect(after).not.toEqual(before);
  expect(new Set(after.map((c) => c[0])).size).toBe(1); // now aligned with the y axis
});

test('space drops the piece and scores', async ({ page }) => {
  await startGame(page);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).score).toBeGreaterThan(0);
  await expect(page.locator('[data-hud="cubes"]')).not.toHaveText('0');
});

test('hole warning blinks on level 0 and disappears after rotating away the gap', async ({ page }) => {
  await startGame(page);
  await spawn(page, OVERHANG);
  const alert = page.getByTestId('hole-alert');
  await expect(alert).toBeVisible();
  await expect(alert).toHaveCSS('animation-name', 'blink');
  await page.keyboard.press('w');
  await page.keyboard.press('w');
  await expect(alert).toBeHidden();
  expect((await state(page)).holes).toEqual([]);
});

test('hole warning stays off from level 3 upwards', async ({ page }) => {
  const plus = page.locator('.stepper[data-field="startLevel"] button[data-step="1"]');
  for (let i = 0; i < 3; i++) await plus.click();
  await startGame(page);
  expect((await state(page)).level).toBe(3);
  await spawn(page, OVERHANG);
  await page.waitForTimeout(100);
  await expect(page.getByTestId('hole-alert')).toBeHidden();
});

test('rotation keys can be rebound and switched to AZERTY', async ({ page }) => {
  await page.locator('.key-btn[data-key="rotXp"]').click();
  await page.keyboard.press('k');
  await expect(page.locator('.key-btn[data-key="rotXp"] kbd')).toHaveText('K');
  await startGame(page);
  await spawn(page, [[0, 0, 0], [0, 1, 0]]);
  const before = (await state(page)).piece;
  await page.keyboard.press('k');
  expect((await state(page)).piece).not.toEqual(before);

  await page.locator('[data-preset-keys="azerty"]').click();
  await expect(page.locator('.key-btn[data-key="rotYp"] kbd')).toHaveText('Z');
  await page.reload();
  await expect(page.locator('.key-btn[data-key="rotYp"] kbd')).toHaveText('Z');
});

test('P pauses and resumes the game', async ({ page }) => {
  await startGame(page);
  await page.keyboard.press('p');
  await expect(page.locator('.overlay-title')).toHaveText('Paused');
  expect((await state(page)).status).toBe('paused');
  await page.keyboard.press('p');
  await expect(page.locator('.overlay')).toBeHidden();
});

test('presets change the pit and the HUD', async ({ page }) => {
  await page.locator('[data-preset="3d-mania"]').click();
  await startGame(page);
  await expect(page.locator('[data-hud="pit"]')).toHaveText('3x3x10');
  await expect(page.locator('[data-hud="set"]')).toHaveText('Basic');
});

test('game over shows the final overlay', async ({ page }) => {
  await page.locator('[data-preset="3d-mania"]').click();
  for (let i = 0; i < 4; i++) await page.locator('.stepper[data-field="depth"] button[data-step="-1"]').click();
  await startGame(page);
  for (let i = 0; i < 20; i++) await page.keyboard.press('Space');
  await expect(page.locator('.overlay-title')).toHaveText('Game over');
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('fits the screen and plays with touch controls', async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.locator('.touch-controls')).toBeVisible();
    await page.locator('[data-touch="drop"]').tap();
    await expect.poll(async () => (await state(page))?.status).toBe('playing');
    await spawn(page, [[0, 0, 0], [1, 0, 0]]);
    expect((await state(page)).piece).toEqual([[0, 0, 11], [1, 0, 11]]);
    await page.locator('[data-touch="right"]').tap();
    expect((await state(page)).piece).toEqual([[1, 0, 11], [2, 0, 11]]);
  });
});

test.describe('large screens', () => {
  for (const [w, h] of [[1366, 768], [1920, 1080], [2560, 1440]]) {
    test(`pit scales up at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      const box = (await page.locator('.pit-wrap').boundingBox())!;
      expect(box.height).toBeGreaterThan(h * 0.5);
      expect(box.height).toBeLessThanOrEqual(h);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
    });
  }
});

test('adapts live while the window is resized, without reloading', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await startGame(page);
  for (let w = 1920; w >= 360; w -= 40) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.evaluate(() => new Promise(requestAnimationFrame)); // measure what the next painted frame shows
    const r = await page.evaluate((vw) => {
      const frame = document.querySelector('#game-frame')!.getBoundingClientRect();
      const outside = [...document.querySelectorAll('.tool *')].filter((e) => {
        const b = e.getBoundingClientRect();
        const leavesFrame = e.closest('#game-frame') && (b.right > frame.right + 0.5 || b.left < frame.left - 0.5);
        return b.width > 0 && (b.right > vw + 0.5 || leavesFrame);
      });
      const canvas = document.querySelector<HTMLCanvasElement>('#pit')!;
      return {
        scrollWidth: document.documentElement.scrollWidth,
        outside: outside.map((e) => e.className),
        pit: canvas.clientWidth,
        buffer: canvas.width / devicePixelRatio,
      };
    }, w);
    expect(r.scrollWidth, `width ${w}`).toBeLessThanOrEqual(w);
    expect(r.outside, `width ${w}`).toEqual([]);
    expect(r.pit, `width ${w}`).toBeGreaterThan(Math.min(w, 900) * 0.4);
    expect(Math.abs(r.buffer - r.pit), `canvas follows its box at ${w}`).toBeLessThanOrEqual(2);
  }
});
