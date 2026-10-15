/**
 * Modello dei dati della Pianta: tutto finisce in una griglia (z, θ) di celle con stato, salute e terreno,
 * da cui si ricavano le maschere da dipingere e i contorni (marching squares) da ripassare a matita e a inchiostro.
 */
import { CIRCONFERENZA, LUNGHEZZA_Z, ampiezza, dentroPoligono, normalizzaGradi, type FasciaPianta } from './geometria';

/** Stato di una particella: mai vista, vista con lo squadro (matita), rilevata (inchiostro e colore). */
export type StatoParticella = 'bianco' | 'matita' | 'rilevato';
/** Salute di una particella rilevata: il colore con cui si dipinge. */
export type SaluteParticella = 'verde' | 'bruno' | 'grigio';
/** Che cosa c'è sotto: cambia il colore dell'acquerello. */
export type TerrenoParticella = 'terra' | 'acqua' | 'roccia' | 'abitato';

export const CODICE_STATO: Record<StatoParticella, number> = { bianco: 0, matita: 1, rilevato: 2 };
export const CODICE_SALUTE: Record<SaluteParticella, number> = { verde: 1, bruno: 2, grigio: 3 };
export const CODICE_TERRENO: Record<TerrenoParticella, number> = { terra: 0, acqua: 1, roccia: 2, abitato: 3 };

/** Una particella del catasto (rettangolo in z e θ, oppure contorno libero). */
export interface ParticellaPianta {
  id: string;
  nome?: string;
  /** Estensione lungo l'asse, in metri (0 = Tappo Sud, 3000 = Tappo Nord). */
  z0: number;
  z1: number;
  /** Estensione angolare in gradi; se theta1 < theta0 la particella passa per 0°. */
  theta0: number;
  theta1: number;
  /** Contorno libero [z, θ] in senso qualsiasi (sostituisce il rettangolo per il disegno e il riempimento). */
  contorno?: [number, number][];
  stato: StatoParticella;
  salute?: SaluteParticella;
  terreno?: TerrenoParticella;
  /** Cambiata nella notte: nel resoconto del mattino è ripassata in rosso. */
  cambiata?: boolean;
}

/**
 * Griglia densa, nello stesso formato del motore (`CellGrid`): id = iz * nTheta + itheta,
 * iz lungo z (0 = Tappo Sud), itheta lungo θ (0 = 0°, crescente verso Mane).
 */
export interface GrigliaPianta {
  nZ: number;
  nTheta: number;
  /** 0 = bianco, 1 = matita, 2 = rilevato. */
  stati: ArrayLike<number>;
  /** 0 = non indicata, 1 = verde, 2 = bruno, 3 = grigio. */
  salute?: ArrayLike<number>;
  /** 0 = terra, 1 = acqua, 2 = roccia, 3 = abitato. */
  terreno?: ArrayLike<number>;
  /** 1 = cambiata nella notte. */
  cambiate?: ArrayLike<number>;
}

export type TipoCaposaldo = 'pilastro' | 'chiodo';

export interface CaposaldoPianta {
  id: string;
  numero: number;
  tipo?: TipoCaposaldo;
  z: number;
  theta: number;
  /** Solo i capisaldi rilevati compaiono sulla Pianta. */
  rilevato: boolean;
  nome?: string;
}

export interface LuogoPianta {
  id?: string;
  nome: string;
  z: number;
  theta: number;
  /** Forza la visibilità; altrimenti il nome compare solo se la sua cella è rilevata. */
  visibile?: boolean;
}

export interface PosizionePianta {
  z: number;
  theta: number;
  /**
   * Direzione dello sguardo sul foglio, in gradi: 0 = verso il Tappo Nord (+z), 90 = a Mane (+θ),
   * 180 = verso il Tappo Sud, 270 = a Sera.
   */
  direzione: number;
}

