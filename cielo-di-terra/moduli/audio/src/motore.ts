/**
 * AudioEngine: il motore audio di «Cielo di Terra».
 *
 * Grafo:
 *   strati d'ambiente ─▶ bus «ambiente» ─┐
 *   effetti, Velo     ─▶ bus «effetti»  ─┤
 *   voci del gioco    ─▶ bus «voci»     ─┼─▶ «generale» ─▶ limitatore ─▶ analizzatore ─▶ uscita
 *   temi musicali     ─▶ bus «musica» ─▶ passa-alto ─┘
 *   ogni bus ha anche una mandata ─▶ riverbero condiviso (convoluzione procedurale) ─▶ «generale»
 *
 * Tutto è sintetizzato: nessun file audio.
 */
import { LUNGHEZZA_CILINDRO, ORA_ACCENSIONE, ORA_TEMA_ALBA, RAGGIO_INTERNO } from './costanti';
import {
  calcolaParametriAmbiente,
  haAttraversato,
  orientamentoAscoltatore,
  suVersoAsse,
  type ParametriAmbiente,
} from './mappature';
import { Mixer } from './mixer';
import type {
  EventoAudio,
  NomeBus,
  OpzioniSorgente,
  SorgentePosizionale,
  StatoAudio,
  StatoMotore,
  TemaMusicale,
  Vec3,
} from './tipi';
import { creaRng, distanza, type Rng } from './util';
import { Kit, pulisciA, type Destinazione } from './sintesi/kit';
import type { Ascoltatore, ContestoStrato, ProfiloSpaziale, Strato } from './ambienti/strato';
import { StratoLinea, StratoVento, StratoVolo } from './ambienti/aria';
import { StratoFade, StratoFauna } from './ambienti/vita';
import { StratoFinestre, StratoLago, StratoSordo } from './ambienti/luoghi';
import { atterraggio, passo, salto } from './effetti/passi';
import { veloApri, veloChiudi } from './effetti/velo';
import { bollaLivellata, inchiostro, pagina, squadroPianta } from './effetti/rilievo';
import { api, fade } from './effetti/notte';
import { batteOre, festa, rintocco } from './effetti/campane';
import { interfaccia } from './effetti/interfaccia';
import { accensioneLinea, DURATA_ACCENSIONE } from './effetti/linea';
import { LettoreMusica } from './musica/lettore';
import { RegiaMusica } from './musica/regia';
import { generaTema } from './musica/temi';

/** Opzioni del motore. */
export interface OpzioniMotore {
  /**
   * Contesto da usare (per esempio un OfflineAudioContext nei test). Se manca,
   * `avvia()` crea un AudioContext: va chiamato dentro un gesto dell'utente.
   */
  contesto?: BaseAudioContext;
  /** Seme del generatore casuale (predefinito: l'ora corrente). */
  seme?: number;
  /** Limitatore dolce sull'uscita (predefinito true). */
  limitatore?: boolean;
  /** Crea gli strati d'ambiente (predefinito true). */
  ambienti?: boolean;
  /** Quali strati d'ambiente creare (predefinito: tutti). Utile per prove e per scene particolari. */
  strati?: readonly NomeStrato[];
  /** Fa partire da solo il tema dell'alba (predefinito true). */
  musicaAlba?: boolean;
  /** Il campanile di San Vigilio: posizione e se batte le ore da solo. */
  campanile?: { posizione: Vec3; orarie: boolean } | null;
  /**
   * Timer interno (100 ms) che continua a pianificare musica ed eventi d'ambiente anche
   * se `aggiorna` non viene chiamato. Predefinito: true con un AudioContext reale.
   */
  battito?: boolean;
}

/** Gli strati d'ambiente. */
export type NomeStrato = 'vento' | 'volo' | 'linea' | 'fauna' | 'lago' | 'sordo' | 'finestre' | 'fade';
export const NOMI_STRATI: readonly NomeStrato[] = ['vento', 'volo', 'linea', 'fauna', 'lago', 'sordo', 'finestre', 'fade'];

type BusFiglio = Exclude<NomeBus, 'generale'>;
interface Bus {
  ingresso: GainNode;
  mandata: GainNode;
}

