/**
 * Gli abitanti di Corbella: una figura della libreria `oggetti` (SkinnedMesh, materiale toon della
 * libreria, animazione procedurale) per ogni personaggio di `personaggi.json` che ha un corpo, alla
 * sua posizione per fase e ora, con una maniglia `npc(id)`:
 *   posizione, vaiA (teletrasporto), guarda (testa verso un punto), gesto (saluta, indica, mano al
 *   petto), posa (in piedi, seduto, chino), cammina (lungo il suolo, a tappe), mostra/nascondi.
 *
 * Il materiale toon della libreria ha bisogno di luci: un piccolo impianto (emisfero + direzionale)
 * segue il cielo del motore (luce della Linea, ambiente, notte). Lo shader del mondo non ha lo
 * skinning: per questo gli abitanti restano con il materiale della libreria (vedi README oggetti).
 *
 * Personaggi senza corpo nella Fase 1: Elvira (è il giocatore), Meridiana (voce dall'altoparlante
 * della cella), Aurelio, Marta, la mano del vetro, la Pesarina; la Madre e Rosa hanno la figura ma
 * stanno fuori scena. Le Fade (sciame notturno) e Tecla (una lanterna sulla Finestra delle Vedove)
 * hanno una maniglia speciale (notte.ts).
 */
import * as THREE from 'three';
import { creaAbitante, type OpzioniAbitante, type StatoAbitante } from '../oggetti/oggetti/abitante';
import { matriceSuperficie } from '../oggetti/cilindro';
import { geoBoxC, geoCilindro, geoLastra, geoPiano } from '../oggetti/forme';
import { Costruttore, mat } from '../oggetti/costruttore';
import { PALETTE } from '../oggetti/palette';
import { cylinderAt, type Collider, type ColliderWorld } from '../world/colliders';
import { localFrameTheta } from '../world/cylinder';
import { DEG } from '../world/constants';
import { PERSONAGGI, luogoOpz, ore, type Personaggio, type PosizionePersonaggio } from './contenuti';
import type { Contesto } from './contesto';
import { cil, distanza, mondo, sposta, spostaYaw, suolo, yawVerso, type PuntoCil } from './terreno';
import type { GestoNpc, PosaNpc, PosCil, PuntoInterazione } from './tipi';

/** Aspetto di ogni personaggio con un corpo (dai contenuti: velo, maschera, postura, colori). */
const ASPETTO: Record<string, OpzioniAbitante & { altezzaSeduta?: number }> = {
  ottavio: { seme: 'ottavio', copricapo: 'velo', corporatura: 'esile', postura: 'eretta', colore: 0x5c7442, coloreVelo: 0x4f8a46 },
  pina: { seme: 'pina', copricapo: 'cappuccio', corporatura: 'anziana', postura: 'curva', colore: 0x7c766e, coloreVelo: 0x8d8780 },
  togna: { seme: 'togna', copricapo: 'velo', corporatura: 'robusta', postura: 'curva', colore: 0xd9d0bf, coloreVelo: 0x6a4a31 },
  bortolo: { seme: 'bortolo', copricapo: 'cappello', corporatura: 'robusta', postura: 'mani-dietro', colore: 0x5a4a3a, coloreVelo: 0x1f1d22 },
  annunciata: { seme: 'annunciata', copricapo: 'velo', corporatura: 'anziana', postura: 'mani-giunte', colore: 0x4b3322, coloreVelo: 0x4b3322, bastone: true },
  nando: { seme: 'nando', copricapo: 'cappello', corporatura: 'robusta', postura: 'eretta', colore: 0xcfbd97, coloreVelo: 0x8a7a5a, guanti: false },
  clelia: { seme: 'clelia', copricapo: 'maschera-liscia', corporatura: 'esile', postura: 'mani-giunte', colore: 0x1b191e, coloreVelo: 0x141216 },
  lisa: { seme: 'lisa', copricapo: 'velo', corporatura: 'bambino', postura: 'eretta', colore: 0xe9e3d6, coloreVelo: 0xf2eee4 },
  gioanin: { seme: 'gioanin', copricapo: 'velo', corporatura: 'bambino', postura: 'eretta', colore: 0xe2dccc, coloreVelo: 0xf4f0e6 },
  la_madre: { seme: 'la-madre', copricapo: 'maschera-liscia', corporatura: 'esile', postura: 'mani-giunte', colore: 0x121014, coloreVelo: 0x0e0c10 },
  rosa: { seme: 'rosa', copricapo: 'apicoltore', corporatura: 'media', postura: 'eretta', colore: 0x8a5a3a, coloreVelo: 0xb8693a },
};

