// Prova temporanea: dove stanno davvero le cose rispetto ai luoghi dei contenuti (NON committare).
import { avvia } from './_prova-base.mjs';

const { page, R, fine } = await avvia();
try {
  await page.getByRole('button', { name: 'Nuova partita' }).click();
  await R(() => window.__GAME__.regia.avanza(0.5));
  const out = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    const res = {};
    const punti = ['cartellino', 'innesto', 'muretto', 'bacheca', 'fienile', 'ramo_vivo', 'lente_ricci', 'lente_amenti', 'lente_corteccia', 'lente_innesto_vecchio', 'chiodo_cs_2', 'chiodo_cs_3', 'chiodo_cs_7', 'chiodo_cs_8', 'porta_campanile', 'telo', 'scatola_pina', 'botola', 'castagno_morto', 'segnale_cs_1'];
    for (const id of punti) {
      const p = G.posizione(id);
      res[id] = p ? p.map((x) => Math.round(x * 100) / 100) : null;
    }
    const luoghi = {};
    for (const l of r.luoghi.tutti) luoghi[l.id] = [l.z, l.theta, Math.round(r.luoghi.quota(l.id) * 10) / 10, l.raggio, l.altezza];
    return { punti: res, luoghi };
  });
  console.log(JSON.stringify(out.punti, null, 0));
  for (const [k, v] of Object.entries(out.luoghi)) console.log(k, JSON.stringify(v));
  // per alcuni bersagli: andarci vicino e vedere in che luoghi si è
  await R(() => window.__GAME__.regia.vai('piazza_ore'));
  for (const id of ['cartellino', 'innesto', 'bacheca', 'fienile', 'muretto', 'telo', 'porta_campanile', 'chiodo_cs_3', 'chiodo_cs_2', 'chiodo_cs_7', 'chiodo_cs_8']) {
    for (const d of [1.0, 2.0, 3.0]) {
      const s = await R(([i, dd]) => {
        const G = window.__GAME__.regia;
        G.avvicina(i, dd);
        G.avanza(0.05);
        const st = G.stato();
        return { luoghi: st.luoghi, pos: st.posizione, bersaglio: st.bersaglio };
      }, [id, d]);
      console.log(`${id} @${d}m:`, s.luoghi.join(','), '| h', s.pos.h.toFixed(2), '| z', s.pos.z.toFixed(1), 'θ', s.pos.theta.toFixed(2), '| bersaglio', s.bersaglio);
    }
  }
} catch (e) {
  console.error(e);
}
await fine();
