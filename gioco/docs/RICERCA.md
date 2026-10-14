# TRAMA: ricerca e motivazioni della scelta
### 14 ottobre 2026

> Sintesi delle tre ricerche (mercato, design, tecnica), dei quattro concept proposti e del giudizio di tre giurie (critico, produzione, mercato). Spiega perché si fa **TRAMA. Il merletto dei giorni** e come è stato corretto rispetto al concept originale. Il progetto vero e proprio sta in `GDD.md` e `ARCHITETTURA.md`.

---

## 1. Cosa dice il mercato (2024-2026)

**Generi saturi, da non usare come struttura principale**

- **Roguelike deckbuilder e cloni di Balatro**: 212 usciti su Steam nel 2025, solo il 5,1% oltre le 1.000 recensioni. Vincono solo marchi forti (Slay the Spire 2, Vampire Crawlers).
- **Survivors-like**: il momento d'oro è finito; riescono solo i giochi con una svolta forte (Megabonk, Ball x Pit).
- **Cozy farming e life sim**: 350 giochi di fattoria e 966 life sim nel 2025, molti "copia e incolla".
- **Survival crafting**: costoso e lento da produrre, molti giochi nuovi sotto i 200 giocatori.
- **Co-op online** ("friendslop"): forte, ma incompatibile con il nostro vincolo offline.

Contesto: circa 20.000 giochi su Steam nel 2025, solo il 3% degli indie supera le 1.000 recensioni, 4.300 demo alla Next Fest di giugno 2026.

**Cosa funziona**

- Un hook che si spiega in una frase, di solito "X + Y inatteso" (Balatro, Ball x Pit, Titanium Court, Mewgenics, CloverPit).
- **La conoscenza come progresso** (Blue Prince, The Roottrees are Dead, Lorelei): unisce storia e rigiocabilità senza grind, ed è ancora poco affollato.
- **La narrativa vende**: nel secondo trimestre 2025 era il primo genere per numero di indie oltre le 1.000 recensioni.
- Giochi **brevi, completi ed economici**; seed giornaliero condivisibile.
- Alla Next Fest 2026 puzzle e narrativi single-player erano pochissimi: c'è spazio per un'identità forte.

**Mobile premium**

- Il premium è in ripresa (+77% di uscite nel 2025); Balatro ha incassato 21,3 milioni di dollari su mobile.
- Funzionano: decisioni discrete e interrompibili, trascinamento e tocco singolo, testi leggibili, "niente pubblicità", circa 9,99 $ o prova gratuita + sblocco (Ball x Pit), stesse funzioni su PC e mobile, offline.
- Apple premia originalità e temi forti (Blue Prince, Is This Seat Taken?, Dredge, Consume Me).
- Strategia tipica: prima PC e web per recensioni e passaparola, poi mobile con lo stesso contenuto. Vampire Survivors è nato in HTML5: una base web + wrapper nativo è un precedente valido.

---

## 2. Cosa dice il design

Principi adottati nel GDD (tra parentesi la sezione):

1. Si avanza con la conoscenza, non con la potenza: chi sa già tutto finisce in fretta (GDD 1, 8).
2. Mappa piccola con molti strati: un'isola, sei luoghi, gli stessi personaggi che cambiano significato (2, 5).
3. La sconfitta fa avanzare la storia: una richiesta fallita ha conseguenze scritte e mostra un'informazione nuova (3.7, 4.2).
4. Battute reattive e data-driven con priorità e varianti di riserva (5.9).
5. Diario automatico con indizi, mai soluzioni; obbligatorio su telefono (5.8).
6. Deduzioni confermate a gruppi di tre per scoraggiare i tentativi a caso (5.3).
7. Segreti a strati: finale base per tutti, finale vero per i curiosi, alfabeto segreto per gli ossessivi (6.6, 8).
8. Insegnare senza testo: una meccanica per volta, introduzione, sviluppo, combinazione, svolta (4.3, 9).
9. Nessuna sessione vuota: un oggetto garantito ogni sera (4.2, 5.6).
10. Sessioni da telefono: 10-20 minuti, interrompibili, salvataggio a ogni ora (4.2).
11. Mai senza direzione: una pista evidenziata e suggerimenti a tre gradini (5.8, 14).
12. Meccaniche e storia nascono insieme: le svolte di trama cambiano le regole (3.6, 6.3).
13. Sbloccare varietà, non statistiche (7).
14. Scrivere il finale per primo: bibbia della verità e cronologia (6.1).
15. Comandi pensati prima per il touch: trascinare, bersagli ≥ 44 pt, azioni in basso (10, 11).
16. Il limite stilistico diventa identità: legno tornito, un solo strato saturo (12).

