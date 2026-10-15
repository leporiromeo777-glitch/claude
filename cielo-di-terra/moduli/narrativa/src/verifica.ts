/**
 * Verifica dei contenuti narrativi (senza file system: i JSON arrivano già
 * letti). Controlla:
 *  - che ogni condizione si analizzi senza errori;
 *  - che ogni effetto abbia una forma nota;
 *  - che ogni `vai_a` punti a un nodo esistente (e che ogni nodo sia raggiungibile);
 *  - che gli id citati (luoghi, dialoghi, missioni, passi, voci del taccuino,
 *    personaggi) esistano, e che ogni flag letto sia impostato da qualche effetto;
 *  - che tutte le missioni siano completabili in una partita simulata con
 *    fatti finti, nell'ordine del file (dal prologo in avanti).
 *
 * Il simulatore è un piccolo pianificatore: per ogni passo attivo cerca di
 * rendere vera la condizione di completamento facendo ciò che farebbe un
 * giocatore (raggiungere luoghi, rilevare celle, aspettare l'ora giusta,
 * giocare i dialoghi scegliendo le risposte che portano all'obiettivo).
 */
import {
  ParserCondizioni,
  atomiDi,
  stampaAtomo,
  stampaCondizione,
  valutaNodo,
  type Atomo,
  type CondizioneGrezza,
  type NodoCondizione,
  type OpzioniParser,
} from './condizioni';
import { normalizzaContenuti, type ContenutiNormalizzati, type DialogoDef } from './contenuti';
import { analizzaEffetto, stampaEffetto, type Effetto } from './effetti';
import { NOTTE_PREDEFINITA, Narrativa, type StatoNarrativo, type WorldFacts } from './narrativa';

export interface ContenutiVerifica {
  missioni?: unknown;
  dialoghi?: unknown;
  taccuino?: unknown;
  /** content/luoghi.json (facoltativo: serve a controllare gli id dei luoghi). */
  luoghi?: unknown;
  /** content/personaggi.json (facoltativo). */
  personaggi?: unknown;
  /** Id di celle/particelle conosciute (facoltativo). */
  celle?: readonly string[];
}

export interface OpzioniVerifica {
  parser?: OpzioniParser;
  missioniIniziali?: string[];
  /** Numero massimo di azioni della simulazione (predefinito 400). */
  maxAzioni?: number;
}

export interface EsitoMissione {
  missione: string;
  titolo: string;
  esito: 'completata' | 'bloccata' | 'mai avviata';
  /** Passo su cui si è fermata e perché. */
  motivo?: string;
}

export interface RapportoVerifica {
  /** Problemi certi: la partita si rompe. */
  errori: string[];
  /** Problemi probabili: id sconosciuti, flag mai impostati, nodi irraggiungibili… */
  avvisi: string[];
  /** Esito della partita simulata, missione per missione. */
  simulazione: EsitoMissione[];
  /** Diario della partita simulata. */
  traccia: string[];
  /** Ipotesi fatte dal simulatore (flag o oggetti che nessun contenuto dà). */
  ipotesi: string[];
  conteggi: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Utilità

type Oggetto = Record<string, unknown>;

function idDa(x: unknown): Set<string> {
  const out = new Set<string>();
  if (Array.isArray(x)) {
    for (const v of x) if (v && typeof v === 'object' && typeof (v as Oggetto).id === 'string') out.add((v as Oggetto).id as string);
  } else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x as Oggetto)) {
      if (Array.isArray(v) && ['luoghi', 'personaggi', 'voci', 'elenco'].includes(k)) for (const id of idDa(v)) out.add(id);
      else if (v && typeof v === 'object' && !Array.isArray(v) && !k.startsWith('$') && !k.startsWith('_')) {
        out.add(typeof (v as Oggetto).id === 'string' ? ((v as Oggetto).id as string) : k);
      }
    }
  }
  return out;
}

/** Dove compare un effetto. */
type Sorgente =
  | { tipo: 'risposta'; dialogo: string; nodo: string; indice: number }
  | { tipo: 'nodo'; dialogo: string; nodo: string }
  | { tipo: 'passo'; missione: string; passo: string }
  | { tipo: 'missione'; missione: string };

function descriviSorgente(s: Sorgente): string {
  switch (s.tipo) {
    case 'risposta':
      return `dialogo ${s.dialogo}, nodo ${s.nodo}, risposta ${s.indice + 1}`;
    case 'nodo':
      return `dialogo ${s.dialogo}, nodo ${s.nodo}`;
    case 'passo':
      return `missione ${s.missione}, passo ${s.passo}`;
    case 'missione':
      return `missione ${s.missione}`;
  }
}

/** Chiave «che cosa produce» di un effetto, per l'indice delle sorgenti. */
function chiaveEffetto(e: Effetto): string | null {
  switch (e.tipo) {
    case 'flag':
    case 'flag-somma':
      return `flag:${e.nome}`;
    case 'taccuino':
      return e.azione === 'rimuovi' || e.azione === 'riapri' ? null : `taccuino:${e.id}`;
    case 'oggetto':
      return e.delta > 0 ? `oggetto:${e.id}` : null;
    case 'missione':
      return `missione:${e.id}:${e.azione}`;
    case 'dialogo':
      return `dialogo:${e.id}`;
    default:
      return null;
  }
}

