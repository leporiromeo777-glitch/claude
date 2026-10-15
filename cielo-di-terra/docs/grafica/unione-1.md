# Unione 1 del rifacimento grafico: «luce» + «post»

Ramo `claude/jolly-archimedes-cm54mt`, checkout principale. Prima dell'unione la copia di lavoro era
pulita (niente istantanea da salvare). Rami uniti, uno alla volta con `git merge --no-ff`:

| Ramo | Ultimo commit | Commit di unione | Resoconto |
|---|---|---|---|
| `grafica/luce` | `c1ede10` | `b20546d` | [luce.md](luce.md) |
| `grafica/post` | `c679d6b` | `29e44b9` | [post.md](post.md) |

## Che cosa è entrato

**Traccia «luce»** (modello di luce del mondo, atmosfera, matita, superfici):
- il non rilevato è un **abbozzo ad acquerello** (mai più il foglio bianco), il rilevato è colore
  pieno; `nearPaint` passa a [250, 450] con migrazione delle impostazioni salvate (v1 → v2);
- **prospettiva aerea dipinta**: l'altra metà del cilindro è un cielo azzurro con le terre a piani,
  bagliore radente verso la luce, lilla all'alba, blu-viola di notte, alone della Linea;
- **nucleo della Linea che scorre lungo l'asse** (`uSole`): luce radente al mattino e alla sera,
  luce dorata nelle prime e ultime ore, riempimento freddo, notte blu-viola con pozze calde dei lumi;
- **ombre morbide** vicino alla camera (`render/ombre.ts`), con la mappa d'ombra mai nulla
  (`mappaOmbraVuota()`): il mondo non sparisce più di notte o a ombre spente;
- **superfici dipinte** (`aSuperficie`, 13 motivi più AUTO, dedotto dal colore): il paese di oggi
  è già pietra, piode, intonaco, legno, terra; chiome con normale sferica (`impostaChioma`);
- **terreno** a prati d'ottobre: erba secca dorata, felci ruggine, foglie cadute, roccia a strati.

**Traccia «post»** (post-produzione pittorica, qualità, cielo, comandi):
- il mondo si disegna in un **render target HDR**; poi bagliore caldo, **Kuwahara** (generalizzato a
  Media, anisotropico ad Alta, a metà risoluzione), contorni colorati dalla profondità, tremolio della
  mano, toni ACES di giorno e spalla di notte, viraggio caldo/freddo, pennellata, grana, vignettatura;
  il Velo e lo squadro passano dalla stessa post, l'interfaccia HTML resta nitida;
- **Qualità grafica** Bassa / Media / Alta / Automatica nel menu Impostazioni;
- **Collare** a cumuli dipinti con la luce della nube intera; **Linea** in HDR con alone stretto;
  **Finestre** che di giorno si fanno cielo, costoloni in toni spenti, stelle scintillanti;
- **comandi**: ripiego al trascinamento se il pointer lock manca, frecce che girano lo sguardo,
  suggerimento la prima volta.

## Conflitti e punti d'incontro

**Nessun conflitto testuale.** I file toccati da tutte e due le tracce si sono uniti da soli:
- `src/game.ts`: «luce» aggiunge l'import, il campo `luce` e la riga `installaLuce(this)` in `init`;
  «post» riscrive il percorso di rendering (render target, passate, qualità). Le righe non si toccano;
- `scripts/shots.mjs`: «luce» rimette il `nearPaint` di prima dopo l'inquadratura 6, «post» forza
  Alta per le inquadrature e Bassa per le verifiche finali. Righe diverse;
- `src/render/windows.ts` (solo «post») e `render/luce.ts` (solo «luce»): `installaLuce` cerca la mesh
  `costoloni` per darle la superficie METALLO; il nome c'è ancora nella versione di «post», quindi il
  collegamento regge (i costoloni hanno anche `noPencil` di «post»).

**Collegamenti fatti all'unione** (piccole correzioni; le due tracce lavoravano in parallelo):

1. **Ombre e motivi seguono i preset di qualità.** `Game.applicaOmbre` non cerca più `game.luce` a
   tentoni (duck typing): ora è tipato e chiama `this.luce?.ombre.impostaQualita(preset.ombre)`
   (`LivelloOmbre` di «post» e `QualitaOmbre` di «luce» hanno gli stessi nomi). In più lega
   **`uDettaglio`** della traccia «luce» al nuovo campo **`PresetQualita.motivi`**: Bassa 0 (motivi
   economici: niente tocchi fini del prato né foglie cadute, motivi delle superfici solo da vicino),
   Media e Alta 1. Verificato nel gioco:

   | Qualità | `luce.ombre.qualita` | `uDettaglio` | `uOmbraMappa` | `uOmbra.x` |
   |---|---|---|---|---|
   | Bassa | `spente` | 0 | `ombre-vuota` | 0 |
   | Media | `media` | 1 | `ombre-mappa` | 1 |
   | Alta | `alta` | 1 | `ombre-mappa` | 1 |

   Nuovo test in `tests/qualita.test.ts` («comanda il mondo della traccia luce»).
