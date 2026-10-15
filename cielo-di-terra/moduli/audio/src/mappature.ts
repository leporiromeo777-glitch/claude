/**
 * Mappature dei parametri: funzioni pure che trasformano lo stato del gioco
 * (posizione, altezza, velocità, ora, zona) nei valori che guidano la sintesi.
 * Nessuna dipendenza dalla Web Audio API: sono coperte dai test Vitest.
 */
import {
  LAGO_STIMATO,
  LUNGHEZZA_CILINDRO,
  ORA_ACCENSIONE,
  ORA_BRACE,
  ORA_PIENA_LUCE,
  ORA_TRAMONTO,
  RAGGIO_INTERNO,
  SFUMATURA_FINESTRA_GRADI,
  ZONE,
  type DescrizioneZona,
} from './costanti';
import type { IdZona, StatoAudio, Vec3 } from './tipi';
import { limita, liscia, mescola, modulo, normalizza, punto, scala, vettoriale, lunghezza } from './util';

// ---------------------------------------------------------------------------
// Geometria del cilindro
// ---------------------------------------------------------------------------

/** Coordinate cilindriche di un punto del mondo (asse = Z). */
export interface Cilindriche {
  /** Angolo in gradi, 0-360, misurato come atan2(y, x). */
  theta: number;
  /** Distanza dall'asse in metri. */
  raggio: number;
  /** Altezza dal suolo (R - raggio), negativa sotto il suolo (il Guscio). */
  altezza: number;
  /** Posizione lungo l'asse, 0-3000. */
  z: number;
}

export function coordinateCilindriche(p: Vec3): Cilindriche {
  const raggio = Math.hypot(p.x, p.y);
  const theta = modulo((Math.atan2(p.y, p.x) * 180) / Math.PI, 360);
  return { theta, raggio, altezza: RAGGIO_INTERNO - raggio, z: p.z };
}

/** Copia di un vettore con le componenti non finite (NaN, ±Infinity) sostituite da 0. */
export function vettoreSicuro(p: Vec3): Vec3 {
  const f = (x: number): number => (Number.isFinite(x) ? x : 0);
  return { x: f(p.x), y: f(p.y), z: f(p.z) };
}

/** Il «su» locale nel cilindro: dal suolo verso l'asse (versore). */
export function suVersoAsse(p: Vec3): Vec3 {
  const r = Math.hypot(p.x, p.y);
  if (r < 1e-6) return { x: 0, y: 1, z: 0 };
  return { x: -p.x / r, y: -p.y / r, z: 0 };
}

/** Normalizza l'ora in [0, 24). */
export function normalizzaOra(ora: number): number {
  return modulo(Number.isFinite(ora) ? ora : 12, 24);
}

/** La zona (fascia angolare) che contiene θ. */
export function zonaDaTheta(theta: number): IdZona {
  const t = modulo(theta, 360);
  for (const z of ZONE) if (t >= z.da && t < z.a) return z.id;
  return 'valle-1';
}

/** Descrizione completa di una zona. */
export function descrizioneZona(id: IdZona): DescrizioneZona {
  return ZONE.find((z) => z.id === id) ?? (ZONE[0] as DescrizioneZona);
}

/**
 * Quanto si è «sopra una Finestra», 0-1, con una sfumatura di qualche grado ai bordi
 * (0,5 esattamente sul bordo). Serve a far calare dolcemente i suoni della valle.
 */
export function pesoFinestra(theta: number, sfumatura = SFUMATURA_FINESTRA_GRADI): number {
  const t = modulo(theta, 360);
  let dentro = -Infinity; // distanza con segno dal bordo più vicino (positiva dentro)
  for (const z of ZONE) {
    if (z.tipo !== 'finestra') continue;
    for (const spostamento of [-360, 0, 360]) {
      const x = t + spostamento;
      const d = Math.min(x - z.da, z.a - x);
      if (d > dentro) dentro = d;
    }
  }
  if (sfumatura <= 0) return dentro >= 0 ? 1 : 0;
  return liscia(-sfumatura / 2, sfumatura / 2, dentro);
}

// ---------------------------------------------------------------------------
// Mixer: curva dei cursori
// ---------------------------------------------------------------------------

