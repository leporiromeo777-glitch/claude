# Richieste tra pacchetti (raccolte dall'orchestratore)

Ogni sezione elenca le richieste arrivate a un pacchetto dagli altri, in ordine cronologico. Alcune possono essere già state soddisfatte nel frattempo: controlla SEMPRE il codice attuale prima di agire. Ci sono quasi-duplicati (costruttore e verificatore ripetono spesso la stessa richiesta).


## Per: asset-blender

- (da build:fondamenta) La scena boot chiede esattamente EXPECTED_FRAMES/EXPECTED_IMAGES di src/core/assets.ts: fuso/{teresa,marta,piero,gino,bepi,nina,zeno,lunardi,livia,ada,clotilde,lino,stile_1,stile_2}, fig/{teresa,marta,piero,gino,bepi,nina,zeno,lunardi,livia,ada,lino}/{ferma,porge,saluta} (niente figurine di Clotilde), fig/ada/{ferma,porge,saluta}_grezza, obj/{tombolo,bottiglia,forbici,libro,fuso_faro,fascio_lettere}, dio/{7 luoghi}/{alba,giorno,notte}, tab/{sedia_vuota,tempesta,secca,sacrestia_lettere}. Nel manifest i percorsi (atlases[].image, images[].src) sono relativi a public/assets/; le immagini singole hanno group 'dio' o 'tab', gli atlas sono il gruppo 'core'. La presenza del manifest si legge alla build (o all'avvio del dev server): dopo averlo generato bisogna rifare la build. Se volete public/icons/favicon.png come favicon, chiedete a fondamenta di collegarlo in index.html (oggi c'è un SVG inline per non avere 404).
- (da build:piattaforma-nativa) Una grafica in evidenza per Google Play: 1024×500, PNG o JPEG senza trasparenza (per esempio assets/feature-graphic.png), con il tombolo e il titolo «Trama». È obbligatoria nella scheda dello store.
- (da verifica:piattaforma-nativa) Una grafica in evidenza per Google Play, per esempio assets/feature-graphic.png: 1024×500, PNG o JPEG senza trasparenza, con il tombolo e il titolo «Trama». È obbligatoria nella scheda dello store.

## Per: audio

- (da build:fondamenta) Chiamare registerAudio(engine) da src/audio/register.ts (export function register(services)). Il core chiama engine.unlock() in modo sincrono a ogni pointerdown, pointerup e keydown finché engine.state() !== 'running': unlock() deve essere idempotente e deve riprendere un contesto sospeso. L'evento 'audio:unlocked' lo emette già il core (una volta): non riemetterlo. Le didascalie 'audio:caption' le mostra il core in basso a sinistra se settings.captions è attivo.
- (da verifica:fondamenta) The core sends 'audio:unlocked' once per engine: if the first tap arrives before registerAudio(), the real engine receives its own event on the first gesture after registration. The core calls unlock() synchronously on every pointerdown, pointerup and keydown while state() !== 'running', so unlock() must be idempotent and must resume a suspended context.
- (da verifica:interfaccia) GDD 9 asks for «Laguna e orologio che ticchetta» on the title. The 'laguna' ambience has no clock (only 'notte' has one). Please add an option such as setAmbience('laguna', { clock: true }) or a title ambience with the clock. The title will switch to it.

## Per: campagna

