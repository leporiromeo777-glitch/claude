/**
 * Testi del tombolo: nomi dei fili, dei luoghi e delle perline, parametri dei
 * messaggi del motore tradotti in nomi (keys.ts del motore: `chi`, `sopra`,
 * `sotto`, `a`, `b` sono id di fili, `luogo` un PlaceId, `perlina` un BeadId).
 * Nessuna stringa visibile nel codice: tutto passa da i18n.
 */
import type { CondReport, ContentDB, I18n, LevelDef, PlaceId, ThreadId, Violation } from '../core/types';

export type Params = Record<string, string | number>;

export interface TextDeps {
  i18n: Pick<I18n, 't' | 'has'>;
  content: Pick<ContentDB, 'characters' | 'places'>;
  level: LevelDef;
  /** Nome alternativo di un filo (Archivio: i fili sbiaditi non si nominano). */
  override?: (id: ThreadId) => string | null;
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

/** Etichetta di una perlina (anche 'letta:<lettera>', 'nome', 'febbre'). */
export function beadName(d: TextDeps, id: string): string {
  const def = d.level.beads.find((b) => b.id === id);
  if (def) return d.i18n.t(def.labelKey);
  if (id.startsWith('letta:')) {
    const letter = id.slice(6);
    const l = d.level.beads.find((b) => b.id === letter);
    return d.i18n.t('tombolo.perlina.letta', { lettera: l ? d.i18n.t(l.labelKey) : letter });
  }
  if (id === 'nome') return d.i18n.t('tombolo.perlina.nome');
  if (id === 'febbre') return d.i18n.t('tombolo.perlina.febbre');
  return id;
}

const THREAD_PARAMS = ['chi', 'sopra', 'sotto', 'a', 'b'];

/** Parametri di un messaggio del motore con i nomi al posto degli id. */
export function nameParams(d: TextDeps, params: Params | undefined): Params {
  const out: Params = {};
  if (!params) return out;
  for (const [k, v] of Object.entries(params)) {
    if (THREAD_PARAMS.includes(k) && typeof v === 'string') out[k] = threadName(d, v);
    else if (k === 'luogo' && typeof v === 'string') {
      out[k] = placeName(d, v);
      // «in Chiesa», «al Forno»: la preposizione giusta per ogni luogo.
      out.presso = d.i18n.t(`tombolo.presso.${v}`);
    }
    else if (k === 'perlina' && typeof v === 'string') out[k] = beadName(d, v);
    else out[k] = v;
  }
  return out;
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
  return d.i18n.t(v.messageKey, violationParams(d, v));
}

/** Riga di stato di una condizione (motivo del rischio o del fallimento). */
export function reportText(d: TextDeps, r: CondReport): string {
  if (r.reasonKey) return d.i18n.t(r.reasonKey, nameParams(d, r.params));
  return d.i18n.t(`tombolo.stato.${r.status}`);
}
