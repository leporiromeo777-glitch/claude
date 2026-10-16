# Unione 2 del rifacimento grafico: «natura» + «paese»

Ramo `claude/jolly-archimedes-cm54mt`, checkout principale. Prima dell'unione la copia di lavoro era
pulita (niente istantanea da salvare). Il ramo principale, rispetto al punto da cui sono partite le
due tracce (`6c12b02`), aveva già in più i personaggi nuovi (GLB animati), il percorso facile e il
percorso-2 (mulattiera e scorciatoia della Terrazza Pedrazzini) e la coda dei dialoghi. Rami uniti,
uno alla volta con `git merge --no-ff`:

| Ramo | Ultimo commit | Commit di unione | Resoconto |
|---|---|---|---|
| `grafica/natura` | `1e51e25` | `3940773` | [natura.md](natura.md) |
| `grafica/paese` | `7f44ad6` | `ef7fc49` | [paese.md](paese.md) |

## Che cosa è entrato

**Traccia «natura»** (vegetazione, sottobosco, terreno, muri a secco, acque):
- cinque specie (castagno, noce, betulla, larice, cipresso) a 4 livelli di dettaglio con passaggio
  retinato complementare; da vicino le latifoglie sono **carte di foglie** dipinte rivolte alla
  camera, con i buchi di cielo e l'ottobre mescolato;
- **boschi fitti** sui versanti (`densitaBosco`: 23 275 alberi nel gioco contro 5140) e, oltre ~280 m,
  la **coltre di chiome** a cupole (`BoschiLontani`, 3 draw call);
- castagno morto del prologo rifatto (tronco ritorto, cavità, rami ricorsivi), castagni del paese
  con il nucleo verde oliva e i ciuffi di foglie;
- **sottobosco** vicino alla camera (erba al vento col colore del prato, felci, fiori, cespugli, sassi
  con muschio, ricci e foglie), raggio e densità da `PresetQualita.vegetazione` (0.45 / 0.75 / 1);
- sentieri di terra battuta nei vertici del terreno, muri a secco con la testa di sassi singoli e il
  gradino erboso da lontano;
- lago a fasce dalla giada al turchese, **riale** che scorre, acqua nella vasca del lavatoio.

**Traccia «paese»** (architettura, piazza, notte, prima persona, Cripta):
- rustici ticinesi veri: gneiss chiaro e caldo con i fori veri, finestrelle strombate con persiane,
  porte di larice, lobbie, scale esterne, camini con la piota, tetti di piode a corsi con l'assito
  sotto le gronde; collisori e ingombri invariati;
- piazza con la corona di ciottoli, terra battuta e prato; tasso a fiamma, telo dell'Ombrista di lino;
- **bagliori delle finestre con la direzione del vetro** (`aDir` in `render/lamps.ts`): di notte il
  paese si accende dal lato che si vede, senza i puntini attorno alle case;
- **prima persona nuova** (`render/primoPiano.ts`, `oggetti/oggetti/mani.ts`): guanti di cuoio con
  le dita, manica di lana verde, Velo con la traversa fasciata e la tela cucita, squadro d'ottone
  lucido, **lettera in mano** (`regia/scena/lettera.ts`);
- Fade verificate, abitanti procedurali di stoffa, Cripta con la luce cotta.

## Conflitti e punti d'incontro

**Un solo conflitto testuale**, in `src/main.ts` (unione di «natura»): nello stesso punto, dopo
`installaCorbella`, il ramo principale aveva aggiunto `preriscaldaPersonaggi(...)` (personaggi) e
«natura» `aggiungiAcquaLavatoio(...)`. Tenute tutte e due le righe, prima il preriscaldamento e poi
l'acqua. Gli import di tutte e due restano.

**Unioni automatiche controllate a mano** (file toccati da più parti):
- `src/regia/regia.ts`: il ramo principale ha riscritto molto (percorso, dialoghi, obiettivi), «paese»
  aggiunge solo l'import e l'aggancio di `LetteraInMano`. Si sono uniti da soli.
- `src/popolamento/sentieri.ts`: il ramo principale aggiunge i camminamenti in traverso (gradini a
  tutta larghezza alla quota del bordo a monte), «paese» dà le superfici (`PIETRA`, `LEGNO`) e
  l'occlusione ai gradini. Righe diverse; i camminamenti nuovi usano la stessa funzione `gradino`,
  quindi prendono anche loro le superfici di «paese». I loro parapetti (codice nuovo del ramo
  principale) restavano senza superficie: vedi la correzione 4.
