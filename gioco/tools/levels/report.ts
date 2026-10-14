/**
 * Tabella riassuntiva di `npm run levels:check -- --report` (in inglese, come
 * tutti i messaggi per chi scrive i dati).
 */

export interface LevelReportRow {
  id: string;
  base: number | null;
  /** `nomeOn`: filo del nome di Ada che dà il minimo (solo se le condizioni nominano `nome`). */
  notes: { id: string; incroci: number | null; voluta: boolean; nomeOn?: string }[];
  combos: { notes: string[]; incroci: number | null; voluta: boolean; nomeOn?: string }[];
  matassa: number;
  suggerita: number | null;
  quieteMax: number | null;
  occasions: number | null;
  states: number;
  maxStates: number;
  ms: number;
  errors: number;
  warnings: number;
}

function cell(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : String(v);
}

function at(nomeOn: string | undefined): string {
  return nomeOn ? `@${nomeOn}` : '';
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function short(id: string, level: string): string {
  return id.startsWith(`${level}.`) ? id.slice(level.length + 1) : id;
}

export function formatReport(rows: LevelReportRow[]): string {
  const head = ['level', 'base', 'notes', 'combos', 'matassa', 'suggested', 'quiet', 'occasions', 'states', 'max states', 'ms', 'result'];
  const body = rows.map((r) => [
    r.id,
    cell(r.base),
    r.notes.map((n) => `${short(n.id, r.id)}=${cell(n.incroci)}${at(n.nomeOn)}${n.voluta ? '*' : ''}`).join(' ') || '—',
    r.combos.map((c) => `${c.notes.map((n) => short(n, r.id)).join('+')}=${cell(c.incroci)}${at(c.nomeOn)}${c.voluta ? '*' : ''}`).join(' ') || '—',
    String(r.matassa),
    cell(r.suggerita),
    cell(r.quieteMax),
    cell(r.occasions),
    String(r.states),
    String(r.maxStates),
    String(Math.round(r.ms)),
    r.errors > 0 ? `ERRORS ${r.errors}` : r.warnings > 0 ? `ok (${r.warnings} warnings)` : 'ok',
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => (b[i] ?? '').length)));
  const line = (cols: string[]): string => cols.map((c, i) => pad(c, widths[i] ?? 0)).join(' │ ');
  const sep = widths.map((w) => '─'.repeat(w)).join('─┼─');
  return [line(head), sep, ...body.map(line), '', '* = impossible by design (voluta); @thread = where Ada pins her name to reach that minimum'].join('\n');
}
