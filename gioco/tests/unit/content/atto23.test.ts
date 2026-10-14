/**
 * Contenuti degli Atti II-III, giornate finali, Archivio A3-A6 e finali (pacchetto contenuti-atti23).
 *
 * Verifica: validazione senza errori per i file del pacchetto, chiavi italiane, bigliettini per sera (3-4,
 * con una risposta e un conflitto), le quattro carte della scelta di g23, desideri e voci del Taccuino,
 * requisiti del finale vero (GDD 6.6), lunghezze dei testi, file .computed.json aggiornati, matassa =
 * minimo designato + margine dell'atto (g13: + 0), occasioni di fin_aperto e arc6, soluzione di
 * fin_seppia, testi chiave della bibbia (GDD 6.4, 6.6) e il numero di parole italiane.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, Condition, ContentDB, LevelDef, NoteDef, OccasionDef, StoryCond } from '../../../src/core/types';
import { loadContent } from '../../../src/content/loader';
import { validateContent } from '../../../src/content/validate';
import { buildCatalogs, loadI18nSources } from '../../../src/core/i18n';
import { SOLVER_VERSION, createContext, levelSourceHashFromDB, simulate, simulateAndEvaluate, solve } from '../../../src/engine/index';
import diary2 from '../../../src/content/diary.atto2.json';
import diary3 from '../../../src/content/diary.atto3.json';
import lettere23 from '../../../src/content/lettere.atto23.json';
import notes2 from '../../../src/content/notes.atto2.json';
import notes3 from '../../../src/content/notes.atto3.json';
import endingsJson from '../../../src/content/endings.json';

const db: ContentDB = loadContent();
const catalogs = buildCatalogs(loadI18nSources());
const IT = catalogs.tables.it;
const t = (key: string): string => IT.get(key) ?? '';

const ACT2 = ['g09', 'g10', 'g11', 'g12', 'g13', 'g14', 'g15', 'g16'] as const;
const ACT3 = ['g17', 'g18', 'g19', 'g20', 'g21', 'g22'] as const;
const DAYS = [...ACT2, ...ACT3] as string[];
const STORY = [...DAYS, 'g23'];
const FINALS = ['fin_merlettaia', 'fin_seppia', 'fin_chiuso', 'fin_aperto'];
const ARCHIVES = ['arc3', 'arc4', 'arc5', 'arc6'];
const MINE = [...STORY, ...FINALS, ...ARCHIVES];
const CAST: CharacterId[] = ['teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi'];
const MY_DIARY = new Set([...(diary2 as { id: string }[]), ...(diary3 as { id: string }[])].map((d) => d.id));
const MY_NOTES = [...(notes2 as NoteDef[]), ...(notes3 as NoteDef[])];
const MY_LETTERS = new Set((lettere23 as { id: string }[]).map((l) => l.id));

function level(id: string): LevelDef {
  const lv = db.levels.get(id);
  if (!lv) throw new Error(`livello ${id} assente`);
  return lv;
}
function notesOf(day: string): NoteDef[] {
  return (level(day).notes ?? []).map((id) => {
    const n = db.notes.get(id);
    if (!n) throw new Error(`bigliettino ${id} assente`);
    return n;
  });
}

// ───────── Valutatore minimo delle StoryCond usate qui (sera: archivi fatti, memoria, flag, conoscenza) ─────────
interface Story {
  done: Set<string>;
  memoria: Partial<Record<CharacterId, number>>;
  flags: Record<string, string | number | boolean>;
  desires: Set<string>;
}
function holds(c: StoryCond, s: Story): boolean {
  if ('all' in c) return c.all.every((x) => holds(x, s));
  if ('any' in c) return c.any.some((x) => holds(x, s));
  if ('not' in c) return !holds(c.not, s);
  if ('done' in c) return s.done.has(c.done);
  if ('memoria' in c) {
    const m = s.memoria[c.memoria] ?? 0;
    return (c.gte === undefined || m >= c.gte) && (c.lte === undefined || m <= c.lte);
  }
  if ('flag' in c) {
    const v = s.flags[c.flag];
    if (c.eq !== undefined) return v === c.eq;
    if (typeof v !== 'number') return false;
    return (c.gte === undefined || v >= c.gte) && (c.lte === undefined || v <= c.lte);
  }
  if ('knows' in c && c.knows === 'desire') return s.desires.has(c.id);
  throw new Error(`condizione non prevista dal test: ${JSON.stringify(c)}`);
}
const STATES: Story[] = [
  { done: new Set(), memoria: Object.fromEntries(CAST.map((c) => [c, 3])), flags: {}, desires: new Set() },
  { done: new Set(['arc1', 'arc2', 'arc3', 'arc4', 'arc5', 'arc6']), memoria: Object.fromEntries(CAST.map((c) => [c, 0])), flags: {}, desires: new Set() },
];
const available = (day: string, s: Story): NoteDef[] => notesOf(day).filter((n) => !n.availableIf || holds(n.availableIf, s));

/** Un errore di validazione riguarda i file di questo pacchetto? */
function isMine(err: string): boolean {
  const where = err.slice(0, err.indexOf(':'));
  if (/^levels\/(g(09|1\d|2[0-3])|fin_[a-z]+|arc[3-6])(\b|\.computed|\/)/.test(where)) return true;
  if (/^notes\/g(09|1\d|2[0-3])\./.test(where)) return true;
  if (where.startsWith('lettere/')) return MY_LETTERS.has(where.slice('lettere/'.length));
  if (where.startsWith('diary/')) return MY_DIARY.has(where.slice('diary/'.length));
  if (where.startsWith('endings/')) return true;
  return false;
}

