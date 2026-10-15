// Prova temporanea: fuori dalla botola si cammina? (NON committare).
import { avvia } from './_prova-base.mjs';

const { page, R, fine } = await avvia();
try {
  await page.getByRole('button', { name: 'Nuova partita' }).click();
  await R(() => window.__GAME__.regia.avanza(0.5));
  const s = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    const g = r.game;
    G.mira('scritta_vetro');
    G.avanza(4.5);
    G.premi('KeyE');
    G.avanza(2);
    G.avvicina('busta_5', 1.0);
    G.avanza(0.1);
    G.premi('KeyE');
    G.avvicina('armadietto_5', 1.1);
    G.avanza(0.1);
    G.premi('KeyE');
    G.avanza(0.5);
    G.avvicina('scala', 1.0);
    G.avanza(0.1);
    G.premi('KeyE');
    G.tieni('KeyW', 6.5);
    G.avanza(0.1);
    G.premi('KeyE');
    G.avanza(0.5);
    const out = [];
    const p0 = { ...g.player.cyl };
    out.push(['fuori', G.stato().interno, G.stato().controllo, g.movimentoBloccato, p0.z.toFixed(2), p0.theta.toFixed(3), p0.h.toFixed(2)]);
    G.sguardo(150, 72);
    G.avanza(1.8);
    const mpd = (646 * Math.PI) / 180;
    for (let yaw = 0; yaw < 360; yaw += 30) {
      g.player.teleport(p0.z, p0.theta, p0.h, true);
      G.avanza(0.3);
      const a = { ...g.player.cyl };
      G.sguardo(yaw, 0);
      g.input.simulate('KeyW', true);
      g.loop.stepUpdates(60 * 4);
      g.input.simulate('KeyW', false);
      g.loop.stepUpdates(2);
      const p = g.player.cyl;
      const d = Math.hypot(p.z - a.z, (p.theta - a.theta) * mpd);
      out.push([yaw, 'percorsi', d.toFixed(1), 'm', 'h', a.h.toFixed(2), '→', p.h.toFixed(2)]);
    }
    // che cosa blocca verso il paese
    g.player.teleport(p0.z, p0.theta, p0.h, true);
    G.avanza(0.3);
    G.sguardo(120, 0);
    g.input.simulate('KeyW', true);
    g.loop.stepUpdates(60 * 3);
    g.input.simulate('KeyW', false);
    const q = g.player.cyl;
    out.push(['fermo a', q.z.toFixed(2), q.theta.toFixed(3), q.h.toFixed(2), 'suolo', g.player.groundFn(q.z, q.theta).toFixed(2), 'mondo', g.player.pos.x.toFixed(2), g.player.pos.y.toFixed(2), g.player.pos.z.toFixed(2)]);
    // il collisore più vicino (distanza dal box, nel suo riferimento)
    for (const c of g.world.colliders.query(q.z, q.theta, 3, [])) {
      if (c.kind !== 'box') { out.push(['cil', c.tag, c.radius, c.center ? c.center.distanceTo(g.player.pos).toFixed(2) : c]); continue; }
      const d = g.player.pos.clone().sub(c.center);
      const lx = Math.abs(d.dot(c.right)) - c.half.x, ly = Math.abs(d.dot(c.up)) - c.half.y, lz = Math.abs(d.dot(c.forward)) - c.half.z;
      const fuori = Math.hypot(Math.max(lx, 0), Math.max(ly, 0), Math.max(lz, 0));
      if (fuori < 1.0) out.push(['VICINO', c.tag, fuori.toFixed(2), lx.toFixed(2), ly.toFixed(2), lz.toFixed(2), 'top rel piedi', (d.dot(c.up) * -1 + c.half.y).toFixed(2)]);
    }
    const col = g.world.colliders.query(q.z, q.theta, 3, []);
    for (const c of col) {
      const cc = c.center ? window.__worldToCyl ? null : null : null;
      out.push(['collisore', c.kind, c.tag ?? '', c.center ? [c.center.x.toFixed(1), c.center.y.toFixed(1), c.center.z.toFixed(1)] : '', c.half ? [c.half.x.toFixed(2), c.half.y.toFixed(2), c.half.z.toFixed(2)] : '', c.radius ?? '']);
    }
    // salta tenendo W
    g.input.simulate('KeyW', true);
    g.loop.stepUpdates(10);
    g.input.simulate('Space', true);
    g.loop.stepUpdates(2);
    g.input.simulate('Space', false);
    g.loop.stepUpdates(60 * 3);
    g.input.simulate('KeyW', false);
    g.loop.stepUpdates(2);
    const s2 = g.player.cyl;
    out.push(['dopo il salto', s2.z.toFixed(2), s2.theta.toFixed(3), s2.h.toFixed(2), 'percorsi', Math.hypot(s2.z - q.z, (s2.theta - q.theta) * 11.27).toFixed(1)]);
    // il terreno davanti
    for (let k = 0; k <= 6; k++) {
      const z = q.z + Math.cos((120 * Math.PI) / 180) * k * 0.5;
      const th = q.theta + (Math.sin((120 * Math.PI) / 180) * k * 0.5) / mpd;
      out.push(['suolo a', k * 0.5, g.player.groundFn(z, th).toFixed(2)]);
    }
    return out;
  });
  for (const r of s) console.log(JSON.stringify(r));
} catch (e) {
  console.error(e);
}
await fine();
