/**
 * Le indicazioni delle missioni nel gioco (richiesta dell'utente: «che cosa devo fare»): il
 * pannello dell'obiettivo in alto a sinistra e il segnalino di direzione sulla meta.
 *
 * - Il passo seguito: il primo passo attivo con un'indicazione della missione principale (il
 *   prologo, poi «Il castagno vuoto»…); in più, in piccolo, al massimo due righe: gli altri passi
 *   attivi della stessa missione (la novizia alla Bacheca mentre si torna dal guado) e, nel gioco
 *   libero (`flag:gioco_libero`), le missioni libere. L'indicazione è quella del passo, o la prima
 *   delle sue `indicazione_se` che vale (vegliare invece di dormire, la passerella salvata).
 * - La meta del segnalino viene dalle tappe del passo (`destinazione.ts`), messe nel mondo qui:
 *   il luogo (al punto vero del paese, se c'è), un punto della regia (la busta, l'armadietto), la
 *   persona dov'è adesso (alla sua testa), il chiodo del caposaldo; se la meta sta in un «dentro»
 *   diverso da quello di Elvira (la Cripta, la cella campanaria), prima la porta: la scala o la
 *   botola, la porta del campanile o la scala per scendere.
 * - Chi non c'è ancora: se la persona da cercare non è nel paese (o non è nel luogo dove la si
 *   cerca), il segnalino va dove arriverà secondo gli orari di personaggi.json e il pannello dice
 *   a che ora («Adesso non c'è nessuno con cui parlare: … arriva alle 07:00»); il menu
 *   dell'attesa propone quell'ora (`arrivo`).
 * - Si sospende sotto i modali, nel titolo, nel sonno, quando la vista è coperta (il nero
 *   dell'inizio, il bianco della botola) e quando l'interfaccia è nascosta; il segnalino anche
 *   nel cannocchiale, sdraiati e quando Elvira è già arrivata.
 *
 * La logica (passo seguito, tappe, meta, attese) gira nel passo fisso, cinque volte al secondo.
 * Il segnalino si proietta a ogni disegno (così resta attaccato alla meta mentre si gira lo
 * sguardo, e scrive nel DOM solo se si sposta di un pixel); la distanza e «in su»/«sotto» si
 * riscrivono otto volte al secondo, le aree del pannello e delle notifiche due.
 */
import { Vector3 } from 'three';
import { riempiSegnaposto, type Atomo, type MissioneDef, type NodoCondizione, type PassoDef } from '../narrativa';
import type { DatiObiettivo, StatoSegnalino, VoceObiettivo } from '../ui';
import { cylToWorld, surfaceDistance, upAt, worldToCyl, type CylCoords } from '../world/cylinder';
import { CAPISALDI, LATI, PUNTI_DEI_LUOGHI, internoDelCaposaldo, internoDelLuogo, personaggio, testoOra } from './contenuti';
import { compilaPasso, tappeDelPasso, type Destinazione, type FontiDestinazione, type PassoDaSeguire } from './destinazione';
import { quotaAppoggio } from './luoghi';
import { prossimoArrivo, type Arrivo } from './orari';
import { distanzaMeta, nuovaProiezione, proietta, scriviDistanza, verticale, type Riquadro } from './segnalino';
import { TASTI_SEGNATI } from './tasti';
import type { Regia } from './regia';

/** Missioni che il pannello segue per prime. */
const TIPI_PRINCIPALI = new Set(['prologo', 'principale']);
/** Missioni mostrate in piccolo sotto (dopo il prologo). */
const TIPI_SECONDARI = new Set(['libero', 'secondaria']);

/** Altezze del segnalino sopra la meta (m). */
const SOPRA_LUOGO = 1.4;
const SOPRA_PUNTO = 0.6;
/** Sopra la testa vera (l'osso «testa»: segue chi è seduto, chi è basso). */
const SOPRA_TESTA = 0.45;
const SOPRA_CHIODO = 0.9;
/** Sopra un oggetto da usare (la busta, l'armadietto). */
const SOPRA_OGGETTO = 0.3;
/** Entro queste distanze (m) la meta è raggiunta e il segnalino si spegne. */
const VICINO_PERSONA = 3.2;
const VICINO_CHIODO = 2.6;
const VICINO_PASSAGGIO = 2.3;
const VICINO_OGGETTO = 1.0;
/** Una persona cercata in un luogo «c'è» se sta entro il raggio del luogo più questo (m). */
const ATTORNO_AL_LUOGO = 14;
/** Una posizione dell'orario cominciata da meno di tanto (ore) vale ancora: la persona sta arrivando. */
const IN_RITARDO = 0.25;