/** I dodici velati di Corbella. */
const VELATI: Array<OpzioniAbitante> = [
  { copricapo: 'velo', corporatura: 'media' },
  { copricapo: 'cappello', corporatura: 'robusta' },
  { copricapo: 'cappuccio', corporatura: 'esile' },
  { copricapo: 'maschera', corporatura: 'anziana', bastone: true },
  { copricapo: 'velo', corporatura: 'esile', gerla: true },
  { copricapo: 'cappello', corporatura: 'media' },
  { copricapo: 'velo', corporatura: 'robusta', postura: 'braccia-conserte' },
  { copricapo: 'maschera', corporatura: 'media', postura: 'mani-dietro' },
  { copricapo: 'cappuccio', corporatura: 'anziana', postura: 'curva' },
  { copricapo: 'velo', corporatura: 'media', gerla: true },
  { copricapo: 'cappello', corporatura: 'esile' },
  { copricapo: 'velo', corporatura: 'anziana', postura: 'mani-giunte' },
];

/** Dove stanno i velati «in giro per Corbella» (orti, botteghe, grà, lavatoio, vicoli). */
const GIRO_VELATI: PuntoCil[] = [
  { z: 1041.5, theta: 40.3 },
  { z: 1074, theta: 33.0 },
  { z: 1088, theta: 31.4 },
  { z: 1112, theta: 43.2 },
  { z: 1182, theta: 44.6 },
  { z: 1060, theta: 41.3 },
  { z: 1021, theta: 37.6 },
  { z: 1100, theta: 36.8 },
  { z: 1135, theta: 40.2 },
  { z: 1032, theta: 31.8 },
  { z: 1003, theta: 38.4 },
  { z: 1066, theta: 35.2 },
];

export interface ManigliaNpc {
  readonly id: string;
  readonly nome: string;
  /** la figura (null per chi non ha un corpo nella Fase 1) */
  readonly figura: THREE.Group | null;
  readonly presente: boolean;
  /** luogo dei contenuti in cui sta (o null) */
  readonly luogo: string | null;
  posizione(): PosCil | null;
  /** teletrasporto sul suolo (o a quota `h` assoluta) */
  vaiA(z: number, theta: number, opz?: { h?: number; yaw?: number; sopra?: number }): void;
  /** gira il corpo verso un punto (z, theta) */
  orientaVerso(p: PuntoCil): void;
  /** la testa segue un punto (mondo o cilindrico); null = guarda avanti */
  guarda(p: THREE.Vector3 | PosCil | null): void;
  /** gesto della mano destra; `durata` s (0 = finché non se ne chiede un altro) */
  gesto(g: GestoNpc, durata?: number, indica?: THREE.Vector3 | PosCil): void;
  posa(p: PosaNpc): void;
  /** cammina lungo il suolo fino al punto (o lungo le tappe); la promessa si risolve all'arrivo */
  cammina(verso: PuntoCil | PuntoCil[], velocita?: number): Promise<void>;
  ferma(): void;
  readonly inCammino: boolean;
  mostra(on: boolean): void;
  /** se true, l'orario non lo sposta più (lo comanda l'integratore) */
  manuale: boolean;
  /** punto d'interazione «parla» */
  readonly punto: PuntoInterazione | null;
}

interface StatoNpc {
  personaggio: Personaggio | null;
  id: string;
  nome: string;
  figura: THREE.Group | null;
  obj: ReturnType<typeof creaAbitante> | null;
  pos: PosCil | null;
  yaw: number;
  posa: PosaNpc;
  stato: StatoAbitante;
  gestoFino: number;
  percorso: PuntoCil[];
  velocita: number;
  risolvi: (() => void) | null;
  presente: boolean;
  luogo: string | null;
  manuale: boolean;
  collider: Collider | null;
  punto: PuntoInterazione | null;
  extra: THREE.Object3D | null;
  altezzaFianchi: number;
}

export class Abitanti {
  readonly gruppo = new THREE.Group();
  readonly npc = new Map<string, ManigliaNpc>();
  private stati = new Map<string, StatoNpc>();
  private t = 0;
  private sole = new THREE.DirectionalLight(0xfff0d8, 2.0);
  private emisfero = new THREE.HemisphereLight(0xc8d8e8, 0x8a7a5a, 2.5);
  private colliders: ColliderWorld | null = null;
  private velati: string[] = [];

  constructor(
    private ctx: Contesto,
    private conLuci = true,
  ) {
    this.gruppo.name = 'corbella:abitanti';
    if (conLuci) this.gruppo.add(this.sole, this.sole.target, this.emisfero);
    for (const p of PERSONAGGI) {
      if (p.id === 'velati_corbella') {
        VELATI.forEach((v, i) => {
          const id = `velato_${i + 1}`;
          this.crea(id, `Velato ${i + 1}`, { seme: id, ...v }, p);
          this.velati.push(id);
        });
        continue;
      }
      if (p.id === 'bambini') continue; // gruppo: si usano lisa e gioanin
      const asp = ASPETTO[p.id];
      this.crea(p.id, p.nome, asp ?? null, p);
    }
    this.creaGruppoBambini();
    this.creaGruppoVelati();
  }