Trappole evitate: run vuote, grind, potenziamenti permanenti, enigmi che richiedono carta e penna, risposte a formulazione esatta, finale affrettato, tutorial a muro di testo, scene non saltabili, joystick virtuali, interfaccia negli angoli alti, testo piccolo, progressi persi in background, diramazioni che esplodono.

---

## 3. Cosa dice la tecnica (verificato nel container)

- Vite 8.3.4, TypeScript 7.0.2, Capacitor 8.5.3 e i plugin funzionano; `cap add android` e `cap add ios` funzionano su Linux (iOS con Swift Package Manager).
- Nel container si compilano l'APK di debug (5,2 MB) e l'AAB di release (3,4 MB). iOS richiede un Mac con Xcode 26+.
- Playwright va fissato a 1.56.1 (il Chromium installato); WebGL2 funziona, ma Canvas 2D senza `--use-angle=swiftshader` è veloce (2.000 drawImage in 11-13 ms).
- Blender 5.2.2 come modulo Python: Cycles su CPU a 128 px, 16 campioni con OIDN, circa 0,12 s a frame; EEVEE inutilizzabile senza GPU; usare `view_transform = Standard` e PNG a 8 bit.
- Store: Apple guideline 4.2 (niente "sito ricaricato": offline, haptics, nessun comportamento da browser), 2.5.2 (niente codice scaricato), privacy manifest; Google Play target API 36 e test chiuso di 12 tester per 14 giorni per gli account personali nuovi.

---

## 4. I quattro concept e la classifica

| # | Concept | Hook | Punteggio aggregato | Scelte delle giurie |
|---|---|---|---|---|
| 1 | **TRAMA. Il merletto dei giorni** | Puzzle di trecce in cui i fili sono persone: chi passa sopra consegna | **55,8** | **3 su 3** |
| 4 | NODI. Un filo, un paese, una notte | Un nastro che lega le case e regge solo ciò che è vero | 50,8 | 0 |
| 2 | Campanile. L'ultimo giorno di Tèrmine | Sei la campana di un paese sommerso; vedi solo chi ti sente | 48,6 | 0 |
| 3 | Valdinebbia. Campane nella nebbia | Il suono come campo fisico su una mappa esagonale | 48,0 | 0 |

Voti delle tre giurie (critico / produzione / mercato), scala 1-10:

| Concept | Originalità | Divertimento e profondità | Storia | Rigiocabilità | Fattibilità | Cross-platform |
|---|---|---|---|---|---|---|
| TRAMA | 7 / 9 / 9 | 7 / 8 / 8 | 7 / 8 / 8 | 6 / 7 / 8 | 8 / 7 / 8 | 9 / 9 / 9 |
| Campanile | 8 / 8 / 9 | 5 / 6 / 7 | 9 / 9 / 10 | 5 / 4 / 5 | 6 / 6 / 6 | 7 / 6 / 7 |
| Valdinebbia | 7 / 8 / 8 | 7 / 8 / 8 | 5 / 7 / 7 | 9 / 9 / 9 | 4 / 4 / 5 | 5 / 5 / 5 |
| NODI | 7 / 8 / 9 | 7 / 7 / 8 | 8 / 8 / 9 | 7 / 8 / 7 | 5 / 5 / 5 | 7 / 7 / 7 |

**Perché TRAMA.** È l'unico concept forte insieme su hook, adattamento al touch e fattibilità:

- un verbo nuovo e tattile (trascinare un fuso sopra un altro), decisioni da 5-15 secondi, nessun timer, verticale a una mano;
- la meccanica coincide con il tema: "trama", "ordito", "intreccio" sono le parole italiane del racconto;
- **il nucleo è piccolo e deterministico**: al massimo 720 permutazioni più pochi bit di perline. Un solver verifica ogni livello, calcola il minimo, genera suggerimenti e merletti del giorno. Per un team di agenti AI senza playtester umani è decisivo: la qualità dei puzzle si può **garantire** con i test;
- il merletto è disegnato in codice (non dipende dalla qualità dei render) e gli asset Blender sono i più semplici possibili (oggetti torniti, niente volti, niente animazioni);
- rischio di rifiuto sugli store quasi nullo; si vende con una frase e uno screenshot che nessun altro gioco ha.

**Perché non gli altri.**

