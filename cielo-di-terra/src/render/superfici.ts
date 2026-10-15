/**
 * Tipi di superficie del materiale del mondo (traccia «luce»).
 *
 * Tutti gli oggetti del mondo (case, muri, alberi, abitanti…) usano lo stesso materiale con i
 * colori per vertice (`createWorldMaterial`, attributo `aColor`). Il canale `aSuperficie` dice
 * allo shader che cosa sta dipingendo, e lo shader aggiunge un motivo procedurale dipinto in
 * spazio mondo (niente texture, niente UV: si può taggare qualsiasi geometria unita).
 *
 * Attributo per vertice `aSuperficie` (itemSize 1 oppure 2):
 *   x = tipo + variante   tipo = un valore di `SUPERFICIE`; variante in [0, 0.99] (seme del
 *                          motivo, e per LEGNO: >= 0.5 = assi orizzontali)
 *   y = occlusione        0 = nessuna, 1 = buio pieno (occlusione ambientale cotta: angoli,
 *                          piede dei muri, interno delle chiome). Facoltativo.
 * Se l'attributo manca vale 0: comportamento di prima (nessun motivo), salvo la superficie
 * predefinita del materiale (`createWorldMaterial(u, { superficie })` o l'uniform `uSuperficieBase`).
 *
 * Il colore di base resta `aColor`: il motivo lo varia attorno al suo valore (per esempio
 * PIETRA con aColor grigio caldo dà pietre grigie, ocra e brune con i giunti scuri).
 *
 * Esempio (vedi `taggaSuperficie`):
 *   const g = costruttore.build();
 *   taggaSuperficie(g, SUPERFICIE.PIETRA);              // tutta la geometria
 *   taggaSuperficie(g, SUPERFICIE.PIODE, { da: 120, a: 480, occlusione: 0.1 }); // un intervallo di vertici
 */
import { BufferAttribute, type BufferGeometry } from 'three';

export const SUPERFICIE = {
  /** Nessun motivo: campitura con pennellata (comportamento storico). */
  NESSUNA: 0,
  /** Pietra a vista: blocchi irregolari a corsi, grigio caldo / ocra / bruno, giunti scuri, licheni. */
  PIETRA: 1,
  /** Tetto in piode: file di lastre spesse di gneiss, bordo chiaro e ombra sotto ogni fila, muschio. */
  PIODE: 2,
  /** Legno: assi con fessure, venature, legno vecchio argentato a chiazze (variante >= 0.5: assi orizzontali). */
  LEGNO: 3,
  /** Intonaco a calce: macchie, colature, sbiaditure, qua e là la pietra sotto. */
  INTONACO: 4,
  /** Corteccia (castagno): solchi lungo il tronco, licheni chiari. */
  CORTECCIA: 5,
  /** Fogliame: ciuffi a due toni, interstizi scuri, bordi luminosi, luce trasmessa in controluce. */
  FOGLIAME: 6,
  /** Tessuto: trama fine, pieghe morbide, un po' di luce trasmessa (vele, Velo, vestiti). */
  TESSUTO: 7,
  /** Terra battuta: ghiaino chiaro e scuro, chiazze umide. */
  TERRA: 8,
  /** Metallo (ferro brunito): riflesso freddo, ruggine a chiazze. */
  METALLO: 9,
  /** Ottone: riflesso caldo e netto, patina scura negli incavi. */
  OTTONE: 10,
  /** Roccia naturale: crepe larghe, strati, licheni arancio, muschio sulle facce in su. */
  ROCCIA: 11,
  /** Erba (zolle, tetti verdi, prato su oggetti): pennellate a ciuffi, punte secche dorate. */
  ERBA: 12,
  /** Vetro: scuro, riflette il cielo e la foschia di taglio (di notte si accende con aColor.a). */
  VETRO: 13,
} as const;

export type Superficie = (typeof SUPERFICIE)[keyof typeof SUPERFICIE];

