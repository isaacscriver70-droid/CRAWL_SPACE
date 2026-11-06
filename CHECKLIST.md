# CRAWLSPACE – Honest Checklist

Statuses: Not started / In progress / Implemented / Tested and verified / Blocked

## Stage progress
| # | Stage | Status |
|---|-------|--------|
| 1 | Project structure + navigation + settings/save/menu | Implemented (not yet browser-tested) |
| 2 | Expedition base + land movement | Implemented (not browser-tested; movement logic unit-tested headlessly) |
| 3 | Cave environment | Implemented and expanded; geometry verified headlessly, visuals not seen. About 65% underground by footprint: 85% rule STILL NOT MET (see Expansion notes) |
| 4 | Swimming, oxygen, depth, pressure | Implemented, headless-tested; not seen in a browser. Sediment, light scattering, surface entry/exit animation still missing |
| 5 | Player body + skeletal animation | Implemented (jointed arm rig, gloved hands, torso/tank/harness/legs); not seen in a browser, poses untuned |
| 6 | Flashlight + sediment | Implemented: 3D flashlight in hand, visible scattering beam, spotlight, battery; sediment reacts to swimming near rock; not seen in a browser |
| 7-8 | Creature, rig, AI | Implemented. AI headless-tested (4 seeds); model/rig/animation NOT seen in a browser |
| 9 | Story, recorders, cinematic | Implemented: 3 recorders (speech-synthesis voices + subtitles, no recorded voice acting), abandoned camp, survey tags, 3 evidence notes, 4 endings, 57 s opening cinematic (skippable). Not seen in a browser |
| 10 | Tutorial | Implemented: tutorial.html, 14 steps that each complete only on the real action (state machine tested headlessly), skip option |
| 11 | Inventory | Implemented: equipment panel (flashlight, tank remove/attach on land, regulator, dive computer, compass, survey slate), base interactions |
| 12 | Pause menu, HUD, game over | Implemented: pause (resume/settings/controls/main menu), HUD (air, depth, pressure, light, prompts, warnings), game-over screen |
| 13-15 | Multiplayer, voice, admin | Blocked on server (see below) |
| 16 | Full test and optimization | Not started |