- **Campanile** ha la storia migliore, ma minuto per minuto è "inserisci un codice e leggi", con un puzzle tutto o niente, input a tempo fragile su touch e rigiocabilità quasi nulla.
- **Valdinebbia** ha il sistema più profondo, ma è illeggibile su un telefono da 360 pt (esagoni da circa 33 pt), ha la storia più generica, la sovrastruttura roguelite che il mercato punisce e lo scope più rischioso.
- **NODI** ha l'idea più brillante ("il filo tiene solo il vero"), ma il cuore viene da un'opera esistente (Legarsi alla montagna di Maria Lai), si appoggia a un loop temporale consumato e richiede un social sim narrativo coerente, la cosa più difficile da scrivere bene senza playtest.

---

## 5. Le correzioni dei giudici e come sono state applicate

| Problema segnalato | Correzione nel progetto | Dove |
|---|---|---|
| Modello spaziale incoerente: colonne = luoghi ma fili da 3 a 6, due persone mai nello stesso luogo | Ogni colonna è sempre occupata: i posti liberi li riempiono **fili di lino** (passanti). La Fondamenta è stretta, quindi per passare bisogna incontrarsi: lo scambio di posto ha un senso nel mondo | GDD 2, 3.1-3.2 |
| Troppe regole (circa 15) | 10 pagine del Libro + 8 stranezze, ognuna con debutto sicuro. Tagliati: torsione, forbici come meccanica, Gino che incrocia due volte (diventa "deve incrociare ogni ora", compatibile col modello), fili dalla terraferma come regola a parte (assorbiti dalla regola del Molo) | GDD 3.5-3.8, 5.7 |
| Giocare a tentativi riga per riga, nessun costo | **Matassa**: ogni incrocio costa un braccio; margine +3 / +2 / +1 per atto, 0 nella notte più lunga. Filo d'oro per chi tesse col minimo | GDD 3.7, 3.13-3.14 |
| L'esempio della giornata 4 era sbagliato (6 incroci dichiarati, almeno 7 necessari) | Due esempi **verificati con un solver prototipo**: prologo (minimo 4, 3 soluzioni ottime) e giornata 6 (minimi 0 / 5 / 5, una combinazione impossibile voluta) | GDD 3.15-3.16 |
| Puzzle e numeri scritti a mano dagli agenti usciranno sbagliati | Nessun numero a mano: `npm run levels:check` calcola minimi, matassa suggerita e soluzioni per ogni combinazione di richieste; il generatore procedurale ha un filtro di qualità (risolvibile, non banale, non ambiguo, usa la regola del giorno) | ARCHITETTURA 5.2, 15.2 |
| Stranezze scoperte giocando = informazione nascosta | Lo stato del merletto è sempre tutto visibile; le stranezze si rivelano al primo effetto in giornate dove non possono far fallire richieste, poi restano come icona sul fuso | GDD 3.6 |
| Alba ripetitiva (diorami a stampo) | Al massimo 3 vignette scelte per priorità, saltabili; ogni richiesta fallita mostra un quadro con un'informazione nuova | GDD 4.2, 5.9 |
| Tropi: diga (in 3 concept su 4), guardiano padre segreto, nonna santa, protagonista passiva | Diga e Contessa eliminate; Zeno non è il padre (il padre è un fatto noto, non un mistero); **Clotilde è colpevole e ambigua** (la faida del 1936, la febbre del 1958, la figlia esiliata, le lettere sepolte, ma anche sei bambini salvati); Ada risponde ai bigliettini, deduce gli autori anonimi, sceglie il finale | GDD 6 |
| Rigiocabilità da puzzle game | Merletto del giorno, Merletto libero con 6 gradi, spartito condivisibile, Telaio con "Riprendi da qui" (la conoscenza resta), Ripassa, record di eleganza; Settimana procedurale nel livello L2 | GDD 8 |
| L'Archivio è un secondo gioco | Usa lo stesso tombolo: si nominano i fili (conferma a gruppi di 3) e poi si **rammendano** le righe strappate, cioè si esegue la soluzione | GDD 5.3 |
| "Simmetria" non definita | Definita formalmente (specchio delle coppie nella stessa riga) | GDD 3.14 |
| Finali che richiedono nuove IA | Un solo algoritmo di autotessitura deterministico per filo nero, finale "filo di seppia", finale aperto e Archivio A6 | GDD 3.10 |
| Scope gonfio | Livelli L1, L2, L3 e una lista di tagli ordinata | GDD 16 |
| Leggibilità sul telefono | Massimo 6 colonne da almeno 52 px; motivo e icona per ogni filo, forma per ogni perlina; screenshot automatici a 360×640 | GDD 12, 14; ARCHITETTURA 15.2 |
| Nome debole per la ricerca negli store | Nome di store "Trama – Il merletto dei giorni"; verificare il marchio (EUIPO, USPTO) prima di fissare l'`appId` definitivo | GDD 0, 15 |
| Modello commerciale | Prova gratuita + sblocco unico sugli store; modulo `entitlements` da subito, tutto sbloccato sul web | GDD 15 |

