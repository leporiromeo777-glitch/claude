/**
 * Ponte fra la regia e l'interfaccia (src/ui, `InterfacciaGioco`).
 *
 * - dati per il Taccuino, la Pianta e la pausa, presi dal motore della storia e dal catasto;
 * - la vista di lettura (testi.json): sa quando una carta è stata letta fino all'ultima riga
 *   (`lettera_letta`, `cartellino_letto`, `targa_p1_letta`) e quanto resta aperta una pagina
 *   del libretto (`libretto_cs1_letto`, `libretto_pagina:<id>`);
 * - suggerimenti dei comandi (con i nomi dei tasti), battute e sottotitoli, notifiche;
 * - il piccolo menu «Aspetta fino a…» (GDD §3.7), che l'interfaccia non ha ancora.
 */
import {
  aspettoDaPersonaggio,
  cartaDaLeggenda,
  cartaDaTesto,
  grigliaDaParticelle,
  librettoDaTesti,
  luoghiDaContenuti,
  taccuinoDaContenuti,
  type Carta,
  type DatiPianta,
  type DatiTaccuino,
  type InterfacciaGioco,
  type ParticellaFadeJson,
  type TaccuinoJson,
  type VoceTestiJson,
} from '../ui';
import { riempiSegnaposto } from '../narrativa';
import {
  LUOGHI,
  PARTICELLE_AREA,
  TACCUINO,
  TESTI,
  battuta as trovaBattuta,
  personaggio,
  suggerimento as trovaSuggerimento,
  testo as trovaTesto,
} from './contenuti';
import type { Resoconto } from '../rilievo';
import type { Regia } from './regia';

/** Nomi dei comandi per i segnaposto dei suggerimenti di testi.json. */
export const TASTI: Record<string, string> = {
  usa: 'E',
  guarda: 'il mouse',
  muovi: 'W A S D',
  corri: 'Shift',
  siedi: 'C',
  lente: 'Q',
  pianta: 'P',
  salta: 'Spazio',
  velo: 'tieni Spazio in aria',
  aspetta: 'X',
  libretto: 'L',
  mira: 'tasto destro',
  squadro: 'R',
  chiama: 'G',
};

/** Come si chiama una persona finché Elvira non sa il suo nome (GDD §8.1). */
const SCONOSCIUTI: Record<string, string> = {
  togna: 'una velata al lavatoio',
  bortolo: 'un velato col cappello',
  annunciata: 'una vecchia velata',
  pina: 'una vecchia col cappuccio',
  nando: 'uno senza velo',
  clelia: 'una novizia',
  bambini: 'due bambini',
  lisa: 'una bambina',
  gioanin: 'un bambino',
  ottavio: 'un ragazzo col Velo verde',
  meridiana: 'una voce dalle campane',
};

/** Ordine delle pagine del libretto (quello del file: le monografie, poi le pagine incollate e il Vettore). */
const LIBRETTO = TESTI['libretto'] as Record<string, VoceTestiJson>;
export const ORDINE_LIBRETTO = Object.keys(LIBRETTO).filter((k) => !k.startsWith('_'));

/** Carte la cui lettura completa accende un flag del contratto. */
const FLAG_LETTURA: Record<string, string> = {
  lettera_marta: 'lettera_letta',
  cartellino_castagno: 'cartellino_letto',
  targa_p1: 'targa_p1_letta',
};

interface LetturaAperta {
  id: string;
  carta: Carta;
  aperta: number;
  finita: boolean;
  /** Pagine del libretto viste (id → secondi). */
  pagine?: Map<string, number>;
  scena?: string;
  poi?: () => void;
}

export class PonteInterfaccia {
  readonly ui: InterfacciaGioco;
  private lettura: LetturaAperta | null = null;
  private suggerimentoFino = 0;
  private tempo = 0;
  private vociViste = new Set<string>();
  /** Il Taccuino si riapre sulla pagina delle parole (la Pesarina, notte 1). */
  paginaParole = false;
  private attesa: HTMLDivElement | null = null;
  private sceltaAttesa: { testo: string; ore: number | 'meta' }[] = [];
  private suTastoAttesa = (e: KeyboardEvent) => this.tastoAttesa(e);

