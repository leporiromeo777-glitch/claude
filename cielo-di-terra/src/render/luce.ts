/**
 * Aggancio della traccia «luce» al gioco (una riga in `Game.init`).
 *
 * - crea le ombre morbide vicino alla camera (`Ombre`) e le registra come sistema del ciclo
 *   (`render` prima del disegno del mondo);
 * - dà ai castagni segnaposto del motore (`materials.crown` / `materials.trunk`) le superfici
 *   FOGLIAME e CORTECCIA, finché la traccia «natura» non tagga le sue geometrie (gli altri
 *   oggetti hanno già la superficie AUTO di `createWorldMaterial`);
 * - in sviluppo e nelle prove E2E espone `window.__LUCE__` (ombre, scena di prova delle superfici).
 *
 * Per spegnere o cambiare le ombre: `game.luce.ombre.impostaQualita('spente' | 'bassa' | 'media' | 'alta')`.
 */
import type { Camera, Material, Mesh, Scene, ShaderMaterial, WebGLRenderer } from 'three';
import { Ombre, type QualitaOmbre } from './ombre';
import { SUPERFICIE } from './superfici';
import type { WorldUniforms } from './uniforms';
import { impostaChioma, impostaSuperficieBase } from './worldMaterial';

/** Quello che serve del gioco (evita la dipendenza circolare da game.ts). */
export interface GiocoLuce {
  renderer: WebGLRenderer;
  cellTexture?: { ultimaRivelazione: number };
  scene: Scene;
  camera: Camera;
  uniforms: WorldUniforms;
  materials: Record<string, Material>;
  sistemi: { render?(frameDt: number): void }[];
}

export interface Luce {
  ombre: Ombre;
}

export function installaLuce(game: GiocoLuce, qualita: QualitaOmbre = 'media'): Luce {
  const ombre = new Ombre(game.renderer, game.scene, game.camera, game.uniforms, qualita);
  game.sistemi.push(ombre);
  // l'istante dell'ultima rivelazione animata: lo shader salta le celle vicino al giocatore
  game.sistemi.push({
    render: () => {
      game.uniforms.uCellAnim.value = game.cellTexture ? game.cellTexture.ultimaRivelazione : 1e9;
    },
  });
  const crown = game.materials['crown'] as ShaderMaterial | undefined;
  const trunk = game.materials['trunk'] as ShaderMaterial | undefined;
  if (crown?.uniforms) {
    impostaSuperficieBase(crown, SUPERFICIE.FOGLIAME);
    // chiome dei castagni segnaposto: centro a ~5.5 unità (vedi scene/vegetation.ts)
    impostaChioma(crown, 0.62, 5.5, 1.35);
  }
  if (trunk?.uniforms) impostaSuperficieBase(trunk, SUPERFICIE.CORTECCIA);
  // i costoloni delle Finestre sono di ferro (materiale "iron" di render/windows.ts): METALLO
  // invece di AUTO, che li leggerebbe come pietra e terra dal colore
  const costoloni = game.scene.getObjectByName('costoloni') as Mesh | undefined;
  const ferro = costoloni?.material as ShaderMaterial | undefined;
  if (ferro?.uniforms?.['uSuperficieBase']) impostaSuperficieBase(ferro, SUPERFICIE.METALLO);
  const luce: Luce = { ombre };
  if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1') {
    const w = window as unknown as { __LUCE__?: unknown };
    w.__LUCE__ = {
      ombre,
      /** Mostra la scena di prova delle superfici a (z, theta) (m, gradi); restituisce il gruppo. */
      provaSuperfici: async (z: number, theta: number, yaw = 0) => {
        const m = await import('./provaSuperfici');
        return m.mostraProvaSuperfici(game, z, theta, yaw);
      },
    };
  }
  return luce;
}