/** Ogni condizione dei contenuti con la sua origine. */
function* condizioniDi(c: ContenutiNormalizzati): Generator<[CondizioneGrezza, string]> {
  for (const m of c.missioni) {
    if (m.avviaQuando !== undefined) yield [m.avviaQuando, `missione ${m.id} (avvio)`];
    for (const p of m.passi) {
      if (p.attivaQuando !== undefined) yield [p.attivaQuando, `missione ${m.id}, passo ${p.id} (attivazione)`];
      if (p.completaQuando !== undefined) yield [p.completaQuando, `missione ${m.id}, passo ${p.id} (completamento)`];
    }
  }
  for (const d of Object.values(c.dialoghi)) {
    if (d.condizione !== undefined) yield [d.condizione, `dialogo ${d.id}`];
    for (const n of d.nodi) {
      for (let i = 0; i < n.risposte.length; i++) {
        const r = n.risposte[i]!;
        if (r.condizione !== undefined) yield [r.condizione, `dialogo ${d.id}, nodo ${n.id}, risposta ${i + 1}`];
      }
    }
  }
  for (const v of c.taccuino) {
    if (v.sbloccaQuando !== undefined) yield [v.sbloccaQuando, `taccuino ${v.id} (sblocco)`];
    if (v.chiudiQuando !== undefined) yield [v.chiudiQuando, `taccuino ${v.id} (chiusura)`];
  }
}

