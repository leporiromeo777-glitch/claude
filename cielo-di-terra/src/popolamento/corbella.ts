/**
 * installaCorbella(game, opzioni): sostituisce il paese segnaposto del motore con la Corbella vera
 * dei contenuti e restituisce la maniglia per l'integratore: punti d'interazione, personaggi,
 * elementi mobili con le varianti, botola della Cripta, collider etichettati, lumi, dispose.
 */
import { Group, Vector3 } from 'three';
import type { Collider } from '../world/colliders';
import { impostaIntensitaLumi } from '../oggetti/materiali';
import { Abitanti, type ManigliaNpc } from './abitanti';
import { distanzaLodPerQualita, impostaDistanzaLod, type VoceCollider } from './cantiere';
import { LATI, PARTICELLE, RETE, luogo } from './contenuti';
import { cylToWorld, worldToCyl } from '../world/cylinder';
import { Contesto } from './contesto';
import { costruisciBalcone, costruisciGraDiPian, costruisciLontani, costruisciPilastriValle } from './luoghi/capisaldi';
import { cortiliDelleCase, costruisciAnnessi, costruisciCasaPina, costruisciCasaVelo, costruisciCase, costruisciVerdeDelPaese, lanterneDellePorte } from './luoghi/case';
import { costruisciCripta, type Cripta } from './luoghi/cripta';
import { costruisciPiazza } from './luoghi/piazza';
import { costruisciFienile, costruisciRiale, costruisciRonchi } from './luoghi/ronchi';
import { costruisciCampanile, costruisciChiesa } from './luoghi/sanVigilio';
import { costruisciSentieri } from './luoghi/sentieriCorbella';
import { costruisciMuriDelVelo, costruisciTerrazzaPedrazzini } from './luoghi/terrazze';
import { materialiMotore } from './materiali';
import { attivaPunti, costruisciMobili, type ElementoCostruito } from './mobili';
import { costruisciNotte, type Notte } from './notte';
import { dentroCorbella, liberaCastagni, rimuoviSegnaposto, type RisultatoSegnaposto } from './segnaposto';
import { costruisciMuriTerrazze } from './terrazzi';
import { distanza, suolo } from './terreno';
import type { GiocoCorbella, PuntoInterazione } from './tipi';

/** Quando il tempo corre (più di un minuto di gioco a passo), gli orari si rileggono un passo ogni tanti. */
export const PASSI_ORARIO_VELOCE = 4;

export interface OpzioniCorbella {
  /** 'rimuovi' (predefinito) toglie il paese segnaposto del motore; 'tieni' lo lascia (confronti) */
  segnaposto?: 'rimuovi' | 'tieni';
  /** avvolge `game.update` per animare personaggi, botola, Fade (predefinito true) */
  agganciaCiclo?: boolean;
  /** i personaggi seguono da soli gli orari dei contenuti (predefinito true) */
  orari?: boolean;
  /** giorno di gioco iniziale per gli orari (predefinito 1) */
  giorno?: number;
  /** varianti iniziali degli elementi mobili (predefinite: `variante_iniziale` dei contenuti) */
  varianti?: Partial<Record<'E1' | 'E2' | 'E3' | 'E4', string>>;
  /** muri delle terrazze (predefinito true; false per un paese più leggero) */
  muriTerrazze?: boolean;
  /**
   * luci (emisfero + direzionale guidate da `game.sky`) per il materiale toon dei personaggi
   * (predefinito true); false se la scena ha già le sue (la regia ne aggiunge)
   */
  luciAbitanti?: boolean;
}

export interface StatisticheCorbella {
  zone: number;
  triangoli: number;
  collider: number;
  lumi: number;
  punti: number;
  case: number;
  muriMetri: number;
  personaggi: number;
  castagniTolti: number;
  segnaposto: RisultatoSegnaposto | null;
  msCostruzione: number;
  /** lanterne a braccio sulle porte (rifinitura 1) */
  lanterne: number;
  /** annessi addossati fra le case vicine, orti e alberi da frutto (rifinitura 2) */
  annessi?: number;
  orti?: number;
  alberiFrutto?: number;
}

export interface ManigliaElemento {
  readonly id: string;
  readonly nome: string;
  readonly variante: string;
  readonly varianti: string[];
  readonly particelle: number[];
}

