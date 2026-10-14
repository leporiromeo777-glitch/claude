# Stato del pacchetto: traduzione-en

**Stato:** done

## Riepilogo

Traduzione inglese di tutta la storia (livello L2): quattro file JSON più il test.

- `src/content/text/en/atto1.json`: Prologo, g01-g08, Archivio A1-A2, Taccuino dell'Atto I, lettere di L. 1-7.
- `src/content/text/en/atto2.json`: g09-g16, Archivio A3-A4, Taccuino dell'Atto II, lettere di L. 8-11, lettera di Clotilde, le tre lettere del fascio.
- `src/content/text/en/atto3.json`: g17-g23 con i quattro biglietti della scelta, Archivio A5-A6, Taccuino dell'Atto III, biglietti di Livia, nastro della nonna.
- `src/content/text/en/finali.json`: i quattro finali (suggerimenti, margini, epiloghi con le varianti dei destini) e le mancanze del finale vero.
- `tests/unit/content/en.test.ts`: 18 test.

| Namespace | Testi | Parole it | Parole en |
|---|---|---|---|
| atto1 | 278 | 3.607 | 3.697 |
| atto2 | 298 | 5.338 | 5.513 |
| atto3 | 232 | 3.555 | 3.713 |
| finali | 70 | 708 | 723 |
| **Totale** | **878** | **13.208** | **13.646** (+3%) |

