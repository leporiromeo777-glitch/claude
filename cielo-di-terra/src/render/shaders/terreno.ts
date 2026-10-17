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
// tocchi di pennello: celle allungate, ognuna nel suo verso; x = tono del tocco (0..1), y = secondo
// tono, z = distanza dal bordo del tocco (in celle). (Migliorie, suolo, correzione: prima tutti i tocchi
// stavano nello stesso angolo, e anche la deformazione dei bordi tirava lungo la stessa diagonale: il
// prato sembrava pettinato in un verso solo, o mosso. Ora ogni cella ha il suo verso, come le pennellate
// di un pittore; l'angolo non dipende dal luogo, quindi niente anelli)
vec3 tocchi(vec2 uv, float scala, float ang, float seed) {
  vec2 x = uv / scala + seed;
  // bordi irregolari: dominio deformato con due rumori (in tutte le direzioni)
  x += (vec2(vnoise2(x * 1.7), vnoise2(x * 1.7 + 5.3)) - 0.5) * 0.7;
  vec2 n = floor(x - 0.5);
  vec2 f = x - n;
  float d1 = 8.0;
  float d2 = 8.0;
  vec2 c1 = vec2(0.0);
  vec2 base = vec2(cos(ang), sin(ang));
  for (int k = 0; k < 4; k++) {
    vec2 g = vec2(float(k & 1), float(k >> 1));
    vec2 h = hash22(n + g);
    vec2 r = g + h * 0.5 + 0.25 - f;
    // il verso del tocco: a caso per cella, fino a ~±70° attorno ad 'ang' (una direzione dal caso,
    // senza seni e coseni per cella: costa come le celle di prima)
    vec2 dv = normalize(base + (hash22(n + g + seed * 0.37) - 0.5) * 2.4);
    vec2 q = vec2(dv.x * r.x + dv.y * r.y, -dv.y * r.x + dv.x * r.y) * vec2(0.66, 1.3);
    float d = dot(q, q);
    if (d < d1) { d2 = d1; d1 = d; c1 = n + g; }
    else if (d < d2) { d2 = d; }
  }
  float a1 = sqrt(d1);
  float bordo = sqrt(d2) - a1;
  float id = hash12(c1 + 0.37);
  // il tocco sfuma dal centro al bordo (rifinitura 2: con il bordo netto il prato era un mosaico)
  float k = smoothstep(0.0, 0.8, bordo);
  return vec3(mix(0.5, id, k), mix(0.5, hash12(vec2(id * 97.0, seed)), k), bordo);
}

/**
 * Fili d'erba in piedi, dipinti sul suolo vicino (migliorie, suolo, correzione: «l'erba vera sono
 * ciuffi radi e staccati, non un tappeto»). Fra un ciuffo e l'altro il prato era colore steso; ora,
 * entro ~10 m, è fatto di fili: ogni cella di 'cs' metri (ancorata al mondo) ha due fili col piede in
 * un punto a caso. Un filo alto 'hb' visto dall'occhio (alto 'H' sopra il suolo) copre sul suolo un
 * tratto lungo r·hb/(H − hb) nella direzione che si allontana dalla camera: disegnato lì, steso, sullo
 * schermo si legge dritto, in piedi, come un filo vero (e come i fili veri gira appena attorno al suo
 * piede quando si cammina: niente scivola). 'p' = coordinate srotolate del punto (arco, z), 'hP' = sua
 * quota, 'pix' = metri per pixel. Restituisce x = copertura (0..1), y = posizione lungo il filo (0
 * piede, 1 punta), z = seme del filo.
 */
