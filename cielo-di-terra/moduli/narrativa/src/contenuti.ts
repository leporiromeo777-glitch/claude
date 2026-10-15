/**
 * Tipi dei contenuti narrativi e normalizzazione dei JSON scritti dal design.
 *
 * I file veri possono avere piccole differenze di forma (liste o mappe per id,
 * nomi di campo alternativi, effetti come stringa singola): qui vengono
 * ricondotti a una forma unica, e ogni scostamento finisce in `avvisi`.
 */
import type { CondizioneGrezza } from './condizioni';
import { listaEffetti } from './effetti';

// ---------------------------------------------------------------------------
// Forma normalizzata

export interface PassoDef {
  id: string;
  /** Testo (o id di voce del taccuino) dell'obiettivo mostrato mentre il passo è attivo. */
  obiettivo?: string;
  /** Condizione di attivazione (in aggiunta al passo precedente completato, se la missione è sequenziale). */
  attivaQuando?: CondizioneGrezza;
  /** Condizione di completamento. Se manca, il passo si completa solo da codice. */
  completaQuando?: CondizioneGrezza;
  /** Effetti applicati al completamento. */
  effetti: string[];
  /** Effetti applicati all'attivazione. */
  effettiAttivazione: string[];
  /** Oggetto originale del JSON (per campi in più come descrizioni). */
  dati: Record<string, unknown>;
}

export interface MissioneDef {
  id: string;
  titolo: string;
  /** Condizione di avvio automatico. Se manca, la missione parte da un effetto o da `missioniIniziali`. */
  avviaQuando?: CondizioneGrezza;
  /** «sequenziale» (predefinito): ogni passo aspetta il precedente. «libero»: contano solo le condizioni. */
  ordine: 'sequenziale' | 'libero';
  passi: PassoDef[];
  /** Effetti applicati quando la missione è completata. */
  effetti: string[];
  dati: Record<string, unknown>;
}

export interface RispostaDef {
  testo: string;
  /** Nodo di destinazione; `null` chiude il dialogo. */
  vaiA: string | null;
  condizione?: CondizioneGrezza;
  effetti: string[];
  dati: Record<string, unknown>;
}

export interface NodoDef {
  id: string;
  /** Chi parla (se diverso dal personaggio del dialogo). */
  chi?: string;
  testo: string;
  risposte: RispostaDef[];
  /** Effetti applicati entrando nel nodo. */
  effetti: string[];
  /** Nodo successivo automatico per i nodi senza risposte. */
  vaiA?: string | null;
  dati: Record<string, unknown>;
}

export interface DialogoDef {
  id: string;
  personaggio: string;
  /** Id del primo nodo. */
  inizio: string;
  nodi: NodoDef[];
  /** Condizione perché il dialogo sia disponibile. */
  condizione?: CondizioneGrezza;
  /** Se vero il dialogo resta disponibile anche dopo essere stato finito. */
  ripetibile: boolean;
  /** Priorità nella scelta del dialogo di un personaggio (più alta = prima). */
  priorita: number;
  dati: Record<string, unknown>;
}

export type TipoVoce = 'domanda' | 'indizio' | 'parola' | 'nota' | 'obiettivo' | (string & {});

export interface VoceDef {
  id: string;
  tipo: TipoVoce;
  testo: string;
  /** Per gli indizi: da dove viene (persona, luogo, documento). */
  fonte?: string;
  /** Per le parole: il termine tecnico (barrato) … */
  tecnica?: string;
  /** … e quello locale accanto. */
  locale?: string;
  /** Per gli indizi: la domanda a cui si riferiscono. */
  domanda?: string;
  /** Testo della risposta, mostrato quando la domanda è chiusa. */
  risposta?: string;
  /** La voce si scrive da sola quando la condizione diventa vera. */
  sbloccaQuando?: CondizioneGrezza;
  /** La domanda si chiude da sola quando la condizione diventa vera. */
  chiudiQuando?: CondizioneGrezza;
  dati: Record<string, unknown>;
}

export interface ContenutiNormalizzati {
  missioni: MissioneDef[];
  dialoghi: Record<string, DialogoDef>;
  taccuino: VoceDef[];
  avvisi: string[];
}

