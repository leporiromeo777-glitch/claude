/**
 * La notte delle Fade (GDD §3.4): una macchina a stati finiti, deterministica e scritta prima.
 *
 * Due leggi:
 *   1. ciò che un Giardiniere ha misurato, la notte non lo tocca;
 *   2. la pietra misurata vale più della penna, finché resta al suo posto.
 * Quattro regole, sempre in quest'ordine, all'inizio del giro (22:00) e poi elemento per elemento:
 *   1. le mosse della Madre annunciate la sera prima (spostano capisaldi: il rilievo che ne
 *      dipendeva soltanto torna a matita; tetto di 8 capisaldi per notte);
 *   2. le correzioni al terminale (il G3 cancella le scritture della Penna non rimisurate);
 *   3. il giro delle Fade: ogni elemento mobile non rilevato torna alla Carta (o avanza di uno
 *      stadio) alla sua ora fissa; dopo la svolta gli elementi del Protocollo passano a Mietuta;
 *   4. le eccezioni fisse: mai l'hub, le vie di trama, i rifugi, la particella dove sta Elvira,
 *      un sentiero necessario senza un'alternativa visibile.
 *
 * `notte(stato, regole, input)` è pura: stesso stato, stesse regole, stesso input e stesso
 * seme danno sempre lo stesso risultato. Per la veglia c'è la versione a passi
 * (`iniziaNotte` → `avanzaNotte` ogni minuto con la posizione di Elvira → `chiudiNotte`).
 */
import { generatore, mescola, semeNotte } from './casuale';
import { FIRMA_ELVIRA, ORARI } from './costanti';
import { caposaldoDef, defParticella } from './regole';
import { costruisciResoconto, motivoVariante, riempi } from './resoconto';
import { cellaAColore, cellaRilevataDaElvira, clonaStato, elementoRilevato, particellaDaModificare, scriviParticella } from './stato';
import { dentroIntervallo, formattaOra, minuti, minutiNotte, type Ora } from './tempo';
import type {
  Atto,
  Cambiamento,
  DefElemento,
  DefMossa,
  EventoCatasto,
  InputNotte,
  MotivoProtezione,
  NotteInCorso,
  RegoleCatasto,
  Resoconto,
  RisultatoCatasto,
  Spostamento,
  StatoCatasto,
} from './tipi';
import { nomeBreveMaiuscolo } from './visibilita';

export interface RisultatoNotte {
  nuovoStato: StatoCatasto;
  resoconto: Resoconto;
  /** Eventi per il gioco, in ordine di tempo (varianti da scambiare, particelle perse…). */
  eventi: EventoCatasto[];
  /** Effetti per la narrativa (= resoconto.effetti). */
  effetti: string[];
}

const INIZIO_NOTTE = minutiNotte('21:00');
const FINE_NOTTE = minutiNotte('05:30');
const INIZIO_GIRO = minutiNotte('22:00');

// ───────────────────────────── utilità ─────────────────────────────

function cellaDiElvira(n: NotteInCorso, t: number): number | null {
  const e = n.input.elvira;
  if (!e) return null;
  let cella: number | null = e.cella ?? null;
  if (e.percorso?.length) {
    const tappe = e.percorso.map((p) => ({ t: minutiNotte(p.ora), cella: p.cella })).sort((a, b) => a.t - b.t);
    for (const p of tappe) if (p.t <= t) cella = p.cella;
  }
  return cella;
}

/** Variante verso cui le Fade portano l'elemento stanotte (regola 3). */
export function varianteBersaglio(e: DefElemento, corrente: string, dopoSvolta: boolean): string {
  const ha = (v: string) => e.varianti.some((x) => x.id === v);
  if (dopoSvolta && e.protocollo && ha('Mietuta')) return 'Mietuta';
  if (e.stadi) {
    const i = e.stadi.indexOf(corrente);
    if (i === -1) return 'Carta';
    return e.stadi[Math.min(i + 1, e.stadi.length - 1)]!;
  }
  return 'Carta';
}

function pezzi(e: DefElemento, v: string): string[] {
  return e.varianti.find((x) => x.id === v)?.pezzi ?? [];
}

function eventoVariante(e: DefElemento, da: string, a: string, causa: 'notte' | 'giorno' | 'gioco', ora: number | null, extra: { chi?: string; nota?: string } = {}): EventoCatasto {
  const prima = new Set(pezzi(e, da));
  const dopo = new Set(pezzi(e, a));
  return {
    tipo: 'variante_cambiata',
    elemento: e.id,
    da,
    a,
    mostra: [...dopo].filter((p) => !prima.has(p)),
    nascondi: [...prima].filter((p) => !dopo.has(p)),
    causa,
    ora,
    ...(extra.chi ? { chi: extra.chi } : {}),
    ...(extra.nota ? { nota: extra.nota } : {}),
  };
}

