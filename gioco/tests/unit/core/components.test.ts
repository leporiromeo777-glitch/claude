// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  button,
  handStyle,
  iconButton,
  menuList,
  modal,
  paperCard,
  retranslate,
  slider,
  tabs,
  textOf,
  toggle,
} from '../../../src/core/ui/components';
import { el, on } from '../../../src/core/ui/dom';
import { glyph, GLYPHS, hasGlyph, svgIcon } from '../../../src/core/ui/glyphs';
import { installTestServices } from './helpers';

describe('dom e componenti', () => {
  let i18n: ReturnType<typeof installTestServices>['i18n'];
  beforeEach(() => {
    i18n = installTestServices().i18n;
    document.body.innerHTML = '';
  });

  it('el crea elementi con proprietà, dataset, stile e figli, senza HTML', () => {
    const click = vi.fn();
    const n = el('div', { class: ['a', false, 'b'], data: { x: 1 }, style: { '--c': 'red', marginTop: '2px' }, test: 't', on: { click } }, 'x<y', 3, null, [el('span')]);
    expect(n.className).toBe('a b');
    expect(n.dataset.x).toBe('1');
    expect(n.dataset.test).toBe('t');
    expect(n.style.getPropertyValue('--c')).toBe('red');
    expect(n.style.marginTop).toBe('2px');
    expect(n.textContent).toBe('x<y3');
    expect(n.querySelector('span')).not.toBeNull();
    n.click();
    expect(click).toHaveBeenCalledOnce();
    const other = vi.fn();
    const off = on(n, 'click', other);
    n.click();
    off();
    n.click();
    expect(other).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledTimes(3);
  });

  it('button e iconButton: testi da chiavi, etichetta accessibile, disabilitato', () => {
    const fn = vi.fn();
    const b = button({ labelKey: 'core.ui.ok', onClick: fn, kind: 'primario', test: 'ok' });
    expect(b.textContent).toBe('Va bene');
    expect(b.className).toContain('core-btn--primario');
    expect(b.type).toBe('button');
    b.click();
    expect(fn).toHaveBeenCalledOnce();
    const ib = iconButton({ icon: 'chiudi', labelKey: 'core.ui.chiudi', onClick: fn, size: 56 });
    expect(ib.getAttribute('aria-label')).toBe('Chiudi');
    expect(ib.style.getPropertyValue('--btn-size')).toBe('56px');
    const dis = button({ labelKey: 'core.ui.ok', onClick: fn, disabled: true });
    dis.click();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('retranslate aggiorna testi ed etichette al cambio di lingua', () => {
    const root = el('div', null, textOf('core.prova.conta', { n: 2 }), iconButton({ icon: 'chiudi', labelKey: 'core.ui.chiudi', onClick: () => undefined }));
    expect(root.textContent).toBe('2 fili');
    i18n.setLocale('en');
    retranslate(root);
    expect(root.textContent).toBe('2 threads');
    expect(root.querySelector('button')?.getAttribute('aria-label')).toBe('Close');
  });

  it('tabs: selezione, aria-selected e frecce', () => {
    const onSelect = vi.fn();
    const t = tabs({
      tabs: [
        { id: 'a', labelKey: 'core.ui.ok' },
        { id: 'b', labelKey: 'core.ui.annulla' },
      ],
      selected: 'a',
      onSelect,
      test: 'tb',
    });
    document.body.appendChild(t.el);
    const [a, b] = Array.from(t.el.querySelectorAll('button'));
    expect(a?.getAttribute('aria-selected')).toBe('true');
    b?.click();
    expect(onSelect).toHaveBeenCalledWith('b');
    expect(t.selected()).toBe('b');
    expect(b?.getAttribute('aria-selected')).toBe('true');
    expect(a?.tabIndex).toBe(-1);
  });

  it('slider e toggle', () => {
    const onInput = vi.fn();
    const s = slider({ labelKey: 'core.ui.ok', min: 0, max: 100, step: 5, value: 40, onInput, format: (v) => `${v}%` });
    expect(s.el.querySelector('output')?.textContent).toBe('40%');
    s.input.value = '55';
    s.input.dispatchEvent(new Event('input'));
    expect(onInput).toHaveBeenCalledWith(55);
    const onChange = vi.fn();
    const t = toggle({ labelKey: 'core.ui.ok', value: false, onChange });
    expect(t.el.getAttribute('role')).toBe('switch');
    expect(t.el.getAttribute('aria-checked')).toBe('false');
    t.el.click();
    expect(onChange).toHaveBeenCalledWith(true);
    expect(t.el.getAttribute('aria-checked')).toBe('true');
  });

  it('paperCard con calligrafia, modal e menuList', () => {
    const style = handStyle({ font: 'caveat', ink: '#24407A', paper: '#DCE6EE', slantDeg: -2, sizeScale: 1.1, caps: true });
    expect(style['--mano-inclinazione']).toBe('-2deg');
    expect(style['--mano-maiuscole']).toBe('uppercase');
    const card = paperCard({ children: ['ciao'], hand: { font: 'caveat', ink: '#000000', paper: '#ffffff', slantDeg: 1, sizeScale: 1 }, onClick: () => undefined });
    expect(card.tagName).toBe('BUTTON');
    expect(card.className).toContain('core-carta--mano');
    const m = modal({ titleKey: 'core.ui.ok', bodyKey: 'core.prova.ciao', actions: [button({ labelKey: 'core.ui.annulla', onClick: () => undefined })] });
    expect(m.getAttribute('role')).toBe('dialog');
    expect(m.querySelector('em')?.textContent).toBe('mondo');
    const list = menuList([button({ labelKey: 'core.ui.ok', onClick: () => undefined }), button({ labelKey: 'core.ui.annulla', onClick: () => undefined })]);
    expect(list.getAttribute('role')).toBe('group');
  });

  it('glifi: tutte le icone dei personaggi del GDD 5.4 esistono', () => {
    for (const name of ['busta', 'pagnotta', 'croce', 'aquilone', 'pesce', 'libro', 'lanterna', 'ampolla', 'scialle', 'fuso', 'forbici']) {
      expect(hasGlyph(name)).toBe(true);
    }
    for (const name of ['bitta', 'pozzo', 'campanile', 'mortaio', 'faro']) expect(hasGlyph(name)).toBe(true);
    expect(glyph('inesistente').d.length).toBeGreaterThan(0);
    const svg = svgIcon('busta', { label: 'Lettera' });
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.querySelector('path')?.getAttribute('d')).toBe(GLYPHS.busta?.d);
  });
});
