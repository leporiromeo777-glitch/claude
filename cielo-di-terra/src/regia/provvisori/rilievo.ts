/**
 * SEGNAPOSTO del modulo `rilievo` (in lavorazione): un catasto minimo che basta alla Fase 1.
 *
 * - Stati iniziali: le 228 particelle dell'area da fade_fase1.json, il resto a matita
 *   (le Finestre a colore: sono vetro).
 * - Rilievo: un lato si chiude se è in capisaldi.json → lati ed è `chiudibile`; il ventaglio
 *   è quello precalcolato. Il motivo dei lati bloccati viene da `non_visibile_da`.
 * - Notte: le regole 3 e 4 di fade_fase1.json (giro delle Fade sugli elementi mobili non
 *   rilevati, mai la particella dove sta Elvira), i cicli del giorno degli abitanti, il
 *   resoconto del mattino con le righe del file, i flag `notte_su_E1` e `taccuino_spostato`.
 *
 * Quando arriva il modulo vero, la regia gli parla con la stessa `PortaRilievo`.
 */
import { CELL_DEG, CELL_DZ, CELLS_NTHETA, CELLS_NZ } from '../../world/constants';
import { surfaceDistance } from '../../world/cylinder';
import { stripAt } from '../../world/terrain';
import { Emettitore } from '../../narrativa';
import {
  CAPISALDI,
  ELEMENTI_MOBILI,
  LATI,
  NOTTI,
  PARTICELLE_AREA,
  RESOCONTO,
  caposaldo,
  oreDa,
  testoOra,
  type ElementoMobile,
} from '../contenuti';
import type { Intervallo } from '../orologio';
import type {
  CambioVariante,
  ContestoNotte,
  EsitoCollimazione,
  EventiRilievo,
  PortaRilievo,
  Resoconto,
  SegnaleNotte,
  StatoCella,
} from '../porte';

const N = CELLS_NZ * CELLS_NTHETA;
const CODICE: Record<StatoCella, number> = { bianco: 0, matita: 1, colore: 2 };
const STATO: StatoCella[] = ['bianco', 'matita', 'colore'];

interface StatoSalvato {
  versione: 1;
  stati: Record<number, StatoCella>;
  rilevate: Record<number, string>;
  lati: string[];
  varianti: Record<string, string>;
  resoconto: Resoconto | null;
  notteCorrente: { notte: number; cambi: CambioVariante[]; rimaste: string[] } | null;
}

/** Numero della notte che contiene il tempo assoluto `t` (la notte N comincia alle 21:00 del giorno N). */
export function notteDi(t: number): number {
  const giorno = Math.floor(t / 24) + 1;
  const ore = t - (giorno - 1) * 24;
  return ore >= 12 ? giorno : giorno - 1;
}

export class RilievoProvvisorio implements PortaRilievo {
  readonly eventi = new Emettitore<EventiRilievo>();
  private stati = new Uint8Array(N);
  private rilevate = new Map<number, string>();
  private lati = new Set<string>();
  private varianti = new Map<string, string>();
  private ultimo: Resoconto | null = null;
  /** Cambi raccolti durante la notte in corso. */
  private notteCorrente: { notte: number; cambi: CambioVariante[]; rimaste: string[] } | null = null;
  private iniziali = new Uint8Array(N);

  constructor() {
    for (let id = 0; id < N; id++) {
      const theta = ((id % CELLS_NTHETA) + 0.5) * CELL_DEG;
      this.stati[id] = stripAt(theta).kind === 'finestra' ? 2 : 1;
    }
    for (const p of PARTICELLE_AREA) {
      const s = (p.stato_iniziale ?? 'matita') as StatoCella;
      this.stati[p.id] = CODICE[s] ?? 1;
      if (p.rilevata_da) this.rilevate.set(p.id, /G4/.test(p.rilevata_da) ? 'G4' : p.rilevata_da);
    }
    this.iniziali.set(this.stati);
    for (const e of ELEMENTI_MOBILI) this.varianti.set(e.id, e.variante_iniziale);
  }

