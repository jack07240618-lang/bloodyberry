import { Vector2 } from '../core/Vector2';

export type ParticleShape = 'ORB' | 'SPARK' | 'SHARD' | 'RING' | 'SLASH';

export interface Particle {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  maxRadius?: number;
  color: string;
  lifetime: number;
  maxLifetime: number;
  alpha: number;
  gravity?: number;
  shape: ParticleShape;
  rotation: number;
  rotationSpeed: number;
  additive: boolean;
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
      p.rotation += p.rotationSpeed * dt;

      if (p.gravity) {
        p.velocity.y += p.gravity * dt;
      }

      // Air drag for snappy impact bursts
      p.velocity.multiplyScalar(Math.pow(0.92, dt * 60));

      const progress = 1 - p.lifetime / p.maxLifetime;
      if (p.shape === 'RING' && p.maxRadius) {
        p.radius = p.maxRadius * (0.2 + 0.8 * Math.pow(progress, 0.6));
      }

      p.alpha = Math.max(0, p.lifetime / p.maxLifetime);
    }
  }

  public emitHit(x: number, y: number, color = '#f87171', count = 6): void {
    // 1. Expanding Impact Shockwave Ring
    this.particles.push({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 4,
      maxRadius: 22,
      color,
      lifetime: 0.16,
      maxLifetime: 0.16,
      alpha: 0.85,
      shape: 'RING',
      rotation: 0,
      rotationSpeed: 0,
      additive: true
    });

    // 2. High-Velocity Directional Sparks
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 170;
      const lifetime = 0.18 + Math.random() * 0.22;

      this.particles.push({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 2 + Math.random() * 2.5,
        color: i % 3 === 0 ? '#ffffff' : color,
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 60,
        shape: 'SPARK',
        rotation: angle,
        rotationSpeed: 0,
        additive: true
      });
    }
  }

  public emitSlashImpact(x: number, y: number, angle: number, color = '#38bdf8', isCrit = false): void {
    // 1. Primary Razor Cross-Slash Streak (刀光斩击裂痕)
    const mainLen = isCrit ? 42 : 30;
    this.particles.push({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: mainLen,
      color: '#ffffff',
      lifetime: 0.14,
      maxLifetime: 0.14,
      alpha: 1.0,
      shape: 'SLASH',
      rotation: angle + (Math.random() - 0.5) * 0.45,
      rotationSpeed: 0,
      additive: true
    });

    // Secondary intersecting cross-slash for crits or parries
    this.particles.push({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: mainLen * (isCrit ? 0.85 : 0.65),
      color,
      lifetime: 0.16,
      maxLifetime: 0.16,
      alpha: 0.92,
      shape: 'SLASH',
      rotation: angle + Math.PI * 0.52 + (Math.random() - 0.5) * 0.35,
      rotationSpeed: 0,
      additive: true
    });

    // 2. Expanding Impact Shockwave Ring
    this.particles.push({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 5,
      maxRadius: isCrit ? 34 : 24,
      color,
      lifetime: 0.17,
      maxLifetime: 0.17,
      alpha: 0.9,
      shape: 'RING',
      rotation: 0,
      rotationSpeed: 0,
      additive: true
    });

    // 3. High-Velocity Directional Sword-Qi Sparks
    const sparkCount = isCrit ? 11 : 7;
    for (let i = 0; i < sparkCount; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * 1.45;
      const speed = 110 + Math.random() * 230;
      const lifetime = 0.16 + Math.random() * 0.18;

      this.particles.push({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(spreadAngle) * speed, Math.sin(spreadAngle) * speed),
        radius: 2.2 + Math.random() * 2.6,
        color: i % 2 === 0 ? '#ffffff' : color,
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 35,
        shape: 'SPARK',
        rotation: spreadAngle,
        rotationSpeed: 0,
        additive: true
      });
    }
  }

  public emitDeath(x: number, y: number, color = '#ef4444', count = 14): void {
    // Expanding Death Soul Shockwave
    this.particles.push({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 6,
      maxRadius: 36,
      color: '#f87171',
      lifetime: 0.28,
      maxLifetime: 0.28,
      alpha: 0.9,
      shape: 'RING',
      rotation: 0,
      rotationSpeed: 0,
      additive: true
    });

    const palette = ['#dc2626', '#ef4444', '#e2e8f0', '#f97316', color];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 190;
      const lifetime = 0.3 + Math.random() * 0.35;
      const isShard = i % 2 === 0;

      this.particles.push({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 2.5 + Math.random() * 3.5,
        color: palette[i % palette.length],
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 90,
        shape: isShard ? 'SHARD' : 'ORB',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 14,
        additive: !isShard
      });
    }
  }

  public emitLevelUpFanfare(x: number, y: number): void {
    const colors = ['#fbbf24', '#f59e0b', '#38bdf8', '#a855f7', '#ffffff'];
    // Double Golden Halo Rings
    for (let r = 0; r < 2; r++) {
      this.particles.push({
        position: new Vector2(x, y),
        velocity: new Vector2(0, 0),
        radius: 10,
        maxRadius: 90 + r * 45,
        color: r === 0 ? '#fbbf24' : '#38bdf8',
        lifetime: 0.55,
        maxLifetime: 0.55,
        alpha: 1.0,
        shape: 'RING',
        rotation: 0,
        rotationSpeed: 0,
        additive: true
      });
    }

    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 250;
      const lifetime = 0.6 + Math.random() * 0.5;

      this.particles.push({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 3 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 70,
        shape: i % 2 === 0 ? 'SPARK' : 'ORB',
        rotation: angle,
        rotationSpeed: 6,
        additive: true
      });
    }
  }

  public emitChestFountain(x: number, y: number): void {
    const colors = ['#fde047', '#fbbf24', '#f59e0b', '#ffffff', '#38bdf8'];
    for (let i = 0; i < 55; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 130 + Math.random() * 280;
      const lifetime = 0.8 + Math.random() * 0.6;

      this.particles.push({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 3 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 230,
        shape: i % 3 === 0 ? 'SHARD' : 'ORB',
        rotation: Math.random() * Math.PI,
        rotationSpeed: 10,
        additive: true
      });
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.position.x, p.position.y);
      ctx.globalAlpha = p.alpha;
      if (p.additive) {
        ctx.globalCompositeOperation = 'lighter';
      }

      switch (p.shape) {
        case 'RING':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, 3 * p.alpha);
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.stroke();
          break;

        case 'SPARK': {
          const ang = Math.atan2(p.velocity.y, p.velocity.x);
          ctx.rotate(ang);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.radius * 2.4, p.radius * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'SLASH': {
          ctx.rotate(p.rotation);
          const progress = 1 - p.lifetime / p.maxLifetime;
          const stretch = 0.65 + 0.55 * Math.sin(progress * Math.PI);
          const halfLen = p.radius * stretch;
          const thickness = Math.max(1.2, (1 - progress) * 5.2);

          // Outer colored blade flare
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(-halfLen, 0);
          ctx.quadraticCurveTo(0, -thickness, halfLen, 0);
          ctx.quadraticCurveTo(0, thickness, -halfLen, 0);
          ctx.closePath();
          ctx.fill();

          // White-hot inner razor core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(-halfLen * 0.78, 0);
          ctx.quadraticCurveTo(0, -thickness * 0.48, halfLen * 0.78, 0);
          ctx.quadraticCurveTo(0, thickness * 0.48, -halfLen * 0.78, 0);
          ctx.closePath();
          ctx.fill();
          break;
        }

        case 'SHARD':
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, -p.radius);
          ctx.lineTo(p.radius * 0.85, p.radius * 0.7);
          ctx.lineTo(-p.radius * 0.85, p.radius * 0.7);
          ctx.closePath();
          ctx.fill();
          break;

        default:
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fill();
          break;
      }

      ctx.restore();
    }
  }
}
