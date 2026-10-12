// Conferma il pagamento SumUp e promuove la corsa da "attesa_pagamento" a "nuova" (pagata).
// Viene chiamata in due modi:
//  - da grazie.html quando il cliente torna sul sito: { sid: <id checkout>, trip }
//  - dal webhook SumUp (return_url):                  { event_type: 'CHECKOUT_STATUS_CHANGED', id }
// In entrambi i casi lo stato viene verificato chiedendolo a SumUp, mai fidandosi della richiesta.
import { getCheckout, tripFromReference } from '../lib/sumup.mjs';
import { getBooking, updateBooking } from '../lib/firebase.mjs';

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  let b;
  try { b = await req.json(); } catch { return json(400, { error: 'json' }); }

  const webhook = b.event_type !== undefined;
  if (webhook && b.event_type !== 'CHECKOUT_STATUS_CHANGED') return new Response(null, { status: 204 });
  const id = String((webhook ? b.id : b.sid) || '');
  if (!id) return json(400, { error: 'id' });

  try {
    const co = await getCheckout(id);
    const trip = tripFromReference(co.checkout_reference);
    // la corsa indicata dal browser deve essere quella del pagamento
    if (!trip || (!webhook && b.trip && b.trip !== trip)) return json(400, { error: 'trip' });

    if (co.status !== 'PAID') return webhook ? new Response(null, { status: 204 }) : json(200, { paid: false, status: co.status });

    const booking = await getBooking(trip);
    if (booking && !booking.pagato) {
      await updateBooking(trip, {
        status: booking.status === 'attesa_pagamento' ? 'nuova' : booking.status,
        pagato: true,
        pagatoAt: Date.now(),
        pagamento: 'online (SumUp)',
        sumupId: co.id,
        importoPagato: `CHF ${co.amount}`,
      });
    }
    return webhook ? new Response(null, { status: 204 }) : json(200, { paid: true });
  } catch (e) {
    console.error(e);
    // errore → SumUp ritenta il webhook più tardi
    return json(500, { error: 'confirm' });
  }
};
