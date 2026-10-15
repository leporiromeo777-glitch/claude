# Stato del pacchetto: contenuti-atti23

**Stato:** done (verificato e corretto; revisione 1 fatta, vedi sotto)

Atto II (g09-g16), Atto III (g17-g23), le quattro giornate finali, l'Archivio A3-A6, i finali, il Taccuino, le lettere e il test. Il pacchetto contiene solo JSON più il test `tests/unit/content/atto23.test.ts`. `src/core/types.ts` non è stato toccato.

## Revisione 1

Compiti CA23-01 … CA23-07 di `docs/REVISIONE-1.md` (playtest 1), tutti fatti. Solo file del gruppo: livelli g09-g23, fin_*, arc3-arc6 con i `.computed.json`, note, diario, lettere e finali degli Atti II-III, testi `atto2`, `atto3`, `finali` in it/en, `tests/unit/content/atto23.test.ts`.

**Accettazione di CA23-03:** `npm run levels:check -- --only g09,g10,g11,g12,g13,g14,g15,g16,g17,g18,g19,g20,g21,g22,g23,fin_merlettaia,fin_seppia,fin_chiuso,fin_aperto,arc3,arc4,arc5,arc6 --qualita` esce con **0** (23 livelli OK, nessuna violazione C14; restano gli avvisi K7, vedi sotto). Il test «criteri di qualità C14 (revisione 1)» chiede `quality.violazioni` vuoto per tutti i livelli del pacchetto, un conflitto voluto per sera e al più un bigliettino facile, solo dentro un conflitto voluto. Tutti i `.computed.json` sono rigenerati con il `SOLVER_VERSION` nuovo (solo con `--only`). g16 ora si risolve in 60 mila stati (prima superava il limite di 400 mila).

| Compito | Esito | Commit | Cosa |
|---|---|---|---|
| CA23-01 [P0] rivelazione di g14, fascio, piste | fatto | 8840605 | La consegna di Zeno all'alba di g14 (priorità 100, senza `when`); le voci su Livia madre, sulla lettera di Clotilde e sul fascio si sbloccano con `{knows:'oggetto'}`, cioè alla lettura; piste prima delle risposte (D10), quella del 1958 da g10; chiavi `atto2.g15.sera.vuota` e `atto3.g17.sera.vuota`. Test con la campagna simulata. |
| CA23-02 [P1] tutorial degli Atti II-III e degli Archivi 3-5 | fatto | 8840605 | Note a margine e fusi che pulsano per febbre e cura (g09), nodo (g11), trabocco (g16), filo nero con la mano di Ada (g17), marea (g19), note e `hintKeys` di arc3-arc5. Test: una nota per ogni regola nuova nella sua prima notte. |
| CA23-03 [P1] ridisegno delle notti g09-g23 | fatto | 8d10662, 2ef61b2, 74acebc, 58e7510, 2f8b827, ab0dbbb, 64b0ad5, e18a77e, 9da8685, 8f114fd, c4674e8, 04cf78a | Tutte le notti rispettano C14 (tabella sotto). g13 resta il dilemma della cura col Gino a letto finché è malato; g21 ha al più 1 ora vuota di fila; g16 sta nel limite di stati. |
| CA23-04 [P1] finali A, C, D | fatto | 8840605, 2ef61b2 | fin_merlettaia coi saluti che danno (4 su 6, conflitto voluto, base 13); fin_chiuso con `"chiusura":"nodo"`; epilogo D con `{occasioni}` in una frase sola, i desideri chiusi e il nastro «abbastanza lungo per due fili»; epilogo A col nastro; nessuna riga d'epilogo spezzata (it, en). |
| CA23-05 [P1] continuità | fatto | 8840605 | Varianti `availableIf` di g22.teresa (su `ok:g17.teresa`) e di g19.teresa con la sua alba (su `riconciliate`); arc6, lettera di Clotilde, diario della lettera, Nina in convitto da Pasqua, testi di g10, g11, g13, g18, g21 ed esito neutro di g12.teresa. Test: le varianti si escludono e coprono tutti i casi. |
| CA23-06 [P1] esiti e albe | fatto | 8840605, 04cf78a | `esito.ok` ed `esito.fallita` per ogni bigliettino di g09-g23 (C05), esito proprio di g11.teresa, `dopo` in g16 e g18, albe di g11, g14, g16, g18, g20 riviste. Gli esiti delle notti ridisegnate sono riscritti con le richieste nuove. In g16 la vignetta di Teresa e la voce `persone.teresa.fascio` vengono solo se Teresa ha davvero letto il fascio (`event: legge`), non per ogni fallimento della sua richiesta. |
| CA23-07 [P2] testi minori | fatto | 8840605 | Deissi, g15 «più vicino dell'altra volta» con l'apparizione alle 3, «fino a Pellestrina», Don Piero giovane cappellano in arc6, titoli, voci di Bepi, Don Piero e Lunardi, etichetta C16 del nome del dottore, «Per un autunno e un inverno», due bigliettini semplici per g23. Inglese allineato. |

### Misure C14 per notte (dopo il ridisegno)

