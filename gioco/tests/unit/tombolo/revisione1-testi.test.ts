/**
 * Revisione 1: testi generati dal tombolo (TOM-06, TOM-14; C13, C16, D08).
 * Lettere con il destinatario (numerate se più d'una per la stessa persona),
 * finestre orarie di `incontra`, modelli per tipo di perlina, `almeno` compattato,
 * ore inglesi, maiuscola a inizio frase, violazioni di nodo, marea, filo nero e Gino.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Condition, LevelDef, Violation } from '../../../src/core/types';
import { createI18n, loadI18nSources } from '../../../src/core/i18n';
import { loadContent } from '../../../src/content/loader';
import { generate } from '../../../src/engine/generator';
import { dailySpec } from '../../../src/engine/daily';
import { evaluate, createContext, initialState } from '../../../src/engine/index';
import { liberoSpec } from '../../../src/screens/libero';
import { type TextDeps, beadName, capitalizeFirst, describeCondition, formatHour, reportText, violationMessageKey, violationText } from '../../../src/tombolo/text';
import { ROOT } from './helpers';

const content = loadContent();

function deps(level: LevelDef, locale: 'it' | 'en' = 'it'): TextDeps {
  const i18n = createI18n({ sources: loadI18nSources(), locale });
  return { i18n, content, level };
}

/** Livello di prova con due lettere generate per Lunardi, una per Bepi, e una finestra. */
function letters(): LevelDef {
  const lv = JSON.parse(readFileSync(resolve(ROOT, 'src/engine/fixtures/test-grande.json'), 'utf8')) as LevelDef;
  return {
    ...lv,
    threads: [
      { id: 'marta', kind: 'persona', character: 'marta' },
      { id: 'nina', kind: 'persona', character: 'nina' },
      { id: 'bepi', kind: 'persona', character: 'bepi' },
      { id: 'lunardi', kind: 'persona', character: 'lunardi' },
      { id: 'teresa', kind: 'persona', character: 'teresa' },
    ],
    initial: ['marta', 'nina', 'bepi', 'lunardi', 'teresa'].slice(0, lv.columns.length),
    beads: [
      { id: 'Lr', type: 'lettera', holder: 'marta', to: 'lunardi', labelKey: 'tombolo.generato.lettera' },
      { id: 'L1', type: 'lettera', holder: 'nina', to: 'bepi', labelKey: 'tombolo.generato.lettera' },
      { id: 'L2', type: 'lettera', holder: 'bepi', to: 'lunardi', labelKey: 'tombolo.generato.lettera' },
      { id: 'voce:chiacchiera', type: 'voce', holders: ['teresa'], labelKey: 'tombolo.generato.voce' },
      { id: 'febbre', type: 'febbre', holders: ['nina'], labelKey: 'tombolo.generato.febbre' },
    ],
    startHour: 6,
    endHour: 12,
  };
}

describe('TOM-06: lettere con il destinatario (P037)', () => {
  const lv = letters();
  const d = deps(lv);

  it('ogni lettera generata nomina il destinatario; due per la stessa persona sono distinte', () => {
    expect(beadName(d, 'L1')).toBe('la lettera per Bepi');
    expect(beadName(d, 'Lr')).toBe('la prima lettera per Lunardi');
    expect(beadName(d, 'L2')).toBe('la seconda lettera per Lunardi');
    expect(describeCondition(d, { t: 'consegnata', bead: 'L1', by: 11 })).toBe('La lettera per Bepi: consegnata entro le 11');
    expect(describeCondition(d, { t: 'consegnata', bead: 'L2', by: 11 })).toBe('La seconda lettera per Lunardi: consegnata entro le 11');
  });

  it('gli avvisi di rischio nominano la lettera', () => {
    const r = reportText(d, { status: 'a_rischio', reasonKey: 'tombolo.cond.rischio.consegnata', params: { perlina: 'Lr', ora: 12 } });
    expect(r).toBe('La prima lettera per Lunardi: rischia di non arrivare entro le 12.');
  });

  it('in inglese', () => {
    const e = deps(lv, 'en');
    expect(beadName(e, 'L2')).toBe('the second letter for Lunardi');
    expect(describeCondition(e, { t: 'consegnata', bead: 'L1', by: 20 })).toBe('The letter for Bepi: delivered by 8 pm');
  });

  it('Merletto del giorno del 14/10 e libero gdjm8dc: ogni lettera negli obiettivi ha il destinatario', () => {
    for (const spec of [dailySpec('2026-10-14'), liberoSpec('gdjm8dc', ['senzaDisfa', 'notteCorta'])]) {
      const g = generate(spec).level;
      const gd = deps(g);
      const texts: string[] = [];
      for (const b of g.beads.filter((x) => x.type === 'lettera')) {
        const name = beadName(gd, b.id);
        const to = b.to ? (content.characters.get(b.to as never) ? gd.i18n.t(content.characters.get(b.to as never)!.nameKey) : '') : '';
        expect(name, `${g.id} ${b.id}`).toContain(to);
        texts.push(name);
      }
      expect(new Set(texts).size, g.id).toBe(texts.length);
      for (const c of g.goals ?? []) expect(describeCondition(gd, c)).not.toMatch(/Una lettera/);
    }
  });
});

