# Personaggi nuovi nel gioco: l'integrazione

I tredici modelli della Fase 1 ([PIPELINE.md](PIPELINE.md), ramo `personaggi/asset`) e il modulo di gioco ([MODULO.md](MODULO.md), ramo `personaggi/modulo`) sono collegati al gioco vero sul ramo `personaggi/integrazione`. Da ora gli abitanti di Corbella sono i modelli dipinti, con il materiale del mondo; dove un modello manca resta la figura procedurale di prima.

![il gioco vero con i personaggi nuovi: Togna al lavatoio, Ottavio in volo e a terra, Annunciata e Bortolo a San Vigilio, i bambini, Nando, Clelia, Pina, la piazza all'alba e di sera](gioco/tutte.jpg)

## Cosa cambia nel gioco

Due file del gioco, in punti piccoli e commentati. Tutto il resto sta in `src/personaggi/**`, `tests/personaggi/**`, `tools/personaggi/**` e `docs/personaggi/**`.

| dove | cosa |
|---|---|
| `src/main.ts`, prima di `installaCorbella` | `collegaMotorePersonaggi({ uniforms, camera })` e `await precaricaPersonaggi(...)` durante la schermata di caricamento («la gente di Corbella», dallo 0,86 allo 0,90 della barra). I 13 GLB si scaricano in parallelo, una volta sola. Senza indice o senza file non fallisce: la gente resta procedurale. |
| `src/popolamento/abitanti.ts`, `crea()` | `obj = creaPersonaggio(id, aspetto) ?? creaAbitante(aspetto);` |
| `abitanti.ts`, `update()` | per i modelli nuovi la posa (seduto, chino) passa nello stato e `posaOssa` non tocca le loro ossa: le sue rotazioni sono pensate per le ossa della figura procedurale (e per l'osso `radice`, che i modelli non hanno). |
| `abitanti.ts`, `accessori()` | la pietra di Nando viene dall'indice (in mano) e non si aggiunge la seconda; il lume di Ottavio va sulla presa `cintura` (assi del modello). Il Velo da planata resta nel gruppo, `png.ts` lo trova per nome come prima. |

Una figura nuova si riconosce da `gruppo.userData.personaggio` (l'id del modello).

## Cosa viene dall'indice dei modelli

`public/personaggi/indice.json` (scritto da `tools/personaggi/indice.py`) ha più campi di quelli che il modulo leggeva. Ora `leggiIndice` (`src/personaggi/schede.ts`) legge anche:

- **`curvo`**: per i personaggi con un nome vale quello scelto in produzione sul modello (Annunciata 0,55, Pina 0,45); per i generici vale almeno quello (l'anziano con la maschera 0,35). Prima il modulo lo ricavava solo dalla postura procedurale.
- **`oggetti`**: gli oggetti di scena `nome@osso` di `src/personaggi/oggetti.ts`, attaccati dalla fabbrica nella posa di riposo: forbici e figura di cartone di Pina, pacchetto di Clelia, pietra di Nando, gerla dei velati che l'avevano (`gerla: true`; il generico con la gerla veste anche chi ha solo il cappello e quelli restano senza), cesto a metà delle donne velate con le mani libere. Il bastone resta quello della fabbrica, che va da terra alla mano (Annunciata, l'anziano con la maschera). Gli oggetti prendono il materiale del mondo, uno per colore, condiviso.
- **`proporzioni: "bambino"`**: passo e respiro dei bambini.

Le schede di riserva in `schede.ts` (senza indice) hanno ora gli stessi valori dell'indice (Pina 1,52, Annunciata 1,56, Lisa 1,25).

Le due versioni di «voce dell'indice» dei due rami restano entrambe: `VoceIndice` (`indice.ts`, la forma completa, per le pagine di prova) e `VoceModello` (`schede.ts`, la lettura tollerante che usa il gioco).

## Il gioco non cambia

- **Posizioni e presenze**: identiche. `tests/personaggi/integrazione.test.ts` monta due Corbella, una senza modelli e una con i 13 modelli registrati, e per otto momenti della Fase 1 (dall'alba del giorno 1 al giorno 3) controlla che ogni abitante sia presente o assente e nello stesso punto (z, θ, h).
- **Cilindri nel mondo**: stesso raggio (0,3 m, `aggiornaCollider`) e stessa base. L'altezza del cilindro è `ingombro.altezza`, che ora è quella della figura che si vede. Differenze rispetto alla figura procedurale:

  | | procedurale | nuovo |
  |---|---|---|
  | Pina | 1,68 | 1,52 |
  | Togna | 1,74 | 1,62 |
  | Clelia | 1,78 | 1,68 |
  | Lisa | 1,14 | 1,25 |
  | Gioanin | 1,17 | 1,12 |
  | Ottavio, Bortolo, Nando, Annunciata | 1,54-1,81 | entro 2 cm |
  | velati | 1,54-1,78 | 1,60-1,75 (±4%) |

  Il cilindro resta alto almeno 1 m: per i passi di Elvira e per gli urti non cambia nulla. Se un giorno servisse l'altezza di prima al centimetro, basta che `aggiornaCollider` usi un'altezza fissa per id.
- **Dialoghi e storia**: stessi punti «parla» (stanno a 1,3 m sopra la posizione, non dipendono dalla figura), stessa regia. La partita automatica `npm run e2e:fase1` passa con i modelli nuovi.
- **Ripiego**: in Node i modelli non ci sono e tutti i test del popolamento girano con le figure procedurali; nel browser `node tools/personaggi/gioco.mjs --procedurale` blocca le richieste a `personaggi/` e il gioco parte con le figure di prima (le schermate di confronto qui sotto). La Madre e Rosa, che non hanno un modello, restano procedurali anche oggi.

## Ritocchi fatti guardando il gioco

1. **Seduti più su**. Con la quota delle anche della figura procedurale (0,5 m dall'origine) la panca di Annunciata e i gradini dell'Ombrista tagliavano le cosce: le vesti dei modelli hanno spessore. Ora le anche stanno a 0,5 m più il 5% dell'altezza (`ancaSeduta` dell'animatore, `SEDUTA_IN_PIU` in `fabbrica.ts`); i `sopra` dei piazzamenti restano quelli.
2. **Ottavio in volo si tiene al Velo**. Con il Velo da planata visibile le mani vanno sui montanti (`StatoPersonaggio.mani`, `PRESA_VELO` in `fabbrica.ts`); prima le braccia pendevano sotto l'ala.
3. **Oggetti in mano dall'indice**, con il materiale del mondo (vedi sopra).

Guardati e lasciati come sono:
- **Scala**: Bortolo davanti al portale di San Vigilio, i bambini accanto a Togna, Clelia alla bacheca: le altezze della Bibbia stanno bene con porte, bacheche e lampioni.
- **Piedi**: sul selciato, sul prato, sulla soglia di Pina, sulla pietra davanti al lavatoio. Nessuno affonda.
- **Orientamento**: tutti guardano dove dicono i piazzamenti (Togna verso il campanile, la gente all'alba verso la Linea).
- **Luce**: di giorno i colori caldi delle texture reggono accanto alle case; prima dell'alba e alla sera dell'Ombrista i personaggi si leggono in blu-viola, come nel bozzetto `finale-5`, grazie al riempimento del modulo.
- **Livelli di dettaglio**: il passaggio LOD0 → LOD1 a 25 m non si nota (sotto, lo stesso velato a 23,5 e a 27 m, ingrandito tre volte); l'isteresi di 2 m evita che sfarfalli sul confine.

![LOD0 a 23,5 m e LOD1 a 27 m, ingranditi tre volte](gioco/lod-confronto.png)

## Le schermate

Fatte nel gioco vero (Vite in sviluppo, modalità e2e, Chromium con SwiftShader) con `node tools/personaggi/gioco.mjs --out=<cartella>`: partita nuova, fuori dalla capsula, per ogni inquadratura l'ora del giorno, gli orari dei contenuti che collocano la gente, la camera libera davanti a chi va guardato. Sono in [`gioco/`](gioco/).

| | |
|---|---|
| ![](gioco/togna-lavatoio.jpg) Togna china al lavatoio (giorno 1, 09:30) | ![](gioco/dialogo-togna.jpg) il dialogo con Togna, da Elvira (tasto E) |
| ![](gioco/ottavio-in-volo.jpg) Ottavio in volo col Velo verde (06:20), le mani sui montanti | ![](gioco/ottavio-a-terra.jpg) Ottavio al prato del ronco (giorno 2, 15:00) |
| ![](gioco/annunciata-san-vigilio.jpg) Annunciata seduta sulla panca del portale, col bastone | ![](gioco/annunciata-di-fronte.jpg) Annunciata, di fronte |
| ![](gioco/bortolo-sagrato.jpg) Bortolo sul sagrato, le mani dietro la schiena | ![](gioco/gradini-ombrista.jpg) la gente seduta sui gradini dell'Ombrista (20:25) |
| ![](gioco/bambini-piazza.jpg) Lisa e Gioanin in piazza delle Ore | ![](gioco/clelia-bacheca.jpg) Clelia alla bacheca, col pacchetto (giorno 2) |
| ![](gioco/nando-ronchi-muro.jpg) Nando chino sul muro del ronco (09:00) | ![](gioco/nando-casa.jpg) Nando davanti a casa, la pietra in mano |
| ![](gioco/pina-soglia.jpg) Pina seduta sulla soglia, forbici e cartone | ![](gioco/piazza-alba-vicino.jpg) un velato con la gerla, all'alba |
| ![](gioco/piazza-notte-prima-dell-alba.jpg) la piazza prima dell'alba (05:36): la gente aspetta la Linea | ![](gioco/piazza-alba.jpg) all'alba (05:55) |
| ![](gioco/piazza-sera-ombrista.jpg) la sera dell'Ombrista (20:25): Togna, i bambini, Bortolo | |

Confronto con le figure procedurali di prima (stessa inquadratura, `--procedurale`):

![](gioco/confronto-togna.jpg)
![](gioco/confronto-bambini.jpg)
![](gioco/confronto-alba.jpg)
![](gioco/confronto-sera.jpg)

E tre foto della partita automatica (`npm run e2e:fase1`), con i dialoghi veri della missione 1:

| | | |
|---|---|---|
| ![](gioco/e2e-dialogo-togna.jpg) Togna, M1.6 | ![](gioco/e2e-dialogo-ottavio.jpg) Ottavio atterra in piazza, M1.7 | ![](gioco/e2e-ottavio-fienile.jpg) Ottavio al fienile |

## Build e caricamento

- `npm run build` copia `public/personaggi/` in `dist/personaggi/`: **13 GLB, 5 347 112 byte (5,10 MB)**, più `indice.json` (11 KB). La build intera pesa 9,1 MB.
- I percorsi sono relativi alla base del gioco (`import.meta.env.BASE_URL`, `./`) risolta su `document.baseURI`. `node tools/personaggi/verifica-dist.mjs` serve `dist/` sotto `/una/sottocartella/`, apre la build di produzione e controlla che `indice.json` e i 13 GLB siano chiesti lì e serviti (200) e che nessuno resti senza modello: passa (gioco pronto in 13 s).
- Durante il caricamento la barra dice «la gente di Corbella»; i 13 file arrivano in parallelo.

## Le prove

- `npm run typecheck`, `npx tsc -p tools/personaggi`.
- `npm test`: 46 file, 619 prove, tutte passate. Nuove: `tests/personaggi/integrazione.test.ts` (6 prove: chi usa quale modello, stesse posizioni e presenze in otto momenti, stessi cilindri, oggetti di scena, seduti e chini dallo stato, Ottavio appeso al Velo); in `modulo.test.ts` la quota delle anche da seduti segue `ancaSeduta`.
- `npm run build` e `node tools/personaggi/verifica-dist.mjs`.
- `npm run e2e:fase1`: la partita automatica completa (prologo e missione 1, 41 verifiche) passa con i modelli nuovi: «prova ok in 545 s» con la macchina carica (carico medio intorno a 15), e di nuovo sul commit finale in 192 s. `docs/shots/` ripristinato dopo ogni corsa.
- `node tools/personaggi/compila.mjs --ramo=grafica/luce`: il materiale si compila con `common.ts` di questo ramo e di `grafica/luce`.
- `node tools/personaggi/gioco.mjs` (tutte le schermate qui sopra) e `--procedurale` (il gioco parte in 8 s con le figure di prima e l'avviso «senza modello»). Con `--prova=<file.json>` fa inquadrature libere e misure (`js`), utili per ricontrollare dopo il rifacimento grafico.
- Crediti Higgsfield spesi per l'integrazione: nessuno.

## Limiti noti e cose da fare

- **Gonne da sedute**: Annunciata, piccola, seduta sulla panca tiene i piedi qualche centimetro sopra il ripiano; i bambini seduti per terra davanti al telo dell'Ombrista sembrano accovacciati (la seduta è quella da panca). Da vicino si nota poco; servirebbe una posa «seduto per terra».
- **Gesti con un oggetto in mano destra**: il bastone e la pietra seguono la mano che saluta. Oggi la regia non fa gesticolare nessuno (solo l'API di debug), ma se servirà conviene scegliere la mano dei gesti.
- **Il rifacimento grafico**: il materiale dei personaggi segue `common.ts` del ramo principale; con `grafica/luce` si compila (`node tools/personaggi/compila.mjs --ramo=grafica/luce`), ma le ombre portate nuove avranno bisogno dello skinning nel loro materiale (vedi MODULO.md). Dopo la fusione vanno rifatte queste schermate.
- La Madre e Rosa non hanno un modello (stanno fuori scena nella Fase 1).
