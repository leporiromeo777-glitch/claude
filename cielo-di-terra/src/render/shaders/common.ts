/**
 * Pezzi GLSL condivisi dallo shader del mondo (terreno, oggetti, nubi, acqua).
 *
 * Stile: campiture quasi piatte con bande di luce morbide, pennellata leggera in
 * spazio mondo, prospettiva aerea forte a "quinte teatrali" e, per cella, il passaggio
 * fra mondo DIPINTO (rilevato: inchiostro e colore pieno) e mondo ABBOZZATO (non rilevato:
 * acquerello schiarito e desaturato, velatura di carta, tratteggio e curve di livello a
 * matita) con l'animazione "l'inchiostro si allarga".
 *
 * Modello di luce (traccia «luce», vedi docs/grafica/luce.md):
 * - luce principale calda dal NUCLEO della Linea, che scorre lungo l'asse durante il giorno
 *   (`uSole.x`): radente lungo la valle al mattino e alla sera, alta a mezzogiorno;
 * - riempimento freddo emisferico dal cielo e rimbalzo caldo dal suolo;
 * - ombre portate morbide vicino alla camera (`uOmbra*`, vedi `render/ombre.ts`);
 * - occlusione ambientale, luce trasmessa (controluce) e riflessi per tipo di superficie;
 * - di notte: brace blu-viola, colori che perdono saturazione, pozze calde dei lumi.
 *
 * Tutti i colori sono nello spazio sRGB "da pittore": il renderer non converte.
 * Le firme storiche (`shadeLit`, `applyHaze`, `applyHazeK`, `pencilColor`, `paintState`,
 * `lineaLightDir`, `lineaReach`, `bandLight`) restano valide per gli altri materiali
 * (acqua, nubi del Collare, vetri delle Finestre).
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
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
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
// celle di Voronoi in una sola passata (9 campioni): x = F2 - F1 (misura del bordo, in celle),
// y = distanza dal centro, z = identità della cella (0..1)
vec3 voronoiVeloce(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float d1 = 8.0;
  float d2 = 8.0;
  vec2 c1 = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + hash22(n + g) * 0.86 + 0.07 - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; c1 = n + g; }
      else if (d < d2) { d2 = d; }
    }
  }
  float a = sqrt(d1);
  return vec3(sqrt(d2) - a, a, hash12(c1 + 0.37));
}
// celle di Voronoi economiche (4 campioni, centri spostati al più di un quarto di cella): stesso
// risultato di voronoiVeloce salvo rari errori invisibili nelle pennellate morbide
vec3 voronoi4(vec2 x) {
  vec2 n = floor(x - 0.5);
  vec2 f = x - n;
  float d1 = 8.0;
  float d2 = 8.0;
  vec2 c1 = vec2(0.0);
  for (int k = 0; k < 4; k++) {
    vec2 g = vec2(float(k & 1), float(k >> 1));
    vec2 r = g + hash22(n + g) * 0.5 + 0.25 - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; c1 = n + g; }
    else if (d < d2) { d2 = d; }
  }
  float a = sqrt(d1);
  return vec3(sqrt(d2) - a, a, hash12(c1 + 0.37));
}
// celle di Voronoi: x = distanza dal bordo della cella, y = distanza dal centro, z = identità (0..1);
// w = 0. 'rel' (out) = vettore dal punto al centro della cella (per le normali "a cuscino").
vec4 voronoi2(vec2 x, out vec2 rel) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g) * 0.86 + 0.07;
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  }
  float ed = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 o = hash22(n + g) * 0.86 + 0.07;
      vec2 r = g + o - f;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 1e-5) ed = min(ed, dot(0.5 * (mr + r), normalize(dr)));
    }
  }
  rel = mr;
  return vec4(ed, sqrt(md), hash12(n + mg + 0.37), 0.0);
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
uniform vec4 uHaze;          // x = densità (1/m), y = massimo, z = forza delle quinte, w = velo dell'altra metà
uniform float uNight;
uniform vec3 uLampColor;
uniform vec4 uLamps[8];      // xyz posizione, w intensità (qui contano solo quelli con w >= 2: le Fade)
uniform vec4 uPozze[24];     // pozze calde dei lumi vicini: xyz posizione, w = 1 + distanza dalla camera (0 = fine)
uniform sampler2D uCellTex;
uniform vec4 uCellGrid;      // nZ, nTheta, dz (m), dTheta (gradi)
uniform vec4 uPencil;        // x,y = raggio "vicino sempre dipinto" (inizio, fine); z = forza matita globale; w = durata rivelazione
uniform float uPixelAngle;   // radianti per pixel (per il tratteggio stabile con la distanza)
uniform float uDebugView;    // 0 normale, 1 normali, 2 albedo (viste di prova)
uniform vec4 uSole;          // x = z del nucleo della Linea, y = radenza, z = componente laterale, w = forza della luce principale
uniform vec3 uHazeSun;       // foschia in controluce verso il nucleo
uniform vec3 uHazeZenith;    // foschia "allo zenit" (raggi vicini all'asse); uHazeColor = verso l'orizzonte
uniform float uGolden;       // 0..1 alba/tramonto
uniform vec4 uAria;          // x = densità al suolo (1/m), y = scala d'altezza (m), z = frazione in quota, w = diffusione in avanti
uniform vec4 uLuce;          // x = ombre portate, y = occlusione dai vertici, z = luce trasmessa, w = saturazione del dipinto
uniform vec4 uAcquerello;    // x = colore nel non rilevato, y = forza della matita, z = velatura di carta, w = granulazione
uniform mat4 uOmbraMatrice;  // mondo -> [0,1]^3 della mappa d'ombra (bias di profondità incluso)
uniform highp sampler2DShadow uOmbraMappa;
uniform vec4 uOmbra;         // x = accese (0/1), y = texel (uv), z = inizio sparizione (m), w = fine sparizione (m)
uniform vec4 uOmbraCentro;   // xyz = centro della zona d'ombra, w = metri per texel
uniform float uCellAnim;     // istante (s) dell'ultima rivelazione animata: serve a saltare le celle vicino
uniform float uDettaglio;    // 1 = motivi pieni; < 0.5 = solo i motivi economici (qualità bassa)
uniform sampler2D uAlberiOmbra; // densità delle chiome (u = theta/360, v = z/L, ~4 m per texel)
uniform vec4 uAlberiInfo;    // x = 1 se c'è la texture, y = forza dell'ombra
`;

/** Funzioni del cilindro, luce della Linea, ombre, foschia. */
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

float lumaP(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }

// direzione della luce principale in P: verso il nucleo della Linea sull'asse (uSole.x),
// resa più radente da uSole.y, con la componente laterale uSole.z (stessa formula di keyLightDir)
vec3 lineaLightDir(vec3 P, vec3 up) {
  vec3 east = vec3(-up.y, up.x, 0.0);
  float r = max(length(P.xy), 40.0);
  vec3 L = up * (r * uSole.y) + east * (r * uSole.z) + vec3(0.0, 0.0, uSole.x - P.z);
  L = normalize(L);
  // di notte la brace è diffusa lungo tutto l'asse: luce dall'alto
  return normalize(mix(L, up, uNight));
}

// quanta luce "calda" arriva in P (attenuata oltre la punta accesa e lontano dal nucleo)
float lineaReach(vec3 P) {
  float dz = max(0.0, P.z - uLineaIgnite);
  float tip = 1.0 / (1.0 + dz * dz / (260.0 * 260.0));
  float dc = abs(P.z - uSole.x);
  float core = mix(0.8, 1.0, exp(-dc * dc / (1600.0 * 1600.0)));
  return mix(tip * core, 1.0, uNight);
}

// ombra degli alberi sul terreno (rifinitura 2): la densità delle chiome letta dove sta la chioma che
// fa ombra a P (spostata verso la luce di altezza/elevazione, la chioma è a ~5,5 m), più un poco
// d'occlusione proprio sotto. 1 = niente ombra. Oltre la zona delle ombre portate è l'unica ombra
// degli alberi: senza, da lontano le chiome galleggiavano sul prato come lecca-lecca
float ombraAlberi(vec3 P, vec3 up) {
  if (uAlberiInfo.x < 0.5) return 1.0;
  vec3 L = lineaLightDir(P, up);
  float el = max(dot(L, up), 0.22);
  vec3 off = (L - up * dot(L, up)) * (5.5 / el);
  float lo = length(off);
  if (lo > 24.0) off *= 24.0 / lo;
  vec3 Q = P + off;
  float dq = texture(uAlberiOmbra, vec2(cylThetaDeg(Q) / 360.0, Q.z / uLen)).r;
  float d0 = texture(uAlberiOmbra, vec2(cylThetaDeg(P) / 360.0, P.z / uLen)).r;
  float giorno = (1.0 - uNight) * smoothstep(0.05, 0.5, uSunIntensity);
  return (1.0 - dq * uAlberiInfo.y * giorno) * (1.0 - d0 * 0.12);
}

// lambert a bande morbide (campiture); 'k' = forza delle bande
float bandLightK(float x, float k) {
  x = clamp(x, 0.0, 1.0);
  float n = 3.0;
  float xs = x * n;
  float fl = floor(xs);
  float fr = xs - fl;
  float stepped = (fl + smoothstep(0.38, 0.62, fr)) / n;
  return mix(x, stepped, k);
}
float bandLight(float x) {
  return bandLightK(x, 0.62);
}

// pozze calde dei lumi (finestre, lanterne, lampioni): solo di notte, con caduta morbida
vec3 lampLight(vec3 P, vec3 N) {
  // di giorno niente lumi: si salta il ciclo (ramo uniforme, uguale per tutti i pixel)
  if (uNight < 0.01) return vec3(0.0);
  vec3 acc = vec3(0.0);
  // le luci in più (le Fade, w >= 2): larghe e morbide
  for (int i = 0; i < 8; i++) {
    vec4 l = uLamps[i];
    if (l.w < 2.0) continue;
    vec3 d = l.xyz - P;
    float dist = length(d);
    float att = l.w / (1.0 + dist * dist * 0.11) * (1.0 - smoothstep(9.0, 24.0, dist));
    float ndl = clamp(dot(N, d / max(dist, 1e-3)) * 0.65 + 0.35, 0.0, 1.0);
    acc += uLampColor * att * ndl;
  }
  // le pozze dei lumi vicini (i più vicini prima; w = 0 chiude l'elenco): un cerchio caldo di 5-7 m
  // sul suolo e sui muri, che cade come 1/(1+d²) e finisce a 11 m. I lumi arrivano in ordine di
  // distanza dalla camera (w = 1 + quella distanza), tutti entro 120 m: un frammento a dCam dalla
  // camera prende luce solo dai lumi fra dCam - 11 e dCam + 11, quindi il ciclo salta gli altri e
  // si ferma al primo troppo lontano (e oltre 132 m non parte nemmeno)
  vec3 pozza = vec3(1.0, 0.69, 0.376);
  const float POZZE_FORZA = 1.2;
  float dCam = distance(P, cameraPosition);
  if (dCam < 132.0) {
    for (int i = 0; i < 24; i++) {
      vec4 l = uPozze[i];
      if (l.w <= 0.0) break;
      float dl = l.w - 1.0;
      if (dl > dCam + 11.0) break;
      if (dl < dCam - 11.0) continue;
      vec3 d = l.xyz - P;
      float dd = dot(d, d);
      if (dd > 121.0) continue;
      float dist = sqrt(dd);
      float att = POZZE_FORZA / (1.0 + dd * 0.1) * (1.0 - smoothstep(6.0, 11.0, dist));
      float ndl = clamp(dot(N, d / max(dist, 1e-3)) * 0.6 + 0.4, 0.0, 1.0);
      acc += pozza * (att * ndl * 1.3);
    }
  }
  return acc * uNight * 0.62;
}

// --- ombre portate morbide (mappa di profondità di una sorgente virtuale che segue la camera) ---
const vec2 POISSON8[8] = vec2[8](
  vec2(-0.613, 0.354), vec2(0.170, -0.857), vec2(0.739, 0.468), vec2(-0.270, -0.330),
  vec2(0.268, 0.215), vec2(-0.880, -0.320), vec2(0.553, -0.420), vec2(-0.092, 0.902)
);

// 1 = in luce, 0 = in ombra. ndl serve a spostare il campione lungo la normale (contro l'acne).
float ombraPortata(vec3 P, vec3 N, float ndl) {
  if (uOmbra.x < 0.5) return 1.0;
  float dc = distance(P, uOmbraCentro.xyz);
  if (dc > uOmbra.w) return 1.0;
  float tex = uOmbraCentro.w;
  vec3 Po = P + N * tex * (1.2 + 2.2 * (1.0 - clamp(abs(ndl), 0.0, 1.0)));
  vec4 sc = uOmbraMatrice * vec4(Po, 1.0);
  vec3 s = sc.xyz / sc.w;
  if (s.x <= 0.002 || s.x >= 0.998 || s.y <= 0.002 || s.y >= 0.998 || s.z >= 1.0) return 1.0;
  // disco di Poisson ruotato per pixel: penombra morbida (più larga lontano dalla camera)
  float a = hash12(gl_FragCoord.xy) * 6.2831853;
  float ca = cos(a);
  float sa = sin(a);
  float rad = uOmbra.y * (1.6 + dc * 0.03);
  float sum = 0.0;
  for (int i = 0; i < 8; i++) {
    vec2 o = POISSON8[i];
    o = vec2(ca * o.x - sa * o.y, sa * o.x + ca * o.y) * rad;
    sum += texture(uOmbraMappa, vec3(s.xy + o, s.z));
  }
  sum *= 0.125;
  return mix(sum, 1.0, smoothstep(uOmbra.z, uOmbra.w, dc));
}