/** Il caposaldo sta in una particella che la Madre non tocca mai (hub, rifugi, vie di trama). */
function caposaldoIntoccabile(regole: RegoleCatasto, cella: number): boolean {
  const d = defParticella(regole, cella);
  return d.hub || d.rifugio || d.viaTrama;
}

// ───────────────────────────── regola 1: le mosse della Madre ─────────────────────────────

/**
 * Sposta un caposaldo: le particelle che dipendevano soltanto da lui perdono il rilievo
 * (colore → matita, con il segno rosso). I lati che lo usavano non valgono più.
 */
function spostaCaposaldo(
  s: StatoCatasto,
  regole: RegoleCatasto,
  n: NotteInCorso,
  id: string,
  sp: Spostamento,
  ora: number,
  eventi: EventoCatasto[],
): void {
  const def = caposaldoDef(regole, s.capisaldiNuovi, id);
  if (!def) return;
  const cs = s.capisaldi[id] ?? { visto: false, rilevato: false, firme: [], spostato: null };
  cs.spostato = sp;
  s.capisaldi[id] = cs;
  const perse: number[] = [];
  for (const [k, p0] of Object.entries(s.particelle)) {
    if (!p0.rilievi.some((r) => r.capisaldi.includes(id))) continue;
    const cella = Number(k);
    const p = particellaDaModificare(s, cella);
    p.rilievi = p.rilievi.filter((r) => !r.capisaldi.includes(id));
    if (p.rilievi.length === 0 && p.stato === 'colore') {
      p.stato = 'matita';
      p.persaPer = [...new Set([...(p.persaPer ?? []), id])];
      perse.push(cella);
    }
    scriviParticella(s, cella, p);
  }
  for (const [lid, l] of Object.entries(s.lati)) if (l.stazione === id || l.mira === id) delete s.lati[lid];
  for (const [tid, t] of Object.entries(s.triangoli)) if (t.vertici.includes(id)) delete s.triangoli[tid];
  perse.sort((a, b) => a - b);
  n.capisaldiSpostati += 1;
  let motivo = riempi(regole.testi.caposaldoSpostato, { caposaldo: nomeBreveMaiuscolo(def), metri: sp.metri, direzione: sp.direzione });
  if (perse.length) motivo += ` ${perse.length === 1 ? 'Una particella è tornata' : `${perse.length} particelle sono tornate`} a matita.`;
  n.cambiamenti.push({ ora, regola: 1, tipo: 'caposaldo_spostato', caposaldo: id, ...(sp.mossa ? { mossa: sp.mossa } : {}), particelle: perse, motivo });
  eventi.push({ tipo: 'caposaldo_spostato', caposaldo: id, spostamento: sp });
  if (perse.length) eventi.push({ tipo: 'particelle_perse', celle: perse, motivo, caposaldo: id });
}

function cancellaScrittura(s: StatoCatasto, regole: RegoleCatasto, n: NotteInCorso, ancora: string, regola: 1 | 2, ora: number, eventi: EventoCatasto[]): void {
  const a = s.ancore[ancora];
  const def = regole.ancore.get(ancora);
  const e = def ? regole.elementi.get(def.elemento) : undefined;
  if (!a || !def || !e || a.stato === 'vuota') return;
  const es = s.elementi[e.id];
  const da = es?.variante ?? 'Scritta';
  if (es && da !== 'Carta') {
    es.variante = 'Carta';
    es.rimastaSegnalata = false;
    eventi.push(eventoVariante(e, da, 'Carta', 'notte', ora));
  }
  // GDD §3.3: colore → matita quando il G3 ha cancellato una scrittura
  const perse: number[] = [];
  for (const c of e.particelle) {
    const p = particellaDaModificare(s, c);
    if (p.stato !== 'colore') continue;
    p.rilievi = [];
    p.stato = 'matita';
    scriviParticella(s, c, p);
    perse.push(c);
  }
  s.ancore[ancora] = { stato: 'vuota', giorno: null, variantePrima: null };
  const motivo = riempi(regole.testi.scritturaCancellata, { nome: e.nome });
  n.cambiamenti.push({ ora, regola, tipo: 'scrittura_cancellata', elemento: e.id, particelle: [...e.particelle], da, a: 'Carta', motivo });
  eventi.push({ tipo: 'scrittura', ancora, stato: 'vuota' });
  if (perse.length) eventi.push({ tipo: 'particelle_perse', celle: perse, motivo });
}

