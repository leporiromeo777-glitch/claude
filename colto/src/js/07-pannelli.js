// Pannelli a comparsa: «Esplora» (categorie, libri, ricerca) e «Il tuo percorso».

let pannello = null;
let fermoPrima = false; // il video era già in pausa quando si è aperto il pannello
const pannelloAperto = () => !!pannello;
const corpoPannello = $('#pannello-corpo');

const piatto = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const idee = (n) => (n === 1 ? '1 idea' : `${n} idee`);

const LIBRI = (() => {
  const mappa = new Map();
  for (const v of VIDEO) {
    const k = v.libro.titolo;
    if (!mappa.has(k)) mappa.set(k, { titolo: k, autore: v.libro.autore, cerca: piatto(`${k} ${v.libro.autore} ${v.libro.titoloOriginale || ''}`), n: 0 });
    mappa.get(k).n++;
  }
  return [...mappa.values()].sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'));
})();

function apriPannello(quale) {
  if (!pannello) fermoPrima = !!stato.attivo?.riproduttore?.inPausa;
  pannello = quale;
  app.classList.add('con-pannello');
  stato.attivo?.riproduttore?.pausa(true);
  if (quale === 'esplora') disegnaEsplora(); else disegnaPercorso();
  corpoPannello.scrollTop = 0;
  $('#pannello-chiudi').focus({ preventScroll: true });
}

function chiudiPannello() {
  if (!pannello) return;
  pannello = null;
  app.classList.remove('con-pannello');
  if (!fermoPrima) stato.attivo?.riproduttore?.pausa(false);
  fermoPrima = false;
}

const rigaLibro = (l) => `<li><button type="button" class="libro" data-libro="${esc(l.titolo)}"><b>${esc(tipografia(l.titolo))}</b><span>${esc(l.autore)}</span><em>${idee(l.n)}</em></button></li>`;

function disegnaEsiti(domanda) {
  const q = piatto(domanda.trim());
  const esiti = $('#esiti');
  if (!q) {
    const conta = {};
    VIDEO.forEach((v) => { conta[v.categoria] = (conta[v.categoria] || 0) + 1; });
    const salvati = Object.keys(memoria.salvati).filter((id) => PER_ID.has(id)).length;
    esiti.innerHTML = `
      <div class="raccolte">
        <button type="button" class="raccolta" data-raccolta="tutti"><b>Per te</b><span>${idee(VIDEO.length)}, prima le nuove</span></button>
        <button type="button" class="raccolta" data-raccolta="salvati"><b>Salvati</b><span>${salvati ? idee(salvati) : 'Ancora niente'}</span></button>
      </div>
      <h3 class="sezione">Categorie</h3>
      <div class="categorie">${CATEGORIE.filter((c) => conta[c.id]).map((c) =>
        `<button type="button" class="categoria" data-cat="${c.id}" style="--bg:${c.bg};--ink:${c.ink}"><b>${esc(c.nome)}</b><span>${idee(conta[c.id])}</span></button>`).join('')}</div>
      <h3 class="sezione"><span>Libri</span><span>${LIBRI.length}</span></h3>
      <ul class="libri">${LIBRI.map(rigaLibro).join('')}</ul>`;
    return;
  }
  const libri = LIBRI.filter((l) => l.cerca.includes(q));
  const video = VIDEO.filter((v) => piatto(v.titolo).includes(q)).slice(0, 30);
  if (!libri.length && !video.length) {
    esiti.innerHTML = `<p class="vuoto">Nessun risultato per «${esc(domanda.trim())}». Prova con un autore o con il titolo originale.</p>`;
    return;
  }
  esiti.innerHTML = `
    ${libri.length ? `<h3 class="sezione"><span>Libri</span><span>${libri.length}</span></h3><ul class="libri">${libri.map(rigaLibro).join('')}</ul>` : ''}
    ${video.length ? `<h3 class="sezione"><span>Idee</span><span>${video.length}</span></h3><ul class="libri">${video.map((v) =>
      `<li><button type="button" class="libro" data-video="${v.id}"><b>${esc(tipografia(v.titolo))}</b><span>${esc(v.libro.titolo)} · ${esc(v.libro.autore)}</span></button></li>`).join('')}</ul>` : ''}`;
}

