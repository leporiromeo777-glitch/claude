/**
 * Contenuti dell'Atto I e dati comuni (pacchetto contenuti-atto1).
 *
 * Verifica: validazione senza errori per i file del pacchetto, chiavi italiane,
 * bigliettini, vignette, lunghezze dei testi, battute, Libro dei Punti, campagna,
 * file .computed.json aggiornati e matassa = minimo designato + margine.
 */
import { describe, expect, it } from 'vitest';
import type { CampaignDay, Condition, LevelDef, LineDef, NoteDef, QuirkId, StoryCond } from '../../../src/core/types';
import { hasGlyph } from '../../../src/core/ui/glyphs';
import { loadContent } from '../../../src/content/loader';
import { validateContent } from '../../../src/content/validate';
import { buildCatalogs, loadI18nSources } from '../../../src/core/i18n';
import { CHARACTER_IDS } from '../../../src/core/ids';
import { SOLVER_VERSION, applyRow, createContext, evaluate, levelSourceHashFromDB, simulate, solve } from '../../../src/engine/index';
import diarioAtto1 from '../../../src/content/diary.atto1.json';

const db = loadContent();
/** Campi della campagna introdotti dalla REVISIONE-1 (C04): letti in forma locale, validi anche prima di SCH-01. */
type DayR1 = CampaignDay & { dawnObject?: string; eveningEmptyKey?: string };
const days = (): DayR1[] => db.campaign.days as DayR1[];
const campaignObjects = (): Record<string, { from: string; by?: string }> =>
  (db.campaign as typeof db.campaign & { objects?: Record<string, { from: string; by?: string }> }).objects ?? {};
const catalogs = buildCatalogs(loadI18nSources());
const IT = catalogs.tables.it;
const EN = catalogs.tables.en;
const it_ = (key: string): string => IT.get(key) ?? '';
/** Voci del Taccuino scritte da questo pacchetto (diary.atto1.json). */
const ATTO1_DIARY = new Set((diarioAtto1 as { id: string }[]).map((d) => d.id));

const STORY = ['g00', 'g01', 'g02', 'g03', 'g04', 'g05', 'g06', 'g07', 'g08'] as const;
const DAYS = STORY.filter((d) => d !== 'g00');
const ARCHIVES = ['arc1', 'arc2'] as const;
const MINE = [...STORY, ...ARCHIVES] as string[];
const SPEAKERS = ['teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi', 'livia'] as const;
/** I 7 eventi del merletto di GDD 5.9 (voce = copia, segreto letto = legge, rifiuto = stranezza). */
const LINE_EVENTS = ['incontro', 'consegna', 'copia', 'legge', 'stranezza', 'nodo', 'cura'] as const;

function level(id: string): LevelDef {
  const lv = db.levels.get(id);
  if (!lv) throw new Error(`livello ${id} assente`);
  return lv;
}
/** Flag letti da una condizione di disponibilità (le varianti dei bigliettini usano solo flag e non). */
function flagsIn(c: StoryCond): string[] {
  if ('flag' in c) return [c.flag];
  if ('not' in c) return flagsIn(c.not);
  if ('all' in c) return c.all.flatMap(flagsIn);
  if ('any' in c) return c.any.flatMap(flagsIn);
  return [];
}
function holds(c: StoryCond, on: ReadonlySet<string>): boolean {
  if ('flag' in c) return on.has(c.flag) === (c.eq === undefined ? true : c.eq === true);
  if ('not' in c) return !holds(c.not, on);
  if ('all' in c) return c.all.every((x) => holds(x, on));
  if ('any' in c) return c.any.some((x) => holds(x, on));
  throw new Error(`condizione di disponibilità non prevista: ${JSON.stringify(c)}`);
}
function available(n: NoteDef, on: ReadonlySet<string>): boolean {
  return n.availableIf === undefined || holds(n.availableIf, on);
}
function notesOf(day: string): NoteDef[] {
  return (level(day).notes ?? []).map((id) => {
    const n = db.notes.get(id);
    if (!n) throw new Error(`bigliettino ${id} assente`);
    return n;
  });
}

