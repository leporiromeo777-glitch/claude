/**
 * Testi del tombolo: nomi dei fili, dei luoghi e delle perline, parametri dei
 * messaggi del motore tradotti in nomi (keys.ts del motore: `chi`, `sopra`,
 * `sotto`, `a`, `b`, `vicino`, `nero` sono id di fili, `luogo` un PlaceId,
 * `perlina` un BeadId; `ora`, `da`, `dalle`, `alle`, `fine` sono ore).
 * Nessuna stringa visibile nel codice: tutto passa da i18n.
 *
 * Revisione 1 (C13, C16, D08):
 * - le etichette delle perline sono sintagmi nominali minuscoli con l'articolo;
 *   le lettere generate nominano il destinatario («la lettera per Zeno»), e se
 *   ce n'è più d'una per la stessa persona sono numerate;
 * - le condizioni su una perlina usano un modello per tipo di perlina (riceve /
 *   sente / conosce / ricorda il nome di Ada / ha la febbre);
 * - `incontra`, `nonIncontra` e `sopra` dicono la finestra oraria;
 * - `almeno(n, …)` con parti dello stesso tipo si compatta;
 * - le ore si scrivono con `tombolo.ora.fmt` («8 pm» in inglese);
 * - la maiuscola a inizio frase la mette `capitalizeFirst`.
 */
import type { BeadType, Condition, CondReport, ContentDB, I18n, LevelDef, PlaceId, ThreadId, Violation } from '../core/types';

export type Params = Record<string, string | number>;

export interface TextDeps {
  i18n: Pick<I18n, 't' | 'has'> & Partial<Pick<I18n, 'locale'>>;
  content: Pick<ContentDB, 'characters' | 'places'>;
  level: LevelDef;
  /** Nome alternativo di un filo (Archivio: i fili sbiaditi non si nominano). */
  override?: (id: ThreadId) => string | null;
}

/** Etichetta delle lettere generate dal motore (generator.ts, GEN_KEYS.lettera). */
export const GEN_LETTER_KEY = 'tombolo.generato.lettera';

/** Maiuscola alla prima lettera (dopo eventuali virgolette o punteggiatura iniziale). */
export function capitalizeFirst(s: string, locale = 'it'): string {
  const m = /^([^\p{L}\p{N}]*)(\p{L})/u.exec(s);
  if (!m || m[2] === undefined) return s;
  const pre = m[1] ?? '';
  return pre + m[2].toLocaleUpperCase(locale) + s.slice(pre.length + m[2].length);
}

function loc(d: TextDeps): string {
  try {
    return d.i18n.locale?.() ?? 'it';
  } catch {
    return 'it';
  }
}

/** Un'ora del merletto nella lingua corrente («9»; in inglese «9 am», «noon»). */
export function formatHour(d: Pick<TextDeps, 'i18n'>, h: number): string {
  const hh = ((Math.round(h) % 24) + 24) % 24;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return d.i18n.t('tombolo.ora.fmt', { h: Math.round(h), h12, ampm: hh < 12 ? 'am' : 'pm' });
}

/** Nome di un filo: personaggio, lino con etichetta, lino anonimo. */
export function threadName(d: TextDeps, id: ThreadId): string {
  if (id === '*') return d.i18n.t('tombolo.filo.chiunque');
  const o = d.override?.(id);
  if (o) return o;
  const def = d.level.threads.find((t) => t.id === id);
  const ch = def?.character ?? (d.content.characters.has(id as never) ? (id as never) : undefined);
  if (ch) {
    const c = d.content.characters.get(ch);
    if (c) return d.i18n.t(c.nameKey);
  }
  if (def?.labelKey) return d.i18n.t(def.labelKey);
  if (def?.kind === 'avorio') return d.i18n.t('tombolo.filo.avorio');
  if (def?.kind === 'nero') return d.i18n.t('tombolo.filo.nero');
  return d.i18n.t('tombolo.filo.lino');
}

