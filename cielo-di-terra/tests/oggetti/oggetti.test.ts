import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  CATALOGO,
  Rng,
  adattaAlMotore,
  colliderAlMondo,
  creaAbitante,
  creaBotolaCripta,
  creaCaposaldoDaContenuto,
  creaCastagno,
  creaFada,
  creaMuroSecco,
  creaRustico,
  creaSquadroPrimaPersona,
  creaVeloPrimaPersona,
  istanzia,
  matriceSuperficie,
  misura,
  posaSulCilindro,
  puntoCilindro,
  terna,
  unisciStatici,
  type Collider,
  type OggettoProcedurale,
} from '../../src/oggetti/index';

/** Impronta numerica di tutte le geometrie di un oggetto (per i test di determinismo). */
function impronta(o: OggettoProcedurale<unknown>): string {
  let h = 0;
  let n = 0;
  o.gruppo.updateMatrixWorld(true);
  o.gruppo.traverse((x) => {
    const m = x as THREE.Mesh;
    if (!m.isMesh) return;
    for (const nome of ['position', 'color']) {
      const a = m.geometry.getAttribute(nome) as THREE.BufferAttribute | undefined;
      if (!a) continue;
      for (let i = 0; i < a.array.length; i += 7) {
        h = (h * 31 + Math.round((a.array[i] as number) * 1000)) | 0;
        n++;
      }
    }
  });
  return `${h}:${n}`;
}

function attributiFiniti(o: OggettoProcedurale<unknown>): boolean {
  let ok = true;
  o.gruppo.traverse((x) => {
    const m = x as THREE.Mesh;
    if (!m.isMesh) return;
    for (const nome of ['position', 'normal', 'color']) {
      const a = m.geometry.getAttribute(nome) as THREE.BufferAttribute | undefined;
      if (!a) continue;
      for (let i = 0; i < a.array.length; i++) if (!Number.isFinite(a.array[i] as number)) ok = false;
    }
  });
  return ok;
}

function colliderValido(c: Collider): boolean {
  if (c.tipo === 'box') return c.centro.every(Number.isFinite) && c.mezze.every((v) => Number.isFinite(v) && v > 0);
  return c.base.every(Number.isFinite) && c.raggio > 0 && c.altezza > 0;
}

describe('catalogo: ogni generatore', () => {
  for (const voce of CATALOGO) {
    it(`${voce.nome}: geometria valida, deterministica, collider e ingombro sensati`, () => {
      const a = voce.crea();
      const b = voce.crea();
      expect(a.gruppo).toBeInstanceOf(THREE.Group);
      expect(impronta(a)).toBe(impronta(b));
      expect(attributiFiniti(a)).toBe(true);
      for (const c of a.collider) expect(colliderValido(c)).toBe(true);
      expect(a.appoggio.y).toBe(0);
      expect(Number.isFinite(a.ingombro.raggio)).toBe(true);
      // gli oggetti in prima persona vivono nello spazio camera (sotto l'occhio): niente altezza dal suolo
      if (!a.nome.includes('prima-persona')) expect(a.ingombro.altezza).toBeGreaterThan(0);
      const m = misura(a.gruppo);
      expect(m.triangoli).toBeGreaterThan(0);
      expect(m.drawCall).toBeGreaterThan(0);
      // ogni mesh dichiara il suo canale di materiale (per la sostituzione dei materiali)
      a.gruppo.traverse((x) => {
        if ((x as THREE.Mesh).isMesh) expect(x.userData['canale']).toBeTruthy();
      });
      // gli oggetti animati reggono un minuto di aggiornamenti senza NaN
      if (a.update) {
        for (let i = 0; i < 120; i++) a.update(0.5, undefined);
        a.gruppo.updateMatrixWorld(true);
        a.gruppo.traverse((x) => {
          for (const v of x.matrixWorld.elements) expect(Number.isFinite(v)).toBe(true);
        });
      }
      a.dispose();
    });
  }
});

