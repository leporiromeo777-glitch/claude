# Traccia «paese»: case, piazza, prima persona, Fade

Ramo `grafica/paese`. Architettura e arredi di Corbella, la prima persona (mani, Velo, squadro,
lettera), le Fade, la Cripta del prologo. Ripresa dopo l'interruzione: il commit «Lavoro parziale
interrotto» (rustici, dettagli, superfici taggate, selciato) è stato verificato (typecheck, test,
schermate) e portato avanti; il ramo principale è stato unito prima di ricominciare.

Schermate in `docs/grafica/paese/` (JPEG, 1280×720, Chromium + SwiftShader, qualità Alta):
- `foglio-*.jpg`: bozzetto | prima | dopo (prima = ramo principale al commit 6c12b02, stessa
  inquadratura e stessa ora);
- `dopo-*.jpg`: le inquadrature finali (i quattro confronti del brief, il paese a livello degli
  occhi, la prima persona, le Fade).

## In breve

| | Prima | Dopo |
|---|---|---|
| Mani | palle marroni e bastoni | **guanti di cuoio** con le dita a tre falangi, nocche, pollice, cuciture sul dorso, polsino con la cinghia e la fibbia d'ottone |
| Maniche | cilindri verdi | **lana verde** con il polsino a coste arrotolato, pieghe, più larga verso il gomito |
| Velo (bozzetto 3) | traversa sottile, tela piatta, nappina di plastica | traversa di frassino con le **fasce di cuoio** dove si impugna, **montanti legati con la corda**, asta del bordo, **tela cucita a punti a croce** vista da sotto in controluce, **nappina** rossa con la perlina di legno e le frange |
| Squadro (bozzetto 2) | ottone giallo piatto, braccio a blocco | **ottone lucido** che riflette cielo e suolo, puntale e disco torniti, collari, squadra smussata con la scala incisa, viti, cannocchiale a tubi con paraluce e oculare scuri, livella; piantato sul muro come nel bozzetto (la sinistra stringe l'asta, la destra sul muro) |
| Lettera (bozzetto 1) | solo il lettore HTML | il **foglio piegato in tre**, scritto fitto, nella destra guantata: sale mentre si legge e resta in mano un momento dopo |
| Case | scatole grigie con il tetto nero | rustici di **gneiss chiaro e caldo** con muri spessi, finestrelle strombate, persiane, davanzali, gerani, porte di larice, lobbie, scale esterne, camini con la piota, **tetti di piode** a corsi con la sporgenza e l'**assito di larice sotto le gronde**, zoccolo a scarpa, cantonali, irregolarità, occlusione al piede |
| Piazza | disco di selciato dentro un anello di carta chiara | selciato a meridiana più una **corona**: ciottoli a ridosso del cordolo, terra battuta ocra, prato calpestato che torna il prato del suolo |
| Arredi | | tasso a fiamma verde scuro (prima: pallone nero), telo dell'Ombrista di lino con l'orlo e le toppe, lavatoio con l'assito sotto la tettoia |
| Notte | puntini di bagliore attorno a ogni casa (anche le finestre del retro, attraverso i muri) | ogni finestra accesa ha il suo bagliore, che si spegne quando il vetro guarda dall'altra parte: la casa si accende dal lato che si vede, niente puntini ai bordi |
| Fade | | lanterne col cappello verde e le costole d'ottone, la pietra appesa alle catenelle, le scie ambrate, la luce calda sul suolo sotto lo sciame |
| Cripta | blu-viola e chiara come fuori | luce cotta: più buia, chiarore freddo delle capsule, volta d'intonaco con le macchie d'umido, pozze calde dei lumi, piede delle pareti umido |

## A. Il paese

Il grosso del lavoro sui rustici era nel commit parziale; qui è stato verificato e corretto
guardando le schermate. File: `src/oggetti/oggetti/rustico.ts`, `dettagli.ts`, `campanile.ts`,
`fienile.ts`, `caposaldo.ts`, `lumi.ts`, `src/oggetti/palette.ts`, `src/oggetti/superfici.ts`,
`src/popolamento/**` (tranne `terrazzi.ts`).

- **Superfici dichiarate**: ogni pezzo della libreria dice che cosa è (`superficie` del
  `Costruttore`, aiuti in `src/oggetti/superfici.ts`: `SUP`, `sup(tipo, variante)`,
  `legnoOrizzontale`, `legnoVerticale`, `occlusionePiede`, `occlusioneSotto`): pietra, piode, legno
  ad assi verticali o orizzontali, intonaco, ferro, vetro, tessuto. L'attributo `aSuperficie` arriva
  fino alle mesh cotte delle zone (`Cantiere.forma`, `grezzo`, `oggetto`).
- **Rustici**: muri spessi con i **fori veri** (`geoMuroForato`), finestrelle strombate con il
  telaio in fondo, persiane a stecche aperte contro il muro, davanzali e architravi (pietra o larice),
  porte di larice incassate con le bandelle, lobbie con le mensole e la ringhiera ad assicelle, panni
  stesi e gerani, scale esterne di pietra con il muretto e la ringhiera di ferro, camino con la piota
  e il sasso contro il vento, zoccolo a scarpa più scuro, cantonali chiari. Irregolarità
  (`irregolarita`): i muri rastremano e pendono di pochi centimetri, il tetto imbarca. I collisori
  restano quelli della pianta.
- **Tetti di piode** (`tettoPiode`): lastra di base spessa, corsi di lastre sovrapposte con il bordo
  irregolare, cresta, travi in vista sotto le gronde e sui timpani e, nuovo, l'**assito di larice**
  sotto la falda (dalla strada si vede il legno, non la pietra nera). Piode più chiare e meno
  muschiate (`PALETTE.piode*`), meno variazione da lastra a lastra (da lontano non sono più a
  macchie).
- **Gneiss chiaro e caldo** per i muri (grigio-beige; stessa sequenza di numeri casuali, la casa non
  cambia forma) e la stessa tinta nella versione lontana (`casaLontana`).
- **Corona della piazza** (`coronaPiazza` in `luoghi/piazza.ts`, `coronaSulSuolo` in
  `popolamento/forme.ts`): il suolo del motore attorno al selciato è livellato e chiaro fino a ~32 m
  (maschera della piazza di `render/palette.ts`): si vedeva come un anello di carta. Ora è una corona
  di ciottoli, terra battuta e prato calpestato, con confini irregolari, superficie scelta per
  triangolo (le zone non si mescolano) e al bordo esterno il colore del suolo calcolato con
  `terrainColor` (niente cucitura).
- **Tasso** a fiamma (46 masse verdi scure che prendono la luce, punta che sfugge), **telo
  dell'Ombrista** di lino.
- **Bagliori delle finestre** (`Cantiere.raccogliLumi`, `render/lamps.ts`): i bagliori del motore
  sono spinti verso la camera e non si nascondono dietro i muri, così le finestre dei fianchi e del
  retro facevano puntini attorno a ogni casa. Ogni bagliore di finestra porta ora la direzione del
  vetro (`aDir`): il bagliore si spegne quando la finestra guarda dall'altra parte (lanterne e
  lampioni restano senza direzione, accesi tutt'attorno). Un primo tentativo (al più due bagliori
  per casa, poi solo la facciata) toglieva i puntini ma spegneva il paese: il confronto 5 era più
  buio del ramo principale e più lontano dal bozzetto.

