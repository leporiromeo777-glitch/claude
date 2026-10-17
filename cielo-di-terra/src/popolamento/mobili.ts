/**
 * Gli elementi mobili della Fase 1 (`fade_fase1.json → elementi_mobili`) con TUTTE le varianti
 * già costruite: si passa dall'una all'altra con `setVariante(id, variante)` (visibilità, collider
 * nel mondo, punti d'interazione). Pezzi per variante, come nei contenuti:
 *
 * E1 Passerella del Messo — Carta: prato pettinato + assi accatastate sulla riva a Sera;
 *    Abitata: tre assi sul riale + sentiero battuto fino al fienile.
 * E2 Casa di Nando — Abitata: casa intera (muri a secco, tetto di frasche e lamiera);
 *    Smontata: manca il muro a Sera, si vede il letto, segni delle pietre mancanti;
 *    Carta: il rudere di un muretto.
 * E3 Muro di Ronco — Carta: muro intero; Abitata: breccia di tre metri.
 * E4 Scorciatoia delle Terrazze — Carta: assi dei gradini accatastate al margine della Terrazza
 *    Pedrazzini; Abitata: sei rampe di gradini di assi infilati nei muri + sentiero battuto.
 */
import * as THREE from 'three';
import { matriceSuperficie } from '../oggetti/cilindro';
import { creaMuroSecco } from '../oggetti/oggetti/muri';
import type { Collider } from '../world/colliders';
import { rialeTheta } from '../world/terrain';
import { Cantiere, type MaterialiCantiere, type PortaPosata, type ScalettaPosata } from './cantiere';
import { ELEMENTI_MOBILI, luogo, type ElementoMobile } from './contenuti';
import type { Contesto } from './contesto';
import { creaAssi, creaCasupola, creaMucchioPietre } from './edifici';
import { nastroSulSuolo } from './forme';
import { SUPERFICIE_NASTRO, TRAVERSO_BATTUTO, campionaSentiero, coloreTerraBattuta, gradiniLungo, profiloCamminabile, suoloDiTraverso } from './sentieri';
import { distanza, impronta, metriPerGrado, mondo, sposta, spostaYaw, suolo, yawValle, yawVerso, type PuntoCil } from './terreno';
import { hex, mix } from './cantiere';
import { rumore2 } from './forme';
import { gradiniLuogo, oggettoSullaSoglia, progettaGradini } from './soglie';
import type { PuntoInterazione } from './tipi';

export interface VarianteCostruita {
  id: string;
  gruppo: THREE.Object3D;
  collider: Array<{ collider: Collider; tag: string; luogo?: string }>;
  punti: string[];
  /** porte della variante (la casa di Nando abitata o smontata) */
  porte: PortaPosata[];
  /** scalette davanti alle porte della variante */
  scalette: ScalettaPosata[];
}

export interface ElementoCostruito {
  id: string;
  nome: string;
  contenuto: ElementoMobile;
  varianti: Map<string, VarianteCostruita>;
  attiva: string;
}

/** Tracciato della scorciatoia (E4): dal paese alla Terrazza Pedrazzini attraverso 2407 e 2311. */
export const TRACCIATO_SCORCIATOIA: PuntoCil[] = [
  { z: 1039, theta: 29.9 },
  { z: 1000, theta: 27.3 },
  { z: 966, theta: 25.0 },
  // le ultime tre alzate dritte fino all'angolo della terrazza, dove arriva anche la mulattiera
  // (finiva 7 m sotto il ripiano, davanti al muro)
  { z: 967, theta: 22.92 },
];

