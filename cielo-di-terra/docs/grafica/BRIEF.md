# Rifacimento grafico: avvicinare il gioco ai bozzetti

## Perché
L'utente ha giocato la Fase 1 e ha scritto: «ma è normale che la grafica non si avvicina neanche a quella delle foto?». Ha ragione. Le «foto» sono i bozzetti del concept in `idee-gioco/pagina/img/finale-1.jpg … finale-8.jpg`, nello stile che ha scelto: **un misto fra campiture piatte e pittura a mano**. Vuol dire forme grandi e pulite, silhouette forti, colori quasi piatti con sfumature morbide, profondità atmosferica a piani come quinte di teatro e sopra una leggera pennellata su rocce, muri, acqua, fogliame e cielo. La palette è calda e ricca.

Il gioco oggi sembra un prototipo low-poly: prato verde uniforme, case grigie a scatola, quasi nessun albero, nessuna atmosfera, e soprattutto **quasi tutto il mondo è carta bianca a matita**.

Obiettivo realistico: chi mette una schermata accanto al bozzetto deve riconoscere **lo stesso mondo, la stessa luce, la stessa palette e la stessa profondità**, con meno dettaglio di un dipinto. I riferimenti di qualità sono giochi stilizzati in tempo reale: *Breath of the Wild* (erba e alberi pittorici, foschia), *Firewatch* (campiture e piani atmosferici), *Outer Wilds*, *Sable*, i fondali dei film Ghibli.

Guarda per primi i bozzetti 1, 2, 3 e 5 e le inquadrature di confronto del gioco, fatte nella stessa scena e alla stessa ora:
- `docs/shots/confronto-1-alba-castagno.png` contro `finale-1.jpg`
- `docs/shots/confronto-2-terrazze-mezzogiorno.png` contro `finale-2.jpg`
- `docs/shots/confronto-3-planata-asse.png` contro `finale-3.jpg`
- `docs/shots/confronto-5-notte-paese.png` contro `finale-5.jpg`

Si rigenerano con `npm run shots -- --only=11,12,13,14`: build e2e più Chromium con SwiftShader, circa 90 s. Con `--no-build` si saltano la build e circa 60 s. Ci sono anche le inquadrature 1-6, i vecchi provini del motore. Le schermate si guardano con lo strumento Read.

## Diagnosi, in ordine di peso
1. **La matita copre il mondo.** In `src/core/settings.ts` c'è `nearPaint: [70, 150]`: oltre 150 m dal giocatore ogni particella non rilevata è disegnata come carta bianca a matita. All'inizio del gioco non c'è nulla di rilevato, quindi il cielo del cilindro (l'altra parte, a 1,3 km) e le valli intorno sono un foglio bianco.
   Nuovo disegno: il non rilevato diventa un **abbozzo ad acquerello**, cioè colori veri ma schiariti e meno saturi (circa 55-65%), velati di carta, con tratteggio e curve di livello a matita sopra. Il rilevato diventa **inchiostro e colore pieno**: contorni netti, colori saturi, pennellata. La differenza deve leggersi a colpo d'occhio, perché è una meccanica: le Fade di notte cancellano il non rilevato. Però il mondo non deve mai sembrare vuoto. Valori nuovi più larghi per `nearPaint`, e una **migrazione delle impostazioni salvate**: chi ha già giocato ha `[70,150]` nel localStorage, quindi serve cambiare la chiave o il numero di versione. L'inquadratura 6 (`setSetting('nearPaint',[6,14])` e la rivelazione) deve continuare a funzionare.
