# Stato del pacchetto: motore

Costruito e verificato.

**Stato:** done

## Riepilogo

Il pacchetto "motore" (src/engine/, tools/levels/, tests/unit/engine/) è stato verificato contro la specifica di PACCHETTI.json, GDD 3 (tutta), 8.3-8.5, 14 e ARCHITETTURA 5.2, 14.6, 15.2, 16, 17, leggendo il codice e non il rapporto. Le regole sono state provate con script e con un confronto automatico fra il solver e una ricerca esaustiva (applyRow + evaluate) su oltre 15.000 livelli casuali piccoli (3-6 colonne; stranezze, perline, bordi, marea, rancore, filo nero, autotessitura, condizioni di ogni tipo con combinatori). Il comportamento nel browser (Worker, AbortSignal, `__GAME__.engine`) è stato provato in Chromium con Playwright.

Commit della verifica: d0d7cbf, a9febc2 (più questo rapporto). Commit del costruttore: 859b8f5, b41c8b6, 1b1922a.

### Problemi trovati e corretti

1. **Condizioni sul segreto di lettura** (`ha`/`esceCon` su `letta:<lettera>`): il limite ottimistico del solver (`atomCanOk`) le dava per impossibili finché Teresa non aveva letto, quindi il solver scartava soluzioni valide (diceva "impossibile" dove la ricerca esaustiva trovava 0-3 incroci) e `evaluate` mostrava `a_rischio` a torto. Ora Teresa conta come portatrice possibile finché la lettera è in viaggio (conditions.ts).
2. **levels:check sull'Archivio**: la base si calcolava risolvendo la giornata da zero con la matassa del rammendo (pochi incroci), quindi un merletto d'Archivio con spilli d'ottone dava errore. Ora per l'Archivio: il merletto registrato si riapplica (anche gli obiettivi, se ci sono, devono risultare soddisfatti), ogni strappo si cerca a strati con gli stati uguali fusi (esatto anche per strappi lunghi), `base.incroci` = somma dei rammendi più corti, `base.rows` = merletto registrato (forzati ricalcolati), `matassaSuggerita` = incroci originali negli strappi (GDD 5.3); errore se la matassa è sotto il rammendo più corto, avviso se è diversa dagli incroci originali.
3. **Suggerimenti al limite di stati**: se il solver si fermava al limite (60000 stati) il suggerimento diceva «da qui non si arriva». Ora dà il suggerimento generico (ARCHITETTURA 5.2); «impossibile» solo quando lo è davvero.
4. **Ripartenza del solver** (`from`): la matassa già usata ora è `from.state.usedMatassa` (prima: la somma delle righe rifatte). Uguale nell'uso normale; nel rammendo d'Archivio, dove il tombolo riparte da zero all'inizio dello strappo, ora funziona.
5. **Parametri bilanciabili** (GDD 3.13: "si cambiano senza toccare il codice"): soglia del trabocco e durata del nodo erano costanti (3 e 1). Ora `RunContext` ha i campi facoltativi `traboccoSoglia` e `nodoRighe` (aggiunta non distruttiva in core/types.ts) e `createContext(level, flags, { balance })` li legge da balance.json. Senza `balance` valgono i valori del GDD, quindi niente cambia per chi non li passa. I nodi di più righe hanno maschere in più nello stato compatto e il campo `knots` nello stato pubblico. L'impronta del sorgente cambia solo con valori diversi dal GDD (le impronte attuali restano uguali). levels:check e `__GAME__.engine.solve` passano `db.balance`.
6. **Generatore, ripiego**: se nessuno dei 500 semi passa il filtro (succede spesso nel Merletto libero a 4 colonne), si prendeva il primo candidato risolvibile, spesso banale (minimo 2). Ora si prende quello arrivato più avanti nel filtro (minimo nell'intervallo, poi soluzioni ottime ≤ 12, poi giocatore avido battuto), a parità il primo. Il Merletto del giorno non cambia: usa prima la lista di riserva.
7. **levels:check**: quando il solver arriva al limite di stati l'errore ora lo dice ("could not be verified: solver state limit reached") invece di "impossibile".
8. **Solver con pieroTrabocca**: si tracciavano tutte le perline; ora tutti i segreti (si contano per il trabocco), le lettere con i loro segreti di lettura se Teresa legge, e le perline delle condizioni. Verificato contro la ricerca esaustiva.

### Contenuto e API pubbliche (src/engine/index.ts)

TypeScript puro: importa solo ../core/types, ../core/rng, moduli propri e JSON. Le regole sono scritte una volta sola (model.ts, core.ts) su uno stato compatto (Int32Array) e servono API pubbliche, solver, giocatore avido e autotessitura.

- `createContext(level, flags, opts?: { nomeOn?, occasions?, balance? }) → RunContext`. Con `riconciliate` (true o 'sì') toglie martaNoSotto, teresaLegge e il rancore Teresa-Marta; pieroTrabocca resta. `presetOccasions` entrano da sole. `flagOn(v)`.
- `initialState(level, ctx)`, `cloneState`, `stateKey`, `sameLace` (confronto del rammendo). Tipo `EngineLaceState` = LaceState + `agenda?` (agende dei fili autonomi) + `knots?` (solo con nodi di più righe).
- `blocked`, `forcedCrossings` (riga successiva), `checkCrossing(level, state, draft, c, ctx)`, `previewRow`, `applyRow` (ordine di GDD 3.4; rifiutata → stato invariato, `events: []`), `unreachablePins`.
- `evaluate(level, timeline, events, conds, ctx, final) → CondReport[]` (soddisfatta / in_corso / a_rischio / fallita, con `reasonKey` e `params`).
- `metrics(level, rows, minIncroci, fantasmaUsed)`, `isSymmetric`.
- `solve(req)` sincrono; `solveAsync(req, signal?)` e `generateAsync(spec, signal?)` in un Web Worker (`new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })`), annullabili; in Node ripiegano sul sincrono. `SOLVER_VERSION` = 1, `defaultMaxStates()` (400000 Node, 60000 browser).
- `planAutoRow(level, state, ctx, controlled?)`.
- `hintFor({ level, ctx, timeline, rows, goals, tier, solution? }) → Hint`.
- `generate(spec)`, `dailySpec(date)`, `dailyLevelId`, `weekday`, `dayOfYear`, `nextDate`, `DAILY_RULES`, `minRange`, `GENERATOR_VERSION`, `GEN_KEYS`, `greedyPlay`.
- `encodeSpartito`, `decodeSpartito`, `spartitoRows(level, s)` (ore vere), `spartitoRef(mode, idOrDateOrSeed)`, `GRADO_CODES`.
- `simulate(level, ctx, rows, from?)`, `simulateAndEvaluate`.
- `levelSourceHash`, `levelSourceHashFromDB(db, id)`, `pinsForLevel`, `stableStringify`, `fnv1a32`.
- `engineTextKeys()`, `violationKey`, `conditionKey`, `HINT_KEYS`, `VIOLATION_CODES`.
- `memoriaAfterDay(level, timeline, memoria, opts?)`, `MEMORIA_MIN`, `MEMORIA_MAX`.
- register.ts registra `__GAME__.engine`: `level(id)`, `solve(levelId, noteIds?, opts?)`, `computed(levelId)`, `daily(date)`, `generate(spec)`, `encode(sp)`, `decode(str)`, più `fixture(name)` e `version()`.
- Fixture (src/engine/fixtures): g00 (identico ad ARCHITETTURA 14.1), g06 (GDD 3.16, con notes.fixtures.json e campaign.json), test-grande (6×14), test-motivi (12 fili), test-nero, test-marea, test-febbre, test-rancore, test-trabocca, test-bordi, test-occasioni, test-seppia, test-archivio, ognuna con il suo .computed.json.
- tools/levels: `check.ts` (`npm run levels:check`, opzioni `--dir`, anche come `npm run levels:check --dir X`; `--report`, `--only`, `--no-write`, `--voluta lvl:a+b`), `report.ts`, `daily-fallback.ts` (`--check`).

Numeri verificati: prologo 4 incroci e 3 soluzioni ottime; g06 base 0, N1 5, N1+N2 5, N2+N3 0, N1+N3 impossibile (marcata voluta), matassa 8; caso 6×14 a matassa minimo+2 in circa 0,35 s (14-33 mila stati) in Node, 0,65 s nel Worker in sviluppo; Merletto del giorno su 460 date consecutive: al massimo 435 ms, 2 volte la lista di riserva (regola segreto); worker del solver 55 KB minificato, 20 KB gzip.

## Decisioni prese

- (Costruttore, confermate) Gino: "incrocio possibile" = non bloccato e un vicino libero (non bloccato, non in un incrocio forzato, almeno un verso ammesso dalle stranezze), la matassa non conta: a matassa finita la riga di Gino si rifiuta e si disfa. Così più matassa non obbliga mai a più incroci e la programmazione dinamica resta esatta. Un vicino usato dal giocatore in un altro incrocio resta "libero".
- (Costruttore, confermate) Verso enumerato solo quando conta (perline trasferibili tracciate, pozzo che trabocca, Marta e Teresa, pozzo con perline tracciate, Nina con segreti, Lunardi con un malato, condizione `sopra`): il confronto con la ricerca esaustiva lo conferma. `countOptimal` conta le sequenze ottime con questi versi (prologo: 3 come nel GDD).
- (Costruttore) Bordi: 'molo' prima colonna, 'faro' ultima; ingressi anonimi con i lino di riserva del livello, poi `lino<N>` sintetici (ids che non sono in `level.threads`); un bordo in colonna allagata non avviene; un filo con nome già sulla tela non entra (e nessuno esce). Il filo nero entra come evento di bordo.
- (Costruttore) Pozzo: conta i segreti ricevuti dall'ultimo trabocco (partendo da quelli che ha all'apertura); trabocca a fine riga alla soglia; al prossimo incrocio da sopra dà tutto, poi il conteggio torna a zero. Nina non prende dal pozzo. Lunardi non è mai malato.
- (Costruttore) Spartito: controllo = FNV-1a(corpo) % 36 seguito da ⌊h/36⌋ % 36, la convenzione che rende valido l'esempio del GDD. Con 2 caratteri base 36 un carattere alterato sfugge con probabilità circa 1/1296 (limite del formato, non del codice).
- (Verifica) Archivio in levels:check: vedi il punto 2 sopra. `computed.base.rows` di un Archivio è il merletto registrato: è la soluzione da usare per "Ripassa", autoplay e suggerimenti.
- (Verifica) Parametri bilanciabili tramite `RunContext` facoltativo invece di leggere i contenuti dal motore (che resta puro).
- (Verifica) Ripiego del generatore: il candidato arrivato più avanti nel filtro. `GENERATOR_VERSION` resta 1: il Merletto del giorno non cambia e il Merletto libero non era ancora pubblicato.

