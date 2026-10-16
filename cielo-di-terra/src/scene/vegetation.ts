/**
 * Alberi del cilindro (traccia «natura»): castagni delle selve, betulle ai margini, larici in alto,
 * noci nei prati, cipressi vicino alla chiesa. Boschi fitti sui versanti, alberi sparsi nei prati.
 *
 * Livelli di dettaglio (distanze per la qualità Alta, scalate da `impostaQualita`/`impostaDistanze`):
 * - LOD 0 (0-40 m): carte di foglie rivolte alla camera sopra le masse della chioma (il nucleo in
 *   ombra; per le latifoglie, `SOLO_CARTE`, le masse fanno solo l'ombra e non si vedono), tronco a
 *   radici di contrafforte con le branche;
 * - LOD 1 (40-130 m), LOD 2 (130-280 m): meno masse e carte più grandi, tronco semplice;
 * - oltre 280 m gli alberi dei boschi lasciano il posto alle masse dipinte dei boschi lontani
 *   (`scene/bosco.ts`), quelli sparsi a un LOD 3 statico (una InstancedMesh per specie con tutti gli
 *   alberi sparsi, che compare da sola con la distanza nello shader).
 * I passaggi fra livelli sono retinati (`uSfuma` in `render/naturaMateriali.ts`): niente salti.
 *
 * Ogni ~12 m di spostamento della camera gli alberi vicini (una griglia di celle da 64 m) vengono
 * ridistribuiti fra i livelli. I tronchi hanno collisori cilindrici con il tag `castagno` (il
 * popolamento di Corbella li toglie dove costruisce: `liberaCastagni`).
 */
import { ClampToEdgeWrapping, DataTexture, Group, InstancedBufferAttribute, InstancedMesh, LinearFilter, Matrix4, RedFormat, RepeatWrapping, UnsignedByteType, Vector3, type BufferGeometry, type Material, type ShaderMaterial } from 'three';
import { DEG, L, LAYOUT, METERS_PER_DEG } from '../world/constants';
import { cylToWorld, surfaceDistance, upAt, worldToCyl } from '../world/cylinder';
import { ColliderWorld, cylinderAt } from '../world/colliders';
import { Simplex3, clamp, mulberry32, smoothstep } from '../world/noise';
import { STRIPS, WATER_HEIGHT, createMasks, slopeAt, surfaceHeight, type TerrainMasks } from '../world/terrain';
import type { RGB } from '../render/palette';
import { surfaceMatrix } from '../render/placement';
import { creaMaterialeNatura, impostaNucleo, impostaSfuma } from '../render/naturaMateriali';
import type { WorldUniforms } from '../render/uniforms';
import { LAYER_OMBRE } from '../render/ombre';
import { N_LOD_ALBERI, SPECIE, geometrieAlbero, triangoli, type Specie } from './alberi';
import { BoschiLontani, densitaBosco } from './bosco';
import { Sottobosco, aggiorna } from './sottobosco';
import { distanzaTratto, suSentiero, trattiVicini } from './sentieri';
import luoghiJson from '../../content/luoghi.json';
import capisaldiJson from '../../content/capisaldi.json';

export interface TreeInstance {
  pos: Vector3;
  matrix: Matrix4;
  /** colore principale della chioma */
  tint: RGB;
  /** colore secondario (oro, ruggine…) e quota di masse che lo prendono */
  tint2?: RGB;
  quota?: number;
  specie?: Specie;
  /** albero di bosco (oltre 280 m lo sostituiscono le masse dei boschi lontani) */
  bosco?: boolean;
  seme?: number;
}

/** Tinte d'ottobre per specie: [principale, secondario, quota del secondario]. */
const TINTE: Record<Specie, Array<[RGB, RGB, number]>> = {
  // (rifinitura 2: verdi più chiari, verso l'oliva #8a8f45 del bozzetto 2, oro #c8a040 e ruggine
  // #a0522d: da vicino le chiome erano grumi verde scuro)
  castagno: [
    [[0.45, 0.49, 0.25], [0.78, 0.63, 0.25], 0.45],
    [[0.5, 0.52, 0.25], [0.63, 0.32, 0.18], 0.35],
    [[0.41, 0.47, 0.24], [0.8, 0.66, 0.3], 0.3],
    [[0.55, 0.53, 0.26], [0.72, 0.5, 0.22], 0.55],
    [[0.44, 0.48, 0.25], [0.54, 0.56, 0.27], 0.5],
  ],
  betulla: [
    [[0.8, 0.67, 0.3], [0.56, 0.56, 0.28], 0.35],
    [[0.74, 0.62, 0.28], [0.82, 0.72, 0.38], 0.4],
  ],
  // (oro d'ottobre spento, #a87a2a: non un candelotto arancione)
  larice: [
    [[0.66, 0.48, 0.17], [0.5, 0.48, 0.25], 0.3],
    [[0.62, 0.45, 0.17], [0.7, 0.55, 0.24], 0.35],
  ],
  noce: [
    [[0.52, 0.53, 0.27], [0.74, 0.62, 0.3], 0.45],
    [[0.58, 0.55, 0.27], [0.45, 0.5, 0.25], 0.4],
  ],
  cipresso: [[[0.19, 0.26, 0.16], [0.24, 0.31, 0.18], 0.4]],
};

