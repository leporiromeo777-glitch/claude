#!/usr/bin/env node
// Controlla i video in contenuti/*.json.
//   node scripts/valida.mjs                              → tutti i file
//   node scripts/valida.mjs contenuti/03-x.json          → un file (gli id restano unici fra tutti)
//   node scripts/valida.mjs --ritmo contenuti/03-x.json  → con le regole «ritmo» (video corti e serrati)
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CARTELLA = join(RADICE, 'contenuti');

// Quando tutti i file rispettano le regole «ritmo», diventano quelle predefinite.
export const RITMO_PREDEFINITO = false;

export const CATEGORIE = JSON.parse(readFileSync(join(RADICE, 'src/categorie.json'), 'utf8'));
const ID_CATEGORIE = new Set(CATEGORIE.map((c) => c.id));

// Le stesse formule dei tempi che usa l'app.
const { durataVideo } = new Function(`${readFileSync(join(RADICE, 'src/js/00-tempi.js'), 'utf8')}\nreturn { durataVideo };`)();

export const TIPI = ['apertura', 'colpo', 'testo', 'principio', 'elenco', 'numero', 'confronto', 'grafico', 'esempio', 'quiz', 'mito', 'chiusura'];
const VISIVI = new Set(['elenco', 'numero', 'confronto', 'grafico', 'quiz', 'mito']);

const LIMITI = {
  largo: { scene: [5, 10], secondi: [15, 90], apertura: 90, colpo: 30, testoTitolo: 48, testo: 230, principio: 150, elencoTitolo: 48, voce: 70,
    didascalia: 110, nota: 80, confTitolo: 48, confVoce: 52, confVoci: 3, grafTitolo: 56, grafNota: 90, esempio: 240,
    domanda: 110, opzione: 48, spiegazione: 140, mito: 70, realta: 100, azione: 130 },
  ritmo: { scene: [6, 10], secondi: [20, 48], apertura: 70, colpo: 30, testoTitolo: 36, testo: 150, principio: 110, elencoTitolo: 40, voce: 48,
    didascalia: 80, nota: 70, confTitolo: 40, confVoce: 40, confVoci: 2, grafTitolo: 48, grafNota: 70, esempio: 170,
    domanda: 90, opzione: 36, spiegazione: 100, mito: 60, realta: 80, azione: 90 },
};
const APERTURE_SPENTE = /^(scopri|in questo video|oggi (parliamo|vediamo|ti)|ecco (come|perché)|lo sapevi che|benvenut)/i;

const pulito = (s) => String(s).replace(/==/g, '');

