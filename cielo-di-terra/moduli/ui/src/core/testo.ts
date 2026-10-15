/**
 * Testo con un markup minimo, trasformato in nodi DOM (mai innerHTML: i testi arrivano dai contenuti).
 *
 *   [[asse|il Fuso]]   parola tecnica barrata con accanto la parola locale
 *   *parola*           corsivo
 *   riga vuota         nuovo paragrafo
 *   a capo singolo     <br>
 */

export type PezzoTesto =
  | { tipo: 'testo'; testo: string }
  | { tipo: 'corsivo'; testo: string }
  | { tipo: 'parola'; tecnica: string; locale: string }
  | { tipo: 'acapo' };

const RE_PEZZI = /\[\[([^|\]]+)\|([^\]]+)\]\]|\*([^*\n]+)\*|\n/g;

/** Scompone una riga di testo nei suoi pezzi. */
export function analizzaTesto(testo: string): PezzoTesto[] {
  const fuori: PezzoTesto[] = [];
  let ultimo = 0;
  for (const m of testo.matchAll(RE_PEZZI)) {
    const i = m.index ?? 0;
    if (i > ultimo) fuori.push({ tipo: 'testo', testo: testo.slice(ultimo, i) });
    if (m[1] !== undefined && m[2] !== undefined) fuori.push({ tipo: 'parola', tecnica: m[1].trim(), locale: m[2].trim() });
    else if (m[3] !== undefined) fuori.push({ tipo: 'corsivo', testo: m[3] });
    else fuori.push({ tipo: 'acapo' });
    ultimo = i + m[0].length;
  }
  if (ultimo < testo.length) fuori.push({ tipo: 'testo', testo: testo.slice(ultimo) });
  return fuori;
}

/** Testo senza markup (per lettori di schermo, ricerche, lunghezze). */
export function testoSemplice(testo: string): string {
  return analizzaTesto(testo)
    .map((p) => (p.tipo === 'parola' ? p.locale : p.tipo === 'acapo' ? '\n' : p.testo))
    .join('');
}

/** Crea i nodi di una riga (senza paragrafi). */
export function nodiTesto(testo: string, doc: Document = document): DocumentFragment {
  const frammento = doc.createDocumentFragment();
  for (const p of analizzaTesto(testo)) {
    if (p.tipo === 'testo') frammento.append(doc.createTextNode(p.testo));
    else if (p.tipo === 'corsivo') {
      const em = doc.createElement('em');
      em.textContent = p.testo;
      frammento.append(em);
    } else if (p.tipo === 'acapo') frammento.append(doc.createElement('br'));
    else frammento.append(parolaBarrata(p.tecnica, p.locale, doc));
  }
  return frammento;
}

/** «asse» barrato, accanto «il Fuso». */
export function parolaBarrata(tecnica: string, locale: string, doc: Document = document): HTMLElement {
  const span = doc.createElement('span');
  span.className = 'ui-parola';
  const s = doc.createElement('s');
  s.textContent = tecnica;
  const sr = doc.createElement('span');
  sr.className = 'ui-sr';
  sr.textContent = ' (parola tecnica barrata; si dice) ';
  const b = doc.createElement('b');
  b.textContent = locale;
  span.append(s, sr, b);
  return span;
}

/** Divide in paragrafi (righe vuote) e restituisce un elemento <p> per ciascuno. */
export function paragrafi(testo: string, doc: Document = document): HTMLParagraphElement[] {
  return testo
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const p = doc.createElement('p');
      p.append(nodiTesto(t, doc));
      return p;
    });
}
