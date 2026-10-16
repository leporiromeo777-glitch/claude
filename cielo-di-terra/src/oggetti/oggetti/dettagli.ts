/**
 * Dettagli architettonici condivisi da rustici, fienili, campanile e chiesa:
 * muri di pietra con le aperture vere (finestrelle strombate, porte incassate), finestre con
 * davanzale, architrave e persiane di legno, gerani, porte di larice, balconi e lobbie, camini con
 * la piota, cantonali di pietra, travi di gronda e tetti di piode spessi.
 *
 * Ogni pezzo dichiara la sua superficie dipinta (`superficie`, vedi `../superfici.ts`): pietra,
 * piode, legno (assi verticali o orizzontali), intonaco, ferro, vetro. Le occlusioni cotte
 * scuriscono gli incavi (strombature, sotto le gronde, al piede dei muri).
 *
 * Le «facciate» sono sistemi di riferimento: x lungo la facciata, y in su, z verso l'esterno,
 * origine sulla superficie del muro alla quota y = 0 dell'oggetto.
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola } from '../costruttore';
import { geoBoxC, geoCiuffo, geoEstrusione, geoLastra, geoPiano } from '../forme';
import { PALETTE } from '../palette';
import type { Rng } from '../rng';
import { SUP, legnoOrizzontale, legnoVerticale, sup } from '../superfici';
import type { PortaOggetto } from '../tipi';

/** Sistema di riferimento di una facciata: centro (cx, cz) sul muro, rotY tale che +Z locale esca dal muro. */
export function facciata(cx: number, cz: number, rotY: number, y = 0): THREE.Matrix4 {
  return mat([cx, y, cz], [0, rotY, 0]);
}

/** Matrice di un elemento in coordinate di facciata (u lungo il muro, v quota, w sporgenza). */
export function inF(f: THREE.Matrix4, u: number, v: number, w: number, rot: [number, number, number] = [0, 0, 0], scala: number | [number, number, number] = 1): THREE.Matrix4 {
  return f.clone().multiply(mat([u, v, w], rot, scala));
}

/** Colori delle persiane e delle ante: verde salvia, noce, grigio-azzurro, larice, grigio. */
export const COLORI_ANTE = [0x5b6b4a, 0x6b4a33, 0x4f5f66, 0x7a5a3a, 0x86745a] as const;

/** Spessore dei muri di pietra dei rustici (m). */
export const SPESSORE_MURO = 0.46;

/** Rettangolo di un'apertura in coordinate di facciata: [u0, v0, u1, v1]. */
export type Foro = [number, number, number, number];

export interface OpzioniFinestra {
  larghezza: number;
  altezza: number;
  /** colore delle ante (null = senza ante) */
  ante?: number | null;
  /** contorno dipinto a calce attorno alla finestra */
  contornoCalce?: boolean;
  gerani?: boolean;
  /** finestra accesa di notte */
  accesa?: boolean;
  /** inferriata invece della crociera di legno (pianterreno, stalle) */
  inferriata?: boolean;
}

/** Vetro (canale lume: buio di giorno, caldo di notte se acceso). */
function vetro(b: Costruttore, m: THREE.Matrix4, w: number, h: number, v: number, accesa: boolean | undefined): void {
  const rng = b.rng;
  b.aggiungi(geoPiano(w, h), {
    matrice: m,
    colore: accesa ? mescola(PALETTE.finestraAccesa, PALETTE.lumeArancio, rng.next() * 0.4) : PALETTE.finestraBuia,
    canale: 'lume',
    gradiente: accesa ? { basso: 1.1, alto: 0.75, y0: v, y1: v + h } : { basso: 1, alto: 1.3, y0: v, y1: v + h },
    superficie: SUP.VETRO,
  });
}

/**
 * Finestra rettangolare appoggiata alla facciata (senza foro nel muro: timpani di legno, fienili,
 * casupole) con architrave, davanzale, crociera, ante e gerani facoltativi. v = quota del davanzale.
 */
export function finestra(b: Costruttore, f: THREE.Matrix4, u: number, v: number, o: OpzioniFinestra): void {
  const w = o.larghezza;
  const h = o.altezza;
  const rng = b.rng;
  if (o.contornoCalce) {
    b.aggiungi(geoBoxC(w + 0.34, h + 0.36, 0.02), {
      matrice: inF(f, u, v + h / 2 + 0.02, 0.005),
      colore: PALETTE.calce,
      variazione: 0.04,
      piatto: true,
      superficie: sup(SUP.INTONACO, rng.next()),
    });
  }
  // telaio scuro attorno al vetro (dà profondità anche senza foro)
  b.aggiungi(geoBoxC(w + 0.1, h + 0.1, 0.04), { matrice: inF(f, u, v + h / 2, 0.01), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoVerticale(0.3), occlusione: 0.2 });
  vetro(b, inF(f, u, v + h / 2, 0.035), w, h, v, o.accesa);
  // crociera o inferriata
  if (o.inferriata) {
    const n = Math.max(2, Math.round(w / 0.16));
    for (let i = 1; i < n; i++) {
      b.aggiungi(geoBoxC(0.025, h, 0.025), { matrice: inF(f, u - w / 2 + (i * w) / n, v + h / 2, 0.06), colore: PALETTE.ferro, piatto: true, superficie: SUP.METALLO });
    }
  } else {
    b.aggiungi(geoBoxC(0.05, h, 0.025), { matrice: inF(f, u, v + h / 2, 0.045), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoVerticale(0.2) });
    b.aggiungi(geoBoxC(w, 0.05, 0.025), { matrice: inF(f, u, v + h * 0.58, 0.047), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoOrizzontale(0.2) });
  }
  // architrave e davanzale in pietra
  b.aggiungi(geoLastra(w + 0.36, 0.17, 0.14, rng.intero(0, 1e6), 0.1), {
    matrice: inF(f, u, v + h + 0.04, 0.04),
    colore: PALETTE.gneissChiaro,
    variazione: 0.06,
    piatto: true,
    superficie: sup(SUP.PIETRA, rng.next()),
  });
  b.aggiungi(geoLastra(w + 0.24, 0.07, 0.22, rng.intero(0, 1e6), 0.1), {
    matrice: inF(f, u, v - 0.07, 0.07),
    colore: PALETTE.gneissChiaro,
    variazione: 0.06,
    piatto: true,
    superficie: sup(SUP.PIETRA, rng.next()),
  });
  if (o.ante !== undefined && o.ante !== null) persiane(b, f, u, v, w, h, o.ante, 0.02);
  if (o.gerani) gerani(b, f, u, v, w + 0.12);
}

