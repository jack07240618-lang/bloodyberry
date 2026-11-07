import { Vector2 } from '../core/Vector2';
import { Entity } from '../entities/Entity';

export enum ProjectileType {
  DIRECT_BOLT = 'DIRECT_BOLT',
  PIERCING_DAGGER = 'PIERCING_DAGGER',
  ORBITING_ORB = 'ORBITING_ORB',
  GROUND_FIRE = 'GROUND_FIRE',
  LIGHTNING_BOLT = 'LIGHTNING_BOLT',
  BOOMERANG = 'BOOMERANG',
  GARLIC_AURA = 'GARLIC_AURA',
  PENTAGRAM_WIPE = 'PENTAGRAM_WIPE'
}

export class Projectile extends Entity {
  public type: ProjectileType;
  public weaponId: string;
  public damage: number;
  public isCrit: boolean;
  public pierce: number;
  public lifetime: number;
  public maxLifetime: number;
  public hitEnemies: Set<number> = new Set(); // enemy ids already hit (for pierce / ticks)
  public hitCooldownTimer = 0; // for periodic AoE damage (e.g. fire/garlic)
  public hitInterval = 0.25;

  // Orbiting specific
  public orbitAngle = 0;
  public orbitRadius = 80;
  public orbitSpeed = 4.0;

  // Boomerang specific
  public isReturning = false;
  public originalSourcePos: Vector2 = new Vector2();
  public returnSpeed = 450;

  // Custom visual color/style
  public color = '#60a5fa';
  public glowColor = '#3b82f6';
  public rotation = 0;

  constructor(
    type: ProjectileType,
    weaponId: string,
    x: number,
    y: number,
    radius: number,
    damage: number,
    pierce = 1,
    lifetime = 2.0
  ) {
    super(x, y, radius);
    this.type = type;
    this.weaponId = weaponId;
    this.damage = damage;
    this.isCrit = false;
    this.pierce = pierce;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
  }

  public update(dt: number): void {
    if (!this.active) return;

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.active = false;
      return;
    }

    if (this.hitCooldownTimer > 0) {
      this.hitCooldownTimer -= dt;
      if (this.hitCooldownTimer <= 0) {
        this.hitEnemies.clear();
        this.hitCooldownTimer = this.hitInterval;
      }
    }

    // Motion physics
    if (this.type === 'DIRECT_BOLT' || this.type === 'PIERCING_DAGGER') {
      this.position.addScaled(this.velocity, dt);
      this.rotation = this.velocity.angle();
    } else if (this.type === 'BOOMERANG') {
      if (!this.isReturning) {
        this.position.addScaled(this.velocity, dt);
        // Decelerate and start returning halfway
        if (this.lifetime < this.maxLifetime * 0.55) {
          this.isReturning = true;
        }
      }
      this.rotation += 15 * dt;
    } else if (this.type === 'ORBITING_ORB') {
      this.orbitAngle += this.orbitSpeed * dt;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();
    ctx.translate(this.position.x, this.position.y);

    switch (this.type) {
      case ProjectileType.DIRECT_BOLT: {
        ctx.rotate(this.rotation);
        // Glowing magic missile
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius * 1.6, this.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.radius * 0.4, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case ProjectileType.PIERCING_DAGGER: {
        ctx.rotate(this.rotation);
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8;

        // Dagger blade
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.8, 0);
        ctx.lineTo(-this.radius * 0.8, -this.radius * 0.5);
        ctx.lineTo(-this.radius * 0.4, 0);
        ctx.lineTo(-this.radius * 0.8, this.radius * 0.5);
        ctx.closePath();
        ctx.fill();

        // Crossguard & handle
        ctx.fillStyle = '#b45309';
        ctx.fillRect(-this.radius * 0.9, -this.radius * 0.6, this.radius * 0.3, this.radius * 1.2);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-this.radius * 1.4, -this.radius * 0.25, this.radius * 0.5, this.radius * 0.5);
        break;
      }

      case ProjectileType.ORBITING_ORB: {
        // Glowing sacred bible / holy orb
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 12;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Book/Cross rune inside
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-this.radius * 0.2, -this.radius * 0.6, this.radius * 0.4, this.radius * 1.2);
        ctx.fillRect(-this.radius * 0.5, -this.radius * 0.2, this.radius * 1.0, this.radius * 0.4);
        break;
      }

      case ProjectileType.GROUND_FIRE: {
        // Lingering burning pool with animated alpha
        const alpha = Math.min(1.0, this.lifetime * 1.5);
        ctx.globalAlpha = alpha * 0.65;
        const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, this.radius);
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(0.3, '#f97316');
        grad.addColorStop(0.7, '#dc2626');
        grad.addColorStop(1, 'rgba(185, 28, 28, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case ProjectileType.BOOMERANG: {
        ctx.rotate(this.rotation);
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-this.radius, -this.radius * 0.5);
        ctx.lineTo(0, this.radius * 0.8);
        ctx.lineTo(this.radius, -this.radius * 0.5);
        ctx.stroke();

        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case ProjectileType.GARLIC_AURA: {
        // Pulsing repellent aura around player
        const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.05;
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * pulse, 0, Math.PI * 2);
        ctx.stroke();

        const grad = ctx.createRadialGradient(0, 0, this.radius * 0.5, 0, 0, this.radius * pulse);
        grad.addColorStop(0, 'rgba(234, 179, 8, 0.05)');
        grad.addColorStop(1, 'rgba(234, 179, 8, 0.25)');
        ctx.fillStyle = grad;
        ctx.fill();
        break;
      }

      default: {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }
}
