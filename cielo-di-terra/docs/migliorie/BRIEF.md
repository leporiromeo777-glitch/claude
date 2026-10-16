# Migliorie dopo la prova del 16 ottobre

## Che cosa ha scritto chi gioca
Dopo il rifacimento grafico l'utente ha giocato di nuovo il prologo e ha scritto:

> «ci sono ancora tante cose da migliorare come la grafica del suolo. il fatto che i personaggi si muovono in maniera strana quando parlano. alcune porte che non si vedono e sono incastrate. il fatto che la dinamica dell'aspettare dura troppo e inoltre voglio vedere un orologio sullo schermo per sapere che ore sono nel gioco»

Sono cinque lamentele, divise in quattro tracce:

| Traccia | Ramo | Lamentela |
|---|---|---|
| suolo | `migliorie/suolo` | «la grafica del suolo» |
| parlare | `migliorie/parlare` | «i personaggi si muovono in maniera strana quando parlano» |
| porte | `migliorie/porte` | «alcune porte che non si vedono e sono incastrate» |
| tempo | `migliorie/tempo` | «l'aspettare dura troppo» e «un orologio sullo schermo» |

`segnalazione-suolo.webp`, in questa cartella, è la schermata che l'utente ha mandato poco prima: prologo, strada del paese sotto il campanile, prima mattina. In quella schermata l'interfaccia è senza stili perché mancava un file nella pubblicazione; quel difetto è già risolto e non riguarda queste tracce. Il suolo però è proprio quello che si vede oggi:
- una spalmata arancio-ocra quasi uniforme;
- ciuffi gialli a fiammella;
- la strada come una fascia arancione piatta;
- niente erba, terra o sassi riconoscibili da vicino.

## Regole comuni
- **Come si lavora.**
  - Ogni traccia lavora in una copia isolata (git worktree). La radice si trova con `git rev-parse --show-toplevel`; il gioco è in `<radice>/cielo-di-terra`.
  - Prima di tutto: `ln -s /home/user/claude/cielo-di-terra/node_modules <radice>/cielo-di-terra/node_modules`, se non c'è già. Il collegamento non va mai committato.
  - Poi `git switch -c <ramo>`, oppure `git switch <ramo>` se esiste già (vedi *Ripresa*).
