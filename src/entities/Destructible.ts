import { Entity } from './Entity';
import { DropType } from './DropItem';

export class Destructible extends Entity {
  public hp = 1;
  public maxHp = 1;
  public flameTimer = 0;

  constructor(x: number, y: number) {
    super(x, y, 14);
    this.flameTimer = Math.random() * 10;
  }

  public update(dt: number): void {
    if (!this.active) return;
    this.flameTimer += dt * 7;
  }

  public takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.active = false;
      return true; // Destroyed!
    }
    return false;
  }

  public getRandomDrop(): DropType {
    const roll = Math.random();
    if (roll < 0.40) return DropType.GOLD_COIN;
    if (roll < 0.65) return DropType.HEALTH_POTION;
    if (roll < 0.85) return DropType.MAGNET;
    return DropType.FREEZE_CLOCK;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();
    ctx.translate(this.position.x, this.position.y);

    // 1. Directional Cast Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(3, 13, 12, 5, 0.12, 0, Math.PI * 2);
    ctx.fill();

    // 2. Warm Additive Ground Fire Pool Glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flickerRadius = 28 + Math.sin(this.flameTimer * 1.3) * 3;
    const groundGlow = ctx.createRadialGradient(0, 2, 2, 0, 2, flickerRadius);
    groundGlow.addColorStop(0, 'rgba(251, 146, 60, 0.35)');
    groundGlow.addColorStop(0.5, 'rgba(234, 88, 12, 0.14)');
    groundGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = groundGlow;
    ctx.beginPath();
    ctx.arc(0, 2, flickerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Ornate Wrought-Iron Tripod Pedestal Base
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-7, 10, 14, 3);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-3, -4, 6, 15);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-2, -4, 2, 14); // Specular iron shaft highlight

    // Golden Ring Collar
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-4, 2, 8, 2);

    // 4. Spiked Gothic Iron Brazier Bowl
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-11, -7);
    ctx.lineTo(11, -7);
    ctx.lineTo(7, -1);
    ctx.lineTo(-7, -1);
    ctx.closePath();
    ctx.fill();

    // Rim highlight & Glowing Hot Coals inside bowl
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-11, -8, 22, 2);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-8, -8, 16, 2);

    // 5. Multi-Layered Additive Roaring Torch Flame
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sway = Math.sin(this.flameTimer) * 2.5;
    const stretch = Math.cos(this.flameTimer * 1.7) * 2;

    // Outer Crimson-Orange Flame Tongue
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.quadraticCurveTo(-5, -18, sway, -24 + stretch);
    ctx.quadraticCurveTo(6, -16, 7, -7);
    ctx.closePath();
    ctx.fill();

    // Mid Golden Flame
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-4.5, -7);
    ctx.quadraticCurveTo(-2, -15, sway * 0.7, -19 + stretch);
    ctx.quadraticCurveTo(3, -14, 4.5, -7);
    ctx.closePath();
    ctx.fill();

    // White-Hot Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-2, -7);
    ctx.quadraticCurveTo(0, -12, sway * 0.4, -14 + stretch * 0.5);
    ctx.quadraticCurveTo(2, -11, 2, -7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}
