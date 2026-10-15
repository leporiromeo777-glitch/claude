import { defineConfig } from 'vite';

// Server della vetrina (npm run dev): serve vetrina/index.html.
export default defineConfig({
  root: 'vetrina',
  server: { host: '127.0.0.1', port: 5181 },
});
