/**
 * Dove deve andare Elvira per il passo che segue: le «tappe» del segnalino di direzione.
 *
 * Logica pura sulle condizioni dei contenuti (niente three.js né DOM): il passo dice che cosa
 * manca per completarlo (`completa_quando`), e da ogni atomo che manca si ricava una meta:
 *
 * - `luogo:X raggiunto` → il luogo X;
 * - `dialogo:D finito` → se D si apre da solo arrivando in un luogo (la Bacheca per la novizia,
 *   la passerella per la prova), quel luogo; altrimenti la persona che parla, dov'è adesso
 *   (Ottavio che scende dal cielo, Bortolo sul sagrato); le voci senza corpo (Meridiana) no;
 * - `flag:F` acceso da un dialogo (il campanile aperto da Bortolo) → chi lo dice;
 * - `contatore:C>=N` alzato dai dialoghi (i velati della piazza) → le persone che hanno ancora
 *   quel dialogo da fare: la più vicina;
 * - `flag:tentato_lato:A-B` → il caposaldo A, la stazione;
 * - `cella:N rilevata` → il caposaldo, agli estremi dei lati che rilevano N, più vicino al
 *   luogo del passo (il chiodo 3 per la terrazza, il chiodo 7 per la passerella).
 *
 * Prima di tutto vengono le tappe scritte a mano nel passo (`tappe`: il Balcone prima dei Bugni,
 * la Ripa prima della planata, la busta e l'armadietto, il campanaro sul sagrato), ognuna finché
 * vale il suo `quando`. Poi le tappe di strada: i luoghi e i dialoghi degli `eventi` del passo
 * che non sono ancora successi (la passerella prima del fienile; non quelli con `tappa: false`)
 * e il luogo del passo quando è la via e non la meta (il guado prima della piazza). Poi le mete.
 * In fondo, come ripiego, il luogo del passo, ma solo per i passi senza tappe scritte: chi le ha
 * scritte ha detto tutta la strada (ai Bugni, con la porta chiusa, non c'è altro da indicare).
 * Chi usa le tappe prende la prima che sa mettere nel mondo.
 * `segnalino: false` nel passo: nessuna tappa (il libretto si legge ovunque).
 */
import type { Atomo, NodoCondizione, PassoDef } from '../narrativa';

export type Destinazione =
  /**
   * Un luogo; con `chi`, la persona di un dialogo che si apre arrivando lì (la novizia alla
   * Bacheca): se non c'è ancora, il menu dell'attesa sa già da lontano quando arriva.
   */
  | { tipo: 'luogo'; id: string; chi?: string }
  /** Una persona dov'è adesso; con `luogo`, da cercare lì (se non c'è, il luogo e l'ora in cui arriva). */
  | { tipo: 'persona'; id: string; luogo?: string }
  | { tipo: 'persone'; ids: readonly string[] }
  | { tipo: 'caposaldo'; id: string }
  /** Un punto della regia (la busta, l'armadietto: `cripta.punti`, `cella.punti`, `scena.punto`). */
  | { tipo: 'punto'; id: string };

/** Una tappa scritta a mano nel passo, con la sua condizione compilata. */
export interface TappaScritta {
  meta: Destinazione;
  /** Vale finché è vera; null: un luogo finché non è raggiunto durante il passo, il resto sempre. */
  quando: NodoCondizione | null;
}

/** Il passo da seguire, con le condizioni già compilate. */
export interface PassoDaSeguire {
  luogo?: string;
  completa: NodoCondizione | null;
  /** Le condizioni degli eventi che sono tappe di strada (non quelli con `tappa: false`). */
  eventi: readonly NodoCondizione[];
  tappe?: readonly TappaScritta[];
  segnalino?: boolean;
}

/**
 * Il passo di missions.json pronto per le tappe: le condizioni compilate con `compila` (null se
 * mancano o non si leggono), solo gli eventi che sono strada, le tappe scritte come mete.
 */
