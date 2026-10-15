/**
 * Dati per la Pianta del Verbano (GDD §8.3) e per il motore.
 *
 * Il formato segue quello del modulo `ui` (`DatiPianta` in moduli/ui/src/pianta/modello.ts):
 * una griglia densa nello stesso ordine del motore (id = iz·96 + iθ, 0 bianco, 1 matita,
 * 2 colore), i capisaldi trovati, i lati rilevati e il resoconto del mattino in rosso.
 */
import { CELLE_NTHETA, CELLE_NZ, CELLE_TOTALI, FIRMA_ELVIRA, ORARI } from './costanti';
import { nomeCatastale } from './griglia';
import { caposaldoDef } from './regole';
import { conteggi, inchiostroDi } from './stato';
import { minuti, type Ora } from './tempo';
import type { Inchiostro, RegoleCatasto, RigaResoconto, StatoCatasto, StatoParticella } from './tipi';

/** Codici degli stati del motore (`CellState` in src/world/cells.ts): Blank 0, Pencil 1, Painted 2. */
export const CODICE_MOTORE: Readonly<Record<StatoParticella, 0 | 1 | 2>> = { bianco: 0, matita: 1, colore: 2 };

export interface GrigliaPiantaCatasto {
  nZ: number;
  nTheta: number;
  /** 0 = bianco, 1 = matita, 2 = colore. */
  stati: Uint8Array;
  /** 1 = a colore solo per un rilievo antico (seppia, G4). */
  seppia: Uint8Array;
  /** 1 = cambiata stanotte (segno rosso fino a mezzogiorno). */
  cambiate: Uint8Array;
}

export interface ParticellaPiantaCatasto {
  id: number;
  catasto: string;
  stato: StatoParticella;
  inchiostro?: Inchiostro;
  cambiata?: boolean;
}

export interface CaposaldoPiantaCatasto {
  id: string;
  numero: number;
  etichetta: string;
  tipo: 'pilastro' | 'chiodo';
  nome: string;
  z: number;
  theta: number;
  /** Rilevato: triangolino a china (o seppia, se solo un rilievo antico). */
  rilevato: boolean;
  /** Trovato o visto con lo squadro: triangolino a matita. */
  visto: boolean;
  inchiostro?: Inchiostro;
  spostato?: boolean;
}

export interface LatoPiantaCatasto {
  id: string;
  da: string;
  a: string;
  firma: string;
}

export interface DatiPiantaCatasto {
  griglia: GrigliaPiantaCatasto;
  /** Solo le particelle non bianche, in un elenco semplice. */
  particelle: ParticellaPiantaCatasto[];
  capisaldi: CaposaldoPiantaCatasto[];
  lati: LatoPiantaCatasto[];
  triangoli: { id: string; tipo: string; vertici: string[] }[];
  /** Il resoconto del mattino, finché è mattino (fino alle 12:00 del giorno dopo la notte). */
  resoconto?: {
    /** Le righe rosse (formato `ResocontoPianta` del modulo ui: vuote = «Notte quieta»). */
    righe: string[];
    /** Le righe verdi («misurata: è rimasta») e grigie (Elvira c'era). */
    altreRighe: { testo: string; colore: 'verde' | 'grigio' }[];
    prossimaFinestra?: string;
    dettaglio: RigaResoconto[];
    quieta: boolean;
  };
  /** Per il cartiglio: quante particelle dell'inventario di Corbella sono a colore. */
  inventario?: { nome: string; aColore: number; totale: number };
  totaleParticelle: number;
  conteggi: ReturnType<typeof conteggi>;
}

export interface OpzioniPianta {
  /** Ora e giorno correnti: decidono se il resoconto è ancora «del mattino». */
  ora?: Ora;
  giorno?: number;
  /** Mostra anche i capisaldi non ancora trovati (per il debug). */
  tuttiICapisaldi?: boolean;
}

/** Stati per il motore, uno per cella (da copiare con world.setCellState). */
export function celleMotore(stato: StatoCatasto): Uint8Array {
  const out = new Uint8Array(CELLE_TOTALI);
  for (const [k, p] of Object.entries(stato.particelle)) out[Number(k)] = CODICE_MOTORE[p.stato];
  return out;
}

