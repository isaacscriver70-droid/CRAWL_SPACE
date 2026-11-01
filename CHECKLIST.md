# CRAWLSPACE – Honest Checklist

Statuses: Not started / In progress / Implemented / Tested and verified / Blocked

## Stage progress
| # | Stage | Status |
|---|-------|--------|
| 1 | Project structure + navigation + settings/save/menu | Implemented (not yet browser-tested) |
| 2 | Expedition base + land movement | Implemented (not browser-tested; movement logic unit-tested headlessly) |
| 3 | Cave environment | Not started |
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
| js/movement.js | Implemented: walk, sprint (5.9 vs 3.4 m/s), crouch, jump, collision, slope blocking, wading limit, head bob/FOV kick respecting settings. Headless test: wall stop, cliff block, jump/land OK |
| All other spec files | Not created yet. Files are only added when they contain real functionality. |

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
