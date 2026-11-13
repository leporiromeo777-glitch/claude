// Voce del dispositivo (facoltativa) e riproduttore che fa scorrere le scene di un video.

const voce = {
  ok: typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined',
  attiva: false,
  _scelta: null,
  _corrente: null,
  _finita: true,
  _scegli() {
    const italiane = speechSynthesis.getVoices().filter((v) => /^it([-_]|$)/i.test(v.lang));
    const punti = (v) => (/natural|premium|enhanced|neural|siri/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (/it[-_]IT/i.test(v.lang) ? 1 : 0);
    this._scelta = italiane.sort((a, b) => punti(b) - punti(a))[0] || null;
  },
  // Vero se il dispositivo ha caricato le voci ma nessuna è italiana.
  senzaItaliano() {
    if (!this.ok) return true;
    const tutte = speechSynthesis.getVoices();
    return tutte.length > 0 && !tutte.some((v) => /^it([-_]|$)/i.test(v.lang));
  },
  di(testo) {
    if (!this.ok || !this.attiva || !testo) return;
    try {
      speechSynthesis.cancel();
      if (!this._scelta) this._scegli();
      const u = new SpeechSynthesisUtterance(testo);
      u.lang = 'it-IT';
      if (this._scelta) u.voice = this._scelta;
      u.rate = 1.05;
      this._corrente = u;
      this._finita = false;
      let partita = false;
      u.onstart = () => { partita = true; };
      u.onend = u.onerror = () => { if (this._corrente === u) this._finita = true; };
      speechSynthesis.speak(u);
      // Se dopo due secondi non ha iniziato a parlare, il video non resta ad aspettarla.
      setTimeout(() => { if (!partita && this._corrente === u) this._finita = true; }, 2000);
    } catch (e) { this._finita = true; }
  },
  staParlando() { return this.ok && this.attiva && !this._finita; },
  zitta() {
    this._corrente = null;
    this._finita = true;
    if (this.ok) { try { speechSynthesis.cancel(); } catch (e) { /* niente */ } }
  },
  ferma(si) {
    if (!this.ok || !this.attiva) return;
    try { si ? speechSynthesis.pause() : speechSynthesis.resume(); } catch (e) { /* niente */ }
  },
};

class Riproduttore {
  constructor(clip, video, alTermine) {
    this.clip = clip;
    this.video = video;
    this.alTermine = alTermine;
    this.palco = $('.palco', clip);
    this.scatola = $('.scene', clip);
    this.barra = $('.avanzamento', clip);
    this.forme = $$('.f', clip);
    this.passo = this.passo.bind(this);
  }

  monta() {
    const scene = this.video.scene;
    this.durate = scene.map(durataScena);
    this.nodi = [$('.scena', this.scatola)];
    for (let i = 1; i < scene.length; i++) {
      const nodo = creaScena(scene[i], this.video, i);
      this.scatola.append(nodo);
      this.nodi.push(nodo);
    }
    this.riadatta();
    this.barra.innerHTML = this.durate.map((d) => `<i style="flex-grow:${Math.round(d / 100)}"><b></b></i>`).join('');
    this.segmenti = $$('b', this.barra);
    this.i = -1;
    this.t = 0;
    this.primoGiro = true;
    this.finito = false;
    this.inPausa = false;
    this.attivo = true;
    this.palco.classList.remove('in-pausa');
    this.vai(0);
    this.ultimo = performance.now();
    this.raf = requestAnimationFrame(this.passo);
  }

  smonta() {
    this.attivo = false;
    cancelAnimationFrame(this.raf);
    voce.zitta();
    this.nodi.slice(1).forEach((n) => n.remove());
    const primo = this.nodi[0];
    primo.classList.remove('on', 'esce');
    primo.classList.add('fermo');
    disposizione(this.video, 0).forEach((tr, k) => { this.forme[k].style.transform = tr; });
    this.barra.innerHTML = '';
    this.palco.classList.remove('in-pausa');
  }

  riadatta() { this.nodi.forEach(adatta); }

  passo(ora) {
    if (!this.attivo) return;
    const dt = Math.min(ora - this.ultimo, 100);
    this.ultimo = ora;
    if (!this.inPausa) { this.t += dt; this.aggiorna(); }
    this.raf = requestAnimationFrame(this.passo);
  }

  aggiorna() {
    const sc = this.video.scene[this.i];
    const d = this.durate[this.i];
    if (sc.tipo === 'quiz' && !this.rivelato && this.t >= this.quiz.domanda) this.rivela(null);
    if (this.contatore) {
      const p = Math.max(0, Math.min(1, (this.t - 250) / 1500));
      const morbido = 1 - Math.pow(1 - p, 3);
      this.contatore.textContent = formatta(sc.valore * morbido, sc.decimali || 0);
      if (p >= 1) this.contatore = null;
    }
    this.segmenti[this.i].style.transform = `scaleX(${Math.min(1, this.t / d)})`;
    if (this.t >= d) {
      if (voce.staParlando() && this.t < d + 9000) return; // aspetta che la voce finisca la frase
      this.vai(this.i + 1);
    }
  }

  vai(i) {
    if (i >= this.nodi.length) {
      if (!this.finito) { this.finito = true; this.alTermine?.(this.video); }
      i = 0;
      this.primoGiro = false;
    }
    if (i < 0) i = 0;
    const prima = this.nodi[this.i];
    const nodo = this.nodi[i];
    if (prima && prima !== nodo) {
      prima.classList.remove('on', 'fermo');
      prima.classList.add('esce');
      setTimeout(() => prima.classList.remove('esce'), 320);
    }
    this.i = i;
    this.t = 0;
    const sc = this.video.scene[i];

    nodo.classList.remove('esce', 'on', 'rivelata');
    $$('.opzione', nodo).forEach((o) => { o.classList.remove('giusta', 'sbagliata'); o.disabled = false; });
    void nodo.offsetWidth; // fa ripartire le animazioni
    nodo.classList.toggle('fermo', i === 0 && this.primoGiro);
    nodo.classList.add('on');

    this.rivelato = false;
    this.quiz = sc.tipo === 'quiz' ? durataQuiz(sc) : null;
    this.contatore = sc.tipo === 'numero' ? $('.cifra-val', nodo) : null;
    if (this.contatore) this.contatore.textContent = formatta(0, sc.decimali || 0);

    this.segmenti.forEach((s, k) => { s.style.transform = `scaleX(${k < i ? 1 : 0})`; });
    disposizione(this.video, i).forEach((tr, k) => { this.forme[k].style.transform = tr; });
    voce.di(testoVoce(sc));
  }

  rivela(scelta) {
    const sc = this.video.scene[this.i];
    if (sc.tipo !== 'quiz' || this.rivelato) return;
    this.rivelato = true;
    const nodo = this.nodi[this.i];
    $$('.opzione', nodo).forEach((o, k) => {
      o.disabled = true;
      if (k === sc.corretta) o.classList.add('giusta');
      else if (k === scelta) o.classList.add('sbagliata');
    });
    nodo.classList.add('rivelata');
    this.t = this.quiz.domanda;
    voce.di(`${senzaSegni(sc.opzioni[sc.corretta])}. ${sc.spiegazione}`);
  }

  pausa(si = !this.inPausa) {
    this.inPausa = si;
    this.palco.classList.toggle('in-pausa', si);
    voce.ferma(si);
  }

  salta(passi) {
    this.vai(Math.max(0, Math.min(this.nodi.length - 1, this.i + passi)));
  }
}
