// Game bootstrap: renderer, world, controller, loop, settings hookup, failure handling.
import * as THREE from 'three';
import { getSettings, onSettingsChange } from './settings.js';
import { loadProgress } from './save.js';
import { buildWorld } from './world.js';
import { FirstPersonController } from './movement.js';
import { keyName } from './ui.js';

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

  $('loading-text').textContent = 'Building terrain…';
  await new Promise(r => setTimeout(r, 40));            // let the loading screen paint before heavy work
  const world = buildWorld(scene);
  const player = new FirstPersonController(camera, canvas, world, locked => {
    document.body.classList.toggle('playing', locked); $('start').hidden = locked;
  });

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

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    if (player.locked) player.update(dt); else player.update(0.0001);
    world.update(dt, camera);
    renderer.render(scene, camera);
  });
}
boot().catch(e => fail(`Failed to start: ${e.message}`));