describe('budget di triangoli e draw call', () => {
  const limiti: Array<[RegExp, number, number]> = [
    [/^rustico [123]/, 6000, 3],
    [/dettaglio basso/, 3000, 3],
    [/smontato/, 7000, 3],
    [/campanile/, 6000, 3],
    // (castagno vivo da vicino: solo i 6 della Terrazza Pedrazzini; foglie piccole e masse a ciuffi)
    [/castagno vivo/, 8000, 2],
    [/castagno morto/, 5000, 4],
    [/muro a secco 14 m \(curvo\)/, 4500, 2],
    [/abitante/, 2500, 2],
    [/Fada singola/, 1500, 8],
    [/sciame di 24 Fade/, 40000, 6],
    [/api di rame/, 12000, 4],
    [/lampione|lanterna|cappelletta|lumino/, 1500, 4],
    [/chiodo|caposaldo|pilastro|palina/, 6000, 3],
  ];
  for (const voce of CATALOGO) {
    const lim = limiti.find(([re]) => re.test(voce.nome));
    if (!lim) continue;
    it(`${voce.nome} ≤ ${lim[1]} triangoli e ≤ ${lim[2]} draw call`, () => {
      const m = misura(voce.crea().gruppo, true);
      expect(m.triangoli).toBeLessThanOrEqual(lim[1]);
      expect(m.drawCall).toBeLessThanOrEqual(lim[2]);
    });
  }
});

describe('varianti per seme e opzioni', () => {
  it('semi diversi danno rustici diversi, lo stesso seme lo stesso rustico', () => {
    expect(impronta(creaRustico({ seme: 1 }))).toBe(impronta(creaRustico({ seme: 1 })));
    expect(impronta(creaRustico({ seme: 1 }))).not.toBe(impronta(creaRustico({ seme: 2 })));
  });
  it('il rustico smontato ha la stessa pianta di quello intero (stesso ingombro in pianta)', () => {
    const a = creaRustico({ seme: 7, piani: 2 });
    const b = creaRustico({ seme: 7, piani: 2, smontato: true });
    const ba = new THREE.Box3().setFromObject(a.gruppo);
    const bb = new THREE.Box3().setFromObject(b.gruppo);
    // le macerie escono un po', ma i muri restano dentro la stessa impronta
    expect(bb.max.y).toBeLessThan(ba.max.y);
    expect(Math.abs(a.punti['porta']!.x - b.punti['porta']!.x)).toBeLessThan(1e-9);
  });
  it('castagni di stagioni diverse hanno colori diversi ma stessa forma', () => {
    const e = creaCastagno({ seme: 5, stagione: 'estate' });
    const a = creaCastagno({ seme: 5, stagione: 'autunno', ricci: false });
    const pe = (e.gruppo.children[0] as THREE.Mesh).geometry.getAttribute('position');
    const pa = (a.gruppo.children[0] as THREE.Mesh).geometry.getAttribute('position');
    expect(pe.count).toBe(pa.count);
    expect(impronta(e)).not.toBe(impronta(a));
  });
  it('muro a secco: un percorso a spezzata produce collider orientati lungo il percorso', () => {
    const m = creaMuroSecco({ percorso: [[0, 0], [4, 0], [8, 3]], altezza: 1.5 });
    expect(m.collider.length).toBeGreaterThanOrEqual(4);
    const rot = m.collider.map((c) => (c.tipo === 'box' ? c.rotY ?? 0 : 0));
    expect(Math.max(...rot) - Math.min(...rot)).toBeGreaterThan(0.3);
    expect(m.punti['fine']!.x).toBeCloseTo(8, 1);
  });
});

