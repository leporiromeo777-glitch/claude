/**
 * Pezzi GLSL della traccia «natura»: vento, chiome dipinte, erba, sfumatura con la distanza e il
 * passaggio dipinto/abbozzo condiviso dai materiali della vegetazione (`render/naturaMateriali.ts`).
 *
 * - `VENTO_GLSL` (vertex): spostamento del vento in coordinate mondo. Il vento soffia lungo la
 *   valle (uVento.zw = direzione nella terna est/nord), a raffiche lente che corrono sul terreno;
 *   i rami flettono col quadrato dell'altezza, le foglie tremano un poco.
 * - `CHIOMA_GLSL` (fragment): la chioma come la dipinge un pittore: ciuffi tondi (celle 3D) con
 *   il loro lato in luce e il loro lato in ombra, interstizi scuri e freddi, tocchi di foglie,
 *   macchie d'autunno; bordo luminoso e luce trasmessa li fa `shadeSup`.
 * - `ERBA_GLSL` (fragment): ciuffi d'erba, felci, fiori (colore dal vertice e dall'istanza).
 * - `DIPINTO_GLSL` (fragment): dipinto (rilevato) o abbozzo ad acquerello (non rilevato) più la
 *   foschia, come in `worldMaterial.ts`.
 *
 * Richiedono NOISE_GLSL, WORLD_UNIFORMS_GLSL, LIGHT_GLSL, BRUSH_GLSL, SUPERFICI_BASE_GLSL e, per
 * DIPINTO_GLSL, PENCIL_GLSL.
 */

/** Uniform propri dei materiali della vegetazione. */
export const NATURA_UNIFORMS_GLSL = /* glsl */ `
uniform vec4 uVento;   // x = forza (0..1.5), y = raffiche (0..1), z/w = direzione (est, nord)
uniform vec4 uSfuma;   // x..y = comparsa con la distanza (m), z..w = scomparsa (m); y <= 0 niente comparsa, w <= 0 niente scomparsa
uniform vec4 uFoglia;  // carte di foglie: x = forma (0 lanceolata, 1 tonda, 2 aghi, 3 squame)
`;

export const VENTO_GLSL = /* glsl */ `
// raffica che corre lungo il vento: 0..1 (lenta, a onde larghe sul terreno)
float raffica(vec3 wp, vec2 dir2) {
  vec3 up = cylUp(wp);
  vec3 east = vec3(-up.y, up.x, 0.0);
  float x = dot(wp, east) * dir2.x + wp.z * dir2.y;
  float y = dot(wp, east) * dir2.y - wp.z * dir2.x;
  float t = uTime;
  float g = sin(x * 0.045 - t * 1.3 + sin(y * 0.03) * 1.7) * 0.5 + 0.5;
  g = g * 0.7 + (sin(x * 0.11 - t * 2.1 + y * 0.05) * 0.5 + 0.5) * 0.3;
  return mix(0.55, g, uVento.y);
}

// spostamento del vento (m, coordinate mondo) per un punto a quota 'alto' (m) sopra la base,
// 'flessione' = quanto è morbido (0 rigido, 1 erba), 'fase' = seme dell'istanza
vec3 vento(vec3 wp, float alto, float flessione, float fase) {
  vec3 up = cylUp(wp);
  vec3 east = vec3(-up.y, up.x, 0.0);
  vec3 dirW = east * uVento.z + vec3(0.0, 0.0, uVento.w);
  float g = raffica(wp, uVento.zw);
  float t = uTime;
  float osc = sin(t * 1.7 + fase * 6.28) * 0.6 + sin(t * 2.9 + fase * 11.0) * 0.4;
  float k = uVento.x * flessione * alto * alto;
  vec3 d = dirW * k * (0.55 * g + 0.25 * osc * (0.4 + g));
  // dondolio laterale
  vec3 lat = cross(up, dirW);
  d += lat * k * 0.18 * sin(t * 1.3 + fase * 9.0);
  // abbassa un poco la cima piegata (l'erba si inclina, non si allunga)
  d -= up * length(d) * 0.35 / max(alto, 0.3);
  return d;
}
`;