/** Cipressi vicino alla chiesa di San Vigilio (z, theta): il popolamento toglie quelli d'ingombro. */
const CIPRESSI: Array<[number, number]> = [
  [1076, 39.6],
  [1079, 39.9],
  [1070, 41.4],
  [1084, 36.1],
  [1052, 41.5],
  [1093, 38.4],
];

const VILLAGE = LAYOUT.villages[0]!;

/**
 * Collisori dei tronchi (rifinitura 2, in attesa dell'approvazione del cambio di gioco: i boschi fitti
 * della traccia «natura» avevano portato i tronchi con collisore da 5140 a 23 275). Con `true` il
 * collisore ce l'hanno gli alberi dove si cammina: quelli sparsi (prati, filari, castagni da frutto)
 * e, nei boschi, quelli entro `RAGGIO_CAMMINO` m da un sentiero o da un luogo del gioco o dentro
 * l'anello del paese e delle terrazze. Nel fitto dei boschi lontani da tutto i tronchi restano senza
 * collisore (come i rami e le chiome). `false` = tutti col collisore, come nella rifinitura 1.
 */
export const COLLISORI_SOLO_DOVE_SI_CAMMINA = true;
const RAGGIO_CAMMINO = 60;
const LUOGHI_CAMMINO: Array<{ z: number; theta: number; raggio?: number }> = [
  ...(luoghiJson as Array<{ z: number; theta: number; raggio?: number; tipo?: string }>).filter((l) => l.tipo !== 'cielo' && l.tipo !== 'interno'),
  ...((capisaldiJson as { rete_corbella?: Array<{ z: number; theta: number }> }).rete_corbella ?? []),
];

/** Raggio della chioma (m) dell'albero «tipo» di ogni specie (l'istanza lo scala): per l'ombra a terra. */
const RAGGIO_CHIOMA: Record<Specie, number> = { castagno: 5.0, noce: 4.4, betulla: 2.6, larice: 2.8, cipresso: 1.4 };
/** Texel della texture delle ombre degli alberi: lungo l'arco e lungo z (circa 4 m ciascuno). */
const OMBRA_W = 1024;
const OMBRA_H = 768;

/** Distanze dei livelli di dettaglio alla qualità Alta (m). */
const DISTANZE_ALTA = [40, 130, 280];
const CELLA = 64;

interface Livello {
  chioma: InstancedMesh;
  /** carte di foglie (LOD 0 e 1) */
  carte: InstancedMesh | null;
  tronco: InstancedMesh | null;
  capienza: number;
}

/** Specie la cui chioma, ai livelli 0 e 1, è fatta di sole carte di foglie (le masse fanno solo ombra). */
const SOLO_CARTE: readonly Specie[] = ['castagno', 'noce', 'betulla'];

/** Istanze al più per livello e specie (vicino ne bastano poche). */
const CAPIENZA = [900, 4000, 14000];

export class Vegetation {
  readonly group = new Group();
  readonly trees: TreeInstance[] = [];
  /** Distanze di passaggio fra i LOD (m): [0→1, 1→2, 2→lontano]. */
  lodDistances = DISTANZE_ALTA.slice();
  private lastCam = new Vector3(1e9, 0, 0);
  private readonly u: WorldUniforms;
  /** per specie: livelli 0..2 dinamici */
  private livelli = new Map<Specie, Livello[]>();
  /** per specie: livello 3 statico (alberi sparsi), masse e carte */
  private lontani = new Map<Specie, InstancedMesh[]>();
  /**
   * per specie: chi proietta l'ombra degli alberi (masse e tronco del LOD 2, solo sul layer delle
   * ombre), per tutti gli alberi entro il raggio della zona d'ombra: l'ombra non sparisce più di
   * colpo quando l'albero passa dal LOD 0 al LOD 1
   */
  private ombre = new Map<Specie, { chioma: InstancedMesh; tronco: InstancedMesh | null; capienza: number }>();
  /** raggio (m) della zona d'ombra (0 = ombre spente): vedi `impostaRaggioOmbre` */
  private raggioOmbre = 0;
  private materiali: { chioma: ShaderMaterial[]; tronco: ShaderMaterial[]; lontano: ShaderMaterial; carte: Map<Specie, ShaderMaterial[]>; carteLontane: Map<Specie, ShaderMaterial> };
  private celle = new Map<number, number[]>();
  private indicizzati = -1;
  private conteggi = [0, 0, 0, 0];
  /** le masse dei boschi lontani (oltre l'ultimo livello) */
  readonly boschi: BoschiLontani;
  /** erba, felci, fiori, cespugli, sassi, foglie e ricci vicino alla camera */
  readonly sottobosco: Sottobosco;