function applicaMosse(s: StatoCatasto, regole: RegoleCatasto, n: NotteInCorso, ora: number, eventi: EventoCatasto[]): void {
  const programmate = s.mosse.programmate.filter((m) => m.notte === n.numero);
  s.mosse.programmate = s.mosse.programmate.filter((m) => m.notte !== n.numero);
  if (!regole.regoleAttive.mosse) return;
  const rnd = generatore(n.seme);
  const tetto = regole.parametri.tettoCapisaldiPerNotte;
  for (const m of programmate) {
    const def = regole.mosse.find((x) => x.id === m.id);
    if (!def) continue;
    if (!s.mosse.usate.includes(def.id)) s.mosse.usate.push(def.id);
    const deviata = m.deviata || (def.deviataDalVelo && !!n.input.veloDellaMadre);
    if (deviata) {
      const motivo = `${def.nome}: le guardie hanno colpito le case degli Smascherati.`;
      n.cambiamenti.push({ ora, regola: 1, tipo: 'evento', mossa: def.id, particelle: [], motivo });
      n.effetti.push(`flag:mossa_deviata:${def.id}`);
      continue;
    }
    for (const eff of def.effetti) {
      switch (eff.tipo) {
        case 'sposta':
          for (const c of eff.capisaldi) {
            const cd = caposaldoDef(regole, s.capisaldiNuovi, c.id);
            if (!cd) {
              n.cronologia.push({ ora: formattaOra(ora), testo: `${def.id}: il caposaldo ${c.id} non è nel Catasto di questa fase; la mossa non sposta niente.` });
              continue;
            }
            if (n.capisaldiSpostati >= tetto || s.capisaldi[c.id]?.spostato || caposaldoIntoccabile(regole, cd.cella)) continue;
            spostaCaposaldo(s, regole, n, c.id, { metri: c.metri, direzione: c.direzione, notte: n.numero, mossa: def.id }, ora, eventi);
          }
          break;
        case 'sposta_scelti': {
          const candidati = Object.entries(s.capisaldi)
            .filter(([id, cs]) => cs.firme.includes(FIRMA_ELVIRA) && !cs.spostato)
            .map(([id]) => caposaldoDef(regole, s.capisaldiNuovi, id))
            .filter((d): d is NonNullable<typeof d> => !!d && d.tipo !== 'pilastro' && d.tipo !== 'zero' && !caposaldoIntoccabile(regole, d.cella))
            .map((d) => d.id)
            .sort();
          const scelti = mescola(candidati, rnd).slice(0, Math.max(0, Math.min(eff.quanti, tetto - n.capisaldiSpostati)));
          for (const id of scelti.sort()) {
            spostaCaposaldo(s, regole, n, id, { metri: eff.metri, direzione: eff.direzione, notte: n.numero, mossa: def.id }, ora, eventi);
          }
          break;
        }
        case 'contatore': {
          const prima = s.contatori[eff.nome] ?? 0;
          const dopo = eff.max !== undefined ? Math.min(eff.max, prima + eff.delta) : prima + eff.delta;
          s.contatori[eff.nome] = dopo;
          if (dopo !== prima) {
            n.cambiamenti.push({ ora, regola: 1, tipo: 'contatore', mossa: def.id, particelle: [], motivo: `${def.nome}: ${def.descrizione}` });
            n.effetti.push(`contatore:${eff.nome}=${dopo}`);
          }
          break;
        }
        case 'cancella_scrittura':
          cancellaScrittura(s, regole, n, eff.ancora, 1, ora, eventi);
          break;
        case 'evento':
          n.cambiamenti.push({ ora, regola: 1, tipo: 'evento', mossa: def.id, particelle: [], motivo: `${def.nome}: ${eff.testo}` });
          n.effetti.push(`evento:${eff.nome}`);
          break;
      }
    }
    n.effetti.push(`flag:mossa_fatta:${def.id}`);
  }
}

// ───────────────────────────── regola 2: il terminale ─────────────────────────────

