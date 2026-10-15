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
import type { Object3D, Vector3 } from 'three';
import type { ManigliaCorbella, ManigliaNpc } from '../popolamento';
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

  /** Chi parla si gira verso Elvira (il corpo; la testa la gira già da vicino). */
  voltaVerso(id: string, elvira: { z: number; theta: number }): void {
    const n = this.npc(id);
    if (n?.presente && !n.inCammino && !this.inVolo(n)) n.orientaVerso(elvira);
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
    this.sguardi(ctx);
  }

  /** Le posizioni dei contenuti con una condizione (il popolamento non le valuta). */
  private condizioni(ctx: ContestoAbitanti): void {
    const clelia = this.npc('clelia');
    if (!clelia) return;
    const via = ctx.giorno === 2 && ctx.valuta('dialogo:d_clelia_dono finito');
    if (via && !clelia.manuale) {
      clelia.manuale = true;
      clelia.mostra(false);
    } else if (!via && clelia.manuale) {
      clelia.manuale = false;
      this.corbella.applicaOrario(ctx.giorno, ctx.ore);
    }
  }

  private sguardi(ctx: ContestoAbitanti): void {
    const voltati = this.tempo < this.voltatiFino;
    for (const [id, n] of this.corbella.personaggi) {
      if (GRUPPI.has(id) || !n.figura) continue;
      const p = n.presente ? n.posizione() : null;
      const d = p ? surfaceDistance(p.z, p.theta, ctx.elvira.z, ctx.elvira.theta) : Infinity;
      if (d < 9 || (voltati && d < 70)) {
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
          n.orientaVerso(ctx.elvira);
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
          n.orientaVerso(ctx.elvira);
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
