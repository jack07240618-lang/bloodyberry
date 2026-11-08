import { Entity } from './Entity';
import { Vector2 } from '../core/Vector2';
import { Player } from './Player';

export enum DropType {
  XP_CYAN = 'XP_CYAN',     // 1 XP
  XP_GREEN = 'XP_GREEN',   // 5 XP
  XP_RED = 'XP_RED',       // 20 XP
  XP_VIOLET = 'XP_VIOLET', // 100 XP
  HEALTH_POTION = 'HEALTH_POTION',
  MAGNET = 'MAGNET',
  FREEZE_CLOCK = 'FREEZE_CLOCK',
  BOSS_CHEST = 'BOSS_CHEST',
  GOLD_COIN = 'GOLD_COIN'
}

export class DropItem extends Entity {
  public type: DropType;
  public value: number;
  public isMagnetized = false;
  public magnetSpeed = 250;
  public maxMagnetSpeed = 750;
  public sparkleTimer = 0;

  constructor(type: DropType, x: number, y: number, value = 1) {
    super(x, y, 8);
    this.type = type;
    this.value = value;
    this.sparkleTimer = Math.random() * Math.PI * 2;

    const isXpGem = (
      type === DropType.XP_CYAN ||
      type === DropType.XP_GREEN ||
      type === DropType.XP_RED ||
      type === DropType.XP_VIOLET
    );

    // Global Infinite Magnet for all XP gems
    if (isXpGem) {
      this.isMagnetized = true;
      this.magnetSpeed = 380;
      this.maxMagnetSpeed = 950;
    }

    if (type === DropType.BOSS_CHEST) {
      this.radius = 16;
    } else if (type === DropType.HEALTH_POTION || type === DropType.MAGNET || type === DropType.FREEZE_CLOCK) {
      this.radius = 12;
    }
  }

  public update(dt: number): void {
    if (!this.active) return;
    this.sparkleTimer += dt * 4;
  }

  public attractTo(player: Player, dt: number): boolean {
    if (!this.active) return false;

    // Boss chests are opened by walking onto them, not magnetized
    if (this.type === DropType.BOSS_CHEST) {
      const dist = this.position.distanceTo(player.position);
      return dist <= this.radius + player.radius;
    }

    const dist = this.position.distanceTo(player.position);

    const isXpGem = (
      this.type === DropType.XP_CYAN ||
      this.type === DropType.XP_GREEN ||
      this.type === DropType.XP_RED ||
      this.type === DropType.XP_VIOLET
    );

    // Infinite magnet for all XP gems regardless of distance
    if (isXpGem) {
      this.isMagnetized = true;
    } else if (!this.isMagnetized) {
      if (dist <= player.pickupRadius) {
        this.isMagnetized = true;
      }
    }

    if (this.isMagnetized) {
      // Accelerate rapidly towards player
      this.magnetSpeed = Math.min(this.maxMagnetSpeed, this.magnetSpeed + dt * 1400);
      const toPlayer = player.position.clone().sub(this.position).normalize();
      this.position.addScaled(toPlayer, this.magnetSpeed * dt);

      if (dist <= player.radius + this.radius + 8) {
        this.active = false;
        return true; // Collected!
      }
    }

    return false;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();
    ctx.translate(this.position.x, this.position.y);

    const bob = Math.sin(this.sparkleTimer) * 2;

    switch (this.type) {
      case DropType.XP_CYAN:
        this.renderGem(ctx, '#38bdf8', '#0284c7', 6, bob);
        break;
      case DropType.XP_GREEN:
        this.renderGem(ctx, '#4ade80', '#16a34a', 7, bob);
        break;
      case DropType.XP_RED:
        this.renderGem(ctx, '#f87171', '#dc2626', 8, bob);
        break;
      case DropType.XP_VIOLET:
        this.renderGem(ctx, '#c084fc', '#7e22ce', 10, bob);
        break;
      case DropType.HEALTH_POTION:
        this.renderPotion(ctx, bob);
        break;
      case DropType.MAGNET:
        this.renderMagnet(ctx, bob);
        break;
      case DropType.FREEZE_CLOCK:
        this.renderClock(ctx, bob);
        break;
      case DropType.BOSS_CHEST:
        this.renderChest(ctx, bob);
        break;
      case DropType.GOLD_COIN:
        this.renderCoin(ctx, bob);
        break;
    }

    ctx.restore();
  }

