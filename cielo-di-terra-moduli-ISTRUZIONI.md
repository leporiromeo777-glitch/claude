# Istruzioni comuni per i moduli paralleli di «Cielo di Terra» (Fase 1)

Contesto: un gioco open world in prima persona nel browser (TypeScript + three.js, WebGL2), ambientato dentro un cilindro rotante (O'Neill) abitato da ticinesi. Il concept completo è in /home/user/claude/idee-gioco/concept/mix-finale.json; lo stile grafico scelto è un misto fra campiture piatte e pittura a mano (riferimenti: /home/user/claude/idee-gioco/pagina/img/finale-1.jpg … finale-8.jpg). Tutti i testi del gioco sono in italiano.

In parallelo lavorano altri agenti:
- il MOTORE crea il progetto in /home/user/claude/cielo-di-terra/ (package.json, src/core, src/world, src/render, src/player, …): non toccare quei file;
- il DESIGN scrive /home/user/claude/cielo-di-terra/docs/design/ e /home/user/claude/cielo-di-terra/content/*.json: puoi leggerli quando ci sono (li stanno scrivendo ora), non modificarli.

Regole:
- Lavora SOLO nella tua cartella /home/user/claude/cielo-di-terra/moduli/<nome>/. È un pacchetto autonomo: un package.json suo (per test e strumenti), node_modules suo (aggiungi un .gitignore con node_modules e dist), sorgenti in src/, test in test/. Il modulo verrà poi spostato in cielo-di-terra/src/<nome>/ dall'integratore, quindi niente dipendenze da file fuori dalla tua cartella e niente percorsi assoluti nel codice.
- TypeScript strict, ES modules. Se usi three.js, usa la versione più recente stabile (verifica con `npm view three version`) e importala come `import * as THREE from 'three'`.
- Non fare commit né push. Commenti e documentazione in italiano.
- Costanti del mondo (identiche al motore): asse Z da 0 (Tappo Sud) a 3000 m (Tappo Nord, il Sordo e la Lanterna); raggio interno R = 646 m; periodo di rotazione 51 s; angolo θ in gradi: Valle 1 «Corbella e le Selve» 0-90, Finestra dei Ponti 90-120, Valle 2 «Il Verbanetto» 120-210 (lago), Finestra 2 210-240, Valle 3 240-330, Finestra 3 330-360; Corbella in Valle 1 intorno a z 900-1200; particelle del catasto di circa 40 m; un giorno di gioco = 40 minuti reali.
- Per le prove visive nel browser: Chromium preinstallato in /opt/pw-browsers (PLAYWRIGHT_BROWSERS_PATH è già impostato; non eseguire `playwright install`; usa @playwright/test o playwright 1.56.1). Per WebGL2 headless servono flag come `--use-angle=swiftshader --enable-unsafe-swiftshader`. Guarda le schermate con lo strumento Read e correggi finché sono belle.
- Lavora a tappe salvando spesso. Alla fine scrivi /home/user/claude/cielo-di-terra/moduli/<nome>/README.md con: che cosa fa il modulo, l'API pubblica esatta (firme TypeScript), come si integra nel gioco, cosa resta da fare. La risposta finale deve riassumere l'API e i risultati dei test.

Formato dei contenuti JSON che il design sta scrivendo (per chi li deve leggere):
- content/luoghi.json: [{ id, nome, z, theta, altezza, descrizione }]
- content/capisaldi.json: [{ id, numero, z, theta, altezza, visibile_da: [id], note }] (più una lista separata per i capisaldi lontani visti di notte)
- content/personaggi.json: [{ id, nome, ruolo, come_appare, voce, posizioni: [{ fase, luogo }] }]
- content/dialoghi.json: { "<id_dialogo>": { personaggio, nodi: [{ id, testo, risposte: [{ testo, vai_a, condizione?, effetti?: ["flag:...", "taccuino:...", "missione:..."] }] }] } }
- content/missioni.json: [{ id, titolo, passi: [{ id, obiettivo_taccuino, attiva_quando, completa_quando, effetti }] }] con condizioni come "flag:nome", "luogo:id raggiunto", "ora:>=20", "cella:id rilevata", "dialogo:id finito" (possono comparire combinazioni: gestisci liste ed espressioni semplici con e/o)
- content/taccuino.json, content/testi.json, content/fade_fase1.json: voci del Taccuino, testi lunghi (lettera di Marta, libretto di Aurelio, cartellini, proverbi), regole notturne delle Fade e stati iniziali delle particelle.
Il formato esatto può avere piccole differenze: leggi i file veri quando esistono e adattati, segnalando le differenze nel README.