function disegnaEsplora() {
  $('#pannello-titolo').textContent = 'Esplora';
  corpoPannello.innerHTML = `
    <label class="ricerca" for="cerca">${ICONE.cerca}<input id="cerca" type="search" autocomplete="off" enterkeyhint="search" placeholder="Cerca un libro, un autore, un’idea" aria-label="Cerca un libro, un autore, un’idea"></label>
    <div id="esiti"></div>`;
  $('#cerca').addEventListener('input', (ev) => disegnaEsiti(ev.target.value));
  disegnaEsiti('');
}

function disegnaPercorso() {
  $('#pannello-titolo').textContent = 'Il tuo percorso';
  const visti = Object.keys(memoria.visti).filter((id) => PER_ID.has(id));
  const libri = new Set(visti.map((id) => PER_ID.get(id).libro.titolo));
  const fila = giorniDiFila();
  const righe = CATEGORIE.map((c) => {
    const suoi = VIDEO.filter((v) => v.categoria === c.id);
    if (!suoi.length) return '';
    const fatti = suoi.filter((v) => memoria.visti[v.id]).length;
    return `<li><button type="button" class="progresso" data-cat="${c.id}">
        <span class="pr-nome">${esc(c.nome)}</span><span class="pr-num">${fatti} di ${suoi.length}</span>
        <span class="pr-barra"><i style="width:${(fatti / suoi.length) * 100}%"></i></span>
      </button></li>`;
  }).join('');
  const punti = memoria.punti || 0;
  const liv = livelloDi(punti);
  const oggiFatti = Math.min(vistiOggi(), OBIETTIVO);
  const mancano = liv.a - punti;
  corpoPannello.innerHTML = `
    <div class="livello">
      <p class="livello-nome"><span>Livello ${liv.n}</span><b>${esc(liv.nome)}</b></p>
      <div class="livello-barra" role="img" aria-label="${punti} punti, ne mancano ${mancano} al livello ${liv.n + 1}"><i style="width:${((punti - liv.da) / (liv.a - liv.da)) * 100}%"></i></div>
      <p class="piccolo">${formatta(punti)} punti · ancora ${mancano} per il livello ${liv.n + 1}</p>
    </div>
    <div class="cifre">
      <div><b>${oggiFatti}<small>/${OBIETTIVO}</small></b><span>${oggiFatti >= OBIETTIVO ? 'obiettivo di oggi fatto' : 'idee nuove oggi'}</span></div>
      <div><b>${fila}</b><span>${fila === 1 ? 'giorno' : 'giorni'} di fila</span></div>
      <div><b>${memoria.serie || 0}</b><span>quiz giusti di fila</span></div>
    </div>
    <p class="piccolo">${PUNTI_VIDEO} punti per ogni video nuovo visto fino in fondo, ${PUNTI_QUIZ} per ogni quiz azzeccato al primo colpo, 20 quando chiudi l’obiettivo del giorno.</p>
    <h3 class="sezione"><span>Idee viste</span><span>${visti.length} di ${VIDEO.length} · ${libri.size} libri su ${LIBRI.length}</span></h3>
    <ul class="progressi">${righe}</ul>
    <p class="piccolo">Punti e progressi restano su questo dispositivo.</p>
    <button type="button" class="tasto tasto--solo" id="azzera">Azzera i progressi</button>`;
}

corpoPannello.addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.dataset.raccolta) return impostaFiltro({ tipo: b.dataset.raccolta });
  if (b.dataset.cat) return impostaFiltro({ tipo: 'categoria', valore: b.dataset.cat });
  if (b.dataset.libro) return impostaFiltro({ tipo: 'libro', valore: b.dataset.libro });
  if (b.dataset.video) {
    const v = PER_ID.get(b.dataset.video);
    return impostaFiltro({ tipo: 'libro', valore: v.libro.titolo }, v.id);
  }
  if (b.id === 'azzera') {
    if (b.dataset.sicuro) {
      Object.assign(memoria, { visti: {}, giorni: [], punti: 0, quiz: {}, serie: 0, bonus: '' });
      ricorda();
      aggiornaCromo();
      disegnaPercorso();
      avviso('Progressi azzerati');
    } else {
      b.dataset.sicuro = '1';
      b.textContent = 'Tocca ancora per confermare';
    }
  }
});
