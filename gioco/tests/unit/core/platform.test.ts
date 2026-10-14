// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createPlatform } from '../../../src/core/platform';

function setVisibility(v: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('piattaforma web', () => {
  it('web, non nativo; pausa e ripresa solo sulle transizioni', async () => {
    setVisibility('visible');
    const p = await createPlatform(window);
    expect(p.native).toBe(false);
    expect(p.os).toBe('web');
    const seen: string[] = [];
    p.onPause(() => seen.push('pause'));
    p.onResume(() => seen.push('resume'));
    setVisibility('hidden');
    window.dispatchEvent(new Event('pagehide'));
    setVisibility('visible');
    window.dispatchEvent(new Event('pageshow'));
    expect(seen).toEqual(['pause', 'resume']);
    expect(p.active()).toBe(true);
    p.destroy();
  });

  it('catena di Indietro dal più recente', async () => {
    const p = await createPlatform(window);
    const seen: string[] = [];
    p.onBack(() => (seen.push('vecchio'), true));
    const off = p.onBack(() => (seen.push('nuovo'), false));
    expect(p.triggerBack()).toBe(true);
    expect(seen).toEqual(['nuovo', 'vecchio']);
    off();
    p.destroy();
  });

  it('copia con l’API Clipboard; condivisione senza Web Share → false', async () => {
    const p = await createPlatform(window);
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await expect(p.copy('TRAMA1-Sg00')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('TRAMA1-Sg00');
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    await expect(p.share({ text: 'x' })).resolves.toBe(false);
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    await expect(p.share({ text: 'TRAMA 14/10', title: 'Trama' })).resolves.toBe(true);
    expect(share).toHaveBeenCalledWith({ text: 'TRAMA 14/10', title: 'Trama' });
    // Su web exitApp e hideSplash non fanno nulla (e non lanciano).
    expect(() => {
      p.exitApp();
      p.hideSplash();
      p.keepAwake(false);
    }).not.toThrow();
    p.destroy();
  });
});