/** Ogni quanto (s) si ricalcolano il passo seguito, il pannello, le tappe e la meta. */
const PASSO_LOGICA = 0.2;
/** Ogni quanto (s) si riscrivono la distanza e «in su»/«sotto». */
const PASSO_TESTO = 0.125;
/** Ogni quanto (s) si rileggono le aree del pannello e delle notifiche. */
const PASSO_AREA = 0.5;
/** Il segnalino che cadrebbe sotto il pannello o le notifiche scende di tanto sotto il loro orlo (px). */
const SOTTO_AREA = 34;
const MARGINE_AREA = 24;

/** Il testo di un'indicazione con i tasti fra graffe (il pannello li disegna come tastini). */
export function indicazioneConTasti(testo: string): string {
  return riempiSegnaposto(testo, TASTI_SEGNATI);
}

interface Seguito {
  chiave: string;
  missione: MissioneDef;
  passo: PassoDef;
}

/** La meta scelta fra le tappe, pronta da mettere nel mondo. */
type Bersaglio = { tipo: 'luogo'; id: string } | { tipo: 'persona'; id: string } | { tipo: 'caposaldo'; id: string } | { tipo: 'punto'; id: string };

interface Scelta {
  bersaglio: Bersaglio | null;
  /** La riga dell'attesa per il pannello (chi arriva e quando), con i segnaposto dei tasti. */
  attesa: string | null;
  arrivo: Arrivo | null;
}

type Area = { sinistra: number; destra: number; sotto: number };

export class GuidaObiettivi {
  private seguito: Seguito | null = null;
  /**
   * Luoghi attraversati durante il passo seguito che la narrativa non vede (la scala alla
   * marinara); gli altri li ricorda lei per il passo, anche nel salvataggio.
   */
  private readonly raggiuntiQui = new Set<string>();
  private tappe: Destinazione[] = [];
  private bersaglio: Bersaglio | null = null;
  private arrivoAttuale: Arrivo | null = null;
  private readonly compilati = new Map<string, PassoDaSeguire>();
  private readonly varianti = new Map<string, (NodoCondizione | null)[]>();
  private readonly aperture = new Map<string, NodoCondizione | null>();
  private indice: { accende: Map<string, string[]>; conta: Map<string, Set<string>> } | null = null;
  private readonly posizioniLuoghi = new Map<string, Vector3>();
  /** Punti fissi del paese e dei chiodi, letti una volta (niente allocazioni nel disegno). */
  private readonly puntiFissi = new Map<string, Vector3 | null>();
  private tLogica = 0;
  private tTesto = 0;
  private tArea = 0;
  /** Le aree dello schermo occupate dal pannello e dalle notifiche (rilette due volte al secondo). */
  private areaPannello: Area | null = null;
  private areaNotifiche: Area | null = null;
  private notaMostrata = false;
  /** Il prossimo aggiornamento del pannello riprende l'obiettivo senza annunciarlo («Continua»). */
  private daRiprendere = false;

  // la meta del momento, nel mondo (riusata: niente allocazioni per fotogramma)
  private readonly meta = new Vector3();
  private dentro = false;
  private readonly occhi = new Vector3();
  private readonly su = new Vector3();
  private readonly cil: CylCoords = { z: 0, theta: 0, r: 0, h: 0 };
  private readonly proiezione = nuovaProiezione();
  private readonly stato: StatoSegnalino = { x: 0, y: 0, bordo: false, angolo: 0, distanza: '', verticale: null, dietro: false };
  private readonly riquadro: Riquadro = { larghezza: 1280, altezza: 720, sinistra: 48, destra: 48, sopra: 140, sotto: 50, sottoCentro: 190, bandaCentro: 380, margineVisibile: 18 };