/**
 * Risposta di una superficie alla luce: i pattern delle superfici (render/superfici.ts)
 * riempiono questa struttura, 'shadeSup' la illumina.
 */
struct Sup {
  vec3 albedo;
  vec3 N;       // normale (eventualmente perturbata dal pattern)
  float ao;     // occlusione ambientale (1 = nessuna)
  float trasm;  // luce trasmessa in controluce (fogliame, tele)
  float spec;   // forza del riflesso (metalli, vetro)
  float lucido; // esponente del riflesso
  float bordo;  // bordo luminoso (fogliame: luce sui contorni)
  vec3 specC;   // colore del riflesso
  float bande;  // forza delle bande di luce (campiture): 0 = sfumato, 1 = tre toni netti
  float avvolge; // luce avvolgente del fogliame (0..1): l'interno della chioma resta verde medio
};

Sup supBase(vec3 albedo, vec3 N) {
  Sup s;
  s.albedo = albedo;
  s.N = N;
  s.ao = 1.0;
  s.trasm = 0.0;
  s.spec = 0.0;
  s.lucido = 24.0;
  s.bordo = 0.0;
  s.specC = vec3(1.0);
  s.bande = 0.62;
  s.avvolge = 0.0;
  return s;
}

// colore illuminato di una superficie. 'Nv' = normale geometrica (per le ombre), V verso la camera.
vec3 shadeSup(Sup s, vec3 Nv, vec3 P, vec3 V, out float tone) {
  vec3 up = cylUp(P);
  vec3 L = lineaLightDir(P, up);
  vec3 N = s.N;
  float ndl = dot(N, L);
  float ndlG = dot(Nv, L);
  float reach = lineaReach(P);
  float sh = mix(1.0, ombraPortata(P, Nv, ndlG), uLuce.x);
  // fogliame (rifinitura 2): luce avvolgente. La chioma è un volume di foglie che lascia passare la
  // luce: le ombre portate pesano meno, il lato in ombra prende più cielo e l'albedo non scende
  // sotto un verde medio. Senza, sotto le chiome scure (il tasso del sagrato) la mappatura dei
  // toni schiacciava tutto al nero puro
  float av = s.avvolge;
  if (av > 0.0) {
    sh = mix(sh, mix(1.0, sh, 0.65), av);
    float la = lumaP(s.albedo);
    s.albedo *= mix(1.0, max(1.0, 0.25 / max(la, 1e-3)), av);
  }
  // le facce geometricamente in ombra non tornano in luce per la normale del pattern
  float self = smoothstep(-0.25, 0.05, ndlG);
  float b = bandLightK((ndl + 0.18) / 1.18, s.bande) * reach * sh * mix(0.35, 1.0, self);
  // luce radente = più dorata (spessore d'aria attraversato dalla luce)
  float elev = clamp(dot(L, up), 0.0, 1.0);
  // (rifinitura 2: 0.6 invece di 0.85, e la luce dorata 1.25 invece di 1.5: l'oro sta nella luce
  // radente e dal lato del sole, non su tutto il quadro)
  float warmK = (1.0 - smoothstep(0.12, 0.62, elev)) * (1.0 - uNight) * 0.5;
  vec3 sunC = uSunColor * mix(vec3(1.0), vec3(1.1, 0.86, 0.64), warmK);
  // all alba e al tramonto la luce calda è più piena (come nei bozzetti: la luce radente "accende")
  float key = uSunIntensity * uSole.w * mix(1.0, 1.25, uGolden);
  // riempimento emisferico: cielo freddo sopra, rimbalzo caldo dal suolo sotto (più basso
  // all'alba e al tramonto: il contrasto fra luce dorata e ombra fredda è quello dei bozzetti)
  float hemi = dot(N, up) * 0.5 + 0.5;
  hemi = mix(hemi, 0.35 + 0.65 * hemi, av);
  // (di notte il riempimento del cielo sul suolo cala: il suolo resta più scuro del cielo e le
  // pozze dei lumi si leggono)
  vec3 fill = mix(uAmbBottom, uAmbTop, hemi) * mix(1.0, 0.92, uGolden) * mix(1.0, 0.72, uNight);
  float occ = mix(1.0, s.ao, uLuce.y);
  // notte: i colori perdono saturazione e virano al blu (i lumi invece li mostrano veri)
  vec3 albN = mix(s.albedo, vec3(lumaP(s.albedo)) * vec3(0.7, 0.94, 1.22), 0.62 * uNight);
  // (taratura: al sole pieno ~1.15 volte l'albedo, in ombra ~0.5 e più azzurro: ombre piene di
  // luce riflessa, come nei bozzetti, mai nere)
  vec3 light = fill * (0.78 * occ) + sunC * (key * b * 0.66);
  // luce rimbalzata dal suolo dove la luce principale non arriva (ombre portate e lati in ombra):
  // le ombre del bozzetto 2 sono oliva calde, piene di luce, non verde acqua scuro
  light += uAmbBottom * (0.25 * occ * (1.0 - clamp(b, 0.0, 1.0)) * (1.0 - uNight));
  // (fogliame) il cielo filtra fra le foglie anche dentro la chioma
  light += uAmbTop * (0.26 * av * (1.0 - 0.6 * uNight));
  vec3 col = albN * light;
  // banda calda sul terminatore (nella pittura il passaggio luce-ombra è più saturo)
  float term = smoothstep(-0.08, 0.1, ndl) * (1.0 - smoothstep(0.1, 0.42, ndl)) * reach * sh * key;
  vec3 sat = albN * albN * 1.6;
  col += (sat - albN * 0.6) * sunC * term * 0.22;
  // luce trasmessa: controluce attraverso foglie e tele
  if (s.trasm > 0.0) {
    float back = pow(clamp(-dot(V, L), 0.0, 1.0), 2.5);
    float thin = 0.45 + 0.55 * smoothstep(0.25, -0.5, ndl);
    col += s.albedo * s.albedo * 2.2 * sunC * (key * reach * sh * back * thin * s.trasm * uLuce.z);
  }
  // bordo luminoso (fogliame): luce che sfiora i contorni dal lato del sole
  if (s.bordo > 0.0) {
    float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
    float side = clamp(dot(N, L) * 0.6 + 0.4, 0.0, 1.0);
    col += s.albedo * sunC * (rim * side * key * reach * sh * s.bordo * 0.8);
  }
  // riflesso (metalli, vetro, ottone)
  if (s.spec > 0.0) {
    vec3 H = normalize(L + V);
    float sp = pow(clamp(dot(N, H), 0.0, 1.0), s.lucido);
    sp = mix(sp, smoothstep(0.35, 0.55, sp), 0.6); // riflesso "dipinto" a bordo netto
    col += s.specC * sunC * (sp * s.spec * key * reach * sh * 1.6);
    // ambiente riflesso: cielo sopra, terra sotto
    vec3 Rf = reflect(-V, N);
    vec3 env = mix(uAmbBottom * 0.7, mix(uHazeColor, uAmbTop, 0.4), smoothstep(-0.3, 0.4, dot(Rf, up)));
    float fr = 0.25 + 0.75 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
    col = mix(col, env * s.specC, clamp(s.spec * fr * 0.5, 0.0, 0.8) * (1.0 - uNight * 0.6));
  }
  tone = clamp(lumaP(light) * 0.95, 0.0, 1.2);
  return col + s.albedo * lampLight(P, N) * occ;
}

