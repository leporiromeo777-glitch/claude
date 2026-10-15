/**
 * Lo stato del catasto: costruzione iniziale e piccole letture.
 *
 * Tutte le funzioni che cambiano lo stato lavorano su una copia (`clonaStato`) e la
 * restituiscono: lo stato ricevuto non viene mai toccato.
 */
import { CELLE_TOTALI, FIRMA_ELVIRA } from './costanti';
import { caposaldoDef, defParticella } from './regole';
import type {
  CaposaldoStato,
  ElementoStato,
  Inchiostro,
  LatoStato,
  ParticellaStato,
  RegoleCatasto,
  Rilievo,
  Salute,
  StatoCatasto,
  StatoParticella,
} from './tipi';

/**
 * Copia dello stato da modificare. È una copia «copy-on-write»: le particelle e i rilievi non
 * si modificano mai sul posto (si sostituiscono con `particellaDaModificare` + `scriviParticella`),
 * quindi si condividono con lo stato di partenza; tutto il resto che le funzioni cambiano
 * (elementi, capisaldi, ancore, liste, la notte in corso) si copia. Chi usa il modulo non deve
 * modificare gli oggetti dello stato: si cambiano solo con le funzioni del catasto.
 */
export function clonaStato(stato: StatoCatasto): StatoCatasto {
  const mappa = <T extends object>(o: Record<string, T>): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const k in o) out[k] = { ...o[k]! };
    return out;
  };
  const capisaldi: StatoCatasto['capisaldi'] = {};
  for (const k in stato.capisaldi) {
    const c = stato.capisaldi[k]!;
    capisaldi[k] = { ...c, firme: [...c.firme] };
  }
  return {
    ...stato,
    particelle: { ...stato.particelle },
    elementi: mappa(stato.elementi),
    capisaldi,
    capisaldiNuovi: { ...stato.capisaldiNuovi },
    lati: { ...stato.lati },
    triangoli: { ...stato.triangoli },
    ancore: mappa(stato.ancore),
    mosse: { programmate: [...stato.mosse.programmate], usate: [...stato.mosse.usate] },
    contatori: { ...stato.contatori },
    fogliRilevati: [...stato.fogliRilevati],
    lumiAppuntati: [...stato.lumiAppuntati],
    notteInCorso: stato.notteInCorso ? structuredClone(stato.notteInCorso) : null,
  };
}

/** Lo stato all'inizio del gioco (GDD §3.3): bianco quasi tutto, le Selve a matita, la striscia della Cripta a seppia. */
export function statoIniziale(regole: RegoleCatasto, opzioni: { giorno?: number } = {}): StatoCatasto {
  const particelle: Record<string, ParticellaStato> = {};
  const lati: Record<string, LatoStato> = {};
  const capisaldi: Record<string, CaposaldoStato> = {};
  for (const c of regole.capisaldi.values()) {
    capisaldi[c.id] = { visto: false, rilevato: c.rilevatoDa !== null, firme: c.rilevatoDa ? [c.rilevatoDa] : [], spostato: null };
  }
  for (const p of regole.particelle.values()) {
    if (p.rilevataDa) {
      const lato = p.rilevataDa.lato ? regole.lati.get(p.rilevataDa.lato) : undefined;
      const r: Rilievo = {
        firma: p.rilevataDa.firma,
        tipo: 'storico',
        rif: p.rilevataDa.lato ?? 'storico',
        capisaldi: lato ? [lato.a, lato.b] : [],
        giorno: null,
        anno: p.rilevataDa.anno,
      };
      particelle[String(p.id)] = { stato: 'colore', rilievi: [r] };
      if (lato && !lati[lato.id]) {
        lati[lato.id] = { id: lato.id, stazione: lato.a, mira: lato.b, firma: r.firma, giorno: null, anno: r.anno };
        for (const c of [lato.a, lato.b]) {
          const cs = capisaldi[c];
          if (cs) {
            cs.rilevato = true;
            if (!cs.firme.includes(r.firma)) cs.firme.push(r.firma);
          }
        }
      }
    } else if (p.statoIniziale !== 'bianco') {
      particelle[String(p.id)] = { stato: p.statoIniziale === 'colore' ? 'matita' : p.statoIniziale, rilievi: [] };
    }
  }
  const elementi: Record<string, ElementoStato> = {};
  for (const e of regole.elementi.values()) elementi[e.id] = { variante: e.varianteIniziale, rimastaSegnalata: false };
  return {
    versione: 1,
    giorno: opzioni.giorno ?? 1,
    nottiPassate: 0,
    particelle,
    elementi,
    capisaldi,
    capisaldiNuovi: {},
    lati,
    triangoli: {},
    ancore: Object.fromEntries([...regole.ancore.keys()].map((id) => [id, { stato: 'vuota', giorno: null, variantePrima: null }])),
    mosse: { programmate: [], usate: [] },
    contatori: {},
    rilieviFatti: 0,
    fogliRilevati: [],
    lumiAppuntati: [],
    ultimaNotte: null,
    notteInCorso: null,
  };
}

