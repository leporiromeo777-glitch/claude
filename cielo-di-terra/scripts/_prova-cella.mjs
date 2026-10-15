// Prova temporanea: si può cadere dalla terrazza del campanile? (NON committare).
import { avvia } from './_prova-base.mjs';

const { page, R, fine } = await avvia();
try {
  await page.getByRole('button', { name: 'Nuova partita' }).click();
  await R(() => window.__GAME__.regia.avanza(0.5));
  for (const yaw of [0, 90, 180, 270, 45, 135]) {
    const e = await R((yaw) => {
      const G = window.__GAME__.regia;
      const r = G.regia;
      const g = r.game;
      G.vai('piazza_ore');
      r.saliCampanile();
      G.avanza(0.2);
      const s0 = G.stato();
      G.sguardo(yaw, 0);
      g.input.simulate('KeyW', true);
      g.input.simulate('Space', true);
      g.loop.stepUpdates(60 * 4);
      g.input.simulate('Space', false);
      g.loop.stepUpdates(60 * 6);
      g.input.simulate('KeyW', false);
      g.loop.stepUpdates(5);
      const s1 = G.stato();
      return { yaw, prima: [s0.posizione.h.toFixed(1), s0.luoghi.join(',')], dopo: [s1.interno, s1.posizione.z.toFixed(1), s1.posizione.theta.toFixed(2), s1.posizione.h.toFixed(1), s1.luoghi.join(',')], quotaPav: r.cella.quotaPavimento };
    }, yaw);
    console.log(JSON.stringify(e));
  }
} catch (e) {
  console.error(e);
}
await fine();