2. **Nessuna atmosfera.** L'altra metà del cilindro è opaca e contrastata come il terreno ai piedi. Nei bozzetti 1 e 3 il «cielo» è una foschia azzurra con le terre lontane appena visibili, a piani. Servono:
   - prospettiva aerea forte, con la distanza e lo spessore d'aria attraversato, colorata secondo l'ora (azzurra di giorno, dorata all'alba, blu-viola di notte);
   - un alone luminoso intorno alla Linea;
   - le nuvole del Collare come volumi morbidi dipinti, non dischi.
3. **Luce piatta.** La Linea sta sull'asse, quindi illumina ogni punto da sopra e tutto sembra mezzogiorno. Il GDD dice che all'alba la Linea «si accende dal Tappo Sud come una miccia» e alla sera si ritira verso il Tappo Sud lasciando una brace blu. Licenza artistica motivata: il nucleo più luminoso della Linea **scorre lungo l'asse** durante il giorno, così la luce principale arriva radente lungo la valle: da sud al mattino, più alta a mezzogiorno, di nuovo bassa la sera. Poi:
   - luce principale calda e riempimento freddo del cielo (emisferica);
   - ombre morbide almeno vicino al giocatore (shadow map di una sorgente virtuale che segue il giocatore);
   - occlusione ambientale cotta nei colori dei vertici per case, muri e alberi;
   - controluce sul fogliame;
   - la notte blu-viola, con pozze calde di lampioni e finestre. Oggi di notte il prato resta verde acido.
4. **Nessuna post-produzione.** Mancano:
   - render in HDR, bloom leggero per Linea, lampade e finestre;
   - mappatura dei toni (AgX o ACES) con correzione colore calda;
   - **filtro pittorico** (Kuwahara anisotropico o simile, raggio secondo la qualità);
   - contorni morbidi colorati, non neri, da profondità e normali;
   - grana di carta o tela, una pennellata leggera e la vignettatura.
   Servono livelli di **Qualità** (Bassa/Media/Alta più Automatica, misurando i primi secondi) nelle impostazioni.
5. **Vegetazione quasi assente.** I castagni sono palloni lisci con una texture stirata e i boschi lontani puntini bianchi. Servono:
   - castagni con chiome pittoriche: ciuffi di foglie su forme rotonde, normali sferiche per un'ombreggiatura morbida in due toni, luce calda sui bordi, un po' di vento;
   - boschi fitti sui versanti (instancing più LOD o impostori);
   - erba a ciuffi vicino al giocatore, che si muove;
   - cespugli, felci, fiori, erba secca dorata, rocce con muschio.
   Stagione: autunno come nel bozzetto 1 (il prologo è a ottobre, con ricci di castagne a terra; Elvira innesta e dice «lo saprò in primavera»), quindi castagni gialli, oro e ruggine mescolati al verde.
6. **Terreno uniforme.** Oggi è un verde unico e i muri a secco delle terrazze hanno lastre di copertura enormi, piatte e bianche. Servono:
   - variazione di colore: prati verdi, erba secca dorata, sentieri di terra ocra, roccia grigia sui pendii ripidi con strati dipinti, muschio;
   - pennellata ancorata al mondo;
   - muri a secco con pietre leggibili.
7. **Paese a scatole.** Le case ticinesi devono diventare rustici veri:
   - pietra grezza dipinta (grigio caldo, ocra);
   - tetti di piode spessi con file di lastre visibili e sporgenza;
   - lobbie e balconi di legno, camini con la piota sopra;
   - finestrelle con persiane di legno;
   - chiesa e campanile intonacati (bianco e ocra);
   - occlusione dove i muri toccano terra.
8. **Prima persona a blocchi.** Servono:
   - mani con guanti di cuoio marrone e dita leggibili;
   - manica di lana verde con il polsino, come nei bozzetti;
   - il Velo di tela con le cuciture, le corde e la nappa;
   - lo squadro d'ottone lucido.

## Vincoli (non si discutono)
- **Solo grafica.** Non cambiano:
  - gameplay, fisica, collisori, altezze del suolo per la fisica (`groundHeight`/`surfaceHeight`);
  - posizioni degli oggetti interattivi, contenuti JSON, tempi e testi.
  Se cambia la forma visibile di un oggetto solido, deve restare coerente col collisore: niente muri invisibili e niente compenetrazioni evidenti.
- **Prestazioni.** Obiettivi: 60 fps a 1080p su un portatile medio con grafica integrata (Intel Iris Xe) a qualità Media; almeno 30 fps a Bassa sui computer deboli; Alta per le schede dedicate. Usa instancing e geometrie unite. Tieni d'occhio `drawCalls` e `triangles` (`window.__GAME__.getStats()` e il riepilogo di `npm run shots`): circa 400 draw call e 2,5 M di triangoli al massimo ad Alta. I tempi di SwiftShader valgono solo come confronto relativo.
- **Test.** Devono restare verdi `npm run typecheck`, `npm test` e `npm run build`. Il test end-to-end `npm run e2e:fase1` (circa 3 minuti; gioca il prologo e la missione 1 con tasti veri) lo esegue l'integratore, ma non rompere le API che usa: `window.__GAME__` (`capture`, `timedRender`, `getStats`, `teleport`, `look`, `lookAt`, `setTime`, `setSetting`, `revealCells`…) e `preserveDrawingBuffer` in modalità e2e.
- **Tecnologia.** three.js 0.186 con WebGLRenderer su WebGL2 (WebGPU no: si pianta su Chromium headless). Le shader seguono lo schema esistente (`src/render/worldMaterial.ts` e `src/render/shaders/common.ts`). Oggi `ColorManagement.enabled = false` e l'uscita è `LinearSRGBColorSpace`, con colori pensati già in sRGB. Se la post-produzione cambia questo schema, deve restare tutto coerente: colori dell'interfaccia 3D, prima persona, sovrapposizioni della regia (`SistemaGioco.overlay`).
- Commenti e documentazione in italiano. TypeScript strict.

## Come si lavora (agenti in parallelo)
- Lavori in una **copia isolata** del repository (git worktree). Trova la radice con `git rev-parse --show-toplevel`; il gioco è in `<radice>/cielo-di-terra`. Prima di tutto: `ln -s /home/user/claude/cielo-di-terra/node_modules <radice>/cielo-di-terra/node_modules` (se non c'è già) e `git switch -c grafica/<nome-traccia>`.
- **Tocca solo i file della tua traccia**, elencati nel compito. Se proprio devi toccare un file condiviso, fai una modifica piccola, additiva e localizzata, e scrivilo nel resoconto. Preferisci file nuovi.
- Lavora a tappe: modifica, screenshot, guarda, confronta col bozzetto, correggi. Non fermarti alla prima versione: vai avanti finché il confronto è convincente.
- Le schermate rigenerate in `docs/shots/*.png` **non vanno committate**, perché farebbero conflitto fra tracce: prima del commit `git checkout -- docs/shots/`. Copia le tue schermate finali in `docs/grafica/<nome-traccia>/`.
- Alla fine scrivi `docs/grafica/<nome-traccia>.md`: che cosa hai cambiato, prima e dopo, come si regola (uniform, impostazioni), numeri di prestazione, che cosa resta. Fai **commit sul ramo `grafica/<nome-traccia>`** con un messaggio chiaro. **Niente push** e nessuna modifica ad altri rami.
