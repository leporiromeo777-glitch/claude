/**
 * Le mani di Elvira in prima persona: guanti di cuoio marrone con le dita leggibili (tre falangi,
 * nocche, pollice), le cuciture sul dorso, il polsino con la cinghia; la manica di lana verde col
 * suo polsino a coste. Costruite con `FormePrimoPiano` (materiale del primo piano).
 *
 * Spazio della mano (destra, palmo in giù): origine al centro del polso, −Z verso le dita, +Y il
 * dorso, +X verso il mignolo (il pollice sta a −X). La sinistra si ottiene specchiando x.
 *
 * Le pose dicono dove stanno le falangi: con gli angoli (`posaAngoli`) o avvolte attorno a un
 * cilindro (`posaAvvolta`: la traversa del Velo, l'asta dello squadro, l'anello della botola).
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import { CUOIO_CUCITO, FormePrimoPiano, MATERIA, misto, type Colore } from '../../render/primoPiano';
import { PALETTE } from '../palette';

/** Colori dei guanti e della giacca (bozzetti 1, 2, 3: cuoio marrone, lana verde oliva). */
export const COLORI_MANI = {
  guanto: 0x7a5136,
  guantoChiaro: 0x9c6c47,
  guantoScuro: 0x4a2f20,
  cinghia: 0x3e2a1e,
  fibbia: PALETTE.ottoneScuro,
  manica: 0x5f6a3e,
  manicaScura: 0x4a5330,
  polsino: 0x535d36,
} as const;

/** Dimensioni del guanto (m). */
const DITA = [
  // [x, y, z della nocca], lunghezze delle falangi, raggio
  { k: new Vector3(-0.031, 0.003, -0.087), l: [0.043, 0.026, 0.022], r: 0.0108 },
  { k: new Vector3(-0.0105, 0.005, -0.091), l: [0.047, 0.029, 0.023], r: 0.0113 },
  { k: new Vector3(0.0105, 0.003, -0.087), l: [0.044, 0.027, 0.022], r: 0.0106 },
  { k: new Vector3(0.0295, -0.002, -0.077), l: [0.034, 0.021, 0.02], r: 0.0096 },
] as const;
const POLLICE = { base: new Vector3(-0.024, -0.011, -0.024), l: [0.042, 0.031, 0.027], r: [0.0165, 0.0128, 0.0118] };

