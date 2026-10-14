/**
 * Impostazioni (GDD 10.3 "Impostazioni", GDD 14; ARCHITETTURA 9): tutti i campi
 * di `Settings`, applicati subito (SettingsStore li porta su `<html>` e sul bus)
 * e salvati; salvataggi: Esporta (stringa da copiare), Importa (con conferma),
 * Cancella tutto (doppia conferma).
 *
 * Lo stesso pannello serve alla scena 'impostazioni' (dal titolo) e
 * all'overlay 'impostazioni' (dal menu Pausa, sopra la notte): lì Importa e
 * Cancella tutto non ci sono, perché sostituirebbero il salvataggio sotto una
 * notte aperta.
 */
import type { Locale, Services, Settings } from '../core/types';
import { el } from '../core/ui/dom';
import { slider, textOf, toggle, type SliderHandle, type ToggleHandle } from '../core/ui/components';
import { messageLine, section, segmented, wideButton, type SegmentedHandle } from './widgets';

export interface SettingsPanelOptions {
  /** true: aperto sopra la notte (niente Importa e Cancella tutto). */
  overlay: boolean;
  /** Dopo Cancella tutto (la scena torna al titolo). */
  onWiped?: () => void;
}

export interface SettingsPanel {
  el: HTMLElement;
  /** Riallinea i controlli alle impostazioni correnti (dopo un import). */
  refresh(): void;
  destroy(): void;
}

const VOLUMES: readonly (keyof Settings['volume'])[] = ['master', 'music', 'sfx', 'voice'];
const SPEEDS: readonly Settings['animSpeed'][] = [0.5, 1, 2, 0];
const SPEED_KEY: Record<Settings['animSpeed'], string> = { 0: 'ui.impostazioni.velocita.istantanea', 0.5: 'ui.impostazioni.velocita.lenta', 1: 'ui.impostazioni.velocita.normale', 2: 'ui.impostazioni.velocita.veloce' };
const LOCALES: readonly Locale[] = ['it', 'en'];

