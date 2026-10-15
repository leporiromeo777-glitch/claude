/**
 * Gli abitanti di Corbella (personaggi non giocanti): figure velate di `src/oggetti`
 * (`creaAbitante`), messe al loro posto secondo gli orari di personaggi.json, che girano la
 * testa verso Elvira quando è vicina e camminano quando la storia lo chiede.
 *
 * - `posizioni` dei personaggi: fase (ogni giorno, giorno N, dal giorno N, notte…), dalle/alle,
 *   luogo (un id di luoghi.json; «in volo», «fuori scena», «dentro» = non si vede);
 * - Ottavio segue la storia: scende in spirale dal cielo (`atterra`), accompagna Elvira
 *   (`npc:ottavio->accompagna:fienile_ottavio`), arriva quando lo si chiama con un fischio;
 * - la gente di Corbella: una dozzina di velati senza dialogo (piazza all'alba, il paese di
 *   giorno, i gradini davanti al telo dell'Ombrista alla brace).
 *
 * Quando arriverà il modulo `popolamento` con i «posti» degli abitanti, basterà passarli qui
 * al posto dei luoghi (vedi `PostiAbitanti`).
 */
import { DoubleSide, Group, Mesh, MeshLambertMaterial, PlaneGeometry, Vector3, type Scene } from 'three';
import { creaAbitante, posaSulCilindro, type OggettoProcedurale, type OpzioniAbitante, type StatoAbitante } from '../oggetti';
import { cylToWorld, deltaDeg, surfaceDistance, upAt, worldToCyl } from '../world/cylinder';
import { METERS_PER_DEG } from '../world/constants';
import { groundHeight } from '../world/terrain';
import { PERSONAGGI, luogo, oreDa, type Personaggio } from './contenuti';

export interface DefFigura {
  id: string;
  /** Personaggio dei dialoghi a cui parla (i bambini parlano come «bambini»). */
  parla?: string;
  opzioni: OpzioniAbitante;
  /** Scarto dal centro del luogo (m verso Mane, m verso Lag), per non sovrapporsi. */
  scarto: [number, number];
}

const NOCE = 0x8a6a4a;

export const FIGURE: DefFigura[] = [
  { id: 'togna', parla: 'togna', opzioni: { seme: 'togna', copricapo: 'velo', corporatura: 'robusta', postura: 'curva', coloreVelo: NOCE, colore: 0xe8e2d4 }, scarto: [1.2, 0.6] },
  { id: 'bortolo', parla: 'bortolo', opzioni: { seme: 'bortolo', copricapo: 'cappello', corporatura: 'robusta', postura: 'eretta', coloreVelo: NOCE }, scarto: [1.5, -1.0] },
  { id: 'annunciata', parla: 'annunciata', opzioni: { seme: 'annunciata', copricapo: 'velo', corporatura: 'anziana', postura: 'mani-giunte', bastone: true, coloreVelo: 0x5c4330 }, scarto: [0, 0] },
  { id: 'pina', parla: 'pina', opzioni: { seme: 'pina', copricapo: 'cappuccio', corporatura: 'anziana', postura: 'curva', coloreVelo: 0x8a8580 }, scarto: [0.3, 0.3] },
  { id: 'nando', parla: 'nando', opzioni: { seme: 'nando', copricapo: 'cappuccio', corporatura: 'media', postura: 'braccia-conserte', coloreVelo: 0xb8a68a, colore: 0xb8a68a }, scarto: [2.5, 1.5] },
  { id: 'clelia', parla: 'clelia', opzioni: { seme: 'clelia', copricapo: 'maschera-liscia', corporatura: 'esile', postura: 'mani-giunte', colore: 0x1e1c22, coloreVelo: 0x1e1c22 }, scarto: [1.4, -0.8] },
  { id: 'lisa', parla: 'bambini', opzioni: { seme: 'lisa', copricapo: 'velo', corporatura: 'bambino', postura: 'eretta', coloreVelo: 0xf2efe6 }, scarto: [-4, 3] },
  { id: 'gioanin', parla: 'bambini', opzioni: { seme: 'gioanin', copricapo: 'velo', corporatura: 'bambino', postura: 'mani-dietro', coloreVelo: 0xf2efe6 }, scarto: [-4.6, 3.6] },
  { id: 'ottavio', parla: 'ottavio', opzioni: { seme: 'ottavio', copricapo: 'cappuccio', corporatura: 'esile', postura: 'eretta', coloreVelo: 0x4f7a3a, colore: 0x5b6146 }, scarto: [2.2, -2.2] },
];

