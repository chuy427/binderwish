import { writeFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Unique per build. Used to fetch fresh catalog data after each deploy and to
// let open pages notice a newer deploy (see src/lib/freshness.js).
const BUILD_ID = String(Date.now());

export default defineConfig({
  plugins: [
    react(),
    {
      // dist/version.json — what's currently deployed.
      name: 'binderwish-version-file',
      apply: 'build',
      closeBundle() { writeFileSync('dist/version.json', JSON.stringify({ build: BUILD_ID })); },
    },
  ],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  // Absolute base path so deep links like /binderwish/search load assets correctly.
  // GitHub Pages project site: /binderwish/. Set BASE_PATH=/ when serving from the
  // root of a custom domain.
  base: process.env.BASE_PATH || '/binderwish/',
  server: { port: 5174, strictPort: true },
});
