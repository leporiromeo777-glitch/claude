/**
 * La regia del gioco: la colla fra il mondo (motore), la storia (narrativa), il suono (audio),
 * l'interfaccia (ui), gli oggetti e il catasto.
 *
 * Responsabilità:
 * - ciclo di vita: titolo → nuova partita (nella capsula 5, il prologo) / continua;
 * - i fatti del mondo per la storia (`WorldFacts`): ora, giorno, luoghi raggiunti, particelle,
 *   varianti degli elementi mobili;
 * - i flag del «Contratto col motore» (FASE1 §2.4), accesi nel momento giusto, e i flag scritti
 *   dai contenuti che il motore deve eseguire (campanile, «aspetta fino a: brace», campane…);
 * - l'orologio con i fermi, il sonno, l'attesa, la notte (giro delle Fade) e il mattino;
 * - interazioni (E), sguardi, lente, gesti tenuti, squadro, dialoghi, letture;
 * - audio (avvio al primo gesto, aggiornamento a ogni fotogramma, suoni degli eventi);
 * - salvataggi (due slot alternati della narrativa + il blob del mondo).
 *
 * Tutta la logica che cambia lo stato gira nel passo fisso (`update`), così le prove E2E
 * possono far avanzare il gioco senza disegnare; `render` aggiorna solo ciò che si vede.
 */
import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  Vector3,
} from 'three';
import type { Game, SistemaGioco } from '../game';
import {
  GestoreSalvataggi,
  Narrativa,
  archivioDaStorage,
  type FornitoreMondo,
  type WorldFacts,
} from '../narrativa';
import { nomeCatastale, type InterfacciaGioco } from '../ui';
import { DEG, METERS_PER_DEG } from '../world/constants';
import { cylToWorld, localFrameAt, rotatingToInertialDir, upAt, worldToCyl } from '../world/cylinder';
import { groundHeight, stripAt } from '../world/terrain';
import { portaPopolamento, type ManigliaCorbella, type PortaCorbella } from '../popolamento';
import { PonteAudio } from './audio';
import { CAPISALDI, CONTENUTI_NARRATIVA, LONTANI, luogo, ostacoloFra, testoOra as fmtOra } from './contenuti';
import { Corpo } from './corpo';
import { DirettoreDialoghi } from './dialoghi';
import { ORDINE_LIBRETTO, PonteInterfaccia } from './interfaccia';
import { Interazioni, type StatoInterazione } from './interazioni';
import { Luoghi, quotaAppoggio } from './luoghi';
import { NotteVista } from './notte';
import { GuidaObiettivi } from './obiettivi';
import { OrologioStoria, attraversa, type Intervallo } from './orologio';
import { Abitanti } from './png';
import type { Bersaglio as BersaglioCatasto, EventoCatasto, Resoconto } from '../rilievo';
import { CatastoGioco, posizioniCapisaldi } from './catasto';
import { QUOTA_CRIPTA, SCALA, costruisciCripta, type Cripta } from './scena/cripta';
import { cellaDaCorbella, type CellaCampanaria } from './scena/campanile';
import { LetteraInMano } from './scena/lettera';
import { Sguardi } from './sguardo';
import { Squadro, type BersaglioMira } from './squadro';
import { Velatura } from './velatura';
import { registraBersagli } from './bersagli';

export type Controllo =
  | { tipo: 'libero' }
  | { tipo: 'sdraiata' }
  | { tipo: 'alzandosi'; t: number }
  | { tipo: 'scala'; y: number }
  | { tipo: 'seduta'; z: number; theta: number; h: number }
  | { tipo: 'piantato'; z: number; theta: number; h: number }
  | { tipo: 'dorme' };

export interface MondoSalvato {
  versione: 1;
  giocatore: { z: number; theta: number; h: number; yaw: number; pitch: number };
  interno: 'cripta' | 'cella' | null;
  sdraiata: boolean;
  orologio: ReturnType<OrologioStoria['esporta']>;
  catasto: unknown;
  corpo: ReturnType<Corpo['esporta']>;
  squadro: ReturnType<Squadro['esporta']>;
  abitanti: unknown;
  regia: { nomiNoti: string[]; capisaldiVisti: string[]; stadioInnesto: number; segnalibro: string; simTime: number };
}

const OCCHI = 1.62;
const _v = new Vector3();
const _w = new Vector3();
const _f = { up: new Vector3(), east: new Vector3(), north: new Vector3() };

/** Periodo della Meta (s): una rotazione del cilindro. */
export const PERIODO_META = 51;

/** Punti d'esame della lente con il nome detto al giocatore (scena: `lente_<id>`). */
const PUNTI_LENTE: [string, string, string][] = [
  ['ricci', 'i ricci per terra', 'm1_lente'],
  ['amenti', 'gli amenti sui rami bassi', 'm1_lente'],
  ['corteccia', 'la corteccia del tronco', 'm1_lente'],
  ['innesto_vecchio', 'il vecchio innesto', 'm1_innesto'],
];
const _lenteD = new Vector3();

export class Regia implements SistemaGioco {
  readonly audio = new PonteAudio();
  narrativa!: Narrativa;
  readonly catasto: CatastoGioco;
  readonly orologio = new OrologioStoria();
  readonly luoghi = new Luoghi();
  readonly interazioni = new Interazioni();
  readonly sguardi = new Sguardi();
  readonly corpo = new Corpo();
  readonly squadro: Squadro;
  readonly abitanti: Abitanti;
  readonly notteVista: NotteVista;
  readonly cripta: Cripta;
  readonly cella: CellaCampanaria;
  readonly scena: PortaCorbella;
  readonly ponte: PonteInterfaccia;
  readonly dialoghi: DirettoreDialoghi;
  readonly velatura: Velatura;
  readonly salvataggi: GestoreSalvataggi;
  /** Le indicazioni delle missioni: pannello dell'obiettivo e segnalino di direzione. */
  readonly guida: GuidaObiettivi;

  fase: 'caricamento' | 'titolo' | 'gioco' = 'caricamento';
  interno: 'cripta' | 'cella' | null = null;
  controllo: Controllo = { tipo: 'libero' };
  lente = false;
  readonly nomiNoti = new Set<string>();
  readonly capisaldiVisti = new Set<string>();
  readonly libretto = { ordine: ORDINE_LIBRETTO, segnalibro: 'cs_1' };
  ultimoSuggerimento: string | null = null;
  ultimaBattuta: string | null = null;
  /** Luoghi dove si trova adesso Elvira. */
  readonly luoghiQui = new Set<string>();
  /** Innesto in tre tempi: 0 = da fare, 3 = fatto. */
  stadioInnesto = 0;
  statoInterazione: StatoInterazione = { bersaglio: null, progresso: null };
  /** Diario degli eventi della storia (debug e prove). */
  readonly diario: string[] = [];
  dormendo = false;

  private ePremuto = false;
  private accTick = 0;
  private metaFase = 0;
  private metaPrecedente = -1;
  private metaImpulso = -1;
  private salvaTra = -1;
  private ombristaSera = -1;
  private tenutaC = 0;
  /** La lettera di Marta si è già aperta da sola in questa seduta (vedi letteraDaSeduta). */
  private letteraOffertaDaSeduta = false;
  /** Secondi dall'ultimo controllo del dialogo delle campane (vedi campaneDiRiserva). */
  private attesaCampane = 0;
  /** Indicazione a schermo per la lente (vedi cercaPuntoLente). */
  private indicazioneLente: { tasto: string; testo: string; progresso?: number } | null = null;
  private attesaVicini = new Set<string>();
  private mira: { b: BersaglioMira | null; d: number; t: number } = { b: null, d: 0, t: 0 };
  private emisfero: HemisphereLight;
  private sole: DirectionalLight;
  private campaneAttive = false;
  private staccaNarrativa: (() => void)[] = [];

