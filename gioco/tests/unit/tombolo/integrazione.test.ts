// @vitest-environment happy-dom
/**
 * Richieste dell'integrazione (docs/stato/RICHIESTE.md, «Per: tombolo»):
 * notte salvata intatta dopo uno spartito o un Ripassa, nome di Ada
 * dell'autoplay dal .computed.json, arc6 con le occasioni, obiettivi del livello
 * visibili, matassa ed eleganza dell'Archivio, note a margine sui rifiuti di
 * Gino e Zeno, fili di persona senza personaggio.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AcceptedRequest, LevelComputed, LevelDef, NightOutcome, NightParams, NoteId, Violation } from '../../../src/core/types';
import { NightController } from '../../../src/tombolo/controller';
import { Session } from '../../../src/tombolo/session';
import { Tutorial } from '../../../src/tombolo/tutorial';
import { buildVisuals, LINO_COLOR, NEUTRO_COLOR } from '../../../src/tombolo/visuals';
import { buildLaceModel, goalCellsOf } from '../../../src/tombolo/render/model';
import { clearNight, paramsForSave } from '../../../src/tombolo/resume';
import { replayParams } from '../../../src/tombolo/modes/replay';
import { defaultMode, fitMode } from '../../../src/tombolo/modes/autoweave';
import { buildParams } from '../../../src/tombolo/debug';
import { fixture, fixtureComputed, nightParams } from './helpers';
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

/** Notte di un altro livello lasciata a metà (per esempio un Merletto libero). */
function savedOther(): NonNullable<typeof h.data.night> {
  const other = nightParams(fixture('g06'), { origin: 'libero' });
  const night = {
    origin: other.origin,
    params: paramsForSave(other),
    resume: { levelId: 'g06', rows: [{ hour: 7, crossings: [{ pair: 0, over: 'R' as const }] }], draft: [], dropped: [], nomeOn: null, hintsUsed: 0, fantasmaUsed: false },
  };
  h.data.night = night;
  return night;
}

describe('notte salvata e spartiti (priorità 1)', () => {
  it('uno spartito o un Ripassa finito non cancella la notte lasciata a metà', () => {
    const before = JSON.stringify(savedOther());
    const g00 = fixture('g00');
    const rows = fixtureComputed('g00').base.rows;
    c = new NightController(h.s, replayParams(g00, rows, { origin: 'telaio' }), { computed: fixtureComputed('g00') });
    c.skip();
    expect(c.completed).not.toBeNull();
    expect(JSON.stringify(h.data.night)).toBe(before);
  });

  it('nemmeno "Ricomincia" durante uno spartito', () => {
    const before = JSON.stringify(savedOther());
    c = new NightController(h.s, replayParams(fixture('g00'), fixtureComputed('g00').base.rows), { computed: null });
    c.restart();
    expect(JSON.stringify(h.data.night)).toBe(before);
  });

  it('una notte normale finita toglie il suo salvataggio', () => {
    savedOther();
    c = new NightController(h.s, nightParams(fixture('g00'), { origin: 'campagna' }), { computed: fixtureComputed('g00') });
    expect(h.data.night?.params.levelId).toBe('g00');
    c.autoplay(fixtureComputed('g00').base.rows);
    expect(c.completed).not.toBeNull();
    expect(h.data.night).toBeNull();
  });

  it('clearNight con il livello tocca solo il salvataggio di quel livello', () => {
    savedOther();
    clearNight(h.s, 'g00');
    expect(h.data.night?.params.levelId).toBe('g06');
    clearNight(h.s, 'g06');
    expect(h.data.night).toBeNull();
    savedOther();
    clearNight(h.s);
    expect(h.data.night).toBeNull();
  });

  it('chi ascolta night:complete trova la notte già chiusa e non salvata', () => {
    let seen: { completed: boolean; saved: boolean } | null = null;
    h.s.bus.on('night:complete', () => {
      seen = { completed: !!c?.completed, saved: h.data.night !== null };
    });
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: fixtureComputed('g00') });
    c.autoplay(fixtureComputed('g00').base.rows);
    expect(seen).toEqual({ completed: true, saved: false });
    expect(h.events.filter((e) => e.k === 'night:complete')).toHaveLength(1);
    // Chiudere di nuovo non ripete l'annuncio.
    c.finish();
    expect(h.events.filter((e) => e.k === 'night:complete')).toHaveLength(1);
  });
});

