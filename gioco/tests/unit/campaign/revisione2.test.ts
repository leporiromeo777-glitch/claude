/**
 * Revisione 2 della campagna, logica pura con i contenuti veri:
 * - R2-D2 (Q002, Q053, Q016, Q054): record solo dai merletti con tutte le richieste e gli
 *   obiettivi soddisfatti, confrontati per insieme di richieste; «Primo filo d'oro» una
 *   volta sola nella vita del salvataggio; i passi di Q002 (Rigioca dal Telaio con la
 *   richiesta fallita) e di Q053 (record con richieste diverse);
 * - Q007: lo spillo si sposta in un passo da un bigliettino appuntato a un altro;
 * - Q056: le stranezze sciolte dalla pace;
 * - R2-D5: la Tovaglia (i merletti della partita nell'ordine della storia).
 */
import { describe, expect, it } from 'vitest';
import type { LaceMetrics, NightOutcome, SaveData } from '../../../src/core/types';
import { outcomeCounts, recordNight, requestSetKey, type LaceRecordX } from '../../../src/campaign/progress';
import { beginEvening, camp, completeDay, completeReplay, newCampaign, startNight } from '../../../src/campaign/flow';
import { dayIndexOf, isAnonymous, movePin, pinNote } from '../../../src/campaign/evening';
import { entryDissolved, quirkDissolved } from '../../../src/campaign/diary';
import { hasTovaglia, tovagliaShown, tovagliaTiles } from '../../../src/campaign/tovaglia';
import { db, emptySave, playNight } from './helpers';

const m = (incroci: number, quiete: number, extra: Partial<LaceMetrics> = {}): LaceMetrics => ({ incroci, minIncroci: 3, quiete, simmetria: false, filoDOro: incroci === 3, ...extra });

function eveningAt(d: SaveData, id: string): ReturnType<typeof camp> {
  newCampaign(d, db());
  camp(d).dayIndex = dayIndexOf(db(), id);
  beginEvening(d, db());
  return camp(d);
}

function fail(o: NightOutcome, noteId: string): NightOutcome {
  return { ...o, requests: o.requests.map((r) => (r.noteId === noteId ? { ...r, status: 'fallita' as const } : r)) };
}

