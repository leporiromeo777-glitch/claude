/**
 * Unisce ai dati d'esempio i contenuti veri, se `demo/contenuti.json` esiste
 * (lo scrive `npm run importa-contenuti` leggendo ../../content/*.json).
 */
import type { BattutaDialogo, Carta, DatiPianta, DatiTaccuino } from '../src/index';
import type * as Esempio from './dati';

export interface DatiDemo {
  battuta: BattutaDialogo;
  lettera: Carta;
  libretto: Carta;
  cartellino: Carta;
  dattiloscritto: Carta;
  taccuino: DatiTaccuino;
  pianta: DatiPianta;
  proverbi?: string[];
  /** Da dove vengono i dati (per il README e il pannello). */
  fonte: string[];
}

type Snapshot = Partial<Omit<DatiDemo, 'pianta' | 'fonte'>> & {
  pianta?: Partial<Pick<DatiPianta, 'capisaldi' | 'luoghi' | 'lati' | 'elvira'>>;
  fonte?: string[];
};

const trovati = import.meta.glob('./contenuti.json', { eager: true, import: 'default' }) as Record<string, Snapshot>;
const snapshot: Snapshot = trovati['./contenuti.json'] ?? {};

export function contenutiVeri(es: typeof Esempio): DatiDemo {
  const s = snapshot;
  return {
    battuta: s.battuta ?? es.BATTUTA_OTTAVIO,
    lettera: s.lettera ?? es.LETTERA_MARTA,
    libretto: s.libretto ?? es.LIBRETTO_AURELIO,
    cartellino: s.cartellino ?? es.CARTELLINO_MARZE,
    dattiloscritto: s.dattiloscritto ?? es.LETTERA_S,
    taccuino: s.taccuino ? { ...es.TACCUINO, ...s.taccuino } : es.TACCUINO,
    pianta: { ...es.PIANTA, ...(s.pianta ?? {}) },
    ...(s.proverbi ? { proverbi: s.proverbi } : {}),
    fonte: s.fonte ?? ['esempi dal concept e dal GDD'],
  };
}
