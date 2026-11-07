import { Vector2 } from '../core/Vector2';
import { Camera } from '../core/Camera';

export interface AmbientEmber {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  alpha: number;
  color: string;
  wobbleSpeed: number;
  wobbleTimer: number;
}

export interface FogCloud {
  position: Vector2;
  radius: number;
  alpha: number;
  speed: number;
}

export interface WeaponTrailPoint {
  position: Vector2;
  alpha: number;
  width: number;
}

export class AmbientParticleSystem {
  private embers: AmbientEmber[] = [];
  private fogClouds: FogCloud[] = [];
  private trails: Map<number, WeaponTrailPoint[]> = new Map();

  constructor() {
    this.seedFog();
  }

  private seedFog(): void {
    for (let i = 0; i < 18; i++) {
      this.fogClouds.push({
        position: new Vector2((Math.random() - 0.5) * 1600, (Math.random() - 0.5) * 1600),
        radius: 120 + Math.random() * 140,
        alpha: 0.08 + Math.random() * 0.08,
        speed: 15 + Math.random() * 25
      });
    }
  }

  public addEmber(x: number, y: number, color = '#f97316'): void {
    if (this.embers.length >= 80) return;
    this.embers.push({
      position: new Vector2(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20),
      velocity: new Vector2((Math.random() - 0.5) * 20, -30 - Math.random() * 40),
      radius: 1.5 + Math.random() * 2,
      alpha: 0.8 + Math.random() * 0.2,
      color,
      wobbleSpeed: 2 + Math.random() * 4,
      wobbleTimer: Math.random() * 10
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
      e.alpha -= dt * 0.45;

      if (e.alpha <= 0) {
        this.embers.splice(i, 1);
      }
    }

    // 2. Update Fog drifting around player
    for (const fog of this.fogClouds) {
      fog.position.x += fog.speed * dt;
      // Wrap around player window
      if (fog.position.x - playerPos.x > 900) {
        fog.position.x = playerPos.x - 900;
      }
    }

    // 3. Update Weapon Trails
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
    // 1. Render weapon trails
    for (const points of this.trails.values()) {
      if (points.length < 2) continue;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        ctx.save();
        ctx.globalAlpha = p1.alpha;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = p1.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.position.x, p1.position.y);
        ctx.lineTo(p2.position.x, p2.position.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Render Fog
    for (const fog of this.fogClouds) {
      if (camera.isVisible(fog.position, fog.radius)) {
        ctx.save();
        ctx.globalAlpha = fog.alpha;
        const grad = ctx.createRadialGradient(
          fog.position.x,
          fog.position.y,
          fog.radius * 0.2,
          fog.position.x,
          fog.position.y,
          fog.radius
        );
        grad.addColorStop(0, 'rgba(148, 163, 184, 0.35)');
        grad.addColorStop(0.6, 'rgba(100, 116, 139, 0.15)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(fog.position.x, fog.position.y, fog.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 3. Render Embers
    for (const e of this.embers) {
      if (camera.isVisible(e.position, e.radius)) {
        ctx.save();
        ctx.globalAlpha = e.alpha;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.position.x, e.position.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
