/**
 * Materiali condivisi della libreria.
 *
 * Tutti gli oggetti usano pochissimi materiali, con il colore nei vertici:
 * - `opaco`   pietra, legno, fogliame, metallo… (toon morbido a tre toni, FrontSide)
 * - `sottile` superfici a spessore zero: vele, veli, tela del Velo, foglie piatte (DoubleSide)
 * - `lume`    parti che emettono luce: fiamme, vetri delle lanterne, finestre accese, lumi delle Fade
 *             (non illuminate; la loro intensità segue l'ora con `impostaIntensitaLumi`)
 * - `alone`   aloni additivi attorno ai lumi (sprite)
 *
 * Ogni mesh creata dalla libreria porta `userData.canale` con il nome del canale, così
 * l'integratore può sostituire i materiali con quelli del motore (pennellata in shader ecc.)
 * chiamando `impostaMateriali` PRIMA di generare gli oggetti, oppure rimappando dopo.
 */
import * as THREE from 'three';

export type Canale = 'opaco' | 'sottile' | 'lume';

export interface SetMateriali {
  opaco: THREE.Material;
  sottile: THREE.Material;
  lume: THREE.Material;
  alone: THREE.SpriteMaterial;
}

let correnti: SetMateriali | null = null;
let intensitaLumi = 0;

/** Opzioni dei materiali predefiniti. */
export interface OpzioniMateriali {
  /** pennellata procedurale in shader (rumore in coordinate mondo); predefinito true */
  pennellata?: boolean;
  /** numero di toni del toon (2-4); predefinito 3 */
  toni?: number;
}

