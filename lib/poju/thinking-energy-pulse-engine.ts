/** Canvas physics + particles for reasoning pulse visualization (no raw text). */

export type HudFlash = {
  text: string;
  x: number;
  y: number;
  born: number;
  ttl: number;
};

export type PulseParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
};

export type PulseWaveLayer = {
  amplitude: number;
  frequency: number;
  phase: number;
  speed: number;
  color: string;
  lineWidth: number;
  glow: boolean;
};

const HUD_TAGS = ["[CALCULATION]", "[SYNTHESIS]", "[VALIDATION]", "[ALIGNMENT]", "[MATRIX]"];

export class ThinkingEnergyPulseEngine {
  energy = 0.12;
  frequency = 1;
  globalPhase = 0;
  fadeAlpha = 1;
  fading = false;
  width = 400;
  height = 72;
  lastChunkAt = 0;
  particles: PulseParticle[] = [];
  hudFlashes: HudFlash[] = [];
  hudDotPhase = 0;

  readonly layers: PulseWaveLayer[] = [
    { amplitude: 0.34, frequency: 2.1, phase: 0, speed: 1.0, color: "rgba(229, 193, 88, 0.45)", lineWidth: 1.2, glow: false },
    { amplitude: 0.4, frequency: 1.6, phase: 1.2, speed: 0.85, color: "rgba(177, 242, 121, 0.38)", lineWidth: 1.4, glow: false },
    { amplitude: 0.52, frequency: 1.2, phase: 2.4, speed: 1.1, color: "rgba(229, 193, 88, 0.55)", lineWidth: 1.8, glow: true },
    { amplitude: 0.28, frequency: 2.8, phase: 0.8, speed: 1.3, color: "rgba(177, 242, 121, 0.28)", lineWidth: 1, glow: false },
    { amplitude: 0.24, frequency: 3.4, phase: 3.1, speed: 0.7, color: "rgba(229, 193, 88, 0.25)", lineWidth: 0.9, glow: false },
  ];

  resize(w: number, h: number) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
  }

  /** Call when a new reasoning chunk arrives (text is not displayed — only drives energy). */
  onChunkReceived(chunkText?: string) {
    const len = chunkText?.length ?? 12;
    const boost = Math.min(1, len / 48);
    this.energy = Math.min(1, this.energy + 0.18 + boost * 0.42);
    this.frequency = Math.min(3.8, this.frequency + 0.35 + boost * 0.5);
    this.lastChunkAt = performance.now();
    this.fading = false;
    this.fadeAlpha = 1;
    this.spawnParticles(2 + Math.floor(boost * 4));
    if (Math.random() < 0.35) this.spawnHudFlash();
  }

  startFadeOut() {
    this.fading = true;
  }

  tick(now: number, dtMs: number) {
    const dt = dtMs / 1000;
    const idle = now - this.lastChunkAt;

    if (idle > 200 && !this.fading) {
      this.energy = Math.max(0.08, this.energy * (1 - dt * 2.8));
      this.frequency += (1 - this.frequency) * dt * 3.2;
    }

    if (this.fading) {
      this.fadeAlpha = Math.max(0, this.fadeAlpha - dt * 1.6);
      this.energy = Math.max(0, this.energy - dt * 0.9);
    }

    this.globalPhase += dt * (0.9 + this.frequency * 0.55);
    this.hudDotPhase += dt * 4;

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= dt * 8;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    this.hudFlashes = this.hudFlashes.filter((h) => now - h.born < h.ttl);
  }

  isDone(): boolean {
    return this.fading && this.fadeAlpha <= 0.01;
  }

  private spawnParticles(count: number) {
    const midY = this.height * 0.5;
    for (let i = 0; i < count; i++) {
      const x = this.width * (0.25 + Math.random() * 0.5);
      this.particles.push({
        x,
        y: midY + (Math.random() - 0.5) * this.height * 0.35 * this.energy,
        vx: (Math.random() - 0.5) * 40,
        vy: -20 - Math.random() * 30 * this.energy,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        size: 1 + Math.random() * 1.8,
      });
    }
  }

  private spawnHudFlash() {
    const text = HUD_TAGS[Math.floor(Math.random() * HUD_TAGS.length)]!;
    this.hudFlashes.push({
      text,
      x: this.width * (0.2 + Math.random() * 0.55),
      y: this.height * (0.15 + Math.random() * 0.35),
      born: performance.now(),
      ttl: 1200 + Math.random() * 800,
    });
  }

  waveY(layer: PulseWaveLayer, xNorm: number, now: number): number {
    const amp = layer.amplitude * this.energy * this.height * 0.68;
    const omega = layer.frequency * (0.85 + this.frequency * 0.22);
    const phi = layer.phase + this.globalPhase * layer.speed;
    const primary = Math.sin(omega * xNorm * Math.PI * 2 + phi);
    const secondary = Math.sin(omega * 1.85 * xNorm * Math.PI * 2 + phi * 1.25) * 0.42;
    return this.height * 0.5 + amp * (primary + secondary);
  }
}
