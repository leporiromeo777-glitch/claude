# Colto

Un feed verticale, da scorrere come TikTok, che serve a diventare più colti: ogni video
spiega in meno di un minuto **un'idea presa da un libro** di crescita personale,
psicologia, economia, finanza, business, filosofia, storia o scienza.

I video non sono filmati: sono scene animate che il codice genera a partire da file
JSON (`contenuti/*.json`). Per questo pesano pochissimo, si leggono bene su qualsiasi
schermo e se ne possono aggiungere centinaia senza girare niente.

## Provarlo

Apri `dist/index.html` con un doppio clic: è un file unico, funziona anche senza server.
Per metterlo online basta pubblicare la cartella `dist/` (Netlify, GitHub Pages, ecc.).

- Scorri in su e in giù per cambiare video; un tocco mette in pausa, due tocchi «mi piace».
- In alto: il filtro (Per te, una categoria, un libro, i salvati) e le idee viste oggi.
- A destra: mi piace, salva, invia e la voce del dispositivo che legge il video.
- Da tastiera: frecce su/giù per i video, destra/sinistra per le scene, spazio per la pausa.

Mi piace, salvati e progressi restano nel browser di chi guarda (non c'è ancora un
account né un server).

## Com'è fatto

```
contenuti/      i video: un file JSON per gruppo di libri + GUIDA.md (come si scrivono)
src/            pagina.html, stile.css, categorie.json (nomi e colori), js/ (app)
scripts/        valida.mjs (controlla i contenuti), build.mjs (crea dist/)
dist/           index.html pronto da pubblicare
```

Nessuna dipendenza da installare: serve solo Node 20 o più recente.

```sh
node scripts/valida.mjs     # controlla tutti i video
node scripts/build.mjs      # ricrea dist/index.html (si ferma se un video non è valido)
```

## Aggiungere video

1. Leggi `contenuti/GUIDA.md`: formato delle scene, limiti di caratteri, regole
   sull'accuratezza (niente citazioni inventate, niente numeri a memoria).
2. Aggiungi i video a un file in `contenuti/` o creane uno nuovo.
3. `node scripts/valida.mjs` e poi `node scripts/build.mjs`.

I tipi di scena disponibili: apertura, testo, principio, elenco, numero, confronto,
grafico, esempio, quiz, chiusura.

## Limiti di questa prima versione

- È un'app per una persona sola: non ci sono profili, commenti o follower.
- I contenuti sono riassunti divulgativi scritti e riletti da agenti AI: possono
  contenere imprecisioni. Non sono consulenza finanziaria, medica o legale.
- La voce usa la sintesi vocale del dispositivo: la qualità dipende dal telefono.
