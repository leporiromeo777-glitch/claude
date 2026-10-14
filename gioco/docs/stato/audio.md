# Stato del pacchetto: audio

Costruito e verificato.

**Stato:** done

## Riepilogo

I checked the "audio" package against GDD 13 and 14, ARCHITETTURA 4, 5.6, 11, 15 and 16 and the PACCHETTI spec, then fixed what I found. The fixes are in 4 commits: e2c9bf3, f1ccf32, 69d0f9b and f3d59cb. I only touched src/audio/, src/i18n/{it,en}/audio.json and tests/unit/audio/.

**What the builder did well.** The synthesis matches the GDD recipes and the unit tests are meaningful. All 23 checks in browser-verify pass on both the dev server and the production build.

**Bugs I found and fixed:**
1. **Black thread crossings came one row early.** In the engine, the `{k:'nero'}` event only announces the black thread's crossing in the next row (rules.ts, step 8). The audio played a crossing for it straight away, and the real forced crossing never made a sound. Now the announcement is silent. Any `incontro` in the row that was not already heard through `night:cross` plays when the hour is fixed: black thread crossings, and the autoweave rows of fin_seppia, fin_aperto and arc6, which were silent before. Rancour still detunes the lower note. When Disfa reopens the previous row, fixing it again does not repeat its crossings.
2. **Low tide was captioned "[la marea sale]".** The 'secca' edge event now has its own internal recipe (low-pass falling 800→200 Hz) and the caption key `audio.didascalie.secca` in both languages. When the black thread enters from an edge, the sound of the thread leaving that side is suppressed. The black thread is also recognised through `level.nero.thread`.
3. **Replay double-play.** In replay mode, `night:cross` is now ignored, so a replayed crossing is not heard both as wood plus dyad and as the carillon dyad.
4. **Archive result.** An archive night that is not mended now plays fallimento (`outcomeOk`).
5. **Music seed and notes could come from the previous scene.** `scene:enter` arrives after the scene's `enter()`, so `setMusic` called there without seed or notes used the previous scene's context. The engine now has `refreshContext()`, called on every `scene:enter`; it does nothing if nothing changed.
6. **"Tocca per continuare" could lock the game.** If the tap did not bring the context back (a call in progress, or a context closed by the system), the modal overlay stayed forever. Now:
   - `retryFromOverlay()` hides the overlay after 400 ms if audio is still off, and does not show it again until audio has run once more.
   - Any later gesture still resumes audio through `unlock()`.
   - A context in state 'closed' is recreated at the next gesture, with music, ambience and pre-render.
   - The overlay's input handlers are removed in `hide()`; before, two handlers leaked on every interruption.
7. **Smaller fixes:**
   - `duck(true)` requested before unlock now applies at unlock.
   - A speaker who is not a character (for example the narrator) no longer babbles with a broken caption key. The line is silent, but `done` still waits the expected time.
   - Rancour pairs now come from the engine's `createContext`, so thread ids that differ from the character and flags like 1 or 'yes' work.
   - Several violations from one rejected row give a single thud; Marta's «No.» always plays.
   - Drone oscillators now carry their chord role.
   - The overlay background is more opaque, so the text is readable over any scene.

**New tests:**
- tests/unit/audio/integration.test.ts uses the real engine (applyRow) on the g00 and test-nero fixtures. In the prologue, each crossing sounds once, every row has the bell at s=1, Teresa reads the letter at 6 and it is delivered at 7. For the black thread: arrival plays the drone without the low-tide sound, the announcement is silent, and the forced crossing at 9, 10 and 11 plays once each with Livia on top.
- Other test files cover autoweave, low tide, edges, archive result, scene refresh, rancour parity, violation bursts, the overlay giving up, context recreation, the leak, and the narrator.

**Fixture check.** I also ran all the engine fixtures through the automation (bordi, marea, febbre, trabocca, rancore, occasioni, seppia, g06) and the sounds were consistent.

## Decisioni prese