/** Profili spaziali dei suoni posizionati. */
const PROFILI = {
  passo: { rif: 3, max: 200, rolloff: 1.2 },
  oggetto: { rif: 3, max: 300, rolloff: 1 },
  direzione: { rif: 1, max: 10000, rolloff: 0 },
  fade: { rif: 4, max: 400, rolloff: 1 },
  api: { rif: 3, max: 300, rolloff: 1.1 },
  campane: { rif: 80, max: 4000, rolloff: 0.7 },
} as const satisfies Record<string, ProfiloSpaziale>;

function eAudioContext(ctx: BaseAudioContext): ctx is AudioContext {
  return typeof (ctx as AudioContext).resume === 'function' && typeof (ctx as AudioContext).suspend === 'function' && !('startRendering' in ctx);
}

export class AudioEngine {
  /** Logica del mixer (volumi dei cursori, muto, pausa). */
  readonly mixer = new Mixer();

  private ctx: BaseAudioContext | null = null;
  private propriContesto = false;
  private _stato: StatoMotore = 'spento';
  private kit: Kit | null = null;
  private bus: Record<BusFiglio, Bus> | null = null;
  private generale: GainNode | null = null;
  private ultimaDurataTema = 0;
  private analizzatore: AnalyserNode | null = null;
  private nodiFissi: AudioNode[] = [];
  private strati: Strato[] = [];
  private lettore: LettoreMusica | null = null;
  private readonly regia = new RegiaMusica();
  private readonly rng: Rng;
  private asc: Ascoltatore = {
    posizione: { x: RAGGIO_INTERNO - 1.7, y: 0, z: 1000 },
    avanti: { x: 0, y: 0, z: 1 },
    su: { x: -1, y: 0, z: 0 },
    altezza: 1.7,
  };
  private ultimiParametri: ParametriAmbiente | null = null;
  private oraPrecedente: number | null = null;
  private ultimoAggStrati = -Infinity;
  private timer: ReturnType<typeof setInterval> | null = null;
  private timerSospensione: ReturnType<typeof setTimeout> | null = null;
  private campanile: { posizione: Vec3; orarie: boolean } | null;
  private avvioInCorso: Promise<void> | null = null;

  constructor(private readonly opz: OpzioniMotore = {}) {
    this.rng = creaRng(opz.seme ?? (Date.now() >>> 0));
    this.campanile = opz.campanile ?? null;
  }

  // -------------------------------------------------------------------------
  // Stato
  // -------------------------------------------------------------------------

  /** 'spento' finché non si chiama avvia(), poi 'attivo' o 'in-pausa'. */
  get stato(): StatoMotore {
    return this._stato;
  }

  /** Il contesto Web Audio (null prima dell'avvio). */
  get contesto(): BaseAudioContext | null {
    return this.ctx;
  }

  /** Gli ultimi parametri d'ambiente calcolati (per debug e per la demo). */
  get parametri(): ParametriAmbiente | null {
    return this.ultimiParametri;
  }

  /** Analizzatore sull'uscita finale (per misuratori di livello). */
  get analizzatoreUscita(): AnalyserNode | null {
    return this.analizzatore;
  }

  /** Il tema musicale in corso, se c'è. */
  get temaInCorso(): TemaMusicale | null {
    return this.ctx ? this.regia.inCorso(this.ctx.currentTime) : null;
  }

  // -------------------------------------------------------------------------
  // Avvio, pausa, chiusura
  // -------------------------------------------------------------------------

