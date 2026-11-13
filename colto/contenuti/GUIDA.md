# Come si scrive un video di Colto

Colto è un feed verticale come TikTok, ma quando lo chiudi sai una cosa in più. Ogni
video racconta **una sola idea presa da un libro** in 25–45 secondi. I video non sono
filmati: sono scene animate che il codice genera da un file JSON. Tu scrivi il JSON.

Il video deve **tenere incollati**: gancio nei primi due secondi, qualcosa che cambia
ogni 3–5 secondi, una sorpresa, una ricompensa. E deve essere **vero**: il brivido viene
dall'idea, mai da un'esagerazione. Sono due obblighi, non uno a scapito dell'altro.

Pubblico: persone curiose di lingua italiana, 18–35 anni, sul telefono, pollice pronto
a scorrere via. Non hanno letto il libro.

## Dove si scrive

- Un file per gruppo di libri: `contenuti/NN-nome.json`, con **una lista** `[ … ]` di video.
- Controllo obbligatorio, dalla cartella `colto/`:
  `node scripts/valida.mjs --ritmo contenuti/NN-nome.json`
  Deve stampare `✓`. Se elenca problemi, correggili e rilancia.
- Tocca solo il tuo file.

## Struttura di un video

```json
{
  "id": "deep-work-telefono-lontano",
  "categoria": "produttivita",
  "titolo": "Perché dopo una notifica rendi la metà",
  "libro": { "titolo": "Deep Work", "autore": "Cal Newport", "anno": 2016 },
  "scene": [
    { "tipo": "apertura", "testo": "Guardi il telefono «un secondo». La tua testa ==non torna subito==." },
    { "tipo": "colpo", "testo": "Il motivo ha un nome." },
    { "tipo": "testo", "titolo": "Residuo di attenzione", "testo": "Quando cambi compito, un pezzo della tua testa ==resta su quello di prima==. Cal Newport riprende gli studi di Sophie Leroy." },
    { "tipo": "confronto", "a": { "etichetta": "Con il telefono vicino", "voci": ["Dieci cambi all'ora", "Testa sempre a metà"] }, "b": { "etichetta": "Un blocco protetto", "voci": ["Un compito solo", "Testa tutta lì"] } },
    { "tipo": "quiz", "domanda": "Cosa lascia più residuo?", "opzioni": ["Un compito finito", "Un compito lasciato a metà"], "corretta": 1, "spiegazione": "La testa continua a lavorare su ciò che è rimasto aperto." },
    { "tipo": "chiusura", "azione": "Prossima ora di studio: telefono ==in un'altra stanza==." }
  ]
}
```

- `id`: minuscole, cifre e trattini, unico in tutto il progetto: `<libro-in-breve>-<idea>`.
- `categoria`: una di `abitudini`, `produttivita`, `crescita`, `mente`, `comunicazione`,
  `finanza`, `investimenti`, `economia`, `business`, `leadership`, `filosofia`,
  `benessere`, `storia`, `scienza`.
- `titolo` (max 60): la didascalia del video. Deve far venire voglia di guardarlo.
  Niente nome del libro dentro, niente punto finale.
- `libro.titolo`: il titolo dell'edizione italiana **solo se sei sicuro** che esista con
  quel titolo esatto (allora aggiungi `titoloOriginale`); altrimenti il titolo originale.
  Stesso libro = stessa identica scritta in tutti i suoi video.
- `libro.autore`: nome e cognome; più autori separati da virgola.
- `libro.anno`: prima pubblicazione originale. Negativo se avanti Cristo (Sun Tzu: `-500`).

## Le scene

Da 6 a 10 scene. La prima è sempre `apertura`, l'ultima sempre `chiusura`. La durata la
calcola l'app dalla lunghezza dei testi: il totale deve stare **fra 20 e 48 secondi**
(il validatore te lo dice). Limiti di caratteri rigidi.

