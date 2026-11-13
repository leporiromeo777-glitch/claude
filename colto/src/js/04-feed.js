// Il feed verticale: una clip per video, quella al centro dello schermo viene riprodotta.

const app = $('#app');
const feed = $('#feed');
const stato = { filtro: { tipo: 'tutti' }, lista: [], attivo: null };
let osservaVicini = null;
let osservaAttivo = null;

function alterna(lista) {
  const resto = lista.slice();
  const esito = [];
  while (resto.length) {
    const ultimo = esito[esito.length - 1];
    let k = ultimo ? resto.findIndex((v) => v.categoria !== ultimo.categoria && v.libro.titolo !== ultimo.libro.titolo) : 0;
    if (k < 0) k = resto.findIndex((v) => v.libro.titolo !== ultimo.libro.titolo);
    if (k < 0) k = 0;
    esito.push(resto.splice(k, 1)[0]);
  }
  return esito;
}

// «Per te»: prima le idee non ancora viste, con un po' più di spazio alle categorie che ti piacciono.
function ordinePerTe() {
  const rnd = casuale((seme(oggi()) ^ Math.floor(Math.random() * 2 ** 31)) >>> 0);
  const gusti = {};
  for (const id of Object.keys(memoria.piaciuti)) {
    const v = PER_ID.get(id);
    if (v) gusti[v.categoria] = (gusti[v.categoria] || 0) + 1;
  }
  const peso = (v) => rnd() - 0.12 * Math.min(gusti[v.categoria] || 0, 3);
  const ordina = (lista) => alterna(lista.map((v) => [peso(v), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]));
  return [...ordina(VIDEO.filter((v) => !memoria.visti[v.id])), ...ordina(VIDEO.filter((v) => memoria.visti[v.id]))];
}

function listaPerFiltro() {
  const f = stato.filtro;
  if (f.tipo === 'categoria') {
    // dentro una categoria i libri si alternano, e le idee già viste vanno in fondo
    const suoi = alterna(mescola(VIDEO.filter((v) => v.categoria === f.valore), casuale(seme(oggi() + f.valore))));
    return [...suoi.filter((v) => !memoria.visti[v.id]), ...suoi.filter((v) => memoria.visti[v.id])];
  }
  if (f.tipo === 'libro') return VIDEO.filter((v) => v.libro.titolo === f.valore);
  if (f.tipo === 'salvati') {
    return Object.entries(memoria.salvati).sort((a, b) => b[1] - a[1]).map(([id]) => PER_ID.get(id)).filter(Boolean);
  }
  return ordinePerTe();
}

function etichettaFiltro() {
  const f = stato.filtro;
  if (f.tipo === 'categoria') return CAT[f.valore].nome;
  if (f.tipo === 'libro') return f.valore;
  if (f.tipo === 'salvati') return 'Salvati';
  return 'Per te';
}

function coloriClip(nodo, cat) {
  nodo.style.setProperty('--bg', cat.bg);
  nodo.style.setProperty('--ink', cat.ink);
  nodo.style.setProperty('--acc', cat.accento);
  nodo.style.setProperty('--su', cat.suAccento);
}

function creaClip(video) {
  const clip = crea('section', 'clip');
  clip.dataset.id = video.id;
  coloriClip(clip, CAT[video.categoria]);
  clip.innerHTML = '<div class="palco"></div>';
  return clip;
}

function idrata(clip) {
  if (clip.dataset.pronta) return;
  const video = PER_ID.get(clip.dataset.id);
  if (!video) return;
  clip.dataset.pronta = '1';
  const palco = $('.palco', clip);
  const forme = formeVideo(video);
  const posa = disposizione(video, 0);
  const l = video.libro;
  const bottone = (classe, icona, nome, premuto) =>
    `<button type="button" class="az az--${classe}" ${premuto === undefined ? '' : `aria-pressed="${premuto}"`} aria-label="${nome}">${icona}<span>${nome}</span></button>`;
  palco.innerHTML = `
    <div class="forme" aria-hidden="true">${forme.map((f, k) => `<i class="f f--${f}" style="transform:${posa[k]}"></i>`).join('')}</div>
    <div class="scene"></div>
    <div class="pausa" aria-hidden="true">${ICONE.play}</div>
    <div class="piede">
      <div class="didascalia">
        <p class="did-titolo">${esc(tipografia(video.titolo))}</p>
        <p class="did-libro"><i>${esc(tipografia(l.titolo))}</i> · ${esc(l.autore)}</p>
      </div>
      <div class="avanzamento" aria-hidden="true"></div>
    </div>
    <div class="azioni">
      ${bottone('piace', ICONE.cuore, 'Mi piace', !!memoria.piaciuti[video.id])}
      ${bottone('salva', ICONE.segnalibro, 'Salva', !!memoria.salvati[video.id])}
      ${bottone('condividi', ICONE.condividi, 'Invia')}
      ${voce.ok ? bottone('voce', ICONE.muto, 'Voce', voce.attiva) : ''}
    </div>`;
  const primo = creaScena(video.scene[0], video, 0);
  primo.classList.add('fermo');
  $('.scene', palco).append(primo);
  adatta(primo);
  if (voce.attiva) aggiornaVoce(clip);
}

