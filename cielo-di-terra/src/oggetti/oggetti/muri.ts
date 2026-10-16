/**
 * Muri a secco delle terrazze (segmenti componibili lungo una curva), scalette di pietra e cancelli di legno.
 *
 * Muro: il percorso è una spezzata in pianta (x, z); la faccia a vista guarda a destra del verso di
 * percorrenza (per un percorso lungo +X guarda +Z). Due segmenti con estremi coincidenti si uniscono
 * senza fughe. Con `terrapieno` il retro è considerato interrato (muro di sostegno di una terrazza).
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola, type FnColore } from '../costruttore';
import { box, cil, ingombroDa, risultato, smorza } from '../comune';
import { geoBoxC, geoCiuffo, geoCilindro, geoLastra } from '../forme';
import { PALETTE } from '../palette';
import { Rng, hashPosizione, semeNumerico, type Seme } from '../rng';
import { SUP } from '../superfici';
import type { Collider, OggettoProcedurale } from '../tipi';

export interface OpzioniMuro {
  seme?: Seme;
  /** spezzata in pianta [x, z]; se assente si usa un arco di `lunghezza` e `raggioCurva` */
  percorso?: Array<[number, number]>;
  lunghezza?: number;
  /** raggio di curvatura dell'arco (positivo: concavo verso la faccia; 0 o assente = dritto) */
  raggioCurva?: number;
  altezza?: number;
  spessore?: number;
  /** inclinazione della faccia (rientro orizzontale per metro di altezza) */
  scarpa?: number;
  /** muro di sostegno: copertina a filo della terrazza superiore, retro non a vista */
  terrapieno?: boolean;
  /** dimensione media delle pietre (m); più grande = meno triangoli */
  pietra?: number;
  /** 'basso': niente pietre in rilievo, solo campiture per pietra (pochi triangoli) */
  dettaglio?: 'alto' | 'basso';
  interrata?: number;
}

interface Campione {
  p: THREE.Vector3;
  t: THREE.Vector3;
  n: THREE.Vector3;
  s: number;
}

/** Ricampiona una spezzata ogni `passo` metri, con tangenti e normali (faccia a destra). */
function campiona(punti: THREE.Vector3[], passo: number): Campione[] {
  const lunghezze: number[] = [0];
  for (let i = 1; i < punti.length; i++) lunghezze.push((lunghezze[i - 1] as number) + (punti[i] as THREE.Vector3).distanceTo(punti[i - 1] as THREE.Vector3));
  const tot = lunghezze[lunghezze.length - 1] as number;
  const n = Math.max(1, Math.round(tot / passo));
  const out: Campione[] = [];
  let seg = 0;
  for (let k = 0; k <= n; k++) {
    const s = (k / n) * tot;
    while (seg < punti.length - 2 && (lunghezze[seg + 1] as number) < s) seg++;
    const a = punti[seg] as THREE.Vector3;
    const b = punti[seg + 1] as THREE.Vector3;
    const l0 = lunghezze[seg] as number;
    const l1 = lunghezze[seg + 1] as number;
    const t = (s - l0) / (l1 - l0 || 1);
    const p = a.clone().lerp(b, t);
    // tangente media agli spigoli
    const ta = b.clone().sub(a).normalize();
    let tt = ta;
    if (t > 0.999 && seg < punti.length - 2) tt = ta.clone().add((punti[seg + 2] as THREE.Vector3).clone().sub(b).normalize()).normalize();
    if (t < 0.001 && seg > 0) tt = ta.clone().add(a.clone().sub(punti[seg - 1] as THREE.Vector3).normalize()).normalize();
    out.push({ p, t: tt, n: new THREE.Vector3(-tt.z, 0, tt.x), s });
  }
  return out;
}

/** Punto alla lunghezza s lungo i campioni (interpolazione lineare). */
function aLunghezza(c: Campione[], s: number): Campione {
  if (s <= 0) return c[0] as Campione;
  for (let i = 1; i < c.length; i++) {
    const b = c[i] as Campione;
    if (b.s >= s) {
      const a = c[i - 1] as Campione;
      const t = (s - a.s) / (b.s - a.s || 1);
      const tt = a.t.clone().lerp(b.t, t).normalize();
      return { p: a.p.clone().lerp(b.p, t), t: tt, n: new THREE.Vector3(-tt.z, 0, tt.x), s };
    }
  }
  return c[c.length - 1] as Campione;
}

