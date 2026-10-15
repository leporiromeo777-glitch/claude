/**
 * Vignette (GDD 4.2, 5.9, 10.3 "Alba"): un diorama fermo, 1-3 figurine di legno e una
 * o due righe di testo con il borbottio del personaggio. Usate dall'alba, dall'Archivio
 * (vignetta di rivelazione) e dai finali (epiloghi).
 *
 * - Il diorama si carica su richiesta (`assets.loadNames`) e si disegna "a copertura"
 *   in un canvas del DOM; le figurine stanno sulla linea di terra alla loro `x`.
 * - Ada di legno grezzo (`fig/ada/<posa>_grezza`) quando chi parla con lei l'ha
 *   dimenticata; i personaggi senza figurina usano quella anonima (`fig/lino/<posa>`).
 * - Tocco, Spazio o Invio avanzano; S salta tutto; A attiva l'avanzamento automatico
 *   (anche dalle impostazioni). Ogni vignetta dura al massimo 8 s in automatico.
 * - Il borbottio (`audio.babble`) accompagna ogni riga detta da un personaggio; il
 *   narratore è muto ma tiene il tempo della riga.
 */
import type { ActionEvent, CharacterId, Playing, Services, SfxId, SpriteFrame } from '../core/types';
import { el, clear } from '../core/ui/dom';
import { button, iconButton, textOf } from '../core/ui/components';
import { plainText } from '../core/ui/richtext';
import { FIGURINE_IDS } from './dawn';
import { charChip, charColor, charName, loadImages, tapKey } from './ui';
import type { VignetteView } from './types';

/** Durata massima di una vignetta in avanzamento automatico (GDD 3.13). */
export const VIGNETTE_MAX_MS = 8000;

export interface VignettePlayerOpts {
  vignettes: VignetteView[];
  onDone: () => void;
  test?: string;
  /** Mostrare "Salta" (sempre visibile all'alba, GDD 9). */
  skippable?: boolean;
  /** Etichetta del pulsante per andare avanti dopo l'ultima riga. */
  doneKey?: string;
}

/** Nome dell'immagine della figurina. */
export function figureFrame(character: CharacterId, pose: string, grezza: boolean): string {
  if (character === 'ada' && grezza) return `fig/ada/${pose}_grezza`;
  if (FIGURINE_IDS.includes(character)) return `fig/${character}/${pose}`;
  return `fig/lino/${pose}`;
}

/** Chi non ha una figurina propria usa quella anonima, tinta del suo colore (asset-blender). */
export function needsTint(character: CharacterId): boolean {
  return !FIGURINE_IDS.includes(character);
}

