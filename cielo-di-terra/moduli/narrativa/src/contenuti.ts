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

/** Un «evento» di un passo: mentre il passo è attivo, la prima volta che `quando` è vera si applicano gli effetti. */
export interface EventoPassoDef {
  quando: CondizioneGrezza;
  effetti: string[];
}

/** Un aiuto a tempo: dopo `dopoSecondi` secondi reali di passo attivo si applicano gli effetti (una volta). */
export interface AiutoDef {
  dopoSecondi: number;
  effetti: string[];
}

export interface PassoDef {
  id: string;
  /** Testo (o id di voce del taccuino) dell'obiettivo mostrato mentre il passo è attivo. */
  obiettivo?: string;
  /**
   * Condizione di attivazione. Se c'è, decide da sola (passi paralleli
   * possibili); se manca, il passo aspetta il precedente.
   */
  attivaQuando?: CondizioneGrezza;
  /** Condizione di completamento. Se manca, il passo si completa solo da codice. */
  completaQuando?: CondizioneGrezza;
  /** Effetti applicati al completamento. */
  effetti: string[];
  /** Effetti applicati all'attivazione. */
  effettiAttivazione: string[];
  /** Eventi interni al passo (`eventi: [{ quando, effetti }]`). */
  eventi: EventoPassoDef[];
  /** Aiuti a tempo (`aiuti: [{ dopo_s, effetti }]`). */
  aiuti: AiutoDef[];
  /** Luogo dell'obiettivo (id di luoghi.json), se c'è. */
  luogo?: string;
  /** Oggetto originale del JSON (per campi in più come descrizioni). */
  dati: Record<string, unknown>;
}

export interface MissioneDef {
  id: string;
  titolo: string;
  /** «prologo», «principale», «segreto», «libero», «sfondo»… (campo `tipo`). */
  tipo?: string;
  descrizione?: string;
  /** Condizione di avvio automatico. Se manca, la missione parte da un effetto o da `missioniIniziali`. */
  avviaQuando?: CondizioneGrezza;
  /**
   * «sequenziale» (predefinito): un passo senza `attivaQuando` aspetta il
   * precedente. «libero»: un passo senza `attivaQuando` si attiva subito.
   */
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
  /** Didascalia di regia (gesti, suoni) mostrata prima del testo. */
  didascalia?: string;
  testo: string;
  risposte: RispostaDef[];
  /** Effetti applicati entrando nel nodo. */
  effetti: string[];
  /** Nodo successivo automatico per i nodi senza risposte. */
  vaiA?: string | null;
  dati: Record<string, unknown>;
}

/**
 * Come si apre un dialogo (campo `si_apre` dei contenuti):
 * - «parlando»: quando il giocatore parla con `con` (predefinito: il personaggio);
 * - «interagendo»: quando il giocatore usa l'oggetto `con` (`Narrativa.interagisci`);
 * - «automatico»: da solo, appena la condizione è vera (evento `apriDialogo`);
 * - «effetto»: da un effetto «dialogo:id», oppure da solo appena la condizione è vera.
 */
export interface AperturaDialogo {
  come: 'parlando' | 'interagendo' | 'automatico' | 'effetto' | (string & {});
  con?: string;
}

export interface DialogoDef {
  id: string;
  personaggio: string;
  apertura: AperturaDialogo;
  /** Id del primo nodo. */
  inizio: string;
  nodi: NodoDef[];
  /** Condizione perché il dialogo sia disponibile (anche `si_apre.condizione`). */
  condizione?: CondizioneGrezza;
  /** Effetti applicati quando il dialogo finisce normalmente (`alla_fine`). */
  effettiFine: string[];
  /** Se vero il dialogo resta disponibile anche dopo essere stato finito. */
  ripetibile: boolean;
  /** Priorità nella scelta del dialogo di un personaggio (più alta = prima). */
  priorita: number;
  dati: Record<string, unknown>;
}

export type TipoVoce = 'domanda' | 'indizio' | 'parola' | 'nota' | 'proverbio' | 'leggenda' | 'obiettivo' | (string & {});

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
  /** Chi scrive: «tecnica» (stampatello, matita dura) o «madre» (corsivo, matita morbida). */
  mano?: string;
  /** La voce si scrive sotto un'altra (id). */
  sotto?: string;
  /** Per le domande: gli indizi che la riguardano. */
  indizi?: string[];
  /** Per i proverbi: il testo in dialetto e la traduzione. */
  dialetto?: string;
  italiano?: string;
  /** Nota a margine (campo `nota` o `nota_elvira`). */
  commento?: string;
  /** Questa voce prende il posto di un'altra (che viene tolta). */
  sostituisce?: string;
  /** La voce si scrive da sola quando la condizione diventa vera. */
  sbloccaQuando?: CondizioneGrezza;
  /** La domanda si chiude da sola quando la condizione diventa vera. */
  chiudiQuando?: CondizioneGrezza;
  dati: Record<string, unknown>;
}

