/**
 * Modulo di gioco dei personaggi generati: scelta del modello, indice dei file, ripiego a null senza
 * modelli, stesso contratto della figura procedurale (collider, punti, update), pose, livelli di
 * dettaglio e frequenza ridotta dell'animazione. Tutto in Node, con un modello sintetico.
 */
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creaAbitante, type OpzioniAbitante } from '../../src/oggetti/oggetti/abitante';
import { createWorldUniforms } from '../../src/render/uniforms';
import { ANCA_SEDUTA, ANCA_TERRA, AnimatorePersonaggio, carattereDa } from '../../src/personaggi/animatore';
import { battutaPersonaggio, creaPersonaggio, livelloPersonaggio, type StatoPersonaggioGioco } from '../../src/personaggi/fabbrica';
import { PEZZI_COMUNI, spostamentiVariante } from '../../src/personaggi/materiale';
import {
  cartellaPersonaggi,
  collegaMotorePersonaggi,
  personaggiDisponibili,
  precaricaPersonaggi,
  preparaPrototipo,
  registraPrototipo,
  svuotaPersonaggi,
} from '../../src/personaggi/precarica';
import { GENERICI, SCHEDE, derivaProcedurale, genericoPer, leggiIndice, scegliModello } from '../../src/personaggi/schede';
import { modelloSintetico } from './sintetico';

