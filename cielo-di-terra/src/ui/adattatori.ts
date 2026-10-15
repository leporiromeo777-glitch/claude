/**
 * Adattatori dai contenuti JSON del design (content/*.json, formato della Fase 1) ai tipi dell'interfaccia.
 * Non leggono file: ricevono gli oggetti già caricati. I tipi d'ingresso descrivono solo i campi usati
 * e sono volutamente larghi, così piccole aggiunte ai contenuti non rompono niente.
 */
import type { BattutaDialogo } from './componenti/dialogo';
import type { Carta, PaginaCarta, TipoCarta } from './componenti/lettore';
import type {
  DatiTaccuino,
  IndizioTaccuino,
  LeggendaTaccuino,
  ManoTaccuino,
  NotaTaccuino,
  ParolaTaccuino,
  PistaTaccuino,
  ProverbioTaccuino,
} from './componenti/taccuino';
import type {
  CaposaldoPianta,
  GrigliaPianta,
  LatoPianta,
  LuogoPianta,
  StatoParticella,
  TerrenoParticella,
} from './pianta/modello';
import { CODICE_STATO, CODICE_TERRENO, GRIGLIA_PREDEFINITA } from './pianta/modello';

// ---------- testi.json ----------

/** Una voce di testi.json (lettere, libretto, cartellini, scritte, leggende). */
export interface VoceTestiJson {
  titolo?: string;
  supporto?: string;
  testo?: string;
  schizzo?: string;
  /** Nota di Elvira nel 2322 (libretto). */
  nota_2322?: string;
  /** Traduzione di una scritta in dialetto. */
  traduzione?: string;
  /** Leggende dell'Ombrista: i quadri del telo. */
  quadri?: { figure?: string; testo: string }[];
  chiusura?: string;
}

/** Riconosce le note fra parentesi in testa a un paragrafo: «(a margine) …», «(Elvira, a matita) …». */
const RE_NOTA = /^\(([^)]*)\)\s*/;

/**
 * Divide un testo in corpo, note a margine dell'autore e note di Elvira.
 * «(a margine)», «(sotto, a matita)» → margine; «(Elvira…)» → notaElvira.
 */
export function separaNote(testo: string): { corpo: string; margine?: string; notaElvira?: string } {
  const corpo: string[] = [];
  const margine: string[] = [];
  const elvira: string[] = [];
  for (const par of testo.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const m = RE_NOTA.exec(par.trim());
    if (m) {
      const chi = m[1]!.toLowerCase();
      const resto = par.trim().slice(m[0].length);
      if (chi.includes('elvira')) elvira.push(resto);
      else if (chi.includes('margine') || chi.includes('matita') || chi.includes('sotto')) margine.push(resto);
      else corpo.push(par);
    } else corpo.push(par);
  }
  return {
    corpo: corpo.join('\n\n'),
    ...(margine.length ? { margine: margine.join('\n\n') } : {}),
    ...(elvira.length ? { notaElvira: elvira.join('\n\n') } : {}),
  };
}

/** Se l'ultimo paragrafo è breve (una firma: «Marta», «La Madre», «A.»), lo stacca dal corpo. */
export function staccaFirma(testo: string): { corpo: string; firma?: string } {
  const paragrafi = testo.split(/\n\s*\n/);
  const ultimo = paragrafi[paragrafi.length - 1]?.trim() ?? '';
  const parole = ultimo.split(/\s+/).filter(Boolean);
  const sembraFirma = paragrafi.length > 1 && parole.length > 0 && parole.length <= 3 && !/[?!:;,]$/.test(ultimo) && (!/\.$/.test(ultimo) || ultimo.length <= 4);
  return sembraFirma ? { corpo: paragrafi.slice(0, -1).join('\n\n'), firma: ultimo } : { corpo: testo };
}

/** Tipo di carta suggerito dalla sezione di testi.json e dall'id. */
export function tipoCartaPer(sezione: string, id: string): TipoCarta {
  if (sezione === 'libretto') return 'libretto';
  if (sezione === 'cartellini') return 'cartellino';
  if (sezione === 'lettere') return id.includes('marta') ? 'lettera' : id.startsWith('s_') || id.includes('_s_') ? 'dattiloscritto' : 'biglietto';
  if (sezione === 'leggende') return 'foglio';
  return 'foglio';
}