- The GDD decay times (wood 120/60/35/20 ms, music box 1.2 s, bell 4…0.8 s, glass 300 ms) are read as T60, the time to fall 60 dB.
- Short and costly sounds are computed in JavaScript (Float32Array) and played as one AudioBuffer source each. This keeps the 48-source limiter simple and lets the same code run in Node for the tests.
- The end-of-day carillon is not one pre-rendered buffer. It is pre-rendered note buffers scheduled a few hundred ms ahead, so even the carillon of the whole game (credits, Tablecloth) stays under 48 sources.
- '3 colpi di campana per ogni stonatura' means 3 pre-rendered strike variants per stonatura value, used in turn. bell({hour}) plays one 2-second strike; the hour is in the caption.
- Pre-rendered stonatura values: the current day's first, then 1, 0.6, 0.25, 0 and any value in campaign.json. Pre-render also includes the noises, the 11 notes, 8 wood taps and one variant of each gesture sound (WARM_RECIPES); other effects are rendered on first use.
- Stonatura rules: 0 after the true ending (unlocks.tovaglia or endingsSeen includes 'aperto'). Otherwise the day's value from campaign.json; fin_aperto 0, fin_chiuso 1. For levels outside the campaign (archive, daily, free play), the stonatura of the campaign day reached; with no campaign, by act (I: 1, II: 0.6, III: 0.25).
- Volume sliders use a quadratic curve (0.5 ≈ -12 dB). Ambience follows the effects volume, scaled by 0.3, and the music bus is scaled by 2.2 so that the GDD's low gains (0.06/0.08) are audible. The compressor uses knee 6 dB and keeps the browser's automatic makeup gain.
- Music: a bar is 4 beats of 800 ms, so chords rotate every 25.6 s. Titolo has drone plus a bell at each chord change; sera has one note every 1.6 s; alba adds the fifth above and opens the low-pass to 1100 Hz; archivio has no drone, one note every 1.6 s detuned by ±15–35 cents (deterministic); finale uses all character notes in tune. The seed is opts.seed, else level.musicSeed, else the level id.
- Babble: one syllable per vowel group, using the most open vowel; a consonant before every other syllable. Marta has short syllables (duty 0.5), Gino and Nina more pitch variation, a question mark raises the last syllable. Ada and the archive-only characters get default voices because the GDD has none for them. A voice of null in characters.json (Clotilde) gives the pen-scratch sound.
- Captions are emitted even when audio is locked or muted, since they replace the sound. The same caption is not repeated within 1.2 s. Sounds that only accompany a visible gesture (picking up a bobbin, a plain crossing, flipping, undoing, button taps) have no caption.
- A flip is detected when night:cross arrives twice in the same hour for the same pair with the other side on top: it plays rovescia and then the dyad in the new order.
- Marta's 'No.' plays only for code 'rifiuto' (martaNoSotto). Every other violation plays a wooden thud, logged as 'rifiuto' with detail 'tonfo'.
- In replay mode (imported score, Ripassa) each row plays one music-box dyad per crossing (a tick if empty), with no bell and no success/failure sound. The tide sound plays when the next row is flooded.
- Every button click in #ui-root plays ui_tap automatically. Close, cancel and back buttons (data-test ending in -chiudi, -annulla, -indietro or -back) and app:back play ui_indietro. Any element can opt out with data-audio-silent.
- Babble lowers the music by 8 dB on its own while it plays; duck(on) still works on top of that.
- 'Tocca per continuare' appears only if the context had already run once and does not come back within 400 ms while the page is visible. The first unlock on the title screen is left to 'Tocca per iniziare'.
- The `gain` option of sfx() and note() is a multiplier of the normal level (1 = normal). Playing.done for babble and carillon resolves after the computed duration even with audio off, so timings stay the same.
- Prefix for CSS classes and data-test attributes: au- / audio-.
- The LaceEvent {k:'nero'} is the announcement of the next row's forced crossing (the dashed preview), so it is silent. The real crossing sounds from its 'incontro' in the next row.
- When an hour is fixed, an 'incontro' plays a crossing (wood plus dyad, rancour applied) only if its pair was not already heard through night:cross since the last fix. That covers autoweave rows, black thread crossings and resumed drafts. After a Disfa that reopens the previous row, fixing it again plays no crossings, because they were already heard.
- The 'secca' edge event gets the internal recipe 'secca' (pink noise, low-pass falling 800→200 Hz in 2 s) and the caption audio.didascalie.secca. When the black thread enters from one side, the edge sound of the thread leaving that side is suppressed; the 'nero' drone covers it.
- In replay mode, night:cross is silent; the row plays as a carillon.
- Night result: in an archive night, mended === false plays fallimento. The 'named' field does not count.
- The 'Tocca per continuare' overlay does not lock the game. If a tap does not bring audio back within 400 ms, it disappears and does not return until audio has been 'running' again. Any later gesture retries through the core's unlock(). A context closed by the system is discarded and recreated at the next gesture.
- babble() with a speaker who is not a CharacterId (for example the narrator) makes no sound and no caption, but done resolves after the duration the line would have, so auto-advance timing stays the same.
- Several night:violation events within 150 ms give a single thud. Marta's «No.» always plays.
- Active rancour pairs come from createContext in src/engine/context, so they match the engine exactly (thread to character mapping, flagOn).

