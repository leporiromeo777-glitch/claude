/**
 * Il direttore dei dialoghi: porta i nodi del motore della storia (`narrativa.dialoghi`) nella
 * finestra di dialogo dell'interfaccia e le scelte del giocatore indietro.
 *
 * - parlando (E vicino a una persona), interagendo (l'altoparlante), automatici ed «effetto»
 *   (annunciati dalla storia con `apriDialogo`): questi ultimi aspettano in coda finché non
 *   c'è niente di aperto (un altro dialogo, una carta da leggere);
 * - il nome di chi parla resta «una velata» finché Elvira non lo sa (GDD §8.1);
 * - mentre si parla la persona guarda Elvira (lo fanno gli abitanti: è vicina);
 * - un dialogo automatico in coda si apre solo se la sua condizione vale ancora (Elvira è
 *   tornata alla Bacheca), adesso o nell'ambito del passo che fa avanzare (il luogo raggiunto
 *   durante il passo, come per il segnalino: la prova alla passerella, con Elvira che va
 *   incontro a Ottavio), e, se è legato a un luogo, solo se chi parla è vicino: la novizia che
 *   aspetta alla Bacheca non parla a Elvira dall'altra parte del paese, la mattina dopo, perché
 *   ieri sera lei era passata di lì. Le richieste «forzate» della rete di sicurezza
 *   (`percorso.ts`) saltano la condizione.
 */
import type { VistaNodo } from '../narrativa';
import type { BattutaDialogo } from '../ui';
import type { Regia } from './regia';

/** Oltre questa distanza (m) Ottavio viene incontro a Elvira prima di un dialogo automatico. */
const DISTANZA_PER_PARLARE = 6;
/**
 * Entro questa distanza (m) da Elvira una persona apre un dialogo automatico legato a un luogo
 * (Ottavio a parte: viene lui).
 */
export const DISTANZA_DIALOGO_AUTOMATICO = 25;

/**
 * Per quanto «parla» chi dice la battuta (s): il tempo in cui la finestra scrive il testo (50 caratteri al
 * secondo, più le pause della punteggiatura) e un po' di più, perché lo si legge; mai meno di 1,2 s né più
 * di 6. Il markup del testo non conta.
 */
export function durataBattuta(testo: string): number {
  const t = testo.replace(/<[^>]*>/g, '');
  const pause = (t.match(/[.,;:!?…]/g) ?? []).length;
  return Math.max(1.2, Math.min(6, 0.6 + t.length / 38 + pause * 0.15));
}

/** La condizione d'apertura di un dialogo nomina un luogo («luogo:bacheca_ore raggiunto»)? */
export function dialogoDiUnLuogo(condizione: unknown): boolean {
  const t = typeof condizione === 'string' ? condizione : condizione === undefined || condizione === null ? '' : JSON.stringify(condizione);
  return /(^|[^\w])luogo:/.test(t);
}

interface Richiesta {
  dialogo: string;
  automatico: boolean;
  /** Richiesta della rete di sicurezza: si apre anche se la condizione non vale (chi parla viene da Elvira). */
  forzato: boolean;
}

export class DirettoreDialoghi {
  private coda: Richiesta[] = [];
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
  richiedi(dialogo: string, automatico: boolean, forzato = false): void {
    if (this.vista?.dialogo === dialogo) return;
    const gia = this.coda.find((c) => c.dialogo === dialogo);
    if (gia) {
      gia.forzato ||= forzato;
      return;
    }
    this.coda.push({ dialogo, automatico, forzato });
  }

  /** Il dialogo aspetta in coda di potersi aprire. */
  inCoda(dialogo: string): boolean {
    return this.coda.some((c) => c.dialogo === dialogo);
  }

