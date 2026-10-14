/**
 * Avvio del gioco (ARCHITETTURA 3.1).
 * 1. Font e fogli di stile del core.
 * 2-3. Servizi del core, salvataggio, testi, contenuti e manifest degli asset.
 * 4. Registrazione dei pacchetti: ogni `src/<pacchetto>/register.ts` (glob), caricato
 *    dopo che i servizi esistono; può esportare `register(services)` o lavorare al caricamento.
 * 5. Ciclo e prima scena: 'titolo' se registrata, altrimenti 'boot' (diagnostica).
 * 6. Splash nativo nascosto, storage persistente chiesto sul web; `__GAME__.ready` risolta.
 * 7. Sul web (non in sviluppo) il service worker che tiene il gioco in cache (SCH-08).
 */
import { fontsReady } from './core/fonts';
import './core/ui/theme.css';
import './core/ui/base.css';
import { GAME_VERSION, createDebug, registerPackages, showFatal, startCore, type CoreRuntime } from './core/bootstrap';
import { registerServiceWorker } from './core/sw';

const debug = createDebug();

async function main(): Promise<void> {
  let rt: CoreRuntime | null = null;
  try {
    rt = await startCore(debug);
    // I font locali si caricano mentre si registrano i pacchetti (niente salti di testo all'apertura).
    await Promise.all([registerPackages(rt, import.meta.glob('./*/register.ts')), fontsReady()]);
    rt.viewport.refresh();
    rt.loop.start();
    await rt.scenes.go(rt.scenes.has('titolo') ? 'titolo' : 'boot', undefined, { transition: 'none' });
    rt.platform.hideSplash();
    if (!rt.platform.native) {
      try {
        void navigator.storage?.persist?.().catch(() => false);
      } catch {
        /* storage persistente non disponibile */
      }
    }
    debug.resolveReady();
    void registerServiceWorker({
      dev: import.meta.env.DEV,
      native: rt.platform.native,
      version: GAME_VERSION,
      doc: document,
      nav: typeof navigator !== 'undefined' ? navigator : null,
      protocol: location.protocol,
    });
  } catch (err) {
    showFatal(err, rt?.i18n ?? null);
    rt?.platform.hideSplash();
    debug.rejectReady(err);
  }
}

void main();