- **Commit sul proprio ramo**, niente push. Il messaggio deve finire con:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_016L3mhZfM8m5LnzdjzNNuFY
  ```
- **Prove.**
  - Devono restare verdi `npm run typecheck`, `npm test` e `npm run build`.
  - Chi cambia il gioco (tempo, porte) fa girare anche `npm run e2e:fase1`, circa 5 minuti: gioca prologo e missione 1 con tasti veri e deve dire «prova ok».
  - Non rompere le API usate dalle prove: `window.__GAME__` (`regia`, `capture`, `teleport`, `lookAt`, `setTime`, `setSetting`, `getStats`…).
- **Schermate.**
  - `npm run shots` (oppure `--only=…`) e Playwright con Chromium in `/opt/pw-browsers`, flag SwiftShader come negli script esistenti.
  - Le schermate rigenerate in `docs/shots/*.png` non si committano (`git checkout -- docs/shots/` prima del commit).
  - Le schermate prima/dopo della traccia vanno in `docs/migliorie/<traccia>/` (JPEG, al massimo circa 15 file).
  - Le schermate si guardano con lo strumento Read: ogni correzione va **vista**, non solo supposta.
- **Prestazioni.** Obiettivo: 60 fps a 1080p su grafica integrata (Iris Xe) a qualità Media. Tieni d'occhio draw call e triangoli (`__GAME__.getStats()`): nessuna regressione evidente.
- **Il computer ha solo 4 processori** e più tracce girano insieme. Le prove pesanti (e2e, shots completi) si fanno solo quando servono, e mai due volte di fila senza motivo.
- **Resoconto.** Alla fine scrivi `docs/migliorie/<traccia>.md`: che cosa non andava (con la causa trovata), che cosa hai cambiato, come si regola, le prove fatte, che cosa resta.
- Commenti e documentazione in italiano. TypeScript strict.
- **Ripresa.** Se il tuo ramo esiste già (`git branch --list`), un lavoro precedente è stato interrotto da un riavvio. Allora:
  1. NON ricrearlo: fai `git switch <ramo>`; se risulta in uso altrove, prima `git worktree prune`;
  2. leggi `git log` e il diff;
  3. continua da dove era arrivato.

## Traccia «suolo» (`migliorie/suolo`)
**Obiettivo:** il terreno ai piedi e a media distanza deve leggersi come nei bozzetti 1 e 2 (`<radice>/idee-gioco/pagina/img/finale-1.jpg` e `finale-2.jpg`):
- prato con erba vera e ciuffi;
- macchie verdi mescolate all'oro secco e alla ruggine delle felci;
- sentieri e strade di terra battuta o selciato, con bordi d'erba e sassi;
- rocce con muschio;
- fiori qua e là.

Nel bozzetto si distinguono i materiali a colpo d'occhio, con colori caldi ma non tutto arancione.

**Prima di toccare il codice, trova la causa.** Pesa ogni passaggio:
- shader del terreno (`src/render/shaders/terreno.ts`, `src/render/terrainMesh.ts`, colori dei vertici in `src/popolamento/terreno.ts` e `src/popolamento/sentieri.ts`);
- sottobosco ed erba (`src/render/shaders/natura.ts`, `src/render/naturaMateriali.ts`, `src/scene/vegetation.ts`);
- post-produzione (`src/render/post/`): Kuwahara, pennellate, viraggio caldo e mappatura dei toni possono spalmare e arancionare il suolo;
- luce (`src/render/luce.ts`).

Lavora con prove A/B (spegnendo un passaggio alla volta).

**Inquadrature da fare prima e dopo**, sempre alla stessa ora:
- la strada del paese sotto il campanile verso le 6:30, cioè la vista della segnalazione;
- il belvedere del prologo all'alba;
- le terrazze a mezzogiorno;
- un prato in pendio verso le 17;
- un sentiero di notte.

Ognuna a qualità Media, più una a Bassa e una ad Alta.

**Vincoli.** Non toccare `groundHeight`/`surfaceHeight` né i collisori. Puoi toccare la post-produzione, ma in modo che la resa di cielo, case e personaggi non peggiori: guarda anche le schermate 11-14 di `npm run shots`.

## Traccia «parlare» (`migliorie/parlare`)
**Obiettivo:** chi parla con il giocatore deve muoversi in modo naturale e tranquillo, come una persona vera in una conversazione:
- piccoli cenni del capo;
- un gesto ogni tanto, non a ogni battuta;
- il peso che si sposta;
- girarsi verso chi ascolta con una rotazione morbida.

Non deve mai:
- scattare, ruotare su se stesso o scivolare;
- far passare le braccia nel corpo, girare i polsi all'indietro o fare movimenti a scatti;
- alzarsi se è seduto.

**Prima di toccare il codice, osserva.** Fai partire i dialoghi veri della Fase 1 con la regia (`window.__GAME__.regia`, vedi `scripts/e2e-fase1.mjs` per come si arriva ai passi). Cattura sequenze di fotogrammi (8-10 al secondo per 6-8 secondi) di ogni personaggio che parla:
- in piedi e seduto;
- con oggetti in mano (bastone, pietra, forbici);
- i velati;
- le figure procedurali di riserva.

Mettile in fogli di provini e guardale. Descrivi esattamente che cosa è strano: gesti a ogni battuta (`annunciaBattuta`), indicazione con IK, rotazione verso il giocatore, respiro esagerato, scatti fra i pesi, mani che attraversano il corpo, gonne.

**File:**
- `src/personaggi/animatore.ts`, `fabbrica.ts`, `sedute.ts`, `gonne.ts`;
- `src/regia/png.ts` e `src/regia/dialoghi.ts`, solo per come chiamano le battute e il girarsi;
- `src/oggetti/oggetti/abitante.ts`, per i personaggi procedurali.

Aggiungi test che misurano la continuità: niente salti di angolo fra un fotogramma e l'altro, e limiti alle articolazioni.

## Traccia «porte» (`migliorie/porte`)
**Obiettivo:** tutte le porte del mondo devono vedersi e stare dove una porta ha senso.

Dopo il rifacimento del paese (rustici nuovi, 38 annessi addossati, altezze cambiate, paese «a grumo») alcune porte non si vedono più o sono incastrate. Possono essere:
- sotto il terreno;
- dentro il muro di un annesso o di un'altra casa;
- coperte da una scala o da un muro a secco;
- sovrapposte alla facciata, cioè sfarfallano o non si vedono;
- sospese a mezz'aria;
- rivolte contro un pendio.

Ci sono anche le porte che il giocatore deve usare nella Fase 1:
- la porta del campanile;
- il fienile di Ottavio;
- la botola;
- i cancelli;
- la Cripta.

Queste devono vedersi, essere raggiungibili e non incastrare il giocatore: per esempio nessun collisore che lo blocca sulla soglia, e nessun punto d'interazione dentro un muro.

**Metodo:**
1. Trova in codice tutte le porte: `src/oggetti/oggetti/rustico.ts`, `annesso.ts`, `fienile.ts`, `campanile.ts`, `dettagli.ts`, `src/popolamento/edifici.ts`, `src/popolamento/luoghi/`, `src/popolamento/mobili.ts` e i punti `apri:`/`entra:`.
2. Scrivi una verifica automatica (test Vitest più uno script che fa una schermata di ogni porta segnalata). Per ogni porta deve controllare:
   - che la soglia sia a ±0,15 m dal suolo visivo;
   - che davanti ci sia almeno 1,2 m libero da collisori e da altri edifici;
   - che la porta non sia dentro la pianta di un altro edificio o annesso;
   - che la geometria della porta stia sulla facciata, senza sfarfallio;
   - che ci sia in ogni livello di dettaglio (LOD).
3. Correggi spostando la porta su una facciata libera, togliendo o spostando l'annesso che la copre, oppure aggiungendo un gradino o una soglia. I collisori devono restare coerenti con la forma visibile.
4. Se un punto d'interazione si sposta, aggiorna in modo coerente contenuti e prove. L'e2e deve restare verde.

Le schermate prima/dopo di ogni porta corretta vanno in `docs/migliorie/porte/`.

## Traccia «tempo» (`migliorie/tempo`)
Due richieste.

### 1. L'attesa dura troppo
Oggi l'attesa funziona così:
- un giorno di gioco dura 40 minuti reali (`OrologioStoria.minutiGiorno`);
- «Aspetta fino a» (da seduti, tasto X) accelera solo x20, cioè circa 5 secondi reali per ogni ora di gioco: aspettare la brace dalla mattina vuol dire più di un minuto fermi, la notte fino all'alba circa 45 secondi.

Rifallo così:
- **qualunque attesa** deve durare al massimo circa 5-6 secondi reali: un time-lapse con il cielo che corre, accelerazione morbida all'inizio e frenata alla fine;
- un secondo tocco (X, Invio o Spazio) salta subito alla fine con una dissolvenza;
- gli eventi della storia nell'intervallo devono comunque scattare tutti e in ordine, come oggi (`attraversa`, giro delle Fade, arrivi), e l'attesa si ferma ancora se arriva qualcuno.

Poi cerca **ogni altro punto della Fase 1 in cui il giocatore deve aspettare** del tempo reale senza poter fare niente, per esempio:
- un'ora bloccata (`orologio:max`) prima della quale non succede nulla;
- qualcuno che arriva a una certa ora;
- pause fisse della regia prima di un dialogo o di una scena.

Per ognuno:
- misura quanto dura oggi;
- accorcialo;
- assicurati che il menu «Aspetta fino a» offra la voce giusta;
- valuta se aprire l'attesa anche stando in piedi quando le indicazioni dicono di aspettare (con X il personaggio si siede da solo).

Il risultato si misura: scrivi nel resoconto i tempi reali prima e dopo di ogni attesa.

### 2. Un orologio sullo schermo
Mostra sempre, durante il gioco, l'ora di gioco (HH:MM) e il giorno, in un elemento piccolo nello stile dell'interfaccia: carta, inchiostro, IM Fell English, come la schermata del titolo e il pannello delle indicazioni. Per esempio un piccolo quadrante con il sole o la luna e l'ora scritta sotto.

**Comportamento:**
- durante l'attesa le cifre corrono;
- di notte l'aspetto lo dice;
- non deve coprire il pannello delle indicazioni, il segnalino, il fiato, i suggerimenti dei tasti, i dialoghi o la lettera;
- deve funzionare a 1280×720 e a 1920×1080;
- deve leggersi su cielo chiaro e su cielo scuro.

Mettilo nei componenti UI (`src/ui/componenti/`, nuovo `orologio.ts` e `orologio.css`). Leggi l'ora dalla fonte unica (`OrologioStoria` della regia, passando dal ponte dell'interfaccia). Aggiungi in Impostazioni la voce «Orologio a schermo», accesa di serie.

**File:** `src/regia/orologio.ts`, `src/regia/regia.ts`, `src/regia/percorso.ts`, `src/regia/interfaccia.ts`, `src/ui/`, `content/testi.json`, i test in `tests/regia/` e le prove nello script e2e se cambiano i tempi.
