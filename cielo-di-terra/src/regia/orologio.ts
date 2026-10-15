/**
 * L'orologio della storia: giorno e ora di gioco, con i fermi della Fase 1 (FASE1 §2.2).
 *
 * È la fonte unica del tempo: la regia lo fa avanzare a ogni passo e copia l'ora
 * nell'orologio del cielo del motore (`WorldClock`, tenuto fermo). Logica pura, senza
 * three.js: si prova in Node.
 *
 * - `fermo HH:MM`: l'ora resta ferma a HH:MM (dal risveglio all'apertura della botola);
 * - `max HH:MM`: l'ora non supera la prossima HH:MM (il mondo continua, la luce resta);
 * - `libero`: toglie fermo e limite;
 * - `saltaA(ore)`: dormire, porta alla prossima occorrenza di quell'ora;
 * - `aspettaFino(ore)`: «aspetta fino a», il tempo scorre fino a x20 e si ferma al limite.
 *
 * Il tempo assoluto è in ore dall'inizio del giorno 1: `assoluto = (giorno - 1) * 24 + ore`.
 */
import { oreDa } from './contenuti';

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

export function assolutoDi(giorno: number, ore: number): number {
  return (giorno - 1) * 24 + ore;
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
  /** «Aspetta fino a» in corso: tempo assoluto d'arrivo e accelerazione. */
  attesa: { fino: number; scala: number } | null = null;

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

  /** Ore di gioco per secondo reale, con l'attesa e la scala di debug. */
  oreAlSecondo(): number {
    const base = 24 / (this.minutiGiorno * 60);
    return base * this.scalaDebug * (this.attesa ? this.attesa.scala : 1);
  }

  /** Avanza di `dt` secondi reali e restituisce l'intervallo assoluto percorso. */
  avanza(dt: number): Intervallo {
    const da = this.assoluto;
    if (this.fermo !== null) {
      this.ore = this.fermo;
      return { da, a: this.assoluto };
    }
    let a = da + dt * this.oreAlSecondo();
    if (this.attesa && a >= this.attesa.fino) {
      a = this.attesa.fino;
      this.attesa = null;
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
   * «Aspetta fino a»: il tempo accelera (x20) fino alla prossima occorrenza di `ore`.
   * Restituisce false se un fermo o un limite lo impediscono già adesso.
   */
  aspettaFino(ore: number, scala = 20): boolean {
    if (this.fermo !== null) return false;
    const fino = this.prossima(ore);
    if (this.limite !== null && this.assoluto >= this.limite) return false;
    this.attesa = { fino, scala };
    return true;
  }

  interrompiAttesa(): void {
    this.attesa = null;
  }

  get inAttesa(): boolean {
    return this.attesa !== null;
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
