/**
 * Il sistema delle interazioni: i bersagli che il contenuto nomina (la busta, l'armadietto,
 * il cartellino, i chiodi, le persone…), scelti con lo sguardo e la vicinanza, e il tasto E.
 *
 * - un bersaglio è disponibile se è entro la sua `portata` dagli occhi, dentro un piccolo cono
 *   attorno allo sguardo (il suo `raggio` visto da lì, più un margine) e se `disponibile()`;
 * - fra più bersagli vince quello più al centro dello sguardo (a parità, la `priorita`);
 * - E premuto chiama `azione`; E tenuto riempie `tenuta` (taglia, pianta lo squadro, innesta);
 *   con «Azioni tenute: premi» nelle impostazioni basta premere una volta.
 *
 * Logica pura su vettori: si prova in Node.
 */
import { Vector3 } from 'three';

export interface Tenuta {
  /** Secondi da tenere premuto. */
  durata: number;
  completa: () => void;
  /** Se vero, lasciando a metà il progresso resta (l'innesto «si riprende da dove si era»). */
  riprende?: boolean;
}

export interface Bersaglio {
  id: string;
  /** Che cosa fa il tasto: «Prendi la busta», «Parla con Togna». */
  verbo: string | (() => string);
  posizione: Vector3 | (() => Vector3 | null);
  /** Distanza massima dagli occhi (m), predefinita 2,6. */
  portata?: number;
  /** Raggio del bersaglio per lo sguardo (m), predefinito 0,35. */
  raggio?: number;
  disponibile?: () => boolean;
  azione?: () => void;
  tenuta?: Tenuta;
  priorita?: number;
}

export interface StatoInterazione {
  bersaglio: Bersaglio | null;
  /** Avanzamento della tenuta (0-1) o null. */
  progresso: number | null;
}

export interface ComandiInterazione {
  /** E appena premuto. */
  premuto: boolean;
  /** E tenuto. */
  tenuto: boolean;
  /** «Azioni tenute: premi»: una pressione porta avanti la tenuta da sola. */
  modoPremi?: boolean;
}

const _d = new Vector3();
const MARGINE = 2.5 * (Math.PI / 180);

export function posizioneDi(b: Bersaglio): Vector3 | null {
  return typeof b.posizione === 'function' ? b.posizione() : b.posizione;
}

export function verboDi(b: Bersaglio): string {
  return typeof b.verbo === 'function' ? b.verbo() : b.verbo;
}

/**
 * Punteggio di un bersaglio (più basso = migliore), o Infinity se non si può scegliere.
 * `occhio` e `avanti` (unitario) sono la posizione e lo sguardo della camera.
 */
export function punteggio(b: Bersaglio, occhio: Vector3, avanti: Vector3): number {
  if (b.disponibile && !b.disponibile()) return Infinity;
  const p = posizioneDi(b);
  if (!p) return Infinity;
  _d.subVectors(p, occhio);
  const dist = _d.length();
  const portata = b.portata ?? 2.6;
  if (dist > portata) return Infinity;
  if (dist < 1e-3) return 0;
  const ang = Math.acos(Math.max(-1, Math.min(1, _d.dot(avanti) / dist)));
  const consentito = Math.atan2(b.raggio ?? 0.35, dist) + MARGINE;
  if (ang > consentito) return Infinity;
  return ang / consentito - (b.priorita ?? 0) * 0.01;
}

export class Interazioni {
  private bersagli = new Map<string, Bersaglio>();
  private progressi = new Map<string, number>();
  private corrente: Bersaglio | null = null;
  /** Tenuta avviata in modo «premi» (continua da sola finché il bersaglio resta scelto). */
  private automatica: string | null = null;

  registra(b: Bersaglio): () => void {
    this.bersagli.set(b.id, b);
    return () => this.togli(b.id);
  }

  togli(id: string): void {
    this.bersagli.delete(id);
    this.progressi.delete(id);
    if (this.corrente?.id === id) this.corrente = null;
  }

  get(id: string): Bersaglio | undefined {
    return this.bersagli.get(id);
  }

  tutti(): Bersaglio[] {
    return [...this.bersagli.values()];
  }

  /** Il bersaglio migliore per questo sguardo, o null. */
  scegli(occhio: Vector3, avanti: Vector3): Bersaglio | null {
    let best: Bersaglio | null = null;
    let bs = Infinity;
    for (const b of this.bersagli.values()) {
      const s = punteggio(b, occhio, avanti);
      if (s < bs) {
        bs = s;
        best = b;
      }
    }
    return best;
  }

  /** Avanzamento salvato di una tenuta (0-1). */
  progresso(id: string): number {
    return this.progressi.get(id) ?? 0;
  }

  azzeraProgresso(id: string): void {
    this.progressi.delete(id);
  }

  /** Un passo: sceglie il bersaglio, gestisce E premuto e tenuto. */
  update(dt: number, occhio: Vector3, avanti: Vector3, comandi: ComandiInterazione | null): StatoInterazione {
    const b = this.scegli(occhio, avanti);
    if (b?.id !== this.corrente?.id) {
      // cambio di bersaglio: una tenuta che non riprende si azzera
      if (this.corrente?.tenuta && !this.corrente.tenuta.riprende) this.progressi.delete(this.corrente.id);
      this.automatica = null;
    }
    this.corrente = b;
    if (!b) return { bersaglio: null, progresso: null };
    if (!comandi) return { bersaglio: b, progresso: b.tenuta ? this.progresso(b.id) || null : null };

    if (b.tenuta) {
      if (comandi.modoPremi && comandi.premuto) this.automatica = this.automatica === b.id ? null : b.id;
      const tiene = comandi.tenuto || this.automatica === b.id;
      let p = this.progresso(b.id);
      if (tiene) {
        p += dt / Math.max(0.05, b.tenuta.durata);
        if (p >= 1) {
          this.progressi.delete(b.id);
          this.automatica = null;
          b.tenuta.completa();
          return { bersaglio: b, progresso: null };
        }
        this.progressi.set(b.id, p);
      } else if (!b.tenuta.riprende && p > 0) {
        this.progressi.delete(b.id);
        p = 0;
      }
      return { bersaglio: b, progresso: p > 0 ? p : null };
    }
    if (comandi.premuto) b.azione?.();
    return { bersaglio: b, progresso: null };
  }
}
