# Stato del pacchetto: piattaforma-qa (parte 2, suite end-to-end)

**Stato:** done. Tutte le suite di ARCHITETTURA 15.2 (tranne `smoke`, di fondamenta) sono scritte e girano sui cinque progetti di Playwright. I test che falliscono lo fanno per difetti di altri pacchetti, descritti qui sotto con i passi per riprodurli.

La parte 1 (nativo: `android/`, `ios/`, `scripts/`, `docs/STORE.md`) è del pacchetto piattaforma-nativa e non è stata toccata.

## Riepilogo

File (tutti in `tests/e2e/`):

| File | Cosa prova | Progetti |
|---|---|---|
| `prologo.spec.ts` | Il prologo della campagna giocato con **trascinamenti veri**: mouse sul desktop, eventi touch del protocollo DevTools (pointer `touch`) su iPhone, Android e iPad, coordinate da `night.layout()`. Dal titolo («Tocca per iniziare») allo schermo nero, al biglietto, alle quattro righe di GDD 3.15: spillo di Marta a vuoto, nota a margine «Chi sta sopra, dà», tocco che rovescia, lettera consegnata, «No.» di Marta con il fuso che rimbalza, fine con 4 incroci, `night:complete` e l'alba con le tre vignette. Ogni trascinamento deve arrivare al tombolo **al primo colpo**. In più: pressione lunga → scheda del personaggio; il prologo con la sola tastiera (desktop). | 4 da gioco |
| `campagna.spec.ts` | **Percorso d'oro** dalla g00 alla scelta di g23 giocato come un giocatore che conosce la storia (helpers/campaign.ts): ogni sera si legge l'oggetto, si risponde svelando i desideri, si appuntano le richieste utili al finale vero se il solver sa tesserle insieme, di notte `night.autoplay()`, gli Archivi si aprono dalla cassapanca e si rammendano. Controlla: 24 giornate, ogni richiesta appuntata soddisfatta, 6 Archivi rammendati, `lettereLivia = liberate`, `riconciliate`, 8 desideri su 8, memoria ≥ 1 per almeno 4 a fine g22, requisiti di D **raggiunti giocando**. Poi C (torna alla sera di g23, non conta, lascia «Il punto di Clotilde»), D (Tovaglia sbloccata), A e B: epilogo, titoli col carillon, fine. Nessuna richiesta fuori da localhost. | desktop, iphone |
| `archivio.spec.ts` | arc1 dalla cassapanca: tocco su un fuso sbiadito → scelta dei nomi; 2 giusti + 1 sbagliato non confermano, 3 giusti sì; un rammendo lecito ma sbagliato si rifiuta con `tombolo.archivio.nonCoincide`, Disfa riporta allo strappo, quello registrato si accetta; tocco su un incrocio → eco; «Chiudi il merletto» → rivelazione, arc1 rammendato, domanda chiusa. | 4 da gioco |
| `salvataggio.spec.ts` | Ricarica a metà notte (senza flush) → «Continua» dal titolo riprende alla stessa riga, con la stessa bozza e le richieste lasciate cadere; pagina nascosta (`visibilitychange`) → bozza scritta nello storage subito e ciclo in pausa; esporta e importa dalle Impostazioni (conferma, salvataggio identico tranne `writtenAt`, stringa rovinata rifiutata); slot più recente corrotto → si carica l'altro con un avviso, tutti e due corrotti → si riparte da zero con un avviso. | 4 da gioco |
| `giornaliero.spec.ts` | Stessa data → stessa impronta (`levelSourceHash`) dopo il ricaricamento, in un altro contesto (altro fuso orario e lingua) e con `engine.daily`; un altro giorno → un altro merletto. «Tessi», notte tessuta, testo da condividere di GDD 8.3 con i numeri del record e lo spartito; spartito reimportato dal pannello che ritesse lo stesso merletto; carattere alterato rifiutato. | 4 da gioco |
| `layout.spec.ts` | Giro di 28 schermate (helpers/tour.ts: titolo al primo avvio e con una storia, prologo, tombolo, pausa, alba, bilancio, sera con oggetto, bigliettini e risposte, Taccuino, notte con richieste, sera e alba dell'Atto II, cassapanca e merletto d'Archivio, Telaio, scelta e carta strappata, epilogo, titoli, Merletto del giorno e risultati, spartito, libero, impostazioni, crediti) in **5 varianti**: base, testo 140%, alto contrasto, inglese, safe area 47/34. Per ogni tappa screenshot e controllo del DOM (helpers/audit.ts): testo fuori dal contenitore o dal pulsante, testo fuori schermo, bersagli < 44 px, chiavi non tradotte, elementi nella fascia della safe area (dentro i contenitori che scorrono si controllano gli estremi dello scorrimento). Una sonda verifica che il controllo veda davvero i problemi. **Daltonismo**: screenshot simulati (deuteranopia, protanopia, tritanopia con le matrici di Machado 2009, più bianco e nero) del merletto a 12 motivi e di g14; controllo sui dati: in ogni livello due fili che si confondono di colore (ΔE < 20) devono avere motivo e icona diversi, e due fili non hanno mai lo stesso motivo e la stessa icona. **Store**: 5 schermate per iPhone 6,9" (1290×2796), iPad 13" (2064×2752) e Android (1080×1920). | tutti e 5 (daltonismo: desktop, iphone; store e sonda: desktop) |
| `audio.spec.ts` | `locked` prima di un gesto, `running` dopo il primo tocco o clic, `suspended` con la pagina nascosta e di nuovo `running`; log della prima riga del prologo vero giocata col puntatore: incrocio (marta/teresa) → ora fissata → campana (ore 6 s=1) → segreto; «Tocca per continuare» dopo un'interruzione; `mute(on)`; didascalia della campana tradotta; nessun file audio scaricato. | 4 da gioco |
| `prestazioni.spec.ts` | Trascinamento continuo di 4,5 s (più dei 3 richiesti, così i 240 campioni di `perf()` sono tutti di trascinamento) su 6 colonne × 14 righe: p95 < 8 ms; heap JS < 150 MB dopo 10 giornate in autoplay (dopo la raccolta dei rifiuti, dal protocollo DevTools); budget della build di ARCHITETTURA 16 (JS e worker gzip, CSS, font, asset, atlas). | desktop |
| `i18n.spec.ts` | In inglese nessuna chiave L1 mancante (core, ui, tombolo, campaign, audio, comune), storia inglese controllata a parte; italiano completo; giro di tutte le schermate in italiano e in inglese senza chiavi chieste e mancanti né chiavi visibili; `<html lang>`. | desktop |
| `rete.spec.ts` | Percorso completo (tutte le schermate, una partita fino all'Archivio di g03, Merletto libero) con la rete sorvegliata: tutte le richieste sono dell'origine del gioco. Dopo il primo caricamento, senza rete: prologo, sera, notte, Merletto del giorno (Worker) e libero, Impostazioni, Crediti. | desktop, iphone |
| `helpers/game.ts` | Fixture `game` di ogni test: rete sorvegliata dal primo istante (richieste fuori da localhost bloccate e registrate), errori di console raccolti, gioco aperto da un salvataggio vuoto; `call(page, 'ns.fn', …)` per `window.__GAME__`; attese (`waitScene`, `waitNight`, `waitPhase`, `until`); `onlyProjects`. Ogni test finisce con `game.expectClean()`: nessun errore in console, nessuna richiesta esterna. |
| `helpers/pointer.ts` | Mouse e tocco veri (CDP `Input.dispatchTouchEvent`), trascinamento di un fuso, tocco su un incrocio, «Fissa l'ora», pressione lunga, `tapTest` con le attese di Playwright. |
| `helpers/campaign.ts` | Il percorso d'oro guidato dai dati (`src/content/notes.*.json` letti in Node): punteggio dei bigliettini, risposte che svelano desideri, combinazioni controllate con `engine.solve`, Archivi dalla cassapanca. Usato anche da prestazioni, rete e store. |
| `helpers/audit.ts`, `helpers/tour.ts`, `helpers/shots.ts` | Controllo del layout nel DOM, giro delle schermate, screenshot di riferimento. |

### Screenshot di riferimento

In `tests/e2e/__screenshots__/`:
- `layout/<progetto>/base/<tappa>.jpg`: tutte le 28 tappe sui 5 progetti;
- `layout/<progetto>/<testo-140|alto-contrasto|inglese|safe-area>/<tappa>.jpg`: le 9 tappe più dense (titolo, bigliettini, notte, alba dell'Atto II, bilancio, Taccuino, scelta di g23, impostazioni, risultati del giorno). Le altre si allegano solo al rapporto del test;
- `layout/<desktop|iphone>/daltonismo/<motivi|g14>-<simulazione>.jpg`;
- `store/<iphone-6.9-1290x2796|ipad-13-2064x2752|android-1080x1920>/<1-titolo|2-tombolo-notte|3-alba-vignetta|4-taccuino|5-merletto-del-giorno>.jpg` (JPEG qualità 90 alla risoluzione piena: App Store e Google Play li accettano).

Si scrivono quando mancano o con `npx playwright test --update-snapshots` (oppure `E2E_SHOTS=1`); un giro normale non tocca il repository. Non sono confronti pixel per pixel (velluto, luce del titolo e animazioni cambiano a ogni fotogramma): i controlli veri sono quelli del DOM.

### Come si lancia

- Tutto: `npm run test:e2e` (il `webServer` di playwright.config.ts fa la build con `VITE_E2E=1` e la serve con `vite preview`; `E2E_PORT` cambia porta).
- Con un server già avviato su una build statica (consigliato quando altri modificano i file): `VITE_E2E=1 npx vite build --outDir <cartella>` + `npx vite preview --outDir <cartella> --port <porta>`, poi `E2E_PORT=<porta> E2E_REUSE=1 E2E_DIST=<cartella> npx playwright test`.
- Una suite: `npx playwright test tests/e2e/prologo.spec.ts --project=iphone`.

## Decisioni prese

- **Gesti.** Sui progetti con `hasTouch` il tocco passa da `Input.dispatchTouchEvent` (come chiedeva il pacchetto tombolo): Chromium genera pointer `touch`, `touchstart/touchend` e anche i click di compatibilità, esattamente come un telefono. I pulsanti del DOM si toccano con `locator.tap()`/`click()` (attese di Playwright); «Fissa l'ora» al centro del pulsante senza attese di stabilità, perché nel tutorial pulsa.
- **Primo colpo.** Un trascinamento che non arriva al tombolo al primo tentativo è un difetto (un giocatore non riprova). Il test lo registra come errore «soft», aspetta che gli avvisi spariscano e riprova, così il resto del prologo (o dell'Archivio) viene comunque verificato.
- **Percorso d'oro** = giocato come un giocatore esperto, non con i flag forzati: le scelte vengono dai dati dei bigliettini. Se i requisiti di D non tornassero, il test lo segnala e solo dopo li completa con l'API per provare comunque il finale.
- **Animazioni istantanee** (`animSpeed: 0`) nei giri delle schermate e nella campagna: la logica è la stessa, le schermate si fotografano ferme e i giri durano meno. Gli screenshot per gli store usano invece la velocità normale.
- **Safe area.** Un elemento interattivo o un testo non deve stare nella fascia riservata; dentro un contenitore che scorre il contenuto può passarci sotto mentre si scorre, ma agli estremi dello scorrimento tutto deve essere raggiungibile. Un'area di tocco alta come lo schermo (lo schermo nero del prologo) non conta.
- **Testo ruotato.** La calligrafia inclinata dei bigliettini ha un rettangolo allineato agli assi più largo di quello visibile: non si confronta con il pulsante che la contiene.
- **Daltonismo.** Oltre agli screenshot simulati, la verifica automatica è sui dati (colori di characters.json simulati e convertiti in CIELAB, motivo e icona): misurare la distinguibilità sui pixel di un filo largo pochi px non dava numeri stabili. La monocromia è solo nel rapporto: GDD 14 nomina le tre dicromasie.
- **Budget CSS.** ARCHITETTURA 16 scrive «JavaScript ≤ 450 KB gzip» e «CSS ≤ 40 KB» senza dire gzip: il CSS si misura come il JavaScript (gzip, 14,9 KB); il peso senza compressione (63,4 KB) è nel rapporto del test.
- **Prestazioni.** Il trascinamento dura 4,5 s invece di 3, perché `perf()` tiene gli ultimi 240 fotogrammi: così sono tutti fotogrammi di trascinamento.
- **Progetti.** `desktop-hd` gira solo il layout (ARCHITETTURA 15.2: «solo screenshot»); campagna e rete su desktop e iphone (stretto e largo); prestazioni e i18n sul desktop.

## Risultati e test che falliscono

Ultima esecuzione completa (sezione Test): 122 superati, 6 falliti. Tutti i fallimenti sono difetti di altri pacchetti:

1. **tombolo · Archivio sul telefono: il tocco che apre la scelta dei nomi sceglie già un nome** (archivio.spec.ts su iphone, android-piccolo, ipad-orizzontale).
   - Errore: `il tocco che apre la scelta dei nomi non sceglie già un nome (click fantasma su clotilde)` e `la scelta dei nomi resta aperta dopo il tocco`.
   - Causa: la scelta si apre al `pointerup` del tocco; il click di compatibilità che il browser manda dopo `touchend` cade sul pulsante `tb-nomina-clotilde` appena comparso sotto il dito: il filo viene nominato «Clotilde» e la scelta si chiude.
   - Passi: viewport 390×844 con `hasTouch`; `__GAME__.campaign.newGame()`, `__GAME__.campaign.goto('arc1', 'notte')`; aspettare 5 s (che sparisca l'avviso); toccare con `Input.dispatchTouchEvent` (touchStart, 40 ms, touchEnd) il centro del fuso `f1` da `night.layout().spindles`; `night.state().archive.names` → `{"f1":"clotilde"}`, `[data-test="tb-nomina"]` non c'è più. Con il mouse non succede.
   - Proposta: aprire la scelta al `click` (o ignorare i click per ~400 ms dopo l'apertura, o `preventDefault()` sul `touchend` che la apre).
2. **fondamenta · il gioco web non funziona offline dopo il primo caricamento** (rete.spec.ts su desktop e iphone; GDD 0 «Offline: sempre», GDD 17).
   - Errore: `nessun asset mancante` → `dio/forno/alba`, `dio/piazza/giorno`, `dio/stanza/notte`…; `richieste fallite senza rete` → i diorami (`assets/dio/*.webp`) e due font (`eb-garamond-latin-600-normal`, `caveat-latin-400-normal`); in console `net::ERR_INTERNET_DISCONNECTED`.
   - Causa: i diorami si caricano per gruppo quando servono e i font quando il CSS li usa la prima volta; senza service worker né precaricamento, se la rete cade dopo il primo caricamento le vignette restano senza fondale e i testi cambiano carattere. Nell'app nativa tutto è locale, quindi riguarda solo il web.
   - Passi: aprire il gioco, al titolo `context.setOffline(true)`, `campaign.newGame()` e giocare il prologo fino all'alba: `core.missingAssets()` elenca i diorami.
   - Proposta: un service worker che metta in cache index, chunk e `assets/` (≤ 6 MB), oppure il precaricamento in sottofondo di tutti i gruppi e dei font dopo l'avvio.
3. **contenuti-atto1 (characters.json) · arc3: Teresa e Aldo hanno lo stesso motivo («righe») e la stessa icona («busta»)** (layout.spec.ts, daltonismo, desktop).
   - Errore: `GDD 14: nello stesso merletto due fili non hanno mai lo stesso motivo e la stessa icona` → `arc3: teresa e aldo …`. Fra i due resta solo il colore (blu #2F5DA8 e verde #6E9E3A, ΔE 19,9 in bianco e nero).
   - Passi: `src/content/levels/arc3.json` ha i fili di teresa e aldo; in `src/content/characters.json` aldo ha `pattern: "righe"`, `icon: "busta"` come teresa.
   - Proposta: dare ad Aldo un motivo e un'icona che in arc3 non usa nessuno (in arc3 ci sono righe, puntini, croce, zigzag; liberi per esempio `catenella` o `tratteggio`, e un'icona diversa da busta, pagnotta, ampolla, pesce) controllando che il glifo esista in `src/core/ui/glyphs.ts`.

Già corretto dall'integrazione durante il lavoro (trovato da questa suite): gli avvisi brevi (stranezza scoperta) coprivano i fusi e si prendevano il trascinamento subito dopo «Fissa l'ora» (prologo alle 7 e alle 9): commit 46e24e6. Il test del prologo ora passa su tutti i progetti.

## Problemi noti

- Le misure di prestazioni sono fatte nel container (Chromium headless, CPU condivisa): non dicono nulla dei telefoni veri (ARCHITETTURA 15.2). Servono prove su un iPhone e su un Android di fascia media.
- Il tocco è simulato con il protocollo DevTools: è lo stesso percorso di eventi di un telefono, ma Safari su iOS non è provato (Playwright qui ha solo Chromium).
- Gli screenshot di riferimento non sono confronti automatici pixel per pixel (vedi sopra).
- La suite completa dura circa 13 minuti con 2 worker su questa macchina (molto carica); le corse lunghe (campagna) hanno 15 minuti di tempo.

## Richieste per altri pacchetti

Vedi il campo `requests_for_others` dell'esito del pacchetto (stessi contenuti dei punti 1-3 sopra) più due note minori:
- **fondamenta**: gli avvisi brevi (`.core-toast`, classe `core-solid`) prendono i tocchi per 2,8 s anche fuori dalla notte: per esempio sopra le schede del Taccuino in overlay su un telefono 360×640, dopo una voce nuova. Non hanno azioni: `pointer-events: none` basterebbe. La build avvisa che `index-*.js` supera i 600 KB minificati (678 KB, 164 KB gzip, dentro il budget di 450 KB gzip): alzare `chunkSizeWarningLimit` o dividere il chunk, così `npm run build` non ha avvisi. ARCHITETTURA 16 non dice se il budget del CSS (40 KB) è gzip: i test lo misurano gzip.
- **fondamenta** (facoltativo): nel README, la sezione dei test end-to-end con i comandi di «Come si lancia» qui sopra.

## Test

Comandi di `npm run ci`, eseguiti uno per uno il 14/10/2026 su questa macchina (4 CPU condivise con altri agenti):

| Passo | Risultato |
|---|---|
| `npm run build` (tsc + vite build) | uscita 0; un avviso di Vite sulla dimensione di `index-*.js` (678 KB, 164 KB gzip) |
| `npm test` (Vitest) | 75 file, 1010 test superati |
| `npm run levels:check` | 34 livelli OK |
| `npm run native:check` | uscita 0 |
| `npm run native:test` | 59 prove superate, 0 fallite |
| `E2E_PORT=5291 npm run test:e2e -- --update-snapshots=all --workers=2` (webServer: build `VITE_E2E=1` + `vite preview`) | **122 superati, 6 falliti, 72 saltati** (progetti esclusi apposta) in 11,7 min |

I 6 test falliti sono i difetti 1-3 della sezione «Risultati e test che falliscono»:
- `archivio.spec.ts` su iphone, android-piccolo, ipad-orizzontale (tombolo: click fantasma nella scelta dei nomi);
- `rete.spec.ts` «dopo il primo caricamento si gioca senza rete» su desktop e iphone (fondamenta: diorami e font non disponibili offline);
- `layout.spec.ts` «in ogni livello due fili … motivo e icona diversi» su desktop (contenuti-atto1: arc3, Teresa e Aldo).

Misure dell'ultima esecuzione (allegati dei test):
- trascinamento su 6 colonne: p50 0,5 ms, **p95 2,4 ms**, massimo 6,8 ms, 58 fps, 269 fotogrammi durante il trascinamento;
- heap JS dopo 10 giornate (g00-g09) in autoplay: **8 MB** usati (9,1 MB totali);
- build: JavaScript 335 KB gzip (55 file), worker del solver 18,8 KB gzip, CSS 15 KB gzip (63,5 KB senza compressione), font woff2 222 KB, asset 2,15 MB, atlas 1,61 MB;
- percorso d'oro (desktop e iphone): 24 giornate, 49 richieste appuntate e tutte soddisfatte, 6 Archivi rammendati, requisiti del finale vero raggiunti giocando (lettere liberate a g16, riconciliazione a g18, 8 desideri, memoria ≥ 1 per almeno 4 a fine g22).

Esecuzioni precedenti sulla build statica (`VITE_E2E=1 vite build` nello scratchpad + `vite preview` sulla 5290, `E2E_REUSE=1`): stessi risultati, più il prologo che falliva su tutti e quattro i progetti da gioco per gli avvisi sopra i fusi, corretto poi dall'integrazione (46e24e6).

`npx tsc --noEmit -p .`: nessun errore nei file di `tests/e2e/` (e in tutto il progetto).
