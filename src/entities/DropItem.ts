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
    ctx.shadowColor = light;
    ctx.shadowBlur = 8;

    // Rhombus / Faceted Diamond
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.8, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.8, 0);
    ctx.closePath();
    ctx.fill();

    // Dark facet shading
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size * 0.8, 0);
    ctx.lineTo(0, size);
    ctx.closePath();
    ctx.fill();

    // White highlight glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-size * 0.25, -size * 0.3, size * 0.2, 0, Math.PI * 2);
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
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 16;

    // Ornate Golden/Crimson Treasure Chest
    // Base
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-14, -6, 28, 16);

    // Golden metal bands
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-14, -6, 4, 16);
    ctx.fillRect(10, -6, 4, 16);
    ctx.fillRect(-14, -6, 28, 3);
    ctx.fillRect(-14, 7, 28, 3);

    // Lid
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(0, -7, 14, 6, 0, Math.PI, 0);
    ctx.fill();

    // Golden Keyhole / Lock
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-1, -1, 2, 4);
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
