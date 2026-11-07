import { Vector2 } from '../core/Vector2';

export interface DamageNumber {
  position: Vector2;
  velocity: Vector2;
  text: string;
  color: string;
  fontSize: number;
  lifetime: number;
  maxLifetime: number;
  alpha: number;
  isCrit: boolean;
}

export class DamageTextSystem {
  private items: DamageNumber[] = [];

  public update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.lifetime -= dt;

      if (item.lifetime <= 0) {
        this.items.splice(i, 1);
        continue;
      }

      item.position.addScaled(item.velocity, dt);
      item.velocity.multiplyScalar(Math.pow(0.85, dt * 60));
      item.alpha = Math.max(0, item.lifetime / item.maxLifetime);
    }
  }

  public addDamage(x: number, y: number, amount: number, isCrit = false): void {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    const speed = isCrit ? 120 : 80;
    const lifetime = isCrit ? 0.8 : 0.55;

    this.items.push({
      position: new Vector2(x + (Math.random() - 0.5) * 10, y - 10),
      velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
      text: `${Math.round(amount)}`,
      color: isCrit ? '#fbbf24' : '#f8fafc',
      fontSize: isCrit ? 18 : 12,
      lifetime,
      maxLifetime: lifetime,
      alpha: 1.0,
      isCrit
    });
  }

  public addPlayerDamage(x: number, y: number, amount: number): void {
    this.items.push({
      position: new Vector2(x, y - 16),
      velocity: new Vector2(0, -60),
      text: `-${amount}`,
      color: '#ef4444',
      fontSize: 15,
      lifetime: 0.7,
      maxLifetime: 0.7,
      alpha: 1.0,
      isCrit: false
    });
  }

  public addHeal(x: number, y: number, amount: number): void {
    this.items.push({
      position: new Vector2(x, y - 16),
      velocity: new Vector2(0, -50),
      text: `+${amount}`,
      color: '#22c55e',
      fontSize: 14,
      lifetime: 0.7,
      maxLifetime: 0.7,
      alpha: 1.0,
      isCrit: false
    });
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const item of this.items) {
      ctx.globalAlpha = item.alpha;
      ctx.font = `bold ${item.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

      // Dark outline for contrast
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(item.text, item.position.x, item.position.y);

      // Main text
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.position.x, item.position.y);
    }

    ctx.restore();
  }
}
