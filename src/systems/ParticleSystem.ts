import { Vector2 } from '../core/Vector2';

export interface Particle {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
  lifetime: number;
  maxLifetime: number;
  alpha: number;
  gravity?: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.lifetime -= dt;

      if (p.lifetime <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.position.addScaled(p.velocity, dt);

      if (p.gravity) {
        p.velocity.y += p.gravity * dt;
      }

      p.alpha = Math.max(0, p.lifetime / p.maxLifetime);
    }
  }

  public emitHit(x: number, y: number, color = '#f87171', count = 5): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      const lifetime = 0.2 + Math.random() * 0.25;

      this.particles.push({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 2 + Math.random() * 2.5,
        color,
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 50
      });
    }
  }

  public emitDeath(x: number, y: number, color = '#78716c', count = 12): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      const lifetime = 0.35 + Math.random() * 0.35;

      this.particles.push({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 3 + Math.random() * 3,
        color,
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 30
      });
    }
  }

  public emitLevelUpFanfare(x: number, y: number): void {
    const colors = ['#fbbf24', '#f59e0b', '#38bdf8', '#a855f7', '#ffffff'];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 220;
      const lifetime = 0.6 + Math.random() * 0.5;

      this.particles.push({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 3 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 80
      });
    }
  }

  public emitChestFountain(x: number, y: number): void {
    const colors = ['#fde047', '#fbbf24', '#f59e0b', '#ffffff'];
    for (let i = 0; i < 50; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const speed = 120 + Math.random() * 260;
      const lifetime = 0.8 + Math.random() * 0.6;

      this.particles.push({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 3 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 240
      });
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