  constructor(
    readonly game: Game,
    readonly ui: InterfacciaGioco,
    readonly corbella: ManigliaCorbella,
    readonly opzioni: { e2e: boolean } = { e2e: false },
  ) {
    const g = game;
    // --- il paese: il popolamento di Corbella (src/popolamento), installato da main.ts ---
    this.scena = portaPopolamento(corbella);
    this.cella = cellaDaCorbella(corbella);
    // i luoghi che il popolamento ha messo altrove rispetto ai contenuti
    const botola = this.scena.punto('botola');
    if (botola) {
      const c = worldToCyl(botola);
      this.luoghi.sposta('botola', c.z, c.theta);
    }
    // la Cripta della regia (con coperchi, armadietto, buste, scala e botola interna): l'interno
    // del popolamento resta nascosto, ne basta una
    corbella.cripta.interno.visible = false;
    this.cripta = costruisciCripta(g.materials.object!);
    g.scene.add(this.cripta.gruppo);
    for (const c of this.cripta.collisori) g.world.colliders.add(c);
    g.lamps.addLamps([...this.cripta.lumi]);
    // il catasto (src/rilievo): particelle nel motore, varianti agli oggetti, effetti alla storia
    this.catasto = new CatastoGioco(
      g.world,
      { mostraVariante: (e, v, pezzi) => this.scena.mostraVariante(e, v, pezzi) },
      (eff) => this.effettiCatasto(eff),
      posizioniCapisaldi({ punto: (id) => this.chiodo(id), segnale: (id) => this.scena.punto(`segnale_${id}`) }),
    );
    this.catasto.onEvento((e) => this.eventoCatasto(e));
    this.abitanti = new Abitanti(corbella);
    this.abitanti.log = (riga) => this.log(riga);
    this.notteVista = new NotteVista(corbella.notte);
    // luci per le figure (materiale toon della libreria oggetti)
    this.emisfero = new HemisphereLight(0xdfe6f0, 0x6a6050, 1.1);
    this.sole = new DirectionalLight(0xfff0d8, 1.6);
    g.scene.add(this.emisfero, this.sole, this.sole.target, new AmbientLight(0x303040, 0.3));

    this.velatura = new Velatura(ui.radice.parentElement ?? document.body);
    this.salvataggi = new GestoreSalvataggi({ archivio: archivioDaStorage(localStorage), prefisso: 'cielo-di-terra.salvataggio' });
    this.ponte = new PonteInterfaccia(this);
    this.dialoghi = new DirettoreDialoghi(this);
    this.guida = new GuidaObiettivi(this);

    // --- squadro ---
    this.squadro = new Squadro(g, {
      bersagli: () => this.bersagliMira(),
      tolleranzaBolla: () => (ui.impostazioni.get('bollaLarga') ? 0.25 : 0.12),
      tempoCollimazione: () => (ui.impostazioni.get('collimazioneAgganciata') ? 0.8 : 1.5),
    });
    this.collegaSquadro();

    // --- il motore ---
    g.player.groundFn = (z, theta) => (this.interno === 'cripta' ? QUOTA_CRIPTA : groundHeight(z, theta));
    g.controlloEsterno = (dt) => this.controlloCorpo(dt);
    g.bus.on('player:interact', () => (this.ePremuto = true));
    g.bus.on('player:jump', () => this.audio.evento({ tipo: 'salto', superficie: this.superficie() }));
    g.bus.on('player:land', (e) => this.audio.evento({ tipo: 'atterraggio', superficie: this.superficie(), velocita: e.speed }));
    g.bus.on('velo:toggle', (e) => {
      this.audio.evento({ tipo: e.open ? 'velo-apri' : 'velo-chiudi' });
      if (e.open && this.narrativa?.valuta('passo:m1_velo attivo')) this.audio.tema('primo_volo', false);
    });
    g.clock.running = false;
    g.sistemi.push(this.squadro, this);
    // la lettera in mano in prima persona (solo visiva, traccia «paese»): il foglio della carta aperta
    g.sistemi.push(new LetteraInMano(g, () => ({ aperta: ui.lettore.visible, tipo: ui.lettore.el.dataset['tipo'] ?? '' })));

    // --- interfaccia ---
    ui.on('catturaInput', (preso) => {
      g.input.releaseAll();
      if (preso) document.exitPointerLock?.();
    });
    ui.titolo.on('nuovaPartita', () => void this.nuovaPartitaDaTitolo());
    ui.titolo.on('continua', () => void this.continua());
    ui.pausa.on('esciAlTitolo', () => void this.esciAlTitolo());
    const imp = ui.impostazioni;
    const applica = () => {
      g.settings.fov = imp.get('campoVisivo');
      g.settings.mouseSensitivity = 0.0022 * imp.get('sensibilitaMouse');
      g.settings.invertY = imp.get('invertiAsseY');
      g.settings.headBob = imp.get('oscillazioneTesta');
      const cor = imp.get('coriolisCorpo');
      g.settings.fullPhysics = cor === 'pieno';
      g.settings.coriolisOnFoot = cor === 'spento' ? 0 : 0.4;
      g.settings.starSpeed = imp.get('velocitaStelle');
      g.applySettings();
      this.audio.volume('generale', imp.get('volumeGenerale'));
      this.audio.volume('musica', imp.get('volumeMusica'));
      this.audio.volume('ambiente', imp.get('volumeAmbiente'));
      this.audio.volume('voci', imp.get('volumeVoci'));
      ui.indicazioni.mostraPuntino(false);
    };
    applica();
    imp.on('cambio', applica);
    imp.on('ripristino', applica);
    this.audio.avviaAlPrimoGesto(window);

    // la Meta: istante del passaggio sulla Finestra dei Ponti (la luce entra dal vetro)
    this.metaFase = calcolaFaseMeta();
    this.nuovoMondo();
    registraBersagli(this);
  }

  // =================================================================== ciclo di vita

  /** Crea narrativa e catasto nuovi (partita nuova o prima di un caricamento). */
  private nuovoMondo(): void {
    for (const s of this.staccaNarrativa) s();
    const fatti: WorldFacts = {
      ora: () => this.orologio.ore,
      giorno: () => this.orologio.giorno,
      notte: () => this.orologio.notte,
      luogoRaggiunto: (id) => this.luoghiQui.has(id),
      // «cella:id rilevata» = rilevata da Elvira (G5); la striscia seppia del G4 non conta
      cellaRilevata: (id) => this.catasto.rilevataDaElvira(Number(id)),
      cellaVista: (id) => this.catasto.stato(Number(id)) !== 'bianco',
      varianteParticella: (id) => this.catasto.variante(id),
      prossimoEventoCielo: () => null,
    };
    this.narrativa = new Narrativa(CONTENUTI_NARRATIVA, fatti);
    if (this.narrativa.problemi.length) console.warn('[regia] contenuti:', this.narrativa.problemi);
    this.collegaNarrativa();
    this.catasto.nuovo();
  }

  /** Mostra il titolo, con il mondo dietro (Corbella all'alba). */
  async mostraTitolo(): Promise<void> {
    this.fase = 'titolo';
    const elenco = await this.salvataggi.elenco().catch(() => []);
    const valido = elenco.filter((s) => s.stato === 'valido').sort((a, b) => (b.contatore ?? 0) - (a.contatore ?? 0))[0];
    const meta = valido?.meta as { descrizione?: string } | undefined;
    // il titolo: dal belvedere sopra Corbella, nella luce del mattino, il lago appeso nel cielo
    this.game.clock.setHours(7.1);
    this.game.sky = this.game.clock.state(this.game.sky);
    this.game.setCameraPose(1096, 29.2, groundHeight(1096, 29.2) + 4, 128, 24);
    this.ui.titolo.show({ puoiContinuare: !!valido, ...(meta?.descrizione ? { salvataggio: meta.descrizione } : {}), versione: `Fase 1 · prologo e missione 1 · aggiornata il ${typeof __AGGIORNAMENTO__ === 'string' ? __AGGIORNAMENTO__ : '?'}` });
  }

  private async nuovaPartitaDaTitolo(): Promise<void> {
    this.ui.titolo.hide();
    if (this.fase === 'gioco' || this.partitaIniziata) {
      // ripartire da capo in una pagina pulita (la Cripta e il mondo tornano come nuovi)
      try {
        sessionStorage.setItem('cielo-di-terra.nuova', '1');
      } catch {
        /* niente */
      }
      location.reload();
      return;
    }
    this.nuovaPartita();
  }

  private partitaIniziata = false;

  /** Una partita nuova: Elvira sdraiata nella capsula 5, alle 05:38 del giorno 1. */
  nuovaPartita(): void {
    this.partitaIniziata = true;
    this.fase = 'gioco';
    this.ui.titolo.hide();
    this.game.setFreeCamera(false);
    this.orologio.imposta(1, 5 + 38 / 60);
    this.orologio.fermo = 5 + 38 / 60;
    this.orologio.limite = null;
    this.interno = 'cripta';
    this.controllo = { tipo: 'sdraiata' };
    this.abitanti.ottavioInCielo();
    this.squadro.disponibile = false;
    this.squadro.importa(null);
    this.applicaInterno();
    this.posaSdraiata();
    // sdraiata, lo sguardo in su verso la volta: la scritta è sul vetro, un po' più in basso
    this.guardaDirezione(0, 62);
    this.velatura.dalNero(3.2, true);
    this.ui.indicazioni.show();
    this.narrativa.tick(0);
    this.guida.azzera();
    this.log('nuova partita');
  }

  /** Continua dall'ultimo salvataggio valido. */
  async continua(): Promise<boolean> {
    this.ui.titolo.hide();
    // Il titolo sorvola la valle con la camera libera: va spenta PRIMA di caricare (spegnerla
    // dopo riporterebbe Elvira sotto la camera del titolo). Senza questo, dopo «Continua» i
    // tasti muovevano la camera e il corpo restava fermo: non ci si poteva più sedere né leggere.
    this.game.setFreeCamera(false);
    try {
      const r = await this.narrativa.carica(this.salvataggi, this.fornitoreMondo());
      if (!r) {
        this.nuovaPartita();
        return false;
      }
      this.partitaIniziata = true;
      this.fase = 'gioco';
      // Un salvataggio fatto a dialogo aperto (il salvataggio automatico scatta al cambio di
      // passo, spesso mentre parte un dialogo automatico come quello delle campane) lo
      // ricaricherebbe «aperto» senza finestra: la storia resterebbe ferma. Lo si interrompe,
      // così un dialogo automatico si riapre da capo e gli altri si riprendono parlando.
      if (this.narrativa.dialoghi.aperto()) {
        this.narrativa.dialoghi.interrompi();
        this.narrativa.tick(0);
      }
      this.suggerisciPassoCorrente();
      this.ui.indicazioni.show();
      // l'obiettivo in corso torna nel pannello così com'era: non è «nuovo»
      this.guida.riprendi();
      this.riallinea();
      this.velatura.dalNero(1.2);
      this.log('partita caricata');
      return true;
    } catch (e) {
      console.warn('[regia] caricamento fallito:', e);
      this.ponte.notifica('Il salvataggio non si legge: si comincia da capo.', 'rosso');
      this.nuovaPartita();
      return false;
    }
  }