/** Percorso ad arco (o dritto) centrato nell'origine, lungo X. */
function percorsoArco(L: number, R: number): THREE.Vector3[] {
  if (!R || Math.abs(R) > 1e4) return [new THREE.Vector3(-L / 2, 0, 0), new THREE.Vector3(L / 2, 0, 0)];
  const ang = L / R;
  const n = Math.max(3, Math.ceil(Math.abs(ang) / 0.12));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -ang / 2 + (i / n) * ang;
    // centro di curvatura sul lato della faccia (+Z) per R > 0
    pts.push(new THREE.Vector3(Math.sin(a) * R, 0, R - Math.cos(a) * R));
  }
  return pts;
}

/**
 * Colore per vertice di una pietra di testa: calcare chiaro sopra (licheni, una macchia di muschio
 * dal lato a monte), più scuro e caldo sui fianchi e sotto.
 */
function coloreTesta(sopra: THREE.Color, fianco: THREE.Color, muschio: THREE.Color, quantoMuschio: number, _seme: number): FnColore {
  // (rifinitura 2: niente più macchie per vertice, chiare o scure: su una pietra di 20 triangoli
  // disegnavano schegge di vetro dai bordi neri. Licheni e muschio fini li dipinge SASSO)
  return (p, n, out) => {
    out.copy(fianco).lerp(sopra, THREE.MathUtils.smoothstep(n.y, -0.1, 0.75));
    if (quantoMuschio > 0) out.lerp(muschio, quantoMuschio * THREE.MathUtils.smoothstep(n.y, 0.3, 0.9) * THREE.MathUtils.smoothstep(-p.z, -0.02, 0.06));
  };
}

/**
 * Sasso di testa: una cupola irregolare a base piatta (anello di 8 vertici a terra, anello di 8 a
 * metà altezza un po' rientrato, cima), 24 triangoli a vertici condivisi: con le normali morbide
 * è un calcare tondeggiante. (Rifinitura 2: era un icosaedro schiacciato, 20 facce, che di taglio e
 * al tramonto sembrava una scaglia piatta dagli spigoli netti.)
 */
function sassoTesta(seme: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const j = (k: number) => hashPosizione(k * 1.37, seme * 0.01, k * 0.73, seme) - 0.5;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + j(i) * 0.3;
    const r = 1 + j(i + 10) * 0.22;
    pos.push(Math.cos(a) * r, -0.15, Math.sin(a) * r);
  }
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2 + j(i + 20) * 0.3;
    const r = 0.8 + j(i + 30) * 0.18;
    pos.push(Math.cos(a) * r, 0.62 + j(i + 40) * 0.2, Math.sin(a) * r);
  }
  pos.push(j(50) * 0.3, 1.0 + j(51) * 0.15, j(52) * 0.3);
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i;
    const b = (i + 1) % n;
    const c = n + i;
    const d = n + ((i + 1) % n);
    idx.push(a, c, b, b, c, d);
    idx.push(c, 2 * n, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Pietra della faccia a vista: un blocco smussato (smusso di 2-3 cm, normali morbide) che sporge
 * di `d` dal corpo del muro. Anello esterno sul corpo, anello interno rientrato dello smusso, faccia
 * davanti appena bombata: 10 triangoli. Il giunto è il corpo scuro che si vede fra le pietre (un
 * incavo vero), non un triangolo disegnato.
 */
function pietraSmussata(w: number, h: number, d: number, seme: number, irr: number): THREE.BufferGeometry {
  const j = (k: number) => (hashPosizione(k, seme, 0.5, seme) - 0.5) * irr;
  const sm = Math.min(0.03, w * 0.2, h * 0.22);
  const x0 = -w / 2;
  const x1 = w / 2;
  // angoli un po' irregolari (pietra spaccata, non mattone)
  const est: Array<[number, number]> = [
    [x0 + j(1) * w, j(2) * h],
    [x1 + j(3) * w, j(4) * h],
    [x1 + j(5) * w, h + j(6) * h],
    [x0 + j(7) * w, h + j(8) * h],
  ];
  const cx = (est[0]![0] + est[1]![0] + est[2]![0] + est[3]![0]) / 4;
  const cy = (est[0]![1] + est[1]![1] + est[2]![1] + est[3]![1]) / 4;
  const pos: number[] = [];
  for (const [x, y] of est) pos.push(x, y, 0);
  for (const [x, y] of est) {
    // anello interno: rientra dello smusso verso il centro, sporge quasi tutto
    const dx = cx - x;
    const dy = cy - y;
    const l = Math.hypot(dx, dy) || 1;
    pos.push(x + (dx / l) * sm * 1.3, y + (dy / l) * sm * 1.3, d * (0.9 + j(9 + x) * 0.08));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // smusso (anello esterno -> interno) e faccia davanti
  g.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7, 4, 5, 6, 4, 6, 7]);
  return g;
}