// come ASPETTO e VELATI di src/popolamento/abitanti.ts
const TOGNA: OpzioniAbitante = { seme: 'togna', copricapo: 'velo', corporatura: 'robusta', postura: 'curva', colore: 0xd9d0bf, coloreVelo: 0x6a4a31 };
const ANNUNCIATA: OpzioniAbitante = { seme: 'annunciata', copricapo: 'velo', corporatura: 'anziana', postura: 'mani-giunte', colore: 0x4b3322, coloreVelo: 0x4b3322, bastone: true };
const VELATI: OpzioniAbitante[] = [
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

function registra(id: string, seme = 7): void {
  registraPrototipo(preparaPrototipo(id, modelloSintetico(seme), SCHEDE[id]));
}

/** posizione di un osso nello spazio del gruppo del personaggio */
function osso(g: THREE.Object3D, nome: string): THREE.Vector3 {
  g.updateMatrixWorld(true);
  let o: THREE.Object3D | undefined;
  g.traverse((x) => {
    if ((x as THREE.Bone).isBone && x.name === nome && !o) o = x;
  });
  if (!o) throw new Error(nome);
  return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(g.matrixWorld.clone().invert());
}

beforeEach(() => {
  svuotaPersonaggi();
  collegaMotorePersonaggi({ uniforms: null, camera: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('scelta del modello', () => {
  it('i personaggi con un nome usano il loro modello, se caricato', () => {
    const tutti = new Set(Object.keys(SCHEDE));
    expect(scegliModello('togna', TOGNA, tutti)).toBe('togna');
    expect(scegliModello('nando', {}, tutti)).toBe('nando');
    expect(scegliModello('togna', TOGNA, new Set(['nando']))).toBeNull();
    // chi non ha una scheda e non è un velato: solo se c'è un file con il suo nome
    expect(scegliModello('la_madre', {}, tutti)).toBeNull();
    expect(scegliModello('la_madre', {}, new Set(['la_madre']))).toBe('la_madre');
  });

  it('i velati prendono il generico adatto al copricapo e agli oggetti', () => {
    expect(genericoPer({ copricapo: 'velo' })).toBe('velata_donna');
    expect(genericoPer({ copricapo: 'cappello' })).toBe('velato_gerla');
    expect(genericoPer({ copricapo: 'velo', gerla: true })).toBe('velato_gerla');
    expect(genericoPer({ copricapo: 'maschera', bastone: true })).toBe('velato_maschera');
    expect(genericoPer({ copricapo: 'maschera-liscia' })).toBe('velato_maschera');
    expect(genericoPer({ copricapo: 'cappuccio' })).toBe('velato_cappuccio');
    expect(genericoPer({ copricapo: 'apicoltore' })).toBe('velato_cappuccio');
    const tutti = new Set<string>(GENERICI);
    const scelti = VELATI.map((v, i) => scegliModello(`velato_${i + 1}`, { seme: `velato_${i + 1}`, ...v }, tutti));
    expect(new Set(scelti)).toEqual(new Set(GENERICI));
  });

  it('se il generico preferito manca ripiega su un altro generico; senza generici, null', () => {
    expect(scegliModello('velato_2', VELATI[1] as OpzioniAbitante, new Set(['velata_donna']))).toBe('velata_donna');
    expect(scegliModello('velato_2', VELATI[1] as OpzioniAbitante, new Set(['togna', 'nando']))).toBeNull();
    expect(scegliModello('velato_2', VELATI[1] as OpzioniAbitante, new Set())).toBeNull();
  });

  it('ripete le scelte casuali e il raggio del collider della figura procedurale', () => {
    const casi: OpzioniAbitante[] = [TOGNA, ANNUNCIATA, ...VELATI.map((v, i) => ({ seme: `velato_${i + 1}`, ...v })), { seme: 3 }, { seme: 'x' }, {}];
    for (const o of casi) {
      const proc = creaAbitante(o);
      const c = proc.collider[0];
      expect(c?.tipo).toBe('cilindro');
      expect(derivaProcedurale(o).raggio).toBeCloseTo(c?.tipo === 'cilindro' ? c.raggio : -1, 6);
      proc.dispose();
    }
  });
});

describe('indice dei modelli', () => {
  it('legge le forme possibili di indice.json', () => {
    expect(leggiIndice(['togna', 'nando']).map((v) => v.id)).toEqual(['togna', 'nando']);
    expect(leggiIndice({ personaggi: ['togna'] })[0]).toEqual({ id: 'togna', file: 'togna.glb' });
    const v = leggiIndice({ personaggi: [{ id: 'pina', file: 'personaggi/pina-v2.glb', altezza: 1.5, gonna: 0.08 }, { id: 'nando', gonna: null }] });
    expect(v[0]).toEqual({ id: 'pina', file: 'pina-v2.glb', altezza: 1.5, gonna: true });
    expect(v[1]).toEqual({ id: 'nando', file: 'nando.glb', gonna: false });
    expect(leggiIndice({ _nota: 'x', personaggi: { lisa: { altezza: 1.3 }, gioanin: {} } }).map((x) => x.id)).toEqual(['lisa', 'gioanin']);
    expect(leggiIndice({ togna: {}, _nota: 'commento' }).map((x) => x.id)).toEqual(['togna']);
    expect(leggiIndice({ personaggi: [{ file: 'senza-id.glb' }, { id: '../fuori' }, 'togna', 'togna'] }).map((x) => x.id)).toEqual(['togna']);
    expect(leggiIndice(null)).toEqual([]);
  });

  it('la versione del file e la tavolozza dall indice (revisione finale)', () => {
    const [v] = leggiIndice({ personaggi: [{ id: 'velata_donna', versione: '0a1b2c3d4e', tavolozza: [[0.2, 0.1, 0.05]] }] });
    expect(v?.versione).toBe('0a1b2c3d4e');
    expect(v?.tavolozza?.[0]).toEqual([0.2, 0.1, 0.05]);
    // una versione che non è un nome di file pulito non entra nell'indirizzo
    expect(leggiIndice({ personaggi: [{ id: 'togna', versione: '../x?y' }] })[0]?.versione).toBeUndefined();
  });

  it('risolve la cartella sulla base del gioco', () => {
    expect(cartellaPersonaggi()).toMatch(/\/personaggi\/$/);
    expect(cartellaPersonaggi('https://esempio.it/gioco/personaggi')).toBe('https://esempio.it/gioco/personaggi/');
  });
});

describe('ripiego senza modelli', () => {
  it('senza modelli caricati creaPersonaggio dà null', () => {
    expect(personaggiDisponibili().size).toBe(0);
    expect(creaPersonaggio('togna', TOGNA)).toBeNull();
    expect(creaPersonaggio('velato_1', { seme: 'velato_1', ...VELATI[0] })).toBeNull();
  });

  it('precaricaPersonaggi non fallisce se i file non ci sono', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('rete assente')));
    const avanzamento: number[] = [];
    const esito = await precaricaPersonaggi((f) => avanzamento.push(f));
    expect(esito.caricati).toEqual([]);
    // senza indice si provano tutti e tredici i modelli delle schede (la build li contiene)
    expect(esito.mancanti).toEqual(Object.keys(SCHEDE).sort());
    expect(avanzamento[avanzamento.length - 1]).toBe(1);
    expect(creaPersonaggio('togna', TOGNA)).toBeNull();
  });

  it('con un indice che dice 404 prova i modelli del pilota', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('no', { status: 404 })));
    const esito = await precaricaPersonaggi(undefined, { ids: ['pina'] });
    expect(esito.mancanti).toEqual(['pina']);
  });
});

