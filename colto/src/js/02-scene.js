// Ogni video è una lista di scene: qui si trasformano in HTML, con durata e testo per la voce.

function annoLeggibile(anno) {
  if (anno < 0) return `${-anno} a.C.`;
  if (anno < 1000) return `${anno} d.C.`;
  return String(anno);
}

function testoVoce(sc) {
  const p = (...parti) => parti.filter(Boolean).map(senzaSegni).join('. ');
  switch (sc.tipo) {
    case 'apertura': case 'principio': case 'colpo': return p(sc.testo);
    case 'testo': return p(sc.titolo, sc.testo);
    case 'elenco': return p(sc.titolo, ...sc.voci);
    case 'numero': return p(`${sc.prefisso || ''}${formatta(sc.valore, sc.decimali || 0)}${sc.suffisso || ''}`, sc.didascalia);
    case 'confronto': return p(sc.titolo, sc.a.etichetta, ...sc.a.voci, sc.b.etichetta, ...sc.b.voci);
    case 'grafico': return p(sc.titolo, sc.nota);
    case 'esempio': return p('Esempio', sc.testo);
    case 'quiz': return p(sc.domanda, ...sc.opzioni);
    case 'mito': return p(`Si dice: ${sc.mito}`);
    case 'chiusura': return p('Da provare oggi', sc.azione);
    default: return '';
  }
}

function svgGrafico(sc) {
  const sx = 8, dx = 92, base = 58, cima = 15;
  const dati = sc.dati;
  const max = Math.max(...dati.map((d) => d.v)) || 1;
  const y = (v) => base - (v / max) * (base - cima);
  const u = sc.unita || '';
  const valore = (v) => compatta(v) + (u ? (/^[%×x°]$/.test(u) ? u : ' ' + u) : '');
  const n = dati.length;
  let corpo = `<line class="g-base" x1="${sx - 3}" y1="${base}" x2="${dx + 3}" y2="${base}"/>`;

  if (sc.forma === 'barre') {
    const banda = (dx - sx) / n;
    const larg = Math.min(banda * 0.62, 17);
    const top = Math.max(...dati.map((d) => d.v));
    const entro = (base, testi) => Math.min(base, (banda * 0.94) / (Math.max(...testi.map((t) => t.length)) * 0.6)).toFixed(2);
    const cAsse = entro(3.5, dati.map((d) => d.e));
    const cVal = entro(4.2, dati.map((d) => valore(d.v)));
    dati.forEach((d, i) => {
      const cx = sx + banda * (i + 0.5);
      const alto = Math.max(base - y(d.v), 0.8);
      corpo += `<rect class="g-barra${d.v === top ? ' g-barra--max' : ''}" style="--d:${350 + i * 260}ms" x="${(cx - larg / 2).toFixed(2)}" y="${(base - alto).toFixed(2)}" width="${larg.toFixed(2)}" height="${alto.toFixed(2)}" rx="0.8"/>`;
      corpo += `<text class="g-val" style="--d:${800 + i * 260}ms;font-size:${cVal}px" x="${cx.toFixed(2)}" y="${(base - alto - 3).toFixed(2)}" text-anchor="middle">${esc(valore(d.v))}</text>`;
      corpo += `<text class="g-asse" style="font-size:${cAsse}px" x="${cx.toFixed(2)}" y="${base + 7.5}" text-anchor="middle">${esc(tipografia(d.e))}</text>`;
    });
  } else {
    const x = (i) => sx + (i * (dx - sx)) / (n - 1);
    const punti = dati.map((d, i) => `${x(i).toFixed(2)} ${y(d.v).toFixed(2)}`);
    corpo += `<path class="g-area" d="M${punti.join(' L')} L${dx} ${base} L${sx} ${base} Z"/>`;
    corpo += `<path class="g-linea" pathLength="1" d="M${punti.join(' L')}"/>`;
    dati.forEach((d, i) => {
      const ancora = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      const mostra = n <= 4 || i === 0 || i === n - 1 || (n % 2 === 1 && i === (n - 1) / 2);
      corpo += `<circle class="g-punto${i === n - 1 ? ' g-punto--fine' : ''}" style="--d:${500 + (i / (n - 1)) * 1500}ms" cx="${x(i).toFixed(2)}" cy="${y(d.v).toFixed(2)}" r="${i === n - 1 ? 2.1 : 1.1}"/>`;
      if (mostra) corpo += `<text class="g-asse" x="${x(i).toFixed(2)}" y="${base + 7.5}" text-anchor="${ancora}">${esc(tipografia(d.e))}</text>`;
    });
    const primo = dati[0], ultimo = dati[n - 1];
    if (primo.v !== ultimo.v) corpo += `<text class="g-val" style="--d:500ms" x="${sx}" y="${(y(primo.v) - 4).toFixed(2)}" text-anchor="start">${esc(valore(primo.v))}</text>`;
    corpo += `<text class="g-val g-val--fine" style="--d:2000ms" x="${dx}" y="${(y(ultimo.v) - 5).toFixed(2)}" text-anchor="end">${esc(valore(ultimo.v))}</text>`;
  }
  const descr = dati.map((d) => `${d.e}: ${valore(d.v)}`).join(', ');
  return `<svg viewBox="0 0 100 70" role="img" aria-label="${esc(sc.titolo + '. ' + descr)}">${corpo}</svg>`;
}

