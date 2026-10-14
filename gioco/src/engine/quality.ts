/**
 * Criteri di qualità delle notti (revisione 1, contratto C14; GDD 3.13).
 *
 * Funzioni pure: `levels:check` calcola i numeri di ogni configurazione (base,
 * ogni bigliettino da solo, ogni combinazione possibile non voluta) con il
 * solver e qui si giudicano. Le soglie stanno in `QUALITY`.
 *
 * | Criterio      | Regola                                                     | Si applica a                         |
 * |---------------|------------------------------------------------------------|--------------------------------------|
 * | K1 densità    | min ≥ ⌈righe / 2⌉                                          | designata e bigliettini non `facile` |
 * | K2 costo      | min(base + nota) − min(base) ≥ 2 (Atto I), ≥ 3 (Atti II-III)| bigliettini non `facile`             |
 * | K3 Gino       | min − minSenzaGino ≤ 0,4 × min                             | designata e bigliettini, con Gino    |
 * | K4 ritmo      | vuoteMax ≤ 2 e vuoteTot ≤ ⌊0,4 × righe⌋                    | designata e bigliettini              |
 * | K5 ambiguità  | soluzioniOttime ≤ 20                                       | designata                            |
 * | K6 dilemma    | almeno una combinazione `voluta` per sera                  | g03-g22                              |
 * | K7 intervallo | min della designata nell'intervallo "Min" di GDD 5.2 ±1    | solo avviso                          |
 *
 * Al massimo un bigliettino per sera può essere `facile` (esente da K1 e K2), e
 * solo se è in un conflitto voluto con un altro bigliettino della sera.
 * Esenti: g00 (tutorial), g01 solo per K2, gli Archivi, `fin_chiuso`, i livelli
 * in autotessitura (`fin_aperto`, `fin_seppia`). `fin_merlettaia`: min(base) ≥ 8,
 * più K3 e K4.
 */
import type { LevelDef, NoteId, QualityConfig, QualityReport, RowMoves } from '../core/types';

export const QUALITY = {
  /** K1: minimo ≥ ⌈righe × densita⌉. */
  densita: 0.5,
  /** K2: costo minimo di un bigliettino nell'Atto I (e nel prologo) e negli Atti II-III. */
  costoAtto1: 2,
  costoAtti23: 3,
  /** K3: quota massima di Gino sul minimo. */
  ginoQuota: 0.4,
  /** K4: righe vuote di fila al massimo, e quota massima di righe vuote. */
  vuoteDiFila: 2,
  vuoteQuota: 0.4,
  /** K5: soluzioni ottime al massimo per la designata. */
  soluzioniMax: 20,
  /** K7: tolleranza sull'intervallo "Min" di GDD 5.2. */
  intervalloTolleranza: 1,
  /** fin_merlettaia: minimo della base. */
  merlettaiaMin: 8,
  /** K6: notti che devono avere un conflitto voluto. */
  dilemmaDa: 3,
  dilemmaA: 22,
  /** Massimo facile per sera. */
  facili: 1,
} as const;

export type Criterion = 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6';
export const CRITERIA: readonly Criterion[] = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'];

/** Esenzione di un livello: 'tutti' (nessun criterio), 'K2' (solo il costo), 'merlettaia' (min(base) ≥ 8, K3, K4), null. */
export type QualityExemption = 'tutti' | 'K2' | 'merlettaia' | null;

export function qualityExemption(level: Pick<LevelDef, 'id' | 'archive' | 'autoweave' | 'kind'>): QualityExemption {
  if (level.id === 'g00' || level.id === 'fin_chiuso' || level.archive || level.autoweave || level.kind === 'archivio') return 'tutti';
  if (level.id === 'g01') return 'K2';
  if (level.id === 'fin_merlettaia') return 'merlettaia';
  return null;
}

