# Come si scrive un video di Colto

Colto è un feed verticale (stile TikTok) per diventare più colti: ogni video spiega
**una sola idea presa da un libro** in 30–60 secondi. I video non sono filmati: sono
scene animate generate dal codice a partire da un file JSON. Tu scrivi il JSON.

Pubblico: persone curiose di lingua italiana, 18–35 anni, sul telefono, che non hanno
letto il libro. Devono capire l'idea al primo colpo e uscirne con una cosa da fare.

## Dove si scrive

- Un file per autore dei contenuti: `contenuti/NN-nome.json`, che contiene **una lista** `[ … ]` di video.
- Tre video completi da usare come modello: `contenuti/00-esempi.json`.
- Controllo obbligatorio prima di consegnare:
  `node scripts/valida.mjs contenuti/NN-nome.json` (dalla cartella `colto/`).
  Deve stampare `✓`. Se elenca problemi, correggili e rilancia.
- Tocca solo il tuo file.

## Struttura di un video

```json
{
  "id": "deep-work-blocchi-profondi",
  "categoria": "produttivita",
  "titolo": "Quattro ore che valgono una giornata",
  "libro": { "titolo": "Deep Work", "autore": "Cal Newport", "anno": 2016 },
  "scene": [ … da 5 a 8 scene … ]
}
```

- `id`: minuscole, cifre e trattini, unico in tutto il progetto: `<libro-in-breve>-<idea>`.
- `categoria`: una di `abitudini`, `produttivita`, `crescita`, `mente`, `comunicazione`,
  `finanza`, `investimenti`, `economia`, `business`, `leadership`, `filosofia`,
  `benessere`, `storia`, `scienza`. Usa quella che ti è stata assegnata, salvo che un
  libro stia chiaramente meglio in un'altra.
- `titolo` (max 60 caratteri): il nome dell'idea, come la didascalia di un video. Niente
  nome del libro dentro, niente punto finale.
- `libro.titolo`: il titolo dell'edizione italiana **solo se sei sicuro** che esista con
  quel titolo esatto; in quel caso aggiungi `titoloOriginale`. Altrimenti il titolo
  originale. Stesso libro = stessa identica scritta in tutti i suoi video.
- `libro.autore`: nome e cognome; più autori separati da virgola.
- `libro.anno`: anno della prima pubblicazione originale. Per i testi antichi un anno
  indicativo; negativo se avanti Cristo (Sun Tzu: `-500`).

## Le scene

La prima scena è sempre `apertura`, l'ultima sempre `chiusura`. In mezzo scegli tu, con
**almeno una scena visiva** (`elenco`, `numero`, `confronto`, `grafico`, `quiz`). Mai due
scene dello stesso tipo di fila (tranne `testo`). I limiti di caratteri sono rigidi: li
controlla il validatore.