// Ritmi delle parole: i ganci arrivano di colpo, i testi si accendono al passo di chi legge.
const SVELTO = 18;
const LETTURA = 44;

function htmlScena(sc, video) {
  const cat = CAT[video.categoria];
  switch (sc.tipo) {
    case 'apertura':
      return `<p class="etichetta entra" style="--d:0ms">${esc(cat.nome)}</p>
        <h2 class="gancio">${htmlParole(sc.testo, { inizio: 60, ms: SVELTO })}</h2>`;
    case 'colpo':
      return `<p class="pugno">${htmlParole(sc.testo, { inizio: 30, ms: SVELTO })}</p>`;
    case 'testo':
      return `${sc.titolo ? `<h3 class="titolo">${htmlParole(sc.titolo, { ms: SVELTO })}</h3>` : ''}
        <p class="paragrafo">${htmlParole(sc.testo, { inizio: sc.titolo ? 420 : 100, ms: LETTURA, modo: 'k' })}</p>`;
    case 'principio':
      return `<p class="etichetta entra" style="--d:0ms">L’idea in una frase</p>
        <p class="massima">${htmlParole(sc.testo, { inizio: 160, ms: 38 })}</p>`;
    case 'elenco': {
      let attesa = 420;
      const voci = sc.voci.map((v, i) => {
        const li = `<li class="entra" style="--d:${attesa}ms"><span class="segno">${sc.numerato ? String(i + 1) : ''}</span><span>${htmlTesto(v)}</span></li>`;
        attesa += 380 + lunghezza(v) * 34;
        return li;
      }).join('');
      return `<h3 class="titolo">${htmlParole(sc.titolo, { ms: SVELTO })}</h3>
        <ol class="voci${sc.numerato ? ' voci--numerate' : ''}">${voci}</ol>`;
    }
    case 'numero':
      return `<p class="cifra entra" style="--d:0ms">${sc.prefisso ? `<span class="cifra-lato">${esc(sc.prefisso)}</span>` : ''}<span class="cifra-val" data-v="${sc.valore}" data-dec="${sc.decimali || 0}">${formatta(sc.valore, sc.decimali || 0)}</span>${sc.suffisso ? `<span class="cifra-lato">${esc(sc.suffisso)}</span>` : ''}</p>
        <p class="paragrafo">${htmlParole(sc.didascalia, { inizio: 850, ms: LETTURA, modo: 'k' })}</p>
        ${sc.nota ? `<p class="nota entra" style="--d:1500ms">${esc(tipografia(sc.nota))}</p>` : ''}`;
    case 'confronto': {
      const lato = (x, quale, ms) => `<div class="lato lato--${quale} entra" style="--d:${ms}ms">
          <p class="etichetta">${esc(tipografia(x.etichetta))}</p>
          <ul>${x.voci.map((v) => `<li>${htmlTesto(v)}</li>`).join('')}</ul>
        </div>`;
      const primo = sc.titolo ? 300 : 80;
      const dopo = primo + 750 + somma(sc.a.voci) * 26;
      return `${sc.titolo ? `<h3 class="titolo">${htmlParole(sc.titolo, { ms: SVELTO })}</h3>` : ''}
        <div class="lati">${lato(sc.a, 'a', primo)}${lato(sc.b, 'b', dopo)}</div>`;
    }
    case 'grafico':
      return `<h3 class="titolo titolo--piccolo">${htmlParole(sc.titolo, { ms: SVELTO })}</h3>
        <div class="grafico entra" style="--d:200ms">${svgGrafico(sc)}</div>
        ${sc.nota ? `<p class="nota entra" style="--d:2100ms">${esc(tipografia(sc.nota))}</p>` : ''}`;
    case 'esempio':
      return `<div class="scheda entra" style="--d:0ms">
          <p class="etichetta">Esempio</p>
          <p class="paragrafo">${htmlParole(sc.testo, { inizio: 260, ms: LETTURA, modo: 'k' })}</p>
        </div>`;
    case 'quiz':
      return `<p class="etichetta entra" style="--d:0ms">Tocca la risposta</p>
        <h3 class="domanda">${htmlParole(sc.domanda, { inizio: 80, ms: 22 })}</h3>
        <div class="opzioni">${sc.opzioni.map((o, i) => `<button type="button" class="opzione entra" style="--d:${520 + i * 160}ms" data-i="${i}"><span class="lettera">${'ABC'[i]}</span><span>${esc(tipografia(o))}</span></button>`).join('')}</div>
        <p class="spiegazione">${esc(tipografia(sc.spiegazione))}</p>`;
    case 'mito':
      return `<div class="mito-detto entra" style="--d:0ms">
          <p class="etichetta">Si dice</p>
          <p class="mito-frase">${esc(tipografia(sc.mito))}</p>
          <span class="timbro" aria-hidden="true">Falso</span>
        </div>
        <div class="mito-vero">
          <p class="etichetta">Secondo il libro</p>
          <p class="mito-realta">${htmlTesto(sc.realta)}</p>
        </div>`;
    case 'chiusura': {
      const l = video.libro;
      return `<p class="etichetta entra" style="--d:0ms">Da provare oggi</p>
        <p class="azione">${htmlParole(sc.azione, { inizio: 120, ms: 26 })}</p>
        <div class="colofone entra" style="--d:${Math.round(500 + lunghezza(sc.azione) * 26)}ms">
          <p class="colofone-da">Dal libro</p>
          <p class="colofone-libro">${esc(tipografia(l.titolo))}</p>
          <p class="colofone-autore">${esc(l.autore)} · ${annoLeggibile(l.anno)}</p>
        </div>`;
    }
    default: return '';
  }
}

