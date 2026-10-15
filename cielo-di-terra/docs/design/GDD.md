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
- **Fogli del catasto** (per l'interfaccia e i nomi delle particelle): 1 = Corbella e le Selve, 2 = Il Verbanetto, 3 = Gli Alpeggi, 4 = Il Sordo, 5 = Le Finestre, 6 = Il Fuso, 7 = Il Guscio. Il nome catastale di una particella di valle è «foglio-numero», con numero = iz·24 + (colonna dentro la valle) + 1. Esempio: la particella della Terrazza Pedrazzini (iz 23, colonna 6 di Valle 1) è «1-559». Il motore usa l'id numerico della griglia; il nome catastale serve solo a schermo e nei testi.

### 2.3 Il tempo

| Fatto | Valore |
|---|---|
| Giorno di gioco | 24 ore di gioco = 40 minuti reali; 1 ora = 100 s; 1 minuto = 1,67 s |
| Alba | 05:30-06:30. Alle 05:30 la Linea si accende dal Tappo Sud come una miccia: il fronte di luce corre lungo l'asse e arriva sopra Corbella alle 05:40 e al Sordo alle 06:00 |
| Giorno pieno | 06:30-19:30 |
| Brace | 19:30-21:00. La Linea si ritira dal Sordo verso il Tappo Sud e lascia una brace blu |
| Notte | 21:00-05:30 (circa 14 minuti reali per chi veglia) |
| Giro delle Fade | 22:00-04:30, con un orario per ogni particella (la tabella del giro, §3.4.6) |
| Manovre dell'asse | alba 06:00-06:40, mezza luce 13:00-13:40, brace 20:00-20:40 |
| Passaggio della Meta | ogni 51 s, giorno e notte; su ogni punto delle valli è una lama di luce bianca di 3-4 s |
| Fasi della Sorella | ciclo di 29,5 giorni di gioco; la fase avanza ogni notte |
| Giorni Ciechi | due volte in tutta la partita, scritti dalla trama (§5.3); durano 3 giorni di gioco |

Regola di produzione: un ciclo vero della Meta lungo le Finestre durerebbe 29,5 giorni di gioco (quasi 20 ore reali). Il gioco non lo simula: la posizione della Meta lungo le Finestre è una tabella di trama, e le misure di tre anni di Ottavio sono dati del suo quaderno.

Le campane della Confraternita suonano il mattutino alle 06:00, la mezza luce alle 13:00 e la brace alle 20:00. Sono le ore delle tre manovre: nel 2122 Meridiana fissò lì le correzioni d'assetto, e la Confraternita ne ha fatto un rito senza saperlo. È un indizio leale, mai spiegato prima del Fondo.

### 2.4 La mappa del cilindro

Il cilindro srotolato (z in orizzontale, θ in verticale). Ogni riga vale 15°, ogni colonna 250 m.

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
| Cripta dei Giardinieri | botola (1112, 27,0, 48) sotto il castagno morto; sale delle capsule a h −4 | inizio del gioco |
| Terrazza Pedrazzini | (948, 23,0, 56) | il castagno del cartellino di zinco, primo innesto, chiodo 3 |
| Mulino sul riale | (1130, 51,0, 7,5) | ruota, chiodo 7 |
| Fienile di Ottavio | (1176, 58,5, 11,7) | rifugio, chiodo 8 sul Sass dal Messo |
| I Ronchi | (1150-1200, 42-48) | case degli Smascherati, casa di Nando |
| Sass Grand e Pilastro 6 | (1190, 74,0, 42) | belvedere sulla Finestra dei Ponti |
| Grà di Pian | (890, 17,5, 34) | essiccatoio con fumo, chiodo 37 |
| Pian dei Ricci e Pilastro 4 | (800, 9,0, 90) | Selve alte |
| Balcone dei Messi e Pilastro 42 | (110, 30, 452) | 0,3 g: da qui si «cade» nell'altra valle |
| Cartiera | (1320, 49, 4) | carta di castagno con la filigrana (secondaria 7) |
| Bocca delle Fade e Pilastro 44 | (1520, 70, 18) | botola d'ingresso alla Galleria della Carta |
| Piana di Sant'Anna e Pilastro 40 | (2000, 45, 20) | orti benedetti, frutteti |
| San Rocco dei Pellegrini | (2645, 44, 9) | partenza della scala dei pellegrini, tolta dalla Carta nel 2265 |
| Scala Coperta | cancello (2650, 30, 10) | galleria scavata della Confraternita verso l'Eremo |

**Particelle mobili** (elementi con varianti notturne): 9 in tutta la valle, 4 nel nucleo di Corbella (la passerella del Messo, la scorciatoia delle Terrazze, la casa di Nando, il muro di Ronco). **Segnali di cielo**: il campanile bianco con la palina, il fumo delle grà, i lumi della Piazza alla brace.

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
| Orto di Battista (particella 4-117) | (2880, 140, 470) | cengia tenuta in ordine dalle Fade per una riga G1 del 2199 |
| Lanterna | (2968, asse, 642) | osservatorio murato con lastre di piombo; telescopio da 60 cm e cercastelle |
| Caposaldo Zero | sulla soglia della Lanterna | cancellato dalla Carta nel 2265 |

Il Sordo è l'unica montagna che resta a matita per tutto il gioco, finché l'ultimo triangolo non la dipinge.

### 2.6 I capisaldi del Catasto

La rete di Aurelio Respini conta **212 capisaldi**: 24 pilastri di bronzo (alti 1,2 m, con un segnale di 8-10 m, una palina bianca e rossa o un disco, pensato per essere letto con il cannocchiale da 1,3 km) e 188 chiodi d'ottone murati in sagrati, muri a secco e massi. Più il Caposaldo Zero sulla soglia della Lanterna. La numerazione è unica (1-212) e segue l'ordine del rilievo del 2120-2121.

| N. | Pilastro | (z, θ, h) | Zona |
|---|---|---|---|
| 1 | San Vigilio, sulla cella campanaria | (1062, 37,2, 62,5) | Corbella |
| 4 | Pian dei Ricci | (800, 9,0, 90) | Selve alte |
| 6 | Sass Grand | (1190, 74,0, 42) | Corbella, versante a Mane |
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