export function compilaPasso(p: PassoDef, compila: (c: unknown) => NodoCondizione | null): PassoDaSeguire {
  const tappe: TappaScritta[] = [];
  for (const t of p.tappe ?? []) {
    const meta: Destinazione | null = t.persona
      ? { tipo: 'persona', id: t.persona, ...(t.luogo ? { luogo: t.luogo } : {}) }
      : t.punto
        ? { tipo: 'punto', id: t.punto }
        : t.luogo
          ? { tipo: 'luogo', id: t.luogo }
          : null;
    if (meta) tappe.push({ meta, quando: t.quando === undefined ? null : compila(t.quando) });
  }
  return {
    ...(p.luogo !== undefined ? { luogo: p.luogo } : {}),
    completa: p.completaQuando === undefined ? null : compila(p.completaQuando),
    eventi: p.eventi
      .filter((e) => e.tappa !== false)
      .map((e) => compila(e.quando))
      .filter((x): x is NodoCondizione => x !== null),
    ...(tappe.length ? { tappe } : {}),
    ...(p.segnalino !== undefined ? { segnalino: p.segnalino } : {}),
  };
}

/** Ciò che la scelta delle tappe deve sapere della storia e del paese. */
export interface FontiDestinazione {
  /** L'atomo è vero adesso, nell'ambito del passo (i luoghi «raggiunti durante il passo»). */
  vero(a: Atomo): boolean;
  /** Elvira è passata per il luogo durante questo passo. */
  raggiunto(luogo: string): boolean;
  /** Un dialogo: chi parla e la sua condizione d'apertura (compilata), se ce l'ha. */
  dialogo(id: string): { personaggio: string; apertura: NodoCondizione | null } | null;
  /** Il personaggio ha un corpo nel paese (non è una voce dagli altoparlanti). */
  haCorpo(personaggio: string): boolean;
  /** I personaggi dei dialoghi che accendono il flag. */
  chiAccende(flag: string): readonly string[];
  /** I personaggi che alzano il contatore e hanno ancora adesso quel dialogo da fare. */
  chiConta(contatore: string): readonly string[];
  /** I capisaldi agli estremi dei lati chiudibili che rilevano la cella. */
  capisaldiDellaCella(cella: string): readonly string[];
  /** Distanza (m) fra un caposaldo e un luogo. */
  distanza(caposaldo: string, luogo: string): number;
}

/** Il valore di una condizione compilata, atomo per atomo con `vero`. */
export function vale(n: NodoCondizione, vero: (a: Atomo) => boolean): boolean {
  switch (n.tipo) {
    case 'costante':
      return n.valore;
    case 'atomo':
      return vero(n.atomo);
    case 'e':
      return n.figli.every((f) => vale(f, vero));
    case 'o':
      return n.figli.some((f) => vale(f, vero));
    case 'non':
      return !vale(n.figlio, vero);
  }
}

/**
 * Gli atomi che mancano perché la condizione sia vera, nell'ordine in cui sono scritti: di una
 * «e» tutti quelli falsi; di una «o» ancora falsa quelli della prima strada; le negazioni no.
 */
export function atomiMancanti(n: NodoCondizione | null, vero: (a: Atomo) => boolean): Atomo[] {
  const out: Atomo[] = [];
  const visita = (x: NodoCondizione): void => {
    switch (x.tipo) {
      case 'atomo':
        if (!vero(x.atomo)) out.push(x.atomo);
        return;
      case 'e':
        for (const f of x.figli) visita(f);
        return;
      case 'o':
        if (!x.figli.some((f) => vale(f, vero)) && x.figli[0]) visita(x.figli[0]);
        return;
      default:
        return;
    }
  };
  if (n) visita(n);
  return out;
}

/** Tutti gli atomi «luogo» di una condizione (veri o no). */
function luoghiDi(n: NodoCondizione | null, out = new Set<string>()): Set<string> {
  if (!n) return out;
  switch (n.tipo) {
    case 'atomo':
      if (n.atomo.k === 'luogo') out.add(n.atomo.id);
      break;
    case 'e':
    case 'o':
      for (const f of n.figli) luoghiDi(f, out);
      break;
    case 'non':
      luoghiDi(n.figlio, out);
      break;
    default:
      break;
  }
  return out;
}