/**
 * Una scena di testi.json con una condizione o degli effetti finali (per
 * esempio le varianti dell'Ombrista in `leggende`): il gioco chiede quale
 * scena del gruppo è disponibile, la recita e poi la dichiara conclusa.
 */
export interface ScenaDef {
  id: string;
  /** Sezione di testi.json («leggende»…). */
  gruppo: string;
  condizione?: CondizioneGrezza;
  effettiFine: string[];
  dati: Record<string, unknown>;
}

/** Una candidata per la «riga del cielo»: vince la più alta `priorita` fra quelle con `quando` vera. */
export interface RigaCieloDef {
  id: string;
  /** Può contenere segnaposto come `{secondi}` (vedi `riempiSegnaposto`). */
  testo: string;
  priorita: number;
  quando?: CondizioneGrezza;
}

export interface ContenutiNormalizzati {
  missioni: MissioneDef[];
  dialoghi: Record<string, DialogoDef>;
  taccuino: VoceDef[];
  /** Candidate della riga del cielo (`taccuino.json` → `riga_del_cielo`). */
  rigaCielo: RigaCieloDef[];
  /** Scene con condizione o effetti finali (`testi.json`, per esempio le leggende dell'Ombrista). */
  scene: ScenaDef[];
  avvisi: string[];
}

/** I JSON grezzi così come vengono letti dai file (forma libera). */
export interface ContenutiNarrativa {
  missioni?: unknown;
  dialoghi?: unknown;
  taccuino?: unknown;
  /** testi.json (facoltativo): se ne leggono solo le scene con `condizione` o `alla_fine`. */
  testi?: unknown;
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

/** Condizione di un campo; `null` vale «assente». */
function condizione(o: Oggetto, ...chiavi: string[]): CondizioneGrezza | undefined {
  const v = primo(o, ...chiavi);
  return v === undefined || v === null ? undefined : (v as CondizioneGrezza);
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
      const luogo = stringa(p.luogo);
      const eventi: EventoPassoDef[] = [];
      const eventiGrezzi = primo(p, 'eventi', 'reazioni');
      if (Array.isArray(eventiGrezzi)) {
        eventiGrezzi.forEach((e, k) => {
          const quando = oggetto(e) ? condizione(e, 'quando', 'condizione', 'se') : undefined;
          if (!oggetto(e) || quando === undefined) {
            avvisi.push(`missione «${id}», passo «${idPasso}»: l'evento ${k + 1} non ha «quando»`);
            return;
          }
          eventi.push({ quando, effetti: listaEffetti(primo(e, 'effetti', 'effetto')) });
        });
      }
      const aiuti: AiutoDef[] = [];
      const aiutiGrezzi = p.aiuti;
      if (Array.isArray(aiutiGrezzi)) {
        aiutiGrezzi.forEach((a, k) => {
          const dopo = oggetto(a) ? primo(a, 'dopo_s', 'dopo_secondi', 'dopo') : undefined;
          if (!oggetto(a) || typeof dopo !== 'number') {
            avvisi.push(`missione «${id}», passo «${idPasso}»: l'aiuto ${k + 1} non ha «dopo_s»`);
            return;
          }
          aiuti.push({ dopoSecondi: dopo, effetti: listaEffetti(primo(a, 'effetti', 'effetto')) });
        });
      }
      passi.push({
        id: idPasso,
        ...(obiettivo !== undefined ? { obiettivo } : {}),
        ...(attivaQuando !== undefined ? { attivaQuando } : {}),
        ...(completaQuando !== undefined ? { completaQuando } : {}),
        effetti: listaEffetti(primo(p, 'effetti', 'effetto', 'effetti_completamento')),
        effettiAttivazione: listaEffetti(primo(p, 'effetti_attivazione', 'effetti_inizio', 'all_attivazione')),
        eventi,
        aiuti,
        ...(luogo !== undefined ? { luogo } : {}),
        dati: p,
      });
    });
    if (passi.length === 0) avvisi.push(`missione «${id}»: nessun passo`);
    const avviaQuando = condizione(m, 'avvia_quando', 'attiva_quando', 'inizia_quando', 'condizione_avvio');
    const ordine = stringa(m.ordine) === 'libero' ? 'libero' : 'sequenziale';
    const tipo = stringa(m.tipo);
    const descrizione = stringa(m.descrizione);
    out.push({
      id,
      titolo: stringa(primo(m, 'titolo', 'nome')) ?? id,
      ...(tipo !== undefined ? { tipo } : {}),
      ...(descrizione !== undefined ? { descrizione } : {}),
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
      const didascalia = stringa(primo(n, 'didascalia', 'regia'));
      nodi.push({
        id: idNodo,
        ...(chi !== undefined ? { chi } : {}),
        ...(didascalia !== undefined ? { didascalia } : {}),
        testo: stringa(primo(n, 'testo', 'battuta')) ?? '',
        risposte,
        effetti: listaEffetti(primo(n, 'effetti', 'effetto')),
        ...(vai !== undefined ? { vaiA: eFineDialogo(stringa(vai) ?? null) ? null : stringa(vai)! } : {}),
        dati: n,
      });
    });
    if (nodi.length === 0) avvisi.push(`dialogo «${id}»: nessun nodo`);
    const inizio = stringa(primo(d, 'inizio', 'nodo_iniziale', 'primo')) ?? nodi[0]?.id ?? '';
    const siApre = oggetto(d.si_apre) ? d.si_apre : {};
    const cond = condizione(siApre, 'condizione', 'condizioni', 'quando') ?? condizione(d, 'condizione', 'condizioni', 'disponibile_quando');
    const personaggio = stringa(primo(d, 'personaggio', 'chi')) ?? '';
    const come = stringa(siApre.come) ?? 'parlando';
    if (!['parlando', 'interagendo', 'automatico', 'effetto'].includes(come)) {
      avvisi.push(`dialogo «${id}»: si_apre.come sconosciuto «${come}»`);
    }
    const con = stringa(siApre.con);
    out[id] = {
      id,
      personaggio,
      apertura: { come, ...(con !== undefined ? { con } : {}) },
      inizio,
      nodi,
      ...(cond !== undefined ? { condizione: cond } : {}),
      effettiFine: listaEffetti(primo(d, 'alla_fine', 'effetti_fine', 'effetti')),
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
  proverbi: 'proverbio',
  leggende: 'leggenda',
  obiettivi: 'obiettivo',
};

