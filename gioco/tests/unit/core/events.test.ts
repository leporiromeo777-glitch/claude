import { describe, expect, it, vi } from 'vitest';
import { createBus, BUS_LOG_SIZE } from '../../../src/core/events';

interface M {
  a: { n: number };
  b: { s: string };
}

describe('bus di eventi', () => {
  it('on, once, emit, unsub', () => {
    const bus = createBus<M>();
    const seen: number[] = [];
    const off = bus.on('a', (p) => seen.push(p.n));
    bus.once('a', (p) => seen.push(p.n * 10));
    bus.emit('a', { n: 1 });
    bus.emit('a', { n: 2 });
    off();
    bus.emit('a', { n: 3 });
    expect(seen).toEqual([1, 10, 2]);
    expect(bus.listenerCount('a')).toBe(0);
  });

  it('un listener che lancia non ferma gli altri', () => {
    const onError = vi.fn();
    const bus = createBus<M>({ onError });
    const seen: string[] = [];
    bus.on('b', () => {
      throw new Error('x');
    });
    bus.on('b', (p) => seen.push(p.s));
    bus.emit('b', { s: 'ok' });
    expect(seen).toEqual(['ok']);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('registro degli ultimi 500 eventi', () => {
    let t = 0;
    const bus = createBus<M>({ now: () => t++ });
    for (let i = 0; i < 600; i++) bus.emit('a', { n: i });
    const all = bus.log();
    expect(all.length).toBe(BUS_LOG_SIZE);
    expect(all[0]?.p).toEqual({ n: 100 });
    expect(all.at(-1)?.p).toEqual({ n: 599 });
    expect(bus.log(3).map((e) => (e.p as { n: number }).n)).toEqual([597, 598, 599]);
    bus.clearLog();
    expect(bus.log()).toEqual([]);
  });

  it('chi si iscrive durante un emit non riceve quell’evento', () => {
    const bus = createBus<M>();
    const seen: number[] = [];
    bus.on('a', () => {
      bus.on('a', (p) => seen.push(p.n));
    });
    bus.emit('a', { n: 1 });
    expect(seen).toEqual([]);
    bus.emit('a', { n: 2 });
    expect(seen).toEqual([2]);
  });
});
