/**
 * Quando arriva qualcuno, secondo gli orari di personaggi.json: per le indicazioni delle missioni
 * («Adesso non c'è nessuno: la novizia arriva alle 07:00»).
 *
 * Logica pura sui contenuti (niente three.js). Legge le posizioni come `luogoDaOrario` (png.ts):
 * «ogni giorno», «giorno N», «dal giorno N», con `dalle`/`alle` e una `condizione` facoltativa;
 * le righe che non sono un posto del mondo (in volo, fuori scena, dentro casa) non contano.
 */
import { luogo, oreDa, type Personaggio } from './contenuti';

/** Un arrivo: il giorno, l'ora (decimale) e il luogo dove la persona si fa trovare. */
export interface Arrivo {
  giorno: number;
  ore: number;
  luogo: string;
}

/** Quanti giorni avanti si cerca (oggi, domani, dopodomani). */
const GIORNI_AVANTI = 2;

/** La posizione vale nel giorno? (`null`: non è una posizione del mondo, come «notte» o «Fase 1».) */
export function valeNelGiorno(fase: string, giorno: number): boolean | null {
  const f = fase.toLowerCase();
  if (f.startsWith('ogni giorno') || f === 'sempre') return true;
  const m = /(dal )?giorno (\d+)/.exec(f);
  if (!m) return null;
  return m[1] ? giorno >= Number(m[2]) : giorno === Number(m[2]);
}

/** L'id del luogo di una posizione, se è un posto del mondo. */
export function luogoDellaPosizione(testo: string): string | null {
  const t = testo.trim();
  if (/in volo|fuori scena|\(dentro\)|dove la porta/.test(t)) return null;
  const id = t.split(/[\s(]/)[0] ?? '';
  return luogo(id) ? id : null;
}

/**
 * Il primo arrivo dopo l'ora data (`giorno`, `ore`) di un personaggio, in un luogo preciso o
 * dovunque; null se negli orari non ce n'è uno nei prossimi due giorni. Una posizione già in
 * corso conta come arrivo solo se è cominciata da meno di `giaIniziata` ore (chi è in ritardo
 * sta camminando): altrimenti si cerca la prossima.
 */
export function prossimoArrivo(
  p: Personaggio,
  giorno: number,
  ore: number,
  opz: { luogo?: string; valuta?: (condizione: string) => boolean; giaIniziata?: number } = {},
): Arrivo | null {
  const adesso = giorno * 24 + ore;
  const gia = opz.giaIniziata ?? 0;
  let migliore: Arrivo | null = null;
  let bt = Infinity;
  for (let g = giorno; g <= giorno + GIORNI_AVANTI; g++) {
    for (const pos of p.posizioni ?? []) {
      if (valeNelGiorno(pos.fase, g) !== true || !pos.dalle) continue;
      const da = oreDa(pos.dalle);
      if (!Number.isFinite(da)) continue;
      const l = luogoDellaPosizione(pos.luogo);
      if (!l || (opz.luogo && l !== opz.luogo)) continue;
      const t = g * 24 + da;
      if (t < adesso - gia || t >= bt) continue;
      // la condizione si valuta adesso (Clelia alla Bacheca finché il dono non è fatto)
      if (pos.condizione && opz.valuta && !opz.valuta(pos.condizione)) continue;
      bt = t;
      migliore = { giorno: g, ore: da, luogo: l };
    }
  }
  return migliore;
}
