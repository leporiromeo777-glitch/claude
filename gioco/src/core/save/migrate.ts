/**
 * Migrazioni dei salvataggi (ARCHITETTURA 9).
 *
 * `migrations[n]` trasforma un salvataggio con schema n nello schema n+1. Si
 * applicano in ordine fino allo schema corrente. Un salvataggio senza campo
 * `schema` vale 0 (formato dei prototipi). Ogni migrazione ha il suo test.
 */
export const CURRENT_SCHEMA = 1;

export type Migration = (old: unknown) => unknown;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export const migrations: Record<number, Migration> = {
  /**
   * 0 → 1: i prototipi salvavano `{ settings, campaign, … }` senza schema né app.
   * Si conservano le parti riconoscibili; quelle mancanti le completa normalizeSave.
   */
  0: (old) => {
    const o = isObj(old) ? old : {};
    const { version: _version, ...rest } = o;
    return { ...rest, schema: 1, app: 'trama' };
  },
};

export function schemaOf(data: unknown): number {
  if (!isObj(data)) return -1;
  const s = data.schema;
  if (s === undefined) return 0;
  return typeof s === 'number' && Number.isInteger(s) && s >= 0 ? s : -1;
}

export type MigrateResult =
  | { ok: true; data: unknown; from: number }
  | { ok: false; error: 'nonValido' | 'futuro' | 'mancante'; from: number };

export function migrate(
  data: unknown,
  table: Record<number, Migration> = migrations,
  target: number = CURRENT_SCHEMA,
): MigrateResult {
  const from = schemaOf(data);
  if (from < 0) return { ok: false, error: 'nonValido', from };
  if (from > target) return { ok: false, error: 'futuro', from };
  let cur = data;
  for (let v = from; v < target; v++) {
    const m = table[v];
    if (!m) return { ok: false, error: 'mancante', from };
    cur = m(cur);
    if (schemaOf(cur) !== v + 1) return { ok: false, error: 'nonValido', from };
  }
  return { ok: true, data: cur, from };
}