/** Mappa di gradiente del toon: tre campiture con passaggi morbidi (nessuna texture fotografica). */
export function creaMappaToni(toni = 3): THREE.DataTexture {
  const n = 64;
  const dati = new Uint8Array(n * 4);
  // livelli e soglie (coordinata = N·L * 0.5 + 0.5)
  const livelli = toni <= 2 ? [0.5, 1.0] : toni === 3 ? [0.42, 0.72, 1.0] : [0.36, 0.56, 0.78, 1.0];
  const soglie = toni <= 2 ? [0.52] : toni === 3 ? [0.5, 0.66] : [0.47, 0.58, 0.72];
  const morbidezza = 0.035;
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    let v = livelli[0] as number;
    for (let k = 0; k < soglie.length; k++) {
      const s = soglie[k] as number;
      const t = THREE.MathUtils.smoothstep(x, s - morbidezza, s + morbidezza);
      v += ((livelli[k + 1] as number) - (livelli[k] as number)) * t;
    }
    const b = Math.round(v * 255);
    dati[i * 4] = b;
    dati[i * 4 + 1] = b;
    dati[i * 4 + 2] = b;
    dati[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(dati, n, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Aggiunge al materiale una leggera «pennellata» procedurale: rumore a due scale in coordinate
 * mondo, allungato in orizzontale, che sporca le campiture di ±6-8%. Nessuna texture.
 */
export function aggiungiPennellata(mat: THREE.Material, forza = 0.07): void {
  const prec = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prec.call(mat, shader, renderer);
    shader.uniforms['uForzaPennellata'] = { value: forza };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosPennellata;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 pp = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            pp = instanceMatrix * pp;
          #endif
          vPosPennellata = ( modelMatrix * pp ).xyz;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vPosPennellata;
        uniform float uForzaPennellata;
        float pnHash( vec3 p ) {
          p = fract( p * 0.3183099 + 0.1 );
          p *= 17.0;
          return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
        }
        float pnRumore( vec3 x ) {
          vec3 i = floor( x );
          vec3 f = fract( x );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( pnHash( i + vec3( 0, 0, 0 ) ), pnHash( i + vec3( 1, 0, 0 ) ), f.x ),
                           mix( pnHash( i + vec3( 0, 1, 0 ) ), pnHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                      mix( mix( pnHash( i + vec3( 0, 0, 1 ) ), pnHash( i + vec3( 1, 0, 1 ) ), f.x ),
                           mix( pnHash( i + vec3( 0, 1, 1 ) ), pnHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 q = vPosPennellata * vec3( 0.9, 2.6, 0.9 );
          float r = pnRumore( q ) * 0.6 + pnRumore( q * 3.1 + 7.3 ) * 0.4;
          diffuseColor.rgb *= 1.0 + ( r - 0.5 ) * 2.0 * uForzaPennellata;
        }`,
      );
  };
  const chiavePrec = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => chiavePrec() + '|pennellata';
}

/** Alone radiale generato in memoria (gradiente morbido, nessuna immagine). */
export function creaTextureAlone(dim = 64): THREE.DataTexture {
  const dati = new Uint8Array(dim * dim * 4);
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const dx = (x + 0.5) / dim - 0.5;
      const dy = (y + 0.5) / dim - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.max(0, 1 - r);
      const v = Math.pow(a, 2.2) * 0.85 + Math.pow(a, 8) * 0.15;
      const i = (y * dim + x) * 4;
      dati[i] = 255;
      dati[i + 1] = 255;
      dati[i + 2] = 255;
      dati[i + 3] = Math.round(v * 255);
    }
  }
  const tex = new THREE.DataTexture(dati, dim, dim, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Crea il set di materiali predefinito. */
export function creaMaterialiPredefiniti(opz: OpzioniMateriali = {}): SetMateriali {
  const mappa = creaMappaToni(opz.toni ?? 3);
  const opaco = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: mappa });
  opaco.name = 'oggetti/opaco';
  const sottile = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: mappa, side: THREE.DoubleSide });
  sottile.name = 'oggetti/sottile';
  if (opz.pennellata ?? true) {
    aggiungiPennellata(opaco);
    aggiungiPennellata(sottile, 0.05);
  }
  const lume = new THREE.MeshBasicMaterial({ vertexColors: true });
  lume.name = 'oggetti/lume';
  const alone = new THREE.SpriteMaterial({
    map: creaTextureAlone(),
    color: 0xffb760,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  alone.name = 'oggetti/alone';
  return { opaco, sottile, lume, alone };
}

/** Materiali correnti (creati alla prima richiesta). */
export function materiali(): SetMateriali {
  if (!correnti) {
    correnti = creaMaterialiPredefiniti();
    applicaIntensita();
  }
  return correnti;
}

/**
 * Sostituisce in tutto o in parte i materiali usati dai generatori successivi.
 * (Gli oggetti già creati mantengono i materiali che avevano.)
 */
export function impostaMateriali(nuovi: Partial<SetMateriali>): void {
  correnti = { ...materiali(), ...nuovi };
  applicaIntensita();
}

/** Ricrea i materiali predefiniti con altre opzioni (es. senza pennellata). */
export function reimpostaMateriali(opz: OpzioniMateriali = {}): void {
  correnti = creaMaterialiPredefiniti(opz);
  applicaIntensita();
}

/**
 * Intensità dei lumi in tutto il mondo: 0 = pieno giorno (vetri spenti, aloni invisibili),
 * 1 = notte (finestre accese, lanterne e Fade che brillano). Valori intermedi per alba e brace.
 */
export function impostaIntensitaLumi(k: number): void {
  intensitaLumi = THREE.MathUtils.clamp(k, 0, 1.5);
  applicaIntensita();
}

export function leggiIntensitaLumi(): number {
  return intensitaLumi;
}

function applicaIntensita(): void {
  if (!correnti) return;
  const k = intensitaLumi;
  const lume = correnti.lume as THREE.MeshBasicMaterial;
  if (lume.color) lume.color.setScalar(THREE.MathUtils.lerp(0.1, 1.0, Math.min(k, 1)) * Math.max(1, k));
  correnti.alone.opacity = Math.min(1, k);
  correnti.alone.visible = k > 0.02;
}

/** Materiale di un canale. */
export function materialePer(canale: Canale): THREE.Material {
  return materiali()[canale];
}