  constructor(private readonly r: Regia) {
    r.ui.obiettivo.on('nuovoObiettivo', () => {
      if (r.fase === 'gioco') r.audio.evento({ tipo: 'interfaccia', varieta: 'conferma' });
    });
  }

  /** La chiave («missione/passo») del passo seguito, o null. */
  get chiaveSeguita(): string | null {
    return this.seguito?.chiave ?? null;
  }

  /** Le tappe del passo seguito (per i test e il debug). */
  get tappeAttuali(): readonly Destinazione[] {
    return this.tappe;
  }

  /** La meta scelta adesso (per i test e il debug). */
  get metaAttuale(): Readonly<Bersaglio> | null {
    return this.bersaglio;
  }

  /** Quando arriva chi si cerca e non c'è ancora (il menu dell'attesa lo propone), o null. */
  get arrivo(): Arrivo | null {
    return this.arrivoAttuale;
  }

  // =================================================================== passo fisso

  /** Nel passo fisso: i luoghi attraversati e, cinque volte al secondo, passo seguito, pannello e meta. */
  update(dt: number): void {
    if (this.r.fase !== 'gioco') return;
    // sulla scala alla marinara la scala è raggiunta (la Cripta della regia non coincide al metro con i luoghi dei contenuti)
    if (this.r.controllo.tipo === 'scala') this.raggiuntiQui.add('cripta_scala');
    this.tLogica -= dt;
    if (this.tLogica > 0) return;
    this.tLogica = PASSO_LOGICA;
    this.aggiornaSeguito();
  }

  /** Ricalcola subito (nei test, dopo un cambio fatto a mano). */
  aggiornaSubito(): void {
    this.tLogica = 0;
    this.aggiornaSeguito();
  }

  /** Una partita nuova: niente obiettivo di prima (il primo si annuncia quando compare). */
  azzera(): void {
    this.seguito = null;
    this.tappe = [];
    this.bersaglio = null;
    this.arrivoAttuale = null;
    this.raggiuntiQui.clear();
    this.tLogica = 0;
    this.daRiprendere = false;
    this.r.ui.obiettivo.ripristina(null);
    this.r.ui.obiettivo.segnalino(null);
  }

  /** Dopo un caricamento: l'obiettivo in corso torna nel pannello senza «nuovo obiettivo» né suono. */
  riprendi(): void {
    this.azzera();
    this.daRiprendere = true;
    this.aggiornaSeguito();
  }

  private mostra(d: DatiObiettivo | null): void {
    if (this.daRiprendere) {
      this.daRiprendere = false;
      this.r.ui.obiettivo.ripristina(d);
    } else this.r.ui.obiettivo.aggiorna(d);
  }

