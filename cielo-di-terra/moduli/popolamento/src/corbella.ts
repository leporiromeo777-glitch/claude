/**
 * installaCorbella(game, opzioni): sostituisce il paese segnaposto del motore con la Corbella vera
 * dei contenuti e restituisce la maniglia per l'integratore (punti, personaggi, varianti, dispose).
 */
import { Group, Vector3 } from 'three';
import type { Collider } from '../../../src/world/colliders';
import { impostaIntensitaLumi } from '../../oggetti/src/materiali';
import type { VoceCollider } from './cantiere';
import { Contesto } from './contesto';
import { costruisciPiazza } from './luoghi/piazza';
import { costruisciCampanile } from './luoghi/sanVigilio';
import { materialiMotore } from './materiali';
import { dentroCorbella, liberaCastagni, rimuoviSegnaposto, type RisultatoSegnaposto } from './segnaposto';
import type { GiocoCorbella, PuntoInterazione } from './tipi';

export interface OpzioniCorbella {
  /** 'rimuovi' (predefinito) toglie il paese segnaposto del motore; 'tieni' lo lascia (confronti) */
  segnaposto?: 'rimuovi' | 'tieni';
  /** avvolge `game.update` per animare personaggi, botola, lanterne (predefinito true) */
  agganciaCiclo?: boolean;
}

export interface StatisticheCorbella {
  zone: number;
  triangoli: number;
  collider: number;
  lumi: number;
  punti: number;
  castagniTolti: number;
  segnaposto: RisultatoSegnaposto | null;
  msCostruzione: number;
}

export interface ManigliaCorbella {
  /** radice di tutto il popolamento nella scena */
  readonly radice: Group;
  /** punti d'interazione per id */
  readonly punti: ReadonlyMap<string, PuntoInterazione>;
  punto(id: string): PuntoInterazione | undefined;
  /** punti attivi entro il loro raggio (o `raggioMax`) da una posizione mondo, dal più vicino */
  puntiVicini(pos: Vector3, raggioMax?: number): PuntoInterazione[];
  /** collider aggiunti al mondo, con tag e luogo */
  readonly collider: readonly VoceCollider[];
  readonly lumi: readonly Vector3[];
  readonly statistiche: StatisticheCorbella;
  /** da chiamare a ogni passo se `agganciaCiclo` è false */
  update(dt: number): void;
  dispose(): void;
}

export function installaCorbella(game: GiocoCorbella, opzioni: OpzioniCorbella = {}): ManigliaCorbella {
  const t0 = performance.now();
  const seg = (opzioni.segnaposto ?? 'rimuovi') === 'rimuovi' ? rimuoviSegnaposto(game) : null;
  const mat = materialiMotore(game);
  const ctx = new Contesto();

  costruisciPiazza(ctx);
  costruisciCampanile(ctx);

  // cottura delle zone
  const radice = new Group();
  radice.name = 'corbella';
  const collider: VoceCollider[] = [];
  const lumi: Vector3[] = [];
  const dimLumi: number[] = [];
  let triangoli = 0;
  for (const z of ctx.zone.values()) {
    radice.add(z.costruisci(mat));
    collider.push(...z.collider);
    lumi.push(...z.lumi);
    dimLumi.push(...z.dimensioniLumi);
    triangoli += z.triangoli;
  }
  collider.push(...ctx.colliderDinamici);
  radice.add(ctx.dinamici);
  game.scene.add(radice);
  for (const c of collider) game.world.colliders.add(c.collider);
  if (lumi.length) game.lamps.addLamps(lumi, dimLumi);

  const castagniTolti = liberaCastagni(game, (p) => {
    const c = cilDa(p);
    return ctx.occupato(c.z, c.theta, 1.5) || ctx.distanzaSentieri(c.z, c.theta) < 1.2;
  });

  const statistiche: StatisticheCorbella = {
    zone: ctx.zone.size,
    triangoli,
    collider: collider.length,
    lumi: lumi.length,
    punti: ctx.punti.size,
    castagniTolti,
    segnaposto: seg,
    msCostruzione: 0,
  };

  const update = (dt: number) => {
    impostaIntensitaLumi(game.sky?.night ?? 0);
    for (const a of ctx.animati) a.update?.(dt);
  };

  let origUpdate: ((dt: number) => void) | undefined;
  if ((opzioni.agganciaCiclo ?? true) && typeof game.update === 'function') {
    origUpdate = game.update;
    const legato = origUpdate.bind(game);
    game.update = (dt: number) => {
      legato(dt);
      update(dt);
    };
  }

  const maniglia: ManigliaCorbella = {
    radice,
    punti: ctx.punti,
    punto: (id) => ctx.punti.get(id),
    puntiVicini(pos, raggioMax) {
      const out: Array<{ p: PuntoInterazione; d: number }> = [];
      for (const p of ctx.punti.values()) {
        if (!p.attivo) continue;
        const d = p.pos.distanceTo(pos);
        if (d <= (raggioMax ?? p.raggio)) out.push({ p, d });
      }
      return out.sort((a, b) => a.d - b.d).map((x) => x.p);
    },
    collider,
    lumi,
    statistiche,
    update,
    dispose() {
      game.scene.remove(radice);
      radice.traverse((o) => {
        const m = o as unknown as { geometry?: { dispose(): void } };
        m.geometry?.dispose();
      });
      for (const c of collider) game.world.colliders.remove((c.collider as Collider).id);
      // lumi del popolamento
      const set = new Set(lumi.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`));
      const geo = game.lamps.points.geometry;
      const pos = geo.getAttribute('position');
      if (pos) {
        const lista: Vector3[] = [];
        const dim: number[] = [];
        const size = geo.getAttribute('aSize');
        for (let i = 0; i < pos.count; i++) {
          const p = new Vector3().fromBufferAttribute(pos, i);
          if (!set.has(`${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`)) {
            lista.push(p);
            dim.push(size ? size.getX(i) : 0.6);
          }
        }
        game.lamps.setLamps(lista, dim);
      }
      if (origUpdate) game.update = origUpdate;
    },
  };
  statistiche.msCostruzione = Math.round(performance.now() - t0);
  return maniglia;
}

function cilDa(p: Vector3): { z: number; theta: number } {
  const theta = ((Math.atan2(-p.x, -p.y) * 180) / Math.PI + 360) % 360;
  return { z: p.z, theta };
}

export { dentroCorbella };
