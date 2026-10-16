/**
 * Il percorso facile: le reti di sicurezza della storia per chi gioca davvero (cammina, mira a
 * occhio, non ha letto il design). La partita automatica si teletrasporta e mira esatto, e non
 * vedeva i punti dove un giocatore vero restava fermo; qui la regia li tiene d'occhio.
 *
 * - **Dialoghi di riserva** (la vecchia `campaneDiRiserva`, generalizzata): per ogni passo attivo
 *   del prologo e della missione principale, i dialoghi automatici che lo fanno avanzare (quelli
 *   nominati da `completa_quando`, quelli il cui `alla_fine` accende un flag che `completa_quando`
 *   legge, e la scelta della notte nel fienile) si richiedono di nuovo se non sono aperti, in
 *   coda o finiti e la loro condizione vale: un dialogo interrotto, perso in un caricamento o
 *   annunciato quando la persona non c'era non ferma più la storia. La condizione si legge
 *   nell'ambito del passo, come la legge il segnalino (la passerella della prova, raggiunta e poi
 *   lasciata per andare incontro a Ottavio, resta raggiunta). Il Messo, atterrato (7 s), va incontro
 *   a Elvira anche fuori dalla piazza (il terzo velato può essere Nando, ai Ronchi).
 * - **Indicazioni dei gesti**, nel posto del tasto E quando non c'è un bersaglio: la scala della
 *   Cripta (W), il Velo in aria (Spazio), lo squadro piantato (A/D per la bolla, il tasto destro
 *   per il cannocchiale, con la barra della collimazione), il fischio per Ottavio in volo (G),
 *   l'attesa (X: da seduti, e in piedi, ferma, quando il passo chiede di aspettare; durante
 *   l'attesa X salta alla fine), e contro un muretto basso che ferma il passo «Spazio — scavalca»
 *   (fuori dalla botola, verso il belvedere, c'è un parapetto di novanta centimetri).
 * - **Promemoria**: se un passo resta fermo a lungo, il suo suggerimento dei comandi torna una
 *   volta (sedersi nel prologo, aspettare la brace…).
 * - **Lo sguardo nella capsula**: se dopo 12 s la scritta del vetro non è stata trovata, lo
 *   sguardo ci scivola sopra da solo (e ancora ogni 20 s); fuori dalla botola, se dopo 50 s Elvira
 *   non ha ancora guardato in su (il passero a 20 s, il suggerimento a 35 s), lo sguardo sale da
 *   solo verso il lago appeso (e ancora ogni 30 s). Dal secondo aiuto, finita la planata dello
 *   sguardo, il passo si chiude da sé: chi tirava giù il mouse consumava gli aiuti.
 * - **Muri troppo alti**: chi spinge contro un muro che non si scavalca (le terrazze, il muro di
 *   Ronco) legge «P — troppo alto…» e la strada del passo: verso la Terrazza Pedrazzini la
 *   mulattiera, che parte dalla piazza, e la scorciatoia (solo quando ha i gradini); fra il riale
 *   e la piazza la strada dei Ronchi.
 * - **Il fermo della prima notte**: finché Elvira non arriva al fienile l'orologio non passa le
 *   05:00 del giorno 2. Senza, chi girava tutta la notte arrivava al fienile di giorno e la notte
 *   (la scelta di Ottavio, il resoconto, il mattino del giorno 2) non tornava più.
 *
 * Chi arriva e quando (la novizia alle 07:00, il campanaro alle 08:00, i velati all'alba) lo
 * dicono le indicazioni delle missioni (`obiettivi.ts`, la riga dell'attesa e il menu «Aspetta
 * fino a»): qui non si ripete.
 */
import { Vector3 } from 'three';
import type { CondizioneGrezza, DialogoDef, PassoDef } from '../narrativa';
import type { AzioneContestuale } from '../ui';
import type { Collider } from '../world/colliders';
import { localFrameAt, worldToCyl } from '../world/cylinder';
import { assolutoDi } from './orologio';
import type { Regia } from './regia';

/** Le missioni della storia (il percorso da non perdere). */
const TIPI_STORIA = new Set(['prologo', 'principale']);

