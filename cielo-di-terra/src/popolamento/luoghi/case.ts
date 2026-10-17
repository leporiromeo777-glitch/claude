/**
 * Le case di Corbella: i rustici in gneiss con il tetto di piode sulle particelle abitate del
 * nucleo (fade_fase1.json → particelle di tipo «abitato»), più le case con un nome nei contenuti:
 * la casa bassa di Pina sulla piazza (la soglia è il luogo `soglia_pina`) e la Casa del Velo
 * della Confraternita (finestre con le grate, un velo nero sulla porta).
 *
 * Le case stanno sui gradoni: la porta (davanti, +Z della libreria) sta sul suolo davanti, con una
 * scaletta se il suolo poi scende, e i muri si interrano nell'alzata, come i rustici costruiti nel
 * pendio. Davanti guardano la piazza (se vicine) o la valle; qualcuna, dove davanti alla porta non
 * c'è posto per la scaletta, guarda a monte (migliorie «porte», `scegliPorteEScale`).
 */
import { BoxGeometry, PlaneGeometry, Vector3 } from 'three';
import { Costruttore, mat } from '../../oggetti/costruttore';
import { matriceSuperficie } from '../../oggetti/cilindro';
import { creaRustico, piantaRustico, type OpzioniRustico } from '../../oggetti/oggetti/rustico';
import { creaLanterna } from '../../oggetti/oggetti/lumi';
import { creaAnnesso, type TipoAnnesso } from '../../oggetti/oggetti/annesso';
import { creaAlberoFrutto, creaOrto } from '../../oggetti/oggetti/orto';
import { PARTICELLE, luogo } from '../contenuti';
import { distanzaSegmento, type Contesto } from '../contesto';
import type { PuntoCil } from '../terreno';
import { alberoLontano, annessoLontano, casaLontana, coronaSulSuolo, hash2, rumore2 } from '../forme';
import { hex, mix, type RGB } from '../cantiere';
import { SUPERFICIE } from '../../render/superfici';
import { terrainColor } from '../../render/palette';
import { createMasks, slopeAt, surfaceHeight } from '../../world/terrain';
import { differenza, distanza, impronta, sposta, spostaYaw, suolo, yawValle, yawVerso } from '../terreno';
import { ColliderWorld, boxAt, type Collider } from '../../world/colliders';
import { cylToWorld, worldToCyl } from '../../world/cylinder';
import { groundHeight } from '../../world/terrain';
import { baseDaPorta, gradiniPorta, interrataPer, progettaGradini, zoneGradini, type ProgettoGradini } from '../soglie';
import { dentroRettangolo, puntiRettangolo, rettangoliSiToccano, rettangoloLocale, type Rettangolo } from '../rettangoli';
import { colliderNelPunto, improntaAperta } from '../verificaPorte';
import type { Impronta } from '../contesto';

/** Punto mondo sul suolo a (z, θ). */
function sulSuolo(z: number, theta: number): Vector3 {
  return cylToWorld(z, theta, suolo(z, theta));
}

const CELLE_ABITATE = new Set(PARTICELLE.filter((p) => p.tipo === 'abitato' || p.tipo === 'piazza').map((p) => p.id));
/** I Ronchi hanno le loro casupole (ronchi.ts) */
const CELLE_ESCLUSE = new Set([2796, 2699, 2795, 2700, 2599, 2503]);

function cella(z: number, theta: number): number {
  return Math.floor(z / 40) * 96 + Math.floor(theta / 3.75);
}

export interface CasaPosata {
  nome: string;
  z: number;
  theta: number;
  yaw: number;
  base: number;
  larghezza: number;
  profondita: number;
  porta: Vector3;
  /** punti del rustico da lasciare liberi (rifinitura 2: gli annessi non li coprono) */
  scala?: Vector3;
  balcone?: Vector3;
  /** migliorie «porte»: lo spazio da lasciare libero davanti alla porta (e ai suoi gradini) */
  davanti?: Rettangolo;
}

/** Porta d'ingresso di un rustico in coordinate locali (sul fronte, a x = u). */
function portaFronte(u: number, D: number): { centro: Vector3; normale: Vector3; larghezza: number } {
  return { centro: new Vector3(u, 0, D / 2), normale: new Vector3(0, 0, 1), larghezza: 1.0 };
}

/** Spazio oltre la fine della scaletta (o la soglia) da tenere libero davanti alla porta d'ingresso (m). */
const OLTRE_PORTA = 1.3;

/** Ingombro della scala esterna sul fianco `lato` (+1 a +X) e dello spazio davanti al primo gradino. */
function zonaScala(z: number, theta: number, h: number, yaw: number, W: number, lato: 1 | -1, zPiede: number, zCima: number): Rettangolo {
  const x0 = lato > 0 ? W / 2 : -W / 2 - 1.25;
  return rettangoloLocale(z, theta, h, yaw, x0, x0 + 1.25, zPiede - 1.3, zCima + 0.05);
}

/**
 * Posa un rustico della libreria e registra impronta, punti e collider di porta.
 *
 * Migliorie «porte»: la base non è più il suolo più basso dell'impronta meno 12 cm, ma la quota
 * che mette la soglia 3 cm sopra il suolo più alto davanti alla porta (`baseDaPorta`): le case con
 * il davanti a monte (la corona della piazza, la Casa del Velo) avevano la porta sepolta fino a tre
 * metri. I muri scendono fin sotto il suolo più basso dell'impronta; se davanti il suolo scende, la
 * scaletta di gneiss (`gradiniPorta`). Lo spazio davanti alla porta e alla scala esterna diventa
 * un'impronta (`porta:nome`, `scala:nome`): annessi, orti, alberi e muri delle terrazze lo lasciano
 * libero.
 */
export function posaRustico(
  ctx: Contesto,
  zona: string,
  nome: string,
  z: number,
  theta: number,
  yaw: number,
  opz: OpzioniRustico & { base?: number; luogo?: string; occupa?: boolean; progetto?: ProgettoGradini },
): CasaPosata {
  const W = opz?.larghezza ?? 6;
  const D = opz?.profondita ?? 7;
  const fp = impronta(z, theta, yaw, W, D);
  const pianta = piantaRustico({ ...opz, larghezza: W, profondita: D });
  const porta = portaFronte(pianta.portaU, D);
  const base = opz?.base ?? baseDaPorta(z, theta, yaw, porta);
  const interrata = interrataPer(base, fp.min, fp.max, 0.72);
  const casa = creaRustico({ ...opz, interrata });
  const punti = ctx.posa(zona, casa, z, theta, yaw, { h: base, nome, tag: (t) => (t === 'muro' ? 'casa' : t ?? 'casa'), ...(opz?.luogo ? { luogo: opz.luogo } : {}) });
  if (zona.startsWith('case:')) {
    const piani = opz?.piani ?? 2;
    const k = Math.min(1.2, Math.max(0.85, opz?.altezzaPiani ?? 1));
    casaLontana(ctx.zona(zona).lontano, matriceSuperficie(z, theta, base, yaw), W, D, (2.5 + (piani - 1) * 2.45) * k + 0.35, interrata, Math.floor(z * 7 + theta), nome, pianta.portaU);
  }
  // porta: collider sottile davanti all'uscio (tag 'porta') per chi interroga i collider
  const pl = casa.punti['porta']!;
  const pd = spostaYaw(z, theta, yaw, D / 2 + 0.05, base);
  const pdd = spostaYaw(pd.z, pd.theta, yaw - 90, pl.x, base);
  ctx.zona(zona).aggiungiCollider(boxAt(pdd.z, pdd.theta, base, yaw, 1.1, 2.0, 0.12), 'porta', opz?.luogo ?? nome);
  // i gradini, se davanti alla soglia il suolo scende (il progetto scelto da `scegliPorteEScale`)
  const gr = gradiniPorta(ctx.zona(zona), z, theta, base, yaw, porta, { ...(opz?.luogo ? { luogo: opz.luogo } : {}), seme: Math.floor(z * 13 + theta * 7), proprietario: nome, ...(opz?.progetto ? { progetto: opz.progetto } : {}) });
  const zone = zoneGradini(z, theta, base, yaw, porta, gr.progetto, OLTRE_PORTA);
  for (const r of zone) ctx.occupa({ nome: `porta:${nome}`, ...r });
  const davanti = zone[0]!;
  if (pianta.scala) ctx.occupa({ nome: `scala:${nome}`, ...zonaScala(z, theta, base, yaw, W, pianta.scala.lato, pianta.scala.zPiede, pianta.scala.zCima) });
  if (opz?.occupa ?? true) ctx.occupa({ nome, z, theta, yaw, larghezza: W + 0.3, profondita: D + 0.8 });
  casa.dispose();
  return {
    nome,
    z,
    theta,
    yaw,
    base,
    larghezza: W,
    profondita: D,
    porta: punti['porta']!,
    ...(punti['scala'] ? { scala: punti['scala'] } : {}),
    ...(punti['balcone'] ? { balcone: punti['balcone'] } : {}),
    davanti,
  };
}

