Sei un game director e narrative designer di altissimo livello. Devi scrivere UN concept di videogioco completo, in italiano, per un utente che lo leggerà e sceglierà fra più proposte.

Prima di scrivere leggi questi file (sono la base obbligatoria):
- /tmp/claude-0/-home-user-claude/2d1b03fc-1fa7-5f01-bd16-e8d21334f915/scratchpad/ricerca/richiesta.md (la richiesta esatta dell'utente e il contesto: il gioco precedente TRAMA)
- /tmp/claude-0/-home-user-claude/2d1b03fc-1fa7-5f01-bd16-e8d21334f915/scratchpad/ricerca/mercato.md (ricerca di mercato 2023-2026)
- /tmp/claude-0/-home-user-claude/2d1b03fc-1fa7-5f01-bd16-e8d21334f915/scratchpad/ricerca/design.md (ricerca di design: mondo, trama in open world, missioni, build, segreti, ritmo, prima persona)
- /tmp/claude-0/-home-user-claude/2d1b03fc-1fa7-5f01-bd16-e8d21334f915/scratchpad/ricerca/tecnica.md (cosa si può davvero fare: three.js nel browser, niente volti umani realistici, natura sì)

Regole del concept:
- Prima persona, open world con un mondo vero e coerente (struttura consigliata dalla ricerca: hub più 4-6 zone dense e diverse, oppure un mondo continuo compatto di 4-8 km² con zone distinte). Zelda e Outer Wilds solo come ispirazione per il mondo.
- Grafica semi-realistica DAVVERO raggiungibile: paesaggi, luce, nebbia, meteo, rovine, acqua sì; volti umani realistici, lip-sync e folle no. Spiega come mostri le persone (a distanza, mascherate, velate, via radio, lettere, registrazioni, tableaux, sagome, voci) senza che sembri un ripiego: deve diventare stile e tema.
- Trama: scrivi prima la verità nascosta (cosa è successo davvero, in ordine). Atto I con 3-4 piste parallele, svolta centrale che CAMBIA IL MONDO (accessi nuovi, fazione ostile, regole diverse), atto III che fa convergere tutto, più finali. Almeno due colpi di scena che rileggono ciò che il giocatore sa già. Antagonisti o fazioni con piani che avanzano da soli. La trama deve portare il giocatore da una parte all'altra del mondo con missioni di tipo SEMPRE diverso (mai lo stesso verbo due volte di fila). Ogni risposta apre una domanda nuova che indica un luogo nuovo.
- Missioni principali: 10-14, ciascuna con nome, tipo e descrizione concreta (cosa si fa, dove, quale svolta). Missioni secondarie: 8-12, ciascuna con una svolta (introduzione, sviluppo, svolta, risoluzione), niente fetch o "uccidi X".
- Build: 3 rami con filosofie diverse, abilità che aggiungono opzioni (traversata, soluzioni alternative), scelte che si escludono a vicenda, un budget condiviso, un costo nel mondo per i poteri forti, rispecializzazione limitata. Ogni build deve avere una via in ogni missione principale. Niente statistiche gonfiate, niente level scaling, niente materiali bloccati per regione. Fai tre esempi di build e come affrontano la stessa situazione.
- Sfida e combattimento: decidi tu se e quanto. Se c'è, deve essere coerente con il mondo e con i limiti tecnici (animali, creature, macchine, ombre, sagome).
- Navigazione: niente checklist di icone; diario di piste e indizi, indicazioni scritte rispetto a punti di riferimento, landmark visibili da lontano.
- Segreti in 4 livelli (1 visto ma irraggiungibile; 2 nascosto in piena vista; 3 sistemico, si trova usando le meccaniche in modo creativo; 4 meta o cifrato, da risolvere con appunti, magari in community). Almeno 8 segreti. Un finale segreto.
- Easter egg: almeno 6, fra cultura e letteratura del luogo, cinema, videogiochi, e almeno uno legato a TRAMA (Sant'Arianna, il merletto, Ada, le lettere di "L.").
- Durata: 10-14 ore di trama principale, 20-25 ore per completarlo.
- Evita queste trappole: checklist di icone, torri che rivelano la mappa, level scaling, boss che ignorano la build, scelte morali premiate in contraddizione con la storia, urgenza finta in un mondo che aspetta, misteri messi prima che il giocatore conosca il luogo, survival-crafting, post-apocalisse, prescelto, padre segreto, nonna santa, diga, loop temporale come struttura principale.
- Sii concreto e specifico: nomi propri, luoghi, oggetti, scene, numeri. Niente frasi generiche da brochure. Deve sembrare un gioco di un certo livello, pensato nei minimi dettagli.

Il seme del tuo concept (puoi cambiare il titolo e reinterpretare liberamente, ma mantieni il cuore dell'idea):


## MODALITÀ DI SCRITTURA (obbligatoria)
Il concept è lungo: NON progettarlo tutto nella testa e NON scriverlo in un colpo solo, altrimenti superi il limite di output e perdi tutto. Lavora a tappe, salvando ogni tappa su file prima di passare alla successiva:
1. concept/<key>.parte1.json: titolo, sottotitolo, frase, ambientazione, zone, direzione_artistica, protagonista, personaggi, verita_nascosta.
2. concept/<key>.parte2.json: trama, come_si_gioca, build.
3. concept/<key>.parte3.json: missioni_principali, missioni_secondarie.
4. concept/<key>.parte4.json: segreti, finale_segreto, easter_egg, durata, fattibilita, perche_funziona, rischi.
5. Unisci le quattro parti con python3 in concept/<key>.json (più il campo "key"), controlla che sia valido e cancella le parti.
Ogni tappa è un oggetto JSON con soli quei campi. Pensa a ogni tappa solo quanto serve per scriverla bene. Le ricerche sul web sono facoltative: massimo 5 minuti.
