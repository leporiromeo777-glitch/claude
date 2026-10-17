/**
 * Gli abitanti di Corbella per la regia: le figure vere del popolamento (`corbella.npc(id)`,
 * con animazione, pose e collider) guidate dalla storia.
 *
 * - Gli orari di personaggi.json li applica il popolamento (ogni minuto di gioco, con il giorno
 *   che gli passa la regia). La regia corregge le poche posizioni con una condizione dei contenuti
 *   (Clelia lascia la Bacheca dopo il dono) e prende in mano chi la storia muove (`manuale`).
 * - Ottavio segue la storia: vola sopra la valle (Velo verde) finché non scende in spirale
 *   (`atterra`), accompagna Elvira (`npc:ottavio->accompagna:fienile_ottavio`), le viene incontro
 *   prima di un dialogo automatico (`ottavioRaggiunge`), arriva quando lo si chiama col fischio.
 * - Chi è vicino a Elvira gira la testa verso di lei (tutti, per un po', con `velati_si_voltano`).
 */
import { Quaternion, Vector3, type Object3D } from 'three';
import type { ManigliaCorbella, ManigliaNpc } from '../popolamento';
import { battutaPersonaggio, fineBattutePersonaggio, ripostoOggettoPersonaggio } from '../personaggi/fabbrica';
import { METERS_PER_DEG } from '../world/constants';
import { cylToWorld, deltaDeg, surfaceDistance } from '../world/cylinder';
import { groundHeight } from '../world/terrain';
import { luogo, oreDa, type Personaggio } from './contenuti';

type ModoOttavio =
  | { tipo: 'orario' }
  | { tipo: 'cielo' }
  | { tipo: 'atterra'; da: { z: number; theta: number; h: number }; a: { z: number; theta: number }; t: number; poi: ModoOttavio }
  | { tipo: 'fermo'; z: number; theta: number; fino?: number }
  | { tipo: 'accompagna'; tappe: string[] }
  /** Viene incontro a Elvira (un dialogo automatico con lui sta per aprirsi). */
  | { tipo: 'raggiunge'; poi: ModoOttavio };

/** A che distanza da Elvira Ottavio si ferma quando le viene incontro (m). */
const OTTAVIO_VICINO = 2.4;
/** Entro questa distanza (m) si parla senza che nessuno debba muoversi. */
const OTTAVIO_A_PORTATA = 6;
/** Oltre questa distanza (m) Ottavio non viene a piedi: scende dal cielo vicino a Elvira. */
const OTTAVIO_LONTANO_A_PIEDI = 36;
/** Sopra il suolo di tanto (m) una figura è «in volo»: si vede, ma non è lì. */
const IN_VOLO = 6;
/** Maniglie di gruppo del popolamento (muovono più figure). */
const GRUPPI = new Set(['bambini', 'velati_corbella']);
/** I due bambini (nei dialoghi parlano a turno, come «bambini», «lisa» e «gioanin»). */
const BAMBINI = new Set(['bambini', 'lisa', 'gioanin']);
/**
 * Dopo un dialogo chi ha parlato resta rivolto a Elvira finché lei gli sta vicino (entro `vicino` m), per
 * quanto tempo ci resti: prima, dopo 10 s, le voltava le spalle anche se lei era ancora lì davanti. Se lei
 * gli gira attorno (oltre `rigira` gradi dal suo avanti) si rigira con calma. Torna alle sue cose quando
 * lei si è allontanata da `via` s (e comunque non prima di `min` s dalla fine del dialogo).
 */
const DOPO_DIALOGO = { min: 2.5, vicino: 4.5, via: 1.5, rigira: 50 } as const;
/** Chi cammina non si volta a guardare Elvira se lei gli sta dietro più di tanto (gradi). */
const DIETRO_IN_CAMMINO = 110;
/** Clelia, dato il dono, va verso la Casa del Velo a questa velocità (m/s) e si ferma a tanti m dalla porta. */
const CLELIA_VIA = { velocita: 1.0, primaDellaPorta: 1.2 } as const;

const _q = new Quaternion();
const _p = new Vector3();
const _su = new Vector3();
const _av = new Vector3();
const _ve = new Vector3();

/** Di quanti gradi il punto `occhi` è lontano dall'avanti della figura `f`, sul piano del suolo. */
export function angoloDallAvanti(f: Object3D, occhi: Vector3): number {
  f.getWorldQuaternion(_q);
  f.getWorldPosition(_p);
  _su.set(0, 1, 0).applyQuaternion(_q);
  _av.set(0, 0, 1).applyQuaternion(_q).projectOnPlane(_su).normalize();
  _ve.copy(occhi).sub(_p).projectOnPlane(_su);
  if (_ve.lengthSq() < 1e-8) return 0;
  _ve.normalize();
  return (Math.acos(Math.max(-1, Math.min(1, _av.dot(_ve)))) * 180) / Math.PI;
}

