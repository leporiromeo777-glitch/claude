/**
 * Chiavi i18n prodotte dal motore.
 *
 * Il motore non ha un proprio namespace di testi: le sue chiavi stanno nel
 * namespace del tombolo (`src/i18n/<lingua>/tombolo.json`), che le mostra.
 * Parametri: gli id dei fili (`chi`, `sopra`, `sotto`, `a`, `b`) e dei luoghi
 * (`luogo`) sono identificatori, che il tombolo traduce in nomi prima di
 * comporre il testo; `ora` è un numero.
 *
 * Violazioni (`tombolo.violazione.<codice>`):
 *   rifiuto   Marta non passa sotto Teresa («No.»)
 *   faro      Zeno si allontanerebbe troppo dal Faro
 *   corre     Gino non sta fermo
 *   spillo    spillo d'ottone non rispettato {chi, luogo, ora}
 *   matassa   matassa finita {matassa, usata}
 *   bloccato  filo bloccato (nodo o marea) {chi}
 *   occupato  i fili sono già in un incrocio forzato
 *   forzato   un filo che si muove da solo (filo nero, autotessitura)
 *   disgiunto due incroci sullo stesso filo, o coppia inesistente {coppia}
 *   finita    la notte è finita, non ci sono più righe
 *
 * Condizioni (`tombolo.cond.<stato>.<tipo>`, stato = fallita | rischio).
 *
 * Suggerimenti (`tombolo.hint.…`): vedi `HINT_KEYS`.
 */
import type { Condition } from '../core/types';

export const VIOLATION_CODES = ['rifiuto', 'faro', 'corre', 'spillo', 'matassa', 'bloccato', 'occupato', 'forzato', 'disgiunto', 'finita'] as const;

export function violationKey(code: string): string {
  return `tombolo.violazione.${code}`;
}

export const CONDITION_TYPES: readonly Condition['t'][] = [
  'presso', 'maiPresso', 'incontra', 'nonIncontra', 'sopra', 'consegnata', 'ha', 'nonHa',
  'parte', 'resta', 'esceCon', 'sano', 'incontriAlmeno', 'tutti', 'almeno', 'non',
];

export function conditionKey(state: 'fallita' | 'rischio', t: Condition['t']): string {
  return `tombolo.cond.${state}.${t}`;
}

/**
 * Suggerimenti (GDD 14):
 *   spinta.spillo     spillo d'ottone più urgente {chi, luogo, ora}
 *   spinta.richiesta  richiesta più a rischio {ora}
 *   spinta.generico   frase generica della nonna
 *   indizio.sopra     «Alle {ora} {sopra} deve passare sopra {sotto}»
 *   indizio.incontro  «Alle {ora} {a} e {b} devono incontrarsi»
 *   indizio.quiete    «Alle {ora} lascia stare i fili»
 *   fantasma          incrocio giusto della riga corrente {ora, sopra, sotto}
 *   fantasma.quiete   in questa riga non serve nessun incrocio {ora}
 *   impossibile       da qui non si arriva: disfa qualche riga
 */
export const HINT_KEYS = {
  spintaSpillo: 'tombolo.hint.spinta.spillo',
  spintaRichiesta: 'tombolo.hint.spinta.richiesta',
  spintaGenerico: 'tombolo.hint.spinta.generico',
  indizioSopra: 'tombolo.hint.indizio.sopra',
  indizioIncontro: 'tombolo.hint.indizio.incontro',
  indizioQuiete: 'tombolo.hint.indizio.quiete',
  fantasma: 'tombolo.hint.fantasma',
  fantasmaQuiete: 'tombolo.hint.fantasma.quiete',
  impossibile: 'tombolo.hint.impossibile',
} as const;

/** Tutte le chiavi che il motore può produrre (per i test dei testi del tombolo). */
export function engineTextKeys(): string[] {
  const out: string[] = VIOLATION_CODES.map(violationKey);
  for (const t of CONDITION_TYPES) {
    out.push(conditionKey('fallita', t), conditionKey('rischio', t));
  }
  out.push(...Object.values(HINT_KEYS));
  return out;
}