// colore locale (migliorie, suolo): il pittore tiene il colore del prato e della terra anche nella luce
// dorata. Senza, l'albedo giallo-oliva per la luce arancione radente e il riempimento lilla dava un
// prato tutto arancione (tinta 33°, saturazione 0,78 contro 45-57° e 0,5 dei bozzetti). Si tiene la
// luminosità illuminata e si riporta la tinta verso quella dell'albedo per la frazione 'k'.
vec3 coloreLocale(vec3 col, vec3 albedo, float k) {
  float la = lumaP(albedo);
  vec3 loc = albedo * (lumaP(col) / max(la, 1e-3));
  return mix(col, loc, clamp(k, 0.0, 1.0) * step(1e-3, la));
}

// quanto il suolo (prato, terra, sentieri) tiene il suo colore locale: poco a mezzogiorno, di più
// nelle ore dorate; di notte niente (la luce dei lumi e il blu della notte restano)
float quotaColoreLocale() {
  return (0.15 + 0.4 * uGolden) * (1.0 - uNight);
}

// colore illuminato di una campitura (firma storica: acqua e materiali semplici)
vec3 shadeLit(vec3 albedo, vec3 N, vec3 P, out float tone) {
  vec3 V = normalize(cameraPosition - P);
  return shadeSup(supBase(albedo, N), N, P, V, tone);
}

// --- prospettiva aerea dipinta ---

// densità relativa dell'aria alla quota h (m dal fondo): più densa sul fondo (foschie di valle)
float densitaAria(float h) {
  return uAria.z + (1.0 - uAria.z) * exp(-max(h, 0.0) / uAria.y);
}

// quanto il raggio camera->P attraversa il cilindro passando vicino all'asse (0..1)
float raggioAlto(vec3 P) {
  vec3 c = cameraPosition;
  vec3 d = P - c;
  float dd = dot(d.xy, d.xy);
  float t = dd > 1e-3 ? clamp(-dot(c.xy, d.xy) / dd, 0.0, 1.0) : 0.0;
  float dmin = length((c + d * t).xy);
  return smoothstep(0.12, 0.72, 1.0 - dmin / uR);
}

// quota di foschia [0,1] fra la camera e P: spessore d'aria attraversato (regola di Simpson
// sulla densità che cala con la quota) più il "velo" dei raggi che attraversano il cilindro:
// così l'altra metà si legge come un cielo velato, con le terre appena visibili a piani.
float foschiaFrazione(vec3 P, float dist) {
  vec3 c = cameraPosition;
  vec3 m = (c + P) * 0.5;
  float hc = uR - length(c.xy);
  float hp = uR - length(P.xy);
  float hm = uR - length(m.xy);
  float rho = (densitaAria(hc) + 4.0 * densitaAria(hm) + densitaAria(hp)) / 6.0;
  // chi vola alto, vicino all'asse, sta nell'aria limpida: il velo si assottiglia
  // all alba e al tramonto (foschie del mattino) il velo è più spesso
  // (di notte il velo è più spesso: l'altra metà è il cielo, più chiaro dei monti vicini, che
  // restano sagome scure come nel bozzetto 5)
  float velo = raggioAlto(P) * uHaze.w * mix(1.0, 0.3, smoothstep(60.0, 320.0, hc)) * mix(1.0, 1.45, uGolden) * mix(1.0, 2.6, uNight);
  return 1.0 - exp(-dist * uAria.x * (rho + velo));
}

