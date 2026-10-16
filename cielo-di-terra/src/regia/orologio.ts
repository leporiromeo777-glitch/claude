/**
 * L'orologio della storia: giorno e ora di gioco, con i fermi della Fase 1 (FASE1 §2.2).
 *
 * È la fonte unica del tempo: la regia lo fa avanzare a ogni passo e copia l'ora
 * nell'orologio del cielo del motore (`WorldClock`, tenuto fermo) e nell'orologio a schermo
 * (`ui.orologio`, dal ponte dell'interfaccia). Logica pura, senza three.js: si prova in Node.
 *
 * - `fermo HH:MM`: l'ora resta ferma a HH:MM (dal risveglio all'apertura della botola);
 * - `max HH:MM`: l'ora non supera la prossima HH:MM (il mondo continua, la luce resta);
 * - `libero`: toglie fermo e limite;
 * - `saltaA(ore)`: dormire, porta alla prossima occorrenza di quell'ora;
 * - `aspettaFino(ore)`: «aspetta fino a», un time-lapse: qualunque attesa dura al più
 *   `ATTESA_DURATA_MAX` secondi reali (prima il tempo correva a x20, 5 s per ogni ora: la brace
 *   dalla mattina era più di un minuto fermi), con l'accelerazione morbida all'inizio e la
 *   frenata alla fine; `saltaAllaFine()` (il secondo tocco) fa correre il resto in un attimo.
 *   Il tempo passa comunque a passi contigui: gli eventi dell'intervallo scattano tutti e in
 *   ordine, come prima.
 *
 * Il tempo assoluto è in ore dall'inizio del giorno 1: `assoluto = (giorno - 1) * 24 + ore`.
 */
import { oreDa, testoOra } from './contenuti';

export interface StatoOrologio {
  giorno: number;
  ore: number;
  fermo: number | null;
  limite: number | null;
}

export interface Intervallo {
  /** Tempo assoluto prima del passo (ore). */
  da: number;
  /** Tempo assoluto dopo il passo (ore). */
  a: number;
}

/** Notte di gioco: 21:00-05:30 (GDD §2.3). */
export const INIZIO_NOTTE = 21;
export const FINE_NOTTE = 5.5;

export function eNotte(ore: number): boolean {
  return ore >= INIZIO_NOTTE || ore < FINE_NOTTE;
}

/** Ore da `da` alla prossima occorrenza dell'ora `a` (0 < x ≤ 24). */
export function oreFino(da: number, a: number): number {
  const x = (((a - da) % 24) + 24) % 24;
  return x < 1 / 120 ? 24 : x;
}

/** Un'attesa più lunga di così (ore) si rifiuta: è quasi un giorno intero, una scelta sbagliata. */
export const ATTESA_MAX_ORE = 20;

/**
 * Il time-lapse di «Aspetta fino a» (secondi reali): una base più un tanto per ogni ora di gioco,
 * al più `ATTESA_DURATA_MAX` (un'ora: 2 s; la brace dalla mattina o la notte intera: 5,5 s).
 */
export const ATTESA_DURATA_MIN = 1.6;
export const ATTESA_SECONDI_PER_ORA = 0.45;
export const ATTESA_DURATA_MAX = 5.5;
/** Il secondo tocco (X, Invio o Spazio): il resto dell'attesa corre in così pochi secondi, sotto il nero. */
export const ATTESA_DURATA_SALTO = 0.6;

/** Quanti secondi reali dura l'attesa di `ore` ore di gioco. */
export function durataAttesa(ore: number): number {
  return Math.min(ATTESA_DURATA_MAX, ATTESA_DURATA_MIN + Math.max(0, ore) * ATTESA_SECONDI_PER_ORA);
}

/**
 * La parte di tempo di gioco già passata al punto `u` (0-1) del time-lapse: parte piano, corre,
 * frena alla fine (la velocità del cielo va da zero a 1,5 volte la media e torna a zero).
 */