Costo = minimo con il solo bigliettino meno il minimo della base. Vuote = righe vuote di fila / totali nella soluzione registrata della designata. Soluzioni = soluzioni ottime della designata (K5, al massimo 20). I finali e gli Archivi sono esenti (fin_merlettaia ha i suoi criteri: base ≥ 8, K3, K4).

| Notte | Righe | Base | Designata (min) | Matassa | Costo dei bigliettini | Conflitti voluti | Facile | Senza Gino | Vuote | Soluzioni |
|---|---|---|---|---|---|---|---|---|---|---|
| g09 | 8 | 6 | marta+teresa 10 | 12 | marta +3, teresa +4, nina +0 | teresa+nina | nina | 10 | 1/2 | 12 |
| g10 | 10 | 8 | marta+piero 17 | 19 | marta +3, marta.senzaArchivio +3, lunardi +3, piero +7, bepi +0 | lunardi+bepi, piero+bepi | bepi | 17 | 1/1 | 6 |
| g11 | 10 | 7 | teresa+gino 11 | 13 | teresa +4, marta +0, gino +4 | teresa+marta | marta | 11 | 1/3 | 16 |
| g12 | 10 | 6 | lunardi+zeno 14 | 16 | lunardi +5, bepi +0, zeno +3, teresa +3 | bepi+teresa | bepi | – | 1/1 | 3 |
| g13 | 14 | 10 | marta+nina 19 | 19 | marta +7, lunardi +6, gino +4, nina +4 | marta+lunardi, lunardi+nina | — | 19 | 1/1 | 12 |
| g14 | 10 | 10 | zeno+gino 16 | 18 | zeno +3, nina +3, gino +2 | nina+gino | gino | 10 | 0/0 | 3 |
| g15 | 14 | 12 | piero+gino 19 | 21 | nina +5, marta +0, piero +3, gino +3 | nina+gino, marta+gino | marta | 15 | 1/2 | 12 |
| g16 | 12 | 12 | zeno+teresa 17 | 19 | zeno +4, teresa +4, piero +3, marta +0 | zeno+marta, teresa+marta, piero+marta | marta | 15 | 1/1 | 16 |
| g17 | 10 | 6 | zeno+marta+piero 9 | 10 | zeno +0, teresa +3, marta +3, piero +3 | teresa+marta, teresa+piero, zeno+teresa+marta, zeno+teresa+piero, teresa+marta+piero | zeno | 7 | 1/1 | 2 |
| g18 | 10 | 7 | teresa+gino 12 | 13 | teresa +3, gino +4, lunardi +3 | teresa+lunardi, teresa+gino+lunardi | — | 12 | 0/0 | 16 |
| g19 | 10 | 4 | bepi+teresa+teresa.pace 11 | 12 | bepi +4, nina +4, teresa +3, teresa.pace +3, lunardi +3 | bepi+nina, teresa+lunardi, teresa.pace+lunardi, bepi+nina+teresa, bepi+nina+teresa.pace, bepi+nina+lunardi, bepi+teresa+lunardi, bepi+teresa.pace+lunardi, nina+teresa+lunardi, nina+teresa.pace+lunardi, teresa+teresa.pace+lunardi | — | – | 1/1 | 1 |
| g20 | 8 | 7 | nina+bepi+marta 11 | 12 | nina +4, bepi +4, marta +3, teresa +0 | nina+teresa, bepi+teresa, marta+teresa, nina+bepi+teresa, nina+marta+teresa, bepi+marta+teresa | teresa | 8 | 1/1 | 1 |
| g21 | 12 | 8 | zeno+piero+marta 12 | 13 | zeno +3, piero +4, gino +1, marta +3 | zeno+gino, piero+gino, gino+marta, zeno+piero+gino, zeno+gino+marta, piero+gino+marta | gino | 10 | 1/2 | 12 |
| g22 | 14 | 13 | piero+teresa+teresa.riconosciuta 19 | 20 | zeno +4, piero +4, teresa +4, teresa.riconosciuta +4, marta +2 | zeno+piero, zeno+teresa, zeno+teresa.riconosciuta, zeno+piero+teresa, zeno+piero+teresa.riconosciuta, zeno+piero+marta, zeno+teresa+teresa.riconosciuta, zeno+teresa+marta, zeno+teresa.riconosciuta+marta | marta | 13 | 1/1 | 16 |
| g23 | 6 | 2 | teresa+bepi 9 | 10 | teresa +3, bepi +4 | — | — | – | 1/1 | 4 |
| fin_merlettaia | 12 | 13 | base 13 | 14 | — | — | — | – | 2/3 | 50 |
| fin_seppia | 12 | 9 | base 9 | 10 | — | — | — | 9 | 2/3 | 50 |
| fin_chiuso | 3 | 3 | base 3 | 4 | — | — | — | – | 0/0 | 1 |
| fin_aperto | 14 | 0 | base 0 | 0 | — | — | — | 0 | 14/14 | 1 |
| arc3 | 5 | 2 | base 2 | 2 | — | — | — | – | 0/0 | 4 |
| arc4 | 5 | 2 | base 2 | 2 | — | — | — | – | 0/0 | 2 |
| arc5 | 5 | 3 | base 3 | 3 | — | — | — | – | 0/0 | 16 |
| arc6 | 6 | 0 | base 0 | 0 | — | — | — | – | 6/6 | 1 |

