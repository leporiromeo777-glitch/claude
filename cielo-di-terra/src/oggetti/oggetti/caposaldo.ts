/**
 * Capisaldi del Catasto di Aurelio Respini:
 * - chiodo d'ottone numerato (testa a cupola con il numero inciso), da solo o murato su un supporto
 *   (concio di muro a secco, pilastrino squadrato, masso);
 * - pilastro di bronzo (i 24 «Pilastri») con targa e segnale;
 * - palina bianca e rossa alta 8-10 m per i capisaldi lontani (su un ometto di pietre, con tiranti).
 *
 * Il punto `chiodo` di ogni risultato è il centro della testa del chiodo: lì si pianta lo squadro.
 */
import * as THREE from 'three';
import { Costruttore, mat, matSegmento, mescola } from '../costruttore';
import { creaAlone } from '../comune';
import { testaLanterna } from './lumi';
import { box, cil, ingombroDa, risultato } from '../comune';
import { geoBoxC, geoCilindro, geoLastra, geoMasso, geoSfera, geoToro } from '../forme';
import { PALETTE } from '../palette';
import { Rng, semeNumerico, type Seme } from '../rng';
import type { Collider, OggettoProcedurale } from '../tipi';

// segmenti di una cifra a sette segmenti: [cx, cy, orizzontale]
const SEGMENTI: Record<string, Array<[number, number, boolean]>> = {
  a: [[0, 1, true]],
  b: [[0.5, 0.5, false]],
  c: [[0.5, -0.5, false]],
  d: [[0, -1, true]],
  e: [[-0.5, -0.5, false]],
  f: [[-0.5, 0.5, false]],
  g: [[0, 0, true]],
};
const CIFRE: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};

/**
 * Incide (o rilievo) un numero a sette segmenti nel piano XY della matrice, centrato, altezza cifra h.
 * Lo spessore è lungo +Z.
 */
export function numero(b: Costruttore, testo: string, m: THREE.Matrix4, h: number, colore: number | THREE.Color, spessore = 0.004, canale: 'opaco' | 'lume' = 'opaco'): void {
  const w = h * 0.5;
  const s = h * 0.16;
  const passo = w * 1.55;
  const n = testo.length;
  for (let i = 0; i < n; i++) {
    const ch = testo[i] as string;
    const segs = CIFRE[ch];
    if (!segs) continue;
    const ox = (i - (n - 1) / 2) * passo;
    for (const nome of segs) {
      for (const [cx, cy, orizz] of SEGMENTI[nome] ?? []) {
        // segmento piatto appena sollevato dalla superficie (2 triangoli)
        const g = orizz ? new THREE.PlaneGeometry(w, s) : new THREE.PlaneGeometry(s, h / 2 + s * 0.4);
        b.aggiungi(g, { matrice: m.clone().multiply(mat([ox + cx * w, (cy * h) / 2, spessore])), colore, piatto: true, canale });
      }
    }
  }
}

/** Testa del chiodo con il numero, nel sistema locale m (asse +Y uscente dalla superficie). */
export function testaChiodo(b: Costruttore, m: THREE.Matrix4, num: number, scala = 1): void {
  const r = 0.045 * scala;
  // gambo appena visibile e testa
  b.aggiungi(geoCilindro(r * 0.35, r * 0.35, 0.05 * scala, 6), { matrice: m.clone().multiply(mat([0, -0.045 * scala, 0])), colore: PALETTE.ottoneScuro });
  b.aggiungi(geoCilindro(r, r * 1.05, 0.012 * scala, 14), { matrice: m, colore: PALETTE.ottone, gradiente: { basso: 0.8, alto: 1.1, y0: -0.01, y1: 0.02 } });
  const cupola = geoSfera(r, 14, 5);
  cupola.scale(1, 0.25, 1);
  b.aggiungi(cupola, { matrice: m.clone().multiply(mat([0, 0.012 * scala, 0])), colore: PALETTE.ottoneChiaro });
  b.aggiungi(geoToro(r * 0.86, 0.004 * scala, 4, 18), {
    matrice: m.clone().multiply(mat([0, 0.016 * scala, 0], [Math.PI / 2, 0, 0])),
    colore: PALETTE.ottoneScuro,
  });
  // numero inciso (scuro) sulla cupola, rivolto verso +Z locale del sistema
  numero(b, String(num), m.clone().multiply(mat([0, 0.0185 * scala + 0.002, 0], [-Math.PI / 2, 0, 0])), r * 0.6, mescola(PALETTE.ottoneScuro, 0x000000, 0.5), 0.003 * scala);
}

