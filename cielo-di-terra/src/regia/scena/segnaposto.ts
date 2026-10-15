/**
 * SEGNAPOSTO dei contenuti di Corbella che la regia deve poter toccare, finché il modulo
 * `popolamento` non li posa davvero: il castagno morto e la botola, il cippo, il muretto del
 * belvedere, il castagno del cartellino, i chiodi e i pilastri della rete, il fienile, la
 * Bacheca, il telo dell'Ombrista, la scatola di Pina e gli elementi mobili E1-E4 con le loro
 * varianti. Usa gli oggetti procedurali di `src/oggetti`, adattati al materiale del mondo.
 *
 * Espone la `PortaPopolamento`: punti d'interazione per id e varianti degli elementi mobili.
 */
import { DoubleSide, Group, Mesh, Vector3, type Material, type Object3D, type Scene } from 'three';
import {
  adattaAlMotore,
  colliderAlMondo,
  creaBotolaCripta,
  creaCaposaldoDaContenuto,
  creaCastagno,
  creaCastagnoMorto,
  creaFienile,
  creaMuroSecco,
  creaRustico,
  posaSulCilindro,
  type OggettoProcedurale,
  type StatoBotola,
} from '../../oggetti';
import { createWorldMaterial } from '../../render/worldMaterial';
import { GeomBuilder } from '../../render/geomBuilder';
import type { RGB } from '../../render/palette';
import type { WorldUniforms } from '../../render/uniforms';
import type { Collider, ColliderWorld } from '../../world/colliders';
import { cylToWorld, deltaDeg } from '../../world/cylinder';
import { LAYOUT, METERS_PER_DEG } from '../../world/constants';
import { groundHeight, surfaceHeight } from '../../world/terrain';
import { CAPISALDI, luogo } from '../contenuti';
import { Ancora } from './ancora';
import type { PortaPopolamento } from '../porte';

const LEGNO: RGB = [0.48, 0.34, 0.22];
const LEGNO_CHIARO: RGB = [0.62, 0.48, 0.32];
const CARTA: RGB = [0.92, 0.88, 0.78];

/** Il campanile segnaposto del motore (layout.json → villages[0].campanile). */
export const LAYOUT_CAMPANILE = LAYOUT.villages[0]!.campanile as { z: number; theta: number; height: number };

/** Yaw (gradi, da nord verso est) per guardare da (z, θ) verso (z2, θ2). */
export function yawVerso(z: number, theta: number, z2: number, theta2: number): number {
  return (Math.atan2(deltaDeg(theta, theta2) * METERS_PER_DEG, z2 - z) * 180) / Math.PI;
}

export class Segnaposto implements PortaPopolamento {
  readonly gruppo = new Group();
  private punti = new Map<string, Vector3>();
  private varianti = new Map<string, Map<string, Object3D>>();
  private animati: { o: OggettoProcedurale<unknown>; stato?: () => unknown }[] = [];
  private botola!: OggettoProcedurale<StatoBotola>;
  private statoBotola: StatoBotola = { aperta: false };
  private doppio: Material;
  readonly lumi: Vector3[] = [];

  constructor(
    scene: Scene,
    private colliders: ColliderWorld,
    private materiale: Material,
    uniforms: WorldUniforms,
  ) {
    this.gruppo.name = 'segnaposto-corbella';
    this.doppio = createWorldMaterial(uniforms, { kind: 'object', side: DoubleSide });
    scene.add(this.gruppo);
    this.costruisci();
  }

  punto(id: string): Vector3 | null {
    return this.punti.get(id)?.clone() ?? null;
  }

  idPunti(): string[] {
    return [...this.punti.keys()];
  }

  mostraVariante(elemento: string, variante: string, _pezzi?: { mostra: string[]; nascondi: string[] }): void {
    const m = this.varianti.get(elemento);
    if (!m) return;
    for (const [id, o] of m) o.visible = id === variante;
  }

  apriBotola(aperta = true): void {
    this.statoBotola.aperta = aperta;
  }

  update(dt: number): void {
    this.botola?.update?.(dt, this.statoBotola);
    for (const a of this.animati) a.o.update?.(dt, a.stato?.());
  }

