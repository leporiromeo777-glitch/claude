/**
 * Il flusso della campagna con i contenuti veri (le notti si giocano con le soluzioni
 * precalcolate): Nuova storia → g00 → alba → bilancio → sera di g01 (oggetto, 3
 * bigliettini, 2 spilli) → notte di g01; tutta la campagna fino alla scelta di g23;
 * i quattro finali; Riprendi da qui; requisiti del finale vero.
 */
import { describe, expect, it } from 'vitest';
import type { SaveData } from '../../../src/core/types';
import { CAST_IDS } from '../../../src/core/ids';
import {
  beginChoice,
  camp,
  choose,
  completeDay,
  completeFinal,
  finishBilancio,
  finishDawn,
  finishArchivePhase,
  newCampaign,
  rewindTo,
  startNight,
  archiveParams,
  completeArchive,
  replayRipassaParams,
  ripassaAvailable,
  ripassaParams,
} from '../../../src/campaign/flow';
import { eveningItems, pinNote, pinsLeft, replyNote, leaveNote, undecided, eveningNotes } from '../../../src/campaign/evening';
import { endingRequirements, choiceCards } from '../../../src/campaign/endings';
import { simulateNight, precomputedRows } from '../../../src/campaign/simulate';
import { db, emptySave, playNight } from './helpers';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Chiude la giornata in corso senza bigliettini e passa alla sera dopo (o alla scelta). */
function playDay(d: SaveData): string {
  const c = camp(d);
  if (c.phase === 'sera') startNight(d, db());
  completeDay(d, db(), playNight(d));
  finishDawn(d);
  const next = finishBilancio(d, db());
  if (next === 'archivio') return finishArchivePhase(d, db());
  return next;
}

describe('dal prologo alla notte di g01', () => {
  it('Nuova storia → g00 → alba → bilancio → sera di g01 → notte di g01', () => {
    const d = emptySave();
    const c = newCampaign(d, db());
    expect(c.phase).toBe('sera');
    expect(c.levelId).toBe('g00');
    expect(c.evening?.noteIds).toEqual([]);
    expect(c.evening?.objectSeen).toBe(true);
    expect(c.snapshots['g00']).toBeTruthy();

    const p0 = startNight(d, db());
    expect(p0.origin).toBe('campagna');
    expect(p0.mode).toBe('normale');
    expect(p0.needsNome).toBe(false);
    expect(p0.accepted).toEqual([]);
    expect(camp(d).phase).toBe('notte');

    const r0 = completeDay(d, db(), playNight(d), '2026-10-14T00:00:00Z');
    expect(camp(d).phase).toBe('alba');
    expect(r0.dawn.map((v) => v.id)).toEqual(['g00.alba.marta', 'g00.alba.teresa', 'g00.alba.piero']);
    expect(r0.goals.every((g) => g === 'soddisfatta')).toBe(true);
    expect(camp(d).history['g00']).toBeTruthy();
    expect(d.knowledge.diary).toContain('domande.avorio.apre');
    expect(d.knowledge.questions['avorio']).toBe('aperta');
    expect(d.records['g00']?.minIncroci).toBe(4);
    expect(r0.metrics.filoDOro).toBe(true);
    expect(d.stats.nights).toBe(1);

    finishDawn(d);
    expect(camp(d).phase).toBe('bilancio');
    expect(finishBilancio(d, db())).toBe('sera');
    const c1 = camp(d);
    expect(c1.dayIndex).toBe(1);
    expect(c1.levelId).toBe('g01');
    expect(c1.phase).toBe('sera');
    // L'oggetto della laguna: l'ultimo merletto della nonna e il Libro dei Punti.
    expect(eveningItems(1, 'sera', c1, db()).map((i) => i.id)).toEqual(['merletto_avorio', 'libro_punti']);
    expect(c1.evening?.objectSeen).toBe(false);
    expect(c1.evening?.noteIds).toEqual(['g01.marta', 'g01.piero', 'g01.gino']);
    expect(pinsLeft(c1, db())).toBe(2);

    expect(pinNote(c1, db(), 'g01.marta')).toBeNull();
    expect(pinNote(c1, db(), 'g01.piero')).toBeNull();
    expect(pinNote(c1, db(), 'g01.gino')).toBe('spilli');
    expect(pinsLeft(c1, db())).toBe(0);
    expect(replyNote(c1, d.knowledge, db(), 'g01.gino', 'R1')).toBeNull();
    expect(replyNote(c1, d.knowledge, db(), 'g01.gino', 'R2')).toBe('giaRisposto');
    expect(c1.flags['ginoPromessa']).toBe(true);
    expect(d.knowledge.diary).toContain('persone.gino.promessa');
    expect(undecided(c1)).toEqual([]);

    const p1 = startNight(d, db());
    expect(camp(d).phase).toBe('notte');
    expect(p1.level.id).toBe('g01');
    expect(p1.accepted.map((a) => a.noteId)).toEqual(['g01.marta', 'g01.piero']);
    expect(camp(d).evening?.ignored).toEqual(['g01.gino']);
    expect(d.knowledge.objects).toEqual(['merletto_avorio', 'libro_punti']);
  });

  it('un bigliettino lasciato vale onIgnore; uno fallito onFail', () => {
    const d = emptySave();
    newCampaign(d, db());
    playDay(d);
    const c = camp(d);
    expect(leaveNote(c, 'g01.marta')).toBeNull();
    expect(pinNote(c, db(), 'g01.gino')).toBeNull();
    startNight(d, db());
    const report = completeDay(d, db(), playNight(d));
    expect(camp(d).flags['martaDura']).toBe(true);
    expect(report.ignored.map((x) => x.noteId)).toContain('g01.marta');
    finishDawn(d);
    finishBilancio(d, db());
    // La variante dura del bigliettino di Marta arriva il giorno dopo.
    expect(camp(d).evening?.noteIds).toContain('g02.martaDura');
    expect(camp(d).evening?.noteIds).not.toContain('g02.marta');
    expect(camp(d).evening?.noteIds.length).toBe(3);
  });
});

