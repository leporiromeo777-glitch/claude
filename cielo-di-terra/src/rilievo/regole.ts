/**
 * Compila i contenuti (capisaldi.json, fade_fase1.json) nelle regole del catasto.
 *
 * La lettura è tollerante: un campo mancante prende il valore di partenza e un id
 * sconosciuto finisce in `regole.problemi`, senza fermare il gioco. Le regole non si
 * salvano: si ricompilano dai contenuti a ogni avvio.
 */
import { CATALOGO_ELEMENTI, MOSSE_GDD, PILASTRI_GDD, TETTO_MOSSE_PER_ATTO, TRIANGOLI_GDD } from './catalogoGdd';
import { PARAMETRI_PREDEFINITI, type ParametriCatasto } from './costanti';
import { idCella, idValido, nomeCatastale, strisciaDi } from './griglia';
import { leggiCollare, leggiIntervallo, minuti, type FaseDelGiorno } from './tempo';
import type {
  DefAncora,
  DefCaposaldo,
  DefCiclo,
  DefElemento,
  DefLato,
  DefLume,
  DefMossa,
  DefNotte,
  DefParticella,
  DefTriangolo,
  DefVariante,
  RegoleAttive,
  RegoleCatasto,
  StatoParticella,
  TestiResoconto,
} from './tipi';

export interface ContenutiCatasto {
  /** content/capisaldi.json */
  capisaldi?: unknown;
  /** content/fade_fase1.json */
  fade?: unknown;
}

export interface OpzioniRegole {
  /** Fase di costruzione (GDD §11): 1 = Corbella. Decide che cosa è attivo. */
  fase?: number;
  parametri?: Partial<ParametriCatasto>;
  regoleAttive?: Partial<RegoleAttive>;
  /** Aggiunge i pilastri del GDD §2.6 che i contenuti non hanno ancora (predefinito: sì). */
  pilastriGdd?: boolean;
  triangoli?: DefTriangolo[];
  /** Particelle di trama dei triangoli (T1 → [..]): i contenuti della Fase 1 non le hanno. */
  particelleTrama?: Record<string, number[]>;
  mosse?: DefMossa[];
  ancore?: DefAncora[];
  testi?: Partial<TestiResoconto>;
  /** Flag da accendere quando una particella è rilevata. */
  flagCelle?: Record<number, string>;
  /** Particelle delle vie di trama (regola 4). */
  vieDiTrama?: number[];
}

/** Testi del resoconto che i contenuti non scrivono (proposte di questo modulo, vedi README). */
export const TESTI_PREDEFINITI: TestiResoconto = {
  titolo: 'Che cosa è cambiato stanotte',
  perVariante: {
    Carta: '{nome}: non misurata, tornata alla Carta.',
    Smontata: '{nome}: non misurata, un muro in meno.',
    Mietuta: '{nome}: non misurata, mietuta dal Protocollo.',
    '*': '{nome}: non misurata, cambiata ({variante}).',
  },
  nessunCambiamento: 'Notte quieta.',
  rilevataRimasta: '{nome}: misurata, è rimasta.',
  vegliata: "{nome}: c'eri tu, le Fade ti hanno girato attorno.",
  protetta: '{nome}: protetta, è rimasta.',
  caposaldoSpostato: '{caposaldo} spostato di {metri} m a {direzione}.',
  scritturaCancellata: '{nome}: scrittura G5 cancellata dal G3.',
  scritturaCostruita: "{nome}: la Penna ha scritto, le Fade hanno costruito. Va rimisurata all'alba.",
  legatoMisurato: 'Le pietre restano in un mucchio al margine (misurato: {legato}).',
  prossimaFinestra: 'Alle {ora}: {testo}',
};

const MOTIVO_LIBRETTO_INCOLLATO = "Le pagine del libretto per quella valle sono incollate dall'umidità.";

// ───────── lettura tollerante ─────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const strArr = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === 'string');
const numArr = (v: unknown): number[] => arr(v).filter((x): x is number => typeof x === 'number' && Number.isInteger(x));

function oraOpzionale(v: unknown, problemi: string[], dove: string): number | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  try {
    return minuti(v);
  } catch {
    problemi.push(`${dove}: ora non leggibile «${String(v)}»`);
    return null;
  }
}