- (da build:audio) Call services.audio directly for:
- setMusic per phase: 'sera' with {seed: levelId, notes: the day's characters}, 'alba', 'archivio', 'finale' (stonatura is computed automatically).
- setAmbience: 'laguna' by day, 'notte' for evening and night, 'pioggia' in Act II, 'tempesta' or 'vento' on g15.
- babble(character, text) for each vignette line; use await .done for auto-advance; music is lowered automatically.
- carillon({beatMs: 380, rows}) at dawn (the lace plays as a music box), for Riascolta, and for the credits (one beat per day).
- sfx('bottiglia') when the lagoon object appears, sfx('carta') when the notes unfold, and the sfx listed in VignetteDef.sfx.
New diary entries already play 'pagina' automatically.
- (da build:motore) Available from src/engine:
- memoriaAfterDay(level, timeline, memoria) for GDD 3.11 (+1 if the character holds the name at the end, −1 if they were in the lace without it, unchanged if absent, clamped 0..3);
- evaluate(level, timeline, events, conds, ctx, final) for the request statuses (soddisfatta, in_corso, a_rischio, fallita);
- createContext(level, flags, {nomeOn, occasions}), which already applies `riconciliate`;
- metrics(level, rows, minIncroci, fantasmaUsed) for elegance, where minIncroci comes from LevelComputed.perNote, combos or base.
- (da verifica:audio) Call services.audio directly for:
- setMusic per phase: 'sera' with {seed: levelId, notes: the day's characters}, 'alba', 'archivio', 'finale'.
- setAmbience: 'laguna', 'notte', 'pioggia' in Act II, 'tempesta' or 'vento' on g15.
- babble(character, text) for each vignette line; do not call it for the 'narratore' speaker (it is silent but takes the line's duration).
- babble('clotilde', text) for Clotilde's archive margin notes (pen sound).
- carillon({beatMs: 380, rows}) at dawn, for Riascolta and for the credits.
- sfx('bottiglia'), sfx('carta') and the sfx listed in VignetteDef.sfx.

Diary entries play 'pagina' automatically. Archive night results (mended) already play successo or fallimento.
- (da verifica:motore) Pass balance: db.balance to createContext. Use memoriaAfterDay(level, timeline, memoria, { min, max }) with the values from balance.memoria, and evaluate for the status of the requests.
- (da build:tombolo) Start nights with scenes.go('tombolo', NightParams). Modes: 'archivio' for arc1-arc5, 'occasioni' for arc6 and fin_aperto, 'controllato' for fin_seppia, 'normale' otherwise; needsNome: true from g12. For 'Continua' mid-night use resumeParams/resumeNight from src/tombolo/index.ts (so scene:enter carries full params, which the audio needs). Listen to night:complete (for Archive it arrives on 'Chiudi il merletto', with archive.named/mended) and night:exit. Panels 'bigliettini' and 'taccuino' are mounted with opts {from:'tombolo', levelId, origin, accepted} (overlay opts carry noteId); during the night activeNight()?.drop(noteId) drops a request and activeNight()?.session.requestStatus() gives live status. Update stats and records from the NightOutcome.
- (da verifica:tombolo) Start nights with scenes.go('tombolo', NightParams). Modes: 'archivio' for arc1-arc5, 'occasioni' for arc6 and fin_aperto, 'controllato' for fin_seppia, 'normale' otherwise; needsNome: true from g12. You can pass campaign flags to archive nights: the tombolo ignores them and always weaves archives with empty flags. For 'Continua' mid-night use resumeParams/resumeNight from src/tombolo/index.ts. Listen to night:complete (for the archive it arrives on 'Chiudi il merletto', with archive.named/mended) and night:exit. Update stats and records from NightOutcome.
- (da build:contenuti-atto1) Use the conventions in docs/stato/contenuti-atto1.md:
- objectAfter equals a LetterDef id when the object is a letter; otherwise the text is in comune.oggetti.<id>.
- Questions are in comune.domande.<id>.titolo.
- Diary entries unlocked by an archive use {done:'arcN'} and are also listed in archive.unlocks.
- Desires unlock through the {desire} effect; the diary entries desiderio.<char> use {knows:'desire'}.
- Dawn vignettes use {ok}, {failed}, {reply}, {accepted}.
- The margin notes on the 'nome' and 'nero' Book pages should be drawn in Ada's hand (pencil); the other pages are in Clotilde's sepia hand.
- (da verifica:contenuti-atto1) Filter level.notes by NoteDef.availableIf. g02 lists g02.marta and g02.martaDura; g03 lists g03.teresa and g03.teresaFredda. The evening must show exactly the 3 available ones. Also:
- show fascio_lettere (objectAfter g16) only if lettereLivia = liberate (GDD 5.6);
- after g00, show the Libro dei Punti (comune.oggetti.libro_punti) as well as merletto_avorio;
- {done:'arcN'} means the archive is completed;
- the margin notes on the 'nome' and 'nero' Book pages are in Ada's hand.
- (da build:contenuti-atti23) (1) Use memoria as it stands at the end of g22 for the g23 choice; g23 and the final levels have no 'nome' rule. (2) done('arcN') must be true when an Archive is mended, and done('fin_chiuso') must be recorded. (3) Show the fascio_1..3 letters and the fascio_lettere object only if flag lettereLivia == 'liberate'. (4) EndingDef.missing: cond is the requirement; show the text when it is false. (5) Show the g23 notes (g23.zeno/g23.piero/g23.livia/g23.clotilde/g23.ada, each with an 'ending' field) in the 'scelta' phase after the g23 night, filtered by availableIf on Zeno's memoria. (6) Choose between the g10 and g18 variant notes with availableIf {done: arc1/arc3}.
- (da verifica:contenuti-atti23) (1) Update memoria and ask for the name (needsNome) only on levels whose rules include 'nome'. g23 and the finals have no 'nome' rule, and the true ending uses memoria at the end of g22. (2) Show the notes with `ending` (g23) in the 'scelta' phase after the g23 night, filtered by availableIf; the evening before the g23 night has no notes. (3) Filter epilogue vignettes by `when`, keeping the file order. (4) Show fascio_1..3 and the fascio_lettere object only if lettereLivia == 'liberate'; LetterDef has no condition field. (5) done('arcN') must become true on mending, including arc6, which is mended with occasions. done('fin_chiuso') must be recorded even though the lace is not saved, because it unlocks the 'Il punto di Clotilde' entry. (6) For EndingDef.missing, show the text when `cond` is false.
- (da build:asset-blender) The dawn and evening vignettes can use dio/<place>/<alba|giorno|notte> and tab/{sedia_vuota,tempesta,secca,sacrestia_lettere}. Load them on demand with assets.loadNames before the scene.
- (da build:traduzione-en) Finestra degli oggetti della sera («Alla porta» / «At the door»): a 390×844 il testo delle lettere lunghe (lettera_clotilde, circa 150 parole) esce dal foglio, è inclinato e tagliato a sinistra e in basso, sia in italiano che in inglese. Serve un foglio scorrevole in verticale, con la rotazione solo sul foglio e il testo contenuto. Inoltre src/i18n/en/campaign.json usa «bell-tower clock», mentre comune.json usa «bell tower»: meglio uniformare.
- (da verifica:traduzione-en) Finestra «Alla porta» / «At the door»: a 390×844 la lettera di Clotilde (circa 150 parole) esce dal foglio inclinato ed è tagliata a sinistra e in basso. Serve un foglio che scorre in verticale, con il testo contenuto e la rotazione solo sul foglio.
- (da verifica:traduzione-en) All'alba gli avvisi delle voci nuove del Taccuino (per esempio «Teresa lit up. What did she see?») compaiono sopra il riquadro della prima vignetta e ne coprono il testo per qualche secondo, nel prologo e in g14. Non dipende dalla lingua. Meglio mostrare gli avvisi dopo le vignette, o spostarli in alto durante l'alba.

## Per: contenuti-atti23

- (da build:motore) Same levels:check and --voluta workflow as Act I (act 2 margin +2, act 3 +1; g13 may set matassa = minimum exactly). Rules worth knowing:
- Occasions (fin_aperto, arc6): autoweave.occasionSlots and allowedOccasions; the check enumerates the subsets and requires between 1 and 20 valid ones. An occasion attracts agents whose `likes` match it if it is reachable and its hour has not passed, and it wins over follow and stay.
- Agenda items: follow (satisfied by crossing that thread), {place,hour} (expires), {stay:true} (does not give way). Non-agent threads and lino give way.
- fin_seppia: autoweave.controlled 'ada' plus presetOccasions; the solution goes in base.rows.
- The black thread enters as an edge event (whoever is at that edge leaves), always crosses from above and waits if its neighbour is blocked.
- Edges in flooded columns do not happen.
- The well needs pieroPozzo plus pieroTrabocca to overflow.
- The reconciliation flag is `riconciliate` (true or 'sì').
- (da verifica:motore) Same levels:check and --voluta workflow. Your g09-g16 levels currently get errors only for impossible combinations that are not marked voluta, and for g12.lunardi impossible on its own. For arc3-arc5, matassa equals the original crossings in the holes. A Gino row with no matassa left is refused.
- (da build:contenuti-atto1) Reuse the shared ids and keys:
- Thread labels comune.fili.*.
- Letters lettera_L8 to lettera_L11 with arrivesAfter g10, g11, g12, g13; lettera_clotilde for g14; biglietto_livia_1 to biglietto_livia_6 for g17-g22. campaign.json already references these ids.
- Diary entries desiderio.<char> with unlock {knows:'desire', id}.
- Close the questions still open after Act I (chiL, filoNero, pozzo, desideri) and open madre, anno1958 and puntoAperto, using the same QuestionId.
- (da verifica:contenuti-atto1) Reuse the ids and keys from docs/stato/contenuti-atto1.md (letters lettera_L8-L11, the same QuestionId, comune.fili.*). If an Act II-III note needs a variant depending on what happened before, use the same pattern: complementary availableIf on a flag.
- (da verifica:motore) Optional, documentation only: in docs/stato/contenuti-atti23.md the known issue 'g12.lunardi è segnato voluta' is now resolved, and the Act III pairs listed as 'Conflitti voluti' are marked voluta in the .computed.json files. In tests/unit/content/atto23.test.ts the g12 comment 'non con quella di Teresa, voluta' is out of date: lunardi+teresa now costs 5. To mark a new conflict, marking the pair with `--voluta` is enough; the triples that contain it become voluta automatically.
- (da build:traduzione-en) In src/content/text/it/atto2.json, diario.persone.zeno.lettera: «Zeno ha tenuto per una notte la lettera della nonna per me» contraddice la storia. La lettera gli fu data la notte del prologo e consegnata in g14, e la voce si sblocca con done g14. Proposta: «Zeno ha tenuto per tutto questo tempo la lettera della nonna per me.» L'inglese dice già «all this time».
- (da verifica:traduzione-en) In src/content/text/it/atto2.json, diario.persone.zeno.lettera dice «Zeno ha tenuto per una notte la lettera della nonna per me», ma la voce si sblocca con done: g14 e la lettera gli fu data la notte del prologo. Proposta: «Zeno ha tenuto per tutto questo tempo la lettera della nonna per me.» L'inglese dice già «all this time».

## Per: contenuti-atto1

- (da build:audio) In characters.json, noteHz and voice {pitch, rate, formantShift, noise, lowpass} must match GDD 13.2/13.5. Clotilde must have voice: null; Lino has no note. tests/unit/audio/notes.test.ts checks this as soon as the file exists. campaign.json needs the stonatura of each day: 1 for g00–g08, 0.6 for g09–g16, 0.25 for g17–g23.
- (da build:motore) Run `npm run levels:check` (writes the .computed.json files into src/content/levels).
- To mark an intended impossible combination, run once: `npm run levels:check -- --voluta g06:g06.nina+g06.zeno`. The mark is kept in g06.computed.json; for a single note, use a combination with only that note.
- Set matassa = matassaSuggerita from the computed file. It is the minimum of the designated combination (the most expensive possible one not marked voluta) plus the act margin (act 0: +2, which gives g00 6; act 1: +3 from balance.json).
- Content tests can check sourceHash with levelSourceHashFromDB(db, id) from src/engine (it includes the level, the requests of its notes and pins).
- Rules worth knowing:
  - Gino must cross in every row where he can, even when the matassa runs out;
  - an edge moves whoever is in the first or last column;
  - letters held by threads that enter later (the marinaio) are allowed;
  - a letter already in its recipient's hands at the opening counts as delivered.
- The fixtures g00.json and g06.json in src/engine/fixtures follow ARCHITETTURA 14.1 and GDD 3.16 and verify N1 5, N1+N2 5, N1+N3 impossible.
- (da verifica:audio) In characters.json, noteHz and voice {pitch, rate, formantShift, noise, lowpass} must match GDD 13.2/13.5. Clotilde must have voice: null; Lino has no note. campaign.json needs the stonatura of each day: 1 for g00–g08, 0.6 for g09–g16, 0.25 for g17–g23. tests/unit/audio/notes.test.ts starts checking characters.json as soon as the file exists.
- (da verifica:motore) Run npm run levels:check. Mark intended impossible combinations with `npm run levels:check -- --voluta <level>:<note>+<note>`. For arc1 and arc2, set matassa equal to the original crossings in the holes; the reported base is the shortest mend.
- (da build:contenuti-atti23) Nothing blocking. If English story texts are added for atto1, the same is needed for atto2, atto3 and finali.
- (da verifica:traduzione-en) src/content/text/en/comune.json usa le virgolette dritte "…" in 9 coppie (calls everyone "dear", "the keeper"…), mentre la storia inglese usa le tipografiche “…”. Per coerenza conviene passare anche comune.json alle “ ”.

## Per: contenuti-atto1, contenuti-atti23

- (da build:fondamenta) validateContent (src/content/validate.ts) controlla anche: lettere con holder e to; spilli, bordi, maree e tutorial solo nelle righe giocabili (startHour+1…endHour); al massimo 14 righe; vignette con 0-3 figure, 1-2 righe e x fra 0 e 1; archive.recorded lungo endHour-startHour con hour = startHour+1+i; ogni filo in archive.faded ha una risposta, e la risposta è fra i candidati; i fili con nome senza CharacterId devono avere un labelKey; in condizioni e richieste dei bigliettini fili, perline (anche 'letta:<lettera>', 'nome', 'febbre') e luoghi devono esistere nel livello del giorno; ogni textKey/labelKey/titleKey deve esistere in italiano. Il file del livello deve chiamarsi come il suo id.
- (da verifica:fondamenta) src/content/loader.ts expects these shapes: JSON arrays for characters.json, places.json, book.json, lines.json, endings.json (EndingDef[]), notes.*.json, diary.*.json and lettere.*.json; JSON objects for campaign.json, balance.json, credits.json, levels/<id>.json (LevelDef, file name equal to id) and levels/<id>.computed.json (LevelComputed, levelId equal to the file name). Every vignette needs at least one line (at most 2) and at most 3 figures.

## Per: fondamenta

- (da build:audio) Optional: add to package.json a script "audio:verify": "tsx tests/unit/audio/browser-verify.ts", and list the extra __GAME__.audio functions in the README (documented in the header of src/audio/register.ts).
- (da build:motore) Optional: in the README, mention the levels:check options (`npm run levels:check -- --dir <folder> --report --voluta <level>:<note>+<note>`; `npm run levels:check --dir X` also works through npm_config_dir). Note also that, with no content yet, levels:check exits 0, so `npm run ci` no longer fails at that step.
- (da verifica:audio) Optional: add the script "audio:verify": "tsx tests/unit/audio/browser-verify.ts" to package.json, and list the extra __GAME__.audio functions in the README (they are documented in the header of src/audio/register.ts).
- (da build:tombolo) Optional: add the npm script "tombolo:verify": "tsx tests/unit/tombolo/browser-verify.ts" to package.json.
- (da build:asset-blender) Optional: link public/icons/favicon.png in index.html (<link rel="icon" type="image/png" href="./icons/favicon.png">) in place of the inline SVG. For a web manifest, icons/icon-192.png and icons/icon-512.png exist. assets/logo.png, assets/splash.png and assets/splash-dark.png are ready for npm run assets:native.
- (da verifica:asset-blender) In src/core/boot.scene.ts (assets section), the line `core.boot.asset.segnaposto` ("Placeholders drawn in code are shown instead.") appears even under "No missing assets". Show it only when at least one asset is missing.
- (da verifica:asset-blender) In src/core/placeholders.ts, the spindle placeholder has `ay: 0.05`, but the real frame has `ay: 0.125` (top of the head, where the thread attaches). Setting it to 0.125 makes the thread attach at the same point with and without assets.
- (da verifica:asset-blender) Optional: in index.html, replace the inline SVG favicon with `<link rel="icon" type="image/png" href="./icons/favicon.png">`. For a web manifest, icons/icon-192.png and icons/icon-512.png exist. assets/logo.png, assets/splash.png and assets/splash-dark.png are ready for npm run assets:native.
- (da verifica:motore) Optional: in the README, next to the levels:check options, mention that pairs are also computed (all combinations from 2 to pins), that the report shows the name's thread with @thread, and that `--voluta` on a pair also covers the larger combinations that contain it.
- (da build:interfaccia) Optional: add the npm script "screens:verify": "tsx tests/unit/screens/browser-verify.ts" to package.json.
- (da verifica:interfaccia) On native, platform.share ignores `file`: the Capacitor Share plugin needs a file on disk. To share the lace PNG on Android/iOS, write the blob to the cache (for example with @capacitor/filesystem, not installed yet) and pass `files: [uri]`. Optional: add the npm script "screens:verify": "tsx tests/unit/screens/browser-verify.ts".
- (da build:piattaforma-nativa) Aggiungere `npm run native:check` allo script ci di package.json, o almeno citarlo nel README insieme a un collegamento a docs/STORE.md.
- (da verifica:piattaforma-nativa) Aggiungere `npm run native:check && npm run native:test` allo script ci di package.json: non richiedono SDK né rete. In alternativa, almeno citarli nel README. Nel README conviene anche rimandare a docs/STORE.md 2.3 per la scelta tra Xcode 27 (macOS Tahoe 26.6+) e Xcode 26.3 (macOS Sequoia 15.6+).

## Per: interfaccia

- (da build:audio) On the title screen call services.audio.setMusic('titolo', { stonatura: 0 if the true ending has been seen (save.unlocks.tovaglia), otherwise leave it out }) and setAmbience('laguna'). The volume sliders already reach the engine through settings:change, and moving the effects or master slider plays a ui_tap preview. Button clicks in #ui-root already play ui_tap/ui_indietro, so do not call them yourselves.
- (da build:motore) Merletto del giorno: dailySpec(date) plus generateAsync(spec, signal) (Worker, about 150 ms) or generate(spec) for synchronous use. Results are deterministic, with level ids day-<AAAA-MM-GG>. Merletto libero: generate({seed, columns 4|5|6, rows, rule, gradi, difficulty}); senzaDisfa and spilliVelati do not change the level and are applied by the UI. For sharing, use encodeSpartito({mode:'G', ref: spartitoRef('G', date), rows}) and metrics(); for import, decodeSpartito then spartitoRows(level, s).
- (da verifica:audio) On the title screen call setMusic('titolo', { stonatura: 0 } only if save.unlocks.tovaglia is true, otherwise without stonatura) and setAmbience('laguna'). Buttons in #ui-root already play ui_tap or ui_indietro, and the volume sliders already reach the engine and play a preview.
- (da verifica:motore) Merletto del giorno: dailySpec(date) + generateAsync(spec, signal). For Merletto libero use base-36 seeds ([0-9a-z]), because the mode-L spartito carries the seed as spartitoRef('L', seed).
- (da build:tombolo) Register the 'pausa' overlay: the tombolo opens it with {from:'tombolo', origin, levelId}. 'Ricomincia la notte' = activeNight()?.restart(); 'Torna al titolo' = scenes.go('titolo') (the tombolo saves and emits night:exit). For the free lace, call registerLevelResolver(id → LevelDef) for 'lib-…' ids so a reload can resume. Score import: spartitoParams(str, level) then scenes.go('tombolo', params). Share image: renderLacePng(level, outcome.rows). Listen to night:complete for the giornaliero, libero and spartito origins.
- (da verifica:tombolo) Register the 'pausa' overlay; the tombolo opens it with {from:'tombolo', origin, levelId}. 'Ricomincia la notte' = activeNight()?.restart(), which now closes the open overlays itself. 'Torna al titolo' = scenes.go('titolo'). For the free lace, call registerLevelResolver(id → LevelDef) for 'lib-…' ids. Share image: renderLacePng(level, outcome.rows, params.flags) — pass the night's flags.
- (da build:asset-blender) Figurines are 256² with the anchor at the foot of the base (0.5, 0.92). Archive characters use fig/lino/<pose> with a tint and their own name. Dioramas and tableaux are 1024×768: crop them to 'cover' and keep the central 768×576 area. Load the dio and tab groups with assets.loadNames([...]) or assets.load(['dio']) before showing them, because they are not loaded at boot.
- (da verifica:asset-blender) Figurines are 256² with the anchor at the foot of the base (0.5, 0.92). Archive characters use fig/lino/<pose> with a tint and their own name. Dioramas and tableaux are 1024×768: crop them to 'cover' and keep the central 768×576 area. The dio and tab groups are not loaded at boot, so call assets.loadNames([...]) or assets.load(['dio']) before showing them.
- (da build:campagna) Already aligned: Continua → scenes.go('sera',{cmd:'continua'}), Nuova storia → {cmd:'nuova', confirmed:true}, Pausa → overlay 'taccuino'. The carved spindles stile_5 and stile_6 (daily streaks of 7 days in a row and 30 days in total) remain yours to award.

## Per: motore

- (da build:fondamenta) Usare src/core/rng.ts (rngFromSeed con xmur3 → sfc32 e 15 estrazioni di riscaldamento; shuffle restituisce una copia). Il tsconfig unico include i tipi di Node, quindi tools/levels può importare 'node:fs'; tsx è installato.
- (da build:contenuti-atti23) levels:check should try each nomeOn choice (each thread) on levels with the 'nome' rule, so that g12.lunardi (ha(lunardi, nome)) no longer needs a voluta mark. A second pass on cost would also help. Keep SOLVER_VERSION and the source hash compatible with the committed .computed.json files.
- (da verifica:contenuti-atti23) levels:check should (1) try the nomeOn choices on levels with the 'nome' rule, so g12.lunardi no longer needs voluta, and (2) also compute combinations with fewer than `pins` notes, so Act III pairs are checked against the matassa. That is how g18 slipped through; atto23.test.ts now covers it. Keep SOLVER_VERSION and the source hash compatible with the committed .computed.json files.

## Per: piattaforma-qa

- (da build:fondamenta) playwright.config.ts: E2E_PORT cambia porta (4173 di default), E2E_REUSE=1 riusa un server già avviato (altrimenti si rifà sempre la build con VITE_E2E=1, quindi __GAME__ è sempre attivo). baseURL è 'http://localhost:4173/?debug=1': page.goto('') mantiene la query, page.goto('/') no (ma il debug resta attivo con VITE_E2E). ?lang=en forza la lingua all'avvio. Helper utili in __GAME__.core: openOverlay, closeOverlay, overlays, toast, validate, flush, time.now/ticks, input.tap/drag/action/layers. Locale predefinito dei test: it-IT. Per simulare la safe area basta impostare --safe-area-inset-* su document.documentElement.style (il viewport si aggiorna da solo in circa 50 ms; core.viewport() rilegge subito).
- (da build:audio) For tests/e2e/audio.spec.ts:
- `__GAME__.audio.state()`, `log()` and `mute(on)` are the required API. Log entries look like {id, t, detail}.
- After the first row of the prologue the log contains 'incrocio' (detail 'marta/teresa'), 'ora_fissata' and 'campana' (detail 'ore 6 s=1').
- Extra helpers you can use: stats().prerender.cpuMs, stress(200).peak, verify() (offline render), and interrupt() followed by [data-test="audio-tocca"] for 'Tocca per continuare'.
- tests/unit/audio/browser-verify.ts already does these checks and can serve as a reference.
- (da verifica:audio) For tests/e2e/audio.spec.ts the required API is __GAME__.audio.state(), log() ({id, t, detail?}) and mute(on).

After the first row of the real prologue, the log contains, in this order:
- 'incrocio' (detail 'marta/teresa')
- 'ora_fissata'
- 'campana' (detail 'ore 6 s=1')
- 'segreto' (Teresa reads the letter, GDD 3.15)

Extra helpers: stats().prerender.cpuMs, stress(200).peak, verify(), and interrupt() followed by [data-test="audio-tocca"]. tests/unit/audio/browser-verify.ts is a working reference.
- (da build:tombolo) Use __GAME__.night.start({fixture:'g00'}) to force the engine fixture even when content has the same id. night.layout() gives spindles[i].cx/cy, currentRow, buttons and tokens. For touch drags send Input.dispatchTouchEvent over CDP: Chromium turns it into pointer events of type 'touch'. The text-overflow script should skip .core-sr-only; request-strip tokens are 48 px tall on a 36 px band by design. tests/unit/tombolo/browser-verify.ts (63 checks, env TOMBOLO_VERIFY_PORT / TOMBOLO_VERIFY_URL) is a working reference for the prologue, saving, layout, performance, archive, occasions and score suites.
- (da verifica:tombolo) tests/unit/tombolo/browser-verify.ts (67 checks; TOMBOLO_VERIFY_URL / TOMBOLO_VERIFY_PORT) is a working reference. With several agents editing files the vite dev server reloads pages mid-test, so run e2e against VITE_E2E=1 vite build + vite preview. The text-overflow script should skip .core-sr-only; request-strip tokens are 48 px tall on a 36 px band by design.
- (da build:campagna) Use __GAME__.campaign (documented in docs/stato/campagna.md). Wait for night.state().active before calling night.autoplay(). For long runs use a build with vite preview, not the dev server: the dev server reloads the page whenever another package edits files. Working reference: tests/unit/campaign/browser-verify.ts (CAMPAIGN_VERIFY_PORT, CAMPAIGN_VERIFY_URL, CAMPAIGN_VERIFY_OUT).
- (da build:interfaccia) Use the stable data-test values listed in docs/stato/interfaccia.md (sc-titolo-*, sc-giornaliero-*, sc-libero-*, sc-impostazioni-*, sc-pausa-*, sc-spartito-*, sc-risultato-*). Locked title items have aria-disabled="true", so Playwright tap/click needs { force: true }. __GAME__.ui.press(id) does not wait; answer a confirmation with confirm-ok or confirm-annulla. __GAME__.ui.unlock('all') opens the modes and __GAME__.ui.setToday(date) fixes the daily date. tests/unit/screens/browser-verify.ts (78 checks) is a working reference and contains the layout checker as a reusable JS string. Run e2e against a VITE_E2E=1 build with vite preview, because the dev server reloads the page while other agents edit files.
- (da verifica:interfaccia) Title on first launch: only sc-titolo-nuova, sc-titolo-impostazioni and sc-titolo-crediti are present (no sc-titolo-modi grid). To test the modes, call __GAME__.campaign.newGame() or __GAME__.ui.unlock('all') and then __GAME__.ui.open('titolo').

New data-test values:
- sc-titolo-modi, sc-titolo-piede;
- sc-impostazioni-fuso-<ada|stile_N>;
- sc-risultato-fuso-<stile>;
- sc-libero-messaggio.

The full list is in docs/stato/interfaccia.md. tests/unit/screens/browser-verify.ts (81 checks) is a working reference.
- (da build:piattaforma-nativa) Nella suite layout, salvare anche schermate alle misure degli store (iPhone 6,9" 1320×2868 o 1290×2796, iPad 13" 2064×2752, telefono Android circa 1080×1920) in una cartella dedicata, da usare nelle schede di App Store e Google Play.
- (da verifica:piattaforma-nativa) Nella suite layout, salvare in una cartella dedicata anche schermate alle misure degli store, da usare nelle schede di App Store e Google Play: iPhone 6,9" (1320×2868 o 1290×2796), iPad 13" (2064×2752) e telefono Android (circa 1080×1920).
- (da build:traduzione-en) Nella suite layout con lingua inglese, aggiungere gli screenshot di una vignetta dell'alba e della sera con i bigliettini di una giornata dell'Atto II (per esempio g12 e g14). Ora la storia è tradotta e i testi inglesi sono fino al 30% più lunghi in alcune righe.
- (da verifica:traduzione-en) Nella suite layout in inglese conviene aggiungere gli screenshot dell'alba e della sera di una giornata dell'Atto II (per esempio g14) e della scelta di g23: in alcune righe i testi inglesi sono fino al 30% più lunghi.

## Per: tombolo

- (da build:audio) Audio for crossing, flip, violation, fix hour, undo and night end is automatic from the night:* events: please do not call services.audio for these, or they will play twice. To get the flip sound, emit night:cross again for the same pair with the other side on top. Call services.audio.sfx('fuso_presa') when a bobbin drag starts and sfx('fuso_rilascio') when it is released without a crossing. Pass NightParams (level, flags, mode) as the params of scenes.go('tombolo') so rancor, the prologue clock and replay are detected. To avoid ui_tap on your own buttons, add data-audio-silent to them.
- (da build:motore) Add to src/i18n/it/tombolo.json and en/tombolo.json the keys the engine produces (engineTextKeys() and GEN_KEYS in src/engine). Suggested texts:
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
- (da build:motore) Using the engine:
- Fixtures are in src/engine/fixtures: g00.json is the prologue; also test-motivi (12 threads), test-archivio, test-occasioni (its .computed.json has occasionsSolution), test-seppia (controlled thread), test-nero, test-grande (6×14).
- The draft passed to applyRow should contain only player crossings; forced crossings are recomputed and come back as events 'incontro'. forcedCrossings(level, state, ctx) gives the dashed preview, and the 'nero' event announces it.
- In controlled mode (fin_seppia), preview the whole row with planAutoRow(level, state, ctx, controlledCrossing).
- For hints, call solveAsync(req, signal) and pass the solution to hintFor; without it hintFor solves synchronously.
- For archives, reset usedMatassa at the start of a hole (`{...state, usedMatassa: 0}`) and compare with sameLace(state, recordedState).
- 'versoSbagliato' can be detected by comparing previewRow with the two versos ('passa' events).
- decodeSpartito returns hours 1..n: use spartitoRows(level, s).
- simulate(level, ctx, rows) rebuilds timeline, events and rows (with forced flags) for Undo, resume and Ripassa.
- (da verifica:audio) Crossing, flip, violation, fixed hour, Disfa and end of night sounds are automatic from the night:* events; do not call services.audio for these. To get the flip sound, emit night:cross again for the same pair with the other side on top.

Forced crossings (black thread, autoweave) do not need night:cross: audio plays them from the 'incontro' events in night:row. If you emit night:cross for them anyway, they are treated as already heard and do not play twice.

In 'Lascia accadere' and in replay mode, emit night:row one row at a time, in step with the animation, not all at once.

Call services.audio.sfx('fuso_presa') when a bobbin drag starts and sfx('fuso_rilascio') when it is released without a crossing.

When one of Clotilde's margin notes appears (tutorial 'margine'), call services.audio.babble('clotilde', text): it plays the pen sound (GDD 13.5).

Pass NightParams (level, flags, mode) in scenes.go('tombolo'). Add data-audio-silent to buttons that should not play ui_tap.
- (da verifica:motore) Add the engine's keys to src/i18n/it/tombolo.json and en/tombolo.json: everything returned by engineTextKeys() and GEN_KEYS from src/engine (tombolo.violazione.*, tombolo.cond.fallita.* and tombolo.cond.rischio.*, tombolo.hint.*, tombolo.generato.*). The params chi, sopra, sotto, a and b are thread ids, and luogo is a PlaceId; translate them into names before calling i18n.t.
- (da verifica:motore) Create the context with createContext(level, flags, { nomeOn, occasions, balance: db.balance }). Get the solution with solveAsync and pass it to hintFor. For archives: reset usedMatassa at the start of a hole, compare with sameLace, and pass solution = computed.base.rows (the recorded lace) to hintFor. Thread ids `lino<N>` that are not in level.threads are lino threads that entered from an anonymous edge. For fin_seppia, preview the row with planAutoRow(level, state, ctx, controlledMove).
- (da build:contenuti-atto1) g04 has a mandatory goal (goals: parte(bepi, 7)); show it like the prologue's goal. In g08 the thread 'segreteria' is only the addressee of Nina's application and never enters the lace. New tutorial cases: g01 uses margine with when 'rifiuto' (Gino won't keep still), g02 uses margine with when 'primaOra', and g00 adds pulsa 'disfa' at 8 and pulsa 'taccuino' at 9.
- (da verifica:contenuti-atto1) Optional:
- fire margin steps with when:'rifiuto' also on 'corre' and 'faro' violations, since GDD 3.4 calls them all 'riga rifiutata';
- draw a 'persona' thread with no character (Marta's father in arc1) as a full-width neutral thread, not as a lino, because it receives letters and secrets and the lino look suggests otherwise;
- show g04's mandatory goal parte(bepi,7) like the prologue's goal.
- (da build:contenuti-atti23) Display level goals parte(bepi, 9) in g12 and resta(zeno) in g17. In arc6 the mending is done with occasions (autoweave, 2 slots) and the holes cover the whole day, so the hole UI should not expect crossings.
- (da verifica:contenuti-atti23) (1) arc6 has both `archive` and `autoweave.occasionSlots`. `night.start({level:'arc6'})` picks mode 'archivio', where 'Lascia accadere' (run) does nothing; it only works with mode 'occasioni'. Prefer 'occasioni' when the level has occasionSlots. In that mode archive.mended also stays false even when the goals are met. (2) In arc3, autoplay shows matassa 3/2: it counts the recorded crossing at 11, which is outside the tear (9-10).
- (da build:asset-blender) Draw spindles with drawImage(src, sx, sy, sw, sh, x - w*ax, y - h*ay, w, h), keeping the 96:320 ratio. The anchor (0.5, 0.125) is the top of the head, where the thread starts; draw the character icon above it.
- (da verifica:motore) In controller.autoplay(), when session.needsNome is true, use the `nomeOn` from the computed entry for the accepted set (`perNote[id].nomeOn`, `combos[i].nomeOn`, `base.nomeOn`) if it exists, instead of the first non-lino thread. In g12 with g12.lunardi the first thread is Bepi: 6 crossings instead of 2, so autoplay gets no filo d'oro. Entries with `nomeOn` have no `rows`; precomputed() already returns null for them and the solver runs with the player's actual choice, which is correct.
- (da build:campagna) Optional: night:complete is emitted before NightController.completed is set. The campaign already handles this by checking one tick later, so no change is needed. Just keep the order stable, or set completed before emitting.
- (da verifica:interfaccia) In replay mode the night is never saved, yet controller.finish() and controller.restart() call clearNight() and empty SaveData.night. This erases the story or lace night left half-woven before a score or Ripassa (seen in the browser: lib-mabc123 → null). Please call clearNight only when this.params.mode !== 'replay', or only when the slot belongs to this level. The screens work around it with guardNight/restoreGuardedNight, but the campaign's Ripassa has the same problem.

## Per: tutti

- (da build:fondamenta) Ogni src/<pacchetto>/register.ts va caricato dopo i servizi: esportare register(services) (o default) oppure lavorare al caricamento; usare services solo da lì in poi. Nei test unitari popolare i servizi con installServices({...}) (vedi tests/unit/core/helpers.ts). Nel DOM: #ui-root lascia passare i tocchi, quindi i contenitori che devono ricevere eventi vanno marcati con la classe core-solid (i controlli nativi li ricevono già); mettere il DOM delle scene in services.ui.sceneRoot (CoreUiLayer) o in ui.root; usare data-test stabili e i componenti di src/core/ui/components.ts (textOf si ritraduce da solo al cambio di lingua). Icone di personaggi e luoghi: src/core/ui/glyphs.ts (svgIcon per il DOM, drawGlyph/glyphPath per il canvas). Elenchi degli identificatori a runtime: src/core/ids.ts.
- (da verifica:fondamenta) Do not `await services.scenes.go(...)` inside a scene's enter(): changes are queued and it would block forever. Use `void scenes.go(...)`. In e2e tests, __GAME__.core.time.setSpeed(8) now really runs at 8×.
