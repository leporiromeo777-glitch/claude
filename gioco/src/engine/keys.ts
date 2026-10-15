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
 *   corre     Gino è stato fermo un'ora e deve incrociare {chi, vicino} (C01)
 *   spillo    spillo d'ottone non rispettato {chi, luogo, ora}
 *   matassa   matassa finita {matassa, usata}
 *   bloccato  filo bloccato {chi, causa: 'nodo' | 'marea'} (C13)
 *   occupato  i fili sono già in un incrocio forzato {a, b, nero?} (C13: nero = il filo
 *             nero o autonomo che muove la coppia)
 *   forzato   un filo che si muove da solo (filo nero, autotessitura) {nero?}
 *   disgiunto due incroci sullo stesso filo, o coppia inesistente {coppia}
 *   finita    la notte è finita, non ci sono più righe
 *
 * `messageKey` resta la chiave generica del codice; le chiavi di dettaglio
 * (`tombolo.violazione.bloccato.nodo|marea`, `tombolo.violazione.occupato.nero`)
 * le sceglie il tombolo dai parametri (REVISIONE-1, sezione 4: senza parametri
 * si ripiega sulla chiave generica); `violationTextKey` fa questa scelta.
 *
 * Condizioni (`tombolo.cond.<stato>.<tipo>`, stato = fallita | rischio | perso;
 * perso = non ancora decisa ma ormai impossibile, revisione 2, Q015):
 * parametri chi, a, b, perlina, luogo, ora, n secondo la condizione; per
 * `incontra`/`nonIncontra` con una finestra anche dalle e alle, per `sopra` con
 * un limite alle (C13).
 *
 * Suggerimenti (`tombolo.hint.…`): vedi `HINT_KEYS`.
 */
import type { Condition, Violation } from '../core/types';

export const VIOLATION_CODES = ['rifiuto', 'faro', 'corre', 'spillo', 'matassa', 'bloccato', 'occupato', 'forzato', 'disgiunto', 'finita'] as const;

export function violationKey(code: string): string {
  return `tombolo.violazione.${code}`;
}

/** Chiavi di dettaglio delle violazioni, scelte dai parametri (C13). */
export const VIOLATION_DETAIL_KEYS = ['tombolo.violazione.bloccato.nodo', 'tombolo.violazione.bloccato.marea', 'tombolo.violazione.occupato.nero'] as const;

/**
 * Chiave del testo di una violazione (C13): `bloccato` con `causa` → `…bloccato.<causa>`;
 * `occupato` con `nero` → `…occupato.nero`; altrimenti `messageKey`.
 */
export function violationTextKey(v: Pick<Violation, 'code' | 'messageKey' | 'params'>): string {
  const p = v.params ?? {};
  if (v.code === 'bloccato' && (p.causa === 'nodo' || p.causa === 'marea') && v.messageKey === violationKey('bloccato')) return `${violationKey('bloccato')}.${p.causa}`;
  if (v.code === 'occupato' && typeof p.nero === 'string' && p.nero !== '') return `${violationKey('occupato')}.nero`;
  return v.messageKey;
}

/** Condizioni foglia: ognuna può fallire con il suo motivo. */
export const CONDITION_TYPES: readonly Condition['t'][] = [
  'presso', 'maiPresso', 'incontra', 'nonIncontra', 'sopra', 'consegnata', 'ha', 'nonHa',
  'parte', 'resta', 'esceCon', 'sano', 'incontriAlmeno',
];

/** Condizioni che possono essere "a rischio" (hanno un limite di distanza o di tempo). */
export const RISK_TYPES: readonly Condition['t'][] = ['presso', 'incontra', 'sopra', 'consegnata', 'ha', 'parte', 'esceCon', 'incontriAlmeno'];

export function conditionKey(state: 'fallita' | 'rischio' | 'perso', t: Condition['t']): string {
  return `tombolo.cond.${state}.${t}`;
}

/**
 * Suggerimenti (GDD 14):
 *   spinta.spillo     spillo d'ottone più urgente {chi, luogo, ora}
 *   spinta.richiesta  richiesta più a rischio {ora}
 *   spinta.generico   frase generica della nonna
 *   indizio.sopra     «Alle {ora} {sopra} deve passare sopra {sotto}» (manca nella bozza)
 *   indizio.sopraAltri  lo stesso, e nella riga c'è ancora {altri} da sistemare
 *   indizio.verso     l'incrocio c'è ma col verso rovesciato {ora, sopra, sotto, altri}
 *   indizio.troppo    un incrocio della bozza che la soluzione non ha {ora, a, b, altri}
 *   indizio.va        la bozza è la riga giusta: «Quest'ora va bene: fissala» {ora}
 *   indizio.quiete    «Alle {ora} lascia stare i fili» (riga vuota, bozza vuota)
 *   fantasma          l'unico incrocio della riga corrente {ora, sopra, sotto}
 *   fantasma.due      i due incroci della riga {ora, sopra, sotto, sopra2, sotto2}
 *   fantasma.tre      i tre incroci della riga {… sopra3, sotto3}
 *   fantasma.va       la bozza è già la riga giusta {ora}
 *   fantasma.quiete   in questa riga non serve nessun incrocio {ora}
 *   impossibile       da qui non si arriva: disfa qualche riga
 */
export const HINT_KEYS = {
  spintaSpillo: 'tombolo.hint.spinta.spillo',
  spintaRichiesta: 'tombolo.hint.spinta.richiesta',
  spintaGenerico: 'tombolo.hint.spinta.generico',
  indizioSopra: 'tombolo.hint.indizio.sopra',
  indizioSopraAltri: 'tombolo.hint.indizio.sopraAltri',
  indizioVerso: 'tombolo.hint.indizio.verso',
  indizioTroppo: 'tombolo.hint.indizio.troppo',
  indizioVa: 'tombolo.hint.indizio.va',
  indizioQuiete: 'tombolo.hint.indizio.quiete',
  fantasma: 'tombolo.hint.fantasma',
  fantasmaDue: 'tombolo.hint.fantasma.due',
  fantasmaTre: 'tombolo.hint.fantasma.tre',
  fantasmaVa: 'tombolo.hint.fantasma.va',
  fantasmaQuiete: 'tombolo.hint.fantasma.quiete',
  impossibile: 'tombolo.hint.impossibile',
} as const;

/** Tutte le chiavi che il motore può produrre (per i test dei testi del tombolo). */
export function engineTextKeys(): string[] {
  const out: string[] = [...VIOLATION_CODES.map(violationKey), ...VIOLATION_DETAIL_KEYS];
  for (const t of CONDITION_TYPES) out.push(conditionKey('fallita', t));
  for (const t of RISK_TYPES) out.push(conditionKey('rischio', t));
  for (const t of RISK_TYPES) out.push(conditionKey('perso', t));
  out.push(...Object.values(HINT_KEYS));
  return out;
}
