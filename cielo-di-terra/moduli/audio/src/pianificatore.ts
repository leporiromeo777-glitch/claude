/**
 * Pianificatore di eventi casuali (processo di Poisson a tasso variabile).
 * Gli strati d'ambiente lo usano per decidere quando cantano gli uccelli,
 * quando cigola il ferro, quando lambisce l'acqua. È puro e deterministico dato l'Rng.
 */
import type { Rng } from './util';

export class Pianificatore {
  private carico = 0;
  private soglia: number;

  /**
   * @param rng generatore casuale
   * @param regolarita 1 = eventi del tutto casuali (Poisson); valori più alti rendono
   *   gli intervalli più regolari (distribuzione di Erlang con media invariata).
   */
  constructor(
    private readonly rng: Rng,
    private readonly regolarita = 1,
  ) {
    this.soglia = this.nuovaSoglia();
  }

  private nuovaSoglia(): number {
    const k = Math.max(1, Math.round(this.regolarita));
    let s = 0;
    for (let i = 0; i < k; i++) s += -Math.log(1 - this.rng() * 0.999999);
    return s / k;
  }

  /**
   * Istanti degli eventi nell'intervallo [da, a) con `tasso` eventi al secondo.
   * Il «carico» accumulato si conserva fra una chiamata e l'altra, così i cambi di
   * tasso sono continui e non si perdono eventi fra un fotogramma e il successivo.
   */
  eventi(da: number, a: number, tasso: number): number[] {
    const out: number[] = [];
    if (!(a > da) || !(tasso > 0) || !Number.isFinite(tasso)) return out;
    let t = da;
    for (let guardia = 0; guardia < 10_000; guardia++) {
      const resto = this.soglia - this.carico;
      const dt = resto / tasso;
      if (t + dt >= a) {
        this.carico += tasso * (a - t);
        break;
      }
      t += dt;
      out.push(t);
      this.carico = 0;
      this.soglia = this.nuovaSoglia();
    }
    return out;
  }
}