I file vengono caricati da soli: `loadI18nSources()` (`src/core/i18n.ts`) prende con un glob tutti i `src/content/text/<lingua>/<ns>.json`. Il loader dei contenuti non va toccato. In inglese `__GAME__.core.missingKeys('en')` non ha più chiavi della storia (prima ripiegava sull'italiano).

## Il test (`tests/unit/content/en.test.ts`)

Per `atto1`, `atto2`, `atto3` e `finali`:

- **File e struttura.** Il file inglese esiste ed è un namespace `en` del catalogo. Ha la stessa forma annidata dell'italiano (chiavi e tipi a ogni livello) e le stesse chiavi appiattite.
- **Caricamento.** Con `createI18n` in inglese nessuna chiave della storia manca, e `t()` restituisce il testo inglese; tornando all'italiano, quello italiano.
- **Stringhe.**
  - Nessuna stringa vuota.
  - Stessi segnaposto `{param}`, compresi quelli ICU (oggi nessun testo della storia ne ha), e stessi a capo (la lettera di Clotilde ne ha 8).
  - Virgolette tipografiche bilanciate.
- **Niente italiano rimasto.** Euristica su 108 parole italiane frequenti che in un testo inglese non compaiono (articoli, preposizioni articolate, ausiliari, *cara*, *babbo*, *merlettaia*, *vaporetto*, *Molo*…). Prima del controllo si tolgono le frasi latine di Don Piero e di Nina (*Ego te absolvo*, *Sapere aude*…). Nessun testo inglese è identico all'italiano, salvo quelli fatti solo di nomi propri, per esempio «Nina».
- **Lunghezza.** Inglese ≤ 1,3 × italiano per ogni stringa.
- **Limiti dell'interfaccia**, gli stessi dei test italiani:
  - righe di gioco ≤ 90 caratteri: titoli, vignette con le varianti `d`, echi, rivelazioni, margini, risposte, suggerimenti, etichette di perline e fili, epiloghi e mancanze;
  - bigliettini e voci del Taccuino ≤ 220 caratteri.
- **Regole dei contenuti** (stato di contenuti-atti23), anche in inglese:
  - da g12 i bigliettini non dicono «Ada» (tranne quelli della scelta);
  - da g13 né il testo né le risposte nominano l'autore;
  - le lettere di L. cominciano con «My dear,», finiscono con «L.» e non fanno nomi;
  - le lettere di Livia cominciano con «My Ada,»;
  - la lettera di Clotilde comincia con «Ada,» e finisce con «C.».

## Verifica nel browser (Playwright, porta 5310)

Server di sviluppo con `?debug=1&lang=en`, viewport 390×844. Gli script sono stati usati solo per la verifica e non sono nel repository, perché `tests/e2e/` appartiene a piattaforma-qa.

- **Prologo**, con `campaign.newGame()`, poi il tombolo e `night.autoplay()`:
  - il titolo della giornata è «Grandmother's Lace»;
  - la Spinta dice «Look at the brass pins: they say where each one must be, and at what hour.»;
  - all'alba ci sono le cinque vignette in inglese: Marta «The bakery opens at six even if the world ends.», Teresa, Don Piero…;
  - nel Bilancio, le voci del Taccuino sono in inglese.
- **Atto II.**
  - **g12** (`campaign.goto('g12','sera')`, due spilli, notte in autoplay, alba): margine «Who names you, keeps you…»; vignette del nome e di Lunardi («Ada. Ada Vio. A fine name, short and precise, like a good prescription.»); Bilancio.
  - **g14:** la lettera L11 alla porta e i quattro bigliettini (Zeno, Teresa, Nina, Gino con i suoi errori).
  - **g15:** la lettera di Clotilde, con gli a capo.
- In tutte le prove non ci sono stati errori in console. Gli screenshot sono nello scratchpad della sessione.

## Revisione di qualità

Ho riletto 40 stringhe fra le più importanti, mettendo vicini italiano e inglese:

- la lettera di Clotilde;
- i quattro biglietti della scelta;
- le lettere di L. 1, 4, 7, 8 e 11;
- il fascio 1 e 3;
- i biglietti di Livia 1 e 6, e il nastro;
- le battute chiave di g14, g16, g17, g18 e g22;
- i margini degli Archivi;
- le ultime righe e i margini dei finali.

Ho migliorato:

- **Clotilde.** «it was I who sent her away» (prima «I sent her away myself»). «I made sure they went there, one by one». E la frase-proverbio senza il futuro: «Two lacemakers on the same lace tear it.»
- **Zeno, biglietto A:** «your mother needs to go free, this time».
- **Livia, biglietto B:** «You go and live.»
- **Lettere di L.:**
  - L1: «The letters, I'm sure, don't.»;
  - L7: «a hundred times over».
- **Fascio:**
  - fascio 1: «he's a good man»;
  - fascio 3: «though I hope not».
- **Finale aperto:** «At last, the bell in the tower rings in tune.»

## Decisioni

- **Inglese britannico**, come `comune.json` (*colour*, *recognise*, *practise*, *Mum*). Virgolette tipografiche “ ” per il parlato citato; apostrofo dritto, come in `comune.json`.
- **Terminologia di `comune.json` e dell'interfaccia**, senza eccezioni:
  - lace pillow (tombolo), bobbin (fuso), brass pin (spillo), skein (matassa);
  - crossing, on top / below / pass under / pass over;
  - Book of Stitches, Notebook, Archive;
  - rumour (voce), secret, note (bigliettino);
  - ivory thread, black thread, sepia black;
  - open stitch (punto aperto), Fix the hour;
  - i luoghi: Pier, Bakery, Square, Church, Pharmacy, Lighthouse.
  - Restano in italiano: Fondamenta, Sant'Arianna, Don Piero, i nomi propri, Chioggia, Burano, Padova → Padua, Venezia → Venice.
- **Vaporetto → ferry**, come in `comune.json` («the eight o'clock ferry»). Molo di Chioggia → «quay», per distinguerlo dal Pier dell'isola.
- **Secca → shallows / low tide.**
  - Il titolo di g22 è «Low Water», in coppia con «High Water» (g19).
  - «la donna della secca» → «the woman from the shallows».
  - «prendere la secca» → «hit the shoal» / «ran aground».
- **La nonna → «Grandmother»** con la maiuscola, come nome, nella voce di Ada, coerente con `comune.json`. Il Gino, che è un bambino, dice «Granny».
- **Articolo davanti ai nomi** («il Gino», «la Teresa»): in inglese cade.
  - «cara» → «dear»;
  - «figliola/figliolo» (Don Piero) → «my child» / «my son»;
  - «signorina» → «miss»;
  - «signorina merlettaia» (Lunardi) → «Miss Lacemaker»;
  - «babbo» → «Dad».
- **Voci.**
  - Teresa: «dear», frasi lunghe e di corsa.
  - Marta: frasi corte e imperativi («Gino is not to…»).
  - Don Piero: il latino resta latino.
  - Lunardi: inglese cerimonioso e un po' ridicolo («I should like», «One does not argue with fever»). Gioco di «lei/lei» in g13 reso con «I put myself in her hands. In yours, miss, I mean.»
  - Nina: ironica e libresca. *I promessi sposi* → *The Betrothed*; il «capitolo trentuno» resta.
  - Zeno: frasi brevi, senza articoli quando conta («Hundred and fourteen. As yesterday.»).
- **Calligrafie popolari.**
  - Gino scrive in minuscolo, con errori d'ortografia da bambino inglese («chirch», «Peer», «litehouse», «teecher», «sez», «tonite», «cofing», «preist») e i punti esclamativi.
  - Bepi sbaglia le doppie: «specialy», «fevver», «pases», «tel», «setle», «wil», «loose» per *lose*, «goodby».
- **Proverbi e margini** costruiti come i margini di `comune.json` («Who is on top, gives», «Who names you, keeps you»):
  - «Who weaves is not woven.»
  - «Nets can be made again. Daughters can't.»
  - «A knot not tied is a knot that stays.»
  - «One for six. And one who stayed.»
- **Giochi di parole.**
  - «Teresa crosses the street and Marta crosses herself» (anno 1958).
  - «I'm on my way, one thread at a time» per «Sto arrivando, un filo alla volta». «Vengo» di L11 resta «I'm coming».
  - Titoli degli atti come in `comune.json` (The Warp / The Weft / The Reverse).
- **Firma del fascio.** «La mamma» → «Mum». Il campo `signed` dei dati non è mostrato come testo: serve solo a scegliere la calligrafia.
- **Titoli corti.** Due titoli hanno perso l'articolo per stare nell'1,3×:
  - g01 «First Evening»;
  - g08 e g17 «Black Thread».
- **«BRAVO» sulla pagella del Gino → «WELL DONE»**, con la W grande al posto della B.
- **Etichette delle perline di conoscenza** (g17, g21, g22) rese come nomi, perché l'interfaccia le inserisce in frasi come «{chi} didn't get {perlina}»:
  - «The name of the woman in the black shawl»;
  - «The woman in black's name»;
  - «The name of the shallows woman».

## Problemi noti

- **`atto2.diario.persone.zeno.lettera`.** L'italiano dice che Zeno ha tenuto la lettera della nonna «per una notte», ma l'ha tenuta dalla notte della morte di Clotilde fino a g14. L'inglese dice «all this time». Vedi le richieste.
- **Lettere lunghe alla porta** (lettera di Clotilde, circa 150 parole). Nella finestra «At the door» a 390 px il foglio inclinato taglia il testo a sinistra e in basso. Succede uguale in italiano: è un problema di impaginazione della campagna, non della traduzione. Vedi le richieste.
- **Bigliettini lunghi** (per esempio quello di Zeno in g14). Nella scheda chiusa sono troncati con i puntini, in italiano come in inglese: è lo stile della scheda.

## Richieste per altri pacchetti

- **contenuti-atti23:** in `src/content/text/it/atto2.json`, `diario.persone.zeno.lettera`, sostituire «Zeno ha tenuto per una notte la lettera della nonna per me» con qualcosa come «Zeno ha tenuto per tutto questo tempo la lettera della nonna per me». La voce si sblocca dopo g14, e la lettera gli era stata data la notte del prologo.
- **campagna:**
  - Nella finestra degli oggetti della sera, il testo delle lettere lunghe (`lettera_clotilde`) esce dal foglio a 390×844: è inclinato e tagliato a sinistra e in basso, sia in italiano che in inglese. Serve un foglio che scorre in verticale, senza rotazione del testo, o con la rotazione solo sul foglio e il testo contenuto.
  - In `src/i18n/en/campaign.json` c'è «bell-tower clock», mentre `comune.json` usa «bell tower»: meglio uniformare.
- **piattaforma-qa:** nella suite `layout` con lingua inglese conviene aggiungere uno screenshot di una vignetta dell'alba e della sera di una giornata dell'Atto II (per esempio g12 e g14), visto che ora la storia è tradotta.
