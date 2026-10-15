/**
 * Le acque dipinte (traccia «natura»): il lago del Verbanetto, il riale di Corbella e la vasca del
 * lavatoio. Una sola pittura (`ACQUA_GLSL`), come nel bozzetto 3:
 * - colore a fasce con la profondità: riva chiara color sabbia e giada pallida, giada piena,
 *   turchese profondo verso il centro (bande morbide, campiture);
 * - riflessi morbidi del cielo con l'angolo (Fresnel), velati, con le pennellate orizzontali
 *   delle increspature che scorrono piano; qualche luccichio verso la luce;
 * - una riga di schiuma tremolante sulla riva;
 * - il riale scorre (pennellate allungate che corrono lungo z, schiuma sui sassi del fondo), la
 *   vasca del lavatoio trema appena sotto la cannella;
 * - stesso passaggio matita/colore (rilevato/abbozzo) e stessa foschia del resto del mondo.
 *
 * Superfici:
 * - lago: raggio costante (r = R - quota dell'acqua) sul bacino, `aDepth` = profondità;
 * - riale: un nastro largo 10 m lungo `rialeTheta(z)`, alla quota del fondo + 0.6 m; dove il
 *   terreno è più alto dell'acqua il frammento si scarta (`aDepth` < 0);
 * - lavatoio: un rettangolo sulla vasca (`creaAcquaLavatoio`, posato dall'integrazione).
 */
import { BufferAttribute, BufferGeometry, Mesh, ShaderMaterial, Vector3, Vector4 } from 'three';
import { DEG, L, LAYOUT, METERS_PER_DEG, R } from '../world/constants';
import { cylToWorld, upAt } from '../world/cylinder';
import { WATER_HEIGHT, createMasks, rialeTheta, surfaceHeight } from '../world/terrain';
import { BRUSH_GLSL, LIGHT_GLSL, NOISE_GLSL, PENCIL_GLSL, WORLD_UNIFORMS_GLSL } from './shaders/common';
import type { WorldUniforms } from './uniforms';

const LAKE = LAYOUT.lake;

