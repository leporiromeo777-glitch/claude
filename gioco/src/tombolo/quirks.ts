/**
 * Stranezze nella scheda del personaggio (D06, TOM-17).
 *
 * - Nella campagna una stranezza compare per esteso solo quando la mostra anche
 *   il Taccuino: è conosciuta e sono già nel Taccuino tutte le voci su quella
 *   persona che la nominano. È una copia di `quirkRevealed` di
 *   src/campaign/diary.ts (il tombolo non importa la campagna); un test controlla
 *   che le due diano lo stesso risultato sui dati veri.
 * - Nel Merletto del giorno, nel libero e negli spartiti la scheda elenca tutte le
 *   stranezze attive del livello (non c'è un Taccuino da anticipare).
 */
import type { CharacterId, ContentDB, Knowledge, NightOrigin, QuirkId, StoryCond } from '../core/types';

/** La condizione chiede di conoscere la stranezza `q` (non dentro una negazione). */
function mentionsQuirk(c: StoryCond, q: string): boolean {
  if ('all' in c) return c.all.some((x) => mentionsQuirk(x, q));
  if ('any' in c) return c.any.some((x) => mentionsQuirk(x, q));
  if ('not' in c) return false;
  return 'knows' in c && c.knows === 'quirk' && c.id === q;
}

/** Copia di `quirkRevealed` della campagna (stessa regola del Taccuino). */
export function quirkRevealed(q: QuirkId, character: CharacterId, k: Pick<Knowledge, 'quirks' | 'diary'>, db: Pick<ContentDB, 'diary'>): boolean {
  if (!k.quirks.includes(q)) return false;
  for (const def of db.diary.values()) {
    if (def.section !== 'persone' || def.character !== character) continue;
    if (!mentionsQuirk(def.unlock, q)) continue;
    if (!k.diary.includes(def.id)) return false;
  }
  return true;
}

/** Modalità senza Taccuino: la scheda dice tutte le stranezze attive del livello. */
export function extraMode(origin: NightOrigin): boolean {
  return origin === 'giornaliero' || origin === 'libero' || origin === 'spartito';
}

/**
 * Stranezze da mostrare nella scheda (e nel segno sul fuso) di un personaggio:
 * nelle modalità extra quelle attive; altrimenti quelle conosciute e già nel Taccuino.
 */
export function shownQuirks(
  origin: NightOrigin,
  character: CharacterId,
  characterQuirks: readonly QuirkId[],
  active: readonly QuirkId[],
  known: Pick<Knowledge, 'quirks' | 'diary'>,
  db: Pick<ContentDB, 'diary'>,
): QuirkId[] {
  if (extraMode(origin)) return characterQuirks.filter((q) => active.includes(q));
  return characterQuirks.filter((q) => active.includes(q) && quirkRevealed(q, character, known, db));
}

/**
 * Stranezze del personaggio che il giocatore conosce ma che stanotte non contano
 * (Q022 anche nella scheda): con queste la scheda non dice «Nessuna stranezza
 * nota.» ma «Nessuna stranezza nota che conti stanotte.». Nelle modalità extra
 * sono tutte quelle del personaggio non attive; nella storia solo quelle già
 * scritte nel Taccuino (le altre non si svelano).
 */
export function dormantQuirks(
  origin: NightOrigin,
  character: CharacterId,
  characterQuirks: readonly QuirkId[],
  active: readonly QuirkId[],
  known: Pick<Knowledge, 'quirks' | 'diary'>,
  db: Pick<ContentDB, 'diary'>,
): QuirkId[] {
  const asleep = characterQuirks.filter((q) => !active.includes(q));
  if (extraMode(origin)) return asleep;
  return asleep.filter((q) => quirkRevealed(q, character, known, db));
}