  // ---------- costruzione ----------

  private posa<S>(o: OggettoProcedurale<S>, z: number, theta: number, h: number, yaw: number, conCollider = true): OggettoProcedurale<S> {
    adattaAlMotore(o.gruppo, { oggetto: this.materiale, oggettoDoppio: this.doppio });
    posaSulCilindro(o.gruppo, z, theta, h, yaw);
    o.gruppo.updateMatrixWorld(true);
    this.gruppo.add(o.gruppo);
    if (conCollider) for (const c of o.collider) this.colliders.add({ ...colliderAlMondo(c, o.gruppo.matrixWorld), id: -1 } as Collider);
    return o;
  }

  /** Punto locale dell'oggetto → mondo. */
  private mondo(o: OggettoProcedurale<unknown>, locale: Vector3): Vector3 {
    return locale.clone().applyMatrix4(o.gruppo.matrixWorld);
  }

  private segna(id: string, p: Vector3): void {
    this.punti.set(id, p);
  }

  private costruisci(): void {
    // --- il castagno morto sopra la Cripta e la botola ---
    const cm = luogo('castagno_morto')!;
    const hCm = groundHeight(cm.z, cm.theta);
    const morto = this.posa(creaCastagnoMorto({ seme: 'castagno-morto', altezza: 10.5, cripta: false }), cm.z, cm.theta, hCm - 0.1, 200);
    const A = new Ancora(cm.z, cm.theta, hCm);
    this.segna('castagno_morto', this.mondo(morto, new Vector3(0, 1.4, 0)));
    this.segna('lente_corteccia', this.mondo(morto, new Vector3(0, 1.3, 10.5 * 0.08 + 0.12)));
    this.segna('lente_ricci', A.punto(-1.6, -1.2, 0.05));
    this.segna('lente_amenti', A.punto(1.3, -1.5, 2.5));
    this.segna('ramo_vivo', A.punto(2.1, 0.2, 2.2));
    // ricci vuoti per terra, amenti sul ramo basso, il ramo vivo a Mane (segnaposto leggibili)
    const g = new GeomBuilder();
    for (let i = 0; i < 9; i++) A.scatola(g, -1.6 + Math.sin(i * 2.1) * 0.7, -1.2 + Math.cos(i * 1.7) * 0.6, 0, 0.12, 0.08, 0.12, [0.55, 0.42, 0.22]);
    A.scatola(g, 0.65, -0.75, 2.45, 0.06, 0.06, 1.6, [0.45, 0.4, 0.34], 0, 35);
    for (let i = 0; i < 5; i++) A.scatola(g, 1.0 + i * 0.12, -1.2 - i * 0.1, 2.25, 0.04, 0.32, 0.04, [0.86, 0.8, 0.45]);
    A.scatola(g, 1.2, 0.1, 2.15, 1.9, 0.08, 0.08, [0.42, 0.36, 0.28]);
    A.scatola(g, 2.0, 0.2, 2.1, 0.5, 0.1, 0.1, [0.36, 0.55, 0.28]);
    for (let i = 0; i < 4; i++) A.scatola(g, 2.05 + i * 0.08, 0.2, 2.2, 0.08, 0.12, 0.16, [0.4, 0.62, 0.3]);
    this.aggiungiMesh(g, 'castagno-morto-dettagli');

    const bt = luogo('botola')!;
    this.botola = this.posa(creaBotolaCripta({ seme: 'botola', apertaAllInizio: false, boccaBuia: true }), bt.z, bt.theta, groundHeight(bt.z, bt.theta), 120, false);
    this.segna('botola', this.mondo(this.botola, new Vector3(0, 0.4, 0)));

    // --- il cippo con il chiodo 11 ---
    const cs11 = CAPISALDI.find((c) => c.id === 'cs_11')!;
    // --- i capisaldi della rete di Corbella (il Pilastro 1 è sul campanile del motore) ---
    for (const c of CAPISALDI) {
      if (c.id === 'cs_1') {
        const cb = LAYOUT_CAMPANILE;
        const base = surfaceHeight(cb.z, cb.theta) - 0.8;
        this.segna('chiodo_cs_1', cylToWorld(c.z, c.theta, base + cb.height - 1.2));
        this.segna('segnale_cs_1', cylToWorld(cb.z, cb.theta, base + cb.height + 5.6 + 4.5));
        continue;
      }
      const hc = groundHeight(c.z, c.theta);
      const yaw = yawVerso(c.z, c.theta, LAYOUT_CAMPANILE.z, LAYOUT_CAMPANILE.theta);
      const o = this.posa(creaCaposaldoDaContenuto({ numero: c.numero, tipo: c.tipo, nome: c.nome, luogo: c.luogo, altezza_segnale: c.altezza_segnale, note: c.note }), c.z, c.theta, hc, yaw);
      const chiodo = o.punti['chiodo'] ? this.mondo(o, o.punti['chiodo']) : cylToWorld(c.z, c.theta, hc + 0.1);
      this.segna(`chiodo_${c.id}`, chiodo);
      this.segna(`segnale_${c.id}`, o.punti['cima'] ? this.mondo(o, o.punti['cima']) : chiodo.clone());
    }
    this.segna('lente_cippo', this.punti.get(`chiodo_${cs11.id}`)!.clone());

    // --- il muretto del belvedere ---
    const bm = luogo('belvedere_muretto')!;
    const hBm = groundHeight(bm.z, bm.theta);
    const yawBm = yawVerso(bm.z, bm.theta, LAYOUT_CAMPANILE.z, LAYOUT_CAMPANILE.theta) + 90;
    const muretto = this.posa(creaMuroSecco({ seme: 'belvedere', lunghezza: 6, altezza: 0.55, spessore: 0.5 }), bm.z, bm.theta, hBm - 0.05, yawBm);
    this.segna('muretto', this.mondo(muretto, new Vector3(0, 0.6, 0)));

    // --- il castagno del cartellino, sulla Terrazza Pedrazzini ---
    const cc = luogo('castagno_cartellino')!;
    const hCc = groundHeight(cc.z, cc.theta);
    const vivo = this.posa(creaCastagno({ seme: 'cartellino', altezza: 9, stagione: 'autunno' }), cc.z, cc.theta, hCc - 0.1, 30);
    const B = new Ancora(cc.z, cc.theta, hCc);
    this.segna('castagno_cartellino', this.mondo(vivo, new Vector3(0, 1.3, 0)));
    this.segna('cartellino', B.punto(0.75, 0.3, 1.55));
    this.segna('lente_innesto_vecchio', B.punto(0.45, 0.2, 1.25));
    this.segna('innesto', B.punto(0.9, 0.35, 1.7));
    const gc = new GeomBuilder();
    B.scatola(gc, 0.75, 0.3, 1.45, 0.16, 0.1, 0.02, [0.7, 0.72, 0.74]); // zinco
    B.scatola(gc, 0.9, 0.3, 1.62, 1.2, 0.09, 0.09, [0.45, 0.35, 0.26], 0, 60); // il ramo basso
    this.aggiungiMesh(gc, 'cartellino');

    // --- il fienile di Ottavio ---
    const fo = luogo('fienile_ottavio')!;
    const hFo = groundHeight(fo.z, fo.theta);
    const fienile = this.posa(creaFienile({ seme: 'fienile-ottavio' }), fo.z, fo.theta, hFo - 0.2, yawVerso(fo.z, fo.theta, 1163, 51.9));
    this.segna('fienile', this.mondo(fienile, fienile.punti['porta'] ?? new Vector3(0, 1, 3)).add(new Vector3()));
    this.lumi.push(this.mondo(fienile, new Vector3(0, 2.2, 3.3)));

    // --- la Bacheca delle Ore, il telo dell'Ombrista, la scatola di Pina ---
    const bc = luogo('bacheca_ore')!;
    const C = new Ancora(bc.z, bc.theta, groundHeight(bc.z, bc.theta), yawVerso(bc.z, bc.theta, 1046, 37));
    const gb = new GeomBuilder();
    C.scatola(gb, -0.8, 0, 0, 0.12, 2.2, 0.12, LEGNO);
    C.scatola(gb, 0.8, 0, 0, 0.12, 2.2, 0.12, LEGNO);
    C.scatola(gb, 0, 0, 1.0, 1.9, 1.1, 0.08, LEGNO_CHIARO);
    C.scatola(gb, -0.4, -0.05, 1.2, 0.5, 0.6, 0.02, CARTA);
    C.scatola(gb, 0.35, -0.05, 1.3, 0.45, 0.5, 0.02, CARTA);
    C.scatola(gb, 0, 0, 2.1, 2.1, 0.12, 0.4, [0.36, 0.33, 0.32]);
    this.aggiungiMesh(gb, 'bacheca');
    this.colliders.add(C.collisoreScatola(0, 0, 0, 2.0, 2.2, 0.3, 'bacheca'));
    this.segna('bacheca', C.punto(0, -0.1, 1.5));

    const to = luogo('telo_ombrista')!;
    const D = new Ancora(to.z, to.theta, groundHeight(to.z, to.theta), yawVerso(to.z, to.theta, 1046, 37));
    const gt = new GeomBuilder();
    D.scatola(gt, -1.8, 0, 0, 0.1, 3.2, 0.1, LEGNO);
    D.scatola(gt, 1.8, 0, 0, 0.1, 3.2, 0.1, LEGNO);
    D.scatola(gt, 0, 0, 0.9, 3.5, 2.2, 0.03, [0.94, 0.9, 0.82], 0.25);
    this.aggiungiMesh(gt, 'telo-ombrista');
    this.segna('telo', D.punto(0, 0, 1.8));
    this.lumi.push(D.punto(0, 1.2, 1.5));

    const sp = luogo('soglia_pina')!;
    const E = new Ancora(sp.z, sp.theta, groundHeight(sp.z, sp.theta), yawVerso(sp.z, sp.theta, 1046, 37));
    const gs = new GeomBuilder();
    E.scatola(gs, 0.9, 0.9, 0, 0.6, 0.35, 0.42, [0.62, 0.5, 0.36]);
    E.scatola(gs, 0.9, 0.9, 0.35, 0.56, 0.02, 0.38, [0.18, 0.16, 0.16]);
    for (let i = 0; i < 4; i++) E.scatola(gs, 0.75 + i * 0.1, 0.92, 0.3, 0.02, 0.2, 0.14, [0.12, 0.1, 0.1]);
    this.aggiungiMesh(gs, 'scatola-pina');
    this.segna('scatola_pina', E.punto(0.9, 0.9, 0.4));

    // --- il campanile: la porta sul lato della piazza ---
    const cb = LAYOUT_CAMPANILE;
    const yawC = yawVerso(cb.z, cb.theta, 1046, 37);
    const F = new Ancora(cb.z, cb.theta, surfaceHeight(cb.z, cb.theta) - 0.8, yawC);
    this.segna('porta_campanile', F.punto(0, 2.95, 2.0));

    // --- elementi mobili ---
    this.costruisciElementi();
  }

