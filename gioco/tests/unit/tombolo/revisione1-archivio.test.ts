// @vitest-environment happy-dom
/**
 * Revisione 1, P0 dell'Archivio:
 * - TOM-01: su touch il tocco sul fuso apre il selettore senza assegnare un nome
 *   (si apre dopo il click di compatibilità, i tocchi dei primi 350 ms si ignorano);
 * - TOM-02: nomi alla Obra Dinn (niente conteggio dei giusti, conferma a gruppi
 *   di tre, doppioni spostati, «non ancora»);
 * - TOM-03: fili usciti nominabili dal tratto e dall'elenco, «Chiudi» che spiega,
 *   «Ricomincia la notte» che conserva i nomi confermati (riproduzione di P019).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterId, LevelDef, NightParams } from '../../../src/core/types';
import { NightController } from '../../../src/tombolo/controller';
import { ArchiveBook } from '../../../src/tombolo/modes/archive';
import { popupClock } from '../../../src/tombolo/ui/popup';
import { ROOT, fixture, nightParams } from './helpers';
import { type Harness, harness } from './harness';

function level(id: string): LevelDef {
  return JSON.parse(readFileSync(resolve(ROOT, `src/content/levels/${id}.json`), 'utf8')) as LevelDef;
}

let h: Harness;
let c: NightController | null = null;
let now = 1000;

beforeEach(() => {
  h = harness();
  now = 1000;
  vi.spyOn(popupClock, 'now').mockImplementation(() => now);
});
afterEach(() => {
  c?.destroy();
  c = null;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 5));

function archiveParams(lv: LevelDef): NightParams {
  return nightParams(lv, { origin: 'archivio', mode: 'archivio' });
}

/** Centro del fuso della colonna `col` (px CSS). */
function spindle(ctl: NightController, col: number): { x: number; y: number } {
  const l = ctl.layout;
  return { x: l.colCx[col] ?? 0, y: l.spindles.y + l.spindles.h / 2 };
}

describe('TOM-01: Archivio su touch, niente click fantasma (P086)', () => {
  it('un tocco sul fuso apre il selettore dopo il click di compatibilità e nessun nome si assegna', async () => {
    c = new NightController(h.s, archiveParams(fixture('test-archivio')), { computed: null });
    const p = spindle(c, 1);
    const t = c.threadAtColumn(1) as string;
    expect(c.isFadedThread(t)).toBe(true);
    c.interact.onGesture({ k: 'tap', x: p.x, y: p.y, pointer: 'touch', button: 0 });
    // Al pointerup il selettore non c'è ancora: il click di compatibilità cade sul canvas.
    expect(document.querySelector('[data-test="tb-nomina"]')).toBeNull();
    window.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    const picker = document.querySelector('[data-test="tb-nomina"]');
    expect(picker).not.toBeNull();
    // Si apre lontano dal dito: il tocco era sui fusi (in basso), la scheda in cima.
    expect(document.querySelector<HTMLElement>('[data-test="tb-popup-nomina"]')?.dataset.posto).toBe('alto');
    expect(c.session.archive?.tentativeOf(t)).toBeNull();
    expect(c.session.archive?.progress().given).toBe(0);
  });

  it('il click entro 350 ms dall\'apertura è ignorato, dopo vale', async () => {
    c = new NightController(h.s, archiveParams(fixture('test-archivio')), { computed: null });
    const p = spindle(c, 0);
    const t = c.threadAtColumn(0) as string;
    c.interact.onGesture({ k: 'tap', x: p.x, y: p.y, pointer: 'mouse', button: 0 });
    const btn = document.querySelector<HTMLButtonElement>('[data-test="tb-nomina-marta"]');
    expect(btn).not.toBeNull();
    now += 100;
    btn!.click();
    expect(c.session.archive?.tentativeOf(t)).toBeNull();
    expect(document.querySelector('[data-test="tb-nomina"]')).not.toBeNull();
    now += 300;
    btn!.click();
    expect(c.session.archive?.tentativeOf(t)).toBe('marta');
  });

  it('il selettore ha altezza fissa: «Togli il nome» c\'è sempre, disattivato senza nome', () => {
    c = new NightController(h.s, archiveParams(fixture('test-archivio')), { computed: null });
    c.openNamePicker('f1');
    const off = document.querySelector<HTMLButtonElement>('[data-test="tb-nomina-togli"]');
    expect(off).not.toBeNull();
    expect(off!.disabled).toBe(true);
    now += 500;
    document.querySelector<HTMLButtonElement>('[data-test="tb-nomina-teresa"]')!.click();
    c.openNamePicker('f1');
    expect(document.querySelector<HTMLButtonElement>('[data-test="tb-nomina-togli"]')!.disabled).toBe(false);
  });

  it('la pressione lunga sul fuso sbiadito apre il selettore, non la scheda vuota', () => {
    c = new NightController(h.s, archiveParams(fixture('test-archivio')), { computed: null });
    const p = spindle(c, 2);
    c.interact.onGesture({ k: 'longpress', x: p.x, y: p.y, pointer: 'mouse' });
    expect(document.querySelector('[data-test="tb-nomina"]')).not.toBeNull();
    expect(document.querySelector('[data-test="tb-scheda"]')).toBeNull();
  });
});