describe('TOM-06: finestre orarie di incontra (P038)', () => {
  const lv = letters();
  const d = deps(lv);
  const c: Condition = { t: 'incontra', a: 'bepi', b: 'lunardi', from: 7, to: 10 };

  it('l\'obiettivo dice la finestra', () => {
    expect(describeCondition(d, c)).toBe('Bepi incontra Lunardi fra le 7 e le 10');
    expect(describeCondition(d, { t: 'nonIncontra', a: 'bepi', b: 'lunardi', from: 7, to: 10 })).toBe('Bepi non incontra Lunardi fra le 7 e le 10');
    expect(describeCondition(d, { t: 'sopra', a: 'bepi', b: 'lunardi', to: 9 })).toBe('Bepi passa sopra Lunardi entro le 9');
    expect(describeCondition(d, { t: 'incontra', a: 'bepi', b: 'lunardi' })).toBe('Bepi incontra Lunardi');
  });

  it('il fallimento dice «entro le 10», con i parametri del motore e anche senza', () => {
    const ctx = createContext(lv, {});
    const st = initialState(lv, ctx);
    const timeline = [st];
    for (let h = 7; h <= 10; h++) timeline.push({ ...st, hour: h });
    const [rep] = evaluate(lv, timeline, timeline.slice(1).map(() => []), [c], ctx, false);
    expect(rep?.status).toBe('fallita');
    expect(reportText(d, rep!, c)).toBe('Bepi non ha incontrato Lunardi entro le 10.');
    // Senza dalle/alle (motore di prima): la finestra si legge dalla condizione.
    expect(reportText(d, { status: 'fallita', reasonKey: 'tombolo.cond.fallita.incontra', params: { a: 'bepi', b: 'lunardi' } }, c)).toBe('Bepi non ha incontrato Lunardi entro le 10.');
    expect(reportText(deps(lv, 'en'), rep!, c)).toBe("Bepi didn't meet Lunardi by 10 am.");
  });
});