function applicaTerminale(s: StatoCatasto, regole: RegoleCatasto, n: NotteInCorso, ora: number, eventi: EventoCatasto[]): void {
  if (!regole.regoleAttive.terminale) return;
  for (const [id, a] of Object.entries(s.ancore).sort(([x], [y]) => x.localeCompare(y))) {
    // costruita in una notte passata e non rimisurata all'alba: il G3 la cancella
    if (a.stato === 'costruita' && !n.input.ombraDiMeridiana) {
      cancellaScrittura(s, regole, n, id, 2, ora, eventi);
    }
  }
  for (const [id, a] of Object.entries(s.ancore).sort(([x], [y]) => x.localeCompare(y))) {
    if (a.stato !== 'scritta') continue;
    const def = regole.ancore.get(id);
    const e = def ? regole.elementi.get(def.elemento) : undefined;
    if (!e) continue;
    const es = s.elementi[e.id];
    const da = es?.variante ?? e.varianteIniziale;
    const a2 = e.varianti.some((v) => v.id === 'Scritta') ? 'Scritta' : da;
    if (es && a2 !== da) {
      es.variante = a2;
      eventi.push(eventoVariante(e, da, a2, 'notte', ora));
    }
    a.stato = 'costruita';
    const motivo = riempi(regole.testi.scritturaCostruita, { nome: e.nome });
    n.cambiamenti.push({ ora, regola: 2, tipo: 'scrittura_costruita', elemento: e.id, particelle: [...e.particelle], da, a: a2, motivo });
    eventi.push({ tipo: 'scrittura', ancora: id, stato: 'costruita' });
  }
}

// ───────────────────────────── regole 3 e 4: il giro ─────────────────────────────

function protezione(s: StatoCatasto, regole: RegoleCatasto, n: NotteInCorso, e: DefElemento, t: number): MotivoProtezione | null {
  if (elementoRilevato(s, regole, e.id)) return 'rilevato';
  const protette = n.input.particelleProtette ?? [];
  if (e.particelle.length > 0 && e.particelle.every((c) => cellaAColore(s, c) || protette.includes(c))) return 'protetta';
  if (!regole.regoleAttive.eccezioni) return null;
  const defs = e.particelle.map((c) => defParticella(regole, c));
  if (defs.some((d) => d.hub)) return 'hub';
  if (defs.some((d) => d.viaTrama)) return 'via_trama';
  if (defs.some((d) => d.rifugio)) return 'rifugio';
  const cella = cellaDiElvira(n, t);
  if (cella !== null && e.particelle.includes(cella)) return 'elvira';
  if (e.viaNecessaria && (!e.alternativa || (n.input.alternativeNonDisponibili ?? []).includes(e.alternativa))) return 'via_necessaria';
  return null;
}

function passaggioElemento(s: StatoCatasto, regole: RegoleCatasto, n: NotteInCorso, e: DefElemento, t: number, eventi: EventoCatasto[]): void {
  n.elementiFatti.push(e.id);
  const ora = minuti(formattaOra((t + 720) % 1440));
  const es = s.elementi[e.id];
  if (!es || !regole.regoleAttive.giro) return;
  const da = es.variante;
  const a = varianteBersaglio(e, da, !!n.input.dopoSvolta);
  const prot = protezione(s, regole, n, e, t);
  n.cronologia.push({
    ora: formattaOra(ora),
    testo: prot === 'elvira' ? `Le Fade arrivano, girano attorno a Elvira e se ne vanno (${e.nome}).` : e.cheCosa ?? `Le Fade passano: ${e.nome}.`,
    elemento: e.id,
    ...(e.dove ? { dove: e.dove } : {}),
  });
  if (a === da) return;
  if (prot) {
    for (const c of e.particelle) n.protette[String(c)] = prot;
    n.salvati.push({ elemento: e.id, motivo: prot, ora });
    if (prot === 'elvira') {
      for (const c of e.particelle) if (!n.vegliate.includes(c)) n.vegliate.push(c);
      n.effetti.push(`flag:notte_su_${e.id}`);
    }
    return;
  }
  if (n.particelleCambiateGiro + e.particelle.length > regole.parametri.tettoParticellePerNotte) {
    n.cronologia.push({ ora: formattaOra(ora), testo: `Le Fade rimandano ${e.nome} a un'altra notte (tetto della notte raggiunto).`, elemento: e.id });
    return;
  }
  // l'elemento legato (il muro di Ronco) misurato cambia dove finiscono le pietre della casa
  const legati = [...regole.elementi.values()].filter((x) => x.legatoA === e.id && elementoRilevato(s, regole, x.id));
  const nota = legati.length && e.stadi ? `Le pietre restano in un mucchio al margine: ${legati.map((x) => x.nome.toLowerCase()).join(', ')} è misurato.` : undefined;
  es.variante = a;
  es.rimastaSegnalata = false;
  n.particelleCambiateGiro += e.particelle.length;
  n.cambiamenti.push({
    ora,
    regola: 3,
    tipo: 'variante',
    elemento: e.id,
    particelle: [...e.particelle],
    da,
    a,
    motivo: motivoVariante(regole, e, da, a),
    ...(nota ? { nota } : {}),
  });
  eventi.push(eventoVariante(e, da, a, 'notte', ora, nota ? { nota } : {}));
}

// ───────────────────────────── la notte a passi ─────────────────────────────