## Problemi noti

- levels:check usa il contesto senza flag di storia: per una giornata i cui numeri dipendono da un flag (per esempio `riconciliate` dopo g18) i combinati calcolati sono quelli senza flag. Se serve, i contenuti devono scegliere i dati in modo che i numeri valgano per il percorso previsto.
- `matassaSuggerita` usa il margine dell'atto da balance.json: per g13 il GDD vuole +0 (la giornata può avere matassa = minimo, levels:check lo accetta).
- Giornate grandi con pieroTrabocca: g16 dei contenuti (6×12, molti segreti) fa 11 risoluzioni in circa 4,2 s in tutto con levels:check (ogni risoluzione ≤ 0,7 s). Il budget di 3 s vale per risoluzione, non per tutte le combinazioni.
- `hintFor` senza `solution` (o con una che non combacia con le righe fissate) risolve in modo sincrono fino a 60000 stati: sul thread principale può bloccare fino a circa 1 s. Il tombolo deve prima ottenere la soluzione con `solveAsync` e passarla.
- Merletto libero: con 4 colonne molte regole non passano il filtro e si usa il ripiego (segnalato con `fromFallback`); certi semi a 6 colonne con la regola segreto arrivano a circa 2 s (nel Worker).

## Richieste per altri pacchetti

