/**
 * Verifica offline (criterio di accettazione del pacchetto): ogni SfxId, reso per 2 s
 * con OfflineAudioContext attraverso lo stesso grafo del gioco (bus, master,
 * compressore), deve avere RMS > 0,001, nessun NaN e picco ≤ 1,0. Si provano anche
 * campana, incroci, borbottio, carillon, ambienti e stati della musica (non obbligatori).
 *
 * Si chiama dal browser: `await __GAME__.audio.verify()`.
 */
import type { AmbienceId, CarillonScore, CharacterId, MusicState } from '../core/types';
import { applyVolumes, createGraph } from './graph';
import { SoundBank } from './bank';
import { VoiceLimiter, MAX_VOICES } from './voices';
import { Player } from './player';
import { MusicTrack } from './music';
import { AmbienceTrack } from './ambience';
import { CarillonTrack, carillonEvents } from './carillon';
import { SFX_IDS } from './synth/sfx';
import type { Rand } from './synth/dsp';
import type { CharacterLookup } from './synth/musicbox';
import { type VoiceLookup, planBabble, styleFor } from './synth/babble';
import { CHARACTER_IDS } from '../core/ids';

export const VERIFY_MIN_RMS = 0.001;
export const VERIFY_MAX_PEAK = 1.0;

export interface VerifyResult {
  id: string;
  /** true per gli SfxId (criterio di accettazione), false per i controlli in più. */
  required: boolean;
  rms: number;
  peak: number;
  nan: boolean;
  ok: boolean;
  /** Durata del rendering (ms). */
  ms: number;
}

export interface VerifyReport {
  ok: boolean;
  seconds: number;
  sampleRate: number;
  results: VerifyResult[];
  failures: string[];
  ms: number;
}

type Case = { id: string; required: boolean; run: (p: Player, seconds: number) => void };

const PROLOGO: CarillonScore = {
  beatMs: 380,
  rows: [[['marta', 'teresa']], [['teresa', 'piero']], [['piero', 'teresa']], [['marta', 'teresa']], []],
};

function cases(): Case[] {
  const out: Case[] = SFX_IDS.map((id) => ({ id, required: true, run: (p: Player) => void p.sfx(id) }));
  out.push(
    { id: 'campana:1', required: false, run: (p) => void p.bell(1) },
    { id: 'campana:0', required: false, run: (p) => void p.bell(0) },
    {
      id: 'incrocio:marta/teresa',
      required: false,
      run: (p) => p.crossing(p.bank.noteHz('marta'), p.bank.noteHz('teresa')),
    },
    {
      id: 'incrocio-rancore:marta/teresa',
      required: false,
      run: (p) => p.crossing(p.bank.noteHz('marta'), p.bank.noteHz('teresa'), { rancor: true }),
    },
    {
      id: 'borbottio:teresa',
      required: false,
      run: (p) => {
        const v = p.bank.voice('teresa');
        if (v) void p.play(p.bank.babble(planBabble('Buongiorno, cara! Hai visto chi arriva?', v, { style: styleFor('teresa') }), v), { bus: 'voci', kind: 'voice' });
      },
    },
    { id: 'penna:clotilde', required: false, run: (p) => void p.play(p.bank.pen('Chi tesse non è tessuto.'), { bus: 'voci', kind: 'voice' }) },
    {
      id: 'carillon:prologo',
      required: false,
      run: (p, seconds) => new CarillonTrack(p, carillonEvents(PROLOGO), 0, (w) => p.bank.noteHz(w)).schedule(0, seconds),
    },
  );
  for (const a of ['laguna', 'notte', 'pioggia', 'vento', 'tempesta'] as AmbienceId[]) {
    out.push({
      id: `ambiente:${a}`,
      required: false,
      run: (p, seconds) => {
        const t = new AmbienceTrack({ player: p, rand: Math.random, clockStopped: () => false });
        t.set(a);
        t.schedule(0, seconds);
      },
    });
  }
  for (const m of ['titolo', 'sera', 'notte', 'alba', 'archivio', 'finale'] as MusicState[]) {
    out.push({
      id: `musica:${m}`,
      required: false,
      run: (p, seconds) => {
        const t = new MusicTrack({
          player: p,
          noteHz: (w) => p.bank.noteHz(w),
          defaultNotes: () => ['teresa', 'marta', 'piero'],
          defaultSeed: () => 'g00',
          stonatura: () => 1,
          allCharacters: () => CHARACTER_IDS.filter((c) => p.bank.noteHz(c) !== null) as CharacterId[],
        });
        t.set(m, { seed: 'g00' });
        t.schedule(0, seconds);
      },
    });
  }
  return out;
}

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

export async function verifyOffline(
  o: { seconds?: number; sampleRate?: number; rand?: Rand; characters?: () => (CharacterLookup & VoiceLookup) | null; only?: 'sfx' | 'all' } = {},
): Promise<VerifyReport> {
  const seconds = o.seconds ?? 2;
  const sr = o.sampleRate ?? 44100;
  const g = globalThis as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor };
  const Ctor = g.OfflineAudioContext ?? g.webkitOfflineAudioContext;
  const t0 = performance.now();
  if (!Ctor) return { ok: false, seconds, sampleRate: sr, results: [], failures: ['OfflineAudioContext unavailable'], ms: 0 };
  const results: VerifyResult[] = [];
  const failures: string[] = [];
  const list = cases().filter((c) => o.only !== 'sfx' || c.required);
  for (const c of list) {
    const c0 = performance.now();
    let rms = 0;
    let peak = 0;
    let nan = false;
    try {
      const ctx = new Ctor(2, Math.round(seconds * sr), sr);
      const graph = createGraph(ctx);
      applyVolumes(graph, { master: 1, music: 1, sfx: 1, voice: 1 }, false, true);
      const limiter = new VoiceLimiter(() => ctx.currentTime, MAX_VOICES);
      const bank = new SoundBank(ctx, { rand: o.rand ?? Math.random, characters: o.characters ?? (() => null) });
      const player = new Player(graph, bank, limiter, o.rand ?? Math.random);
      c.run(player, seconds);
      const buf = await ctx.startRendering();
      let sum = 0;
      let n = 0;
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < d.length; i++) {
          const v = d[i]!;
          if (!Number.isFinite(v)) {
            nan = true;
            continue;
          }
          sum += v * v;
          const a = Math.abs(v);
          if (a > peak) peak = a;
        }
        n += d.length;
      }
      rms = n > 0 ? Math.sqrt(sum / n) : 0;
    } catch (err) {
      nan = true;
      failures.push(`${c.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    const ok = !nan && rms > VERIFY_MIN_RMS && peak <= VERIFY_MAX_PEAK;
    if (!ok && c.required) failures.push(`${c.id}: rms=${rms.toFixed(5)} peak=${peak.toFixed(3)} nan=${nan}`);
    results.push({ id: c.id, required: c.required, rms, peak, nan, ok, ms: Math.round(performance.now() - c0) });
  }
  return {
    ok: failures.length === 0,
    seconds,
    sampleRate: sr,
    results,
    failures,
    ms: Math.round(performance.now() - t0),
  };
}