/** Dialoghi che fanno avanzare un passo senza essere nominati dalla sua condizione. */
const DIALOGHI_IN_PIU: Readonly<Record<string, readonly string[]>> = {
  // «Dormi o guardi?»: la scelta del sonno (dormi:fino 05:30) è un evento del passo
  m1_notte: ['d_ottavio_fienile'],
};

/**
 * Dialoghi che, dopo `dopo` s di passo, si aprono anche lontano dal loro luogo (chi parla viene da
 * Elvira). Il Messo atterra comunque accanto a lei (a 9 m, fuori dalla piazza): finita la discesa
 * (4,5 s) le va incontro; prima restava lì fermo fino a 25 s.
 */
const RISERVA_OVUNQUE: Readonly<Record<string, { dialogo: string; dopo: number }>> = {
  m1_ottavio: { dialogo: 'd_ottavio_incontro', dopo: 7 },
};

/** Ogni quanto (s) si controllano i dialoghi di riserva. */
const PASSO_RISERVA = 1.5;

/**
 * Il suggerimento da ripetere se un passo resta fermo (se manca: quello dell'attivazione) e dopo
 * quanti secondi; `null` = nessun promemoria («Alzati» nella Cripta, a Elvira già in piedi).
 */
const PROMEMORIA: Readonly<Record<string, { id: string; dopo?: number } | null>> = {
  pr_cripta: null,
  pr_campane: null,
  pr_camminare: { id: 'siediti', dopo: 40 },
  pr_lettera: { id: 'leggi_lettera', dopo: 45 },
  m1_brace: { id: 'aspetta' },
  m1_seconda_notte: { id: 'aspetta' },
};
const PROMEMORIA_DOPO = 90;

/**
 * Quando lo sguardo scivola da solo sulla scritta del vetro (s di passo): ancora ogni 20 s finché
 * il passo resta da fare; dal secondo aiuto in poi, finita la planata dello sguardo, il passo si
 * chiude da sé (chi tira giù il mouse mentre lo sguardo sale consumava gli aiuti e restava lì).
 */
export const AIUTI_VETRO = [12, 30, 50, 70, 90];
/** Quando lo sguardo sale da solo verso il lago appeso, fuori dalla botola (s di passo): come sopra, ogni 30 s. */
export const AIUTI_IN_SU = [50, 80, 110, 140, 170, 200];

/**
 * La strada da dire a chi spinge contro un muro troppo alto o un pendio troppo ripido, per i
 * passi che portano dove in linea retta non si arriva: la Terrazza Pedrazzini sta sopra muri e
 * scarpate di terrazza di tre metri e più (la mulattiera parte dalla piazza; la scorciatoia, 75 m
 * a Mont del castagno morto, solo quando ha i gradini: il campanaro li rimette alle 07:00); fra il
 * riale e la piazza ci sono i muri alti dei Ronchi (la strada battuta dei Ronchi parte dal guado).
 */
export function stradaTerrazza(scorciatoia: boolean): string {
  return scorciatoia
    ? 'alla Terrazza Pedrazzini si sale dalla mulattiera, che parte dalla Piazza delle Ore, o dalla scorciatoia con i gradini di assi, 75 m a Mont del castagno morto (la Pianta)'
    : 'alla Terrazza Pedrazzini si sale dalla mulattiera delle Terrazze, che parte dalla Piazza delle Ore (la scorciatoia non ha ancora i gradini: il campanaro li rimette alle 07:00)';
}
const RONCHI_SU = 'in piazza si torna dalla strada dei Ronchi: dal guado sali fra le case dei Ronchi e seguila verso il paese (la Pianta)';
const RONCHI_GIU = 'alla passerella del Messo si scende dalla strada dei Ronchi, che parte dalla piazza verso il riale (la Pianta)';
const STRADE: Readonly<Record<string, string | ((scorciatoia: boolean) => string)>> = {
  m1_cartellino: stradaTerrazza,
  m1_innesto: stradaTerrazza,
  m1_primo_rilievo: stradaTerrazza,
  m1_ritorno: RONCHI_SU,
  m1_fienile: RONCHI_GIU,
  m1_prova: RONCHI_GIU,
};
const STRADA_DI_SERIE = 'cerca un sentiero o dei gradini (la Pianta)';

