# Istruzioni per le giurie del MIX

Cartella base: /tmp/claude-0/-home-user-claude/2d1b03fc-1fa7-5f01-bd16-e8d21334f915/scratchpad/

Devi confrontare DUE versioni del concept definitivo: concept/mix-a.json e concept/mix-b.json. Entrambe mescolano tre concept (Sibilla, La Terza Colonna, Cielo di Terra) con Cielo di Terra come base, come ha chiesto l'utente. Leggi prima ricerca/istruzioni-mix.md (la decisione dell'utente, lo stile grafico scelto, i tetti di scope), ricerca/richiesta.md, ricerca/design.md, ricerca/tecnica.md, e poi le due versioni per intero. Per capire da dove vengono, puoi consultare concept/cielo-v2.json, concept/sibilla-v2.json, concept/colapesce-v2.json.

Le giurie sono tre (tu sei una sola, indicata nel compito):
- **critica**: trama (avvincente? colpi di scena che reggono? verità nascosta coerente che spiega tutto?), mondo, originalità, varietà delle missioni, segreti, scrittura, personaggi. Severa con cliché, incoerenze e innesti incollati che non hanno ragione d'essere nel cilindro.
- **produzione**: fattibilità con lo stack reale (three.js nel browser, niente artisti, asset procedurali, niente volti realistici, lo stile grafico scelto), volume di contenuti, rispetto dei tetti di scope, rischi tecnici (mondo curvo, acqua, rilievo, gravità variabile), testabilità. Proponi tagli che non uccidono l'idea.
- **giocatore**: divertimento minuto per minuto, forza delle build, ritmo, durata, hook, e quanto l'utente sarebbe soddisfatto rispetto a ciò che ha chiesto (Cielo di Terra come base + i pezzi migliori degli altri due).

Scala fissa 1-10 (10 = livello di Outer Wilds o Breath of the Wild; 8 = indie premiato; 5 = nella media). Criteri: originalita, mondo, trama, missioni, build, segreti, divertimento, fattibilita, mercato.

## Formato del file di output (JSON valido, italiano)
{
  "giuria": "<critica|produzione|giocatore>",
  "valutazioni": {
    "mix-a": { "punteggi": {…9 criteri…}, "punti_forti": ["..."], "problemi": ["..."] },
    "mix-b": { "punteggi": {…9 criteri…}, "punti_forti": ["..."], "problemi": ["..."] }
  },
  "preferito": "mix-a oppure mix-b",
  "perche": "2-4 frasi",
  "innesti": ["idee della versione NON preferita da portare nella preferita, concrete"],
  "correzioni": ["correzioni concrete per la versione preferita, le più importanti per prime"]
}
Verifica che il JSON sia valido con python3. Lavora in modo diretto, senza ricerche web; salva entro 12-15 minuti. Come risposta finale scrivi solo il preferito, le due medie e il perché.
