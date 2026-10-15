/**
 * Il rilievo di giorno (GDD §3.2) e attraverso il cielo.
 *
 * - `passa`: passando a meno di 60 m una particella bianca diventa matita;
 * - `appunta`: lo squadro tenuto in mano porta a matita ciò che si guarda (fino a 1500 m);
 * - `rileva`: squadro piantato sul caposaldo A, mira al caposaldo B: il lato si chiude e il
 *   ventaglio (60 m dal segmento) passa a colore, oppure il rilievo fallisce con un motivo;
 * - `chiudiTriangolo`: di notte, tre pilastri di tre valli attraverso il cielo;
 * - `stazioneLibera`: di notte, un punto qualunque e tre lumi lontani; Elvira pianta un chiodo nuovo.
 *
 * Ogni funzione è pura: riceve uno stato e restituisce lo stato nuovo, gli eventi per il
 * gioco e gli effetti per la narrativa. Un tentativo fallito non costa nulla.
 */
import { FIRMA_ELVIRA } from './costanti';
import {
  angoloFra,
  celleNelRaggio,
  celleNellaFascia,
  centroCella,
  distanza3D,
  distanzaSegmentoDallAsse,
  foglioDi,
  idCella,
  idValido,
  lunghezzaLato,
  posizione3D,
  strisciaDi,
  type PuntoFoglio,
} from './griglia';
import { caposaldoDef, chiaveCoppia, latoFra } from './regole';
import {
  cellaRilevataDaElvira,
  clonaStato,
  elementoRilevato,
  inventarioCompleto,
  leggiParticella,
  particellaDaModificare,
  scriviParticella,
} from './stato';
import { faseDaMinuti, lineaAccesaMinuti, minuti, type Ora } from './tempo';
import type {
  CodiceMotivo,
  DefCaposaldo,
  DefTriangolo,
  EventoCatasto,
  RegoleCatasto,
  Rilievo,
  RisultatoCatasto,
  StatoCatasto,
} from './tipi';
import {
  lineaLiberaFra,
  lumeVisibile,
  nomeBreve,
  nomeBreveMaiuscolo,
  puntoDi,
  type FunzioneVisibilita,
  type PuntoMira,
} from './visibilita';

// ───────────────────────────── aiuti comuni ─────────────────────────────

function fallito(
  stato: StatoCatasto,
  operazione: 'lato' | 'triangolo' | 'stazione_libera' | 'appunto' | 'penna',
  motivo: CodiceMotivo,
  messaggio: string,
  extra: { stazione?: string; mira?: string; effetti?: string[] } = {},
): RisultatoCatasto {
  const ev: EventoCatasto = {
    tipo: 'rilievo_fallito',
    operazione,
    motivo,
    messaggio,
    ...(extra.stazione ? { stazione: extra.stazione } : {}),
    ...(extra.mira ? { mira: extra.mira } : {}),
  };
  return { stato, ok: false, eventi: [ev], effetti: extra.effetti ?? [], motivo, messaggio };
}

function p3(c: { z: number; theta: number; altezza: number; altezzaSegnale?: number }, conSegnale = false) {
  return posizione3D(c.z, c.theta, c.altezza + (conSegnale ? (c.altezzaSegnale ?? 0) : 0));
}

function capoStato(s: StatoCatasto, id: string) {
  let cs = s.capisaldi[id];
  if (!cs) {
    cs = { visto: false, rilevato: false, firme: [], spostato: null };
    s.capisaldi[id] = cs;
  }
  return cs;
}

function segnaRilevato(s: StatoCatasto, id: string, firma: string, eventi: EventoCatasto[]): void {
  const cs = capoStato(s, id);
  if (!cs.visto) eventi.push({ tipo: 'caposaldo_visto', caposaldo: id });
  cs.visto = true;
  cs.rilevato = true;
  if (!cs.firme.includes(firma)) cs.firme.push(firma);
}

function spostatoMsg(c: DefCaposaldo, s: StatoCatasto): string | null {
  const sp = s.capisaldi[c.id]?.spostato;
  if (!sp) return null;
  return `${nomeBreveMaiuscolo(c)} non è al suo posto (spostato di ${sp.metri} m a ${sp.direzione}): la lettura non torna.`;
}

interface EsitoApplica {
  nuove: number[];
  ripassate: number[];
  rimisura: boolean;
  effetti: string[];
  eventi: EventoCatasto[];
}

/**
 * Scrive un rilievo di Elvira su un insieme di particelle e raccoglie le conseguenze:
 * particelle nuove e ripassate, elementi ora rilevati, flag della narrativa, ancore rimisurate.
 */