| tipo | campi | a cosa serve |
|---|---|---|
| `apertura` | `testo` (max 70) | Il gancio. Si deve leggere in due secondi. |
| `colpo` | `testo` (max 30) | Una frase-pugno a tutto schermo: la svolta, la battuta, il cliffhanger. Dura 2 secondi. Max 3 per video. |
| `testo` | `titolo` (facoltativo, max 36), `testo` (max 150) | Spiegare un passaggio. Al massimo 2 per video, mai di fila. |
| `principio` | `testo` (max 110) | L'idea del libro in una frase, **con parole tue**. |
| `elenco` | `titolo` (max 40), `voci` (2–4, max 48 l'una), `numerato` (facoltativo) | Punti o passi. `numerato: true` solo se l'ordine conta. |
| `numero` | `valore`, `prefisso`/`suffisso` (facoltativi), `decimali` (0–2), `didascalia` (max 80), `nota` (facoltativa, max 70) | Una cifra enorme a schermo. |
| `confronto` | `titolo` (facoltativo, max 40), `a` e `b`: `{ etichetta (max 24), voci (1–2, max 40) }` | Due lati a contrasto. `b` è il lato evidenziato: di solito quello che il libro consiglia. |
| `grafico` | `titolo` (max 48), `forma` (`linea` o `barre`), `dati` (`[{ "e": etichetta, "v": numero }]`), `unita` (facoltativa, max 4), `nota` (facoltativa, max 70) | Un andamento o un paragone fra numeri. |
| `esempio` | `testo` (max 170) | Un caso concreto, una mini storia con un personaggio. |
| `quiz` | `domanda` (max 90), `opzioni` (2–3, max 36), `corretta` (indice da 0), `spiegazione` (max 100) | Una domanda a cui si risponde toccando. Vale punti: massimo uno per video. |
| `mito` | `mito` (max 60), `realta` (max 80) | Una convinzione diffusa che viene timbrata «falso», poi la versione del libro. |
| `chiusura` | `azione` (max 90) | «Da provare oggi»: un gesto concreto. Il libro viene citato in automatico. |

Regole di montaggio (le controlla il validatore):

- Almeno una scena visiva (`elenco`, `numero`, `confronto`, `grafico`, `quiz`, `mito`).
- Almeno un `colpo` o un `mito`.
- Mai due scene dello stesso tipo di fila.

Dettagli:

- **Evidenziatore**: fra `==doppi uguali==` le 2–5 parole che contano. Una evidenziatura
  per scena (due solo se serve). Vale in `testo`, `voci`, `didascalia`, `azione`, `realta`,
  `colpo`; non in titoli, etichette, domande, opzioni, `mito`.
- **`grafico`**: `linea` da 3 a 7 punti, `barre` da 2 a 5. Etichette cortissime (max 9
  caratteri, meglio 6: «Oggi», «10 anni», «2008»). Valori mai negativi e corti.
- **`numero`**: la cifra sta su una riga: se è grande usa il suffisso
  (`"valore": 10, "suffisso": " mila"`).
- **`quiz`**: una sola risposta giusta, senza ambiguità; le sbagliate plausibili. Cambia
  la posizione della giusta da un video all'altro. La `spiegazione` dice il perché.
- **`mito`**: la frase del mito è ciò che la gente crede davvero («Più scelta, più
  felicità»), non un fantoccio. `realta` è ciò che sostiene il libro.

## Come si tiene incollato chi guarda

Pensa al video come a una scommessa che si rinnova ogni tre secondi: «resto o scorro?».

**1. Il gancio decide tutto.** Chi guarda sceglie in due secondi. Funzionano:

- la contraddizione: «Più scelte hai, meno sei contento.»
- la scena in cui ti riconosci: «Apri Instagram "un secondo". Passano 40 minuti.»
- l'errore che fai anche tu: «Stai ripassando nel modo che funziona meno.»
- il numero che non torna: «1 centesimo che raddoppia per 30 giorni batte 3 milioni.»
- la domanda che punge: «Perché ricordi una critica e scordi dieci complimenti?»
- la sfida: «Prova a non pensare a un orso bianco.»

Non funzionano: «Scopri…», «In questo video…», «Lo sapevi che…», il nome del libro, la
definizione da manuale, la promessa vaga («cambierà la tua vita»).

**2. Apri un buco, chiudilo dopo.** Il gancio apre una domanda; la risposta arriva a
metà o alla fine, non subito. Nel mezzo rilancia con un `colpo`: «Ma c'è un trucco.»,
«E qui sbagliano tutti.», «Il motivo è assurdo.», «Poi arriva il conto.».

**3. Ogni scena cambia qualcosa.** Alterna i tipi: frase, pugno, numero, storia, tocco.
Niente due scene «di lettura» di fila. Se una scena non aggiunge niente, toglila.

**4. Fai partecipare.** Un `quiz` in circa un video su due: chi tocca resta. Meglio una
domanda in cui si sbaglia d'istinto e la risposta sorprende. Un `mito` quando l'idea
smonta una convinzione comune.

**5. Dai la ricompensa.** Verso la fine chi guarda deve pensare «ah, ecco». È la scena
che risponde al gancio: fanne la più netta del video (`principio`, `numero` o `colpo`).

**6. Chiudi con un gesto.** `chiusura` è una cosa che si fa oggi in meno di dieci minuti,
detta all'imperativo. Mai «rifletti su…».

Ossatura tipica (da variare, non da copiare):

```
apertura  → il gancio
colpo     → rilancio («Il motivo è strano.»)
testo     → il meccanismo, in due frasi
numero / confronto / mito / grafico → la prova che si vede
esempio   → una persona, una situazione
quiz      → tocca tu
principio → la ricompensa: l'idea in una frase
chiusura  → il gesto di oggi
```

## Come suona

- Frasi corte: massimo 12 parole. Una frase, un concetto. Punto. A capo mentale.
- Dai del tu. Presente. Verbi d'azione. Parole di tutti i giorni.
- Concreto batte astratto: «il telefono sul comodino», non «le distrazioni digitali».
- Numeri e nomi propri quando sono veri: danno peso.
- Un amico sveglio che ti racconta una cosa al bar. Niente tono da motivatore, niente
  enfasi, niente emoji, niente hashtag, niente maiuscole gridate; al massimo un punto
  esclamativo per video.
- Numeri nel testo: «10 mila», «1 milione», o cifre con lo spazio («10 000»). Decimali con
  la virgola. Valute in parole o con il simbolo («200 euro»).
- Virgolette italiane «così». Titoli dei libri senza virgolette.

## Regole sul contenuto (non negoziabili)

1. **Fedeltà al libro.** Solo idee che nel libro ci sono davvero, come le intende
   l'autore. Se è una tesi e non un fatto assodato, dillo («secondo Newport…»).
2. **Niente citazioni inventate.** Niente frasi fra virgolette attribuite all'autore.
   `principio` è una tua parafrasi fedele.
3. **Niente numeri a memoria.** Una cifra si usa solo se (a) sei sicuro che sia nel
   libro o sia un fatto verificabile, oppure (b) è un esempio che calcoli tu: rifai il
   conto (anche con `node -e`) e scrivi nella `nota` «Esempio illustrativo». Nel dubbio
   togli la cifra.
4. **Il gancio non mente.** Può sorprendere, non può promettere ciò che il video non
   mantiene né gonfiare un dato. Se il gancio dice «batte 3 milioni», il video mostra
   il conto.
5. **Affermazioni contestate.** Se un'idea famosa è stata ridimensionata dalla ricerca
   (le «10 000 ore» alla lettera, l'esaurimento della forza di volontà, il test del
   marshmallow, i «21 giorni per un'abitudine», il «93% non verbale»), non presentarla
   come un fatto: dillo con onestà (è un ottimo `mito`) o scegli un'altra idea.
6. **Nessun consiglio medico, legale o d'investimento su misura.** Si spiega l'idea, non
   si promettono rendimenti o guarigioni.
7. **Un video = un'idea.** Due video sullo stesso libro raccontano due idee diverse. Non
   rifare le idee di `contenuti/00-esempi.json` (tre video completi da usare come modello).

## Prima di consegnare

- [ ] `node scripts/valida.mjs --ritmo contenuti/NN-nome.json` stampa `✓`.
- [ ] Leggi solo i ganci, uno dopo l'altro: ti fermeresti su ognuno? Sono diversi fra loro?
- [ ] In ogni video c'è il momento «ah, ecco»?
- [ ] Ogni titolo, autore e anno è giusto. Ogni titolo italiano esiste davvero.
- [ ] Ogni cifra è nel libro, è un fatto verificabile o è un esempio calcolato e dichiarato.
- [ ] Nei quiz la risposta indicata è quella giusta.