/** La strada da dire per i passi attivi (la prima che c'è), o quella di serie. */
export function stradaDeiPassi(attivi: Iterable<string>, scorciatoia: boolean): string {
  for (const id of attivi) {
    const s = STRADE[id];
    if (s) return typeof s === 'function' ? s(scorciatoia) : s;
  }
  return STRADA_DI_SERIE;
}

/** Il pendio più ripido che si cammina (`slopeLimitDeg` del controller). */
const PENDENZA_MAX_GRADI = 47;

/** Il terreno sale di `salita` m in `distanza` m: più ripido di quanto si cammini (con un margine)? */
export function troppoRipido(salita: number, distanza: number, limiteGradi = PENDENZA_MAX_GRADI): boolean {
  return distanza > 0 && salita > MURETTO_MAX && salita > distanza * Math.tan((limiteGradi * Math.PI) / 180) + 0.1;
}

/** Il fermo della prima notte: le 05:00 del giorno 2 (tempo assoluto). */
export const FERMO_PRIMA_NOTTE = assolutoDi(2, 5);

function testoCondizione(c: CondizioneGrezza): string {
  return typeof c === 'string' ? c : c === undefined || c === null ? '' : JSON.stringify(c);
}

/** I dialoghi nominati da una condizione con «dialogo:id finito». */
export function dialoghiNominati(c: CondizioneGrezza): string[] {
  return [...testoCondizione(c).matchAll(/dialogo:([A-Za-z0-9_]+)\s+finit[oa]/g)].map((m) => m[1]!);
}

/** I flag letti da una condizione («flag:nome»). */
export function flagNominati(c: CondizioneGrezza): string[] {
  return [...testoCondizione(c).matchAll(/flag:([A-Za-z0-9_:]+)/g)].map((m) => m[1]!);
}

/**
 * I dialoghi automatici che fanno avanzare un passo: nominati dalla sua condizione di
 * completamento, oppure che accendono alla fine un flag che la condizione legge (la lettera di
 * Rosa), oppure elencati in `DIALOGHI_IN_PIU` (la scelta della notte).
 */
export function dialoghiCheFannoAvanzare(passo: Pick<PassoDef, 'id' | 'completaQuando'>, dialoghi: Readonly<Record<string, DialogoDef>>): string[] {
  const nominati = new Set(dialoghiNominati(passo.completaQuando));
  const flag = new Set(flagNominati(passo.completaQuando));
  for (const id of DIALOGHI_IN_PIU[passo.id] ?? []) nominati.add(id);
  for (const d of Object.values(dialoghi)) {
    if (d.effettiFine.some((e) => e.startsWith('flag:') && flag.has(e.slice(5)))) nominati.add(d.id);
  }
  return [...nominati].filter((id) => dialoghi[id]?.apertura.come === 'automatico');
}

/** Lo stato che serve per scegliere l'indicazione di un gesto (logica pura). */
export interface StatoGesto {
  controllo: 'libero' | 'sdraiata' | 'alzandosi' | 'scala' | 'seduta' | 'piantato' | 'dorme';
  /** Altezza sulla scala della Cripta (m) e altezza della botola. */
  scala?: { y: number; cima: number };
  /** In aria: Velo aperto, altezza dal suolo (m), e se il passo chiede ancora la prima planata. */
  aria?: { velo: boolean; altezza: number; insegna: boolean };
  squadro?: { livellato: boolean; telescopio: boolean; caposaldo: string | null; coperto: boolean; tenuta: number; serve: number; meta?: string };
  /** Ottavio da chiamare con il fischio (la strada del Messo, lui in volo). */
  fischio?: boolean;
  /** Ferma contro un muretto che si scavalca con un salto. */
  muretto?: boolean;
  /** Ferma contro un muro troppo alto: la strada da prendere (o quella di serie). */
  muroAlto?: string;
  /** Da seduta: si può aspettare (e la lettera di Marta, già letta, si può rileggere con E). */
  attesa?: boolean;
  rilettura?: boolean;
  /** L'attesa corre adesso (X salta alla fine); `salto`: sta già saltando (sotto il nero, niente da dire). */
  inAttesa?: boolean;
  salto?: boolean;
  /** In piedi e ferma, in un passo che chiede di aspettare (chi arriva, la brace, la notte). */
  aspettare?: boolean;
}

