/**
 * Il catasto nel gioco: il modulo `src/rilievo` (facciata `Catasto`) collegato al motore, alla
 * storia e allo scorrere del tempo.
 *
 * - regole da content/capisaldi.json e fade_fase1.json; `collegaAlMondo` porta le particelle
 *   nella griglia del motore (matita, inchiostro che si allarga dalla stazione) e le varianti
 *   degli elementi mobili agli oggetti; `sincronizzaMondo` dopo un caricamento;
 * - «linea libera?»: un raggio dagli occhi sopra il chiodo al segnale del caposaldo mirato,
 *   campionato ogni 2 m contro il terreno (`groundHeight`) e i collisori;
 * - il tempo: i cicli del giorno degli abitanti; la notte intera quando Elvira dorme
 *   (`notte`), a passi quando veglia (`iniziaNotte` alle 22:00, `avanzaNotte` a ogni minuto,
 *   `chiudiNotte` alle 05:30); `annunciaMosse` alla brace;
 * - gli effetti del catasto vanno alla narrativa nel suo linguaggio (`applicaEffetti`).
 */
import { Vector3 } from 'three';
import fadeJson from '../../content/fade_fase1.json';
import capisaldiJson from '../../content/capisaldi.json';
import {
  Catasto,
  collegaAlMondo,
  regoleDaContenuti,
  sincronizzaMondo,
  type Bersaglio as BersaglioCatasto,
  type DatiPiantaCatasto,
  type EventoCatasto,
  type EsitoVisibilita,
  type FunzioneVisibilita,
  type OggettiVarianti,
  type PuntoMira,
  type RegoleCatasto,
  type Resoconto,
  type RisultatoCatasto,
} from '../rilievo';
import type { Collider, ColliderWorld } from '../world/colliders';
import { cylToWorld, worldToCyl } from '../world/cylinder';
import { groundHeight } from '../world/terrain';
import type { World } from '../world/world';
import { CAPISALDI } from './contenuti';
import { attraversa, type Intervallo } from './orologio';

export interface ContestoTempo {
  /** Particella dove si trova Elvira adesso. */
  cella: number | null;
  /** Elvira dorme (dormi:fino) in questo intervallo. */
  dorme: boolean;
  /** Il personaggio di un ciclo del giorno è al suo posto (Bortolo, Nando, Ottavio). */
  chiPresente?: (chi: string) => boolean;
  /** Flag accesi (per le mosse della Madre, dalla Fase 5). */
  flag?: () => string[];
}

const _p = new Vector3();
const _d = new Vector3();
const _l = new Vector3();

/** Vero se il punto mondo `p` sta dentro il collisore (con un piccolo margine in meno). */
export function dentroCollisore(c: Collider, p: Vector3, margine = 0.05): boolean {
  if (c.kind === 'box') {
    _l.subVectors(p, c.center);
    return Math.abs(_l.dot(c.right)) < c.half.x - margine && Math.abs(_l.dot(c.up)) < c.half.y - margine && Math.abs(_l.dot(c.forward)) < c.half.z - margine;
  }
  _l.subVectors(p, c.base);
  const y = _l.dot(c.up);
  if (y < 0 || y > c.height) return false;
  _l.addScaledVector(c.up, -y);
  return _l.length() < c.radius - margine;
}

const MOTIVI_TAG: Record<string, string> = {
  tronco: 'Un castagno copre la mira.',
  albero: 'Un albero copre la mira.',
  casa: 'Una casa copre la mira.',
  chiesa: 'La chiesa copre la mira.',
  campanile: 'Il campanile copre la mira.',
  muro: 'Un muro copre la mira.',
  tetto: 'Un tetto copre la mira.',
};

/**
 * La funzione «linea libera?» del gioco: un raggio da `da` (occhio sopra la stazione) ad `a`
 * (il segnale), ogni `passo` metri, contro il terreno e i collisori. I primi e gli ultimi 3,5 m
 * non contano (lo squadro e il segnale stanno su muri, pilastri e dentro la cella campanaria);
 * il terreno copre solo se il raggio passa più di `tolleranza` m sotto il suolo (erba, sassi,
 * il ciglio di un muro: la quota del motore è una media).
 */
export function creaLineaLibera(
  colliders: ColliderWorld | null,
  occhio: (p: PuntoMira) => Vector3,
  bersaglio: (p: PuntoMira) => Vector3,
  passo = 2,
  tolleranza = 2.5,
): FunzioneVisibilita {
  const cols: Collider[] = [];
  return (da, a): EsitoVisibilita => {
    const o = occhio(da);
    const s = bersaglio(a);
    const dist = o.distanceTo(s);
    _d.subVectors(s, o).normalize();
    // i collisori che reggono la stazione o il segnale (il muro del chiodo, il campanile) non coprono
    const propri = new Set<number>();
    if (colliders) {
      for (const q of [o, s]) {
        const c = worldToCyl(q);
        for (const col of colliders.query(c.z, c.theta, 4, cols)) if (dentroCollisore(col, q, -1.2)) propri.add(col.id);
      }
    }
    for (let t = 3.5; t < dist - 3.5; t += passo) {
      _p.copy(o).addScaledVector(_d, t);
      const c = worldToCyl(_p);
      if (c.h < groundHeight(c.z, c.theta) - tolleranza) return { libera: false, motivo: 'Il terreno copre la mira.' };
      if (!colliders) continue;
      colliders.query(c.z, c.theta, 3, cols);
      for (const col of cols) {
        if (!propri.has(col.id) && dentroCollisore(col, _p)) return { libera: false, motivo: MOTIVI_TAG[col.tag ?? ''] ?? 'Qualcosa copre la mira.' };
      }
    }
    return true;
  };
}

