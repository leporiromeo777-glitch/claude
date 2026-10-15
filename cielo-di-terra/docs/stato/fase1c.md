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

I luoghi di Corbella sono ancora quelli segnaposto del motore più i segnaposto della regia
(cripta, cella campanaria, castagni, fienile, capisaldi…): il modulo `popolamento` è in
lavorazione in `moduli/popolamento/` e si collega alla porta `PortaPopolamento` (vedi sotto).

## Moduli integrati

| Modulo | Dove | Test |
|---|---|---|
| narrativa (storia, dialoghi, taccuino, salvataggi) | `src/narrativa/` | `tests/narrativa/` |
| audio (motore, musica, campane, passi) | `src/audio/` | `tests/audio/` |
| oggetti (abitanti, castagni, botola, capisaldi, squadro…) | `src/oggetti/` | `tests/oggetti/` |
| interfaccia (titolo, pausa, impostazioni, dialoghi, carte, taccuino, pianta, indicazioni) | `src/ui/` | `tests/ui/` (happy-dom) |
| rilievo (catasto, lati, notti, pianta, resoconto) | `src/rilievo/` | `tests/rilievo/` |
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
| `png.ts` | gli abitanti (figure della libreria oggetti) secondo gli orari di `personaggi.json`; Ottavio che scende dal cielo, accompagna, viene incontro |
| `audio.ts` | il ponte verso `src/audio`: avvio al primo gesto, stato per fotogramma, passi, eventi, temi |
| `notte.ts` | le Fade di notte (sciami), il giro della Corbella |
| `velatura.ts` | nero, bianco, lampo della Meta, lente, fogliame nel cannocchiale, il passero |
| `scena/` | segnaposto: la cripta, la cella campanaria, i luoghi della Missione 1 (`Segnaposto` implementa `PortaPopolamento`) |
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

- `npm test`: RISULTATI_TEST. I test della regia (`tests/regia/`, 41) coprono orologio,
  luoghi, contenuti, interazioni (tenute, «premi»), sguardi, corpo (fiato, planate), «linea
  libera?» (terreno e collisori), le tappe del tempo del catasto (notte dormita, notte vegliata,
  resoconto), rilievo e salvataggio, gli orari degli abitanti e Ottavio che viene incontro.
- `npm run e2e:fase1`: RISULTATI_E2E. Fa la build E2E, apre Chromium (SwiftShader), clicca
  «Nuova partita» e gioca: P0.1-P0.6 (vetro, alzarsi, capsule, armadietto, scala, botola,
  primo sguardo in su, muretto, lettera, Meta, Meridiana) e M1.1-M1.22 (lente, ramo vivo,
  Pianta, cartellino, innesto, planata, i velati, Ottavio, la brace, l'Ombrista, il fienile, la
  prima notte, il resoconto, il guado, il dono di Clelia, il campanile, il libretto, il tasso,
  il primo rilievo 3-1, la strada del Messo e il lato 7-8, la seconda notte, la prova, la
  lettera di Rosa); poi salva e controlla «Continua». Le foto (`docs/shots/fase1/`) sono state
  guardate una per una; `e2e.json` ha il riassunto della corsa.
- `npm run build` e `npm run shots` (le 6 foto del motore, prese dal canvas con la regia ferma sul titolo) restano verdi.

## Segnaposto (da sostituire con `popolamento`)

- **Cripta** (`scena/cripta.ts`): anello delle sette capsule, sala, corridoio, scala, pozzo e
  botola interna, armadietto e buste; tre lampade accese.
- **Cella campanaria** (`scena/campanile.ts`): stanza dentro la torre del motore con le bifore,
  le campane, l'altoparlante, il pilastro di bronzo con la targa; scale «a stacco» (dissolvenza).
- **Luoghi della Missione 1** (`scena/segnaposto.ts`): castagno morto e ramo vivo, botola,
  capisaldi (chiodi e paline), muretto, castagno del cartellino, fienile, bacheca, telo
  dell'Ombrista, scatola di Pina, porta del campanile; elementi mobili E1-E4 con le varianti.
- **Abitanti** (`png.ts`): figure della libreria oggetti posate al centro dei luoghi degli
  orari, con uno scarto; niente percorsi a piedi fra un luogo e l'altro (cambiano posto quando
  Elvira non guarda… o anche quando guarda). Le Fade di notte sono sciami posati sul giro.

`PortaPopolamento` (`src/regia/porte.ts`) è la porta per il modulo vero: `punto(id)` e
`mostraVariante(elemento, variante, pezzi)`. Dalla bozza in `moduli/popolamento/`
(`installaCorbella(game) → ManigliaCorbella`): `punto(id)` → `maniglia.punto(…)?.pos` con la
mappa degli id (`leggi:targa_p1`, `chiodo:3`, `apri:botola`, `dormi:fienile_ottavio`…),
`mostraVariante` → `setVariante`, le figure → `npc(id)`, la cripta → `cripta`/`apriBotola`,
le Fade → `notte`. Quando il modulo avrà il suo README si sostituisce `Segnaposto` (e le
figure di `png.ts`) con un adattatore.

## Problemi noti

- **Lati coperti dal terreno**: con il terreno del motore, i lati 1-4, 3-4 e 4-37 (verso il
  Monte, CS 4) e 3-11 (da CS 3) sono coperti dal terreno lungo la «linea libera». La Fase 1
  non li chiede, ma la particella 2119 dell'inventario si raggiunge solo dal lato 1-4: la voce
  `corbella_a_colori` oggi non si completa. Va rivista la rete con il terreno (o le quote dei
  capisaldi, che nei contenuti sono di un terreno precedente).
- **Quote dei contenuti**: le `altezza` di `luoghi.json` e `capisaldi.json` non coincidono con
  il terreno del motore; la regia usa il terreno all'aperto e le quote dei contenuti solo per
  gli interni e la cella.
- **Foto E2E**: un fotogramma grigio uniforme è capitato una volta (la targa del Pilastro 1)
  in una corsa lunga con SwiftShader; la scena isolata si disegna bene e la prova ora aspetta
  la fine delle animazioni dell'interfaccia prima di ogni foto.
- **Test del terreno del motore** (`tests/terrain.test.ts`, «groundHeight coincide con
  surfaceHeight…»): campiona punti a caso e fallisce circa una volta su otto (lo scarto
  massimo trovato è 4,4 m a z 1163, θ 162,4, valle 2). Non dipende dalla regia.
- Niente gobo né ombre portate dalla Linea sugli interni; la cella campanaria non ha scale vere.
- Gli abitanti non camminano fra i luoghi (solo Ottavio quando accompagna o viene incontro).
