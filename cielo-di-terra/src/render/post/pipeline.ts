/**
 * La post-produzione pittorica. Ordine di un fotogramma (vedi `Game.render`):
 *
 *   1. `inizioMondo()`: il mondo si disegna nel render target HDR (mezzo float, MSAA ad Alta),
 *      con la sua profondità in una texture;
 *   2. `dopoMondo()`: contorni dalla profondità del mondo (prima che la prima persona la
 *      sovrascriva), poi si pulisce la profondità per le sovrapposizioni;
 *   3. il Velo e le `overlay()` della regia (lo squadro in mano) si disegnano nello stesso
 *      render target: passano anche loro dal filtro e dalla mappatura dei toni;
 *   4. `fine()`: bagliore, filtro di Kuwahara, passata finale sul canvas. L'interfaccia HTML
 *      resta sopra, nitida.
 *
 * Tutti i numeri regolabili stanno in `parametri` (vivi: si cambiano anche a gioco avviato,
 * per esempio da `__GAME__.game.post.parametri` nella console di sviluppo).
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { PRESET_QUALITA, type PresetQualita } from './qualita';
import {
  FRAG_BLOOM_GIU,
  FRAG_BLOOM_SOGLIA,
  FRAG_BLOOM_SU,
  FRAG_CONTORNI,
  FRAG_FINALE,
  FRAG_KUWAHARA,
  FRAG_SFOCA,
  FRAG_TENSORE,
  VERT_SCHERMO,
} from './shaders';

/** Le manopole della post (tutte vive). */
export interface ParametriPost {
  /** Esposizione prima della mappatura dei toni. */
  esposizione: number;
  /** 0 spalla pittorica, 1 ACES calibrato, 2 AgX, 3 ACES di giorno e spalla di notte. */
  tonemap: 0 | 1 | 2 | 3;
  /** Da dove la spalla comincia a comprimere (0..1, sul canale più forte). */
  ginocchio: number;
  saturazione: number;
  /** Spinta in più ai colori spenti. */
  vibranza: number;
  /** Contrasto a S (0 = nessuno) attorno a `pernoContrasto`. */
  contrasto: number;
  pernoContrasto: number;
  /** Tinte moltiplicative di luci e ombre, di giorno e di notte. */
  luci: [number, number, number];
  ombre: [number, number, number];
  luciNotte: [number, number, number];
  ombreNotte: [number, number, number];
  /** Viraggio delle luci nelle ore dorate (moltiplica, pesato con `StatoPost.oro`). */
  luciOro: [number, number, number];
  /** Bagliore: forza, soglia di giorno e di notte, ginocchio della soglia. */
  bloom: number;
  /** Tinta del bagliore di giorno e di notte (moltiplica): l'alone caldo della Linea. */
  tintaBagliore: [number, number, number];
  tintaBaglioreNotte: [number, number, number];
  sogliaGiorno: number;
  sogliaNotte: number;
  ginocchioSoglia: number;
  /** Contorni del mondo e della prima persona (0..1). */
  contorni: number;
  contorniPrimoPiano: number;
  /** Soglie dei contorni sulla derivata seconda relativa di 1/z. */
  sogliaContorni: [number, number];
  /** I contorni sfumano fra queste distanze (m) fino a `contorniLontano`. */
  distanzaContorni: [number, number];
  contorniLontano: number;
  /** Kuwahara: durezza e nitidezza della scelta del settore, allungamento delle ellissi. */
  durezza: number;
  nitidezza: number;
  alfa: number;
  /** Il raggio del filtro si stringe sotto questa distanza (m): da [0] a [1] torna pieno. */
  vicino: [number, number];
  /** Fra [0] e [1] metri il raggio del filtro cresce fino a [2] volte: il fondo a pennellate larghe. */
  lontano: [number, number, number];
  /**
   * Dettagli salvati dal filtro: sopra questo contrasto (luminanza compressa, da [0] a [1]) il
   * pixel originale torna sopra la pittura per la frazione [2] (tratti, finestrelle, stelle).
   */
  dettaglio: [number, number, number];
  /** Pennellata, grana fine e macchie della carta. */
  pennellata: number;
  /** Variazione calda/fredda del colore lungo le pennellate. */
  pennellataColore: number;
  /** Tremolio della mano sui bordi: ampiezza e scala, in pixel a 1080p (0 = spento). */
  tremolio: [number, number];
  grana: number;
  macchie: number;
  /** Vignettatura: colore (moltiplica) e forza. */
  vignetta: [number, number, number];
  forzaVignetta: number;
}

