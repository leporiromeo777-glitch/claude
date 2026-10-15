# Cielo di Terra — Documento di progetto (GDD)

*Chi tiene la valle*

> Ti svegli in un giardino che gira da duecento anni, con il lago dell'altra valle appeso sopra la testa, una carta che di notte cancella tutto ciò che nessuno ha misurato e, sul vetro della capsula, una lettera di tua figlia che parla del fiore sbagliato.

Versione 1.0 del documento di progetto. Fonte: `idee-gioco/concept/mix-finale.json`, il concept scelto. Questo documento lo riorganizza per chi costruisce il gioco e prende le decisioni che il concept lascia aperte.

---

## 0. Come si usa questo documento

- **È normativo.** Se un numero o una regola qui differisce dal concept, vale questo documento. Le differenze sono elencate nell'appendice C, ciascuna con il suo motivo.
- **Le costanti del mondo sono quelle del motore** (`src/world/layout.json`): asse Z da 0 (Tappo Sud) a 3000 m (Tappo Nord), raggio interno 646 m, rotazione in 51 s, griglia delle particelle di 75 × 96 celle. Il design non le cambia: ci costruisce sopra.
- **Le posizioni si scrivono sempre (z, θ, h)**: z in metri lungo l'asse, θ in gradi, h in metri di quota sopra il fondo del cilindro, misurata verso l'asse (r = 646 − h). Esempio: il Pilastro 1 sul campanile di San Vigilio è (1062, 37,2, 62,5).
- **I dati giocabili stanno in `content/*.json`.** Il documento di sceneggiatura della prima versione è `docs/design/FASE1.md`.
- **Parole chiave.** «Deve» indica un requisito; «può» un'opzione lasciata a chi costruisce; «di regola» un valore da tarare nei test.

---

## 1. Visione e pilastri

### 1.1 Il gioco in un paragrafo

Elvira Pedrazzini, 58 anni, botanica di Cevio, si sveglia dopo due secoli d'ibernazione dentro il Verbano, un cilindro rotante lungo tre chilometri che porta dentro di sé tre valli ticinesi ricostruite. Alzando gli occhi non trova il cielo, trova l'altra valle a testa in giù. Il giardino muore e di notte si ridisegna: sciami di piccole macchine con un lume, le Fade, rimettono il mondo in pari con un catasto del 2121, e ciò che nessuno ha misurato al mattino è cambiato. Con lo squadro d'ottone del marito geometra Elvira misura il mondo un pezzo alla volta e lo vede passare dalla matita al colore: è insieme la sua mappa, la sua protezione e la sua indagine. Gioco in prima persona, mondo aperto e continuo, 11-14 ore di trama principale e 22-25 per completarlo, nessun combattimento letale.

### 1.2 I sei pilastri

1. **Il cielo è la mappa.** Non ci sono icone né torri. Si guarda in su e si vede l'altra valle: fumo, vele rosse, lumi, scintille di rame. Ogni meta del gioco si vede prima di raggiungerla.
2. **Misurare è tenere.** Un solo strumento, lo squadro a cannocchiale, fa tre cose con lo stesso gesto: disegna la mappa, protegge il mondo dalla notte e porta avanti l'indagine. Il passaggio dalla matita al colore è la ricompensa principale del gioco.
3. **La notte è una legge, non un caso.** La notte segue due leggi che si dicono in una frase ciascuna e quattro regole applicate sempre nello stesso ordine. Ogni perdita ha una causa visibile, annunciata e rimediabile.
4. **Il mestiere è la chiave.** Le porte della trama si aprono con ciò che Elvira sa fare: leggere una pianta, misurare un angolo, riconoscere un mare lunare, ascoltare un ritardo fra due campane. Il giocatore capisce nello stesso momento di Elvira, e spesso un po' prima.
5. **Nessuno muore per mano tua.** Le macchine si ingannano, si spengono, si riprogrammano o si cavalcano; le guardie catturano e la cattura è un capitolo, non una sconfitta. La risorsa è il fiato. Fallire produce storia.
6. **Il Ticino è il tessuto.** Gneiss, piode, grà, castagni, dialetto, processioni, il bollettino della Valle Maggia. Il gioco deve poter essere riconosciuto come casa da chi è di lì e restare chiaro per tutti gli altri.

### 1.3 Che cosa il gioco non è

- Non è un gioco di raccolta: nessun contatore percentuale, nessun «0/40».
- Non ha icone sulla mappa, torri che rivelano la zona né frecce sul terreno.
- Non scala il livello dei nemici e non ha statistiche da gonfiare: ogni potenziamento aggiunge un'opzione.
- Non ha conti alla rovescia generici: il tempo conta solo dove il mondo ha un orologio leggibile (la Meta, le maree, le manovre, la notte).
- Non uccide la protagonista: una caduta, un'apnea fallita o una cattura costano fiato, tempo o una scena, mai la partita.

### 1.4 Pubblico, piattaforma, durata

- Prima persona, mondo aperto continuo senza caricamenti, nel browser (TypeScript e three.js) e poi come app desktop.
- Trama principale 11-14 ore (Atto I 4-5 ore, svolta e Atto II circa 5, Atto III 2-3). Completamento 22-25 ore. Seconda partita 8-10 ore, diversa per ramo, per drone, per eredità e per finale.
- Una sessione tipo dura 30-40 minuti ed è scandita dal giorno del cilindro (§2.3).

---

## 2. Il mondo

### 2.1 Costanti fisiche

| Grandezza | Valore | Note |
|---|---|---|
| Raggio interno R | 646 m | fondo delle valli, quota h = 0 |
| Lunghezza L | 3000 m | z = 0 Tappo Sud, z = 3000 Tappo Nord (il Sordo) |
| Periodo di rotazione | 51 s | ω = 2π/51 = 0,1232 rad/s |
| Gravità al fondo | ω²R = 9,805 m/s² ≈ 1 g | |
| Gravità alla quota h | g(h) = 1 − h/646 (in g) | 0,5 g a 323 m, 0,3 g a 452 m, 0 sull'asse |
| Velocità del fondo (inerziale) | 79,6 m/s | |
| Arco per grado sul fondo | 11,27 m | alla quota h: (646 − h) · π/180 |
| Spessore del Guscio | 6 m | fra il suolo e lo scafo, h da −6 a 0 |
| Collare (nubi) | h 283-317 | chiazze, copertura 50 %, varchi ogni ~120 m |
| Linea | sull'asse, da z 0 a 3000 | alone di abbagliamento di 48 m di raggio |
| Particella del catasto | cella di 40 m × 3,75° | 75 righe × 96 colonne, id = iz·96 + iθ |

Gravità di riferimento per il level design: le tre «corti di peso» degli Alpeggi stanno a 1 g (h ≈ 13), 0,6 g (h 258) e 0,3 g (h 452). Il Collare è a circa 0,54 g. Da 0,3 g in su il Velo permette di «cadere verso l'altra valle» (§3.6).

### 2.2 Coordinate e direzioni

- **z** cresce verso il Tappo Nord; **θ** cresce nel verso della rotazione; **h** cresce verso l'asse.
- Le cinque direzioni del mondo, come le dice la gente:
  - **a Mane**: verso θ crescente, nel verso della rotazione (est);
  - **a Sera**: verso θ decrescente, contro la rotazione (ovest);
  - **a Mont**: verso z = 0, il Tappo Sud e gli Alpeggi;
  - **a Lag**: verso z = 3000, il Sordo;
  - **in su**: verso l'asse e la Linea.
- **Fogli del catasto** (per l'interfaccia e i nomi delle particelle): 1 = Corbella e le Selve, 2 = Il Verbanetto, 3 = Gli Alpeggi, 4 = Il Sordo, 5 = Le Finestre, 6 = Il Fuso, 7 = Il Guscio. Il nome catastale è «foglio-numero»; il motore usa l'id numerico della griglia, il nome serve a schermo e nei testi:
  - **valli** (fogli 1, 2, 3; righe iz 0-65, cioè z < 2640, compreso il lobo del Tappo Sud): numero = iz·24 + (colonna dentro la valle) + 1. Esempio: la Terrazza Pedrazzini (iz 23, colonna 6 di Valle 1) è «1-559»;
  - **Sordo** (foglio 4; righe iz 66-74, z ≥ 2640, su tutte le 96 colonne): numero = (iz − 66)·96 + iθ + 1. Esempio: l'orto di Battista (cella 6949, iz 72, iθ 37) è «4-614»;
  - **Finestre** (foglio 5; righe iz 0-65): le tre strisce da 8 colonne in fila, Ponti (iθ 24-31), Cieca (iθ 56-63), Vedove (iθ 88-95): numero = iz·24 + k·8 + (iθ − inizio della striscia) + 1, con k = 0, 1, 2;
  - Fuso e Guscio (fogli 6 e 7) non hanno particelle nella griglia del motore: i loro luoghi hanno solo un nome.

### 2.3 Il tempo

| Fatto | Valore |
|---|---|
| Giorno di gioco | 24 ore di gioco = 40 minuti reali; 1 ora = 100 s; 1 minuto = 1,67 s |
| Alba | 05:30-06:30. Alle 05:30 la Linea si accende dal Tappo Sud come una miccia: il fronte di luce corre lungo l'asse e arriva sopra Corbella alle 05:40 e al Sordo alle 06:00 |
| Giorno pieno | 06:30-19:30 |
| Brace | 19:30-21:00. La Linea si ritira dal Sordo verso il Tappo Sud e lascia una brace blu |
| Notte | 21:00-05:30 (circa 14 minuti reali per chi veglia) |
| Giro delle Fade | 22:00-04:30, con un orario per ogni particella (la tabella del giro, §3.4.6) |
| Manovre dell'asse | alba 06:00-06:40, mezza luce 13:00-13:40, brace 20:00-20:40. Durante la Tenuta nel Fondo l'orologio corre a un quarto, così la manovra dura circa 4 minuti reali |
| Passaggio della Meta | ogni 51 s, giorno e notte; su ogni punto delle valli è una lama di luce bianca di 3-4 s |
| Fasi della Sorella | ciclo di 29,5 giorni di gioco; la fase avanza ogni notte |
| Giorni Ciechi | due volte in tutta la partita, scritti dalla trama (§5.3); durano 3 giorni di gioco |

Regola di produzione: un ciclo vero della Meta lungo le Finestre durerebbe 29,5 giorni di gioco (quasi 20 ore reali). Il gioco non lo simula: la posizione della Meta lungo le Finestre è una tabella di trama, e le misure di tre anni di Ottavio sono dati del suo quaderno.

Le campane della Confraternita suonano il mattutino alle 06:00, la mezza luce alle 13:00 e la brace alle 20:00. Sono le ore delle tre manovre: nel 2122 Meridiana fissò lì le correzioni d'assetto, e la Confraternita ne ha fatto un rito senza saperlo. È un indizio leale, mai spiegato prima del Fondo.

### 2.4 La mappa del cilindro

Il cilindro srotolato (z in orizzontale, θ in verticale). È uno schema, non in scala: le coordinate esatte sono nelle tabelle che seguono.

```
 θ \ z   0     250   500   750  1000  1250  1500  1750  2000  2250  2500  2750 3000
 360 ┬─────────────────────────────────────────────────────────────────────────────┐
     │ FINESTRA DELLE VEDOVE (F3, 330-360)   firme del 2121 · Nicchia P35 (1300)    │
 330 ├──────┬──────────────────────────────────────────────────────────────┬──────┤
     │ALPE  │ Sambüch Fontanèla Pradèll │  PIAN DAL FEN · Rascane P28 · Gerra│BOSCH │S
 285 │corti │ (campanili con risonatori)│  Strada della Salida (ometti)      │NÉGRU │O
     │P21P23│ Croce d'alpe e Cimitero   │  VALLE 3 «GLI ALPEGGI» (240-330)   │P50   │R
 240 ├──────┴──────────────────────────────────────────────────────────────┴──────┤D
     │ FINESTRA CIECA (F2, 210-240)    teli di canapa 1100-1900 · Ponte Cieco P33  │O
 210 ├──────┬──────────────────────────────────────────────────────────────┬──────┤
     │VIGNE │ porto │ ~~~~~~~~~ IL VERBANETTO (lago, z 720-2480, θ 141-191) ~~│canva │ e
 165 │P19   │ di    │  Is. Conigli P17 (1180)   Is. Grande P15 (1760)  P9 ▼  │      │
     │      │ Mont  │  Torre dei Bugni P14 (1500, θ 197) · Riva Alta P48 (139)│      │L
 120 ├──────┴──────────────────────────────────────────────────────────────┴──────┤A
     │ FINESTRA DEI PONTI (90-120)   Ponte di Mezzo e Pilastro 12 (1500) · teleferica│N
  90 ├──────┬──────────────────────────────────────────────────────────────┬──────┤T
     │SELVE │ Sass Grand P6 │ prato di Ronco · fienile │ Bocca delle Fade P44  │San   │E
  45 │ALTE  │ riale ≈ θ 50-58   CORBELLA (900-1200) P1   Piana di Sant'Anna P40│Rocco │R
     │P42   │ Selve basse, Pian dei Ricci P4 │ Cartiera · cimitero             │Eremo │N
   0 └──────┴──────────────────────────────────────────────────────────────┴──────┘A
       ▲ TAPPO SUD (z 0-620): gli Alpeggi a gradoni, il Mozzo Sud sull'asse
                                                     IL SORDO (z 2640-3000) ▲
```

In verticale, sopra tutto: il **Collare** (h 283-317, z 200-2800), il **Fuso** (asse, h 600-646) con la Linea, e sotto il suolo il **Guscio** (h −6-0) con le sue quattro gallerie e il **Fondo** sotto il piede del Sordo.

### 2.5 Le zone (tabella di riferimento)

| # | Zona | z | θ | h | Verbo nuovo | Pericolo |
|---|---|---|---|---|---|---|
| Z1 | Corbella e le Selve (hub) | 0-2640 | 0-90 | 0-450 (con il lobo del Tappo Sud) | guardare in su, planare, appuntare, rilevare | Falciatrici a orario |
| Z2 | Il Verbanetto e il Fondale | 0-2640 | 120-210 | 2 (fondo del lago) - 120 | remare, vela, nuoto, apnea | sciami di api di rame impazzite |
| Z3 | Gli Alpeggi | 0-2640 | 240-330 | 0-630 (lobo del Tappo Sud) | gravità variabile, lanciare, ascoltare | il Bue mietitore |
| Z4 | Le Tre Finestre | 0-3000 | 90-120, 210-240, 330-360 | 0 (vetro) - 10 | traversata a impulsi di luce, misurare il cielo | i Ragni di vetro, il freddo |
| Z5 | Il Fuso | 0-3000 | (asse) | 600-646 | gravità zero, spinte e cavi | il calore della Linea |
| Z6 | Il Guscio e il Fondo | 0-3000 | tutte | −6-0 | buio, routine delle macchine, tenere | stalle delle Fade, condotte |
| Z7 | Il Sordo e la Lanterna | 2640-3000 | tutte | 0-642 | sintesi di tutte le regole | il giro delle Fade sulla parete |

Le tre valli condividono i due Tappi. Il Tappo Sud (z 0-620) sale a conca in tre lobi, uno per valle, separati dalle gole delle Finestre; i lobi si uniscono solo in alto, attorno al Mozzo Sud (h 630). Il Sordo (z 2640-3000) è una parete ripida di roccia grigia che sale fino alla Lanterna sull'asse (z 2968).

#### Z1. Corbella e le Selve (Valle 1, θ 0-90)

**Forma.** La valle ha il riale curvo al centro (θ 48-59, serpeggia; a Corbella passa a θ 52-56) e due versanti: quello a Sera (θ 0-48) sale a terrazze di castagni fino a una cresta di 70-120 m, quello a Mane (θ 59-90) è più corto e roccioso e finisce sulla cresta del Sass Grand, sopra la Finestra dei Ponti. A Mont la valle sale nel lobo del Tappo Sud (le Selve alte e la via dei Messi); a Lag si apre nella Piana di Sant'Anna e finisce al piede del Sordo.

**Luoghi principali.**

| Luogo | (z, θ, h) | Contenuto |
|---|---|---|
| Piazza delle Ore | (1046, 37,0, 38,5) | selciato a meridiana (36 m), Bacheca delle Ore, telo dell'Ombrista |
| San Vigilio e Pilastro 1 | campanile (1062, 37,2, 38,5); cella e pilastro h 62,5; palina fino a h 70,5 | landmark di tutto il cielo |
| Cripta dei Giardinieri | botola (1112, 27,0, 42) sotto il castagno morto; sala delle capsule a h −4,5 | inizio del gioco |
| Terrazza Pedrazzini | (948, 23,0, 56) | il castagno del cartellino di zinco, primo innesto, chiodo 3 |
| Mulino sul riale | (1130, 51,0, 7,5) | ruota, chiodo 7 |
| Fienile di Ottavio | (1176, 58,5, 11,7) | rifugio, chiodo 8 sul Sass dal Messo |
| I Ronchi | (1150-1200, 42-48) | case degli Smascherati, casa di Nando |
| Sass Grand e Pilastro 6 | (1190, 74,0, 41,7) | belvedere sulla Finestra dei Ponti |
| Grà di Pian | (890, 17,5, 34) | essiccatoio con fumo, chiodo 37 |
| Pian dei Ricci e Pilastro 4 | (800, 9,0, 91) | Selve alte |
| Balcone dei Messi e Pilastro 42 | (110, 30, 450) | 0,3 g: da qui si «cade» nell'altra valle |
| Cartiera | (1320, 49, 4) | carta di castagno con la filigrana (secondaria 7) |
| Bocca delle Fade e Pilastro 44 | (1520, 70, 18) | botola d'ingresso alla Galleria della Carta |
| Piana di Sant'Anna e Pilastro 40 | (2000, 45, 20) | orti benedetti, frutteti |
| San Rocco dei Pellegrini | (2645, 44, 9) | partenza della scala dei pellegrini, tolta dalla Carta nel 2265 |
| Scala Coperta | cancello (2650, 30, 10) | galleria scavata della Confraternita verso l'Eremo |

**Elementi mobili** (con varianti notturne): 12 in tutta la valle, 4 nel nucleo di Corbella (la passerella del Messo, la scorciatoia delle Terrazze, la casa di Nando, il muro di Ronco). **Segnali di cielo**: il campanile bianco con la palina, il fumo delle grà, i lumi della Piazza alla brace.

#### Z2. Il Verbanetto e il Fondale (Valle 2, θ 120-210)

**Forma.** Il lago occupa il fondovalle da z 720 a 2480, fra θ 141 e 191 (superficie a h 20, fondo fino a h 2, profondità massima 18 m). Per il Coriolis e l'assetto l'acqua si accumula verso la sponda di Sera, la **Riva Alta** (θ 139-143). A Mont il lobo del Tappo Sud porta le **Vigne** a pergola; a Lag il lago finisce nella **Canva**, un canneto paludoso al piede del Sordo.

| Luogo | (z, θ, h) | Contenuto |
|---|---|---|
| Porto di Mont | (700, 166, 22) | pontili con i venti dipinti (Tramontana al mattino, Inverna al pomeriggio) |
| Isola dei Conigli e Pilastro 17 | (1180, 156, 25); faro h 34 | canneto, pescatori, Togn |
| Isola Grande, serra e Pilastro 15 | (1760, 173, 33); eliostato h 50 | giardino botanico, banco ottico (missione 9) |
| Bugni e Torre dei Bugni (Pilastro 14) | (1450-1550, 195-199, 27); torre h 45 | arnie in pietra, api di rame, Rosa |
| Riva Alta e Pilastro 48 | (1500, 139, 26) | dove cadono le api (missione 2) |
| Torre di ricarica sommersa | (1400, 146, 6) | «Energia sospesa: priorità ASSETTO» |
| Relitto del Locarno | (1600, 160, 4), capovolto | l'unico interno allagato |
| Barche della Festa | sei sagome attorno al Locarno, due visitabili | |
| Pilastro 9 | (2300, 170, 2), sotto il limo, accanto alla bocca di scarico | capsula di Aurelio (segreto) |
| Vigne e Pilastro 19 | (450, 165, 60) | |
| Ingresso sommerso della Canva | (2470, 172, 3) | si scopre con la bassa marea del Dondolio; porta al Fondo |

**Sistema nuovo**: l'acqua (§3.8). **Segnali di cielo**: le vele rosse e le lanterne a prua, le scintille di rame sopra i Bugni, la Strada delle Fade di notte (file di lumi sull'acqua).