  /** Maniglia di gruppo per «la gente di Corbella» (i dodici velati). */
  private creaGruppoVelati(): void {
    const membri = this.velati.map((id) => this.npc.get(id)!);
    const p = PERSONAGGI.find((x) => x.id === 'velati_corbella');
    const primo = membri[0]!;
    const m: ManigliaNpc = {
      id: 'velati_corbella',
      nome: p?.nome ?? 'La gente di Corbella',
      figura: primo.figura,
      get presente() {
        return membri.some((x) => x.presente);
      },
      get luogo() {
        return primo.luogo;
      },
      posizione: () => primo.posizione(),
      vaiA(z, th, o) {
        membri.forEach((x, i) => {
          const a = (i / membri.length) * Math.PI * 2;
          const q = sposta(z, th, Math.cos(a) * 3.5, Math.sin(a) * 3.5, 40);
          x.vaiA(q.z, q.theta, o?.yaw !== undefined ? { yaw: o.yaw } : {});
          x.orientaVerso({ z, theta: th });
        });
      },
      orientaVerso: (q) => membri.forEach((x) => x.orientaVerso(q)),
      guarda: (q) => membri.forEach((x) => x.guarda(q)),
      gesto: (g, d, i) => membri.forEach((x) => x.gesto(g, d, i)),
      posa: (q) => membri.forEach((x) => x.posa(q)),
      async cammina(verso, v) {
        const dest = Array.isArray(verso) ? verso : [verso];
        const ultimo = dest[dest.length - 1]!;
        await Promise.all(
          membri.map((x, i) => {
            const a = (i / membri.length) * Math.PI * 2;
            const q = sposta(ultimo.z, ultimo.theta, Math.cos(a) * 3.5, Math.sin(a) * 3.5, 40);
            return x.cammina([...dest.slice(0, -1), q], v);
          }),
        );
      },
      ferma: () => membri.forEach((x) => x.ferma()),
      get inCammino() {
        return membri.some((x) => x.inCammino);
      },
      mostra: (on) => membri.forEach((x) => x.mostra(on)),
      get manuale() {
        return primo.manuale;
      },
      set manuale(v: boolean) {
        membri.forEach((x) => (x.manuale = v));
      },
      punto: primo.punto,
    };
    this.npc.set('velati_corbella', m);
  }

  /** Collega i collider dei personaggi al mondo del motore (cilindri `personaggio`). */
  collegaCollider(c: ColliderWorld): void {
    this.colliders = c;
    for (const s of this.stati.values()) this.aggiornaCollider(s);
  }

  private crea(id: string, nome: string, aspetto: OpzioniAbitante | null, p: Personaggio | null): void {
    let figura: THREE.Group | null = null;
    let obj: ReturnType<typeof creaAbitante> | null = null;
    let extra: THREE.Object3D | null = null;
    if (aspetto) {
      obj = creaAbitante(aspetto);
      figura = new THREE.Group();
      figura.name = `abitante:${id}`;
      figura.add(obj.gruppo);
      figura.visible = false;
      this.gruppo.add(figura);
      extra = this.accessori(id, obj);
    }
    const s: StatoNpc = {
      personaggio: p,
      id,
      nome,
      figura,
      obj,
      pos: null,
      yaw: 0,
      posa: 'in-piedi',
      stato: { modo: 'fermo' },
      gestoFino: 0,
      percorso: [],
      velocita: 1.1,
      risolvi: null,
      presente: false,
      luogo: null,
      manuale: false,
      collider: null,
      punto: null,
      extra,
      altezzaFianchi: obj ? obj.ingombro.altezza * 0.52 : 0.9,
    };
    if (figura) {
      s.punto = this.ctx.punto(`parla:${id}`, 'parla', `Parla con ${nome.split(',')[0]}`, new THREE.Vector3(), { raggio: 2.6, rif: p?.id ?? id, attivo: false });
    }
    this.stati.set(id, s);
    this.npc.set(id, this.maniglia(s));
  }

  /** Oggetti in mano o alla cintura (attaccati alle ossa). */
  private accessori(id: string, obj: ReturnType<typeof creaAbitante>): THREE.Object3D | null {
    const osso = (nome: string) => {
      let o: THREE.Object3D | null = null;
      obj.gruppo.traverse((x) => {
        if ((x as THREE.Bone).isBone && x.name === nome) o = x;
      });
      return o as THREE.Object3D | null;
    };
    if (id === 'nando') {
      // sempre una pietra in mano
      const b = new Costruttore(46);
      b.aggiungi(geoLastra(0.26, 0.16, 0.2, 46, 0.2), { colore: PALETTE.gneiss, piatto: true });
      const g = b.costruisci('pietra-nando');
      g.position.set(-0.05, -0.32, 0.05);
      osso('avambraccioD')?.add(g);
      return g;
    }
    if (id === 'ottavio') {
      // lume a petrolio d'ottone alla cintura e il Velo verde (visibile in volo)
      const b = new Costruttore(8);
      b.aggiungi(geoCilindro(0.05, 0.06, 0.16, 6), { colore: PALETTE.ottone });
      b.aggiungi(geoBoxC(0.08, 0.06, 0.08), { matrice: mat([0, 0.19, 0]), colore: 0xffc870, canale: 'lume' });
      const lume = b.costruisci('lume-ottavio');
      lume.position.set(-0.2, -0.05, 0.1);
      osso('bacino')?.add(lume);
      const v = new Costruttore(9);
      const tela = geoPiano(3.6, 1.8, 6, 3);
      const pp = tela.getAttribute('position');
      for (let i = 0; i < pp.count; i++) pp.setZ(i, -Math.pow(pp.getX(i) / 1.8, 2) * 0.35);
      v.aggiungi(tela, { matrice: mat([0, 2.6, 0], [-Math.PI / 2 + 0.25, 0, 0]), colore: 0x5f8a4a, canale: 'sottile' });
      v.aggiungi(geoBoxC(3.7, 0.06, 0.06), { matrice: mat([0, 2.65, 0.6]), colore: PALETTE.legno });
      for (const s of [-1, 1]) v.aggiungi(geoCilindro(0.02, 0.02, 1.2, 4), { matrice: mat([s * 0.25, 1.45, 0.1], [0, 0, s * 0.2]), colore: PALETTE.legno });
      const velo = v.costruisci('velo-ottavio');
      velo.visible = false;
      velo.name = 'velo-ottavio';
      obj.gruppo.add(velo);
      return velo;
    }
    return null;
  }

