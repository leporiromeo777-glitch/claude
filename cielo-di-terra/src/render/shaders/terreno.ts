/**
 * Pittura del terreno (traccia «luce», base per la traccia «natura»).
 *
 * Il colore per vertice (`render/palette.ts`) dà il bioma: prato, bosco, paese, rive, roccia.
 * Qui, per pixel e ancorata al mondo, la variazione pittorica d'ottobre:
 * - prati verdi caldi a chiazze, erba secca dorata, felci color ruggine;
 * - tocchi di pennello: un mosaico di pennellate corte (celle di Voronoi allungate, ognuna col
 *   suo tono caldo o freddo) su due scale, nelle coordinate "srotolate" del cilindro e nella
 *   proiezione dominante: niente stiramenti sui pendii;
 * - terra ocra e foglie cadute nel sottobosco;
 * - roccia grigia a strati sui pendii ripidi, con spaccature e muschio sulle cenge;
 * - tutto sfuma con la distanza in pixel (niente sfarfallio sull'altra metà del cilindro).
 *
 * Richiede NOISE_GLSL, LIGHT_GLSL (Sup, lumaP, cylUp), BRUSH_GLSL (cylLocal, cylDominantUV)
 * e SUPERFICI_GLSL (bumpDaAltezza, visMotivo).
 */