  private aggiornaSeguito(): void {
    const n = this.r.narrativa;
    const m = n.missioni;
    const attivi = m.passiAttivi().filter((p) => p.indicazione);
    const tipo = (id: string): string => m.definizione(id)?.tipo ?? '';
    const defDi = (p: { missione: string; passo: string }): PassoDef | undefined => m.definizione(p.missione)?.passi.find((x) => x.id === p.passo);
    const principale = attivi.find((p) => TIPI_PRINCIPALI.has(tipo(p.missione))) ?? attivi.find((p) => TIPI_SECONDARI.has(tipo(p.missione)));
    const md = principale ? m.definizione(principale.missione) : undefined;
    const pd = principale ? defDi(principale) : undefined;
    if (!principale || !md || !pd) {
      this.seguito = null;
      this.tappe = [];
      this.bersaglio = null;
      this.arrivoAttuale = null;
      this.mostra(null);
      return;
    }
    const chiave = `${principale.missione}/${principale.passo}`;
    if (chiave !== this.seguito?.chiave) {
      this.seguito = { chiave, missione: md, passo: pd };
      this.raggiuntiQui.clear();
    }
    // le righe in più: gli altri passi della stessa missione, poi (finito il prologo) le libere
    const altri: VoceObiettivo[] = [];
    for (const p of attivi) {
      if (altri.length >= 2) break;
      const def = defDi(p);
      if (p !== principale && p.missione === principale.missione && def) altri.push({ indicazione: indicazioneConTasti(this.indicazioneDi(p.missione, def)) });
    }
    // le missioni libere solo nel gioco libero: durante la storia il pannello resta sul suo filo
    if (n.flag.vero('gioco_libero')) {
      const viste = new Set<string>();
      for (const p of attivi) {
        if (altri.length >= 2) break;
        if (p.missione === principale.missione || viste.has(p.missione) || !TIPI_SECONDARI.has(tipo(p.missione))) continue;
        const def = defDi(p);
        if (!def) continue;
        viste.add(p.missione);
        altri.push({ titolo: m.definizione(p.missione)!.titolo, indicazione: indicazioneConTasti(this.indicazioneDi(p.missione, def)) });
      }
    }
    const ob = principale.obiettivo;
    const testoObiettivo = ob ? (n.taccuino.definizione(ob)?.testo ?? ob) : undefined;
    this.tappe = tappeDelPasso(this.compila(chiave, pd), this.fonti);
    const scelta = this.scegli();
    this.bersaglio = scelta.bersaglio;
    this.arrivoAttuale = scelta.arrivo;
    this.mostra({
      chiave,
      missione: md.titolo,
      indicazione: indicazioneConTasti(this.indicazioneDi(principale.missione, pd)),
      ...(testoObiettivo ? { obiettivo: testoObiettivo } : {}),
      altri,
      ...(scelta.attesa ? { attesa: indicazioneConTasti(scelta.attesa) } : {}),
    });
  }

  /** L'indicazione del passo adesso: la prima `indicazione_se` che vale, se no quella di serie. */
  private indicazioneDi(missione: string, p: PassoDef): string {
    const se = p.indicazioniSe;
    if (se?.length) {
      const k = `${missione}/${p.id}`;
      let c = this.varianti.get(k);
      if (!c) {
        c = se.map((x) => this.prova(x.quando));
        this.varianti.set(k, c);
      }
      const ambito = { missione, passo: p.id };
      for (let i = 0; i < se.length; i++) {
        const nodo = c[i];
        if (nodo && this.r.narrativa.valutaCompilata(nodo, ambito)) return se[i]!.indicazione;
      }
    }
    return p.indicazione ?? '';
  }

  /** Una condizione compilata (null se manca o non si legge: lo dice verifica-contenuti). */
  private prova(x: unknown): NodoCondizione | null {
    if (x === undefined || x === null) return null;
    try {
      return this.r.narrativa.parser.compila(x as never);
    } catch {
      return null;
    }
  }

  /** Il passo con le condizioni compilate (una volta). */
  private compila(chiave: string, p: PassoDef): PassoDaSeguire {
    let c = this.compilati.get(chiave);
    if (!c) {
      c = compilaPasso(p, (x) => this.prova(x));
      this.compilati.set(chiave, c);
    }
    return c;
  }

  /** Che cosa le tappe devono sapere della storia e del paese. */
  private readonly fonti: FontiDestinazione = {
    vero: (a: Atomo) => this.vero(a),
    raggiunto: (l) => this.raggiuntiQui.has(l) || this.vero({ k: 'luogo', id: l }),
    dialogo: (id) => {
      const d = this.r.narrativa.dialoghi.definizione(id);
      if (!d) return null;
      if (!this.aperture.has(id)) this.aperture.set(id, d.condizione === undefined ? null : this.prova(d.condizione));
      return { personaggio: d.personaggio, apertura: this.aperture.get(id) ?? null };
    },
    haCorpo: (p) => this.r.abitanti.ha(p),
    chiAccende: (f) => this.indiceDialoghi().accende.get(f) ?? [],
    chiConta: (c) => {
      const dialoghi = this.indiceDialoghi().conta.get(c);
      if (!dialoghi) return [];
      const n = this.r.narrativa.dialoghi;
      const chi = new Set<string>();
      for (const id of dialoghi) {
        const p = n.definizione(id)?.personaggio;
        if (!p) continue;
        const ora = n.perPersonaggio(p);
        if (ora && dialoghi.has(ora)) chi.add(p);
      }
      return [...chi];
    },
    capisaldiDellaCella: (cella) => {
      const id = Number(cella);
      const out = new Set<string>();
      for (const l of LATI) if (l.chiudibile && l.particelle.includes(id)) out.add(l.a).add(l.b);
      return [...out];
    },
    distanza: (cs, luogo) => {
      const c = CAPISALDI.find((x) => x.id === cs);
      const l = this.r.luoghi.get(luogo);
      return c && l ? surfaceDistance(c.z, c.theta, l.z, l.theta) : Infinity;
    },
  };

