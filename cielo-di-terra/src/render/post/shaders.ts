/**
 * Shader della post-produzione pittorica. Tutte lavorano su un triangolo che copre lo schermo.
 *
 * Spazio colore: il mondo è disegnato con colori «da pittore» già pensati in sRGB (il renderer
 * non converte, ColorManagement è spento). Il render target HDR (mezzo float) conserva questi
 * valori, anche sopra 1 (Linea, lumi, finestre accese, la Meta). La post lavora in questo stesso
 * spazio fino alla mappatura dei toni, che riporta tutto in [0, 1] per lo schermo: così i colori
 * dell'interfaccia 3D, della prima persona e delle sovrapposizioni della regia restano quelli scelti.
 */

export const VERT_SCHERMO = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Rumori e utilità comuni alle passate. */
const COMUNE = /* glsl */ `
const float PI = 3.141592653589793;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float max3(vec3 c) { return max(c.r, max(c.g, c.b)); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
// HDR compresso in [0,1) per i filtri (varianza e gradienti ben educati anche sulla Linea)
vec3 comprimi(vec3 c) { return c / (1.0 + max3(c)); }
vec3 espandi(vec3 c) { return c / max(1.0 - max3(c), 1e-3); }
`;

/**
 * Contorni dalla profondità: derivata seconda di 1/z (che sulle superfici piane è nulla), solo
 * dal lato più vicino della sagoma, così la linea appartiene all'oggetto e non al fondo.
 * Uscita: r = forza del contorno, g = profondità in scala logaritmica (per il filtro e la grana).
 */
export const FRAG_CONTORNI = /* glsl */ `
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform vec2 uNearFar;
uniform float uSpessore;
uniform vec4 uSoglie;      // x,y soglia sagome; z,w dissolvenza con la distanza (m)
uniform float uLontano;    // forza residua dei contorni lontani
varying vec2 vUv;
float invZ(float d) {
  float zn = d * 2.0 - 1.0;
  return (uNearFar.y + uNearFar.x - zn * (uNearFar.y - uNearFar.x)) / (2.0 * uNearFar.x * uNearFar.y);
}
float dZ(vec2 o) { return invZ(texture2D(tDepth, vUv + o).r); }
void main() {
  vec2 o = uTexel * uSpessore;
  float c = invZ(texture2D(tDepth, vUv).r);
  float l = dZ(vec2(-o.x, 0.0));
  float r = dZ(vec2(o.x, 0.0));
  float d = dZ(vec2(0.0, -o.y));
  float u = dZ(vec2(0.0, o.y));
  float ld = dZ(vec2(-o.x, -o.y));
  float ru = dZ(vec2(o.x, o.y));
  float lu = dZ(vec2(-o.x, o.y));
  float rd = dZ(vec2(o.x, -o.y));
  // positivo solo dove questo pixel sta davanti ai vicini (sagoma vista da questo lato, spigoli convessi)
  float lap = max(0.0, 2.0 * c - l - r) + max(0.0, 2.0 * c - u - d) + 0.5 * (max(0.0, 2.0 * c - ld - ru) + max(0.0, 2.0 * c - lu - rd));
  float rel = lap / max(c, 1e-7);
  float e = smoothstep(uSoglie.x, uSoglie.y, rel);
  float z = 1.0 / max(c, 1e-7);
  e *= mix(1.0, uLontano, smoothstep(uSoglie.z, uSoglie.w, z));
  // il cielo vuoto (nulla disegnato) non ha contorni
  e *= step(texture2D(tDepth, vUv).r, 0.999999);
  float logd = log2(max(z, uNearFar.x) / uNearFar.x) / log2(uNearFar.y / uNearFar.x);
  gl_FragColor = vec4(e, logd, 0.0, 1.0);
}
`;

