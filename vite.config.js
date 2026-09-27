import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so `dist/` can be hosted from any subpath (e.g. GitHub Pages).
  base: './',
  server: { port: 5174, strictPort: true },
});