describe('Riprendi da qui', () => {
  it('i flag tornano allo snapshot, la conoscenza resta invariata', () => {
    const d = emptySave();
    newCampaign(d, db());
    playDay(d); // g00
    const c1 = camp(d);
    const snapFlags = clone(c1.snapshots['g01']?.flags);
    replyNote(c1, d.knowledge, db(), 'g01.gino', 'R2');
    playDay(d); // g01
    playDay(d); // g02
    camp(d).flags['provaTimeline'] = 'sì';
    const knowledgeBefore = clone(d.knowledge);
    expect(camp(d).flags['ginoChiede']).toBe(true);
    expect(rewindTo(d, db(), 'g01')).toBe(true);
    const c = camp(d);
    expect(c.levelId).toBe('g01');
    expect(c.dayIndex).toBe(1);
    expect(c.phase).toBe('sera');
    expect(c.flags).toEqual(snapFlags);
    expect(c.flags['ginoChiede']).toBeUndefined();
    expect(c.flags['provaTimeline']).toBeUndefined();
    expect(d.knowledge).toEqual(knowledgeBefore);
    expect(Object.keys(c.history)).toEqual(['g00']);
    expect(Object.keys(c.snapshots).sort()).toEqual(['g00', 'g01']);
    expect(c.evening?.noteIds).toEqual(['g01.marta', 'g01.piero', 'g01.gino']);
    expect(rewindTo(d, db(), 'g05')).toBe(false);
  });
});

describe('requisiti del finale vero (GDD 6.6)', () => {
  it('falsi con i messaggi, veri senza mancanze', () => {
    const d = emptySave();
    newCampaign(d, db());
    const c = camp(d);
    c.memoria = { teresa: 0, marta: 0, piero: 0, gino: 0, bepi: 0, nina: 0, zeno: 0, lunardi: 0 };
    const r = endingRequirements('aperto', c, d.knowledge, db());
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('finali.mancanze.lettere');
    expect(r.missing).toContain('finali.mancanze.riconciliate');
    expect(r.missing).toContain('finali.mancanze.desiderio.zeno');
    expect(r.missing.length).toBe(11);
    c.flags['lettereLivia'] = 'liberate';
    c.flags['riconciliate'] = true;
    for (const ch of CAST_IDS) d.knowledge.desires.push(ch);
    c.memoria = { teresa: 0, marta: 0, piero: 0, gino: 0, bepi: 1, nina: 1, zeno: 1, lunardi: 0 };
    const r2 = endingRequirements('aperto', c, d.knowledge, db());
    expect(r2.ok).toBe(false);
    expect(r2.missing).toEqual(['finali.mancanze.memoria']);
    c.memoria.lunardi = 2;
    expect(endingRequirements('aperto', c, d.knowledge, db())).toEqual({ ok: true, missing: [] });
    expect(endingRequirements('merlettaia', c, d.knowledge, db()).ok).toBe(true);
  });
});

