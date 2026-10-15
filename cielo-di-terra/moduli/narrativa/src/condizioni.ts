/**
 * Condizioni dei contenuti: analisi (parser) e valutazione.
 *
 * Grammatica (le parole chiave non distinguono maiuscole e minuscole):
 *
 *   espressione := congiunzione ( "o" congiunzione )*
 *   congiunzione := unario ( "e" unario )*
 *   unario      := ( "!" | "non" ) unario | primario
 *   primario    := "(" espressione ")" | atomo
 *
 * Sinonimi: `&&` e `,` valgono «e», `||` vale «o».
 *
 * Atomi riconosciuti:
 *   vero | falso | sempre | mai | inizio (= vero: «subito, appena la missione parte»)
 *   notte | giorno (senza due punti: è giorno, cioè non notte)
 *   flag:nome                 flag acceso (definito e diverso da false/0/"")
 *   flag:nome=valore          anche != > >= < <= (i confronti d'ordine vogliono un numero)
 *   luogo:id [raggiunto]
 *   ora:>=20  ora:<6  ora:20  ora:6-9  ora:22-5  ora:6:30-9
 *       intervalli semiaperti [da, a); se da > a l'intervallo scavalca la mezzanotte;
 *       un'ora sola (ora:20) vale per tutta l'ora [20, 21)
 *   giorno:>=2  giorno:2  giorno:2-4   (gli intervalli di giorni sono chiusi)
 *   cella:id [rilevata|vista|bianca|carta|abitata|mietuta|scritta|smontata]
 *       (anche colore = rilevata, matita = vista, bianco = bianca; particella: è sinonimo)
 *   dialogo:id [finito|iniziato]
 *   missione:id [completata|attiva|avviata|inattiva]
 *   passo:id [completato|attivo]               (id unico fra tutte le missioni)
 *   passo:missione/passo [completato|attivo]   (anche missione.passo)
 *   contatore:nome>=3  contatore:nome          (sinonimo di flag: sui contatori numerici)
 *   variante:E1=Abitata                        (sinonimo di particella:E1 abitata)
 *   oggetto:id   oggetto:id>=2
 *   taccuino:id [presente|aperta|chiusa|barrata]
 *
 * Una lista di condizioni è vera quando sono vere tutte. `null`, `undefined`,
 * stringa vuota e lista vuota sono sempre vere. Sono ammessi anche gli
 * oggetti `{ e: [...] }`, `{ tutte: [...] }`, `{ o: [...] }`,
 * `{ almeno_una: [...] }`, `{ non: ... }`.
 */
import { valoreVero, type ValoreFlag } from './flag';

export type Operatore = '=' | '!=' | '>' | '>=' | '<' | '<=';

export type Confronto =
  | { tipo: 'op'; op: Operatore; valore: number }
  | { tipo: 'intervallo'; da: number; a: number };

export type StatoMissioneCondizione = 'completata' | 'attiva' | 'avviata' | 'inattiva';
export type StatoPassoCondizione = 'completato' | 'attivo';
export type StatoDialogoCondizione = 'finito' | 'iniziato';
export type StatoTaccuinoCondizione = 'presente' | 'aperta' | 'chiusa' | 'barrata';

export type Atomo =
  | { k: 'flag'; nome: string; op?: Operatore; valore?: ValoreFlag }
  | { k: 'luogo'; id: string }
  | { k: 'ora'; confronto: Confronto }
  | { k: 'giorno'; confronto: Confronto }
  | { k: 'notte' }
  | { k: 'di' }
  | { k: 'cella'; id: string; stato: string }
  | { k: 'dialogo'; id: string; stato: StatoDialogoCondizione }
  | { k: 'missione'; id: string; stato: StatoMissioneCondizione }
  | { k: 'passo'; missione?: string; passo: string; stato: StatoPassoCondizione }
  | { k: 'oggetto'; id: string; op: Operatore; quantita: number }
  | { k: 'taccuino'; id: string; stato: StatoTaccuinoCondizione }
  | { k: 'extra'; prefisso: string; argomento: string; qualificatore?: string };

