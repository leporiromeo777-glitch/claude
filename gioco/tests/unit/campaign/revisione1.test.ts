/**
 * Revisione 1 della campagna, logica pura con i contenuti veri (e qualche dato
 * sintetico dove i contenuti stanno cambiando):
 * - CAM-01: «Lascia per ora» (C10) e «Rileggi» in sola lettura;
 * - CAM-03: `{knows: 'oggetto'}` (C03), oggetto consegnato all'alba (C04), frasi d'arrivo
 *   e sere vuote, voci annunciate alla lettura che non tornano nel bilancio;
 * - CAM-05: esiti dei bigliettini (C05), desiderio solo se nuovo, plurali del record;
 * - CAM-06: piste che non si sbloccano a domanda risolta, pagine nuove del Libro;
 * - CAM-08: biglietto di Clotilde piegato dopo il merletto chiuso;
 * - CAM-09: la scelta di g23 usa uno spillo solo;
 * - CAM-12: `{occasioni}` negli epiloghi (C04), in italiano e in inglese.
 */
import { describe, expect, it } from 'vitest';
import type { ContentDB, DiaryEntryDef, NoteDef, SaveData, StoryCond } from '../../../src/core/types';
import { createI18n, loadI18nSources } from '../../../src/core/i18n';
import {
  camp,
  completeDay,
  completeFinal,
  consequenceOf,
  dawnObjectPending,
  finishArchivePhase,
  finishBilancio,
  finishDawn,
  leaveArchiveNight,
  markObjectSeen,
  newCampaign,
  readDawnObject,
  rereadParams,
  startNight,
  archiveParams,
  beginChoice,
  beginEvening,
  choose,
} from '../../../src/campaign/flow';
import { arrivalOf, dawnItems, dayIndexOf, emptyDoorKey, eveningItems, firstEveningOfAct, objectMeta, pinsLeft, pinsOf } from '../../../src/campaign/evening';
import { formatOccasions, occasionHour, withOccasions } from '../../../src/campaign/endings';
import { evalStory } from '../../../src/campaign/story';
import { markBookSeen, newBookPages, refreshDiary } from '../../../src/campaign/diary';
import { db, emptyKnowledge, emptySave, emptyState, playNight } from './helpers';

function playDay(d: SaveData): string {
  const c = camp(d);
  if (c.phase === 'sera') startNight(d, db());
  completeDay(d, db(), playNight(d));
  finishDawn(d, db());
  const next = finishBilancio(d, db());
  if (next === 'archivio') return finishArchivePhase(d, db());
  return next;
}

/** Una storia ferma alla sera della giornata `id` (con le giornate prima giocate). */
function storyAt(id: string): SaveData {
  const d = emptySave();
  newCampaign(d, db());
  let guard = 0;
  while (camp(d).levelId !== id && guard++ < 40) playDay(d);
  return d;
}

/** Una sera presa direttamente (senza giocare le giornate prima). */
function eveningAt(id: string): SaveData {
  const d = emptySave();
  newCampaign(d, db());
  camp(d).dayIndex = dayIndexOf(db(), id);
  beginEvening(d, db());
  return d;
}

const T = {
  it: createI18n({ sources: loadI18nSources(), locale: 'it' }),
  en: createI18n({ sources: loadI18nSources(), locale: 'en' }),
};

/** La condizione chiede di aver letto l'oggetto `id` (non dentro una negazione). */
function needsObject(c: StoryCond, id: string): boolean {
  if ('all' in c) return c.all.some((x) => needsObject(x, id));
  if ('any' in c) return c.any.length > 0 && c.any.every((x) => needsObject(x, id));
  return 'knows' in c && c.knows === 'oggetto' && c.id === id;
}

