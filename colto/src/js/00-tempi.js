// Tempi di lettura: funzioni pure, usate dall'app e dal validatore (scripts/valida.mjs).
const senzaSegni = (s) => String(s || '').replace(/==/g, '');
const lunghezza = (s) => senzaSegni(s).length;
const somma = (lista) => lista.reduce((a, t) => a + lunghezza(t), 0);

const MS_CARATTERE = 50;
const leggi = (caratteri, base = 1000) => Math.max(2200, Math.min(11000, base + caratteri * MS_CARATTERE));

function durataQuiz(sc) {
  return { domanda: leggi(lunghezza(sc.domanda) + somma(sc.opzioni), 2600), risposta: leggi(lunghezza(sc.spiegazione), 1800) };
}
function durataMito(sc) {
  return { mito: Math.min(5200, leggi(lunghezza(sc.mito), 1500)), realta: leggi(lunghezza(sc.realta), 1500) };
}

function durataScena(sc) {
  switch (sc.tipo) {
    case 'apertura': return leggi(lunghezza(sc.testo), 1500);
    case 'colpo': return Math.max(1500, Math.min(2600, 800 + lunghezza(sc.testo) * 45));
    case 'testo': return leggi(lunghezza(sc.titolo) + lunghezza(sc.testo));
    case 'principio': return leggi(lunghezza(sc.testo), 1600);
    case 'elenco': return leggi(lunghezza(sc.titolo) + somma(sc.voci), 900 + sc.voci.length * 550);
    case 'numero': return leggi(lunghezza(sc.didascalia) + lunghezza(sc.nota) * 0.5, 2300);
    case 'confronto': return leggi(lunghezza(sc.titolo) + somma(sc.a.voci) + somma(sc.b.voci), 2400);
    case 'grafico': return leggi(lunghezza(sc.titolo) + lunghezza(sc.nota) * 0.6, 3200);
    case 'esempio': return leggi(lunghezza(sc.testo), 1100);
    case 'quiz': { const d = durataQuiz(sc); return d.domanda + d.risposta; }
    case 'mito': { const d = durataMito(sc); return d.mito + d.realta; }
    case 'chiusura': return leggi(lunghezza(sc.azione), 2600);
    default: return 4000;
  }
}
const durataVideo = (video) => video.scene.reduce((a, sc) => a + durataScena(sc), 0);