  /**
   * Dopo «Continua» ripete il suggerimento del passo della storia in corso: gli effetti di
   * attivazione (che lo mostravano) non si riapplicano al caricamento, e il giocatore che
   * riprende non sa più che cosa stava facendo.
   */
  private suggerisciPassoCorrente(): void {
    const defs = this.narrativa.contenuti.missioni;
    for (const a of this.narrativa.missioni.passiAttivi()) {
      const m = defs.find((d) => d.id === a.missione);
      if (!m || (m.tipo !== 'prologo' && m.tipo !== 'principale')) continue;
      const s = m.passi.find((x) => x.id === a.passo)?.effettiAttivazione.find((e) => e.startsWith('suggerimento:'));
      if (s) {
        this.ponte.suggerimento(s.slice('suggerimento:'.length), 15);
        return;
      }
    }
  }

  /**
   * Prologo: seduta con la lettera di Marta ancora da leggere, la busta si apre da sola
   * (una volta per seduta, così chi la chiude non se la ritrova davanti di continuo).
   */
  private letteraDaSeduta(): void {
    if (this.controllo.tipo !== 'seduta') {
      this.letteraOffertaDaSeduta = false;
      return;
    }
    if (this.letteraOffertaDaSeduta || this.ui.inputCatturato || this.dialoghi.aperto) return;
    const n = this.narrativa;
    if (n.flag.get('lettera_letta') || !n.inventario.ha('lettera_marta')) return;
    if (!n.missioni.passiAttivi().some((p) => p.passo === 'pr_lettera')) return;
    this.letteraOffertaDaSeduta = true;
    this.ponte.leggi('lettera_marta');
  }

  /**
   * Rete di sicurezza del prologo: se il passo delle campane è attivo da qualche secondo e il
   * dialogo con Meridiana non è aperto né finito (interrotto, perso in un caricamento), lo si
   * richiede di nuovo.
   */
  private campaneDiRiserva(dt: number): void {
    this.attesaCampane += dt;
    if (this.attesaCampane < 2) return;
    this.attesaCampane = 0;
    const n = this.narrativa;
    if (this.dialoghi.aperto || this.ui.inputCatturato) return;
    if (n.dialoghi.finito('d_meridiana_1') || n.dialoghi.aperto()) return;
    if (!n.missioni.passiAttivi().some((p) => p.passo === 'pr_campane')) return;
    this.dialoghi.richiedi('d_meridiana_1', true);
  }

  /**
   * Che cosa dire a schermo sui punti d'esame della lente (i ricci, gli amenti, la corteccia,
   * il vecchio innesto): senza lente, vicino a un punto ancora da esaminare, «Q — prendi la
   * lente»; con la lente, il punto più vicino da guardare, con l'avanzamento dell'esame.
   */
  private cercaPuntoLente(occhi: Vector3, avanti: Vector3): { tasto: string; testo: string; progresso?: number } | null {
    if (this.interno || !this.narrativa.inventario.ha('lente')) return null;
    let migliore: { id: string; d: number; ang: number } | null = null;
    let passi: string[] | null = null;
    for (const [id, nome, passo] of PUNTI_LENTE) {
      if (this.narrativa.flag.vero(`lente:${id}`)) continue;
      passi ??= this.narrativa.missioni.passiAttivi().map((x) => x.passo);
      if (!passi.includes(passo)) continue;
      const pos = this.scena.punto(`lente_${id}`);
      if (!pos) continue;
      _lenteD.subVectors(pos, occhi);
      const d = _lenteD.length();
      if (d > 9) continue;
      const ang = d < 1e-3 ? 0 : Math.acos(Math.max(-1, Math.min(1, _lenteD.dot(avanti) / d)));
      if (!migliore || ang < migliore.ang) migliore = { id, d, ang };
      void nome;
    }
    if (!migliore) return null;
    const nome = PUNTI_LENTE.find(([id]) => id === migliore.id)![1];
    if (!this.lente) return { tasto: 'Q', testo: `Prendi la lente ed esamina ${nome}` };
    if (migliore.d > 4.5) return { tasto: 'Q', testo: `Avvicinati: ${nome}` };
    const t = this.sguardi.tempo(`lente:${migliore.id}`);
    return { tasto: 'Q', testo: `Lente: guarda ${nome}`, ...(t > 0 ? { progresso: Math.min(1, t / 0.8) } : {}) };
  }

  async salva(): Promise<void> {
    if (this.fase !== 'gioco' || this.controllo.tipo === 'sdraiata') return;
    const pc = this.game.player.cyl;
    const luogoNome = this.interno === 'cripta' ? 'la Cripta' : (this.luoghi.piuVicino(pc.z, pc.theta)?.nome ?? 'Corbella');
    await this.narrativa
      .salva(this.salvataggi, this.fornitoreMondo(), { descrizione: `Giorno ${this.orologio.giorno} · ${luogoNome} · ${this.testoOra()}`, giorno: this.orologio.giorno })
      .catch((e) => console.warn('[regia] salvataggio:', e));
  }

  private async esciAlTitolo(): Promise<void> {
    await this.salva();
    this.dialoghi.svuota();
    this.ponte.chiudiAttesa();
    await this.mostraTitolo();
  }

  // =================================================================== salvataggio

  fornitoreMondo(): FornitoreMondo {
    return {
      esporta: (): MondoSalvato => {
        const g = this.game;
        const pc = g.player.cyl;
        const vp = this.yawPitch();
        const fermo = this.controllo.tipo === 'seduta' || this.controllo.tipo === 'piantato';
        return {
          versione: 1,
          // da seduta (o allo squadro) la quota del controllo è mezzo metro sotto il piano su cui
          // poggia: si salva la quota in piedi, se no al caricamento Elvira finisce dentro il muretto
          giocatore: { z: pc.z, theta: pc.theta, h: fermo ? (this.controllo as { h: number }).h + 0.5 : pc.h, yaw: vp.yaw, pitch: vp.pitch },
          interno: this.interno,
          sdraiata: this.controllo.tipo === 'sdraiata',
          orologio: this.orologio.esporta(),
          catasto: this.catasto.salva(),
          corpo: this.corpo.esporta(),
          squadro: this.squadro.esporta(),
          abitanti: this.abitanti.esporta(),
          regia: {
            nomiNoti: [...this.nomiNoti],
            capisaldiVisti: [...this.capisaldiVisti],
            stadioInnesto: this.stadioInnesto,
            segnalibro: this.libretto.segnalibro,
            simTime: g.simTime,
          },
        };
      },
      importa: (blob: unknown) => {
        const m = blob as Partial<MondoSalvato> | null;
        if (!m || m.versione !== 1) return;
        this.orologio.importa(m.orologio);
        if (m.catasto) this.catasto.carica(m.catasto);
        this.corpo.importa(m.corpo);
        this.abitanti.importa(m.abitanti);
        const r = m.regia;
        this.nomiNoti.clear();
        for (const n of r?.nomiNoti ?? []) this.nomiNoti.add(n);
        this.capisaldiVisti.clear();
        for (const n of r?.capisaldiVisti ?? []) this.capisaldiVisti.add(n);
        this.stadioInnesto = r?.stadioInnesto ?? 0;
        this.libretto.segnalibro = r?.segnalibro ?? 'cs_1';
        this.interno = m.interno ?? null;
        this.applicaInterno();
        const p = m.giocatore;
        this.controllo = m.sdraiata ? { tipo: 'sdraiata' } : { tipo: 'libero' };
        if (p) {
          // quota assoluta salvata: anche sul ripiano di una terrazza o in cima al campanile
          // con un margine sopra la quota salvata: Elvira ricade sul piano (muretto, ripiano, terreno)
          // invece di ricomparire dentro un collisore (i salvataggi fatti da seduta prima di
          // questa correzione avevano la quota mezzo metro più in basso)
          this.game.player.teleport(p.z, p.theta, Math.max(p.h + (m.sdraiata ? 0 : 0.6), this.game.player.groundFn(p.z, p.theta)), true);
          if (m.sdraiata) this.posaSdraiata();
          this.game.setView(p.yaw, p.pitch);
          this.game.syncEyeNow();
        }
        if (typeof r?.simTime === 'number') {
          this.game.simTime = r.simTime;
          this.game.world.time = r.simTime;
        }
        this.squadro.disponibile = this.narrativa.inventario.ha('squadro');
        this.squadro.importa(m.squadro);
      },
    };
  }

  /** Dopo un caricamento: rimette il mondo d'accordo con i flag e i passi. */
  private riallinea(): void {
    const n = this.narrativa;
    if (n.valuta('passo:pr_vetro completato')) this.cripta.apriCoperchio();
    if (n.flag.vero('esaminato:busta_5')) this.cripta.togliBusta();
    if (n.flag.vero('armadietto_aperto')) this.cripta.apriArmadietto();
    if (n.valuta('passo:pr_botola_scala completato')) {
      this.cripta.apriBotola();
      this.scena.apriBotola(true);
    }
    for (let i = 0; i < 4; i++) this.cripta.update(5);
    this.campaneAttive = false;
  }