function visitKeys(o: unknown, out: string[]): void {
  if (typeof o === 'string') {
    if (/^(atto2|atto3|finali|comune)\./.test(o)) out.push(o);
  } else if (Array.isArray(o)) o.forEach((x) => visitKeys(x, out));
  else if (o && typeof o === 'object') Object.values(o).forEach((x) => visitKeys(x, out));
}
const myFiles = (): unknown[] => [
  ...MINE.map(level), MY_NOTES, [...db.diary.values()].filter((d) => MY_DIARY.has(d.id)),
  db.letters.filter((l) => MY_LETTERS.has(l.id)), endingsJson,
];

describe('validazione e testi', () => {
  it('validateContent non dà errori sui file del pacchetto', () => {
    expect(validateContent(db, { hasKey: (k) => IT.has(k) }).filter(isMine)).toEqual([]);
  });

  it('ogni chiave di testo dei file del pacchetto esiste in italiano', () => {
    const keys: string[] = [];
    visitKeys(myFiles(), keys);
    expect(keys.length).toBeGreaterThan(400);
    expect(keys.filter((k) => !IT.has(k))).toEqual([]);
  });

  it('righe di gioco ≤ 90 caratteri (vignette, echi, risposte, margini, suggerimenti, etichette)', () => {
    const long: string[] = [];
    const check = (k: string | undefined): void => {
      if (k && t(k).length > 90) long.push(`${k} (${t(k).length})`);
    };
    for (const id of MINE) {
      const lv = level(id);
      for (const v of lv.dawn?.candidates ?? []) for (const l of v.lines) [l.textKey, l.forgetKey].forEach(check);
      for (const e of lv.archive?.echoes ?? []) check(e.textKey);
      for (const l of lv.archive?.reveal.lines ?? []) check(l.textKey);
      check(lv.archive?.marginKey);
      check(lv.hintKeys?.spinta);
      check(lv.hintKeys?.indizio);
      for (const s of lv.tutorial ?? []) if (s.k === 'margine') check(s.textKey);
      for (const b of lv.beads) check(b.labelKey);
      check(lv.titleKey);
    }
    for (const n of MY_NOTES) for (const r of n.replies ?? []) check(r.textKey);
    for (const e of db.endings.values()) {
      for (const v of e.epilogue) for (const l of v.lines) check(l.textKey);
      for (const m of e.missing) check(m.textKey);
    }
    expect(long).toEqual([]);
  });

  it('bigliettini ≤ 220 caratteri, e firmati solo dallo stile (niente «Ada» da g12 in poi, tranne la scelta)', () => {
    for (const n of MY_NOTES) {
      expect(t(n.textKey).length, n.id).toBeLessThanOrEqual(220);
      expect(t(n.textKey).length, n.id).toBeGreaterThan(0);
      const day = Number(n.day.slice(1));
      if (day >= 12 && !n.ending) expect(/\bAda\b/.test(t(n.textKey)), n.id).toBe(false);
    }
  });

  it('il report: parole italiane del pacchetto tra 9.000 e 12.000', () => {
    const own = [...IT.entries()].filter(([k]) => /^(atto2|atto3|finali)\./.test(k));
    const words = own.reduce((n, [, v]) => n + v.split(/\s+/).filter(Boolean).length, 0);
    console.info(`contenuti-atti23: ${own.length} testi, ${words} parole italiane`);
    expect(words).toBeGreaterThanOrEqual(9000);
    expect(words).toBeLessThanOrEqual(12000);
  });
});