describe('C03: {knows: oggetto}', () => {
  it('vero quando l’oggetto o la lettera sono stati letti', () => {
    const s = emptyState();
    expect(evalStory({ knows: 'oggetto', id: 'lettera_clotilde' }, s, emptyKnowledge())).toBe(false);
    expect(evalStory({ knows: 'oggetto', id: 'lettera_clotilde' }, s, emptyKnowledge({ letters: ['lettera_clotilde'] }))).toBe(true);
    expect(evalStory({ knows: 'oggetto', id: 'fuso_faro' }, s, emptyKnowledge({ objects: ['fuso_faro'] }))).toBe(true);
  });

  it('le voci nuove si annunciano alla lettura della porta e non tornano nel bilancio', () => {
    const d = storyAt('g01');
    const fresh = markObjectSeen(d, db());
    expect(camp(d).diaryAnnounced).toEqual(fresh);
    startNight(d, db());
    const report = completeDay(d, db(), playNight(d));
    for (const id of fresh) expect(report.newDiary).not.toContain(id);
  });
});

describe('C04: provenienza degli oggetti e sere vuote', () => {
  it('g01 dalla casa, g18 da sotto la porta, g15 e g17 senza oggetto', () => {
    const g01 = eveningAt('g01');
    const it01 = arrivalOf(db(), eveningItems(1, 'sera', camp(g01), db()));
    expect(it01.key).toBe('campaign.sera.arrivo.casa');
    expect(T.it.t(it01.key)).toBe('Sul tombolo ti aspetta ancora qualcosa della nonna.');
    const g18 = eveningAt('g18');
    const items18 = eveningItems(camp(g18).dayIndex, 'sera', camp(g18), db());
    expect(items18.map((x) => x.id)).toEqual(['biglietto_livia_1']);
    expect(T.it.t(arrivalOf(db(), items18).key)).toBe('Sotto la porta, un biglietto.');
    const g15 = eveningAt('g15');
    expect(eveningItems(camp(g15).dayIndex, 'sera', camp(g15), db())).toEqual([]);
    expect(emptyDoorKey(camp(g15).dayIndex, 'sera', camp(g15), db())).toBe('atto2.g15.sera.vuota');
    const g17 = eveningAt('g17');
    expect(emptyDoorKey(camp(g17).dayIndex, 'sera', camp(g17), db())).toBe('atto3.g17.sera.vuota');
    // Una sera con l'oggetto non ha la frase vuota; il prologo nemmeno.
    expect(emptyDoorKey(1, 'sera', camp(g01), db())).toBeNull();
    expect(emptyDoorKey(0, 'sera', camp(g01), db())).toBeNull();
    // Le bottiglie arrivano dalla laguna; la lettera di Clotilde a mano, da Zeno.
    expect(objectMeta(db(), 'lettera_L3').from).toBe('laguna');
    expect(objectMeta(db(), 'lettera_clotilde')).toEqual({ from: 'mano', by: 'zeno' });
    expect(T.it.t('campaign.sera.arrivo.mano', { nome: 'Zeno' })).toBe('Zeno bussa alla porta. Ha qualcosa per te.');
  });

  it('g14: alba, vignetta di Zeno, lettera, bilancio senza le voci della lettera, cassapanca con arc4', () => {
    const d = storyAt('g14');
    const c = camp(d);
    expect(c.levelId).toBe('g14');
    startNight(d, db());
    const report = completeDay(d, db(), playNight(d));
    // L'oggetto dell'alba, consegnato a mano da Zeno.
    expect(report.dawnItems).toEqual(['lettera_clotilde']);
    expect(report.dawnBy).toBe('zeno');
    expect(dawnObjectPending(camp(d))).toBe(true);
    expect(d.knowledge.letters).not.toContain('lettera_clotilde');
    // L'ultima vignetta è quella della consegna (Zeno).
    const last = report.dawn[report.dawn.length - 1];
    expect(last?.lines.some((l) => l.speaker === 'zeno') || last?.figures.some((f) => f.character === 'zeno')).toBe(true);
    expect(report.dawn.length).toBeLessThanOrEqual(4);
    // Le voci che parlano della lettera non sono ancora nel Taccuino né nel bilancio.
    const aboutLetter = [...db().diary.values()].filter((e: DiaryEntryDef) => needsObject(e.unlock, 'lettera_clotilde')).map((e) => e.id);
    for (const id of aboutLetter) {
      expect(d.knowledge.diary).not.toContain(id);
      expect(report.newDiary).not.toContain(id);
    }
    // La lettura: si impara la lettera, le voci si sbloccano e si annunciano lì.
    const fresh = readDawnObject(d, db());
    expect(d.knowledge.letters).toContain('lettera_clotilde');
    expect(dawnObjectPending(camp(d))).toBe(false);
    // (Le voci che chiedono anche altro, per esempio un desiderio non ancora noto, aspettano.)
    const unlocked = aboutLetter.filter((id) => d.knowledge.diary.includes(id));
    expect(unlocked.length).toBeGreaterThan(0);
    for (const id of unlocked) expect(fresh).toContain(id);
    // Poi il bilancio (che resta quello di fine notte) e la cassapanca con arc4.
    finishDawn(d, db());
    expect(camp(d).phase).toBe('bilancio');
    expect(camp(d).report?.newDiary).toEqual(report.newDiary);
    expect(finishBilancio(d, db())).toBe('archivio');
    expect(camp(d).archiveOpen).toBe('arc4');
    expect(d.knowledge.archive['arc4']).toBe('nuovo');
  });

  it('saltando la consegna la lettera si impara lo stesso', () => {
    const d = storyAt('g14');
    startNight(d, db());
    completeDay(d, db(), playNight(d));
    const fresh = finishDawn(d, db());
    expect(d.knowledge.letters).toContain('lettera_clotilde');
    expect(camp(d).dawnRead).toBe(true);
    expect(Array.isArray(fresh)).toBe(true);
  });

  it('g16: il fascio all’alba solo con le lettere liberate', () => {
    const d = eveningAt('g16');
    const c = camp(d);
    expect(dawnItems(c.dayIndex, c, db())).toEqual([]);
    c.flags['lettereLivia'] = 'liberate';
    expect(dawnItems(c.dayIndex, c, db()).map((x) => x.id)).toEqual(['fascio_lettere', 'fascio_1', 'fascio_2', 'fascio_3']);
    // La sera dopo non arriva più (era la sera di g17).
    const g17 = eveningAt('g17');
    camp(g17).flags['lettereLivia'] = 'liberate';
    expect(eveningItems(camp(g17).dayIndex, 'sera', camp(g17), db())).toEqual([]);
  });
});

