/**
 * Le Fade: piccole macchine di manutenzione notturna (rame, ottone e smalto verde, forme da attrezzo
 * agricolo) con un lume caldo, un cappello-rotore e una pinza a tre griffe che solleva le pietre.
 * - creaFada: una Fada singola dettagliata (primi piani), con macchina a stati procedurale:
 *   'libra' (sospesa), 'cerchio' (danza attorno a un centro), 'trasporta' (prende una pietra in `da`
 *   e la posa in `a`, avanti e indietro).
 * - creaSciameFade: N Fade istanziate (5 draw call in tutto) che danzano in cerchio, alcune con la pietra.
 * - creaSciameApi: le api di rame, minuscole, a sciame istanziato con scintille.
 *
 * Coordinate: il `gruppo` restituito è un contenitore; la macchina e la pietra si muovono al suo interno,
 * quindi `da`, `a`, `centro` sono in coordinate del gruppo.
 */
import * as THREE from 'three';
import { Costruttore, mat, matSegmento, mescola } from '../costruttore';
import { creaAlone, creaLuceLume, risultato, smorza } from '../comune';
import { geoBoxC, geoCilindro, geoCono, geoLastra, geoMasso, geoSfera, geoToro } from '../forme';
import { leggiIntensitaLumi, materiali, materialePer } from '../materiali';
import { PALETTE } from '../palette';
import { Rng, semeNumerico, type Seme } from '../rng';
import type { OggettoProcedurale } from '../tipi';

/** Geometrie della Fada divise per parte (condivise fra singola e sciame). */
interface PartiFada {
  corpo: Costruttore; // cappello, telaio, base (opaco) + vetro e lume (lume)
  rotore: Costruttore;
  griffa: Costruttore; // una griffa (pivot in alto)
  quotaLume: number;
  quotaGriffe: number;
}