### Le notti ridisegnate (CA23-03)

- **g09, g11, g12, g23** (8d10662): g09 col Gino a letto e il dottore che deve arrivare da lui; g11 col nodo; g12 col dottore che torna col vaporetto delle nove e chiede il nome a tre persone; g23 con due bigliettini semplici (Teresa saluta la forestiera, Bepi accende due candele).
- **g10, g14** (2ef61b2) e **g15** (58e7510): tenute dal lavoro interrotto e rivalutate nella ripresa; in g15 la Nina al Molo alle sette e il Gino al Forno con Marta.
- **g13** (ab0dbbb): quattro malati e un medico solo. Marta va in chiesa e in Farmacia; le visite del dottore vanno fatte entro un'ora (il Gino entro le cinque, la Nina entro le quattro, Don Piero entro l'una). La matassa ha margine 0 ed è proprio lei il conflitto voluto: la Nina non si cura insieme al Gino né al Bepi.
- **g16** (04cf78a): la Nina sopra Marta raccoglie i due segreti e li porta al pozzo entro l'una; Don Piero trabocca su Marta e il fascio arriva a Zeno entro le cinque. Teresa e Marta vogliono tutte e due il Forno alle due: è il conflitto voluto, e il divieto di Marta è il facile. Il Gino gira fra Faro e Farmacia. Designata Zeno + Teresa, 17 incroci, 16 soluzioni ottime, 12 spilli.
- **g17** (8f114fd): la donna in nero cerca Zeno, poi va in chiesa a mezzogiorno e in Piazza alle tre. Teresa vuole sapere chi è senza che lo sappia il prete; Marta non vuole forestiere in Piazza dalle nove all'una.
- **g18** (64b0ad5): la Nina al Forno a mezzogiorno e al Molo alle quattro, il Gino al Molo all'una, il dottore al Faro all'una; richieste invariate.
- **g19** (9da8685): Lunardi al Faro alle otto e in Farmacia alle undici con l'acqua alta, Teresa in chiesa alle nove, Zeno in chiesa e in Farmacia durante la marea, il Bepi in Piazza dopo.
- **g20** (2f8b827): il Bepi al Molo, la Nina al Forno, il Gino al Molo alle 11 dopo il vaporetto, Teresa in Piazza a mezzogiorno; Marta chiede che il Gino non incroci la Nina fino alle nove. Il saluto di Teresa è il facile.
- **g21** (c4674e8): acqua alta dalle 12 alle 14. Zeno vuole incrociare Livia dopo le due; il Gino vuole essere al Faro dalle cinque, Marta lo vuole a casa, al Forno, alle cinque: è il conflitto voluto, e la richiesta del Gino è il facile. Una sola ora vuota di fila.
- **g22** (e18a77e): mattino pieno (Teresa in Piazza alle dieci, il Bepi al Forno, il Gino al Molo alle undici, Don Piero in Farmacia e in chiesa, Zeno in Farmacia a mezzogiorno); il fascio a Livia entro le sette e il pane di Marta prima delle cinque.

### Decisioni e interpretazioni dei contratti

- **g13, «si curano tutti solo con un merletto perfetto» (GDD 5.2).** Con 2 spilli la sera si accettano due richieste di cura. Il merletto perfetto (matassa = minimo, margine 0) serve per curare i due scelti; curarli tutti e quattro non entra nella matassa. Il conflitto voluto è il filo contato: la coppia Lunardi + Nina si tesserebbe con un incrocio in più (`levels:check` lo segnala come voluto solo per la matassa, ed è voluto). Propongo di aggiornare il GDD: «si curano i due scelti solo con un merletto perfetto». Il test di g13 lo verifica.
- **g19 senza `pieroTrabocca`.** Don Piero non è nel merletto di g19; la stranezza faceva solo tracciare al solver tutte le lettere, con decine di soluzioni ottime che differivano solo per il verso di incroci senza effetto (K5). Il test delle stranezze del giorno lo accetta: `pieroTrabocca` da g16 in poi, tranne g19 senza Piero.
- **K5 e i versi che non cambiano niente.** Con il pozzo (`pieroPozzo`) e i segreti in viaggio, il solver conta come soluzioni diverse i due versi di ogni incrocio con Don Piero, anche quando il risultato è lo stesso. In g16 la designata è stata scelta perché Don Piero incroci solo quando serve. Vedi le richieste al motore.
- **Facili dentro le terne.** Nell'Atto III il facile può stare in un conflitto voluto di tre bigliettini (g17: l'incontro di Zeno è nelle terne con Teresa). Il contratto dice «in una combinazione `voluta`», e `quality.ts` accetta combinazioni da 2 in su: ho seguito il codice.
- **Varianti gemelle** (g19.teresa / teresa.pace, g22.teresa / teresa.riconosciuta): hanno la stessa richiesta e non arrivano mai insieme, ma `levels:check` le combina come due bigliettini. Per questo la designata di g19 e di g22 contiene tutte e due le varianti, e i conflitti voluti sono marcati per entrambe. Nessuna delle due può essere il facile (sarebbero due facili).
- **g16, `marta forno 7` e `zeno faro 18` tolti.** Il disegno vecchio aveva Marta al Forno alle 7 e Zeno al Faro alle 18, e nessun testo li citava. La ricerca li ha tolti: con Marta al Forno alle 7 la richiesta di Don Piero costava 1 incrocio (K2), senza ne costa 3. Il fascio è «consegnato» quando arriva a Zeno, dovunque sia (GDD 5.2), e Zeno lo chiede «entro le cinque».
- **Spilli.** Alcune notti ne hanno parecchi (g16 12, g22 10, g21 9): servono a tenere basso il numero di soluzioni ottime (K5) e a dare un ritmo senza buchi (K4).