export const CHIOMA_GLSL = /* glsl */ `
/**
 * Chioma dipinta (le MASSE): il corpo della chioma sotto le carte di foglie. 'seme' varia il disegno
 * da un albero all'altro, 'Nv' = normale geometrica (già piegata verso la sfera della chioma),
 * 'up' = su locale, 'pix' = metri per pixel, 'esterno' (0..1) = quanto il frammento sta sul bordo
 * della chioma. Da vicino (LOD 0 e 1) si vede soprattutto negli interstizi fra le carte: è più
 * scuro e più freddo; da lontano (LOD 2, senza carte) porta da solo i grandi ciuffi.
 */
void chiomaDipinta(inout Sup s, vec3 P, vec3 Nv, vec3 up, float pix, float seme, float esterno) {
  vec3 c = s.albedo;
  float gap = 0.0;
  // dominio deformato: i ciuffi non sono celle regolari ma masse di foglie irregolari
  vec3 Pw = P + (vec3(vnoise3(P * 0.45 + seme), vnoise3(P * 0.45 + 7.3), vnoise3(P * 0.45 + 13.1)) - 0.5) * 1.6;
  // grandi ciuffi (rami pieni di foglie, ~2.6 m): ognuno col suo lato in luce sopra e in ombra sotto
  float visG = visMotivo(pix, 6.0);
  if (visG > 0.0) {
    vec3 relG;
    vec3 voG = voronoi3(Pw / 2.6 + seme * 13.0, relG);
    vec3 nG = normalize(s.N - relG * 0.55 + up * 0.25);
    s.N = normalize(mix(s.N, nG, 0.45 * visG));
    gap = (1.0 - smoothstep(0.02, 0.16, voG.x)) * visG * 0.5;
    c *= 1.0 + (voG.z - 0.5) * 0.16 * visG;
    c = mix(c, c * vec3(1.12, 1.02, 0.78), smoothstep(0.78, 0.95, voG.z) * 0.4 * visG);
  }
  // macchie grandi (rami interi che hanno girato prima)
  float m = vnoise3(P * 0.33 + seme * 5.0);
  c = mix(c, c * vec3(1.14, 0.98, 0.7), smoothstep(0.62, 0.82, m) * 0.35);
  c = mix(c, c * vec3(0.88, 0.97, 1.04), smoothstep(0.32, 0.12, m) * 0.2);
  // tocchi di foglie, morbidi (il dettaglio vero lo fanno le carte)
  float vf = visMotivo(pix, 0.5);
  if (vf > 0.0) {
    float lf = vnoise3(Pw / 0.3 + 9.0 + seme) - 0.5;
    c *= 1.0 + lf * 0.32 * vf;
  }
  c = mix(c, c * vec3(0.72, 0.82, 0.94), gap * 0.6);
  s.albedo = c;
  // l'interno della chioma riceve meno luce dal cielo
  s.ao *= mix(0.68, 1.0, esterno) * (1.0 - gap * 0.35);
  s.trasm = 0.9;
  s.bordo = 0.8 * (1.0 - smoothstep(0.6, 0.95, dot(Nv, up)) * 0.7);
  s.bande = 0.45;
}
`;

/**
 * Carte di foglie (fragment): maschera procedurale di un ciuffo di foglie e pittura foglia per
 * foglia. Richiede NOISE_GLSL e la struct Sup.
 */