function creaScena(sc, video, i) {
  const s = crea('div', `scena scena--${sc.tipo}`, `<div class="corpo">${htmlScena(sc, video)}</div>`);
  s.dataset.i = i;
  return s;
}

// Tre forme geometriche per video: restano le stesse e a ogni scena scivolano in una nuova posizione.
const FORME = ['cerchio', 'anello', 'righe', 'punti', 'mezzo', 'quadro'];
const ZONE = [[88, 14], [104, 48], [2, 86], [-4, 22], [96, 92], [40, 104], [60, -4]];

function formeVideo(video) {
  const rnd = casuale(seme(video.id));
  return mescola(FORME, rnd).slice(0, 3);
}
function disposizione(video, indice) {
  const rnd = casuale(seme(video.id + '#' + indice));
  return mescola(ZONE, rnd).slice(0, 3).map(([x, y]) => {
    const px = x + (rnd() - 0.5) * 14;
    const py = y + (rnd() - 0.5) * 10;
    const scala = 0.7 + rnd() * 0.75;
    const giro = Math.round((rnd() - 0.5) * 8) * 15;
    return `translate(${px.toFixed(1)}cqw, ${py.toFixed(1)}cqh) rotate(${giro}deg) scale(${scala.toFixed(2)})`;
  });
}

// Riduce il testo finché la scena entra nello spazio disponibile.
const SCRITTE_GRANDI = '.pugno, .cifra, .gancio, .titolo, .domanda, .massima, .azione';
function adatta(scena) {
  const corpo = scena.firstElementChild;
  if (!corpo) return;
  // In larghezza: una parola lunga o una cifra larga non devono uscire dallo schermo.
  for (const el of corpo.querySelectorAll(SCRITTE_GRANDI)) {
    el.style.removeProperty('--z');
    if (el.scrollWidth > el.clientWidth + 1) el.style.setProperty('--z', Math.max(0.5, (el.clientWidth / el.scrollWidth) * 0.97).toFixed(3));
  }
  // In altezza: si rimpicciolisce tutto il testo della scena finché entra.
  const stile = getComputedStyle(scena);
  const spazio = scena.clientHeight - parseFloat(stile.paddingTop) - parseFloat(stile.paddingBottom);
  if (spazio <= 0) return;
  let s = 1;
  scena.style.setProperty('--s', 1);
  for (let giro = 0; giro < 7; giro++) {
    const alto = corpo.scrollHeight;
    if (alto <= spazio + 1) break;
    s = Math.max(0.55, s * Math.max(0.8, Math.min(0.96, spazio / alto)));
    scena.style.setProperty('--s', s.toFixed(3));
    if (s <= 0.55) break;
  }
}
