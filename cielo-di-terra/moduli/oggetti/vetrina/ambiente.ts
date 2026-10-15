/**
 * Ambiente della vetrina: cielo dipinto, prato con chiazze, colline a quinte, luci di giorno e di notte.
 * Serve solo per guardare gli oggetti; il motore del gioco ha il suo ambiente.
 */
import * as THREE from 'three';
import { materiali } from '../src/materiali';
import { hashPosizione } from '../src/rng';

export interface Ambiente {
  sole: THREE.DirectionalLight;
  emisfero: THREE.HemisphereLight;
  cielo: THREE.Mesh;
  prato: THREE.Mesh;
  impostaNotte: (notte: boolean) => void;
}

function rumore2(x: number, z: number, seme: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hashPosizione(xi, 0, zi, seme);
  const b = hashPosizione(xi + 1, 0, zi, seme);
  const c = hashPosizione(xi, 0, zi + 1, seme);
  const d = hashPosizione(xi + 1, 0, zi + 1, seme);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, s(fx)), THREE.MathUtils.lerp(c, d, s(fx)), s(fz));
}

/** Quota del terreno della vetrina (piatto al centro, colline lontane). */
export function quotaTerreno(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const fuori = Math.max(0, r - 75);
  return fuori * fuori * 0.0011 + (rumore2(x * 0.03, z * 0.03, 7) - 0.5) * Math.min(1, fuori / 20) * 10;
}

export function creaAmbiente(scena: THREE.Scene): Ambiente {
  // cielo: cupola con gradiente
  const gCielo = new THREE.SphereGeometry(600, 32, 16);
  const colCielo = new Float32Array(gCielo.getAttribute('position').count * 3);
  gCielo.setAttribute('color', new THREE.BufferAttribute(colCielo, 3));
  const matCielo = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const cielo = new THREE.Mesh(gCielo, matCielo);
  cielo.renderOrder = -10;
  scena.add(cielo);

  const coloraCielo = (zenit: number, orizzonte: number, basso: number) => {
    const pos = gCielo.getAttribute('position') as THREE.BufferAttribute;
    const cz = new THREE.Color(zenit);
    const co = new THREE.Color(orizzonte);
    const cb = new THREE.Color(basso);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 600;
      if (y >= 0) c.copy(co).lerp(cz, Math.pow(y, 0.6));
      else c.copy(co).lerp(cb, Math.min(1, -y * 4));
      colCielo[i * 3] = c.r;
      colCielo[i * 3 + 1] = c.g;
      colCielo[i * 3 + 2] = c.b;
    }
    gCielo.getAttribute('color').needsUpdate = true;
  };

  // prato
  const gPrato = new THREE.CircleGeometry(420, 160, 0, Math.PI * 2);
  gPrato.rotateX(-Math.PI / 2);
  // suddivisione radiale più fitta: ricostruisco come griglia polare
  const anelli = 70;
  const settori = 120;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const cPrato = new THREE.Color(0x86984f);
  const cChiaro = new THREE.Color(0xa4ad68);
  const cStoppie = new THREE.Color(0xc2a262);
  const cScuro = new THREE.Color(0x65743f);
  const tmp = new THREE.Color();
  for (let a = 0; a <= anelli; a++) {
    const rr = Math.pow(a / anelli, 1.7) * 420;
    for (let s = 0; s < settori; s++) {
      const ang = (s / settori) * Math.PI * 2;
      const x = Math.cos(ang) * rr;
      const z = Math.sin(ang) * rr;
      const y = quotaTerreno(x, z);
      pos.push(x, y, z);
      const n1 = rumore2(x * 0.06, z * 0.06, 3);
      const n2 = rumore2(x * 0.2, z * 0.2, 5);
      tmp.copy(cPrato).lerp(cChiaro, THREE.MathUtils.smoothstep(n1, 0.45, 0.75));
      tmp.lerp(cStoppie, THREE.MathUtils.smoothstep(rumore2(x * 0.025 + 9, z * 0.025, 11), 0.62, 0.8) * 0.8);
      tmp.lerp(cScuro, THREE.MathUtils.smoothstep(n2, 0.6, 0.9) * 0.5);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let a = 0; a < anelli; a++) {
    for (let s = 0; s < settori; s++) {
      const i0 = a * settori + s;
      const i1 = a * settori + ((s + 1) % settori);
      const i2 = (a + 1) * settori + s;
      const i3 = (a + 1) * settori + ((s + 1) % settori);
      idx.push(i0, i1, i2, i1, i3, i2);
    }
  }
  gPrato.dispose();
  const gTerra = new THREE.BufferGeometry();
  gTerra.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gTerra.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  gTerra.setIndex(idx);
  gTerra.computeVertexNormals();
  const prato = new THREE.Mesh(gTerra, materiali().opaco);
  prato.receiveShadow = true;
  prato.name = 'prato';
  scena.add(prato);

  // luci
  const sole = new THREE.DirectionalLight(0xffe0b0, 2.6);
  sole.position.set(-40, 60, 28);
  sole.castShadow = true;
  sole.shadow.mapSize.set(2048, 2048);
  sole.shadow.camera.left = -60;
  sole.shadow.camera.right = 60;
  sole.shadow.camera.top = 60;
  sole.shadow.camera.bottom = -60;
  sole.shadow.camera.near = 1;
  sole.shadow.camera.far = 200;
  sole.shadow.bias = -0.0004;
  sole.shadow.normalBias = 0.03;
  sole.shadow.radius = 2.5;
  scena.add(sole);
  scena.add(sole.target);
  const emisfero = new THREE.HemisphereLight(0xbfd6ea, 0x8a7a50, 1.15);
  scena.add(emisfero);

  const impostaNotte = (notte: boolean) => {
    if (notte) {
      coloraCielo(0x141a3c, 0x3b3f73, 0x23264a);
      scena.fog = new THREE.Fog(0x2b2f5c, 40, 300);
      sole.color.set(0x8f9be0);
      sole.intensity = 0.55;
      emisfero.color.set(0x5560a8);
      emisfero.groundColor.set(0x2a2440);
      emisfero.intensity = 0.9;
    } else {
      coloraCielo(0x6f9cc6, 0xf1e2c2, 0xd8c9a6);
      scena.fog = new THREE.Fog(0xd9dfdc, 90, 520);
      sole.color.set(0xffe0b0);
      sole.intensity = 2.6;
      emisfero.color.set(0xbfd6ea);
      emisfero.groundColor.set(0x8a7a50);
      emisfero.intensity = 1.15;
    }
  };
  impostaNotte(false);
  return { sole, emisfero, cielo, prato, impostaNotte };
}
