/**
 * Generatore: gradi che contano (revisione 1, MOT-05). Per ogni combinazione
 * dei sei gradi si provano 200 semi candidati: ogni livello accettato dal
 * filtro di qualità rispetta la condizione dei suoi gradi (verificata qui con
 * le API pubbliche del motore), e ogni candidato scartato perché un grado non
 * conta ha davvero un grado che non conta. Il seme `pm0ozmz` (piccolo) con
 * Spilli velati e Un nodo in più dà un livello in cui pesano tutti e due.
 */
import { describe, expect, it } from 'vitest';
import type { GradoId, LevelDef, RuleId } from '../../../src/core/types';
import { createContext, simulate, simulateAndEvaluate } from '../../../src/engine/index';
import type { GenSpec } from '../../../src/engine/index';
import { GEN_MAX_STATES, buildCandidate, effectiveRows, generate, minRange, qualityCheck } from '../../../src/engine/generator';
import type { GeneratedCandidate } from '../../../src/engine/generator';
import { solveInternal } from '../../../src/engine/solver';

const GRADI: GradoId[] = ['matassaEsatta', 'senzaDisfa', 'spilliVelati', 'nodoInPiu', 'neroInPiu', 'notteCorta'];
const RULES: RuleId[] = ['voce', 'segreto', 'molo', 'febbre', 'rancore', 'marea', 'nero'];
const SEEDS = 200;

/**
 * Il livello senza quello che il grado ha aggiunto: lo stesso candidato costruito senza quel grado
 * (i gradi si applicano per ultimi e il nodo in più non consuma numeri casuali, quindi il resto è
 * identico). null se il grado non ha aggiunto niente.
 */
function strip(spec: GenSpec, seedK: string, level: LevelDef, g: 'nodoInPiu' | 'neroInPiu'): LevelDef | null {
  const lv0 = buildCandidate({ ...spec, gradi: spec.gradi.filter((x) => x !== g) }, seedK).level;
  const same = JSON.stringify(lv0.rancor ?? []) === JSON.stringify(level.rancor ?? []) && JSON.stringify(lv0.nero ?? null) === JSON.stringify(level.nero ?? null);
  return same ? null : lv0;
}

/** Condizione del grado (MOT-05), verificata da fuori. null = non si sa (limite di stati). */
function holds(spec: GenSpec, seedK: string, c: GeneratedCandidate, g: GradoId, min: number): boolean | null {
  const { level, goals } = c;
  const hi = minRange(spec.columns, effectiveRows(spec))[1];
  if (g === 'spilliVelati') return level.pins.some((p) => p.hour >= level.startHour + 3);
  if (g !== 'nodoInPiu' && g !== 'neroInPiu') return true;
  const lv0 = strip(spec, seedK, level, g);
  if (!lv0) return false;
  const ctx0 = createContext(lv0, {});
  const r = solveInternal({ level: lv0, ctx: ctx0, goals, matassa: hi, maxStates: GEN_MAX_STATES });
  if (r.status === 'limite') return null;
  if (r.status !== 'ok' || !r.rows || r.incroci === undefined) return true;
  if (min > r.incroci) return true;
  if (g === 'nodoInPiu') {
    const before = new Set((lv0.rancor ?? []).map((p) => p.join('|')));
    const pair = (level.rancor ?? []).find((p) => !before.has(p.join('|'))) as [string, string];
    const last = simulate({ ...lv0, matassa: hi }, ctx0, r.rows).timeline.at(-1);
    return !!last && last.met.includes([...pair].sort().join('|'));
  }
  return !simulateAndEvaluate({ ...level, matassa: hi }, createContext(level, {}), r.rows, goals).allOk;
}

