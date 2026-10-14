# Istruzioni per il MIX (concept definitivo)

Cartella base: /tmp/claude-0/-home-user-claude/2d1b03fc-1fa7-5f01-bd16-e8d21334f915/scratchpad/

## La decisione dell'utente
Dopo aver letto i cinque concept, l'utente ha scelto: «voglio un misto dei primi 3 tenendo come base il 3».
I primi tre sono, nell'ordine in cui li ha visti:
1. SIBILLA (concept/sibilla-v2.json): Monti Sibillini 1953, la cartografa; quello che misuri di giorno resta, quello che lasci in bianco di notte cambia; folklore (fate, Pantafica), carta che decide il mondo.
2. LA TERZA COLONNA (concept/colapesce-v2.json): arcipelago fra Eolie e Stretto 1950; mondo a tre strati (superficie, fondale, miraggi solidi); nuoto, remi, vela, planata; la leggenda di Colapesce che regge l'isola; le lettere che non tornano; il teatro dei pupi che cambia la leggenda.
3. CIELO DI TERRA (concept/cielo-v2.json) = LA BASE: il Verbano, cilindro rotante abitato da ticinesi e lombardi; gravità che cala salendo, il Velo per planare, il lago appeso nel cielo, la Linea, le Finestre, il Fuso; Elvira Pedrazzini botanica di Cevio; gli abitanti velati; le api di rame; il «dove siamo» e «la Terra è viva?».

Base = Cielo di Terra: mondo, protagonista, tono, ossatura della trama restano i suoi. Da Sibilla e dalla Terza Colonna prendi meccaniche, strati di mondo, idee di trama, personaggi e segreti che lo rendono più ricco, MA integrati nel mondo del cilindro in modo naturale e coerente (non incollati): ogni innesto deve avere una ragione d'essere dentro il Verbano.

## Altre decisioni già prese dall'utente
- Prima persona, open world alla Zelda / Outer Wilds (come ispirazione per il mondo), trama intricata con missioni sempre diverse, secondarie con svolte, segreti ed easter egg (uno legato a TRAMA), upgrade e build, gioco lungo (11-14 ore di trama, 22-25 complete), pensato nei minimi dettagli.
- STILE GRAFICO SCELTO (sostituisce il "semi-realistico" dei documenti precedenti): un misto fra grafica a campiture piatte e pittura a mano. Forme grandi, pulite e semplificate, silhouette forti, colori quasi piatti con sfumature morbide, profondità atmosferica a piani come quinte di teatro, e sopra una leggera pennellata dipinta su rocce, muri, acqua, fogliame e cielo; palette calda e ricca. Riscrivi la direzione artistica in questo stile (e sfruttalo: per esempio il mondo «non rilevato» può essere uno schizzo a matita che si colora). Questo stile rende più facili acqua, vegetazione e mondo curvo: tienine conto nella fattibilità.

## Da leggere prima di scrivere
- ricerca/richiesta.md, ricerca/design.md, ricerca/tecnica.md, ricerca/istruzioni-autori.md (regole e trappole da evitare).
- concept/cielo-v2.json (la base, per intero), concept/sibilla-v2.json e concept/colapesce-v2.json (per intero).
- giurie/cielo-*.json, giurie/sibilla-*.json, giurie/colapesce-*.json (i problemi già segnalati: non reintrodurli).

## Vincoli di scope (le giurie di produzione hanno già detto che i tre concept, presi singolarmente, erano al limite)
Il mix NON deve essere la somma dei tre. Per ogni cosa che aggiungi, togli o semplifica qualcos'altro. Tetto: 6-7 zone, 12-14 missioni principali, 10-12 secondarie, 3 rami di build con 10-12 coppie di scelte esclusive in tutto, 10-12 segreti, un solo sistema dell'acqua, un solo sistema di rilievo/mappa. Spiega nella fattibilità che cosa hai tagliato rispetto alla base.

## Output
Scrivi il concept nel formato di ricerca/formato-concept.md (stessi campi) PIÙ tre campi:
- "dal_mix": ["che cosa viene da Sibilla, che cosa dalla Terza Colonna, e come è stato adattato al cilindro"],
- "tagli": ["che cosa hai tolto o semplificato rispetto ai tre concept e perché"],
- "scheda_breve": "presentazione per l'utente, 350-450 parole, italiano naturale e scorrevole, senza elenchi: hook, mondo, trama senza rovinare i colpi di scena (accennali soltanto), come si gioca, build, segreti".

## MODALITÀ DI SCRITTURA (obbligatoria)
Non progettare tutto nel ragionamento prima di scrivere: chi lo ha fatto ha superato il limite di output e ha perso tutto. Entro 5-6 minuti devi aver salvato il primo file.
1. Salva concept/<key>.piano.md (massimo 400 parole): l'idea del mix, la verità nascosta in breve, che cosa prendi da ciascun concept, che cosa tagli.
2. Scrivi in 4 parti, salvando ogni parte prima di passare alla successiva (stessi gruppi di campi di ricerca/istruzioni-autori.md, sezione MODALITÀ DI SCRITTURA): concept/<key>.parte1.json ... parte4.json. Nella parte4 aggiungi anche "dal_mix", "tagli" e "scheda_breve".
3. Unisci con python3 in concept/<key>.json (con il campo "key"), verifica che sia valido e cancella le parti.
Come risposta finale scrivi solo il titolo, la frase-hook e i 5 innesti più importanti.