/** Bagliore, primo passo: dal mondo a metà risoluzione, con soglia morbida e media di Karis. */
export const FRAG_BLOOM_SOGLIA = /* glsl */ `
${COMUNE}
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform vec3 uSoglia;   // x soglia, y ginocchio, z tetto
varying vec2 vUv;
vec3 tap(vec2 o) { return min(texture2D(tSrc, vUv + o * uTexel).rgb, vec3(uSoglia.z)); }
void main() {
  vec3 a = tap(vec2(-1.0, -1.0));
  vec3 b = tap(vec2(1.0, -1.0));
  vec3 c = tap(vec2(-1.0, 1.0));
  vec3 d = tap(vec2(1.0, 1.0));
  float wa = 1.0 / (1.0 + luma(a));
  float wb = 1.0 / (1.0 + luma(b));
  float wc = 1.0 / (1.0 + luma(c));
  float wd = 1.0 / (1.0 + luma(d));
  vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  float br = max3(col);
  float k = clamp(br - uSoglia.x + uSoglia.y, 0.0, 2.0 * uSoglia.y);
  k = k * k / (4.0 * uSoglia.y + 1e-4);
  float contrib = max(k, br - uSoglia.x) / max(br, 1e-4);
  gl_FragColor = vec4(col * contrib, 1.0);
}
`;

/** Bagliore: discesa (filtro duale di Bjørge). */
export const FRAG_BLOOM_GIU = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 h = uTexel;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv - h).rgb;
  s += texture2D(tSrc, vUv + h).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb;
  s += texture2D(tSrc, vUv - vec2(h.x, -h.y)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}
`;

/** Bagliore: risalita a tenda (si somma al livello sopra in additivo). */
export const FRAG_BLOOM_SU = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uPeso;
varying vec2 vUv;
void main() {
  vec2 h = uTexel;
  vec3 s = texture2D(tSrc, vUv + vec2(-2.0 * h.x, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, 2.0 * h.y)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(2.0 * h.x, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, -2.0 * h.y)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 * uPeso, 1.0);
}
`;

/** Tensore di struttura (Sobel sul colore compresso): xyz = (E, G, F). */
export const FRAG_TENSORE = /* glsl */ `
${COMUNE}
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
vec3 c(float x, float y) { return comprimi(texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb); }
void main() {
  vec3 a = c(-1.0, -1.0), b = c(0.0, -1.0), d = c(1.0, -1.0);
  vec3 e = c(-1.0, 0.0), f = c(1.0, 0.0);
  vec3 g = c(-1.0, 1.0), h = c(0.0, 1.0), i = c(1.0, 1.0);
  vec3 sx = (d + 2.0 * f + i - a - 2.0 * e - g) * 0.25;
  vec3 sy = (g + 2.0 * h + i - a - 2.0 * b - d) * 0.25;
  gl_FragColor = vec4(dot(sx, sx), dot(sy, sy), dot(sx, sy), 1.0);
}
`;

/** Sfocatura gaussiana separabile del tensore (9 campioni in 5 letture lineari). */
export const FRAG_SFOCA = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;   // texel * direzione
varying vec2 vUv;
void main() {
  vec4 s = texture2D(tSrc, vUv) * 0.2270270270;
  s += texture2D(tSrc, vUv + uDir * 1.3846153846) * 0.3162162162;
  s += texture2D(tSrc, vUv - uDir * 1.3846153846) * 0.3162162162;
  s += texture2D(tSrc, vUv + uDir * 3.2307692308) * 0.0702702703;
  s += texture2D(tSrc, vUv - uDir * 3.2307692308) * 0.0702702703;
  gl_FragColor = s;
}
`;

/**
 * Filtro di Kuwahara con pesi polinomiali (Kyprianidis 2010): 8 settori sovrapposti, si tiene la
 * media dei settori con meno varianza. Definizioni: ANISOTROPO (ellissi orientate dal tensore di
 * struttura), RMAX (raggio massimo in pixel, limite dei cicli).
 * Il raggio si stringe vicino alla camera e sulla prima persona (mani, Velo, squadro), così i
 * dettagli vicini restano leggibili; i colori sono filtrati compressi (HDR ben educato).
 */
export const FRAG_KUWAHARA = /* glsl */ `
${COMUNE}
uniform sampler2D tSrc;
uniform sampler2D tInfo;
uniform sampler2D tDepth;
uniform sampler2D tTensore;
uniform vec2 uTexel;
uniform vec2 uNearFar;
uniform float uRaggio;
uniform vec2 uVicino;      // da questa distanza (m) a quest'altra il raggio torna pieno
uniform vec3 uLontano;     // fra x e y metri il raggio cresce fino a z volte (pennellate larghe sul fondo)
uniform float uOverlay;    // 1 se la prima persona ha disegnato
uniform float uDurezza;
uniform float uNitidezza;
uniform float uAlfa;       // quanto le ellissi si allungano (1 forte, 3 lieve)
varying vec2 vUv;

