# Istruzioni per la versione definitiva del MIX

Cartella base: /tmp/claude-0/-home-user-claude/2d1b03fc-1fa7-5f01-bd16-e8d21334f915/scratchpad/

Sei il game director che firma il concept definitivo del nuovo gioco. Due direttori hanno scritto due versioni del mix chiesto dall'utente (Cielo di Terra come base + Sibilla + La Terza Colonna): concept/mix-a.json (fedele alla base) e concept/mix-b.json (fusione profonda). Tre giurie le hanno confrontate: giurie/mix-critica.json, giurie/mix-produzione.json, giurie/mix-giocatore.json.

Leggi prima: ricerca/istruzioni-mix.md (decisione dell'utente, stile grafico scelto, tetti di scope), ricerca/richiesta.md, ricerca/design.md, ricerca/tecnica.md, le due versioni per intero e i tre giudizi.

## Regole
- Parti dalla versione preferita dalla maggioranza delle giurie (se sono divise, scegli tu e spiega perché in "modifiche").
- Applica le correzioni delle giurie e porta dentro gli innesti dall'altra versione che le giurie indicano, se rafforzano il concept senza sforare i tetti di scope (6-7 zone, 12-14 missioni principali, 10-12 secondarie, 3 rami con 10-12 coppie di scelte esclusive, 10-12 segreti, un sistema d'acqua, un sistema di rilievo).
- Ricontrolla tutti i requisiti dell'utente: prima persona; open world con un mondo vero (ispirazione Zelda / Outer Wilds); stile grafico scelto (misto fra campiture piatte e pittura a mano); trama avvincente e intricata con missioni sempre diverse; secondarie con svolte; segreti ed easter egg (uno legato a TRAMA); upgrade e build che cambiano il modo di giocare; 11-14 ore di trama e 22-25 complete; pensato nei minimi dettagli.
- Coerenza: la verità nascosta spiega ogni colpo di scena; ogni build ha una via in ogni missione principale; nessuna missione principale ripete il verbo della precedente; i nomi sono gli stessi in tutti i campi.
- Tutto in italiano, concreto e specifico.

## Output
Scrivi concept/mix-finale.json nel formato di ricerca/formato-concept.md (con "key": "mix-finale") PIÙ i campi:
- "dal_mix": ["che cosa viene da Sibilla, dalla Terza Colonna e da Cielo di Terra, e come è adattato"],
- "tagli": ["che cosa è stato tolto o semplificato e perché"],
- "modifiche": ["che cosa hai cambiato rispetto alla versione di partenza e quale giudizio risolve"],
- "scheda_breve": "presentazione per l'utente, 350-450 parole, italiano naturale e scorrevole, senza elenchi; accenna i colpi di scena senza rovinarli",
- "scene_per_immagini": [8 descrizioni IN INGLESE di scene in prima persona per i bozzetti (luoghi chiave, momenti iconici, la meccanica del rilievo matita→colore, l'acqua, il volo col Velo, una scena notturna), ognuna di 60-100 parole, senza volti visibili, con gli oggetti che il giocatore tiene in mano].

## MODALITÀ DI SCRITTURA (obbligatoria)
Non riscrivere tutto nel ragionamento prima di scrivere: entro 5-6 minuti devi aver salvato il primo file.
1. Salva concept/mix-finale.piano.md (massimo 400 parole): versione di partenza, correzioni, innesti.
2. Scrivi in 4 parti (stessi gruppi di campi di ricerca/istruzioni-autori.md, sezione MODALITÀ DI SCRITTURA), salvando ogni parte prima della successiva: concept/mix-finale.parte1.json ... parte4.json. Nella parte4 metti anche "dal_mix", "tagli", "modifiche", "scheda_breve" e "scene_per_immagini".
3. Unisci con python3 in concept/mix-finale.json, verifica che sia valido e cancella le parti.
Come risposta finale scrivi solo il titolo, la frase-hook e le 5 decisioni più importanti.