/** Foro nel muro di una finestrella strombata (davanzale a v, luce w×h). */
export function foroFinestra(u: number, v: number, w: number, h: number): Foro {
  const s = strombo(w);
  return [u - w / 2 - s, v - 0.03, u + w / 2 + s, v + h + s * 0.8];
}

/** Quanto si allarga la strombatura sul filo del muro (m per lato). */
function strombo(w: number): number {
  return Math.min(0.16, 0.08 + w * 0.12);
}

/**
 * Finestrella strombata nel foro di un muro spesso (`foroFinestra`): le spallette si allargano
 * verso l'esterno (calce o pietra), il telaio e il vetro stanno in fondo, con la crociera o
 * l'inferriata; davanzale di pietra sporgente, architrave di legno o di pietra, persiane di legno
 * aperte contro il muro, gerani. v = quota del davanzale (luce del vetro), w×h la luce.
 */
export function finestraIncassata(b: Costruttore, f: THREE.Matrix4, u: number, v: number, o: OpzioniFinestra & { profondita?: number; architraveLegno?: boolean }): void {
  const w = o.larghezza;
  const h = o.altezza;
  const rng = b.rng;
  const [u0, v0, u1, v1] = foroFinestra(u, v, w, h);
  const d = o.profondita ?? 0.24;
  // spallette strombate: quattro trapezi dal filo del muro (foro) al telaio (luce), più scuri in fondo
  const coloreSp = o.contornoCalce ? PALETTE.calce : mescola(PALETTE.gneissChiaro, PALETTE.gneiss, 0.4);
  const supSp = o.contornoCalce ? sup(SUP.INTONACO, rng.next()) : sup(SUP.PIETRA, rng.next());
  const est = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ] as const;
  const int = [
    [u - w / 2, v],
    [u + w / 2, v],
    [u + w / 2, v + h],
    [u - w / 2, v + h],
  ] as const;
  // due triangoli per spalletta, rivolti verso il vano; l'occlusione cresce verso il telaio
  const pos: number[] = [];
  const sp: number[] = [];
  for (let k = 0; k < 4; k++) {
    const a = est[k]!;
    const bb = est[(k + 1) % 4]!;
    const c = int[(k + 1) % 4]!;
    const dd = int[k]!;
    pos.push(a[0], a[1], 0.002, bb[0], bb[1], 0.002, c[0], c[1], -d);
    pos.push(a[0], a[1], 0.002, c[0], c[1], -d, dd[0], dd[1], -d);
    for (const o of [0.04, 0.04, 0.4, 0.04, 0.4, 0.4]) sp.push(supSp, o);
  }
  const gS = new THREE.BufferGeometry();
  gS.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gS.setAttribute('aSuperficie', new THREE.Float32BufferAttribute(sp, 2));
  b.aggiungi(gS, { matrice: f, colore: coloreSp, variazione: 0.03, piatto: true });
  // telaio, vetro e crociera (o inferriata) in fondo
  const ft = inF(f, 0, 0, -d);
  b.aggiungi(geoBoxC(w + 0.04, 0.07, 0.07), { matrice: inF(ft, u, v + 0.035, 0.035), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoOrizzontale(0.1), occlusione: 0.3 });
  b.aggiungi(geoBoxC(w + 0.04, 0.07, 0.07), { matrice: inF(ft, u, v + h - 0.035, 0.035), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoOrizzontale(0.1), occlusione: 0.35 });
  for (const sx of [-1, 1]) b.aggiungi(geoBoxC(0.07, h, 0.07), { matrice: inF(ft, u + sx * (w / 2 - 0.015), v + h / 2, 0.035), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoVerticale(0.1), occlusione: 0.3 });
  vetro(b, inF(ft, u, v + h / 2, 0.02), w - 0.06, h - 0.06, v, o.accesa);
  if (o.inferriata) {
    const n = Math.max(2, Math.round(w / 0.15));
    for (let i = 1; i < n; i++) {
      b.aggiungi(geoBoxC(0.024, h + 0.06, 0.024), { matrice: inF(ft, u - w / 2 + (i * w) / n, v + h / 2, 0.1), colore: PALETTE.ferro, piatto: true, superficie: SUP.METALLO, occlusione: 0.15 });
    }
    b.aggiungi(geoBoxC(w + 0.04, 0.024, 0.024), { matrice: inF(ft, u, v + h * 0.5, 0.1), colore: PALETTE.ferro, piatto: true, superficie: SUP.METALLO, occlusione: 0.15 });
  } else {
    b.aggiungi(geoPiano(0.045, h - 0.06), { matrice: inF(ft, u, v + h / 2, 0.05), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoVerticale(0.2), occlusione: 0.25 });
    b.aggiungi(geoPiano(w - 0.06, 0.045), { matrice: inF(ft, u, v + h * 0.6, 0.052), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoOrizzontale(0.2), occlusione: 0.25 });
  }
  // davanzale di pietra: copre la spalletta bassa e sporge dal muro
  b.aggiungi(geoLastra(u1 - u0 + 0.14, 0.07, d + 0.13, rng.intero(0, 1e6), 0.08), {
    matrice: inF(f, u, v0 - 0.065, -d / 2 + 0.06),
    colore: mescola(PALETTE.gneissChiaro, PALETTE.gneissCaldo, rng.next() * 0.5),
    variazione: 0.05,
    piatto: true,
    superficie: sup(SUP.PIETRA, rng.next()),
  });
  // architrave: trave di larice o lastra di pietra, appena sporgente
  if (o.architraveLegno) {
    b.aggiungi(geoBoxC(u1 - u0 + 0.5, 0.16, 0.2), { matrice: inF(f, u, v1 + 0.08, -0.07), colore: PALETTE.lariceScuro, variazione: 0.08, piatto: true, superficie: legnoOrizzontale(rng.next()) });
  } else {
    b.aggiungi(geoLastra(u1 - u0 + 0.42, 0.18, 0.26, rng.intero(0, 1e6), 0.1), {
      matrice: inF(f, u, v1 - 0.02, -0.09),
      colore: mescola(PALETTE.gneissChiaro, PALETTE.gneissCaldo, rng.next() * 0.6),
      variazione: 0.06,
      piatto: true,
      superficie: sup(SUP.PIETRA, rng.next()),
    });
  }
  if (o.ante !== undefined && o.ante !== null) persiane(b, f, u, v0, u1 - u0, v1 - v0, o.ante, 0.015);
  if (o.gerani) gerani(b, f, u, v0 - 0.03, u1 - u0 + 0.06);
}

