// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { parseRich, plainText, richFromString, richText } from '../../../src/core/ui/richtext';
import { installTestServices } from './helpers';

describe('testo ricco', () => {
  beforeEach(() => {
    installTestServices();
  });

  it('analizza corsivo, grassetto, personaggi e a capo', () => {
    expect(parseRich('a *b* **c** [[teresa]]\nd')).toEqual([
      { k: 'text', v: 'a ' },
      { k: 'em', c: [{ k: 'text', v: 'b' }] },
      { k: 'text', v: ' ' },
      { k: 'strong', c: [{ k: 'text', v: 'c' }] },
      { k: 'text', v: ' ' },
      { k: 'pers', id: 'teresa' },
      { k: 'br' },
      { k: 'text', v: 'd' },
    ]);
  });

  it('annidamenti e marcatori non chiusi', () => {
    expect(parseRich('*a **b** c*')).toEqual([
      { k: 'em', c: [{ k: 'text', v: 'a ' }, { k: 'strong', c: [{ k: 'text', v: 'b' }] }, { k: 'text', v: ' c' }] },
    ]);
    expect(parseRich('**x *y* z**')).toEqual([
      { k: 'strong', c: [{ k: 'text', v: 'x ' }, { k: 'em', c: [{ k: 'text', v: 'y' }] }, { k: 'text', v: ' z' }] },
    ]);
    expect(parseRich('3 * 4 = 12')).toEqual([{ k: 'text', v: '3 * 4 = 12' }]);
    expect(parseRich('[[non chiuso')).toEqual([{ k: 'text', v: '[[non chiuso' }]);
    expect(plainText('**Ciao** [[teresa]]', () => 'Teresa')).toBe('Ciao Teresa');
  });

  it('costruisce nodi DOM senza interpretare HTML', () => {
    const frag = richFromString('<b>no</b> *sì* [[teresa]]', { t: (k) => k, character: () => ({ name: 'Teresa', color: '#2F5DA8', icon: 'busta' }) });
    const div = document.createElement('div');
    div.appendChild(frag);
    expect(div.querySelector('b')).toBeNull();
    expect(div.textContent).toBe('<b>no</b> sì Teresa');
    expect(div.querySelector('em')?.textContent).toBe('sì');
    const pers = div.querySelector('.core-pers') as HTMLElement;
    expect(pers.dataset.character).toBe('teresa');
    expect(pers.style.getPropertyValue('--pers-color')).toBe('#2F5DA8');
    expect(pers.querySelector('svg')).not.toBeNull();
  });

  it('richText usa i servizi: chiave, parametri e nome del personaggio', () => {
    const div = document.createElement('div');
    div.appendChild(richText('core.prova.ciao'));
    expect(div.innerHTML).toBe('Ciao <em>mondo</em>');
    const d2 = document.createElement('div');
    d2.appendChild(richFromString('[[teresa]]', { t: (k) => k, character: () => null }));
    expect(d2.textContent).toBe('teresa');
  });
});