describe('CAM-01: Archivio facoltativo e Rileggi', () => {
  it('arc1 aperto in fase d’Archivio, Lascia, Più tardi: sera di g04 con arc1 ancora da fare', () => {
    const d = emptySave();
    newCampaign(d, db());
    for (let i = 0; i < 3; i++) playDay(d); // g00, g01, g02: sera di g03
    expect(camp(d).levelId).toBe('g03');
    startNight(d, db());
    completeDay(d, db(), playNight(d));
    finishDawn(d, db());
    expect(finishBilancio(d, db())).toBe('archivio');
    // Apri: la notte d'Archivio parte e viene salvata dal tombolo.
    const p = archiveParams(d, db(), 'arc1');
    d.night = { origin: 'archivio', params: { ...p, levelId: 'arc1', level: undefined } as never, resume: { levelId: 'arc1', rows: [], draft: [], dropped: [], nomeOn: null, hintsUsed: 0, fantasmaUsed: false } };
    // Lascia per ora (C10): la notte salvata se ne va, l'Archivio resta com'era.
    expect(leaveArchiveNight(d, 'arc2')).toBe(false);
    expect(leaveArchiveNight(d, 'arc1')).toBe(true);
    expect(d.night).toBeNull();
    expect(d.knowledge.archive['arc1']).toBe('nuovo');
    expect(camp(d).phase).toBe('archivio');
    // Più tardi: la sera di g04.
    expect(finishArchivePhase(d, db())).toBe('sera');
    expect(camp(d).levelId).toBe('g04');
    expect(d.knowledge.archive['arc1']).toBe('nuovo');
  });

  it('Rileggi: il merletto registrato in sola lettura, con i nomi giusti', () => {
    const p = rereadParams(db(), 'arc1');
    const lv = db().levels.get('arc1')!;
    expect(p.origin).toBe('archivio');
    expect(p.mode).toBe('replay');
    expect(p.replay?.length).toBe(lv.archive!.recorded.length);
    expect(p.resume?.archiveNames).toEqual(lv.archive!.answer);
    expect(p.goals).toEqual([]);
  });
});