export interface ManigliaCorbella {
  /** radice di tutto il popolamento nella scena */
  readonly radice: Group;
  /** punti d'interazione per id (`leggi:targa_p1`, `chiodo:3`, `parla:ottavio`, `apri:botola`, `dormi:fienile_ottavio`…) */
  readonly punti: ReadonlyMap<string, PuntoInterazione>;
  punto(id: string): PuntoInterazione | undefined;
  /** punti attivi entro il loro raggio (o entro `raggioMax`) dalla posizione mondo, dal più vicino */
  puntiVicini(pos: Vector3, raggioMax?: number): PuntoInterazione[];
  /** personaggio per id di `personaggi.json` (più `velato_1`…`velato_12` e il gruppo `bambini`) */
  npc(id: string): ManigliaNpc | undefined;
  readonly personaggi: ReadonlyMap<string, ManigliaNpc>;
  /** mette tutti i personaggi dove dicono i contenuti al giorno e all'ora (ore decimali) */
  applicaOrario(giorno: number, ora: number): Record<string, string>;
  /** giorno di gioco usato dagli orari automatici */
  giorno: number;
  /** cambia la variante di un elemento mobile (E1-E4): visibilità, collider, punti, lumi */
  setVariante(elementoId: string, variante: string): void;
  variante(elementoId: string): string | undefined;
  readonly elementi: ReadonlyMap<string, ManigliaElemento>;
  /** la Cripta: botola animata e interno */
  readonly cripta: Cripta;
  apriBotola(aperta: boolean): void;
  /** le Fade e la lanterna di Tecla */
  readonly notte: Notte;
  /** chiodo d'ottone di un caposaldo (`'cs_3'` o `3`): dove si pianta lo squadro; null se non c'è */
  chiodo(id: string | number): Vector3 | null;
  /** segnale di mira di un caposaldo (palina, disco, lume lontano; per i chiodi la biffa a 1,2 m) */
  segnale(id: string | number): Vector3 | null;
  /** id dei capisaldi con un segnale (rete di Corbella + lontani di notte) */
  readonly capisaldi: readonly string[];
  /** collider aggiunti al mondo, con tag e luogo (varianti attive comprese) */
  collider(): VoceCollider[];
  readonly lumi: readonly Vector3[];
  readonly statistiche: StatisticheCorbella;
  /** da chiamare a ogni passo se `agganciaCiclo` è false */
  update(dt: number): void;
  dispose(): void;
}