interface Voce {
  t: number;
  priorita: number;
  fai: (s: StatoCatasto, n: NotteInCorso, eventi: EventoCatasto[]) => void;
}

function scaletta(regole: RegoleCatasto, numero: number): Voce[] {
  const voci: Voce[] = [];
  voci.push({
    t: INIZIO_GIRO,
    priorita: 0,
    fai: (s, n, ev) => {
      applicaMosse(s, regole, n, ORARI.inizioGiro, ev);
      applicaTerminale(s, regole, n, ORARI.inizioGiro, ev);
      n.regoleIniziali = true;
    },
  });
  const elementi = [...regole.elementi.values()].filter((e) => e.oraFade !== null).sort((a, b) => a.id.localeCompare(b.id));
  for (const e of elementi) {
    voci.push({ t: minutiNotte(formattaOra(e.oraFade!)), priorita: 2, fai: (s, n, ev) => passaggioElemento(s, regole, n, e, minutiNotte(formattaOra(e.oraFade!)), ev) });
  }
  const dn = regole.notti.get(numero) ?? (regole.notteModello !== null ? regole.notti.get(regole.notteModello) : undefined);
  const oreNotte = new Set((dn?.eventi ?? []).map((x) => x.ora));
  const eventiGiro = [
    ...(dn?.eventi ?? []).map((x) => ({ ora: x.ora, testo: x.testo, dove: undefined as string | undefined })),
    ...regole.giroEventi.filter((x) => !oreNotte.has(x.ora)).map((x) => ({ ora: x.ora, testo: x.testo, dove: x.dove })),
  ];
  for (const x of eventiGiro) {
    voci.push({ t: minutiNotte(formattaOra(x.ora)), priorita: 1, fai: (_s, n) => void n.cronologia.push({ ora: formattaOra(x.ora), testo: x.testo, ...(x.dove ? { dove: x.dove } : {}) }) });
  }
  const pes = regole.notti.get(numero) ?? (regole.notteModello !== null ? regole.notti.get(regole.notteModello) : undefined);
  if (pes?.pesarinaOra !== null && pes?.pesarinaOra !== undefined) {
    voci.push({ t: minutiNotte(formattaOra(pes.pesarinaOra)), priorita: 3, fai: (_s, n) => void n.cronologia.push({ ora: formattaOra(pes.pesarinaOra!), testo: 'La Pesarina passa dove dorme Elvira.' }) });
  }
  return voci.sort((a, b) => a.t - b.t || a.priorita - b.priorita);
}

/** Comincia la notte del giorno corrente (alle 21:00, o quando il giocatore va a dormire). */
export function iniziaNotte(stato: StatoCatasto, _regole: RegoleCatasto, input: InputNotte = {}): StatoCatasto {
  if (stato.notteInCorso) throw new Error(`La notte ${stato.notteInCorso.numero} è già in corso: chiudila prima con chiudiNotte().`);
  const s = clonaStato(stato);
  const numero = s.giorno;
  s.notteInCorso = {
    numero,
    giorno: s.giorno,
    seme: semeNotte(input.seme ?? 0, numero),
    fatto: INIZIO_NOTTE,
    regoleIniziali: false,
    input: structuredClone(input),
    cambiamenti: [],
    protette: {},
    salvati: [],
    vegliate: [],
    effetti: [],
    cronologia: [],
    elementiFatti: [],
    particelleCambiateGiro: 0,
    capisaldiSpostati: 0,
  };
  return s;
}

/**
 * Fa avanzare la notte fino all'ora data (compresa). Se il gioco passa la particella dove sta
 * Elvira adesso, vale per tutti i passaggi elaborati in questa chiamata: chiamata ogni minuto
 * di gioco durante la veglia, le Fade trovano Elvira dov'è davvero.
 */
export function avanzaNotte(
  stato: StatoCatasto,
  regole: RegoleCatasto,
  finoA: Ora,
  elvira?: { cella: number | null },
): { stato: StatoCatasto; eventi: EventoCatasto[] } {
  if (!stato.notteInCorso) throw new Error('Nessuna notte in corso: chiama prima iniziaNotte().');
  const fino = Math.min(minutiNotte(finoA), FINE_NOTTE);
  if (fino < stato.notteInCorso.fatto) return { stato, eventi: [] };
  const s = clonaStato(stato);
  const n = s.notteInCorso!;
  if (elvira) {
    n.input.elvira = { ...(n.input.elvira ?? {}), percorso: [...(n.input.elvira?.percorso ?? []), { ora: formattaOra((n.fatto + 720) % 1440), cella: elvira.cella }] };
    delete n.input.elvira.cella;
  }
  const eventi: EventoCatasto[] = [];
  for (const v of scaletta(regole, n.numero)) {
    if (v.t < n.fatto || v.t > fino) continue;
    v.fai(s, n, eventi);
  }
  n.fatto = fino + 1;
  return { stato: s, eventi };
}

