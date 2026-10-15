/**
 * Materiali del motore per il popolamento e adattamento degli oggetti animati della libreria.
 *
 * - `singolo`: il materiale del mondo per gli oggetti (`game.materials.object`, FrontSide);
 * - `doppio`: la stessa variante a doppia faccia (tele, veli, vele, foglie piatte).
 * Senza `uniforms` (banco di prova in Node) si usano materiali semplici con i colori per vertice.
 */
import { BufferAttribute, Color, DoubleSide, LinearSRGBColorSpace, MeshBasicMaterial, SRGBColorSpace, type BufferGeometry, type Material, type Mesh, type Object3D } from 'three';
import { createWorldMaterial } from '../render/worldMaterial';
import type { MaterialiCantiere } from './cantiere';
import type { GiocoCorbella } from './tipi';

export function materialiMotore(game: GiocoCorbella): MaterialiCantiere {
  if (game.uniforms) {
    const singolo = game.materials?.['object'] ?? createWorldMaterial(game.uniforms, { kind: 'object' });
    const doppio = createWorldMaterial(game.uniforms, { kind: 'object', side: DoubleSide });
    doppio.name = 'world-object-doppio';
    return { singolo, doppio };
  }
  const singolo = new MeshBasicMaterial({ color: 0xffffff });
  singolo.name = 'banco-singolo';
  const doppio = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });
  doppio.name = 'banco-doppio';
  return { singolo, doppio };
}

const _c = new Color();

/** Aggiunge `aColor` come fa il Cantiere (vetri accesi scuri di giorno, accesi con uNight). */
export function aggiungiAColorMotore(g: BufferGeometry, lume: boolean): void {
  if (g.getAttribute('aColor')) return;
  const col = g.getAttribute('color') as BufferAttribute | undefined;
  const n = g.getAttribute('position').count;
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    let r = 0.7;
    let gg = 0.7;
    let b = 0.7;
    let a = 0;
    if (col) {
      _c.setRGB(col.getX(i), col.getY(i), col.getZ(i), LinearSRGBColorSpace);
      const s = { r: 0, g: 0, b: 0 };
      _c.getRGB(s, SRGBColorSpace);
      r = s.r;
      gg = s.g;
      b = s.b;
      if (lume) a = Math.min(1, Math.max(0, (Math.max(r, gg, b) - 0.25) * 1.6));
      if (lume && a > 0.3) {
        r = 0.17;
        gg = 0.155;
        b = 0.19;
      }
    }
    out.set([r, gg, b, a], i * 4);
  }
  g.setAttribute('aColor', new BufferAttribute(out, 4));
}

/**
 * Passa un oggetto animato della libreria (botola, cancello, lanterna…) ai materiali del motore.
 * Le SkinnedMesh (abitanti) e gli sprite degli aloni restano come sono; gli aloni si spengono
 * (i bagliori li fa `game.lamps`).
 */
export function adattaOggetto(radice: Object3D, mat: MaterialiCantiere, togliAloni = true): void {
  const via: Object3D[] = [];
  radice.traverse((o) => {
    if ((o as unknown as { isSprite?: boolean }).isSprite || (o as unknown as { isPoints?: boolean }).isPoints) {
      if (togliAloni) via.push(o);
      return;
    }
    if ((o as unknown as { isLight?: boolean }).isLight) {
      via.push(o);
      return;
    }
    const m = o as Mesh;
    if (!m.isMesh || (o as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) return;
    const canale = String(m.userData['canale'] ?? 'opaco');
    aggiungiAColorMotore(m.geometry, canale === 'lume');
    m.material = (canale === 'sottile' ? mat.doppio : mat.singolo) as Material;
  });
  for (const o of via) o.parent?.remove(o);
}