  /**
   * Avvia l'audio. Con un AudioContext reale va chiamato dentro un gesto dell'utente
   * (clic, tasto, tocco): il contesto viene creato e ripreso in modo sincrono.
   */
  avvia(): Promise<void> {
    if (this._stato === 'distrutto') return Promise.reject(new Error('AudioEngine distrutto'));
    if (this.avvioInCorso) return this.avvioInCorso;
    if (this._stato !== 'spento') {
      const c = this.ctx;
      if (c && eAudioContext(c) && c.state === 'suspended' && this._stato === 'attivo') return c.resume();
      return Promise.resolve();
    }
    let ctx = this.opz.contesto;
    if (!ctx) {
      const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Costruttore = g.AudioContext ?? g.webkitAudioContext;
      if (!Costruttore) return Promise.reject(new Error('Web Audio API non disponibile'));
      ctx = new Costruttore({ latencyHint: 'interactive' });
      this.propriContesto = true;
    }
    this.ctx = ctx;
    this.costruisci(ctx);
    this._stato = 'attivo';
    const reale = eAudioContext(ctx);
    // resume() parte subito, ancora dentro il gesto dell'utente
    const ripresa = eAudioContext(ctx) && ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    if (this.opz.battito ?? reale) this.timer = setInterval(() => this.pompa(), 100);
    const promessa = ripresa.finally(() => {
      this.avvioInCorso = null;
    });
    this.avvioInCorso = promessa;
    return promessa;
  }

  /**
   * Collega `avvia()` al primo gesto dell'utente sul bersaglio (predefinito: window).
   * Restituisce una funzione che stacca gli ascoltatori.
   */
  static avviaAlPrimoGesto(motore: AudioEngine, bersaglio: EventTarget = globalThis as unknown as EventTarget): () => void {
    const tipi = ['pointerdown', 'keydown', 'touchend'] as const;
    const stacca = (): void => tipi.forEach((t) => bersaglio.removeEventListener(t, gestore, true));
    const gestore = (): void => {
      stacca();
      void motore.avvia();
    };
    tipi.forEach((t) => bersaglio.addEventListener(t, gestore, true));
    return stacca;
  }

  /** Mette in pausa: tutto tace (dissolvenza breve), poi il contesto viene sospeso. */
  pausa(): void {
    if (this._stato !== 'attivo' || !this.ctx) return;
    this.mixer.inPausa = true;
    this._stato = 'in-pausa';
    this.applicaGuadagni(0.04);
    const ctx = this.ctx;
    if (eAudioContext(ctx)) {
      this.timerSospensione = setTimeout(() => {
        this.timerSospensione = null;
        if (this._stato === 'in-pausa') void ctx.suspend();
      }, 250);
    }
  }

  /** Riprende dopo una pausa. */
  async riprendi(): Promise<void> {
    if (this._stato !== 'in-pausa' || !this.ctx) return;
    if (this.timerSospensione) clearTimeout(this.timerSospensione);
    this.timerSospensione = null;
    this.mixer.inPausa = false;
    this._stato = 'attivo';
    const ctx = this.ctx;
    if (eAudioContext(ctx) && ctx.state === 'suspended') await ctx.resume();
    this.applicaGuadagni(0.12);
  }

  /** Ferma tutto e libera le risorse (chiude il contesto se l'ha creato il motore). */
  async distruggi(): Promise<void> {
    if (this._stato === 'distrutto') return;
    if (this.timer) clearInterval(this.timer);
    if (this.timerSospensione) clearTimeout(this.timerSospensione);
    this.timer = null;
    for (const s of this.strati) s.distruggi();
    this.strati = [];
    if (this.ctx && this.lettore) this.lettore.ferma(this.ctx.currentTime, 0.1);
    for (const n of this.nodiFissi) {
      try {
        n.disconnect();
      } catch {
        /* già scollegato */
      }
    }
    this.nodiFissi = [];
    this._stato = 'distrutto';
    const ctx = this.ctx;
    if (ctx && this.propriContesto && eAudioContext(ctx)) await ctx.close();
  }

  // -------------------------------------------------------------------------
  // Mixer
  // -------------------------------------------------------------------------

  /** Imposta il cursore di un bus (0-1, curva percettiva). */
  impostaVolume(bus: NomeBus, valore: number): void {
    this.mixer.imposta(bus, valore);
    this.applicaGuadagni();
  }

  /** Valore del cursore di un bus. */
  volume(bus: NomeBus): number {
    return this.mixer.volume(bus);
  }

  /** Muto generale. */
  impostaMuto(muto: boolean): void {
    this.mixer.muto = muto;
    this.applicaGuadagni();
  }

  get muto(): boolean {
    return this.mixer.muto;
  }

