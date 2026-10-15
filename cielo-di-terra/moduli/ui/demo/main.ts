import { creaRadice } from '../src/radice';
import { SchermataTitolo } from '../src/componenti/titolo';

const sfondi = import.meta.glob('./sfondi/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const canvas = document.getElementById('canvas-gioco') as HTMLCanvasElement;
const img = new Image();
img.src = sfondi['./sfondi/finale-1.jpg']!;
img.onload = () => {
  canvas.width = innerWidth; canvas.height = innerHeight;
  const ctx = canvas.getContext('2d')!;
  const sc = Math.max(canvas.width / img.width, canvas.height / img.height);
  ctx.drawImage(img, (canvas.width - img.width * sc) / 2, (canvas.height - img.height * sc) / 2, img.width * sc, img.height * sc);
};
const radice = creaRadice(document.getElementById('gioco')!);
const t = new SchermataTitolo().mount(radice);
t.show({ puoiContinuare: true, salvataggio: 'Giorno 3 · Corbella, alla brace', versione: '0.1' });
(window as unknown as { __UI_PRONTA__: boolean }).__UI_PRONTA__ = false;
document.fonts.ready.then(() => { setTimeout(() => ((window as unknown as { __UI_PRONTA__: boolean }).__UI_PRONTA__ = true), 300); });