function costruisciParti(rng: Rng, scala = 1): PartiFada {
  const s = scala;
  const corpo = new Costruttore(rng.derivato('corpo'));
  // cappello: tesa conica di smalto verde con bordo d'ottone
  const cappello = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.001, 0.62 * s),
      new THREE.Vector2(0.08 * s, 0.6 * s),
      new THREE.Vector2(0.22 * s, 0.53 * s),
      new THREE.Vector2(0.36 * s, 0.45 * s),
      new THREE.Vector2(0.37 * s, 0.43 * s),
      new THREE.Vector2(0.2 * s, 0.47 * s),
      new THREE.Vector2(0.001, 0.5 * s),
    ],
    16,
  );
  cappello.deleteAttribute('uv');
  corpo.aggiungi(cappello, { colore: PALETTE.smaltoVerde, gradiente: { basso: 0.7, alto: 1.15, y0: 0.44 * s, y1: 0.62 * s } });
  corpo.aggiungi(geoToro(0.36 * s, 0.014 * s, 4, 20), { matrice: mat([0, 0.445 * s, 0], [Math.PI / 2, 0, 0]), colore: PALETTE.ottone });
  // pomolo e anello in cima
  corpo.aggiungi(geoSfera(0.03 * s, 6, 4), { matrice: mat([0, 0.63 * s, 0]), colore: PALETTE.ottone });
  corpo.aggiungi(geoToro(0.035 * s, 0.007 * s, 4, 8), { matrice: mat([0, 0.68 * s, 0]), colore: PALETTE.ottoneScuro });
  // mozzo del rotore
  corpo.aggiungi(geoCilindro(0.05 * s, 0.06 * s, 0.06 * s, 8), { matrice: mat([0, 0.4 * s, 0]), colore: PALETTE.rameScuro });
  // telaio della lanterna (quattro montanti d'ottone)
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    corpo.aggiungi(geoBoxC(0.018 * s, 0.24 * s, 0.018 * s), {
      matrice: mat([Math.cos(a) * 0.085 * s, 0.27 * s, Math.sin(a) * 0.085 * s]),
      colore: PALETTE.ottone,
      piatto: true,
    });
  }
  corpo.aggiungi(geoCilindro(0.1 * s, 0.09 * s, 0.03 * s, 10), { matrice: mat([0, 0.38 * s, 0]), colore: PALETTE.rame });
  // vetro luminoso e lume
  corpo.aggiungi(geoCilindro(0.075 * s, 0.075 * s, 0.22 * s, 10), { matrice: mat([0, 0.155 * s, 0]), colore: PALETTE.lumeCaldo, canale: 'lume', gradiente: { basso: 0.85, alto: 1.05, y0: 0.15 * s, y1: 0.37 * s } });
  const fiamma = geoSfera(0.035 * s, 6, 4);
  fiamma.scale(1, 1.5, 1);
  corpo.aggiungi(fiamma, { matrice: mat([0, 0.26 * s, 0]), colore: PALETTE.lumeFiamma, canale: 'lume' });
  // base di rame con il serbatoio e i perni delle griffe
  corpo.aggiungi(geoCilindro(0.11 * s, 0.07 * s, 0.07 * s, 10), { matrice: mat([0, 0.09 * s, 0]), colore: PALETTE.rame, gradiente: { basso: 0.8, alto: 1.1, y0: 0.09 * s, y1: 0.16 * s } });
  corpo.aggiungi(geoCono(0.07 * s, 0.07 * s, 10), { matrice: mat([0, 0.09 * s, 0], [Math.PI, 0, 0]), colore: PALETTE.rameScuro });
  // due piccole antenne-sensori (smalto)
  for (const sx of [-1, 1]) {
    corpo.aggiungi(geoCilindro(0.006 * s, 0.006 * s, 0.12 * s, 3), { matrice: mat([sx * 0.06 * s, 0.6 * s, 0.05 * s], [0.4, 0, sx * 0.4]), colore: PALETTE.ottoneScuro });
    corpo.aggiungi(geoSfera(0.012 * s, 4, 3), { matrice: mat([sx * 0.1 * s, 0.7 * s, 0.09 * s]), colore: PALETTE.smaltoVerdeChiaro });
  }

  // rotore: tre pale sotto il cappello
  const rotore = new Costruttore(rng.derivato('rotore'));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    rotore.aggiungi(geoBoxC(0.3 * s, 0.008 * s, 0.05 * s), {
      matrice: mat([Math.cos(a) * 0.17 * s, 0, -Math.sin(a) * 0.17 * s], [0.25, a, 0]),
      colore: PALETTE.ottoneChiaro,
      piatto: true,
    });
  }

  // griffa: braccio piegato con la punta (pivot in alto, pende verso −Y e verso +X)
  const griffa = new Costruttore(rng.derivato('griffa'));
  const g0 = new THREE.Vector3(0, 0, 0);
  const g1 = new THREE.Vector3(0.06 * s, -0.1 * s, 0);
  const g2 = new THREE.Vector3(0.03 * s, -0.2 * s, 0);
  griffa.aggiungi(geoCilindro(0.011 * s, 0.011 * s, 1, 4), { matrice: matSegmento(g0, g1), colore: PALETTE.rameScuro });
  griffa.aggiungi(geoCilindro(0.01 * s, 0.006 * s, 1, 4), { matrice: matSegmento(g1, g2), colore: PALETTE.ottoneScuro });
  griffa.aggiungi(geoSfera(0.016 * s, 4, 3), { matrice: mat(g1), colore: PALETTE.ottone });
  return { corpo, rotore, griffa, quotaLume: 0.26 * s, quotaGriffe: 0.06 * s };
}

export type ModoFada = 'libra' | 'cerchio' | 'trasporta';

export interface StatoFada {
  modo?: ModoFada;
  /** 'trasporta': punto dove prendere la pietra (coordinate del gruppo, al suolo) */
  da?: THREE.Vector3;
  /** 'trasporta': punto dove posarla */
  a?: THREE.Vector3;
  /** 'cerchio' e 'libra': centro (al suolo) */
  centro?: THREE.Vector3;
  raggio?: number;
  /** quota di volo sopra il suolo */
  quota?: number;
  /** velocità di crociera (m/s) */
  velocita?: number;
}

export interface OpzioniFada {
  seme?: Seme;
  scala?: number;
  /** pietra in dotazione (sollevabile) */
  pietra?: boolean;
  luce?: boolean;
  /** scia luminosa (linea che svanisce): bella da vicino, una draw call in più */
  scia?: boolean;
}

