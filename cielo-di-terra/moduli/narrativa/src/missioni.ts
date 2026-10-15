/**
 * Missioni: macchina a stati guidata dai dati di content/missioni.json.
 *
 * Stati di una missione: inattiva → attiva → completata (oppure fallita).
 * Stati di un passo: bloccato → attivo → completato.
 *
 * Regole (applicate da `aggiorna()`, a cascata finché qualcosa cambia):
 * - una missione inattiva con `avviaQuando` vero parte da sola; le altre
 *   partono con l'effetto «missione:id avvia», con `avvia(id)` o perché sono
 *   fra le `iniziali` (avviate al primo aggiornamento di una partita nuova);
 * - in una missione «sequenziale» un passo si attiva quando il precedente è
 *   completato e la sua `attivaQuando` (se c'è) è vera; in una «libera»
 *   conta solo `attivaQuando`;
 * - un passo attivo si completa quando `completaQuando` è vera: si emette
 *   l'evento e si applicano i suoi effetti;
 * - quando tutti i passi sono completati la missione è completata e si
 *   applicano gli effetti della missione.
 * Tutte le transizioni vanno solo in avanti, quindi la cascata termina.
 */
import type { CondizioneGrezza } from './condizioni';
import type { MissioneDef, PassoDef } from './contenuti';
import { Emettitore } from './eventi';

export type StatoMissione = 'inattiva' | 'attiva' | 'completata' | 'fallita';
export type StatoPasso = 'bloccato' | 'attivo' | 'completato';

export interface EventiMissioni {
  missioneAvviata: { missione: string; titolo: string };
  passoAttivato: { missione: string; passo: string; obiettivo?: string };
  passoCompletato: { missione: string; passo: string };
  missioneCompletata: { missione: string; titolo: string };
  missioneFallita: { missione: string; titolo: string };
}

export interface DipendenzeMissioni {
  valuta(c: CondizioneGrezza): boolean;
  applicaEffetti(effetti: readonly string[], origine: string): void;
}

export interface StatoMissioni {
  inizializzate: boolean;
  missioni: Record<string, { stato: StatoMissione; passi: Record<string, StatoPasso> }>;
}

export interface PassoAttivo {
  missione: string;
  passo: string;
  obiettivo?: string;
}

interface StatoInterno {
  stato: StatoMissione;
  passi: Map<string, StatoPasso>;
}

/** Limite di sicurezza per la cascata di `aggiorna()`. */
const MASSIMO_GIRI = 10_000;

export class Missioni {
  readonly eventi = new Emettitore<EventiMissioni>();
  private readonly defs = new Map<string, MissioneDef>();
  private readonly stati = new Map<string, StatoInterno>();
  private inizializzate = false;
  private inAggiornamento = false;

  constructor(
    defs: readonly MissioneDef[],
    private readonly deps: DipendenzeMissioni,
    readonly iniziali: readonly string[] = [],
  ) {
    for (const d of defs) this.defs.set(d.id, d);
  }

  definizione(id: string): MissioneDef | undefined {
    return this.defs.get(id);
  }

  /** Tutte le missioni, nell'ordine del file. */
  elenco(): MissioneDef[] {
    return [...this.defs.values()];
  }

  stato(id: string): StatoMissione {
    return this.stati.get(id)?.stato ?? 'inattiva';
  }

  statoPasso(missione: string, passo: string): StatoPasso {
    return this.stati.get(missione)?.passi.get(passo) ?? 'bloccato';
  }

  attive(): string[] {
    return this.elenco()
      .filter((m) => this.stato(m.id) === 'attiva')
      .map((m) => m.id);
  }

  completate(): string[] {
    return this.elenco()
      .filter((m) => this.stato(m.id) === 'completata')
      .map((m) => m.id);
  }