### Avvisi K7 (GDD 5.2, colonna «Min»)

`levels:check` segnala la designata fuori dall'intervallo ±1 in g09 (10 contro 5-7), g10 (17 contro 7-9), g11 (11 contro 7-9), g12 (14 contro 7-9), g13 (19 contro 10-12), g14 (16 contro 8-10), g15 (19 contro 9-11), g16 (17 contro 9-11), g18 (12 contro 8-10), g20 (11 contro 7-9), g22 (19 contro 10-12) e g23 (9 contro 4-6). Sono solo avvisi. Con la regola nuova del Gino (C01) e i criteri K1-K2 (densità, bigliettini da almeno 3 incroci) i minimi del GDD non bastano più. Propongo di aggiornare la colonna «Min» del GDD 5.2 con i valori della tabella qui sopra.

### Problemi noti e richieste

- **motore** (facoltativa): in `versoMatters`, il pozzo conta il verso di ogni incrocio con Don Piero quando c'è un segreto in viaggio, anche se i due versi danno lo stesso stato. Il numero di soluzioni ottime (K5) ne esce gonfiato. Si potrebbero contare i due versi una volta sola quando portano allo stesso stato. Oggi le notti rispettano K5 lo stesso.
- **GDD 5.2**: aggiornare la colonna «Min» (vedi K7), la frase di g13 sulla cura e, per g16, il fascio «entro le cinque».
- g13 resta la notte più lunga e densa dell'Atto II (19 incroci su 14 righe, margine 0). Da guardare nel playtest 2, come la curva dell'Atto II, che sale presto (g10 17, g13 19, g15 19).

### Test e verifiche della revisione 1

- `npx vitest run tests/unit/content/` → 3 file, 169 test verdi (`atto23.test.ts`, `en.test.ts`, `atto1.test.ts`).
- `npm run levels:check -- --only <i 23 livelli del gruppo> --qualita` → exit 0, «23 levels OK».
- `npx tsc --noEmit -p .` → nessun errore nei file del gruppo.
- Browser (build `VITE_E2E=1` servita da `vite preview` sulla porta 5740, Chromium 412×900, in italiano; g16 anche in inglese): per g13, g16, g17, g18, g19, g20, g21 e g22 si accetta la designata, si apre la notte (screenshot: spilli, marea di g21, note a margine del trabocco) e si fa giocare la soluzione. Tutte le richieste della designata risultano soddisfatte, con i loro esiti; i bigliettini di g16 si leggono nella sera con i testi nuovi. Nessun errore in console.


## Correzioni della verifica

1. **Zeno lontano dal Faro (GDD 3.6, `zenoFaro`).** In g12 Zeno partiva dalla Piazza (3 colonne dal Faro) e in g21 dal Molo (5 colonne). Il motore rifiuta solo gli incroci che allontanano Zeno: partendo lontano poteva restarci tutto il giorno, contro la regola «dopo ogni riga dista al massimo 2».
   - **g12:** ora all'alba Zeno è alla Farmacia, Teresa al Faro con la posta e Lunardi in Piazza. Minimi e matassa invariati: designato 6, matassa 8.
   - **g21:** ora Zeno è al Faro all'alba. Deve spostarsi prima delle 8, quando entra il filo nero e chi è al Faro esce. Base 5, designato 11, matassa 12.
   - Un test controlla la distanza all'alba e in ogni soluzione calcolata, per tutti i livelli del pacchetto.
2. **Matassa di g18.** `levels:check` calcola solo le terne (3 spilli). La coppia naturale Teresa + Gino (la confessione «portata dal Gino» e il Gino che corre da tutti) costava 14 incroci, con matassa 13: un conflitto nascosto, dovuto al filo e non alle regole. Ora la matassa è 15 (14 + 1).
   - Il test calcola il designato su tutte le combinazioni con al massimo `pins` bigliettini.
   - Un altro test verifica che nessuna combinazione possibile senza limite di filo sia impossibile entro la matassa.