/**
 * Persiane di legno aperte contro il muro ai due lati di un'apertura larga w e alta h (v = base):
 * due ante con la cornice e le stecche orizzontali, i cardini di ferro.
 */
export function persiane(b: Costruttore, f: THREE.Matrix4, u: number, v: number, w: number, h: number, colore: number, w0 = 0.015): void {
  const rng = b.rng;
  const lw = w / 2 + 0.02;
  const scura = mescola(colore, 0x000000, 0.38);
  for (const s of [-1, 1]) {
    const uc = u + s * (w / 2 + lw / 2 + 0.03);
    const m = inF(f, uc, v + h / 2, w0 + 0.025, [0, 0, rng.centrato(0.012)]);
    // anta: cornice e fondo
    b.aggiungi(geoBoxC(lw, h, 0.045), { matrice: m, colore, variazione: 0.07, gradiente: { basso: 0.85, alto: 1.05, y0: v, y1: v + h }, piatto: true, superficie: legnoVerticale(rng.next()) });
    // stecche: righe d'ombra orizzontali (gelosia)
    const ns = Math.max(4, Math.round((h - 0.12) / 0.075));
    for (let k = 0; k < ns; k++) {
      const y = -h / 2 + 0.07 + ((k + 0.5) * (h - 0.14)) / ns;
      b.aggiungi(geoPiano(lw - 0.08, 0.02), { matrice: m.clone().multiply(mat([0, y, 0.024], [-0.4, 0, 0])), colore: scura, piatto: true, superficie: sup(SUP.NESSUNA) });
    }
    // cardini
    for (const y of [-h / 2 + 0.12, h / 2 - 0.12]) {
      b.aggiungi(geoPiano(lw * 0.55, 0.035), { matrice: m.clone().multiply(mat([-s * lw * 0.2, y, 0.025])), colore: PALETTE.ferro, piatto: true, superficie: SUP.METALLO });
    }
  }
}

/** Cassetta di gerani sul davanzale (quota v), larghezza l. */
export function gerani(b: Costruttore, f: THREE.Matrix4, u: number, v: number, l: number): void {
  const rng = b.rng;
  b.aggiungi(geoBoxC(l, 0.16, 0.18), {
    matrice: inF(f, u, v + 0.08, 0.22),
    colore: PALETTE.legno,
    variazione: 0.1,
    piatto: true,
    superficie: legnoOrizzontale(rng.next()),
  });
  // foglie: cuscino verde che ricade sul bordo
  const nf = Math.max(3, Math.round(l / 0.22));
  for (let i = 0; i < nf; i++) {
    const x = u - l / 2 + ((i + 0.5) * l) / nf;
    b.aggiungi(geoCiuffo(0.13 + rng.next() * 0.04, rng.intero(0, 1e6), 0.7), {
      matrice: inF(f, x, v + 0.19, 0.25 + rng.next() * 0.04),
      colore: mescola(PALETTE.fogliaGeranio, 0x2f5a26, rng.next() * 0.5),
      variazione: 0.12,
      piatto: true,
      superficie: sup(SUP.NESSUNA),
    });
  }
  // fiori: grappoli rossi (o rosa) che spuntano sopra e davanti
  const nfiori = Math.max(3, Math.round(l / 0.17));
  const tinta = rng.prob(0.7) ? PALETTE.geranio : PALETTE.geranioRosa;
  for (let i = 0; i < nfiori; i++) {
    const x = u - l / 2 + 0.05 + rng.next() * (l - 0.1);
    b.aggiungi(geoCiuffo(0.06 + rng.next() * 0.035, rng.intero(0, 1e6), 0.9), {
      matrice: inF(f, x, v + 0.28 + rng.next() * 0.1, 0.22 + rng.next() * 0.14),
      colore: mescola(tinta, 0xffffff, rng.next() * 0.12),
      variazione: 0.12,
      piatto: true,
      superficie: sup(SUP.NESSUNA),
    });
  }
}

/**
 * Descrizione di una porta in coordinate dell'oggetto (vedi `PortaOggetto`): soglia al centro di
 * (u, v) sulla facciata `f`, normale = +Z della facciata, battente a `battente` dal filo del muro.
 */
export function descriviPorta(f: THREE.Matrix4, u: number, v: number, larghezza: number, altezza: number, battente: number, nome = 'porta', appoggio: PortaOggetto['appoggio'] = 'suolo'): PortaOggetto {
  return {
    nome,
    centro: new THREE.Vector3(u, v, 0).applyMatrix4(f),
    normale: new THREE.Vector3(0, 0, 1).transformDirection(f),
    larghezza,
    altezza,
    battente,
    appoggio,
  };
}

/**
 * Porta di legno con stipiti e architrave di pietra; la base è a v. (Appoggiata, senza foro.)
 * Restituisce la sua descrizione (`PortaOggetto`): il generatore la mette fra le sue `porte`.
 */
