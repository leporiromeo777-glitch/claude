/**
 * Testi e lingue (ARCHITETTURA 10).
 *
 * - File JSON per lingua e namespace: `src/i18n/<locale>/<ns>.json` (interfaccia)
 *   e `src/content/text/<locale>/<ns>.json` (testi narrativi). La chiave completa
 *   è `<ns>.<percorso>`: gli oggetti annidati si appiattiscono con il punto.
 * - Un namespace definito due volte per la stessa lingua è un errore.
 * - Interpolazione `{nome}`; plurali `{n, plural, =0 {…} one {# incrocio} other {# incroci}}`;
 *   scelte `{x, select, a {…} other {…}}`. Il `#` vale il numero del plurale.
 * - Riserva: lingua scelta → italiano → la chiave stessa (in sviluppo con un
 *   avviso in console; i componenti segnano il testo con un bordo rosso).
 * - missing(l): chiavi che esistono in italiano ma non nella lingua l, più le
 *   chiavi chieste a runtime che non esistono in l.
 */
import type { I18n, Locale } from './types';

export interface I18nSource {
  locale: Locale;
  ns: string;
  /** Percorso del file (per i messaggi d'errore). */
  path: string;
  data: unknown;
}

export const FALLBACK_LOCALE: Locale = 'it';
const KNOWN_LOCALES: readonly Locale[] = ['it', 'en'];

/** Appiattisce un oggetto JSON in chiavi puntate. Solo le stringhe sono testi. */
export function flatten(obj: unknown, prefix: string, out: Map<string, string>): void {
  if (typeof obj === 'string') {
    if (prefix) out.set(prefix, obj);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, prefix ? `${prefix}.${i}` : String(i), out));
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

/** Ricava lingua e namespace dal percorso: …/<locale>/<ns>.json */
export function sourceFromPath(path: string, data: unknown): I18nSource | null {
  const m = /\/(it|en)\/([A-Za-z0-9_-]+)\.json$/.exec(path);
  if (!m || !m[1] || !m[2]) return null;
  return { locale: m[1] as Locale, ns: m[2], path, data };
}

export interface Catalogs {
  tables: Record<Locale, Map<string, string>>;
  namespaces: Record<Locale, string[]>;
}

export class DuplicateNamespaceError extends Error {
  constructor(
    readonly locale: Locale,
    readonly ns: string,
    readonly paths: [string, string],
  ) {
    super(`i18n: namespace "${ns}" defined twice for "${locale}": ${paths[0]} and ${paths[1]}`);
    this.name = 'DuplicateNamespaceError';
  }
}

export function buildCatalogs(sources: readonly I18nSource[]): Catalogs {
  const tables: Record<Locale, Map<string, string>> = { it: new Map(), en: new Map() };
  const namespaces: Record<Locale, string[]> = { it: [], en: [] };
  const seen = new Map<string, string>();
  const sorted = [...sources].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const s of sorted) {
    if (!KNOWN_LOCALES.includes(s.locale)) continue;
    const id = `${s.locale}/${s.ns}`;
    const prev = seen.get(id);
    if (prev !== undefined) throw new DuplicateNamespaceError(s.locale, s.ns, [prev, s.path]);
    seen.set(id, s.path);
    namespaces[s.locale].push(s.ns);
    flatten(s.data, s.ns, tables[s.locale]);
  }
  return { tables, namespaces };
}

// ───────── Formattazione: {nome}, plurali, select ─────────

/** Indice della graffa che chiude quella aperta in `start`, o -1. */
function matchBrace(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Sostituisce `#` con il numero, ma non dentro graffe annidate. */
function replaceHash(s: string, n: string): string {
  let out = '';
  let depth = 0;
  for (const c of s) {
    if (c === '{') depth++;
    if (c === '}') depth--;
    out += c === '#' && depth === 0 ? n : c;
  }
  return out;
}

function parseOptions(body: string): Map<string, string> {
  const opts = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i] ?? '')) i++;
    if (i >= body.length) break;
    let sel = '';
    while (i < body.length && body[i] !== '{' && !/\s/.test(body[i] ?? '')) sel += body[i++];
    while (i < body.length && /\s/.test(body[i] ?? '')) i++;
    if (body[i] !== '{') break;
    const end = matchBrace(body, i);
    if (end < 0) break;
    opts.set(sel, body.slice(i + 1, end));
    i = end + 1;
  }
  return opts;
}

const pluralCache = new Map<string, Intl.PluralRules>();
function pluralRules(locale: string): Intl.PluralRules {
  let r = pluralCache.get(locale);
  if (!r) {
    r = new Intl.PluralRules(locale);
    pluralCache.set(locale, r);
  }
  return r;
}