describe('animazioni procedurali', () => {
  it('la botola si apre e si richiude', () => {
    const b = creaBotolaCripta();
    const perno = b.gruppo.getObjectByName('botola-cerniera') as THREE.Object3D;
    for (let i = 0; i < 90; i++) b.update!(1 / 30, { aperta: true });
    expect(perno.rotation.x).toBeLessThan(THREE.MathUtils.degToRad(-100));
    for (let i = 0; i < 90; i++) b.update!(1 / 30, { aperta: false });
    expect(Math.abs(perno.rotation.x)).toBeLessThan(0.1);
  });
  it('una Fada porta la pietra da A a B', () => {
    const f = creaFada({ seme: 3 });
    const da = new THREE.Vector3(0, 0, 0);
    const a = new THREE.Vector3(6, 0, 2);
    const pietra = f.gruppo.children.find((c) => c.name.startsWith('fada-pietra')) as THREE.Object3D;
    let toccataB = false;
    for (let i = 0; i < 30 * 20; i++) {
      f.update!(1 / 30, { modo: 'trasporta', da, a, quota: 2 });
      if (pietra.position.distanceTo(a) < 0.05) toccataB = true;
    }
    expect(toccataB).toBe(true);
  });
  it("l'abitante gira la testa verso un punto e cammina sul posto", () => {
    const ab = creaAbitante({ seme: 9, copricapo: 'velo' });
    ab.gruppo.updateMatrixWorld(true);
    const testa = ab.gruppo.getObjectByName('testa') as THREE.Bone;
    for (let i = 0; i < 60; i++) ab.update!(1 / 30, { guarda: new THREE.Vector3(5, 1.6, 0) });
    expect(testa.rotation.y).toBeGreaterThan(0.6);
    const coscia = ab.gruppo.getObjectByName('cosciaS') as THREE.Bone;
    const angoli: number[] = [];
    for (let i = 0; i < 60; i++) {
      ab.update!(1 / 30, { modo: 'cammina', velocita: 1.2 });
      angoli.push(coscia.rotation.x);
    }
    expect(Math.max(...angoli) - Math.min(...angoli)).toBeGreaterThan(0.4);
  });
  it('lo squadro passa dalla posa in mano a quella piantata', () => {
    const s = creaSquadroPrimaPersona({ posa: 'mano' });
    const nodo = s.gruppo.children[0] as THREE.Object3D;
    const prima = nodo.position.clone();
    for (let i = 0; i < 60; i++) s.update!(1 / 30, { posa: 'piantato' });
    expect(nodo.position.distanceTo(prima)).toBeGreaterThan(0.2);
    expect(nodo.position.distanceTo(s.punti['puntaleInPiantato']!)).toBeLessThan(0.02);
  });
  it('la nappina del Velo pende dalla parte della deriva', () => {
    const v = creaVeloPrimaPersona();
    const perno = v.gruppo.getObjectByName('velo-nappina')!.parent as THREE.Object3D;
    for (let i = 0; i < 90; i++) v.update!(1 / 30, { deriva: 1, vento: 0.2 });
    const destra = perno.rotation.z;
    for (let i = 0; i < 90; i++) v.update!(1 / 30, { deriva: -1, vento: 0.2 });
    expect(destra).toBeGreaterThan(0.4);
    expect(perno.rotation.z).toBeLessThan(-0.4);
  });
});