export const PARAMETRI_PREDEFINITI: ParametriPost = {
  esposizione: 1,
  tonemap: 3,
  ginocchio: 0.82,
  // (con l'albedo del prato già spento basta meno spinta: il prato non torna limone)
  saturazione: 1.06,
  vibranza: 0.12,
  contrasto: 0.22,
  pernoContrasto: 0.42,
  luci: [1.03, 1.0, 0.955],
  ombre: [0.96, 0.975, 1.05],
  luciNotte: [1.05, 1.0, 0.93],
  ombreNotte: [0.97, 0.97, 1.07],
  luciOro: [1.08, 1.0, 0.86],
  bloom: 0.5,
  tintaBagliore: [1.0, 0.88, 0.7],
  tintaBaglioreNotte: [1.0, 0.96, 0.9],
  sogliaGiorno: 1.0,
  sogliaNotte: 0.7,
  ginocchioSoglia: 0.3,
  // (contorni leggeri e solo vicino: i bozzetti sono dipinti senza linee; l'inchiostro pieno resta
  // sul fronte della rivelazione, nello shader del mondo, e sulla prima persona)
  contorni: 0.35,
  contorniPrimoPiano: 0.5,
  sogliaContorni: [0.03, 0.12],
  distanzaContorni: [30, 250],
  contorniLontano: 0.05,
  durezza: 8,
  nitidezza: 8,
  alfa: 2,
  vicino: [1.5, 9],
  lontano: [80, 450, 1.15],
  dettaglio: [0.05, 0.16, 0.85],
  pennellata: 0.085,
  pennellataColore: 0.05,
  tremolio: [1.4, 26],
  grana: 0.05,
  macchie: 0.035,
  vignetta: [0.74, 0.66, 0.7],
  forzaVignetta: 0.32,
};

/** Quello che la post deve sapere del cielo per la soglia del bagliore e il viraggio. */
export interface StatoPost {
  notte: number;
  /** 0..1 ore dorate (alba e tramonto): viraggio caldo delle luci (`luciOro`). */
  oro?: number;
}

const TRIANGOLO = (() => {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
})();
const CAMERA = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

function passo(frag: string, uniforms: Record<string, { value: unknown }>, defines: Record<string, string> = {}): Mesh<BufferGeometry, ShaderMaterial> {
  const mat = new ShaderMaterial({ vertexShader: VERT_SCHERMO, fragmentShader: frag, uniforms, defines, depthTest: false, depthWrite: false });
  const m = new Mesh(TRIANGOLO, mat);
  m.frustumCulled = false;
  return m;
}

function nero(): DataTexture {
  const t = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat, UnsignedByteType);
  t.needsUpdate = true;
  return t;
}