---

## 6. Innesti dagli altri concept

**Accettati**

| Da | Idea | Come è entrata in TRAMA |
|---|---|---|
| Campanile | Il Fondo: un oggetto nuovo garantito fra una sessione e l'altra | La laguna restituisce ogni sera un oggetto: le bottiglie con le lettere di "L." (GDD 4.2, 5.6) |
| Campanile | La crepa che si ripara e si sente | La campana del campanile è stonata e si intona atto dopo atto (GDD 13.2) |
| Campanile | Il finale falso che non chiude il salvataggio | "Il merletto chiuso": ripetere la colpa della nonna riporta alla sera della scelta (GDD 6.6) |
| Campanile | "Vedi solo chi ti sente" | Riletto come "chi ti nomina ti tiene": il nome di Ada, la memoria, i bigliettini anonimi da attribuire (GDD 3.11) |
| Campanile | La soluzione si esegue | Il rammendo dei merletti d'Archivio (GDD 5.3) |
| Campanile | Bibbia della verità e livelli di priorità | Cronologia scritta per prima (GDD 6.1), L1/L2/L3 (GDD 16) |
| NODI | Un solo colore saturo come identità | Direzione "Velluto e filo" (GDD 12) |
| NODI | Quadri del fallimento | Vignetta con informazione nuova per ogni richiesta fallita (GDD 4.2) |
| NODI | Fonti etichettate, dialoghi già visti in una riga | Taccuino (GDD 5.8) |
| NODI | "Riparti da un'ora" presto | Telaio con Riprendi da qui dalla prima giornata (GDD 8) |
| Valdinebbia | Gradi alla Hades | Gradi del Merletto libero (GDD 8) |
| Valdinebbia | Spartito condivisibile senza server | Spartito (GDD 8; ARCHITETTURA 14.6) |
| Valdinebbia | Bot di bilanciamento | Giocatore avido nel filtro del generatore (ARCHITETTURA 5.2) |
| Valdinebbia | La statuina che perde colore | La figurina di Ada diventa legno grezzo per chi l'ha dimenticata (GDD 3.11, 12.5) |
| Valdinebbia | I salvati diventano strumento | La riconciliazione di Teresa e Marta toglie due stranezze e il rancore: la storia cambia la cassetta degli attrezzi (GDD 3.6, g18) |
| Valdinebbia | Ogni suono ha un equivalente visivo | Regola dell'audio (GDD 13.6) |

**Respinti, con il motivo**

- "Il filo tiene solo il vero" (bigliettini che mentono) nella storia: romperebbe il principio dello stato sempre visibile. Resta come idea per la Settimana (L2, archetipo "malalingua").
- Spillo rosso con due usi (accettare o convincere): raddoppia lo spazio di ricerca del solver per poco guadagno.
- Trenta giornate: diventano 24 più la giornata finale, per non stirare il contenuto.
- Tovaglia ed Esercizi della nonna nel livello obbligatorio: spostati a L3 e L2.

---

## 7. Fonti principali

Mercato: Spawn Point Marketing (luglio 2026), How To Market A Game (Chris Zukowski, 2025), GameDiscoverCo, PC Gamer, Destructoid su dati SteamDB, GamesIndustry.biz su dati AppMagic (luglio 2026), Pocket Tactics, Apple Design Awards 2026, IGF 2026.
Design: GDC Vault (Outer Wilds, Obra Dinn), Thinky Games sul "metroidbrainia", Game Developer su Inscryption, Tunic e Slay the Princess, interviste Supergiant su Hades, recensioni di Blue Prince e Lorelei.
Tecnica: documentazione Capacitor 8 (environment setup, SystemBars, screen-orientation, privacy manifest, Preferences), Apple App Review Guidelines e TN3192, Android 16 su orientamento e ridimensionabilità, Google Play test chiuso, WebKit bug 291892 e 294338; misure dirette nel container (Blender, Capacitor, Playwright).
L'elenco completo dei link è nelle tre ricerche originali del progetto.
