/**
 * Verifica i contenuti narrativi veri (content/*.json).
 *
 *   npx tsx scripts/verifica-contenuti.ts [cartella-content] [--md] [--traccia]
 *
 * Senza argomenti usa la cartella `content` del progetto, tre livelli sopra
 * questo file (moduli/narrativa/scripts → cielo-di-terra/content; lo stesso
 * vale dopo lo spostamento in src/narrativa/scripts).
 *
 * Esce con codice 0 se non ci sono errori, 1 se ce ne sono, 2 se mancano i
 * file principali (il design li sta ancora scrivendo: riprovare più tardi).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verificaContenuti, type ContenutiVerifica } from '../src/verifica';

const argomenti = process.argv.slice(2);
const markdown = argomenti.includes('--md');
const conTraccia = argomenti.includes('--traccia');
const cartella = resolve(
  argomenti.find((a) => !a.startsWith('--')) ?? fileURLToPath(new URL('../../../content/', import.meta.url)),
);

function leggi(nome: string): unknown {
  const percorso = join(cartella, nome);
  if (!existsSync(percorso)) return undefined;
  try {
    return JSON.parse(readFileSync(percorso, 'utf8')) as unknown;
  } catch (e) {
    console.error(`${nome}: JSON non valido: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

/**
 * Id di celle/particelle da fade_fase1.json: gli id numerici della griglia
 * (iz*96 + itheta), i codici di catasto («1-458») e gli elementi mobili («E1»).
 */
function idCelle(x: unknown): string[] | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const out = new Set<string>();
  const o = x as Record<string, unknown>;
  for (const chiave of ['particelle', 'elementi_mobili', 'celle']) {
    const lista = o[chiave];
    if (!Array.isArray(lista)) continue;
    for (const p of lista) {
      if (!p || typeof p !== 'object') continue;
      const q = p as Record<string, unknown>;
      if (typeof q.id === 'string' || typeof q.id === 'number') out.add(String(q.id));
      if (typeof q.catasto === 'string') out.add(q.catasto);
    }
  }
  return out.size ? [...out] : undefined;
}

/** Elementi mobili e varianti da fade_fase1.json: { E1: ['Carta', 'Abitata'] }. */
function elementiMobili(x: unknown): Record<string, string[]> | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const lista = (x as Record<string, unknown>).elementi_mobili;
  if (!Array.isArray(lista)) return undefined;
  const out: Record<string, string[]> = {};
  for (const e of lista) {
    if (!e || typeof e !== 'object') continue;
    const o = e as { id?: unknown; varianti?: unknown };
    if (typeof o.id !== 'string' || !Array.isArray(o.varianti)) continue;
    out[o.id] = o.varianti
      .map((v) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v))
      .filter((v): v is string => typeof v === 'string');
  }
  return out;
}

const file = {
  missioni: 'missioni.json',
  dialoghi: 'dialoghi.json',
  taccuino: 'taccuino.json',
  luoghi: 'luoghi.json',
  personaggi: 'personaggi.json',
  fade: 'fade_fase1.json',
  testi: 'testi.json',
};

const mancanti = (['missioni', 'dialoghi', 'taccuino'] as const).filter((k) => !existsSync(join(cartella, file[k])));
if (mancanti.length === 3) {
  console.error(`Nessun file narrativo in ${cartella} (mancano ${mancanti.map((k) => file[k]).join(', ')}): riprova più tardi.`);
  process.exit(2);
}

const fade = leggi(file.fade);
const celle = idCelle(fade);
const elementi = elementiMobili(fade);
const contenuti: ContenutiVerifica = {
  missioni: leggi(file.missioni),
  dialoghi: leggi(file.dialoghi),
  taccuino: leggi(file.taccuino),
  luoghi: leggi(file.luoghi),
  personaggi: leggi(file.personaggi),
  testi: leggi(file.testi),
  ...(celle ? { celle } : {}),
  ...(elementi ? { elementi } : {}),
};

const r = verificaContenuti(contenuti);

const righe: string[] = [];
const titolo = (s: string): void => {
  righe.push('', markdown ? `#### ${s}` : `== ${s} ==`);
};
const voce = (s: string): void => {
  righe.push(markdown ? `- ${s}` : `  ${s}`);
};

righe.push(`${markdown ? '**Cartella**' : 'Cartella'}: ${cartella}`);
if (mancanti.length) righe.push(`File mancanti: ${mancanti.map((k) => file[k]).join(', ')}`);
for (const k of ['luoghi', 'personaggi', 'fade', 'testi'] as const) {
  if (!existsSync(join(cartella, file[k]))) righe.push(`(${file[k]} assente: i suoi riferimenti non sono controllati)`);
}
righe.push(
  `Conteggi: ${Object.entries(r.conteggi)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ')}`,
);

titolo(`Errori (${r.errori.length})`);
for (const e of r.errori) voce(e);
if (!r.errori.length) voce('nessuno');
titolo(`Avvisi (${r.avvisi.length})`);
for (const a of r.avvisi) voce(a);
if (!r.avvisi.length) voce('nessuno');
titolo('Simulazione');
for (const s of r.simulazione) voce(`${s.missione} «${s.titolo}»: ${s.esito}${s.motivo ? ` (${s.motivo})` : ''}`);
if (r.ipotesi.length) {
  titolo('Ipotesi del simulatore');
  for (const i of r.ipotesi) voce(i);
}
titolo(`Flag che deve impostare il gioco (${r.flagDelGioco.length})`);
for (const f of r.flagDelGioco) voce(`${markdown ? '`' + f.nome + '`' : f.nome} — letto in: ${f.letto.join('; ')}`);
if (r.oggettiDelGioco.length) {
  titolo(`Oggetti che deve dare il gioco (${r.oggettiDelGioco.length})`);
  for (const o of r.oggettiDelGioco) voce(`${markdown ? '`' + o.id + '`' : o.id} — letto in: ${o.letto.join('; ')}`);
}
if (r.flagSoloScritti.length) {
  titolo(`Flag scritti dai contenuti che nessuna condizione legge (${r.flagSoloScritti.length}: li legge il gioco?)`);
  for (const f of r.flagSoloScritti) voce(`${markdown ? '`' + f.nome + '`' : f.nome} — scritto in: ${f.scritto.join('; ')}`);
}
if (r.dialoghiNonGiocati.length) {
  titolo(`Dialoghi non giocati nella partita simulata (${r.dialoghiNonGiocati.length}: alternative, facoltativi, ripetibili)`);
  voce(r.dialoghiNonGiocati.join(', '));
}
if (conTraccia) {
  titolo('Traccia della partita simulata');
  if (markdown) righe.push('```');
  for (const t of r.traccia) righe.push(t);
  if (markdown) righe.push('```');
}

console.log(righe.join('\n'));
process.exit(r.errori.length ? 1 : 0);