/** I JSON grezzi così come vengono letti dai file (forma libera). */
export interface ContenutiNarrativa {
  missioni?: unknown;
  dialoghi?: unknown;
  taccuino?: unknown;
}

// ---------------------------------------------------------------------------
// Utilità

type Oggetto = Record<string, unknown>;

function oggetto(x: unknown): x is Oggetto {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function primo(o: Oggetto, ...chiavi: string[]): unknown {
  for (const k of chiavi) if (o[k] !== undefined) return o[k];
  return undefined;
}

function stringa(x: unknown): string | undefined {
  if (typeof x === 'string') return x;
  if (typeof x === 'number') return String(x);
  return undefined;
}

/** Converte una lista o una mappa per id in lista di [id, oggetto]. */
function voci(x: unknown, cosa: string, avvisi: string[], chiaveLista: string[]): [string | undefined, Oggetto][] {
  if (Array.isArray(x)) {
    return x.flatMap((v, i) => {
      if (!oggetto(v)) {
        avvisi.push(`${cosa}: l'elemento ${i} non è un oggetto`);
        return [];
      }
      return [[stringa(v.id), v] as [string | undefined, Oggetto]];
    });
  }
  if (oggetto(x)) {
    for (const k of chiaveLista) {
      if (Array.isArray(x[k])) return voci(x[k], cosa, avvisi, []);
    }
    return Object.entries(x).flatMap(([id, v]) => {
      if (id.startsWith('$') || id.startsWith('_')) return []; // metadati ($schema, _note…)
      if (!oggetto(v)) {
        avvisi.push(`${cosa}: «${id}» non è un oggetto`);
        return [];
      }
      return [[stringa(v.id) ?? id, v] as [string | undefined, Oggetto]];
    });
  }
  if (x !== undefined) avvisi.push(`${cosa}: forma non riconosciuta`);
  return [];
}

function condizione(o: Oggetto, ...chiavi: string[]): CondizioneGrezza | undefined {
  const v = primo(o, ...chiavi);
  return v === undefined ? undefined : (v as CondizioneGrezza);
}

// ---------------------------------------------------------------------------
// Missioni

export function normalizzaMissioni(x: unknown, avvisi: string[] = []): MissioneDef[] {
  const out: MissioneDef[] = [];
  const visti = new Set<string>();
  for (const [id, m] of voci(x, 'missioni', avvisi, ['missioni'])) {
    if (!id) {
      avvisi.push('missioni: una missione non ha id');
      continue;
    }
    if (visti.has(id)) avvisi.push(`missioni: id duplicato «${id}»`);
    visti.add(id);
    const passiGrezzi = primo(m, 'passi', 'fasi', 'obiettivi');
    const passi: PassoDef[] = [];
    const idPassi = new Set<string>();
    voci(passiGrezzi, `missione «${id}»: passi`, avvisi, []).forEach(([pid, p], i) => {
      const idPasso = pid ?? `passo${i + 1}`;
      if (!pid) avvisi.push(`missione «${id}»: il passo ${i + 1} non ha id (uso «${idPasso}»)`);
      if (idPassi.has(idPasso)) avvisi.push(`missione «${id}»: passo duplicato «${idPasso}»`);
      idPassi.add(idPasso);
      const obiettivo = stringa(primo(p, 'obiettivo_taccuino', 'obiettivo', 'testo'));
      const attivaQuando = condizione(p, 'attiva_quando', 'attivo_quando', 'condizione_attivazione');
      const completaQuando = condizione(p, 'completa_quando', 'completato_quando', 'condizione', 'condizioni');
      passi.push({
        id: idPasso,
        ...(obiettivo !== undefined ? { obiettivo } : {}),
        ...(attivaQuando !== undefined ? { attivaQuando } : {}),
        ...(completaQuando !== undefined ? { completaQuando } : {}),
        effetti: listaEffetti(primo(p, 'effetti', 'effetto', 'effetti_completamento')),
        effettiAttivazione: listaEffetti(primo(p, 'effetti_attivazione', 'effetti_inizio', 'all_attivazione')),
        dati: p,
      });
    });
    if (passi.length === 0) avvisi.push(`missione «${id}»: nessun passo`);
    const avviaQuando = condizione(m, 'avvia_quando', 'attiva_quando', 'inizia_quando', 'condizione_avvio');
    const ordine = stringa(m.ordine) === 'libero' ? 'libero' : 'sequenziale';
    out.push({
      id,
      titolo: stringa(primo(m, 'titolo', 'nome')) ?? id,
      ...(avviaQuando !== undefined ? { avviaQuando } : {}),
      ordine,
      passi,
      effetti: listaEffetti(primo(m, 'effetti', 'effetti_finali', 'al_completamento', 'ricompense')),
      dati: m,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dialoghi

const FINE_DIALOGO = new Set(['', 'fine', 'esci', 'chiudi', 'end', '__fine', 'fine_dialogo']);

/** true se `vai_a` indica la fine del dialogo. */
export function eFineDialogo(vaiA: string | null | undefined): boolean {
  return vaiA === null || vaiA === undefined || FINE_DIALOGO.has(vaiA.trim().toLowerCase());
}

function normalizzaRisposta(r: unknown, dove: string, avvisi: string[]): RispostaDef | null {
  if (typeof r === 'string') return { testo: r, vaiA: null, effetti: [], dati: {} };
  if (!oggetto(r)) {
    avvisi.push(`${dove}: risposta non valida`);
    return null;
  }
  const vai = primo(r, 'vai_a', 'vaiA', 'prossimo', 'nodo');
  const vaiA = vai === null || vai === undefined ? null : (stringa(vai) ?? null);
  const cond = condizione(r, 'condizione', 'condizioni', 'se');
  return {
    testo: stringa(primo(r, 'testo', 'risposta')) ?? '',
    vaiA: eFineDialogo(vaiA) ? null : vaiA,
    ...(cond !== undefined ? { condizione: cond } : {}),
    effetti: listaEffetti(primo(r, 'effetti', 'effetto')),
    dati: r,
  };
}

export function normalizzaDialoghi(x: unknown, avvisi: string[] = []): Record<string, DialogoDef> {
  const out: Record<string, DialogoDef> = {};
  for (const [id, d] of voci(x, 'dialoghi', avvisi, ['dialoghi'])) {
    if (!id) {
      avvisi.push('dialoghi: un dialogo non ha id');
      continue;
    }
    if (out[id]) avvisi.push(`dialoghi: id duplicato «${id}»`);
    const nodi: NodoDef[] = [];
    voci(primo(d, 'nodi', 'battute'), `dialogo «${id}»: nodi`, avvisi, []).forEach(([nid, n], i) => {
      const idNodo = nid ?? `nodo${i + 1}`;
      if (!nid) avvisi.push(`dialogo «${id}»: il nodo ${i + 1} non ha id (uso «${idNodo}»)`);
      const risposteGrezze = primo(n, 'risposte', 'scelte');
      const risposte = Array.isArray(risposteGrezze)
        ? risposteGrezze.flatMap((r) => normalizzaRisposta(r, `dialogo «${id}», nodo «${idNodo}»`, avvisi) ?? [])
        : [];
      const vai = primo(n, 'vai_a', 'prossimo');
      const chi = stringa(primo(n, 'chi', 'parla', 'personaggio'));
      nodi.push({
        id: idNodo,
        ...(chi !== undefined ? { chi } : {}),
        testo: stringa(primo(n, 'testo', 'battuta')) ?? '',
        risposte,
        effetti: listaEffetti(primo(n, 'effetti', 'effetto')),
        ...(vai !== undefined ? { vaiA: eFineDialogo(stringa(vai) ?? null) ? null : stringa(vai)! } : {}),
        dati: n,
      });
    });
    if (nodi.length === 0) avvisi.push(`dialogo «${id}»: nessun nodo`);
    const inizio = stringa(primo(d, 'inizio', 'nodo_iniziale', 'primo')) ?? nodi[0]?.id ?? '';
    const cond = condizione(d, 'condizione', 'condizioni', 'disponibile_quando');
    out[id] = {
      id,
      personaggio: stringa(primo(d, 'personaggio', 'chi')) ?? '',
      inizio,
      nodi,
      ...(cond !== undefined ? { condizione: cond } : {}),
      ripetibile: d.ripetibile === true,
      priorita: typeof d.priorita === 'number' ? d.priorita : 0,
      dati: d,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Taccuino

const TIPI_DA_GRUPPO: Record<string, TipoVoce> = {
  domande: 'domanda',
  indizi: 'indizio',
  parole: 'parola',
  note: 'nota',
  obiettivi: 'obiettivo',
};

function normalizzaVoce(id: string | undefined, v: Oggetto, tipoGruppo: TipoVoce | undefined, avvisi: string[]): VoceDef | null {
  if (!id) {
    avvisi.push('taccuino: una voce non ha id');
    return null;
  }
  const tipo = (stringa(v.tipo) ?? tipoGruppo ?? 'nota') as TipoVoce;
  const voce: VoceDef = {
    id,
    tipo,
    testo: stringa(primo(v, 'testo', 'domanda', 'frase', 'titolo')) ?? '',
    dati: v,
  };
  const campi: [keyof VoceDef, string[]][] = [
    ['fonte', ['fonte']],
    ['tecnica', ['tecnica', 'parola_tecnica', 'barrata']],
    ['locale', ['locale', 'parola_locale']],
    ['domanda', ['domanda_id', 'per_domanda', 'pista']],
    ['risposta', ['risposta', 'testo_chiusa']],
  ];
  for (const [campo, chiavi] of campi) {
    const s = stringa(primo(v, ...chiavi));
    if (s !== undefined) (voce as unknown as Oggetto)[campo] = s;
  }
  // «domanda» è sia il testo di una domanda sia il collegamento di un indizio.
  if (tipo !== 'domanda' && voce.domanda === undefined && typeof v.domanda === 'string' && v.testo !== undefined) {
    voce.domanda = v.domanda;
  }
  const sblocca = condizione(v, 'sblocca_quando', 'scrivi_quando', 'appare_quando');
  if (sblocca !== undefined) voce.sbloccaQuando = sblocca;
  const chiudi = condizione(v, 'chiudi_quando', 'chiusa_quando', 'risolta_quando');
  if (chiudi !== undefined) voce.chiudiQuando = chiudi;
  if (tipo === 'parola' && voce.testo === '') voce.testo = voce.locale ?? voce.tecnica ?? '';
  if (tipo === 'parola' && (!voce.tecnica || !voce.locale)) {
    avvisi.push(`taccuino: la parola «${id}» non ha sia «tecnica» sia «locale»`);
  }
  return voce;
}

export function normalizzaTaccuino(x: unknown, avvisi: string[] = []): VoceDef[] {
  const out: VoceDef[] = [];
  if (oggetto(x) && !Array.isArray(x.voci) && Object.keys(x).some((k) => k in TIPI_DA_GRUPPO)) {
    // Forma raggruppata: { domande: [...], indizi: [...], parole: [...] }
    for (const [gruppo, contenuto] of Object.entries(x)) {
      const tipo = TIPI_DA_GRUPPO[gruppo];
      if (!tipo) {
        if (gruppo === 'riga_cielo' || gruppo.startsWith('$') || gruppo.startsWith('_')) continue;
        avvisi.push(`taccuino: gruppo sconosciuto «${gruppo}»`);
        continue;
      }
      for (const [id, v] of voci(contenuto, `taccuino.${gruppo}`, avvisi, [])) {
        const voce = normalizzaVoce(id, v, tipo, avvisi);
        if (voce) out.push(voce);
      }
    }
  } else {
    for (const [id, v] of voci(x, 'taccuino', avvisi, ['voci'])) {
      const voce = normalizzaVoce(id, v, undefined, avvisi);
      if (voce) out.push(voce);
    }
  }
  const visti = new Set<string>();
  for (const v of out) {
    if (visti.has(v.id)) avvisi.push(`taccuino: id duplicato «${v.id}»`);
    visti.add(v.id);
  }
  return out;
}

/** Normalizza tutti i contenuti narrativi. */
export function normalizzaContenuti(c: ContenutiNarrativa): ContenutiNormalizzati {
  const avvisi: string[] = [];
  return {
    missioni: normalizzaMissioni(c.missioni, avvisi),
    dialoghi: normalizzaDialoghi(c.dialoghi, avvisi),
    taccuino: normalizzaTaccuino(c.taccuino, avvisi),
    avvisi,
  };
}
