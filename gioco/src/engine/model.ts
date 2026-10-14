/**
 * Modello compilato di un livello (uso interno del motore).
 *
 * Il motore lavora su una rappresentazione compatta dello stato: fili e perline
 * diventano indici, le perline con più portatori diventano maschere di bit, e
 * lo stato di una riga è un Int32Array con una disposizione fissa calcolata qui.
 * La stessa disposizione serve alle API pubbliche (con tutte le perline
 * tracciate) e al solver (con le sole perline che contano per le condizioni).
 *
 * Disposizione dello stato (offset):
 *   [0, W)        fili per colonna (indice del filo)
 *   OFF_KNOT      maschera dei fili annodati (bloccati nella riga successiva)
 *   OFF_DELIV     maschera delle lettere consegnate (bit = ordinale della lettera)
 *   OFF_PN        segreti ricevuti dal pozzo dall'ultimo trabocco
 *   OFF_PO        1 se il pozzo sta traboccando (darà tutto al prossimo incrocio da sopra)
 *   OFF_KNOTX…    con nodi di più righe (balance.nodoRighe > 1): maschera j = annodati
 *                 per più di j+1 righe ancora (OFF_KNOT è "più di 0", cioè la riga dopo)
 *   slot perline  lettere: indice del portatore (-1 nessuno); altre: maschera dei portatori
 *   slot agenda   puntatore all'agenda di ogni filo autonomo (filo nero, autotessitura)
 */
import type {
  AgendaItem,
  BeadType,
  CharacterId,
  EdgeEvent,
  EdgeSide,
  LevelDef,
  OccasionKind,
  PinDef,
  PlaceId,
  RuleId,
  RunContext,
  ThreadId,
  ThreadKind,
} from '../core/types';

export const K_PERSONA = 0;
export const K_LINO = 1;
export const K_NERO = 2;
export const K_AVORIO = 3;

export const B_LETTERA = 0;
export const B_VOCE = 1;
export const B_SEGRETO = 2;
export const B_FEBBRE = 3;
export const B_NOME = 4;

/** Soglia del trabocco del pozzo (GDD 3.13, balance.traboccoSoglia): valore predefinito. */
export const TRABOCCO_SOGLIA = 3;
/** Durata del nodo di rancore in righe (GDD 3.13, balance.nodoRighe): valore predefinito. */
export const NODO_RIGHE = 1;
/** Distanza massima di Zeno dal Faro (GDD 3.6). */
export const ZENO_MAX = 2;
/** Valore "infinito" per i margini dell'autotessitura. */
export const INF = 1_000_000;

const KIND_CODE: Record<ThreadKind, number> = { persona: K_PERSONA, lino: K_LINO, nero: K_NERO, avorio: K_AVORIO };
const BEAD_CODE: Record<BeadType, number> = { lettera: B_LETTERA, voce: B_VOCE, segreto: B_SEGRETO, febbre: B_FEBBRE, nome: B_NOME };

export interface EdgeStep {
  col: number;
  side: EdgeSide;
  kind: EdgeEvent['kind'];
  /** Filo che entra (indice). */
  enters: number;
  /** Ingresso del filo nero (NeroDef.enter). */
  nero: boolean;
}

export interface PinStep {
  thread: number;
  /** Colonna richiesta, -1 se il luogo non è fra le colonne (spillo impossibile). */
  col: number;
  hour: number;
  def: PinDef;
}

export type AgendaStep = { k: 'follow'; t: number } | { k: 'place'; col: number; hour: number } | { k: 'stay' };

export interface AgentModel {
  thread: number;
  agenda: AgendaStep[];
  likes: OccasionKind[];
  /** Maschera dei fili a cui vuole dare qualcosa (desiderio di tipo "dare"). */
  givesTo: number;
  nero: boolean;
  /** Offset del puntatore all'agenda nello stato. */
  slot: number;
}

export interface OccasionStep {
  kind: OccasionKind;
  col: number;
  hour: number;
}