  private creaGruppoBambini(): void {
    const lisa = this.stati.get('lisa');
    const gioanin = this.stati.get('gioanin');
    const p = PERSONAGGI.find((x) => x.id === 'bambini') ?? null;
    if (!lisa || !gioanin) return;
    const self = this;
    const m: ManigliaNpc = {
      id: 'bambini',
      nome: p?.nome ?? 'Lisa e Gioanin',
      figura: lisa.figura,
      get presente() {
        return lisa.presente;
      },
      get luogo() {
        return lisa.luogo;
      },
      posizione: () => self.npc.get('lisa')!.posizione(),
      vaiA(z, th, o) {
        self.npc.get('lisa')!.vaiA(z, th, o);
        const q = spostaYaw(z, th, (o?.yaw ?? 0) + 160, 0.9, 40);
        self.npc.get('gioanin')!.vaiA(q.z, q.theta, { ...o });
      },
      orientaVerso(q) {
        self.npc.get('lisa')!.orientaVerso(q);
        self.npc.get('gioanin')!.orientaVerso(q);
      },
      guarda(q) {
        self.npc.get('lisa')!.guarda(q);
        self.npc.get('gioanin')!.guarda(q);
      },
      gesto: (g, d, i) => self.npc.get('lisa')!.gesto(g, d, i),
      posa(q) {
        self.npc.get('lisa')!.posa(q);
        self.npc.get('gioanin')!.posa(q);
      },
      async cammina(verso, v) {
        const dest = Array.isArray(verso) ? verso : [verso];
        const ultimo = dest[dest.length - 1]!;
        const dietro = spostaYaw(ultimo.z, ultimo.theta, 200, 1.0, 40);
        await Promise.all([self.npc.get('lisa')!.cammina(dest, v), self.npc.get('gioanin')!.cammina([...dest.slice(0, -1), dietro], v)]);
      },
      ferma() {
        self.npc.get('lisa')!.ferma();
        self.npc.get('gioanin')!.ferma();
      },
      get inCammino() {
        return self.npc.get('lisa')!.inCammino;
      },
      mostra(on) {
        self.npc.get('lisa')!.mostra(on);
        self.npc.get('gioanin')!.mostra(on);
      },
      get manuale() {
        return lisa.manuale;
      },
      set manuale(v: boolean) {
        lisa.manuale = v;
        gioanin.manuale = v;
      },
      punto: lisa.punto,
    };
    this.npc.set('bambini', m);
  }

  private maniglia(s: StatoNpc): ManigliaNpc {
    const self = this;
    return {
      id: s.id,
      nome: s.nome,
      figura: s.figura,
      get presente() {
        return s.presente;
      },
      get luogo() {
        return s.luogo;
      },
      posizione: () => (s.pos ? { ...s.pos } : null),
      vaiA(z, theta, o = {}) {
        const h = o.h ?? suolo(z, theta) + (o.sopra ?? 0);
        s.pos = { z, theta, h };
        if (o.yaw !== undefined) s.yaw = o.yaw;
        s.percorso = [];
        s.stato.modo = 'fermo';
        self.posaFigura(s);
      },
      orientaVerso(p) {
        if (!s.pos) return;
        s.yaw = yawVerso(s.pos, p);
        self.posaFigura(s);
      },
      guarda(p) {
        if (!p) s.stato.guarda = null;
        else if (p instanceof THREE.Vector3) s.stato.guarda = p.clone();
        else s.stato.guarda = mondo(p.z, p.theta, p.h);
      },
      gesto(g, durata = 0, indica) {
        s.stato.gesto = g;
        s.gestoFino = durata > 0 ? self.t + durata : 0;
        if (indica) s.stato.indica = indica instanceof THREE.Vector3 ? indica.clone() : mondo(indica.z, indica.theta, indica.h);
      },
      posa(p) {
        s.posa = p;
      },
      cammina(verso, velocita = 1.1) {
        const tappe = Array.isArray(verso) ? [...verso] : [verso];
        s.percorso = tappe;
        s.velocita = velocita;
        s.posa = 'in-piedi';
        if (s.risolvi) s.risolvi();
        return new Promise<void>((ok) => {
          s.risolvi = ok;
          if (!s.pos) {
            const t = tappe[tappe.length - 1]!;
            this.vaiA(t.z, t.theta);
            s.risolvi = null;
            ok();
          }
        });
      },
      ferma() {
        s.percorso = [];
        s.stato.modo = 'fermo';
        s.risolvi?.();
        s.risolvi = null;
      },
      get inCammino() {
        return s.percorso.length > 0;
      },
      mostra(on) {
        self.mostra(s, on);
      },
      get manuale() {
        return s.manuale;
      },
      set manuale(v: boolean) {
        s.manuale = v;
      },
      punto: s.punto,
    };
  }

