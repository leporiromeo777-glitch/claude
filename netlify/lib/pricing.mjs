// Listino prezzi lato server: DEVE restare identico a RATES in prenota.html
// (e nelle altre 5 pagine che ne contengono una copia).
// Il prezzo addebitato al cliente viene sempre ricalcolato qui, mai preso dal browser.
export const RATES = {
  business: { base: 70, km: 3.4, hour: 110 },
  minivan: { base: 95, km: 4.2, hour: 130 },
  first: { base: 110, km: 4.6, hour: 150 },
  // sprinter: solo su richiesta (WhatsApp/email), non prenotabile online
};

export const MAX_QTY = 3; // veicoli massimi per classe (come MAX_QTY in prenota.html)

function unitPrice(cls, { tipo, km, ore, rt }) {
  const r = RATES[cls];
  if (!r) return null;
  if (tipo === 'ore') return r.hour * Math.min(24, Math.max(2, parseInt(ore, 10) || 2));
  const k = Math.max(0, parseFloat(km) || 0);
  const p = Math.round(r.base + Math.max(0, k - 8) * r.km);
  return rt ? p * 2 : p;
}

// flotta: { business: 2, minivan: 1 } — oppure classe singola (vecchio formato)
export function normalizeFleet(flotta, classe) {
  const fleet = {};
  if (flotta && typeof flotta === 'object') {
    for (const [cls, q] of Object.entries(flotta)) {
      const n = parseInt(q, 10);
      if (!RATES[cls] || !(n >= 1 && n <= MAX_QTY)) return null;
      fleet[cls] = n;
    }
  } else if (RATES[classe]) {
    fleet[classe] = 1;
  }
  return Object.keys(fleet).length ? fleet : null;
}

export function fleetPrice(fleet, trip) {
  let total = 0;
  for (const [cls, n] of Object.entries(fleet)) {
    const u = unitPrice(cls, trip);
    if (u == null) return null;
    total += u * n;
  }
  return total;
}