#### Z3. Gli Alpeggi (Valle 3, θ 240-330)

Il concept descrive bene solo la parte che sale sul Tappo Sud. Questa è la valle intera.

**Identità.** È la valle del peso e delle voci. Ci vivono i Sordi, che rifiutano il velo, ascoltano i campanili e conservano la Salida. Ha una parte verticale (l'Alpe, sul lobo del Tappo Sud), una parte orizzontale e lunga (il Pian dal Fen, i prati da sfalcio) e finisce al piede del Sordo, dove partiva la Salida. È la valle più povera di case e più ricca di cielo: dal Pian dal Fen, senza alberi, si vede tutto il resto del mondo.

**Sotto-zone.**

1. **L'Alpe** (z 0-620, lobo del Tappo Sud, h 0-630). Pascoli a gradoni da 14 m. Le tre corti di peso:
   - Corte Bassa, 1 g (560, 290, 13): la cascina-caseificio dei Sordi, la stanza del fonografo di Fermo, le stalle;
   - Corte di Mezzo, 0,6 g (245, 285, 258): il Pilastro 21, la vasca dove cade la cascata;
   - Corte Alta, 0,3 g (108, 280, 452): la Stalla dei Leggeri, dove si abituano gli animali (secondaria «Il vitello del Collare»).

   E inoltre: la **Cappella delle Voci** (nome ufficiale Oratorio di San Gottardo, (200, 300, 300)), dentro il Collare, con il cavo dell'antenna di servizio (missione 3); la **Pissa Storta**, la cascata curva che cade di sbieco dalla sorgente della Corte Alta (120, 266, 460) alla vasca della Corte di Mezzo; la **Croce d'alpe** con il Pilastro 23 e il **Cimitero dei Forestieri** (420, 312, 92), otto tumuli; la **teleferica del fieno** dalla Corte Alta alla Corte Bassa e giù fino al Pian. In cima, il **Mozzo Sud** (z 0, sull'asse, h 630), portale verso il Fuso.
2. **I tre casali** (z 560-920): Sambüch (680, 255, 25), Fontanèla (780, 300, 3) e Pradèll (900, 270, 3), ciascuno con il suo campanile e il suo **risonatore**, una campana di bronzo cablata nel 2121 alle antenne di servizio. Sono i tre campanili della triangolazione della missione 3. Il Pilastro 26 sta sul campanile di Sambüch.
3. **Il Pian dal Fen** (z 920-2250): prati da sfalcio senza alberi, rascane (rastrelliere per il fieno) disegnate a strisce larghe 100 m, fienili, il Pilastro 28 alle Rascane Grandi (1600, 285, 12), la **Gerra** (1400, 300, 4), un greto di ghiaia dove il torrente si allarga. Qui lavora il **Bue**, la mietitrice, a orario fisso (10:00-16:00) su strisce che si leggono dal cielo. Lungo il Pian corre la **Strada della Salida**, una mulattiera segnata da ometti di pietra ogni 100 m, che le Fade cancellano un tratto per notte dal 2266 (dopo z 2200 la strada finisce in un prato).
4. **Il Bosch Négru** (z 2250-2620): l'unico bosco di conifere del cilindro, larici e abeti piantati nel 2120 come riserva di semi d'alta quota. Lo strato della vegetazione è di Elvira, che lo riconosce. Il Pilastro 50 sta in una radura (2450, 270, 10). Dopo la svolta le Fade del Protocollo Rientro vengono qui di notte a raccogliere le pigne.
5. **Il piede del Sordo, settore degli Alpeggi** (z 2620-2700): i **Sassi Neri**, una frana di blocchi con il Pilastro 31 (2660, 300, 32); la **vernice grattata** (i Sordi provano ogni tanto a dipingere il Sordo, e la mattina la vernice non c'è più); la **Porta dei Tegnitt** (2645, 290, 10), una porta di servizio di ferro murata, l'ingresso della Galleria degli Alpeggi da cui scendevano quelli della Salida.

**Particelle mobili**: 10 (fienili non benedetti, rascane, gli ometti della Strada della Salida, i covoni, le scalette delle corti). **Nodi del Giardino**: la sorgente della Corte Alta (acqua), il prato fiorito del Pian dal Fen (impollinazione), la teleferica del fieno (macchina). **Servizio di Meridiana a valle rilevata**: riparte la teleferica del fieno. **Segnali di cielo**: il fumo bianco della caldaia del caseificio (07:00-09:00 e 17:00-18:00), le strisce delle rascane, la polvere del Bue, la croce d'alpe con il suo lumino. **Verbo nuovo**: la gravità come variabile (saltare lontano, cadere lenti, rotolare massi con traiettorie curve) e l'ascolto.

#### Z4. Le Tre Finestre

Ogni Finestra è una striscia di vetro spessa 1,5 m, larga 30° (338 m), lunga 3000 m, su costoloni di ferro ogni 40 m. Sotto i piedi ci sono le stelle che girano e, ogni 51 s, la Meta. Fra due passaggi della Meta ci sono circa 30 s d'ombra. Ogni 120-150 m lungo la passerella c'è una **nicchia dei pellegrini**, una cappelletta di ferro con un lumino. Dalle valli si scende al vetro dalle scale scavate nei bastioni (40 m di roccia).

| Finestra | θ | Ruolo | Luoghi |
|---|---|---|---|
| **Finestra dei Ponti** | 90-120 | l'unica densa, percorribile da un capo all'altro | Ponte di Mezzo (1500, 105) con il Pilastro 12 sul pilone di ferro (h 8); teleferica dei pellegrini su un cavo da (1480, 88,5, 60) a (1520, 121,5, 60); Cancello dei Pellegrini sul lato di Corbella |
| **Finestra Cieca** | 210-240 | oscurata dalla Confraternita con teli di canapa fra z 1100 e 1900; i Ragni smerigliatori (Atto II-III) | Ponte Cieco (1500, 225) con il Pilastro 33 |
| **Finestra delle Vedove** | 330-360 | i parenti firmarono la faccia esterna nel 2121; Tecla ci cammina ogni notte | Passerella e Nicchia delle Vedove (1300, 345) con il Pilastro 35; le firme più leggibili fra z 1200 e 1400 |

Le altre due Finestre si percorrono solo nei tratti di missione. Solo dalle Finestre si vedono le stelle e solo da qui «si misura il cielo».

#### Z5. Il Fuso

L'asse: una gabbia di cavi e travi attorno alla Linea (nucleo di 1,6 m, alone che brucia entro 48 m). Tre stazioni unite da cavi guida: il **Mozzo Sud** (z 0-30), il **Quadro della Linea** con le Fabbriche degli Sciami (z 1500, h 598) e il **nido d'officina** (z 2200, h 612) con la stampante che batte le lettere di S. In mezzo galleggia la **Barca del Cielo** (z 1150, h 608), visibile da ogni valle come un puntino scuro contro la luce. Ci sono orti sospesi e nidi di rondini che non sanno atterrare. Pericoli: il calore della Linea e le correnti d'aria calda che spingono verso Lag.

#### Z6. Il Guscio e il Fondo

Lo spazio di 6 m fra il suolo e lo scafo, giocabile in quattro gallerie costruite con un solo kit di segmenti:

| Galleria | Posizione | Contenuto |
|---|---|---|
| di Corbella | z 980-1150, θ 20-45 | la Cripta dei Giardinieri (sette capsule) sotto il castagno morto; l'Archivio dei Fondatori sotto la Piazza delle Ore (registrato come «cisterna dismessa»); il pozzo d'aria sotto la casa di Nando |
| del Lago | z 720-2480, θ 160-172 | pompe, condotte, camere d'aria, ingressi sommersi |
| degli Alpeggi | z 300-2645, θ 290 | la lunga galleria della Salida, dalla Porta dei Tegnitt verso il Fondo |
| della Carta | z 1480-1700, θ 60-80 | le stalle delle Fade (sciami appesi come pipistrelli), il terminale del Catasto (1600, 70, −4), gli orari di manutenzione dipinti nel 2121 e il «giro delle Fade» |

Il **Fondo** è un corridoio ad anello sotto il piede del Sordo (z 2690-2710, tutte le θ, h −6 - −1). La Ruota Sorda gli passa a un palmo con un rumore di treno lontano. Le tre ralle: la prima, nera e fusa, a θ 30; la seconda, incrinata, a θ 150; la terza, viva, a θ 270, con il quadro dei martinetti (due volantini e un manometro a luce rossa), la branda, il registro, la tuta di Battista appesa a un chiodo, la tomba di Tobia nel muro, la cartolina di Messina.

#### Z7. Il Sordo e la Lanterna

La parete nord sale da z 2640 (piede) a z 3000; la quota passa da 0 a 642 in pochi centinaia di metri (a z 2800 si è già a h 343). Nella Carta Madre corretta dal G3 il Sordo è «roccia piena, nessun accesso»: le Fade cancellano ogni notte scale, ometti e corde.

| Luogo | (z, θ, h) | Note |
|---|---|---|
| Eremo della Linea | (2785, 30, 320) | a mezza parete sopra Valle 1: reliquiario, cella, scrittoio della Madre; si raggiunge dalla Scala Coperta |
| Pilastri divelti nel 2266 | 210 (2715, 45, 150), 211 (2790, 165, 320), 212 (2915, 285, 500) | restano i fori nella roccia |
| Scala dei pellegrini | θ 44, dal piede (San Rocco) alla Lanterna | tolta dalla Carta, non dalla pietra: chiodi da arrampicata, gradini scavati |
| Orto di Battista (particella 4-614) | (2880, 140, 470) | cengia tenuta in ordine dalle Fade per una riga G1 del 2199 |
| Lanterna | (2968, asse, 642) | osservatorio murato con lastre di piombo; telescopio da 60 cm e cercastelle |
| Caposaldo Zero | sulla soglia della Lanterna | cancellato dalla Carta nel 2265 |

Il Sordo è l'unica montagna che resta a matita per tutto il gioco, finché l'ultimo triangolo non la dipinge.

### 2.6 I capisaldi del Catasto

La rete di Aurelio Respini conta **212 capisaldi**: 24 pilastri di bronzo (alti 1,2 m, con un segnale di 8-10 m, una palina bianca e rossa o un disco, pensato per essere letto con il cannocchiale da 1,3 km) e 188 chiodi d'ottone murati in sagrati, muri a secco e massi. Più il Caposaldo Zero sulla soglia della Lanterna. La numerazione è unica (1-212) e segue l'ordine del rilievo del 2120-2121.

| N. | Pilastro | (z, θ, h) | Zona |
|---|---|---|---|
| 1 | San Vigilio, sulla cella campanaria | (1062, 37,2, 62,5) | Corbella |
| 4 | Pian dei Ricci | (800, 9,0, 91) | Selve alte |
| 6 | Sass Grand | (1190, 74,0, 41,7) | Corbella, versante a Mane |
| 9 | Fondo del Verbanetto (sommerso) | (2300, 170, 2) | Fondale |
| 12 | Ponte di Mezzo | (1500, 105, 8) | Finestra dei Ponti |
| 14 | Torre dei Bugni | (1500, 197, 45) | Verbanetto |
| 15 | Serra dell'Isola Grande | (1760, 173, 50) | Verbanetto |
| 17 | Faro dell'Isola dei Conigli | (1180, 156, 34) | Verbanetto |
| 19 | Vigne | (450, 165, 60) | Verbanetto, lobo del Tappo |
| 21 | Corte di Mezzo | (245, 285, 258) | Alpe |
| 23 | Croce d'alpe | (420, 312, 92) | Alpe |
| 26 | Campanile di Sambüch | (680, 255, 47) | Alpeggi |
| 28 | Rascane Grandi | (1600, 285, 12) | Pian dal Fen |
| 31 | Sassi Neri | (2660, 300, 32) | piede del Sordo |
| 33 | Ponte Cieco | (1500, 225, 8) | Finestra Cieca |
| 35 | Nicchia delle Vedove | (1300, 345, 8) | Finestra delle Vedove |
| 40 | Sant'Anna | (2000, 45, 20) | Piana di Sant'Anna |
| 42 | Balcone dei Messi | (110, 30, 452) | lobo del Tappo Sud |
| 44 | Bocca delle Fade | (1520, 70, 18) | Valle 1 |
| 48 | Riva Alta | (1500, 139, 26) | Verbanetto |
| 50 | Bosch Négru | (2450, 270, 10) | Alpeggi |
| 210, 211, 212 | divelti nel 2266 | vedi Z7 | Sordo |

La rete di Corbella usata nella Fase 1 (10 capisaldi) è in `content/capisaldi.json`.

### 2.7 Landmark e segnali di cielo

Da qualunque punto delle valli si devono vedere almeno tre landmark: il campanile di San Vigilio, la Torre dei Bugni, la croce d'alpe, il Sordo con la Lanterna, le tre Finestre, la Linea, le vele rosse. Il Collare nasconde e rivela, così solo due o tre cose attirano lo sguardo alla volta.

I **cinque segnali di cielo** sono campiture leggibili anche su una mesh semplificata a 1,3 km. Restano a colori anche sul mondo a matita:

1. il colore dei campi (verde sano, bruno malato, grigio «spento»);
2. le colonne di fumo (grà, caseificio, fuochi dei Sordi);
3. le luci notturne (lumi, lanterne, la Strada delle Fade);
4. le scintille di rame (gli sciami di api);
5. i disegni a terra larghi almeno 100 m (rascane, solchi della Bianca, meridiana della Piazza vista dall'alto).

---

## 3. Regole di gioco

### 3.1 I verbi

Ogni zona introduce un verbo o una regola nuova, poi la varia, poi la combina con le precedenti.

| Verbo | Dove si impara | Note |
|---|---|---|
| Guardare in su | prologo | il cielo è la mappa |
| Camminare, sedersi a respirare | prologo | i polmoni di Elvira sono il verbo dell'attesa |
| Leggere (lettere, cartellini, libretto) | prologo | vista di lettura a tutto schermo, testo grande |
| Diagnosticare con la lente dell'erbario | missione 1 | malata, assetata, non impollinata, spenta |
| Innestare e seminare | missione 1 | gesto in tre tempi su ancore previste |
| Planare con il Velo | missione 1 | dai muri a secco, poi dai Tappi e attraverso il cielo |
| Parlare con i velati | missione 1 | si leggono postura, voce e velo; si sceglie a chi dire cosa |
| Appuntare e rilevare con lo squadro | missione 1 | un solo strumento per tutto il gioco |
| Arrampicare | missione 1-3 | muri a secco, costoloni, scale; appigli generosi |
| Vegliare | missione 1 (facoltativo), missione 5 | restare svegli in un punto per vedere che cosa fanno le Fade |
| Remare, andare a vela | missione 2 | venti a orario |
| Nuotare, apnea | missione 2 | 45 s di fiato, catene di sacche d'aria |
| Ascoltare | missione 3 | risonatori, radio, sciami, macchine |
| Lanciare | Alpeggi | ogni lancio curva per il Coriolis |
| Misurare il cielo | missione 4 | goniometro, livella, prisma: stessa interazione dello squadro |
| Fluttuare a gravità zero | missione 6 | spinte, appigli, Bombola di spinta, cavi guida |
| Riprogrammare le macchine | ramo Chiave, drone liberato | |
| Tenere | missione 12 | il verbo del Fondo, usato poche volte |

### 3.2 Il rilievo

**Lo strumento.** Lo squadro a cannocchiale di Aurelio fa due cose:

- **tenuto in mano** è un cannocchiale ×4 che **appunta**: si guarda una cosa entro 1500 m e si tiene la mira per 1 s. La particella passa da bianco a matita sulla Pianta e nel mondo. Un segnale vivo appuntato diventa una nota nel Taccuino («Fumo bruno, Selve alte, a Mont di Corbella»). Appuntare è gratis e illimitato;
- **piantato su un caposaldo** **rileva**: fissa sulla Carta le particelle del ventaglio di un lato.

**La procedura del rilievo** (quattro gesti, sempre uguali):

1. **Pianta**: a meno di 1,5 m da un chiodo o da un pilastro si tiene premuto; lo squadro si aggancia all'ottone con uno scatto.
2. **Livella**: si centra la bolla nella fiala con piccoli movimenti. La tolleranza è larga e si allarga ancora con l'esperienza.
3. **Collima**: si guarda nel cannocchiale e si porta il reticolo sul segnale di un secondo caposaldo visibile, tenendolo fermo 1,5 s. Nel reticolo il bersaglio è una «cartolina» precalcolata (il segnale del pilastro, la testa del chiodo, il lume), così la lettura è sempre leggibile anche a 1,3 km.
4. **Leggi**: Elvira scrive la lettura nel libretto (suono di matita); il lato si chiude.

**L'effetto.** Le particelle del ventaglio del lato diventano **rilevate**. L'inchiostro chiude i loro contorni e il colore entra a velature dalla stazione verso l'esterno in circa 3 s, visibile da tutto il mondo. Il primo rilievo di un foglio traccia per 6 s, a china, la griglia dell'intero foglio sulla valle: si vede quanto c'è da fare, poi la griglia sbiadisce e resta il colore.

**Il ventaglio di un lato A→B** (A = stazione, B = mira) contiene le particelle il cui centro dista al massimo 60 m dal segmento A-B, proiettato sul suolo, e che sono visibili da A secondo la tabella di visibilità. Il ventaglio di ogni lato utile si precalcola offline (per la Fase 1 è scritto in `content/capisaldi.json`).

**La regola del cilindro.**

- **Di giorno** si rileva **vicino**: lati fra capisaldi della stessa valle, lunghi da 40 a 600 m. Un lato che passa a meno di 150 m dall'asse non si può mirare finché la Linea è accesa: abbaglia.
- **Alla brace** si vede ancora tutto: valgono anche i lati vicini fra due chiodi. **Di notte** un lato vicino si chiude solo se il bersaglio è un pilastro con il lume acceso: un chiodo d'ottone a terra, senza segnale, di notte non si vede.
- **Di notte e alla brace** si mira anche **in su**, attraverso il cielo, sui lumi che Ottavio porta in volo sui pilastri delle altre valli (dalla missione 4; in sua assenza le api di Rosa, i fuochi dei Sordi, la lampada di Uè). Tre pilastri di tre valli che si vedono a vicenda formano un **triangolo attraverso il cielo**. Chiudere un triangolo rileva le particelle entro 80 m da ciascun vertice e le **particelle di trama** scritte per quel triangolo. Sei triangoli servono alla trama (§5.6).
- **La stazione libera.** Dove non c'è un caposaldo (il Sordo, una cengia, il fondo di una gola) Elvira pianta lo squadro su un punto qualunque e collima di notte **tre** lumi su pilastri noti: è l'intersezione inversa dei geometri. Il punto viene rilevato con un ventaglio di 40 m e Elvira ci pianta un chiodo nuovo, numerato «E1», «E2»… nel libretto. Il chiodo nuovo è un caposaldo a tutti gli effetti, finché nessuno lo sposta. È il modo di salire il Sordo (missione 14).

**La mano che ricorda.** Dopo i primi 10 rilievi la bolla chiede metà della precisione e la collimazione dura 0,8 s: un rilievo dura meno di 30 s. Una particella che ha perso il rilievo perché il suo caposaldo è stato spostato si rileva di nuovo in 5 s, appena il caposaldo torna al suo posto.

**Il libretto sbaglia.** Le monografie sono del 2120-2121. Dicono «il castagno accanto al pilastro», e il castagno non c'è più o è diventato una casa; dicono «se il tasso non è cresciuto», e il tasso è cresciuto. Il libretto è una guida, non la verità: il gioco ci costruisce sopra piccoli problemi di lettura.

**Il Dondolio.** Dopo la svolta la bolla ondeggia. La lettura si prende quando la bolla passa per il centro, in una finestra fissa di 0,6 s ogni 4,5 s (1,5 s con l'aiuto di accessibilità).

**Quando non si può rilevare**: il bersaglio non è visibile (tabella), il Collare lo copre (a orario fisso, sempre lo stesso), la Linea abbaglia, il caposaldo è stato spostato, oppure Elvira è senza fiato. Un tentativo fallito non costa nulla.

**Seppia e china.** Ripassare a china una particella già rilevata da un altro Giardiniere non toglie il rilievo vecchio: la particella li conserva tutti e sulla Pianta prevale la china. Per le condizioni di missione (`cella:id rilevata`) conta solo il rilievo di Elvira (G5); per la notte conta il rilievo di chiunque.

**Validità.** Un rilievo vale cinquant'anni di gioco finché il caposaldo resta al suo posto: in pratica, per tutta la partita. Il Catasto conserva anche i rilievi di altri Giardinieri: all'inizio del gioco una piccola striscia attorno alla Cripta è già rilevata, a inchiostro seppia, con la firma G4 e la data 2291 (§FASE1).

### 3.3 I tre stati della mappa

Mondo e Pianta usano gli stessi tre stati.

| Stato | Significato | Nella Pianta | Nel mondo, oltre 200 m | Nel mondo, entro 200 m |
|---|---|---|---|---|
| **Bianco** | mai visto | foglio vuoto | carta avorio, solo il contorno delle forme grandi, tratto leggero | dipinto a tempera spenta |
| **Matita** | visto (passato a meno di 60 m o appuntato), non rilevato: può essere sbagliato o cambiare di notte | disegno a grafite | contorni e tratteggio a grafite che tremano piano | dipinto a tempera spenta (saturazione 75 %, contorni a matita sottili) |
| **Colore** | rilevato | contorno a china e acquerello | dipinto pieno | dipinto pieno, contorno a china |

- I **segnali vivi** (fumo, vele, lumi, scintille) restano a colori in ogni stato: si trovano le cose nel non rilevato.
- Una particella a colore mostra la sua **salute**: verde (sana), bruno (malata), grigio (spenta, senz'acqua o senza luce).
- **Transizioni ammesse**: bianco → matita; matita → colore; colore → matita (con un segno rosso e il motivo nel resoconto del mattino, quando il caposaldo è stato spostato o la Penna G3 ha cancellato una scrittura). Mai matita → bianco.
- Il **Sordo** resta a matita (e la Lanterna in bianco) finché l'ultimo triangolo della missione 14 non li dipinge.
- **Stato iniziale.** All'inizio del gioco è bianco quasi tutto. Le Selve sono a matita, perché lo strato della vegetazione l'ha disegnato Elvira: la Pianta si apre con il suo disegno del 2119. La striscia della Cripta è a colore (rilievo G4 del 2291).

### 3.4 La notte

#### 3.4.1 Le due leggi

Sono due articoli del regolamento del Catasto del 2121, che la gente ripete come proverbi senza capirli.

| Legge | Articolo del regolamento | Proverbio | Dove si impara |
|---|---|---|---|
| **Prima** | «Le macchine di manutenzione riportano al progetto ogni particella che nessun Giardiniere ha verificato sul terreno negli ultimi cinquant'anni.» | «Quel che la Giardinéra la mesüra, la nocc la tóca mía.» (Ciò che la Giardiniera ha misurato, la notte non lo tocca.) | col corpo nella missione 1; per iscritto nella missione 5 |
| **Seconda** | «Una misura fatta sul terreno da un caposaldo vale più di qualunque correzione fatta al terminale, finché quel caposaldo resta al suo posto. Fra due correzioni al terminale vale quella del Giardiniere di turno più anziano.» | «La préda mesürada la var püssée che la péna.» (La pietra misurata vale più della penna.) | per iscritto nella missione 5; in pratica nella secondaria «I termini spostati» e nella missione 7 |

Conseguenza che il gioco deve far capire: **per cancellare il lavoro di Elvira la Madre deve spostare la pietra**, e la pietra si può rimettere.

#### 3.4.2 Lo stato del mondo

La notte è una macchina a stati finiti, deterministica e scritta prima. Lo stato del mondo è un vettore piccolo:

- per ogni particella: rilevata (sì/no, da chi, quando), salute;
- per ogni **elemento mobile**: variante corrente;
- per ogni caposaldo: posizione (giusta o spostata, con lo spostamento);
- per ogni ancora della Penna: vuota, scritta, rimisurata;
- globali: atto, giorno, ora, flag delle scelte, contatore dello smeriglio della Finestra Cieca (0-4), stadio del gelo degli Alpeggi (0-3), stadio della Bianca (0-3), Dondolio attivo, mosse della Madre già usate.

#### 3.4.3 Elementi mobili e varianti

Il terreno non cambia mai forma. Di notte cambiano solo **40 elementi mobili** (14 di trama, 26 facoltativi), ciascuno di 1-6 particelle, ciascuno con 2-4 **varianti** già costruite (decal, sagome e pezzi pre-piazzati; in tutto circa 110 pezzi). Le varianti di particelle vicine non cambiano i bordi. Lo scambio avviene quando il giocatore non guarda o dorme.

| Variante | Che cos'è |
|---|---|
| **Carta** | com'è scritto nella Carta Madre (con le correzioni G3): prato pettinato, muro intero, nessuna scala |
| **Abitata** | come l'hanno lasciata gli abitanti: un sentiero battuto, delle assi, una casa non benedetta, un orto |
| **Mietuta** | solo dopo la svolta, solo per gli elementi del Protocollo Rientro: semi e biomassa raccolti, terra nuda |
| **Scritta** | solo nei 10 elementi con un'ancora della Penna: l'elemento di servizio del 2121 scritto da Elvira |

Alcuni elementi hanno **stadi intermedi** prefabbricati (per esempio la casa di Nando, che perde un muro per notte: Abitata → Smontata).

Gli elementi mobili non fanno mai parte dell'hub, anche quando stanno dentro il nucleo di Corbella (hanno sempre `hub: false`). Distribuzione: Corbella e le Selve 12 (4 nel nucleo di Corbella), Verbanetto 9, Alpeggi 10, Tappo Sud 1, Finestre 5, Guscio 2, Sordo 1 (la Via della parete, che però è lunga e ha otto ancore). L'elenco completo è nell'appendice B.

#### 3.4.4 Le quattro regole, sempre in quest'ordine

Ogni notte, all'inizio del giro (22:00), si applicano:

1. **Le mosse della Madre** in programma per quella notte (§3.4.5), sempre annunciate la sera prima. Spostano capisaldi o fanno avanzare un contatore. Le particelle che dipendevano solo da un caposaldo spostato perdono il rilievo. Tetto: 8 capisaldi spostati per notte.
2. **Le correzioni al terminale.** Il G3 della Madre cancella gli elementi scritti dalla Penna di Elvira (firma G5) che lei non ha rimisurato sul terreno. Il G3 batte il G5 al terminale perché la Madre è la Giardiniera di turno più anziana; nessuna penna batte una misura.
3. **Il giro delle Fade.** Ogni elemento mobile non rilevato torna alla variante Carta (o avanza di uno stadio verso la Carta, se ha stadi). Dopo la svolta, gli elementi del Protocollo non rilevati passano a Mietuta. Ogni elemento ha un'ora di passaggio fissa (la tabella del giro).
4. **Le eccezioni fisse.** Le Fade non toccano mai:
   - l'hub (le particelle con `hub: true`: case, chiesa e piazza del nucleo di Corbella, esclusi i suoi quattro elementi mobili), le vie di trama, i rifugi;
   - la particella dove si trova Elvira al momento del passaggio (le Fade aspettano e se ne vanno all'alba: chi passa la notte su un sentiero lo salva);
   - un sentiero necessario senza un'alternativa visibile.

   Severino non interviene mai di notte.

#### 3.4.5 Le dodici mosse della Madre

Scritte a mano, scelte da una tabella secondo lo stato. Tetto per atto: **2 nell'Atto I, 3 nell'Atto II, 2 nell'Atto III**. Ogni mossa è annunciata la sera prima da una lettera della Madre appesa alla Bacheca delle Ore **e** da una variante dell'Ombrista. Non tocca mai l'hub, le vie di trama, i rifugi.

| # | Atto | Nome | Condizione | Effetto | Annuncio dell'Ombrista |
|---|---|---|---|---|---|
| A1 | I | La pietra che cammina | Elvira ha rilevato un lato con il Pilastro 4 **e** ha chiuso almeno una pista fra le missioni 2-5; mai prima del giorno 6 (i lati chiusi nel gioco libero della Fase 1 non la fanno scattare la prima sera) | le guardie spostano il Pilastro 4 di 3 m a Sera (secondaria «I termini spostati») | «e di notte una pietra camminò verso Sera» |
| A2 | I | Il chiodo della Bugnera | Elvira ha rilevato attorno ai Bugni | il chiodo 141 spostato di 2 m: le arnie di Rosa tornano a matita | «e la Bugnera trovò la sua soglia più lontana» |
| A3 | I | Il chiodo del Pian | Elvira ha rilevato nel Pian dal Fen | il chiodo 203 spostato: un fienile dei Sordi torna a matita | «e il fieno non sapeva più dove dormire» |
| A4 | I | La benedizione tolta | Elvira ha rifiutato il velo per tre giorni | la casa di Nando perde la «benedizione» provvisoria (se Elvira gliel'ha data con la Penna) | «e una casa fu dimenticata» |
| B1 | II | Il Tempo della Perla | sempre, la sera della svolta | bando: le Guardie del Velo pattugliano, Corbella si divide, la Finestra dei Ponti è vietata | «e l'occhio della Notte si aprì» |
| B2 | II | La Notte dei Termini | sempre, la notte dopo la svolta | le guardie spostano 8 chiodi di particelle rilevate da Elvira (missione 7) | «domani la valle tornerà com'era scritta» |
| B3 | II | Lo smorzo degli Alpeggi | dopo la missione 8 | la Linea si abbassa sopra gli Alpeggi; gelo, stadio 1-3 (missione 11) | «e la Linea si voltò dall'altra parte» |
| B4 | II | Smeriglio, primo stadio | dopo la missione 9 | i Ragni smerigliano la Finestra Cieca: contatore 0 → 1 | «e la Notte chiuse un occhio» |
| B5 | II | Smeriglio, secondo stadio | dopo la missione 10 | contatore → 2 | «e la Notte chiuse l'altro» |
| C1 | III | Il vetro lattiginoso | dopo la missione 12 | contatore → 3-4: la Finestra Cieca diventa opaca, visibile da tutte le valli | «e la Notte dormì» |
| C2 | III | La Finestra dei Ponti | dopo C1 | i Ragni cominciano dalla Finestra dei Ponti; gli Alpeggi gelano del tutto | «e toccò al Ponte» |
| C3 | III | Il Silenzio delle campane | se Elvira ha parlato con Meridiana dalla Lanterna aperta a metà | la voce di Meridiana tolta ai campanili di Corbella per un giorno | «e le campane tacquero» |

Se Elvira indossa il velo della Madre (§3.14), le mosse A1-A3 e B2 colpiscono le case degli Smascherati invece dei capisaldi di Elvira.

Il grande incontro dei **Ragni smerigliatori** sulla Finestra Cieca (vetro in quattro stadi preparati, guidati dal contatore) si può giocare dopo B4: fermare i Ragni riporta indietro il contatore di uno stadio e annulla la mossa successiva. Ha una soluzione per ramo e una senza pagine (si leggono gli orari dipinti dei Ragni e si stendono i teli di canapa sui loro sensori nei 30 s d'ombra).

#### 3.4.6 Il giro delle Fade

Ogni elemento mobile ha un'ora fissa di passaggio, la stessa ogni notte. La tabella completa è dipinta su un muro della Galleria della Carta (missione 5): da quel momento il Taccuino la conosce e «aspetta fino a» propone «arrivo delle Fade». Prima, il giocatore la può ricostruire vegliando. Le Fade escono dal Guscio dalle «bocche» (botole nei prati) alle 22:00 e rientrano alle 04:30, con la tabella di Corbella in `content/fade_fase1.json`.

#### 3.4.7 La Penna di catasto

Pagina del ramo Chiave. Elvira scrive nella Carta Madre uno degli elementi di servizio previsti dal progetto del 2121 (passerella, scala alla marinara, chiusa, ripiano) su una delle **30 ancore** del mondo. Al massimo una scrittura per notte e solo in una particella rilevata. Le Fade costruiscono l'elemento durante la notte. All'alba va rimisurato dal caposaldo (5 s): se no, la notte seguente il G3 lo cancella, perché la Madre legge la firma G5 la sera stessa. Con l'Ombra di Meridiana la Madre non vede le firme. Le 30 ancore stanno dentro i 10 elementi mobili che hanno la variante Scritta: 8 nella Via della parete del Sordo, 6 negli Alpeggi, 6 nel Verbanetto, 5 a Corbella e nelle Selve, 3 nel Guscio, 2 sulle Finestre (appendice B).

#### 3.4.8 Il resoconto del mattino

Al risveglio (o all'alba, se Elvira ha vegliato) la Pianta si apre sui cambiamenti della notte:

- ogni particella cambiata è segnata in rosso, con il motivo in una riga: «Non misurata: tornata alla Carta», «Chiodo 141 spostato di 2 m a Sera», «Scrittura G5 cancellata dal G3»;
- in fondo, la prossima finestra utile in chiaro (Meta, marea, pompa, vento, manovra);
- se non è cambiato niente: «Notte quieta».

#### 3.4.9 Garanzie, verificate da un simulatore in Node

Un simulatore senza browser gioca migliaia di partite casuali e verifica in integrazione continua che:

- ogni missione resti completabile in ogni stato raggiungibile, con zero pagine e con ciascun ramo da solo;
- nessuna notte tocchi hub, vie di trama e rifugi;
- la perdita di una notte non superi 8 capisaldi;
- ogni cambiamento abbia una riga nel resoconto;
- Severino non compaia mai nella notte;
- ogni momento di trama legato al cielo (Giorni Ciechi, Perla, Dondolio) sia raggiungibile.

### 3.5 Gravità e movimento

| Grandezza | Valore |
|---|---|
| Camminare | 1,4 m/s (0,9 m/s nei primi 10 minuti: le gambe di due secoli) |
| Passo svelto | 2,6 m/s |
| Corsa | 4,2 m/s, consuma fiato |
| Salto a 1 g | 0,45 m di altezza; scala con 1/g (1,5 m a 0,3 g), tetto 6 m |
| Quota sicura di caduta | 4 m a 1 g, scala con 1/g |
| Rotazione sul corpo | correndo a Sera si pesa meno, a Mane di più, al massimo ±5 % (valore fisico con la pagina «Passo a Sera» o l'opzione «fisica piena») |
| Coriolis sul corpo | 40 % su passi e salti; 100 % su oggetti, acqua e planate |

- **Cadute.** Elvira non si ferisce mai in modo permanente. Oltre la quota sicura la caduta costa fiato in proporzione; oltre tre volte la quota sicura il fiato si svuota, la vista si stringe, Elvira resta a terra 3 s e si rialza dov'è.
- **Caduta lenta** (dotazione di base): un freno a ventaglio cucito nel Velo che limita la discesa verticale a 6 m/s senza planare. Serve nel Fuso e sulle pareti.
- **Bombola di spinta** (dotazione di base): tre spinte da 4 m/s a gravità quasi nulla, si ricarica nelle stazioni del Fuso.
- **Arrampicata.** Solo su superfici leggibili: pietra a secco con le fessure in ombra, ferro con i rivetti, edera, scale. Aggancio automatico a un appiglio entro 0,6 m davanti allo sguardo. In salita consuma fiato lentamente.
- **Lanciare.** Sassi, semi, lumi: la traiettoria curva per il Coriolis, più in alto più si sente. Un arco a matita di anteprima è un'opzione di accessibilità, spenta di serie.

### 3.6 Il Velo

L'ala di tela di Elvira, con la traversa di legno e una nappina appesa. Si vede sempre il suo bordo in alto quando è aperto, e si riflette nell'acqua.

- **Apertura**: in caduta, almeno 3 m sopra il suolo.
- **Planata**: 9 m/s in avanti, discesa 2,2 m/s · √g. Rapporto 4:1 a 1 g, circa 7:1 a 0,3 g. Picchiare aumenta velocità e discesa; cabrare sotto 6 m/s porta allo stallo (si perde quota, non si cade di colpo).
- **Correnti calde**: colonne ascendenti sopra i campi soleggiati e le grà fumanti, oltre 80 m di quota: +1,5 m/s. Con la pagina «Velo a vela» si sale a spirale.
- **La nappina** pende dalla parte della deriva di Coriolis: è l'unico «indicatore» del volo.
- **Attraversare il cielo.** Da 0,3 g in su (h ≥ 452: il Balcone dei Messi, la Corte Alta, la parete del Sordo) ci si lancia verso l'altra valle. Il volo dura 60-90 s, passa a 150-200 m dall'asse (fuori dall'alone della Linea) e a metà strada il «giù» si capovolge: un rollio lento di 180° in 6 s, annunciato dalla nappina (o, con l'opzione di comfort, una dissolvenza a pennello). Sopra h 560 l'aria non porta: lì si va per inerzia e il Velo serve solo a orientarsi. Si atterra in planata nell'altra valle.
- **Comfort**: orizzonte fisso con il rollio agganciato al «giù» locale, vignettatura in planata regolabile, campo visivo regolabile.

### 3.7 Il fiato e l'attesa

- Il **fiato** è l'unica risorsa del corpo. Lo consumano la corsa, l'arrampicata, le cadute, i colpi (cariche delle Falciatrici, nebbiolina delle api) e l'apnea. Non c'è barra: la vista si restringe ai bordi, il respiratore si sente più forte, i suoni si attutiscono.
- Si corre tenendo premuto **Shift**: da fiato pieno la corsa regge circa 28 s, poi Elvira rallenta. Nel prologo, finché non si siede sul muretto del belvedere, Shift dà solo una corsetta zoppicante.
- Si recupera camminando piano o **sedendosi a respirare** (fiato pieno in 6 s).
- **«Aspetta fino a»**: da seduta, Elvira fa passare il tempo fino a un evento scelto. Le voci si sbloccano man mano che il giocatore le conosce: prossima Meta, brace, alba, mezzanotte, arrivo delle Fade, Strada delle Fade stesa, marea, manovra. Il tempo accelera fino a ×20 e la riga del cielo nel Taccuino conta all'indietro. Si interrompe se qualcuno si avvicina.
- **Apnea**: il respiratore regge 45 s sott'acqua (35 s se la Pesarina è stata spenta, +50 % con l'opzione di accessibilità). Ogni sacca d'aria ricarica il fiato e resta segnata per sempre nel Taccuino come punto di respiro.
- **Dormire** in un letto o in un rifugio porta all'alba e fa passare la Pesarina.

### 3.8 L'acqua

L'unico sistema d'acqua del gioco, usato dal lago, dal Fondale, dalle condotte e dalla marea.

- **Livello**: una funzione analitica h(z, θ, t) condivisa da shader e logica: livello base h 20, pendenza verso la Riva Alta (+0,6 m), marea del Dondolio dopo la svolta (±1,8 m, periodo di 9 minuti reali), l'onda scriptata della missione 7.
- **Barca a remi**: va ovunque a 1,8 m/s.
- **Barca a vela**: solo con il vento. La **Tramontana** soffia dalle 07:00 alle 12:00 verso Lag, l'**Inverna** dalle 13:30 alle 18:30 verso Mont; fuori orario è bonaccia. Il vento è un campo che dipende solo dall'ora, dipinto sui pontili come un orario.
- **Nuoto**: secondo modo del controller, 1,1 m/s in superficie, immersione fino a 18 m.
- **Il Fondale**: piani verde-giada sempre più scuri. Ogni 51 s la lama della Meta illumina il fondo per 3 s e si vede lontano; fra due lame si vede a 8 m (12 m quando le pompe sono riaccese, servizio della valle rilevata).
- **Sacche d'aria**: 12 volumi disegnati a mano; le catene di sacche aprono il profondo.
- **Correnti delle pompe**: a orario, 1 m/s per 2 minuti di gioco ogni ora.
- **La Strada delle Fade**: passerelle di servizio stese di notte sul lago, lungo il Tappo Sud e fra i costoloni delle Finestre, secondo orari dipinti sui pontili. Percorribili solo fra la brace e l'alba; dieci secondi prima di ripiegarsi i lumi tremano, e chi resta sopra cade in acqua o sul prato.
- **Dopo la svolta**, la marea del Dondolio scopre e richiude ogni 9 minuti reali gli ingressi sommersi del Guscio.
- **Passaggio sopra/sotto** la superficie: dissolvenza a pennello, mai uno scatto.

### 3.9 Le macchine

Cinque tipi, tutti con un **orario**, un **compito** e un **raggio di sensori** leggibili, tutti costruiti come componenti guidati da dati.

| Macchina | Compito e orario | Sensori | Se disturbata |
|---|---|---|---|
| **Falciatrici** (quadrupedi da sfalcio inselvatichite) | pascolano su prati fissi, 09:00-12:00 e 15:00-18:00 | vista corta (12 m, cono di 90°), vibrazioni | caricano: spinta e fiato |
| **Ragni di vetro** | puliscono le Finestre; ciechi nei 30 s d'ombra fra due Mete | vista lunga quando passa la Meta | spingono fuori dalla passerella verso la nicchia più vicina |
| **Il Bue** | mietitrice enorme degli Alpeggi, a strisce, 10:00-16:00; dopo la svolta segue il Protocollo | vista e calore | travolge il raccolto, non le persone |
| **Sciami di api di rame** | impollinano al mattino; seguono il calore | calore | se impazziti, nebbiolina: vista annebbiata e fiato |
| **Le Fade** | di notte rimettono in pari il mondo | nessuno per le persone | non attaccano mai |

I droni di servizio Uè, Dué e Lué sono parenti delle Fade, più grandi (§4). Con tutte le macchine valgono quattro verbi generici, implementati una volta sola: **ingannare** (calore, acqua, rumore), **spegnere** (la spina rossa: per un giorno intero), **riprogrammare** (ramo Chiave), **cavalcare**.

### 3.10 Le Guardie del Velo e la cattura

- Al massimo 6 guardie attive insieme. Stati: **pattuglia** (percorso fisso), **allerta** (si fermano e cercano per 20 s), **cattura**.
- Prima della svolta le guardie sono solo di rito: non inseguono.
- Essere presi non è una sconfitta: una dissolvenza porta alla cella dell'Eremo, con un prigioniero nella cella accanto, un passaggio segreto e la Madre che viene a parlare. Nella missione 10 farsi catturare è una delle vie.

### 3.11 Il giardino: indice, Nodi, Germogli, servizi

**Indice ecologico.** Vale 0,41 all'inizio. Scende soltanto quando avanzano i piani degli altri (mosse della Madre, Protocollo Rientro, smorzo degli Alpeggi) e sale con i Nodi riparati e con la Linea Piena. Sotto 0,30 Meridiana annuncia la Semina (Atto III). Non c'è un numero a schermo: si legge nel colore delle valli sopra la testa e lo dice Meridiana quando le si chiede.

**I dodici Nodi del Giardino** (quattro famiglie da tre; il primo di ogni famiglia insegna, il secondo varia, il terzo ha un colpo di scena). Un Nodo si vede solo dopo aver rilevato la sua particella: prima la malattia è nascosta dalla matita.

| Famiglia | Nodo | Dove | Che cosa cambia nel mondo |
|---|---|---|---|
| Impollinazione | 1. Il castagno del cartellino | Terrazza Pedrazzini, Corbella | i castagni di Corbella fioriscono quando tornano le api; una corrente calda sopra la terrazza |
| | 2. Il prato dei Bugni | Verbanetto | gli sciami passano dalla riva: si possono seguire a vela |
| | 3. Il prato fiorito del Pian dal Fen | Alpeggi | **colpo di scena**: sabotato dalla Confraternita per attirare Elvira fuori di notte |
| Acqua | 4. Il lavatoio e il riale curvo | Corbella | il riale torna a girare la ruota del mulino: la cartiera riapre |
| | 5. La sorgente della Corte Alta | Alpeggi | **colpo di scena**: qualcuno la cura già di nascosto (Gioann, dal Guscio) |
| | 6. La pompa 2 del Fondale | sott'acqua | **colpo di scena**: riaperta, toglie l'acqua al Nodo 4; si sceglie |
| Luce | 7. Lo specchio della serra | Isola Grande | una sacca d'aria calda sotto la serra; l'eliostato gira |
| | 8. Lo schermo delle Selve alte | Selve alte | l'ombra della Linea torna a muoversi: le Falciatrici cambiano orario |
| | 9. La torre di ricarica sommersa | sott'acqua | le api della riva tornano a volare (missione 2) |
| Macchina | 10. La Falciatrice del Collare | Selve alte | diventa una Falciatrice che si può cavalcare |
| | 11. La teleferica del fieno | Alpeggi | riparte (anche servizio della valle) |
| | 12. La bocca della Canva | sott'acqua | una persona torna: i pescatori riaprono il pontile della Canva, e Togn ci porta Elvira in barca a ogni bassa marea |

**Germogli**: la valuta delle pagine dell'Erbario, **28 in tutto**: 12 dai Nodi, 9 dai segreti, 7 dalle missioni principali (1, 2, 3, 4, 5, 9, 12).

**Servizi di Meridiana per valle rilevata** (tutte le particelle dell'inventario di valle, circa 120 per valle, a colore): a Corbella le campane tornano a segnare l'ora; nel Verbanetto le pompe schiariscono l'acqua e sott'acqua si vede più lontano; negli Alpeggi riparte la teleferica del fieno. Nella Fase 1 l'inventario di Corbella è limitato al nucleo (vedi FASE1.md).

### 3.12 La build: l'Erbario della Giardiniera

Le abilità sono pagine di un erbario. In ogni pagina Elvira preme un **fiore raccolto nel mondo**, che diventa conoscenza, attrezzo o modifica della tuta. Tre rami, ciascuno con **quattro coppie di pagine a fronte**: per ogni coppia si sceglie la pagina sinistra **o** la destra, mai entrambe. La quarta coppia è un **traguardo**, che si apre solo dopo aver scelto tre pagine dello stesso ramo.

- **Costi**: coppia 1 = 2 Germogli, coppia 2 = 3, coppia 3 = 3, traguardo = 4 (12 per un ramo intero). Con tutti i 28 Germogli si riempiono 8 o 9 coppie su 12: nessuno ha tutto.
- **Nessuna statistica**: ogni pagina aggiunge un'opzione. Ogni ramo ha un suo modo di rilevare (Radice di confine, Squadro d'asse, Penna di catasto), così la Pianta porta il segno della build.
- **Potatura** (rispecializzazione): due volte in tutto il gioco, nella serra dell'Isola Grande, si stacca una pagina e si recuperano i suoi Germogli meno uno.
- **Dotazione di base** per tutti: il Velo, lo squadro a cannocchiale, la lente dell'erbario, la barca, il respiratore da 45 s, la Caduta lenta, la Bombola di spinta e l'Interfaccia (la lettura dei registri di Meridiana ai terminali).
- **La pagina sigillata** del martagone si apre solo nel finale segreto.
- **Nessun level scaling**, nessun materiale di regione.

**Ramo Innesto — convincere il giardino.** Lento, silenzioso, lascia segni.

| Coppia | Pagina sinistra (fiore) | Pagina destra (fiore) |
|---|---|---|
| 1 | **Edera ponte** (edera): un seme lanciato su muro a secco, terra o ferro arrugginito fa crescere in 5 s un rampicante: via d'arrampicata o, fra due costoloni, ponte | **Muschio muto** (muschio): assorbe il rumore dei passi e spegne i sensori acustici delle macchine |
| 2 | **Lingua delle api** (fiore di tiglio): imitare il ronzio di calma per passare fra gli sciami e farsi portare piccoli oggetti, anche i lumi di mira | **Polline sonnifero** (papavero): spore che addormentano guardie e animali per un minuto |
| 3 | **Radici in ascolto** (radice di felce): toccando un albero si sentono condotte, vuoti del Guscio e il rumore di treno della Ruota | **Radice di confine** (amento di castagno): un castagno innestato da Elvira fa da caposaldo vivo; le particelle mobili raggiunte dalle radici (al massimo due) restano rilevate finché l'albero vive; due castagni attivi al massimo |
| 4 traguardo | **Castagno in venti secondi** (riccio aperto): un albero istantaneo su un'ancora: piattaforma, leva, radici che sfondano un muro o bloccano un volantino | **Anelli della memoria** (sezione di ramo): leggere negli anelli dei castagni secolari, in silhouette, le scene accadute ai loro piedi negli ultimi duecento anni |

**Ramo Fuso — padroneggiare la fisica del cilindro.** Veloce, verticale, rumoroso.

| Coppia | Pagina sinistra (fiore) | Pagina destra (fiore) |
|---|---|---|
| 1 | **Velo lungo** (soffione): planata più lunga e stabile (discesa ×0,7) | **Velo a vela** (seme alato d'acero): il Velo cattura le correnti calde e sale |
| 2 | **Passo a Sera** (genziana): la fisica piena della rotazione, salti lunghissimi correndo a Sera | **Suole d'ancora** (lichene del ferro): suole magnetiche su costoloni, travi, chiglie e sul soffitto di ferro del Guscio |
| 3 | **Squadro d'asse** (arnica): sopra 0,3 g lo squadro rileva in un colpo un ventaglio di quattro particelle sottostanti; mai in planata | **Corda dei campanari** (canapa in fiore): cavo da campanile per oscillare, agganciarsi e trascinare, anche sott'acqua |
| 4 traguardo | **Contrappeso** (giglio di San Giovanni): «pesanti» per qualche secondo: sfondare vetri sottili, tenere premute piastre, scendere a fondo senza zavorra, resistere alle correnti, tenere un volantino con il peso del corpo | **Salto d'asse** (celidonia, l'erba delle rondini): da 0,3 g balzare dritti fino al Fuso e ricadere in un'altra valle |

**Ramo Chiave — parlare con la macchina.** Preciso e potente, ma ogni comando consuma l'energia del giardino e lascia una firma nel Catasto.

| Coppia | Pagina sinistra (fiore) | Pagina destra (fiore) |
|---|---|---|
| 1 | **Orecchio di servizio** (campanula): sentire orari e compiti delle macchine come un ritmo, anche i picchi della Tenuta e le pompe | **La lampada di Uè** (bottone d'oro): il drone liberato come esploratore che si manda avanti a far luce, anche nelle condotte allagate |
| 2 | **Riprogrammare** (malva): cambiare il compito di una macchina o di uno sciame | **Spina rossa** (rosa canina): spegnere qualunque macchina per un giorno |
| 3 | **Penna di catasto** (giaggiolo, l'inchiostro dei copisti): scrivere un elemento di servizio del 2121 su un'ancora (§3.4.7) | **Codice delle campane** (campanellino): parlare dai campanili imitando il codice della Confraternita: diversivi, richiami, radunare la gente |
| 4 traguardo | **Priorità** (girasole): chiedere a Meridiana di spostare energia in un punto | **Ombra di Meridiana** (belladonna): nascosti ai sensori e al registro del Catasto; la Madre non vede le firme di Elvira |

**La personalizzazione visibile** è il Velo: porta una **tintura** e una **toppa** per volta, prese nelle valli. Cambiano come la gente reagisce a Elvira da lontano.

| Tintura | Dove | Reazione |
|---|---|---|
| mallo di noce | Corbella | i velati la salutano come una di loro |
| canapa dei Sordi | Alpeggi | i Sordi le parlano per primi; la Confraternita diffida |
| verde da corsa dei Messi | dopo la corsa del Messo | i bambini la seguono; i Messi le portano notizie |
| garza nera della Confraternita | il velo della Madre | accesso all'Eremo; Sordi e Smascherati si voltano |
| rame delle Bugnere | Bugni | gli sciami calmi la ignorano |
| martagone | solo nel finale segreto | |

### 3.13 Il costo nel mondo

I poteri forti si pagano nel mondo, non in una barra. Il costo colpisce l'abuso, non i verbi più divertenti.

- **Innesto**: la crescita rapida succhia la terra. Dove la si usa resta una chiazza morta per un giorno di gioco, visibile dalle altre valli. Chi ne abusa (più di tre chiazze in due giorni) trova Corbella che mormora «la Svegliata si mangia la terra» e le porte che si chiudono per un giorno.
- **Fuso**: solo Contrappeso e Salto d'asse fanno vibrare la struttura e i risonatori dei campanili, e solo dopo la svolta e nelle zone sorvegliate la Confraternita triangola la posizione di Elvira (le guardie vanno in allerta). Velo, Passo a Sera e Suole non sono mai puniti.
- **Chiave**: ogni comando a Meridiana consuma energia vera, e la Linea si affievolisce per un'ora di gioco sopra la zona. Ogni scrittura nel Catasto lascia la firma G5, che la Madre legge la sera stessa. La penna risponde alla penna, sempre con la stessa regola.

### 3.14 Le tre scelte di mondo

1. **I tre droni.** Se ne può liberare del tutto solo uno: **Uè** fa da bussola e da luce (la lampada punta sempre verso il Tappo Nord, cioè verso la Terra), **Dué** da braccio, **Lué** da occhi. Gli altri due continuano il Protocollo Rientro e si ritrovano: uno come problema, l'altro come il drone delle pompe di Togn.
2. **Il velo della Madre** (la garza nera, arriva il secondo giorno di gioco). Indossarlo dà accesso libero all'Eremo e ai riti e fa sì che le mosse della Madre non tocchino mai i capisaldi di Elvira (colpiscono le case degli Smascherati, i cui chiodi si rimettono nella missione 7), ma chiude il dialogo con i Sordi e gli Smascherati e fa avanzare la candidatura della Madre. Rifiutarlo fa il contrario. **Si può mettere e togliere fino alla missione 6; alla svolta la scelta si fissa** (decisione di questo documento: un velo ricevuto il secondo giorno non deve pesare per tutta la partita prima che il giocatore sappia che cosa significa).
3. **A chi dire la verità** prima del finale: Ottavio, Rosa, Fermo o nessuno. Chi sa cambia comportamento; Rosa e Fermo non possono saperlo senza che l'altro lo scopra; dirlo a Ottavio è l'unico modo per impedire che risponda alla lettera di S. nell'Atto III.

### 3.15 La parola: gente velata

- Le persone sono velate per cultura (veli di garza tinti con mallo di noce, maschere di castagno, cappucci, cappelli a tesa larga). Di un velato si leggono **postura, voce e velo**: il colore del velo dice il gruppo (noce = paese, nero = Confraternita, canapa grezza = Sordi senza velo sul volto, nessun velo = Smascherati), la postura dice l'umore (chi si volta, chi si avvicina, chi si inchina).
- La gente velata **parla per proverbi**, spesso in dialetto. Il Taccuino trascrive il proverbio e Elvira scrive accanto la traduzione e, quando lo capisce, la regola che c'è dietro.
- I dialoghi sono brevi. Nessuno spiega il mondo: ogni battuta dice quello che quella persona sa e vuole.
- Le risposte di Elvira sono poche (due o tre), ironiche e pratiche. Alcune risposte esistono solo se il Taccuino contiene un indizio.

---

## 4. Personaggi

### 4.1 La protagonista

**Elvira Pedrazzini**, 58 anni biologici, nata a Cevio nel 2063, botanica e agronoma. Ha progettato le Selve del Verbano con le marze della selva di famiglia e ha disegnato di sua mano lo strato della vegetazione della Carta Madre. È la Giardiniera n. 5 (codice G5), personale tecnico con un turno, un tesserino e la **Mezza Chiave**, che apre le porte di servizio maggiori solo in coppia con quella di un altro Giardiniere. È partita in anticipo: la figlia Marta (9 anni) e il marito Aurelio (il geometra del Catasto) dovevano seguirla nel 2141 con il Verbano II. All'imbarco Marta le diede un **giglio martagone** e scrisse sul vetro della Finestra delle Vedove «Tienimi la valle, mamma».

- **Carattere**: pratica, ironica, poco religiosa, testarda; parla con le piante a voce alta.
- **Come la vediamo**: le sue mani (guanti da giardino rattoppati, l'anello di fidanzamento), il bordo del Velo, lo squadro, il libretto, l'erbario, il Taccuino. Mai il volto.
- **Voce**: sintetizzata e filtrata dal respiratore che porta dopo l'ibernazione. Commenta poco e mai per spiegare: battute di tre-sei parole.
- **Il Taccuino a due mani**: la **tecnica** scrive in stampatello a matita dura, la **madre** in corsivo a matita morbida. Litigano sulla stessa pagina («Una stella non fa ombra. Non a otto anni luce.» / «Se la Sorella è il Verbano II, Marta è lassù.»).
- **Arco**: crede di aver perso Marta a otto anni luce; poi spera di ritrovarla sulla Sorella; poi si aggrappa all'ipotesi di un Verbano II in orbita lunare (fino alla serra, missione 9); infine scopre che Marta è vissuta e morta a 384.000 km e che per tutta la vita le ha risposto. Nel finale sceglie che cosa ereditare.

### 4.2 Personaggi principali

| Personaggio | Ruolo pubblico | Segreto (per chi scrive) | Come appare | Voce | Dove |
|---|---|---|---|---|---|
| **Meridiana** | l'intelligenza del cilindro; parla con Elvira come con una collega | vincolata dalla Clausola del Silenzio del 2122: non può rivelare, contattare la Terra né toccare la Lanterna e i suoi impianti (fra cui i martinetti delle ralle); può solo «confermare» ciò che Elvira dimostra. Riferisce alla Madre ogni richiesta di un Giardiniere. Da undici anni toglie 11 MW a luce, api e pompe per tenere l'asse sulla Terra; dal 2321 esegue il Protocollo Rientro. Non vede la porta della Lanterna | nessun corpo; quando dice «Confermo» la Linea sopra Elvira pulsa una volta | doppiata; filtro di campana; numeri impeccabili, nomi in dialetto pronunciati male | campane, radio di servizio, altoparlanti nelle grà |
| **La Madre (Ilde Bassi)** | guida della Confraternita della Linea; antagonista | è la Giardiniera n. 3, svegliata nel 2265; ha scelto di custodire la bugia, ha inscenato la propria morte (la Santa Giardiniera) e con il codice G3 corregge la Carta. Ha scritto le Lettere dalla Sorella, il falso dispaccio del 2131 e la lettera «di Marta». Cerca davvero una successora | maschera di castagno liscia, veste di garza nera; quasi sempre di spalle; le mani scoperte, vecchissime, con le cicatrici da innesto | doppiata; filtro di garza (voce vicina, attutita) | Eremo; in piazza nei riti |
| **Severino Lanfranchi, S., l'Om dal Fond** | per metà gioco solo «S.»: lettere a macchina, indovinelli tecnici, una voce alla radio | è il Giardiniere n. 4, svegliato nel 2291; da trentun anni regge a mano la terza ralla della Ruota Sorda, nelle tre manovre (alba, mezza luce, brace), per questo a quelle ore la sua radio tace. Ha svegliato Elvira per farle rompere il Silenzio e farla scendere al suo posto. Se lei rifiuta, il candidato è Ottavio | prima solo lettere e voce; nel Fondo, alla luce rossa del manometro: occhiali da saldatore, tuta rattoppata con tela di sacco, non si volta quasi mai | doppiato; filtro radio, voce roca | Fondo; nella Fase 1 solo la scritta sul vetro |
| **Ottavio, detto Ventin** | 17 anni, il Messo: porta lettere fra le valli planando con un Velo da corsa; la prima persona che si fida di Elvira; poi il suo canneggiatore | va di nascosto sulle Finestre e da tre anni annota con un goniometro dove passa la Meta; ha imparato seguendo le lettere di S. trovate nella borsa da Messo: è il candidato di riserva di Severino e non lo sa | ragazzo magro, velo da corsa verde legato alla fronte, Velo sempre aperto, lume a petrolio alla cintura | doppiato; filtro di vento; parla in fretta, voce rotta dell'età | Corbella (fienile), ovunque in volo |
| **Rosa Galli, la Bugnera** | apicoltrice delle api di rame ai Bugni | nasconde in una cisterna le api che cadono, spente; teme una punizione della Linea per un giuramento rotto della madre Pina; non sa che il padre Tobia ha tenuto la Ruota per ventun anni | velo da bugnera a rete fine color rame, guanti di cuoio, fumigatore acceso, tre api che le girano attorno | testo con mormorio; ronzio | Verbanetto |
| **Pina Galli, l'Ombrista** | 81 anni; ogni sera alla brace racconta la Partenza con figure di cartone controluce, ogni volta diversa | nel 2265 aiutò Ilde a sparire; nel 2270 il marito Tobia partì con la Salida; fu lei, per dolore, a chiedere di vietare il Sordo. Le varianti sono la sua confessione | mai il volto: di sera le mani enormi nell'ombra; di giorno una figura curva sotto un cappuccio di lana che ritaglia cartoni sulla soglia | testo con mormorio; dietro il telo, voce bassa | Corbella, Piazza delle Ore |
| **Fermo Ambrosini, il Casaro** | capo dei Sordi; registra le Voci su cilindri di cera | ha notato che una Voce si ripete ogni mattina con parole diverse e la stessa frase finale, che i Sordi pregano; dopo la svolta taglia le corde dei covoni perché il fieno salga ai morti | grande, senza velo, sempre di spalle o chino sul fonografo; cappello di feltro, pipa | testo con mormorio; canta sopra le registrazioni (la voce più calda) | Alpeggi, Corte Bassa |
| **Togn Pess** | pescatore di marea dell'Isola dei Conigli, apneista | il figlio Michel è annegato sei anni fa nel Locarno; porta pezzi di ricambio al drone delle pompe credendolo l'anima del figlio | sagoma magra che si tuffa senza schizzi; cappello di paglia sfrangiato | testo con mormorio; canta più che parlare | Verbanetto |
| **Uè, Dué e Lué** | tre droni di manutenzione a sei zampe, con lampada e pinza | conservano un vettore «verso casa»: Uè, libero, gira la lampada verso il Tappo Nord | insetti domestici d'ottone, zampe con IK, la lampada fa da sguardo | suoni d'ottone; non parlano | Guscio, poi con Elvira |
| **Lucia Ferrazzini, la Prima Sindaca** | morta nel 2161; presente nel suo archivio | inventò la Sorella per amore del suo popolo; lasciò dormire i Giardinieri; murando la Lanterna non sapeva di accecare le ralle; l'ultima lettera chiede perdono | voce su cera, calligrafia ordinata, diapositive con il volto grattato | doppiata; filtro di cera, erre lombarda | Archivio |
| **Aurelio Respini** | il marito di Elvira, morto a Cevio nel 2158 | ha murato una capsula per Elvira alla base del Pilastro 9; la nota sulla livella che trema | calligrafia minuta, numeri in colonna, disegnini di una bambina con una stadia | nessuna (solo testo) | il libretto, lo squadro |
| **Battista Rè** | il Giardiniere n. 1, «morto pazzo» nella Barca del Cielo nel 2190 | fu il primo Om dal Fond; chiamò i Sordi con la frase della Voce; risalì nel 2200 e riposa nel primo tumulo con la sua Mezza Chiave | il diario a matita, un disegno della Terra a carboncino, la tuta appesa nel Fondo | nessuna | Barca del Cielo, Fondo, Cimitero |
| **Giulia Pedrazzini** | 19 anni, di Cevio, discendente di Marta; legge dal vivo il bollettino dell'alba | non sa se lassù qualcuno ascolti | solo voce alla radio, con una cucina all'alba: un merlo, una caffettiera, una pagina | doppiata; filtro di cucina | la Terra |

### 4.3 Personaggi minori

| Personaggio | Chi è | Dove |
|---|---|---|
| **Nando** | Smascherato di Corbella: ogni mattina ricostruisce la casa che le Fade gli smontano | i Ronchi, Corbella |
| **Bortolo** | campanaro di San Vigilio, laico della Confraternita; rimette ogni mattina i gradini della scorciatoia | San Vigilio |
| **Togna** | lavandaia del lavatoio della piazza; i proverbi della notte | Piazza delle Ore |
| **Annunciata** | vecchia che aspetta le Lettere dalla Sorella della linea di sua sorella (secondaria 7) | Corbella |
| **Clelia** | novizia della Confraternita, porta i doni della Madre | Casa del Velo, Corbella |
| **I bambini di Corbella** (Lisa, Gioanin, il Pinin) | chiamano Elvira «la Svegliata»; copiano i disegni della Bianca | ovunque a Corbella |
| **Marco** | Guardia del Velo (secondarie 1 e 8) | Selve alte, Riva Alta |
| **Agostina** | nonna di Marco, casa sulla Riva Alta | Verbanetto |
| **Tecla e Gioann** | la vedova della Finestra e il marito vivo nel Guscio | Finestra delle Vedove |
| **Nina dei Sordi** | rivale di Ottavio nella corsa del Messo | Pradèll |
| **La Pesarina** | vecchia macchina infermiera del 2121 che misura i polmoni di Elvira e copia il suo Taccuino per S. | di notte, ovunque Elvira dorma |
| **I Giardinieri dormienti** | n. 6 Teo Cattori, n. 7 la dottoressa Irene Sala, con le loro buste «dalla Sorella» | Cripta |
| **I morti** | Agnese Moretti (n. 2, morta nel sonno nel 2238), Tobia Galli (Om dal Fond 2270-2291), Michel (figlio di Togn) | urna, Fondo, Locarno |

---

## 5. La trama

### 5.1 La verità nascosta (riassunto per chi scrive)

1. **2096-2120.** Il Consorzio Insubrico costruisce il Verbano in L5 come nave generazionale per Tau Ceti. Dentro il Tappo Nord gira al contrario la Ruota Sorda, agganciata al cilindro da tre ralle i cui martinetti sono asserviti al cercastelle della Lanterna. Aurelio rileva il Catasto (212 capisaldi, Caposaldo Zero sulla soglia della Lanterna). Elvira disegna le Selve.
2. **2121.** Salgono 2.300 coloni. Aurelio mura una capsula per Elvira sotto il Pilastro 9. Marta scrive sul vetro. Sette Giardinieri vengono ibernati.
3. **2122.** Il Motore Lungo si incrina al collaudo e brucia la prima ralla. Il Consorzio fallisce, il Verbano II è cancellato, i governi ordinano l'evacuazione. I coloni rifiutano. Lucia propone il **Silenzio** (71 %): antenne tagliate, Lanterna murata con il piombo (e ralle accecate senza saperlo), asse che insegue la Terra perché le Finestre non la mostrino mai, tre manovre al giorno. Il Sole diventa la Meta, la Luna la Sorella. Patto di Ginevra-Locarno con la Terra: nessun intervento se non richiesto, un canale radio sempre aperto. Il 29 % torna a casa; i Giardinieri restano a dormire di proposito.
4. **2129.** Marta, 17 anni, fa chiudere il bollettino dell'alba della Valle Maggia con la sua risposta al vetro: «A chi dorme lassù: il castagno di Cevio è ancora in fiore. Vi teniamo la valle.» Le antenne di servizio, ancora cablate ai risonatori dei campanili, la captano: sono le **Voci dei morti** dei Sordi.
5. **2190.** La seconda ralla si incrina: il Locarno si capovolge alla Festa del Lago, undici morti; per qualche ora la Terra compare in una Finestra. Si sveglia Battista Rè (n. 1), capisce che la terza ralla va tenuta a mano, scende nel Fondo e chiama i Sordi con la frase della Voce: nasce la **Salida**. 2200: il primo Sordo scende, Battista risale e muore agli Alpeggi; da allora, ogni dieci inverni, «vün al va giò, vün al vegn sü».
6. **2265.** Si sveglia Ilde Bassi (n. 3), trova l'Archivio, sceglie la bugia: inscena la propria morte, entra nella Confraternita con l'aiuto di Pina, corregge la Carta con il G3 (Sordo e Fondo «roccia piena», Caposaldo Zero e Lanterna cancellati, Archivio «cisterna dismessa»), scrive le Lettere dalla Sorella e le lettere nelle capsule, inventa la profezia della Svegliata. 2266: divelti i pilastri del Sordo. 2280: diventa la Madre.
7. **2270.** Tobia Galli parte con la Salida; Pina chiede di vietare il Sordo; la Madre accetta. La catena dei Tegnitt si spezza.
8. **2291.** Si sveglia Severino (n. 4): trova Tobia morente ai martinetti, promette di tenere la luce. Tre tentativi di tenuta automatica, tre volte «G4, Fondo, dispositivo: respinto». Rileva una striscia di Corbella per tenere aperta la botola della Cripta.
9. **Dal 2311** Meridiana toglie 11 MW al giardino per tenere l'asse sulla Terra. **2321**: Protocollo Rientro.
10. **2322.** Severino, 81 anni, forza la Cripta e sveglia Elvira. Lo stesso giorno la Madre vede arrivare la sua erede. **Il gioco comincia qui, con due candidature opposte sulla stessa donna.**

### 5.2 Struttura

| Parte | Domanda del giocatore | Missioni | Durata |
|---|---|---|---|
| Prologo e Atto I | «Dove siamo, e perché il giardino muore?» | 1 (tutorial), poi 2, 3, 4, 5 in qualunque ordine | 4-5 h |
| Svolta | «Che cosa abbiamo appena mostrato a tutti?» | 6 | 0,5 h |
| Atto II | «La Terra è viva, e chi scrive quello che leggiamo?» | 7, 8, 9, 10, 11, 12 | 5 h |
| Atto III | «Chi tiene la valle?» | 13, 14, finale | 2-3 h |

Regole di scrittura:

- La storia è un'indagine su una verità già accaduta: ogni ordine di scoperta è coerente, e i colpi di scena rileggono ciò che il giocatore ha già fatto.
- Ogni risposta pianta una domanda nuova che indica un luogo nuovo.
- Le scene che dipendono dall'ordine (Notte e Voci nell'Atto I) sono scritte in entrambe le versioni.
- Le agende degli altri avanzano da sole e si vedono, sempre dopo un annuncio: le mosse della Madre, il Protocollo, il Dondolio che peggiora quando Severino sale, la sparizione di Ottavio.

### 5.3 Calendario di trama

| Quando | Evento |
|---|---|
| Giorno 1, 05:40 | risveglio; la Linea si accende sopra Corbella mentre Elvira esce dalla botola |
| Giorno 1, 19:30 | prima Ombrista; la notte nel fienile |
| Giorno 2, mattina | il sentiero sparito; il dono dell'Eremo (il velo della Madre e il biglietto) |
| Giorno 3, mattina | il sentiero rilevato c'è ancora; la lettera di Rosa: fine della missione 1 |
| Dal giorno 4 | Atto I: piste 2-5 in qualunque ordine. Una lettera della Madre ogni tre giorni (l'offerta di scrivere alla Sorella: se Elvira scrive, la risposta arriva in tre giorni e parla di nuovo della stella alpina). Mosse A1-A4, al massimo due |
| Primi Giorni Ciechi | cominciano l'alba dopo che Ottavio ha invitato Elvira sulla Finestra (dopo la missione 1 e almeno un'altra pista); durano 3 giorni; la Meta non passa |
| Svolta | missione 6 disponibile quando tre piste su quattro sono chiuse. Il giorno della Linea Piena è festa |
| Svolta + 1 giorno | comincia il Dondolio (marea ogni 9 minuti reali, gravità ±5 %); secondi Giorni Ciechi: la Perla compare nelle tre Finestre ogni giorno dalle 12:40 alle 12:50; la sera mossa B1 (Tempo della Perla), la notte mossa B2 (Notte dei Termini) |
| Atto II | missioni 7-12; mosse B3-B5 |
| Atto III | missioni 13-14; mosse C1-C3; Meridiana annuncia la Semina quando l'indice scende sotto 0,30, oppure due giorni dopo la missione 12 |

### 5.4 I sei colpi di scena

1. **La Sorella è la Luna** (missione 4, circa ora 3). Elvira riconosce il Mare della Tranquillità: il Verbano non è mai partito. La speranza non muore, si sposta su un Verbano II in orbita lunare; il mistero diventa «chi ha scritto la lettera».
2. **Il giardino muore per nascondere la Terra** (missione 6). Le macchine «inselvatichite» stanno mettendo in salvo i semi. La vittoria della Linea Piena apre la crisi.
3. **Una sola mano scrive il mondo** (missioni 8-9). I Giardinieri furono lasciati dormire di proposito; la Terra è viva; il dispaccio, le Lettere dalla Sorella e la lettera di Marta sono sulla stessa carta e nella stessa calligrafia. Le benedizioni dei confini erano la stessa penna applicata al terreno.
4. **La Madre è la Santa Giardiniera, la n. 3** (missione 10). Velo, divieto del Sordo, profezia e benedizioni sono regole inventate da una tecnica; la profezia era un bando di successione.
5. **S. è l'Om dal Fond, e la candidata sei tu** (missioni 11-12). Le lettere di S. erano lezioni; si rileggono le sue assenze a orario e la Pesarina che sfogliava il Taccuino.
6. **La frase di Marta ha tenuto in piedi il mondo** (Atto III). La Voce che i Sordi pregano è la risposta di Marta al vetro: le lettere false venivano dalla Sorella, quella vera veniva da casa ogni mattina.

### 5.5 Le quattordici missioni principali

Ogni missione ha una via per ramo e una senza pagine, verificate dal controllo statico. Le **vie costruite a mano** (geometria e script dedicati per ogni via) esistono solo nelle sei **missioni-evento** (2, 5, 7, 8, 11, 14); nelle altre le abilità generiche agiscono sulla stessa geometria, più un'alternativa scritta.

Formato: zona e coordinate · tipo · prerequisiti · durata indicativa.

#### M1. Il castagno vuoto
Corbella e le Selve, (948-1190, 23-60) · diagnosi botanica e tutorial di rilievo · nessuno · 45-60 min.
Elvira esce dalla Cripta sotto un castagno morto, legge la lettera di Marta, impara la lente dell'erbario («fiori intatti, nessuno li ha impollinati»), fa il primo innesto sul castagno del cartellino («Marze: selva Pedrazzini, Cevio»), plana dai muri a secco, parla con i velati e con Ottavio, dorme nel fienile. La mattina il sentiero che hanno percorso non c'è più. Sul campanile riconosce il Pilastro 1 e la monografia scritta per lei; dalla Terrazza Pedrazzini fa il primo rilievo; poi rileva da sola la passerella del Messo, che la mattina dopo c'è ancora. Il Taccuino è aperto su una pagina che non aveva lasciato aperta.
- **Vie**: tutorial unico, senza pagine; la terrazza si raggiunge dal muro a secco o dalla mulattiera.
- **Svolta**: il mondo si ridisegna di notte, e lo squadro di Aurelio decide che cosa resta.
- **Domande nuove**: perché le api non impollinano? Chi ha scritto la lettera di Marta?
- **Ricompense**: 1 Germoglio; la prima legge scritta nel Taccuino; il Nodo 1 visibile.
- Sceneggiatura completa: `FASE1.md`.

#### M2. La cisterna di Rosa (missione-evento)
Il Verbanetto e il Fondale: Bugni (1500, 195, 27), Riva Alta (1500, 139), torre sommersa (1400, 146, 6) · autopsia meccanica, prima vela, prima apnea · M1 · 60 min.
Rosa mostra la cisterna con 300 api di rame: nessuna rotta, tutte scariche. Elvira segue a orecchio gli sciami vivi lungo la riva, a vela con la Tramontana del mattino e poi a nuoto, fino alla Riva Alta, dove le api cadono lungo una linea precisa: il limite del raggio di ricarica della torre sommersa. Togn le insegna la prima catena di sacche; si scende a 14 m fra le bocche delle pompe, con la lama della Meta ogni 51 s e, sotto, la sagoma nera del Locarno. Alla torre spenta: «Energia sospesa: priorità ASSETTO».
- **Vie**: Innesto, la Lingua delle api in mezzo allo sciame di guardia; Fuso, il Contrappeso senza zavorra e risalita in un fiato; Chiave, il registro del terminale di riva (la curva dell'energia scende da undici anni) e Uè avanti a far luce; senza pagine, la catena di sacche di Togn, più lunga.
- **Svolta**: le api non sono malate, muoiono di fame. **Domanda nuova**: chi ha deciso che l'Assetto conta più delle api?
- **Ricompense**: 1 Germoglio; Nodo 9 riparabile; tintura rame.

#### M3. Quarant'anni di Voci
Gli Alpeggi: Corte Bassa (560, 290), i tre campanili (Sambüch, Fontanèla, Pradèll), Cappella delle Voci (200, 300, 300) · ascolto e triangolazione di un suono · M1 · 50 min.
Fermo fa sentire i cilindri di cera; l'ultima frase è consumata e lui la recita: «A chi ca dorm lassù: ul castan da Cevi l'è ancamò in fiur. Va tegnum la val.» Per una registrazione pulita bisogna trovare da dove arriva la Voce: all'alba (05:50, prima del mattutino) Elvira sale fra le corti di peso e ascolta i tre risonatori, che suonano con ritardi diversi; triangolando i ritardi trova il cavo dell'antenna nella Cappella delle Voci, dentro il Collare, e lì registra la Voce intera: «Cevio, Bignasco, zero termico a 3.200 metri.» Elvira annota: «Marta mi disse tienimi la valle. Lo dicono tutti, in Valmaggia.»
- **Vie**: Innesto, i ritardi nelle radici; Fuso, salti lunghi fra le corti e lettura dall'alto; Chiave, il ritmo con l'Orecchio di servizio; senza pagine, contare i rintocchi con il cronometro della tuta.
- **Svolta**: la Voce è viva, ed è vicina. **Domanda nuova**: quanto vicina?
- **Ricompense**: 1 Germoglio; il fonografo prestato; la frase entra nel Taccuino in dialetto e in italiano.
- Il giorno del Verbano è ancora sull'ora di Locarno: per questo la Voce arriva all'alba.

#### M4. La Notte che non cambia
Finestra dei Ponti: Cancello dei Pellegrini (1500, 88,5), nicchie lungo la passerella, Ponte di Mezzo e Pilastro 12 (1500, 105) · traversata a tempo e misura astronomica · M1 e almeno un'altra pista; parte con i primi Giorni Ciechi · 60 min, a cavallo della brace.
Ottavio porta Elvira di nascosto sulla Finestra. Si passa da nicchia a nicchia nei 30 s d'ombra fra due passaggi dei Ragni. Alla brace (20:00-20:40, la manovra) Elvira pianta lo squadro sul Pilastro 12 e la bolla trema di 9 secondi d'arco per tutta la manovra; Aurelio aveva scritto: «Se un giorno trema, chiedi chi sta girando l'asse.» Al centro Ottavio mostra il goniometro e tre anni di misure: la Meta non cresce, torna ogni 29 giorni e mezzo con la fase della Sorella. Dalla sua borsa spunta un foglio a macchina firmato S. Elvira punta lo squadro sulla Sorella e riconosce il Mare della Tranquillità. Scena muta: si siede nella nicchia e respira, il giocatore resta quanto vuole. Poi la madre scrive sotto la tecnica: «Il Verbano II potrebbe essere in orbita attorno alla Luna.» La notte stessa Ottavio porta il primo lume di mira sulla Torre dei Bugni: primo triangolo attraverso il cielo (T1).
- **Vie**: Innesto, Edera ponte fra i costoloni; Fuso, Suole d'ancora sotto le travi; Chiave, un Ragno riprogrammato; senza pagine, seguire Ottavio.
- **Svolta**: non sono mai partiti. **Domanda nuova**: chi ha scritto la lettera, e da dove?
- **Ricompense**: 1 Germoglio; Ottavio canneggiatore (lumi di mira di notte); la teleferica dei pellegrini aperta.
- **Segreti collegati**: il bordo che gira al contrario; la luce cinerea (Finestra delle Vedove).

#### M5. La veglia delle Fade (missione-evento)
Corbella, casa di Nando (1188, 46); Bocca delle Fade (1520, 70); Galleria della Carta e terminale (1600, 70, −4) · veglia notturna e pedinamento · M1 · 60 min, di notte.
Elvira veglia nel prato accanto alla casa di Nando finché arrivano i lumi: il ballo in cerchio, le pietre sollevate e posate, il prato pettinato. All'alba segue le Fade lungo la Strada delle Fade, che si ripiega dietro di lei, fino alle stalle del Guscio. Al terminale legge il regolamento del 2121 (le due leggi), la tabella del giro delle Fade, e la sua Carta Madre corretta centinaia di volte con il codice G3, quello della Santa morta nel 2265, l'ultima sei giorni fa: il Sordo e la Lanterna «roccia piena», il Caposaldo Zero cancellato, le case benedette sono registrazioni, l'Archivio «cisterna dismessa». In fondo, tre righe: «G4, Fondo, dispositivo: respinto», e una riga del 2291 con la striscia della Cripta. Sulla stampante: «La Linea è più fioca del 18 %. Chiedi a Meridiana dove va. Poi vieni su. — S.»
- **Vie**: Innesto, le radici sotto il prato e il Muschio muto; Fuso, Suole d'ancora sul soffitto del Guscio; Chiave, gli orari delle stalle con l'Orecchio di servizio; senza pagine, l'orario dipinto all'ingresso, fra due turni.
- **Svolta**: una morta scrive la carta del mondo, e un vivo con una tuta come la sua ha provato a costruire qualcosa sotto il Tappo Nord. **Domanda nuova**: dove va la luce, e chi è S.?
- **Ricompense**: 1 Germoglio; «aspetta fino a: arrivo delle Fade»; la tabella del giro; triangolo T2.

#### M6. La Linea Piena (svolta)
Il Fuso: Mozzo Sud (z 0, h 630), Barca del Cielo (1150, h 608), Quadro della Linea (1500, h 598) · riparazione di sistema a gravità zero · tre piste fra M2-M5 · 45 min.
La voce di S. alla radio spiega l'Assetto come una correzione d'orbita («Meridiana ha margine per anni, le api no»). Dal Balcone dei Messi e dal Mozzo Sud (triangolo T3) si entra nel Fuso; si passa accanto alla Barca del Cielo (prima metà del diario di Battista, «Se nessuno mi crede, allora devo.»). Il Quadro è un puzzle diegetico su tre pannelli (manometri, leve, volantini): dirottare l'energia dall'Assetto alla Linea e alle Fabbriche degli Sciami senza far saltare le valvole, muovendosi fra un pannello e l'altro nelle ombre dello schermo girevole.
- **Vie**: Innesto, edera isolante sui cavi; Fuso, Velo a vela o Corda dei campanari sulle correnti calde; Chiave, la Priorità (Meridiana avverte una volta sola: «Giardiniera, l'Assetto non è un'orbita»); senza pagine, la sequenza di Battista scritta a matita sul primo pannello.
- **Svolta**: la Linea Piena, la festa; poi il Dondolio e la Perla nelle tre Finestre. **Domanda nuova**: che cosa abbiamo appena mostrato a tutti?
- **Cambia il mondo**: indice +0,08; api in volo; castagni in fiore fuori stagione; campane a festa; il giorno dopo marea, gravità ondulante, guardie ostili, Corbella divisa; Meridiana ora può confermare.

#### M7. Il Tempo della Perla (missione-evento)
Il Verbanetto (Riva Alta, Isola dei Conigli) e Corbella · soccorso durante un evento dinamico, poi rimisura sotto pressione · M6 · 70 min, su due giorni.
Il primo Dondolio solleva il lago: un'onda lenta ed enorme sulla Riva Alta e sull'Isola dei Conigli. Elvira salva i pescatori e le arnie di Rosa mentre la Confraternita proclama il Tempo della Perla e manda le guardie ad arrestarla davanti a tutti. Quella sera la Madre annuncia la Notte dei Termini; al mattino otto particelle sono tornate a matita, segnate in rosso con il motivo. Con le monografie di Aurelio Elvira ricostruisce dove stava ogni chiodo («a tre passi dal tasso») e lo rimette; poi la mano ricorda. Due chiodi sono sotto la guardia dell'Eremo e la marea torna ogni 9 minuti: bisogna scegliere l'ordine (case dei pescatori, via verso il Guscio, prato dei Bugni).
- **Vie**: Innesto, Castagno in venti secondi o Radici per le arnie, Radice di confine per una particella; Fuso, di tetto in tetto sulla cresta della marea e Squadro d'asse per i chiodi alti; Chiave, falso richiamo del Campanaro; senza pagine, Marco (se risparmiato) dice dove ha messo i chiodi, oppure si leggono le impronte del mulo.
- **Svolta**: la Madre combatte spostando la pietra, e la pietra si può rimettere. **Domanda nuova**: dove porta la galleria che la marea ha scoperto sotto il lago?

#### M8. La Processione dei Veli (missione-evento)
Piazza delle Ore (1046, 37) e Archivio dei Fondatori (sotto la piazza, h −4) · infiltrazione a vie multiple · M7 · 50 min, alla brace.
Dalla galleria scoperta si arriva sotto la piazza, ma l'Archivio è «cisterna dismessa» e ogni notte le Fade ne murano l'ingresso. L'unico momento è la Processione dei Veli: trenta velati, un coro, due guardie alla cripta. Dentro: rotoli di progetti, le lettere di Lucia, le diapositive con il volto grattato, il merletto a tombolo incorniciato, «Il fondo del sacco» di Plinio Martini, il dispaccio del 2131: «Ginevra tace.»
- **Vie**: Innesto, le radici di un castagno e il Muschio muto; Fuso, il pozzo di aerazione con il Contrappeso; Chiave, falso allarme dal campanile; senza pagine, mescolarsi alla processione con il velo nero e rilevare l'ingresso durante il canto dal chiodo 2 del sagrato, così che la notte le Fade non lo richiudano.
- **Svolta**: i Giardinieri furono lasciati dormire di proposito; Elvira poteva tornare da Marta. **Domanda nuova**: se la Terra è morta, che cos'è la Perla?
- Se Elvira ha scelto la casa di Nando nella secondaria 2, alcune lettere di Lucia sono illeggibili per la muffa.

#### M9. Lo spettro della Perla
Isola Grande, serra crollata (1760, 173) · esperimento scientifico e costruzione · M8 · 60 min; la Perla compare dalle 12:40 alle 12:50.
Elvira ricostruisce il banco ottico dei fondatori: il prisma (fondo della vasca delle ninfee), la carta sensibile al vicino infrarosso (laboratorio dei Bugni), la fenditura (una barca della Festa accanto al Locarno). Orienta l'eliostato sulla Perla nei minuti in cui compare: oltre il rosso, un gradino netto, il **red edge** della clorofilla. La Terra è verde, è viva. Meridiana pulsa: «Confermo, Giardiniera.» Poi in controluce: il dispaccio del 2131, la lettera di Marta e una Lettera dalla Sorella strappata dalla bacheca di San Vigilio. Stessa carta di castagno fabbricata dopo il 2200, stessa mano, la stessa «g» chiusa a ricciolo. Nel Taccuino la madre smette di scrivere per una pagina intera.
- **Vie**: Innesto, la carta portata dalle api e l'edera fino all'eliostato; Fuso, il Contrappeso per la fenditura e un salto all'eliostato; Chiave, l'eliostato orientato da Meridiana con la Priorità; senza pagine, la catena di sacche di Togn e l'eliostato a mano.
- **Svolta**: la Terra è viva, e qualcuno quassù ha scritto la morte del mondo e sua figlia. **Domanda nuova**: chi ha questa mano?
- **Ricompense**: 1 Germoglio; prima Potatura disponibile.

#### M10. La cella dell'Eremo
Il Sordo, Eremo della Linea (2785, 30, 320) · confronto con prove e fuga · M9 · 45 min.
Elvira raggiunge la Madre: catturata, consegnandosi o infiltrandosi dalla Scala Coperta. Davanti al reliquiario della Santa: un paio di guanti da giardino rattoppati, uguali ai suoi. Il confronto è un dialogo con prove (il red edge, le lettere di L., i tre fogli della stessa mano, la riga G3 del Catasto): ogni prova sposta la Madre. Alla terza si toglie la maschera di spalle: «Anch'io avevo la tua tuta. N. 3. Mi chiamo Ilde. La lettera di tua figlia l'ho scritta io, nel 2270, e quelle degli altri due. Non sapevo che fiore ti avesse dato.» Spiega perché e offre la maschera. Racconta di essersi scontrata nel 2291 con «l'altro» senza vederlo in faccia.
- **Vie**: Innesto, Edera ponte giù dalle cenge o Polline sulla guardia; Fuso, salto dalla finestra della cella sulle cenge a gravità ridotta; Chiave, serratura spenta o aperta con la Priorità; senza pagine, il passaggio segreto indicato dal prigioniero della cella accanto, oppure farsi riaccompagnare se la conversazione è andata bene.
- **Svolta**: la Santa è viva, e la profezia era un bando di successione. **Domanda nuova**: chi è l'altro Giardiniere sveglio?

#### M11. L'esodo dei Sordi (missione-evento)
Gli Alpeggi e la Finestra delle Vedove (passerella a z 1300, θ 330-360) · guida del branco con dilemma · M10 e mossa B3 (gelo) · 50 min, fino alla mezza luce.
La Madre ha smorzato la Linea sopra gli Alpeggi. Fermo scende a Corbella con otto famiglie e quindici vacche; la teleferica è ferma e la via più corta passa sulla Finestra delle Vedove, nella nebbia fredda del Dondolio, sopra le firme del 2121. Elvira guida la vacca capobranco con il campanaccio; la carovana (12 figure, 15 vacche) segue su un percorso fisso. A metà, a mezza luce, una passerella cede. Un uomo vecchio in tuta rattoppata sale da un portello di servizio e tiene la fune con le mani che tremano: è S. Confessa che l'ha svegliata lui e l'ha mandata alla Linea Piena sapendo che cosa avrebbe mostrato. Il Dondolio peggiora a vista d'occhio e lui guarda il Sordo con paura: è l'ora della manovra e laggiù non c'è nessuno. Il dilemma: il fieno dei Sordi o le ultime tre vacche, perché la passerella regge un solo carico. Il triangolo T4 rileva la passerella delle Vedove per il ritorno.
- **Vie**: Innesto, Edera ponte accanto alla passerella e la Lingua delle api sulla mandria; Fuso, Contrappeso sulla passerella o il fieno in volo con il Velo a vela; Chiave, un Ragno riprogrammato come ponte durante il passaggio della Meta; senza pagine, l'orario dei costoloni dipinto sulle nicchie, a coppie, con l'aiuto di S.
- **Svolta**: l'alleato l'ha usata. **Domanda nuova**: perché il mondo trema di più quando lui è qui?

#### M12. Il Fondo
Fondale (ingresso sommerso della Canva, (2470, 172, 3)), Galleria verso il Tappo Nord, Fondo e terza ralla (2700, 270, −4) · discesa a ritmo di marea e prima Tenuta · M11 · 60 min, fino alla brace.
Elvira segue Severino, lento e senza fiato, giù per l'ingresso scoperto dalla bassa marea e lungo le gallerie, fra un'onda e l'altra: per una volta è lei a portare la lampada. In fondo, il corridoio ad anello, la Ruota che passa con un rumore di treno, le tre ralle. Sta per cominciare la manovra della brace e Severino non ce la fa: le chiede di tenere. La **prima Tenuta**: quattro minuti con l'ago del manometro nella fascia verde mentre il carico gira; la Ruota cambia tono prima di ogni picco; il ritmo è quello della Meta. Poi il registro: «Tenuta la luce» ogni giorno da centotrentadue anni, in dieci calligrafie, la prima di Battista Rè; la tomba «Tobia Galli, 2291»; la tuta di Battista con la tasca della chiave vuota. Severino, senza voltarsi: «Ti ho svegliata perché tu scenda al mio posto.»
- **Vie**: Fuso, il Contrappeso su un volantino; Chiave, l'Orecchio di servizio sente il carico arrivare; Innesto, le Radici in ascolto nelle radici che hanno sfondato il soffitto e il Castagno in venti secondi come fermo; senza pagine, Severino tiene un volantino ed Elvira l'altro.
- **Fallire è contenuto**: il Dondolio peggiora per un giorno e Severino riprende i volantini.
- **Svolta**: la leggenda è vera e le candidature sono due. **Domanda nuova**: c'è un modo perché nessuno debba stare qui sotto?
- **Ricompense**: 1 Germoglio; il registro (nomi dei Tegnitt, per la secondaria 11).

#### M13. Le due Mezze Chiavi
Corbella, l'Eremo, gli Alpeggi, il Fondo · negoziazione, furto o richiamo · M12 · 40-70 min secondo la via.
Solo il cercastelle della Lanterna può guidare le ralle senza mani, e la Lanterna si apre con due Mezze Chiavi. Se Elvira non ha detto la verità a Ottavio, la sera l'Ombrista mette il Messo nella leggenda («e il Messo scese a cercare l'uomo sotto la ruota») e la mattina dopo il ragazzo non c'è più. Cinque vie per la seconda chiave, ognuna cambia il finale:
1. **convincere Ilde** con l'ultima lettera di Lucia (cassetto dell'Archivio: segreto del merletto o Anelli della memoria) e dicendole del Fondo;
2. **rubarla** a Ilde durante il rito del Tempo della Perla, quando la posa sull'altare (Polline sul coro, Corda dei campanari dal rosone, Spina rossa sulle lampade);
3. **farsela dare da Severino**, che la cede solo se qualcuno prende i volantini: Elvira, Fermo che si offre come ultimo Sordo, o Ottavio se è già laggiù;
4. **farla «ricordare» a Meridiana**, dimostrandole con il registro dei martinetti che la Clausola non può vietare di riparare un guasto;
5. **aprire con Fermo il primo tumulo** del Cimitero dei Forestieri, se insieme hanno restituito i nomi ai morti.

Chiunque gliela dia, le consegna anche un cilindro di cera del 2129: «Mi chiamo Marta Pedrazzini, ho diciassette anni, da domani il bollettino finirà con una frase mia.»
- **Svolta**: Marta le ha risposto ogni mattina per cinquantotto anni. **Domanda nuova**: si arriva alla Lanterna prima che il giro delle Fade si riprenda la via?

#### M14. Il Sordo (missione-evento)
La parete del Sordo (z 2640-2968), l'Eremo, la Lanterna · scalata in due giorni e sintesi di tutte le regole · M13 · 90 min.
Elvira sale la parete mentre la gravità scende da 1 a 0. Sa dalla Galleria della Carta che lassù non c'è un caposaldo e che il giro delle Fade arriva sulla parete a metà notte (01:00): il piano è suo. Il primo giorno sale fino a una cengia; alla brace, prima dei lumi, rileva la via con stazioni libere sui lumi di Ottavio (o delle api di Rosa, dei fuochi dei Sordi, della lampada di Uè) sui pilastri delle altre valli (triangolo T5). La notte veglia o dorme in parete; il secondo giorno riparte da ciò che è rimasto a inchiostro. A metà attraversa l'Eremo (che cosa accade dipende dalla cella e da Marco). In cima, quando il Dondolio porta la Lanterna in linea, rileva la cengia della porta e rimette sulla Carta il **Caposaldo Zero**: il Triangolo Zero (T6), il primo che Aurelio aveva chiuso. «Ora la vedo, Giardiniera.» Poi le due Mezze Chiavi nei 30 s d'ombra della Meta. Dietro il piombo c'è la Terra ferma, un disco quattro volte la Sorella; nell'oculare, le Alpi, il Lago Maggiore, le luci del lato notturno.
- **Vie**: Innesto, Edera ponte e Radice di confine; Fuso, Squadro d'asse e Salto d'asse; Chiave, una scala alla marinara scritta con la Penna e rimisurata all'alba; senza pagine, la vecchia scala dei pellegrini, ritrovata con la meridiana della Piazza e il libretto, chiodo dopo chiodo.
- **Scelta finale**: aprire il cercastelle, murare la Lanterna con Ilde e scendere, o chiamare la Terra (§7).

### 5.6 Triangoli di trama ed elementi di trama

Per finire il gioco bastano i 14 elementi mobili di trama (appendice B) e i **sei triangoli attraverso il cielo**:

| Triangolo | Missione | Vertici | Che cosa rileva |
|---|---|---|---|
| T1 del Ponte | M4 | Pilastri 1, 12, 14 | il Ponte di Mezzo e la stazione della teleferica dei pellegrini |
| T2 della Galleria | M5 | Pilastri 44, 15, 28 | la Bocca delle Fade: la via per la Galleria della Carta resta aperta |
| T3 del Mozzo | M6 | Pilastri 42, 19, 21 | la scala del Mozzo Sud sul lobo del Tappo |
| T4 delle Vedove | M11 | Pilastri 35, 26, 6 | la passerella delle Vedove per il ritorno della carovana |
| T5 della parete | M14, prima sera | stazioni libere sul Sordo su Pilastri 31, 14, 1 | la via fatta il primo giorno |
| T6 Zero | M14, seconda notte | Caposaldo Zero su Pilastri 1, 15, 23 | la cengia della porta della Lanterna; il Sordo diventa colore |

### 5.7 Le dodici missioni secondarie

Ognuna ha quattro tempi: introduzione, sviluppo, svolta, risoluzione con conseguenze.

| # | Missione | Atto e zona | Introduzione e sviluppo | Svolta | Risoluzioni e conseguenze |
|---|---|---|---|---|---|
| S1 | **I termini spostati** | I, Selve alte (Pilastro 4) | una particella rilevata torna a matita: il Pilastro 4 è stato spostato di 3 m di notte (mossa A1); i vecchi accusano i Sordi; Elvira rimisura, legge il giro delle Fade e si apposta fra le Falciatrici: una sagoma con una lanterna e un mulo che trascina il bronzo | è Marco, una Guardia: «La Madre vuole sapere se la carta si può spostare» | lasciarlo andare (nell'Atto II diserta più facilmente); denunciarlo in Piazza (la Confraternita perde la faccia, Marco non diserterà); insegnargli lo squadro (smette, e nella M7 dice dove sono i chiodi) |
| S2 | **La casa che non c'è** | I, Corbella (i Ronchi) | Nando chiede alla Svegliata di «benedire» la casa; Elvira la rileva; la mattina la casa c'è | la casa poggia sulla particella del pozzo d'aria dell'Archivio: le Fade la smontavano per tenere libero il condotto | scrivere con la Penna un condotto attraverso la casa (ancora); ricostruirla una particella più in là e rilevarla; scegliere la casa (lettere di Lucia rovinate) o le carte |
| S3 | **La Pesarina** | I-II, Corbella e Guscio | Elvira si sveglia con il Taccuino spostato e un peso sul petto; trappola di farina e campanello; impronte di sei zampe e una ruota | è una macchina infermiera del 2121 che le misura i polmoni e copia il Taccuino per un terminale G4; il cavo porta al Tappo Nord | lasciarla fare; riprogrammarla perché porti messaggi (la confessione di S. nella M11 è più breve e più vera); spegnerla (S. scrive alla cieca e il respiratore regge 10 s in meno) |
| S4 | **La corsa del Messo** | I, da San Vigilio alla croce d'alpe attraverso il cielo | ogni anno i Messi corrono attraverso il cielo; il vincitore «tocca la Linea»; Elvira allena Ottavio; la rivale Nina vola su un nastro di fumo che si può imparare | i vincitori diventano gli Osservanti, novizi che misurano la Meta per il calendario dei Giorni Ciechi, giurando di non dire ciò che vedono | farlo perdere; farlo vincere e rifiutare in pubblico; lasciarlo entrare (niente lumi di mira da lui, ma nell'Atto III apre una porta dell'Eremo e nessuna lettera di S. lo raggiunge) |
| S5 | **Il vitello del Collare** | I-II, Alpeggi e Fuso | un vitello saltando a 0,4 g è «caduto in su» nel Collare; Elvira ne segue i muggiti e lo trova nel Fuso, fra gli orti sospesi | a gravità zero le sue zampe non si sono sviluppate: riportarlo giù di colpo lo ucciderebbe | pascolo sospeso con le istruzioni radio di S. e discesa per gradi, una corte di peso al giorno (le istruzioni arrivano sempre, tranne all'alba, a mezza luce e alla brace); oppure lasciarlo lassù: «la vacca della Linea», segnale di cielo per tutto il mondo |
| S6 | **La vedova della Finestra** | I-II, Finestra delle Vedove e Guscio | ogni notte Tecla cammina sul vetro con una lanterna cercando il marito caduto nella Notte; tracce non sue: graffi su un portello, una borraccia, un orario a gesso | Gioann non è caduto: è scivolato nel Guscio, ha visto lo scafo e le stelle e non è più riuscito a credere; ripara droni e si vergogna | portarlo da Tecla; portare Tecla da lui; consegnare la sua lettera (l'unica lettera vera da un vivo a un vivo). Gioann conosce la sacca per il Pilastro 9 |
| S7 | **Le Lettere dalla Sorella** | II, Corbella, cartiera, Eremo | Annunciata aspetta la lettera della linea di sua sorella; questa volta non è stata letta; Elvira segue la carta: cartiera, filigrana del castagno, ordine dell'Eremo, cestino della Madre | una bozza interrotta: la Madre doveva annunciare la morte di una parente immaginaria e per la prima volta in trent'anni non ce l'ha fatta | scriverla lei (un passo verso la maschera); dire la verità ad Annunciata; lasciare la bozza con accanto un martagone pressato (nella M10 la Madre sa già chi è entrato) |
| S8 | **La casa della Riva Alta** | II, Verbanetto | la casa di nonna Agostina si allaga a ogni marea e lei non se ne va; Elvira salva le sue cose fra un'onda e l'altra, anche in apnea; Agostina sale in soffitta con la polenta | in soffitta c'è Marco, che ha disertato dopo aver visto la Perla | nasconderlo nel Guscio; portarlo dagli Smascherati sulla Strada delle Fade; convincerlo a tornare all'Eremo come informatore (nella M10 Elvira sa quando la Madre è sola, nella M14 Marco apre una porta) |
| S9 | **Il pescatore di marea** | II, Fondale e Guscio | Togn entra a ogni bassa marea negli ingressi delle pompe ed esce con «pesci d'argento»; Elvira lo segue sott'acqua lungo la sua catena di sacche, accanto al salone del Locarno | non ci sono pesci: porta pezzi di ricambio al drone delle pompe, che crede l'anima di Michel | riprogrammare il drone (Togn perde il figlio due volte); lasciarlo (le pompe restano accese, il lago si schiarisce); dire la verità e lasciar scegliere lui. Con il giornale di bordo del 2190 recuperato nel salone, alla processione delle Barche dei Lumi i pescatori calano undici lumi più uno per Michel |
| S10 | **La Bianca** | II, Selve | uno sciame di Fade esce dal giro e traccia solchi «a casaccio» nei prati a matita; la Confraternita vuole che Elvira rilevi la particella per fermarlo | visti dall'altra valle con lo squadro, i solchi formano un disegno di 400 m: un cerchio piccolo e uno grande nella proporzione della Sorella e della Perla e una freccia verso il Sordo. È Meridiana che parla a tutti senza rivelare; tre stadi, una notte ciascuno, solo se la particella resta a matita | lasciarla a matita e proteggere lo sciame (il disegno si completa, i bambini lo copiano, Meridiana lo ricorda nel finale); rilevarla (il prato si salva, il disegno resta a metà); lasciar fare alle guardie |
| S11 | **Il Cimitero dei Forestieri** | I-III, Alpeggi | otto tumuli senza nome sotto la croce d'alpe; Elvira confronta le date (a dieci anni l'una dall'altra) con le partenze delle Salide; dopo la svolta qualcuno taglia le corde dei covoni nei cali di gravità: è Fermo, che manda il fieno ai morti | i forestieri erano i Sordi della Salida, tornati dopo dieci anni al buio; il primo tumulo (2200) ha un compasso «B. R.». La pista resta aperta finché Elvira non ha letto il registro del Fondo | incidere i nomi con Fermo (i Sordi scelgono da soli se tenere la Ruota; Fermo aprirà il primo tumulo); dire a Fermo la verità sulle Voci (smette di mandare il fieno); lasciare i tumuli senza nome |
| S12 | **La Partenza, sette volte** | tutto il gioco, Piazza delle Ore e Torre dei Bugni | Rosa chiede di far smettere l'Ombrista; il Taccuino trascrive le varianti, che nominano luoghi («la Santa lasciò i guanti dove le api dormono»): in un'arnia spenta c'è una tuta con il tesserino «n. 3 - Ilde Bassi». Dopo la svolta Pina chiede a Elvira di descriverle Cevio per un cartone nuovo | le varianti sono la confessione di Pina. L'ultima, se Elvira le porta il nome di Tobia, è la Salida com'era davvero; poi Pina dice di aver chiesto lei il divieto del Sordo | dirle la verità o una pietà; dirlo a Rosa o no. Nel finale della Lanterna Pina racconta la stessa storia due sere di fila, con il cartone di Cevio |

### 5.8 L'Ombrista

Ogni sera alla brace (19:45-20:30) Pina racconta la Partenza in Piazza delle Ore. È un piano con figure di cartone 2D animate a mano davanti a un telo illuminato. Al massimo **24 varianti** in tutto il gioco, scelte da 3-4 flag per sera, più 3 varianti per l'epilogo. Una variante:

- trascrive nel Taccuino la sua frase chiave;
- annuncia la mossa della Madre della notte (§3.4.5), se c'è;
- può nominare un luogo, che diventa una pista;
- cambia secondo ciò che Elvira ha scoperto o fatto (la figura presa dalla scatola, il velo indossato, la Notte chiusa prima delle Voci o viceversa).

Le figure di cartone di base: i Padri, il Mondo Bruciato, la Nave, la Sorella, la Santa che sale nella Linea, la Svegliata. La figura dell'uomo con la ruota sulle spalle resta nella scatola finché qualcuno non la tocca.

---

## 6. Segreti ed easter egg

### 6.1 I dodici segreti

Quattro livelli: (1) visto ma irraggiungibile; (2) nascosto in piena vista; (3) sistemico, si trova usando le regole in modo creativo; (4) cifrato, da carta e matita. Il gioco dice che un segreto esiste, mai come prenderlo. Nessun segreto è necessario per finire il gioco. Nove segreti danno Germogli (9 in tutto).

| Liv. | Segreto | Dove | Come si trova | Ricompensa |
|---|---|---|---|---|
| 1 | **La Lanterna** | sull'asse a Lag, (2968, asse, 642) | si vede da ogni punto: un disco grigio piombo con una corona di bulloni, l'unica cosa del cielo che nessuno dipinge e nessuno nomina; appuntato con lo squadro resta in bianco sulla Pianta | la domanda nel Taccuino (raggiungibile solo nella M14) |
| 1 | **La Barca del Cielo** | Fuso, (1150, h 608) | puntino scuro contro la Linea da ogni valle; si raggiunge nella M6 o prima con Salto d'asse o Velo a vela | 1 Germoglio se raggiunta prima della M6; la prima metà del diario di Battista |
| 1 | **Il bordo che gira al contrario** | dal margine della Finestra dei Ponti verso Lag, nei primi Giorni Ciechi | fuori dal vetro, attorno alla faccia esterna del Tappo Nord, un anello di roccia scorre contro le stelle nel verso sbagliato: la Ruota Sorda, mostrata nell'Atto I e spiegata nell'Atto II | una nota della tecnica nel Taccuino |
| 2 | **Le buste delle capsule** | Cripta, capsule 6 e 7 | dal primo minuto: «Per Teo, da Ines, dalla Sorella» e «Per la dottoressa Sala, da suo figlio, dalla Sorella». Guardate con la lente, la «g» chiusa a ricciolo e la carta sono identiche a quelle della lettera di Marta | 1 Germoglio; un indizio che anticipa di ore la scoperta di Elvira |
| 2 | **La meridiana della Piazza** | Piazza delle Ore, vista con lo squadro dalla valle di fronte | da terra il selciato è decorazione; dall'alto le linee delle ore convergono sul Sordo e una sola linea, più scura, indica il punto della parete dove passava la scala dei pellegrini | 1 Germoglio; la via senza pagine della M14 |
| 2 | **La figura che non esce mai** | sulla soglia di Pina, di giorno | nella scatola dei cartoni c'è un uomo curvo con una ruota sulle spalle, che non compare mai in piazza; se Elvira lo prende in mano, Pina lo riprende senza una parola e da quella sera la leggenda nomina «quello di sotto» | una variante dell'Ombrista |
| 3 | **Le firme nel vetro** | Finestra delle Vedove, faccia esterna | cavalcando un Ragno o restando sul costolone con le Suole d'ancora durante il passaggio della Meta, la luce radente mostra per 1,5 s le 2.300 firme; fra le altre «Tienimi la valle, mamma. Marta» e, poco sotto, «A. R., geometra» | 1 Germoglio; una battuta diversa di Elvira nell'ultima scena di ogni finale |
| 3 | **La capsula del Pilastro 9** | (2300, 170, 2), sotto il limo, accanto alla bocca di scarico | nessuna via segnata: Priorità sullo scarico, Contrappeso nella corrente, lanterna portata dalle api fino all'ultima sacca, oppure la sacca di Gioann e la bassa marea | 1 Germoglio; il biglietto di Aurelio e un disegno di Marta; chiudere il Triangolo del Lago (9-15-17) mette a inchiostro tutto il Fondale |
| 3 | **La luce cinerea** | Finestra delle Vedove, nei Giorni Ciechi | spegnere ogni lume, sedersi e aspettare che gli occhi si abituino: la parte scura della Sorella è grigio-azzurra; confrontandola con il quaderno di Ottavio Elvira scrive «C'è qualcosa di grande e luminoso dietro il Tappo Nord» | 1 Germoglio; una battuta in più nella M6 |
| 3 | **L'orto di Battista** | particella 4-614, cengia del Sordo (2880, 140, 470) | al terminale, fra centinaia di righe G3, una riga G1 del 2199: «particella 4-614, orto, conservare». Ci si arriva combinando gravità ridotta, Coriolis e passerelle notturne | 2 Germogli; una lettera di Battista «a chi verrà dopo»; nella M14 un rifugio che le Fade non toccano |
| 4 | **Il merletto di Sant'Arianna** | Archivio dei Fondatori | il merletto a tombolo «Sant'Arianna, inverno 1965, dal tombolo di Ada; portato quassù da Lucia F.»: i pieni e i vuoti, letti come il codice delle campane, danno il numero di un cassetto e la frase «Ciò che si tesse di notte si sveglia di giorno» | 1 Germoglio; l'ultima lettera di Lucia (via della parola nella M13) |
| 4 | **Il cilindro di Giulia** | i 52 cilindri di Fermo | convertendo il calendario dei Sordi (inverni dall'ultima Salida, mesi dalle fasi della Sorella) in date terrestri, i cilindri dell'alba mostrano piccole differenze; uno di quattro anni fa dice: «da oggi legge la Giulia, che ha quindici anni, perché la mamma non c'è più» | requisito del finale segreto |

### 6.2 Easter egg

Fuori dalla trama, mai commentati da nessuno.

1. **TRAMA. Il merletto dei giorni**: il merletto di Sant'Arianna; Lucia firma «L.» «per un'abitudine di famiglia» (un'antenata riceveva lettere così da un'isola della laguna); la frase del merletto è la regola di TRAMA e qui descrive le Fade.
2. **Colapesce**: nel Fondo, accanto alla branda, una cartolina del 2120 «Saluti da Messina», con lo Stretto.
3. **Monti Sibillini**: nel libretto di Aurelio una monografia del 2084, da studente, di un caposaldo sul Monte Vettore: «Nebbia. Il sentiero di ieri oggi non c'era. Rimisurare.» È l'unica pagina che non riguarda il Verbano, e si legge già nella Fase 1.
4. **Silent Running** (1972): Uè, Dué e Lué per Huey, Dewey e Louie; «Uè» è anche l'esclamazione con cui Elvira li chiama.
5. **Plinio Martini**: nell'Archivio, «Il fondo del sacco» con una nota di Lucia: «Anche noi siamo partiti con il fondo del sacco.»
6. **Italo Calvino**, «La distanza della Luna»: nel Fuso una scala a pioli di bambù piantata in una nube del Collare e puntata verso la Sorella; nel Fondo il gatto nero di Severino si chiama Qfwfq.
7. **Gene Wolfe**: nei testi più antichi della Confraternita la Linea è «il Sole Lungo».
8. **Carnevale ticinese**: il giorno del Rabadan la Confraternita si toglie le maschere e le indossa la gente comune; fra le maschere un naso rosso da clown, per Dimitri, il clown di Verscio.
9. **Outer Wilds e Zelda**: nel nido d'officina un marshmallow bruciacchiato su un ferro; su un muro del Guscio, a gesso, un tecnico del 2121 ha scritto: «Qui non ci sono torri da scalare. Arrangiati con la carta.»

---

## 7. I finali

Il giocatore sceglie il finale nella Lanterna (M14), davanti alla Terra. È anche una scelta fra due eredità: la Madre la vuole sopra, a tenere la bugia; Severino la vuole sotto, a tenere la Ruota.

| Finale | Eredità | Che cosa succede |
|---|---|---|
| **La Lanterna** | nessuna delle due: la verità, si resta | Elvira apre la Lanterna con le due Mezze Chiavi. Il cercastelle torna a vedere, la terza ralla si guida da sola, nel Fondo i volantini girano senza mani: Severino sale e guarda la Linea per la prima volta in trentun anni. Meridiana, libera dal Silenzio, ruota il cilindro e per un minuto la Terra passa in tutte e tre le Finestre: 1.900 persone la vedono insieme. La Semina è annullata, i Ragni si fermano. Elvira trasmette sul canale del Patto; dopo un'ora una voce giovane: «Vi sentiamo. Vi teniamo la valle.» Epilogo a tableaux nelle tre valli |
| **Il Velo** | tutte e due: la bugia custodita, si scende | Elvira mura la Lanterna con Ilde, prende la maschera e ristabilisce il Silenzio. Se la build lo permette oscura per sempre la Finestra Cieca, altrimenti lascia smorzare gli Alpeggi. Poi scende nel Fondo e prende i volantini; Severino risale a morire nella luce degli Alpeggi, sepolto come forestiero. Ottavio resta in superficie. La Tenuta del finale è una sola scena rituale. L'ultima sera l'Ombrista aggiunge una figura, una donna con un velo e un paio di guanti; il gioco si chiude sul registro: «Tenuta la luce», nella calligrafia di Elvira, con il martagone pressato fra le pagine |
| **Il Ritorno** | la verità, si parte | Elvira trasmette la sola parola che il Patto aspetta da duecento anni: «Richiediamo». Meridiana sgancia verso la Terra le capsule della Semina con le marze di Cevio; nei mesi seguenti, raccontati con una sequenza di albe, arrivano le navette. Molti scendono, i Sordi restano, Fermo guida l'ultima Salida perché qualcuno tenga la Ruota finché il cilindro non sarà vuoto. Ultima scena a Cevio, in prima persona: un castagno enorme con un cartellino di zinco nuovo, due mani giovani che porgono una tazza, la voce della radio a mezzo metro: «Bentornata. Te l'abbiamo tenuta.» |
| **La Valle Tenuta** (segreto) | estende la Lanterna | Requisiti: il cilindro di Giulia trovato (o fatto trovare a Fermo), i nomi incisi sui tumuli, la Lanterna aperta con qualunque chiave. Dipende dall'ora: nel telescopio Elvira guarda l'alba avanzare sulle Alpi e aspetta seduta che la luce tocchi le cime sopra la Valle Maggia, poi si sintonizza sul canale del Patto. Il bollettino è dal vivo: un respiro, un merlo, una pagina. Elvira recita la frase dei Sordi in italiano e in dialetto. Il ritardo andata e ritorno è di 2,6 s; il silenzio dura nove. «Chi parla?» «Elvira Pedrazzini, di Cevio. Giardiniera numero cinque.» Giulia racconta in fretta di Marta e di Aurelio. «Aspetti. Guardi giù.» Da Cevio a Bignasco le luci dei paesi si spengono e si riaccendono tre volte; agli Alpeggi i Sordi rispondono con tutte le campane; Meridiana ripassa a china l'ultima linea del Sordo; nel Fondo i volantini girano da soli e qualcuno scrive, nella calligrafia di Severino: «Tenuta.» Si apre la pagina sigillata dell'erbario e il martagone diventa l'ultima tintura del Velo. Nessun volto: luci, campane e una voce |

**Variazioni comuni a tutti i finali**: lo stato degli Alpeggi (salvati, evacuati, smorzati); chi tiene la Ruota (nessuno, Elvira, Ottavio se è sceso, Fermo); quale drone è libero; il colore del lago (secondo la storia di Togn); quante particelle sono a inchiostro e quante valli sono verdi nell'ultima inquadratura dal Fuso; la battuta finale di Elvira se ha trovato le firme nel vetro.

---

## 8. Interfaccia

Principio: **nessuna icona**, nessun segnalino, nessuna bussola a schermo. Tutto ciò che il giocatore deve sapere sta nelle mani di Elvira o nel mondo.

### 8.1 A schermo, durante il gioco

- Le **mani** di Elvira e ciò che tengono (squadro, lente, lettera, Velo, lampada).
- Un **punto a matita** minuscolo al centro, che appare solo quando lo sguardo cade su qualcosa con cui si può interagire (si spegne nelle opzioni).
- Il **fiato**: restringimento della vista e suono del respiratore, nessuna barra.
- I **suggerimenti dei comandi**: una riga in corsivo a matita in basso, solo la prima volta di ogni verbo; disattivabili.
- I **sottotitoli** con il nome di chi parla («una velata», finché Elvira non sa il nome).

### 8.2 Il Taccuino

- **Domande**: le piste sono domande scritte da Elvira («Chi ha scritto la lettera di Marta?»), mai «vai al punto X». Ogni domanda raccoglie i suoi indizi.
- **Indizi**: frasi brevi e schizzi a matita, sempre con la fonte («Capsula 3, Cripta», «Togna, al lavatoio»).
- **Le due mani**: la tecnica in stampatello, la madre in corsivo.
- **Parole**: la parola tecnica barrata con quella locale accanto («~~asse~~ il Fuso»). Cinque parole nella prima ora (Linea, Meta, Mane, Sera, in su), poi circa una per zona. I proverbi in dialetto con la traduzione di Elvira.
- **La riga del cielo**: in alto, fissa, il prossimo evento («Meta fra 34 s», «Brace alle 19:30», «Alba alle 05:30»).
- **Leggende**: le varianti dell'Ombrista trascritte.
- **Respiri**: le sacche d'aria trovate.
- Il Taccuino si apre in un gesto; il tempo del mondo non si ferma (si ferma solo con la pausa), ma le scene non partono mentre è aperto.

### 8.3 La Pianta del Verbano

- Il cilindro srotolato su un foglio (4,06 km × 3 km) che si chiude su sé stesso: scorrendo oltre il bordo si rientra dall'altro lato.
- Gli stessi tre stati del mondo: bianco, matita, colore (inchiostro e acquerello).
- I capisaldi compaiono come triangolini da geometra solo quando Elvira li ha trovati o visti con lo squadro; i lati rilevati sono linee sottili a china.
- Il **resoconto del mattino** in rosso (§3.4.8).
- Una **rosa dei venti** con Mane, Sera, Mont e Lag, disattivabile.
- Il **puntatore della posizione** è un'opzione di accessibilità, spenta di serie.
- La Lanterna resta un cerchietto bianco anche quando tutto il resto è a colori.

### 8.4 Il libretto di Aurelio e l'erbario

- **Libretto**: indice per numero; ogni monografia ha numero, tipo, descrizione del luogo, schizzo, «vede:» con i capisaldi visibili, note a margine (alcune per Elvira). Sbaglia quanto una carta di duecento anni.
- **Erbario**: le pagine a fronte dei tre rami, i fiori raccolti in attesa di essere premuti, i Germogli, la lente, la pagina sigillata del martagone.

### 8.5 Menù e salvataggi

- Pausa, opzioni, salvataggi. Salvataggio automatico a ogni alba e a ogni passo di missione; tre slot manuali.
- Il menù **«aspetta fino a»** si apre da seduti (§3.7).

---

## 9. Audio

- **Paesaggio sonoro a strati** per zona: valle (vento, riale, campanacci, ronzio delle api di rame), la Linea (un ronzio basso che si alza quando è più piena), la Meta (un fruscio bianco ogni 51 s), la notte (tintinnio d'ottone e frullo leggero delle Fade), le Finestre (vento freddo, ferro che scricchiola, silenzio), sott'acqua (tutto attutito e basso), il Fuso (vento e Linea forte), il Guscio (gocce, macchine a orario), il Fondo (il rumore di treno della Ruota, che cambia tono prima di ogni picco).
- **Suono come misura**: i ritardi dei risonatori nella M3 usano la velocità vera del suono (343 m/s); le macchine hanno un ritmo che l'Orecchio di servizio rende leggibile.
- **Meridiana**: un motivo di tre rintocchi, poi la voce dall'altoparlante del campanile; il «Confermo» con la Linea che pulsa ha un suo accordo.
- **Voci**: sette personaggi doppiati, ciascuno con un filtro diegetico e un intervallo di tono diverso (Elvira: respiratore; Meridiana: campana; Ilde: garza; Severino: radio; Ottavio: vento; Lucia: cera; Giulia: cucina). Pina, Fermo, Togn e i minori parlano in testo con un mormorio. Il dialetto è quasi tutto scritto; le poche frasi dette (la preghiera dei Sordi, la frase della Voce, il bollettino del finale segreto) si registrano con un parlante ticinese in una giornata.
- **Musica**: rara e acustica (organetto, chitarra, clarinetto, contrabbasso, banda di paese). Entra nei momenti chiave: il primo sguardo in su, il primo rilievo (un accordo che sale mentre il colore si allarga), le albe, l'Ombrista, le rivelazioni. Il tema di Marta è fischiato. Nessuna musica di combattimento.
- **Didascalie dei suoni** importanti per chi non sente («[la Ruota cambia tono]», «[tre rintocchi]»).

---

## 10. Accessibilità e comfort

Progettati dal primo mese, provati con 5-8 persone sensibili al mal di movimento a ogni fase.

**Comfort**

- Orizzonte fisso: il rollio della camera è agganciato al «giù» locale. Nessun ondeggiamento della testa, nessuna scossa della camera, nessun motion blur di serie.
- Campo visivo regolabile (70-110°).
- Vignettatura in planata regolabile (0-100 %).
- Capovolgimento attraverso il cielo: rollio lento annunciato o dissolvenza a pennello.
- Stelle delle Finestre rallentabili fino al 25 %.
- Dondolio visivo sostituibile con un suono e un'onda del Velo.
- Coriolis sul corpo: 0, 40 (di serie) o 100 %.
- Passaggio sopra/sotto l'acqua sempre in dissolvenza.

**Accessibilità**

- Sottotitoli sempre disponibili, grandezza regolabile, con il nome di chi parla e le didascalie dei suoni; glossario del dialetto nel Taccuino.
- I tre stati della mappa non dipendono solo dal colore: bianco = contorni, matita = tratteggio, colore = campitura con contorno a china. La salute ha anche un motivo (bruno = macchie, grigio = tratteggio incrociato). Opzione «matita marcata» per più contrasto.
- Aiuti di rilievo: bolla più larga (finestra di 1,5 s nel Dondolio), collimazione che aggancia il segnale.
- Apnea +50 %; Tenuta con la fascia verde più larga; traversate delle Finestre con 10 s d'ombra in più.
- Puntatore della posizione sulla Pianta; rosa dei venti.
- **Avviso della sera** (opzione): prima di dormire il Taccuino elenca ciò che Elvira ha usato quel giorno e che non è misurato.
- Comandi rimappabili, tenere o premere a scelta, nessun QTE, ogni azione a tempo ha un aiuto.
- Pausa ovunque: il tempo del mondo si ferma nei menù, nella lettura delle lettere e nella pausa.
- Testo grande e font leggibile nelle lettere scritte a mano, con una versione «stampata» a richiesta.
- Audio mono, volumi separati per voci, musica, ambiente.

---

## 11. Piano delle fasi di costruzione

Ogni fase finisce con una versione giocabile dall'inizio, con i test automatici verdi e un test di comfort. I contenuti vivono in `content/*.json`; ogni fase aggiunge file nuovi senza riscrivere quelli delle fasi precedenti.

| Fase | Obiettivo | Contenuti | Sistemi nuovi | Criteri di uscita |
|---|---|---|---|---|
| **0. Il cilindro** (in corso nel motore) | il mondo curvo funziona | terreno delle tre valli e dei Tappi, Finestre, Linea, Collare | coordinate cilindriche, fisica con «su» variabile, camera con orizzonte fisso, griglia delle particelle, shader matita-colore | 60 fps con risoluzione dinamica ≥ 0,75 su Iris Xe o Radeon 680M guardando in su da Corbella; test di comfort superato; altrimenti piano B (fondale dipinto unico per le valli lontane) |
| **1. Corbella** | prologo e missione 1 giocabili, 45-60 min, più gioco libero | Cripta, Corbella, Selve basse, prima notte; altre valli a matita; 3 segreti e 1 easter egg | camminare, guardare, sedersi e respirare, leggere, lente, innesto, Velo dai muri, dialoghi, Taccuino, Pianta, libretto, squadro (appuntare e rilevare di giorno), tre stati, notte con le regole 3 e 4, resoconto del mattino, orologio con fermi, Ombrista base, «aspetta fino a» base | vedi `FASE1.md`: il prologo e la missione 1 si completano in ogni ordine permesso; nessuna notte rompe la missione; il simulatore della notte passa |
| **2. Il Verbanetto** | la seconda valle e l'acqua | lago, isole, Bugni, Riva Alta, Fondale (torre sommersa, sacche, sagoma del Locarno), M2, Rosa, Togn, Nodi 2 e 9, prime pagine dell'Erbario, prime lettere della Madre | barca a remi e a vela con venti a orario, nuoto, apnea, sacche, lama della Meta, volo attraverso il cielo completo, Germogli e pagine | la M2 completabile con zero pagine e con ciascun ramo; apnea simulata in Node (il fiato basta per ogni tratto obbligatorio) |
| **3. Le Finestre e la notte attraverso il cielo** | la prima rivelazione | Finestra dei Ponti completa, tratti delle altre due, primi Giorni Ciechi, M4, segreti del bordo e della luce cinerea, S6 (inizio) | traversata a impulsi, Ragni, teleferica, goniometro e livella, lumi di mira, triangoli attraverso il cielo, tabella di visibilità notturna | T1 chiuso in tutte le build; nessun lato attraverso l'asse possibile di giorno |
| **4. Gli Alpeggi** | la valle del peso e delle voci | Valle 3 completa (Alpe, casali, Pian dal Fen, Bosch Négru, piede del Sordo), M3, Fermo, cilindri, S4, S5, S11 (inizio), Nodi 3, 5, 11 | gravità come variabile di gameplay, lanci curvi, ascolto con ritardi, il Bue | triangolazione della Voce risolvibile senza pagine; vitello riportabile in tre giorni |
| **5. La Galleria della Carta** | la notte intera | Guscio (kit), Galleria della Carta, M5, S1, S2, S3, tutti i Nodi dell'Atto I, Erbario completo (24 pagine) | veglia, Strada delle Fade, regole 1 e 2 della notte, mosse della Madre A1-A4, Penna di catasto, macchine con i quattro verbi | il simulatore gioca 10.000 partite dell'Atto I senza violare le garanzie (§3.4.9) |
| **6. Il Fuso e la svolta** | il mondo cambia a metà | Fuso, Barca del Cielo, Quadro della Linea, M6, secondi Giorni Ciechi, la Perla | gravità zero, Bombola, cavi, Dondolio (marea e gravità ondulante), guardie ostili, mosse B1-B2 | la svolta cambia la mappa (accessi nuovi, fazione ostile, orologio nuovo) in tutte le combinazioni di piste |
| **7. Atto II, prima parte** | chi scrive il mondo | M7, M8, M9, S7, S8, S9, S10, Archivio, interno del Locarno, capsula del Pilastro 9 | onda scriptata, Notte dei Termini e «la mano ricorda», infiltrazione con processione, banco ottico | la Notte dei Termini non tocca mai hub, vie di trama, rifugi; il resoconto spiega ogni chiodo |
| **8. Atto II, seconda parte** | chi ti ha svegliata | M10, M11, M12, S12, grande incontro dei Ragni smerigliatori, il Fondo | dialogo con prove, carovana, Tenuta, smeriglio a quattro stadi | Tenuta superabile con ogni ramo e senza pagine; fallire non blocca |
| **9. Atto III e finali** | chi tiene la valle | M13 (cinque vie), M14, la Lanterna, i tre finali, il finale segreto, l'epilogo a tableaux | stazione libera, Triangolo Zero, scelte finali, variazioni dei finali | ogni finale raggiungibile da ogni build; il finale segreto dipende solo dai suoi tre requisiti |
| **10. Rifinitura** | il gioco completo | registrazioni in dialetto, varianti finali dell'Ombrista, bilanciamento dei Germogli | prestazioni, accessibilità completa, salvataggi robusti, app desktop | prova completa di 22-25 ore senza blocchi; test di comfort finale |

---

## Appendice A. Glossario del gergo

| Parola tecnica (barrata) | Parola locale | Quando entra nel Taccuino |
|---|---|---|
| filamento assiale | la Linea | prima ora |
| Tau Ceti (stella di destinazione) | la Meta | prima ora |
| nel verso della rotazione | a Mane | prima ora |
| contro la rotazione | a Sera | prima ora |
| verso l'asse | in su | prima ora |
| macchine di manutenzione | le Fade | prima notte |
| Tappo Nord | il Sordo | secondo giorno |
| Verbano II | la Sorella | prologo (dalla lettera), poi corretta nella M4 |
| verso il Tappo Sud / verso il Tappo Nord | a Mont / a Lag | Atto I |
| finestre | la Notte | Finestra dei Ponti |
| strato di nubi | il Collare | Selve alte |
| asse | il Fuso | Fuso |
| registrazione catastale | la benedizione | Galleria della Carta |
| ralla di servizio, operatore | l'Om dal Fond, i Tegnitt | Fondo |
| Terra | la Perla | svolta |

## Appendice B. I 40 elementi mobili

**I 14 elementi di trama**

| # | Elemento | Zona | Missione | Varianti |
|---|---|---|---|---|
| 1 | Passerella del Messo | Corbella | M1 | Carta, Abitata |
| 2 | Scorciatoia delle Terrazze | Corbella | M1 | Carta, Abitata |
| 3 | Pontile della Riva Alta | Verbanetto | M2 | Carta, Abitata, Mietuta |
| 4 | Scaletta della Cappella delle Voci | Alpeggi | M3 | Carta, Abitata |
| 5 | Passerella della nicchia 7 | Finestra dei Ponti | M4 | Carta, Abitata |
| 6 | Casa di Nando | Corbella | M5, S2 | Carta, Smontata, Abitata, Scritta |
| 7 | Sentiero della Bocca delle Fade | Valle 1 | M5 | Carta, Abitata |
| 8 | Scala del Mozzo | Tappo Sud | M6 | Carta, Abitata |
| 9 | Case dei pescatori della Riva Alta | Verbanetto | M7 | Carta, Abitata, Mietuta |
| 10 | Ingresso dell'Archivio | Corbella | M8 | Carta (murato), Abitata (aperto) |
| 11 | Banco ottico della serra | Isola Grande | M9 | Carta, Abitata |
| 12 | Passerella delle Vedove | Finestra delle Vedove | M11 | Carta, Abitata |
| 13 | Gradini della galleria della Canva | Guscio | M12 | Carta, Abitata, Scritta |
| 14 | Via della parete (ometti, corde, cenge) | Sordo | M14 | Carta, Abitata, Scritta |

**I 26 elementi facoltativi** (case, orti, scorciatoie): Corbella e Selve 7 (muro di Ronco, orto dei Ronchi, scala del fienile alto, recinto delle capre, legnaia della grà di Pian, ponticello del Pian dei Ricci, capanno dei Messi sul Balcone); Verbanetto 6 (casa di Agostina, pergola delle Vigne, barche tirate in secco, scala della Torre dei Bugni, orto dell'Isola dei Conigli, canneto tagliato); Alpeggi 9 (tre fienili non benedetti, rascane del Pian, ometti della Strada della Salida, covoni della Corte di Mezzo, scaletta della Corte Alta, recinto della Stalla dei Leggeri, ponte della Gerra); Finestre 3 (nicchie riparate); Guscio 1 (giaciglio di Gioann). **Gli elementi con la variante Scritta** (le 30 ancore della Penna, §3.4.7): Via della parete (8 ancore), ponte della Gerra (3), scaletta della Corte Alta (3), scala della Torre dei Bugni (3), pergola delle Vigne (3), gradini della galleria della Canva (3), scala del fienile alto (2), ponticello del Pian dei Ricci (2), nicchie riparate delle Finestre (2), casa di Nando (1: il condotto d'aria della secondaria 2).

## Appendice C. Adattamenti rispetto al concept

| Concept | Questo documento | Motivo |
|---|---|---|
| cilindro di 3,2 km, raggio 650 m | 3000 m, raggio 646 m | costanti del motore; la gravità al fondo resta 1 g con 51 s |
| 160 particelle, 40 mobili | particelle = celle di 40 m (7.200 in tutto); 40 **elementi mobili** di 1-6 particelle; nomi catastali con una formula per foglio (§2.2) | griglia del motore; il numero che conta per la produzione (varianti da costruire) resta 40 |
| giorni di 40 + 12 minuti | giorno di 24 ore = 40 minuti reali (giorno 26 min, notte 14) | costante del motore |
| l'esodo dei Sordi passa sulla Finestra dei Ponti | passa sulla **Finestra delle Vedove** | nel motore la Finestra dei Ponti sta fra Corbella e il Verbanetto; la Finestra fra gli Alpeggi e Corbella è la 330-360, che diventa la Finestra delle Vedove (le firme sotto la carovana rafforzano la scena) |
| nomi delle Finestre 2 e 3 non assegnati | 210-240 Finestra Cieca, 330-360 Finestra delle Vedove | la Cieca vicina agli Alpeggi rende visibile l'agenda della Madre sulla valle che gela; le Vedove vicine a Corbella mettono Tecla e la luce cinerea a portata del primo atto |
| piazza larga 70 m | Piazza delle Ore di 36 m (raggio 18 m) | layout del motore |
| «Le diedi un martagone» nella nota di Elvira | «Mi diede un martagone» | è Marta che diede il martagone alla madre |
| pagine da 2 a 4 Germogli, 8 coppie su 12 | 2/3/3/4 Germogli, 8 o 9 coppie su 12 | numeri interi coerenti con 28 Germogli |
| rilievo della singola particella | ventaglio di 60 m attorno a un lato; triangoli attraverso il cielo; **stazione libera** | con celle di 40 m un rilievo per cella sarebbe una lista della spesa; la stazione libera (intersezione inversa) dà una regola leggibile alla salita del Sordo |
| velo della Madre: scelta fissa | si mette e si toglie fino alla M6 | arriva il secondo giorno, prima che il giocatore sappia che cosa significa |
| «particella 4-117» (l'orto di Battista) | «particella 4-614» | il nome segue la formula del foglio 4 (§2.2), così la Pianta e il terminale dicono lo stesso numero |
| striscia della Cripta | rilevata dal G4 nel 2291, a inchiostro seppia | spiega perché la botola non è stata richiusa dalle Fade e pianta il primo indizio su S. |
| manovre e Tenuta di quattro minuti | manovra di 40 minuti di gioco; nella Tenuta l'orologio corre a un quarto | coerenza fra orologio del mondo e durata della scena |
