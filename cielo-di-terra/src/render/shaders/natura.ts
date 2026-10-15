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
 * Chioma dipinta. 'seme' varia il disegno da un albero all'altro, 'Nv' = normale geometrica
 * (già piegata verso la sfera della chioma), 'up' = su locale, 'pix' = metri per pixel.
 * 'vMassa' (0..1) = quanto il frammento sta al bordo della chioma (1 = fuori, in luce).
 */
void chiomaDipinta(inout Sup s, vec3 P, vec3 Nv, vec3 up, float pix, float seme, float esterno) {
  vec3 c = s.albedo;
  float gap = 0.0;
  // dominio deformato: i ciuffi non sono celle regolari ma masse di foglie irregolari
  vec3 Pw = P + (vec3(vnoise3(P * 0.45 + seme), vnoise3(P * 0.45 + 7.3), vnoise3(P * 0.45 + 13.1)) - 0.5) * 1.3;
  // grandi ciuffi (rami pieni di foglie, ~2.4 m): la chioma si rompe in masse con il loro lato in
  // luce sopra e il loro lato in ombra sotto, come la dipingerebbe un pittore
  float visG = visMotivo(pix, 5.5);
  if (visG > 0.0) {
    vec3 relG;
    vec3 voG = voronoi3(Pw / 2.4 + seme * 13.0, relG);
    vec3 nG = normalize(s.N - relG * 0.7 + up * 0.25);
    s.N = normalize(mix(s.N, nG, 0.5 * visG));
    gap = (1.0 - smoothstep(0.02, 0.14, voG.x)) * visG * 0.55;
    c *= 1.0 + (voG.z - 0.5) * 0.14 * visG;
  }
  // ciuffi di foglie: celle 3D di ~0.9 m; ogni ciuffo è una piccola cupola con la sua luce
  float sc = 0.9;
  float vis = visMotivo(pix, sc * 2.2);
  if (vis > 0.0) {
    vec3 rel;
    vec3 vo = voronoi3(Pw / sc + seme * 37.0, rel);
    // rel punta verso il centro del ciuffo: la normale della cupola è l'opposto
    vec3 nb = normalize(s.N - rel * 0.9 + up * 0.2);
    s.N = normalize(mix(s.N, nb, 0.5 * vis));
    // interstizi fra i ciuffi: scuri e freddi
    gap = max(gap, (1.0 - smoothstep(0.02, 0.2, vo.x)) * vis * 0.6);
    // ogni ciuffo ha il suo tono (foglie più chiare, più scure, che girano)
    float tono = vo.z;
    c *= 1.0 + (tono - 0.5) * 0.2 * vis;
    c = mix(c, c * vec3(1.12, 1.02, 0.76), smoothstep(0.8, 0.96, tono) * 0.45 * vis);
  }
  // macchie grandi (rami interi che hanno girato prima)
  float m = vnoise3(P * 0.33 + seme * 5.0);
  c = mix(c, c * vec3(1.14, 0.98, 0.7), smoothstep(0.62, 0.82, m) * 0.35);
  c = mix(c, c * vec3(0.88, 0.97, 1.04), smoothstep(0.32, 0.12, m) * 0.2);
  // tocchi di foglie (gruppetti di foglie, poi macchiette fini da vicino)
  float vf = visMotivo(pix, 0.32);
  if (vf > 0.0) {
    float lf = vnoise3(Pw / 0.17 + 9.0 + seme) - 0.5;
    float vf2 = visMotivo(pix, 0.1);
    if (vf2 > 0.0) lf += (vnoise3(P / 0.07 + 3.0) - 0.5) * 0.6 * vf2;
    c *= 1.0 + lf * 0.5 * vf;
    // qualche foglia accesa (tocco chiaro e caldo)
    c = mix(c, c * vec3(1.3, 1.18, 0.8), smoothstep(0.32, 0.45, lf) * 0.5 * vf);
  }
  c = mix(c, c * vec3(0.74, 0.84, 0.95), gap * 0.6);
  s.albedo = c;
  // l'interno della chioma riceve meno luce dal cielo
  s.ao *= mix(0.7, 1.0, esterno) * (1.0 - gap * 0.35);
  s.trasm = 1.0;
  s.bordo = 0.9 * (1.0 - smoothstep(0.6, 0.95, dot(Nv, up)) * 0.7);
  s.bande = 0.45;
}
`;

export const ERBA_GLSL = /* glsl */ `
// erba, felci, fiori: il colore lo danno il vertice (punta chiara, base scura) e l'istanza
void erbaDipinta(inout Sup s, vec3 P, float pix, float punta) {
  vec3 c = s.albedo;
  float v = vnoise2(cylLocal(P).xy * 0.35);
  c *= 0.9 + 0.2 * v;
  s.albedo = c;
  s.ao *= mix(0.6, 1.0, smoothstep(0.0, 0.7, punta));
  s.trasm = 0.7;
  s.bordo = 0.25;
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
float sfumaDistanza(float d) {
  float v = 1.0;
  if (uSfuma.y > 0.0) v *= smoothstep(uSfuma.x, uSfuma.y, d);
  if (uSfuma.w > 0.0) v *= 1.0 - smoothstep(uSfuma.z, uSfuma.w, d);
  return v;
}
`;
