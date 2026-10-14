/**
 * Il Taccuino come conoscenza (GDD 5.7, 5.8): voci sbloccate dalle loro condizioni,
 * domande aperte e chiuse, pista del momento, pagine del Libro dei Punti.
 *
 * Le voci si sbloccano quando la loro `unlock` diventa vera e restano anche dopo un
 * riavvolgimento (sono conoscenza). Si ricontrollano a ogni passaggio importante: fine
 * della notte, stranezza scoperta, oggetto letto, risposta, Archivio, finale.
 */
import type { BookPageDef, CampaignState, CharacterId, ContentDB, DiaryEntryDef, DiaryEntryId, Knowledge, QuestionId, QuirkId, StoryCond } from '../core/types';
import { addDiary, evalStory, emptyLog, type EffectLog } from './story';

type Db = Pick<ContentDB, 'diary' | 'levels' | 'balance' | 'book'>;

/** Sblocca tutte le voci la cui condizione è vera (fino a stabilità). Restituisce le nuove, in ordine. */
export function refreshDiary(s: CampaignState, k: Knowledge, db: Db, log: EffectLog = emptyLog()): DiaryEntryId[] {
  const added: DiaryEntryId[] = [];
  const o = { db };
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const def of db.diary.values()) {
      if (k.diary.includes(def.id)) continue;
      let ok = false;
      try {
        ok = evalStory(def.unlock, s, k, o);
      } catch {
        ok = false;
      }
      if (ok && addDiary(k, def.id, o, log)) {
        added.push(def.id);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return added;
}

/** Domanda a cui si riferisce una voce: la prima che apre o chiude, oppure quella del suo id. */
export function questionOf(def: DiaryEntryDef, known?: ReadonlySet<string>): QuestionId | null {
  const q = def.opens?.[0] ?? def.closes?.[0];
  if (q) return q;
  const m = /^domande\.([^.]+)\./.exec(def.id);
  if (m && m[1] && (!known || known.has(m[1]))) return m[1];
  return null;
}

/**
 * Pista del momento (GDD 5.8): fra le voci con `pista` già nel Taccuino, la più recente
 * la cui domanda non è ancora risolta.
 */
export function currentPista(k: Knowledge, db: Pick<ContentDB, 'diary'>): DiaryEntryId | null {
  for (let i = k.diary.length - 1; i >= 0; i--) {
    const id = k.diary[i];
    if (!id) continue;
    const def = db.diary.get(id);
    if (!def?.pista) continue;
    const q = questionOf(def);
    if (q && k.questions[q] === 'risolta') continue;
    // Una pista sull'Archivio vale finché nella cassapanca c'è un merletto da rammendare.
    if (!q && def.section === 'archivio' && !Object.values(k.archive).some((st) => st !== 'rammendato')) continue;
    return id;
  }
  return null;
}

/** Voci del Taccuino di una sezione, nell'ordine in cui sono state scoperte. */
export function diaryOf(k: Knowledge, db: Pick<ContentDB, 'diary'>, section: DiaryEntryDef['section'], character?: string): DiaryEntryDef[] {
  const out: DiaryEntryDef[] = [];
  for (const id of k.diary) {
    const def = db.diary.get(id);
    if (!def || def.section !== section) continue;
    if (character !== undefined && def.character !== character) continue;
    out.push(def);
  }
  return out;
}

/** Pagine del Libro dei Punti sbloccate, nell'ordine del libro. */
export function bookPages(s: CampaignState, k: Knowledge, db: Db): BookPageDef[] {
  const o = { db };
  return db.book.filter((p) => {
    try {
      return evalStory(p.unlock, s, k, o);
    } catch {
      return false;
    }
  });
}

/** Le pagine scritte da Ada stessa, a matita (GDD 5.7): il nome e il filo nero. */
export function bookPageByAda(p: BookPageDef): boolean {
  return p.rule === 'nome' || p.rule === 'nero';
}

/** La condizione chiede di conoscere la stranezza `q` (non dentro una negazione). */
function mentionsQuirk(c: StoryCond, q: string): boolean {
  if ('all' in c) return c.all.some((x) => mentionsQuirk(x, q));
  if ('any' in c) return c.any.some((x) => mentionsQuirk(x, q));
  if ('not' in c) return false;
  return 'knows' in c && c.knows === 'quirk' && c.id === q;
}

/**
 * La stranezza si può scrivere per esteso nella scheda della persona (GDD 5.8): è
 * conosciuta e sono già nel Taccuino tutte le voci su quella persona che la nominano.
 * Così una stranezza che i contenuti svelano più tardi (Teresa «si è accesa» nel
 * prologo, ma che legga le lettere lo si capisce solo dopo g05) non si rivela prima.
 */
export function quirkRevealed(q: QuirkId, character: CharacterId, k: Pick<Knowledge, 'quirks' | 'diary'>, db: Pick<ContentDB, 'diary'>): boolean {
  if (!k.quirks.includes(q)) return false;
  for (const def of db.diary.values()) {
    if (def.section !== 'persone' || def.character !== character) continue;
    if (!mentionsQuirk(def.unlock, q)) continue;
    if (!k.diary.includes(def.id)) return false;
  }
  return true;
}
