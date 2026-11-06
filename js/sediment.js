// Sediment and suspended particles. Disturbance clouds spawn where the diver swims close to rock/floor, drift,
// slowly settle and reduce visibility; particles are mostly visible inside the flashlight beam.
import * as THREE from 'three';

export class Sediment {
  constructor(scene, floorDistance) {
    this.floorDistance = floorDistance; this.floorDistance = (x, y, z) => floorDistance(x, y, z);                  // (x,y,z) -> approximate distance to nearest rock/floor
    this.N = 3200; this.M = 420; this.next = 0; this.turbidity = 0;
    const T = this.N + this.M;
    this.pos = new Float32Array(T * 3).fill(1e4); this.alpha = new Float32Array(T); this.vel = new Float32Array(this.N * 3);
    this.age = new Float32Array(this.N); this.life = new Float32Array(this.N).fill(0); this.base = new Float32Array(this.N);
    for (let i = 0; i < this.M; i++) this.vel[0] = 0;
    this.snowSeed = Array.from({ length: this.M }, () => [Math.random() * 8, Math.random() * 8, Math.random() * 8]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uCam: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, 0, -1) }, uBeam: { value: 1 }, uScale: { value: 900 }, uColor: { value: new THREE.Color(0.78, 0.74, 0.62) } },
      vertexShader: `attribute float aAlpha; varying float vA; uniform vec3 uCam,uDir; uniform float uBeam,uScale;
        void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vec3 d=position-uCam; float dist=length(d); float c=dot(d/max(dist,0.001),uDir);
          float beam=uBeam*smoothstep(0.80,0.95,c)*exp(-dist*0.06);
          vA=aAlpha*(0.07+beam*1.2)*smoothstep(0.12,0.6,dist);
          gl_PointSize=clamp(uScale*0.011/max(-mv.z,0.2),1.5,13.0); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; uniform vec3 uColor; void main(){ float r=length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; gl_FragColor=vec4(uColor,vA*(1.0-r*r)); }`
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; scene.add(this.points);
  }

  update(dt, camera, submerged, speed, torchOn) {
    const p = camera.position, d = new THREE.Vector3(); camera.getWorldDirection(d);
    this.mat.uniforms.uCam.value.copy(p); this.mat.uniforms.uDir.value.copy(d); this.mat.uniforms.uBeam.value = torchOn ? 1 : 0; this.mat.uniforms.uScale.value = innerHeight;
    const T = this.N + this.M;
    if (!submerged) { for (let i = 0; i < T; i++) this.pos[i * 3 + 1] = 1e4; this.turbidity *= Math.exp(-dt / 8); this.points.geometry.attributes.position.needsUpdate = true; return; }
    // marine snow: a drifting box of particles around the camera so motion through water is readable
    const t = performance.now() * 0.00008;
    for (let i = 0; i < this.M; i++) {
      const s = this.snowSeed[i], o = (this.N + i) * 3;
      this.pos[o] = p.x + (((s[0] + t * (1 + i % 3) * 3) % 8) - 4); this.pos[o + 1] = p.y + (((s[1] + t * 2) % 8) - 4); this.pos[o + 2] = p.z + (((s[2] + t * (1 + i % 2) * 2) % 8) - 4);
      this.alpha[this.N + i] = 0.35;
    }
    // disturbance: swimming close to rock stirs sediment up
    const fd = this.floorDistance(p.x, p.y, p.z);
    if (speed > 0.3 && fd < 1.3) {
      const n = Math.min(8, Math.ceil(speed * dt * 70 * (1.4 - fd)));
      for (let k = 0; k < n; k++) {
        const j = this.next++ % this.N, o = j * 3, a = Math.random() * 6.28, r = Math.random() * 0.7;
        this.pos[o] = p.x + d.x * 0.5 + Math.cos(a) * r; this.pos[o + 1] = p.y - Math.min(fd, 1.0) * Math.random() + Math.random() * 0.3; this.pos[o + 2] = p.z + d.z * 0.5 + Math.sin(a) * r;
        this.vel[o] = (Math.random() - 0.5) * 0.2 + d.x * 0.05; this.vel[o + 1] = 0.05 + Math.random() * 0.1; this.vel[o + 2] = (Math.random() - 0.5) * 0.2 + d.z * 0.05;
        this.age[j] = 0; this.life[j] = 25 + Math.random() * 25; this.base[j] = 0.5 + Math.random() * 0.4;
      }
      this.turbidity = Math.min(1, this.turbidity + n * 0.0035);
    }
    for (let j = 0; j < this.N; j++) {
      if (this.life[j] <= 0) continue;
      this.age[j] += dt; const o = j * 3;
      if (this.age[j] >= this.life[j]) { this.life[j] = 0; this.pos[o + 1] = 1e4; this.alpha[j] = 0; continue; }
      const drag = Math.exp(-0.9 * dt); this.vel[o] *= drag; this.vel[o + 2] *= drag;
      this.vel[o + 1] += ((this.age[j] > 4 ? -0.03 : 0.04) - this.vel[o + 1]) * Math.min(1, 0.4 * dt);          // rise briefly, then settle
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      this.alpha[j] = this.base[j] * Math.sqrt(1 - this.age[j] / this.life[j]);
    }
    this.turbidity *= Math.exp(-dt / 22);
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.aAlpha.needsUpdate = true;
  }
}
