# CRAWLSPACE – Honest Checklist

Statuses: Not started / In progress / Implemented / Tested and verified / Blocked

## Stage progress
| # | Stage | Status |
|---|-------|--------|
| 1 | Project structure + navigation + settings/save/menu | Implemented (not yet browser-tested) |
| 2 | Expedition base + land movement | Implemented (not browser-tested; movement logic unit-tested headlessly) |
| 3 | Cave environment | Implemented, geometry verified headlessly; visuals not seen. See Stage 3 notes. 85%-underground rule NOT met yet |
| 4 | Swimming, oxygen, depth, pressure | Not started |
| 5 | Player body + skeletal animation | Not started |
| 6 | Flashlight + sediment | Not started |
| 7-8 | Creature, rig, AI | Not started |
| 9 | Story, recorders, cinematic | Not started |
| 10 | Tutorial | Not started |
| 11 | Inventory | Not started |
| 12 | Pause menu, HUD, game over | Not started |
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
| js/movement.js | Implemented: walk, sprint (5.9 vs 3.4 m/s), crouch, jump, collision, slope blocking, wading limit, head bob/FOV kick respecting settings. Headless test: wall stop, cliff block, jump/land OK |
| All other spec files | Not created yet. Files are only added when they contain real functionality. |

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