/** Chiude la notte all'alba: elabora ciò che manca, scrive il resoconto, passa al giorno dopo. */
export function chiudiNotte(stato: StatoCatasto, regole: RegoleCatasto): { stato: StatoCatasto; resoconto: Resoconto; eventi: EventoCatasto[] } {
  const a = avanzaNotte(stato, regole, '05:30');
  const s = clonaStato(a.stato);
  const n = s.notteInCorso!;
  const def = regole.notti.get(n.numero);
  const sveglia = !!n.input.elvira?.sveglia;
  const effetti = [...new Set(n.effetti)];
  if (sveglia) effetti.push(`flag:notte_vegliata:${n.numero}`);
  else if (def?.pesarinaFlag) effetti.push(`flag:${def.pesarinaFlag}`);
  const resoconto = costruisciResoconto(s, regole, n, effetti);
  s.ultimaNotte = {
    numero: n.numero,
    giorno: n.giorno,
    cambiate: resoconto.particelleCambiate,
    protette: { ...n.protette },
    vegliate: [...n.vegliate].sort((x, y) => x - y),
    resoconto,
  };
  s.notteInCorso = null;
  s.nottiPassate += 1;
  s.giorno = n.giorno + 1;
  return { stato: s, resoconto, eventi: [...a.eventi, { tipo: 'resoconto', resoconto }] };
}

/**
 * La notte intera, in un colpo solo: quando Elvira dorme (o quando l'orologio passa le 05:30
 * senza che il gioco abbia seguito la notte minuto per minuto).
 */
export function notte(stato: StatoCatasto, regole: RegoleCatasto, input: InputNotte = {}): RisultatoNotte {
  const iniziata = stato.notteInCorso ? stato : iniziaNotte(stato, regole, input);
  const c = chiudiNotte(iniziata, regole);
  return { nuovoStato: c.stato, resoconto: c.resoconto, eventi: c.eventi, effetti: c.resoconto.effetti };
}

/** Che cosa farebbe la notte senza farlo (l'«avviso della sera», GDD §10). */
export function previsioneNotte(stato: StatoCatasto, regole: RegoleCatasto, input: InputNotte = {}): Resoconto {
  return notte(stato.notteInCorso ? { ...stato } : stato, regole, input).resoconto;
}

// ───────────────────────────── di giorno ─────────────────────────────

/** Cambia la variante di un elemento (un effetto `variante:E1=Abitata` dei contenuti, uno script). */
export function impostaVariante(stato: StatoCatasto, regole: RegoleCatasto, elemento: string, variante: string): RisultatoCatasto {
  const e = regole.elementi.get(elemento);
  const fail = (msg: string): RisultatoCatasto => ({ stato, ok: false, eventi: [], effetti: [], messaggio: msg });
  if (!e) return fail(`Elemento sconosciuto: ${elemento}`);
  const v = e.varianti.find((x) => x.id.toLowerCase() === variante.toLowerCase());
  if (!v) return fail(`${e.nome} non ha la variante «${variante}»`);
  const da = stato.elementi[elemento]?.variante ?? e.varianteIniziale;
  if (da === v.id) return { stato, ok: true, eventi: [], effetti: [] };
  const s = clonaStato(stato);
  s.elementi[elemento] = { variante: v.id, rimastaSegnalata: s.elementi[elemento]?.rimastaSegnalata ?? false };
  return { stato: s, ok: true, eventi: [eventoVariante(e, da, v.id, 'gioco', null)], effetti: [] };
}

export interface InputCicli {
  /** Ora da cui si riparte (esclusa). */
  da: Ora;
  /** Ora a cui si arriva (compresa). */
  a: Ora;
  /** Il personaggio è al suo posto? (Bortolo, Nando, Ottavio). Predefinito: sì. */
  chiPresente?: (chi: string) => boolean;
}

/**
 * I cambiamenti di giorno degli abitanti (fade_fase1.json → cicli_del_giorno): Bortolo rimette
 * i gradini alle 07:00, Nando rifà la casa alle 08:30, Ottavio rimette le assi alla brace.
 * Valgono anche sugli elementi rilevati: «il rilievo non fotografa, protegge».
 */