  // =================================================================== storia

  private collegaNarrativa(): void {
    const n = this.narrativa;
    const ev = n.eventi;
    this.staccaNarrativa = [
      ev.on('evento', ({ nome, argomenti }) => this.eventoStoria(nome, argomenti)),
      ev.on('tempo', ({ azione, ore }) => (azione === 'salta-a' ? this.dormi(ore) : this.scorriTempo(this.orologio.avanzaDi(ore)))),
      ev.on('apriDialogo', ({ dialogo, automatico }) => this.dialoghi.richiedi(dialogo, !!automatico)),
      ev.on('passoAttivato', ({ passo }) => this.passoAttivato(passo)),
      ev.on('passoCompletato', ({ passo }) => this.passoCompletato(passo)),
      ev.on('missioneCompletata', ({ missione }) => this.log(`missione completata: ${missione}`)),
      ev.on('dialogoFinito', ({ dialogo, personaggio }) => {
        this.nomiNoti.add(personaggio);
        if (personaggio === 'bambini') this.nomiNoti.add('lisa').add('gioanin');
        if (this.dialoghi.nodo?.dialogo === dialogo) this.dialoghi.chiudi();
        this.log(`dialogo finito: ${dialogo}`);
      }),
      ev.on('oggetto', ({ id, dopo, prima }) => {
        if (id === 'squadro' && dopo > 0) this.squadro.disponibile = true;
        if (dopo > prima && id === 'velo_nero') this.ponte.notifica('Il velo di garza nera: V per indossarlo o toglierlo.');
        if (dopo > prima && id === 'marza_pedrazzini') this.audio.evento({ tipo: 'interfaccia', varieta: 'conferma' });
      }),
      ev.on('taccuino', ({ azione, voce }) => {
        if (azione !== 'aggiunta' || !voce) return;
        const testo = voce.tipo === 'parola' ? `${voce.tecnica ?? ''} → ${voce.locale ?? voce.testo}` : voce.testo;
        this.ponte.notifica(`Taccuino: ${testo.length > 70 ? `${testo.slice(0, 68)}…` : testo}`);
      }),
      ev.on('errore', ({ messaggio }) => console.warn('[narrativa]', messaggio)),
    ];
  }

  /** Effetti del catasto verso la storia (flag del contratto, contatori, Pesarina). */
  private effettiCatasto(effetti: string[]): void {
    if (!effetti.length) return;
    this.log(`catasto: ${effetti.join(', ')}`);
    if (effetti.includes('flag:taccuino_spostato')) this.ponte.paginaParole = true;
    this.narrativa.applicaEffetti(effetti, 'catasto');
  }

  private eventoCatasto(e: EventoCatasto): void {
    switch (e.tipo) {
      case 'particelle_rivelate':
        if (!e.celle.length) break;
        this.audio.evento({ tipo: 'inchiostro', ampiezza: 0.9, posizione: cylToWorld(e.origine.z, e.origine.theta, groundHeight(e.origine.z, e.origine.theta)) });
        if (e.primoDelFoglio) this.audio.tema('primo_rilievo');
        this.log(`rivelate ${e.celle.length} particelle (${e.rif})${e.primoDelFoglio ? ', primo del foglio' : ''}`);
        break;
      case 'lato_chiuso':
        this.audio.evento({ tipo: 'pagina', verso: 'avanti' });
        this.ponte.notifica(`Lato ${e.lato}, chiuso: ${e.nuove} particelle nuove a colore.`);
        break;
      case 'rilievo_fallito':
        if (e.operazione !== 'appunto') this.ponte.notifica(e.messaggio, 'rosso');
        this.log(`rilievo fallito (${e.operazione}): ${e.motivo}`);
        break;
      case 'appunto':
        if (e.messaggio) this.ponte.notifica(e.messaggio);
        break;
      case 'caposaldo_visto':
        this.capisaldiVisti.add(e.caposaldo);
        break;
      case 'variante_cambiata':
        this.log(`variante ${e.elemento}: ${e.da} → ${e.a} (${e.causa}${e.chi ? `, ${e.chi}` : ''})`);
        break;
      case 'resoconto':
        this.log(`resoconto della notte ${e.resoconto.notte}: ${e.resoconto.testo.join(' / ')}`);
        this.ponte.resocontoDelMattino(e.resoconto);
        break;
      default:
        break;
    }
  }

  /** Accende un flag del contratto col motore (una volta). */
  flag(nome: string): void {
    if (!this.narrativa.flag.vero(nome)) {
      this.narrativa.flag.set(nome);
      this.log(`flag ${nome}`);
    }
  }

  spegni(nome: string): void {
    if (this.narrativa.flag.vero(nome)) this.narrativa.flag.rimuovi(nome);
  }

  log(testo: string): void {
    const voce = `[g${this.orologio.giorno} ${this.testoOra()}] ${testo}`;
    this.diario.push(voce);
    if (this.diario.length > 400) this.diario.shift();
  }

  private eventoStoria(nome: string, argomenti: string[]): void {
    const a0 = argomenti[0] ?? '';
    this.log(`evento ${nome} ${argomenti.join(' ')}`);
    switch (nome) {
      case 'orologio':
        this.orologio.comando(argomenti);
        return;
      case 'testo':
        this.ponte.leggi(a0);
        return;
      case 'battuta':
        this.ponte.battuta(a0);
        return;
      case 'suggerimento':
        this.ponte.suggerimento(a0);
        return;
      case 'musica':
        this.audio.tema(a0);
        return;
      case 'suono':
        if (a0 === 'tre_rintocchi') {
          this.audio.evento({ tipo: 'campane', modo: 'ore', ore: 3 });
          this.ponte.suono('[tre rintocchi dal campanile]', 'sotto');
        } else if (a0 === 'campanaccio_dal_cielo') {
          this.audio.evento({ tipo: 'campane', modo: 'rintocco', posizione: cylToWorld(1500, 180, 30) });
          this.ponte.suono('[un campanaccio, lontano, dall\'alto]', 'sopra');
        }
        return;
      case 'pianta':
        this.ui.apriPianta(this.ponte.datiPianta());
        return;
      case 'npc':
        this.abitanti.ordine(argomenti.join(' '));
        return;
      case 'variante': {
        // «variante:E1=Abitata» arriva come ['E1', 'Abitata'] (o ['E1=Abitata'])
        const [el, va] = argomenti.length >= 2 ? argomenti : a0.split('=');
        if (el && va) this.catasto.impostaVariante(el, va);
        return;
      }
      case 'linea_miccia':
        this.audio.evento({ tipo: 'accensione-linea' });
        return;
      case 'passero_vola_in_su':
        this.velatura.passero();
        this.ponte.suono('[un passero si alza dalla botola]', 'sopra');
        return;
      case 'velati_si_voltano':
        this.abitanti.voltatiTutti();
        return;
      case 'ottavio_atterra_in_piazza': {
        const pc = this.game.player.cyl;
        const piazza = luogo('piazza_ore')!;
        const inPiazza = this.luoghiQui.has('piazza_ore');
        const z = inPiazza ? pc.z + 3 : pc.z + 14;
        const theta = inPiazza ? pc.theta + 2.5 / METERS_PER_DEG : pc.theta + 14 / METERS_PER_DEG;
        this.abitanti.atterra(inPiazza ? z : (z + piazza.z) / 2, inPiazza ? theta : (theta + piazza.theta) / 2);
        this.ponte.suono('[un frullo di tela, dall\'alto]', 'sopra');
        return;
      }
      default:
        console.info('[regia] evento senza regia:', nome, argomenti);
    }
  }

  private passoAttivato(passo: string): void {
    this.log(`passo attivato: ${passo}`);
    if (passo === 'm1_chiodo2') this.libretto.segnalibro = 'cs_2';
    if (passo === 'm1_primo_rilievo') this.libretto.segnalibro = 'cs_3';
    if (passo === 'm1_strada') this.libretto.segnalibro = 'cs_7';
    this.salvaTra = 1.5;
  }

  private passoCompletato(passo: string): void {
    this.log(`passo completato: ${passo}`);
    if (passo === 'pr_vetro') {
      this.cripta.apriCoperchio();
      this.ponte.battuta('elvira_chi');
      this.audio.evento({ tipo: 'interfaccia', varieta: 'apri' });
    }
    if (passo === 'pr_camminare') this.corpo.affaticata = false;
    if (passo === 'm1_fienile') {
      // fuori dalla porta del fienile (non dentro i muri), fino alle 07:00 del giorno dopo
      const q = this.davantiAlFienile();
      this.abitanti.ottavioFermo(q.z, q.theta, Math.floor(this.orologio.assoluto / 24) * 24 + 24 + 7);
    }
    this.salvaTra = 1.5;
  }

  /** Un punto davanti alla porta del fienile di Ottavio, un passo di lato. */
  private davantiAlFienile(): { z: number; theta: number } {
    const l = luogo('fienile_ottavio')!;
    const porta = this.scena.punto('fienile');
    if (!porta) return { z: l.z - 2, theta: l.theta };
    const p = worldToCyl(porta);
    const dz = p.z - l.z;
    const ds = (p.theta - l.theta) * METERS_PER_DEG;
    const d = Math.hypot(dz, ds) || 1;
    const [uz, us] = [dz / d, ds / d];
    // 1,6 m fuori dalla porta e 1,2 m di lato
    return { z: p.z + uz * 1.6 - us * 1.2, theta: p.theta + (us * 1.6 + uz * 1.2) / METERS_PER_DEG };
  }

