/**
 * Banco di prova offline: gira nel browser (Chromium headless), rende ogni suono con un
 * OfflineAudioContext attraverso il vero AudioEngine e ne misura il segnale.
 * Viene impacchettato con esbuild ed esposto come `window.bancoAudio`.
 */
import { AudioEngine } from '../../src/motore';
import { RAGGIO_INTERNO } from '../../src/costanti';
import type { EventoAudio, NomeBus, StatoAudio, TemaMusicale, Vec3 } from '../../src/tipi';
import type { NomeStrato } from '../../src/motore';

export interface Prova {
  id: string;
  durata: number;
  /** Strati d'ambiente attivi (predefinito: no, si misura il solo evento). */
  ambienti?: boolean;
  stato?: Partial<StatoAudio> & { thetaGradi?: number; quota?: number; zeta?: number };
  eventi?: { t: number; e: EventoAudio }[];
  tema?: TemaMusicale;
  limitatore?: boolean;
}

export interface Misura {
  id: string;
  durata: number;
  picco: number;
  piccoDb: number;
  rms: number;
  rmsDb: number;
  /** RMS sulle sole parti attive (sopra −80 dBFS). */
  rmsAttivoDb: number;
  /** Frazione dell'energia sopra 6 kHz (indice di «stridore»). */
  acuti: number;
  continua: number;
  nan: number;
  campioniSaturi: number;
  msRendering: number;
  wav?: string;
}

/** Posizione nel cilindro da θ (gradi), z e altezza dal suolo. */
export function posizione(thetaGradi: number, z: number, altezza: number): Vec3 {
  const r = RAGGIO_INTERNO - altezza;
  const a = (thetaGradi * Math.PI) / 180;
  return { x: r * Math.cos(a), y: r * Math.sin(a), z };
}

const ev = (e: EventoAudio, t = 0.05): { t: number; e: EventoAudio } => ({ t, e });

