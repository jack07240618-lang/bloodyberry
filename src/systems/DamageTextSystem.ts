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

  public addStatusText(x: number, y: number, text: string, color = '#f97316', fontSize = 15): void {
    this.items.push({
      position: new Vector2(x, y - 22),
      velocity: new Vector2((Math.random() - 0.5) * 30, -85),
      text,
      color,
      fontSize,
      lifetime: 0.85,
      maxLifetime: 0.85,
      alpha: 1.0,
      isCrit: true
    });
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const item of this.items) {
      const progress = 1 - item.lifetime / item.maxLifetime;
      const popScale = item.isCrit && progress < 0.2 ? 1 + (0.2 - progress) * 0.9 : 1;

      ctx.save();
      ctx.translate(item.position.x, item.position.y);
      ctx.scale(popScale, popScale);
      ctx.globalAlpha = item.alpha;

      const weight = item.isCrit ? '600' : '500';
      const size = item.isCrit ? Math.min(15, item.fontSize) : item.fontSize;
      ctx.font = `${weight} ${size}px ui-monospace, "SF Mono", "JetBrains Mono", -apple-system, sans-serif`;

      // Subtle 1px dark drop shadow (Clean modern look, no thick cartoon outline)
      ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
      ctx.fillText(item.text, 0, 1.2);

      ctx.fillStyle = item.isCrit && item.color === '#fbbf24' ? '#fde047' : item.color;
      ctx.fillText(item.text, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }
}
