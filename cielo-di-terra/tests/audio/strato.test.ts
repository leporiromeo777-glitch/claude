import { describe, expect, it, vi } from 'vitest';
import { ATTESA_SONNO, Strato, puntoAttorno, type Ascoltatore, type ContestoStrato } from '../../src/audio/ambienti/strato';
import { posizioneCilindrica, suVersoAsse, coordinateCilindriche } from '../../src/audio/mappature';
import { creaRng, distanza, punto } from '../../src/audio/util';

/** Nodo finto: registra collegamenti e scollegamenti. */
function nodoFinto(): AudioNode & { collegamenti: number } {
  const n = {
    collegamenti: 0,
    connect: vi.fn(function (this: { collegamenti: number }) {
      n.collegamenti++;
      return undefined;
    }),
    disconnect: vi.fn(() => {
      n.collegamenti--;
    }),
  };
  return n as unknown as AudioNode & { collegamenti: number };
}

class StratoDiProva extends Strato {
  readonly uscitaFinta = nodoFinto();
  constructor() {
    super({} as ContestoStrato);
    this.collegaUscita(this.uscitaFinta, nodoFinto());
  }
  aggiorna(): void {}
  passo(peso: number, t: number): void {
    this.sonno(peso, t);
  }
}

describe('sonno degli strati', () => {
  it('stacca le uscite dopo ATTESA_SONNO secondi di silenzio e le riattacca appena serve', () => {
    const s = new StratoDiProva();
    expect(s.uscitaFinta.collegamenti).toBe(1);
    s.passo(0.5, 0);
    s.passo(0, 1);
    s.passo(0, ATTESA_SONNO - 0.5);
    expect(s.addormentato).toBe(false);
    s.passo(0, ATTESA_SONNO + 0.5);
    expect(s.addormentato).toBe(true);
    expect(s.uscitaFinta.collegamenti).toBe(0);
    s.passo(0, ATTESA_SONNO + 5); // resta staccato, senza doppi scollegamenti
    expect(s.uscitaFinta.collegamenti).toBe(0);
    s.passo(0.2, ATTESA_SONNO + 6);
    expect(s.addormentato).toBe(false);
    expect(s.uscitaFinta.collegamenti).toBe(1);
    s.passo(0.3, ATTESA_SONNO + 7); // nessun doppio collegamento
    expect(s.uscitaFinta.collegamenti).toBe(1);
  });
});

describe('punti attorno all\'ascoltatore', () => {
  it('stanno alla distanza orizzontale chiesta e alla quota chiesta sopra il suolo', () => {
    const rng = creaRng(3);
    for (const [theta, h] of [
      [36, 1.7],
      [166, 40],
      [300, 0],
    ] as const) {
      const posizione = posizioneCilindrica(theta, 1200, h);
      const su = suVersoAsse(posizione);
      const asc: Ascoltatore = { posizione, su, avanti: { x: 0, y: 0, z: 1 }, altezza: h };
      for (let i = 0; i < 50; i++) {
        const p = puntoAttorno(asc, rng, 10, 40, 5);
        // componente lungo il «su» rispetto al suolo sotto i piedi
        const suolo = { x: posizione.x - su.x * h, y: posizione.y - su.y * h, z: posizione.z };
        const d = { x: p.x - suolo.x, y: p.y - suolo.y, z: p.z - suolo.z };
        expect(punto(d, su)).toBeCloseTo(5, 6);
        const orizzontale = Math.sqrt(Math.max(0, distanza(p, suolo) ** 2 - 25));
        expect(orizzontale).toBeGreaterThanOrEqual(10 - 1e-6);
        expect(orizzontale).toBeLessThanOrEqual(40 + 1e-6);
        // e nel cilindro restano vicini al suolo (la curvatura a 40 m è di poco più di un metro)
        expect(Math.abs(coordinateCilindriche(p).altezza - 5)).toBeLessThan(1.5);
      }
    }
  });
});
