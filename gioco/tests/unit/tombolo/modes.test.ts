import { describe, expect, it } from 'vitest';
import type { LevelDef, OccasionDef, RowResult, SaveData } from '../../../src/core/types';
import { AutoRunner, occasionProblem, occasionSlots, toggleOccasion, allowedAt } from '../../../src/tombolo/modes/autoweave';
import { replayParams, replayStepMs, spartitoParams, RIPASSA_TOTAL_MS } from '../../../src/tombolo/modes/replay';
import { ArchiveBook, archiveActive } from '../../../src/tombolo/modes/archive';
import { clearNight, paramsForSave, resolveComputed, resolveLevel, resumeParams, saveNight } from '../../../src/tombolo/resume';
import { Tutorial } from '../../../src/tombolo/tutorial';
import { Session } from '../../../src/tombolo/session';
import { encodeSpartito } from '../../../src/engine/index';
import { fixture, nightParams } from './helpers';

describe('occasioni (finale aperto, Archivio A6)', () => {
  const lv = fixture('test-occasioni');

  it('massimo occasionSlots, solo nelle celle ammesse, una per cella', () => {
    expect(occasionSlots(lv)).toBe(2);
    const a: OccasionDef = { kind: 'festa', place: 'piazza', hour: 9 };
    expect(occasionProblem(lv, [], a)).toBeNull();
    expect(occasionProblem(lv, [], { kind: 'messa', place: 'piazza', hour: 9 })).toBe('tombolo.occasioni.nonAmmessa');
    expect(occasionProblem(lv, [a], a)).toBe('tombolo.occasioni.occupata');
    const b: OccasionDef = { kind: 'lanterna', place: 'chiesa', hour: 11 };
    const c: OccasionDef = { kind: 'pane', place: 'forno', hour: 8 };
    expect(occasionProblem(lv, [a, b], c)).toBe('tombolo.occasioni.troppe');
    expect(allowedAt(lv, 'piazza', 9)?.kind).toBe('festa');
    expect(allowedAt(lv, 'piazza', 7)).toBeNull();
  });

  it('un tocco pianta, un altro toglie', () => {
    const cell: OccasionDef = { kind: 'festa', place: 'piazza', hour: 9 };
    const r1 = toggleOccasion(lv, [], cell);
    expect(r1.list).toEqual([cell]);
    const r2 = toggleOccasion(lv, r1.list, cell);
    expect(r2.list).toEqual([]);
  });

  it('"Lascia accadere" una riga per passo, al ritmo dell\'animazione', () => {
    const s = new Session(nightParams(lv, { mode: 'occasioni' }));
    s.setOccasions([{ kind: 'festa', place: 'piazza', hour: 9 }, { kind: 'lanterna', place: 'chiesa', hour: 11 }]);
    let done: boolean | null = null;
    const rows: number[] = [];
    const r = new AutoRunner({
      step: () => {
        const x = s.stepAuto();
        if (x?.ok) rows.push(x.state.hour);
        return x;
      },
      stepMs: () => 500,
      onDone: (ok) => (done = ok),
    });
    r.start();
    r.update(0.016);
    expect(rows).toEqual([7]);
    r.update(0.2);
    expect(rows).toEqual([7]);
    r.update(0.4);
    expect(rows).toEqual([7, 8]);
    for (let i = 0; i < 20; i++) r.update(0.5);
    expect(done).toBe(true);
    expect(s.succeeded()).toBe(true);
  });

  it('una riga rifiutata ferma il temporizzatore', () => {
    let done: boolean | null = null;
    const bad: RowResult = { ok: false, state: fixture('g00') as never, events: [], violations: [] };
    const r = new AutoRunner({ step: () => bad, stepMs: () => 0, onDone: (ok) => (done = ok) });
    r.start();
    r.update(0.016);
    expect(done).toBe(false);
    expect(r.running()).toBe(false);
  });
});

