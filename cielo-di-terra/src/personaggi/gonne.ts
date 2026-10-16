/**
 * Le gonne e le vesti lunghe da sedute.
 *
 * I pesi della pipeline (tools/personaggi/processa.py) sono fatti per camminare: dentro la gonna le gambe
 * pesano dal 15% all'anca al 55% all'orlo, il resto va al bacino, così la stoffa non si divide in due
 * come un paio di pantaloni. Da seduti però le cosce ruotano di 80°: la parte della gonna che segue le
 * cosce a metà resta sospesa fra la posa in piedi e quella seduta e diventa una lastra orizzontale con
 * l'orlo sfilacciato, che buca i gradini.
 *
 * Qui si calcola, una volta per modello, un SECONDO insieme di pesi «da seduti»: la gonna sotto l'anca
 * segue la gamba del suo lato (la coscia fino al ginocchio, poi lo stinco), sfumando dal bacino nei primi
 * 8 cm sotto l'anca; braccia e piedi restano come sono. Così la stoffa va avanti sulle cosce e scende
 * davanti agli stinchi, come una veste su un paio di ginocchia. La fabbrica dà alla copia la geometria
 * con questi pesi quando il personaggio è seduto (stesse posizioni, normali e UV: cambiano solo
 * skinIndex e skinWeight), quindi vale per tutti i materiali, anche per l'ombra portata.
 *
 * Gira in Node (niente WebGL): lo usano i test.
 */
import * as THREE from 'three';

const _p = new THREE.Vector3();

const liscio = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * La geometria «da seduti» di una SkinnedMesh con la veste lunga (scheletro a riposo, matrici aggiornate):
 * condivide con l'originale tutti gli attributi tranne skinIndex e skinWeight. `H` = altezza del modello.
 * null se mancano le ossa.
 */
export function geometriaSeduta(mesh: THREE.SkinnedMesh, H: number): THREE.BufferGeometry | null {
  const ossa = mesh.skeleton.bones;
  const idx = (n: string) => ossa.findIndex((b) => b.name === n);
  const iB = idx('bacino');
  const iC = { S: idx('cosciaS'), D: idx('cosciaD') };
  const iT = { S: idx('stincoS'), D: idx('stincoD') };
  if ([iB, iC.S, iC.D, iT.S, iT.D].some((i) => i < 0)) return null;
  const braccia = new Set(['braccioS', 'avambraccioS', 'manoS', 'braccioD', 'avambraccioD', 'manoD'].map(idx));
  const piedi = new Set([idx('piedeS'), idx('piedeD')]);
  // quote delle giunture a riposo, nello spazio della mesh
  const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  const quotaOsso = (i: number) => (ossa[i] as THREE.Bone).getWorldPosition(_p).applyMatrix4(inv).y;
  const yAnca = (quotaOsso(iC.S) + quotaOsso(iC.D)) / 2;
  const yGinocchio = (quotaOsso(iT.S) + quotaOsso(iT.D)) / 2;

  const g = mesh.geometry;
  const si = g.getAttribute('skinIndex');
  const sw = g.getAttribute('skinWeight');
  const n = si.count;
  const nuoviI = new Uint16Array(n * 4);
  const nuoviW = new Float32Array(n * 4);
  const w = new Float32Array(ossa.length);
  const scelti: number[] = [];
  for (let v = 0; v < n; v++) {
    w.fill(0);
    let braccio = 0;
    let piede = 0;
    for (let k = 0; k < 4; k++) {
      const b = si.getComponent(v, k);
      const p = sw.getComponent(v, k);
      w[b] = (w[b] as number) + p;
      if (braccia.has(b)) braccio += p;
      if (piedi.has(b)) piede += p;
    }
    mesh.getVertexPosition(v, _p);
    const y = _p.y;
    // quanto questo vertice prende i pesi da seduti: sotto l'anca, non braccio, non le scarpe (l'orlo di una
    // veste fino a terra, pesato sui piedi dalla pipeline, segue lo stinco come il resto della gonna)
    const scarpa = piede * (1 - liscio(0.03 * H, 0.06 * H, y));
    const m = liscio(yAnca + 0.02 * H, yAnca - 0.04 * H, y) * (1 - THREE.MathUtils.clamp(braccio * 2.5, 0, 1)) * (1 - THREE.MathUtils.clamp(scarpa * 2, 0, 1));
    if (m > 0.001) {
      // la gamba del suo lato (sfumata al centro), la coscia sopra il ginocchio e lo stinco sotto
      const lato = liscio(-0.04 * H, 0.04 * H, _p.x); // 1 = sinistra (+X)
      const gamba = liscio(yAnca, yAnca - 0.08 * H, y);
      const stinco = liscio(yGinocchio + 0.04 * H, yGinocchio - 0.04 * H, y);
      const alt = new Map<number, number>();
      alt.set(iB, 1 - gamba);
      alt.set(iC.S, gamba * lato * (1 - stinco));
      alt.set(iC.D, gamba * (1 - lato) * (1 - stinco));
      alt.set(iT.S, gamba * lato * stinco);
      alt.set(iT.D, gamba * (1 - lato) * stinco);
      for (let b = 0; b < w.length; b++) w[b] = (w[b] as number) * (1 - m);
      for (const [b, p] of alt) w[b] = (w[b] as number) + p * m;
    }
    // le quattro influenze più forti, normalizzate
    scelti.length = 0;
    for (let b = 0; b < w.length; b++) if ((w[b] as number) > 1e-4) scelti.push(b);
    scelti.sort((a, b) => (w[b] as number) - (w[a] as number));
    scelti.length = Math.min(scelti.length, 4);
    let somma = 0;
    for (const b of scelti) somma += w[b] as number;
    for (let k = 0; k < 4; k++) {
      const b = scelti[k];
      nuoviI[v * 4 + k] = b ?? 0;
      nuoviW[v * 4 + k] = b === undefined || somma <= 0 ? 0 : (w[b] as number) / somma;
    }
    if (!scelti.length) nuoviW[v * 4] = 1;
  }
  const out = new THREE.BufferGeometry();
  for (const [nome, a] of Object.entries(g.attributes)) {
    if (nome === 'skinIndex' || nome === 'skinWeight') continue;
    out.setAttribute(nome, a);
  }
  out.setIndex(g.index);
  out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(nuoviI, 4));
  out.setAttribute('skinWeight', new THREE.Float32BufferAttribute(nuoviW, 4));
  for (const gr of g.groups) out.addGroup(gr.start, gr.count, gr.materialIndex);
  out.boundingBox = g.boundingBox;
  out.boundingSphere = g.boundingSphere;
  out.name = `${g.name || mesh.name}:seduta`;
  out.userData['seduta'] = true;
  return out;
}

/**
 * Posizione di un vertice con la posa attuale dello scheletro e i pesi della geometria `geo` (che può
 * essere quella da seduti), nello spazio della mesh: come SkinnedMesh.getVertexPosition, per le prove.
 */
export function vertice(mesh: THREE.SkinnedMesh, geo: THREE.BufferGeometry, i: number, out: THREE.Vector3): THREE.Vector3 {
  const prima = mesh.geometry;
  mesh.geometry = geo;
  try {
    return mesh.getVertexPosition(i, out);
  } finally {
    mesh.geometry = prima;
  }
}