const VUOTA: ParticellaStato = Object.freeze({ stato: 'bianco', rilievi: [] }) as ParticellaStato;

/** La particella nello stato (le assenti sono bianche e senza rilievi). Non modificare il risultato. */
export function leggiParticella(stato: StatoCatasto, id: number): ParticellaStato {
  return stato.particelle[String(id)] ?? VUOTA;
}

/** Copia modificabile della particella (da riscrivere con `scriviParticella`). */
export function particellaDaModificare(stato: StatoCatasto, id: number): ParticellaStato {
  const p = stato.particelle[String(id)];
  return p ? { ...p, rilievi: [...p.rilievi], ...(p.persaPer ? { persaPer: [...p.persaPer] } : {}) } : { stato: 'bianco', rilievi: [] };
}

/**
 * La salute di una particella (GDD §3.3, §3.11): il gioco la imposta quando la diagnosi la scopre
 * o quando un Nodo è riparato. Si vede sulla Pianta solo a colore. `null` la toglie.
 */
export function impostaSalute(stato: StatoCatasto, id: number, salute: Salute | null): StatoCatasto {
  const s = clonaStato(stato);
  const p = particellaDaModificare(s, id);
  if (salute) p.salute = salute;
  else delete p.salute;
  scriviParticella(s, id, p);
  return s;
}

export function scriviParticella(stato: StatoCatasto, id: number, p: ParticellaStato): void {
  if (p.stato === 'bianco' && p.rilievi.length === 0 && !p.persaPer?.length && !p.salute) delete stato.particelle[String(id)];
  else stato.particelle[String(id)] = p;
}

export function statoDi(stato: StatoCatasto, id: number): StatoParticella {
  return leggiParticella(stato, id).stato;
}

/** Inchiostro di una particella a colore: china se c'è un rilievo di Elvira, altrimenti seppia. */
export function inchiostroDi(stato: StatoCatasto, id: number): Inchiostro | null {
  const p = leggiParticella(stato, id);
  if (p.stato !== 'colore') return null;
  return p.rilievi.some((r) => r.firma === FIRMA_ELVIRA) ? 'china' : 'seppia';
}

/** La condizione `cella:id rilevata` (FASE1 §2.3): a colore per un rilievo di Elvira (G5). */
export function cellaRilevataDaElvira(stato: StatoCatasto, id: number): boolean {
  const p = leggiParticella(stato, id);
  return p.stato === 'colore' && p.rilievi.some((r) => r.firma === FIRMA_ELVIRA);
}

/** A colore, da chiunque (anche il G4 del 2291). È ciò che conta per la notte. */
export function cellaAColore(stato: StatoCatasto, id: number): boolean {
  return leggiParticella(stato, id).stato === 'colore';
}