export const FOGLIE_GLSL = /* glsl */ `
// una foglia lanceolata lungo d (lunghezza len, larghezza w): x = dentro (0/1), y = t lungo la
// foglia, z = posizione trasversale -1..1
vec3 fogliaLanceolata(vec2 q, vec2 d, float len, float w, float dentelli) {
  float t = dot(q, d) / len;
  float sx = dot(q, vec2(-d.y, d.x));
  if (t <= 0.0 || t >= 1.0) return vec3(0.0);
  float hw = w * sin(3.14159 * pow(t, 0.72));
  // margine seghettato del castagno
  hw *= 1.0 - dentelli * abs(fract(t * len * 26.0) - 0.5);
  return vec3(step(abs(sx), hw), t, sx / max(hw, 1e-4));
}

/**
 * Ciuffo di foglie nella carta: uv in -1..1, 'seme' della carta, 'forma' (0 lanceolata, 1 tonda,
 * 2 aghi, 3 squame), 'px' = diametro della carta in pixel (sotto ~14 px una macchia lobata).
 * Restituisce 1 dentro; 'id' = identità della foglia (0..1), 'dir' = direzione della foglia (uv),
 * 'trasv' = posizione trasversale (-1..1: le due metà della foglia prendono la luce diversa).
 */
float ciuffoFoglie(vec2 uv, float seme, float forma, float px, out float id, out vec2 dir, out float trasv) {
  float r = length(uv);
  id = seme;
  dir = r > 1e-3 ? uv / r : vec2(0.0, 1.0);
  trasv = 0.0;
  if (r > 1.0) return 0.0;
  float ang = atan(uv.y, uv.x);
  // da lontano: una macchia lobata (la carta è pochi pixel)
  if (px < 14.0) {
    float lob = 0.66 + 0.16 * sin(ang * 5.0 + seme * 37.0) + 0.08 * sin(ang * 9.0 + seme * 11.0);
    id = fract(seme * 7.0 + floor((ang + 3.14159) / 1.2566) * 0.31);
    return step(r, lob);
  }
  float dentro = 0.0;
  if (forma < 0.5) {
    // castagno: 9 foglie lunghe che si aprono a ventaglio dal rametto, più il nodo al centro
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      float a = seme * 6.2832 + fi * 0.6981 + (hash12(vec2(seme * 91.0, fi)) - 0.5) * 0.6;
      vec2 d = vec2(cos(a), sin(a));
      // le foglie verso l'alto sono più corte (il ciuffo pende)
      float len = (0.64 + 0.34 * hash12(vec2(fi, seme * 53.0))) * (0.8 + 0.2 * (0.5 - 0.5 * d.y));
      vec3 f = fogliaLanceolata(uv + d * 0.1, d, len, 0.22 * len, 0.2);
      if (f.x > 0.5 && f.y > dentro) {
        dentro = max(f.y, 0.01);
        id = fract(seme * 13.0 + fi * 0.137);
        dir = d;
        trasv = f.z;
      }
    }
    if (dentro <= 0.0 && r < 0.3) {
      dentro = 0.01;
      id = fract(seme * 5.0);
    }
  } else if (forma < 1.5) {
    // betulla, noce: foglioline ovali sparse nel ciuffo
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      vec2 h = hash22(vec2(seme * 71.0 + fi, fi * 3.1));
      float rr = sqrt(h.x) * 0.58;
      float aa = h.y * 6.2832;
      vec2 c = vec2(cos(aa), sin(aa)) * rr;
      float a = aa + (hash12(vec2(fi, seme)) - 0.5) * 1.6;
      vec2 d = vec2(cos(a), sin(a));
      float len = 0.34 + 0.14 * hash12(vec2(fi * 7.0, seme));
      vec2 q = uv - c + d * len * 0.5;
      vec3 f = fogliaLanceolata(q, d, len, 0.3 * len, 0.0);
      if (f.x > 0.5) {
        dentro = 1.0;
        id = fract(seme * 17.0 + fi * 0.211);
        dir = d;
        trasv = f.z;
      }
    }
  } else if (forma < 2.5) {
    // larice: ciuffetti di aghi (tre rosette), aghi spessi almeno un pixel e mezzo
    float wmin = 3.0 / max(px, 1.0);
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      vec2 h = hash22(vec2(seme * 37.0 + fk, fk + 0.5));
      vec2 c = (h - 0.5) * 0.9;
      vec2 q = uv - c;
      float rq = length(q);
      if (rq > 0.48) continue;
      float aq = atan(q.y, q.x) + seme * 9.0 + fk;
      float n = 13.0;
      float sector = floor(aq / 6.2832 * n + 0.5);
      float da = aq - sector * 6.2832 / n;
      float len = 0.3 + 0.16 * hash12(vec2(sector, seme + fk));
      float w = max(0.025, wmin) * (1.0 - rq / len * 0.6);
      if (rq < len && abs(da) * rq < w) {
        dentro = 1.0;
        id = fract(seme * 3.0 + fk * 0.27 + sector * 0.051);
        dir = q / max(rq, 1e-3);
      }
      if (rq < 0.06) dentro = 1.0;
    }
  } else {
    // cipresso: ciuffo fitto di squame, bordo a smerli
    float lob = 0.74 + 0.1 * sin(ang * 7.0 + seme * 29.0) + 0.06 * sin(ang * 13.0 + seme * 5.0);
    dentro = step(r, lob);
    id = fract(seme * 11.0 + floor(r * 6.0) * 0.17 + floor((ang + 3.14159) * 2.0) * 0.07);
    trasv = sin(ang * 7.0 + r * 9.0);
  }
  return step(0.001, dentro);
}

/**
 * Pittura di una carta di foglie: ogni foglia ha il suo tono (qualcuna ha già girato: 'altro' è il
 * colore dell'altra tinta dell'albero), le due metà della foglia prendono la luce diversa, la
 * nervatura centrale è un filo più scura. 'camR'/'camU' = assi dello schermo nel mondo,
 * 'vicino' (0..1) = quanto la carta è grande sullo schermo (dettagli fini).
 */
void carteDipinte(inout Sup s, vec3 altro, float esterno, float id, vec2 dir, float trasv, vec3 camR, vec3 camU, float vicino) {
  vec3 c = s.albedo;
  float h = hash12(vec2(id * 97.0, 3.1));
  c *= 0.84 + 0.32 * h;
  // qualche foglia del colore dell'altra tinta (oro fra il verde, verde fra l'oro)
  c = mix(c, altro * (0.9 + 0.2 * h), step(0.8, hash12(vec2(id * 31.0, 7.7))) * 0.85);
  // qualche foglia accesa
  c = mix(c, c * vec3(1.22, 1.12, 0.8), step(0.9, h) * 0.6);
  // nervatura centrale (solo da vicino)
  c *= 1.0 - (1.0 - smoothstep(0.0, 0.16, abs(trasv))) * 0.22 * vicino;
  s.albedo = c;
  // normale della foglia: piegata verso la sua direzione e ripiegata lungo la nervatura
  vec3 t = camR * dir.x + camU * dir.y;
  vec3 b = camR * -dir.y + camU * dir.x;
  s.N = normalize(s.N + t * 0.32 + b * sign(trasv) * 0.22 * vicino);
  s.ao *= mix(0.8, 1.0, esterno);
  s.trasm = 1.1;
  s.bordo = 0.7;
  s.bande = 0.5;
}
`;

