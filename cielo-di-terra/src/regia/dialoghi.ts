/**
 * Il direttore dei dialoghi: porta i nodi del motore della storia (`narrativa.dialoghi`) nella
 * finestra di dialogo dell'interfaccia e le scelte del giocatore indietro.
 *
 * - parlando (E vicino a una persona), interagendo (l'altoparlante), automatici ed «effetto»
 *   (annunciati dalla storia con `apriDialogo`): questi ultimi aspettano in coda finché non
 *   c'è niente di aperto (un altro dialogo, una carta da leggere);
 * - il nome di chi parla resta «una velata» finché Elvira non lo sa (GDD §8.1);
 * - mentre si parla la persona guarda Elvira (lo fanno gli abitanti: è vicina).
 */
import type { VistaNodo } from '../narrativa';
import type { BattutaDialogo } from '../ui';
import type { Regia } from './regia';

/** Oltre questa distanza (m) Ottavio viene incontro a Elvira prima di un dialogo automatico. */
const DISTANZA_PER_PARLARE = 6;

export class DirettoreDialoghi {
  private coda: { dialogo: string; automatico: boolean }[] = [];
  private vista: VistaNodo | null = null;
  /** Ultimo dialogo mostrato (per i test). */
  ultimo: string | null = null;

  constructor(private r: Regia) {
    const ui = r.ui;
    ui.dialogo.on('scelta', (i) => this.scegli(i));
    ui.dialogo.on('avanti', () => this.scegli(0));
  }

  get aperto(): boolean {
    return this.vista !== null;
  }

  get nodo(): VistaNodo | null {
    return this.vista;
  }

  /** Dialogo «parlando con» un personaggio; null se non ha niente da dire adesso. */
  parla(personaggio: string): boolean {
    if (this.aperto) return false;
    return this.mostra(this.r.narrativa.parla(personaggio));
  }

  interagisci(oggetto: string): boolean {
    if (this.aperto) return false;
    return this.mostra(this.r.narrativa.interagisci(oggetto));
  }

  /** Un dialogo annunciato dalla storia (automatico o da un effetto). */
  richiedi(dialogo: string, automatico: boolean): void {
    if (this.coda.some((c) => c.dialogo === dialogo) || this.vista?.dialogo === dialogo) return;
    this.coda.push({ dialogo, automatico });
  }

  /** Da chiamare a ogni passo: apre il prossimo dialogo in coda quando si può. */
  update(): void {
    if (this.aperto || !this.coda.length) return;
    if (this.r.ui.lettore.visible || this.r.ponte.attesaAperta || this.r.ui.titolo.visible) return;
    // un dialogo con una persona aspetta che la persona ci sia (Ottavio che scende dal cielo)
    const i = this.coda.findIndex((c) => this.personaPronta(c.dialogo));
    if (i < 0) return;
    const [prossimo] = this.coda.splice(i, 1);
    if (!prossimo) return;
    if (this.r.narrativa.dialoghi.finito(prossimo.dialogo) && !this.ripetibile(prossimo.dialogo)) return;
    if (this.mostra(this.r.narrativa.dialoghi.avvia(prossimo.dialogo))) {
      const p = this.r.narrativa.dialoghi.definizione(prossimo.dialogo)?.personaggio ?? '';
      const testa = this.r.abitanti.puntoDialogo(p);
      if (testa) this.r.voltatiVerso(testa);
    }
  }

  private personaPronta(dialogo: string): boolean {
    const p = this.r.narrativa.dialoghi.definizione(dialogo)?.personaggio;
    const a = this.r.abitanti;
    if (!p || !a.ha(p)) return true;
    if (p === 'ottavio') {
      if (a.modoOttavio === 'atterra' || a.modoOttavio === 'raggiunge') return false;
      // lontano (atterrato dall'altra parte della piazza, fermo davanti al fienile) o in volo:
      // viene incontro (o scende dal cielo)
      const e = this.r.game.player.cyl;
      if (a.modoOttavio !== 'accompagna' && a.modoOttavio !== 'cielo' && a.distanzaOttavioDa(e.z, e.theta) > DISTANZA_PER_PARLARE) {
        a.ottavioRaggiunge();
        return false;
      }
    }
    return a.presente(p);
  }

  private ripetibile(id: string): boolean {
    return (this.r.narrativa.dialoghi.definizione(id) as { ripetibile?: boolean } | undefined)?.ripetibile === true;
  }

  private mostra(v: VistaNodo | null): boolean {
    if (!v) return false;
    this.vista = v;
    this.ultimo = v.dialogo;
    this.r.ui.dialogo.show(this.battuta(v));
    // chi parla si gira verso Elvira, se la didascalia non dice il contrario («Non si gira»)
    if (!/non si gira/i.test(v.didascalia ?? '')) this.r.abitanti.voltaVerso(v.chi, this.r.game.player.cyl);
    return true;
  }

  private battuta(v: VistaNodo): BattutaDialogo {
    const p = this.r.ponte;
    const aspetto = p.aspetto(v.chi);
    return {
      chi: p.nomeVisibile(v.chi),
      testo: v.testo,
      ...(aspetto && v.chi !== 'meridiana' ? { aspetto } : {}),
      ...(v.didascalia ? { didascalia: v.didascalia } : {}),
      ...(v.risposte.length ? { risposte: v.risposte.map((x) => ({ testo: x.testo })) } : {}),
    };
  }

  /** Scelta del giocatore (indice fra le risposte visibili; 0 = «continua»). */
  scegli(i: number): void {
    if (!this.vista) return;
    const d = this.r.narrativa.dialoghi;
    let prossimo: VistaNodo | null = null;
    try {
      prossimo = d.isFinished() ? null : d.choose(i);
    } catch (e) {
      console.warn('[regia] dialogo:', e);
      prossimo = null;
    }
    if (prossimo) {
      this.vista = prossimo;
      this.r.ui.dialogo.show(this.battuta(prossimo));
    } else this.chiudi();
  }

  /** Chiude la finestra (il dialogo è finito o interrotto). */
  chiudi(): void {
    const v = this.vista;
    this.vista = null;
    if (this.r.ui.dialogo.visible) this.r.ui.dialogo.hide();
    if (v && !this.r.narrativa.dialoghi.isFinished()) this.r.narrativa.dialoghi.interrompi();
  }

  svuota(): void {
    this.coda = [];
    this.chiudi();
  }
}