  constructor(material: Material, _trunkMaterial: Material, colliders: ColliderWorld, seed = 99) {
    this.group.name = 'alberi';
    // i materiali della vegetazione usano gli stessi uniform del mondo (quelli del materiale passato)
    this.u = (material as ShaderMaterial).uniforms as unknown as WorldUniforms;
    this.materiali = {
      chioma: [0, 1, 2].map((lod) => {
        const m = creaMaterialeNatura(this.u, { tipo: 'chioma' });
        // sotto le carte di foglie le masse sono l'interno in ombra della chioma
        // (0.85: più piccolo, coperto dalle carte, e meno scuro: non palle scure lisce)
        impostaNucleo(m, lod === 0 ? 0.85 : lod === 1 ? 0.88 : 0.92);
        return m;
      }),
      tronco: [0, 1, 2].map(() => creaMaterialeNatura(this.u, { tipo: 'tronco' })),
      lontano: creaMaterialeNatura(this.u, { tipo: 'chioma' }),
      // carte di foglie: un materiale per specie e livello (la forma delle foglie è della specie)
      carte: new Map(SPECIE.map((sp) => [sp, [0, 1, 2].map(() => creaMaterialeNatura(this.u, { tipo: 'carte', foglia: geometrieAlbero(sp).forma }))])),
      carteLontane: new Map(SPECIE.map((sp) => [sp, creaMaterialeNatura(this.u, { tipo: 'carte', foglia: geometrieAlbero(sp).forma })])),
    };
    this.pianta(colliders, seed);
    this.costruisciMesh();
    this.costruisciOmbraAlberi();
    this.boschi = new BoschiLontani(this.u);
    this.group.add(this.boschi.group);
    this.sottobosco = new Sottobosco(this.u, colliders, this.trees, this.tronchiLiberi);
    this.group.add(this.sottobosco.group);
    this.impostaDistanze(1);
  }

  /**
   * Qualità della vegetazione (`PresetQualita.vegetazione`: Bassa ~0.45, Media ~0.75, Alta 1):
   * distanze dei livelli di dettaglio degli alberi, raggio e densità del sottobosco.
   */
  impostaQualita(k: number): void {
    // sotto Alta (k < 0.8: Media 0,6, Bassa 0,35) niente carte di foglie ai livelli lontani (LOD 2 e
    // 3): solo le masse dipinte (rifinitura 2: margine per i 60 fps a Media su una integrata); a Bassa
    // anche una fascia di passaggio più larga (senza il filtro pittorico la retinatura si vede a puntini)
    this.carteLontane = k >= 0.8;
    this.fascia = k < 0.5 ? 1.6 : 1;
    for (const ms of this.lontani.values()) if (ms[1]) ms[1].visible = this.carteLontane;
    this.impostaDistanze(0.55 + 0.45 * clamp(k, 0, 1.3));
    this.sottobosco.impostaQualita(k);
  }
  /** carte di foglie ai LOD 2 e 3 (spente a Bassa) */
  private carteLontane = true;
  /** larghezza relativa delle fasce di passaggio fra i livelli (più larga a Bassa) */
  private fascia = 1;

  // ---------------------------------------------------------------------------------- piantare

  private pianta(colliders: ColliderWorld, seed: number): void {
    const rnd = mulberry32(seed);
    const noise = new Simplex3(seed);
    const masks = createMasks();
    const passo = 8.5;
    for (const strip of STRIPS) {
      if (strip.kind !== 'valle') continue;
      const forest = LAYOUT.forests.find((f) => f.strip === strip.id);
      const k = forest ? forest.density : 0.2;
      const arcLen = (strip.thetaEnd - strip.thetaStart) * METERS_PER_DEG;
      for (let z = 5; z < L - 5; z += passo) {
        for (let a = 2; a < arcLen - 2; a += passo) {
          const zz = z + (rnd() - 0.5) * passo * 0.9;
          const th = strip.thetaStart + (a + (rnd() - 0.5) * passo * 0.9) / METERS_PER_DEG;
          const pr = rnd();
          const h = surfaceHeight(zz, th, masks);
          if (masks.capN > 0 || masks.capS > 0.4) continue;
          if (masks.lakeQ < 1.08 || (h < WATER_HEIGHT + 0.6 && masks.theme === 'lago')) continue;
          if (masks.piazza > 0) continue;
          if (masks.stream < 6) continue;
          const slope = slopeAt(zz, th, false);
          const f = densitaBosco(zz, th, h, slope, masks);
          // boschi: probabilità alta dove la densità supera la soglia (chiome che si toccano)
          let d = smoothstep(0.06, 0.5, f) * (0.45 + 0.55 * k);
          // alberi sparsi nei prati (nel paese quasi nessuno: lo costruisce il popolamento)
          // (a gruppi: boschetti, filari lungo i muri e qualche albero solo, non pois sui prati)
          const tt = th * DEG;
          const gruppi = smoothstep(0.52, 0.78, noise.noise((-Math.sin(tt) * 646) / 75, (-Math.cos(tt) * 646) / 75, zz / 75) * 0.5 + 0.5);
          d = Math.max(d, (0.002 + 0.05 * gruppi) * (1 - masks.bank) * (1 - 0.9 * smoothstep(0.05, 0.5, masks.village)));
          // selva castanile sulle terrazze attorno al paese (castagni da frutto radi, come nel
          // bozzetto 2), fuori dal nucleo delle case e dalla fascia dei muri del Velo
          let frutto = false;
          if (masks.village > 0.02 && strip.theme === 'selve') {
            const dv = surfaceDistance(zz, th, VILLAGE.zCenter, VILLAGE.thetaCenter);
            const anello = smoothstep(105, 135, dv) * (1 - smoothstep(280, 320, dv));
            const corridoio = zz > 945 && zz < 1060 && th > 23 && th < 39;
            const pf = corridoio ? 0 : 0.085 * anello * (1 - smoothstep(0.35, 0.6, slope));
            if (pf > d) {
              d = pf;
              frutto = true;
            }
          }
          if (pr > d) continue;
          // niente tronchi sui sentieri di campagna (scene/sentieri.ts)
          if (suSentiero(zz, th, trattiVicini(zz, zz, th * METERS_PER_DEG, th * METERS_PER_DEG, 4)) > 0.3) continue;
          const base = cylToWorld(zz, th, h);
          // (anche i tronchi senza collisore tengono la distanza: la semina resta quella di prima)
          const pb = base.clone().addScaledVector(upAt(th), 1.2);
          if (colliders.pointInside(pb, 3.0) || this.tronchiLiberi.pointInside(pb, 3.0)) continue;
          const specie = frutto ? (rnd() < 0.85 ? 'castagno' : 'noce') : this.scegliSpecie(rnd, masks, h, f);
          const bosco = f > 0.32 && !frutto;
          this.aggiungiAlbero(colliders, rnd, noise, zz, th, h, specie, bosco, strip.theme === 'selve');
        }
      }
    }
    // cipressi della chiesa
    for (const [z, th] of CIPRESSI) {
      const h = surfaceHeight(z, th, masks);
      const base = cylToWorld(z, th, h);
      const pb = base.clone().addScaledVector(upAt(th), 1.2);
      if (colliders.pointInside(pb, 1.5) || this.tronchiLiberi.pointInside(pb, 1.5)) continue;
      this.aggiungiAlbero(colliders, rnd, noise, z, th, h, 'cipresso', false, false, 0.85 + rnd() * 0.25);
    }
  }