/** Una voce di testi.json come carta da leggere (una pagina; le leggende hanno una pagina per quadro). */
export function cartaDaTesto(id: string, voce: VoceTestiJson, sezione = 'lettere', tipo: TipoCarta = tipoCartaPer(sezione, id)): Carta {
  if (voce.quadri?.length) return cartaDaLeggenda(id, voce);
  const { corpo, margine, notaElvira } = separaNote(voce.testo ?? '');
  const conFirma = tipo === 'lettera' || tipo === 'biglietto' || tipo === 'dattiloscritto';
  const { corpo: testo, firma } = conFirma ? staccaFirma(corpo) : { corpo, firma: undefined };
  const pagina: PaginaCarta = { testo };
  // Nel libretto e nei fogli il titolo è scritto sulla pagina; per le altre carte sta sopra il foglio.
  if ((tipo === 'libretto' || tipo === 'foglio') && voce.titolo) pagina.intestazione = voce.titolo;
  if (firma) pagina.firma = firma;
  if (margine) pagina.margine = margine;
  const nota = [notaElvira, voce.nota_2322, voce.traduzione].filter(Boolean).join('\n\n');
  if (nota) pagina.notaElvira = nota;
  if (voce.schizzo) pagina.schizzo = voce.schizzo;
  return {
    id,
    tipo,
    titolo: voce.titolo ?? id,
    ...(voce.supporto ? { supporto: voce.supporto } : {}),
    pagine: [pagina],
  };
}

/** Il libretto di Aurelio: tutte le voci di testi.libretto, nell'ordine dato (o in quello del file). */
export function librettoDaTesti(libretto: Record<string, VoceTestiJson>, opz: { ordine?: string[]; titolo?: string } = {}): Carta {
  const ordine = opz.ordine ?? Object.keys(libretto).filter((k) => !k.startsWith('_'));
  const pagine: PaginaCarta[] = [];
  for (const k of ordine) {
    const v = libretto[k];
    if (!v) continue;
    pagine.push(...cartaDaTesto(k, v, 'libretto', 'libretto').pagine);
  }
  return { id: 'libretto', tipo: 'libretto', titolo: opz.titolo ?? 'Libretto di campagna di Aurelio Respini', pagine };
}

/** Una leggenda dell'Ombrista: una pagina per quadro, con la figura del telo descritta come schizzo. */
export function cartaDaLeggenda(id: string, voce: VoceTestiJson): Carta {
  const quadri = voce.quadri ?? [];
  const pagine: PaginaCarta[] = quadri.map((q) => ({ testo: q.testo, ...(q.figure ? { schizzo: q.figure } : {}) }));
  if (voce.chiusura && pagine.length) pagine[pagine.length - 1]!.margine = voce.chiusura;
  return { id, tipo: 'foglio', titolo: voce.titolo ?? id, supporto: 'Figure di cartone controluce, sul telo della Piazza delle Ore', pagine };
}

// ---------- taccuino.json ----------

export interface TaccuinoJson {
  /** `indizi` può citare anche proverbi; `risposta` è l'id dell'indizio che chiude la domanda. */
  domande?: { id: string; mano?: string; testo: string; indizi?: string[]; risposta?: string }[];
  indizi?: { id: string; mano?: string; testo: string; fonte: string; domanda?: string }[];
  note?: { id: string; mano?: string; testo: string; sotto?: string }[];
  parole?: { id: string; tecnica: string; locale: string; nota?: string }[];
  proverbi?: { id: string; dialetto?: string | null; italiano: string; fonte?: string; nota_elvira?: string }[];
  leggende?: { id: string; testo: string; fonte: string; testo_completo?: string }[];
}

export interface StatoTaccuino {
  /** Id delle voci già entrate nel taccuino (effetti «taccuino:<id>»). */
  voci: Iterable<string>;
  /** Id delle voci ancora da vedere (evidenziate a matita). */
  nuove?: Iterable<string>;
  /** Id delle domande chiuse, con la risposta se c'è. */
  chiuse?: Iterable<string> | Record<string, string>;
  /** Testo della riga del cielo (il gioco sostituisce già {secondi}). */
  prossimoEvento: string;
  /** Sacche d'aria trovate (scheda «Respiri»); assente = scheda nascosta. */
  respiri?: { nome: string; dove: string; nuovo?: boolean }[];
}

const mano = (m: string | undefined): ManoTaccuino | undefined => (m === 'madre' || m === 'tecnica' ? m : undefined);