## Problemi noti

- The mix (bus levels, MUSIC_LEVEL 2.2, AMBIENCE_LEVEL 0.3, peaks) was set from measurements, not by ear. It needs a listening pass on a real iPhone and Android.
- iOS 'interrupted' handling, the overlay giving up after a failed tap, and recreation of a closed context are verified only by simulation (a fake context, and a Chromium context suspended or closed from outside), not on a device.
- Babble is rendered synchronously when requested (about 8 ms for a 3-second line on desktop); on slow phones this can cause a small hitch at the start of a vignette line.
- A source cut by the limiter (above 48) stops immediately and can click; this only happens under stress.
- Rare effects (vaporetto, thunder, seagull, boat, overflow, black thread, low tide) are rendered on first use, a few ms each, not in the pre-render.
- 'scene:enter' arrives after the scene's enter(). If a scene calls setMusic without seed or notes, one arpeggio note can still use the previous context before refreshContext() corrects it.
- fuso_presa and fuso_rilascio play only if the tombolo calls services.audio.sfx: the contract has no drag-start or drag-release event.
- If the tombolo emits every night:row of 'Lascia accadere' or of a replay at once, without pacing them with the animation, the bells and crossings of all rows overlap.
- The 2 consistency tests against src/content/characters.json are skipped until contenuti-atto1 adds that file.
- There is no npm script for browser-verify.ts, because package.json belongs to fondamenta.

## Richieste per altri pacchetti

