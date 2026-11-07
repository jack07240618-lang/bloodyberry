import { Camera } from '../core/Camera';
import { Vector2 } from '../core/Vector2';
import { Destructible } from '../entities/Destructible';
import { Player } from '../entities/Player';

export interface BloodDecal {
  position: Vector2;
  radius: number;
  color: string;
  rotation: number;
  lifetime: number;
  maxLifetime: number;
  alpha: number;
}

export class MapSystem {
  public readonly tileSize = 128;
  public destructibles: Destructible[] = [];
  public bloodDecals: BloodDecal[] = [];
  private visitedChunks: Set<string> = new Set();
  private readonly chunkGridSize = 256;
  private readonly maxDecals = 220;

  constructor() {
    this.seedInitialDestructibles();
  }

  private seedInitialDestructibles(): void {
    for (let x = -2; x <= 2; x++) {
      for (let y = -2; y <= 2; y++) {
        if (x === 0 && y === 0) continue;
        if (Math.random() < 0.6) {
          const px = x * 220 + (Math.random() - 0.5) * 80;
          const py = y * 220 + (Math.random() - 0.5) * 80;
          this.destructibles.push(new Destructible(px, py));
        }
      }
    }
  }

  public addBloodDecal(x: number, y: number, color = '#7f1d1d', radius = 14): void {
    if (this.bloodDecals.length >= this.maxDecals) {
      this.bloodDecals.shift();
    }
    const lifetime = 25 + Math.random() * 10;
    this.bloodDecals.push({
      position: new Vector2(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6),
      radius,
      color,
      rotation: Math.random() * Math.PI * 2,
      lifetime,
      maxLifetime: lifetime,
      alpha: 0.65
    });
  }

