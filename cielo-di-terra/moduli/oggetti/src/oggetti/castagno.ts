/**
 * Castagni delle Selve:
 * - castagno secolare vivo: tronco largo e torto con le radici a contrafforte, poche branche grosse,
 *   chioma a masse tondeggianti a tre toni (estate, autunno, fioritura con gli amenti color crema);
 * - castagno morto: tronco grigio spaccato, rami spogli e nodosi, radici scoperte;
 * - botola di pietra della Cripta fra le radici del castagno morto (apribile, animata).
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola, type FnColore } from '../costruttore';
import { box, cil, ingombroDa, risultato, smorza } from '../comune';
import { geoBoxC, geoCilindro, geoLastra, geoMassa, geoMasso, geoSfera, geoToro, geoTubo } from '../forme';
import { PALETTE } from '../palette';
import { hashPosizione, Rng, semeNumerico, type Seme } from '../rng';
import type { Collider, OggettoProcedurale } from '../tipi';

export type Stagione = 'estate' | 'autunno' | 'fioritura';

export interface OpzioniCastagno {
  seme?: Seme;
  /** altezza complessiva (m), 9-17 */
  altezza?: number;
  /** diametro della chioma (m) */
  larghezzaChioma?: number;
  stagione?: Stagione;
  /** numero di masse della chioma */
  masse?: number;
  /** ricci a terra (autunno) */
  ricci?: boolean;
  dettaglio?: 'alto' | 'basso';
}

/** Punti di un ramo torto da a verso b, con una deviazione laterale. */
function percorsoTorto(rng: Rng, a: THREE.Vector3, b: THREE.Vector3, n: number, torsione: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const d = b.clone().sub(a);
  const perp = new THREE.Vector3(-d.z, 0, d.x).normalize();
  if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
  const perp2 = new THREE.Vector3().crossVectors(d, perp).normalize();
  const f1 = rng.centrato(1);
  const f2 = rng.centrato(1);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = a.clone().lerp(b, t);
    const s = Math.sin(t * Math.PI) * torsione * d.length();
    p.addScaledVector(perp, s * f1).addScaledVector(perp2, s * f2 * 0.6);
    pts.push(p);
  }
  return pts;
}

/** Funzione di colore della corteccia: scura in basso, con venature (rumore lungo l'altezza). */
function corteccia(chiaro: number, scuro: number, seme: number, h: number): FnColore {
  const c1 = new THREE.Color(chiaro);
  const c2 = new THREE.Color(scuro);
  return (p, n, out) => {
    const v = hashPosizione(Math.round(p.x * 4) / 4, Math.round(p.y * 1.5) / 1.5, Math.round(p.z * 4) / 4, seme);
    const t = THREE.MathUtils.clamp(p.y / h, 0, 1);
    out.copy(c2).lerp(c1, 0.35 + t * 0.4 + (v - 0.5) * 0.35 + n.y * 0.1);
  };
}

