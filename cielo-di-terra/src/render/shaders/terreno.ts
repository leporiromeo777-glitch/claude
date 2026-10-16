/**
 * Pittura del terreno (traccia «luce», base per la traccia «natura»).
 *
 * Il colore per vertice (`render/palette.ts`) dà il bioma: prato, bosco, paese, rive, roccia.
 * Qui, per pixel e ancorata al mondo, la variazione pittorica d'ottobre:
 * - prati verdi caldi a chiazze, erba secca dorata, felci color ruggine;
 * - tocchi di pennello: un mosaico di pennellate corte (celle di Voronoi allungate, ognuna col
 *   suo tono caldo o freddo, bordo netto ma morbido) su tre scale, nelle coordinate "srotolate"
 *   del cilindro e nella proiezione dominante: niente stiramenti sui pendii;
 * - terra ocra e foglie cadute nel sottobosco;
 * - roccia grigia a strati sui pendii ripidi, con spaccature e muschio sulle cenge;
 * - tutto sfuma con la distanza in pixel (niente sfarfallio sull'altra metà del cilindro).
 *
 * `pratoDipinto` è la stessa pittura del prato per gli oggetti con superficie ERBA (zolle,
 * terrazzi, tetti verdi), così il prato degli oggetti e quello del terreno si somigliano.
 *
 * Richiede NOISE_GLSL, LIGHT_GLSL (Sup, lumaP, cylUp), BRUSH_GLSL (cylLocal, cylDominantUV)
 * e SUPERFICI_BASE_GLSL (bumpDaAltezza, visMotivo).
 */