  constructor(private r: Regia) {
    this.ui = r.ui;
    this.ui.lettore.on('chiudi', () => this.chiudiLettura());
    this.ui.lettore.on('nascosto', () => this.chiudiLettura());
    this.ui.taccuino.on('mostrato', () => {
      if (this.paginaParole) {
        this.paginaParole = false;
        const d = this.datiTaccuino();
        if (d) this.ui.taccuino.show(d, 'parole');
      }
      this.r.audio.evento({ tipo: 'pagina', verso: 'avanti' });
    });
    this.ui.taccuino.on('nascosto', () => {
      for (const v of this.r.narrativa.taccuino.voci()) this.vociViste.add(v.id);
      for (const v of this.righeResoconto) this.vociViste.add(v.id);
    });
    this.ui.taccuino.on('leggi', (id) => {
      const voce = id.split('.').pop() ?? id;
      this.leggi(voce);
    });
    this.ui.pianta.on('mostrato', () => this.r.flag('pianta_aperta'));
    this.ui.pianta.on('punto', (p) => {
      const cella = this.r.game.world.cellAt(p.z, p.theta);
      if (this.r.catasto.catasto.info(cella).firme.includes('G4')) this.r.flag('pianta_g4_guardata');
    });
  }

  // ---------- nomi ----------

  nomeVisibile(id: string): string {
    if (id === 'elvira') return 'Elvira';
    if (!this.r.nomiNoti.has(id) && SCONOSCIUTI[id]) return SCONOSCIUTI[id]!;
    return personaggio(id)?.nome ?? id;
  }

  aspetto(id: string): string | undefined {
    const p = personaggio(id);
    return p ? aspettoDaPersonaggio(p as never) : undefined;
  }

  // ---------- letture ----------

  /** Apre in lettura una voce di testi.json (per id, in qualunque sezione). */
  leggi(id: string, poi?: () => void): boolean {
    const t = trovaTesto(id);
    if (!t) return false;
    const carta = t.sezione === 'leggende' ? cartaDaLeggenda(id, t.voce) : cartaDaTesto(id, t.voce, t.sezione);
    this.lettura = { id, carta, aperta: 0, finita: false, ...(poi ? { poi } : {}) };
    this.ui.lettore.show(carta);
    this.r.audio.evento({ tipo: 'pagina', verso: 'avanti' });
    return true;
  }

  /** La scena dell'Ombrista come carta (un quadro per pagina); alla chiusura si conclude. */
  recitaScena(id: string): boolean {
    const t = trovaTesto(id);
    if (!t) return false;
    const carta = cartaDaLeggenda(id, t.voce);
    this.lettura = { id, carta, aperta: 0, finita: false, scena: id };
    this.ui.lettore.show(carta);
    return true;
  }

  /** Il libretto di Aurelio, aperto sulla pagina del segnalibro. */
  apriLibretto(pagina?: string): void {
    const ordine = this.r.libretto.ordine;
    const carta = librettoDaTesti(LIBRETTO, { ordine });
    const i = Math.max(0, ordine.indexOf(pagina ?? this.r.libretto.segnalibro));
    this.lettura = { id: 'libretto', carta, aperta: 0, finita: false, pagine: new Map() };
    this.ui.lettore.show(carta, i);
    this.r.audio.evento({ tipo: 'pagina', verso: 'avanti' });
  }

  get letturaAperta(): string | null {
    return this.ui.lettore.visible ? (this.lettura?.id ?? null) : null;
  }

  private chiudiLettura(): void {
    const l = this.lettura;
    if (!l) return;
    this.lettura = null;
    if (l.scena) this.r.narrativa.concludiScena(l.scena);
    if (l.finita) l.poi?.();
  }

  /** Le pagine (indici) visibili adesso nel lettore. */
  private pagineVisibili(): number[] {
    const el = this.ui.lettore.el;
    const n = el.querySelectorAll('.ui-lt-pagina:not(.ui-lt-pagina--vuota)').length || 1;
    const i0 = this.ui.lettore.paginaCorrente;
    return Array.from({ length: n }, (_, k) => i0 + k);
  }

  /** L'ultima pagina è visibile e scorsa fino in fondo? */
  private inFondo(l: LetturaAperta): boolean {
    const vis = this.pagineVisibili();
    if (Math.max(...vis) < l.carta.pagine.length - 1) return false;
    const pagine = this.ui.lettore.el.querySelectorAll<HTMLElement>('.ui-lt-pagina:not(.ui-lt-pagina--vuota)');
    const ultima = pagine[pagine.length - 1];
    if (!ultima) return true;
    return ultima.scrollHeight - ultima.scrollTop - ultima.clientHeight <= 8;
  }

