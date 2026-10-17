/**
 * Elvira arriva alle spalle di chi le parla (traccia «parlare», docs/migliorie/parlare.md): il corpo si gira
 * dal lato da cui la testa la sta già guardando. Con i personaggi veri (i GLB in Node, tests/personaggi/posa.ts)
 * nel paese vero (giocoFinto + installaCorbella), come nel gioco.
 *
 * Il caso: Elvira quasi dietro la schiena (170°), la testa girata dall'altro lato. Prima il corpo si girava
 * sempre dalla parte più corta: la testa, girata sull'altra spalla, doveva attraversare tutto il collo
 * mentre il corpo girava (fino a 160°/s rispetto al corpo, 230°/s nel mondo). Adesso il corpo fa il giro
 * dal lato della testa (al più 25° in più) e la testa resta su quella spalla finché Elvira le compare
 * davanti.
 */
import { Quaternion, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { installaCorbella, type ManigliaCorbella } from '../../src/popolamento/index';
import { deltaYaw } from '../../src/popolamento/abitanti';
import { sposta, suolo } from '../../src/popolamento/terreno';
import { localFrameTheta } from '../../src/world/cylinder';
import type { AnimatorePersonaggio } from '../../src/personaggi/animatore';
import { rotazioneNelModello } from '../personaggi/conversazione';
import { registraVeri } from '../personaggi/posa';
import { giocoFinto } from './banco';

let g: ReturnType<typeof giocoFinto>;
let c: ManigliaCorbella;

beforeAll(async () => {
  await registraVeri();
  g = giocoFinto(true);
  c = installaCorbella(g, { agganciaCiclo: false });
}, 120000);

/** Lo yaw (bussola, gradi) della figura di `id`, dalla sua orientazione nel mondo. */
function yawDi(id: string): number {
  const n = c.npc(id)!;
  const f = n.figura!;
  f.updateMatrixWorld(true);
  const p = n.posizione()!;
  const t = localFrameTheta(p.theta);
  const avanti = new Vector3(0, 0, 1).applyQuaternion(f.quaternion);
  return (Math.atan2(avanti.dot(t.east), avanti.dot(t.north)) * 180) / Math.PI;
}

/** Un punto a `d` m dalla figura, a `gradi` dalla direzione in cui guarda (+ = verso est del suo avanti). */
function davanti(id: string, gradi: number, d: number): { z: number; theta: number } {
  const p = c.npc(id)!.posizione()!;
  const y = ((yawDi(id) + gradi) * Math.PI) / 180;
  return sposta(p.z, p.theta, Math.cos(y) * d, Math.sin(y) * d, 40);
}

/** L'animatore del personaggio vero dentro la figura del popolamento. */
function animatore(id: string): AnimatorePersonaggio {
  let a: AnimatorePersonaggio | null = null;
  c.npc(id)!.figura!.traverse((o) => {
    a ??= (o.userData['animatore'] as AnimatorePersonaggio | undefined) ?? null;
  });
  if (!a) throw new Error(`${id}: non è un personaggio vero`);
  return a;
}

/** Dove punta la testa (gradi, nello spazio della figura; + = verso la sinistra della figura). */
function yawTesta(id: string): number {
  const a = animatore(id);
  const t = a.ossa.get('testa')!;
  const q = rotazioneNelModello(t.osso, a.radice, new Quaternion()).multiply(t.W.clone().invert());
  const f = new Vector3(0, 0, 1).applyQuaternion(q);
  return (Math.atan2(f.x, f.z) * 180) / Math.PI;
}

describe('girarsi quando Elvira è alle spalle', () => {
  for (const verso of [1, -1]) {
    it(`Bortolo: la testa guarda a ${verso > 0 ? 'est' : 'ovest'}, Elvira quasi dietro dall'altra parte`, () => {
      g.clock!.hours = 10;
      c.applicaOrario(1, 10);
      c.update(1 / 60);
      const n = c.npc('bortolo')!;
      expect(n.presente).toBe(true);
      expect(animatore('bortolo')).toBeTruthy();
      const casa = yawDi('bortolo');
      // la testa guarda qualcuno di lato (a 60° dalla parte `verso`)
      const altro = davanti('bortolo', verso * 60, 4);
      n.guarda({ ...altro, h: suolo(altro.z, altro.theta) + 1.6 });
      for (let i = 0; i < 120; i++) c.update(1 / 60);
      const latoTesta = Math.sign(yawTesta('bortolo'));
      expect(Math.abs(yawTesta('bortolo'))).toBeGreaterThan(30);
      // Elvira arriva quasi alle spalle, di poco dall'altra parte (170°: la via più corta è dalla sua parte)
      const e = davanti('bortolo', -verso * 170, 2);
      const occhi = { ...e, h: suolo(e.z, e.theta) + 1.6 };
      n.guarda(occhi);
      for (let i = 0; i < 60; i++) c.update(1 / 60);
      // la testa resta sulla spalla di prima (isteresi: Elvira è a meno di 25° dalla schiena)
      expect(Math.sign(yawTesta('bortolo'))).toBe(latoTesta);
      // il dialogo: si gira verso di lei, dal lato della testa
      expect(n.rivolgiVerso(e)).toBe(true);
      let prima = yawDi('bortolo');
      let girato = 0;
      let testaPrima = yawTesta('bortolo');
      let velTesta = 0;
      let cambi = 0;
      let lato = Math.sign(testaPrima);
      for (let i = 0; i < 5 * 60; i++) {
        c.update(1 / 60);
        const y = yawDi('bortolo');
        girato += deltaYaw(prima, y);
        prima = y;
        const t = yawTesta('bortolo');
        velTesta = Math.max(velTesta, Math.abs(t - testaPrima) * 60);
        testaPrima = t;
        if (Math.abs(t) > 20 && Math.sign(t) !== lato) {
          cambi++;
          lato = Math.sign(t);
        }
      }
      // il giro lungo, dalla parte della testa: 360 − 170 − 5 = 185° (gli ultimi 5° verso di lei li fa lo
      // sguardo); la via corta sarebbe stata di 165° dall'altra parte
      expect(Math.sign(girato), `girato ${girato.toFixed(1)}°, testa ${latoTesta}`).toBe(verso);
      expect(Math.abs(girato - verso * 185)).toBeLessThan(3);
      // e alla fine guarda verso di lei
      expect(Math.abs(deltaYaw(casa, yawDi('bortolo')) + verso * 175)).toBeLessThan(3);
      expect(cambi).toBe(0);
      expect(velTesta).toBeLessThan(120);
      n.rivolgiVerso(null);
      n.guarda(null);
      for (let i = 0; i < 5 * 60; i++) c.update(1 / 60);
    });
  }
});