export function placeName(d: TextDeps, p: PlaceId | string): string {
  const pl = d.content.places.get(p as PlaceId);
  return pl ? d.i18n.t(pl.nameKey) : d.i18n.t(`tombolo.luogo.${p}`);
}

export function placeShort(d: TextDeps, p: PlaceId): string {
  const pl = d.content.places.get(p);
  return pl ? d.i18n.t(pl.shortKey) : d.i18n.t(`tombolo.luogo.${p}`);
}

/** Tipo di una perlina (anche 'letta:<lettera>' = segreto, 'nome', 'febbre'). */
export function beadTypeOf(level: LevelDef, id: string): BeadType {
  const def = level.beads.find((b) => b.id === id);
  if (def) return def.type;
  if (id.startsWith('letta:')) return 'segreto';
  if (id === 'nome') return 'nome';
  if (id === 'febbre') return 'febbre';
  return 'voce';
}

/** Filo destinatario di una lettera (`to` può essere l'id del filo o il personaggio). */
function letterTarget(level: LevelDef, to: string): ThreadId {
  const t = level.threads.find((x) => x.id === to) ?? level.threads.find((x) => x.character === to);
  return t ? t.id : to;
}

/** Etichetta di una perlina (anche 'letta:<lettera>', 'nome', 'febbre'). */
export function beadName(d: TextDeps, id: string): string {
  const def = d.level.beads.find((b) => b.id === id);
  if (def) {
    // Lettere generate: «la lettera per Zeno», numerate se più d'una per la stessa persona (C16).
    if (def.type === 'lettera' && def.labelKey === GEN_LETTER_KEY && def.to) {
      const target = letterTarget(d.level, def.to);
      const same = d.level.beads.filter((b) => b.type === 'lettera' && b.labelKey === GEN_LETTER_KEY && b.to && letterTarget(d.level, b.to) === target);
      const to = threadName(d, target);
      if (same.length > 1) return d.i18n.t('tombolo.generato.letteraPerN', { to, n: same.indexOf(def) + 1 });
      return d.i18n.t('tombolo.generato.letteraPer', { to });
    }
    return d.i18n.t(def.labelKey);
  }
  if (id.startsWith('letta:')) {
    const lettera = beadName(d, id.slice(6));
    return d.i18n.t('tombolo.perlina.letta', { lettera, della: articolata('di', lettera) });
  }
  if (id === 'nome') return d.i18n.t('tombolo.perlina.nome');
  if (id === 'febbre') return d.i18n.t('tombolo.perlina.febbre');
  return id;
}

/**
 * Preposizione articolata italiana davanti a un sintagma con l'articolo
 * («la lettera» → «della lettera», «il nome» → «del nome», «l'eco» → «dell'eco»).
 * Senza articolo riconosciuto: «di …».
 */