/** Nomi leggibili (debug, scena di prova). */
export const NOMI_SUPERFICIE: Record<Superficie, string> = {
  0: 'nessuna',
  1: 'pietra',
  2: 'piode',
  3: 'legno',
  4: 'intonaco',
  5: 'corteccia',
  6: 'fogliame',
  7: 'tessuto',
  8: 'terra',
  9: 'metallo',
  10: 'ottone',
  11: 'roccia',
  12: 'erba',
  13: 'vetro',
};

export interface OpzioniTag {
  /** Primo vertice (incluso). Predefinito 0. */
  da?: number;
  /** Ultimo vertice (escluso). Predefinito: tutti. */
  a?: number;
  /** Variante (seme del motivo) in [0, 0.99]. */
  variante?: number;
  /** Occlusione ambientale cotta (0 = nessuna, 1 = buio pieno). */
  occlusione?: number;
}

/**
 * Scrive il tipo di superficie su un intervallo di vertici di una geometria (crea l'attributo
 * `aSuperficie`, itemSize 2, se manca). Restituisce l'attributo.
 */
export function taggaSuperficie(g: BufferGeometry, tipo: Superficie, opz: OpzioniTag = {}): BufferAttribute {
  const n = g.getAttribute('position').count;
  let attr = g.getAttribute('aSuperficie') as BufferAttribute | undefined;
  if (!attr || attr.itemSize !== 2) {
    const prima = attr;
    attr = new BufferAttribute(new Float32Array(n * 2), 2);
    if (prima) for (let i = 0; i < n; i++) attr.setX(i, prima.getX(i));
    g.setAttribute('aSuperficie', attr);
  }
  const da = Math.max(0, opz.da ?? 0);
  const a = Math.min(n, opz.a ?? n);
  const v = Math.min(0.99, Math.max(0, opz.variante ?? 0));
  for (let i = da; i < a; i++) {
    attr.setX(i, tipo + v);
    if (opz.occlusione !== undefined) attr.setY(i, opz.occlusione);
  }
  attr.needsUpdate = true;
  return attr;
}

/** Decodifica il valore dell'attributo (come fa lo shader). */
export function leggiSuperficie(x: number): { tipo: number; variante: number } {
  const tipo = Math.floor(x + 1e-3);
  return { tipo, variante: Math.max(0, x - tipo) };
}

/**
 * Motivi procedurali delle superfici (GLSL). Richiede NOISE_GLSL, LIGHT_GLSL (struct Sup,
 * lumaP, cylUp) e BRUSH_GLSL (cylLocal) prima.
 */