describe('spartito e Ripassa', () => {
  const lv = fixture('g00');

  it('Ripassa in 5 secondi, con passi fra 120 e 900 ms', () => {
    expect(replayStepMs(4)).toBe(900);
    expect(replayStepMs(14)).toBe(Math.round(RIPASSA_TOTAL_MS / 14));
    expect(replayStepMs(100)).toBe(120);
    expect(replayStepMs(4, 30)).toBe(30);
  });

  it('spartito valido → parametri in modo replay; corrotto o di un altro livello → null', () => {
    const str = encodeSpartito({ mode: 'S', ref: 'g00', rows: [{ hour: 1, crossings: [{ pair: 0, over: 'R' }] }, { hour: 2, crossings: [{ pair: 1, over: 'L' }] }, { hour: 3, crossings: [] }, { hour: 4, crossings: [{ pair: 0, over: 'L' }] }] });
    const p = spartitoParams(str, lv);
    expect(p?.mode).toBe('replay');
    expect(p?.origin).toBe('spartito');
    expect(p?.replay?.map((r) => r.hour)).toEqual([6, 7, 8, 9]);
    expect(spartitoParams(str.slice(0, -1) + (str.endsWith('a') ? 'b' : 'a'), lv)).toBeNull();
    expect(spartitoParams(str, fixture('test-grande'))).toBeNull();
  });

  it('Ripassa: le righe forzate non si ripetono', () => {
    const p = replayParams(lv, [{ hour: 6, crossings: [{ pair: 0, over: 'R' }, { pair: 1, over: 'L', forced: true }] }], { origin: 'telaio' });
    expect(p.replay).toEqual([{ hour: 6, crossings: [{ pair: 0, over: 'R' }] }]);
    expect(p.origin).toBe('telaio');
  });
});

describe('Archivio: nomi e strappi', () => {
  const lv = fixture('test-archivio');

  it('attivo solo con archive in modo archivio o occasioni', () => {
    expect(archiveActive({ level: lv, mode: 'archivio' })).toBe(true);
    expect(archiveActive({ level: lv, mode: 'normale' })).toBe(false);
    expect(archiveActive({ level: fixture('g00'), mode: 'archivio' })).toBe(false);
  });

  it('quando restano meno di 3 fili basta indovinarli tutti', () => {
    const b = new ArchiveBook(lv);
    b.name('f1', 'marta');
    b.name('f2', 'teresa');
    b.name('f3', 'piero');
    expect(b.confirmedList()).toEqual(['f1', 'f2', 'f3']);
    expect(b.counter()).toEqual({ correct: 0, needed: 1, remaining: 1 });
    expect(b.name('f4', 'clotilde').confirmed).toEqual([]);
    expect(b.name('f4', 'nina').confirmed).toEqual(['f4']);
    expect(b.allNamed()).toBe(true);
  });

  it('un nome fuori dai candidati non si assegna, un filo confermato non cambia', () => {
    const b = new ArchiveBook(lv);
    b.name('f1', 'gino');
    expect(b.tentativeOf('f1')).toBeNull();
    b.name('f1', 'marta');
    b.name('f2', 'teresa');
    b.name('f3', 'piero');
    b.name('f1', 'clotilde');
    expect(b.confirmedAs('f1')).toBe('marta');
  });

  it('strappi, righe registrate, stato atteso', () => {
    const b = new ArchiveBook(lv);
    expect(b.isHoleRow(8)).toBe(true);
    expect(b.isHoleRow(7)).toBe(false);
    expect(b.isHoleStart(8)).toBe(true);
    expect(b.isHoleEnd(9)).toBe(true);
    expect(b.recordedRow(7)?.crossings).toEqual([{ pair: 0, over: 'L' }]);
    expect(b.expectedAt(9)?.pos).toBeDefined();
    expect(b.echoAt(9, 0)).toBe('tombolo.test.eco');
    expect(b.echoAt(9, 1)).toBeNull();
  });
});