  /** Nodo d'ingresso di un bus, per collegarci suoni esterni (per esempio le voci). */
  nodoBus(bus: NomeBus): AudioNode | null {
    if (bus === 'generale') return this.generale;
    return this.bus?.[bus].ingresso ?? null;
  }

  // -------------------------------------------------------------------------
  // Aggiornamento per fotogramma
  // -------------------------------------------------------------------------

  /**
   * Da chiamare a ogni fotogramma con lo stato del giocatore e del mondo.
   * Aggiorna l'ascoltatore 3D, gli strati d'ambiente e gli eventi legati all'ora
   * (accensione della Linea, tema dell'alba, ore del campanile).
   * @param _dt secondi dall'ultimo fotogramma (facoltativo: il motore usa il tempo audio).
   */
  aggiorna(stato: StatoAudio, _dt?: number): void {
    const ctx = this.ctx;
    if (this._stato !== 'attivo' || !ctx) return;
    const t = ctx.currentTime;
    const p = calcolaParametriAmbiente(stato);
    const o = orientamentoAscoltatore(stato.avanti ?? { x: 0, y: 0, z: 1 }, stato.su ?? suVersoAsse(stato.posizione));
    const primo = this.ultimiParametri === null;
    this.asc = { posizione: { ...stato.posizione }, avanti: o.avanti, su: o.su, altezza: p.altezza };
    this.applicaAscoltatore(t, primo);
    this.ultimiParametri = p;
    if (this.oraPrecedente !== null) {
      const prima = this.oraPrecedente;
      if (haAttraversato(prima, p.ora, ORA_ACCENSIONE)) this.evento({ tipo: 'accensione-linea' });
      if (this.opz.musicaAlba !== false && haAttraversato(prima, p.ora, ORA_TEMA_ALBA)) this.suonaTema('alba');
      if (this.campanile?.orarie) {
        for (let h = 23; h >= 0; h--) {
          if (haAttraversato(prima, p.ora, h)) {
            this.evento({ tipo: 'campane', modo: 'ore', ore: h % 12 || 12 });
            break;
          }
        }
      }
    }
    this.oraPrecedente = p.ora;
    this.pompa();
  }

  /** Imposta (o toglie) il campanile che batte le ore da solo. */
  impostaCampanile(posizione: Vec3 | null, orarie = true): void {
    this.campanile = posizione ? { posizione: { ...posizione }, orarie } : null;
  }

  // -------------------------------------------------------------------------
  // Eventi
  // -------------------------------------------------------------------------