export const ERBA_GLSL = /* glsl */ `
// erba, felci, fiori: il colore lo danno il vertice (punta chiara, base scura) e l'istanza;
// 'punta' = quanto il punto è alto nel filo (0 base, 1 punta): la base è nell'ombra del ciuffo
void erbaDipinta(inout Sup s, vec3 P, float pix, float punta) {
  vec3 c = s.albedo;
  float v = vnoise2(cylLocal(P).xy * 0.35);
  c *= 0.92 + 0.16 * v;
  // punte un filo più calde e chiare (prendono il sole), basi fredde
  c = mix(c * vec3(0.86, 0.92, 1.0), c * vec3(1.08, 1.04, 0.92), smoothstep(0.2, 0.9, punta));
  s.albedo = c;
  s.ao *= mix(0.62, 1.0, smoothstep(0.0, 0.7, punta));
  s.trasm = 0.85;
  s.bordo = 0.3;
  s.bande = 0.35;
}
`;

export const DIPINTO_GLSL = /* glsl */ `
// dipinto (rilevato) o abbozzo ad acquerello (non rilevato), poi la foschia: come worldMaterial
vec3 dipintoNatura(vec3 col, vec3 P, vec3 N, vec3 V, float dist, float tone, vec2 suv) {
  float hazeK = 1.0;
#ifndef NO_PENCIL
  float th = cylThetaDeg(P);
  PaintInfo pi = paintState(P, th, dist);
  vec3 colPieno = max(mix(vec3(lumaP(col)), col, uLuce.w), 0.0);
  hazeK = mix(1.12, 1.0, pi.paint);
  if (pi.paint < 0.999) {
    float hgt = uR - length(P.xy);
    vec3 pc = schizzo(col, suv, N, V, P, tone, hgt, dist, pi.blank, 0.0, pi.wet + pi.bleed * 0.6);
    pc = mix(pc, mix(colPieno, vec3(0.962, 0.935, 0.862), 0.28), pi.bleed * 0.7);
    col = mix(pc, colPieno, pi.paint);
  } else {
    col = colPieno;
  }
  col = mix(col, col * vec3(0.78, 0.8, 0.86), pi.wet * pi.paint * 0.6);
  col = mix(col, vec3(0.2, 0.17, 0.26), clamp(pi.ink, 0.0, 1.0) * 0.85);
#endif
  return applyHazeK(col, P, dist, hazeK);
}
`;

/** Visibilità con la distanza (vertex): comparsa e scomparsa morbide, retinate nel fragment. */
export const SFUMA_GLSL = /* glsl */ `
// x = comparsa (0..1), y = scomparsa (1..0). Nel fragment la comparsa si retina con la soglia
// rovesciata rispetto alla scomparsa: dove un livello sparisce l'altro compare, pixel per pixel
// (con la stessa soglia i due livelli lascerebbero buchi negli stessi pixel).
vec2 sfumaDistanza2(float d) {
  vec2 v = vec2(1.0);
  if (uSfuma.y > 0.0) v.x = smoothstep(uSfuma.x, uSfuma.y, d);
  if (uSfuma.w > 0.0) v.y = 1.0 - smoothstep(uSfuma.z, uSfuma.w, d);
  return v;
}
float sfumaDistanza(float d) {
  vec2 v = sfumaDistanza2(d);
  return v.x * v.y;
}
`;

/** Retinatura del passaggio fra livelli (fragment): `vSfuma` = (comparsa, scomparsa). */
export const RETINA_GLSL = /* glsl */ `
bool retinato(vec2 sf) {
  float h = hash12(floor(gl_FragCoord.xy) + 0.37);
  return (sf.x < 0.999 && 1.0 - h >= sf.x) || (sf.y < 0.999 && h >= sf.y);
}
`;