export function costruisciMobili(ctx: Contesto, materiali: MaterialiCantiere): Map<string, ElementoCostruito> {
  const out = new Map<string, ElementoCostruito>();
  const nuovo = (el: ElementoMobile) => {
    const e: ElementoCostruito = { id: el.id, nome: el.nome, contenuto: el, varianti: new Map(), attiva: el.variante_iniziale };
    out.set(el.id, e);
    return e;
  };
  const variante = (e: ElementoCostruito, id: string, fn: (c: Cantiere, punti: string[]) => void) => {
    const c = new Cantiere(`${e.id}:${id}`);
    const punti: string[] = [];
    fn(c, punti);
    const g = c.costruisci(materiali);
    g.name = `mobile:${e.id}:${id}`;
    g.visible = false;
    ctx.dinamici.add(g);
    e.varianti.set(id, { id, gruppo: g, collider: c.collider.map((v) => ({ ...v })), punti, porte: c.porte.map((p) => ({ ...p, variante: `${e.id}=${id}` })), scalette: [...c.scalette] });
    // i lumi delle varianti (finestre della casa di Nando) vanno nel gruppo per l'integratore
    g.userData['lumi'] = c.lumi;
  };
  const el = (id: string) => ELEMENTI_MOBILI.find((x) => x.id === id)!;

  // ------------------------------------------------------------ E1 passerella del Messo
  {
    const e = nuovo(el('E1'));
    const pas = luogo('passerella_messo');
    const fien = luogo('fienile_ottavio');
    const thR = rialeTheta(pas.z);
    const kd = metriPerGrado(2);
    let a = 0;
    let b = 0;
    for (let d = 0.5; d < 12; d += 0.25) {
      if (!a && suolo(pas.z, thR - d / kd) > 1.6) a = d;
      if (!b && suolo(pas.z, thR + d / kd) > 1.6) b = d;
    }
    a = a || 3;
    b = b || 3;
    const L = a + b + 1.2;
    const centro = { z: pas.z, theta: thR + (b - a) / 2 / kd };
    const hPas = Math.max(suolo(pas.z, thR - a / kd), suolo(pas.z, thR + b / kd)) + 0.05;
    const sentiero: PuntoCil[] = [{ z: pas.z, theta: thR + (b + 0.6) / kd }, { z: 1168, theta: 55.0 }, { z: 1173, theta: 56.6 }, spostaYaw(fien.z, fien.theta, yawVerso(fien, pas), 4.4, 10)];
    variante(e, 'Abitata', (c, punti) => {
      const assi = creaAssi('assi-passerella', 3, L, false);
      c.oggetto(assi, matriceSuperficie(centro.z, centro.theta, hPas, 90), { tag: (t) => (t === 'calpestabile' ? 'passerella' : t ?? 'oggetto'), luogo: 'passerella_messo' });
      // (migliorie, suolo: la stessa terra battuta grigio-bruna dei sentieri, con l'orlo d'erba)
      nastroSulSuolo(c, sentiero, 1.2, 0.8, 0.05, coloreTerraBattuta, undefined, { traverso: TRAVERSO_BATTUTO, superficie: SUPERFICIE_NASTRO.battuto });
      ctx.punto('attraversa:passerella', 'attraversa', 'Passerella del Messo', mondo(centro.z, centro.theta, hPas + 0.3), { raggio: 3, luogo: 'passerella_messo', attivo: false });
      ctx.punto('siediti:passerella', 'siediti', 'Siediti sulle assi', mondo(centro.z, centro.theta, hPas + 0.3), { raggio: 2.2, luogo: 'passerella_messo', rif: 'flag:notte_su_E1', attivo: false });
      punti.push('attraversa:passerella', 'siediti:passerella');
    });
    variante(e, 'Carta', (c, punti) => {
      const riva = { z: pas.z - 1.5, theta: thR - (a + 1.6) / kd };
      const mucchio = creaAssi('assi-riva', 3, L, true);
      c.oggetto(mucchio, matriceSuperficie(riva.z, riva.theta, suolo(riva.z, riva.theta) + 0.02, 6), { luogo: 'passerella_messo' });
      // il prato pettinato «come da una mano enorme»
      nastroSulSuolo(c, sentiero, 4.2, 0.8, 0.04, (s, u) => {
        const str = Math.sin(u * 14 + s * 0.08) * 0.5 + 0.5;
        return mix(hex(0xa9bf5e), hex(0x7e9945), str * 0.7);
      }, undefined, { superficie: SUPERFICIE_NASTRO.pettinato });
      ctx.punto('prendi:assi_riva', 'prendi', 'Le assi accatastate', mondo(riva.z, riva.theta, suolo(riva.z, riva.theta) + 0.4), { raggio: 2.2, luogo: 'passerella_messo', rif: 'variante:E1=Abitata', attivo: false });
      punti.push('prendi:assi_riva');
    });
    ctx.occupa({ nome: 'E1', z: centro.z, theta: centro.theta, yaw: 90, larghezza: 2.5, profondita: L });
  }

  // ------------------------------------------------------------ E2 casa di Nando
  {
    const e = nuovo(el('E2'));
    const cn = luogo('casa_nando');
    const yaw = yawValle(cn.z, cn.theta) + 180 + 30; // la porta guarda il sentiero dei Ronchi (a Sera)
    const W = 4.6;
    const D = 5.4;
    // migliorie «porte»: la casa stava nell'alzata del gradone con la porta a monte, sepolta 3,2 m
    // (sul prato si vedeva solo il tetto di frasche). Ora sta sul gradone di sopra, alla quota dei
    // contenuti: spostata verso la porta (al più 4,5 m, dentro il luogo) finché l'impronta è quasi in
    // piano, con la soglia sul prato davanti
    let cc = { z: cn.z, theta: cn.theta };
    for (let s = 0; s <= 4.5; s += 0.5) {
      cc = spostaYaw(cn.z, cn.theta, yaw, s, suolo(cn.z, cn.theta));
      const f = impronta(cc.z, cc.theta, yaw, W, D);
      if (f.max - f.min <= 0.8) break;
    }
    const misura = oggettoSullaSoglia((interrata) => creaCasupola({ seme: 'casa-nando', larghezza: W, profondita: D, interrata, scritta: true, finestraAccesa: true }), cc.z, cc.theta, yaw, W, D);
    misura.oggetto.dispose();
    const { base, interrata, porta: portaNando } = misura;
    const m = matriceSuperficie(cc.z, cc.theta, base, yaw);
    // (le due varianti hanno la stessa scaletta; lo spazio davanti si segna una volta sola)
    const progettoNando = portaNando ? progettaGradini(cc.z, cc.theta, base, yaw, portaNando, { inizio: 0.3 }) : null;
    // il muro «a Sera» rispetto alla casa: quello la cui normale punta più verso -theta
    const latoSera = latoVerso(yaw, 270);
    const mettiPunti = (punti: string[], porta: THREE.Vector3) => {
      ctx.punto('leggi:casa_nando', 'leggi', 'La scritta sulla porta', porta.clone().add(new THREE.Vector3(0, 0, 0)), { raggio: 2.2, luogo: 'casa_nando', rif: 'casa_nando', attivo: false });
      punti.push('leggi:casa_nando');
    };
    variante(e, 'Abitata', (c, punti) => {
      const casa = creaCasupola({ seme: 'casa-nando', larghezza: W, profondita: D, interrata, scritta: true, finestraAccesa: true });
      const p = c.oggetto(casa, m, { luogo: 'casa_nando', tag: (t) => t ?? 'muro' });
      if (portaNando && progettoNando) gradiniLuogo(ctx, c, 'casa_nando', cc.z, cc.theta, base, yaw, portaNando, { luogo: 'casa_nando', seme: 1188, progetto: progettoNando });
      mettiPunti(punti, p['porta']!);
    });
    variante(e, 'Smontata', (c, punti) => {
      const casa = creaCasupola({ seme: 'casa-nando', larghezza: W, profondita: D, interrata, scritta: true, finestraAccesa: true, muri: { [latoSera]: false } });
      const p = c.oggetto(casa, m, { luogo: 'casa_nando', tag: (t) => t ?? 'muro' });
      if (portaNando && progettoNando && latoSera !== 'fronte') gradiniLuogo(ctx, c, 'casa_nando', cc.z, cc.theta, base, yaw, portaNando, { luogo: 'casa_nando', seme: 1188, progetto: progettoNando, occupa: false });
      // (il muro tolto è quello della porta: la porta resta appoggiata nel vano, e la scritta si legge lì)
      if (p['portaAppoggiata']) p['porta'] = p['portaAppoggiata'];
      // segni delle pietre mancanti: poche pietre rimaste a terra lungo il lato tolto
      const off = offsetLato(latoSera, W, D);
      const resti = creaMucchioPietre('resti-nando', 7, 0.9);
      c.oggetto(resti, m.clone().multiply(new THREE.Matrix4().makeTranslation(off.x * 1.15, 0, off.z * 1.15)), { luogo: 'casa_nando', collider: false });
      mettiPunti(punti, p['porta']!);
      ctx.punto('guarda:letto_nando', 'guarda', 'Dentro si vede il letto', p['letto'] ?? p['porta']!, { raggio: 3, luogo: 'casa_nando', attivo: false });
      punti.push('guarda:letto_nando');
    });
    variante(e, 'Carta', (c, punti) => {
      const rud = creaMuroSecco({ seme: 'rudere-nando', percorso: [[-2, 0], [2.2, 0.3]], altezza: 0.6, spessore: 0.55, pietra: 0.4, dettaglio: 'alto', interrata: 0.3 });
      c.oggetto(rud, m, { luogo: 'casa_nando', tag: () => 'macerie' });
      void punti;
    });
    ctx.occupa({ nome: 'E2', z: cc.z, theta: cc.theta, yaw, larghezza: W + 1.5, profondita: D + 1.5 });
  }

  // ------------------------------------------------------------ E3 muro di Ronco
  {
    const e = nuovo(el('E3'));
    const mr = luogo('muro_ronco');
    // corre lungo il prato di Ronco (lungo z), faccia a valle (a Mane)
    const yv = yawValle(mr.z, mr.theta);
    const h = suolo(mr.z, mr.theta);
    const L = 16;
    const m = matriceSuperficie(mr.z, mr.theta, h - 0.05, yv);
    // coordinate della libreria (X = sinistra): il muro va lungo X
    variante(e, 'Carta', (c, punti) => {
      c.oggetto(creaMuroSecco({ seme: 'muro-ronco', percorso: [[L / 2, 0], [-L / 2, 0]], altezza: 1.4, spessore: 0.7, pietra: 0.45, dettaglio: 'alto', interrata: 0.5 }), m, { luogo: 'muro_ronco', tag: () => 'muro' });
      void punti;
    });
    variante(e, 'Abitata', (c, punti) => {
      for (const [a, b] of [
        [L / 2, 1.5],
        [-1.5, -L / 2],
      ] as const) {
        c.oggetto(creaMuroSecco({ seme: `muro-ronco-${a}`, percorso: [[a, 0], [b, 0]], altezza: 1.4, spessore: 0.7, pietra: 0.45, dettaglio: 'alto', interrata: 0.5 }), m, { luogo: 'muro_ronco', tag: () => 'muro' });
      }
      // la breccia: poche pietre cadute
      c.oggetto(creaMucchioPietre('breccia-ronco', 6, 0.7), m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.8)), { luogo: 'muro_ronco', collider: false });
      ctx.punto('attraversa:breccia_ronco', 'attraversa', 'La breccia nel muro', mondo(mr.z, mr.theta, h + 0.5), { raggio: 2.5, luogo: 'muro_ronco', attivo: false });
      punti.push('attraversa:breccia_ronco');
    });
    ctx.occupa({ nome: 'E3', z: mr.z, theta: mr.theta, yaw: yv + 90, larghezza: L + 1, profondita: 2.4 });
  }

  // ------------------------------------------------------------ E4 scorciatoia delle Terrazze
  {
    const e = nuovo(el('E4'));
    const camp = campionaSentiero(TRACCIATO_SCORCIATOIA, 0.5);
    suoloDiTraverso(camp, 1.1);
    profiloCamminabile(camp, 33);
    // (il tracciato è registrato fra i sentieri da `costruisciSentieri`: i muri delle terrazze gli
    // aprono il varco; senza i gradini, variante Carta, le alzate restano troppo ripide da salire)
    variante(e, 'Abitata', (c, punti) => {
      gradiniLungo(c, camp, 1.1, 'assi', 0.42, 'gradino', 'scorciatoia_terrazze', 2311, (z, t) => ctx.distanzaSentieri(z, t, 'scorciatoia_terrazze') < 0.6);
      nastroSulSuolo(c, TRACCIATO_SCORCIATOIA, 1.1, 0.8, 0.05, coloreTerraBattuta, undefined, { traverso: TRAVERSO_BATTUTO, superficie: SUPERFICIE_NASTRO.battuto });
      const sc = luogo('scorciatoia_terrazze');
      ctx.punto('sentiero:scorciatoia', 'attraversa', 'Scorciatoia delle Terrazze', mondo(sc.z, sc.theta, suolo(sc.z, sc.theta) + 0.5), { raggio: sc.raggio, luogo: 'scorciatoia_terrazze', attivo: false });
      punti.push('sentiero:scorciatoia');
    });
    variante(e, 'Carta', (c, punti) => {
      // assi dei gradini accatastate al margine della Terrazza Pedrazzini
      const t = luogo('terrazza_pedrazzini');
      const p = sposta(t.z - 13, t.theta, 0, 3.5, 77);
      const h = Math.max(suolo(p.z, p.theta), Math.round(suolo(t.z, t.theta) * 2) / 2) + 0.02;
      c.oggetto(creaAssi('assi-scorciatoia', 9, 1.3, true), matriceSuperficie(p.z, p.theta, h, 20), { luogo: 'terrazza_pedrazzini' });
      const q = spostaYaw(p.z, p.theta, 0, 1.0, 77);
      c.oggetto(creaAssi('assi-scorciatoia-2', 7, 1.3, true), matriceSuperficie(q.z, q.theta, h, 75), { luogo: 'terrazza_pedrazzini' });
      ctx.punto('guarda:assi_terrazza', 'guarda', 'Le assi della scorciatoia', mondo(p.z, p.theta, h + 0.5), { raggio: 2.5, luogo: 'terrazza_pedrazzini', attivo: false });
      punti.push('guarda:assi_terrazza');
    });
  }

  // varianti iniziali
  for (const e of out.values()) {
    for (const [id, v] of e.varianti) v.gruppo.visible = id === e.attiva;
  }
  return out;
}