describe('creaPersonaggio: stesso contratto della figura procedurale', () => {
  it('gruppo al suolo, collider e punti come la figura procedurale', () => {
    registra('togna');
    const p = creaPersonaggio('togna', TOGNA);
    expect(p).not.toBeNull();
    if (!p) return;
    const proc = creaAbitante(TOGNA);
    expect(p.gruppo.userData['personaggio']).toBe('togna');
    const c = p.collider[0];
    const cp = proc.collider[0];
    expect(c?.tipo === 'cilindro' && cp?.tipo === 'cilindro' && c.raggio === cp.raggio && c.tag === 'personaggio').toBe(true);
    expect(c?.tipo === 'cilindro' ? c.altezza : 0).toBeCloseTo(1.62, 2);
    expect(p.ingombro.altezza).toBeCloseTo(1.62, 2);
    expect(p.ingombro.interrata).toBe(0);
    for (const k of ['testa', 'manoDestra', 'manoSinistra']) expect(p.punti[k]).toBeInstanceOf(THREE.Vector3);
    expect((p.punti['testa'] as THREE.Vector3).y).toBeGreaterThan(1.45);
    // la destra del personaggio è -X, le mani più in basso della testa
    expect((p.punti['manoDestra'] as THREE.Vector3).x).toBeLessThan(-0.1);
    expect((p.punti['manoSinistra'] as THREE.Vector3).x).toBeGreaterThan(0.1);
    // le prese per gli oggetti di scena esistono e si trovano per nome (come le ossa per accessori())
    for (const n of ['presaD', 'presaS', 'cintura', 'dorso']) expect(p.gruppo.getObjectByName(n)).toBeDefined();
    // piedi a terra
    const pd = osso(p.gruppo, 'piedeD');
    expect(pd.y).toBeGreaterThan(0.03);
    expect(pd.y).toBeLessThan(0.14);
    p.dispose();
    proc.dispose();
  });

  it('cammina: piedi in controfase; guarda: la testa si gira verso il punto', () => {
    registra('nando');
    const p = creaPersonaggio('nando', { seme: 'nando', copricapo: 'cappello', corporatura: 'robusta', postura: 'eretta' });
    if (!p) throw new Error('null');
    const dz: number[] = [];
    for (let i = 0; i < 90; i++) {
      // il passo va con la distanza percorsa davvero: il gruppo avanza come nel gioco
      p.gruppo.position.z += 1.2 / 60;
      p.update?.(1 / 60, { modo: 'cammina', velocita: 1.2 });
      if (i > 40) dz.push(osso(p.gruppo, 'piedeS').z - osso(p.gruppo, 'piedeD').z);
    }
    expect(Math.max(...dz)).toBeGreaterThan(0.1);
    expect(Math.min(...dz)).toBeLessThan(-0.1);
    // guarda a sinistra (+X), da fermo
    const punto = new THREE.Vector3(5, 1.6, 0.5);
    for (let i = 0; i < 120; i++) p.update?.(1 / 60, { modo: 'fermo', guarda: punto });
    const testa = p.gruppo.getObjectByName('testa') as THREE.Bone;
    // l'asse «avanti» della testa a riposo (+Z del modello) dopo l'animazione
    const presa = p.gruppo.getObjectByName('presaD') as THREE.Bone;
    expect(presa).toBeDefined();
    p.gruppo.updateMatrixWorld(true);
    const q = new THREE.Quaternion();
    testa.getWorldQuaternion(q);
    // confronto con la rotazione di riposo: misura il giro con un vettore avanti
    const a = new THREE.Vector3(0, 0, 1);
    const p2 = creaPersonaggio('nando', { seme: 'nando', copricapo: 'cappello', corporatura: 'robusta', postura: 'eretta' });
    if (!p2) throw new Error('null');
    for (let i = 0; i < 120; i++) p2.update?.(1 / 60, { modo: 'fermo', guarda: new THREE.Vector3(0, 1.6, 5) });
    const testa2 = p2.gruppo.getObjectByName('testa') as THREE.Bone;
    p2.gruppo.updateMatrixWorld(true);
    const q2 = new THREE.Quaternion();
    testa2.getWorldQuaternion(q2);
    // giro relativo: q · q2⁻¹ applicato all'avanti
    const giro = a.clone().applyQuaternion(q.clone().multiply(q2.clone().invert()));
    expect(giro.x).toBeGreaterThan(0.6);
    p.dispose();
    p2.dispose();
  });

  it('seduto: le anche ANCA_SEDUTA·H sopra il sedile (senza profilo una panca di 0,45 m), per terra sul suolo; chino: la testa va avanti e giù', () => {
    registra('togna');
    const p = creaPersonaggio('togna', { ...TOGNA, postura: 'eretta' });
    if (!p) throw new Error('null');
    for (let i = 0; i < 60; i++) p.update?.(1 / 60, { modo: 'fermo' });
    const testaIn = osso(p.gruppo, 'testa');
    const stato: StatoPersonaggioGioco = { modo: 'fermo', posa: 'seduto' };
    for (let i = 0; i < 180; i++) p.update?.(1 / 60, stato);
    expect(osso(p.gruppo, 'cosciaS').y).toBeCloseTo(0.45 + ANCA_SEDUTA * 1.62, 1);
    // su un gradino di 0,3 m col profilo del suolo: le anche sul gradino, i piedi giù
    stato.profilo = { inizio: -0.8, passo: 0.1, quote: Array.from({ length: 19 }, (_, i) => (-0.8 + i * 0.1 <= 0.15 ? 0.3 : 0)) };
    for (let i = 0; i < 180; i++) p.update?.(1 / 60, stato);
    expect(osso(p.gruppo, 'cosciaS').y).toBeCloseTo(0.3 + ANCA_SEDUTA * 1.62, 1);
    // per terra (suolo piatto): le anche a ANCA_TERRA·H dal suolo
    stato.profilo = { inizio: -0.8, passo: 0.1, quote: new Array(19).fill(0) };
    for (let i = 0; i < 180; i++) p.update?.(1 / 60, stato);
    expect(osso(p.gruppo, 'cosciaS').y).toBeCloseTo(ANCA_TERRA * 1.62, 1);
    stato.profilo = null;
    for (let i = 0; i < 180; i++) p.update?.(1 / 60, stato);
    // le ginocchia avanti
    expect(osso(p.gruppo, 'stincoS').z).toBeGreaterThan(0.2);
    stato.posa = 'chino';
    for (let i = 0; i < 240; i++) p.update?.(1 / 60, stato);
    const testaChina = osso(p.gruppo, 'testa');
    expect(testaChina.z - testaIn.z).toBeGreaterThan(0.18);
    expect(testaIn.y - testaChina.y).toBeGreaterThan(0.1);
    p.dispose();
  });

  it('a ogni battuta chi parla annuisce: la testa si muove più che da fermo', () => {
    registra('togna');
    const giro = (battuta: boolean) => {
      const p = creaPersonaggio('togna', TOGNA);
      if (!p) throw new Error('null');
      for (let i = 0; i < 60; i++) p.update?.(1 / 60, { modo: 'fermo' });
      const testa = p.gruppo.getObjectByName('testa') as THREE.Bone;
      const q0 = testa.quaternion.clone();
      if (battuta) battutaPersonaggio(p.gruppo);
      let max = 0;
      for (let i = 0; i < 40; i++) {
        p.update?.(1 / 60, { modo: 'fermo' });
        max = Math.max(max, testa.quaternion.angleTo(q0));
      }
      p.dispose();
      return max;
    };
    expect(giro(true)).toBeGreaterThan(giro(false) + 0.05);
  });

  it('la postura delle opzioni (curva, mani giunte) arriva all animatore', () => {
    registra('annunciata');
    const p = creaPersonaggio('annunciata', { ...ANNUNCIATA, bastone: false });
    if (!p) throw new Error('null');
    for (let i = 0; i < 180; i++) p.update?.(1 / 60, { modo: 'fermo' });
    // mani giunte: le due mani vicine, davanti alla pancia
    const d = osso(p.gruppo, 'manoS').distanceTo(osso(p.gruppo, 'manoD'));
    expect(d).toBeLessThan(0.12);
    p.dispose();
  });

  it('il bastone va da terra alla mano destra', () => {
    registra('annunciata');
    const p = creaPersonaggio('annunciata', ANNUNCIATA);
    if (!p) throw new Error('null');
    for (let i = 0; i < 120; i++) p.update?.(1 / 60, { modo: 'fermo' });
    const b = p.gruppo.getObjectByName('bastone') as THREE.Mesh;
    expect(b).toBeDefined();
    p.gruppo.updateMatrixWorld(true);
    const piede = new THREE.Vector3(0, 0, 0).applyMatrix4(b.matrix);
    const cima = new THREE.Vector3(0, 1, 0).applyMatrix4(b.matrix);
    expect(piede.y).toBeCloseTo(0, 3);
    const presa = osso(p.gruppo, 'presaD');
    expect(cima.distanceTo(presa)).toBeLessThan(0.1);
    p.dispose();
  });

  it('i velati: varianti di misura e tinta, materiale proprio', () => {
    for (const g of GENERICI) registra(g, 11);
    const a = creaPersonaggio('velato_1', { seme: 'velato_1', ...VELATI[0] });
    const b = creaPersonaggio('velato_12', { seme: 'velato_12', ...VELATI[11] });
    if (!a || !b) throw new Error('null');
    expect(a.gruppo.userData['personaggio']).toBe('velata_donna');
    expect(b.gruppo.userData['personaggio']).toBe('velata_donna');
    expect(a.ingombro.altezza).not.toBeCloseTo(b.ingombro.altezza, 4);
    const ma = (a.gruppo.getObjectByName('lod0') as THREE.SkinnedMesh).material;
    const mb = (b.gruppo.getObjectByName('lod0') as THREE.SkinnedMesh).material;
    expect(ma).not.toBe(mb);
    a.dispose();
    b.dispose();
  });
});

