/**
 * Oggetti del Verbanetto: pontile di legno su pali (con la tavola dei venti dipinta: Tramontana al mattino,
 * Inverna nel pomeriggio) e barca a remi con vela rossa al terzo e lanterna a prua.
 *
 * Per entrambi y = 0 è il pelo dell'acqua. Il pontile parte dalla riva (origine) e va verso +Z;
 * la barca ha la prua verso +Z.
 */
import * as THREE from 'three';
import { Costruttore, mat, matSegmento, mescola } from '../costruttore';
import { box, cil, creaAlone, creaLuceLume, ingombroDa, risultato } from '../comune';
import { geoBoxC, geoCilindro, geoLastra, geoPiano, geoSfera, geoTubo } from '../forme';
import { leggiIntensitaLumi, materialePer } from '../materiali';
import { PALETTE } from '../palette';
import { Rng, semeNumerico, type Seme } from '../rng';
import type { Collider, OggettoProcedurale } from '../tipi';
import { testaLanterna } from './lumi';

export interface OpzioniPontile {
  seme?: Seme;
  lunghezza?: number;
  larghezza?: number;
  /** altezza dell'assito sull'acqua */
  altezza?: number;
  /** profondità dell'acqua (lunghezza dei pali sotto il pelo) */
  profondita?: number;
  /** tavola dei venti con la lanterna in testa al pontile */
  tavolaVenti?: boolean;
  luce?: boolean;
}