describe('autoplay con il nome di Ada (priorità 2)', () => {
  it('g12 con Lunardi: il nome su Lunardi dal .computed.json, 2 incroci e filo d\'oro', async () => {
    const p: NightParams = nightParams(level('g12'), { origin: 'campagna', accepted: accepted('g12.lunardi'), needsNome: true });
    c = new NightController(h.s, p, { computed: computed('g12') });
    expect(c.session.precomputedNomeOn()).toBe('lunardi');
    const out = (await c.autoplay()) as NightOutcome;
    expect(out).not.toBeNull();
    expect(out.nomeOn).toBe('lunardi');
    expect(out.requests).toEqual([{ noteId: 'g12.lunardi', status: 'soddisfatta' }]);
    expect(out.metrics.incroci).toBe(2);
    expect(out.metrics.filoDOro).toBe(true);
  });

  it('senza un filo indicato resta il primo filo che non è un lino', async () => {
    const p: NightParams = nightParams(level('g12'), { origin: 'campagna', accepted: accepted('g12.bepi'), needsNome: true });
    c = new NightController(h.s, p, { computed: computed('g12') });
    expect(c.session.precomputedNomeOn()).toBeNull();
    const out = (await c.autoplay()) as NightOutcome;
    expect(out.nomeOn).toBe('bepi');
  });

  it('righe precalcolate per un altro filo del nome non si usano', () => {
    const lv = level('g12');
    const comp = structuredClone(computed('g12')) as LevelComputed;
    const base = comp.perNote['g12.bepi'];
    if (!base?.rows) throw new Error('g12.bepi senza righe');
    comp.perNote['g12.bepi'] = { incroci: base.incroci, rows: base.rows, nomeOn: 'lunardi' };
    const s = new Session(nightParams(lv, { accepted: accepted('g12.bepi'), needsNome: true }), { computed: comp });
    s.setNome('lunardi');
    expect(s.precomputed()).not.toBeNull();
    const s2 = new Session(nightParams(lv, { accepted: accepted('g12.bepi'), needsNome: true }), { computed: comp });
    s2.setNome('marta');
    expect(s2.precomputed()).toBeNull();
  });
});

describe('arc6: Archivio con le occasioni (priorità 3)', () => {
  it('il modo è "occasioni" (debug, scena, campagna)', async () => {
    const arc6 = level('arc6');
    expect(defaultMode(arc6)).toBe('occasioni');
    expect(fitMode(arc6, 'archivio')).toBe('occasioni');
    expect(fitMode(level('arc1'), 'archivio')).toBe('archivio');
    expect(defaultMode(level('arc1'))).toBe('archivio');
    expect(defaultMode(level('fin_seppia'))).toBe('controllato');
    expect(defaultMode(level('g05'))).toBe('normale');
    const p = await buildParams(h.s, { level: 'arc6' });
    expect(p?.mode).toBe('occasioni');
  });

  it('autoplay: nomi giusti, occasioni del .computed.json, rammendato', async () => {
    const arc6 = level('arc6');
    c = new NightController(h.s, nightParams(arc6, { origin: 'archivio', mode: 'occasioni' }), { computed: computed('arc6') });
    c.computedRef = computed('arc6');
    const out = (await c.autoplay()) as NightOutcome;
    expect(out).not.toBeNull();
    expect(out.archive).toEqual({ named: true, mended: true });
    expect(out.goals.every((g) => g.status === 'soddisfatta')).toBe(true);
  });

  it('a mano: contatore di nomi e occasioni, echi dopo il rammendo, "Chiudi il merletto"', () => {
    const arc6 = level('arc6');
    const comp = computed('arc6') as LevelComputed;
    c = new NightController(h.s, nightParams(arc6, { origin: 'archivio', mode: 'occasioni' }), { computed: comp });
    const info = (): string | undefined => document.querySelector<HTMLElement>('[data-test="tb-req-info"] [data-i18n]')?.dataset.i18n;
    const main = (): string | undefined => document.querySelector<HTMLElement>('[data-test="tb-fissa"] .core-btn-label')?.dataset.i18n;
    expect(info()).toBe('tombolo.archivio.contatoreOccasioni');
    expect(document.querySelector('[data-test="tb-req-info"]')?.textContent).toMatch(/Occasioni 0\/2/);
    for (const t of c.session.archive?.faded() ?? []) c.name(t, arc6.archive?.answer[t] ?? null);
    expect(info()).toBe('tombolo.occasioni.contatore');
    c.setOccasions(comp.occasionsSolution ?? []);
    expect(c.margin.current).toBe('atto3.arc6.tutorial');
    c.run();
    // La nota su come si piantano le occasioni non copre la giornata che accade.
    expect(c.margin.current).toBe('');
    for (let i = 0; i < 60 && c.isBusy(); i++) c.update(1);
    expect(c.session.done).toBe(true);
    expect(h.haptics).toContain('successo');
    // Riuscito: la notte aspetta "Chiudi il merletto", intanto gli echi si leggono.
    expect(c.completed).toBeNull();
    expect(main()).toBe('tombolo.azioni.chiudi');
    expect(info()).toBe('tombolo.archivio.fatto');
    const echo = arc6.archive?.echoes[0];
    if (echo) expect(c.echo(echo.hour, echo.pair)).toBe(echo.textKey);
    c.mainAction();
    expect(c.completed?.archive).toEqual({ named: true, mended: true });
    expect(h.events.filter((e) => e.k === 'night:complete')).toHaveLength(1);
  });

  it('senza le occasioni giuste non è rammendato e si può riprovare', () => {
    const arc6 = level('arc6');
    c = new NightController(h.s, nightParams(arc6, { origin: 'archivio', mode: 'occasioni' }), { computed: computed('arc6') });
    c.run();
    for (let i = 0; i < 60 && c.isBusy(); i++) c.update(1);
    expect(c.session.done).toBe(true);
    expect(c.completed).toBeNull();
    const s = c.session;
    expect(s.outcome().archive?.mended).toBe(false);
  });
});

