// Prova temporanea: un giocatore ingenuo cammina dritto verso la meta e salta quando è fermo (NON committare).
import { avvia } from './_prova-base.mjs';

const tratte = [
  ['botola→muretto', 'botola', 'belvedere_muretto'],
  ['muretto→castagno', 'belvedere_muretto', 'castagno_morto'],
  ['castagno→terrazza', 'castagno_morto', 'castagno_cartellino'],
  ['terrazza→piazza', 'castagno_cartellino', 'piazza_ore'],
  ['piazza→fienile', 'piazza_ore', 'fienile_ottavio'],
  ['fienile→guado→piazza', 'fienile_ottavio', 'guado_sass'],
  ['guado→piazza', 'guado_sass', 'piazza_ore'],
  ['piazza→sagrato', 'piazza_ore', 'sagrato'],
  ['piazza→terrazza', 'piazza_ore', 'terrazza_pedrazzini'],
  ['terrazza→mulino', 'terrazza_pedrazzini', 'mulino'],
  ['mulino→sass_messo', 'mulino', 'sass_messo'],
  ['prato→passerella', 'prato_ronco', 'passerella_messo'],
];
const { page, R, fine } = await avvia();
try {
  await page.getByRole('button', { name: 'Nuova partita' }).click();
  await R(() => window.__GAME__.regia.avanza(0.5));
  await R(() => {
    const G = window.__GAME__.regia;
    G.vai('piazza_ore');
    G.regia.flag('x');
    // passo e corsa normali (fuori dal prologo)
    G.regia.narrativa.missioni.completaPasso('prologo', 'pr_vetro');
  });
  for (const [nome, da, a] of tratte) {
    const e = await R(([da, a]) => {
      const G = window.__GAME__.regia;
      const r = G.regia;
      const g = r.game;
      const mpd = (646 * Math.PI) / 180;
      const A = r.luoghi.get(a);
      G.vai(da);
      G.avanza(0.2);
      const meta = { z: A.z, theta: A.theta, raggio: Math.max(3, Math.min(A.raggio, 6)) };
      let t = 0;
      let fermo = 0;
      let salti = 0;
      let ultimo = { ...g.player.cyl };
      const tappe = [];
      g.input.simulate('KeyW', true);
      g.input.simulate('ShiftLeft', true);
      while (t < 120) {
        const p = g.player.cyl;
        const dz = meta.z - p.z;
        const ds = (meta.theta - p.theta) * mpd;
        if (Math.hypot(dz, ds) < meta.raggio) break;
        G.sguardo((Math.atan2(ds, dz) * 180) / Math.PI, 0);
        g.loop.stepUpdates(15);
        t += 0.25;
        const mosso = Math.hypot(p.z - ultimo.z, (p.theta - ultimo.theta) * mpd);
        ultimo = { ...p };
        if (mosso < 0.15 && g.player.grounded) {
          fermo += 0.25;
          if (fermo >= 0.5) {
            g.input.simulate('Space', true);
            g.loop.stepUpdates(2);
            g.input.simulate('Space', false);
            salti++;
            fermo = 0;
            if (tappe.length < 6) tappe.push([p.z.toFixed(1), p.theta.toFixed(2), p.h.toFixed(1)]);
          }
        } else fermo = 0;
      }
      g.input.simulate('KeyW', false);
      g.input.simulate('ShiftLeft', false);
      g.loop.stepUpdates(2);
      const p = g.player.cyl;
      const resta = Math.hypot(meta.z - p.z, (meta.theta - p.theta) * mpd);
      return { t, salti, resta: Math.round(resta), tappe };
    }, [da, a]);
    console.log(`${nome}: ${e.resta <= 6 ? 'ARRIVATA' : 'NON ARRIVATA'} in ${e.t} s, ${e.salti} salti, resta ${e.resta} m ${e.salti ? JSON.stringify(e.tappe) : ''}`);
  }
} catch (e) {
  console.error(e);
}
await fine();