/** I passi della storia in cui si aspetta un'ora (oltre a chi deve arrivare, che lo dicono le indicazioni). */
export const PASSI_DI_ATTESA: ReadonlySet<string> = new Set(['m1_brace', 'm1_seconda_notte']);
/** Ferma da tanti secondi, in un passo d'attesa, compare «X — Aspetta fino a…». */
const FERMA_PER_ASPETTARE = 1.5;

/** Altezza dal suolo (m) sopra la quale il Velo si apre (VELO_TUNABLES.minOpenHeight) con un margine. */
const ALTEZZA_VELO = 1.2;

/** Un muretto «da scavalcare»: più alto di un gradino (0,5 m), non più di quanto porta un salto. */
export const MURETTO_MIN = 0.5;
export const MURETTO_MAX = 1.2;

const _avanti = new Vector3();
const _sguardo = new Vector3();
const _occhi = new Vector3();
const _punto = new Vector3();
const _rel = new Vector3();
const _cornice = { up: new Vector3(), east: new Vector3(), north: new Vector3() };
const _cil = { z: 0, theta: 0, r: 0, h: 0 };

/** Oltre questa altezza (m) non è più un muro da girare ma una parete, una casa, il campanile. */
export const MURO_ALTO_MAX = 15;

/**
 * Le altezze (m sopra i piedi) dei tetti delle scatole subito davanti: si guarda un punto
 * `davanti` m avanti, lungo lo sguardo sul piano, a 30 cm da terra.
 */
export function altezzeDavanti(piedi: Vector3, theta: number, sguardo: Vector3, collisori: readonly Collider[], davanti = 0.6): number[] {
  localFrameAt(piedi, _cornice, theta);
  const su = _cornice.up;
  _avanti.copy(sguardo).addScaledVector(su, -sguardo.dot(su));
  if (_avanti.lengthSq() < 1e-6) return [];
  _avanti.normalize();
  _punto.copy(piedi).addScaledVector(_avanti, davanti).addScaledVector(su, 0.3);
  const out: number[] = [];
  for (const c of collisori) {
    if (c.kind !== 'box') continue;
    _rel.subVectors(_punto, c.center);
    if (Math.abs(_rel.dot(c.right)) > c.half.x + 0.05 || Math.abs(_rel.dot(c.forward)) > c.half.z + 0.05) continue;
    if (Math.abs(_rel.dot(c.up)) > c.half.y + 0.05) continue;
    // il tetto della scatola sopra i piedi
    out.push(c.half.y - _rel.dot(c.up) + 0.3);
  }
  return out;
}

/** C'è un muretto basso subito davanti ai piedi (il tetto fra `MURETTO_MIN` e `MURETTO_MAX`)? */
export function murettoDavanti(piedi: Vector3, theta: number, sguardo: Vector3, collisori: readonly Collider[], davanti = 0.6): boolean {
  return altezzeDavanti(piedi, theta, sguardo, collisori, davanti).some((h) => h >= MURETTO_MIN && h <= MURETTO_MAX);
}

/** Davanti c'è solo un muro troppo alto per un salto (un muro di terrazza, non una casa)? */
export function muroAltoDavanti(altezze: readonly number[]): boolean {
  return altezze.length > 0 && altezze.every((h) => h > MURETTO_MAX) && altezze.some((h) => h <= MURO_ALTO_MAX);
}

