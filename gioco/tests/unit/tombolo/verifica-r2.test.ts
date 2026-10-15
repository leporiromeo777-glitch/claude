// @vitest-environment happy-dom
/**
 * Verifica della revisione 2 del tombolo (docs/REVISIONE-2.md, R2-D1):
 * - seguire l'Indizio (o il Fantasma) di riga in riga, con la Session vera e i
 *   `.computed.json` veri, porta a un merletto con tutte le richieste compiute,
 *   su ogni notte della campagna con la combinazione di bigliettini designata;
 * - un Indizio che dice «va bene», «lascia stare i fili» o «prima il nome» non
 *   offre un Fantasma che direbbe la stessa cosa, e l'avviso «il fantasma toglie
 *   il filo d'oro» compare solo se c'è un filo d'oro da perdere;
 * - sul telefono la riga di spiegazione non finisce sotto «↓ altre N ore» (Q063).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AcceptedRequest, LevelComputed, LevelDef, NoteId, SolveRequest } from '../../../src/core/types';
import { solve } from '../../../src/engine/solver';
import { HINT_KEYS } from '../../../src/engine/index';
import { NightController, scrollHintTop } from '../../../src/tombolo/controller';
import { Session } from '../../../src/tombolo/session';
import { fixture, nightParams } from './helpers';
import { type Harness, harness } from './harness';

let h: Harness;
let c: NightController | null = null;

beforeEach(() => {
  h = harness();
});
afterEach(() => {
  c?.destroy();
  c = null;
  document.body.replaceChildren();
});

const syncSolve = async (req: SolveRequest) => solve({ ...req, maxStates: req.maxStates ?? 400_000 });

function level(id: string): LevelDef {
  const lv = h.s.content.levels.get(id);
  if (!lv) throw new Error(`livello ${id}`);
  return lv;
}

function computed(id: string): LevelComputed | null {
  return h.s.content.computed.get(id) ?? null;
}

function accepted(ids: NoteId[]): AcceptedRequest[] {
  return ids.map((id) => {
    const n = h.s.content.notes.get(id);
    if (!n?.request) throw new Error(`bigliettino ${id}`);
    return { noteId: n.id, request: n.request, author: n.author };
  });
}

/** La combinazione designata del livello (quality.designata), o nessun bigliettino. */
function designated(id: string): NoteId[] {
  const d = computed(id)?.quality?.designata ?? 'base';
  return d === 'base' ? [] : d.split('+');
}

const q = <T extends HTMLElement = HTMLElement>(test: string): T | null => document.querySelector<T>(`[data-test="${test}"]`);

const STORY = ['g01', 'g02', 'g03', 'g04', 'g05', 'g06', 'g07', 'g08', 'g09', 'g10', 'g11', 'g12', 'g13', 'g14', 'g15', 'g16', 'g17', 'g18', 'g19', 'g20', 'g21', 'g22', 'g23'];
const SETTLED = new Set<string>([HINT_KEYS.indizioVa, HINT_KEYS.indizioQuiete]);
const DEAD_ENDS = new Set<string>([HINT_KEYS.impossibile, 'tombolo.hint.obiettiviTardi', 'tombolo.hint.tardi', 'tombolo.hint.tardiSempre']);

function session(id: string): Session {
  const lv = level(id);
  const notes = designated(id);
  const s = new Session(nightParams(lv, { origin: 'campagna', accepted: accepted(notes), needsNome: lv.rules.includes('nome') }), { computed: computed(id), solveAsync: syncSolve, hintTimeoutMs: 60_000 });
  // Le righe precalcolate valgono per ogni scelta del nome (levels:check): basta un filo qualunque.
  if (s.needsNome) s.setNome(s.state.pos[0] as string);
  return s;
}

function allSatisfied(s: Session): boolean {
  return s.goalStatus().every((r) => r.status === 'soddisfatta') && s.requestStatusFull().every((r) => r.report.status === 'soddisfatta');
}