- **tombolo**: Audio for crossing, flip, violation, fix hour, undo and night end is automatic from the night:* events: please do not call services.audio for these, or they will play twice. To get the flip sound, emit night:cross again for the same pair with the other side on top. Call services.audio.sfx('fuso_presa') when a bobbin drag starts and sfx('fuso_rilascio') when it is released without a crossing. Pass NightParams (level, flags, mode) as the params of scenes.go('tombolo') so rancor, the prologue clock and replay are detected. To avoid ui_tap on your own buttons, add data-audio-silent to them.
- **campagna**: Call services.audio directly for:
- setMusic per phase: 'sera' with {seed: levelId, notes: the day's characters}, 'alba', 'archivio', 'finale' (stonatura is computed automatically).
- setAmbience: 'laguna' by day, 'notte' for evening and night, 'pioggia' in Act II, 'tempesta' or 'vento' on g15.
- babble(character, text) for each vignette line; use await .done for auto-advance; music is lowered automatically.
- carillon({beatMs: 380, rows}) at dawn (the lace plays as a music box), for Riascolta, and for the credits (one beat per day).
- sfx('bottiglia') when the lagoon object appears, sfx('carta') when the notes unfold, and the sfx listed in VignetteDef.sfx.
New diary entries already play 'pagina' automatically.
- **interfaccia**: On the title screen call services.audio.setMusic('titolo', { stonatura: 0 if the true ending has been seen (save.unlocks.tovaglia), otherwise leave it out }) and setAmbience('laguna'). The volume sliders already reach the engine through settings:change, and moving the effects or master slider plays a ui_tap preview. Button clicks in #ui-root already play ui_tap/ui_indietro, so do not call them yourselves.
- **contenuti-atto1**: In characters.json, noteHz and voice {pitch, rate, formantShift, noise, lowpass} must match GDD 13.2/13.5. Clotilde must have voice: null; Lino has no note. tests/unit/audio/notes.test.ts checks this as soon as the file exists. campaign.json needs the stonatura of each day: 1 for g00–g08, 0.6 for g09–g16, 0.25 for g17–g23.
- **piattaforma-qa**: For tests/e2e/audio.spec.ts:
- `__GAME__.audio.state()`, `log()` and `mute(on)` are the required API. Log entries look like {id, t, detail}.
- After the first row of the prologue the log contains 'incrocio' (detail 'marta/teresa'), 'ora_fissata' and 'campana' (detail 'ore 6 s=1').
- Extra helpers you can use: stats().prerender.cpuMs, stress(200).peak, verify() (offline render), and interrupt() followed by [data-test="audio-tocca"] for 'Tocca per continuare'.
- tests/unit/audio/browser-verify.ts already does these checks and can serve as a reference.
- **fondamenta**: Optional: add to package.json a script "audio:verify": "tsx tests/unit/audio/browser-verify.ts", and list the extra __GAME__.audio functions in the README (documented in the header of src/audio/register.ts).
- **tombolo**: Crossing, flip, violation, fixed hour, Disfa and end of night sounds are automatic from the night:* events; do not call services.audio for these. To get the flip sound, emit night:cross again for the same pair with the other side on top.

Forced crossings (black thread, autoweave) do not need night:cross: audio plays them from the 'incontro' events in night:row. If you emit night:cross for them anyway, they are treated as already heard and do not play twice.

In 'Lascia accadere' and in replay mode, emit night:row one row at a time, in step with the animation, not all at once.

Call services.audio.sfx('fuso_presa') when a bobbin drag starts and sfx('fuso_rilascio') when it is released without a crossing.

When one of Clotilde's margin notes appears (tutorial 'margine'), call services.audio.babble('clotilde', text): it plays the pen sound (GDD 13.5).

Pass NightParams (level, flags, mode) in scenes.go('tombolo'). Add data-audio-silent to buttons that should not play ui_tap.
- **campagna**: Call services.audio directly for:
- setMusic per phase: 'sera' with {seed: levelId, notes: the day's characters}, 'alba', 'archivio', 'finale'.
- setAmbience: 'laguna', 'notte', 'pioggia' in Act II, 'tempesta' or 'vento' on g15.
- babble(character, text) for each vignette line; do not call it for the 'narratore' speaker (it is silent but takes the line's duration).
- babble('clotilde', text) for Clotilde's archive margin notes (pen sound).
- carillon({beatMs: 380, rows}) at dawn, for Riascolta and for the credits.
- sfx('bottiglia'), sfx('carta') and the sfx listed in VignetteDef.sfx.

Diary entries play 'pagina' automatically. Archive night results (mended) already play successo or fallimento.
- **interfaccia**: On the title screen call setMusic('titolo', { stonatura: 0 } only if save.unlocks.tovaglia is true, otherwise without stonatura) and setAmbience('laguna'). Buttons in #ui-root already play ui_tap or ui_indietro, and the volume sliders already reach the engine and play a preview.
- **contenuti-atto1**: In characters.json, noteHz and voice {pitch, rate, formantShift, noise, lowpass} must match GDD 13.2/13.5. Clotilde must have voice: null; Lino has no note. campaign.json needs the stonatura of each day: 1 for g00–g08, 0.6 for g09–g16, 0.25 for g17–g23. tests/unit/audio/notes.test.ts starts checking characters.json as soon as the file exists.
- **piattaforma-qa**: For tests/e2e/audio.spec.ts the required API is __GAME__.audio.state(), log() ({id, t, detail?}) and mute(on).

After the first row of the real prologue, the log contains, in this order:
- 'incrocio' (detail 'marta/teresa')
- 'ora_fissata'
- 'campana' (detail 'ore 6 s=1')
- 'segreto' (Teresa reads the letter, GDD 3.15)

Extra helpers: stats().prerender.cpuMs, stress(200).peak, verify(), and interrupt() followed by [data-test="audio-tocca"]. tests/unit/audio/browser-verify.ts is a working reference.
- **fondamenta**: Optional: add the script "audio:verify": "tsx tests/unit/audio/browser-verify.ts" to package.json, and list the extra __GAME__.audio functions in the README (they are documented in the header of src/audio/register.ts).

## Test

- `npx vitest run tests/unit/audio`: 15 files, 186 passed, 2 skipped. The skipped tests check characters.json, which does not exist yet. The builder's version had 166.
- `npx vitest run` (whole repository): 46 files, 632 passed, 2 skipped.
- `npx tsc --noEmit -p .`: no errors, globally or in audio files.
- `npx vite build --outDir <scratchpad>/dist`: OK.
- `AUDIO_VERIFY_PORT=5227 npx tsx tests/unit/audio/browser-verify.ts` (dev): 23/23.
- `AUDIO_VERIFY_URL=http://127.0.0.1:5228/ npx tsx tests/unit/audio/browser-verify.ts` (vite preview of the production build): 23/23.
- My own Playwright scripts in scratchpad/verify-audio, all on dev port 5226:
  - explore.mjs: real source count, overlay screenshots in it and en.
  - explore2.mjs: failed tap, closed context.
  - sim/sim.ts: engine fixtures run through the automation.
- Screenshots checked with Read: 02-tocca-it.png, 02-tocca-en2.png, 03-after-failed-tap.png.
- All servers on 5225–5229 are stopped.

## Integrazione

Richieste di docs/stato/RICHIESTE.md per **audio** e **tutti**, controllate sul codice attuale (14 ottobre 2026).

| Richiesta | Esito |
|---|---|
| fondamenta: `register(services)` con `registerAudio(engine)`; `unlock()` idempotente che riprende un contesto sospeso; `audio:unlocked` lo emette il core; didascalie mostrate dal core | **Già fatto** (costruttore e verificatore): src/audio/register.ts, `WebAudioEngine.unlock()`, test in tests/unit/audio/engine.test.ts e tests/unit/core/audio-unlock.test.ts. |
| interfaccia (verifica): nel titolo «laguna e orologio che ticchetta» (GDD 9) | **Fatto.** Vedi sotto. |
| tutti: indicazioni generali del core | Già seguite. |

**L'orologio.** `setAmbience(a, fadeMs?, o?: { clock?: boolean })` (aggiunta compatibile a `AudioEngine` in src/core/types.ts, applicata da fondamenta):
- senza `clock` tutto come prima: l'orologio c'è solo nella notte e si ferma nel prologo (`clockStopped()`);
- `clock: true` aggiunge l'orologio a qualunque ambiente, anche al silenzio, e ticchetta sempre (anche se la storia salvata è nel prologo): è quello del titolo, `setAmbience('laguna', undefined, { clock: true })`;
- `clock: false` lo toglie (anche dalla notte).

In src/audio/ambience.ts l'orologio ha tre stati (`ClockMode`: `'auto'` quello della notte, `'on'`, `'off'`, con `clockModeFor` e `clockTicks`); cambiare solo l'orologio dello stesso ambiente non ricostruisce i loop (niente dissolvenza, niente nodi nuovi): il primo tic arriva dopo 0,6 s, poi uno al secondo, tic e toc alternati come nella notte (guadagno 0,16, pan 0,25). Il motore ricorda l'opzione anche prima dello sblocco e la applica allo sblocco o alla ricreazione del contesto. Didascalie nuove: `audio.didascalie.ambiente.lagunaOrologio` («[la laguna: onde e gabbiani; un orologio ticchetta]») e `ambiente.orologio` (silenzio con l'orologio); la notte senza orologio usa `ambiente.notteFerma`; la didascalia si ripete se cambia solo l'orologio. Nel registro la voce `ambiente` ha il dettaglio `laguna +orologio` (o `-orologio`) quando l'opzione c'è. `stats().clock` dice se l'orologio suona adesso; il debug `ambience(id, orologio?)` accetta l'opzione.

Effetto nel gioco: il titolo ticchetta; con «Tocca per iniziare» la sera del prologo passa alla notte con l'orologio fermo, cioè «il ticchettio si ferma» (GDD 9, 0:15); tornando al titolo l'orologio riparte. La campagna e le altre scene che chiamano `setAmbience(id)` non cambiano.

**Test.** Nuovi in tests/unit/audio/ambience.test.ts (stati dell'orologio; laguna con l'orologio a un tic al secondo anche con il prologo fermo; laguna senza orologio muta; acceso e spento senza ricostruire l'ambiente; notte con `clock: false`; silenzio con l'orologio e `stop()`) e in tests/unit/audio/engine.test.ts (richiesta prima dello sblocco, didascalie, registro, `stats().clock`, notte del prologo). `npx vitest run tests/unit/audio`: 15 file, 195 test verdi (i 2 test su characters.json non sono più saltati). Nel browser, build `VITE_E2E=1` servita da `vite preview` sulla porta 5400: `AUDIO_VERIFY_URL=http://127.0.0.1:5400/ npm run audio:verify` 23/23; sonda Playwright: prima del tocco `titolo/laguna clock=true` (bloccato), dopo il tocco `running`, registro `laguna +orologio`, didascalia `lagunaOrologio`, 4 sorgenti d'ambiente attive; prologo `notte clock=false`; di nuovo al titolo `laguna clock=true`.