const C_MUSCHIO = new THREE.Color(0x6f7a3e);
const C_LICHENE = new THREE.Color(0xc0a868);

/**
 * Colore di una pietra della faccia (uno per pietra: un colore per vertice disegnerebbe triangoli):
 * gneiss chiaro, licheni ocra, muschio. Le macchie fini e il muschio sulle facce in su li dipinge
 * il motivo SASSO nello shader.
 */
function colorePietra(base: THREE.Color, muschio: number, lichene: number): THREE.Color {
  const out = base.clone();
  if (muschio > 0) out.lerp(C_MUSCHIO, muschio * 0.45);
  if (lichene > 0) out.lerp(C_LICHENE, lichene);
  return out;
}

/**
 * Pietra a vista del muro a dettaglio basso (i gradoni del paese, anche da vicino): un cuscino col
 * centro in fuori e i punti di mezzo dei lati sollevati, a vertici condivisi (normali morbide: una
 * pietra tonda, non quattro schegge), 6 triangoli.
 */
function pietraCuscino(w: number, h: number, sporge: number, seme: number): THREE.BufferGeometry {
  const j = (k: number) => (hashPosizione(k, seme, 0.5, seme) - 0.5) * 0.18;
  const x0 = -w / 2;
  const x1 = w / 2;
  const v: Array<[number, number, number]> = [
    [x0 + j(1) * w, j(2) * h, 0],
    [x1 + j(3) * w, j(4) * h, 0],
    [x1 + j(5) * w, h + j(6) * h, 0],
    [x0 + j(7) * w, h + j(8) * h, 0],
  ];
  const cx = j(9) * w * 0.6;
  const cy = h * (0.5 + j(10));
  // (rifinitura 2) i punti di mezzo dei lati lunghi (sotto e sopra), sollevati più di metà: il
  // cuscino ha il dorso tondo, non quattro falde piatte che di taglio sembravano schegge
  for (const k of [0, 2]) {
    const a = v[k]!;
    const b = v[(k + 1) % 4]!;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    v.push([mx + (cx - mx) * 0.15, my + (cy - my) * 0.15, sporge * 0.6]);
  }
  v.push([cx, cy, sporge]);
  const pos: number[] = [];
  for (const p of v) pos.push(...p);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // 0-1 sotto (mezzo 4), 1-2 destra, 2-3 sopra (mezzo 5), 3-0 sinistra; 6 = centro
  g.setIndex([0, 4, 6, 4, 1, 6, 1, 2, 6, 2, 5, 6, 5, 3, 6, 3, 0, 6]);
  return g;
}

