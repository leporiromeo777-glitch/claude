# Game design research: first-person open-world mystery (10–25 h)

Format: **Principle**: what, why, example, [source]. "(2nd)" marks a secondhand source (a press recap of a talk, a wiki or a forum).

## 1. World design: pull instead of checklists
- **Attractors plus occlusion (BotW's "triangle rule").** Nintendo dropped "points and lines" (towers joined by scripted routes) after playtest heat maps showed about 80% of players following the route and about 20% wandering with nothing to do. The fix was mid-size attractors that read from far away (shrines, stables, camp smoke) plus triangular terrain at three scales (landmark, screen, pacing). The terrain hides most points of interest, so only 2–3 compete at once, and each crested ridge shows the next. [gmtk.substack.com/p/how-nintendo-solved-zeldas-open-world; gigazine.net/gsc_news/en/20171004-breath-of-the-wild-design-secret (2nd, CEDEC 2017)]
- **Scarcity gives you a reason to go.** BotW made rupees and healing scarce so forests and quarries were worth visiting. An attractor only pulls if it pays out in something the player is short of. [GMTK, above]
- **Knowledge is the key (Outer Wilds).** The game has no upgrades or collectibles: "all that's left is you wanting to piece together what's going on." The world runs on its own clock and "things are happening whether you're there or not." Curiosity needs familiarity first: in playtests, an object falling into the village went unnoticed because players didn't yet know the village. Many small mysteries pay out more often than a few big ones, and places with nothing to find get less art detail. [gamedeveloper.com/design/live-die-repeat-how-i-outer-wilds-i-piques-curiosity-in-an-ambivalent-solar-system; en.wikipedia.org/wiki/Outer_Wilds, citing K. Beachum, GDC 2021, gdcvault.com/play/1027008]
- **Write directions as content.** Morrowind's journal directions and AC Odyssey's Exploration Mode give clues such as "southern tip of Ithaca" and "near the waterfront", and three clues are enough to triangulate. Atomfall replaces quests with *leads* from notes and NPC tips. Some are false and killing a contact can cut a line, yet "you could play through the game by killing every single character and still find enough leads." Waypoints appear only on lower difficulties. Reviewers praised the leads but found the objectives behind them repetitive: structure does not fix weak verbs. [pcworld.com/article/402557; gamingbolt.com/atomfall-will-not-have-a-traditional-quest-system-will-focus-on-players-investigating; tomsguide.com/gaming/atomfall-review]

## 2. Narrative that survives freedom
- **Story as investigation of a fixed truth.** If the plot already happened (a past event, or a clockwork that repeats), any order of discovery is coherent and twists come from *recontextualisation*. *Examples:* Her Story (keyword search through video fragments); Obra Dinn (fates confirmed only in sets of three, which blocks guessing); The Forgotten City (a time-loop murder case); Outer Wilds (each text fragment points to the one before or after it). [pcgamer.com/the-story-behind-her-story; unwinnable.com/2018/12/05/obra-dinn; news.xbox.com/en-us/2021/11/08/the-forgotten-city-interview; Wikipedia/K. Beachum]
- **Gate the act, not the region.** Avowed unlocks open zones through the story because "pacing is really tough in open-world games," and zones show where the player is on the critical path. TotK leaves its ending reachable early but hides that fact ("a set path… the path that [players] chose"). Its memories could be found out of order, and critics noted emotional beats landing in the wrong order. [thefilibusterblog.com/avowed-developers-explain-decision-against-openworld-design (2nd, Xbox Wire); nintendolife.com/news/2023/12/…; zeldadungeon.net/daily-debate-…geoglyphs]
- **Urgency through NPC agendas.** Open worlds kill urgency. Victor Sanchez proposes antagonist plans that advance on their own, reported through rumours and radio, with consequences for inaction: "less like a movie and more like a pen and paper campaign." [gamedeveloper.com/design/narrative-design-on-open-worlds-should-we-ditch-missions-]
- **Make the world's state react.** Dishonored's Chaos changes the number of rats and guards, the dialogue and the ending. Dishonored 2 weights kills by guilt ("sympathetic, guilty, or murderous"). New Vegas factions "contain multitudes", so they are never a choice between pure good and pure evil. Larian's "n+1" means that every way the player can break the plot has a fallback (the MacGuffin can come to the player in 24+ ways). [en.wikipedia.org/wiki/Dishonored; rollingstone.com/…/why-making-dishonored-2-was-so-hard-121280; pcgamer.com/…josh-sawyer…multitudes; yahoo.com/tech/baldurs-gate-3-least-24-160125347 (2nd)]
- **"One thing pulls you there, then another."** Paweł Sasko (CDPR): withhold information ("we want the players to want the story"), build ambiguous dilemmas, make consequences visible and delayed, cut repeated exposition, and put key beats at the peaks and troughs of tension. Every answer should plant a new question that points to a new place. [gamedeveloper.com/marketing/10-key-takeaways-from-the-quest-design-of-cyberpunk-2077-and-the-witcher-3; destructoid.com/cd-projekt-red-designer-breaks-down-the-witcher-3s-best-quest]

## 3. Quest variety (not fetch, not kill)
**Catalogue:** deduction ledger (Obra Dinn); interrogation (Her Story, Disco Elysium); loop replay (Forgotten City); scene reconstruction (Echoes of the Eye slide reels); puzzle spaces (shrines); multi-route infiltration (Dishonored); escort with a reveal (Bloody Baron); clockwork timed events (Outer Wilds); chase; traversal gauntlet; photo matching (BotW memories); locating a sound or melody; triangulating written clues; machine repair as a system puzzle; faction sabotage; unreliable leads (Atomfall); dilemmas with no clean answer.

**What makes quests memorable:**
- **Never repeat, always twist.** CDPR promised "you won't find two identical quests" across 50 hours, with a reported rule of no FedEx quests without a twist (2nd). [comicbook.com/…/the-witcher-3-developers-promise…; steamcommunity (2nd)]
- **Shape each quest in four steps (kishōtenketsu).** Introduce, develop, twist, resolve: Hayashida's Mario level structure applied to quests. [mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps]
- **Make failure content.** In Disco Elysium a failed check changes the story instead of blocking it. [pcgamer.com/why-i-love-failing-in-disco-elysium]
- **Rhythm.** Alternate "gameplay, story, gameplay, story" and avoid stacking non-interactive scenes. [Destructoid/Sasko]

## 4. Builds: horizontal, exclusive, consequential
- **Core verbs up front, upgrades widen.** BotW hands over every rune on the Plateau because in an open world "providing them with what they need from the beginning was important." Spirit Orbs buy a heart *or* stamina: a horizontal trade from one shared budget. [zeldadungeon.net/wiki/Interview:Nintendo_Power_Podcast_December_21st_2017; zeldadungeon.net/wiki/Spirit_Orb]
- **Exclusive picks create identity.** Each Deus Ex canister offers two augmentations for a slot: 18 exist, and at most 9 can be installed. [en.wikipedia.org/wiki/Deus_Ex_(video_game)]
- **Power with a cost in the world.** In Prey, Typhon neuromods make turrets treat you as hostile and draw the Nightmare. BioShock is the counterexample: the story asked for mercy while the mechanics rewarded harvesting, which is the origin of Clint Hocking's "ludonarrative dissonance". [bethesda.net/en-NZ/news/prey-typhon-guide; inverse.com/gaming/ludonarrative-dissonance-meaning-video-games-origins-definition]
- **Every build needs content.** Obsidian's "karma police" checked that every skill had "enough cool stuff to do." Deus Ex: HR's boss fights ignored builds; the studio admitted it, and the Director's Cut added stealth, hacking and non-lethal routes. [pcgamer.com/…karma-police…; engadget.com/2011-11-04-eidos-montreal-fesses-up-to-poor-boss-fights…]
- **Multiplicative systems.** In BotW's chemistry engine and Arkane's games ("tons of solutions possible"), solutions emerge from rules instead of being scripted one by one. Dishonored's Blink became a core power because the levels were vertical. [tomsguide.com/uk/us/zelda-breath-wild-design,news-24586.html (2nd); gameworldobserver.com/2024/02/09/what-is-immersive-sim-raphael-colantonio-interview; gamebanshee.com/x99 (2nd)]
- **Don't level-scale everything.** Oblivion's universal scaling "negated your advancement". Region-tier scaling (Fallout 3) or none at all keeps growth readable. [giantbomb.com/users/3378/articles/level-scaling-and-rpgs-hope-for-skyrim (2nd)]

## 5. Secrets: layered, hinted, optional
- **Mystery has three phases: ignorance, knowledge, understanding.** Tunic's Andrew Shouldice calls the middle phase (knowing something exists without understanding it) "the most exciting part." Players should find things they're "not supposed to," and open mysteries can beat solved ones. [gamedeveloper.com/gdc2023/video-how-the-tunic-developers-built-a-mysterious-world; gdconf.com/news/unlock-secrets-tunic-gdc-2023-design-session]
- **Layer secrets from visible to meta.** (1) seen but unreachable; (2) hidden in plain sight (The Witness: return trips reveal new puzzles); (3) systemic (use mechanics creatively); (4) meta or cipher (Tunic's manual, Fez's alphabets). Animal Well was built as a grid map with secrets layered on top. [bossrush.net/2024/03/pax-east-2024-chatting-with-animal-well-creator-billy-basso; en.wikipedia.org/wiki/The_Witness_(2016_video_game)]
- **Tell players a secret exists, never how to get it.** Dark Souls' illusory walls have no visual tell and are found mostly through other players' messages. The Fez community brute-forced the monolith instead of solving it. Deep secrets need logical solutions and in-world hints. [pushsquare.com/news/2018/05/guide_dark_souls_remastered_illusory_walls_locations; engadget.com/2012-04-20-how-the-community-solved-fezs-hardest-puzzle]
- **Keep major secrets optional.** Beachum liked having a major curiosity (the Quantum Moon) that isn't required to finish Outer Wilds. [medium.com/@cordialkobold/interview-with-alex-beachum…]

## 6. Pacing and length
- **Give each region a new verb or hazard.** Teach it, twist it, then combine it with earlier ones, as each Witness area does with its opening row of panels.
- **Put a world-state shift at the midpoint.** Let the twist change the map (new access, a hostile faction, an altered clock), not just add content. This is the main defence against a mid-game slump.
- **Cluster the content.** CDPR used "event clusters" so that quests don't send players far away (2nd). [gamebanshee recap of Tomaszkiewicz talk]
- **Make the ending a synthesis.** The finale should test what the player knows, not their stats. (Outer Wilds built its ending differently because there are "no rules to learn.") Critics flagged Elden Ring's repetition and restrictive endgame. [80.lv/articles/a-look-at-the-world-design-of-elden-ring (2nd)]
- **Size target (our estimate):** a hub plus 5–6 regions of 2–3 h each, about 25 authored quests, and an 8–10 h critical path.

## 7. First-person specifics
- **Build levels and missions around the movement system.** Dying Light did this, and its team called motion sickness "one of the main" first-person challenges. Its look-to-grab ledges frustrated players: use generous grab assist. [gdcvault.com/play/1025208/Parkour-How-to-Improve-Freedom; mcvuk.com/…/the-vaulting-dead…]
- **Readability without a HUD.** Mirror's Edge turns usable objects red ("runner vision"). Use colour and shape language for climbable, breakable and interactive things. [engadget.com/2008-02-29-gdc08-first-screenshots-of-mirrors-edge]
- **Comfort settings.** Provide options for FOV, head bob, camera shake, motion blur and weapon sway, and avoid repetitive camera bob. [Xbox Accessibility Guideline 117, devdocs.xbox.com]
- **Diegetic navigation.** Firewatch uses a paper map, a compass and radio directions to landmarks, with an optional position arrow. Far Cry 2 suggests a fully diegetic FPS is "nearly hopeless", so go hybrid. [gamedeveloper.com/design/how-firewatch-s-ui-enhances-player-immersion; gamedeveloper.com/design/game-ui-discoveries-what-players-want]

## Top 15 rules for our design
1. The plot is a fixed truth that players reconstruct in any order.
2. Act 1 has 3–4 parallel leads; the midpoint twist changes the world; Act 3 converges.
3. Every answer plants a new question that points to a new place.
4. The log holds clues and questions, not waypoints. Markers are optional.
5. Write directions against landmarks visible from far away.
6. Use terrain to hide points of interest so only 2–3 are visible at once.
7. Every point of interest pays out in something scarce.
8. Upgrades are horizontal and mutually exclusive, from a shared budget, with limited respec.
9. Every strong power has a cost in the world.
10. Every build has a viable route through every main quest, bosses included.
11. Build systems that multiply instead of one-off keys.
12. NPCs act on their own clock, and inaction has consequences.
13. No quest type repeats without a twist. Shape quests as introduce, develop, twist, resolve.
14. Layer secrets, hint that they exist, and keep them off the critical path.
15. Ship comfort options and readable in-world affordances from day one.

## Top 10 traps to avoid
1. Map-icon checklists and tower reveals.
2. Universal level scaling.
3. Boss fights that ignore the player's build (Deus Ex: HR).
4. Moral choices whose incentives contradict the story (BioShock).
5. Urgent stakes inside a world that waits forever.
6. Emotional beats that break when found out of order.
7. Secrets that can be brute-forced or have no tell.
8. Mysteries placed before players know the place well enough to notice them.
9. Dominant builds and stat inflation.
10. Head bob, camera shake or imprecise grabs with no options.