describe('materiale del mondo', () => {
  it('varianti dei generici: la stessa stoffa gira tutta insieme, stoffe diverse no', () => {
    // il chiaro e lo scuro di una gonna ruggine, un velo verde scuro, un grembiule quasi bianco
    const tav = [
      [0.55, 0.3, 0.18],
      [0.47, 0.25, 0.15],
      [0.12, 0.22, 0.12],
      [0.86, 0.84, 0.8],
    ];
    const v = spostamentiVariante(12345, tav);
    expect(v[0]!.equals(v[1]!)).toBe(true);
    expect(v[0]!.equals(v[2]!)).toBe(false);
    expect(v[0]!.equals(v[3]!)).toBe(false);
    // deterministico per seme, diverso fra semi; tinta entro ±28°
    expect(spostamentiVariante(12345, tav)[2]!.equals(v[2]!)).toBe(true);
    expect(spostamentiVariante(999, tav)[0]!.equals(v[0]!)).toBe(false);
    for (const x of v) expect(Math.abs(x.x)).toBeLessThanOrEqual(28 / 360);
  });

  it('con gli uniform del motore usa la variante del materiale del mondo (anche per chi c era già)', () => {
    registra('togna');
    const p = creaPersonaggio('togna', TOGNA);
    if (!p) throw new Error('null');
    const mesh = p.gruppo.getObjectByName('lod0') as THREE.SkinnedMesh;
    expect((mesh.material as THREE.Material).name).toBe('personaggio-toon');
    const u = createWorldUniforms();
    collegaMotorePersonaggi({ uniforms: u });
    const m = mesh.material as THREE.ShaderMaterial;
    expect(m.name).toBe('personaggio-mondo');
    // gli uniform del mondo sono gli stessi oggetti (aggiornati dal motore)
    expect(m.uniforms['uSunColor']).toBe(u.uSunColor);
    expect(m.uniforms['uNight']).toBe(u.uNight);
    expect(m.uniforms['uMappa']?.value).toBeInstanceOf(THREE.Texture);
    for (const f of ['shadeLit(', 'applyHazeK(', 'paintState(', 'pencilColor(']) expect(m.fragmentShader).toContain(f);
    expect(m.vertexShader).toContain('#include <skinning_vertex>');
    expect(PEZZI_COMUNI.length).toBe(4);
    const nuovo = creaPersonaggio('togna', TOGNA);
    expect(((nuovo?.gruppo.getObjectByName('lod1') as THREE.SkinnedMesh).material as THREE.Material).name).toBe('personaggio-mondo');
    p.dispose();
    nuovo?.dispose();
  });
});