export const PROVE: Prova[] = [
  // --- effetti ---
  { id: 'passo-erba', durata: 0.6, eventi: [ev({ tipo: 'passo', superficie: 'erba' })] },
  { id: 'passo-pietra', durata: 0.6, eventi: [ev({ tipo: 'passo', superficie: 'pietra' })] },
  { id: 'passo-legno', durata: 0.6, eventi: [ev({ tipo: 'passo', superficie: 'legno' })] },
  { id: 'passo-ghiaia', durata: 0.6, eventi: [ev({ tipo: 'passo', superficie: 'ghiaia' })] },
  {
    id: 'passo-posizionale',
    durata: 0.6,
    eventi: [ev({ tipo: 'passo', superficie: 'pietra', posizione: posizione(45.4, 1052, 0) })],
  },
  { id: 'salto', durata: 0.8, eventi: [ev({ tipo: 'salto', superficie: 'erba' })] },
  { id: 'atterraggio', durata: 0.9, eventi: [ev({ tipo: 'atterraggio', superficie: 'ghiaia', velocita: 11 })] },
  { id: 'velo-apri', durata: 1.4, eventi: [ev({ tipo: 'velo-apri' })] },
  { id: 'velo-chiudi', durata: 1.2, eventi: [ev({ tipo: 'velo-chiudi' })] },
  { id: 'squadro-pianta', durata: 2.5, eventi: [ev({ tipo: 'squadro-pianta' })] },
  { id: 'bolla-livellata', durata: 2.5, eventi: [ev({ tipo: 'bolla-livellata' })] },
  { id: 'inchiostro', durata: 5.5, eventi: [ev({ tipo: 'inchiostro', ampiezza: 1 })] },
  { id: 'pagina-avanti', durata: 0.9, eventi: [ev({ tipo: 'pagina', verso: 'avanti' })] },
  { id: 'pagina-indietro', durata: 0.9, eventi: [ev({ tipo: 'pagina', verso: 'indietro' })] },
  { id: 'fade-carillon', durata: 4, eventi: [ev({ tipo: 'fade', varieta: 'carillon' })] },
  { id: 'fade-ronzio', durata: 3.5, eventi: [ev({ tipo: 'fade', varieta: 'ronzio' })] },
  { id: 'fade-pietra', durata: 1.5, eventi: [ev({ tipo: 'fade', varieta: 'pietra' })] },
  { id: 'api', durata: 5.5, eventi: [ev({ tipo: 'api', durata: 4 })] },
  { id: 'campane-ore', durata: 14, eventi: [ev({ tipo: 'campane', modo: 'ore', ore: 3 })] },
  { id: 'campane-rintocco', durata: 8, eventi: [ev({ tipo: 'campane', modo: 'rintocco' })] },
  { id: 'campane-festa', durata: 18, eventi: [ev({ tipo: 'campane', modo: 'festa' })] },
  {
    id: 'campane-lontane',
    durata: 9,
    eventi: [ev({ tipo: 'campane', modo: 'rintocco', posizione: posizione(30, 1100, 30) })],
  },
  { id: 'accensione-linea', durata: 10, eventi: [ev({ tipo: 'accensione-linea' })] },
  { id: 'ui-clic', durata: 0.4, eventi: [ev({ tipo: 'interfaccia', varieta: 'clic' })] },
  { id: 'ui-sopra', durata: 0.3, eventi: [ev({ tipo: 'interfaccia', varieta: 'sopra' })] },
  { id: 'ui-conferma', durata: 1, eventi: [ev({ tipo: 'interfaccia', varieta: 'conferma' })] },
  { id: 'ui-annulla', durata: 1, eventi: [ev({ tipo: 'interfaccia', varieta: 'annulla' })] },
  { id: 'ui-apri', durata: 0.6, eventi: [ev({ tipo: 'interfaccia', varieta: 'apri' })] },
  { id: 'ui-chiudi', durata: 0.6, eventi: [ev({ tipo: 'interfaccia', varieta: 'chiudi' })] },
  // --- ambienti ---
  { id: 'amb-giorno-valle', durata: 8, ambienti: true, stato: { ora: 12 } },
  { id: 'amb-alba-uccelli', durata: 8, ambienti: true, stato: { ora: 6.5 } },
  { id: 'amb-notte-grilli', durata: 8, ambienti: true, stato: { ora: 22.5 } },
  { id: 'amb-vento-alto', durata: 6, ambienti: true, stato: { ora: 14, quota: 260, velocita: 24, inVolo: true } },
  { id: 'amb-volo-basso', durata: 6, ambienti: true, stato: { ora: 10, quota: 35, velocita: 14, inVolo: true } },
  { id: 'amb-finestra', durata: 14, ambienti: true, stato: { ora: 14, thetaGradi: 105 } },
  { id: 'amb-lago', durata: 8, ambienti: true, stato: { ora: 15, thetaGradi: 160, distanzaLago: 2 } },
  { id: 'amb-sordo', durata: 8, ambienti: true, stato: { ora: 11, zeta: 2960 } },
  { id: 'amb-fade-notte', durata: 10, ambienti: true, stato: { ora: 23, fadeVicine: 1 } },
  { id: 'amb-brace', durata: 6, ambienti: true, stato: { ora: 2, thetaGradi: 260 } },
  // --- musica ---
  { id: 'tema-alba', durata: 30, tema: 'alba' },
  { id: 'tema-primo-volo', durata: 27, tema: 'primo-volo' },
  { id: 'tema-primo-rilievo', durata: 16, tema: 'primo-rilievo' },
  { id: 'tema-notte-fade', durata: 41, tema: 'notte-fade' },
  // --- tutto insieme, senza limitatore: ci deve essere margine ---
  {
    id: 'mix-tutto',
    durata: 12,
    ambienti: true,
    tema: 'primo-volo',
    stato: { ora: 7, quota: 2, velocita: 3, fadeVicine: 0.5, distanzaLago: 20 },
    eventi: [
      ev({ tipo: 'passo', superficie: 'ghiaia', forza: 1.2 }, 0.2),
      ev({ tipo: 'atterraggio', superficie: 'pietra', velocita: 14 }, 0.5),
      ev({ tipo: 'campane', modo: 'festa' }, 0.6),
      ev({ tipo: 'inchiostro', ampiezza: 1 }, 1),
      ev({ tipo: 'squadro-pianta' }, 1.2),
      ev({ tipo: 'velo-apri' }, 2),
      ev({ tipo: 'api', durata: 4 }, 2.5),
      ev({ tipo: 'accensione-linea' }, 3),
    ],
  },
];