## B. Personaggi e Fade

- **Fade** (`src/oggetti/oggetti/fade.ts`, già nel commit parziale e verificate): cappello di smalto
  verde scuro con costole d'ottone e frangia di lamelle di rame, catenelle dalla pietra alle griffe,
  **scie ambrate** additive (una draw call), luce calda sul suolo sotto gli sciami attivi
  (`Notte.lumiFade`, gli ultimi posti dei lumi del motore entro 140 m).
- **Abitanti procedurali** (`abitante.ts`): vesti, maniche, veli, cappucci, cappelli e scialli
  dichiarano TESSUTO (prima AUTO li leggeva come intonaco o legno), la maschera è legno, la gerla
  intrecciata. Le figure vere vengono dalla traccia «personaggi» (modelli GLB dipinti, ramo
  `personaggi/finale`): la figura procedurale resta per la Madre, Rosa e come ripiego.

## C. Prima persona

File nuovi: `src/render/primoPiano.ts` (materiale e costruttore), `src/oggetti/oggetti/mani.ts`
(guanti e maniche); riscritti `src/oggetti/oggetti/primaPersona.ts` (squadro, Velo, lettera) e
`src/render/firstPerson.ts` (il Velo del motore usa il modello della libreria); nuovo
`src/regia/scena/lettera.ts` (la lettera in mano).