describe('tutta la campagna fino ai finali', () => {
  it('da g00 alla scelta di g23, poi C, A, B e D', () => {
    const d = emptySave();
    newCampaign(d, db());
    let guard = 0;
    let last = '';
    while (camp(d).phase !== 'scelta' && guard++ < 40) last = playDay(d);
    expect(last).toBe('scelta');
    const c = camp(d);
    expect(c.levelId).toBe('g23');
    expect(c.phase).toBe('scelta');
    expect(Object.keys(c.history).length).toBe(24);
    // La sera prima della notte di g23 non ha bigliettini; la scelta sì (4 carte, 1 spillo).
    expect(c.snapshots['g23']?.evening?.noteIds).toEqual([]);
    expect(c.evening?.noteIds.length).toBe(4);
    expect(eveningItems(c.dayIndex, 'scelta', c, db()).map((i) => i.id)).toEqual(['nastro_nonna']);
    // Sblocchi di GDD 7.
    expect(d.unlocks.daily).toBe(true);
    expect(d.unlocks.libero).toBe(true);
    expect(d.unlocks.gradi).toBe(true);
    expect(Object.keys(d.knowledge.archive).sort()).toEqual(['arc1', 'arc2', 'arc3', 'arc4', 'arc5', 'arc6']);
    // Memoria in gioco da g12, invariata dopo g22 (g23 non ha la regola del nome).
    expect(Object.keys(c.memoria).length).toBe(8);

    const atChoice = clone(d);
    const cards = choiceCards(db().levels.get('g23')!, c, d.knowledge, db());
    expect(cards.map((x) => x.ending).sort()).toEqual(['aperto', 'chiuso', 'merlettaia', 'seppia']);
    expect(cards.find((x) => x.ending === 'aperto')?.available).toBe(false);

    // D senza requisiti: biglietto strappato.
    const dReq = choose(d, db(), 'aperto');
    expect(dReq.ok).toBe(false);
    expect(dReq.missing?.length).toBeGreaterThan(0);

    // C: il merletto chiuso riporta alla sera di g23, con una voce nuova.
    expect(choose(d, db(), 'chiuso').ok).toBe(true);
    expect(camp(d).phase).toBe('finale');
    expect(camp(d).levelId).toBe('fin_chiuso');
    const fc = completeFinal(d, db(), playNight(d));
    expect(fc.kind).toBe('chiuso');
    expect(camp(d).phase).toBe('scelta');
    expect(camp(d).levelId).toBe('g23');
    expect(camp(d).endingsSeen).toEqual([]);
    expect(d.knowledge.diary).toContain('domande.chiuso.punto');

    // A: la merlettaia.
    expect(choose(d, db(), 'merlettaia').ok).toBe(true);
    const fa = completeFinal(d, db(), playNight(d));
    expect(fa.kind).toBe('epilogo');
    expect(fa.epilogue.length).toBe(4);
    expect(camp(d).phase).toBe('titoli');
    expect(camp(d).endingsSeen).toEqual(['merlettaia']);
    expect(d.unlocks.cosmetics).toEqual(expect.arrayContaining(['stile_1', 'stile_2', 'stile_3', 'stile_4']));
    expect(d.unlocks.tovaglia).toBe(false);

    // B: il filo di seppia (dalla stessa sera).
    const b = clone(atChoice);
    expect(choose(b, db(), 'seppia').ok).toBe(true);
    const fb = completeFinal(b, db(), playNight(b));
    expect(fb.kind).toBe('epilogo');
    expect(fb.epilogue.length).toBe(4);

    // D con i requisiti: il merletto aperto.
    const dd = clone(atChoice);
    const cd = camp(dd);
    cd.flags['lettereLivia'] = 'liberate';
    cd.flags['riconciliate'] = true;
    for (const ch of CAST_IDS) if (!dd.knowledge.desires.includes(ch)) dd.knowledge.desires.push(ch);
    cd.memoria = { teresa: 1, marta: 1, piero: 1, gino: 1, bepi: 0, nina: 0, zeno: 0, lunardi: 0 };
    beginChoice(dd, db(), true);
    expect(choose(dd, db(), 'aperto').ok).toBe(true);
    const fd = completeFinal(dd, db(), playNight(dd));
    expect(fd.kind).toBe('epilogo');
    expect(dd.unlocks.tovaglia).toBe(true);
    expect(camp(dd).endingsSeen).toEqual(['aperto']);
  });
});