export class CatastoGioco {
  readonly regole: RegoleCatasto;
  catasto: Catasto;
  private stacca: (() => void) | null = null;
  private staccaEventi: (() => void) | null = null;
  private ascoltatori: ((e: EventoCatasto) => void)[] = [];
  private ultimaCella = -1;
  private ultimoMinutoNotte = -1;
  private mosseAnnunciate = -1;
  /** Seme delle notti (le scelte della Notte dei Termini, dalla Fase 5). */
  seme = 2322;
  /** Funzione di visibilità usata per i lati (sostituibile nei test). */
  lineaLibera: FunzioneVisibilita | undefined;

  constructor(
    private world: World,
    private oggetti: OggettiVarianti,
    private effetti: (e: string[]) => void,
    posizioni: { occhio: (p: PuntoMira) => Vector3; segnale: (p: PuntoMira) => Vector3 },
  ) {
    this.regole = regoleDaContenuti({ capisaldi: capisaldiJson, fade: fadeJson });
    if (this.regole.problemi.length) console.warn('[catasto] contenuti:', this.regole.problemi);
    this.lineaLibera = creaLineaLibera(world.colliders, posizioni.occhio, posizioni.segnale);
    this.catasto = new Catasto(this.regole);
    this.collega();
  }

  /** Una partita nuova: lo stato iniziale dei contenuti. */
  nuovo(): void {
    this.catasto = new Catasto(this.regole);
    this.collega();
  }

  /** Ascolta gli eventi del catasto (resta valido anche quando il catasto si ricrea o si carica). */
  onEvento(fn: (e: EventoCatasto) => void): () => void {
    this.ascoltatori.push(fn);
    return () => (this.ascoltatori = this.ascoltatori.filter((f) => f !== fn));
  }

  private collega(): void {
    this.stacca?.();
    this.staccaEventi?.();
    this.staccaEventi = this.catasto.on('*', (e) => {
      for (const f of this.ascoltatori) f(e);
    });
    this.stacca = collegaAlMondo(this.catasto, { setCellState: (id, s) => this.world.setCellState(id, s), revealCells: (ids, o) => this.world.revealCells(ids, o) }, this.oggetti);
    sincronizzaMondo(this.catasto.stato, { setCellState: (id, s) => this.world.setCellState(id, s), revealCells: () => {} });
    for (const e of this.regole.elementi.keys()) this.oggetti.mostraVariante(e, this.catasto.variante(e) ?? 'Carta', { mostra: [], nascondi: [] });
    this.ultimaCella = -1;
    this.ultimoMinutoNotte = -1;
  }

  private dopo(r: RisultatoCatasto | { effetti: string[] }): void {
    if (r.effetti.length) this.effetti(r.effetti);
  }

  // ---------------------------------------------------------------- di giorno

  /** Elvira passa (a ogni cambio di particella sotto i piedi). */
  passa(z: number, theta: number, cella: number): void {
    if (cella === this.ultimaCella) return;
    this.ultimaCella = cella;
    this.dopo(this.catasto.passa({ z, theta }));
  }

  appunta(bersaglio: BersaglioCatasto, ore: number, osservatore: { z: number; theta: number; altezza: number }): RisultatoCatasto {
    const r = this.catasto.appunta({ bersaglio, ora: ore, osservatore });
    this.dopo(r);
    return r;
  }

  rileva(stazione: string, mira: string, ore: number, giorno: number, senzaFiato = false): RisultatoCatasto {
    const r = this.catasto.rileva({ stazione, mira, ora: ore, giorno, senzaFiato, ...(this.lineaLibera ? { lineaLibera: this.lineaLibera } : {}) });
    this.dopo(r);
    return r;
  }

  segnaVisto(id: string): void {
    this.dopo(this.catasto.segnaCaposaldoVisto(id));
  }

  impostaVariante(elemento: string, variante: string): void {
    this.dopo(this.catasto.impostaVariante(elemento, variante));
  }

  // ---------------------------------------------------------------- tempo e notte