/** Che cosa premere adesso, quando nessun bersaglio lo dice (o null). */
export function indicazioneGesto(s: StatoGesto): AzioneContestuale | null {
  if (s.controllo === 'scala' && s.scala && s.scala.y < s.scala.cima - 0.1) return { tasto: 'W', testo: 'Sali la scala (S per scendere)' };
  if (s.controllo === 'piantato' && s.squadro) {
    const q = s.squadro;
    if (!q.livellato) return { tasto: 'A / D', testo: 'Centra la bolla della livella (W o S: stacca lo squadro)' };
    const meta = q.meta ?? 'la palina di un altro caposaldo';
    if (!q.telescopio) return { tasto: 'Tasto destro', testo: `Tienilo premuto: guarda nel cannocchiale e cerca ${meta}` };
    if (q.caposaldo) {
      const progresso = Math.max(0, Math.min(1, q.tenuta / Math.max(0.1, q.serve)));
      return { tasto: 'Tasto destro', testo: q.coperto ? 'Qualcosa copre la palina: tieni la croce lo stesso' : 'Tieni la croce sulla palina', progresso };
    }
    return { tasto: 'Tasto destro', testo: `Porta la croce su ${meta}` };
  }
  if (s.aria && s.aria.insegna) {
    if (!s.aria.velo && s.aria.altezza > ALTEZZA_VELO) return { tasto: 'Spazio', testo: 'Tienilo premuto in aria: apri il Velo' };
    if (s.aria.velo) return { tasto: 'Spazio', testo: 'Tienilo premuto: il Velo plana (lo sguardo in giù per scendere)' };
  }
  if (s.controllo === 'libero' && s.muretto) return { tasto: 'Spazio', testo: 'Salta: scavalca il muretto' };
  if (s.controllo === 'libero' && s.muroAlto) return { tasto: 'P', testo: s.muroAlto };
  if (s.controllo === 'libero' && s.fischio) return { tasto: 'G', testo: 'Chiama Ottavio con un fischio: è in volo con le lettere' };
  if (s.controllo === 'seduta' && s.inAttesa) return s.salto ? null : { tasto: 'X', testo: 'Salta alla fine (C: alzati)' };
  if (s.controllo === 'seduta' && s.attesa) return { tasto: 'X', testo: s.rilettura ? 'Aspetta fino a… (E: rileggi la lettera; C: alzati)' : 'Aspetta fino a… (C per alzarti)' };
  if (s.controllo === 'libero' && s.aspettare) return { tasto: 'X', testo: 'Aspetta fino a… (ti siedi)' };
  return null;
}

export class Percorso {
  /** L'indicazione del gesto da mostrare se non c'è un bersaglio (la legge il disegno). */
  indicazione: AzioneContestuale | null = null;
  /** Secondi di attività dei passi della storia attivi. */
  private readonly tempi = new Map<string, number>();
  private readonly promemoriaDati = new Set<string>();
  /** Gli aiuti dello sguardo già dati («passo@secondi»). */
  private readonly aiutiDati = new Set<string>();
  private attesaRiserva = 0;
  private ultimaNotaPlanata = -Infinity;
  private tempo = 0;
  /** Secondi passati spingendo (un tasto di movimento) senza muoversi. */
  private spinta = 0;
  /** Secondi passati ferma in piedi, senza spingere (per «X — Aspetta fino a…»). */
  private fermaDa = 0;
  /** Le altezze delle scatole davanti all'ultima spinta (per il debug e le prove). */
  altezzeDavanti: readonly number[] = [];

  constructor(private readonly r: Regia) {}

  /** Partita nuova o caricata: si riparte da capo con i tempi dei passi. */
  azzera(): void {
    this.tempi.clear();
    this.promemoriaDati.clear();
    this.aiutiDati.clear();
    this.attesaRiserva = 0;
    this.indicazione = null;
  }

  /** Secondi da cui il passo della storia è attivo (0 se non lo è). */
  tempoDelPasso(passo: string): number {
    return this.tempi.get(passo) ?? 0;
  }

  update(dt: number): void {
    const r = this.r;
    this.tempo += dt;
    const passi = this.passiDellaStoria();
    const attivi = new Set(passi.map((p) => p.def.id));
    for (const id of [...this.tempi.keys()]) if (!attivi.has(id)) this.tempi.delete(id);
    for (const id of attivi) this.tempi.set(id, (this.tempi.get(id) ?? 0) + dt);

    this.fermoPrimaNotte(attivi);
    const p = r.game.player;
    const inp = r.game.input;
    // (le frecce girano solo lo sguardo: chi guarda in su con ↑ non «spinge» contro il muretto)
    const spinge = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((k) => inp.isDown(k));
    // ferma contro qualcosa: quasi a terra (contro un muro sul pendio il controller salta fra
    // «a terra» e «in aria») e quasi immobile sul piano (strisciando sul muro resta mezzo metro al secondo)
    localFrameAt(p.pos, _cornice, p.cyl.theta);
    const sulPiano = Math.sqrt(Math.max(0, p.vel.lengthSq() - p.vel.dot(_cornice.up) ** 2));
    // (chi cammina piano, senza fiato o nel prologo, non è «ferma»)
    const ferma = r.controllo.tipo === 'libero' && p.heightAboveGround < 0.6 && sulPiano < Math.min(0.8, 0.35 * p.tunables.walkSpeed);
    this.spinta = spinge && ferma && !r.ui.inputCatturato ? this.spinta + dt : 0;
    this.fermaDa = !spinge && ferma && p.grounded && !r.ui.inputCatturato ? this.fermaDa + dt : 0;
    this.attesaRiserva += dt;
    if (this.attesaRiserva >= PASSO_RISERVA) {
      this.attesaRiserva = 0;
      this.dialoghiDiRiserva(passi);
    }
    if (!r.ui.inputCatturato && !r.dialoghi.aperto) {
      this.promemoria(passi);
      this.aiutiSguardo(attivi);
    }
    this.indicazione = this.calcolaIndicazione(attivi);
  }