const VERT = /* glsl */ `
attribute float aDepth;
attribute vec2 aFlusso;   // x = coordinata lungo la corrente (m), y = attraverso (-1..1)
varying vec3 vWorldPos;
varying float vDepth;
varying vec2 vFlusso;
void main() {
  vDepth = aDepth;
  vFlusso = aFlusso;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
${WORLD_UNIFORMS_GLSL}
uniform vec4 uAcqua;   // x = tipo (0 lago, 1 riale, 2 vasca), y = velocità della corrente (m/s), z = profondità della fascia profonda (m)
varying vec3 vWorldPos;
varying float vDepth;
varying vec2 vFlusso;
${NOISE_GLSL}
${LIGHT_GLSL}
${BRUSH_GLSL}
${PENCIL_GLSL}
void main() {
  if (vDepth < -0.05) discard;
  vec3 P = vWorldPos;
  vec3 toCam = cameraPosition - P;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec3 up = cylUp(P);
  vec2 suv = cylUV(P);
  float pix = max(dist, 0.3) * uPixelAngle;
  float d = max(vDepth, 0.0);
  float tipo = uAcqua.x;
  // --- colore a fasce con la profondità: riva sabbia e giada pallida, giada, turchese profondo
  vec3 sabbia = vec3(0.66, 0.68, 0.52);
  vec3 pallida = vec3(0.38, 0.62, 0.5);
  vec3 giada = vec3(0.15, 0.47, 0.39);
  vec3 profonda = vec3(0.08, 0.38, 0.4);
  float fondo = uAcqua.z;
  float b0 = smoothstep(0.05, 0.5, d / fondo * 6.0);
  float b1 = smoothstep(0.12, 0.3, d / fondo);
  float b2 = smoothstep(0.55, 0.85, d / fondo);
  vec3 albedo = mix(mix(mix(sabbia, pallida, b0), giada, b1), profonda, b2);
  // da lontano (l'altra metà del cilindro) il lago è una gemma di giada: il fondo si schiarisce
  albedo = mix(albedo, vec3(0.2, 0.6, 0.5), smoothstep(450.0, 1100.0, dist) * 0.55 * b1);
  // grandi macchie (fondali, correnti) e il viraggio caldo/freddo del dipinto
  float m1 = vnoise2(suv * 0.012 + 3.0);
  albedo *= 0.94 + 0.12 * m1;
  albedo = mix(albedo, albedo * vec3(0.92, 1.02, 1.06), smoothstep(0.5, 0.8, vnoise2(suv * 0.03)) * 0.4);
  // --- increspature: pennellate allungate che scorrono (nel riale lungo la corrente)
  vec2 wuv;
  if (tipo > 0.5 && tipo < 1.5) {
    // riale: lungo la corrente, veloce; più mosso al centro
    float s = vFlusso.x - uTime * uAcqua.y;
    wuv = vec2(s * 0.6, vFlusso.y * 3.5);
  } else {
    wuv = suv * vec2(0.6, 0.18) + vec2(uTime * 0.25, uTime * 0.07);
  }
  float w1 = vnoise2(wuv * vec2(0.5, 2.6));
  float w2 = vnoise2(wuv * vec2(0.18, 0.9) + 9.0);
  float onde = w1 * 0.6 + w2 * 0.5;
  float vicino = 1.0 - smoothstep(40.0, 420.0, dist);
  float strisce = smoothstep(0.7, 0.84, onde) * vicino;
  float tone;
  // la luce: l'acqua prende la luce come una campitura piatta (niente bande)
  Sup sp = supBase(albedo, up);
  sp.bande = 0.2;
  vec3 col = shadeSup(sp, up, P, V, tone);
  // --- riflesso del cielo con l'angolo (velato: il cielo del cilindro è terra e foschia)
  float fres = pow(1.0 - max(dot(V, up), 0.0), 3.0);
  vec3 cielo = mix(uHazeColor, uHazeZenith, 0.35);
  cielo = mix(cielo, vec3(lumaP(cielo)), 0.45);
  col = mix(col, cielo, fres * 0.4 * (0.85 + 0.3 * w2));
  // pennellate chiare delle increspature (il cielo che si specchia sulle onde)
  col = mix(col, cielo * 1.05 + 0.04, strisce * (0.18 + 0.25 * fres));
  // luccichii verso la luce (piccoli, a tocchi)
  vec3 Ld = lineaLightDir(P, up);
  vec3 Hh = normalize(Ld + V);
  float gl = pow(max(dot(normalize(up + vec3(w1 - 0.5, 0.0, w2 - 0.5) * 0.3), Hh), 0.0), 220.0);
  col += uSunColor * uSunIntensity * smoothstep(0.35, 0.8, gl) * 0.6 * vicino * (1.0 - uNight);
  // --- riva: una riga di schiuma tremolante e l'acqua bassa più chiara
  float riva = 1.0 - smoothstep(0.0, 0.18, d);
  float tremo = vnoise2(suv * 0.9 + uTime * 0.35);
  col = mix(col, vec3(0.93, 0.94, 0.9) * (0.65 + 0.4 * uSunIntensity), riva * smoothstep(0.35, 0.65, tremo) * 0.7);
  // riale: schiuma sui sassi del fondo, a riccioli che corrono
  if (tipo > 0.5 && tipo < 1.5) {
    float sassi = vnoise2(vec2(vFlusso.x * 0.35, vFlusso.y * 2.0) + 21.0);
    float sch = smoothstep(0.68, 0.82, sassi + (w1 - 0.5) * 0.4) * (1.0 - b1 * 0.4);
    col = mix(col, vec3(0.95, 0.96, 0.93) * (0.6 + 0.45 * uSunIntensity), sch * 0.55 * vicino);
  }
  // --- matita/colore come il resto del mondo
  float th = cylThetaDeg(P);
  PaintInfo pi = paintState(P, th, dist);
  if (pi.paint < 0.999) {
    vec3 pc = schizzo(col, suv, up, V, P, 0.8, 0.0, dist, pi.blank, 0.0, pi.wet);
    pc = mix(pc, mix(col, vec3(0.962, 0.935, 0.862), 0.3), pi.bleed * 0.55);
    col = mix(pc, col, pi.paint);
  }
  col *= 1.0 - pi.wet * 0.2 * pi.paint;
  col = mix(col, vec3(0.17, 0.14, 0.22), clamp(pi.ink, 0.0, 1.0) * 0.8);
  // (l'acqua si legge attraverso l'aria più del terreno: il lago dall'altra parte del cilindro
  // resta giada, come nel bozzetto 3, invece di sparire nel velo azzurro)
  col = applyHazeK(col, P, dist, mix(0.62, 0.72, pi.paint) * (1.0 - 0.15 * smoothstep(500.0, 1100.0, dist)));
  gl_FragColor = vec4(col, 1.0);
}
`;