  /** Da chiamare a ogni passo: letture finite, pagine del libretto, suggerimenti a tempo. */
  sonda(dt: number): void {
    this.tempo += dt;
    if (this.suggerimentoFino && this.tempo > this.suggerimentoFino) {
      this.suggerimentoFino = 0;
      this.ui.indicazioni.suggerimento(null);
    }
    const l = this.lettura;
    if (!l || !this.ui.lettore.visible) return;
    l.aperta += dt;
    if (l.pagine) {
      const ordine = this.r.libretto.ordine;
      for (const i of this.pagineVisibili()) {
        const id = ordine[i];
        if (!id) continue;
        const t = (l.pagine.get(id) ?? 0) + dt;
        l.pagine.set(id, t);
        if (t >= 2) {
          this.r.flag(`libretto_pagina:${id}`);
          if (id === 'cs_1') this.r.flag('libretto_cs1_letto');
        }
      }
      for (const id of [...l.pagine.keys()]) if (!this.pagineVisibili().some((i) => ordine[i] === id)) l.pagine.delete(id);
      return;
    }
    if (!l.finita && l.aperta >= 1.2 && this.inFondo(l)) {
      l.finita = true;
      const f = FLAG_LETTURA[l.id];
      if (f) this.r.flag(f);
      this.r.flag(`letto:${l.id}`);
    }
  }

  // ---------- suggerimenti, battute, notifiche ----------

  suggerimento(id: string, durata = 10): void {
    if (!this.ui.impostazioni.get('suggerimentiComandi')) return;
    const t = trovaSuggerimento(id);
    if (!t) return;
    const testo = riempiSegnaposto(t, TASTI);
    this.ui.indicazioni.suggerimento(testo);
    this.suggerimentoFino = this.tempo + durata;
    this.r.ultimoSuggerimento = id;
  }

  battuta(id: string): void {
    const b = trovaBattuta(id);
    if (!b) return;
    const righe: { chi: string; testo: string }[] = [{ chi: b.chi, testo: b.testo }];
    if (b.risposta_elvira) righe.push({ chi: 'elvira', testo: b.risposta_elvira });
    if (b.replica) righe.push({ chi: b.chi, testo: b.replica });
    let ritardo = 0;
    for (const r of righe) {
      const dur = 1800 + r.testo.length * 55;
      setTimeout(() => this.ui.indicazioni.sottotitolo({ testo: r.testo, chi: this.nomeVisibile(r.chi), durata: dur }), ritardo);
      ritardo += dur * 0.85;
    }
    this.r.ultimaBattuta = id;
  }

  suono(descrizione: string, direzione?: 'sinistra' | 'destra' | 'davanti' | 'dietro' | 'sopra' | 'sotto'): void {
    if (!this.ui.impostazioni.get('sottotitoliSuoni')) return;
    this.ui.indicazioni.sottotitolo({ testo: descrizione, tipo: 'suono', ...(direzione ? { direzione } : {}) });
  }

  notifica(testo: string, tono: 'matita' | 'rosso' = 'matita'): void {
    this.ui.indicazioni.notifica(testo, { tono });
  }

  // ---------- dati per i componenti ----------

  rigaCielo(): string {
    const t = this.r.narrativa.taccuino.rigaCielo() ?? '';
    return riempiSegnaposto(t, { secondi: Math.max(0, Math.round(this.r.secondiAllaMeta())) });
  }

  datiTaccuino(): DatiTaccuino | undefined {
    const voci = this.r.narrativa.taccuino.voci();
    const d = taccuinoDaContenuti(TACCUINO as unknown as TaccuinoJson, {
      voci: voci.map((v) => v.id),
      nuove: voci.filter((v) => !this.vociViste.has(v.id)).map((v) => v.id),
      chiuse: voci.filter((v) => v.chiusa).map((v) => v.id),
      prossimoEvento: this.rigaCielo(),
    });
    // il resoconto del mattino (finché è mattino), in testa agli appunti
    if (this.r.resocontoVisibile() && this.righeResoconto.length) {
      d.note = [...this.righeResoconto.map((x) => ({ id: x.id, testo: `Stanotte — ${x.testo}`, mano: 'tecnica' as const, nuova: !this.vociViste.has(x.id) })), ...(d.note ?? [])];
    }
    return d;
  }

  datiPianta(): DatiPianta | undefined {
    const r = this.r;
    const pc = r.game.player.cyl;
    const d = r.catasto.pianta(r.orologio.giorno, r.orologio.ore);
    const luoghi = luoghiDaContenuti(LUOGHI as never);
    if (r.narrativa.valuta('passo:m1_marza completato')) {
      luoghi.push({ id: 'marze_di_casa', nome: 'Terrazza Pedrazzini — marze di casa (E. P., 2119)', z: 948, theta: 23, visibile: true } as never);
    }
    return {
      griglia: { ...d.griglia, terreno: this.terreno() },
      capisaldi: d.capisaldi.map((c) => ({ id: c.id, numero: c.numero, tipo: c.tipo, z: c.z, theta: c.theta, rilevato: c.rilevato, visto: c.visto, nome: c.nome })),
      lati: d.lati.map((l) => ({ da: l.da, a: l.a })),
      ...(d.resoconto ? { resoconto: { righe: d.resoconto.righe, ...(d.resoconto.prossimaFinestra ? { prossimaFinestra: d.resoconto.prossimaFinestra } : {}) } } : {}),
      elvira: { z: pc.z, theta: pc.theta, direzione: r.direzioneSguardo() },
      luoghi,
      totaleParticelle: d.totaleParticelle,
    };
  }

