// Prova temporanea: quanto dura il Velo aperto cadendo da H metri (NON committare).
import { avvia } from './_prova-base.mjs';

const { page, R, fine } = await avvia();
try {
  await page.getByRole('button', { name: 'Nuova partita' }).click();
  await R(() => window.__GAME__.regia.avanza(0.5));
  for (const [dove, H] of [['piazza_ore', 3.5], ['piazza_ore', 5], ['piazza_ore', 8], ['muretto_terrazza', 3.5], ['muraglione_gra', 5], ['muraglione_gra', 8], ['ripa_san_vigilio', 12]]) {
    for (const ritardo of [0.1, 0.35]) {
      const esito = await R(([dove, H, ritardo]) => {
        const G = window.__GAME__.regia;
        const r = G.regia;
        const g = r.game;
        const L = r.luoghi.get(dove);
        G.vai(L.z, L.theta);
        G.avanza(0.05);
        // verso la piazza (in discesa per i muri)
        const P = r.luoghi.get('piazza_ore');
        const mpd = (646 * Math.PI) / 180;
        const yaw = dove === 'piazza_ore' ? 90 : (Math.atan2((P.theta - L.theta) * mpd, P.z - L.z) * 180) / Math.PI;
        r.spegni('planata_fatta');
        g.player.teleport(g.player.cyl.z, g.player.cyl.theta, H);
        G.sguardo(yaw, -8);
        // velocità del passo, in avanti
        const f = g.rig.forward(g.player.vel.clone());
        g.player.vel.copy(f).multiplyScalar(4.2);
        let t = 0;
        let velo = 0;
        let premuto = false;
        g.input.simulate('KeyW', true);
        for (let i = 0; i < 60 * 15; i++) {
          if (!premuto && t >= ritardo) {
            g.input.simulate('Space', true);
            premuto = true;
          }
          g.loop.stepUpdates(1);
          t += 1 / 60;
          if (g.player.veloOpen) velo += 1 / 60;
          if (g.player.grounded && t > 0.2) break;
        }
        g.input.simulate('KeyW', false);
        g.input.simulate('Space', false);
        g.loop.stepUpdates(2);
        return { dove, H, ritardo, volo: Math.round(t * 100) / 100, velo: Math.round(velo * 100) / 100, planata: r.narrativa.flag.vero('planata_fatta') };
      }, [dove, H, ritardo]);
      console.log(JSON.stringify(esito));
    }
  }
} catch (e) {
  console.error(e);
}
await fine();
