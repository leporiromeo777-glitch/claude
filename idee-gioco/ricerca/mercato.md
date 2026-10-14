# Market research: first-person narrative exploration games, 2023–2026
(Third-party sales figures are estimates; player counts include Game Pass / PS Plus.)

## 1. Hits, underperformers, failures
**Hits**
- Kingdom Come: Deliverance II (Feb 2025): 5M sold by Feb 2026, MC 88. Believable world, organic side quests, reactive reputation, no filler. Weak spot: main story less appealing than side quests.
- Atomfall (Mar 2025, zone-based, 1962 Cumbria): 2M+ players first month. "Leads" system (no quest log, few markers, player pieces clues together) is its most praised feature. Criticised for combat, repetitive missions, narrative that "never coalesces", factions that don't react. Steam ~77%. ~8h focused / ~20h wide.
- Blue Prince (2025): MC 92, 2M+ players. Puzzles span rooms, note-taking. 25–30h main + 40–50h secrets.
- Clair Obscur: Expedition 33: 8M sold, team ~33. Most-completed game of 2025 on HLTB despite 28h+; ~50% beat final boss.
- Subnautica 2 (EA May 2026): 4M+ in a week, 91% positive.
- Small teams: Pacific Drive 1M (<20 staff); Abiotic Factor 1.4M; Mouthwashing 500K at $12.99 for ~2.5h; The Forgotten City (3-person core) 500K–1M.
- Acclaim ≠ volume: Lorelei ~97K, Tunic ~317K, Animal Well ~435K Steam copies. The Midnight Walk OC 80, "story doesn't always hit".

**Underperformers / failures**
- Avowed & Outer Worlds 2: well reviewed, missed sales targets. Avowed: exposition-heavy story, upgrade materials gated by region.
- Crimson Desert (Mar 2026): 2M day one but ~41% negative at launch: controls, inventory, story/pacing, "do-everything" scope.
- S.T.A.L.K.E.R. 2: bugs, missing promised A-Life.
- Redfall: "hollow open world". Starfield: empty procedural planets, loading-screen travel. Sable: beautiful but "open world can feel empty", stutter.
- AI backlash: Expedition 33 lost an Indie Game Awards GOTY over generative-AI placeholder textures; The Alters criticised for undisclosed AI text.

## 2. What players praise / criticise
- Praised: discovering rather than being told (Atomfall leads; knowledge progression in Outer Wilds, Tunic, Blue Prince); reactive worlds (KCD2); dense zones full of secrets without empty stretches.
- Criticised: map-icon checklists (Ubisoft cut markers in AC Shadows); size over density ("small but refined" is now a selling pitch, e.g. Blood of Dawnwalker); level scaling erasing progress; procedural filler; bugs and performance; main story weaker than side content.
- Hits avoid the story-urgency vs exploration conflict by making the mystery itself the reason to explore.

## 3. Settings and themes
- Working now: specific, grounded, real-feeling places (Bohemia 1403, Windscale-era Cumbria "weird Britain", French-inspired Expedition 33, Sicily in Mafia: The Old Country beat expectations).
- Saturated: post-apocalypse & survival-crafting; generic medieval fantasy; sci-fi planets (invites Starfield / No Man's Sky / Outer Wilds comparison).
- Folk horror: strong in tabletop and short indie horror, RARE in open-world exploration.
- Time loops: automatic comparison with Outer Wilds / Forgotten City / Deathloop; some critic fatigue. Use at most as a reveal, not the core.
- Italian / Alpine / Mediterranean: no notable 2023–26 first-person exploration game set there. Under-served. "Weird Italy" as an answer to Atomfall's "weird Britain".

## 4. Price and length
- Median price of Steam top-50 new releases ~$15–20; unknown brands struggle above ~$25.
- Completion: top-rated 2023–24 games averaged 38.8% completion (avg 17.9h); weak negative correlation with length. Mouthwashing 79%, BG3 22.9%, AC Valhalla 4.4%.
- Two-thirds of PC/console players play <10h/week, yet only 11% say they prefer games <20h.
- ~20,000 Steam releases in 2025; ~300 grossed >$1M.

## 5. Web / browser 3D
- Web tech can ship commercially: Vampire Survivors began as HTML5; CrossCode (HTML5 + NW.js) ~464K copies, 93% positive.
- fly.pieter.com (AI-coded Three.js flight sim): viral spike then $0.
- Portals (CrazyGames, Poki) are huge but short-session; 3D web hits are multiplayer. No example of a 10–25h single-player FP narrative game succeeding on a portal.
- itch.io: browser builds get ~10x plays but browser players are less tolerant of bugs / frame drops.
- WebGPU ships in Chrome, Safari 26, Firefox 141 (Windows); WebGL2 fallback still needed.
- AI perception (July 2026 survey, ~3,800 Steam users): 31% view AI disclosures negatively, 8% would refuse to buy.

## Implications for our concept
1. Scope: 8–12h main path, 18–25h with secrets; $14.99–19.99. Finishable games drive word of mouth.
2. Structure: 4–6 dense handcrafted zones linked by a hub (Atomfall/Avowed model) rather than one seamless continent; streams well in the browser, avoids "empty world".
3. Navigation: Leads-style clue journal + in-world signposting, no icon checklist. Gate progress mainly on knowledge.
4. Story: the central mystery is the reason to explore, no ticking clock that contradicts free exploration. The main thread MUST pay off (where Atomfall/KCD2 were criticised). Cheap reactivity via state flags and changing dialogue.
5. Builds: upgrades = tools/abilities opening new traversal routes and puzzle solutions (BotW/TotK spirit). No stat inflation, no level scaling, no region-gated materials.
6. Secrets in layers: surface easter eggs → cross-zone meta-puzzles needing notes → at least one community-level secret.
7. Visual target: "semi-realistic" competes with UE5 and exposes generic assets → aim for STYLISED REALISM: strong lighting, fog, limited palette, coherent art direction.
8. Under-served setting: a specific real-feeling Italian place (Apennine or Alpine valley, Mediterranean island) in an alternate 1950s–70s with local folklore. Avoid post-apocalypse, generic fantasy, sci-fi planets. Folk-horror tinge OK; survival-crafting not.
9. No time loop as core structure.
10. Distribution: free 30–60 min browser prologue as funnel; full game via desktop wrapper (Electron/Tauri; CrossCode precedent). Robust autosave; 20–40 min session chunks.
11. Performance before features: 60fps on integrated GPUs, WebGL2 fallback + WebGPU path.
12. AI transparency: avoid generated textures/text players will spot; prefer art produced procedurally by code and shaders.
