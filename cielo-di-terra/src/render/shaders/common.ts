/**
 * Pezzi GLSL condivisi dallo shader del mondo (terreno, oggetti, nubi, acqua).
 *
 * Stile: campiture quasi piatte con bande di luce morbide, pennellata leggera in
 * spazio mondo, foschia forte a "quinte teatrali" e, per cella, il passaggio
 * fra mondo DIPINTO e mondo a MATITA (carta avorio, tratteggio a grafite,
 * curve di livello, contorni che tremano) con l'animazione "l'inchiostro si allarga".
 *
 * Tutti i colori sono nello spazio sRGB "da pittore": il renderer non converte.
 */

export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm2(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * vnoise2(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s / 0.875;
}
`;

/** Uniform comuni a tutti i materiali del mondo. */
export const WORLD_UNIFORMS_GLSL = /* glsl */ `
uniform float uTime;
uniform float uR;
uniform float uLen;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform vec2 uTilt;
uniform float uLineaIgnite;
uniform vec3 uAmbTop;
uniform vec3 uAmbBottom;
uniform vec3 uHazeColor;
uniform vec3 uLineaGlow;
uniform vec4 uHaze;          // x = densità (1/m), y = massimo, z = forza delle quinte, w = bagliore Linea
uniform float uNight;
uniform vec3 uLampColor;
uniform vec4 uLamps[8];      // xyz posizione, w intensità
uniform sampler2D uCellTex;
uniform vec4 uCellGrid;      // nZ, nTheta, dz (m), dTheta (gradi)
uniform vec4 uPencil;        // x,y = raggio "vicino sempre dipinto" (inizio, fine); z = forza matita globale; w = durata rivelazione
uniform float uPixelAngle;   // radianti per pixel (per il tratteggio stabile con la distanza)
uniform float uDebugView;    // 0 normale
`;

/** Funzioni del cilindro, luce della Linea, foschia. */
export const LIGHT_GLSL = /* glsl */ `
const float PI = 3.141592653589793;

vec3 cylUp(vec3 P) {
  float r = length(P.xy);
  return r > 1e-3 ? vec3(-P.xy / r, 0.0) : vec3(0.0, 1.0, 0.0);
}

// angolo theta in gradi [0, 360): x = -r sin t, y = -r cos t
float cylThetaDeg(vec3 P) {
  float t = atan(-P.x, -P.y);
  return mod(degrees(t) + 360.0, 360.0);
}

// direzione della luce della Linea nel punto P (verso l'asse, inclinata dallo schermo girevole)
vec3 lineaLightDir(vec3 P, vec3 up) {
  vec3 east = vec3(-up.y, up.x, 0.0);
  vec3 north = vec3(0.0, 0.0, 1.0);
  float a = uTilt.x;
  float b = uTilt.y;
  vec3 L = up * cos(a) + (east * cos(b) + north * sin(b)) * sin(a);
  // oltre la punta accesa (alba/tramonto) la luce arriva obliqua dalla punta
  if (P.z > uLineaIgnite && uNight < 0.98) {
    vec3 tip = vec3(0.0, 0.0, uLineaIgnite);
    vec3 d = normalize(tip - P);
    float k = smoothstep(0.0, 120.0, P.z - uLineaIgnite);
    L = normalize(mix(L, d, k * 0.85));
  }
  return normalize(L);
}

// quanta luce "calda" arriva in P (attenuata oltre la punta accesa)
float lineaReach(vec3 P) {
  float dz = max(0.0, P.z - uLineaIgnite);
  float tip = 1.0 / (1.0 + dz * dz / (260.0 * 260.0));
  return mix(tip, 1.0, uNight);
}

// lambert a bande morbide (campiture)
float bandLight(float x) {
  x = clamp(x, 0.0, 1.0);
  float n = 3.0;
  float xs = x * n;
  float fl = floor(xs);
  float fr = xs - fl;
  float stepped = (fl + smoothstep(0.38, 0.62, fr)) / n;
  return mix(x, stepped, 0.72);
}

vec3 lampLight(vec3 P, vec3 N) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec4 l = uLamps[i];
    if (l.w <= 0.0) continue;
    vec3 d = l.xyz - P;
    float dist = length(d);
    float att = l.w / (1.0 + dist * dist * 0.06) * (1.0 - smoothstep(14.0, 30.0, dist));
    float ndl = clamp(dot(N, d / max(dist, 1e-3)) * 0.6 + 0.4, 0.0, 1.0);
    acc += uLampColor * att * ndl;
  }
  return acc * uNight;
}

// colore illuminato di una campitura
vec3 shadeLit(vec3 albedo, vec3 N, vec3 P, out float tone) {
  vec3 up = cylUp(P);
  vec3 L = lineaLightDir(P, up);
  float ndl = dot(N, L);
  float b = bandLight((ndl + 0.12) / 1.12) * lineaReach(P);
  float hemi = dot(N, up) * 0.5 + 0.5;
  vec3 amb = mix(uAmbBottom, uAmbTop, hemi);
  vec3 light = amb * 0.62 + uSunColor * (uSunIntensity * b * 0.78);
  tone = clamp(dot(light, vec3(0.333)), 0.0, 1.2);
  return albedo * light + albedo * lampLight(P, N);
}

