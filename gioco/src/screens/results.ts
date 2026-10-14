/**
 * Risultati delle modalità (GDD 10.3 "Merletto del giorno … Dopo: risultati,
 * Condividi, Copia spartito"; "Bilancio … eleganza e record, Riascolta il
 * merletto"): un foglio di carta con l'immagine del merletto, l'eleganza
 * (incroci e minimo, ore di quiete, simmetria, filo d'oro), i record e i pulsanti.
 *
 * Condividere: testo esatto di GDD 8.3 più lo spartito e il PNG di
 * `renderLacePng` con `platform.share`; dove la condivisione non c'è, il testo
 * si copia e l'immagine si salva.
 */
import type { CarillonScore, CharacterId, LevelDef, NightOutcome, Playing, Services } from '../core/types';
import { el } from '../core/ui/dom';
import { textOf } from '../core/ui/components';
import { renderLacePng } from '../tombolo/index';
import { cosmeticNameKey, hasCosmeticArt, spindlePreview } from './cosmetics';
import { icon } from './icons';
import type { ResultInfo } from './state';
import { setLastShare } from './state';
import { buttonGroup, statRow, wideButton } from './widgets';

type Who = CharacterId | 'lino';

/** Battito del carillon del merletto (GDD 13.2). */
export const CARILLON_BEAT_MS = 380;

function whoOf(level: LevelDef, thread: string): Who {
  const def = level.threads.find((t) => t.id === thread);
  return def?.character ?? 'lino';
}

/** Carillon del merletto: una riga = un battito, un bicordo [sopra, sotto] per incrocio. */
export function carillonScore(level: LevelDef, outcome: Pick<NightOutcome, 'rows' | 'timeline'>): CarillonScore {
  const rows: Who[][][] = [];
  outcome.rows.forEach((r, i) => {
    const before = outcome.timeline[i];
    const chords: Who[][] = [];
    if (before) {
      for (const c of r.crossings) {
        const left = before.pos[c.pair];
        const right = before.pos[c.pair + 1];
        if (left === undefined || right === undefined) continue;
        const over = c.over === 'L' ? left : right;
        const under = c.over === 'L' ? right : left;
        chords.push([whoOf(level, over), whoOf(level, under)]);
      }
    }
    rows.push(chords);
  });
  return { beatMs: CARILLON_BEAT_MS, rows };
}

/** Nome del file PNG. */
export function pngName(level: LevelDef): string {
  return `trama-${level.id.replace(/[^A-Za-z0-9_-]+/g, '-')}.png`;
}