  /** Passi attivi di tutte le missioni attive, nell'ordine del file. */
  passiAttivi(): PassoAttivo[] {
    const out: PassoAttivo[] = [];
    for (const m of this.defs.values()) {
      if (this.stato(m.id) !== 'attiva') continue;
      for (const p of m.passi) {
        if (this.statoPasso(m.id, p.id) === 'attivo') {
          out.push({ missione: m.id, passo: p.id, ...(p.obiettivo !== undefined ? { obiettivo: p.obiettivo } : {}) });
        }
      }
    }
    return out;
  }

  /** Avvia una missione inattiva. Restituisce false se non esiste o non è inattiva. */
  avvia(id: string): boolean {
    if (!this.avviaSenzaAggiornare(id)) return false;
    this.aggiorna();
    return true;
  }

  /** Forza il completamento di una missione attiva (i passi mancanti non applicano i loro effetti). */
  completa(id: string): boolean {
    const d = this.defs.get(id);
    const s = this.stati.get(id);
    if (!d || !s || s.stato !== 'attiva') return false;
    for (const p of d.passi) s.passi.set(p.id, 'completato');
    this.chiudiMissione(d, s, []);
    this.aggiorna();
    return true;
  }

  /** Forza il completamento di un passo (bloccato o attivo) di una missione attiva. */
  completaPasso(missione: string, passo: string): boolean {
    const d = this.defs.get(missione);
    const s = this.stati.get(missione);
    const p = d?.passi.find((x) => x.id === passo);
    if (!d || !s || !p || s.stato !== 'attiva' || s.passi.get(passo) === 'completato') return false;
    if (s.passi.get(passo) === 'bloccato') this.attivaPasso(d, s, p);
    this.completaPassoInterno(d, s, p);
    this.aggiorna();
    return true;
  }

  fallisci(id: string): boolean {
    const d = this.defs.get(id);
    const s = this.stati.get(id);
    if (!d || !s || s.stato !== 'attiva') return false;
    s.stato = 'fallita';
    this.eventi.emit('missioneFallita', { missione: id, titolo: d.titolo });
    return true;
  }

  /**
   * Valuta tutte le condizioni e applica le transizioni a cascata.
   * Restituisce true se qualcosa è cambiato.
   */
  aggiorna(): boolean {
    if (this.inAggiornamento) return false; // la cascata in corso se ne accorgerà
    this.inAggiornamento = true;
    let cambiato = false;
    try {
      if (!this.inizializzate) {
        this.inizializzate = true;
        for (const id of this.iniziali) cambiato = this.avviaSenzaAggiornare(id) || cambiato;
      }
      for (let giro = 0; ; giro++) {
        if (giro >= MASSIMO_GIRI) throw new Error('Missioni: la cascata di aggiornamento non termina');
        if (!this.unGiro()) break;
        cambiato = true;
      }
    } finally {
      this.inAggiornamento = false;
    }
    return cambiato;
  }

  private unGiro(): boolean {
    let progresso = false;
    for (const d of this.defs.values()) {
      if (this.stato(d.id) === 'inattiva' && d.avviaQuando !== undefined && this.deps.valuta(d.avviaQuando)) {
        progresso = this.avviaSenzaAggiornare(d.id) || progresso;
      }
      const s = this.stati.get(d.id);
      if (!s || s.stato !== 'attiva') continue;
      d.passi.forEach((p, i) => {
        if (s.stato !== 'attiva') return; // un effetto può averla chiusa
        let st = s.passi.get(p.id) ?? 'bloccato';
        if (st === 'bloccato' && this.puoAttivare(d, s, p, i)) {
          this.attivaPasso(d, s, p);
          st = 'attivo';
          progresso = true;
        }
        if (st === 'attivo' && p.completaQuando !== undefined && this.deps.valuta(p.completaQuando)) {
          this.completaPassoInterno(d, s, p);
          progresso = true;
        }
      });
      if (s.stato === 'attiva' && d.passi.every((p) => s.passi.get(p.id) === 'completato')) {
        // Solo per missioni senza passi o con passi completati da fuori.
        this.chiudiMissione(d, s, []);
        progresso = true;
      }
    }
    return progresso;
  }