export const TERRENO_GLSL = /* glsl */ `
// tocchi di pennello: celle allungate e ruotate; x = tono del tocco (0..1), y = secondo tono,
// z = distanza dal bordo del tocco (in celle)
vec3 tocchi(vec2 uv, float scala, float ang, float seed) {
  float ca = cos(ang);
  float sa = sin(ang);
  vec2 r = vec2(ca * uv.x + sa * uv.y, -sa * uv.x + ca * uv.y) / (scala * vec2(1.6, 0.8)) + seed;
  // bordi irregolari (dominio deformato lungo la diagonale, un solo rumore): pennellate, non
  // tessere di un mosaico
  float wn = vnoise2(r * 1.7) - 0.5;
  r += vec2(wn, -wn * 0.8) * 0.8;
  vec3 vo = voronoi4(r);
  // il tocco sfuma dal centro al bordo (rifinitura 2: con il bordo netto, smoothstep(0, 0.3), il
  // prato da vicino era un mosaico mimetico di tessere)
  float k = smoothstep(0.0, 0.8, vo.x);
  return vec3(mix(0.5, vo.z, k), mix(0.5, hash12(vec2(vo.z * 97.0, seed)), k), vo.x);
}

/**
 * Il colore del prato (le chiazze): 'a' = colore di base (verde), 'cl' = coordinate srotolate (arco,
 * z, quota), 'pix' = metri per pixel, 'flatK' = quanto è in piano (1 = orizzontale), 'grass' = quanto
 * è prato (0..1).
 *
 * Migliorie del 16 ottobre («la grafica del suolo»): il prato era una spalmata giallo-oliva quasi
 * uniforme (variazione locale 0,01-0,03 contro 0,08-0,10 dei bozzetti) che la luce dorata faceva
 * arancione. Ora tre materiali che si distinguono a colpo d'occhio, come nel bozzetto 2:
 * - chiazze grandi (6-40 m) di verde (scuro nelle conche, fresco, giallo-verde al sole), d'oro secco
 *   e, più sui pendii, di ruggine delle felci (qui);
 * - zolle e ciuffi di 0,2-0,75 m, con la cima chiara e il piede in ombra: da 3 a ~25 m il prato è
 *   fatto d'erba, non di colore steso («pratoDipinto»);
 * - tocchi di pennello più leggeri sopra, e qualche foglia caduta («pratoDipinto»).
 * La luminosità resta quella del bioma (il colore per vertice): boschi e conche più scuri.
 */
vec3 pratoColore(vec3 a, vec3 cl, float pix, float flatK, float grass) {
  float lumA = lumaP(a);
  // la luminosità del bioma rispetto al prato di riferimento (#7d8a4a, 0,51)
  float kL = clamp(lumA / 0.51, 0.72, 1.22);
  // chiazze grandi: m1 verde ↔ secco, m2 ruggine, m3 verde scuro ↔ fresco ↔ al sole. Le ottave
  // piccole (4-11 m) si spengono con la distanza in pixel verso il loro valore medio: dall'alto e da
  // lontano erano un mimetico a macchioline
  float vp = visMotivo(pix, 8.0);
  float m1 = vnoise2(cl.xy / 36.0 + 3.1) * 0.55 + mix(0.5, vnoise2(cl.xy / 11.0 + 9.4), vp) * 0.45;
  float m2 = vnoise2(cl.xy / 33.0 + 21.7) * 0.7 + mix(0.5, vnoise2(cl.xy / 8.0 + 4.2), vp) * 0.3;
  float m3 = vnoise2(cl.xy / 11.0 + 5.3) * 0.78 + mix(0.5, vnoise2(cl.xy / 4.3 + 1.9), visMotivo(pix, 4.0)) * 0.22;
  // (verdi d'oliva, non lime: al sole di mezzogiorno il verde fresco virava al limone)
  vec3 g = mix(vec3(0.38, 0.44, 0.26), vec3(0.48, 0.53, 0.32), smoothstep(0.28, 0.6, m3));
  g = mix(g, vec3(0.58, 0.6, 0.38), smoothstep(0.58, 0.82, m3) * 0.6);
  // oro secco: paglia, non limone (più chiaro e più spento del verde)
  float secco = smoothstep(0.5, 0.64, m1);
  g = mix(g, vec3(0.72, 0.63, 0.41) * (0.9 + 0.2 * m2), secco * 0.85);
  // felci d'ottobre color ruggine, a macchie (più sui pendii, meno sull'oro)
  float rug = smoothstep(0.64, 0.8, m2) * (0.32 + 0.45 * (1.0 - flatK)) * (1.0 - 0.5 * secco);
  g = mix(g, vec3(0.6, 0.37, 0.2), rug);
  // un poco della tinta del bioma (prati d'ocra, pascoli, sottobosco) e la sua luminosità
  g = mix(g * kL, a, 0.18);
  a = mix(a, g, grass);
  // variazione di valore a chiazze di 7-15 m (±10%): il prato non è mai una campitura uniforme
  // (si spengono con la distanza in pixel: sull'altra metà, di scorcio, farebbero increspature)
  float chiazza = vnoise2(cl.xy / 15.0 + 31.7) * 0.6 + vnoise2(cl.xy / 7.0 + 12.9) * 0.4;
  a *= 1.0 + (chiazza - 0.5) * 0.2 * grass * visMotivo(pix, 12.0);
  return a;
}

/**
 * Il prato dipinto intero: il colore delle chiazze («pratoColore», la sola parte che serve ai fili
 * d'erba del sottobosco) più le zolle, i tocchi di pennello e le foglie cadute. Stessi parametri, più
 * 'duv' = coordinate della proiezione dominante; 'st' (out) = luminosità del tocco (-0.5..0.5).
 */
vec3 pratoDipinto(vec3 a, vec3 cl, vec2 duv, float pix, float flatK, float grass, out float st) {
  a = pratoColore(a, cl, pix, flatK, grass);
  st = 0.0;
  // zolle e ciuffi (0,2-0,75 m): macchie morbide allungate come tocchi (rumore, non celle: le celle di Voronoi col bordo scuro
  // facevano un selciato) con la cima dei ciuffi più chiara e gialla e il piede in ombra, più verde.
  // Si vedono fino a ~25 m (Media e Alta; a Bassa fino a ~10 m), poi resta il colore medio: più in
  // là, di scorcio, diventavano un mimetico fitto
  float vz = visMotivo(pix, 1.3) * grass;
  if (vz > 0.0) {
    vec2 q = vec2(0.8 * duv.x - 0.6 * duv.y, 0.6 * duv.x + 0.8 * duv.y);
    float c = vnoise2(q / vec2(0.3, 0.17) + 17.0) * 0.55 + vnoise2(q / vec2(0.75, 0.45) + 5.0) * 0.45;
    float cima = smoothstep(0.52, 0.8, c);
    float piede = smoothstep(0.44, 0.16, c);
    st += (cima - piede) * 0.5 * vz;
    a *= 1.0 + (cima * 0.16 - piede * 0.18) * vz;
    a = mix(a, a * vec3(1.05, 1.03, 0.88), cima * 0.4 * vz);
    a = mix(a, a * vec3(0.92, 1.0, 0.95), piede * 0.35 * vz);
  }

  // tocchi di pennello sopra (più leggeri: le zolle portano già la variazione)
  // angolo costante: ruotare coordinate assolute (centinaia di metri) con un angolo variabile
  // disegnerebbe anelli concentrici; la varietà la danno le celle stesse
  float ang = 0.5;
  float v1 = visMotivo(pix, 1.7);
  float v2 = visMotivo(pix, 3.6);
  float tw = 0.0;
  // sulla terra (sentieri, terra battuta, campi) i tocchi sono più leggeri: a celle nette di 1-2 m
  // e con il ±20% di valore, da vicino sembravano le faccette di un terreno triangolato
  float tv = mix(0.4, 1.0, grass);
  if (v2 > 0.0) {
    vec3 t2 = tocchi(duv, 5.0, ang, 3.0);
    st += (t2.x - 0.5) * v2 * 0.45 * mix(0.7, 1.0, grass);
    tw += (t2.y - 0.5) * v2 * 0.6;
  }
  if (v1 > 0.0) {
    vec3 t1 = tocchi(duv, 1.3, ang + 0.4, 7.0);
    st += (t1.x - 0.5) * v1 * 0.35 * tv;
    tw += (t1.y - 0.5) * v1 * 0.45;
  }
  // vicino al giocatore, solo a qualità piena: fili d'erba dipinti (trattini corti, chiari e scuri)
  // e qualche foglia caduta
  float v3 = visMotivo(pix, 0.5) * step(0.5, uDettaglio);
  float foglia = 0.0;
  if (v3 > 0.0) {
    vec3 t3 = tocchi(duv, 0.32, ang - 0.7, 11.0);
    vec2 dp = vec2(dot(duv, vec2(0.8, 0.6)), dot(duv, vec2(-0.6, 0.8)));
    float fil = vnoise2(dp * vec2(9.0, 26.0) + 11.0) * 0.6 + vnoise2(dp * vec2(17.0, 41.0) + 3.0) * 0.4;
    st += (fil - 0.5) * v3 * 0.5 * grass;
    tw += (vnoise2(dp * vec2(0.9, 2.6) + 21.0) - 0.5) * v3 * 0.3;
    // ottobre: qualche foglia caduta sul prato, a gruppi radi (le foglie vere sotto i castagni le
    // mette il sottobosco della traccia «natura»): tocchi piccoli, non pozze arancioni
    float gruppi = smoothstep(0.55, 0.85, vnoise2(cl.xy / 6.0 + 2.7));
    foglia = step(1.0 - 0.05 * gruppi, t3.x) * smoothstep(0.12, 0.3, t3.z) * v3 * grass;
  }
  a *= 1.0 + st * mix(0.3, 0.42, grass);
  // tocchi caldi e freddi (come nei bozzetti: giallo-oliva e verde-azzurro accostati)
  a = mix(a, a * vec3(1.08, 1.02, 0.86), clamp(tw * 2.0, 0.0, 1.0) * mix(0.5, 0.5, grass));
  a = mix(a, a * vec3(0.86, 0.98, 1.08), clamp(-tw * 2.0, 0.0, 1.0) * mix(0.45, 0.5, grass));
  vec3 fogliaC = mix(vec3(0.74, 0.42, 0.16), vec3(0.82, 0.62, 0.24), hash12(floor(duv / 0.3) + 0.5));
  a = mix(a, fogliaC, foglia * 0.6);
  return a;
}

// restituisce quanto il punto è prato (0..1): la terra nuda (sentieri, campi, rive) tiene di più il
// colore locale nella luce dorata (vedi worldMaterial)
float terrenoDipinto(inout Sup s, vec3 P, vec3 Nv, float dist, float pix) {
  vec3 up = cylUp(P);
  vec3 cl = cylLocal(P);
  float flatK = clamp(dot(Nv, up), 0.0, 1.0);
  float steep = 1.0 - smoothstep(0.5, 0.82, flatK);
  vec3 a = s.albedo;
  vec2 duv = cylDominantUV(P, Nv);
  s.bande = 0.32;

  // --- prati: chiazze grandi (decine di metri) fra verde caldo, oro secco e ruggine, e tocchi ---
  // (il prato del paese, #8e9259 mescolato, valeva solo 0,3: ora i prati d'oliva sono prato pieno;
  // l'ocra, le rive, la terra e la roccia restano fuori)
  float grass = clamp((a.g - max(a.r, a.b) + 0.05) * 8.0, 0.0, 1.0) * (1.0 - steep * 0.7);
  // (migliorie, suolo) sulla terra nuda luce quasi senza bande: sulle sponde dei sentieri nella luce
  // radente la banda più chiara faceva una striscia rosso mattone
  s.bande = mix(0.16, 0.32, grass);
  float lumA = lumaP(a);
  float st;
  a = pratoDipinto(a, cl, duv, pix, flatK, grass, st);

  // --- sottobosco: foglie cadute ocra e ruggine ---
  float litter = clamp((0.36 - lumA) * 4.0, 0.0, 1.0) * (1.0 - steep);
  if (litter > 0.0) {
    float lf = vnoise2(cl.xy / 2.5 + 7.0) * 0.6 + vnoise2(cl.xy / 0.8) * 0.4 * visMotivo(pix, 1.7);
    a = mix(a, vec3(0.62, 0.38, 0.18) * (0.8 + 0.4 * lf), smoothstep(0.5, 0.78, lf) * litter * 0.65);
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
    // ogni strato è una campitura (tono suo, quasi piatto), con lo spigolo in luce sopra e
    // l'ombra netta sotto: niente sfumature lungo il pendio (sembrerebbero strisciate)
    vec3 rc = mix(vec3(0.6, 0.58, 0.55), vec3(0.68, 0.6, 0.48), band) * (0.84 + 0.22 * hash12(vec2(floor(layer), 9.1)));
    rc *= 0.94 + 0.12 * vnoise2(duv / 1.7);
    rc = mix(rc, a * 0.9 + 0.06, 0.2);
    float vs = visMotivo(pix, 2.4);
    rc *= 1.0 - (1.0 - smoothstep(0.0, 0.05, fr)) * 0.45 * vs;
    rc *= 1.0 + smoothstep(0.86, 0.97, fr) * 0.12 * vs;
    // spaccature verticali
    float cr = vnoise2(vec2(duv.x * 1.3, hgt * 0.18) + 2.0);
    rc *= 1.0 - smoothstep(0.78, 0.86, cr) * 0.32 * vs;
    // licheni chiari e ruggine sulle facce
    rc = mix(rc, vec3(0.78, 0.6, 0.36), smoothstep(0.74, 0.86, vnoise2(duv / 1.6 + 13.0)) * 0.3 * vs);
    // muschio sulle cenge e alla base
    float moss = smoothstep(0.55, 0.8, flatK + (vnoise2(duv / 2.0 + 9.0) - 0.5) * 0.5);
    rc = mix(rc, vec3(0.38, 0.46, 0.2), moss * 0.6);
    a = mix(a, rc, rockW * (1.0 - grass * 0.5));
    s.N = bumpDaAltezza(s.N, P, smoothstep(0.0, 0.3, fr) * 0.35 * vs * rockW, 1.0);
    s.ao *= 1.0 - (1.0 - smoothstep(0.0, 0.1, fr)) * 0.3 * vs * rockW;
    s.bande = mix(s.bande, 0.6, rockW);
  }
  s.albedo = a;
  return grass;
}
`;
