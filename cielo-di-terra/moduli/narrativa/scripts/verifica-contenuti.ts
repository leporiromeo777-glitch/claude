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

/** Raccoglie gli id di celle/particelle da fade_fase1.json, qualunque sia la forma esatta. */
function idCelle(x: unknown): string[] | undefined {
  if (x === undefined) return undefined;
  const out = new Set<string>();
  const visita = (v: unknown, chiave: string): void => {
    if (Array.isArray(v)) {
      for (const e of v) {
        if (/particell|cell/i.test(chiave) && e && typeof e === 'object' && typeof (e as { id?: unknown }).id === 'string') {
          out.add((e as { id: string }).id);
        }
        visita(e, chiave);
      }
    } else if (v && typeof v === 'object') {
      for (const [k, w] of Object.entries(v as Record<string, unknown>)) {
        if (/^(particelle|celle|stati_iniziali)$/i.test(k) && w && typeof w === 'object' && !Array.isArray(w)) {
          for (const id of Object.keys(w as object)) out.add(id);
        }
        visita(w, k);
      }
    }
  };
  visita(x, '');
  return out.size ? [...out] : undefined;
}

const file = {
  missioni: 'missioni.json',
  dialoghi: 'dialoghi.json',
  taccuino: 'taccuino.json',
  luoghi: 'luoghi.json',
  personaggi: 'personaggi.json',
  fade: 'fade_fase1.json',
};

const mancanti = (['missioni', 'dialoghi', 'taccuino'] as const).filter((k) => !existsSync(join(cartella, file[k])));
if (mancanti.length === 3) {
  console.error(`Nessun file narrativo in ${cartella} (mancano ${mancanti.map((k) => file[k]).join(', ')}): riprova più tardi.`);
  process.exit(2);
}

const celle = idCelle(leggi(file.fade));
const contenuti: ContenutiVerifica = {
  missioni: leggi(file.missioni),
  dialoghi: leggi(file.dialoghi),
  taccuino: leggi(file.taccuino),
  luoghi: leggi(file.luoghi),
  personaggi: leggi(file.personaggi),
  ...(celle ? { celle } : {}),
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
for (const k of ['luoghi', 'personaggi', 'fade'] as const) {
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
if (conTraccia) {
  titolo('Traccia della partita simulata');
  if (markdown) righe.push('```');
  for (const t of r.traccia) righe.push(t);
  if (markdown) righe.push('```');
}

console.log(righe.join('\n'));
process.exit(r.errori.length ? 1 : 0);