function biquadPassaAlto(x: Float32Array, sr: number, f0: number): Float32Array {
  const w = (2 * Math.PI * f0) / sr;
  const alfa = Math.sin(w) / (2 * Math.SQRT1_2);
  const cw = Math.cos(w);
  const a0 = 1 + alfa;
  const b0 = (1 + cw) / 2 / a0,
    b1 = -(1 + cw) / a0,
    b2 = (1 + cw) / 2 / a0,
    a1 = (-2 * cw) / a0,
    a2 = (1 - alfa) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i] as number;
    const yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    y[i] = yi;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
  }
  return y;
}

function misura(id: string, buf: AudioBuffer, ms: number): Misura {
  let picco = 0,
    somma = 0,
    sommaAttiva = 0,
    nAttivi = 0,
    media = 0,
    nan = 0,
    saturi = 0,
    eTot = 0,
    eAcuti = 0;
  const n = buf.length * buf.numberOfChannels;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const x = buf.getChannelData(c);
    const hp = biquadPassaAlto(x, buf.sampleRate, 6000);
    for (let i = 0; i < x.length; i++) {
      const v = x[i] as number;
      if (!Number.isFinite(v)) {
        nan++;
        continue;
      }
      const a = Math.abs(v);
      if (a > picco) picco = a;
      if (a >= 0.999) saturi++;
      somma += v * v;
      media += v;
      eTot += v * v;
      const h = hp[i] as number;
      if (Number.isFinite(h)) eAcuti += h * h;
    }
    // RMS sulle finestre attive da 10 ms
    const fin = Math.floor(buf.sampleRate * 0.01);
    for (let i = 0; i + fin <= x.length; i += fin) {
      let s = 0;
      for (let j = i; j < i + fin; j++) s += (x[j] as number) ** 2;
      const r = Math.sqrt(s / fin);
      if (r > 1e-4) {
        sommaAttiva += s;
        nAttivi += fin;
      }
    }
  }
  const rms = Math.sqrt(somma / n);
  const rmsAttivo = nAttivi ? Math.sqrt(sommaAttiva / nAttivi) : 0;
  const db = (g: number): number => (g > 0 ? Math.round(20 * Math.log10(g) * 10) / 10 : -Infinity);
  return {
    id,
    durata: buf.duration,
    picco,
    piccoDb: db(picco),
    rms,
    rmsDb: db(rms),
    rmsAttivoDb: db(rmsAttivo),
    acuti: eTot > 0 ? eAcuti / eTot : 0,
    continua: media / n,
    nan,
    campioniSaturi: saturi,
    msRendering: Math.round(ms),
  };
}

function aWav(buf: AudioBuffer): string {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const dati = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const scrivi = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) dati.setUint8(o + i, s.charCodeAt(i));
  };
  scrivi(0, 'RIFF');
  dati.setUint32(4, 36 + n * ch * 2, true);
  scrivi(8, 'WAVE');
  scrivi(12, 'fmt ');
  dati.setUint32(16, 16, true);
  dati.setUint16(20, 1, true);
  dati.setUint16(22, ch, true);
  dati.setUint32(24, buf.sampleRate, true);
  dati.setUint32(28, buf.sampleRate * ch * 2, true);
  dati.setUint16(32, ch * 2, true);
  dati.setUint16(34, 16, true);
  scrivi(36, 'data');
  dati.setUint32(40, n * ch * 2, true);
  const canali = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, (canali[c] as Float32Array)[i] as number));
      dati.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  const byte = new Uint8Array(dati.buffer);
  let s = '';
  for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function rendi(
  id: string,
  opz: {
    wav?: boolean;
    sr?: number;
    strati?: NomeStrato[];
    muto?: boolean;
    volumi?: Partial<Record<NomeBus, number>>;
    limitatore?: boolean;
  } = {},
): Promise<Misura> {
  const prova = PROVE.find((p) => p.id === id);
  if (!prova) throw new Error(`prova sconosciuta: ${id}`);
  const sr = opz.sr ?? 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(prova.durata * sr), sr);
  const motore = new AudioEngine({
    contesto: ctx,
    seme: 20260 + id.length * 31,
    limitatore: opz.limitatore ?? prova.limitatore ?? false,
    ambienti: prova.ambienti === true,
    ...(opz.strati ? { strati: opz.strati } : {}),
    musicaAlba: false,
    battito: false,
  });
  if (opz.muto) motore.mixer.muto = true;
  for (const [bus, v] of Object.entries(opz.volumi ?? {})) motore.mixer.imposta(bus as NomeBus, v);
  await motore.avvia();
  const s = prova.stato ?? {};
  const stato: StatoAudio = {
    posizione: posizione(s.thetaGradi ?? 45, s.zeta ?? 1050, s.quota ?? 1.7),
    velocita: s.velocita ?? 0,
    ora: s.ora ?? 12,
    inVolo: s.inVolo ?? false,
    ...(s.distanzaLago !== undefined ? { distanzaLago: s.distanzaLago } : {}),
    ...(s.fadeVicine !== undefined ? { fadeVicine: s.fadeVicine } : {}),
  };
  motore.aggiorna(stato);
  if (prova.tema) motore.suonaTema(prova.tema, { forza: true });
  // Calendario per blocchi da 128 campioni: a ogni passo di 0,1 s si aggiorna lo stato
  // (come farebbe il gioco a ogni fotogramma); gli eventi partono al loro istante.
  const calendario = new Map<number, (() => void)[]>();
  const aggiungi = (t: number, f: () => void): void => {
    const q = Math.max(1, Math.round((t * sr) / 128));
    if (q * 128 >= ctx.length) return;
    const l = calendario.get(q) ?? [];
    l.push(f);
    calendario.set(q, l);
  };
  for (let x = 0.1; x < prova.durata - 0.01; x += 0.1) aggiungi(x, () => motore.aggiorna(stato));
  for (const e of prova.eventi ?? []) {
    if (e.t <= 0) motore.evento(e.e);
    else aggiungi(e.t, () => motore.evento(e.e));
  }
  for (const [q, azioni] of calendario) {
    void ctx.suspend((q * 128) / sr).then(() => {
      for (const a of azioni) a();
      void ctx.resume();
    });
  }
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  const m = misura(id, buf, performance.now() - t0);
  if (opz.wav) m.wav = aWav(buf);
  return m;
}

