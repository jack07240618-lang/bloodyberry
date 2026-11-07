import { Vector2 } from './Vector2';

export class Camera {
  public position: Vector2 = new Vector2(0, 0);
  public viewportWidth = 800;
  public viewportHeight = 600;
  public zoom = 1.0;

  // Screen shake
  private shakeIntensity = 0;
  private shakeDecay = 0.9;
  private shakeOffset: Vector2 = new Vector2(0, 0);

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  public resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  public follow(target: Vector2, alpha = 0.1): void {
    this.position.lerp(target, alpha);
  }

  public triggerShake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  public update(dt: number): void {
    if (this.shakeIntensity > 0.1) {
      const angle = Math.random() * Math.PI * 2;
      const mag = this.shakeIntensity;
      this.shakeOffset.set(Math.cos(angle) * mag, Math.sin(angle) * mag);
      this.shakeIntensity *= Math.pow(this.shakeDecay, dt * 60);
    } else {
      this.shakeIntensity = 0;
      this.shakeOffset.set(0, 0);
    }
  }

  public worldToScreen(worldPos: Vector2): Vector2 {
    return new Vector2(
      (worldPos.x - this.position.x) * this.zoom + this.viewportWidth / 2 + this.shakeOffset.x,
      (worldPos.y - this.position.y) * this.zoom + this.viewportHeight / 2 + this.shakeOffset.y
    );
  }

  public screenToWorld(screenPos: Vector2): Vector2 {
    return new Vector2(
      (screenPos.x - this.viewportWidth / 2 - this.shakeOffset.x) / this.zoom + this.position.x,
      (screenPos.y - this.viewportHeight / 2 - this.shakeOffset.y) / this.zoom + this.position.y
    );
  }

  public isVisible(worldPos: Vector2, radius = 50): boolean {
    const minX = this.position.x - this.viewportWidth / (2 * this.zoom) - radius;
    const maxX = this.position.x + this.viewportWidth / (2 * this.zoom) + radius;
    const minY = this.position.y - this.viewportHeight / (2 * this.zoom) - radius;
    const maxY = this.position.y + this.viewportHeight / (2 * this.zoom) + radius;

    return (
      worldPos.x >= minX &&
      worldPos.x <= maxX &&
      worldPos.y >= minY &&
      worldPos.y <= maxY
    );
  }

  public applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(
      this.viewportWidth / 2 + this.shakeOffset.x,
      this.viewportHeight / 2 + this.shakeOffset.y
    );
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.position.x, -this.position.y);
  }

  public restoreTransform(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }
}