export const TERRENO_GLSL = /* glsl */ `
// tocchi di pennello: celle allungate e ruotate; x = tono del tocco (0..1), y = secondo tono,
// z = distanza dal bordo del tocco (in celle)
vec3 tocchi(vec2 uv, float scala, float ang, float seed) {
  float ca = cos(ang);
  float sa = sin(ang);
  vec2 r = vec2(ca * uv.x + sa * uv.y, -sa * uv.x + ca * uv.y);
  vec3 vo = voronoi4(r / (scala * vec2(1.5, 0.85)) + seed);
  // il tocco sfuma verso il bordo: pennellate morbide, non tessere di mosaico
  float k = smoothstep(0.0, 0.5, vo.x);
  return vec3(mix(0.5, vo.z, k), mix(0.5, hash12(vec2(vo.z * 97.0, seed)), k), vo.x);
}

void terrenoDipinto(inout Sup s, vec3 P, vec3 Nv, float dist, float pix) {
  vec3 up = cylUp(P);
  vec3 cl = cylLocal(P);
  float flatK = clamp(dot(Nv, up), 0.0, 1.0);
  float steep = 1.0 - smoothstep(0.5, 0.82, flatK);
  vec3 a = s.albedo;
  vec2 duv = cylDominantUV(P, Nv);
  s.bande = 0.32;

  // --- prati: chiazze grandi (decine di metri) fra verde caldo, oro secco e ruggine ---
  float grass = clamp((a.g - max(a.r, a.b)) * 7.0, 0.0, 1.0) * (1.0 - steep * 0.7);
  float m1 = vnoise2(cl.xy / 80.0 + 3.1) * 0.6 + vnoise2(cl.xy / 27.0 + 9.4) * 0.4;
  float m2 = vnoise2(cl.xy / 40.0 + 21.7);
  float lumA = lumaP(a);
  vec3 g = a;
  // verde profondo e caldo nelle conche
  g = mix(g, a * vec3(0.78, 0.9, 0.6), smoothstep(0.42, 0.22, m1) * 0.55);
  // erba secca dorata
  vec3 dry = vec3(0.79, 0.65, 0.34) * (0.88 + 0.24 * m2) * (0.7 + lumA * 0.75);
  g = mix(g, dry, smoothstep(0.5, 0.7, m1) * 0.75);
  // felci d'ottobre, color ruggine (più sui pendii)
  vec3 rust = vec3(0.66, 0.38, 0.2) * (0.85 + 0.3 * m1);
  g = mix(g, rust, smoothstep(0.66, 0.86, m2) * (0.3 + 0.3 * (1.0 - flatK)));
  a = mix(a, g, grass);

  // --- tocchi di pennello: mosaico di pennellate corte, due scale ---
  // angolo costante: ruotare coordinate assolute (centinaia di metri) con un angolo variabile
  // disegnerebbe anelli concentrici; la varietà la danno le celle stesse
  float ang = 0.5;
  float v1 = visMotivo(pix, 1.7);
  float v2 = visMotivo(pix, 3.6);
  float st = 0.0;
  float tw = 0.0;
  if (v2 > 0.0) {
    vec3 t2 = tocchi(duv, 5.0, ang, 3.0);
    st += (t2.x - 0.5) * v2 * 0.55;
    tw += (t2.y - 0.5) * v2 * 0.6;
  }
  if (v1 > 0.0) {
    vec3 t1 = tocchi(duv, 1.3, ang + 0.4, 7.0);
    st += (t1.x - 0.5) * v1 * 0.45;
    tw += (t1.y - 0.5) * v1 * 0.4;
  }
  a *= 1.0 + st * 0.26;
  // tocchi caldi e freddi (come nei bozzetti: giallo-oliva e verde-azzurro accostati)
  a = mix(a, a * vec3(1.08, 1.02, 0.82), clamp(tw * 2.0, 0.0, 1.0) * 0.55);
  a = mix(a, a * vec3(0.88, 0.98, 1.1), clamp(-tw * 2.0, 0.0, 1.0) * 0.45);
  // fili d'erba vicino al giocatore
  float v3 = visMotivo(pix, 0.12) * step(0.5, uDettaglio);
  if (v3 > 0.0) {
    // fili d'erba e minuzie del suolo: macchiette allungate, più fitte dove c'è prato
    float bl = vnoise2(duv * vec2(9.0, 3.0)) * 0.6 + vnoise2(duv * vec2(3.5, 13.0) + 5.0) * 0.4;
    a *= 1.0 + (bl - 0.5) * (0.16 + 0.3 * grass) * v3;
  }

  // --- sottobosco: foglie cadute ocra e ruggine ---
  float litter = clamp((0.36 - lumA) * 4.0, 0.0, 1.0) * (1.0 - steep);
  if (litter > 0.0) {
    float lf = vnoise2(cl.xy / 2.5 + 7.0) * 0.6 + vnoise2(cl.xy / 0.8) * 0.4 * v1;
    a = mix(a, vec3(0.6, 0.39, 0.2) * (0.8 + 0.4 * lf), smoothstep(0.5, 0.78, lf) * litter * 0.6);
  }

  // --- roccia sui pendii ripidi: grigio caldo, strati, muschio sulle cenge ---
  float rockBase = clamp(1.0 - abs(a.r - a.g) * 8.0 - abs(a.g - a.b) * 8.0, 0.0, 1.0) * smoothstep(0.3, 0.5, lumA);
  float rockW = max(smoothstep(0.62, 0.38, flatK), rockBase * 0.85);
  if (rockW > 0.01) {
    float hgt = cl.z;
    float sn = vnoise2(duv / 11.0 + 5.0);
    float layer = hgt / 2.4 + sn * 1.6 + vnoise2(duv / 3.0) * 0.25;
    float fr = fract(layer);
    float band = hash12(vec2(floor(layer), 3.3));
    vec3 rc = mix(vec3(0.6, 0.58, 0.55), vec3(0.66, 0.6, 0.5), band) * (0.82 + 0.3 * vnoise2(duv / 4.0));
    rc = mix(rc, a * 0.9 + 0.06, 0.25);
    float vs = visMotivo(pix, 2.4);
    rc *= 1.0 - (1.0 - smoothstep(0.0, 0.08, fr)) * 0.38 * vs;
    rc *= mix(1.0, mix(0.9, 1.06, smoothstep(0.1, 0.6, fr)), vs);
    // spaccature verticali
    float cr = vnoise2(vec2(duv.x * 1.3, hgt * 0.18) + 2.0);
    rc *= 1.0 - smoothstep(0.78, 0.86, cr) * 0.3 * vs;
    // muschio sulle cenge e alla base
    float moss = smoothstep(0.55, 0.8, flatK + (vnoise2(duv / 2.0 + 9.0) - 0.5) * 0.5);
    rc = mix(rc, vec3(0.38, 0.46, 0.22), moss * 0.6);
    a = mix(a, rc, rockW * (1.0 - grass * 0.5));
    s.N = bumpDaAltezza(s.N, P, smoothstep(0.0, 0.3, fr) * 0.35 * vs * rockW, 1.0);
    s.ao *= 1.0 - (1.0 - smoothstep(0.0, 0.1, fr)) * 0.3 * vs * rockW;
    s.bande = mix(s.bande, 0.6, rockW);
  }
  s.albedo = a;
}
`;