  private scegliSpecie(rnd: () => number, m: TerrainMasks, h: number, f: number): Specie {
    const r = rnd();
    const alto = smoothstep(55, 95, h);
    if (m.capS > 0.02) return r < 0.7 ? 'larice' : 'betulla';
    if (m.theme === 'selve') {
      if (r < alto * 0.35) return 'larice';
      if (f < 0.3 && r > 0.82) return 'betulla';
      if (m.village > 0.05 && r > 0.75) return 'noce';
      return r > 0.93 ? 'betulla' : 'castagno';
    }
    if (m.theme === 'lago') {
      if (r < alto * 0.5 + 0.1) return 'larice';
      if (r < 0.45) return 'castagno';
      if (r < 0.75) return 'betulla';
      return 'noce';
    }
    if (r < 0.35) return 'noce';
    if (r < 0.65) return 'castagno';
    return 'betulla';
  }

  private aggiungiAlbero(colliders: ColliderWorld, rnd: () => number, noise: Simplex3, z: number, th: number, h: number, specie: Specie, bosco: boolean, autunno: boolean, scalaFissa?: number): void {
    const base = cylToWorld(z, th, h);
    const geo = geometrieAlbero(specie);
    const scale = scalaFissa ?? 0.74 + rnd() * 0.58 + noise.noise(base.x / 80, base.y / 80, base.z / 80) * 0.15;
    const sy = scale * (0.9 + rnd() * 0.2);
    const m = surfaceMatrix(z, th, h - 0.3, rnd() * 360, scale, sy, scale);
    const scelta = TINTE[specie][Math.floor(rnd() * TINTE[specie].length)]!;
    const tv = 0.9 + rnd() * 0.2;
    const t1: RGB = [scelta[0][0] * tv, scelta[0][1] * tv, scelta[0][2] * tv];
    const t2: RGB = [scelta[1][0] * tv, scelta[1][1] * tv, scelta[1][2] * tv];
    // ottobre: nelle selve più masse hanno girato; altrove l'autunno è appena cominciato
    const quota = clamp(scelta[2] + (rnd() - 0.5) * 0.35 + (autunno ? 0.1 : -0.12), 0, 1);
    this.trees.push({ pos: base, matrix: m, tint: t1, tint2: t2, quota, specie, bosco, seme: rnd() });
    const tronco = cylinderAt(z, th, h - 0.3, geo.raggioTronco * 1.25 * scale, (geo.altezzaFusto + 1.5) * sy, 'castagno');
    if (this.serveCollisore(z, th, bosco)) {
      colliders.add(tronco);
      this.collisoriTronchi++;
    } else this.tronchiLiberi.add(tronco);
  }

  /**
   * Tronchi del fitto senza collisore del giocatore (`serveCollisore` falso): stanno qui solo per la
   * semina (gli alberi seguenti ne tengono la distanza come prima) e per il sottobosco (niente erba
   * dentro i fusti). Non entrano nel mondo dei collisori: né la camera né la fisica li vedono.
   */
  private readonly tronchiLiberi = new ColliderWorld();