- **tombolo**: aggiungere a src/i18n/it|en/tombolo.json le chiavi prodotte dal motore: `engineTextKeys()` e `GEN_KEYS` (violazioni `tombolo.violazione.*`, motivi `tombolo.cond.fallita.*` e `tombolo.cond.rischio.*`, suggerimenti `tombolo.hint.*`, titoli e perline dei livelli generati `tombolo.generato.*`). I parametri `chi`, `sopra`, `sotto`, `a`, `b` sono id di fili e `luogo` è un PlaceId: tradurli in nomi prima di `i18n.t`.
- **tombolo**: creare il contesto con `createContext(level, flags, { nomeOn, occasions, balance: db.balance })`. Per i suggerimenti chiamare `solveAsync` e passare la soluzione a `hintFor`. Nell'Archivio: azzerare `usedMatassa` all'inizio dello strappo e confrontare con `sameLace`; per i suggerimenti passare `solution = computed.base.rows` (il merletto registrato). Ids `lino<N>` che non sono in `level.threads` sono lino entrati da un bordo anonimo. In fin_seppia l'anteprima della riga è `planAutoRow(level, state, ctx, mossaControllata)`.
- **campagna**: passare `balance: db.balance` a `createContext`; `memoriaAfterDay(level, timeline, memoria, { min, max })` con i valori di balance.memoria; `evaluate` per lo stato delle richieste.
- **interfaccia**: Merletto del giorno con `dailySpec(date)` + `generateAsync(spec, signal)`; Merletto libero con semi in base 36 (`[0-9a-z]`), perché lo spartito in modo L porta il seme così (`spartitoRef('L', seme)`).
- **contenuti-atto1, contenuti-atti23**: `npm run levels:check` (scrive i .computed.json); combinazioni impossibili volute con `npm run levels:check -- --voluta <livello>:<nota>+<nota>`. Per l'Archivio: matassa = incroci originali negli strappi; la base riportata è il rammendo più corto.