function resocontoVisibile(stato: StatoCatasto, opz: OpzioniPianta): boolean {
  const un = stato.ultimaNotte;
  if (!un) return false;
  const giorno = opz.giorno ?? stato.giorno;
  if (giorno !== un.giorno + 1) return false;
  if (opz.ora === undefined) return true;
  const m = minuti(opz.ora);
  return m >= ORARI.alba - 60 && m < ORARI.fineMattino;
}

/** Tutto ciò che la Pianta deve disegnare, in un formato semplice. */
export function datiPianta(stato: StatoCatasto, regole: RegoleCatasto, opzioni: OpzioniPianta = {}): DatiPiantaCatasto {
  const stati = celleMotore(stato);
  const seppia = new Uint8Array(CELLE_TOTALI);
  const cambiate = new Uint8Array(CELLE_TOTALI);
  const mostraResoconto = resocontoVisibile(stato, opzioni);
  const cambiateSet = new Set(mostraResoconto ? (stato.ultimaNotte?.cambiate ?? []) : []);
  const particelle: ParticellaPiantaCatasto[] = [];
  for (const k of Object.keys(stato.particelle).map(Number).sort((a, b) => a - b)) {
    const p = stato.particelle[String(k)]!;
    if (p.stato === 'bianco') continue;
    const ink = inchiostroDi(stato, k);
    if (ink === 'seppia') seppia[k] = 1;
    particelle.push({ id: k, catasto: nomeCatastale(k), stato: p.stato, ...(ink ? { inchiostro: ink } : {}), ...(cambiateSet.has(k) ? { cambiata: true } : {}) });
  }
  for (const c of cambiateSet) {
    cambiate[c] = 1;
    if (!stato.particelle[String(c)]) particelle.push({ id: c, catasto: nomeCatastale(c), stato: 'bianco', cambiata: true });
  }

  const capisaldi: CaposaldoPiantaCatasto[] = [];
  const ids = new Set([...regole.capisaldi.keys(), ...Object.keys(stato.capisaldiNuovi)]);
  for (const id of ids) {
    const d = caposaldoDef(regole, stato.capisaldiNuovi, id)!;
    const cs = stato.capisaldi[id];
    const visto = !!cs?.visto;
    const rilevato = !!cs?.rilevato;
    if (!opzioni.tuttiICapisaldi && !visto && !rilevato) continue;
    const ink: Inchiostro | undefined = rilevato ? (cs!.firme.includes(FIRMA_ELVIRA) ? 'china' : 'seppia') : undefined;
    capisaldi.push({
      id,
      numero: d.numero ?? 0,
      etichetta: d.etichetta,
      tipo: d.tipo === 'chiodo' || d.tipo === 'chiodo_nuovo' ? 'chiodo' : 'pilastro',
      nome: d.nome,
      z: d.z,
      theta: d.theta,
      rilevato,
      visto: visto || rilevato,
      ...(ink ? { inchiostro: ink } : {}),
      ...(cs?.spostato ? { spostato: true } : {}),
    });
  }

  const lati = Object.values(stato.lati).map((l) => ({ id: l.id, da: l.stazione, a: l.mira, firma: l.firma }));
  const triangoli = Object.values(stato.triangoli).map((t) => ({ id: t.id, tipo: t.tipo, vertici: [...t.vertici] }));
  const r = mostraResoconto ? stato.ultimaNotte!.resoconto : null;
  const inv = regole.inventario;
  return {
    griglia: { nZ: CELLE_NZ, nTheta: CELLE_NTHETA, stati, seppia, cambiate },
    particelle,
    capisaldi,
    lati,
    triangoli,
    ...(r
      ? {
          resoconto: {
            righe: r.righe.filter((x) => x.colore === 'rosso').map((x) => x.testo),
            altreRighe: r.righe.filter((x) => x.colore !== 'rosso').map((x) => ({ testo: x.testo, colore: x.colore as 'verde' | 'grigio' })),
            ...(r.prossimeFinestre.length ? { prossimaFinestra: r.prossimeFinestre.join(' ') } : {}),
            dettaglio: r.righe,
            quieta: r.quieta,
          },
        }
      : {}),
    ...(inv ? { inventario: { nome: inv.nome, aColore: inv.particelle.filter((c) => stati[c] === 2).length, totale: inv.particelle.length } } : {}),
    totaleParticelle: inv?.particelle.length ?? regole.particelle.size,
    conteggi: conteggi(stato),
  };
}
