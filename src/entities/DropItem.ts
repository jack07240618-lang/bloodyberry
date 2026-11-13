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

    // Soft crimson aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 2, 1, 0, 2, 14);
    halo.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3D Shaded Crimson Blood Phial
    const vialGrad = ctx.createRadialGradient(-2.5, -0.5, 1, 0, 2, 8);
    vialGrad.addColorStop(0, '#fca5a5');
    vialGrad.addColorStop(0.45, '#dc2626');
    vialGrad.addColorStop(1, '#450a0a');
    ctx.fillStyle = vialGrad;
    ctx.beginPath();
    ctx.arc(0, 2, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Gilded collar & cork stopper
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-3.2, -7, 6.4, 2.5);
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.roundRect(-2.2, -10.5, 4.4, 3.8, 1);
    ctx.fill();

    // Glass crescent specular & holy cross
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 2, 5.2, Math.PI * 1.1, Math.PI * 1.55);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(-1, -0.5, 2, 5);
    ctx.fillRect(-2.5, 1, 5, 2);
  }

  private renderMagnet(ctx: CanvasRenderingContext2D, bob: number): void {
    ctx.translate(0, bob);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
    halo.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Forged arcane horseshoe magnet with metallic gradient
    const magGrad = ctx.createLinearGradient(-8, -8, 8, 6);
    magGrad.addColorStop(0, '#f87171');
    magGrad.addColorStop(0.5, '#b91c1c');
    magGrad.addColorStop(1, '#450a0a');
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = magGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 7, Math.PI, 0, true);
    ctx.stroke();

    // Beveled silver-steel poles
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-9.1, 0, 4.2, 5.5);
    ctx.fillRect(4.9, 0, 4.2, 5.5);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-8.5, 4.2, 3, 1.5);
    ctx.fillRect(5.5, 4.2, 3, 1.5);
  }

  private renderClock(ctx: CanvasRenderingContext2D, bob: number): void {
    ctx.translate(0, bob);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, 15);
    halo.addColorStop(0, 'rgba(6, 182, 212, 0.48)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Top crown ring
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, -10, 2.2, 0, Math.PI * 2);
    ctx.stroke();

    // 3D Shaded Antique Brass Pocket Watch
    const bezelGrad = ctx.createLinearGradient(-8, -8, 8, 8);
    bezelGrad.addColorStop(0, '#fef08a');
    bezelGrad.addColorStop(0.5, '#d97706');
    bezelGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = bezelGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
    ctx.fill();

    // Deep astral dial face
    const dialGrad = ctx.createRadialGradient(-1.5, -1.5, 1, 0, 0, 6.2);
    dialGrad.addColorStop(0, '#0e7490');
    dialGrad.addColorStop(1, '#04141d');
    ctx.fillStyle = dialGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
    ctx.fill();

    // Gilded hands
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -4.2);
    ctx.moveTo(0, 0);
    ctx.lineTo(3.2, 1.2);
    ctx.stroke();
  }

  private renderChest(ctx: CanvasRenderingContext2D, bob: number): void {
    ctx.translate(0, bob);

    // 1. Feathered Volumetric Golden Sunbeam & Ground Halo (No hard rectangle edges)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.translate(0, -35);
    ctx.scale(1, 3.2);
    const pillarGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
    pillarGrad.addColorStop(0, 'rgba(251, 191, 36, 0.34)');
    pillarGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.12)');
    pillarGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pillarGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const halo = ctx.createRadialGradient(0, 2, 2, 0, 2, 30);
    halo.addColorStop(0, 'rgba(250, 204, 21, 0.62)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 2, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. 3D Shaded Royal Crimson-Gold Reliquary Chest
    const bodyGrad = ctx.createLinearGradient(-15, -7, 15, 11);
    bodyGrad.addColorStop(0, '#991b1b');
    bodyGrad.addColorStop(0.55, '#5b0c14');
    bodyGrad.addColorStop(1, '#1e0408');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-15, -7, 30, 18, 3);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Beveled Golden Straps
    const strapGrad = ctx.createLinearGradient(-15, -7, 15, 11);
    strapGrad.addColorStop(0, '#fef08a');
    strapGrad.addColorStop(0.5, '#d97706');
    strapGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = strapGrad;
    ctx.fillRect(-11, -7, 3.5, 18);
    ctx.fillRect(7.5, -7, 3.5, 18);
    ctx.fillRect(-15, -7, 30, 2.5);

    // Domed Vaulted Lid with 3D Shading
    const lidGrad = ctx.createLinearGradient(0, -14, 0, -7);
    lidGrad.addColorStop(0, '#dc2626');
    lidGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = lidGrad;
    ctx.beginPath();
    ctx.ellipse(0, -7, 15, 6.8, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Center Ruby Lock Escutcheon
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderCoin(ctx: CanvasRenderingContext2D, bob: number): void {
    ctx.translate(0, bob);

    // 3D Shaded Antique Gothic Gold Crown Coin (No modern '$' symbol)
    const coinGrad = ctx.createLinearGradient(-6, -6, 6, 6);
    coinGrad.addColorStop(0, '#fef08a');
    coinGrad.addColorStop(0.5, '#f59e0b');
    coinGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = coinGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Inner recessed ring & Gothic diamond relief
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.65)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, 4.1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.moveTo(0, -2.6);
    ctx.lineTo(2.1, 0);
    ctx.lineTo(0, 2.6);
    ctx.lineTo(-2.1, 0);
    ctx.closePath();
    ctx.fill();
  }
}