describe('R2-D2: record solo con le richieste soddisfatte, per insieme di richieste', () => {
  it('un merletto con una richiesta fallita non è mai «nuovo record» e non tocca il salvataggio (Q002)', () => {
    const d = emptySave();
    const set = ['g02.marta', 'g02.teresa'];
    const first = recordNight(d, 'g02', m(7, 1, { minIncroci: 7, filoDOro: true }), 'A', { ok: true, set });
    expect(first.counted).toBe(true);
    const ko = recordNight(d, 'g02', m(4, 4, { minIncroci: 7 }), 'B', { ok: false, set });
    expect(ko.counted).toBe(false);
    expect(ko.improved).toEqual([]);
    expect(ko.goldThread).toBe(false);
    const rec = d.records['g02'] as LaceRecordX;
    expect(rec.minIncroci).toBe(7);
    expect(rec.maxQuiete).toBe(1);
    expect(rec.bestSpartito).toBe('A');
    expect(rec.sets?.[requestSetKey(set)]).toMatchObject({ minIncroci: 7, maxQuiete: 1, bestSpartito: 'A' });
    // Anche detto «riuscito», un merletto sotto il minimo della notte non conta.
    const below = recordNight(d, 'g02', m(4, 4, { minIncroci: 7 }), 'C', { ok: true, set });
    expect(below.counted).toBe(false);
    expect((d.records['g02'] as LaceRecordX).minIncroci).toBe(7);
    // La notte conta lo stesso fra le notti tessute.
    expect(d.stats.nights).toBe(3);
  });

  it('i record si confrontano solo con le stesse richieste (Q053)', () => {
    const d = emptySave();
    const a = ['g18.teresa'];
    const b = ['g18.gino', 'g18.teresa'];
    recordNight(d, 'g18', m(7, 5, { minIncroci: 7 }), 'A', { ok: true, set: a });
    const firstB = recordNight(d, 'g18', m(12, 2, { minIncroci: 12 }), 'B', { ok: true, set: b });
    // Il record mostrato è quello delle stesse richieste: 12, non 7; il primo non si annuncia.
    expect(firstB.after).toMatchObject({ minIncroci: 12, maxQuiete: 2 });
    expect(firstB.improved).toEqual([]);
    const better = recordNight(d, 'g18', m(12, 3, { minIncroci: 12 }), 'B2', { ok: true, set: [...b].reverse() });
    expect(better.before).toMatchObject({ minIncroci: 12, maxQuiete: 2 });
    expect(better.improved).toEqual(['quiete']);
    expect(requestSetKey([])).toBe('-');
    expect(requestSetKey(['b', 'a', 'a'])).toBe('a+b');
  });

  it('«Primo filo d’oro» una volta sola nella vita del salvataggio (Q016, Q054)', () => {
    const d = emptySave();
    const g02 = recordNight(d, 'g02', m(3, 0), 'x', { ok: true, set: [] });
    expect(g02).toMatchObject({ goldThread: true, firstGold: true });
    expect(g02.improved).not.toContain('filoDOro');
    const g03 = recordNight(d, 'g03', m(3, 0), 'x', { ok: true, set: [] });
    expect(g03).toMatchObject({ goldThread: true, firstGold: false });
    const again = recordNight(d, 'g03', m(3, 0), 'x', { ok: true, set: [] });
    expect(again).toMatchObject({ goldThread: false, firstGold: false });
    // Una storia nuova tiene i record: niente secondo «primo».
    newCampaign(d, db());
    const g04 = recordNight(d, 'g04', m(3, 0), 'x', { ok: true, set: [] });
    expect(g04.firstGold).toBe(false);
  });

  it('outcomeCounts: richieste, obiettivi e spilli lasciati cadere', () => {
    const base = { goals: [{ status: 'soddisfatta' as const }], requests: [{ noteId: 'a', status: 'soddisfatta' as const }], dropped: [] as string[] };
    expect(outcomeCounts(base)).toEqual({ ok: true, set: ['a'] });
    expect(outcomeCounts({ ...base, requests: [{ noteId: 'a', status: 'fallita' }] }).ok).toBe(false);
    expect(outcomeCounts({ ...base, goals: [{ status: 'fallita' }] }).ok).toBe(false);
    expect(outcomeCounts({ ...base, dropped: ['a'] }).ok).toBe(false);
    expect(outcomeCounts(base, { failed: ['a'] }).ok).toBe(false);
  });

  it('la giornata con una richiesta fallita: il bilancio dice che non conta, nessun record (passi di Q002)', () => {
    const d = emptySave();
    const c = eveningAt(d, 'g02');
    const notes = (c.evening?.noteIds ?? []).filter((id) => !!db().notes.get(id)?.request && !isAnonymous(db().notes.get(id)!, c, db()));
    for (const id of notes.slice(0, 2)) expect(pinNote(c, db(), id)).toBeNull();
    startNight(d, db());
    const ok = playNight(d);
    const accepted = camp(d).evening?.accepted.map((a) => a.noteId) ?? [];
    expect(accepted.length).toBeGreaterThan(0);
    const bad = fail({ ...ok, metrics: { ...ok.metrics, incroci: Math.max(0, (ok.metrics.minIncroci ?? 4) - 3), filoDOro: false } }, accepted[0]!);
    const report = completeDay(d, db(), bad);
    expect(report.record.counted).toBe(false);
    expect(report.record.improved).toEqual([]);
    expect(report.goldThread).toBe(false);
    expect(d.records['g02']).toBeUndefined();
  });

  it('Rigioca dal Telaio con la richiesta fallita non abbassa il record (passi di Q002)', () => {
    const d = emptySave();
    const c = eveningAt(d, 'g02');
    const notes = (c.evening?.noteIds ?? []).filter((id) => !!db().notes.get(id)?.request && !isAnonymous(db().notes.get(id)!, c, db()));
    for (const id of notes.slice(0, 2)) pinNote(c, db(), id);
    startNight(d, db());
    const ok = playNight(d);
    completeDay(d, db(), ok);
    const before = JSON.parse(JSON.stringify(d.records['g02'])) as LaceRecordX;
    expect(before.minIncroci).toBe(ok.metrics.incroci);
    const accepted = ok.requests.map((r) => r.noteId);
    const replay = fail({ ...ok, origin: 'telaio', metrics: { ...ok.metrics, incroci: Math.max(0, ok.metrics.incroci - 3), quiete: ok.metrics.quiete + 2 }, spartito: 'FALLITO' }, accepted[0]!);
    const rec = completeReplay(d, replay);
    expect(rec.counted).toBe(false);
    expect(rec.improved).toEqual([]);
    expect(d.records['g02']).toEqual(before);
    // Lo stesso merletto, riuscito e con meno incroci, è un record nuovo.
    const good = { ...ok, origin: 'telaio' as const, metrics: { ...ok.metrics, incroci: ok.metrics.incroci, quiete: ok.metrics.quiete + 1 } };
    expect(completeReplay(d, good).improved).toEqual(['quiete']);
  });
});