describe('TOM-02: nomi alla Obra Dinn (P003)', () => {
  const lv = fixture('test-archivio');

  it('un nome sbagliato non cambia nulla di visibile oltre ai nomi dati', () => {
    const b = new ArchiveBook(lv);
    expect(b.progress()).toEqual({ given: 0, total: 4, confirmed: 0 });
    const r = b.name('f1', 'teresa');
    expect(r.confirmed).toEqual([]);
    expect(r.moved).toBeNull();
    expect(r.waiting).toBe(false);
    expect(b.progress()).toEqual({ given: 1, total: 4, confirmed: 0 });
    const right = b.name('f2', 'marta');
    expect(right.confirmed).toEqual([]);
    expect(b.progress().given).toBe(2);
  });

  it('tre giusti si confermano da soli', () => {
    const b = new ArchiveBook(lv);
    b.name('f1', 'marta');
    b.name('f2', 'teresa');
    expect(b.name('f3', 'piero').confirmed).toEqual(['f1', 'f2', 'f3']);
    expect(b.progress()).toEqual({ given: 3, total: 4, confirmed: 3 });
  });

  it('un nome già usato si sposta sul filo nuovo', () => {
    const b = new ArchiveBook(lv);
    b.name('f1', 'teresa');
    const r = b.name('f2', 'teresa');
    expect(r.moved).toBe('f1');
    expect(b.tentativeOf('f1')).toBeNull();
    expect(b.tentativeOf('f2')).toBe('teresa');
    expect(b.progress().given).toBe(1);
  });

  it('un nome confermato non si dà a un altro filo', () => {
    const b = new ArchiveBook(lv);
    b.name('f1', 'marta');
    b.name('f2', 'teresa');
    b.name('f3', 'piero');
    const r = b.name('f4', 'marta');
    expect(r.refused).toBe(true);
    expect(b.tentativeOf('f4')).toBeNull();
    expect(b.confirmedAs('f1')).toBe('marta');
  });

  it('con 4 fili tutti nominati e 2 giusti: «non ancora»', () => {
    const b = new ArchiveBook(lv);
    b.name('f1', 'marta');
    b.name('f2', 'teresa');
    b.name('f3', 'nina');
    const r = b.name('f4', 'piero');
    expect(r.confirmed).toEqual([]);
    expect(r.waiting).toBe(true);
  });

  it('nella regia: il selettore e la striscia dicono «Nomi dati», mai quanti sono giusti', () => {
    c = new NightController(h.s, archiveParams(lv), { computed: null });
    c.name('f1', 'marta');
    c.name('f2', 'nina');
    expect(document.querySelector('[data-test="tb-req-info"]')?.textContent).toBe('Nomi dati: 2 di 4 · si confermano a gruppi di tre giusti');
    c.openNamePicker('f3');
    expect(document.querySelector('[data-test="tb-nomina-dati"]')?.textContent).toBe('Nomi dati: 2 di 4 · si confermano a gruppi di tre giusti');
    // Il nome provvisorio di un altro filo si vede sul candidato: toccandolo si sposta.
    expect(document.querySelector('[data-test="tb-nomina-nina"]')?.textContent).toContain('sul filo 2');
    c.name('f3', 'nina');
    expect(c.explain.key).toBe('tombolo.archivio.spostato');
    expect(document.querySelector('[data-test="tb-explain"]')?.textContent).toBe('Nina ora è sul filo 3.');
    c.name('f2', 'piero');
    c.name('f4', 'teresa');
    expect(c.explain.key).toBe('tombolo.archivio.nonAncora');
    expect(document.querySelector('[data-test="tb-explain"]')?.textContent).toBe('Tre nomi giusti non ci sono ancora.');
  });
});