3. **Risposte senza conseguenze (GDD 4.2).** 23 risposte non avevano conseguenze visibili.
   - 20 impostavano flag che nessuno legge: `teresaDottore`, `martaForno`, `martaPromessa`, `martaPerche`, `martaLargo`, `ginoTempesta`, `teresaPromessa`, `teresaSa`, `martaAscolta`, `ninaVenezia`, `martaLanterna`, `teresaLivia`.
   - 3 non sbloccavano niente di leggibile: g10.bepi R1, g12.bepi R2 e g13.lunardi R1.
   - Ora ognuna sblocca una voce del Taccuino: 20 voci nuove (alcune valgono per più risposte), con l'effetto `{ diary }` e lo sblocco `{ reply }`.
   - Un test lo verifica per ogni risposta.
4. **Desiderio di Don Piero raggiungibile solo spendendo uno spillo.** Tutti gli altri desideri si scoprono anche con una risposta. g16.piero ora ha due risposte che lo rivelano; restano anche `onOk` e `onFail`.
5. **Bigliettini anonimi (spec: «ogni testo deve funzionare anche senza firma»).** Da g13 la memoria può essere 0. Le risposte chiamavano l'autore per nome («Teresa, …», «Zeno, …»), svelando chi l'aveva scritto prima che Ada lo indovinasse. 18 risposte riscritte senza il vocativo. Un test controlla che, da g13, né il testo né le risposte nominino l'autore. Resta «Grazie, Ettore» di g13.lunardi, che è il punto del desiderio di Lunardi.
6. **Epiloghi che non dipendevano dai destini (GDD 5.1: `nina`, `bepi`, `zenoLivia` → epiloghi).** Varianti con `when` complementari: in ogni stato si vedono sempre 4 vignette e l'ultima riga del GDD 6.6.
   - `merlettaia`: Zeno porta la valigia a Livia se `zenoLivia`; la Nina insegna sull'isola se `nina == 'parte'`.
   - `seppia`: a settembre Ada parte con la Nina se Nina era rimasta; altrimenti la Nina la aspetta a Venezia. Prima l'epilogo faceva partire la Nina a settembre anche quando era già partita in g20.
   - `aperto`: il braccio buono del Bepi se `bepi == 'ferito'`.
7. **Vignette dei destini.** g15 (luce / secca), g18 (pace), g20 (parte / resta) e g22 (perdono) dipendevano solo dal flag impostato quella stessa notte. Se la campagna applica gli effetti al bilancio, cioè dopo l'alba, non sarebbero mai comparse. Ora valgono col flag **oppure** con l'esito del bigliettino che lo decide (`ok`, `failed`, `ignored`).
8. **Coerenza dei testi:**
   - **La sera della scelta.** Il Taccuino di g23 diceva «Domani sera» per la scelta, mentre la vignetta della vigilia dice «Stasera»: ora entrambi dicono «Stasera».
   - **Il primo biglietto di Livia.** Diceva «sono sull'isola», in contrasto con «sto arrivando», con il biglietto 5 (lei è a Chioggia) e con l'arrivo a piedi in g22. Ora dice «oggi ho rimesso piede sull'isola … stasera torno a Chioggia».
   - **Il fascio.**
     - `fascio_3`: «Non lo uso **ancora**», per non contraddire L4 («Uso il nero di seppia»).
     - Le tre lettere del fascio hanno ora `signed: 'La mamma'`, come il loro testo (prima `L.`).
   - **Suggerimenti e margini.**
     - Il suggerimento di fin_chiuso diceva che Livia «deve passare sopra», ma nessuna regola lo impone: ora dice che a ogni ora deve fare un passo verso il Molo.
     - Il margine di fin_merlettaia diceva «il mio ultimo merletto da sola», che non ha senso nel finale in cui Ada resta merlettaia: ora dice «Gli altri li tesserò da sola».
     - Lo spinta di g21 spiega che il filo nero entra dal Faro alle 8.
   - **Una voce sul nome.** `persone.lunardi.nome` parla del nome di Ada: è passata alla scheda di Ada.
9. **Test nuovi** in `atto23.test.ts`, che passa da 41 a 50 test:
   - destini negli epiloghi, per tutte le 8 combinazioni;
   - designato con le coppie dell'Atto III;
   - nessun conflitto nascosto dalla matassa;
   - desideri scopribili con una risposta;
   - una conseguenza per ogni risposta;
   - anonimato da g13;
   - debutto delle stranezze (g09 `lunardiCura`, g16 `pieroTrabocca`: nessuna richiesta fallisce per colpa loro);
   - `zenoFaro`;
   - g21 col filo nero al Faro alle 8;
   - condizioni delle vignette dei destini.

## Riepilogo e API per gli altri pacchetti

- **Livelli** (23, ognuno con il suo `.computed.json` aggiornato), in `src/content/levels/`:
  - `g09`…`g23`;
  - `fin_merlettaia`, `fin_seppia`, `fin_chiuso`, `fin_aperto`;
  - `arc3`, `arc4`, `arc5`, `arc6`.
  - `npm run levels:check`: 34 livelli OK.