export interface ModelOptions {
  /** Perline tracciate: 'all' (API pubbliche) o un elenco di id (solver). */
  track: 'all' | Iterable<string>;
  /** Regole spente (generatore: "la regola serve davvero?"). */
  disable?: readonly RuleId[];
}

export interface Model {
  level: LevelDef;
  ctx: RunContext;
  W: number;
  startHour: number;
  endHour: number;
  rows: number;
  columns: readonly PlaceId[];

  // Fili
  T: number;
  ids: ThreadId[];
  idx: Map<ThreadId, number>;
  kind: Uint8Array;
  chars: (CharacterId | null)[];
  namedMask: number;
  linoMask: number;
  /** Fili sulla tela all'apertura. */
  initial: number[];

  // Stranezze (indice del filo, -1 se assente o non attiva)
  qMarta: number;
  qTeresaSopra: number;
  qLegge: number;
  pozzo: number;
  trabocca: boolean;
  qGino: number;
  qNina: number;
  qZeno: number;
  qLunardi: number;
  faroCol: number;
  /** Segreti che fanno traboccare il pozzo (ctx.traboccoSoglia, predefinito 3). */
  traboccoSoglia: number;
  /** Righe bloccate da un nodo di rancore (ctx.nodoRighe, predefinito 1). */
  knotRows: number;
  /** Per filo: maschera dei fili con cui è in rancore. */
  rancor: Int32Array;

  // Perline
  B: number;
  beadIds: string[];
  beadIdx: Map<string, number>;
  beadType: Uint8Array;
  /** Destinatario (solo lettere), -1 altrimenti. */
  beadTo: Int16Array;
  /** Ordinale fra le lettere (bit di OFF_DELIV), -1 per le altre. */
  letterOrd: Int16Array;
  /** Per una lettera: perlina 'letta:<id>', -1 se non esiste. */
  lettaOf: Int16Array;
  /** Per una perlina 'letta:<id>': la lettera, -1 altrimenti. */
  lettaLetter: Int16Array;
  /** Perlina inerte (regola spenta): non passa mai. */
  inert: Uint8Array;
  /** Perline definite nel livello (le altre sono 'letta:…' e 'nome' creati dal motore). */
  defined: Uint8Array;
  /** Offset nello stato, -1 se la perlina non è tracciata. */
  slot: Int16Array;
  trackedLetters: number[];
  trackedMulti: number[];

  // Disposizione dello stato
  OFF_KNOT: number;
  OFF_DELIV: number;
  OFF_PN: number;
  OFF_PO: number;
  /** Prima delle `knotRows - 1` maschere dei nodi lunghi (-1 se i nodi durano una riga). */
  OFF_KNOTX: number;
  LEN: number;

  // Eventi della giornata, indicizzati per ora (0..24)
  edgesAt: (EdgeStep[] | null)[];
  tideAt: Int32Array;
  pinsAt: (PinStep[] | null)[];
  pins: PinStep[];
  /** Ore a cui un filo rientra per nome (per i limiti del solver). */
  reentryHours: Map<number, number[]>;

  // Autotessitura
  agents: AgentModel[];
  agentOf: Int16Array;
  controlled: number;
  autoFull: boolean;
  hasAuto: boolean;
  neroThread: number;
  occasions: OccasionStep[];
  hasEdges: boolean;
}

export function bit(i: number): number {
  return 1 << i;
}

export function popcount(x: number): number {
  let v = x >>> 0;
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24) & 0xff;
}

/** Personaggio di un filo: `character`, o l'id stesso se è un CharacterId di un filo con nome. */
function characterOf(id: ThreadId, kind: ThreadKind, character: CharacterId | undefined): CharacterId | null {
  if (character) return character;
  if (kind === 'lino') return null;
  return id as CharacterId;
}