export interface DatiPianta {
  /** Griglia densa del motore (consigliata). */
  griglia?: GrigliaPianta;
  /** Particelle del catasto (con nome e contorno): si sommano alla griglia. */
  particelle?: ParticellaPianta[];
  capisaldi: CaposaldoPianta[];
  elvira?: PosizionePianta;
  luoghi?: LuogoPianta[];
  /** Valli e Finestre (predefinite: quelle del Verbano). */
  fasce?: FasciaPianta[];
  /** Totale delle particelle del catasto, per il cartiglio («rilevate 12 di 160»). */
  totaleParticelle?: number;
}

/** Risoluzione della griglia interna quando arrivano solo le particelle (come il motore: 40 m × 3,75°). */
export const GRIGLIA_PREDEFINITA = { nZ: 75, nTheta: 96 } as const;

export class ModelloPianta {
  readonly nZ: number;
  readonly nTheta: number;
  readonly stati: Uint8Array;
  readonly salute: Uint8Array;
  readonly terreno: Uint8Array;
  readonly cambiate: Uint8Array;

  constructor(nZ: number, nTheta: number) {
    this.nZ = Math.max(1, Math.floor(nZ));
    this.nTheta = Math.max(1, Math.floor(nTheta));
    const n = this.nZ * this.nTheta;
    this.stati = new Uint8Array(n);
    this.salute = new Uint8Array(n);
    this.terreno = new Uint8Array(n);
    this.cambiate = new Uint8Array(n);
  }

  /** Lato di una cella lungo z (m). */
  get dz(): number {
    return LUNGHEZZA_Z / this.nZ;
  }

  /** Lato di una cella in θ (gradi). */
  get dTheta(): number {
    return 360 / this.nTheta;
  }

  /** Costruisce il modello dai dati della Pianta. */
  static da(dati: Pick<DatiPianta, 'griglia' | 'particelle'>): ModelloPianta {
    const g = dati.griglia;
    const m = new ModelloPianta(g?.nZ ?? GRIGLIA_PREDEFINITA.nZ, g?.nTheta ?? GRIGLIA_PREDEFINITA.nTheta);
    if (g) {
      const n = m.stati.length;
      for (let i = 0; i < n; i++) {
        m.stati[i] = Math.min(2, Math.max(0, g.stati[i] ?? 0));
        m.salute[i] = g.salute?.[i] ?? 0;
        m.terreno[i] = g.terreno?.[i] ?? 0;
        m.cambiate[i] = g.cambiate?.[i] ? 1 : 0;
      }
    }
    for (const p of dati.particelle ?? []) m.rasterizza(p);
    return m;
  }

  /** Indice della cella che contiene (z, θ). */
  indice(z: number, theta: number): number {
    const iz = Math.min(this.nZ - 1, Math.max(0, Math.floor(z / this.dz)));
    const it = Math.floor(normalizzaGradi(theta) / this.dTheta) % this.nTheta;
    return iz * this.nTheta + it;
  }

  /** Stato della cella in (z, θ); fuori dai Tappi è «bianco». */
  statoIn(z: number, theta: number): number {
    if (z < 0 || z > LUNGHEZZA_Z) return 0;
    return this.stati[this.indice(z, theta)] ?? 0;
  }

  /** Quante celle per stato. */
  conteggi(): { bianco: number; matita: number; rilevato: number } {
    const c = { bianco: 0, matita: 0, rilevato: 0 };
    for (const s of this.stati) {
      if (s >= 2) c.rilevato++;
      else if (s === 1) c.matita++;
      else c.bianco++;
    }
    return c;
  }