  /** I passi attivi del prologo e della missione principale, con la loro definizione. */
  private passiDellaStoria(): { missione: string; def: PassoDef }[] {
    const n = this.r.narrativa;
    const out: { missione: string; def: PassoDef }[] = [];
    for (const a of n.missioni.passiAttivi()) {
      const m = n.contenuti.missioni.find((x) => x.id === a.missione);
      if (!m || !TIPI_STORIA.has(m.tipo ?? '')) continue;
      const def = m.passi.find((p) => p.id === a.passo);
      if (def) out.push({ missione: m.id, def });
    }
    return out;
  }

  // ------------------------------------------------------------------ dialoghi di riserva

  /**
   * Gli ambiti (missione, passo) dei passi attivi della storia che il dialogo fa avanzare: la
   * sua condizione vale anche lì dentro, dove un luogo resta «raggiunto» per tutto il passo.
   */
  ambitiDelDialogo(dialogo: string): { missione: string; passo: string }[] {
    const n = this.r.narrativa;
    return this.passiDellaStoria()
      .filter(({ def }) => dialoghiCheFannoAvanzare(def, n.contenuti.dialoghi).includes(dialogo))
      .map(({ missione, def }) => ({ missione, passo: def.id }));
  }

  private dialoghiDiRiserva(passi: { missione: string; def: PassoDef }[]): void {
    const r = this.r;
    const n = r.narrativa;
    if (r.dialoghi.aperto || n.dialoghi.aperto() || r.fase !== 'gioco') return;
    for (const { missione, def } of passi) {
      const ovunque = RISERVA_OVUNQUE[def.id];
      for (const id of dialoghiCheFannoAvanzare(def, n.contenuti.dialoghi)) {
        const d = n.dialoghi.definizione(id);
        if (!d || (n.dialoghi.finito(id) && !d.ripetibile) || r.dialoghi.inCoda(id)) continue;
        const forza = !!ovunque && ovunque.dialogo === id && this.tempoDelPasso(def.id) >= ovunque.dopo && r.interno === null;
        // la condizione nell'ambito del passo, come la legge il segnalino: il luogo raggiunto
        // durante il passo resta raggiunto (la passerella della prova, quando Ottavio scende lontano)
        if (!forza && d.condizione !== undefined && !n.valuta(d.condizione, undefined, { missione, passo: def.id })) continue;
        r.log(`riserva: ${id}${forza ? ' (ovunque)' : ''}`);
        r.dialoghi.richiedi(id, true, forza);
      }
    }
  }

  // ------------------------------------------------------------------ il fermo della prima notte

  /**
   * Finché il fienile del Messo non è raggiunto (passo `m1_fienile`), l'orologio non passa le
   * 05:00 del giorno 2: la notte aspetta Elvira. Il limite si toglie appena il passo finisce.
   */
  private fermoPrimaNotte(attivi: ReadonlySet<string>): void {
    const o = this.r.orologio;
    if (attivi.has('m1_fienile')) {
      if (o.limite === null && o.fermo === null && o.assoluto < FERMO_PRIMA_NOTTE) o.limite = FERMO_PRIMA_NOTTE;
    } else if (o.limite === FERMO_PRIMA_NOTTE) o.limite = null;
  }

  // ------------------------------------------------------------------ promemoria e aiuti