describe('R2-D1: seguire l\'Indizio porta alla fine, su ogni notte della campagna', () => {
  it.each(STORY)('%s (combinazione designata)', async (id) => {
    const s = session(id);
    let guard = 0;
    while (!s.done && guard++ < 40) {
      for (let k = 0; k < 8; k++) {
        const hint = await s.computeHint('indizio');
        expect(DEAD_ENDS.has(hint.textKey), `${id} alle ${s.hour}: ${hint.textKey}`).toBe(false);
        if (SETTLED.has(hint.textKey)) break;
        const col = hint.highlight?.column;
        expect(col, `${id} alle ${s.hour}: l'Indizio nomina un incrocio (${hint.textKey})`).toBeTypeOf('number');
        if (hint.textKey === HINT_KEYS.indizioTroppo) s.remove(col as number);
        else if (hint.textKey === HINT_KEYS.indizioVerso) expect(s.flip(col as number)).toBeNull();
        else {
          const over = s.state.pos[col as number] === hint.params?.sopra ? 'L' : 'R';
          expect(s.propose({ pair: col as number, over }), `${id} alle ${s.hour}`).toBeNull();
        }
        expect(k, `${id} alle ${s.hour}: l'Indizio finisce per dire «va bene»`).toBeLessThan(7);
      }
      const r = s.fix();
      expect(r.ok, `${id} alle ${s.hour}: la riga dell'Indizio si fissa`).toBe(true);
    }
    expect(s.done).toBe(true);
    expect(allSatisfied(s), `${id}: tutte le richieste compiute`).toBe(true);
  }, 120_000);
});

/** Segue l'Indizio nella riga corrente finché dice «va bene» (o «lascia stare i fili»). */
async function followIndizio(s: Session, id: string): Promise<void> {
  for (let k = 0; k < 8; k++) {
    const hint = await s.computeHint('indizio');
    expect(DEAD_ENDS.has(hint.textKey), `${id} alle ${s.hour}: ${hint.textKey}`).toBe(false);
    if (SETTLED.has(hint.textKey)) return;
    const col = hint.highlight?.column as number;
    expect(col, `${id} alle ${s.hour}: l'Indizio nomina un incrocio (${hint.textKey})`).toBeTypeOf('number');
    if (hint.textKey === HINT_KEYS.indizioTroppo) s.remove(col);
    else if (hint.textKey === HINT_KEYS.indizioVerso) expect(s.flip(col)).toBeNull();
    else expect(s.propose({ pair: col, over: s.state.pos[col] === hint.params?.sopra ? 'L' : 'R' }), `${id} alle ${s.hour}`).toBeNull();
  }
  throw new Error(`${id} alle ${s.hour}: l'Indizio non arriva a «va bene»`);
}

describe('R2-D1: con un incrocio sbagliato in bozza, l\'Indizio riporta sulla strada', () => {
  it.each(STORY.flatMap((id) => [1, 2, 3].map((k) => [id, k] as const)))('%s, seme %i', async (id, k) => {
    const s = session(id);
    const pre = s.precomputed() ?? [];
    let seed = k * 7919 + Number(id.slice(1)) * 104729;
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    let guard = 0;
    while (!s.done && guard++ < 40) {
      // Prima un incrocio che la soluzione precalcolata non ha in questa riga (se il motore lo accetta).
      const row = pre[s.rows.length]?.crossings ?? [];
      const cols = s.level.columns.length;
      const wrong = 1 + rnd(2);
      for (let t = 0, made = 0; t < 8 && made < wrong; t++) {
        const pair = rnd(cols - 1);
        const over = rnd(2) === 0 ? 'L' : 'R';
        if (row.some((x) => x.pair === pair && x.over === over)) continue;
        if (s.propose({ pair, over }) === null) made++;
      }
      await followIndizio(s, id);
      expect(s.fix().ok, `${id} alle ${s.hour}`).toBe(true);
    }
    expect(s.done).toBe(true);
    expect(allSatisfied(s), `${id}: tutte le richieste compiute`).toBe(true);
  }, 300_000);
});

describe('R2-D1: seguire il Fantasma porta alla fine', () => {
  it.each(['g04', 'g07', 'g10', 'g13', 'g17', 'g21'])('%s', async (id) => {
    const s = session(id);
    let guard = 0;
    while (!s.done && guard++ < 40) {
      const g = await s.computeHint('fantasma');
      expect(DEAD_ENDS.has(g.textKey), `${id} alle ${s.hour}: ${g.textKey}`).toBe(false);
      for (const x of g.extra ?? []) s.remove(x.pair);
      for (const x of g.ghosts ?? []) expect(s.propose({ pair: x.pair, over: x.over }), `${id} alle ${s.hour}`).toBeNull();
      expect(s.fix().ok, `${id} alle ${s.hour}`).toBe(true);
    }
    expect(s.done).toBe(true);
    expect(allSatisfied(s), `${id}: tutte le richieste compiute`).toBe(true);
  }, 120_000);
});