function download(blob: Blob, name: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = el('a', { attrs: { href: url, download: name } });
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

export async function lacePng(info: Pick<ResultInfo, 'level' | 'outcome' | 'flags'>): Promise<Blob | null> {
  try {
    return await renderLacePng(info.level, info.outcome.rows, info.flags);
  } catch (err) {
    console.warn('[screens] PNG failed', err);
    return null;
  }
}

/** Il sistema ha un foglio di condivisione (Web Share API o app nativa)? */
export function canShareNatively(s: Pick<Services, 'platform'>): boolean {
  if (s.platform.native) return true;
  return typeof navigator !== 'undefined' && typeof (navigator as Navigator & { share?: unknown }).share === 'function';
}

/**
 * Condivide testo (+ spartito) e immagine; dove non si può, copia il testo e
 * salva l'immagine. `png` è l'immagine già pronta (il foglio dei risultati la
 * prepara subito): così la condivisione parte dentro il gesto del giocatore,
 * come chiedono i browser. Se il foglio di condivisione c'era ma non è andato
 * (annullato), il testo si copia soltanto: nessun file scaricato a sorpresa.
 */
export async function shareResult(s: Services, info: ResultInfo, png?: Promise<Blob | null>): Promise<'condiviso' | 'copiato' | 'fallito'> {
  const text = info.shareText ?? info.outcome.spartito;
  setLastShare(text);
  const file = await (png ?? lacePng(info));
  const name = pngName(info.level);
  const sheet = canShareNatively(s);
  const shared = sheet ? await s.platform.share(file ? { text, title: s.i18n.t('ui.condividi.titolo'), file, fileName: name } : { text, title: s.i18n.t('ui.condividi.titolo') }) : false;
  if (shared) {
    s.ui.toast('ui.condividi.fatto', undefined, 'ok');
    return 'condiviso';
  }
  const copied = await s.platform.copy(text);
  const saved = !sheet && file ? download(file, name) : false;
  if (copied) {
    s.ui.toast(saved ? 'ui.condividi.copiatoImmagine' : 'ui.condividi.copiato', undefined, 'ok');
    return 'copiato';
  }
  s.ui.toast('ui.condividi.nonRiuscito', undefined, 'warn');
  return 'fallito';
}

export async function copySpartito(s: Services, spartito: string): Promise<boolean> {
  if (!spartito) {
    s.ui.toast('ui.risultato.spartitoAssente', undefined, 'warn');
    return false;
  }
  const ok = await s.platform.copy(spartito);
  s.ui.toast(ok ? 'ui.risultato.spartitoCopiato' : 'ui.condividi.nonRiuscito', undefined, ok ? 'ok' : 'warn');
  return ok;
}

export interface ResultsHandlers {
  onAgain: () => void;
  onBack: () => void;
  onNew?: () => void;
}

export interface ResultsView {
  el: HTMLElement;
  /** Azioni principali, da mettere nel piede del foglio. */
  foot: HTMLElement;
  destroy(): void;
}

/** Foglio dei risultati. */
export function resultsSheet(s: Services, info: ResultInfo, h: ResultsHandlers): ResultsView {
  const m = info.metrics;
  let url: string | null = null;
  let destroyed = false;
  let playing: Playing | null = null;
  const imgBox = el('figure', { class: 'sc-merletto', test: 'sc-risultato-immagine', attrs: { 'aria-busy': 'true' } }, textOf('ui.risultato.immagineAttesa', undefined, 'span', { className: 'sc-merletto-attesa' }));
  // L'immagine si prepara una volta: serve al foglio e alla condivisione.
  const png = lacePng(info);
  void png.then((blob) => {
    if (destroyed || !blob) return;
    url = URL.createObjectURL(blob);
    const img = el('img', { attrs: { src: url, alt: s.i18n.t('ui.risultato.immagineAlt'), draggable: 'false' } });
    imgBox.replaceChildren(img);
    imgBox.setAttribute('aria-busy', 'false');
  });

  const incroci = el(
    'span',
    null,
    textOf(info.min !== null ? 'ui.risultato.incrociValore' : 'ui.risultato.incrociSolo', { n: m.incroci, min: info.min ?? 0 }, 'span'),
  );
  const stats = el(
    'div',
    { class: 'sc-stats', test: 'sc-risultato-eleganza' },
    statRow('ui.risultato.incroci', incroci, 'sc-risultato-incroci'),
    statRow('ui.risultato.quiete', textOf('ui.risultato.quieteValore', { n: m.quiete }, 'span'), 'sc-risultato-quiete'),
    statRow('ui.risultato.simmetria', textOf(m.simmetria ? 'ui.risultato.simmetriaSi' : 'ui.risultato.no', undefined, 'span'), 'sc-risultato-simmetria'),
    statRow('ui.risultato.filoDOro', textOf(m.filoDOro ? 'ui.risultato.filoDOroSi' : 'ui.risultato.no', undefined, 'span'), 'sc-risultato-filo'),
  );
  if (m.filoDOro) stats.classList.add('sc-stats--oro');

  const extra = el('div', { class: 'sc-stats sc-stats--record' });
  if (info.origin === 'giornaliero' && info.daily) {
    extra.appendChild(statRow('ui.risultato.recordGiorno', textOf('ui.risultato.incrociSolo', { n: info.daily.incroci }, 'span'), 'sc-risultato-record'));
    extra.appendChild(statRow('ui.risultato.serie', textOf('ui.giornaliero.serieValore', { n: info.streak ?? 0 }, 'span'), 'sc-risultato-serie'));
  } else if (info.origin === 'libero' && info.record && info.record.minIncroci !== null) {
    extra.appendChild(statRow('ui.risultato.recordLivello', textOf('ui.risultato.incrociSolo', { n: info.record.minIncroci }, 'span'), 'sc-risultato-record'));
    extra.appendChild(statRow('ui.libero.punti', textOf('ui.libero.puntiValore', { n: info.gradi.length }, 'span'), 'sc-risultato-punti'));
  }
  const badge =
    (info.origin === 'giornaliero' && info.dailyImproved) || (info.origin === 'libero' && info.improved)
      ? el('p', { class: 'sc-nuovo-record', test: 'sc-risultato-nuovo' }, icon('stella', 18), textOf('ui.risultato.nuovoRecord', undefined, 'span'))
      : null;

  // Fusi intagliati appena sbloccati (solo quelli già disegnati: gli altri arrivano con L2).
  const fusi = (info.cosmetics ?? []).filter((id) => hasCosmeticArt(s, id));
  const fusiNodes = fusi.map((id) =>
    el(
      'p',
      { class: 'sc-nuovo-fuso', test: `sc-risultato-fuso-${id}` },
      spindlePreview(s, `fuso/${id}`, 40),
      textOf('ui.risultato.fusoNuovo', { nome: s.i18n.t(cosmeticNameKey(id)) }, 'span'),
    ),
  );

  const share =
    info.origin === 'giornaliero'
      ? wideButton({ icon: 'condividi', labelKey: 'ui.risultato.condividi', kind: 'primario', onClick: () => void shareResult(s, info, png), test: 'sc-risultato-condividi' })
      : null;
  const copy = info.outcome.spartito
    ? wideButton({ icon: 'copia', labelKey: 'ui.risultato.copiaSpartito', kind: share ? 'secondario' : 'primario', onClick: () => void copySpartito(s, info.outcome.spartito), test: 'sc-risultato-copia' })
    : null;
  const listen = wideButton({
    icon: 'nota',
    labelKey: 'ui.risultato.riascolta',
    onClick: () => {
      playing?.stop();
      try {
        playing = s.audio.carillon(carillonScore(info.level, info.outcome));
      } catch {
        playing = null;
      }
    },
    test: 'sc-risultato-riascolta',
  });
  const again = wideButton({
    icon: 'ricomincia',
    labelKey: info.origin === 'spartito' ? 'ui.risultato.ritessiSpartito' : 'ui.risultato.ritessi',
    onClick: () => h.onAgain(),
    test: 'sc-risultato-ritessi',
  });
  const fresh = h.onNew ? wideButton({ icon: 'dado', labelKey: 'ui.risultato.nuovo', onClick: () => h.onNew?.(), test: 'sc-risultato-nuovo-merletto' }) : null;
  const back = wideButton({ icon: 'casa', labelKey: 'ui.risultato.torna', onClick: () => h.onBack(), test: 'sc-risultato-torna' });
  // Nel piede (sempre visibili): condividere e copiare lo spartito; nel foglio, il resto.
  const main = share ?? copy;
  if (main) main.dataset.autofocus = '1';
  const foot = buttonGroup(main ? [main] : [], 'sc-azioni', 'sc-risultato-principali', 'both');
  const rest = [share ? copy : null, listen, again, fresh, back].filter((b): b is HTMLButtonElement => !!b);
  const actions = buttonGroup(rest, 'sc-azioni', 'sc-risultato-azioni', 'vertical');

  const titleKey = info.origin === 'giornaliero' ? 'ui.risultato.titoloGiornaliero' : info.origin === 'libero' ? 'ui.risultato.titoloLibero' : 'ui.risultato.titoloSpartito';
  const root = el(
    'div',
    { class: 'sc-risultato', test: `sc-risultato-${info.origin}` },
    textOf(titleKey, undefined, 'h2', { className: 'sc-risultato-titolo' }),
    badge,
    ...fusiNodes,
    imgBox,
    stats,
    extra.childElementCount > 0 ? extra : null,
    info.origin === 'giornaliero' && info.shareText ? el('pre', { class: 'sc-condividi-anteprima', test: 'sc-risultato-testo', text: info.shareText }) : null,
    actions,
  );
  return {
    el: root,
    foot,
    destroy() {
      destroyed = true;
      playing?.stop();
      if (url) URL.revokeObjectURL(url);
    },
  };
}