  /** Tronchi con il collisore (statistiche: vedi `COLLISORI_SOLO_DOVE_SI_CAMMINA`). */
  collisoriTronchi = 0;

  /** Il tronco in (z, theta) ha il collisore? Sempre, salvo nel fitto dei boschi lontani da tutto. */
  private serveCollisore(z: number, th: number, bosco: boolean): boolean {
    if (!COLLISORI_SOLO_DOVE_SI_CAMMINA || !bosco) return true;
    if (surfaceDistance(z, th, VILLAGE.zCenter, VILLAGE.thetaCenter) < 450) return true;
    const a = th * METERS_PER_DEG;
    for (const t of trattiVicini(z, z, a, a, RAGGIO_CAMMINO)) if (distanzaTratto(z, a, t) < RAGGIO_CAMMINO) return true;
    for (const l of LUOGHI_CAMMINO) if (Math.abs(l.z - z) < RAGGIO_CAMMINO + 40 && surfaceDistance(z, th, l.z, l.theta) < RAGGIO_CAMMINO + (l.raggio ?? 0)) return true;
    return false;
  }

  // ---------------------------------------------------------------------------------- mesh

  private costruisciMesh(): void {
    for (const sp of SPECIE) {
      const geo = geometrieAlbero(sp);
      const liv: Livello[] = [];
      const quanti = Math.max(1, this.trees.filter((t) => (t.specie ?? 'castagno') === sp).length);
      for (let lod = 0; lod < 3; lod++) {
        // capienza: gli alberi di una specie, al più quelli che stanno in un anello del livello
        const n = Math.min(quanti, CAPIENZA[lod]!);
        const chioma = this.istanze(geo.chioma[lod]!, this.materiali.chioma[lod]!, n, `alberi-${sp}-chioma-lod${lod}`, true);
        const cg = geo.carte[lod];
        const carte = cg ? this.istanze(cg, this.materiali.carte.get(sp)![lod]!, n, `alberi-${sp}-carte-lod${lod}`, true) : null;
        // (le carte sono degeneri nel passaggio delle ombre: non proiettano, inutile disegnarle)
        if (carte) carte.userData['ombra'] = false;
        // latifoglie da vicino: la chioma la fanno le sole carte di foglie (con i buchi di cielo dei
        // bozzetti); le masse sotto, viste, erano macchie scure in controluce. Restano solo come
        // sagoma che proietta l'ombra (layer delle ombre, non quello della camera)
        if (carte && lod < 2 && SOLO_CARTE.includes(sp)) chioma.layers.disable(0);
        const tg = geo.tronco[lod];
        const tronco = tg ? this.istanze(tg, this.materiali.tronco[lod]!, n, `alberi-${sp}-tronco-lod${lod}`, false) : null;
        // l'ombra la fanno i proiettori qui sotto (anche per il LOD 0)
        chioma.userData['ombra'] = false;
        if (tronco) tronco.userData['ombra'] = false;
        liv.push({ chioma, carte, tronco, capienza: n });
      }
      this.livelli.set(sp, liv);
      // proiettori d'ombra: masse e tronco del LOD 2 (la chioma intera, non il nucleo sotto le carte)
      const nO = Math.min(quanti, 700);
      const oc = this.istanze(geo.chioma[2]!, this.materiali.chioma[2]!, nO, `alberi-${sp}-ombra`, true);
      const ot = geo.tronco[2] ? this.istanze(geo.tronco[2]!, this.materiali.tronco[2]!, nO, `alberi-${sp}-ombra-tronco`, false) : geo.tronco[1] ? this.istanze(geo.tronco[1]!, this.materiali.tronco[1]!, nO, `alberi-${sp}-ombra-tronco`, false) : null;
      for (const m of [oc, ot]) {
        if (!m) continue;
        m.layers.set(LAYER_OMBRE);
        m.userData['ombra'] = true;
      }
      this.ombre.set(sp, { chioma: oc, tronco: ot, capienza: nO });
    }
    this.costruisciLontani();
  }

  private istanze(g: BufferGeometry, mat: Material, n: number, nome: string, chioma: boolean): InstancedMesh {
    const geo = g.clone();
    geo.setAttribute('aTint', new InstancedBufferAttribute(new Float32Array(n * 4), 4));
    if (chioma) geo.setAttribute('aTint2', new InstancedBufferAttribute(new Float32Array(n * 4), 4));
    const mesh = new InstancedMesh(geo, mat, n);
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.name = nome;
    this.group.add(mesh);
    return mesh;
  }

  private ombraTex: DataTexture | null = null;