- `src/scene/sentieri.ts` di «natura» importa `TRACCIATI` del popolamento: prende quindi da sé la
  mulattiera corretta dal percorso-2 (tornante e ingresso alla terrazza), e niente albero nasce lì.

**Decisione sui collisori degli alberi** (chiesta da «natura»): i boschi fitti portano i cilindri dei
tronchi da 5140 a 23 275 (collisori in tutto nel gioco: 26 370, prima 8102). **Restano**: il brief
chiede che un oggetto che si vede sia anche solido («niente compenetrazioni evidenti»). Verificato che
non intralciano il gioco: l'e2e passa, e nessun tronco sta a meno di 0,9 m dalla linea di mezzeria di
nessun sentiero di Corbella (12 tracciati, 2250 campioni ogni 0,5 m, compresi la mulattiera nuova e
la scorciatoia del percorso-2, che `liberaCastagni` libera perché si registra fra i sentieri).

**Correzioni fatte all'unione** (piccole, solo visive; il gioco non cambia):

1. **La lettera in mano sopra lo squadro.** Nell'e2e, chiusa la lettera di Rosa con lo squadro
   piantato, il foglio saliva nella destra e si sovrapponeva allo squadro (foto `21-gioco-libero`).
   Il commento di «paese» diceva già «col Velo aperto o lo squadro in mano la lettera non si tiene», ma
   il codice controllava solo il Velo. Ora `StatoLettore` ha `maniOccupate` e la regia passa
   `squadro.stato !== 'riposto'` (`regia/scena/lettera.ts`, `regia/regia.ts`).
2. **La lettera in mano durante l'Ombrista.** Le leggende dell'Ombrista sono carte di tipo «foglio»:
   durante la scena sul telo il foglio saliva in mano (foto `11-ombrista`). La lettura sa ora se è una
   leggenda (`PonteInterfaccia.letturaLeggenda`) e la regia passa il tipo `leggenda`, che non si tiene
   in mano.
3. **Erba sospesa nel vuoto davanti alla Terrazza Pedrazzini** (difetto vecchio, già nelle foto prima
   del rifacimento, ma ora molto visibile accanto al sottobosco vero): `creaErbaRicci` spargeva 90
   ciuffi e 70 ricci in un cerchio di 13 m attorno al centro del ripiano, che è profondo pochi metri:
   metà dell'erba stava a mezz'aria oltre il muro di fronte (3,5-7 m di salto), metà dentro il
   versante. Si vedeva nella foto `17-primo-rilievo` (le «X» scure a destra) e da ogni sguardo dal
   chiodo 3. Ora `creaErbaRicci` accetta un rettangolo e la terrazza lo usa orientato come il
   ripiano, a 0,5 m dai muri; i castagni del ripiano non spargono più i loro ricci (cadevano oltre il
   bordo), li mette l'erba. Il cerchio del castagno morto resta identico (stessa sequenza casuale).
4. **Parapetti dei camminamenti con le superfici di «paese».** I parapetti che il percorso-2 mette a
   valle dei camminamenti in traverso (`parapetto` in `popolamento/sentieri.ts`) erano scatole senza
   superficie dichiarata (AUTO); ora dichiarano pietra con l'occlusione al piede o legno, come i
   gradini accanto. Collisori invariati.
5. **Prova nuova** `tests/regia/lettera-in-mano.test.ts`: il foglio sale con una lettera, resta giù per
   il libretto, per le leggende, con lo squadro e con il Velo.

File toccati all'unione: `src/main.ts` (conflitto), `src/regia/scena/lettera.ts`, `src/regia/regia.ts`,
`src/regia/interfaccia.ts`, `src/popolamento/edifici.ts`, `src/popolamento/luoghi/terrazze.ts`,
`src/popolamento/sentieri.ts`, `tests/regia/lettera-in-mano.test.ts`, più le schermate rigenerate in `docs/shots/` e `docs/shots/fase1/`.

## Esito dei test

- `npm run typecheck`: verde.
- `npm test`: verde, **60 file, 817 prove** (+1 file saltato di proposito: `misure.test.ts` gira solo
  con `MISURE=1`). Subito dopo le due unioni, prima delle correzioni: 59 file e 814 prove, tutte
  verdi; le tre nuove sono quelle della lettera.