vec3 filiErba(vec2 p, float hP, float pix, float cs) {
  vec3 cam = cylLocal(cameraPosition);
  vec2 dv = p - cam.xy;
  // (la cucitura dell'arco a theta = 0/360)
  float giro = 6.2831853 * uR;
  dv.x -= giro * floor(dv.x / giro + 0.5);
  float r = length(dv);
  float H = cam.z - hP;
  if (r < 0.05 || H < 0.3) return vec3(0.0);
  vec2 d = dv / r;
  vec2 camP = p - dv;
  // le celle da cui un filo può arrivare fino al punto stanno fra il punto e la camera, entro 'lmax'
  float lmax = 2.5;
  vec2 g = p / cs;
  vec2 cell = floor(g);
  vec2 dir = -d;
  vec2 sv = vec2(dir.x >= 0.0 ? 1.0 : -1.0, dir.y >= 0.0 ? 1.0 : -1.0);
  vec2 inv = 1.0 / max(abs(dir), vec2(1e-4));
  vec2 tMax = vec2(dir.x >= 0.0 ? cell.x + 1.0 - g.x : g.x - cell.x, dir.y >= 0.0 ? cell.y + 1.0 - g.y : g.y - cell.y) * inv;
  vec3 res = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    for (int k = 0; k < 3; k++) {
      vec2 h = hash22(cell + vec2(float(k) * 37.1, float(k) * 11.7));
      vec2 b = (cell + h) * cs;
      float h2 = hash12(cell * 1.31 + float(k) * 5.17);
      float hb = 0.07 + 0.15 * h2 * h2;
      vec2 db = b - camP;
      float rb = length(db);
      vec2 ub = db / max(rb, 1e-3);
      float L = clamp(rb * hb / max(H - hb, 0.25), 0.015, lmax * cs);
      vec2 q = p - b;
      float t = dot(q, ub) / L;
      if (t < 0.0 || t > 1.0) continue;
      // il filo si piega un poco verso la punta, da una parte o dall'altra
      float x = dot(q, vec2(-ub.y, ub.x)) - (h.x - 0.5) * 0.9 * t * t * L;
      float w = (0.006 + 0.006 * h.y) * (1.0 - 0.8 * t);
      float aa = pix * 0.7;
      float cov = (1.0 - smoothstep(max(w - aa, 0.0), w + aa, abs(x))) * min(1.0, w * 2.0 / max(aa, 1e-5));
      cov *= 1.0 - smoothstep(0.88, 1.0, t);
      // i fili più vicini alla camera coprono quelli dietro (le celle si visitano verso la camera)
      res = mix(res, vec3(1.0, t, hash12(cell * 0.71 + float(k) * 3.3)), clamp(cov * 1.6, 0.0, 1.0));
    }
    float tm = min(tMax.x, tMax.y);
    if (tm > lmax) break;
    if (tMax.x < tMax.y) {
      cell.x += sv.x;
      tMax.x += inv.x;
    } else {
      cell.y += sv.y;
      tMax.y += inv.y;
    }
  }
  return res;
}

/**
 * Il colore del prato (le chiazze): 'a' = colore di base (verde), 'cl' = coordinate srotolate (arco,
 * z, quota), 'pix' = metri per pixel, 'flatK' = quanto è in piano (1 = orizzontale), 'grass' = quanto
 * è prato (0..1).
 *
 * Migliorie del 16 ottobre («la grafica del suolo»): il prato era una spalmata giallo-oliva quasi
 * uniforme che la luce dorata faceva arancione. Ora tre materiali che si distinguono a colpo d'occhio,
 * come nel bozzetto 2: chiazze di verde d'oliva (scuro nelle conche, fresco, al sole), d'oro secco
 * (paglia) e, più sui pendii, di ruggine delle felci. (Correzione: le chiazze d'oro e di ruggine sono
 * più grandi e più frequenti, con un'ottava di 5-6 m che le porta anche dentro un prato di 20 m:
 * prima, nel prologo, il prato era quasi tutto verde; i verdi meno gialli, perché a metà mattina il
 * prato al sole non diventi limone, e il verde scuro meno scuro: niente mimetico a macchie)
 * La luminosità resta quella del bioma (il colore per vertice): boschi e conche più scuri.
 */