describe('R2-D1: la scheda del suggerimento non offre ciò che non serve', () => {
  it('Indizio «va bene»: niente «Mostrami l\'incrocio» né avviso sul filo d\'oro', async () => {
    const lv = level('g13');
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna', accepted: accepted(['g13.marta', 'g13.nina']), needsNome: true }), { computed: computed('g13'), solveAsync: syncSolve });
    c.setNome('lunardi');
    c.cross(1, 'L', 'debug');
    c.cross(3, 'L', 'debug');
    await c.lampTap();
    const ind = await c.hint('indizio');
    expect(ind.textKey).toBe(HINT_KEYS.indizioVa);
    expect(q('tb-suggerimento-ancora')).toBeNull();
    expect(q('tb-suggerimento')?.textContent).not.toContain("filo d'oro");
  });

  it('prima del nome l\'Indizio dice di appuntarlo e non offre il Fantasma', async () => {
    const lv = level('g12');
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna', accepted: accepted(['g12.lunardi', 'g12.zeno']), needsNome: true }), { computed: computed('g12'), solveAsync: syncSolve });
    await c.lampTap();
    const ind = await c.hint('indizio');
    expect(ind.textKey).toBe('tombolo.hint.nomePrima');
    expect(q('tb-suggerimento-ancora')).toBeNull();
  });

  it('con un incrocio da fare il Fantasma c\'è, e l\'avviso solo se il filo d\'oro è ancora possibile', async () => {
    const lv = level('g13');
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna', accepted: accepted(['g13.marta', 'g13.nina']), needsNome: true }), { computed: computed('g13'), solveAsync: syncSolve });
    c.setNome('lunardi');
    await c.lampTap();
    await c.hint('indizio');
    expect(q('tb-suggerimento-ancora')).not.toBeNull();
    expect(q('tb-suggerimento')?.textContent).toContain("filo d'oro");
    // Filo d'oro già perso (un Fantasma in una riga prima): l'Indizio non minaccia più niente.
    c.session.fantasmaUsed = true;
    await c.hint('indizio');
    expect(q('tb-suggerimento-ancora')).not.toBeNull();
    expect(q('tb-suggerimento')?.textContent).not.toContain("filo d'oro");
  });
});

describe('Q063: la riga di spiegazione e «↓ altre N ore» non si coprono', () => {
  it('sul telefono, con righe nascoste in fondo, la riga sta sopra il pulsante', () => {
    const lv = level('fin_aperto');
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna', mode: 'occasioni' }), { computed: computed('fin_aperto'), solveAsync: syncSolve });
    c.update(0.016);
    const down = q('tb-scorri-giu');
    expect(c.layout.kind).toBe('stretto');
    expect(down?.hidden).toBe(false);
    const ex = q('tb-explain') as HTMLElement;
    Object.defineProperty(ex, 'offsetHeight', { configurable: true, get: () => 60 });
    (c as unknown as { say(k: string, p: object, kind: string, ms: number): void }).say('tombolo.occasioni.nonBasta', {}, 'info', 3000);
    c.update(0.016);
    const bottom = parseFloat(ex.style.bottom);
    // Il bordo basso della riga è sopra il bordo alto del pulsante.
    expect(c.layout.cssH - bottom).toBeLessThanOrEqual(scrollHintTop(c.layout));
  });

  it('senza righe nascoste resta sopra la striscia delle richieste (come prima)', () => {
    const lv: LevelDef = { ...fixture('g00'), tutorial: [] };
    c = new NightController(h.s, nightParams(lv), { computed: null, solveAsync: syncSolve });
    c.update(0.016);
    expect(q('tb-scorri-giu')?.hidden).toBe(true);
    const ex = q('tb-explain') as HTMLElement;
    Object.defineProperty(ex, 'offsetHeight', { configurable: true, get: () => 40 });
    expect(c.fix().ok).toBe(false);
    c.update(0.016);
    expect(parseFloat(ex.style.bottom)).toBe(Math.round(c.layout.cssH - (c.layout.requests.y - 4)));
  });
});