export function buildSettingsPanel(s: Services, o: SettingsPanelOptions): SettingsPanel {
  const cur = (): Settings => s.settings.get();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Le scritture del salvataggio sono raggruppate: qui si fanno partire subito (sopravvive a un ricaricamento). */
  const persist = (soon = false): void => {
    if (flushTimer !== null) clearTimeout(flushTimer);
    flushTimer = null;
    if (soon) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void s.save.flush();
      }, 250);
    } else {
      void s.save.flush();
    }
  };
  const apply = (p: Partial<Settings>, soon = false): void => {
    s.settings.set(p);
    persist(soon);
  };
  const pct = (v: number): string => s.i18n.t('ui.impostazioni.percento', { n: Math.round(v * 100) });

  // ───── Suono ─────
  const volumes = new Map<keyof Settings['volume'], SliderHandle>();
  for (const k of VOLUMES) {
    const h = slider({
      labelKey: `ui.impostazioni.volume.${k}`,
      min: 0,
      max: 100,
      step: 5,
      value: Math.round(cur().volume[k] * 100),
      format: (v) => pct(v / 100),
      onInput: (v) => apply({ volume: { ...cur().volume, [k]: v / 100 } }, true),
      test: `sc-impostazioni-volume-${k}`,
    });
    h.input.addEventListener('change', () => persist());
    volumes.set(k, h);
  }

  // ───── Testo e immagini ─────
  const textScale = slider({
    labelKey: 'ui.impostazioni.testo',
    min: 90,
    max: 140,
    step: 10,
    value: Math.round(cur().textScale * 100),
    format: (v) => pct(v / 100),
    onInput: (v) => apply({ textScale: v / 100 }, true),
    test: 'sc-impostazioni-testo',
  });
  textScale.input.addEventListener('change', () => persist());
  const contrast = toggle({
    labelKey: 'ui.impostazioni.contrasto',
    descriptionKey: 'ui.impostazioni.contrastoDesc',
    value: cur().highContrast,
    onChange: (v) => apply({ highContrast: v }),
    test: 'sc-impostazioni-contrasto',
  });
  const motion = toggle({
    labelKey: 'ui.impostazioni.movimento',
    descriptionKey: 'ui.impostazioni.movimentoDesc',
    value: cur().reducedMotion,
    onChange: (v) => apply({ reducedMotion: v }),
    test: 'sc-impostazioni-movimento',
  });
  const speed: SegmentedHandle<Settings['animSpeed']> = segmented({
    labelKey: 'ui.impostazioni.velocita.etichetta',
    options: SPEEDS.map((v) => ({ value: v, labelKey: SPEED_KEY[v] })),
    value: cur().animSpeed,
    onChange: (v) => apply({ animSpeed: v }),
    test: 'sc-impostazioni-velocita',
  });

  // ───── Gioco ─────
  const toggles: [keyof Pick<Settings, 'haptics' | 'captions' | 'autoAdvance'>, ToggleHandle][] = (['haptics', 'captions', 'autoAdvance'] as const).map((k) => [
    k,
    toggle({
      labelKey: `ui.impostazioni.${k}`,
      descriptionKey: `ui.impostazioni.${k}Desc`,
      value: cur()[k],
      onChange: (v) => {
        apply({ [k]: v } as Partial<Settings>);
        if (k === 'haptics' && v) s.haptics.play('leggero');
      },
      test: `sc-impostazioni-${k}`,
    }),
  ]);

  // ───── Lingua ─────
  const lang: SegmentedHandle<Locale> = segmented({
    labelKey: 'ui.impostazioni.lingua',
    options: LOCALES.map((l) => ({ value: l, labelKey: `ui.impostazioni.lingue.${l}` })),
    value: cur().locale,
    onChange: (v) => apply({ locale: v }),
    test: 'sc-impostazioni-lingua',
  });

  // ───── Salvataggi ─────
  const msg = messageLine('sc-impostazioni-messaggio');
  const exportBox = el('textarea', {
    class: 'sc-campo sc-campo--codice',
    attrs: { readonly: true, rows: 3, spellcheck: 'false', 'aria-label': s.i18n.t('ui.impostazioni.esportaCampo') },
    data: { i18nLabel: 'ui.impostazioni.esportaCampo' },
    test: 'sc-impostazioni-esporta-testo',
  });
  exportBox.hidden = true;
  exportBox.addEventListener('focus', () => exportBox.select());
  const exportBtn = wideButton({
    icon: 'esporta',
    labelKey: 'ui.impostazioni.esporta',
    subKey: 'ui.impostazioni.esportaDesc',
    onClick: () => {
      const str = s.save.exportString();
      exportBox.value = str;
      exportBox.hidden = false;
      void s.platform.copy(str).then((ok) => {
        msg.show(ok ? 'ui.impostazioni.esportato' : 'ui.impostazioni.esportatoNonCopiato', undefined, ok ? 'ok' : 'info');
      });
    },
    test: 'sc-impostazioni-esporta',
  });
  const saveItems: HTMLElement[] = [exportBtn, exportBox];
  let importField: HTMLTextAreaElement | null = null;

  if (!o.overlay) {
    const importBox = el('textarea', {
      class: 'sc-campo sc-campo--codice',
      attrs: { rows: 3, spellcheck: 'false', autocomplete: 'off', placeholder: s.i18n.t('ui.impostazioni.importaSegnaposto'), 'aria-label': s.i18n.t('ui.impostazioni.importaCampo') },
      data: { i18nLabel: 'ui.impostazioni.importaCampo' },
      test: 'sc-impostazioni-importa-testo',
    });
    importField = importBox;
    const importGo = wideButton({
      icon: 'spunta',
      labelKey: 'ui.impostazioni.importaConferma',
      kind: 'primario',
      onClick: () => void doImport(),
      test: 'sc-impostazioni-importa-ok',
    });
    const importArea = el('div', { class: 'sc-importa', test: 'sc-impostazioni-importa-area' }, importBox, importGo);
    importArea.hidden = true;
    const importBtn = wideButton({
      icon: 'importa',
      labelKey: 'ui.impostazioni.importa',
      subKey: 'ui.impostazioni.importaDesc',
      onClick: () => {
        importArea.hidden = !importArea.hidden;
        if (!importArea.hidden) importBox.focus();
      },
      test: 'sc-impostazioni-importa',
    });
    const doImport = async (): Promise<void> => {
      const text = importBox.value.trim();
      if (!text) {
        msg.show('ui.impostazioni.importaVuoto', undefined, 'errore');
        importBox.focus();
        return;
      }
      const ok = await s.ui.confirm({
        titleKey: 'ui.impostazioni.importaDomanda.titolo',
        bodyKey: 'ui.impostazioni.importaDomanda.corpo',
        okKey: 'ui.impostazioni.importaDomanda.ok',
        cancelKey: 'ui.impostazioni.importaDomanda.annulla',
        danger: true,
      });
      if (!ok) return;
      const r = s.save.importString(text);
      if (!r.ok) {
        msg.show(r.errorKey ?? 'core.save.import.formato', undefined, 'errore');
        return;
      }
      await s.save.flush();
      importBox.value = '';
      importArea.hidden = true;
      refresh();
      msg.show('core.save.import.ok', undefined, 'ok');
      s.ui.toast('core.save.import.ok', undefined, 'ok');
    };
    const wipeBtn = wideButton({
      icon: 'cestino',
      labelKey: 'ui.impostazioni.cancella',
      subKey: 'ui.impostazioni.cancellaDesc',
      kind: 'pericolo',
      onClick: () => void doWipe(),
      test: 'sc-impostazioni-cancella',
    });
    const doWipe = async (): Promise<void> => {
      const first = await s.ui.confirm({
        titleKey: 'ui.impostazioni.cancellaDomanda1.titolo',
        bodyKey: 'ui.impostazioni.cancellaDomanda1.corpo',
        okKey: 'ui.impostazioni.cancellaDomanda1.ok',
        cancelKey: 'ui.impostazioni.cancellaDomanda1.annulla',
        danger: true,
      });
      if (!first) return;
      const second = await s.ui.confirm({
        titleKey: 'ui.impostazioni.cancellaDomanda2.titolo',
        bodyKey: 'ui.impostazioni.cancellaDomanda2.corpo',
        okKey: 'ui.impostazioni.cancellaDomanda2.ok',
        cancelKey: 'ui.impostazioni.cancellaDomanda2.annulla',
        danger: true,
      });
      if (!second) return;
      await s.save.wipe();
      s.ui.toast('ui.impostazioni.cancellato', undefined, 'ok');
      refresh();
      o.onWiped?.();
    };
    saveItems.push(importBtn, importArea, wipeBtn);
  }
  saveItems.push(msg.el);

  const root = el(
    'div',
    { class: 'sc-impostazioni', test: o.overlay ? 'sc-impostazioni-pannello' : 'sc-impostazioni-corpo' },
    section('ui.impostazioni.sezioni.suono', 'suono', 'sc-impostazioni-suono', ...[...volumes.values()].map((v) => v.el)),
    section('ui.impostazioni.sezioni.vista', 'occhio', 'sc-impostazioni-vista', textScale.el, contrast.el, motion.el, speed.el),
    section('ui.impostazioni.sezioni.gioco', 'mano', 'sc-impostazioni-gioco', ...toggles.map(([, t]) => t.el)),
    section('ui.impostazioni.sezioni.lingua', 'lingua', 'sc-impostazioni-lingue', lang.el),
    section('ui.impostazioni.sezioni.salvataggi', 'salva', 'sc-impostazioni-salvataggi', textOf('ui.impostazioni.salvatoSempre', undefined, 'p', { className: 'sc-nota' }), ...saveItems),
  );

  function refresh(): void {
    const st = cur();
    for (const k of VOLUMES) volumes.get(k)?.set(Math.round(st.volume[k] * 100));
    textScale.set(Math.round(st.textScale * 100));
    contrast.set(st.highContrast);
    motion.set(st.reducedMotion);
    speed.set(st.animSpeed);
    for (const [k, t] of toggles) t.set(st[k]);
    lang.set(st.locale);
    if (importField) importField.placeholder = s.i18n.t('ui.impostazioni.importaSegnaposto');
  }
  // Impostazioni cambiate altrove (debug, import): i controlli seguono.
  const off = s.bus.on('settings:change', () => refresh());

  return {
    el: root,
    refresh,
    destroy() {
      off();
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
        void s.save.flush();
      }
    },
  };
}