export function porta(b: Costruttore, f: THREE.Matrix4, u: number, v: number, larghezza = 1.0, altezza = 1.95, colore: number = PALETTE.legno): PortaOggetto {
  const rng = b.rng;
  // il battente sporge 5 cm dal muro (migliorie «porte»: con 3 cm, oltre i 250 m, il muro dietro
  // affiorava a tratti) e le bandelle stanno 1,5 cm davanti al battente (prima 0,5: sfarfallavano)
  b.aggiungi(geoBoxC(larghezza, altezza, 0.1), {
    matrice: inF(f, u, v + altezza / 2, 0),
    colore,
    variazione: 0.08,
    gradiente: { basso: 0.75, alto: 1.0, y0: v, y1: v + altezza },
    piatto: true,
    superficie: legnoVerticale(rng.next()),
  });
  ferramentaPorta(b, f, u, v, larghezza, altezza, 0.065);
  // stipiti e architrave
  for (const s of [-1, 1]) {
    b.aggiungi(geoLastra(0.2, altezza, 0.16, rng.intero(0, 1e6), 0.08), {
      matrice: inF(f, u + s * (larghezza / 2 + 0.1), v, 0.04),
      colore: PALETTE.gneissChiaro,
      variazione: 0.07,
      piatto: true,
      superficie: sup(SUP.PIETRA, rng.next()),
    });
  }
  b.aggiungi(geoLastra(larghezza + 0.6, 0.24, 0.18, rng.intero(0, 1e6), 0.08), {
    matrice: inF(f, u, v + altezza, 0.05),
    colore: PALETTE.gneissChiaro,
    variazione: 0.06,
    piatto: true,
    superficie: sup(SUP.PIETRA, rng.next()),
  });
  // soglia
  b.aggiungi(geoLastra(larghezza + 0.5, 0.12, 0.5, rng.intero(0, 1e6), 0.1), {
    matrice: inF(f, u, v - 0.1, 0.2),
    colore: PALETTE.gneiss,
    variazione: 0.06,
    piatto: true,
    superficie: sup(SUP.PIETRA, rng.next()),
  });
  return descriviPorta(f, u, v, larghezza, altezza, 0.05, 'porta', v > 0.3 ? 'balcone' : 'suolo');
}

/** Bandelle di ferro, chiodi e maniglia ad anello su un battente (w0 = sporgenza dal battente). */
function ferramentaPorta(b: Costruttore, f: THREE.Matrix4, u: number, v: number, larghezza: number, altezza: number, w0: number): void {
  for (const y of [0.32, altezza - 0.36]) {
    b.aggiungi(geoPiano(larghezza * 0.72, 0.05), { matrice: inF(f, u - larghezza * 0.12, v + y, w0), colore: PALETTE.ferro, piatto: true, superficie: SUP.METALLO });
  }
  b.aggiungi(new THREE.TorusGeometry(0.05, 0.01, 3, 6), { matrice: inF(f, u + larghezza * 0.32, v + altezza * 0.5, w0 + 0.01), colore: PALETTE.ferro, superficie: SUP.METALLO });
}

/** Foro nel muro di una porta incassata (base a v, luce larghezza × altezza). */
export function foroPorta(u: number, v: number, larghezza: number, altezza: number): Foro {
  return [u - larghezza / 2, v - 0.05, u + larghezza / 2, v + altezza];
}

/**
 * Porta di larice incassata nel foro di un muro spesso (`foroPorta`): battente ad assi verticali con
 * le bandelle di ferro, stipiti di pietra a filo del muro, architrave (lastra o trave), soglia.
 */
export function portaIncassata(
  b: Costruttore,
  f: THREE.Matrix4,
  u: number,
  v: number,
  larghezza = 1.0,
  altezza = 1.95,
  colore: number = PALETTE.larice,
  opz: { profondita?: number; architraveLegno?: boolean; soglia?: boolean; nome?: string; appoggio?: PortaOggetto['appoggio'] } = {},
): PortaOggetto {
  const rng = b.rng;
  const d = opz.profondita ?? 0.22;
  // battente in fondo al foro
  b.aggiungi(geoBoxC(larghezza, altezza, 0.07), {
    matrice: inF(f, u, v + altezza / 2, -d),
    colore,
    variazione: 0.08,
    gradiente: { basso: 0.72, alto: 1.0, y0: v, y1: v + altezza },
    piatto: true,
    superficie: legnoVerticale(rng.next()),
    occlusione: 0.28,
  });
  ferramentaPorta(b, f, u, v, larghezza, altezza, -d + 0.05);
  // spallette del foro (pietra chiara), più scure in fondo
  for (const s of [-1, 1]) {
    b.aggiungi(geoBoxC(0.02, altezza, d), { matrice: inF(f, u + s * (larghezza / 2 - 0.01), v + altezza / 2, -d / 2), colore: PALETTE.gneissChiaro, piatto: true, superficie: sup(SUP.PIETRA, rng.next()), occlusione: 0.3 });
  }
  // stipiti di pietra a filo del muro, irregolari
  for (const s of [-1, 1]) {
    let y = v;
    while (y < v + altezza - 0.05) {
      const hb = Math.min(v + altezza - y, rng.tra(0.55, 0.8));
      const lb = rng.prob(0.5) ? 0.32 : 0.22;
      b.aggiungi(geoLastra(lb, hb - 0.02, 0.1, rng.intero(0, 1e6), 0.06), {
        matrice: inF(f, u + s * (larghezza / 2 + lb / 2 - 0.02), y, -0.03),
        colore: mescola(PALETTE.gneissChiaro, PALETTE.gneissCaldo, rng.next() * 0.6),
        variazione: 0.05,
        piatto: true,
        superficie: sup(SUP.PIETRA, rng.next()),
      });
      y += hb;
    }
  }
  if (opz.architraveLegno) {
    b.aggiungi(geoBoxC(larghezza + 0.7, 0.2, 0.26), { matrice: inF(f, u, v + altezza + 0.1, -0.1), colore: PALETTE.lariceScuro, variazione: 0.08, piatto: true, superficie: legnoOrizzontale(rng.next()) });
  } else {
    b.aggiungi(geoLastra(larghezza + 0.66, 0.26, 0.24, rng.intero(0, 1e6), 0.08), {
      matrice: inF(f, u, v + altezza - 0.01, -0.08),
      colore: PALETTE.gneissChiaro,
      variazione: 0.06,
      piatto: true,
      superficie: sup(SUP.PIETRA, rng.next()),
    });
  }
  if (opz.soglia ?? true) {
    b.aggiungi(geoLastra(larghezza + 0.4, 0.13, d + 0.5, rng.intero(0, 1e6), 0.1), {
      matrice: inF(f, u, v - 0.11, 0.25 - d / 2),
      colore: PALETTE.gneiss,
      variazione: 0.06,
      piatto: true,
      superficie: sup(SUP.PIETRA, rng.next()),
    });
  }
  return descriviPorta(f, u, v, larghezza, altezza, -d + 0.035, opz.nome ?? 'porta', opz.appoggio ?? 'suolo');
}