/** Muro a secco lungo un percorso. */
export function creaMuroSecco(opz: OpzioniMuro = {}): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? 'muro');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const H = opz.altezza ?? 1.6;
  const sp = opz.spessore ?? 0.6;
  const scarpa = opz.scarpa ?? 0.12;
  const interr = opz.interrata ?? 0.4;
  const pietra = opz.pietra ?? 0.5;
  const det = opz.dettaglio ?? 'alto';
  const punti = opz.percorso ? opz.percorso.map(([x, z]) => new THREE.Vector3(x, 0, z)) : percorsoArco(opz.lunghezza ?? 8, opz.raggioCurva ?? 0);
  const camp = campiona(punti, 0.5);
  const L = (camp[camp.length - 1] as Campione).s;
  const tono = mescola(PALETTE.gneiss, PALETTE.gneissViola, rng.next() * 0.5);

  // corpo del muro: nastro con sezione trapezia (scuro: le fughe fra le pietre)
  const pos: number[] = [];
  const idx: number[] = [];
  const sezione: Array<[number, number]> = [
    [0, -interr], // piede della faccia
    [-scarpa * H, H], // testa della faccia
    [-sp, H], // testa del retro
    [-sp - (opz.terrapieno ? 0.3 : -scarpa * H * 0.5), -interr], // piede del retro
  ];
  for (const c of camp) {
    for (const [o, y] of sezione) pos.push(c.p.x + c.n.x * o, y, c.p.z + c.n.z * o);
  }
  const ns = sezione.length;
  for (let i = 0; i < camp.length - 1; i++) {
    for (let k = 0; k < ns; k++) {
      const a = i * ns + k;
      const bb = i * ns + ((k + 1) % ns);
      const c = (i + 1) * ns + k;
      const d = (i + 1) * ns + ((k + 1) % ns);
      idx.push(a, c, bb, bb, c, d);
    }
  }
  // tappi alle estremità
  for (const [i, verso] of [[0, -1], [camp.length - 1, 1]] as const) {
    const o = i * ns;
    if (verso < 0) idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    else idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
  }
  const corpo = new THREE.BufferGeometry();
  corpo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  corpo.setIndex(idx);
  // (il corpo si vede nei giunti: scuro, ma non nero)
  b.aggiungi(corpo, { colore: mescola(tono, 0x2b2620, 0.42), piatto: true });

  // pietre della faccia a corsi orizzontali (pietre lunghe 1,5-3 volte l'altezza, qualche zeppa
  // piccola fra l'una e l'altra), di gneiss chiaro con licheni ocra e muschio sopra (bozzetto 2)
  const facce = opz.terrapieno ? [1] : [1, -1];
  const gneissMuro = new THREE.Color(0xb8b2a4);
  for (const lato of facce) {
    let y = -interr * 0.5;
    let corso = 0;
    while (y < H - 0.12) {
      const hc = Math.min(H - y, pietra * rng.tra(0.4, 0.56));
      if (hc < 0.08) break;
      let s = corso % 2 === 0 ? 0 : -pietra * 0.45;
      while (s < L) {
        // zeppa: una scaglia piccola e bassa fra due pietre (una su dieci)
        const zeppa = det === 'alto' && rng.prob(0.1);
        const lw = zeppa ? pietra * rng.tra(0.22, 0.36) : Math.max(hc * 1.7, Math.min(hc * 3.1, pietra * rng.tra(1.1, 1.9)));
        const s0 = Math.max(0, s);
        const s1 = Math.min(L, s + lw);
        if (s1 - s0 > 0.08) {
          const sm = (s0 + s1) / 2;
          const c = aLunghezza(camp, sm);
          const yy = y + hc / 2;
          // rientro della scarpa alla quota della pietra
          const off = lato > 0 ? -scarpa * Math.max(0, yy) + 0.02 : -sp - 0.02 + (opz.terrapieno ? 0 : scarpa * Math.max(0, yy) * 0.5);
          const centro = c.p.clone().addScaledVector(c.n, off);
          const ang = Math.atan2(-c.t.z, c.t.x);
          let colore = mescola(tono, rng.prob(0.5) ? PALETTE.gneissChiaro : rng.prob(0.5) ? PALETTE.gneissScuro : PALETTE.gneissCaldo, rng.next() * 0.55);
          // licheni gialli e muschio su qualche pietra (più in basso, dove resta l'umido)
          if (rng.prob(0.14)) colore = mescola(colore, 0xb3a86e, rng.tra(0.25, 0.5));
          else if (yy < H * 0.35 && rng.prob(0.18)) colore = mescola(colore, PALETTE.muschio, rng.tra(0.2, 0.45));
          // valore proprio di ogni pietra (±12%, da un hash: la posa delle pietre non cambia)
          const valore = 0.88 + 0.24 * hashPosizione(sm * 3.1, yy * 7.3, lato, seme);
          if (det === 'alto') {
            const base = new THREE.Color(colore).lerp(gneissMuro, 0.42).multiplyScalar(valore);
            const hz = zeppa ? hc * rng.tra(0.35, 0.55) : hc - 0.04;
            const yz = zeppa ? y + (hc - hz) * rng.next() : y + 0.02;
            const mp = mat([centro.x, yz, centro.z], [lato > 0 ? -scarpa * 0.8 : scarpa * 0.4, ang + (lato > 0 ? 0 : Math.PI), rng.centrato(0.05)]);
            const fronte = new THREE.Vector3(0, 0, 1).transformDirection(mp);
            b.aggiungi(pietraSmussata(s1 - s0 - 0.04, hz, zeppa ? 0.04 : rng.tra(0.06, 0.09), rng.intero(0, 1e6), 0.1), {
              matrice: mp,
              // muschio sulle facce in alto di una pietra su cinque, licheni ocra su qualcuna
              colore: colorePietra(base, rng.prob(0.2) ? rng.tra(0.35, 0.7) : 0, rng.prob(0.15) ? rng.tra(0.2, 0.4) : 0),
              variazione: 0.07,
              // un solo sasso: faccia scagliata, licheni e muschio, niente giunti disegnati dentro
              superficie: SUP.SASSO,
              // il bordo della pietra (lo smusso, che guarda di lato) in ombra: il giunto si legge per incavo
              occlusione: (_p, n) => Math.min(0.5, Math.max(0.04, (0.95 - n.dot(fronte)) * 1.1)),
            });
          } else {
            const mp = mat([centro.x + c.n.x * 0.01 * lato, y + 0.015, centro.z + c.n.z * 0.01 * lato], [lato > 0 ? -scarpa : scarpa * 0.5, ang + (lato > 0 ? 0 : Math.PI), 0]);
            const fronte = new THREE.Vector3(0, 0, 1).transformDirection(mp);
            b.aggiungi(pietraCuscino(s1 - s0 - 0.04, hc - 0.04, 0.07, rng.intero(0, 1e6)), {
              matrice: mp,
              colore: new THREE.Color(colore).lerp(gneissMuro, 0.38).multiplyScalar(valore),
              variazione: 0.07,
              superficie: SUP.SASSO,
              occlusione: (_p, n) => Math.min(0.45, Math.max(0.04, (0.97 - n.dot(fronte)) * 1.3)),
            });
          }
        }
        s += lw;
      }
      y += hc;
      corso++;
    }
  }

  // testa del muro: pietre di coronamento irregolari e proporzionate, dello stesso tono del muro
  // (non lastre lunghe e chiare). Nel muro di sostegno la testa sta sul davanti: dietro c'è la
  // terra della terrazza; nel muro libero copre tutto lo spessore.
  {
    // (calcare chiaro e tondeggiante come nel bozzetto 2: le facce lisce e chiare non prendono
    // il motivo della pietra a giunti, che disegnerebbe pietre dentro le pietre)
    const prof = opz.terrapieno ? Math.min(0.62, sp * 0.85) : sp + 0.06;
    const muschio = new THREE.Color(PALETTE.muschio);
    let s = 0;
    while (s < L) {
      const lw = Math.min(L - s, pietra * rng.tra(0.55, 1.25));
      if (lw < 0.12) break;
      const c = aLunghezza(camp, s + lw / 2);
      const off = opz.terrapieno ? -scarpa * H - prof / 2 + 0.06 : -scarpa * H * 0.5 - sp / 2 + 0.02;
      const centro = c.p.clone().addScaledVector(c.n, off);
      const ang = Math.atan2(-c.t.z, c.t.x);
      // lastre piatte e sassi tondi, qualcuno di coltello: la testa non è una fila di cuscini uguali
      const forma = rng.next();
      const alt = forma < 0.3 ? rng.tra(0.09, 0.14) : forma > 0.85 ? rng.tra(0.28, 0.36) : rng.tra(0.16, 0.24);
      const fianco = mescola(tono, rng.prob(0.5) ? PALETTE.gneissScuro : PALETTE.gneissCaldo, 0.3 + rng.next() * 0.4);
      // (rifinitura 2: sopra calcare caldo, #b0a68e, col suo valore; prima gneiss ×0,8, che di sera
      // si faceva lilla)
      const sopra = mescola(0xb0a68e, rng.prob(0.5) ? PALETTE.gneissCaldo : PALETTE.gneiss, rng.next() * 0.35).multiplyScalar(0.9 + rng.next() * 0.14);
      // (muschio su una testa su cinque, leggero: sul dorso tondo il muschio di SASSO basta)
      const colore = coloreTesta(sopra, fianco, muschio, rng.prob(0.2) ? rng.tra(0.2, 0.45) : 0, rng.intero(0, 1e6));
      const larg = forma > 0.85 ? lw * 0.42 : lw * 0.62;
      b.aggiungi(sassoTesta(rng.intero(0, 1e6)), {
        matrice: mat([centro.x, H - 0.03 - alt * 0.15, centro.z], [rng.centrato(0.1), ang + rng.centrato(0.3), rng.centrato(0.1)], [larg, alt * 0.75, prof * rng.tra(0.45, 0.58)]),
        colore,
        variazione: 0.05,
        // faccia scagliata, licheni e muschio dipinti (niente giunti dentro), piede in ombra
        superficie: SUP.SASSO,
        occlusione: (p) => Math.max(0, 0.35 - (p.y + 0.15) * 0.6),
      });
      s += lw;
    }
  }
  // muschio e ciuffi d'erba sulla testa e al piede (solo da vicino)
  if (det === 'alto') {
    const n = Math.round(L / 1.4);
    for (let k = 0; k < n; k++) {
      const c = aLunghezza(camp, rng.next() * L);
      const ang = Math.atan2(-c.t.z, c.t.x);
      const sopra = rng.prob(0.6);
      const y = sopra ? H + 0.08 : -0.02;
      const off = sopra ? (opz.terrapieno ? -scarpa * H - rng.tra(0.1, 0.5) : -scarpa * H * 0.5 - sp * rng.tra(0.2, 0.8)) : rng.tra(0.02, 0.14);
      const p = c.p.clone().addScaledVector(c.n, off);
      const erba = sopra && rng.prob(0.5);
      const g = geoCiuffo(erba ? 0.16 : 0.13, rng.intero(0, 1e6), erba ? 1.8 : 0.45);
      b.aggiungi(g, {
        matrice: mat([p.x, y, p.z], [0, ang + rng.next() * 3, 0], [rng.tra(1, 2.2), 1, rng.tra(0.8, 1.4)]),
        colore: erba ? (rng.prob(0.5) ? 0x9a8a48 : 0x6d7a3c) : PALETTE.muschio,
        variazione: 0.12,
        piatto: true,
      });
    }
  }

  // collider: box orientati ogni ~2 m
  const collider: Collider[] = [];
  const nC = Math.max(1, Math.round(L / 2));
  for (let k = 0; k < nC; k++) {
    const a = aLunghezza(camp, (k * L) / nC);
    const bb = aLunghezza(camp, ((k + 1) * L) / nC);
    const m = a.p.clone().add(bb.p).multiplyScalar(0.5);
    const d = bb.p.clone().sub(a.p);
    const nn = new THREE.Vector3(-d.z, 0, d.x).normalize();
    const centro = m.addScaledVector(nn, -sp / 2 - scarpa * H * 0.25);
    collider.push(box(centro.x, (H - interr) / 2, centro.z, d.length() / 2 + 0.02, (H + interr) / 2, sp / 2 + scarpa * H * 0.25, 'arrampicabile', Math.atan2(-d.z, d.x)));
  }
  const gruppo = b.costruisci('muro-secco');
  const inizio = camp[0] as Campione;
  const fine = camp[camp.length - 1] as Campione;
  return risultato({
    nome: 'muro-secco',
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti: {
      inizio: inizio.p.clone(),
      fine: fine.p.clone(),
      // punto di partenza per planare: in cima al centro del muro
      cima: aLunghezza(camp, L / 2).p.clone().setY(H),
    },
  });
}