  private mostra(s: StatoNpc, on: boolean): void {
    s.presente = on && !!s.figura;
    if (s.figura) s.figura.visible = s.presente;
    if (s.punto) s.punto.attivo = s.presente;
    this.aggiornaCollider(s);
  }

  private aggiornaCollider(s: StatoNpc): void {
    if (!this.colliders) return;
    if (s.collider) {
      this.colliders.remove(s.collider.id);
      s.collider = null;
    }
    if (!s.presente || !s.pos || !s.obj) return;
    s.collider = cylinderAt(s.pos.z, s.pos.theta, s.pos.h, 0.3, Math.max(1.0, s.obj.ingombro.altezza - (s.posa === 'seduto' ? 0.6 : 0)), 'personaggio');
    this.colliders.add(s.collider);
  }

  /** Mette la figura nella posizione corrente (matrice di superficie del cilindro). */
  private posaFigura(s: StatoNpc): void {
    if (!s.figura || !s.pos) return;
    matriceSuperficie(s.pos.z, s.pos.theta, s.pos.h, s.yaw).decompose(s.figura.position, s.figura.quaternion, s.figura.scale);
    s.figura.updateMatrixWorld(true);
    if (s.punto) {
      s.punto.pos.copy(mondo(s.pos.z, s.pos.theta, s.pos.h + 1.3));
      const c = cil(s.punto.pos);
      s.punto.cil = { z: c.z, theta: c.theta, h: c.h };
    }
  }

  // ------------------------------------------------------------- orari

  /**
   * Mette ogni personaggio dove dicono i contenuti per il giorno e l'ora (ore decimali).
   * Restituisce, per personaggio, il luogo scelto (o la ragione per cui non c'è).
   */
  applicaOrario(giorno: number, ora: number): Record<string, string> {
    const out: Record<string, string> = {};
    for (const p of PERSONAGGI) {
      if (p.id === 'bambini') continue;
      if (p.id === 'velati_corbella') {
        const voce = scegliPosizione(p, giorno, ora);
        this.velati.forEach((id, i) => {
          const s = this.stati.get(id)!;
          if (s.manuale) return;
          out[id] = this.collocaVelato(s, voce, i);
        });
        continue;
      }
      const s = this.stati.get(p.id);
      if (!s || s.manuale) continue;
      const voce = scegliPosizione(p, giorno, ora);
      out[p.id] = this.colloca(s, voce, giorno, ora);
    }
    return out;
  }

