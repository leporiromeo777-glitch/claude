import { defineConfig } from 'vite';

// Pagina demo del modulo UI: `npm run dev` apre index.html, che monta tutti i componenti
// sopra un canvas d'esempio. `?c=<componente>` mostra un solo componente (usato dalle schermate).
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5181, strictPort: true },
  preview: { host: '127.0.0.1', port: 4181, strictPort: true },
  build: { target: 'es2022' },
});
