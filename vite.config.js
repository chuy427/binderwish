import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Unique per build. Used to fetch fresh catalog data after each deploy and to
// let open pages notice a newer deploy (see src/lib/freshness.js).
const BUILD_ID = String(Date.now());
const BASE = process.env.BASE_PATH || '/';
let outDir = 'dist'; // resolved build.outDir (the Cloudflare build uses its own)

export default defineConfig({
  plugins: [
    react(),
    {
      // dist/version.json — what's currently deployed.
      name: 'binderwish-version-file',
      apply: 'build',
      configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
      closeBundle() { writeFileSync(path.join(outDir, 'version.json'), JSON.stringify({ build: BUILD_ID })); },
    },
    {
      // dist/sw.js — the offline service worker (scripts/sw-template.js), with this
      // build's app files to precache: JS, CSS, Latin fonts, icons, the page itself.
      name: 'binderwish-service-worker',
      apply: 'build',
      writeBundle(options, bundle) {
        const files = Object.keys(bundle).filter((f) => /\.(js|css)$/.test(f)
          || (/\.woff2$/.test(f) && /-latin-(?!ext)/.test(f)));
        const precache = ['', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'apple-touch-icon.png', ...files]
          .map((f) => `${BASE}${f}`);
        const sw = readFileSync('scripts/sw-template.js', 'utf8')
          .replace("const BUILD = '__BUILD__';", `const BUILD = ${JSON.stringify(BUILD_ID)};`)
          .replace("const BASE = '__BASE__';", `const BASE = ${JSON.stringify(BASE)};`)
          .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify(precache)};`);
        if (sw.includes("'__") || sw.includes('= __')) throw new Error('sw-template.js placeholders not filled');
        writeFileSync(path.join(outDir, 'sw.js'), sw);
      },
    },
  ],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  // Absolute base path so deep links like /sets/me05 load assets correctly. The
  // site is served from the root of binderwish.com; set BASE_PATH to serve it
  // from a sub-path instead.
  base: BASE,
  server: { port: 5174, strictPort: true },
});