export function formatMessage(template: string, params: Record<string, string | number> | undefined, locale: Locale): string {
  if (template.indexOf('{') < 0) return template;
  let out = '';
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf('{', i);
    if (open < 0) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const close = matchBrace(template, open);
    if (close < 0) {
      out += template.slice(open);
      break;
    }
    const inner = template.slice(open + 1, close);
    const m = /^\s*([A-Za-z0-9_]+)\s*(?:,\s*(plural|select)\s*,([\s\S]*))?$/.exec(inner);
    if (!m || !m[1]) {
      out += template.slice(open, close + 1);
    } else {
      const name = m[1];
      const kind = m[2];
      const value = params?.[name];
      if (!kind) {
        out += value === undefined ? `{${name}}` : String(value);
      } else {
        const opts = parseOptions(m[3] ?? '');
        let chosen: string | undefined;
        if (kind === 'plural') {
          const n = typeof value === 'number' ? value : Number(value);
          if (Number.isFinite(n)) {
            chosen = opts.get(`=${n}`) ?? opts.get(pluralRules(locale).select(n)) ?? opts.get('other');
            if (chosen !== undefined) chosen = replaceHash(chosen, String(n));
          } else {
            chosen = opts.get('other');
          }
        } else {
          chosen = (value !== undefined ? opts.get(String(value)) : undefined) ?? opts.get('other');
        }
        out += chosen === undefined ? '' : formatMessage(chosen, params, locale);
      }
    }
    i = close + 1;
  }
  return out;
}

// ───────── Servizio ─────────

export interface I18nOptions {
  sources: readonly I18nSource[];
  locale: Locale;
  /** In sviluppo: avviso in console per ogni chiave mancante (una volta sola). */
  dev?: boolean;
  onLocaleChange?: (l: Locale) => void;
}

export interface CoreI18n extends I18n {
  /** La chiave esiste proprio nella lingua indicata (senza riserva)? */
  exists(key: string, l: Locale): boolean;
  /** Chiavi note in una lingua (ordinate). */
  keys(l?: Locale): string[];
  namespaces(l?: Locale): string[];
  /** Testo grezzo senza interpolazione (lingua corrente → italiano), o undefined. */
  raw(key: string): string | undefined;
}

export function createI18n(opts: I18nOptions): CoreI18n {
  const { tables, namespaces } = buildCatalogs(opts.sources);
  let current: Locale = KNOWN_LOCALES.includes(opts.locale) ? opts.locale : FALLBACK_LOCALE;
  const requested = new Map<Locale, Set<string>>([
    ['it', new Set()],
    ['en', new Set()],
  ]);
  const warned = new Set<string>();

  function raw(key: string): string | undefined {
    return tables[current].get(key) ?? (current !== FALLBACK_LOCALE ? tables[FALLBACK_LOCALE].get(key) : undefined);
  }

  const i18n: CoreI18n = {
    t(key, params) {
      const own = tables[current].get(key);
      if (own === undefined) requested.get(current)?.add(key);
      const text = own ?? (current !== FALLBACK_LOCALE ? tables[FALLBACK_LOCALE].get(key) : undefined);
      if (text === undefined) {
        if (opts.dev && !warned.has(key)) {
          warned.add(key);
          console.warn(`[i18n] missing key: ${key}`);
        }
        return key;
      }
      return formatMessage(text, params, current);
    },
    // has: c'è un testo da mostrare (nella lingua corrente o nell'italiano di riserva).
    has(key) {
      return raw(key) !== undefined;
    },
    exists(key, l) {
      return tables[l].has(key);
    },
    raw,
    locale: () => current,
    setLocale(l) {
      if (!KNOWN_LOCALES.includes(l) || l === current) return;
      current = l;
      opts.onLocaleChange?.(l);
    },
    missing(l) {
      const loc = l ?? current;
      const table = tables[loc];
      const out = new Set<string>();
      if (loc !== FALLBACK_LOCALE) {
        for (const k of tables[FALLBACK_LOCALE].keys()) if (!table.has(k)) out.add(k);
      }
      for (const k of requested.get(loc) ?? []) if (!table.has(k)) out.add(k);
      return [...out].sort();
    },
    keys(l) {
      return [...tables[l ?? current].keys()].sort();
    },
    namespaces(l) {
      return [...namespaces[l ?? current]];
    },
  };
  return i18n;
}

/** Tutti i file di testo del gioco (glob eager di Vite). */
export function loadI18nSources(): I18nSource[] {
  const files = import.meta.glob(['../i18n/*/*.json', '../content/text/*/*.json'], {
    eager: true,
    import: 'default',
  }) as Record<string, unknown>;
  const out: I18nSource[] = [];
  for (const [path, data] of Object.entries(files)) {
    const s = sourceFromPath(path, data);
    if (s) out.push(s);
  }
  return out;
}