/** Costruisce i dati del Taccuino dalle voci di taccuino.json che il giocatore ha già raccolto. */
export function taccuinoDaContenuti(json: TaccuinoJson, stato: StatoTaccuino): DatiTaccuino {
  const voci = new Set(stato.voci);
  const nuove = new Set(stato.nuove ?? []);
  const chiuseRisposte: Record<string, string> = {};
  const chiuse = new Set<string>();
  if (Array.isArray(stato.chiuse) || stato.chiuse instanceof Set) {
    for (const c of stato.chiuse as Iterable<string>) chiuse.add(c);
  } else if (stato.chiuse) {
    for (const [k, v] of Object.entries(stato.chiuse)) {
      chiuse.add(k);
      chiuseRisposte[k] = v;
    }
  }
  const nota = (n: { id: string; mano?: string; testo: string }): NotaTaccuino => ({
    id: n.id,
    testo: n.testo,
    ...(mano(n.mano) ? { mano: mano(n.mano)! } : {}),
    ...(nuove.has(n.id) ? { nuova: true } : {}),
  });
  const noteAttive = (json.note ?? []).filter((n) => voci.has(n.id));
  const domandeIds = new Set((json.domande ?? []).map((d) => d.id));
  const indiziIds = new Set((json.indizi ?? []).map((i) => i.id));

  const indizio = (i: NonNullable<TaccuinoJson['indizi']>[number]): IndizioTaccuino => {
    const sotto = noteAttive.filter((n) => n.sotto === i.id).map(nota);
    return {
      id: i.id,
      testo: i.testo,
      fonte: i.fonte,
      ...(mano(i.mano) ? { mano: mano(i.mano)! } : {}),
      ...(sotto.length ? { note: sotto } : {}),
      ...(nuove.has(i.id) ? { nuovo: true } : {}),
    };
  };
  const indiziAttivi = (json.indizi ?? []).filter((i) => voci.has(i.id));
  // Una domanda può citare un proverbio come indizio: diventa un indizio con la sua fonte.
  const proverbiComeIndizi = (json.proverbi ?? [])
    .filter((p) => voci.has(p.id))
    .map((p) => ({ id: p.id, testo: p.dialetto ? `«${p.dialetto}» ${p.italiano}` : `«${p.italiano}»`, fonte: p.fonte ?? 'un proverbio', mano: 'madre' }));
  const piste: PistaTaccuino[] = [];
  for (const d of json.domande ?? []) {
    const ordine = d.indizi ?? [];
    const suoi = [
      ...indiziAttivi.filter((i) => ordine.includes(i.id) || i.domanda === d.id),
      ...proverbiComeIndizi.filter((p) => ordine.includes(p.id)),
    ];
    if (!voci.has(d.id) && !suoi.length) continue;
    // Gli indizi nell'ordine della domanda, poi gli altri che la citano.
    suoi.sort((a, b) => (ordine.indexOf(a.id) + 1 || 999) - (ordine.indexOf(b.id) + 1 || 999));
    const note = noteAttive.filter((n) => n.sotto === d.id).map(nota);
    if (chiuse.has(d.id) && !chiuseRisposte[d.id] && d.risposta) {
      const r = (json.indizi ?? []).find((i) => i.id === d.risposta);
      if (r) chiuseRisposte[d.id] = r.testo;
    }
    piste.push({
      id: d.id,
      domanda: d.testo,
      indizi: suoi.map(indizio),
      ...(mano(d.mano) ? { mano: mano(d.mano)! } : {}),
      ...(note.length ? { note } : {}),
      ...(nuove.has(d.id) ? { nuova: true } : {}),
      ...(chiuse.has(d.id) ? { chiusa: true } : {}),
      ...(chiuseRisposte[d.id] ? { risposta: chiuseRisposte[d.id]! } : {}),
    });
  }
  // Indizi senza una domanda nota e note libere vanno fra gli appunti.
  const orfani = indiziAttivi.filter((i) => !(json.domande ?? []).some((d) => (d.indizi ?? []).includes(i.id) || i.domanda === d.id));
  const libere = noteAttive.filter((n) => !n.sotto || (!domandeIds.has(n.sotto) && !indiziIds.has(n.sotto)));
  const appunti: NotaTaccuino[] = [...libere.map(nota), ...orfani.map((i) => nota({ id: i.id, mano: i.mano, testo: `${i.testo} (${i.fonte})` } as { id: string; mano?: string; testo: string }))];

  const parole: ParolaTaccuino[] = (json.parole ?? [])
    .filter((p) => voci.has(p.id))
    .map((p) => ({ tecnica: p.tecnica, locale: p.locale, ...(p.nota ? { nota: p.nota } : {}), ...(nuove.has(p.id) ? { nuova: true } : {}) }));
  const proverbi: ProverbioTaccuino[] = (json.proverbi ?? [])
    .filter((p) => voci.has(p.id))
    .map((p) => ({
      id: p.id,
      dialetto: p.dialetto ?? null,
      italiano: p.italiano,
      ...(p.fonte ? { fonte: p.fonte } : {}),
      ...(p.nota_elvira ? { nota: p.nota_elvira } : {}),
      ...(nuove.has(p.id) ? { nuovo: true } : {}),
    }));
  const leggende: LeggendaTaccuino[] = (json.leggende ?? [])
    .filter((l) => voci.has(l.id))
    .map((l) => ({ id: l.id, testo: l.testo, fonte: l.fonte, ...(l.testo_completo ? { testoCompleto: l.testo_completo } : {}), ...(nuove.has(l.id) ? { nuova: true } : {}) }));

  return {
    prossimoEvento: stato.prossimoEvento,
    piste,
    parole,
    ...(appunti.length ? { note: appunti } : {}),
    ...(proverbi.length ? { proverbi } : {}),
    leggende,
    ...(stato.respiri ? { respiri: stato.respiri } : {}),
  };
}