/**
 * Curva percettiva dei cursori di volume: 0 → silenzio, 1 → guadagno pieno,
 * 0,5 → circa −12 dB. Valori fuori intervallo vengono limitati.
 */
export function volumeAGuadagno(v: number): number {
  const x = limita(Number.isFinite(v) ? v : 0, 0, 1);
  return x * x;
}

// ---------------------------------------------------------------------------
// Ascoltatore
// ---------------------------------------------------------------------------

/**
 * Rende ortonormale la coppia (avanti, su) per l'AudioListener: «su» viene
 * raddrizzato perpendicolare allo sguardo; se lo sguardo punta proprio verso l'asse
 * si sceglie un «su» qualunque perpendicolare, invece di una terna degenere.
 */
export function orientamentoAscoltatore(avanti: Vec3, su: Vec3): { avanti: Vec3; su: Vec3 } {
  const f = normalizza(avanti, { x: 0, y: 0, z: 1 });
  const u0 = normalizza(su, { x: 0, y: 1, z: 0 });
  let u = { x: u0.x - f.x * punto(u0, f), y: u0.y - f.y * punto(u0, f), z: u0.z - f.z * punto(u0, f) };
  if (lunghezza(u) < 1e-3) {
    // sguardo parallelo al «su»: prendo l'asse cartesiano meno allineato con lo sguardo
    const assi: Vec3[] = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ];
    let migliore = assi[0] as Vec3;
    for (const a of assi) if (Math.abs(punto(a, f)) < Math.abs(punto(migliore, f))) migliore = a;
    u = vettoriale(vettoriale(f, migliore), f);
  }
  return { avanti: f, su: scala(u, 1 / lunghezza(u)) };
}

// ---------------------------------------------------------------------------
// Vento e volo
// ---------------------------------------------------------------------------

export interface ParametriVento {
  /** Guadagno complessivo del vento. */
  guadagno: number;
  /** Frequenza di taglio del passa-basso del «corpo» del vento (Hz). */
  tagliaCorpo: number;
  /** Centro del passa-banda del sibilo (Hz). */
  centroFischio: number;
  /** Risonanza del sibilo (bassa: il sibilo resta morbido). */
  qFischio: number;
  /** Guadagno del sibilo. */
  guadagnoFischio: number;
  /** Profondità delle raffiche, 0-1. */
  raffiche: number;
  /** Intensità astratta 0-1,25 (utile per la demo). */
  intensita: number;
}

/** Il vento cresce con l'altezza dal suolo e con la velocità di volo. */
export function parametriVento(altezza: number, velocita: number): ParametriVento {
  const h = Math.max(0, Number.isFinite(altezza) ? altezza : 0);
  const quota = 1 - Math.exp(-h / 80);
  const v = limita((Number.isFinite(velocita) ? Math.abs(velocita) : 0) / 22, 0, 1.6);
  const intensita = limita(0.18 + 0.42 * quota + 0.55 * Math.pow(v, 1.2), 0, 1.25);
  return {
    intensita,
    guadagno: 0.3 * Math.pow(intensita, 1.15),
    tagliaCorpo: 220 + 1100 * intensita,
    centroFischio: 550 + 700 * intensita + 300 * Math.min(v, 1.2),
    qFischio: 0.8 + 1.4 * quota,
    guadagnoFischio: 0.16 * liscia(0.25, 1.1, intensita),
    raffiche: 0.2 + 0.45 * quota,
  };
}

export interface ParametriVolo {
  /** Guadagno del fruscio del Velo (0 se chiuso). */
  guadagno: number;
  /** Frequenza del battito della stoffa (Hz). */
  battito: number;
  /** Centro del passa-banda della stoffa (Hz). */
  centro: number;
}

/** Il fruscio del Velo in planata: più veloce, più battente e più chiaro. */
export function parametriVolo(velocita: number, inVolo: boolean): ParametriVolo {
  const v = limita((Number.isFinite(velocita) ? Math.abs(velocita) : 0) / 20, 0, 1.6);
  return {
    guadagno: inVolo ? 0.05 + 0.2 * liscia(0, 1.2, v) : 0,
    battito: 3 + 9 * Math.min(v, 1.5),
    centro: 900 + 1400 * Math.min(v, 1.4),
  };
}