  private colloca(s: StatoNpc, voce: PosizionePersonaggio | null, giorno: number, ora: number): string {
    void giorno;
    if (!s.figura) {
      s.luogo = voce?.luogo ?? null;
      return voce ? `senza corpo: ${voce.luogo}` : 'senza corpo';
    }
    if (!voce) {
      this.mostra(s, false);
      s.luogo = null;
      return 'nessuna posizione';
    }
    const testo = voce.luogo;
    const id = testo.split(/[ (]/)[0]!;
    const l = luogoOpz(id);
    const velo = s.extra?.name === 'velo-ottavio' ? s.extra : null;
    if (velo) velo.visible = false;
    if (testo.startsWith('in volo')) {
      // Ottavio vola sopra la valle: un segnale di cielo (Velo verde)
      const t = this.t * 0.05 + ora;
      const c = sposta(1090, 42, Math.cos(t) * 60, Math.sin(t) * 40, 40);
      s.pos = { z: c.z, theta: c.theta, h: suolo(c.z, c.theta) + 55 };
      s.yaw = (t * 180) / Math.PI + 90;
      s.posa = 'in-piedi';
      if (velo) velo.visible = true;
      s.luogo = null;
      this.posaFigura(s);
      this.mostra(s, true);
      return 'in volo';
    }
    if (!l || /dentro|fuori scena/.test(testo) || testo.startsWith('porta_bugni') || testo.startsWith('Eremo')) {
      this.mostra(s, false);
      s.luogo = l?.id ?? null;
      return `fuori scena (${testo})`;
    }
    const piazzamento = PIAZZAMENTI[`${s.id}@${l.id}`] ?? PIAZZAMENTI[`*@${l.id}`];
    let z = l.z;
    let th = l.theta;
    let posa: PosaNpc = 'in-piedi';
    let guardaVerso: PuntoCil | null = null;
    let sopra = 0;
    if (piazzamento) {
      const q = sposta(l.z, l.theta, piazzamento.nord ?? 0, piazzamento.est ?? 0, 40);
      z = q.z;
      th = q.theta;
      posa = piazzamento.posa ?? 'in-piedi';
      guardaVerso = piazzamento.verso ? (luogoOpz(piazzamento.verso) ?? null) : null;
      sopra = piazzamento.sopra ?? 0;
    }
    if (!s.pos || distanza(s.pos, { z, theta: th }) > 0.5 || s.luogo !== l.id) {
      s.pos = { z, theta: th, h: this.quota(z, th) + sopra };
      s.percorso = [];
    }
    s.posa = posa;
    if (guardaVerso) s.yaw = yawVerso({ z, theta: th }, guardaVerso);
    s.luogo = l.id;
    this.posaFigura(s);
    this.mostra(s, true);
    return l.id;
  }

  private collocaVelato(s: StatoNpc, voce: PosizionePersonaggio | null, i: number): string {
    if (!voce) {
      this.mostra(s, false);
      return 'nessuna posizione';
    }
    let p: PuntoCil;
    let posa: PosaNpc = 'in-piedi';
    let verso: PuntoCil | null = null;
    let sopra = 0;
    const piazza = luogoOpz('piazza_ore')!;
    if (voce.luogo === 'piazza_ore') {
      // all'alba guardano la Linea che si accende (verso Mont, in su)
      const a = (i / 12) * Math.PI * 1.6 - 0.8;
      p = sposta(piazza.z, piazza.theta, -4 + Math.cos(a) * 9, Math.sin(a) * 11, 38.5);
      verso = { z: 800, theta: piazza.theta };
    } else if (voce.luogo === 'telo_ombrista') {
      // seduti sui gradini dell'Ombrista
      const g = { z: 1038.5, theta: 34.9 };
      const tl = luogoOpz('telo_ombrista')!;
      const yawG = yawVerso(g, tl);
      const fila = i % 3;
      const k = Math.floor(i / 3) - 1.5;
      const q = spostaYaw(g.z, g.theta, yawG + 90, k * 2.2, 39);
      p = spostaYaw(q.z, q.theta, yawG + 180, -0.4 + fila * 0.9, 39);
      verso = tl;
      posa = 'seduto';
      sopra = -0.42;
    } else {
      p = GIRO_VELATI[i % GIRO_VELATI.length]!;
      verso = (i % 3 === 0 ? piazza : { z: p.z + 10, theta: p.theta + (i % 2 ? 2 : -2) });
    }
    s.pos = { z: p.z, theta: p.theta, h: this.quota(p.z, p.theta) + sopra };
    if (verso) s.yaw = yawVerso(p, verso);
    s.posa = posa;
    s.luogo = voce.luogo.startsWith('corbella') ? 'corbella' : voce.luogo;
    this.posaFigura(s);
    this.mostra(s, true);
    return s.luogo;
  }

  /** Quota d'appoggio: suolo o collider calpestabile (gradini, ripiani, panche) sotto il punto. */
  private quota(z: number, theta: number): number {
    let h = suolo(z, theta);
    const p = mondo(z, theta, h);
    const up = new THREE.Vector3(-p.x, -p.y, 0).normalize();
    for (const zona of this.ctx.zone.values()) {
      for (const v of zona.collider) {
        const c = v.collider;
        if (c.kind !== 'box' || !['gradino', 'calpestabile'].includes(v.tag)) continue;
        const d = new THREE.Vector3().subVectors(p, c.center);
        if (Math.abs(d.dot(c.right)) > c.half.x || Math.abs(d.dot(c.forward)) > c.half.z) continue;
        const top = c.center.clone().addScaledVector(c.up, c.half.y);
        const ht = h + new THREE.Vector3().subVectors(top, p).dot(up);
        if (ht > h && ht < h + 4) h = ht;
      }
    }
    return h;
  }

  // ------------------------------------------------------------- per fotogramma

  update(dt: number, sky?: { night: number; sunIntensity: number; sunColor: number[]; ambientTop: number[]; ambientBottom?: number[]; tiltAlpha: number; tiltBeta: number }): void {
    this.t += dt;
    if (this.conLuci) this.luci(sky);
    for (const s of this.stati.values()) {
      if (!s.figura || !s.obj || !s.presente) continue;
      if (s.gestoFino > 0 && this.t > s.gestoFino) {
        s.stato.gesto = 'nessuno';
        s.gestoFino = 0;
      }
      this.passo(s, dt);
      s.obj.update?.(dt, s.stato);
      this.posaOssa(s);
    }
  }

  private passo(s: StatoNpc, dt: number): void {
    if (!s.pos || !s.percorso.length) {
      s.stato.modo = 'fermo';
      return;
    }
    const meta = s.percorso[0]!;
    const d = distanza(s.pos, meta, s.pos.h);
    const step = s.velocita * dt;
    if (d <= Math.max(step, 0.05)) {
      s.pos = { z: meta.z, theta: meta.theta, h: this.quota(meta.z, meta.theta) };
      s.percorso.shift();
      if (!s.percorso.length) {
        s.stato.modo = 'fermo';
        s.risolvi?.();
        s.risolvi = null;
      }
    } else {
      const y = yawVerso(s.pos, meta, s.pos.h);
      // gira dolcemente verso la meta
      let dy = ((y - s.yaw + 540) % 360) - 180;
      dy = Math.max(-240 * dt, Math.min(240 * dt, dy));
      s.yaw += dy;
      const q = spostaYaw(s.pos.z, s.pos.theta, y, step, s.pos.h);
      s.pos = { z: q.z, theta: q.theta, h: this.quota(q.z, q.theta) };
      s.stato.modo = 'cammina';
      s.stato.velocita = s.velocita;
    }
    this.posaFigura(s);
    // il collider segue a passi di mezzo metro
    if (s.collider && s.pos) {
      const c = s.collider as { base: THREE.Vector3 };
      if (c.base.distanceTo(mondo(s.pos.z, s.pos.theta, s.pos.h)) > 0.6) this.aggiornaCollider(s);
    }
  }

  /** Pose che la libreria non ha: seduto, chino (offset alle ossa dopo l'animazione). */
  private ossaCache = new Map<string, Record<string, THREE.Bone>>();

  private posaOssa(s: StatoNpc): void {
    if (s.posa === 'in-piedi' || !s.obj) return;
    let ossa = this.ossaCache.get(s.id);
    if (!ossa) {
      const o2: Record<string, THREE.Bone> = {};
      s.obj.gruppo.traverse((o) => {
        if ((o as THREE.Bone).isBone) o2[o.name] = o as THREE.Bone;
      });
      ossa = o2;
      this.ossaCache.set(s.id, ossa);
    }
    if (s.posa === 'seduto') {
      const H = s.altezzaFianchi;
      ossa['radice']!.position.y = -(H - 0.5);
      ossa['radice']!.position.z = -0.12;
      for (const k of ['cosciaS', 'cosciaD']) ossa[k]!.rotation.x = -1.45;
      for (const k of ['stincoS', 'stincoD']) ossa[k]!.rotation.x = 1.4;
      ossa['schiena']!.rotation.x += 0.08;
    } else if (s.posa === 'chino') {
      ossa['schiena']!.rotation.x += 0.45;
      ossa['petto']!.rotation.x += 0.25;
      ossa['testa']!.rotation.x += 0.25;
      for (const k of ['braccioS', 'braccioD']) ossa[k]!.rotation.x += -0.9;
      for (const k of ['avambraccioS', 'avambraccioD']) ossa[k]!.rotation.x += -0.4;
      ossa['cosciaS']!.rotation.x += -0.15;
      ossa['cosciaD']!.rotation.x += -0.15;
    }
  }

  /** Luci del materiale toon degli abitanti, dal cielo del motore. */
  private luci(sky?: { night: number; sunIntensity: number; sunColor: number[]; ambientTop: number[]; ambientBottom?: number[]; tiltAlpha: number; tiltBeta: number }): void {
    const theta = 38;
    const f = localFrameTheta(theta);
    const centro = mondo(1080, theta, 40);
    const a = sky?.tiltAlpha ?? 40 * DEG;
    const b = sky?.tiltBeta ?? 0;
    const L = f.up.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.east, Math.sin(a) * Math.cos(b)).addScaledVector(f.north, Math.sin(a) * Math.sin(b));
    this.sole.position.copy(centro).addScaledVector(L, 80);
    this.sole.target.position.copy(centro);
    this.sole.target.updateMatrixWorld();
    const notte = sky?.night ?? 0;
    const sole = sky?.sunIntensity ?? 1;
    const sc = sky?.sunColor ?? [1, 0.95, 0.85];
    this.sole.color.setRGB(sc[0]!, sc[1]!, sc[2]!);
    this.sole.intensity = Math.PI * 0.6 * sole;
    const at = sky?.ambientTop ?? [0.75, 0.8, 0.9];
    const ab = sky?.ambientBottom ?? [0.5, 0.45, 0.35];
    this.emisfero.color.setRGB(at[0]!, at[1]!, at[2]!);
    this.emisfero.groundColor.setRGB(ab[0]!, ab[1]!, ab[2]!);
    this.emisfero.intensity = Math.PI * (0.95 + 0.15 * notte);
    this.emisfero.position.copy(f.up);
  }