/** Segno di vernice rossa e bianca attorno al chiodo (aiuta a trovarlo). */
function segnoVernice(b: Costruttore, m: THREE.Matrix4, scala = 1): void {
  const anello = new THREE.RingGeometry(0.068 * scala, 0.095 * scala, 18, 1);
  anello.rotateX(-Math.PI / 2);
  b.aggiungi(anello, { matrice: m.clone().multiply(mat([0, 0.002, 0])), colore: PALETTE.rossoPalina, piatto: true });
  const anello2 = new THREE.RingGeometry(0.095 * scala, 0.112 * scala, 18, 1);
  anello2.rotateX(-Math.PI / 2);
  b.aggiungi(anello2, { matrice: m.clone().multiply(mat([0, 0.002, 0])), colore: PALETTE.biancoPalina, piatto: true });
}

export interface OpzioniChiodo {
  numero: number;
  seme?: Seme;
  /** supporto: 'nessuno' = solo il chiodo (asse +Y uscente dalla superficie su cui lo si posa) */
  supporto?: 'nessuno' | 'muro' | 'pilastrino' | 'masso';
  /** anello di vernice rossa e bianca attorno al chiodo */
  segno?: boolean;
  /** scala della testa (1 = 9 cm di diametro) */
  scala?: number;
}

/** Caposaldo d'ottone: chiodo numerato, da solo o murato su un supporto. */
export function creaCaposaldo(opz: OpzioniChiodo): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? `caposaldo-${opz.numero}`);
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const supporto = opz.supporto ?? 'muro';
  const sc = opz.scala ?? 1;
  const collider: Collider[] = [];
  let mChiodo = new THREE.Matrix4();

  if (supporto === 'muro') {
    // concio di muro a secco lungo 1.6 m, con la lastra di copertina che porta il chiodo
    const L = 1.6;
    const H = 0.95;
    const prof = 0.6;
    b.aggiungi(geoBoxC(L, H, prof), { matrice: mat([0, H / 2 - 0.2, 0]), colore: PALETTE.gneissScuro, piatto: true });
    let y = -0.2;
    while (y < H - 0.25) {
      const hc = rng.tra(0.17, 0.27);
      let x = -L / 2;
      while (x < L / 2 - 0.05) {
        const lw = Math.min(L / 2 - x, rng.tra(0.25, 0.5));
        for (const lato of [1, -1]) {
          b.aggiungi(geoLastra(lw - 0.03, hc - 0.03, 0.2, rng.intero(0, 1e6), 0.12), {
            matrice: mat([x + lw / 2, y, lato * (prof / 2 - 0.06)]),
            colore: mescola(PALETTE.gneiss, rng.prob(0.5) ? PALETTE.gneissViola : PALETTE.gneissCaldo, rng.next() * 0.6),
            variazione: 0.1,
            piatto: true,
          });
        }
        x += lw;
      }
      y += hc;
    }
    b.aggiungi(geoLastra(L + 0.06, 0.12, prof + 0.1, rng.intero(0, 1e6), 0.06), {
      matrice: mat([0, H - 0.25, 0]),
      colore: PALETTE.gneissChiaro,
      variazione: 0.05,
      piatto: true,
    });
    mChiodo = mat([rng.centrato(0.3), H - 0.13, 0]);
    collider.push(box(0, (H - 0.13 - 0.2) / 2, 0, L / 2, (H - 0.13 + 0.2) / 2, prof / 2 + 0.05, 'arrampicabile'));
  } else if (supporto === 'pilastrino') {
    const h = 0.75;
    b.aggiungi(geoLastra(0.3, h + 0.2, 0.3, rng.intero(0, 1e6), 0.04), {
      matrice: mat([0, -0.2, 0], [0, rng.next(), 0]),
      colore: PALETTE.gneissChiaro,
      gradiente: { basso: 0.75, alto: 1.05, y0: 0, y1: h },
      variazione: 0.04,
      piatto: true,
    });
    mChiodo = mat([0, h, 0]);
    collider.push(cil(0, -0.2, 0, 0.2, h + 0.2, 'caposaldo'));
  } else if (supporto === 'masso') {
    const r = 0.75;
    const gm = geoMasso(r, rng.intero(0, 1e6), 0.22, 1, 0.65);
    b.aggiungi(gm, {
      matrice: mat([0, r * 0.25, 0]),
      colore: mescola(PALETTE.gneiss, PALETTE.gneissViola, 0.4),
      rumore: 0.08,
      gradiente: { basso: 0.75, alto: 1.05, y0: 0, y1: r },
      piatto: true,
    });
    // il chiodo sta sulla superficie del masso, sulla verticale del centro (raggio verso il basso)
    const prova = new THREE.Mesh(gm.clone().translate(0, r * 0.25, 0), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const colpo = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0)).intersectObject(prova)[0];
    const yTop = colpo ? colpo.point.y : r * 0.8;
    const nrm = colpo?.face ? colpo.face.normal.clone() : new THREE.Vector3(0, 1, 0);
    mChiodo = new THREE.Matrix4().compose(new THREE.Vector3(0, yTop - 0.004, 0), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm), new THREE.Vector3(1, 1, 1));
    prova.geometry.dispose();
    collider.push(cil(0, 0, 0, r * 0.95, r * 0.8, 'arrampicabile'));
  }

  if (opz.segno ?? supporto !== 'nessuno') segnoVernice(b, mChiodo, sc);
  testaChiodo(b, mChiodo, opz.numero, sc);
  const gruppo = b.costruisci(`caposaldo-${opz.numero}`);
  const pChiodo = new THREE.Vector3().setFromMatrixPosition(mChiodo).add(new THREE.Vector3(0, 0.02 * sc, 0));
  return risultato({
    nome: 'caposaldo',
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti: { chiodo: pChiodo },
  });
}

