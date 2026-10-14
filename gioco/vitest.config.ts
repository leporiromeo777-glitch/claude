import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Test unitari (ARCHITETTURA 15.2): ogni pacchetto in tests/unit/<pacchetto>/.
// L'ambiente predefinito è Node; un file che ha bisogno del DOM lo chiede con
// il commento `// @vitest-environment happy-dom` in testa.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
      testTimeout: 20000,
      hookTimeout: 20000,
      restoreMocks: true,
    },
  }),
);
