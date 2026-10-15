/**
 * Prova di compilazione del materiale dei personaggi (src/personaggi/materiale.ts) in WebGL2 con i pezzi
 * GLSL di un common.ts qualsiasi (`?common=/percorso/del/modulo.ts`, predefinito quello del ramo):
 * serve a vedere subito se il rifacimento grafico ha cambiato una firma che il materiale usa.
 * Risultato in window.__COMPILA__ = { ok, errori, avvisi } (lo legge tools/personaggi/compila.mjs).
 */
import * as THREE from 'three';
import { SORGENTE_VERTICE, sorgenteFrammento } from '../../src/personaggi/materiale';
import { createWorldUniforms } from '../../src/render/uniforms';

interface Esito {
  ok: boolean;
  errori: string[];
  avvisi: string[];
}

async function prova(): Promise<Esito> {
  const q = new URLSearchParams(location.search);
  const percorso = q.get('common') ?? '/src/render/shaders/common.ts';
  const C = (await import(/* @vite-ignore */ percorso)) as Record<string, string>;
  const pezzi = ['NOISE_GLSL', 'LIGHT_GLSL', 'BRUSH_GLSL', 'PENCIL_GLSL'].map((k) => {
    const v = C[k];
    if (typeof v !== 'string') throw new Error(`${percorso}: manca ${k}`);
    return v;
  });
  const esito: Esito = { ok: true, errori: [], avvisi: [] };
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(64, 64);
  document.body.appendChild(renderer.domElement);
  const gl = renderer.getContext();
  renderer.debug.onShaderError = (_gl, programma, vs, fs) => {
    esito.ok = false;
    for (const s of [vs, fs]) {
      const log = gl.getShaderInfoLog(s);
      if (log && log.trim()) esito.errori.push(log.trim());
    }
    const lp = gl.getProgramInfoLog(programma);
    if (lp && lp.trim()) esito.errori.push(lp.trim());
  };
  // uno scheletro di due ossa e una scatola pesata: basta per accendere USE_SKINNING
  const ossa = [new THREE.Bone(), new THREE.Bone()];
  (ossa[1] as THREE.Bone).position.y = 0.5;
  (ossa[0] as THREE.Bone).add(ossa[1] as THREE.Bone);
  const g = new THREE.BoxGeometry(0.3, 1, 0.3, 1, 4, 1).translate(0, 0.5, 0);
  const n = g.getAttribute('position').count;
  const si: number[] = [];
  const sw: number[] = [];
  const orlo: number[] = [];
  for (let i = 0; i < n; i++) {
    const y = g.getAttribute('position').getY(i);
    si.push(0, 1, 0, 0);
    sw.push(1 - y, y, 0, 0);
    orlo.push(y < 0.3 ? 1 : 0);
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setAttribute('aOrlo', new THREE.Float32BufferAttribute(orlo, 1));
  const u = createWorldUniforms();
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...u,
      uMappa: { value: new THREE.DataTexture(new Uint8Array([200, 150, 100, 255]), 1, 1) },
      uTinta: { value: new THREE.Color(1, 1, 1) },
      uOnda: { value: new THREE.Vector4(0.01, 1, 0.5, 0) },
      uBrush: { value: 0.5 },
      uRiempimento: { value: new THREE.Vector2(0.1, 0.6) },
    },
    vertexShader: SORGENTE_VERTICE,
    fragmentShader: sorgenteFrammento(C['WORLD_UNIFORMS_GLSL'] ?? '', pezzi),
  });
  const mesh = new THREE.SkinnedMesh(g, m);
  mesh.add(ossa[0] as THREE.Bone);
  mesh.bind(new THREE.Skeleton(ossa));
  const scena = new THREE.Scene();
  scena.add(mesh);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
  camera.position.set(0, 0.5, 3);
  renderer.render(scena, camera);
  const errGl = gl.getError();
  if (errGl !== gl.NO_ERROR) esito.avvisi.push(`glGetError ${errGl}`);
  if (renderer.info.programs?.length === 0) esito.avvisi.push('nessun programma compilato');
  return esito;
}

const w = window as unknown as { __COMPILA__?: Esito };
prova()
  .then((e) => (w.__COMPILA__ = e))
  .catch((e: unknown) => (w.__COMPILA__ = { ok: false, errori: [String(e)], avvisi: [] }));
