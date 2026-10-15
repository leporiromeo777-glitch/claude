/**
 * Piccoli campioni generati in codice (Float32Array), senza Web Audio:
 * rumori ciclici, corde del salterio (Karplus-Strong), campane a parziali inarmoniche,
 * coro di grilli e risposta all'impulso del riverbero. Sono funzioni pure.
 */
import { creaRng, tra, type Rng } from '../util';

export type TipoRumore = 'bianco' | 'rosa' | 'marrone';

/** Valore efficace (RMS) di un segnale. */
export function rms(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i] as number) * (x[i] as number);
  return x.length ? Math.sqrt(s / x.length) : 0;
}

/** Picco assoluto. */
export function picco(x: Float32Array): number {
  let p = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i] as number);
    if (a > p) p = a;
  }
  return p;
}

/**
 * Rumore ciclico (si può mettere in loop senza scatti: la coda è sfumata nella testa).
 * Normalizzato a RMS 0,2 e limitato a ±1.
 */
export function generaRumore(tipo: TipoRumore, n: number, rng: Rng): Float32Array {
  const f = Math.min(Math.floor(n / 4), 4096);
  const grezzo = new Float32Array(n + f);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0,
    m = 0;
  for (let i = 0; i < grezzo.length; i++) {
    const w = rng() * 2 - 1;
    if (tipo === 'bianco') grezzo[i] = w;
    else if (tipo === 'rosa') {
      // filtro di Paul Kellet
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      grezzo[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    } else {
      // marrone: integratore con perdita (niente deriva della continua)
      m = (m + 0.02 * w) / 1.02;
      grezzo[i] = m;
    }
  }
  // togli la continua
  let media = 0;
  for (let i = 0; i < grezzo.length; i++) media += grezzo[i] as number;
  media /= grezzo.length;
  for (let i = 0; i < grezzo.length; i++) grezzo[i] = (grezzo[i] as number) - media;
  // sfuma la coda (campioni n..n+f) nella testa: il ciclo n-1 → 0 resta continuo
  const out = grezzo.slice(0, n);
  for (let i = 0; i < f; i++) {
    const k = i / f;
    out[i] = (grezzo[i] as number) * Math.sqrt(k) + (grezzo[n + i] as number) * Math.sqrt(1 - k);
  }
  const r = rms(out) || 1;
  const g = 0.2 / r;
  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, (out[i] as number) * g));
  return out;
}

export interface OpzioniCorda {
  /** Durata del campione in secondi. */
  durata: number;
  /** Tempo di decadimento a −60 dB della fondamentale (s). */
  t60: number;
  /** Durezza del martelletto 0-1 (più alta = attacco più chiaro). */
  durezza: number;
  /** Numero di corde per coro (il salterio ne ha 2-4, leggermente scordate). */
  cori: number;
  /** Scordatura fra le corde del coro, in cent. */
  scordatura: number;
}

/**
 * Corda percossa (Karplus-Strong esteso): un coro di corde leggermente scordate,
 * eccitate da un martelletto morbido. Restituisce un campione normalizzato a picco 0,9.
 */