export function creaPontile(opz: OpzioniPontile = {}): OggettoProcedurale<{ accesa?: number }> {
  const seme = semeNumerico(opz.seme ?? 'pontile');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const L = opz.lunghezza ?? 14;
  const Wd = opz.larghezza ?? 2.0;
  const h = opz.altezza ?? 0.75;
  const prof = opz.profondita ?? 2.2;
  const legno = mescola(PALETTE.legnoGrigio, PALETTE.legnoVecchio, rng.next() * 0.5);

  // spalla di pietra sulla riva
  b.aggiungi(geoLastra(Wd + 1.0, h + 1.2, 1.8, rng.intero(0, 1e6), 0.04), {
    matrice: mat([0, -1.2, -0.3]),
    colore: PALETTE.gneiss,
    gradiente: { basso: 0.6, alto: 1.0, y0: -0.6, y1: h },
    rumore: 0.05,
    piatto: true,
  });
  // assito: tavolato scuro + assi trasversali a tono variato
  b.aggiungi(geoBoxC(Wd, 0.1, L), { matrice: mat([0, h - 0.05, L / 2 + 0.4]), colore: mescola(legno, 0x000000, 0.45), piatto: true });
  const passo = 0.24;
  const nAssi = Math.floor(L / passo);
  for (let i = 0; i < nAssi; i++) {
    const z = 0.4 + (i + 0.5) * passo;
    const lw = Wd + rng.centrato(0.06);
    const g = geoPiano(lw, passo - 0.035);
    g.rotateX(-Math.PI / 2);
    b.aggiungi(g, {
      matrice: mat([rng.centrato(0.03), h + 0.002, z], [0, rng.centrato(0.02), 0]),
      colore: mescola(legno, i % 3 === 0 ? 0xffffff : 0x000000, rng.next() * 0.12),
      variazione: 0.06,
      piatto: true,
    });
  }
  // longheroni e pali
  for (const s of [-1, 1]) {
    b.aggiungi(geoBoxC(0.14, 0.2, L), { matrice: mat([s * (Wd / 2 - 0.15), h - 0.2, L / 2 + 0.4]), colore: PALETTE.legnoScuro, piatto: true });
  }
  const collider: Collider[] = [box(0, h - 0.1, L / 2 + 0.4, Wd / 2, 0.12, L / 2, 'calpestabile')];
  const passoPali = 2.4;
  const nPali = Math.floor((L - 1) / passoPali) + 1;
  for (let i = 0; i < nPali; i++) {
    const z = 1.6 + i * passoPali;
    for (const s of [-1, 1]) {
      const sporge = i === nPali - 1 ? 0.55 : 0.08;
      b.aggiungi(geoCilindro(0.1, 0.12, prof + h + sporge, 6), {
        matrice: mat([s * (Wd / 2 + 0.02), -prof, z], [rng.centrato(0.03), 0, rng.centrato(0.03)]),
        colore: legno,
        gradiente: { basso: 0.35, alto: 1.0, y0: -0.4, y1: 0.4 },
      });
    }
    // traverso e croce di Sant'Andrea sotto l'assito
    b.aggiungi(geoBoxC(Wd + 0.2, 0.14, 0.1), { matrice: mat([0, h - 0.32, z]), colore: PALETTE.legnoScuro, piatto: true });
    if (i % 2 === 1) {
      const d = Math.hypot(Wd, h + 0.8);
      for (const s of [-1, 1]) {
        b.aggiungi(geoBoxC(d, 0.08, 0.05), { matrice: mat([0, (h - 0.4 - 0.8) / 2 + 0.05, z + s * 0.07], [0, 0, s * Math.atan2(h + 0.6, Wd)]), colore: PALETTE.legnoScuro, piatto: true });
      }
    }
  }
  // bitte in testa e scaletta laterale
  const zTesta = L + 0.2;
  for (const s of [-1, 1]) {
    b.aggiungi(geoCilindro(0.13, 0.13, 0.42, 8), { matrice: mat([s * (Wd / 2 - 0.25), h, zTesta - 0.4]), colore: PALETTE.legnoScuro });
    b.aggiungi(geoCilindro(0.16, 0.14, 0.06, 8), { matrice: mat([s * (Wd / 2 - 0.25), h + 0.42, zTesta - 0.4]), colore: PALETTE.legnoScuro });
    collider.push(cil(s * (Wd / 2 - 0.25), h, zTesta - 0.4, 0.16, 0.5, 'bitta'));
  }
  for (const s of [-1, 1]) {
    b.aggiungi(geoBoxC(0.06, h + 1.0, 0.06), { matrice: mat([Wd / 2 + 0.12, h / 2 - 0.5, zTesta - 2.2 + s * 0.22]), colore: PALETTE.ferro, piatto: true });
  }
  for (let k = 0; k < 4; k++) {
    b.aggiungi(geoBoxC(0.05, 0.04, 0.46), { matrice: mat([Wd / 2 + 0.12, h - 0.25 - k * 0.3, zTesta - 2.2]), colore: PALETTE.ferro, piatto: true });
  }
  // cima d'ormeggio arrotolata
  b.aggiungi(new THREE.TorusGeometry(0.16, 0.035, 4, 10).rotateX(Math.PI / 2), { matrice: mat([-(Wd / 2 - 0.55), h + 0.035, zTesta - 1.2]), colore: PALETTE.canapa });

  const punti: Record<string, THREE.Vector3> = {
    riva: new THREE.Vector3(0, h, 0.6),
    testa: new THREE.Vector3(0, h, zTesta - 0.6),
    ormeggio: new THREE.Vector3(Wd / 2 + 1.2, 0, zTesta - 2.5),
  };

  let fiamma: THREE.Vector3 | null = null;
  if (opz.tavolaVenti ?? true) {
    // palo con la tavola dei venti dipinta e una lanterna appesa
    const px = -(Wd / 2 - 0.1);
    const pz = zTesta - 0.9;
    b.aggiungi(geoBoxC(0.1, 2.6, 0.1), { matrice: mat([px, h + 1.3, pz]), colore: PALETTE.legnoScuro, piatto: true });
    const mT = mat([px - 0.02, h + 1.75, pz], [0, -Math.PI / 2, 0]);
    b.aggiungi(geoBoxC(0.95, 0.62, 0.04), { matrice: mT, colore: PALETTE.calce, variazione: 0.04, piatto: true });
    b.aggiungi(geoBoxC(1.0, 0.04, 0.05), { matrice: mT.clone().multiply(mat([0, 0.31, 0])), colore: PALETTE.legnoScuro, piatto: true });
    b.aggiungi(geoBoxC(1.0, 0.04, 0.05), { matrice: mT.clone().multiply(mat([0, -0.31, 0])), colore: PALETTE.legnoScuro, piatto: true });
    // due frecce: Tramontana (azzurra, mattino) e Inverna (arancio, pomeriggio), in versi opposti
    const freccia = (y: number, verso: number, colore: number) => {
      const s = new THREE.Shape();
      s.moveTo(-0.32, -0.035);
      s.lineTo(0.18, -0.035);
      s.lineTo(0.18, -0.09);
      s.lineTo(0.34, 0);
      s.lineTo(0.18, 0.09);
      s.lineTo(0.18, 0.035);
      s.lineTo(-0.32, 0.035);
      s.lineTo(-0.32, -0.035);
      const g = new THREE.ShapeGeometry(s);
      g.deleteAttribute('uv');
      b.aggiungi(g, { matrice: mT.clone().multiply(mat([0, y, 0.022], [0, 0, verso > 0 ? 0 : Math.PI])), colore });
      // sole o mezzo sole accanto (cerchietto)
      const c = new THREE.CircleGeometry(0.05, 8, 0, verso > 0 ? Math.PI * 2 : Math.PI);
      b.aggiungi(c, { matrice: mT.clone().multiply(mat([-0.4 * verso, y, 0.022])), colore: PALETTE.ottone });
    };
    freccia(0.13, 1, 0x4f7fa6);
    freccia(-0.13, -1, 0xd9822b);
    // braccio e lanterna
    b.aggiungi(geoBoxC(0.5, 0.06, 0.06), { matrice: mat([px + 0.25, h + 2.5, pz]), colore: PALETTE.legnoScuro, piatto: true });
    fiamma = testaLanterna(b, mat([px + 0.45, h + 2.05, pz]), 1.0);
    punti['lanterna'] = fiamma.clone();
  }

  const gruppo = b.costruisci('pontile');
  let alone: THREE.Sprite | null = null;
  let luce: THREE.PointLight | null = null;
  if (fiamma) {
    alone = creaAlone(fiamma, 1.4);
    gruppo.add(alone);
    if (opz.luce) {
      luce = creaLuceLume(fiamma, 2.2, 10);
      gruppo.add(luce);
    }
  }
  return risultato<{ accesa?: number }>({
    nome: 'pontile',
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti,
    update: (_dt, stato) => {
      const k = stato?.accesa ?? leggiIntensitaLumi();
      if (alone) alone.scale.setScalar(1.4 * (0.6 + 0.4 * Math.min(1, k)));
      if (luce) luce.intensity = 2.2 * k;
    },
  });
}