/** Aggiunge una palina bianca e rossa dalla base `a` alta `h` (bande di `banda` m), con bandierina facoltativa. */
export function aggiungiPalina(b: Costruttore, a: THREE.Vector3, h: number, banda = 1.0, raggio = 0.07, bandierina = true): THREE.Vector3 {
  const n = Math.max(1, Math.round(h / banda));
  const hb = h / n;
  for (let i = 0; i < n; i++) {
    const rosso = i % 2 === 0;
    b.aggiungi(geoCilindro(raggio * (1 - (0.25 * i) / n), raggio * (1 - (0.25 * (i - 0.0)) / n), hb, 6), {
      matrice: mat([a.x, a.y + i * hb, a.z]),
      colore: rosso ? PALETTE.rossoPalina : PALETTE.biancoPalina,
    });
  }
  const cima = new THREE.Vector3(a.x, a.y + h, a.z);
  // pomo e bandierina a coda di rondine
  b.aggiungi(geoSfera(raggio * 1.3, 6, 4), { matrice: mat(cima), colore: PALETTE.ottone });
  if (bandierina) {
    const f = new THREE.Shape();
    f.moveTo(0, 0);
    f.lineTo(0.9, 0.05);
    f.lineTo(0.62, -0.25);
    f.lineTo(0.9, -0.55);
    f.lineTo(0, -0.5);
    f.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(f);
    g.deleteAttribute('uv');
    b.aggiungi(g, { matrice: mat([cima.x + raggio, cima.y - 0.15, cima.z], [0, 0, 0]), colore: PALETTE.rossoPalina, canale: 'sottile' });
    // banda bianca sulla bandierina
    const f2 = new THREE.Shape();
    f2.moveTo(0, -0.18);
    f2.lineTo(0.72, -0.15);
    f2.lineTo(0.66, -0.31);
    f2.lineTo(0, -0.32);
    const g2 = new THREE.ShapeGeometry(f2);
    g2.deleteAttribute('uv');
    b.aggiungi(g2, { matrice: mat([cima.x + raggio, cima.y - 0.15, cima.z + 0.003]), colore: PALETTE.biancoPalina, canale: 'sottile' });
  }
  return cima;
}