function applicaRilievo(s: StatoCatasto, regole: RegoleCatasto, celle: readonly number[], rilievo: Rilievo): EsitoApplica {
  const nuove: number[] = [];
  const ripassate: number[] = [];
  let rimisura = false;
  const effetti: string[] = [];
  const eventi: EventoCatasto[] = [];

  const elementiToccati = new Set<string>();
  for (const c of celle) {
    const e = regole.elementoDiCella.get(c);
    if (e) elementiToccati.add(e);
  }
  const elementiPrima = new Map([...elementiToccati].map((e) => [e, elementoRilevato(s, regole, e)]));
  const inventarioPrima = inventarioCompleto(s, regole);
  const elviraPrima = new Map(celle.map((c) => [c, cellaRilevataDaElvira(s, c)]));

  for (const c of celle) {
    const p = particellaDaModificare(s, c);
    const eraColore = p.stato === 'colore';
    const eraChina = eraColore && p.rilievi.some((r) => r.firma === FIRMA_ELVIRA);
    p.rilievi = p.rilievi.filter((r) => !(r.tipo === rilievo.tipo && r.rif === rilievo.rif && r.firma === rilievo.firma));
    p.rilievi.push({ ...rilievo, capisaldi: [...rilievo.capisaldi] });
    if (p.persaPer?.length) {
      rimisura = true;
      delete p.persaPer;
    }
    p.stato = 'colore';
    scriviParticella(s, c, p);
    if (!eraColore) nuove.push(c);
    else if (!eraChina && rilievo.firma === FIRMA_ELVIRA) ripassate.push(c);
  }

  for (const c of celle) {
    const f = regole.flagCelle.get(c);
    if (f && !elviraPrima.get(c) && cellaRilevataDaElvira(s, c)) effetti.push(`flag:${f}`);
  }
  for (const e of elementiToccati) {
    if (!elementiPrima.get(e) && elementoRilevato(s, regole, e)) {
      const es = s.elementi[e];
      if (es) es.rimastaSegnalata = false;
      effetti.push(`flag:elemento_rilevato:${e}`);
    }
  }
  if (regole.inventario && !inventarioPrima && inventarioCompleto(s, regole)) effetti.push(`flag:${regole.inventario.flag}`);

  // le scritture della Penna costruite stanotte si rimisurano rilevando tutte le loro particelle
  const insieme = new Set(celle);
  for (const [id, a] of Object.entries(s.ancore)) {
    if (a.stato !== 'costruita') continue;
    const def = regole.ancore.get(id);
    const el = def ? regole.elementi.get(def.elemento) : undefined;
    if (el && el.particelle.length > 0 && el.particelle.every((c) => insieme.has(c))) {
      a.stato = 'rimisurata';
      eventi.push({ tipo: 'scrittura', ancora: id, stato: 'rimisurata' });
      effetti.push(`flag:scrittura_rimisurata:${id}`);
    }
  }
  return { nuove, ripassate, rimisura, effetti, eventi };
}

function primoDelFoglio(s: StatoCatasto, cella: number): { primo: boolean; foglio: number } {
  const foglio = foglioDi(cella);
  const primo = !s.fogliRilevati.includes(foglio);
  if (primo) s.fogliRilevati.push(foglio);
  return { primo, foglio };
}

/** Triangoli della rete vicina chiusi da un lato nuovo (tre lati chiusi fra tre capisaldi). */
function triangoliDellaRete(s: StatoCatasto, a: string, b: string, giorno: number, eventi: EventoCatasto[], effetti: string[]): void {
  const chiusi = new Set(Object.values(s.lati).map((l) => chiaveCoppia(l.stazione, l.mira)));
  const vicini = (x: string) =>
    new Set(
      Object.values(s.lati)
        .flatMap((l) => (l.stazione === x ? [l.mira] : l.mira === x ? [l.stazione] : []))
        .filter((y) => y !== a && y !== b),
    );
  const va = vicini(a);
  for (const c of vicini(b)) {
    if (!va.has(c) || !chiusi.has(chiaveCoppia(a, c)) || !chiusi.has(chiaveCoppia(b, c))) continue;
    const vertici = [a, b, c].sort();
    const id = `rete:${vertici.join('-')}`;
    if (s.triangoli[id]) continue;
    s.triangoli[id] = { id, tipo: 'rete', vertici, giorno };
    eventi.push({ tipo: 'triangolo_chiuso', triangolo: id, tipoTriangolo: 'rete', vertici, particelle: [] });
    effetti.push(`flag:triangolo_rete:${vertici.map((v) => v.replace(/^cs_/, '')).join('-')}`);
  }
}

// ───────────────────────────── passare ─────────────────────────────

/**
 * Elvira passa in (z, θ): le particelle bianche entro 60 m diventano matita (GDD §3.3).
 * Se non cambia niente restituisce lo stesso oggetto stato, così il gioco può chiamarla spesso.
 */
export function passa(stato: StatoCatasto, regole: RegoleCatasto, posizione: PuntoFoglio): RisultatoCatasto {
  const celle = celleNelRaggio(posizione, regole.parametri.raggioMatita).filter((c) => leggiParticella(stato, c).stato === 'bianco');
  if (celle.length === 0) return { stato, ok: true, eventi: [], effetti: [] };
  const s = clonaStato(stato);
  for (const c of celle) {
    const p = particellaDaModificare(s, c);
    p.stato = 'matita';
    scriviParticella(s, c, p);
  }
  return {
    stato: s,
    ok: true,
    eventi: [{ tipo: 'particelle_matita', celle, origine: { z: posizione.z, theta: posizione.theta }, causa: 'passaggio' }],
    effetti: [],
  };
}

// ───────────────────────────── appuntare ─────────────────────────────

export type Bersaglio =
  | { caposaldo: string }
  | { cella: number }
  | { punto: { z: number; theta: number; altezza?: number } }
  | { lanterna: true }
  /** Un lume che cammina (la lanterna di Tecla): accende flag:appuntato_lume:<id>. */
  | { lume: string };