function creaClipFinale() {
  const clip = crea('section', 'clip clip--fine');
  const f = stato.filtro;
  const vuoto = !stato.lista.length;
  let titolo = 'Per ora è tutto.';
  let testo = 'Hai scorso tutte le idee di questa raccolta. Le ritrovi quando vuoi, oppure cambia argomento.';
  if (vuoto && f.tipo === 'salvati') {
    titolo = 'Ancora nessuna idea salvata.';
    testo = 'Tocca il segnalibro accanto a un video per ritrovarlo qui.';
  }
  clip.innerHTML = `<div class="palco"><div class="fine">
      <p class="etichetta">${esc(etichettaFiltro())}</p>
      <h2 class="titolo">${titolo}</h2>
      <p class="paragrafo">${testo}</p>
      <div class="fine-azioni">
        ${vuoto ? '' : '<button type="button" class="tasto" data-fa="inizio">Torna all’inizio</button>'}
        ${f.tipo === 'tutti' ? '' : '<button type="button" class="tasto" data-fa="per-te">Vai a Per te</button>'}
        <button type="button" class="tasto tasto--pieno" data-fa="esplora">Esplora i libri</button>
      </div>
    </div></div>`;
  return clip;
}

function costruisciFeed(idIniziale) {
  disattiva();
  osservaVicini?.disconnect();
  osservaAttivo?.disconnect();
  let lista = listaPerFiltro();
  if (idIniziale && PER_ID.has(idIniziale)) {
    const scelto = PER_ID.get(idIniziale);
    lista = [scelto, ...lista.filter((v) => v !== scelto)];
  }
  stato.lista = lista;
  feed.innerHTML = '';
  const pezzi = document.createDocumentFragment();
  lista.forEach((v) => pezzi.append(creaClip(v)));
  pezzi.append(creaClipFinale());
  feed.append(pezzi);
  feed.scrollTop = 0;

  osservaVicini = new IntersectionObserver((voci) => {
    voci.forEach((v) => { if (v.isIntersecting) idrata(v.target); });
  }, { root: feed, rootMargin: '160% 0px' });
  osservaAttivo = new IntersectionObserver((voci) => {
    voci.forEach((v) => { if (v.isIntersecting && v.intersectionRatio >= 0.6) attiva(v.target); });
  }, { root: feed, threshold: [0.6] });
  $$('.clip', feed).forEach((c) => { osservaVicini.observe(c); osservaAttivo.observe(c); });

  $('#filtro-nome').textContent = etichettaFiltro();
  const prima = feed.firstElementChild;
  idrata(prima);
  attiva(prima);
}

function disattiva() {
  const a = stato.attivo;
  if (!a) return;
  a.riproduttore?.smonta();
  a.clip.classList.remove('clip--attiva');
  stato.attivo = null;
}

function attiva(clip) {
  if (stato.attivo?.clip === clip) return;
  disattiva();
  const video = PER_ID.get(clip.dataset.id);
  clip.classList.add('clip--attiva');
  const cat = video ? CAT[video.categoria] : null;
  if (cat) coloriClip(app, cat);
  else ['--bg', '--ink', '--acc', '--su'].forEach((p) => app.style.removeProperty(p));
  stato.attivo = { clip, video, riproduttore: null };
  if (!video) return;
  idrata(clip);
  const r = new Riproduttore(clip, video, (v) => { segnaVisto(v.id); aggiornaCromo(); });
  stato.attivo.riproduttore = r;
  r.monta();
  if (pannelloAperto()) r.pausa(true);
  try { history.replaceState(null, '', '#' + video.id); } catch (e) { /* niente */ }
}