/**
 * Muro di pietra spesso `t` con le aperture: il profilo (in coordinate di facciata, u lungo il muro,
 * v in su) si estrude verso l'interno (la faccia esterna sta a w = 0). Restituisce la geometria in
 * coordinate di facciata.
 */
export function geoMuroForato(profilo: Array<[number, number]>, fori: Foro[], t = SPESSORE_MURO): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(profilo[0]![0], profilo[0]![1]);
  for (let i = 1; i < profilo.length; i++) s.lineTo(profilo[i]![0], profilo[i]![1]);
  s.lineTo(profilo[0]![0], profilo[0]![1]);
  for (const [u0, v0, u1, v1] of fori) {
    const h = new THREE.Path();
    h.moveTo(u0, v0);
    h.lineTo(u0, v1);
    h.lineTo(u1, v1);
    h.lineTo(u1, v0);
    h.lineTo(u0, v0);
    s.holes.push(h);
  }
  const g = geoEstrusione(s, t, 1);
  g.translate(0, 0, -t / 2);
  return g;
}

/**
 * Balcone (lobbia) di legno: assito, mensole sporgenti, ringhiera ad assicelle.
 * v = quota dell'assito, sp = sporgenza dal muro, l = larghezza lungo la facciata.
 */
export function balcone(b: Costruttore, f: THREE.Matrix4, u: number, v: number, l: number, sp = 1.0, altezzaPali = 0, opz: { fiori?: boolean; panni?: boolean } = {}): void {
  const rng = b.rng;
  const legno = rng.scegli([PALETTE.legno, PALETTE.legnoVecchio, PALETTE.legnoGrigio, PALETTE.larice]);
  // assito
  b.aggiungi(geoBoxC(l, 0.08, sp), { matrice: inF(f, u, v, sp / 2), colore: legno, variazione: 0.06, piatto: true, superficie: legnoOrizzontale(rng.next()) });
  // mensole (sagomate: due pezzi, quello sotto più corto)
  const nm = Math.max(2, Math.round(l / 1.2) + 1);
  for (let i = 0; i < nm; i++) {
    const x = u - l / 2 + 0.1 + (i * (l - 0.2)) / (nm - 1);
    b.aggiungi(geoBoxC(0.13, 0.16, sp + 0.15), { matrice: inF(f, x, v - 0.12, (sp + 0.15) / 2), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoOrizzontale(0.3), occlusione: 0.25 });
    b.aggiungi(geoBoxC(0.11, 0.12, sp * 0.55), { matrice: inF(f, x, v - 0.26, sp * 0.28), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoOrizzontale(0.4), occlusione: 0.35 });
  }
  // ringhiera: corrimano, traverso basso, assicelle sagomate
  const hr = 0.95;
  const legnoChiaro = mescola(legno, 0xffffff, 0.08);
  b.aggiungi(geoBoxC(l, 0.07, 0.09), { matrice: inF(f, u, v + hr, sp - 0.04), colore: legnoChiaro, piatto: true, superficie: legnoOrizzontale(0.6) });
  b.aggiungi(geoBoxC(l, 0.06, 0.06), { matrice: inF(f, u, v + 0.15, sp - 0.04), colore: legno, piatto: true, superficie: legnoOrizzontale(0.7) });
  for (const s of [-1, 1]) {
    b.aggiungi(geoBoxC(0.07, hr, 0.07), { matrice: inF(f, u + s * (l / 2 - 0.035), v + hr / 2, sp - 0.04), colore: legno, piatto: true, superficie: legnoVerticale(0.5) });
    b.aggiungi(geoBoxC(0.06, 0.07, sp), { matrice: inF(f, u + s * (l / 2 - 0.035), v + hr, sp / 2), colore: legnoChiaro, piatto: true, superficie: legnoOrizzontale(0.5) });
  }
  const passo = 0.19;
  const na = Math.floor((l - 0.1) / passo);
  for (let i = 1; i < na; i++) {
    const x = u - l / 2 + 0.05 + i * passo;
    // assicella: una tavola sottile (due facce), si vede dalla strada e dal balcone
    b.aggiungi(geoPiano(0.1, hr - 0.15), {
      matrice: inF(f, x, v + 0.04 + (hr - 0.15) / 2 + 0.04, sp - 0.04, [0, 0, rng.centrato(0.03)]),
      colore: legno,
      variazione: 0.08,
      piatto: true,
      canale: 'sottile',
      superficie: legnoVerticale(rng.next()),
    });
  }
  // pali fino alla gronda
  if (altezzaPali > 0) {
    for (const s of [-1, 1]) {
      b.aggiungi(geoBoxC(0.13, altezzaPali, 0.13), {
        matrice: inF(f, u + s * (l / 2 - 0.06), v + altezzaPali / 2, sp - 0.06),
        colore: PALETTE.legnoScuro,
        piatto: true,
        superficie: legnoVerticale(rng.next()),
      });
    }
    // un palo in mezzo se è lungo, e la trave sotto la gronda
    if (l > 4.5) b.aggiungi(geoBoxC(0.12, altezzaPali, 0.12), { matrice: inF(f, u, v + altezzaPali / 2, sp - 0.06), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoVerticale(0.4) });
    b.aggiungi(geoBoxC(l, 0.14, 0.14), { matrice: inF(f, u, v + altezzaPali - 0.07, sp - 0.06), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoOrizzontale(0.3), occlusione: 0.3 });
  }
  // gerani appesi alla ringhiera
  if (opz.fiori ?? rng.prob(0.6)) {
    const nc = Math.max(1, Math.floor(l / 2.2));
    for (let k = 0; k < nc; k++) {
      const x = u - l / 2 + ((k + 0.5) * l) / nc + rng.centrato(0.3);
      gerani(b, inF(f, 0, 0, sp - 0.25), x, v + hr - 0.1, Math.min(1.1, l / nc - 0.3));
    }
  }
  // panni stesi sul corrimano
  if (opz.panni ?? rng.prob(0.35)) {
    const np = 1 + rng.intero(0, 2);
    for (let k = 0; k < np; k++) {
      const x = u + rng.centrato(l * 0.35);
      const pw = rng.tra(0.45, 0.8);
      const ph = rng.tra(0.4, 0.7);
      b.aggiungi(geoPiano(pw, ph, 2, 2), {
        matrice: inF(f, x, v + hr - ph / 2 + 0.02, sp + 0.01, [rng.centrato(0.05), 0, rng.centrato(0.04)]),
        colore: rng.scegli([0xf1ece0, 0xe2d6bd, 0xb8463a, 0x5d6f8a, 0xd8c79a]),
        canale: 'sottile',
        superficie: SUP.TESSUTO,
      });
    }
  }
}