export function sintetizzaCorda(sr: number, freq: number, opz: OpzioniCorda, rng: Rng): Float32Array {
  const n = Math.max(1, Math.floor(opz.durata * sr));
  const out = new Float32Array(n);
  const y = new Float32Array(n);
  const cori = Math.max(1, Math.round(opz.cori));
  const lm = Math.max(2, Math.floor(sr * (0.0032 - 0.0024 * opz.durezza))); // larghezza del martelletto
  for (let c = 0; c < cori; c++) {
    const cent = cori === 1 ? 0 : ((c / (cori - 1)) * 2 - 1) * opz.scordatura;
    const f = freq * Math.pow(2, cent / 1200);
    // ritardo frazionario (−0,5 per il mezzo campione del filtro a media)
    const periodo = Math.max(3, sr / f - 0.5);
    const pi = Math.floor(periodo);
    const fr = periodo - pi;
    // perdita per giro tarata sul T60 della fondamentale
    const rho = Math.pow(10, -3 / (Math.max(0.05, opz.t60) * f));
    // punto di percussione: il martelletto colpisce a circa 1/8 della corda (filtro a pettine)
    const dPos = Math.max(1, Math.round(periodo * tra(rng, 0.11, 0.14)));
    let rumore = 0;
    y.fill(0);
    for (let i = 0; i < n; i++) {
      // eccitazione: impulso a coseno rialzato meno la sua copia riflessa, più un filo di rumore
      let e = 0;
      if (i < lm) e += 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / lm);
      const j = i - dPos;
      if (j >= 0 && j < lm) e -= 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / lm);
      if (i < pi) {
        rumore += 0.25 * (rng() * 2 - 1 - rumore);
        e += rumore * 0.15;
      }
      let ritorno = 0;
      const k = i - pi;
      if (k >= 0) {
        const a0 = y[k] as number;
        const a1 = k >= 1 ? (y[k - 1] as number) : 0;
        const a2 = k >= 2 ? (y[k - 2] as number) : 0;
        const ya = (1 - fr) * a0 + fr * a1;
        const yb = (1 - fr) * a1 + fr * a2;
        ritorno = rho * 0.5 * (ya + yb);
      }
      const v = e + ritorno;
      y[i] = v;
      out[i] = (out[i] as number) + v / cori;
    }
  }
  // corpo dello strumento: passa-alto per la continua, passa-basso dolce, sfumatura finale
  let lp = 0,
    hpX = 0,
    hpY = 0;
  const aLp = Math.min(1, (2 * Math.PI * Math.min(8000, freq * 12)) / sr);
  const rHp = 1 - (2 * Math.PI * 30) / sr;
  const coda = Math.min(n, Math.floor(sr * 0.08));
  for (let i = 0; i < n; i++) {
    const x = out[i] as number;
    hpY = x - hpX + rHp * hpY;
    hpX = x;
    lp += aLp * (hpY - lp);
    out[i] = lp * (i >= n - coda ? (n - i) / coda : 1);
  }
  const p = picco(out) || 1;
  for (let i = 0; i < n; i++) out[i] = ((out[i] as number) / p) * 0.9;
  return out;
}

/** Un parziale di campana: rapporto di frequenza, ampiezza e costante di decadimento (s). */
export interface Parziale {
  rapporto: number;
  ampiezza: number;
  tau: number;
}

/**
 * Parziali inarmonici di una campana da chiesa (accordatura «minore»):
 * hum, prime, terza minore, quinta, nominale e parziali superiori.
 * I parziali alti sono tenuti bassi e brevi: la campana resta calda e non stridente.
 */
export const PARZIALI_CAMPANA: readonly Parziale[] = [
  { rapporto: 0.5, ampiezza: 0.55, tau: 3.2 }, // hum
  { rapporto: 1.0, ampiezza: 0.8, tau: 2.2 }, // prime (nota di percussione)
  { rapporto: 1.183, ampiezza: 0.5, tau: 1.8 }, // terza minore
  { rapporto: 1.506, ampiezza: 0.28, tau: 1.3 }, // quinta
  { rapporto: 2.0, ampiezza: 0.62, tau: 1.25 }, // nominale
  { rapporto: 2.514, ampiezza: 0.22, tau: 0.8 }, // terza superiore
  { rapporto: 2.662, ampiezza: 0.16, tau: 0.7 },
  { rapporto: 3.011, ampiezza: 0.13, tau: 0.55 },
  { rapporto: 4.166, ampiezza: 0.06, tau: 0.35 },
  { rapporto: 5.433, ampiezza: 0.03, tau: 0.22 },
];

/**
 * Campana: somma di parziali, ognuno sdoppiato in due frequenze vicine
 * (il lento battimento «ua-ua» delle campane vere), più il colpo del batacchio.
 */
export function sintetizzaCampana(sr: number, prime: number, durata: number, rng: Rng): Float32Array {
  const n = Math.floor(durata * sr);
  const out = new Float32Array(n);
  for (const p of PARZIALI_CAMPANA) {
    const f = prime * p.rapporto;
    if (f > sr * 0.45) continue;
    const scarto = tra(rng, 0.35, 1.4); // Hz fra le due metà del doppietto
    for (const [df, amp] of [
      [-scarto / 2, 0.55],
      [scarto / 2, 0.45],
    ] as const) {
      const w = (2 * Math.PI * (f + df)) / sr;
      const c = Math.cos(w),
        s = Math.sin(w);
      const fase = rng() * 2 * Math.PI;
      let x = Math.cos(fase),
        y = Math.sin(fase);
      let a = p.ampiezza * amp;
      const decadimento = Math.exp(-1 / (p.tau * sr));
      const fine = Math.min(n, Math.floor(p.tau * sr * 9));
      for (let i = 0; i < fine; i++) {
        out[i] = (out[i] as number) + x * a;
        const nx = x * c - y * s;
        y = x * s + y * c;
        x = nx;
        a *= decadimento;
      }
    }
  }
  // batacchio: breve rumore scuro all'attacco
  const nb = Math.floor(sr * 0.025);
  let lp = 0;
  for (let i = 0; i < nb && i < n; i++) {
    lp += 0.3 * (rng() * 2 - 1 - lp);
    out[i] = (out[i] as number) + lp * 0.5 * (1 - i / nb);
  }
  // attacco morbido di 2 ms (niente clic) e sfumatura finale
  const na = Math.floor(sr * 0.002);
  for (let i = 0; i < na && i < n; i++) out[i] = (out[i] as number) * (i / na);
  const coda = Math.floor(sr * 0.3);
  for (let i = Math.max(0, n - coda); i < n; i++) out[i] = (out[i] as number) * ((n - i) / coda);
  const pk = picco(out) || 1;
  for (let i = 0; i < n; i++) out[i] = ((out[i] as number) / pk) * 0.9;
  return out;
}