/** (z, θ) dentro un'impronta (rettangolo o cerchio)? */
function inImpronta(i: Impronta, p: { z: number; theta: number }, margine = 0): boolean {
  if (i.raggio !== undefined) return distanza(i, p) < i.raggio + margine;
  return dentroRettangolo({ z: i.z, theta: i.theta, yaw: i.yaw ?? 0, larghezza: i.larghezza ?? 0, profondita: i.profondita ?? 0 }, p, margine);
}

/** I collider già posati nelle zone (luoghi, case…), in un indice per le interrogazioni. */
function colliderPosati(ctx: Contesto): ColliderWorld {
  const w = new ColliderWorld();
  for (const z of ctx.zone.values()) for (const v of z.collider) w.add({ ...v.collider, tag: v.tag } as Collider);
  for (const v of ctx.colliderDinamici) w.add({ ...v.collider, tag: v.tag } as Collider);
  return w;
}

/**
 * Un corpo in piedi (fra 0,35 e 1,8 m dal suolo) nel punto urterebbe un collider? (Anche le cose
 * basse: una panca della piazza a 80 cm dal muro stava proprio davanti a una porta.)
 */
function ingombratoDaCollider(col: ColliderWorld, p: { z: number; theta: number }): boolean {
  const g = groundHeight(p.z, p.theta);
  for (const hh of [0.35, 0.6, 1.2, 1.8]) {
    const P = cylToWorld(p.z, p.theta, g + hh);
    if (colliderNelPunto(col, P, g + hh, g, 0.5)) return true;
  }
  return false;
}

interface PianoCasa {
  p: Proposta;
  zona: string;
  nome: string;
  opz: OpzioniRustico & { progetto?: ProgettoGradini; base?: number };
  /** la casa non si costruisce (nessun posto per la porta) */
  tolta?: boolean;
}

/** Esito di `scegliPorteEScale`. */
export interface EsitoPorteEScale {
  porteGirate: number;
  scaleGirate: number;
  scaleTolte: number;
  /** case spostate (indietro o di lato) perché la porta e la sua scaletta avessero posto */
  caseSpostate: number;
  /** case girate con la porta verso monte (spostate o no) perché la porta avesse posto */
  caseGirate: number;
  /** case tolte: la porta non trova posto buono nemmeno spostandole o girandole */
  caseTolte: string[];
}

/**
 * Migliorie «porte»: prima di posare le case pianificate, sceglie da che parte del fronte mettere la
 * porta e su che fianco la scala esterna (o niente scala) perché davanti non ci siano il muro di
 * un'altra casa, un collider o un luogo, e la soglia stia il più possibile alla quota del suolo.
 *
 * Correzione dopo la verifica: prima si guardava solo il metro e trenta davanti alla porta, ma la
 * scaletta di gneiss (fino a 13 gradini, 4,3 m) finiva dentro la casa di fronte o sotto la sua gronda
 * (rustico_15, 21, 22, 29, 30, 86). Ora per ogni lato si progetta la scaletta (`progettaGradini`) e si
 * controlla tutto lo spazio che occupa, fino a 1,3 m dopo l'ultimo gradino, contro i muri delle altre
 * case (con la gronda), le loro scale e scalette, i luoghi e i collider. Se nessun lato va bene la
 * casa si sposta un poco indietro o di lato (al più 3 m, dove c'è posto) finché la porta lo trova.
 */
function scegliPorteEScale(ctx: Contesto, piani: PianoCasa[]): EsitoPorteEScale {
  const col = colliderPosati(ctx);
  const nomi = new Set(piani.map((q) => q.nome));
  const muro = (q: PianoCasa): Rettangolo => ({ z: q.p.z, theta: q.p.theta, yaw: q.p.yaw, larghezza: q.p.W, profondita: q.p.D });
  /** i muri della casa e la sua lobbia (sul fronte o sul fianco destro, al primo piano): niente scale lì davanti */
  const ingombri = (q: PianoCasa): Rettangolo[] => {
    const b = piantaRustico({ ...q.opz }).balcone;
    const g0 = groundHeight(q.p.z, q.p.theta);
    const W = q.p.W;
    const D = q.p.D;
    if (b === 'lato') return [muro(q), rettangoloLocale(q.p.z, q.p.theta, g0, q.p.yaw, W / 2, W / 2 + 1.0, -D / 2 + 0.4, D / 2 - 0.4)];
    if (b === 'fronte') return [muro(q), rettangoloLocale(q.p.z, q.p.theta, g0, q.p.yaw, -W / 2, W / 2, D / 2, D / 2 + 1.05)];
    return [muro(q)];
  };
  const altre = ctx.impronte.filter((i) => !nomi.has(i.nome) && !improntaAperta(i.nome));
  /** il rettangolo `r` non tocca i muri delle altre case (con `gronda` di margine), `extra`, impronte e collider */
  const libero = (r: Rettangolo, tranne: string, extra: Rettangolo[] = [], gronda = 0.05): boolean => {
    for (const q of piani) if (!q.tolta && q.nome !== tranne && ingombri(q).some((x) => rettangoliSiToccano(x, r, gronda))) return false;
    for (const e of extra) if (rettangoliSiToccano(e, r, 0)) return false;
    for (const pt of puntiRettangolo(r)) {
      for (const i of altre) if (inImpronta(i, pt)) return false;
      if (ingombratoDaCollider(col, pt)) return false;
    }
    return true;
  };
  const esito: EsitoPorteEScale = { porteGirate: 0, scaleGirate: 0, scaleTolte: 0, caseSpostate: 0, caseGirate: 0, caseTolte: [] };
  /** la scala esterna di `q` messa in `p` (lato preferito, poi l'altro): il suo rettangolo, o null */
  const provaScala = (q: PianoCasa, p: Proposta, preferito: 1 | -1, tranne: Rettangolo[] = []): { lato: 1 | -1; r: Rettangolo } | null => {
    const pianta = piantaRustico({ ...q.opz, senzaScala: false });
    if (!pianta.scala) return null;
    const g0 = groundHeight(p.z, p.theta);
    for (const lato of [preferito, preferito === 1 ? -1 : 1] as Array<1 | -1>) {
      const r = zonaScala(p.z, p.theta, g0, p.yaw, p.W, lato, pianta.scala.zPiede, pianta.scala.zCima);
      if (libero(r, q.nome, tranne)) return { lato, r };
    }
    return null;
  };
  // 1. le scale esterne (contro i muri delle altre case, i luoghi, i collider)
  const scale = new Map<string, Rettangolo>();
  for (const q of piani) {
    const pianta = piantaRustico({ ...q.opz });
    if (!pianta.scala) continue;
    const scelta = provaScala(q, q.p, pianta.scala.lato);
    if (!scelta) {
      q.opz.senzaScala = true;
      esito.scaleTolte++;
      continue;
    }
    if (scelta.lato !== pianta.scala.lato) {
      q.opz.latoScala = scelta.lato;
      esito.scaleGirate++;
    }
    scale.set(q.nome, scelta.r);
  }
  // 2. le porte d'ingresso e le loro scalette (anche contro le scale e le scalette delle altre case)
  const zonePorte = new Map<string, Rettangolo[]>();
  interface Opzione {
    u: number;
    ok: boolean;
    progetto: ProgettoGradini;
    base: number;
    zone: Rettangolo[];
    costo: number;
  }
  const valuta = (q: PianoCasa, p: Proposta, u: number, extra: Rettangolo[]): Opzione => {
    const porta = portaFronte(u, p.D);
    const base = baseDaPorta(p.z, p.theta, p.yaw, porta);
    const progetto = progettaGradini(p.z, p.theta, base, p.yaw, porta);
    const zone = zoneGradini(p.z, p.theta, base, p.yaw, porta, progetto, OLTRE_PORTA);
    // (la gronda delle altre case sporge mezzo metro: la scaletta non ci passa sotto)
    const ok = progetto.buona && zone.every((r, i) => libero(r, q.nome, extra, i === 0 && !progetto.quanti ? 0.05 : 0.5));
    // a parità, la soglia più bassa (meno gradini) e il lato della pianta
    return { u, ok, progetto, base, zone, costo: progetto.costo + (ok ? 0 : 100) };
  };
  const altreZone = (nome: string): Rettangolo[] => [
    ...[...scale].filter(([n]) => n !== nome).map(([, r]) => r),
    ...[...zonePorte].filter(([n]) => n !== nome).flatMap(([, r]) => r),
  ];
  for (const q of piani) {
    const pianta = piantaRustico({ ...q.opz });
    const extra = altreZone(q.nome);
    const candidati = pianta.portaU === 0 ? [0] : [pianta.portaU, -pianta.portaU];
    const valutati = candidati.map((u) => valuta(q, q.p, u, extra));
    let scelta = valutati.reduce((a, b) => (b.costo < a.costo - 0.25 ? b : a));
    if (!scelta.ok) {
      // la casa si sposta (indietro, via dalla porta, o di lato, al più 3 m, dove c'è posto); se non
      // basta si gira con la porta verso monte (come le case della corona della piazza)
      const provaQui = (p: Proposta) => {
        // (non sulla scaletta o sulla scala esterna di un'altra casa)
        const muriQui: Rettangolo = { z: p.z, theta: p.theta, yaw: p.yaw, larghezza: p.W + 0.2, profondita: p.D + 0.2 };
        if (extra.some((e) => rettangoliSiToccano(e, muriQui, 0))) return null;
        const v = candidati.map((u) => valuta(q, p, u, extra)).filter((o) => o.ok);
        if (!v.length) return null;
        // la scala esterna, se c'è, deve trovare posto anche lì
        if (scale.has(q.nome) && !provaScala(q, p, q.opz.latoScala ?? pianta.scala?.lato ?? 1, [...extra, ...v[0]!.zone])) return null;
        return v.reduce((a, b) => (b.costo < a.costo - 0.25 ? b : a));
      };
      const spostata = spostaCasa(ctx, q, piani, provaQui) ?? spostaCasa(ctx, q, piani, provaQui, 180);
      if (spostata) {
        if (spostata.p.yaw !== q.p.yaw) esito.caseGirate++;
        else esito.caseSpostate++;
        q.p = spostata.p;
        scelta = spostata.esito;
        if (scale.has(q.nome)) {
          const sc = provaScala(q, q.p, q.opz.latoScala ?? pianta.scala?.lato ?? 1, [...extra, ...scelta.zone])!;
          q.opz.latoScala = sc.lato;
          scale.set(q.nome, sc.r);
        }
      } else {
        // nessun posto: la casa non si costruisce (meglio un vuoto fra le case che una porta incastrata)
        esito.caseTolte.push(q.nome);
        q.tolta = true;
        scale.delete(q.nome);
        const k = ctx.impronte.findIndex((x) => x.nome === q.nome);
        if (k >= 0) ctx.impronte.splice(k, 1);
        continue;
      }
    }
    if (scelta.u !== pianta.portaU) {
      q.opz.latoPorta = scelta.u > 0 ? 1 : -1;
      esito.porteGirate++;
    }
    q.opz.progetto = scelta.progetto;
    q.opz.base = scelta.base;
    // (le zone delle porte senza gradini non contano per le altre: due porte possono guardarsi a 3 m)
    if (scelta.progetto.quanti) zonePorte.set(q.nome, scelta.zone);
  }
  // 3. una scala esterna che finisce davanti alla porta (o sulla scaletta) di un'altra casa: dall'altra parte o niente
  for (const q of piani) {
    if (q.tolta) continue;
    const r = scale.get(q.nome);
    const davantiAltre = (x: Rettangolo) => [...zonePorte].some(([n, zs]) => n !== q.nome && zs.some((d) => rettangoliSiToccano(d, x, 0)));
    if (!r || !davantiAltre(r)) continue;
    const pianta = piantaRustico({ ...q.opz });
    const lato: 1 | -1 = pianta.scala!.lato === 1 ? -1 : 1;
    const r2 = zonaScala(q.p.z, q.p.theta, groundHeight(q.p.z, q.p.theta), q.p.yaw, q.p.W, lato, pianta.scala!.zPiede, pianta.scala!.zCima);
    if (libero(r2, q.nome) && !davantiAltre(r2)) {
      q.opz.latoScala = lato;
      esito.scaleGirate++;
    } else {
      q.opz.senzaScala = true;
      delete q.opz.latoScala;
      esito.scaleTolte++;
    }
  }
  return esito;
}

