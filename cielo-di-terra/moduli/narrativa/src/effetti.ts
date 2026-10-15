/**
 * Effetti dei contenuti: stringhe come "flag:x", "flag:x=3", "taccuino:id",
 * "missione:id avvia", "oggetto:+id", "evento:nome", "tempo:salta-a 6".
 *
 * Forme riconosciute:
 *   flag:x              accende x (true)
 *   flag:x=valore       imposta x (numeri, vero/falso, testo, "testo tra virgolette")
 *   flag:x+=2  flag:x-=1  somma al flag numerico
 *   !flag:x  flag:-x    rimuove x
 *   taccuino:id [aggiungi|chiudi|riapri|barra|rimuovi]
 *   cielo:testo libero  imposta la «riga del cielo» del taccuino (cielo: vuoto la cancella)
 *   missione:id [avvia|completa|fallisci]
 *   oggetto:+id  oggetto:-id  oggetto:id (= +id)  oggetto:+id*3
 *   evento:nome [argomenti…]   evento per il gioco (suoni, scene, dissolvenze…)
 *   tempo:salta-a 6  tempo:salta-a 6:30  tempo:avanza 2   richiesta al gioco
 *   dialogo:id [avvia]  richiesta al gioco di aprire un dialogo
 *
 * Forme dei contenuti veri, ricondotte alle precedenti:
 *   contatore:nome+1  contatore:nome-1  contatore:nome=3  contatore:nome   (flag numerici)
 *   testo:id                → evento:testo id          (il gioco mostra un testo lungo di testi.json)
 *   suggerimento:id         → evento:suggerimento id   (il gioco mostra un suggerimento)
 *   variante:E1=Abitata     → evento:variante E1 Abitata (il gioco cambia la variante di un elemento mobile)
 *   orologio:… musica:… suono:… battuta:… pianta:… npc:…  → evento:<prefisso> <argomenti>
 *   germoglio:+1            → oggetto:+germoglio
 *   dormi:fino 05:30        → tempo:salta-a 5.5
 *   missione:id completata  → missione:id completa
 */

/**
 * Prefissi degli effetti che sono richieste al gioco (regia, suoni, UI):
 * diventano l'evento `evento` con `nome` uguale al prefisso.
 */
export const PREFISSI_EVENTO: readonly string[] = [
  'testo',
  'suggerimento',
  'variante',
  'orologio',
  'musica',
  'suono',
  'battuta',
  'pianta',
  'npc',
];
import { analizzaValore } from './condizioni';
import type { ValoreFlag } from './flag';

export type AzioneTaccuino = 'aggiungi' | 'chiudi' | 'riapri' | 'barra' | 'rimuovi';
export type AzioneMissione = 'avvia' | 'completa' | 'fallisci';

export type Effetto =
  | { tipo: 'flag'; nome: string; valore: ValoreFlag }
  | { tipo: 'flag-somma'; nome: string; delta: number }
  | { tipo: 'flag-rimuovi'; nome: string }
  | { tipo: 'taccuino'; id: string; azione: AzioneTaccuino }
  | { tipo: 'cielo'; testo: string }
  | { tipo: 'missione'; id: string; azione: AzioneMissione }
  | { tipo: 'oggetto'; id: string; delta: number }
  | { tipo: 'evento'; nome: string; argomenti: string[] }
  | { tipo: 'tempo'; azione: 'salta-a' | 'avanza'; ore: number }
  | { tipo: 'dialogo'; id: string };

export class ErroreEffetto extends Error {
  constructor(
    readonly motivo: string,
    readonly testo: string,
  ) {
    super(`Effetto «${testo}»: ${motivo}`);
    this.name = 'ErroreEffetto';
  }
}

