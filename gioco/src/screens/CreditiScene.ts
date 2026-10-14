/**
 * Scena 'crediti' (GDD 10.3 "Crediti"): scorrimento lento sul carillon.
 * Autore e righe da credits.json, «realizzato con strumenti di intelligenza
 * artificiale», caratteri con licenza OFL (Atkinson Hyperlegible, EB Garamond,
 * Caveat), strumenti e licenze, «Ispirato alla tradizione del merletto a
 * fuselli di Pellestrina e Burano».
 *
 * Il rullo scorre da solo (fermo con il movimento ridotto); se il giocatore lo
 * tocca, lo scorre o usa la tastiera, si ferma qualche secondo e poi riprende.
 */
import type { ActionEvent, CarillonScore, CharacterId, Playing, Services } from '../core/types';
import { el } from '../core/ui/dom';
import { textOf } from '../core/ui/components';
import { laceEdge } from './icons';
import { ScreenScene } from './ScreenScene';
import { screenFrame } from './widgets';

type Who = CharacterId | 'lino';

/** Una frase lenta in Re dorico con le note dei personaggi (bicordi [sopra, sotto]). */
export const CREDITS_SCORE: CarillonScore = {
  beatMs: 760,
  rows: (
    [
      [['ada', 'marta']],
      [['teresa', 'zeno']],
      [['lunardi', 'piero']],
      [['teresa', 'marta']],
      [['nina', 'bepi']],
      [['ada', 'bepi']],
      [['clotilde', 'livia']],
      [],
      [['teresa', 'livia']],
      [['gino', 'zeno']],
      [['ada', 'zeno']],
      [['nina', 'bepi']],
      [['lunardi', 'piero']],
      [['clotilde', 'lunardi']],
      [['teresa', 'marta']],
      [['ada', 'piero']],
      [],
      [],
    ] as Who[][][]
  ).map((r) => r.map((c) => [...c])),
};

/** Velocità dello scorrimento (px al secondo) e pausa dopo un'interazione. */
export const CREDITS_SPEED = 26;
export const CREDITS_PAUSE_S = 5;

export const FONT_LICENSES: readonly { name: string; key: string }[] = [
  { name: 'atkinson', key: 'ui.crediti.font.atkinson' },
  { name: 'garamond', key: 'ui.crediti.font.garamond' },
  { name: 'caveat', key: 'ui.crediti.font.caveat' },
];

export const TOOLS: readonly string[] = ['blender', 'typescript', 'vite', 'capacitor', 'fontsource', 'vitest', 'playwright'];

export class CreditiScene extends ScreenScene {
  readonly id = 'crediti' as const;
  private roll: HTMLElement | null = null;
  private pos = 0;
  private hold = 0;
  private playing: Playing | null = null;
  private stopped = false;

  constructor(s: Services) {
    super(s, { glow: { x: 0.5, y: 0.1, r: 0.6, alpha: 0.1 } });
  }