  private puoAttivare(d: MissioneDef, s: StatoInterno, p: PassoDef, i: number): boolean {
    if (d.ordine === 'sequenziale' && i > 0) {
      const prec = d.passi[i - 1]!;
      if (s.passi.get(prec.id) !== 'completato') return false;
    }
    return p.attivaQuando === undefined || this.deps.valuta(p.attivaQuando);
  }

  private avviaSenzaAggiornare(id: string): boolean {
    const d = this.defs.get(id);
    if (!d || this.stato(id) !== 'inattiva') return false;
    const s: StatoInterno = { stato: 'attiva', passi: new Map(d.passi.map((p) => [p.id, 'bloccato' as StatoPasso])) };
    this.stati.set(id, s);
    this.eventi.emit('missioneAvviata', { missione: id, titolo: d.titolo });
    return true;
  }

  private attivaPasso(d: MissioneDef, s: StatoInterno, p: PassoDef): void {
    s.passi.set(p.id, 'attivo');
    this.eventi.emit('passoAttivato', {
      missione: d.id,
      passo: p.id,
      ...(p.obiettivo !== undefined ? { obiettivo: p.obiettivo } : {}),
    });
    if (p.effettiAttivazione.length) this.deps.applicaEffetti(p.effettiAttivazione, `missione ${d.id}, attivazione di ${p.id}`);
  }

  /**
   * Completa un passo. Se era l'ultimo, la missione si chiude prima di
   * applicare gli effetti del passo: così gli eventi arrivano nell'ordine
   * naturale (passo completato → missione completata → effetti, per esempio
   * l'avvio della missione seguente → effetti della missione).
   */
  private completaPassoInterno(d: MissioneDef, s: StatoInterno, p: PassoDef): void {
    s.passi.set(p.id, 'completato');
    this.eventi.emit('passoCompletato', { missione: d.id, passo: p.id });
    const ultimo = s.stato === 'attiva' && d.passi.every((x) => s.passi.get(x.id) === 'completato');
    if (ultimo) {
      this.chiudiMissione(d, s, p.effetti, `missione ${d.id}, passo ${p.id}`);
    } else if (p.effetti.length) {
      this.deps.applicaEffetti(p.effetti, `missione ${d.id}, passo ${p.id}`);
    }
  }

  private chiudiMissione(d: MissioneDef, s: StatoInterno, effettiPasso: readonly string[], originePasso = ''): void {
    s.stato = 'completata';
    this.eventi.emit('missioneCompletata', { missione: d.id, titolo: d.titolo });
    if (effettiPasso.length) this.deps.applicaEffetti(effettiPasso, originePasso);
    if (d.effetti.length) this.deps.applicaEffetti(d.effetti, `missione ${d.id}`);
  }

  // --- Salvataggio ------------------------------------------------------------

  esporta(): StatoMissioni {
    const missioni: StatoMissioni['missioni'] = {};
    for (const [id, s] of this.stati) {
      missioni[id] = { stato: s.stato, passi: Object.fromEntries(s.passi) };
    }
    return { inizializzate: this.inizializzate, missioni };
  }

  importa(dati: StatoMissioni): void {
    this.stati.clear();
    this.inizializzate = !!dati.inizializzate;
    const statiValidi = new Set<StatoMissione>(['inattiva', 'attiva', 'completata', 'fallita']);
    const passiValidi = new Set<StatoPasso>(['bloccato', 'attivo', 'completato']);
    for (const [id, s] of Object.entries(dati.missioni ?? {})) {
      if (!s || !statiValidi.has(s.stato)) continue;
      const passi = new Map<string, StatoPasso>();
      for (const [p, st] of Object.entries(s.passi ?? {})) if (passiValidi.has(st)) passi.set(p, st);
      // Passi aggiunti ai contenuti dopo il salvataggio: partono bloccati.
      for (const p of this.defs.get(id)?.passi ?? []) if (!passi.has(p.id)) passi.set(p.id, 'bloccato');
      this.stati.set(id, { stato: s.stato, passi });
    }
  }
}
