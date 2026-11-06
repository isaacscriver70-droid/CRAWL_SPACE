// Equipment state: flashlight (battery), oxygen tank (attached or not), regulator condition.
export class Equipment {
  constructor() {
    this.flashlight = { on: true, battery: 100 };
    this.tank = { attached: true };
    this.regulator = { condition: 100 };
  }
  update(dt, submerged) {
    if (this.flashlight.on) { this.flashlight.battery = Math.max(0, this.flashlight.battery - (100 / 2400) * dt); if (this.flashlight.battery <= 0) this.flashlight.on = false; }   // 40 minutes
    if (submerged && this.tank.attached) this.regulator.condition = Math.max(0, this.regulator.condition - 0.002 * dt);
  }
  // Light strength multiplier: steady, then flickers when the battery is nearly gone.
  lightLevel(t) { if (!this.flashlight.on) return 0; const b = this.flashlight.battery; return b > 12 ? 1 : b > 4 ? 0.65 + 0.35 * Math.abs(Math.sin(t * 9) * Math.sin(t * 2.3)) : 0.35 + 0.35 * Math.abs(Math.sin(t * 17)); }
  rechargeFlashlight() { this.flashlight.battery = 100; }
}