  /**
   * Densità delle chiome su tutto il cilindro (rifinitura 2): una texture di circa 4 m per texel
   * (u = theta / 360, v = z / L) con un disco morbido per albero, largo quanto la sua chioma. Il
   * terreno la legge spostata dalla parte opposta alla luce (`ombraAlberi` in shaders/common.ts):
   * oltre la zona delle ombre portate è l'ombra degli alberi a terra, che li fa poggiare sul prato.
   */
  private costruisciOmbraAlberi(): void {
    const W = OMBRA_W;
    const H = OMBRA_H;
    const dati = this.ombraTex ? (this.ombraTex.image.data as Uint8Array) : new Uint8Array(W * H);
    dati.fill(0);
    const acc = new Float32Array(W * H);
    const mu = (360 * METERS_PER_DEG) / W; // metri per texel lungo l'arco
    const mz = L / H;
    const c = { z: 0, theta: 0, r: 0, h: 0 };
    const colonna = new Vector3();
    for (const t of this.trees) {
      worldToCyl(t.pos, c);
      const sc = colonna.setFromMatrixColumn(t.matrix, 0).length();
      const r = RAGGIO_CHIOMA[t.specie ?? 'castagno'] * sc;
      const u0 = ((c.theta / 360) * W) - 0.5;
      const v0 = (c.z / L) * H - 0.5;
      const ru = Math.ceil(r / mu) + 1;
      const rv = Math.ceil(r / mz) + 1;
      const iu = Math.round(u0);
      const iv = Math.round(v0);
      for (let dv = -rv; dv <= rv; dv++) {
        const y = iv + dv;
        if (y < 0 || y >= H) continue;
        for (let du = -ru; du <= ru; du++) {
          const d = Math.hypot((iu + du - u0) * mu, (y - v0) * mz);
          if (d > r) continue;
          // copertura: piena al centro, morbida sul bordo della chioma
          const k = 0.92 * smoothstep(r, r * 0.35, d);
          const x = (((iu + du) % W) + W) % W;
          const i = y * W + x;
          acc[i] = 1 - (1 - acc[i]!) * (1 - k);
        }
      }
    }
    for (let i = 0; i < W * H; i++) dati[i] = Math.round(acc[i]! * 255);
    if (!this.ombraTex) {
      const tex = new DataTexture(dati, W, H, RedFormat, UnsignedByteType);
      tex.wrapS = RepeatWrapping;
      tex.wrapT = ClampToEdgeWrapping;
      tex.magFilter = LinearFilter;
      tex.minFilter = LinearFilter;
      tex.generateMipmaps = false;
      tex.name = 'alberi-ombra';
      this.ombraTex = tex;
      this.u.uAlberiOmbra.value = tex;
      this.u.uAlberiInfo.value.x = 1;
    }
    this.ombraTex.needsUpdate = true;
  }

  /** Il livello 3: tutti gli alberi sparsi (non di bosco), statico. */
  private costruisciLontani(): void {
    for (const ms of this.lontani.values()) {
      for (const m of ms) {
        this.group.remove(m);
        m.geometry.dispose();
        // (anche il buffer delle matrici delle istanze)
        m.dispose();
      }
    }
    this.lontani.clear();
    for (const sp of SPECIE) {
      const lista = this.trees.filter((t) => (t.specie ?? 'castagno') === sp && !t.bosco);
      if (!lista.length) continue;
      const geo = geometrieAlbero(sp);
      const ms: InstancedMesh[] = [this.istanze(geo.chioma[N_LOD_ALBERI - 1]!, this.materiali.lontano, lista.length, `alberi-${sp}-chioma-lod3`, true)];
      const cg = geo.carte[N_LOD_ALBERI - 1];
      if (cg) ms.push(this.istanze(cg, this.materiali.carteLontane.get(sp)!, lista.length, `alberi-${sp}-carte-lod3`, true));
      for (const mesh of ms) {
        lista.forEach((t, i) => this.scrivi(mesh, i, t, true));
        mesh.count = lista.length;
        mesh.visible = mesh === ms[0] || this.carteLontane;
        mesh.userData['ombra'] = false;
        mesh.instanceMatrix.needsUpdate = true;
      }
      this.lontani.set(sp, ms);
    }
  }

  private scrivi(mesh: InstancedMesh, i: number, t: TreeInstance, chioma: boolean): void {
    t.matrix.toArray(mesh.instanceMatrix.array as Float32Array, i * 16);
    // (assegnazioni per indice: niente array temporanei per ogni albero)
    const a = (mesh.geometry.getAttribute('aTint') as InstancedBufferAttribute).array as Float32Array;
    const seme = t.seme ?? 0.5;
    const o = i * 4;
    if (chioma) {
      a[o] = t.tint[0];
      a[o + 1] = t.tint[1];
      a[o + 2] = t.tint[2];
      a[o + 3] = seme;
      const b = (mesh.geometry.getAttribute('aTint2') as InstancedBufferAttribute).array as Float32Array;
      const t2 = t.tint2 ?? t.tint;
      b[o] = t2[0];
      b[o + 1] = t2[1];
      b[o + 2] = t2[2];
      b[o + 3] = t.quota ?? 0.4;
    } else {
      const v = 0.85 + seme * 0.3;
      a[o] = v;
      a[o + 1] = v * (0.97 + seme * 0.05);
      a[o + 2] = v * 0.96;
      a[o + 3] = seme;
    }
  }

  /** Mette l'albero `t` nel livello `lod` della sua specie (se c'è posto). */
  private metti(liv: Livello[], cc: number[], lod: number, t: TreeInstance): void {
    const L = liv[lod]!;
    if (cc[lod]! >= L.capienza) return;
    const j = cc[lod]!++;
    this.scrivi(L.chioma, j, t, true);
    if (L.carte) this.scrivi(L.carte, j, t, true);
    if (L.tronco) this.scrivi(L.tronco, j, t, false);
    this.nLod[lod]!++;
  }