/** Camino di pietra con la piota (cappello di piode su quattro pilastrini). (x, z) in pianta, yBase = base, h = altezza. */
export function camino(b: Costruttore, x: number, yBase: number, z: number, h: number): void {
  const rng = b.rng;
  b.aggiungi(geoLastra(0.62, h, 0.62, rng.intero(0, 1e6), 0.06), {
    matrice: mat([x, yBase, z], [0, rng.centrato(0.1), rng.centrato(0.02)]),
    colore: mescola(PALETTE.gneiss, PALETTE.gneissCaldo, rng.next() * 0.5),
    gradiente: { basso: 0.8, alto: 1.05, y0: yBase, y1: yBase + h },
    variazione: 0.05,
    piatto: true,
    superficie: sup(SUP.PIETRA, rng.next()),
  });
  // fuliggine in cima
  b.aggiungi(geoBoxC(0.66, 0.12, 0.66), { matrice: mat([x, yBase + h - 0.05, z]), colore: 0x3d3833, piatto: true, superficie: sup(SUP.PIETRA, 0.3) });
  for (const [dx, dz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]] as const) {
    b.aggiungi(geoLastra(0.12, 0.26, 0.12, rng.intero(0, 1e6), 0.12), { matrice: mat([x + dx, yBase + h, z + dz]), colore: PALETTE.gneissScuro, piatto: true, superficie: sup(SUP.PIETRA, rng.next()) });
  }
  // la piota: una lastra larga e spessa, appena storta
  b.aggiungi(geoLastra(1.0, 0.11, 0.95, rng.intero(0, 1e6), 0.16), {
    matrice: mat([x, yBase + h + 0.25, z], [rng.centrato(0.08), rng.next(), rng.centrato(0.08)]),
    colore: mescola(PALETTE.piode, PALETTE.piodeChiare, rng.next()),
    variazione: 0.08,
    piatto: true,
    superficie: sup(SUP.PIODE, rng.next()),
  });
  // un sasso sopra la piota (contro il vento)
  b.aggiungi(geoLastra(0.3, 0.12, 0.24, rng.intero(0, 1e6), 0.25), { matrice: mat([x + rng.centrato(0.15), yBase + h + 0.35, z + rng.centrato(0.15)], [0, rng.next() * 3, 0]), colore: PALETTE.gneissScuro, piatto: true, superficie: sup(SUP.PIETRA, rng.next()) });
}

/**
 * Cantonali: blocchi alternati lunghi/corti sugli spigoli verticali di un volume w×d (centrato in 0),
 * dalla quota y0 alla quota y1.
 */
export function cantonali(b: Costruttore, w: number, d: number, y0: number, y1: number, altezzaCorso = 0.5, spigoli: Array<[number, number]> = [[1, 1], [-1, 1], [1, -1], [-1, -1]]): void {
  const rng = b.rng;
  const n = Math.max(1, Math.floor((y1 - y0) / altezzaCorso));
  const hc = (y1 - y0) / n;
  for (const [sx, sz] of spigoli) {
    for (let i = 0; i < n; i++) {
      const lungo = (i + (sx > 0 ? 0 : 1)) % 2 === 0;
      const lx = (lungo ? 0.75 : 0.42) + rng.centrato(0.1);
      const lz = (lungo ? 0.42 : 0.75) + rng.centrato(0.1);
      const y = y0 + i * hc;
      b.aggiungi(geoLastra(lx, hc - 0.03, lz, rng.intero(0, 1e6), 0.07), {
        matrice: mat([sx * (w / 2 - lx / 2 + 0.035), y + 0.015, sz * (d / 2 - lz / 2 + 0.035)]),
        colore: mescola(PALETTE.gneissChiaro, PALETTE.gneissCaldo, rng.next() * 0.5),
        variazione: 0.07,
        gradiente: { basso: 0.85, alto: 1.03, y0, y1 },
        piatto: true,
        superficie: sup(SUP.PIETRA, rng.next()),
        occlusione: (p) => Math.max(0, 0.4 * (1 - Math.max(0, p.y) / 1.0)),
      });
    }
  }
}

/**
 * Pietre a vista: quadrilateri leggermente sporgenti e di tono diverso sparsi sulla facciata,
 * per suggerire la muratura senza texture.
 */