// ---------- fade_fase1.json, capisaldi.json, luoghi.json ----------

export interface ParticellaFadeJson {
  id: number;
  catasto?: string;
  iz: number;
  itheta: number;
  tipo?: string;
  nomi?: string[];
  stato_iniziale?: string;
  rilevata_da?: string | null;
}

/** Terreno dell'acquerello dal tipo di particella di fade_fase1.json. */
export function terrenoDaTipo(tipo: string | undefined): TerrenoParticella {
  switch (tipo) {
    case 'riale':
    case 'lago':
    case 'acqua':
      return 'acqua';
    case 'abitato':
    case 'piazza':
    case 'casa':
      return 'abitato';
    case 'cresta':
    case 'roccia':
    case 'parete':
      return 'roccia';
    default:
      return 'terra';
  }
}

/**
 * Griglia della Pianta dalle particelle di fade_fase1.json (griglia del motore, id = iz·96 + iθ).
 * `stati` (facoltativo) sostituisce gli stati iniziali con quelli correnti, per id di cella.
 */
export function grigliaDaParticelle(
  particelle: ParticellaFadeJson[],
  opz: { nZ?: number; nTheta?: number; stati?: ReadonlyMap<number, StatoParticella> | Record<number, StatoParticella>; cambiate?: Iterable<number> } = {},
): GrigliaPianta {
  const nZ = opz.nZ ?? GRIGLIA_PREDEFINITA.nZ;
  const nTheta = opz.nTheta ?? GRIGLIA_PREDEFINITA.nTheta;
  const n = nZ * nTheta;
  const stati = new Uint8Array(n);
  const terreno = new Uint8Array(n);
  const seppia = new Uint8Array(n);
  const cambiate = new Uint8Array(n);
  const sostituti = opz.stati instanceof Map ? opz.stati : new Map(Object.entries(opz.stati ?? {}).map(([k, v]) => [Number(k), v as StatoParticella]));
  for (const p of particelle) {
    const i = Number.isInteger(p.id) ? p.id : p.iz * nTheta + p.itheta;
    if (i < 0 || i >= n) continue;
    const s = (sostituti.get(i) ?? p.stato_iniziale ?? 'bianco') as StatoParticella;
    stati[i] = CODICE_STATO[s] ?? 0;
    terreno[i] = CODICE_TERRENO[terrenoDaTipo(p.tipo)];
    if (p.rilevata_da && /G4|seppia|2291/i.test(p.rilevata_da)) seppia[i] = 1;
  }
  for (const c of opz.cambiate ?? []) if (c >= 0 && c < n) cambiate[c] = 1;
  return { nZ, nTheta, stati, terreno, seppia, cambiate };
}

export interface CaposaldoJson {
  id: string;
  numero: number;
  tipo?: string;
  nome?: string;
  z: number;
  theta: number;
}

