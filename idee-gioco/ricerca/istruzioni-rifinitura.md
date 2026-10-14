# Istruzioni per la rifinitura di un concept

Sei il game director che ha scritto il concept indicato nel tuo compito. Tre giurie (critica, produzione, giocatore e mercato) lo hanno valutato. Riscrivilo nella versione migliore possibile.

Leggi prima (cartella /tmp/claude-0/-home-user-claude/2d1b03fc-1fa7-5f01-bd16-e8d21334f915/scratchpad/):
- ricerca/richiesta.md, ricerca/design.md, ricerca/tecnica.md, ricerca/istruzioni-autori.md (le regole con cui è stato scritto)
- concept/<key>.json (il concept attuale)
- giurie/<key>-critica.json, giurie/<key>-produzione.json, giurie/<key>-giocatore.json

Regole:
- Mantieni l'identità e l'hook del concept, ma risolvi TUTTI i problemi segnalati, applicando le correzioni (o una soluzione migliore, spiegando perché).
- Controlla di nuovo ogni requisito dell'utente: prima persona, open world con un mondo vero, grafica semi-realistica fattibile, trama avvincente e intricata con missioni sempre diverse, missioni secondarie con svolte, segreti ed easter egg (uno legato a TRAMA), upgrade e build che cambiano il modo di giocare, gioco relativamente lungo (10-14 ore trama, 20-25 complete), pensato nei minimi dettagli.
- Ricontrolla la coerenza interna: la verità nascosta deve spiegare ogni colpo di scena; ogni build deve avere una via in ogni missione principale; nessuna missione principale ripete il verbo della precedente.
- Tutto in italiano, concreto e specifico.

Output: scrivi concept/<key>-v2.json con lo stesso formato di ricerca/formato-concept.md PIÙ due campi:
- "modifiche": ["che cosa hai cambiato e quale critica risolve"],
- "scheda_breve": "presentazione per l'utente, 300-400 parole, italiano naturale e scorrevole, senza elenchi: hook, mondo, trama senza rovinare il colpo di scena principale (accennalo soltanto), come si gioca, build, segreti".
Verifica che il JSON sia valido con python3. Come risposta finale scrivi solo il titolo e le 3 modifiche più importanti.

## MODALITÀ DI SCRITTURA (obbligatoria)
Non riscrivere tutto il concept nel ragionamento prima di scrivere: chi lo ha fatto ha superato il limite di output e ha perso tutto. Entro 5 minuti devi aver salvato il primo file.
1. Salva concept/<key>-v2.piano.md (massimo 300 parole): l'elenco delle modifiche che farai, ciascuna con la critica che risolve.
2. Scrivi la versione nuova in 4 parti, salvando ogni parte prima di passare alla successiva (stessi gruppi di campi di ricerca/istruzioni-autori.md, sezione MODALITÀ DI SCRITTURA): concept/<key>-v2.parte1.json ... parte4.json. Nella parte4 aggiungi anche "modifiche" e "scheda_breve".
3. Unisci le parti con python3 in concept/<key>-v2.json, controlla che sia valido e cancella le parti.