- `npm run build`: verde (solo l'avviso solito sulla dimensione del pacchetto).
- **`npm run e2e:fase1`: verde, «prova ok» in 221-224 s**, prologo e missione 1 completi con i tasti
  veri, 127-128 passi, nessun errore del browser. Girato quattro volte: subito dopo l'unione, dopo le
  correzioni della lettera, dopo quella della terrazza e dopo quella dei parapetti (l'ultima, 223 s,
  è quella delle foto in `docs/shots/fase1/`). Sempre alla qualità che l'e2e usa di serie
  (Automatica, che in modalità E2E vale Media, post-produzione e ombre comprese): non è servito
  abbassarla a Bassa.
- `npm run shots` completo (inquadrature 1-6 e 11-14, poi le verifiche a Bassa): finito senza errori
  né messaggi d'errore del browser. Verifiche di fisica invariate: camminata 8,21 m in 2 s, salto
  1,31 m, planata 10 s con 21,4 m di perdita e rapporto 5,5:1.

## Schermate (docs/shots/, qualità Alta, 1280×720, SwiftShader)

Guardate tutte e messe accanto ai bozzetti `finale-1`, `-2`, `-3`, `-5`, e accanto alle schermate
finali delle due tracce (`docs/grafica/natura/dopo-*`, `docs/grafica/paese/foglio-*`). **Nessuno
schermo nero, nessun colore sballato, nessun oggetto sparito.** Le inquadrature coincidono con quelle
delle tracce prese da sole, con le case di «paese» e il verde di «natura» insieme, salvo il primo piano
del confronto 2: lì il percorso-2 del ramo principale ha rifatto l'ultimo tratto della mulattiera, che
ora entra nella terrazza da quell'angolo, e la camera (posata a quota suolo) non sta più sulla testa
del muro come nell'unione 1 e nella traccia «natura», ma accanto al muro, sul prato.

| Inquadratura | Che cosa si vede | Contro il bozzetto |
|---|---|---|
| 01 paese a mezzogiorno | campanile, tasso a fiamma, selciato a meridiana con la corona, versante a boschi d'ottobre a cupole | la coltre lontana si legge un po' a «selciato di cupole» |
| 02 lungo l'asse | valle con boschi fitti verdi, oro e ruggine sui due versanti, riale turchese, Linea | larici scuri a punta in primo piano (vedi problemi aperti) |
| 03 planata alta | Velo nuovo (guanti di cuoio, traversa fasciata, montanti legati, nappina rossa), lago in cielo | il Velo è quello del bozzetto 3 |
| 04 Finestra e stelle | invariata | — |
| 05 notte in paese | blu-viola, chiesa con il lume, chiome scure sul prato | leggibile |
| 06 matita e rivelazione | il rilevato è il bosco a colori pieni, il non rilevato acquerello pallido | la rivelazione si legge dai colori degli alberi: il contorno d'inchiostro sul suolo ora sta sotto il bosco fitto; larici pallidi a cono a sinistra |
| confronto 1, alba | castagno morto ritorto, castagni d'oro controluce, paese di pietra, terrazze | bozzetto 1: stessa luce e palette; mancano la lettera e le mani nell'inquadratura (lo scatto è senza prima persona) |
| confronto 2, terrazze | erba secca dorata, muro a secco a sassi, felce rossa, castagni, paese e campanile | bozzetto 2: il prato resta giallo saturo |
| confronto 3, planata | Velo nuovo, nubi, lago in alto | bozzetto 3: valli lontane ancora molto velate d'azzurro |
| confronto 5, notte | paese blu-viola, una finestra accesa per lato visto, niente puntini | bozzetto 5: atmosfera giusta |

Le foto della prova e2e (`docs/shots/fase1/`) sono rigenerate dall'ultima prova: Cripta con la luce
cotta, castagno morto, Velo e squadro nuovi, gente vera (Togna, Ottavio), lettera non più sopra lo
squadro (21) né durante l'Ombrista (11), niente erba sospesa al primo rilievo (17).

## Prestazioni (da docs/shots/shots.json)

Passaggio del mondo (`renderer.info`, post compresa), qualità Alta. «Unione 1» = le stesse
inquadrature in `unione-1.md`, prima di «natura» e «paese».

| Inquadratura | Draw call | Triangoli | Unione 1 (draw / tri) |
|---|---|---|---|
| 01 paese mezzogiorno | 202 | 1 239 k | 172 / 779 k |
| 02 asse verso il Sordo | **290** | 1 469 k | 246 / 756 k |
| 03 planata alta | 109 | 571 k | 117 / 339 k |
| 04 finestra e stelle | 93 | 599 k | 91 / 351 k |
| 05 notte in paese | 200 | 1 498 k | 155 / 864 k |
| 06 matita e rivelazione | 116 | 1 386 k | 97 / 541 k |
| confronto 1, alba | 206 | 1 600 k | 153 / 885 k |
| confronto 2, terrazze | 229 | **1 606 k** | 177 / 824 k |
| confronto 3, planata | 171 | 656 k | 172 / 439 k |
| confronto 5, notte | 170 | 1 436 k | 130 / 830 k |

Passata delle ombre (`__LUCE__.ombre.stats`, con `scripts/shots-natura.mjs`) e scena per qualità:

| Inquadratura | Bassa (scena) | Media (scena + ombre) | Alta (scena + ombre) |
|---|---|---|---|
| confronto 1 | 187 / 1,34 M | 196 / 1,48 M + 46 / 392 k | 206 / 1,60 M + 70 / 503 k |
| confronto 2 | 211 / 1,27 M | 224 / 1,39 M + 23 / 199 k | 229 / 1,61 M + 33 / 287 k |
| 21 selva al mattino | 260 / 1,31 M | 268 / 1,47 M + 12 / 58 k | 273 / 1,65 M + 14 / 96 k |
| confronto 3 | — | — | 171 / 656 k + 4 / 6 k |

A Bassa le ombre sono spente. **Caso peggiore ad Alta**: confronto 1 con 276 draw call e 2,10 M
triangoli per fotogramma (scena più ombre); in draw call l'inquadratura 02 (290 di scena). Sotto il
tetto del brief (~400 e 2,5 M), ma i triangoli sono ora all'84 % del tetto: il grosso sono le carte
di foglie dei LOD 0-1 e il sottobosco di «natura» (+0,6-0,7 M rispetto all'unione 1), «paese» pesa
~+0,07 M (rustici, prima persona). Le istanze del sottobosco (ultimo numero di `treesByLod`) vanno da
2577 (01) a 7535 (02) ad Alta.

Altri numeri di `shots.json`: gioco pronto in 7,7 s; simulazione 0,023 ms per passo; 23 275 alberi,
26 370 collisori, 452 lumi (prima 469: i bagliori delle finestre di «paese»). `renderCpuMs` (2,7 s a
Bassa) resta non confrontabile, come spiegato in `unione-1.md` (SwiftShader fa aspettare la CPU).

## Problemi aperti

- **Prestazioni vere da misurare** su una Iris Xe a Media (60 fps a 1080p) e a Bassa (30 fps). Ad Alta
  si arriva a 2,1 M triangoli: le leve sono `PRESET_QUALITA.*.vegetazione` (distanze dei LOD e
  sottobosco), `CAPIENZA` dei LOD 1-2, qualità delle ombre, raggio del Kuwahara.
- **Lavatoio sepolto** (segnalato da «natura», misurato all'unione): la vasca è posata alla quota del
  chiodo 5 (`luoghi/piazza.ts`), ma il suolo sotto di essa sale verso il retro e verso un lato: al
  centro della vasca il suolo sta da 0,6 a 2,0 m sopra la base, contro il bordo della vasca a ~1 m.
  La vasca nuova di «paese» e l'acqua di «natura» ci sono e combaciano (l'acqua sta fra i bordi), ma
  si vedono solo a un'estremità. Sistemarlo vuol dire spostare o riorientare il lavatoio (collisori,
  punto «esamina:lavatoio», chiodo 5): è una scelta di gioco, non solo di grafica.
- **Larici**: da lontano (02) coni scuri a punta, da vicino non rilevati (06) coni pallidi lisci con le
  carte solo alla base. Servirebbe un cono più morbido coperto di carte d'aghi anche in alto (traccia
  «natura»).
- **Coltre dei boschi lontani** a cupole: da certe distanze (01, Bassa) si legge come un selciato;
  un impostore ad atlante la avvicinerebbe ai bozzetti.
- **Inquadratura 6**: con il bosco fitto il contorno d'inchiostro della rivelazione sul suolo è
  nascosto dalle chiome; la meccanica si legge dai colori degli alberi. Se la si vuole didascalica,
  spostare l'inquadratura su un prato.
- **Ombre delle chiome**: le carte non proiettano ombra; l'ombra viene dalle masse nascoste.
- **Tettoia del lavatoio** quasi nera da sotto; **case lontane** (oltre 210 m) ancora scatole senza
  finestre né piode; **prato dei ripiani** giallo saturo a mezzogiorno (confronto 2, foto 17).
- **Prima persona**: la sinistra è la destra specchiata, le dita non si animano oltre le pose; la
  lettera in mano ha righe finte, non il testo della carta.
- Il blu molto saturo dell'altra metà in planata (confronto 3) resta quello di `unione-1.md`.