vec3 pratoColore(vec3 a, vec3 cl, float pix, float flatK, float grass) {
  float lumA = lumaP(a);
  // la luminosità del bioma rispetto al prato di riferimento (#7d8a4a, 0,51)
  float kL = clamp(lumA / 0.51, 0.72, 1.22);
  // chiazze grandi: m1 verde ↔ secco, m2 ruggine, m3 verde scuro ↔ fresco ↔ al sole. Le ottave
  // piccole si spengono con la distanza in pixel verso il loro valore medio: dall'alto e da lontano
  // erano un mimetico a macchioline
  // (le ottave che non si vedono non si calcolano: da lontano restano le sole chiazze grandi)
  float vp = visMotivo(pix, 8.0);
  float v4 = visMotivo(pix, 4.0);
  float v3 = visMotivo(pix, 3.0);
  // (l'ottava di 30 m pesa meno: dove era bassa, come lungo la strada del prologo, un prato di 30-40 m
  // restava tutto verde; ora l'oro secco entra a chiazze di 5-10 m anche lì)
  float m1 = vnoise2(cl.xy / 30.0 + 3.1) * 0.36 + (vp > 0.0 ? mix(0.5, vnoise2(cl.xy / 9.0 + 9.4), vp) : 0.5) * 0.38 + (v4 > 0.0 ? mix(0.5, vnoise2(cl.xy / 4.5 + 2.2), v4) : 0.5) * 0.26;
  float m2 = vnoise2(cl.xy / 26.0 + 21.7) * 0.5 + (vp > 0.0 ? mix(0.5, vnoise2(cl.xy / 7.0 + 4.2), vp) : 0.5) * 0.32 + (v3 > 0.0 ? mix(0.5, vnoise2(cl.xy / 3.2 + 7.6), v3) : 0.5) * 0.18;
  float m3 = vnoise2(cl.xy / 13.0 + 5.3) * 0.8 + (v4 > 0.0 ? mix(0.5, vnoise2(cl.xy / 4.3 + 1.9), v4) : 0.5) * 0.2;
  // (verdi d'oliva, non lime né limone)
  vec3 g = mix(vec3(0.4, 0.45, 0.28), vec3(0.47, 0.51, 0.31), smoothstep(0.3, 0.62, m3));
  g = mix(g, vec3(0.53, 0.55, 0.35), smoothstep(0.6, 0.85, m3) * 0.5);
  // oro secco: paglia d'ottobre, più chiara e più spenta del verde (~40% del prato)
  float secco = smoothstep(0.47, 0.6, m1);
  // (un poco verso l'arancio: la mappatura dei toni porta i gialli chiari al sole verso il limone)
  vec3 paglia = mix(vec3(0.63, 0.48, 0.28), vec3(0.71, 0.57, 0.35), m2);
  g = mix(g, paglia, secco * 0.9);
  // felci d'ottobre color ruggine, a macchie (più sui pendii, ma anche in piano; meno sull'oro)
  float rug = smoothstep(0.58, 0.72, m2) * (0.58 + 0.35 * (1.0 - flatK)) * (1.0 - 0.5 * secco);
  g = mix(g, vec3(0.58, 0.36, 0.2), rug);
  // un poco della tinta del bioma (prati d'ocra, pascoli, sottobosco) e la sua luminosità
  g = mix(g * kL, a, 0.16);
  a = mix(a, g, grass);
  // variazione di valore a chiazze di 7-15 m (±8%): il prato non è mai una campitura uniforme
  // (si spengono con la distanza in pixel: sull'altra metà, di scorcio, farebbero increspature)
  float vc = visMotivo(pix, 12.0) * grass;
  if (vc > 0.0) {
    float chiazza = vnoise2(cl.xy / 15.0 + 31.7) * 0.6 + vnoise2(cl.xy / 7.0 + 12.9) * 0.4;
    a *= 1.0 + (chiazza - 0.5) * 0.16 * vc;
  }
  return a;
}

