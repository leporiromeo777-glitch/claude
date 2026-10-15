# Fase 1C — integrazione: stato

Data: 2026-10-15. Responsabile: integrazione (regia). Questo documento dice che cosa è
collegato, come si gioca, che cosa è ancora segnaposto e che cosa resta da fare perché il
prologo e la Missione 1 (`docs/design/FASE1.md`) si giochino dall'inizio alla fine.

## In breve

Prologo e Missione 1 si giocano dall'inizio alla fine su PC (tastiera e mouse), dal titolo
ai titoli di «gioco libero», attraverso i sistemi veri: motore della storia (`src/narrativa`),
catasto (`src/rilievo`), interfaccia (`src/ui`), audio (`src/audio`), oggetti (`src/oggetti`).
La prova automatica `npm run e2e:fase1` gioca tutta la sequenza con i tasti, la storia e il
catasto reali (nessun flag acceso a mano), salva e controlla «Continua», e scatta 22 foto in
`docs/shots/fase1/`.

Corbella è quella vera del modulo `popolamento` (`src/popolamento`): San Vigilio con il
campanile e il Pilastro 1 sulla terrazza della cuspide, la Piazza delle Ore, 58 rustici, i muri a
secco delle terrazze, i Ronchi, il fienile, i chiodi d'ottone, gli elementi mobili E1-E4, le Fade
e i personaggi con le loro figure animate. L'unico interno della regia rimasto è la Cripta.

## Moduli integrati

| Modulo | Dove | Test |
|---|---|---|
| narrativa (storia, dialoghi, taccuino, salvataggi) | `src/narrativa/` | `tests/narrativa/` |
| audio (motore, musica, campane, passi) | `src/audio/` | `tests/audio/` |
| oggetti (abitanti, castagni, botola, capisaldi, squadro…) | `src/oggetti/` | `tests/oggetti/` |
| interfaccia (titolo, pausa, impostazioni, dialoghi, carte, taccuino, pianta, indicazioni) | `src/ui/` | `tests/ui/` (happy-dom) |
| rilievo (catasto, lati, notti, pianta, resoconto) | `src/rilievo/` | `tests/rilievo/` |
| popolamento (Corbella: case, muri, chiodi, elementi mobili, personaggi, Fade) | `src/popolamento/` | `tests/popolamento/` |
| **regia** (questo lavoro) | `src/regia/` | `tests/regia/` + `npm run e2e:fase1` |