  private terrenoCache: Uint8Array | null = null;
  /** Terreno dell'acquerello (acqua, roccia, abitato) dai tipi delle particelle dell'area. */
  private terreno(): Uint8Array {
    if (!this.terrenoCache) {
      const g = grigliaDaParticelle(PARTICELLE_AREA as unknown as ParticellaFadeJson[]);
      this.terrenoCache = Uint8Array.from(g.terreno ?? []);
    }
    return this.terrenoCache;
  }

  /** Il resoconto del mattino: in rosso fra le notifiche e, riga per riga, nel Taccuino. */
  resocontoDelMattino(r: Resoconto): void {
    this.righeResoconto = r.testo.map((t, i) => ({ id: `resoconto_${r.notte}_${i}`, testo: t }));
    for (const riga of r.righe.filter((x) => x.colore === 'rosso')) this.notifica(riga.testo, 'rosso');
    if (r.quieta) this.notifica(r.testo[0] ?? 'Notte quieta.');
  }

  private righeResoconto: { id: string; testo: string }[] = [];

  datiPausa(): { luogo?: string; quando?: string; prossimoEvento?: string } {
    const r = this.r;
    const pc = r.game.player.cyl;
    const l = r.interno === 'cripta' ? 'Cripta dei Giardinieri' : r.luoghi.piuVicino(pc.z, pc.theta)?.nome;
    return { ...(l ? { luogo: l } : {}), quando: `Giorno ${r.orologio.giorno}, ${r.testoOra()}`, prossimoEvento: this.rigaCielo() };
  }

  // ---------- «Aspetta fino a…» ----------

  get attesaAperta(): boolean {
    return !!this.attesa;
  }

  apriAttesa(voci: { testo: string; ore: number | 'meta' }[]): void {
    this.chiudiAttesa();
    if (!voci.length) return;
    this.sceltaAttesa = voci;
    const el = document.createElement('div');
    el.className = 'regia-attesa ui-carta';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Aspetta fino a');
    Object.assign(el.style, {
      position: 'absolute',
      left: '50%',
      bottom: '18%',
      transform: 'translateX(-50%)',
      padding: '14px 22px',
      minWidth: '280px',
      font: 'calc(18px * var(--ui-scala, 1)) "EB Garamond", Georgia, serif',
      color: '#241e19',
      pointerEvents: 'auto',
    } satisfies Partial<CSSStyleDeclaration>);
    const titolo = document.createElement('div');
    titolo.textContent = 'Aspetta fino a…';
    titolo.style.fontStyle = 'italic';
    titolo.style.marginBottom = '6px';
    el.append(titolo);
    voci.forEach((v, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ui-bottone ui-bottone--leggero';
      b.textContent = `${i + 1}  ${v.testo}`;
      b.style.display = 'block';
      b.onclick = () => this.scegliAttesa(i);
      el.append(b);
    });
    const nota = document.createElement('div');
    nota.textContent = 'X o Esc per lasciar perdere';
    nota.style.cssText = 'margin-top:6px;font-size:.85em;color:#57534c';
    el.append(nota);
    this.ui.radice.append(el);
    this.attesa = el;
    window.addEventListener('keydown', this.suTastoAttesa, true);
  }

  chiudiAttesa(): void {
    this.attesa?.remove();
    this.attesa = null;
    window.removeEventListener('keydown', this.suTastoAttesa, true);
  }

  private scegliAttesa(i: number): void {
    const v = this.sceltaAttesa[i];
    this.chiudiAttesa();
    if (v) this.r.aspettaFino(v.ore);
  }

  private tastoAttesa(e: KeyboardEvent): void {
    if (/^[1-9]$/.test(e.key)) {
      this.scegliAttesa(Number(e.key) - 1);
      e.preventDefault();
      e.stopPropagation();
    } else if (e.key === 'x' || e.key === 'X' || e.key === 'Escape') {
      this.chiudiAttesa();
      e.preventDefault();
      e.stopPropagation();
    }
  }
}