describe('bigliettini e vignette', () => {
  it('da g09 a g22: 3-4 bigliettini per sera, con almeno una risposta (con o senza Archivio letto)', () => {
    for (const s of STATES) {
      for (const d of DAYS) {
        const ns = available(d, s);
        expect(ns.length, d).toBeGreaterThanOrEqual(3);
        expect(ns.length, d).toBeLessThanOrEqual(4);
        expect(ns.some((n) => (n.replies ?? []).length === 2), d).toBe(true);
        expect(ns.every((n) => n.ending === undefined), d).toBe(true);
      }
    }
  });

  it('nell\'Atto III quattro bigliettini per sera (balance: notes [4, 4])', () => {
    for (const s of STATES) for (const d of ACT3) expect(available(d, s).length, d).toBe(4);
  });

  it('g23: quattro biglietti con ending A merlettaia, B seppia, C chiuso, D aperto, e i testi del GDD 6.6', () => {
    const textOf: Record<string, string> = {
      merlettaia: 'Resta. L\'isola ha bisogno di una merlettaia, e tua madre ha bisogno di andarsene libera, stavolta.',
      seppia: 'Dammi il tombolo, Ada. Tu vivi. Io ho già vissuto abbastanza fuori.',
      chiuso: 'Rimandala via, come ho fatto io. Funziona.',
      aperto: 'Il punto aperto.',
    };
    const authors: Record<string, string> = { seppia: 'livia', chiuso: 'clotilde', aperto: 'ada' };
    for (const s of STATES) {
      const ns = available('g23', s);
      expect(ns.length).toBe(4);
      expect(ns.map((n) => n.ending).sort()).toEqual(['aperto', 'chiuso', 'merlettaia', 'seppia']);
      for (const n of ns) {
        expect(t(n.textKey)).toBe(textOf[n.ending as string]);
        expect(n.request).toBeUndefined();
        if (n.ending !== 'merlettaia') expect(n.author).toBe(authors[n.ending as string]);
      }
      // A è di Zeno, o di Don Piero se Zeno ha memoria 0.
      const a = ns.find((n) => n.ending === 'merlettaia') as NoteDef;
      expect(a.author).toBe((s.memoria.zeno ?? 0) >= 1 ? 'zeno' : 'piero');
    }
    expect(db.campaign.days.find((d) => d.id === 'g23')?.pins).toBe(1);
  });

  it('ogni bigliettino citato da un livello esiste, e ogni bigliettino del pacchetto è citato dal suo giorno', () => {
    for (const d of STORY) for (const id of level(d).notes ?? []) expect(db.notes.get(id)?.day, id).toBe(d);
    for (const n of MY_NOTES) expect(level(n.day).notes ?? [], n.id).toContain(n.id);
  });

  it('3-5 vignette dell\'alba per giornata, con condizioni sui flag di storia', () => {
    for (const d of STORY) {
      const cs = level(d).dawn?.candidates ?? [];
      expect(cs.length, d).toBeGreaterThanOrEqual(3);
      expect(cs.length, d).toBeLessThanOrEqual(5);
    }
    const flagged = (d: string, f: string): boolean =>
      (level(d).dawn?.candidates ?? []).some((v) => JSON.stringify(v.when ?? {}).includes(`"flag":"${f}"`));
    expect(flagged('g15', 'bepi')).toBe(true);
    expect(flagged('g18', 'riconciliate')).toBe(true);
    expect(flagged('g20', 'nina')).toBe(true);
    expect(flagged('g22', 'zenoLivia')).toBe(true);
  });

  it('almeno un conflitto per sera: una combinazione impossibile e voluta (g13: la matassa esatta)', () => {
    for (const d of DAYS) {
      if (d === 'g13') continue;
      const c = db.computed.get(d);
      expect(c?.combos.some((x) => x.incroci === null && x.voluta), d).toBe(true);
    }
  });

  it('stranezze attive per giornata: ninaCuriosa, lunardiCura da g09, rancore da g11, pieroTrabocca da g16', () => {
    for (const d of DAYS) {
      const lv = level(d);
      expect(lv.quirks, d).toContain('ninaCuriosa');
      expect(lv.quirks, d).toContain('lunardiCura');
      expect(lv.quirks.includes('pieroTrabocca'), d).toBe(Number(d.slice(1)) >= 16);
      const both = ['teresa', 'marta'].every((c) => lv.threads.some((x) => x.id === c));
      if (Number(d.slice(1)) >= 11 && both) {
        expect(lv.rules, d).toContain('rancore');
        expect(lv.rancor, d).toEqual([['teresa', 'marta']]);
      }
      if (Number(d.slice(1)) >= 12) expect(lv.rules, d).toContain('nome');
    }
    expect(level('g10').rancor).toBeUndefined();
    expect(level('g23').rules).not.toContain('nome');
  });

  it('g12: tutorial del nome; la richiesta di Lunardi si soddisfa col nome appuntato (anche lontano da lui)', () => {
    const lv = level('g12');
    expect(lv.tutorial?.some((s) => s.k === 'pulsa' && s.target === 'nome')).toBe(true);
    const req = db.notes.get('g12.lunardi')?.request as Condition;
    expect(req).toEqual({ t: 'ha', who: 'lunardi', bead: 'nome' });
    const okWith = (nomeOn: string): boolean =>
      solve({ level: lv, ctx: createContext(lv, {}, { nomeOn, balance: db.balance }), goals: [...(lv.goals ?? []), req] }).status === 'ok';
    expect(okWith('lunardi')).toBe(true);
    expect(okWith('marta')).toBe(true);
    // Con il nome su Lunardi la richiesta è compatibile con quelle di Bepi e di Zeno (non con quella di Teresa, voluta).
    const ctx = createContext(lv, {}, { nomeOn: 'lunardi', balance: db.balance });
    for (const other of ['g12.bepi', 'g12.zeno', 'g12.teresa']) {
      const r = solve({ level: lv, ctx, goals: [...(lv.goals ?? []), req, db.notes.get(other)?.request as Condition] });
      expect(r.status, other).toBe('ok');
      expect(r.incroci ?? 99, other).toBeLessThanOrEqual(lv.matassa);
    }
  });
});

