/**
 * Geometria della Pianta del Verbano: il cilindro srotolato su un foglio.
 * Asse orizzontale: z in metri (0 = Tappo Sud, 3000 = Tappo Nord).
 * Asse verticale: θ in gradi, che si chiude su sé stesso (360 = 0): la Pianta scorre senza fine in verticale.
 */

/** Lunghezza del cilindro abitato, in metri (Tappo Sud → Tappo Nord). */
export const LUNGHEZZA_Z = 3000;
/** Raggio interno del cilindro, in metri. */
export const RAGGIO = 646;
/** Circonferenza interna: la «altezza» del foglio srotolato, in metri. */
export const CIRCONFERENZA = 2 * Math.PI * RAGGIO;
/** Metri di terreno per grado di θ. */
export const METRI_PER_GRADO = CIRCONFERENZA / 360;

export type TipoFascia = 'valle' | 'finestra';

export interface FasciaPianta {
  nome: string;
  /** Nome breve per le etichette strette. */
  breve?: string;
  theta0: number;
  theta1: number;
  tipo: TipoFascia;
}

/** Le tre valli e le tre Finestre del Verbano (costanti del motore). */
export const FASCE_VERBANO: readonly FasciaPianta[] = [
  { nome: 'Corbella e le Selve', breve: 'Valle 1', theta0: 0, theta1: 90, tipo: 'valle' },
  { nome: 'Finestra dei Ponti', theta0: 90, theta1: 120, tipo: 'finestra' },
  { nome: 'Il Verbanetto', breve: 'Valle 2', theta0: 120, theta1: 210, tipo: 'valle' },
  { nome: 'Seconda Finestra', theta0: 210, theta1: 240, tipo: 'finestra' },
  { nome: 'Gli Alpeggi', breve: 'Valle 3', theta0: 240, theta1: 330, tipo: 'valle' },
  { nome: 'Terza Finestra', theta0: 330, theta1: 360, tipo: 'finestra' },
];

/** Porta un angolo in [0, 360). */
export function normalizzaGradi(theta: number): number {
  const t = theta % 360;
  return t < 0 ? t + 360 : t;
}

/** Ampiezza di un intervallo angolare [a, b] in gradi, nel verso crescente (b < a vuol dire che passa per 0). */
export function ampiezza(theta0: number, theta1: number): number {
  const d = theta1 - theta0;
  if (d >= 0 && d <= 360) return d;
  return normalizzaGradi(d) || 360;
}

/** Vero se θ cade nell'intervallo [theta0, theta0 + ampiezza], considerando il giro. */
export function dentroAngolo(theta: number, theta0: number, theta1: number): boolean {
  const amp = ampiezza(theta0, theta1);
  if (amp >= 360) return true;
  return normalizzaGradi(theta - theta0) <= amp;
}

/**
 * Spostamenti (multipli di 360) per cui l'intervallo [theta0, theta0+amp] interseca la finestra [tMin, tMax].
 * Serve a disegnare più copie di ciò che sta vicino allo 0 quando il foglio scorre.
 */
export function copieVisibili(theta0: number, amp: number, tMin: number, tMax: number): number[] {
  const fuori: number[] = [];
  const kMin = Math.floor((tMin - theta0 - amp) / 360);
  const kMax = Math.ceil((tMax - theta0) / 360);
  for (let k = kMin; k <= kMax; k++) {
    const a = theta0 + k * 360;
    if (a + amp >= tMin && a <= tMax) fuori.push(k * 360);
  }
  return fuori;
}

/** Punto dentro un poligono [z, θ] (θ già «srotolato», senza giro). */
export function dentroPoligono(z: number, t: number, pts: readonly (readonly [number, number])[]): boolean {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [zi, ti] = pts[i]!;
    const [zj, tj] = pts[j]!;
    if (ti > t !== tj > t && z < ((zj - zi) * (t - ti)) / (tj - ti) + zi) dentro = !dentro;
  }
  return dentro;
}

/** Stato della vista: centro (z, θ non normalizzato) e scala in pixel per metro. */
export interface Vista {
  zc: number;
  tc: number;
  scala: number;
}

/** Trasforma coordinate del mondo in pixel del foglio (θ cresce verso l'alto). */
export function aSchermo(v: Vista, larghezza: number, altezza: number, z: number, theta: number): [number, number] {
  return [larghezza / 2 + (z - v.zc) * v.scala, altezza / 2 - (theta - v.tc) * METRI_PER_GRADO * v.scala];
}

/** Trasforma pixel del foglio in coordinate del mondo (θ restituito non normalizzato). */
export function daSchermo(v: Vista, larghezza: number, altezza: number, x: number, y: number): [number, number] {
  return [v.zc + (x - larghezza / 2) / v.scala, v.tc - (y - altezza / 2) / (METRI_PER_GRADO * v.scala)];
}

/** Scala che fa stare tutto il cilindro (in z) nella larghezza utile. */
export function scalaIntera(larghezzaUtile: number): number {
  return Math.max(0.01, larghezzaUtile / LUNGHEZZA_Z);
}

/**
 * Tiene la vista dentro limiti sensati: z del centro fra i due Tappi (con un po' di margine se si è ingranditi),
 * scala fra quella intera e 8 volte tanto. θ resta libero (la Pianta si chiude su sé stessa).
 */
export function limitaVista(v: Vista, larghezza: number, larghezzaUtile: number): Vista {
  const sMin = scalaIntera(larghezzaUtile);
  const scala = Math.min(sMin * 8, Math.max(sMin, v.scala));
  const meta = larghezza / 2 / scala;
  const margine = (larghezza - larghezzaUtile) / 2 / scala;
  const zMin = Math.min(LUNGHEZZA_Z / 2, meta - margine);
  const zMax = Math.max(LUNGHEZZA_Z / 2, LUNGHEZZA_Z - meta + margine);
  return { zc: Math.min(zMax, Math.max(zMin, v.zc)), tc: v.tc, scala };
}

/** Formatta θ come «123°». */
export function formattaGradi(theta: number): string {
  return `${Math.round(normalizzaGradi(theta))}°`;
}

/** Nome della fascia (valle o Finestra) che contiene θ. */
export function fasciaDi(theta: number, fasce: readonly FasciaPianta[] = FASCE_VERBANO): FasciaPianta | undefined {
  return fasce.find((f) => dentroAngolo(theta, f.theta0, f.theta1) && normalizzaGradi(theta - f.theta0) < ampiezza(f.theta0, f.theta1));
}