/**
 * Il prato dipinto intero: il colore delle chiazze («pratoColore», la sola parte che serve ai fili
 * d'erba del sottobosco) più i cespi, i tocchi di pennello, i fili in piedi vicino e le foglie cadute.
 * Stessi parametri, più 'duv' = coordinate della proiezione dominante; 'st' (out) = luminosità del
 * tocco (-0.5..0.5).
 */
vec3 pratoDipinto(vec3 a, vec3 cl, vec2 duv, float pix, float flatK, float grass, out float st) {
  a = pratoColore(a, cl, pix, flatK, grass);
  st = 0.0;
  // cespi (0,2-0,6 m): macchie tonde e irregolari, più chiare e gialle in cima, in ombra e più verdi al
  // piede. (Correzione: prima erano macchie allungate tutte nella stessa diagonale, «pennellate tirate
  // o un mosso»; ora il rumore è uguale in tutte le direzioni, deformato perché non sia un selciato).
  // Fino a ~25 m (Media e Alta; a Bassa fino a ~10 m), poi resta il colore medio
  float vz = visMotivo(pix, 1.3) * grass;
  if (vz > 0.0) {
    vec2 q = duv + (vec2(vnoise2(duv * 1.9 + 3.0), vnoise2(duv * 1.9 + 8.0)) - 0.5) * 0.35;
    float c = vnoise2(q / 0.24 + 17.0) * 0.55 + vnoise2(q / 0.6 + 5.0) * 0.45;
    float cima = smoothstep(0.54, 0.8, c);
    float piede = smoothstep(0.42, 0.16, c);
    st += (cima - piede) * 0.4 * vz;
    a *= 1.0 + (cima * 0.09 - piede * 0.08) * vz;
    a = mix(a, a * vec3(1.05, 1.03, 0.88), cima * 0.35 * vz);
    a = mix(a, a * vec3(0.92, 1.0, 0.95), piede * 0.35 * vz);
  }

  // tocchi di pennello sopra (leggeri: i cespi e i fili portano già la variazione), ognuno nel suo verso
  float ang = 0.5;
  float v1 = visMotivo(pix, 1.7);
  float v2 = visMotivo(pix, 3.6);
  float tw = 0.0;
  // sulla terra (sentieri, terra battuta, campi) i tocchi sono più leggeri: a celle nette di 1-2 m
  // e con il ±20% di valore, da vicino sembravano le faccette di un terreno triangolato
  float tv = mix(0.4, 1.0, grass);
  if (v2 > 0.0) {
    vec3 t2 = tocchi(duv, 5.0, ang, 3.0);
    st += (t2.x - 0.5) * v2 * 0.4 * mix(0.7, 1.0, grass);
    tw += (t2.y - 0.5) * v2 * 0.6;
  }
  if (v1 > 0.0) {
    vec3 t1 = tocchi(duv, 1.3, ang + 1.3, 7.0);
    st += (t1.x - 0.5) * v1 * 0.3 * tv;
    tw += (t1.y - 0.5) * v1 * 0.45;
  }
  a *= 1.0 + st * mix(0.3, 0.42, grass);
  // tocchi caldi e freddi (come nei bozzetti: giallo-oliva e verde-azzurro accostati)
  a = mix(a, a * vec3(1.08, 1.02, 0.86), clamp(tw * 2.0, 0.0, 1.0) * 0.5);
  a = mix(a, a * vec3(0.86, 0.98, 1.08), clamp(-tw * 2.0, 0.0, 1.0) * mix(0.45, 0.5, grass));

  // fili d'erba in piedi vicino al giocatore (vedi filiErba): fra i fili il prato è più scuro (l'ombra
  // dentro l'erba), i fili chiari in punta, verdi o di paglia secondo la chiazza e il filo. In media
  // la luminosità resta quella di prima. (A Bassa, con la risoluzione al 70%, i pixel sono più grandi:
  // i fili finiscono da soli più vicino, a ~7 m)
  float vfil = (1.0 - smoothstep(0.009, 0.02, pix)) * smoothstep(0.25, 0.5, grass) * smoothstep(0.58, 0.78, flatK) * uSuolo.z;
  float foglia = 0.0;
  if (vfil > 0.0) {
    vec3 fi = filiErba(cl.xy, cl.z, pix, 0.15);
    float secco = smoothstep(0.47, 0.6, vnoise2(cl.xy / 30.0 + 3.1) * 0.36 + vnoise2(cl.xy / 9.0 + 9.4) * 0.38 + vnoise2(cl.xy / 4.5 + 2.2) * 0.26);
    // il colore del filo: quello del prato, più giallo dove è secco e per un filo su tre; un filo su
    // quattro è in ombra (più scuro e più verde), come dentro un prato vero
    vec3 fc = a * mix(vec3(0.98, 1.04, 0.9), vec3(1.14, 1.04, 0.78), max(secco, step(0.67, fi.z)) * 0.8);
    fc *= mix(0.82, 1.3, smoothstep(0.0, 0.9, fi.y)) * (0.9 + 0.2 * fi.z);
    fc = mix(fc, a * vec3(0.68, 0.76, 0.64), step(fi.z, 0.25));
    vec3 fondo = a * vec3(0.85, 0.89, 0.85);
    a = mix(a, mix(fondo, fc, fi.x), vfil);
    st += (fi.x * (fi.y - 0.3) * 0.5 - (1.0 - fi.x) * 0.1) * vfil;
  }
  // ottobre: qualche foglia caduta sul prato, a gruppi radi, solo a qualità piena (le foglie vere
  // sotto i castagni le mette il sottobosco della traccia «natura»): tocchi piccoli, non pozze arancioni
  float v3 = visMotivo(pix, 0.5) * step(0.5, uDettaglio);
  if (v3 > 0.0) {
    vec3 t3 = tocchi(duv, 0.32, ang - 0.7, 11.0);
    float gruppi = smoothstep(0.55, 0.85, vnoise2(cl.xy / 6.0 + 2.7));
    foglia = step(1.0 - 0.05 * gruppi, t3.x) * smoothstep(0.12, 0.3, t3.z) * v3 * grass;
  }
  vec3 fogliaC = mix(vec3(0.74, 0.42, 0.16), vec3(0.82, 0.62, 0.24), hash12(floor(duv / 0.3) + 0.5));
  a = mix(a, fogliaC, foglia * 0.6);
  return a;
}

