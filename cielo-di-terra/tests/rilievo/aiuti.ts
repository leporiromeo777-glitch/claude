/**
 * Aiuti per i test: carica i contenuti veri da content/ (due livelli sopra tests/rilievo/; nel modulo erano tre, sia in
 * moduli/rilievo/test sia in src/rilievo/test dopo lo spostamento).
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { regoleDaContenuti, type OpzioniRegole } from '../../src/rilievo/regole';
import type { RegoleCatasto } from '../../src/rilievo/tipi';

export const CARTELLA_CONTENUTI = fileURLToPath(new URL('../../content/', import.meta.url));
export const LAYOUT_MOTORE = fileURLToPath(new URL('../../src/world/layout.json', import.meta.url));

export function leggiJson<T = unknown>(nome: string): T {
  return JSON.parse(readFileSync(CARTELLA_CONTENUTI + nome, 'utf8')) as T;
}

export function contenutiPresenti(): boolean {
  return existsSync(CARTELLA_CONTENUTI + 'capisaldi.json') && existsSync(CARTELLA_CONTENUTI + 'fade_fase1.json');
}

export function contenuti(): { capisaldi: any; fade: any } {
  return { capisaldi: leggiJson('capisaldi.json'), fade: leggiJson('fade_fase1.json') };
}

let cache: RegoleCatasto | null = null;
/** Le regole della Fase 1 dai contenuti veri (in cache: sono immutabili). */
export function regoleFase1(): RegoleCatasto {
  cache ??= regoleDaContenuti(contenuti());
  return cache;
}

export function regoleCon(opzioni: OpzioniRegole): RegoleCatasto {
  return regoleDaContenuti(contenuti(), opzioni);
}

/** Flag (senza prefisso) contenuti in una lista di effetti. */
export function flagDa(effetti: readonly string[]): string[] {
  return effetti.filter((e) => e.startsWith('flag:')).map((e) => e.slice(5));
}

// ───────── contenuti sintetici per i casi limite ─────────

const cella = (z: number, theta: number) => Math.floor(z / 40) * 96 + Math.floor(theta / 3.75);

export const SINT = {
  /** chiodo e pilastro a 100 m (lato a-b senza ventaglio precalcolato, solo di giorno) */
  a: { id: 'cs_a', numero: 101, tipo: 'chiodo', z: 1000, theta: 20, altezza: 10 },
  b: { id: 'cs_b', numero: 102, tipo: 'pilastro', z: 1100, theta: 20, altezza: 10, altezza_segnale: 8 },
  /** a 10 m da a: troppo corto */
  c: { id: 'cs_c', numero: 103, tipo: 'chiodo', z: 1010, theta: 20, altezza: 10 },
  /** a 800 m da a: troppo lungo */
  d: { id: 'cs_d', numero: 104, tipo: 'chiodo', z: 1800, theta: 20, altezza: 10 },
  /** a cavallo fra la Valle 1 e la Finestra dei Ponti */
  f: { id: 'cs_f', numero: 105, tipo: 'chiodo', z: 1000, theta: 88, altezza: 10 },
  g: { id: 'cs_g', numero: 106, tipo: 'chiodo', z: 1000, theta: 92, altezza: 10 },
  /** sulla parete del Sordo, a 96 m dall'asse: di giorno la Linea abbaglia */
  h: { id: 'cs_h', numero: 107, tipo: 'chiodo', z: 2900, theta: 30, altezza: 550 },
  i: { id: 'cs_i', numero: 108, tipo: 'chiodo', z: 2900, theta: 60, altezza: 550 },
};

/** Particelle con ruoli: un hub, un rifugio e gli elementi mobili dei casi limite. */
export const CELLE = {
  hub: cella(1500, 40),
  rifugio: cella(1540, 40),
  x1: cella(1500, 50), // la bottega X1 sta su questa particella e su quella dell'hub
  mietuta: cella(1600, 40),
  scritta: cella(1000, 20),
  scritta2: cella(1040, 20),
  necessaria: cella(1700, 40),
  normale: cella(1800, 40),
};

export function contenutoSintetico(): { capisaldi: unknown; fade: unknown } {
  const rete = Object.values(SINT).map((c) => ({ ...c, nome: c.id, visibile_da: Object.values(SINT).map((x) => x.id).filter((x) => x !== c.id) }));
  const p = (id: number, extra: Record<string, unknown> = {}) => ({ id, stato_iniziale: 'bianco', hub: false, rifugio: false, mobile: false, elemento: null, nomi: [], ...extra });
  const V = (ids: string[]) => ids.map((id) => ({ id, descrizione: id, pezzi: [`${id.toLowerCase()}_pezzo`] }));
  return {
    capisaldi: {
      regole: { lato_min_m: 40, lato_max_giorno_m: 600, buffer_ventaglio_m: 60, abbagliamento_asse_m: 150 },
      rete_corbella: rete,
      lati: [{ id: 'a-b', a: 'cs_a', b: 'cs_b', lunghezza: 100, chiudibile: true, quando: 'solo di giorno', particelle: [] }],
      lontani_di_notte: [],
    },
    fade: {
      particelle: [
        p(CELLE.hub, { hub: true, tipo: 'piazza', elemento: 'X1' }),
        p(CELLE.rifugio, { rifugio: true, elemento: 'X5' }),
        p(CELLE.x1, { elemento: 'X1' }),
        p(CELLE.mietuta, { elemento: 'X2' }),
        p(CELLE.scritta, { elemento: 'X3' }),
        p(CELLE.scritta2, { elemento: 'X3' }),
        p(CELLE.necessaria, { elemento: 'X4' }),
        p(CELLE.normale, { elemento: 'X5' }),
      ],
      elementi_mobili: [
        { id: 'X1', nome: 'Bottega sulla piazza', particelle: [CELLE.hub, CELLE.x1], varianti: V(['Carta', 'Abitata']), variante_iniziale: 'Abitata', ora_fade: '22:30' },
        { id: 'X2', nome: 'Orto del Protocollo', particelle: [CELLE.mietuta], varianti: V(['Carta', 'Abitata', 'Mietuta']), variante_iniziale: 'Abitata', ora_fade: '23:00' },
        { id: 'X3', nome: 'Scala del fienile alto', particelle: [CELLE.scritta, CELLE.scritta2], varianti: V(['Carta', 'Abitata', 'Scritta']), variante_iniziale: 'Carta', ora_fade: '01:00' },
        { id: 'X4', nome: 'Ponticello del Pian dei Ricci', particelle: [CELLE.necessaria], varianti: V(['Carta', 'Abitata']), variante_iniziale: 'Abitata', ora_fade: '02:00', via_necessaria: true, alternativa: 'guado' },
        { id: 'X5', nome: 'Recinto delle capre', particelle: [CELLE.normale, CELLE.rifugio], varianti: V(['Carta', 'Abitata']), variante_iniziale: 'Abitata', ora_fade: '03:00' },
      ],
      notti: [],
      giro_corbella: [],
    },
  };
}