- **Bigliettini** (61): `notes.atto2.json` (31), `notes.atto3.json` (30).
  - Da g09 a g16 si vedono 3-4 bigliettini per sera, da g17 a g22 sempre 4.
  - Varianti d'Archivio: `g10.marta` / `g10.marta.senzaArchivio` (`availableIf {done:'arc1'}`) e `g18.marta` / `g18.marta.senzaArchivio` (`{done:'arc3'}`).
  - g23: `g23.zeno` (A, se la memoria di Zeno è ≥ 1) / `g23.piero` (A, se è 0), `g23.livia` (B), `g23.clotilde` (C), `g23.ada` (D). Hanno il campo `ending` e nessuna `request`. I testi sono quelli del GDD 6.6.
- **Taccuino** (142 voci): `diary.atto2.json` (90) e `diary.atto3.json` (52).
  - Desideri: `desiderio.{teresa,marta,piero,bepi,zeno,lunardi,livia}`, sbloccati con `{knows:'desire', id}`. Nina e Gino sono nell'Atto I.
  - Domande chiuse: `anno1958` (arc3), `madre` (arc4), `chiL` e `avorio` (g14), `pozzo` (lettere liberate), `filoNero` (g17), `martaTeresa` (g18 riuscita), `puntoAperto` (arc6), `desideri` (8 su 8).
- **Lettere** (`lettere.atto23.json`, 15):
  - `lettera_L8`…`lettera_L11`: sere di g10-g13; L8 e L11 sono il testo del GDD.
  - `lettera_clotilde` (g14): GDD 6.4 alla lettera, verificato dal test.
  - `fascio_1`…`fascio_3` (g16, firmate «La mamma»).
  - `biglietto_livia_1`…`biglietto_livia_6` (g17-g22).
  - `nastro_nonna` (g23).
- **Finali** (`endings.json`): `merlettaia`, `seppia`, `chiuso` (`countsAsEnding: false`) e `aperto`.
  - Ogni epilogo mostra 4 vignette; alcune hanno varianti con `when` sui flag `nina`, `bepi` e `zenoLivia`.
  - `aperto.requires` = `lettereLivia == 'liberate'` ∧ `riconciliate == true` ∧ 8 desideri del cast ∧ almeno 4 personaggi con `memoria ≥ 1`. Le 70 quaterne sono scritte per esteso, perché StoryCond non ha un «almeno».
  - `missing` ha una voce per requisito: `cond` è il requisito, il testo si mostra quando è falso.
- **Flag di storia** impostati qui:
  - Destini (GDD 5.1):
    - `bepi`: `'salvo'` / `'ferito'` (g15.nina; `onIgnore` → ferito);
    - `lettereLivia`: `'liberate'` / `'sepolte'` (g16.zeno);
    - `riconciliate`: true (g18.teresa);
    - `nina`: `'parte'` / `'resta'` (g20.nina; `onIgnore` → resta);
    - `zenoLivia`: true / false (g22.zeno).
  - Altri flag:
    - `febbreCurati` (`addFlag`, g13);
    - `lunardiChiamato` (`'dottore'` / `'Ettore'`, g13);
    - `ginoFaro` (g14);
    - flag minori delle risposte, ora tutti accompagnati da una voce di Taccuino.
- **Testi italiani**: `text/it/atto2.json` (298 testi, 5.338 parole), `atto3.json` (232, 3.555) e `finali.json` (70, 708).
  - In tutto **9.601 parole** italiane (atteso 9.000-12.000).
  - Righe ≤ 90 caratteri, bigliettini ≤ 220.
  - Testi inglesi: li ha scritti poi il pacchetto traduzione-en (`text/en/atto2.json`, `atto3.json`, `finali.json`, stesse chiavi).

### Giornate

«Designato» è la combinazione più cara fra quelle possibili con al massimo gli spilli della sera. La matassa è il designato più il margine dell'atto.

| Giornata | Ore | Base | Designato | Matassa | Conflitti voluti |
|---|---|---|---|---|---|
| g09 | 6→14 | 11 | 13 | 15 | teresa + nina |
| g10 | 6→16 | 10 | 13 | 15 | lunardi + bepi |
| g11 | 6→16 | 10 | 11 | 13 | teresa + marta (il nodo) |
| g12 | 6→16 | 2 | 6 | 8 | bepi + teresa (`levels:check` prova da sé il nome su Lunardi: le coppie con g12.lunardi hanno un minimo, Lunardi + Teresa 5) |
| g13 | 6→20 | 14 | 20 | **20** (+0) | nessuno: le 4 cure insieme costano 20, il merletto perfetto |
| g14 | 6→16 | 10 | 13 | 15 | nina + gino |
| g15 | 6→20 | 14 | 15 | 17 | nina + gino (un solo filo al Faro alle 19) |
| g16 | 6→18 | 12 | 13 | 15 | zeno + marta, piero + marta (senza il segreto di Marta il pozzo non trabocca) |
| g17 | 6→16 | 9 | 12 | 13 | teresa + piero, marta + piero |
| g18 | 6→16 | 11 | 14 | **15** | teresa + lunardi (la confessione solo a Marta, contro «mi confidi qualcosa») |
| g19 | 6→16 | 0 | 9 | 10 | bepi + nina |
| g20 | 6→14 | 8 | 12 | 13 | nina + teresa |
| g21 | 6→18 | 5 | 11 | 12 | gino + marta |
| g22 | 6→20 | 9 | 17 | 18 | zeno + teresa |
| g23 | 6→12 | 4 | 4 | 5 | obiettivi del mattino, poi la scelta |