void main() {
  float logd = texture2D(tInfo, vUv).g;
  float z = uNearFar.x * exp2(logd * log2(uNearFar.y / uNearFar.x));
  float primoPiano = uOverlay * step(texture2D(tDepth, vUv).r, 0.99999);
  float k = mix(0.4, 1.0, smoothstep(uVicino.x, uVicino.y, z));
  // come un pittore: il fondo a pennellate larghe, il vicino più fine
  k *= mix(1.0, uLontano.z, smoothstep(uLontano.x, uLontano.y, z));
  k = mix(k, 0.35, primoPiano);
  float rr = max(uRaggio * k, 1.0);
#ifdef ANISOTROPO
  vec3 g = texture2D(tTensore, vUv).xyz;
  float disc = sqrt(max(0.0, g.y * g.y - 2.0 * g.x * g.y + g.x * g.x + 4.0 * g.z * g.z));
  float l1 = 0.5 * (g.y + g.x + disc);
  float l2 = 0.5 * (g.y + g.x - disc);
  vec2 tv = vec2(l1 - g.x, -g.z);
  vec2 t = length(tv) > 0.0 ? normalize(tv) : vec2(0.0, 1.0);
  float A = (l1 + l2 > 0.0) ? (l1 - l2) / (l1 + l2) : 0.0;
  float a = rr * clamp((uAlfa + A) / uAlfa, 0.1, 2.0);
  float b = rr * clamp(uAlfa / (uAlfa + A), 0.1, 2.0);
  // asse lungo dell'ellisse lungo t (la direzione dei bordi), asse corto attraverso
  mat2 SR = mat2(0.5 / a, 0.0, 0.0, 0.5 / b) * mat2(t.x, -t.y, t.y, t.x);
  int maxX = int(min(sqrt(a * a * t.x * t.x + b * b * t.y * t.y), float(RMAX) * 2.0));
  int maxY = int(min(sqrt(a * a * t.y * t.y + b * b * t.x * t.x), float(RMAX) * 2.0));
#else
  mat2 SR = mat2(0.5 / rr, 0.0, 0.0, 0.5 / rr);
  int maxX = int(min(rr, float(RMAX)));
  int maxY = maxX;
#endif
  float zeta = 2.0 / rr;
  float zc = 0.58;
  float eta = (zeta + cos(zc)) / (sin(zc) * sin(zc));
  vec4 m[8];
  vec3 s[8];
  for (int q = 0; q < 8; ++q) { m[q] = vec4(0.0); s[q] = vec3(0.0); }
  for (int y = -maxY; y <= maxY; ++y) {
    for (int x = -maxX; x <= maxX; ++x) {
      vec2 v = SR * vec2(float(x), float(y));
      if (dot(v, v) > 0.25) continue;
      vec3 c = comprimi(texture2D(tSrc, vUv + vec2(float(x), float(y)) * uTexel).rgb);
      float w[8];
      float sum = 0.0;
      float zz;
      float vxx = zeta - eta * v.x * v.x;
      float vyy = zeta - eta * v.y * v.y;
      zz = max(0.0, v.y + vxx); w[0] = zz * zz; sum += w[0];
      zz = max(0.0, -v.x + vyy); w[2] = zz * zz; sum += w[2];
      zz = max(0.0, -v.y + vxx); w[4] = zz * zz; sum += w[4];
      zz = max(0.0, v.x + vyy); w[6] = zz * zz; sum += w[6];
      v = 0.70710678 * vec2(v.x - v.y, v.x + v.y);
      vxx = zeta - eta * v.x * v.x;
      vyy = zeta - eta * v.y * v.y;
      zz = max(0.0, v.y + vxx); w[1] = zz * zz; sum += w[1];
      zz = max(0.0, -v.x + vyy); w[3] = zz * zz; sum += w[3];
      zz = max(0.0, -v.y + vxx); w[5] = zz * zz; sum += w[5];
      zz = max(0.0, v.x + vyy); w[7] = zz * zz; sum += w[7];
      float gw = exp(-3.125 * dot(v, v)) / max(sum, 1e-6);
      for (int q = 0; q < 8; ++q) {
        float wk = w[q] * gw;
        m[q] += vec4(c * wk, wk);
        s[q] += c * c * wk;
      }
    }
  }
  vec4 o = vec4(0.0);
  for (int q = 0; q < 8; ++q) {
    if (m[q].w <= 0.0) continue;
    vec3 mu = m[q].rgb / m[q].w;
    vec3 sg = abs(s[q] / m[q].w - mu * mu);
    float sigma2 = sg.r + sg.g + sg.b;
    float w = 1.0 / (1.0 + pow(uDurezza * 1000.0 * sigma2, 0.5 * uNitidezza));
    o += vec4(mu * w, w);
  }
  vec3 res = o.w > 0.0 ? espandi(o.rgb / o.w) : texture2D(tSrc, vUv).rgb;
  gl_FragColor = vec4(res, 1.0);
}
`;

/**
 * Passata finale: contorni colorati, bagliore, mappatura dei toni, correzione colore, pennellata,
 * grana della carta, vignettatura e un filo di dithering. Scrive sul canvas.
 */
export const FRAG_FINALE = /* glsl */ `
${COMUNE}
uniform sampler2D tPaint;
uniform sampler2D tScena;
uniform sampler2D tBloom;
uniform sampler2D tInfo;
uniform sampler2D tDepth;
uniform sampler2D tTensore;
uniform vec2 uTexelIn;       // texel del mondo (risoluzione interna)
uniform vec2 uTexelPaint;    // texel della pittura (metà risoluzione con il filtro a metà)
uniform vec2 uFiltro;        // x: 1 se c'è la pittura del filtro, y: 1 se è a metà risoluzione
uniform vec3 uDettaglio;     // x,y soglia di contrasto dei dettagli da salvare, z quanto
uniform vec2 uRisoluzione;   // pixel d'uscita
uniform float uOverlay;
uniform float uFxaa;
uniform float uBloom;
uniform vec2 uContorni;      // x mondo, y prima persona
uniform float uOrientata;    // 1: pennellata lungo il tensore di struttura
uniform vec3 uCarta;         // x pennellata, y grana, z macchie
uniform vec3 uTremolio;      // x ampiezza (pixel a 1080p), y scala (pixel a 1080p), z variazione di colore delle pennellate
uniform vec4 uVignetta;      // rgb colore, a forza
uniform float uEsposizione;
uniform float uTonemap;      // 0 spalla pittorica, 1 ACES, 2 AgX, 3 ACES di giorno e spalla di notte
uniform float uGinocchio;
uniform vec4 uGrade;         // x saturazione, y vibranza, z contrasto, w perno del contrasto
uniform vec3 uLuci;          // tinta delle luci
uniform vec3 uOmbre;         // tinta delle ombre
uniform float uNotte;
varying vec2 vUv;