  /** Un atomo nell'ambito del passo seguito (i luoghi «raggiunti durante il passo»). */
  private vero(a: Atomo): boolean {
    const s = this.seguito;
    return this.r.narrativa.valutaCompilata({ tipo: 'atomo', atomo: a }, s ? { missione: s.missione.id, passo: s.passo.id } : undefined);
  }

  /** Chi accende un flag e quali dialoghi alzano un contatore (dagli effetti dei dialoghi). */
  private indiceDialoghi(): { accende: Map<string, string[]>; conta: Map<string, Set<string>> } {
    if (this.indice) return this.indice;
    const accende = new Map<string, string[]>();
    const conta = new Map<string, Set<string>>();
    for (const d of Object.values(this.r.narrativa.contenuti.dialoghi)) {
      const effetti = [...d.effettiFine, ...d.nodi.flatMap((x) => [...x.effetti, ...x.risposte.flatMap((y) => y.effetti)])];
      for (const e of effetti) {
        const f = /^flag:([^-\s=][^\s=]*)$/.exec(e.trim());
        if (f) accende.set(f[1]!, [...(accende.get(f[1]!) ?? []), d.personaggio]);
        const c = /^contatore:([\w:]+)\+/.exec(e.trim());
        if (c) {
          if (!conta.has(c[1]!)) conta.set(c[1]!, new Set());
          conta.get(c[1]!)!.add(d.id);
        }
      }
    }
    this.indice = { accende, conta };
    return this.indice;
  }

  // =================================================================== la meta e le attese

  /**
   * La meta fra le tappe: la prima che si sa mettere nel mondo. Chi si cerca e non c'è (o non è
   * dove lo si cerca) porta al luogo dove arriverà, con la riga dell'attesa.
   */
  private scegli(): Scelta {
    const nessuna: Scelta = { bersaglio: null, attesa: null, arrivo: null };
    for (const t of this.tappe) {
      switch (t.tipo) {
        case 'luogo':
          if (this.r.luoghi.get(t.id)) return { ...nessuna, bersaglio: t };
          break;
        case 'caposaldo':
          return { ...nessuna, bersaglio: t };
        case 'punto':
          if (this.punto(t.id)) return { ...nessuna, bersaglio: t };
          break;
        case 'persona': {
          const qui = this.r.abitanti.posizione(t.id);
          if (t.luogo) {
            const l = this.r.luoghi.get(t.luogo);
            if (qui && l && surfaceDistance(qui.z, qui.theta, l.z, l.theta) < l.raggio + ATTORNO_AL_LUOGO) return { ...nessuna, bersaglio: { tipo: 'persona', id: t.id } };
            const a = this.arrivoDi(t.id, t.luogo);
            if (a) return { bersaglio: { tipo: 'luogo', id: t.luogo }, attesa: this.notaArrivo(t.id, a, false), arrivo: a };
            if (qui) return { ...nessuna, bersaglio: { tipo: 'persona', id: t.id } };
            if (l) return { ...nessuna, bersaglio: { tipo: 'luogo', id: t.luogo } };
            break;
          }
          if (qui) return { ...nessuna, bersaglio: { tipo: 'persona', id: t.id } };
          const a = this.arrivoDi(t.id);
          if (a) return { bersaglio: { tipo: 'luogo', id: a.luogo }, attesa: this.notaArrivo(t.id, a, false), arrivo: a };
          break;
        }
        case 'persone': {
          const vicino = this.piuVicino(t.ids);
          if (vicino) return { ...nessuna, bersaglio: { tipo: 'persona', id: vicino } };
          // nessuno adesso: chi arriva per primo (a pari ora, il più vicino)
          let primo: { id: string; a: Arrivo } | null = null;
          let bt = Infinity;
          let bd = Infinity;
          const e = this.r.game.player.cyl;
          for (const id of t.ids) {
            const a = this.arrivoDi(id);
            const l = a ? this.r.luoghi.get(a.luogo) : undefined;
            if (!a || !l) continue;
            const tempo = a.giorno * 24 + a.ore;
            const d = surfaceDistance(e.z, e.theta, l.z, l.theta);
            if (tempo < bt - 1e-6 || (Math.abs(tempo - bt) < 1e-6 && d < bd)) {
              bt = tempo;
              bd = d;
              primo = { id, a };
            }
          }
          if (primo) return { bersaglio: { tipo: 'luogo', id: primo.a.luogo }, attesa: this.notaArrivo(primo.id, primo.a, true), arrivo: primo.a };
          break;
        }
      }
    }
    return nessuna;
  }