describe('livelli di dettaglio e frequenza dell animazione', () => {
  it('LOD0 vicino, LOD1 oltre 25 m, lontano oltre 120 m, sparito oltre 230 m', () => {
    registra('togna');
    const camera = new THREE.PerspectiveCamera(70);
    collegaMotorePersonaggi({ camera });
    const p = creaPersonaggio('togna', TOGNA);
    if (!p) throw new Error('null');
    const lod0 = p.gruppo.getObjectByName('lod0') as THREE.SkinnedMesh;
    const lod1 = p.gruppo.getObjectByName('lod1') as THREE.SkinnedMesh;
    const a = (d: number) => {
      camera.position.set(0, 1.6, d);
      camera.updateMatrixWorld(true);
      p.gruppo.updateMatrixWorld(true);
      p.update?.(1 / 60, { modo: 'fermo' });
      return livelloPersonaggio(p);
    };
    expect(a(10)).toBe(0);
    expect(lod0.visible && !lod1.visible).toBe(true);
    expect(a(50)).toBe(1);
    expect(!lod0.visible && lod1.visible).toBe(true);
    expect(a(150)).toBe(2);
    expect(a(400)).toBe(3);
    expect(lod0.visible || lod1.visible).toBe(false);
    expect(a(10)).toBe(0);
    // isteresi: a 25,5 m resta al LOD0, a 28 passa al LOD1
    expect(a(25.5)).toBe(0);
    expect(a(28)).toBe(1);
    p.dispose();
  });

  it('col cannocchiale (campo visivo stretto) le distanze contano come viste: a 200 m resta visibile e vicino', () => {
    registra('togna');
    const camera = new THREE.PerspectiveCamera(70 * 0.25);
    collegaMotorePersonaggi({ camera });
    const p = creaPersonaggio('togna', TOGNA);
    if (!p) throw new Error('null');
    camera.position.set(0, 1.6, 200);
    camera.updateMatrixWorld(true);
    p.gruppo.updateMatrixWorld(true);
    for (let i = 0; i < 10; i++) p.update?.(1 / 60, { modo: 'fermo' });
    // 200 m con un campo visivo quattro volte più stretto sembrano circa 45 m: LOD1, animato, visibile
    expect(livelloPersonaggio(p)).toBe(1);
    camera.fov = 70;
    camera.updateProjectionMatrix();
    for (let i = 0; i < 10; i++) p.update?.(1 / 60, { modo: 'fermo' });
    expect(livelloPersonaggio(p)).toBe(2);
    p.dispose();
  });

  it('da lontano le ossa si aggiornano di rado', () => {
    registra('togna');
    const camera = new THREE.PerspectiveCamera(70);
    camera.position.set(0, 1.6, 160);
    camera.updateMatrixWorld(true);
    collegaMotorePersonaggi({ camera });
    const p = creaPersonaggio('togna', TOGNA);
    if (!p) throw new Error('null');
    p.gruppo.updateMatrixWorld(true);
    const petto = p.gruppo.getObjectByName('petto') as THREE.Bone;
    let cambi = 0;
    let prima = petto.quaternion.clone();
    for (let i = 0; i < 120; i++) {
      p.update?.(1 / 60, { modo: 'cammina', velocita: 1.1 });
      if (!petto.quaternion.equals(prima)) cambi++;
      prima = petto.quaternion.clone();
    }
    // 2 s a 6 Hz: una dozzina di aggiornamenti, non 120
    expect(cambi).toBeGreaterThan(8);
    expect(cambi).toBeLessThan(16);
    p.dispose();
  });
});