vec3 fxaa(vec2 uv) {
  vec2 t = uTexelIn;
  vec3 cM = texture2D(tScena, uv).rgb;
  float lM = luma(comprimi(cM));
  float lNW = luma(comprimi(texture2D(tScena, uv + vec2(-t.x, -t.y)).rgb));
  float lNE = luma(comprimi(texture2D(tScena, uv + vec2(t.x, -t.y)).rgb));
  float lSW = luma(comprimi(texture2D(tScena, uv + vec2(-t.x, t.y)).rgb));
  float lSE = luma(comprimi(texture2D(tScena, uv + vec2(t.x, t.y)).rgb));
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.04, lMax * 0.12)) return cM;
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float red = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
  dir = clamp(dir * rcp, -8.0, 8.0) * t;
  vec3 a = 0.5 * (texture2D(tScena, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tScena, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tScena, uv - dir * 0.5).rgb + texture2D(tScena, uv + dir * 0.5).rgb);
  float lB = luma(comprimi(b));
  return (lB < lMin || lB > lMax) ? a : b;
}

// colore del contorno: la stessa tinta, più scura e più satura, verso un bruno-viola (mai nero)
vec3 inchiostro(vec3 c) {
  vec3 cc = comprimi(c) * 2.0;
  float l = luma(cc);
  vec3 sat = max(mix(vec3(l), cc, 1.55), 0.0);
  return sat * vec3(0.42, 0.37, 0.45) + vec3(0.035, 0.022, 0.05);
}