export function installaCorbella(game: GiocoCorbella, opzioni: OpzioniCorbella = {}): ManigliaCorbella {
  const t0 = performance.now();
  const seg = (opzioni.segnaposto ?? 'rimuovi') === 'rimuovi' ? rimuoviSegnaposto(game) : null;
  // i lumi del motore che restano (le varianti ricostruiscono la lista completa)
  const lumiMotore = leggiLumi(game);
  const mat = materialiMotore(game);
  const ctx = new Contesto();

  // 0. corridoi delle visuali dei lati chiudibili: dove la visuale passa bassa non si costruiscono case
  segnaVisuali(ctx);
  // 1. luoghi con un nome (impronte prima delle case generiche) e sentieri
  costruisciSentieri(ctx);
  costruisciPiazza(ctx);
  costruisciCampanile(ctx);
  costruisciChiesa(ctx);
  costruisciCasaPina(ctx);
  costruisciCasaVelo(ctx);
  const cripta = costruisciCripta(ctx, mat);
  costruisciTerrazzaPedrazzini(ctx);
  costruisciMuriDelVelo(ctx);
  costruisciRonchi(ctx);
  costruisciRiale(ctx);
  costruisciFienile(ctx);
  const fumoGra = costruisciGraDiPian(ctx);
  costruisciPilastriValle(ctx);
  costruisciBalcone(ctx);
  costruisciLontani(ctx);
  const elementiCostruiti = costruisciMobili(ctx, mat);
  // 2. rustici sulle particelle abitate
  const case_ = costruisciCase(ctx);
  // lanterne a braccio accanto alle porte della corona della piazza (di notte il paese è acceso)
  const lanterne = lanterneDellePorte(ctx, case_);
  // rifinitura 2: stalle, legnaie e fienili addossati fra le case vicine (le cortine diventano
  // continue), poi un orto o un albero da frutto ogni due o tre case: il nucleo è un grumo
  const annessi = costruisciAnnessi(ctx, case_);
  const verde = costruisciVerdeDelPaese(ctx, case_);
  // e le aie di terra battuta attorno alle case: le case non stanno più sul prato come pedine
  cortiliDelleCase(ctx, case_);
  // 3. muri delle terrazze lungo le alzate dei gradoni
  const piazza = luogo('piazza_ore');
  const tipoCella = new Map(PARTICELLE.map((p) => [p.id, p.tipo]));
  const terrazzata = (z: number, th: number) => {
    const t = tipoCella.get(Math.floor(z / 40) * 96 + Math.floor(th / 3.75));
    return t === 'terrazze' || t === 'abitato';
  };
  const muri =
    opzioni.muriTerrazze === false
      ? { metri: 0, pezzi: 0 }
      : costruisciMuriTerrazze(ctx, {
          regione: { z0: 1060, theta0: 35, xMin: -112, xMax: 150, yMin: -122, yMax: 150, passo: 1.5 },
          prefissoZona: 'terrazze',
          escludi: (z, th) => !terrazzata(z, th) || th < 19 || z < 925 || distanza({ z, theta: th }, piazza) < piazza.raggio + 3 || suolo(z, th) < 9,
          dettaglio: (z, th) => (distanza({ z, theta: th }, piazza) < 38 ? 'alto' : 'basso'),
          altezzaMin: 2.0,
        });
  // 4. la notte e gli abitanti
  const notte = costruisciNotte(ctx, game.uniforms);
  const abitanti = new Abitanti(ctx, opzioni.luciAbitanti ?? true);

  // cottura delle zone
  const radice = new Group();
  radice.name = 'corbella';
  const colliderStatici: VoceCollider[] = [];
  const lumi: Vector3[] = [];
  const dimLumi: number[] = [];
  const dirLumi: (Vector3 | null)[] = [];
  let triangoli = 0;
  for (const z of ctx.zone.values()) {
    radice.add(z.costruisci(mat));
    colliderStatici.push(...z.collider);
    lumi.push(...z.lumi);
    dimLumi.push(...z.dimensioniLumi);
    dirLumi.push(...z.direzioniLumi);
    triangoli += z.triangoli;
  }
  colliderStatici.push(...ctx.colliderDinamici);
  radice.add(ctx.dinamici);
  radice.add(abitanti.gruppo);
  game.scene.add(radice);
  // il dettaglio lontano delle case segue la qualità grafica (350 m ad Alta, 310 a Media, 260 a Bassa)
  game.onQualita?.((p) => impostaDistanzaLod(radice, distanzaLodPerQualita(p.livello)));
  for (const c of colliderStatici) game.world.colliders.add(c.collider);
  abitanti.collegaCollider(game.world.colliders);

  // elementi mobili: varianti iniziali (collider della variante attiva nel mondo)
  const colliderVarianti = new Map<string, VoceCollider[]>();
  const elementi = new Map<string, ManigliaElemento>();
  const aggiornaLumi = () => {
    const extra: Vector3[] = [];
    for (const e of elementiCostruiti.values()) {
      const v = e.varianti.get(e.attiva);
      const l = (v?.gruppo.userData['lumi'] as Vector3[] | undefined) ?? [];
      extra.push(...l);
    }
    game.lamps.setLamps([...lumiMotore.lista, ...lumi, ...extra], [...lumiMotore.dim, ...dimLumi, ...extra.map(() => 0.55)], [...lumiMotore.dir, ...dirLumi, ...extra.map(() => null)]);
  };
  const setVariante = (id: string, v: string) => {
    const e = elementiCostruiti.get(id);
    if (!e) throw new Error(`popolamento: elemento mobile sconosciuto «${id}»`);
    if (!e.varianti.has(v)) throw new Error(`popolamento: variante «${v}» sconosciuta per ${id} (${[...e.varianti.keys()].join(', ')})`);
    for (const c of colliderVarianti.get(id) ?? []) game.world.colliders.remove(c.collider.id);
    for (const [vid, vv] of e.varianti) {
      vv.gruppo.visible = vid === v;
      attivaPunti(ctx.punti, vv.punti, vid === v);
    }
    const nuova = e.varianti.get(v)!;
    const lista = nuova.collider.map((c) => ({ ...c, collider: { ...c.collider } as Collider }));
    for (const c of lista) game.world.colliders.add(c.collider);
    colliderVarianti.set(id, lista);
    e.attiva = v;
    aggiornaLumi();
  };
  for (const e of elementiCostruiti.values()) {
    const iniziale = opzioni.varianti?.[e.id as 'E1'] ?? e.contenuto.variante_iniziale;
    elementi.set(e.id, maniglieElemento(e));
    setVariante(e.id, iniziale);
  }
  aggiornaLumi();

  const castagniTolti = liberaCastagni(game, (p) => {
    const c = cilDa(p);
    return ctx.occupato(c.z, c.theta, 1.5) || ctx.distanzaSentieri(c.z, c.theta) < 1.2;
  });

  // orari
  let giorno = opzioni.giorno ?? 1;
  const orari = opzioni.orari ?? true;
  let ultimaOra = -1;
  let passiDaOrario = 0;
  const ora = () => game.sky?.hours ?? game.clock?.hours ?? 10;
  if (orari) abitanti.applicaOrario(giorno, ora());

  // botola: collider attivi solo da chiusa
  const apriBotola = (a: boolean) => {
    cripta.apriBotola(a);
    for (const c of cripta.colliderBotola) {
      game.world.colliders.remove(c.id);
      if (!a) game.world.colliders.add(c);
    }
  };

  const statistiche: StatisticheCorbella = {
    zone: ctx.zone.size,
    triangoli,
    collider: colliderStatici.length,
    lumi: lumi.length,
    punti: ctx.punti.size,
    case: case_.length,
    muriMetri: Math.round(muri.metri),
    personaggi: abitanti.npc.size,
    castagniTolti,
    segnaposto: seg,
    msCostruzione: 0,
    lanterne,
    annessi,
    orti: verde.orti,
    alberiFrutto: verde.alberi,
  };

  const update = (dt: number) => {
    const h = ora();
    impostaIntensitaLumi(game.sky?.night ?? 0);
    for (const a of ctx.animati) a.update?.(dt);
    // fumo della grà di Pian dalle 6 alle 10
    fumoGra.visible = h >= 6 && h < 10;
    // gli orari si rileggono a ogni minuto di gioco; quando il tempo corre («Aspetta fino a» della
    // regia: ore di gioco in pochi secondi, più di un minuto a ogni passo) al più un passo ogni
    // PASSI_ORARIO_VELOCE: collocare tutti costa circa un millisecondo, e a ogni passo triplicava
    // il costo della simulazione durante l'attesa. Un salto da fermo (il sonno, un caricamento, il
    // giorno nuovo) si applica subito; alla fine dell'attesa la regia li rilegge da sé.
    passiDaOrario++;
    const dh = Math.abs(h - ultimaOra);
    if (orari && dh > 1 / 60 && (passiDaOrario >= PASSI_ORARIO_VELOCE || dh > 3 || ultimaOra < 0)) {
      ultimaOra = h;
      passiDaOrario = 0;
      abitanti.applicaOrario(giorno, h);
    }
    abitanti.update(dt, game.sky as never);
    notte.update(dt, h);
  };

  let origUpdate: ((dt: number) => void) | undefined;
  if ((opzioni.agganciaCiclo ?? true) && typeof game.update === 'function') {
    origUpdate = game.update;
    const legato = origUpdate.bind(game);
    game.update = (dt: number) => {
      legato(dt);
      update(dt);
    };
  }
  // un primo passo per mettere tutto in posa
  update(0);

  // la luce delle Fade sul suolo: il motore sceglie gli 8 lumi più vicini (fissi); di notte gli ultimi
  // posti vanno agli sciami attivi entro 140 m, così il prato e le pietre si scaldano sotto di loro
  const lumiFade = [new Vector3(), new Vector3()];
  const sistemaLuciFade = {
    render: () => {
      const arr = game.uniforms?.uLamps.value;
      const cam = (game.camera as { position?: Vector3 } | undefined)?.position;
      if (!arr || !cam) return;
      const n = notte.lumiFade(lumiFade);
      let slot = arr.length - 1;
      for (let i = 0; i < n && slot >= 0; i++) {
        const p = lumiFade[i]!;
        if (p.distanceToSquared(cam) > 140 * 140) continue;
        arr[slot--]!.set(p.x, p.y, p.z, 2.8);
      }
    },
  };
  game.sistemi?.push(sistemaLuciFade);

  const maniglia: ManigliaCorbella = {
    radice,
    punti: ctx.punti,
    punto: (id) => ctx.punti.get(id),
    puntiVicini(pos, raggioMax) {
      const out: Array<{ p: PuntoInterazione; d: number }> = [];
      for (const p of ctx.punti.values()) {
        if (!p.attivo) continue;
        const d = p.pos.distanceTo(pos);
        if (d <= (raggioMax ?? p.raggio)) out.push({ p, d });
      }
      return out.sort((a, b) => a.d - b.d).map((x) => x.p);
    },
    npc: (id) => abitanti.npc.get(id),
    personaggi: abitanti.npc,
    applicaOrario: (g, h) => {
      giorno = g;
      return abitanti.applicaOrario(g, h);
    },
    get giorno() {
      return giorno;
    },
    set giorno(g: number) {
      giorno = g;
      ultimaOra = -1;
    },
    setVariante,
    variante: (id) => elementiCostruiti.get(id)?.attiva,
    elementi,
    cripta,
    apriBotola,
    notte,
    chiodo(id) {
      const cs = typeof id === 'number' ? `cs_${id}` : id;
      for (const p of ctx.punti.values()) if (p.azione === 'pianta_squadro' && p.rif === cs) return p.pos.clone();
      return null;
    },
    segnale(id) {
      const cs = typeof id === 'number' ? `cs_${id}` : id;
      return ctx.segnali.get(cs)?.clone() ?? null;
    },
    capisaldi: [...ctx.segnali.keys()],
    collider: () => [...colliderStatici, ...[...colliderVarianti.values()].flat()],
    lumi,
    statistiche,
    update,
    dispose() {
      game.scene.remove(radice);
      radice.traverse((o) => {
        const m = o as unknown as { geometry?: { dispose(): void } };
        m.geometry?.dispose();
      });
      for (const c of colliderStatici) game.world.colliders.remove((c.collider as Collider).id);
      for (const l of colliderVarianti.values()) for (const c of l) game.world.colliders.remove(c.collider.id);
      abitanti.dispose();
      notte.dispose();
      if (game.sistemi) {
        const i = game.sistemi.indexOf(sistemaLuciFade);
        if (i >= 0) game.sistemi.splice(i, 1);
      }
      game.lamps.setLamps(lumiMotore.lista, lumiMotore.dim, lumiMotore.dir);
      if (origUpdate) game.update = origUpdate;
    },
  };
  statistiche.msCostruzione = Math.round(performance.now() - t0);
  return maniglia;
}