export function curvaAttesa(u: number): number {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

/** Le ore della sera e della notte della Fase 1 (missioni.json, fade_fase1.json, bersagli.ts). */
export const ORA_BRACE = 19.5;
export const ORA_OMBRISTA = 19.75;
/** Dalle 20:30 si dorme nel fienile di Ottavio. */
export const ORA_DORMIRE = 20.5;
/** Le Fade escono dalle bocche alle 22:05. */
export const ORA_FADE = 22 + 5 / 60;

/** Che cosa sa la regia quando apre il menu dell'attesa. */
export interface ContestoAttesa {
  /** La brace si può aspettare (dopo l'incontro con Ottavio). */
  brace: boolean;
  /** Elvira ha scelto di vegliare la prima notte. */
  vegliare: boolean;
  /** Vegliando, le Fade sono già state viste. */
  fadeViste?: boolean;
  /** I passi attivi della storia: le voci giuste per il passo (l'Ombrista, il sonno, le Fade, l'alba). */
  passi?: Iterable<string>;
  /**
   * Ore di gioco da adesso al limite dell'orologio (`orologio:max`), se c'è: le voci che lo
   * passerebbero non si offrono (il giorno 2 la mattina «la brace (19:30)» portava alle 16:00 con
   * «Il tempo non va più in là»). «fra un'ora» resta: al più si ferma al limite e lo dice.
   */
  oreAlLimite?: number | null;
}

/** Una voce del menu: il testo e l'ora (del giorno) a cui arriva. */
export interface VoceAttesa {
  testo: string;
  ore: number;
}

/** Chi arriva e quando (dalle indicazioni delle missioni), con il nome come lo sa Elvira. */
export interface ArrivoAttesa {
  giorno: number;
  ore: number;
  chi?: string;
  /** Sono più d'uno (i bambini): «arrivano». */
  molti?: boolean;
}

/**
 * Le voci del menu «Aspetta fino a» all'ora `o` del giorno `giorno`, le più utili per prime:
 * - chi si cerca e arriva oggi (dalle indicazioni), con il nome;
 * - la brace (19:30) e, la prima sera, il racconto dell'Ombrista (19:45: prima, dopo la brace,
 *   restavano 25 secondi da aspettare in piedi davanti al telo);
 * - la seconda notte le 20:30, quando nel fienile si può dormire (prima si arrivava alle 20:30
 *   con la brace e poi «fra un'ora»);
 * - vegliando la prima notte, le Fade (22:05);
 * - mezzanotte (la sera, dalle 19:00; mai dopo la mezzanotte: sarebbe un giorno intero; e non più
 *   di giorno per chi ha vegliato: il giorno dopo la voce restava, e non c'entrava);
 * - l'alba (dalle 20:00, e a ogni ora nei passi che chiedono il mattino: la seconda notte, la
 *   prima vegliando);
 * - fra un'ora (di giorno).
 *
 * Con un limite dell'orologio davanti (`oreAlLimite`), le voci che lo passerebbero non ci sono.
 */
export function vociDiAttesa(o: number, giorno: number, arrivo: ArrivoAttesa | null, f: ContestoAttesa): VoceAttesa[] {
  const passi = new Set(f.passi ?? []);
  const v: VoceAttesa[] = [];
  const limite = f.oreAlLimite ?? null;
  const aggiungi = (testo: string, ore: number, finoAlLimite = false): void => {
    // (oltre il limite l'attesa si fermerebbe lì: la voce prometterebbe un'ora che non arriva)
    if (!finoAlLimite && limite !== null && oreFino(o, ore) > limite + 1 / 120) return;
    if (!v.some((x) => Math.abs(x.ore - ore) < 1 / 120)) v.push({ testo, ore });
  };
  const giorno_ = o >= FINE_NOTTE;
  if (arrivo && arrivo.giorno === giorno && arrivo.ore > o + 1 / 60 && giorno_ && arrivo.ore <= 20) {
    aggiungi(arrivo.chi ? `le ${testoOra(arrivo.ore)}: ${arrivo.molti ? 'arrivano' : 'arriva'} ${arrivo.chi}` : `le ${testoOra(arrivo.ore)}, quando arriva qualcuno`, arrivo.ore);
  }
  if (f.brace && o < ORA_BRACE && giorno_) aggiungi(`la brace (${testoOra(ORA_BRACE)})`, ORA_BRACE);
  if ((passi.has('m1_brace') || passi.has('m1_ombrista')) && o < ORA_OMBRISTA && giorno_) aggiungi(`l'Ombrista (${testoOra(ORA_OMBRISTA)})`, ORA_OMBRISTA);
  if (passi.has('m1_seconda_notte') && o < ORA_DORMIRE && giorno_) aggiungi(`le ${testoOra(ORA_DORMIRE)} (si può dormire)`, ORA_DORMIRE);
  if (passi.has('m1_notte') && f.vegliare && !f.fadeViste && o >= 12 && o < ORA_FADE - 1 / 60) aggiungi(`le Fade (${testoOra(ORA_FADE)})`, ORA_FADE);
  if (o >= 19) aggiungi('mezzanotte', 0);
  const chiedeIlMattino = passi.has('m1_seconda_notte') || (passi.has('m1_notte') && f.vegliare);
  if (o >= 20 || !giorno_ || (chiedeIlMattino && oreFino(o, FINE_NOTTE) <= ATTESA_MAX_ORE)) aggiungi(`l'alba (${testoOra(FINE_NOTTE)})`, FINE_NOTTE);
  if (giorno_ && o < 20) aggiungi("fra un'ora", (o + 1) % 24, true);
  return v;
}

export function assolutoDi(giorno: number, ore: number): number {
  return (giorno - 1) * 24 + ore;
}

/** Il time-lapse di «Aspetta fino a» in corso. */
export interface AttesaInCorso {
  /** Tempo assoluto di partenza (o del salto) e d'arrivo (ore). */
  da: number;
  fino: number;
  /** L'arrivo chiesto dal menu (`fino` è più presto se un limite lo tronca). */
  chiesta: number;
  /** Durata del time-lapse e secondi reali già passati. */
  durata: number;
  t: number;
  /** Il resto corre alla fine (il secondo tocco). */
  salto: boolean;
}

export class OrologioStoria {
  giorno = 1;
  ore = 5 + 38 / 60;
  /** Ora ferma (orologio:fermo), oppure null. */
  fermo: number | null = null;
  /** Tempo assoluto da non superare (orologio:max), oppure null. */
  limite: number | null = null;
  /** Minuti reali per un giorno di 24 ore. */
  minutiGiorno = 40;
  /** Moltiplicatore di debug (prove E2E). */
  scalaDebug = 1;
  /** «Aspetta fino a» in corso (il time-lapse), oppure null. */
  attesa: AttesaInCorso | null = null;

  get assoluto(): number {
    return assolutoDi(this.giorno, this.ore);
  }

  /** Imposta il tempo assoluto (ore dall'inizio del giorno 1). */
  impostaAssoluto(a: number): void {
    const t = Math.max(0, a);
    this.giorno = Math.floor(t / 24) + 1;
    this.ore = t - (this.giorno - 1) * 24;
  }

  imposta(giorno: number, ore: number): void {
    this.impostaAssoluto(assolutoDi(giorno, ore));
  }

  /** Ore di gioco per secondo reale fuori dall'attesa (con la scala di debug). */
  oreAlSecondo(): number {
    return (24 / (this.minutiGiorno * 60)) * this.scalaDebug;
  }

  /**
   * Avanza di `dt` secondi reali e restituisce l'intervallo assoluto percorso. Nell'attesa l'ora
   * segue la curva del time-lapse (mai all'indietro, mai più piano del tempo normale) e alla fine
   * del time-lapse è esattamente quella chiesta.
   */
  avanza(dt: number): Intervallo {
    const da = this.assoluto;
    if (this.fermo !== null) {
      this.ore = this.fermo;
      return { da, a: this.assoluto };
    }
    const normale = da + dt * this.oreAlSecondo();
    let a = normale;
    const at = this.attesa;
    if (at) {
      at.t += dt;
      const u = at.durata > 0 ? at.t / at.durata : 1;
      if (u >= 1) {
        a = at.fino;
        this.attesa = null;
      } else a = Math.min(at.fino, Math.max(normale, at.da + (at.fino - at.da) * (at.salto ? u : curvaAttesa(u))));
    }
    if (this.limite !== null) {
      if (da >= this.limite) a = da;
      else if (a >= this.limite) {
        a = this.limite;
        this.attesa = null;
      }
    }
    this.impostaAssoluto(a);
    return { da, a };
  }

  /** Prossima occorrenza assoluta dell'ora `ore` (strettamente dopo adesso, se `stretto`). */
  prossima(ore: number, stretto = true): number {
    const oggi = assolutoDi(this.giorno, ore);
    const ora = this.assoluto;
    if (oggi > ora || (!stretto && oggi === ora)) return oggi;
    return oggi + 24;
  }

  /** Comandi «orologio:» dei contenuti: `['fermo', '05:38']`, `['max', '17:30']`, `['libero']`. */
  comando(argomenti: readonly string[]): void {
    const [cosa, quando] = argomenti;
    if (cosa === 'libero') {
      this.fermo = null;
      this.limite = null;
      return;
    }
    const h = quando ? oreDa(quando) : Number.NaN;
    if (!Number.isFinite(h)) return;
    if (cosa === 'fermo') {
      this.fermo = h;
      this.ore = h;
      this.limite = null;
      this.attesa = null;
    } else if (cosa === 'max') {
      this.fermo = null;
      this.limite = this.prossima(h, false);
    }
  }

  /** Salta (dormendo) alla prossima occorrenza di `ore`. Toglie i limiti già superati. */
  saltaA(ore: number): Intervallo {
    const da = this.assoluto;
    const a = this.prossima(ore);
    this.fermo = null;
    this.attesa = null;
    if (this.limite !== null && this.limite <= a) this.limite = null;
    this.impostaAssoluto(a);
    return { da, a };
  }

  /** Fa passare `ore` ore di colpo (effetto «tempo:avanza»). */
  avanzaDi(ore: number): Intervallo {
    const da = this.assoluto;
    this.fermo = null;
    if (this.limite !== null && this.limite <= da + ore) this.limite = null;
    this.impostaAssoluto(da + Math.max(0, ore));
    return { da, a: this.assoluto };
  }

  /**
   * «Aspetta fino a»: un time-lapse fino alla prossima occorrenza di `ore`, lungo
   * `durataAttesa(ore di gioco)` secondi reali (o `durata`). Un limite (orologio:max) più vicino
   * accorcia l'attesa fino al limite, frenando lì (`fino` prima di `chiesta`). Restituisce false
   * se un fermo o un limite lo impediscono già adesso.
   */
  aspettaFino(ore: number, durata?: number): boolean {
    if (this.fermo !== null) return false;
    const adesso = this.assoluto;
    if (this.limite !== null && adesso >= this.limite) return false;
    const chiesta = this.prossima(ore);
    const fino = this.limite !== null ? Math.min(chiesta, this.limite) : chiesta;
    this.attesa = { da: adesso, fino, chiesta, durata: durata ?? durataAttesa(fino - adesso), t: 0, salto: false };
    return true;
  }

  /**
   * Il secondo tocco: il resto dell'attesa corre in `ATTESA_DURATA_SALTO` secondi (a velocità
   * costante, sempre a passi contigui). False se non c'è un'attesa o se sta già saltando.
   */
  saltaAllaFine(): boolean {
    const at = this.attesa;
    if (!at || at.salto) return false;
    at.salto = true;
    at.da = this.assoluto;
    at.durata = Math.min(Math.max(0, at.durata - at.t), ATTESA_DURATA_SALTO);
    at.t = 0;
    return true;
  }

  interrompiAttesa(): void {
    this.attesa = null;
  }

  get inAttesa(): boolean {
    return this.attesa !== null;
  }

  /** L'attesa in corso salta alla fine (il secondo tocco)? */
  get inSalto(): boolean {
    return this.attesa?.salto === true;
  }

  get notte(): boolean {
    return eNotte(this.ore);
  }

  esporta(): StatoOrologio {
    return { giorno: this.giorno, ore: this.ore, fermo: this.fermo, limite: this.limite };
  }

  importa(s: Partial<StatoOrologio> | null | undefined): void {
    if (!s) return;
    if (typeof s.giorno === 'number' && typeof s.ore === 'number') this.imposta(s.giorno, s.ore);
    this.fermo = typeof s.fermo === 'number' ? s.fermo : null;
    this.limite = typeof s.limite === 'number' ? s.limite : null;
    this.attesa = null;
  }
}

/** Vero se l'ora del giorno `ore` cade in (da, a] (tempi assoluti), anche attraverso più giorni. */
export function attraversa(intervallo: Intervallo, ore: number): number[] {
  const out: number[] = [];
  if (intervallo.a <= intervallo.da) return out;
  const g0 = Math.floor(intervallo.da / 24);
  const g1 = Math.floor(intervallo.a / 24);
  for (let g = g0; g <= g1; g++) {
    const t = g * 24 + ore;
    if (t > intervallo.da && t <= intervallo.a) out.push(t);
  }
  return out;
}
