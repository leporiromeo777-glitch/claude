# Colto

Un feed verticale, da scorrere come TikTok, che serve a diventare più colti: ogni video
racconta in 30–45 secondi **un'idea presa da un libro** di crescita personale,
psicologia, economia, finanza, business, filosofia, storia o scienza.

I video non sono filmati: sono scene animate che il codice genera a partire da file
JSON (`contenuti/*.json`). Per questo pesano pochissimo, si leggono bene su qualsiasi
schermo e se ne possono aggiungere centinaia senza girare niente.

## Provarlo

Apri `dist/index.html` con un doppio clic: è un file unico, funziona anche senza server.
Per metterlo online basta pubblicare la cartella `dist/` (Netlify, GitHub Pages, ecc.).

- Scorri in su e in giù per cambiare video; un tocco mette in pausa, due tocchi «mi piace».
- Il primo tocco accende il suono (effetti e base ritmica); si spegne dal tasto «Suono».
- In alto: il filtro (Per te, una categoria, un libro, i salvati) e i tuoi punti.
- A destra: mi piace, salva, invia, suono e la voce del dispositivo che legge il video.
- Da tastiera: frecce su/giù per i video, destra/sinistra per le scene, spazio per la pausa.

## Perché tiene incollati

- **Montaggio**: scene corte con tagli netti, parole che si accendono al passo della
  lettura, un lento avvicinamento continuo. Ogni 3–5 secondi cambia qualcosa.
- **Scrittura**: gancio nei primi due secondi, una domanda lasciata aperta, un «colpo»
  (frase-pugno a tutto schermo), spesso un mito timbrato «falso», poi la risposta.
- **Partecipazione**: quiz da toccare, con la risposta che di solito sorprende.
- **Ricompensa**: 10 punti per ogni video nuovo visto fino in fondo, 5 per ogni quiz
  azzeccato al primo colpo, bonus per le serie di risposte giuste e per l'obiettivo
  del giorno (5 idee); livelli da «Curioso» a «Colto».
- **Rilancio**: sull'ultima scena compare il titolo della prossima idea.

Tutto questo senza barare sul contenuto: le regole in `contenuti/GUIDA.md` vietano
citazioni inventate, numeri a memoria e ganci che promettono ciò che il video non dà.

Mi piace, salvati, punti e progressi restano nel browser di chi guarda (non c'è ancora
un account né un server).

## Com'è fatto

```
contenuti/      i video: un file JSON per gruppo di libri + GUIDA.md (come si scrivono)
src/            pagina.html, stile.css, categorie.json (nomi e colori), js/ (app)
scripts/        valida.mjs (controlla i contenuti), build.mjs (crea dist/)
dist/           index.html pronto da pubblicare
```

I moduli in `src/js/`, nell'ordine in cui vengono uniti:

| file | cosa fa |
|---|---|
| `00-tempi.js` | quanto dura ogni scena (formule usate anche dal validatore) |
| `01-base.js` | dati, utilità, memoria nel browser, icone |
| `02-scene.js` | da scena JSON a HTML; grafici SVG; adattamento del testo allo spazio |
| `03-suono.js` | effetti e base ritmica sintetizzati con Web Audio (nessun file audio) |
| `04-riproduttore.js` | fa scorrere le scene: tagli, quiz, mito, voce del dispositivo |
| `05-premi.js` | punti, livelli, obiettivo del giorno, coriandoli |
| `06-feed.js` | il feed verticale, le azioni, l'ordine «Per te» |
| `07-pannelli.js` | Esplora (categorie, libri, ricerca) e Il tuo percorso |
| `08-avvio.js` | collegamenti, tastiera, sblocco del suono |

Nessuna dipendenza da installare: serve solo Node 20 o più recente.

```sh
node scripts/valida.mjs     # controlla tutti i video
node scripts/build.mjs      # ricrea dist/index.html (si ferma se un video non è valido)
```

## Aggiungere video

1. Leggi `contenuti/GUIDA.md`: formato delle scene, limiti di caratteri, come si tiene
   incollato chi guarda, regole sull'accuratezza.
2. Aggiungi i video a un file in `contenuti/` o creane uno nuovo.
3. `node scripts/valida.mjs` e poi `node scripts/build.mjs`.

I tipi di scena: apertura, colpo, testo, principio, elenco, numero, confronto, grafico,
esempio, quiz, mito, chiusura.

## Limiti di questa versione

- È un'app per una persona sola: non ci sono profili, commenti o follower.
- I contenuti sono riassunti divulgativi scritti e riletti da agenti AI, con una
  verifica dei fatti a campione sul web: possono restare imprecisioni. Non sono
  consulenza finanziaria, medica o legale.
- I «video» vivono dentro l'app: non sono file MP4 da caricare su altri social.
- Suoni e base ritmica sono sintetizzati dal browser; la voce usa la sintesi vocale del
  dispositivo, e la qualità dipende dal telefono.