export type NodoCondizione =
  | { tipo: 'costante'; valore: boolean }
  | { tipo: 'e'; figli: NodoCondizione[] }
  | { tipo: 'o'; figli: NodoCondizione[] }
  | { tipo: 'non'; figlio: NodoCondizione }
  | { tipo: 'atomo'; atomo: Atomo };

/** Forma di una condizione così come appare nei JSON dei contenuti. */
export type CondizioneGrezza =
  | string
  | boolean
  | null
  | undefined
  | readonly CondizioneGrezza[]
  | { readonly [chiave: string]: CondizioneGrezza };

/** I fatti che servono per valutare una condizione. */
export interface ContestoCondizioni {
  flag(nome: string): ValoreFlag | undefined;
  ora(): number;
  giorno(): number;
  notte(): boolean;
  luogoRaggiunto(id: string): boolean;
  /** `stato` è uno degli stati di cella (rilevata, vista, …). */
  cella(id: string, stato: string): boolean;
  dialogo(id: string, stato: StatoDialogoCondizione): boolean;
  missione(id: string, stato: StatoMissioneCondizione): boolean;
  /** `missione` manca quando il contenuto cita il passo con il solo id. */
  passo(missione: string | undefined, passo: string, stato: StatoPassoCondizione): boolean;
  quantitaOggetto(id: string): number;
  taccuino(id: string, stato: StatoTaccuinoCondizione): boolean;
  /** Prefissi aggiuntivi registrati nelle opzioni del parser. */
  predicato?(prefisso: string, argomento: string, qualificatore?: string): boolean;
}

export class ErroreCondizione extends Error {
  constructor(
    readonly motivo: string,
    readonly testo: string,
    readonly posizione?: number,
  ) {
    super(`Condizione «${testo}»: ${motivo}${posizione !== undefined ? ` (carattere ${posizione + 1})` : ''}`);
    this.name = 'ErroreCondizione';
  }
}

export interface OpzioniParser {
  /** Prefissi in più (per esempio "fada") valutati con `ContestoCondizioni.predicato`. */
  prefissiExtra?: readonly string[];
  /** Stati di cella ammessi oltre a quelli predefiniti. */
  statiCellaExtra?: readonly string[];
}

// ---------------------------------------------------------------------------
// Lessico

interface Token {
  t: 'parola' | '(' | ')' | '!';
  v: string;
  pos: number;
}

const PAROLE_RISERVATE = new Set(['e', 'o', 'non', 'vero', 'falso', 'sempre', 'mai', 'inizio', 'notte', 'giorno', 'dì']);

/** Normalizza spazi superflui fuori dalle virgolette («ora: >= 20» → «ora:>=20»). */
function normalizza(testo: string): string {
  const pezzi = testo.split(/("[^"]*"|«[^»]*»)/);
  return pezzi
    .map((p, i) => {
      if (i % 2 === 1) return p; // tra virgolette: intatto
      return p
        .replace(/&&/g, ' e ')
        .replace(/\|\|/g, ' o ')
        .replace(/([\p{L}_]+):\s+/gu, '$1:')
        .replace(/(\d)\s+-\s*(\d)|(\d)\s*-\s+(\d)/g, (_m, a, b, c, d) => `${a ?? c}-${b ?? d}`)
        .replace(/\s*(>=|<=|!=|==|=|>|<)\s*/g, '$1');
    })
    .join('');
}

function tokenizza(testo: string): Token[] {
  const s = normalizza(testo);
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      out.push({ t: c, v: c, pos: i });
      i++;
      continue;
    }
    if (c === ',' || c === ';') {
      out.push({ t: 'parola', v: 'e', pos: i });
      i++;
      continue;
    }
    if (c === '!' && s[i + 1] !== '=') {
      out.push({ t: '!', v: '!', pos: i });
      i++;
      continue;
    }
    const inizio = i;
    let buf = '';
    while (i < s.length) {
      const d = s[i]!;
      if (/\s/.test(d) || d === '(' || d === ')' || d === ',' || d === ';') break;
      if (d === '"' || d === '«') {
        const chiusura = d === '"' ? '"' : '»';
        const fine = s.indexOf(chiusura, i + 1);
        if (fine < 0) throw new ErroreCondizione('virgolette non chiuse', testo, i);
        buf += s.slice(i, fine + 1);
        i = fine + 1;
        continue;
      }
      buf += d;
      i++;
    }
    out.push({ t: 'parola', v: buf, pos: inizio });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Valori e confronti

function togliVirgolette(s: string): string | null {
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('«') && s.endsWith('»')))) {
    return s.slice(1, -1);
  }
  return null;
}

