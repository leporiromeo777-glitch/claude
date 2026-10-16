/**
 * Chi parla con Elvira si gira verso di lei con calma (traccia «parlare», docs/migliorie/parlare.md), e gli
 * orari non lo rigirano di scatto. Prima `orientaVerso` girava la figura di colpo all'apertura del dialogo e,
 * al minuto di gioco dopo (1,7 s reali), `applicaOrario` la rimetteva com'era, di nuovo di colpo.
 *
 * Il paese vero in Node (giocoFinto + installaCorbella); l'ora avanza come nel gioco (un giorno in 40
 * minuti), così gli orari si riapplicano a ogni minuto di gioco mentre si misura.
 */
import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { installaCorbella, type ManigliaCorbella } from '../../src/popolamento/index';
import { GIRO, deltaYaw } from '../../src/popolamento/abitanti';
import { sposta } from '../../src/popolamento/terreno';
import { localFrameTheta } from '../../src/world/cylinder';
import { giocoFinto } from './banco';

let g: ReturnType<typeof giocoFinto>;
let c: ManigliaCorbella;

beforeAll(() => {
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

/** Avanza di `secondi` a passi di 1/60 s con l'ora che corre come nel gioco; gli yaw a ogni passo. */
function avanza(id: string, secondi: number, ore: { h: number }): number[] {
  const yaw: number[] = [];
  for (let i = 0; i < Math.round(secondi * 60); i++) {
    ore.h += 24 / (40 * 60) / 60;
    g.clock!.hours = ore.h;
    c.update(1 / 60);
    yaw.push(yawDi(id));
  }
  return yaw;
}

/** La velocità angolare più alta (gradi/s) in una serie di yaw a 60 Hz. */
function velMax(yaw: number[]): number {
  let m = 0;
  for (let i = 1; i < yaw.length; i++) m = Math.max(m, Math.abs(deltaYaw(yaw[i - 1] as number, yaw[i] as number)) * 60);
  return m;
}

describe('girarsi verso chi parla', () => {
  it('Bortolo sul sagrato si gira con calma verso Elvira e gli orari non lo rigirano', () => {
    const ore = { h: 10 };
    g.clock!.hours = ore.h;
    c.applicaOrario(1, ore.h);
    c.update(1 / 60);
    const n = c.npc('bortolo')!;
    expect(n.presente).toBe(true);
    const casa = yawDi('bortolo');
    const elvira = davanti('bortolo', 75, 2.4);
    expect(n.rivolgiVerso(elvira)).toBe(true);
    // quattro secondi: passano due minuti di gioco, gli orari si riapplicano due volte
    const yaw = avanza('bortolo', 4, ore);
    expect(velMax(yaw)).toBeLessThan(GIRO.vmax + 1);
    const fine = yaw[yaw.length - 1] as number;
    expect(Math.abs(deltaYaw(casa, fine) - 70)).toBeLessThan(1.5);
    // nessun ritorno di scatto: dopo l'arrivo resta lì
    const dopo = yaw.slice(Math.round(2.5 * 60));
    for (const y of dopo) expect(Math.abs(deltaYaw(fine, y))).toBeLessThan(0.5);
    // finito il dialogo torna piano a guardare dove guardava
    expect(n.rivolgiVerso(null)).toBe(true);
    const ritorno = avanza('bortolo', 3, ore);
    expect(velMax(ritorno)).toBeLessThan(GIRO.vmax + 1);
    expect(Math.abs(deltaYaw(casa, ritorno[ritorno.length - 1] as number))).toBeLessThan(0.5);
  });

  it('la velocità sale e scende senza gradini (accelerazione limitata)', () => {
    const ore = { h: 10.2 };
    c.applicaOrario(1, ore.h);
    c.update(1 / 60);
    const n = c.npc('bortolo')!;
    n.rivolgiVerso(davanti('bortolo', -120, 2));
    const yaw = avanza('bortolo', 3, ore);
    let acc = 0;
    for (let i = 2; i < yaw.length; i++) {
      const v1 = deltaYaw(yaw[i - 2] as number, yaw[i - 1] as number) * 60;
      const v2 = deltaYaw(yaw[i - 1] as number, yaw[i] as number) * 60;
      acc = Math.max(acc, Math.abs(v2 - v1) * 60);
    }
    expect(acc).toBeLessThan(GIRO.acc * 1.6);
    n.rivolgiVerso(null);
    avanza('bortolo', 3, ore);
  });

  it('fino a 25° gira solo la testa', () => {
    const ore = { h: 10.4 };
    c.applicaOrario(1, ore.h);
    c.update(1 / 60);
    const prima = yawDi('bortolo');
    c.npc('bortolo')!.rivolgiVerso(davanti('bortolo', 15, 3));
    avanza('bortolo', 1.5, ore);
    expect(Math.abs(deltaYaw(prima, yawDi('bortolo')))).toBeLessThan(0.5);
    c.npc('bortolo')!.rivolgiVerso(null);
  });

  it('chi è seduto (Annunciata sulla panca) non gira il corpo e non si alza', () => {
    const ore = { h: 10 };
    c.applicaOrario(1, ore.h);
    c.update(1 / 60);
    const n = c.npc('annunciata')!;
    expect(n.posaAttuale).toBe('seduto');
    const prima = yawDi('annunciata');
    const h0 = n.posizione()!.h;
    expect(n.rivolgiVerso(davanti('annunciata', 90, 2))).toBe(true);
    avanza('annunciata', 2, ore);
    expect(Math.abs(deltaYaw(prima, yawDi('annunciata')))).toBeLessThan(0.01);
    expect(n.posizione()!.h).toBeCloseTo(h0, 6);
    n.rivolgiVerso(null);
  });

  it('orientaVerso resta immediato (per chi è appena stato messo in un posto)', () => {
    const ore = { h: 10 };
    c.applicaOrario(1, ore.h);
    const n = c.npc('bortolo')!;
    const p = n.posizione()!;
    n.orientaVerso({ z: p.z + 10, theta: p.theta });
    expect(Math.abs(deltaYaw(0, yawDi('bortolo')))).toBeLessThan(0.5);
    // e gli orari, al minuto dopo, lo riportano piano (non di colpo) al verso del suo posto
    const yaw = avanza('bortolo', 3, ore);
    expect(velMax(yaw)).toBeLessThan(GIRO.vmax + 1);
  });
});