  // =================================================================== tempo

  /** Fa scorrere il catasto e la notte fra due tempi assoluti. */
  scorriTempo(iv: Intervallo): void {
    if (iv.a <= iv.da) return;
    this.catasto.scorri(iv, {
      cella: this.cellaElvira(),
      dorme: this.dormendo,
      flag: () => Object.keys(this.narrativa.flag.tutti()).filter((f) => this.narrativa.flag.vero(f)),
    });
    if (attraversa(iv, 5.5).length) this.salvaTra = 2;
  }

  /** Dormire fino a `ore` (effetto «dormi:fino», o il letto di un rifugio). */
  dormi(ore: number): void {
    if (this.dormendo) return;
    this.dormendo = true;
    this.log(`dorme fino alle ${fmtOra(ore)}`);
    // (un dialogo che ha deciso il sonno, «Dormo.», finisce da sé: non si interrompe)
    this.velatura.alNero(0.01);
    if (this.narrativa.flag.vero('dorme_casa_velo')) {
      const cv = luogo('casa_del_velo')!;
      this.vai(cv.z, cv.theta);
    }
    const iv = this.orologio.saltaA(ore);
    this.scorriTempo(iv);
    this.dormendo = false;
    this.controllo = { tipo: 'libero' };
    this.narrativa.tick(0);
    this.velatura.dalNero(2.6);
    this.salvaTra = 2;
  }

  /** «Aspetta fino a» (da seduti). */
  aspettaFino(scelta: number | 'meta'): void {
    if (scelta === 'meta') return;
    if (!this.orologio.aspettaFino(scelta, 20)) {
      this.ponte.notifica('Il tempo non passa ancora: c\'è qualcosa da fare.');
      return;
    }
    this.attesaVicini = this.personeVicine(10);
    this.log(`aspetta fino alle ${fmtOra(scelta)}`);
  }

  vociAttesa(): { testo: string; ore: number }[] {
    const o = this.orologio.ore;
    const v: { testo: string; ore: number }[] = [];
    // chi si cerca per l'obiettivo e non c'è ancora (le indicazioni sanno quando arriva)
    const a = this.guida.arrivo;
    if (a && a.giorno === this.orologio.giorno && a.ore > o + 1 / 60 && o >= 5.5 && a.ore <= 20) v.push({ testo: `le ${fmtOra(a.ore)}, quando arriva qualcuno`, ore: a.ore });
    if (this.narrativa.flag.vero('aspetta_brace_sbloccato') && o < 19.5 && o >= 5.5) v.push({ testo: 'la brace (19:30)', ore: 19.5 });
    if (o >= 19 || this.narrativa.flag.vero('scelta_vegliare')) v.push({ testo: 'mezzanotte', ore: 0 });
    if (o >= 21 || o < 5.5) v.push({ testo: "l'alba (05:30)", ore: 5.5 });
    if (o >= 5.5 && o < 20) v.push({ testo: "fra un'ora", ore: (o + 1) % 24 });
    return v;
  }

  /** Chi è entro `raggio` m da Elvira (Ottavio no: è il compagno di strada e le si siede accanto). */
  private personeVicine(raggio = 4): Set<string> {
    const pc = this.game.player.cyl;
    return new Set(this.abitanti.vicini(pc.z, pc.theta, raggio, ['ottavio']));
  }

  testoOra(): string {
    return fmtOra(this.orologio.ore);
  }

  /** Secondi reali al prossimo passaggio della Meta. */
  secondiAllaMeta(): number {
    const t = this.game.simTime - this.metaFase;
    return PERIODO_META - (((t % PERIODO_META) + PERIODO_META) % PERIODO_META);
  }

  resocontoVisibile(): Resoconto | null {
    return this.catasto.resocontoDelMattino(this.orologio.giorno, this.orologio.ore);
  }

  // =================================================================== corpo

  private posa(z: number, theta: number, h: number): void {
    const p = this.game.player;
    cylToWorld(z, theta, h, p.pos);
    worldToCyl(p.pos, p.cyl);
    p.vel.set(0, 0, 0);
    p.grounded = true;
    p.mode = 'walk';
    p.veloOpen = false;
    p.veloAmount = 0;
  }

  /** I piedi messi in modo che gli occhi siano nella capsula, sotto il vetro. */
  private posaSdraiata(): void {
    const o = worldToCyl(this.cripta.occhiSdraiata);
    this.posa(o.z, o.theta, o.h - OCCHI);
  }

  private controlloCorpo(dt: number): boolean {
    const c = this.controllo;
    switch (c.tipo) {
      case 'libero':
        return false;
      case 'sdraiata':
        this.posaSdraiata();
        return true;
      case 'alzandosi': {
        c.t = Math.min(1, c.t + dt / 1.4);
        const o = worldToCyl(this.cripta.occhiSdraiata);
        const p = this.cripta.inPiedi;
        const k = c.t * c.t * (3 - 2 * c.t);
        const z = o.z + (p.z - o.z) * k;
        const theta = o.theta + (p.theta - o.theta) * k;
        const hOcchi = o.h + (QUOTA_CRIPTA + OCCHI - o.h) * k;
        this.posa(z, theta, hOcchi - OCCHI);
        if (c.t >= 1) {
          this.controllo = { tipo: 'libero' };
          this.game.player.teleport(p.z, p.theta, 0);
        }
        return true;
      }
      case 'scala': {
        const inp = this.game.input;
        const su = (inp.isDown('KeyW') || inp.isDown('ArrowUp') || inp.isDown('Space') ? 1 : 0) - (inp.isDown('KeyS') || inp.isDown('ArrowDown') ? 1 : 0);
        if (!this.ui.inputCatturato) c.y = Math.max(0, Math.min(SCALA.cima, c.y + su * 1.15 * dt));
        if (c.y <= 0 && su < 0) {
          this.controllo = { tipo: 'libero' };
          const p = this.cripta.ancora.cyl(SCALA.e, SCALA.n + 0.7);
          this.game.player.teleport(p.z, p.theta, 0);
          return false;
        }
        const p = this.cripta.ancora.cyl(SCALA.e, SCALA.n + 0.45, c.y);
        this.posa(p.z, p.theta, p.h);
        return true;
      }
      case 'seduta':
      case 'piantato':
        this.posa(c.z, c.theta, c.h);
        return true;
      case 'dorme':
        return true;
    }
  }

  /** Elvira si alza dalla capsula (comando «alzati»). */
  alzati(): void {
    if (this.controllo.tipo !== 'sdraiata') return;
    this.controllo = { tipo: 'alzandosi', t: 0 };
    this.velatura.respiro();
  }

  siedi(dove?: { z: number; theta: number; h: number }): void {
    if (this.controllo.tipo !== 'libero' || !this.game.player.grounded) return;
    const pc = this.game.player.cyl;
    const s = dove ?? { z: pc.z, theta: pc.theta, h: pc.h };
    this.controllo = { tipo: 'seduta', z: s.z, theta: s.theta, h: s.h - 0.5 };
    this.corpo.seduta = true;
    this.flag('seduta');
    this.log('si siede');
  }

  alzaDaSeduta(): void {
    if (this.controllo.tipo !== 'seduta') return;
    const c = this.controllo;
    this.controllo = { tipo: 'libero' };
    this.corpo.seduta = false;
    this.spegni('seduta');
    this.orologio.interrompiAttesa();
    this.ponte.chiudiAttesa();
    this.game.player.teleport(c.z, c.theta, quotaAppoggio(this.game.world.colliders, c.z, c.theta), true);
  }

  saliScala(): void {
    if (this.controllo.tipo !== 'libero' || this.interno !== 'cripta') return;
    this.controllo = { tipo: 'scala', y: 0.05 };
    this.guardaDirezione(0, 55);
  }

  /** In cima alla scala: si spinge la botola ed Elvira esce sotto il castagno morto. */
  esciDallaBotola(): void {
    this.cripta.apriBotola();
    this.scena.apriBotola(true);
    this.interno = null;
    this.applicaInterno();
    this.controllo = { tipo: 'libero' };
    // accanto alla botola del popolamento, dalla parte opposta al tronco, con il paese davanti
    const pb = this.scena.punto('botola');
    const pt = this.scena.punto('castagno_morto');
    const b = pb ? worldToCyl(pb) : { ...luogo('botola')!, h: 0 };
    const t = pt ? worldToCyl(pt) : { z: b.z + 2, theta: b.theta };
    const dz = b.z - t.z;
    const ds = (b.theta - t.theta) * METERS_PER_DEG;
    const d = Math.hypot(dz, ds) || 1;
    const z = b.z + (dz / d) * 1.3;
    const theta = b.theta + ((ds / d) * 1.3) / METERS_PER_DEG;
    this.game.player.teleport(z, theta, quotaAppoggio(this.game.world.colliders, z, theta), true);
    const piazza = luogo('piazza_ore')!;
    this.guardaDirezione((Math.atan2((piazza.theta - theta) * METERS_PER_DEG, piazza.z - z) * 180) / Math.PI, 8);
    this.corpo.affaticata = !this.narrativa.valuta('passo:pr_camminare completato');
    if (this.orologio.fermo !== null) {
      // l'orologio riparte: sono le 05:39
      this.orologio.fermo = null;
      this.orologio.ore = 5 + 39 / 60;
    }
    this.velatura.dalBianco(1.6);
    this.audio.evento({ tipo: 'interfaccia', varieta: 'apri' });
    this.aggiornaLuoghi();
    this.narrativa.tick(0);
    this.log('esce dalla botola');
  }

