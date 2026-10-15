/**
 * Il Taccuino di Elvira: domande (piste) aperte e chiuse, indizi con la
 * fonte, parole tecniche barrate con accanto quella locale, note, proverbi,
 * leggende, obiettivi delle missioni e, in alto, la «riga del cielo» con il
 * prossimo evento del cielo.
 *
 * Una parola si scrive già barrata (la tecnica barrata, la locale accanto),
 * come vuole taccuino.json. Una voce con `sostituisce` toglie quella che
 * sostituisce. Una domanda con `chiudiQuando` si chiude da sola, ma solo se
 * è già scritta.
 */
import type { CondizioneGrezza } from './condizioni';
import type { TipoVoce, VoceDef } from './contenuti';
import { Emettitore } from './eventi';

export interface MomentoGioco {
  giorno: number;
  ora: number;
}

export interface StatoVoce {
  id: string;
  /** Ordine di scrittura (0, 1, 2…). */
  ordine: number;
  chiusa: boolean;
  barrata: boolean;
  scrittaIl?: MomentoGioco;
  chiusaIl?: MomentoGioco;
}

/** Una voce pronta per la UI. */
export interface VoceVisibile {
  id: string;
  tipo: TipoVoce;
  testo: string;
  fonte?: string;
  tecnica?: string;
  locale?: string;
  domanda?: string;
  risposta?: string;
  mano?: string;
  sotto?: string;
  indizi?: string[];
  dialetto?: string;
  italiano?: string;
  commento?: string;
  chiusa: boolean;
  barrata: boolean;
  ordine: number;
  scrittaIl?: MomentoGioco;
  chiusaIl?: MomentoGioco;
  /** false se l'id non esiste in taccuino.json (la voce mostra l'id come testo). */
  nota: boolean;
}

export interface Obiettivo {
  missione: string;
  passo: string;
  testo: string;
}

export type AzioneVoce = 'aggiunta' | 'chiusa' | 'riaperta' | 'barrata' | 'rimossa';

export interface EventiTaccuino {
  voce: { id: string; azione: AzioneVoce; voce: VoceVisibile | null };
  rigaCielo: { testo: string | null };
  obiettivi: { obiettivi: Obiettivo[] };
}

export interface StatoTaccuino {
  voci: StatoVoce[];
  rigaCielo: string | null;
  obiettivi: Obiettivo[];
}

export class Taccuino {
  readonly eventi = new Emettitore<EventiTaccuino>();
  private readonly defs = new Map<string, VoceDef>();
  private readonly stati = new Map<string, StatoVoce>();
  private prossimoOrdine = 0;
  /** Riga del cielo scritta dai contenuti (effetto «cielo:») o dal gioco con `impostaRigaCielo`. */
  private riga: string | null = null;
  /** Riga calcolata dal gioco a ogni tick (`WorldFacts.prossimoEventoCielo`). */
  private rigaGioco: string | null = null;
  /** Riga scelta fra le candidate di taccuino.json (`riga_del_cielo`) a ogni tick. */
  private rigaCandidata: { id: string; testo: string } | null = null;
  private obiettiviAttivi: Obiettivo[] = [];

  constructor(
    voci: readonly VoceDef[],
    private readonly adesso: () => MomentoGioco | undefined = () => undefined,
  ) {
    for (const v of voci) this.defs.set(v.id, v);
  }

  /** Definizione di una voce (da taccuino.json). */
  definizione(id: string): VoceDef | undefined {
    return this.defs.get(id);
  }

  /** true se la voce è già scritta. */
  ha(id: string): boolean {
    return this.stati.has(id);
  }

  stato(id: string): StatoVoce | undefined {
    const s = this.stati.get(id);
    return s ? { ...s } : undefined;
  }

  /** Scrive una voce. Restituisce false se c'era già. */
  aggiungi(id: string): boolean {
    if (this.stati.has(id)) return false;
    const quando = this.adesso();
    const def = this.defs.get(id);
    this.stati.set(id, {
      id,
      ordine: this.prossimoOrdine++,
      chiusa: false,
      barrata: def?.tipo === 'parola',
      ...(quando ? { scrittaIl: quando } : {}),
    });
    if (def?.sostituisce) this.rimuovi(def.sostituisce);
    this.eventi.emit('voce', { id, azione: 'aggiunta', voce: this.voce(id) });
    return true;
  }

