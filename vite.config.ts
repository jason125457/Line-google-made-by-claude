/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tests assert Taiwan-local month boundaries (AGENTS.md gotcha 1); workers inherit this.
process.env.TZ = 'Asia/Taipei';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false
  },
  // No manualChunks: naming recharts there also pulled React into that chunk, which made the
  // entry preload all ~590 KB. Left alone, Rollup puts the chart code in a chunk that only the
  // lazy-loaded chart components import (see App.tsx).
  test: {
    environment: 'node'
  }
});