/** La meta di un atomo che manca (nessuna se l'atomo non si fa in un posto preciso). */
export function metaDiAtomo(a: Atomo, p: PassoDaSeguire, f: FontiDestinazione): Destinazione | null {
  switch (a.k) {
    case 'luogo':
      return { tipo: 'luogo', id: a.id };
    case 'dialogo': {
      const d = f.dialogo(a.id);
      if (!d) return null;
      // un dialogo che si apre da solo arrivando in un posto: il posto (e chi parla lì)
      const dove = atomiMancanti(d.apertura, f.vero).find((x): x is Extract<Atomo, { k: 'luogo' }> => x.k === 'luogo');
      if (dove) return f.haCorpo(d.personaggio) ? { tipo: 'luogo', id: dove.id, chi: d.personaggio } : { tipo: 'luogo', id: dove.id };
      return f.haCorpo(d.personaggio) ? { tipo: 'persona', id: d.personaggio } : null;
    }
    case 'flag': {
      if (a.nome.startsWith('tentato_lato:')) {
        const stazione = a.nome.slice('tentato_lato:'.length).split('-')[0];
        return stazione ? { tipo: 'caposaldo', id: `cs_${stazione}` } : null;
      }
      if (a.op !== undefined && typeof a.valore === 'number') {
        const contano = f.chiConta(a.nome).filter((x) => f.haCorpo(x));
        if (contano.length) return { tipo: 'persone', ids: contano };
      }
      const chi = [...new Set(f.chiAccende(a.nome))].filter((x) => f.haCorpo(x));
      if (chi.length === 1) return { tipo: 'persona', id: chi[0]! };
      if (chi.length > 1) return { tipo: 'persone', ids: chi };
      return null;
    }
    case 'cella': {
      const capisaldi = f.capisaldiDellaCella(a.id);
      if (!capisaldi.length) return null;
      const luogo = p.luogo;
      let migliore = capisaldi[0]!;
      if (luogo) {
        let bd = Infinity;
        for (const c of capisaldi) {
          const d = f.distanza(c, luogo);
          if (d < bd) {
            bd = d;
            migliore = c;
          }
        }
      }
      return { tipo: 'caposaldo', id: migliore };
    }
    default:
      return null;
  }
}

function stessa(a: Destinazione, b: Destinazione): boolean {
  if (a.tipo !== b.tipo) return false;
  if (a.tipo === 'persone') return a.ids.join(',') === (b as { ids: readonly string[] }).ids.join(',');
  return a.id === (b as { id: string }).id;
}

/** La tappa scritta vale adesso? */
function valeTappa(t: TappaScritta, f: FontiDestinazione): boolean {
  if (t.quando) return vale(t.quando, f.vero);
  return t.meta.tipo === 'luogo' ? !f.raggiunto(t.meta.id) : true;
}

/** Le tappe del passo, in ordine: le scritte, la strada, la meta, in fondo il luogo del passo. */
export function tappeDelPasso(p: PassoDaSeguire, f: FontiDestinazione): Destinazione[] {
  if (p.segnalino === false) return [];
  const out: Destinazione[] = [];
  const metti = (d: Destinazione | null): void => {
    if (d && !out.some((x) => stessa(x, d))) out.push(d);
  };
  // 0. le tappe scritte a mano, finché valgono
  for (const t of p.tappe ?? []) if (valeTappa(t, f)) metti(t.meta);
  // 1. la strada degli eventi del passo: un luogo da attraversare, qualcuno con cui parlare prima
  for (const e of p.eventi) {
    for (const a of atomiMancanti(e, f.vero)) {
      if (a.k === 'luogo' || a.k === 'dialogo') metti(metaDiAtomo(a, p, f));
    }
  }
  // 2. il luogo del passo quando è la via e non la meta (il guado del Sass, poi la piazza)
  const mete = luoghiDi(p.completa);
  if (p.luogo && mete.size && !mete.has(p.luogo) && !f.raggiunto(p.luogo)) metti({ tipo: 'luogo', id: p.luogo });
  // 3. ciò che manca per completare il passo
  for (const a of atomiMancanti(p.completa, f.vero)) metti(metaDiAtomo(a, p, f));
  // 4. il ripiego: il luogo del passo (dentro, il segnalino si spegne); non per chi ha scritto le sue tappe
  if (p.luogo && !p.tappe?.length) metti({ tipo: 'luogo', id: p.luogo });
  return out;
}