export interface PosaMano {
  /** punti di ogni dito (nocca, falange media, distale, punta) nello spazio della mano */
  dita: Vector3[][];
  /** punti del pollice (base, articolazione, punta) */
  pollice: Vector3[];
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

/**
 * Posa con gli angoli: flessione delle tre falangi per dito (rad, verso il palmo), divaricazione
 * (rad, + verso il mignolo); pollice: apertura dall'indice, discesa verso il palmo, flessione.
 */
export function posaAngoli(dita: Array<[number, number, number]>, pollice: [number, number, number], divaricazione = [-0.07, 0, 0.06, 0.15]): PosaMano {
  const out: Vector3[][] = [];
  for (let i = 0; i < 4; i++) {
    const d = DITA[i]!;
    const a = dita[i]!;
    const spl = divaricazione[i] ?? 0;
    const dir0 = new Vector3(0, 0, -1).applyAxisAngle(Y, -spl);
    const lat = X.clone().applyAxisAngle(Y, -spl);
    const pts = [d.k.clone()];
    let cum = 0;
    let p = d.k.clone();
    for (let k = 0; k < 3; k++) {
      cum += a[k]!;
      const dir = dir0.clone().applyAxisAngle(lat, -cum);
      p = p.clone().addScaledVector(dir, d.l[k]!);
      pts.push(p);
    }
    out.push(pts);
  }
  const [ap, giu, fl] = pollice;
  const d0 = new Vector3(-Math.sin(ap) * Math.cos(giu), -Math.sin(giu), -Math.cos(ap) * Math.cos(giu)).normalize();
  // il pollice si piega verso le dita (asse: perpendicolare alla direzione e al palmo)
  const asse = d0.clone().cross(new Vector3(0.35, -1, 0).normalize()).normalize();
  const pp = [POLLICE.base.clone()];
  let q = POLLICE.base.clone();
  let dir = d0.clone();
  for (let k = 0; k < 3; k++) {
    if (k > 0) dir = dir.clone().applyAxisAngle(asse, fl * (k === 1 ? 0.6 : 0.8));
    q = q.clone().addScaledVector(dir, POLLICE.l[k]!);
    pp.push(q);
  }
  return { dita: out, pollice: pp };
}

/**
 * Posa avvolta attorno a un cilindro con l'asse lungo X (la mano lo stringe dall'alto, le dita
 * passano davanti e sotto): `centro` = (y, z) dell'asse nello spazio della mano, `raggio` del
 * cilindro, `chiusura` 0..1 quanto le dita avvolgono (1 = fin sotto).
 */
export function posaAvvolta(centro: { y: number; z: number }, raggio: number, chiusura = 1, pollice: 'lungo' | 'sotto' = 'lungo'): PosaMano {
  const out: Vector3[][] = [];
  for (let i = 0; i < 4; i++) {
    const d = DITA[i]!;
    const R = raggio + d.r * 1.02;
    // angolo della nocca attorno all'asse (0 = sopra, cresce verso −Z, poi sotto)
    const dy = d.k.y - centro.y;
    const dz = d.k.z - centro.z;
    let phi = Math.atan2(-dz, dy);
    const rk = Math.hypot(dy, dz);
    const pts: Vector3[] = [d.k.clone()];
    // la prima falange parte dalla nocca e scende sul cerchio
    let r = rk;
    for (let k = 0; k < 3; k++) {
      const l = d.l[k]! * (k === 2 ? 0.98 : 1);
      const rr = k === 0 ? (r + R) / 2 : R;
      const dphi = 2 * Math.asin(Math.min(0.99, l / (2 * rr))) * (0.55 + 0.45 * chiusura);
      phi += dphi;
      r = R;
      pts.push(new Vector3(d.k.x + (k === 2 ? 0.0015 : 0), centro.y + Math.cos(phi) * R, centro.z - Math.sin(phi) * R));
    }
    out.push(pts);
  }
  const R = raggio + POLLICE.r[1] * 1.05;
  const base = POLLICE.base.clone();
  if (pollice === 'sotto') {
    // il pollice passa sotto e dietro il cilindro, verso le dita
    const a1 = new Vector3(-0.045, centro.y - R * 0.55, centro.z + R * 0.85);
    const a2 = new Vector3(-0.036, centro.y - R * 1.0, centro.z - R * 0.1);
    const a3 = new Vector3(-0.018, centro.y - R * 0.75, centro.z - R * 0.72);
    return { dita: out, pollice: [base, a1, a2, a3] };
  }
  // il pollice disteso lungo il cilindro, sopra (si vede, come nei bozzetti)
  const a1 = new Vector3(-0.043, centro.y + R * 0.55, centro.z + R * 0.75);
  const a2 = new Vector3(-0.06, centro.y + R * 0.92, centro.z + R * 0.25);
  const a3 = new Vector3(-0.077, centro.y + R * 0.9, centro.z - R * 0.2);
  return { dita: out, pollice: [base, a1, a2, a3] };
}

export interface OpzioniMano {
  colore?: Colore;
  /** consumo del cuoio (0..1): più chiaro sulle nocche */
  consumo?: number;
  /** cinghia al polso con la fibbia */
  cinghia?: boolean;
  /** fasce di cuoio avvolte al polso (bozzetto 3) */
  fasce?: boolean;
}

/**
 * Mano guantata nello spazio della mano. Restituisce la fine del polsino del guanto e la direzione
 * dell'avambraccio (spazio della mano), dove attaccare la manica.
 */
export function manoGuanto(f: FormePrimoPiano, posa: PosaMano, o: OpzioniMano = {}): { polso: Vector3; avambraccio: Vector3 } {
  const g = o.colore ?? COLORI_MANI.guanto;
  const chiaro = misto(g, COLORI_MANI.guantoChiaro, 0.6 + (o.consumo ?? 0.4) * 0.4);
  const scuro = misto(g, COLORI_MANI.guantoScuro, 0.6);
  // dorso e palmo: un tubo schiacciato dal polso alle nocche, più largo davanti
  f.tubo(
    [new Vector3(0, -0.002, 0.004), new Vector3(-0.002, 0.0, -0.035), new Vector3(-0.0005, 0.0, -0.068), new Vector3(0.0, -0.002, -0.086)],
    [0.031, 0.04, 0.045, 0.043],
    {
      colore: (p) => misto(g, chiaro, Math.max(0, Math.min(1, (p.y + 0.004) * 40)) * 0.35),
      materia: MATERIA.CUOIO,
      ellisse: 0.37,
      lato: X.clone(),
      segmenti: 14,
      chiudiFine: true,
      occlusione: (p) => (p.y < -0.006 ? 0.35 : 0.05),
    },
  );
  // eminenza del pollice (sotto, verso −X)
  f.ellissoide(new Vector3(-0.022, -0.009, -0.03), new Vector3(0.019, 0.014, 0.031), new Quaternion().setFromAxisAngle(Y, 0.35), { colore: g, materia: MATERIA.CUOIO, occlusione: 0.25 });
  // cuciture sul dorso (tre righe appena in rilievo verso le nocche, come i guanti da lavoro)
  for (let i = 0; i < 3; i++) {
    const x = -0.021 + i * 0.021;
    f.tubo([new Vector3(x * 0.6, 0.0118, -0.03), new Vector3(x, 0.0138, -0.055), new Vector3(x * 1.05, 0.0142, -0.074)], 0.0013, { colore: scuro, materia: MATERIA.CUOIO, segmenti: 4, chiudiInizio: true, chiudiFine: true, occlusione: 0.2 });
  }
  // dita
  for (let i = 0; i < 4; i++) {
    const d = DITA[i]!;
    const pts = posa.dita[i]!;
    // la nocca sporge appena sul dorso
    f.ellissoide(d.k.clone().add(new Vector3(0, 0.0035, 0.003)), new Vector3(d.r * 1.05, d.r * 0.8, d.r * 1.05), new Quaternion(), { colore: misto(g, chiaro, 0.5), materia: MATERIA.CUOIO, w: 10, h: 7 });
    // tubo del dito: un po' più grosso alle articolazioni, stretto in punta
    const radii = [d.r * 1.08, d.r * 1.0, d.r * 1.03, d.r * 0.95, d.r * 0.98, d.r * 0.86];
    const p0 = pts[0]!;
    const p1 = pts[1]!;
    const p2 = pts[2]!;
    const p3 = pts[3]!;
    const curva = [p0.clone().add(new Vector3(0, 0.001, 0.006)), p0, p0.clone().lerp(p1, 0.5), p1, p1.clone().lerp(p2, 0.5), p2, p3];
    // il lato x della sezione: perpendicolare al dito e al «dorso» locale
    f.tubo(curva, radii, {
      colore: (_p, u) => misto(g, chiaro, Math.max(0, 0.5 - u * 9) * 0.5),
      materia: CUOIO_CUCITO,
      ellisse: 0.86,
      lato: X.clone(),
      giro: 0.25,
      segmenti: 9,
      chiudiFine: true,
      // più buio fra un dito e l'altro e sotto (verso il palmo), pieghe alle articolazioni
      occlusione: (p, u, vv) => {
        const piega = Math.max(0, 1 - Math.abs(u - (d.l[0] + 0.006)) / 0.006) + Math.max(0, 1 - Math.abs(u - (d.l[0] + d.l[1] + 0.006)) / 0.005);
        // fianchi del dito (v = 0,25 e 0,75): il solco fra un dito e l'altro; il lato del palmo (v = 0,5)
        const fianco = Math.pow(Math.abs(Math.cos(2 * Math.PI * (vv - 0.25))), 3);
        const palmo = Math.max(0, Math.cos(2 * Math.PI * (vv - 0.5)));
        return 0.05 + fianco * (i === 0 || i === 3 ? 0.25 : 0.45) + palmo * 0.25 + (p.y < pts[0]!.y - 0.03 ? 0.15 : 0) + piega * 0.3;
      },
    });
  }
  // pollice
  const pp = posa.pollice;
  f.tubo(pp, [POLLICE.r[0], POLLICE.r[1], POLLICE.r[2], POLLICE.r[2] * 0.85], {
    colore: g,
    materia: CUOIO_CUCITO,
    ellisse: 0.85,
    giro: 0.25,
    segmenti: 10,
    chiudiFine: true,
    chiudiInizio: true,
    occlusione: 0.12,
  });
  // polsino a manopola: si allarga verso il gomito, orlo cucito
  const av = new Vector3(0, -0.12, 1).normalize();
  const w0 = new Vector3(0, 0, 0.0);
  const w1 = w0.clone().addScaledVector(av, 0.085);
  f.tubo([w0.clone().addScaledVector(av, -0.012), w0.clone().addScaledVector(av, 0.03), w1], [0.032, 0.035, 0.042], {
    colore: misto(g, COLORI_MANI.guantoScuro, 0.25),
    materia: CUOIO_CUCITO,
    ellisse: 0.72,
    lato: X.clone(),
    giro: 0.25,
    segmenti: 14,
    occlusione: (p) => (p.y < -0.01 ? 0.25 : 0.06),
  });
  // orlo del polsino
  f.tubo([w1.clone().addScaledVector(av, -0.004), w1.clone().addScaledVector(av, 0.004)], 0.0445, { colore: chiaro, materia: MATERIA.CUOIO, ellisse: 0.72, lato: X.clone(), segmenti: 14, occlusione: 0.1 });
  if (o.cinghia ?? true) {
    // cinghia attorno al polso con la fibbia sul dorso
    const c = w0.clone().addScaledVector(av, 0.03);
    f.tubo([c.clone().addScaledVector(av, -0.007), c.clone().addScaledVector(av, 0.007)], 0.0375, { colore: COLORI_MANI.cinghia, materia: MATERIA.CUOIO, ellisse: 0.74, lato: X.clone(), segmenti: 14, occlusione: 0.15 });
    const fb = c.clone().add(new Vector3(0.01, 0.0275, 0));
    f.tubo([fb.clone().add(new Vector3(-0.008, 0, -0.009)), fb.clone().add(new Vector3(-0.008, 0, 0.009)), fb.clone().add(new Vector3(0.008, 0, 0.009)), fb.clone().add(new Vector3(0.008, 0, -0.009)), fb.clone().add(new Vector3(-0.008, 0, -0.009))], 0.0016, {
      colore: COLORI_MANI.fibbia,
      materia: MATERIA.OTTONE,
      liscio: false,
      segmenti: 5,
    });
  }
  if (o.fasce) {
    // due fasce di cuoio avvolte di sbieco (il Velo si tiene a lungo)
    for (let k = 0; k < 2; k++) {
      const c = w0.clone().addScaledVector(av, 0.05 + k * 0.022);
      const pts: Vector3[] = [];
      for (let s = 0; s <= 16; s++) {
        const a = (s / 16) * Math.PI * 2;
        pts.push(c.clone().add(new Vector3(Math.cos(a) * 0.046, Math.sin(a) * 0.035, Math.cos(a) * 0.008 + s * 0.0004)));
      }
      f.tubo(pts, 0.0045, { colore: k ? scuro : misto(g, COLORI_MANI.guantoChiaro, 0.3), materia: MATERIA.CUOIO, ellisse: 0.45, segmenti: 6, occlusione: 0.1 });
    }
  }
  return { polso: w1.clone().addScaledVector(av, 0.004), avambraccio: av };
}

/**
 * Manica di lana verde dal polso al gomito (spazio di chi chiama): polsino a coste, pieghe della
 * stoffa, più larga verso il gomito.
 */
export function manica(f: FormePrimoPiano, polso: Vector3, gomito: Vector3, o: { seme?: number; lato?: Vector3 } = {}): void {
  const d = gomito.clone().sub(polso);
  const l = d.length();
  const dir = d.clone().normalize();
  const seme = o.seme ?? 0.3;
  const lato = o.lato ?? new Vector3(1, 0, 0);
  // polsino a coste (copre il bordo del guanto)
  const p0 = polso.clone().addScaledVector(dir, -0.012);
  const p1 = polso.clone().addScaledVector(dir, 0.045);
  f.tubo([p0, p1], [0.052, 0.054], { colore: COLORI_MANI.polsino, materia: MATERIA.LANA, ellisse: 0.82, lato, segmenti: 18, occlusione: 0.08, chiudiInizio: false });
  // orlo del polsino arrotolato
  f.tubo([p0.clone().addScaledVector(dir, -0.002), p0.clone().addScaledVector(dir, 0.008)], 0.0545, { colore: misto(COLORI_MANI.polsino, 0x000000, 0.15), materia: MATERIA.LANA, ellisse: 0.82, lato, segmenti: 18, occlusione: 0.15 });
  // corpo della manica, con le pieghe
  const pts: Vector3[] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = p1.clone().addScaledVector(dir, t * (l - 0.03));
    // la stoffa cede un poco verso il basso
    p.y -= Math.sin(t * Math.PI) * 0.012;
    pts.push(p);
  }
  const r = (t: number) => 0.058 + t * 0.022 + Math.sin(t * 19 + seme * 7) * 0.0035 * (1 - t * 0.5) + Math.max(0, Math.sin(t * 7.5 + seme * 3)) * 0.004;
  f.tubo(pts, r, {
    colore: (_p, u) => misto(COLORI_MANI.manica, COLORI_MANI.manicaScura, Math.max(0, Math.sin(u * 46 + seme * 5)) * 0.35),
    materia: MATERIA.LANA,
    ellisse: 0.86,
    lato,
    segmenti: 18,
    passi: 26,
    occlusione: (_p, u) => Math.max(0, 0.25 - u * 2.5) + Math.max(0, Math.sin(u * 46 + seme * 5)) * 0.18,
  });
}

/** Matrice di una mano: posizione del polso, direzione delle dita, direzione del dorso; `sinistra` specchia. */
export function matriceMano(polso: Vector3, avanti: Vector3, dorso: Vector3, sinistra = false): Matrix4 {
  const z = avanti.clone().normalize().negate();
  const y = dorso.clone().addScaledVector(z, -dorso.dot(z)).normalize();
  const x = y.clone().cross(z).normalize();
  const m = new Matrix4().makeBasis(x, y, z).setPosition(polso);
  if (sinistra) m.multiply(new Matrix4().makeScale(-1, 1, 1));
  return m;
}