/** Castagno secolare vivo. */
export function creaCastagno(opz: OpzioniCastagno = {}): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? 'castagno');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const H = opz.altezza ?? rng.tra(10, 15);
  const larg = opz.larghezzaChioma ?? H * rng.tra(0.85, 1.1);
  const stagione = opz.stagione ?? 'estate';
  const det = opz.dettaglio ?? 'alto';
  const rTronco = H * rng.tra(0.065, 0.085);
  const hFusto = H * rng.tra(0.26, 0.34);

  // tronco con radici a contrafforte e torsione
  const nAnelli = 7;
  const fase = rng.next() * 6;
  const lobi = rng.intero(4, 6);
  const pts: THREE.Vector3[] = [];
  const raggi: number[] = [];
  const pende = new THREE.Vector3(rng.centrato(0.6), 0, rng.centrato(0.6));
  for (let i = 0; i < nAnelli; i++) {
    const t = i / (nAnelli - 1);
    const y = -0.6 + t * (hFusto + 0.8);
    pts.push(new THREE.Vector3(pende.x * t * t, y, pende.z * t * t));
    raggi.push(rTronco * (1.0 + 0.55 * Math.pow(1 - t, 3) + (t > 0.85 ? 0.12 : 0)));
  }
  const corteccia1 = corteccia(PALETTE.troncoCastagno, PALETTE.troncoScuro, seme, H);
  b.aggiungi(
    geoTubo(pts, raggi, 9, {
      chiudiFine: true,
      fase,
      forma: (i, a) => {
        const t = i / (nAnelli - 1);
        const l = Math.pow(Math.max(0, Math.cos(a * lobi + fase)), 2);
        return 1 + l * 0.45 * Math.pow(1 - t, 2) + Math.sin(a * 3 + i * 0.9) * 0.05;
      },
    }),
    { colore: corteccia1 },
  );

  // masse della chioma
  const nMasse = opz.masse ?? Math.round(rng.tra(8, 11));
  const cChioma = new THREE.Vector3(pende.x, H * 0.62, pende.z);
  const rx = larg / 2;
  const ry = (H - hFusto) * 0.5;
  const centri: Array<{ c: THREE.Vector3; r: number }> = [];
  // anello basso, anello alto, cima
  for (let k = 0; k < nMasse; k++) {
    let c: THREE.Vector3;
    let r: number;
    if (k === nMasse - 1) {
      c = new THREE.Vector3(cChioma.x + rng.centrato(0.8), H - ry * 0.55, cChioma.z + rng.centrato(0.8));
      r = ry * 0.6;
    } else {
      const basso = k < Math.ceil((nMasse - 1) * 0.55);
      const nAnello = basso ? Math.ceil((nMasse - 1) * 0.55) : nMasse - 1 - Math.ceil((nMasse - 1) * 0.55);
      const idx = basso ? k : k - Math.ceil((nMasse - 1) * 0.55);
      const a = (idx / nAnello) * Math.PI * 2 + (basso ? 0 : 0.5) + rng.centrato(0.35);
      const rr = basso ? rx * rng.tra(0.58, 0.72) : rx * rng.tra(0.3, 0.45);
      const y = basso ? cChioma.y - ry * rng.tra(0.15, 0.35) : cChioma.y + ry * rng.tra(0.15, 0.35);
      c = new THREE.Vector3(cChioma.x + Math.cos(a) * rr, y, cChioma.z + Math.sin(a) * rr);
      r = basso ? rx * rng.tra(0.36, 0.46) : rx * rng.tra(0.38, 0.48);
    }
    centri.push({ c, r });
  }
  // massa interna che riempie i vuoti
  centri.push({ c: cChioma.clone(), r: rx * 0.55 });

  // branche dal fusto verso le masse
  const cima = pts[nAnelli - 1] as THREE.Vector3;
  const nBranche = rng.intero(3, 5);
  for (let k = 0; k < nBranche; k++) {
    const target = (centri[(k * 2) % (centri.length - 1)] as { c: THREE.Vector3 }).c;
    const fine = target.clone().lerp(cChioma, 0.3);
    const inizio = cima.clone().add(new THREE.Vector3(rng.centrato(rTronco * 0.5), -0.3, rng.centrato(rTronco * 0.5)));
    const p = percorsoTorto(rng, inizio, fine, 5, 0.12);
    b.aggiungi(geoTubo(p, [rTronco * 0.62, rTronco * 0.48, rTronco * 0.36, rTronco * 0.26, rTronco * 0.16], 6), { colore: corteccia1 });
  }

  // colori della chioma per stagione
  const tavolozza =
    stagione === 'autunno' ? PALETTE.fogliaAutunno : stagione === 'fioritura' ? PALETTE.fogliaFioritura : PALETTE.fogliaEstate;
  const cScuro = new THREE.Color(tavolozza[0]);
  const cMedio = new THREE.Color(tavolozza[1]);
  const cChiaro = new THREE.Color(tavolozza[2]);
  const verdi = PALETTE.fogliaEstate;
  const amenti = new THREE.Color(PALETTE.amenti);
  const yMin = hFusto;
  const yMax = H;
  for (const [i, { c, r }] of centri.entries()) {
    // in autunno alcune masse restano più verdi
    const mixVerde = stagione === 'autunno' ? Math.max(0, rng.next() - 0.45) * 1.2 : 0;
    const tintaMassa = rng.centrato(0.05);
    const fn: FnColore = (p, n, out) => {
      const altezza = THREE.MathUtils.clamp((p.y - yMin) / (yMax - yMin), 0, 1);
      const t = THREE.MathUtils.clamp(n.y * 0.35 + 0.35 + altezza * 0.45 + (hashPosizione(p.x, p.y, p.z, seme) - 0.5) * 0.18, 0, 1);
      if (t < 0.5) out.copy(cScuro).lerp(cMedio, t / 0.5);
      else out.copy(cMedio).lerp(cChiaro, (t - 0.5) / 0.5);
      if (mixVerde > 0) out.lerp(new THREE.Color(verdi[t < 0.5 ? 0 : 1]), mixVerde);
      out.r *= 1 + tintaMassa;
      out.b *= 1 - tintaMassa;
      if (stagione === 'fioritura' && n.y > -0.1 && hashPosizione(p.x * 1.7, p.y * 1.7, p.z * 1.7, seme + 5) > 0.72) out.lerp(amenti, 0.75);
    };
    const g = geoMassa(r, seme + i * 31, 0.22, det === 'alto' && r > rx * 0.3 ? 1 : 1, 0.82);
    b.aggiungi(g, { matrice: mat(c, [0, rng.next() * 6, 0]), colore: fn });
  }

  // amenti a ciuffi sulla chioma in fioritura
  if (stagione === 'fioritura' && det === 'alto') {
    const ciuffo = geoMasso(0.16, seme, 0.2, 0, 1);
    ciuffo.scale(0.8, 2.2, 0.8);
    for (let k = 0; k < 40; k++) {
      const m = centri[k % centri.length] as { c: THREE.Vector3; r: number };
      const dir = new THREE.Vector3(rng.centrato(1), rng.tra(-0.1, 1), rng.centrato(1)).normalize();
      const p = m.c.clone().addScaledVector(dir, m.r * 0.92);
      b.aggiungi(ciuffo, {
        matrice: mat(p, [rng.centrato(0.6), rng.next() * 6, rng.centrato(0.6)]),
        colore: PALETTE.amenti,
        variazione: 0.08,
        piatto: true,
      });
    }
  }

  // ricci e foglie a terra in autunno
  if ((opz.ricci ?? stagione === 'autunno') && det === 'alto') {
    for (let k = 0; k < 9; k++) {
      const a = rng.next() * Math.PI * 2;
      const d = rTronco * 2 + rng.next() * rx * 0.9;
      b.aggiungi(geoMasso(0.07, rng.intero(0, 1e6), 0.5, 0, 1), {
        matrice: mat([Math.cos(a) * d, 0.04, Math.sin(a) * d]),
        colore: rng.prob(0.5) ? 0x9a8a3a : 0x7a5530,
        piatto: true,
      });
    }
  }

  const gruppo = b.costruisci('castagno');
  const collider: Collider[] = [cil(0, -0.6, 0, rTronco * 1.15, hFusto + 0.6, 'tronco')];
  return risultato({
    nome: 'castagno',
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti: { chioma: cChioma, tronco: new THREE.Vector3(0, 0, 0) },
  });
}

