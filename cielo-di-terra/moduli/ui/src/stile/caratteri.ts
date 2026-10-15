/**
 * Caratteri dell'interfaccia: tutti di Google Fonts (licenza SIL OFL), ospitati in locale
 * tramite i pacchetti @fontsource, così il gioco non dipende da una connessione esterna.
 *
 * - EB Garamond: testo dell'interfaccia.
 * - IM Fell English / IM Fell English SC: titoli e maiuscoletti, come i cartigli incisi.
 * - Caveat: la mano di Elvira (taccuino, notifiche a matita).
 * - Playwrite IT Moderna: la corsiva scolastica italiana della lettera di Marta.
 * - Architects Daughter: la calligrafia minuta e regolare di Aurelio, geometra.
 * - Special Elite: i fogli battuti a macchina (le lettere di «S.»).
 * - Atkinson Hyperlegible: opzione «caratteri ad alta leggibilità».
 */
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-500.css';
import '@fontsource/eb-garamond/latin-600.css';
import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/im-fell-english/latin-400-italic.css';
import '@fontsource/im-fell-english-sc/latin-400.css';
import '@fontsource/caveat/latin-400.css';
import '@fontsource/caveat/latin-600.css';
import '@fontsource/playwrite-it-moderna/latin-400.css';
import '@fontsource/architects-daughter/latin-400.css';
import '@fontsource/special-elite/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';

/** Famiglie da precaricare (document.fonts.load) prima di mostrare le carte, per evitare il salto di carattere. */
export const FAMIGLIE_CARATTERI = [
  '400 18px "EB Garamond"',
  'italic 400 18px "EB Garamond"',
  '600 18px "EB Garamond"',
  '400 18px "IM Fell English"',
  '400 18px "IM Fell English SC"',
  '400 18px "Caveat"',
  '600 18px "Caveat"',
  '400 18px "Playwrite IT Moderna"',
  '400 18px "Architects Daughter"',
  '400 18px "Special Elite"',
] as const;

/** Carica i caratteri; si risolve comunque (anche se un carattere manca) entro `limiteMs`. */
export async function caricaCaratteri(limiteMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const tutti = Promise.allSettled(FAMIGLIE_CARATTERI.map((f) => document.fonts.load(f, 'Aàèìòù«»')));
  await Promise.race([tutti, new Promise((r) => setTimeout(r, limiteMs))]);
}
