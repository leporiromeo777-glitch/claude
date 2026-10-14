import { describe, expect, it } from 'vitest';
import { KEY_HELP, keyLabelParts, mapKey, type KeyInfo } from '../../../src/core/keymap';
import { ACTION_IDS } from '../../../src/core/ids';

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
    [{ key: 'Enter', shiftKey: true }, 'skipQuiet'], // revisione 1: «Salta le ore quiete»
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

describe('pagina dei comandi generata dalla mappa (revisione 1, C10)', () => {
  it('ogni tasto elencato produce davvero le azioni della sua riga', () => {
    for (const h of KEY_HELP) {
      for (const k of h.keys) {
        const r = mapKey(k);
        expect(r, `${h.id} ${JSON.stringify(k)}`).not.toBeNull();
        expect(h.actions).toContain(r?.action);
      }
    }
  });

  it('ogni azione che un tasto può produrre è elencata', () => {
    const universe: KeyInfo[] = [];
    const names = [
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Enter', 'Backspace',
      'Delete', 'Tab', 'Escape', ...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''),
    ];
    for (const key of names)
      for (const shiftKey of [false, true])
        for (const ctrlKey of [false, true]) universe.push({ key, shiftKey, ctrlKey, code: /^[0-9]$/.test(key) ? `Digit${key}` : undefined });
    const produced = new Set(universe.map((k) => mapKey(k)?.action).filter((a): a is NonNullable<typeof a> => !!a));
    const listed = new Set(KEY_HELP.flatMap((h) => h.actions));
    for (const a of produced) expect(listed.has(a), a).toBe(true);
    // E nessuna azione elencata è inventata.
    for (const a of listed) expect(ACTION_IDS).toContain(a);
  });

  it('etichette dei tasti: modificatori e nomi', () => {
    expect(keyLabelParts({ key: 'Enter', shiftKey: true })).toEqual({ mods: ['maiusc'], name: 'invio', named: true });
    expect(keyLabelParts({ key: 'z', ctrlKey: true })).toEqual({ mods: ['ctrl'], name: 'Z', named: false });
    expect(keyLabelParts({ key: 'ArrowLeft' }).name).toBe('←');
    expect(keyLabelParts({ key: ' ' }).name).toBe('spazio');
  });
});