describe('Q007: lo spillo si sposta in un passo', () => {
  it('con gli spilli finiti, il bigliettino aperto prende lo spillo dell’altro', () => {
    const d = emptySave();
    const c = eveningAt(d, 'g04');
    const [a, b, third] = c.evening?.noteIds ?? [];
    expect(pinNote(c, db(), a!)).toBeNull();
    expect(pinNote(c, db(), b!)).toBeNull();
    expect(pinNote(c, db(), third!)).toBe('spilli');
    expect(movePin(c, db(), b!, third!)).toBeNull();
    expect(c.evening?.accepted.map((x) => x.noteId)).toEqual([a, third]);
    // Già appuntato: niente da fare.
    expect(movePin(c, db(), a!, third!)).toBeNull();
    expect(c.evening?.accepted.map((x) => x.noteId)).toEqual([a, third]);
  });

  it('un anonimo senza autore scelto non prende lo spillo, e l’altro lo tiene', () => {
    const d = emptySave();
    const c = eveningAt(d, 'g13');
    const ids = (c.evening?.noteIds ?? []).filter((id) => !!db().notes.get(id)?.request);
    const [keep, anonId] = ids;
    expect(keep && anonId).toBeTruthy();
    // L'autore del secondo ha dimenticato Ada: il bigliettino è anonimo.
    c.memoria = { ...c.memoria, [db().notes.get(anonId!)!.author]: 0 };
    expect(isAnonymous(db().notes.get(anonId!)!, c, db())).toBe(true);
    expect(pinNote(c, db(), keep!)).toBeNull();
    expect(movePin(c, db(), keep!, anonId!)).toBe('chi');
    expect(c.evening?.accepted.map((x) => x.noteId)).toContain(keep);
    expect(c.evening?.accepted.map((x) => x.noteId)).not.toContain(anonId);
    expect(movePin(c, db(), keep!, anonId!, 'teresa')).toBeNull();
    expect(c.evening?.accepted.find((x) => x.noteId === anonId)?.authorGuess).toBe('teresa');
    expect(c.evening?.accepted.map((x) => x.noteId)).not.toContain(keep);
  });
});

describe('Q056: stranezze sciolte dalla pace', () => {
  it('con `riconciliate` le stranezze di Teresa e di Marta non valgono più; le altre sì', () => {
    expect(quirkDissolved('martaNoSotto', { riconciliate: true })).toBe(true);
    expect(quirkDissolved('teresaLegge', { riconciliate: true })).toBe(true);
    expect(quirkDissolved('pieroPozzo', { riconciliate: true })).toBe(false);
    expect(quirkDissolved('martaNoSotto', {})).toBe(false);
    expect(quirkDissolved('martaNoSotto', { riconciliate: false })).toBe(false);
  });

  it('le voci del Taccuino che descrivono una stranezza sciolta si riconoscono (verifica R2)', () => {
    const def = (id: string) => db().diary.get(id)!;
    expect(entryDissolved(def('persone.marta.noSotto'), { riconciliate: true }, db())).toBe(true);
    expect(entryDissolved(def('persone.teresa.legge'), { riconciliate: true }, db())).toBe(true);
    expect(entryDissolved(def('persone.marta.noSotto'), {}, db())).toBe(false);
    // Le voci che non parlano di una stranezza sciolta restano come sono.
    const others = [...db().diary.values()].filter((e) => e.section !== 'persone' || !['marta', 'teresa'].includes(e.character ?? ''));
    expect(others.filter((e) => entryDissolved(e, { riconciliate: true }, db()))).toEqual([]);
  });
});

describe('R2-D5: la Tovaglia', () => {
  it('c’è dopo il finale vero; i merletti sono quelli tessuti, nell’ordine della storia', () => {
    const d = emptySave();
    newCampaign(d, db());
    expect(hasTovaglia(d)).toBe(false);
    const c = camp(d);
    c.history['g03'] = { levelId: 'g03', rows: [{ hour: 7, crossings: [] }], requests: [], metrics: m(3, 0), spartito: '', at: '' };
    c.history['g01'] = { levelId: 'g01', rows: [{ hour: 7, crossings: [] }], requests: [], metrics: m(3, 0), spartito: '', at: '' };
    c.history['fin_chiuso'] = { levelId: 'fin_chiuso', rows: [], requests: [], metrics: m(3, 0), spartito: '', at: '' };
    c.history['fin_aperto'] = { levelId: 'fin_aperto', rows: [{ hour: 6, crossings: [] }], requests: [], metrics: m(3, 0), spartito: '', at: '' };
    expect(tovagliaTiles(c, db()).map((t) => t.levelId)).toEqual(['g01', 'g03', 'fin_aperto']);
    d.unlocks.tovaglia = true;
    expect(hasTovaglia(d)).toBe(true);
    d.unlocks.tovaglia = false;
    c.endingsSeen = ['aperto'];
    expect(hasTovaglia(d)).toBe(true);
    // Nel Telaio si mostra con la storia che ha tessuto il finale vero (verifica R2).
    expect(tovagliaShown(d, db())).toBe(true);
    delete c.history['fin_aperto'];
    expect(tovagliaShown(d, db())).toBe(false);
  });
});