  /**
   * Suona un evento singolo. Restituisce la durata stimata in secondi
   * (0 se il motore non è attivo o l'evento è stato rifiutato).
   */
  evento(e: EventoAudio): number {
    const ctx = this.ctx;
    const kit = this.kit;
    if (this._stato !== 'attivo' || !ctx || !kit) return 0;
    const t = ctx.currentTime + 0.01;
    let fine = t;
    switch (e.tipo) {
      case 'passo': {
        const d = this.destinazione('effetti', e.posizione, PROFILI.passo);
        fine = passo(kit, d.dest, t, e.superficie, e.forza ?? 0.7);
        d.rilascia(fine);
        break;
      }
      case 'salto': {
        fine = salto(kit, this.destinazione('effetti').dest, t, e.superficie ?? 'erba');
        break;
      }
      case 'atterraggio': {
        fine = atterraggio(kit, this.destinazione('effetti').dest, t, e.superficie ?? 'erba', e.velocita ?? 6);
        break;
      }
      case 'velo-apri':
        fine = veloApri(kit, this.destinazione('effetti').dest, t);
        break;
      case 'velo-chiudi':
        fine = veloChiudi(kit, this.destinazione('effetti').dest, t);
        break;
      case 'squadro-pianta': {
        const d = this.destinazione('effetti', e.posizione, PROFILI.oggetto);
        fine = squadroPianta(kit, d.dest, t);
        d.rilascia(fine);
        break;
      }
      case 'bolla-livellata':
        fine = bollaLivellata(kit, this.destinazione('effetti').dest, t);
        break;
      case 'inchiostro': {
        const d = this.destinazione('effetti', e.posizione, PROFILI.direzione);
        fine = inchiostro(kit, d.dest, t, e.ampiezza ?? 0.7);
        d.rilascia(fine);
        break;
      }
      case 'pagina':
        fine = pagina(kit, this.destinazione('effetti').dest, t, e.verso ?? 'avanti');
        break;
      case 'fade': {
        const d = this.destinazione('effetti', e.posizione, PROFILI.fade);
        fine = fade(kit, d.dest, t, e.varieta);
        d.rilascia(fine);
        break;
      }
      case 'api': {
        const d = this.destinazione('effetti', e.posizione, PROFILI.api);
        fine = api(kit, d.dest, t, e.durata ?? 4);
        d.rilascia(fine);
        break;
      }
      case 'campane': {
        const d = this.destinazione('effetti', e.posizione ?? this.campanile?.posizione, PROFILI.campane);
        const modo = e.modo ?? 'ore';
        if (modo === 'festa') fine = festa(kit, d.dest, t);
        else if (modo === 'rintocco') fine = rintocco(kit, d.dest, t);
        else fine = batteOre(kit, d.dest, t, e.ore ?? (this.ultimiParametri ? Math.floor(this.ultimiParametri.ora) % 12 || 12 : 12));
        d.rilascia(fine);
        break;
      }
      case 'accensione-linea': {
        // scorre lungo l'asse, dal Tappo Sud verso nord, sopra la testa
        const d = this.destinazione('ambiente', { x: 0, y: 0, z: 0 }, PROFILI.direzione);
        if (d.panner) {
          d.panner.positionZ.setValueAtTime(0, t);
          d.panner.positionZ.linearRampToValueAtTime(LUNGHEZZA_CILINDRO, t + DURATA_ACCENSIONE * 0.9);
        }
        fine = accensioneLinea(kit, d.dest, t);
        d.rilascia(fine);
        break;
      }
      case 'interfaccia':
        fine = interfaccia(kit, this.destinazione('effetti').dest, t, e.varieta);
        break;
      case 'tema':
        return this.suonaTema(e.tema) ? this.ultimaDurataTema : 0;
    }
    return Math.max(0, fine - ctx.currentTime);
  }

  // -------------------------------------------------------------------------
  // Musica
  // -------------------------------------------------------------------------

  /**
   * Fa entrare un tema musicale. Restituisce false se la regia lo rifiuta
   * (un altro tema in corso, troppo presto, ripetuto da poco). `forza` salta i controlli.
   */
  suonaTema(tema: TemaMusicale, opzioni: { forza?: boolean } = {}): boolean {
    const ctx = this.ctx;
    if (this._stato !== 'attivo' || !ctx || !this.lettore) return false;
    const t = ctx.currentTime;
    const decisione = this.regia.valuta(tema, t, opzioni.forza === true);
    if (decisione.esito === 'rifiuta') return false;
    let inizio = t + 0.05;
    if (decisione.esito === 'interrompi-e-suona') {
      this.lettore.ferma(t, 2.5);
      this.regia.ferma(t);
      inizio = t + 1.8;
    }
    const partitura = generaTema(tema, Math.floor(this.rng() * 2 ** 31));
    this.lettore.suona(partitura, inizio);
    this.regia.avvia(tema, inizio, partitura.durata);
    this.ultimaDurataTema = inizio - t + partitura.durata;
    return true;
  }

  /** Sfuma e ferma la musica in corso. */
  fermaMusica(dissolvenza = 2): void {
    const ctx = this.ctx;
    if (!ctx || !this.lettore) return;
    this.lettore.ferma(ctx.currentTime, dissolvenza);
    this.regia.ferma(ctx.currentTime);
  }

  // -------------------------------------------------------------------------
  // Sorgenti posizionali per il gioco
  // -------------------------------------------------------------------------