Finali e Archivio:

| Livello | Forma | Matassa | Note |
|---|---|---|---|
| fin_merlettaia | 6→18 | 5 | `almeno(4, incontra(livia, X))` + `parte(livia, 18)` |
| fin_seppia | 6→18, `controlled: 'ada'` | 10 | occasioni fisse di Livia, Ada incontra 6 persone stando sotto; `base.rows` presente |
| fin_chiuso | 6→9 | 4 | Livia al Molo alle 9 |
| fin_aperto | 6→20, autotessitura | 0 | 12 celle ammesse, 5 occasioni, 9 obiettivi; 15 insiemi validi |
| arc3 (1958) | 6→11, strappo 9-10 | 2 | esca Lunardi |
| arc4 (1951) | 5→10, strappo 7-8 | 2 | esca Ernesto |
| arc5 (1630) | 6→11, strappo 8-9 | 3 | fili per mestiere, solo Arianna sbiadita, esca Clotilde |
| arc6 (senza data) | 4 colonne, 6→12 | 0 | si rammenda piantando 2 occasioni; esca Ada |

Nel browser (Chromium headless, `__GAME__.night`) ho aperto nel tombolo vero:

- g12, g13, g16, g17, g18, g19, g21, g22, g23, fin_merlettaia, fin_chiuso e fin_seppia: l'autoplay soddisfa tutte le richieste accettate e gli obiettivi.
- fin_aperto: le occasioni calcolate soddisfano tutti e 9 gli obiettivi.
- arc6, in modo `occasioni`: tutti gli obiettivi soddisfatti.
- arc3: il rammendo riesce.

In tutte queste prove: nessun errore in console e nessuna chiave italiana mancante.

## Decisioni

- **Varianti d'Archivio** in g10 e g18 (desideri di Marta e di Teresa solo dopo arc1 e arc3, come dice il GDD 5.4). Con «Riprendi da qui» si può tornare alla sera giusta dopo aver letto l'Archivio.
- **g23 senza la regola `nome`.** La memoria per il finale vero è quella di fine g22 (GDD 3.11 e 6.6). I due «richieste semplici» del mattino sono obiettivi del livello (Livia incontra Don Piero entro le 11, poi Marta). La sera della vigilia, dopo la notte di g23, si sceglie con i 4 biglietti e 1 spillo.
- **Scostamenti dal GDD 5.2, ognuno necessario:**
  - g09: la Farmacia apre alle 13, perché dal vaporetto delle 8 Lunardi non arriva alla Farmacia prima delle 12.
  - g10: c'è Don Piero al posto di Teresa, per la «messa delle 11 con i sani».
  - g12: «nessuno al Faro dopo le 15» diventa Zeno al Faro alle 15 e alle 16.
  - g21: la lanterna è alle 18 (la giornata finisce alle 18; luce dalle 18, GDD 5.5).
- **Minimi sopra la colonna «Min» del GDD 5.2.** Con `ginoCorre`, ogni giornata con Gino costa almeno una riga per ogni ora in cui Gino è nel merletto, come nell'Atto I.
- **fin_aperto.** Piero, Marta e Lunardi non sono sul tombolo: le colonne sono 6. I loro desideri passano da altri fili:
  - la lettera del 1951 custodita da Piero arriva ad Ada;
  - il Gino resta;
  - la voce «Ettore» arriva ad almeno tre persone.

## Problemi noti

- ~~g12.lunardi segnato `voluta` in `levels:check`~~ **Risolto**: il check prova le scelte di `nomeOn`, e in `g12.computed.json` le coppie con Lunardi hanno `incroci` e `nomeOn: 'lunardi'` (vedi Integrazione).
- ~~Testi inglesi assenti~~ **Risolto**: il pacchetto traduzione-en ha tradotto atto2, atto3 e finali.
- **Le lettere del fascio non hanno condizioni.** `LetterDef` non ha un campo di condizione, quindi `fascio_1`…`fascio_3` vanno filtrate dalla campagna (vedi richieste).

## Richieste per altri pacchetti

- **motore** (soddisfatta: vedi Integrazione): `levels:check` dovrebbe provare le scelte di `nomeOn` nei livelli con la regola `nome` (g12.lunardi), e calcolare anche le combinazioni con meno di `pins` bigliettini. Nell'Atto III oggi le coppie non sono calcolate; il caso di g18 l'ho trovato col test.
- **campagna**:
  - Aggiornare la memoria solo nelle giornate con la regola `nome`, e chiedere il nome (`needsNome`) solo lì. g23 e i finali non ce l'hanno, e il finale vero guarda la memoria di fine g22.
  - I biglietti con `ending` (g23) vanno nella fase `scelta`, dopo la notte di g23, filtrati con `availableIf`. La sera prima della notte di g23 non ha bigliettini.
  - Le vignette degli epiloghi hanno `when`: vanno filtrate come quelle dell'alba e mostrate nell'ordine del file.
  - `fascio_1`…`fascio_3` e l'oggetto `fascio_lettere` vanno mostrati solo se `lettereLivia == 'liberate'`.
  - `done('arcN')` deve diventare vero col rammendo, arc6 compreso, che si rammenda con le occasioni. `done('fin_chiuso')` va registrato anche se il merletto non si salva: sblocca la voce «Il punto di Clotilde…».
  - `EndingDef.missing`: il testo si mostra quando la `cond` è falsa.