/** Posti dei velati senza nome (scarti attorno alla piazza, al sagrato, al lavatoio). */
const POSTI_VELATI: { luogo: string; scarto: [number, number] }[] = [
  { luogo: 'piazza_ore', scarto: [6, 4] },
  { luogo: 'piazza_ore', scarto: [-5, 7] },
  { luogo: 'piazza_ore', scarto: [8, -6] },
  { luogo: 'sagrato', scarto: [3, 2] },
  { luogo: 'lavatoio', scarto: [-2.5, -2] },
  { luogo: 'soglia_pina', scarto: [-3, 1.5] },
  { luogo: 'casa_del_velo', scarto: [3, -3] },
  { luogo: 'piazza_ore', scarto: [-8, -5] },
];

export interface Figura {
  def: DefFigura;
  obj: OggettoProcedurale<StatoAbitante>;
  stato: StatoAbitante;
  /** Posizione dei piedi (z, θ) e yaw (gradi da nord verso est). */
  z: number;
  theta: number;
  h: number;
  yaw: number;
  visibile: boolean;
  /** Luogo corrente (id) o null. */
  luogo: string | null;
}

type ModoOttavio =
  | { tipo: 'orario' }
  | { tipo: 'cielo' }
  | { tipo: 'atterra'; da: Vector3; a: { z: number; theta: number }; t: number; poi: ModoOttavio }
  | { tipo: 'fermo'; z: number; theta: number; fino?: number }
  | { tipo: 'accompagna'; tappe: string[] }
  /** Viene incontro a Elvira (un dialogo automatico con lui sta per aprirsi). */
  | { tipo: 'raggiunge'; poi: ModoOttavio };

/** A che distanza da Elvira Ottavio si ferma quando le viene incontro (m). */
const OTTAVIO_VICINO = 2.4;

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

const _v = new Vector3();
const _u = new Vector3();

export class Abitanti {
  readonly gruppo = new Group();
  readonly figure = new Map<string, Figura>();
  private velati: Figura[] = [];
  private ottavio: ModoOttavio = { tipo: 'orario' };
  private veloVerde: Mesh;
  /** Fino a quando (tempo di simulazione) i velati guardano tutti Elvira. */
  private voltatiFino = -1;
  private tempo = 0;
  /** Velocità di cammino di chi accompagna (m/s). */
  passoAccompagna = 1.7;

  constructor(scene: Scene) {
    this.gruppo.name = 'abitanti';
    scene.add(this.gruppo);
    for (const def of FIGURE) this.figure.set(def.id, this.crea(def));
    POSTI_VELATI.forEach((p, i) => {
      const def: DefFigura = {
        id: `velato_${i + 1}`,
        opzioni: { seme: `velato-${i}`, copricapo: i % 3 === 0 ? 'cappello' : i % 4 === 1 ? 'maschera' : 'velo', corporatura: i % 3 === 2 ? 'anziana' : 'media', postura: i % 2 ? 'mani-dietro' : 'eretta' },
        scarto: p.scarto,
      };
      this.velati.push(this.crea(def));
    });
    this.veloVerde = new Mesh(new PlaneGeometry(3.6, 1.4), new MeshLambertMaterial({ color: 0x5f8a42, side: DoubleSide }));
    this.veloVerde.name = 'velo-verde-ottavio';
    this.veloVerde.visible = false;
    this.gruppo.add(this.veloVerde);
  }

  private crea(def: DefFigura): Figura {
    const obj = creaAbitante(def.opzioni);
    obj.gruppo.name = `figura-${def.id}`;
    obj.gruppo.visible = false;
    this.gruppo.add(obj.gruppo);
    return { def, obj, stato: { modo: 'fermo', guarda: null }, z: 0, theta: 0, h: 0, yaw: 0, visibile: false, luogo: null };
  }

  /** Testa della figura (mondo), per i bersagli del dialogo. */
  testa(id: string, out = new Vector3()): Vector3 | null {
    const f = this.figure.get(id);
    if (!f?.visibile) return null;
    const k = f.def.opzioni.corporatura === 'bambino' ? 1.0 : 1.5;
    return cylToWorld(f.z, f.theta, f.h + k, out);
  }

  /** Il punto dove si parla a un personaggio dei dialoghi («bambini» = Lisa). */
  puntoDialogo(personaggio: string): Vector3 | null {
    for (const f of this.figure.values()) if (f.def.parla === personaggio && f.visibile) return this.testa(f.def.id);
    return null;
  }

  presente(id: string): boolean {
    return !!this.figure.get(id)?.visibile;
  }

  /** I velati della piazza si voltano tutti insieme verso Elvira (evento:velati_si_voltano). */
  voltatiTutti(secondi = 25): void {
    this.voltatiFino = this.tempo + secondi;
  }