/** Quale lato della casupola (fronte/retro/sinistra/destra) guarda di più verso la bussola `verso`. */
function latoVerso(yawCasa: number, verso: number): 'fronte' | 'retro' | 'sinistra' | 'destra' {
  const rel = ((verso - yawCasa + 540) % 360) - 180; // 0 = davanti
  if (Math.abs(rel) <= 45) return 'fronte';
  if (Math.abs(rel) >= 135) return 'retro';
  // bussola +90 = destra (−X della libreria); la casupola chiama «sinistra» il muro a +X
  return rel > 0 ? 'destra' : 'sinistra';
}

function offsetLato(lato: 'fronte' | 'retro' | 'sinistra' | 'destra', W: number, D: number): THREE.Vector3 {
  switch (lato) {
    case 'fronte':
      return new THREE.Vector3(0, 0, D / 2);
    case 'retro':
      return new THREE.Vector3(0, 0, -D / 2);
    case 'sinistra':
      return new THREE.Vector3(W / 2, 0, 0);
    default:
      return new THREE.Vector3(-W / 2, 0, 0);
  }
}

/** Stato attivo dei punti di una variante. */
export function attivaPunti(punti: Map<string, PuntoInterazione>, ids: string[], on: boolean): void {
  for (const id of ids) {
    const p = punti.get(id);
    if (p) p.attivo = on;
  }
}

export { distanza };
