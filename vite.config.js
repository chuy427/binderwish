import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Absolute base path so deep links like /binderwish/search load assets correctly.
  // GitHub Pages project site: /binderwish/. Set BASE_PATH=/ when serving from the
  // root of a custom domain.
  base: process.env.BASE_PATH || '/binderwish/',
  server: { port: 5174, strictPort: true },
});