  /** Ottavio scende in spirale da una corrente calda sopra la grà e atterra vicino a (z, θ). */
  atterra(z: number, theta: number, poi: ModoOttavio = { tipo: 'fermo', z, theta }): void {
    const da = cylToWorld(z - 30, theta - 2, groundHeight(z, theta) + 70);
    this.ottavio = { tipo: 'atterra', da, a: { z, theta }, t: 0, poi };
  }

  /** Comandi «npc:» dei contenuti: «ottavio->accompagna:fienile_ottavio». */
  ordine(testo: string): void {
    const m = /^(\w+)->(\w+):?(.*)$/.exec(testo.trim());
    if (!m || m[1] !== 'ottavio') return;
    if (m[2] === 'accompagna') {
      const dest = m[3] || 'fienile_ottavio';
      this.ottavio = { tipo: 'accompagna', tappe: dest === 'fienile_ottavio' ? ['passerella_messo', 'fienile_ottavio'] : [dest] };
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

  /** Ottavio nascosto (in volo) finché la storia non lo fa scendere. */
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
    if (o.tipo === 'raggiunge' || o.tipo === 'atterra' || o.tipo === 'cielo') return;
    this.ottavio = { tipo: 'raggiunge', poi: o };
  }

  /** Distanza (sulla superficie) fra una figura visibile e un punto; Infinity se non c'è. */
  distanzaDa(id: string, z: number, theta: number): number {
    const f = this.figure.get(id);
    return f?.visibile ? surfaceDistance(f.z, f.theta, z, theta) : Infinity;
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
  }

  private posa(f: Figura, z: number, theta: number, yaw: number, h = groundHeight(z, theta)): void {
    f.z = z;
    f.theta = theta;
    f.h = h;
    f.yaw = yaw;
    posaSulCilindro(f.obj.gruppo, z, theta, h, yaw);
  }

  private mostra(f: Figura, si: boolean): void {
    f.visibile = si;
    f.obj.gruppo.visible = si;
  }

  private alLuogo(f: Figura, id: string | null, scarto = f.def.scarto): void {
    if (!id) {
      this.mostra(f, false);
      f.luogo = null;
      return;
    }
    const l = luogo(id)!;
    const z = l.z + scarto[1];
    const theta = l.theta + scarto[0] / METERS_PER_DEG;
    if (f.luogo !== id || !f.visibile) {
      const versoPiazza = (Math.atan2(deltaDeg(theta, 37) * METERS_PER_DEG, 1046 - z) * 180) / Math.PI;
      this.posa(f, z, theta, Number.isFinite(versoPiazza) ? versoPiazza : 0);
    }
    f.luogo = id;
    this.mostra(f, true);
  }

  update(dt: number, ctx: ContestoAbitanti): void {
    this.tempo += dt;
    const voltati = this.tempo < this.voltatiFino;
    for (const f of this.figure.values()) {
      if (f.def.id === 'ottavio') this.aggiornaOttavio(f, dt, ctx);
      else {
        const pid = f.def.id;
        const p = PERSONAGGI.find((x) => x.id === pid);
        this.alLuogo(f, p ? luogoDaOrario(p, ctx.giorno, ctx.ore, ctx.valuta) : null);
      }
    }
    const pv = PERSONAGGI.find((x) => x.id === 'velati_corbella');
    this.velati.forEach((f, i) => {
      const dove = pv ? luogoDaOrario(pv, ctx.giorno, ctx.ore) : null;
      const posto = POSTI_VELATI[i]!;
      if (ctx.ore >= 5.5 && ctx.ore < 6.5) this.alLuogo(f, 'piazza_ore', [posto.scarto[0] * 0.8, posto.scarto[1] * 0.8]);
      else if (ctx.ore >= 19.75 && ctx.ore < 20.5) this.alLuogo(f, 'telo_ombrista', [(i % 4) * 1.6 - 2.4, -4 - Math.floor(i / 4) * 1.5]);
      else this.alLuogo(f, dove || (ctx.ore >= 6.5 && ctx.ore < 19.5) ? posto.luogo : null);
    });
    // testa verso Elvira (vicina, o tutti quando si voltano)
    for (const f of [...this.figure.values(), ...this.velati]) {
      if (!f.visibile) continue;
      const vicino = surfaceDistance(f.z, f.theta, ctx.elvira.z, ctx.elvira.theta);
      const guarda = vicino < 9 || (voltati && vicino < 70);
      f.stato.guarda = guarda ? ctx.occhi.clone() : null;
      f.obj.update?.(dt, f.stato);
    }
  }

  private aggiornaOttavio(f: Figura, dt: number, ctx: ContestoAbitanti): void {
    const o = this.ottavio;
    this.veloVerde.visible = false;
    f.stato.modo = 'fermo';
    switch (o.tipo) {
      case 'orario': {
        const p = PERSONAGGI.find((x) => x.id === 'ottavio');
        this.alLuogo(f, p ? luogoDaOrario(p, ctx.giorno, ctx.ore, ctx.valuta) : null);
        return;
      }
      case 'cielo':
        this.mostra(f, false);
        return;
      case 'fermo': {
        if (o.fino !== undefined && ctx.assoluto >= o.fino) {
          this.ottavio = { tipo: 'orario' };
          return;
        }
        if (!f.visibile || Math.abs(f.z - o.z) > 0.01 || Math.abs(f.theta - o.theta) > 1e-4) {
          this.posa(f, o.z, o.theta, f.yaw);
          f.luogo = null;
        }
        this.mostra(f, true);
        return;
      }
      case 'atterra': {
        o.t += dt / 7;
        const t = Math.min(1, o.t);
        const a = cylToWorld(o.a.z, o.a.theta, groundHeight(o.a.z, o.a.theta));
        const giri = (1 - t) * Math.PI * 3;
        const raggio = 18 * (1 - t);
        _v.lerpVectors(o.da, a, t * t * (3 - 2 * t));
        const c = worldToCyl(_v);
        const z = c.z + Math.cos(giri) * raggio;
        const theta = c.theta + (Math.sin(giri) * raggio) / METERS_PER_DEG;
        const h = Math.max(groundHeight(z, theta), c.h);
        this.posa(f, z, theta, (giri * 180) / Math.PI + 90, h);
        this.mostra(f, true);
        f.luogo = null;
        if (t < 0.97) {
          this.veloVerde.visible = true;
          upAt(theta, _u);
          this.veloVerde.position.copy(cylToWorld(z, theta, h + 2.3));
          this.veloVerde.lookAt(_v.copy(this.veloVerde.position).add(_u));
        }
        if (t >= 1) this.ottavio = o.poi;
        return;
      }
      case 'raggiunge': {
        const dz = ctx.elvira.z - f.z;
        const ds = deltaDeg(f.theta, ctx.elvira.theta) * METERS_PER_DEG;
        const dist = Math.hypot(dz, ds);
        if (!f.visibile || dist <= OTTAVIO_VICINO) {
          // arrivato: resta lì (fino a quando sarebbe rimasto dov'era, o per un'ora)
          const fino = o.poi.tipo === 'fermo' && o.poi.fino !== undefined ? o.poi.fino : ctx.assoluto + 1;
          this.ottavio = o.poi.tipo === 'accompagna' ? o.poi : { tipo: 'fermo', z: f.z, theta: f.theta, fino };
          this.mostra(f, true);
          return;
        }
        const passo = Math.min(dist - OTTAVIO_VICINO, 2.4 * dt);
        const k = passo / dist;
        this.posa(f, f.z + dz * k, f.theta + (ds * k) / METERS_PER_DEG, (Math.atan2(ds, dz) * 180) / Math.PI);
        this.mostra(f, true);
        f.stato.modo = 'cammina';
        f.stato.velocita = 2.4;
        f.luogo = null;
        return;
      }
      case 'accompagna': {
        const dest = luogo(o.tappe[0] ?? '');
        if (!dest) {
          this.ottavio = { tipo: 'orario' };
          return;
        }
        if (!f.visibile) {
          // compare vicino a Elvira
          this.posa(f, ctx.elvira.z + 2, ctx.elvira.theta + 1.5 / METERS_PER_DEG, 0);
          this.mostra(f, true);
        }
        const dist = surfaceDistance(f.z, f.theta, dest.z, dest.theta);
        const distElvira = surfaceDistance(f.z, f.theta, ctx.elvira.z, ctx.elvira.theta);
        if (dist < 1.5) {
          if (o.tappe.length > 1 && distElvira < 12) o.tappe.shift();
          else if (o.tappe.length === 1) this.ottavio = { tipo: 'fermo', z: f.z, theta: f.theta };
          return;
        }
        if (distElvira > 22) return; // aspetta che Elvira lo raggiunga
        const passo = Math.min(dist, this.passoAccompagna * dt);
        const dz = dest.z - f.z;
        const ds = deltaDeg(f.theta, dest.theta) * METERS_PER_DEG;
        const k = passo / Math.max(1e-6, Math.hypot(dz, ds));
        const z = f.z + dz * k;
        const theta = f.theta + (ds * k) / METERS_PER_DEG;
        this.posa(f, z, theta, (Math.atan2(ds, dz) * 180) / Math.PI);
        f.stato.modo = 'cammina';
        f.stato.velocita = this.passoAccompagna;
        f.luogo = null;
        return;
      }
    }
  }
}
