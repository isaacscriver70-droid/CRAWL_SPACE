// Game bootstrap: renderer, world, controller, loop, settings hookup, failure handling.
import * as THREE from 'three';
import { getSettings, onSettingsChange } from './settings.js';
import { loadProgress } from './save.js';
import { buildWorld, LOCATIONS } from './world.js';
import { FirstPersonController } from './movement.js';
import { keyName } from './ui.js';
import { DiveState, Bubbles } from './underwater.js';
import { WATER_LEVEL } from './cave.js';

const $ = id => document.getElementById(id);
function fail(msg) { $('loading').hidden = true; $('fatal-msg').textContent = msg; $('fatal').hidden = false; }
const webgl2 = () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };

async function boot() {
  if (!webgl2()) return fail('WebGL 2 is not available in this browser, so the game cannot run.');
  const save = loadProgress();
  if (!save.ok) return fail(`Your save could not be read: ${save.error}`);

  const canvas = $('view');
  const q = getSettings().graphics;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = q !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(getSettings().fov, 1, 0.05, 600);

  $('loading-text').textContent = 'Carving the cave…';
  await new Promise(r => setTimeout(r, 40));            // let the loading screen paint before heavy work
  const world = buildWorld(scene);
  const player = new FirstPersonController(camera, canvas, world, locked => {
    document.body.classList.toggle('playing', locked); $('start').hidden = locked;
  });

  // Developer options: ?at=<location id> teleports for inspection, ?fly=1 enables collision-free flight.
  const params = new URLSearchParams(location.search), at = LOCATIONS.find(l => l.id === params.get('at'));
  if (at) { player.pos.x = at.pos[0]; player.pos.y = at.pos[1]; player.pos.z = at.pos[2]; player.yaw = Math.PI; }
  player.fly = params.get('fly') === '1' || (!!at && params.get('fly') !== '0');

  // Handheld light (first version; the 3D flashlight object, scattering and sediment come in Stage 6)
  const torch = new THREE.SpotLight(0xfff0d8, 320, 60, 0.45, 0.5, 1.6);
  torch.position.set(0.18, -0.12, 0); torch.target.position.set(0, 0, -6); torch.castShadow = getSettings().graphics !== 'low';
  torch.shadow.mapSize.set(1024, 1024); torch.shadow.camera.near = 0.1; torch.shadow.camera.far = 50; torch.shadow.bias = -0.0005;
  camera.add(torch, torch.target); scene.add(camera);
  addEventListener('keydown', e => { if (player.locked && e.code === getSettings().bindings.flashlight && !e.repeat) torch.visible = !torch.visible; });

  const ratio = () => ({ low: 0.75, medium: 1, high: Math.min(devicePixelRatio, 2) })[getSettings().graphics] ?? 1;
  function resize() {
    renderer.setPixelRatio(ratio()); renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); onSettingsChange(resize); resize();

  const b = getSettings().bindings;
  $('controls-list').textContent = [`Move ${keyName(b.forward)}${keyName(b.left)}${keyName(b.backward)}${keyName(b.right)}`,
    `Sprint ${keyName(b.sprint)}`, `Crouch ${keyName(b.crouch)}`, `Jump ${keyName(b.jump)}`, 'Mouse to look'].join('  ·  ');
  $('start').addEventListener('click', () => player.lock());
  $('loading').hidden = true; $('start').hidden = false;

  const dive = new DiveState(), bubbles = new Bubbles(scene);
  const hud = { air: $('o2bar'), airTxt: $('o2txt'), depth: $('depth'), press: $('press'), warn: $('warn'), uw: $('uw') };
  const underColor = new THREE.Color(0x06222b);
  $('hud').hidden = false;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    if (player.locked) player.update(dt); else player.update(0.0001);
    world.update(dt, camera);
    if (!player.fly) dive.update(player.locked ? dt : 0, camera.position.y, player.speed);
    bubbles.update(dt, camera, dive.submerged);
    if (dive.submerged) {                                             // underwater look: dense blue-green fog, darker with depth
      scene.fog.color.copy(underColor); scene.fog.density = 0.075 + dive.depth * 0.002; scene.background.copy(underColor);
    }
    hud.uw.style.opacity = dive.submerged ? 1 : 0;
    hud.air.style.width = dive.air.toFixed(0) + '%'; hud.air.className = dive.air < 15 ? 'crit' : dive.air < 30 ? 'low' : '';
    hud.airTxt.textContent = dive.air.toFixed(0) + '%'; hud.depth.textContent = dive.depth.toFixed(1) + ' m';
    hud.press.textContent = dive.pressure.toFixed(2) + ' bar'; hud.warn.textContent = dive.warning;
    if (dive.dead && $('dead').hidden) { $('dead').hidden = false; document.exitPointerLock?.(); }
    renderer.render(scene, camera);
  });
}
boot().catch(e => fail(`Failed to start: ${e.message}`));