vec3 spalla(vec3 c) {
  float m = max3(c);
  float k = uGinocchio;
  if (m <= k) return c;
  float mm = k + (1.0 - k) * (1.0 - exp(-(m - k) / (1.0 - k)));
  vec3 r = c * (mm / m);
  // le luci fortissime (Linea, Meta, lumi) sbiancano come sulla pellicola
  return mix(r, vec3(mm), smoothstep(1.0, 4.0, m) * 0.85);
}

vec3 acesFit(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 agx(vec3 c) {
  const mat3 inset = mat3(0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859);
  const mat3 outset = mat3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405);
  c = inset * max(c, vec3(1e-10));
  c = clamp((log2(c) + 12.47393) / 16.500999, 0.0, 1.0);
  vec3 x2 = c * c;
  vec3 x4 = x2 * x2;
  c = 15.5 * x4 * x2 - 40.14 * x4 * c + 31.96 * x4 - 6.868 * x2 * c + 0.4298 * x2 + 0.1191 * c - 0.00232;
  c = outset * c;
  return clamp(pow(max(c, vec3(0.0)), vec3(2.2)), 0.0, 1.0);
}

// ACES calibrato sulla tavolozza del gioco: il grigio medio resta dov'è (0,18 → 0,18), il bianco
// della carta resta quasi bianco (1 → 0,89 lineare, 0,95 sRGB), le ombre si fanno più profonde e
// le luci sopra 1 (Linea, lumi, Meta) vanno verso il bianco per canale, come sulla pellicola
vec3 acesCalibrato(vec3 lin) {
  return acesFit(lin * 0.58) / 0.743;
}

vec3 acesSrgb(vec3 c) {
  // ACES lavora in lineare: si torna allo sRGB «da pittore» alla fine
  vec3 lin = pow(max(c, vec3(0.0)), vec3(2.2));
  return pow(clamp(acesCalibrato(lin), 0.0, 1.0), vec3(1.0 / 2.2));
}

vec3 mappaToni(vec3 c) {
  c *= uEsposizione;
  if (uTonemap < 0.5) return clamp(spalla(c), 0.0, 1.0);
  if (uTonemap < 1.5) return acesSrgb(c);
  if (uTonemap > 2.5) {
    // giorno e notte: ACES calibrato di giorno (ombre profonde, contrasto da pellicola), la
    // spalla di notte (ACES scurirebbe troppo il blu-viola e le pozze dei lumi)
    return mix(acesSrgb(c), clamp(spalla(c), 0.0, 1.0), smoothstep(0.15, 0.75, uNotte));
  }
  vec3 lin = pow(max(c, vec3(0.0)), vec3(2.2));
  return pow(clamp(agx(lin * 1.6), 0.0, 1.0), vec3(1.0 / 2.2));
}

vec3 correggi(vec3 c) {
  float l = luma(c);
  // vibranza: spinge di più i colori spenti, poco quelli già carichi
  float satNow = max3(c) - min(c.r, min(c.g, c.b));
  float s = uGrade.x + uGrade.y * (1.0 - smoothstep(0.0, 0.6, satNow));
  c = max(mix(vec3(l), c, s), 0.0);
  // contrasto a S attorno al perno
  vec3 d = c - uGrade.w;
  c = c + uGrade.z * d * (1.0 - min(abs(d) * 1.8, 1.0));
  // viraggio: luci calde, ombre fredde (più viola di notte)
  float h = smoothstep(0.15, 0.85, l);
  c *= mix(uOmbre, uLuci, h);
  return clamp(c, 0.0, 1.0);
}