describe('obiettivi obbligatori visibili (priorità 4)', () => {
  const cases: [string, RegExp][] = [
    ['g04', /Bepi parte alle 7/],
    ['g12', /Bepi parte alle 9/],
    ['g17', /Zeno resta/],
  ];
  for (const [id, text] of cases) {
    it(`${id}: gettone d'ottone con il testo dell'obiettivo`, () => {
      c = new NightController(h.s, nightParams(level(id), { origin: 'campagna', needsNome: id !== 'g04' }), { computed: computed(id) });
      const tok = document.querySelector<HTMLElement>('[data-test="tb-obiettivo-0"]');
      expect(tok).not.toBeNull();
      expect(tok?.getAttribute('aria-label')).toMatch(text);
      expect(tok?.classList.contains('tb-token--obiettivo')).toBe(true);
      c.openRequest('obiettivo:0');
      expect(document.querySelector('[data-test="tb-obiettivo"]')?.textContent).toMatch(text);
    });
  }

  it('g04 e g12: spillo d\'ottone di Bepi al Molo all\'ora della barca', () => {
    for (const [id, hour] of [['g04', 7], ['g12', 9]] as const) {
      const lv = level(id);
      expect(goalCellsOf(lv, lv.goals?.[0] as never)).toEqual([{ who: 'bepi', place: 'molo', hour }]);
      const s = new Session(nightParams(lv));
      const visuals = buildVisuals(lv, h.s.content.characters);
      const m = buildLaceModel({ session: s, visuals, visualsVersion: 0, gradi: [], placingOccasions: false, echoesOpen: false }, null);
      const pin = m.pins.find((p) => p.kind === 'ottone' && p.col === 0 && p.index === hour - lv.startHour);
      expect(pin, id).toBeDefined();
      expect(pin?.icon).toBe(visuals.get('bepi')?.icon);
    }
  });

  it('g04 all\'apertura l\'obiettivo è a rischio, non già fallito', () => {
    const lv = level('g04');
    const s = new Session(nightParams(lv, { origin: 'campagna' }));
    expect(s.goalStatus()[0]).toEqual({ status: 'a_rischio', reasonKey: 'tombolo.cond.rischio.parte', params: { chi: 'bepi', ora: 7 } });
    // Bepi incrocia Nina e va al Molo: con la riga in anteprima è fatta.
    expect(s.propose({ pair: 0, over: 'R' })).toBeNull();
    expect(s.goalStatus()[0]?.status).toBe('soddisfatta');
    s.remove(0);
    // Fissata senza Bepi al Molo: ora sì, fallita.
    expect(s.fix().ok).toBe(true);
    expect(s.goalStatus()[0]?.status).toBe('fallita');
    expect(s.goalStatus()[0]?.reasonKey).toBe('tombolo.cond.fallita.parte');
  });

  it('una richiesta che fallirebbe solo con la bozza è a rischio (nonIncontra senza motivo scritto)', () => {
    const lv = fixture('g00');
    const s = new Session(nightParams(lv, { accepted: [{ noteId: 'n', request: { t: 'nonIncontra', a: 'teresa', b: 'marta' }, author: 'marta' }] }));
    const pos = s.state.pos;
    const pair = pos.findIndex((t, i) => (t === 'teresa' && pos[i + 1] === 'marta') || (t === 'marta' && pos[i + 1] === 'teresa'));
    expect(pair).toBeGreaterThanOrEqual(0);
    // Marta non passa sotto: sta sopra lei.
    expect(s.propose({ pair, over: pos[pair] === 'marta' ? 'L' : 'R' })).toBeNull();
    expect(s.requestStatus()[0]?.report.status).toBe('a_rischio');
    expect(s.fix().ok).toBe(true);
    expect(s.requestStatus()[0]?.report.status).toBe('fallita');
  });

  it('g17: "resta" non ha una cella, solo il gettone', () => {
    const lv = level('g17');
    expect(goalCellsOf(lv, lv.goals?.[0] as never)).toEqual([]);
  });
});

