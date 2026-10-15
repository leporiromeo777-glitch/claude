/**
 * Tempo GPU dei fotogrammi con EXT_disjoint_timer_query_webgl2, quando il browser lo offre
 * (Chrome sul desktop di solito sì). Serve alla qualità automatica: misura il lavoro della scheda
 * anche quando il browser limita i fotogrammi (risparmio energetico a 30 fps, vsync).
 */
interface EstensioneTempo {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export class TempoGpu {
  private readonly ext: EstensioneTempo | null;
  private libere: WebGLQuery[] = [];
  private inVolo: WebGLQuery[] = [];
  private corrente: WebGLQuery | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    let ext: EstensioneTempo | null = null;
    try {
      ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as EstensioneTempo | null;
    } catch {
      ext = null;
    }
    this.ext = ext;
  }

  get disponibile(): boolean {
    return this.ext !== null;
  }

  inizio(): void {
    if (!this.ext || this.corrente || this.inVolo.length > 6) return;
    const q = this.libere.pop() ?? this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.corrente = q;
  }

  fine(): void {
    if (!this.ext || !this.corrente) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.inVolo.push(this.corrente);
    this.corrente = null;
  }

  /** Millisecondi dei fotogrammi già conclusi dalla GPU (in ordine). */
  raccogli(): number[] {
    const out: number[] = [];
    if (!this.ext) return out;
    const gl = this.gl;
    const disgiunto = !!gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.inVolo.length) {
      const q = this.inVolo[0]!;
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.inVolo.shift();
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      if (!disgiunto) out.push(ns / 1e6);
      this.libere.push(q);
    }
    return out;
  }

  dispose(): void {
    for (const q of [...this.libere, ...this.inVolo]) this.gl.deleteQuery(q);
    this.libere = [];
    this.inVolo = [];
  }
}