/** Un errore di validazione riguarda i file di questo pacchetto? */
function isMine(err: string): boolean {
  const where = err.slice(0, err.indexOf(':'));
  if (/^levels\/(g0[0-8]|arc[12])(\b|\.computed|\/)/.test(where)) return true;
  if (/^notes\/g0[0-8]\./.test(where)) return true;
  if (/^lettere\/lettera_L[1-7]$/.test(where)) return true;
  if (/^(characters|places|book|lines)\//.test(where)) return true;
  if (where === 'credits') return true;
  if (where.startsWith('diary/')) {
    const id = where.slice('diary/'.length);
    return db.diary.has(id) && ATTO1_DIARY.has(id);
  }
  if (where.startsWith('campaign')) {
    // I livelli degli Atti II-III e dei finali li scrive un altro pacchetto: la loro assenza non è un errore di questo.
    if (/day without level|final ".*" cites unknown level|archiveAfter cites unknown level/.test(err)) return false;
    // Le frasi delle sere vuote (atto2.g15, atto3.g17) sono testi di contenuti-atti23 (C19).
    if (/\[i18n\] eveningEmptyKey "atto[23]\./.test(err)) return false;
    return true;
  }
  return false;
}
describe('validazione dei contenuti dell\'Atto I e dei dati comuni', () => {
  it('validateContent non dà errori sui file del pacchetto', () => {
    const errors = validateContent(db, { hasKey: (k) => IT.has(k) }).filter(isMine);
    expect(errors).toEqual([]);
  });

  it('ogni chiave di testo dei file del pacchetto esiste in italiano', () => {
    const missing: string[] = [];
    const visit = (o: unknown): void => {
      if (typeof o === 'string') {
        if (/^(atto1|comune)\./.test(o) && !IT.has(o)) missing.push(o);
      } else if (Array.isArray(o)) o.forEach(visit);
      else if (o && typeof o === 'object') Object.values(o).forEach(visit);
    };
    for (const id of MINE) visit(level(id));
    for (const d of DAYS) visit(notesOf(d));
    visit([...db.characters.values()]);
    visit([...db.places.values()]);
    visit(db.book);
    visit(db.lines);
    visit(db.credits);
    visit([...db.diary.values()].filter((d) => ATTO1_DIARY.has(d.id)));
    visit(db.letters.filter((l) => /^lettera_L[1-7]$/.test(l.id)));
    expect(missing).toEqual([]);
  });

  it('il namespace comune è completo anche in inglese; atto1, se presente in inglese, è completo', () => {
    const itKeys = [...IT.keys()];
    expect(itKeys.filter((k) => k.startsWith('comune.') && !EN.has(k))).toEqual([]);
    const enAtto1 = [...EN.keys()].some((k) => k.startsWith('atto1.'));
    if (enAtto1) expect(itKeys.filter((k) => k.startsWith('atto1.') && !EN.has(k))).toEqual([]);
  });

  it('ogni personaggio citato esiste: i 16 CharacterId sono tutti in characters.json', () => {
    expect([...db.characters.keys()].sort()).toEqual([...CHARACTER_IDS].sort());
    const archiveOnly = [...db.characters.values()].filter((c) => c.archiveOnly).map((c) => c.id).sort();
    expect(archiveOnly).toEqual(['aldo', 'anselmo', 'arianna', 'bortolo', 'ernesto']);
    for (const c of db.characters.values()) {
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });

  it('colori, motivi e stranezze del cast come in GDD 5.4', () => {
    const want: Record<string, [string, string, string[]]> = {
      teresa: ['#2F5DA8', 'righe', ['teresaLegge']],
      marta: ['#C0442C', 'puntini', ['martaNoSotto']],
      piero: ['#6E3D96', 'doppio', ['pieroPozzo', 'pieroTrabocca']],
      gino: ['#4FB3E0', 'onde', ['ginoCorre']],
      bepi: ['#E07B24', 'zigzag', []],
      nina: ['#E8C12E', 'tratteggio', ['ninaCuriosa']],
      zeno: ['#1F8A78', 'catenella', ['zenoFaro']],
      lunardi: ['#D9DEE3', 'croce', ['lunardiCura']],
      livia: ['#15110E', 'lucido', []],
      ada: ['#F07C6C', 'perlato', []],
      clotilde: ['#EFE3C8', 'liscio', []],
    };
    for (const [id, [color, pattern, quirks]] of Object.entries(want)) {
      const c = db.characters.get(id as never);
      expect(c?.color.toUpperCase()).toBe(color);
      expect(c?.pattern).toBe(pattern);
      expect(c?.quirks).toEqual(quirks);
    }
  });
});

describe('calligrafie e fili distinguibili (REVISIONE-1 CA1-02)', () => {
  it('Marta scrive in stampatello netto: atkinson, maiuscolo, scala 1,05 (la L non sembra una C)', () => {
    expect(db.characters.get('marta')?.hand).toMatchObject({ font: 'atkinson', caps: true, sizeScale: 1.05 });
  });

  it('in arc3 Aldo ha un motivo e un\'icona che nessun altro filo usa (non solo il colore)', () => {
    const aldo = db.characters.get('aldo');
    expect(aldo).toBeDefined();
    const others = level('arc3').threads.map((t) => t.character).filter((c): c is NonNullable<typeof c> => !!c && c !== 'aldo');
    expect(others.length).toBeGreaterThanOrEqual(4);
    for (const c of others) {
      const o = db.characters.get(c);
      expect(o?.pattern, c).not.toBe(aldo?.pattern);
      expect(o?.icon, c).not.toBe(aldo?.icon);
    }
    expect(hasGlyph(aldo?.icon ?? '')).toBe(true);
  });

  it('nessun livello dell\'Atto I e dei suoi Archivi ha due fili con lo stesso motivo e la stessa icona', () => {
    for (const id of MINE) {
      const cs = [...new Set(level(id).threads.map((t) => t.character).filter((c): c is NonNullable<typeof c> => !!c))].map((c) => db.characters.get(c));
      for (let i = 0; i < cs.length; i++)
        for (let j = i + 1; j < cs.length; j++) {
          const a = cs[i];
          const b = cs[j];
          expect(a?.pattern === b?.pattern && a?.icon === b?.icon, `${id} ${a?.id} ${b?.id}`).toBe(false);
        }
    }
  });
});

describe('giornate dell\'Atto I', () => {
  it('3 bigliettini per sera da g01 a g08 (con ogni combinazione dei flag delle varianti), almeno una risposta per sera', () => {
    for (const d of DAYS) {
      const notes = notesOf(d);
      for (const n of notes) {
        expect(n.day).toBe(d);
        expect(n.request, n.id).toBeDefined();
      }
      const flags = [...new Set(notes.flatMap((n) => (n.availableIf ? flagsIn(n.availableIf) : [])))];
      for (let mask = 0; mask < 1 << flags.length; mask++) {
        const on = new Set(flags.filter((_, i) => mask & (1 << i)));
        const evening = notes.filter((n) => available(n, on));
        expect(evening.length, `${d} ${[...on].join(',')}`).toBe(3);
        expect(new Set(evening.map((n) => n.author)).size, d).toBe(3);
        expect(evening.some((n) => (n.replies ?? []).length === 2), d).toBe(true);
      }
    }
  });

  it('le varianti dei bigliettini (Appendice A): Marta più dura in g02, Teresa più fredda in g03', () => {
    const pairs: [string, string, string][] = [
      ['g02.marta', 'g02.martaDura', 'martaDura'],
      ['g03.teresa', 'g03.teresaFredda', 'teresaFredda'],
    ];
    for (const [base, variant, flag] of pairs) {
      const b = db.notes.get(base) as NoteDef;
      const v = db.notes.get(variant) as NoteDef;
      expect(v.author).toBe(b.author);
      expect(v.request).toEqual(b.request);
      expect(available(b, new Set())).toBe(true);
      expect(available(v, new Set())).toBe(false);
      expect(available(b, new Set([flag]))).toBe(false);
      expect(available(v, new Set([flag]))).toBe(true);
      expect(it_(v.textKey)).not.toBe(it_(b.textKey));
    }
    // Il flag che le attiva nasce dai bigliettini della sera prima.
    const g01marta = db.notes.get('g01.marta') as NoteDef;
    expect(JSON.stringify([...(g01marta.onFail ?? []), ...(g01marta.onIgnore ?? [])])).toContain('"martaDura"');
    const g02teresa = db.notes.get('g02.teresa') as NoteDef;
    expect(JSON.stringify(g02teresa.replies?.find((r) => r.id === 'R1')?.effects)).toContain('"teresaFredda"');
    expect(it_('atto1.g03.teresaFredda.testo')).not.toContain('cara');
  });

  it('ogni risposta ha una conseguenza visibile (Taccuino, desiderio, vignetta o bigliettino dei giorni dopo)', () => {
    const conds: string[] = [];
    for (const lv of db.levels.values()) for (const v of lv.dawn?.candidates ?? []) if (v.when) conds.push(JSON.stringify(v.when));
    for (const d of db.diary.values()) conds.push(JSON.stringify(d.unlock));
    for (const n of db.notes.values()) if (n.availableIf) conds.push(JSON.stringify(n.availableIf));
    const all = conds.join('\n');
    for (const d of DAYS)
      for (const n of notesOf(d))
        for (const r of n.replies ?? []) {
          const direct = r.effects.some((e) => 'diary' in e || 'desire' in e);
          const byReply = all.includes(JSON.stringify({ reply: n.id, is: r.id }));
          const byFlag = r.effects.some((e) => 'setFlag' in e && all.includes(`"flag":"${e.setFlag}"`));
          expect(direct || byReply || byFlag, `${n.id} ${r.id}`).toBe(true);
          for (const e of r.effects) if ('diary' in e) expect(db.diary.has(e.diary), e.diary).toBe(true);
        }
  });

  it('ogni bigliettino citato da un livello esiste, e ogni bigliettino dell\'Atto I è citato dal suo giorno', () => {
    const atto1Notes = [...db.notes.values()].filter((n) => (STORY as readonly string[]).includes(n.day));
    expect(atto1Notes).toHaveLength(26);
    for (const n of atto1Notes) expect(level(n.day).notes).toContain(n.id);
  });

  it('le note a margine del tutorial hanno un innesco che il tombolo riconosce, e la mano mostra una mossa valida', () => {
    for (const d of ['g00', 'g01', 'g02']) {
      const lv = level(d);
      const ctx = createContext(lv, {}, { balance: db.balance });
      const base = db.computed.get(d)?.base.rows ?? [];
      for (const t of lv.tutorial ?? []) {
        if (t.k === 'margine' && t.hour !== undefined) expect(t.hour, `${d} margine`).toBeGreaterThan(lv.startHour);
        if (t.k !== 'mano') continue;
        const before = simulate(lv, ctx, base.filter((r) => r.hour < t.hour));
        const st = before.timeline[before.timeline.length - 1];
        if (!st) throw new Error(d);
        const row = applyRow(lv, st, [{ pair: t.pair, over: t.over }], ctx);
        expect(row.ok, `${d} mano ${t.hour}`).toBe(true);
        const rest = solve({ level: lv, ctx, goals: lv.goals ?? [], from: { state: row.state, rowsDone: [...base.filter((r) => r.hour < t.hour), { hour: t.hour, crossings: [{ pair: t.pair, over: t.over }] }] } });
        expect(rest.status, `${d} mano ${t.hour}: la giornata resta risolvibile`).toBe('ok');
      }
    }
    // In g01 il «No.» di Marta e il Gino che non sta fermo hanno ciascuno la sua nota (codice del rifiuto, C02).
    const g01 = (level('g01').tutorial ?? []).filter((t) => t.k === 'margine' && t.when === 'rifiuto');
    expect(g01.map((t) => (t.k === 'margine' ? [t.codice, t.textKey] : null))).toEqual([
      ['rifiuto', 'atto1.g01.margine.verso'],
      ['corre', 'atto1.g01.margine.gino'],
    ]);
  });

  it('almeno 3 vignette candidate per giornata, con al massimo 3 figure e 2 righe', () => {
    for (const d of STORY) {
      const c = level(d).dawn?.candidates ?? [];
      expect(c.length, d).toBeGreaterThanOrEqual(3);
      expect(c.length, d).toBeLessThanOrEqual(5);
      for (const v of c) {
        expect(v.figures.length).toBeLessThanOrEqual(3);
        expect(v.lines.length).toBeGreaterThanOrEqual(1);
        expect(v.lines.length).toBeLessThanOrEqual(2);
      }
      // Ogni richiesta fallita ha la sua vignetta solo se porta un'informazione nuova: almeno una per giornata.
      if (d !== 'g00') expect(c.some((v) => v.when && JSON.stringify(v.when).includes('"failed"')), d).toBe(true);
    }
  });

  it('almeno un conflitto per sera: una coppia di bigliettini impossibile e voluta', () => {
    for (const d of DAYS) {
      const comp = db.computed.get(d);
      expect(comp?.combos.some((c) => c.incroci === null && c.voluta === true), d).toBe(true);
    }
  });

  it('tutorial con mano, margine e pulsa nel prologo, in g01 e in g02', () => {
    for (const d of ['g00', 'g01', 'g02']) {
      const kinds = new Set((level(d).tutorial ?? []).map((t) => t.k));
      expect([...kinds].sort(), d).toEqual(['mano', 'margine', 'pulsa']);
    }
  });

  it('colonne, ore e fili come nella tabella dell\'Atto I (GDD 5.2)', () => {
    const want: Record<string, [string, number, number, string[]]> = {
      g01: ['MFPC', 6, 11, ['gino', 'marta', 'teresa', 'piero']],
      g02: ['MFPC', 6, 12, ['gino', 'marta', 'teresa', 'piero']],
      g03: ['MFPC', 6, 12, ['nina', 'marta', 'teresa', 'piero']],
      g04: ['MFPCA', 6, 14, ['bepi', 'nina', 'marta', 'teresa', 'piero']],
      g05: ['MFPCAR', 6, 13, ['gino', 'marta', 'teresa', 'piero', 'zeno']],
      g06: ['MFPCAR', 6, 12, ['marta', 'teresa', 'piero', 'nina', 'zeno']],
      g07: ['MFPCAR', 6, 14, ['marta', 'teresa', 'piero', 'nina', 'gino', 'zeno']],
      g08: ['MFPCAR', 6, 16, ['marta', 'teresa', 'piero', 'nina', 'gino', 'zeno']],
    };
    const abbr: Record<string, string> = { molo: 'M', forno: 'F', piazza: 'P', chiesa: 'C', farmacia: 'A', faro: 'R' };
    for (const [d, [cols, s, e, cast]] of Object.entries(want)) {
      const lv = level(d);
      expect(lv.columns.map((c) => abbr[c]).join(''), d).toBe(cols);
      expect([lv.startHour, lv.endHour], d).toEqual([s, e]);
      const named = lv.threads.filter((t) => t.kind === 'persona').map((t) => t.character);
      expect(named.sort(), d).toEqual([...cast].sort());
    }
  });
});

describe('lunghezze dei testi', () => {
  const lineKeys = new Set<string>();
  const add = (k: string | undefined): void => {
    if (k) lineKeys.add(k);
  };
  for (const id of MINE) {
    const lv = level(id);
    add(lv.titleKey);
    for (const v of lv.dawn?.candidates ?? []) for (const l of v.lines) (add(l.textKey), add(l.forgetKey));
    for (const t of lv.tutorial ?? []) if (t.k === 'margine') add(t.textKey);
    add(lv.hintKeys?.spinta);
    add(lv.hintKeys?.indizio);
    for (const b of lv.beads) add(b.labelKey);
    for (const t of lv.threads) add(t.labelKey);
    if (lv.archive) {
      add(lv.archive.marginKey);
      for (const e of lv.archive.echoes) add(e.textKey);
      for (const l of lv.archive.reveal.lines) add(l.textKey);
    }
  }
  for (const d of DAYS) for (const n of notesOf(d)) for (const r of n.replies ?? []) add(r.textKey);
  for (const l of db.lines) (add(l.textKey), add(l.forgetKey));
  for (const b of db.book) (add(b.titleKey), add(b.marginKey));

  it('righe di gioco ≤ 90 caratteri (vignette, battute, echi, margini, risposte, suggerimenti, etichette)', () => {
    const long = [...lineKeys].filter((k) => it_(k).length > 90).map((k) => `${k} (${it_(k).length})`);
    expect(long).toEqual([]);
    expect(lineKeys.size).toBeGreaterThan(300);
  });

  it('bigliettini ≤ 220 caratteri', () => {
    for (const d of DAYS)
      for (const n of notesOf(d)) {
        expect(it_(n.textKey).length, n.id).toBeGreaterThan(0);
        expect(it_(n.textKey).length, n.id).toBeLessThanOrEqual(220);
      }
  });

  it('voci del Taccuino ≤ 220 caratteri, pagine del Libro ≤ 180', () => {
    for (const d of db.diary.values()) if (ATTO1_DIARY.has(d.id)) expect(it_(d.textKey).length, d.id).toBeLessThanOrEqual(220);
    for (const b of db.book) expect(it_(b.textKey).length, b.id).toBeLessThanOrEqual(180);
  });
});

describe('battute generiche (lines.json)', () => {
  it('9 personaggi × 7 eventi × 2 varianti, più 4 di riserva ciascuno', () => {
    expect(db.lines).toHaveLength(9 * (7 * 2 + 4));
    for (const c of SPEAKERS) {
      const mine = db.lines.filter((l) => l.character === c);
      for (const e of LINE_EVENTS) expect(mine.filter((l) => l.event === e), `${c}/${e}`).toHaveLength(2);
      expect(mine.filter((l) => l.event === 'riserva'), `${c}/riserva`).toHaveLength(4);
    }
  });

  it('le battute che nominano Ada hanno la variante per chi l\'ha dimenticata, che non la nomina', () => {
    const naming = db.lines.filter((l: LineDef) => /\bAda\b/.test(it_(l.textKey)));
    expect(naming.length).toBeGreaterThanOrEqual(9);
    for (const l of naming) {
      expect(l.forgetKey, l.id).toBeDefined();
      expect(it_(l.forgetKey as string), l.id).not.toMatch(/\bAda\b/);
    }
  });

  it('la battuta di Marta sul nodo con Teresa è quella del GDD', () => {
    const l = db.lines.find((x) => x.character === 'marta' && x.event === 'nodo' && x.with === 'teresa');
    expect(it_(l?.textKey ?? '')).toBe('Neanche il Signore mi fa passare di lì.');
  });
});

describe('Libro dei Punti, campagna e dati comuni', () => {
  it('le 14 pagine del Libro dei Punti sono presenti, nell\'ordine del GDD 5.7', () => {
    expect(db.book.map((b) => b.id)).toEqual([
      'incrocio', 'spillo', 'sopraDa', 'voce', 'matassa', 'molo', 'segreto',
      'pozzo', 'febbre', 'nodo', 'nome', 'nero', 'marea', 'puntoAperto',
    ]);
    for (const b of db.book) expect(b.unlock).toBeDefined();
    expect(it_('comune.libro.sopraDa.margine')).toBe('Chi sta sopra, dà. Chi sta sotto, riceve. Non è una questione d\'onore.');
    expect(it_('comune.libro.puntoAperto.margine')).toBe('Non ho avuto il coraggio.');
  });

  it('campaign.json: 24 giornate da g00 a g23 nell\'ordine del GDD, con finali e giornata della scelta', () => {
    const ids = db.campaign.days.map((d) => d.id);
    expect(ids).toEqual(Array.from({ length: 24 }, (_, i) => `g${String(i).padStart(2, '0')}`));
    expect(db.campaign.choiceDay).toBe('g23');
    expect(db.campaign.finals).toEqual({ merlettaia: 'fin_merlettaia', seppia: 'fin_seppia', chiuso: 'fin_chiuso', aperto: 'fin_aperto' });
    for (const d of db.campaign.days) {
      const n = Number(d.id.slice(1));
      const act = n === 0 ? 0 : n <= 8 ? 1 : n <= 16 ? 2 : 3;
      expect(d.act, d.id).toBe(act);
      expect(d.stonatura, d.id).toBe(act <= 1 ? 1 : act === 2 ? 0.6 : 0.25);
      // REVISIONE-1 C04: la sera della scelta ha 2 spilli (due bigliettini semplici; la scelta ne usa uno).
      expect(d.pins, d.id).toBe(n === 0 ? 0 : act === 3 ? (n === 23 ? 2 : 3) : 2);
      // g14 e g16 consegnano l'oggetto all'alba (dawnObject) e non lasciano niente per la sera dopo.
      if (d.id === 'g14' || d.id === 'g16') expect(d.objectAfter, d.id).toBeUndefined();
      else expect(d.objectAfter, d.id).toBeDefined();
    }
    const arch = Object.fromEntries(db.campaign.days.filter((d) => d.archiveAfter).map((d) => [d.archiveAfter, d.id]));
    expect(arch).toEqual({ arc1: 'g03', arc2: 'g07', arc3: 'g11', arc4: 'g14', arc5: 'g18', arc6: 'g20' });
  });

  it('ogni oggetto della sera è una lettera (LetterDef) o un oggetto con i testi in comune.oggetti (GDD 5.6)', () => {
    const letters = new Set(db.letters.map((l) => l.id));
    // Le lettere degli Atti II-III le scrive contenuti-atti23: qui basta che l'id segua la convenzione.
    const laterLetter = /^(lettera_L(8|9|10|11)|lettera_clotilde|biglietto_livia_[1-6])$/;
    for (const d of days()) {
      for (const o of [d.objectAfter, d.dawnObject]) {
        if (o === undefined) continue;
        const ok = letters.has(o) || (IT.has(`comune.oggetti.${o}.nome`) && IT.has(`comune.oggetti.${o}.descrizione`)) || laterLetter.test(o);
        expect(ok, `${d.id} ${o}`).toBe(true);
      }
    }
    const byDay = Object.fromEntries(days().map((d) => [d.id, d.objectAfter]));
    expect([byDay.g05, byDay.g09, byDay.g15, byDay.g23]).toEqual(['fuso_faro', 'pagina_strappata', 'bottiglia_nodo_nero', 'nastro_nonna']);
    // 11 lettere di L. dopo g01-g13 tranne g05 e g09.
    const lDays = db.campaign.days.filter((d) => /^lettera_L\d+$/.test(d.objectAfter ?? '')).map((d) => d.id);
    expect(lDays).toEqual(['g01', 'g02', 'g03', 'g04', 'g06', 'g07', 'g08', 'g10', 'g11', 'g12', 'g13']);
  });

  it('C04: oggetti dell\'alba, sere vuote e provenienza di ogni oggetto (laguna, mano, porta, casa)', () => {
    const byId = Object.fromEntries(days().map((d) => [d.id, d]));
    expect([byId.g14?.dawnObject, byId.g16?.dawnObject]).toEqual(['lettera_clotilde', 'fascio_lettere']);
    expect(days().filter((d) => d.dawnObject).map((d) => d.id)).toEqual(['g14', 'g16']);
    expect([byId.g15?.eveningEmptyKey, byId.g17?.eveningEmptyKey]).toEqual(['atto2.g15.sera.vuota', 'atto3.g17.sera.vuota']);
    expect(days().filter((d) => d.eveningEmptyKey).map((d) => d.id)).toEqual(['g15', 'g17']);
    // La frase della sera vuota vale solo se la giornata precedente non lascia un oggetto.
    for (const d of days()) {
      if (!d.eveningEmptyKey) continue;
      const prev = days()[days().indexOf(d) - 1];
      expect(prev?.objectAfter, d.id).toBeUndefined();
    }
    const objects = campaignObjects();
    const want: Record<string, { from: string; by?: string }> = {
      merletto_avorio: { from: 'casa' },
      libro_punti: { from: 'casa' },
      nastro_nonna: { from: 'casa' },
      lettera_clotilde: { from: 'mano', by: 'zeno' },
      fascio_lettere: { from: 'mano', by: 'zeno' },
    };
    for (let i = 1; i <= 3; i++) want[`fascio_${i}`] = { from: 'mano', by: 'zeno' };
    for (let i = 1; i <= 6; i++) want[`biglietto_livia_${i}`] = { from: 'porta' };
    expect(objects).toEqual(want);
    // Tutti gli altri oggetti della campagna vengono dalla laguna: bottiglie, fuso del faro, pagina strappata.
    const provenance = (id: string): string => objects[id]?.from ?? 'laguna';
    const all = [...new Set(days().flatMap((d) => [d.objectAfter, d.dawnObject]).filter((x): x is string => !!x))];
    const laguna = all.filter((id) => provenance(id) === 'laguna').sort();
    expect(laguna).toEqual(
      ['bottiglia_nodo_nero', 'fuso_faro', 'pagina_strappata', ...Array.from({ length: 11 }, (_, i) => `lettera_L${i + 1}`)].sort(),
    );
    for (const o of Object.values(objects)) {
      expect(['laguna', 'mano', 'porta', 'casa']).toContain(o.from);
      if (o.by !== undefined) expect(db.characters.has(o.by as never), o.by).toBe(true);
    }
    // comune.oggetti.<id> per ogni oggetto citato in objects (C19), in italiano e in inglese.
    for (const id of [...Object.keys(objects), 'bottiglia', 'fuso_faro', 'pagina_strappata', 'bottiglia_nodo_nero']) {
      for (const f of ['nome', 'descrizione']) {
        expect(IT.has(`comune.oggetti.${id}.${f}`), `it ${id}.${f}`).toBe(true);
        expect(EN.has(`comune.oggetti.${id}.${f}`), `en ${id}.${f}`).toBe(true);
      }
    }
  });

  it('la pagina del punto aperto si completa dopo arc6 (o comunque dopo g21)', () => {
    const p = db.book.find((b) => b.id === 'puntoAperto');
    expect(p?.unlock).toEqual({ any: [{ done: 'arc6' }, { done: 'g21' }] });
  });

  it('crediti senza segnaposto, in italiano e in inglese (la riga dell\'autore è comune.crediti.autore)', () => {
    const keys = [db.credits.authorKey, ...db.credits.lines.map((l) => l.key)];
    expect(db.credits.authorKey).toBe('comune.crediti.autore');
    for (const k of keys) {
      for (const [lang, table] of [['it', IT], ['en', EN]] as const) {
        const v = table.get(k) ?? '';
        expect(v.trim(), `${lang} ${k}`).not.toBe('');
        expect(v, `${lang} ${k}`).not.toMatch(/\[[^\]]*\]|nome dell'autore|author's name/i);
      }
    }
  });

  it('balance.json come GDD 3.13', () => {
    expect(db.balance.acts['1']).toEqual({ pins: 2, slack: 3, notes: [3, 3] });
    expect(db.balance.acts['2']).toEqual({ pins: 2, slack: 2, notes: [3, 4] });
    expect(db.balance.acts['3']).toEqual({ pins: 3, slack: 1, notes: [4, 4] });
    expect(db.balance.memoria).toEqual({ start: 3, startLunardi: 1, min: 0, max: 3, trueEndingCount: 4 });
    expect([db.balance.traboccoSoglia, db.balance.nodoRighe]).toEqual([3, 1]);
    // REVISIONE-1 C15: filo d'oro solo se il minimo della notte è almeno 3.
    expect((db.balance as typeof db.balance & { oro?: { minIncroci: number } }).oro).toEqual({ minIncroci: 3 });
  });

  it('lettere di L. dalla 1 alla 7, per le sere di g01-g04 e g06-g08, con gli esempi del GDD 6.5', () => {
    const mine = db.letters.filter((l) => /^lettera_L[1-7]$/.test(l.id));
    expect(mine.map((l) => [l.id, l.arrivesAfter])).toEqual([
      ['lettera_L1', 'g01'], ['lettera_L2', 'g02'], ['lettera_L3', 'g03'], ['lettera_L4', 'g04'],
      ['lettera_L5', 'g06'], ['lettera_L6', 'g07'], ['lettera_L7', 'g08'],
    ]);
    for (const l of mine) {
      expect(l.signed).toBe('L.');
      const text = it_(l.textKey);
      expect(text.startsWith('Cara mia,'), l.id).toBe(true);
      expect(text.split(/\s+/).length, l.id).toBeLessThanOrEqual(90);
    }
    expect(it_('atto1.lettere.L4')).toContain('nero di seppia');
    // Ogni lettera arriva come oggetto della sera del suo giorno.
    for (const l of mine) expect(db.campaign.days.find((d) => d.id === l.arrivesAfter)?.objectAfter).toBe(l.id);
  });

  it('il Taccuino apre le domande dell\'Atto I e le piste', () => {
    const entries = [...db.diary.values()].filter((d) => ATTO1_DIARY.has(d.id));
    const opened = new Set(entries.flatMap((d) => d.opens ?? []));
    for (const q of ['avorio', 'martaTeresa', 'chiL', 'filoNero', 'pozzo', 'desideri']) expect(opened.has(q), q).toBe(true);
    const closed = new Set(entries.flatMap((d) => d.closes ?? []));
    expect([...closed].sort()).toEqual(['avorio', 'martaTeresa']);
    expect(entries.filter((d) => d.pista).length).toBeGreaterThanOrEqual(3);
    for (const q of ['martaNoSotto', 'teresaLegge', 'pieroPozzo', 'ginoCorre', 'zenoFaro', 'ninaCuriosa']) {
      expect(entries.some((d) => JSON.stringify(d.unlock).includes(`"${q}"`)), q).toBe(true);
    }
  });
});

describe('solver e file calcolati', () => {
  it('ogni livello ha il suo .computed.json aggiornato (sourceHash e versione del solver)', () => {
    for (const id of MINE) {
      const c = db.computed.get(id);
      expect(c, id).toBeDefined();
      expect(c?.sourceHash, id).toBe(levelSourceHashFromDB(db, id));
      expect(c?.solverVersion, id).toBe(SOLVER_VERSION);
    }
  });

  it('g00 è il prologo dell\'esempio normativo: minimo 4 incroci, matassa 6', () => {
    expect(db.computed.get('g00')?.base.incroci).toBe(4);
    expect(level('g00').matassa).toBe(6);
    const lv = level('g00');
    const r = solve({ level: lv, ctx: createContext(lv, {}), goals: lv.goals ?? [], countOptimal: true });
    expect(r.incroci).toBe(4);
    // GDD 3.15: tre soluzioni ottime, che differiscono solo per il verso di un incrocio.
    expect(r.optimalCount).toBe(3);
    // La partita della tabella del GDD 3.15: Marta/Teresa, Teresa/Piero, Piero/Teresa, Marta/Teresa.
    const rows = [
      { hour: 6, crossings: [{ pair: 0, over: 'R' as const }] },
      { hour: 7, crossings: [{ pair: 1, over: 'L' as const }] },
      { hour: 8, crossings: [{ pair: 1, over: 'L' as const }] },
      { hour: 9, crossings: [{ pair: 0, over: 'L' as const }] },
    ];
    const sim = simulate(lv, createContext(lv, {}), rows);
    expect(sim.ok).toBe(true);
    expect(sim.timeline[1]?.holders['letta:L1']).toEqual(['teresa']);
    expect(sim.timeline[sim.timeline.length - 1]?.pos).toEqual(['teresa', 'marta', 'piero']);
  });

  it('g06 è l\'esempio del GDD 3.16: N1 5, N1+N2 5, N1+N3 impossibile e voluta, matassa 8', () => {
    const c = db.computed.get('g06');
    expect(c?.perNote['g06.nina']?.incroci).toBe(5);
    const combo = (a: string, b: string) => c?.combos.find((x) => x.notes.includes(a) && x.notes.includes(b));
    expect(combo('g06.nina', 'g06.marta')?.incroci).toBe(5);
    expect(combo('g06.nina', 'g06.zeno')?.incroci).toBeNull();
    expect(combo('g06.nina', 'g06.zeno')?.voluta).toBe(true);
    expect(combo('g06.marta', 'g06.zeno')?.incroci).toBe(0);
    expect(level('g06').matassa).toBe(8);
    // La soluzione della tabella del GDD 3.16 vale davvero per N1+N2, con le posizioni della tabella.
    const lv = level('g06');
    const ctx = createContext(lv, {}, { balance: db.balance });
    const sim = simulate(lv, ctx, [
      { hour: 7, crossings: [] },
      { hour: 8, crossings: [] },
      { hour: 9, crossings: [{ pair: 3, over: 'L' }] },
      { hour: 10, crossings: [{ pair: 0, over: 'R' }, { pair: 2, over: 'L' }] },
      { hour: 11, crossings: [{ pair: 1, over: 'L' }, { pair: 3, over: 'L' }] },
      { hour: 12, crossings: [] },
    ]);
    expect(sim.ok).toBe(true);
    expect(sim.timeline.map((s) => s.pos.join(','))).toEqual([
      'lino1,marta,teresa,piero,nina,zeno',
      'lino1,marta,teresa,piero,nina,zeno',
      'marinaio,marta,teresa,piero,nina,zeno',
      'marinaio,marta,teresa,nina,piero,zeno',
      'marta,marinaio,nina,teresa,piero,zeno',
      'marta,nina,marinaio,piero,teresa,zeno',
      'marta,nina,marinaio,piero,teresa,zeno',
    ]);
    const reqs = ['g06.nina', 'g06.marta'].map((id) => db.notes.get(id)?.request as Condition);
    expect(evaluate(lv, sim.timeline, sim.events, reqs, ctx, true).map((r) => r.status)).toEqual(['soddisfatta', 'soddisfatta']);
  });

  it('la matassa di ogni giornata è il minimo della combinazione designata più il margine (+3; prologo +2)', () => {
    for (const d of STORY) {
      const c = db.computed.get(d);
      if (!c) throw new Error(d);
      const vals = [
        c.base.incroci,
        ...Object.values(c.perNote).map((p) => p.incroci).filter((x): x is number => x !== null),
        ...c.combos.filter((x) => !x.voluta && x.incroci !== null).map((x) => x.incroci as number),
      ];
      const designated = Math.max(...vals);
      expect(level(d).matassa, d).toBe(designated + (d === 'g00' ? 2 : 3));
      expect(c.matassaSuggerita, d).toBe(level(d).matassa);
      // Le combinazioni non volute stanno nella matassa; ogni bigliettino da solo è risolvibile.
      for (const x of c.combos) if (!x.voluta) expect(x.incroci, `${d} ${x.notes.join('+')}`).not.toBeNull();
      for (const [id, p] of Object.entries(c.perNote)) expect(p.incroci, id).not.toBeNull();
    }
  });

  it('GDD 3.6: nel giorno del debutto di una stranezza nessuna richiesta (o coppia) è impossibile per colpa sua', () => {
    const debut: [string, QuirkId][] = [['g01', 'ginoCorre'], ['g05', 'zenoFaro'], ['g06', 'teresaLegge'], ['g07', 'pieroPozzo'], ['g07', 'ninaCuriosa']];
    for (const [d, q] of debut) {
      const lv = level(d);
      expect(lv.quirks, d).toContain(q);
      const without: LevelDef = { ...lv, quirks: lv.quirks.filter((x) => x !== q) };
      const ns = notesOf(d);
      const sets: NoteDef[][] = ns.map((n) => [n]);
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) if (ns[i]?.author !== ns[j]?.author) sets.push([ns[i] as NoteDef, ns[j] as NoteDef]);
      for (const s of sets) {
        const goals = [...(lv.goals ?? []), ...s.map((n) => n.request as Condition)];
        const withQ = solve({ level: lv, ctx: createContext(lv, {}, { balance: db.balance }), goals, matassa: 99 }).status;
        const withoutQ = solve({ level: without, ctx: createContext(without, {}, { balance: db.balance }), goals, matassa: 99 }).status;
        if (withoutQ === 'ok') expect(withQ, `${d} ${q} ${s.map((n) => n.id).join('+')}`).toBe('ok');
      }
    }
  });

  it('le soluzioni calcolate rispettano davvero le richieste (riprova col motore)', () => {
    for (const d of DAYS) {
      const lv = level(d);
      const ctx = createContext(lv, {}, { balance: db.balance });
      const c = db.computed.get(d);
      for (const combo of c?.combos ?? []) {
        if (!combo.rows) continue;
        const sim = simulate(lv, ctx, combo.rows);
        expect(sim.ok, `${d} ${combo.notes.join('+')}`).toBe(true);
        const used = combo.rows.reduce((n, r) => n + r.crossings.filter((x) => !x.forced).length, 0);
        expect(used).toBeLessThanOrEqual(lv.matassa);
      }
      const reqs = notesOf(d).map((n) => n.request as Condition);
      expect(reqs.length).toBeGreaterThanOrEqual(3);
      expect(Object.keys(c?.perNote ?? {}).sort()).toEqual(notesOf(d).map((n) => n.id).sort());
    }
  });
});

describe('Archivio A1-A2', () => {
  it('arc1 (1936) e arc2 (1965, la notte in cui morì la nonna): fili sbiaditi, esca, strappi, echi, margine, rivelazione, domande chiuse', () => {
    const want = { arc1: { year: '1936', esca: 'clotilde', closes: ['martaTeresa'] }, arc2: { year: '1965', esca: 'livia', closes: ['avorio'] } };
    for (const id of ARCHIVES) {
      const lv = level(id);
      const a = lv.archive;
      expect(lv.kind).toBe('archivio');
      expect(a?.year).toBe(want[id].year);
      expect(a?.candidates).toContain(want[id].esca);
      expect(Object.values(a?.answer ?? {})).not.toContain(want[id].esca);
      expect(a?.faded.length).toBe(4);
      expect(a?.recorded).toHaveLength(lv.endHour - lv.startHour);
      expect(a?.holes.length).toBeGreaterThanOrEqual(1);
      expect(a?.echoes.length).toBeGreaterThanOrEqual(4);
      expect(a?.closes).toEqual(want[id].closes);
      expect((a?.unlocks ?? []).every((u) => db.diary.has(u))).toBe(true);
      // Il merletto registrato si riapplica senza violazioni e soddisfa gli obiettivi.
      const sim = simulate({ ...lv, matassa: 99 }, createContext(lv, {}, { balance: db.balance }), a?.recorded ?? []);
      expect(sim.ok, id).toBe(true);
      // La matassa del rammendo è uguale agli incroci originali negli strappi (GDD 5.3).
      const original = (a?.holes ?? []).reduce(
        (n, h) => n + (a?.recorded ?? []).filter((r) => r.hour >= h.from && r.hour <= h.to).reduce((m, r) => m + r.crossings.length, 0),
        0,
      );
      expect(lv.matassa).toBe(original);
    }
    expect(level('arc1').archive?.marginKey).toBe('atto1.arc1.margine.clotilde');
    expect(level('arc2').archive?.marginKey).toBe('atto1.arc2.margine.clotilde');
    expect(it_('atto1.arc1.margine.clotilde')).toBe('Perché restasse.');
    // REVISIONE-1 D13: arc2 è l'ultima volta in cui la nonna si tessé dentro (la prima è arc6).
    expect(it_('atto1.arc2.margine.clotilde')).toBe('Un\'ultima volta, dentro.');
    expect(it_('atto1.arc2.rivela.1')).toContain('l\'ultima volta');
    expect(it_('atto1.diario.archivio.arc2').startsWith('1965. La notte in cui morì la nonna.')).toBe(true);
  });
});

// ───────────────────────── Revisione 1 ─────────────────────────

type TutStep = NonNullable<LevelDef['tutorial']>[number];
type MarginStep = Extract<TutStep, { k: 'margine' }>;
type PulseStep = Extract<TutStep, { k: 'pulsa' }>;
const marginsOf = (id: string): MarginStep[] => (level(id).tutorial ?? []).filter((t): t is MarginStep => t.k === 'margine');
const pulsesOf = (id: string): PulseStep[] => (level(id).tutorial ?? []).filter((t): t is PulseStep => t.k === 'pulsa');
/** Tutti i testi italiani di un namespace (chiave → testo). */
const textsOf = (prefix: string): [string, string][] => [...IT.entries()].filter(([k]) => k.startsWith(prefix));

describe('REVISIONE-1 CA1-03: ogni regola si insegna sul tombolo, la prima volta (D03, C02)', () => {
  it('ogni novità della tabella delle prime volte ha la sua nota a margine, con l\'innesco giusto, in italiano e in inglese', () => {
    const want: [string, string, Partial<Record<'when' | 'hour' | 'codice' | 'evento' | 'chi', string | number>>][] = [
      ['g00', 'atto1.g00.margine.spillo', { when: 'incrocio', hour: 6 }],
      ['g00', 'atto1.g00.margine.sopraDa', { when: 'incrocio', hour: 7 }],
      ['g00', 'atto1.g00.margine.disfa', { when: 'ora', hour: 8 }],
      ['g01', 'atto1.g01.margine.gino', { when: 'rifiuto', codice: 'corre' }],
      ['g01', 'atto1.g01.margine.gino', { when: 'ora', hour: 8 }],
      ['g02', 'atto1.g02.margine.voce', { when: 'primaOra' }],
      ['g02', 'atto1.g02.margine.matassa', { when: 'ora', hour: 8 }],
      ['g03', 'atto1.g03.margine.molo', { when: 'ora', hour: 8 }],
      ['g04', 'atto1.g04.margine.barca', { when: 'primaOra', hour: 7 }],
      ['g05', 'atto1.g05.margine.faro', { when: 'rifiuto', codice: 'faro' }],
      ['g05', 'atto1.g05.margine.faro', { when: 'ora', hour: 8 }],
      ['g06', 'atto1.g06.margine.segreto', { when: 'evento', evento: 'legge' }],
      ['g07', 'atto1.g07.margine.pozzo', { when: 'evento', evento: 'copia', chi: 'piero' }],
      ['g07', 'atto1.g07.margine.curiosa', { when: 'evento', evento: 'copia', chi: 'nina' }],
      ['arc1', 'atto1.arc1.margine.nomina', { when: 'primaOra' }],
      ['arc1', 'atto1.arc1.margine.rammenda', { when: 'archivioNomi' }],
      ['arc1', 'atto1.arc1.margine.eco', { when: 'archivioRammendo' }],
    ];
    for (const [id, key, m] of want) {
      const hit = marginsOf(id).some((t) => t.textKey === key && Object.entries(m).every(([k, v]) => (t as unknown as Record<string, unknown>)[k] === v));
      expect(hit, `${id} ${key} ${JSON.stringify(m)}`).toBe(true);
      expect(it_(key).length, key).toBeGreaterThan(0);
      expect(EN.get(key)?.length ?? 0, `en ${key}`).toBeGreaterThan(0);
    }
    // Il prologo dice «Chi sta sopra, dà» al primo incrocio delle 7, qualunque sia il verso (D03).
    expect(it_('atto1.g00.margine.sopraDa')).toBe('Chi sta sopra, dà.');
    expect(it_('atto1.arc1.margine.nomina')).toBe('Chi è questo filo? Toccalo e dagli un nome.');
    expect(it_('atto1.arc1.margine.rammenda')).toBe('Ora ritessi le ore strappate, com\'erano.');
    expect(it_('atto1.arc1.margine.eco')).toBe('Tocca gli incroci: si ricordano.');
  });

  it('ogni regola, stranezza o bordo che compare per la prima volta in una notte ha almeno una nota a margine in quella notte', () => {
    const seen = new Set<string>();
    for (const id of STORY) {
      const lv = level(id);
      const items = [...lv.rules.map((r) => `regola:${r}`), ...lv.quirks.map((q) => `stranezza:${q}`), ...(lv.edges ?? []).map((e) => `bordo:${e.kind}`)];
      const fresh = items.filter((x) => !seen.has(x));
      for (const x of items) seen.add(x);
      if (fresh.length > 0) expect(marginsOf(id).length, `${id}: ${fresh.join(', ')}`).toBeGreaterThan(0);
    }
  });

  it('pulsano gli elementi della tabella: spillo di Marta e Disfa (g00), fuso del Gino (g01), gomitolo (g02), barche (g03, g04), fuso di Zeno (g05), fuso sbiadito 1 (arc1)', () => {
    const want: [string, string, number, string?][] = [
      ['g00', 'spillo', 6, 'marta'], ['g00', 'disfa', 8], ['g01', 'fuso', 8, 'gino'], ['g02', 'matassa', 8],
      ['g03', 'bordo', 9], ['g04', 'bordo', 8], ['g05', 'fuso', 8, 'zeno'], ['arc1', 'fuso', 9, 'f1'],
    ];
    for (const [id, target, hour, thread] of want) {
      expect(pulsesOf(id).some((p) => p.target === target && p.hour === hour && p.thread === thread), `${id} ${target} ${hour}`).toBe(true);
      // Una barca pulsa solo nella riga che ha davvero un evento di bordo.
      if (target === 'bordo') expect((level(id).edges ?? []).some((e) => e.hour === hour), `${id} bordo ${hour}`).toBe(true);
    }
  });

  it('i testi del Gino e i suggerimenti seguono la regola nuova: non sta fermo due ore di fila', () => {
    for (const k of ['atto1.diario.persone.gino.corre', 'atto1.g01.hint.spinta', 'atto1.g01.margine.gino']) {
      expect(it_(k), k).not.toMatch(/ogni ora/i);
    }
    expect(it_('atto1.diario.persone.gino.corre')).toContain('due ore di fila');
  });

  it('i suggerimenti degli Archivi 1 e 2 aiutano a nominare i fili (abitudini, esca)', () => {
    expect(it_('atto1.arc1.hint.spinta')).toMatch(/Chiesa alle undici/);
    expect(it_('atto1.arc1.hint.indizio')).toMatch(/merlettaia non ha un filo/);
    expect(it_('atto1.arc2.hint.spinta')).toMatch(/Faro/);
  });
});

describe('REVISIONE-1 CA1-01 e CA1-07: continuità dell\'Atto I (D13)', () => {
  it('in g05 il Gino trova la lanterna spenta: nessun testo prima del finale dice che l\'ha vista accesa da dentro', () => {
    expect(it_('atto1.g05.alba.lanterna')).toBe('È tutta vetri e ottone, ma spenta!');
    expect(it_('atto1.g05.alba.lanterna2')).toBe('Si accende alle sei. Da dentro, un giorno.');
    const story = [...textsOf('atto1.'), ...textsOf('atto2.'), ...textsOf('atto3.'), ...textsOf('comune.')];
    const seen = story.filter(([, v]) => /è un sole|sole che gira|adesso sai perché non dormo/i.test(v)).map(([k]) => k);
    expect(seen).toEqual([]);
    // In Atto I e nei dati comuni la lanterna «accesa» compare solo come desiderio.
    const lit = [...textsOf('atto1.'), ...textsOf('comune.')].filter(([, v]) => /lanterna[^.!?]*accesa/i.test(v) && !/vedere/i.test(v));
    expect(lit.map(([k]) => k)).toEqual([]);
  });

  it('«entro» come la regola: Don Piero entro le dieci (g01), Teresa entro le nove (g02)', () => {
    const piero = db.notes.get('g01.piero')?.request as Condition & { by?: number };
    const teresa = db.notes.get('g02.teresa')?.request as Condition & { by?: number };
    expect(piero.by).toBe(10);
    expect(teresa.by).toBe(9);
    expect(it_('atto1.g01.piero.testo')).toContain('entro le dieci');
    expect(it_('atto1.g02.teresa.testo')).toContain('entro le nove');
    expect(it_('atto1.g02.teresa.testo')).not.toContain('messa delle nove');
    for (const [, v] of textsOf('atto1.g0')) expect(v).not.toMatch(/prima delle (nove|dieci)\b/);
  });

  it('i bigliettini si leggono la sera e parlano di domani (deissi)', () => {
    for (const d of DAYS) for (const n of notesOf(d)) expect(it_(n.textKey), n.id).not.toMatch(/\bOggi\b/);
    expect(it_('atto1.g03.marta.testo').startsWith('Domani')).toBe(true);
    expect(it_('atto1.g06.marta.testo').startsWith('Domani')).toBe(true);
    expect(it_('atto1.g08.zeno.testo')).toContain('Domani');
  });

  it('Teresa a sedici anni impastava il pane; al Molo resta solo la rete di Bepi', () => {
    expect(it_('atto1.g01.alba.bambina2')).toContain('impastavo già il pane per mia madre');
    expect(it_('atto1.g04.alba.barca2').startsWith('Al Molo resta solo la sua rete')).toBe(true);
  });

  it('il segreto di Teresa: aveva aperto la lettera prima; il pozzo non riferisce, la voce la porta chi l\'ha data', () => {
    expect(it_('atto1.g07.alba.confessione')).toContain('aperta prima');
    expect(it_('atto1.diario.domande.martaTeresa.confessione')).toContain('aperta prima');
    expect(it_('atto1.diario.domande.martaTeresa.nina')).toContain('aperto la lettera');
    for (const [k, v] of textsOf('atto1.')) {
      expect(v, k).not.toMatch(/sempre saputo|non me l'hai mai detto|non so più perché/i);
    }
    const prete = level('g06').dawn?.candidates.find((v) => v.id === 'g06.alba.prete');
    expect(prete?.lines.map((l) => l.speaker)).toEqual(['teresa', 'bepi']);
    expect(it_('atto1.diario.persone.piero.bepi')).toContain('non l\'ha detto a nessuno');
  });

  it('Don Piero dà del lei', () => {
    expect(it_('atto1.g04.alba.candela2')).toContain('Resti quanto vuole');
    expect(it_('atto1.g07.alba.confessione2')).toContain('deve andare');
    expect(it_('atto1.g08.alba.anniversario2')).toContain('la voleva qui');
    expect(it_('comune.battute.piero.riserva.2')).toContain('lei la notte dorme');
  });

  it('l\'eco dell\'una in arc2 è un ricordo, al passato', () => {
    expect(it_('atto1.arc2.eco.busta')).toMatch(/^Quella notte/);
  });

  it('g08: alla chiusura il filo nero appare sul bordo alto, alle 3, dal Faro, e incrocia Zeno (C12)', () => {
    const lv = level('g08') as LevelDef & { apparizione?: { hour: number; side: string; passi: number } };
    expect(lv.apparizione).toEqual({ hour: 3, side: 'faro', passi: 1 });
    expect(lv.columns[lv.columns.length - 1]).toBe('faro');
    expect(lv.initial[lv.initial.length - 1]).toBe('zeno');
    expect(it_('atto1.g08.alba.filoNero')).toMatch(/tre di notte.*filo nero.*Zeno al Faro/);
    expect(it_('atto1.diario.domande.filoNero.apre')).toMatch(/tre di notte.*filo nero.*Zeno al Faro/);
  });
});

describe('REVISIONE-1 CA1-06: esiti dei bigliettini (C05)', () => {
  const notes = DAYS.flatMap((d) => notesOf(d)).filter((n) => n.request && !n.ending);
  type WithEsito = NoteDef & { esito?: { ok?: string; fallita?: string; lasciato?: string } };
  const diaryTexts = [...db.diary.values()].filter((d) => ATTO1_DIARY.has(d.id)).map((d) => it_(d.textKey));
  const words = (s: string): string[] => s.toLowerCase().replace(/[«»“”.,:;!?]/g, ' ').split(/\s+/).filter(Boolean);
  const shingles = (s: string, n = 5): Set<string> => {
    const w = words(s);
    const out = new Set<string>();
    for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
    return out;
  };

  it('ogni bigliettino con richiesta ha esito.ok ed esito.fallita, in italiano e in inglese; lasciato se lasciarlo ha conseguenze', () => {
    expect(notes.length).toBe(26);
    for (const n of notes as WithEsito[]) {
      for (const st of ['ok', 'fallita'] as const) {
        const k = n.esito?.[st];
        expect(k, `${n.id} ${st}`).toBeDefined();
        expect(it_(k as string).length, `${n.id} ${st}`).toBeGreaterThan(20);
        expect(EN.get(k as string)?.length ?? 0, `en ${n.id} ${st}`).toBeGreaterThan(20);
      }
      if ((n.onIgnore ?? []).length > 0) expect(n.esito?.lasciato, `${n.id} lasciato`).toBeDefined();
    }
  });

  it('gli esiti sono specifici: niente frase generica, diversi fra loro, e non ripetono una voce del Taccuino', () => {
    const byKey = new Map<string, string>();
    for (const n of notes as WithEsito[]) {
      for (const k of Object.values(n.esito ?? {})) {
        const text = it_(k);
        expect(text, k).not.toMatch(/è andata come sperava/);
        expect(text.length, k).toBeLessThanOrEqual(140);
        byKey.set(k, text);
        expect(diaryTexts, k).not.toContain(text);
        const sh = shingles(text);
        for (const d of diaryTexts) for (const s of shingles(d)) expect(sh.has(s), `${k} ripete «${s}» di una voce del Taccuino`).toBe(false);
      }
    }
    // Le varianti (Marta più dura, Teresa più fredda) usano gli esiti del bigliettino base: per il resto, tutti diversi.
    const texts = [...byKey.values()];
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('REVISIONE-1 CA1-05: il Taccuino ricorda, non anticipa (D10, C03)', () => {
  // Campagna simulata per passi: sera di gNN = 2·i, fine della notte di gNN = 2·i + 1.
  const idx = (d: string): number => (STORY as readonly string[]).indexOf(d);
  const evening = (d: string): number => 2 * idx(d);
  const night = (d: string): number => 2 * idx(d) + 1;
  const objStep = new Map<string, number>();
  STORY.forEach((d, i) => {
    const o = db.campaign.days.find((x) => x.id === d)?.objectAfter;
    const next = STORY[i + 1];
    if (!o || !next) return;
    objStep.set(o, evening(next));
    if (o === 'merletto_avorio') objStep.set('libro_punti', evening(next));
  });
  const arcStep = (a: string): number => {
    const after = db.campaign.days.find((x) => x.archiveAfter === a)?.id;
    const next = after ? STORY[idx(after) + 1] : undefined;
    return next ? evening(next) : Infinity;
  };
  const noteDay = (id: string): string => db.notes.get(id)?.day ?? 'g99';
  const firstLevel = (pred: (lv: LevelDef) => boolean): number => {
    const d = STORY.find((x) => pred(level(x)));
    return d ? night(d) : Infinity;
  };
  const effectSteps = (pred: (e: Record<string, unknown>) => boolean): number => {
    let best = Infinity;
    for (const d of DAYS)
      for (const n of notesOf(d)) {
        for (const r of n.replies ?? []) if (r.effects.some((e) => pred(e as Record<string, unknown>))) best = Math.min(best, evening(d));
        for (const list of [n.onOk, n.onFail, n.onIgnore]) if ((list ?? []).some((e) => pred(e as Record<string, unknown>))) best = Math.min(best, night(d));
      }
    return best;
  };
  const memo = new Map<string, number>();
  function earliest(c: StoryCond): number {
    if ('all' in c) return Math.max(0, ...c.all.map(earliest));
    if ('any' in c) return Math.min(...c.any.map(earliest));
    if ('not' in c) return 0;
    if ('done' in c) return /^arc/.test(c.done) ? arcStep(c.done) : idx(c.done) >= 0 ? night(c.done) : Infinity;
    if ('ok' in c) return night(noteDay(c.ok));
    if ('failed' in c) return night(noteDay(c.failed));
    if ('reply' in c) return evening(noteDay(c.reply));
    if ('accepted' in c) return evening(noteDay(c.accepted));
    if ('ignored' in c) return evening(noteDay(c.ignored));
    if ('knows' in c) {
      const k = c as { knows: string; id: string };
      if (k.knows === 'oggetto') return objStep.get(k.id) ?? Infinity;
      if (k.knows === 'quirk') return firstLevel((lv) => (lv.quirks as string[]).includes(k.id));
      if (k.knows === 'rule') return firstLevel((lv) => (lv.rules as string[]).includes(k.id));
      if (k.knows === 'desire') return effectSteps((e) => e.desire === k.id);
      if (k.knows === 'diary') return entryStep(k.id);
      if (k.knows === 'archive') return arcStep(k.id);
    }
    return 0;
  }
  function entryStep(id: string): number {
    const m = memo.get(id);
    if (m !== undefined) return m;
    memo.set(id, Infinity);
    const def = db.diary.get(id);
    let best = def ? earliest(def.unlock) : Infinity;
    best = Math.min(best, effectSteps((e) => e.diary === id));
    for (const a of ARCHIVES) if ((level(a).archive?.unlocks ?? []).includes(id)) best = Math.min(best, arcStep(a));
    memo.set(id, best);
    return best;
  }

  it('nessuna voce cita un oggetto o una lettera prima che Ada li abbia letti', () => {
    const MENTIONS: [RegExp, string][] = [
      [/filo d'avorio|ultimo merletto della nonna/i, 'merletto_avorio'],
      [/bottigli|Cara mia|\bL\./, 'lettera_L1'],
      [/seppia/i, 'lettera_L4'],
      [/fuso a forma di faro/i, 'fuso_faro'],
    ];
    const early: string[] = [];
    for (const id of ATTO1_DIARY) {
      const text = it_(db.diary.get(id)?.textKey ?? '');
      for (const [re, obj] of MENTIONS) {
        const need = objStep.get(obj) ?? Infinity;
        if (re.test(text) && entryStep(id) < need) early.push(`${id} (passo ${entryStep(id)}) cita ${obj} (letto al passo ${need})`);
      }
    }
    expect(early).toEqual([]);
    // Le voci sugli oggetti si sbloccano alla lettura (C03).
    for (const [id, obj] of [['domande.avorio.apre', 'merletto_avorio'], ['domande.chiL.apre', 'lettera_L1'], ['lettere.bottiglie', 'lettera_L1'], ['domande.chiL.seppia', 'lettera_L4'], ['domande.chiL.fuso', 'fuso_faro']] as const) {
      expect(db.diary.get(id)?.unlock, id).toEqual({ knows: 'oggetto', id: obj });
    }
  });

  it('le persone si presentano nel Taccuino solo quando compaiono (la Nina con g03, Bepi con g04, Zeno con g05)', () => {
    const first = (c: string): number => {
      const d = STORY.find((x) => level(x).threads.some((t) => t.character === c) || (level(x).notes ?? []).some((n) => db.notes.get(n)?.author === c));
      return d ? evening(d) : Infinity;
    };
    for (const c of ['teresa', 'marta', 'piero', 'gino', 'nina', 'bepi', 'zeno']) {
      const id = `persone.${c}.chi`;
      expect(entryStep(id), id).toBeGreaterThanOrEqual(first(c));
      if (db.diary.has(`desiderio.${c}`)) expect(entryStep(`desiderio.${c}`), `desiderio.${c}`).toBeGreaterThanOrEqual(first(c));
    }
    expect(db.diary.get('persone.nina.chi')?.unlock).toEqual({ done: 'g03' });
    // Il prologo non nomina chi non c'è: nessuna voce sbloccata a fine g00 cita il Gino.
    for (const id of ATTO1_DIARY) if (entryStep(id) <= night('g00')) expect(it_(db.diary.get(id)?.textKey ?? ''), id).not.toMatch(/\bGino\b/);
  });

  it('la risposta a Marta in g06 rimanda all\'Archivio solo se arc1 non è ancora rammendato, e le due voci si escludono', () => {
    const holds = (c: StoryCond, s: { reply: boolean; arc1: boolean; diary: Set<string> }): boolean => {
      if ('all' in c) return c.all.every((x) => holds(x, s));
      if ('any' in c) return c.any.some((x) => holds(x, s));
      if ('not' in c) return !holds(c.not, s);
      if ('reply' in c) return s.reply && c.reply === 'g06.marta' && c.is === 'R1';
      if ('done' in c) return c.done === 'arc1' && s.arc1;
      if ('knows' in c && c.knows === 'diary') return s.diary.has(c.id);
      throw new Error(`condizione non prevista: ${JSON.stringify(c)}`);
    };
    const pista = db.diary.get('domande.martaTeresa.chiedilo');
    const dopo = db.diary.get('domande.martaTeresa.chiediloDopo');
    if (!pista || !dopo) throw new Error('voci assenti');
    expect(it_(pista.textKey)).toContain('Dove guardare: l\'Archivio');
    expect(it_(dopo.textKey)).not.toMatch(/Dove guardare|Archivio/);
    expect(dopo.pista).toBeUndefined();
    // Risposta prima del rammendo: la pista; dopo il rammendo non arriva anche l'altra.
    const before = { reply: true, arc1: false, diary: new Set<string>() };
    expect([holds(pista.unlock, before), holds(dopo.unlock, before)]).toEqual([true, false]);
    const later = { reply: true, arc1: true, diary: new Set(['domande.martaTeresa.chiedilo']) };
    expect(holds(dopo.unlock, later)).toBe(false);
    // Risposta con arc1 già rammendato: niente rimando.
    const after = { reply: true, arc1: true, diary: new Set<string>() };
    expect([holds(pista.unlock, after), holds(dopo.unlock, after)]).toEqual([false, true]);
    // La risposta non sblocca più la voce per effetto diretto: decidono le condizioni.
    const r1 = db.notes.get('g06.marta')?.replies?.find((r) => r.id === 'R1');
    expect(r1?.effects.some((e) => 'diary' in e)).toBe(false);
  });

  it('arc1 non ripete tre volte la stessa frase: rivelazione, risposta e voce d\'Archivio dicono cose diverse', () => {
    const a = it_('atto1.arc1.rivela.1');
    const b = it_('atto1.diario.domande.martaTeresa.risposta');
    const c = it_('atto1.diario.archivio.arc1');
    expect(new Set([a, b, c]).size).toBe(3);
    expect(c).not.toContain('lettera di Ernesto');
    expect(b).not.toContain('all\'ora del mercato');
  });
});

describe('REVISIONE-1 CA1-08: etichette, voci e battute (C16, D08)', () => {
  const NAMES = [...db.characters.keys()].map((c) => it_(`comune.pers.${c}.nome`)).filter(Boolean);

  it('le etichette delle perline sono sintagmi in minuscolo con l\'articolo (salvo i nomi propri)', () => {
    for (const id of MINE)
      for (const b of level(id).beads) {
        const label = it_(b.labelKey ?? '');
        expect(label.length, `${id} ${b.id}`).toBeGreaterThan(0);
        const proper = NAMES.some((n) => label.startsWith(n));
        expect(proper || /^[a-zàèéìòù]/.test(label), `${id} ${b.id}: «${label}»`).toBe(true);
        expect(label, `${id} ${b.id}`).not.toMatch(/^(Voce|Segreto):/);
      }
  });

  it('ogni lettera nomina il destinatario (nei giorni col nome, negli Archivi col ruolo)', () => {
    for (const id of MINE) {
      const lv = level(id);
      for (const b of lv.beads) {
        if (b.type !== 'lettera') continue;
        const label = it_(b.labelKey ?? '');
        expect(label, `${id} ${b.id}`).toMatch(/\bper /);
        const to = lv.threads.find((t) => t.id === b.to);
        if (lv.kind !== 'archivio' && to?.character) expect(label, `${id} ${b.id}`).toContain(it_(`comune.pers.${to.character}.nome`));
      }
    }
  });

  it('il Gino scrive con gli errori fin da g01; Bepi senza doppie e in minuscolo («la nina»)', () => {
    const atto1Notes = DAYS.flatMap((d) => notesOf(d));
    const gino = atto1Notes.filter((n) => n.author === 'gino');
    expect(gino.length).toBeGreaterThanOrEqual(2);
    for (const n of gino) expect(it_(n.textKey), n.id).toMatch(/canpana|cuesta|\bce\b|\ba dato\b|\bcosi\b/i);
    const bepi = atto1Notes.filter((n) => n.author === 'bepi');
    expect(bepi.length).toBeGreaterThanOrEqual(1);
    for (const n of bepi) {
      const t = it_(n.textKey);
      expect(t, n.id).toBe(t.toLowerCase());
      expect(t, n.id).not.toMatch(/([bcdfglmnprstvz])\1/i);
      if (/nina/i.test(t)) expect(t, n.id).toContain('la nina');
    }
  });

  it('le battute che citano fatti hanno una condizione che li rende veri (D11)', () => {
    expect(it_('comune.battute.gino.incontro.1')).not.toMatch(/sette|\d/);
    expect(it_('comune.battute.lunardi.cura.2')).not.toMatch(/quarto|\d/);
    for (const l of db.lines) {
      const t = it_(l.textKey);
      if (l.event === 'consegna' && /\bper me\b/i.test(t)) expect(l.when, l.id).toEqual({ event: 'consegna', a: l.character });
    }
    for (const id of ['gino.consegna.1', 'teresa.consegna.1']) expect(db.lines.find((l) => l.id === id)?.when, id).toEqual({ not: { event: 'consegna', a: id.split('.')[0] } });
    expect(db.lines.find((l) => l.id === 'marta.riserva.2')?.when).toEqual({ event: 'incontro', a: 'gino' });
  });

  it('Ada narratrice dice «la Nina» e «il Gino» nel Taccuino dell\'Atto I', () => {
    for (const id of ATTO1_DIARY) {
      const t = it_(db.diary.get(id)?.textKey ?? '');
      // Esclusi i discorsi riportati fra «».
      const narr = t.replace(/«[^»]*»/g, '');
      const bare = [...narr.matchAll(/(\S+)\s+(Nina|Gino)\b/g)].filter((m) => !/^(la|il|alla|al|della|del|dalla|dal|per la|sulla)$/i.test(m[1] ?? ''));
      const atStart = /^(Nina|Gino)\b/.test(narr);
      expect(bare.length === 0 && !atStart, `${id}: ${t}`).toBe(true);
    }
  });
});
