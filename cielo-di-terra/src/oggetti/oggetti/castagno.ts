/**
 * Castagni delle Selve:
 * - castagno secolare vivo: tronco largo e torto con le radici a contrafforte, poche branche grosse,
 *   chioma a masse tondeggianti a tre toni (estate, autunno, fioritura con gli amenti color crema);
 * - castagno morto: tronco grigio spaccato, rami spogli e nodosi, radici scoperte;
 * - botola di pietra della Cripta fra le radici del castagno morto (apribile, animata).
 */
import * as THREE from 'three';
import { Costruttore, mat, matSegmento, mescola, type FnColore } from '../costruttore';
import { box, cil, ingombroDa, risultato, smorza } from '../comune';
import { geoBoxC, geoCiuffo, geoCilindro, geoLastra, geoMassa, geoMasso, geoSfera, geoToro, geoTubo } from '../forme';
import { PALETTE } from '../palette';
import { SUP } from '../superfici';
import { hashPosizione, Rng, semeNumerico, type Seme } from '../rng';
import type { Collider, OggettoProcedurale } from '../tipi';

/** Il nucleo in ombra della chioma vista da vicino (sotto i ciuffi di foglie). */
const OLIVA = new THREE.Color(0.26, 0.33, 0.12);

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
  const rTronco = H * rng.tra(0.075, 0.095);
  const hFusto = H * rng.tra(0.22, 0.28);

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
  const corteccia1 = corteccia(0x7a6553, 0x4a3a2e, seme, H);
  b.aggiungi(
    geoTubo(pts, raggi, 9, {
      chiudiFine: true,
      fase,
      forma: (i, a) => {
        const t = i / (nAnelli - 1);
        const l = Math.pow(Math.max(0, Math.cos(a * lobi + fase)), 2);
        const torto = Math.pow(Math.max(0, Math.cos(a * 2 + fase + i * 0.45)), 3) * 0.12;
        return 1 + l * 0.55 * Math.pow(1 - t, 2) + torto + Math.sin(a * 3 + i * 0.9) * 0.05;
      },
    }),
    { colore: corteccia1 },
  );

  // masse della chioma (da vicino più numerose e più piccole: la chioma si legge a ciuffi, non a palle)
  const nMasse = opz.masse ?? (det === 'alto' ? Math.round(rng.tra(12, 15)) : Math.round(rng.tra(8, 11)));
  const kMassa = det === 'alto' && opz.masse === undefined ? 0.84 : 1;
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
      r = (basso ? rx * rng.tra(0.36, 0.46) : rx * rng.tra(0.38, 0.48)) * kMassa;
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
    // in autunno più della metà delle masse resta verde (l'ottobre dei bozzetti: verde, oro e
    // ruggine accostati, non palle arancioni)
    const mixVerde = stagione === 'autunno' ? (det === 'alto' ? (rng.next() < 0.55 ? rng.tra(0.7, 0.95) : rng.tra(0, 0.3)) : Math.max(0, rng.next() - 0.45) * 1.2) : 0;
    const tintaMassa = rng.centrato(0.05);
    const fn: FnColore = (p, n, out) => {
      const altezza = THREE.MathUtils.clamp((p.y - yMin) / (yMax - yMin), 0, 1);
      // occlusione: i vertici verso l'interno della chioma (fra le masse) sono più scuri
      const dx = (p.x - cChioma.x) / rx;
      const dy = (p.y - cChioma.y) / (ry * 1.2);
      const dz = (p.z - cChioma.z) / rx;
      const esterno = THREE.MathUtils.smoothstep(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.45, 1.05);
      const t = THREE.MathUtils.clamp(n.y * 0.3 + 0.2 + altezza * 0.35 + esterno * 0.3 + (hashPosizione(p.x, p.y, p.z, seme) - 0.5) * 0.05, 0, 1);
      if (t < 0.5) out.copy(cScuro).lerp(cMedio, t / 0.5);
      else out.copy(cMedio).lerp(cChiaro, (t - 0.5) / 0.5);
      // (da vicino le masse sono il corpo della chioma sotto le foglie: appena più scure, non palle
      // scure lisce: il motivo FOGLIAME ci dipinge le masse di foglie)
      out.multiplyScalar((0.72 + 0.28 * esterno) * (det === 'alto' ? 0.88 : 1));
      if (mixVerde > 0) out.lerp(new THREE.Color(verdi[t < 0.5 ? 0 : 1]), mixVerde);
      out.r *= 1 + tintaMassa;
      out.b *= 1 - tintaMassa;
      // da vicino il nucleo sotto i ciuffi è verde oliva in ombra: col verde che prevale la superficie
      // AUTO lo dipinge a ciuffi di fogliame (bruno-arancio diventerebbe corteccia liscia)
      if (det === 'alto') out.lerp(OLIVA, 0.3);
      if (stagione === 'fioritura' && n.y > -0.1 && hashPosizione(p.x * 1.7, p.y * 1.7, p.z * 1.7, seme + 5) > 0.72) out.lerp(amenti, 0.75);
    };
    const dettaglioMassa = 1;
    // (da vicino le masse sono il nucleo sotto i ciuffi di foglie: più piccole, i ciuffi fanno la sagoma)
    const g = geoMassa(det === 'alto' ? r * 0.86 : r, seme + i * 31, det === 'alto' ? 0.28 : 0.16, dettaglioMassa, 0.84, 0.7);
    // fogliame dichiarato (non dedotto dal colore: le masse d'autunno, oro e ruggine, restano foglie)
    b.aggiungi(g, { matrice: mat(c, [0, rng.next() * 6, 0]), colore: fn, superficie: SUP.FOGLIAME });
  }

  // ciuffi di foglie sul contorno della chioma (solo da vicino): foglie lanceolate a ventaglio, a
  // doppia faccia, con la normale della chioma intera (la luce gira la chioma come un volume unico).
  // Rompono la sagoma liscia delle masse come le pennellate dei bozzetti; le masse sotto diventano
  // l'interno in ombra della chioma.
  if (det === 'alto') {
    const pos: number[] = [];
    const nor: number[] = [];
    const col: number[] = [];
    const tinte = stagione === 'autunno' ? [tavolozza[1], tavolozza[2], verdi[1], tavolozza[0], verdi[2], verdi[1], verdi[0], tavolozza[2]] : [tavolozza[1], tavolozza[2], tavolozza[1], tavolozza[0]];
    const cc = new THREE.Color();
    const cBase = new THREE.Color();
    const nC = new THREE.Vector3();
    const v = new THREE.Vector3();
    const ciuffi = Math.round(560 * Math.min(1.15, larg / 11));
    let fatti = 0;
    for (let tent = 0; tent < ciuffi * 20 && fatti < ciuffi; tent++) {
      const m = centri[rng.intero(0, centri.length - 2)] as { c: THREE.Vector3; r: number };
      const dir = new THREE.Vector3(rng.centrato(1), rng.tra(-0.55, 1), rng.centrato(1));
      if (dir.lengthSq() < 0.05) continue;
      dir.normalize();
      const p = m.c.clone().addScaledVector(dir, m.r * rng.tra(0.86, 1.02));
      // solo sul contorno della chioma: niente ciuffi sepolti nelle altre masse
      if (centri.some((o) => o !== m && o.c.distanceTo(p) < o.r * 0.9)) continue;
      fatti++;
      nC.set((p.x - cChioma.x) / rx, ((p.y - cChioma.y) / ry) * 0.8, (p.z - cChioma.z) / rx).normalize().lerp(dir, 0.3).normalize();
      cc.set(tinte[rng.intero(0, tinte.length - 1)]!).multiplyScalar(rng.tra(0.85, 1.1));
      cBase.copy(cc).multiplyScalar(0.62);
      // piano del ciuffo: quasi tangente alla chioma, un po' inclinato
      const t1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
      if (t1.lengthSq() < 1e-3) t1.set(1, 0, 0);
      t1.normalize();
      const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();
      // quattro foglie per ciuffo, ognuna col suo verso, la sua inclinazione e il suo attacco (niente
      // ventaglio a stella); lunghe 28-42 cm (le foglie vere sono 15-20 cm, ma qui una foglia fa anche
      // da gruppo di foglie: la tessitura fine la dipinge il motivo FOGLIAME delle masse)
      const nFoglie = 4;
      for (let f = 0; f < nFoglie; f++) {
        const a = rng.next() * Math.PI * 2;
        const df = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a)).addScaledVector(dir, rng.tra(0.2, 0.9)).normalize();
        // le foglie pendono un poco
        df.y -= rng.tra(0.15, 0.45);
        df.normalize();
        const len = rng.tra(0.32, 0.48);
        const lat = new THREE.Vector3().crossVectors(df, dir).normalize().multiplyScalar(len * 0.16);
        const attacco = p.clone().addScaledVector(t1, rng.centrato(0.22)).addScaledVector(t2, rng.centrato(0.22));
        const b0 = attacco.clone().addScaledVector(df, 0.02);
        const punta = attacco.clone().addScaledVector(df, len);
        const mezzo = attacco.clone().addScaledVector(df, len * 0.42);
        const sx = mezzo.clone().add(lat);
        const dx = mezzo.clone().sub(lat);
        for (const [q, c] of [
          [b0, cBase],
          [sx, cc],
          [punta, cc],
          [b0, cBase],
          [punta, cc],
          [dx, cc],
        ] as const) {
          v.copy(q);
          pos.push(v.x, v.y, v.z);
          nor.push(nC.x, nC.y, nC.z);
          col.push(c.r, c.g, c.b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    b.aggiungi(g, { colore: 'geometria', canale: 'sottile' });
  }

  // amenti a ciuffi sulla chioma in fioritura
  if (stagione === 'fioritura' && det === 'alto') {
    const ciuffo = geoCiuffo(0.17, seme, 1);
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
      b.aggiungi(geoCiuffo(0.07, rng.intero(0, 1e6), 0.8), {
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

/**
 * Castagno morto (secolare, come quello del bozzetto 1), eventualmente con la botola della Cripta
 * fra le radici:
 * - fusto largo e torto con le radici a contrafforte, i solchi verticali della corteccia che girano
 *   col tronco, la cavità scura; legno grigio argento dove la corteccia è caduta, muschio al piede
 *   dal lato in ombra e licheni sulle facce in su;
 * - quattro branche che si aprono a coppa e salgono torcendosi, poi rami e ramoscelli sempre più
 *   sottili fino a punte di pochi centimetri (niente monconi tagliati a sega), qualche ramo spezzato;
 * - radici scoperte che strisciano e affondano nel terreno.
 * Triangoli: ~3700 (con la botola resta sotto 5000).
 */
export function creaCastagnoMorto(opz: OpzioniCastagnoMorto = {}): OggettoProcedurale<StatoBotola> {
  const seme = semeNumerico(opz.seme ?? 'castagno-morto');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const H = opz.altezza ?? rng.tra(9, 12);
  const rT = H * 0.08;
  const hFusto = H * 0.4;
  const BUDGET = 3500;

  // corteccia: solchi scuri e creste chiare (grigio argento del legno morto), muschio al piede dal
  // lato in ombra (-Z), licheni chiari sulle facce in su. Toni sotto ~0.52 di luminanza: il
  // materiale del mondo li legge come CORTECCIA (motivo dei solchi).
  const cCresta = new THREE.Color(0x8e857b);
  const cSolco = new THREE.Color(0x3f3730);
  const cLegno = new THREE.Color(0x9a9286);
  const cMuschio = new THREE.Color(0x6c7243);
  const cLichene = new THREE.Color(0xa49f84);
  const fase = rng.next() * 6.28;
  const corteccia: FnColore = (p, n, out) => {
    const ang = Math.atan2(p.z, p.x);
    // solchi che girano col tronco (torsione) e si interrompono a placche
    const solco = Math.abs(Math.sin(ang * 6.5 + p.y * 0.55 + fase + Math.sin(p.y * 1.7 + ang * 2) * 0.6));
    const placche = hashPosizione(Math.round(ang * 3) / 3, Math.round(p.y * 1.2) / 1.2, 0, seme);
    const k = Math.pow(solco, 0.7) * (0.75 + 0.35 * placche);
    out.copy(cSolco).lerp(cCresta, Math.min(1, k));
    // legno nudo (la corteccia è caduta) sui rami alti e a chiazze sul fusto
    const nudo = p.y > hFusto * 0.9 ? 0.35 + 0.4 * hashPosizione(Math.round(p.x * 2), Math.round(p.y * 2), Math.round(p.z * 2), seme + 5) : placche > 0.86 ? 0.6 : 0;
    out.lerp(cLegno, nudo * 0.7);
    // muschio al piede dal lato in ombra e sulle radici
    const piede = 1 - THREE.MathUtils.smoothstep(p.y, 0.2, 1.9);
    const ombra = THREE.MathUtils.smoothstep(-p.z / (Math.hypot(p.x, p.z) + 1e-3), -0.3, 0.6);
    out.lerp(cMuschio, piede * (0.35 + 0.45 * ombra) * (0.7 + 0.3 * placche));
    // licheni sulle facce in su dei rami
    if (n.y > 0.55 && p.y > hFusto * 0.8) out.lerp(cLichene, (n.y - 0.55) * 0.9 * placche);
  };

  // ---- fusto con le radici a contrafforte, i solchi e la torsione
  const nA = 10;
  const lobi = rng.intero(5, 6);
  const pende = new THREE.Vector3(rng.centrato(0.5), 0, rng.centrato(0.5));
  const pts: THREE.Vector3[] = [];
  const raggi: number[] = [];
  for (let i = 0; i < nA; i++) {
    const t = i / (nA - 1);
    pts.push(new THREE.Vector3(pende.x * t * t + Math.sin(t * 2.4) * 0.12, -0.6 + t * (hFusto + 0.9), pende.z * t * t + Math.cos(t * 1.9) * 0.1 - 0.1));
    raggi.push(rT * (1 + 0.75 * Math.pow(1 - t, 3.2)) * (1 - t * 0.12) * (t > 0.85 ? 1.08 : 1));
  }
  b.aggiungi(
    geoTubo(pts, raggi, 16, {
      chiudiFine: true,
      fase,
      forma: (i, a) => {
        const t = i / (nA - 1);
        // contrafforti in basso, solchi verticali che girano col tronco
        const contr = Math.pow(Math.max(0, Math.cos(a * lobi + fase + t * 0.8)), 2.2) * 0.75 * Math.pow(1 - t, 2.4);
        const solco = -Math.pow(Math.abs(Math.sin(a * 6.5 + t * 3.2 + fase)), 6) * 0.07;
        const nodo = Math.sin(a * 2 + i * 0.9) * 0.05;
        return 1 + contr + solco + nodo;
      },
    }),
    { colore: corteccia },
  );
  // cavità scura sul fusto (il castagno è cavo: ci si vede il buio dentro)
  const cav = geoMasso(rT * 0.5, seme + 3, 0.22, 1, 1);
  cav.scale(0.5, 1.7, 0.32);
  b.aggiungi(cav, { matrice: mat([pts[3]!.x * 0.6 + rT * 0.15, hFusto * 0.42, rT * 1.02 + pts[3]!.z * 0.5], [0, -0.15, 0.08]), colore: 0x1a1512, piatto: true });
  // labbro della cavità (legno chiaro attorno al buio)
  const lab = geoMasso(rT * 0.5, seme + 4, 0.18, 1, 1);
  lab.scale(0.66, 1.9, 0.26);
  b.aggiungi(lab, { matrice: mat([pts[3]!.x * 0.6 + rT * 0.15, hFusto * 0.42, rT * 0.96 + pts[3]!.z * 0.5], [0, -0.15, 0.08]), colore: 0x8a8074, piatto: true });

  // ---- branche, rami e ramoscelli
  const cima = pts[nA - 1]!.clone();
  const _q = new THREE.Quaternion();
  const _asse = new THREE.Vector3();
  const giraVerso = (d: THREE.Vector3, angolo: number, rnd: number): THREE.Vector3 => {
    // ruota d di 'angolo' attorno a un asse perpendicolare scelto a caso
    const ref = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    _asse.crossVectors(d, ref).normalize().applyAxisAngle(d, rnd * Math.PI * 2);
    _q.setFromAxisAngle(_asse, angolo);
    return d.clone().applyQuaternion(_q);
  };
  const LIVELLI = [
    { punti: 6, lati: 8, figli: [3, 3] as const, angolo: [0.45, 0.8] as const },
    { punti: 5, lati: 6, figli: [2, 3] as const, angolo: [0.5, 0.85] as const },
    { punti: 4, lati: 4, figli: [1, 2] as const, angolo: [0.5, 0.9] as const },
    { punti: 3, lati: 4, figli: [0, 0] as const, angolo: [0, 0] as const },
  ];
  const ramo = (p0: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, livello: number): void => {
    const L = LIVELLI[livello]!;
    if (livello >= 1 && b.triangoli() > tetto - (livello === 1 ? 100 : 0)) return;
    const n = L.punti;
    const p: THREE.Vector3[] = [p0.clone()];
    const d = dir.clone().normalize();
    const passo = len / (n - 1);
    for (let i = 1; i < n; i++) {
      // il ramo serpeggia; le branche si aprono verso l'esterno e poi risalgono (coppa)
      d.add(new THREE.Vector3(rng.centrato(0.36), rng.centrato(0.22), rng.centrato(0.36)));
      if (livello === 0) {
        const fuori = new THREE.Vector3(d.x, 0, d.z).normalize();
        d.addScaledVector(fuori, i < 3 ? 0.18 : -0.04).add(new THREE.Vector3(0, i < 3 ? -0.05 : 0.1, 0));
      } else d.y += 0.05;
      d.normalize();
      p.push(p[i - 1]!.clone().addScaledVector(d, passo));
    }
    // spezzato: un ramo su sette finisce in un moncone (legno chiaro), niente figli
    const spezzato = livello === 1 && rng.prob(0.15);
    const fine = livello === LIVELLI.length - 1 ? 0.012 : spezzato ? r0 * 0.5 : r0 * 0.28;
    const rr = p.map((_, i) => {
      const t = i / (n - 1);
      return THREE.MathUtils.lerp(r0, fine, Math.pow(t, 0.85));
    });
    b.aggiungi(geoTubo(p, rr, L.lati, { chiudiFine: true }), { colore: corteccia });
    if (spezzato) {
      b.aggiungi(geoCilindro(fine * 0.95, fine * 0.6, fine * 1.2, 5), { matrice: matSegmento(p[n - 1]!, p[n - 1]!.clone().addScaledVector(d, fine * 1.2)), colore: 0xb3a998 });
      return;
    }
    const nf = rng.intero(L.figli[0], L.figli[1]);
    for (let k = 0; k < nf; k++) {
      const t = rng.tra(0.38, 0.92);
      const fi = t * (n - 1);
      const i0 = Math.min(n - 2, Math.floor(fi));
      const q = p[i0]!.clone().lerp(p[i0 + 1]!, fi - i0);
      const rq = THREE.MathUtils.lerp(rr[i0]!, rr[i0 + 1]!, fi - i0);
      const dq = p[i0 + 1]!.clone().sub(p[i0]!).normalize();
      const nd = giraVerso(dq, rng.tra(L.angolo[0], L.angolo[1]), rng.next());
      nd.y = Math.max(nd.y, -0.25);
      ramo(q, nd, len * rng.tra(0.5, 0.68) * (1.1 - t * 0.3), rq * 0.68, livello + 1);
    }
    // l'ultimo tratto prosegue sottile (la punta del ramo)
    if (livello < LIVELLI.length - 1) ramo(p[n - 1]!, d, len * 0.42, fine, livello + 1);
  };
  const nBranche = 4;
  // ogni branca ha la sua parte di triangoli (la ricorsione è in profondità: senza tetto
  // l'ultima branca resterebbe spoglia)
  let tetto = BUDGET;
  for (let k = 0; k < nBranche; k++) {
    const a = (k / nBranche) * Math.PI * 2 + fase * 0.3 + rng.centrato(0.45);
    const dir = new THREE.Vector3(Math.cos(a) * 0.62, rng.tra(0.65, 0.95), Math.sin(a) * 0.62).normalize();
    const p0 = cima.clone().add(new THREE.Vector3(Math.cos(a) * rT * 0.25, -0.7 - rng.next() * 0.5, Math.sin(a) * rT * 0.25));
    tetto = b.triangoli() + (BUDGET - b.triangoli()) / (nBranche - k);
    ramo(p0, dir, H * rng.tra(0.36, 0.46), rT * rng.tra(0.5, 0.62), 0);
  }

  // ---- radici scoperte che strisciano e affondano
  const nRadici = 7;
  for (let k = 0; k < nRadici; k++) {
    const a = (k / nRadici) * Math.PI * 2 + fase + rng.centrato(0.25) + (opz.cripta ? 0.5 : 0);
    const l = rng.tra(2.0, 3.8);
    const p: THREE.Vector3[] = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const d = rT * 0.55 + t * l;
      const aa = a + Math.sin(t * 3 + k) * 0.18;
      p.push(new THREE.Vector3(Math.cos(aa) * d, 0.95 * Math.pow(1 - t, 2) + 0.06 - t * 0.32, Math.sin(aa) * d));
    }
    b.aggiungi(geoTubo(p, [rT * 0.52, rT * 0.38, rT * 0.25, rT * 0.15, rT * 0.05], 6, { chiudiFine: true }), { colore: corteccia });
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
  /** quadrato nero sulla bocca del pozzo (predefinito sì) */
  boccaBuia?: boolean;
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
    // (x, z, larghezza, profondità) delle quattro lastre del telaio
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
  // bocca buia appena sopra il suolo: nasconde il terreno se il motore non vi apre un foro
  // (si vede solo dall'alto; disattivabile con boccaBuia: false quando il terreno ha il foro)
  if (opz.boccaBuia ?? true) {
    const bocca = new THREE.PlaneGeometry(L + 0.02, L + 0.02);
    bocca.rotateX(-Math.PI / 2);
    b.aggiungi(bocca, { matrice: mat([0, 0.025, 0]), colore: 0x0b0a0c, piatto: true });
  }
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
  for (const z of [0.25, lc - 0.25]) {
    bc.aggiungi(geoBoxC(lc - 0.1, 0.03, 0.08), { matrice: mat([0, -0.012, z]), colore: PALETTE.ferro, piatto: true });
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
  let obiettivo = angolo;
  const ANGOLO_APERTO = THREE.MathUtils.degToRad(-112);
  perno.rotation.x = angolo * ANGOLO_APERTO;
  const update = (dt: number, stato?: StatoBotola) => {
    if (stato) obiettivo = stato.aperta ? 1 : 0;
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
