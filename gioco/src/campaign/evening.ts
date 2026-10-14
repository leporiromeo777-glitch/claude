/**
 * La sera (GDD 4.2, 5.6, 10.3): l'oggetto della laguna, i bigliettini, gli spilli rossi,
 * le risposte, i bigliettini anonimi e i parametri della notte. Funzioni pure sullo
 * stato della campagna: le chiama il controller dentro `save.update`.
 *
 * Regole:
 * - I bigliettini della sera sono `level.notes` filtrati con `availableIf` (le varianti
 *   si escludono a vicenda); nella fase 'scelta' di g23 solo quelli con `ending`, nella
 *   sera normale solo quelli senza.
 * - Spilli rossi: `pins` della giornata in campaign.json (g00: 0); la scelta di g23 ne
 *   usa sempre uno solo.
 * - Oggetti (C04): quello della giornata precedente (`objectAfter`) alla porta, con la
 *   frase della sua provenienza (laguna, mano, porta, casa); quello dell'alba
 *   (`dawnObject`) consegnato a mano dopo le vignette; la frase vuota della porta
 *   (`eveningEmptyKey`) quando non arriva niente.
 * - Rispondere non costa spilli e si fa una volta sola: gli effetti valgono subito.
 * - Un bigliettino non appuntato è "lasciato" quando si va al tombolo (anche se ha avuto
 *   una risposta): vale `onIgnore`. I destini che dipendono da una richiesta (Bepi,
 *   le lettere di Livia, Nina, Zeno e Livia) seguono così la richiesta non tentata.
 * - Anonimo (GDD 3.11, da g12): l'autore ha memoria 0. Prima di appuntarlo si sceglie chi
 *   l'ha scritto fra i personaggi del cast presenti nella giornata. Se l'autore indovinato
 *   è sbagliato, la richiesta fallisce comunque a fine giornata (il vero autore resta deluso).
 */
import type {
  AcceptedRequest,
  CampaignDay,
  ObjectMeta,
  CampaignState,
  CharacterId,
  ContentDB,
  Knowledge,
  LetterDef,
  LevelDef,
  NightParams,
  NoteDef,
  NoteId,
} from '../core/types';
import { CAST_IDS } from '../core/ids';
import { applyEffects, evalStory, type EffectLog, emptyLog } from './story';
import { hasForgotten, usesNome } from './memoria';
import type { CampaignStateX } from './types';

type Db = Pick<ContentDB, 'levels' | 'notes' | 'diary' | 'balance' | 'letters' | 'campaign'>;

export type EveningMode = 'sera' | 'scelta';

export function campaignDays(db: Pick<ContentDB, 'campaign'>): CampaignDay[] {
  return db.campaign.days;
}

export function dayAt(db: Pick<ContentDB, 'campaign'>, index: number): CampaignDay | null {
  return db.campaign.days[index] ?? null;
}

export function dayIndexOf(db: Pick<ContentDB, 'campaign'>, id: string): number {
  return db.campaign.days.findIndex((d) => d.id === id);
}

/** Spilli rossi della sera; la scelta di g23 ne usa sempre uno solo (CAM-09). */
export function pinsOf(db: Pick<ContentDB, 'campaign'>, index: number, mode: EveningMode = 'sera'): number {
  if (mode === 'scelta') return 1;
  return Math.max(0, dayAt(db, index)?.pins ?? 0);
}

/** Bigliettini della sera (o della scelta), nell'ordine del livello, filtrati con availableIf. */
export function eveningNotes(level: LevelDef, s: CampaignState, k: Knowledge, db: Db, mode: EveningMode = 'sera'): NoteDef[] {
  const out: NoteDef[] = [];
  for (const id of level.notes ?? []) {
    const n = db.notes.get(id);
    if (!n) continue;
    if (mode === 'sera' ? !!n.ending : !n.ending) continue;
    let ok = true;
    try {
      ok = !n.availableIf || evalStory(n.availableIf, s, k, { db });
    } catch {
      ok = false;
    }
    if (ok) out.push(n);
  }
  return out;
}