export interface InputAppunto {
  bersaglio: Bersaglio;
  ora: Ora;
  /** Dove sta l'occhio di Elvira: serve per la portata, il flag «lontano» e l'abbagliamento. */
  osservatore?: { z: number; theta: number; altezza: number };
  /** Facoltativa: di solito il gioco appunta ciò che il raycast dello sguardo ha già colpito. */
  lineaLibera?: FunzioneVisibilita;
  /** Pilastri su cui Ottavio porta il lume di mira stanotte. */
  lumiDiOttavio?: string[];
}

/**
 * Appuntare (GDD §3.2): si guarda una cosa entro 1500 m e si tiene la mira 1 s. La particella
 * passa da bianco a matita; un caposaldo diventa «visto» (triangolino a matita sulla Pianta).
 * La Lanterna e il Caposaldo Zero restano in bianco («Il disco non si appunta»).
 */
export function appunta(stato: StatoCatasto, regole: RegoleCatasto, input: InputAppunto): RisultatoCatasto {
  const ora = minuti(input.ora);
  const b = input.bersaglio;
  const notte = faseDaMinuti(ora) === 'notte';

  if ('lanterna' in b) {
    return {
      stato,
      ok: true,
      eventi: [{ tipo: 'appunto', cella: null, lontano: true, messaggio: 'Il disco non si appunta.' }],
      effetti: ['flag:appuntato_lanterna'],
    };
  }
  if ('lume' in b) {
    return { stato, ok: true, eventi: [{ tipo: 'appunto', cella: null, lontano: true }], effetti: [`flag:appuntato_lume:${b.lume}`] };
  }

  let bersaglio: PuntoMira;
  let cella: number;
  let def: DefCaposaldo | undefined;
  if ('caposaldo' in b) {
    def = caposaldoDef(regole, stato.capisaldiNuovi, b.caposaldo);
    if (!def) return fallito(stato, 'appunto', 'mira_sconosciuta', 'Lo squadro non riconosce quel segnale.', { mira: b.caposaldo });
    bersaglio = puntoDi(def);
    cella = def.cella;
  } else if ('cella' in b) {
    if (!idValido(b.cella)) return fallito(stato, 'appunto', 'mira_sconosciuta', 'Fuori dal Catasto.');
    const c = centroCella(b.cella);
    bersaglio = { z: c.z, theta: c.theta, altezza: 0 };
    cella = b.cella;
  } else {
    bersaglio = { z: b.punto.z, theta: b.punto.theta, altezza: b.punto.altezza ?? 0 };
    cella = idCella(b.punto.z, b.punto.theta);
  }

  if (def && notte && def.lontano && !def.sempreBianco) {
    const l = lumeVisibile(def, ora, input.lumiDiOttavio);
    if (!l.acceso) return fallito(stato, 'appunto', l.codice ?? 'buio', l.motivo ?? 'Di notte non si vede.', { mira: def.id });
  }

  let distanza: number | null = null;
  if (input.osservatore) {
    const o = p3(input.osservatore);
    const t = p3(bersaglio, true);
    distanza = distanza3D(o, t);
    if (distanza > regole.parametri.portataAppunto) {
      return fallito(stato, 'appunto', 'troppo_lontano', `Troppo lontano: lo squadro arriva a ${regole.parametri.portataAppunto} m.`);
    }
    if (lineaAccesaMinuti(ora)) {
      const dAsse = distanzaSegmentoDallAsse(o, t);
      if (dAsse < regole.parametri.abbagliamentoAsse) {
        return fallito(stato, 'appunto', 'abbaglia', `La Linea abbaglia: la mira passa a ${Math.round(dAsse)} m dall'asse.`);
      }
    }
    if (input.lineaLibera) {
      const v = lineaLiberaFra(regole, stato.capisaldiNuovi, input.lineaLibera, { ...input.osservatore }, bersaglio, { scopo: 'appunto', ora });
      if (!v.libera) return fallito(stato, 'appunto', 'coperto', v.motivo ?? 'Qualcosa copre la mira.');
    }
  }

  const s = clonaStato(stato);
  const eventi: EventoCatasto[] = [];
  const effetti: string[] = [];
  const lontano = distanza !== null && distanza > regole.parametri.appuntoLontano;

  if (def) {
    const cs = capoStato(s, def.id);
    if (!cs.visto) eventi.push({ tipo: 'caposaldo_visto', caposaldo: def.id });
    cs.visto = true;
    if (notte && def.lontano && def.lume?.tipo === 'permanente' && !s.lumiAppuntati.includes(def.id)) {
      s.lumiAppuntati.push(def.id);
      effetti.push('contatore:lumi_appuntati+1');
    }
  }
  if (def?.sempreBianco) {
    effetti.push('flag:appuntato_lanterna');
    eventi.push({ tipo: 'appunto', cella: null, caposaldo: def.id, lontano: true, messaggio: 'Il disco non si appunta.' });
    return { stato: s, ok: true, eventi, effetti };
  }

  if (leggiParticella(s, cella).stato === 'bianco') {
    const p = particellaDaModificare(s, cella);
    p.stato = 'matita';
    scriviParticella(s, cella, p);
    eventi.push({ tipo: 'particelle_matita', celle: [cella], origine: { z: bersaglio.z, theta: bersaglio.theta }, causa: 'appunto' });
  }
  effetti.unshift(`flag:appuntato:${cella}`);
  if (lontano) effetti.splice(1, 0, `flag:appuntato_lontano:${cella}`);
  eventi.push({ tipo: 'appunto', cella, lontano, ...(def ? { caposaldo: def.id } : {}) });
  return { stato: s, ok: true, eventi, effetti };
}