  /** Dalla botola si torna giù nella Cripta (resta aperta per tutto il gioco). */
  entraNellaCripta(): void {
    this.interno = 'cripta';
    this.applicaInterno();
    this.controllo = { tipo: 'scala', y: SCALA.cima };
    this.guardaDirezione(180, -40);
    this.velatura.dalNero(0.8);
  }

  saliCampanile(): void {
    const d = this.cella.dentro;
    this.interno = 'cella';
    this.applicaInterno();
    this.game.player.teleport(d.z, d.theta, d.h, true);
    this.guardaDirezione(d.yaw, 6);
    this.velatura.dalNero(0.9);
    this.audio.evento({ tipo: 'passo', superficie: 'legno' });
  }

  scendiCampanile(): void {
    const f = this.cella.fuori;
    this.interno = null;
    this.applicaInterno();
    this.game.player.teleport(f.z, f.theta, 0);
    this.guardaDirezione(f.yaw, 0);
    this.velatura.dalNero(0.9);
  }

  /** Teletrasporto della regia (debug, prove): fuori dagli interni, in piedi. */
  vai(z: number, theta: number, altezza = 0): void {
    if (this.controllo.tipo === 'piantato') this.squadro.stacca();
    this.controllo = { tipo: 'libero' };
    this.corpo.seduta = false;
    this.spegni('seduta');
    this.interno = null;
    this.applicaInterno();
    this.game.setFreeCamera(false);
    // sul ripiano o sul gradino, se c'è (le terrazze del popolamento stanno sopra il terreno)
    if (altezza === 0) this.game.player.teleport(z, theta, quotaAppoggio(this.game.world.colliders, z, theta), true);
    else this.game.player.teleport(z, theta, altezza);
    this.game.syncEyeNow();
    this.aggiornaLuoghi();
  }

  private applicaInterno(): void {
    const cam = this.game.camera;
    const near = this.interno === 'cripta' ? 0.05 : 0.3;
    if (cam.near !== near) {
      cam.near = near;
      cam.updateProjectionMatrix();
    }
  }

  // =================================================================== squadro

  private collegaSquadro(): void {
    const s = this.squadro;
    s.eventi.on('piantato', ({ caposaldo: id }) => {
      const ch = this.chiodo(id);
      if (!ch) return;
      const avanti = this.game.rig.forward(new Vector3());
      const verso = ch.clone().add(avanti);
      const piedi = Squadro.piediDavantiAlChiodo(ch, verso, 0.7);
      // in piedi dov'è (il ripiano della terrazza, la copertina di un muro): non sotto, sul terreno del motore
      const pl = this.game.player;
      const hp = this.interno === 'cella' ? this.cella.quotaPavimento : Math.max(groundHeight(piedi.z, piedi.theta), pl.grounded ? pl.cyl.h : -Infinity);
      this.controllo = { tipo: 'piantato', z: piedi.z, theta: piedi.theta, h: hp };
      this.capisaldiVisti.add(id);
      this.audio.evento({ tipo: 'squadro-pianta', posizione: ch });
      if (!this.narrativa.flag.vero('bolla_spiegata')) {
        this.ui.indicazioni.suggerimento('Livella: centra la bolla con A e D');
        this.narrativa.flag.set('bolla_spiegata');
      }
      this.log(`squadro piantato su ${id}`);
    });
    s.eventi.on('livellato', () => {
      this.audio.evento({ tipo: 'bolla-livellata' });
      this.ponte.suggerimento('collima');
    });
    s.eventi.on('staccato', () => {
      if (this.controllo.tipo === 'piantato') {
        const c = this.controllo;
        this.controllo = { tipo: 'libero' };
        this.game.player.teleport(c.z, c.theta, c.h, true);
      }
    });
    s.eventi.on('collimato', ({ stazione, mira }) => this.collimato(stazione, mira));
    s.eventi.on('appunto', (a) => this.appunto(a.bersaglio, a.cella, a.distanza));
    s.eventi.on('mira', (m) => (this.mira = { b: m.bersaglio, d: m.distanza, t: m.tenuta }));
  }

  /** I contenuti dicono che da `stazione` il segnale di `mira` è coperto (il tasso, la tettoia)? */
  segnaleCoperto(stazione: string | null, mira: string): boolean {
    return this.ostacoloFra(stazione, mira) !== null;
  }

  /** Che cosa copre il segnale di `mira` da `stazione` («il tasso del sagrato»), o null. */
  ostacoloFra(stazione: string | null, mira: string): string | null {
    return ostacoloFra(stazione, mira);
  }

  /** Il chiodo di un caposaldo (mondo). */
  chiodo(id: string): Vector3 | null {
    if (id === 'cs_1') return this.cella.punti['chiodo_cs_1']!.clone();
    return this.scena.punto(`chiodo_${id}`);
  }

  piantaSquadro(id: string): void {
    if (!this.squadro.disponibile) return;
    if (this.squadro.stato === 'riposto') this.squadro.prendi();
    this.squadro.pianta(id);
  }

  private collimato(stazione: string, mira: string): void {
    this.capisaldiVisti.add(mira);
    const r = this.catasto.rileva(stazione, mira, this.orologio.ore, this.orologio.giorno, this.corpo.fiato < 0.15);
    this.log(`collima ${stazione} → ${mira}: ${r.ok ? 'lato chiuso' : (r.motivo ?? 'no')}`);
  }

  private appunto(bersaglio: string | null, cella: number | null, _distanza: number): void {
    let b: BersaglioCatasto | null = null;
    if (bersaglio?.startsWith('segnale_')) b = { caposaldo: bersaglio.slice(8) };
    else if (bersaglio?.startsWith('lume_')) b = { caposaldo: bersaglio.slice(5) };
    else if (bersaglio === 'lanterna') b = { lanterna: true };
    else if (bersaglio === 'tecla') b = { lume: 'tecla' };
    else if (cella !== null) b = { cella };
    if (!b) return;
    const o = worldToCyl(this.occhi(new Vector3()));
    const r = this.catasto.appunta(b, this.orologio.ore, { z: o.z, theta: o.theta, altezza: o.h });
    if (r.ok && 'cella' in b) {
      const iz = Math.floor(b.cella / 96);
      const it = b.cella % 96;
      this.ponte.notifica(`Appuntato: particella ${nomeCatastale(iz, it)}.`);
    }
    this.log(`appunto ${JSON.stringify(b)}: ${r.ok ? 'ok' : r.motivo}`);
  }

  /** I bersagli del cannocchiale adesso: segnali dei capisaldi, la Lanterna, i lumi della notte. */
  private bersagliMira(): BersaglioMira[] {
    const out: BersaglioMira[] = [];
    const largo = this.ui.impostazioni.get('collimazioneAgganciata') ? 1.6 : 0.9;
    for (const c of CAPISALDI) {
      const p = this.scena.punto(`segnale_${c.id}`);
      if (p) out.push({ id: `segnale_${c.id}`, nome: c.nome, posizione: p, tolleranza: largo, caposaldo: c.id });
    }
    out.push({ id: 'lanterna', nome: 'la Lanterna', posizione: cylToWorld(2968, 0, 642), tolleranza: 1.5 });
    const o = this.orologio.ore;
    const notte = o >= 20 || o < 5.5;
    const tecla = this.notteVista.tecla;
    if (tecla) out.push({ id: 'tecla', nome: 'una lanterna che cammina', posizione: tecla, tolleranza: 1.2 });
    if (notte) {
      for (const l of LONTANI) {
        if (l.lume !== 'permanente') continue;
        const pos = this.scena.punto(`segnale_${l.id}`) ?? cylToWorld(l.z, l.theta, l.altezza + 2);
        out.push({ id: `lume_${l.id}`, nome: l.lume_descrizione ?? l.nome, posizione: pos, tolleranza: 1.2 });
      }
    }
    return out;
  }

  // =================================================================== sguardo, tasti

  /** Occhi di Elvira (mondo), calcolati dai piedi (validi anche senza disegnare). */
  occhi(out: Vector3): Vector3 {
    const p = this.game.player;
    localFrameAt(p.pos, _f, p.cyl.theta);
    if (this.controllo.tipo === 'seduta') return out.copy(p.pos).addScaledVector(_f.up, OCCHI);
    return out.copy(p.pos).addScaledVector(_f.up, OCCHI);
  }

  yawPitch(): { yaw: number; pitch: number } {
    const p = this.game.player;
    localFrameAt(p.pos, _f, p.cyl.theta);
    const d = this.game.rig.forward(_v);
    const pitch = Math.asin(Math.max(-1, Math.min(1, d.dot(_f.up))));
    const yaw = Math.atan2(d.dot(_f.east), d.dot(_f.north));
    return { yaw: yaw / DEG, pitch: pitch / DEG };
  }

  /** Direzione dello sguardo sulla Pianta (gradi: 0 = verso Lag, 90 = a Mane). */
  direzioneSguardo(): number {
    return ((this.yawPitch().yaw % 360) + 360) % 360;
  }

