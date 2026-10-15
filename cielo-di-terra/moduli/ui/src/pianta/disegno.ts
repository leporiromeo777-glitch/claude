/**
 * Disegno della Pianta del Verbano su canvas 2D: carta, matita, inchiostro e acquerello.
 * Il pittore tiene in cache le maschere della griglia e i contorni; `disegna()` rifà il foglio a ogni cambio di vista.
 */
import { casuale } from '../core/dom';
import {
  FASCE_VERBANO,
  LUNGHEZZA_Z,
  METRI_PER_GRADO,
  ampiezza,
  aSchermo,
  copieVisibili,
  daSchermo,
  normalizzaGradi,
  type FasciaPianta,
  type Vista,
} from './geometria';
import { ModelloPianta, type CaposaldoPianta, type DatiPianta, type ParticellaPianta } from './modello';

/** Margini del foglio occupati dai righelli (px CSS). */
export const MARGINI = { sinistra: 70, destra: 70, alto: 50, basso: 46 } as const;
/** Larghezza dei Tappi disegnati ai lati del cilindro (px CSS, alla scala intera). */
export const LARGHEZZA_TAPPO = 64;

export interface OpzioniDisegno {
  posizione: boolean;
  contrasto: boolean;
  /** Matita marcata (accessibilità): tratteggio e contorni a matita più scuri. */
  marcata?: boolean;
  /** Id della particella sotto il mouse (ripassata). */
  evidenzia?: string | null;
}

const COLORI = {
  carta: '#f1e8d2',
  inchiostro: '#2a231c',
  inchiostro2: '#4a3e33',
  matita: '#5d5a54',
  matitaChiara: 'rgba(93, 90, 84, 0.55)',
  griglia: 'rgba(84, 116, 150, 0.16)',
  grigliaForte: 'rgba(84, 116, 150, 0.3)',
  notte: '#221c33',
  ottone: '#b4904f',
  vermiglio: '#a63a26',
} as const;

/** Colori dell'acquerello [r, g, b] per terreno e salute. */
const ACQUERELLO = {
  verde: [128, 156, 96],
  terra: [140, 162, 104],
  bruno: [170, 118, 70],
  grigio: [150, 146, 158],
  acqua: [86, 150, 142],
  roccia: [160, 152, 166],
  abitato: [196, 152, 96],
} as const;

function coloreCella(terreno: number, salute: number): readonly [number, number, number] {
  if (terreno === 1) return ACQUERELLO.acqua;
  if (salute === 2) return ACQUERELLO.bruno;
  if (salute === 3) return ACQUERELLO.grigio;
  if (terreno === 2) return ACQUERELLO.roccia;
  if (terreno === 3) return ACQUERELLO.abitato;
  if (salute === 1) return ACQUERELLO.verde;
  return ACQUERELLO.terra;
}

function nuovoCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Hash di un punto del mondo arrotondato: lo stesso vertice trema sempre allo stesso modo. */
function tremolio(z: number, t: number, seme: number): [number, number] {
  let h = Math.imul(Math.round(z * 4) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(t * 40) + seme, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return [((h & 0xffff) / 0xffff - 0.5) * 2, (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 2];
}

export class PittorePianta {
  private readonly ctx: CanvasRenderingContext2D;
  private modello = new ModelloPianta(75, 96);
  private dati: DatiPianta = { capisaldi: [] };
  private fasce: readonly FasciaPianta[] = FASCE_VERBANO;
  private maschere: { matita: HTMLCanvasElement; colore: HTMLCanvasElement; cambiate: HTMLCanvasElement } | null = null;
  private contornoMatita: Float32Array = new Float32Array(0);
  private contornoInchiostro: Float32Array = new Float32Array(0);
  private contornoCambiate: Float32Array = new Float32Array(0);
  private strato: HTMLCanvasElement = nuovoCanvas(1, 1);
  private readonly motivi: { carta: CanvasPattern | null; tratteggio: CanvasPattern | null; rosso: CanvasPattern | null; tappo: CanvasPattern | null; grana: CanvasPattern | null };
  private dpr = 1;
  private larghezza = 1;
  private altezza = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('[ui] canvas 2D non disponibile per la Pianta');
    this.ctx = ctx;
    this.motivi = {
      carta: this.motivoCarta(),
      tratteggio: this.motivoTratteggio(COLORI.matita, 0.62, 9, 1),
      rosso: this.motivoTratteggio(COLORI.vermiglio, 0.55, 7, -1),
      tappo: this.motivoTratteggio(COLORI.matita, 0.5, 5, 1),
      grana: this.motivoGrana(),
    };
  }

  /** Dimensioni CSS dell'area di disegno. */
  get misure(): { larghezza: number; altezza: number } {
    return { larghezza: this.larghezza, altezza: this.altezza };
  }

  /** Larghezza della regione della carta (senza righelli). */
  get larghezzaRegione(): number {
    return Math.max(10, this.larghezza - MARGINI.sinistra - MARGINI.destra);
  }

  get altezzaRegione(): number {
    return Math.max(10, this.altezza - MARGINI.alto - MARGINI.basso);
  }

  /** Larghezza utile per il cilindro (senza i Tappi), per la scala intera. */
  get larghezzaUtile(): number {
    return Math.max(10, this.larghezzaRegione - 2 * LARGHEZZA_TAPPO);
  }

  get modelloCorrente(): ModelloPianta {
    return this.modello;
  }

  /** Ridimensiona il canvas (dimensioni CSS e rapporto dei pixel). */
  ridimensiona(larghezza: number, altezza: number, dpr: number): void {
    this.larghezza = Math.max(1, Math.round(larghezza));
    this.altezza = Math.max(1, Math.round(altezza));
    this.dpr = Math.max(1, Math.min(3, dpr));
    this.canvas.width = Math.round(this.larghezza * this.dpr);
    this.canvas.height = Math.round(this.altezza * this.dpr);
    this.strato = nuovoCanvas(this.canvas.width, this.canvas.height);
  }

  /** Nuovi dati: ricostruisce maschere e contorni. */
  impostaDati(dati: DatiPianta): void {
    this.dati = dati;
    this.fasce = dati.fasce ?? FASCE_VERBANO;
    this.modello = ModelloPianta.da(dati);
    const m = this.modello;
    const matita = nuovoCanvas(m.nZ, m.nTheta);
    const colore = nuovoCanvas(m.nZ, m.nTheta);
    const cambiate = nuovoCanvas(m.nZ, m.nTheta);
    const im = new ImageData(m.nZ, m.nTheta);
    const ic = new ImageData(m.nZ, m.nTheta);
    const ir = new ImageData(m.nZ, m.nTheta);
    for (let iz = 0; iz < m.nZ; iz++) {
      for (let it = 0; it < m.nTheta; it++) {
        const i = iz * m.nTheta + it;
        // θ cresce verso l'alto: la riga 0 dell'immagine è l'ultima fascia di θ.
        const p = ((m.nTheta - 1 - it) * m.nZ + iz) * 4;
        const s = m.stati[i]!;
        if (s === 1) im.data[p + 3] = 255;
        if (s >= 2) {
          const [r, g, b] = coloreCella(m.terreno[i]!, m.salute[i]!);
          ic.data[p] = r;
          ic.data[p + 1] = g;
          ic.data[p + 2] = b;
          ic.data[p + 3] = 255;
        }
        if (m.cambiate[i]) ir.data[p + 3] = 255;
      }
    }
    matita.getContext('2d')!.putImageData(im, 0, 0);
    colore.getContext('2d')!.putImageData(ic, 0, 0);
    cambiate.getContext('2d')!.putImageData(ir, 0, 0);
    this.maschere = { matita, colore, cambiate };
    this.contornoMatita = m.contorni(1);
    this.contornoInchiostro = m.contorni(2);
    this.contornoCambiate = m.contorni(1, m.cambiate);
  }

  /** Coordinate del mondo sotto un punto del canvas (px CSS), o null fuori dalla regione. */
  mondoIn(vista: Vista, x: number, y: number): { z: number; theta: number } | null {
    const rx = x - MARGINI.sinistra;
    const ry = y - MARGINI.alto;
    if (rx < 0 || ry < 0 || rx > this.larghezzaRegione || ry > this.altezzaRegione) return null;
    const [z, t] = daSchermo(vista, this.larghezzaRegione, this.altezzaRegione, rx, ry);
    return { z, theta: t };
  }

  /** Particella con nome sotto (z, θ), se c'è. */
  particellaIn(z: number, theta: number): ParticellaPianta | undefined {
    const t = normalizzaGradi(theta);
    return this.dati.particelle?.find((p) => {
      if (p.contorno) return false;
      return z >= Math.min(p.z0, p.z1) && z <= Math.max(p.z0, p.z1) && normalizzaGradi(t - p.theta0) <= ampiezza(p.theta0, p.theta1);
    });
  }

  /** Disegna tutto il foglio. */
  disegna(vista: Vista, opz: OpzioniDisegno): void {
    const { ctx } = this;
    const W = this.larghezzaRegione;
    const H = this.altezzaRegione;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.larghezza, this.altezza);

    // Fondo di carta su tutto il canvas.
    ctx.fillStyle = COLORI.carta;
    ctx.fillRect(0, 0, this.larghezza, this.altezza);
    if (this.motivi.carta && !opz.contrasto) {
      ctx.fillStyle = this.motivi.carta;
      ctx.fillRect(0, 0, this.larghezza, this.altezza);
    }

    ctx.save();
    ctx.translate(MARGINI.sinistra, MARGINI.alto);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    const [tAlto, tBasso] = [daSchermo(vista, W, H, 0, 0)[1], daSchermo(vista, W, H, 0, H)[1]];
    const tMin = Math.min(tAlto, tBasso);
    const tMax = Math.max(tAlto, tBasso);
    const xZ = (z: number): number => aSchermo(vista, W, H, z, 0)[0];
    const yT = (t: number): number => aSchermo(vista, W, H, 0, t)[1];

    this.disegnaTappi(vista, W, H, xZ);
    this.disegnaReticolo(vista, W, H, tMin, tMax, xZ, yT);
    this.disegnaMaschere(vista, W, H, tMin, tMax, xZ, yT, opz);
    this.disegnaFinestre(tMin, tMax, xZ, yT);
    this.disegnaContorni(this.contornoMatita, tMin, tMax, xZ, yT, {
      colore: opz.marcata || opz.contrasto ? '#2f2d29' : COLORI.matita,
      spessore: opz.marcata ? 1.7 : 1,
      doppio: true,
      ampiezza: 1.1,
      seme: 3,
    });
    this.disegnaContorni(this.contornoInchiostro, tMin, tMax, xZ, yT, { colore: COLORI.inchiostro, spessore: 1.5, doppio: false, ampiezza: 0.6, seme: 7 });
    this.disegnaContorni(this.contornoCambiate, tMin, tMax, xZ, yT, { colore: COLORI.vermiglio, spessore: 1.6, doppio: true, ampiezza: 1.2, seme: 11 });
    this.disegnaParticelle(tMin, tMax, xZ, yT, opz.evidenzia ?? null);
    this.disegnaNomiFasce(vista, W, H, tMin, tMax, xZ, yT);
    this.disegnaLuoghi(tMin, tMax, xZ, yT);
    this.disegnaLati(tMin, tMax, xZ, yT);
    this.disegnaCapisaldi(tMin, tMax, xZ, yT);
    if (opz.posizione && this.dati.elvira) this.disegnaElvira(tMin, tMax, xZ, yT);
    ctx.restore();

    this.disegnaRighelli(vista, W, H, tMin, tMax, xZ, yT);
    this.disegnaVignetta();
  }

  // ---------- strati ----------

  private disegnaTappi(vista: Vista, _W: number, H: number, xZ: (z: number) => number): void {
    const { ctx } = this;
    const larg = LARGHEZZA_TAPPO * Math.max(1, vista.scala / (this.larghezzaUtile / LUNGHEZZA_Z));
    const x0 = xZ(0);
    const x1 = xZ(LUNGHEZZA_Z);
    ctx.save();
    if (this.motivi.tappo) ctx.fillStyle = this.motivi.tappo;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x0 - larg, 0, larg, H);
    ctx.fillRect(x1, 0, larg, H);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORI.inchiostro;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0, H);
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, H);
    ctx.stroke();
    // Etichette verticali dei Tappi.
    ctx.fillStyle = COLORI.inchiostro2;
    ctx.font = '400 17px "IM Fell English SC", "EB Garamond", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const etichetta = (x: number, testo: string, rot: number): void => {
      ctx.save();
      ctx.translate(x, H / 2);
      ctx.rotate(rot);
      this.testoConAlone(spaziato(testo, 1), 0, 0, COLORI.carta, 5);
      ctx.restore();
    };
    etichetta(x0 - larg / 2, 'Tappo Sud · a Mont', -Math.PI / 2);
    etichetta(x1 + larg / 2, 'Il Sordo · Tappo Nord · a Lag', Math.PI / 2);
    ctx.restore();
    this.disegnaLanterna(H, xZ, larg);
  }

  private disegnaReticolo(vista: Vista, W: number, H: number, tMin: number, tMax: number, xZ: (z: number) => number, yT: (t: number) => number): void {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = 1;
    const passoZ = vista.scala * 250 < 40 ? 500 : 250;
    for (let z = 0; z <= LUNGHEZZA_Z; z += passoZ) {
      ctx.strokeStyle = z % 1000 === 0 ? COLORI.grigliaForte : COLORI.griglia;
      const x = Math.round(xZ(z)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    const passoT = vista.scala * METRI_PER_GRADO * 15 < 40 ? 30 : 15;
    const x0 = xZ(0);
    const x1 = xZ(LUNGHEZZA_Z);
    for (let t = Math.floor(tMin / passoT) * passoT; t <= tMax; t += passoT) {
      ctx.strokeStyle = normalizzaGradi(t) % 90 === 0 ? COLORI.grigliaForte : COLORI.griglia;
      const y = Math.round(yT(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.max(0, x0), y);
      ctx.lineTo(Math.min(W, x1), y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private disegnaMaschere(
    vista: Vista,
    W: number,
    H: number,
    tMin: number,
    tMax: number,
    xZ: (z: number) => number,
    yT: (t: number) => number,
    opz: OpzioniDisegno,
  ): void {
    const m = this.maschere;
    if (!m) return;
    const { ctx } = this;
    const strato = this.strato;
    const sc = strato.getContext('2d')!;
    const copie = copieVisibili(0, 360, tMin, tMax);
    const x0 = xZ(0);
    const x1 = xZ(LUNGHEZZA_Z);
    const disegnaMaschera = (c: CanvasRenderingContext2D, img: HTMLCanvasElement): void => {
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      for (const k of copie) {
        const yTop = yT(360 + k);
        const yBot = yT(0 + k);
        c.drawImage(img, x0, yTop, x1 - x0, yBot - yTop);
      }
    };
    const preparaStrato = (): void => {
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.globalCompositeOperation = 'source-over';
      sc.globalAlpha = 1;
      sc.clearRect(0, 0, strato.width, strato.height);
      sc.setTransform(this.dpr, 0, 0, this.dpr, MARGINI.sinistra * this.dpr, MARGINI.alto * this.dpr);
    };
    const versaStrato = (alpha: number, modo: GlobalCompositeOperation = 'source-over'): void => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = modo;
      ctx.drawImage(strato, 0, 0);
      ctx.restore();
    };

    // 1. Matita: tratteggio di grafite dove la particella è stata vista.
    preparaStrato();
    if (this.motivi.tratteggio) {
      sc.fillStyle = this.motivi.tratteggio;
      sc.fillRect(0, 0, W, H);
      sc.globalCompositeOperation = 'destination-in';
      disegnaMaschera(sc, m.matita);
      versaStrato(opz.contrasto || opz.marcata ? 1 : 0.75);
      if (opz.marcata) versaStrato(0.5);
    }

    // 2. Acquerello: colore morbido, grana della carta, bordi più carichi.
    preparaStrato();
    disegnaMaschera(sc, m.colore);
    if (this.motivi.grana) {
      sc.globalCompositeOperation = 'source-atop';
      sc.fillStyle = this.motivi.grana;
      sc.fillRect(0, 0, W, H);
    }
    sc.globalCompositeOperation = 'source-atop';
    sc.lineWidth = Math.max(3, 0.18 * vista.scala * 40);
    sc.strokeStyle = 'rgba(70, 60, 40, 0.18)';
    this.tracciaSegmenti(sc, this.contornoInchiostro, tMin, tMax, xZ, yT, 0, 0);
    sc.stroke();
    versaStrato(0.82, 'multiply');

    // 3. Resoconto del mattino: tratteggio rosso sulle particelle cambiate nella notte.
    preparaStrato();
    if (this.motivi.rosso) {
      sc.fillStyle = this.motivi.rosso;
      sc.fillRect(0, 0, W, H);
      sc.globalCompositeOperation = 'destination-in';
      disegnaMaschera(sc, m.cambiate);
      versaStrato(0.8);
    }
  }

  private disegnaFinestre(tMin: number, tMax: number, xZ: (z: number) => number, yT: (t: number) => number): void {
    const { ctx } = this;
    const x0 = xZ(0);
    const x1 = xZ(LUNGHEZZA_Z);
    for (const f of this.fasce) {
      if (f.tipo !== 'finestra') continue;
      const amp = ampiezza(f.theta0, f.theta1);
      for (const k of copieVisibili(f.theta0, amp, tMin, tMax)) {
        const yA = yT(f.theta0 + amp + k);
        const yB = yT(f.theta0 + k);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, yA, x1 - x0, yB - yA);
        ctx.clip();
        const grad = ctx.createLinearGradient(0, yA, 0, yB);
        grad.addColorStop(0, '#2a2340');
        grad.addColorStop(0.5, COLORI.notte);
        grad.addColorStop(1, '#2a2340');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x0, yA, x1 - x0, yB - yA);
        ctx.globalAlpha = 1;
        // Stelle: puntini fissi.
        const r = casuale(Math.round(f.theta0 * 31 + 7));
        ctx.fillStyle = 'rgba(255, 252, 238, 0.85)';
        const n = Math.round(((x1 - x0) * (yB - yA)) / 900);
        for (let i = 0; i < n; i++) {
          const sx = x0 + r() * (x1 - x0);
          const sy = yA + r() * (yB - yA);
          const sr = r() < 0.08 ? 1.3 : 0.6;
          ctx.fillRect(sx, sy, sr, sr);
        }
        // Costoloni: archi di ferro ogni 100 m.
        ctx.strokeStyle = 'rgba(180, 144, 79, 0.42)';
        ctx.lineWidth = 1;
        for (let z = 100; z < LUNGHEZZA_Z; z += 100) {
          const x = Math.round(xZ(z)) + 0.5;
          ctx.beginPath();
          ctx.moveTo(x, yA);
          ctx.lineTo(x, yB);
          ctx.stroke();
        }
        // Bordi dei costoloni maestri.
        ctx.strokeStyle = COLORI.inchiostro;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x0, yA + 0.5);
        ctx.lineTo(x1, yA + 0.5);
        ctx.moveTo(x0, yB - 0.5);
        ctx.lineTo(x1, yB - 0.5);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private tracciaSegmenti(
    c: CanvasRenderingContext2D,
    seg: Float32Array,
    tMin: number,
    tMax: number,
    xZ: (z: number) => number,
    yT: (t: number) => number,
    ampiezzaTremolio: number,
    seme: number,
  ): void {
    c.beginPath();
    const margine = 360 / 96;
    for (const k of copieVisibili(-margine, 360 + 2 * margine, tMin, tMax)) {
      for (let i = 0; i < seg.length; i += 4) {
        const z1 = seg[i]!;
        const t1 = seg[i + 1]! + k;
        const z2 = seg[i + 2]!;
        const t2 = seg[i + 3]! + k;
        if (Math.max(t1, t2) < tMin - 1 || Math.min(t1, t2) > tMax + 1) continue;
        const [a1, b1] = ampiezzaTremolio ? tremolio(z1, seg[i + 1]!, seme) : [0, 0];
        const [a2, b2] = ampiezzaTremolio ? tremolio(z2, seg[i + 3]!, seme) : [0, 0];
        c.moveTo(xZ(z1) + a1 * ampiezzaTremolio, yT(t1) + b1 * ampiezzaTremolio);
        c.lineTo(xZ(z2) + a2 * ampiezzaTremolio, yT(t2) + b2 * ampiezzaTremolio);
      }
    }
  }

  private disegnaContorni(
    seg: Float32Array,
    tMin: number,
    tMax: number,
    xZ: (z: number) => number,
    yT: (t: number) => number,
    stile: { colore: string; spessore: number; doppio: boolean; ampiezza: number; seme: number },
  ): void {
    if (!seg.length) return;
    const { ctx } = this;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stile.colore;
    ctx.lineWidth = stile.spessore;
    this.tracciaSegmenti(ctx, seg, tMin, tMax, xZ, yT, stile.ampiezza, stile.seme);
    ctx.stroke();
    if (stile.doppio) {
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = stile.spessore * 0.7;
      this.tracciaSegmenti(ctx, seg, tMin, tMax, xZ, yT, stile.ampiezza * 1.8, stile.seme + 1);
      ctx.stroke();
    }
    ctx.restore();
  }

  private disegnaParticelle(tMin: number, tMax: number, xZ: (z: number) => number, yT: (t: number) => number, evidenzia: string | null): void {
    const lista = this.dati.particelle;
    if (!lista?.length) return;
    const { ctx } = this;
    ctx.save();
    for (const p of lista) {
      if (p.stato === 'bianco' && p.id !== evidenzia) continue;
      const amp = p.contorno ? 0 : ampiezza(p.theta0, p.theta1);
      const base = p.contorno ? p.contorno[0]![1] : p.theta0;
      const ampVis = p.contorno ? 360 : amp;
      for (const k of copieVisibili(base - (p.contorno ? 180 : 0), ampVis, tMin, tMax)) {
        ctx.beginPath();
        if (p.contorno) {
          p.contorno.forEach(([z, t], i) => {
            const tt = base + (((t - base + 540) % 360) - 180) + k;
            if (i === 0) ctx.moveTo(xZ(z), yT(tt));
            else ctx.lineTo(xZ(z), yT(tt));
          });
          ctx.closePath();
        } else {
          const xa = xZ(Math.min(p.z0, p.z1));
          const xb = xZ(Math.max(p.z0, p.z1));
          const ya = yT(p.theta0 + amp + k);
          const yb = yT(p.theta0 + k);
          ctx.rect(xa, ya, xb - xa, yb - ya);
        }
        if (p.id === evidenzia) {
          ctx.fillStyle = 'rgba(42, 35, 28, 0.08)';
          ctx.fill();
          ctx.setLineDash([]);
          ctx.strokeStyle = COLORI.inchiostro;
          ctx.lineWidth = 2;
        } else if (p.cambiata) {
          ctx.setLineDash([5, 3]);
          ctx.strokeStyle = COLORI.vermiglio;
          ctx.lineWidth = 1.4;
        } else {
          ctx.setLineDash(p.stato === 'rilevato' ? [] : [3, 3]);
          ctx.strokeStyle = p.stato === 'rilevato' ? 'rgba(42, 35, 28, 0.55)' : COLORI.matitaChiara;
          ctx.lineWidth = 0.8;
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private disegnaNomiFasce(vista: Vista, W: number, _H: number, tMin: number, tMax: number, xZ: (z: number) => number, yT: (t: number) => number): void {
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x0 = Math.max(xZ(0), 0);
    const x1 = Math.min(xZ(LUNGHEZZA_Z), W);
    const xc = (x0 + x1) / 2;
    const corpoValle = Math.round(Math.min(30, Math.max(17, vista.scala * 48)));
    for (const f of this.fasce) {
      const amp = ampiezza(f.theta0, f.theta1);
      for (const k of copieVisibili(f.theta0, amp, tMin, tMax)) {
        const y = yT(f.theta0 + amp / 2 + k);
        if (f.tipo === 'valle') {
          ctx.font = `400 ${corpoValle}px "IM Fell English SC", "EB Garamond", serif`;
          ctx.fillStyle = 'rgba(42, 35, 28, 0.78)';
          this.testoConAlone(spaziato(f.nome, corpoValle > 22 ? 3 : 2), xc, y, 'rgba(241, 232, 210, 0.85)', 6);
          if (f.breve) {
            ctx.font = `italic 400 ${Math.round(corpoValle * 0.62)}px "EB Garamond", serif`;
            ctx.fillStyle = 'rgba(42, 35, 28, 0.7)';
            this.testoConAlone(f.breve, xc, y + corpoValle * 0.95, 'rgba(241, 232, 210, 0.85)', 4);
          }
        } else {
          ctx.font = '400 16px "IM Fell English SC", "EB Garamond", serif';
          ctx.fillStyle = 'rgba(241, 232, 210, 0.92)';
          const passo = Math.max(500, (x1 - x0) / vista.scala / 3);
          for (let z = passo / 2; z < LUNGHEZZA_Z; z += passo) {
            const x = xZ(z);
            if (x < 40 || x > W - 40) continue;
            ctx.fillText(spaziato(f.nome, 2), x, y);
          }
        }
      }
    }
    ctx.restore();
  }

  private disegnaLuoghi(tMin: number, tMax: number, xZ: (z: number) => number, yT: (t: number) => number): void {
    const luoghi = this.dati.luoghi;
    if (!luoghi?.length) return;
    const { ctx } = this;
    ctx.save();
    ctx.font = 'italic 500 16px "EB Garamond", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const l of luoghi) {
      const visibile = l.visibile ?? this.modello.statoIn(l.z, l.theta) >= 2;
      if (!visibile) continue;
      for (const k of copieVisibili(l.theta, 0, tMin - 2, tMax + 2)) {
        const x = xZ(l.z);
        const y = yT(l.theta + k);
        ctx.fillStyle = COLORI.inchiostro;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        this.testoConAlone(l.nome, x + 6, y - 1, 'rgba(241, 232, 210, 0.9)', 4);
      }
    }
    ctx.restore();
  }

  private disegnaCapisaldi(tMin: number, tMax: number, xZ: (z: number) => number, yT: (t: number) => number): void {
    const { ctx } = this;
    ctx.save();
    ctx.textBaseline = 'middle';
    for (const c of this.dati.capisaldi) {
      if (!c.rilevato && !c.visto) continue;
      for (const k of copieVisibili(c.theta, 0, tMin - 2, tMax + 2)) {
        this.simboloCaposaldo(c, xZ(c.z), yT(c.theta + k));
      }
    }
    ctx.restore();
  }

  /** Triangolo trigonometrico con il punto al centro; il pilastro è più grande e ha il doppio contorno. */
  private simboloCaposaldo(c: CaposaldoPianta, x: number, y: number): void {
    const { ctx } = this;
    const pilastro = c.tipo === 'pilastro';
    const r = pilastro ? 7.5 : 5;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.95, y + r * 0.62);
    ctx.lineTo(x - r * 0.95, y + r * 0.62);
    ctx.closePath();
    ctx.fillStyle = 'rgba(241, 232, 210, 0.95)';
    ctx.fill();
    const tinta = c.rilevato ? COLORI.inchiostro : COLORI.matita;
    ctx.strokeStyle = tinta;
    ctx.lineWidth = pilastro ? 1.6 : 1.2;
    if (!c.rilevato) ctx.setLineDash([2.5, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = tinta;
    ctx.beginPath();
    ctx.arc(x, y + 0.6, pilastro ? 1.8 : 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = pilastro ? '600 15px "EB Garamond", serif' : '500 14px "EB Garamond", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = tinta;
    this.testoConAlone(pilastro ? `P ${c.numero}` : String(c.numero), x + r + 3, y + 1, 'rgba(241, 232, 210, 0.9)', 3);
  }

  /** Lati rilevati: linee sottili a china fra i capisaldi (sul foglio, per la via più corta in θ). */
  private disegnaLati(tMin: number, tMax: number, xZ: (z: number) => number, yT: (t: number) => number): void {
    const lati = this.dati.lati;
    if (!lati?.length) return;
    const perId = new Map(this.dati.capisaldi.map((c) => [c.id, c]));
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(42, 35, 28, 0.8)';
    ctx.lineWidth = 0.9;
    ctx.setLineDash([7, 2, 1.5, 2]);
    for (const l of lati) {
      const a = perId.get(l.da);
      const b = perId.get(l.a);
      if (!a || !b) continue;
      const tb = a.theta + (((b.theta - a.theta + 540) % 360) - 180);
      for (const k of copieVisibili(Math.min(a.theta, tb), Math.abs(tb - a.theta), tMin - 2, tMax + 2)) {
        ctx.beginPath();
        ctx.moveTo(xZ(a.z), yT(a.theta + k));
        ctx.lineTo(xZ(b.z), yT(tb + k));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** La Lanterna, sul Tappo Nord: resta un cerchietto bianco anche quando tutto è a colori. */
  private disegnaLanterna(H: number, xZ: (z: number) => number, larg: number): void {
    const { ctx } = this;
    const x = xZ(LUNGHEZZA_Z) + larg / 2;
    const y = H * 0.18;
    ctx.save();
    ctx.fillStyle = '#fbf7ec';
    ctx.strokeStyle = COLORI.inchiostro;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'italic 500 15px "EB Garamond", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORI.inchiostro;
    this.testoConAlone('Lanterna', x, y + 12, COLORI.carta, 4);
    ctx.restore();
  }

  private disegnaElvira(tMin: number, tMax: number, xZ: (z: number) => number, yT: (t: number) => number): void {
    const e = this.dati.elvira;
    if (!e) return;
    const { ctx } = this;
    for (const k of copieVisibili(e.theta, 0, tMin - 2, tMax + 2)) {
      const x = xZ(e.z);
      const y = yT(e.theta + k);
      const a = (-e.direzione * Math.PI) / 180;
      ctx.save();
      ctx.translate(x, y);
      // Cono dello sguardo, a matita rossa.
      ctx.fillStyle = 'rgba(166, 58, 38, 0.16)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 34, a - 0.42, a + 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(a);
      ctx.fillStyle = COLORI.vermiglio;
      ctx.strokeStyle = COLORI.carta;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-7, -8);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = COLORI.vermiglio;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private disegnaRighelli(vista: Vista, W: number, H: number, tMin: number, tMax: number, xZ: (z: number) => number, yT: (t: number) => number): void {
    const { ctx } = this;
    const L = MARGINI.sinistra;
    const T = MARGINI.alto;
    ctx.save();
    // Cornice: filetto doppio, come nelle carte incise.
    ctx.strokeStyle = COLORI.inchiostro;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(L - 0.5, T - 0.5, W + 1, H + 1);
    ctx.lineWidth = 0.8;
    ctx.strokeRect(L - 6.5, T - 6.5, W + 13, H + 13);

    ctx.fillStyle = COLORI.inchiostro2;
    ctx.strokeStyle = COLORI.inchiostro2;
    ctx.textBaseline = 'alphabetic';
    // z: tacche in alto e in basso.
    ctx.font = '500 15px "EB Garamond", serif';
    ctx.textAlign = 'center';
    const passoZ = vista.scala * 250 < 50 ? 500 : 250;
    for (let z = 0; z <= LUNGHEZZA_Z; z += passoZ / 5) {
      const x = L + xZ(z);
      if (x < L - 1 || x > L + W + 1) continue;
      const lunga = z % passoZ === 0;
      ctx.lineWidth = lunga ? 1.1 : 0.7;
      ctx.beginPath();
      ctx.moveTo(x, T - 7);
      ctx.lineTo(x, T - 7 - (lunga ? 8 : 4));
      ctx.moveTo(x, T + H + 7);
      ctx.lineTo(x, T + H + 7 + (lunga ? 8 : 4));
      ctx.stroke();
      if (lunga) {
        const testo = z === 0 ? '0 m' : z.toLocaleString('it-IT');
        ctx.fillText(testo, x, T - 20);
      }
    }
    // θ: tacche a sinistra e a destra.
    ctx.textBaseline = 'middle';
    const passoT = vista.scala * METRI_PER_GRADO * 15 < 36 ? 30 : 15;
    for (let t = Math.floor(tMin / (passoT / 3)) * (passoT / 3); t <= tMax; t += passoT / 3) {
      const y = T + yT(t);
      if (y < T - 1 || y > T + H + 1) continue;
      const lunga = Math.abs(t % passoT) < 1e-6;
      ctx.lineWidth = lunga ? 1.1 : 0.7;
      ctx.beginPath();
      ctx.moveTo(L - 7, y);
      ctx.lineTo(L - 7 - (lunga ? 8 : 4), y);
      ctx.moveTo(L + W + 7, y);
      ctx.lineTo(L + W + 7 + (lunga ? 8 : 4), y);
      ctx.stroke();
      if (lunga) {
        const testo = `${Math.round(normalizzaGradi(t))}°`;
        ctx.textAlign = 'right';
        ctx.fillText(testo, L - 19, y);
        ctx.textAlign = 'left';
        ctx.fillText(testo, L + W + 19, y);
      }
    }
    ctx.restore();
  }

  private disegnaVignetta(): void {
    const { ctx } = this;
    const g = ctx.createRadialGradient(this.larghezza / 2, this.altezza / 2, Math.min(this.larghezza, this.altezza) * 0.35, this.larghezza / 2, this.altezza / 2, Math.max(this.larghezza, this.altezza) * 0.75);
    g.addColorStop(0, 'rgba(120, 90, 50, 0)');
    g.addColorStop(1, 'rgba(120, 90, 50, 0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.larghezza, this.altezza);
  }

  // ---------- aiuti ----------

  private testoConAlone(testo: string, x: number, y: number, alone: string, spessore: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = alone;
    ctx.lineWidth = spessore;
    ctx.strokeText(testo, x, y);
    ctx.restore();
    ctx.fillText(testo, x, y);
  }

  private motivoCarta(): CanvasPattern | null {
    const c = nuovoCanvas(256, 256);
    const g = c.getContext('2d')!;
    const r = casuale(1234);
    for (let i = 0; i < 2600; i++) {
      const a = r();
      g.fillStyle = a < 0.5 ? `rgba(120, 92, 52, ${0.05 + r() * 0.08})` : `rgba(255, 252, 240, ${0.08 + r() * 0.12})`;
      g.fillRect(r() * 256, r() * 256, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(120, 92, 52, ${0.04 + r() * 0.05})`;
      g.lineWidth = 0.6;
      const x = r() * 256;
      const y = r() * 256;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + (r() - 0.5) * 20, y + (r() - 0.5) * 10, x + (r() - 0.5) * 30, y + (r() - 0.5) * 6);
      g.stroke();
    }
    return this.ctx.createPattern(c, 'repeat');
  }

  private motivoGrana(): CanvasPattern | null {
    const c = nuovoCanvas(200, 200);
    const g = c.getContext('2d')!;
    const r = casuale(99);
    // Chiazze d'acquerello: dischi sfumati più chiari e più scuri.
    for (let i = 0; i < 90; i++) {
      const x = r() * 200;
      const y = r() * 200;
      const rad = 6 + r() * 26;
      const scuro = r() < 0.55;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, scuro ? 'rgba(60, 50, 30, 0.10)' : 'rgba(255, 252, 240, 0.16)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(255, 252, 240, ${r() * 0.2})`;
      g.fillRect(r() * 200, r() * 200, 1, 1);
    }
    return this.ctx.createPattern(c, 'repeat');
  }

  private motivoTratteggio(colore: string, alpha: number, passo: number, verso: 1 | -1): CanvasPattern | null {
    const n = passo * 4;
    const c = nuovoCanvas(n, n);
    const g = c.getContext('2d')!;
    const r = casuale(passo * 13 + (verso > 0 ? 1 : 2));
    g.strokeStyle = colore;
    g.lineCap = 'round';
    for (let k = -n; k <= 2 * n; k += passo) {
      g.globalAlpha = alpha * (0.65 + r() * 0.35);
      g.lineWidth = 0.7 + r() * 0.45;
      g.beginPath();
      if (verso > 0) {
        g.moveTo(k - n, n + (r() - 0.5));
        g.lineTo(k + n, -n + (r() - 0.5));
      } else {
        g.moveTo(k - n, -n + (r() - 0.5));
        g.lineTo(k + n, n + (r() - 0.5));
      }
      g.stroke();
    }
    return this.ctx.createPattern(c, 'repeat');
  }
}

/** Spazia le lettere di un'etichetta (come nelle carte incise). */
export function spaziato(testo: string, spazi: number): string {
  const sep = ' '.repeat(spazi);
  return [...testo].join(sep);
}