describe('storia: destini, desideri, Taccuino, lettere', () => {
  it('i destini si decidono dove dice il GDD 5.1', () => {
    const effectsOf = (id: string): string => JSON.stringify(db.notes.get(id));
    expect(effectsOf('g15.nina')).toContain('"setFlag":"bepi","value":"salvo"');
    expect(effectsOf('g15.nina')).toContain('"setFlag":"bepi","value":"ferito"');
    expect(effectsOf('g16.zeno')).toContain('"setFlag":"lettereLivia","value":"liberate"');
    expect(effectsOf('g16.zeno')).toContain('"setFlag":"lettereLivia","value":"sepolte"');
    expect(db.notes.get('g18.teresa')?.onOk).toContainEqual({ setFlag: 'riconciliate', value: true });
    expect(effectsOf('g20.nina')).toContain('"setFlag":"nina","value":"parte"');
    expect(effectsOf('g20.nina')).toContain('"setFlag":"nina","value":"resta"');
    expect(db.notes.get('g22.zeno')?.onOk).toContainEqual({ setFlag: 'zenoLivia', value: true });
  });

  it('ogni desiderio (8 personaggi più Livia) ha una voce di Taccuino con sblocco, e un bigliettino che lo rivela', () => {
    const effects = JSON.stringify([...db.notes.values()]);
    for (const c of [...CAST, 'livia']) {
      const entry = [...db.diary.values()].find((d) => d.section === 'persone' && d.character === c &&
        JSON.stringify(d.unlock) === JSON.stringify({ knows: 'desire', id: c }));
      expect(entry, c).toBeDefined();
      expect(t(entry?.textKey ?? '').length, c).toBeGreaterThan(10);
      expect(effects.includes(`{"desire":"${c}"}`), c).toBe(true);
    }
  });

  it('desideri con la condizione di GDD 5.4: Marta solo dopo arc1, Teresa solo dopo arc3, Livia automatico in g17', () => {
    const giveDesire = (n: NoteDef, c: string): boolean => JSON.stringify(n).includes(`{"desire":"${c}"}`);
    expect(giveDesire(db.notes.get('g10.marta') as NoteDef, 'marta')).toBe(true);
    expect(db.notes.get('g10.marta')?.availableIf).toEqual({ done: 'arc1' });
    expect(giveDesire(db.notes.get('g10.marta.senzaArchivio') as NoteDef, 'marta')).toBe(false);
    expect(giveDesire(db.notes.get('g18.marta') as NoteDef, 'teresa')).toBe(true);
    expect(db.notes.get('g18.marta')?.availableIf).toEqual({ done: 'arc3' });
    expect(giveDesire(db.notes.get('g18.marta.senzaArchivio') as NoteDef, 'teresa')).toBe(false);
    const zeno17 = db.notes.get('g17.zeno') as NoteDef;
    for (const list of [zeno17.onOk, zeno17.onFail, zeno17.onIgnore, ...(zeno17.replies ?? []).map((r) => r.effects)]) {
      expect(list).toContainEqual({ desire: 'livia' });
    }
  });

  it('il Taccuino apre e chiude le domande degli Atti II-III, con le piste', () => {
    const mine = [...db.diary.values()].filter((d) => MY_DIARY.has(d.id));
    const opened = new Set(mine.flatMap((d) => d.opens ?? []));
    for (const q of ['anno1958', 'madre', 'puntoAperto']) expect(opened.has(q), q).toBe(true);
    const closed = new Set([...mine.flatMap((d) => d.closes ?? []), ...ARCHIVES.flatMap((a) => level(a).archive?.closes ?? [])]);
    for (const q of ['anno1958', 'madre', 'puntoAperto', 'chiL', 'pozzo', 'filoNero', 'desideri']) expect(closed.has(q), q).toBe(true);
    expect(mine.filter((d) => d.pista).length).toBeGreaterThanOrEqual(4);
    for (const a of ARCHIVES) for (const u of level(a).archive?.unlocks ?? []) expect(db.diary.get(u)?.unlock, u).toEqual({ done: a });
  });

  it('lettere: L. 8-11 (sere di g10-g13), Clotilde (g14), il fascio (g16), Livia (g17-g22), il nastro (g23)', () => {
    const at = (id: string) => db.letters.find((l) => l.id === id);
    expect(['lettera_L8', 'lettera_L9', 'lettera_L10', 'lettera_L11'].map((id) => at(id)?.arrivesAfter)).toEqual(['g10', 'g11', 'g12', 'g13']);
    for (const id of ['lettera_L8', 'lettera_L9', 'lettera_L10', 'lettera_L11']) {
      const text = t(at(id)?.textKey ?? '');
      expect(text.startsWith('Cara mia,'), id).toBe(true);
      expect(text.split(/\s+/).length, id).toBeLessThanOrEqual(90);
      expect(/Ada|Livia|Clotilde/.test(text), id).toBe(false);
    }
    expect(t(at('lettera_L8')?.textKey ?? '')).toBe('Cara mia, quest\'anno compi sedici anni. Io a sedici anni volevo andarmene e restare insieme. Spero che a te riesca una delle due. L.');
    expect(t(at('lettera_L11')?.textKey ?? '')).toBe('Cara mia, lei è morta, vero? Stanotte il mare era diverso. Vengo. Non so ancora come. L.');
    expect(at('lettera_clotilde')).toMatchObject({ arrivesAfter: 'g14', signed: 'C.' });
    const clotilde = t(at('lettera_clotilde')?.textKey ?? '');
    for (const s of ['Tua madre è viva. Si chiama Livia', 'col vaporetto delle nove', 'Due merlettaie sullo stesso merletto lo strappano.', 'Io ci ho creduto per sessant\'anni.']) expect(clotilde).toContain(s);
    expect(['fascio_1', 'fascio_2', 'fascio_3'].map((id) => at(id)?.arrivesAfter)).toEqual(['g16', 'g16', 'g16']);
    for (const id of ['fascio_1', 'fascio_2', 'fascio_3']) expect(t(at(id)?.textKey ?? '').startsWith('Ada mia,'), id).toBe(true);
    for (let i = 1; i <= 6; i++) {
      const l = at(`biglietto_livia_${i}`);
      expect(l?.arrivesAfter).toBe(`g${16 + i}`);
      expect(l?.signed).toBe('L.');
    }
    expect(at('nastro_nonna')?.arrivesAfter).toBe('g23');
    // Gli oggetti della sera (campaign.json) puntano alle lettere con lo stesso id.
    for (const d of db.campaign.days) {
      if (d.objectAfter && MY_LETTERS.has(d.objectAfter)) expect(at(d.objectAfter)?.arrivesAfter, d.objectAfter).toBe(d.id);
    }
  });
});