/** Una Fada singola, animata. */
export function creaFada(opz: OpzioniFada = {}): OggettoProcedurale<StatoFada> {
  const seme = semeNumerico(opz.seme ?? 'fada');
  const rng = new Rng(seme);
  const sc = opz.scala ?? 1;
  const parti = costruisciParti(rng, sc);
  const macchina = new THREE.Group();
  macchina.name = 'fada-macchina';
  macchina.add(parti.corpo.costruisci('fada'));
  const rotore = parti.rotore.mesh('fada-rotore');
  if (rotore) {
    rotore.position.y = 0.42 * sc;
    macchina.add(rotore);
  }
  const griffe: THREE.Object3D[] = [];
  const geoGriffa = parti.griffa.geometria('opaco');
  for (let k = 0; k < 3; k++) {
    const perno = new THREE.Group();
    perno.position.y = parti.quotaGriffe;
    perno.rotation.y = (k / 3) * Math.PI * 2;
    const braccio = new THREE.Object3D();
    if (geoGriffa) {
      const m = new THREE.Mesh(geoGriffa, materialePer('opaco'));
      m.castShadow = true;
      m.name = 'fada-griffa:opaco';
      m.userData['canale'] = 'opaco';
      braccio.add(m);
    }
    braccio.position.x = 0.07 * sc;
    perno.add(braccio);
    macchina.add(perno);
    griffe.push(braccio);
  }
  const alone = creaAlone(new THREE.Vector3(0, parti.quotaLume, 0), 1.3 * sc);
  macchina.add(alone);
  let luce: THREE.PointLight | null = null;
  if (opz.luce) {
    luce = creaLuceLume(new THREE.Vector3(0, parti.quotaLume, 0), 2.2, 7);
    macchina.add(luce);
  }

  // pietra
  let pietra: THREE.Mesh | null = null;
  if (opz.pietra ?? true) {
    const bp = new Costruttore(rng.derivato('pietra'));
    bp.aggiungi(geoLastra(0.42 * sc, 0.26 * sc, 0.3 * sc, rng.intero(0, 1e6), 0.15), {
      colore: mescola(PALETTE.gneiss, PALETTE.gneissChiaro, rng.next() * 0.5),
      variazione: 0.06,
      piatto: true,
    });
    pietra = bp.mesh('fada-pietra');
  }

  const gruppo = new THREE.Group();
  gruppo.name = 'fada';
  gruppo.add(macchina);
  if (pietra) gruppo.add(pietra);

  // scia
  let scia: THREE.Line | null = null;
  const NS = 48;
  const sciaPos = new Float32Array(NS * 3);
  const sciaCol = new Float32Array(NS * 3);
  if (opz.scia) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sciaPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(sciaCol, 3));
    const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    m.userData['proprio'] = true;
    scia = new THREE.Line(g, m);
    scia.frustumCulled = false;
    scia.name = 'fada-scia';
    gruppo.add(scia);
  }

  // stato interno
  let t = rng.next() * 10;
  let fase = 0; // per il trasporto
  let tFase = 0;
  let portata = false;
  let chiusura = 0; // 0 griffe aperte, 1 chiuse
  let verso = 1; // alterna da→a e a→da
  const pos = new THREE.Vector3(0, 2, 0);
  const vel = new THREE.Vector3();
  const partenza = new THREE.Vector3();
  let angolo = rng.next() * Math.PI * 2;
  const pietraPos = new THREE.Vector3();
  let pietraInizializzata = false;
  const appeso = 0.3 * sc; // distanza griffe-pietra
  const tmp = new THREE.Vector3();

  const update = (dt: number, stato?: StatoFada) => {
    t += dt;
    const modo = stato?.modo ?? 'libra';
    const quota = stato?.quota ?? 2.2;
    const v = stato?.velocita ?? 2.2;
    const obiettivo = new THREE.Vector3();
    let chiusuraObj = 0;

    if (modo === 'trasporta' && stato?.da && stato?.a) {
      const sorgente = verso > 0 ? stato.da : stato.a;
      const meta = verso > 0 ? stato.a : stato.da;
      if (!pietraInizializzata) {
        pietraPos.copy(stato.da);
        pietraInizializzata = true;
      }
      tFase += dt;
      // fasi: 0 avvicina, 1 scende, 2 afferra, 3 sale, 4 porta, 5 scende, 6 rilascia, 7 sale
      const sopra = (p: THREE.Vector3, h: number) => tmp.set(p.x, p.y + h, p.z).clone();
      const durate = [0, 1.2, 0.6, 1.0, 0, 1.2, 0.6, 1.0];
      const quotaPresa = appeso + 0.13 * sc + parti.quotaGriffe * 0 + 0.2 * sc;
      switch (fase) {
        case 0: {
          obiettivo.copy(sopra(sorgente, quota));
          if (pos.distanceTo(obiettivo) < 0.15) {
            fase = 1;
            tFase = 0;
          }
          break;
        }
        case 1:
        case 5: {
          const p = fase === 1 ? sorgente : meta;
          const k = Math.min(1, tFase / (durate[fase] as number));
          obiettivo.copy(sopra(p, THREE.MathUtils.lerp(quota, quotaPresa, k * k * (3 - 2 * k))));
          if (fase === 5) chiusuraObj = 1;
          if (k >= 1) {
            fase++;
            tFase = 0;
          }
          break;
        }
        case 2: {
          obiettivo.copy(sopra(sorgente, quotaPresa));
          chiusuraObj = 1;
          if (tFase > (durate[2] as number)) {
            portata = true;
            fase = 3;
            tFase = 0;
          }
          break;
        }
        case 3:
        case 7: {
          const p = fase === 3 ? sorgente : meta;
          const k = Math.min(1, tFase / (durate[fase] as number));
          obiettivo.copy(sopra(p, THREE.MathUtils.lerp(quotaPresa, quota, k * k * (3 - 2 * k))));
          chiusuraObj = fase === 3 ? 1 : 0;
          if (k >= 1) {
            fase = fase === 3 ? 4 : 0;
            tFase = 0;
            if (fase === 0) verso = -verso;
            partenza.copy(pos);
          }
          break;
        }
        case 4: {
          // volo ad arco verso la meta
          const d = partenza.distanceTo(sopra(meta, quota));
          const k = Math.min(1, tFase / Math.max(0.5, d / v));
          const e = k * k * (3 - 2 * k);
          obiettivo.copy(partenza).lerp(sopra(meta, quota), e);
          obiettivo.y += Math.sin(Math.PI * e) * Math.min(1.5, d * 0.25);
          chiusuraObj = 1;
          if (k >= 1) {
            fase = 5;
            tFase = 0;
          }
          break;
        }
        case 6: {
          obiettivo.copy(sopra(meta, quotaPresa));
          chiusuraObj = 0;
          if (tFase > 0.25 && portata) {
            portata = false;
            pietraPos.set(meta.x, meta.y, meta.z);
          }
          if (tFase > (durate[6] as number)) {
            fase = 7;
            tFase = 0;
          }
          break;
        }
      }
      // inseguimento morbido dell'obiettivo
      const k = 1 - Math.exp(-6 * dt);
      pos.lerp(obiettivo, fase === 0 ? 1 - Math.exp(-1.6 * dt) : k);
    } else if (modo === 'cerchio') {
      const c = stato?.centro ?? new THREE.Vector3();
      const r = stato?.raggio ?? 3;
      angolo += (v / Math.max(0.5, r)) * dt;
      obiettivo.set(c.x + Math.cos(angolo) * r, c.y + quota + Math.sin(angolo * 2.3 + seme) * 0.35, c.z + Math.sin(angolo) * r);
      pos.lerp(obiettivo, 1 - Math.exp(-4 * dt));
      chiusuraObj = portata ? 1 : 0;
    } else {
      const c = stato?.centro ?? pos;
      obiettivo.set(c.x, (stato?.centro ? c.y + quota : pos.y), c.z);
      pos.lerp(obiettivo, 1 - Math.exp(-2 * dt));
    }

    // posa della macchina: oscillazione, inclinazione nel verso del moto
    const prima = macchina.position.clone();
    macchina.position.copy(pos);
    macchina.position.y += Math.sin(t * 2.1) * 0.05 + Math.sin(t * 5.3) * 0.01;
    if (dt > 0) vel.copy(macchina.position).sub(prima).divideScalar(dt);
    const vOrizz = Math.hypot(vel.x, vel.z);
    const inclina = THREE.MathUtils.clamp(vOrizz * 0.08, 0, 0.35);
    if (vOrizz > 0.05) macchina.rotation.y = smorza(macchina.rotation.y, Math.atan2(vel.x, vel.z), 3, dt);
    macchina.rotation.x = smorza(macchina.rotation.x, inclina, 4, dt);
    macchina.rotation.z = Math.sin(t * 1.7) * 0.04;
    if (rotore) rotore.rotation.y += dt * 22;
    chiusura = smorza(chiusura, chiusuraObj, 7, dt);
    for (const g of griffe) g.rotation.z = THREE.MathUtils.lerp(-0.35, 0.45, chiusura);

    // pietra: appesa alle griffe o ferma a terra
    if (pietra) {
      if (portata) {
        tmp.set(0, parti.quotaGriffe - appeso, 0);
        macchina.localToWorld(tmp);
        gruppo.worldToLocal(tmp);
        pietra.position.copy(tmp);
        pietra.rotation.y = macchina.rotation.y;
      } else if (pietraInizializzata) {
        pietra.position.copy(pietraPos);
      } else {
        pietra.visible = false;
      }
      if (pietraInizializzata) pietra.visible = true;
    }

    // lume che respira
    const k = leggiIntensitaLumi();
    const tremolio = 1 + Math.sin(t * 11) * 0.05 + Math.sin(t * 17.3) * 0.03;
    alone.scale.setScalar(1.3 * sc * tremolio * (0.6 + 0.4 * Math.min(1, k)));
    if (luce) luce.intensity = 2.2 * k * tremolio;

    // scia
    if (scia) {
      sciaPos.copyWithin(3, 0, (NS - 1) * 3);
      tmp.set(0, parti.quotaLume, 0);
      macchina.localToWorld(tmp);
      gruppo.worldToLocal(tmp);
      sciaPos[0] = tmp.x;
      sciaPos[1] = tmp.y;
      sciaPos[2] = tmp.z;
      const c = new THREE.Color(PALETTE.lumeCaldo);
      for (let i = 0; i < NS; i++) {
        const f = Math.pow(1 - i / NS, 2) * 0.6 * Math.min(1, k);
        sciaCol[i * 3] = c.r * f;
        sciaCol[i * 3 + 1] = c.g * f;
        sciaCol[i * 3 + 2] = c.b * f;
      }
      scia.geometry.getAttribute('position').needsUpdate = true;
      scia.geometry.getAttribute('color').needsUpdate = true;
    }
  };

  // inizializza la scia sulla posizione iniziale
  for (let i = 0; i < NS; i++) {
    sciaPos[i * 3] = pos.x;
    sciaPos[i * 3 + 1] = pos.y + parti.quotaLume;
    sciaPos[i * 3 + 2] = pos.z;
  }
  update(0);
  return risultato<StatoFada>({
    nome: 'fada',
    seme,
    gruppo,
    collider: [],
    ingombro: { raggio: 0.4 * sc, altezza: 0.7 * sc, interrata: 0 },
    punti: { lume: new THREE.Vector3(0, parti.quotaLume, 0) },
    update,
  });
}

