# Formato del file del concept (JSON, UTF-8, tutto in italiano)

Scrivi un oggetto JSON valido con ESATTAMENTE questi campi (controlla che il file si legga con `python3 -c "import json,sys; json.load(open(sys.argv[1]))" FILE`):

{
  "key": "<chiave assegnata>",
  "titolo": "...",
  "sottotitolo": "...",
  "frase": "hook in una frase sola, da copertina",
  "ambientazione": "luogo, epoca, atmosfera, landmark centrale visibile da ovunque, dimensioni e struttura del mondo",
  "zone": [ { "nome": "...", "descrizione": "...", "novita": "verbo, pericolo o regola nuova che la zona introduce" } ],
  "direzione_artistica": "palette, luce, meteo, materiali; perché è semi-realistico e fattibile",
  "protagonista": "...",
  "personaggi": [ { "nome": "...", "ruolo": "...", "segreto": "...", "come_appare": "come lo vediamo senza volti realistici" } ],
  "verita_nascosta": "bibbia della verità: cosa è successo davvero, in ordine cronologico",
  "trama": {
    "premessa": "...", "atto1": "...", "svolta_centrale": "...", "atto2": "...", "atto3": "...",
    "colpi_di_scena": ["..."], "finali": ["..."]
  },
  "come_si_gioca": {
    "verbi": "...", "loop_minuto": "...", "loop_sessione": "...", "traversata": "...",
    "sfida_e_combattimento": "...", "navigazione_e_diario": "..."
  },
  "build": {
    "sistema": "...",
    "rami": [ { "nome": "...", "filosofia": "...", "abilita": ["..."] } ],
    "scelte_esclusive": "...", "costo_nel_mondo": "...", "tre_build_esempio": ["..."]
  },
  "missioni_principali": [ { "nome": "...", "tipo": "...", "descrizione": "..." } ],
  "missioni_secondarie": [ { "nome": "...", "tipo": "...", "descrizione": "...", "svolta": "..." } ],
  "segreti": [ { "livello": 1, "descrizione": "..." } ],
  "finale_segreto": "...",
  "easter_egg": ["..."],
  "durata": "...",
  "fattibilita": "come rispetta i limiti tecnici (persone, animazioni, asset procedurali, prestazioni) e cosa costa produrlo",
  "perche_funziona": ["..."],
  "rischi": ["..."]
}