/** Il bigliettino arriva senza firma: l'autore ha dimenticato Ada (GDD 3.11). */
export function isAnonymous(note: NoteDef, s: Pick<CampaignState, 'memoria'>, db?: Pick<ContentDB, 'balance'>): boolean {
  if (note.ending) return false;
  if (!(CAST_IDS as readonly string[]).includes(note.author)) return false;
  return hasForgotten(s, note.author, db?.balance?.memoria);
}

/** Possibili autori di un bigliettino anonimo: il cast presente nella giornata. */
export function guessCandidates(level: LevelDef): CharacterId[] {
  const present = new Set<CharacterId>();
  for (const t of level.threads) if (t.kind !== 'lino' && t.character) present.add(t.character);
  return CAST_IDS.filter((c) => present.has(c));
}

// ───────── Oggetto della laguna ─────────

export interface EveningItem {
  kind: 'oggetto' | 'lettera';
  id: string;
  /** Lettera (testo, firma). */
  letter?: LetterDef;
  /** Nome dell'immagine dell'oggetto (obj/…) o null per un foglio. */
  image: string | null;
}

const OBJECT_IMAGES: Record<string, string> = {
  merletto_avorio: 'obj/tombolo',
  libro_punti: 'obj/libro',
  pagina_strappata: 'obj/libro',
  fuso_faro: 'obj/fuso_faro',
  bottiglia: 'obj/bottiglia',
  bottiglia_nodo_nero: 'obj/bottiglia',
  fascio_lettere: 'obj/fascio_lettere',
  nastro_nonna: 'obj/forbici',
};

export function imageOf(id: string): string | null {
  if (OBJECT_IMAGES[id]) return OBJECT_IMAGES[id] ?? null;
  if (/^lettera_L\d+$/.test(id)) return 'obj/bottiglia';
  if (/^fascio_\d+$/.test(id)) return 'obj/fascio_lettere';
  return null;
}

export function itemOf(id: string, db: Pick<ContentDB, 'letters'>): EveningItem {
  const letter = db.letters.find((l) => l.id === id);
  if (letter) return { kind: 'lettera', id, letter, image: imageOf(id) };
  return { kind: 'oggetto', id, image: imageOf(id) };
}

/**
 * Oggetti della sera: quello lasciato dalla giornata precedente (`objectAfter`), o per
 * la scelta quello di g23. Dopo il prologo anche il Libro dei Punti; il fascio delle
 * lettere di Livia solo se le lettere sono state liberate (GDD 5.6).
 */
export function eveningItems(dayIndex: number, mode: EveningMode, s: Pick<CampaignState, 'flags'>, db: Pick<ContentDB, 'letters' | 'campaign'>): EveningItem[] {
  const day = mode === 'scelta' ? dayAt(db, dayIndex) : dayAt(db, dayIndex - 1);
  const id = day?.objectAfter;
  if (!id || (mode === 'sera' && dayIndex <= 0)) return [];
  if (id === 'merletto_avorio') return [itemOf('merletto_avorio', db), itemOf('libro_punti', db)];
  if (id === 'fascio_lettere') {
    if (s.flags['lettereLivia'] !== 'liberate') return [];
    const out = [itemOf('fascio_lettere', db)];
    for (const l of db.letters) if (/^fascio_\d+$/.test(l.id)) out.push(itemOf(l.id, db));
    return out;
  }
  return [itemOf(id, db)];
}

/**
 * Oggetto consegnato a mano alla fine dell'alba (C04, `dawnObject` della giornata):
 * la lettera di Clotilde in g14; in g16 il fascio delle lettere di Livia con
 * `fascio_1..3`, solo se le lettere sono state liberate (come prima la sera).
 */