- **Materiale del primo piano** (`materialePrimoPiano`): la luce è quella del mondo (direzione
  della luce principale da `keyLightDir`, colore e forza della Linea, riempimento del cielo
  `ambientTop`, rimbalzo caldo del suolo), in due toni morbidi come le campiture, più un
  riempimento dall'occhio (le cose in mano non stanno mai al buio). Un motivo per materia, scelto
  dal canale alfa di `aColor` (`MATERIA`): legno (venature, nodi), cuoio (grana, pieghe, consumo,
  cuciture a puntini con `CUOIO_CUCITO`), lana (coste, maglia, peluria sul bordo), tela (trama,
  cuciture sopramano, punti a croce, luce trasmessa in controluce), ottone (riflette cielo e suolo
  con l'orizzonte netto, macchia della luce, Fresnel), corda (trefoli), carta (fibre, macchie, luce
  che passa), ferro, fili, vetro. Tutto passa poi dalla post-produzione come il mondo.
- **Costruttore** (`FormePrimoPiano`): tubi lisci lungo una curva Catmull-Rom con sezione
  ellittica, trasporto parallelo della terna, calotte tonde, u = metri lungo la forma e v = giro
  (per i motivi), occlusione cotta per vertice; ellissoidi, geometrie qualsiasi (tornite, estruse
  smussate), unione con matrice (anche specchiata).