export interface OpzioniScaletta {
  seme?: Seme;
  /** 'gradini': rampa massiccia; 'sbalzo': pietre sporgenti da murare in una faccia (faccia a z = 0, sporgono verso +Z) */
  tipo?: 'gradini' | 'sbalzo';
  gradini?: number;
  alzata?: number;
  pedata?: number;
  larghezza?: number;
  /** muretti laterali (solo 'gradini') */
  spallette?: boolean;
}

/** Scaletta di pietra. La rampa sale verso −Z (si parte da z = 0 e si sale allontanandosi). */
export function creaScaletta(opz: OpzioniScaletta = {}): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? 'scaletta');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const tipo = opz.tipo ?? 'gradini';
  const n = opz.gradini ?? 7;
  const alz = opz.alzata ?? 0.22;
  const ped = opz.pedata ?? 0.34;
  const lw = opz.larghezza ?? (tipo === 'gradini' ? 1.1 : 0.55);
  const collider: Collider[] = [];
  if (tipo === 'gradini') {
    for (let i = 0; i < n; i++) {
      const z = -i * ped - ped / 2;
      const y = (i + 1) * alz;
      b.aggiungi(geoLastra(lw + rng.centrato(0.08), 0.1, ped + 0.08, rng.intero(0, 1e6), 0.1), {
        matrice: mat([rng.centrato(0.03), y - 0.1, z], [0, rng.centrato(0.04), 0]),
        colore: mescola(PALETTE.gneissChiaro, PALETTE.gneiss, rng.next() * 0.6),
        variazione: 0.06,
        piatto: true,
      });
      b.aggiungi(geoBoxC(lw - 0.06, y - 0.1 + 0.3, ped), {
        matrice: mat([0, (y - 0.1 - 0.3) / 2, z]),
        colore: mescola(PALETTE.gneiss, 0x2b2620, 0.35),
        gradiente: { basso: 0.7, alto: 1, y0: 0, y1: n * alz },
        piatto: true,
      });
      collider.push(box(0, (y - 0.3) / 2, z, lw / 2, (y + 0.3) / 2, ped / 2, 'scala'));
    }
    if (opz.spallette ?? true) {
      for (const s of [-1, 1]) {
        for (let i = 0; i < n; i += 2) {
          const z = -i * ped - ped;
          const y = (i + 2) * alz;
          b.aggiungi(geoLastra(0.3, y + 0.25, ped * 2, rng.intero(0, 1e6), 0.06), {
            matrice: mat([s * (lw / 2 + 0.15), -0.3, z]),
            colore: mescola(PALETTE.gneiss, PALETTE.gneissViola, rng.next() * 0.5),
            gradiente: { basso: 0.75, alto: 1.05, y0: 0, y1: n * alz },
            variazione: 0.05,
            piatto: true,
          });
        }
      }
    }
  } else {
    // pietre a sbalzo che salgono in diagonale lungo X
    for (let i = 0; i < n; i++) {
      const x = i * 0.42;
      const y = (i + 1) * alz * 1.25;
      b.aggiungi(geoLastra(lw, 0.12, ped + 0.25, rng.intero(0, 1e6), 0.12), {
        matrice: mat([x, y - 0.12, ped / 2 - 0.12], [rng.centrato(0.03), rng.centrato(0.06), rng.centrato(0.03)]),
        colore: mescola(PALETTE.gneissChiaro, PALETTE.gneissCaldo, rng.next() * 0.5),
        variazione: 0.06,
        piatto: true,
      });
      collider.push(box(x, y - 0.06, ped / 2, lw / 2, 0.06, ped / 2, 'scala'));
    }
  }
  const gruppo = b.costruisci('scaletta');
  return risultato({
    nome: 'scaletta',
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti: {
      piede: new THREE.Vector3(0, 0, tipo === 'gradini' ? 0.4 : ped + 0.3),
      cima: tipo === 'gradini' ? new THREE.Vector3(0, n * alz, -n * ped) : new THREE.Vector3((n - 1) * 0.42, n * alz * 1.25, ped / 2),
    },
  });
}

