# Traccia «tempo»: l'attesa corta e l'orologio a schermo

Ramo `migliorie/tempo`. Le due lamentele dopo la prova del 16 ottobre:

> «la dinamica dell'aspettare dura troppo» e «voglio vedere un orologio sullo schermo per sapere che ore sono nel gioco»

Le schermate prima/dopo sono in [`tempo/`](tempo/).

## Che cosa non andava, e perché

### L'attesa

- **La causa.** «Aspetta fino a» (`OrologioStoria.aspettaFino`) moltiplicava per 20 la velocità
  normale del tempo. Un giorno di gioco dura 40 minuti reali, cioè 100 secondi per ogni ora;
  a x20 erano **5 secondi reali per ogni ora di gioco**, e l'attesa cresceva con le ore:
  la brace dalla mattina (10 ore) era 50-56 secondi fermi a guardare il cielo, la seconda notte
  (brace e poi «fra un'ora») un minuto, la notte intera 42 secondi. Non c'era modo di saltare.
- **Il menu non offriva la voce giusta.** Dopo la brace (19:30) il racconto dell'Ombrista comincia
  alle 19:45, ma il menu non lo proponeva: si restava 25 secondi in piedi davanti al telo. La
  seconda notte si dorme dalle 20:30, ma il menu offriva la brace e poi «fra un'ora». Vegliando,
  le Fade escono alle 22:05: c'era solo «mezzanotte». Chi arrivava era «qualcuno», senza nome.
- **X funzionava solo da seduti**: le indicazioni dicevano «siediti (tieni C) e aspetta (X)»,
  due gesti per una cosa sola. Chi non lo sapeva aspettava in piedi: nella prova automatica il
  campanaro (08:00) si aspettava così, 55 secondi.
- **Le pause fisse della regia.** Ottavio scendeva in spirale in 7 secondi (in piazza dopo i tre
  velati, al fischio, quando viene a parlare): 14 secondi nella prova, contando il passo per
  raggiungere Elvira; fuori dalla piazza restava fermo 25 secondi prima di andarle incontro. Il
  coperchio della capsula si apriva in 2,2 secondi prima di poter dire «Alzati». Seguendo Ottavio
  al fienile (280 m) si camminava al suo passo, 1,7 m/s: quasi tre minuti; e se Elvira andava
  avanti lui si fermava dov'era.

### L'orologio

Non c'era: l'ora si leggeva solo nel menu di pausa («Giorno 1, 10:20») e, a occhio, dal cielo.

## Che cosa è cambiato

### L'attesa: un time-lapse di pochi secondi (`src/regia/orologio.ts`, `src/regia/regia.ts`)

- **Qualunque attesa dura al più 5,5 secondi reali**: `durataAttesa(ore) = min(5,5; 1,6 + 0,45 · ore)`.
  Un'ora di gioco: 2 secondi; la brace dalla mattina o la notte intera: 5,5 secondi.
- **Accelerazione morbida e frenata** (`curvaAttesa`, uno smoothstep): il cielo parte piano,
  corre (al più una volta e mezza la media) e frena all'arrivo, che è esattamente l'ora chiesta.
- **Il secondo tocco salta alla fine**: X, Invio o Spazio durante l'attesa. Lo schermo va al nero
  in 0,2 secondi, il resto dell'attesa corre in 0,6 secondi (sempre a passi contigui) e la vista
  torna in 0,6 secondi. L'orologio resta sopra il nero e le sue cifre corrono anche lì.
- **Gli eventi scattano tutti e in ordine, come prima.** Il tempo passa sempre a passi contigui
  (`avanza` restituisce l'intervallo di ogni passo: `attraversa`, il giro delle Fade, il catasto);
  durante l'attesa la storia si valuta a ogni passo (non dieci volte al secondo), così nessuna
  finestra d'orario si salta; alla fine dell'attesa gli orari degli abitanti si rileggono subito
  (il campanaro alle 08:00 c'è alle 08:00, non qualche secondo dopo).
- **L'attesa si ferma** se Elvira si alza (C o W A S D: Spazio no, salta), se arriva qualcuno
  vicino (con la notifica «Arriva una velata al lavatoio: smetti di aspettare»), se comincia un
  dialogo o una scena (il racconto dell'Ombrista la interrompe, prima la metteva in pausa fino
  alla fine del racconto). Un limite dell'orologio (`orologio:max`, il fermo della prima notte)
  accorcia l'attesa fino al limite, frenando lì, e lo dice.
- **X anche in piedi**: Elvira si siede da sola e il menu si apre. Da seduta X apre il menu e
  durante l'attesa salta alla fine. Ferma in piedi, in un passo che chiede di aspettare (chi
  arriva più tardi, la brace, la seconda notte, la veglia), sotto il puntino compare
  «X — Aspetta fino a… (ti siedi)»; durante l'attesa «X — Salta alla fine (C: alzati)».
- **Le voci del menu** (`vociDiAttesa`), le più utili per prime:
  - chi arriva, con il nome: «le 07:00: arriva una velata al lavatoio»;
  - la brace (19:30) e, la prima sera, «l'Ombrista (19:45)» (dalla mattina si può andare dritti
    al racconto: la brace passa durante l'attesa);
  - la seconda notte «le 20:30 (si può dormire)» e «l'alba (05:30)» da qualunque ora del pomeriggio;
  - vegliando, «le Fade (22:05)», finché non si sono viste;
  - mezzanotte, l'alba, fra un'ora, come prima. Ogni voce dura al più 5,5 secondi (c'è un test
    che le prova tutte, a ogni quarto d'ora).
- **Il menu** ha il numero di ogni voce come un tastino e le ore in tondo («19:30»: nel
  maiuscoletto inciso si leggeva «I9:3o»), e dice che durante l'attesa X salta alla fine.
- **I testi**: «Aspetta fino alla brace (X): Elvira si siede e il tempo corre», «…arriva alle
  07:00: aspetta (X)», il suggerimento «Aspetta fino a…: X (di nuovo X: salta alla fine)».
- **Salvataggio e «Continua».** L'attesa non si salva. Durante l'attesa il salvataggio
  automatico aspetta che finisca e salva l'ora d'arrivo; un salvataggio fatto a metà (uscendo al
  titolo) tiene l'ora di quel momento, e «Continua» riparte da lì, in piedi, col tempo normale,
  senza menu e senza il nero del salto.

### Le altre attese della Fase 1

- **Ottavio scende in 4,5 secondi** invece di 7 (`DURATA_ATTERRAGGIO`, due giri e mezzo di
  spirale invece di tre, alla stessa velocità); fuori dalla piazza, atterrato, va incontro a
  Elvira dopo 7 secondi invece di 25 (`RISERVA_OVUNQUE`).
- **Il coperchio della capsula** si apre in 1,5 secondi invece di 2,2.
- **Ottavio accompagna al fienile a passo svelto** (2,3 m/s invece di 1,7) e non si ferma più se
  Elvira è avanti: la segue, un po' più svelto se lei è lontana.

### L'orologio a schermo (`src/ui/componenti/orologio.ts`, `orologio.css`)

- In alto a destra, un ritaglio di carta come il pannello dell'obiettivo: un piccolo quadrante
  con il sole (o la luna) sul suo arco sopra due colline, e accanto l'ora («10:20») in EB Garamond
  in tondo e sotto «giorno 1» nel maiuscoletto inciso (IM Fell English SC). Le cifre sono in
  tondo e tutte larghe uguali: nell'IM Fell l'1 è una «I» e lo 0 una «o», «10:20» si leggeva
  «IO:2O», e le cifre che corrono non devono far ballare la carta.
- **Il quadrante**: il sole va da un orizzonte all'altro dalle 05:30 alle 21:00, la luna dalle
  21:00 alle 05:30; il cielo del quadrante è un acquerello che cambia con l'ora (rosa all'alba,
  azzurro di giorno, arancio al tramonto).
- **Di notte** il quadrante si fa blu inchiostro, con la luna, le stelle e le colline scure, e la
  carta è più fredda, come al chiaro di luna.
- **Nell'attesa** le cifre corrono, il sole scivola sull'arco, la seconda riga dice «fino alle
  19:30» in vermiglio e un tratto vermiglio gira attorno al quadrante.
- **Non copre niente**: le notifiche gli scendono sotto; il segnalino delle indicazioni lo evita
  come evita il pannello (`GuidaObiettivi.evita`); sparisce sotto le carte, la Pianta, il Taccuino
  e la pausa, e resta sotto i dialoghi (la finestra è in basso: la radice ha la classe
  `ui-solo-dialogo` quando l'unico modale aperto è il dialogo). Si legge su cielo chiaro e scuro
  perché è su carta. Funziona a 1280×720 e a 1920×1080 (scala con `--ui-scala`, come il resto).
- **Fonte unica**: l'ora viene da `OrologioStoria` della regia, passando dal ponte
  (`PonteInterfaccia.aggiornaOrologio`, a ogni disegno); il componente scrive nel DOM solo quando
  cambia il minuto.
- **Impostazioni › Aiuti › «Orologio a schermo»**, accesa di serie.

## Come si regola

| Che cosa | Dove |
|---|---|
| Durata dell'attesa (base, secondi per ora, massimo) | `ATTESA_DURATA_MIN`, `ATTESA_SECONDI_PER_ORA`, `ATTESA_DURATA_MAX` in `src/regia/orologio.ts` |
| Il salto (secondo tocco) | `ATTESA_DURATA_SALTO` (orologio.ts); la dissolvenza in `Regia.saltaAttesa`/`fineAttesa` |
| La curva (partenza e frenata) | `curvaAttesa` (orologio.ts) |
| Le voci del menu e le ore della sera | `vociDiAttesa`, `ORA_BRACE`, `ORA_OMBRISTA`, `ORA_DORMIRE`, `ORA_FADE` (orologio.ts) |
| Quando compare «X — Aspetta fino a…» in piedi | `PASSI_DI_ATTESA`, `FERMA_PER_ASPETTARE` in `src/regia/percorso.ts` |
| La discesa di Ottavio, il suo passo | `DURATA_ATTERRAGGIO`, `GIRI_ATTERRAGGIO`, `passoAccompagna` in `src/regia/png.ts` |
| Ottavio fuori dalla piazza | `RISERVA_OVUNQUE` in percorso.ts |
| L'orologio: misure, carta, quadrante | `src/ui/componenti/orologio.css` (`--or-quadrante`, `.ui-or-ora`…) |
| L'orologio: cieli del quadrante | `CIELI` in `src/ui/componenti/orologio.ts` |
| L'orologio: acceso o spento | Impostazioni › Aiuti › Orologio a schermo (`orologioSchermo`) |

## Tempi reali prima e dopo

Secondi reali di chi gioca (passi di 1/60 s), misurati dalla prova automatica
(`npm run e2e:fase1`, che ora li scrive con «⏱» e in `docs/shots/fase1/e2e.json`, campo
`tempiAttese`) sulla build di prima e su quella di adesso; dove la prova non passa di lì,
calcolati dal codice.

| Attesa | Prima | Dopo | Fonte |
|---|---|---|---|
| Il coperchio della capsula: dalla scritta letta a «Alzati» | 2,10 s | 1,43 s | prova |
| «fra un'ora» (un'ora di gioco) | 5,00 s | 2,05 s | prova |
| I velati: dalle 06:20 alle 09:20 (tre volte «fra un'ora») | 15,0 s | 6,2 s (5,3 s con un salto) | prova |
| Ottavio scende in piazza e parla | 14,0 s (discesa 7 s) | 9,0 s (discesa 4,5 s) | prova |
| Ottavio, se Elvira non è in piazza, prima di venirle a parlare | 25 s | 7 s | codice |
| La brace dalle 09:28 (10 ore) | 50,0 s | 5,55 s | prova |
| La brace dalle 07:00 (12 ore e mezza) | 62,5 s | 5,5 s | calcolo |
| Dalla brace al racconto dell'Ombrista (19:30 → 19:45) | 24,6 s in piedi davanti al telo | 1,75 s («l'Ombrista (19:45)») | prova |
| Seguire Ottavio al fienile (280 m) | 165 s al suo passo (1,7 m/s); andando avanti, lui si fermava | 122 s al suo passo (2,3 m/s); andando avanti (67 s) lui segue | calcolo |
| Vegliando, fino alle Fade (dalle 20:45 alle 22:05) | 133 s a tempo normale, o 16 s con «mezzanotte» (le Fade passavano a x20) | 2,2 s («le Fade (22:05)») | calcolo |
| Vegliando, dalla mezzanotte all'alba | 27,5 s | 4,1 s | calcolo |
| La notte intera, dalle 21:00 all'alba | 42,5 s | 5,4 s | calcolo |
| Giorno 2: la novizia alla Bacheca alle 07:00 (dalle 05:32) | 10,0 s (due «fra un'ora», fino alle 07:32) | 2,3 s («le 07:00: arriva una novizia») | prova |
| Giorno 2: il campanaro sul sagrato alle 08:00 (dalle 07:33) | 55 s in piedi nella prova; con il menu 2,5 s e poi qualche secondo perché comparisse | 2,05 s, e c'è subito | prova |
| Il fischio: Ottavio scende dal cielo | 7,0 s | 4,5 s | prova |
| La seconda notte: fino alle 20:30, per dormire | 60,6 s dalle 08:24 (la brace 55,6 s, poi «fra un'ora» 5 s) | 5,55 s dalle 10:32 (una voce sola) | prova |
| La seconda notte senza dormire: dalle 20:30 all'alba | 45 s | 5,5 s | calcolo |
| Il secondo tocco (X, Invio, Spazio) | non c'era | il resto in 0,6 s sotto il nero | prova, test |

Nella prova «prima» la brace, la seconda notte e i velati erano già aspettati con il menu: chi
non lo usava aspettava a tempo normale, 100 secondi per ogni ora di gioco.

## Prove

- `npm run typecheck`, `npm test` (64 file, 864 test: 22 in più), `npm run build`,
  `npm run verifica-contenuti` (0 errori, 0 avvisi): verdi.
- **Test nuovi.** `tests/regia/orologio-luoghi.test.ts`: il time-lapse arriva esattamente all'ora
  chiesta, a passi contigui e mai all'indietro; qualunque attesa (la brace dalla mattina, la notte,
  quasi un giorno) dura al più 5,5 s; la partenza piano e la frenata (all'inizio e alla fine meno
  di un quinto della velocità media, a metà al più una volta e mezza, nessun salto di velocità da
  un passo all'altro); il secondo tocco arriva in 0,6 s; gli eventi della notte (le 22:05, le
  22:20, le 23:20, 00:30, 02:00, 04:30) scattano tutti, una volta e in ordine, aspettando e
  saltando; il limite tronca l'attesa frenando; interrotta, il tempo torna normale; salvare a
  metà attesa tiene l'ora di quel momento, dopo l'attesa quella d'arrivo.
  `tests/regia/percorso.test.ts`: le voci del menu (brace e Ombrista, le 20:30 e l'alba della
  seconda notte, le Fade, chi arriva con il nome e al plurale, nessuna voce doppia) e, a ogni
  quarto d'ora del giorno e in ogni passo, nessuna voce più lunga di 5,5 s; le indicazioni
  «X — Salta alla fine» e «X — Aspetta fino a… (ti siedi)».
  `tests/ui/orologio.test.ts`: le cifre (troncate come un orologio vero), il sole e la luna
  sull'arco, il cielo del quadrante continuo, la notte, l'attesa («fino alle 19:30»), il DOM
  scritto solo al cambio del minuto, l'impostazione, le notifiche sotto, i modali che lo coprono
  e il dialogo che no.
- **`npm run e2e:fase1`**: «prova ok» (389 s; prima 327 s: la prova adesso ricarica una volta in
  più, per «Continua» a metà attesa, e fa due foto in più). Usa X in piedi, il menu con le voci
  nuove (l'Ombrista, «le 07:00: arriva una novizia», «le 08:00…», «le 20:30 (si può dormire)»),
  salta un'attesa a metà, salva a metà dell'attesa delle 20:30, ricarica e «Continua»
  (controlla l'ora, che Elvira sia in piedi, senza attesa né menu, e che l'orologio a schermo dica
  la stessa ora), poi aspetta fino in fondo e controlla che il salvataggio automatico dica le
  20:30. Ogni attesa che supera 6 s fa fallire la prova. I tempi sono in `e2e.json`
  (`tempiAttese`). L'orologio si vede in tutte le foto della prova (sotto i dialoghi sì, sotto le
  carte e la Pianta no).
- **`npm run shots`**: le inquadrature nuove 15 (giorno), 16 (notte), 17, 17b, 17c (l'attesa della
  brace a 1,5 s, a 3,5 s e all'arrivo: le cifre e il sole che corrono), fatte con la pagina intera
  dopo le verifiche di gioco (le altre inquadrature e le verifiche non cambiano).
- **A occhio** (Playwright, letto con Read): l'orologio a 1280×720 e a 1920×1080, di giorno, di
  notte, nell'attesa e con due notifiche sotto; una sequenza di nove fotogrammi dell'attesa della
  brace (ogni 0,7 s: 10:21, 10:45, 11:50, 13:20, 15:03, 16:45, 18:12, 19:11, 19:30: si vede la
  partenza piano e la frenata), il menu, il salto (prima, sotto il nero con le cifre che corrono,
  dopo).

## Schermate (`tempo/`)

| File | Che cosa si vede |
|---|---|
| `01-prima-senza-orologio.jpg` | Prima: la prova al lavatoio, nessun orologio |
| `02-dopo-orologio-sotto-il-dialogo.jpg` | Dopo, la stessa foto della prova: l'orologio in alto a destra, il dialogo in basso |
| `03-orologio-da-vicino-giorno-notte-attesa.jpg` | L'orologio ingrandito: di giorno (10:20), di notte (23:12), nell'attesa (12:11, «fino alle 19:30») |
| `04-orologio-di-giorno.jpg`, `05-orologio-di-notte.jpg` | `npm run shots` 15 e 16: in piazza alle 10:20 e alle 23:40 |
| `06-`, `07-`, `08-attesa-…` | `npm run shots` 17, 17b, 17c: «aspetta fino a: la brace» dopo 1,5 s (12:00), dopo 3,5 s (16:44), all'arrivo (19:30, il passo barrato) |
| `09-prova-attesa-della-brace.jpg` | La prova automatica a metà dell'attesa della brace |
| `10-in-piedi-x-aspetta.jpg` | Ferma in piedi nel passo della brace: «X — Aspetta fino a… (ti siedi)» |
| `11-orologio-1920x1080.jpg` | L'orologio a 1920×1080, alle 10:20 (una prova veloce: il pannello è ancora quello del prologo) |
| `12-menu-aspetta-fino-a.jpg` | Il menu: la brace, l'Ombrista, fra un'ora, con i tastini |
| `13-sequenza-attesa-brace-ogni-0-7-s.jpg` | Nove fotogrammi dell'attesa della brace, uno ogni 0,7 s: 10:21 → 19:30 in 5,5 s |
| `14-salto-prima-nero-dopo.jpg` | Il salto: alle 20:41 (fino a mezzanotte), sotto il nero alle 22:15, a mezzanotte (giorno 2) |

## Che cosa resta

- **La voce con il nome di chi arriva** c'è quando le indicazioni sanno chi si aspetta e dove
  (`GuidaObiettivi.arrivo`): per la novizia lo sanno solo con Elvira già alla Bacheca (la tappa
  del dialogo è il luogo, poi la persona: `destinazione.ts`). Prima, dalla piazza, il pannello dice
  «dalle 7 una novizia ti aspetta lì» e il menu offre «fra un'ora».
- **Le scene restano com'erano**: il nero a scatti dell'inizio nella capsula (3,2 s), la luce
  della botola (1,6 s), la dissolvenza del sonno (2,6 s), alzarsi dalla capsula (1,4 s). Non sono
  attese a mani in mano: lo sguardo si muove già.
- **Il dialogo nel fienile** (`d_ottavio_fienile`) si apre appena Elvira arriva, anche se Ottavio
  è ancora per strada (era così anche prima); adesso almeno lui cammina verso il fienile invece
  di restare fermo indietro. Che venga accanto a lei prima di parlare è della traccia «parlare».
- **La discesa di Ottavio va in tempo reale** (4,5 s): un dialogo con lui chiesto durante
  un'attesa si apre dopo l'attesa, quando è a terra.
- **L'orologio tronca i minuti** come un orologio vero; la pausa e la descrizione del salvataggio
  li arrotondano (`testoOra`): a metà minuto possono differire di uno.
- **Prestazioni**: l'orologio è DOM, non scena: draw call e triangoli non cambiano (le
  inquadrature 15-17 di `npm run shots`, in piazza a qualità Media, fanno 197-211 draw call e
  1,34-1,38 milioni di triangoli, con e senza attesa); l'orologio scrive nel DOM una volta al
  minuto di gioco (a ogni fotogramma solo durante l'attesa: cinque scritture); la storia valutata
  a ogni passo durante l'attesa costa circa 0,05 ms per passo (misurato in Node).