  protected build(): HTMLElement {
    const s = this.s;
    const f = screenFrame({ id: 'crediti', titleKey: 'ui.crediti.titolo', onBack: () => this.goBack() });
    const credits = s.content.credits;
    const lines = credits.lines.filter((l) => s.i18n.has(l.key)).map((l) => textOf(l.key, undefined, 'p', { className: 'sc-crediti-riga', rich: true }));
    const block = (titleKey: string, test: string, ...children: (HTMLElement | null)[]): HTMLElement =>
      el('section', { class: 'sc-crediti-blocco', test }, textOf(titleKey, undefined, 'h2', { className: 'sc-crediti-h' }), ...children);
    const roll = el(
      'div',
      { class: 'sc-crediti-rullo', test: 'sc-crediti-rullo', tabIndex: 0, attrs: { 'aria-label': s.i18n.t('ui.crediti.titolo') }, data: { i18nLabel: 'ui.crediti.titolo' } },
      el('div', { class: 'sc-crediti-spazio', attrs: { 'aria-hidden': 'true' } }),
      el(
        'header',
        { class: 'sc-crediti-testa' },
        textOf('ui.titolo.nome', undefined, 'p', { className: 'sc-crediti-nome' }),
        laceEdge('sc-smerlo sc-smerlo--crediti', 7),
        textOf('ui.titolo.sottotitolo', undefined, 'p', { className: 'sc-crediti-sotto' }),
      ),
      s.i18n.has(credits.authorKey) ? textOf(credits.authorKey, undefined, 'p', { className: 'sc-crediti-autore', rich: true }) : null,
      el('div', { class: 'sc-crediti-righe', test: 'sc-crediti-righe' }, ...lines),
      block('ui.crediti.realizzazione', 'sc-crediti-ia', textOf('ui.crediti.ia', undefined, 'p', { className: 'sc-crediti-riga' })),
      block(
        'ui.crediti.caratteri',
        'sc-crediti-font',
        ...FONT_LICENSES.map((fl) => textOf(fl.key, undefined, 'p', { className: 'sc-crediti-riga' })),
        textOf('ui.crediti.ofl', undefined, 'p', { className: 'sc-crediti-riga sc-crediti-piccola' }),
      ),
      block('ui.crediti.strumenti', 'sc-crediti-strumenti', ...TOOLS.map((t) => textOf(`ui.crediti.strumento.${t}`, undefined, 'p', { className: 'sc-crediti-riga' }))),
      el('p', { class: 'sc-crediti-ispirazione', test: 'sc-crediti-ispirazione' }, textOf('ui.crediti.ispirazione', undefined, 'span')),
      textOf('ui.crediti.versione', { versione: typeof __GAME_VERSION__ === 'string' ? __GAME_VERSION__ : '' }, 'p', { className: 'sc-crediti-riga sc-crediti-piccola' }),
      laceEdge('sc-smerlo sc-smerlo--crediti', 5),
      el('div', { class: 'sc-crediti-spazio sc-crediti-spazio--fine', attrs: { 'aria-hidden': 'true' } }),
    );
    const pause = (): void => {
      this.hold = CREDITS_PAUSE_S;
    };
    for (const ev of ['wheel', 'pointerdown', 'touchstart', 'keydown', 'focusin'] as const) roll.addEventListener(ev, pause, { passive: true });
    roll.addEventListener('scroll', () => {
      // Lo scorrimento del giocatore sposta anche il punto da cui riparte il rullo.
      if (this.hold > 0) this.pos = roll.scrollTop;
    });
    this.roll = roll;
    this.pos = 0;
    this.stopped = false;
    f.body.appendChild(roll);
    f.sheet.classList.add('sc-foglio--crediti');
    return f.root;
  }

  protected override afterEnter(): void {
    try {
      this.s.audio.setMusic('off');
      this.s.audio.setAmbience('notte');
    } catch {
      /* audio non pronto */
    }
    this.loopCarillon();
  }

  private loopCarillon(): void {
    if (this.stopped) return;
    try {
      const p = this.s.audio.carillon(CREDITS_SCORE);
      this.playing = p;
      void p.done.then(() => {
        if (this.playing === p && !this.stopped) this.loopCarillon();
      });
    } catch {
      this.playing = null;
    }
  }

  protected override beforeExit(): void {
    this.stopped = true;
    this.playing?.stop();
    this.playing = null;
    this.roll = null;
    try {
      this.s.audio.setMusic('titolo', this.s.save.data().unlocks.tovaglia ? { stonatura: 0 } : {});
    } catch {
      /* audio non pronto */
    }
  }

  update(dt: number): void {
    const roll = this.roll;
    if (!roll) return;
    const st = this.s.settings.get();
    if (st.reducedMotion) return;
    if (this.hold > 0) {
      this.hold = Math.max(0, this.hold - dt);
      return;
    }
    const max = roll.scrollHeight - roll.clientHeight;
    if (max <= 0 || this.pos >= max) return;
    this.pos = Math.min(max, this.pos + CREDITS_SPEED * dt);
    roll.scrollTop = this.pos;
  }

  override onAction(a: ActionEvent): boolean {
    const r = this.roll;
    if (r && (a.action === 'up' || a.action === 'down' || a.action === 'pageUp' || a.action === 'pageDown')) {
      const page = r.clientHeight * 0.85;
      const d = a.action === 'up' ? -48 : a.action === 'down' ? 48 : a.action === 'pageUp' ? -page : page;
      this.hold = CREDITS_PAUSE_S;
      r.scrollBy({ top: d });
      this.pos = r.scrollTop;
      return true;
    }
    return super.onAction(a);
  }

  /** Stato dello scorrimento (debug). */
  rollState(): { pos: number; max: number; hold: number } {
    const r = this.roll;
    return { pos: this.pos, max: r ? r.scrollHeight - r.clientHeight : 0, hold: this.hold };
  }
}