  /** Orienta lo sguardo verso un punto del mondo. */
  guarda(p: Vector3): void {
    const occhi = this.occhi(new Vector3());
    localFrameAt(this.game.player.pos, _f, this.game.player.cyl.theta);
    const d = _w.subVectors(p, occhi).normalize();
    const pitch = Math.asin(Math.max(-1, Math.min(1, d.dot(_f.up))));
    const yaw = Math.atan2(d.dot(_f.east), d.dot(_f.north));
    this.game.setView(yaw / DEG, pitch / DEG);
    this.game.syncEyeNow();
  }

  /** Volta lo sguardo verso un punto in `secondi` (chi comincia a parlare, una voce dall'alto). */
  voltatiVerso(p: Vector3, secondi = 0.7): void {
    const da = this.yawPitch();
    const occhi = this.occhi(new Vector3());
    localFrameAt(this.game.player.pos, _f, this.game.player.cyl.theta);
    const d = _w.subVectors(p, occhi).normalize();
    const pitch = Math.asin(Math.max(-1, Math.min(1, d.dot(_f.up)))) / DEG;
    const yaw = Math.atan2(d.dot(_f.east), d.dot(_f.north)) / DEG;
    this.sguardoGuidato = { da, a: { yaw, pitch: Math.max(-35, Math.min(45, pitch)) }, t: 0, durata: secondi };
  }

  private sguardoGuidato: { da: { yaw: number; pitch: number }; a: { yaw: number; pitch: number }; t: number; durata: number } | null = null;

  private guidaSguardo(dt: number): void {
    const s = this.sguardoGuidato;
    if (!s) return;
    s.t = Math.min(1, s.t + dt / s.durata);
    const k = s.t * s.t * (3 - 2 * s.t);
    const dy = ((((s.a.yaw - s.da.yaw) % 360) + 540) % 360) - 180;
    this.game.setView(s.da.yaw + dy * k, s.da.pitch + (s.a.pitch - s.da.pitch) * k);
    if (s.t >= 1) this.sguardoGuidato = null;
  }

  guardaDirezione(yaw: number, pitch: number): void {
    this.game.setView(yaw, pitch);
    this.game.syncEyeNow();
  }

