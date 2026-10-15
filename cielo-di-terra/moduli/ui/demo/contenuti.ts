/**
 * Dati della demo presi dai contenuti veri (fotografia in demo/contenuti/, copiata da content/ con
 * `npm run importa-contenuti`) attraverso gli adattatori del modulo. Se la fotografia manca si usano
 * gli esempi di demo/dati.ts.
 */
import {
  battutaDaNodo,
  capisaldiDaContenuti,
  cartaDaTesto,
  grigliaDaParticelle,
  latiDaContenuti,
  librettoDaTesti,
  luoghiDaContenuti,
  taccuinoDaContenuti,
  type BattutaDialogo,
  type Carta,
  type DatiPianta,
  type DatiTaccuino,
  type DialogoJson,
  type ParticellaFadeJson,
  type PersonaggioJson,
  type TaccuinoJson,
  type VoceTestiJson,
} from '../src/index';
import type * as Esempio from './dati';

export interface DatiDemo {
  battuta: BattutaDialogo;
  lettera: Carta;
  libretto: Carta;
  /** Pagina del libretto da cui aprire (per la schermata). */
  paginaLibretto: number;
  cartellino: Carta;
  biglietto: Carta;
  dattiloscritto: Carta;
  taccuino: DatiTaccuino;
  pianta: DatiPianta;
  proverbi?: string[];
  /** Da dove vengono i dati. */
  fonte: string;
}

const file = import.meta.glob('./contenuti/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const leggi = <T>(nome: string): T | undefined => file[`./contenuti/${nome}.json`] as T | undefined;

interface TestiJson {
  lettere: Record<string, VoceTestiJson>;
  libretto: Record<string, VoceTestiJson>;
  cartellini: Record<string, VoceTestiJson>;
  scritte: Record<string, VoceTestiJson>;
  proverbi: { italiano: string }[];
}

/** Le voci del taccuino che si hanno alla fine del primo giorno della Fase 1 (scelte a mano per la demo). */
const VOCI_GIORNO_1 = [
  'q_vetro', 'i_scritta_vetro', 'i_forzata', 'i_apertura_manuale',
  'q_giardinieri', 'i_capsula_1', 'i_capsula_3', 'i_capsule_6_7',
  'q_lettera', 'i_stella_alpina', 'i_carta_castagno', 'n_fiore_madre', 'n_carta_madre',
  'q_marta', 'i_sorella_passa',
  'q_indice', 'i_fame_luce',
  'q_notte', 'i_sentiero_sparito', 'i_sentiero_salvato', 'i_benedetta', 'pv_misura', 'pv_strada', 'i_legge_1',
  'q_api', 'i_ricci_vuoti',
  'n_meta_tecnica', 'n_fade_tecnica',
  'w_insu', 'w_linea', 'w_meta', 'w_mane', 'w_sera', 'w_sorella', 'w_fade',
  'pv_ombra',
  'lg_partenza_1', 'lg_partenza_2b',
];
const NUOVE = ['q_api', 'i_ricci_vuoti', 'i_carta_castagno', 'n_carta_madre', 'w_fade', 'pv_strada', 'lg_partenza_2b'];

export function contenutiVeri(es: typeof Esempio): DatiDemo {
  const testi = leggi<TestiJson>('testi');
  const taccuino = leggi<TaccuinoJson>('taccuino');
  const capisaldi = leggi<Parameters<typeof capisaldiDaContenuti>[0] & { lati?: { id: string; a: string; b: string }[] }>('capisaldi');
  const luoghi = leggi<{ id: string; nome: string; z: number; theta: number; tipo?: string }[]>('luoghi');
  const personaggi = leggi<PersonaggioJson[]>('personaggi') ?? [];
  const dialoghi = leggi<Record<string, DialogoJson>>('dialoghi');
  const fade = leggi<{ particelle: ParticellaFadeJson[] }>('fade_fase1');

  const esempi: DatiDemo = {
    battuta: es.BATTUTA_OTTAVIO,
    lettera: es.LETTERA_MARTA,
    libretto: es.LIBRETTO_AURELIO,
    paginaLibretto: 0,
    cartellino: es.CARTELLINO_MARZE,
    biglietto: es.CARTELLINO_MARZE,
    dattiloscritto: es.LETTERA_S,
    taccuino: es.TACCUINO,
    pianta: es.PIANTA,
    fonte: 'esempi dal concept e dal GDD',
  };
  if (!testi || !taccuino) return esempi;

  const libretto = librettoDaTesti(testi.libretto);
  const indiceCs1 = Object.keys(testi.libretto).indexOf('cs_1');
  const nodo = dialoghi?.['d_ottavio_incontro'] ? battutaDaNodo(dialoghi['d_ottavio_incontro'], 'n1', personaggi) : null;

  // La Pianta del mattino del giorno 2: stati iniziali, più quello che la missione 1 ha rilevato
  // (lati 1-3 e 3-11), e la scorciatoia delle Terrazze tornata alla Carta nella notte.
  let pianta: DatiPianta = es.PIANTA;
  if (fade && capisaldi) {
    const lati = capisaldi.lati ?? [];
    const chiusi = ['1-3', '3-11', '1-11'];
    const rilevate = new Map<number, 'colore'>();
    for (const l of lati as { id: string; particelle?: number[] }[]) {
      if (chiusi.includes(l.id)) for (const c of l.particelle ?? []) rilevate.set(c, 'colore');
    }
    pianta = {
      griglia: grigliaDaParticelle(fade.particelle, { stati: rilevate, cambiate: [2311, 2407] }),
      totaleParticelle: fade.particelle.length,
      capisaldi: capisaldiDaContenuti(capisaldi, { rilevati: ['cs_1', 'cs_3', 'cs_11'], visti: ['cs_4', 'cs_6', 'cs_7', 'cs_8', 'cs_37', 'cs_14', 'cs_12'] }),
      lati: latiDaContenuti(lati, chiusi),
      luoghi: luoghiDaContenuti(luoghi ?? []),
      elvira: { z: 1046, theta: 37, direzione: 70 },
      resoconto: {
        righe: ['Scorciatoia delle Terrazze: non misurata, tornata alla Carta.', 'Casa di Nando: misurata, è rimasta.'],
        prossimaFinestra: 'Bortolo rimette i gradini alle 07:00',
      },
    };
  }

  return {
    battuta: nodo?.battuta ?? es.BATTUTA_OTTAVIO,
    lettera: testi.lettere['lettera_marta'] ? { ...cartaDaTesto('lettera_marta', testi.lettere['lettera_marta'], 'lettere'), titolo: 'Lettera di Marta' } : es.LETTERA_MARTA,
    libretto,
    paginaLibretto: Math.max(0, indiceCs1),
    cartellino: testi.cartellini['cartellino_castagno'] ? cartaDaTesto('cartellino_castagno', testi.cartellini['cartellino_castagno'], 'cartellini') : es.CARTELLINO_MARZE,
    biglietto: testi.lettere['biglietto_madre'] ? cartaDaTesto('biglietto_madre', testi.lettere['biglietto_madre'], 'lettere') : es.CARTELLINO_MARZE,
    dattiloscritto: es.LETTERA_S,
    taccuino: taccuinoDaContenuti(taccuino, {
      voci: VOCI_GIORNO_1,
      nuove: NUOVE,
      chiuse: ['q_notte'],
      prossimoEvento: 'Meta fra 34 s · brace alle 19:30',
    }),
    pianta,
    proverbi: testi.proverbi.map((p) => p.italiano),
    fonte: 'content/*.json (fotografia in demo/contenuti)',
  };
}
