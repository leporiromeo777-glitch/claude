// Ogni video è una lista di scene: qui si trasformano in HTML, con durata e testo per la voce.

const leggi = (caratteri, base = 1600) => Math.max(3200, Math.min(10500, base + caratteri * 56));
const somma = (lista) => lista.reduce((a, t) => a + lunghezza(t), 0);

function durataQuiz(sc) {
  const domanda = leggi(lunghezza(sc.domanda) + somma(sc.opzioni), 3200);
  const risposta = leggi(lunghezza(sc.spiegazione), 2200);
  return { domanda, risposta };
}

function durataScena(sc) {
  switch (sc.tipo) {
    case 'apertura': return leggi(lunghezza(sc.testo), 1900);
    case 'testo': return leggi(lunghezza(sc.titolo) + lunghezza(sc.testo));
    case 'principio': return leggi(lunghezza(sc.testo), 2500);
    case 'elenco': return leggi(lunghezza(sc.titolo) + somma(sc.voci), 1500 + sc.voci.length * 800);
    case 'numero': return leggi(lunghezza(sc.didascalia) + lunghezza(sc.nota), 3300);
    case 'confronto': return leggi(lunghezza(sc.titolo) + somma(sc.a.voci) + somma(sc.b.voci), 3400);
    case 'grafico': return leggi(lunghezza(sc.titolo) + lunghezza(sc.nota), 4200);
    case 'esempio': return leggi(lunghezza(sc.testo), 2000);
    case 'quiz': { const d = durataQuiz(sc); return d.domanda + d.risposta; }
    case 'chiusura': return leggi(lunghezza(sc.azione), 4000);
    default: return 5000;
  }
}

function annoLeggibile(anno) {
  if (anno < 0) return `${-anno} a.C.`;
  if (anno < 1000) return `${anno} d.C.`;
  return String(anno);
}

function testoVoce(sc) {
  const p = (...parti) => parti.filter(Boolean).map(senzaSegni).join('. ');
  switch (sc.tipo) {
    case 'apertura': case 'principio': return p(sc.testo);
    case 'testo': return p(sc.titolo, sc.testo);
    case 'elenco': return p(sc.titolo, ...sc.voci);
    case 'numero': return p(`${sc.prefisso || ''}${formatta(sc.valore, sc.decimali || 0)}${sc.suffisso || ''}`, sc.didascalia);
    case 'confronto': return p(sc.titolo, sc.a.etichetta, ...sc.a.voci, sc.b.etichetta, ...sc.b.voci);
    case 'grafico': return p(sc.titolo, sc.nota);
    case 'esempio': return p('Esempio', sc.testo);
    case 'quiz': return p(sc.domanda, ...sc.opzioni);
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

const entra = (ms) => `class="entra" style="--d:${ms}ms"`;

function htmlScena(sc, video) {
  const cat = CAT[video.categoria];
  switch (sc.tipo) {
    case 'apertura':
      return `<p class="etichetta entra" style="--d:0ms">${esc(cat.nome)}</p>
        <h2 class="gancio">${htmlParole(sc.testo, 75, 180)}</h2>`;
    case 'testo':
      return `${sc.titolo ? `<h3 class="titolo entra" style="--d:0ms">${esc(tipografia(sc.titolo))}</h3>` : ''}
        <p class="paragrafo entra" style="--d:${sc.titolo ? 320 : 0}ms">${htmlTesto(sc.testo)}</p>`;
    case 'principio':
      return `<p class="etichetta entra" style="--d:0ms">L’idea in una frase</p>
        <p class="massima">${htmlParole(sc.testo, 95, 250)}</p>`;
    case 'elenco': {
      let attesa = 550;
      const voci = sc.voci.map((v, i) => {
        const li = `<li ${entra(attesa)}><span class="segno">${sc.numerato ? String(i + 1) : ''}</span><span>${htmlTesto(v)}</span></li>`;
        attesa += 650 + lunghezza(v) * 22;
        return li;
      }).join('');
      return `<h3 class="titolo entra" style="--d:0ms">${esc(tipografia(sc.titolo))}</h3>
        <ol class="voci${sc.numerato ? ' voci--numerate' : ''}">${voci}</ol>`;
    }
    case 'numero':
      return `<p class="cifra entra" style="--d:0ms">${sc.prefisso ? `<span class="cifra-lato">${esc(sc.prefisso)}</span>` : ''}<span class="cifra-val" data-v="${sc.valore}" data-dec="${sc.decimali || 0}">${formatta(sc.valore, sc.decimali || 0)}</span>${sc.suffisso ? `<span class="cifra-lato">${esc(sc.suffisso)}</span>` : ''}</p>
        <p class="paragrafo entra" style="--d:700ms">${htmlTesto(sc.didascalia)}</p>
        ${sc.nota ? `<p class="nota entra" style="--d:1300ms">${esc(tipografia(sc.nota))}</p>` : ''}`;
    case 'confronto': {
      const lato = (x, quale, ms) => `<div class="lato lato--${quale} entra" style="--d:${ms}ms">
          <p class="etichetta">${esc(tipografia(x.etichetta))}</p>
          <ul>${x.voci.map((v) => `<li>${htmlTesto(v)}</li>`).join('')}</ul>
        </div>`;
      const dopo = 1100 + somma(sc.a.voci) * 22;
      return `${sc.titolo ? `<h3 class="titolo entra" style="--d:0ms">${esc(tipografia(sc.titolo))}</h3>` : ''}
        <div class="lati">${lato(sc.a, 'a', 350)}${lato(sc.b, 'b', dopo)}</div>`;
    }
    case 'grafico':
      return `<h3 class="titolo titolo--piccolo entra" style="--d:0ms">${esc(tipografia(sc.titolo))}</h3>
        <div class="grafico entra" style="--d:250ms">${svgGrafico(sc)}</div>
        ${sc.nota ? `<p class="nota entra" style="--d:2300ms">${esc(tipografia(sc.nota))}</p>` : ''}`;
    case 'esempio':
      return `<div class="scheda entra" style="--d:0ms">
          <p class="etichetta">Esempio</p>
          <p class="paragrafo">${htmlTesto(sc.testo)}</p>
        </div>`;
    case 'quiz':
      return `<p class="etichetta entra" style="--d:0ms">Prova tu</p>
        <h3 class="domanda entra" style="--d:150ms">${esc(tipografia(sc.domanda))}</h3>
        <div class="opzioni">${sc.opzioni.map((o, i) => `<button type="button" class="opzione entra" style="--d:${700 + i * 220}ms" data-i="${i}"><span class="lettera">${'ABC'[i]}</span><span>${esc(tipografia(o))}</span></button>`).join('')}</div>
        <p class="spiegazione">${esc(tipografia(sc.spiegazione))}</p>`;
    case 'chiusura': {
      const l = video.libro;
      return `<p class="etichetta entra" style="--d:0ms">Da provare oggi</p>
        <p class="azione">${htmlParole(sc.azione, 70, 200)}</p>
        <div class="colofone entra" style="--d:1600ms">
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
function adatta(scena) {
  const corpo = scena.firstElementChild;
  if (!corpo) return;
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
