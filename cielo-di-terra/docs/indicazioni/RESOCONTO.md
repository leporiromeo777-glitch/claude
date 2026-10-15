# Indicazioni delle missioni: resoconto

Richiesta dell'utente che gioca la Fase 1: «voglio che metti anche le indicazioni delle missioni,
cioè del cosa devi fare». Questo è il secondo giro (ramo `funzioni/obiettivi-2`, dal commit
`5918cbf`): corregge tutti i problemi trovati dalla prova di gioco e dalla revisione del codice
del primo giro.

## Che cosa fa

- **Il pannello dell'obiettivo**, in alto a sinistra, su un ritaglio di carta: il titolo della
  missione, l'**indicazione pratica** del passo (che cosa fare, dove, con quale tasto, con i
  tastini disegnati), l'obiettivo poetico del Taccuino a matita e, in una riga ciascuna, al
  massimo due righe in più (l'altro passo attivo della stessa missione; nel gioco libero le
  missioni libere). Al passo nuovo la riga vecchia si barra a matita, compare «nuovo obiettivo» e
  suona un tocco leggero.
- **L'attesa**: quando la persona da cercare non c'è ancora, una riga sotto l'indicazione dice
  chi arriva e quando («Adesso non c'è nessuno con cui parlare. Una velata al lavatoio arriva alle
  07:00: siediti (C) e aspetta (X).»), e il menu «Aspetta fino a» propone quell'ora.