  dispose(): void {
    for (const s of this.stati.values()) {
      if (this.colliders && s.collider) this.colliders.remove(s.collider.id);
      s.obj?.dispose();
    }
    this.gruppo.parent?.remove(this.gruppo);
  }
}

/** Piazzamenti fini per personaggio@luogo: spostamento (m) dal punto del luogo, posa, verso chi guarda. */
const PIAZZAMENTI: Record<string, { nord?: number; est?: number; posa?: PosaNpc; verso?: string; sopra?: number }> = {
  'pina@soglia_pina': { est: 0.6, posa: 'seduto', verso: 'piazza_ore', sopra: -0.26 },
  'pina@telo_ombrista': { nord: 1.6, est: 0.3, verso: 'piazza_ore' },
  'togna@lavatoio': { nord: 2.1, est: 0.5, posa: 'chino', verso: 'campanile' },
  'togna@piazza_ore': { nord: 6, est: -12, verso: 'telo_ombrista' },
  'bortolo@sagrato': { nord: 2, est: -4, verso: 'piazza_ore' },
  'bortolo@campanile': { nord: -3.6, est: 0, verso: 'piazza_ore' },
  'bortolo@piazza_ore': { nord: 7, est: -14, verso: 'telo_ombrista' },
  'bortolo@scorciatoia_terrazze': { nord: 0, est: 0, verso: 'piazza_ore' },
  'annunciata@san_vigilio': { nord: -2.0, est: 9.3, posa: 'seduto', verso: 'sagrato' },
  'nando@casa_nando': { nord: -1, est: -5.5, verso: 'i_ronchi' },
  'nando@muro_ronco': { nord: 0, est: 1.6, posa: 'chino', verso: 'muro_ronco' },
  'clelia@bacheca_ore': { nord: 0.8, est: 1.8, verso: 'piazza_ore' },
  'clelia@casa_del_velo': { nord: -3.6, est: 3.6, verso: 'piazza_ore' },
  'lisa@piazza_ore': { nord: -6, est: 4, verso: 'campanile' },
  'gioanin@piazza_ore': { nord: -6.8, est: 4.9, verso: 'campanile' },
  'lisa@telo_ombrista': { nord: -5, est: -2.5, posa: 'seduto', verso: 'telo_ombrista', sopra: -0.3 },
  'gioanin@telo_ombrista': { nord: -5, est: -1.6, posa: 'seduto', verso: 'telo_ombrista', sopra: -0.3 },
  'ottavio@piazza_ore': { nord: 3, est: 6, verso: 'campanile' },
  'ottavio@fienile_ottavio': { nord: -1.5, est: -4.8, verso: 'passerella_messo' },
  'ottavio@prato_ronco': { nord: 0, est: 0, verso: 'passerella_messo' },
  'ottavio@bacheca_ore': { nord: 0.5, est: 1.6, verso: 'bacheca_ore' },
  'ottavio@passerella_messo': { nord: 0.3, est: 0, posa: 'seduto', verso: 'fienile_ottavio', sopra: -0.42 },
  'ottavio@balcone_messi': { nord: 1, est: -2, verso: 'piazza_ore' },
};

