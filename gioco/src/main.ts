/**
 * Avvio del gioco (ARCHITETTURA 3.1).
 * 1. Font e fogli di stile del core.
 * 2-3. Servizi del core, salvataggio, testi, contenuti e manifest degli asset.
 * 4. Registrazione dei pacchetti: ogni `src/<pacchetto>/register.ts` (glob), caricato
 *    dopo che i servizi esistono; può esportare `register(services)` o lavorare al caricamento.
 * 5. Ciclo e prima scena: 'titolo' se registrata, altrimenti 'boot' (diagnostica).
 * 6. Splash nativo nascosto, storage persistente chiesto sul web; `__GAME__.ready` risolta.
 */
import './core/fonts';
import './core/ui/theme.css';
import './core/ui/base.css';
import { createDebug, registerPackages, showFatal, startCore, type CoreRuntime } from './core/bootstrap';

const debug = createDebug();

async function main(): Promise<void> {
  let rt: CoreRuntime | null = null;
  try {
    rt = await startCore(debug);
    await registerPackages(rt, import.meta.glob('./*/register.ts'));
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
  } catch (err) {
    showFatal(err, rt?.i18n ?? null);
    rt?.platform.hideSplash();
    debug.rejectReady(err);
  }
}

void main();