| tipo | campi | a cosa serve |
|---|---|---|
| `apertura` | `testo` (max 90) | Il gancio: una frase che fa venire voglia di restare. |
| `testo` | `titolo` (facoltativo, max 48), `testo` (max 230) | Spiegare un passaggio. |
| `principio` | `testo` (max 150) | L'idea del libro in una frase, **con parole tue**. |
| `elenco` | `titolo` (max 48), `voci` (2–4, max 70 l'una), `numerato` (facoltativo) | Punti o passi. `numerato: true` solo se l'ordine conta davvero. |
| `numero` | `valore`, `prefisso`/`suffisso` (facoltativi), `decimali` (0–2), `didascalia` (max 110), `nota` (facoltativa, max 80) | Una cifra enorme a schermo. |
| `confronto` | `titolo` (facoltativo, max 48), `a` e `b`: `{ etichetta (max 24), voci (1–3, max 52) }` | Due lati a contrasto. `b` è il lato evidenziato: di solito quello che il libro consiglia. |
| `grafico` | `titolo` (max 56), `forma` (`linea` o `barre`), `dati` (`[{ "e": etichetta, "v": numero }]`), `unita` (facoltativa, max 4), `nota` (facoltativa, max 90) | Un andamento o un paragone fra numeri. |
| `esempio` | `testo` (max 240) | Un caso concreto, una piccola storia. |
| `quiz` | `domanda` (max 110), `opzioni` (2–3, max 48), `corretta` (indice da 0), `spiegazione` (max 140) | Una domanda a cui si risponde toccando. |
| `chiusura` | `azione` (max 130) | «Da provare oggi»: un gesto concreto. Il libro viene citato in automatico. |

Dettagli:

- **Evidenziatore**: racchiudi fra `==doppi uguali==` le 2–5 parole chiave di una scena.
  Al massimo una evidenziatura per scena (due solo se serve). Si può usare in `testo`,
  `voci`, `didascalia`, `azione`; non in titoli, etichette, domande e opzioni.
- **`grafico`**: `linea` da 3 a 7 punti, `barre` da 2 a 5. Etichette cortissime (max 9
  caratteri, meglio 6: «Oggi», «10 anni», «2008»). Valori mai negativi. Per le barre tieni
  i valori corti (se servono migliaia, mettilo nel titolo: «in migliaia di euro»).
- **`numero`**: la cifra deve stare su una riga: se è grande usa il suffisso
  (`"valore": 10, "suffisso": " mila"`). Lo spazio davanti al suffisso lo metti tu.
- **`quiz`**: una sola risposta giusta, senza ambiguità; le sbagliate devono essere
  plausibili. Cambia la posizione della risposta giusta da un video all'altro. La
  `spiegazione` dice perché, non ripete la domanda.
- La durata di ogni scena la calcola l'app in base alla lunghezza del testo.

## Regole sul contenuto (non negoziabili)

1. **Fedeltà al libro.** Solo idee che nel libro ci sono davvero, raccontate come le
   intende l'autore. Se un'idea è dell'autore e non un fatto assodato, dillo
   («secondo Newport…», «Taleb sostiene che…»).
2. **Niente citazioni inventate.** Non mettere frasi fra virgolette attribuite
   all'autore. `principio` è una tua parafrasi fedele, non una citazione.
3. **Niente numeri a memoria.** Una cifra si usa solo se (a) sei sicuro che sia nel libro
   o sia un fatto verificabile, oppure (b) è un esempio che calcoli tu: in questo caso
   rifai il conto (anche con `node -e`) e scrivi nella `nota` «Esempio illustrativo».
   Nel dubbio togli la cifra e usa un'altra scena.
4. **Affermazioni contestate.** Se un'idea famosa è stata ridimensionata dalla ricerca
   (la «regola delle 10 000 ore» presa alla lettera, l'esaurimento della forza di volontà,
   il test del marshmallow, certe statistiche sul sonno, il «93% della comunicazione è
   non verbale»), non presentarla come un fatto: dillo con onestà o scegli un'altra idea.
5. **Nessun consiglio medico, legale o d'investimento su misura.** Si spiega l'idea, non
   si promettono rendimenti o guarigioni. Negli esempi con i soldi: «Esempio illustrativo».
6. **Un video = un'idea.** Due video sullo stesso libro raccontano due idee diverse. Non
   rifare le tre idee di `00-esempi.json` (l'1% al giorno e i sistemi di *Atomic Habits*;
   i due sistemi e la mazza con la pallina di Kahneman; il 10% «paga prima te stesso» di Clason).

## Come si scrive

- Italiano semplice e concreto, dando del tu. Frasi corte. Una frase, un concetto.
- Il gancio (`apertura`) è una domanda, un paradosso, un numero sorprendente o una scena
  di vita in cui riconoscersi. Mai una promessa esagerata, mai «Scopri…», «In questo video…».
- Dopo il gancio non ripeterlo: vai avanti. Ogni scena aggiunge qualcosa.
- Preferisci l'esempio quotidiano al termine astratto. Spiega le parole tecniche la prima volta.
- Tono: un amico che ha letto il libro e te lo racconta. Niente enfasi, niente emoji,
  niente hashtag, niente maiuscole gridate, al massimo un punto esclamativo per video.
- Numeri nel testo: «10 mila», «1 milione», oppure cifre con lo spazio («10 000»). Decimali
  con la virgola («1,5»). Valute in parole o con il simbolo («200 euro», «1 dollaro»).
- Virgolette italiane «così». Titoli dei libri senza virgolette.
- La `chiusura` è un'azione che si può fare oggi in meno di dieci minuti, non «rifletti su…».
- Varia la forma: non tutti i video con la stessa sequenza di scene. Un `quiz` circa in un
  video su tre; un `grafico` solo quando ci sono numeri veri o calcolabili.

## Prima di consegnare

- [ ] `node scripts/valida.mjs contenuti/NN-nome.json` stampa `✓`.
- [ ] Ogni titolo, autore e anno è giusto. Ogni titolo italiano esiste davvero.
- [ ] Ogni cifra è nel libro, è un fatto verificabile o è un esempio calcolato e dichiarato.
- [ ] Nei quiz la risposta indicata è quella giusta.
- [ ] Rileggi i ganci uno dopo l'altro: sono diversi fra loro?