export function applicaCicliDelGiorno(stato: StatoCatasto, regole: RegoleCatasto, input: InputCicli): RisultatoCatasto {
  const da = minuti(input.da);
  const a = minuti(input.a);
  if (da === a) return { stato, ok: true, eventi: [], effetti: [] };
  const dentro = (m: number) => m !== da && dentroIntervallo(m, [da, (a + 1) % 1440]);
  const cicli = [...regole.elementi.values()]
    .flatMap((e) => e.cicli.map((c) => ({ e, c })))
    .filter(({ c }) => dentro(c.ora))
    .sort((x, y) => ((x.c.ora - da + 1440) % 1440) - ((y.c.ora - da + 1440) % 1440) || x.e.id.localeCompare(y.e.id));
  let s: StatoCatasto | null = null;
  const eventi: EventoCatasto[] = [];
  for (const { e, c } of cicli) {
    const cur = (s ?? stato).elementi[e.id]?.variante;
    if (cur !== c.da) continue;
    if (input.chiPresente && !input.chiPresente(c.chi)) continue;
    s ??= clonaStato(stato);
    s.elementi[e.id] = { variante: c.a, rimastaSegnalata: s.elementi[e.id]?.rimastaSegnalata ?? false };
    eventi.push(eventoVariante(e, c.da, c.a, 'giorno', c.ora, { chi: c.chi }));
  }
  return { stato: s ?? stato, ok: true, eventi, effetti: [] };
}

// ───────────────────────────── le mosse annunciate la sera ─────────────────────────────

export interface ContestoMosse {
  /** Atto corrente. */
  atto: Atto;
  /** Notte in cui la mossa si applica (predefinita: stato.giorno, la notte di stasera). */
  notte?: number;
  /** Flag della narrativa che le condizioni possono leggere. */
  flag?: readonly string[];
  contatori?: Readonly<Record<string, number>>;
  /** Elvira porta il velo della Madre stasera. */
  veloDellaMadre?: boolean;
  /** Mosse di trama da annunciare comunque (B1 la sera della svolta, B2 la notte dopo). */
  forza?: readonly string[];
}