// ───────────────────────────── rilevare un lato ─────────────────────────────

export interface InputRilievo {
  /** Caposaldo su cui è piantato lo squadro (A). */
  stazione: string;
  /** Caposaldo collimato (B). */
  mira: string;
  ora: Ora;
  /** Giorno di gioco (predefinito: stato.giorno). */
  giorno?: number;
  /** «Linea libera?» del gioco; senza, vale la tabella di capisaldi.json. */
  lineaLibera?: FunzioneVisibilita;
  /** Elvira è senza fiato: la bolla non sta ferma. */
  senzaFiato?: boolean;
  /**
   * Per i lati non precalcolati nei contenuti: la particella è visibile dalla stazione?
   * (GDD §3.2: il ventaglio contiene le particelle «visibili da A»). Predefinito: tutte.
   */
  particellaVisibile?: (stazione: PuntoMira, cella: number) => boolean;
}

/** Il ventaglio di un lato: quello dei contenuti se c'è, altrimenti la fascia di 60 m. */
export function ventaglioDi(
  regole: RegoleCatasto,
  nuovi: Readonly<Record<string, DefCaposaldo>>,
  a: string,
  b: string,
  particellaVisibile?: (stazione: PuntoMira, cella: number) => boolean,
): number[] {
  const def = latoFra(regole, a, b);
  if (def && def.particelle.length > 0) return [...def.particelle];
  const A = caposaldoDef(regole, nuovi, a);
  const B = caposaldoDef(regole, nuovi, b);
  if (!A || !B) return [];
  const celle = celleNellaFascia(A, B, regole.parametri.bufferVentaglio);
  return particellaVisibile ? celle.filter((c) => particellaVisibile(puntoDi(A), c)) : celle;
}

/** Id di un lato fra due capisaldi: quello dei contenuti («1-3») o «4-E1». */
export function idLato(regole: RegoleCatasto, nuovi: Readonly<Record<string, DefCaposaldo>>, a: string, b: string): string {
  const def = latoFra(regole, a, b);
  if (def) return def.id;
  const ea = caposaldoDef(regole, nuovi, a)?.etichetta ?? a;
  const eb = caposaldoDef(regole, nuovi, b)?.etichetta ?? b;
  const ord = (x: string) => (/^\d+$/.test(x) ? Number(x) : Number.POSITIVE_INFINITY);
  return [ea, eb].sort((x, y) => ord(x) - ord(y) || x.localeCompare(y)).join('-');
}

/**
 * Rilevare un lato (GDD §3.2): pianta, livella, collima, leggi. Le verifiche seguono l'ordine
 * in cui il giocatore le incontra: il caposaldo, il fiato, la pietra al suo posto, la regola
 * del cilindro (lunghezza, stessa valle, abbagliamento), l'ora, la linea libera.
 */
