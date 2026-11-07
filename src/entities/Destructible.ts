import { Entity } from './Entity';
import { Vector2 } from '../core/Vector2';
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
    this.flameTimer += dt * 6;
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

    // Subtle shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone / Iron Brazier Stand
    ctx.fillStyle = '#334155';
    ctx.fillRect(-2, -6, 4, 18);
    ctx.fillRect(-6, 10, 12, 3);

    // Bowl
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(9, -6);
    ctx.lineTo(6, -1);
    ctx.lineTo(-6, -1);
    ctx.closePath();
    ctx.fill();

    // Animated Torch Flame
    const flicker = Math.sin(this.flameTimer) * 2;
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 12;

    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.quadraticCurveTo(0, -18 + flicker, 0, -20 + flicker);
    ctx.quadraticCurveTo(5, -12, 5, -6);
    ctx.closePath();
    ctx.fill();

    // Inner bright yellow flame
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.quadraticCurveTo(0, -14 + flicker, 0, -16 + flicker);
    ctx.quadraticCurveTo(3, -10, 3, -6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