- **Mani** (`manoGuanto`): palmo schiacciato, eminenza del pollice, quattro dita a tre falangi
  (solchi fra le dita e pieghe alle articolazioni nell'occlusione), nocche, pollice, cuciture sul
  dorso, polsino con l'orlo, cinghia con la fibbia. Pose: `posaAngoli` (flessioni) e `posaAvvolta`
  (dita avvolte attorno a un cilindro, pollice disteso lungo il cilindro o sotto). La sinistra è la
  destra specchiata (`matriceMano`). **Maniche** (`manica`): lana verde col polsino a coste.
- **Velo** (`creaVeloPrimaPersona`, 3 draw call, ~23 k triangoli): presa «a uncino» (le nocche
  dietro la cima della traversa, le prime falangi la scavalcano, il pollice disteso sopra), costante
  `VELO` con le misure. `FirstPersonVelo` tiene la stessa interfaccia di prima (`update`,
  `tasselLean`, `openAmount`, `uniforms`): la fisica della nappina è la stessa e passa al modello
  (`StatoVelo.angoloNappina`).
- **Squadro** (`creaSquadroPrimaPersona`, 7 draw call, ~18 k triangoli): stesse pose e stessa
  interfaccia; `PUNTALE_PIANTATO` è cambiato (lo squadro piantato sta dove lo mette il bozzetto 2,
  più vicino e a sinistra); i gomiti seguono la posa. La regia (`regia/squadro.ts`) non accende più
  luci three.js: usa gli uniform del primo piano.
- **Lettera** (`creaLetteraPrimaPersona`, `LetteraInMano`): il foglio sale nella destra mentre il
  lettore mostra una carta di tipo lettera, biglietto, dattiloscritto o foglio, e resta in mano 1,4 s
  dopo la chiusura, poi si abbassa. Si aggancia con due righe in `regia/regia.ts` (file condiviso).

## D. La Cripta

`src/regia/scena/cripta.ts` (la Cripta della regia, quella che si vede): `illuminaCripta` cuoce la
luce nella geometria (superficie per colore: pareti e costoloni di pietra, volta a intonaco,
pavimento di lastre, tubi e capsule di ferro; occlusione media che cala attorno alle capsule, con i
vertici vicini che virano all'azzurro: il riempimento rimasto si legge come la loro luce fredda;
piede delle pareti più scuro e umido). L'occlusione non va oltre 0,6: nel materiale del mondo
scurisce anche le pozze dei lumi, e con 0,85 la volta perdeva la luce calda delle lampade. Le capsule hanno un chiarore azzurrino additivo
sotto il vetro (non nella 5, dove sta Elvira) e i vetri sono più freddi. I lumi color miele restano
i lumi del motore.

## API per le altre tracce

```ts
// materiale e costruttore del primo piano
import { FormePrimoPiano, MATERIA, CUOIO_CUCITO, UNIFORMI_PRIMO_PIANO, materialePrimoPiano, misto, rgb } from './render/primoPiano';
const f = new FormePrimoPiano();
f.tubo([a, b, c], [0.02, 0.015], { colore: 0x8a5a36, materia: MATERIA.LEGNO, chiudiFine: true });
const mesh = new Mesh(f.costruisci(), materialePrimoPiano());

// mani e maniche
import { manoGuanto, manica, posaAngoli, posaAvvolta, matriceMano, COLORI_MANI } from './oggetti';
const fm = new FormePrimoPiano();
const { polso } = manoGuanto(fm, posaAvvolta({ y: -0.03, z: -0.07 }, 0.02));
f.unisci(fm, matriceMano(polsoPos, avanti, dorso, /* sinistra */ true));
manica(f, polso, gomito);

// la lettera in mano
import { creaLetteraPrimaPersona } from './oggetti';
const l = creaLetteraPrimaPersona(); l.update(dt, { alzata: 1 });

// corona sul suolo con la superficie per triangolo (popolamento)
coronaSulSuolo(cantiere, z0, th0, r0, r1, passo, sopra, (x, y, r) => [SUPERFICIE.TERRA, colore] | null);

// bagliori con la direzione (finestre): spenti quando il vetro guarda dall'altra parte
game.lamps.setLamps(punti, dimensioni, direzioni /* Vector3 | null per lume */);
cantiere.lume(p, 0.42, normaleDelVetro);
```

- `UNIFORMI_PRIMO_PIANO` (`uLightView`, `uSun`, `uSunI`, `uAmb`, `uNight`, `uTime`): li scrive
  `Game.updateFirstPerson` tramite `FirstPersonVelo.uniforms` (stesso oggetto). Chi disegna altro in
  prima persona li usa così come sono.
- `MATERIA`: PIENA 0, LEGNO 1, CUOIO 2, LANA 3, TELA 4, OTTONE 5, CORDA 6, CARTA 7, FERRO 8,
  FILO 9, VETRO 10; `CUOIO_CUCITO` = cuoio con la riga di punti dove v = 0.
- `SUPERFICIE.SELCIATO` (15) in `render/superfici.ts` (file condiviso, aggiunta di due righe nel
  commit parziale): la pietra a ciottoli piccoli per selciati e vicoli.

## File condivisi toccati

- `src/render/superfici.ts`: `SELCIATO = 15` e il suo ramo in `applicaSuperficie` (commit parziale,
  due righe: la PIETRA a scala ridotta).
- `src/regia/regia.ts`: due righe per agganciare `LetteraInMano` ai sistemi del gioco.
- `src/render/lamps.ts`: parametro facoltativo `dirs` in `setLamps`/`addLamps` (attributo `aDir`,
  zero = come prima) e lo spegnimento del bagliore quando la finestra guarda dall'altra parte (tre
  righe nello shader). Chi chiama senza `dirs` non vede differenze. In `popolamento` (`corbella.ts`,
  `segnaposto.ts`, `tipi.ts`) le direzioni passano insieme alle dimensioni.