/**
 * Prova del ciclo di vita con un AudioContext vero: avvio, aggiornamenti, eventi,
 * pausa (contesto sospeso), ripresa, distruzione (contesto chiuso).
 */
export async function provaCicloDiVita(): Promise<Record<string, string | number | boolean>> {
  const esito: Record<string, string | number | boolean> = {};
  const motore = new AudioEngine({ seme: 7 });
  esito.statoIniziale = motore.stato;
  esito.eventoPrimaDellAvvio = motore.evento({ tipo: 'interfaccia', varieta: 'clic' });
  await motore.avvia();
  esito.statoAvviato = motore.stato;
  esito.contesto = (motore.contesto as AudioContext).state;
  const stato: StatoAudio = { posizione: posizione(45, 1050, 1.7), velocita: 2, ora: 5.4 };
  for (let i = 0; i < 30; i++) {
    stato.ora += 0.01; // attraversa l'accensione della Linea (5,5)
    motore.aggiorna(stato, 1 / 60);
    await new Promise((r) => setTimeout(r, 16));
  }
  esito.durataPasso = motore.evento({ tipo: 'passo', superficie: 'legno' });
  esito.temaAccettato = motore.suonaTema('primo-volo');
  esito.temaRifiutato = motore.suonaTema('alba');
  esito.temaInCorso = motore.temaInCorso ?? '';
  const sorgente = motore.creaSorgente(posizione(46, 1060, 2), { bus: 'voci' });
  esito.sorgente = sorgente !== null;
  sorgente?.posiziona(posizione(47, 1070, 2));
  sorgente?.rilascia();
  motore.impostaVolume('musica', 0.2);
  esito.volumeMusica = motore.volume('musica');
  motore.pausa();
  esito.statoPausa = motore.stato;
  esito.eventoInPausa = motore.evento({ tipo: 'passo', superficie: 'erba' });
  await new Promise((r) => setTimeout(r, 400));
  esito.contestoInPausa = (motore.contesto as AudioContext).state;
  await motore.riprendi();
  esito.statoRipreso = motore.stato;
  esito.contestoRipreso = (motore.contesto as AudioContext).state;
  const ctx = motore.contesto as AudioContext;
  await motore.distruggi();
  esito.statoFinale = motore.stato;
  esito.contestoFinale = ctx.state;
  return esito;
}

declare global {
  interface Window {
    bancoAudio: {
      elenco: () => string[];
      rendi: typeof rendi;
      provaCicloDiVita: typeof provaCicloDiVita;
    };
  }
}

window.bancoAudio = { elenco: () => PROVE.map((p) => p.id), rendi, provaCicloDiVita };