describe('TOM-03: fili usciti nominabili, Chiudi che spiega, Ricomincia che conserva (P019)', () => {
  /** arc1 tessuto prima di nominare: il filo 3 (Ernesto) esce col vaporetto delle 12. */
  async function arc1Woven(): Promise<NightController> {
    const lv = level('arc1');
    const ctl = new NightController(h.s, archiveParams(lv), { computed: null });
    for (const r of lv.archive?.recorded ?? []) {
      if (ctl.session.done || r.hour !== ctl.session.hour) continue;
      for (const x of r.crossings) if (!x.forced) expect(ctl.cross(x.pair, x.over, 'debug')).toBeNull();
      expect(ctl.fix().ok).toBe(true);
    }
    expect(ctl.session.done).toBe(true);
    return ctl;
  }

  it('Chiudi senza nomi spiega che cosa manca e non chiude', async () => {
    c = await arc1Woven();
    c.mainAction();
    expect(c.completed).toBeNull();
    expect(c.closeReason.key).toBe('tombolo.archivio.manca.nomi');
    expect(document.querySelector('[data-test="tb-archivio-chiudi-motivo"]')?.textContent).toBe('Mancano i nomi dei fili sbiaditi 1, 2, 3 e 4.');
    // Tre nomi giusti: si confermano, resta il filo 3 uscito col vaporetto.
    for (const t of ['f1', 'f2', 'f4']) c.name(t, c.params.level.archive!.answer[t] as CharacterId);
    expect(c.session.archive?.confirmedList()).toEqual(['f1', 'f2', 'f4']);
    expect(c.threadAtColumn(0)).not.toBe('f3');
    c.mainAction();
    expect(c.completed).toBeNull();
    expect(document.querySelector('[data-test="tb-archivio-chiudi-motivo"]')?.textContent).toBe('Manca il nome del filo sbiadito 3.');
  });

  it('il filo 3, uscito alle 12, si nomina toccandone il tratto', async () => {
    c = await arc1Woven();
    for (const t of ['f1', 'f2', 'f4']) c.name(t, c.params.level.archive!.answer[t] as CharacterId);
    // Il tratto del filo 3: una cella della riga delle 12 in cui passa (metà alta, prima dell'uscita).
    const l = c.layout;
    const i = 12 - c.params.level.startHour;
    const col = c.session.timeline[i - 1]?.pos.indexOf('f3') ?? -1;
    expect(col).toBeGreaterThanOrEqual(0);
    expect(c.threadInCell(i, col, false)).toBe('f3');
    c.setScroll(-8);
    const y = c.interact.rowCenterY(i) - l.rowH * 0.25;
    c.interact.onGesture({ k: 'tap', x: (l.colX[col] ?? 0) + l.colW * 0.15, y, pointer: 'mouse', button: 0 });
    expect(document.querySelector<HTMLElement>('[data-test="tb-nomina"]')?.dataset.filo).toBe('f3');
    now += 500;
    document.querySelector<HTMLButtonElement>('[data-test="tb-nomina-ernesto"]')!.click();
    expect(c.session.archive?.allNamed()).toBe(true);
    c.mainAction();
    expect(c.completed?.archive).toEqual({ named: true, mended: true });
  });

  it('il filo 3 si nomina anche dall\'elenco degli obiettivi', async () => {
    c = await arc1Woven();
    for (const t of ['f1', 'f2', 'f4']) c.name(t, c.params.level.archive!.answer[t] as CharacterId);
    c.openGoals();
    const item = document.querySelector<HTMLElement>('[data-test="tb-popup-obiettivi"] [data-test="tb-sbiadito-f3"] button');
    expect(item).not.toBeNull();
    now += 500;
    item!.click();
    expect(document.querySelector<HTMLElement>('[data-test="tb-nomina"]')?.dataset.filo).toBe('f3');
    // I confermati sono nell'elenco con il loro nome, e non si toccano.
    c.openGoals();
    expect(document.querySelector('[data-test="tb-sbiadito-f1"]')?.getAttribute('data-stato')).toBe('nominato');
    expect(document.querySelector('[data-test="tb-sbiadito-f1"] button')).toBeNull();
  });

  it('Ricomincia la notte lascia confermati i nomi già confermati', async () => {
    c = await arc1Woven();
    for (const t of ['f1', 'f2', 'f4']) c.name(t, c.params.level.archive!.answer[t] as CharacterId);
    c.name('f3', 'clotilde');
    let next: NightParams | null = null;
    h.s.scenes.go = (async (_id: string, p?: unknown) => {
      next = p as NightParams;
    }) as typeof h.s.scenes.go;
    c.restart();
    expect(next).not.toBeNull();
    c.destroy();
    c = new NightController(h.s, next!, { computed: null });
    expect(c.session.rows.length).toBeLessThan(c.params.level.endHour - c.params.level.startHour);
    expect(c.session.archive?.confirmedList()).toEqual(['f1', 'f2', 'f4']);
    // Il nome provvisorio sbagliato non resta.
    expect(c.session.archive?.tentativeOf('f3')).toBeNull();
  });
});