  private promemoria(passi: { def: PassoDef }[]): void {
    for (const { def } of passi) {
      if (this.promemoriaDati.has(def.id)) continue;
      const p = PROMEMORIA[def.id];
      if (p === null) continue;
      const id = p?.id ?? def.effettiAttivazione.find((e) => e.startsWith('suggerimento:'))?.slice('suggerimento:'.length);
      if (!id) continue;
      if (this.tempoDelPasso(def.id) < (p?.dopo ?? PROMEMORIA_DOPO)) continue;
      this.promemoriaDati.add(def.id);
      this.r.ponte.suggerimento(id, 12);
      return;
    }
  }

  /** Gli sguardi da trovare (la scritta del vetro, il lago in su): dopo un po' lo sguardo ci va da solo. */
  private aiutiSguardo(attivi: ReadonlySet<string>): void {
    const r = this.r;
    if (attivi.has('pr_vetro') && r.controllo.tipo === 'sdraiata') {
      const k = this.aiuto('pr_vetro', AIUTI_VETRO);
      if (k > 0) {
        r.voltatiVerso(r.cripta.scritta, 2.4, true, k > 1 ? () => r.flag('guardato_vetro') : undefined);
        r.log('aiuto: lo sguardo scivola sulla scritta del vetro');
      }
    }
    // fuori dalla botola, in piedi o seduta
    const fuori = r.interno === null && (r.controllo.tipo === 'libero' || r.controllo.tipo === 'seduta');
    if (attivi.has('pr_guarda_su') && fuori && !r.narrativa.flag.vero('guardato_in_su')) {
      const k = this.aiuto('pr_guarda_su', AIUTI_IN_SU);
      if (k > 0) {
        // un punto alto davanti: quasi dritto in su, dove pende il lago (più di 50° sull'orizzonte)
        const p = r.game.player;
        localFrameAt(p.pos, _cornice, p.cyl.theta);
        const su = _cornice.up;
        r.game.rig.forward(_sguardo).addScaledVector(su, -_sguardo.dot(su));
        if (_sguardo.lengthSq() < 1e-6) _sguardo.copy(_cornice.north);
        _sguardo.normalize();
        const punto = r.occhi(_occhi).addScaledVector(su, 30).addScaledVector(_sguardo, 8);
        r.voltatiVerso(punto, 2.4, true, k > 1 ? () => r.flag('guardato_in_su') : undefined);
        r.log('aiuto: lo sguardo sale verso il lago appeso');
      }
    }
  }

  /**
   * Quale aiuto dare adesso (1 il primo, 2 il secondo…), una volta per ciascuno, quando il passo è
   * attivo da uno dei tempi `quando` (s); 0 se nessuno.
   */
  private aiuto(passo: string, quando: readonly number[]): number {
    const t = this.tempoDelPasso(passo);
    for (const [i, s] of quando.entries()) {
      const k = `${passo}@${s}`;
      if (t < s || this.aiutiDati.has(k)) continue;
      this.aiutiDati.add(k);
      return i + 1;
    }
    return 0;
  }

  /** Un atterraggio che non è una planata, mentre il passo del Velo la chiede: perché. */
  atterraggioSenzaPlanata(secondiVelo: number, dislivello: number): void {
    const r = this.r;
    if (r.narrativa.flag.vero('planata_fatta') || !r.narrativa.valuta('passo:m1_velo attivo')) return;
    if (this.tempo - this.ultimaNotaPlanata < 20) return;
    if (secondiVelo > 0.05) {
      this.ultimaNotaPlanata = this.tempo;
      r.ponte.notifica('Il Velo non ha preso aria: salta da un muro più alto (i muri a secco verso la piazza) e tieni premuto Spazio.');
    } else if (dislivello >= 2) {
      this.ultimaNotaPlanata = this.tempo;
      r.ponte.notifica('In aria tieni premuto Spazio: il Velo si apre.');
    }
  }

  // ------------------------------------------------------------------ il gesto di adesso

  /** Il terreno `distanza` m avanti (lungo lo sguardo) sale più di quanto si cammini? */
  private salitaDavanti(distanza: number): boolean {
    const p = this.r.game.player;
    localFrameAt(p.pos, _cornice, p.cyl.theta);
    const su = _cornice.up;
    this.r.game.rig.forward(_sguardo).addScaledVector(su, -_sguardo.dot(su));
    if (_sguardo.lengthSq() < 1e-6) return false;
    _sguardo.normalize();
    const avanti = worldToCyl(_punto.copy(p.pos).addScaledVector(_sguardo, distanza), _cil);
    const qui = p.groundFn(p.cyl.z, p.cyl.theta);
    return troppoRipido(p.groundFn(avanti.z, avanti.theta) - qui, distanza);
  }

