// Chiamate all'API SumUp (Online Payments). Chiave e codice commerciante
// stanno nelle variabili d'ambiente di Netlify: SUMUP_API_KEY, SUMUP_MERCHANT_CODE.
const API = 'https://api.sumup.com/v0.1';

function headers() {
  const key = process.env.SUMUP_API_KEY;
  if (!key) throw new Error('SUMUP_API_KEY mancante');
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export async function createCheckout({ reference, amount, description, redirectUrl, webhookUrl }) {
  const res = await fetch(`${API}/checkouts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      checkout_reference: reference,
      amount,
      currency: 'CHF',
      merchant_code: process.env.SUMUP_MERCHANT_CODE,
      description,
      redirect_url: redirectUrl,
      return_url: webhookUrl,
      hosted_checkout: { enabled: true },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SumUp create ${res.status}: ${JSON.stringify(data)}`);
  return data; // { id, hosted_checkout_url, status, ... }
}

export async function getCheckout(id) {
  const res = await fetch(`${API}/checkouts/${encodeURIComponent(id)}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SumUp get ${res.status}: ${JSON.stringify(data)}`);
  return data; // { id, status: PENDING|PAID|FAILED|EXPIRED, checkout_reference, amount, ... }
}

// riferimento univoco per SumUp: contiene il codice corsa, così confirm-payment
// può verificare che il pagamento appartenga davvero a quella corsa
export const referenceFor = (trip) => `jf-${trip}-${Date.now().toString(36)}`;
export const tripFromReference = (ref) => (/^jf-([a-z0-9]{6})-/.exec(ref || '') || [])[1] || null;