describe('CAM-05: conseguenze (C05)', () => {
  it('prima l’esito scritto, poi destino, desiderio solo se nuovo, voce, frase generica', () => {
    const esito = { ok: 'x.ok', fallita: 'x.ko' };
    const fx = [{ setFlag: 'nina', value: 'parte' as const }, { desire: 'nina' as const }];
    expect(consequenceOf(fx, 'nina', 'ok', db(), { esito }).consequenceKey).toBe('x.ok');
    expect(consequenceOf(fx, 'nina', 'fallita', db(), { esito }).consequenceKey).toBe('x.ko');
    expect(consequenceOf(fx, 'nina', 'lasciato', db(), { esito }).consequenceKey).toBe('campaign.destini.nina.parte');
    const desire = [{ desire: 'gino' as const }];
    expect(consequenceOf(desire, 'gino', 'ok', db(), { newDesires: ['gino'] }).consequenceKey).toBe('campaign.bilancio.conseguenza.desiderio');
    expect(consequenceOf(desire, 'gino', 'ok', db(), { newDesires: [] }).consequenceKey).toBe('campaign.bilancio.conseguenza.ok');
  });

  it('una voce usata come conseguenza non si ripete in «Nel Taccuino»', () => {
    const base = db();
    const entry = [...base.diary.values()].find((e) => e.section === 'persone' && e.character === 'marta');
    if (!entry) throw new Error('voce di Marta');
    const marta = base.notes.get('g01.marta') as NoteDef;
    const note: NoteDef = { ...marta, esito: undefined, onOk: [{ diary: entry.id }], onFail: [{ diary: entry.id }] };
    const notes = new Map(base.notes);
    notes.set(note.id, note);
    const fake: ContentDB = { ...base, notes };
    const d = emptySave();
    newCampaign(d, fake);
    startNight(d, fake);
    completeDay(d, fake, playNight(d, fake));
    finishDawn(d, fake);
    finishBilancio(d, fake);
    d.knowledge.diary = d.knowledge.diary.filter((x) => x !== entry.id);
    camp(d).diaryAtEvening = d.knowledge.diary.length;
    camp(d).evening!.accepted = [{ noteId: 'g01.marta' }];
    startNight(d, fake);
    const r = completeDay(d, fake, playNight(d, fake));
    const req = r.requests.find((x) => x.noteId === 'g01.marta');
    expect(req?.consequenceDiary).toBe(entry.id);
    expect(r.newDiary).not.toContain(entry.id);
  });

  it('record al plurale corretto: «1 incrocio, 1 ora di quiete»', () => {
    expect(T.it.t('campaign.bilancio.record', { incroci: 1, quiete: 1 })).toBe('Record: 1 incrocio, 1 ora di quiete');
    expect(T.it.t('campaign.bilancio.record', { incroci: 5, quiete: 0 })).toBe('Record: 5 incroci, nessuna ora di quiete');
    expect(T.en.t('campaign.bilancio.record', { incroci: 1, quiete: 2 })).toBe('Record: 1 crossing, 2 quiet hours');
    expect(T.it.t('campaign.bilancio.obiettivi')).toBe('Come doveva andare');
  });
});

describe('CAM-06: piste e Libro', () => {
  it('una pista di una domanda già risolta non si sblocca più', () => {
    const pista: DiaryEntryDef = { id: 'domande.prova.pista', section: 'domande', textKey: 'x', unlock: { done: 'g00' }, pista: true, opens: ['prova'] };
    const fake = { ...db(), diary: new Map([[pista.id, pista]]) };
    const s = emptyState({ history: { g00: { levelId: 'g00', rows: [], requests: [], metrics: { incroci: 0, minIncroci: null, quiete: 0, simmetria: false, filoDOro: false }, spartito: '', at: '' } } });
    const k = emptyKnowledge({ questions: { prova: 'risolta' } });
    expect(refreshDiary(s, k, fake)).toEqual([]);
    const k2 = emptyKnowledge();
    expect(refreshDiary(s, k2, fake)).toEqual([pista.id]);
  });

  it('le pagine sbloccate e non viste sono nuove finché non si segnano', () => {
    const s = emptyState();
    const k = emptyKnowledge({ rules: ['febbre'] });
    expect(newBookPages(s, k, db()).map((p) => p.id)).toContain('febbre');
    expect(markBookSeen(k, ['febbre'])).toBe(true);
    expect(markBookSeen(k, ['febbre'])).toBe(false);
    expect(newBookPages(s, k, db()).map((p) => p.id)).not.toContain('febbre');
  });
});

