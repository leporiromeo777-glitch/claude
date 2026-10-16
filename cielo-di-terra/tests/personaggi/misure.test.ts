/**
 * Misure stampate, per chi ritocca animatore e pipeline: per i 13 modelli veri braccia nelle pose, seduti
 * su un gradino, spigoli stirati, piedi che pattinano. Gira solo a richiesta:
 *
 *   MISURE=tutti npx vitest run tests/personaggi/misure.test.ts --reporter=verbose
 *   MISURE=togna,pina npx vitest run tests/personaggi/misure.test.ts --reporter=verbose
 *
 * Le prove con le soglie sono in forma.test.ts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { MODELLI, anima, estensione, figura, lod0, pattinamento, pesi, profiloGradino, profiloPiano, registraVeri, spigoli, stiramento, vertici } from './posa';

beforeAll(async () => {
  if (process.env['MISURE']) await registraVeri();
}, 120000);

describe.skipIf(!process.env['MISURE'])('misure (stampate)', () => {
  it('pose, seduta, piedi', () => {
    const solo = (process.env['MISURE'] ?? '').split(',').filter((x) => x && x !== 'tutti');
    for (const id of MODELLI) {
      if (solo.length && !solo.includes(id)) continue;
      const r: Record<string, unknown> = {};
      // riposo per lo stiramento
      const o = figura(id);
      anima(o, { modo: 'fermo' }, 2);
      const sp = spigoli(lod0(o));
      const riposo = vertici(o);
      // in piedi da fermi: quanto sporge di lato la figura all'altezza delle mani (la «lama» del cappuccio)
      const f0 = figura(id);
      anima(f0, { modo: 'fermo' }, 90);
      const v0 = vertici(f0);
      const H0 = (lod0(f0).parent ? 1 : 1) * Math.max(...Array.from({ length: v0.length / 3 }, (_, i) => v0[i * 3 + 1] as number));
      let lato = 0;
      for (let i = 0; i < v0.length / 3; i++) {
        const y = v0[i * 3 + 1] as number;
        if (y > 0.4 * H0 && y < 0.62 * H0) lato = Math.max(lato, Math.abs(v0[i * 3] as number) / H0);
      }
      r['lato'] = +lato.toFixed(3);
      for (const braccia of ['braccia-conserte', 'mani-giunte', 'mani-dietro'] as const) {
        const f = figura(id, { postura: braccia });
        anima(f, { modo: 'fermo' }, 120);
        r[braccia] = +Math.max(estensione(f, 'S'), estensione(f, 'D')).toFixed(2);
        const sb = stiramento(riposo, vertici(f), sp);
        r[`${braccia}-stira`] = +sb.max.toFixed(1);
        if (sb.max > 3) r[`${braccia}-dove`] = `${sb.dove.map((x) => x.toFixed(2)).join(',')} ${pesi(lod0(f), sb.vertice)} | ${sb.oltre3}`;
      }
      // seduto su un gradino di 0,45 m
      const s = figura(id);
      anima(s, { posa: 'seduto', profilo: profiloGradino(0.45, 0.1, 0) } as never, 120);
      const v = vertici(s);
      let sotto = 0;
      let peggio = 0;
      let quale = -1;
      for (let i = 0; i < v.length / 3; i++) {
        const y = v[i * 3 + 1] as number;
        const z = v[i * 3 + 2] as number;
        if (z < 0.08 && y < 0.45 - 0.03) {
          sotto++;
          if (0.45 - y > peggio) {
            peggio = 0.45 - y;
            quale = i;
          }
        }
      }
      if (quale >= 0) r['sotto-dove'] = `riposo ${[0, 1, 2].map((k) => (riposo[quale * 3 + k] as number).toFixed(2)).join(',')} ora ${[0, 1, 2].map((k) => (v[quale * 3 + k] as number).toFixed(2)).join(',')} ${pesi(lod0(s), quale)}`;
      const st = stiramento(riposo, v, sp);
      r['seduto-sotto'] = sotto;
      r['seduto-peggio'] = +peggio.toFixed(3);
      r['seduto-stira'] = +st.max.toFixed(1);
      r['seduto-stira-dove'] = `${st.dove.map((x) => x.toFixed(2)).join(',')} ${pesi(lod0(s), st.vertice)} | ${st.oltre3}`;
      const t = figura(id);
      anima(t, { posa: 'seduto', profilo: profiloPiano(0) } as never, 120);
      r['terra-stira'] = +stiramento(riposo, vertici(t), sp).max.toFixed(1);
      // camminata
      const c = figura(id);
      const pm = pattinamento(c, id === 'annunciata' ? 0.7 : id === 'lisa' || id === 'gioanin' ? 1.3 : 1.1);
      r['piedi'] = { medio: +pm.medio.toFixed(3), p95: +pm.p95.toFixed(3), alzata: +pm.alzata.toFixed(3), giu: +pm.abbassamento.toFixed(3), n: pm.campioni };
      console.log(id, JSON.stringify(r));
    }
    expect(MODELLI.length).toBe(13);
  }, 300000);
});
