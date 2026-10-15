// @vitest-environment happy-dom
/**
 * Verifica della revisione 1 del tombolo: difetti trovati provando nel browser
 * con i passi del playtest, dopo la correzione.
 * - riga di stato: maiuscola dopo «Ore 9.» anche con «il filo sbiadito 1» o
 *   «il marinaio» (P012, P082) e ore inglesi («9 am», «noon», D08);
 * - intestazione delle colonne: il nome accessibile delle colonne a sola icona
 *   cambia lingua con il resto (D16, TOM-05);
 * - striscia delle richieste: la frase intera che non sta su un telefono stretto
 *   lascia il posto alla forma breve, invece di restare tagliata a metà parola;
 * - nota a margine: a merletto d'Archivio nominato e rammendato non copre le
 *   righe degli echi (D04, D05.7: «Tocca gli incroci: si ricordano»);
 * - occasioni: nessuna anteprima «si compie se fissi l'ora» dove l'ora non la
 *   fissa il giocatore (C07);
 * - bolla dell'ora: dice anche gli spilli d'ottone degli obiettivi di quell'ora.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LevelDef } from '../../../src/core/types';
import { computeViewport } from '../../../src/core/viewport';
import { retranslate } from '../../../src/core/ui/components';
import { NightController } from '../../../src/tombolo/controller';
import { computeTomboloLayout, placeMarginNote, rowBottom, rowTop } from '../../../src/tombolo/layout';
import { Session } from '../../../src/tombolo/session';
import { RequestStrip } from '../../../src/tombolo/ui/requests';
import { popupClock } from '../../../src/tombolo/ui/popup';
import { fixture, fixtureComputed, nightParams } from './helpers';
import { type Harness, harness } from './harness';

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

const q = <T extends HTMLElement = HTMLElement>(test: string): T | null => document.querySelector<T>(`[data-test="${test}"]`);

function setLocale(locale: 'it' | 'en'): void {
  h.s.i18n.setLocale(locale);
  h.data.settings.locale = locale;
  h.s.bus.emit('settings:change', h.data.settings);
}

describe('riga di stato per il lettore di schermo (P012, P082)', () => {
  it('dopo «Ore N.» la frase comincia con la maiuscola, anche con un filo sbiadito', () => {
    c = new NightController(h.s, nightParams(fixture('test-archivio'), { origin: 'archivio', mode: 'archivio' }), { computed: null });
    const it0 = q('tb-stato')?.textContent ?? '';
    expect(it0).toMatch(/^Ore \d+\. Il filo sbiadito \d/);
    expect(it0).not.toMatch(/\. il /);
    setLocale('en');
    const en = q('tb-stato')?.textContent ?? '';
    expect(en).toMatch(/^\d+ (am|pm)\. Faded thread \d/);
  });

  it('a merletto chiuso l\'ora è nel formato della lingua («Lace finished at 9 am»)', () => {
    const lv = fixture('g00');
    c = new NightController(h.s, nightParams(lv), { computed: null });
    for (const r of fixtureComputed('g00').base.rows ?? []) {
      for (const x of r.crossings) c.cross(x.pair, x.over, 'debug');
      expect(c.fix().ok).toBe(true);
    }
    expect(q('tb-stato')?.textContent ?? '').toMatch(new RegExp(`^Merletto chiuso alle ${lv.endHour}\\. [A-Z]`));
    setLocale('en');
    expect(q('tb-stato')?.textContent ?? '').toMatch(/^Lace finished at \d+ (am|pm)\. [A-Z]/);
  });
});

describe('intestazione delle colonne (D16)', () => {
  it('il nome accessibile segue la lingua (anche per le colonne a sola icona)', () => {
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    const cells = Array.from(document.querySelectorAll<HTMLElement>('.tb-header-cell'));
    expect(cells.length).toBe(3);
    for (const cell of cells) expect(cell.dataset.i18nLabel).toMatch(/^comune\.luogo\.\w+\.nome$/);
    const forno = cells[0]!;
    expect(forno.getAttribute('aria-label')).toBe('Forno');
    h.s.i18n.setLocale('en');
    retranslate(document.body);
    expect(forno.getAttribute('aria-label')).toBe(h.s.i18n.t('comune.luogo.forno.nome'));
    expect(forno.getAttribute('aria-label')).not.toBe('Forno');
    expect(forno.title).toBe(forno.getAttribute('aria-label'));
  });
});

describe('striscia delle richieste: la frase che non sta diventa breve', () => {
  function stripWithWidth(width: number): { strip: RequestStrip; info: HTMLElement } {
    const strip = new RequestStrip(() => undefined);
    document.body.appendChild(strip.el);
    const info = strip.el.querySelector<HTMLElement>('[data-test="tb-req-info"]')!;
    // happy-dom non impagina: ~7 px a carattere a 14 px, la larghezza disponibile è `width`.
    Object.defineProperty(info, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(info, 'scrollWidth', {
      configurable: true,
      get: () => Math.round((info.textContent ?? '').length * 7 * ((Number.parseFloat(info.style.fontSize) || 14) / 14)),
    });
    return { strip, info };
  }

  it('telefono stretto: «Tocca gli incroci.» invece di «Nominato e rammendato: t…»', () => {
    const { strip, info } = stripWithWidth(180);
    strip.setInfo('tombolo.archivio.fatto', {}, 'tombolo.archivio.fattoBreve');
    expect(strip.infoShown).toBe('tombolo.archivio.fattoBreve');
    expect(info.textContent).toBe(h.s.i18n.t('tombolo.archivio.fattoBreve'));
    expect(info.scrollWidth).toBeLessThanOrEqual(info.clientWidth + 1);
  });

  it('con spazio la frase resta intera', () => {
    const { strip, info } = stripWithWidth(600);
    strip.setInfo('tombolo.archivio.fatto', {}, 'tombolo.archivio.fattoBreve');
    expect(strip.infoShown).toBe('tombolo.archivio.fatto');
    expect(info.textContent).toBe(h.s.i18n.t('tombolo.archivio.fatto'));
  });

  it('le forme brevi esistono in italiano e in inglese', () => {
    for (const k of ['fattoBreve', 'daRammendareBreve', 'contatoreOccasioniBreve']) {
      for (const loc of ['it', 'en'] as const) {
        h.s.i18n.setLocale(loc);
        expect(h.s.i18n.has(`tombolo.archivio.${k}`), `${loc} ${k}`).toBe(true);
      }
    }
  });
});

describe('nota a margine e righe degli echi (D04, D05.7)', () => {
  const vp = computeViewport(360, 640, 2, { top: 0, right: 0, bottom: 0, left: 0 }, 1);

  it('la nota non copre per intero le righe bloccate: sopra le altre righe o nella fascia', () => {
    const lv = fixture('test-archivio');
    const rows = lv.endHour - lv.startHour;
    const base = computeTomboloLayout(vp, lv.columns.length, rows, {});
    const done = rows + 1;
    const free = placeMarginNote(base, done, [], 300, 40);
    expect(free.mode).toBe('righe');
    const blocked = [1, 2, 3, 4].filter((i) => i <= rows);
    const pl = placeMarginNote(base, done, [], 300, 40, blocked);
    for (const i of blocked) {
      const y0 = base.lace.y + rowTop(base, i);
      const y1 = base.lace.y + rowBottom(base, i);
      if (pl.mode === 'righe') expect(pl.rect.y + pl.rect.h <= y0 || pl.rect.y >= y1, `riga ${i}`).toBe(true);
    }
    expect(['righe', 'fascia']).toContain(pl.mode);
  });

  it('nella regia: a merletto rammendato le righe degli echi entrano negli ostacoli della nota', () => {
    const lv = fixture('test-archivio');
    c = new NightController(h.s, nightParams(lv, { origin: 'archivio', mode: 'archivio' }), { computed: null });
    const a = lv.archive!;
    for (const f of a.faded) c.name(f, a.answer[f] as never);
    for (const r of a.recorded.filter((x) => a.holes.some((hh) => x.hour >= hh.from && x.hour <= hh.to))) {
      for (const x of r.crossings) c.cross(x.pair, x.over, 'debug');
      expect(c.fix().ok).toBe(true);
    }
    expect(c.echoesOpen()).toBe(true);
    expect(c.model.echoes.length).toBeGreaterThan(0);
  });
});

describe('occasioni: nessuna anteprima della riga (C07)', () => {
  it('in modo occasioni gli obiettivi non dicono «si compie se fissi l\'ora»', () => {
    const lv: LevelDef = fixture('test-occasioni');
    // Un obiettivo che la riga vuota delle 7 compirebbe: in modo normale è in anteprima.
    const first = new Session(nightParams(lv)).state.pos[0]!;
    const goals = [{ t: 'presso' as const, who: first, place: lv.columns[0]!, hour: lv.startHour + 1 }];
    const normale = new Session(nightParams(lv, { goals }));
    expect(normale.goalPreview()).toEqual(['soddisfatta']);
    expect(normale.goalStatus()[0]?.status).not.toBe('soddisfatta');
    const s = new Session(nightParams(lv, { mode: 'occasioni', origin: 'libero', goals }));
    const fixed = s.goalStatus().map((r) => r.status);
    expect(fixed[0]).not.toBe('soddisfatta');
    expect(s.goalPreview()).toEqual(fixed);
  });
});

describe('bolla dell\'ora (TOM-12)', () => {
  it('dice anche lo spillo d\'ottone di un obiettivo di quell\'ora', () => {
    const lv = fixture('test-occasioni');
    const goal = (lv.goals ?? []).find((g) => g.t === 'presso');
    expect(goal && goal.t === 'presso').toBe(true);
    if (!goal || goal.t !== 'presso') return;
    expect(lv.pins.some((p) => p.hour === goal.hour && p.thread === goal.who)).toBe(false);
    c = new NightController(h.s, nightParams(lv), { computed: null });
    const l = c.layout;
    const i = goal.hour - lv.startHour;
    c.revealRow(i);
    const y = l.lace.y - c.scroll + (rowTop(l, i) + rowBottom(l, i)) / 2;
    expect(c.showBubbleAt(l.gutterCx, y)).toBe(true);
    const text = q('tb-bolla')?.textContent ?? '';
    expect(text).toContain(`Alle ${goal.hour}`);
    expect(text).toContain('Gino deve essere al Faro');
  });
});

describe('note a margine: quella dell\'ora corrente non aspetta la nota di un\'ora già fissata (D03, D04)', () => {
  it('prologo veloce: alle 7 il primo incrocio mostra subito la sua nota', () => {
    const base = fixture('g00');
    const lv: LevelDef = {
      ...base,
      tutorial: [
        { k: 'margine', when: 'incrocio', hour: 6, textKey: 'tombolo.test.margine' },
        { k: 'margine', when: 'ora', hour: 6, textKey: 'tombolo.test.eco' },
        { k: 'margine', when: 'incrocio', hour: 7, textKey: 'tombolo.test.rivela' },
      ],
    };
    c = new NightController(h.s, nightParams(lv), { computed: null });
    const rows = fixtureComputed('g00').base.rows ?? [];
    const [r6, r7] = rows;
    expect(r6 && r7).toBeTruthy();
    for (const x of r6!.crossings) c.cross(x.pair, x.over, 'debug');
    // Alle 6 una nota alla volta: la seconda della stessa ora resta in coda.
    const first = c.margin.current;
    expect(first).not.toBeNull();
    expect(c.fix().ok).toBe(true);
    // Fissata in meno di 4 s: la nota delle 6 resta finché non serve la nota delle 7…
    expect(c.margin.current).toBe(first);
    c.cross(r7!.crossings[0]!.pair, r7!.crossings[0]!.over, 'debug');
    // …che compare subito, e quella in coda delle 6 non torna più.
    expect(c.margin.current).toBe('tombolo.test.rivela');
    c.closeNote();
    expect(c.margin.visible()).toBe(false);
  });
});