describe('finali (GDD 6.6)', () => {
  const ending = (id: string) => {
    const e = db.endings.get(id as never);
    if (!e) throw new Error(`finale ${id} assente`);
    return e;
  };

  it('quattro finali: livelli, epiloghi di 3-4 vignette, chiuso non conta come finale', () => {
    expect([...db.endings.keys()].sort()).toEqual(['aperto', 'chiuso', 'merlettaia', 'seppia']);
    for (const [id, e] of db.endings) {
      expect(e.level).toBe(db.campaign.finals[id]);
      expect(e.epilogue.length, id).toBeGreaterThanOrEqual(3);
      expect(e.epilogue.length, id).toBeLessThanOrEqual(4);
      expect(e.countsAsEnding, id).toBe(id !== 'chiuso');
    }
    const last = (id: string) => ending(id).epilogue.at(-1)?.lines.map((l) => t(l.textKey)).join(' ');
    // L'ultima riga di ogni epilogo è quella del GDD 6.6.
    expect(last('merlettaia')?.endsWith('Il sole è sorto ogni giorno. Nessuno ha mai saputo perché.')).toBe(true);
    expect(last('seppia')?.endsWith('Mia madre tesse ancora. Lo so perché ogni tanto il giorno è più gentile di quanto dovrebbe.')).toBe(true);
    expect(last('aperto')?.endsWith('Per un inverno intero ho imparato a comandare le persone. Poi ho imparato a conoscerle.')).toBe(true);
    expect(last('chiuso')).toContain('Il punto di Clotilde: chi lo ripete, lo ripete per sempre.');
  });

  it('i requisiti del finale vero sono esattamente quelli di GDD 6.6', () => {
    const req = ending('aperto').requires as StoryCond;
    const base = (): Story => ({
      done: new Set(), memoria: Object.fromEntries(CAST.map((c) => [c, 1])),
      flags: { lettereLivia: 'liberate', riconciliate: true }, desires: new Set(CAST),
    });
    expect(holds(req, base())).toBe(true);
    // Ogni requisito, tolto da solo, basta a negare il finale vero.
    expect(holds(req, { ...base(), flags: { lettereLivia: 'sepolte', riconciliate: true } })).toBe(false);
    expect(holds(req, { ...base(), flags: { lettereLivia: 'liberate' } })).toBe(false);
    for (const c of CAST) expect(holds(req, { ...base(), desires: new Set(CAST.filter((x) => x !== c)) }), c).toBe(false);
    // La conoscenza di Livia non è richiesta (8 desideri su 8, quelli del cast).
    expect(JSON.stringify(req).includes('"livia"')).toBe(false);
    // Memoria ≥ 1 per almeno 4 personaggi: si provano tutte le 256 combinazioni.
    for (let mask = 0; mask < 256; mask++) {
      const memoria = Object.fromEntries(CAST.map((c, i) => [c, mask & (1 << i) ? 1 + (i % 3) : 0]));
      const count = CAST.filter((_, i) => mask & (1 << i)).length;
      expect(holds(req, { ...base(), memoria }), String(mask)).toBe(count >= 4);
    }
    expect(db.balance.memoria.trueEndingCount).toBe(4);
    expect(ending('merlettaia').requires).toBeUndefined();
    expect(ending('seppia').requires).toBeUndefined();
  });

  it('le mancanze del biglietto D: una per requisito, con il testo di cosa manca', () => {
    const e = ending('aperto');
    expect(e.missing.length).toBe(2 + CAST.length + 1);
    const req = JSON.stringify((e.requires as { all: StoryCond[] }).all.map((x) => JSON.stringify(x)).sort());
    expect(JSON.stringify(e.missing.map((m) => JSON.stringify(m.cond)).sort())).toBe(req);
    expect(e.missing.map((m) => t(m.textKey))).toContain('Non so ancora cosa vuole Zeno.');
  });

  it('fin_merlettaia: tessitura normale, quattro saluti e Livia sul vaporetto delle 18', () => {
    const lv = level('fin_merlettaia');
    expect([lv.startHour, lv.endHour, lv.columns.length, lv.autoweave]).toEqual([6, 18, 6, undefined]);
    expect(lv.goals).toContainEqual({ t: 'parte', who: 'livia', hour: 18 });
    expect(JSON.stringify(lv.goals)).toContain('"t":"almeno","n":4');
  });

  it('fin_seppia: autotessitura con il filo di Ada controllato e l\'agenda di Livia; soluzione in base.rows', () => {
    const lv = level('fin_seppia');
    expect(lv.autoweave?.controlled).toBe('ada');
    expect((lv.autoweave?.presetOccasions ?? []).length).toBeGreaterThan(0);
    const c = db.computed.get('fin_seppia');
    expect(c?.base.rows.length).toBe(lv.endHour - lv.startHour);
    const ctx = createContext(lv, {}, { balance: db.balance });
    expect(simulateAndEvaluate(lv, ctx, c?.base.rows ?? [], lv.goals ?? []).allOk).toBe(true);
  });

  it('fin_chiuso: 6→9, Livia al Molo alle 9', () => {
    const lv = level('fin_chiuso');
    expect([lv.startHour, lv.endHour]).toEqual([6, 9]);
    expect(lv.goals).toEqual([{ t: 'presso', who: 'livia', place: 'molo', hour: 9 }]);
  });

  it('fin_aperto: 5 occasioni fra 10-14 celle ammesse, obiettivi = desideri + Ada e Livia, da 1 a 20 soluzioni', () => {
    const lv = level('fin_aperto');
    const aw = lv.autoweave;
    expect(aw?.occasionSlots).toBe(5);
    expect(aw?.controlled).toBeUndefined();
    expect((aw?.allowedOccasions ?? []).length).toBeGreaterThanOrEqual(10);
    expect((aw?.allowedOccasions ?? []).length).toBeLessThanOrEqual(14);
    expect(lv.matassa).toBe(0);
    expect(lv.goals?.length).toBe(9);
    expect(lv.goals).toContainEqual({ t: 'incontra', a: 'ada', b: 'livia' });
    const c = db.computed.get('fin_aperto');
    expect(c?.occasionsSolution?.length ?? 0).toBeGreaterThan(0);
    expect(c?.occasionsSolutions ?? 0).toBeGreaterThanOrEqual(1);
    expect(c?.occasionsSolutions ?? 99).toBeLessThanOrEqual(20);
    // La soluzione tessuta da sola soddisfa tutti gli obiettivi; senza occasioni no.
    const rows = Array.from({ length: lv.endHour - lv.startHour }, (_, i) => ({ hour: lv.startHour + 1 + i, crossings: [] }));
    const run = (occ: OccasionDef[] | undefined) => simulateAndEvaluate(lv, createContext(lv, {}, { occasions: occ, balance: db.balance }), rows, lv.goals ?? []).allOk;
    expect(run(c?.occasionsSolution)).toBe(true);
    expect(run([])).toBe(false);
  });
});

