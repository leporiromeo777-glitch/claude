/**
 * Contenuti dell'Atto I e dati comuni (pacchetto contenuti-atto1).
 *
 * Verifica: validazione senza errori per i file del pacchetto, chiavi italiane,
 * bigliettini, vignette, lunghezze dei testi, battute, Libro dei Punti, campagna,
 * file .computed.json aggiornati e matassa = minimo designato + margine.
 */
import { describe, expect, it } from 'vitest';
import type { Condition, LevelDef, LineDef, NoteDef, QuirkId, StoryCond } from '../../../src/core/types';
import { loadContent } from '../../../src/content/loader';
import { validateContent } from '../../../src/content/validate';
import { buildCatalogs, loadI18nSources } from '../../../src/core/i18n';
import { CHARACTER_IDS } from '../../../src/core/ids';
import { SOLVER_VERSION, applyRow, createContext, evaluate, levelSourceHashFromDB, simulate, solve } from '../../../src/engine/index';
import diarioAtto1 from '../../../src/content/diary.atto1.json';

const db = loadContent();
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
    // In g01 la nota del rifiuto vale sia per il «No.» di Marta sia per il Gino che non sta fermo.
    const g01 = (level('g01').tutorial ?? []).find((t) => t.k === 'margine');
    expect(g01 && g01.k === 'margine' ? g01.when : null).toBe('rifiuto');
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
      expect(d.pins, d.id).toBe(n === 0 ? 0 : n === 23 ? 1 : act === 3 ? 3 : 2);
      expect(d.objectAfter, d.id).toBeDefined();
    }
    const arch = Object.fromEntries(db.campaign.days.filter((d) => d.archiveAfter).map((d) => [d.archiveAfter, d.id]));
    expect(arch).toEqual({ arc1: 'g03', arc2: 'g07', arc3: 'g11', arc4: 'g14', arc5: 'g18', arc6: 'g20' });
  });

  it('ogni oggetto della sera è una lettera (LetterDef) o un oggetto con i testi in comune.oggetti (GDD 5.6)', () => {
    const letters = new Set(db.letters.map((l) => l.id));
    // Le lettere degli Atti II-III le scrive contenuti-atti23: qui basta che l'id segua la convenzione.
    const laterLetter = /^(lettera_L(8|9|10|11)|lettera_clotilde|biglietto_livia_[1-6])$/;
    for (const d of db.campaign.days) {
      const o = d.objectAfter as string;
      const ok = letters.has(o) || (IT.has(`comune.oggetti.${o}.nome`) && IT.has(`comune.oggetti.${o}.descrizione`)) || laterLetter.test(o);
      expect(ok, `${d.id} ${o}`).toBe(true);
    }
    const byDay = Object.fromEntries(db.campaign.days.map((d) => [d.id, d.objectAfter]));
    expect([byDay.g05, byDay.g09, byDay.g14, byDay.g15, byDay.g16, byDay.g23]).toEqual([
      'fuso_faro', 'pagina_strappata', 'lettera_clotilde', 'bottiglia_nodo_nero', 'fascio_lettere', 'nastro_nonna',
    ]);
    // 11 lettere di L. dopo g01-g13 tranne g05 e g09.
    const lDays = db.campaign.days.filter((d) => /^lettera_L\d+$/.test(d.objectAfter ?? '')).map((d) => d.id);
    expect(lDays).toEqual(['g01', 'g02', 'g03', 'g04', 'g06', 'g07', 'g08', 'g10', 'g11', 'g12', 'g13']);
  });

  it('la pagina del punto aperto si completa dopo arc6 (o comunque dopo g21)', () => {
    const p = db.book.find((b) => b.id === 'puntoAperto');
    expect(p?.unlock).toEqual({ any: [{ done: 'arc6' }, { done: 'g21' }] });
  });

  it('balance.json come GDD 3.13', () => {
    expect(db.balance.acts['1']).toEqual({ pins: 2, slack: 3, notes: [3, 3] });
    expect(db.balance.acts['2']).toEqual({ pins: 2, slack: 2, notes: [3, 4] });
    expect(db.balance.acts['3']).toEqual({ pins: 3, slack: 1, notes: [4, 4] });
    expect(db.balance.memoria).toEqual({ start: 3, startLunardi: 1, min: 0, max: 3, trueEndingCount: 4 });
    expect([db.balance.traboccoSoglia, db.balance.nodoRighe]).toEqual([3, 1]);
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
  it('arc1 (1936) e arc2 (la notte scorsa): fili sbiaditi, esca, strappi, echi, margine, rivelazione, domande chiuse', () => {
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
    expect(it_('atto1.arc1.margine')).toBe('Perché restasse.');
    expect(it_('atto1.arc2.margine')).toBe('Una volta sola, dentro.');
  });
});