// ---------------------------------------------------------------------------
// La Linea
// ---------------------------------------------------------------------------

export interface ParametriLinea {
  /** 0 di notte, 1 in pieno giorno. */
  luce: number;
  /** 1 quando la Linea è brace (notte), 0 di giorno. */
  brace: number;
  /** Guadagno del ronzio. */
  guadagno: number;
  /** Fondamentale del ronzio (Hz): La1 di giorno, Sol1 alla brace. */
  frequenza: number;
  /** Taglio del passa-basso: più chiaro di giorno, scuro e caldo di notte (Hz). */
  taglio: number;
  /** Profondità del lento «respiro» della brace, 0-1. */
  respiro: number;
}

/** Quanto è accesa la Linea a una certa ora (0-1). */
export function luceLinea(ora: number): number {
  const h = normalizzaOra(ora);
  return liscia(ORA_ACCENSIONE, ORA_PIENA_LUCE, h) * (1 - liscia(ORA_TRAMONTO, ORA_BRACE, h));
}

/**
 * Il ronzio basso e caldo della Linea: si accende all'alba, è pieno di giorno,
 * diventa brace (più grave, più scuro, con un respiro lento) di notte.
 * Più ci si avvicina all'asse, più si sente.
 */
export function parametriLinea(ora: number, altezza = 0): ParametriLinea {
  const luce = luceLinea(ora);
  const vicinanza = liscia(50, 600, Math.max(0, altezza));
  return {
    luce,
    brace: 1 - luce,
    guadagno: (0.02 + 0.022 * luce) * (1 + 1.2 * vicinanza),
    frequenza: mescola(49, 55, luce),
    taglio: mescola(170, 650, luce) + 300 * vicinanza,
    respiro: mescola(0.35, 0.08, luce),
  };
}

// ---------------------------------------------------------------------------
// Uccelli e grilli
// ---------------------------------------------------------------------------

/** Densità del canto degli uccelli secondo l'ora: coro all'alba, più rado di giorno, nulla di notte. */
export function intensitaUccelli(ora: number): number {
  const h = normalizzaOra(ora);
  const alba = liscia(4.8, 6.3, h) * (1 - liscia(6.8, 9.5, h));
  const giorno = liscia(5.5, 8, h) * (1 - liscia(18.8, 20.2, h));
  const sera = liscia(17, 18.3, h) * (1 - liscia(19, 20, h));
  return limita(Math.max(alba, 0.55 * giorno) + 0.2 * sera, 0, 1);
}

/** Densità dei grilli: dalla brace fino a poco prima dell'alba. */
export function intensitaGrilli(ora: number): number {
  const h = normalizzaOra(ora);
  return h >= 12 ? liscia(19, 21, h) : 1 - liscia(3.5, 5.5, h);
}

/** Uccelli e grilli vivono nelle valli, al suolo: calano sulle Finestre e salendo in quota. */
export function parametriFauna(
  ora: number,
  pesoValle: number,
  altezza: number,
): { uccelli: number; grilli: number } {
  const quota = 1 - liscia(40, 220, Math.max(0, altezza));
  const k = limita(pesoValle, 0, 1) * quota;
  return { uccelli: intensitaUccelli(ora) * k, grilli: intensitaGrilli(ora) * k };
}

// ---------------------------------------------------------------------------
// Lago, Sordo, Finestre
// ---------------------------------------------------------------------------

/** Stima grossolana della distanza dal lago (usata solo se il gioco non la passa). */
export function distanzaLagoStimata(theta: number, z: number, altezza: number): number {
  const t = modulo(theta, 360);
  const dTheta = Math.max(0, LAGO_STIMATO.thetaDa - t, t - LAGO_STIMATO.thetaA);
  const arco = (dTheta * Math.PI * RAGGIO_INTERNO) / 180;
  const dz = Math.max(0, LAGO_STIMATO.zDa - z, z - LAGO_STIMATO.zA);
  return Math.hypot(arco, dz, Math.max(0, altezza));
}

/** L'acqua che lambisce si sente vicino alla riva: piena entro 8 m, nulla oltre 150 m. */
export function pesoLago(distanza: number): number {
  return 1 - liscia(8, 150, Math.max(0, distanza));
}

