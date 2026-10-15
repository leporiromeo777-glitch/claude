# Revisione 2 (dopo il secondo playtest)

Fonte: `docs/stato/PLAYTEST-2.md` e `docs/stato/playtest-2.json`: 4 giocatori simulati più la suite end-to-end, 77 segnalazioni (Q001-Q077). Ogni giocatore ha dato 7/10 al divertimento. La chiarezza va da 5 a 7.

Obiettivo: arrivare a divertimento e chiarezza di almeno 8. Per farlo bisogna eliminare ogni punto in cui il gioco «mente» (suggerimenti, record, stati) e ogni incoerenza della storia sui rami non d'oro. Poi vanno rifinite le cose che si vedono.

Le decisioni e i contratti della revisione 1 (`REVISIONE-1.md`) restano validi. Qui si aggiungono solo i punti nuovi.

## Gruppi e proprietà dei file

| Gruppo | File |
|---|---|
| tombolo-motore | `src/tombolo/`, `src/i18n/*/tombolo.json`, `tests/unit/tombolo/`, `src/engine/`, `tools/levels/`, `tests/unit/engine/` |
| campagna | `src/campaign/`, `src/i18n/*/campaign.json`, `tests/unit/campaign/` |
| contenuti-atti23 | i file di contenuto degli Atti II-III, dei finali e di arc3-arc6, con i testi it/en; `tests/unit/content/atto23.test.ts` |
| schermi-atto1 | `src/screens/`, `src/core/`, `src/audio/`, `src/main.ts`, `src/content/loader.ts`, `src/content/validate.ts`, `index.html`, `public/`, `package.json`, `vite.config.ts`, `README.md`, `src/i18n/*/{ui,core,audio}.json`, `tests/unit/{screens,core,audio}/`, i contenuti dell'Atto I e comuni (`src/content/*.json` comuni e atto1, livelli g00-g08 arc1 arc2, `text/{it,en}/{comune,atto1}.json`, `tests/unit/content/{atto1,en}.test.ts`), `docs/GDD.md` (solo per Q077) |

`tests/e2e/` non appartiene a nessun gruppo: tenete stabili i data-test.

## Decisioni nuove

**R2-D1. I suggerimenti non mentono mai** (gruppo tombolo-motore). Riguarda Q-lampada: g12 prima del nome, g13 che ripete la bozza, Indizio e Fantasma con un solo incrocio quando la riga ne vuole due.
- L'Indizio confronta la bozza con la riga della soluzione:
  - se la bozza coincide, dice «Quest'ora va bene: fissala»;
  - altrimenti nomina il primo incrocio mancante o sbagliato.
- Il Fantasma mostra TUTTI gli incroci della riga.
- Prima che il nome di Ada sia appuntato, nessun verdetto «non si può compiere» e nessun «A rischio» sulle condizioni che dipendono dal nome.
- La cache dei suggerimenti si invalida quando cambiano il nome, la bozza o le richieste accettate.
- «Fissa fino alle N» compare solo se il solver conferma che le ore vuote lasciano una soluzione per le richieste accettate, e mai nelle notti con tutorial.

**R2-D2. I numeri del bilancio sono veri** (gruppi tombolo-motore e campagna).
- Gli incroci contati per eleganza, record e filo d'oro sono solo quelli del giocatore. Restano fuori il filo nero, i fili autonomi e gli incroci forzati.
- I record (minimo incroci, quiete, spartito) si aggiornano solo se tutte le richieste accettate sono soddisfatte e per lo stesso insieme di richieste. Un merletto fallito non è mai «nuovo record».
- «Primo filo d'oro» compare una volta sola nella vita del salvataggio.

**R2-D3. La storia regge su TUTTI i rami** (gruppo contenuti-atti23, testi Atto I in schermi-atto1).
- Ogni vignetta, esito, voce del Taccuino, carta della scelta ed epilogo deve essere coerente con i flag e gli esiti reali. Esempi:
  - Nina ammessa solo se la domanda è partita;
  - Nina parte una volta sola;
  - lettere restituite una volta sola;
  - Taccuino coerente con la pace fallita;
  - carta A firmata da Don Piero con il testo suo.
- Scrivete un test che simula la campagna su più rami (tutto fallito, tutto riuscito, misti a caso con seme fisso) e controlla le condizioni di coerenza dichiarate nei dati.
- Le ripetizioni (alba, esito e Taccuino che dicono la stessa frase) vanno eliminate: ogni livello di racconto aggiunge qualcosa.
- Le voci vaghe («o… o…») diventano precise in base a ciò che è successo.

**R2-D4. Ogni stato si vede sul tombolo** (gruppo tombolo-motore).
- Ogni perlina portata è visibile, anche la prima: è il bug grave Q-perline.
- Febbre, nodo e rancore attivi si vedono sul fuso e sul filo all'inizio della notte.
- Il filo nero che entra nelle modalità extra è annunciato.
- Le icone delle occasioni sono leggibili.
- Il finale B spiega la sua modalità con una nota.
- Il finale D ha la lampada.

**R2-D5. Fine della notte da gustare** (gruppo campagna). Dopo l'ultima ora:
1. il merletto finito resta almeno 2,5 s, con il carillon;
2. poi un tocco porta all'alba.

Chi ha l'avanzamento automatico lo vede comunque per 2,5 s. Il finale vero ha un riconoscimento visibile sul Telaio e sul titolo: la Tovaglia nominata e mostrata.

**R2-D6. Archivio 1958** (gruppo contenuti-atti23). Gli ultimi nomi devono essere deducibili da indizi nel merletto registrato:
- spilli d'ottone storici;
- note a margine;
- perline caratteristiche;
- gli echi già sbloccati.

Niente tentativi alla cieca. Va verificato rileggendo il merletto come farebbe un giocatore.

**R2-D7. Atto I un po' più impegnativo per chi è bravo** (gruppo schermi-atto1, contenuti Atto I).
- Senza toccare g00-g02 (tutorial), in g04-g08 ogni sera deve avere almeno una combinazione di 2 bigliettini che richiede di pensare. Criterio: almeno il 30% di soluzioni non ottime tra quelle brevi, oppure una deduzione sull'ordine.
- La regola di Gino deve pesare almeno in una notte dell'Atto I (g05 o g07): la sua corsa deve servire a portare qualcosa.
- Si misura con levels:check e si lascia verde --qualita.

## Esecuzione

Ogni gruppo prende tutte le task di `revisione-2.json` (P0, poi P1, poi P2), applica le decisioni qui sopra e scrive la sezione «Revisione 2» nel proprio rapporto di stato. Se una segnalazione riguarda file di un altro gruppo, non la tocca e la riporta.
