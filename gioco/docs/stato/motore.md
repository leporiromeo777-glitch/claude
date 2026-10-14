# Stato del pacchetto: motore

Costruito; la VERIFICA è in corso in parallelo (alcuni dettagli interni possono ancora cambiare: rileggi il codice di src/engine).

**Stato:** done

## Riepilogo

I built the complete "motore" package in /home/user/claude/gioco and committed it in three commits (859b8f5, b41c8b6, 1b1922a). No file outside src/engine/, tools/levels/ and tests/unit/engine/ was touched.

What it contains:
- **src/engine/**: pure TypeScript. It imports only ../core/types, ../core/rng, its own modules and JSON. The public API is exactly ARCHITETTURA 5.2, plus a few helpers.
  - The rules are written once, in model.ts and core.ts, over a compact state (Int32Array, threads as indices, beads as bitmasks). The public API, the solver, the greedy bot and planAutoRow all use that same code.
  - context.ts: reconciliation removes martaNoSotto, teresaLegge and the Teresa–Marta rancour; pieroTrabocca stays.
  - state.ts: initialState, cloneState, stateKey, sameLace.
  - rules.ts: blocked, forcedCrossings, checkCrossing, previewRow, applyRow (normative order of GDD 3.4), unreachablePins.
  - conditions.ts: all conditions of GDD 3.12, including nonIncontra with '*' and an hour range, esceCon, parte, resta, sano, incontriAlmeno, and the combinators tutti, almeno, non. The same atoms with state bits serve the solver and evaluate(). Reports carry soddisfatta, in_corso, a_rischio or fallita, with reasonKey and params.
  - solver.ts and moves.ts: layered dynamic programming over the state.
    - The key is the Lehmer code of the permutation plus only the relevant bits: exact if it fits in 52 bits, otherwise a 52-bit hash checked for equality.
    - Verso is enumerated only when it matters. Pruning uses the pin lower bound, unreachable pins and conditions that can no longer be met.
    - It supports countOptimal (capped at 50), the minIncroci and maxQuiete objectives, restarting from mid-night, and maxStates (400000 in Node, 60000 in the browser).
  - solver.worker.ts and solver-client.ts: solveAsync(req, signal?) and generateAsync(spec, signal?) run in a Web Worker created with `new Worker(new URL(...), {type:'module'})`, can be cancelled with an AbortSignal, and fall back to the synchronous path in Node.
  - autoweave.ts: planAutoRow as in GDD 3.10, covering targets, slack, which threads give way, greedy ordering, verso and the controlled thread. The same code moves the black thread.
  - hints.ts: spinta, indizio and fantasma derived from the solution.
  - metrics.ts, spartito.ts (ARCHITETTURA 14.6; the GDD example `TRAMA1-G20261014-b._.ad.c-7k` decodes as valid).
  - generator.ts, daily.ts, bot.ts: GDD 8.3–8.4, quality filter, grades. data/daily-fallback.json holds 60 checked seeds for the 7 rules.
  - Extras: simulate.ts, hash.ts (sourceHash), memoria.ts (memoriaAfterDay, GDD 3.11), keys.ts (the engine's i18n keys).
  - register.ts registers __GAME__.engine with level, solve, computed, daily, generate, encode and decode, plus fixture and version.
- **Fixtures** (src/engine/fixtures):
  - g00.json is ARCHITETTURA 14.1 verbatim. g06.json follows GDD 3.16, with notes.fixtures.json and campaign.json.
  - Synthetic levels: test-grande (6×14), test-motivi (12 threads and 12 patterns), test-nero, test-marea, test-febbre, test-rancore, test-trabocca, test-bordi, test-occasioni (with occasionsSolution), test-seppia (controlled thread), test-archivio.
  - Every fixture has its .computed.json.
- **tools/levels**:
  - check.ts (npm run levels:check): accepts `--dir`, also via npm_config_dir, `--report`, `--only`, `--no-write` and `--voluta lvl:a+b`. It checks the base, every note alone and every combination of `pins` notes, where impossible combinations must be marked voluta. It also checks matassa ≥ the designated minimum, archives (recorded lace replays and every hole can be mended) and occasions (subsets → occasionsSolution and occasionsSolutions between 1 and 20). It writes `<id>.computed.json` with sourceHash and SOLVER_VERSION and exits 1 on errors.
  - report.ts prints the table, including states and max states.
  - daily-fallback.ts generates or verifies the fallback seeds.

Verified results:
- Prologue: 4 crossings, optimalCount 3.
- g06: base 0, N1 5, N1+N2 5, N2+N3 0, N1+N3 impossible. The GDD's own solution table replays exactly; matassa 8.
- 6×14 case at matassa = minimum + 2: about 0.3 s (14,433 states), about 0.3 s in the Worker too.
- 30 dates from 2026-10-14: each generated in ≤ 250 ms, all passing the filter without the fallback.
- In Chromium, solveAsync and generateAsync really run in a Worker and AbortSignal works; __GAME__.engine is registered.
- The solver worker bundle is 54.8 KB raw, 18.8 KB gzip.

## Decisioni prese

- Gino corre: the 'possible crossing' check follows GDD 3.6 literally (not blocked and a free neighbour). A free neighbour is not blocked, not in a forced crossing, and allowed by quirks in at least one verso. Matassa does not count. With the matassa finished, Gino's row is refused ('corre') and must be undone. This way more matassa never forces more crossings and the dynamic programming stays exact.
- Verso enumerated 'only when it matters' in the solver, and therefore in countOptimal: when one of the two threads holds a tracked transferable bead (letter in transit or secret), the well is overflowing, a verso quirk applies (Teresa/Marta pair; the well when letters or secrets are tracked; Nina with tracked secrets; Lunardi with tracked fever and a sick partner), or a `sopra` condition covers the pair. Otherwise the left verso, or the only allowed one, is used.
- Metrics and spartito: quiete = rows without player crossings. Simmetria needs at least one crossing and compares only player crossings (pair i ↔ W-2-i, verso ignored). Forced crossings (black thread, autoweave) are excluded everywhere.
- A rejected applyRow returns the starting state unchanged with events []. previewRow applies the valid draft crossings and reports the invalid ones. Draft crossings marked forced:true are ignored and recomputed: repeating a forced crossing with the same verso is accepted, a different verso gives 'forzato', and touching the black thread gives 'forzato'. An out-of-range pair gives 'disgiunto'. After the last hour the key is tombolo.violazione.finita.
- Edges: side 'molo' = first column, 'faro' = last column. Anonymous entries use the level's spare lino threads in order, then a synthesised 'lino<N>' (deterministic, independent of moves). A named entry for a thread already on the board skips the event. An edge in a flooded column is skipped ('nessuno entra né esce'). The black thread enters as an edge event (kind 'secca' at the Faro, 'barca' at the Molo) unless an explicit edge brings it in. Tide hours are inclusive.
- The well counts secrets received since its last overflow (starting from the secrets held at the opening). The trabocca event fires at the end of the row when the count reaches 3. At the next crossing from above it gives everything, then resets to 0. pieroTrabocca implies pieroPozzo. Nina does not take from the well even when it overflows. Lunardi is never sick: he is removed from the fever holders at the opening; from above he cures, from below he does not cure and does not catch it. Teresa reads only while on the board.
- Agendas: `follow` is satisfied by crossing the followed thread (at most one per row). `{place,hour}` expires once its hour has passed. `stay` means dir 0 and slack 0 (does not give way). An exhausted agenda means dir 0 and infinite slack (gives way). An occasion counts if liked, not passed and reachable; the earliest one wins over follow and stay, while an agenda place item with an hour ≤ the occasion's hour comes first. The black thread never gives way and its neighbour yields unless blocked or forbidden by a quirk. Agenda pointers are stored in an extra optional field `agenda` on LaceState (EngineLaceState); types.ts is unchanged.
- Autoweave: forcedCrossings for a level with a controlled thread returns the plan with that thread standing still. With applyRow, the draft may contain only the controlled thread's crossing. The Gino rule does not apply in autoweave levels. presetOccasions enter the context automatically through createContext.
- Conditions: ha = held at any hour ≤ by (or at the opening). parte without an hour = off the board at the end. resta = never leaves. presso is decided at its hour. a_rischio = not yet decided, but the bounds (distance in columns, rows left, re-entries) say it can no longer be met. events[i] belongs to the row that leads to timeline[i+1]; the aligned form with events[0] empty is also accepted.
- Solver: exact numeric key using the Lehmer code when the set of threads on the board never changes (no edges, no black thread), base-T digits otherwise; above 52 bits, a numeric hash with equality check. With `from`, rows are recomputed from rowsDone (forced crossings recomputed); SolveResult.rows and incroci cover the whole day. The elapsed time `ms` uses performance.now and does not affect any result.
- levels:check: perNote and combos are computed within level.matassa (null if impossible or over the matassa). If impossible, a second pass with an unbounded matassa finds the true minimum for the messages. The designated combination is the most expensive possible one among base, single notes and pins-combinations not marked voluta. matassaSuggerita = designated + act margin (act 0: 2, which gives g00 6; acts 1–3: balance.json). The voluta mark is kept in the existing computed file and added with --voluta. sourceHash = 64-bit FNV of the normalised JSON of the level + the requests of its notes + pins (levelSourceHash / levelSourceHashFromDB).
- Spartito: the two control characters are FNV-1a(h) % 36 followed by ⌊h/36⌋ % 36 over the whole string before the last '-'. This is the convention that validates the GDD example. The decoder does not check that pairs are disjoint and returns hours 1..n: spartitoRows(level, s) converts them to the real hours.
- Daily and generator:
- The weekday is computed arithmetically.
- Molo and Faro columns are always kept; startHour 6–8; one lino; the cast keeps its quirks (pozzo always).
- Goals are rule-specific plus the common ones from GDD 8.3.
- Minimum ranges: 4 columns 4–9, 5 columns 6–12, 6 columns 8–14, lowered when there are fewer rows (Notte corta). The solver budget per candidate is 30000 states, so the result stays deterministic.
- Fallback: 60 seeds spread across the 7 rules, chosen with dayOfYear among entries with the same rule; for Merletto libero, the first solvable candidate is used (fromFallback true).
- Ids are day-<date> and lib-<seed>[~grades]. 'neroInPiu' when a black thread already exists adds a second target for it to follow.
- The engine has no i18n namespace of its own: its keys (violations, condition reasons, hints, generated levels) live in the 'tombolo' namespace, listed in keys.ts (engineTextKeys) and GEN_KEYS. Parameters carry thread and place ids, which the UI translates into names.
- memoriaAfterDay: 'present in the lace' means on the board in at least one hour of the day. Characters with no memoria value are left unchanged.
- solveAsync takes the AbortSignal as an optional second parameter (and so does generateAsync). Up to two idle workers are reused. In the browser the default is maxStates 60000.

## Problemi noti

- countOptimal counts distinct optimal move sequences using the solver's verso enumeration (enumerated when a tracked transferable bead or a verso quirk is involved). This reproduces the GDD's '3 solutions' for the prologue, but counts can exceed the number of visually different laces; g06 N1 reaches the cap of 50.
- hintFor with no `solution` (or one that does not match the rows already fixed) solves synchronously with 60000 states. On big levels this can block the main thread for up to about 1 s, so the tombolo should first get the solution with solveAsync and pass it in.
- With a loose matassa and pieroTrabocca (which tracks every bead), a 6×14 level takes about 2.2 s in Node via tsx (122k states). With matassa close to the minimum it is under 0.5 s. levels:check uses the level's own matassa and only falls back to the loose solve when a combination is impossible.
- The generator rejects about 95% of candidates (most are unsolvable within the range), but rejected candidates are fast: every date tested finishes in under 250 ms.
- The voluta mark for impossible combinations lives in the .computed.json files (the type contract has no field in LevelDef). If a computed file is deleted, the mark must be added again with --voluta.
- In S mode the spartito reference accepts only [A-Za-z0-9_]: story ids work, but fixture ids containing '-' cannot be encoded in S mode.
- For archives, applyRow counts the replayed recorded rows in usedMatassa. To mend a hole with matassa = original crossings, the tombolo must reset usedMatassa at the start of the hole (levels:check already does this).

## Richieste per altri pacchetti

- **tombolo**: Add to src/i18n/it/tombolo.json and en/tombolo.json the keys the engine produces (engineTextKeys() and GEN_KEYS in src/engine). Suggested texts:
- violazione.rifiuto «No.» / "No."
- faro «Zeno non si allontana dal Faro.» / "Zeno won't stray from the lighthouse."
- corre «Gino non sta fermo!» / "Gino won't keep still!"
- spillo «Spillo d'ottone: {chi} in {luogo} alle {ora}.»
- matassa «La matassa è finita.»
- bloccato «{chi} è fermo in quest'ora.»
- occupato «Quei fili sono già presi dal filo nero.»
- forzato «Quel filo si muove da solo.»
- disgiunto «Un filo incrocia una volta sola per ora.»
- finita «La notte è finita.»
- tombolo.cond.fallita.<presso|maiPresso|incontra|nonIncontra|sopra|consegnata|ha|nonHa|parte|resta|esceCon|sano|incontriAlmeno> and tombolo.cond.rischio.<presso|incontra|sopra|consegnata|ha|parte|esceCon|incontriAlmeno>, with params chi/a/b/perlina/luogo/ora/n.
- tombolo.hint.spinta.spillo/richiesta/generico
- hint.indizio.sopra «Alle {ora} {sopra} deve passare sopra {sotto}.» / indizio.quiete
- hint.fantasma / fantasma.quiete
- hint.impossibile «Da qui non si arriva: disfa qualche ora.»
- tombolo.generato.giornaliero/libero/lettera/voce/segreto/febbre/marinaio
- (optional) the fixture keys tombolo.test.*
Params chi/sopra/sotto/a/b are thread ids and luogo is a PlaceId: translate them into names before calling i18n.t.
- **tombolo**: Using the engine:
- Fixtures are in src/engine/fixtures: g00.json is the prologue; also test-motivi (12 threads), test-archivio, test-occasioni (its .computed.json has occasionsSolution), test-seppia (controlled thread), test-nero, test-grande (6×14).
- The draft passed to applyRow should contain only player crossings; forced crossings are recomputed and come back as events 'incontro'. forcedCrossings(level, state, ctx) gives the dashed preview, and the 'nero' event announces it.
- In controlled mode (fin_seppia), preview the whole row with planAutoRow(level, state, ctx, controlledCrossing).
- For hints, call solveAsync(req, signal) and pass the solution to hintFor; without it hintFor solves synchronously.
- For archives, reset usedMatassa at the start of a hole (`{...state, usedMatassa: 0}`) and compare with sameLace(state, recordedState).
- 'versoSbagliato' can be detected by comparing previewRow with the two versos ('passa' events).
- decodeSpartito returns hours 1..n: use spartitoRows(level, s).
- simulate(level, ctx, rows) rebuilds timeline, events and rows (with forced flags) for Undo, resume and Ripassa.
- **contenuti-atto1**: Run `npm run levels:check` (writes the .computed.json files into src/content/levels).
- To mark an intended impossible combination, run once: `npm run levels:check -- --voluta g06:g06.nina+g06.zeno`. The mark is kept in g06.computed.json; for a single note, use a combination with only that note.
- Set matassa = matassaSuggerita from the computed file. It is the minimum of the designated combination (the most expensive possible one not marked voluta) plus the act margin (act 0: +2, which gives g00 6; act 1: +3 from balance.json).
- Content tests can check sourceHash with levelSourceHashFromDB(db, id) from src/engine (it includes the level, the requests of its notes and pins).
- Rules worth knowing:
  - Gino must cross in every row where he can, even when the matassa runs out;
  - an edge moves whoever is in the first or last column;
  - letters held by threads that enter later (the marinaio) are allowed;
  - a letter already in its recipient's hands at the opening counts as delivered.
- The fixtures g00.json and g06.json in src/engine/fixtures follow ARCHITETTURA 14.1 and GDD 3.16 and verify N1 5, N1+N2 5, N1+N3 impossible.
- **contenuti-atti23**: Same levels:check and --voluta workflow as Act I (act 2 margin +2, act 3 +1; g13 may set matassa = minimum exactly). Rules worth knowing:
- Occasions (fin_aperto, arc6): autoweave.occasionSlots and allowedOccasions; the check enumerates the subsets and requires between 1 and 20 valid ones. An occasion attracts agents whose `likes` match it if it is reachable and its hour has not passed, and it wins over follow and stay.
- Agenda items: follow (satisfied by crossing that thread), {place,hour} (expires), {stay:true} (does not give way). Non-agent threads and lino give way.
- fin_seppia: autoweave.controlled 'ada' plus presetOccasions; the solution goes in base.rows.
- The black thread enters as an edge event (whoever is at that edge leaves), always crosses from above and waits if its neighbour is blocked.
- Edges in flooded columns do not happen.
- The well needs pieroPozzo plus pieroTrabocca to overflow.
- The reconciliation flag is `riconciliate` (true or 'sì').
- **campagna**: Available from src/engine:
- memoriaAfterDay(level, timeline, memoria) for GDD 3.11 (+1 if the character holds the name at the end, −1 if they were in the lace without it, unchanged if absent, clamped 0..3);
- evaluate(level, timeline, events, conds, ctx, final) for the request statuses (soddisfatta, in_corso, a_rischio, fallita);
- createContext(level, flags, {nomeOn, occasions}), which already applies `riconciliate`;
- metrics(level, rows, minIncroci, fantasmaUsed) for elegance, where minIncroci comes from LevelComputed.perNote, combos or base.
- **interfaccia**: Merletto del giorno: dailySpec(date) plus generateAsync(spec, signal) (Worker, about 150 ms) or generate(spec) for synchronous use. Results are deterministic, with level ids day-<AAAA-MM-GG>. Merletto libero: generate({seed, columns 4|5|6, rows, rule, gradi, difficulty}); senzaDisfa and spilliVelati do not change the level and are applied by the UI. For sharing, use encodeSpartito({mode:'G', ref: spartitoRef('G', date), rows}) and metrics(); for import, decodeSpartito then spartitoRows(level, s).
- **fondamenta**: Optional: in the README, mention the levels:check options (`npm run levels:check -- --dir <folder> --report --voluta <level>:<note>+<note>`; `npm run levels:check --dir X` also works through npm_config_dir). Note also that, with no content yet, levels:check exits 0, so `npm run ci` no longer fails at that step.

## Test

- npx vitest run tests/unit/engine → Test Files 11 passed, Tests 272 passed (about 9 s). The files are rules.table (89 tests, 88 of them table cases), rules.api (14), conditions (43), solver (21), autoweave (17), generator (11), spartito (5), check (8), hints and metrics (10), register (7) and purity (54).
- npx vitest run (whole project) → 45 files, 610 passed, 2 skipped.
- npx tsc --noEmit -p . | grep engine/tools/levels → no errors.
- npm run levels:check --dir src/engine/fixtures → exit 0, '13 levels OK'. The committed computed files are rewritten identical (deterministic).
- npm run levels:check --dir <copy without the voluta mark> → exit 1. npx tsx tools/levels/check.ts --dir /nonexistent → exit 1. npm run levels:check with no content yet → exit 0 ('no levels yet').
- npx tsx tools/levels/daily-fallback.ts → 60 seeds written in 4.9 s; --check → '60 seeds OK'.
- Vite build of the solver worker: 54.8 KB minified, 18.8 KB gzip (budget 60 KB).
- Chromium (Playwright 1.56.1) against the dev server on port 5210, closed afterwards, no console errors:
  - solveAsync on g00 → ok, 4 crossings, optimalCount 3, through a Worker;
  - AbortSignal → AbortError after about 50 ms;
  - generateAsync for the daily → 133 ms;
  - the 6×14 case → 295 ms, 14,433 states;
  - __GAME__.engine is registered and daily works in the page.