/**
 * Cerca un posto vicino per la casa `q` (indietro, via dalla porta, fino a 3 m, e di lato fino a
 * 1,5 m) dove la sua impronta non tocca le altre case né i luoghi, i sentieri e le visuali, e `prova`
 * trova una porta buona. Aggiorna l'impronta della casa nel contesto.
 */
function spostaCasa<T>(ctx: Contesto, q: PianoCasa, piani: PianoCasa[], prova: (p: Proposta) => T | null, giro = 0): { p: Proposta; esito: T } | null {
  const tentativi: Array<[number, number]> = [];
  for (const indietro of [0, 0.5, 1, 1.5, 2, 2.5, 3]) for (const lato of [0, 0.75, -0.75, 1.5, -1.5]) if (indietro || lato || giro) tentativi.push([indietro, lato]);
  tentativi.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  const i = ctx.impronte.findIndex((x) => x.nome === q.nome);
  for (const [indietro, lato] of tentativi) {
    const yaw = q.p.yaw + giro;
    const c0 = spostaYaw(q.p.z, q.p.theta, yaw + 180, indietro, 40);
    const c = spostaYaw(c0.z, c0.theta, yaw + 90, lato, 40);
    const p: Proposta = { ...q.p, z: c.z, theta: c.theta, yaw };
    // la stessa cella abitata, lontano dalle altre case (come quando si pianificano), dai luoghi e dai sentieri
    const cel = cella(p.z, p.theta);
    if (!CELLE_ABITATE.has(cel) || CELLE_ESCLUSE.has(cel)) continue;
    // (come quando si pianificano: i muri della casa a più di 35 cm dalle impronte delle altre)
    const r: Rettangolo = { z: p.z, theta: p.theta, yaw: p.yaw, larghezza: p.W, profondita: p.D };
    if (piani.some((o) => !o.tolta && o.nome !== q.nome && rettangoliSiToccano({ z: o.p.z, theta: o.p.theta, yaw: o.p.yaw, larghezza: o.p.W + 0.3, profondita: o.p.D + 0.8 }, r, 0.35))) continue;
    if (ctx.impronte.some((x, k) => k !== i && !x.nome.startsWith('rustico_') && !x.nome.startsWith('porta:') && !x.nome.startsWith('scala:') && puntiRettangolo(r, 0.6).some((pt) => inImpronta(x, pt)))) continue;
    if (vicinoSentieri(ctx, p, 0.9) || ctx.inVisuale(p.z, p.theta, Math.max(p.W, p.D) / 2)) continue;
    // niente punti d'interazione sotto la casa o a ridosso, e lontano dalla strada del prologo come prima
    if ([...ctx.punti.values()].some((pt) => dentroRettangolo(r, pt.cil, 1.0))) continue;
    if (q.nome !== 'casa_pina' && Number(q.nome.split('_')[1]) >= CASE_DI_PRIMA && LIBERI().some((l) => distanza(p, l) < 32)) continue;
    const fp = impronta(p.z, p.theta, p.yaw, p.W + 0.6, p.D + 0.6);
    if (fp.max - fp.min > 3.9) continue;
    const esito = prova(p);
    if (esito === null) continue;
    if (i >= 0) ctx.impronte[i] = { ...ctx.impronte[i]!, z: p.z, theta: p.theta, yaw: p.yaw };
    return { p, esito };
  }
  return null;
}

/** L'esito dell'ultima scelta di porte e scale (per le prove e lo script di verifica). */
export let ultimoEsitoPorte: EsitoPorteEScale | null = null;

interface Proposta {
  z: number;
  theta: number;
  yaw: number;
  W: number;
  D: number;
}

/**
 * Rustici generici sulle particelle abitate, a schiere come nei paesi ticinesi: si parte dai bordi
 * della piazza e dai vicoli, e ogni casa ne «chiama» altre accanto (lungo la curva di livello,
 * a 0,6-1,6 m) e una fila più su o più giù (oltre un vicolo di 3-4 m). Il davanti (timpano con la
 * porta) guarda la valle; sul bordo della piazza guarda la piazza.
 */
/** I rustici generici fino alla rifinitura 1: gli stessi, negli stessi posti (con lo stesso ordine). */
const CASE_DI_PRIMA = 58;
/** I luoghi del prologo da cui le case aggiunte dalla rifinitura 2 stanno lontane (32 m). */
const LIBERI = () => ['belvedere_muretto', 'botola', 'castagno_morto'].map((id) => luogo(id));

/**
 * Rifinitura 2: 90 rustici invece di 58. Le case nuove vengono dopo nella stessa coda (le prime 58 non
 * cambiano) e riempiono i vuoti dei gruppi attorno al campanile: dal castagno morto e dal Velo il
 * nucleo è un grumo, non case sparse.
 */
