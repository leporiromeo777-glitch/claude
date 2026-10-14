// @vitest-environment happy-dom
/**
 * Suoni automatici dal bus (ARCHITETTURA 5.6): incroci (con rancore e rovesciamento),
 * rifiuto, ora fissata con la campana della giornata, suoni del merletto, disfa, fine
 * della notte, pagina, tocchi dei pulsanti, pausa e ripresa dell'app.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createBus } from '../../../src/core/events';
import { emptyContentDB } from '../../../src/content/loader';
import { defaultSaveData } from '../../../src/core/save/defaults';
import { defaultSettings } from '../../../src/core/settings';
import {
  AudioAutomation,
  ROW_SOUND_START,
  ROW_SOUND_STEP,
  activeRancor,
  columnPan,
  eventSounds,
  resolveStonatura,
  threadWho,
  type AutomationTarget,
  type CaptionRef,
} from '../../../src/audio/automation';
import type {
  CharacterId,
  ContentDB,
  GameEventMap,
  LaceEvent,
  LaceState,
  LevelDef,
  NightOutcome,
  SaveData,
  Settings,
} from '../../../src/core/types';

type Call = { fn: string; args: unknown[] };

class SpyEngine implements AutomationTarget {
  calls: Call[] = [];
  sfx(id: string, o?: unknown): void {
    this.calls.push({ fn: 'sfx', args: o === undefined ? [id] : [id, o] });
  }
  play(id: string, o?: unknown, caption?: CaptionRef | null, logId?: string): void {
    this.calls.push({ fn: 'play', args: [id, o, caption, logId] });
  }
  crossing(over: string, under: string, o?: unknown): void {
    this.calls.push({ fn: 'crossing', args: [over, under, o] });
  }
  bell(o: unknown): void {
    this.calls.push({ fn: 'bell', args: [o] });
  }
  dyad(over: string | null, under: string | null, o?: unknown): void {
    this.calls.push({ fn: 'dyad', args: o === undefined ? [over, under] : [over, under, o] });
  }
  caption(key: string): void {
    this.calls.push({ fn: 'caption', args: [key] });
  }
  suspend(): void {
    this.calls.push({ fn: 'suspend', args: [] });
  }
  resume(): void {
    this.calls.push({ fn: 'resume', args: [] });
  }
  fns(): string[] {
    return this.calls.map((c) => (c.fn === 'sfx' || c.fn === 'play' ? `${c.fn}:${String(c.args[0])}` : c.fn));
  }
}

function level(o: Partial<LevelDef> & Pick<LevelDef, 'id'>): LevelDef {
  return {
    kind: 'storia',
    act: 1,
    titleKey: 'x',
    columns: ['forno', 'piazza', 'chiesa'],
    startHour: 5,
    endHour: 9,
    threads: [
      { id: 'teresa', kind: 'persona', character: 'teresa' },
      { id: 'marta', kind: 'persona', character: 'marta' },
      { id: 'piero', kind: 'persona', character: 'piero' },
    ],
    initial: ['teresa', 'marta', 'piero'],
    beads: [{ id: 'L1', type: 'lettera', holder: 'teresa', to: 'piero', labelKey: 'x' }],
    rules: ['incrocio', 'spillo', 'lettera'],
    quirks: ['martaNoSotto', 'teresaLegge'],
    pins: [],
    matassa: 7,
    ...o,
  };
}

const G00 = level({ id: 'g00', act: 0 });
const G11 = level({
  id: 'g11',
  act: 2,
  columns: ['molo', 'forno', 'piazza', 'chiesa', 'farmacia', 'faro'],
  threads: [
    { id: 'lino1', kind: 'lino' },
    { id: 'marta', kind: 'persona', character: 'marta' },
    { id: 'teresa', kind: 'persona', character: 'teresa' },
    { id: 'piero', kind: 'persona', character: 'piero' },
    { id: 'gino', kind: 'persona', character: 'gino' },
    { id: 'nina', kind: 'persona', character: 'nina' },
    { id: 'nero', kind: 'nero', character: 'livia' },
  ],
  initial: ['lino1', 'marta', 'teresa', 'piero', 'gino', 'nina'],
  beads: [
    { id: 'voce:ninaParte', type: 'voce', holders: ['teresa'], labelKey: 'x' },
    { id: 'febbre', type: 'febbre', holders: ['gino'], labelKey: 'x' },
  ],
  rancor: [['teresa', 'marta']],
  musicSeed: 'nodo',
});

function content(): ContentDB {
  const db = emptyContentDB();
  db.campaign.days = [
    { id: 'g00', act: 0, pins: 0, stonatura: 1 },
    { id: 'g11', act: 2, pins: 2, stonatura: 0.6 },
    { id: 'g14', act: 2, pins: 2, stonatura: 0.6 },
    { id: 'g20', act: 3, pins: 3, stonatura: 0.25 },
  ];
  db.levels.set('g11', G11);
  return db;
}

const NAMES: Record<string, string> = { teresa: 'Teresa', marta: 'Marta', piero: 'Don Piero', gino: 'Gino', nina: 'Nina', livia: 'Livia', lino: 'un passante' };
const nameOf = (w: CharacterId | 'lino'): string => NAMES[w] ?? w;

function state(pos: string[]): LaceState {
  return { hour: 0, pos, offboard: [], holders: {}, delivered: [], knotted: [], pozzo: { secrets: 0, overflowing: false }, usedMatassa: 0, met: [], metOver: [] };
}

function setup(o: { save?: SaveData | null; settings?: Partial<Settings> } = {}) {
  const bus = createBus<GameEventMap>();
  const engine = new SpyEngine();
  const db = content();
  let t = 0;
  const save = o.save === undefined ? defaultSaveData('test') : o.save;
  const settings = { ...defaultSettings(), ...(o.settings ?? {}) };
  const root = document.createElement('div');
  document.body.appendChild(root);
  const auto = new AudioAutomation({
    bus,
    engine,
    content: () => db,
    save: () => save,
    settings: () => settings,
    nameOf,
    uiRoot: root,
    now: () => t,
  });
  const off = auto.install();
  return { bus, engine, auto, root, off, db, advance: (ms: number) => (t += ms) };
}

const enterNight = (bus: ReturnType<typeof createBus<GameEventMap>>, lvl: LevelDef, flags: Record<string, boolean> = {}, mode = 'normale'): void =>
  bus.emit('scene:enter', { id: 'tombolo', params: { origin: 'campagna', mode, level: lvl, flags, accepted: [], goals: [], needsNome: false } });

describe('funzioni pure', () => {
  it('chi suona un filo', () => {
    expect(threadWho('marta', G11)).toBe('marta');
    expect(threadWho('lino1', G11)).toBe('lino');
    expect(threadWho('nero', G11)).toBe('livia');
    expect(threadWho('zeno', null)).toBe('zeno');
    expect(threadWho('lino7', null)).toBe('lino');
  });

  it('rancore attivo, tolto da riconciliate', () => {
    expect(activeRancor(G11, {})).toEqual([['teresa', 'marta']]);
    expect(activeRancor(G11, { riconciliate: true })).toEqual([]);
    expect(activeRancor(G00, {})).toEqual([]);
  });

  it('panoramica delle colonne', () => {
    expect(columnPan(0, 6)).toBeCloseTo(-0.6);
    expect(columnPan(5, 6)).toBeCloseTo(0.6);
    expect(columnPan(2.5, 6)).toBeCloseTo(0);
    expect(columnPan(0, 1)).toBe(0);
  });

  it('stonatura della campana', () => {
    const db = content();
    const save = defaultSaveData('t');
    expect(resolveStonatura('g00', G00, db, save)).toBe(1);
    expect(resolveStonatura('g11', G11, db, save)).toBe(0.6);
    expect(resolveStonatura('g20', null, db, save)).toBe(0.25);
    expect(resolveStonatura('fin_aperto', null, db, save)).toBe(0);
    expect(resolveStonatura('fin_chiuso', null, db, save)).toBe(1);
    // Livello fuori dalla campagna: la giornata raggiunta.
    const inCampaign = defaultSaveData('t');
    inCampaign.campaign = { levelId: 'g14', endingsSeen: [] } as unknown as SaveData['campaign'];
    expect(resolveStonatura('arc4', level({ id: 'arc4', kind: 'archivio' }), db, inCampaign)).toBe(0.6);
    // Senza campagna: per atto.
    expect(resolveStonatura('lib-x', level({ id: 'lib-x', act: 3 }), db, save)).toBe(0.25);
    expect(resolveStonatura('lib-y', level({ id: 'lib-y', act: 2 }), null, null)).toBe(0.6);
    // Dopo il finale vero la campana è intonata.
    const after = defaultSaveData('t');
    after.unlocks.tovaglia = true;
    expect(resolveStonatura('g00', G00, db, after)).toBe(0);
  });

  it('suoni degli eventi del merletto, senza doppioni', () => {
    const pos = ['lino1', 'teresa', 'marta', 'piero', 'gino', 'nina'];
    const ev: LaceEvent[] = [
      { k: 'incontro', a: 'teresa', b: 'piero', over: 'teresa', pair: 2 },
      { k: 'passa', bead: 'L1', from: 'teresa', to: 'piero' },
      { k: 'consegna', bead: 'L1', to: 'piero' },
      { k: 'copia', bead: 'voce:ninaParte', from: 'teresa', to: 'piero' },
      { k: 'copia', bead: 'letta:L1', from: 'teresa', to: 'marta' },
      { k: 'legge', letter: 'L1', secret: 'letta:L1', who: 'teresa' },
      { k: 'contagio', from: 'gino', to: 'nina' },
      { k: 'cura', who: 'gino', by: 'lunardi' },
      { k: 'nodo', a: 'teresa', b: 'marta' },
      { k: 'trabocca', who: 'piero' },
      { k: 'esce', thread: 'lino1', side: 'molo', kind: 'vaporetto' },
      { k: 'entra', thread: 'lino2', side: 'molo', kind: 'vaporetto' },
      { k: 'entra', thread: 'nero', side: 'faro', kind: 'secca' },
      { k: 'stranezza', quirk: 'teresaLegge', thread: 'teresa' },
    ];
    const lvl = { ...G11, beads: [...G11.beads, { id: 'L1', type: 'lettera' as const, holder: 'teresa', to: 'piero', labelKey: 'x' }] };
    const s = eventSounds(ev, { level: lvl, pos, nameOf });
    const short = s.map((x) => (x.k === 'sfx' ? `${x.id}:${x.caption?.key.split('.').pop()}` : 'crossing'));
    expect(short).toEqual([
      'lettera:consegna',
      'voce:voceA',
      'segreto:segretoA',
      'segreto:legge',
      'febbre:febbreA',
      'cura:curaA',
      'nodo:nodoTra',
      'trabocco:traboccoDi',
      'vaporetto:vaporetto',
      'nero:nero',
    ]);
    const consegna = s[0]!;
    expect(consegna.k === 'sfx' && consegna.caption?.params).toEqual({ nome: 'Don Piero' });
    expect(consegna.k === 'sfx' && consegna.pan).toBeCloseTo(columnPan(3, 6));
    const febbre = s.find((x) => x.k === 'sfx' && x.id === 'febbre')!;
    expect(febbre.k === 'sfx' && febbre.caption?.params).toEqual({ nome: 'Nina' });
  });

  it('il filo nero incrocia: bicordo di Livia sopra l\'altro', () => {
    const pos = ['marta', 'nero', 'zeno', 'teresa', 'gino', 'nina'];
    const s = eventSounds([{ k: 'nero', thread: 'nero', pair: 0 }], { level: G11, pos, nameOf });
    expect(s).toEqual([{ k: 'crossing', over: 'livia', under: 'marta', pan: columnPan(0.5, 6) }]);
  });
});

describe('ascolto del bus', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('night:cross → incrocio con le note dei due; stessa coppia nell\'altro verso → rovescia', () => {
    const { bus, engine } = ctx;
    enterNight(bus, G00);
    bus.emit('night:cross', { hour: 6, crossing: { pair: 0, over: 'R' }, over: 'marta', under: 'teresa' });
    expect(engine.calls[0]).toEqual({ fn: 'crossing', args: ['marta', 'teresa', { rancor: false, pan: columnPan(0.5, 3), flip: false }] });
    bus.emit('night:cross', { hour: 6, crossing: { pair: 0, over: 'L' }, over: 'teresa', under: 'marta' });
    expect((engine.calls[1]!.args[2] as { flip: boolean }).flip).toBe(true);
    // Nuova ora: la bozza riparte.
    bus.emit('night:cross', { hour: 7, crossing: { pair: 0, over: 'L' }, over: 'teresa', under: 'marta' });
    expect((engine.calls[2]!.args[2] as { flip: boolean }).flip).toBe(false);
  });

  it('rancore: la nota sotto stona, finché Teresa e Marta non si riconciliano', () => {
    const { bus, engine } = ctx;
    enterNight(bus, G11);
    bus.emit('night:cross', { hour: 7, crossing: { pair: 1, over: 'L' }, over: 'marta', under: 'teresa' });
    bus.emit('night:cross', { hour: 7, crossing: { pair: 0, over: 'R' }, over: 'marta', under: 'lino1' });
    expect(engine.calls[0]!.args[2]).toMatchObject({ rancor: true });
    expect(engine.calls[1]!.args).toMatchObject(['marta', 'lino', { rancor: false }]);
    enterNight(bus, G11, { riconciliate: true });
    bus.emit('night:cross', { hour: 7, crossing: { pair: 1, over: 'L' }, over: 'marta', under: 'teresa' });
    expect(engine.calls[2]!.args[2]).toMatchObject({ rancor: false });
  });

  it('night:violation → «No.» di Marta o tonfo', () => {
    const { bus, engine } = ctx;
    bus.emit('night:violation', { v: { code: 'rifiuto', quirk: 'martaNoSotto', threads: ['teresa', 'marta'], messageKey: 'x' } });
    bus.emit('night:violation', { v: { code: 'spillo', messageKey: 'x' } });
    expect(engine.fns()).toEqual(['sfx:rifiuto', 'play:tonfo']);
    expect(engine.calls[1]!.args[2]).toEqual({ key: 'audio.didascalie.tonfo' });
    expect(engine.calls[1]!.args[3]).toBe('rifiuto');
  });

  it('night:row → ora fissata, campana con la stonatura del giorno, poi i suoni del merletto', () => {
    const { bus, engine } = ctx;
    enterNight(bus, G00);
    const events: LaceEvent[] = [
      { k: 'incontro', a: 'teresa', b: 'piero', over: 'teresa', pair: 1 },
      { k: 'passa', bead: 'L1', from: 'teresa', to: 'piero' },
      { k: 'consegna', bead: 'L1', to: 'piero' },
      { k: 'legge', letter: 'L1', secret: 'letta:L1', who: 'teresa' },
    ];
    bus.emit('night:row', { hour: 7, result: { ok: true, state: state(['marta', 'piero', 'teresa']), events, violations: [] } });
    expect(engine.fns()).toEqual(['sfx:ora_fissata', 'bell', 'play:lettera', 'play:segreto']);
    expect(engine.calls[1]!.args[0]).toEqual({ hour: 7, stonatura: 1 });
    expect((engine.calls[2]!.args[1] as { delay: number }).delay).toBeCloseTo(ROW_SOUND_START);
    expect((engine.calls[3]!.args[1] as { delay: number }).delay).toBeCloseTo(ROW_SOUND_START + ROW_SOUND_STEP);
    expect(engine.calls[2]!.args[2]).toEqual({ key: 'audio.didascalie.consegna', params: { nome: 'Don Piero' } });
    // Una riga rifiutata non suona la campana.
    bus.emit('night:row', { hour: 8, result: { ok: false, state: state([]), events: [], violations: [] } });
    expect(engine.calls).toHaveLength(4);
  });

  it('spartito che si ritesse: ogni riga suona come il carillon, senza campana', () => {
    const { bus, engine } = ctx;
    enterNight(bus, G00, {}, 'replay');
    bus.emit('night:row', {
      hour: 6,
      result: { ok: true, state: state(['marta', 'teresa', 'piero']), events: [{ k: 'incontro', a: 'teresa', b: 'marta', over: 'marta', pair: 0 }], violations: [] },
    });
    bus.emit('night:row', { hour: 7, result: { ok: true, state: state(['marta', 'teresa', 'piero']), events: [], violations: [] } });
    expect(engine.fns()).toEqual(['caption', 'dyad', 'dyad']);
    expect(engine.calls[0]!.args[0]).toBe('audio.didascalie.carillon');
    expect(engine.calls[1]!.args.slice(0, 2)).toEqual(['marta', 'teresa']);
    expect(engine.calls[2]!.args).toEqual([null, null]);
  });

  it('la marea che sale suona alla riga prima dell\'acqua alta', () => {
    const { bus, engine } = ctx;
    const g19 = { ...G11, id: 'g19', tide: [{ from: 10, to: 13, places: ['molo', 'piazza'] }] } as LevelDef;
    enterNight(bus, g19);
    bus.emit('night:row', { hour: 8, result: { ok: true, state: state(G11.initial), events: [], violations: [] } });
    expect(engine.fns()).toEqual(['sfx:ora_fissata', 'bell']);
    bus.emit('night:row', { hour: 9, result: { ok: true, state: state(G11.initial), events: [], violations: [] } });
    expect(engine.fns().slice(2)).toEqual(['sfx:ora_fissata', 'bell', 'play:marea']);
  });

  it('campana dell\'Atto II stonata a 0,6', () => {
    const { bus, engine } = ctx;
    enterNight(bus, G11);
    bus.emit('night:row', { hour: 7, result: { ok: true, state: state(G11.initial), events: [], violations: [] } });
    expect(engine.calls.find((c) => c.fn === 'bell')!.args[0]).toEqual({ hour: 7, stonatura: 0.6 });
  });

  it('con animazioni istantanee i suoni del merletto si stringono', () => {
    const fast = setup({ settings: { animSpeed: 0 } });
    enterNight(fast.bus, G11);
    const events: LaceEvent[] = [
      { k: 'contagio', from: 'gino', to: 'nina' },
      { k: 'copia', bead: 'voce:ninaParte', from: 'teresa', to: 'piero' },
    ];
    fast.bus.emit('night:row', { hour: 7, result: { ok: true, state: state(G11.initial), events, violations: [] } });
    const delays = fast.engine.calls.filter((c) => c.fn === 'play').map((c) => (c.args[1] as { delay: number }).delay);
    expect(delays[1]! - delays[0]!).toBeLessThan(0.05);
  });

  it('disfa, fine della notte, pagina del Taccuino', () => {
    const { bus, engine, advance } = ctx;
    bus.emit('night:undo', { hour: 6 });
    const outcome = (ok: boolean): NightOutcome =>
      ({ requests: [{ noteId: 'n', status: ok ? 'soddisfatta' : 'fallita' }], goals: [{ status: 'soddisfatta' }] }) as unknown as NightOutcome;
    bus.emit('night:complete', { outcome: outcome(true) });
    bus.emit('night:complete', { outcome: outcome(false) });
    bus.emit('quirk:discovered', { quirk: 'martaNoSotto', thread: 'marta' });
    bus.emit('diary:new', { id: 'd1' });
    advance(1000);
    bus.emit('diary:new', { id: 'd2' });
    expect(engine.fns()).toEqual(['sfx:disfa', 'sfx:successo', 'sfx:fallimento', 'sfx:pagina', 'sfx:pagina']);
  });

  it('pausa e ripresa dell\'app, tasto Indietro', () => {
    const { bus, engine } = ctx;
    bus.emit('app:pause', {});
    bus.emit('app:resume', {});
    bus.emit('app:back', {});
    expect(engine.fns()).toEqual(['suspend', 'resume', 'sfx:ui_indietro']);
  });

  it('clic sui pulsanti dell\'interfaccia', () => {
    const { root, engine } = ctx;
    const ok = document.createElement('button');
    ok.dataset.test = 'titolo-nuova';
    const close = document.createElement('button');
    close.dataset.test = 'overlay-pausa-chiudi';
    const disabled = document.createElement('button');
    disabled.disabled = true;
    const silent = document.createElement('div');
    silent.dataset.audioSilent = '1';
    const inner = document.createElement('button');
    silent.appendChild(inner);
    const plain = document.createElement('p');
    root.append(ok, close, disabled, silent, plain);
    for (const b of [ok, close, disabled, inner, plain]) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(engine.fns()).toEqual(['sfx:ui_tap', 'sfx:ui_indietro']);
  });

  it('anteprima del volume degli effetti', () => {
    const { bus, engine, auto, advance } = ctx;
    const s = defaultSettings();
    auto.primeVolumes(s.volume);
    bus.emit('settings:change', { ...s, volume: { ...s.volume, sfx: 0.5 } });
    bus.emit('settings:change', { ...s, volume: { ...s.volume, sfx: 0.4 } });
    advance(200);
    bus.emit('settings:change', { ...s, volume: { ...s.volume, sfx: 0.3 } });
    bus.emit('settings:change', { ...s, highContrast: true, volume: { ...s.volume, sfx: 0.3 } });
    expect(engine.fns()).toEqual(['sfx:ui_tap', 'sfx:ui_tap']);
  });

  it('contesto del gioco per il motore', () => {
    const { bus, auto } = ctx;
    expect(auto.levelId()).toBeNull();
    expect(auto.clockStopped()).toBe(false);
    enterNight(bus, G00);
    expect(auto.levelId()).toBe('g00');
    expect(auto.clockStopped()).toBe(true);
    expect(auto.presentCharacters()).toEqual(['teresa', 'marta', 'piero']);
    expect(auto.musicSeed()).toBe('g00');
    enterNight(bus, G11);
    expect(auto.clockStopped()).toBe(false);
    expect(auto.musicSeed()).toBe('nodo');
    expect(auto.presentCharacters()).toContain('livia');
    expect(auto.stonatureInUse().sort()).toEqual([0, 0.25, 0.6, 1]);
  });

  it('install() restituisce la disiscrizione', () => {
    const { bus, engine, off } = ctx;
    off();
    bus.emit('app:pause', {});
    expect(engine.calls).toHaveLength(0);
  });
});