## Prestazioni

Chromium + SwiftShader, 1280×720, qualità Alta, stesse inquadrature (`prima` = ramo principale):

| Inquadratura | Draw call prima → dopo | Triangoli prima → dopo |
|---|---|---|
| confronto 1, alba al castagno | 153 → 159 | 885 k → 956 k |
| confronto 2, terrazze a mezzogiorno | 177 → 182 | 824 k → 860 k |
| confronto 3, planata (Velo in mano) | 172 → 172 | 439 k → 461 k |
| confronto 5, notte sul paese | 130 → 136 | 829 k → 900 k |
| piazza al mattino | 163 → 168 | 770 k → 839 k |
| lavatoio | 112 → 116 | 706 k → 764 k |
| chiesa | 183 → 189 | 769 k → 831 k |
| vicolo | 151 → 153 | 600 k → 636 k |
| notte in piazza | 163 → 168 | 770 k → 840 k |
| squadro piantato | 182 → 187 | 820 k → 876 k |
| lettera in mano all'alba | — → 162 | — → 965 k |

Massimo 197 draw call e 0,97 M triangoli, sotto il tetto del brief (~400 draw call, 2,5 M
triangoli ad Alta). Oggetti (`npx tsx`, misura della libreria): rustico 1 piano 1834 triangoli /
2 draw call, 2 piani 4580 / 3, 3 piani 5996 / 3 (tetto della prova: 6000), rustico smontato 2496 /
1, campanile 2650 / 3; Velo 22,8 k / 3, squadro 18,3 k / 7, lettera 9,0 k / 3 (il primo piano si
disegna una volta sola, sopra il mondo). I chiarori delle capsule della Cripta sono una mesh sola
(sei mesh separate costavano 12 draw call anche da fuori, quando la Cripta entra nell'inquadratura).
Il tempo di SwiftShader per scatto non è cambiato in modo misurabile (varia di ±30 % fra due giri
della stessa build).

## Che cosa resta

- **Tettoia del lavatoio**: vista dal basso è quasi nera (sottofalda e travi in ombra, rimbalzo del
  suolo scuro nel materiale del mondo). Era così anche prima; si potrebbe schiarire l'assito o dare
  alla tettoia un'occlusione più bassa, ma tocca il tetto di tutte le case.
- **Confronto 1**: la composizione la fanno il castagno morto e il terreno (tracce «natura» e
  «luce»); le case lontane (versione `lontano`, oltre 210 m) sono scatole col tetto, più chiare di
  prima ma senza finestre né piode.
- **Cripta**: luce cotta per colore; i tubi e la volta restano forme semplici della regia (la
  geometria non è stata rifatta). La vista di risveglio dalla capsula 5 è dominata dal vetro con la
  scritta.
- **Abitanti**: le figure vere arrivano dalla traccia «personaggi»; qui solo le superfici delle
  figure procedurali (Madre, Rosa, ripiego).
- **Lettera**: il foglio è uno solo per tutti i tipi di carta (lettera, biglietto, dattiloscritto,
  foglio); il testo del foglio in mano non è quello della carta (righe finte).
- **Mani**: la sinistra del Velo e dello squadro è la destra specchiata (stesso guanto, stesso
  consumo); niente animazione delle dita oltre alle pose.