export class PostProduzione {
  readonly parametri: ParametriPost = structuredClone(PARAMETRI_PREDEFINITI);
  private presetCorrente: PresetQualita = PRESET_QUALITA.media;
  /** Render target del mondo (HDR) con la profondità. */
  private scena: WebGLRenderTarget | null = null;
  private info: WebGLRenderTarget | null = null;
  private tensoreA: WebGLRenderTarget | null = null;
  private tensoreB: WebGLRenderTarget | null = null;
  private pittura: WebGLRenderTarget | null = null;
  private bloom: WebGLRenderTarget[] = [];
  private readonly nero = nero();
  /** Pixel del mondo (risoluzione interna) e del canvas. */
  readonly interna = new Vector2(1, 1);
  readonly uscita = new Vector2(1, 1);
  private chiamatePrimaOverlay = 0;
  private sporco = true;
  private readonly texel = new Vector2();
  private near = 0.3;
  private far = 6000;
  /** Vero se il render target può essere mezzo float (EXT_color_buffer_float). */
  readonly hdr: boolean;
  /**
   * Solo per le misure (`__GAME__.misuraPassi()`): se c'è, ogni fase è cronometrata con una
   * sincronizzazione prima e dopo, e i millisecondi si sommano in `tempi`.
   */
  cronometro: { sync: () => void; tempi: Record<string, number> } | null = null;

  private readonly pContorni = passo(FRAG_CONTORNI, {
    tDepth: { value: null },
    uTexel: { value: new Vector2() },
    uNearFar: { value: new Vector2() },
    uSpessore: { value: 1 },
    uSoglie: { value: new Vector4() },
    uLontano: { value: 0.3 },
  });
  private readonly pSoglia = passo(FRAG_BLOOM_SOGLIA, { tSrc: { value: null }, uTexel: { value: new Vector2() }, uSoglia: { value: new Vector3(1, 0.3, 16) } });
  private readonly pGiu = passo(FRAG_BLOOM_GIU, { tSrc: { value: null }, uTexel: { value: new Vector2() } });
  private readonly pSu = passo(FRAG_BLOOM_SU, { tSrc: { value: null }, uTexel: { value: new Vector2() }, uPeso: { value: 1 } });
  private readonly pTensore = passo(FRAG_TENSORE, { tSrc: { value: null }, uTexel: { value: new Vector2() } });
  private readonly pSfoca = passo(FRAG_SFOCA, { tSrc: { value: null }, uDir: { value: new Vector2() } });
  private pKuwahara = this.creaKuwahara(false, 4);
  private readonly pFinale = passo(FRAG_FINALE, {
    tPaint: { value: null },
    tScena: { value: null },
    tBloom: { value: null },
    tInfo: { value: null },
    tDepth: { value: null },
    tTensore: { value: null },
    uTexelIn: { value: new Vector2() },
    uTexelPaint: { value: new Vector2() },
    uFiltro: { value: new Vector2() },
    uDettaglio: { value: new Vector3() },
    uRisoluzione: { value: new Vector2() },
    uOverlay: { value: 0 },
    uFxaa: { value: 0 },
    uBloom: { value: 0.5 },
    uTintaBagliore: { value: new Vector3(1, 1, 1) },
    uContorni: { value: new Vector2() },
    uOrientata: { value: 0 },
    uCarta: { value: new Vector3() },
    uTremolio: { value: new Vector3() },
    uVignetta: { value: new Vector4() },
    uEsposizione: { value: 1 },
    uTonemap: { value: 0 },
    uGinocchio: { value: 0.8 },
    uGrade: { value: new Vector4() },
    uLuci: { value: new Vector3(1, 1, 1) },
    uOmbre: { value: new Vector3(1, 1, 1) },
    uNotte: { value: 0 },
  });

  constructor(private readonly renderer: WebGLRenderer) {
    this.pSu.material.blending = AdditiveBlending;
    this.pSu.material.transparent = true;
    this.hdr = renderer.capabilities.isWebGL2 !== false && renderer.extensions.has('EXT_color_buffer_float');
  }

  get preset(): PresetQualita {
    return this.presetCorrente;
  }

  /** Il render target del mondo (per chi deve disegnarci sopra). */
  get target(): WebGLRenderTarget | null {
    return this.scena;
  }

  /** Cambia preset: i render target si rifanno alla prossima `setSize` o al prossimo fotogramma. */
  setPreset(p: PresetQualita): void {
    if (p !== this.presetCorrente) this.sporco = true;
    this.presetCorrente = p;
  }