export function costruisciCase(ctx: Contesto, quante = 90): CasaPosata[] {
  const liberi = LIBERI();
  const piazza = luogo('piazza_ore');
  const ronchi = luogo('i_ronchi');
  const campanile = luogo('campanile');
  // migliorie «porte»: prima si pianificano tutte le case (stesse regole, stesso ordine, stesse
  // impronte di prima), poi si scelgono porte e scale, poi si posano
  const piani: PianoCasa[] = [];
  const coda: Proposta[] = [];
  let seme = 0;
  const misura = () => {
    const r = hash2(seme * 1.7, seme * 0.37, 9);
    const r2 = hash2(seme * 0.91, seme * 2.3, 11);
    seme++;
    return { W: 5 + r * 2.0, D: 6 + r2 * 2.4, r, r2 };
  };
  // 1. corona della piazza: case con la facciata sulla piazza (lati a Sera, a Mont e a Lag)
  for (let ang = 0; ang < 360; ang += 17) {
    const a = ang + (hash2(ang, 3, 1) - 0.5) * 5;
    const m = misura();
    const r = piazza.raggio + 2.4 + m.D / 2;
    const c = spostaYaw(piazza.z, piazza.theta, a, r, 38.5);
    coda.push({ ...c, yaw: yawVerso(c, piazza), W: m.W, D: m.D });
  }
  // 2. semi lungo i vicoli verso la Cripta e verso i Ronchi, e a Mont della piazza
  for (const [z, th] of [
    [1078, 32.0],
    [1094, 30.4],
    [1086, 35.6],
    [1104, 33.4],
    [1112, 38.0],
    [1132, 36.4],
    [1150, 39.4],
    [1120, 41.2],
    [1094, 40.6],
    [1080, 43.6],
    [1022, 33.0],
    [1012, 40.2],
    [1030, 43.0],
    [1060, 44.5],
    [1140, 33.2],
  ] as const) {
    const m = misura();
    coda.push({ z, theta: th, yaw: yawValle(z, th) + (hash2(z, th, 4) - 0.5) * 14, W: m.W, D: m.D });
  }
  let tentativi = 0;
  while (coda.length && piani.length < quante && tentativi < 900) {
    tentativi++;
    const p = coda.shift()!;
    const c = cella(p.z, p.theta);
    if (!CELLE_ABITATE.has(c) || CELLE_ESCLUSE.has(c)) continue;
    if (distanza(p, ronchi) < 30) continue;
    // le case aggiunte dalla rifinitura 2 (oltre le prime 58, che restano dove sono) stanno lontane
    // dalla strada del prologo (botola, castagno morto) e dal belvedere: non coprono la vista sul
    // paese né il cammino dalla botola al muretto
    if (piani.length >= CASE_DI_PRIMA && liberi.some((l) => distanza(p, l) < 32)) continue;
    if (distanza(p, piazza) < piazza.raggio + 1.8 + p.D / 2 - 0.5) continue;
    const fp = impronta(p.z, p.theta, p.yaw, p.W + 0.6, p.D + 0.6);
    if (fp.max - fp.min > 3.9) continue;
    if (ctx.occupato(p.z, p.theta, 0.3) || occupatoRett(ctx, p, 0.35)) continue;
    if (ctx.inVisuale(p.z, p.theta, Math.max(p.W, p.D) / 2)) continue;
    if (vicinoSentieri(ctx, p, 0.9)) continue;
    const m = { r: hash2(p.z, p.theta, 9), r2: hash2(p.theta, p.z, 11) };
    // rifinitura 2: le case attorno al campanile e alla piazza (entro 70 m) hanno altezze più varie
    // (×0,85-1,5 rispetto ai due piani di base: più case a tre piani, qualcuna bassa, piani più alti o
    // più bassi), così il nucleo sale verso il campanile e lo skyline non è una fila di dadi uguali
    const dCentro = distanza(p, campanile);
    const nucleo = dCentro < 70;
    const nPiani = (nucleo ? (m.r2 < 0.1 ? 1 : m.r < 0.5 - Math.max(0, dCentro - 25) * 0.004 ? 3 : 2) : m.r2 < 0.12 ? 1 : m.r < 0.32 ? 3 : 2) as 1 | 2 | 3;
    const altezzaPiani = nucleo ? 0.9 + hash2(p.z * 1.3, p.theta * 0.7, 21) * 0.24 : 1;
    const i = piani.length;
    const nome = `rustico_${i}`;
    piani.push({
      p,
      zona: `case:${Math.floor(p.z / 70)}:${Math.floor(p.theta / 8)}`,
      nome,
      opz: {
        seme: `corbella-${i}`,
        larghezza: p.W,
        profondita: p.D,
        piani: nPiani,
        altezzaPiani,
        // di notte il paese è acceso (bozzetto 5: decine di finestre); con i bagliori orientati
        // della traccia «paese» ne restava una per lato visto
        finestreAccese: 0.65 + m.r * 0.25,
        gerani: 0.4,
        dettaglio: distanza(p, piazza) < 55 ? 'alto' : 'medio',
      },
    });
    // la stessa impronta che registrava `posaRustico`
    ctx.occupa({ nome, z: p.z, theta: p.theta, yaw: p.yaw, larghezza: p.W + 0.3, profondita: p.D + 0.8 });
    // vicine di schiera (accanto, lungo la curva di livello) e la fila sopra/sotto oltre il vicolo
    const vicini: Array<[number, number]> = [
      [90, 1],
      [-90, 1],
      [0, 0],
      [180, 0],
    ];
    for (const [rot, schiera] of vicini) {
      const n = misura();
      const gap = schiera ? 0.6 + hash2(p.z, rot, 6) * 1.0 : 3.2 + hash2(p.theta, rot, 7) * 1.2;
      const d = schiera ? p.W / 2 + n.W / 2 + gap : p.D / 2 + n.D / 2 + gap;
      const q = spostaYaw(p.z, p.theta, p.yaw + rot, d, 40);
      const yawN = distanza(q, piazza) < piazza.raggio + 9 ? yawVerso(q, piazza) : schiera ? p.yaw + (hash2(q.z, q.theta, 8) - 0.5) * 8 : yawValle(q.z, q.theta) + (hash2(q.z, q.theta, 8) - 0.5) * 10;
      coda.push({ ...q, yaw: yawN, W: n.W, D: n.D });
    }
  }
  ultimoEsitoPorte = scegliPorteEScale(ctx, piani);
  return piani.filter((q) => !q.tolta).map((q) => posaRustico(ctx, q.zona, q.nome, q.p.z, q.p.theta, q.p.yaw, { ...q.opz, occupa: false }));
}

/**
 * Lanterne a braccio sulle porte (rifinitura 1, bozzetto 5: di notte il paese ha decine di lumi):
 * una accanto alla porta di ogni casa della corona della piazza e qualcuna sugli spigoli dei
 * vicoli, `quante` al massimo. Il vetro sta nel canale `lume`: di giorno è spento, di notte si
 * accende con le finestre (dalle 20) e il cantiere ne fa un bagliore del motore.
 */
export function lanterneDellePorte(ctx: Contesto, case_: CasaPosata[], quante = 10): number {
  const piazza = luogo('piazza_ore');
  // prima le case della corona (più vicine alla piazza), poi quelle sui vicoli verso la Cripta
  const candidate = case_
    .filter((c) => c.nome.startsWith('rustico_'))
    .map((c) => ({ c, d: distanza(c, piazza) }))
    .filter((x) => x.d < piazza.raggio + 45)
    .sort((a, b) => a.d - b.d);
  let messe = 0;
  const usate: Array<{ z: number; theta: number }> = [];
  for (const { c } of candidate) {
    if (messe >= quante) break;
    // la porta (punto davanti all'uscio, a 0,6 m) riportata sulla facciata
    const pc = worldToCyl(c.porta);
    const facciata = spostaYaw(pc.z, pc.theta, c.yaw + 180, 0.58, c.base);
    // da che parte del centro della casa sta la porta: la lanterna va verso il centro
    const d = differenza(c, facciata, c.base);
    const lat = d.est * Math.cos(c.yaw * (Math.PI / 180)) - d.nord * Math.sin(c.yaw * (Math.PI / 180));
    const verso = lat > 0.2 ? -1 : 1;
    const q = spostaYaw(facciata.z, facciata.theta, c.yaw + 90 * verso, 0.82, c.base);
    // non due lanterne a meno di 5 m (le case a schiera hanno le porte vicine)
    if (usate.some((u) => distanza(u, q) < 5)) continue;
    usate.push(q);
    const l = creaLanterna({ tipo: 'muro', seme: `lanterna-porta-${messe}`, luce: false, alone: false });
    ctx.posa(`case:${Math.floor(c.z / 70)}:${Math.floor(c.theta / 8)}`, l, q.z, q.theta, c.yaw, { h: c.base + 2.4, collider: false });
    l.dispose();
    messe++;
  }
  return messe;
}

