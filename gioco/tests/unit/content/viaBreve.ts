/**
 * Misura «via breve» per R2-D7 (docs/REVISIONE-2.md): una notte richiede di pensare se
 * chi gioca «di corto respiro» non trova il minimo.
 *
 * Interpretazione scritta nel rapporto (docs/stato/contenuti-atto1.md, Revisione 2):
 * - le «soluzioni brevi» sono quelle di chi, a ogni ora, fa il minor numero di incroci
 *   che lascia la notte ancora risolvibile entro la matassa (sa che cosa è ancora
 *   possibile, ma non pianifica il costo: rimanda ogni incrocio finché può);
 * - a parità di incroci si contano tutte le scelte (ogni percorso distinto, con i versi
 *   contati solo quando contano, come `countOptimal` del solver);
 * - la combinazione «richiede di pensare» se almeno il 30% di questi percorsi finisce
 *   sopra il minimo.
 *
 * Programmazione dinamica per strati sugli stati compatti del motore (le stesse primitive
 * del solver e del giocatore avido).
 */
import type { Condition, LevelDef, RunContext } from '../../../src/core/types';
import { buildModel } from '../../../src/engine/model';
import { compileProgram, finalizeAtoms, programCanOk, programOk, updateAtoms } from '../../../src/engine/conditions';
import { generateRows, genPool, pinBound, pinPlan, pinsOk } from '../../../src/engine/moves';
import { blockedMask, ginoFailed, initialCompact, newRowInfo, nonPlayerMask, stepRow } from '../../../src/engine/core';
import { trackedBeads } from '../../../src/engine/solver';

/** Soglia di R2-D7: almeno il 30% di soluzioni brevi non ottime. */
export const VIA_BREVE_SOGLIA = 0.3;

interface Node {
  S: Int32Array;
  edges: { k: number; to: string }[];
  ctg: number;
}

export interface ViaBreve {
  /** Minimo di incroci della combinazione. */
  min: number;
  /** Percorsi della via breve per numero di incroci finale. */
  percorsi: Record<number, number>;
  /** Quota dei percorsi della via breve che finiscono sopra il minimo (0-1). */
  nonOttime: number;
}

export function viaBreve(level: LevelDef, ctx: RunContext, goals: Condition[], matassa = level.matassa): ViaBreve {
  const m = buildModel(level, ctx, { track: trackedBeads(level, ctx, goals) });
  const prog = compileProgram(m, goals, m.LEN);
  const pp = pinPlan(m);
  const np = nonPlayerMask(m);
  const S0 = new Int32Array(prog.end);
  S0.set(initialCompact(m));
  updateAtoms(prog, m, S0, m.startHour, null);
  const k0 = S0.join(',');
  const layers: Map<string, Node>[] = [new Map([[k0, { S: S0, edges: [], ctg: Infinity }]])];
  const ctc: Map<string, number>[] = [new Map([[k0, 0]])];
  const info = newRowInfo();
  const gen = genPool();
  const tmp = new Int32Array(prog.end);
  const gino = m.qGino >= 0 && !m.hasAuto;
  for (let hr = m.startHour + 1; hr <= m.endHour; hr++) {
    const cur = layers[layers.length - 1] as Map<string, Node>;
    const curC = ctc[ctc.length - 1] as Map<string, number>;
    const next = new Map<string, Node>();
    const nextC = new Map<string, number>();
    for (const [key, node] of cur) {
      const c0 = curC.get(key) as number;
      const S = node.S;
      const left = matassa - c0;
      const blocked = blockedMask(m, S, hr);
      generateRows(m, prog, S, hr, blocked, np, left, gen);
      for (let r = 0; r < gen.n; r++) {
        const row = gen.rows[r];
        if (!row) continue;
        let k = 0;
        for (let j = 0; j < row.n; j++) if (!row.forced[j]) k++;
        if (k > left) continue;
        if (gino && ginoFailed(m, S, row, blocked)) continue;
        stepRow(m, S, tmp, row, hr, info, null);
        if (!pinsOk(m, tmp, hr)) continue;
        updateAtoms(prog, m, tmp, hr, info);
        if (!programCanOk(prog, m, tmp, hr)) continue;
        const lb = pinBound(m, pp, tmp, hr);
        if (lb < 0 || c0 + k + lb > matassa) continue;
        const nk = tmp.join(',');
        if (!next.has(nk)) next.set(nk, { S: tmp.slice(), edges: [], ctg: Infinity });
        nextC.set(nk, Math.min(nextC.get(nk) ?? Infinity, c0 + k));
        node.edges.push({ k, to: nk });
      }
    }
    layers.push(next);
    ctc.push(nextC);
  }
  // Costo che resta da ogni stato (all'indietro), con le condizioni di fine giornata.
  const fin = new Int32Array(prog.end);
  const last = layers[layers.length - 1] as Map<string, Node>;
  for (const node of last.values()) {
    fin.set(node.S);
    finalizeAtoms(prog, m, fin);
    node.ctg = programOk(prog, fin) ? 0 : Infinity;
  }
  for (let L = layers.length - 2; L >= 0; L--) {
    const nx = layers[L + 1] as Map<string, Node>;
    for (const node of (layers[L] as Map<string, Node>).values()) {
      let best = Infinity;
      for (const e of node.edges) best = Math.min(best, e.k + (nx.get(e.to) as Node).ctg);
      node.ctg = best;
    }
  }
  const min = (layers[0]?.get(k0) as Node).ctg;
  // Via breve: a ogni ora il minimo di incroci che lascia la notte risolvibile entro la matassa.
  let dist = new Map<string, Map<number, number>>([[k0, new Map([[0, 1]])]]);
  for (let L = 0; L < layers.length - 1; L++) {
    const here = layers[L] as Map<string, Node>;
    const nx = layers[L + 1] as Map<string, Node>;
    const nd = new Map<string, Map<number, number>>();
    for (const [key, hist] of dist) {
      const node = here.get(key) as Node;
      for (const [c, n] of hist) {
        const ok = node.edges.filter((e) => c + e.k + (nx.get(e.to) as Node).ctg <= matassa);
        if (ok.length === 0) continue;
        const kmin = Math.min(...ok.map((e) => e.k));
        for (const e of ok) {
          if (e.k !== kmin) continue;
          let h = nd.get(e.to);
          if (!h) nd.set(e.to, (h = new Map()));
          h.set(c + e.k, (h.get(c + e.k) ?? 0) + n);
        }
      }
    }
    dist = nd;
  }
  const percorsi: Record<number, number> = {};
  let tot = 0;
  let opt = 0;
  for (const [key, hist] of dist) {
    if ((last.get(key) as Node).ctg !== 0) continue;
    for (const [c, n] of hist) {
      percorsi[c] = (percorsi[c] ?? 0) + n;
      tot += n;
      if (c === min) opt += n;
    }
  }
  return { min, percorsi, nonOttime: tot > 0 ? 1 - opt / tot : 0 };
}
