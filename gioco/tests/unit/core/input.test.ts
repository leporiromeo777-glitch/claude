import { describe, expect, it, vi } from 'vitest';
import type { ActionEvent, Gesture } from '../../../src/core/types';
import { createInput, focusContextOf } from '../../../src/core/input';
import { createAudioStub } from '../../../src/core/audio-stub';

describe('InputRouter senza DOM', () => {
  it('simulate.tap produce un tap', () => {
    const input = createInput();
    const got: Gesture[] = [];
    input.onGesture((g) => {
      got.push(g);
      return true;
    });
    input.simulate.tap(10, 20, 'touch');
    expect(got).toEqual([{ k: 'tap', x: 10, y: 20, pointer: 'touch', button: 0 }]);
  });

  it('simulate.drag produce un trascinamento completo', async () => {
    const input = createInput({ simulateStepMs: 1 });
    const got: string[] = [];
    input.onGesture((g) => {
      got.push(g.k);
      return true;
    });
    await input.simulate.drag(0, 0, 100, 0, 5);
    expect(got[0]).toBe('dragstart');
    expect(got.at(-1)).toBe('dragend');
    expect(got.filter((k) => k === 'drag').length).toBeGreaterThanOrEqual(3);
  });

  it('livelli modali: riceve solo il livello in cima', () => {
    const input = createInput();
    const base: string[] = [];
    const over: string[] = [];
    input.onAction((a) => {
      base.push(a.action);
      return true;
    });
    const pop = input.pushLayer('pausa');
    input.onAction((a) => {
      over.push(a.action);
      return a.action === 'back';
    });
    expect(input.layers()).toEqual(['base', 'pausa']);
    input.simulate.action('undo');
    input.simulate.action('back');
    expect(over).toEqual(['undo', 'back']);
    expect(base).toEqual([]);
    pop();
    input.simulate.action('undo');
    expect(base).toEqual(['undo']);
    expect(input.layers()).toEqual(['base']);
    // I gestori del livello chiuso sono scartati.
    const pop2 = input.pushLayer('altro');
    input.simulate.action('hint');
    expect(over).toEqual(['undo', 'back']);
    pop2();
  });

  it('l’ultimo registrato ha la precedenza; un gestore che lancia non blocca', () => {
    const input = createInput();
    const seen: string[] = [];
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    input.onAction(() => {
      seen.push('primo');
      return true;
    });
    input.onAction(() => {
      throw new Error('x');
    });
    const off = input.onAction(() => {
      seen.push('ultimo');
      return false;
    });
    input.simulate.action('flip');
    expect(seen).toEqual(['ultimo', 'primo']);
    off();
    seen.length = 0;
    expect(input.dispatchAction({ action: 'flip', repeat: false, source: 'ui' })).toBe(true);
    expect(seen).toEqual(['primo']);
  });

  it('simulate.action porta indice e sorgente debug', () => {
    const input = createInput();
    let ev: ActionEvent | null = null;
    input.onAction((a) => {
      ev = a;
      return true;
    });
    input.simulate.action('select', 3);
    expect(ev).toEqual({ action: 'select', index: 3, repeat: false, source: 'debug' });
  });

  it('observe vede tutto, anche ciò che nessuno gestisce', () => {
    const input = createInput();
    const recs: string[] = [];
    input.observe((r) => recs.push(`${r.kind}:${r.handled}`));
    input.simulate.tap(1, 1);
    input.simulate.action('hint');
    expect(recs).toEqual(['gesture:false', 'action:false']);
  });

  it('focusContextOf', () => {
    expect(focusContextOf(null)).toBe('none');
    const fake = (tag: string, extra: Record<string, unknown> = {}) =>
      ({ tagName: tag.toUpperCase(), isContentEditable: false, getAttribute: () => null, hasAttribute: () => true, ...extra }) as unknown as EventTarget;
    expect(focusContextOf(fake('textarea'))).toBe('text');
    expect(focusContextOf(fake('input', { type: 'text' }))).toBe('text');
    expect(focusContextOf(fake('input', { type: 'range' }))).toBe('interactive');
    expect(focusContextOf(fake('button'))).toBe('interactive');
    expect(focusContextOf(fake('div'))).toBe('none');
  });

  it('lo stub audio parte bloccato e si sblocca', () => {
    const a = createAudioStub();
    expect(a.state()).toBe('locked');
    a.unlock();
    expect(a.state()).toBe('running');
    a.suspend();
    expect(a.state()).toBe('suspended');
    a.resume();
    expect(a.state()).toBe('running');
  });
});
