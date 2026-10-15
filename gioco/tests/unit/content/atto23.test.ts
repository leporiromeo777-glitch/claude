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
import type { CharacterId, Condition, ContentDB, Effect, LevelDef, NoteDef, OccasionDef, StoryCond, VignetteDef } from '../../../src/core/types';
import { loadContent } from '../../../src/content/loader';
import { validateContent } from '../../../src/content/validate';
import { buildCatalogs, loadI18nSources } from '../../../src/core/i18n';
import { SOLVER_VERSION, createContext, levelSourceHashFromDB, simulate, simulateAndEvaluate, solve } from '../../../src/engine/index';
import { archiveParams, camp, choose, completeArchive, completeDay, completeFinal, finalParams, finishArchivePhase, finishBilancio, finishDawn, markObjectSeen, newCampaign, readDawnObject, startNight, currentNightParams } from '../../../src/campaign/flow';
import { choiceCards } from '../../../src/campaign/endings';
import { eveningItems, isAnonymous, pinNote, pinsLeft, replyNote } from '../../../src/campaign/evening';
import { evalStory } from '../../../src/campaign/story';
import { simulateNight } from '../../../src/campaign/simulate';
import type { CampaignStateX } from '../../../src/campaign/types';
import { defaultSaveData } from '../../../src/core/save/defaults';
import type { Knowledge, NightOutcome, RowMoves, SaveData } from '../../../src/core/types';
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
  /** Bigliettini riusciti (per le varianti con `availableIf: {ok}`). */
  ok?: Set<string>;
}
function holds(c: StoryCond, s: Story): boolean {
  if ('all' in c) return c.all.every((x) => holds(x, s));
  if ('any' in c) return c.any.some((x) => holds(x, s));
  if ('not' in c) return !holds(c.not, s);
  if ('done' in c) return s.done.has(c.done);
  if ('ok' in c) return s.ok?.has(c.ok) ?? false;
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
  // Revisione 1: le varianti di g19 (dopo la pace) e di g22 (Teresa aveva riconosciuto Livia in g17).
  { done: new Set(['arc1', 'arc3']), memoria: Object.fromEntries(CAST.map((c) => [c, 1])), flags: { riconciliate: true }, desires: new Set(), ok: new Set(['g17.teresa']) },
];
const available = (day: string, s: Story): NoteDef[] => notesOf(day).filter((n) => !n.availableIf || holds(n.availableIf, s));