export interface OpzioniCastagnoMorto {
  seme?: Seme;
  altezza?: number;
  /** aggiunge la botola della Cripta fra le radici */
  cripta?: boolean;
  /** stato iniziale della botola */
  apertaAllInizio?: boolean;
}

export interface StatoBotola {
  /** la botola deve essere aperta? (l'animazione la porta lì in ~1.5 s) */
  aperta: boolean;
}

/** Castagno morto, eventualmente con la botola della Cripta fra le radici. */
export function creaCastagnoMorto(opz: OpzioniCastagnoMorto = {}): OggettoProcedurale<StatoBotola> {
  const seme = semeNumerico(opz.seme ?? 'castagno-morto');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const H = opz.altezza ?? rng.tra(9, 12);
  const rT = H * 0.08;
  const hFusto = H * 0.42;
  const col = corteccia(PALETTE.troncoMorto, PALETTE.troncoMortoScuro, seme, H);

  // fusto spaccato: due metà divaricate in cima
  const nA = 7;
  const fase = rng.next() * 6;
  const pts: THREE.Vector3[] = [];
  const raggi: number[] = [];
  for (let i = 0; i < nA; i++) {
    const t = i / (nA - 1);
    pts.push(new THREE.Vector3(Math.sin(t * 2.2) * 0.25, -0.5 + t * (hFusto + 0.5), Math.cos(t * 1.7) * 0.15 - 0.15));
    raggi.push(rT * (1 + 0.6 * Math.pow(1 - t, 3)) * (1 - t * 0.25));
  }
  b.aggiungi(
    geoTubo(pts, raggi, 8, {
      chiudiFine: true,
      fase,
      forma: (i, a) => 1 + Math.pow(Math.max(0, Math.cos(a * 5 + fase)), 2) * 0.5 * Math.pow(1 - i / (nA - 1), 2) + Math.sin(a * 2 + i) * 0.06,
    }),
    { colore: col },
  );
  // cavità scura sul fusto (spacco)
  const cav = geoMasso(rT * 0.55, seme + 3, 0.2, 0, 1);
  cav.scale(0.6, 2.4, 0.35);
  b.aggiungi(cav, { matrice: mat([0, hFusto * 0.45, rT * 0.95], [0, 0, 0.1]), colore: PALETTE.troncoScuro, piatto: true });

  // rami ricorsivi
  const cima = pts[nA - 1] as THREE.Vector3;
  const rami = (inizio: THREE.Vector3, dir: THREE.Vector3, lung: number, r0: number, livello: number): void => {
    const fine = inizio.clone().addScaledVector(dir, lung);
    const p = percorsoTorto(rng, inizio, fine, livello === 0 ? 5 : 4, 0.1);
    const rr = p.map((_, i) => r0 * (1 - (i / (p.length - 1)) * 0.65));
    b.aggiungi(geoTubo(p, rr, livello === 0 ? 6 : 5, { chiudiFine: true }), { colore: col });
    if (livello >= 2) return;
    const nFigli = livello === 0 ? rng.intero(2, 3) : rng.intero(1, 3);
    for (let k = 0; k < nFigli; k++) {
      const t = rng.tra(0.55, 0.95);
      const da = (p[Math.floor(t * (p.length - 1))] as THREE.Vector3).clone();
      const nd = dir
        .clone()
        .add(new THREE.Vector3(rng.centrato(0.9), rng.tra(-0.1, 0.5), rng.centrato(0.9)))
        .normalize();
      rami(da, nd, lung * rng.tra(0.45, 0.7), r0 * 0.5, livello + 1);
    }
  };
  const nPrincipali = rng.intero(3, 4);
  for (let k = 0; k < nPrincipali; k++) {
    const a = (k / nPrincipali) * Math.PI * 2 + rng.centrato(0.4);
    const dir = new THREE.Vector3(Math.cos(a) * 0.7, rng.tra(0.55, 1.0), Math.sin(a) * 0.7).normalize();
    rami(cima.clone().add(new THREE.Vector3(0, -0.4, 0)), dir, H * rng.tra(0.3, 0.42), rT * 0.55, 0);
  }
  // moncone spezzato
  b.aggiungi(geoTubo([cima.clone(), cima.clone().add(new THREE.Vector3(0.2, 1.1, -0.1))], [rT * 0.7, rT * 0.45], 6, { chiudiFine: true }), { colore: col });

  // radici scoperte che strisciano sul terreno
  const nRadici = 6;
  const angoliRadici: number[] = [];
  for (let k = 0; k < nRadici; k++) {
    const a = (k / nRadici) * Math.PI * 2 + rng.centrato(0.25) + (opz.cripta ? 0.5 : 0);
    angoliRadici.push(a);
    const l = rng.tra(2.2, 3.6);
    const p: THREE.Vector3[] = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const d = rT * 0.6 + t * l;
      p.push(new THREE.Vector3(Math.cos(a + Math.sin(t * 3) * 0.15) * d, 0.9 * Math.pow(1 - t, 2) + 0.05 - t * 0.25, Math.sin(a + Math.sin(t * 3) * 0.15) * d));
    }
    b.aggiungi(geoTubo(p, [rT * 0.5, rT * 0.38, rT * 0.26, rT * 0.16, rT * 0.06], 5, { chiudiFine: true }), { colore: col });
  }

  const collider: Collider[] = [cil(0, -0.5, 0, rT * 1.2, hFusto + 0.5, 'tronco')];
  const punti: Record<string, THREE.Vector3> = { tronco: new THREE.Vector3() };
  const gruppo = b.costruisci('castagno-morto');

  let update: ((dt: number, stato?: StatoBotola) => void) | undefined;
  if (opz.cripta) {
    // la botola sta fra due radici, verso +Z
    const botola = creaBotolaCripta({ seme: seme + 1, apertaAllInizio: opz.apertaAllInizio ?? false });
    const pos = new THREE.Vector3(0.3, 0, rT * 0.6 + 1.9);
    botola.gruppo.position.copy(pos);
    botola.gruppo.rotation.y = 0.15;
    gruppo.add(botola.gruppo);
    for (const c of botola.collider) {
      if (c.tipo === 'box') collider.push({ ...c, centro: [c.centro[0] + pos.x, c.centro[1], c.centro[2] + pos.z], rotY: (c.rotY ?? 0) + 0.15 });
      else collider.push({ ...c, base: [c.base[0] + pos.x, c.base[1], c.base[2] + pos.z] });
    }
    for (const [k, v] of Object.entries(botola.punti)) punti[k] = v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.15).add(pos);
    update = (dt, stato) => botola.update?.(dt, stato);
  }
  return risultato<StatoBotola>({
    nome: 'castagno-morto',
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti,
    ...(update ? { update } : {}),
  });
}