/** La figurina anonima (lino) tinta del colore del personaggio, in un canvas a parte. */
function tintedFigure(fr: SpriteFrame, color: string, w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(fr.source, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.45;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Durata di lettura di una riga (ms) a velocità 1. */
export function readingMs(text: string): number {
  return Math.max(2200, Math.min(4000, 1400 + text.length * 35));
}

export class VignettePlayer {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly box: HTMLElement;
  private readonly who: HTMLElement;
  private readonly text: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly autoBtn: HTMLButtonElement;
  private vi = 0;
  private li = 0;
  private playing: Playing | null = null;
  /** Riga mostrata (contatore): le promesse della voce di righe vecchie si ignorano. */
  private lineSeq = 0;
  private voiceDone = true;
  private waitingVoice = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private auto: boolean;
  private finished = false;
  private destroyed = false;
  private vignetteStart = 0;
  private ro: ResizeObserver | null = null;

  constructor(
    private readonly s: Services,
    private readonly o: VignettePlayerOpts,
  ) {
    this.auto = s.settings.get().autoAdvance;
    this.canvas = el('canvas', { class: 'cp-vignetta-quadro', attrs: { 'aria-hidden': 'true' } });
    this.who = el('div', { class: 'cp-vignetta-chi' });
    this.text = el('p', { class: 'cp-vignetta-testo', attrs: { 'aria-live': 'polite' }, test: 'cp-vignetta-testo' });
    this.hint = textOf(tapKey('campaign.vignetta.tocca'), undefined, 'p', { className: 'cp-vignetta-suggerimento' });
    this.autoBtn = iconButton({
      icon: 'play',
      labelKey: 'campaign.vignetta.automatico',
      onClick: (e) => {
        e.stopPropagation();
        this.toggleAuto();
      },
      test: 'cp-vignetta-auto',
      className: 'cp-vignetta-autobtn',
    });
    const skip = button({
      labelKey: 'campaign.vignetta.salta',
      kind: 'secondario',
      onClick: (e) => {
        e.stopPropagation();
        this.skip();
      },
      test: 'cp-vignetta-salta',
      className: 'cp-vignetta-salta',
    });
    const next = iconButton({
      icon: 'avanti',
      labelKey: 'campaign.vignetta.avanti',
      onClick: (e) => {
        e.stopPropagation();
        this.next();
      },
      size: 56,
      kind: 'primario',
      test: 'cp-vignetta-avanti',
      className: 'cp-vignetta-avanti',
    });
    this.box = el('div', { class: 'cp-vignetta-box core-solid' }, this.who, this.text, this.hint);
    const bar = el('div', { class: 'cp-vignetta-barra' }, o.skippable === false ? null : skip, this.autoBtn, next);
    this.el = el('div', { class: 'cp-vignetta core-solid', test: o.test ?? 'cp-vignetta', role: 'region' }, this.canvas, this.box, bar);
    this.el.addEventListener('click', () => this.next());
    this.syncAuto();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.draw());
      this.ro.observe(this.el);
    }
  }

  start(): void {
    if (this.o.vignettes.length === 0) {
      this.finish();
      return;
    }
    this.show(0, 0);
  }

  /** Indice della vignetta e della riga correnti (per il debug e i test). */
  position(): { vignette: number; line: number; id: string | null; done: boolean } {
    return { vignette: this.vi, line: this.li, id: this.o.vignettes[this.vi]?.id ?? null, done: this.finished };
  }

  private current(): VignetteView | null {
    return this.o.vignettes[this.vi] ?? null;
  }

  private show(vi: number, li: number): void {
    if (this.destroyed) return;
    const changed = vi !== this.vi || li === 0;
    this.vi = vi;
    this.li = li;
    const v = this.current();
    if (!v) {
      this.finish();
      return;
    }
    if (changed && li === 0) {
      this.vignetteStart = Date.now();
      void loadImages(this.s.assets, [v.background, ...v.figures.map((f) => figureFrame(f.character, f.pose, !!v.grezza))]).then(() => this.draw());
      this.draw();
      for (const sfx of v.sfx ?? []) this.sfx(sfx);
    }
    const line = v.lines[li];
    this.stopVoice();
    clear(this.who);
    clear(this.text);
    if (!line) {
      this.next();
      return;
    }
    const params = line.params;
    const node = textOf(line.textKey, params, 'span', { rich: true });
    this.text.appendChild(node);
    this.text.classList.toggle('cp-vignetta-testo--narratore', line.speaker === 'narratore');
    if (line.speaker !== 'narratore') this.who.appendChild(charChip(this.s, line.speaker, { test: 'cp-vignetta-chi' }));
    const plain = plainText(this.s.i18n.t(line.textKey, params), (id) => charName(this.s, id));
    this.lineSeq += 1;
    this.voiceDone = true;
    if (line.speaker !== 'narratore') {
      try {
        const p = this.s.audio.babble(line.speaker, plain);
        this.playing = p;
        this.voiceDone = false;
        const seq = this.lineSeq;
        void p.done.then(
          () => this.voiceFinished(seq),
          () => this.voiceFinished(seq),
        );
      } catch {
        this.playing = null;
        this.voiceDone = true;
      }
    }
    this.scheduleAuto(plain);
  }

  /** Il borbottio della riga `seq` è finito: se l'automatico aspettava solo la voce, si va avanti. */
  private voiceFinished(seq: number): void {
    if (seq !== this.lineSeq) return;
    this.voiceDone = true;
    if (this.waitingVoice) {
      this.waitingVoice = false;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      if (this.auto && !this.destroyed) this.next();
    }
  }

  private sfx(id: SfxId): void {
    try {
      this.s.audio.sfx(id);
    } catch {
      /* audio non pronto */
    }
  }

  /**
   * Avanzamento automatico: dopo il tempo di lettura e, se la voce sta ancora
   * borbottando, quando finisce (al massimo 8 s per vignetta: le righe si dividono il tempo).
   */
  private scheduleAuto(text: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.waitingVoice = false;
    if (!this.auto) return;
    const speed = this.s.settings.get().animSpeed || 4;
    const v = this.current();
    const lines = v?.lines.length ?? 1;
    const budget = VIGNETTE_MAX_MS / lines / speed;
    const ms = Math.min(budget, readingMs(text) / speed);
    const seq = this.lineSeq;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (seq !== this.lineSeq || !this.auto || this.destroyed) return;
      if (this.voiceDone) {
        this.next();
        return;
      }
      this.waitingVoice = true;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.waitingVoice = false;
        if (seq === this.lineSeq && this.auto && !this.destroyed) this.next();
      }, Math.max(0, budget - ms));
    }, ms);
  }

  private stopVoice(): void {
    try {
      this.playing?.stop();
    } catch {
      /* già finito */
    }
    this.playing = null;
  }

  next(): void {
    if (this.destroyed || this.finished) return;
    const v = this.current();
    if (!v) {
      this.finish();
      return;
    }
    if (this.li + 1 < v.lines.length) this.show(this.vi, this.li + 1);
    else if (this.vi + 1 < this.o.vignettes.length) this.show(this.vi + 1, 0);
    else this.finish();
  }

  skip(): void {
    if (this.destroyed || this.finished) return;
    this.finish();
  }

  toggleAuto(): void {
    this.auto = !this.auto;
    this.syncAuto();
    if (this.auto) {
      const line = this.current()?.lines[this.li];
      this.scheduleAuto(line ? this.s.i18n.t(line.textKey, line.params) : '');
    } else {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.waitingVoice = false;
    }
  }

  private syncAuto(): void {
    this.autoBtn.setAttribute('aria-pressed', this.auto ? 'true' : 'false');
    this.autoBtn.classList.toggle('cp-attivo', this.auto);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stopVoice();
    this.o.onDone();
  }

  /** Azioni da tastiera (Spazio o Invio avanza, S salta, A automatico). */
  onAction(a: ActionEvent): boolean {
    switch (a.action) {
      case 'confirm':
      case 'crossL':
      case 'select':
      case 'right':
        this.next();
        return true;
      case 'skip':
        this.skip();
        return true;
      case 'auto':
        this.toggleAuto();
        return true;
      default:
        return false;
    }
  }

  /** Disegna diorama e figurine nel canvas (a copertura, con la linea di terra in basso). */
  draw(): void {
    if (this.destroyed) return;
    const v = this.current();
    const c = this.canvas;
    const w = Math.max(1, Math.round(c.clientWidth || this.el.clientWidth || 1));
    const h = Math.max(1, Math.round(c.clientHeight || this.el.clientHeight || 1));
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d');
    if (!ctx || !v) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#121622';
    ctx.fillRect(0, 0, w, h);
    try {
      const img = this.s.assets.image(v.background) as CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
      const iw = Number(img.naturalWidth ?? img.width ?? 1024) || 1024;
      const ih = Number(img.naturalHeight ?? img.height ?? 768) || 768;
      const k = Math.max(w / iw, h / ih);
      const dw = iw * k;
      const dh = ih * k;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } catch {
      /* diorama non pronto: resta il velluto */
    }
    // Figurine sulla linea di terra, sopra il riquadro del testo.
    const boxTop = this.box.offsetTop > 0 ? this.box.offsetTop : h * 0.72;
    const ground = Math.max(h * 0.35, Math.min(h * 0.86, boxTop - 8));
    const figH = Math.min(h * 0.5, ground * 0.6, w * 0.42);
    for (const f of v.figures) {
      const fr = this.s.assets.frame(figureFrame(f.character, f.pose, !!v.grezza));
      const k = figH / Math.max(1, fr.sh);
      const dw = fr.sw * k;
      const dh = fr.sh * k;
      const x = f.x * w;
      ctx.save();
      ctx.translate(x, ground);
      if (f.flip) ctx.scale(-1, 1);
      try {
        const tinted = needsTint(f.character) ? tintedFigure(fr, charColor(this.s, f.character), dw * dpr, dh * dpr) : null;
        if (tinted) ctx.drawImage(tinted, -fr.ax * dw, -fr.ay * dh, dw, dh);
        else ctx.drawImage(fr.source, fr.sx, fr.sy, fr.sw, fr.sh, -fr.ax * dw, -fr.ay * dh, dw, dh);
      } catch {
        /* figurina non pronta */
      }
      ctx.restore();
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stopVoice();
    this.ro?.disconnect();
    this.el.remove();
  }
}
