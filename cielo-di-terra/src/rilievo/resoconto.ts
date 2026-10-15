/**
 * Il resoconto del mattino (GDD §3.4.8): ogni cambiamento della notte in una riga, con il
 * motivo, in italiano. Le righe rosse sono i cambiamenti; le verdi ciò che il rilievo ha
 * salvato (la prima volta); le grigie ciò che Elvira ha salvato restando lì.
 */
import { ORARI } from './costanti';
import { formattaOra, minutiNotte } from './tempo';
import type {
  Cambiamento,
  DefElemento,
  NotteInCorso,
  RegoleCatasto,
  Resoconto,
  RigaResoconto,
  StatoCatasto,
  VoceCronologia,
} from './tipi';

export function riempi(modello: string, valori: Record<string, string | number>): string {
  return modello.replace(/\{(\w+)\}/g, (m, k: string) => (k in valori ? String(valori[k]) : m));
}

/** «Non misurata: tornata alla Carta.» → «non misurata, tornata alla Carta.» */
function motivoInRiga(motivo: string): string {
  const t = motivo.trim();
  const i = t.indexOf(':');
  const frase = i > 0 ? `${t.slice(0, i)},${t.slice(i + 1)}` : t;
  return frase.charAt(0).toLowerCase() + frase.slice(1);
}