export function rileva(stato: StatoCatasto, regole: RegoleCatasto, input: InputRilievo): RisultatoCatasto {
  const ora = minuti(input.ora);
  const giorno = input.giorno ?? stato.giorno;
  const nuovi = stato.capisaldiNuovi;
  const S = caposaldoDef(regole, nuovi, input.stazione);
  const M = caposaldoDef(regole, nuovi, input.mira);
  const tentato = `flag:tentato_lato:${S?.etichetta ?? input.stazione}-${M?.etichetta ?? input.mira}`;
  const fail = (m: CodiceMotivo, msg: string) =>
    fallito(stato, 'lato', m, msg, { stazione: input.stazione, mira: input.mira, effetti: S && M ? [tentato] : [] });

  if (!S) return fail('stazione_sconosciuta', "Qui non c'è un caposaldo: lo squadro non si aggancia.");
  if (!M) return fail('mira_sconosciuta', 'Nel reticolo non c\'è un segnale del Catasto.');
  if (S.id === M.id) return fail('stessa_stazione', 'Lo squadro è piantato proprio lì: serve un secondo caposaldo.');
  if (input.senzaFiato) return fail('senza_fiato', 'Senza fiato la bolla non sta ferma.');
  const spS = spostatoMsg(S, stato);
  if (spS) return fail('stazione_spostata', spS);
  const spM = spostatoMsg(M, stato);
  if (spM) return fail('mira_spostata', spM);
  if (!S.rilevabile) return fail('non_attivo', S.motivoNonRilevabile ?? 'Questo caposaldo non si può ancora usare.');
  if (!M.rilevabile) return fail('non_attivo', M.motivoNonRilevabile ?? 'Questo caposaldo non si può ancora usare.');

  const def = latoFra(regole, S.id, M.id);
  const pa = p3(S);
  const pb = p3(M, true);
  const lunghezza = def && Number.isFinite(def.lunghezza) ? def.lunghezza : lunghezzaLato(S, M);
  if (lunghezza < regole.parametri.latoMin) {
    return fail('troppo_corto', `Lato di ${Math.round(lunghezza)} m: troppo corto, la lettura non vale (minimo ${regole.parametri.latoMin} m).`);
  }
  if (lunghezza > regole.parametri.latoMaxGiorno) {
    return fail('troppo_lungo', `Lato di ${Math.round(lunghezza)} m: troppo lungo per un lato vicino (massimo ${regole.parametri.latoMaxGiorno} m).`);
  }
  if (strisciaDi(S.theta).id !== strisciaDi(M.theta).id) {
    return fail('altra_valle', 'Di giorno si rileva vicino, nella stessa valle: attraverso il cielo si chiudono i triangoli, di notte.');
  }
  if (lineaAccesaMinuti(ora)) {
    const dAsse = distanzaSegmentoDallAsse(pa, pb);
    if (dAsse < regole.parametri.abbagliamentoAsse) {
      return fail('abbaglia', `La Linea abbaglia: il lato passa a ${Math.round(dAsse)} m dall'asse.`);
    }
  }
  if (def && !def.chiudibile) {
    const v = input.lineaLibera ? lineaLiberaFra(regole, nuovi, input.lineaLibera, puntoDi(S), puntoDi(M), { scopo: 'lato', ora }) : null;
    const tab = lineaLiberaFra(regole, nuovi, undefined, puntoDi(S), puntoDi(M), { scopo: 'lato', ora });
    return fail('coperto', (v && !v.libera && v.motivo) || tab.motivo || def.nota || 'La mira è coperta.');
  }
  if (def && def.quando.length > 0 && !def.quando.includes(faseDaMinuti(ora))) {
    return fail('fuori_orario', 'A quest\'ora il segnale non si legge.');
  }
  const vis = lineaLiberaFra(regole, nuovi, input.lineaLibera, puntoDi(S), puntoDi(M), { scopo: 'lato', ora });
  if (!vis.libera) return fail('coperto', vis.motivo ?? 'La mira è coperta.');

  // riuscito
  const ventaglio = ventaglioDi(regole, nuovi, S.id, M.id, input.particellaVisibile);
  const id = idLato(regole, nuovi, S.id, M.id);
  const s = clonaStato(stato);
  const rilievo: Rilievo = { firma: FIRMA_ELVIRA, tipo: 'lato', rif: id, capisaldi: [S.id, M.id], giorno, anno: null };
  const esito = applicaRilievo(s, regole, ventaglio, rilievo);
  const { primo, foglio } = primoDelFoglio(s, S.cella);
  const eventi: EventoCatasto[] = [];
  segnaRilevato(s, S.id, FIRMA_ELVIRA, eventi);
  segnaRilevato(s, M.id, FIRMA_ELVIRA, eventi);
  s.lati[id] = { id, stazione: S.id, mira: M.id, firma: FIRMA_ELVIRA, giorno, anno: null };
  s.rilieviFatti += 1;

  eventi.push({
    tipo: 'particelle_rivelate',
    celle: esito.nuove,
    ripassate: esito.ripassate,
    ventaglio,
    origine: { z: S.z, theta: S.theta },
    verso: { z: M.z, theta: M.theta },
    causa: 'lato',
    rif: id,
    primoDelFoglio: primo,
    foglio,
    rimisura: esito.rimisura,
  });
  eventi.push({ tipo: 'lato_chiuso', lato: id, stazione: S.id, mira: M.id, particelle: ventaglio, nuove: esito.nuove.length });
  eventi.push(...esito.eventi);

  const effetti = [tentato, `flag:rilevato_lato:${S.etichetta}-${M.etichetta}`];
  if (id !== `${S.etichetta}-${M.etichetta}`) effetti.push(`flag:rilevato_lato:${id}`);
  effetti.push(...esito.effetti);
  triangoliDellaRete(s, S.id, M.id, giorno, eventi, effetti);
  return { stato: s, ok: true, eventi, effetti };
}

// ───────────────────────────── attraverso il cielo ─────────────────────────────

export interface InputTriangolo {
  /** Il pilastro su cui è piantato lo squadro. */
  stazione: string;
  /** I due pilastri delle altre valli, sui loro lumi. */
  mire: [string, string];
  ora: Ora;
  giorno?: number;
  lineaLibera?: FunzioneVisibilita;
  lumiDiOttavio?: string[];
  senzaFiato?: boolean;
}

function verificaLume(
  stato: StatoCatasto,
  def: DefCaposaldo,
  ora: number,
  lumi: readonly string[] | undefined,
): { codice: CodiceMotivo; msg: string } | null {
  const sp = spostatoMsg(def, stato);
  if (sp) return { codice: 'mira_spostata', msg: sp };
  if (!def.rilevabile) return { codice: 'non_attivo', msg: def.motivoNonRilevabile ?? 'Questo pilastro non si può ancora usare.' };
  const l = lumeVisibile(def, ora, lumi);
  if (!l.acceso) return { codice: l.codice ?? 'buio', msg: l.motivo ?? 'Il lume non si vede.' };
  return null;
}

function triangoloDaTabella(regole: RegoleCatasto, tipo: DefTriangolo['tipo'], vertici: readonly string[], stazione: string | null): DefTriangolo | undefined {
  const k = [...vertici].sort().join('|');
  for (const t of regole.triangoli.values()) {
    if (t.tipo !== tipo) continue;
    if ([...t.vertici].sort().join('|') !== k) continue;
    if (t.stazione && t.stazione !== stazione) continue;
    return t;
  }
  return undefined;
}