describe('salvataggio e ripresa della notte', () => {
  function fakeSave(): { save: { data(): SaveData; update(m: (d: SaveData) => void, o?: { immediate?: boolean }): void }; immediate: boolean[] } {
    const data = { night: null } as unknown as SaveData;
    const immediate: boolean[] = [];
    return {
      immediate,
      save: {
        data: () => data,
        update: (m, o) => {
          m(data);
          immediate.push(!!o?.immediate);
        },
      },
    };
  }

  it('SaveData.night senza il livello, con NightResume; si toglie a notte finita', () => {
    const lv = fixture('g00');
    const p = nightParams(lv, { origin: 'campagna', gradi: ['senzaDisfa'] });
    const s = new Session(p);
    s.propose({ pair: 0, over: 'R' });
    const f = fakeSave();
    saveNight(f as never, p, s.toResume(), true);
    const n = f.save.data().night!;
    expect(n.params.levelId).toBe('g00');
    expect('level' in n.params).toBe(false);
    expect(n.params.gradi).toEqual(['senzaDisfa']);
    expect(n.resume.draft).toEqual([{ pair: 0, over: 'R' }]);
    expect(f.immediate).toEqual([true]);
    clearNight(f as never);
    expect(f.save.data().night).toBeNull();
    expect(paramsForSave(p).levelId).toBe('g00');
  });

  it('il livello si ritrova: contenuti, poi fixture del motore', async () => {
    const lv = fixture('g00');
    const content = { levels: new Map([['g00', lv]]), computed: new Map() };
    expect(await resolveLevel({ content } as never, 'g00')).toBe(lv);
    const empty = { levels: new Map(), computed: new Map() };
    const fx = await resolveLevel({ content: empty } as never, 'test-archivio');
    expect(fx?.id).toBe('test-archivio');
    expect(await resolveLevel({ content: empty } as never, 'non-esiste')).toBeNull();
    const comp = await resolveComputed({ content: empty } as never, 'test-occasioni');
    expect(comp?.occasionsSolution).toHaveLength(2);
  });

  it('resumeParams rimette insieme livello e ripresa', async () => {
    const lv = fixture('test-archivio');
    const p = nightParams(lv, { mode: 'archivio' });
    const s = new Session(p);
    const f = fakeSave();
    saveNight(f as never, p, s.toResume(), false);
    const back = await resumeParams({ save: f.save, content: { levels: new Map(), computed: new Map() } } as never);
    expect(back?.level.id).toBe('test-archivio');
    expect(back?.mode).toBe('archivio');
    expect(back?.resume?.levelId).toBe('test-archivio');
  });
});

describe('tutorial del livello', () => {
  const steps = fixture('g00').tutorial ?? [];

  it('mano fantasma finché non si incrocia in quella riga', () => {
    const t = new Tutorial(steps, { margin: () => undefined });
    expect(t.hand(6, true)).toEqual({ from: 1, to: 0 });
    expect(t.hand(6, false)).toBeNull();
    t.onCross(6, false);
    expect(t.hand(6, true)).toBeNull();
    expect(t.hand(7, true)).toBeNull();
  });

  it('nota a margine una volta sola, all\'ora indicata', () => {
    const shown: string[] = [];
    const t = new Tutorial(steps, { margin: (k) => shown.push(k) });
    t.onCross(6, true);
    expect(shown).toEqual([]);
    t.onCross(7, true);
    t.onCross(7, true);
    expect(shown).toEqual(['atto1.g00.margine.sopraDa']);
  });

  it('"Fissa l\'ora" pulsa quando c\'è qualcosa da fissare', () => {
    const t = new Tutorial(steps, { margin: () => undefined });
    expect(t.pulse(6, true, false)).toBeNull();
    expect(t.pulse(6, false, false)).toBe('fissa');
    expect(t.pulse(7, false, false)).toBeNull();
  });

  it('margine sul rifiuto e sulla prima ora', () => {
    const shown: string[] = [];
    const t = new Tutorial(
      [
        { k: 'margine', when: 'rifiuto', textKey: 'a' },
        { k: 'margine', when: 'primaOra', textKey: 'b' },
      ],
      { margin: (k) => shown.push(k) },
    );
    t.onRowStart(6, true);
    t.onViolation({ code: 'rifiuto', messageKey: 'x' }, 9);
    expect(shown).toEqual(['b', 'a']);
  });
});

describe('livello con autotessitura senza occasioni (forzati del filo nero)', () => {
  it('il filo nero non si trascina', () => {
    const lv: LevelDef = fixture('test-nero');
    const s = new Session(nightParams(lv));
    s.fix();
    s.fix();
    const forced = s.forced();
    expect(forced.length).toBeGreaterThan(0);
    const f = forced[0]!;
    const v = s.propose({ pair: f.pair, over: f.over === 'L' ? 'R' : 'L' });
    expect(v?.code).toBe('forzato');
  });
});