export interface OpzioniPalina {
  seme?: Seme;
  /** altezza della palina (8-10 m per i capisaldi lontani) */
  altezza?: number;
  /** altezza delle bande bianche e rosse */
  banda?: number;
  /** base: ometto di pietre con tiranti, oppure pilastro in muratura (come nei riferimenti) */
  base?: 'ometto' | 'pilastro' | 'nessuna';
  bandierina?: boolean;
  /** numero del caposaldo sulla targa (solo base 'pilastro') */
  numero?: number;
  /** lume di mira in cima (i lumi che Ottavio porta di notte sui pilastri lontani) */
  lumeDiMira?: boolean;
}

/** Palina bianca e rossa per i capisaldi lontani. */
export function creaPalina(opz: OpzioniPalina = {}): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? 'palina');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const h = opz.altezza ?? 9;
  const base = opz.base ?? 'ometto';
  const collider: Collider[] = [];
  let yBase = 0;
  const punti: Record<string, THREE.Vector3> = {};
  if (base === 'ometto') {
    // ometto di pietre a tronco di cono
    const livelli = 5;
    for (let l = 0; l < livelli; l++) {
      const rr = 0.85 - l * 0.13;
      const n = Math.max(3, Math.round(rr * 9));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + l * 0.6;
        const s = rng.tra(0.2, 0.3) * (1 - l * 0.08);
        b.aggiungi(geoMasso(s, rng.intero(0, 1e6), 0.3, 0, 0.6), {
          matrice: mat([Math.cos(a) * rr * 0.75, l * 0.22 + 0.08, Math.sin(a) * rr * 0.75], [0, rng.next() * 6, 0]),
          colore: mescola(PALETTE.gneiss, PALETTE.gneissChiaro, rng.next() * 0.6),
          variazione: 0.1,
          piatto: true,
        });
      }
    }
    yBase = livelli * 0.22 - 0.1;
    collider.push(cil(0, 0, 0, 0.85, yBase + 0.1, 'arrampicabile'));
    // tiranti
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      const terra = new THREE.Vector3(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2);
      const alto = new THREE.Vector3(0, yBase + h * 0.62, 0);
      b.aggiungi(geoCilindro(0.012, 0.012, 1, 3, true), { matrice: matSegmento(terra, alto), colore: PALETTE.canapaScura, canale: 'sottile' });
      b.aggiungi(geoCilindro(0.03, 0.04, 0.35, 5), { matrice: mat([terra.x, -0.1, terra.z]), colore: PALETTE.legno });
    }
  } else if (base === 'pilastro') {
    const hp = 1.9;
    b.aggiungi(geoLastra(1.0, hp + 0.3, 1.0, rng.intero(0, 1e6), 0.03), {
      matrice: mat([0, -0.3, 0]),
      colore: PALETTE.gneiss,
      gradiente: { basso: 0.75, alto: 1.03, y0: 0, y1: hp },
      rumore: 0.05,
      piatto: true,
    });
    // corsi di pietra a vista
    for (let y = 0.25; y < hp - 0.1; y += 0.32) {
      for (const lato of [0, 1, 2, 3]) {
        const rot = (lato * Math.PI) / 2;
        const d = new THREE.Vector3(0, 0, 0.505).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        const g = new THREE.PlaneGeometry(rng.tra(0.35, 0.6), 0.24);
        b.aggiungi(g, {
          matrice: mat([d.x + (lato % 2 === 0 ? rng.centrato(0.15) : 0), y, d.z + (lato % 2 === 1 ? rng.centrato(0.15) : 0)], [0, rot, 0]),
          colore: mescola(PALETTE.gneissChiaro, PALETTE.gneissViola, rng.next() * 0.6),
          variazione: 0.06,
          piatto: true,
        });
      }
    }
    b.aggiungi(geoLastra(1.15, 0.14, 1.15, rng.intero(0, 1e6), 0.05), { matrice: mat([0, hp, 0]), colore: PALETTE.gneissChiaro, piatto: true });
    yBase = hp + 0.14;
    const mc = mat([0.3, yBase, 0.3]);
    testaChiodo(b, mc, opz.numero ?? 0);
    punti['chiodo'] = new THREE.Vector3(0.3, yBase + 0.02, 0.3);
    collider.push(box(0, hp / 2, 0, 0.55, hp / 2 + 0.07, 0.55, 'arrampicabile'));
    // collare della palina
    b.aggiungi(geoCilindro(0.13, 0.15, 0.3, 8), { matrice: mat([0, yBase, 0]), colore: PALETTE.ferro });
  }
  const cima = aggiungiPalina(b, new THREE.Vector3(0, yBase, 0), h, opz.banda ?? 1.0, 0.07, opz.bandierina ?? true);
  collider.push(cil(0, yBase, 0, 0.1, h, 'palina'));
  const fiamma = opz.lumeDiMira ? testaLanterna(b, mat([0, yBase + h + 0.12, 0]), 1.1, PALETTE.ottoneScuro) : null;
  const gruppo = b.costruisci('palina');
  if (fiamma) {
    gruppo.add(creaAlone(fiamma, 3.5));
    punti['lume'] = fiamma;
  }
  punti['cima'] = cima;
  return risultato({ nome: 'palina', seme, gruppo, collider, ingombro: ingombroDa(gruppo), punti });
}

