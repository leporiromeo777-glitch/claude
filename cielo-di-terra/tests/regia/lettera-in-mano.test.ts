/**
 * La lettera in mano (traccia «paese», regia/scena/lettera.ts): il foglio sale nella destra solo
 * per le carte da tenere in mano, e non quando le mani sono già occupate (squadro in mano o
 * piantato, Velo aperto) o quando la carta è una leggenda dell'Ombrista (tipo «leggenda»).
 * Unione 2 della grafica: nell'e2e il foglio compariva sopra lo squadro piantato e durante la
 * scena dell'Ombrista.
 */
import { describe, expect, it } from 'vitest';
import type { Game } from '../../src/game';
import { LetteraInMano, type StatoLettore } from '../../src/regia/scena/lettera';

function finto(velo = 0): Game {
  return { settings: { fov: 75 }, player: { veloAmount: velo }, camera: { aspect: 16 / 9 }, freeCamera: false } as unknown as Game;
}

/** Quanto è alzata la lettera dopo `s` secondi con lo stato del lettore dato. */
function alzataDopo(stato: ReturnType<StatoLettore>, s = 2, velo = 0): number {
  const l = new LetteraInMano(finto(velo), () => stato);
  for (let t = 0; t < s; t += 1 / 30) l.update(1 / 30);
  return l['alzata'];
}

describe('lettera in mano', () => {
  it('sale con una lettera aperta', () => {
    expect(alzataDopo({ aperta: true, tipo: 'lettera' })).toBeGreaterThan(0.9);
  });

  it('resta giù per le carte che non si tengono in mano e per le leggende dell\'Ombrista', () => {
    expect(alzataDopo({ aperta: true, tipo: 'libretto' })).toBeLessThan(0.01);
    expect(alzataDopo({ aperta: true, tipo: 'leggenda' })).toBeLessThan(0.01);
  });

  it('resta giù con lo squadro in mano o piantato e con il Velo aperto', () => {
    expect(alzataDopo({ aperta: true, tipo: 'lettera', maniOccupate: true })).toBeLessThan(0.01);
    expect(alzataDopo({ aperta: true, tipo: 'lettera' }, 2, 1)).toBeLessThan(0.01);
  });
});
