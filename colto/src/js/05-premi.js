// Punti, livelli, obiettivo del giorno e piccole feste: la ricompensa per chi arriva in fondo e risponde.

const OBIETTIVO = 5;        // idee al giorno
const PUNTI_VIDEO = 10;
const PUNTI_QUIZ = 5;
const SERIE_PREMIATE = [3, 5, 10, 20, 30, 50];
const NOMI_LIVELLO = ['Curioso', 'Sveglio', 'Lettore', 'Brillante', 'Acuto', 'Sapiente', 'Erudito', 'Maestro', 'Saggio', 'Colto'];

// Punti che servono per arrivare al livello n: ogni livello costa 20 punti più del precedente.
const sogliaLivello = (n) => 40 * (n - 1) + 10 * (n - 1) * n;
function livelloDi(punti) {
  let n = 1;
  while (sogliaLivello(n + 1) <= punti) n++;
  const oltre = n - NOMI_LIVELLO.length;
  const nome = oltre > 0 ? `Colto ${'I'.repeat(Math.min(oltre + 1, 3))}${oltre > 2 ? '+' : ''}` : NOMI_LIVELLO[n - 1];
  return { n, nome, da: sogliaLivello(n), a: sogliaLivello(n + 1) };
}

function coriandoli(palco, quanti = 26, x = 50, y = 46) {
  if (!palco || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nido = crea('div', 'coriandoli');
  nido.style.left = `${x}%`;
  nido.style.top = `${y}%`;
  for (let i = 0; i < quanti; i++) {
    const c = document.createElement('i');
    const angolo = Math.random() * Math.PI * 2;
    const forza = 18 + Math.random() * 34;
    c.style.setProperty('--dx', `${(Math.cos(angolo) * forza).toFixed(1)}cqw`);
    c.style.setProperty('--dy', `${(Math.sin(angolo) * forza - 14).toFixed(1)}cqw`);
    c.style.setProperty('--giro', `${Math.round(Math.random() * 720 - 360)}deg`);
    c.style.setProperty('--tinta', ['var(--acc)', 'var(--ink)', 'var(--su)'][i % 3]);
    c.style.animationDelay = `${Math.round(Math.random() * 90)}ms`;
    if (i % 4 === 0) c.style.borderRadius = '50%';
    nido.append(c);
  }
  palco.append(nido);
  setTimeout(() => nido.remove(), 1500);
}

function puntiVolanti(palco, testo) {
  if (!palco) return;
  const v = crea('div', 'punti-volanti', `${ICONE.lampo}<b>${esc(testo)}</b>`);
  palco.append(v);
  setTimeout(() => v.remove(), 1300);
}

let stendardoTimer = 0;
function stendardo(titolo, sotto) {
  const s = $('#stendardo');
  s.innerHTML = `<span>${esc(sotto)}</span><b>${esc(titolo)}</b>`;
  s.classList.remove('visibile');
  void s.offsetWidth;
  s.classList.add('visibile');
  clearTimeout(stendardoTimer);
  stendardoTimer = setTimeout(() => s.classList.remove('visibile'), 3000);
}

function daiPunti(n, palco) {
  const prima = livelloDi(memoria.punti || 0);
  memoria.punti = (memoria.punti || 0) + n;
  ricorda();
  aggiornaCromo(true);
  puntiVolanti(palco, `+${n}`);
  const dopo = livelloDi(memoria.punti);
  if (dopo.n > prima.n) {
    setTimeout(() => {
      stendardo(`Livello ${dopo.n}: ${dopo.nome}`, 'Sei salito di livello');
      coriandoli(palco, 40);
      suono.festa();
      vibra([20, 40, 30]);
    }, 900);
  }
}

// Un video arrivato in fondo per la prima volta.
function premiaVideo(video, palco) {
  suono.fine();
  vibra(15);
  daiPunti(PUNTI_VIDEO, palco);
  if (vistiOggi() >= OBIETTIVO && memoria.bonus !== oggi()) {
    memoria.bonus = oggi();
    ricorda();
    setTimeout(() => {
      daiPunti(20, palco);
      stendardo('Obiettivo di oggi raggiunto', `${OBIETTIVO} idee nuove · +20 punti`);
      coriandoli(palco, 40);
      suono.festa();
    }, 1100);
  }
}

// Una risposta data toccando (non quando il quiz si svela da solo). I punti valgono solo la prima volta.
function premiaQuiz(video, giusta, palco) {
  if (giusta) { suono.giusto(); vibra(12); coriandoli(palco, 14, 42, 52); } else { suono.sbagliato(); vibra([30, 40, 30]); }
  if (memoria.quiz[video.id] !== undefined) return;
  memoria.quiz[video.id] = giusta ? 1 : 0;
  if (!giusta) { memoria.serie = 0; ricorda(); return; }
  memoria.serie = (memoria.serie || 0) + 1;
  daiPunti(PUNTI_QUIZ, palco);
  if (SERIE_PREMIATE.includes(memoria.serie)) {
    const serie = memoria.serie;
    setTimeout(() => {
      daiPunti(10, palco);
      stendardo(`${serie} risposte giuste di fila`, 'Serie · +10 punti');
    }, 800);
  }
}
