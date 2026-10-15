/**
 * Logica del mixer, senza Web Audio: volumi dei bus (valori dei cursori 0-1),
 * muto, pausa e guadagni effettivi. Il motore la interroga e applica i guadagni ai nodi.
 */
import { NOMI_BUS, type NomeBus } from './tipi';
import { limita } from './util';
import { volumeAGuadagno } from './mappature';

/** Volumi predefiniti dei cursori: la musica resta discreta sotto l'ambiente. */
export const VOLUMI_PREDEFINITI: Readonly<Record<NomeBus, number>> = {
  generale: 0.9,
  ambiente: 0.85,
  effetti: 0.85,
  voci: 1,
  musica: 0.6,
};

/** Impostazioni salvabili del mixer. */
export interface ImpostazioniMixer {
  volumi: Record<NomeBus, number>;
  muto: boolean;
}

export class Mixer {
  private readonly volumi: Record<NomeBus, number> = { ...VOLUMI_PREDEFINITI };
  private _muto = false;
  private _inPausa = false;

  /** Imposta il cursore di un bus (0-1). Restituisce il valore effettivamente salvato. */
  imposta(bus: NomeBus, valore: number): number {
    const v = limita(Number.isFinite(valore) ? valore : 0, 0, 1);
    this.volumi[bus] = v;
    return v;
  }

  /** Valore del cursore di un bus (0-1). */
  volume(bus: NomeBus): number {
    return this.volumi[bus];
  }

  get muto(): boolean {
    return this._muto;
  }
  set muto(m: boolean) {
    this._muto = m;
  }

  get inPausa(): boolean {
    return this._inPausa;
  }
  set inPausa(p: boolean) {
    this._inPausa = p;
  }

  /**
   * Guadagno lineare da applicare al nodo del bus. Per «generale» include
   * muto e pausa (in pausa tutto tace); per gli altri bus è solo la curva del cursore.
   */
  guadagno(bus: NomeBus): number {
    const g = volumeAGuadagno(this.volumi[bus]);
    if (bus === 'generale') return this._muto || this._inPausa ? 0 : g;
    return g;
  }

  /** Guadagno complessivo che arriva all'uscita da un bus (bus × generale). */
  guadagnoEffettivo(bus: Exclude<NomeBus, 'generale'>): number {
    return this.guadagno(bus) * this.guadagno('generale');
  }

  /** Istantanea salvabile (per le opzioni del gioco). */
  esporta(): ImpostazioniMixer {
    return { volumi: { ...this.volumi }, muto: this._muto };
  }

  /** Ripristina un'istantanea; chiavi mancanti o non valide restano invariate. */
  importa(dati: Partial<ImpostazioniMixer> | null | undefined): void {
    if (!dati) return;
    if (dati.volumi) {
      for (const bus of NOMI_BUS) {
        const v = dati.volumi[bus];
        if (typeof v === 'number' && Number.isFinite(v)) this.imposta(bus, v);
      }
    }
    if (typeof dati.muto === 'boolean') this._muto = dati.muto;
  }
}