/** Valuta la condizione di una mossa: atomi uniti da « e » (più forte) e « o », «!» per negare. */
export function condizioneMossa(stato: StatoCatasto, condizione: string, ctx: Pick<ContestoMosse, 'flag' | 'contatori'> = {}): boolean {
  const atomo = (a0: string): boolean => {
    let a = a0.trim();
    let neg = false;
    while (a.startsWith('!')) {
      neg = !neg;
      a = a.slice(1).trim();
    }
    const v = (() => {
      if (a === 'sempre' || a === 'vero') return true;
      if (a === 'mai' || a === 'falso' || a === '') return false;
      const [pref, ...resto] = a.split(':');
      const arg = resto.join(':');
      switch (pref) {
        case 'flag':
          return (ctx.flag ?? []).includes(arg);
        case 'contatore': {
          const m = /^([\w:]+)\s*(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/.exec(arg);
          if (!m) return (ctx.contatori?.[arg] ?? stato.contatori[arg] ?? 0) > 0;
          const x = ctx.contatori?.[m[1]!] ?? stato.contatori[m[1]!] ?? 0;
          const y = Number(m[3]);
          return m[2] === '>=' ? x >= y : m[2] === '<=' ? x <= y : m[2] === '>' ? x > y : m[2] === '<' ? x < y : x === y;
        }
        case 'lato_con':
          return Object.values(stato.lati).some((l) => l.firma === FIRMA_ELVIRA && (l.stazione === arg || l.mira === arg));
        case 'lato':
          return stato.lati[arg]?.firma === FIRMA_ELVIRA;
        case 'cella':
          return cellaRilevataDaElvira(stato, Number(arg));
        case 'mossa':
          return stato.mosse.usate.includes(arg);
        case 'ancora':
          return ['costruita', 'rimisurata'].includes(stato.ancore[arg]?.stato ?? 'vuota');
        default:
          return false;
      }
    })();
    return neg ? !v : v;
  };
  return condizione.split(/\s+o\s+/).some((alt) => alt.split(/\s+e\s+/).every(atomo));
}

/**
 * La sera (alla brace) la Madre sceglie dalla tabella le mosse della notte e le annuncia con
 * una lettera alla Bacheca e con l'Ombrista. Rispetta il tetto per atto (2, 3, 2) e una mossa
 * per sera. Nella Fase 1 le mosse sono spente: la funzione non annuncia niente.
 */
export function annunciaMosse(stato: StatoCatasto, regole: RegoleCatasto, ctx: ContestoMosse): RisultatoCatasto {
  if (!regole.regoleAttive.mosse) return { stato, ok: true, eventi: [], effetti: [] };
  const notteN = ctx.notte ?? stato.giorno;
  const giaFatte = (m: DefMossa) => stato.mosse.usate.includes(m.id) || stato.mosse.programmate.some((p) => p.id === m.id);
  const usateAtto = regole.mosse.filter((m) => m.atto === ctx.atto && giaFatte(m)).length;
  let posti = Math.min(regole.parametri.mossePerNotte - stato.mosse.programmate.filter((p) => p.notte === notteN).length, regole.tettoMossePerAtto[ctx.atto] - usateAtto);
  if (posti <= 0) return { stato, ok: true, eventi: [], effetti: [] };
  const forzate = new Set(ctx.forza ?? []);
  const candidate = regole.mosse.filter((m) => m.atto === ctx.atto && !giaFatte(m) && (forzate.has(m.id) || condizioneMossa(stato, m.condizione, ctx)));
  candidate.sort((a, b) => Number(forzate.has(b.id)) - Number(forzate.has(a.id)));
  if (candidate.length === 0) return { stato, ok: true, eventi: [], effetti: [] };
  const s = clonaStato(stato);
  const eventi: EventoCatasto[] = [];
  const effetti: string[] = [];
  for (const m of candidate) {
    if (posti <= 0) break;
    posti--;
    const deviata = m.deviataDalVelo && !!ctx.veloDellaMadre;
    s.mosse.programmate.push({ id: m.id, notte: notteN, annuncio: m.annuncio, deviata });
    eventi.push({ tipo: 'mossa_annunciata', mossa: m.id, notte: notteN, annuncio: m.annuncio });
    effetti.push(`flag:mossa_annunciata:${m.id}`);
  }
  return { stato: s, ok: true, eventi, effetti };
}

// ───────────────────────────── la Penna di catasto ─────────────────────────────

/**
 * Scrivere con la Penna (GDD §3.4.7): un elemento di servizio del 2121 su un'ancora, al massimo
 * una scrittura per notte e solo in una particella rilevata. Le Fade lo costruiscono la notte;
 * all'alba va rimisurato (rilevando di nuovo le sue particelle), se no la notte dopo il G3 lo cancella.
 */
export function scriviConPenna(stato: StatoCatasto, regole: RegoleCatasto, input: { ancora: string; giorno?: number }): RisultatoCatasto {
  const def = regole.ancore.get(input.ancora);
  const fail = (motivo: 'ancora_sconosciuta' | 'ancora_occupata' | 'una_per_notte' | 'particella_non_rilevata', messaggio: string): RisultatoCatasto => ({
    stato,
    ok: false,
    eventi: [{ tipo: 'rilievo_fallito', operazione: 'penna', motivo, messaggio }],
    effetti: [],
    motivo,
    messaggio,
  });
  if (!def) return fail('ancora_sconosciuta', 'Qui la Carta non prevede niente da scrivere.');
  const a = stato.ancore[input.ancora] ?? { stato: 'vuota', giorno: null, variantePrima: null };
  if (a.stato !== 'vuota') return fail('ancora_occupata', 'Su questa ancora la Penna ha già scritto.');
  if (Object.values(stato.ancore).some((x) => x.stato === 'scritta')) return fail('una_per_notte', 'Una scrittura per notte: la Penna aspetta domani.');
  const e = regole.elementi.get(def.elemento);
  if (!e || !e.particelle.every((c) => cellaAColore(stato, c))) return fail('particella_non_rilevata', 'Si scrive solo dove il terreno è misurato.');
  const s = clonaStato(stato);
  s.ancore[input.ancora] = { stato: 'scritta', giorno: input.giorno ?? s.giorno, variantePrima: s.elementi[e.id]?.variante ?? null };
  return { stato: s, ok: true, eventi: [{ tipo: 'scrittura', ancora: input.ancora, stato: 'scritta' }], effetti: [`flag:scrittura:${input.ancora}`] };
}

/** Rimisura esplicita di una scrittura costruita (5 s dal caposaldo, all'alba). */
export function rimisuraScrittura(stato: StatoCatasto, regole: RegoleCatasto, ancora: string): RisultatoCatasto {
  const a = stato.ancore[ancora];
  const def = regole.ancore.get(ancora);
  const e = def ? regole.elementi.get(def.elemento) : undefined;
  if (!a || !e || a.stato !== 'costruita') return { stato, ok: false, eventi: [], effetti: [], messaggio: 'Niente da rimisurare.' };
  if (!e.particelle.every((c) => cellaAColore(stato, c))) return { stato, ok: false, eventi: [], effetti: [], messaggio: 'La particella non è misurata.' };
  const s = clonaStato(stato);
  s.ancore[ancora] = { ...a, stato: 'rimisurata' };
  return { stato: s, ok: true, eventi: [{ tipo: 'scrittura', ancora, stato: 'rimisurata' }], effetti: [`flag:scrittura_rimisurata:${ancora}`] };
}