  /** Spostamenti delle celle attorno a quella della camera, dalla più vicina alla più lontana. */
  private offsetCelle(rc: number): Int32Array {
    if (this.offsetRc === rc && this.offset) return this.offset;
    const lista: Array<[number, number, number]> = [];
    for (let dz = -rc; dz <= rc; dz++) for (let da = -rc; da <= rc; da++) lista.push([dz, da, dz * dz + da * da]);
    lista.sort((a, b) => a[2] - b[2]);
    const out = new Int32Array(lista.length * 2);
    lista.forEach(([dz, da], i) => {
      out[i * 2] = dz;
      out[i * 2 + 1] = da;
    });
    this.offset = out;
    this.offsetRc = rc;
    return out;
  }
  private offset: Int32Array | null = null;
  private offsetRc = -1;
  private readonly nLod = [0, 0, 0];
  private readonly conta = new Map<Specie, number[]>(SPECIE.map((sp) => [sp, [0, 0, 0]]));
  private readonly contaOmbre = new Map<Specie, number[]>(SPECIE.map((sp) => [sp, [0]]));

  /**
   * Densità della vegetazione (0.4..1, dalla qualità): accorcia le distanze dei livelli di
   * dettaglio (Bassa ~0.55, Media ~0.8, Alta 1).
   */
  impostaDistanze(k: number): void {
    const f = clamp(k, 0.3, 1.5);
    this.lodDistances = DISTANZE_ALTA.map((d) => d * f);
    const [d0, d1, d2] = this.lodDistances as [number, number, number];
    const b0 = 7 * f * this.fascia;
    const b1 = 14 * f * this.fascia;
    const b2 = 26 * f * this.fascia;
    // comparsa/scomparsa complementari: dove uno sparisce l'altro compare, pixel per pixel
    impostaSfuma(this.materiali.chioma[0]!, 0, 0, d0 - b0, d0 + b0);
    impostaSfuma(this.materiali.tronco[0]!, 0, 0, d0 - b0, d0 + b0);
    impostaSfuma(this.materiali.chioma[1]!, d0 - b0, d0 + b0, d1 - b1, d1 + b1);
    impostaSfuma(this.materiali.tronco[1]!, d0 - b0, d0 + b0, d1 - b1, d1 + b1);
    impostaSfuma(this.materiali.chioma[2]!, d1 - b1, d1 + b1, d2 - b2, d2);
    impostaSfuma(this.materiali.tronco[2]!, d1 - b1, d1 + b1, d2 - b2, d2);
    impostaSfuma(this.materiali.lontano, d2 - b2, d2, 0, 0);
    for (const m of this.materiali.carteLontane.values()) impostaSfuma(m, d2 - b2, d2, 0, 0);
    for (const [c0, c1, c2] of this.materiali.carte.values()) {
      impostaSfuma(c0!, 0, 0, d0 - b0, d0 + b0);
      impostaSfuma(c1!, d0 - b0, d0 + b0, d1 - b1, d1 + b1);
      impostaSfuma(c2!, d1 - b1, d1 + b1, d2 - b2, d2);
    }
    this.boschi.impostaComparsa(d2 - b2, d2);
    this.lastCam.set(1e9, 0, 0);
  }

  /**
   * Raggio (m) della zona delle ombre portate (`PROFILI_OMBRE[q].raggio`, 0 = spente): gli alberi
   * entro questo raggio (più il passo della ridistribuzione) proiettano l'ombra.
   */
  impostaRaggioOmbre(r: number): void {
    if (Math.abs(r - this.raggioOmbre) < 1e-3) return;
    this.raggioOmbre = r;
    this.lastCam.set(1e9, 0, 0);
  }

  /** Inizio della comparsa delle masse dei boschi lontani (per `scene/bosco.ts`). */
  get inizioBoschi(): [number, number] {
    const d2 = this.lodDistances[2]!;
    return [d2 - 26 * (d2 / DISTANZE_ALTA[2]!), d2];
  }

  // ---------------------------------------------------------------------------------- celle

  private indicizza(): void {
    this.celle.clear();
    this.trees.forEach((t, i) => {
      const c = worldToCyl(t.pos);
      const k = this.chiave(Math.floor(c.z / CELLA), Math.floor((c.theta * METERS_PER_DEG) / CELLA));
      let l = this.celle.get(k);
      if (!l) this.celle.set(k, (l = []));
      l.push(i);
    });
    this.indicizzati = this.trees.length;
  }

  private chiave(iz: number, ia: number): number {
    const na = Math.ceil((360 * METERS_PER_DEG) / CELLA);
    return iz * 1000 + (((ia % na) + na) % na);
  }