// colore della foschia lungo la direzione V (dalla camera): orizzonte chiaro, "zenit" azzurro
// (raggi che attraversano il cilindro vicino all'asse), bagliore verso la luce principale
// (radente come la luce: all alba e al tramonto sta basso sulla valle, come il sole dei
// bozzetti), alone della Linea. 'glow' (out) = quanto bagliore della Linea c'è sul raggio.
vec3 coloreFoschia(vec3 P, float dist, out float glow) {
  vec3 c = cameraPosition;
  vec3 d = P - c;
  vec3 V = d / max(dist, 1e-3);
  // quanto il raggio sale verso l'asse: quota del punto di mezzo e minima distanza dall'asse
  float dd = dot(d.xy, d.xy);
  float t = dd > 1e-3 ? clamp(-dot(c.xy, d.xy) / dd, 0.0, 1.0) : 0.0;
  vec3 q = c + d * t;
  float dmin = length(q.xy);
  // come in un cielo vero: guardando in su (verso l'altra metà) azzurro pieno, all'orizzonte chiaro
  vec3 upC = cylUp(c);
  float elevV = dot(V, upC);
  // (rifinitura 2: di giorno i raggi verso l'altra metà prendono prima l'azzurro dello zenit, 0,1-0,55
  // invece di 0,2-0,75: a metà strada il lilla della foschia sopra le terre dipinte faceva una parete
  // pallida, grigio-rosa all'alba; nel bozzetto 1 l'altra metà è azzurra. Di notte come prima)
  float alto = max(smoothstep(0.02, 0.5, elevV), smoothstep(mix(0.1, 0.2, uNight), mix(0.55, 0.75, uNight), 1.0 - dmin / uR));
  vec3 hc = mix(uHazeColor, uHazeZenith, alto);
  // bagliore verso la luce principale: stessa direzione (radente) della luce sul terreno
  vec3 Lc = lineaLightDir(c, upC);
  // (un po' più basso della luce: il bagliore si posa sulla valle, come il sole basso dei bozzetti)
  Lc = normalize(Lc - upC * (dot(Lc, upC) * 0.45));
  float mu = max(dot(V, Lc), 0.0);
  // (rifinitura 2: all'alba e al tramonto il bagliore è più raccolto attorno al sole, mix(0.45, 0.95)
  // invece di 1.15 e lobo 9 invece di 7: l'oro sta dal lato del sole, il resto del cielo resta blu)
  float fwd = (pow(mu, mix(10.0, 9.0, uGolden)) * 0.28 + pow(mu, 48.0) * 0.5) * uAria.w * mix(0.45, 0.95, uGolden) * uSunIntensity * (1.0 - uNight);
  // il bagliore si allarga lungo l'orizzonte (luce che attraversa più aria), non verso lo zenit
  // (rifinitura 2: all'alba e al tramonto ancora meno in alto, 0,2 invece di 0,55: l'oro del sole
  // mescolato all'azzurro dell'altra metà faceva un grigio rosato, la parete pallida del confronto 1)
  fwd *= mix(1.0, mix(0.55, 0.2, uGolden), alto);
  hc = mix(hc, uHazeSun, clamp(fwd, 0.0, 1.0));
  // la Linea illumina la foschia attorno a sé
  float litAt = max(step(q.z, uLineaIgnite), 0.55 * uNight);
  // (alone stretto: con la post-produzione il bagliore HDR della Linea apre già l'alone largo;
  // qui resta una riga di luce nell'aria, come nei bozzetti, non una colonna bianca)
  // (la riga stretta è larga qualche pixel a ogni distanza: vicino all'asse, in planata, 20 m
  // d'aria luminosa diventavano una banda bianca larga quanto un dito)
  float dminPx = dmin / max(length(q - c), 1.0) / max(uPixelAngle, 1e-5);
  glow = (exp(-dminPx / 6.0) * 0.6 + exp(-dmin / 110.0) * 0.2) * 0.7 * litAt * smoothstep(0.0, 260.0, dist);
  glow *= 1.0 - 0.45 * uNight;
  return hc + uLineaGlow * glow * 0.36;
}

// foschia con "quinte teatrali": 'k' scala la quantità (1 = piena)
vec3 applyHazeK(vec3 col, vec3 P, float dist, float k) {
  float f = foschiaFrazione(P, dist);
  float rA = raggioAlto(P);
  // quinte lontane (rifinitura 2): i raggi che restano bassi sulla valle, oltre 600 m, si velano
  // d'azzurro-lilla, anche all'alba e al tramonto quando la luce radente scalda tutto: sono i monti
  // a piani del bozzetto 1. L'altra metà vista in su (i raggi vicino all'asse) resta nitida
  // (all'alba e al tramonto più spessa e più azzurra, 0,6 e 65% di zenit: la terra in luce radente è
  // arancione, e un velo lilla poco coprente la ingrigiva invece di farne un monte azzurro)
  float qL = smoothstep(600.0, 1400.0, dist) * (1.0 - rA) * (1.0 - uNight) * mix(0.42, 0.6, uGolden);
  f += (1.0 - f) * qL;
  // all'alba e al tramonto l'altra metà sta dietro l'aria azzurra (bozzetto 1): la luce radente la
  // illumina come la valle, e senza velo era una parete beige pallida
  f = max(f, rA * 0.75 * uGolden * (1.0 - uNight));
  // quinte teatrali: la foschia sale a gradini morbidi (piani di profondità distinti)
  float steps = 5.0;
  float fs = f * steps;
  float fq = (floor(fs) + smoothstep(0.3, 0.7, fract(fs))) / steps;
  f = mix(f, fq, uHaze.z);
  // (i raggi che passano vicino all'asse arrivano all'altra metà: lì il velo può coprire di più,
  // così l'altra metà resta cielo blu; di notte è il cielo, più chiaro dei monti vicini)
  f = min(f, mix(mix(uHaze.y, 0.82, rA), 0.9, uNight)) * k;
  float glow;
  vec3 hc = coloreFoschia(P, dist, glow);
  hc = mix(hc, mix(uHazeColor, uHazeZenith, mix(0.45, 0.65, uGolden)), min(qL * 1.2, 1.0));
  return mix(col, hc, clamp(f + glow * 0.18 * k, 0.0, 1.0));
}
vec3 applyHaze(vec3 col, vec3 P, float dist) {
  return applyHazeK(col, P, dist, 1.0);
}
`;

/** Pennellata in spazio mondo, proiezione triplanare nella terna del cilindro. */
export const BRUSH_GLSL = /* glsl */ `
float brushStrokes(vec2 uv, float dist) {
  float s1 = vnoise2(uv * vec2(0.42, 1.6));
  float s2 = vnoise2(uv * vec2(0.11, 0.38) + 17.0);
  float s3 = vnoise2(uv * vec2(0.03, 0.06) + 41.0);
  float fNear = 1.0 - smoothstep(15.0, 60.0, dist);
  float fMid = 1.0 - smoothstep(150.0, 600.0, dist);
  return (s1 - 0.5) * fNear * 0.55 + (s2 - 0.5) * fMid * 0.75 + (s3 - 0.5) * 0.55;
}

// coordinate locali del cilindro: arco sul fondo, z, quota (metri)
vec3 cylLocal(vec3 P) {
  return vec3(cylThetaDeg(P) * uR * PI / 180.0, P.z, uR - length(P.xy));
}

// pesi triplanari nella terna locale (est, nord, su)
vec3 cylTriWeights(vec3 P, vec3 N) {
  vec3 up = cylUp(P);
  vec3 east = vec3(-up.y, up.x, 0.0);
  vec3 w = abs(vec3(dot(N, up), dot(N, vec3(0.0, 0.0, 1.0)), dot(N, east)));
  w = pow(w, vec3(4.0));
  return w / max(w.x + w.y + w.z, 1e-4);
}

// pennellata triplanare: non si stira sui fianchi ripidi
float brushTri(vec3 P, vec3 N, float dist) {
  vec3 c = cylLocal(P);
  vec3 w = cylTriWeights(P, N);
  float b = 0.0;
  if (w.x > 0.02) b += w.x * brushStrokes(c.xy, dist);
  if (w.y > 0.02) b += w.y * brushStrokes(vec2(c.x, c.z * 1.0), dist);
  if (w.z > 0.02) b += w.z * brushStrokes(vec2(c.y, c.z), dist);
  return b;
}