  private tasti(): void {
    const inp = this.game.input;
    const inv = this.narrativa.inventario;
    if (inp.consumePressed('KeyQ') && inv.ha('lente')) {
      this.lente = !this.lente;
      this.audio.evento({ tipo: 'interfaccia', varieta: this.lente ? 'apri' : 'chiudi' });
    }
    if (inp.consumePressed('KeyL') && inv.ha('libretto')) this.ponte.apriLibretto();
    if (inp.consumePressed('KeyV') && inv.ha('velo_nero')) {
      if (this.narrativa.flag.vero('velo_indossato')) {
        this.spegni('velo_indossato');
        this.ponte.notifica('Ti togli il velo nero.');
      } else {
        this.flag('velo_indossato');
        this.ponte.notifica('Indossi il velo nero.');
      }
    }
    if (inp.consumePressed('KeyG')) this.fischia();
    if (inp.consumePressed('KeyX') && this.controllo.tipo === 'seduta') {
      if (this.ponte.attesaAperta) this.ponte.chiudiAttesa();
      else this.ponte.apriAttesa(this.vociAttesa());
    }
    // sedersi: C tenuto (o premuto con «azioni: premi»); alzarsi: C o un tasto di movimento
    if (this.controllo.tipo === 'seduta') {
      inp.consumePressed('KeyC') ? this.alzaDaSeduta() : null;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].some((k) => inp.isDown(k)) && !this.ponte.attesaAperta) this.alzaDaSeduta();
      this.tenutaC = 0;
    } else if (this.controllo.tipo === 'libero') {
      const premi = this.ui.impostazioni.get('azioniTenute') === 'premi';
      if (inp.isDown('KeyC')) this.tenutaC += 1 / 60;
      else this.tenutaC = 0;
      if ((premi && inp.consumePressed('KeyC')) || this.tenutaC >= 0.4) {
        this.tenutaC = 0;
        inp.consumePressed('KeyC');
        this.siedi();
      }
    } else inp.consumePressed('KeyC');
    if (this.controllo.tipo === 'piantato' && (inp.isDown('KeyW') || inp.isDown('KeyS'))) this.squadro.stacca();
  }

  /** Il fischio: Ottavio scende dal cielo se è in volo (FASE1 M1.19). */
  fischia(): void {
    this.ponte.suono('[Elvira fischia]');
    if (this.abitanti.presente('ottavio') || !this.narrativa.flag.vero('ottavio_conosciuto')) return;
    const o = this.orologio.ore;
    if (o < 6 || o >= 20.5) return;
    const pc = this.game.player.cyl;
    const z = pc.z + 4;
    const theta = pc.theta + 3 / METERS_PER_DEG;
    this.abitanti.atterra(z, theta, { tipo: 'fermo', z, theta, fino: this.orologio.assoluto + 2 });
  }

  private superficie(): 'erba' | 'pietra' | 'legno' | 'ghiaia' {
    if (this.interno === 'cripta') return 'pietra';
    if (this.interno === 'cella') return 'legno';
    if (this.luoghiQui.has('passerella_messo') && this.catasto.variante('E1') === 'Abitata') return 'legno';
    if (this.luoghiQui.has('piazza_ore') || this.luoghiQui.has('sagrato') || this.luoghiQui.has('lavatoio')) return 'pietra';
    return 'erba';
  }

  private cellaElvira(): number | null {
    const pc = this.game.player.cyl;
    return this.game.world.cellAt(pc.z, pc.theta);
  }

  aggiornaLuoghi(): void {
    const pc = this.game.player.cyl;
    this.luoghiQui.clear();
    if (this.interno === 'cripta') {
      for (const id of ['cripta_capsula_5', 'cripta_sala', 'cripta_corridoio', 'cripta_scala']) if (this.luoghi.dentro(id, pc.z, pc.theta, pc.h)) this.luoghiQui.add(id);
      // la sala e il corridoio nel segnaposto sono più grandi dei raggi dei contenuti
      this.luoghiQui.add('cripta_sala');
      return;
    }
    for (const id of this.luoghi.doveSono(pc.z, pc.theta, pc.h)) this.luoghiQui.add(id);
  }

  // =================================================================== passo e fotogramma

  update(dt: number): void {
    if (this.fase !== 'gioco') return;
    const g = this.game;
    const ui = this.ui;
    const catturato = ui.inputCatturato || this.ponte.attesaAperta;
    const premuto = this.ePremuto && !ui.inputCatturato;
    this.ePremuto = false;
    if (!catturato) this.tasti();
    this.squadro.bloccato = ui.inputCatturato || this.controllo.tipo === 'sdraiata' || this.controllo.tipo === 'scala' || this.interno === 'cripta';
    g.movimentoBloccato = catturato || this.controllo.tipo !== 'libero';

    // dove sono, il corpo
    this.aggiornaLuoghi();
    const p = g.player;
    const libero = this.controllo.tipo === 'libero' || this.controllo.tipo === 'seduta';
    if (libero) {
      const corre = g.input.isDown('ShiftLeft') || g.input.isDown('ShiftRight');
      for (const e of this.corpo.aggiorna(dt, { grounded: p.grounded, veloOpen: p.veloOpen, velocita: p.grounded ? p.vel.length() : 0, corre, z: p.cyl.z, theta: p.cyl.theta, h: p.cyl.h })) {
        if (e.tipo === 'fiato_corto') this.flag('fiato_corto');
        else if (e.tipo === 'atterraggio') this.atterraggio(e.planata, e.decollo, e.dove.theta);
      }
    }
    this.limitaVelocita();
    this.letteraDaSeduta();
    this.campaneDiRiserva(dt);

    // tempo (fermo quando l'interfaccia lo chiede: pausa, carte, menu)
    if (!ui.tempoFermo) {
      if (this.orologio.inAttesa) {
        const vicini = this.personeVicine();
        if ([...vicini].some((v) => !this.attesaVicini.has(v)) || this.controllo.tipo !== 'seduta') this.orologio.interrompiAttesa();
      }
      const iv = this.orologio.avanza(dt);
      this.scorriTempo(iv);
    }
    g.clock.running = false;
    g.clock.setHours(this.orologio.ore);

    // sguardi e interazioni
    this.guidaSguardo(dt);
    const occhi = this.occhi(new Vector3());
    const avanti = g.rig.forward(new Vector3());
    this.sguardi.update(dt, occhi, avanti);
    this.indicazioneLente = this.cercaPuntoLente(occhi, avanti);
    this.statoInterazione = this.interazioni.update(dt, occhi, avanti, catturato ? null : { premuto, tenuto: g.input.isDown('KeyE'), modoPremi: ui.impostazioni.get('azioniTenute') === 'premi' });

    // il mondo che si muove
    this.cripta.update(dt);
    this.scena.update(dt);
    this.abitanti.update(dt, {
      giorno: this.orologio.giorno,
      ore: this.orologio.ore,
      assoluto: this.orologio.assoluto,
      valuta: (c) => this.narrativa.valuta(c),
      occhi,
      elvira: { z: p.cyl.z, theta: p.cyl.theta },
    });
    this.aggiornaMeta();

    // la storia (10 volte al secondo)
    this.accTick += dt;
    if (this.accTick >= 0.1) {
      this.narrativa.tick(this.accTick);
      this.accTick = 0;
    }
    this.dialoghi.update();
    this.ombrista();
    this.campane();
    if (!this.interno) {
      const cella = this.cellaElvira();
      if (cella !== null) this.catasto.passa(p.cyl.z, p.cyl.theta, cella);
      this.capisaldiTrovati(occhi);
    }
    this.ponte.sonda(dt);
    this.guida.update(dt);

    // salvataggio automatico (ogni passo di missione e a ogni alba)
    if (this.salvaTra > 0) {
      this.salvaTra -= dt;
      if (this.salvaTra <= 0 && !this.dormendo) void this.salva();
    }
  }

  /** Un chiodo trovato a 1,5 m diventa «visto» (sulla Pianta compare il triangolino). */
  private capisaldiTrovati(occhi: Vector3): void {
    for (const c of CAPISALDI) {
      if (this.capisaldiVisti.has(c.id)) continue;
      const ch = this.chiodo(c.id);
      if (ch && ch.distanceTo(occhi) < 2.2) {
        this.capisaldiVisti.add(c.id);
        this.catasto.segnaVisto(c.id);
      }
    }
  }

  private atterraggio(planata: boolean, decollo: { z: number; theta: number; h: number } | null, theta: number): void {
    if (planata) {
      this.flag('planata_fatta');
      if (decollo) {
        for (const l of this.luoghi.tutti) {
          if (l.tipo !== 'muro' && l.tipo !== 'belvedere') continue;
          const d = Math.hypot(decollo.z - l.z, (decollo.theta - l.theta) * METERS_PER_DEG);
          if (d <= l.raggio + 6) this.flag(`planata:${l.id}`);
        }
      }
    }
    const s = stripAt(theta).id;
    if ((s === 'valle-2' || s === 'valle-3') && planata) this.flag('atterrata_altra_valle');
  }

  private limitaVelocita(): void {
    const t = this.game.player.tunables;
    const n = this.narrativa;
    let passo = 4.2;
    let corsa = 7.2;
    if (this.interno === 'cripta' && !n.valuta('passo:pr_botola_scala completato')) {
      passo = 0.9;
      corsa = 0.9;
    } else if (!n.valuta('passo:pr_camminare completato') && n.valuta('missione:prologo attiva')) {
      // le gambe di due secoli: con Shift solo una corsetta zoppicante (e il fiato cala per metro)
      passo = 2.1;
      corsa = 3.2;
    }
    const k = this.corpo.fattoreVelocita;
    t.walkSpeed = passo * k;
    t.runSpeed = corsa * k;
  }

  private aggiornaMeta(): void {
    const t = this.game.simTime - this.metaFase;
    const k = Math.floor(t / PERIODO_META);
    if (this.metaPrecedente >= 0 && k > this.metaPrecedente) {
      if (!this.interno) {
        this.flag('prima_meta_vista');
        this.flag('meta_appena_passata');
        this.metaImpulso = this.game.simTime + 5;
        if (this.game.sky.night < 0.8) this.velatura.lampo();
        this.log('passa la Meta');
      }
    }
    this.metaPrecedente = k;
    if (this.metaImpulso > 0 && this.game.simTime > this.metaImpulso) {
      this.metaImpulso = -1;
      this.spegni('meta_appena_passata');
    }
  }

  /** L'Ombrista alle 19:45: la scena parte da sola se Elvira è in piazza. */
  private ombrista(): void {
    const o = this.orologio.ore;
    if (o < 19.75 || o >= 20.5 || this.ombristaSera === this.orologio.giorno) return;
    if (this.ui.inputCatturato) return;
    const t = luogo('telo_ombrista')!;
    const pc = this.game.player.cyl;
    if (Math.hypot(pc.z - t.z, (pc.theta - t.theta) * METERS_PER_DEG) > 35) return;
    const scena = this.narrativa.scenaDisponibile('leggende');
    this.ombristaSera = this.orologio.giorno;
    if (scena) {
      this.ponte.suono('[la lampada a olio si accende dietro il telo]');
      this.ponte.recitaScena(scena);
      this.log(`ombrista: ${scena}`);
    }
  }

  private campane(): void {
    const si = this.narrativa.flag.vero('campane_ore');
    if (si !== this.campaneAttive) {
      this.campaneAttive = si;
      this.audio.campaneOrarie(si, this.cella.punti['altoparlante_cella']!);
    }
  }

  render(frameDt: number): void {
    const g = this.game;
    const ui = this.ui;
    // la pausa ferma il mondo; dialoghi, carte, taccuino e Pianta no (il tempo lo ferma la regia)
    const inPausa = this.fase === 'gioco' && (ui.pausa.visible || ui.pannelloImpostazioni.visible || ui.crediti.visible);
    g.loop.paused = inPausa || this.fase === 'titolo';
    this.audio.pausa(inPausa);
    if (this.fase !== 'gioco') {
      this.guida.render(frameDt);
      ui.indicazioni.azione(null);
      ui.indicazioni.squadro(null);
      return;
    }
    // luci delle figure: dall'asse, come la Linea
    const s = g.sky;
    const p = g.camera.position;
    upAt(worldToCyl(p).theta, _v);
    this.sole.position.copy(p).addScaledVector(_v, 50).addScaledVector(_w.set(0, 0, 1), 18);
    this.sole.target.position.copy(p);
    this.sole.intensity = 0.25 + 1.5 * s.sunIntensity;
    this.sole.color.setRGB(s.sunColor[0], s.sunColor[1], s.sunColor[2]);
    this.emisfero.intensity = 0.45 + 0.75 * s.sunIntensity;
    // indicazioni
    const st = this.statoInterazione;
    const b = st.bersaglio;
    const lente = !b && !ui.inputCatturato ? this.indicazioneLente : null;
    ui.indicazioni.azione(b && !ui.inputCatturato ? { tasto: 'E', testo: typeof b.verbo === 'function' ? b.verbo() : b.verbo, ...(st.progresso !== null ? { progresso: st.progresso } : {}) } : lente);
    ui.indicazioni.mostraPuntino(!!b && ui.impostazioni.get('puntino'));
    ui.indicazioni.fiato(this.corpo.fiato < 0.99 ? this.corpo.fiato : null);
    ui.indicazioni.velo(g.player.veloOpen ? Math.min(1, g.player.veloAmount) : null);
    // da una stazione da cui i contenuti dicono che il segnale non si vede: il buio verde del tasso
    const ostacolo = this.squadro.telescopio && this.squadro.stato === 'piantato' && this.mira.b?.caposaldo ? this.ostacoloFra(this.squadro.stazione, this.mira.b.caposaldo) : null;
    const coperto = ostacolo !== null;
    this.velatura.fogliame(coperto);
    if (this.squadro.telescopio) {
      const m = this.mira;
      ui.indicazioni.squadro({
        ...(m.b && !coperto ? { caposaldo: m.b.nome, dettaglio: `${Math.round(m.d)} m` } : {}),
        ...(coperto ? { dettaglio: `${ostacolo} copre la mira` } : {}),
        ...(this.squadro.stato === 'piantato' ? { livella: this.squadro.bolla } : {}),
        ingrandimento: 4,
        collimato: !!m.b && m.t > 0.5,
      });
    } else ui.indicazioni.squadro(this.squadro.stato === 'piantato' && !this.squadro.livellato ? { livella: this.squadro.bolla } : null);
    this.velatura.lente(this.lente && !this.squadro.telescopio);
    g.setFovScale(this.squadro.telescopio ? 0.25 : this.lente ? 0.62 : 1);
    // il segnalino dopo il campo visivo della lente e del cannocchiale (la proiezione di adesso)
    this.guida.render(frameDt);
    this.velatura.update(frameDt);
    if (ui.taccuino.visible) ui.taccuino.prossimoEvento(this.ponte.rigaCielo());
    // audio
    const pc = g.player.cyl;
    this.audio.aggiorna(frameDt, {
      occhi: g.camera.position,
      avanti: g.rig.forward(new Vector3()),
      su: upAt(pc.theta, new Vector3()),
      velocita: g.player.vel.length(),
      ore: this.orologio.ore,
      altezza: this.interno === 'cripta' ? 0 : g.player.heightAboveGround,
      inVolo: g.player.veloOpen,
      aTerra: g.player.grounded && this.controllo.tipo === 'libero',
      corre: g.input.isDown('ShiftLeft'),
      superficie: this.superficie(),
      fadeVicine: this.notteVista.vicine(g.camera.position),
    });
    if (g.loop.paused) this.ponte.sonda(frameDt);
  }
}

/** Distanza minima (m) dall'asse del segmento a-b. */
export function distanzaDallAsse(a: Vector3, b: Vector3): number {
  let best = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    best = Math.min(best, Math.hypot(x, y));
  }
  return best;
}

/**
 * Fase della Meta (s): l'istante, dentro i 51 s di una rotazione, in cui la luce della Meta
 * entra di più dalla Finestra dei Ponti (θ 105°) verso Corbella.
 */
export function calcolaFaseMeta(): number {
  const meta = new Vector3(1, 0, 0.08).normalize();
  let best = 0;
  let bv = -Infinity;
  const su = upAt(105);
  for (let i = 0; i < 510; i++) {
    const t = (i / 510) * PERIODO_META;
    const d = rotatingToInertialDir(su, t, new Vector3());
    const v = -d.dot(meta);
    if (v > bv) {
      bv = v;
      best = t;
    }
  }
  return best;
}