  public update(playerPos: Vector2, dt = 0.016): void {
    // Decay blood decals
    for (let i = this.bloodDecals.length - 1; i >= 0; i--) {
      const b = this.bloodDecals[i];
      b.lifetime -= dt;
      if (b.lifetime <= 0) {
        this.bloodDecals.splice(i, 1);
        continue;
      }
      b.alpha = Math.min(0.65, (b.lifetime / b.maxLifetime) * 0.7);
    }

    // Dynamic chunk generation
    const currentChunkX = Math.floor(playerPos.x / this.chunkGridSize);
    const currentChunkY = Math.floor(playerPos.y / this.chunkGridSize);

    for (let cx = currentChunkX - 2; cx <= currentChunkX + 2; cx++) {
      for (let cy = currentChunkY - 2; cy <= currentChunkY + 2; cy++) {
        const key = `${cx},${cy}`;
        if (!this.visitedChunks.has(key)) {
          this.visitedChunks.add(key);

          const hash = Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453;
          const pseudoRand = hash - Math.floor(hash);

          if (pseudoRand < 0.28) {
            const px = cx * this.chunkGridSize + 40 + pseudoRand * (this.chunkGridSize - 80);
            const py = cy * this.chunkGridSize + 40 + (1 - pseudoRand) * (this.chunkGridSize - 80);
            this.destructibles.push(new Destructible(px, py));
          }
        }
      }
    }

    // Clean inactive destructibles
    this.destructibles = this.destructibles.filter(d => d.active);
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const left = camera.position.x - camera.viewportWidth / (2 * camera.zoom) - this.tileSize;
    const right = camera.position.x + camera.viewportWidth / (2 * camera.zoom) + this.tileSize;
    const top = camera.position.y - camera.viewportHeight / (2 * camera.zoom) - this.tileSize;
    const bottom = camera.position.y + camera.viewportHeight / (2 * camera.zoom) + this.tileSize;

    const startTileX = Math.floor(left / this.tileSize);
    const endTileX = Math.ceil(right / this.tileSize);
    const startTileY = Math.floor(top / this.tileSize);
    const endTileY = Math.ceil(bottom / this.tileSize);

    // Procedural Gothic Dungeon Ground
    for (let tx = startTileX; tx <= endTileX; tx++) {
      for (let ty = startTileY; ty <= endTileY; ty++) {
        const wx = tx * this.tileSize;
        const wy = ty * this.tileSize;

        const tileHash = Math.abs(Math.sin(tx * 374761393 + ty * 668265263) * 10000);
        const tileType = Math.floor(tileHash) % 10;

        ctx.fillStyle = (tx + ty) % 2 === 0 ? '#111019' : '#0e0d16';
        ctx.fillRect(wx, wy, this.tileSize, this.tileSize);

        ctx.strokeStyle = '#181622';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(wx, wy, this.tileSize, this.tileSize);

        ctx.strokeStyle = '#151320';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx + this.tileSize / 2, wy);
        ctx.lineTo(wx + this.tileSize / 2, wy + this.tileSize);
        ctx.moveTo(wx, wy + this.tileSize / 2);
        ctx.lineTo(wx + this.tileSize, wy + this.tileSize / 2);
        ctx.stroke();

        if (tileType === 1 || tileType === 2) {
          ctx.fillStyle = 'rgba(22, 101, 52, 0.15)';
          ctx.beginPath();
          ctx.arc(wx + this.tileSize * 0.4, wy + this.tileSize * 0.4, 28, 0, Math.PI * 2);
          ctx.fill();
        } else if (tileType === 3) {
          ctx.fillStyle = 'rgba(153, 27, 27, 0.18)';
          ctx.beginPath();
          ctx.ellipse(wx + this.tileSize * 0.6, wy + this.tileSize * 0.6, 24, 14, 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (tileType === 4) {
          ctx.strokeStyle = '#09080e';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(wx + 15, wy + 20);
          ctx.lineTo(wx + 45, wy + 40);
          ctx.lineTo(wx + 60, wy + 90);
          ctx.stroke();
        }
      }
    }

    // Render Blood Decals
    for (const b of this.bloodDecals) {
      if (camera.isVisible(b.position, b.radius + 10)) {
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.rotation);
        ctx.globalAlpha = b.alpha;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.radius, b.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Droplets
        ctx.beginPath();
        ctx.arc(b.radius * 0.7, b.radius * 0.3, b.radius * 0.25, 0, Math.PI * 2);
        ctx.arc(-b.radius * 0.6, -b.radius * 0.4, b.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Render destructibles
    for (const d of this.destructibles) {
      if (camera.isVisible(d.position, d.radius + 20)) {
        d.render(ctx);
      }
    }
  }

  // --- Dynamic Lighting & Vignette Mask ---
  public renderLighting(ctx: CanvasRenderingContext2D, camera: Camera, player: Player): void {
    ctx.save();

    // Dark gothic vignette canvas layer
    const w = camera.viewportWidth;
    const h = camera.viewportHeight;

    // Use radial gradient around player position on screen
    const pScreen = camera.worldToScreen(player.position);
    const lightRadius = 320;

    const darkGrad = ctx.createRadialGradient(
      pScreen.x,
      pScreen.y,
      lightRadius * 0.45,
      pScreen.x,
      pScreen.y,
      Math.max(w, h) * 0.8
    );
    darkGrad.addColorStop(0, 'rgba(5, 4, 10, 0)');
    darkGrad.addColorStop(0.5, 'rgba(5, 4, 10, 0.45)');
    darkGrad.addColorStop(1, 'rgba(3, 2, 8, 0.88)');

    ctx.fillStyle = darkGrad;
    ctx.fillRect(0, 0, w, h);

    // Warm torch glow highlights
    for (const d of this.destructibles) {
      if (d.active && camera.isVisible(d.position, 120)) {
        const dScreen = camera.worldToScreen(d.position);
        const flicker = Math.sin(d.flameTimer * 2) * 6;
        const torchGrad = ctx.createRadialGradient(
          dScreen.x,
          dScreen.y - 10,
          5,
          dScreen.x,
          dScreen.y - 10,
          90 + flicker
        );
        torchGrad.addColorStop(0, 'rgba(249, 115, 22, 0.22)');
        torchGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = torchGrad;
        ctx.fillRect(dScreen.x - 100, dScreen.y - 110, 200, 200);
      }
    }

    ctx.restore();
  }
}