## Files (Stage 1)
| File | Status |
|------|--------|
| index.html, css/menu.css, js/main.js | Implemented (menu, continue/new, settings, credits, fullscreen) |
| js/settings.js, js/ui.js | Implemented (all spec'd settings except resolution; key rebinding with conflict check) |
| js/save.js | Implemented (progress schema, error handling) |
| game.html, css/game.css, js/game.js | Implemented (renderer, loading screen, click-to-start, settings applied) |
| js/world.js | Implemented, visually unverified: terrain, sky/moon/stars, cliff face, pool + dock, canopy with prep table/lockers/lantern, research tent with survey screen, supply stack, 2 floodlights, trees/bushes/rocks. Textures are procedural, not photographic |
| js/cave.js | Implemented: enclosed cave as a signed-distance field meshed with surface nets (183k triangles, builds in ~2-3 s). 47 waypoints, 9 of the 10 regions, alternate route, loop and dead ends |
| js/swimming.js, js/underwater.js | Implemented: 3D swimming (momentum, drag, neutral buoyancy, collision against the cave field, slides along walls, floats at the surface with head 0.25 m above water), air/depth/pressure state, exhaled bubbles, game-over when air hits 0 |
| js/movement.js | Implemented: walk, sprint (5.9 vs 3.4 m/s), crouch, jump, collision, slope blocking, wading limit, head bob/FOV kick respecting settings. Headless test: wall stop, cliff block, jump/land OK |
| All other spec files | Not created yet. Files are only added when they contain real functionality. |

## Expansion notes (cave, 85% rule)
- Added 16 procedurally grown side branches (deterministic): winding, narrow passages with spacing rules so they never intersect other passages; some end in small chambers or air domes. 221 waypoints, 22 passage chains, about 1,180 m of passage (was 580 m), 4,300 m3 open space, 2,400 m2 footprint (was 1,180). Build time about 3.5 s, 367k triangles.
- Tested: every one of the 221 waypoints is reachable from the entrance with at least 0.3 m of clearance; the surface still has no holes except the rim at the cliff mouth; the full swim route, creature simulation and jump tests still pass.
- Outdoors shrunk to an elliptical rocky bowl (roughly 1,300 m2 walkable including pool). Cave footprint / (cave + outdoors) is about 65%. **The 85% requirement is still not met.** Reaching it needs roughly 3x more cave. That needs a baked cave mesh (build it offline and ship it as a file) to keep load time and memory reasonable; it is the next step for this item.
- Survey map now draws the new branches as you explore them.

## Audio notes
- js/audio.js is a real engine (positional HRTF, distance attenuation, underwater low-pass filter, per-category volumes from Settings, loops, graceful missing-file handling). Sounds are wired to footsteps, swim strokes, breathing/bubbles, water entry/exit, drips, rock creaks, ambience, creature calls/clicks/growl/swim, tank rip, recorder click.
- **BLOCKED on assets:** no sound files exist. assets/audio/README.md lists every file needed. I did not synthesise noise or tones, per your spec. Recorder voices currently use the browser's speech voices.

## Batch C notes (creature)
- js/monsterAI.js (pure logic): navigation graph from the cave centrelines (839 nodes, all reachable), A* with squeeze cost, states patrol / investigate / search / stalk / hunt / attack / retreat. Senses: the flashlight cone with line of sight, the actual illuminated spot on the cave wall, sound (swim speed), close sight. Blocked-route recovery re-plans around stuck nodes. Target choice is by score, ready for several players. Gets stuck never (max 0.1 s in tests) and never enters rock (min clearance 0.27 m in tests).
- Simulation (scripted diver, torch on, ~200 s): creature patrols, investigates, stalks for 36-64 s, hunts ~13 s, grabs the tank, retreats; it only becomes active once the diver is past the Initial Passages. In tunnels it slows to half speed in squeezes, so fleeing through restrictions can work.
- js/monster.js: skinned body (14 bones), skull with hinged jaw and teeth set into the jaw, blind vestigial eyes, gill slits, 6 sensory barbels, 4 jointed limbs with 3-finger hands and claws, skin texture with folds. Animations: idle, swim (travelling wave), turn (body bends), hover (limb paddling), investigate/search (head sweeps), stalk (low, slow), pursue, attack (neck lunge, jaws open, grab), squeeze (compressed body, tucked limbs), retreat.
- Tank incident: the creature physically takes the tank (carried in its jaws, then dropped and sinking to the floor). Equipment state changes, you drop to a 40 s held breath, camera shake, bubble burst, warning. Swim to the dropped tank and press E to re-attach it.
- Not done: creature sounds (no audio assets), creature seen by other players (multiplayer).

## Batch A/B notes
- Survey map (M): draws only cave sections you have been near; discoveries logged and saved; progress saved every few seconds and on exit.
- Interactions at base: prep table (recharge flashlight), lockers (equipment panel), terminal in the research tent (briefing).
- Arms/hands: 6 joints per arm plus finger chains, driven by walk/sprint/crouch/jump/swim/hover/squeeze/reach/pickup/inspect/enter/exit/react/death states. Legs kick, body pitches along the view while swimming. Wrist computer shows live depth and air.
- Tested only by smoke test with a stand-in for three.js (game boots and runs 300 frames without errors). Poses and proportions have not been seen; expect tuning.

## Stage 4 notes (swimming), headless results
- Bug fixes after your report: jumping no longer bypasses collision (cliff face, steep ridges, deep water, rock). Walking into the cliff stops at least 0.2 m from the face. Jump test results: cliff face stop, ridge stop, mouth swim-in OK.
- A scripted diver swam the whole main route from the pool to The Hollow (about 200 s) without getting stuck, through every squeeze. Air fell from 100% to 34% at the Hollow, with refills on the dry camp ledge.
- Air: 15 minutes at the surface at light effort, drains faster with depth (pressure) and effort. It refills only when your head is in air. At 0 you get the EXPEDITION LOST screen.
- Controls: swim along your view direction with W/S, A/D strafe, Space up, C down, Shift to kick harder. Wading out onto ledges works.
- Cave readability: brighter rock, stronger light (F toggles), less fog. Underwater: blue-green fog and a tint.
- Not done: sediment, scattering, 3D flashlight, regulator sounds (no audio yet), equipment condition on the HUD.

## Stage 3 notes (cave)
Measured by tests on the generated geometry (headless; not by eye):
- Enclosure: 0 holes in the cave mesh other than the rim where it meets the cliff face (268 edge pairs at the mouth, by design).
- Traversability: every waypoint, including all three tightest restrictions, is reachable from the entrance with at least 0.35 m of clearance from the rock on every side (0.4 m fails in the Tight Restrictions run, which is the intended squeeze). Planned diver radius is about 0.3 m.
- Size: about 580 m of centreline passage, 2,300 m3 of open space, 1,180 m2 footprint. Passage half-widths run from 0.5 m (squeezes) to 1.4 m; one big chamber (The Hollow, 5 m radius).
- Water: one global water table at y = -0.9. Anything open above it is air: dry shoreline ledge and abandoned camp (floor about 0.3-0.6 m above water), and domed air pockets at the Air Pocket Chamber and a second one at the end of a side branch in the Unmapped Section (2+ m of air above the water; you must swim up to them, no floor).
- Walking works on the dry parts (headless test: 2,880 frames at the camp, no wall penetration, auto-crouch under low ceilings). Water is not swimmable until Stage 4, so dry areas can only be reached with the developer options below.
- **85% rule: NOT MET.** The walkable exterior bowl is roughly 1,900 m2 versus the cave's 1,180 m2 footprint (about 38% underground). To meet it the cave needs several times more passage, or the base needs to shrink. This is the top item for the next cave pass.
- Not yet in the cave: abandoned-camp props, recorders, survey markings (Stage 9 story), air-pocket breathing mechanic (Stage 4), sediment (Stage 6).
- Developer options on game.html: `?at=entrance|initial|shoreline|camp|restrictions|airpocket|blackwater|unmapped|hollow` teleports there with free-fly on; `?fly=1` alone enables collision-free flight (W/S along view, Space up, Ctrl down, Shift fast). `F` toggles the handheld light.
- Handheld light is a first version (a spotlight), not the full flashlight system.
- Exterior shrunk to a small rocky bowl (about 28 trees on the rim hills, no forest).

## Known gaps in Stage 2
- Cave mouth is a short sealed, enclosed entrance chamber in the cliff (water-filled, blocked by depth). Real cave arrives in Stage 3; it is intentionally not a hidden void.
- No walking footsteps/audio, no player body or hands yet (Stage 5), no interactions or HUD (Stages 11-12).
- Land areas still missing from the spec: underground dry chambers, ledges, abandoned camp, underground shoreline (Stage 3).
- Visual quality is unverified: I could not render it. Expect to tune lighting/exposure after you look.

## Known gaps in Stage 1
- Never run in a real browser by me; no browser available in my environment. Please open index.html via a local server (`python -m http.server`) and report console errors.
- Menu buttons for Multiplayer and Tutorial are disabled, not faked.
- Resolution setting and pause-menu controls: not started.
- Three.js loads from jsDelivr CDN (v0.160.0); fine on GitHub Pages, needs internet.

## External requirements (unchanged)
Multiplayer, server-side admin permissions, shared saves and voice chat need a real backend (e.g. a Node/WebSocket server on Fly.io/Render plus WebRTC with TURN, and auth). GitHub Pages cannot host these.
