/**
 * Suoni automatici con il motore vero (src/engine): si gioca la soluzione di alcune
 * notti di prova come farebbe il tombolo (night:cross per gli incroci del giocatore,
 * night:row con il RowResult di applyRow) e si controlla che cosa suona.
 *
 * - Prologo (GDD 3.15): ogni incrocio suona una volta sola (quando lo si fa), ogni riga
 *   ha l'ora fissata e la campana stonata (s = 1); alle 6 Teresa legge la lettera, alle
 *   7 la lettera arriva a Don Piero.
 * - Filo nero: l'arrivo suona il bordone, l'annuncio dell'incrocio della riga dopo è
 *   muto, l'incrocio forzato suona nella sua riga (nessuno l'ha fatto con night:cross).
 */
import { describe, expect, it } from 'vitest';
import { createBus } from '../../../src/core/events';
import { emptyContentDB } from '../../../src/content/loader';
import { defaultSaveData } from '../../../src/core/save/defaults';
import { defaultSettings } from '../../../src/core/settings';
import { AudioAutomation, type AutomationTarget, type CaptionRef } from '../../../src/audio/automation';
import { applyRow, createContext, initialState } from '../../../src/engine';
import type { CharacterId, Crossing, GameEventMap, LaceState, LevelComputed, LevelDef } from '../../../src/core/types';
import g00 from '../../../src/engine/fixtures/g00.json';
import g00c from '../../../src/engine/fixtures/g00.computed.json';
import nero from '../../../src/engine/fixtures/test-nero.json';
import neroc from '../../../src/engine/fixtures/test-nero.computed.json';

type Played = { fn: string; id?: string; detail?: string };

class Recorder implements AutomationTarget {
  out: Played[] = [];
  sfx(id: string): void {
    this.out.push({ fn: 'sfx', id });
  }
  play(id: string, _o?: unknown, caption?: CaptionRef | null): void {
    this.out.push({ fn: 'play', id, detail: caption?.key.split('.').pop() });
  }
  crossing(over: string, under: string, o?: { flip?: boolean; rancor?: boolean }): void {
    this.out.push({ fn: o?.flip ? 'rovescia' : 'incrocio', detail: `${over}/${under}${o?.rancor ? ' rancore' : ''}` });
  }
  bell(o: { hour: number; stonatura: number }): void {
    this.out.push({ fn: 'campana', detail: `${o.hour} s=${o.stonatura}` });
  }
  dyad(): void {
    this.out.push({ fn: 'nota' });
  }
  caption(): void {}
  suspend(): void {}
  resume(): void {}
}

/** Gioca la soluzione di un livello come il tombolo, riga per riga. */
function play(level: LevelDef, computed: LevelComputed): { rec: Recorder; rows: Played[][] } {
  const bus = createBus<GameEventMap>();
  const rec = new Recorder();
  const db = emptyContentDB();
  db.campaign.days = [{ id: 'g00', act: 0, pins: 0, stonatura: 1 }];
  const auto = new AudioAutomation({
    bus,
    engine: rec,
    content: () => db,
    save: () => defaultSaveData('t'),
    settings: () => defaultSettings(),
    nameOf: (w: CharacterId | 'lino') => w,
  });
  auto.install();
  const flags = {};
  bus.emit('scene:enter', { id: 'tombolo', params: { origin: 'campagna', mode: 'normale', level, flags, accepted: [], goals: [], needsNome: false } });
  const ctx = createContext(level, flags);
  let state: LaceState = initialState(level, ctx);
  const rows: Played[][] = [];
  for (const row of computed.base.rows) {
    const start = rec.out.length;
    const draft: Crossing[] = [];
    for (const c of row.crossings) {
      if (c.forced) continue;
      const left = state.pos[c.pair]!;
      const right = state.pos[c.pair + 1]!;
      const over = c.over === 'L' ? left : right;
      const under = c.over === 'L' ? right : left;
      draft.push({ pair: c.pair, over: c.over });
      bus.emit('night:cross', { hour: row.hour, crossing: { pair: c.pair, over: c.over }, over, under });
    }
    const result = applyRow(level, state, draft, ctx);
    expect(result.ok).toBe(true);
    bus.emit('night:row', { hour: row.hour, result });
    state = result.state;
    rows.push(rec.out.slice(start));
  }
  return { rec, rows };
}

const short = (p: Played[]): string[] => p.map((x) => `${x.fn}${x.id ? `:${x.id}` : ''}${x.detail ? `(${x.detail})` : ''}`);

describe('suoni automatici con il motore vero', () => {
  it('prologo: un incrocio per gesto, ora fissata e campana stonata a ogni riga, la lettera arriva', () => {
    const { rows } = play(g00 as unknown as LevelDef, g00c as unknown as LevelComputed);
    expect(rows).toHaveLength(4);
    // GDD 3.15: alle 6 Marta passa sopra Teresa; a fine riga Teresa legge la lettera.
    expect(short(rows[0]!)).toEqual(['incrocio(marta/teresa)', 'sfx:ora_fissata', 'campana(6 s=1)', 'play:segreto(legge)']);
    for (const r of rows) {
      expect(r.filter((x) => x.fn === 'incrocio')).toHaveLength(1);
      expect(r.filter((x) => x.fn === 'campana')).toHaveLength(1);
    }
    expect(short(rows[1]!)).toContain('play:lettera(consegna)');
  });

  it('filo nero: arrivo col bordone, annuncio muto, incrocio forzato nella sua riga', () => {
    const { rows } = play(nero as unknown as LevelDef, neroc as unknown as LevelComputed);
    const byHour = new Map(rows.map((r, i) => [(neroc as unknown as LevelComputed).base.rows[i]!.hour, r]));
    // Alle 8 entra dal Faro: il suo bordone, non la secca di chi esce.
    const h8 = short(byHour.get(8)!);
    expect(h8).toContain('play:nero(nero)');
    expect(h8.some((x) => x.startsWith('play:secca'))).toBe(false);
    // Ogni incrocio forzato del filo nero (righe 9, 10, 11) suona una volta, nella sua riga,
    // con la nota di Livia sopra.
    for (const h of [9, 10, 11]) {
      const crossings = byHour.get(h)!.filter((x) => x.fn === 'incrocio');
      const livia = crossings.filter((x) => x.detail?.startsWith('livia/'));
      expect(livia).toHaveLength(1);
    }
    // Riga senza incroci: niente incroci inventati dall'annuncio.
    expect(byHour.get(12)!.filter((x) => x.fn === 'incrocio')).toHaveLength(0);
  });
});
