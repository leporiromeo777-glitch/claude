/** Fatti finti e contesti per le prove. */
import type { ContestoCondizioni } from '../../src/narrativa/condizioni';
import type { ValoreFlag } from '../../src/narrativa/flag';
import type { WorldFacts } from '../../src/narrativa/narrativa';

export class FattiFinti implements WorldFacts {
  oraCorrente = 10;
  giornoCorrente = 1;
  notteForzata: boolean | undefined = undefined;
  luoghi = new Set<string>();
  rilevate = new Set<string>();
  viste = new Set<string>();
  varianti = new Map<string, string>();
  oggetti = new Map<string, number>();

  ora(): number {
    return this.oraCorrente;
  }
  giorno(): number {
    return this.giornoCorrente;
  }
  luogoRaggiunto(id: string): boolean {
    return this.luoghi.has(id);
  }
  cellaRilevata(id: string): boolean {
    return this.rilevate.has(id);
  }
  cellaVista(id: string): boolean {
    return this.viste.has(id);
  }
  varianteParticella(id: string): string | undefined {
    return this.varianti.get(id);
  }
  quantitaOggetto(id: string): number {
    return this.oggetti.get(id) ?? 0;
  }
}

/** Contesto di condizioni costruito a mano, per provare il valutatore da solo. */
export function contestoFinto(parziale: Partial<{
  flag: Record<string, ValoreFlag>;
  ora: number;
  giorno: number;
  notte: boolean;
  luoghi: string[];
  celle: Record<string, string[]>;
  dialoghiFiniti: string[];
  dialoghiIniziati: string[];
  missioni: Record<string, 'inattiva' | 'attiva' | 'completata'>;
  passi: Record<string, 'attivo' | 'completato'>;
  oggetti: Record<string, number>;
  taccuino: Record<string, { chiusa?: boolean; barrata?: boolean }>;
  extra: Record<string, boolean>;
}> = {}): ContestoCondizioni {
  const p = parziale;
  return {
    flag: (n) => p.flag?.[n],
    ora: () => p.ora ?? 12,
    giorno: () => p.giorno ?? 1,
    notte: () => p.notte ?? false,
    luogoRaggiunto: (id) => p.luoghi?.includes(id) ?? false,
    cella: (id, stato) => p.celle?.[id]?.includes(stato) ?? false,
    dialogo: (id, stato) => (stato === 'finito' ? p.dialoghiFiniti : p.dialoghiIniziati)?.includes(id) ?? false,
    missione: (id, stato) => {
      const s = p.missioni?.[id] ?? 'inattiva';
      if (stato === 'avviata') return s !== 'inattiva';
      return s === stato;
    },
    passo: (m, ps, stato) => p.passi?.[`${m}/${ps}`] === stato,
    quantitaOggetto: (id) => p.oggetti?.[id] ?? 0,
    taccuino: (id, stato) => {
      const v = p.taccuino?.[id];
      if (!v) return false;
      if (stato === 'presente') return true;
      if (stato === 'aperta') return !v.chiusa;
      if (stato === 'chiusa') return !!v.chiusa;
      return !!v.barrata;
    },
    predicato: (pref, arg, q) => p.extra?.[`${pref}:${arg}${q ? ' ' + q : ''}`] ?? false,
  };
}