export function pietreAVista(b: Costruttore, f: THREE.Matrix4, larghezza: number, y0: number, y1: number, quante: number, evitare: Array<[number, number, number, number]> = []): void {
  const rng = b.rng;
  let messe = 0;
  for (let t = 0; t < quante * 4 && messe < quante; t++) {
    const pw = 0.3 + rng.next() * 0.45;
    const ph = 0.14 + rng.next() * 0.16;
    const u = rng.tra(-larghezza / 2 + pw / 2 + 0.3, larghezza / 2 - pw / 2 - 0.3);
    const v = rng.tra(y0 + 0.2, y1 - 0.2);
    if (evitare.some(([u0, v0, u1, v1]) => u > u0 - pw / 2 && u < u1 + pw / 2 && v > v0 - ph / 2 && v < v1 + ph / 2)) continue;
    const scuro = rng.prob(0.5);
    b.aggiungi(geoPiano(pw, ph), {
      matrice: inF(f, u, v, 0.012, [0, 0, rng.centrato(0.08)]),
      colore: scuro ? mescola(PALETTE.gneissScuro, PALETTE.gneissViola, rng.next()) : mescola(PALETTE.gneissChiaro, PALETTE.gneissCaldo, rng.next()),
      variazione: 0.05,
      piatto: true,
      superficie: sup(SUP.PIETRA, rng.next()),
    });
    messe++;
  }
}

export interface OpzioniTetto {
  /** larghezza del corpo (X), il colmo corre lungo Z */
  larghezza: number;
  /** profondità del corpo (Z) */
  profondita: number;
  /** quota della linea di gronda sul muro */
  yGronda: number;
  /** pendenza in radianti */
  pendenza: number;
  sporgenzaGronda?: number;
  sporgenzaTimpano?: number;
  /** sporgenza sul timpano anteriore (+Z), se diversa (balcone sotto il tetto) */
  sporgenzaFronte?: number;
  /** corsi di piode per falda (0 = solo lastra di base) */
  corsi?: number;
  /** pezzi per corso lungo Z */
  pezziPerCorso?: number;
  /** solo una falda: +1 destra, -1 sinistra (tetti a una falda dei fienili addossati) */
  falde?: Array<1 | -1>;
  /** travi in vista sotto le gronde e sui timpani (predefinito: sì se ci sono corsi) */
  travi?: boolean;
  /** imbarcamento del colmo (m): i tetti vecchi cedono un poco nel mezzo */
  cedimento?: number;
  /**
   * contrasto fra le file di lastre (1 = di base): tono alternato da una fila all'altra e ombra sotto
   * ogni fila. I rustici usano 2, perché le file si leggano anche dall'alto dopo il filtro pittorico.
   */
  contrasto?: number;
  /** colore dell'assito sotto le falde (predefinito `PALETTE.assito`) */
  assito?: number;
  /** tetto per l'occlusione cotta dell'assito e delle travi (le tettoie viste da sotto non devono essere nere) */
  occlusioneMassima?: number;
  /** tinta del tetto intero [colore, quanto 0..1]: ogni casa ha il suo grigio (più freddo, più bruno, più chiaro) */
  tinta?: readonly [number, number];
}