  private calcolaIndicazione(attivi: ReadonlySet<string>): AzioneContestuale | null {
    const r = this.r;
    if (r.fase !== 'gioco' || r.dialoghi.aperto) return null;
    const c = r.controllo;
    const p = r.game.player;
    const n = r.narrativa;
    const s: StatoGesto = { controllo: c.tipo };
    if (c.tipo === 'scala') s.scala = { y: c.y, cima: r.cimaScala };
    if (c.tipo === 'libero' && !p.grounded && r.interno === null) {
      s.aria = { velo: p.veloOpen, altezza: p.heightAboveGround, insegna: attivi.has('m1_velo') && !n.flag.vero('planata_fatta') };
    }
    if (c.tipo === 'piantato') {
      const m = r.miraSquadro;
      const capo = r.squadro.telescopio ? (m.b?.caposaldo ?? null) : null;
      s.squadro = {
        livellato: r.squadro.livellato,
        telescopio: r.squadro.telescopio,
        caposaldo: capo,
        coperto: capo !== null && r.ostacoloFra(r.squadro.stazione, capo) !== null,
        tenuta: m.t,
        serve: r.ui.impostazioni.get('collimazioneAgganciata') ? 0.8 : 1.5,
        ...(attivi.has('m1_chiodo2') || attivi.has('m1_primo_rilievo') ? { meta: 'la palina bianca e rossa sul campanile' } : attivi.has('m1_strada') ? { meta: "la palina dell'altro chiodo, di là dal riale" } : {}),
      };
    }
    if (c.tipo === 'libero' && r.interno === null && this.spinta >= 0.4) {
      const q = p.cyl;
      const altezze = altezzeDavanti(p.pos, q.theta, r.game.rig.forward(_sguardo), r.game.world.colliders.query(q.z, q.theta, 3, []));
      this.altezzeDavanti = altezze;
      s.muretto = altezze.some((h) => h >= MURETTO_MIN && h <= MURETTO_MAX);
      // contro un muro alto o una scarpata (il terreno sotto le terrazze) si capisce dopo poco
      // più di un secondo di spinta, non a ogni urto
      if (!s.muretto && this.spinta >= 1.2) {
        const muro = muroAltoDavanti(altezze);
        const ripido = !muro && altezze.length === 0 && this.salitaDavanti(1.2);
        if (muro || ripido) {
          const strada = stradaDeiPassi(attivi, r.catasto.variante('E4') === 'Abitata');
          s.muroAlto = `${muro ? 'Troppo alto' : 'Troppo ripido'}: ${strada}`;
        }
      }
    }
    if (c.tipo === 'libero' && r.interno === null && attivi.has('m1_strada') && !n.dialoghi.finito('d_ottavio_strada')) {
      const o = r.orologio.ore;
      s.fischio = n.flag.vero('ottavio_conosciuto') && o >= 6 && o < 20.5 && !r.abitanti.presente('ottavio');
    }
    if (c.tipo === 'seduta') {
      s.inAttesa = r.orologio.inAttesa;
      s.salto = r.orologio.inSalto;
      s.attesa = !r.ponte.attesaAperta && r.vociAttesa().length > 0;
      s.rilettura = n.inventario.ha('lettera_marta') && n.flag.vero('lettera_letta');
    }
    if (c.tipo === 'libero' && r.interno === null && this.fermaDa >= FERMA_PER_ASPETTARE && r.orologio.fermo === null) {
      // chi si cerca non c'è ancora (le indicazioni dicono quando arriva), o il passo è un'attesa
      const daAspettare = r.guida.arrivo !== null || [...attivi].some((id) => PASSI_DI_ATTESA.has(id)) || (attivi.has('m1_notte') && n.flag.vero('scelta_vegliare'));
      s.aspettare = daAspettare && r.vociAttesa().length > 0;
    }
    return indicazioneGesto(s);
  }
}