export interface OpzioniCancello {
  seme?: Seme;
  larghezza?: number;
  altezza?: number;
  /** pilastri di pietra o pali di legno */
  pilastri?: 'pietra' | 'legno';
  /** apertura iniziale (0 chiuso, 1 aperto a 100°) */
  apertura?: number;
}

export interface StatoCancello {
  aperto: boolean;
}

/** Cancello di legno ad assi con saetta diagonale, fra due pilastri. Cerniera sul pilastro sinistro (−X). */
export function creaCancello(opz: OpzioniCancello = {}): OggettoProcedurale<StatoCancello> {
  const seme = semeNumerico(opz.seme ?? 'cancello');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const W = opz.larghezza ?? 1.4;
  const H = opz.altezza ?? 1.15;
  const pil = opz.pilastri ?? 'pietra';
  const collider: Collider[] = [];
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.22);
    if (pil === 'pietra') {
      b.aggiungi(geoLastra(0.4, H + 0.6, 0.4, rng.intero(0, 1e6), 0.05), {
        matrice: mat([x, -0.3, 0]),
        colore: mescola(PALETTE.gneiss, PALETTE.gneissViola, rng.next() * 0.4),
        gradiente: { basso: 0.75, alto: 1.05, y0: 0, y1: H + 0.3 },
        variazione: 0.05,
        piatto: true,
      });
      b.aggiungi(geoLastra(0.5, 0.1, 0.5, rng.intero(0, 1e6), 0.1), { matrice: mat([x, H + 0.3, 0]), colore: PALETTE.gneissChiaro, piatto: true });
      collider.push(box(x, (H + 0.1) / 2, 0, 0.2, (H + 0.7) / 2, 0.2, 'muro'));
    } else {
      b.aggiungi(geoCilindro(0.09, 0.11, H + 0.6, 7), { matrice: mat([x, -0.3, 0]), colore: PALETTE.legnoGrigio, gradiente: { basso: 0.7, alto: 1, y0: 0, y1: H } });
      collider.push(cil(x, -0.3, 0, 0.11, H + 0.6, 'muro'));
    }
  }
  const statico = b.costruisci('cancello');

  // anta: pivot sulla cerniera
  const ba = new Costruttore(rng.derivato('anta'));
  const legno = rng.scegli([PALETTE.legnoGrigio, PALETTE.legnoVecchio, PALETTE.legno]);
  const wa = W - 0.04;
  const na = Math.round(wa / 0.16);
  for (let i = 0; i < na; i++) {
    const x = 0.02 + ((i + 0.5) * wa) / na;
    const hh = H - 0.12 + Math.sin(((i + 0.5) / na) * Math.PI) * 0.08 + rng.centrato(0.02);
    ba.aggiungi(geoBoxC(wa / na - 0.025, hh, 0.03), {
      matrice: mat([x, 0.08 + hh / 2, 0]),
      colore: mescola(legno, 0xffffff, rng.next() * 0.1),
      variazione: 0.07,
      gradiente: { basso: 0.85, alto: 1.05, y0: 0, y1: H },
      piatto: true,
    });
  }
  for (const y of [0.25, H - 0.25]) {
    ba.aggiungi(geoBoxC(wa, 0.1, 0.04), { matrice: mat([wa / 2 + 0.02, y, 0.035]), colore: mescola(legno, 0x000000, 0.15), piatto: true });
  }
  const diag = Math.hypot(wa - 0.1, H - 0.5);
  ba.aggiungi(geoBoxC(diag, 0.09, 0.04), {
    matrice: mat([wa / 2 + 0.02, H / 2, 0.035], [0, 0, Math.atan2(H - 0.5, wa - 0.1)]),
    colore: mescola(legno, 0x000000, 0.15),
    piatto: true,
  });
  for (const y of [0.25, H - 0.25]) ba.aggiungi(geoBoxC(0.3, 0.05, 0.02), { matrice: mat([0.15, y, 0.06]), colore: PALETTE.ferro, piatto: true });
  const anta = ba.costruisci('cancello-anta');
  const perno = new THREE.Group();
  perno.name = 'cancello-cerniera';
  perno.position.set(-W / 2, 0, 0);
  perno.add(anta);
  const gruppo = new THREE.Group();
  gruppo.add(statico, perno);
  let apertura = opz.apertura ?? 0;
  const MAX = THREE.MathUtils.degToRad(100);
  perno.rotation.y = apertura * MAX;
  collider.push(box(0, H / 2, 0, W / 2, H / 2, 0.05, 'cancello'));
  return risultato<StatoCancello>({
    nome: 'cancello',
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti: { cerniera: new THREE.Vector3(-W / 2, 0, 0), passaggio: new THREE.Vector3(0, 0, 0) },
    update: (dt, stato) => {
      if (!stato) return;
      apertura = smorza(apertura, stato.aperto ? 1 : 0, 2.5, dt);
      perno.rotation.y = apertura * MAX;
    },
  });
}