describe('CAM-09: spilli', () => {
  it('la scelta di g23 usa sempre uno spillo; la sera di g23 quelli dei dati', () => {
    const i = dayIndexOf(db(), 'g23');
    expect(pinsOf(db(), i, 'scelta')).toBe(1);
    expect(pinsOf(db(), i, 'sera')).toBe(db().campaign.days[i]?.pins);
    const d = eveningAt('g23');
    beginChoice(d, db());
    expect(pinsLeft(camp(d), db())).toBe(1);
  });
});

describe('CAM-10: cartelli d’atto', () => {
  it('alla prima sera di ogni atto: g01, g09 e g17', () => {
    const firsts = db().campaign.days.map((d, i) => (firstEveningOfAct(db(), i) ? d.id : null)).filter((x) => x);
    expect(firsts).toEqual(['g01', 'g09', 'g17']);
  });
});

describe('CAM-12: {occasioni} negli epiloghi', () => {
  const sol = (): NonNullable<ReturnType<ContentDB['computed']['get']>>['occasionsSolution'] => db().computed.get('fin_aperto')?.occasionsSolution ?? [];

  it('con la soluzione di fin_aperto, in italiano e in inglese', () => {
    expect(formatOccasions(sol() ?? [], (k, p) => T.it.t(k, p))).toBe('il vaporetto delle 9, la festa in Farmacia a mezzogiorno, la festa in Piazza alle 17 e la lanterna alle 20');
    expect(formatOccasions(sol() ?? [], (k, p) => T.en.t(k, p))).toBe('the 9 am ferry, the party at the Pharmacy at noon, the party in the Square at 5 pm and the lantern at 8 pm');
  });

  it('una sola occasione, nessuna, le ore', () => {
    expect(formatOccasions([{ kind: 'pane', place: 'forno', hour: 7 }], (k, p) => T.it.t(k, p))).toBe('il pane al Forno alle 7');
    expect(formatOccasions([], (k, p) => T.it.t(k, p))).toBe('');
    expect(occasionHour(12, (k, p) => T.en.t(k, p)).ora).toBe('at noon');
    expect(occasionHour(20, (k, p) => T.en.t(k, p)).h).toBe('8 pm');
    const v = withOccasions([{ id: 'x', priority: 1, background: 'b', figures: [], lines: [{ speaker: 'narratore', textKey: 'k' }] }], 'il pane');
    expect(v[0]?.lines[0]?.params).toEqual({ occasioni: 'il pane' });
  });

  it('la notte del finale aperto conserva le occasioni piantate', () => {
    const d = emptySave();
    newCampaign(d, db());
    const c = camp(d);
    c.dayIndex = dayIndexOf(db(), 'g23');
    beginChoice(d, db(), true);
    c.flags['lettereLivia'] = 'liberate';
    c.flags['riconciliate'] = true;
    for (const ch of ['teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi'] as const) d.knowledge.desires.push(ch);
    c.memoria = { teresa: 1, marta: 1, piero: 1, gino: 1, bepi: 0, nina: 0, zeno: 0, lunardi: 0 };
    beginChoice(d, db(), true);
    expect(choose(d, db(), 'aperto').ok).toBe(true);
    const r = completeFinal(d, db(), playNight(d));
    expect(r.kind).toBe('epilogo');
    expect(r.occasions.map((o) => `${o.kind}@${o.hour}`).sort()).toEqual((sol() ?? []).map((o) => `${o.kind}@${o.hour}`).sort());
    expect((camp(d).history['fin_aperto'] as { occasions?: unknown[] }).occasions?.length).toBe(sol()?.length);
  });
});