describe('carattere del movimento', () => {
  it('dal seme: deterministico, diverso fra semi, neutro senza seme', () => {
    expect(carattereDa(42)).toEqual(carattereDa(42));
    expect(carattereDa(42).respiro).not.toBe(carattereDa(43).respiro);
    expect(carattereDa(undefined).respiro).toBe(4.2);
    for (let s = 0; s < 50; s++) {
      const c = carattereDa(s * 7919);
      expect(c.respiro).toBeGreaterThanOrEqual(3.6);
      expect(c.respiro).toBeLessThanOrEqual(4.9);
      expect(Math.abs(c.inclina)).toBeLessThanOrEqual(3.5);
    }
  });

  it('due animatori con semi diversi non respirano all unisono', () => {
    const r1 = modelloSintetico(3);
    const r2 = modelloSintetico(3);
    const a1 = new AnimatorePersonaggio(r1, { seme: 1, altezza: 1.62 });
    const a2 = new AnimatorePersonaggio(r2, { seme: 2, altezza: 1.62 });
    const p1 = r1.getObjectByName('petto') as THREE.Bone;
    const p2 = r2.getObjectByName('petto') as THREE.Bone;
    let diversi = 0;
    for (let i = 0; i < 200; i++) {
      a1.update(1 / 30, {});
      a2.update(1 / 30, {});
      if (p1.quaternion.angleTo(p2.quaternion) > 1e-3) diversi++;
    }
    expect(diversi).toBeGreaterThan(100);
  });
});