// coordinate per il tratteggio: la proiezione dominante (cambi di direzione come in uno schizzo)
vec2 cylDominantUV(vec3 P, vec3 N) {
  vec3 c = cylLocal(P);
  vec3 w = cylTriWeights(P, N);
  if (w.x >= w.y && w.x >= w.z) return c.xy;
  if (w.y >= w.z) return vec2(c.x, c.z) + 31.0;
  return vec2(c.y, c.z) + 57.0;
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

// come rumoreStabile, ma 2D sulle coordinate di superficie (la metà del costo)
float rumoreStabile2(vec2 uv, float pix, float px, float minScale) {
  float lv = log2(max(pix * px, minScale));
  float l0 = floor(lv);
  float fr = lv - l0;
  float s0 = exp2(l0);
  float a = vnoise2(uv / s0 + l0 * 7.13);
  float b = vnoise2(uv / (s0 * 2.0) + (l0 + 1.0) * 7.13);
  return mix(a, b, fr);
}

// rumore 3D ancorato al mondo con una scala che segue i pixel (niente sfarfallio da lontano):
// 'px' = dimensione desiderata in pixel; due ottave vicine sfumate fra loro.
float rumoreStabile(vec3 P, float pix, float px, float minScale) {
  float lv = log2(max(pix * px, minScale));
  float l0 = floor(lv);
  float fr = lv - l0;
  float s0 = exp2(l0);
  float a = vnoise3(P / s0 + l0 * 7.13);
  float b = vnoise3(P / (s0 * 2.0) + (l0 + 1.0) * 7.13);
  return mix(a, b, fr);
}
`;

/** Stato delle celle, resa a matita e abbozzo ad acquerello. */
export const PENCIL_GLSL = /* glsl */ `
struct PaintInfo {
  float paint;  // 0 abbozzo (non rilevato), 1 dipinto (rilevato)
  float blank;  // 1 foglio bianco (mai visto)
  float ink;    // linea d'inchiostro sul fronte
  float wet;    // bordo bagnato dietro il fronte (pigmento che si raccoglie)
  float bleed;  // acquerello che sborda oltre il fronte
};

vec2 cellValue(float st) {
  return st > 1.5 ? vec2(1.0, 0.0) : (st > 0.5 ? vec2(0.0, 0.0) : vec2(0.0, 1.0));
}

// una cella: xy = (dipinto, bianco); z = distanza dal fronte (m, + dentro); w = animazione in corso (1 - avanzamento)
vec4 cellSample(vec2 idx, vec3 P, float thetaDeg, float edgeNoise) {
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
  if (p >= 1.0) return vec4(vc, 0.0, 0.0);
  vec2 vp = cellValue(prv);
  float radius = q * 10.0 + 12.0;
  float ease = 1.0 - pow(1.0 - p, 1.8);
  float front = radius * ease;
  float dth = mod(thetaDeg - t.a + 540.0, 360.0) - 180.0;
  float ds = radians(dth) * uR;
  float dz = P.z - t.b;
  float d = length(vec2(dz, ds));
  float edge = front - d + edgeNoise * 24.0 * (0.4 + 0.6 * ease);
  float k = smoothstep(-2.5, 2.5, edge);
  return vec4(mix(vp, vc, k), edge, 1.0 - p);
}

PaintInfo paintState(vec3 P, float thetaDeg, float dist) {
  // di notte il raggio sempre dipinto si stringe (solo visivo: il gioco non usa nearPaint), così
  // la differenza fra rilevato e non rilevato si legge anche al buio, prima che la foschia copra
  vec2 np = mix(uPencil.xy, min(uPencil.xy, vec2(70.0, 150.0)), uNight);
  // dentro il raggio sempre dipinto, se nessuna rivelazione è in corso, le celle non contano:
  // si salta tutto il lavoro (gran parte dello schermo, vicino al giocatore)
  if (dist <= np.x && uTime - uCellAnim > uPencil.w + 0.05) {
    PaintInfo q;
    q.paint = 1.0 - uPencil.z;
    q.blank = 0.0;
    q.ink = 0.0;
    q.wet = 0.0;
    q.bleed = 0.0;
    return q;
  }
  vec2 cc = vec2(P.z / uCellGrid.z, thetaDeg / uCellGrid.w);
  // bordi organici: leggera distorsione del dominio (un solo rumore, lungo la diagonale)
  float wn = vnoise3(P * 0.021) - 0.5;
  cc += vec2(wn, -wn * 0.8) * 0.62;
  // frastagliatura del fronte: serve solo se una rivelazione può essere in corso
  float en = 0.0;
  if (uTime - uCellAnim <= uPencil.w + 0.05) {
    en = vnoise3(P * 0.05) * 0.45 + vnoise3(P * 0.16) * 0.3 + vnoise3(P * 0.45) * 0.17 + vnoise3(P * 1.3) * 0.08 - 0.5;
  }
  vec2 base = floor(cc - 0.5);
  vec2 f = cc - 0.5 - base;
  vec4 a = cellSample(base, P, thetaDeg, en);
  vec4 b = cellSample(base + vec2(1.0, 0.0), P, thetaDeg, en);
  vec4 c = cellSample(base + vec2(0.0, 1.0), P, thetaDeg, en);
  vec4 d = cellSample(base + vec2(1.0, 1.0), P, thetaDeg, en);
  vec4 wts = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  vec2 s = a.xy * wts.x + b.xy * wts.y + c.xy * wts.z + d.xy * wts.w;
  // fronte: media pesata solo sulle celle che si stanno animando
  vec4 an = vec4(a.w, b.w, c.w, d.w) * wts;
  float anW = an.x + an.y + an.z + an.w;
  float edge = anW > 1e-4 ? (a.z * an.x + b.z * an.y + c.z * an.z + d.z * an.w) / anW : 0.0;
  float anim = anW > 1e-4 ? anW / max(dot(step(vec4(1e-4), vec4(a.w, b.w, c.w, d.w)), wts), 1e-4) : 0.0;
  anim = clamp(anim, 0.0, 1.0) * step(1e-4, anW);
  // bordo netto ma frastagliato, come acquerello che si allarga
  float wob = (vnoise3(P * 0.045) - 0.5) * 0.55;
  // (l'ottava fine, 3 m, da lontano non si vede)
  if (dist < 500.0) wob += (vnoise3(P * 0.3) - 0.5) * 0.12;
  if (anim > 0.0) wob *= 0.25; // durante la rivelazione comanda il fronte
  PaintInfo pi;
  pi.paint = smoothstep(0.42, 0.58, s.x + wob);
  pi.blank = smoothstep(0.42, 0.58, s.y + wob);
  // linea d'inchiostro sottile (in pixel) sul fronte
  float ew = max(fwidth(edge), 0.03);
  pi.ink = anim * (1.0 - smoothstep(0.9, 2.2, abs(edge - 0.6) / ew)) * smoothstep(0.0, 0.25, anim);
  pi.wet = anim * step(0.0, edge) * (1.0 - smoothstep(0.0, 12.0, edge));
  pi.bleed = anim * step(edge, 0.0) * (1.0 - smoothstep(0.0, 30.0, -edge)) * (0.6 + 0.4 * vnoise3(P * 0.11));
  // il mondo vicino è sempre dipinto (ci sei dentro)
  float nearP = 1.0 - smoothstep(np.x, np.y, dist);
  pi.paint = max(pi.paint, nearP);
  pi.blank *= 1.0 - nearP;
  pi.bleed *= 1.0 - nearP;
  pi.paint *= 1.0 - uPencil.z;
  return pi;
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
  float w1 = 0.85 * (1.0 - smoothstep(0.55, 0.78, tone));
  float w2 = 0.8 * (1.0 - smoothstep(0.32, 0.5, tone));
  float w3 = 0.75 * (1.0 - smoothstep(0.15, 0.3, tone));
  if (w1 > 0.01) h = max(h, hatchLines(uv, 0.62 + jitter, spacing, pix, w1) * 0.85);
  if (w2 > 0.01) h = max(h, hatchLines(uv, -0.85 + jitter, spacing * 0.9, pix, w2));
  if (w3 > 0.01) h = max(h, hatchLines(uv, 1.45 + jitter, spacing * 0.8, pix, w3));
  return h;
}

// segni a matita (0..1): tratteggio nelle ombre, curve di livello, contorni di taglio
float segniMatita(vec2 uv, vec3 N, vec3 V, float tone, float hgt, float dist, float steep, out float rim) {
  float pix = max(dist, 0.5) * uPixelAngle;
  // il tratto "trema" piano: rumore che cambia a scatti (6 al secondo)
  float tq = floor(uTime * 6.0);
  float jitter = (hash12(vec2(tq, 3.1)) - 0.5) * 0.04;
  vec2 juv = uv + (vec2(vnoise2(uv * 0.08 + tq * 1.7), vnoise2(uv * 0.08 - tq * 1.3)) - 0.5) * 0.6;
  float t = clamp(tone - steep * 0.3, 0.0, 1.2);
  // spaziatura del tratteggio in ottave di metri, stabile con la distanza
  float level = log2(max(pix * 10.0, 0.45));
  float l0 = floor(level);
  float lf = level - l0;
  float h0 = hatchTone(juv, t, exp2(l0), pix, jitter);
  float h1 = hatchTone(juv, t, exp2(l0 + 1.0), pix, jitter);
  float hatch = mix(h0, h1, smoothstep(0.2, 0.8, lf));
  // tratteggio a macchie, come in uno schizzo: non uniforme
  float patchy = smoothstep(0.32, 0.68, vnoise2(uv * 0.018 + 3.7) * 0.7 + vnoise2(uv * 0.07) * 0.3);
  hatch *= mix(0.25 + 0.75 * patchy, 1.0, steep * 0.4);
  // da lontano lo schizzo si semplifica: meno tratteggio
  float far = smoothstep(120.0, 650.0, dist);
  hatch *= 1.0 - far * 0.8;
  // curve di livello dalla quota (passo che raddoppia con la distanza), deboli sulle pareti
  float cstep = 6.0 * exp2(floor(clamp(log2(max(pix * 40.0 / 6.0, 1.0)), 0.0, 7.0)));
  float fh = hgt / cstep;
  float fw = max(fwidth(fh), 1e-4);
  float contour = (1.0 - smoothstep(0.6, 1.4, abs(fract(fh + 0.5) - 0.5) / fw)) * (1.0 - steep * 0.85);
  // (rifinitura 2) le curve più fitte di circa 5 pixel spariscono invece di fare moiré: da lontano
  // e di scorcio facevano anelli concentrici, come legno tagliato, che il filtro a metà risoluzione
  // ingrossava; oltre 600 m niente curve di livello
  contour *= (1.0 - smoothstep(0.10, 0.25, fw)) * (1.0 - smoothstep(600.0, 1000.0, dist));
  // contorno: dove la superficie è vista di taglio
  float ndv = abs(dot(N, V));
  float wob = (vnoise2(uv * 0.35 + tq * 0.9) - 0.5) * 0.12;
  rim = 1.0 - smoothstep(0.1 + wob, 0.26 + wob, ndv);
  return hatch * 0.42 + contour * 0.3 + rim * 0.62;
}

/**
 * Resa a sola matita (firma storica): carta avorio, tratteggio, curve di livello, contorni.
 * 'steep' (0..1) = parete ripida; 'inked' (0..1) = le linee si ripassano a inchiostro.
 */
vec3 pencilColor(vec2 uv, vec3 N, vec3 V, float tone, float hgt, float dist, float blank, float steep, float inked) {
  vec3 paper = vec3(0.965, 0.918, 0.815);
  vec3 graphite = vec3(0.40, 0.385, 0.40);
  vec3 inkC = vec3(0.20, 0.17, 0.24);
  float grain = (vnoise2(uv * 2.7) - 0.5) * 0.05 + (vnoise2(uv * 0.21) - 0.5) * 0.04;
  float rim;
  float ink = segniMatita(uv, N, V, tone, hgt, dist, steep, rim);
  ink *= mix(1.0, 0.22, blank);
  float t = clamp(tone - steep * 0.3, 0.0, 1.2);
  float far = smoothstep(120.0, 650.0, dist);
  float smudge = mix(1.0, mix(0.8, 1.02, clamp(t, 0.0, 1.0)), 1.0 - blank * 0.8);
  smudge *= 1.0 - steep * (0.16 + 0.12 * far) * (1.0 - blank);
  vec3 col = paper * (1.0 + grain) * smudge;
  vec3 lineC = mix(graphite, inkC, inked);
  col = mix(col, lineC, clamp(ink * (1.0 + inked * 0.6), 0.0, 0.92));
  col *= mix(vec3(1.0), uAmbTop * 0.8 + uSunColor * uSunIntensity * 0.25, uNight);
  return col;
}

/**
 * Abbozzo ad acquerello del mondo NON rilevato: i colori veri della scena illuminata ('col'),
 * schiariti e desaturati (circa il 60%), stesi a velature non uniformi sulla carta, con i bordi
 * delle pozze più scuri, la granulazione del pigmento e sopra i segni a matita (tratteggio
 * nelle ombre, curve di livello, contorni). 'blank' = foglio mai visto: quasi solo carta.
 */
vec3 schizzo(vec3 col, vec2 uv, vec3 N, vec3 V, vec3 P, float tone, float hgt, float dist, float blank, float steep, float inked) {
  float pix = max(dist, 0.5) * uPixelAngle;
  // (rifinitura 2) le stesure si misurano col lato lungo dell'impronta del pixel: con la sola
  // distanza, di scorcio (l'altra metà, i versanti lontani) le macchie si schiacciavano in
  // increspature ondulate, come un cielo a pecorelle
  float pixS = max(pix, length(fwidth(uv)) * 0.75);
  vec3 paper = vec3(0.962, 0.935, 0.862);
  // da lontano la carta si confonde con l'aria (l'abbozzo dell'altra metà è dietro il velo azzurro)
  // (rifinitura 2: 0.12 invece di 0.3: la carta virata all'aria faceva le pareti color crema)
  paper = mix(paper, mix(uHazeColor, uHazeZenith, 0.35) * 1.08, smoothstep(350.0, 1100.0, dist) * 0.12 * (1.0 - uNight));
  // la carta prende la luce dell'ora (di notte è blu-viola), ma resta più chiara del dipinto
  // (circa una volta e mezza): il non rilevato si legge al buio come carta, non come campitura
  // (solo entro qualche centinaio di metri: l'altra metà, di notte, resta un fondale scuro sotto la
  // foschia, dove si accendono i paesi lontani)
  // (rifinitura 2: la carta notturna era più chiara del cielo, un lenzuolo lilla; nel bozzetto 5 i
  // monti sono sagome scure sotto un cielo più chiaro, e il paese acceso risalta. Il minimo di luce
  // per leggere il gesso vale solo vicino, entro 150 m)
  vec3 cartaBuio = uAmbTop * 0.30 + uSunColor * uSunIntensity * 0.10 + uHazeColor * 0.08;
  float cartaVicina = 1.0 - smoothstep(80.0, 150.0, dist);
  vec3 paperLight = mix(vec3(1.0), mix(cartaBuio, max(cartaBuio, uAmbTop * 0.42 + uHazeColor * 0.10), cartaVicina), uNight);
  // da lontano la carta si vede meno e il colore torna (le terre si leggono a piani)
  float lontano = smoothstep(260.0, 950.0, dist);
  // pigmento: colore vero, meno saturo (circa 60%), un po' più chiaro; il foglio mai visto
  // è un abbozzo ancora più spento, ma non vuoto
  float lum = lumaP(col);
  // (rifinitura 2: dal 75% al 100% del colore, prima dal 60 all'88%: l'acquerello lontano sbiadiva
  // i versanti e il terzo alto di ogni inquadratura)
  vec3 pig = mix(vec3(lum), col, mix(0.75, 1.0, lontano) * mix(1.0, 0.85, blank));
  pig = pig * 1.04 + 0.03;
  // stesure non uniformi: macchie d'acqua e di pigmento ancorate al mondo (in pixel, stabili)
  float w1 = rumoreStabile2(uv, pixS, 140.0, 2.0);
  float w2 = rumoreStabile2(uv + 17.0, pixS, 34.0, 0.6);
  float wash = uAcquerello.x * (0.78 + 0.32 * w1 + 0.12 * (w2 - 0.5));
  // qua e là la carta resta scoperta (luci risparmiate)
  float risparmio = smoothstep(0.66, 0.8, w1 * 0.75 + w2 * 0.35) * 0.45 * uAcquerello.z;
  wash *= 1.0 - risparmio;
  // bordo della pozza: il pigmento si raccoglie e scurisce il contorno della stesura
  float pozza = (1.0 - smoothstep(0.0, 0.035, abs(w1 - 0.44))) * (1.0 - lontano * 0.8);
  // granulazione del pigmento
  float gran = (rumoreStabile2(uv + 41.0, pixS, 3.0, 0.04) - 0.5) * 0.06 * uAcquerello.w;
  wash = clamp(wash * (1.0 + gran) + pozza * 0.12, 0.0, 1.0);
  // da lontano la carta si vede meno: resta una velatura di colore (le terre si leggono a piani)
  wash = mix(wash, 0.97, lontano * 0.85);
  // il foglio mai visto: una prima velatura leggera (il mondo non sembra mai vuoto)
  wash *= mix(1.0, mix(0.72, 0.94, lontano), blank);
  // di notte il colore della scena è già buio: la stesura si fa leggera e la carta si vede
  wash *= 1.0 - 0.62 * uNight * cartaVicina;
  vec3 wc = paper * mix(vec3(1.0), clamp(pig, 0.0, 1.0), wash);
  wc *= 1.0 - pozza * 0.06 * (1.0 - blank);
  // grana della carta
  wc *= 1.0 + (vnoise2(uv * 3.1) - 0.5) * 0.04 * uAcquerello.z;
  wc *= paperLight;
  // matita sopra l'acquerello: segni più leggeri che nello schizzo puro
  float rim;
  float ink = segniMatita(uv, N, V, tone, hgt, dist, steep, rim) * uAcquerello.y;
  ink *= mix(0.7, 0.26, blank);
  vec3 graphite = mix(vec3(0.36, 0.34, 0.37), pig * 0.45, 0.35) * paperLight;
  vec3 inkC = vec3(0.2, 0.17, 0.24);
  vec3 lineC = mix(graphite, inkC, inked);
  // di notte: gesso chiaro su carta scura, con un contrasto minimo (il tratteggio e le curve di
  // livello si leggono anche da lontano)
  // (rifinitura 2: gesso più tenue, e il rinforzo notturno dell'inchiostro morbido e solo entro
  // 200 m: con step(0.02, ink) ogni puntino di tratteggio diventava un punto di gesso, e il
  // versante notturno era un retino regolare)
  lineC = mix(lineC, wc * 1.35 + vec3(0.03, 0.03, 0.05), uNight * (1.0 - inked));
  ink = mix(ink, max(ink, ink * 0.5 + smoothstep(0.05, 0.25, ink) * 0.08), uNight * (1.0 - smoothstep(120.0, 200.0, dist)));
  return mix(wc, lineC, clamp(ink * (0.75 + inked * 0.6), 0.0, 0.85));
}
`;
