// @vitest-environment happy-dom
/**
 * Revisione 2 del tombolo (docs/REVISIONE-2.md, docs/stato/revisione-2.json):
 * - Q011: la prima perlina di ogni filo si vede (scala > 0, una sotto l'altra);
 * - Q023: g12, prima del nome nessun verdetto e niente «a rischio»; dopo il
 *   nome i suggerimenti si ricalcolano (la cache non resta indietro);
 * - Q041, Q025: Indizio e Fantasma con la bozza e con tutta la riga;
 * - Q001: «Fissa fino alle N» mai nelle notti con tutorial e solo se il solver
 *   conferma che le ore vuote lasciano una soluzione;
 * - Q013: dopo «non stanno insieme» l'Indizio dice per quale richiesta vale;
 * - Q024: l'incrocio del filo nero rifatto a mano non si conta.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AcceptedRequest, LevelComputed, LevelDef, NoteId, SolveRequest } from '../../../src/core/types';
import { solve } from '../../../src/engine/solver';
import { HINT_KEYS } from '../../../src/engine/index';
import { NightController } from '../../../src/tombolo/controller';
import { Session } from '../../../src/tombolo/session';
import { BEAD_SCALE_NARROW, beadScale, stackSlots } from '../../../src/tombolo/render/lace';
import { stacksOf, beadTypesOf } from '../../../src/tombolo/render/model';
import { beadSpots } from '../../../src/tombolo/ui/bubbles';
import { fixture, fixtureComputed, fixtureNotes, nightParams } from './helpers';
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

function accepted(...ids: NoteId[]): AcceptedRequest[] {
  return ids.map((id) => {
    const n = h.s.content.notes.get(id);
    if (!n?.request) throw new Error(`bigliettino ${id}`);
    return { noteId: n.id, request: n.request, author: n.author };
  });
}

function q<T extends HTMLElement = HTMLElement>(test: string): T | null {
  return document.querySelector<T>(`[data-test="${test}"]`);
}

describe('Q011: la prima perlina di ogni filo si vede', () => {
  it('una perlina sola: disegnata a scala piena (non 0), sotto la riga', () => {
    const l = { scale: 1, kind: 'largo' as const, spindles: { x: 0, y: 500, w: 100, h: 100 } };
    const one = stackSlots(l, { beads: [{ id: 'L1', type: 'lettera', delivered: false, tremble: 0 }] }, 50, 50, 300);
    expect(one).toHaveLength(1);
    expect(one[0]!.scale).toBe(1);
    expect(one[0]!.y).toBe(300);
    const three = stackSlots(l, { beads: ['a', 'b', 'c'].map((id) => ({ id, type: 'voce' as const, delivered: false, tremble: 0 as const })) }, 50, 50, 300);
    expect(three.map((s) => s.scale)).toEqual([1, 1, 1]);
    // Una sotto l'altra, mai due nello stesso punto.
    expect(new Set(three.map((s) => s.y)).size).toBe(3);
    expect(three[1]!.y - three[0]!.y).toBe(three[2]!.y - three[1]!.y);
  });

  it('sul telefono le perline sono più grandi (Q052)', () => {
    expect(beadScale({ scale: 1, kind: 'stretto' })).toBe(BEAD_SCALE_NARROW);
    expect(beadScale({ scale: 1.3, kind: 'largo' })).toBe(1.3);
  });

  it('g06: la voce di Teresa (unica perlina del suo filo) ha il suo posto e il suo tocco', () => {
    const lv = level('g06');
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna', accepted: accepted('g06.nina', 'g06.zeno') }), { computed: computed('g06'), solveAsync: syncSolve });
    const st = c.model.stacks.find((x) => x.thread === 'teresa');
    expect(st?.beads.map((b) => b.id)).toContain('voce:ninaParte');
    const slots = stackSlots(c.layout, st!, 0, 0, 100);
    expect(slots[0]!.scale).toBeGreaterThan(0);
    // Il tocco (e il passaggio del mouse) la trova.
    const spots = beadSpots({ layout: c.layout, model: c.model, scroll: c.scroll, rig: c.renderer.rig, previewing: false });
    expect(spots.some((b) => b.thread === 'teresa' && b.bead === 'voce:ninaParte')).toBe(true);
  });

  it('il modello mette nelle pile tutte le perline (una lettera sola compresa)', () => {
    const lv = fixture('g00');
    const s = new Session(nightParams(lv));
    const stacks = stacksOf(s.state, beadTypesOf(lv));
    const holders = Object.values(s.state.holders).flat();
    expect(stacks.reduce((n, x) => n + x.beads.length, 0)).toBe(holders.length);
  });
});

describe('Q023: g12, prima del nome nessun verdetto', () => {
  const params = () => nightParams(level('g12'), { origin: 'campagna', accepted: accepted('g12.lunardi', 'g12.zeno'), needsNome: true });

  it('la richiesta di Lunardi (sul nome) resta «in corso», non «a rischio»', () => {
    const s = new Session(params(), { computed: computed('g12'), solveAsync: syncSolve });
    expect(s.needsNome).toBe(true);
    const st = s.requestStatusFull().find((x) => x.noteId === 'g12.lunardi');
    expect(st?.report.status).toBe('in_corso');
    expect(st?.anteprima).toBe('in_corso');
  });

  it('la lampada prima del nome non dice «non si può compiere»; dopo il nome si ricalcola', async () => {
    c = new NightController(h.s, params(), { computed: computed('g12'), solveAsync: syncSolve });
    const before = await c.lampTap();
    expect(before?.textKey).not.toBe('tombolo.hint.tardiSempre');
    expect(c.diagnosis).toBeNull();
    expect(q('tb-suggerimento-lascia-g12.lunardi')).toBeNull();
    expect((await c.session.computeHint('indizio')).textKey).toBe('tombolo.hint.nomePrima');
    // Il nome su Marta (il giocatore del playtest), poi di nuovo la lampada.
    c.setNome('marta');
    expect(c.session.nomeOn).toBe('marta');
    const after = await c.lampTap();
    expect(after?.textKey).not.toBe('tombolo.hint.tardiSempre');
    expect(c.diagnosis).toBeNull();
    // Il gettone dopo il nome: niente «a rischio» all'apertura.
    const st = c.session.requestStatusFull().find((x) => x.noteId === 'g12.lunardi');
    expect(st?.report.status).not.toBe('fallita');
  });
});

describe('R2-D1: la cache dei suggerimenti segue la bozza (Q025)', () => {
  it('g13: l\'Indizio con Bepi sopra Marta già in bozza nomina l\'incrocio che manca', async () => {
    const lv = level('g13');
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna', accepted: accepted('g13.marta', 'g13.nina'), needsNome: true }), { computed: computed('g13'), solveAsync: syncSolve });
    c.setNome('lunardi');
    expect(c.cross(1, 'L', 'debug')).toBeNull();
    await c.lampTap();
    const ind = await c.hint('indizio');
    expect(ind.textKey).toBe(HINT_KEYS.indizioSopra);
    expect(ind.params).toMatchObject({ ora: 7, sopra: 'gino', sotto: 'piero' });
    // Fatto anche il secondo: la lampada riapre l'Indizio, ricalcolato: «va bene, fissala».
    expect(c.cross(3, 'L', 'debug')).toBeNull();
    const again = await c.lampTap();
    expect(again?.tier).toBe('indizio');
    expect(again?.textKey).toBe(HINT_KEYS.indizioVa);
    expect(q('tb-suggerimento')?.textContent).toContain('fissala');
  });

  it('il Fantasma tratteggia tutti gli incroci della riga e li toglie man mano', async () => {
    const lv = level('g13');
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna', accepted: accepted('g13.marta', 'g13.nina'), needsNome: true }), { computed: computed('g13'), solveAsync: syncSolve });
    c.setNome('lunardi');
    const g = await c.hint('fantasma');
    expect(g.textKey).toBe(HINT_KEYS.fantasmaDue);
    expect(c.overlay.ghosts).toEqual([
      { pair: 1, over: 'L' },
      { pair: 3, over: 'L' },
    ]);
    expect(q('tb-suggerimento')?.textContent).toMatch(/Bepi.*Marta.*Gino.*Piero/);
    c.cross(1, 'L', 'debug');
    expect(c.overlay.ghosts).toEqual([{ pair: 3, over: 'L' }]);
    c.cross(3, 'L', 'debug');
    expect(c.overlay.ghosts).toEqual([]);
    expect(c.session.fantasmaUsed).toBe(true);
  });
});

describe('Q001: «Fissa fino alle N» sicuro', () => {
  it('mai nelle notti con il tutorial (prologo, ora 7)', () => {
    const lv = level('g00');
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna' }), { computed: computed('g00'), solveAsync: syncSolve });
    c.cross(0, 'R', 'debug');
    expect(c.fix().ok).toBe(true);
    expect(c.session.quietRun().count).toBe(0);
    expect(c.quietUntil).toBeNull();
    expect(q('tb-salta-quiete')?.hidden).toBe(true);
  });

  it('senza tutorial: solo se le ore vuote lasciano una soluzione (il solver lo conferma)', async () => {
    // Il prologo senza tutorial: alle 7 due ore vuote rendono impossibile la lettera.
    const lv: LevelDef = { ...level('g00'), tutorial: [] };
    const s = new Session(nightParams(lv, { origin: 'campagna' }), { computed: computed('g00'), solveAsync: syncSolve });
    s.propose({ pair: 0, over: 'R' });
    expect(s.fix().ok).toBe(true);
    const run = s.quietRun();
    expect(run.count).toBe(2);
    expect(s.quietConfirmedNow(run)).toBeNull();
    expect((await s.confirmQuietRun(run)).count).toBe(0);
    // Una notte davvero quieta: confermata subito.
    const quiet: LevelDef = { ...fixture('g00'), pins: [], goals: [], tutorial: [], quirks: [], endHour: 12, matassa: 40 };
    const s2 = new Session(nightParams(quiet), { solveAsync: syncSolve });
    expect(s2.quietConfirmedNow()?.count).toBe(6);
  });

  it('con una richiesta che ha bisogno di quelle ore: la corsa si accorcia o sparisce', async () => {
    const base: LevelDef = { ...fixture('g00'), pins: [], tutorial: [], quirks: [], endHour: 12, matassa: 40 };
    // La lettera deve arrivare a Don Piero entro le 9: servono incroci prima delle 9.
    const lv: LevelDef = { ...base, goals: [{ t: 'consegnata', bead: 'L1', by: 11 }] };
    const s = new Session(nightParams(lv), { solveAsync: syncSolve });
    const run = s.quietRun();
    const ok = await s.confirmQuietRun(run);
    expect(ok.count).toBeLessThan(run.count);
  });
});

describe('Q013: l\'Indizio dopo «non stanno insieme» dice per chi vale', () => {
  it('g06 (fixture del motore) con Nina e Zeno: «Vale se lasci cadere…»', async () => {
    const lv = fixture('g06');
    const notes = fixtureNotes();
    const acc = ['g06.nina', 'g06.zeno'].map((id) => {
      const n = notes.find((x) => x.id === id)!;
      return { noteId: n.id, request: n.request!, author: n.author };
    });
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna', accepted: acc }), { computed: fixtureComputed('g06'), solveAsync: syncSolve });
    await c.lampTap();
    expect(c.diagnosis?.k).toBe('incompatibili');
    await c.hint('indizio');
    const line = q('tb-suggerimento-selasci');
    expect(line).not.toBeNull();
    expect(line?.textContent).toMatch(/Vale se lasci cadere la richiesta di (Nina|Zeno)/);
    expect(c.session.hintLeavesOut.length).toBe(1);
    // Lasciata cadere davvero una delle due, l'Indizio non ha più bisogno della riga.
    c.drop(c.session.hintLeavesOut[0]!);
    await c.lampTap();
    await c.hint('indizio');
    expect(q('tb-suggerimento-selasci')).toBeNull();
  });
});

describe('Q024: l\'incrocio del filo nero non è del giocatore', () => {
  it('g21: rifare a mano l\'incrocio di Livia è rifiutato, e il bilancio conta 12', () => {
    const lv = level('g21');
    const comp = computed('g21')!;
    const combo = comp.combos.find((x) => x.notes.join() === 'g21.zeno,g21.piero')!;
    const s = new Session(nightParams(lv, { origin: 'campagna', accepted: accepted(...combo.notes) }), { computed: comp });
    let echoes = 0;
    for (const r of combo.rows!) {
      for (const x of r.crossings) {
        const v = s.propose({ pair: x.pair, over: x.over });
        if (x.forced) {
          expect(v?.code).toBe('forzato');
          echoes++;
        } else expect(v).toBeNull();
      }
      expect(s.fix().ok).toBe(true);
    }
    expect(echoes).toBe(6);
    expect(s.outcome().metrics).toMatchObject({ incroci: 12, minIncroci: 12, filoDOro: true });
  });
});

describe('Q070: nessun avviso dice chi è un filo sbiadito', () => {
  it('arc1: la lettura di Teresa (filo sbiadito 2) non emette quirk:discovered', () => {
    const lv = level('arc1');
    c = new NightController(h.s, nightParams(lv, { origin: 'archivio', mode: 'archivio' }), { computed: computed('arc1'), solveAsync: syncSolve });
    // Le righe registrate si riapplicano da sole fino allo strappo.
    expect(c.session.rows.length).toBeGreaterThan(0);
    expect(h.events.filter((e) => e.k === 'quirk:discovered')).toEqual([]);
    expect(c.session.discoveredQuirks).toEqual([]);
  });
});

describe('Q051: il filo nero che entra', () => {
  it('la bolla del bordo dice che chi è lì esce; nelle modalità extra è annunciato', () => {
    const lv = fixture('test-nero');
    c = new NightController(h.s, nightParams(lv, { origin: 'libero' }), { computed: null, solveAsync: syncSolve });
    const t = h.s.i18n.t('tombolo.bolla.bordo.nero', { ora: '8', presso: 'al Faro' });
    expect(t).toMatch(/esce/);
    // L'ingresso delle 8 è a un'ora dall'apertura (riga delle 7): la riga in basso lo annuncia.
    expect(q('tb-explain')?.hidden).toBe(false);
    expect(q('tb-explain')?.textContent).toMatch(/Alle 8 entra il filo nero al Faro: chi è lì esce/);
  });

  it('un obiettivo di un filo uscito per sempre è «fallita», non «a rischio»', () => {
    const lv = fixture('test-nero');
    // Il lino al Faro esce quando entra il filo nero (alle 8): non incontrerà più Nina.
    const s = new Session(nightParams(lv, { goals: [{ t: 'incontra', a: 'lino1', b: 'nina' }] }));
    expect(s.fix().ok).toBe(true);
    expect(s.fix().ok).toBe(true);
    expect(s.state.offboard.some((o) => o.thread === 'lino1')).toBe(true);
    expect(s.goalStatus()[0]).toMatchObject({ status: 'fallita', reasonKey: 'tombolo.cond.perso.incontra' });
  });
});

describe('Q015: una richiesta già impossibile è «fallita»', () => {
  it('presso irraggiungibile per distanza: fallita con il motivo «non può più»', () => {
    const g00 = fixture('g00');
    const far = g00.columns[2] as LevelDef['columns'][number];
    const lv: LevelDef = { ...g00, pins: [], tutorial: [], goals: [{ t: 'presso', who: g00.initial[0] as string, place: far, hour: g00.startHour + 1 }] };
    const s = new Session(nightParams(lv));
    // Il primo filo non arriva due colonne più in là in un'ora sola.
    const r = s.goalStatus()[0]!;
    expect(r.status).toBe('fallita');
    expect(r.reasonKey).toBe('tombolo.cond.perso.presso');
    expect(h.s.i18n.t('tombolo.cond.perso.presso', { chi: 'Marta', presso: 'in Chiesa', ora: '7' })).toMatch(/non può più/);
  });
});

describe('Q034: all\'ultima ora le condizioni «a fine giornata» si decidono sulla bozza', () => {
  it('nonHa: con la bozza giusta all\'ultima riga è «si compie se fissi l\'ora»', () => {
    const lv: LevelDef = { ...fixture('g00'), pins: [], tutorial: [], goals: [], endHour: 7 };
    const s = new Session(nightParams(lv, { goals: [{ t: 'nonHa', who: 'piero', bead: 'L1' }] }));
    expect(s.fix().ok).toBe(true);
    expect(s.hour).toBe(lv.endHour);
    const st = s.goalPreview()[0];
    expect(st).toBe('soddisfatta');
  });
});

describe('R2-D4, Q033, Q052: gli stati si vedono sul tombolo', () => {
  it('g13: i malati hanno il segno della febbre sul fuso e nella scheda', () => {
    const lv = level('g13');
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna', needsNome: false }), { computed: computed('g13'), solveAsync: syncSolve });
    const sick = c.session.state.holders.febbre ?? [];
    expect(sick.length).toBeGreaterThan(0);
    for (const t of sick) expect(c.overlay.fever(t)).toBe(true);
    const healthy = c.session.state.pos.find((t) => !sick.includes(t))!;
    expect(c.overlay.fever(healthy)).toBe(false);
    c.openCharCard(sick[0]!);
    expect(q('tb-scheda-stato')?.textContent).toContain('Ha la febbre');
  });

  it('la scheda dice che cosa porta un filo (anche su touch)', () => {
    const lv = fixture('g00');
    c = new NightController(h.s, nightParams(lv), { computed: null, solveAsync: syncSolve });
    const holder = c.session.state.holders.L1?.[0] as string;
    c.openCharCard(holder);
    expect(q('tb-scheda-stato')?.textContent).toMatch(/^Porta /);
  });

  it('annodato: segno sul fuso e riga nella scheda', () => {
    const lv = fixture('test-rancore');
    c = new NightController(h.s, nightParams(lv), { computed: null, solveAsync: syncSolve });
    // Teresa e Marta si incrociano: nodo, nella riga dopo non si muovono.
    expect(c.cross(0, 'R', 'debug')).toBeNull();
    expect(c.fix().ok).toBe(true);
    expect(c.session.state.knotted).toContain('teresa');
    expect(c.overlay.knotted('teresa')).toBe(true);
    expect(c.overlay.knotted('piero')).toBe(false);
    c.openCharCard('teresa');
    expect(q('tb-scheda-stato')?.textContent).toContain('annodato');
  });
});
