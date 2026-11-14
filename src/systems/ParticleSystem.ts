import { Vector2 } from '../core/Vector2';
import { drawConcentricRuneHalo, drawFiligreeSpikeRing, drawFourPointStar } from '../vfx/GothicVFX';

export type ParticleShape = 'ORB' | 'SPARK' | 'SHARD' | 'RING' | 'SLASH' | 'SIGIL' | 'CROSS_STAR' | 'THORN';

const MAX_PARTICLES = 680;

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

  private pushParticle(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

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
      if ((p.shape === 'RING' || p.shape === 'SIGIL') && p.maxRadius) {
        p.radius = p.maxRadius * (0.2 + 0.8 * Math.pow(progress, 0.58));
      }

      p.alpha = Math.max(0, p.lifetime / p.maxLifetime);
    }
  }

  public emitHit(x: number, y: number, color = '#f87171', count = 6): void {
    // 1. Expanding Gothic Impact Shockwave Ring
    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 4,
      maxRadius: count >= 10 ? 32 : 24,
      color,
      lifetime: 0.18,
      maxLifetime: 0.18,
      alpha: 0.9,
      shape: 'RING',
      rotation: Math.random() * Math.PI,
      rotationSpeed: 2.2,
      additive: true
    });

    // Core Gothic Star Glint on heavier strikes
    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: count >= 10 ? 15 : 10,
      color,
      lifetime: 0.13,
      maxLifetime: 0.13,
      alpha: 0.95,
      shape: 'CROSS_STAR',
      rotation: Math.random() * Math.PI * 0.5,
      rotationSpeed: 4,
      additive: true
    });

    // 2. High-Velocity Directional Sparks & Barbed Crimson Thorns
    const actualCount = Math.min(20, count + 2);
    for (let i = 0; i < actualCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 75 + Math.random() * 190;
      const lifetime = 0.18 + Math.random() * 0.24;
      const isThorn = i % 3 === 1;

      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: isThorn ? 3.0 + Math.random() * 2.5 : 2 + Math.random() * 2.4,
        color: i % 4 === 0 ? '#ffffff' : color,
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: isThorn ? 95 : 55,
        shape: isThorn ? 'THORN' : 'SPARK',
        rotation: angle,
        rotationSpeed: isThorn ? (Math.random() - 0.5) * 10 : 0,
        additive: !isThorn || i % 2 === 0
      });
    }
  }

  public emitSlashImpact(x: number, y: number, angle: number, color = '#38bdf8', isCrit = false): void {
    // 1. Primary Razor Cross-Slash Streak (刀光斩击裂痕)
    const mainLen = isCrit ? 48 : 34;
    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: mainLen,
      color: '#ffffff',
      lifetime: 0.15,
      maxLifetime: 0.15,
      alpha: 1.0,
      shape: 'SLASH',
      rotation: angle + (Math.random() - 0.5) * 0.45,
      rotationSpeed: 0,
      additive: true
    });

    // Secondary intersecting cross-slash for crits or parries
    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: mainLen * (isCrit ? 0.9 : 0.68),
      color,
      lifetime: 0.17,
      maxLifetime: 0.17,
      alpha: 0.95,
      shape: 'SLASH',
      rotation: angle + Math.PI * 0.52 + (Math.random() - 0.5) * 0.35,
      rotationSpeed: 0,
      additive: true
    });

    if (isCrit) {
      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(0, 0),
        radius: 19,
        color: '#fde047',
        lifetime: 0.22,
        maxLifetime: 0.22,
        alpha: 1.0,
        shape: 'CROSS_STAR',
        rotation: angle,
        rotationSpeed: 5,
        additive: true
      });
    }

    // 2. Expanding Impact Shockwave Ring
    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 5,
      maxRadius: isCrit ? 38 : 26,
      color,
      lifetime: 0.19,
      maxLifetime: 0.19,
      alpha: 0.92,
      shape: 'RING',
      rotation: angle,
      rotationSpeed: 3,
      additive: true
    });

    // 3. High-Velocity Directional Sword-Qi Sparks & Thorns
    const sparkCount = isCrit ? 14 : 9;
    for (let i = 0; i < sparkCount; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * 1.6;
      const speed = 115 + Math.random() * 240;
      const lifetime = 0.17 + Math.random() * 0.2;

      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(spreadAngle) * speed, Math.sin(spreadAngle) * speed),
        radius: 2.2 + Math.random() * 2.8,
        color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 && isCrit ? '#fde047' : color,
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 35,
        shape: i % 4 === 2 ? 'THORN' : 'SPARK',
        rotation: spreadAngle,
        rotationSpeed: 0,
        additive: true
      });
    }
  }

  /**
   * 剑气弹反（Parry）圣殿十字星芒爆发特效
   */
  public emitParryBurst(x: number, y: number, angle: number): void {
    this.emitSlashImpact(x, y, angle, '#34d399', true);

    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 10,
      maxRadius: 48,
      color: '#fde047',
      lifetime: 0.26,
      maxLifetime: 0.26,
      alpha: 0.95,
      shape: 'SIGIL',
      rotation: angle,
      rotationSpeed: 4.5,
      additive: true
    });

    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 26,
      color: '#34d399',
      lifetime: 0.24,
      maxLifetime: 0.24,
      alpha: 1.0,
      shape: 'CROSS_STAR',
      rotation: angle + Math.PI * 0.25,
      rotationSpeed: 6,
      additive: true
    });

    for (let i = 0; i < 10; i++) {
      const spread = angle + (Math.random() - 0.5) * 1.1;
      const speed = 150 + Math.random() * 240;
      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(spread) * speed, Math.sin(spread) * speed),
        radius: 2.6 + Math.random() * 2.2,
        color: i % 2 === 0 ? '#fef08a' : '#34d399',
        lifetime: 0.24 + Math.random() * 0.14,
        maxLifetime: 0.38,
        alpha: 1.0,
        gravity: 25,
        shape: 'SPARK',
        rotation: spread,
        rotationSpeed: 0,
        additive: true
      });
    }
  }

  /**
   * 暗影冲刺仪式爆发（地面遗留晦暗印记与猩红/冷青羽毛拖尾）
   */
  public emitDashBurst(x: number, y: number, dirAngle: number, color = '#38bdf8'): void {
    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 10,
      maxRadius: 44,
      color,
      lifetime: 0.32,
      maxLifetime: 0.32,
      alpha: 0.85,
      shape: 'SIGIL',
      rotation: dirAngle,
      rotationSpeed: -3.2,
      additive: true
    });

    for (let i = 0; i < 12; i++) {
      const backAng = dirAngle + Math.PI + (Math.random() - 0.5) * 1.5;
      const speed = 80 + Math.random() * 190;
      const isDark = i % 3 === 0;
      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(backAng) * speed, Math.sin(backAng) * speed),
        radius: isDark ? 4.2 : 2.8 + Math.random() * 2,
        color: isDark ? '#dc2626' : i % 2 === 0 ? '#ffffff' : color,
        lifetime: 0.22 + Math.random() * 0.18,
        maxLifetime: 0.4,
        alpha: 0.95,
        gravity: 30,
        shape: i % 2 === 0 ? 'THORN' : 'SPARK',
        rotation: backAng,
        rotationSpeed: 0,
        additive: !isDark
      });
    }
  }

  public emitDeath(x: number, y: number, color = '#ef4444', count = 14): void {
    // 1. Expanding Soul & Ritual Seal Shockwave
    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 6,
      maxRadius: 38,
      color: '#dc2626',
      lifetime: 0.28,
      maxLifetime: 0.28,
      alpha: 0.9,
      shape: 'RING',
      rotation: Math.random() * Math.PI,
      rotationSpeed: 2.5,
      additive: true
    });

    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 8,
      maxRadius: 32,
      color: '#c084fc',
      lifetime: 0.32,
      maxLifetime: 0.32,
      alpha: 0.65,
      shape: 'SIGIL',
      rotation: Math.random() * Math.PI,
      rotationSpeed: -2.4,
      additive: true
    });

    const palette = ['#dc2626', '#991b1b', '#e2e8f0', '#f97316', '#c084fc', color];
    const total = Math.min(24, count + 4);
    for (let i = 0; i < total; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 65 + Math.random() * 205;
      const lifetime = 0.3 + Math.random() * 0.38;
      const shape: ParticleShape = i % 3 === 0 ? 'THORN' : i % 3 === 1 ? 'SHARD' : 'ORB';

      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 2.6 + Math.random() * 3.6,
        color: palette[i % palette.length],
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: shape === 'ORB' ? -45 : 95,
        shape,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 14,
        additive: shape !== 'SHARD' && i % 2 === 0
      });
    }
  }

  public emitLevelUpFanfare(x: number, y: number): void {
    const colors = ['#fbbf24', '#f59e0b', '#38bdf8', '#a855f7', '#ffffff'];
    // Double Golden Cathedral Ritual Halo Rings
    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 14,
      maxRadius: 135,
      color: '#fde047',
      lifetime: 0.65,
      maxLifetime: 0.65,
      alpha: 0.95,
      shape: 'SIGIL',
      rotation: 0,
      rotationSpeed: 2.0,
      additive: true
    });

    for (let r = 0; r < 2; r++) {
      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(0, 0),
        radius: 10,
        maxRadius: 92 + r * 48,
        color: r === 0 ? '#fbbf24' : '#38bdf8',
        lifetime: 0.55,
        maxLifetime: 0.55,
        alpha: 1.0,
        shape: 'RING',
        rotation: r * 0.4,
        rotationSpeed: r === 0 ? 1.5 : -1.5,
        additive: true
      });
    }

    for (let i = 0; i < 52; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 95 + Math.random() * 260;
      const lifetime = 0.6 + Math.random() * 0.55;
      const shape: ParticleShape = i % 5 === 0 ? 'CROSS_STAR' : i % 2 === 0 ? 'SPARK' : 'ORB';

      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: shape === 'CROSS_STAR' ? 6.5 : 3 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 70,
        shape,
        rotation: angle,
        rotationSpeed: 6,
        additive: true
      });
    }
  }

  public emitChestFountain(x: number, y: number): void {
    const colors = ['#fde047', '#fbbf24', '#f59e0b', '#ffffff', '#ef4444'];
    this.pushParticle({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 14,
      maxRadius: 110,
      color: '#fbbf24',
      lifetime: 0.6,
      maxLifetime: 0.6,
      alpha: 0.9,
      shape: 'SIGIL',
      rotation: 0,
      rotationSpeed: -2.2,
      additive: true
    });

    for (let i = 0; i < 65; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.75;
      const speed = 135 + Math.random() * 290;
      const lifetime = 0.8 + Math.random() * 0.6;
      const shape: ParticleShape = i % 6 === 0 ? 'CROSS_STAR' : i % 3 === 0 ? 'SHARD' : 'ORB';

      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: shape === 'CROSS_STAR' ? 7.5 : 3 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: 230,
        shape,
        rotation: Math.random() * Math.PI,
        rotationSpeed: 10,
        additive: true
      });
    }
  }

  /**
   * 首领击杀终结演出：多层教堂玫瑰大阵冲击波 + 12向次元斩痕 + 圣金符文碎片爆裂
   */
  public emitBossSlainBurst(x: number, y: number): void {
    // 1. Triple Concentric Radial Shockwaves + Dual Counter-Rotating Cathedral Seals
    const ringColors = ['#ffffff', '#fde047', '#ef4444'];
    for (let r = 0; r < 3; r++) {
      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(0, 0),
        radius: 12 + r * 8,
        maxRadius: 190 + r * 105,
        color: ringColors[r],
        lifetime: 0.58 + r * 0.14,
        maxLifetime: 0.58 + r * 0.14,
        alpha: 1.0,
        shape: 'RING',
        rotation: r * 0.4,
        rotationSpeed: (r % 2 === 0 ? 1 : -1) * 1.8,
        additive: true
      });
    }

    for (let s = 0; s < 2; s++) {
      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(0, 0),
        radius: 20,
        maxRadius: 210 + s * 65,
        color: s === 0 ? '#fde047' : '#ef4444',
        lifetime: 0.72 + s * 0.12,
        maxLifetime: 0.72 + s * 0.12,
        alpha: 0.95,
        shape: 'SIGIL',
        rotation: s * 0.4,
        rotationSpeed: s === 0 ? 1.8 : -2.2,
        additive: true
      });
    }

    // 2. 12-Way Cross-Slash Dimensional Rifts
    for (let s = 0; s < 12; s++) {
      const ang = (s * Math.PI) / 6;
      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(ang) * 105, Math.sin(ang) * 105),
        radius: s % 2 === 0 ? 64 : 46,
        color: s % 2 === 0 ? '#fef08a' : '#ef4444',
        lifetime: 0.4,
        maxLifetime: 0.4,
        alpha: 1.0,
        shape: 'SLASH',
        rotation: ang,
        rotationSpeed: 0,
        additive: true
      });
    }

    // 3. Sacred Golden Runic Shards, Gothic Cross-Stars & Sparks Eruption
    const palette = ['#ffffff', '#fef08a', '#fbbf24', '#f59e0b', '#ef4444', '#c084fc'];
    for (let i = 0; i < 95; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 85 + Math.random() * 410;
      const lifetime = 0.65 + Math.random() * 0.8;
      const shape: ParticleShape =
        i % 5 === 0 ? 'CROSS_STAR' : i % 4 === 0 ? 'THORN' : i % 3 === 0 ? 'SHARD' : i % 3 === 1 ? 'SPARK' : 'ORB';

      this.pushParticle({
        position: new Vector2(x, y),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: shape === 'CROSS_STAR' ? 6.5 + Math.random() * 4 : 3 + Math.random() * 4.5,
        color: palette[i % palette.length],
        lifetime,
        maxLifetime: lifetime,
        alpha: 1.0,
        gravity: shape === 'SHARD' || shape === 'THORN' ? 140 : 45,
        shape,
        rotation: angle,
        rotationSpeed: (Math.random() - 0.5) * 16,
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
        case 'RING': {
          if (p.radius >= 26) {
            drawFiligreeSpikeRing(
              ctx,
              0,
              0,
              p.radius,
              8,
              Math.min(9, p.radius * 0.16),
              p.color,
              p.rotation,
              Math.max(1, 2.8 * p.alpha)
            );
            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = p.alpha * 0.55;
            ctx.lineWidth = Math.max(0.7, 1.3 * p.alpha);
            ctx.beginPath();
            ctx.arc(0, 0, p.radius * 0.78, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(1, 3 * p.alpha);
            ctx.beginPath();
            ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        }

        case 'SIGIL': {
          drawConcentricRuneHalo(ctx, {
            x: 0,
            y: 0,
            r: p.radius,
            primaryColor: p.color,
            accentColor: '#ffffff',
            rotation: p.rotation,
            spokes: p.radius > 70 ? 12 : 6,
            polygonSides: p.radius > 80 ? 8 : 6,
            polygonStep: 2,
            ringWidth: Math.max(1.0, 2.4 * p.alpha),
            showNodes: true,
            dashedInner: true
          });
          break;
        }

        case 'CROSS_STAR': {
          drawFourPointStar(ctx, 0, 0, p.radius * 1.9, p.radius * 0.34, p.color, '#ffffff', p.rotation);
          break;
        }

        case 'THORN': {
          ctx.rotate(p.rotation);
          const len = p.radius * 2.5;
          const w = p.radius * 0.62;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(len, 0);
          ctx.lineTo(-len * 0.35, -w);
          ctx.lineTo(-len * 0.75, 0);
          ctx.lineTo(-len * 0.35, w);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(len * 0.72, 0);
          ctx.lineTo(-len * 0.15, -w * 0.35);
          ctx.lineTo(-len * 0.15, w * 0.35);
          ctx.closePath();
          ctx.fill();
          break;
        }

        case 'SPARK': {
          const ang = Math.atan2(p.velocity.y, p.velocity.x);
          ctx.rotate(ang);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.radius * 2.6, p.radius * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'SLASH': {
          ctx.rotate(p.rotation);
          const progress = 1 - p.lifetime / p.maxLifetime;
          const stretch = 0.65 + 0.58 * Math.sin(progress * Math.PI);
          const halfLen = p.radius * stretch;
          const thickness = Math.max(1.2, (1 - progress) * 5.6);

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
          ctx.moveTo(-halfLen * 0.82, 0);
          ctx.quadraticCurveTo(0, -thickness * 0.46, halfLen * 0.82, 0);
          ctx.quadraticCurveTo(0, thickness * 0.46, -halfLen * 0.82, 0);
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