/** Combinazioni di k bigliettini con richiesta (mai due varianti dello stesso autore insieme). */
function combosOf(day: string, k: number): NoteDef[][] {
  const withReq = notesOf(day).filter((n) => n.request !== undefined);
  const out: NoteDef[][] = [];
  const rec = (start: number, acc: NoteDef[]): void => {
    if (acc.length === k) {
      if (new Set(acc.map((n) => n.author)).size === k) out.push([...acc]);
      return;
    }
    for (let i = start; i < withReq.length; i++) rec(i + 1, [...acc, withReq[i] as NoteDef]);
  };
  rec(0, []);
  return out;
}
const costCache = new Map<string, number | null>();
/** Minimo di incroci per gli obiettivi più le richieste, entro la matassa del livello (null se impossibile). */
function pairCost(day: string, combo: NoteDef[]): number | null {
  const ids = combo.map((n) => n.id).sort();
  const key = `${day}:${ids.join('+')}`;
  if (costCache.has(key)) return costCache.get(key) ?? null;
  const c = db.computed.get(day);
  let v: number | null | undefined;
  if (ids.length === 1) v = c?.perNote[ids[0] as string]?.incroci;
  else v = c?.combos.find((x) => [...x.notes].sort().join('+') === ids.join('+'))?.incroci;
  if (v === undefined) {
    const lv = level(day);
    const r = solve({ level: lv, ctx: createContext(lv, {}, { balance: db.balance }), goals: [...(lv.goals ?? []), ...combo.map((n) => n.request as Condition)] });
    v = r.status === 'ok' ? (r.incroci ?? null) : null;
  }
  costCache.set(key, v);
  return v;
}

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

  // Revisione 1: gli esiti dei bigliettini (C05), i tutorial e i nuovi epiloghi alzano il conteggio.
  it('il report: parole italiane del pacchetto tra 9.000 e 14.000', () => {
    const own = [...IT.entries()].filter(([k]) => /^(atto2|atto3|finali)\./.test(k));
    const words = own.reduce((n, [, v]) => n + v.split(/\s+/).filter(Boolean).length, 0);
    console.info(`contenuti-atti23: ${own.length} testi, ${words} parole italiane`);
    expect(words).toBeGreaterThanOrEqual(9000);
    expect(words).toBeLessThanOrEqual(14000);
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

  it('g23: due bigliettini semplici la sera, poi quattro biglietti con ending A merlettaia, B seppia, C chiuso, D aperto (GDD 6.6)', () => {
    const textOf: Record<string, string> = {
      merlettaia: 'Resta. L\'isola ha bisogno di una merlettaia, e tua madre ha bisogno di andarsene libera, stavolta.',
      seppia: 'Dammi il tombolo, Ada. Tu vivi. Io ho già vissuto abbastanza fuori.',
      chiuso: 'Rimandala via, come ho fatto io. Funziona.',
      aperto: 'Il punto aperto.',
    };
    const authors: Record<string, string> = { seppia: 'livia', chiuso: 'clotilde', aperto: 'ada' };
    for (const s of STATES) {
      // La sera prima della notte di g23: due richieste semplici (D14); la scelta usa gli altri quattro.
      const sera = available('g23', s).filter((n) => !n.ending);
      expect(sera.length).toBe(2);
      expect(sera.every((n) => n.request !== undefined)).toBe(true);
      const ns = available('g23', s).filter((n) => n.ending);
      expect(ns.length).toBe(4);
      expect(ns.map((n) => n.ending).sort()).toEqual(['aperto', 'chiuso', 'merlettaia', 'seppia']);
      for (const n of ns) {
        if (n.ending !== 'merlettaia' || n.author === 'zeno') expect(t(n.textKey)).toBe(textOf[n.ending as string]);
        else expect(t(n.textKey)).toMatch(/^(Resti|Resta|Cara, resta|Resto io)\b/);
        expect(n.request).toBeUndefined();
        if (n.ending !== 'merlettaia') expect(n.author).toBe(authors[n.ending as string]);
      }
      // A è di Zeno; se Zeno ha dimenticato Ada, di Don Piero, poi di Marta, poi di Teresa (revisione 2, Q045):
      // chi ha dimenticato Ada non firma. Se l'hanno dimenticata tutti e quattro, se lo scrive Ada da sola.
      const a = ns.find((n) => n.ending === 'merlettaia') as NoteDef;
      const firma = (['zeno', 'piero', 'marta', 'teresa'] as const).find((c) => (s.memoria[c] ?? 0) >= 1) ?? 'ada';
      expect(a.author).toBe(firma);
    }
    expect(db.campaign.days.find((d) => d.id === 'g23')?.pins).toBe(2);
  });

  it('ogni bigliettino citato da un livello esiste, e ogni bigliettino del pacchetto è citato dal suo giorno', () => {
    for (const d of STORY) for (const id of level(d).notes ?? []) expect(db.notes.get(id)?.day, id).toBe(d);
    for (const n of MY_NOTES) expect(level(n.day).notes ?? [], n.id).toContain(n.id);
  });

  it('3-5 vignette dell\'alba per giornata (una variante conta con la sua scena), con condizioni sui flag di storia', () => {
    for (const d of STORY) {
      const all = level(d).dawn?.candidates ?? [];
      // Una variante ha l'id della sua scena più un suffisso (g19.alba.medicine.pace).
      const cs = all.filter((v) => !all.some((w) => w !== v && v.id.startsWith(`${w.id}.`)));
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

  it('almeno un conflitto per sera: una combinazione impossibile e voluta (K6, anche in g13)', () => {
    for (const d of DAYS) {
      const c = db.computed.get(d);
      expect(c?.combos.some((x) => x.incroci === null && x.voluta), d).toBe(true);
    }
  });

  it('stranezze attive per giornata: ninaCuriosa, lunardiCura da g09, rancore da g11, pieroTrabocca da g16', () => {
    for (const d of DAYS) {
      const lv = level(d);
      expect(lv.quirks, d).toContain('ninaCuriosa');
      expect(lv.quirks, d).toContain('lunardiCura');
      // Il trabocco vale da g16 dove c'è Don Piero (revisione 1: in g19 non c'è, e la stranezza farebbe solo
      // tracciare al solver lettere e segreti senza effetto, moltiplicando le soluzioni ottime: K5).
      const piero = lv.threads.some((x) => x.character === 'piero');
      expect(lv.quirks.includes('pieroTrabocca'), d).toBe(Number(d.slice(1)) >= 16 && (piero || d !== 'g19'));
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
    // Revisione 1 (CA23-03): Lunardi torna col vaporetto delle nove e chiede il nome ad almeno tre persone.
    expect(req).toEqual({ t: 'tutti', of: [{ t: 'ha', who: 'lunardi', bead: 'nome' }, { t: 'incontriAlmeno', who: 'lunardi', n: 3 }] });
    expect(level('g12').edges).toContainEqual({ hour: 9, side: 'molo', kind: 'vaporetto', enters: 'lunardi' });
    const okWith = (nomeOn: string): boolean =>
      solve({ level: lv, ctx: createContext(lv, {}, { nomeOn, balance: db.balance }), goals: [...(lv.goals ?? []), req] }).status === 'ok';
    expect(okWith('marta')).toBe(true);
    expect(okWith('teresa')).toBe(true);
    // Con il nome su Marta (la scelta migliore di levels:check) la richiesta è compatibile con tutte le altre:
    // il conflitto voluto della sera è Bepi + Teresa. levels:check prova da sé le scelte di nomeOn.
    expect(db.computed.get('g12')?.perNote['g12.lunardi']?.nomeOn).toBe('marta');
    const ctx = createContext(lv, {}, { nomeOn: 'marta', balance: db.balance });
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

  it('ogni desiderio degli Atti II-III si può scoprire con una risposta (senza spendere uno spillo)', () => {
    for (const c of ['teresa', 'marta', 'piero', 'bepi', 'zeno', 'lunardi', 'gino']) {
      const viaReply = MY_NOTES.some((n) => (n.replies ?? []).some((r) => r.effects.some((e) => 'desire' in e && e.desire === c)));
      expect(viaReply, c).toBe(true);
    }
    // Don Piero (GDD 5.4: lettera di Clotilde in g14, poi g16): entrambe le risposte di g16.piero lo rivelano.
    for (const r of db.notes.get('g16.piero')?.replies ?? []) expect(r.effects, r.id).toContainEqual({ desire: 'piero' });
  });

  it('ogni risposta ha una conseguenza visibile (desiderio o voce del Taccuino, GDD 4.2)', () => {
    const diary = [...db.diary.values()];
    for (const n of MY_NOTES) {
      for (const r of n.replies ?? []) {
        const direct = r.effects.some((e) => 'desire' in e || 'diary' in e);
        const viaCond = diary.some((d) => JSON.stringify(d.unlock).includes(JSON.stringify({ reply: n.id, is: r.id })));
        expect(direct || viaCond, `${n.id} ${r.id}`).toBe(true);
        for (const e of r.effects) if ('diary' in e) expect(db.diary.has(e.diary), `${n.id} ${r.id} → ${e.diary}`).toBe(true);
      }
    }
  });

  it('bigliettini anonimi (da g13 la memoria può essere 0): né il testo né le risposte nominano l\'autore', () => {
    const NAMES: Partial<Record<CharacterId, RegExp>> = {
      teresa: /\bTeresa\b/, marta: /\bMarta\b/, piero: /\bPiero\b/, gino: /\bGino\b/,
      bepi: /\bBepi\b/, nina: /\bNina\b/, zeno: /\bZeno\b/, lunardi: /\bLunardi\b/,
    };
    for (const n of MY_NOTES) {
      if (Number(n.day.slice(1)) < 13 || n.ending) continue;
      const re = NAMES[n.author];
      if (!re) continue;
      expect(re.test(t(n.textKey)), `${n.id} testo`).toBe(false);
      for (const r of n.replies ?? []) expect(re.test(t(r.textKey)), `${n.id} ${r.id}`).toBe(false);
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

  // Destini che cambiano gli epiloghi (GDD 5.1): nina, bepi, zenoLivia. Tutte le 8 combinazioni.
  const FATE_STATES: Story[] = [];
  for (const nina of ['parte', 'resta']) for (const bepi of ['salvo', 'ferito']) for (const zenoLivia of [true, false]) {
    FATE_STATES.push({ done: new Set(), memoria: {}, flags: { nina, bepi, zenoLivia }, desires: new Set() });
  }
  const visibleEpilogue = (id: string, s: Story) => ending(id).epilogue.filter((v) => !v.when || holds(v.when, s));

  it('quattro finali: livelli, epiloghi di 3-4 vignette (8 nel finale vero) per ogni combinazione di destini, chiuso non conta come finale', () => {
    expect([...db.endings.keys()].sort()).toEqual(['aperto', 'chiuso', 'merlettaia', 'seppia']);
    for (const [id, e] of db.endings) {
      expect(e.level).toBe(db.campaign.finals[id]);
      expect(e.countsAsEnding, id).toBe(id !== 'chiuso');
      for (const s of FATE_STATES) {
        const vis = visibleEpilogue(id, s);
        // D14: il finale vero aggiunge le vignette che chiudono i desideri e il nastro.
        const [lo, hi] = id === 'aperto' ? [8, 8] : [3, 4];
        expect(vis.length, `${id} ${JSON.stringify(s.flags)}`).toBeGreaterThanOrEqual(lo);
        expect(vis.length, `${id} ${JSON.stringify(s.flags)}`).toBeLessThanOrEqual(hi);
      }
    }
    // L'ultima riga di ogni epilogo è quella del GDD 6.6, qualunque siano i destini.
    const lastLines: Record<string, string> = {
      merlettaia: 'Il sole è sorto ogni giorno. Nessuno ha mai saputo perché.',
      seppia: 'Mia madre tesse ancora. Lo so perché ogni tanto il giorno è più gentile di quanto dovrebbe.',
      aperto: 'Per un autunno e un inverno ho imparato a comandare le persone. Poi ho imparato a conoscerle.',
      chiuso: 'Il punto di Clotilde: chi lo ripete, lo ripete per sempre.',
    };
    for (const s of FATE_STATES) {
      for (const [id, line] of Object.entries(lastLines)) {
        const last = visibleEpilogue(id, s).at(-1)?.lines.map((l) => t(l.textKey)).join(' ') ?? '';
        expect(last.endsWith(line), `${id} ${JSON.stringify(s.flags)}`).toBe(true);
      }
    }
  });

  it('gli epiloghi cambiano con i destini nina, bepi e zenoLivia (GDD 5.1)', () => {
    const text = (id: string, s: Story) => visibleEpilogue(id, s).flatMap((v) => v.lines.map((l) => t(l.textKey))).join('\n');
    const pick = (flags: Story['flags']) => FATE_STATES.find((s) => JSON.stringify(s.flags) === JSON.stringify({ nina: 'parte', bepi: 'salvo', zenoLivia: true, ...flags })) as Story;
    expect(text('merlettaia', pick({ zenoLivia: true }))).not.toBe(text('merlettaia', pick({ zenoLivia: false })));
    expect(text('merlettaia', pick({ nina: 'parte' }))).not.toBe(text('merlettaia', pick({ nina: 'resta' })));
    expect(text('seppia', pick({ nina: 'parte' }))).not.toBe(text('seppia', pick({ nina: 'resta' })));
    expect(text('aperto', pick({ bepi: 'salvo' }))).not.toBe(text('aperto', pick({ bepi: 'ferito' })));
    // Se la Nina è rimasta, nessun epilogo la fa già maestra a Venezia; se è partita, il seppia non la fa partire a settembre con Ada.
    expect(text('seppia', pick({ nina: 'parte' }))).not.toContain('ho preso il vaporetto con la Nina');
    expect(text('merlettaia', pick({ nina: 'resta' }))).not.toContain('ci insegna');
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

  it('fin_merlettaia (D14): i saluti si fanno dando, almeno 4 su 6, conflitto voluto agli estremi della Fondamenta, base ≥ 8', () => {
    const lv = level('fin_merlettaia');
    const almeno = (lv.goals ?? []).find((g) => g.t === 'almeno') as Extract<Condition, { t: 'almeno' }>;
    expect(almeno.n).toBe(4);
    expect(almeno.of.length).toBe(6);
    // Chi saluta passa sopra a Livia (chi sta sopra dà), entro un'ora.
    for (const g of almeno.of) expect(g).toMatchObject({ t: 'sopra', b: 'livia' });
    const entro = Object.fromEntries(almeno.of.map((g) => [(g as { a: string }).a, (g as { to: number }).to]));
    expect(Object.keys(entro).sort()).toEqual(['bepi', 'lunardi', 'marta', 'piero', 'teresa', 'zeno']);
    // Il Bepi dal Molo e Zeno dal Faro, alla stessa ora: tutti e due non si può.
    expect(entro.bepi).toBe(entro.zeno);
    expect(lv.edges).toContainEqual({ hour: 13, side: 'molo', kind: 'barca', enters: 'bepi' });
    expect(lv.pins).toContainEqual({ thread: 'zeno', place: 'faro', hour: 18 });
    const ctx = createContext(lv, {}, { balance: db.balance });
    const both = [almeno.of.find((g) => (g as { a: string }).a === 'bepi'), almeno.of.find((g) => (g as { a: string }).a === 'zeno'), { t: 'parte', who: 'livia', hour: 18 }] as Condition[];
    expect(solve({ level: lv, ctx, goals: both, matassa: 99 }).status).toBe('impossibile');
    const c = db.computed.get('fin_merlettaia');
    expect(c?.base.incroci ?? 0).toBeGreaterThanOrEqual(8);
    expect(c?.quality?.violazioni ?? []).toEqual([]);
  }, 60_000);

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
    // Revisione 2 (Q042): niente Nina nel finale vero (è già partita in g20, o partirà a settembre); il Bepi prende il vaporetto.
    expect(lv.goals?.length).toBe(8);
    expect(lv.goals).toContainEqual({ t: 'incontra', a: 'ada', b: 'livia' });
    expect(lv.goals).toContainEqual({ t: 'parte', who: 'bepi', hour: 9 });
    expect(JSON.stringify(lv.goals)).not.toContain('"nina"');
    expect(lv.threads.map((x) => x.id)).not.toContain('nina');
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

  it('criteri di qualità C14 (revisione 1): quality.violazioni vuoto per ogni livello del pacchetto, conflitto voluto e al più un facile per sera', () => {
    for (const id of MINE) {
      const c = db.computed.get(id);
      expect(c?.quality, id).toBeDefined();
      expect(c?.quality?.violazioni ?? ['assente'], id).toEqual([]);
    }
    for (const d of DAYS) {
      const q = db.computed.get(d)?.quality;
      expect(q?.facili.length ?? 0, d).toBeLessThanOrEqual(1);
      // Il facile è in un conflitto voluto con un altro bigliettino della sera (C14, K2).
      for (const f of q?.facili ?? []) {
        expect(db.computed.get(d)?.combos.some((x) => x.voluta && x.notes.length >= 2 && x.notes.includes(f)), `${d} ${f}`).toBe(true);
      }
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
    for (const d of ['fin_merlettaia', 'fin_seppia', 'fin_chiuso']) {
      expect(level(d).matassa, d).toBe(db.computed.get(d)?.matassaSuggerita);
    }
    // Giornate: la combinazione designata è la più cara fra quelle possibili con al massimo `pins` spilli
    // (levels:check calcola solo quelle con esattamente `pins` bigliettini: le coppie dell'Atto III si calcolano qui).
    for (const d of STORY) {
      const lv = level(d);
      const c = db.computed.get(d) as NonNullable<ReturnType<typeof db.computed.get>>;
      const slack = db.balance.acts[String(lv.act) as '2' | '3'].slack;
      expect(slack, d).toBe(lv.act === 2 ? 2 : 1);
      let designated = c.base.incroci;
      for (const p of Object.values(c.perNote)) if (p.incroci !== null) designated = Math.max(designated, p.incroci);
      for (const x of c.combos) if (x.incroci !== null && !x.voluta) designated = Math.max(designated, x.incroci);
      for (const pair of combosOf(d, 2)) {
        const r = pairCost(d, pair);
        if (r !== null) designated = Math.max(designated, r);
      }
      expect(lv.matassa, d).toBe(designated + (d === 'g13' ? 0 : slack));
    }
  }, 120_000);

  it('nessun conflitto nascosto dalla matassa: ogni combinazione possibile senza limite sta anche nella matassa', () => {
    for (const d of DAYS) {
      if (d === 'g12') continue; // la richiesta di Lunardi dipende dal nome appuntato: vedi il test di g12
      if (d === 'g13') continue; // in g13 il conflitto voluto è proprio la matassa esatta: vedi il test di g13
      const pins = db.campaign.days.find((x) => x.id === d)?.pins ?? 2;
      for (let k = 1; k <= pins; k++) {
        for (const combo of combosOf(d, k)) {
          if (pairCost(d, combo) !== null) continue;
          // Impossibile entro la matassa: deve esserlo anche senza limite (conflitto di regole, non di filo).
          const lv = level(d);
          const goals = [...(lv.goals ?? []), ...combo.map((n) => n.request as Condition)];
          const free = solve({ level: lv, ctx: createContext(lv, {}, { balance: db.balance }), goals, matassa: 99 });
          expect(free.status, `${d} ${combo.map((n) => n.id).join('+')}`).toBe('impossibile');
        }
      }
    }
  }, 300_000);

  it('g13 (revisione 1): il filo contato è il conflitto voluto; la designata si tesse solo con un merletto perfetto', () => {
    const lv = level('g13');
    const c = db.computed.get('g13');
    const ctx = createContext(lv, {}, { balance: db.balance });
    const req = (id: string): Condition => db.notes.get(id)?.request as Condition;
    // Margine 0: la matassa è il minimo della designata.
    const des = c?.quality?.configs.find((x) => x.config === c?.quality?.designata);
    expect(lv.matassa).toBe(des?.min);
    // Le coppie volute non stanno nel filo della notte; almeno una si tesserebbe con più filo: è la scelta
    // di chi curare (il medico ha gambe per uno, e il filo è contato).
    const volute = (c?.combos ?? []).filter((x) => x.voluta && x.notes.length === 2);
    expect(volute.length).toBeGreaterThanOrEqual(1);
    let soloFilo = 0;
    for (const v of volute) {
      const goals = [...(lv.goals ?? []), ...v.notes.map(req)];
      expect(solve({ level: lv, ctx, goals }).status, v.notes.join('+')).toBe('impossibile');
      const free = solve({ level: lv, ctx, goals, matassa: 99 });
      if (free.status === 'ok') {
        expect(free.incroci ?? 0, v.notes.join('+')).toBeGreaterThan(lv.matassa);
        soloFilo++;
      }
    }
    expect(soloFilo).toBeGreaterThanOrEqual(1);
    // Tutti e quattro non si curano con il filo della notte.
    const all = ['g13.marta', 'g13.lunardi', 'g13.gino', 'g13.nina'].map(req);
    expect(solve({ level: lv, ctx, goals: all }).status).toBe('impossibile');
    // Il Gino a letto finché ha la febbre: la febbre è attiva e Gino è fra i malati.
    expect(lv.beads.find((b) => b.type === 'febbre')?.holders).toEqual(expect.arrayContaining(['gino', 'bepi', 'nina', 'piero']));
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
    // Revisione 1 (CA23-03): la Nina aspetta il babbo al Molo alle 19 (la barca delle 20 porta via chi è al Molo).
    expect(db.notes.get('g15.nina')?.request).toEqual({
      t: 'tutti', of: [...[18, 19, 20].map((hour) => ({ t: 'presso', who: 'zeno', place: 'faro', hour })), { t: 'presso', who: 'nina', place: 'molo', hour: 19 }],
    });
    expect(level('g22').edges).toEqual([{ hour: 15, side: 'faro', kind: 'secca', enters: 'livia' }]);
    expect(level('g20').edges).toContainEqual({ hour: 9, side: 'molo', kind: 'vaporetto' });
  });

  it('g16: il fascio è indirizzato a Zeno, nel pozzo di Don Piero, che trabocca', () => {
    const lv = level('g16');
    expect(lv.beads.find((b) => b.id === 'fascio')).toMatchObject({ type: 'lettera', holder: 'piero', to: 'zeno' });
    expect(lv.quirks).toEqual(expect.arrayContaining(['pieroPozzo', 'pieroTrabocca']));
    // Revisione 1 (C14): il fascio arriva a Zeno entro le cinque.
    expect(db.notes.get('g16.zeno')?.request).toEqual({ t: 'consegnata', bead: 'fascio', by: 17 });
    expect(t('atto2.g16.zeno.testo')).toContain('entro le cinque');
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

  it('debutto delle stranezze (GDD 3.6): in g09 (lunardiCura) e g16 (pieroTrabocca) nessuna richiesta fallisce per colpa loro', () => {
    for (const [d, quirk] of [['g09', 'lunardiCura'], ['g16', 'pieroTrabocca']] as const) {
      const lv = level(d);
      const withQ = createContext(lv, {}, { balance: db.balance });
      const noQ = { ...withQ, quirks: withQ.quirks.filter((q) => q !== quirk) };
      for (const combo of [[], ...combosOf(d, 1), ...combosOf(d, 2)]) {
        const goals = [...(lv.goals ?? []), ...combo.map((n) => n.request as Condition)];
        if (solve({ level: lv, ctx: noQ, goals }).status !== 'ok') continue;
        expect(solve({ level: lv, ctx: withQ, goals }).status, `${d} ${combo.map((n) => n.id).join('+')}`).toBe('ok');
      }
    }
  }, 120_000);

  it('zenoFaro (GDD 3.6): Zeno è a due luoghi al massimo dal Faro già all\'alba e in ogni soluzione calcolata', () => {
    for (const id of [...STORY, ...FINALS, ...ARCHIVES]) {
      const lv = level(id);
      const z = lv.threads.find((x) => x.character === 'zeno');
      if (!z || !lv.quirks.includes('zenoFaro')) continue;
      const faro = lv.columns.includes('faro') ? lv.columns.indexOf('faro') : lv.columns.length - 1;
      expect(Math.abs(lv.initial.indexOf(z.id) - faro), `${id} all'alba`).toBeLessThanOrEqual(2);
      const c = db.computed.get(id);
      const ctx = createContext(lv, {}, { balance: db.balance, occasions: c?.occasionsSolution });
      const sols = [c?.base.rows ?? [], ...(c?.combos ?? []).flatMap((x) => (x.rows ? [x.rows] : []))];
      for (const rows of sols) {
        const sim = simulate({ ...lv, matassa: 999 }, ctx, rows);
        for (const st of sim.timeline) {
          const col = st.pos.indexOf(z.id);
          if (col >= 0) expect(Math.abs(col - faro), `${id} alle ${st.hour}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('g21: Zeno è al Faro all\'alba e deve spostarsi prima delle 8, quando entra il filo nero', () => {
    const lv = level('g21');
    expect(lv.initial[lv.columns.indexOf('faro')]).toBe('zeno');
    expect(lv.nero).toMatchObject({ enter: { hour: 8, side: 'faro' }, agenda: [{ follow: 'piero' }, { follow: 'zeno' }] });
    const req = db.notes.get('g21.zeno')?.request as Condition;
    const r = solve({ level: lv, ctx: createContext(lv, {}, { balance: db.balance }), goals: [...(lv.goals ?? []), req] });
    expect(r.status).toBe('ok');
    const sim = simulate(lv, createContext(lv, {}, { balance: db.balance }), r.rows ?? []);
    expect(sim.timeline.find((s) => s.hour === 8)?.pos.at(-1)).toBe('livia');
    expect(sim.timeline.every((s) => s.offboard.every((o) => o.thread !== 'zeno'))).toBe(true);
  });

  it('vignette dei destini: valgono sia col flag sia con l\'esito del bigliettino che lo decide', () => {
    const when = (d: string, id: string): string => JSON.stringify(level(d).dawn?.candidates.find((v) => v.id === id)?.when ?? null);
    const cases: [string, string, string, string][] = [
      ['g15', 'g15.alba.luce', '"flag":"bepi","eq":"salvo"', '{"ok":"g15.nina"}'],
      ['g15', 'g15.alba.secca', '"flag":"bepi","eq":"ferito"', '{"failed":"g15.nina"}'],
      ['g18', 'g18.alba.pace', '"flag":"riconciliate","eq":true', '{"ok":"g18.teresa"}'],
      ['g20', 'g20.alba.parte', '"flag":"nina","eq":"parte"', '{"ok":"g20.nina"}'],
      ['g20', 'g20.alba.resta', '"flag":"nina","eq":"resta"', '{"failed":"g20.nina"}'],
      ['g22', 'g22.alba.perdono', '"flag":"zenoLivia","eq":true', '{"ok":"g22.zeno"}'],
    ];
    for (const [d, id, flag, outcome] of cases) {
      expect(when(d, id), id).toContain(flag);
      expect(when(d, id), id).toContain(outcome);
    }
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
      'Trent\'anni, Teresa.', 'Trenta. E non era solo colpa mia, si scopre: me l\'ha detto la piccola.', 'Lo so. Siediti, che il pane è caldo.',
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

  it('la lettera della nonna è rimasta a Zeno dalla notte del prologo fino a g14, non «per una notte»', () => {
    const entry = [...db.diary.values()].find((d) => d.id === 'persone.zeno.lettera');
    // Revisione 1 (C03): la voce arriva quando Ada legge la lettera, alla fine dell'alba di g14.
    expect(entry?.unlock).toEqual({ knows: 'oggetto', id: 'lettera_clotilde' });
    expect(t('atto2.diario.persone.zeno.lettera')).toContain('per tutto questo tempo');
    expect(t('atto2.diario.persone.zeno.lettera')).not.toContain('per una notte');
  });
});

// ═════════════════════ Revisione 1 (REVISIONE-1.md, gruppo contenuti-atti23) ═════════════════════
const EN = catalogs.tables.en;
const te = (key: string): string => EN.get(key) ?? '';

// ───────── Campagna simulata per il Taccuino (C03, C04, D09, D10) ─────────
// Momenti della campagna dalla sera di g09 alla sera della scelta: sera (oggetto della sera prima letto),
// fine della notte (giornata fatta), oggetto dell'alba letto, Archivio rammendato. Per ogni voce del Taccuino
// si calcola se *può* essere sbloccata (qualche esito dei bigliettini la rende vera) e se *deve* esserlo.
interface Moment { label: string; day: number; night: boolean; done: Set<string>; objects: Set<string>; mayObjects: Set<string> }
interface Tri { may: boolean; must: boolean }
const DAY_IDS = db.campaign.days.map((d) => d.id);
const noteDay = (id: string): number => DAY_IDS.indexOf(db.notes.get(id)?.day ?? '');
const effectsOf = (n: NoteDef): Effect[] => [...(n.onOk ?? []), ...(n.onFail ?? []), ...(n.onIgnore ?? []), ...(n.replies ?? []).flatMap((r) => r.effects)];
/** Prima giornata in cui un bigliettino può far conoscere il desiderio (Infinity se nessuno). */
function desireDay(c: string): number {
  let best = Number.POSITIVE_INFINITY;
  for (const n of db.notes.values()) if (effectsOf(n).some((e) => 'desire' in e && e.desire === c)) best = Math.min(best, noteDay(n.id));
  return best;
}
function flagMay(c: { flag: string; eq?: unknown }, m: Moment): boolean {
  for (const n of db.notes.values()) {
    if (noteDay(n.id) > m.day) continue;
    for (const e of effectsOf(n)) {
      if ('setFlag' in e && e.setFlag === c.flag && (c.eq === undefined || e.value === c.eq)) return true;
      if ('addFlag' in e && e.addFlag === c.flag && c.eq === undefined) return true;
    }
  }
  return false;
}
function tri(c: StoryCond, m: Moment, depth = 0): Tri {
  if ('all' in c) {
    const xs = c.all.map((x) => tri(x, m, depth));
    return { may: xs.every((x) => x.may), must: xs.every((x) => x.must) };
  }
  if ('any' in c) {
    const xs = c.any.map((x) => tri(x, m, depth));
    return { may: xs.some((x) => x.may), must: xs.some((x) => x.must) };
  }
  if ('not' in c) {
    const x = tri(c.not, m, depth);
    return { may: !x.must, must: !x.may };
  }
  if ('done' in c) return { may: m.done.has(c.done), must: m.done.has(c.done) };
  if ('knows' in c) {
    if (c.knows === 'oggetto') return { may: m.objects.has(c.id) || m.mayObjects.has(c.id), must: m.objects.has(c.id) };
    if (c.knows === 'diary') {
      const d = db.diary.get(c.id);
      return d && depth < 8 ? tri(d.unlock, m, depth + 1) : { may: true, must: false };
    }
    if (c.knows === 'desire') return { may: desireDay(c.id) <= m.day, must: false };
    return { may: true, must: false };
  }
  if ('ok' in c || 'failed' in c || 'ignored' in c) {
    const d = noteDay('ok' in c ? c.ok : 'failed' in c ? c.failed : c.ignored);
    return { may: d >= 0 && (d < m.day || (d === m.day && m.night)), must: false };
  }
  if ('accepted' in c || 'reply' in c) {
    const d = noteDay('accepted' in c ? c.accepted : c.reply);
    return { may: d >= 0 && d <= m.day, must: false };
  }
  if ('flag' in c) return { may: flagMay(c, m), must: false };
  return { may: true, must: false }; // eventi della notte, memoria
}
function campaignMoments(): Moment[] {
  const out: Moment[] = [];
  const done = new Set<string>();
  const objects = new Set<string>();
  const mayObjects = new Set<string>();
  const add = (o: string): void => {
    // Il fascio arriva solo se le lettere sono liberate (C04): può esserci, non deve.
    if (o === 'fascio_lettere') ['fascio_lettere', 'fascio_1', 'fascio_2', 'fascio_3'].forEach((x) => mayObjects.add(x));
    else objects.add(o);
  };
  const start = DAY_IDS.indexOf('g09');
  const snap = (label: string, day: number, night: boolean): void => {
    if (day >= start) out.push({ label, day, night, done: new Set(done), objects: new Set(objects), mayObjects: new Set(mayObjects) });
  };
  db.campaign.days.forEach((d, i) => {
    const prev = db.campaign.days[i - 1];
    if (prev?.objectAfter) add(prev.objectAfter);
    snap(`sera ${d.id}`, i, false);
    done.add(d.id);
    snap(`notte ${d.id}`, i, true);
    if (d.dawnObject) {
      add(d.dawnObject);
      snap(`oggetto ${d.id}`, i, true);
    }
    if (d.archiveAfter) {
      done.add(d.archiveAfter);
      snap(`archivio ${d.archiveAfter}`, i, true);
    }
  });
  const last = db.campaign.days[db.campaign.days.length - 1];
  if (last?.objectAfter) add(last.objectAfter);
  snap('scelta', db.campaign.days.length - 1, true);
  return out;
}
const MOMENTS = campaignMoments();
const momentAt = (label: string): Moment => {
  const m = MOMENTS.find((x) => x.label === label);
  if (!m) throw new Error(`momento ${label} assente`);
  return m;
};

describe('revisione 1: la rivelazione di g14, il fascio, le piste (CA23-01)', () => {
  it('campaign.json: lettera di Clotilde e fascio consegnati all\'alba di g14 e g16, sere vuote di g15 e g17 con il loro testo', () => {
    const day = (id: string) => db.campaign.days.find((d) => d.id === id);
    expect(day('g14')?.dawnObject).toBe('lettera_clotilde');
    expect(day('g16')?.dawnObject).toBe('fascio_lettere');
    expect(t(day('g15')?.eveningEmptyKey ?? '')).toBe('Stasera la laguna non porta niente: è nera, e si alza il vento.');
    expect(t(day('g17')?.eveningEmptyKey ?? '')).toBe('Sotto la porta non c\'è niente. Fuori, qualcuno cammina sulla Fondamenta.');
    for (const id of ['g15', 'g17']) expect(te(day(id)?.eveningEmptyKey ?? '').length, id).toBeGreaterThan(10);
  });

  it('g14: la consegna di Zeno è un culmine senza condizione, ed è l\'ultima vignetta (dopo esce la lettera)', () => {
    const cs = level('g14').dawn?.candidates ?? [];
    const sera = cs.at(-1) as VignetteDef;
    expect(sera.id).toBe('g14.alba.sera');
    expect(sera.when).toBeUndefined();
    // Tutte culmini: escono tutte e nell'ordine dei dati (D11), così la consegna chiude l'alba.
    expect(cs.every((v) => v.priority >= 100)).toBe(true);
    const fascio = level('g16').dawn?.candidates ?? [];
    expect(fascio.filter((v) => v.priority >= 100).at(-1)?.id).toBe('g16.alba.fascio');
  });

  it('campagna simulata: fra la fine della notte di g14 e la lettura nessuna voce può dire chi è Livia', () => {
    const before = momentAt('notte g14');
    const bad = [...db.diary.values()]
      .filter((d) => tri(d.unlock, before).may && /\bLivia\b|\bmia madre\b/i.test(t(d.textKey)))
      .map((d) => d.id);
    expect(bad).toEqual([]);
    // Letta la lettera (prima del bilancio), le voci della rivelazione ci sono.
    const after = momentAt('oggetto g14');
    for (const id of ['domande.chiL.risposta', 'persone.ada.g14', 'domande.madre.apre', 'lettere.clotilde', 'domande.avorio.lettera', 'persone.zeno.lettera']) {
      expect(tri(db.diary.get(id)?.unlock as StoryCond, after).must, id).toBe(true);
    }
  });

  it('il Taccuino ricorda, non anticipa: le voci sugli oggetti si sbloccano alla lettura (C03)', () => {
    const byObject: Record<string, string[]> = {
      lettera_clotilde: ['domande.chiL.risposta', 'persone.ada.g14', 'lettere.clotilde', 'domande.avorio.lettera', 'persone.zeno.lettera'],
      fascio_1: ['lettere.fascio', 'persone.livia.lettere', 'domande.pozzo.risposta'],
      bottiglia_nodo_nero: ['lettere.bottiglia_nodo_nero'],
      pagina_strappata: ['domande.puntoAperto.pagina'],
      biglietto_livia_1: ['lettere.bigliettiLivia'],
      nastro_nonna: ['lettere.nastro', 'persone.ada.nastro'],
    };
    const mentions = (c: StoryCond, id: string): boolean => JSON.stringify(c).includes(JSON.stringify({ knows: 'oggetto', id }));
    for (const [obj, ids] of Object.entries(byObject)) for (const id of ids) expect(mentions(db.diary.get(id)?.unlock as StoryCond, obj), id).toBe(true);
    // Per ogni oggetto, prima del momento in cui arriva nessuna di queste voci è sbloccabile.
    for (const [obj, ids] of Object.entries(byObject)) {
      const first = MOMENTS.find((m) => m.objects.has(obj) || m.mayObjects.has(obj));
      expect(first, obj).toBeDefined();
      for (const m of MOMENTS.slice(0, MOMENTS.indexOf(first as Moment))) {
        for (const id of ids) expect(tri(db.diary.get(id)?.unlock as StoryCond, m).may, `${id} a ${m.label}`).toBe(false);
      }
    }
  });

  it('campagna simulata: nessuna pista si sblocca dopo che la sua domanda è risolta (D10)', () => {
    const piste = [...db.diary.values()].filter((d) => MY_DIARY.has(d.id) && d.pista);
    expect(piste.length).toBeGreaterThanOrEqual(8);
    let checked = 0;
    for (const p of piste) {
      const q = p.opens?.[0] ?? p.closes?.[0] ?? /^domande\.([^.]+)\./.exec(p.id)?.[1];
      if (!q) continue;
      const answers = [...db.diary.values()].filter((d) => d.closes?.includes(q));
      const archives = [...db.levels.values()].filter((l) => l.archive?.closes.includes(q)).map((l) => l.id);
      let seen = false;
      for (const m of MOMENTS) {
        const resolved = answers.some((a) => tri(a.unlock, m).must) || archives.some((a) => m.done.has(a));
        const pt = tri(p.unlock, m);
        if (resolved && !seen) {
          expect(pt.may, `${p.id} a ${m.label}`).toBe(false);
          checked++;
        }
        if (pt.must) seen = true;
      }
    }
    expect(checked).toBeGreaterThan(20);
    // La pista del 1958 arriva prima dell'Archivio (g10) e apre la domanda.
    expect(JSON.stringify(db.diary.get('domande.anno1958.pista')?.unlock)).toContain('{"done":"g10"}');
    expect(db.diary.get('domande.anno1958.pista')?.opens).toEqual(['anno1958']);
  });

  it('il desiderio di Zeno, che si può sapere la sera di g14, non dice ancora chi è Livia', () => {
    expect(desireDay('zeno')).toBe(DAY_IDS.indexOf('g14'));
    expect(t('atto2.diario.desiderio.zeno')).not.toMatch(/Livia|madre/);
  });
});

describe('revisione 1: tutorial degli Atti II-III e degli Archivi 3-5 (CA23-02)', () => {
  const steps = (id: string) => level(id).tutorial ?? [];
  const margin = (id: string, key: string) => steps(id).find((s) => s.k === 'margine' && s.textKey === key);
  const pulses = (id: string) => steps(id).filter((s) => s.k === 'pulsa');

  it('ogni regola nuova ha la sua nota nella prima notte in cui vale (D03)', () => {
    const story = [...db.levels.values()].filter((l) => /^g\d\d$/.test(l.id)).sort((a, b) => a.id.localeCompare(b.id));
    const firstWith = (pred: (l: LevelDef) => boolean): string | undefined => story.find(pred)?.id;
    expect(firstWith((l) => l.rules.includes('febbre'))).toBe('g09');
    expect(firstWith((l) => l.rules.includes('rancore'))).toBe('g11');
    expect(firstWith((l) => l.quirks.includes('pieroTrabocca'))).toBe('g16');
    expect(firstWith((l) => l.rules.includes('nero'))).toBe('g17');
    expect(firstWith((l) => l.rules.includes('marea'))).toBe('g19');
    // g09: febbre alla prima ora, Gino a letto, la cura al primo evento `cura`.
    expect(margin('g09', 'atto2.g09.margine.febbre')).toMatchObject({ when: 'primaOra' });
    expect(margin('g09', 'atto2.g09.margine.ginoLetto')).toMatchObject({ when: 'ora', hour: 7 });
    expect(margin('g09', 'atto2.g09.margine.cura')).toMatchObject({ when: 'evento', evento: 'cura' });
    expect(pulses('g09')).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: 'fuso', thread: 'gino' }), expect.objectContaining({ target: 'fuso', thread: 'lunardi' }),
    ]));
    // g11: il nodo alla prima ora, coi fusi di Teresa e Marta.
    expect(margin('g11', 'atto2.g11.margine.nodo')).toMatchObject({ when: 'primaOra' });
    expect(pulses('g11').map((s) => s.k === 'pulsa' && s.thread).sort()).toEqual(['marta', 'teresa']);
    // g16: il trabocco alla prima ora e al primo evento `trabocca`, col fuso di Don Piero.
    expect(margin('g16', 'atto2.g16.margine.trabocco')).toMatchObject({ when: 'primaOra' });
    expect(steps('g16').some((s) => s.k === 'margine' && s.when === 'evento' && s.evento === 'trabocca')).toBe(true);
    expect(pulses('g16')).toEqual([expect.objectContaining({ target: 'fuso', thread: 'piero' })]);
    // g17: il filo nero, a matita, della mano di Ada.
    expect(margin('g17', 'atto3.g17.margine.nero')).toMatchObject({ when: 'primaOra', mano: 'ada' });
    // g19: all'inizio dell'ora prima dell'acqua alta, e pulsano le colonne allagate.
    const tide = level('g19').tide?.[0];
    expect(margin('g19', 'atto3.g19.margine.marea')).toMatchObject({ when: 'ora', hour: (tide?.from ?? 0) - 1 });
    expect(pulses('g19')).toEqual([expect.objectContaining({ target: 'marea', hour: tide?.from })]);
    // g12 (nome) resta com'era.
    expect(steps('g12').some((s) => s.k === 'margine' && s.when === 'primaOra')).toBe(true);
  });

  it('Archivi 3-5: guida per nominare e per lo strappo, e i suggerimenti della lampada', () => {
    for (const id of ['arc3', 'arc4', 'arc5']) {
      const lv = level(id);
      const hole = lv.archive?.holes[0];
      // Il tombolo apre l'Archivio al primo strappo, con le righe registrate già tessute:
      // `primaOra` lì non scatta mai (verificato nel browser), la guida va all'ora dello strappo.
      expect(steps(id).some((s) => s.k === 'margine' && s.when === 'ora' && s.hour === hole?.from), id).toBe(true);
      if ((hole?.from ?? 0) > lv.startHour + 1) expect(steps(id).some((s) => s.k === 'margine' && s.when === 'primaOra'), id).toBe(false);
      expect(steps(id).some((s) => s.k === 'margine' && s.when === 'archivioNomi'), id).toBe(true);
      expect(t(lv.hintKeys?.spinta ?? ''), id).not.toBe('');
      expect(t(lv.hintKeys?.indizio ?? ''), id).not.toBe('');
    }
  });

  it('testi dei tutorial in italiano e in inglese, ≤ 90 caratteri', () => {
    const keys = ['g09', 'g11', 'g16', 'g17', 'g19', 'arc3', 'arc4', 'arc5'].flatMap((id) => steps(id).flatMap((s) => (s.k === 'margine' ? [s.textKey] : [])));
    expect(keys.length).toBeGreaterThanOrEqual(13);
    for (const k of keys) {
      expect(t(k).length, k).toBeGreaterThan(10);
      expect(t(k).length, k).toBeLessThanOrEqual(90);
      expect(te(k).length, k).toBeGreaterThan(10);
      expect(te(k).length, k).toBeLessThanOrEqual(90);
    }
  });
});

describe('revisione 1: continuità degli Atti II-III (CA23-05)', () => {
  /** Valuta una condizione su un assegnamento degli atomi (chiave → valore). */
  function evalA(c: StoryCond, a: Record<string, unknown>): boolean {
    if ('all' in c) return c.all.every((x) => evalA(x, a));
    if ('any' in c) return c.any.some((x) => evalA(x, a));
    if ('not' in c) return !evalA(c.not, a);
    if ('flag' in c) {
      const v = a[`flag:${c.flag}`];
      if (c.eq !== undefined) return v === c.eq;
      return typeof v === 'number' && (c.gte === undefined || v >= c.gte) && (c.lte === undefined || v <= c.lte);
    }
    if ('memoria' in c) {
      const v = a[`mem:${c.memoria}`] as number;
      return (c.gte === undefined || v >= c.gte) && (c.lte === undefined || v <= c.lte);
    }
    return a[JSON.stringify(c)] === true;
  }
  function atoms(c: StoryCond, out: Map<string, unknown[]>): void {
    if ('all' in c) return c.all.forEach((x) => atoms(x, out));
    if ('any' in c) return c.any.forEach((x) => atoms(x, out));
    if ('not' in c) return atoms(c.not, out);
    if ('flag' in c) {
      const k = `flag:${c.flag}`;
      const vs = out.get(k) ?? ['__altro', 0, 1, 2, 3, 4];
      if (c.eq !== undefined && !vs.includes(c.eq)) vs.push(c.eq);
      out.set(k, vs);
    } else if ('memoria' in c) out.set(`mem:${c.memoria}`, [0, 1, 2, 3]);
    else out.set(JSON.stringify(c), [true, false]);
  }
  function assignments(conds: StoryCond[]): Record<string, unknown>[] {
    const m = new Map<string, unknown[]>();
    conds.forEach((c) => atoms(c, m));
    let out: Record<string, unknown>[] = [{}];
    for (const [k, vs] of m) out = out.flatMap((a) => vs.map((v) => ({ ...a, [k]: v })));
    return out;
  }

  it('le varianti dei bigliettini si escludono a vicenda e coprono tutti i casi', () => {
    const groups = new Map<string, NoteDef[]>();
    for (const n of MY_NOTES) {
      const k = `${n.day}:${n.ending ?? n.author}`;
      groups.set(k, [...(groups.get(k) ?? []), n]);
    }
    let withVariants = 0;
    for (const [k, ns] of groups) {
      if (ns.length < 2) continue;
      withVariants++;
      for (const a of assignments(ns.map((n) => n.availableIf ?? { all: [] }))) {
        const avail = ns.filter((n) => !n.availableIf || evalA(n.availableIf, a));
        expect(avail.length, `${k} ${JSON.stringify(a)}`).toBe(1);
      }
    }
    expect(withVariants).toBeGreaterThanOrEqual(5); // g10.marta, g18.marta, g19.teresa, g22.teresa, g23 A
    expect(db.notes.get('g22.teresa.riconosciuta')?.availableIf).toEqual({ ok: 'g17.teresa' });
    expect(t('atto3.g22.teresa.riconosciuta.testo')).toBe('Quella donna l\'avevo riconosciuta, cara, e poi mi è scappata come una parola. Voglio rivederla appena mette piede sull\'isola.');
    expect(db.notes.get('g19.teresa.pace')?.availableIf).toEqual({ flag: 'riconciliate', eq: true });
    expect(t('atto3.g19.teresa.pace.testo')).toContain('Non le leggo più, ma l\'acqua sì');
  });

  it('le varianti delle vignette dell\'alba si escludono a vicenda', () => {
    for (const d of STORY) {
      const all = level(d).dawn?.candidates ?? [];
      for (const v of all) {
        const base = all.find((w) => w !== v && v.id.startsWith(`${w.id}.`));
        if (!base) continue;
        for (const a of assignments([v.when ?? { all: [] }, base.when ?? { all: [] }])) {
          expect(evalA(v.when ?? { all: [] }, a) && evalA(base.when ?? { all: [] }, a), `${v.id} ${JSON.stringify(a)}`).toBe(false);
        }
      }
    }
    // Dopo la pace Teresa non legge più: la vignetta delle medicine aperte vale solo senza `riconciliate`.
    expect(JSON.stringify(level('g19').dawn?.candidates.find((v) => v.id === 'g19.alba.medicine')?.when)).toContain('"not":{"flag":"riconciliate","eq":true}');
  });

  it('ogni testo citato nelle segnalazioni ha la versione nuova (D13)', () => {
    const has: [string, string][] = [
      ['atto2.lettere.lettera_clotilde', 'il filo d\'avorio ha tenuto fino alle tre'],
      ['atto2.lettere.lettera_clotilde', 'una per una, per quattordici anni'],
      ['atto2.diario.lettere.clotilde', 'Come sul biglietto appuntato al tombolo'],
      ['atto2.diario.domande.avorio.lettera', 'l\'ultima volta'],
      ['atto3.diario.archivio.arc6.punto', 'per la prima volta'],
      ['atto2.g13.lunardi.testo', 'A lei, signorina, intendo.'],
      ['atto2.g14.alba.ammessa.1', 'convitto da Pasqua'],
      ['atto2.diario.persone.nina.ammessa', 'convitto da Pasqua'],
      ['atto3.g18.alba.pace.2', 'me l\'ha detto la piccola'],
      ['atto2.g10.lunardi.testo', 'passi anche dal pescatore Scarpa'],
      ['atto2.g13.nina.testo', 'Curalo, ti prego.'],
      ['finali.aperto.perline.L_1951', 'che mia madre ha riavuto dal pozzo'],
    ];
    for (const [k, s] of has) expect(t(k), k).toContain(s);
    const hasNot: [string, string][] = [
      ['atto2.lettere.lettera_clotilde', 'ogni giorno'],
      ['atto2.lettere.lettera_clotilde', 'ha tenuto un\'ora'],
      ['atto2.diario.lettere.clotilde', 'cuscino'],
      ['atto3.diario.archivio.arc6.punto', 'una volta sola'],
      ['atto2.diario.domande.avorio.lettera', 'una volta sola'],
      ['atto2.g11.alba.porta.2', 'non so'],
      ['atto2.g13.lunardi.testo', 'esame'],
      ['atto2.g10.lunardi.testo', 'la prima'],
      ['atto2.g13.nina.testo', 'per primo'],
      ['finali.aperto.perline.L_1951', 'custodita'],
    ];
    for (const [k, s] of hasNot) expect(t(k), k).not.toContain(s);
    expect(t('atto2.diario.persone.nina.debito')).toBe('La Nina ha saputo del debito. Il Bepi non parla più a nessuno.');
    expect(t('atto3.g22.alba.teresa.2')).not.toContain('non me la ricordo');
  });

  it('voci del Taccuino non contraddittorie nella stessa giornata (P068)', () => {
    expect(t('atto2.diario.persone.lunardi.scarpa')).not.toContain('vino');
    expect(t('atto2.diario.persone.marta.forno')).not.toContain('non ha mai chiuso');
    expect(t('atto2.diario.domande.anno1958.notte')).not.toContain('ho dovuto scegliere');
    expect(t('atto2.diario.persone.ada.g12')).not.toContain('madre');
    // La promessa a Marta (g21 R2) e il Gino al Faro: una voce che lo dice.
    expect(db.diary.get('persone.marta.promessaRotta')?.unlock).toEqual({ all: [{ reply: 'g21.marta', is: 'R2' }, { ok: 'g21.gino' }] });
    expect(t('atto3.diario.persone.marta.casa')).not.toMatch(/resterà/);
  });

  it('verifica della revisione 1: niente contraddizioni rimaste (g10 il Bepi e il dottore, g13 la Nina, g23 Don Piero)', () => {
    // g10, R2 al Bepi e Lunardi appuntato e riuscito: le due voci escono nella stessa sera.
    // «Non vuole» il dottore regge anche se poi il dottore lo cura; «non apre la porta» no.
    expect(t('atto2.diario.persone.bepi.dottore')).not.toMatch(/non apre la porta/);
    expect(te('atto2.diario.persone.bepi.dottore')).not.toMatch(/open the door/);
    // «Mi ha chiuso la porta in faccia» solo se il dottore non ha curato il Bepi (la richiesta fallisce anche con due visite sole).
    const chiuso = level('g10').dawn?.candidates.find((v) => v.id === 'g10.alba.chiuso');
    expect(chiuso?.when).toEqual({ all: [{ failed: 'g10.lunardi' }, { not: { event: 'cura', a: 'bepi', b: 'lunardi' } }] });
    // g13: se la richiesta della Nina fallisce, è il Bepi che non è stato curato (lei può esserlo, con Lunardi).
    const bepi = level('g13').dawn?.candidates.find((v) => v.id === 'g13.alba.bepi');
    expect(bepi?.lines[1]?.speaker).toBe('nina');
    expect(t(bepi?.lines[1]?.textKey ?? '')).not.toMatch(/fino a me/);
    expect(te(bepi?.lines[1]?.textKey ?? '')).not.toMatch(/as far as me/);
    // Don Piero dà del lei anche a Livia (g22 «Perdoni un vecchio distratto», g23).
    expect(t('atto3.g23.alba.messa.1')).not.toMatch(/come vedi/);
    // P092: un bigliettino non chiede una mattina che la richiesta non controlla.
    for (const id of ['g11.teresa', 'g18.lunardi']) {
      const n = db.notes.get(id);
      expect(JSON.stringify(n?.request), id).not.toMatch(/"(to|by|from|hour)"/);
      expect(t(n?.textKey ?? ''), id).not.toMatch(/domattina|mattina/i);
      expect(te(n?.textKey ?? ''), id).not.toMatch(/morning/i);
    }
  });
});

describe('revisione 1: esiti e albe (CA23-06)', () => {
  it('ogni bigliettino con richiesta ha esito.ok ed esito.fallita, in italiano e in inglese (C05)', () => {
    let n = 0;
    for (const note of MY_NOTES) {
      if (!note.request || note.ending) continue;
      n++;
      expect(note.esito?.ok, note.id).toBeTruthy();
      expect(note.esito?.fallita, note.id).toBeTruthy();
      for (const k of [note.esito?.ok, note.esito?.fallita, note.esito?.lasciato]) {
        if (!k) continue;
        expect(IT.has(k), k).toBe(true);
        expect(EN.has(k), k).toBe(true);
      }
    }
    expect(n).toBeGreaterThanOrEqual(52);
    // Un esito proprio per g11.teresa: faccia a faccia senza parlarsi (P068).
    expect(t(db.notes.get('g11.teresa')?.esito?.ok ?? '')).toContain('faccia a faccia');
    // I destini che si decidono anche lasciando il bigliettino hanno un esito «lasciato».
    for (const id of ['g15.nina', 'g16.zeno', 'g20.nina', 'g22.zeno']) expect(db.notes.get(id)?.esito?.lasciato, id).toBeTruthy();
  });

  it('un esito non ripete una vignetta dell\'alba né una voce del Taccuino (D12)', () => {
    const diaryTexts = new Set([...db.diary.values()].map((d) => t(d.textKey)));
    for (const note of MY_NOTES) {
      if (!note.esito) continue;
      const dawn = new Set((level(note.day).dawn?.candidates ?? []).flatMap((v) => v.lines.map((l) => t(l.textKey))));
      for (const k of [note.esito.ok, note.esito.fallita, note.esito.lasciato]) {
        if (!k) continue;
        expect(dawn.has(t(k)), `${note.id} ${k}`).toBe(false);
        expect(diaryTexts.has(t(k)), `${note.id} ${k}`).toBe(false);
      }
    }
  });

  it('i culmini delle albe di g11, g14, g16, g18 e g20 nei casi delle segnalazioni (P067, P117): niente battute generiche', () => {
    interface Sc { ok?: string[]; failed?: string[]; events?: string[]; flags?: Record<string, unknown> }
    const holdsSc = (c: StoryCond, s: Sc): boolean => {
      if ('all' in c) return c.all.every((x) => holdsSc(x, s));
      if ('any' in c) return c.any.some((x) => holdsSc(x, s));
      if ('not' in c) return !holdsSc(c.not, s);
      if ('ok' in c) return (s.ok ?? []).includes(c.ok);
      if ('failed' in c) return (s.failed ?? []).includes(c.failed);
      if ('event' in c) return (s.events ?? []).includes(c.event);
      if ('flag' in c) return c.eq !== undefined && s.flags?.[c.flag] === c.eq;
      return false;
    };
    const cases: [string, Sc][] = [
      ['g11', { ok: ['g11.teresa'], events: ['nodo', 'incontro'] }],
      ['g14', { ok: ['g14.zeno', 'g14.nina'] }],
      ['g16', { ok: ['g16.zeno'], events: ['trabocca'], flags: { lettereLivia: 'liberate' } }],
      ['g18', { ok: ['g18.teresa', 'g18.gino'], flags: { riconciliate: true } }],
      ['g20', { failed: ['g20.nina'], flags: { nina: 'resta' } }],
    ];
    for (const [d, sc] of cases) {
      const shown = (level(d).dawn?.candidates ?? []).filter((v) => !v.when || holdsSc(v.when, sc));
      // D11: in una giornata con un culmine (priorità ≥ 100) le battute generiche non si aggiungono.
      expect(shown.some((v) => v.priority >= 100), d).toBe(true);
    }
    // C06: il pane caldo esce subito dopo la pace; in g16 Teresa col fascio dopo il trabocco.
    const vig = (d: string, id: string) => level(d).dawn?.candidates.find((v) => v.id === id) as VignetteDef & { dopo?: string };
    expect(vig('g18', 'g18.alba.pane').dopo).toBe('g18.alba.pace');
    expect(vig('g18', 'g18.alba.pane').priority).toBeGreaterThanOrEqual(100);
    expect(vig('g16', 'g16.alba.teresa').dopo).toBe('g16.alba.trabocco');
  });
});

describe('revisione 1: finali (CA23-04)', () => {
  const FATES: Story[] = [];
  for (const nina of ['parte', 'resta']) for (const bepi of ['salvo', 'ferito']) for (const zenoLivia of [true, false]) {
    FATES.push({ done: new Set(), memoria: {}, flags: { nina, bepi, zenoLivia }, desires: new Set() });
  }
  const ep = (id: string) => db.endings.get(id as never)?.epilogue ?? [];
  const visible = (id: string, s: Story) => ep(id).filter((v) => !v.when || holds(v.when, s));

  it('nessuna riga d\'epilogo finisce con la virgola o resta a metà (it, en)', () => {
    for (const e of db.endings.values()) {
      for (const v of e.epilogue) {
        for (const l of v.lines) {
          for (const s of [t(l.textKey), te(l.textKey)]) expect(s.trim(), l.textKey).toMatch(/[.!?»”]$/);
        }
      }
    }
  });

  it('epilogo D: le occasioni piantate in una frase sola, nessuna occasione fissa, i desideri chiusi, il nastro', () => {
    const first = ep('aperto')[0] as VignetteDef;
    expect(t(first.lines[0]?.textKey ?? '')).toContain('{occasioni}');
    expect(te(first.lines[0]?.textKey ?? '')).toContain('{occasioni}');
    const others = ep('aperto').flatMap((v) => v.lines.map((l) => l.textKey)).filter((k) => k !== first.lines[0]?.textKey);
    const HOURS = /\b(alle|delle) (sei|sette|otto|nove|dieci|undici|dodici|una|due|tre|quattro|cinque|\d+)\b|mezzogiorno/i;
    for (const k of others) expect(t(k), k).not.toMatch(HOURS);
    for (const s of FATES) {
      const vis = visible('aperto', s);
      const ids = vis.map((v) => v.id);
      for (const id of ['finale.aperto.teresa', 'finale.aperto.gino', 'finale.aperto.lunardi', 'finale.aperto.nastro']) expect(ids, id).toContain(id);
      expect(ids.filter((x) => x.startsWith('finale.aperto.nina')).length).toBe(1);
      expect(ids.filter((x) => x.startsWith('finale.aperto.zeno')).length).toBe(1);
      const text = vis.flatMap((v) => v.lines.map((l) => t(l.textKey))).join('\n');
      expect(text).toContain('Il nastro era abbastanza lungo per due fili. Ne ho fatto uno per me e uno per mia madre.');
      expect(text).toContain('Per un autunno e un inverno');
    }
  });

  it('epilogo A: il nastro annodato al tombolo, in ogni combinazione di destini', () => {
    for (const s of FATES) {
      const text = visible('merlettaia', s).flatMap((v) => v.lines.map((l) => t(l.textKey))).join('\n');
      expect(text).toContain('nastro della nonna');
    }
  });

  it('finale C: chiusura «nodo» (C11)', () => {
    expect(level('fin_chiuso').chiusura).toBe('nodo');
  });
});

describe('revisione 1: testi minori (CA23-07)', () => {
  it('deissi: i bigliettini parlano di domani, le albe di oggi (P065)', () => {
    for (const n of MY_NOTES) {
      if (n.ending) continue;
      expect(t(n.textKey), n.id).not.toMatch(/\b(oggi|stamattina|stasera|stanotte|stanote)\b/i);
    }
    expect(t('atto2.g09.teresa.testo')).toContain('arriva un dottore');
    expect(t('atto2.g13.alba.specchio.1')).toContain('Un giorno intero');
  });

  it('g15: il filo nero «più vicino dell\'altra volta» e la sua apparizione (C12)', () => {
    expect(t('atto2.g15.alba.nero.1')).toContain('dell\'altra volta');
    expect(level('g15').apparizione).toEqual({ hour: 3, side: 'faro', passi: 2 });
  });

  it('geografia, titoli e voci (P079, P081, P097, P119)', () => {
    expect(t('atto3.g20.alba.resta.1')).toContain('Pellestrina');
    expect(t('atto3.arc6.eco.2')).toContain('Don Piero');
    // D13: in arc6 Don Piero è il giovane cappellano (il parroco del 1936 era Don Anselmo).
    expect(t('atto3.arc6.eco.2')).toContain('giovane cappellano');
    expect(te('atto3.arc6.eco.2')).toContain('young chaplain');
    expect(t('atto3.g17.titolo')).toBe('La donna in nero');
    expect(t('atto3.g17.titolo')).not.toBe(t('atto1.g08.titolo'));
    for (const id of ARCHIVES) expect(t(level(id).titleKey), id).not.toMatch(/\d/);
    // Bepi: tutto minuscolo e senza doppie («la nina»); Don Piero dà del lei.
    for (const n of MY_NOTES.filter((x) => x.author === 'bepi')) {
      expect(t(n.textKey), n.id).toBe(t(n.textKey).toLowerCase());
      expect(t(n.textKey), n.id).not.toContain('la Nina');
    }
    for (const n of MY_NOTES.filter((x) => x.author === 'piero' && !x.ending)) {
      expect(t(n.textKey), n.id).not.toMatch(/\b(Fate|Liberatemi|Mandatemi|Fatemi)\b/);
    }
  });

  it('etichette delle perline secondo C16: minuscole, con l\'articolo, le lettere col destinatario', () => {
    for (const id of MINE) {
      const lv = level(id);
      for (const b of lv.beads) {
        const s = t(b.labelKey);
        expect(s[0], `${id} ${b.id}: ${s}`).toBe(s[0]?.toLowerCase());
        if (b.type !== 'lettera' || !b.to) continue;
        const to = lv.threads.find((x) => x.id === b.to);
        const name = to?.character ? t(db.characters.get(to.character)?.nameKey ?? '') : t(to?.labelKey ?? '').split(' ')[1] ?? '';
        expect(s, `${id} ${b.id}`).toContain(name);
      }
    }
    expect(t('finali.aperto.perline.ettore')).toBe('il nome del dottore');
  });
});

// ───────── Revisione 2 (R2-D3): la storia regge su tutti i rami ─────────
// La campagna vera (src/campaign/flow) giocata dall'inizio alla scelta su più rami: tutto riuscito,
// tutto fallito, tutto lasciato, memoria a zero e misti a caso con seme fisso. A ogni momento
// (sera, alba, oggetto dell'alba, bilancio, Archivio, scelta, notte del finale, epilogo) si annotano
// le chiavi dei testi mostrati con lo stato di quel momento, poi si controllano le condizioni di
// coerenza dichiarate qui sotto come dati (COERENZA, UN_GIORNO, MAI_INSIEME) e le ripetizioni.

type Rnd = () => number;
function mulberry32(seed: number): Rnd {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

type Momento = 'sera' | 'alba' | 'oggetto' | 'bilancio' | 'archivio' | 'scelta' | 'notte' | 'epilogo';
interface Voce { key: string; note?: NoteDef }
interface Pagina { ramo: string; giorno: string; momento: Momento; voci: Voce[]; s: CampaignStateX; k: Knowledge }

interface Ramo {
  nome: string;
  seed: number;
  rispondi: (n: NoteDef, r: Rnd) => 'R1' | 'R2' | null;
  /** Bigliettini da appuntare (fra quelli con richiesta della sera). */
  appunta: (day: string, cands: NoteDef[], max: number, r: Rnd) => NoteDef[];
  /** Fra gli appuntati, quelli che il giocatore prova a soddisfare stanotte. */
  riuscite: (day: string, pinned: NoteDef[], r: Rnd) => NoteDef[];
  rammenda: (arc: string, r: Rnd) => boolean;
  /** Autore sbagliato per un anonimo (probabilità). */
  sbaglia?: number;
  /** Memoria dopo ogni notte col nome: piena (il nome passa bene) o zero (nessuno ricorda Ada). */
  memoria?: 'piena' | 'zero';
}

/** Righe calcolate per un insieme esatto di bigliettini (null se non ci sono). */
function exactRows(day: string, ids: string[]): RowMoves[] | null {
  const c = db.computed.get(day);
  if (!c) return null;
  const key = [...ids].sort().join('|');
  if (ids.length === 0) return c.base.rows ?? null;
  if (ids.length === 1) return c.perNote[ids[0] as string]?.rows ?? null;
  return c.combos.find((x) => [...x.notes].sort().join('|') === key)?.rows ?? null;
}
/** Righe per il sottoinsieme più grande dei bigliettini voluti che il solver sa tessere. */
function rowsFor(day: string, want: string[]): RowMoves[] {
  for (let k = want.length; k >= 0; k--) {
    const subs: string[][] = [];
    const rec = (i: number, acc: string[]): void => {
      if (acc.length === k) {
        subs.push([...acc]);
        return;
      }
      for (let j = i; j < want.length; j++) rec(j + 1, [...acc, want[j] as string]);
    };
    rec(0, []);
    for (const s of subs) {
      const r = exactRows(day, s);
      if (r) return r;
    }
  }
  return db.computed.get(day)?.base.rows ?? [];
}
const tessibili = (day: string, ids: string[]): boolean => ids.length === 0 || exactRows(day, ids) !== null;

/** Bigliettini da cui dipendono i destini e il finale vero: il ramo «riuscito» li tiene. */
const CHIAVE = ['g08.nina', 'g15.nina', 'g16.zeno', 'g18.teresa', 'g20.nina', 'g20.bepi', 'g22.zeno', 'g14.zeno', 'g13.marta'];
function migliori(day: string, cands: NoteDef[], max: number): NoteDef[] {
  let best: NoteDef[] = [];
  let score = -1;
  const rec = (i: number, acc: NoteDef[]): void => {
    if (acc.length > 0 && tessibili(day, acc.map((n) => n.id)) && new Set(acc.map((n) => n.author)).size === acc.length) {
      const sc = acc.filter((n) => CHIAVE.includes(n.id)).length * 10 + acc.length;
      if (sc > score) {
        score = sc;
        best = [...acc];
      }
    }
    if (acc.length === max) return;
    for (let j = i; j < cands.length; j++) rec(j + 1, [...acc, cands[j] as NoteDef]);
  };
  rec(0, []);
  return best;
}
function shuffle<T>(xs: T[], r: Rnd): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

const RAMI: Ramo[] = [
  {
    nome: 'riuscito',
    seed: 1,
    rispondi: (n) => (n.replies?.some((x) => x.effects.some((e) => 'desire' in e)) ? (n.replies.find((x) => x.effects.some((e) => 'desire' in e))?.id ?? 'R1') : 'R1'),
    appunta: (day, cands, max) => migliori(day, cands, max),
    riuscite: (_d, pinned) => pinned,
    rammenda: () => true,
    memoria: 'piena',
  },
  {
    // Il finale vero con la domanda della Nina persa (g08), la Nina rimasta (g20), il Bepi ferito (g15) e Zeno senza perdono (g22).
    nome: 'riuscito-resta',
    seed: 5,
    rispondi: (n) => (n.replies?.some((x) => x.effects.some((e) => 'desire' in e)) ? (n.replies.find((x) => x.effects.some((e) => 'desire' in e))?.id ?? 'R2') : 'R2'),
    appunta: (day, cands, max) => migliori(day, cands.filter((n) => !['g08.nina', 'g15.nina', 'g20.nina', 'g22.zeno'].includes(n.id)), max),
    riuscite: (_d, pinned) => pinned,
    rammenda: (arc) => arc !== 'arc4',
    memoria: 'piena',
  },
  { nome: 'fallito', seed: 2, rispondi: () => 'R2', appunta: (_d, c, max, r) => shuffle(c, r).slice(0, max), riuscite: () => [], rammenda: () => false, sbaglia: 0.5 },
  { nome: 'lasciato', seed: 3, rispondi: () => null, appunta: () => [], riuscite: () => [], rammenda: () => false },
  { nome: 'dimenticata', seed: 4, rispondi: (_n, r) => (r() < 0.5 ? 'R1' : 'R2'), appunta: (_d, c, max, r) => shuffle(c, r).slice(0, Math.floor(r() * (max + 1))), riuscite: (_d, p, r) => p.filter(() => r() < 0.5), rammenda: (_a, r) => r() < 0.5, memoria: 'zero' },
  ...[21, 22, 23, 24].map(
    (seed): Ramo => ({
      // Misti che tengono spesso i bigliettini dei destini (g08, g15, g16, g18, g20, g22).
      nome: `chiave-${seed}`,
      seed,
      rispondi: (_n, r) => (r() < 0.5 ? 'R1' : 'R2'),
      appunta: (_d, c, max, r) => [...shuffle(c.filter((n) => CHIAVE.includes(n.id) && r() < 0.8), r), ...shuffle(c.filter((n) => !CHIAVE.includes(n.id)), r)].slice(0, max),
      riuscite: (_d, p, r) => p.filter((n) => r() < (CHIAVE.includes(n.id) ? 0.7 : 0.4)),
      rammenda: (_a, r) => r() < 0.7,
      memoria: seed % 2 === 0 ? 'piena' : undefined,
    }),
  ),
  ...[11, 12, 13, 14, 15, 16, 17, 18].map(
    (seed): Ramo => ({
      nome: `misto-${seed}`,
      seed,
      rispondi: (_n, r) => {
        const x = r();
        return x < 0.4 ? 'R1' : x < 0.8 ? 'R2' : null;
      },
      appunta: (_d, c, max, r) => shuffle(c, r).slice(0, Math.floor(r() * (max + 1))),
      riuscite: (_d, p, r) => p.filter(() => r() < 0.6),
      rammenda: (_a, r) => r() < 0.6,
      sbaglia: 0.1,
    }),
  ),
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const objectKeys = (id: string): string[] => {
  const l = db.letters.find((x) => x.id === id);
  if (l) return [l.textKey];
  return IT.has(`comune.oggetti.${id}.descrizione`) ? [`comune.oggetti.${id}.descrizione`] : [];
};
const diaryKey = (id: string): string => db.diary.get(id)?.textKey ?? `?diario:${id}`;

/** Gioca un ramo fino alla scelta e poi, da lì, ogni finale che si può appuntare. */
function giocaRamo(ramo: Ramo): Pagina[] {
  const r = mulberry32(ramo.seed);
  const d: SaveData = defaultSaveData('test');
  newCampaign(d, db);
  const out: Pagina[] = [];
  const page = (save: SaveData, giorno: string, momento: Momento, voci: Voce[]): void => {
    out.push({ ramo: ramo.nome, giorno, momento, voci, s: clone(camp(save)), k: clone(save.knowledge) });
  };
  let guard = 0;
  while (camp(d).phase === 'sera' && guard++ < 40) {
    const c = camp(d);
    const day = c.levelId;
    const announced = markObjectSeen(d, db);
    const items = eveningItems(c.dayIndex, 'sera', c, db).flatMap((it) => objectKeys(it.id));
    const notes = (c.evening?.noteIds ?? []).map((id) => db.notes.get(id) as NoteDef);
    page(d, day, 'sera', [...items.map((key) => ({ key })), ...announced.map((id) => ({ key: diaryKey(id) })), ...notes.map((n) => ({ key: n.textKey, note: n }))]);
    for (const n of notes) {
      if (!n.replies?.length) continue;
      const rep = ramo.rispondi(n, r);
      if (rep) replyNote(c, d.knowledge, db, n.id, rep);
    }
    const cands = notes.filter((n) => n.request);
    const pins = pinsLeft(c, db);
    const pinned = ramo.appunta(day, cands, pins, r).slice(0, pins);
    for (const n of pinned) {
      let guess = n.author;
      if (isAnonymous(n, c, db) && ramo.sbaglia && r() < ramo.sbaglia) guess = n.author === 'zeno' ? 'teresa' : 'zeno';
      pinNote(c, db, n.id, guess);
    }
    startNight(d, db);
    const params = currentNightParams(d, db);
    if (!params) throw new Error(`${ramo.nome}: nessuna notte a ${day}`);
    const want = ramo.riuscite(day, pinned, r).map((n) => n.id);
    const computed = db.computed.get(day) ?? null;
    let outcome: NightOutcome | null = simulateNight(params, rowsFor(day, want), computed, db.balance);
    outcome ??= simulateNight(params, computed?.base.rows ?? [], computed, db.balance);
    if (!outcome) throw new Error(`${ramo.nome}: notte ${day} non simulabile`);
    const report = completeDay(d, db, outcome);
    if (ramo.memoria && level(day).rules.includes('nome')) for (const ch of CAST) camp(d).memoria[ch] = ramo.memoria === 'piena' ? 3 : 0;
    page(d, day, 'alba', report.dawn.flatMap((v) => v.lines.map((l) => ({ key: l.textKey }))));
    if (report.dawnItems?.length) {
      const fresh = readDawnObject(d, db);
      page(d, day, 'oggetto', [...report.dawnItems.flatMap(objectKeys).map((key) => ({ key })), ...fresh.map((id) => ({ key: diaryKey(id) }))]);
    }
    finishDawn(d, db);
    page(d, day, 'bilancio', [
      ...[...report.requests, ...report.ignored].map((x) => ({ key: x.consequenceKey, note: db.notes.get(x.noteId) })),
      ...report.newDiary.map((id) => ({ key: diaryKey(id) })),
    ]);
    const next = finishBilancio(d, db);
    if (next === 'archivio') {
      const arc = camp(d).archiveOpen as string;
      if (ramo.rammenda(arc, r)) {
        const p = archiveParams(d, db, arc);
        const lv = level(arc);
        const rows = (lv.archive?.recorded ?? []).map((x) => ({ hour: x.hour, crossings: x.crossings.filter((cr) => !cr.forced) }));
        const o = simulateNight(p, rows, db.computed.get(arc) ?? null, db.balance);
        if (!o) throw new Error(`${ramo.nome}: Archivio ${arc} non simulabile`);
        const res = completeArchive(d, db, o);
        page(d, arc, 'archivio', [...(res.reveal?.lines ?? []).map((l) => ({ key: l.textKey })), ...res.newDiary.map((id) => ({ key: diaryKey(id) }))]);
      }
      finishArchivePhase(d, db);
    }
  }
  // La sera della scelta: le carte, poi ogni finale appuntabile a partire da qui.
  const c = camp(d);
  if (c.phase !== 'scelta') throw new Error(`${ramo.nome}: la campagna non arriva alla scelta (${c.phase} ${c.levelId})`);
  const cards = choiceCards(level(db.campaign.choiceDay), c, d.knowledge, db);
  page(d, 'g23', 'scelta', cards.map((x) => ({ key: x.note.textKey, note: x.note })));
  for (const card of cards.filter((x) => x.available)) {
    const save = clone(d);
    if (!choose(save, db, card.ending).ok) throw new Error(`${ramo.nome}: carta ${card.ending}`);
    const p = finalParams(save, db);
    const fin = p.level.id;
    page(save, fin, 'notte', (p.goals ?? []).map((g) => ({ key: `obiettivo:${JSON.stringify(g)}` })));
    const comp = db.computed.get(fin) ?? null;
    const o = simulateNight(p, comp?.base.rows ?? [], comp, db.balance);
    if (!o) throw new Error(`${ramo.nome}: finale ${fin} non simulabile`);
    const res = completeFinal(save, db, o);
    if (res.kind === 'riprova') throw new Error(`${ramo.nome}: il finale ${fin} non riesce con la soluzione calcolata`);
    page(save, fin, 'epilogo', res.epilogue.flatMap((v) => v.lines.map((l) => ({ key: l.textKey }))));
  }
  return out;
}

const PAGINE: Pagina[] = RAMI.flatMap(giocaRamo);


// ───────── Le condizioni di coerenza, dichiarate come dati ─────────

/** La domanda d'iscrizione della Nina è partita col vaporetto di g08 (Q043). */
const DOMANDA_PARTITA: StoryCond = { any: [{ flag: 'ninaIscritta' }, { ok: 'g08.nina' }] };
const PACE: StoryCond = { any: [{ flag: 'riconciliate', eq: true }, { ok: 'g18.teresa' }] };

interface Regola {
  id: string;
  /** Chiave del testo (o `obiettivo:<json>` per gli obiettivi di una notte, `nota:<id>` per un bigliettino). */
  chiave?: RegExp;
  /** Testo italiano (solo per i testi di questo pacchetto). */
  testo?: RegExp;
  richiede: StoryCond;
}
/** Un testo si mostra solo se, in quel momento, la condizione è vera. */
const COERENZA: Regola[] = [
  { id: 'Q043: ammessa solo se la domanda è partita', chiave: /^atto2\.(g14\.nina\.testo|g14\.alba\.ammessa\.|diario\.persone\.nina\.ammessa$)/, richiede: DOMANDA_PARTITA },
  { id: 'Q043: la domanda tardiva solo se non è partita', chiave: /^atto2\.(g14\.nina\.tardiva\.|g14\.alba\.tardiva\.|diario\.persone\.nina\.tardiva$)/, richiede: { not: DOMANDA_PARTITA } },
  { id: 'Q042: la Nina già partita nel finale vero', chiave: /^finali\.aperto\.epilogo\.ninaParte\./, richiede: { flag: 'nina', eq: 'parte' } },
  { id: 'Q042: la Nina rimasta nel finale vero', chiave: /^finali\.aperto\.epilogo\.ninaResta\./, richiede: { not: { flag: 'nina', eq: 'parte' } } },
  { id: 'Q042: nessun obiettivo per la Nina dopo che è partita', chiave: /^obiettivo:.*"nina"/, richiede: { not: { flag: 'nina', eq: 'parte' } } },
  { id: 'Q044: il fascio intero torna a Livia solo se non è uscito in g16', chiave: /^atto3\.(g22\.alba\.fascio\.|diario\.persone\.piero\.fascio$)/, richiede: { not: { flag: 'lettereLivia', eq: 'liberate' } } },
  { id: 'Q044: dopo g16 nel pozzo restano solo le ultime lettere e quella del \'51', chiave: /^atto3\.(g22\.alba\.prima\.|diario\.persone\.piero\.prima$)/, richiede: { flag: 'lettereLivia', eq: 'liberate' } },
  { id: 'Q046: le regole sciolte solo dopo la pace', chiave: /^atto3\.diario\.persone\.ada\.g18$/, richiede: PACE },
  { id: 'Q046: il nodo che resta solo senza la pace', chiave: /^atto3\.diario\.persone\.ada\.g18nodo$/, richiede: { not: PACE } },
  { id: 'Q057: dopo la lettera della nonna Ada sa a chi Zeno chiede perdono', testo: /non dice a chi|non c'è più/i, richiede: { not: { knows: 'oggetto', id: 'lettera_clotilde' } } },
  { id: 'Q019: il forno chiuso un\'ora non «resta aperto»', testo: /forno resta aperto/i, richiede: { not: { any: [{ reply: 'g10.marta', is: 'R1' }, { reply: 'g10.marta.senzaArchivio', is: 'R1' }] } } },
];
/** Fatti che si raccontano in una giornata sola (la stessa scena non torna un altro giorno). */
const UN_GIORNO: { id: string; chiave: RegExp }[] = [
  { id: 'Q042: la Nina parte una volta sola', chiave: /^atto3\.(g20\.alba\.parte\.|g20\.nina\.esito\.ok$|diario\.persone\.nina\.parte$)|^finali\.(aperto\.epilogo\.ninaResta\.2|seppia\.epilogo\.2\.2)$/ },
  { id: 'Q044: le lettere di Livia tornano una volta sola', chiave: /^atto2\.(g16\.alba\.fascio\.|g16\.zeno\.esito\.ok$|diario\.domande\.pozzo\.risposta$)|^atto3\.(g22\.alba\.fascio\.|diario\.persone\.piero\.fascio$)/ },
  { id: 'Q050: il perdono di Zeno per la valigia una volta sola', chiave: /^atto3\.g22\.alba\.perdono\.|^finali\.aperto\.epilogo\.zenoPerdono\./ },
];
/** Testi che non si possono leggere nella stessa giornata (alba, oggetto e bilancio). */
const MAI_INSIEME: { id: string; a: RegExp; b: RegExp }[] = [
  { id: 'Q047: g22, Zeno e mia madre si parlano all\'alba', a: /^atto3\.g22\.alba\.perdono\./, b: /senza dir(e|si) niente/i },
  { id: 'Q047: g16, il segreto di Marta è arrivato al prete', a: /^atto2\.g16\.piero\.esito\.ok$/, b: /non l'ha mai detto al prete/i },
  { id: 'Q046: g18, la confessione storta e le regole sciolte', a: /^atto3\.g18\.alba\.storta\./, b: /regole .*(togliere|sciolt)/i },
];

const MIE = /^(atto2|atto3|finali)\./;
const testoDi = (key: string): string => (IT.get(key) ?? '').replace(/\[\[([a-z]+)\]\]/g, (_, id: string) => t(`comune.pers.${id}.nome`));
const statoDi = (p: Pagina) => ({ s: p.s, k: p.k });
const vale = (c: StoryCond, p: Pagina): boolean => evalStory(c, p.s, p.k, { db });

describe('revisione 2: la storia regge su tutti i rami (R2-D3)', () => {
  it('la campagna simulata arriva alla scelta su ogni ramo, e il finale vero si gioca con la Nina partita e rimasta', () => {
    expect(RAMI.length).toBeGreaterThanOrEqual(12);
    for (const r of RAMI) expect(PAGINE.some((p) => p.ramo === r.nome && p.momento === 'scelta'), r.nome).toBe(true);
    const aperti = PAGINE.filter((p) => p.momento === 'epilogo' && p.giorno === 'fin_aperto');
    expect(aperti.some((p) => p.s.flags['nina'] === 'parte')).toBe(true);
    expect(aperti.some((p) => p.s.flags['nina'] !== 'parte')).toBe(true);
    // I rami toccano tutti e due i lati dei destini e della domanda della Nina.
    const scelte = PAGINE.filter((p) => p.momento === 'scelta');
    for (const [f, v] of [['nina', 'parte'], ['nina', 'resta'], ['bepi', 'salvo'], ['bepi', 'ferito'], ['lettereLivia', 'liberate'], ['lettereLivia', 'sepolte'], ['zenoLivia', true], ['zenoLivia', false]] as const) {
      expect(scelte.some((p) => p.s.flags[f] === v), `${f}=${String(v)}`).toBe(true);
    }
    expect(scelte.some((p) => vale(DOMANDA_PARTITA, p))).toBe(true);
    expect(scelte.some((p) => !vale(DOMANDA_PARTITA, p))).toBe(true);
    expect(scelte.some((p) => vale(PACE, p))).toBe(true);
    expect(scelte.some((p) => !vale(PACE, p))).toBe(true);
  });

  it('ogni testo mostrato esiste in italiano e in inglese', () => {
    const missing = new Set<string>();
    for (const p of PAGINE) for (const v of p.voci) if (!v.key.startsWith('obiettivo:') && (!IT.get(v.key) || !EN.get(v.key))) missing.add(`${p.momento} ${p.giorno}: ${v.key}`);
    expect([...missing]).toEqual([]);
  });

  it('condizioni di coerenza (COERENZA) su ogni pagina di ogni ramo', () => {
    const bad = new Set<string>();
    for (const p of PAGINE) {
      for (const v of p.voci) {
        for (const r of COERENZA) {
          const hit = (r.chiave && r.chiave.test(v.key)) || (r.testo && MIE.test(v.key) && r.testo.test(testoDi(v.key)));
          if (hit && !vale(r.richiede, p)) bad.add(`${r.id} — ${p.ramo} ${p.momento} ${p.giorno}: ${v.key}`);
        }
      }
    }
    expect([...bad]).toEqual([]);
  });

  it('fatti raccontati in una giornata sola (UN_GIORNO)', () => {
    const bad: string[] = [];
    for (const ramo of RAMI) {
      for (const u of UN_GIORNO) {
        // Un finale si gioca da solo a partire dalla scelta: ogni finale è un mondo a parte.
        for (const fin of [null, ...FINALI_DI(ramo.nome)]) {
          const days = new Set(PAGINE.filter((p) => p.ramo === ramo.nome && p.momento !== 'sera' && p.momento !== 'scelta' && p.momento !== 'notte' && (p.momento !== 'epilogo' || p.giorno === fin)).filter((p) => p.voci.some((v) => u.chiave.test(v.key))).map((p) => p.giorno));
          if (days.size > 1) bad.push(`${u.id} — ${ramo.nome}${fin ? ` (${fin})` : ''}: ${[...days].join(', ')}`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('testi che si contraddicono nella stessa giornata (MAI_INSIEME)', () => {
    const bad = new Set<string>();
    for (const [, ps] of giornate()) {
      const keys = ps.flatMap((p) => p.voci.map((v) => v.key));
      for (const m of MAI_INSIEME) {
        const a = keys.some((k) => m.a.test(k));
        const b = keys.some((k) => MIE.test(k) && m.b.test(testoDi(k)));
        if (a && b) bad.add(`${m.id} — ${ps[0]?.ramo} ${ps[0]?.giorno}`);
      }
    }
    expect([...bad]).toEqual([]);
  });

  it('Q045: le carte della scelta le firma chi ricorda Ada, ognuna col suo testo', () => {
    const bad = new Set<string>();
    for (const p of PAGINE.filter((x) => x.momento === 'scelta')) {
      for (const v of p.voci) {
        const n = v.note as NoteDef;
        if ((CAST as string[]).includes(n.author) && !vale({ memoria: n.author, gte: 1 }, p)) bad.add(`${p.ramo}: ${n.id} firmata da ${n.author}, che ha dimenticato Ada`);
      }
      expect(p.voci.length, p.ramo).toBe(4);
    }
    expect([...bad]).toEqual([]);
    for (const n of MY_NOTES) {
      const who = /^atto\d\.g\d\d\.([a-z]+)\./.exec(n.textKey)?.[1];
      expect(who, `${n.id}: ${n.textKey}`).toBe(n.author);
    }
  });

  it('Q048: alba, oggetto, bilancio, Archivio ed epilogo non ripetono la stessa frase (5 parole di fila)', () => {
    const bad = new Set<string>();
    const pages = [...giornate().values(), ...PAGINE.filter((p) => p.momento === 'archivio' || p.momento === 'epilogo').map((p) => [p])];
    for (const ps of pages) {
      const keys = [...new Set(ps.flatMap((p) => p.voci.map((v) => v.key)).filter((k) => !k.startsWith('obiettivo:')))];
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const a = keys[i] as string;
          const b = keys[j] as string;
          if (!MIE.test(a) && !MIE.test(b)) continue;
          const shared = ngramComune(testoDi(a), testoDi(b), 5);
          if (shared) bad.add(`${ps[0]?.giorno}: «${shared}» in ${a} e ${b}`);
        }
      }
    }
    expect([...bad].sort()).toEqual([]);
  });

  it('Q049: niente voci vaghe («o… o…») su quello che il giocatore ha appena visto', () => {
    const VAGO = /(^|[ ,])o (non |si |l'|il |la |lo |una |anche |al |alla |dal |dalla )/i;
    const bad = new Set<string>();
    for (const p of PAGINE.filter((x) => x.momento === 'bilancio' || x.momento === 'oggetto' || x.momento === 'alba')) {
      for (const v of p.voci) if (MIE.test(v.key) && /\.(esito|diario)\./.test(v.key) && VAGO.test(testoDi(v.key))) bad.add(`${v.key}: ${testoDi(v.key)}`);
    }
    expect([...bad]).toEqual([]);
  });
});

/** Finali giocati a partire dalla scelta di un ramo. */
function FINALI_DI(ramo: string): string[] {
  return [...new Set(PAGINE.filter((p) => p.ramo === ramo && p.momento === 'epilogo').map((p) => p.giorno))];
}
/** Pagine della stessa giornata di un ramo: alba, oggetto e bilancio. */
function giornate(): Map<string, Pagina[]> {
  const m = new Map<string, Pagina[]>();
  for (const p of PAGINE) {
    if (p.momento !== 'alba' && p.momento !== 'oggetto' && p.momento !== 'bilancio') continue;
    const k = `${p.ramo}|${p.giorno}`;
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  return m;
}
function parole(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[«»"“”.,;:!?()—–-]/g, ' ')
    .replace(/'/g, "' ")
    .split(/\s+/)
    .filter(Boolean);
}
/** La prima sequenza di `n` parole in comune fra due testi (o null). */
function ngramComune(a: string, b: string, n: number): string | null {
  const wa = parole(a);
  const wb = parole(b);
  const set = new Set<string>();
  for (let i = 0; i + n <= wa.length; i++) set.add(wa.slice(i, i + n).join(' '));
  for (let i = 0; i + n <= wb.length; i++) {
    const g = wb.slice(i, i + n).join(' ');
    if (set.has(g)) return g;
  }
  return null;
}