/** Vero se (z, θ) cade in un'impronta (con margine), fuorché quelle di nome in `tranne`. */
function occupatoTranne(ctx: Contesto, z: number, theta: number, margine: number, tranne: ReadonlySet<string>): boolean {
  for (const i of ctx.impronte) {
    if (tranne.has(i.nome)) continue;
    if (i.raggio !== undefined) {
      if (distanza(i, { z, theta }) < i.raggio + margine) return true;
      continue;
    }
    const d = differenza(i, { z, theta }, 40);
    const y = ((i.yaw ?? 0) * Math.PI) / 180;
    const avanti = d.nord * Math.cos(y) + d.est * Math.sin(y);
    const destra = -d.nord * Math.sin(y) + d.est * Math.cos(y);
    if (Math.abs(avanti) <= (i.profondita ?? 0) / 2 + margine && Math.abs(destra) <= (i.larghezza ?? 0) / 2 + margine) return true;
  }
  return false;
}

/** Punti di controllo di un rettangolo (spigoli, metà dei lati, centro). */
function puntiRett(z: number, theta: number, yaw: number, W: number, D: number): Array<{ z: number; theta: number }> {
  const out: Array<{ z: number; theta: number }> = [];
  for (const [a, b] of [
    [-W / 2, -D / 2],
    [W / 2, -D / 2],
    [-W / 2, D / 2],
    [W / 2, D / 2],
    [0, D / 2],
    [0, -D / 2],
    [W / 2, 0],
    [-W / 2, 0],
    [0, 0],
  ] as const) {
    const q = spostaYaw(z, theta, yaw, b, 40);
    out.push(spostaYaw(q.z, q.theta, yaw + 90, a, 40));
  }
  return out;
}

/** Il rettangolo è libero: niente impronte (tranne `tranne`), sentieri, visuali, punti d'interazione. */
function rettLibero(ctx: Contesto, z: number, theta: number, yaw: number, W: number, D: number, tranne: ReadonlySet<string>, o: { margine: number; sentieri: number; punti: number; visuale: number }): boolean {
  if (ctx.inVisuale(z, theta, Math.max(W, D) / 2 + o.visuale)) return false;
  if (ctx.inVisuale(z, theta, Math.max(W, D) / 2 + o.visuale, true)) return false;
  for (const q of puntiRett(z, theta, yaw, W, D)) {
    if (occupatoTranne(ctx, q.z, q.theta, o.margine, tranne)) return false;
    if (ctx.distanzaSentieri(q.z, q.theta) < o.sentieri) return false;
  }
  const centro = sulSuolo(z, theta);
  for (const pt of ctx.punti.values()) if (pt.pos.distanceTo(centro) < Math.max(W, D) / 2 + o.punti) return false;
  // migliorie «porte»: niente davanti alle porte e alle scale esterne (anche delle case in `tranne`)
  const r: Rettangolo = { z, theta, yaw, larghezza: W, profondita: D };
  for (const i of ctx.impronte) {
    if (!(i.nome.startsWith('porta:') || i.nome.startsWith('scala:'))) continue;
    if (rettangoliSiToccano({ z: i.z, theta: i.theta, yaw: i.yaw ?? 0, larghezza: i.larghezza ?? 0, profondita: i.profondita ?? 0 }, r, o.margine)) return false;
  }
  return true;
}

/**
 * Annessi addossati alle case (rifinitura 2, «il paese è Monopoli»): stalle, legnaie e fienili bassi
 * col tetto a una falda, sui fianchi dei rustici (lungo la curva di livello). Due passate:
 * 1. fra due case vicine (centro-centro < 18 m, quasi alla stessa quota, una di fianco all'altra)
 *    con un vuoto di 2,2-12 m fra i muri: l'annesso chiude il vuoto o, se è largo, si appoggia alla
 *    prima delle due;
 * 2. sui fianchi liberi delle altre case del nucleo (entro 90 m dal campanile tutti e due i fianchi,
 *    più in là uno su due).
 * Le cortine diventano continue e il nucleo si legge come un grumo. I rustici non si spostano; gli
 * annessi stanno lontani da sentieri, visuali dei lati, punti d'interazione, scale esterne e lobbie,
 * e hanno i loro collider.
 */