/** Capisaldi di capisaldi.json (rete e lontani) con lo stato di rilievo del giocatore. */
export function capisaldiDaContenuti(
  json: { rete_corbella?: CaposaldoJson[]; lontani_di_notte?: CaposaldoJson[]; [k: string]: unknown },
  stato: { rilevati?: Iterable<string>; visti?: Iterable<string> } = {},
): CaposaldoPianta[] {
  const rilevati = new Set(stato.rilevati ?? []);
  const visti = new Set(stato.visti ?? []);
  return [...(json.rete_corbella ?? []), ...(json.lontani_di_notte ?? [])].map((c) => ({
    id: c.id,
    numero: c.numero,
    tipo: c.tipo === 'chiodo' ? 'chiodo' : 'pilastro',
    z: c.z,
    theta: c.theta,
    rilevato: rilevati.has(c.id),
    ...(visti.has(c.id) ? { visto: true } : {}),
    ...(c.nome ? { nome: c.nome } : {}),
  }));
}

/** Lati di capisaldi.json già chiusi dal giocatore. */
export function latiDaContenuti(lati: { id: string; a: string; b: string }[], chiusi: Iterable<string>): LatoPianta[] {
  const c = new Set(chiusi);
  return lati.filter((l) => c.has(l.id)).map((l) => ({ da: l.a, a: l.b }));
}

/** Tipi di luogo che hanno un nome sulla Pianta (gli interni, gli oggetti e le scene no). */
export const TIPI_LUOGO_SULLA_PIANTA = ['edificio', 'piazza', 'rifugio', 'belvedere', 'terrazza', 'selva', 'quartiere', 'prato', 'casa'];

export function luoghiDaContenuti(luoghi: { id: string; nome: string; z: number; theta: number; tipo?: string }[], tipi = TIPI_LUOGO_SULLA_PIANTA): LuogoPianta[] {
  return luoghi.filter((l) => !l.tipo || tipi.includes(l.tipo)).map((l) => ({ id: l.id, nome: l.nome, z: l.z, theta: l.theta }));
}

// ---------- dialoghi.json, personaggi.json ----------

export interface PersonaggioJson {
  id: string;
  nome: string;
  come_appare?: { velo?: string; maschera?: string; postura?: string } | string;
}

export interface RispostaJson {
  testo: string;
  vai_a?: string;
  condizione?: string;
  effetti?: string[];
}

export interface DialogoJson {
  personaggio: string;
  nodi: { id: string; testo: string; didascalia?: string; risposte?: RispostaJson[] }[];
}

/** Una riga breve su come appare un personaggio velato: il velo e, se c'è, la maschera. */
export function aspettoDaPersonaggio(p: PersonaggioJson | undefined): string | undefined {
  if (!p?.come_appare) return undefined;
  if (typeof p.come_appare === 'string') return p.come_appare;
  const parti: string[] = [];
  const velo = p.come_appare.velo?.split(';')[0]?.trim();
  if (velo && !/^nessun/i.test(velo)) parti.push(velo);
  const maschera = p.come_appare.maschera?.split(';')[0]?.trim();
  if (maschera && !/^nessun/i.test(maschera)) parti.push(maschera);
  if (!parti.length) {
    const postura = p.come_appare.postura?.split(';')[0]?.trim();
    if (postura) parti.push(postura);
  }
  return parti.join(' · ') || undefined;
}

/**
 * La battuta di un nodo di dialoghi.json. `valuta` decide quali risposte mostrare (condizioni del motore
 * della storia); senza, le mostra tutte. Restituisce anche le risposte originali nello stesso ordine,
 * così il gioco sa dove porta la scelta (vai_a, effetti).
 */
export function battutaDaNodo(
  dialogo: DialogoJson,
  nodoId: string,
  personaggi: PersonaggioJson[] = [],
  valuta: (condizione: string) => boolean = () => true,
): { battuta: BattutaDialogo; risposte: RispostaJson[] } | null {
  const nodo = dialogo.nodi.find((n) => n.id === nodoId);
  if (!nodo) return null;
  const p = personaggi.find((x) => x.id === dialogo.personaggio);
  const risposte = (nodo.risposte ?? []).filter((r) => !r.condizione || valuta(r.condizione));
  const aspetto = aspettoDaPersonaggio(p);
  return {
    battuta: {
      chi: p?.nome ?? dialogo.personaggio,
      testo: nodo.testo,
      ...(aspetto ? { aspetto } : {}),
      ...(nodo.didascalia ? { didascalia: nodo.didascalia } : {}),
      ...(risposte.length ? { risposte: risposte.map((r) => ({ testo: r.testo })) } : {}),
    },
    risposte,
  };
}