Le dipendenze dei moduli sono nel `package.json` principale (`@fontsource/*` per i caratteri
dell'interfaccia, `happy-dom` e `tsx` fra le dev). `npm run verifica-contenuti` lancia lo
script di verifica dei contenuti della narrativa.

## La regia (`src/regia/`)

Un `SistemaGioco` agganciato al ciclo a passo fisso del motore (`game.sistemi`): tutta la
logica che cambia lo stato gira in `update` (la prova E2E fa avanzare i passi senza disegnare),
il disegno serve solo alle viste.

| File | Che cosa fa |
|---|---|
| `regia.ts` | il direttore: fasi (titolo, gioco), nuova partita e «Continua», salvataggi, eventi della storia, controllo del corpo (sdraiata, alzarsi, scala, seduta, squadro piantato, sonno), tempo, campane, Meta, Ombrista, indicazioni a schermo |
| `orologio.ts` | l'ora della storia: `fermo`, `max`, `libero`, sonno (`saltaA`), «aspetta fino a» (x20), salvataggio |
| `luoghi.ts` | i luoghi dei contenuti nel mondo: quota (terreno del motore all'aperto), «dentro», dove sono |
| `interazioni.ts` | bersagli del tasto E: sguardo + vicinanza, verbo a schermo, premi o tieni (tenute che riprendono) |
| `bersagli.ts` | tutti i bersagli e i controlli di sguardo del prologo e della Missione 1 |
| `sguardo.ts` | «lo sguardo resta 1,5 s sul vetro», «più di 50° in su», la lente, le Fade |
| `corpo.ts` | fiato (prologo: le gambe di due secoli), seduta, planate e decolli |
| `squadro.ts` | lo squadro in prima persona: in mano, piantato sul chiodo, bolla, cannocchiale, collimazione, appunti |
| `catasto.ts` | il catasto collegato al mondo: «linea libera?» (terreno + collisori), tappe del tempo, notti, resoconto |
| `dialoghi.ts` | i nodi della storia nella finestra di dialogo; coda dei dialoghi automatici; chi parla si volta |
| `interfaccia.ts` | il ponte verso `src/ui`: carte e libretto (lettura fino in fondo), sottotitoli, suggerimenti, Taccuino, Pianta, «Aspetta fino a», pausa |
| `png.ts` | gli abitanti: le figure del popolamento (`corbella.npc(id)`) guidate dalla storia; gli orari li applica il popolamento, la regia corregge le condizioni (Clelia dopo il dono) e muove Ottavio (vola, scende in spirale, accompagna, viene incontro); chi è vicino guarda Elvira |
| `audio.ts` | il ponte verso `src/audio`: avvio al primo gesto, stato per fotogramma, passi, eventi, temi |
| `notte.ts` | le Fade del popolamento viste dalla regia (controllo «Fade nel campo visivo», audio) e la lanterna di Tecla |
| `velatura.ts` | nero, bianco, lampo della Meta, lente, fogliame nel cannocchiale, il passero |
| `scena/` | la Cripta (interno della regia, con i meccanismi del prologo) e `cellaDaCorbella` (la cella e la terrazza del campanile del popolamento con i nomi della regia) |
| `debug.ts` | `window.__GAME__.regia` (dev e `VITE_E2E=1`): stato, flag, avanza, vai, mira, avvicina, tieni, premi, ora |

### Contratto col motore della storia

- **Flag che la regia accende** quando succede la cosa: `seduta`, `fiato_corto`,
  `planata_fatta`, `planata:<luogo>`, `atterrata_altra_valle`, `pianta_aperta`,
  `pianta_g4_guardata`, `lettera_letta`, `cartellino_letto`, `targa_p1_letta`,
  `libretto_pagina:<id>`, `libretto_cs1_letto`, `prima_meta_vista`, `meta_appena_passata`,
  `esaminato:<oggetto>`, `armadietto_aperto`, `figura_presa`, `innesto_fatto`,
  `marza_pedrazzini`, `velo_indossato`, `tentato_lato:<a-b>` (dal catasto), i controlli di
  sguardo (`guardato_vetro`, `guardato_in_su`, `lente:<punto>`, `fade_viste`) e i luoghi
  raggiunti.
- **Flag scritti dai contenuti e agiti dalla regia**: `campanile_aperto` (porta del
  campanile), `aspetta_brace_sbloccato` (voce «la brace» dell'attesa), `campane_ore` (le ore
  battute), `dorme_casa_velo` (dove si dorme), `scelta_vegliare` (voce «mezzanotte»),
  `gioco_libero`.
- **Eventi dei contenuti instradati**: `evento:` (tre_rintocchi, campanaccio_dal_cielo,
  linea_miccia, passero_vola_in_su, velati_si_voltano, ottavio_atterra_in_piazza…), `testo:`
  (carta da leggere), `battuta:` (sottotitolo), `suggerimento:`, `musica:`, `suono:`,
  `pianta:`, `npc:` (`ottavio->accompagna:…`), `variante:` (E1-E4, al catasto e alla scena),
  `orologio:` (fermo/max/libero), `tempo:` (avanza, dormi fino a).
- **Effetti del catasto verso la storia** con `applicaEffetti` (lati chiusi, particelle
  rilevate, varianti cambiate, lumi appuntati) e `WorldFacts.cellaRilevata` /
  `varianteParticella` letti dalle condizioni.

### Catasto (`src/rilievo`)

- Regole da `content/capisaldi.json` + `content/fade_fase1.json`; `collegaAlMondo` e
  `sincronizzaMondo` portano le particelle nella griglia del motore (fuori dall'area della
  Fase 1 il «bianco» del catasto si vede a matita nel mondo, come vuole FASE1 §7.2).
- «Linea libera?»: raggio dagli occhi sopra il chiodo (1,4 m) al segnale del caposaldo,
  campionato ogni 2 m contro `groundHeight` (tolleranza 2,5 m) e contro i collisori (esclusi
  quelli che reggono la stazione o il segnale e i primi/ultimi 3,5 m). I `non_visibile_da`
  dei contenuti (il tasso del sagrato, la tettoia del lavatoio) restano del catasto; nel
  cannocchiale si vede il buio verde del fogliame e il reticolo dice che cosa copre la mira.
- Squadro: `R` lo prende, `E` (tenuto) lo pianta sul chiodo, `A`/`D` livellano la bolla, tasto
  destro (o `M`) il cannocchiale, la croce tenuta sul segnale collima (1,5 s; 0,8 s con
  l'aiuto «collimazione agganciata») e chiama `rileva`; con lo squadro in mano, il
  cannocchiale su un lume o una persona chiama `appunta`.
- Tempo: cicli del giorno a ogni passo, `annunciaMosse` alle 19:30 (una volta al giorno),
  `iniziaNotte` alle 22:00 se Elvira veglia e `avanzaNotte` a ogni minuto di gioco,
  `chiudiNotte` alle 05:30; se dorme, `notte()` intera all'alba. Il resoconto del mattino va in
  rosso nella Pianta (che si apre da sola al risveglio) e nel Taccuino («Stanotte — …»).
- Salvataggio: `salva()`/`Catasto.carica(…, { tollerante: true })` nel blob del mondo.

### Salvataggi

`GestoreSalvataggi` della narrativa su `localStorage` (prefisso `cielo-di-terra.salvataggio`)
con un `FornitoreMondo` della regia (`MondoSalvato` v1): posizione e interno, orologio, catasto,
fiato, squadro, abitanti (Ottavio), nomi conosciuti, capisaldi visti, innesto, segnalibro del
libretto. Salvataggio automatico dopo ogni passo della storia, al risveglio e dopo il sonno;
«Continua» dal titolo ricarica l'ultimo.

## Come si gioca (controlli)

| Tasto | Che cosa fa |
|---|---|
| clic | cattura il mouse (il primo gesto avvia anche l'audio) |
| mouse | guarda |
| W A S D | cammina (A/D livellano la bolla quando lo squadro è piantato) |
| Shift | corre (costa fiato) |
| Spazio | salta; tenuto in aria apre il Velo |
| E | interagisce (il verbo è scritto a schermo); tenuto per tagliare, innestare, piantare lo squadro |
| C | siede (sui muretti, per terra) / si alza |
| X | da seduta: «Aspetta fino a…» (1-4 o clic per scegliere, X/Esc per chiudere) |
| Q | la lente |
| R | prende / mette via lo squadro |
| tasto destro (o M) | cannocchiale dello squadro |
| W / S | da squadro piantato: lo stacca |
| L | il libretto di Aurelio (al segnalibro) |
| G | fischia (Ottavio scende se è in volo, dalle 6 alle 20:30) |
| V | il velo nero di Clelia (dopo il dono) |
| T | Taccuino |
| P | Pianta del Verbano |
| Esc | pausa (impostazioni, salva, titolo) / chiude carte e menu |

Nelle carte: PagGiù/frecce per leggere, S per il testo stampato, Esc per mettere via. Nei
dialoghi: Invio completa la riga, 1-9 o frecce + Invio rispondono, H lo storico.

Impostazioni collegate al motore: campo visivo, sensibilità del mouse, asse Y, oscillazione
della testa, Coriolis sul corpo, velocità delle stelle, volumi (generale, musica, ambiente,
voci); aiuti: azioni tenute «premi», bolla larga, collimazione agganciata, puntino. La pausa,
le carte e i menu fermano l'orologio (`tempoFermo`) e rilasciano il mouse (`catturaInput`).

Parametri URL: `?nuova` salta il titolo e comincia una partita nuova; `?senza-titolo` avvia il
solo motore (senza regia, per gli screenshot del motore); `?debug` statistiche; `?ora=…`.

## Prove

- `npm test`: 41 file, 569 test verdi (narrativa, audio, oggetti, interfaccia, rilievo, popolamento,
  regia e motore). I test della regia (`tests/regia/`, 45) coprono orologio,
  luoghi, contenuti, interazioni (tenute, «premi»), sguardi, corpo (fiato, planate), «linea
  libera?» (terreno e collisori), la quota d'appoggio sui ripiani, le tappe del tempo del catasto
  (notte dormita, notte vegliata, resoconto), rilievo e salvataggio, gli orari degli abitanti e,
  sulle figure vere del popolamento, Ottavio (vola, scende, viene incontro), Clelia dopo il dono e
  chi guarda Elvira. `npm run verifica-contenuti`: 0 errori, 0 avvisi.
- `npm run e2e:fase1`: verde, «prova ok in 164 s», nel paese vero. Fa la build E2E, apre Chromium (SwiftShader), clicca
  «Nuova partita» e gioca: P0.1-P0.6 (vetro, alzarsi, capsule, armadietto, scala, botola,
  primo sguardo in su, muretto, lettera, Meta, Meridiana) e M1.1-M1.22 (lente, ramo vivo,
  Pianta, cartellino, innesto, planata, i velati, Ottavio, la brace, l'Ombrista, il fienile, la
  prima notte, il resoconto, il guado, il dono di Clelia, il campanile, il libretto, il tasso,
  il primo rilievo 3-1, la strada del Messo e il lato 7-8, la seconda notte, la prova, la
  lettera di Rosa); poi salva e controlla «Continua». Le foto (`docs/shots/fase1/`) sono state
  guardate una per una; `e2e.json` ha il riassunto della corsa.
- `npm run build` e `npm run shots` (le 6 foto del motore, prese dal canvas con la regia ferma sul titolo) restano verdi.

## Il paese: `src/popolamento`

`main.ts` chiama `installaCorbella(game, { agganciaCiclo: false, luciAbitanti: false })` dopo
`game.init()` (toglie il paese segnaposto del motore) e passa la maniglia alla regia, che chiama
`portaPopolamento(corbella).update(dt)` a ogni passo (abitanti, botola, Fade, fumo della grà).
La regia usa `portaPopolamento(corbella)` al posto del suo vecchio segnaposto: gli id storici
(`chiodo_cs_N`, `segnale_cs_N`, `lente_corteccia`, `muretto`, `porta_campanile`…) passano per
`ALIAS_SEGNAPOSTO`; le varianti E1-E4 del catasto vanno a `setVariante`.

Doppioni risolti:

- **Cella campanaria**: tolta quella della regia. Si usa il campanile del popolamento: la cella con
  le bifore, le campane e l'altoparlante, e sopra la terrazza della cuspide con il Pilastro 1, la
  targa e la palina. Salendo dalla porta (dissolvenza: la scala interna è implicita) Elvira arriva
  sulla terrazza (`cellaDaCorbella` legge i punti `scendi:campanile`, `leggi:targa_p1`,
  `parla:meridiana`, il chiodo 1); l'interno della regia `cella` è la terrazza.
- **Cripta**: resta quella della regia, perché porta i meccanismi del prologo (coperchi delle
  capsule con la scritta sul vetro, targhette, armadietto, buste, scala alla marinara, botola
  interna, orari col gesso); `corbella.cripta.interno` (solo da vedere, senza punti) resta
  nascosto. Si esce accanto alla botola vera del popolamento (`apri:botola`, al piede
  dell'alzata) e la si apre con `apriBotola`. Portare quei meccanismi sull'interno del popolamento
  (sala a volta, sette capsule in semicerchio) è un lavoro di grafica, non di logica.
- **Figure**: tolte quelle della regia; si usano le maniglie `npc(id)` del popolamento (con
  animazione, pose sedute, collider), vedi `png.ts`. Le Fade e la lanterna di Tecla sono quelle di
  `corbella.notte`.

Modifiche fatte alla copia in `src/popolamento` (da riportare nel modulo): in `abitanti.ts` la
quota d'appoggio delle figure guarda i ripiani fino a 8 m sopra il terreno (prima 4 m: Annunciata,
seduta sulla panca del ripiano della chiesa a 4,3 m, finiva dentro il ripiano).

Punti del popolamento usati dalla regia: chiodi e segnali, `apri:botola`, `apri:porta_campanile`,
`scendi:campanile`, `leggi:targa_p1`, `parla:meridiana`, i punti della lente, `taglia:ramo_vivo`,
`innesta:castagno_cartellino`, `leggi:cartellino_castagno`, `siediti:belvedere`, `entra:fienile_ottavio`,
`guarda:telo_ombrista`, `guarda:scatola_pina` e i `leggi:*` con un testo (il motto del Balcone dei
Messi, la casa di Nando). Non ancora collegati, perché la Fase 1 non ci mette niente: i portoni
(`apri:porta_san_vigilio`, `apri:casa_del_velo`, `apri:porta_mulino`), le panche `siediti:*` (ci si
siede comunque con C), i punti `lancio_velo:*`, `esamina:*`, `guarda:*` e `attraversa:*`.

Teletrasporti della regia (uscita dalla botola, alzarsi, staccare lo squadro, caricare, debug):
atterrano sulla «quota d'appoggio» (`quotaAppoggio`: il ripiano o il gradino del popolamento sotto
il punto, se più alto del terreno), non ai piedi dei muri delle terrazze.

## Problemi noti

- **Pilastro 4 e il dosso del Pian dei Ricci (risolto nei contenuti)**: con il terreno del motore il
  Pilastro 4 (800, 9,0) sta in una conca a 80 m dietro un dosso di 104 m: i lati 1-4, 3-4 e 4-37
  sono coperti dal terreno anche alzando il disco di 25 m (3-4 vuole 30 m, 4-3 40 m), quindi alzare
  il segnale non è coerente. Nei contenuti quei tre lati ora **si chiudono solo di notte**, con il
  lume di Ottavio sul Pilastro 4 (dalla Fase 3): `capisaldi.json` (`quando` e `nota` dei lati, nota
  di cs_4), `fade_fase1.json` (la particella 2119, coperta solo da 1-4, esce dall'inventario di
  Corbella: 62 particelle invece di 63) e `FASE1.md` (§3, tabella dei flag, §7.1). I test del
  rilievo seguono (13 lati di giorno, 82 particelle; le mosse della Madre chiudono 3-4 alle 23:00).
  Resta per la Fase 3: di notte la «linea libera» del gioco vede ancora il dosso, quindi il lume
  dovrà stare in alto (o il pilastro sul dosso).
- **Quote dei contenuti**: le `altezza` di `luoghi.json` e `capisaldi.json` non coincidono con
  il terreno del motore; la regia usa il terreno all'aperto e le quote dei contenuti solo per
  gli interni e la cella.
- **Foto E2E**: un fotogramma grigio uniforme è capitato una volta (la targa del Pilastro 1)
  in una corsa lunga con SwiftShader; la scena isolata si disegna bene e la prova ora aspetta
  la fine delle animazioni dell'interfaccia prima di ogni foto.
- **Test del terreno del motore** (`tests/terrain.test.ts`, «groundHeight coincide con
  surfaceHeight…»): campiona punti a caso e fallisce circa una volta su otto (lo scarto
  massimo trovato è 4,4 m a z 1163, θ 162,4, valle 2). Non dipende dalla regia.
- Niente gobo né ombre portate dalla Linea sugli interni; al campanile si sale e si scende con una dissolvenza (niente scala vera).
- Gli abitanti del popolamento cambiano posto con gli orari (teletrasporto ogni minuto di gioco); camminano solo quando la regia lo chiede (Ottavio che accompagna o viene incontro).