export interface OpzioniBotola {
  seme?: Seme;
  apertaAllInizio?: boolean;
}

/**
 * Botola di pietra della Cripta: telaio di lastre, coperchio di pietra cerchiato di ferro con
 * borchie e anello, pozzo scuro con i pioli di una scala. Cerniera sul lato −Z; si apre verso −Z.
 * update(dt, { aperta }) anima l'apertura.
 */
export function creaBotolaCripta(opz: OpzioniBotola = {}): OggettoProcedurale<StatoBotola> {
  const seme = semeNumerico(opz.seme ?? 'botola');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const L = 1.1; // luce dell'apertura
  // telaio di quattro lastre
  const lastre: Array<[number, number, number, number]> = [
    [0, -(L / 2 + 0.25), L + 1.0, 0.5],
    [0, L / 2 + 0.25, L + 1.0, 0.5],
    [-(L / 2 + 0.25), 0, 0.5, L],
    [L / 2 + 0.25, 0, 0.5, L],
  ];
  for (const [x, z, w, d] of lastre) {
    b.aggiungi(geoLastra(w, 0.3, d, rng.intero(0, 1e6), 0.06), {
      matrice: mat([x, -0.22, z], [0, rng.centrato(0.03), 0]),
      colore: mescola(PALETTE.gneiss, PALETTE.muschio, rng.next() * 0.25),
      variazione: 0.06,
      gradiente: { basso: 0.8, alto: 1.05, y0: -0.2, y1: 0.08 },
      piatto: true,
    });
  }
  // pozzo
  for (const [x, z, w, d] of [
    [0, -L / 2 - 0.05, L, 0.1],
    [0, L / 2 + 0.05, L, 0.1],
    [-L / 2 - 0.05, 0, 0.1, L],
    [L / 2 + 0.05, 0, 0.1, L],
  ] as const) {
    b.aggiungi(geoBoxC(w, 2.4, d), { matrice: mat([x, -1.25, z]), colore: 0x2a2622, gradiente: { basso: 0.2, alto: 1, y0: -2.4, y1: 0 }, piatto: true });
  }
  b.aggiungi(geoBoxC(L, 0.1, L), { matrice: mat([0, -2.4, 0]), colore: 0x0c0b0d, piatto: true });
  // pioli della scala sul lato +Z
  for (let i = 0; i < 6; i++) {
    const y = -0.35 - i * 0.32;
    b.aggiungi(geoBoxC(0.5, 0.04, 0.04), { matrice: mat([0, y, L / 2 - 0.08]), colore: PALETTE.ferro, piatto: true });
    for (const s of [-1, 1]) b.aggiungi(geoBoxC(0.04, 0.04, 0.1), { matrice: mat([s * 0.25, y, L / 2 - 0.03]), colore: PALETTE.ferro, piatto: true });
  }
  const statica = b.costruisci('botola');

  // coperchio (pivot sulla cerniera, lato −Z)
  const bc = new Costruttore(rng.derivato('coperchio'));
  const lc = L + 0.16;
  bc.aggiungi(geoLastra(lc, 0.16, lc, rng.intero(0, 1e6), 0.03), {
    matrice: mat([0, 0, lc / 2]),
    colore: PALETTE.gneissScuro,
    variazione: 0.05,
    rumore: 0.05,
    piatto: true,
  });
  // cerchiatura di ferro con borchie
  for (const [x, z, w, d] of [
    [0, 0.04, lc + 0.04, 0.1],
    [0, lc - 0.04, lc + 0.04, 0.1],
    [-lc / 2, lc / 2, 0.1, lc],
    [lc / 2, lc / 2, 0.1, lc],
    [0, lc / 2, lc, 0.08],
  ] as const) {
    bc.aggiungi(geoBoxC(w, 0.04, d), { matrice: mat([x, 0.17, z]), colore: PALETTE.ferro, gradiente: { basso: 1, alto: 1, y0: 0, y1: 1 }, piatto: true });
  }
  for (let i = 0; i < 6; i++) {
    for (const z of [0.04, lc - 0.04]) {
      const x = -lc / 2 + 0.1 + (i * (lc - 0.2)) / 5;
      bc.aggiungi(geoSfera(0.025, 5, 3), { matrice: mat([x, 0.19, z]), colore: PALETTE.ferroChiaro });
    }
  }
  // cerniere e anello
  for (const s of [-1, 1]) bc.aggiungi(geoCilindro(0.05, 0.05, 0.22, 6), { matrice: mat([s * 0.35, 0.06, -0.02], [0, 0, Math.PI / 2]), colore: PALETTE.ferro });
  bc.aggiungi(geoToro(0.09, 0.016, 4, 10), { matrice: mat([0, 0.2, lc - 0.22], [Math.PI / 2 - 0.3, 0, 0]), colore: PALETTE.ferroChiaro });
  const coperchio = bc.costruisci('botola-coperchio');
  const perno = new THREE.Group();
  perno.name = 'botola-cerniera';
  perno.position.set(0, 0.0, -lc / 2);
  perno.add(coperchio);

  const gruppo = new THREE.Group();
  gruppo.add(statica);
  gruppo.add(perno);
  let angolo = opz.apertaAllInizio ? 1 : 0;
  const ANGOLO_APERTO = THREE.MathUtils.degToRad(-112);
  perno.rotation.x = angolo * ANGOLO_APERTO;
  const update = (dt: number, stato?: StatoBotola) => {
    const obiettivo = stato?.aperta ? 1 : 0;
    angolo = smorza(angolo, obiettivo, 3.2, dt);
    perno.rotation.x = angolo * ANGOLO_APERTO;
  };
  return risultato<StatoBotola>({
    nome: 'botola-cripta',
    seme,
    gruppo,
    collider: [box(0, -0.1, 0, L / 2 + 0.5, 0.15, L / 2 + 0.5, 'botola')],
    ingombro: ingombroDa(gruppo),
    punti: { botola: new THREE.Vector3(0, 0.1, 0), scala: new THREE.Vector3(0, -0.3, L / 2 - 0.15) },
    update,
  });
}
