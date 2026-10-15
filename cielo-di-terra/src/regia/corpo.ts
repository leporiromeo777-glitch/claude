/**
 * Il corpo di Elvira per la regia: il fiato (GDD §3.7), lo stare seduta, le planate.
 *
 * - Il **fiato** (0-1) cala correndo e, nel prologo, anche camminando («le gambe di due
 *   secoli»: dopo 15-20 m la vista si restringe); si recupera camminando piano, da fermi e
 *   soprattutto **seduti** (pieno in 6 s). Sotto 0,4 la vista si restringe: la prima volta
 *   accende `fiato_corto`.
 * - Una **planata** conta quando il Velo resta aperto almeno 2 s e Elvira atterra in piedi
 *   (`planata_fatta`); il punto di decollo dice da quale muro è partita (`planata:<luogo>`).
 *
 * Logica pura: riceve lo stato del controller a ogni passo e restituisce eventi.
 */

export interface PassoCorpo {
  grounded: boolean;
  veloOpen: boolean;
  /** Velocità sul terreno (m/s). */
  velocita: number;
  corre: boolean;
  z: number;
  theta: number;
  h: number;
  /** Atterraggio duro in questo passo (dal controller). */
  atterraggioDuro?: boolean;
}

export type EventoCorpo =
  | { tipo: 'fiato_corto' }
  | { tipo: 'decollo'; da: Punto }
  | { tipo: 'atterraggio'; dove: Punto; planata: boolean; secondiVelo: number; decollo: Punto | null; duro: boolean };

export interface Punto {
  z: number;
  theta: number;
  h: number;
}

/** Soglia sotto cui la vista si restringe. */
export const SOGLIA_FIATO = 0.4;

export class Corpo {
  fiato = 1;
  seduta = false;
  /** Nel prologo anche camminare costa fiato. */
  affaticata = false;
  /** Consumo per metro camminato quando `affaticata` (1 → 0,35 in ~18 m). */
  consumoPerMetro = 0.036;
  private fiatoCortoDato = false;
  private inAria = false;
  private decollo: Punto | null = null;
  private secondiVelo = 0;
  private ultimoATerra: Punto | null = null;

  /** Un passo di `dt` secondi. */
  aggiorna(dt: number, s: PassoCorpo): EventoCorpo[] {
    const ev: EventoCorpo[] = [];
    // --- fiato ---
    if (this.seduta) this.fiato += dt / 6;
    else if (s.grounded) {
      // correndo il fiato dura circa 28 s; camminando torna in circa 25 s
      if (s.corre && s.velocita > 5) this.fiato -= dt / 28;
      else if (this.affaticata && s.velocita > 0.3) this.fiato -= s.velocita * dt * this.consumoPerMetro;
      else if (s.velocita < 0.3) this.fiato += dt * 0.08;
      else this.fiato += dt * 0.04;
    }
    this.fiato = Math.max(0, Math.min(1, this.fiato));
    if (!this.fiatoCortoDato && this.fiato < SOGLIA_FIATO) {
      this.fiatoCortoDato = true;
      ev.push({ tipo: 'fiato_corto' });
    }

    // --- volo e planate ---
    const qui: Punto = { z: s.z, theta: s.theta, h: s.h };
    if (s.grounded) {
      if (this.inAria) {
        const planata = this.secondiVelo >= 2;
        ev.push({ tipo: 'atterraggio', dove: qui, planata, secondiVelo: this.secondiVelo, decollo: this.decollo, duro: !!s.atterraggioDuro });
        this.inAria = false;
        this.secondiVelo = 0;
        this.decollo = null;
      }
      this.ultimoATerra = qui;
    } else {
      if (!this.inAria) {
        this.inAria = true;
        this.decollo = this.ultimoATerra ?? qui;
        this.secondiVelo = 0;
        ev.push({ tipo: 'decollo', da: this.decollo });
      }
      if (s.veloOpen) this.secondiVelo += dt;
    }
    return ev;
  }

  /** La vista si restringe (0 = normale, 1 = molto stretta). */
  get restringimento(): number {
    return this.fiato >= SOGLIA_FIATO ? 0 : (SOGLIA_FIATO - this.fiato) / SOGLIA_FIATO;
  }

  /** Fattore sulla velocità del passo (il fiato corto rallenta). */
  get fattoreVelocita(): number {
    return this.fiato < 0.15 ? 0.55 : this.fiato < SOGLIA_FIATO ? 0.75 : 1;
  }

  get fiatoCortoGiaVisto(): boolean {
    return this.fiatoCortoDato;
  }

  esporta(): { fiato: number; fiatoCortoDato: boolean; affaticata: boolean } {
    return { fiato: this.fiato, fiatoCortoDato: this.fiatoCortoDato, affaticata: this.affaticata };
  }

  importa(d: Partial<{ fiato: number; fiatoCortoDato: boolean; affaticata: boolean }> | null | undefined): void {
    if (!d) return;
    if (typeof d.fiato === 'number') this.fiato = d.fiato;
    this.fiatoCortoDato = !!d.fiatoCortoDato;
    this.affaticata = !!d.affaticata;
    this.seduta = false;
    this.inAria = false;
  }
}