  /** Il prossimo arrivo di un personaggio secondo gli orari (in un luogo, se dato). */
  private arrivoDi(id: string, luogo?: string): Arrivo | null {
    const p = personaggio(id);
    if (!p) return null;
    const o = this.r.orologio;
    return prossimoArrivo(p, o.giorno, o.ore, { ...(luogo ? { luogo } : {}), valuta: (c) => this.r.narrativa.valuta(c), giaIniziata: IN_RITARDO });
  }

  /** «Adesso non c'è nessuno con cui parlare: una velata al lavatoio arriva alle 07:00: siediti…». */
  private notaArrivo(id: string, a: Arrivo, nessuno: boolean): string {
    const o = this.r.orologio;
    const molti = id === 'bambini';
    const nome = (this.r.ponte.nomeVisibile(id).split(',')[0] ?? id).trim();
    const chi = nome.charAt(0).toUpperCase() + nome.slice(1);
    const giorni = a.giorno - o.giorno;
    const gia = a.giorno * 24 + a.ore <= o.giorno * 24 + o.ore + 1e-6;
    const quando = gia
      ? molti
        ? 'stanno arrivando'
        : 'sta arrivando'
      : `${molti ? 'arrivano' : 'arriva'} ${giorni === 1 ? 'domani ' : giorni >= 2 ? 'dopodomani ' : ''}alle ${testoOra(a.ore)}`;
    return `${nessuno ? "Adesso non c'è nessuno con cui parlare. " : ''}${chi} ${quando}: siediti ({siedi}) e aspetta ({aspetta}).`;
  }

  /** Fra le persone, la più vicina a Elvira che sia nel paese adesso. */
  private piuVicino(ids: readonly string[]): string | null {
    const e = this.r.game.player.cyl;
    let migliore: string | null = null;
    let bd = Infinity;
    for (const id of ids) {
      const d = this.r.abitanti.distanzaDa(id, e.z, e.theta);
      if (d < bd) {
        bd = d;
        migliore = id;
      }
    }
    return migliore;
  }

  // =================================================================== disegno