/** Distanza stimata dal piede del Sordo (il Tappo Nord). */
export function distanzaSordoStimata(z: number): number {
  return Math.max(0, LUNGHEZZA_CILINDRO - z);
}

/** Il rombo «come di treno» della Ruota: comincia a 1300 m dal Sordo e cresce avvicinandosi. */
export function pesoSordo(distanza: number): number {
  return Math.pow(1 - liscia(60, 1300, Math.max(0, distanza)), 1.6);
}

/** Sulle Finestre i suoni della valle quasi spariscono: resta il 6%. */
export function attenuazioneValle(pesoFin: number): number {
  return 1 - 0.94 * limita(pesoFin, 0, 1);
}

// ---------------------------------------------------------------------------
// Tutto insieme
// ---------------------------------------------------------------------------

/** Tutti i parametri derivati dallo stato, in un colpo solo. */
export interface ParametriAmbiente {
  ora: number;
  altezza: number;
  velocita: number;
  inVolo: boolean;
  theta: number;
  z: number;
  zona: IdZona;
  pesoFinestra: number;
  pesoValle: number;
  pesoLago: number;
  pesoSordo: number;
  /** 0 di giorno, 1 di notte piena. */
  notte: number;
  fadeVicine: number;
  vento: ParametriVento;
  volo: ParametriVolo;
  linea: ParametriLinea;
  fauna: { uccelli: number; grilli: number };
  /** Fattore che abbassa i suoni della valle sopra le Finestre. */
  duckValle: number;
}

export function calcolaParametriAmbiente(stato: StatoAudio): ParametriAmbiente {
  const cil = coordinateCilindriche(vettoreSicuro(stato.posizione));
  const theta = stato.theta !== undefined && Number.isFinite(stato.theta) ? modulo(stato.theta, 360) : cil.theta;
  const altezza = stato.altezza !== undefined && Number.isFinite(stato.altezza) ? stato.altezza : cil.altezza;
  const ora = normalizzaOra(stato.ora);
  const velocita = Number.isFinite(stato.velocita) ? Math.abs(stato.velocita) : 0;
  const inVolo = stato.inVolo === true;
  const zona = stato.zona ?? zonaDaTheta(theta);
  // Se il gioco dichiara la zona, la fascia sonora la segue; altrimenti si sfuma con θ.
  const pFin =
    stato.zona !== undefined && stato.theta === undefined
      ? descrizioneZona(stato.zona).tipo === 'finestra'
        ? 1
        : 0
      : pesoFinestra(theta);
  const pValle = 1 - pFin;
  const dLago = Number.isFinite(stato.distanzaLago) ? (stato.distanzaLago as number) : distanzaLagoStimata(theta, cil.z, altezza);
  const dSordo = Number.isFinite(stato.distanzaSordo) ? (stato.distanzaSordo as number) : distanzaSordoStimata(cil.z);
  const linea = parametriLinea(ora, altezza);
  return {
    ora,
    altezza,
    velocita,
    inVolo,
    theta,
    z: cil.z,
    zona,
    pesoFinestra: pFin,
    pesoValle: pValle,
    pesoLago: pesoLago(dLago) * pValle,
    pesoSordo: pesoSordo(dSordo),
    notte: linea.brace,
    fadeVicine: Number.isFinite(stato.fadeVicine) ? limita(stato.fadeVicine as number, 0, 1) : 0,
    vento: parametriVento(altezza, velocita),
    volo: parametriVolo(velocita, inVolo),
    linea,
    fauna: parametriFauna(ora, pValle, altezza),
    duckValle: attenuazioneValle(pFin),
  };
}

/**
 * Vero se, passando da `prima` a `dopo` (ore di gioco), si è attraversata l'ora `soglia`.
 * Gestisce il giro di mezzanotte e ignora i salti all'indietro e quelli troppo lunghi
 * (caricamenti, teletrasporti: più di 2 ore).
 */
export function haAttraversato(prima: number, dopo: number, soglia: number): boolean {
  const a = normalizzaOra(prima);
  let b = normalizzaOra(dopo);
  if (b < a) b += 24;
  if (b - a <= 0 || b - a > 2) return false;
  const s = normalizzaOra(soglia);
  return (s > a && s <= b) || (s + 24 > a && s + 24 <= b);
}