export function dawnItems(dayIndex: number, s: Pick<CampaignState, 'flags'>, db: Pick<ContentDB, 'letters' | 'campaign'>): EveningItem[] {
  const id = dayAt(db, dayIndex)?.dawnObject;
  if (!id) return [];
  if (id === 'fascio_lettere') {
    if (s.flags['lettereLivia'] !== 'liberate') return [];
    const out = [itemOf('fascio_lettere', db)];
    for (const l of db.letters) if (/^fascio_\d+$/.test(l.id)) out.push(itemOf(l.id, db));
    return out;
  }
  return [itemOf(id, db)];
}

/** Provenienza di un oggetto (C04): quella di `objects` in campaign.json, altrimenti la laguna. */
export function objectMeta(db: Pick<ContentDB, 'campaign'>, id: string): ObjectMeta {
  return db.campaign.objects?.[id] ?? { from: 'laguna' };
}

/** Frase d'arrivo alla porta per gli oggetti della sera (C04): dipende dal primo oggetto. */
export function arrivalOf(db: Pick<ContentDB, 'campaign'>, items: readonly EveningItem[]): { key: string; params?: Record<string, string>; from: ObjectMeta['from'] } {
  const first = items[0];
  const meta = first ? objectMeta(db, first.id) : { from: 'laguna' as const };
  if (meta.from === 'mano') return { key: 'campaign.sera.arrivo.mano', params: { nome: `[[${meta.by ?? 'zeno'}]]` }, from: 'mano' };
  return { key: `campaign.sera.arrivo.${meta.from}`, from: meta.from };
}

/**
 * Frase della porta quando stasera non arriva niente (C04): `eveningEmptyKey` della
 * giornata, o quella predefinita. Null nel prologo e quando un oggetto arriva.
 */
export function emptyDoorKey(dayIndex: number, mode: EveningMode, s: Pick<CampaignState, 'flags'>, db: Pick<ContentDB, 'letters' | 'campaign'>): string | null {
  if (mode === 'scelta' || dayIndex <= 0) return null;
  if (eveningItems(dayIndex, mode, s, db).length > 0) return null;
  return dayAt(db, dayIndex)?.eveningEmptyKey ?? 'campaign.sera.arrivo.niente';
}

/** L'oggetto è stato letto: le lettere vanno nel Taccuino (Lettere), gli oggetti fra gli oggetti. */
export function learnItems(items: readonly EveningItem[], k: Knowledge): void {
  for (const it of items) {
    if (it.kind === 'lettera') {
      if (!k.letters.includes(it.id)) k.letters.push(it.id);
    } else if (!k.objects.includes(it.id)) k.objects.push(it.id);
  }
}

// ───────── Bigliettini ─────────

export type EveningError = 'nessunaSera' | 'sconosciuto' | 'spilli' | 'chi' | 'senzaRichiesta' | 'giaRisposto' | 'senzaRisposte';

function evening(s: CampaignState): NonNullable<CampaignState['evening']> | null {
  return s.evening ?? null;
}

function markDecided(s: CampaignStateX, id: NoteId): void {
  const list = (s.decided ??= []);
  if (!list.includes(id)) list.push(id);
}

/** Spilli ancora liberi stasera. */
export function pinsLeft(s: CampaignState, db: Pick<ContentDB, 'campaign'>): number {
  const ev = evening(s);
  return Math.max(0, pinsOf(db, s.dayIndex, s.phase === 'scelta' ? 'scelta' : 'sera') - (ev?.accepted.length ?? 0));
}

/** Appunta un bigliettino con uno spillo rosso. */
export function pinNote(s: CampaignStateX, db: Db, noteId: NoteId, guess?: CharacterId): EveningError | null {
  const ev = evening(s);
  if (!ev) return 'nessunaSera';
  if (!ev.noteIds.includes(noteId)) return 'sconosciuto';
  const note = db.notes.get(noteId);
  if (!note) return 'sconosciuto';
  if (!note.request && !note.ending) return 'senzaRichiesta';
  if (ev.accepted.some((a) => a.noteId === noteId)) return null;
  if (pinsLeft(s, db) <= 0) return 'spilli';
  const anon = isAnonymous(note, s, db);
  if (anon && !guess) return 'chi';
  const entry: { noteId: NoteId; authorGuess?: CharacterId } = { noteId };
  if (anon && guess) entry.authorGuess = guess;
  ev.accepted.push(entry);
  s.left = (s.left ?? []).filter((x) => x !== noteId);
  markDecided(s, noteId);
  return null;
}