/**
 * Chiudere un triangolo attraverso il cielo (GDD §3.2): di notte o alla brace, tre pilastri
 * di tre valli che si vedono a vicenda. Rileva le particelle entro 80 m da ogni vertice e le
 * particelle di trama scritte per quel triangolo.
 */
export function chiudiTriangolo(stato: StatoCatasto, regole: RegoleCatasto, input: InputTriangolo): RisultatoCatasto {
  const ora = minuti(input.ora);
  const giorno = input.giorno ?? stato.giorno;
  const nuovi = stato.capisaldiNuovi;
  const fail = (m: CodiceMotivo, msg: string) => fallito(stato, 'triangolo', m, msg, { stazione: input.stazione });
  const fase = faseDaMinuti(ora);
  if (fase !== 'notte' && fase !== 'brace') return fail('non_notte', 'Attraverso il cielo si mira di notte o alla brace, sui lumi.');
  const ids = [input.stazione, ...input.mire];
  if (new Set(ids).size !== 3) return fail('stessa_stazione', 'Servono tre pilastri diversi.');
  const defs = ids.map((id) => caposaldoDef(regole, nuovi, id));
  if (defs.some((d) => !d)) return fail('mira_sconosciuta', 'Uno dei tre segnali non è nel libretto.');
  const [S, B, C] = defs as [DefCaposaldo, DefCaposaldo, DefCaposaldo];
  if (input.senzaFiato) return fail('senza_fiato', 'Senza fiato la bolla non sta ferma.');
  const spS = spostatoMsg(S, stato);
  if (spS) return fail('stazione_spostata', spS);
  if (!S.rilevabile) return fail('non_attivo', S.motivoNonRilevabile ?? 'Questo pilastro non si può ancora usare.');
  for (const m of [B, C]) {
    const err = verificaLume(stato, m, ora, input.lumiDiOttavio);
    if (err) return fail(err.codice, err.msg);
  }
  if (new Set([S, B, C].map((d) => strisciaDi(d.theta).id)).size !== 3) {
    return fail('tre_valli', 'Un triangolo attraverso il cielo vuole tre pilastri di tre valli.');
  }
  for (const m of [B, C]) {
    const v = lineaLiberaFra(regole, nuovi, input.lineaLibera, puntoDi(S), puntoDi(m), { scopo: 'triangolo', ora });
    if (!v.libera) return fail('coperto', v.motivo ?? `${nomeBreveMaiuscolo(m)} non si vede da qui.`);
  }
  const t = triangoloDaTabella(regole, 'cielo', ids, null);
  if (!t) {
    const v = lineaLiberaFra(regole, nuovi, input.lineaLibera, puntoDi(B), puntoDi(C), { scopo: 'triangolo', ora });
    if (!v.libera) return fail('coperto', v.motivo ?? `${nomeBreveMaiuscolo(B)} e ${nomeBreve(C)} non si vedono a vicenda.`);
  }

  const id = t?.id ?? `cielo:${[...ids].sort().join('-')}`;
  const s = clonaStato(stato);
  const rilievo: Rilievo = { firma: FIRMA_ELVIRA, tipo: 'triangolo', rif: id, capisaldi: [...ids], giorno, anno: null };
  const eventi: EventoCatasto[] = [];
  const effetti: string[] = [];
  const tutte = new Set<number>();
  const giaDette = new Set<number>();
  const gruppi: { origine: DefCaposaldo; celle: number[] }[] = [];
  for (const v of [S, B, C]) {
    const celle = celleNelRaggio(v, regole.parametri.raggioTriangolo).filter((c) => !giaDette.has(c));
    celle.forEach((c) => {
      giaDette.add(c);
      tutte.add(c);
    });
    gruppi.push({ origine: v, celle });
  }
  const trama = (t?.particelleTrama ?? []).filter((c) => !giaDette.has(c));
  trama.forEach((c) => tutte.add(c));
  if (trama.length) gruppi.push({ origine: S, celle: trama });

  for (const g of gruppi) {
    if (g.celle.length === 0) continue;
    const e = applicaRilievo(s, regole, g.celle, rilievo);
    const { primo, foglio } = primoDelFoglio(s, g.celle[0]!);
    eventi.push({
      tipo: 'particelle_rivelate',
      celle: e.nuove,
      ripassate: e.ripassate,
      ventaglio: g.celle,
      origine: { z: g.origine.z, theta: g.origine.theta },
      verso: null,
      causa: 'triangolo',
      rif: id,
      primoDelFoglio: primo,
      foglio,
      rimisura: e.rimisura,
    });
    eventi.push(...e.eventi);
    effetti.push(...e.effetti);
  }
  for (const d of [S, B, C]) segnaRilevato(s, d.id, FIRMA_ELVIRA, eventi);
  s.triangoli[id] = { id, tipo: 'cielo', vertici: [...ids], giorno };
  s.rilieviFatti += 1;
  eventi.push({ tipo: 'triangolo_chiuso', triangolo: id, tipoTriangolo: 'cielo', vertici: [...ids], particelle: [...tutte] });
  effetti.unshift(`flag:rilevato_triangolo:${id}`);
  return { stato: s, ok: true, eventi, effetti };
}