function leggiQuando(v: unknown): FaseDelGiorno[] {
  const t = str(v).toLowerCase();
  if (!t || /\bmai\b/.test(t)) return [];
  const out: FaseDelGiorno[] = [];
  if (/giorno/.test(t)) out.push('alba', 'giorno');
  if (/brace/.test(t)) out.push('brace');
  if (/notte/.test(t)) out.push('notte');
  return out;
}

/** Chiave di una coppia di capisaldi, indipendente dall'ordine. */
export function chiaveCoppia(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** «cs_7» → «7»; «cs_E1» → «E1». */
export function etichettaDaId(id: string): string {
  return id.replace(/^cs_/, '');
}

function statoParticella(v: unknown): StatoParticella {
  return v === 'matita' || v === 'colore' ? v : 'bianco';
}

// ───────── compilazione ─────────

export function regoleDaContenuti(contenuti: ContenutiCatasto, opzioni: OpzioniRegole = {}): RegoleCatasto {
  const problemi: string[] = [];
  const fase = opzioni.fase ?? 1;
  const cap = isObj(contenuti.capisaldi) ? contenuti.capisaldi : {};
  const fade = isObj(contenuti.fade) ? contenuti.fade : {};
  if (!isObj(contenuti.capisaldi)) problemi.push('capisaldi.json mancante: nessun caposaldo dai contenuti');
  if (!isObj(contenuti.fade)) problemi.push('fade_fase1.json mancante: nessuna particella e nessun elemento mobile dai contenuti');

  // parametri
  const rc = isObj(cap.regole) ? cap.regole : {};
  const parametri: ParametriCatasto = {
    ...PARAMETRI_PREDEFINITI,
    latoMin: num(rc.lato_min_m, PARAMETRI_PREDEFINITI.latoMin),
    latoMaxGiorno: num(rc.lato_max_giorno_m, PARAMETRI_PREDEFINITI.latoMaxGiorno),
    bufferVentaglio: num(rc.buffer_ventaglio_m, PARAMETRI_PREDEFINITI.bufferVentaglio),
    abbagliamentoAsse: num(rc.abbagliamento_asse_m, PARAMETRI_PREDEFINITI.abbagliamentoAsse),
    ...opzioni.parametri,
  };

  // regole attive (GDD §11): la Fase 1 ha le regole 3 e 4; le mosse della Madre e il terminale
  // arrivano con la Fase 5. fade_fase1.json lo conferma: «Nessuna mossa», «Nessuna: Elvira non ha la Penna».
  const regoleTesto = arr(fade.regole).filter(isObj);
  const spenta = (ordine: number): boolean => {
    const r = regoleTesto.find((x) => x.ordine === ordine);
    return !!r && /^\s*nessun/i.test(str(r.fase1));
  };
  if (fase < 5 && regoleTesto.length > 0 && (!spenta(1) || !spenta(2))) {
    problemi.push('fade_fase1.json → regole: in Fase 1 le regole 1 e 2 dovrebbero dire «Nessuna…»');
  }
  const regoleAttive: RegoleAttive = {
    mosse: fase >= 5,
    terminale: fase >= 5,
    giro: true,
    eccezioni: true,
    ...opzioni.regoleAttive,
  };

  // particelle
  const particelle = new Map<number, DefParticella>();
  const vieDiTrama = new Set(opzioni.vieDiTrama ?? []);
  for (const p of arr(fade.particelle).filter(isObj)) {
    const id = typeof p.id === 'number' ? p.id : -1;
    if (!idValido(id)) {
      problemi.push(`fade_fase1.json: particella con id non valido ${String(p.id)}`);
      continue;
    }
    const rd = isObj(p.rilevata_da) ? p.rilevata_da : null;
    particelle.set(id, {
      id,
      catasto: str(p.catasto, nomeCatastale(id)),
      tipo: strOrNull(p.tipo),
      nomi: strArr(p.nomi),
      hub: p.hub === true,
      rifugio: p.rifugio === true,
      viaTrama: p.via_trama === true || vieDiTrama.has(id),
      elemento: strOrNull(p.elemento),
      inventario: p.inventario_corbella === true,
      statoIniziale: statoParticella(p.stato_iniziale),
      rilevataDa: rd
        ? {
            firma: str(rd.codice, 'G?'),
            anno: typeof rd.anno === 'number' ? rd.anno : null,
            lato: strOrNull(rd.lato),
            inchiostro: rd.inchiostro === 'china' ? 'china' : 'seppia',
          }
        : null,
    });
    if (p.stato_iniziale === 'colore' && !rd) problemi.push(`particella ${id}: a colore senza «rilevata_da»`);
  }
  for (const id of vieDiTrama) {
    if (!particelle.has(id) && idValido(id)) {
      particelle.set(id, {
        id,
        catasto: nomeCatastale(id),
        tipo: null,
        nomi: [],
        hub: false,
        rifugio: false,
        viaTrama: true,
        elemento: null,
        inventario: false,
        statoIniziale: 'bianco',
        rilevataDa: null,
      });
    }
  }

  const g = isObj(fade.griglia) ? fade.griglia : {};
  const ag = isObj(g.area_fase1) ? g.area_fase1 : null;
  const area =
    ag && numArr(ag.iz).length === 2 && numArr(ag.itheta).length === 2
      ? { izMin: numArr(ag.iz)[0]!, izMax: numArr(ag.iz)[1]!, itMin: numArr(ag.itheta)[0]!, itMax: numArr(ag.itheta)[1]! }
      : null;

  // capisaldi
  const capisaldi = new Map<string, DefCaposaldo>();
  const aggiungiCaposaldo = (c: Obj, lontano: boolean): void => {
    const id = str(c.id);
    if (!id) {
      problemi.push('capisaldi.json: caposaldo senza id');
      return;
    }
    const z = num(c.z, NaN);
    const theta = num(c.theta, NaN);
    if (!Number.isFinite(z) || !Number.isFinite(theta)) {
      problemi.push(`capisaldi.json: ${id} senza coordinate`);
      return;
    }
    const numero = typeof c.numero === 'number' ? c.numero : null;
    const zero = numero === 0 || id === 'cs_0';
    // un pilastro della rete vicina, visto da lontano di notte, ha bisogno del lume di mira di Ottavio
    let lume: DefLume | null =
      !lontano && c.tipo === 'pilastro' ? { tipo: 'ottavio', descrizione: 'il lume di mira di Ottavio', ore: [21 * 60, 5 * 60], collare: [] } : null;
    if (lontano) {
      const l = str(c.lume).toLowerCase();
      lume = {
        tipo: l === 'permanente' ? 'permanente' : l === 'ottavio' ? 'ottavio' : 'nessuno',
        descrizione: str(c.lume_descrizione),
        ore: leggiIntervallo(str(c.ore)),
        collare: leggiCollare(str(c.collare)),
      };
    }
    const attivo = lontano ? (zero ? false : fase >= 3 || c.attivo_fase1 === true) : true;
    const sempreBianco = zero || /sempre bianco/i.test(str(c.collare));
    capisaldi.set(id, {
      id,
      numero,
      etichetta: numero !== null ? String(numero) : etichettaDaId(id),
      tipo: zero ? 'zero' : c.tipo === 'chiodo' ? 'chiodo' : 'pilastro',
      nome: str(c.nome, id),
      z,
      theta,
      altezza: num(c.altezza, 0),
      altezzaSegnale: num(c.altezza_segnale, 0),
      cella: typeof c.cella === 'number' && idValido(c.cella) ? c.cella : idCella(z, theta),
      valle: strisciaDi(theta).id,
      visibileDa: strArr(c.visibile_da),
      nonVisibileDa: arr(c.non_visibile_da)
        .filter(isObj)
        .map((n) => ({ id: str(n.id), motivo: str(n.motivo) })),
      lume,
      lontano,
      rilevabile: attivo,
      motivoNonRilevabile: attivo
        ? null
        : zero
          ? 'Il Caposaldo Zero è stato cancellato dalla Carta nel 2265.'
          : MOTIVO_LIBRETTO_INCOLLATO,
      sempreBianco,
      rilevatoDa: /G4/.test(str(c.stato_iniziale)) ? 'G4' : null,
      monografia: strOrNull(c.monografia),
      luogo: strOrNull(c.luogo),
      fonte: 'contenuti',
    });
  };
  for (const c of arr(cap.rete_corbella).filter(isObj)) aggiungiCaposaldo(c, false);
  for (const c of arr(cap.lontani_di_notte).filter(isObj)) aggiungiCaposaldo(c, true);

  if (opzioni.pilastriGdd !== false) {
    for (const p of PILASTRI_GDD) {
      const id = `cs_${p.numero}`;
      if (capisaldi.has(id)) continue;
      const attivo = fase >= 3 && !p.divelto;
      capisaldi.set(id, {
        id,
        numero: p.numero,
        etichetta: String(p.numero),
        tipo: 'pilastro',
        nome: `Pilastro ${p.numero}, ${p.nome}`,
        z: p.z,
        theta: p.theta,
        altezza: p.altezza,
        altezzaSegnale: 8,
        cella: idCella(p.z, p.theta),
        valle: strisciaDi(p.theta).id,
        visibileDa: [],
        nonVisibileDa: [],
        lume: { tipo: p.divelto ? 'nessuno' : 'ottavio', descrizione: '', ore: p.divelto ? null : [21 * 60, 5 * 60], collare: [] },
        lontano: true,
        rilevabile: attivo,
        motivoNonRilevabile: attivo ? null : p.divelto ? 'Divelto nel 2266: restano i fori nella roccia.' : MOTIVO_LIBRETTO_INCOLLATO,
        sempreBianco: false,
        rilevatoDa: null,
        monografia: null,
        luogo: null,
        fonte: 'GDD',
      });
    }
    if (!capisaldi.has('cs_0')) {
      capisaldi.set('cs_0', {
        id: 'cs_0',
        numero: 0,
        etichetta: '0',
        tipo: 'zero',
        nome: 'Caposaldo Zero, soglia della Lanterna',
        z: 2968,
        theta: 0,
        altezza: 642,
        altezzaSegnale: 0,
        cella: idCella(2968, 0),
        valle: strisciaDi(0).id,
        visibileDa: [],
        nonVisibileDa: [],
        lume: { tipo: 'nessuno', descrizione: '', ore: null, collare: [] },
        lontano: true,
        rilevabile: false,
        motivoNonRilevabile: 'Il Caposaldo Zero è stato cancellato dalla Carta nel 2265.',
        sempreBianco: true,
        rilevatoDa: null,
        monografia: null,
        luogo: null,
        fonte: 'GDD',
      });
    }
  }
  for (const c of capisaldi.values()) {
    for (const v of c.visibileDa) if (!capisaldi.has(v)) problemi.push(`${c.id}: visibile_da contiene un caposaldo sconosciuto «${v}»`);
  }

  // lati
  const lati = new Map<string, DefLato>();
  for (const l of arr(cap.lati).filter(isObj)) {
    const id = str(l.id);
    const a = str(l.a);
    const b = str(l.b);
    if (!id || !capisaldi.has(a) || !capisaldi.has(b)) {
      problemi.push(`capisaldi.json: lato «${id}» con capisaldi sconosciuti (${a}, ${b})`);
      continue;
    }
    const chiudibile = l.chiudibile !== false;
    const ventaglio = numArr(l.particelle).filter(idValido);
    if (chiudibile && ventaglio.length === 0) problemi.push(`lato ${id}: senza ventaglio precalcolato, si usa la fascia geometrica di ${parametri.bufferVentaglio} m`);
    lati.set(id, {
      id,
      a,
      b,
      lunghezza: num(l.lunghezza, NaN),
      chiudibile,
      quando: leggiQuando(l.quando),
      particelle: ventaglio,
      particelleSeChiudibile: numArr(l.particelle_se_fosse_chiudibile),
      nota: str(l.nota),
    });
  }

  // elementi mobili
  const motiviNotti = new Map<string, Record<string, string>>();
  const notti = new Map<number, DefNotte>();
  for (const n of arr(fade.notti).filter(isObj)) {
    const numero = num(n.notte, NaN);
    if (!Number.isInteger(numero)) continue;
    const eventi: { ora: number; testo: string }[] = [];
    for (const voce of arr(n.giro).filter(isObj)) {
      const ora = oraOpzionale(voce.ora, problemi, `notte ${numero}`);
      if (typeof voce.elemento === 'string' && typeof voce.motivo === 'string') {
        const m = motiviNotti.get(voce.elemento) ?? {};
        m[`${str(voce.da)}>${str(voce.a)}`] = voce.motivo;
        motiviNotti.set(voce.elemento, m);
      } else if (typeof voce.evento === 'string' && ora !== null) {
        eventi.push({ ora, testo: voce.evento });
      }
    }
    const pes = isObj(n.pesarina) ? n.pesarina : null;
    notti.set(numero, {
      numero,
      pesarinaFlag: pes ? strOrNull(pes.flag) : null,
      pesarinaOra: pes ? oraOpzionale(pes.ora, problemi, `notte ${numero} pesarina`) : null,
      eventi,
    });
  }
  const giroEventi: { ora: number; dove: string; testo: string }[] = [];
  const giroPerElemento = new Map<string, { dove: string; cheCosa: string }>();
  for (const voce of arr(fade.giro_corbella).filter(isObj)) {
    const ora = oraOpzionale(voce.ora, problemi, 'giro_corbella');
    const els = typeof voce.elemento === 'string' ? [voce.elemento] : strArr(voce.elemento);
    if (els.length === 0 && ora !== null) giroEventi.push({ ora, dove: str(voce.dove), testo: str(voce.che_cosa) });
    for (const e of els) giroPerElemento.set(e, { dove: str(voce.dove), cheCosa: str(voce.che_cosa) });
  }

  const elementi = new Map<string, DefElemento>();
  const elementoDiCella = new Map<number, string>();
  for (const e of arr(fade.elementi_mobili).filter(isObj)) {
    const id = str(e.id);
    if (!id) continue;
    const varianti: DefVariante[] = arr(e.varianti)
      .filter(isObj)
      .map((v) => ({ id: str(v.id), descrizione: str(v.descrizione), pezzi: strArr(v.pezzi) }));
    const nomiVarianti = new Set(varianti.map((v) => v.id));
    const cicli: DefCiclo[] = [];
    for (const c of arr(e.cicli_del_giorno).filter(isObj)) {
      const ora = oraOpzionale(c.ora, problemi, `${id} ciclo`);
      if (ora === null) continue;
      cicli.push({ ora, chi: str(c.chi), da: str(c.da), a: str(c.a), testo: str(c.testo) });
    }
    const stadi = strArr(e.stadi);
    const particelleEl = numArr(e.particelle).filter(idValido);
    const varianteIniziale = str(e.variante_iniziale, 'Carta');
    if (!nomiVarianti.has(varianteIniziale)) problemi.push(`${id}: variante iniziale «${varianteIniziale}» sconosciuta`);
    if (!nomiVarianti.has('Carta')) problemi.push(`${id}: manca la variante Carta`);
    const giro = giroPerElemento.get(id);
    elementi.set(id, {
      id,
      nome: str(e.nome, id),
      particelle: particelleEl,
      trama: e.trama === true,
      varianti,
      varianteIniziale,
      oraFade: oraOpzionale(e.ora_fade, problemi, id),
      stadi: stadi.length > 0 ? stadi : null,
      cicli,
      viaNecessaria: e.via_necessaria === true,
      alternativa: strOrNull(e.alternativa),
      legatoA: strOrNull(e.legato_a),
      protocollo: nomiVarianti.has('Mietuta') || e.protocollo === true,
      motivi: motiviNotti.get(id) ?? {},
      cheCosa: giro?.cheCosa ?? null,
      dove: giro?.dove ?? null,
      note: str(e.note),
    });
    for (const c of particelleEl) {
      const prima = elementoDiCella.get(c);
      if (prima && prima !== id) problemi.push(`particella ${c} in due elementi (${prima}, ${id})`);
      elementoDiCella.set(c, id);
      const def = particelle.get(c);
      if (def && def.elemento !== id) problemi.push(`particella ${c}: «elemento» ${String(def.elemento)} ma è in ${id}`);
    }
  }

  // inventario
  const inv = isObj(fade.inventario_corbella) ? fade.inventario_corbella : null;
  const inventario = inv
    ? { nome: 'Corbella', particelle: numArr(inv.particelle).filter(idValido), flag: 'corbella_a_colori' }
    : null;
  if (inv && typeof inv.quante === 'number' && inventario && inv.quante !== inventario.particelle.length) {
    problemi.push(`inventario_corbella: «quante» = ${inv.quante} ma le particelle sono ${inventario.particelle.length}`);
  }

  // flag sulle celle
  const flagCelle = new Map<number, string>();
  if (opzioni.flagCelle) {
    for (const [k, v] of Object.entries(opzioni.flagCelle)) flagCelle.set(Number(k), v);
  } else {
    for (const p of particelle.values()) if (p.nomi.includes('casa_nando')) flagCelle.set(p.id, 'casa_nando_rilevata');
  }

  // triangoli
  const triangoli = new Map<string, DefTriangolo>();
  for (const t of opzioni.triangoli ??
    TRIANGOLI_GDD.map((x) => ({ ...x, particelleTrama: [] as number[] }))) {
    triangoli.set(t.id, { ...t, particelleTrama: opzioni.particelleTrama?.[t.id] ?? t.particelleTrama ?? [] });
  }

  // testi
  const rm = isObj(fade.resoconto_del_mattino) ? fade.resoconto_del_mattino : {};
  const righe = isObj(rm.righe) ? rm.righe : {};
  const perVariante: Record<string, string> = { ...TESTI_PREDEFINITI.perVariante };
  for (const [k, v] of Object.entries(righe)) {
    if (typeof v !== 'string') continue;
    if (k === 'nessun_cambiamento' || k === 'rilevata_rimasta') continue;
    perVariante[k] = v;
  }
  const testi: TestiResoconto = {
    ...TESTI_PREDEFINITI,
    titolo: str(rm.titolo, TESTI_PREDEFINITI.titolo),
    perVariante,
    nessunCambiamento: str(righe.nessun_cambiamento, TESTI_PREDEFINITI.nessunCambiamento),
    rilevataRimasta: str(righe.rilevata_rimasta, TESTI_PREDEFINITI.rilevataRimasta),
    ...opzioni.testi,
  };

  const leggi = arr(fade.leggi)
    .filter(isObj)
    .map((l) => ({ id: str(l.id), articolo: str(l.articolo), proverbio: str(l.proverbio), italiano: str(l.italiano) }));

  const ancore = new Map<string, DefAncora>();
  for (const a of opzioni.ancore ?? []) {
    if (!elementi.has(a.elemento)) problemi.push(`ancora ${a.id}: elemento sconosciuto ${a.elemento}`);
    ancore.set(a.id, a);
  }

  // controlli incrociati
  for (const l of lati.values()) {
    for (const c of l.particelle) {
      if (particelle.size > 0 && !particelle.has(c)) problemi.push(`lato ${l.id}: la particella ${c} è fuori dall'area dei contenuti`);
    }
  }
  for (const e of elementi.values()) {
    if (!CATALOGO_ELEMENTI.some((x) => x.idFase1 === e.id || x.nome === e.nome)) {
      problemi.push(`${e.id} «${e.nome}» non è nel catalogo dei 40 elementi del GDD`);
    }
  }

  const numeriNotti = [...notti.keys()];
  return {
    fase,
    parametri,
    regoleAttive,
    particelle,
    area,
    capisaldi,
    lati,
    elementi,
    elementoDiCella,
    inventario,
    flagCelle,
    triangoli,
    mosse: opzioni.mosse ?? MOSSE_GDD,
    tettoMossePerAtto: TETTO_MOSSE_PER_ATTO,
    ancore,
    notti,
    notteModello: numeriNotti.length ? Math.max(...numeriNotti) : null,
    giroEventi,
    testi,
    leggi,
    problemi,
  };
}

/** Il lato fra due capisaldi, in qualunque ordine. */
export function latoFra(regole: RegoleCatasto, a: string, b: string): DefLato | undefined {
  const k = chiaveCoppia(a, b);
  for (const l of regole.lati.values()) if (chiaveCoppia(l.a, l.b) === k) return l;
  return undefined;
}

/** Il caposaldo con questo id, fra quelli dei contenuti e i chiodi nuovi della stazione libera. */
export function caposaldoDef(
  regole: RegoleCatasto,
  nuovi: Readonly<Record<string, DefCaposaldo>>,
  id: string,
): DefCaposaldo | undefined {
  return regole.capisaldi.get(id) ?? nuovi[id];
}

/** Definizione di una particella (quelle fuori dall'area dei contenuti sono bianche e senza ruoli). */
export function defParticella(regole: RegoleCatasto, id: number): DefParticella {
  return (
    regole.particelle.get(id) ?? {
      id,
      catasto: nomeCatastale(id),
      tipo: null,
      nomi: [],
      hub: false,
      rifugio: false,
      viaTrama: false,
      elemento: regole.elementoDiCella.get(id) ?? null,
      inventario: false,
      statoIniziale: 'bianco',
      rilevataDa: null,
    }
  );
}
