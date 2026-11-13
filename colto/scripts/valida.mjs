#!/usr/bin/env node
// Controlla i video in contenuti/*.json.
//   node scripts/valida.mjs                      → tutti i file
//   node scripts/valida.mjs contenuti/03-x.json  → un file (gli id restano unici fra tutti)
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CARTELLA = join(RADICE, 'contenuti');

export const CATEGORIE = JSON.parse(readFileSync(join(RADICE, 'src/categorie.json'), 'utf8'));
const ID_CATEGORIE = new Set(CATEGORIE.map((c) => c.id));

export const TIPI = ['apertura', 'testo', 'principio', 'elenco', 'numero', 'confronto', 'grafico', 'esempio', 'quiz', 'chiusura'];
const VISIVI = new Set(['elenco', 'numero', 'confronto', 'grafico', 'quiz']);

const pulito = (s) => String(s).replace(/==/g, '');

export function validaVideo(v) {
  const err = [];
  const no = (m) => err.push(m);

  const testo = (val, nome, max, { min = 1, evidenzia = true } = {}) => {
    if (typeof val !== 'string') return no(`${nome}: manca o non è testo`);
    const t = pulito(val).trim();
    if (t.length < min) no(`${nome}: troppo corto`);
    if (t.length > max) no(`${nome}: ${t.length} caratteri, massimo ${max}`);
    if (val !== val.trim()) no(`${nome}: spazi all'inizio o alla fine`);
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
  if (s.length < 5 || s.length > 8) no(`scene: ${s.length}, servono da 5 a 8`);
  if (s[0]?.tipo !== 'apertura') no('scene: la prima deve essere «apertura»');
  if (s.at(-1)?.tipo !== 'chiusura') no("scene: l'ultima deve essere «chiusura»");
  if (!s.some((x) => VISIVI.has(x?.tipo))) no('scene: serve almeno una scena visiva (elenco, numero, confronto, grafico o quiz)');

  s.forEach((sc, i) => {
    const n = `scene[${i}] ${sc?.tipo ?? '?'}`;
    if (!sc || typeof sc !== 'object') return no(`${n}: non è un oggetto`);
    if (!TIPI.includes(sc.tipo)) return no(`${n}: tipo sconosciuto`);
    if ((sc.tipo === 'apertura' && i !== 0) || (sc.tipo === 'chiusura' && i !== s.length - 1)) no(`${n}: posizione sbagliata`);
    if (i > 0 && s[i - 1]?.tipo === sc.tipo && sc.tipo !== 'testo') no(`${n}: due scene uguali di fila`);
    switch (sc.tipo) {
      case 'apertura':
        chiavi(sc, n, ['tipo', 'testo']);
        testo(sc.testo, `${n}.testo`, 90, { min: 12 });
        break;
      case 'testo':
        chiavi(sc, n, ['tipo', 'titolo', 'testo']);
        facoltativo(sc.titolo, `${n}.titolo`, 48, { evidenzia: false });
        testo(sc.testo, `${n}.testo`, 230, { min: 30 });
        break;
      case 'principio':
        chiavi(sc, n, ['tipo', 'testo']);
        testo(sc.testo, `${n}.testo`, 150, { min: 20 });
        break;
      case 'elenco':
        chiavi(sc, n, ['tipo', 'titolo', 'voci', 'numerato']);
        testo(sc.titolo, `${n}.titolo`, 48, { evidenzia: false });
        lista(sc.voci, `${n}.voci`, 2, 4, 70);
        if (sc.numerato !== undefined && typeof sc.numerato !== 'boolean') no(`${n}.numerato: vero o falso`);
        break;
      case 'numero':
        chiavi(sc, n, ['tipo', 'valore', 'prefisso', 'suffisso', 'decimali', 'didascalia', 'nota']);
        if (typeof sc.valore !== 'number' || !Number.isFinite(sc.valore) || sc.valore < 0) no(`${n}.valore: numero non negativo`);
        if (sc.decimali !== undefined && ![0, 1, 2].includes(sc.decimali)) no(`${n}.decimali: 0, 1 o 2`);
        facoltativo(sc.prefisso, `${n}.prefisso`, 4, { evidenzia: false });
        facoltativo(sc.suffisso, `${n}.suffisso`, 8, { evidenzia: false });
        testo(sc.didascalia, `${n}.didascalia`, 110, { min: 10 });
        facoltativo(sc.nota, `${n}.nota`, 80, { evidenzia: false });
        if (typeof sc.valore === 'number') {
          const cifre = Math.round(sc.valore).toString().length + (sc.decimali ? sc.decimali + 1 : 0);
          const extra = (sc.prefisso || '').length + (sc.suffisso || '').length * 0.6;
          if (cifre + extra > 9) no(`${n}: numero troppo lungo per lo schermo (usa «mila», «mln» nel suffisso)`);
        }
        break;
      case 'confronto':
        chiavi(sc, n, ['tipo', 'titolo', 'a', 'b']);
        facoltativo(sc.titolo, `${n}.titolo`, 48, { evidenzia: false });
        for (const lato of ['a', 'b']) {
          const x = sc[lato];
          if (!x || typeof x !== 'object') { no(`${n}.${lato}: manca`); continue; }
          chiavi(x, `${n}.${lato}`, ['etichetta', 'voci']);
          testo(x.etichetta, `${n}.${lato}.etichetta`, 24, { evidenzia: false });
          lista(x.voci, `${n}.${lato}.voci`, 1, 3, 52);
        }
        break;
      case 'grafico': {
        chiavi(sc, n, ['tipo', 'titolo', 'forma', 'dati', 'unita', 'nota']);
        testo(sc.titolo, `${n}.titolo`, 56, { evidenzia: false });
        if (!['linea', 'barre'].includes(sc.forma)) no(`${n}.forma: «linea» o «barre»`);
        facoltativo(sc.unita, `${n}.unita`, 4, { evidenzia: false });
        facoltativo(sc.nota, `${n}.nota`, 90, { evidenzia: false });
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
        testo(sc.testo, `${n}.testo`, 240, { min: 30 });
        break;
      case 'quiz':
        chiavi(sc, n, ['tipo', 'domanda', 'opzioni', 'corretta', 'spiegazione']);
        testo(sc.domanda, `${n}.domanda`, 110, { min: 10, evidenzia: false });
        lista(sc.opzioni, `${n}.opzioni`, 2, 3, 48);
        if ((sc.opzioni || []).some((o) => /==/.test(o))) no(`${n}.opzioni: niente evidenziatore`);
        if (!Number.isInteger(sc.corretta) || sc.corretta < 0 || sc.corretta >= (sc.opzioni?.length ?? 0)) no(`${n}.corretta: indice dell'opzione giusta (da 0)`);
        testo(sc.spiegazione, `${n}.spiegazione`, 140, { min: 10, evidenzia: false });
        break;
      case 'chiusura':
        chiavi(sc, n, ['tipo', 'azione']);
        testo(sc.azione, `${n}.azione`, 130, { min: 15 });
        break;
    }
  });
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

export function validaTutto(soloFile) {
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
      for (const e of validaVideo(v)) problemi.push(`${f.nome} › ${v?.id ?? '#' + i}: ${e}`);
    });
  }
  return { tutti, problemi, totale };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const solo = process.argv[2];
  const { tutti, problemi, totale } = validaTutto(solo);
  if (solo && !tutti.some((f) => f.nome === basename(solo))) {
    console.error(`File non trovato in contenuti/: ${solo}`);
    process.exit(1);
  }
  if (problemi.length) {
    console.error(problemi.join('\n'));
    console.error(`\n✗ ${problemi.length} problemi`);
    process.exit(1);
  }
  const n = solo ? tutti.find((f) => f.nome === basename(solo)).video.length : totale;
  console.log(`✓ ${n} video validi${solo ? ` in ${basename(solo)}` : ` in ${tutti.length} file`}`);
}