describe('gradi che contano (MOT-05)', () => {
  it(`ogni combinazione di gradi, ${SEEDS} semi: gli accettati rispettano i loro gradi, gli scartati per un grado no`, () => {
    const accepted: Partial<Record<GradoId, number>> = {};
    let rejectedForGrade = 0;
    for (let mask = 1; mask < 1 << GRADI.length; mask++) {
      const gradi = GRADI.filter((_, i) => mask & (1 << i));
      for (let k = 0; k < SEEDS; k++) {
        const spec: GenSpec = { seed: `gradi-${mask}`, columns: 5, rows: 7, rule: RULES[(k + mask) % RULES.length] as RuleId, gradi, difficulty: 'medio' };
        const seedK = `${spec.seed}#${k}`;
        const cand = buildCandidate(spec, seedK);
        const v = qualityCheck(spec, cand);
        const where = `${gradi.join('+')} ${spec.rule} #${k}`;
        if (v.ok) {
          for (const g of gradi) {
            expect(holds(spec, seedK, cand, g, v.min), `${where}: ${g}`).toBe(true);
            accepted[g] = (accepted[g] ?? 0) + 1;
          }
        } else if (v.stage === 5) {
          rejectedForGrade++;
          const verdicts = gradi.map((g) => holds(spec, seedK, cand, g, v.min));
          expect(verdicts.some((x) => x !== true), where).toBe(true);
        }
      }
    }
    // Il controllo non è vuoto: ci sono livelli accettati per ogni grado e scarti dovuti ai gradi.
    for (const g of GRADI) expect(accepted[g] ?? 0, g).toBeGreaterThan(0);
    expect(rejectedForGrade).toBeGreaterThan(0);
  }, 300_000);

  it('pm0ozmz piccolo con Spilli velati e Un nodo in più: pesano tutti e due', () => {
    // liberoSpec('pm0ozmz', …) di src/screens/libero.ts: piccolo 4×6, regola del seme (molo).
    const spec: GenSpec = { seed: 'pm0ozmz', columns: 4, rows: 6, rule: 'molo', gradi: ['spilliVelati', 'nodoInPiu'], difficulty: 'piccolo' };
    const r = generate(spec);
    expect(r.fromFallback).toBe(false);
    const level = r.level;
    // Uno spillo d'ottone dopo le prime tre ore: il velo nasconde qualcosa.
    expect(level.pins.some((p) => p.hour >= level.startHour + 3)).toBe(true);
    // La coppia in rancore conta: senza il nodo la soluzione ottima la fa incrociare, o il minimo cala.
    const cand = buildCandidate(spec, r.seedUsed);
    expect(holds(spec, r.seedUsed, cand, 'nodoInPiu', r.min)).toBe(true);
    expect(holds(spec, r.seedUsed, cand, 'spilliVelati', r.min)).toBe(true);
    // Con gli stessi gradi il seme #0 (quello del playtest) non passa più.
    expect(r.seedUsed).not.toBe('pm0ozmz#0');
  }, 60_000);

  it('ripiego del Merletto libero (nessun seme passa): i gradi pesano anche nel livello consegnato', () => {
    // Verifica della revisione 1: pbo3129 piccolo (regola nero) con Spilli velati e Un nodo in più
    // non ha semi che passano il filtro. Prima il ripiego era il candidato arrivato più avanti
    // (pbo3129#192), in cui il nodo in più non cambiava niente: i punti del grado senza difficoltà
    // di P044. Ora è il più avanti fra quelli in cui pesano tutti e due.
    const spec: GenSpec = { seed: 'pbo3129', columns: 4, rows: 6, rule: 'nero', gradi: ['spilliVelati', 'nodoInPiu'], difficulty: 'piccolo' };
    const r = generate(spec);
    expect(r.fromFallback).toBe(true);
    expect(r.seedUsed).not.toBe('pbo3129#192');
    const cand = buildCandidate(spec, r.seedUsed);
    for (const g of spec.gradi) expect(holds(spec, r.seedUsed, cand, g, r.min), g).toBe(true);
    const [lo, hi] = minRange(spec.columns, effectiveRows(spec));
    expect(r.min).toBeGreaterThanOrEqual(lo);
    expect(r.min).toBeLessThanOrEqual(hi);
    expect(r.level.matassa).toBe(r.min + 1);
    expect(generate(spec)).toEqual(r);
  }, 60_000);

  it('Un nodo in più con la regola del rancore su 4 colonne: c\'è una coppia libera e il grado pesa', () => {
    // Verifica della revisione 1: con tre fili con un nome e il rancore della regola su due di
    // loro, il nodo in più non trovava una coppia e ogni seme ripiegava su un livello senza nodo
    // in più (p2dr662#14). Senza il lino i fili con un nome sono quattro.
    const spec: GenSpec = { seed: 'p2dr662', columns: 4, rows: 6, rule: 'rancore', gradi: ['nodoInPiu'], difficulty: 'piccolo' };
    const r = generate(spec);
    expect(r.fromFallback).toBe(false);
    expect(r.level.rancor?.length).toBe(2);
    expect(r.level.threads.some((t) => t.kind === 'lino')).toBe(false);
    expect(r.level.initial.length).toBe(4);
    expect(holds(spec, r.seedUsed, buildCandidate(spec, r.seedUsed), 'nodoInPiu', r.min)).toBe(true);
    // Senza il grado (o con un'altra regola) il cast resta con il lino.
    expect(buildCandidate({ ...spec, gradi: [] }, 'p2dr662#0').level.threads.some((t) => t.kind === 'lino')).toBe(true);
  }, 60_000);
});