## Test

- `npx vitest run tests/unit/engine` → 12 file, 285 test verdi (circa 9 s). Nuovo verifica.test.ts: solver contro ricerca esaustiva su 180 livelli casuali (un terzo con trabocco a 2 e nodi di 2 righe) con ogni soluzione rigiocata e valutata; regressioni su `letta:`, suggerimento al limite di stati, ripartenza con `usedMatassa` dello stato, ripiego del generatore, parametri di balance.json, Archivio in levels:check.
- Fuzz più ampio fuori dai test (script nello scratchpad): oltre 15.000 livelli casuali da 3 a 6 colonne, nessuna differenza fra solver e ricerca esaustiva dopo le correzioni (prima: 3 differenze, tutte da `letta:`).
- `npx tsc --noEmit -p .` → nessun errore in tutto il progetto.
- `npm run levels:check --dir src/engine/fixtures` → 13 livelli OK, exit 0; un livello irrisolvibile → exit 1. Su src/content/levels (contenuti degli Atti II in corso, senza scrivere) il controllo gira e segnala solo combinazioni da marcare.
- `npx tsx tools/levels/daily-fallback.ts --check` → 60 semi OK.
- Chromium (Playwright 1.56.1), server di sviluppo sulla porta 5215 poi chiuso: `__GAME__.engine` presente con tutte le funzioni di ARCHITETTURA 15.1; solve g00 4 incroci e 3 ottime, g06 N1+N2 5 e N1+N3 impossibile; daily 2026-10-14; `solveAsync` e `generateAsync` girano davvero in un Worker (`solver.worker.ts?worker_file&type=module`); `AbortSignal` → AbortError; `hintFor` con la soluzione del Worker; nessun errore in console.
- Bundle del worker (esbuild, minificato): 55 KB, 20 KB gzip.