  /**
   * Il tempo scorre fra due istanti assoluti (ore dall'inizio del giorno 1): i cicli del giorno,
   * la brace (annuncio delle mosse), la notte (a passi se Elvira veglia, intera se dorme) e l'alba.
   */
  scorri(iv: Intervallo, ctx: ContestoTempo): void {
    if (iv.a <= iv.da) return;
    // tappe: 05:30 (alba), 19:30 (brace), 22:00 (la notte comincia per chi veglia)
    const tappe = [...new Set([...attraversa(iv, 5.5), ...attraversa(iv, 19.5), ...attraversa(iv, 22)])].sort((x, y) => x - y);
    let t = iv.da;
    for (const tappa of tappe) {
      this.tratto(t, tappa, ctx);
      t = tappa;
      const ore = Math.round((((tappa % 24) + 24) % 24) * 60);
      if (ore === 330) this.alba(ctx);
      else if (ore === 1170) this.brace(ctx, tappa);
      else if (ore === 1320 && !ctx.dorme && !this.catasto.stato.notteInCorso) this.catasto.iniziaNotte({ elvira: { sveglia: true }, seme: this.seme });
    }
    this.tratto(t, iv.a, ctx);
  }

  /** Un tratto senza tappe in mezzo: cicli del giorno o avanzamento della notte. */
  private tratto(da: number, a: number, ctx: ContestoTempo): void {
    if (a <= da) return;
    const oreA = ((a % 24) + 24) % 24;
    const oreDa = ((da % 24) + 24) % 24;
    const notte = this.catasto.stato.notteInCorso;
    if (notte) {
      const minuto = Math.floor(a * 60);
      if (minuto !== this.ultimoMinutoNotte) {
        this.ultimoMinutoNotte = minuto;
        this.catasto.avanzaNotte(oreA, { cella: ctx.cella });
      }
      return;
    }
    if (oreA >= 5.5 && oreA <= 21.5 && a - da < 20) {
      const r = this.catasto.cicliDelGiorno({ da: oreDa, a: oreA, ...(ctx.chiPresente ? { chiPresente: ctx.chiPresente } : {}) });
      this.dopo(r);
    }
  }

  /** Alle 05:30 la notte si chiude (a passi) o si fa tutta (Elvira dormiva). */
  private alba(ctx: ContestoTempo): void {
    if (this.catasto.stato.notteInCorso) this.catasto.chiudiNotte();
    else this.catasto.notte({ elvira: { cella: ctx.cella }, seme: this.seme });
    this.dopo({ effetti: this.catasto.ultimiEffetti });
    this.ultimoMinutoNotte = -1;
  }

  private brace(ctx: ContestoTempo, quando: number): void {
    const giorno = Math.floor(quando / 24) + 1;
    if (this.mosseAnnunciate === giorno) return;
    this.mosseAnnunciate = giorno;
    this.dopo(this.catasto.annunciaMosse({ atto: 'I', ...(ctx.flag ? { flag: ctx.flag() } : {}) }));
  }

  /** Resoconto da mostrare la mattina dopo la sua notte (fino alle 12:00). */
  resocontoDelMattino(giorno: number, ore: number): Resoconto | null {
    const r = this.catasto.ultimoResoconto();
    if (!r || r.giorno + 1 !== giorno || ore >= 12) return null;
    return r;
  }

  pianta(giorno: number, ore: number): DatiPiantaCatasto {
    return this.catasto.pianta({ ora: ore, giorno });
  }

  // ---------------------------------------------------------------- letture e salvataggio

  stato(id: number): 'bianco' | 'matita' | 'colore' {
    return this.catasto.statoParticella(id);
  }

  rilevataDaElvira(id: number): boolean {
    return this.catasto.cellaRilevata(id);
  }

  variante(elemento: string): string {
    return this.catasto.variante(elemento) ?? 'Carta';
  }

  latiChiusi(): string[] {
    return Object.keys(this.catasto.stato.lati);
  }

  salva(): unknown {
    return this.catasto.salva();
  }

  carica(blob: unknown): string[] {
    this.catasto = Catasto.carica(blob, this.regole, { tollerante: true });
    this.collega();
    return [];
  }
}

/** Posizioni dei capisaldi nel mondo del gioco (le quote dei contenuti sono di un terreno precedente). */
export function posizioniCapisaldi(cella: { punto: (id: string) => Vector3 | null; segnale: (id: string) => Vector3 | null }): {
  occhio: (p: PuntoMira) => Vector3;
  segnale: (p: PuntoMira) => Vector3;
} {
  const sulSuolo = (p: PuntoMira, alza: number) => cylToWorld(p.z, p.theta, groundHeight(p.z, p.theta) + alza);
  return {
    occhio: (p) => {
      const ch = p.id ? cella.punto(p.id) : null;
      if (ch) return ch.clone().add(_d.copy(ch).setZ(0).normalize().multiplyScalar(-1.4));
      return sulSuolo(p, 1.5);
    },
    segnale: (p) => {
      const s = p.id ? cella.segnale(p.id) : null;
      if (s) return s.clone();
      const def = CAPISALDI.find((c) => c.id === p.id);
      return sulSuolo(p, Math.max(0.3, (def?.altezza_segnale ?? p.altezzaSegnale ?? 0) * 0.6));
    },
  };
}