export interface OpzioniPilastro {
  numero: number;
  seme?: Seme;
  /** segnale sul pilastro: palina 8-10 m, disco, o nessuno */
  segnale?: 'palina' | 'disco' | 'nessuno';
  altezzaSegnale?: number;
  /** pilastro storto: inclinazione in gradi */
  inclinazione?: number;
  /** lume di mira in cima al segnale (visibile di notte attraverso l'asse) */
  lumeDiMira?: boolean;
}

/** Pilastro di bronzo del Catasto: colonnina ottagonale su zoccolo, targa numerata, chiodo in cima, segnale. */
export function creaPilastro(opz: OpzioniPilastro): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? `pilastro-${opz.numero}`);
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const inc = THREE.MathUtils.degToRad(opz.inclinazione ?? 0);
  // zoccolo di pietra
  b.aggiungi(geoLastra(0.8, 0.5, 0.8, rng.intero(0, 1e6), 0.05), {
    matrice: mat([0, -0.25, 0]),
    colore: PALETTE.gneissChiaro,
    gradiente: { basso: 0.75, alto: 1.0, y0: -0.2, y1: 0.25 },
    piatto: true,
  });
  const hc = 1.25;
  const mCol = mat([0, 0.25, 0], [inc, 0, inc * 0.4]);
  b.aggiungi(geoCilindro(0.17, 0.21, 0.12, 8), { matrice: mCol, colore: PALETTE.bronzoScuro, piatto: true });
  b.aggiungi(geoCilindro(0.15, 0.17, hc, 8), {
    matrice: mCol.clone().multiply(mat([0, 0.1, 0])),
    colore: PALETTE.bronzo,
    gradiente: { basso: 0.7, alto: 1.1, y0: 0.3, y1: hc + 0.3 },
    piatto: true,
  });
  b.aggiungi(geoCilindro(0.2, 0.16, 0.1, 8), { matrice: mCol.clone().multiply(mat([0, hc + 0.1, 0])), colore: PALETTE.bronzoScuro, piatto: true });
  // targa
  const mTarga = mCol.clone().multiply(mat([0, hc * 0.62, 0.155], [-0.02, 0, 0]));
  b.aggiungi(geoBoxC(0.2, 0.26, 0.015), { matrice: mTarga, colore: PALETTE.ottone });
  numero(b, String(opz.numero), mTarga.clone().multiply(mat([0, 0.045, 0.008])), 0.09, PALETTE.bronzoScuro, 0.004);
  numero(b, '2120', mTarga.clone().multiply(mat([0, -0.075, 0.008])), 0.035, PALETTE.bronzoScuro, 0.003);
  const mTesta = mCol.clone().multiply(mat([0, hc + 0.2, 0]));
  testaChiodo(b, mTesta, opz.numero);
  const pChiodo = new THREE.Vector3().setFromMatrixPosition(mTesta).add(new THREE.Vector3(0, 0.02, 0));
  const punti: Record<string, THREE.Vector3> = { chiodo: pChiodo };
  const segnale = opz.segnale ?? 'palina';
  if (segnale === 'palina') {
    // la palina sta su un collare accanto al chiodo
    const base = new THREE.Vector3().setFromMatrixPosition(mCol.clone().multiply(mat([0.24, 0, 0])));
    b.aggiungi(geoCilindro(0.06, 0.06, hc + 0.2, 6), { matrice: mat(base), colore: PALETTE.ferro });
    punti['cima'] = aggiungiPalina(b, base.clone().add(new THREE.Vector3(0, hc + 0.2, 0)), opz.altezzaSegnale ?? 8.5, 1.0, 0.06);
  } else if (segnale === 'disco') {
    const base = new THREE.Vector3().setFromMatrixPosition(mCol.clone().multiply(mat([0.24, 0, 0])));
    const hs = opz.altezzaSegnale ?? 8.5;
    b.aggiungi(geoCilindro(0.05, 0.06, hc + 0.2 + hs, 6), { matrice: mat(base), colore: PALETTE.ferro });
    const centroDisco = base.clone().add(new THREE.Vector3(0, hc + 0.2 + hs, 0));
    const disco = new THREE.CircleGeometry(0.8, 16);
    b.aggiungi(disco, { matrice: mat(centroDisco), colore: PALETTE.biancoPalina, canale: 'sottile' });
    const fascia = new THREE.RingGeometry(0.35, 0.62, 16);
    b.aggiungi(fascia, { matrice: mat(centroDisco.clone().add(new THREE.Vector3(0, 0, 0.01))), colore: PALETTE.rossoPalina, canale: 'sottile' });
    b.aggiungi(fascia.clone(), { matrice: mat(centroDisco.clone().add(new THREE.Vector3(0, 0, -0.01)), [0, Math.PI, 0]), colore: PALETTE.rossoPalina, canale: 'sottile' });
    punti['cima'] = centroDisco;
  }
  let fiamma: THREE.Vector3 | null = null;
  if (opz.lumeDiMira) {
    const sopra = (punti['cima'] ?? pChiodo).clone().add(new THREE.Vector3(0, segnale === 'disco' ? 0.95 : 0.12, 0));
    fiamma = testaLanterna(b, mat(sopra), 1.1, PALETTE.ottoneScuro);
    punti['lume'] = fiamma;
  }
  const gruppo = b.costruisci(`pilastro-${opz.numero}`);
  if (fiamma) gruppo.add(creaAlone(fiamma, 3.5));
  return risultato({
    nome: 'pilastro',
    seme,
    gruppo,
    collider: [cil(0, -0.5, 0, 0.42, 0.75, 'arrampicabile'), cil(0, 0.25, 0, 0.21, hc + 0.3, 'caposaldo')],
    ingombro: ingombroDa(gruppo),
    punti,
  });
}