export function articolata(prep: 'di', s: string): string {
  const m = /^(il|lo|la|i|gli|le)\s+(.*)$/i.exec(s) ?? /^(l['’])(.*)$/i.exec(s);
  if (!m) return `${prep} ${s}`;
  const art = (m[1] ?? '').toLowerCase().replace('’', "'");
  const rest = m[2] ?? '';
  const map: Record<string, string> = { il: 'del ', lo: 'dello ', la: 'della ', i: 'dei ', gli: 'degli ', le: 'delle ', "l'": "dell'" };
  return `${map[art] ?? `${prep} `}${rest}`;
}

const THREAD_PARAMS = ['chi', 'sopra', 'sotto', 'a', 'b', 'vicino', 'nero', 'sopra2', 'sotto2', 'sopra3', 'sotto3'];
const HOUR_PARAMS = ['ora', 'da', 'a', 'dalle', 'alle', 'fine'];

/** Parametri di un messaggio del motore con i nomi al posto degli id e le ore nella lingua corrente. */
export function nameParams(d: TextDeps, params: Params | undefined): Params {
  const out: Params = {};
  if (!params) return out;
  for (const [k, v] of Object.entries(params)) {
    if (THREAD_PARAMS.includes(k) && typeof v === 'string') out[k] = threadName(d, v);
    else if (HOUR_PARAMS.includes(k) && typeof v === 'number') out[k] = formatHour(d, v);
    else if (k === 'luogo' && typeof v === 'string') {
      out[k] = placeName(d, v);
      // «in Chiesa», «al Forno»: la preposizione giusta per ogni luogo.
      out.presso = d.i18n.t(`tombolo.presso.${v}`);
    } else if (k === 'perlina' && typeof v === 'string') out[k] = beadName(d, v);
    else out[k] = v;
  }
  return out;
}

/**
 * Chiave del messaggio di una violazione (C13): il nodo e la marea hanno il loro
 * testo (`bloccato.nodo`, `bloccato.marea`), un filo nero o autonomo il suo
 * (`occupato.nero`); Gino senza un vicino da nominare usa `correSolo`.
 */
export function violationMessageKey(d: Pick<TextDeps, 'i18n'>, v: Violation): string {
  const p = v.params ?? {};
  const key = v.messageKey;
  if (v.code === 'bloccato' && typeof p.causa === 'string' && key === 'tombolo.violazione.bloccato') {
    const k = `${key}.${p.causa}`;
    if (d.i18n.has(k)) return k;
  }
  if (v.code === 'occupato' && typeof p.nero === 'string' && key === 'tombolo.violazione.occupato' && d.i18n.has(`${key}.nero`)) return `${key}.nero`;
  if (v.code === 'corre' && key === 'tombolo.violazione.corre' && (p.vicino === undefined || p.vicino === '')) return 'tombolo.violazione.correSolo';
  return key;
}

/** Parametri di una violazione: quelli del motore, più quelli ricavati dai fili coinvolti. */
export function violationParams(d: TextDeps, v: Violation): Params {
  const raw: Params = { ...(v.params ?? {}) };
  const th = v.threads ?? [];
  if (v.code === 'rifiuto') {
    if (th[0] && raw.sopra === undefined) raw.sopra = th[0];
    if (th[1] && raw.sotto === undefined) raw.sotto = th[1];
  } else if (v.code === 'occupato' || v.code === 'forzato') {
    if (th[0] && raw.a === undefined) raw.a = th[0];
    if (th[1] && raw.b === undefined) raw.b = th[1];
  }
  if (th[0] && raw.chi === undefined) raw.chi = th[0];
  if (v.pin) {
    if (raw.chi === undefined) raw.chi = v.pin.thread;
    if (raw.luogo === undefined) raw.luogo = v.pin.place;
    if (raw.ora === undefined) raw.ora = v.pin.hour;
  }
  return nameParams(d, raw);
}

export function violationText(d: TextDeps, v: Violation): string {
  return capitalizeFirst(d.i18n.t(violationMessageKey(d, v), violationParams(d, v)), loc(d));
}

/** Finestra oraria di una condizione `incontra`, `nonIncontra` o `sopra`, se c'è. */
export function windowOf(level: LevelDef, c: Condition): { dalle: number; alle: number } | null {
  if (c.t === 'incontra' || c.t === 'nonIncontra') {
    if (c.from === undefined && c.to === undefined) return null;
    return { dalle: c.from ?? level.startHour + 1, alle: c.to ?? level.endHour };
  }
  if (c.t === 'sopra' && c.to !== undefined) return { dalle: level.startHour + 1, alle: c.to };
  return null;
}

/**
 * Chiave del motivo di un rapporto, con le varianti per tipo di perlina (`ha`,
 * `nonHa`) e per la finestra oraria (`incontra`, `nonIncontra`, `sopra`).
 */
export function reportKey(d: TextDeps, r: CondReport, cond?: Condition): string | null {
  const key = r.reasonKey;
  if (!key) return null;
  const p = r.params ?? {};
  const m = /^tombolo\.cond\.(fallita|rischio|perso)\.(ha|nonHa|incontra|nonIncontra|sopra)$/.exec(key);
  if (!m) return key;
  const t = m[2];
  if ((t === 'ha' || t === 'nonHa') && typeof p.perlina === 'string') {
    const k = `${key}.${beadTypeOf(d.level, p.perlina)}`;
    return d.i18n.has(k) ? k : key;
  }
  const hasWindow = p.alle !== undefined || (cond !== undefined && windowOf(d.level, findLeaf(cond, r) ?? cond) !== null);
  if (hasWindow) {
    const k = t === 'sopra' ? `${key}Entro` : `${key}Finestra`;
    return d.i18n.has(k) ? k : key;
  }
  return key;
}

/** Parametri di un rapporto: quelli del motore più la finestra della condizione (se il motore non la dà). */
export function reportParams(d: TextDeps, r: CondReport, cond?: Condition): Params {
  const raw: Params = { ...(r.params ?? {}) };
  if (cond && raw.alle === undefined) {
    const w = windowOf(d.level, findLeaf(cond, r) ?? cond);
    if (w) {
      raw.dalle = w.dalle;
      raw.alle = w.alle;
    }
  }
  return nameParams(d, raw);
}

/** La foglia di una condizione a cui si riferisce il rapporto (stessi fili), se si trova. */
function findLeaf(c: Condition, r: CondReport): Condition | null {
  const p = r.params ?? {};
  const walk = (x: Condition): Condition | null => {
    if (x.t === 'tutti' || x.t === 'almeno') {
      for (const y of x.of) {
        const f = walk(y);
        if (f) return f;
      }
      return null;
    }
    if (x.t === 'non') return walk(x.c);
    if ((x.t === 'incontra' || x.t === 'nonIncontra' || x.t === 'sopra') && x.a === p.a && x.b === p.b) return x;
    return null;
  };
  return walk(c);
}

/** Riga di stato di una condizione (motivo del rischio o del fallimento). */
export function reportText(d: TextDeps, r: CondReport, cond?: Condition): string {
  const key = reportKey(d, r, cond);
  if (key) return capitalizeFirst(d.i18n.t(key, reportParams(d, r, cond)), loc(d));
  return d.i18n.t(`tombolo.stato.${r.status}`);
}

/** Azione al plurale per `almeno` compattato («ricevono la lettera per Zeno», «incontrano Gino»). */
function sameAction(d: TextDeps, parts: readonly Condition[], end: number): { who: ThreadId[]; azione: string } | null {
  const first = parts[0];
  if (!first || parts.length < 2) return null;
  const t = (k: string, p: Params): string => d.i18n.t(`tombolo.obiettivo.azione.${k}`, nameParams(d, p));
  if (first.t === 'ha') {
    if (!parts.every((x) => x.t === 'ha' && x.bead === first.bead && (x.by ?? end) === (first.by ?? end))) return null;
    const who = parts.map((x) => (x as Extract<Condition, { t: 'ha' }>).who);
    return { who, azione: t(`ha.${beadTypeOf(d.level, first.bead)}`, { perlina: first.bead, ora: first.by ?? end }) };
  }
  if (first.t === 'incontra') {
    if (!parts.every((x) => x.t === 'incontra' && x.b === first.b && x.from === first.from && x.to === first.to)) return null;
    const w = windowOf(d.level, first);
    const who = parts.map((x) => (x as Extract<Condition, { t: 'incontra' }>).a);
    return { who, azione: w ? t('incontraFinestra', { b: first.b, dalle: w.dalle, alle: w.alle }) : t('incontra', { b: first.b }) };
  }
  if (first.t === 'presso') {
    if (!parts.every((x) => x.t === 'presso' && x.place === first.place && x.hour === first.hour)) return null;
    const who = parts.map((x) => (x as Extract<Condition, { t: 'presso' }>).who);
    return { who, azione: t('presso', { luogo: first.place, ora: first.hour }) };
  }
  if (first.t === 'sano') {
    if (!parts.every((x) => x.t === 'sano')) return null;
    return { who: parts.map((x) => (x as Extract<Condition, { t: 'sano' }>).who), azione: t('sano', {}) };
  }
  return null;
}

/** «Teresa, Gino e Bepi» nella lingua corrente. */
export function joinNames(d: Pick<TextDeps, 'i18n'>, items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(d.i18n.t('tombolo.elenco.separatore'))}${d.i18n.t('tombolo.elenco.ultimo')}${items[items.length - 1]}`;
}

/** Descrizione di una condizione senza maiuscola (si compone dentro altre frasi). */
function describe(d: TextDeps, c: Condition): string {
  const t = (k: string, p: Params): string => d.i18n.t(`tombolo.obiettivo.${k}`, nameParams(d, p));
  const end = d.level.endHour;
  switch (c.t) {
    case 'presso':
      return t('presso', { chi: c.who, luogo: c.place, ora: c.hour });
    case 'maiPresso':
      return t('maiPresso', { chi: c.who, luogo: c.place, da: c.from, a: c.to });
    case 'incontra': {
      const w = windowOf(d.level, c);
      return w ? t('incontraFinestra', { a: c.a, b: c.b, dalle: w.dalle, alle: w.alle }) : t('incontra', { a: c.a, b: c.b });
    }
    case 'nonIncontra': {
      const w = windowOf(d.level, c);
      return w ? t('nonIncontraFinestra', { a: c.a, b: c.b, dalle: w.dalle, alle: w.alle }) : t('nonIncontra', { a: c.a, b: c.b });
    }
    case 'sopra':
      return c.to !== undefined ? t('sopraEntro', { a: c.a, b: c.b, alle: c.to }) : t('sopra', { a: c.a, b: c.b });
    case 'consegnata':
      return t('consegnata', { perlina: c.bead, ora: c.by ?? end });
    case 'ha':
      return t(`ha.${beadTypeOf(d.level, c.bead)}`, { chi: c.who, perlina: c.bead, ora: c.by ?? end });
    case 'nonHa':
      return t(`nonHa.${beadTypeOf(d.level, c.bead)}`, { chi: c.who, perlina: c.bead });
    case 'parte':
      return c.hour === undefined ? t('parte', { chi: c.who }) : t('parteOra', { chi: c.who, ora: c.hour });
    case 'resta':
      return t('resta', { chi: c.who });
    case 'esceCon':
      return t('esceCon', { perlina: c.bead, ora: c.hour });
    case 'sano':
      return t('sano', { chi: c.who });
    case 'incontriAlmeno':
      return t('incontriAlmeno', { chi: c.who, n: c.n });
    case 'tutti':
    case 'almeno': {
      if (c.t === 'almeno') {
        const same = sameAction(d, c.of, end);
        if (same) return d.i18n.t('tombolo.obiettivo.almenoStesso', { n: c.n, elenco: joinNames(d, same.who.map((w) => threadName(d, w))), azione: same.azione });
      }
      const parti = c.of.map((x) => describe(d, x)).join(d.i18n.t('tombolo.obiettivo.separatore'));
      return c.t === 'tutti' ? d.i18n.t('tombolo.obiettivo.tutti', { parti }) : d.i18n.t('tombolo.obiettivo.almeno', { n: c.n, parti });
    }
    case 'non':
      return d.i18n.t('tombolo.obiettivo.non', { parti: describe(d, c.c) });
  }
}

/** Descrizione leggibile di una condizione (obiettivi e richieste), con la maiuscola. */
export function describeCondition(d: TextDeps, c: Condition): string {
  return capitalizeFirst(describe(d, c), loc(d));
}