describe('Archivio A3-A6', () => {
  it('fili sbiaditi con esca fra i candidati, strappi, echi, nota a margine, domande chiuse', () => {
    const esca: Record<string, string> = { arc3: 'lunardi', arc4: 'ernesto', arc5: 'clotilde', arc6: 'ada' };
    for (const id of ARCHIVES) {
      const a = level(id).archive;
      expect(a, id).toBeDefined();
      expect(a?.candidates, id).toContain(esca[id]);
      expect(Object.values(a?.answer ?? {}), id).not.toContain(esca[id]);
      expect(a?.holes.length, id).toBeGreaterThan(0);
      expect(a?.echoes.length, id).toBeGreaterThanOrEqual(5);
      expect(t(a?.marginKey ?? '').length, id).toBeGreaterThan(0);
    }
    expect(t(level('arc3').archive?.marginKey ?? '')).toBe('Uno per sei. E uno che restava.');
    expect(t(level('arc4').archive?.marginKey ?? '')).toBe('Non ancora.');
    expect(t(level('arc5').archive?.marginKey ?? '')).toContain('Chi tesse non è tessuto.');
    expect(t(level('arc5').archive?.marginKey ?? '')).toContain('Lo so.');
    expect(t(level('arc6').archive?.marginKey ?? '')).toBe('Non ho avuto il coraggio.');
    expect([level('arc3').archive?.year, level('arc4').archive?.year, level('arc5').archive?.year]).toEqual(['1958', '1951', '1630']);
  });

  it('i merletti registrati (A3-A5) si riapplicano col motore, e ogni eco cade su un incrocio registrato', () => {
    for (const id of ['arc3', 'arc4', 'arc5']) {
      const lv = level(id);
      const a = lv.archive as NonNullable<LevelDef['archive']>;
      const sim = simulate({ ...lv, matassa: 999 }, createContext(lv, {}, { balance: db.balance }), a.recorded);
      expect(sim.ok, id).toBe(true);
      for (const e of a.echoes) {
        const row = a.recorded.find((r) => r.hour === e.hour);
        expect(row?.crossings.some((c) => c.pair === e.pair), `${id} ${e.hour}/${e.pair}`).toBe(true);
      }
      // Matassa = incroci originali dello strappo.
      const hole = a.holes[0] as { from: number; to: number };
      const orig = a.recorded.filter((r) => r.hour >= hole.from && r.hour <= hole.to).reduce((n, r) => n + r.crossings.length, 0);
      expect(lv.matassa, id).toBe(orig);
    }
  });

  it('arc6 si rammenda piantando occasioni: occasionsSolution presente', () => {
    const lv = level('arc6');
    expect(lv.autoweave?.occasionSlots).toBe(2);
    expect(lv.autoweave?.controlled).toBeUndefined();
    const c = db.computed.get('arc6');
    expect(c?.occasionsSolution?.length ?? 0).toBeGreaterThan(0);
    expect(c?.occasionsSolutions ?? 0).toBeGreaterThanOrEqual(1);
    expect(lv.threads.find((x) => x.id === 'f1')?.kind).toBe('avorio');
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

  it('nessuna combinazione impossibile senza il segno voluta', () => {
    for (const id of MINE) {
      const c = db.computed.get(id);
      for (const x of c?.combos ?? []) if (x.incroci === null) expect(x.voluta, `${id} ${x.notes.join('+')}`).toBe(true);
      for (const [n, p] of Object.entries(c?.perNote ?? {})) {
        if (p.incroci === null) expect(c?.combos.some((x) => x.voluta && x.notes.length === 1 && x.notes[0] === n), n).toBe(true);
      }
    }
  });

  it('matassa = minimo della combinazione designata + margine dell\'atto (Atto II +2, Atto III +1; g13 +0)', () => {
    for (const d of [...STORY, 'fin_merlettaia', 'fin_seppia', 'fin_chiuso']) {
      const lv = level(d);
      const c = db.computed.get(d);
      const slack = db.balance.acts[String(lv.act) as '2' | '3'].slack;
      expect(slack, d).toBe(lv.act === 2 ? 2 : 1);
      expect(lv.matassa, d).toBe(d === 'g13' ? (c?.matassaSuggerita ?? 0) - slack : c?.matassaSuggerita);
    }
  });

  it('g13: con la matassa esatta, un merletto perfetto cura tutti e quattro i malati', () => {
    const lv = level('g13');
    const goals = ['g13.marta', 'g13.lunardi', 'g13.gino', 'g13.nina'].map((id) => db.notes.get(id)?.request as Condition);
    const r = solve({ level: lv, ctx: createContext(lv, {}, { balance: db.balance }), goals });
    expect(r.status).toBe('ok');
    expect(r.incroci).toBe(lv.matassa);
  });

  it('le soluzioni calcolate rispettano davvero le richieste (riprova col motore)', () => {
    for (const id of [...STORY, 'fin_merlettaia', 'fin_chiuso']) {
      const lv = level(id);
      const c = db.computed.get(id);
      const ctx = createContext(lv, {}, { balance: db.balance });
      expect(simulateAndEvaluate(lv, ctx, c?.base.rows ?? [], lv.goals ?? []).allOk, `${id} base`).toBe(true);
      for (const combo of c?.combos ?? []) {
        if (!combo.rows) continue;
        const goals = [...(lv.goals ?? []), ...combo.notes.map((n) => db.notes.get(n)?.request as Condition)];
        expect(simulateAndEvaluate(lv, ctx, combo.rows, goals).allOk, `${id} ${combo.notes.join('+')}`).toBe(true);
      }
    }
  });
});

describe('giornate: eventi della tabella del GDD 5.2', () => {
  it('colonne e ore delle giornate degli Atti II-III', () => {
    const hours: Record<string, [number, number]> = {
      g09: [6, 14], g10: [6, 16], g11: [6, 16], g12: [6, 16], g13: [6, 20], g14: [6, 16], g15: [6, 20], g16: [6, 18],
      g17: [6, 16], g18: [6, 16], g19: [6, 16], g20: [6, 14], g21: [6, 18], g22: [6, 20], g23: [6, 12],
    };
    for (const d of STORY) {
      expect([level(d).startHour, level(d).endHour], d).toEqual(hours[d]);
      expect(level(d).columns.length, d).toBe(6);
    }
  });

  it('g09 vaporetto di Lunardi alle 8; g15 Bepi rientra alle 20; g22 secca del Faro alle 15 con Livia', () => {
    expect(level('g09').edges).toContainEqual({ hour: 8, side: 'molo', kind: 'vaporetto', enters: 'lunardi' });
    expect(level('g09').pins).toContainEqual({ thread: 'lunardi', place: 'farmacia', hour: 13 });
    expect(level('g15').edges).toEqual([{ hour: 20, side: 'molo', kind: 'barca', enters: 'bepi' }]);
    expect(level('g15').initial).not.toContain('bepi');
    expect(db.notes.get('g15.nina')?.request).toEqual({
      t: 'tutti', of: [18, 19, 20].map((hour) => ({ t: 'presso', who: 'zeno', place: 'faro', hour })),
    });
    expect(level('g22').edges).toEqual([{ hour: 15, side: 'faro', kind: 'secca', enters: 'livia' }]);
    expect(level('g20').edges).toContainEqual({ hour: 9, side: 'molo', kind: 'vaporetto' });
  });

  it('g16: il fascio è indirizzato a Zeno, nel pozzo di Don Piero, che trabocca', () => {
    const lv = level('g16');
    expect(lv.beads.find((b) => b.id === 'fascio')).toMatchObject({ type: 'lettera', holder: 'piero', to: 'zeno' });
    expect(lv.quirks).toEqual(expect.arrayContaining(['pieroPozzo', 'pieroTrabocca']));
    expect(db.notes.get('g16.zeno')?.request).toEqual({ t: 'consegnata', bead: 'fascio' });
  });

  it('g17: il filo nero entra dal Faro alle 9 e segue Zeno; Zeno non deve uscire', () => {
    const lv = level('g17');
    expect(lv.nero).toMatchObject({ thread: 'livia', enter: { hour: 9, side: 'faro' } });
    expect(lv.nero?.agenda[0]).toEqual({ follow: 'zeno' });
    expect(lv.goals).toContainEqual({ t: 'resta', who: 'zeno' });
  });

  it('g18: la confessione arriva a Marta tramite il Gino e la pace toglie due stranezze e il rancore', () => {
    const req = JSON.stringify(db.notes.get('g18.teresa')?.request);
    expect(req).toContain('{"t":"ha","who":"gino","bead":"segreto:confessione"}');
    expect(req).toContain('{"t":"ha","who":"marta","bead":"segreto:confessione"}');
    const lv = level('g18');
    const ctx = createContext(lv, { riconciliate: true }, { balance: db.balance });
    expect(ctx.quirks).not.toContain('martaNoSotto');
    expect(ctx.quirks).not.toContain('teresaLegge');
    expect(ctx.rancor).toEqual([]);
  });

  it('g19 e g21: la marea', () => {
    expect(level('g19').tide).toEqual([{ from: 10, to: 13, places: ['molo', 'piazza'] }]);
    expect(level('g21').tide?.length).toBe(1);
    expect(level('g21').nero).toBeDefined();
  });
});

describe('bibbia della verità (GDD 6.1, 6.4)', () => {
  const vignetteText = (id: string): string[] =>
    STORY.flatMap((d) => level(d).dawn?.candidates ?? []).filter((v) => v.id === id).flatMap((v) => v.lines.map((l) => t(l.textKey)));

  it('i testi chiave del GDD 6.4 sono riportati alla lettera', () => {
    expect(vignetteText('g14.alba.sera')).toEqual([
      'Me l\'ha data lei, alle due. Mi è passata sopra come un\'onda.',
      'Io non ho mai saputo dire di no a quella famiglia.',
    ]);
    expect(vignetteText('g17.alba.livia')[0]).toBe('Nessuno qui sa chi sono. Va bene così. Basta che lei mi veda.');
    expect([...vignetteText('g18.alba.pace'), ...vignetteText('g18.alba.pane').slice(0, 1)]).toEqual([
      'Trent\'anni, Teresa.', 'Trenta. E non era nemmeno colpa mia, si scopre.', 'Lo so. Siediti, che il pane è caldo.',
    ]);
    expect(vignetteText('g16.alba.trabocco')).toEqual(['Credevo di custodire peccati. Erano lettere.', 'Che Dio mi perdoni la distrazione.']);
  });

  it('date e fatti coerenti con la cronologia: 1630, 1951, 1958, quattordici anni, centosessantotto lettere', () => {
    const all = [...IT.entries()].filter(([k]) => /^(atto2|atto3|finali)\./.test(k)).map(([, v]) => v).join('\n');
    const years = new Set(all.match(/\b1[6-9]\d\d\b/g) ?? []);
    expect([...years].sort()).toEqual(['1630', '1951', '1958']);
    // 14 anni (1951-1965), una lettera al mese: 168 = 3 leggibili + 165.
    expect(all).toContain('quattordici anni');
    expect(all).toContain('Centosessantotto');
    expect(all).not.toMatch(/quindici anni (di|per) lettere/i);
  });
});
