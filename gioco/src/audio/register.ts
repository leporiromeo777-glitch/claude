/**
 * Pacchetto audio (ARCHITETTURA 5.6, 11; GDD 13): crea il motore procedurale, lo
 * registra al posto dello stub (registerAudio), collega i suoni automatici agli
 * eventi del bus, l'overlay "Tocca per continuare" e il debug `__GAME__.audio`.
 *
 * Debug (`window.__GAME__.audio`, ARCHITETTURA 15.1 più qualche aiuto per i test):
 *   state()            'locked' | 'running' | 'suspended'
 *   log()              ultimi 200 suoni richiesti { id, t, detail? } (anche senza contesto)
 *   mute(on)           silenzia tutto (true) o riaccende (false); restituisce lo stato
 *   stats()            sorgenti attive e picco, pre-render (cpuMs), musica, ambiente…
 *   captions()         ultime didascalie emesse
 *   sfx(id) · bell(ora, s?) · note(chi) · crossing(sopra, sotto, rancore?) · babble(chi, testo)
 *   music(stato, seme?) · ambience(id) · duck(on)
 *   stress(n)          n effetti di fila (limitatore: picco ≤ 48)
 *   verify(secondi?)   rendering offline di ogni SfxId: RMS, NaN, picco
 *   blocked()          l'overlay "Tocca per continuare" è richiesto?
 *   interrupt()        simula un'interruzione del sistema (il contesto si ferma da solo)
 */
import type { AmbienceId, CharacterId, MusicState, Services, SfxId } from '../core/types';
import { registerAudio } from '../core/services';
import { WebAudioEngine } from './engine';
import { AudioAutomation } from './automation';
import { AutoplayOverlay } from './autoplay';
import { characterStyleKey, shortNameKey } from './captions';
import { verifyOffline } from './verify';

export function register(s: Services): WebAudioEngine {
  const nameOf = (who: CharacterId | 'lino'): string => {
    if (who !== 'lino') {
      const def = s.content.characters.get(who);
      if (def?.nameKey && s.i18n.has(def.nameKey)) return s.i18n.t(def.nameKey);
    }
    return s.i18n.t(shortNameKey(who));
  };
  const characters = (): typeof s.content.characters | null => (s.content.characters.size > 0 ? s.content.characters : null);

  let automation: AudioAutomation | null = null;
  let overlay: AutoplayOverlay | null = null;

  const engine = new WebAudioEngine({
    caption: (textKey, params) => s.bus.emit('audio:caption', params ? { textKey, params } : { textKey }),
    nameOf,
    styleOf: (who) => s.i18n.t(characterStyleKey(who)),
    characters,
    game: {
      stonatura: () => automation?.stonatura() ?? 1,
      stonatureInUse: () => automation?.stonatureInUse() ?? [1, 0.6, 0.25, 0],
      presentCharacters: () => automation?.presentCharacters() ?? [],
      musicSeed: () => automation?.musicSeed() ?? '',
      clockStopped: () => automation?.clockStopped() ?? false,
    },
    visible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    onBlocked: (blocked) => {
      if (blocked) overlay?.show();
      else overlay?.hide();
    },
  });

  automation = new AudioAutomation({
    bus: s.bus,
    engine,
    content: () => s.content,
    save: () => s.save.data(),
    settings: () => s.settings.get(),
    nameOf,
    uiRoot: s.ui.root,
  });
  automation.primeVolumes(s.settings.get().volume);
  automation.install();

  overlay = new AutoplayOverlay({
    root: s.ui.root,
    input: s.input,
    t: (k) => s.i18n.t(k),
    // Dentro il gesto: crea o riprende il contesto in modo sincrono.
    onTap: () => {
      engine.unlock();
      engine.resume();
    },
  });

  registerAudio(engine);

  const auto = automation;
  s.debug.register('audio', {
    state: () => engine.state(),
    log: () => engine.log(),
    mute: (on?: boolean) => engine.mute(on !== false),
    stats: () => engine.stats(),
    captions: () => engine.captions(),
    sfx: (id: SfxId) => {
      engine.sfx(id);
      return engine.state();
    },
    bell: (hour?: number, stonatura?: number) => {
      engine.bell({ hour: hour ?? 9, stonatura: stonatura ?? auto.stonatura() });
      return engine.state();
    },
    note: (who: CharacterId | 'lino') => {
      engine.note(who);
      return engine.noteHz(who);
    },
    crossing: (over: CharacterId | 'lino', under: CharacterId | 'lino', rancor?: boolean) => {
      engine.crossing(over, under, { rancor: !!rancor });
      return engine.state();
    },
    babble: (who: CharacterId, text: string) => {
      engine.babble(who, text);
      return engine.state();
    },
    music: (state: MusicState, seed?: string) => {
      engine.setMusic(state, seed ? { seed } : {});
      return state;
    },
    ambience: (id: AmbienceId) => {
      engine.setAmbience(id);
      return id;
    },
    duck: (on?: boolean) => {
      engine.duck(on !== false);
      return engine.stats().ducked;
    },
    stress: (n?: number) => engine.stress(n ?? 200),
    verify: (seconds?: number) => verifyOffline({ seconds: seconds ?? 2, characters }),
    blocked: () => engine.isBlocked(),
    interrupt: () => {
      engine.simulateInterruption();
      return true;
    },
    stonatura: () => auto.stonatura(),
  });
  return engine;
}