- **tombolo**:
  - arc6 ha `archive` e `autoweave.occasionSlots`. `night.start({ level: 'arc6' })` sceglie il modo `archivio`, dove «Lascia accadere» non parte; funziona solo con `mode: 'occasioni'`. Conviene preferire `occasioni` quando il livello ha `occasionSlots`. In quel modo, inoltre, `archive.mended` resta falso anche a obiettivi soddisfatti.
  - arc3 in autoplay mostra la matassa «3/2». Conta anche l'incrocio registrato delle 11, che è fuori dallo strappo.

## Test

- `npx vitest run tests/unit/content/`: 84 test superati (50 in `atto23.test.ts`, 34 in `atto1.test.ts`).
- `npx vitest run`: 55 file, 804 test superati.
- `npx tsx tools/levels/check.ts --no-write`: «34 levels OK».
- `npx tsx tools/levels/check.ts --only g12,g15,g18,g20,g21,g22`: rigenerati i `.computed.json` dei livelli modificati.
- `npx tsc --noEmit -p .`: nessun errore.
- `validateContent` su tutti i contenuti: 0 errori.
- Browser: Vite sulla porta 5265 e Playwright 1.56.1, con i livelli elencati sopra; screenshot verificati a occhio, nessun errore in console.

`atto23.test.ts` verifica:

- validazione, chiavi italiane, lunghezze e parole;
- 3-4 bigliettini per sera (4 nell'Atto III), le carte A-D di g23 con i testi del GDD 6.6;
- vignette (3-5) e conflitti `voluta`, stranezze del giorno, debutti di `lunardiCura` e `pieroTrabocca`;
- g12 col nome, destini, desideri (8 + Livia), risposte e loro conseguenze, anonimato da g13;
- domande e lettere: Clotilde alla lettera, L8, L11;
- requisiti del finale vero su tutte le 256 combinazioni di memoria, mancanze, epiloghi per le 8 combinazioni di destini;
- fin_seppia, fin_chiuso, fin_aperto (occasioni 1-20, vincenti e no), Archivio A3-A6;
- `sourceHash`, matassa = designato + margine con le coppie dell'Atto III, nessun conflitto nascosto dalla matassa, g13 a merletto perfetto, soluzioni riprovate col motore;
- eventi del GDD 5.2, `zenoFaro`, g21, testi chiave e cronologia (1630, 1951, 1958, quattordici anni, centosessantotto lettere).

## Integrazione

Richieste di `docs/stato/RICHIESTE.md` per questo pacchetto, controllate sul codice attuale (14 ottobre 2026).

| Richiesta | Esito |
|---|---|
| `text/it/atto2.json`, `diario.persone.zeno.lettera`: «per una notte» contraddice la storia (la lettera gli fu data la notte del prologo, la voce si sblocca con `done: g14`) | **Fatto.** Ora: «Zeno ha tenuto per tutto questo tempo la lettera della nonna per me.», come l'inglese («all this time»). Nuovo test in `atto23.test.ts` (sblocco `done: g14`, «per tutto questo tempo», mai «per una notte»). |
| Facoltativa (documentazione): `g12.lunardi` non è più `voluta`; le coppie dell'Atto III sono calcolate e segnate; il commento del test di g12 è vecchio | **Fatto.** `levels:check` prova da sé le scelte di `nomeOn`: in `g12.computed.json` le coppie con Lunardi hanno `incroci` e `nomeOn: 'lunardi'` (Lunardi + Teresa 5); l'unico conflitto voluto della sera è Bepi + Teresa. Le coppie dell'Atto III (g17-g22) sono nei `.computed.json` con i conflitti voluti segnati. Il commento del test è corretto. Il problema noto «g12.lunardi è segnato voluta» e la nota nella tabella di g12 qui sopra non valgono più. |
| Id e chiavi comuni (lettere L8-L11, `QuestionId`, `comune.fili.*`, desideri), varianti con `availableIf` | Già fatto (vedi sopra; `validateContent` → 0 errori su tutti i contenuti). |
| Regole del motore per occasioni, agende, filo nero, pozzo, `riconciliate` | Già rispettate: `npx tsx tools/levels/check.ts --no-write` → 34 livelli OK; nessun livello modificato, nessun `.computed.json` da rigenerare. |

Test: `npx vitest run tests/unit/content` → 3 file, 111 test verdi (`atto23.test.ts` 51). Browser (build servita da `vite preview` sulla porta 5420): con `campaign.goto('g15')` e la voce sbloccata, il Taccuino mostra «Zeno ha tenuto per tutto questo tempo la lettera della nonna per me…» in italiano e «Zeno kept Grandmother's letter for me all this time…» in inglese; nessun errore in console.