  /** Chiude una domanda (scrivendola prima, se non c'era). */
  chiudi(id: string): boolean {
    this.aggiungi(id);
    const s = this.stati.get(id)!;
    if (s.chiusa) return false;
    s.chiusa = true;
    const quando = this.adesso();
    if (quando) s.chiusaIl = quando;
    this.eventi.emit('voce', { id, azione: 'chiusa', voce: this.voce(id) });
    return true;
  }

  riapri(id: string): boolean {
    const s = this.stati.get(id);
    if (!s || !s.chiusa) return false;
    s.chiusa = false;
    delete s.chiusaIl;
    this.eventi.emit('voce', { id, azione: 'riaperta', voce: this.voce(id) });
    return true;
  }

  /** Barra la parola tecnica (scrivendo la voce prima, se non c'era). */
  barra(id: string): boolean {
    this.aggiungi(id);
    const s = this.stati.get(id)!;
    if (s.barrata) return false;
    s.barrata = true;
    this.eventi.emit('voce', { id, azione: 'barrata', voce: this.voce(id) });
    return true;
  }

  rimuovi(id: string): boolean {
    if (!this.stati.delete(id)) return false;
    this.eventi.emit('voce', { id, azione: 'rimossa', voce: null });
    return true;
  }

  /** Vista di una voce scritta (null se non è scritta). */
  voce(id: string): VoceVisibile | null {
    const s = this.stati.get(id);
    if (!s) return null;
    const d = this.defs.get(id);
    const v: VoceVisibile = {
      id,
      tipo: d?.tipo ?? 'nota',
      testo: d?.testo ?? id,
      chiusa: s.chiusa,
      barrata: s.barrata,
      ordine: s.ordine,
      nota: d !== undefined,
    };
    if (d?.fonte !== undefined) v.fonte = d.fonte;
    if (d?.tecnica !== undefined) v.tecnica = d.tecnica;
    if (d?.locale !== undefined) v.locale = d.locale;
    if (d?.domanda !== undefined) v.domanda = d.domanda;
    if (d?.risposta !== undefined) v.risposta = d.risposta;
    if (d?.mano !== undefined) v.mano = d.mano;
    if (d?.sotto !== undefined) v.sotto = d.sotto;
    if (d?.indizi !== undefined) v.indizi = [...d.indizi];
    if (d?.dialetto !== undefined) v.dialetto = d.dialetto;
    if (d?.italiano !== undefined) v.italiano = d.italiano;
    if (d?.commento !== undefined) v.commento = d.commento;
    if (s.scrittaIl) v.scrittaIl = { ...s.scrittaIl };
    if (s.chiusaIl) v.chiusaIl = { ...s.chiusaIl };
    return v;
  }

  /** Tutte le voci scritte, in ordine di scrittura (filtrabili per tipo). */
  voci(tipo?: TipoVoce): VoceVisibile[] {
    return [...this.stati.values()]
      .sort((a, b) => a.ordine - b.ordine)
      .map((s) => this.voce(s.id)!)
      .filter((v) => tipo === undefined || v.tipo === tipo);
  }

  domandeAperte(): VoceVisibile[] {
    return this.voci('domanda').filter((v) => !v.chiusa);
  }

  domandeChiuse(): VoceVisibile[] {
    return this.voci('domanda').filter((v) => v.chiusa);
  }

  /** Indizi scritti; con `domanda` solo quelli collegati a quella domanda. */
  indizi(domanda?: string): VoceVisibile[] {
    return this.voci('indizio').filter((v) => domanda === undefined || v.domanda === domanda);
  }

  parole(): VoceVisibile[] {
    return this.voci('parola');
  }

  // --- Riga del cielo -------------------------------------------------------

  /**
   * Il testo fisso in alto: il prossimo evento del cielo. Vince quello
   * scritto da un effetto «cielo:» (o impostato a mano); poi la candidata di
   * taccuino.json con priorità più alta; poi quello calcolato dal gioco.
   * Può contenere segnaposto come `{secondi}` (vedi `riempiSegnaposto`).
   */
  rigaCielo(): string | null {
    return this.riga ?? this.rigaCandidata?.testo ?? this.rigaGioco;
  }

  /** Id della candidata di taccuino.json mostrata, se è quella a vincere. */
  rigaCieloId(): string | null {
    return this.riga === null && this.rigaCandidata ? this.rigaCandidata.id : null;
  }