  statoCella(id: number): StatoCella {
    return STATO[this.stati[id] ?? 1] ?? 'matita';
  }

  rilevataDa(id: number): string | null {
    return this.rilevate.get(id) ?? null;
  }

  *tutteLeCelle(): Iterable<[number, StatoCella]> {
    for (let id = 0; id < N; id++) yield [id, STATO[this.stati[id]!]!];
  }

  private imposta(ids: number[], stato: StatoCella, motivo: EventiRilievo['celle']['motivo'], origine: { z: number; theta: number } | null): number[] {
    const cambiate: number[] = [];
    for (const id of ids) {
      if (id < 0 || id >= N) continue;
      if (this.stati[id] === CODICE[stato]) continue;
      this.stati[id] = CODICE[stato];
      cambiate.push(id);
    }
    if (cambiate.length) this.eventi.emit('celle', { ids: cambiate, stato, origine, motivo });
    return cambiate;
  }

  collima(stazione: string, mira: string, _ore: number): EsitoCollimazione {
    const lato = LATI.find((l) => (l.a === stazione && l.b === mira) || (l.a === mira && l.b === stazione));
    const cMira = caposaldo(mira);
    const blocco = cMira?.non_visibile_da?.find((n) => n.id === stazione) ?? caposaldo(stazione)?.non_visibile_da?.find((n) => n.id === mira);
    if (!lato) return { esito: 'nessun_lato', motivo: blocco?.motivo ?? 'Da qui non si vede.' };
    if (!lato.chiudibile) return { esito: 'non_visibile', lato: lato.id, motivo: blocco?.motivo ?? lato.nota ?? 'Non si vede.' };
    if (this.lati.has(lato.id)) return { esito: 'gia_chiuso', lato: lato.id, particelle: lato.particelle };
    const primo = this.lati.size === 0;
    this.lati.add(lato.id);
    for (const id of lato.particelle) if (!this.rilevate.has(id) || this.rilevate.get(id) !== 'G5') this.rilevate.set(id, 'G5');
    const st = caposaldo(stazione) ?? CAPISALDI[0]!;
    this.imposta(lato.particelle, 'colore', 'rilievo', { z: st.z, theta: st.theta });
    return { esito: 'chiuso', lato: lato.id, particelle: lato.particelle, primoDelFoglio: primo };
  }

  appunta(cella: number): boolean {
    if (this.stati[cella] !== 0) return false;
    this.imposta([cella], 'matita', 'appunto', null);
    return true;
  }