  /** Crea una sorgente posizionale HRTF a cui collegare un proprio suono. Null se il motore è spento. */
  creaSorgente(posizione: Vec3, opzioni: OpzioniSorgente = {}): SorgentePosizionale | null {
    const ctx = this.ctx;
    if (!ctx || !this.bus || (this._stato !== 'attivo' && this._stato !== 'in-pausa')) return null;
    const bus = this.bus[opzioni.bus ?? 'effetti'];
    const pan = this.creaPanner(
      posizione,
      { rif: opzioni.distanzaRiferimento ?? 5, max: opzioni.distanzaMassima ?? 2000, rolloff: opzioni.attenuazione ?? 1 },
      bus.ingresso,
    );
    return {
      ingresso: pan,
      posiziona: (p: Vec3) => {
        const t = ctx.currentTime;
        pan.positionX.setTargetAtTime(p.x, t, 0.03);
        pan.positionY.setTargetAtTime(p.y, t, 0.03);
        pan.positionZ.setTargetAtTime(p.z, t, 0.03);
      },
      rilascia: () => {
        try {
          pan.disconnect();
        } catch {
          /* già scollegato */
        }
      },
    };
  }

  /** Genera in anticipo i campioni più pesanti (campane, corde), per evitare scatti al primo uso. */
  precarica(): void {
    const kit = this.kit;
    if (!kit) return;
    kit.campana(196);
    kit.campana(246.94);
    kit.campana(293.66);
    for (let m = 43; m <= 93; m++) kit.corda(m);
  }

  // -------------------------------------------------------------------------
  // Interni
  // -------------------------------------------------------------------------

  private costruisci(ctx: BaseAudioContext): void {
    const kit = new Kit(ctx, this.rng);
    this.kit = kit;
    const fissi = this.nodiFissi;
    const generale = kit.guadagno(this.mixer.guadagno('generale'));
    this.generale = generale;
    const analizzatore = ctx.createAnalyser();
    analizzatore.fftSize = 2048;
    this.analizzatore = analizzatore;
    fissi.push(generale, analizzatore);
    if (this.opz.limitatore !== false) {
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -10;
      lim.knee.value = 8;
      lim.ratio.value = 8;
      lim.attack.value = 0.004;
      lim.release.value = 0.25;
      generale.connect(lim).connect(analizzatore);
      fissi.push(lim);
    } else {
      generale.connect(analizzatore);
    }
    analizzatore.connect(ctx.destination);
    // riverbero condiviso
    const conv = ctx.createConvolver();
    conv.buffer = kit.rispostaRiverbero();
    const ritorno = kit.guadagno(0.55);
    conv.connect(ritorno).connect(generale);
    fissi.push(conv, ritorno);
    // bus
    const crea = (nome: BusFiglio): Bus => {
      const ingresso = kit.guadagno(this.mixer.guadagno(nome));
      const mandata = kit.guadagno(this.mixer.guadagno(nome));
      mandata.connect(conv);
      if (nome === 'musica') {
        // la musica non scende nel registro del vento e del ronzio: non copre l'ambiente
        const hp = kit.filtro('highpass', 140, 0.6);
        ingresso.connect(hp).connect(generale);
        fissi.push(hp);
      } else {
        ingresso.connect(generale);
      }
      fissi.push(ingresso, mandata);
      return { ingresso, mandata };
    };
    this.bus = { ambiente: crea('ambiente'), effetti: crea('effetti'), voci: crea('voci'), musica: crea('musica') };
    this.applicaAscoltatore(ctx.currentTime, true);
    if (this.opz.ambienti !== false) {
      const amb = this.contestoStrato('ambiente');
      const eff = this.contestoStrato('effetti');
      const fabbriche: Record<NomeStrato, () => Strato> = {
        vento: () => new StratoVento(amb),
        volo: () => new StratoVolo(eff),
        linea: () => new StratoLinea(amb),
        fauna: () => new StratoFauna(amb),
        lago: () => new StratoLago(amb),
        sordo: () => new StratoSordo(amb),
        finestre: () => new StratoFinestre(amb),
        fade: () => new StratoFade(amb),
      };
      const scelti = this.opz.strati ?? NOMI_STRATI;
      this.strati = NOMI_STRATI.filter((n) => scelti.includes(n)).map((n) => fabbriche[n]());
    }
    this.lettore = new LettoreMusica(kit, this.bus.musica.ingresso, this.bus.musica.mandata);
  }