describe('TOM-14: modelli per tipo di perlina, almeno compattato, maiuscola (D08)', () => {
  const lv = letters();
  const d = deps(lv);

  it('ha / nonHa per tipo di perlina', () => {
    expect(describeCondition(d, { t: 'ha', who: 'bepi', bead: 'L2', by: 11 })).toBe('Bepi riceve la seconda lettera per Lunardi entro le 11');
    expect(describeCondition(d, { t: 'ha', who: 'marta', bead: 'voce:chiacchiera', by: 10 })).toBe('Marta sente la chiacchiera entro le 10');
    expect(describeCondition(d, { t: 'ha', who: 'marta', bead: 'letta:L1', by: 10 })).toBe('Marta conosce il segreto della lettera per Bepi entro le 10');
    expect(describeCondition(deps(lv, 'en'), { t: 'ha', who: 'marta', bead: 'letta:L1', by: 10 })).toBe('Marta learns the secret in the letter for Bepi by 10 am');
    expect(describeCondition(d, { t: 'ha', who: 'marta', bead: 'nome', by: 12 })).toBe('Marta ricorda il nome di Ada entro le 12');
    expect(describeCondition(d, { t: 'nonHa', who: 'marta', bead: 'febbre' })).toBe('Marta non si ammala mai');
    expect(describeCondition(d, { t: 'nonHa', who: 'marta', bead: 'voce:chiacchiera' })).toBe('Marta non sente mai la chiacchiera');
    expect(reportText(d, { status: 'fallita', reasonKey: 'tombolo.cond.fallita.ha', params: { chi: 'bepi', perlina: 'L1', ora: 11 } })).toBe('Bepi non ha ricevuto la lettera per Bepi entro le 11.');
    expect(reportText(d, { status: 'fallita', reasonKey: 'tombolo.cond.fallita.nonHa', params: { chi: 'nina', perlina: 'febbre' } })).toBe('Nina ha preso la febbre.');
  });

  it('almeno con parti dello stesso tipo si compatta (P112)', () => {
    const c: Condition = {
      t: 'almeno',
      n: 3,
      of: ['teresa', 'marta', 'bepi', 'nina', 'lunardi'].map((w) => ({ t: 'ha', who: w, bead: 'voce:chiacchiera', by: 12 }) as Condition),
    };
    expect(describeCondition(d, c)).toBe('Almeno 3 fra Teresa, Marta, Bepi, Nina e Lunardi sentono la chiacchiera (entro le 12)');
    const mixed: Condition = { t: 'almeno', n: 1, of: [{ t: 'resta', who: 'bepi' }, { t: 'sano', who: 'nina' }] };
    expect(describeCondition(d, mixed)).toMatch(/^Almeno 1 fra: /);
  });

  it('maiuscola a inizio frase anche dopo le virgolette', () => {
    expect(capitalizeFirst('la lettera per Zeno')).toBe('La lettera per Zeno');
    expect(capitalizeFirst('«no.» Marta')).toBe('«No.» Marta');
    expect(capitalizeFirst('')).toBe('');
  });

  it('ore inglesi «8 pm» e «noon»', () => {
    const e = deps(lv, 'en');
    expect(formatHour(e, 20)).toBe('8 pm');
    expect(formatHour(e, 12)).toBe('noon');
    expect(formatHour(e, 7)).toBe('7 am');
    expect(formatHour(d, 20)).toBe('20');
  });
});

describe('TOM-14: violazioni di nodo, marea, filo nero e Gino (C13; P093, P094, P118)', () => {
  const lv = letters();
  const d = deps(lv);
  const v = (code: Violation['code'], params: Record<string, string | number>): Violation => ({ code, messageKey: `tombolo.violazione.${code}`, params });

  it('bloccato distingue nodo e marea, occupato nomina il filo nero', () => {
    expect(violationMessageKey(d, v('bloccato', { chi: 'bepi', causa: 'nodo' }))).toBe('tombolo.violazione.bloccato.nodo');
    expect(violationText(d, v('bloccato', { chi: 'bepi', causa: 'nodo' }))).toBe('Il filo di Bepi è annodato: in quest\'ora non si muove.');
    expect(violationText(d, v('bloccato', { chi: 'bepi', causa: 'marea' }))).toBe('Con l\'acqua alta, il filo di Bepi non si muove.');
    expect(violationText(d, v('occupato', { a: 'bepi', b: 'marta', nero: 'nina' }))).toBe('Nina si muove da solo: non si può incrociare.');
    expect(violationMessageKey(d, v('bloccato', { chi: 'bepi' }))).toBe('tombolo.violazione.bloccato');
  });

  it('Gino fermo un\'ora: il messaggio nomina il vicino (o ne fa a meno)', () => {
    expect(violationText(d, v('corre', { chi: 'bepi', vicino: 'marta' }))).toBe('Bepi è stato fermo un\'ora: adesso deve incrociare (può con Marta).');
    expect(violationMessageKey(d, v('corre', { chi: 'bepi' }))).toBe('tombolo.violazione.correSolo');
  });
});

describe('preposizione articolata (il segreto della lettera)', () => {
  it('davanti agli articoli italiani, e «di» senza articolo', async () => {
    const { articolata } = await import('../../../src/tombolo/text');
    expect(articolata('di', 'la lettera per Bepi')).toBe('della lettera per Bepi');
    expect(articolata('di', 'il nome del dottore')).toBe('del nome del dottore');
    expect(articolata('di', "l'eco del Faro")).toBe("dell'eco del Faro");
    expect(articolata('di', 'lettera')).toBe('di lettera');
    expect(articolata('di', 'le voci')).toBe('delle voci');
  });
});