export interface OpzioniBarca {
  seme?: Seme;
  lunghezza?: number;
  /** vela al terzo: alzata, ammainata (avvolta sul pennone) o assente */
  vela?: 'alzata' | 'ammainata' | 'nessuna';
  coloreScafo?: number;
  remi?: boolean;
  lanterna?: boolean;
  luce?: boolean;
}

export interface StatoBarca {
  /** intensità del vento 0-1 (gonfia la vela) */
  vento?: number;
  /** lato da cui gonfia la vela: +1 a dritta, -1 a sinistra */
  mura?: 1 | -1;
  /** beccheggio e rollio sull'onda */
  onda?: number;
}

/** Barca a remi del Verbanetto con vela rossa e lanterna a prua. */
export function creaBarca(opz: OpzioniBarca = {}): OggettoProcedurale<StatoBarca> {
  const seme = semeNumerico(opz.seme ?? 'barca');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const L = opz.lunghezza ?? 4.8;
  const B = L * 0.3;
  const Dp = 0.62;
  const colScafo = opz.coloreScafo ?? rng.scegli([0x3c5d5c, 0x2f4a5f, 0xe4dccb, PALETTE.smaltoVerde, 0x5a3b2a]);
  const nSt = 13;
  const sezioneU = [0, 0.18, 0.5, 0.82, 1.0];
  const sezioneX = [0, 0.52, 0.86, 0.98, 1.0];
  const sezioneY = [0, 0.06, 0.28, 0.66, 1.0];
  const larghezza = (t: number) => (B / 2) * Math.pow(Math.max(0, Math.sin(Math.PI * (0.13 + 0.87 * t))), 0.72);
  const bordo = (t: number) => 0.3 + 0.13 * Math.pow(2 * t - 1, 2) + 0.12 * Math.pow(Math.max(0, t - 0.6) / 0.4, 2);
  const chiglia = (t: number) => -0.3 + (Dp * 0.75) * Math.pow(Math.max(0, (t - 0.72) / 0.28), 2) + 0.12 * Math.pow(Math.max(0, (0.12 - t) / 0.12), 2);
  // anelli: per ogni stazione, punti dal bordo sinistro alla chiglia al bordo destro
  const anello = (t: number, rientro: number): THREE.Vector3[] => {
    const z = -L / 2 + t * L;
    const w = Math.max(0.001, larghezza(t) - rientro);
    const yb = bordo(t) - rientro * 0.3;
    const yk = chiglia(t) + rientro;
    const pts: THREE.Vector3[] = [];
    for (let i = sezioneU.length - 1; i >= 0; i--) pts.push(new THREE.Vector3(-w * (sezioneX[i] as number), yk + (yb - yk) * (sezioneY[i] as number), z));
    for (let i = 1; i < sezioneU.length; i++) pts.push(new THREE.Vector3(w * (sezioneX[i] as number), yk + (yb - yk) * (sezioneY[i] as number), z));
    return pts;
  };
  const superficie = (rientro: number, interno: boolean): THREE.BufferGeometry => {
    const pos: number[] = [];
    const idx: number[] = [];
    let np = 0;
    for (let s = 0; s < nSt; s++) {
      const pts = anello(s / (nSt - 1), rientro);
      np = pts.length;
      for (const p of pts) pos.push(p.x, p.y, p.z);
    }
    for (let s = 0; s < nSt - 1; s++) {
      for (let k = 0; k < np - 1; k++) {
        const a = s * np + k;
        const bb = s * np + k + 1;
        const c = (s + 1) * np + k;
        const d = (s + 1) * np + k + 1;
        if (interno) idx.push(a, c, bb, bb, c, d);
        else idx.push(a, bb, c, bb, d, c);
      }
    }
    // specchio di poppa
    const p0 = 0;
    for (let k = 1; k < np - 2; k++) {
      if (interno) idx.push(p0, p0 + k, p0 + k + 1);
      else idx.push(p0, p0 + k + 1, p0 + k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const cScafo = new THREE.Color(colScafo);
  const cFascia = new THREE.Color(PALETTE.vermiglio);
  const cOpera = new THREE.Color(0x3a2a22);
  b.aggiungi(superficie(0, false), {
    colore: (p, _n, out) => {
      const t = (p.z + L / 2) / L;
      const yb = bordo(t);
      if (p.y > yb - 0.07) out.copy(cFascia);
      else if (p.y < -0.12) out.copy(cOpera);
      else out.copy(cScafo);
    },
    gradiente: { basso: 0.75, alto: 1.05, y0: -0.3, y1: 0.4 },
  });
  b.aggiungi(superficie(0.045, true), {
    colore: PALETTE.legnoChiaro,
    gradiente: { basso: 0.6, alto: 1.0, y0: -0.25, y1: 0.4 },
  });
  // capodibanda e dritto di prua
  for (const s of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 9; i++) {
      const t = 0.02 + (i / 8) * 0.96;
      pts.push(new THREE.Vector3(s * (larghezza(t) - 0.02), bordo(t) + 0.01, -L / 2 + t * L));
    }
    b.aggiungi(geoTubo(pts, [0.035], 4), { colore: PALETTE.legnoScuro });
  }
  b.aggiungi(geoTubo([new THREE.Vector3(0, chiglia(1) - 0.05, L / 2 - 0.05), new THREE.Vector3(0, bordo(1) + 0.12, L / 2 + 0.06)], [0.05, 0.04], 4), { colore: PALETTE.legnoScuro });
  // banchi
  for (const t of [0.3, 0.55, 0.8]) {
    const w = larghezza(t) * 2 - 0.08;
    b.aggiungi(geoBoxC(w, 0.05, 0.26), { matrice: mat([0, bordo(t) - 0.2, -L / 2 + t * L]), colore: PALETTE.legno, piatto: true });
  }
  // timone sullo specchio di poppa
  b.aggiungi(geoBoxC(0.05, 0.7, 0.36), { matrice: mat([0, 0.0, -L / 2 - 0.16], [0.12, 0, 0]), colore: PALETTE.legnoScuro, piatto: true });
  b.aggiungi(geoBoxC(0.04, 0.04, 0.7), { matrice: mat([0, bordo(0) + 0.08, -L / 2 + 0.2]), colore: PALETTE.legno, piatto: true });

  // remi appoggiati sugli scalmi
  if (opz.remi ?? true) {
    for (const s of [-1, 1]) {
      const t = 0.5;
      const sc = new THREE.Vector3(s * larghezza(t), bordo(t) + 0.04, -L / 2 + t * L);
      b.aggiungi(geoCilindro(0.015, 0.015, 0.12, 4), { matrice: mat(sc), colore: PALETTE.ferro });
      const dentro = sc.clone().add(new THREE.Vector3(-s * 0.7, 0.12, 0.35));
      const fuori = sc.clone().add(new THREE.Vector3(s * 1.4, -0.32, -0.75));
      b.aggiungi(geoCilindro(0.025, 0.025, 1, 5), { matrice: matSegmento(dentro, fuori), colore: PALETTE.legnoChiaro });
      const pala = geoBoxC(0.16, 0.02, 0.55);
      const dir = fuori.clone().sub(dentro).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      b.aggiungi(pala, { matrice: new THREE.Matrix4().compose(fuori.clone().addScaledVector(dir, 0.2), q, new THREE.Vector3(1, 1, 1)), colore: PALETTE.legnoChiaro, piatto: true });
    }
  }

  // albero e pennone
  const tAlbero = 0.72;
  const piedeAlbero = new THREE.Vector3(0, bordo(tAlbero) - 0.2, -L / 2 + tAlbero * L);
  const hAlbero = L * 0.78;
  b.aggiungi(geoCilindro(0.045, 0.06, hAlbero, 6), { matrice: mat(piedeAlbero), colore: PALETTE.legno });

  const punti: Record<string, THREE.Vector3> = {
    seduta: new THREE.Vector3(0, bordo(0.55) - 0.15, -L / 2 + 0.55 * L),
    poppa: new THREE.Vector3(0, bordo(0), -L / 2),
    prua: new THREE.Vector3(0, bordo(1), L / 2),
  };
  // lanterna a prua
  let fiamma: THREE.Vector3 | null = null;
  if (opz.lanterna ?? true) {
    const base = new THREE.Vector3(0, bordo(0.94), -L / 2 + 0.94 * L);
    b.aggiungi(geoCilindro(0.022, 0.026, 0.42, 5), { matrice: mat(base), colore: PALETTE.legnoScuro });
    fiamma = testaLanterna(b, mat(base.clone().add(new THREE.Vector3(0, 0.42, 0))), 0.75, PALETTE.ottoneScuro);
    punti['lanterna'] = fiamma.clone();
  }

  const vela = opz.vela ?? 'alzata';
  if (vela === 'ammainata') {
    // vela avvolta sul pennone abbassato lungo la barca
    const a = piedeAlbero.clone().add(new THREE.Vector3(0.12, 0.55, 0.3));
    const c = new THREE.Vector3(0.12, bordo(0.1) + 0.3, -L / 2 + 0.25);
    b.aggiungi(geoCilindro(0.13, 0.11, 1, 6), { matrice: matSegmento(a, c), colore: PALETTE.vermiglio, variazione: 0.06 });
    b.aggiungi(geoCilindro(0.03, 0.03, 1, 5), { matrice: matSegmento(a.clone().add(new THREE.Vector3(0, 0.1, 0.3)), c.clone().add(new THREE.Vector3(0, 0.1, -0.2))), colore: PALETTE.legno });
  }

  const scafo = b.costruisci('barca');
  const gruppoMobile = new THREE.Group();
  gruppoMobile.name = 'barca-beccheggio';
  gruppoMobile.add(scafo);

  // vela al terzo (mesh separata, deformata ogni fotogramma)
  let aggiornaVela: ((vento: number, mura: number) => void) | null = null;
  if (vela === 'alzata') {
    const nu = 7;
    const nv = 7;
    // angoli in coordinate barca: mura (prora bassa), scotta (poppa bassa), penna (poppa alta), gola (prora alta)
    const tack = piedeAlbero.clone().add(new THREE.Vector3(0, 0.45, 0.35));
    const clew = new THREE.Vector3(0, bordo(0.25) + 0.45, -L / 2 + 0.2 * L);
    const peak = piedeAlbero.clone().add(new THREE.Vector3(0, hAlbero + 0.35, -1.95));
    const throat = piedeAlbero.clone().add(new THREE.Vector3(0, hAlbero * 0.72, 0.42));
    const base: THREE.Vector3[] = [];
    const pos = new Float32Array(nu * nv * 3);
    const col: number[] = [];
    const cV = new THREE.Color(PALETTE.vermiglio);
    const cVs = mescola(PALETTE.vermiglio, 0x000000, 0.18);
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const u = i / (nu - 1);
        const v = j / (nv - 1);
        const bassa = tack.clone().lerp(clew, u);
        const alta = throat.clone().lerp(peak, u);
        const p = bassa.lerp(alta, v);
        base.push(p);
        const c = i % 2 === 0 ? cV : cVs;
        col.push(c.r, c.g, c.b);
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < nv - 1; j++) {
      for (let i = 0; i < nu - 1; i++) {
        const a = j * nu + i;
        idx.push(a, a + 1, a + nu, a + 1, a + nu + 1, a + nu);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const velaMesh = new THREE.Mesh(g, materialePer('sottile'));
    velaMesh.name = 'barca-vela:sottile';
    velaMesh.userData['canale'] = 'sottile';
    velaMesh.castShadow = true;
    gruppoMobile.add(velaMesh);
    // pennone lungo la gola-penna
    const bp = new Costruttore(rng.derivato('pennone'));
    bp.aggiungi(geoCilindro(0.03, 0.03, 1, 5), { matrice: matSegmento(throat.clone().add(new THREE.Vector3(0, -0.05, 0.15)), peak.clone().add(new THREE.Vector3(0, 0.05, -0.1))), colore: PALETTE.legno });
    bp.aggiungi(geoSfera(0.05, 5, 3), { matrice: mat(piedeAlbero.clone().add(new THREE.Vector3(0, hAlbero, 0))), colore: PALETTE.legnoScuro });
    // scotta
    bp.aggiungi(geoCilindro(0.008, 0.008, 1, 3), { matrice: matSegmento(clew, new THREE.Vector3(0.2, bordo(0.12) + 0.05, -L / 2 + 0.12 * L)), colore: PALETTE.canapa });
    const pennone = bp.mesh('barca-pennone');
    if (pennone) gruppoMobile.add(pennone);
    aggiornaVela = (vento: number, mura: number) => {
      for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
          const k = j * nu + i;
          const p = base[k] as THREE.Vector3;
          const u = i / (nu - 1);
          const v = j / (nv - 1);
          const gonfio = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 0.9 + 0.1)) * (0.15 + 0.5 * vento);
          pos[k * 3] = p.x + mura * gonfio + mura * u * 0.35 * vento;
          pos[k * 3 + 1] = p.y;
          pos[k * 3 + 2] = p.z;
        }
      }
      g.getAttribute('position').needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingSphere();
    };
    aggiornaVela(0.4, 1);
  }

  const gruppo = new THREE.Group();
  gruppo.add(gruppoMobile);
  let alone: THREE.Sprite | null = null;
  let luce: THREE.PointLight | null = null;
  if (fiamma) {
    alone = creaAlone(fiamma, 1.1);
    gruppoMobile.add(alone);
    if (opz.luce) {
      luce = creaLuceLume(fiamma, 1.6, 8);
      gruppoMobile.add(luce);
    }
  }
  let t = rng.next() * 10;
  let vento = 0.4;
  const update = (dt: number, stato?: StatoBarca) => {
    t += dt;
    const onda = stato?.onda ?? 1;
    gruppoMobile.rotation.x = Math.sin(t * 1.1) * 0.025 * onda;
    gruppoMobile.rotation.z = Math.sin(t * 0.83 + 1) * 0.04 * onda;
    gruppoMobile.position.y = Math.sin(t * 1.3) * 0.04 * onda;
    vento += ((stato?.vento ?? 0.4) - vento) * Math.min(1, dt * 2);
    const raffica = vento * (1 + Math.sin(t * 2.3) * 0.08);
    if (aggiornaVela) aggiornaVela(raffica, stato?.mura ?? 1);
    const k = leggiIntensitaLumi();
    if (alone) alone.scale.setScalar(1.1 * (0.6 + 0.4 * Math.min(1, k)));
    if (luce) luce.intensity = 1.6 * k;
  };
  return risultato<StatoBarca>({
    nome: 'barca',
    seme,
    gruppo,
    collider: [box(0, 0.05, 0, B / 2, 0.4, L / 2, 'barca')],
    ingombro: ingombroDa(gruppo),
    punti,
    update,
  });
}