/** Fili lino anonimi che entrano dai bordi: il primo libero fra quelli dichiarati, poi 'lino<N>'. */
function planEdges(level: LevelDef, ids: ThreadId[], kinds: ThreadKind[], disabled: ReadonlySet<RuleId>): {
  extra: ThreadId[];
  steps: { hour: number; side: EdgeSide; kind: EdgeEvent['kind']; enters: ThreadId; nero: boolean }[];
} {
  const named = new Set<ThreadId>();
  for (const e of level.edges ?? []) if (e.enters) named.add(e.enters);
  if (level.nero) named.add(level.nero.thread);
  const initial = new Set(level.initial);
  const spare: ThreadId[] = [];
  ids.forEach((id, i) => {
    if (kinds[i] === 'lino' && !initial.has(id) && !named.has(id)) spare.push(id);
  });
  const used = new Set(ids);
  const extra: ThreadId[] = [];
  let next = 1;
  const freshLino = (): ThreadId => {
    while (used.has(`lino${next}`)) next++;
    const id = `lino${next}`;
    used.add(id);
    extra.push(id);
    return id;
  };
  const steps: { hour: number; side: EdgeSide; kind: EdgeEvent['kind']; enters: ThreadId; nero: boolean }[] = [];
  const edges = disabled.has('molo') ? [] : [...(level.edges ?? [])];
  // Ordine stabile: per ora, poi nell'ordine dei dati.
  const order = edges.map((e, i) => ({ e, i })).sort((a, b) => a.e.hour - b.e.hour || a.i - b.i);
  const neroIn = level.nero && !disabled.has('nero') ? level.nero : null;
  let neroDone = false;
  for (const { e } of order) {
    const enters = e.enters ?? (spare.length > 0 ? (spare.shift() as ThreadId) : freshLino());
    if (neroIn && enters === neroIn.thread) neroDone = true;
    steps.push({ hour: e.hour, side: e.side, kind: e.kind, enters, nero: neroIn !== null && enters === neroIn.thread });
  }
  if (neroIn && !neroDone) {
    steps.push({
      hour: neroIn.enter.hour,
      side: neroIn.enter.side,
      kind: neroIn.enter.side === 'faro' ? 'secca' : 'barca',
      enters: neroIn.thread,
      nero: true,
    });
    steps.sort((a, b) => a.hour - b.hour);
  }
  return { extra, steps };
}

function compileAgenda(items: readonly AgendaItem[], idx: Map<ThreadId, number>, columns: readonly PlaceId[]): AgendaStep[] {
  const out: AgendaStep[] = [];
  for (const it of items) {
    if ('follow' in it) {
      const t = idx.get(it.follow);
      if (t !== undefined) out.push({ k: 'follow', t });
    } else if ('place' in it) {
      out.push({ k: 'place', col: columns.indexOf(it.place), hour: it.hour });
    } else out.push({ k: 'stay' });
  }
  return out;
}