/** Firme dei rilievi validi di una particella. */
export function firmeDi(stato: StatoCatasto, id: number): string[] {
  return [...new Set(leggiParticella(stato, id).rilievi.map((r) => r.firma))];
}

/** `elemento_rilevato:X`: tutte le particelle dell'elemento sono a colore (fade_fase1.json → condizioni_notte). */
export function elementoRilevato(stato: StatoCatasto, regole: RegoleCatasto, elemento: string): boolean {
  const e = regole.elementi.get(elemento);
  if (!e || e.particelle.length === 0) return false;
  return e.particelle.every((c) => cellaAColore(stato, c));
}

export function varianteDi(stato: StatoCatasto, elemento: string): string | undefined {
  return stato.elementi[elemento]?.variante;
}

/** Tutte le particelle dell'inventario di Corbella sono a colore (flag corbella_a_colori). */
export function inventarioCompleto(stato: StatoCatasto, regole: RegoleCatasto): boolean {
  const inv = regole.inventario;
  return !!inv && inv.particelle.length > 0 && inv.particelle.every((c) => cellaAColore(stato, c));
}

/** Particelle dell'inventario ancora da rilevare. */
export function inventarioMancante(stato: StatoCatasto, regole: RegoleCatasto): number[] {
  return (regole.inventario?.particelle ?? []).filter((c) => !cellaAColore(stato, c));
}

export interface InfoParticella {
  id: number;
  catasto: string;
  stato: StatoParticella;
  inchiostro: Inchiostro | null;
  firme: string[];
  elemento: string | null;
  hub: boolean;
  rifugio: boolean;
  /** Le Fade non l'hanno toccata l'ultima notte (con il motivo). */
  protettaStanotte: string | null;
  /** Elvira era su questa particella al passaggio delle Fade. */
  vegliata: boolean;
  /** Cambiata nell'ultima notte (segno rosso nel resoconto). */
  cambiataStanotte: boolean;
  /** Ha perso il rilievo per un caposaldo spostato. */
  persaPer: string[];
}

/** Tutto ciò che il catasto sa di una particella, con i flag dell'ultima notte. */
export function infoParticella(stato: StatoCatasto, regole: RegoleCatasto, id: number): InfoParticella {
  const p = leggiParticella(stato, id);
  const d = defParticella(regole, id);
  const un = stato.ultimaNotte;
  return {
    id,
    catasto: d.catasto,
    stato: p.stato,
    inchiostro: inchiostroDi(stato, id),
    firme: firmeDi(stato, id),
    elemento: d.elemento ?? regole.elementoDiCella.get(id) ?? null,
    hub: d.hub,
    rifugio: d.rifugio,
    protettaStanotte: un?.protette[String(id)] ?? null,
    vegliata: !!un?.vegliate.includes(id),
    cambiataStanotte: !!un?.cambiate.includes(id),
    persaPer: p.persaPer ? [...p.persaPer] : [],
  };
}

/** Posizione sul foglio di un caposaldo (dei contenuti o piantato da Elvira). */
export function posizioneCaposaldo(stato: StatoCatasto, regole: RegoleCatasto, id: string): { z: number; theta: number } | null {
  const c = caposaldoDef(regole, stato.capisaldiNuovi, id);
  return c ? { z: c.z, theta: c.theta } : null;
}

/** Conteggi per stato su tutto il cilindro. */
export function conteggi(stato: StatoCatasto): { bianco: number; matita: number; colore: number; china: number; seppia: number } {
  let matita = 0;
  let colore = 0;
  let china = 0;
  for (const [k, p] of Object.entries(stato.particelle)) {
    if (p.stato === 'matita') matita++;
    else if (p.stato === 'colore') {
      colore++;
      if (inchiostroDi(stato, Number(k)) === 'china') china++;
    }
  }
  return { bianco: CELLE_TOTALI - matita - colore, matita, colore, china, seppia: colore - china };
}