export function costruisciAnnessi(ctx: Contesto, case_: CasaPosata[], quanti = 52): number {
  const piazza = luogo('piazza_ore');
  const campanile = luogo('campanile');
  const generiche = case_.filter((c) => c.nome.startsWith('rustico_'));
  let messi = 0;
  const usate = new Map<string, Set<number>>();
  // migliorie «porte»: lo spazio davanti alla porta di un annesso non tocca i muri delle case, le
  // scale esterne, gli altri annessi, i luoghi né i collider già posati
  const col = colliderPosati(ctx);
  const muriCase = case_.map((c) => ({ z: c.z, theta: c.theta, yaw: c.yaw, larghezza: c.larghezza, profondita: c.profondita }) as Rettangolo);
  const davantiLibero = (r: Rettangolo): boolean => {
    for (const m of muriCase) if (rettangoliSiToccano(m, r, 0.05)) return false;
    for (const i of ctx.impronte) {
      if (i.nome.startsWith('rustico_') || i.nome.startsWith('porta:') || (improntaAperta(i.nome) && !i.nome.startsWith('scala:'))) continue;
      const ri = i.raggio !== undefined ? null : ({ z: i.z, theta: i.theta, yaw: i.yaw ?? 0, larghezza: i.larghezza ?? 0, profondita: i.profondita ?? 0 } as Rettangolo);
      if (ri ? rettangoliSiToccano(ri, r, 0) : puntiRettangolo(r).some((pt) => inImpronta(i, pt))) return false;
    }
    return !puntiRettangolo(r).some((pt) => ingombratoDaCollider(col, pt));
  };
  const lati = (c: CasaPosata) => {
    let s = usate.get(c.nome);
    if (!s) usate.set(c.nome, (s = new Set()));
    return s;
  };
  /**
   * Prova a posare un annesso largo W, centrato a `lungo` m dal centro di `a` lungo `u` (unitario,
   * nord/est), col davanti dalla parte del davanti di `a`; `tranne` = case che può toccare.
   */
  const prova = (a: CasaPosata, u: { n: number; e: number }, lungo: number, W: number, Dcasa: number, tranne: Set<string>, seme: number, vicine: CasaPosata[]): boolean => {
    const fa = { n: Math.cos(a.yaw * (Math.PI / 180)), e: Math.sin(a.yaw * (Math.PI / 180)) };
    let f = { n: -u.e, e: u.n };
    if (f.n * fa.n + f.e * fa.e < 0) f = { n: u.e, e: -u.n };
    const yaw = (Math.atan2(f.e, f.n) * 180) / Math.PI;
    const D = Math.min(5.5, Math.max(3, Dcasa * (0.55 + hash2(seme, 2, 32) * 0.25)));
    // arretrato: il dietro allineato a quello delle case, il davanti rientra
    const arretra = (Dcasa - D) * 0.45;
    const c0 = sposta(a.z, a.theta, u.n * lungo - f.n * arretra, u.e * lungo - f.e * arretra, 40);
    if (!rettLibero(ctx, c0.z, c0.theta, yaw, W, D, tranne, { margine: 0.15, sentieri: 0.9, punti: 2.2, visuale: 0.5 })) return false;
    // niente annessi davanti alle scale esterne e sotto le lobbie laterali
    const centro = sulSuolo(c0.z, c0.theta);
    if (vicine.some((c) => (c.scala && c.scala.distanceTo(centro) < W / 2 + 2.6) || (c.balcone && c.balcone.distanceTo(centro) < W / 2 + 1.6))) return false;
    const fp = impronta(c0.z, c0.theta, yaw, W, D);
    if (fp.max - fp.min > 2.6) return false;
    const tipi: TipoAnnesso[] = ['stalla', 'legnaia', 'fienile'];
    const tipo = tipi[Math.floor(hash2(seme, 5, 33) * 3) % 3]!;
    const zona = `case:${Math.floor(c0.z / 70)}:${Math.floor(c0.theta / 8)}`;
    const nome = `annesso_${messi}`;
    const opzA = { seme: `annesso-${messi}`, tipo, larghezza: W, profondita: D, dettaglio: distanza(c0, piazza) < 60 ? ('alto' as const) : ('basso' as const), finestreAccese: 0.35 };
    let interrata = Math.max(0.8, fp.max - fp.min + 0.6);
    let an = creaAnnesso({ ...opzA, interrata });
    // migliorie «porte»: la porta dell'annesso deve avere davanti 1,3 m liberi (niente muri di case,
    // scale, altri annessi, collider), se no dall'altra parte del davanti, se no niente annesso; la
    // soglia sul suolo più alto davanti (come le case), i muri giù fin sotto il suolo
    let base = fp.min - 0.1;
    let progetto: ProgettoGradini | null = null;
    const p0 = an.porte?.[0];
    if (p0) {
      // correzione dopo la verifica: lo spazio libero comprende la scaletta, se serve, fino a 1 m dopo
      // l'ultimo gradino; una scaletta che non va bene (pedate sepolte, ultimo scalino alto) non si posa
      const candidati = Math.abs(p0.centro.x) > 0.3 ? [p0.centro.x, -p0.centro.x] : [p0.centro.x];
      let scelto: { u: number; base: number; progetto: ProgettoGradini } | null = null;
      for (const u of candidati) {
        const porta = u === p0.centro.x ? p0 : { ...p0, centro: p0.centro.clone().setX(u) };
        const b = baseDaPorta(c0.z, c0.theta, yaw, porta);
        // un annesso che per avere la porta sul suolo dovrebbe stare più di 1,2 m sopra il suo punto più alto: no
        if (b > fp.max + 1.2) continue;
        const pr = progettaGradini(c0.z, c0.theta, b, yaw, porta);
        if (!pr.buona) continue;
        if (zoneGradini(c0.z, c0.theta, b, yaw, porta, pr, 1.0, 1.8).every((r) => davantiLibero(r))) {
          scelto = { u, base: b, progetto: pr };
          break;
        }
      }
      if (scelto === null) {
        an.dispose();
        return false;
      }
      if (scelto.u !== p0.centro.x) {
        an.dispose();
        an = creaAnnesso({ ...opzA, interrata, porta: scelto.u });
      }
      base = scelto.base;
      progetto = scelto.progetto;
      const serve = interrataPer(base, fp.min, fp.max, 0.5);
      if (serve > interrata + 0.01) {
        an.dispose();
        interrata = serve;
        an = creaAnnesso({ ...opzA, interrata, porta: scelto.u });
      }
    }
    ctx.posa(zona, an, c0.z, c0.theta, yaw, { h: base, nome, tag: (t) => (t === 'muro' ? 'casa' : t ?? 'casa') });
    const portaA = an.porte?.[0];
    annessoLontano(ctx.zona(zona).lontano, matriceSuperficie(c0.z, c0.theta, base, yaw), W, D, an.punti['gronda']!.y, an.punti['colmo']!.y, interrata, Math.floor(c0.z * 5 + c0.theta), nome, portaA ? portaA.centro.x : null);
    if (portaA) {
      const gr = gradiniPorta(ctx.zona(zona), c0.z, c0.theta, base, yaw, portaA, { seme: Math.floor(c0.z * 11 + c0.theta * 5), proprietario: nome, ...(progetto ? { progetto } : {}) });
      for (const r of zoneGradini(c0.z, c0.theta, base, yaw, portaA, gr.progetto, 1.0, 1.8)) ctx.occupa({ nome: `porta:${nome}`, ...r });
    }
    an.dispose();
    ctx.occupa({ nome, z: c0.z, theta: c0.theta, yaw, larghezza: W, profondita: D + 0.4 });
    messi++;
    return true;
  };
  /** Il fianco di `c` (−1 sinistra, +1 destra) verso cui punta `u`. */
  const fianco = (c: CasaPosata, u: { n: number; e: number }) => {
    const r = { n: -Math.sin(c.yaw * (Math.PI / 180)), e: Math.cos(c.yaw * (Math.PI / 180)) };
    return u.n * r.n + u.e * r.e >= 0 ? 1 : -1;
  };

  // 1. fra due case vicine
  const coppie: Array<{ a: CasaPosata; b: CasaPosata; d: number }> = [];
  for (let i = 0; i < generiche.length; i++) {
    for (let j = i + 1; j < generiche.length; j++) {
      const a = generiche[i]!;
      const b = generiche[j]!;
      const d = distanza(a, b);
      if (d < 18) coppie.push({ a, b, d });
    }
  }
  coppie.sort((x, y) => x.d - y.d);
  for (const { a, b, d } of coppie) {
    if (messi >= quanti) break;
    // stessa curva di livello: la quota delle basi e la direzione (b sta di fianco ad a, non sopra)
    if (Math.abs(a.base - b.base) > 2.4) continue;
    const df = differenza(a, b, 40);
    const u = { n: df.nord / d, e: df.est / d };
    const fa = { n: Math.cos(a.yaw * (Math.PI / 180)), e: Math.sin(a.yaw * (Math.PI / 180)) };
    const fb = { n: Math.cos(b.yaw * (Math.PI / 180)), e: Math.sin(b.yaw * (Math.PI / 180)) };
    const ua = Math.abs(u.n * fa.n + u.e * fa.e);
    if (ua > 0.62) continue;
    const latoA = fianco(a, u);
    const latoB = fianco(b, { n: -u.n, e: -u.e });
    if (lati(a).has(latoA) || lati(b).has(latoB)) continue;
    const ub = Math.abs(u.n * fb.n + u.e * fb.e);
    const ha = ua * (a.profondita / 2) + Math.sqrt(1 - ua * ua) * (a.larghezza / 2);
    const hb = ub * (b.profondita / 2) + Math.sqrt(1 - ub * ub) * (b.larghezza / 2);
    const vuoto = d - ha - hb;
    if (vuoto < 2.2 || vuoto > 12) continue;
    const seme = hash2(a.z * 3.1 + b.z, a.theta + b.theta * 1.7, 31);
    const pieno = vuoto <= 5.4;
    const W = pieno ? vuoto + 0.25 : 3.6 + seme * 1.4;
    const lungo = pieno ? ha + vuoto / 2 : ha + W / 2 - 0.12;
    if (!prova(a, u, lungo, W, Math.min(a.profondita, b.profondita), new Set([a.nome, b.nome]), seme, [a, b])) continue;
    lati(a).add(latoA);
    if (pieno) lati(b).add(latoB);
  }

  // 2. sui fianchi liberi
  for (const c of generiche) {
    if (messi >= quanti) break;
    const nucleo = distanza(c, campanile) < 90;
    for (const lato of [1, -1] as const) {
      if (lati(c).has(lato)) continue;
      const seme = hash2(c.z * 1.7 + lato, c.theta * 2.3, 34);
      if (!nucleo && seme > 0.5) continue;
      const r = { n: -Math.sin(c.yaw * (Math.PI / 180)) * lato, e: Math.cos(c.yaw * (Math.PI / 180)) * lato };
      const W = 3.2 + seme * 1.8;
      if (prova(c, r, c.larghezza / 2 + W / 2 - 0.12, W, c.profondita, new Set([c.nome]), seme, [c])) lati(c).add(lato);
      if (messi >= quanti) break;
    }
  }
  return messi;
}

/**
 * Il verde fra le case (rifinitura 2): un orto o un albero da frutto ogni due o tre case, davanti
 * (verso valle) o di fianco, dove c'è posto: fra i tetti del nucleo, visto da lontano, compaiono le
 * chiome tonde e le aiuole scure dei bozzetti. Lontani da sentieri, visuali, punti d'interazione.
 */