/**
 * Terra nuda dipinta sul terreno (migliorie, suolo, correzione): i sentieri di campagna senza nastro, le
 * spalle dei sentieri, il piede dei muraglioni delle terrazze, le sponde. Era una campitura khaki
 * liscia («la stessa spalmata uniforme, solo di un altro colore»); ora è terra: chiazze d'umido e di
 * polvere, grumi e sassolini fino a ~12 m, e qualche filo d'erba rado che la orla. 'k' = quanto il
 * punto è terra (0..1).
 */
vec3 terraDipinta(vec3 a, vec3 cl, vec2 duv, float pix, float flatK, float k) {
  float m = vnoise2(duv / 2.2 + 4.0) * 0.6 + vnoise2(duv / 0.9 + 1.0) * 0.4;
  vec3 t = a * (0.9 + 0.2 * m);
  // umido (più scuro e più freddo) e polvere (più chiara), a chiazze di qualche metro
  t = mix(t, t * vec3(0.8, 0.79, 0.78), smoothstep(0.6, 0.85, vnoise2(duv / 3.5 + 8.0)) * 0.55);
  t = mix(t, t * 1.12 + 0.02, smoothstep(0.58, 0.85, vnoise2(duv / 1.4 + 2.0)) * 0.4);
  float vs = visMotivo(pix, 0.6);
  if (vs > 0.0) {
    // sassolini (5-10 cm) con l'ombra al piede, e grumi di terra
    vec2 w = duv * 9.0 + 3.3;
    w += (vec2(vnoise2(w * 1.3), vnoise2(w * 1.3 + 7.7)) - 0.5) * 0.6;
    vec3 vo = voronoi4(w);
    float c0 = step(0.84, vo.z);
    float sasso = c0 * (1.0 - smoothstep(0.1, 0.2, vo.y));
    float ombra = c0 * (1.0 - smoothstep(0.2, 0.3, vo.y)) * (1.0 - sasso);
    vec3 sc = mix(vec3(0.52, 0.5, 0.47), vec3(0.66, 0.63, 0.58), hash12(vec2(vo.z * 91.0, 3.0)));
    t = mix(t, mix(t, sc, 0.4), sasso * vs);
    t *= 1.0 - ombra * 0.08 * vs;
    t *= 1.0 + (vnoise2(duv * 13.0 + 1.0) - 0.5) * 0.16 * vs;
  }
  // fili d'erba radi (uno su tre dei fili del prato), verdi e di paglia
  float vfil = (1.0 - smoothstep(0.009, 0.02, pix)) * smoothstep(0.58, 0.78, flatK) * uSuolo.z;
  if (vfil > 0.0) {
    vec3 fi = filiErba(cl.xy, cl.z, pix, 0.15);
    float radi = fi.x * step(0.62, fi.z);
    vec3 fc = mix(vec3(0.42, 0.46, 0.27), vec3(0.66, 0.58, 0.36), step(0.8, fi.z)) * mix(0.8, 1.3, fi.y);
    t = mix(t, fc, radi * vfil);
  }
  return mix(a, t, k);
}