  /** Da chiamare a ogni passo: apre il prossimo dialogo in coda quando si può. */
  update(): void {
    if (this.aperto || !this.coda.length) return;
    if (this.r.ui.lettore.visible || this.r.ponte.attesaAperta || this.r.ui.titolo.visible) return;
    // i dialoghi già finiti (la novizia, quando il pacco l'ha portato Ottavio) escono dalla coda
    this.coda = this.coda.filter((c) => !this.r.narrativa.dialoghi.finito(c.dialogo) || this.ripetibile(c.dialogo));
    // un dialogo con una persona aspetta che la persona ci sia (Ottavio che scende dal cielo)
    const i = this.coda.findIndex((c) => this.condizioneVale(c) && this.personaPronta(c.dialogo, c.automatico));
    if (i < 0) return;
    const [prossimo] = this.coda.splice(i, 1);
    if (!prossimo) return;
    if (this.mostra(this.r.narrativa.dialoghi.avvia(prossimo.dialogo))) {
      const p = this.r.narrativa.dialoghi.definizione(prossimo.dialogo)?.personaggio ?? '';
      const testa = this.r.abitanti.puntoDialogo(p);
      if (testa) this.r.voltatiVerso(testa);
    }
  }

  /**
   * Un dialogo automatico (non forzato) si apre solo se la sua condizione vale ancora: adesso, o
   * nell'ambito di un passo che il dialogo fa avanzare, come la legge il segnalino (la prova alla
   * passerella: «raggiunta durante il passo» anche se Elvira, seguendo il segnalino su Ottavio che
   * scende, ne è uscita; lui viene da lei).
   */
  private condizioneVale(c: Richiesta): boolean {
    if (!c.automatico || c.forzato) return true;
    const n = this.r.narrativa;
    const cond = n.dialoghi.definizione(c.dialogo)?.condizione;
    if (cond === undefined || n.valuta(cond)) return true;
    return this.r.percorso.ambitiDelDialogo(c.dialogo).some((a) => n.valuta(cond, undefined, a));
  }

  private personaPronta(dialogo: string, automatico = false): boolean {
    const p = this.r.narrativa.dialoghi.definizione(dialogo)?.personaggio;
    const a = this.r.abitanti;
    if (!p || !a.ha(p)) return true;
    if (automatico && p !== 'ottavio' && dialogoDiUnLuogo(this.r.narrativa.dialoghi.definizione(dialogo)?.condizione)) {
      // chi aspetta Elvira in un luogo (la novizia alla Bacheca) le parla da vicino; gli altri
      // dialoghi automatici (il letto nella Casa del Velo, alle 20:30) si aprono dove capita
      const e = this.r.game.player.cyl;
      return a.presente(p) && a.distanzaDa(p, e.z, e.theta) <= DISTANZA_DIALOGO_AUTOMATICO;
    }
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
    // chi parla si gira con calma verso Elvira, se la didascalia non dice il contrario («Non si gira»: Togna
    // china sulla vasca); in ogni caso la guarda
    this.r.abitanti.voltaVerso(v.chi, this.r.game.player.cyl, !/non si gira/i.test(v.didascalia ?? ''));
    // la battuta: un piccolo cenno, ogni tanto un gesto (src/personaggi/animatore.ts, annunciaBattuta)
    this.r.abitanti.battuta(v.chi, durataBattuta(v.testo));
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
      this.r.abitanti.battuta(prossimo.chi, durataBattuta(prossimo.testo));
    } else this.chiudi();
  }

  /** Chiude la finestra (il dialogo è finito o interrotto). */
  chiudi(): void {
    const v = this.vista;
    this.vista = null;
    if (this.r.ui.dialogo.visible) this.r.ui.dialogo.hide();
    if (v && !this.r.narrativa.dialoghi.isFinished()) this.r.narrativa.dialoghi.interrompi();
    // chi parlava smette e, fra poco, torna alle sue cose (src/regia/png.ts, dopoDialogo)
    if (v) this.r.abitanti.fineDialogo();
  }

  svuota(): void {
    this.coda = [];
    this.chiudi();
  }
}