/** Segna i corridoi delle visuali dei lati chiudibili (occhio a 1,45 m sul chiodo, segnale in cima). */
function segnaVisuali(ctx: Contesto): void {
  const punto = (id: string, occhio: boolean) => {
    const cs = RETE.find((x) => x.id === id)!;
    const g = suolo(cs.z, cs.theta);
    const h = cs.id === 'cs_1' ? g + 24 + (occhio ? 1.45 : 8) : g + (occhio ? 1.45 : Math.max(1.2, cs.altezza_segnale));
    return cylToWorld(cs.z, cs.theta, h);
  };
  for (const lato of LATI) {
    if (!lato.chiudibile) continue;
    const a = punto(lato.a, true);
    const b = punto(lato.b, false);
    const a2 = punto(lato.b, true);
    const b2 = punto(lato.a, false);
    for (const [p0, p1] of [
      [a, b],
      [a2, b2],
    ] as const) {
      const L = p0.distanceTo(p1);
      for (let t = 0; t <= L; t += 1) {
        const p = p0.clone().lerp(p1, t / L);
        const c = worldToCyl(p);
        const sopra = c.h - suolo(c.z, c.theta);
        if (sopra < 13) ctx.visuali.push({ z: c.z, theta: c.theta, raggio: 2.2 });
        if (sopra < 1.6) ctx.visualiBasse.push({ z: c.z, theta: c.theta, raggio: 1.6 });
      }
    }
  }
}