  /**
   * Dimensioni: `cssW × cssH` pixel CSS; `dprCanvas` è il rapporto del canvas (già impostato sul
   * renderer), `dpr` quello del dispositivo. La risoluzione interna segue il preset.
   */
  setSize(cssW: number, cssH: number, dprCanvas: number, dpr: number): void {
    const p = this.presetCorrente;
    const k = Math.min(dpr, p.maxPixelRatio) * p.scala;
    const iw = Math.max(1, Math.round(cssW * k));
    const ih = Math.max(1, Math.round(cssH * k));
    this.uscita.set(Math.max(1, Math.round(cssW * dprCanvas)), Math.max(1, Math.round(cssH * dprCanvas)));
    if (iw === this.interna.x && ih === this.interna.y && this.scena && !this.sporco) return;
    this.interna.set(iw, ih);
    this.creaTarget();
  }

  private creaTarget(): void {
    this.sporco = false;
    this.liberaTarget();
    const { x: w, y: h } = this.interna;
    const p = this.presetCorrente;
    const tipo = this.hdr ? HalfFloatType : UnsignedByteType;
    const depthTexture = new DepthTexture(w, h, UnsignedIntType);
    depthTexture.minFilter = NearestFilter;
    depthTexture.magFilter = NearestFilter;
    this.scena = new WebGLRenderTarget(w, h, {
      type: tipo,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      depthTexture,
      samples: this.hdr ? p.msaa : 0,
    });
    this.scena.texture.name = 'post-scena';
    if (p.contorni || p.filtro !== 'nessuno') {
      this.info = new WebGLRenderTarget(w, h, { type: UnsignedByteType, format: RGBAFormat, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    }
    const mw = Math.max(1, Math.round(w / 2));
    const mh = Math.max(1, Math.round(h / 2));
    if (p.filtro === 'anisotropico') {
      // il tensore di struttura (filtro anisotropico e pennellata orientata): a metà
      // risoluzione basta, tanto si sfoca
      const opz = { type: tipo, format: RGBAFormat, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter };
      this.tensoreA = new WebGLRenderTarget(mw, mh, opz);
      this.tensoreB = new WebGLRenderTarget(mw, mh, opz);
    }
    if (p.filtro !== 'nessuno') {
      const [pw, ph] = p.mezzaRisoluzione ? [mw, mh] : [w, h];
      this.pittura = new WebGLRenderTarget(pw, ph, { type: tipo, format: RGBAFormat, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    }
    let bw = w;
    let bh = h;
    for (let i = 0; i < p.bloom; i++) {
      bw = Math.max(1, Math.round(bw / 2));
      bh = Math.max(1, Math.round(bh / 2));
      this.bloom.push(new WebGLRenderTarget(bw, bh, { type: tipo, format: RGBAFormat, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter }));
    }
    this.aggiornaKuwahara();
  }

  private liberaTarget(): void {
    this.scena?.depthTexture?.dispose();
    this.scena?.dispose();
    this.info?.dispose();
    this.tensoreA?.dispose();
    this.tensoreB?.dispose();
    this.pittura?.dispose();
    for (const b of this.bloom) b.dispose();
    this.scena = this.info = this.tensoreA = this.tensoreB = this.pittura = null;
    this.bloom = [];
  }

  /** Raggio del filtro in pixel della sua risoluzione (metà, se il filtro lavora a metà). */
  get raggioPixel(): number {
    const p = this.presetCorrente;
    const r = (p.raggio * this.interna.y) / 1080 / (p.mezzaRisoluzione ? 2 : 1);
    return Math.min(8, Math.max(1.5, r));
  }

  private creaKuwahara(aniso: boolean, rmax: number): Mesh<BufferGeometry, ShaderMaterial> {
    const defines: Record<string, string> = { RMAX: String(rmax) };
    if (aniso) defines.ANISOTROPO = '';
    return passo(FRAG_KUWAHARA, {
      tSrc: { value: null },
      tInfo: { value: null },
      tDepth: { value: null },
      tTensore: { value: null },
      uTexel: { value: new Vector2() },
      uNearFar: { value: new Vector2() },
      uRaggio: { value: 3 },
      uVicino: { value: new Vector2() },
      uLontano: { value: new Vector3(80, 450, 1) },
      uOverlay: { value: 0 },
      uDurezza: { value: 8 },
      uNitidezza: { value: 8 },
      uAlfa: { value: 2 },
    }, defines);
  }

  /** Raggio massimo (pixel) per cui la shader del filtro è compilata. */
  private rmaxKuwahara = 4;

  private aggiornaKuwahara(): void {
    const p = this.presetCorrente;
    if (p.filtro === 'nessuno') return;
    const aniso = p.filtro === 'anisotropico';
    // posto anche per il raggio più largo del fondo (`parametri.lontano`)
    const rmax = Math.ceil(this.raggioPixel * Math.max(1, this.parametri.lontano[2]));
    this.rmaxKuwahara = rmax;
    const d = this.pKuwahara.material.defines as Record<string, string>;
    if (d.RMAX !== String(rmax) || ('ANISOTROPO' in d) !== aniso) {
      this.pKuwahara.material.dispose();
      this.pKuwahara = this.creaKuwahara(aniso, rmax);
    }
  }

  // ------------------------------------------------------------------ il fotogramma

  /** Esegue una fase del fotogramma (cronometrata se c'è il cronometro). */
  fase(nome: string, fn: () => void): void {
    const c = this.cronometro;
    if (!c) {
      fn();
      return;
    }
    c.sync();
    const t0 = performance.now();
    fn();
    c.sync();
    c.tempi[nome] = (c.tempi[nome] ?? 0) + performance.now() - t0;
  }

  /** Lega il render target del mondo e lo pulisce (col colore di sfondo del renderer). */
  inizioMondo(): void {
    if (!this.scena || this.sporco) this.creaTarget();
    this.renderer.setRenderTarget(this.scena);
    this.renderer.clear();
  }

  /** Dopo il mondo: contorni dalla sua profondità, poi profondità pulita per la prima persona. */
  dopoMondo(camera: PerspectiveCamera): void {
    const r = this.renderer;
    const s = this.scena!;
    this.near = camera.near;
    this.far = camera.far;
    if (this.info) this.fase('contorni', () => {
      const u = this.pContorni.material.uniforms;
      const P = this.parametri;
      u.tDepth!.value = s.depthTexture;
      (u.uTexel!.value as Vector2).set(1 / this.interna.x, 1 / this.interna.y);
      (u.uNearFar!.value as Vector2).set(this.near, this.far);
      u.uSpessore!.value = Math.max(1, this.interna.y / 900);
      (u.uSoglie!.value as Vector4).set(P.sogliaContorni[0], P.sogliaContorni[1], P.distanzaContorni[0], P.distanzaContorni[1]);
      u.uLontano!.value = P.contorniLontano;
      if (!this.presetCorrente.contorni) (u.uSoglie!.value as Vector4).set(1e9, 2e9, 1, 2);
      r.setRenderTarget(this.info!);
      r.render(this.pContorni, CAMERA);
    });
    r.setRenderTarget(s);
    r.clearDepth();
    this.chiamatePrimaOverlay = r.info.render.calls;
  }

  /** Bagliore, filtro, passata finale sul canvas. */
  fine(stato: StatoPost): void {
    const r = this.renderer;
    const s = this.scena!;
    const P = this.parametri;
    const p = this.presetCorrente;
    const overlay = r.info.render.calls > this.chiamatePrimaOverlay ? 1 : 0;
    const texel = this.texel.set(1 / this.interna.x, 1 / this.interna.y);

    // --- bagliore
    let bloomTex: Texture = this.nero;
    if (this.bloom.length) this.fase('bagliore', () => {
      const b0 = this.bloom[0]!;
      const us = this.pSoglia.material.uniforms;
      us.tSrc!.value = s.texture;
      (us.uTexel!.value as Vector2).copy(texel);
      const soglia = P.sogliaGiorno + (P.sogliaNotte - P.sogliaGiorno) * stato.notte;
      (us.uSoglia!.value as Vector3).set(this.hdr ? soglia : Math.min(soglia, 0.8), P.ginocchioSoglia, 16);
      r.setRenderTarget(b0);
      r.render(this.pSoglia, CAMERA);
      const ug = this.pGiu.material.uniforms;
      for (let i = 1; i < this.bloom.length; i++) {
        const src = this.bloom[i - 1]!;
        ug.tSrc!.value = src.texture;
        (ug.uTexel!.value as Vector2).set(1 / src.width, 1 / src.height);
        r.setRenderTarget(this.bloom[i]!);
        r.render(this.pGiu, CAMERA);
      }
      const uu = this.pSu.material.uniforms;
      for (let i = this.bloom.length - 2; i >= 0; i--) {
        const src = this.bloom[i + 1]!;
        uu.tSrc!.value = src.texture;
        (uu.uTexel!.value as Vector2).set(1 / src.width, 1 / src.height);
        uu.uPeso!.value = 1;
        r.setRenderTarget(this.bloom[i]!);
        r.render(this.pSu, CAMERA);
      }
      bloomTex = b0.texture;
    });

    // --- tensore di struttura (filtro anisotropico e pennellata orientata)
    let tensore: Texture = this.nero;
    const tA = this.tensoreA;
    const tB = this.tensoreB;
    if (tA && tB) this.fase('tensore', () => {
      const ut = this.pTensore.material.uniforms;
      ut.tSrc!.value = s.texture;
      (ut.uTexel!.value as Vector2).copy(texel);
      r.setRenderTarget(tA);
      r.render(this.pTensore, CAMERA);
      const uf = this.pSfoca.material.uniforms;
      uf.tSrc!.value = tA.texture;
      (uf.uDir!.value as Vector2).set(1 / tA.width, 0);
      r.setRenderTarget(tB);
      r.render(this.pSfoca, CAMERA);
      uf.tSrc!.value = tB.texture;
      (uf.uDir!.value as Vector2).set(0, 1 / tA.height);
      r.setRenderTarget(tA);
      r.render(this.pSfoca, CAMERA);
      tensore = tA.texture;
    });

    // --- filtro pittorico
    let pittura: Texture = s.texture;
    const pit = this.pittura;
    if (pit && p.filtro !== 'nessuno') this.fase('kuwahara', () => {
      const uk = this.pKuwahara.material.uniforms;
      uk.tSrc!.value = s.texture;
      uk.tInfo!.value = this.info ? this.info.texture : this.nero;
      uk.tDepth!.value = s.depthTexture;
      uk.tTensore!.value = tensore;
      // a metà risoluzione si campiona il mondo a passi di due pixel (la lettura bilineare
      // fra quattro pixel fa da media 2×2)
      (uk.uTexel!.value as Vector2).set(1 / pit.width, 1 / pit.height);
      (uk.uNearFar!.value as Vector2).set(this.near, this.far);
      uk.uRaggio!.value = this.raggioPixel;
      (uk.uVicino!.value as Vector2).set(P.vicino[0], P.vicino[1]);
      // il raggio largo del fondo non può superare il limite dei cicli (RMAX) della shader
      const lmax = Math.min(P.lontano[2], this.rmaxKuwahara / Math.max(this.raggioPixel, 1e-3));
      (uk.uLontano!.value as Vector3).set(P.lontano[0], P.lontano[1], Math.max(1, lmax));
      uk.uOverlay!.value = overlay;
      uk.uDurezza!.value = P.durezza;
      uk.uNitidezza!.value = P.nitidezza;
      uk.uAlfa!.value = P.alfa;
      r.setRenderTarget(pit);
      r.render(this.pKuwahara, CAMERA);
      pittura = pit.texture;
    });

    // --- finale
    const u = this.pFinale.material.uniforms;
    u.tPaint!.value = pittura;
    u.tScena!.value = s.texture;
    (u.uTexelPaint!.value as Vector2).set(1 / (this.pittura?.width ?? this.interna.x), 1 / (this.pittura?.height ?? this.interna.y));
    (u.uFiltro!.value as Vector2).set(pittura !== s.texture ? 1 : 0, p.mezzaRisoluzione ? 1 : 0);
    (u.uDettaglio!.value as Vector3).set(...P.dettaglio);
    u.tBloom!.value = bloomTex;
    u.tInfo!.value = this.info ? this.info.texture : this.nero;
    u.tDepth!.value = s.depthTexture;
    u.tTensore!.value = tensore;
    (u.uTexelIn!.value as Vector2).copy(texel);
    (u.uRisoluzione!.value as Vector2).copy(this.uscita);
    u.uOverlay!.value = overlay;
    u.uFxaa!.value = p.fxaa ? 1 : 0;
    u.uBloom!.value = this.bloom.length ? P.bloom : 0;
    (u.uTintaBagliore!.value as Vector3).copy(mix3(P.tintaBagliore, P.tintaBaglioreNotte, stato.notte, _v3));
    (u.uContorni!.value as Vector2).set(p.contorni ? P.contorni : 0, p.contorni ? P.contorniPrimoPiano : 0);
    u.uOrientata!.value = this.tensoreA ? 1 : 0;
    (u.uCarta!.value as Vector3).set(p.pennellata ? P.pennellata : 0, P.grana * (p.pennellata ? 1 : 0.6), P.macchie);
    (u.uTremolio!.value as Vector3).set(p.pennellata ? P.tremolio[0] : 0, Math.max(1, P.tremolio[1]), p.pennellata ? P.pennellataColore : 0);
    (u.uVignetta!.value as Vector4).set(P.vignetta[0], P.vignetta[1], P.vignetta[2], P.forzaVignetta);
    u.uEsposizione!.value = P.esposizione;
    u.uTonemap!.value = P.tonemap;
    u.uGinocchio!.value = P.ginocchio;
    const n = stato.notte;
    // di notte quasi tutto sta sotto il perno: il contrasto a S scurirebbe, quindi cala
    (u.uGrade!.value as Vector4).set(P.saturazione, P.vibranza, P.contrasto * (1 - 0.7 * n), P.pernoContrasto);
    const luci = (u.uLuci!.value as Vector3).copy(mix3(P.luci, P.luciNotte, n, _v3));
    // ore dorate: le luci virano al caldo (la notte lo spegne)
    const oro = Math.max(0, Math.min(1, stato.oro ?? 0)) * (1 - n);
    luci.multiply(mix3(UNO, P.luciOro, oro, _v3));
    (u.uOmbre!.value as Vector3).copy(mix3(P.ombre, P.ombreNotte, n, _v3));
    u.uNotte!.value = n;
    this.fase('finale', () => {
      r.setRenderTarget(null);
      r.render(this.pFinale, CAMERA);
    });
  }

  dispose(): void {
    this.liberaTarget();
    for (const m of [this.pContorni, this.pSoglia, this.pGiu, this.pSu, this.pTensore, this.pSfoca, this.pKuwahara, this.pFinale]) m.material.dispose();
    this.nero.dispose();
  }
}

const UNO = [1, 1, 1] as const;
const _v3 = new Vector3();

/** Mescola due terne in `out` (niente allocazioni a ogni fotogramma). */
function mix3(a: readonly number[], b: readonly number[], t: number, out: Vector3): Vector3 {
  return out.set(a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t);
}
