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
import { CUOIO_CUCITO, FormePrimoPiano, LANA_MAGLIA, MATERIA, misto, type Colore } from '../../render/primoPiano';
import { PALETTE } from '../palette';

/**
 * Colori dei guanti e della giacca (bozzetti 1, 2, 3: cuoio scuro cucito, lana verde oliva).
 * Rifinitura 1: il cuoio era un bruno rossiccio chiaro che con la luce calda sembrava pelle nuda;
 * ora è un cuoio scuro (#4b3426) con le luci consumate (#6e4c34) e il polsino a manopola più
 * chiaro (#8a6a4a), che sta sopra la lana come nel bozzetto 2.
 */
export const COLORI_MANI = {
  guanto: 0x4b3426,
  guantoChiaro: 0x6e4c34,
  guantoScuro: 0x2c1f17,
  /** rifinitura 2: le cuciture fra le dita e lungo i fianchi (filo cerato scuro) */
  cucitura: 0x2e2018,
  /** rifinitura 2: la luce sulle nocche (il cuoio consumato, più chiaro e caldo) */
  nocche: 0x8a6446,
  /**
   * polsino a manopola, cuoio più chiaro e meno conciato. Rifinitura 2: da #7a5e45 a #7a5236, stesso
   * valore ma più saturo: al sole il bruno-rosa di prima sembrava un polso nudo
   */
  manopola: 0x7a5236,
  manopolaOrlo: 0x553a26,
  cinghia: 0x2e2119,
  fibbia: PALETTE.ottoneScuro,
  // verde oliva spento, quasi cachi (bozzetti 1 e 2), non il verde saturo di un tubo di plastica:
  // la post-produzione satura, quindi la base tira al bruno
  manica: 0x67624c,
  manicaScura: 0x4c4838,
  /** rifinitura 2: la piega diagonale della manica (la lana si arriccia dove il braccio si piega) */
  manicaPiega: 0x3b3829,
  /** e la cresta chiara della piega, dalla parte della luce */
  manicaChiara: 0x7d7759,
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

/**
 * Cuciture fra le dita (rifinitura 2): un filo scuro sul fianco alto di ogni dito, dalla parte del
 * dito vicino (l'indice e il mignolo solo verso l'interno), dalla nocca alla punta. Si leggono come
 * le righe scure fra un dito e l'altro dei guanti da lavoro dei bozzetti.
 */
function cucitureDito(f: FormePrimoPiano, pts: Vector3[], r: number, i: number): void {
  const lati = i === 0 ? [1] : i === 3 ? [-1] : [-1, 1];
  for (const s of lati) {
    const curva: Vector3[] = [];
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k]!;
      const t = (k < pts.length - 1 ? pts[k + 1]!.clone().sub(p) : p.clone().sub(pts[k - 1]!)).normalize();
      const lat = X.clone().addScaledVector(t, -t.dot(X)).normalize();
      const su = lat.clone().cross(t).normalize();
      // la punta resta libera (la cucitura gira sotto il polpastrello)
      const rr = r * (k === pts.length - 1 ? 0.78 : 0.95);
      curva.push(p.clone().addScaledVector(lat, s * rr).addScaledVector(su, r * 0.3));
    }
    f.tubo(curva, 0.0013, { colore: COLORI_MANI.cucitura, materia: MATERIA.CUOIO, segmenti: 4, occlusione: 0.35 });
  }
}