describe('cilindro e integrazione', () => {
  it('matriceSuperficie segue la convenzione del motore', () => {
    const p0 = puntoCilindro(100, 0, 0);
    expect(p0.x).toBeCloseTo(0);
    expect(p0.y).toBeCloseTo(-646);
    expect(p0.z).toBe(100);
    const m = matriceSuperficie(500, 90, 2, 0);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    expect(pos.x).toBeCloseTo(-644);
    expect(pos.y).toBeCloseTo(0);
    // +Y locale = su (verso l'asse), +Z locale = nord con yaw 0
    const su = new THREE.Vector3(0, 1, 0).transformDirection(m);
    expect(su.distanceTo(terna(90).su)).toBeLessThan(1e-6);
    const avanti = new THREE.Vector3(0, 0, 1).transformDirection(m);
    expect(avanti.z).toBeCloseTo(1);
    const est = new THREE.Vector3(0, 0, 1).transformDirection(matriceSuperficie(500, 90, 0, 90));
    expect(est.distanceTo(terna(90).est)).toBeLessThan(1e-6);
    expect(m.determinant()).toBeGreaterThan(0);
  });
  it('posaSulCilindro e colliderAlMondo', () => {
    const r = creaRustico({ seme: 3 });
    posaSulCilindro(r.gruppo, 1000, 45, 0, 30);
    r.gruppo.updateMatrixWorld(true);
    const c = colliderAlMondo(r.collider[0]!, r.gruppo.matrixWorld);
    expect(c.kind).toBe('box');
    if (c.kind === 'box') {
      expect(c.up.distanceTo(terna(45).su)).toBeLessThan(1e-6);
      expect(Math.abs(c.right.dot(c.forward))).toBeLessThan(1e-6);
      expect(Math.hypot(c.center.x, c.center.y)).toBeLessThan(646);
    }
  });
  it('istanzia e unisciStatici riducono le draw call', () => {
    const r = creaRustico({ seme: 4, piani: 2 });
    const matrici = Array.from({ length: 10 }, (_, i) => new THREE.Matrix4().makeTranslation(i * 12, 0, 0));
    const ist = istanzia(r, matrici);
    const mi = misura(ist);
    const singolo = misura(r.gruppo);
    expect(mi.drawCall).toBeLessThanOrEqual(singolo.drawCall + 1);
    expect(mi.triangoli).toBe(singolo.triangoli * 10);
    const uniti = unisciStatici([
      { oggetto: r, matrice: new THREE.Matrix4() },
      { oggetto: creaMuroSecco({ seme: 1 }), matrice: new THREE.Matrix4().makeTranslation(0, 0, 10) },
    ]);
    expect(misura(uniti).drawCall).toBeLessThanOrEqual(3);
  });
  it('adattaAlMotore aggiunge aColor con l’emissione sui lumi', () => {
    const r = creaRustico({ seme: 5, finestreAccese: 1 });
    const mat = new THREE.MeshBasicMaterial();
    const n = adattaAlMotore(r.gruppo, { oggetto: mat });
    expect(n).toBeGreaterThan(0);
    let lumeConEmissione = false;
    r.gruppo.traverse((x) => {
      const m = x as THREE.Mesh;
      if (!m.isMesh) return;
      const a = m.geometry.getAttribute('aColor') as THREE.BufferAttribute;
      expect(a.itemSize).toBe(4);
      expect(m.material).toBe(mat);
      if (m.userData['canale'] === 'lume') for (let i = 0; i < a.count; i++) if (a.getW(i) > 0.5) lumeConEmissione = true;
    });
    expect(lumeConEmissione).toBe(true);
  });
  it('creaCaposaldoDaContenuto legge le voci di capisaldi.json', () => {
    const p4 = creaCaposaldoDaContenuto({ numero: 4, tipo: 'pilastro', altezza_segnale: 6, note: "Disco bianco e rosso su un'asta di 6 m." });
    expect(p4.nome).toBe('pilastro');
    expect(p4.punti['cima']!.y).toBeGreaterThan(6);
    const c3 = creaCaposaldoDaContenuto({ numero: 3, tipo: 'chiodo', nome: 'Chiodo 3, muro della Terrazza Pedrazzini' });
    expect(c3.collider[0]?.tag).toBe('arrampicabile');
    const c8 = creaCaposaldoDaContenuto({ numero: 8, tipo: 'chiodo', nome: 'Chiodo 8', luogo: 'sass_messo' });
    expect(c8.punti['chiodo']!.y).toBeGreaterThan(0.3);
    const lontano = creaCaposaldoDaContenuto({ numero: 12, tipo: 'pilastro', altezza_segnale: 8, lume: 'permanente' });
    expect(lontano.punti['lume']).toBeDefined();
  });
  it('Rng è deterministico', () => {
    const a = new Rng('Corbella');
    const b = new Rng('Corbella');
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });
});