/** Ogni lista di effetti dei contenuti con la sua sorgente. */
function* effettiDi(c: ContenutiNormalizzati): Generator<[string, Sorgente]> {
  for (const m of c.missioni) {
    for (const p of m.passi) {
      for (const e of p.effettiAttivazione) yield [e, { tipo: 'passo', missione: m.id, passo: p.id }];
      for (const e of p.effetti) yield [e, { tipo: 'passo', missione: m.id, passo: p.id }];
    }
    for (const e of m.effetti) yield [e, { tipo: 'missione', missione: m.id }];
  }
  for (const d of Object.values(c.dialoghi)) {
    for (const n of d.nodi) {
      for (const e of n.effetti) yield [e, { tipo: 'nodo', dialogo: d.id, nodo: n.id }];
      for (let i = 0; i < n.risposte.length; i++) {
        for (const e of n.risposte[i]!.effetti) yield [e, { tipo: 'risposta', dialogo: d.id, nodo: n.id, indice: i }];
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Fatti simulati

class FattiSimulati implements WorldFacts {
  oraCorrente = 7;
  giornoCorrente = 1;
  luoghi = new Set<string>();
  rilevate = new Set<string>();
  viste = new Set<string>();
  varianti = new Map<string, string>();
  oggetti = new Map<string, number>();
  extra = new Set<string>();

  ora(): number {
    return this.oraCorrente;
  }
  giorno(): number {
    return this.giornoCorrente;
  }
  notte(): boolean {
    return this.oraCorrente >= NOTTE_PREDEFINITA.inizio || this.oraCorrente < NOTTE_PREDEFINITA.fine;
  }
  luogoRaggiunto(id: string): boolean {
    return this.luoghi.has(id);
  }
  cellaRilevata(id: string): boolean {
    return this.rilevate.has(id);
  }
  cellaVista(id: string): boolean {
    return this.viste.has(id);
  }
  varianteParticella(id: string): string | undefined {
    return this.varianti.get(id);
  }
  quantitaOggetto(id: string): number {
    return this.oggetti.get(id) ?? 0;
  }
  predicato(p: string, a: string, q?: string): boolean {
    return this.extra.has(`${p}:${a}${q ? ' ' + q : ''}`);
  }

  /** Aspetta (solo in avanti) fino all'ora `h`. */
  aspettaFino(h: number): void {
    if (h < this.oraCorrente) this.giornoCorrente++;
    this.oraCorrente = h;
  }

  avanza(ore: number): void {
    let h = this.oraCorrente + ore;
    while (h >= 24) {
      h -= 24;
      this.giornoCorrente++;
    }
    this.oraCorrente = h;
  }

  copia(): FattiSimulati {
    const f = new FattiSimulati();
    f.oraCorrente = this.oraCorrente;
    f.giornoCorrente = this.giornoCorrente;
    f.luoghi = new Set(this.luoghi);
    f.rilevate = new Set(this.rilevate);
    f.viste = new Set(this.viste);
    f.varianti = new Map(this.varianti);
    f.oggetti = new Map(this.oggetti);
    f.extra = new Set(this.extra);
    return f;
  }

  ripristina(f: FattiSimulati): void {
    Object.assign(this, f.copia());
  }
}

// ---------------------------------------------------------------------------
// Simulatore

interface Istantanea {
  n: StatoNarrativo;
  f: FattiSimulati;
  traccia: number;
  ipotesi: number;
  daAprire: string[];
}

class Simulatore {
  readonly fatti = new FattiSimulati();
  readonly n: Narrativa;
  readonly traccia: string[] = [];
  readonly ipotesi: string[] = [];
  private readonly sorgenti = new Map<string, Sorgente[]>();
  private esplorando = 0;
  /** La condizione che il simulatore sta cercando di rendere vera (guida la scelta delle risposte). */
  private radice: NodoCondizione | undefined;
  /** Flag letti da qualche condizione: impostarli «serve» alla storia. */
  private readonly flagLetti = new Set<string>();
  private readonly daAprire: string[] = [];
  private azioni = 0;

  constructor(
    private readonly c: ContenutiNormalizzati,
    private readonly parser: ParserCondizioni,
    opzioni: OpzioniVerifica,
    private readonly maxAzioni: number,
  ) {
    this.n = new Narrativa(c, this.fatti, {
      ...(opzioni.parser ? { parser: opzioni.parser } : {}),
      ...(opzioni.missioniIniziali ? { missioniIniziali: opzioni.missioniIniziali } : {}),
    });
    for (const [s, sorgente] of effettiDi(c)) {
      try {
        const k = chiaveEffetto(analizzaEffetto(s));
        if (k) this.sorgenti.set(k, [...(this.sorgenti.get(k) ?? []), sorgente]);
      } catch {
        // già segnalato
      }
    }
    for (const [cond] of condizioniDi(c)) {
      try {
        for (const a of atomiDi(this.parser.compila(cond))) if (a.k === 'flag') this.flagLetti.add(a.nome);
      } catch {
        // già segnalato
      }
    }
    this.n.eventi.on('tempo', ({ azione, ore }) => {
      if (azione === 'salta-a') this.fatti.aspettaFino(ore);
      else this.fatti.avanza(ore);
      if (!this.esplorando) this.log(`  (il tempo ${azione === 'salta-a' ? 'salta alle' : 'avanza di'} ${ore}: giorno ${this.fatti.giornoCorrente}, ore ${this.fatti.oraCorrente})`);
    });
    this.n.eventi.on('apriDialogo', ({ dialogo }) => {
      if (!this.esplorando) this.daAprire.push(dialogo);
    });
    this.n.eventi.on('passoCompletato', ({ missione, passo }) => {
      if (!this.esplorando) this.log(`✓ ${missione}/${passo}`);
    });
    this.n.eventi.on('missioneAvviata', ({ missione, titolo }) => {
      if (!this.esplorando) this.log(`▶ missione ${missione} «${titolo}»`);
    });
    this.n.eventi.on('missioneCompletata', ({ missione }) => {
      if (!this.esplorando) this.log(`■ missione ${missione} completata`);
    });
  }

  private log(s: string): void {
    if (!this.esplorando) this.traccia.push(s);
  }

  private istantanea(): Istantanea {
    return {
      n: JSON.parse(JSON.stringify(this.n.esporta())) as StatoNarrativo,
      f: this.fatti.copia(),
      traccia: this.traccia.length,
      ipotesi: this.ipotesi.length,
      daAprire: [...this.daAprire],
    };
  }

  private ripristina(s: Istantanea): void {
    this.n.importa(JSON.parse(JSON.stringify(s.n)) as StatoNarrativo);
    this.fatti.ripristina(s.f);
    this.traccia.length = s.traccia;
    this.ipotesi.length = s.ipotesi;
    this.daAprire.splice(0, this.daAprire.length, ...s.daAprire);
  }

  /** Quanto lo stato corrente si avvicina alla condizione che si sta cercando di rendere vera. */
  private punteggio(): number {
    const r = this.radice;
    if (!r) return 0;
    const punti = (n: NodoCondizione, polarita: boolean): number => {
      switch (n.tipo) {
        case 'costante':
          return 0;
        case 'atomo':
          return this.vero(n) === polarita ? 1 : 0;
        case 'non':
          return punti(n.figlio, !polarita);
        case 'e':
        case 'o':
          return n.figli.reduce((t, f) => t + punti(f, polarita), 0);
      }
    };
    return (this.vero(r) ? 1000 : 0) + punti(r, true);
  }

  /**
   * Quanta storia ha prodotto la partita finora: flag utili, missioni avviate,
   * voci del taccuino, oggetti. A parità di obiettivo il simulatore preferisce
   * i rami più ricchi, come un giocatore curioso, per non perdere per strada
   * ciò che servirà alle missioni seguenti.
   */
  private ricchezza(): number {
    const flag = Object.keys(this.n.flag.tutti()).filter((f) => this.flagLetti.has(f)).length;
    const missioni = this.c.missioni.filter((m) => this.n.missioni.stato(m.id) !== 'inattiva').length;
    return flag + missioni * 3 + this.n.taccuino.voci().length + this.n.inventario.elenco().length;
  }

  private firma(): string {
    return JSON.stringify([this.n.esporta(), this.fatti.oraCorrente, this.fatti.giornoCorrente, [...this.fatti.luoghi], [...this.fatti.rilevate]]);
  }

  /** Partita intera: le missioni nell'ordine del file. */
  gioca(): EsitoMissione[] {
    this.n.tick();
    this.apriInSospeso();
    const esiti: EsitoMissione[] = [];
    for (const m of this.c.missioni) {
      const esito = this.completaMissione(m.id);
      esiti.push({ missione: m.id, titolo: m.titolo, ...esito });
    }
    return esiti;
  }

  private completaMissione(id: string): { esito: EsitoMissione['esito']; motivo?: string } {
    const def = this.c.missioni.find((m) => m.id === id)!;
    if (this.n.missioni.stato(id) === 'inattiva') {
      const motivo = this.avviaMissione(id, 0);
      if (motivo) return { esito: 'mai avviata', motivo };
    }
    for (let giri = 0; this.n.missioni.stato(id) === 'attiva'; giri++) {
      if (this.azioni > this.maxAzioni || giri > 500) return { esito: 'bloccata', motivo: 'troppe azioni (ciclo?)' };
      const prima = this.firma();
      const attivo = def.passi.find((p) => this.n.missioni.statoPasso(id, p.id) === 'attivo');
      let motivo: string | null;
      let dove: string;
      if (attivo) {
        dove = `passo ${attivo.id}`;
        if (attivo.completaQuando === undefined) return { esito: 'bloccata', motivo: `${dove}: manca «completa_quando»` };
        motivo = this.soddisfa(attivo.completaQuando, 0);
      } else {
        const i = def.passi.findIndex((p) => this.n.missioni.statoPasso(id, p.id) === 'bloccato');
        const bloccato = def.passi[i];
        if (!bloccato) {
          this.n.tick();
          continue;
        }
        dove = `passo ${bloccato.id} (attivazione)`;
        if (def.ordine === 'sequenziale' && i > 0 && this.n.missioni.statoPasso(id, def.passi[i - 1]!.id) !== 'completato') {
          return { esito: 'bloccata', motivo: `${dove}: il passo precedente non è completato` };
        }
        motivo = bloccato.attivaQuando === undefined ? null : this.soddisfa(bloccato.attivaQuando, 0);
      }
      this.n.tick();
      this.apriInSospeso();
      if (motivo) return { esito: 'bloccata', motivo: `${dove}: ${motivo}` };
      if (this.firma() === prima) {
        const cond = attivo?.completaQuando;
        return {
          esito: 'bloccata',
          motivo: `${dove}: nessun progresso${cond !== undefined ? ` (condizione «${this.stampa(cond)}» ancora falsa)` : ''}`,
        };
      }
    }
    const stato = this.n.missioni.stato(id);
    return stato === 'completata' ? { esito: 'completata' } : { esito: 'bloccata', motivo: `la missione è ${stato}` };
  }

  private stampa(c: CondizioneGrezza): string {
    try {
      return stampaCondizione(this.parser.compila(c));
    } catch {
      return JSON.stringify(c);
    }
  }

  private apriInSospeso(): void {
    while (this.daAprire.length) {
      const id = this.daAprire.shift()!;
      if (this.n.dialoghi.finito(id) && !this.n.dialoghi.definizione(id)?.ripetibile) continue;
      this.log(`  (il gioco apre il dialogo ${id})`);
      const m = this.giocaDialogo(id, null, 0);
      if (m) this.log(`  ! dialogo ${id}: ${m}`);
    }
  }

  /** Avvia una missione inattiva. Restituisce il motivo del fallimento, o null. */
  private avviaMissione(id: string, prof: number): string | null {
    const def = this.c.missioni.find((m) => m.id === id);
    if (!def) return `missione inesistente «${id}»`;
    if (def.avviaQuando !== undefined) {
      const m = this.soddisfa(def.avviaQuando, prof + 1);
      this.n.tick();
      this.apriInSospeso();
      if (m) return `condizione di avvio: ${m}`;
      if (this.n.missioni.stato(id) === 'inattiva') return `condizione di avvio «${this.stampa(def.avviaQuando)}» ancora falsa`;
      return null;
    }
    const sorgenti = this.sorgenti.get(`missione:${id}:avvia`) ?? [];
    if (sorgenti.length === 0) return 'nessuna condizione di avvio e nessun effetto «missione:' + id + ' avvia»';
    const motivi: string[] = [];
    for (const s of sorgenti) {
      const m = this.attivaSorgente(s, () => this.n.missioni.stato(id) !== 'inattiva', prof + 1);
      if (!m) return null;
      motivi.push(`${descriviSorgente(s)}: ${m}`);
    }
    return motivi.join('; ');
  }

  /**
   * Prova a rendere vera una condizione. Restituisce null se ci riesce,
   * altrimenti il motivo.
   */
  soddisfa(c: CondizioneGrezza, prof: number): string | null {
    let nodo: NodoCondizione;
    try {
      nodo = this.parser.compila(c);
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    const radicePrima = this.radice;
    if (prof === 0 || !this.radice) this.radice = nodo;
    try {
      return this.soddisfaNodo(nodo, prof);
    } finally {
      this.radice = radicePrima;
    }
  }

  private vero(n: NodoCondizione): boolean {
    return valutaNodo(n, this.n.contesto);
  }

  private soddisfaNodo(n: NodoCondizione, prof: number): string | null {
    if (prof > 8) return 'catena di dipendenze troppo lunga';
    this.azioni++;
    if (this.vero(n)) return null;
    switch (n.tipo) {
      case 'costante':
        return 'condizione sempre falsa';
      case 'e': {
        // Un figlio reso vero può renderne falso un altro (l'ora che passa):
        // qualche giro in più, poi ci si arrende.
        for (let giro = 0; giro < 3; giro++) {
          for (const f of n.figli) {
            const m = this.soddisfaNodo(f, prof);
            if (m) return m;
          }
          if (this.vero(n)) return null;
        }
        return `«${stampaCondizione(n)}»: le parti si escludono a vicenda`;
      }
      case 'o': {
        const motivi: string[] = [];
        for (const f of n.figli) {
          const s = this.istantanea();
          const m = this.soddisfaNodo(f, prof);
          if (!m && this.vero(n)) return null;
          motivi.push(m ?? 'nessun effetto');
          this.ripristina(s);
        }
        return `nessuna alternativa riesce (${motivi.join(' | ')})`;
      }
      case 'non':
        return this.negaNodo(n.figlio);
      case 'atomo':
        return this.soddisfaAtomo(n.atomo, prof);
    }
  }

  private negaNodo(n: NodoCondizione): string | null {
    if (!this.vero(n)) return null;
    if (n.tipo === 'atomo') {
      const a = n.atomo;
      if (a.k === 'notte') {
        this.fatti.aspettaFino(7);
        return null;
      }
      if (a.k === 'di') {
        this.fatti.aspettaFino(NOTTE_PREDEFINITA.inizio);
        return null;
      }
      if (a.k === 'ora') {
        for (let h = Math.ceil(this.fatti.oraCorrente); h < this.fatti.oraCorrente + 24; h++) {
          const s = this.istantanea();
          this.fatti.aspettaFino(h % 24);
          if (!this.vero(n)) return null;
          this.ripristina(s);
        }
      }
    }
    return `«!${stampaCondizione(n)}»: è già vera e niente la può rendere falsa`;
  }

  private soddisfaAtomo(a: Atomo, prof: number): string | null {
    const f = this.fatti;
    switch (a.k) {
      case 'luogo':
        f.luoghi.add(a.id);
        this.log(`  raggiunge il luogo ${a.id}`);
        return null;
      case 'cella':
        if (a.stato === 'rilevata') f.rilevate.add(a.id);
        else if (a.stato === 'vista') f.viste.add(a.id);
        else if (a.stato === 'bianca') return `la cella ${a.id} non può tornare bianca`;
        else f.varianti.set(a.id, a.stato);
        this.log(`  ${a.stato === 'rilevata' ? 'rileva' : a.stato === 'vista' ? 'vede' : `porta a «${a.stato}»`} la cella ${a.id}`);
        return null;
      case 'notte':
        f.aspettaFino(22);
        this.log(`  aspetta la notte (giorno ${f.giornoCorrente}, ore 22)`);
        return null;
      case 'di':
        f.aspettaFino(7);
        this.log(`  aspetta il giorno (giorno ${f.giornoCorrente}, ore 7)`);
        return null;
      case 'ora': {
        const c = a.confronto;
        let h: number;
        if (c.tipo === 'intervallo') h = c.da;
        else if (c.op === '>' ) h = Math.min(23.99, c.valore + 0.01);
        else if (c.op === '<') h = 0;
        else if (c.op === '<=') h = 0;
        else h = c.valore;
        f.aspettaFino(h);
        this.log(`  aspetta le ore ${h} (giorno ${f.giornoCorrente})`);
        return this.vero({ tipo: 'atomo', atomo: a }) ? null : `«${stampaAtomo(a)}» impossibile`;
      }
      case 'giorno': {
        const c = a.confronto;
        const g = c.tipo === 'intervallo' ? c.da : c.op === '>' ? c.valore + 1 : c.valore;
        if (g < f.giornoCorrente || (c.tipo === 'op' && (c.op === '<' || c.op === '<=' || c.op === '!='))) {
          if (!this.vero({ tipo: 'atomo', atomo: a })) return `«${stampaAtomo(a)}»: il giorno ${f.giornoCorrente} è già passato`;
          return null;
        }
        f.giornoCorrente = g;
        f.oraCorrente = 7;
        this.log(`  aspetta il giorno ${g}`);
        return null;
      }
      case 'dialogo': {
        const d = this.c.dialoghi[a.id];
        if (!d) return `dialogo inesistente «${a.id}»`;
        return this.giocaDialogo(a.id, null, prof + 1);
      }
      case 'missione': {
        if (a.stato === 'inattiva') return `la missione ${a.id} è già avviata`;
        if (this.n.missioni.stato(a.id) === 'inattiva') {
          const m = this.avviaMissione(a.id, prof + 1);
          if (m) return `missione ${a.id}: ${m}`;
        }
        if (a.stato === 'completata') {
          return this.n.missioni.stato(a.id) === 'completata' ? null : `la missione ${a.id} non è ancora completata (viene dopo nel file?)`;
        }
        return null;
      }
      case 'passo':
        return `il passo ${a.missione}/${a.passo} non è ${a.stato}`;
      case 'flag':
        return this.daSorgenti(`flag:${a.nome}`, { tipo: 'atomo', atomo: a }, prof, () => {
          // Nessun contenuto lo imposta: presumo che lo faccia il gioco.
          const valore = a.op === undefined ? true : a.op === '=' ? a.valore! : typeof a.valore === 'number' ? (a.op === '>' ? a.valore + 1 : a.op === '<' ? a.valore - 1 : a.valore) : true;
          this.n.flag.set(a.nome, valore);
          this.ipotizza(`flag «${a.nome}» impostato dal gioco (nessun effetto dei contenuti lo imposta)`);
          return this.vero({ tipo: 'atomo', atomo: a }) ? null : `«${stampaAtomo(a)}» impossibile`;
        });
      case 'oggetto':
        return this.daSorgenti(`oggetto:${a.id}`, { tipo: 'atomo', atomo: a }, prof, () => {
          f.oggetti.set(a.id, Math.max(a.quantita, 1));
          this.ipotizza(`oggetto «${a.id}» dato dal gioco (nessun effetto «oggetto:+${a.id}»)`);
          return null;
        });
      case 'taccuino': {
        const def = this.c.taccuino.find((v) => v.id === a.id);
        const chiave = `taccuino:${a.id}`;
        return this.daSorgenti(chiave, { tipo: 'atomo', atomo: a }, prof, () => {
          if (def?.sbloccaQuando !== undefined) {
            const m = this.soddisfa(def.sbloccaQuando, prof + 1);
            this.n.tick();
            if (!m && this.vero({ tipo: 'atomo', atomo: a })) return null;
          }
          return `nessun effetto scrive la voce «${a.id}»`;
        });
      }
      case 'extra':
        f.extra.add(`${a.prefisso}:${a.argomento}${a.qualificatore ? ' ' + a.qualificatore : ''}`);
        this.ipotizza(`«${stampaAtomo(a)}» reso vero dal gioco`);
        return null;
    }
  }

  private ipotizza(s: string): void {
    if (!this.ipotesi.includes(s)) this.ipotesi.push(s);
    if (!this.esplorando) this.log(`  ipotesi: ${s}`);
  }

  /** Prova le sorgenti di un effetto finché l'atomo è vero; altrimenti `ripiego`. */
  private daSorgenti(chiave: string, obiettivo: NodoCondizione, prof: number, ripiego: () => string | null): string | null {
    const sorgenti = this.sorgenti.get(chiave) ?? [];
    const motivi: string[] = [];
    for (const s of sorgenti) {
      // per i contatori (flag:x>=3) una sorgente può servire più volte
      for (let volte = 0; volte < 5; volte++) {
        const prima = this.firma();
        const m = this.attivaSorgente(s, () => this.vero(obiettivo), prof + 1);
        if (!m) return null;
        if (this.firma() === prima) {
          motivi.push(`${descriviSorgente(s)}: ${m}`);
          break;
        }
        if (this.vero(obiettivo)) return null;
      }
    }
    if (sorgenti.length === 0) return ripiego();
    return `«${stampaCondizione(obiettivo)}» non raggiungibile (${motivi.join('; ') || 'le sorgenti non bastano'})`;
  }

  /** Fa accadere una sorgente di effetti. */
  private attivaSorgente(s: Sorgente, riuscito: () => boolean, prof: number): string | null {
    if (prof > 8) return 'catena di dipendenze troppo lunga';
    switch (s.tipo) {
      case 'risposta':
      case 'nodo':
        return this.giocaDialogo(s.dialogo, riuscito, prof);
      case 'passo': {
        if (this.n.missioni.stato(s.missione) === 'completata' || this.n.missioni.statoPasso(s.missione, s.passo) === 'completato') {
          return riuscito() ? null : `il passo ${s.missione}/${s.passo} è già completato`;
        }
        if (this.n.missioni.statoPasso(s.missione, s.passo) !== 'attivo') {
          return `serve il passo ${s.missione}/${s.passo}, che non è ancora attivo`;
        }
        const p = this.c.missioni.find((m) => m.id === s.missione)!.passi.find((x) => x.id === s.passo)!;
        if (p.completaQuando === undefined) return `il passo ${s.missione}/${s.passo} non ha «completa_quando»`;
        const m = this.soddisfa(p.completaQuando, prof + 1);
        this.n.tick();
        if (m) return m;
        return riuscito() ? null : 'non basta';
      }
      case 'missione':
        return riuscito() ? null : `serve completare la missione ${s.missione}`;
    }
  }

  /**
   * Gioca un dialogo fino alla fine. Esplora (con istantanee) i percorsi
   * possibili e sceglie quello dopo il quale `riuscito()` è vero e che più
   * avvicina la condizione cercata; a parità, il più corto.
   */
  giocaDialogo(id: string, riuscito: (() => boolean) | null, prof: number): string | null {
    const d: DialogoDef | undefined = this.c.dialoghi[id];
    if (!d) return `dialogo inesistente «${id}»`;
    if (this.n.dialoghi.finito(id) && !d.ripetibile) {
      return `il dialogo ${id} è già finito e non è ripetibile: ciò che serviva era su un altro ramo`;
    }
    if (d.condizione !== undefined && !this.n.valuta(d.condizione)) {
      const m = this.soddisfa(d.condizione, prof + 1);
      if (m) return `il dialogo ${id} non è disponibile: ${m}`;
    }
    const inizio = this.istantanea();
    let migliore: { scelte: number[]; punti: number; ricchezza: number } | null = null;
    let finali = 0;
    let passi = 0;
    this.esplorando++;
    try {
      try {
        this.n.dialoghi.avvia(id);
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      const sulPercorso = new Set<string>();
      const cerca = (profondita: number, scelte: number[]): void => {
        if (finali >= 300 || passi >= 5000) return;
        if (this.n.dialoghi.isFinished()) {
          finali++;
          if (riuscito && !riuscito()) return;
          const punti = this.punteggio();
          const ricchezza = this.ricchezza();
          const m = migliore as { scelte: number[]; punti: number; ricchezza: number } | null;
          if (
            !m ||
            punti > m.punti ||
            (punti === m.punti && ricchezza > m.ricchezza) ||
            (punti === m.punti && ricchezza === m.ricchezza && scelte.length < m.scelte.length)
          ) {
            migliore = { scelte, punti, ricchezza };
          }
          return;
        }
        if (profondita > 40) return;
        const nodo = this.n.dialoghi.getNode()!;
        const chiave = `${nodo.dialogo}/${nodo.nodo}|${JSON.stringify(this.n.flag.tutti())}|${this.n.taccuino.voci().length}|${this.n.inventario.elenco().length}`;
        if (sulPercorso.has(chiave)) return; // giro a vuoto
        sulPercorso.add(chiave);
        const opzioni = nodo.finale ? [0] : nodo.risposte.map((r) => r.indice);
        for (const i of opzioni) {
          const s = this.istantanea();
          passi++;
          this.n.dialoghi.choose(i);
          cerca(profondita + 1, [...scelte, i]);
          this.ripristina(s);
        }
        sulPercorso.delete(chiave);
      };
      cerca(0, []);
    } finally {
      this.esplorando--;
    }
    this.ripristina(inizio);
    const trovato = migliore as { scelte: number[] } | null;
    if (!trovato) {
      return riuscito ? `nessun percorso del dialogo ${id} produce l'effetto cercato` : `nessun percorso del dialogo ${id} arriva alla fine`;
    }
    // Rigioca il percorso scelto «per davvero», per la traccia e gli eventi.
    this.log(`  dialogo ${id} (${d.personaggio}): scelte ${trovato.scelte.map((i) => i + 1).join(', ') || '—'}`);
    this.n.dialoghi.avvia(id);
    for (const i of trovato.scelte) this.n.dialoghi.choose(i);
    this.n.tick();
    this.apriInSospeso();
    return null;
  }
}

// ---------------------------------------------------------------------------
// Verifica

export function verificaContenuti(grezzi: ContenutiVerifica, opzioni: OpzioniVerifica = {}): RapportoVerifica {
  const errori: string[] = [];
  const avvisi: string[] = [];
  const parser = new ParserCondizioni(opzioni.parser);
  const c = normalizzaContenuti({ missioni: grezzi.missioni, dialoghi: grezzi.dialoghi, taccuino: grezzi.taccuino });
  for (const a of c.avvisi) avvisi.push(`forma: ${a}`);

  const luoghi = grezzi.luoghi !== undefined ? idDa(grezzi.luoghi) : null;
  const personaggi = grezzi.personaggi !== undefined ? idDa(grezzi.personaggi) : null;
  const celle = grezzi.celle ? new Set(grezzi.celle) : null;
  const voci = new Set(c.taccuino.map((v) => v.id));
  const missioni = new Map(c.missioni.map((m) => [m.id, m]));

  // 1. Condizioni
  const atomiLetti: [Atomo, string][] = [];
  let nCondizioni = 0;
  for (const [cond, origine] of condizioniDi(c)) {
    nCondizioni++;
    try {
      const nodo = parser.compila(cond);
      for (const a of atomiDi(nodo)) atomiLetti.push([a, origine]);
    } catch (e) {
      errori.push(`${origine}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. Effetti
  const prodotti = new Set<string>();
  const flagImpostati = new Set<string>();
  let nEffetti = 0;
  for (const [s, sorgente] of effettiDi(c)) {
    nEffetti++;
    const origine = descriviSorgente(sorgente);
    let e: Effetto;
    try {
      e = analizzaEffetto(s);
    } catch (err) {
      errori.push(`${origine}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    const k = chiaveEffetto(e);
    if (k) prodotti.add(k);
    if (e.tipo === 'flag' || e.tipo === 'flag-somma') flagImpostati.add(e.nome);
    if (e.tipo === 'taccuino' && !voci.has(e.id)) avvisi.push(`${origine}: «${stampaEffetto(e)}» scrive una voce che non è in taccuino.json`);
    if (e.tipo === 'missione' && !missioni.has(e.id)) errori.push(`${origine}: «${s}» cita una missione inesistente`);
    if (e.tipo === 'dialogo' && !c.dialoghi[e.id]) errori.push(`${origine}: «${s}» cita un dialogo inesistente`);
  }

  // 3. Dialoghi: vai_a, nodi irraggiungibili, personaggi
  let nNodi = 0;
  for (const d of Object.values(c.dialoghi)) {
    const ids = new Set(d.nodi.map((n) => n.id));
    nNodi += d.nodi.length;
    if (d.nodi.length && !ids.has(d.inizio)) errori.push(`dialogo ${d.id}: il nodo iniziale «${d.inizio}» non esiste`);
    const doppi = d.nodi.map((n) => n.id).filter((x, i, a) => a.indexOf(x) !== i);
    for (const x of new Set(doppi)) errori.push(`dialogo ${d.id}: nodo duplicato «${x}»`);
    for (const n of d.nodi) {
      n.risposte.forEach((r, i) => {
        if (r.vaiA !== null && !ids.has(r.vaiA)) {
          errori.push(`dialogo ${d.id}, nodo ${n.id}, risposta ${i + 1}: vai_a «${r.vaiA}» non esiste`);
        }
        if (!r.testo.trim()) avvisi.push(`dialogo ${d.id}, nodo ${n.id}, risposta ${i + 1}: testo vuoto`);
      });
      if (n.vaiA && !ids.has(n.vaiA)) errori.push(`dialogo ${d.id}, nodo ${n.id}: vai_a «${n.vaiA}» non esiste`);
      if (!n.testo.trim()) avvisi.push(`dialogo ${d.id}, nodo ${n.id}: testo vuoto`);
    }
    // raggiungibilità
    const raggiunti = new Set<string>();
    const coda = ids.has(d.inizio) ? [d.inizio] : [];
    while (coda.length) {
      const x = coda.pop()!;
      if (raggiunti.has(x)) continue;
      raggiunti.add(x);
      const n = d.nodi.find((y) => y.id === x)!;
      for (const r of n.risposte) if (r.vaiA && ids.has(r.vaiA)) coda.push(r.vaiA);
      if (n.vaiA && ids.has(n.vaiA)) coda.push(n.vaiA);
    }
    for (const n of d.nodi) if (!raggiunti.has(n.id)) avvisi.push(`dialogo ${d.id}: il nodo «${n.id}» non è raggiungibile dall'inizio`);
    // un dialogo deve poter finire
    const finisce = d.nodi.some((n) => raggiunti.has(n.id) && (n.risposte.length === 0 ? !n.vaiA : n.risposte.some((r) => r.vaiA === null)));
    if (d.nodi.length && !finisce) errori.push(`dialogo ${d.id}: nessun nodo raggiungibile chiude il dialogo`);
    if (!d.personaggio) avvisi.push(`dialogo ${d.id}: manca il personaggio`);
    else if (personaggi && !personaggi.has(d.personaggio)) avvisi.push(`dialogo ${d.id}: personaggio «${d.personaggio}» non è in personaggi.json`);
  }

  // 4. Riferimenti nelle condizioni
  const visti = new Set<string>();
  const avvisaUnaVolta = (s: string): void => {
    if (!visti.has(s)) {
      visti.add(s);
      avvisi.push(s);
    }
  };
  for (const [a, origine] of atomiLetti) {
    switch (a.k) {
      case 'luogo':
        if (luoghi && !luoghi.has(a.id)) avvisaUnaVolta(`${origine}: luogo «${a.id}» non è in luoghi.json`);
        break;
      case 'cella':
        if (celle && !celle.has(a.id)) avvisaUnaVolta(`${origine}: cella «${a.id}» sconosciuta`);
        break;
      case 'dialogo':
        if (!c.dialoghi[a.id]) errori.push(`${origine}: dialogo inesistente «${a.id}»`);
        break;
      case 'missione':
        if (!missioni.has(a.id)) errori.push(`${origine}: missione inesistente «${a.id}»`);
        break;
      case 'passo': {
        const m = missioni.get(a.missione);
        if (!m || !m.passi.some((p) => p.id === a.passo)) errori.push(`${origine}: passo inesistente «${a.missione}/${a.passo}»`);
        break;
      }
      case 'taccuino':
        if (!voci.has(a.id)) avvisaUnaVolta(`${origine}: voce del taccuino «${a.id}» non è in taccuino.json`);
        else if (!prodotti.has(`taccuino:${a.id}`) && !c.taccuino.find((v) => v.id === a.id)?.sbloccaQuando) {
          avvisaUnaVolta(`${origine}: la voce «${a.id}» non viene mai scritta da un effetto`);
        }
        break;
      case 'flag':
        if (!flagImpostati.has(a.nome)) avvisaUnaVolta(`${origine}: il flag «${a.nome}» non è impostato da nessun effetto (deve farlo il gioco?)`);
        break;
      case 'oggetto':
        if (!prodotti.has(`oggetto:${a.id}`)) avvisaUnaVolta(`${origine}: l'oggetto «${a.id}» non è dato da nessun effetto (deve farlo il gioco?)`);
        break;
      default:
        break;
    }
  }
  for (const m of c.missioni) {
    for (const p of m.passi) {
      if (p.completaQuando === undefined) errori.push(`missione ${m.id}, passo ${p.id}: manca «completa_quando»`);
      if (p.obiettivo === undefined) avvisi.push(`missione ${m.id}, passo ${p.id}: manca «obiettivo_taccuino»`);
    }
  }

  // 5. Simulazione
  const sim = new Simulatore(c, parser, opzioni, opzioni.maxAzioni ?? 400);
  let simulazione: EsitoMissione[] = [];
  try {
    simulazione = sim.gioca();
  } catch (e) {
    errori.push(`simulazione interrotta: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  }
  for (const s of simulazione) {
    if (s.esito !== 'completata') errori.push(`simulazione: la missione ${s.missione} è ${s.esito}: ${s.motivo}`);
  }
  for (const p of sim.n.problemi) if (!errori.some((e) => e.includes(p)) && !avvisi.includes(`forma: ${p}`)) avvisi.push(`durante la simulazione: ${p}`);

  return {
    errori,
    avvisi,
    simulazione,
    traccia: sim.traccia,
    ipotesi: sim.ipotesi,
    conteggi: {
      missioni: c.missioni.length,
      passi: c.missioni.reduce((s, m) => s + m.passi.length, 0),
      dialoghi: Object.keys(c.dialoghi).length,
      nodi: nNodi,
      vociTaccuino: c.taccuino.length,
      condizioni: nCondizioni,
      effetti: nEffetti,
    },
  };
}