function materialeAcqua(u: WorldUniforms, nome: string, tipo: number, velocita: number, fondo: number): ShaderMaterial {
  return new ShaderMaterial({
    name: nome,
    uniforms: { ...u, uAcqua: { value: new Vector4(tipo, velocita, fondo, 0) } },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
}

/** Il lago del Verbanetto. */
export function createLake(world: WorldUniforms): Mesh {
  const z0 = LAKE.zStart - 60;
  const z1 = LAKE.zEnd + 60;
  const th0 = LAKE.thetaCenter - LAKE.halfWidth - 7;
  const th1 = LAKE.thetaCenter + LAKE.halfWidth + 7;
  const nZ = Math.ceil((z1 - z0) / 8);
  const nT = Math.ceil(((th1 - th0) * R * DEG) / 8);
  const r = R - WATER_HEIGHT;
  const pos = new Float32Array((nZ + 1) * (nT + 1) * 3);
  const depth = new Float32Array((nZ + 1) * (nT + 1));
  for (let i = 0; i <= nZ; i++) {
    const z = z0 + ((z1 - z0) * i) / nZ;
    for (let j = 0; j <= nT; j++) {
      const th = th0 + ((th1 - th0) * j) / nT;
      const t = th * DEG;
      const v = i * (nT + 1) + j;
      pos[v * 3] = -r * Math.sin(t);
      pos[v * 3 + 1] = -r * Math.cos(t);
      pos[v * 3 + 2] = z;
      depth[v] = WATER_HEIGHT - surfaceHeight(z, th);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < nZ; i++) {
    for (let j = 0; j < nT; j++) {
      const a = i * (nT + 1) + j;
      const b = (i + 1) * (nT + 1) + j;
      // salta i quadrati tutti all'asciutto
      if (depth[a]! < -1 && depth[a + 1]! < -1 && depth[b]! < -1 && depth[b + 1]! < -1) continue;
      idx.push(a, b + 1, b, a, a + 1, b + 1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aDepth', new BufferAttribute(depth, 1));
  geo.setAttribute('aFlusso', new BufferAttribute(new Float32Array(depth.length * 2), 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mesh = new Mesh(geo, materialeAcqua(world, 'lago', 0, 0, LAKE.depth));
  mesh.name = 'lago';
  return mesh;
}

/**
 * Il riale di Corbella: un nastro d'acqua lungo il letto del torrente (quota del fondo + 0.6 m),
 * largo quanto il letto; dove il terreno sale sopra l'acqua il frammento si scarta. La corrente
 * corre verso Lag (+z).
 */
export function createRiale(world: WorldUniforms): Mesh {
  const passo = 4;
  const larga = 10;
  const nT = 10;
  const masks = createMasks();
  const pos: number[] = [];
  const depth: number[] = [];
  const flusso: number[] = [];
  const idx: number[] = [];
  let righe = 0;
  const p = new Vector3();
  const zMin = LAYOUT.endCaps.south.baseZ - 40;
  const zMax = Math.min(L, LAYOUT.endCaps.north.baseZ + 40);
  for (let z = zMin; z <= zMax; z += passo) {
    const thc = rialeTheta(z);
    // quota dell'acqua: il fondo al centro del letto + 0.6 m (minimo del fondo lì attorno)
    let fondo = Infinity;
    for (const dt of [-0.6, 0, 0.6]) fondo = Math.min(fondo, surfaceHeight(z, thc + dt / METERS_PER_DEG, masks));
    const hAcqua = fondo + 0.6;
    for (let j = 0; j <= nT; j++) {
      const u = j / nT - 0.5;
      const th = thc + (u * larga) / METERS_PER_DEG;
      cylToWorld(z, th, hAcqua, p);
      pos.push(p.x, p.y, p.z);
      depth.push(hAcqua - surfaceHeight(z, th, masks));
      flusso.push(z, u * 2);
    }
    righe++;
  }
  for (let i = 0; i < righe - 1; i++) {
    for (let j = 0; j < nT; j++) {
      const a = i * (nT + 1) + j;
      const b = (i + 1) * (nT + 1) + j;
      if (depth[a]! < -0.5 && depth[a + 1]! < -0.5 && depth[b]! < -0.5 && depth[b + 1]! < -0.5) continue;
      // facce verso l'asse
      idx.push(a, b + 1, b, a, a + 1, b + 1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('aDepth', new BufferAttribute(new Float32Array(depth), 1));
  geo.setAttribute('aFlusso', new BufferAttribute(new Float32Array(flusso), 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mesh = new Mesh(geo, materialeAcqua(world, 'lago-riale', 1, 1.1, 1.4));
  mesh.name = 'lago-riale';
  return mesh;
}

/**
 * L'acqua della vasca del lavatoio: un rettangolo `largo` × `profondo` (m) centrato in `centro`
 * (mondo, alla quota del pelo dell'acqua), con il lato lungo perpendicolare ad `avanti`.
 * L'integrazione lo posa dai punti del paese (vedi `aggiungiAcquaLavatoio`).
 */
export function creaAcquaLavatoio(world: WorldUniforms, centro: Vector3, avanti: Vector3, largo = 5.1, profondo = 1.75): Mesh {
  const su = upAt((Math.atan2(-centro.x, -centro.y) * 180) / Math.PI);
  const f = avanti.clone().addScaledVector(su, -avanti.dot(su)).normalize();
  const dx = new Vector3().crossVectors(f, su).normalize();
  const n = 6;
  const pos: number[] = [];
  const depth: number[] = [];
  const flusso: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const u = i / n - 0.5;
      const v = j / n - 0.5;
      const q = centro.clone().addScaledVector(dx, u * largo).addScaledVector(f, v * profondo);
      pos.push(q.x, q.y, q.z);
      // più fonda al centro, bassa sul bordo (la schiuma corre lungo la pietra)
      depth.push(0.05 + 0.5 * (1 - Math.max(Math.abs(u) * 2, Math.abs(v) * 2) ** 4));
      flusso.push(u * largo, v * 2);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j;
      const b = (i + 1) * (n + 1) + j;
      idx.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('aDepth', new BufferAttribute(new Float32Array(depth), 1));
  geo.setAttribute('aFlusso', new BufferAttribute(new Float32Array(flusso), 2));
  geo.setIndex(idx);
  // le facce devono guardare verso l'asse: se no si girano
  const a0 = new Vector3(pos[0], pos[1], pos[2]);
  const a1 = new Vector3(pos[(n + 1) * 3], pos[(n + 1) * 3 + 1], pos[(n + 1) * 3 + 2]);
  const a2 = new Vector3(pos[(n + 2) * 3], pos[(n + 2) * 3 + 1], pos[(n + 2) * 3 + 2]);
  const nn = a1.sub(a0).cross(a2.sub(a0));
  if (nn.dot(su) < 0) {
    const ix = geo.getIndex()!;
    for (let k = 0; k < ix.count; k += 3) {
      const t = ix.getX(k + 1);
      ix.setX(k + 1, ix.getX(k + 2));
      ix.setX(k + 2, t);
    }
  }
  geo.computeBoundingSphere();
  // (vasca: corrente lenta, un tremolio sotto la cannella)
  const mesh = new Mesh(geo, materialeAcqua(world, 'lago-lavatoio', 1, 0.25, 0.5));
  mesh.name = 'lago-lavatoio';
  return mesh;
}

/**
 * Aggancio dell'acqua del lavatoio (una riga nell'integrazione, dopo il popolamento): la vasca sta
 * 1.5 m dietro il punto «esamina:lavatoio» (sul bordo davanti della vasca), con il davanti verso il
 * chiodo 5 sul gradino. Restituisce la mesh (già nella scena) o null se i punti mancano.
 */
export function aggiungiAcquaLavatoio(game: { uniforms: WorldUniforms; scene: { add(o: Mesh): unknown } }, puntoVasca: Vector3 | undefined, chiodo: Vector3 | null | undefined): Mesh | null {
  if (!puntoVasca || !chiodo) return null;
  const avanti = chiodo.clone().sub(puntoVasca);
  const su = upAt((Math.atan2(-puntoVasca.x, -puntoVasca.y) * 180) / Math.PI);
  avanti.addScaledVector(su, -avanti.dot(su)).normalize();
  // il pelo dell'acqua: 4 cm sotto il punto (bordo della vasca a 0.9 m, acqua a 0.86 m)
  const centro = puntoVasca.clone().addScaledVector(avanti, -1.5).addScaledVector(su, -0.035);
  const m = creaAcquaLavatoio(game.uniforms, centro, avanti);
  game.scene.add(m);
  return m;
}