export function costruisciVerdeDelPaese(ctx: Contesto, case_: CasaPosata[]): { orti: number; alberi: number } {
  const piazza = luogo('piazza_ore');
  const generiche = case_.filter((c) => c.nome.startsWith('rustico_'));
  let orti = 0;
  let alberi = 0;
  for (const [k, c] of generiche.entries()) {
    const h = hash2(c.z * 0.77, c.theta * 1.9, 41);
    // circa tre case su cinque ci provano (non tutte trovano posto: alla fine uno ogni due-tre case)
    if (h > 0.62) continue;
    const albero = hash2(c.theta, c.z, 42) < 0.5;
    const W = albero ? 3.6 : 2.6 + hash2(c.z, 7, 43) * 1.4;
    const D = albero ? 3.6 : 2 + hash2(c.theta, 8, 44) * 1.2;
    // posti da provare: davanti a destra e a sinistra (verso valle), poi i fianchi
    const posti: Array<[number, number]> = [
      [c.profondita / 2 + D / 2 + 1.4, (c.larghezza / 2) * 0.6],
      [c.profondita / 2 + D / 2 + 1.4, -(c.larghezza / 2) * 0.6],
      [0, c.larghezza / 2 + W / 2 + 1.2],
      [0, -(c.larghezza / 2 + W / 2 + 1.2)],
      [c.profondita / 2 + D / 2 + 3.5, 0],
      [c.profondita / 2 + D / 2 + 1.2, c.larghezza / 2 + W / 2 + 0.8],
      [c.profondita / 2 + D / 2 + 1.2, -(c.larghezza / 2 + W / 2 + 0.8)],
      [-(c.profondita / 2 + D / 2 + 1.5), 0],
    ];
    for (const [av, dx] of posti) {
      const q0 = spostaYaw(c.z, c.theta, c.yaw, av, 40);
      const q = spostaYaw(q0.z, q0.theta, c.yaw + 90, dx, 40);
      if (!rettLibero(ctx, q.z, q.theta, c.yaw, W, D, new Set(), { margine: 0.4, sentieri: 1.1, punti: 2.5, visuale: albero ? 1.5 : 0.3 })) continue;
      const fp = impronta(q.z, q.theta, c.yaw, W, D);
      if (fp.max - fp.min > (albero ? 2.2 : 1.1)) continue;
      const zona = `case:${Math.floor(q.z / 70)}:${Math.floor(q.theta / 8)}`;
      // il dettaglio pieno (masse fini, frutti, più ciuffi di foglie) nel cuore del paese: gli orti
      // entro 50 m dalla piazza, gli alberi entro 90 m (si vedono da vicino dai vicoli e dal belvedere)
      const dPiazza = distanza(q, piazza);
      const vicino = dPiazza < (albero ? 90 : 50);
      if (albero) {
        const al = creaAlberoFrutto({ seme: `frutto-${k}`, dettaglio: vicino ? 'alto' : 'basso' });
        const h0 = suolo(q.z, q.theta);
        ctx.posa(zona, al, q.z, q.theta, c.yaw + hash2(q.z, 3, 45) * 360, { h: h0 - 0.05, tag: (t) => t ?? 'tronco' });
        alberoLontano(ctx.zona(zona).lontano, matriceSuperficie(q.z, q.theta, h0, 0), al.punti['chioma']!.y, 1.7, Math.floor(q.z * 3 + q.theta));
        al.dispose();
        ctx.occupa({ nome: `albero_frutto_${k}`, z: q.z, theta: q.theta, raggio: 0.6 });
        alberi++;
      } else {
        const ort = creaOrto({ seme: `orto-${k}`, larghezza: W, profondita: D, dettaglio: vicino ? 'alto' : 'basso' });
        ctx.posa(zona, ort, q.z, q.theta, c.yaw, { h: (fp.min + fp.max) / 2, collider: false });
        ort.dispose();
        ctx.occupa({ nome: `orto_${k}`, z: q.z, theta: q.theta, yaw: c.yaw, larghezza: W, profondita: D });
        orti++;
      }
      break;
    }
  }
  return { orti, alberi };
}

/**
 * Aie e cortili attorno alle case (rifinitura 2): dal Velo e dalle terrazze ogni rustico stava da solo
 * sul prato verde, come una pedina. Attorno a ogni casa ora c'è un'aia di terra battuta (davanti, verso
 * la porta, qualche lastra di gneiss), col bordo irregolare che sfuma nel prato: le aie delle case
 * vicine si toccano e il nucleo si legge come un tessuto unico. Solo dove il suolo è quasi alla quota
 * della casa (non sulle alzate dei gradoni), mai sui sentieri né sulle impronte dei luoghi con un
 * nome. Nessun collider: ci si cammina come sul prato.
 */
export function cortiliDelleCase(ctx: Contesto, case_: CasaPosata[]): number {
  const masks = createMasks();
  const out = [0, 0, 0];
  const terra = hex(0x8f7656);
  const terraScura = hex(0x6f5a42);
  const lastra = hex(0x8c867b);
  let fatti = 0;
  for (const c of case_) {
    if (!c.nome.startsWith('rustico_')) continue;
    const W = c.larghezza;
    const D = c.profondita;
    const ext = 2.4;
    const r1 = Math.hypot(W / 2 + ext, D / 2 + ext);
    const y = (c.yaw * Math.PI) / 180;
    const kdeg = (646 - c.base) * (Math.PI / 180);
    const zona = `case:${Math.floor(c.z / 70)}:${Math.floor(c.theta / 8)}`;
    const seme = hash2(c.z, c.theta, 51) * 10;
    // (solo i sentieri e le impronte vicine: il controllo gira su ogni triangolo dell'aia)
    const segmenti: Array<[PuntoCil, PuntoCil, number]> = [];
    for (const t of ctx.sentieri) {
      for (let k = 0; k < t.punti.length - 1; k++) {
        if (distanzaSegmento(c, t.punti[k]!, t.punti[k + 1]!) < r1 + t.larghezza + 1) segmenti.push([t.punti[k]!, t.punti[k + 1]!, t.larghezza]);
      }
    }
    const impronte = ctx.impronte.filter((i) => !(i.nome.startsWith('rustico_') || i.nome.startsWith('annesso_') || i.nome.startsWith('orto_') || i.nome.startsWith('albero_frutto_')) && distanza(i, c) < r1 + (i.raggio ?? Math.hypot(i.larghezza ?? 0, i.profondita ?? 0) / 2) + 1);
    const coloreSuolo = (z: number, th: number): RGB => {
      const h = surfaceHeight(z, th, masks);
      terrainColor(z, th, h, slopeAt(z, th), masks, out);
      return [out[0]!, out[1]!, out[2]!];
    };
    /** coordinate della casa (avanti, destra) e quanto si è fuori dal bordo irregolare dell'aia (m) */
    const forma = (x: number, yN: number) => {
      const zl = yN * Math.cos(y) + x * Math.sin(y);
      const xl = -yN * Math.sin(y) + x * Math.cos(y);
      const a = Math.atan2(zl, xl);
      const e = ext * (0.45 + 0.75 * rumore2(Math.cos(a) * 2.2 + seme, Math.sin(a) * 2.2, 3));
      const fx = Math.abs(xl) - (W / 2 + e);
      const fz = Math.abs(zl) - (D / 2 + e + (zl > 0 ? 0.6 : 0));
      return { zl, xl, fuori: Math.max(fx, fz) };
    };
    // davanti alla porta qualche lastra, poi terra battuta più scura dove ristagna l'acqua, e verso il
    // bordo la terra torna prato (fino al colore del suolo: niente cucitura)
    const colore = (x: number, yN: number): RGB => {
      const f = forma(x, yN);
      const z = c.z + yN;
      const th = c.theta + x / kdeg;
      const n = rumore2(z / 2.3 + seme, th * 4.1, 7);
      const lastre = Math.min(1, Math.max(0, Math.min(f.zl - D / 2, 1.4 - Math.abs(f.xl), D / 2 + 1.6 - f.zl) / 0.4 + 0.5));
      const col = mix(mix(terra, terraScura, n * 0.6), mix(lastra, terraScura, n * 0.3), lastre);
      const bordo = Math.min(1, Math.max(0, 1 + f.fuori / 1.1));
      return bordo > 0.35 ? mix(col, coloreSuolo(z, th), Math.min(1, (bordo - 0.35) / 0.6)) : col;
    };
    coronaSulSuolo(
      ctx.zona(zona),
      c.z,
      c.theta,
      0,
      r1,
      1.0,
      0.025,
      (x, yN) => {
        const f = forma(x, yN);
        if (f.fuori > 0) return null;
        // sotto la casa non serve (i muri scendono nel suolo)
        if (Math.abs(f.xl) < W / 2 - 0.4 && Math.abs(f.zl) < D / 2 - 0.4) return null;
        const z = c.z + yN;
        const th = c.theta + x / kdeg;
        if (Math.abs(suolo(z, th) - c.base) > 1.3) return null;
        const q = { z, theta: th };
        for (const [a, b, l] of segmenti) if (distanzaSegmento(q, a, b) - l / 2 < 0.3) return null;
        for (const i of impronte) if (i.raggio !== undefined ? distanza(i, q) < i.raggio : dentroRett(i, z, th)) return null;
        const bordo = Math.min(1, Math.max(0, 1 + f.fuori / 1.1));
        const lastre = f.zl > D / 2 && Math.abs(f.xl) < 1.4 && f.zl < D / 2 + 1.6;
        return [bordo > 0.7 ? SUPERFICIE.ERBA + 0.3 : lastre ? SUPERFICIE.PIETRA + 0.7 : SUPERFICIE.TERRA + 0.35, colore(x, yN)];
      },
      () => 0.05,
      // il colore sfuma da un vertice all'altro: il bordo dell'aia non fa il dente di sega dei triangoli
      colore,
    );
    fatti++;
  }
  return fatti;
}

