/**
 * Verifica della revisione 1 della campagna sui contenuti veri, giornata per giornata
 * (tutta la storia, con due modi di giocare: appuntando i bigliettini con le richieste o
 * lasciandoli tutti):
 * - CAM-05 (D12, C05): nessuna riga del bilancio è identica a un'altra della stessa pagina
 *   (conseguenze e «Nel Taccuino»); «Ora so che cosa desidera X» una volta sola per persona;
 * - CAM-03 (C03): le voci annunciate alla lettura di un oggetto non tornano nel bilancio;
 * - CAM-04 (D11, C06): niente battute generiche in un'alba con un culmine, la riserva solo
 *   senza vignette scritte, al massimo 4 vignette; la consegna dell'oggetto chiude l'alba.
 */
import { describe, expect, it } from 'vitest';
import type { DayReport } from '../../../src/campaign/types';
import type { SaveData } from '../../../src/core/types';
import { createI18n, loadI18nSources } from '../../../src/core/i18n';
import { camp, completeDay, finishArchivePhase, finishBilancio, finishDawn, markObjectSeen, newCampaign, readDawnObject, startNight } from '../../../src/campaign/flow';
import { pinNote, pinsLeft, replyNote } from '../../../src/campaign/evening';
import { PRIORITY_CULMINE } from '../../../src/campaign/dawn';
import { db, emptySave, playNight } from './helpers';

const T = createI18n({ sources: loadI18nSources(), locale: 'it' });
const NAME = /\[\[([a-z]+)\]\]/g;
function render(key: string, params?: Record<string, string | number>): string {
  const p: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params ?? {})) p[k] = typeof v === 'string' ? v.replace(NAME, (_, id: string) => T.t(`comune.pers.${id}.nome`)) : v;
  return T.t(key, p).replace(NAME, (_, id: string) => T.t(`comune.pers.${id}.nome`)).replace(/\s+/g, ' ').trim();
}

interface Page {
  day: string;
  lines: string[];
  report: DayReport;
  announced: string[];
}

/** Gioca tutta la storia fino alla scelta; `pin` decide se appuntare i bigliettini con richiesta. */
function playStory(pin: boolean): Page[] {
  const d: SaveData = emptySave();
  const content = db();
  newCampaign(d, content);
  const pages: Page[] = [];
  let guard = 0;
  while (camp(d).phase === 'sera' && guard++ < 40) {
    const c = camp(d);
    const announced = markObjectSeen(d, content);
    for (const id of c.evening?.noteIds ?? []) {
      const note = content.notes.get(id);
      if (!note) continue;
      if (note.replies?.length) replyNote(c, d.knowledge, content, id, 'R1');
      if (pin && note.request && pinsLeft(c, content) > 0) pinNote(c, content, id, note.author);
    }
    startNight(d, content);
    const report = completeDay(d, content, playNight(d));
    announced.push(...readDawnObject(d, content));
    const lines: string[] = [];
    for (const r of [...report.requests, ...report.ignored]) lines.push(render(r.consequenceKey, r.consequenceParams));
    for (const id of report.newDiary) {
      const def = content.diary.get(id);
      if (def) lines.push(render(def.textKey));
    }
    pages.push({ day: report.levelId, lines, report, announced });
    finishDawn(d, content);
    const next = finishBilancio(d, content);
    if (next === 'archivio') finishArchivePhase(d, content);
  }
  return pages;
}

const runs = { appuntati: playStory(true), lasciati: playStory(false) };

describe('verifica R1: bilancio di tutta la storia', () => {
  for (const [name, pages] of Object.entries(runs)) {
    it(`${name}: si arriva alla scelta di g23`, () => {
      expect(pages.map((p) => p.day)).toContain('g23');
    });

    it(`${name}: nessuna riga ripetuta nella stessa pagina del bilancio`, () => {
      const dup: string[] = [];
      for (const p of pages) {
        const seen = new Set<string>();
        for (const l of p.lines) {
          if (seen.has(l)) dup.push(`${p.day}: ${l.slice(0, 80)}`);
          seen.add(l);
        }
      }
      expect(dup).toEqual([]);
    });

    it(`${name}: le voci annunciate alla lettura non tornano nel bilancio`, () => {
      const back: string[] = [];
      for (const p of pages) for (const id of p.announced) if (p.report.newDiary.includes(id)) back.push(`${p.day}: ${id}`);
      expect(back).toEqual([]);
    });

    it(`${name}: «Ora so che cosa desidera X» una volta sola per persona`, () => {
      const seen = new Map<string, string>();
      const twice: string[] = [];
      for (const p of pages) {
        for (const r of [...p.report.requests, ...p.report.ignored]) {
          if (r.consequenceKey !== 'campaign.bilancio.conseguenza.desiderio') continue;
          const who = String(r.consequenceParams?.['nome'] ?? '');
          if (seen.has(who)) twice.push(`${who}: ${seen.get(who)} e ${p.day}`);
          seen.set(who, p.day);
        }
      }
      expect(twice).toEqual([]);
    });

    it(`${name}: alba con i culmini (D11)`, () => {
      const bad: string[] = [];
      for (const p of pages) {
        const dawn = p.report.dawn;
        const culmine = dawn.some((v) => !v.id.startsWith('line:') && v.priority >= PRIORITY_CULMINE);
        const written = dawn.filter((v) => !v.id.startsWith('line:')).length;
        const generic = dawn.filter((v) => v.id.startsWith('line:'));
        if (dawn.length > 4) bad.push(`${p.day}: ${dawn.length} vignette`);
        if (culmine && generic.length > 0) bad.push(`${p.day}: battuta generica con un culmine (${generic.map((v) => v.id).join(', ')})`);
        if (written >= 2 && generic.length > 0) bad.push(`${p.day}: battuta generica con ${written} scritte`);
        if (p.report.dawnBy) {
          const last = dawn[dawn.length - 1];
          const by = p.report.dawnBy;
          if (!last || !(last.lines.some((l) => l.speaker === by) || last.figures.some((f) => f.character === by))) bad.push(`${p.day}: l'ultima vignetta non è la consegna di ${by}`);
        }
      }
      expect(bad).toEqual([]);
    });
  }
});
