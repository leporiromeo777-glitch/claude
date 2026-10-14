import { describe, expect, it } from 'vitest';
import { mapKey } from '../../../src/core/keymap';

describe('tastiera (GDD 11.3)', () => {
  const cases: [Parameters<typeof mapKey>[0], string | null, number?][] = [
    [{ key: 'ArrowLeft' }, 'left'],
    [{ key: 'ArrowRight' }, 'right'],
    [{ key: 'ArrowUp' }, 'up'],
    [{ key: 'ArrowDown' }, 'down'],
    [{ key: 'PageUp' }, 'pageUp'],
    [{ key: 'PageDown' }, 'pageDown'],
    [{ key: '1', code: 'Digit1' }, 'select', 0],
    [{ key: '6', code: 'Digit6' }, 'select', 5],
    [{ key: '&', code: 'Digit1' }, 'select', 0], // tastiere AZERTY
    [{ key: '7', code: 'Digit7' }, null],
    [{ key: ' ' }, 'crossL'],
    [{ key: ' ', shiftKey: true }, 'crossR'],
    [{ key: 'f' }, 'flip'],
    [{ key: 'F' }, 'flip'],
    [{ key: 'Enter' }, 'confirm'],
    [{ key: 'Backspace' }, 'undo'],
    [{ key: 'z' }, 'undo'],
    [{ key: 'z', ctrlKey: true }, 'undo'],
    [{ key: 'Tab' }, 'notebook'],
    [{ key: 'Tab', shiftKey: true }, 'tab'],
    [{ key: 'h' }, 'hint'],
    [{ key: 'n' }, 'name'],
    [{ key: 'Escape' }, 'back'],
    [{ key: 'p' }, 'pause'],
    [{ key: 's' }, 'skip'],
    [{ key: 'a' }, 'auto'],
    [{ key: 'r', ctrlKey: true }, null], // Ctrl+R resta al browser
    [{ key: 'q' }, null],
  ];
  for (const [k, action, index] of cases) {
    it(`${JSON.stringify(k)} → ${String(action)}`, () => {
      const r = mapKey(k);
      if (action === null) expect(r).toBeNull();
      else {
        expect(r?.action).toBe(action);
        if (index !== undefined) expect(r?.index).toBe(index);
      }
    });
  }

  it('ripetizione solo per frecce e pagine', () => {
    expect(mapKey({ key: 'ArrowLeft', repeat: true })).toEqual({ action: 'left', repeat: true });
    expect(mapKey({ key: 'PageDown', repeat: true })?.repeat).toBe(true);
    expect(mapKey({ key: ' ', repeat: true })).toBeNull();
    expect(mapKey({ key: 'Enter', repeat: true })).toBeNull();
  });

  it('nei campi di testo solo Esc', () => {
    expect(mapKey({ key: 'z' }, 'text')).toBeNull();
    expect(mapKey({ key: 'Tab' }, 'text')).toBeNull();
    expect(mapKey({ key: 'Escape' }, 'text')?.action).toBe('back');
  });

  it('su un controllo con il fuoco Invio, Spazio e frecce restano al browser', () => {
    expect(mapKey({ key: 'Enter' }, 'interactive')).toBeNull();
    expect(mapKey({ key: ' ' }, 'interactive')).toBeNull();
    expect(mapKey({ key: 'ArrowDown' }, 'interactive')).toBeNull();
    expect(mapKey({ key: 'Escape' }, 'interactive')?.action).toBe('back');
    expect(mapKey({ key: 'Tab' }, 'interactive')?.action).toBe('notebook');
  });
});