2. **Tolta la rete di sicurezza `Game.garantisciMappaOmbre`** di «post» (e il suo render target 1×1):
   «luce» ha corretto il difetto alla radice, `uOmbraMappa` non è mai null. Provato: primo
   fotogramma di notte a Bassa, notte a Media, giorno a Bassa e a Media; il mondo si vede sempre e il
   browser non dà errori («Mismatch between texture format and sampler type» non compare).
3. **La Linea mostra il nucleo che scorre** (richiesta di «post»): `linea.ts` legge `uSole.x` (la z del
   nucleo, di «luce») e fa il filo e l'alone un po' più vivi lì (×0,86..1,18 il filo, ×0,82..1,22
   l'alone, gaussiana di 420 m). Si vede nell'inquadratura 2: la riga è più luminosa verso il nucleo.
4. **Alone della Linea nella foschia più stretto** (`coloreFoschia` in `shaders/common.ts`, segnalato
   da «post»): con il bagliore HDR della post l'alone largo c'è già; la foschia ora tiene una riga di
   luce (scale 20 m e 110 m invece di 38 m e 160 m). Nell'inquadratura di confronto 3 la colonna
   bianca attorno alla Linea si è stretta e il filo si legge di nuovo.
5. **Il Velo in prima persona prende la luce del mondo** (richiesta di «luce»): `updateFirstPerson`
   usa `keyLightDir` (il nucleo che scorre, radente al mattino e alla sera) invece del vecchio modello
   `tiltAlpha/tiltBeta`.

File toccati all'unione: `src/game.ts`, `src/render/post/qualita.ts`, `src/render/linea.ts`,
`src/render/shaders/common.ts`, `tests/qualita.test.ts`, più le schermate rigenerate in `docs/shots/`.

## Esito dei test

- `npm run typecheck`: verde.
- `npm test`: verde, **45 file, 606 test** (i test di tutte e due le tracce: `luce.test.ts`,
  `collare.test.ts`, `input.test.ts`, `qualita.test.ts`, più quello nuovo dei preset).
- `npm run build`: verde (solo l'avviso solito sulla dimensione del pacchetto).
- `npm run shots` **completo** (inquadrature 1-6 e 11-14, poi le verifiche di gioco a Bassa): finito
  senza errori. Verifiche di fisica invariate: camminata 8,21 m in 2 s, salto 1,31 m, planata 10 s
  con 21,4 m di perdita e rapporto 5,5:1.
- `npm run e2e:fase1`: non eseguito in questa unione (come da compito).

## Schermate (docs/shots/, qualità Alta, 1280×720, SwiftShader)

Guardate tutte e messe accanto ai bozzetti `finale-1`, `-2`, `-3`, `-5`. **Nessuno schermo nero, nessun
oggetto sparito, nessun colore sballato da errore** (niente magenta, niente mondo trasparente, niente
NaN). Il risultato dell'unione coincide con l'«unione di prova» fatta dalla traccia «post»
(`docs/grafica/post/insieme-luce-*.jpg`).

| Inquadratura | Che cosa si vede | Contro il bozzetto |
|---|---|---|
| 01 paese a mezzogiorno | campanile in pietra AUTO, cielo azzurro con le terre dell'altra metà a piani, nubi bianche, Finestra cerulea con stelle | la Linea è una fascia bianca larga (vedi problemi aperti) |
| 02 lungo l'asse | valle dipinta, castagni verdi e ruggine, Linea con il nucleo più vivo, foschia a quinte | buona profondità atmosferica |
| 03 planata alta | Velo, lago turchese, l'altra metà velata d'azzurro | molto blu: le terre si leggono poco |
| 04 Finestra e stelle | vetro blu profondo con stelle, Linea riflessa, passerella | come voluto da «post» |
| 05 notte in paese | blu-viola, lumi caldi, nubi blu | leggibile, niente nero pieno |
| 06 matita e rivelazione | acquerello del non rilevato e colore pieno del rilevato, contorno d'inchiostro | il passaggio si legge a colpo d'occhio |
| confronto 1, alba | luce dorata da destra, ombre lunghe, paese di pietra | bozzetto 1: stessa luce e stessa palette; mancano il castagno vivo e la prima persona (altre tracce) |
| confronto 2, terrazze | erba secca dorata, muri a secco, paese lontano, acquerello sull'altro versante | bozzetto 2: la metà a matita e la metà a colori ci sono; le lastre dei muri restano grandi |
| confronto 3, planata | Linea sottile e nubi a cumuli, altra metà azzurra | bozzetto 3: manca il verde ricco delle valli lontane, troppa velatura blu |
| confronto 5, notte | paese blu-viola con pozze calde, campanile, stelle | bozzetto 5: atmosfera giusta, prato senza erba alta (traccia «natura») |

## Prestazioni (da docs/shots/shots.json)

Passaggio del mondo (`renderer.info`, post compresa), qualità Alta. «Prima» = ramo principale prima
del rifacimento (numeri dei resoconti delle tracce).

| Inquadratura | Draw call | Triangoli | Prima (draw / tri) |
|---|---|---|---|
| 01 paese mezzogiorno | 172 | 779 k | — |
| 02 asse verso il Sordo | 246 | 756 k | 227 / 817 k |
| 03 planata alta | 117 | 339 k | — |
| 04 finestra e stelle | 91 | 351 k | — |
| 05 notte in paese | 155 | 864 k | — |
| 06 matita e rivelazione | 97 | 541 k | — |
| confronto 1, alba | 153 | 885 k | 134 / 945 k |
| confronto 2, terrazze | 177 | 824 k | 158 / 884 k |
| confronto 3, planata | 172 | 439 k | 153 / 499 k |
| confronto 5, notte | 130 | 830 k | 111 / 890 k |

+19 draw call ad Alta (17 della post, 2 per gli strati del Collare), −60 k triangoli (il Collare passa
a sprite). Il passaggio d'ombra non è contato in `renderer.info`; misurato con `luce.ombre.stats`:

| Inquadratura | Alta (3072², 85 m, ogni fotogramma) | Media (2048², 60 m, uno su due) |
|---|---|---|
| confronto 1 | 74 draw, 403 k tri | 59 draw, 310 k tri |
| confronto 2 | 46 draw, 258 k tri | 42 draw, 209 k tri |
| 01 paese | 75 draw, 429 k tri | — |

Totale peggiore ad Alta (confronto 1): circa 227 draw call e 1,29 M triangoli per fotogramma, sotto il
tetto del brief (~400 e 2,5 M). A Bassa le ombre sono spente.

Altri numeri di `shots.json`: gioco pronto in 12,5 s (macchina condivisa con altri agenti, carico
5-10 su 4 core), simulazione 0,032 ms per passo. **`renderCpuMs` (7,9 s) e `frameMs` non sono più
confrontabili** con quelli di prima: con la post le passate leggono le texture scritte dalle passate
precedenti e SwiftShader fa aspettare la CPU, quindi il numero contiene il tempo di disegno su CPU,
non solo la preparazione dei comandi; `timedRender` invece misura ~0 ms perché `finish()` non aspetta.
Per i tempi relativi usare `__GAME__.misuraPassi(n)` (resoconto «post») e, per i tempi veri, una GPU.

## Problemi aperti

- **Prestazioni vere da misurare** su Iris Xe a 1080p (Media, obiettivo 60 fps) e su una dedicata
  (Alta): lo shader del mondo di «luce» costa 1,7-1,9 volte quello di prima su SwiftShader, la post
  ~3 ms stimati a Media. Leve pronte: `uDettaglio` (già a 0 a Bassa), livelli del bagliore, `lontano[2]`,
  raggio del Kuwahara, qualità delle ombre.
- **La Linea vista da vicino all'asse obliquo (inquadratura 01) è una fascia bianca larga** con una
  leggera trama «a vermi» del Kuwahara: è l'alone di `linea.ts` (velo largo, `outer`) più il bagliore.
  Se la si vuole una riga come nel bozzetto 3, stringere il velo largo dell'alone o abbassare `bloom`.
- **Il blu è molto saturo**: le Finestre di giorno (cobalto pieno) e l'altra metà in planata alta
  (inquadrature 03 e confronto 3) dopo saturazione e vibranza della post. Nel bozzetto 3 le valli
  lontane restano verdi e leggibili: da ritoccare insieme (`uHazeZenith` e velo `uHaze.w` di «luce»,
  `saturazione`/`vibranza` e colore del vetro di «post»).
- **Ritaratura congiunta** chiesta da tutte e due le tracce: la luce di «luce» (sole ~1,15, ombra ~0,5
  dell'albedo, `uSole.w`, `uAcquerello`) era pensata senza mappatura dei toni; con ACES di giorno
  regge, ma soglie dei contorni, dettagli salvati e viraggio vanno rifiniti guardando le quattro
  inquadrature di confronto.
- **Geometria** (tracce «paese» e «natura»): lastre di copertura dei muri a secco grandi e chiare,
  castagno morto senza chioma nel confronto 1, alberi lontani a palloncini, niente erba alta, selciato
  della piazza a tessere triangolari; AUTO è solo una deduzione dal colore, le geometrie nuove vanno
  taggate con `taggaSuperficie` e l'occlusione cotta.
- **Prima persona** (mani, maniche, squadro d'ottone) ancora a blocchi: altra traccia.
- Le nubi dentro uno strato del Collare non sono ordinate per distanza (oggi non si nota).
- `npm run e2e:fase1` da rifare sull'unione (la traccia «post» l'ha passato da sola, «luce» no).