  /** Scrive una particella nelle celle il cui centro le cade dentro (lo stato più alto vince). */
  rasterizza(p: ParticellaPianta): void {
    const stato = CODICE_STATO[p.stato] ?? 0;
    const salute = p.salute ? CODICE_SALUTE[p.salute] : 0;
    const terreno = p.terreno ? CODICE_TERRENO[p.terreno] : undefined;
    const amp = p.contorno ? 360 : ampiezza(p.theta0, p.theta1);
    const z0 = p.contorno ? Math.min(...p.contorno.map((q) => q[0])) : Math.min(p.z0, p.z1);
    const z1 = p.contorno ? Math.max(...p.contorno.map((q) => q[0])) : Math.max(p.z0, p.z1);
    const izMin = Math.max(0, Math.floor(z0 / this.dz));
    const izMax = Math.min(this.nZ - 1, Math.ceil(z1 / this.dz));
    // Per il contorno libero: θ del poligono «srotolato» intorno al suo primo punto.
    const poligono = p.contorno?.map(([z, t], i, arr) => {
      if (i === 0) return [z, t] as [number, number];
      const t0 = arr[0]![1];
      return [z, t0 + (((t - t0 + 540) % 360) - 180)] as [number, number];
    });
    const tBase = poligono ? poligono[0]![1] : p.theta0;
    for (let iz = izMin; iz <= izMax; iz++) {
      const zc = (iz + 0.5) * this.dz;
      for (let it = 0; it < this.nTheta; it++) {
        const tc = (it + 0.5) * this.dTheta;
        let dentro: boolean;
        if (poligono) {
          const t = tBase + (((tc - tBase + 540) % 360) - 180);
          dentro = dentroPoligono(zc, t, poligono);
        } else {
          dentro = zc >= z0 && zc <= z1 && normalizzaGradi(tc - p.theta0) <= amp;
        }
        if (!dentro) continue;
        const i = iz * this.nTheta + it;
        if (stato >= this.stati[i]!) {
          this.stati[i] = stato;
          if (salute) this.salute[i] = salute;
        }
        if (terreno !== undefined) this.terreno[i] = terreno;
        if (p.cambiata) this.cambiate[i] = 1;
      }
    }
  }

  /**
   * Contorni delle zone con stato ≥ `soglia` (marching squares sui centri delle celle, chiusi su θ).
   * Restituisce segmenti [z1, θ1, z2, θ2, …] in coordinate del mondo (θ può superare 360 di mezza cella).
   */
  contorni(soglia: number, campo: Uint8Array = this.stati): Float32Array {
    const { nZ, nTheta } = this;
    const dz = this.dz;
    const dt = this.dTheta;
    const v = (iz: number, it: number): number => {
      if (iz < 0 || iz >= nZ) return 0;
      return (campo[iz * nTheta + (((it % nTheta) + nTheta) % nTheta)] ?? 0) >= soglia ? 1 : 0;
    };
    const fuori: number[] = [];
    // Punti medi dei lati del quadrato (i, j): 0 basso, 1 destra, 2 alto, 3 sinistra.
    const punto = (i: number, j: number, lato: number): [number, number] => {
      const z = (i + 0.5) * dz;
      const t = (j + 0.5) * dt;
      switch (lato) {
        case 0:
          return [z + dz / 2, t];
        case 1:
          return [z + dz, t + dt / 2];
        case 2:
          return [z + dz / 2, t + dt];
        default:
          return [z, t + dt / 2];
      }
    };
    const SEGMENTI: Record<number, number[]> = {
      1: [3, 0],
      2: [0, 1],
      3: [3, 1],
      4: [1, 2],
      5: [3, 0, 1, 2],
      6: [0, 2],
      7: [3, 2],
      8: [2, 3],
      9: [0, 2],
      10: [0, 1, 2, 3],
      11: [1, 2],
      12: [1, 3],
      13: [0, 1],
      14: [0, 3],
    };
    for (let i = -1; i < nZ; i++) {
      for (let j = 0; j < nTheta; j++) {
        const caso = v(i, j) | (v(i + 1, j) << 1) | (v(i + 1, j + 1) << 2) | (v(i, j + 1) << 3);
        const seg = SEGMENTI[caso];
        if (!seg) continue;
        for (let k = 0; k < seg.length; k += 2) {
          const a = punto(i, j, seg[k]!);
          const b = punto(i, j, seg[k + 1]!);
          fuori.push(a[0], a[1], b[0], b[1]);
        }
      }
    }
    return new Float32Array(fuori);
  }
}

/** Metri di arco del foglio per tutto il giro (per comodità di chi disegna). */
export const ALTEZZA_FOGLIO_M = CIRCONFERENZA;