function maniglieElemento(e: ElementoCostruito): ManigliaElemento {
  return {
    id: e.id,
    nome: e.nome,
    get variante() {
      return e.attiva;
    },
    varianti: [...e.varianti.keys()],
    particelle: [...e.contenuto.particelle],
  };
}

function leggiLumi(game: GiocoCorbella): { lista: Vector3[]; dim: number[]; dir: (Vector3 | null)[] } {
  const geo = game.lamps.points.geometry;
  const pos = geo.getAttribute('position');
  const size = geo.getAttribute('aSize');
  const dirA = geo.getAttribute('aDir');
  const lista: Vector3[] = [];
  const dim: number[] = [];
  const dir: (Vector3 | null)[] = [];
  if (pos) {
    for (let i = 0; i < pos.count; i++) {
      lista.push(new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
      dim.push(size ? size.getX(i) : 0.6);
      const d = dirA ? new Vector3(dirA.getX(i), dirA.getY(i), dirA.getZ(i)) : null;
      dir.push(d && d.lengthSq() > 0.25 ? d : null);
    }
  }
  return { lista, dim, dir };
}

function cilDa(p: Vector3): { z: number; theta: number } {
  const theta = ((Math.atan2(-p.x, -p.y) * 180) / Math.PI + 360) % 360;
  return { z: p.z, theta };
}

export { dentroCorbella };