/** Toglie lo spillo (prima di andare al tombolo). */
export function unpinNote(s: CampaignStateX, noteId: NoteId): void {
  const ev = evening(s);
  if (!ev) return;
  ev.accepted = ev.accepted.filter((a) => a.noteId !== noteId);
  if (!ev.replies[noteId] && !(s.left ?? []).includes(noteId)) s.decided = (s.decided ?? []).filter((x) => x !== noteId);
}

/** Risponde a un bigliettino (R1 o R2): gli effetti valgono subito. */
export function replyNote(s: CampaignStateX, k: Knowledge, db: Db, noteId: NoteId, reply: 'R1' | 'R2', log: EffectLog = emptyLog()): EveningError | null {
  const ev = evening(s);
  if (!ev) return 'nessunaSera';
  if (!ev.noteIds.includes(noteId)) return 'sconosciuto';
  const note = db.notes.get(noteId);
  const r = note?.replies?.find((x) => x.id === reply);
  if (!note || !note.replies?.length) return 'senzaRisposte';
  if (!r) return 'senzaRisposte';
  if (ev.replies[noteId]) return 'giaRisposto';
  ev.replies[noteId] = reply;
  applyEffects(r.effects, s, k, { db }, log);
  markDecided(s, noteId);
  return null;
}

/** Lascia un bigliettino (toglie lo spillo se c'era). */
export function leaveNote(s: CampaignStateX, noteId: NoteId): EveningError | null {
  const ev = evening(s);
  if (!ev) return 'nessunaSera';
  if (!ev.noteIds.includes(noteId)) return 'sconosciuto';
  ev.accepted = ev.accepted.filter((a) => a.noteId !== noteId);
  const left = (s.left ??= []);
  if (!left.includes(noteId)) left.push(noteId);
  markDecided(s, noteId);
  return null;
}

/** Bigliettini non ancora decisi (contano come lasciati, con una conferma). */
export function undecided(s: CampaignStateX): NoteId[] {
  const ev = evening(s);
  if (!ev) return [];
  const d = new Set(s.decided ?? []);
  for (const a of ev.accepted) d.add(a.noteId);
  for (const id of Object.keys(ev.replies)) d.add(id);
  return ev.noteIds.filter((id) => !d.has(id));
}

/** Modo del tombolo per un livello (richiesta del pacchetto tombolo). */
export function nightModeFor(level: LevelDef): NightParams['mode'] {
  if (level.archive) return level.autoweave?.occasionSlots ? 'occasioni' : 'archivio';
  if (level.autoweave?.controlled) return 'controllato';
  if (level.autoweave?.occasionSlots) return 'occasioni';
  return 'normale';
}

/** Richieste appuntate stasera, nel formato della notte. */
export function acceptedRequests(s: CampaignState, db: Pick<ContentDB, 'notes'>): AcceptedRequest[] {
  const out: AcceptedRequest[] = [];
  for (const a of s.evening?.accepted ?? []) {
    const n = db.notes.get(a.noteId);
    if (!n?.request) continue;
    const r: AcceptedRequest = { noteId: n.id, request: n.request, author: n.author };
    if (a.authorGuess) r.authorGuess = a.authorGuess;
    out.push(r);
  }
  return out;
}

/** Parametri della notte della campagna per un livello. */
export function campaignNightParams(s: CampaignState, level: LevelDef, db: Pick<ContentDB, 'notes'>): NightParams {
  return {
    origin: 'campagna',
    mode: nightModeFor(level),
    level,
    flags: { ...s.flags },
    accepted: acceptedRequests(s, db),
    goals: [...(level.goals ?? [])],
    needsNome: usesNome(level),
  };
}