  passaggio(z: number, theta: number): void {
    const iz0 = Math.max(0, Math.floor((z - 60) / CELL_DZ));
    const iz1 = Math.min(CELLS_NZ - 1, Math.floor((z + 60) / CELL_DZ));
    const nuove: number[] = [];
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let k = -3; k <= 3; k++) {
        const it = (((Math.floor(theta / CELL_DEG) + k) % CELLS_NTHETA) + CELLS_NTHETA) % CELLS_NTHETA;
        const id = iz * CELLS_NTHETA + it;
        if (this.stati[id] !== 0) continue;
        if (surfaceDistance(z, theta, (iz + 0.5) * CELL_DZ, (it + 0.5) * CELL_DEG) <= 60) nuove.push(id);
      }
    }
    if (nuove.length) this.imposta(nuove, 'matita', 'passaggio', null);
  }

  latiChiusi(): string[] {
    return [...this.lati];
  }

  variante(elemento: string): string {
    return this.varianti.get(elemento) ?? 'Carta';
  }

  impostaVariante(elemento: string, variante: string, chi: CambioVariante['chi'], quando: number): void {
    const da = this.variante(elemento);
    if (da === variante) return;
    this.varianti.set(elemento, variante);
    this.eventi.emit('variante', { elemento, da, a: variante, quando, chi });
  }

  private rilevato(e: ElementoMobile): boolean {
    return e.particelle.every((id) => this.stati[id] === 2);
  }

  /** Eventi programmati fra due tempi assoluti, in ordine. */
  private programma(intervallo: Intervallo): { t: number; fai: (ctx: ContestoNotte, out: SegnaleNotte[]) => void }[] {
    const lista: { t: number; fai: (ctx: ContestoNotte, out: SegnaleNotte[]) => void }[] = [];
    const g0 = Math.floor(intervallo.da / 24);
    const g1 = Math.floor(intervallo.a / 24);
    const dentro = (t: number) => t > intervallo.da && t <= intervallo.a;
    for (let g = g0; g <= g1; g++) {
      for (const e of ELEMENTI_MOBILI) {
        for (const c of e.cicli_del_giorno ?? []) {
          const t = g * 24 + oreDa(c.ora);
          if (dentro(t)) lista.push({ t, fai: (_ctx, out) => this.ciclo(e, c.da, c.a, t, out) });
        }
        if (e.ora_fade) {
          const t = g * 24 + oreDa(e.ora_fade);
          if (dentro(t)) lista.push({ t, fai: (ctx, out) => this.passaggioFade(e, t, ctx, out) });
        }
      }
      // inizio della notte (21:00): si apre il registro dei cambi
      const tNotte = g * 24 + 21;
      if (dentro(tNotte)) lista.push({ t: tNotte, fai: () => (this.notteCorrente = { notte: g + 1, cambi: [], rimaste: [] }) });
      // fine della notte (05:30): il resoconto del mattino
      const tAlba = g * 24 + 5.5;
      if (dentro(tAlba)) lista.push({ t: tAlba, fai: () => this.chiudiNotte(g) });
      // la Pesarina
      for (const n of NOTTI) {
        if (!n.pesarina) continue;
        const t = g * 24 + oreDa(n.pesarina.ora);
        if (dentro(t) && notteDi(t) >= 1) {
          lista.push({
            t,
            fai: (ctx, out) => {
              const notte = notteDi(t);
              if (notte !== n.notte) return;
              out.push({ tipo: 'pesarina', notte });
              if (n.pesarina?.flag && ctx.dorme) out.push({ tipo: 'flag', nome: n.pesarina.flag });
            },
          });
        }
      }
    }
    return lista.sort((a, b) => a.t - b.t);
  }

  private ciclo(e: ElementoMobile, da: string, a: string, t: number, out: SegnaleNotte[]): void {
    if (this.variante(e.id) !== da) return;
    this.varianti.set(e.id, a);
    const cambio: CambioVariante = { elemento: e.id, da, a, quando: t, chi: 'abitante' };
    this.eventi.emit('variante', cambio);
    out.push({ tipo: 'variante', cambio });
  }

  private passaggioFade(e: ElementoMobile, t: number, ctx: ContestoNotte, out: SegnaleNotte[]): void {
    const notte = notteDi(t);
    if (!this.notteCorrente || this.notteCorrente.notte !== notte) this.notteCorrente = { notte, cambi: [], rimaste: [] };
    if (this.rilevato(e)) {
      this.notteCorrente.rimaste.push(e.id);
      out.push({ tipo: 'passaggio', elemento: e.id, protetto: 'rilevato', quando: t });
      return;
    }
    if (ctx.elviraSu(e.particelle)) {
      out.push({ tipo: 'passaggio', elemento: e.id, protetto: 'elvira', quando: t });
      if (notte === 1) out.push({ tipo: 'flag', nome: `notte_su_${e.id}` });
      return;
    }
    const da = this.variante(e.id);
    let a = 'Carta';
    if (e.stadi?.length) {
      const i = e.stadi.indexOf(da);
      a = i >= 0 && i < e.stadi.length - 1 ? e.stadi[i + 1]! : e.stadi[e.stadi.length - 1]!;
    }
    out.push({ tipo: 'passaggio', elemento: e.id, protetto: null, quando: t });
    if (a === da) return;
    this.varianti.set(e.id, a);
    const giro = NOTTI.find((n) => n.notte === Math.min(notte, NOTTI.length))?.giro.find((g) => g.elemento === e.id);
    const cambio: CambioVariante = { elemento: e.id, da, a, quando: t, chi: 'fade', ...(giro?.motivo ? { motivo: giro.motivo } : {}) };
    this.notteCorrente.cambi.push(cambio);
    this.eventi.emit('variante', cambio);
    out.push({ tipo: 'variante', cambio });
  }

  private chiudiNotte(g: number): void {
    const nc = this.notteCorrente;
    const notte = g; // l'alba del giorno g+1 chiude la notte g
    if (notte < 1) return;
    const righe: string[] = [];
    const cambiate: number[] = [];
    const finestre: string[] = [];
    for (const c of nc?.notte === notte ? nc.cambi : []) {
      const e = ELEMENTI_MOBILI.find((x) => x.id === c.elemento);
      if (!e) continue;
      const modello = RESOCONTO.righe[c.a] ?? RESOCONTO.righe['Carta'] ?? '{nome}: cambiata.';
      righe.push(modello.replace('{nome}', e.nome));
      cambiate.push(...e.particelle);
      for (const ciclo of e.cicli_del_giorno ?? []) {
        if (ciclo.a === 'Abitata') finestre.push(`${ciclo.testo.replace(/\.$/, '')} alle ${testoOra(oreDa(ciclo.ora))}.`);
      }
    }
    for (const id of nc?.notte === notte ? nc.rimaste : []) {
      const e = ELEMENTI_MOBILI.find((x) => x.id === id);
      if (e) righe.push((RESOCONTO.righe['rilevata_rimasta'] ?? '{nome}: misurata, è rimasta.').replace('{nome}', e.nome));
    }
    if (!righe.length) righe.push(RESOCONTO.righe['nessun_cambiamento'] ?? 'Notte quieta.');
    this.ultimo = {
      titolo: RESOCONTO.titolo,
      righe,
      cambiate,
      ...(finestre.length ? { prossimaFinestra: [...new Set(finestre)].join(' ') } : {}),
      notte,
    };
    this.notteCorrente = null;
  }

  avanzaTempo(intervallo: Intervallo, ctx: ContestoNotte): SegnaleNotte[] {
    const out: SegnaleNotte[] = [];
    if (intervallo.a <= intervallo.da) return out;
    for (const ev of this.programma(intervallo)) ev.fai(ctx, out);
    return out;
  }

  resoconto(): Resoconto | null {
    return this.ultimo;
  }

  esporta(): StatoSalvato {
    const stati: Record<number, StatoCella> = {};
    for (let id = 0; id < N; id++) if (this.stati[id] !== this.iniziali[id]) stati[id] = STATO[this.stati[id]!]!;
    return {
      versione: 1,
      stati,
      rilevate: Object.fromEntries(this.rilevate),
      lati: [...this.lati],
      varianti: Object.fromEntries(this.varianti),
      resoconto: this.ultimo,
      notteCorrente: this.notteCorrente,
    };
  }

  importa(dati: unknown): void {
    const d = dati as Partial<StatoSalvato> | null;
    if (!d || d.versione !== 1) return;
    this.stati.set(this.iniziali);
    for (const [k, v] of Object.entries(d.stati ?? {})) this.stati[Number(k)] = CODICE[v] ?? 1;
    this.rilevate = new Map(Object.entries(d.rilevate ?? {}).map(([k, v]) => [Number(k), v]));
    this.lati = new Set(d.lati ?? []);
    this.varianti = new Map(Object.entries(d.varianti ?? {}));
    this.ultimo = d.resoconto ?? null;
    this.notteCorrente = d.notteCorrente ?? null;
    this.eventi.emit('celle', { ids: [...Array(N).keys()], stato: 'matita', origine: null, motivo: 'carico' });
  }
}