  /** Ridistribuisce gli alberi fra i LOD (chiamare spesso: lavora solo se la camera si è mossa). */
  update(cam: Vector3, force = false): void {
    // le masse dei boschi lontani si costruiscono a pezzi (subito se richiesto)
    this.boschi.update(force ? 1e9 : 2);
    this.sottobosco.update(cam, force ? Infinity : 3);
    if (this.indicizzati !== this.trees.length) {
      // alberi tolti dal popolamento (liberaCastagni): rifà le celle, il livello statico e l'ombra
      this.indicizza();
      this.costruisciLontani();
      this.costruisciOmbraAlberi();
      force = true;
    }
    if (!force && cam.distanceToSquared(this.lastCam) < 12 * 12) return;
    this.lastCam.copy(cam);
    const [d0, d1, d2] = this.lodDistances as [number, number, number];
    const f = d2 / DISTANZE_ALTA[2]!;
    const b0 = 7 * f * this.fascia;
    const b1 = 14 * f * this.fascia;
    for (const cc of this.conta.values()) cc.fill(0);
    const c = worldToCyl(cam);
    const rc = Math.ceil((d2 + 20) / CELLA);
    const iz0 = Math.floor(c.z / CELLA);
    const ia0 = Math.floor((c.theta * METERS_PER_DEG) / CELLA);
    // vicino all'asse la camera vede l'altra metà: gli alberi vicini restano comunque quelli sotto
    const n = this.nLod;
    n.fill(0);
    // celle dalla più vicina alla più lontana: le istanze si disegnano più o meno dal davanti
    // all'indietro (la profondità scarta prima i frammenti delle chiome dietro)
    const off = this.offsetCelle(rc);
    const d2q = d2 * d2;
    // (la zona d'ombra segue la camera: si tiene il margine del passo di ridistribuzione)
    const rO = this.raggioOmbre > 0 ? this.raggioOmbre + 14 : 0;
    const rOq = rO * rO;
    for (const cc of this.contaOmbre.values()) cc[0] = 0;
    for (let k = 0; k < off.length; k += 2) {
      const l = this.celle.get(this.chiave(iz0 + off[k]!, ia0 + off[k + 1]!));
      if (!l) continue;
      for (const i of l) {
        const t = this.trees[i]!;
        const dq = t.pos.distanceToSquared(cam);
        if (dq > d2q) continue;
        const d = Math.sqrt(dq);
        const sp = t.specie ?? 'castagno';
        const liv = this.livelli.get(sp)!;
        const cc = this.conta.get(sp)!;
        if (dq < rOq) {
          const o = this.ombre.get(sp)!;
          const co = this.contaOmbre.get(sp)!;
          if (co[0]! < o.capienza) {
            const j = co[0]!++;
            t.matrix.toArray(o.chioma.instanceMatrix.array as Float32Array, j * 16);
            if (o.tronco) t.matrix.toArray(o.tronco.instanceMatrix.array as Float32Array, j * 16);
          }
        }
        // nelle fasce di passaggio l'albero sta in tutti e due i livelli (retinati)
        if (d < d0 + b0) this.metti(liv, cc, 0, t);
        if (d > d0 - b0 && d < d1 + b1) this.metti(liv, cc, 1, t);
        if (d > d1 - b1) this.metti(liv, cc, 2, t);
      }
    }
    for (const sp of SPECIE) {
      const liv = this.livelli.get(sp)!;
      const cc = this.conta.get(sp)!;
      for (let lod = 0; lod < 3; lod++) {
        const L = liv[lod]!;
        const q = cc[lod]!;
        for (const mesh of [L.chioma, L.carte, L.tronco]) {
          if (!mesh) continue;
          mesh.count = q;
          mesh.visible = q > 0 && (mesh !== L.carte || lod < 2 || this.carteLontane);
          // solo la parte usata dei buffer va alla scheda (non 11 MB di capienza)
          aggiorna(mesh.instanceMatrix, q * 16);
          aggiorna(mesh.geometry.getAttribute('aTint') as InstancedBufferAttribute, q * 4);
          const t2 = mesh.geometry.getAttribute('aTint2') as InstancedBufferAttribute | undefined;
          if (t2) aggiorna(t2, q * 4);
        }
      }
    }
    for (const [sp, o] of this.ombre) {
      const q = this.contaOmbre.get(sp)![0]!;
      for (const mesh of [o.chioma, o.tronco]) {
        if (!mesh) continue;
        mesh.count = q;
        mesh.visible = q > 0;
        aggiorna(mesh.instanceMatrix, q * 16);
      }
    }
    let lontani = 0;
    for (const ms of this.lontani.values()) lontani += ms[0]!.count;
    this.conteggi = [n[0]!, n[1]!, n[2]!, lontani];
  }

  /**
   * Numero di alberi per LOD (statistiche): [vicini, medi, lontani, sparsi statici, istanze del
   * sottobosco].
   */
  counts(): number[] {
    return [...this.conteggi, this.sottobosco.istanze];
  }

  /** Triangoli disegnati dagli alberi dinamici (stima per le statistiche). */
  triangoli(): number {
    let t = 0;
    for (const liv of this.livelli.values()) {
      for (const L of liv) {
        t += triangoli(L.chioma.geometry) * L.chioma.count;
        if (L.carte) t += triangoli(L.carte.geometry) * L.carte.count;
        if (L.tronco) t += triangoli(L.tronco.geometry) * L.tronco.count;
      }
    }
    return t;
  }
}