/** La notte deve avere un conflitto voluto (K6)? Le notti della storia da g03 a g22. */
export function dilemmaRequired(levelId: string): boolean {
  const m = /^g(\d{2})$/.exec(levelId);
  if (!m) return false;
  const n = Number(m[1]);
  return n >= QUALITY.dilemmaDa && n <= QUALITY.dilemmaA;
}

/** Righe vuote (senza incroci del giocatore) di fila al massimo, e in tutto. */
export function emptyRows(rows: readonly RowMoves[]): { vuoteMax: number; vuoteTot: number } {
  let run = 0;
  let vuoteMax = 0;
  let vuoteTot = 0;
  for (const r of rows) {
    if (r.crossings.some((c) => !c.forced)) run = 0;
    else {
      run++;
      vuoteTot++;
      vuoteMax = Math.max(vuoteMax, run);
    }
  }
  return { vuoteMax, vuoteTot };
}

/** Una configurazione con quello che serve per giudicarla. */
export interface QualityItem extends QualityConfig {
  kind: 'base' | 'note' | 'combo';
  notes: NoteId[];
}

export interface QualityInput {
  levelId: string;
  act: number;
  /** Righe giocabili (endHour − startHour). */
  rows: number;
  /** Gino nel merletto con `ginoCorre` (K3). */
  gino: boolean;
  exemption: QualityExemption;
  /** Base, ogni bigliettino da solo, ogni combinazione possibile non voluta. */
  items: QualityItem[];
  /** Combinazioni marcate `voluta` (anche bigliettini da soli), per K6 e per i facili. */
  volute: NoteId[][];
  facili: NoteId[];
  /** Intervallo "Min" di GDD 5.2 (K7), se noto. */
  minRange?: [number, number] | null;
}

export interface QualityJudgement {
  report: QualityReport;
  /** Violazioni per criterio; null = criterio non applicabile (esenzione). */
  byCriterion: Record<Criterion, number | null>;
  /** Avvisi (K7, criteri non verificati per il limite di stati). */
  warnings: string[];
}

/** La designata: la configurazione possibile più cara; a parità quella con più bigliettini, poi la prima. */
export function designata(items: readonly QualityItem[]): QualityItem | null {
  let best: QualityItem | null = null;
  for (const it of items) {
    if (it.min === null) continue;
    if (!best || it.min > (best.min as number) || (it.min === best.min && it.notes.length > best.notes.length)) best = it;
  }
  return best;
}

function crossings(n: number): string {
  return `${n} crossing${n === 1 ? '' : 's'}`;
}

function emptyRowsText(n: number): string {
  return `${n} empty row${n === 1 ? '' : 's'}`;
}

export function costThreshold(act: number): number {
  return act >= 2 ? QUALITY.costoAtti23 : QUALITY.costoAtto1;
}