describe('Archivio: matassa ed eleganza contano solo il rammendo (priorità 5)', () => {
  it('arc3 in autoplay: matassa 2/2 anche dopo la riga registrata delle 11, filo d\'oro', async () => {
    c = new NightController(h.s, nightParams(level('arc3'), { origin: 'archivio', mode: 'archivio' }), { computed: computed('arc3') });
    const out = (await c.autoplay()) as NightOutcome;
    expect(out).not.toBeNull();
    expect(c.session.matassa()).toEqual({ used: 2, total: 2 });
    expect(out.archive).toEqual({ named: true, mended: true });
    expect(out.metrics.incroci).toBe(2);
    expect(out.metrics.minIncroci).toBe(2);
    expect(out.metrics.filoDOro).toBe(true);
    // Lo spartito ha tutto il merletto (per Ripassa), non solo il rammendo.
    expect(out.rows).toHaveLength(level('arc3').endHour - level('arc3').startHour);
  });

  it('tutti gli Archivi a strappi: la matassa usata non supera mai il totale', async () => {
    for (const id of ['arc1', 'arc2', 'arc3', 'arc4', 'arc5']) {
      const lv = level(id);
      const s = new Session(nightParams(lv, { origin: 'archivio', mode: 'archivio' }), { computed: computed(id), balance: h.s.content.balance });
      for (const r of lv.archive?.recorded ?? []) {
        if (s.done || r.hour !== s.hour) continue;
        for (const x of r.crossings) if (!x.forced) expect(s.propose({ pair: x.pair, over: x.over }), `${id} ${r.hour}`).toBeNull();
        expect(s.fix().ok, `${id} ${r.hour}`).toBe(true);
        expect(s.matassa().used, `${id} ${r.hour}`).toBeLessThanOrEqual(lv.matassa);
      }
      expect(s.done, id).toBe(true);
      const o = s.outcome();
      expect(o.metrics.incroci, id).toBe(computed(id)?.base.incroci);
      expect(o.metrics.filoDOro, id).toBe(true);
    }
  });
});

describe('note a margine sui rifiuti (priorità 6)', () => {
  it('"rifiuto" parte anche quando Gino non sta fermo o Zeno non lascia il Faro', () => {
    for (const code of ['rifiuto', 'corre', 'faro'] as Violation['code'][]) {
      const shown: string[] = [];
      const t = new Tutorial([{ k: 'margine', when: 'rifiuto', textKey: 'nota' }], { margin: (k) => shown.push(k) });
      t.onViolation({ code, messageKey: 'x' }, 7);
      t.onViolation({ code, messageKey: 'x' }, 8);
      expect(shown, code).toEqual(['nota']);
    }
    const shown: string[] = [];
    const t = new Tutorial([{ k: 'margine', when: 'rifiuto', textKey: 'nota' }], { margin: (k) => shown.push(k) });
    t.onViolation({ code: 'matassa', messageKey: 'x' }, 7);
    t.onViolation({ code: 'spillo', messageKey: 'x' }, 7);
    expect(shown).toEqual([]);
  });

  it('g01: la nota di Clotilde compare quando Gino non sta fermo', () => {
    const lv = level('g01');
    c = new NightController(h.s, nightParams(lv, { origin: 'campagna' }), { computed: computed('g01') });
    // Riga vuota: Gino (al centro, con vicini liberi) deve incrociare.
    const res = c.fix();
    expect(res.ok).toBe(false);
    expect(res.violations[0]?.code).toBe('corre');
    expect(c.margin.current).toBe('atto1.g01.margine.verso');
  });
});

describe('persona senza personaggio (priorità 7)', () => {
  it('il padre di Marta in arc1 è un filo pieno e neutro, il marinaio resta un lino', () => {
    const lv = level('arc1');
    const v = buildVisuals(lv, h.s.content.characters);
    const padre = v.get('padre');
    expect(padre?.kind).toBe('persona');
    expect(padre?.width).toBe(6);
    expect(padre?.color).toBe(NEUTRO_COLOR);
    expect(padre?.pattern).toBe('liscio');
    expect(padre?.icon).toBeNull();
    const lino = v.get('lino1');
    expect(lino?.kind).toBe('lino');
    expect(lino?.width).toBe(3.5);
    expect(lino?.color).toBe(LINO_COLOR);
  });

  it('anche gli altri fili di persona senza personaggio (arc3, arc5)', () => {
    for (const [id, threads] of [['arc3', ['scuola']], ['arc5', ['barcaiolo', 'vedova', 'fornaio', 'prete', 'bambino']]] as const) {
      const v = buildVisuals(level(id), h.s.content.characters);
      for (const t of threads) {
        expect(v.get(t)?.kind, `${id}.${t}`).toBe('persona');
        expect(v.get(t)?.width, `${id}.${t}`).toBe(6);
      }
    }
  });
});
