import { defineConfig } from 'vite';

// Configurazione della pagina demo del modulo audio.
export default defineConfig({
  root: 'demo',
  base: './',
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 5178 },
});