// restituisce quanto il punto è prato (0..1): la terra nuda (sentieri, campi, rive) tiene di più il
// colore locale nella luce dorata (vedi worldMaterial)
float terrenoDipinto(inout Sup s, vec3 P, vec3 Nv, float dist, float pix) {
  vec3 up = cylUp(P);
  vec3 cl = cylLocal(P);
  float flatK = clamp(dot(Nv, up), 0.0, 1.0);
  // (correzione: il prato tiene fino a ~48°, dove comincia la roccia dipinta; prima si spegneva già da
  // 35° e fra 35° e 52° restavano falde ocra lisce, senza erba né roccia: scarpate delle terrazze,
  // sotto il belvedere)
  float steep = 1.0 - smoothstep(0.42, 0.66, flatK);
  vec3 a = s.albedo;
  vec2 duv = cylDominantUV(P, Nv);
  s.bande = 0.32;

  // --- prati: chiazze grandi (decine di metri) fra verde caldo, oro secco e ruggine, e tocchi ---
  // (il prato del paese, #8e9259 mescolato, valeva solo 0,3: ora i prati d'oliva sono prato pieno;
  // l'ocra, le rive, la terra e la roccia restano fuori)
  // (correzione: +0,07 invece di +0,05: il prato del paese, fra le case, era prato solo a metà e le
  // chiazze d'oro e di ruggine vi si vedevano appena)
  float grass = clamp((a.g - max(a.r, a.b) + 0.07) * 8.0, 0.0, 1.0) * (1.0 - steep * 0.7);
  // (migliorie, suolo) sulla terra nuda luce quasi senza bande: sulle sponde dei sentieri nella luce
  // radente la banda più chiara faceva una striscia rosso mattone
  s.bande = mix(0.16, 0.32, grass);
  float lumA = lumaP(a);
  float st;
  a = pratoDipinto(a, cl, duv, pix, flatK, grass, st);
  // la terra nuda: bruna (rosso sopra il blu), non prato, non roccia grigia
  float terra = (1.0 - grass) * smoothstep(0.05, 0.12, a.r - a.b) * smoothstep(0.42, 0.62, flatK);
  if (terra > 0.01) a = terraDipinta(a, cl, duv, pix, flatK, terra);

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