  /** Nel disegno: sospensione, nota del tasto O, segnalino (proiettato a ogni fotogramma). */
  render(frameDt: number): void {
    const r = this.r;
    const ui = r.ui;
    const ob = ui.obiettivo;
    if (r.fase !== 'gioco') {
      ob.sospendi(true);
      return;
    }
    if (!ob.visible) ob.show();
    const c = r.controllo.tipo;
    const sospeso = ui.inputCatturato || r.dormendo || c === 'alzandosi' || c === 'dorme' || r.velatura.coperta() || !ui.indicazioni.visible;
    ob.sospendi(sospeso);
    if (!sospeso && !this.notaMostrata && ob.pannelloVisibile) {
      this.notaMostrata = true;
      ob.nota('{O} nasconde il pannello', 9000);
    }
    // (un disegno chiesto a mano, senza tempo che passa, aggiorna tutto: le foto delle prove)
    const aMano = frameDt <= 0;
    this.tTesto -= frameDt;
    this.tArea -= frameDt;
    const b = this.bersaglio;
    if (sospeso || ob.modo !== 'complete' || c === 'sdraiata' || r.squadro.telescopio || !b || !this.metti(b) || this.dentro) {
      ob.segnalino(null);
      this.stato.distanza = '';
      return;
    }
    const cam = r.game.camera;
    const q = this.riquadro;
    q.larghezza = innerWidth;
    q.altezza = innerHeight;
    q.sopra = Math.max(110, innerHeight * 0.2);
    // in basso: vicino al fondo ai lati, sopra i sottotitoli e le azioni al centro
    q.sotto = Math.max(46, innerHeight * 0.07);
    q.sottoCentro = Math.max(150, innerHeight * 0.27);
    q.bandaCentro = Math.max(300, innerWidth * 0.3);
    q.sinistra = q.destra = Math.max(36, innerWidth * 0.045);
    proietta(this.meta, cam, q, this.proiezione);
    // non sotto il pannello né sotto le notifiche: appena sotto il loro orlo, la freccia verso la meta
    if (aMano || this.tArea <= 0) {
      this.tArea = PASSO_AREA;
      this.areaPannello = ob.areaPannello();
      this.areaNotifiche = ui.indicazioni.areaNotifiche();
    }
    this.evita(this.areaPannello);
    this.evita(this.areaNotifiche);
    const st = this.stato;
    st.x = this.proiezione.x;
    st.y = this.proiezione.y;
    st.bordo = this.proiezione.bordo;
    st.angolo = this.proiezione.angolo;
    st.dietro = this.proiezione.dietro;
    if (aMano || this.tTesto <= 0 || !st.distanza) {
      this.tTesto = PASSO_TESTO;
      this.occhi.copy(cam.position);
      worldToCyl(this.occhi, this.cil);
      upAt(this.cil.theta, this.su);
      const zA = this.cil.z;
      const tA = this.cil.theta;
      const hA = this.cil.h;
      worldToCyl(this.meta, this.cil);
      st.distanza = scriviDistanza(distanzaMeta(zA, tA, hA, this.cil.z, this.cil.theta, this.cil.h));
      st.verticale = verticale(this.occhi, this.meta, this.su);
    }
    ob.segnalino(st);
  }

  /** Se il segnalino cade su un'area (il pannello, le notifiche), scende sotto il suo orlo e indica la meta. */
  private evita(area: Area | null): void {
    const p = this.proiezione;
    if (!area || p.x < area.sinistra - MARGINE_AREA || p.x > area.destra + MARGINE_AREA || p.y > area.sotto + MARGINE_AREA) return;
    const x0 = p.x;
    const y0 = p.y;
    const q = this.riquadro;
    p.y = area.sotto + SOTTO_AREA;
    p.x = Math.min(q.larghezza - q.destra, Math.max(q.sinistra, p.x));
    if (!p.bordo) {
      // la meta si vedeva, ma sotto la carta: una freccia appena sotto, girata verso di lei
      p.bordo = true;
      p.angolo = Math.atan2(y0 - p.y, x0 - p.x);
    }
  }

  // =================================================================== la meta nel mondo

  /** Mette nel mondo la meta: scrive `meta` e `dentro` (false se non si sa dove sia adesso). */
  private metti(b: Bersaglio): boolean {
    const r = this.r;
    switch (b.tipo) {
      case 'luogo': {
        const dove = internoDelLuogo(b.id);
        if (dove !== r.interno) return this.passaggio(dove);
        if (!this.puntoDelLuogo(b.id)) return false;
        this.dentro = r.luoghiQui.has(b.id) || (b.id === 'cripta_scala' && (r.controllo.tipo === 'scala' || r.occhi(this.occhi).distanceTo(r.cripta.punti['scala']!) < VICINO_PASSAGGIO));
        return true;
      }
      case 'persona': {
        if (r.interno) return this.passaggio(null);
        if (!r.abitanti.testa(b.id, this.meta)) return false;
        worldToCyl(this.meta, this.cil);
        upAt(this.cil.theta, this.su);
        this.meta.addScaledVector(this.su, SOPRA_TESTA);
        const e = r.game.player.cyl;
        this.dentro = surfaceDistance(e.z, e.theta, this.cil.z, this.cil.theta) < VICINO_PERSONA && Math.abs(e.h - this.cil.h) < 4.5;
        return true;
      }
      case 'caposaldo': {
        const dove = internoDelCaposaldo(b.id);
        if (dove !== r.interno) return this.passaggio(dove);
        const ch = this.fisso(`chiodo:${b.id}`, () => r.chiodo(b.id));
        if (!ch) return false;
        this.sopra(ch, SOPRA_CHIODO);
        this.dentro = r.game.player.pos.distanceTo(ch) < VICINO_CHIODO;
        return true;
      }
      case 'punto': {
        const pt = this.punto(b.id);
        if (!pt) return false;
        if (pt.dove !== r.interno) return this.passaggio(pt.dove);
        this.sopra(pt.p, SOPRA_OGGETTO);
        this.dentro = r.occhi(this.occhi).distanceTo(pt.p) < VICINO_OGGETTO;
        return true;
      }
    }
  }