float primoPiano(vec2 uv) {
  return uOverlay * step(texture2D(tDepth, uv).r, 0.99999);
}

// la pittura del filtro: a metà risoluzione si riporta su seguendo i bordi del colore originale
// (upsampling congiunto); poi i dettagli forti e sottili (tratti di matita, finestrelle, stelle,
// scritte) tornano sopra: il filtro spiana solo le tessiture deboli
vec3 pittura(vec2 uv, vec3 orig, float pp) {
  if (uFiltro.x < 0.5) return orig;
  vec3 o = comprimi(orig);
  vec3 k;
  if (uFiltro.y > 0.5) {
    vec2 tp = uv / uTexelPaint - 0.5;
    vec2 f = fract(tp);
    vec2 b = (floor(tp) + 0.5) * uTexelPaint;
    vec3 c00 = texture2D(tPaint, b).rgb;
    vec3 c10 = texture2D(tPaint, b + vec2(uTexelPaint.x, 0.0)).rgb;
    vec3 c01 = texture2D(tPaint, b + vec2(0.0, uTexelPaint.y)).rgb;
    vec3 c11 = texture2D(tPaint, b + uTexelPaint).rgb;
    vec3 d00 = comprimi(c00) - o;
    vec3 d10 = comprimi(c10) - o;
    vec3 d01 = comprimi(c01) - o;
    vec3 d11 = comprimi(c11) - o;
    float w00 = (1.0 - f.x) * (1.0 - f.y) * exp(-dot(d00, d00) * 90.0) + 1e-5;
    float w10 = f.x * (1.0 - f.y) * exp(-dot(d10, d10) * 90.0) + 1e-5;
    float w01 = (1.0 - f.x) * f.y * exp(-dot(d01, d01) * 90.0) + 1e-5;
    float w11 = f.x * f.y * exp(-dot(d11, d11) * 90.0) + 1e-5;
    k = (c00 * w00 + c10 * w10 + c01 * w01 + c11 * w11) / (w00 + w10 + w01 + w11);
  } else {
    k = texture2D(tPaint, uv).rgb;
  }
  float dl = abs(luma(o) - luma(comprimi(k)));
  float salva = smoothstep(uDettaglio.x, uDettaglio.y, dl) * uDettaglio.z;
  return mix(k, orig, max(salva, pp * 0.25));
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float sc = uRisoluzione.y / 1080.0;
  vec2 uv = vUv;
  float pp = primoPiano(uv);
  // tremolio della mano: i bordi dritti dei poligoni ondeggiano appena, come tirati a pennello
  // (fermo sullo schermo; niente sulla prima persona, che resta ferma e leggibile)
  if (uTremolio.x > 0.0) {
    vec2 qn = px / (uTremolio.y * sc);
    vec2 w = vec2(vnoise(qn), vnoise(qn + 19.7)) - 0.5;
    w += (vec2(vnoise(qn * 2.7 + 5.1), vnoise(qn * 2.7 + 31.3)) - 0.5) * 0.45;
    uv += w * 2.0 * uTremolio.x * sc / uRisoluzione * (1.0 - pp);
  }
  vec3 col = uFxaa > 0.5 ? fxaa(uv) : texture2D(tScena, uv).rgb;
  col = pittura(uv, col, pp);

  // contorni: del mondo (dalla profondità) e della prima persona (dalla sua sagoma)
  vec2 t = uTexelIn * 1.5;
  float ppBordo = pp * (1.0 - 0.25 * (primoPiano(uv + vec2(t.x, 0.0)) + primoPiano(uv - vec2(t.x, 0.0)) + primoPiano(uv + vec2(0.0, t.y)) + primoPiano(uv - vec2(0.0, t.y))));
  vec2 to = uTexelIn * 0.75;
  vec4 i0 = texture2D(tInfo, uv);
  float eSum = i0.r * 2.0 + texture2D(tInfo, uv + vec2(to.x, to.y)).r + texture2D(tInfo, uv - vec2(to.x, to.y)).r + texture2D(tInfo, uv + vec2(to.x, -to.y)).r + texture2D(tInfo, uv - vec2(to.x, -to.y)).r;
  float e = smoothstep(0.0, 0.75, eSum / 6.0) * (1.0 - pp) * uContorni.x;
  float inkK = clamp(max(e, ppBordo * 2.0 * uContorni.y), 0.0, 1.0);
  col = mix(col, inchiostro(col), inkK);

  col += texture2D(tBloom, uv).rgb * uBloom;
  col = mappaToni(col);
  col = correggi(col);

  // pennellata: rumore stirato lungo la direzione del colore (tensore) o di un campo morbido
  if (uCarta.x > 0.0) {
    vec2 dir;
    float forza = 0.6;
    if (uOrientata > 0.5) {
      vec3 g = texture2D(tTensore, uv).xyz;
      float disc = sqrt(max(0.0, g.y * g.y - 2.0 * g.x * g.y + g.x * g.x + 4.0 * g.z * g.z));
      float l1 = 0.5 * (g.y + g.x + disc);
      float l2 = 0.5 * (g.y + g.x - disc);
      vec2 tv = vec2(l1 - g.x, -g.z);
      dir = length(tv) > 1e-6 ? normalize(tv) : vec2(0.7071, 0.7071);
      float A = (l1 + l2 > 1e-6) ? (l1 - l2) / (l1 + l2) : 0.0;
      // nelle zone piatte la direzione è casuale: si torna al campo morbido
      float ang = 0.8 + (vnoise(uv * vec2(uRisoluzione.x / uRisoluzione.y, 1.0) * 2.2) - 0.5) * 1.3;
      dir = normalize(mix(vec2(cos(ang), sin(ang)), dir, smoothstep(0.15, 0.6, A)));
      forza = 0.6 + 0.4 * A;
    } else {
      float ang = 0.8 + (vnoise(uv * vec2(uRisoluzione.x / uRisoluzione.y, 1.0) * 2.2) - 0.5) * 1.3;
      dir = vec2(cos(ang), sin(ang));
    }
    vec2 q = vec2(dot(px, dir), dot(px, vec2(-dir.y, dir.x))) / sc;
    float st = vnoise(q * vec2(1.0 / 16.0, 1.0 / 2.6)) * 0.65 + vnoise(q * vec2(1.0 / 40.0, 1.0 / 6.0) + 13.7) * 0.35;
    col *= 1.0 + (st - 0.5) * uCarta.x * forza * (0.6 + 0.8 * luma(col));
    // le pennellate non sono solo più chiare o più scure: tirano un po' al caldo o al freddo
    float tono = vnoise(q * vec2(1.0 / 60.0, 1.0 / 9.0) + 41.0) - 0.5;
    col *= 1.0 + vec3(1.0, 0.15, -0.9) * tono * uTremolio.z * (1.0 - pp);
  }
  // grana della carta: puntini, fibre e macchie larghe (ferma sullo schermo, come un foglio)
  if (uCarta.y > 0.0) {
    float g1 = hash12(floor(px)) - 0.5;
    float g2 = vnoise(px / (2.2 * sc)) - 0.5;
    vec2 pf = vec2(px.x * 0.8 + px.y * 0.6, -px.x * 0.6 + px.y * 0.8) / sc;
    float fib = vnoise(pf * vec2(1.0 / 34.0, 1.0 / 1.6)) - 0.5;
    float g = g1 * 0.3 + g2 * 0.55 + fib * 0.45;
    float mac = vnoise(uv * vec2(uRisoluzione.x / uRisoluzione.y, 1.0) * 5.0) * 0.6 + vnoise(uv * 13.0) * 0.4 - 0.5;
    col *= 1.0 + g * uCarta.y + mac * uCarta.z;
  }
  // vignettatura calda
  vec2 dv = (uv - 0.5) * vec2(uRisoluzione.x / uRisoluzione.y, 1.0);
  float v = smoothstep(0.42, 1.05, length(dv) * 1.05);
  col = mix(col, col * uVignetta.rgb, v * uVignetta.a);
  col += (hash12(px + 17.3) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