export function validaVideo(v, { ritmo = RITMO_PREDEFINITO } = {}) {
  const L = ritmo ? LIMITI.ritmo : LIMITI.largo;
  const err = [];
  const no = (m) => err.push(m);

  const testo = (val, nome, max, { min = 1, evidenzia = true, bordi = true } = {}) => {
    if (typeof val !== 'string') return no(`${nome}: manca o non è testo`);
    const t = pulito(val).trim();
    if (t.length < min) no(`${nome}: troppo corto`);
    if (t.length > max) no(`${nome}: ${t.length} caratteri, massimo ${max}`);
    if (bordi && val !== val.trim()) no(`${nome}: spazi all'inizio o alla fine`);
    if (/\n/.test(val)) no(`${nome}: niente a capo`);
    if (/[<>]/.test(val)) no(`${nome}: niente HTML né i segni < >`);
    const segni = (val.match(/==/g) || []).length;
    if (segni % 2) no(`${nome}: i segni == non sono in coppia`);
    if (!evidenzia && segni) no(`${nome}: qui l'evidenziatore == non si usa`);
    if (segni / 2 > 2) no(`${nome}: al massimo 2 evidenziature`);
    for (const m of val.matchAll(/==(.+?)==/g)) if (m[1].length > 42) no(`${nome}: evidenziatura troppo lunga (max 42)`);
  };
  const facoltativo = (val, nome, max, opz) => { if (val !== undefined) testo(val, nome, max, opz); };
  const lista = (val, nome, min, max, maxCar) => {
    if (!Array.isArray(val)) return no(`${nome}: deve essere una lista`);
    if (val.length < min || val.length > max) no(`${nome}: ${val.length} voci, servono da ${min} a ${max}`);
    val.forEach((x, i) => testo(x, `${nome}[${i}]`, maxCar));
  };
  const chiavi = (ogg, nome, ammesse) => {
    for (const k of Object.keys(ogg)) if (!ammesse.includes(k)) no(`${nome}: campo sconosciuto «${k}»`);
  };

  if (!v || typeof v !== 'object') return ['non è un oggetto'];
  chiavi(v, 'video', ['id', 'categoria', 'titolo', 'libro', 'scene']);
  if (typeof v.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.id) || v.id.length > 64) {
    no('id: solo minuscole, cifre e trattini (max 64)');
  } else if (/^(settings|sidebar|customize|upgrade|downloads)$|^comment-/.test(v.id)) {
    no('id: nome riservato');
  }
  if (!ID_CATEGORIE.has(v.categoria)) no(`categoria: «${v.categoria}» non esiste`);
  testo(v.titolo, 'titolo', 60, { evidenzia: false });

  const l = v.libro;
  if (!l || typeof l !== 'object') no('libro: manca');
  else {
    chiavi(l, 'libro', ['titolo', 'autore', 'anno', 'titoloOriginale']);
    testo(l.titolo, 'libro.titolo', 70, { evidenzia: false });
    testo(l.autore, 'libro.autore', 60, { evidenzia: false });
    facoltativo(l.titoloOriginale, 'libro.titoloOriginale', 80, { evidenzia: false });
    if (!Number.isInteger(l.anno) || l.anno < -800 || l.anno > 2026) no('libro.anno: anno intero (negativo se avanti Cristo)');
  }

  const s = v.scene;
  if (!Array.isArray(s)) return [...err, 'scene: manca la lista'];
  if (s.length < L.scene[0] || s.length > L.scene[1]) no(`scene: ${s.length}, servono da ${L.scene[0]} a ${L.scene[1]}`);
  if (s[0]?.tipo !== 'apertura') no('scene: la prima deve essere «apertura»');
  if (s.at(-1)?.tipo !== 'chiusura') no("scene: l'ultima deve essere «chiusura»");
  if (!s.some((x) => VISIVI.has(x?.tipo))) no('scene: serve almeno una scena visiva (elenco, numero, confronto, grafico, quiz o mito)');
  const quante = (tipo) => s.filter((x) => x?.tipo === tipo).length;
  if (quante('colpo') > 3) no('scene: al massimo 3 «colpo» per video');
  if (ritmo) {
    if (!quante('colpo') && !quante('mito')) no('scene: serve almeno un «colpo» o un «mito» per dare ritmo');
    if (quante('testo') > 2) no('scene: al massimo 2 scene «testo» (usa esempio, numero, confronto, elenco, mito…)');
    if (quante('quiz') > 1) no('scene: al massimo un quiz per video');
  }

  let formaOk = true;
  s.forEach((sc, i) => {
    const n = `scene[${i}] ${sc?.tipo ?? '?'}`;
    if (!sc || typeof sc !== 'object') { formaOk = false; return no(`${n}: non è un oggetto`); }
    if (!TIPI.includes(sc.tipo)) { formaOk = false; return no(`${n}: tipo sconosciuto`); }
    if ((sc.tipo === 'apertura' && i !== 0) || (sc.tipo === 'chiusura' && i !== s.length - 1)) no(`${n}: posizione sbagliata`);
    if (i > 0 && s[i - 1]?.tipo === sc.tipo && (ritmo || sc.tipo !== 'testo')) no(`${n}: due scene uguali di fila`);
    const prima = err.length;
    switch (sc.tipo) {
      case 'apertura':
        chiavi(sc, n, ['tipo', 'testo']);
        testo(sc.testo, `${n}.testo`, L.apertura, { min: 12 });
        if (ritmo && typeof sc.testo === 'string' && APERTURE_SPENTE.test(pulito(sc.testo))) no(`${n}.testo: apertura spenta, parti da un fatto, una domanda o una scena concreta`);
        break;
      case 'colpo':
        chiavi(sc, n, ['tipo', 'testo']);
        testo(sc.testo, `${n}.testo`, L.colpo, { min: 2 });
        if (i === 1 && ritmo && s.length < 7) { /* va bene: colpo subito dopo il gancio */ }
        break;
      case 'testo':
        chiavi(sc, n, ['tipo', 'titolo', 'testo']);
        facoltativo(sc.titolo, `${n}.titolo`, L.testoTitolo, { evidenzia: false });
        testo(sc.testo, `${n}.testo`, L.testo, { min: 30 });
        break;
      case 'principio':
        chiavi(sc, n, ['tipo', 'testo']);
        testo(sc.testo, `${n}.testo`, L.principio, { min: 20 });
        break;
      case 'elenco':
        chiavi(sc, n, ['tipo', 'titolo', 'voci', 'numerato']);
        testo(sc.titolo, `${n}.titolo`, L.elencoTitolo, { evidenzia: false });
        lista(sc.voci, `${n}.voci`, 2, 4, L.voce);
        if (sc.numerato !== undefined && typeof sc.numerato !== 'boolean') no(`${n}.numerato: vero o falso`);
        break;
      case 'numero':
        chiavi(sc, n, ['tipo', 'valore', 'prefisso', 'suffisso', 'decimali', 'didascalia', 'nota']);
        if (typeof sc.valore !== 'number' || !Number.isFinite(sc.valore) || sc.valore < 0) no(`${n}.valore: numero non negativo`);
        if (sc.decimali !== undefined && ![0, 1, 2].includes(sc.decimali)) no(`${n}.decimali: 0, 1 o 2`);
        // prefisso e suffisso possono avere uno spazio verso la cifra («€ », « mila»)
        facoltativo(sc.prefisso, `${n}.prefisso`, 4, { evidenzia: false, bordi: false });
        facoltativo(sc.suffisso, `${n}.suffisso`, 8, { evidenzia: false, bordi: false });
        testo(sc.didascalia, `${n}.didascalia`, L.didascalia, { min: 10 });
        facoltativo(sc.nota, `${n}.nota`, L.nota, { evidenzia: false });
        if (typeof sc.valore === 'number') {
          const cifre = Math.round(sc.valore).toString().length + (sc.decimali ? sc.decimali + 1 : 0);
          const extra = String(sc.prefisso || '').trim().length + String(sc.suffisso || '').trim().length * 0.6;
          if (cifre + extra > 9) no(`${n}: numero troppo lungo per lo schermo (usa «mila», «mln» nel suffisso)`);
        }
        break;
      case 'confronto':
        chiavi(sc, n, ['tipo', 'titolo', 'a', 'b']);
        facoltativo(sc.titolo, `${n}.titolo`, L.confTitolo, { evidenzia: false });
        for (const lato of ['a', 'b']) {
          const x = sc[lato];
          if (!x || typeof x !== 'object') { formaOk = false; no(`${n}.${lato}: manca`); continue; }
          chiavi(x, `${n}.${lato}`, ['etichetta', 'voci']);
          testo(x.etichetta, `${n}.${lato}.etichetta`, 24, { evidenzia: false });
          lista(x.voci, `${n}.${lato}.voci`, 1, L.confVoci, L.confVoce);
        }
        break;
      case 'grafico': {
        chiavi(sc, n, ['tipo', 'titolo', 'forma', 'dati', 'unita', 'nota']);
        testo(sc.titolo, `${n}.titolo`, L.grafTitolo, { evidenzia: false });
        if (!['linea', 'barre'].includes(sc.forma)) no(`${n}.forma: «linea» o «barre»`);
        facoltativo(sc.unita, `${n}.unita`, 4, { evidenzia: false });
        facoltativo(sc.nota, `${n}.nota`, L.grafNota, { evidenzia: false });
        const max = sc.forma === 'barre' ? 5 : 7;
        const min = sc.forma === 'barre' ? 2 : 3;
        if (!Array.isArray(sc.dati) || sc.dati.length < min || sc.dati.length > max) {
          no(`${n}.dati: servono da ${min} a ${max} punti`);
        } else {
          sc.dati.forEach((d, j) => {
            if (!d || typeof d !== 'object') return no(`${n}.dati[${j}]: non è un oggetto`);
            chiavi(d, `${n}.dati[${j}]`, ['e', 'v']);
            testo(d.e, `${n}.dati[${j}].e`, 9, { evidenzia: false });
            if (typeof d.v !== 'number' || !Number.isFinite(d.v) || d.v < 0) no(`${n}.dati[${j}].v: numero non negativo`);
          });
          if (!sc.dati.some((d) => d?.v > 0)) no(`${n}.dati: tutti zero`);
        }
        break;
      }
      case 'esempio':
        chiavi(sc, n, ['tipo', 'testo']);
        testo(sc.testo, `${n}.testo`, L.esempio, { min: 30 });
        break;
      case 'quiz':
        chiavi(sc, n, ['tipo', 'domanda', 'opzioni', 'corretta', 'spiegazione']);
        testo(sc.domanda, `${n}.domanda`, L.domanda, { min: 10, evidenzia: false });
        lista(sc.opzioni, `${n}.opzioni`, 2, 3, L.opzione);
        if ((Array.isArray(sc.opzioni) ? sc.opzioni : []).some((o) => /==/.test(o))) no(`${n}.opzioni: niente evidenziatore`);
        if (!Number.isInteger(sc.corretta) || sc.corretta < 0 || sc.corretta >= (sc.opzioni?.length ?? 0)) no(`${n}.corretta: indice dell'opzione giusta (da 0)`);
        testo(sc.spiegazione, `${n}.spiegazione`, L.spiegazione, { min: 10, evidenzia: false });
        break;
      case 'mito':
        chiavi(sc, n, ['tipo', 'mito', 'realta']);
        testo(sc.mito, `${n}.mito`, L.mito, { min: 8, evidenzia: false });
        testo(sc.realta, `${n}.realta`, L.realta, { min: 8 });
        break;
      case 'chiusura':
        chiavi(sc, n, ['tipo', 'azione']);
        testo(sc.azione, `${n}.azione`, L.azione, { min: 15 });
        break;
    }
    if (err.length > prima && err.slice(prima).some((e) => /manca|lista|non è/.test(e))) formaOk = false;
  });

  if (formaOk) {
    const secondi = durataVideo(v) / 1000;
    if (secondi > L.secondi[1]) no(`durata: ${secondi.toFixed(0)} secondi, massimo ${L.secondi[1]} (accorcia i testi o togli una scena)`);
    if (secondi < L.secondi[0]) no(`durata: ${secondi.toFixed(0)} secondi, minimo ${L.secondi[0]}`);
  }
  return err;
}