- **Il segnalino sulla meta**: un cerchietto a matita con la distanza in metri sul luogo, sul
  punto da usare (la busta, l'armadietto), sopra la testa della persona da cercare, sul chiodo
  del rilievo; se la meta è in un altro «dentro» (la Cripta, la cella del campanile) indica prima
  la via. Fuori vista diventa una punta di freccia piena sul bordo; alle spalle sta sul fianco
  verso cui girarsi, con «dietro». Dice «in su» o «sotto» quando la meta è molto più in alto o
  più in basso. Non passa mai sotto il pannello né sotto le notifiche del Taccuino.
- **Le indicazioni seguono la storia**: cambiano con i rami (`indicazione_se`: vegliare invece di
  dormire, la passerella salvata, il campanile già aperto, l'altra valle) e il segnalino segue le
  tappe scritte nel passo (`tappe`: la Ripa prima della planata, il campanaro cercato sul sagrato,
  il Balcone prima dei Bugni).
- Si nasconde nei dialoghi, nelle carte, nel Taccuino, nella Pianta, nella pausa, nel titolo, nel
  sonno, con la vista coperta (il nero dell'inizio, il bianco della botola), nel cannocchiale
  (solo il segnalino) e quando Elvira è arrivata (solo il segnalino).

## Come si usa

**Giocando.** È attivo di serie. Il tasto **O** (o «Obiettivo a schermo» nella pausa) nasconde e
rimostra il pannello. Impostazioni › Aiuti › «Indicazioni delle missioni»: **Complete** (pannello
e segnalino, di serie), **Senza segnalino** (solo il pannello), **Nessuna** (come voleva il GDD:
solo il Taccuino). Se la persona da cercare non c'è, sedersi (C) e aspettare (X): la prima voce
del menu è l'ora in cui arriva.

**Scrivendo i contenuti** (`content/missioni.json`, FASE1 §2.5), per ogni passo:

| campo | a che cosa serve |
|---|---|
| `indicazione` | la frase pratica del pannello, con i tasti come segnaposto (`{usa}`, `{siedi}`, `{aspetta}`…, `src/regia/tasti.ts`) |
| `indicazione_se` | `[{ "quando", "indicazione" }]`: l'indicazione di un ramo della storia; vale la prima il cui `quando` è vero |
| `tappe` | `[{ "luogo" \| "punto" \| "persona", "luogo"?, "quando"? }]`: tappe del segnalino scritte a mano, prima di quelle ricavate dalle condizioni; una `persona` con il suo `luogo` si cerca lì (se non c'è: il luogo e l'ora in cui arriva). Un passo con le sue tappe non ripiega sul `luogo` del passo |
| `eventi[].tappa` | `false`: l'evento non è una tappa di strada (di serie i suoi luoghi e i suoi dialoghi lo sono) |
| `segnalino` | `false`: niente segnalino per il passo |

`npm run verifica-contenuti` controlla segnaposto, graffe, luoghi e persone delle tappe e legge
le condizioni nuove come tutte le altre.

## Problema per problema

### Dalla prova di gioco

| # | gravità | problema | che cosa ho fatto |
|---|---|---|---|
| 1 | alta | `m1_velati`: si atterra all'alba, in piazza solo comparse velate che non parlano; il segnalino si spegne e il pannello spinge a premere E su di loro | Testo nuovo: «Parla con tre abitanti (E): una velata al lavatoio dalle 7; dalle 8 il campanaro sul sagrato e due bambini in piazza. I velati della folla non rispondono.» Nel motore: se nessuna delle persone da cercare è nel paese, il segnalino va dove arriva per prima (a pari ora la più vicina), secondo gli orari di `personaggi.json` (`src/regia/orari.ts`), e il pannello aggiunge la riga dell'attesa; il menu «Aspetta fino a» propone «le 07:00, quando arriva qualcuno». Foto 12, 12b |
| 2 | media | il segnalino sullo schermo finisce sotto il pannello | Il segnalino ora sta dopo il pannello nel DOM (sopra la carta) e, se la meta cade sul pannello (anche sullo schermo, non solo al bordo), diventa una freccia appena sotto la carta, girata verso la meta. Foto 08b |
| 3 | media | la freccia in alto finisce sotto le notifiche e sembra un «7» | La guida legge anche l'area delle notifiche (`Indicazioni.areaNotifiche()`) e ci passa sotto. La freccia è una punta piena di 44 px con l'orlo scuro, non più un chevron sottile. Foto 08c |
| 4 | media | `m1_dono`: alla Bacheca prima delle 7 non c'è nessuno, il testo dice «ti aspetta» | Testo: «Vai alla Bacheca delle Ore, in piazza: dalle 7 una novizia ti aspetta lì.» Nel motore la persona del dialogo automatico che non c'è dà la riga «Una novizia arriva alle 07:00: siediti (C) e aspetta (X).» (il «siediti e aspetta» sta solo in questa riga, che compare quando serve: nel primo giro di foto il pannello lo ripeteva due volte). Foto 17 |
| 5 | media | `m1_campanile`: il segnalino insegue Bortolo sulla scorciatoia, il testo dice sagrato; prima delle 7 punta la porta chiusa | Testo: «Le chiavi le ha il campanaro, sul sagrato dalle 8: parlagli (E), poi sali sul campanile e leggi la targa del Pilastro 1 (E).» Tappa scritta `{ persona: bortolo, luogo: sagrato }`: se non è sul sagrato il segnalino va sul sagrato e il pannello dice «arriva alle 08:00»; quando c'è, va su di lui. Aperto il campanile, `indicazione_se` cambia la frase. Foto 18, 18b |
| 6 | media | gioco libero: `m2_aggancio` indica i Bugni «1,7 km in su», irraggiungibili a piedi | Tappa scritta: il Balcone dei Messi finché non si è atterrati nell'altra valle; poi la Porta dei Bugni; davanti alla porta chiusa niente segnalino (un passo con le sue tappe non ripiega sul luogo) e il pannello lo dice («per ora qui non c'è altro da fare»). Foto 20 |
| 7 | media | `m1_velo`: il segnalino porta in piazza a piedi e il passo non si completa | Testo: «Salta dalla Ripa di San Vigilio, il muro alto sopra la piazza (Spazio), e apri il Velo (tieni Spazio in aria) fino alla Piazza delle Ore.» Tappa scritta: la Ripa finché manca la planata; scesi a piedi, il segnalino rimanda lassù. Foto 11 |
| 8 | media | `m1_notte`: il testo arriva tardi e non dice che cosa fare vegliando | `indicazione_se` con `scelta_vegliare`: «Vegli: guarda le Fade dalla finestrella del fienile; poi, da seduta (C), aspetta l'alba (X).», e dopo averle viste «Le hai viste. Da seduta (C) aspetta l'alba (X).» |
| 9 | bassa | «(il mouse)» in coda alla frase | «Con il mouse guarda la scritta sul vetro, sopra il tuo viso.» e «Con il mouse alza lo sguardo, dritto sopra la testa.» (sempre con il segnaposto `{guarda}`) |
| 10 | bassa | `pr_cripta`: «Alzati» quando si è in piedi; niente segnalino su busta e armadietto | Testo: «Prendi la busta sul vetro della tua capsula (E) e apri l'armadietto n. 5 (E).» (l'alzarsi lo dice già il suggerimento). Tappe scritte `punto: busta_5` e `punto: armadietto_5`; la guida sa mettere i punti della Cripta, della cella e del paese. Foto 02 |
| 11 | bassa | alle spalle la freccia va in basso al centro, fra azione, suggerimento e sottotitoli, e si legge «giù» | Alle spalle il segnalino sta sul fianco verso cui girarsi, un po' sotto la metà dello schermo, con la freccia di lato e «dietro» nell'etichetta; proprio alle spalle resta dal lato di prima (niente salti da un fianco all'altro). Foto 08 |
| 12 | bassa | l'a capo separa il tastino dalla parentesi | `testoConTasti` tiene insieme, senza a capo, la parola prima del tasto, la parentesi, il tastino e la punteggiatura dopo. Foto 19 |
| 13 | bassa | `m1_seconda_notte` senza luogo e senza meta | `"luogo": "fienile_ottavio"` e «Dopo le 20:30 dormi nel fienile di Ottavio (E sulla porta), o da seduta (C) aspetta il mattino (X).» |
| 14 | bassa | `pr_lettera`: «si apre da sola» anche quando non si riapre | «Leggi fino in fondo la lettera di Marta: da seduta (tieni C) si apre da sola, o premi E.» |
| 15 | bassa | il segnalino 2 m sopra i piedi: alto su chi è seduto e sui bambini | Sopra la testa vera: l'osso «testa» della figura (`Abitanti.testa()`), che segue la posa, più 45 cm; senza osso, l'altezza della testa di un adulto o di un bambino. Foto 15 (Pina seduta) |
| 16 | bassa | «Solo obiettivo» ambiguo; con due secondarie il pannello è alto un terzo dello schermo | L'opzione si chiama «Senza segnalino». Le righe in più stanno su una riga ciascuna (titolo e inizio dell'indicazione, poi «…»); l'indicazione di `m2_aggancio` è più corta. Foto 20, 21 |

### Dalla revisione del codice

| # | gravità | problema | che cosa ho fatto |
|---|---|---|---|
| 1 | media | il segnalino si aggiornava a scatti (~24 Hz irregolari) e scivolava girando lo sguardo | Si proietta a ogni disegno; scrive `transform` solo se si sposta di un pixel. La distanza e «in su»/«sotto» si riscrivono otto volte al secondo, le aree del pannello e delle notifiche due. Test «si proietta a ogni fotogramma» |
| 2 | media | gioco libero: `m2_aggancio` per sempre, segnalino irraggiungibile | Vedi prova di gioco n. 6: la tappa del Balcone, niente ripiego per i passi con tappe scritte. Test in `destinazione.test.ts` e `obiettivi.test.ts` |
| 3 | bassa | `guida.render` prima di `setFovScale`: un salto entrando o uscendo da lente e cannocchiale | `regia.render` chiama la guida dopo `setFovScale`; nel titolo e fuori dal gioco la chiama solo per sospendere il pannello |
| 4 | bassa | la via (il guado) dimenticata dopo un caricamento | La narrativa ricorda per ogni passo anche il suo `luogo` e i luoghi delle sue tappe (`registraLuoghi`), e lo salva; la guida chiede a lei se un luogo è stato raggiunto durante il passo (resta una memoria locale solo per la scala alla marinara). Test «il guado già passato resta passato dopo un salvataggio e un caricamento» |
| 5 | bassa | `Velatura.coperta()` ricordava solo l'ultima dissolvenza | Il nero e il bianco hanno ciascuno la sua; la vista è coperta se lo è uno dei due. Test «un lampo della Meta durante il nero dell'alba» |
| 6 | bassa | il segnalino sullo schermo nascosto dal pannello | Vedi prova di gioco n. 2 |
| 7 | bassa | `m1_strada` con la passerella salvata manda comunque da Ottavio | L'evento del dialogo con Ottavio ha `"tappa": false`; la tappa scritta `{ persona: ottavio, quando: "!variante:E1=Abitata e !dialogo:d_ottavio_strada finito" }` vale solo se la passerella non c'è; con la passerella c'è anche un'indicazione propria (chiodo 7 alla soglia del mulino, chiodo 8 sul Sass dal Messo). Test in `destinazione.test.ts` |
| 8 | bassa | dopo «Continua» l'obiettivo ripreso compariva come «nuovo obiettivo» con il suono; dopo il titolo la riga vecchia veniva barrata | `continua()` chiama `guida.riprendi()`, che rimette l'obiettivo con `PannelloObiettivo.ripristina()` (niente animazione, niente evento, niente suono); `nuovaPartita()` chiama `guida.azzera()`. Test in `obiettivi.test.ts` e `obiettivo.test.ts` |
| 9 | bassa | il tempo dell'area del pannello contato male | `tArea` e `tTesto` scendono a ogni disegno; le aree si rileggono ogni mezzo secondo davvero (e sempre nei disegni chiesti a mano) |
| 10 | bassa | conflitto con `grafica/post` in `store.ts` (alias di tipo) | L'alias è sparito da `store.ts`: il campo ha il tipo scritto in linea e `IndicazioniMissioni` si ricava in `obiettivo.ts` (`Impostazioni['indicazioniMissioni']`). In `store.ts` restano il campo, il valore di serie e i valori ammessi, lontani dalle righe di `grafica/post` |
| 11 | bassa | la regola CSS sulle notifiche valeva sempre | Il componente mette `ui-ob--con-pannello` quando il pannello si vede; la regola vale solo con `:has(.ui-ob--con-pannello)` |
| 12 | bassa | mancavano dei test | Nuovi test: ripresa con «Continua», guado dopo un caricamento, cella con la meta fuori (e i «dentro» di luoghi e capisaldi), gioco libero, velati all'alba, novizia, campanaro, notte vegliata, proiezione a ogni fotogramma, meta sotto il pannello e sotto le notifiche, `Velatura.coperta`, orari (`orari.test.ts`), tappe scritte e `tappa: false`, forma e verifica dei campi nuovi, tastini senza a capo, riga dell'attesa, «dietro» sul fianco. Non c'è un test unitario dell'ordine rispetto a `setFovScale` (vorrebbe la regia intera): è una riga in `regia.render`, coperta dalla prova E2E con lente e cannocchiale |
| 13 | bassa | tabelle di dati scritte nella logica | `INTERNI` non c'è più: `internoDelLuogo()` lo ricava dai luoghi di tipo `interno` (più la cella), `internoDelCaposaldo()` dal luogo del caposaldo; `PUNTI_DEI_LUOGHI` sta in `src/regia/contenuti.ts` |
| 14 | bassa | «Solo obiettivo» ambiguo | «Senza segnalino» (il valore resta `obiettivo`) |
| 15 | bassa | 9,9 MB di PNG in `docs/indicazioni`; il merge `6f19b55` senza le righe finali | Le PNG sono state tolte; le foto scelte di questo giro sono JPEG (meno di 200 KB l'una). Il merge `6f19b55` non l'ho rifatto: è nella storia sotto `5918cbf`, da cui questo ramo doveva partire, e riscriverlo vorrebbe dire cambiare tutti e due i commit. Quando si unisce il lavoro si può fare uno «squash» con il messaggio completo |

## Prove

- `npm run typecheck`: pulito.
- `npm test`: 46 file, 641 test verdi (prima 45 e 616). I nuovi sono elencati sopra, al punto 12
  della revisione.
- `npm run verifica-contenuti`: 0 errori, 0 avvisi, simulazione completa.
- `npm run build`: riuscita.
- `npm run e2e:fase1`: verde, «prova ok in 330 s» dal titolo alla lettera di Rosa, a contenuti finiti (e «345 s» in una prima corsa a metà lavoro).
- `npm run shots:indicazioni`: «foto ok in 647 s», tutti i controlli superati: il segnalino sulla
  busta, sul muretto (a 7 px dal punto proiettato), sulle persone (a meno di 1 px dalla testa
  proiettata: i bambini, Pina seduta a 1,42 m sopra i piedi, il campanaro); alle spalle sul
  fianco con «dietro»; la meta sotto il pannello e sotto le notifiche spostata sotto il loro orlo;
  all'alba in piazza la meta è il lavatoio con «arriva alle 07:00» e il menu propone le 07:00;
  scesi a piedi senza planata il segnalino torna alla Ripa; alla Bacheca prima delle 7 la riga
  della novizia; prima delle 8 la meta è il sagrato, alle 8 il campanaro; nel gioco libero il
  Balcone dei Messi, con il pannello alto 190 px (era circa 230).
- **Quanto costa** (misurato nel browser della prova, SwiftShader su una macchina carica): il
  segnalino nel disegno 9 µs a fotogramma; passo seguito, tappe, meta e attese 17-21 µs, cinque
  volte al secondo. Il rallentamento della prova E2E rispetto ai 164 s del ramo principale
  (457 s e 330 s nel primo giro, 345 s e 330 s in questo) non viene dalle indicazioni: è il carico della
  macchina (fra 13 e 18 su 4 processori mentre giravano le prove degli altri lavori).

## Le foto

Le foto scelte sono in questa cartella, in JPEG (1,9 MB in tutto; le 15 PNG del primo giro,
9,9 MB, sono state tolte). Il diario della prova che le ha scattate è `shots.json`.

| foto | che cosa mostra |
|---|---|
| `02-cripta-la-busta.jpg` | in piedi nella Cripta il segnalino è sulla busta, il pannello senza «Alzati» |
| `03-nuovo-obiettivo.jpg` | il passo nuovo: la riga vecchia barrata, «nuovo obiettivo»; la scala alle spalle sul fianco sinistro, «13 m dietro» |
| `05-scala-botola-in-su.jpg` | sulla scala: la punta piena verso l'alto, «8 m in su» |
| `07-verso-il-belvedere.jpg` | il cerchietto sul muretto, 35 m |
| `08-belvedere-alle-spalle.jpg` | alle spalle: la freccia sul fianco, «35 m dietro» (non più in basso al centro) |
| `08b-meta-sotto-il-pannello.jpg` | la meta cadrebbe sotto la carta: la freccia appena sotto il pannello, girata verso di lei |
| `08c-sotto-le-notifiche.jpg` | la freccia del bordo alto passa sotto le tre notifiche del Taccuino |
| `11-in-piazza-senza-planata.jpg` | scesi a piedi: il segnalino rimanda alla Ripa di San Vigilio, il testo dice da dove saltare |
| `12-velati-alba-attesa.jpg` | all'alba in piazza, fra le comparse velate: la meta è il lavatoio e il pannello dice chi arriva alle 07:00 |
| `12b-aspetta-fino-alle-7.jpg` | il menu «Aspetta fino a» propone «le 07:00, quando arriva qualcuno» |
| `13-velati-segnalino.jpg` | dopo le 9 il segnalino sui bambini, appena sopra le loro teste |
| `15-dopo-la-conversazione.jpg` | dopo una conversazione si passa a Pina, seduta sulla soglia: il segnalino sopra la sua testa |
| `17-dono-la-novizia-alle-7.jpg` | alla Bacheca prima delle 7: «Una novizia arriva alle 07:00», e il passo del campanile su una riga sola |
| `18-campanile-il-campanaro-alle-8.jpg` | prima delle 8 la meta è il sagrato, con l'ora del campanaro |
| `18b-campanaro-sul-sagrato.jpg` | alle 8 il segnalino è sul campanaro, sul sagrato |
| `19-chiodo-2-tastini.jpg` | «campanile (tasto destro).» va a capo tutto insieme |
| `20-gioco-libero.jpg` | il gioco libero: verso il Balcone dei Messi; le libere su una riga ciascuna |
| `21-impostazioni.jpg` | Impostazioni › Aiuti: «Complete», «Senza segnalino», «Nessuna» |

## Che cosa resta

- Unire con il rifacimento grafico (`grafica/*`): di `src/ui/impostazioni/store.ts` restano il
  campo, il valore di serie e i valori ammessi; `src/ui/componenti/impostazioni.ts` ha solo la
  voce «Indicazioni delle missioni» in fondo agli Aiuti; `src/game.ts`, `src/core/input.ts`,
  render, scene, popolamento e oggetti non sono toccati.
- Il merge `6f19b55` resta senza le righe finali (vedi sopra).
- Fuori da questo lavoro, visto nelle foto: il suggerimento «Alzati: E» resta a schermo dieci
  secondi di gioco anche dopo che Elvira si è alzata, e quello del Velo ripeteva «in aria»
  (corretto in `testi.json`).