/** Giudica i criteri K1-K7 (C14). */
export function judgeQuality(q: QualityInput): QualityJudgement {
  const violazioni: string[] = [];
  const warnings: string[] = [];
  const by: Record<Criterion, number | null> = { K1: 0, K2: 0, K3: q.gino ? 0 : null, K4: 0, K5: 0, K6: dilemmaRequired(q.levelId) ? 0 : null };
  const add = (k: Criterion, msg: string): void => {
    violazioni.push(`${k} ${msg}`);
    by[k] = (by[k] ?? 0) + 1;
  };
  const des = designata(q.items);
  const report: QualityReport = {
    configs: q.items.map(({ kind: _k, notes: _n, ...c }) => c),
    designata: des?.config ?? 'base',
    facili: [...q.facili],
    violazioni,
  };
  if (q.exemption === 'tutti') {
    for (const k of CRITERIA) by[k] = null;
    return { report, byCriterion: by, warnings };
  }
  const merlettaia = q.exemption === 'merlettaia';
  if (merlettaia) {
    by.K2 = null;
    by.K5 = null;
    by.K6 = null;
  }
  if (q.exemption === 'K2') by.K2 = null;

  const need1 = Math.ceil(q.rows * QUALITY.densita);
  const need2 = costThreshold(q.act);
  const maxVuote = Math.floor(q.rows * QUALITY.vuoteQuota);
  const facili = new Set(q.facili);
  const notes = q.items.filter((it) => it.kind === 'note' && it.min !== null);
  const base = q.items.find((it) => it.kind === 'base');

  // K1 densità (fin_merlettaia: minimo della base ≥ 8).
  if (merlettaia) {
    if (base && base.min !== null && base.min < QUALITY.merlettaiaMin) add('K1', `base: fin_merlettaia needs a base minimum of at least ${QUALITY.merlettaiaMin} (now ${base.min})`);
  } else {
    const notFacile = notes.filter((n) => n !== des && !facili.has(n.notes[0] as NoteId));
    for (const it of des ? [des, ...notFacile] : notFacile) {
      if ((it.min as number) < need1) add('K1', `${it.config}: ${crossings(it.min as number)}, density needs at least ${need1} (⌈${q.rows}/2⌉)`);
    }
  }

  // K2 costo e facili.
  if (by.K2 !== null) {
    for (const n of notes) {
      if (facili.has(n.notes[0] as NoteId) || n.costo === undefined) continue;
      if (n.costo < need2) add('K2', `${n.config}: costs ${crossings(n.costo)} over the base, needs at least ${need2}`);
    }
    if (facili.size > QUALITY.facili) add('K2', `${facili.size} notes marked facile (${[...facili].join(', ')}): at most ${QUALITY.facili} per evening`);
    for (const f of facili) {
      const inConflict = q.volute.some((v) => v.length >= 2 && v.includes(f));
      if (!inConflict) add('K2', `${f}: marked facile but it is not in an intended conflict (voluta) with another note`);
    }
  }

  // K3 Gino e K4 ritmo: designata e bigliettini.
  const k34 = des ? [des, ...notes.filter((n) => n !== des)] : notes;
  for (const it of k34) {
    if (by.K3 !== null) {
      if (it.minSenzaGino === null) warnings.push(`K3 ${it.config}: minimum without Gino not verified (solver state limit)`);
      else {
        const share = (it.min as number) - it.minSenzaGino;
        if (share > QUALITY.ginoQuota * (it.min as number)) add('K3', `${it.config}: Gino makes ${share} of ${crossings(it.min as number)} (at most ${Math.floor(QUALITY.ginoQuota * (it.min as number))}, 40%)`);
      }
    }
    if (it.vuoteMax > QUALITY.vuoteDiFila) add('K4', `${it.config}: ${emptyRowsText(it.vuoteMax)} in a row in the recorded solution (at most ${QUALITY.vuoteDiFila})`);
    if (it.vuoteTot > maxVuote) add('K4', `${it.config}: ${emptyRowsText(it.vuoteTot)} of ${q.rows} in the recorded solution (at most ${maxVuote})`);
  }

  // K5 ambiguità: designata.
  if (by.K5 !== null && des && des.soluzioniOttime > QUALITY.soluzioniMax) {
    add('K5', `${des.config}: ${des.soluzioniOttime >= 50 ? 'at least 50' : des.soluzioniOttime} optimal solutions (at most ${QUALITY.soluzioniMax})`);
  }

  // K6 dilemma.
  if (by.K6 !== null && q.volute.length === 0) add('K6', 'no intended conflict in the evening (no combination marked voluta)');

  // K7 intervallo (solo avviso).
  if (q.minRange && des && des.min !== null && !merlettaia) {
    const [lo, hi] = q.minRange;
    const tol = QUALITY.intervalloTolleranza;
    if (des.min < lo - tol || des.min > hi + tol) warnings.push(`K7 ${des.config}: designated minimum ${des.min} outside the GDD 5.2 range ${lo === hi ? lo : `${lo}-${hi}`} (±${tol})`);
  }
  return { report, byCriterion: by, warnings };
}