export interface InputStazioneLibera {
  /** Dove Elvira pianta lo squadro (un punto qualunque: una cengia, il fondo di una gola). */
  punto: { z: number; theta: number; altezza: number };
  /** I tre pilastri noti di cui collima i lumi. */
  lumi: [string, string, string];
  ora: Ora;
  giorno?: number;
  /** La linea libera dal punto ai lumi: un punto libero non è nella tabella, serve il gioco. */
  lineaLibera?: FunzioneVisibilita;
  lumiDiOttavio?: string[];
  senzaFiato?: boolean;
  /** Se la stazione sta su un caposaldo cancellato (il Caposaldo Zero, T6): lo rimette sulla Carta. */
  caposaldo?: string;
}

/**
 * La stazione libera (GDD §3.2): l'intersezione inversa dei geometri. Di notte, da un punto
 * qualunque, tre lumi su pilastri noti. Il punto è rilevato con un ventaglio di 40 m ed Elvira
 * pianta un chiodo nuovo («E1», «E2»…), caposaldo a tutti gli effetti finché nessuno lo sposta.
 */
export function stazioneLibera(stato: StatoCatasto, regole: RegoleCatasto, input: InputStazioneLibera): RisultatoCatasto {
  const ora = minuti(input.ora);
  const giorno = input.giorno ?? stato.giorno;
  const nuovi = stato.capisaldiNuovi;
  const fail = (m: CodiceMotivo, msg: string) => fallito(stato, 'stazione_libera', m, msg);
  const fase = faseDaMinuti(ora);
  if (fase !== 'notte' && fase !== 'brace') return fail('non_notte', 'La stazione libera si fa di notte, sui lumi lontani.');
  if (new Set(input.lumi).size !== 3) return fail('lumi_insufficienti', 'Servono tre lumi su tre pilastri diversi.');
  const defs = input.lumi.map((id) => caposaldoDef(regole, nuovi, id));
  if (defs.some((d) => !d)) return fail('mira_sconosciuta', 'Uno dei tre lumi non è su un pilastro del libretto.');
  if (input.senzaFiato) return fail('senza_fiato', 'Senza fiato la bolla non sta ferma.');
  const lumi = defs as DefCaposaldo[];
  for (const m of lumi) {
    const err = verificaLume(stato, m, ora, input.lumiDiOttavio);
    if (err) return fail(err.codice, err.msg);
  }
  const punto: PuntoMira = { z: input.punto.z, theta: input.punto.theta, altezza: input.punto.altezza, ...(input.caposaldo ? { id: input.caposaldo } : {}) };
  for (const m of lumi) {
    const v = lineaLiberaFra(regole, nuovi, input.lineaLibera, punto, puntoDi(m), { scopo: 'stazione_libera', ora });
    if (!v.libera) return fail('coperto', v.motivo ?? `${nomeBreveMaiuscolo(m)} non si vede da qui.`);
  }
  const o = p3(punto);
  const dirs = lumi.map((m) => p3(m, true));
  let minAng = 180;
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) minAng = Math.min(minAng, angoloFra(o, dirs[i]!, dirs[j]!));
  if (minAng < regole.parametri.separazioneLumi) {
    return fail('lumi_allineati', 'Due lumi sono quasi nella stessa direzione: l\'intersezione non si chiude. Cambia un lume.');
  }

  const s = clonaStato(stato);
  const eventi: EventoCatasto[] = [];
  let stazioneId: string;
  let etichetta: string;
  if (input.caposaldo) {
    const def = caposaldoDef(regole, nuovi, input.caposaldo);
    if (!def) return fail('stazione_sconosciuta', 'Quel caposaldo non è nel libretto.');
    stazioneId = def.id;
    etichetta = def.etichetta;
  } else {
    const n = Object.keys(s.capisaldiNuovi).length + 1;
    etichetta = `E${n}`;
    stazioneId = `cs_${etichetta}`;
    const cella = idCella(input.punto.z, input.punto.theta);
    const def: DefCaposaldo = {
      id: stazioneId,
      numero: null,
      etichetta,
      tipo: 'chiodo_nuovo',
      nome: `Chiodo ${etichetta}`,
      z: input.punto.z,
      theta: input.punto.theta,
      altezza: input.punto.altezza,
      altezzaSegnale: 0,
      cella,
      valle: strisciaDi(input.punto.theta).id,
      visibileDa: [],
      nonVisibileDa: [],
      lume: null,
      lontano: false,
      rilevabile: true,
      motivoNonRilevabile: null,
      sempreBianco: false,
      rilevatoDa: null,
      monografia: null,
      luogo: null,
      fonte: 'stazione_libera',
    };
    s.capisaldiNuovi[stazioneId] = def;
    eventi.push({ tipo: 'caposaldo_nuovo', caposaldo: def });
  }
  const t = triangoloDaTabella(regole, 'stazione_libera', input.lumi, input.caposaldo ?? null);
  const celle = new Set(celleNelRaggio(input.punto, regole.parametri.raggioStazioneLibera));
  celle.add(idCella(input.punto.z, input.punto.theta));
  const ventaglio = [...celle].sort((a, b) => a - b);
  const rif = t?.id ?? stazioneId;
  const rilievo: Rilievo = { firma: FIRMA_ELVIRA, tipo: 'stazione_libera', rif, capisaldi: [stazioneId, ...input.lumi], giorno, anno: null };
  const e = applicaRilievo(s, regole, ventaglio, rilievo);
  const { primo, foglio } = primoDelFoglio(s, ventaglio[0]!);
  segnaRilevato(s, stazioneId, FIRMA_ELVIRA, eventi);
  for (const m of lumi) segnaRilevato(s, m.id, FIRMA_ELVIRA, eventi);
  s.rilieviFatti += 1;
  eventi.push({
    tipo: 'particelle_rivelate',
    celle: e.nuove,
    ripassate: e.ripassate,
    ventaglio,
    origine: { z: input.punto.z, theta: input.punto.theta },
    verso: null,
    causa: 'stazione_libera',
    rif,
    primoDelFoglio: primo,
    foglio,
    rimisura: e.rimisura,
  });
  eventi.push(...e.eventi);
  const effetti = [`flag:stazione_libera:${etichetta}`, ...e.effetti];

  if (t) {
    const trama = t.particelleTrama.filter((c) => !celle.has(c));
    if (trama.length) {
      const e2 = applicaRilievo(s, regole, trama, rilievo);
      eventi.push({
        tipo: 'particelle_rivelate',
        celle: e2.nuove,
        ripassate: e2.ripassate,
        ventaglio: trama,
        origine: { z: input.punto.z, theta: input.punto.theta },
        verso: null,
        causa: 'stazione_libera',
        rif,
        primoDelFoglio: false,
        foglio,
        rimisura: e2.rimisura,
      });
      eventi.push(...e2.eventi);
      effetti.push(...e2.effetti);
    }
    s.triangoli[t.id] = { id: t.id, tipo: 'stazione_libera', vertici: [...input.lumi], giorno };
    eventi.push({ tipo: 'triangolo_chiuso', triangolo: t.id, tipoTriangolo: 'stazione_libera', vertici: [...input.lumi], particelle: [...ventaglio, ...trama] });
    effetti.push(`flag:rilevato_triangolo:${t.id}`);
  }
  return { stato: s, ok: true, eventi, effetti };
}