export interface OpzioniMano {
  colore?: Colore;
  /** consumo del cuoio (0..1): più chiaro sulle nocche */
  consumo?: number;
  /** cinghia al polso con la fibbia (predefinito no: le fibbie d'ottone si leggevano come puntini gialli) */
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
  // cuciture sul dorso (tre righe di filo scuro verso le nocche, come i guanti da lavoro) e la
  // cucitura del bordo del dorso, che gira attorno al pollice
  for (let i = 0; i < 3; i++) {
    const x = -0.021 + i * 0.021;
    f.tubo([new Vector3(x * 0.6, 0.0118, -0.03), new Vector3(x, 0.0138, -0.055), new Vector3(x * 1.05, 0.0142, -0.074)], 0.0011, { colore: COLORI_MANI.guantoScuro, materia: MATERIA.CUOIO, segmenti: 4, chiudiInizio: true, chiudiFine: true, occlusione: 0.3 });
  }
  f.tubo([new Vector3(-0.026, 0.006, -0.012), new Vector3(-0.031, 0.009, -0.04), new Vector3(-0.034, 0.008, -0.07)], 0.001, { colore: COLORI_MANI.guantoScuro, materia: MATERIA.CUOIO, segmenti: 4, occlusione: 0.3 });
  // dita
  // rifinitura 2: le nocche prendono la luce (il cuoio consumato #8a6446) e le cuciture scure corrono
  // lungo i fianchi delle dita, fra un dito e l'altro (#2e2018): da lontano le dita si contano
  const nocca = misto(g, COLORI_MANI.nocche, 0.38 + (o.consumo ?? 0.4) * 0.25);
  for (let i = 0; i < 4; i++) {
    const d = DITA[i]!;
    const pts = posa.dita[i]!;
    // la nocca sporge appena sul dorso
    f.ellissoide(d.k.clone().add(new Vector3(0, 0.0038, 0.003)), new Vector3(d.r * 1.08, d.r * 0.82, d.r * 1.08), new Quaternion(), { colore: nocca, materia: MATERIA.CUOIO, w: 10, h: 7 });
    cucitureDito(f, pts, d.r, i);
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
  // polsino a manopola (bozzetto 2): cuoio più chiaro (#7a5e45), alto 6 cm (rifinitura 2: prima
  // 7-8 cm), si allarga verso il gomito e sta SOPRA la lana (la manica parte da dentro); la cucitura
  // scura corre lungo il dorso e un'altra fa il giro dove il polsino si attacca al guanto
  const av = new Vector3(0, -0.12, 1).normalize();
  const w0 = new Vector3(0, 0, 0.0);
  const w1 = w0.clone().addScaledVector(av, 0.06);
  const mano = COLORI_MANI.manopola;
  f.tubo([w0.clone().addScaledVector(av, -0.014), w0.clone().addScaledVector(av, 0.016), w0.clone().addScaledVector(av, 0.04), w1], [0.032, 0.036, 0.044, 0.05], {
    colore: (p, u) => misto(misto(mano, g, Math.max(0, 0.3 - u * 7)), COLORI_MANI.manopolaOrlo, p.y < -0.012 ? 0.35 : 0),
    materia: CUOIO_CUCITO,
    ellisse: 0.82,
    lato: X.clone(),
    giro: 0.25,
    segmenti: 16,
    occlusione: (p, u) => (p.y < -0.012 ? 0.3 : 0.05) + Math.max(0, 0.25 - u * 4),
  });
  // la cucitura del giro, dove il polsino si attacca al guanto
  f.tubo([w0.clone().addScaledVector(av, 0.006), w0.clone().addScaledVector(av, 0.0075)], 0.0362, { colore: COLORI_MANI.cucitura, materia: MATERIA.CUOIO, ellisse: 0.82, lato: X.clone(), segmenti: 16, occlusione: 0.3 });
  // orlo del polsino, rivoltato e più scuro
  f.tubo([w1.clone().addScaledVector(av, -0.006), w1.clone().addScaledVector(av, 0.004)], 0.0525, { colore: COLORI_MANI.manopolaOrlo, materia: MATERIA.CUOIO, ellisse: 0.82, lato: X.clone(), segmenti: 16, occlusione: 0.12 });
  if (o.cinghia ?? false) {
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
  // la manica parte da dentro la manopola (2,5 cm prima dell'orlo): il cuoio le sta sopra
  return { polso: w1.clone().addScaledVector(av, -0.026), avambraccio: av };
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
  // la manica esce dalla manopola del guanto (che le sta sopra): stretta al polso, poi si allarga;
  // lana a maglia fitta a basso contrasto (`LANA_MAGLIA`), pieghe morbide e larghe, non a coste
  const p0 = polso.clone();
  const pts: Vector3[] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = p0.clone().addScaledVector(dir, t * (l - 0.01));
    // la stoffa cede un poco verso il basso
    p.y -= Math.sin(t * Math.PI) * 0.012;
    pts.push(p);
  }
  const r = (t: number) => {
    const s = t * l;
    // stretta al polso, poi la lana si gonfia in pieghe larghe (sbuffi) e torna a stringersi
    const sbuffi = Math.max(0, Math.sin(s * 16 + seme * 7)) * 0.009 * Math.min(1, s / 0.06) * (1 - t * 0.6);
    return 0.036 + Math.min(1, s / 0.08) * 0.014 + t * 0.012 + sbuffi + Math.max(0, Math.sin(t * 5.5 + seme * 3)) * 0.003;
  };
  // pieghe di sbieco (la stoffa si arriccia dove il braccio si piega): più scure e più in ombra
  const piega = (u: number, v: number) => Math.max(0, Math.sin(u * 24 + Math.sin(v * 6.283) * 1.6 + seme * 5)) ** 2;
  // rifinitura 2: una piega diagonale netta che gira attorno alla manica (scura, con la cresta chiara
  // accanto): la manica non è più un tubo liscio, nemmeno al buio
  const diag = (u: number, v: number) => {
    const k = Math.abs(((v - (u / Math.max(l, 0.1)) * 0.85 + seme * 0.37 + 10) % 1) - 0.5);
    const lungo = Math.min(1, Math.max(0, (u - 0.04) / 0.05)) * Math.min(1, Math.max(0, (l - 0.03 - u) / 0.05));
    return { scura: Math.max(0, 1 - k / 0.07) * lungo, chiara: Math.max(0, 1 - Math.abs(k - 0.12) / 0.06) * lungo };
  };
  f.tubo(pts, r, {
    colore: (_p, u, v) => {
      const d = diag(u, v);
      return misto(misto(misto(COLORI_MANI.manica, COLORI_MANI.manicaScura, piega(u, v) * 0.45), COLORI_MANI.manicaChiara, d.chiara * 0.4), COLORI_MANI.manicaPiega, d.scura * 0.75);
    },
    materia: LANA_MAGLIA,
    ellisse: 0.86,
    lato,
    segmenti: 18,
    passi: 30,
    occlusione: (_p, u, v) => Math.max(0, 0.3 - u * 3) + piega(u, v) * 0.22 + diag(u, v).scura * 0.3,
  });
}

/**
 * Il braccio dal gomito alla spalla (spazio di chi chiama): la stessa lana della manica, più larga,
 * con la piega del gomito all'inizio. Va quasi sempre fuori campo: serve perché la manica non
 * finisca nel vuoto quando il gomito si vede.
 */
export function braccio(f: FormePrimoPiano, gomito: Vector3, spalla: Vector3, o: { seme?: number; lato?: Vector3 } = {}): void {
  const seme = o.seme ?? 0.3;
  const d = spalla.clone().sub(gomito);
  const pts: Vector3[] = [];
  for (let i = 0; i <= 4; i++) pts.push(gomito.clone().addScaledVector(d, i / 4 - (i === 0 ? 0.08 : 0)));
  const piega = (u: number, v: number) => Math.max(0, Math.sin(u * 20 + Math.sin(v * 6.283) * 1.4 + seme * 3)) ** 2;
  // la piega del gomito: un ventaglio di pieghe scure che parte dall'interno del gomito
  const gomitoP = (u: number, v: number) => Math.max(0, 1 - u / 0.12) * Math.max(0, Math.sin(v * 6.283 * 3 + u * 30 + seme)) ** 3;
  f.tubo(pts, (t) => 0.07 + t * 0.012 + Math.max(0, Math.sin(t * 9 + seme * 5)) * 0.004, {
    colore: (_p, u, v) => misto(misto(COLORI_MANI.manica, COLORI_MANI.manicaScura, 0.12 + piega(u, v) * 0.4), COLORI_MANI.manicaPiega, gomitoP(u, v) * 0.6),
    materia: LANA_MAGLIA,
    ellisse: 0.9,
    lato: o.lato ?? new Vector3(1, 0, 0),
    segmenti: 16,
    passi: 12,
    chiudiInizio: true,
    occlusione: (_p, u, v) => 0.15 + piega(u, v) * 0.2,
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