/** Voce di content/capisaldi.json (campi usati). */
export interface VoceCaposaldo {
  numero: number;
  tipo: string;
  nome?: string;
  luogo?: string;
  altezza_segnale?: number;
  note?: string;
  /** solo per i capisaldi lontani visti di notte */
  lume?: string;
}

/**
 * Crea il caposaldo giusto da una voce di content/capisaldi.json:
 * - tipo 'pilastro' → pilastro di bronzo con palina alta `altezza_segnale` (disco se le note parlano di disco);
 * - tipo 'chiodo' → chiodo murato: nel muro, su un masso («Sass»), su un pilastrino («cippo»),
 *   oppure solo il chiodo (gradini, soglie, sagrato: lo si posa sulla pietra che c'è già).
 * Il Pilastro 1 sta sulla terrazza del campanile (creaCampanile lo comprende già).
 */
export function creaCaposaldoDaContenuto(v: VoceCaposaldo): OggettoProcedurale {
  const testo = `${v.nome ?? ''} ${v.luogo ?? ''} ${v.note ?? ''}`.toLowerCase();
  if (v.tipo === 'pilastro') {
    const hs = v.altezza_segnale ?? 8;
    return creaPilastro({
      numero: v.numero,
      segnale: hs <= 0 ? 'nessuno' : testo.includes('disco') ? 'disco' : 'palina',
      altezzaSegnale: hs > 0 ? hs : 8,
      lumeDiMira: v.lume !== undefined,
    });
  }
  const supporto: OpzioniChiodo['supporto'] = testo.includes('muro')
    ? 'muro'
    : testo.includes('sass') || testo.includes('masso')
      ? 'masso'
      : testo.includes('cippo') || testo.includes('pilastrino')
        ? 'pilastrino'
        : 'nessuno';
  return creaCaposaldo({ numero: v.numero, supporto, segno: true });
}
