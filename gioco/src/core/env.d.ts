/// <reference types="vite/client" />

// Costanti iniettate da vite.config.ts (define).
declare const __GAME_VERSION__: string;
declare const __ASSET_MANIFEST__: boolean;

interface ImportMetaEnv {
  /** '1' nelle build di test end-to-end: API di debug sempre attiva. */
  readonly VITE_E2E?: string;
}