  private renderGem(ctx: CanvasRenderingContext2D, light: string, dark: string, size: number, bob: number): void {
    ctx.translate(0, bob);

    // 1. Additive Radial Gem Glow Halo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, size * 2.1);
    glow.addColorStop(0, light);
    glow.addColorStop(0.5, dark);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Outer Dark Facet Rim
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.moveTo(0, -(size + 1.2));
    ctx.lineTo((size + 1.2) * 0.82, 0);
    ctx.lineTo(0, size + 1.2);
    ctx.lineTo(-(size + 1.2) * 0.82, 0);
    ctx.closePath();
    ctx.fill();

    // 3. Main Rhombus / Faceted Crystal Body
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.8, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.8, 0);
    ctx.closePath();
    ctx.fill();

    // 4. Lower-Right Deep Facet Cut
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size * 0.8, 0);
    ctx.lineTo(0, size);
    ctx.closePath();
    ctx.fill();

    // 5. Inner Crown Table Facet + Sparkling Star Glint
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.55);
    ctx.lineTo(size * 0.35, 0);
    ctx.lineTo(0, size * 0.35);
    ctx.lineTo(-size * 0.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Animated 4-point sparkle on top-left edge
    const glintScale = 0.6 + Math.abs(Math.sin(this.sparkleTimer * 1.5)) * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-size * 0.28, -size * 0.32, size * 0.22 * glintScale, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderPotion(ctx: CanvasRenderingContext2D, bob: number): void {
    ctx.translate(0, bob);
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;

    // Vial bottle
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(0, 2, 7, 0, Math.PI * 2);
    ctx.fill();

    // Bottle neck & cork
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3, -7, 6, 4);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-2, -9, 4, 3);

    // Cross on vial
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1.5, -1, 3, 6);
    ctx.fillRect(-3, 0.5, 6, 3);
  }

  private renderMagnet(ctx: CanvasRenderingContext2D, bob: number): void {
    ctx.translate(0, bob);
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;

    // Horseshoe magnet
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 7, Math.PI, 0, true);
    ctx.stroke();

    // Silver tips
    ctx.strokeStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(-7, 6);
    ctx.moveTo(7, 0);
    ctx.lineTo(7, 6);
    ctx.stroke();
  }

  private renderClock(ctx: CanvasRenderingContext2D, bob: number): void {
    ctx.translate(0, bob);
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 12;

    // Golden pocket watch
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Clock face
    ctx.fillStyle = '#083344';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    // Hands
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -4);
    ctx.moveTo(0, 0);
    ctx.lineTo(3, 1);
    ctx.stroke();
  }

  private renderChest(ctx: CanvasRenderingContext2D, bob: number): void {
    ctx.translate(0, bob);

    // 1. Vertical Golden Sunbeam Pillar behind Boss Chest
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pillarGrad = ctx.createLinearGradient(-16, 0, 16, 0);
    pillarGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    pillarGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.32)');
    pillarGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pillarGrad;
    ctx.fillRect(-16, -120, 32, 130);

    // Radial Ground Halo
    const halo = ctx.createRadialGradient(0, 2, 2, 0, 2, 30);
    halo.addColorStop(0, 'rgba(250, 204, 21, 0.65)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 2, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Ornate Royal Crimson-Gold Treasure Chest
    ctx.fillStyle = '#450a0a';
    ctx.fillRect(-15, -7, 30, 18);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-13, -5, 26, 14);

    // Beveled Golden Straps & Studs
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-15, -7, 4, 18);
    ctx.fillRect(11, -7, 4, 18);
    ctx.fillRect(-15, -7, 30, 3);
    ctx.fillRect(-15, 8, 30, 3);

    // Domed Vaulted Lid
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(0, -7, 15, 6.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center Ruby Lock Escutcheon
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderCoin(ctx: CanvasRenderingContext2D, bob: number): void {
    ctx.translate(0, bob);
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 6;

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0);
  }
}