export function leggiTutti() {
  const file = readdirSync(CARTELLA).filter((f) => f.endsWith('.json')).sort();
  return file.map((nome) => {
    const percorso = join(CARTELLA, nome);
    try {
      return { nome, percorso, video: JSON.parse(readFileSync(percorso, 'utf8')) };
    } catch (e) {
      return { nome, percorso, video: null, erroreJson: e.message };
    }
  });
}

export function validaTutto(soloFile, opzioni = {}) {
  const tutti = leggiTutti();
  const problemi = [];
  const visti = new Map();
  const libri = new Map();
  let totale = 0;
  for (const f of tutti) {
    const daMostrare = !soloFile || basename(soloFile) === f.nome;
    if (f.erroreJson) { if (daMostrare) problemi.push(`${f.nome}: JSON non valido (${f.erroreJson})`); continue; }
    if (!Array.isArray(f.video)) { if (daMostrare) problemi.push(`${f.nome}: il file deve contenere una lista [ … ] di video`); continue; }
    f.video.forEach((v, i) => {
      totale++;
      const doppio = v?.id && visti.get(v.id);
      if (v?.id) visti.set(v.id, visti.get(v.id) || f.nome);
      const l = v?.libro;
      const noto = l?.titolo && libri.get(l.titolo);
      if (l?.titolo && !noto) libri.set(l.titolo, { autore: l.autore, anno: l.anno, file: f.nome });
      if (!daMostrare) return;
      if (noto && (noto.autore !== l.autore || noto.anno !== l.anno)) {
        problemi.push(`${f.nome} › ${v.id}: «${l.titolo}» ha autore o anno diversi da quelli usati in ${noto.file} (${noto.autore}, ${noto.anno})`);
      }
      if (doppio) problemi.push(`${f.nome} › ${v.id}: id già usato in ${doppio}`);
      for (const e of validaVideo(v, opzioni)) problemi.push(`${f.nome} › ${v?.id ?? '#' + i}: ${e}`);
    });
  }
  return { tutti, problemi, totale };
}

export { durataVideo };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argomenti = process.argv.slice(2);
  const ritmo = RITMO_PREDEFINITO || argomenti.includes('--ritmo');
  const solo = argomenti.find((a) => !a.startsWith('--'));
  const { tutti, problemi, totale } = validaTutto(solo, { ritmo });
  if (solo && !tutti.some((f) => f.nome === basename(solo))) {
    console.error(`File non trovato in contenuti/: ${solo}`);
    process.exit(1);
  }
  if (problemi.length) {
    console.error(problemi.join('\n'));
    console.error(`\n✗ ${problemi.length} problemi`);
    process.exit(1);
  }
  const scelti = solo ? tutti.filter((f) => f.nome === basename(solo)) : tutti;
  const video = scelti.flatMap((f) => f.video);
  const media = video.reduce((a, v) => a + durataVideo(v), 0) / video.length / 1000;
  console.log(`✓ ${video.length} video validi${solo ? ` in ${basename(solo)}` : ` in ${tutti.length} file`}${ritmo ? ' (regole ritmo)' : ''}, durata media ${media.toFixed(0)} s`);
}