describe('Archivio', () => {
  it('rammendare un merletto lo segna come fatto, chiude le domande e mostra la rivelazione', () => {
    const d = emptySave();
    newCampaign(d, db());
    for (let i = 0; i < 4; i++) playDay(d); // fino alla sera di g04 (arc1 sbloccato dopo g03)
    expect(d.knowledge.archive['arc1']).toBe('nuovo');
    const p = archiveParams(d, db(), 'arc1');
    expect(p.origin).toBe('archivio');
    expect(p.mode).toBe('archivio');
    const computed = db().computed.get('arc1') ?? null;
    const o = simulateNight(p, precomputedRows(computed, []) ?? [], computed, db().balance);
    expect(o).not.toBeNull();
    const r = completeArchive(d, db(), o!);
    expect(r.mended).toBe(true);
    expect(d.knowledge.archive['arc1']).toBe('rammendato');
    expect(d.knowledge.questions['martaTeresa']).toBe('risolta');
    expect(d.knowledge.diary).toContain('archivio.arc1');
    expect(r.reveal?.id).toBeTruthy();
    // Con arc1 rammendato, g10 sceglie la variante del bigliettino di Marta legata all'Archivio.
    const g10 = db().levels.get('g10')!;
    expect(eveningNotes(g10, camp(d), d.knowledge, db()).map((n) => n.id)).toContain('g10.marta');
  });
});

describe('Ripassa (GDD 8.2)', () => {
  it('dopo g08 si ripassa un merletto già trovato con le stesse richieste', () => {
    const d = emptySave();
    newCampaign(d, db());
    while (camp(d).levelId !== 'g08' || camp(d).phase !== 'sera') playDay(d);
    // Prima di g08 chiusa: niente Merletto libero, niente Ripassa.
    expect(d.unlocks.libero).toBe(false);
    expect(ripassaAvailable(d)).toBe(false);
    expect(replayRipassaParams(d, db(), 'g07')).toBeNull();
    playDay(d);
    expect(d.unlocks.libero).toBe(true);
    expect(camp(d).levelId).toBe('g09');
    // La notte di g09 non è ancora stata trovata: niente Ripassa.
    expect(ripassaAvailable(d)).toBe(false);
    expect(ripassaParams(d, db())).toBeNull();
    // Dal Telaio: g07 è stata chiusa senza bigliettini, la soluzione è nota.
    const t = replayRipassaParams(d, db(), 'g07');
    expect(t?.origin).toBe('telaio');
    expect(t?.mode).toBe('replay');
    expect(t?.replay?.length).toBeGreaterThan(0);
    // Riprendi da g08: stesse richieste (nessuna) → la sera offre Ripassa.
    expect(rewindTo(d, db(), 'g08')).toBe(true);
    expect(ripassaAvailable(d)).toBe(true);
    const sol = camp(d).solutions?.['g08']?.[0];
    const p = ripassaParams(d, db());
    expect(p?.mode).toBe('replay');
    expect(p?.origin).toBe('campagna');
    expect(p?.replay).toEqual(sol?.rows);
    expect(camp(d).phase).toBe('notte');
  });
});

describe('Nuova storia (verifica)', () => {
  it('la storia e il Taccuino ricominciano, gli epiloghi visti restano (GDD 7)', () => {
    const d = emptySave();
    newCampaign(d, db());
    camp(d).endingsSeen.push('merlettaia');
    d.knowledge.desires.push('nina');
    d.unlocks.daily = true;
    const c = newCampaign(d, db());
    expect(c.endingsSeen).toEqual(['merlettaia']);
    expect(c.dayIndex).toBe(0);
    expect(c.history).toEqual({});
    expect(d.knowledge.desires).toEqual([]);
    expect(d.unlocks.daily).toBe(true);
    // Lo snapshot del prologo li porta con sé: "Riprendi da qui" non li perde.
    expect(c.snapshots['g00']?.endingsSeen).toEqual(['merlettaia']);
  });
});