/** (z, θ) dentro il rettangolo di un'impronta? */
function dentroRett(i: { z: number; theta: number; yaw?: number; larghezza?: number; profondita?: number }, z: number, theta: number): boolean {
  const d = differenza(i, { z, theta }, 40);
  const y = ((i.yaw ?? 0) * Math.PI) / 180;
  const avanti = d.nord * Math.cos(y) + d.est * Math.sin(y);
  const destra = -d.nord * Math.sin(y) + d.est * Math.cos(y);
  return Math.abs(avanti) <= (i.profondita ?? 0) / 2 && Math.abs(destra) <= (i.larghezza ?? 0) / 2;
}

/** La proposta tocca un'impronta già occupata (controllo sui quattro spigoli e sul centro)? */
function occupatoRett(ctx: Contesto, p: Proposta, margine: number): boolean {
  for (const [a, b] of [
    [-p.W / 2, -p.D / 2],
    [p.W / 2, -p.D / 2],
    [-p.W / 2, p.D / 2],
    [p.W / 2, p.D / 2],
    [0, p.D / 2],
    [0, -p.D / 2],
    [p.W / 2, 0],
    [-p.W / 2, 0],
  ] as const) {
    const q = spostaYaw(p.z, p.theta, p.yaw, b, 40);
    const r = spostaYaw(q.z, q.theta, p.yaw + 90, a, 40);
    if (ctx.occupato(r.z, r.theta, margine)) return true;
  }
  return false;
}

function vicinoSentieri(ctx: Contesto, p: Proposta, margine: number): boolean {
  for (const [a, b] of [
    [0, 0],
    [-p.W / 2, -p.D / 2],
    [p.W / 2, -p.D / 2],
    [-p.W / 2, p.D / 2],
    [p.W / 2, p.D / 2],
    [0, p.D / 2 + 1.2],
  ] as const) {
    const q = spostaYaw(p.z, p.theta, p.yaw, b, 40);
    const r = spostaYaw(q.z, q.theta, p.yaw + 90, a, 40);
    if (ctx.distanzaSentieri(r.z, r.theta) < margine) return true;
  }
  return false;
}

/** La casa bassa di Pina sulla piazza: la soglia è il luogo `soglia_pina`. */
export function costruisciCasaPina(ctx: Contesto): CasaPosata {
  const s = luogo('soglia_pina');
  const piazza = luogo('piazza_ore');
  const yaw = yawVerso(s, piazza);
  const W = 5.4;
  const D = 6.4;
  const c = spostaYaw(s.z, s.theta, yaw + 180, D / 2 + 0.35, 39);
  const base = suolo(s.z, s.theta) - 0.08;
  const casa = posaRustico(ctx, 'piazza', 'casa_pina', c.z, c.theta, yaw, {
    seme: 'casa-pina',
    larghezza: W,
    profondita: D,
    piani: 1,
    balcone: 'nessuno',
    gerani: 0.8,
    finestreAccese: 1,
    camino: true,
    base,
    luogo: 'soglia_pina',
  });
  // gradino della soglia, sgabello e scatola dei cartoni
  const b = new Costruttore(77);
  b.aggiungi(new BoxGeometry(1.6, 0.22, 0.7), { matrice: mat([0, 0.11, 0]), colore: 0x9a948a, variazione: 0.05, piatto: true });
  b.aggiungi(new BoxGeometry(0.5, 0.42, 0.35), { matrice: mat([-1.1, 0.21, 0.35]), colore: 0x6a5546, piatto: true });
  b.aggiungi(new BoxGeometry(0.62, 0.22, 0.42), { matrice: mat([1.05, 0.11, 0.4], [0, 0.3, 0]), colore: 0xb48a52, variazione: 0.05, piatto: true });
  b.aggiungi(new BoxGeometry(0.6, 0.02, 0.4), { matrice: mat([1.05, 0.23, 0.4], [0, 0.3, 0]), colore: 0xd6b878, piatto: true });
  // figure di cartone che spuntano
  for (let k = 0; k < 5; k++) b.aggiungi(new PlaneGeometry(0.12, 0.22), { matrice: mat([0.9 + k * 0.07, 0.32, 0.4 + (k % 2) * 0.05], [0, 0.3, 0]), colore: 0xc69a55, canale: 'sottile' });
  const punti = ctx.posa('piazza', b.costruisci('soglia-pina'), s.z, s.theta, yaw, { h: base });
  void punti;
  const scatola = ctx.qui(s.z, s.theta, 0.3);
  ctx.punto('guarda:scatola_pina', 'guarda', 'Guarda nella scatola dei cartoni', scatola, { raggio: 2.2, luogo: 'soglia_pina', rif: 'flag:figura_presa' });
  return casa;
}

/** La Casa del Velo: tre piani, grate alle finestre, un velo nero sulla porta. */
export function costruisciCasaVelo(ctx: Contesto): CasaPosata {
  const l = luogo('casa_del_velo');
  const piazza = luogo('piazza_ore');
  const W = 5.5;
  const D = 7.8;
  // la casa guarda la piazza. Correzione dopo la verifica: girata di 8° la porta stava sullo spigolo
  // del gradone, con il suolo che scendeva di traverso di 1,4 m: il pianerottolo aveva un fianco di
  // pietra alto più di un metro e chi arrivava da valle ci sbatteva contro. Si prova a girarla un poco
  // (al più 40°) finché davanti alla porta il suolo è quasi in piano, senza toccare sentieri e luoghi
  const yaw0 = yawVerso(l, piazza) + 8;
  let yaw = yaw0;
  let migliore = Infinity;
  /** i punti dell'impronta (allargata) che toccano luoghi o sentieri: girata, non più di com'era */
  const occupati = (y: number) => puntiRett(l.z, l.theta, y, W + 0.3, D + 0.8).filter((q) => ctx.occupato(q.z, q.theta, 0.2) || ctx.distanzaSentieri(q.z, q.theta) < 0.6).length;
  const occupati0 = occupati(yaw0);
  for (const giro of [0, -10, -20, -25, -30, -35, -40, 10, 20, 30, 40]) {
    const y = yaw0 + giro;
    if (occupati(y) > occupati0) continue;
    const porta = portaFronte(0, D);
    const pr = progettaGradini(l.z, l.theta, baseDaPorta(l.z, l.theta, y, porta), y, porta);
    // (il fianco del pianerottolo alto più di 35 cm conta: chi arriva da valle ci sbatte contro)
    const costo = pr.costo + Math.max(0, pr.esposto - 0.35) * 2 + Math.abs(giro) * 0.004;
    if (costo < migliore) {
      migliore = costo;
      yaw = y;
    }
  }
  const casa = posaRustico(ctx, 'nucleo', 'casa_del_velo', l.z, l.theta, yaw, {
    seme: 'casa-del-velo',
    larghezza: W,
    profondita: D,
    piani: 3,
    balcone: 'nessuno',
    gerani: 0,
    finestreAccese: 0.6,
    scalaEsterna: false,
    camino: true,
    luogo: 'casa_del_velo',
  });
  // velo nero sulla porta e grate (sbarre di ferro sulla facciata)
  const b = new Costruttore(91);
  const veloG = new PlaneGeometry(1.25, 2.2, 6, 4);
  const pos = veloG.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 9) * 0.04 * (1 - (pos.getY(i) + 1.1) / 2.2));
  b.aggiungi(veloG, { matrice: mat([0, 1.05, D / 2 + 0.08]), colore: 0x16141a, canale: 'sottile' });
  b.aggiungi(new BoxGeometry(1.5, 0.05, 0.08), { matrice: mat([0, 2.18, D / 2 + 0.08]), colore: 0x2a2622, piatto: true });
  // finestre della facciata (W < 5,8: una per piano al centro, davanzale a quota piano + 0,95)
  for (const yPiano of [2.5, 4.95]) {
    for (let k = -2; k <= 2; k++) b.aggiungi(new BoxGeometry(0.028, 0.9, 0.028), { matrice: mat([k * 0.13, yPiano + 1.38, D / 2 + 0.12]), colore: 0x26242a, piatto: true });
    for (const dy of [0.97, 1.8]) b.aggiungi(new BoxGeometry(0.62, 0.03, 0.03), { matrice: mat([0, yPiano + dy, D / 2 + 0.12]), colore: 0x26242a, piatto: true });
  }
  ctx.zona('nucleo').oggetto(b.costruisci('casa-velo-dettagli'), matriceSuperficie(l.z, l.theta, casa.base, yaw), { lumi: false });
  ctx.punto('apri:casa_del_velo', 'apri', 'Porta della Casa del Velo', casa.porta, { raggio: 2, luogo: 'casa_del_velo', rif: 'flag:dorme_casa_velo' });
  ctx.punto('dormi:casa_del_velo', 'dormi', 'Dormi nella Casa del Velo', casa.porta.clone(), { raggio: 2, luogo: 'casa_del_velo', rif: 'flag:dorme_casa_velo', attivo: false });
  return casa;
}
