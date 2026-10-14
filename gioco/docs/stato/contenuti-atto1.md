# Stato del pacchetto: contenuti-atto1

**Stato:** in corso (dati comuni già committati; livelli dell'Atto I in lavorazione)

## Convenzioni dei dati comuni (per contenuti-atti23, campagna, interfaccia)

- `characters.json`: 16 personaggi (ARCHITETTURA 4), chiavi `comune.pers.<id>.nome|nomeCompleto|ruolo|desiderio`.
  I 5 personaggi solo d'Archivio hanno `archiveOnly: true`.
- `places.json`: chiavi `comune.luogo.<id>.nome|breve|descrizione`; `diorama` = `dio/<id>` (la luce si aggiunge: `dio/<id>/<alba|giorno|notte>`).
  C'è anche `comune.luogo.stanza.*` per la stanza di Ada (non è un PlaceId).
- Etichette dei fili di lino riusabili da tutti i livelli: `comune.fili.<passante|marinaio|pescatore|barcaiolo|comare|garzone|forestiero|avorio|sbiadito>`.
- `campaign.json`: g00-g23 nell'ordine del GDD 5.2, `pins` 0 / 2 (Atti I-II) / 3 (Atto III) / 1 (g23, la scelta),
  `stonatura` 1 / 0,6 / 0,25, `archiveAfter` (arc1 g03, arc2 g07, arc3 g11, arc4 g14, arc5 g18, arc6 g20),
  `objectAfter` secondo GDD 5.6.
- **Oggetti della sera** (`objectAfter`): se l'id coincide con l'id di una `LetterDef` (`lettere.*.json`), l'oggetto è quella lettera.
  Id delle lettere: `lettera_L1` … `lettera_L11` (L1-L7 in `lettere.atto1.json`, L8-L11 in `lettere.atto23.json`, `arrivesAfter` g10, g11, g12, g13),
  `lettera_clotilde` (g14, firmata `C.`), `biglietto_livia_1` … `biglietto_livia_6` (g17-g22, firmati `L.`).
  Gli altri oggetti hanno i testi in `comune.oggetti.<id>.nome|descrizione`: `merletto_avorio`, `libro_punti`, `bottiglia`,
  `fuso_faro`, `pagina_strappata`, `bottiglia_nodo_nero`, `fascio_lettere`, `nastro_nonna`.
- **Domande del Taccuino** (`QuestionId`, GDD 5.8), testo in `comune.domande.<id>.titolo`:
  `avorio`, `martaTeresa`, `chiL`, `filoNero`, `pozzo`, `anno1958`, `madre`, `puntoAperto`, `desideri`.
- `book.json`: 14 pagine (GDD 5.7), id `incrocio, spillo, sopraDa, voce, matassa, molo, segreto, pozzo, febbre, nodo, nome, nero, marea, puntoAperto`.
  La pagina `pozzo` usa `rule: 'segreto'` (il pozzo non è una RuleId). Le note a margine delle pagine `nome` e `nero` sono di Ada (a matita), le altre di Clotilde.
  Sblocco: `{ any: [ { knows: 'rule', id }, { done: <giornata precedente> } ] }`.
- `lines.json`: 9 personaggi parlanti (gli 8 del cast + Livia) × 7 eventi × 2 + 4 di riserva = 162 battute.
  I 7 eventi del GDD 5.9 sono mappati sui `LaceEventKind`: incontro → `incontro`, consegna → `consegna`, voce → `copia`,
  segreto letto → `legge`, rifiuto → `stranezza`, nodo → `nodo`, cura → `cura`; più `riserva`.
  Chiavi `comune.battute.<pers>.<evento>.<n>`, variante per chi ha dimenticato Ada `…<n>d` (`forgetKey`).
- Titoli degli atti: `comune.atti.<0-3>.titolo|sottotitolo`. Crediti: `comune.crediti.*` (autore segnaposto).