const RE_ID = /^[\p{L}\p{N}_.\-/']+$/u;
const RE_FLAG = /^[\p{L}\p{N}_.\-/':]+$/u;

const AZIONI_TACCUINO: Record<string, AzioneTaccuino> = {
  aggiungi: 'aggiungi',
  scrivi: 'aggiungi',
  apri: 'aggiungi',
  chiudi: 'chiudi',
  chiusa: 'chiudi',
  risolvi: 'chiudi',
  riapri: 'riapri',
  barra: 'barra',
  barrata: 'barra',
  rimuovi: 'rimuovi',
  cancella: 'rimuovi',
};

const AZIONI_MISSIONE: Record<string, AzioneMissione> = {
  avvia: 'avvia',
  attiva: 'avvia',
  inizia: 'avvia',
  completa: 'completa',
  completata: 'completa',
  concludi: 'completa',
  conclusa: 'completa',
  fallisci: 'fallisci',
  fallita: 'fallisci',
};

function leggiOre(s: string): number | null {
  const m = /^(\d{1,2}(?:[.,]\d+)?)(?::(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]!.replace(',', '.')) + (m[2] ? Number(m[2]) / 60 : 0);
}

/** Analizza un effetto. Lancia `ErroreEffetto` se la forma è sconosciuta. */
export function analizzaEffetto(testo: string): Effetto {
  const s = testo.trim().replace(/^([\p{L}_]+):\s+/u, '$1:');
  const errore: (motivo: string) => never = (motivo) => {
    throw new ErroreEffetto(motivo, testo);
  };
  const id = (x: string, cosa: string, re: RegExp = RE_ID): string => {
    if (!x) errore(`manca ${cosa}`);
    if (!re.test(x)) errore(`${cosa} non valido «${x}»`);
    return x;
  };
  const nomeFlag = (x: string): string => id(x, 'il nome del flag', RE_FLAG);
  if (!s) errore('effetto vuoto');

  if (s.startsWith('!')) {
    const resto = s.slice(1).trim();
    if (!resto.toLowerCase().startsWith('flag:')) errore('«!» si usa solo davanti a «flag:»');
    return { tipo: 'flag-rimuovi', nome: nomeFlag(resto.slice(5).trim()) };
  }

  const due = s.indexOf(':');
  if (due < 0) errore('manca il prefisso (flag:, taccuino:, missione:, oggetto:, evento:, tempo:, cielo:, dialogo:)');
  const prefisso = s.slice(0, due).toLowerCase();
  const arg = s.slice(due + 1).trim();
  const parole = arg.split(/\s+/).filter(Boolean);

  switch (prefisso) {
    case 'flag': {
      const compatto = arg.replace(/\s*(\+=|-=|=)\s*/, '$1');
      let m = /^([^=+\-\s][^=\s]*?)(\+=|-=)(-?\d+(?:[.,]\d+)?)$/.exec(compatto);
      if (m) {
        const d = Number(m[3]!.replace(',', '.'));
        return { tipo: 'flag-somma', nome: nomeFlag(m[1]!), delta: m[2] === '-=' ? -d : d };
      }
      if (compatto.startsWith('-') && !compatto.includes('=')) {
        return { tipo: 'flag-rimuovi', nome: nomeFlag(compatto.slice(1)) };
      }
      m = /^([^=\s]+)=(.*)$/.exec(compatto);
      if (m) {
        if (m[2] === '') errore('manca il valore dopo «=»');
        return { tipo: 'flag', nome: nomeFlag(m[1]!), valore: analizzaValore(m[2]!) };
      }
      return { tipo: 'flag', nome: nomeFlag(compatto), valore: true };
    }
    case 'contatore': {
      const compatto = arg.replace(/\s+/g, '');
      const m = /^([^=+\-]+?)(\+=|-=|\+|-|=)(\d+)$/.exec(compatto);
      if (m) {
        const n = Number(m[3]);
        if (m[2] === '=') return { tipo: 'flag', nome: nomeFlag(m[1]!), valore: n };
        return { tipo: 'flag-somma', nome: nomeFlag(m[1]!), delta: m[2]!.startsWith('-') ? -n : n };
      }
      if (/[=+]/.test(compatto)) errore('forma: contatore:nome+1, contatore:nome-1 o contatore:nome=3');
      return { tipo: 'flag-somma', nome: nomeFlag(compatto), delta: 1 };
    }
    case 'variante': {
      const m = /^([^=\s]+)\s*=\s*(\S+)$/.exec(arg);
      if (!m) return errore('forma: variante:elemento=Variante');
      return { tipo: 'evento', nome: 'variante', argomenti: [id(m[1]!, "l'elemento"), id(m[2]!, 'la variante')] };
    }
    case 'germoglio':
    case 'germogli': {
      const m = /^([+-]?)(\d+)$/.exec(arg.replace(/\s+/g, ''));
      if (!m || Number(m[2]) <= 0) return errore('forma: germoglio:+1');
      return { tipo: 'oggetto', id: 'germoglio', delta: m[1] === '-' ? -Number(m[2]) : Number(m[2]) };
    }
    case 'dormi': {
      if (parole[0]?.toLowerCase() !== 'fino' || parole.length !== 2) return errore('forma: dormi:fino 05:30');
      const ore = leggiOre(parole[1]!);
      if (ore === null || ore >= 24) return errore(`ore non valide «${parole[1]}»`);
      return { tipo: 'tempo', azione: 'salta-a', ore };
    }
    case 'taccuino':
    case 'voce': {
      if (parole.length > 2) errore('troppe parole (forma: taccuino:id [chiudi|barra|…])');
      const azione = parole[1] ? AZIONI_TACCUINO[parole[1].toLowerCase()] : 'aggiungi';
      if (!azione) errore(`azione del taccuino sconosciuta «${parole[1]}» (ammesse: ${Object.keys(AZIONI_TACCUINO).join(', ')})`);
      return { tipo: 'taccuino', id: id(parole[0] ?? '', "l'id della voce"), azione };
    }
    case 'cielo':
      return { tipo: 'cielo', testo: arg };
    case 'missione': {
      if (parole.length > 2) errore('troppe parole (forma: missione:id avvia)');
      const azione = parole[1] ? AZIONI_MISSIONE[parole[1].toLowerCase()] : 'avvia';
      if (!azione) errore(`azione di missione sconosciuta «${parole[1]}» (ammesse: ${Object.keys(AZIONI_MISSIONE).join(', ')})`);
      return { tipo: 'missione', id: id(parole[0] ?? '', "l'id della missione"), azione };
    }
    case 'oggetto': {
      const m = /^([+-]?)\s*([^\s*]+?)\s*(?:\*\s*(\d+))?$/.exec(arg);
      if (!m) return errore('forma: oggetto:+id oppure oggetto:-id (facoltativo *N)');
      const n = m[3] ? Number(m[3]) : 1;
      if (n <= 0) errore('quantità non valida');
      return { tipo: 'oggetto', id: id(m[2]!, "l'id dell'oggetto"), delta: m[1] === '-' ? -n : n };
    }
    case 'evento':
      return { tipo: 'evento', nome: id(parole[0] ?? '', "il nome dell'evento"), argomenti: parole.slice(1) };
    case 'tempo': {
      const azione = parole[0]?.toLowerCase();
      if (azione !== 'salta-a' && azione !== 'avanza') return errore('forma: tempo:salta-a 6 oppure tempo:avanza 2');
      if (parole.length !== 2) errore('manca il numero di ore');
      const ore = leggiOre(parole[1]!);
      if (ore === null) return errore(`ore non valide «${parole[1]}»`);
      if (azione === 'salta-a' && ore >= 24) errore("l'ora di destinazione deve essere fra 0 e 24");
      return { tipo: 'tempo', azione, ore };
    }
    case 'dialogo': {
      if (parole.length > 2 || (parole[1] && !['avvia', 'apri', 'inizia'].includes(parole[1].toLowerCase()))) {
        errore('forma: dialogo:id [avvia]');
      }
      return { tipo: 'dialogo', id: id(parole[0] ?? '', "l'id del dialogo") };
    }
    default:
      if (PREFISSI_EVENTO.includes(prefisso)) {
        if (!parole.length) errore(`manca l'argomento dopo «${prefisso}:»`);
        return { tipo: 'evento', nome: prefisso, argomenti: parole };
      }
      return errore(`prefisso sconosciuto «${prefisso}:»`);
  }
}

/** Normalizza un campo effetti dei contenuti (stringa singola, lista o assente). */
export function listaEffetti(e: unknown): string[] {
  if (e === null || e === undefined || e === '') return [];
  if (typeof e === 'string') return [e];
  if (Array.isArray(e)) return e.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  return [];
}

/** Riscrive un effetto in forma canonica. */
export function stampaEffetto(e: Effetto): string {
  switch (e.tipo) {
    case 'flag':
      return e.valore === true ? `flag:${e.nome}` : `flag:${e.nome}=${typeof e.valore === 'boolean' ? 'falso' : e.valore}`;
    case 'flag-somma':
      return `flag:${e.nome}${e.delta < 0 ? '-=' : '+='}${Math.abs(e.delta)}`;
    case 'flag-rimuovi':
      return `!flag:${e.nome}`;
    case 'taccuino':
      return e.azione === 'aggiungi' ? `taccuino:${e.id}` : `taccuino:${e.id} ${e.azione}`;
    case 'cielo':
      return `cielo:${e.testo}`;
    case 'missione':
      return `missione:${e.id} ${e.azione}`;
    case 'oggetto':
      return `oggetto:${e.delta < 0 ? '-' : '+'}${e.id}${Math.abs(e.delta) !== 1 ? `*${Math.abs(e.delta)}` : ''}`;
    case 'evento':
      return `evento:${[e.nome, ...e.argomenti].join(' ')}`;
    case 'tempo':
      return `tempo:${e.azione} ${e.ore}`;
    case 'dialogo':
      return `dialogo:${e.id} avvia`;
  }
}