// ───────────────────────────── capisaldi ─────────────────────────────

/** Il caposaldo è stato trovato (a meno di 1,5 m, o letto nel libretto e riconosciuto). */
export function segnaCaposaldoVisto(stato: StatoCatasto, regole: RegoleCatasto, id: string): RisultatoCatasto {
  if (!caposaldoDef(regole, stato.capisaldiNuovi, id)) return fallito(stato, 'appunto', 'mira_sconosciuta', 'Caposaldo sconosciuto.');
  if (stato.capisaldi[id]?.visto) return { stato, ok: true, eventi: [], effetti: [] };
  const s = clonaStato(stato);
  capoStato(s, id).visto = true;
  return { stato: s, ok: true, eventi: [{ tipo: 'caposaldo_visto', caposaldo: id }], effetti: [] };
}

/**
 * Rimettere un caposaldo al suo posto (la secondaria «I termini spostati», la missione 7).
 * Le particelle perse non tornano da sole: si rilevano di nuovo, in 5 s («la mano ricorda»).
 */
export function rimettiCaposaldo(stato: StatoCatasto, regole: RegoleCatasto, id: string): RisultatoCatasto {
  if (!caposaldoDef(regole, stato.capisaldiNuovi, id)) return fallito(stato, 'lato', 'stazione_sconosciuta', 'Caposaldo sconosciuto.');
  if (!stato.capisaldi[id]?.spostato) return { stato, ok: true, eventi: [], effetti: [] };
  const s = clonaStato(stato);
  capoStato(s, id).spostato = null;
  return {
    stato: s,
    ok: true,
    eventi: [{ tipo: 'caposaldo_rimesso', caposaldo: id }],
    effetti: [`flag:caposaldo_rimesso:${caposaldoDef(regole, s.capisaldiNuovi, id)!.etichetta}`],
  };
}

export interface ParametriSquadro {
  /** Dopo i primi 10 rilievi (GDD §3.2). */
  manoCheRicorda: boolean;
  /** Moltiplicatore della tolleranza della bolla: 2 = «la bolla chiede metà della precisione». */
  tolleranzaBolla: number;
  /** Secondi di collimazione (1,5 s, poi 0,8 s). */
  collimazioneS: number;
  /** Secondi per rimisurare una particella persa per un caposaldo spostato. */
  rimisuraS: number;
  /** Secondi per tenere la mira quando si appunta. */
  appuntoS: number;
}

export function parametriSquadro(stato: StatoCatasto, regole: RegoleCatasto): ParametriSquadro {
  const mano = stato.rilieviFatti >= regole.parametri.rilieviManoCheRicorda;
  return { manoCheRicorda: mano, tolleranzaBolla: mano ? 2 : 1, collimazioneS: mano ? 0.8 : 1.5, rimisuraS: 5, appuntoS: 1 };
}

/** Che cosa succederebbe rilevando questo lato adesso, senza cambiare niente (per l'anteprima nel reticolo). */
export function anteprimaRilievo(stato: StatoCatasto, regole: RegoleCatasto, input: InputRilievo): { ok: boolean; motivo?: CodiceMotivo; messaggio?: string; nuove: number[] } {
  const r = rileva(stato, regole, input);
  if (!r.ok) return { ok: false, ...(r.motivo ? { motivo: r.motivo } : {}), ...(r.messaggio ? { messaggio: r.messaggio } : {}), nuove: [] };
  const ev = r.eventi.find((e) => e.tipo === 'particelle_rivelate');
  return { ok: true, nuove: ev && ev.tipo === 'particelle_rivelate' ? ev.celle : [] };
}