// foschia (prospettiva aerea) con quinte teatrali e bagliore della Linea
vec3 applyHaze(vec3 col, vec3 P, float dist) {
  float f = 1.0 - exp(-dist * uHaze.x);
  float steps = 5.0;
  float fs = f * steps;
  float fq = (floor(fs) + smoothstep(0.3, 0.7, fract(fs))) / steps;
  f = mix(f, fq, uHaze.z) * uHaze.y;
  // bagliore: distanza minima del raggio camera->P dall'asse
  vec3 c = cameraPosition;
  vec3 d = P - c;
  float dd = dot(d.xy, d.xy);
  float t = dd > 1e-3 ? clamp(-dot(c.xy, d.xy) / dd, 0.0, 1.0) : 0.0;
  vec3 q = c + d * t;
  float dmin = length(q.xy);
  float litAt = mix(step(q.z, uLineaIgnite), 1.0, uNight * 0.0);
  float glow = exp(-dmin / 110.0) * uHaze.w * litAt * smoothstep(0.0, 300.0, dist) * (1.0 - 0.6 * uNight);
  vec3 hc = uHazeColor + uLineaGlow * glow * 0.55;
  return mix(col, hc, clamp(f + glow * 0.25, 0.0, 1.0));
}
`;

/** Pennellata in spazio mondo su due coordinate di superficie (metri). */
export const BRUSH_GLSL = /* glsl */ `
float brushStrokes(vec2 uv, float dist) {
  float s1 = vnoise2(uv * vec2(0.42, 2.1));
  float s2 = vnoise2(uv * vec2(0.1, 0.5) + 17.0);
  float s3 = vnoise2(uv * vec2(0.025, 0.12) + 41.0);
  float fNear = 1.0 - smoothstep(15.0, 60.0, dist);
  float fMid = 1.0 - smoothstep(150.0, 600.0, dist);
  return (s1 - 0.5) * fNear * 0.55 + (s2 - 0.5) * fMid * 0.75 + (s3 - 0.5) * 0.9;
}

// coordinate di superficie per oggetti qualsiasi (piano tangente alla normale)
vec2 tangentUV(vec3 P, vec3 N) {
  vec3 up = cylUp(P);
  vec3 ref = abs(dot(N, up)) < 0.85 ? up : vec3(0.0, 0.0, 1.0);
  vec3 t1 = normalize(cross(N, ref));
  vec3 t2 = cross(N, t1);
  return vec2(dot(P, t1), dot(P, t2));
}

// coordinate di superficie del cilindro: (arco sul fondo, z)
vec2 cylUV(vec3 P) {
  return vec2(cylThetaDeg(P) * uR * PI / 180.0, P.z);
}
`;

/** Stato delle celle e resa a matita. */
export const PENCIL_GLSL = /* glsl */ `
// legge una cella: restituisce (dipinto, bianco) per la cella e la linea d'inchiostro del fronte
vec2 cellValue(float st) {
  return st > 1.5 ? vec2(1.0, 0.0) : (st > 0.5 ? vec2(0.0, 0.0) : vec2(0.0, 1.0));
}

vec3 cellSample(vec2 idx, vec3 P, float thetaDeg, float edgeNoise) {
  float nZ = uCellGrid.x;
  float nT = uCellGrid.y;
  idx.x = clamp(idx.x, 0.0, nZ - 1.0);
  idx.y = mod(idx.y, nT);
  vec4 t = texelFetch(uCellTex, ivec2(int(idx.y), int(idx.x)), 0);
  float w = t.r + 0.25;
  float q = floor(w / 9.0);
  float rem = w - q * 9.0;
  float cur = floor(rem / 3.0);
  float prv = floor(rem - cur * 3.0);
  vec2 vc = cellValue(cur);
  float p = clamp((uTime - t.g) / uPencil.w, 0.0, 1.0);
  if (p >= 1.0) return vec3(vc, 0.0);
  vec2 vp = cellValue(prv);
  float radius = q * 10.0 + 12.0;
  float ease = 1.0 - pow(1.0 - p, 2.2);
  float front = radius * ease;
  float dth = mod(thetaDeg - t.a + 540.0, 360.0) - 180.0;
  float ds = radians(dth) * uR;
  float dz = P.z - t.b;
  float d = length(vec2(dz, ds));
  float edge = front - d + edgeNoise * 14.0 * (0.4 + 0.6 * ease);
  float k = smoothstep(-3.0, 3.0, edge);
  float ink = (1.0 - smoothstep(0.0, 3.5, abs(edge - 1.5))) * (1.0 - smoothstep(0.75, 1.0, p));
  return vec3(mix(vp, vc, k), ink);
}