/** La posizione dei contenuti valida al giorno e all'ora (l'ultima iniziata). */
export function scegliPosizione(p: Personaggio, giorno: number, ora: number): PosizionePersonaggio | null {
  let migliore: PosizionePersonaggio | null = null;
  let iniziataDa = Infinity;
  for (let i = 0; i < p.posizioni.length; i++) {
    const v = p.posizioni[i]!;
    if (!faseValida(v.fase, giorno, ora)) continue;
    const d = oraOVicina(p.posizioni, i, 'dalle');
    const a = oraOVicina(p.posizioni, i, 'alle');
    if (Number.isNaN(d) && Number.isNaN(a)) {
      if (!migliore) migliore = v;
      continue;
    }
    const dentro = Number.isNaN(a) ? ora >= d : Number.isNaN(d) ? ora < a : d <= a ? ora >= d && ora < a : ora >= d || ora < a;
    if (!dentro) continue;
    const da = Number.isNaN(d) ? 24 : (ora - d + 24) % 24;
    if (da < iniziataDa) {
      iniziataDa = da;
      migliore = v;
    }
  }
  return migliore;
}

function faseValida(fase: string, giorno: number, ora: number): boolean {
  const f = fase.toLowerCase();
  if (f === 'ogni giorno' || f === 'sempre' || f === 'fase 1' || f === 'notte' || f === 'ogni notte') return true;
  if (f === 'prologo') return giorno === 1 && ora < 5.65;
  if (f === 'libera') return false;
  let m = /^giorno (\d+)$/.exec(f);
  if (m) {
    // un giorno di gioco va dalle 05:30 alle 05:30
    const g = ora < 5.5 ? giorno - 1 : giorno;
    return g === Number(m[1]);
  }
  m = /^dal giorno (\d+)$/.exec(f);
  if (m) return giorno >= Number(m[1]);
  return false;
}

/** Orario di inizio/fine: "HH:MM" o, per i passi di missione, un orario tipico. */
function oraOVicina(lista: PosizionePersonaggio[], i: number, campo: 'dalle' | 'alle'): number {
  const v = lista[i]![campo];
  const h = ore(v);
  if (!Number.isNaN(h)) return h;
  if (!v) return Number.NaN;
  if (/m1_ottavio/.test(v)) return 12.5; // l'incontro in piazza (M1.7, ore tipiche 09-13)
  if (/fine della missione 1/.test(v)) return 9.0;
  return Number.NaN;
}
