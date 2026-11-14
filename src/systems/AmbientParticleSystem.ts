import { Vector2 } from '../core/Vector2';
import { Camera } from '../core/Camera';
import { drawFourPointStar } from '../vfx/GothicVFX';

export interface AmbientEmber {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  alpha: number;
  color: string;
  wobbleSpeed: number;
  wobbleTimer: number;
  isStarGlint: boolean;
}

export interface WeaponTrailPoint {
  position: Vector2;
  alpha: number;
  width: number;
}

export class AmbientParticleSystem {
  private embers: AmbientEmber[] = [];
  private trails: Map<number, WeaponTrailPoint[]> = new Map();

  constructor() {
    this.seedEmbers();
  }

  private seedEmbers(): void {
    const gothicPalette = ['#f97316', '#fbbf24', '#ef4444', '#c084fc', '#fde68a'];
    for (let i = 0; i < 42; i++) {
      this.embers.push({
        position: new Vector2((Math.random() - 0.5) * 920, (Math.random() - 0.5) * 920),
        velocity: new Vector2((Math.random() - 0.5) * 24, -22 - Math.random() * 38),
        radius: 1.5 + Math.random() * 2.4,
        alpha: 0.48 + Math.random() * 0.45,
        color: gothicPalette[i % gothicPalette.length],
        wobbleSpeed: 2 + Math.random() * 4.2,
        wobbleTimer: Math.random() * 12,
        isStarGlint: i % 4 === 0
      });
    }
  }

  public addEmber(x: number, y: number, color = '#f97316'): void {
    if (this.embers.length >= 75) return;
    this.embers.push({
      position: new Vector2(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20),
      velocity: new Vector2((Math.random() - 0.5) * 22, -30 - Math.random() * 42),
      radius: 1.6 + Math.random() * 2.2,
      alpha: 0.82 + Math.random() * 0.18,
      color,
      wobbleSpeed: 2 + Math.random() * 4,
      wobbleTimer: Math.random() * 10,
      isStarGlint: Math.random() < 0.35
    });
  }

  public recordTrailPoint(entityId: number, pos: Vector2, width = 12): void {
    let list = this.trails.get(entityId);
    if (!list) {
      list = [];
      this.trails.set(entityId, list);
    }
    list.unshift({ position: pos.clone(), alpha: 0.6, width });
    if (list.length > 8) {
      list.pop();
    }
  }

  public update(dt: number, playerPos: Vector2): void {
    // 1. Update Embers
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.wobbleTimer += dt * e.wobbleSpeed;
      e.position.x += Math.sin(e.wobbleTimer) * 18 * dt;
      e.position.y += e.velocity.y * dt;
      e.alpha -= dt * 0.35;

      if (e.alpha <= 0) {
        // Respawn near player
        e.position.set(
          playerPos.x + (Math.random() - 0.5) * 800,
          playerPos.y + 350 + Math.random() * 100
        );
        e.alpha = 0.5 + Math.random() * 0.4;
      }
    }

    // 2. Update Weapon Trails
    for (const [id, points] of this.trails.entries()) {
      for (let i = points.length - 1; i >= 0; i--) {
        points[i].alpha -= dt * 3.5;
        points[i].width = Math.max(1, points[i].width - dt * 25);
        if (points[i].alpha <= 0) {
          points.splice(i, 1);
        }
      }
      if (points.length === 0) {
        this.trails.delete(id);
      }
    }
  }

  public renderFogAndTrails(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // 1. Render weapon / dash trails as 2-layer Gothic violet-crimson & consecrated gold filaments
    for (const points of this.trails.values()) {
      if (points.length < 2) continue;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';

        ctx.globalAlpha = p1.alpha * 0.44;
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = p1.width * 1.65;
        ctx.beginPath();
        ctx.moveTo(p1.position.x, p1.position.y);
        ctx.lineTo(p2.position.x, p2.position.y);
        ctx.stroke();

        ctx.globalAlpha = p1.alpha * 0.92;
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = Math.max(1.2, p1.width * 0.5);
        ctx.beginPath();
        ctx.moveTo(p1.position.x, p1.position.y);
        ctx.lineTo(p2.position.x, p2.position.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Render Gothic Catacomb Embers & Flickering Star Dust (2-pass lighter glow without expensive shadowBlur)
    for (const e of this.embers) {
      if (camera.isVisible(e.position, e.radius + 14)) {
        const shimmer = 0.72 + Math.sin(e.wobbleTimer * 2.2) * 0.28;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = e.alpha * 0.36 * shimmer;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.position.x, e.position.y, e.radius * 3.0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = Math.min(1, (e.alpha + 0.15) * shimmer);
        if (e.isStarGlint) {
          drawFourPointStar(ctx, e.position.x, e.position.y, e.radius * 2.2, e.radius * 0.38, e.color, '#fffbeb');
        } else {
          ctx.fillStyle = '#fffbeb';
          ctx.beginPath();
          ctx.arc(e.position.x, e.position.y, e.radius * 0.78, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }
}