const GRUPPI_RIGA_CIELO = ['riga_del_cielo', 'riga_cielo', 'righe_cielo'];

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
    ['mano', ['mano']],
    ['sotto', ['sotto']],
    ['dialetto', ['dialetto']],
    ['italiano', ['italiano']],
    ['commento', ['nota', 'nota_elvira']],
    ['sostituisce', ['sostituisce']],
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
  if (Array.isArray(v.indizi)) voce.indizi = v.indizi.filter((x): x is string => typeof x === 'string');
  if (tipo === 'parola' && voce.testo === '') voce.testo = voce.locale ?? voce.tecnica ?? '';
  if (tipo === 'proverbio' && voce.testo === '') voce.testo = voce.dialetto ?? voce.italiano ?? '';
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
        if (GRUPPI_RIGA_CIELO.includes(gruppo) || gruppo === 'versione' || gruppo.startsWith('$') || gruppo.startsWith('_')) continue;
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

/** Candidate della riga del cielo da taccuino.json (`riga_del_cielo`). */
export function normalizzaRigaCielo(x: unknown, avvisi: string[] = []): RigaCieloDef[] {
  if (!oggetto(x)) return [];
  const gruppo = GRUPPI_RIGA_CIELO.map((k) => x[k]).find((v) => v !== undefined);
  if (gruppo === undefined) return [];
  return voci(gruppo, 'taccuino.riga_del_cielo', avvisi, []).flatMap(([id, r], i) => {
    const testo = stringa(r.testo);
    if (!testo) {
      avvisi.push(`taccuino.riga_del_cielo: la riga ${i + 1} non ha testo`);
      return [];
    }
    const quando = condizione(r, 'quando', 'condizione');
    return [
      {
        id: id ?? `riga${i + 1}`,
        testo,
        priorita: typeof r.priorita === 'number' ? r.priorita : 0,
        ...(quando !== undefined ? { quando } : {}),
      },
    ];
  });
}

/** Sostituisce i segnaposto `{nome}` di un testo (per esempio la riga del cielo «Meta fra {secondi} s»). */
export function riempiSegnaposto(testo: string, valori: Record<string, string | number>): string {
  return testo.replace(/\{(\w+)\}/g, (m, k: string) => (k in valori ? String(valori[k]) : m));
}

/** Scene di testi.json: le voci (di qualunque sezione) che hanno `condizione` o `alla_fine`. */
export function normalizzaScene(x: unknown, avvisi: string[] = []): ScenaDef[] {
  if (!oggetto(x)) return [];
  const out: ScenaDef[] = [];
  for (const [gruppo, sezione] of Object.entries(x)) {
    if (gruppo.startsWith('_') || gruppo.startsWith('$')) continue;
    if (!oggetto(sezione) && !Array.isArray(sezione)) continue;
    for (const [id, v] of voci(sezione, `testi.${gruppo}`, [], [])) {
      if (!id) continue;
      const cond = condizione(v, 'condizione', 'quando_vale');
      const effettiFine = listaEffetti(primo(v, 'alla_fine', 'effetti_fine'));
      if (cond === undefined && effettiFine.length === 0) continue;
      if (typeof v.quando === 'string' && cond === undefined && effettiFine.length === 0) continue;
      out.push({ id, gruppo, ...(cond !== undefined ? { condizione: cond } : {}), effettiFine, dati: v });
    }
  }
  const visti = new Set<string>();
  for (const s of out) {
    if (visti.has(s.id)) avvisi.push(`testi: scena duplicata «${s.id}»`);
    visti.add(s.id);
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
    rigaCielo: normalizzaRigaCielo(c.taccuino, avvisi),
    scene: normalizzaScene(c.testi, avvisi),
    avvisi,
  };
}
