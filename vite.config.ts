/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Relative base so the build works under any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 800 },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