/**
 * Coro di grilli lontani (stereo, ciclico): una dozzina di grilli con frequenze e
 * ritmi diversi, filtrati come se fossero a qualche decina di metri.
 */
export function sintetizzaCoroGrilli(sr: number, durata: number, seme: number): [Float32Array, Float32Array] {
  const rng = creaRng(seme);
  const n = Math.floor(durata * sr);
  const sx = new Float32Array(n);
  const dx = new Float32Array(n);
  const quanti = 12;
  for (let g = 0; g < quanti; g++) {
    const f = tra(rng, 3500, 4500);
    const periodoCanto = tra(rng, 0.45, 1.1);
    const impulsi = 2 + Math.floor(rng() * 3);
    const lungImpulso = tra(rng, 0.012, 0.02);
    const passoImpulso = lungImpulso * tra(rng, 1.6, 2.1);
    const amp = tra(rng, 0.15, 1);
    const pan = tra(rng, -0.9, 0.9);
    const gs = Math.cos(((pan + 1) * Math.PI) / 4);
    const gd = Math.sin(((pan + 1) * Math.PI) / 4);
    const w = (2 * Math.PI * f) / sr;
    let t0 = rng() * periodoCanto;
    while (t0 < durata) {
      for (let k = 0; k < impulsi; k++) {
        const ini = Math.floor((t0 + k * passoImpulso) * sr);
        const len = Math.floor(lungImpulso * sr);
        for (let i = 0; i < len; i++) {
          const j = (ini + i) % n; // avvolge: il ciclo resta continuo
          const env = Math.sin((Math.PI * i) / len);
          const v = Math.sin(w * i) * env * env * amp;
          sx[j] = (sx[j] as number) + v * gs;
          dx[j] = (dx[j] as number) + v * gd;
        }
      }
      t0 += periodoCanto * tra(rng, 0.92, 1.08);
    }
  }
  // distanza: passa-basso a un polo
  for (const ch of [sx, dx]) {
    let lp = 0;
    const a = (2 * Math.PI * 5200) / sr;
    for (let i = 0; i < n; i++) {
      lp += a * ((ch[i] as number) - lp);
      ch[i] = lp;
    }
  }
  const pk = Math.max(picco(sx), picco(dx)) || 1;
  for (const ch of [sx, dx]) for (let i = 0; i < n; i++) ch[i] = ((ch[i] as number) / pk) * 0.8;
  return [sx, dx];
}

/**
 * Risposta all'impulso del riverbero (stereo): rumore che decade in modo esponenziale
 * e si scurisce col tempo, come in una valle di pietra e legno.
 */
export function generaRispostaRiverbero(
  sr: number,
  secondi: number,
  seme: number,
): [Float32Array, Float32Array] {
  const n = Math.floor(sr * secondi);
  const canali: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  const tau = secondi / 6.9; // T60 ≈ secondi
  const predelay = Math.floor(sr * 0.018);
  canali.forEach((ch, c) => {
    const rng = creaRng(seme + c * 7919);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      if (i < predelay) continue;
      const t = (i - predelay) / sr;
      // il taglio scende da ~7 kHz a ~1,2 kHz lungo la coda
      const fc = 1200 + 5800 * Math.exp(-t / (tau * 0.8));
      const a = Math.min(1, (2 * Math.PI * fc) / sr);
      lp += a * (rng() * 2 - 1 - lp);
      const attacco = Math.min(1, t / 0.012);
      ch[i] = lp * Math.exp(-t / tau) * attacco;
    }
  });
  return canali;
}