  /** La candidata scelta da Narrativa a ogni tick (non salvata). */
  impostaRigaCieloCandidata(r: { id: string; testo: string } | null): void {
    const prima = this.rigaCielo();
    this.rigaCandidata = r ? { ...r } : null;
    this.emettiRiga(prima);
  }

  /** Imposta (o con null cancella) la riga scritta dai contenuti. Viene salvata. */
  impostaRigaCielo(testo: string | null): void {
    const prima = this.rigaCielo();
    this.riga = testo === null || testo.trim() === '' ? null : testo;
    this.emettiRiga(prima);
  }

  /** Riga calcolata dal gioco (non salvata: il gioco la ricalcola). */
  impostaRigaCieloGioco(testo: string | null): void {
    const prima = this.rigaCielo();
    this.rigaGioco = testo === null || testo.trim() === '' ? null : testo;
    this.emettiRiga(prima);
  }

  private emettiRiga(prima: string | null): void {
    const dopo = this.rigaCielo();
    if (dopo !== prima) this.eventi.emit('rigaCielo', { testo: dopo });
  }

  // --- Obiettivi delle missioni ----------------------------------------------

  obiettivi(): Obiettivo[] {
    return this.obiettiviAttivi.map((o) => ({ ...o }));
  }

  segnaObiettivo(o: Obiettivo): void {
    this.obiettiviAttivi = this.obiettiviAttivi.filter((x) => !(x.missione === o.missione && x.passo === o.passo));
    this.obiettiviAttivi.push({ ...o });
    this.eventi.emit('obiettivi', { obiettivi: this.obiettivi() });
  }

  togliObiettivo(missione: string, passo?: string): void {
    const prima = this.obiettiviAttivi.length;
    this.obiettiviAttivi = this.obiettiviAttivi.filter(
      (x) => !(x.missione === missione && (passo === undefined || x.passo === passo)),
    );
    if (this.obiettiviAttivi.length !== prima) this.eventi.emit('obiettivi', { obiettivi: this.obiettivi() });
  }

  // --- Aggiornamento automatico ---------------------------------------------

  /**
   * Scrive le voci con `sbloccaQuando` vero e chiude quelle con
   * `chiudiQuando` vero. Restituisce true se qualcosa è cambiato.
   */
  aggiorna(valuta: (c: CondizioneGrezza) => boolean): boolean {
    let cambiato = false;
    for (const d of this.defs.values()) {
      if (d.sbloccaQuando !== undefined && !this.stati.has(d.id) && valuta(d.sbloccaQuando)) {
        cambiato = this.aggiungi(d.id) || cambiato;
      }
      const s = this.stati.get(d.id);
      if (d.chiudiQuando !== undefined && s && !s.chiusa && valuta(d.chiudiQuando)) {
        cambiato = this.chiudi(d.id) || cambiato;
      }
    }
    return cambiato;
  }

  // --- Salvataggio ------------------------------------------------------------

  esporta(): StatoTaccuino {
    return {
      voci: [...this.stati.values()]
        .sort((a, b) => a.ordine - b.ordine)
        .map((s) => ({
          ...s,
          ...(s.scrittaIl ? { scrittaIl: { ...s.scrittaIl } } : {}),
          ...(s.chiusaIl ? { chiusaIl: { ...s.chiusaIl } } : {}),
        })),
      rigaCielo: this.riga,
      obiettivi: this.obiettivi(),
    };
  }

  importa(dati: StatoTaccuino): void {
    this.stati.clear();
    let max = -1;
    for (const s of dati.voci ?? []) {
      if (!s || typeof s.id !== 'string') continue;
      const copia: StatoVoce = { id: s.id, ordine: s.ordine, chiusa: !!s.chiusa, barrata: !!s.barrata };
      if (s.scrittaIl) copia.scrittaIl = { ...s.scrittaIl };
      if (s.chiusaIl) copia.chiusaIl = { ...s.chiusaIl };
      this.stati.set(s.id, copia);
      max = Math.max(max, s.ordine);
    }
    this.prossimoOrdine = max + 1;
    this.riga = dati.rigaCielo ?? null;
    this.obiettiviAttivi = (dati.obiettivi ?? []).map((o) => ({ ...o }));
  }
}