export interface ContestoAbitanti {
  giorno: number;
  ore: number;
  /** Tempo assoluto (ore). */
  assoluto: number;
  valuta: (condizione: string) => boolean;
  /** Occhi di Elvira (mondo) e (z, θ) dei piedi. */
  occhi: Vector3;
  elvira: { z: number; theta: number };
}

/** La posizione «di adesso» di un personaggio secondo personaggi.json (id del luogo o null). */
export function luogoDaOrario(p: Personaggio, giorno: number, ore: number, valuta: (c: string) => boolean = () => true): string | null {
  for (const pos of p.posizioni ?? []) {
    const fase = pos.fase.toLowerCase();
    let giornoOk: boolean;
    const m = /(dal )?giorno (\d+)/.exec(fase);
    if (fase.startsWith('ogni giorno') || fase === 'sempre') giornoOk = true;
    else if (m) giornoOk = m[1] ? giorno >= Number(m[2]) : giorno === Number(m[2]);
    else continue; // notte, prologo, libera, Fase 1: non sono posizioni del mondo
    if (!giornoOk) continue;
    const da = pos.dalle ? oreDa(pos.dalle) : 0;
    const a = pos.alle ? oreDa(pos.alle) : 24;
    const d0 = Number.isFinite(da) ? da : 0;
    const a0 = Number.isFinite(a) ? a : 24;
    const dentro = d0 <= a0 ? ore >= d0 && ore < a0 : ore >= d0 || ore < a0;
    if (!dentro) continue;
    if (pos.condizione && !valuta(pos.condizione)) continue;
    const testo = pos.luogo.trim();
    if (/in volo|fuori scena|\(dentro\)|dove la porta/.test(testo)) return null;
    const id = testo.split(/[\s(]/)[0] ?? '';
    return luogo(id) ? id : null;
  }
  return null;
}

/**
 * Clelia è in giro (alla Bacheca finché non ha dato il dono, poi alla Casa del Velo): dal giorno
 * 2, dalle 07:00 alle 21:00 (personaggi.json).
 */
export function cleliaAspettaAllaBacheca(giorno: number, ore: number): boolean {
  return giorno >= 2 && ore >= 7 && ore < 21;
}

/** Dove sta Clelia alla Bacheca: come la mette il popolamento (0,8 m a Lag, 1,8 m a Mane). */
export function posizioneCleliaAllaBacheca(): { z: number; theta: number } {
  const l = luogo('bacheca_ore');
  const z = l?.z ?? 1043;
  const theta = l?.theta ?? 35.6;
  return { z: z + 0.8, theta: theta + 1.8 / METERS_PER_DEG };
}

/** Dove sta Clelia alla Casa del Velo: come la mette il popolamento (3,6 m a Sol, 3,6 m a Mane). */
export function posizioneCleliaAllaCasa(): { z: number; theta: number } | null {
  const l = luogo('casa_del_velo');
  return l ? { z: l.z - 3.6, theta: l.theta + 3.6 / METERS_PER_DEG } : null;
}

/** Dove la regia tiene Clelia (null: la lascia agli orari del popolamento). */
export type PostoClelia = 'bacheca' | 'via' | 'casa' | null;

/**
 * Il posto di Clelia adesso. Il popolamento non valuta le condizioni degli orari: la prima riga
 * (la Bacheca, «!dialogo:d_clelia_dono finito») la terrebbe lì anche dopo il dono.
 * - il dono non è fatto (né da lei né da Ottavio con il pacco): alla Bacheca, dalle 07:00 alle
 *   21:00 di ogni giorno dal secondo (gli orari la mandavano alla Casa del Velo alle 19:00 e solo
 *   il giorno 2: chi arrivava alla Bacheca la sera, o il giorno dopo, non trovava nessuno);
 * - il giorno 2, dato il dono, se ne va (fino alle 20:00: poi è alla Casa del Velo, dove la sera
 *   offre il letto a chi porta il velo);
 * - dopo il dono, nelle stesse ore, alla Casa del Velo.
 */
export function postoDiClelia(giorno: number, ore: number, donoDaLei: boolean, paccoDaOttavio: boolean): PostoClelia {
  const inGiro = cleliaAspettaAllaBacheca(giorno, ore);
  if (!donoDaLei && !paccoDaOttavio) return inGiro ? 'bacheca' : null;
  if (donoDaLei && giorno === 2 && ore < 20) return 'via';
  return inGiro ? 'casa' : null;
}

export class Abitanti {
  private _ottavio: ModoOttavio = { tipo: 'orario' };
  /** Diario dei cambi di modo di Ottavio (la regia lo collega al suo diario). */
  log: ((riga: string) => void) | null = null;

  private get ottavio(): ModoOttavio {
    return this._ottavio;
  }

  private set ottavio(o: ModoOttavio) {
    if (this.log && (o.tipo !== this._ottavio.tipo || o.tipo === 'fermo')) {
      const dove = o.tipo === 'fermo' ? ` (${o.z.toFixed(0)}, ${o.theta.toFixed(1)})` : o.tipo === 'accompagna' ? ` ${o.tappe.join('→')}` : '';
      this.log(`ottavio: ${this._ottavio.tipo} → ${o.tipo}${dove}`);
    }
    this._ottavio = o;
  }
  /** Fino a quando (secondi della regia) tutti guardano Elvira. */
  private voltatiFino = -1;
  private tempo = 0;
  private guardanti = new Set<string>();
  /** Meta del cammino in corso di Ottavio (per non ridare lo stesso ordine a ogni passo). */
  private metaCammino: { z: number; theta: number } | null = null;
  private prossimaCondizione = 0;
  /** Velocità di cammino di chi accompagna (m/s). */
  passoAccompagna = 1.7;

  constructor(readonly corbella: ManigliaCorbella) {}

  private npc(id: string): ManigliaNpc | undefined {
    return this.corbella.npc(id === 'bambini' ? 'lisa' : id);
  }

  /** Il personaggio ha un corpo nel paese (i dialoghi aspettano che ci sia). */
  ha(id: string): boolean {
    return !!this.npc(id)?.figura;
  }

  private inVolo(n: ManigliaNpc): boolean {
    const p = n.posizione();
    return !!p && p.h - groundHeight(p.z, p.theta) > IN_VOLO;
  }

  /** Visibile e a terra (Ottavio in volo sopra la valle non è «presente»). */
  presente(id: string): boolean {
    const n = this.npc(id);
    return !!n?.presente && !this.inVolo(n);
  }

  posizione(id: string): { z: number; theta: number; h: number } | null {
    const n = this.npc(id);
    return n?.presente ? n.posizione() : null;
  }

  /** Distanza (sulla superficie) fra una figura presente e un punto; Infinity se non c'è. */
  distanzaDa(id: string, z: number, theta: number): number {
    const p = this.posizione(id);
    return p ? surfaceDistance(p.z, p.theta, z, theta) : Infinity;
  }

  /** L'osso «testa» di ogni figura, cercato una volta (null: la figura non ce l'ha). */
  private readonly teste = new WeakMap<Object3D, Object3D | null>();

  /**
   * Dove sta adesso la testa di una figura presente (anche in volo), in `out`: l'osso «testa»
   * della figura, che segue la posa (seduta sulla soglia, china); senza osso, l'altezza della
   * testa di un adulto o di un bambino sopra i piedi. Per il segnalino delle indicazioni.
   */
  testa(id: string, out: Vector3): Vector3 | null {
    const n = this.npc(id);
    if (!n?.presente) return null;
    const f = n.figura;
    if (f) {
      let t = this.teste.get(f);
      if (t === undefined) {
        t = f.getObjectByName('testa') ?? null;
        this.teste.set(f, t);
      }
      if (t) return t.getWorldPosition(out);
    }
    const p = n.posizione();
    if (!p) return null;
    return cylToWorld(p.z, p.theta, p.h + (id === 'bambini' || id === 'lisa' || id === 'gioanin' ? 1.0 : 1.45), out);
  }

  /** Il punto dove si parla a un personaggio dei dialoghi (la testa; «bambini» = Lisa). */
  puntoDialogo(personaggio: string): Vector3 | null {
    if (!this.presente(personaggio)) return null;
    const p = this.npc(personaggio)!.posizione()!;
    return cylToWorld(p.z, p.theta, p.h + (personaggio === 'bambini' || personaggio === 'lisa' || personaggio === 'gioanin' ? 1.0 : 1.45));
  }

  /** Chi (con un corpo, a terra) è entro `raggio` m da (z, θ). */
  vicini(z: number, theta: number, raggio: number, escludi: readonly string[] = []): string[] {
    const out: string[] = [];
    for (const [id, n] of this.corbella.personaggi) {
      if (GRUPPI.has(id) || escludi.includes(id) || !n.figura || !n.presente || this.inVolo(n)) continue;
      const p = n.posizione();
      if (p && surfaceDistance(p.z, p.theta, z, theta) < raggio) out.push(id);
    }
    return out;
  }

  /**
   * Chi parla si gira verso Elvira: con calma, i piedi a passi (prima di colpo, e al minuto di gioco dopo
   * gli orari lo rigiravano com'era, sempre di colpo). Seduti e chini girano solo la testa. Mentre il
   * dialogo è aperto, e per un po' dopo, la guarda anche da lontano.
   */
  voltaVerso(id: string, elvira: { z: number; theta: number }, siGira = true): void {
    // i bambini parlano a turno: si girano tutti e due (la maniglia di gruppo)
    const chi = BAMBINI.has(id) ? 'bambini' : id;
    const n = chi === 'bambini' ? this.corbella.npc('bambini') : this.npc(chi);
    if (!n?.presente || this.inVolo(n)) return;
    if (this.interlocutore && this.interlocutore.id !== chi) this.lascia();
    this.interlocutore = { id: chi, finito: null, siGira, lontano: null, prossimoGiro: 0, dove: null };
    if (siGira && !n.inCammino) n.rivolgiVerso(elvira);
  }

  /** Il personaggio `id` (del popolamento) sta parlando con Elvira o ci ha appena parlato. */
  private interlocutoreE(id: string): boolean {
    const i = this.interlocutore?.id;
    return !!i && (i === id || (i === 'bambini' && BAMBINI.has(id)));
  }

  /** Il dialogo è stato chiuso: chi parlava smette di parlare e, fra poco, di prestare attenzione. */
  fineDialogo(): void {
    const i = this.interlocutore;
    if (!i || i.finito !== null) return;
    i.finito = this.tempo;
    const n = this.npc(i.id);
    if (n?.figura) fineBattutePersonaggio(n.figura);
    if (i.id === 'bambini') {
      for (const b of ['lisa', 'gioanin']) {
        const f = this.corbella.npc(b)?.figura;
        if (f) fineBattutePersonaggio(f);
      }
    }
  }

  /** Smette di prestare attenzione a Elvira: chi segue gli orari torna piano a guardare dove guardava. */
  private lascia(): void {
    const i = this.interlocutore;
    if (!i) return;
    this.interlocutore = null;
    (i.id === 'bambini' ? this.corbella.npc('bambini') : this.npc(i.id))?.rivolgiVerso(null);
  }

  /**
   * Chi parla con Elvira (o ci ha appena parlato): id, quando il dialogo è stato chiuso (null = aperto), se
   * si gira verso di lei (no per «Non si gira»), da quando lei è lontana (null = è vicina), quando
   * guardare di nuovo se lei gli è girata attorno e dov'era lei l'ultima volta che si è guardato.
   */
  private interlocutore: {
    id: string;
    finito: number | null;
    siGira: boolean;
    lontano: number | null;
    prossimoGiro: number;
    dove: { z: number; theta: number } | null;
  } | null = null;

  /**
   * Comincia una battuta di `id` lunga `durata` s: i personaggi nuovi fanno quasi sempre un piccolo cenno
   * del capo e ogni tanto un gesto della mano libera (src/personaggi/animatore.ts, annunciaBattuta); la
   * figura procedurale un cenno.
   */
  battuta(id: string, durata?: number): void {
    const n = this.npc(id);
    if (n?.presente && n.figura && !n.inCammino) battutaPersonaggio(n.figura, durata);
  }

  /** I velati della piazza si voltano tutti insieme verso Elvira (evento:velati_si_voltano). */
  voltatiTutti(secondi = 25): void {
    this.voltatiFino = this.tempo + secondi;
  }

  // ------------------------------------------------------------------ Ottavio

  /** Ottavio scende in spirale da una corrente calda e atterra vicino a (z, θ). */
  atterra(z: number, theta: number, poi: ModoOttavio = { tipo: 'fermo', z, theta }): void {
    const n = this.npc('ottavio');
    const p = n?.presente ? n.posizione() : null;
    const da = p && p.h - groundHeight(p.z, p.theta) > IN_VOLO ? p : { z: z - 30, theta: theta - 2, h: groundHeight(z, theta) + 70 };
    this.ottavio = { tipo: 'atterra', da, a: { z, theta }, t: 0, poi };
    this.metaCammino = null;
  }

  /** Comandi «npc:» dei contenuti: «ottavio->accompagna:fienile_ottavio». */
  ordine(testo: string): void {
    const m = /^(\w+)->(\w+):?(.*)$/.exec(testo.trim());
    if (!m || m[1] !== 'ottavio') return;
    if (m[2] === 'accompagna') {
      const dest = m[3] || 'fienile_ottavio';
      this.ottavio = { tipo: 'accompagna', tappe: dest === 'fienile_ottavio' ? ['passerella_messo', 'fienile_ottavio'] : [dest] };
      this.metaCammino = null;
    } else if (m[2] === 'vai' && m[3]) {
      const l = luogo(m[3]);
      if (l) this.ottavio = { tipo: 'fermo', z: l.z, theta: l.theta };
    }
  }

  /** Lascia gli orari di personaggi.json decidere per Ottavio. */
  ottavioSegueOrario(): void {
    this.ottavio = { tipo: 'orario' };
  }

  /** Ottavio fermo in un punto fino al tempo assoluto `fino` (o per sempre). */
  ottavioFermo(z: number, theta: number, fino?: number): void {
    this.ottavio = { tipo: 'fermo', z, theta, ...(fino !== undefined ? { fino } : {}) };
  }

  /** Ottavio in volo sopra la valle finché la storia non lo fa scendere. */
  ottavioInCielo(): void {
    this.ottavio = { tipo: 'cielo' };
  }

  /**
   * Ottavio viene incontro a Elvira (a passo svelto) e si ferma a un paio di metri da lei.
   * Lo chiede il direttore dei dialoghi quando un dialogo automatico con lui sta per aprirsi
   * e lui è lontano: si parla da vicino, non a quindici metri.
   */
  ottavioRaggiunge(): void {
    const o = this.ottavio;
    if (o.tipo === 'raggiunge' || o.tipo === 'atterra') return;
    this.ottavio = { tipo: 'raggiunge', poi: o };
    this.metaCammino = null;
  }

  /**
   * Distanza fra Ottavio e un punto, contando dove la storia lo vuole: fermo davanti al fienile
   * c'è già, anche se la figura ci arriva al passo dopo.
   */
  distanzaOttavioDa(z: number, theta: number): number {
    const o = this.ottavio;
    if (o.tipo === 'fermo') return surfaceDistance(o.z, o.theta, z, theta);
    return this.distanzaDa('ottavio', z, theta);
  }

  get modoOttavio(): string {
    return this.ottavio.tipo;
  }

  esporta(): unknown {
    const o = this.ottavio;
    if (o.tipo === 'atterra' || o.tipo === 'raggiunge') return { ottavio: o.poi };
    return { ottavio: o };
  }

  importa(d: unknown): void {
    const o = (d as { ottavio?: ModoOttavio } | null)?.ottavio;
    if (o && typeof o === 'object' && 'tipo' in o && o.tipo !== 'atterra' && o.tipo !== 'raggiunge') this.ottavio = o;
    else this.ottavio = { tipo: 'orario' };
    this.metaCammino = null;
  }

  // ------------------------------------------------------------------ passo

  update(dt: number, ctx: ContestoAbitanti): void {
    this.tempo += dt;
    if (this.corbella.giorno !== ctx.giorno) this.corbella.giorno = ctx.giorno;
    this.prossimaCondizione -= dt;
    if (this.prossimaCondizione <= 0) {
      this.prossimaCondizione = 0.5;
      this.condizioni(ctx);
    }
    this.aggiornaOttavio(dt, ctx);
    this.dopoDialogo(ctx);
    this.aggiornaUscitaClelia(dt);
    this.sguardi(ctx);
  }

  /**
   * Finito il dialogo: resta rivolto a Elvira finché lei è lì (e si rigira con calma se lei gli gira
   * attorno); quando lei se ne va, torna alle sue cose (vedi DOPO_DIALOGO).
   */
  private dopoDialogo(ctx: ContestoAbitanti): void {
    const i = this.interlocutore;
    if (!i || i.finito === null) return;
    const id = i.id === 'bambini' ? 'lisa' : i.id;
    const d = this.distanzaDa(id, ctx.elvira.z, ctx.elvira.theta);
    if (d > DOPO_DIALOGO.vicino) {
      i.lontano ??= this.tempo;
      if (this.tempo - i.finito > DOPO_DIALOGO.min && this.tempo - i.lontano > DOPO_DIALOGO.via) this.lascia();
      return;
    }
    i.lontano = null;
    if (!i.siGira || this.tempo < i.prossimoGiro) return;
    i.prossimoGiro = this.tempo + 0.5;
    // solo se lei si è fermata lì (mentre gli passa accanto per andarsene la segue con la testa, non col corpo)
    const prima = i.dove;
    i.dove = { z: ctx.elvira.z, theta: ctx.elvira.theta };
    if (!prima || surfaceDistance(prima.z, prima.theta, ctx.elvira.z, ctx.elvira.theta) > 0.3) return;
    const n = i.id === 'bambini' ? this.corbella.npc('bambini') : this.npc(i.id);
    const f = this.npc(id)?.figura;
    if (n?.presente && f && !n.inCammino && !n.girando && angoloDallAvanti(f, ctx.occhi) > DOPO_DIALOGO.rigira) n.rivolgiVerso(ctx.elvira);
  }

  /**
   * Le posizioni dei contenuti con una condizione (il popolamento non le valuta): Clelia alla
   * Bacheca finché non ha dato il dono, poi alla Casa del Velo (vedi `postoDiClelia`).
   */
  private condizioni(ctx: ContestoAbitanti): void {
    const clelia = this.npc('clelia');
    if (!clelia) return;
    const donoDaLei = ctx.valuta('dialogo:d_clelia_dono finito');
    const paccoDaOttavio = ctx.valuta('dialogo:d_ottavio_pacco finito');
    const posto = postoDiClelia(ctx.giorno, ctx.ore, donoDaLei, paccoDaOttavio);
    if (posto === this.postoClelia && (posto !== null || !clelia.manuale)) return;
    this.postoClelia = posto;
    this.uscitaClelia = null;
    // il pacchetto della Madre: in mano finché non l'ha dato (a Elvira o a Ottavio per lei)
    ripostoOggettoPersonaggio(clelia.figura, 'pacchetto', donoDaLei || paccoDaOttavio);
    if (posto === null) {
      clelia.manuale = false;
      this.corbella.applicaOrario(ctx.giorno, ctx.ore);
      return;
    }
    clelia.manuale = true;
    // dato il dono, se è lì alla Bacheca, se ne va a piedi verso la Casa del Velo (la didascalia: «si
    // inchina appena e se ne va verso la Casa del Velo»). Prima spariva in un fotogramma all'ultima
    // battuta: chiusa la lettera della Madre, la novizia non c'era più
    if (posto === 'via' && this.avviaUscitaClelia(clelia)) return;
    const q = posto === 'bacheca' ? posizioneCleliaAllaBacheca() : posto === 'casa' ? posizioneCleliaAllaCasa() : null;
    if (!q) {
      clelia.mostra(false);
      return;
    }
    clelia.ferma();
    clelia.vaiA(q.z, q.theta);
    const piazza = luogo('piazza_ore');
    if (piazza) clelia.orientaVerso(piazza);
    clelia.mostra(true);
  }

  /** Dove la regia tiene Clelia adesso (vedi `condizioni`). */
  private postoClelia: PostoClelia = null;

  /**
   * Clelia che se ne va dopo il dono: saluta (un cenno, finché il dialogo è aperto), si gira con calma
   * verso la Casa del Velo, ci va a piedi (la via dritta dalla Bacheca alla porta è libera) e, arrivata,
   * entra (non si vede più). null = non se ne sta andando.
   */
  private uscitaClelia: { fase: 'saluta' | 'gira' | 'cammina'; t: number; meta: { z: number; theta: number } } | null = null;

  /** Comincia l'uscita di Clelia, se è alla Bacheca e si vede; falso se non c'è niente da far vedere. */
  private avviaUscitaClelia(clelia: ManigliaNpc): boolean {
    const p = clelia.presente ? clelia.posizione() : null;
    const bacheca = posizioneCleliaAllaBacheca();
    const casa = posizioneCleliaAllaCasa();
    if (!p || !casa || this.inVolo(clelia) || surfaceDistance(p.z, p.theta, bacheca.z, bacheca.theta) > 4) return false;
    const d = surfaceDistance(p.z, p.theta, casa.z, casa.theta);
    const u = Math.max(0, (d - CLELIA_VIA.primaDellaPorta) / Math.max(d, 1e-3));
    const meta = { z: p.z + (casa.z - p.z) * u, theta: p.theta + deltaDeg(p.theta, casa.theta) * u };
    this.uscitaClelia = { fase: 'saluta', t: 0, meta };
    if (clelia.figura) battutaPersonaggio(clelia.figura, 1.2);
    return true;
  }

  private aggiornaUscitaClelia(dt: number): void {
    const u = this.uscitaClelia;
    if (!u) return;
    const c = this.npc('clelia');
    if (!c?.presente) {
      this.uscitaClelia = null;
      return;
    }
    u.t += dt;
    if (u.fase === 'saluta') {
      // finché il dialogo è aperto resta lì (al più qualche secondo: la lettera della Madre può restare aperta)
      const aperto = this.interlocutoreE('clelia') && this.interlocutore?.finito === null;
      if (u.t < 1.2 || (aperto && u.t < 6)) return;
      if (this.interlocutoreE('clelia')) this.lascia();
      c.rivolgiVerso(u.meta, true);
      u.fase = 'gira';
      u.t = 0;
    } else if (u.fase === 'gira') {
      if ((c.girando && u.t < 5) || u.t < 0.3) return;
      void c.cammina(u.meta, CLELIA_VIA.velocita);
      u.fase = 'cammina';
      u.t = 0;
    } else if (!c.inCammino || u.t > 60) {
      // arrivata alla porta: entra
      c.ferma();
      c.mostra(false);
      this.uscitaClelia = null;
    }
  }

  private sguardi(ctx: ContestoAbitanti): void {
    const voltati = this.tempo < this.voltatiFino;
    for (const [id, n] of this.corbella.personaggi) {
      if (GRUPPI.has(id) || !n.figura) continue;
      const p = n.presente ? n.posizione() : null;
      const d = p ? surfaceDistance(p.z, p.theta, ctx.elvira.z, ctx.elvira.theta) : Infinity;
      // chi parla con lei la guarda anche da lontano (un dialogo automatico si apre fino a 25 m); chi cammina
      // e se la lascia alle spalle guarda dove va (prima si voltava a guardarla girando la testa fin dove
      // poteva, per tutto il cammino), a meno che non ci stia parlando adesso
      const parlaOra = this.interlocutoreE(id) && this.interlocutore?.finito === null;
      const dietro = d < 40 && n.inCammino && !parlaOra && angoloDallAvanti(n.figura, ctx.occhi) > DIETRO_IN_CAMMINO;
      if (!dietro && (d < 9 || (voltati && d < 70) || (d < 40 && this.interlocutoreE(id)))) {
        n.guarda(ctx.occhi);
        this.guardanti.add(id);
      } else if (this.guardanti.delete(id)) n.guarda(null);
    }
  }

  private velo(n: ManigliaNpc): Object3D | null {
    return n.figura?.getObjectByName('velo-ottavio') ?? null;
  }

  private aggiornaOttavio(dt: number, ctx: ContestoAbitanti): void {
    const n = this.npc('ottavio');
    if (!n) return;
    const o = this.ottavio;
    n.manuale = o.tipo !== 'orario';
    if (o.tipo === 'orario') {
      this.metaCammino = null;
      return;
    }
    const velo = this.velo(n);
    if (velo && o.tipo !== 'cielo' && o.tipo !== 'atterra') velo.visible = false;
    switch (o.tipo) {
      case 'cielo': {
        // un segnale di cielo: il Velo verde che gira sopra la valle
        const t = this.tempo * 0.05;
        const z = 1090 + Math.cos(t) * 60;
        const theta = 42 + (Math.sin(t) * 40) / METERS_PER_DEG;
        n.vaiA(z, theta, { h: groundHeight(z, theta) + 55, yaw: (t * 180) / Math.PI + 90 });
        if (!n.presente) n.mostra(true);
        if (velo) velo.visible = true;
        return;
      }
      case 'fermo': {
        if (o.fino !== undefined && ctx.assoluto >= o.fino) {
          this.ottavio = { tipo: 'orario' };
          n.manuale = false;
          this.corbella.applicaOrario(ctx.giorno, ctx.ore);
          return;
        }
        const p = n.posizione();
        if (!n.presente || !p || surfaceDistance(p.z, p.theta, o.z, o.theta) > 0.3 || p.h - groundHeight(o.z, o.theta) > 1.5) {
          n.ferma();
          n.vaiA(o.z, o.theta);
          n.orientaVerso(ctx.elvira);
          n.mostra(true);
        }
        return;
      }
      case 'atterra': {
        o.t += dt / 7;
        const t = Math.min(1, o.t);
        const s = t * t * (3 - 2 * t);
        const hA = groundHeight(o.a.z, o.a.theta);
        const giri = (1 - t) * Math.PI * 3;
        const raggio = 18 * (1 - t);
        const zc = o.da.z + (o.a.z - o.da.z) * s;
        const thc = o.da.theta + deltaDeg(o.da.theta, o.a.theta) * s;
        const z = zc + Math.cos(giri) * raggio;
        const theta = thc + (Math.sin(giri) * raggio) / METERS_PER_DEG;
        const h = Math.max(groundHeight(z, theta), o.da.h + (hA - o.da.h) * s);
        n.vaiA(z, theta, { h, yaw: (giri * 180) / Math.PI + 90 });
        if (!n.presente) n.mostra(true);
        if (velo) velo.visible = t < 0.97;
        if (t >= 1) {
          this.ottavio = o.poi;
          n.vaiA(o.a.z, o.a.theta);
          n.rivolgiVerso(ctx.elvira); // atterrato, si gira con calma verso di lei
          n.mostra(true); // il collider sul suolo
        }
        return;
      }
      case 'accompagna': {
        const dest = luogo(o.tappe[0] ?? '');
        if (!dest) {
          this.ottavio = { tipo: 'orario' };
          return;
        }
        if (!n.presente || this.inVolo(n)) {
          // compare vicino a Elvira
          n.vaiA(ctx.elvira.z + 2, ctx.elvira.theta + 1.5 / METERS_PER_DEG);
          n.mostra(true);
          this.metaCammino = null;
        }
        const p = n.posizione()!;
        const dist = surfaceDistance(p.z, p.theta, dest.z, dest.theta);
        const distElvira = surfaceDistance(p.z, p.theta, ctx.elvira.z, ctx.elvira.theta);
        if (dist < 1.5) {
          this.metaCammino = null;
          if (o.tappe.length > 1 && distElvira < 12) o.tappe.shift();
          else if (o.tappe.length === 1) this.ottavio = { tipo: 'fermo', z: p.z, theta: p.theta };
          return;
        }
        if (distElvira > 22) {
          // aspetta che Elvira lo raggiunga
          if (n.inCammino) n.ferma();
          this.metaCammino = null;
          return;
        }
        this.cammina(n, dest, this.passoAccompagna);
        return;
      }
      case 'raggiunge': {
        // doveva già stare vicino a Elvira (fermo davanti al fienile): ci va e basta
        if (o.poi.tipo === 'fermo' && surfaceDistance(o.poi.z, o.poi.theta, ctx.elvira.z, ctx.elvira.theta) <= OTTAVIO_A_PORTATA) {
          this.ottavio = o.poi;
          this.aggiornaOttavio(dt, ctx); // subito al suo posto (fermo), non al passo dopo
          return;
        }
        const p = n.presente ? n.posizione() : null;
        const dist = p ? surfaceDistance(p.z, p.theta, ctx.elvira.z, ctx.elvira.theta) : Infinity;
        const fino = o.poi.tipo === 'fermo' && o.poi.fino !== undefined ? o.poi.fino : ctx.assoluto + 1;
        if (!p || dist > OTTAVIO_LONTANO_A_PIEDI || this.inVolo(n)) {
          // troppo lontano per venire a piedi (o in volo): scende dal cielo vicino a Elvira
          const q = this.accanto(ctx.elvira, p);
          this.atterra(q.z, q.theta, { tipo: 'fermo', z: q.z, theta: q.theta, fino });
          return;
        }
        if (dist <= OTTAVIO_VICINO + 0.15) {
          n.ferma();
          this.metaCammino = null;
          n.rivolgiVerso(ctx.elvira); // arrivato, si gira con calma verso di lei
          this.ottavio = o.poi.tipo === 'accompagna' ? o.poi : { tipo: 'fermo', z: p.z, theta: p.theta, fino };
          return;
        }
        this.cammina(n, this.accanto(ctx.elvira, p), 2.4);
        return;
      }
    }
  }

  /** Un punto a OTTAVIO_VICINO m da Elvira, dalla parte di `da` (o davanti a Mane). */
  private accanto(elvira: { z: number; theta: number }, da: { z: number; theta: number } | null): { z: number; theta: number } {
    const dz = da ? da.z - elvira.z : 0;
    const ds = da ? deltaDeg(elvira.theta, da.theta) * METERS_PER_DEG : 1;
    const d = Math.hypot(dz, ds) || 1;
    return { z: elvira.z + (dz / d) * OTTAVIO_VICINO, theta: elvira.theta + ((ds / d) * OTTAVIO_VICINO) / METERS_PER_DEG };
  }

  /** Dà l'ordine di camminare solo se la meta è cambiata (o se si era fermato). */
  private cammina(n: ManigliaNpc, meta: { z: number; theta: number }, velocita: number): void {
    const m = this.metaCammino;
    if (m && n.inCammino && surfaceDistance(m.z, m.theta, meta.z, meta.theta) < 1.2) return;
    this.metaCammino = { z: meta.z, theta: meta.theta };
    void n.cammina({ z: meta.z, theta: meta.theta }, velocita);
  }
}