/** Tetto a due falde in piode, colmo lungo Z. Restituisce la quota del colmo. */
export function tettoPiode(b: Costruttore, rng: Rng, o: OpzioniTetto): number {
  const sg = o.sporgenzaGronda ?? 0.45;
  const st = o.sporgenzaTimpano ?? 0.3;
  const corsi = o.corsi ?? 4;
  const ppc = o.pezziPerCorso ?? 5;
  const contrasto = o.contrasto ?? 1;
  const occMax = o.occlusioneMassima ?? 1;
  const tinge = (c: THREE.ColorRepresentation): THREE.Color => (o.tinta ? mescola(c, o.tinta[0], o.tinta[1]) : new THREE.Color(c));
  const p = o.pendenza;
  const w2 = o.larghezza / 2;
  const yColmo = o.yGronda + w2 * Math.tan(p);
  const lFalda = (w2 + sg) / Math.cos(p);
  const sf = o.sporgenzaFronte ?? st;
  const dTot = o.profondita + st + sf;
  const zc = (sf - st) / 2;
  const sp = 0.18;
  const ced = o.cedimento ?? 0;
  const imbarca = (z: number) => ced * (1 - Math.pow((z - zc) / (dTot / 2), 2));
  const supBase = sup(SUP.PIODE, rng.next());
  for (const s of o.falde ?? [1, -1]) {
    // direzione lungo la falda (dal colmo verso la gronda) e normale
    const dir = new THREE.Vector3(s * Math.cos(p), -Math.sin(p), 0);
    const nrm = new THREE.Vector3(s * Math.sin(p), Math.cos(p), 0);
    const colmo = new THREE.Vector3(0, yColmo, 0);
    const rotZ = -s * p;
    // lastra di base (lo spessore si vede sulla gronda e sui timpani)
    const cBase = colmo.clone().addScaledVector(dir, lFalda / 2).addScaledVector(nrm, sp / 2);
    cBase.z = zc;
    b.aggiungi(geoBoxC(lFalda + 0.05, sp, dTot), {
      matrice: mat(cBase, [0, 0, rotZ]),
      // la lastra di base si vede nei giunti fra le lastre: scura e calda
      colore: tinge(PALETTE.piodeGiunti),
      variazione: 0.03,
      piatto: true,
      superficie: supBase,
      occlusione: 0.12,
    });
    // assito di larice sotto la falda: dalla strada, sotto le gronde, si vede il legno e non la pietra
    if (o.travi ?? corsi > 0) {
      const cAss = colmo.clone().addScaledVector(dir, lFalda / 2 + 0.01).addScaledVector(nrm, -0.012);
      cAss.z = zc;
      // una sola faccia, rivolta in giù (dentro casa non si vede)
      b.aggiungi(new THREE.PlaneGeometry(lFalda - 0.04, dTot - 0.04), {
        matrice: mat(cAss, [0, 0, rotZ]).multiply(mat([0, 0, 0], [Math.PI / 2, 0, 0])),
        colore: o.assito ?? PALETTE.assito,
        variazione: 0.05,
        piatto: true,
        superficie: legnoOrizzontale(rng.next()),
        occlusione: Math.min(occMax, 0.22),
      });
    }
    if (corsi <= 0) continue;
    // corsi di lastre sovrapposte, spesse, con il bordo inferiore irregolare
    const passo = lFalda / corsi;
    for (let c = 0; c < corsi; c++) {
      const s0 = c * passo;
      let z = zc - dTot / 2;
      const larghezze: number[] = [];
      let somma = 0;
      for (let k = 0; k < ppc; k++) {
        const lw = 0.6 + rng.next();
        larghezze.push(lw);
        somma += lw;
      }
      for (let k = 0; k < ppc; k++) {
        const lz = ((larghezze[k] as number) / somma) * dTot;
        const lungo = passo + 0.1 + rng.next() * 0.18 + (c === corsi - 1 ? 0.06 : 0);
        const centroS = s0 + lungo / 2 - 0.02;
        const spessore = 0.08 + rng.next() * 0.04;
        const centro = colmo
          .clone()
          .addScaledVector(dir, centroS)
          .addScaledVector(nrm, sp + spessore / 2 + 0.005 + (corsi - 1 - c) * 0.014);
        centro.z = z + lz / 2;
        centro.y -= imbarca(centro.z);
        const tono = rng.next();
        // muschio (6%), licheni ocra (15%), poi lastre più chiare o più scure; le stesse estrazioni
        // di prima (i numeri casuali che seguono non cambiano)
        const quanto = rng.next();
        let colore = tono < 0.06 ? mescola(PALETTE.piode, PALETTE.piodeMuschio, 0.4 + quanto * 0.4) : tono < 0.21 ? mescola(PALETTE.piode, PALETTE.piodeLichene, 0.35 + quanto * 0.4) : mescola(PALETTE.piode, tono < 0.6 ? PALETTE.piodeChiare : PALETTE.piodeScure, quanto * 0.38);
        // file alternate più chiare e più scure: le file si leggono come righe anche da lontano
        if (contrasto > 1) colore = mescola(colore, c % 2 === 0 ? PALETTE.piodeChiare : PALETTE.piodeScure, Math.min(0.6, 0.22 * (contrasto - 1) + 0.08));
        const ombraFila = Math.min(0.55, 0.18 * contrasto);
        b.aggiungi(geoLastra(lungo, spessore, lz + 0.03, rng.intero(0, 1e6), 0.14), {
          matrice: mat(centro.clone().addScaledVector(nrm, -spessore / 2), [rng.centrato(0.02), rng.centrato(0.015), rotZ + s * 0.035 + rng.centrato(0.012)]),
          colore: tinge(colore),
          variazione: 0.1,
          tinta: 0.03,
          piatto: true,
          superficie: sup(SUP.PIODE, rng.next()),
          // ombra sotto ogni fila (il bordo basso della lastra sopra): più forte col contrasto
          occlusione: (pp) => (pp.y < centro.y - 0.02 ? ombraFila : 0.04),
        });
        z += lz;
      }
    }
  }
  // colmo: lastre di cresta (sovrapposte, più chiare)
  const ncr = Math.max(3, Math.round(dTot / 0.8));
  for (let k = 0; k < ncr; k++) {
    const z = zc - dTot / 2 + ((k + 0.5) * dTot) / ncr;
    b.aggiungi(geoLastra(0.6, 0.08, dTot / ncr + 0.08, rng.intero(0, 1e6), 0.14), {
      matrice: mat([0.09 * (k % 2 === 0 ? 1 : -1), yColmo + sp + 0.05 - imbarca(z), z], [0, rng.centrato(0.03), (k % 2 === 0 ? -1 : 1) * p * 0.6]),
      colore: tinge(mescola(PALETTE.piodeChiare, PALETTE.piode, rng.next() * 0.4)),
      variazione: 0.08,
      piatto: true,
      superficie: sup(SUP.PIODE, rng.next()),
    });
  }
  // travi in vista: le teste delle terzere e del colmo sui timpani, i travetti sotto le gronde
  if ((o.travi ?? corsi > 0) && (o.falde ?? [1, -1]).length === 2) {
    const legno = PALETTE.legnoScuro;
    for (const zt of [zc + dTot / 2, zc - dTot / 2]) {
      const segno = zt > zc ? 1 : -1;
      const lt = (segno > 0 ? sf : st) + 0.25;
      for (const xx of [0, -w2 * 0.5, w2 * 0.5]) {
        const yy = yColmo - Math.abs(xx) * Math.tan(p) - 0.12;
        b.aggiungi(geoBoxC(0.18, 0.2, lt), { matrice: mat([xx, yy, zt - segno * (lt / 2 - 0.05)]), colore: legno, variazione: 0.08, piatto: true, superficie: legnoOrizzontale(rng.next()), occlusione: Math.min(occMax, 0.3) });
      }
    }
    const nt = Math.max(3, Math.round(o.profondita / 0.95));
    for (const s of [1, -1]) {
      for (let k = 0; k <= nt; k++) {
        const z = -o.profondita / 2 + (k * o.profondita) / nt;
        const x0 = s * (w2 - 0.05);
        const x1 = s * (w2 + sg - 0.12);
        const y0 = o.yGronda - 0.06;
        const y1 = y0 - (sg - 0.07) * Math.tan(p);
        const a = new THREE.Vector3(x0, y0, z);
        const c = new THREE.Vector3(x1, y1, z);
        const l = a.distanceTo(c);
        b.aggiungi(geoBoxC(l, 0.1, 0.09), { matrice: mat(a.clone().lerp(c, 0.5), [0, 0, -s * p]), colore: legno, variazione: 0.1, piatto: true, superficie: legnoOrizzontale(0.2), occlusione: Math.min(occMax, 0.38) });
      }
    }
  }
  return yColmo;
}
