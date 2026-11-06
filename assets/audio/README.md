# CRAWLSPACE audio assets (required, not yet supplied)

The game engine (`js/audio.js`) loads these files from this folder and plays them positionally with the volume
categories from Settings. The game does not synthesise placeholder noise: a missing file means that sound is silent.
Use original recordings or properly licensed material (e.g. CC0 from freesound.org, or a commissioned sound designer).
Format: .ogg (Vorbis), mono for positional sounds, 44.1/48 kHz.

Effects: regulator_in, regulator_out, bubbles, swim_stroke, footstep_rock_1..3, footstep_wet_1..2, footstep_dirt_1..2,
gear_rustle, splash_in, splash_out, water_move_loop, tank_rip, hose_snap, recorder_click
Ambient: drip_1..3, rock_creak_1..2, ambience_underwater_loop, ambience_cave_loop, ambience_night_outside_loop
Creature: creature_call_1..2, creature_click_1..2, creature_growl, creature_swim_loop
Music: music_tension_loop
Voices: the three expedition recorders currently use the browser's built-in speech voices with subtitles.
Recorded voice-actor lines for Mara Voss, Joel Hart and Eli Hargrove (see js/story.js for the scripts) should replace them.
