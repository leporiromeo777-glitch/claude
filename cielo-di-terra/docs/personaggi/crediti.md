# Crediti Higgsfield spesi per i personaggi

Tetto per tutto il lavoro sui personaggi: **50 crediti**. Saldo all'inizio del pilota: **76,97**.
Ogni spesa si annota qui, con il saldo letto da `balance` subito prima.

| data | fase | che cosa | modello e parametri | job | crediti | saldo prima |
|---|---|---|---|---|---|---|
| 2026-10-15 | pilota | Togna, 2 immagini sorgente (stesso prompt) | `gpt_image_2_5`, quality medium, 1k, 2:3, count 2 | `7d9b3458…` (a), `5f3f4513…` (b, scelta) | 1 | 76,97 |
| 2026-10-15 | pilota | Togna in 3D da (b) | `sam_3_3d`, prompt «the woman», GLB testurizzato | `c77836ee…` | 1 | 75,97 |
| 2026-10-15 | pilota | Togna in 3D da (b) | `tripo_h3_1_image_to_3d`, face_limit 12000, texture standard, pbr false, orientation align_image | `331c2553…` | 9 | 75,97 |
| 2026-10-15 | pilota (prova del rischio «volto scoperto con sam») | Nando, 2 immagini sorgente | `gpt_image_2_5`, quality medium, 1k, 2:3, count 2 | `02ae0a08…` (a, scelta), `3a8fe63b…` (b) | 1 | 65,97 |
| 2026-10-15 | pilota | Nando in 3D da (a) | `sam_3_3d`, prompt «the man» | `e8270b86…` | 1 | 64,97 |
| 2026-10-15 | produzione (sessione interrotta, ricostruita dalle transazioni) | Bortolo, 2 immagini sorgente con Togna come riferimento di stile | `gpt_image_2_5`, quality medium, 1k, 2:3, count 2, `medias: [{1918f415… (togna-sorgente.jpg caricata), image_references}]` | `42643337…` (a), `aac0b40d…` (b) | 1 | 63,97 |
| 2026-10-15 | produzione | 11 coppie di immagini sorgente (ottavio, nando rifatto con VOLTO, pina, annunciata, clelia, lisa, gioanin, velata_donna, velato_gerla, velato_maschera, velato_cappuccio), stesso riferimento di stile | `gpt_image_2_5`, quality medium, 1k, 2:3, count 2 ciascuna | elenco in `tools/personaggi/produzione.json` | 11 | 62,97 |
| 2026-10-15 | produzione | Ottavio in 3D dalla variante (a) | `tripo_h3_1_image_to_3d`, face_limit 12000, texture standard, pbr false, orientation align_image | `7e9e85c5…` | 9 | 51,97 |
| 2026-10-15 | produzione | 11 conversioni 3D (bortolo, nando, pina, annunciata, clelia, lisa, gioanin, velata_donna, velato_gerla, velato_maschera, velato_cappuccio) | `sam_3_3d`, GLB testurizzato, prompt per figura (`produzione.json`) | `produzione.json` | 11 − 1 rimborsato = 10 | 51,97 |
| 2026-10-15 | produzione | Gioanin, nuovo tentativo (il primo `sam_3_3d` è fallito ed è stato rimborsato) | `sam_3_3d`, prompt «the child» | `1dd5394c…` | 1 | 32,97 |

Preventivi verificati con `get_cost` (non spesi): `tripo_p2_image_to_3d` 34 crediti (anche con texture «fast»), `meshy_v7_image_to_3d` lowpoly testurizzato 38. Fuori portata.
Nota: `count: 2` di `gpt_image_2_5` a qualità media costa 1 credito in tutto (0,5 a immagine).

**Totale del pilota: 13 crediti** (saldo 76,97 → 63,97, letto dopo l'ultima spesa). Restano 37 crediti sotto il tetto di 50.
Piano per gli altri 11 modelli (PIPELINE.md): 11 coppie di immagini (11) + 10 `sam_3_3d` (10) + Ottavio con `tripo_h3_1_image_to_3d` (9) = 30, cioè 43 su 50; margine 7 per rifare Nando con la frase VOLTO e per qualche ritiro di sam con un altro `seed`.

**Produzione: 32 crediti** (saldo 63,97 → 31,97, letto con `balance` dopo l'ultima spesa): 1 (immagini di Bortolo, della sessione interrotta) + 11 (immagini degli altri 11) + 9 (tripo per Ottavio) + 10 (sam: 11 lanci, uno fallito e rimborsato) + 1 (secondo sam di Gioanin). A parte il secondo tentativo per Gioanin non è servito rifare niente: tutte le 24 immagini erano usabili e i 12 modelli 3D anche.

**Totale personaggi: 45 crediti su 50** (pilota 13 + produzione 32). Restano 5 crediti sotto il tetto, non spesi.

**Revisione finale (ramo `personaggi/finale`): 0 crediti.** Tutto il lavoro (pipeline rifatta sui 13 GLB grezzi già scaricati, animatore, materiale, oggetti, prove) gira in locale. Tre generici velati nuovi per la folla costerebbero circa 4,5 crediti (3 coppie di immagini e 3 `sam_3_3d`): non fatti, la ripetizione si è risolta con le varianti per regione (INTEGRAZIONE.md, voce 9). Totale personaggi: 45 su 50.