  private contestoStrato(nome: BusFiglio): ContestoStrato {
    const kit = this.kit as Kit;
    const bus = (this.bus as Record<BusFiglio, Bus>)[nome];
    return {
      kit,
      uscita: bus.ingresso,
      riverbero: bus.mandata,
      ascoltatore: () => this.asc,
      panner: (p, profilo) => this.creaPanner(p, profilo, bus.ingresso),
    };
  }

  private creaPanner(p: Vec3, profilo: ProfiloSpaziale, uscita: AudioNode): PannerNode {
    const ctx = this.ctx as BaseAudioContext;
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = profilo.rif;
    pan.maxDistance = profilo.max;
    pan.rolloffFactor = profilo.rolloff;
    if (pan.positionX) {
      pan.positionX.value = p.x;
      pan.positionY.value = p.y;
      pan.positionZ.value = p.z;
    } else {
      (pan as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(p.x, p.y, p.z);
    }
    pan.connect(uscita);
    return pan;
  }

  /** Destinazione per un suono: diretta sul bus o attraverso un panner posizionale. */
  private destinazione(
    nome: BusFiglio,
    posizione?: Vec3,
    profilo?: ProfiloSpaziale,
  ): { dest: Destinazione; panner: PannerNode | null; rilascia(fine: number): void } {
    const bus = (this.bus as Record<BusFiglio, Bus>)[nome];
    const kit = this.kit as Kit;
    if (!posizione || !profilo) {
      return { dest: { secco: bus.ingresso, riverbero: bus.mandata }, panner: null, rilascia: () => undefined };
    }
    const pan = this.creaPanner(posizione, profilo, bus.ingresso);
    // più lontano = relativamente più riverbero (il diretto cala più in fretta)
    const d = distanza(posizione, this.asc.posizione);
    const mandata = kit.guadagno(profilo.rolloff === 0 ? 1 : 1 / (1 + d / (profilo.rif * 8)));
    mandata.connect(bus.mandata);
    return {
      dest: { secco: pan, riverbero: mandata },
      panner: pan,
      rilascia: (fine: number) => pulisciA(kit, fine, [pan, mandata]),
    };
  }

  private applicaGuadagni(tau = 0.05): void {
    const ctx = this.ctx;
    if (!ctx || !this.generale || !this.bus) return;
    const t = ctx.currentTime;
    this.generale.gain.setTargetAtTime(this.mixer.guadagno('generale'), t, tau);
    for (const nome of ['ambiente', 'effetti', 'voci', 'musica'] as const) {
      const g = this.mixer.guadagno(nome);
      this.bus[nome].ingresso.gain.setTargetAtTime(g, t, tau);
      this.bus[nome].mandata.gain.setTargetAtTime(g, t, tau);
    }
  }

  private applicaAscoltatore(t: number, immediato: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    const { posizione: p, avanti: f, su: u } = this.asc;
    if (l.positionX) {
      const valori: [AudioParam, number][] = [
        [l.positionX, p.x],
        [l.positionY, p.y],
        [l.positionZ, p.z],
        [l.forwardX, f.x],
        [l.forwardY, f.y],
        [l.forwardZ, f.z],
        [l.upX, u.x],
        [l.upY, u.y],
        [l.upZ, u.z],
      ];
      for (const [param, v] of valori) {
        if (immediato) param.setValueAtTime(v, t);
        else param.setTargetAtTime(v, t, 0.02);
      }
    } else {
      // Firefox: solo i metodi storici
      const vecchio = l as unknown as {
        setPosition(x: number, y: number, z: number): void;
        setOrientation(x: number, y: number, z: number, ux: number, uy: number, uz: number): void;
      };
      vecchio.setPosition(p.x, p.y, p.z);
      vecchio.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }

  /** Pianifica eventi d'ambiente e note con l'ultimo stato noto. */
  private pompa(): void {
    const ctx = this.ctx;
    if (this._stato !== 'attivo' || !ctx) return;
    const t = ctx.currentTime;
    const p = this.ultimiParametri;
    if (p && t - this.ultimoAggStrati >= 0.05) {
      for (const s of this.strati) s.aggiorna(p, t);
      this.ultimoAggStrati = t;
    }
    this.lettore?.aggiorna(t);
  }
}