// quantità di colore (x), di bianco (y) e d'inchiostro (z) nel frammento
vec3 paintState(vec3 P, float thetaDeg, float dist) {
  vec2 cc = vec2(P.z / uCellGrid.z, thetaDeg / uCellGrid.w);
  // bordi organici: leggera distorsione del dominio
  vec2 warp = vec2(vnoise3(P * 0.021), vnoise3(P * 0.021 + 7.3)) - 0.5;
  cc += warp * 0.55;
  float en = vnoise3(P * 0.06) * 0.7 + vnoise3(P * 0.19) * 0.3 - 0.5;
  vec2 base = floor(cc - 0.5);
  vec2 f = cc - 0.5 - base;
  vec3 a = cellSample(base, P, thetaDeg, en);
  vec3 b = cellSample(base + vec2(1.0, 0.0), P, thetaDeg, en);
  vec3 c = cellSample(base + vec2(0.0, 1.0), P, thetaDeg, en);
  vec3 d = cellSample(base + vec2(1.0, 1.0), P, thetaDeg, en);
  vec3 s = mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  // bordo netto ma frastagliato, come acquerello che si allarga
  float wob = (vnoise3(P * 0.045) - 0.5) * 0.55 + (vnoise3(P * 0.3) - 0.5) * 0.12;
  float paint = smoothstep(0.42, 0.58, s.x + wob);
  float blank = smoothstep(0.42, 0.58, s.y + wob);
  // il mondo vicino è sempre dipinto (ci sei dentro)
  float nearP = 1.0 - smoothstep(uPencil.x, uPencil.y, dist);
  paint = max(paint, nearP);
  blank *= 1.0 - nearP;
  paint *= 1.0 - uPencil.z;
  return vec3(paint, blank, s.z);
}

// linee parallele antialias in spazio mondo; spacing in metri, w in pixel
float hatchLines(vec2 uv, float angle, float spacing, float pix, float wPx) {
  vec2 dir = vec2(cos(angle), sin(angle));
  float s = dot(uv, dir) / spacing;
  float dpx = abs(fract(s) - 0.5) * spacing / max(pix, 1e-4);
  return 1.0 - smoothstep(wPx - 0.6, wPx + 0.6, dpx);
}

float hatchTone(vec2 uv, float tone, float spacing, float pix, float jitter) {
  float h = 0.0;
  float w1 = 0.95 * (1.0 - smoothstep(0.62, 0.86, tone));
  float w2 = 0.9 * (1.0 - smoothstep(0.38, 0.6, tone));
  float w3 = 0.85 * (1.0 - smoothstep(0.18, 0.36, tone));
  if (w1 > 0.01) h = max(h, hatchLines(uv, 0.62 + jitter, spacing, pix, w1) * 0.85);
  if (w2 > 0.01) h = max(h, hatchLines(uv, -0.85 + jitter, spacing * 0.9, pix, w2));
  if (w3 > 0.01) h = max(h, hatchLines(uv, 1.45 + jitter, spacing * 0.8, pix, w3));
  return h;
}

// resa a matita: carta avorio, tratteggio, curve di livello, contorni tremanti
vec3 pencilColor(vec2 uv, vec3 N, vec3 V, float tone, float hgt, float dist, float blank) {
  vec3 paper = vec3(0.947, 0.922, 0.856);
  vec3 graphite = vec3(0.36, 0.36, 0.40);
  float pix = max(dist, 0.5) * uPixelAngle;
  float grain = (vnoise2(uv * 2.7) - 0.5) * 0.05 + (vnoise2(uv * 0.21) - 0.5) * 0.04;
  // il tratto "trema" piano: rumore che cambia a scatti (6 al secondo)
  float tq = floor(uTime * 6.0);
  float jitter = (hash12(vec2(tq, 3.1)) - 0.5) * 0.04;
  vec2 juv = uv + (vec2(vnoise2(uv * 0.08 + tq * 1.7), vnoise2(uv * 0.08 - tq * 1.3)) - 0.5) * 0.6;
  // spaziatura del tratteggio in ottave di metri, stabile con la distanza
  float level = log2(max(pix * 7.0, 0.3));
  float l0 = floor(level);
  float lf = level - l0;
  float h0 = hatchTone(juv, tone, exp2(l0), pix, jitter);
  float h1 = hatchTone(juv, tone, exp2(l0 + 1.0), pix, jitter);
  float hatch = mix(h0, h1, smoothstep(0.2, 0.8, lf));
  // curve di livello dalla quota (passo che raddoppia con la distanza)
  float cstep = 6.0 * exp2(floor(clamp(log2(max(pix * 40.0 / 6.0, 1.0)), 0.0, 5.0)));
  float fh = hgt / cstep;
  float fw = max(fwidth(fh), 1e-4);
  float contour = 1.0 - smoothstep(0.6, 1.4, abs(fract(fh + 0.5) - 0.5) / fw);
  // contorno: dove la superficie è vista di taglio
  float ndv = abs(dot(N, V));
  float wob = (vnoise2(uv * 0.35 + tq * 0.9) - 0.5) * 0.12;
  float rim = 1.0 - smoothstep(0.1 + wob, 0.26 + wob, ndv);
  float ink = hatch * 0.5 + contour * 0.36 + rim * 0.62;
  ink *= mix(1.0, 0.22, blank);
  vec3 col = paper * (1.0 + grain) ;
  col = mix(col, graphite, clamp(ink, 0.0, 0.9));
  return col;
}
`;