  /** Un punto della regia per id, con il «dentro» in cui sta (la busta e l'armadietto nella Cripta). */
  private punto(id: string): { p: Vector3; dove: 'cripta' | 'cella' | null } | null {
    const r = this.r;
    const c = r.cripta.punti[id];
    if (c) return { p: c, dove: 'cripta' };
    const k = r.cella.punti[id];
    if (k) return { p: k, dove: 'cella' };
    const s = this.fisso(`scena:${id}`, () => r.scena.punto(id));
    return s ? { p: s, dove: null } : null;
  }

  /** La meta è in un altro «dentro»: prima la via per uscire o per entrare. */
  private passaggio(dove: 'cripta' | 'cella' | null): boolean {
    const r = this.r;
    let p: Vector3 | null | undefined = null;
    if (r.interno === 'cripta') p = r.controllo.tipo === 'scala' ? r.cripta.punti['botola_interna'] : r.cripta.punti['scala'];
    else if (r.interno === 'cella') p = r.cella.punti['scendi_campanile'];
    else if (dove === 'cripta') p = this.fisso('scena:botola', () => r.scena.punto('botola'));
    else if (dove === 'cella') p = this.fisso('scena:porta_campanile', () => r.scena.punto('porta_campanile'));
    if (!p) return false;
    this.sopra(p, SOPRA_PUNTO);
    this.dentro = r.controllo.tipo !== 'scala' && r.occhi(this.occhi).distanceTo(p) < VICINO_PASSAGGIO;
    return true;
  }

  /** Il punto del luogo: quello vero del paese o della Cripta, se c'è, se no il centro del luogo alla quota d'appoggio. */
  private puntoDelLuogo(id: string): boolean {
    const r = this.r;
    const nome = PUNTI_DEI_LUOGHI[id];
    const vero = id === 'cripta_scala' ? r.cripta.punti['scala'] : nome ? this.fisso(`scena:${nome}`, () => r.scena.punto(nome)) : null;
    if (vero) {
      this.sopra(vero, SOPRA_PUNTO);
      return true;
    }
    let pos = this.posizioniLuoghi.get(id);
    if (!pos) {
      const l = r.luoghi.get(id);
      if (!l) return false;
      const h = internoDelLuogo(id) || l.tipo === 'cielo' ? r.luoghi.quota(id) : quotaAppoggio(r.game.world.colliders, l.z, l.theta);
      pos = cylToWorld(l.z, l.theta, h);
      this.posizioniLuoghi.set(id, pos);
    }
    this.sopra(pos, SOPRA_LUOGO);
    return true;
  }

  /** Un punto fisso (del paese, un chiodo), cercato la prima volta e poi ricordato. */
  private fisso(chiave: string, cerca: () => Vector3 | null | undefined): Vector3 | null {
    let p = this.puntiFissi.get(chiave);
    if (p === undefined) {
      p = cerca() ?? null;
      this.puntiFissi.set(chiave, p);
    }
    return p;
  }

  /** `meta` = il punto alzato di `quanto` m verso l'asse. */
  private sopra(p: Vector3, quanto: number): void {
    worldToCyl(p, this.cil);
    upAt(this.cil.theta, this.su);
    this.meta.copy(p).addScaledVector(this.su, quanto);
  }
}