/** Converte il testo di un valore di flag: numeri, vero/falso, stringhe (anche tra virgolette). */
export function analizzaValore(s: string): ValoreFlag {
  const q = togliVirgolette(s);
  if (q !== null) return q;
  const low = s.toLowerCase();
  if (low === 'vero' || low === 'true' || low === 'sì' || low === 'si') return true;
  if (low === 'falso' || low === 'false' || low === 'no') return false;
  if (/^-?\d+(?:[.,]\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  return s;
}

/** Ore come «20», «6.5», «6,5», «6:30». */
function analizzaOra(s: string): number | null {
  const m = /^(\d{1,2}(?:[.,]\d+)?)(?::(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]!.replace(',', '.')) + (m[2] ? Number(m[2]) / 60 : 0);
  return h >= 0 && h <= 24 ? h : null;
}

function analizzaConfronto(arg: string, quale: 'ora' | 'giorno', testo: string, pos: number): Confronto {
  const leggi = (x: string): number | null => {
    if (quale === 'ora') return analizzaOra(x);
    return /^\d+$/.test(x) ? Number(x) : null;
  };
  const mOp = /^(>=|<=|!=|==|=|>|<)(.+)$/.exec(arg);
  if (mOp) {
    const v = leggi(mOp[2]!);
    if (v === null) throw new ErroreCondizione(`valore di ${quale} non valido: «${mOp[2]}»`, testo, pos);
    const op = (mOp[1] === '==' ? '=' : mOp[1]) as Operatore;
    return { tipo: 'op', op, valore: v };
  }
  const mInt = /^([^-]+)-([^-]+)$/.exec(arg);
  if (mInt) {
    const da = leggi(mInt[1]!);
    const a = leggi(mInt[2]!);
    if (da === null || a === null) throw new ErroreCondizione(`intervallo di ${quale} non valido: «${arg}»`, testo, pos);
    if (quale === 'giorno' && da > a) throw new ErroreCondizione(`intervallo di giorni rovesciato: «${arg}»`, testo, pos);
    return { tipo: 'intervallo', da, a };
  }
  const v = leggi(arg);
  if (v === null) throw new ErroreCondizione(`valore di ${quale} non valido: «${arg}»`, testo, pos);
  if (quale === 'ora') return { tipo: 'intervallo', da: v, a: v + 1 };
  return { tipo: 'op', op: '=', valore: v };
}

function confrontaNumeri(a: number, op: Operatore, b: number): boolean {
  switch (op) {
    case '=':
      return a === b;
    case '!=':
      return a !== b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
  }
}

function valutaConfronto(x: number, c: Confronto, quale: 'ora' | 'giorno'): boolean {
  if (c.tipo === 'op') return confrontaNumeri(x, c.op, c.valore);
  if (quale === 'giorno') return x >= c.da && x <= c.a;
  if (c.da <= c.a) return x >= c.da && x < c.a;
  return x >= c.da || x < c.a; // scavalca la mezzanotte
}

/**
 * Confronto di un flag con un valore. Un flag assente vale false, 0 o ""
 * secondo il tipo del valore atteso.
 */
export function confrontaFlag(v: ValoreFlag | undefined, op: Operatore, atteso: ValoreFlag): boolean {
  if (typeof atteso === 'number') {
    let n: number;
    if (typeof v === 'number') n = v;
    else if (v === undefined || v === false) n = 0;
    else if (v === true) n = 1;
    else n = /^-?\d+(?:\.\d+)?$/.test(v) ? Number(v) : NaN;
    if (Number.isNaN(n)) return op === '!=';
    return confrontaNumeri(n, op, atteso);
  }
  if (typeof atteso === 'boolean') {
    const b = valoreVero(v);
    return op === '!=' ? b !== atteso : b === atteso;
  }
  const s = v === undefined ? '' : String(v);
  return op === '!=' ? s !== atteso : s === atteso;
}

// ---------------------------------------------------------------------------
// Qualificatori

const Q_LUOGO: Record<string, true> = { raggiunto: true, raggiunta: true, visitato: true, visitata: true };
const Q_DIALOGO: Record<string, StatoDialogoCondizione> = {
  finito: 'finito',
  finita: 'finito',
  concluso: 'finito',
  terminato: 'finito',
  iniziato: 'iniziato',
  avviato: 'iniziato',
};
const Q_MISSIONE: Record<string, StatoMissioneCondizione> = {
  completata: 'completata',
  completa: 'completata',
  conclusa: 'completata',
  finita: 'completata',
  attiva: 'attiva',
  in_corso: 'attiva',
  'in-corso': 'attiva',
  avviata: 'avviata',
  iniziata: 'avviata',
  inattiva: 'inattiva',
  non_avviata: 'inattiva',
};
const Q_PASSO: Record<string, StatoPassoCondizione> = {
  completato: 'completato',
  completata: 'completato',
  concluso: 'completato',
  attivo: 'attivo',
  attiva: 'attivo',
};
const Q_TACCUINO: Record<string, StatoTaccuinoCondizione> = {
  presente: 'presente',
  scritta: 'presente',
  scritto: 'presente',
  aggiunta: 'presente',
  aggiunto: 'presente',
  aperta: 'aperta',
  aperto: 'aperta',
  chiusa: 'chiusa',
  chiuso: 'chiusa',
  risolta: 'chiusa',
  barrata: 'barrata',
  barrato: 'barrata',
};
const Q_CELLA: Record<string, string> = {
  // stati della Pianta (fade_fase1.json li chiama bianco, matita, colore)
  rilevata: 'rilevata',
  rilevato: 'rilevata',
  colore: 'rilevata',
  vista: 'vista',
  visto: 'vista',
  matita: 'vista',
  bianca: 'bianca',
  bianco: 'bianca',
  mai_vista: 'bianca',
  // varianti degli elementi mobili
  carta: 'carta',
  abitata: 'abitata',
  mietuta: 'mietuta',
  scritta: 'scritta',
  smontata: 'smontata',
};

const RE_ID = /^[\p{L}\p{N}_.\-/']+$/u;
/** I nomi dei flag possono contenere anche «:» («flag:lente:corteccia»). */
const RE_FLAG = /^[\p{L}\p{N}_.\-/':]+$/u;

// ---------------------------------------------------------------------------
// Parser

class Parser {
  private i = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly testo: string,
    private readonly opzioni: OpzioniParser,
  ) {}

  analizza(): NodoCondizione {
    if (this.tokens.length === 0) return { tipo: 'costante', valore: true };
    const n = this.espressione();
    const t = this.tokens[this.i];
    if (t) {
      if (t.t === ')') this.errore('parentesi chiusa senza apertura', t.pos);
      this.errore(`atteso «e» oppure «o» prima di «${t.v}»`, t.pos);
    }
    return n;
  }

  private errore(motivo: string, pos?: number): never {
    throw new ErroreCondizione(motivo, this.testo, pos);
  }

  private guarda(): Token | undefined {
    return this.tokens[this.i];
  }

  private parolaChiave(t: Token | undefined, ...parole: string[]): boolean {
    return !!t && t.t === 'parola' && parole.includes(t.v.toLowerCase());
  }

  private espressione(): NodoCondizione {
    const figli = [this.congiunzione()];
    while (this.parolaChiave(this.guarda(), 'o')) {
      this.i++;
      figli.push(this.congiunzione());
    }
    return figli.length === 1 ? figli[0]! : { tipo: 'o', figli };
  }

  private congiunzione(): NodoCondizione {
    const figli = [this.unario()];
    while (this.parolaChiave(this.guarda(), 'e')) {
      this.i++;
      figli.push(this.unario());
    }
    return figli.length === 1 ? figli[0]! : { tipo: 'e', figli };
  }

  private unario(): NodoCondizione {
    const t = this.guarda();
    if (t && (t.t === '!' || this.parolaChiave(t, 'non'))) {
      this.i++;
      return { tipo: 'non', figlio: this.unario() };
    }
    return this.primario();
  }

  private primario(): NodoCondizione {
    const t = this.guarda();
    if (!t) this.errore('condizione incompleta', this.testo.length);
    if (t.t === '(') {
      this.i++;
      const n = this.espressione();
      const c = this.guarda();
      if (!c || c.t !== ')') this.errore('parentesi aperta e mai chiusa', t.pos);
      this.i++;
      return n;
    }
    if (t.t === ')') this.errore('parentesi chiusa inattesa', t.pos);
    if (this.parolaChiave(t, 'e', 'o')) this.errore(`operatore «${t.v}» senza condizione prima`, t.pos);
    return this.atomo();
  }

  /** Legge un eventuale qualificatore (parola semplice dopo un atomo con prefisso). */
  private qualificatore(): Token | undefined {
    const t = this.guarda();
    if (!t || t.t !== 'parola') return undefined;
    if (t.v.includes(':') || PAROLE_RISERVATE.has(t.v.toLowerCase())) return undefined;
    this.i++;
    return t;
  }

  private atomo(): NodoCondizione {
    const t = this.tokens[this.i++]!;
    const w = t.v;
    const low = w.toLowerCase();
    const due = w.indexOf(':');
    if (due < 0) {
      switch (low) {
        case 'vero':
        case 'sempre':
        case 'inizio':
          return { tipo: 'costante', valore: true };
        case 'falso':
        case 'mai':
          return { tipo: 'costante', valore: false };
        case 'notte':
          return { tipo: 'atomo', atomo: { k: 'notte' } };
        case 'giorno':
        case 'dì':
          return { tipo: 'atomo', atomo: { k: 'di' } };
        case 'non':
          return this.errore('«non» senza condizione dopo', t.pos);
        default:
          return this.errore(`termine sconosciuto «${w}» (manca il prefisso, per esempio «flag:»?)`, t.pos);
      }
    }
    const prefisso = w.slice(0, due).toLowerCase();
    const arg = w.slice(due + 1);
    if (!arg) this.errore(`manca l'argomento dopo «${prefisso}:»`, t.pos);
    const q = this.qualificatore();
    const qv = q?.v.toLowerCase();
    const nessunQualificatore = (): void => {
      if (q) this.errore(`«${prefisso}:» non accetta il qualificatore «${q.v}»`, q.pos);
    };
    const id = (s: string, re: RegExp = RE_ID): string => {
      if (!re.test(s)) this.errore(`identificatore non valido «${s}»`, t.pos);
      return s;
    };
    const conQualificatore = <T>(tabella: Record<string, T>, predefinito: T, nome: string): T => {
      if (!q) return predefinito;
      const v = tabella[qv!];
      if (v === undefined) {
        this.errore(`qualificatore «${q.v}» non valido per ${nome} (ammessi: ${Object.keys(tabella).join(', ')})`, q.pos);
      }
      return v;
    };
    const atomo = (a: Atomo): NodoCondizione => ({ tipo: 'atomo', atomo: a });

    switch (prefisso) {
      case 'flag':
      case 'contatore': {
        nessunQualificatore();
        const m = /^([^=!<>]+?)(==|!=|>=|<=|=|>|<)(.*)$/.exec(arg);
        if (!m) return atomo({ k: 'flag', nome: id(arg, RE_FLAG) });
        const nome = id(m[1]!, RE_FLAG);
        if (m[3] === '') this.errore(`manca il valore dopo «${m[2]}»`, t.pos);
        const op = (m[2] === '==' ? '=' : m[2]) as Operatore;
        const valore = analizzaValore(m[3]!);
        if (op !== '=' && op !== '!=' && typeof valore !== 'number') {
          this.errore(`il confronto «${op}» vuole un numero, non «${m[3]}»`, t.pos);
        }
        return atomo({ k: 'flag', nome, op, valore });
      }
      case 'luogo': {
        if (q && !Q_LUOGO[qv!]) this.errore(`qualificatore «${q.v}» non valido per un luogo (usa «raggiunto»)`, q.pos);
        return atomo({ k: 'luogo', id: id(arg) });
      }
      case 'ora':
        nessunQualificatore();
        return atomo({ k: 'ora', confronto: analizzaConfronto(arg, 'ora', this.testo, t.pos) });
      case 'giorno':
        nessunQualificatore();
        return atomo({ k: 'giorno', confronto: analizzaConfronto(arg, 'giorno', this.testo, t.pos) });
      case 'variante': {
        nessunQualificatore();
        const m = /^([^=]+)=(.+)$/.exec(arg);
        if (!m) this.errore(`la variante va scritta «variante:elemento=Variante», non «${arg}»`, t.pos);
        return atomo({ k: 'cella', id: id(m[1]!), stato: id(m[2]!).toLowerCase() });
      }
      case 'cella':
      case 'particella': {
        let stato = 'rilevata';
        if (q) {
          const noto = Q_CELLA[qv!] ?? (this.opzioni.statiCellaExtra?.includes(qv!) ? qv! : undefined);
          if (!noto) this.errore(`stato di cella «${q.v}» sconosciuto (ammessi: ${Object.keys(Q_CELLA).join(', ')})`, q.pos);
          stato = noto;
        }
        return atomo({ k: 'cella', id: id(arg), stato });
      }
      case 'dialogo':
        return atomo({ k: 'dialogo', id: id(arg), stato: conQualificatore(Q_DIALOGO, 'finito', 'un dialogo') });
      case 'missione':
        return atomo({ k: 'missione', id: id(arg), stato: conQualificatore(Q_MISSIONE, 'completata', 'una missione') });
      case 'passo': {
        const stato = conQualificatore(Q_PASSO, 'completato', 'un passo');
        const sep = arg.includes('/') ? '/' : arg.includes('.') ? '.' : null;
        if (sep === null) return atomo({ k: 'passo', passo: id(arg), stato });
        const k = arg.indexOf(sep);
        if (k <= 0 || k === arg.length - 1) this.errore(`il passo va scritto «id» o «missione/passo», non «${arg}»`, t.pos);
        return atomo({ k: 'passo', missione: id(arg.slice(0, k)), passo: id(arg.slice(k + 1)), stato });
      }
      case 'oggetto': {
        if (q && qv !== 'posseduto' && qv !== 'presente') {
          this.errore(`qualificatore «${q.v}» non valido per un oggetto`, q.pos);
        }
        const m = /^([^=!<>]+?)(==|!=|>=|<=|=|>|<)(.*)$/.exec(arg);
        if (!m) return atomo({ k: 'oggetto', id: id(arg), op: '>=', quantita: 1 });
        if (!/^\d+$/.test(m[3]!)) this.errore(`quantità non valida «${m[3]}»`, t.pos);
        const op = (m[2] === '==' ? '=' : m[2]) as Operatore;
        return atomo({ k: 'oggetto', id: id(m[1]!), op, quantita: Number(m[3]) });
      }
      case 'taccuino':
      case 'voce':
      case 'domanda':
        return atomo({ k: 'taccuino', id: id(arg), stato: conQualificatore(Q_TACCUINO, 'presente', 'una voce del taccuino') });
      default:
        if (this.opzioni.prefissiExtra?.some((p) => p.toLowerCase() === prefisso)) {
          return atomo({ k: 'extra', prefisso, argomento: arg, ...(q ? { qualificatore: q.v } : {}) });
        }
        return this.errore(`prefisso sconosciuto «${prefisso}:»`, t.pos);
    }
  }
}

// ---------------------------------------------------------------------------
// API

/**
 * Parser con cache: la stessa stringa viene analizzata una volta sola.
 */
export class ParserCondizioni {
  private readonly cache = new Map<string, NodoCondizione>();

  constructor(readonly opzioni: OpzioniParser = {}) {}

  /** Analizza una stringa. Lancia `ErroreCondizione` se è malformata. */
  analizza(testo: string): NodoCondizione {
    const chiave = testo.trim();
    const c = this.cache.get(chiave);
    if (c) return c;
    const n = new Parser(tokenizza(chiave), chiave, this.opzioni).analizza();
    this.cache.set(chiave, n);
    return n;
  }

  /** Compila una condizione grezza (stringa, lista, oggetto e/o, booleano). */
  compila(c: CondizioneGrezza): NodoCondizione {
    if (c === null || c === undefined) return { tipo: 'costante', valore: true };
    if (typeof c === 'boolean') return { tipo: 'costante', valore: c };
    if (typeof c === 'string') return this.analizza(c);
    if (Array.isArray(c)) {
      const figli = (c as readonly CondizioneGrezza[]).map((x) => this.compila(x));
      if (figli.length === 0) return { tipo: 'costante', valore: true };
      return figli.length === 1 ? figli[0]! : { tipo: 'e', figli };
    }
    if (typeof c === 'object') {
      const o = c as { readonly [k: string]: CondizioneGrezza };
      const chiavi = Object.keys(o);
      if (chiavi.length !== 1) {
        throw new ErroreCondizione('un oggetto condizione deve avere una sola chiave (e, o, non)', JSON.stringify(c));
      }
      const k = chiavi[0]!;
      const v = o[k];
      const lista = (): NodoCondizione[] => {
        if (!Array.isArray(v)) throw new ErroreCondizione(`«${k}» vuole una lista`, JSON.stringify(c));
        return (v as readonly CondizioneGrezza[]).map((x) => this.compila(x));
      };
      switch (k.toLowerCase()) {
        case 'e':
        case 'tutte':
        case 'tutti':
          return { tipo: 'e', figli: lista() };
        case 'o':
        case 'una':
        case 'almeno_una':
        case 'qualsiasi':
          return { tipo: 'o', figli: lista() };
        case 'non':
          return { tipo: 'non', figlio: this.compila(v) };
        default:
          throw new ErroreCondizione(`chiave sconosciuta «${k}»`, JSON.stringify(c));
      }
    }
    throw new ErroreCondizione('forma non riconosciuta', String(c));
  }

  /** Compila e valuta. */
  valuta(c: CondizioneGrezza, ctx: ContestoCondizioni): boolean {
    return valutaNodo(this.compila(c), ctx);
  }

  /** Restituisce gli errori di sintassi (lista vuota se la condizione è corretta). */
  errori(c: CondizioneGrezza): string[] {
    try {
      this.compila(c);
      return [];
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  }
}

export function valutaNodo(n: NodoCondizione, ctx: ContestoCondizioni): boolean {
  switch (n.tipo) {
    case 'costante':
      return n.valore;
    case 'e':
      return n.figli.every((f) => valutaNodo(f, ctx));
    case 'o':
      return n.figli.some((f) => valutaNodo(f, ctx));
    case 'non':
      return !valutaNodo(n.figlio, ctx);
    case 'atomo':
      return valutaAtomo(n.atomo, ctx);
  }
}

export function valutaAtomo(a: Atomo, ctx: ContestoCondizioni): boolean {
  switch (a.k) {
    case 'flag': {
      const v = ctx.flag(a.nome);
      if (!a.op) return valoreVero(v);
      return confrontaFlag(v, a.op, a.valore!);
    }
    case 'luogo':
      return ctx.luogoRaggiunto(a.id);
    case 'ora':
      return valutaConfronto(ctx.ora(), a.confronto, 'ora');
    case 'giorno':
      return valutaConfronto(ctx.giorno(), a.confronto, 'giorno');
    case 'notte':
      return ctx.notte();
    case 'di':
      return !ctx.notte();
    case 'cella':
      return ctx.cella(a.id, a.stato);
    case 'dialogo':
      return ctx.dialogo(a.id, a.stato);
    case 'missione':
      return ctx.missione(a.id, a.stato);
    case 'passo':
      return ctx.passo(a.missione, a.passo, a.stato);
    case 'oggetto':
      return confrontaNumeri(ctx.quantitaOggetto(a.id), a.op, a.quantita);
    case 'taccuino':
      return ctx.taccuino(a.id, a.stato);
    case 'extra':
      return ctx.predicato ? ctx.predicato(a.prefisso, a.argomento, a.qualificatore) : false;
  }
}

/** Tutti gli atomi di un albero (in ordine di lettura). */
export function atomiDi(n: NodoCondizione): Atomo[] {
  switch (n.tipo) {
    case 'costante':
      return [];
    case 'e':
    case 'o':
      return n.figli.flatMap(atomiDi);
    case 'non':
      return atomiDi(n.figlio);
    case 'atomo':
      return [n.atomo];
  }
}

function stampaConfronto(c: Confronto, quale: 'ora' | 'giorno'): string {
  if (c.tipo === 'op') return `${c.op === '=' && quale === 'giorno' ? '' : c.op}${c.valore}`;
  return `${c.da}-${c.a}`;
}

/** Riscrive un atomo in forma canonica. */
export function stampaAtomo(a: Atomo): string {
  switch (a.k) {
    case 'flag':
      return a.op ? `flag:${a.nome}${a.op}${typeof a.valore === 'boolean' ? (a.valore ? 'vero' : 'falso') : a.valore}` : `flag:${a.nome}`;
    case 'luogo':
      return `luogo:${a.id} raggiunto`;
    case 'ora':
      return `ora:${stampaConfronto(a.confronto, 'ora')}`;
    case 'giorno':
      return `giorno:${stampaConfronto(a.confronto, 'giorno')}`;
    case 'notte':
      return 'notte';
    case 'di':
      return 'giorno';
    case 'cella':
      return `cella:${a.id} ${a.stato}`;
    case 'dialogo':
      return `dialogo:${a.id} ${a.stato}`;
    case 'missione':
      return `missione:${a.id} ${a.stato}`;
    case 'passo':
      return `passo:${a.missione !== undefined ? a.missione + '/' : ''}${a.passo} ${a.stato}`;
    case 'oggetto':
      return a.op === '>=' && a.quantita === 1 ? `oggetto:${a.id}` : `oggetto:${a.id}${a.op}${a.quantita}`;
    case 'taccuino':
      return `taccuino:${a.id} ${a.stato}`;
    case 'extra':
      return `${a.prefisso}:${a.argomento}${a.qualificatore ? ' ' + a.qualificatore : ''}`;
  }
}

/** Riscrive un albero in forma canonica, con parentesi dove servono. */
export function stampaCondizione(n: NodoCondizione): string {
  switch (n.tipo) {
    case 'costante':
      return n.valore ? 'vero' : 'falso';
    case 'atomo':
      return stampaAtomo(n.atomo);
    case 'non': {
      const f = stampaCondizione(n.figlio);
      return n.figlio.tipo === 'atomo' || n.figlio.tipo === 'costante' || n.figlio.tipo === 'non' ? `!${f}` : `!(${f})`;
    }
    case 'e':
      return n.figli.map((f) => (f.tipo === 'o' ? `(${stampaCondizione(f)})` : stampaCondizione(f))).join(' e ');
    case 'o':
      return n.figli.map((f) => stampaCondizione(f)).join(' o ');
  }
}

/** Parser predefinito, senza prefissi aggiuntivi. */
export const parserPredefinito = new ParserCondizioni();

export function analizzaCondizione(testo: string): NodoCondizione {
  return parserPredefinito.analizza(testo);
}

export function compilaCondizione(c: CondizioneGrezza): NodoCondizione {
  return parserPredefinito.compila(c);
}

export function valutaCondizione(c: CondizioneGrezza, ctx: ContestoCondizioni): boolean {
  return parserPredefinito.valuta(c, ctx);
}
