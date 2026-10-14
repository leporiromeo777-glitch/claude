/**
 * Font inclusi nel bundle (ARCHITETTURA 1, 16): solo sottoinsieme latino e pesi
 * usati, nessuna richiesta di rete esterna. Licenza OFL.
 * - Atkinson Hyperlegible: interfaccia (400, 400 corsivo, 700);
 * - EB Garamond: Libro, Taccuino, testi di gioco (400, 400 corsivo, 600);
 * - Caveat: calligrafie dei bigliettini e note a margine (400, 700).
 */
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-400-italic.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-600.css';
import '@fontsource/caveat/latin-400.css';
import '@fontsource/caveat/latin-700.css';

export const FONT_FAMILIES = {
  ui: 'Atkinson Hyperlegible',
  libro: 'EB Garamond',
  mano: 'Caveat',
} as const;

/** Precarica i font principali; non attende più di `timeoutMs`. Non lancia mai. */
export async function fontsReady(timeoutMs = 1500): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const loads = [
    `400 17px "${FONT_FAMILIES.ui}"`,
    `700 17px "${FONT_FAMILIES.ui}"`,
    `400 17px "${FONT_FAMILIES.libro}"`,
  ].map((f) => document.fonts.load(f).catch(() => []));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, timeoutMs))]);
}
