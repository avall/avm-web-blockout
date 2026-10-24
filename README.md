# Blockout 3D

Browser remake of the classic 3D falling-block puzzle (BlockOut). Static site, no backend:
scores are never stored; only settings (setup, key bindings, graphics options) live in `localStorage`.

## Stack

- TypeScript + Vite, Three.js (WebGL) for the pit
- Pure game rules in `src/domain` (no DOM), rendering in `src/render`, page wiring in `src/ui` and `src/main.ts`
- Vitest (unit) and Playwright (end-to-end)

## Scripts

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests
npm run test:e2e   # builds, serves on :4173 and runs Playwright
npm run build      # static build in dist/
```

## Controls

| Key | Action |
| --- | --- |
| Arrows | Move |
| Q / A | Rotate around X (+/-) |
| W / S | Rotate around Y (+/-) |
| E / D | Rotate around Z (+/-) |
| Space | Drop |
| P / Esc | Pause |

Rotation keys can be rebound, with QWERTY and AZERTY presets. Phones and tablets get on-screen controls.

## Beginner aids

- The lowest layer of the falling piece is outlined in amber and its underside is filled.
- On levels 0–2 a blinking "Hole below!" icon appears while dropping the piece would leave an
  empty cell under the lowest cube of any of its columns. It disappears as soon as a move or rotation fixes it.

## Deploy to GitHub Pages

1. Push to `main`.
2. In the repository settings, set **Pages → Source** to **GitHub Actions**.
3. `.github/workflows/deploy.yml` runs the unit tests, builds and publishes `dist/`.

The Vite `base` is relative (`./`), so the site works under any `https://<user>.github.io/<repo>/` path.