export function buildModel(level: LevelDef, ctx: RunContext, opts: ModelOptions): Model {
  const disabled = new Set<RuleId>(opts.disable ?? []);
  const W = level.columns.length;
  const columns = level.columns;

  // ───── Fili ─────
  const ids: ThreadId[] = [];
  const kinds: ThreadKind[] = [];
  const charsList: (CharacterId | null)[] = [];
  for (const t of level.threads) {
    if (ids.includes(t.id)) continue;
    ids.push(t.id);
    kinds.push(t.kind);
    charsList.push(characterOf(t.id, t.kind, t.character));
  }
  // Fili citati ma non dichiarati (dati incompleti): li si aggiunge come lino.
  for (const id of level.initial) {
    if (!ids.includes(id)) {
      ids.push(id);
      kinds.push('lino');
      charsList.push(null);
    }
  }
  const plan = planEdges(level, ids, kinds, disabled);
  for (const id of plan.extra) {
    ids.push(id);
    kinds.push('lino');
    charsList.push(null);
  }
  for (const s of plan.steps) {
    if (!ids.includes(s.enters)) {
      ids.push(s.enters);
      kinds.push('lino');
      charsList.push(null);
    }
  }
  const T = ids.length;
  if (T > 30) throw new Error(`engine: too many threads (${T}) in level ${level.id}`);
  const idx = new Map<ThreadId, number>();
  ids.forEach((id, i) => idx.set(id, i));
  const kind = new Uint8Array(T);
  let namedMask = 0;
  let linoMask = 0;
  for (let i = 0; i < T; i++) {
    kind[i] = KIND_CODE[kinds[i] as ThreadKind];
    if (kinds[i] === 'lino') linoMask |= bit(i);
    else namedMask |= bit(i);
  }
  const findChar = (c: CharacterId): number => {
    for (let i = 0; i < T; i++) if (charsList[i] === c) return i;
    return -1;
  };
  const q = new Set(ctx.quirks);
  const secretsOn = !disabled.has('segreto');
  const feverOn = !disabled.has('febbre');
  const qMarta = q.has('martaNoSotto') ? findChar('marta') : -1;
  const qTeresaSopra = q.has('martaNoSotto') ? findChar('teresa') : -1;
  const qLegge = q.has('teresaLegge') ? findChar('teresa') : -1;
  const pozzo = secretsOn && (q.has('pieroPozzo') || q.has('pieroTrabocca')) ? findChar('piero') : -1;
  const trabocca = pozzo >= 0 && q.has('pieroTrabocca');
  const qGino = q.has('ginoCorre') ? findChar('gino') : -1;
  const qNina = secretsOn && q.has('ninaCuriosa') ? findChar('nina') : -1;
  const qZeno = q.has('zenoFaro') ? findChar('zeno') : -1;
  const qLunardi = feverOn && q.has('lunardiCura') ? findChar('lunardi') : -1;
  const faroIdx = columns.indexOf('faro');
  const faroCol = faroIdx >= 0 ? faroIdx : W - 1;

  const rancor = new Int32Array(T);
  if (!disabled.has('rancore')) {
    for (const pair of ctx.rancor) {
      const a = idx.get(pair[0]);
      const b = idx.get(pair[1]);
      if (a === undefined || b === undefined || a === b) continue;
      rancor[a] = (rancor[a] as number) | bit(b);
      rancor[b] = (rancor[b] as number) | bit(a);
    }
  }

  // ───── Perline ─────
  const beadIds: string[] = [];
  const beadTypes: number[] = [];
  const beadTo: number[] = [];
  const definedList: number[] = [];
  for (const b of level.beads) {
    if (beadIds.includes(b.id)) continue;
    beadIds.push(b.id);
    beadTypes.push(BEAD_CODE[b.type] ?? B_SEGRETO);
    beadTo.push(b.type === 'lettera' && b.to !== undefined ? (idx.get(b.to) ?? -1) : -1);
    definedList.push(1);
  }
  // 'letta:<lettera>' per ogni lettera (Teresa le crea leggendo).
  const letters = beadIds.map((_, i) => i).filter((i) => beadTypes[i] === B_LETTERA);
  for (const li of letters) {
    const id = `letta:${beadIds[li] as string}`;
    if (beadIds.includes(id)) continue;
    beadIds.push(id);
    beadTypes.push(B_SEGRETO);
    beadTo.push(-1);
    definedList.push(0);
  }
  if (!beadIds.includes('nome') && (ctx.nomeOn !== null || ctx.rules.includes('nome'))) {
    beadIds.push('nome');
    beadTypes.push(B_NOME);
    beadTo.push(-1);
    definedList.push(0);
  }
  const B = beadIds.length;
  const beadIdx = new Map<string, number>();
  beadIds.forEach((id, i) => beadIdx.set(id, i));
  const beadType = Uint8Array.from(beadTypes);
  const beadToArr = Int16Array.from(beadTo);
  const letterOrd = new Int16Array(B).fill(-1);
  const lettaOf = new Int16Array(B).fill(-1);
  const lettaLetter = new Int16Array(B).fill(-1);
  let ord = 0;
  for (let i = 0; i < B; i++) {
    if (beadType[i] === B_LETTERA) {
      if (ord > 30) throw new Error(`engine: too many letters in level ${level.id}`);
      letterOrd[i] = ord++;
      const l = beadIdx.get(`letta:${beadIds[i] as string}`);
      if (l !== undefined) {
        lettaOf[i] = l;
        lettaLetter[l] = i;
      }
    }
  }
  const inert = new Uint8Array(B);
  for (let i = 0; i < B; i++) {
    const ty = beadType[i];
    if ((ty === B_VOCE && disabled.has('voce')) || (ty === B_SEGRETO && !secretsOn) || (ty === B_FEBBRE && !feverOn) || (ty === B_NOME && disabled.has('nome'))) {
      inert[i] = 1;
    }
  }

  // Perline tracciate
  const tracked = new Uint8Array(B);
  if (opts.track === 'all') tracked.fill(1);
  else {
    for (const id of opts.track) {
      const i = beadIdx.get(id);
      if (i !== undefined) tracked[i] = 1;
    }
    // Una 'letta:L' tracciata richiede la lettera L.
    for (let i = 0; i < B; i++) if (tracked[i] && (lettaLetter[i] as number) >= 0) tracked[lettaLetter[i] as number] = 1;
  }

  // ───── Disposizione dello stato ─────
  const OFF_KNOT = W;
  const OFF_DELIV = W + 1;
  const OFF_PN = W + 2;
  const OFF_PO = W + 3;
  let off = W + 4;
  const knotRows = Math.max(1, Math.floor(ctx.nodoRighe ?? NODO_RIGHE));
  const OFF_KNOTX = knotRows > 1 ? off : -1;
  off += knotRows - 1;
  const slot = new Int16Array(B).fill(-1);
  const trackedLetters: number[] = [];
  const trackedMulti: number[] = [];
  for (let i = 0; i < B; i++) {
    if (!tracked[i]) continue;
    slot[i] = off++;
    if (beadType[i] === B_LETTERA) trackedLetters.push(i);
    else trackedMulti.push(i);
  }

  // ───── Bordi, marea, spilli ─────
  const edgesAt: (EdgeStep[] | null)[] = new Array<EdgeStep[] | null>(25).fill(null);
  const reentryHours = new Map<number, number[]>();
  for (const s of plan.steps) {
    if (s.hour < 0 || s.hour > 24) continue;
    const col = s.side === 'molo' ? 0 : W - 1;
    const enters = idx.get(s.enters) as number;
    const list = edgesAt[s.hour] ?? [];
    list.push({ col, side: s.side, kind: s.kind, enters, nero: s.nero });
    edgesAt[s.hour] = list;
    const r = reentryHours.get(enters) ?? [];
    r.push(s.hour);
    reentryHours.set(enters, r);
  }
  const tideAt = new Int32Array(25);
  if (!disabled.has('marea')) {
    for (const t of level.tide ?? []) {
      let mask = 0;
      for (const p of t.places) {
        const c = columns.indexOf(p);
        if (c >= 0) mask |= bit(c);
      }
      for (let h = Math.max(0, t.from); h <= Math.min(24, t.to); h++) tideAt[h] = (tideAt[h] as number) | mask;
    }
  }
  const pins: PinStep[] = [];
  const pinsAt: (PinStep[] | null)[] = new Array<PinStep[] | null>(25).fill(null);
  for (const p of level.pins) {
    const t = idx.get(p.thread);
    if (t === undefined || p.hour < 0 || p.hour > 24) continue;
    const ps: PinStep = { thread: t, col: columns.indexOf(p.place), hour: p.hour, def: p };
    pins.push(ps);
    const list = pinsAt[p.hour] ?? [];
    list.push(ps);
    pinsAt[p.hour] = list;
  }

  // ───── Autotessitura e filo nero ─────
  const agents: AgentModel[] = [];
  const agentOf = new Int16Array(T).fill(-1);
  const aw = level.autoweave;
  if (aw) {
    for (const a of aw.agents) {
      const t = idx.get(a.thread);
      if (t === undefined || agentOf[t] !== -1) continue;
      let givesTo = 0;
      for (const g of a.givesTo ?? []) {
        const gi = idx.get(g);
        if (gi !== undefined) givesTo |= bit(gi);
      }
      agentOf[t] = agents.length;
      agents.push({ thread: t, agenda: compileAgenda(a.agenda, idx, columns), likes: [...(a.likes ?? [])], givesTo, nero: kind[t] === K_NERO, slot: 0 });
    }
  }
  let neroThread = -1;
  if (level.nero && !disabled.has('nero')) {
    const t = idx.get(level.nero.thread);
    if (t !== undefined) {
      neroThread = t;
      if (agentOf[t] === -1) {
        agentOf[t] = agents.length;
        agents.push({ thread: t, agenda: compileAgenda(level.nero.agenda, idx, columns), likes: [], givesTo: 0, nero: true, slot: 0 });
      } else {
        const ag = agents[agentOf[t] as number];
        if (ag) ag.nero = true;
      }
    }
  }
  for (const ag of agents) ag.slot = off++;
  const controlled = aw?.controlled !== undefined ? (idx.get(aw.controlled) ?? -1) : -1;
  const occasions: OccasionStep[] = ctx.occasions
    .map((o) => ({ kind: o.kind, col: columns.indexOf(o.place), hour: o.hour }))
    .filter((o) => o.col >= 0)
    .sort((a, b) => a.hour - b.hour || a.col - b.col || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));

  return {
    level,
    ctx,
    W,
    startHour: level.startHour,
    endHour: level.endHour,
    rows: level.endHour - level.startHour,
    columns,
    T,
    ids,
    idx,
    kind,
    chars: charsList,
    namedMask,
    linoMask,
    initial: level.initial.map((id) => idx.get(id) as number),
    qMarta,
    qTeresaSopra,
    qLegge,
    pozzo,
    trabocca,
    qGino,
    qNina,
    qZeno,
    qLunardi,
    faroCol,
    traboccoSoglia: Math.max(1, Math.floor(ctx.traboccoSoglia ?? TRABOCCO_SOGLIA)),
    knotRows,
    rancor,
    B,
    beadIds,
    beadIdx,
    beadType,
    beadTo: beadToArr,
    letterOrd,
    lettaOf,
    lettaLetter,
    inert,
    defined: Uint8Array.from(definedList),
    slot,
    trackedLetters,
    trackedMulti,
    OFF_KNOT,
    OFF_DELIV,
    OFF_PN,
    OFF_PO,
    OFF_KNOTX,
    LEN: off,
    edgesAt,
    tideAt,
    pinsAt,
    pins,
    reentryHours,
    agents,
    agentOf,
    controlled,
    autoFull: !!aw && controlled < 0,
    hasAuto: !!aw,
    neroThread,
    occasions,
    hasEdges: plan.steps.length > 0,
  };
}

// ───────────── Cache dei modelli completi (API pubbliche) ─────────────

const fullCache = new WeakMap<LevelDef, Map<string, Model>>();

function ctxKey(ctx: RunContext): string {
  return JSON.stringify([ctx.quirks, ctx.rancor, ctx.nomeOn, ctx.occasions, ctx.rules, ctx.traboccoSoglia ?? null, ctx.nodoRighe ?? null]);
}

/** Modello con tutte le perline tracciate, condiviso fra le chiamate con lo stesso livello e contesto. */
export function fullModel(level: LevelDef, ctx: RunContext): Model {
  let byCtx = fullCache.get(level);
  if (!byCtx) {
    byCtx = new Map();
    fullCache.set(level, byCtx);
  }
  const k = ctxKey(ctx);
  let m = byCtx.get(k);
  if (!m) {
    m = buildModel(level, ctx, { track: 'all' });
    if (byCtx.size > 32) byCtx.clear();
    byCtx.set(k, m);
  }
  return m;
}