export const SUPERFICI_GLSL = /* glsl */ `
// coordinate di faccia nello spazio "srotolato" del cilindro (arco, z, quota): niente
// stiramenti, i corsi delle pietre restano orizzontali e allineati da un muro all'altro.
// tW, bW (out) = assi della faccia in coordinate mondo (tW orizzontale, bW "in su").
vec2 faceUV(vec3 P, vec3 N, out vec3 tW, out vec3 bW) {
  vec3 up = cylUp(P);
  vec3 east = vec3(-up.y, up.x, 0.0);
  vec3 Nl = vec3(dot(N, east), N.z, dot(N, up));
  vec3 tl = abs(Nl.z) < 0.92 ? normalize(cross(vec3(0.0, 0.0, 1.0), Nl)) : vec3(1.0, 0.0, 0.0);
  vec3 bl = cross(Nl, tl);
  tW = east * tl.x + vec3(0.0, 0.0, tl.y) + up * tl.z;
  bW = east * bl.x + vec3(0.0, 0.0, bl.y) + up * bl.z;
  vec3 c = cylLocal(P);
  return vec2(dot(c, tl), dot(c, bl));
}

// normale da un campo d'altezza qualsiasi (derivate in schermo, metodo di Mikkelsen)
vec3 bumpDaAltezza(vec3 N, vec3 P, float h, float forza) {
  vec3 dpx = dFdx(P);
  vec3 dpy = dFdy(P);
  float dhx = dFdx(h);
  float dhy = dFdy(h);
  vec3 r1 = cross(dpy, N);
  vec3 r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  if (abs(det) < 1e-12) return N;
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - grad * forza);
}

// visibilità di un motivo di scala 'scala' (m) con 'pix' metri per pixel
float visMotivo(float pix, float scala) {
  // a qualità bassa (uDettaglio < 0.5) i motivi fini si vedono solo da più vicino
  float k = uDettaglio < 0.5 ? 0.4 : 1.0;
  return 1.0 - smoothstep(scala * 0.08 * k, scala * 0.25 * k, pix);
}

void supPietra(inout Sup s, vec3 P, vec2 uv, float pix, float var) {
  float vis = visMotivo(pix, 0.3);
  vec3 c = s.albedo;
  // da lontano: solo una leggera variazione a macchie
  float far = vnoise2(uv * 0.9 + var * 11.0);
  s.albedo = c * (0.94 + 0.12 * far);
  if (vis <= 0.0) return;
  vec2 cell = vec2(0.38, 0.23);
  vec2 q = uv / cell + var * 17.0;
  q.y += (vnoise2(uv * vec2(0.7, 0.25)) - 0.5) * 0.7;
  vec2 rel;
  vec4 vo = voronoi2(q, rel);
  float id = vo.z;
  vec3 ocra = c * vec3(1.08, 1.0, 0.86);
  vec3 bruno = c * vec3(0.93, 0.86, 0.79);
  vec3 freddo = c * vec3(0.95, 0.98, 1.03);
  vec3 pc = id < 0.3 ? ocra : (id < 0.6 ? c : (id < 0.84 ? freddo : bruno));
  pc *= 0.88 + 0.2 * hash12(vec2(id * 31.0, 3.7));
  // faccia della pietra: piccole scaglie e licheni
  float sc = vnoise2(uv * 9.0 + id * 13.0);
  pc *= 0.94 + 0.12 * sc;
  float lich = smoothstep(0.66, 0.82, vnoise2(uv * 2.6 + id * 9.0));
  pc = mix(pc, vec3(0.8, 0.77, 0.55), lich * 0.4);
  float joint = 1.0 - smoothstep(0.02, 0.09, vo.x);
  float round = smoothstep(0.0, 0.35, vo.x);
  pc *= mix(0.88, 1.0, round);
  // giunto: malta e ombra, scuro ma non nero (si legge come pietra a secco)
  vec3 alb = mix(pc, c * vec3(0.56, 0.53, 0.5), joint * 0.85);
  s.albedo = mix(s.albedo, alb, vis);
  // altezza: pietra a cuscino, giunto incavato
  float h = (round * 0.6 + sc * 0.08) * 0.028 - joint * 0.012;
  s.N = bumpDaAltezza(s.N, P, h * vis, 1.0);
  s.ao *= mix(1.0, mix(0.78, 1.0, smoothstep(0.0, 0.14, vo.x)), vis);
}

void supPiode(inout Sup s, vec3 P, vec2 uv, float pix, float var) {
  float vis = visMotivo(pix, 0.45);
  vec3 c = s.albedo;
  float rowH = 0.4;
  float y = uv.y / rowH + var * 5.0;
  float row = floor(y);
  float fy = fract(y);
  float w = 0.5 + 0.38 * hash12(vec2(row, 7.1));
  float x = uv.x / w + hash12(vec2(row, 1.3)) * 3.0;
  float jag = (vnoise2(vec2(uv.x * 5.0, row * 3.1)) - 0.5) * 0.3;
  float fy2 = clamp(fy + jag, 0.0, 1.0);
  float colI = floor(x + (vnoise2(vec2(uv.y * 4.0, row)) - 0.5) * 0.3);
  float fx = fract(x);
  float id = hash12(vec2(row * 1.7, colI));
  // gneiss: grigio scuro con lastre brune, verdastre, chiare
  vec3 lc = c * (0.8 + 0.42 * id);
  lc = mix(lc, lc * vec3(1.12, 1.0, 0.86), step(0.72, hash12(vec2(colI, row + 9.0))) * 0.6);
  lc = mix(lc, lc * vec3(0.92, 1.04, 0.92), step(0.85, hash12(vec2(colI + 3.0, row))) * 0.5);
  float sc = vnoise2(uv * 7.0 + id * 21.0);
  lc *= 0.92 + 0.14 * sc;
  // muschio e licheni sulle lastre
  float moss = smoothstep(0.7, 0.86, vnoise2(uv * 1.3 + 4.0) * 0.7 + sc * 0.3);
  lc = mix(lc, vec3(0.5, 0.52, 0.28), moss * 0.45);
  float lich = step(0.93, hash12(floor(uv * 9.0) + id)) * 0.6;
  lc = mix(lc, vec3(0.85, 0.62, 0.3), lich * 0.5);
  // spessore: il bordo basso della lastra prende luce, sotto la fila di sopra c'è ombra
  float edge = 1.0 - smoothstep(0.0, 0.09, fy2);
  float under = smoothstep(0.7, 1.0, fy2);
  float gap = 1.0 - smoothstep(0.0, 0.035, min(fx, 1.0 - fx) * w);
  lc = mix(lc, lc * 1.28 + 0.03, edge * 0.8);
  lc *= 1.0 - under * 0.45;
  lc = mix(lc, c * 0.3, gap * (1.0 - edge));
  s.albedo = mix(c * (0.92 + 0.12 * vnoise2(uv * 0.8)), lc, vis);
  // le lastre sono più inclinate della falda: ogni fila sale verso il colmo
  float h = (fy2 * 0.05 + id * 0.01) - gap * 0.015;
  s.N = bumpDaAltezza(s.N, P, h * vis, 1.0);
  s.ao *= mix(1.0, 1.0 - under * 0.5 - gap * 0.3, vis);
}

void supLegno(inout Sup s, vec3 P, vec2 uv, float pix, float var) {
  float vis = visMotivo(pix, 0.22);
  vec3 c = s.albedo;
  vec2 a = var >= 0.5 ? uv : uv.yx; // a.x lungo l'asse, a.y attraverso
  float bw = 0.2;
  float bi = floor(a.y / bw);
  float fb = fract(a.y / bw);
  float id = hash12(vec2(bi, 5.0 + var * 7.0));
  float along = a.x + id * 37.0;
  float grain = vnoise2(vec2(along * 1.2, a.y * 34.0)) * 0.6 + vnoise2(vec2(along * 0.35, a.y * 9.0)) * 0.4;
  float fib = smoothstep(0.45, 0.8, fract(grain * 3.5));
  vec3 lc = c * (0.78 + 0.38 * id);
  float weather = smoothstep(0.35, 0.8, vnoise2(vec2(along * 0.22, bi * 1.7)));
  lc = mix(lc, vec3(lumaP(lc)) * vec3(0.98, 0.95, 0.9) * 1.15, weather * 0.4);
  lc *= 0.84 + 0.22 * grain - fib * 0.08;
  // nodi
  vec2 kq = vec2(along * 0.9, bi);
  float knot = 1.0 - smoothstep(0.0, 0.09, length((fract(kq) - 0.5) * vec2(1.0, 0.6)));
  knot *= step(0.82, hash12(floor(kq) + 2.0));
  lc = mix(lc, lc * 0.55, knot * 0.7);
  float gap = 1.0 - smoothstep(0.0, 0.07, min(fb, 1.0 - fb));
  lc = mix(lc, lc * 0.32, gap);
  s.albedo = mix(c * (0.9 + 0.15 * vnoise2(a * vec2(0.5, 4.0))), lc, vis);
  float h = (sin(fb * PI) * 0.02 + grain * 0.004) - gap * 0.01;
  s.N = bumpDaAltezza(s.N, P, h * vis, 1.0);
  s.ao *= mix(1.0, 1.0 - gap * 0.4, vis);
}

void supIntonaco(inout Sup s, vec3 P, vec2 uv, float pix, float var) {
  vec3 c = s.albedo;
  float m1 = vnoise2(uv * 0.55 + var * 13.0);
  float m2 = vnoise2(uv * 2.1 + 5.0);
  float streak = vnoise2(vec2(uv.x * 3.6, uv.y * 0.28 + var * 3.0));
  vec3 lc = c * (0.92 + 0.1 * m1 + 0.05 * m2);
  // colature e sbiaditure (calce dilavata dalla pioggia)
  lc = mix(lc, lc * vec3(0.85, 0.83, 0.79), smoothstep(0.55, 0.85, streak) * 0.55);
  lc = mix(lc, lc * vec3(1.03, 1.0, 0.94) + 0.02, smoothstep(0.6, 0.9, m1) * 0.4);
  // intonaco caduto: sotto si vede la pietra
  float fl = vnoise2(uv * 1.1 + 31.0) * 0.66 + vnoise2(uv * 4.2 + 2.0) * 0.22 + m2 * 0.12;
  float flake = smoothstep(0.735, 0.75, fl);
  if (flake > 0.0 && pix < 0.06) {
    vec2 rel;
    vec4 vo = voronoi2(uv / vec2(0.34, 0.2) + 3.0, rel);
    vec3 st = vec3(0.62, 0.57, 0.5) * (0.82 + 0.3 * vo.z);
    st = mix(st, st * 0.45, 1.0 - smoothstep(0.03, 0.11, vo.x));
    lc = mix(lc, st, flake);
    s.ao *= 1.0 - flake * 0.15;
  }
  float rim = smoothstep(0.69, 0.735, fl) * (1.0 - flake);
  lc *= 1.0 - rim * 0.18;
  s.albedo = lc;
  s.N = bumpDaAltezza(s.N, P, (m2 * 0.004 - flake * 0.01) * visMotivo(pix, 0.2), 1.0);
}

void supCorteccia(inout Sup s, vec3 P, float pix, float var) {
  vec3 c = s.albedo;
  // coordinate srotolate (arco, z, quota) schiacciate lungo la quota: solchi lungo il tronco
  vec3 q = cylLocal(P) * vec3(4.2, 4.2, 0.6) + var * 19.0;
  float f = vnoise3(q);
  float ridge = 1.0 - abs(f * 2.0 - 1.0);
  float f2 = vnoise3(q * 2.4 + 5.0);
  float furrow = smoothstep(0.25, 0.75, ridge * 0.7 + f2 * 0.3);
  float vis = visMotivo(pix, 0.12);
  vec3 lc = c * mix(0.5, 1.15, furrow);
  float lich = smoothstep(0.62, 0.8, vnoise3(P * 1.6 + 7.0));
  lc = mix(lc, vec3(0.66, 0.68, 0.58), lich * 0.45);
  float moss = smoothstep(0.6, 0.8, vnoise3(P * 0.7 + 3.0)) * 0.4;
  lc = mix(lc, vec3(0.34, 0.42, 0.2), moss);
  s.albedo = mix(c * (0.9 + 0.1 * lich), lc, max(vis, 0.35));
  s.N = bumpDaAltezza(s.N, P, furrow * 0.025 * vis, 1.0);
  s.ao *= mix(1.0, mix(0.65, 1.0, furrow), vis);
}

void supFogliame(inout Sup s, vec3 P, vec3 Nv, float pix, float var) {
  vec3 c = s.albedo;
  // ciuffi: masse di foglie a scala ~0.7 m, due toni morbidi (la forma la dà la luce)
  float sc = 0.7;
  float n1 = vnoise3(P / sc + var * 23.0);
  float n0 = vnoise3(P / (sc * 2.6) + 5.0);
  float vis = visMotivo(pix, sc);
  float clump = smoothstep(0.28, 0.72, n1 * 0.68 + n0 * 0.32);
  // varietà d'autunno a chiazze più grandi: verde, oro, ruggine
  float v = vnoise3(P * 0.42 + var * 7.0);
  vec3 lc = mix(c, c * vec3(1.16, 1.0, 0.64), smoothstep(0.56, 0.78, v) * 0.45);
  lc = mix(lc, c * vec3(1.1, 0.8, 0.62), smoothstep(0.3, 0.1, v) * 0.32);
  lc *= mix(0.8, 1.05, mix(0.5, clump, vis));
  // foglie: macchiette fini da vicino
  if (pix < 0.03) {
    float lf = vnoise3(P / 0.08 + 3.0);
    lc *= 1.0 + (lf - 0.5) * 0.2 * (1.0 - smoothstep(0.01, 0.03, pix));
  }
  s.albedo = lc;
  s.N = bumpDaAltezza(s.N, P, clump * 0.04 * vis, 1.0);
  s.ao *= mix(0.74, 1.0, clump);
  s.trasm = 0.9;
  s.bordo = 0.75;
  s.bande = 0.72;
}

void supTessuto(inout Sup s, vec3 P, vec2 uv, float pix, float var) {
  vec3 c = s.albedo;
  float fold = vnoise2(vec2(uv.x * 2.2, uv.y * 0.7) + var * 9.0);
  float weave = 0.0;
  if (pix < 0.004) {
    vec2 w = uv / 0.006;
    weave = (step(0.5, fract(w.x)) * 0.5 + step(0.5, fract(w.y)) * 0.5 - 0.5) * (1.0 - smoothstep(0.0015, 0.004, pix));
  }
  s.albedo = c * (0.92 + 0.12 * fold + weave * 0.08);
  s.N = bumpDaAltezza(s.N, P, fold * 0.03, 1.0);
  s.trasm = 0.45;
}

void supTerra(inout Sup s, vec3 P, vec2 uv, float pix, float var) {
  vec3 c = s.albedo;
  float m = vnoise2(uv * 0.6 + var * 5.0);
  vec3 lc = c * (0.88 + 0.2 * m);
  lc = mix(lc, lc * vec3(0.78, 0.74, 0.7), smoothstep(0.6, 0.85, vnoise2(uv * 0.25 + 3.0)) * 0.5);
  if (pix < 0.03) {
    float g = hash12(floor(uv * 28.0));
    float pebble = step(0.86, g) * (1.0 - smoothstep(0.012, 0.03, pix));
    lc = mix(lc, g > 0.93 ? lc * 1.35 + 0.05 : lc * 0.6, pebble * 0.7);
  }
  s.albedo = lc;
}

void supMetallo(inout Sup s, vec3 P, vec2 uv, float pix, float var) {
  vec3 c = s.albedo;
  float rust = smoothstep(0.58, 0.8, vnoise2(uv * 1.7 + var * 9.0) * 0.7 + vnoise2(uv * 6.0) * 0.3);
  s.albedo = mix(c * (0.9 + 0.15 * vnoise2(uv * 4.0)), vec3(0.5, 0.3, 0.17), rust * 0.65);
  s.spec = 0.55 * (1.0 - rust);
  s.lucido = 36.0;
  s.specC = mix(vec3(0.85, 0.88, 0.95), c, 0.3);
}

void supOttone(inout Sup s, vec3 P, vec2 uv, float pix, float var) {
  vec3 c = s.albedo;
  float pat = smoothstep(0.6, 0.85, vnoise2(uv * 5.0 + var * 9.0));
  s.albedo = mix(c, c * vec3(0.55, 0.5, 0.36), pat * 0.5);
  s.spec = 1.0 - pat * 0.6;
  s.lucido = 70.0;
  s.specC = c * vec3(1.35, 1.15, 0.75) + 0.08;
}

void supRoccia(inout Sup s, vec3 P, vec2 uv, vec3 up, float pix, float var) {
  vec3 c = s.albedo;
  float hgt = uR - length(P.xy);
  float vis = visMotivo(pix, 1.2);
  vec2 rel;
  vec4 vo = voronoi2(uv / vec2(1.4, 0.9) + var * 13.0, rel);
  float crack = 1.0 - smoothstep(0.02, 0.07, vo.x);
  float strata = smoothstep(0.82, 0.95, fract(hgt / 0.55 + vnoise2(uv * 0.4) * 0.8));
  vec3 lc = c * (0.84 + 0.28 * vo.z) * (0.94 + 0.12 * vnoise2(uv * 3.0));
  lc *= 1.0 - strata * 0.18;
  lc = mix(lc, c * 0.38, crack);
  float lich = smoothstep(0.72, 0.85, vnoise2(uv * 2.2 + 17.0));
  lc = mix(lc, vec3(0.85, 0.58, 0.28), lich * 0.35);
  float top = smoothstep(0.55, 0.9, dot(s.N, up));
  float moss = top * smoothstep(0.45, 0.7, vnoise2(uv * 0.9 + 3.0));
  lc = mix(lc, vec3(0.36, 0.45, 0.2), moss * 0.7);
  s.albedo = mix(c * (0.92 + 0.14 * vo.z), lc, max(vis, 0.3));
  s.N = bumpDaAltezza(s.N, P, (smoothstep(0.0, 0.4, vo.x) * 0.08 - crack * 0.03) * vis, 1.0);
  s.ao *= mix(1.0, 1.0 - crack * 0.45, vis);
}

void supErba(inout Sup s, vec3 P, vec2 uv, vec3 up, float pix, float var) {
  vec3 c = s.albedo;
  float st = vnoise2(uv * vec2(9.0, 2.2) + var * 7.0);
  float tuft = vnoise2(uv * 1.7 + 3.0);
  vec3 lc = c * (0.8 + 0.35 * st);
  lc = mix(lc, vec3(0.82, 0.7, 0.38), smoothstep(0.6, 0.85, tuft) * 0.45);
  s.albedo = mix(c, lc, visMotivo(pix, 0.15) * 0.8 + 0.2);
  s.trasm = 0.35;
}

void supVetro(inout Sup s, vec3 P, vec2 uv, float pix) {
  s.albedo = s.albedo * 0.6;
  s.spec = 1.0;
  s.lucido = 140.0;
  s.specC = vec3(0.9, 0.93, 1.0);
}

/**
 * Applica il motivo del tipo 'tipo' (con 'var' variante) alla superficie.
 * 'pix' = metri per pixel alla distanza del frammento.
 */
void applicaSuperficie(inout Sup s, float tipo, float var, vec3 P, vec3 Nv, float pix) {
  if (tipo < 0.5) return;
  vec3 tW;
  vec3 bW;
  vec2 uv = faceUV(P, Nv, tW, bW);
  vec3 up = cylUp(P);
  if (tipo < 1.5) supPietra(s, P, uv, pix, var);
  else if (tipo < 2.5) supPiode(s, P, uv, pix, var);
  else if (tipo < 3.5) supLegno(s, P, uv, pix, var);
  else if (tipo < 4.5) supIntonaco(s, P, uv, pix, var);
  else if (tipo < 5.5) supCorteccia(s, P, pix, var);
  else if (tipo < 6.5) supFogliame(s, P, Nv, pix, var);
  else if (tipo < 7.5) supTessuto(s, P, uv, pix, var);
  else if (tipo < 8.5) supTerra(s, P, uv, pix, var);
  else if (tipo < 9.5) supMetallo(s, P, uv, pix, var);
  else if (tipo < 10.5) supOttone(s, P, uv, pix, var);
  else if (tipo < 11.5) supRoccia(s, P, uv, up, pix, var);
  else if (tipo < 12.5) supErba(s, P, uv, up, pix, var);
  else if (tipo < 13.5) supVetro(s, P, uv, pix);
}
`;
