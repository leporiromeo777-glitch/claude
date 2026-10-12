// Crea il pagamento SumUp per una prenotazione e restituisce la pagina di pagamento.
// Il prezzo viene ricalcolato qui dal listino, mai preso dal browser.
import { normalizeFleet, fleetPrice } from '../lib/pricing.mjs';
import { createCheckout, referenceFor } from '../lib/sumup.mjs';

const SITE = 'https://jf-limo-service.ch';
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  let b;
  try { b = await req.json(); } catch { return json(400, { error: 'json' }); }

  const trip = String(b.trip || '');
  if (!/^[a-z0-9]{6}$/.test(trip)) return json(400, { error: 'trip' });

  const fleet = normalizeFleet(b.flotta, b.classe);
  if (!fleet) return json(400, { error: 'classe' });

  const tipo = b.tipo === 'ore' ? 'ore' : 'transfer';
  const amount = fleetPrice(fleet, { tipo, km: b.km, ore: b.ore, rt: String(b.rt) === '1' });
  if (!amount || amount <= 0) return json(400, { error: 'prezzo' });

  const veicoli = Object.entries(fleet).map(([c, n]) => `${n}x ${c}`).join(' + ');
  const route = tipo === 'ore' ? `${b.from || ''} · ${parseInt(b.ore, 10) || 2}h` : `${b.from || ''} → ${b.to || ''}`;

  try {
    const co = await createCheckout({
      reference: referenceFor(trip),
      amount,
      description: `JF Limo · corsa ${trip} · ${veicoli} · ${route}`.slice(0, 255),
      redirectUrl: `${SITE}/grazie.html?paid=1&trip=${trip}`,
      webhookUrl: `${SITE}/.netlify/functions/confirm-payment`,
    });
    if (!co.hosted_checkout_url) throw new Error('hosted_checkout_url mancante');
    return json(200, { url: co.hosted_checkout_url, id: co.id, amount });
  } catch (e) {
    console.error(e);
    return json(502, { error: 'sumup' });
  }
};
