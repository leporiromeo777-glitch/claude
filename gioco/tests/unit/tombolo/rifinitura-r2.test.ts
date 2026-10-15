// @vitest-environment happy-dom
/**
 * Rifinitura della revisione 2 (residui dei verificatori, tombolo):
 * - Q005: «1 braccio usato» al singolare nella matassa letta dai lettori di schermo;
 * - Q022 nella scheda del personaggio: chi ha stranezze note che stanotte non
 *   contano non è «senza stranezze note»;
 * - Q012: quando le richieste non stanno insieme, prima della prima ora la Spinta
 *   offre anche «Torna alla sera» (se chi ha aperto la notte lo permette);
 * - Q014: lasciar cadere uno spillo emette night:drop.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n, type I18nSource } from '../../../src/core/i18n';
import type { AcceptedRequest, CharacterId, Condition, ContentDB, DiaryEntryDef, LevelComputed, LevelDef, NoteId, SolveRequest, SolveResult, Viewport } from '../../../src/core/types';
import { computeViewport } from '../../../src/core/viewport';
import { NightController } from '../../../src/tombolo/controller';
import { setNightHooks } from '../../../src/tombolo/active';
import { popupClock } from '../../../src/tombolo/ui/popup';
import { dormantQuirks, shownQuirks } from '../../../src/tombolo/quirks';
import { charCard } from '../../../src/tombolo/ui/charcard';
import { ROOT, fixture, fixtureComputed, nightParams } from './helpers';
import { type Harness, harness } from './harness';

const src = (locale: 'it' | 'en'): I18nSource => ({
  locale,
  ns: 'tombolo',
  path: `src/i18n/${locale}/tombolo.json`,
  data: JSON.parse(readFileSync(resolve(ROOT, `src/i18n/${locale}/tombolo.json`), 'utf8')) as unknown,
});

describe('Rifinitura R2: matassa e scheda', () => {
  it('Q005: la matassa dice «1 braccio usato» e «3 braccia usate»', () => {
    const i18n = createI18n({ sources: [src('it'), src('en')], locale: 'it' });
    expect(i18n.t('tombolo.hud.matassaAria', { usata: 1, totale: 12 })).toBe('Matassa: 1 braccio usato su 12');
    expect(i18n.t('tombolo.hud.matassaAria', { usata: 3, totale: 12 })).toBe('Matassa: 3 braccia usate su 12');
    expect(i18n.t('tombolo.hud.matassaAria', { usata: 0, totale: 12 })).toBe('Matassa: 0 braccia usate su 12');
    i18n.setLocale('en');
    expect(i18n.t('tombolo.hud.matassaAria', { usata: 1, totale: 12 })).toBe('Thread: 1 of 12 lengths used');
    expect(i18n.t('tombolo.scheda.nessunaStranezzaStanotte')).toBe('No known quirk that matters tonight.');
  });

  it('stranezze dormienti: nella storia solo quelle già nel Taccuino, nelle modalità extra tutte quelle non attive', () => {
    const diary: Pick<ContentDB, 'diary'> = {
      diary: new Map<string, DiaryEntryDef>([
        ['persone.gino.corre', { id: 'persone.gino.corre', section: 'persone', character: 'gino', textKey: 'x', unlock: { knows: 'quirk', id: 'ginoCorre' } }],
      ]),
    };
    const known = { quirks: ['ginoCorre'] as never[], diary: ['persone.gino.corre'] };
    const unknown = { quirks: [] as never[], diary: [] };
    // Stanotte la stranezza di Gino non conta (non è fra quelle attive del livello).
    expect(shownQuirks('campagna', 'gino', ['ginoCorre'], [], known, diary)).toEqual([]);
    expect(dormantQuirks('campagna', 'gino', ['ginoCorre'], [], known, diary)).toEqual(['ginoCorre']);
    expect(dormantQuirks('campagna', 'gino', ['ginoCorre'], [], unknown, diary)).toEqual([]);
    expect(dormantQuirks('giornaliero', 'gino', ['ginoCorre'], [], unknown, diary)).toEqual(['ginoCorre']);
    // Attiva: non è dormiente.
    expect(dormantQuirks('giornaliero', 'gino', ['ginoCorre'], ['ginoCorre'], unknown, diary)).toEqual([]);
  });

  it('Q022 nella scheda: con stranezze note che stanotte non contano dice «Nessuna stranezza nota che conti stanotte.»', () => {
    const base = { thread: 'gino', nameText: 'Gino', roleKey: null, color: '#c33', icon: null, kind: 'persona' as const, quirks: [], desireKey: null, memoria: null };
    const sleepy = charCard({ ...base, dormant: 1 });
    const none = charCard({ ...base, dormant: 0 });
    const q = (n: HTMLElement) => n.querySelector<HTMLElement>('[data-test="tb-scheda-nessuna"]');
    expect(q(sleepy)?.dataset.stanotte).toBe('1');
    expect(q(sleepy)?.querySelector('[data-i18n]')?.getAttribute('data-i18n')).toBe('tombolo.scheda.nessunaStranezzaStanotte');
    expect(q(none)?.dataset.stanotte).toBe('0');
    expect(q(none)?.querySelector('[data-i18n]')?.getAttribute('data-i18n')).toBe('tombolo.scheda.nessunaStranezza');
    // Con una stranezza attiva la riga «nessuna» non c'è.
    expect(q(charCard({ ...base, quirks: ['ginoCorre'], dormant: 0 }))).toBeNull();
  });
});

describe('Rifinitura R2: Spinta con «Torna alla sera» (Q012) e night:drop (Q014)', () => {
  let h: Harness;
  let c: NightController | null = null;
  let now = 1000;
  const marta: Condition = { t: 'presso', who: 'marta', place: 'forno', hour: 6 };
  const piero: Condition = { t: 'presso', who: 'piero', place: 'forno', hour: 6 };
  const two: AcceptedRequest[] = [
    { noteId: 'test.marta' as NoteId, request: marta, author: 'marta' as CharacterId },
    { noteId: 'test.piero' as NoteId, request: piero, author: 'piero' as CharacterId },
  ];
  const has = (goals: readonly Condition[], c0: Condition): boolean => goals.some((g) => JSON.stringify(g) === JSON.stringify(c0));
  /** Solver finto: le due richieste insieme sono impossibili, ognuna da sola no. */
  const stub = (rows: SolveResult['rows']) => async (req: SolveRequest): Promise<SolveResult> => {
    if (has(req.goals, marta) && has(req.goals, piero)) return { status: 'impossibile' } as SolveResult;
    return { status: 'ok', rows } as SolveResult;
  };
  const q = <T extends HTMLElement = HTMLElement>(test: string): T | null => document.querySelector<T>(`[data-test="${test}"]`);

  beforeEach(() => {
    h = harness();
    now = 1000;
    vi.spyOn(popupClock, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    c?.destroy();
    c = null;
    setNightHooks({});
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('prima della prima ora la Spinta offre «Torna alla sera» accanto a «Lascia cadere»', async () => {
    const go = vi.fn();
    let can = true;
    setNightHooks({ backToEvening: { can: () => can, go } });
    c = new NightController(h.s, nightParams(fixture('g00'), { origin: 'campagna', accepted: two }), { computed: null, solveAsync: stub(fixtureComputed('g00').base.rows) });
    const hint = await c.lampTap();
    expect(hint?.textKey).toBe('tombolo.hint.incompatibili');
    expect(q('tb-suggerimento-lascia-test.piero')).not.toBeNull();
    const back = q<HTMLButtonElement>('tb-suggerimento-torna-sera');
    expect(back).not.toBeNull();
    expect(q('tb-suggerimento-torna-sera-testo')).not.toBeNull();
    now += 500;
    back!.click();
    expect(go).toHaveBeenCalledTimes(1);
    // Se nel frattempo non si può più (un'ora fissata), il tocco non fa niente.
    can = false;
    go.mockClear();
    await c.lampTap();
    expect(q('tb-suggerimento-torna-sera')).toBeNull();
  });

  it('senza l\'aggancio della campagna (Merletto del giorno, libero) c\'è solo «Lascia cadere»', async () => {
    c = new NightController(h.s, nightParams(fixture('g00'), { accepted: two }), { computed: null, solveAsync: stub(fixtureComputed('g00').base.rows) });
    await c.lampTap();
    expect(q('tb-suggerimento-lascia-test.piero')).not.toBeNull();
    expect(q('tb-suggerimento-torna-sera')).toBeNull();
  });

  it('lasciare cadere uno spillo emette night:drop una volta sola (Q014)', () => {
    const seen: unknown[] = [];
    h.s.bus.on('night:drop', (p) => seen.push(p));
    c = new NightController(h.s, nightParams(fixture('g00'), { accepted: two }), { computed: null });
    c.drop('test.piero' as NoteId);
    c.drop('test.piero' as NoteId);
    expect(seen).toEqual([{ noteId: 'test.piero', levelId: 'g00' }]);
  });
});

describe('Rifinitura R2: la scheda di un filo sbiadito aperta dal pannello dell\'Archivio (Q028)', () => {
  let h: Harness;
  let c: NightController | null = null;
  beforeEach(() => {
    h = harness();
    vi.spyOn(popupClock, 'now').mockImplementation(() => 1000);
  });
  afterEach(() => {
    c?.destroy();
    c = null;
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('a 1180×820 la scheda sta sul pannello (il merletto resta libero) e il filo si segue nel merletto', () => {
    const v = computeViewport(1180, 820, 2, { top: 0, right: 0, bottom: 0, left: 0 }, 1);
    (h.s as unknown as { viewport: { get: () => Viewport } }).viewport = { get: () => v };
    const lv = JSON.parse(readFileSync(resolve(ROOT, 'src/content/levels/arc3.json'), 'utf8')) as LevelDef;
    const comp = JSON.parse(readFileSync(resolve(ROOT, 'src/content/levels/arc3.computed.json'), 'utf8')) as LevelComputed;
    c = new NightController(h.s, nightParams(lv, { origin: 'archivio', mode: 'archivio' }), { computed: comp });
    c.startPanels();
    expect(c.layout.kind).toBe('largo');
    const t = lv.archive!.faded[0]!;
    document.querySelector<HTMLButtonElement>(`[data-test="tb-ap-filo-${t}"] button`)!.click();
    const pop = document.querySelector<HTMLElement>('[data-test="tb-popup-nomina"]');
    expect(pop).not.toBeNull();
    expect(pop!.dataset.filo).toBe(t);
    const left = c.layout.left!;
    const x = parseFloat(pop!.style.left);
    const w = parseFloat(pop!.style.width);
    // Dentro il pannello di sinistra, non sopra il merletto.
    expect(x).toBeGreaterThanOrEqual(left.x);
    expect(x + w).toBeLessThanOrEqual(left.x + left.w + 0.5);
    expect(x + w).toBeLessThanOrEqual(c.layout.lace.x + 0.5);
    expect((c as unknown as { overlay: { trace: string | null } }).overlay.trace).toBe(t);
    // Chiusa la scheda, il filo non è più evidenziato.
    (c as unknown as { popup: { close(): void } | null }).popup?.close();
    expect((c as unknown as { overlay: { trace: string | null } }).overlay.trace).toBeNull();
  });

  it('toccando il fuso (non dal pannello) la scheda resta dov\'era e il filo si evidenzia lo stesso', () => {
    const lv = JSON.parse(readFileSync(resolve(ROOT, 'src/content/levels/arc3.json'), 'utf8')) as LevelDef;
    c = new NightController(h.s, nightParams(lv, { origin: 'archivio', mode: 'archivio' }), { computed: null });
    const t = lv.archive!.faded[0]!;
    c.openNamePicker(t);
    const pop = document.querySelector<HTMLElement>('[data-test="tb-popup-nomina"]');
    expect(pop?.dataset.posto).toBe('alto');
    expect((c as unknown as { overlay: { trace: string | null } }).overlay.trace).toBe(t);
  });
});
