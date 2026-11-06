// Game bootstrap and main loop: renderer, world, player, dive state, equipment, interactions, panels, saves.
import * as THREE from 'three';
import { getSettings, onSettingsChange } from './settings.js';
import { loadProgress, saveProgress, newExpedition, EMPTY_PROGRESS } from './save.js';
import { buildWorld, LOCATIONS } from './world.js';
import { FirstPersonController } from './movement.js';
import { buildSettingsPanel, keyName, toast } from './ui.js';
import { DiveState, Bubbles } from './underwater.js';
import { Sediment } from './sediment.js';
import { Interactions } from './interaction.js';
import { Equipment } from './inventory.js';
import { WATER_LEVEL } from './cave.js';
import { Survey } from './survey.js';
import { DiverAnimator } from './animations.js';
import { Creature as CreatureAI, NavGraph } from './monsterAI.js';
import { createCreature } from './monster.js';
import { createTankMesh } from './player.js';
import { Tutorial } from './tutorial.js';
import { Cinematic } from './cinematic.js';
import { AudioManager } from './audio.js';
import { buildStory, RECORDERS, NOTES, ENDINGS, chooseEnding, VoicePlayer } from './story.js';

const $ = id => document.getElementById(id);
function fail(msg) { $('loading').hidden = true; $('fatal-msg').textContent = msg; $('fatal').hidden = false; }
const webgl2 = () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };

async function boot() {
  if (!webgl2()) return fail('WebGL 2 is not available in this browser, so the game cannot run.');
  const save = loadProgress();
  if (!save.ok) return fail(`Your save could not be read: ${save.error}`);
  const tutorialMode = window.CRAWL_MODE === 'tutorial';
  const progress = tutorialMode ? EMPTY_PROGRESS() : (save.data || newExpedition().data);

  const canvas = $('view'), q = getSettings().graphics;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = q !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(getSettings().fov, 1, 0.05, 600);

  $('loading-text').textContent = 'Carving the cave…';
  await new Promise(r => setTimeout(r, 40));
  const world = buildWorld(scene);

  /* ---- state ---- */
  const equipment = new Equipment(), dive = new DiveState(), bubbles = new Bubbles(scene);
  const sediment = new Sediment(scene, (x, y, z) => z < world.caveZ ? world.cave.sdf(x, y, z) : y - world.terrain(x, z));
  const survey = new Survey(world.cave, progress.survey);
  const interactions = new Interactions();
  let panel = null, dead = false, started = false;

  /* ---- player ---- */
  const player = new FirstPersonController(camera, canvas, world, locked => {
    document.body.classList.toggle('playing', locked);
    if (locked) { started = true; $('start').hidden = true; }
    else if (!panel && !dead) { $('btn-resume').textContent = started ? 'Resume' : 'Begin'; $('start').hidden = false; }
  });
  const params = new URLSearchParams(location.search), at = LOCATIONS.find(l => l.id === params.get('at'));
  if (at) { player.pos.x = at.pos[0]; player.pos.y = at.pos[1]; player.pos.z = at.pos[2]; player.yaw = Math.PI; }
  player.fly = params.get('fly') === '1' || (!!at && params.get('fly') !== '0');

  /* ---- handheld light ---- */
  const torch = new THREE.SpotLight(0xfff0d8, 320, 60, 0.45, 0.5, 1.6);
  torch.position.set(0.18, -0.12, 0); torch.target.position.set(0, 0, -6); torch.castShadow = getSettings().graphics !== 'low';
  torch.shadow.mapSize.set(1024, 1024); torch.shadow.camera.near = 0.1; torch.shadow.camera.far = 50; torch.shadow.bias = -0.0005;
  camera.add(torch, torch.target); scene.add(camera);

  const animator = new DiverAnimator(scene, camera);
  const audio = new AudioManager(); let stepSign = 0, strokeT = 0, dripT = 3, creakT = 40, clickT = 3, lastAIState = 'patrol';

  /* ---- the creature ---- */
  const graph = new NavGraph(world.cave.paths), ai = new CreatureAI(world.cave, graph, graph.nearest(LOCATIONS.find(l => l.id === 'hollow').pos));
  const creature = createCreature(); scene.add(creature.group);
  const tankDrop = { mesh: null, state: 'none', vy: 0, t: 0 };       // the tank after the creature tears it off: carried -> sinking -> resting
  let shake = 0; const tmpV = new THREE.Vector3(), tmpD = new THREE.Vector3();

  /* ---- panels ---- */
  const closePanel = () => { if (!panel) return; $(panel).hidden = true; panel = null; player.lock(); };
  function openPanel(id, data) {
    if (dead) return;
    panel = id; $('start').hidden = true; document.exitPointerLock?.(); if (id === 'panel-equip' || id === 'panel-map') animator.trigger('inspect');
    if (id === 'panel-equip') renderEquip(); else if (id === 'panel-brief') renderBrief(); else if (id === 'panel-map') survey.draw($('map-canvas'), { x: player.pos.x, z: player.pos.z, yaw: player.yaw }, LOCATIONS, progress.discoveredLocations);
    else if (id === 'panel-note') { $('note-title').textContent = data.title; $('note-body').textContent = data.text; } else if (id === 'modal-settings') buildSettingsPanel($('settings-body')); else if (id === 'modal-controls') renderControls();
    $(id).hidden = false;
  }
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closePanel));
  const b0 = getSettings().bindings;
  function renderControls() {
    const bd = getSettings().bindings, rows = [['Move', `${keyName(bd.forward)} ${keyName(bd.left)} ${keyName(bd.backward)} ${keyName(bd.right)}`], ['Sprint / kick hard', keyName(bd.sprint)], ['Crouch', keyName(bd.crouch)], ['Jump / swim up', keyName(bd.jump)], ['Swim down', keyName(bd.swimDown)], ['Interact', keyName(bd.interact)], ['Flashlight', keyName(bd.flashlight)], ['Equipment', keyName(bd.inventory)], ['Survey map', keyName(bd.map)], ['Look', 'Mouse']];
    $('controls-body').innerHTML = rows.map(r => `<div class="row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  }
  function renderEquip() {
    const f = equipment.flashlight, t = equipment.tank;
    $('equip-body').innerHTML = `
      <div class="item"><div><b>Flashlight</b><br><small>Battery ${f.battery.toFixed(0)}% · ${f.on ? 'ON' : 'OFF'}</small></div><button data-act="light">${f.on ? 'Turn off' : 'Turn on'}</button></div>
      <div class="item"><div><b>Oxygen tank</b><br><small>${t.attached ? 'Attached' : 'Removed'} · air ${dive.air.toFixed(0)}%</small></div><button data-act="tank" ${dive.submerged ? 'disabled' : ''}>${t.attached ? 'Remove' : 'Attach'}</button></div>
      <div class="item"><div><b>Regulator</b><br><small>Condition ${equipment.regulator.condition.toFixed(0)}%</small></div></div>
      <div class="item"><div><b>Dive computer</b><br><small>Depth ${dive.depth.toFixed(1)} m · pressure ${dive.pressure.toFixed(2)} bar</small></div></div>
      <div class="item"><div><b>Compass</b><br><small>Heading ${(((-player.yaw * 180 / Math.PI) % 360 + 360) % 360).toFixed(0)}° (0 = north, toward the cliff)</small></div></div>
      <div class="item"><div><b>Survey slate</b><br><small>${progress.discoveredLocations.length} of ${LOCATIONS.length} locations logged</small></div><button data-act="map">Open map</button></div>`;
  }
  $('equip-body').addEventListener('click', e => {
    const a = e.target.dataset?.act; if (!a) return;
    if (a === 'light') { if (f0().battery > 0) f0().on = !f0().on; else toast('The battery is flat.', 'error'); renderEquip(); }
    else if (a === 'tank' && !dive.submerged) { equipment.tank.attached = !equipment.tank.attached; renderEquip(); }
    else if (a === 'map') { closePanel(); openPanel('panel-map'); }
  });
  const f0 = () => equipment.flashlight;
  $('brief-body').addEventListener('click', e => { const id = e.target.dataset?.rec; if (id) { closePanel(); voice.play(RECORDERS.find(r => r.id === id).lines); } });
  function renderBrief() {
    $('brief-body').innerHTML = `<p>A diving team vanished in <b>The Hollow</b>. Recover the three expedition recorders, learn what happened, and get back out alive.</p>
      <div class="row"><span>Locations surveyed</span><b>${progress.discoveredLocations.length} / ${LOCATIONS.length}</b></div>
      <div class="row"><span>Deepest dive</span><b>${progress.bestDepth.toFixed(1)} m</b></div>
      <div class="row"><span>Recorders recovered</span><b>${progress.recordersFound.length} / 3</b></div>
      <div class="row"><span>Evidence logged</span><b>${progress.evidence.length}</b></div>
      ${RECORDERS.filter(r => progress.recordersFound.includes(r.id)).map(r => `<div class="item"><span>${r.title}</span><button data-rec="${r.id}">Play</button></div>`).join('')}
      <p><a class="btn" href="index.html">Main menu</a></p>`;
  }

  /* ---- story: camp, recorders, notes, tags ---- */
  const story = buildStory(scene, world), voice = new VoicePlayer($('subs'));
  for (const r of RECORDERS) {
    const rec = story.recorders[r.id]; if (progress.recordersFound.includes(r.id)) rec.mesh.visible = false;
    interactions.add({ pos: rec.pos, radius: 2.2, label: () => progress.recordersFound.includes(r.id) ? null : 'Pick up expedition recorder',
      onUse: () => { progress.recordersFound.push(r.id); rec.mesh.visible = false; audio.play('recorder_click'); survey.dirty = true; animator.trigger('pickup'); toast(`${r.title} recovered (${progress.recordersFound.length}/3)`); voice.play(r.lines); persist(); } });
  }
  const noteItem = (id, pos, label) => { if (pos) interactions.add({ pos, radius: 2.2, label: () => label, onUse: () => { openPanel('panel-note', NOTES[id]); if (!progress.evidence.includes(id)) { progress.evidence.push(id); toast('Evidence logged.'); survey.dirty = true; } } }); };
  noteItem('camp', story.boardPos, 'Read the camp log'); noteItem('slate', story.slatePos, 'Read the dive slate'); noteItem('marks', story.marksPos, 'Examine the tally marks');
  let endingShown = tutorialMode;
  const cin = new Cinematic({ scene, camera, world, creature, voice, bubbles, onDone: () => { $('cin-skip').hidden = true; $('fade').style.opacity = 0; animator.body.visible = true; animator.view.visible = true; torch.visible = true; $('hud').hidden = false; $('subs').hidden = true; $('start').hidden = false; } });
  const wantIntro = new URLSearchParams(location.search).get('intro') === '1' && !tutorialMode;
  $('cin-skip').addEventListener('click', () => cin.finish()); addEventListener('keydown', e => { if (cin.active && (e.code === 'Escape' || e.code === 'Space')) cin.finish(); });
  const tut = tutorialMode ? new Tutorial($('tutorial')) : null;
  if (tut) { $('tutorial').hidden = false; player.minZ = -57; }

  /* ---- interactions at the base ---- */
  const A = world.anchors;
  interactions.add({ pos: A.table, radius: 2.8, label: () => 'Prepare flashlight (recharge battery)', onUse: () => { equipment.rechargeFlashlight(); toast('Flashlight recharged.'); } });
  interactions.add({ pos: A.lockers, radius: 2.8, label: () => 'Check equipment', onUse: () => openPanel('panel-equip') });
  interactions.add({ pos: A.terminal, radius: 2.8, label: () => 'Read expedition briefing', onUse: () => openPanel('panel-brief') });

  interactions.add({ get pos() { return tankDrop.mesh ? [tankDrop.mesh.position.x, tankDrop.mesh.position.y, tankDrop.mesh.position.z] : [0, 1e4, 0]; }, radius: 2.4,
    label: () => (tankDrop.state === 'sinking' || tankDrop.state === 'resting') ? 'Re-attach your oxygen tank' : null,
    onUse: () => { equipment.tank.attached = true; scene.remove(tankDrop.mesh); tankDrop.mesh = null; tankDrop.state = 'none'; toast('Tank re-attached.'); animator.trigger('pickup'); } });

  /* ---- input ---- */
  addEventListener('keydown', e => {
    if (e.repeat) return; const b = getSettings().bindings;
    if (player.locked) {
      if (e.code === b.interact) { if (interactions.use()) { animator.trigger('reach'); tut?.notify('interact'); } }
      else if (e.code === b.flashlight) { if (f0().battery > 0) f0().on = !f0().on; tut?.notify('light'); }
      else if (e.code === b.inventory) { openPanel('panel-equip'); tut?.notify('equip'); }
      else if (e.code === b.map) { openPanel('panel-map'); tut?.notify('map'); }
    } else if ((panel === 'panel-equip' && e.code === b.inventory) || (panel === 'panel-map' && e.code === b.map)) closePanel();
  });
  $('btn-resume').addEventListener('click', () => { audio.init(); player.lock(); });
  $('btn-keep').addEventListener('click', () => { $('ending').hidden = true; progress.storyFlags.enteredCave = false; endingShown = false; player.lock(); });
  $('btn-settings').addEventListener('click', () => openPanel('modal-settings'));
  $('btn-controls').addEventListener('click', () => openPanel('modal-controls'));

  /* ---- display ---- */
  const ratio = () => ({ low: 0.75, medium: 1, high: Math.min(devicePixelRatio, 2) })[getSettings().graphics] ?? 1;
  function resize() { renderer.setPixelRatio(ratio()); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); onSettingsChange(resize); resize();
  $('loading').hidden = true;
  if (wantIntro) { $('hud').hidden = true; $('start').hidden = true; $('cin-skip').hidden = false; animator.body.visible = false; animator.view.visible = false; torch.visible = false; cin.start(); }
  else { $('hud').hidden = false; $('start').hidden = false; }

  const hud = { air: $('o2bar'), airTxt: $('o2txt'), depth: $('depth'), press: $('press'), warn: $('warn'), uw: $('uw'), light: $('light'), prompt: $('prompt') };
  const underColor = new THREE.Color(0x06222b), muddy = new THREE.Color(0x2a2418), clock = new THREE.Clock();
  let saveTimer = 0, t = 0;
  const persist = () => { if (tutorialMode) return; progress.survey = survey.export(); const r = saveProgress(progress); if (!r.ok) toast(`Could not save: ${r.error}`, 'error'); survey.dirty = false; };
  addEventListener('beforeunload', persist);
  window.crawl = { ai, player, dive, equipment, world };      // developer console access

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1); t += dt;
    if (cin.active) { cin.update(dt); $('fade').style.opacity = cin.fade; dive.submerged = camera.position.y < WATER_LEVEL; }
    else player.update(player.locked ? dt : 0.0001);
    world.update(dt, camera);
    const run = player.locked && !player.fly;
    if (!player.fly && !cin.active) dive.update(run ? dt : 0, camera.position.y, player.speed, equipment.tank.attached);
    if (run) equipment.update(dt, dive.submerged);
    if (tut && run) tut.update(dt, player, dive, player.keys);
    creature.group.visible = !tutorialMode;
    if (run && !cin.active && !player.fly && !tutorialMode) {                                             // creature: sense, decide, move
      camera.getWorldDirection(tmpD); const submergedNow = dive.submerged;
      const noise = (submergedNow ? player.speed * 0.7 : camera.position.z < world.caveZ ? player.speed * 0.2 : 0);
      ai.update(dt, [{ id: 'local', pos: [camera.position.x, camera.position.y, camera.position.z], speed: player.speed, noise, torchOn: equipment.flashlight.on && equipment.flashlight.battery > 0, torchDir: [tmpD.x, tmpD.y, tmpD.z], submerged: submergedNow, tankOn: equipment.tank.attached }]);
      for (const ev of ai.events) if (ev.type === 'tankGrab' && equipment.tank.attached) {
        equipment.tank.attached = false; dive.breath = 100; shake = 1; audio.play('tank_rip'); audio.play('hose_snap'); bubbles.burst(camera, 60); animator.trigger('react'); toast('Something tore your tank away!', 'error');
        tankDrop.mesh = createTankMesh(); creature.handHold.add(tankDrop.mesh); tankDrop.mesh.position.set(0, 0, 0); tankDrop.mesh.rotation.set(Math.PI / 2, 0, 0); tankDrop.state = 'carried'; tankDrop.t = 0;
      }
    }
    if (!cin.active) creature.update(dt, ai);
    if (tankDrop.state === 'carried' && (tankDrop.t += dt) > 2.4) {       // the creature lets go and the tank sinks
      creature.handHold.getWorldPosition(tmpV); creature.handHold.remove(tankDrop.mesh); tankDrop.mesh.position.copy(tmpV); scene.add(tankDrop.mesh); tankDrop.state = 'sinking'; tankDrop.vy = -0.2;
    } else if (tankDrop.state === 'sinking') {
      const m = tankDrop.mesh; tankDrop.vy = Math.max(-0.6, tankDrop.vy - 0.5 * dt); m.position.y += tankDrop.vy * dt; m.rotation.z += dt * 0.6; m.rotation.x += dt * 0.3;
      if (sediment.floorDistance(m.position.x, m.position.y, m.position.z) < 0.22) tankDrop.state = 'resting';
    }
    if (shake > 0) { camera.rotation.z += (Math.random() - 0.5) * 0.06 * shake; camera.rotation.x += (Math.random() - 0.5) * 0.04 * shake; shake = Math.max(0, shake - dt * 1.4); }
    if (player.event) { animator.trigger(player.event); if (audio.ctx) audio.play(player.event === 'enter' ? 'splash_in' : 'splash_out'); player.event = null; }
    const level = equipment.lightLevel(t); torch.visible = level > 0 && !cin.active; torch.intensity = 320 * level;
    if (!cin.active) animator.update(dt, { swimming: player.swimming, speed: player.speed, sprinting: player.sprinting, crouching: player.crouching, onGround: player.onGround, bobT: player.bobT,
      squeeze: player.swimming && world.cave.sdf(camera.position.x, camera.position.y, camera.position.z) < 0.78, dead, tankOn: equipment.tank.attached, lightOn: level > 0,
      depth: dive.depth, air: dive.air, yaw: player.yaw, pitch: player.pitch });
    // --- sound (silent for any file that is not present) ---
    if (audio.ctx) {
      audio.update(camera, dive.submerged); const inCave = camera.position.z < world.caveZ;
      audio.loop('amb_underwater', dive.submerged ? 1 : 0); audio.loop('amb_cave', inCave && !dive.submerged ? 1 : 0); audio.loop('amb_outside', !inCave && !dive.submerged ? 1 : 0);
      audio.loop('water_move', dive.submerged ? Math.min(1, player.speed / 2) : 0);
      if (player.onGround && !player.swimming && player.speed > 0.6) { const sg = Math.sign(Math.sin(player.bobT * 2)); if (sg !== stepSign && sg !== 0) { stepSign = sg; audio.play(inCave ? (camera.position.y < -0.2 ? 'footstep_wet' : 'footstep_rock') : 'footstep_dirt', { vol: player.sprinting ? 1 : 0.6 }); } }
      if (player.swimming && player.speed > 0.4 && (strokeT -= dt) < 0) { strokeT = 1.2 - Math.min(0.6, player.speed * 0.25); audio.play('swim_stroke', { vol: Math.min(1, player.speed / 2) }); }
      if (inCave && (dripT -= dt) < 0) { dripT = 2 + Math.random() * 6; const a = Math.random() * 6.28, r = 3 + Math.random() * 6; audio.play('drip', { pos: [camera.position.x + Math.cos(a) * r, camera.position.y + 1 + Math.random(), camera.position.z + Math.sin(a) * r] }); }
      if (inCave && (creakT -= dt) < 0) { creakT = 30 + Math.random() * 60; audio.play('creak', { pos: [camera.position.x + (Math.random() - 0.5) * 12, camera.position.y + 1, camera.position.z + (Math.random() - 0.5) * 12], vol: 0.8 }); }
      const cp = ai.pos; if (ai.state !== lastAIState) { if (ai.state === 'stalk') audio.play('creature_call', { pos: cp }); else if (ai.state === 'hunt') audio.play('creature_growl', { pos: cp }); else if (ai.state === 'attack') audio.play('creature_growl', { pos: cp, vol: 1 }); lastAIState = ai.state; }
      if ((ai.state === 'investigate' || ai.state === 'search') && (clickT -= dt) < 0) { clickT = 2.5 + Math.random() * 3; audio.play('creature_click', { pos: cp }); }
      audio.loop('creature_swim', Math.max(0, 1 - Math.hypot(cp[0] - camera.position.x, cp[1] - camera.position.y, cp[2] - camera.position.z) / 30) * Math.min(1, ai.speed / 2), cp);
      audio.loop('music_tension', ai.state === 'hunt' || ai.state === 'attack' ? 1 : 0);
    }
    bubbles.onExhale = () => audio.ctx && (audio.play('regulator_out'), audio.play('bubbles', { vol: 0.8 }));
    bubbles.update(dt, camera, dive.submerged);
    sediment.update(dt, camera, dive.submerged, player.speed, level > 0);
    if (dive.submerged) {
      const mud = sediment.turbidity;
      scene.fog.color.copy(underColor).lerp(muddy, Math.min(0.7, mud)); scene.fog.density = 0.075 + dive.depth * 0.002 + mud * 0.07; scene.background.copy(scene.fog.color);
    }
    // discoveries and survey
    survey.record(camera.position.x, camera.position.y, camera.position.z);
    for (const l of LOCATIONS) if (!tutorialMode && !progress.discoveredLocations.includes(l.id) && Math.hypot(camera.position.x - l.pos[0], camera.position.y - l.pos[1], camera.position.z - l.pos[2]) < (l.id === 'hollow' ? 9 : 7.5)) { progress.discoveredLocations.push(l.id); survey.dirty = true; toast(`Surveyed: ${l.name}`); }
    progress.bestDepth = Math.max(progress.bestDepth, dive.depth);
    if ((saveTimer += dt) > 6) { saveTimer = 0; if (survey.dirty) persist(); }
    // endings: decided by what you actually did once you are back at the surface
    if (camera.position.z < -60) progress.storyFlags.enteredCave = true;
    if (!endingShown && progress.storyFlags.enteredCave && camera.position.z > -43 && camera.position.y > -1.6) {
      const id = chooseEnding(progress, LOCATIONS.length);
      if (id) { endingShown = true; if (!progress.endingsSeen.includes(id)) progress.endingsSeen.push(id); persist(); $('ending-title').textContent = ENDINGS[id].title; $('ending-text').textContent = ENDINGS[id].text; $('ending').hidden = false; document.exitPointerLock?.(); }
    }
    // HUD
    const label = player.locked ? interactions.update(camera) : null;
    hud.prompt.textContent = label ? `[${keyName(getSettings().bindings.interact)}] ${label}` : ''; hud.prompt.style.opacity = label ? 1 : 0;
    hud.uw.style.opacity = dive.submerged ? 1 : 0;
    const left = equipment.tank.attached ? dive.air : dive.breath;
    hud.air.style.width = left.toFixed(0) + '%'; hud.air.className = left < 15 ? 'crit' : left < 30 ? 'low' : '';
    hud.airTxt.textContent = left.toFixed(0) + '%' + (equipment.tank.attached ? '' : ' (breath)'); hud.depth.textContent = dive.depth.toFixed(1) + ' m';
    hud.press.textContent = dive.pressure.toFixed(2) + ' bar'; hud.warn.textContent = dive.warning;
    hud.light.textContent = equipment.flashlight.on ? equipment.flashlight.battery.toFixed(0) + '%' : 'OFF';
    if (dive.dead && !dead) { dead = true; $('dead').hidden = false; document.exitPointerLock?.(); persist(); }
    renderer.render(scene, camera);
  });
}
boot().catch(e => fail(`Failed to start: ${e.message}`));