export interface OpzioniSciameFade {
  seme?: Seme;
  numero?: number;
  /** centro della danza (coordinate del gruppo) */
  centro?: THREE.Vector3;
  raggio?: number;
  quota?: number;
  /** frazione di Fade che portano una pietra */
  conPietra?: number;
  scala?: number;
}

/**
 * Sciame di Fade istanziato: corpo, rotori, vetri, pietre e aloni in 5 draw call per tutto lo sciame.
 * update(dt) le fa danzare in cerchi irregolari (raggi, quote e velocità diverse).
 */
export function creaSciameFade(opz: OpzioniSciameFade = {}): OggettoProcedurale<{ centro?: THREE.Vector3 }> {
  const seme = semeNumerico(opz.seme ?? 'sciame-fade');
  const rng = new Rng(seme);
  const n = opz.numero ?? 24;
  const sc = opz.scala ?? 1;
  const parti = costruisciParti(rng, sc);
  // corpo con le griffe chiuse unite
  const geoGriffa = parti.griffa.geometria('opaco');
  if (geoGriffa) {
    for (let k = 0; k < 3; k++) {
      const m = mat([0, parti.quotaGriffe, 0], [0, (k / 3) * Math.PI * 2, 0]).multiply(mat([0.07 * sc, 0, 0], [0, 0, 0.35]));
      parti.corpo.aggiungi(geoGriffa, { matrice: m, colore: 'geometria' });
    }
  }
  const gOpaco = parti.corpo.geometria('opaco') as THREE.BufferGeometry;
  const gLume = parti.corpo.geometria('lume') as THREE.BufferGeometry;
  const gRotore = parti.rotore.geometria('opaco') as THREE.BufferGeometry;
  const bp = new Costruttore(rng.derivato('pietre'));
  bp.aggiungi(geoLastra(0.42 * sc, 0.26 * sc, 0.3 * sc, 7, 0.15), { colore: PALETTE.gneiss, variazione: 0.05, piatto: true });
  const gPietra = bp.geometria('opaco') as THREE.BufferGeometry;
  const nPietre = Math.round(n * (opz.conPietra ?? 0.4));

  const mCorpo = new THREE.InstancedMesh(gOpaco, materialePer('opaco'), n);
  const mLume = new THREE.InstancedMesh(gLume, materialePer('lume'), n);
  const mRotore = new THREE.InstancedMesh(gRotore, materialePer('opaco'), n);
  const mPietre = new THREE.InstancedMesh(gPietra, materialePer('opaco'), Math.max(1, nPietre));
  mPietre.count = nPietre;
  for (const [m, nome, canale] of [
    [mCorpo, 'sciame-fade-corpo', 'opaco'],
    [mLume, 'sciame-fade-lume', 'lume'],
    [mRotore, 'sciame-fade-rotori', 'opaco'],
    [mPietre, 'sciame-fade-pietre', 'opaco'],
  ] as const) {
    m.name = `${nome}:${canale}`;
    m.userData['canale'] = canale;
    m.castShadow = canale !== 'lume';
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  // aloni: punti additivi con la texture dell'alone condivisa
  const gAloni = new THREE.BufferGeometry();
  const posAloni = new Float32Array(n * 3);
  gAloni.setAttribute('position', new THREE.BufferAttribute(posAloni, 3));
  const matAloni = new THREE.PointsMaterial({
    map: materiali().alone.map,
    color: 0xffb760,
    size: 1.4 * sc,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  matAloni.userData['proprio'] = true;
  const aloni = new THREE.Points(gAloni, matAloni);
  aloni.name = 'sciame-fade-aloni';
  aloni.frustumCulled = false;

  const gruppo = new THREE.Group();
  gruppo.name = 'sciame-fade';
  gruppo.add(mCorpo, mLume, mRotore, mPietre, aloni);

  const individui = Array.from({ length: n }, (_, i) => ({
    r: (opz.raggio ?? 6) * rng.tra(0.35, 1.0),
    q: (opz.quota ?? 2) * rng.tra(0.6, 1.5),
    w: rng.tra(0.25, 0.55) * rng.segno(),
    a: rng.next() * Math.PI * 2,
    ph: rng.next() * 10,
    ex: rng.tra(0.7, 1.3),
    pietra: i < nPietre,
  }));
  let t = 0;
  let centro = (opz.centro ?? new THREE.Vector3()).clone();
  const M = new THREE.Matrix4();
  const Mr = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const uno = new THREE.Vector3(1, 1, 1);
  const update = (dt: number, stato?: { centro?: THREE.Vector3 }) => {
    t += dt;
    if (stato?.centro) centro = stato.centro.clone();
    let ip = 0;
    for (let i = 0; i < n; i++) {
      const f = individui[i] as (typeof individui)[number];
      const a = f.a + t * f.w;
      p.set(centro.x + Math.cos(a) * f.r * f.ex, centro.y + f.q + Math.sin(t * 1.3 + f.ph) * 0.25, centro.z + Math.sin(a) * f.r);
      const dir = Math.atan2(-Math.sin(a) * f.w, Math.cos(a) * f.w);
      e.set(0.2, dir, Math.sin(t * 1.7 + f.ph) * 0.05, 'YXZ');
      q.setFromEuler(e);
      M.compose(p, q, uno);
      mCorpo.setMatrixAt(i, M);
      mLume.setMatrixAt(i, M);
      Mr.makeRotationY(t * 20 + f.ph).setPosition(0, 0.42 * sc, 0);
      mRotore.setMatrixAt(i, M.clone().multiply(Mr));
      posAloni[i * 3] = p.x;
      posAloni[i * 3 + 1] = p.y + parti.quotaLume;
      posAloni[i * 3 + 2] = p.z;
      if (f.pietra) {
        const mp = M.clone().multiply(new THREE.Matrix4().makeTranslation(0, parti.quotaGriffe - 0.3 * sc, 0));
        mPietre.setMatrixAt(ip++, mp);
      }
    }
    mCorpo.instanceMatrix.needsUpdate = true;
    mLume.instanceMatrix.needsUpdate = true;
    mRotore.instanceMatrix.needsUpdate = true;
    mPietre.instanceMatrix.needsUpdate = true;
    gAloni.getAttribute('position').needsUpdate = true;
    const k = leggiIntensitaLumi();
    matAloni.opacity = Math.min(1, k);
    matAloni.visible = k > 0.02;
  };
  update(0);
  return risultato<{ centro?: THREE.Vector3 }>({
    nome: 'sciame-fade',
    seme,
    gruppo,
    collider: [],
    ingombro: { raggio: (opz.raggio ?? 6) * 1.3, altezza: (opz.quota ?? 2) * 1.6, interrata: 0 },
    update,
  });
}

export interface OpzioniSciameApi {
  seme?: Seme;
  numero?: number;
  /** raggio della nuvola (m) */
  raggio?: number;
  /** dimensione di un'ape (lunghezza del corpo, m) */
  dimensione?: number;
  centro?: THREE.Vector3;
}

export interface StatoApi {
  /** punto attorno a cui lo sciame si raccoglie (coordinate del gruppo): una fonte di calore, un'arnia */
  centro?: THREE.Vector3;
  /** 0 calmo … 1 agitato (impazzite) */
  agitazione?: number;
}

/** Le api di rame: sciame istanziato (corpi, ali, scintille: 3 draw call). */
export function creaSciameApi(opz: OpzioniSciameApi = {}): OggettoProcedurale<StatoApi> {
  const seme = semeNumerico(opz.seme ?? 'api');
  const rng = new Rng(seme);
  const n = opz.numero ?? 160;
  const R = opz.raggio ?? 1.6;
  const d = opz.dimensione ?? 0.035;
  // corpo: addome a righe rame/ottone, torace e testa
  const bc = new Costruttore(rng.derivato('ape'));
  const addome = geoMasso(d * 0.32, 3, 0.05, 0, 1);
  addome.scale(1, 1, 1.6);
  bc.aggiungi(addome, {
    matrice: mat([0, 0, -d * 0.28]),
    colore: (pp, _n, out) => out.set(Math.sin((pp.z / d) * 28) > 0 ? PALETTE.rame : PALETTE.ottoneScuro),
    piatto: true,
  });
  bc.aggiungi(geoMasso(d * 0.22, 5, 0.05, 0, 1), { matrice: mat([0, 0, d * 0.12]), colore: PALETTE.rameScuro, piatto: true });
  bc.aggiungi(geoMasso(d * 0.15, 9, 0.05, 0, 1), { matrice: mat([0, 0, d * 0.36]), colore: PALETTE.ottone, piatto: true });
  const gCorpo = bc.geometria('opaco') as THREE.BufferGeometry;
  const ba = new Costruttore(rng.derivato('ali'));
  for (const s of [-1, 1]) {
    const ala = new THREE.CircleGeometry(d * 0.42, 6);
    ala.rotateX(-Math.PI / 2);
    ala.scale(0.55, 1, 1);
    ba.aggiungi(ala, { matrice: mat([s * d * 0.32, d * 0.12, d * 0.05], [0, s * 0.5, s * 0.15]), colore: PALETTE.ottoneChiaro, canale: 'sottile' });
  }
  const gAli = ba.geometria('sottile') as THREE.BufferGeometry;
  const mCorpi = new THREE.InstancedMesh(gCorpo, materialePer('opaco'), n);
  const mAli = new THREE.InstancedMesh(gAli, materialePer('sottile'), n);
  mCorpi.name = 'sciame-api-corpi:opaco';
  mCorpi.userData['canale'] = 'opaco';
  mAli.name = 'sciame-api-ali:sottile';
  mAli.userData['canale'] = 'sottile';
  for (const m of [mCorpi, mAli]) {
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  // scintille di rame: punti additivi che brillano a intermittenza (si vedono da lontano)
  const gS = new THREE.BufferGeometry();
  const posS = new Float32Array(n * 3);
  const colS = new Float32Array(n * 3);
  gS.setAttribute('position', new THREE.BufferAttribute(posS, 3));
  gS.setAttribute('color', new THREE.BufferAttribute(colS, 3));
  const matS = new THREE.PointsMaterial({
    map: materiali().alone.map,
    vertexColors: true,
    size: d * 2.6,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  matS.userData['proprio'] = true;
  const scintille = new THREE.Points(gS, matS);
  scintille.name = 'sciame-api-scintille';
  scintille.frustumCulled = false;
  const gruppo = new THREE.Group();
  gruppo.name = 'sciame-api';
  gruppo.add(mCorpi, mAli, scintille);

  const api = Array.from({ length: n }, () => ({
    o: new THREE.Vector3(rng.centrato(1), rng.centrato(0.6), rng.centrato(1)),
    f: new THREE.Vector3(rng.tra(0.6, 1.6), rng.tra(0.8, 2.0), rng.tra(0.6, 1.6)),
    ph: rng.next() * 100,
    r: R * Math.cbrt(rng.next()),
  }));
  let t = 0;
  let agit = 0;
  const centro = (opz.centro ?? new THREE.Vector3(0, 1.2, 0)).clone();
  const centroObj = centro.clone();
  const p = new THREE.Vector3();
  const pp = new THREE.Vector3();
  const M = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const avanti = new THREE.Vector3(0, 0, 1);
  const dir = new THREE.Vector3();
  const s1 = new THREE.Vector3(1, 1, 1);
  const sAla = new THREE.Vector3();
  const rame = new THREE.Color(PALETTE.rameChiaro);
  const posizione = (a: (typeof api)[number], tt: number, out: THREE.Vector3) => {
    const v = 0.9 + agit * 1.8;
    out.set(
      Math.sin(tt * a.f.x * v + a.ph) * a.r + a.o.x * 0.3,
      Math.sin(tt * a.f.y * v * 0.7 + a.ph * 1.3) * a.r * 0.5 + a.o.y * 0.3,
      Math.cos(tt * a.f.z * v + a.ph * 0.7) * a.r + a.o.z * 0.3,
    );
    return out.add(centro);
  };
  const update = (dt: number, stato?: StatoApi) => {
    t += dt;
    if (stato?.centro) centroObj.copy(stato.centro);
    centro.lerp(centroObj, 1 - Math.exp(-0.8 * dt));
    agit = smorza(agit, stato?.agitazione ?? 0, 2, dt);
    for (let i = 0; i < n; i++) {
      const a = api[i] as (typeof api)[number];
      posizione(a, t, p);
      posizione(a, t + 0.05, pp);
      dir.subVectors(pp, p);
      if (dir.lengthSq() > 1e-10) q.setFromUnitVectors(avanti, dir.normalize());
      M.compose(p, q, s1);
      mCorpi.setMatrixAt(i, M);
      const batt = 0.25 + 0.75 * Math.abs(Math.sin(t * 90 + a.ph));
      sAla.set(1, 1, batt);
      M.compose(p, q, sAla);
      mAli.setMatrixAt(i, M);
      posS[i * 3] = p.x;
      posS[i * 3 + 1] = p.y;
      posS[i * 3 + 2] = p.z;
      const luccica = Math.max(0, Math.sin(t * 3.1 + a.ph * 7)) ** 6;
      colS[i * 3] = rame.r * (0.12 + luccica);
      colS[i * 3 + 1] = rame.g * (0.12 + luccica);
      colS[i * 3 + 2] = rame.b * (0.12 + luccica);
    }
    mCorpi.instanceMatrix.needsUpdate = true;
    mAli.instanceMatrix.needsUpdate = true;
    gS.getAttribute('position').needsUpdate = true;
    gS.getAttribute('color').needsUpdate = true;
  };
  update(0);
  return risultato<StatoApi>({
    nome: 'sciame-api',
    seme,
    gruppo,
    collider: [],
    ingombro: { raggio: R * 1.5, altezza: centro.y + R, interrata: 0 },
    punti: { centro: centro.clone() },
    update,
  });
}