function maiuscola(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Motivo breve di una transizione di variante, dai contenuti o dal modello di riga. */
export function motivoVariante(regole: RegoleCatasto, e: DefElemento, da: string, a: string): string {
  const m = e.motivi[`${da}>${a}`] ?? Object.entries(e.motivi).find(([k]) => k.endsWith(`>${a}`))?.[1];
  if (m) return m;
  const riga = riempi(regole.testi.perVariante[a] ?? regole.testi.perVariante['*'] ?? '{nome}: cambiata.', { nome: '', variante: a });
  const senzaNome = riga.replace(/^\s*:\s*/, '');
  const i = senzaNome.indexOf(',');
  return maiuscola(i > 0 ? `${senzaNome.slice(0, i)}:${senzaNome.slice(i + 1)}` : senzaNome);
}

/** La riga del resoconto per un elemento che ha cambiato variante. */
export function rigaVariante(regole: RegoleCatasto, e: DefElemento, da: string, a: string): string {
  const m = e.motivi[`${da}>${a}`] ?? Object.entries(e.motivi).find(([k]) => k.endsWith(`>${a}`))?.[1];
  if (m) return `${e.nome}: ${motivoInRiga(m)}`;
  return riempi(regole.testi.perVariante[a] ?? regole.testi.perVariante['*'] ?? '{nome}: cambiata.', { nome: e.nome, variante: a });
}

function rigaDaCambiamento(regole: RegoleCatasto, c: Cambiamento): RigaResoconto | null {
  const base = { particelle: [...c.particelle], ...(c.elemento ? { elemento: c.elemento } : {}), ...(c.caposaldo ? { caposaldo: c.caposaldo } : {}) };
  switch (c.tipo) {
    case 'variante': {
      const e = c.elemento ? regole.elementi.get(c.elemento) : undefined;
      if (!e || !c.da || !c.a) return null;
      const nota = c.nota ? ` ${c.nota}` : '';
      return { colore: 'rosso', testo: rigaVariante(regole, e, c.da, c.a) + nota, motivo: c.motivo, regola: 3, ...base };
    }
    case 'caposaldo_spostato':
    case 'particelle_a_matita':
    case 'contatore':
    case 'evento':
      return { colore: 'rosso', testo: c.motivo, motivo: c.motivo, regola: c.regola, ...base };
    case 'scrittura_cancellata':
      return { colore: 'rosso', testo: c.motivo, motivo: 'Scrittura G5 cancellata dal G3.', regola: c.regola, ...base };
    case 'scrittura_costruita':
      return { colore: 'verde', testo: c.motivo, motivo: 'La Penna ha scritto: le Fade hanno costruito.', regola: c.regola, ...base };
  }
}

/** Le prossime finestre utili: chi rimette che cosa, e quando (dai cicli del giorno). */
export function prossimeFinestre(stato: StatoCatasto, regole: RegoleCatasto, elementi: readonly string[]): string[] {
  const voci: { ora: number; chi: string; testo: string }[] = [];
  for (const id of elementi) {
    const e = regole.elementi.get(id);
    const v = stato.elementi[id]?.variante;
    if (!e || !v) continue;
    const c = [...e.cicli].sort((x, y) => minutiNotte(formattaOra(x.ora)) - minutiNotte(formattaOra(y.ora))).find((x) => x.da === v);
    if (c) voci.push({ ora: c.ora, chi: c.chi, testo: c.testo });
  }
  // dal mattino in avanti: 05:30 → 0
  const dalMattino = (m: number) => (m - ORARI.alba + 1440) % 1440;
  voci.sort((a, b) => dalMattino(a.ora) - dalMattino(b.ora));
  const viste = new Set<string>();
  const out: string[] = [];
  for (const v of voci) {
    const k = `${v.chi}@${v.ora}`;
    if (viste.has(k)) continue;
    viste.add(k);
    // dopo i due punti la minuscola, ma non per i nomi propri («Nando», «Ottavio»)
    const articolo = /^(Il|Lo|La|I|Gli|Le|L'|Un|Uno|Una|Un')\b/.test(v.testo);
    const testo = articolo ? v.testo.charAt(0).toLowerCase() + v.testo.slice(1) : v.testo;
    out.push(riempi(regole.testi.prossimaFinestra, { ora: formattaOra(v.ora), testo }));
  }
  return out;
}

/** Costruisce il resoconto dalla notte appena finita (lo stato è già quello del mattino). */
export function costruisciResoconto(stato: StatoCatasto, regole: RegoleCatasto, n: NotteInCorso, effetti: string[]): Resoconto {
  const cambiamenti = [...n.cambiamenti].sort((a, b) => minutiNotte(formattaOra(a.ora)) - minutiNotte(formattaOra(b.ora)));
  const righe: RigaResoconto[] = [];
  for (const c of cambiamenti) {
    const r = rigaDaCambiamento(regole, c);
    if (r) righe.push(r);
  }
  for (const sv of n.salvati) {
    const e = regole.elementi.get(sv.elemento);
    if (!e) continue;
    const es = stato.elementi[sv.elemento];
    if (sv.motivo === 'rilevato') {
      if (es && !es.rimastaSegnalata) {
        es.rimastaSegnalata = true;
        righe.push({ colore: 'verde', testo: riempi(regole.testi.rilevataRimasta, { nome: e.nome }), motivo: 'Misurata: è rimasta.', regola: 3, elemento: e.id, particelle: [...e.particelle] });
      }
    } else if (sv.motivo === 'elvira') {
      righe.push({ colore: 'grigio', testo: riempi(regole.testi.vegliata, { nome: e.nome }), motivo: 'Elvira era lì: le Fade non toccano la particella dove si trova.', regola: 4, elemento: e.id, particelle: [...e.particelle] });
    } else if (sv.motivo === 'protetta') {
      righe.push({ colore: 'verde', testo: riempi(regole.testi.protetta, { nome: e.nome }), motivo: 'Protetta: è rimasta.', regola: 3, elemento: e.id, particelle: [...e.particelle] });
    }
  }
  const rosse = righe.filter((r) => r.colore === 'rosso');
  const altre = righe.filter((r) => r.colore !== 'rosso');
  const quieta = rosse.length === 0;
  const cambiatiElementi = [...new Set(cambiamenti.filter((c) => c.tipo === 'variante' && c.elemento).map((c) => c.elemento!))];
  const finestre = [...prossimeFinestre(stato, regole, cambiatiElementi), ...(n.input.prossimeFinestreExtra ?? [])];
  const particelleCambiate = [...new Set(cambiamenti.flatMap((c) => c.particelle))].sort((a, b) => a - b);
  const cronologia: VoceCronologia[] = [...n.cronologia].sort((a, b) => minutiNotte(a.ora) - minutiNotte(b.ora));
  return {
    notte: n.numero,
    giorno: n.giorno,
    titolo: regole.testi.titolo,
    quieta,
    righe: [...rosse, ...altre],
    prossimeFinestre: finestre,
    testo: [...(quieta ? [regole.testi.nessunCambiamento] : rosse.map((r) => r.testo)), ...altre.map((r) => r.testo)],
    particelleCambiate,
    cambiamenti,
    cronologia,
    effetti,
  };
}

/** Il resoconto come testo unico, per il Taccuino o per i log. */
export function testoResoconto(r: Resoconto): string {
  return [r.titolo, ...r.testo, ...r.prossimeFinestre].join('\n');
}