function vaiAClip(passi) {
  const clip = stato.attivo?.clip;
  const meta = passi > 0 ? clip?.nextElementSibling : clip?.previousElementSibling;
  if (meta) meta.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function aggiornaCromo() {
  $('#oggi-numero').textContent = vistiOggi();
}

function aggiornaVoce(radice = feed) {
  $$('.az--voce', radice).forEach((b) => {
    b.setAttribute('aria-pressed', voce.attiva);
    b.firstElementChild.outerHTML = voce.attiva ? ICONE.voce : ICONE.muto;
  });
}

let avvisoTimer = 0;
function avviso(testo, durata = 2600) {
  const a = $('#avviso');
  a.textContent = testo;
  a.classList.add('visibile');
  clearTimeout(avvisoTimer);
  avvisoTimer = setTimeout(() => a.classList.remove('visibile'), durata);
}

function alternaSegno(video, quale, forza) {
  const registro = memoria[quale];
  const nuovo = forza ?? !registro[video.id];
  if (nuovo) registro[video.id] = Date.now(); else delete registro[video.id];
  ricorda();
  const classe = quale === 'piaciuti' ? 'piace' : 'salva';
  $$(`.clip[data-id="${video.id}"] .az--${classe}`, feed).forEach((b) => {
    b.setAttribute('aria-pressed', nuovo);
    if (nuovo) { b.classList.remove('scatto'); void b.offsetWidth; b.classList.add('scatto'); }
  });
  return nuovo;
}

async function condividi(video) {
  const testo = `«${video.titolo}»: un’idea da ${video.libro.titolo} di ${video.libro.autore}.`;
  const inCornice = window.self !== window.top;
  const url = !inCornice && /^https?:$/.test(location.protocol) ? `${location.origin}${location.pathname}#${video.id}` : '';
  if (!inCornice && navigator.share) {
    try { await navigator.share({ title: 'Colto', text: testo, ...(url ? { url } : {}) }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url ? `${testo}\n${url}` : testo);
    avviso('Copiato: incollalo dove vuoi');
  } catch (e) {
    avviso(testo, 7000);
  }
}

function cuoreVolante(palco, x, y) {
  const c = crea('div', 'cuore-volante', ICONE.cuore);
  const r = palco.getBoundingClientRect();
  c.style.left = `${x - r.left}px`;
  c.style.top = `${y - r.top}px`;
  palco.append(c);
  setTimeout(() => c.remove(), 900);
}

let tocco = { t: 0, timer: 0 };
feed.addEventListener('click', (ev) => {
  const clip = ev.target.closest('.clip');
  if (!clip) return;
  const fa = ev.target.closest('[data-fa]')?.dataset.fa;
  if (fa === 'inizio') return feed.scrollTo({ top: 0, behavior: 'smooth' });
  if (fa === 'per-te') return impostaFiltro({ tipo: 'tutti' });
  if (fa === 'esplora') return apriPannello('esplora');

  const video = PER_ID.get(clip.dataset.id);
  if (!video) return;
  const az = ev.target.closest('.az');
  if (az) {
    if (az.classList.contains('az--piace')) alternaSegno(video, 'piaciuti');
    else if (az.classList.contains('az--salva')) avviso(alternaSegno(video, 'salvati') ? 'Salvato: lo trovi in Esplora › Salvati' : 'Tolto dai salvati');
    else if (az.classList.contains('az--condividi')) condividi(video);
    else if (az.classList.contains('az--voce')) {
      if (!voce.attiva && voce.senzaItaliano()) return avviso('Su questo dispositivo non c’è una voce italiana.', 3600);
      voce.attiva = !voce.attiva;
      aggiornaVoce();
      const r = stato.attivo?.riproduttore;
      if (voce.attiva && r) voce.di(testoVoce(r.video.scene[r.i]));
      else voce.zitta();
      avviso(voce.attiva ? 'Voce accesa' : 'Voce spenta', 1400);
    }
    return;
  }
  const attivo = stato.attivo?.clip === clip ? stato.attivo.riproduttore : null;
  const opzione = ev.target.closest('.opzione');
  if (opzione) { attivo?.rivela(Number(opzione.dataset.i)); return; }
  if (ev.target.closest('button, a, input')) return;

  // Un tocco ferma o riprende, due tocchi vicini mettono «mi piace».
  const ora = performance.now();
  if (ora - tocco.t < 300) {
    clearTimeout(tocco.timer);
    tocco.t = 0;
    alternaSegno(video, 'piaciuti', true);
    cuoreVolante($('.palco', clip), ev.clientX, ev.clientY);
  } else {
    tocco.t = ora;
    tocco.timer = setTimeout(() => attivo?.pausa(), 300);
  }
});

function impostaFiltro(filtro, idIniziale) {
  stato.filtro = filtro;
  chiudiPannello();
  costruisciFeed(idIniziale);
}