  private aggiungiMesh(g: GeomBuilder, nome: string, doppio = false): Mesh {
    const m = new Mesh(g.build(), doppio ? this.doppio : this.materiale);
    m.name = nome;
    this.gruppo.add(m);
    return m;
  }

  private variante(elemento: string, id: string, o: Object3D): void {
    let m = this.varianti.get(elemento);
    if (!m) this.varianti.set(elemento, (m = new Map()));
    m.set(id, o);
  }

  private costruisciElementi(): void {
    // E1 — la passerella del Messo: tre assi sul riale (Abitata) o accatastate sulla riva (Carta)
    const pm = luogo('passerella_messo')!;
    const P = new Ancora(pm.z, pm.theta, groundHeight(pm.z, pm.theta));
    const assi = new GeomBuilder();
    for (const dn of [-0.45, 0, 0.45]) P.scatola(assi, 0, dn, 0.25, 4.6, 0.08, 0.4, LEGNO_CHIARO);
    P.scatola(assi, -2.6, 0, 0, 0.6, 0.35, 1.5, [0.55, 0.52, 0.48]);
    P.scatola(assi, 2.6, 0, 0, 0.6, 0.35, 1.5, [0.55, 0.52, 0.48]);
    const mucchio = new GeomBuilder();
    for (let i = 0; i < 3; i++) P.scatola(mucchio, -3.4, 1.2, 0.08 * i, 0.4, 0.08, 3.2, LEGNO_CHIARO, 0, 8 * i);
    this.variante('E1', 'Abitata', this.aggiungiMesh(assi, 'E1-abitata'));
    this.variante('E1', 'Carta', this.aggiungiMesh(mucchio, 'E1-carta'));
    this.segna('passerella', P.punto(0, 0, 0.6));

    // E4 — la scorciatoia delle Terrazze: sei gradini di assi o le assi accatastate
    const st = luogo('scorciatoia_terrazze')!;
    const T = new Ancora(st.z, st.theta, groundHeight(st.z, st.theta));
    const gradini = new GeomBuilder();
    for (let i = 0; i < 6; i++) T.scatola(gradini, 0, -2.5 + i, -0.1 + i * 0.35, 1.2, 0.08, 0.35, LEGNO_CHIARO);
    const assiT = new GeomBuilder();
    for (let i = 0; i < 6; i++) T.scatola(assiT, 1.6, 0.2, 0.08 * i, 1.2, 0.08, 0.35, LEGNO_CHIARO, 0, 4 * i);
    this.variante('E4', 'Abitata', this.aggiungiMesh(gradini, 'E4-abitata'));
    this.variante('E4', 'Carta', this.aggiungiMesh(assiT, 'E4-carta'));

    // E2 — la casa di Nando: intera, smontata (stessa pianta), rudere
    const cn = luogo('casa_nando')!;
    const hCn = groundHeight(cn.z, cn.theta);
    const yawCn = yawVerso(cn.z, cn.theta, 1046, 37);
    const intera = this.posa(creaRustico({ seme: 'nando', piani: 1, balcone: 'nessuno', camino: true }), cn.z, cn.theta, hCn - 0.3, yawCn, false);
    const smontata = this.posa(creaRustico({ seme: 'nando', piani: 1, balcone: 'nessuno', camino: true, smontato: true, crollo: 0.5 }), cn.z, cn.theta, hCn - 0.3, yawCn, false);
    const rudere = this.posa(creaMuroSecco({ seme: 'rudere-nando', lunghezza: 4, altezza: 0.5 }), cn.z, cn.theta, hCn - 0.1, yawCn, false);
    this.variante('E2', 'Abitata', intera.gruppo);
    this.variante('E2', 'Smontata', smontata.gruppo);
    this.variante('E2', 'Carta', rudere.gruppo);
    this.segna('casa_nando', cylToWorld(cn.z, cn.theta, hCn + 1.5));

    // E3 — il muro di Ronco: intero (Carta) o con la breccia (Abitata)
    const mr = luogo('muro_ronco')!;
    const hMr = groundHeight(mr.z, mr.theta);
    const yawMr = yawVerso(mr.z, mr.theta, 1046, 37) + 90;
    const intero = this.posa(creaMuroSecco({ seme: 'ronco', lunghezza: 12, altezza: 1.4 }), mr.z, mr.theta, hMr - 0.1, yawMr, false);
    const breccia = new Group();
    const M = new Ancora(mr.z, mr.theta, hMr - 0.1, yawMr);
    const gm = new GeomBuilder();
    M.scatola(gm, -3.8, 0, 0, 4.4, 1.4, 0.6, [0.6, 0.58, 0.55]);
    M.scatola(gm, 3.8, 0, 0, 4.4, 1.4, 0.6, [0.6, 0.58, 0.55]);
    M.scatola(gm, 0, 0.8, 0, 1.5, 0.3, 1.0, [0.55, 0.53, 0.5]);
    breccia.add(new Mesh(gm.build(), this.materiale));
    this.gruppo.add(breccia);
    this.variante('E3', 'Carta', intero.gruppo);
    this.variante('E3', 'Abitata', breccia);
  }
}
