import { Camera } from '../core/Camera';
import { Vector2 } from '../core/Vector2';
import { Destructible } from '../entities/Destructible';

export class MapSystem {
  public readonly tileSize = 128;
  public destructibles: Destructible[] = [];
  private visitedChunks: Set<string> = new Set();
  private readonly chunkGridSize = 256;

  constructor() {
    this.seedInitialDestructibles();
  }

  private seedInitialDestructibles(): void {
    // Generate initial ring of torches around starting zone
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

  public update(playerPos: Vector2): void {
    // Check player chunk and dynamically populate destructibles if entering new zone
    const currentChunkX = Math.floor(playerPos.x / this.chunkGridSize);
    const currentChunkY = Math.floor(playerPos.y / this.chunkGridSize);

    for (let cx = currentChunkX - 2; cx <= currentChunkX + 2; cx++) {
      for (let cy = currentChunkY - 2; cy <= currentChunkY + 2; cy++) {
        const key = `${cx},${cy}`;
        if (!this.visitedChunks.has(key)) {
          this.visitedChunks.add(key);

          // Deterministic hash pseudo-random roll
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

        // Pseudo-random tile variation based on tile coords
        const tileHash = Math.abs(Math.sin(tx * 374761393 + ty * 668265263) * 10000);
        const tileType = Math.floor(tileHash) % 10;

        // Base dark flagstone
        ctx.fillStyle = (tx + ty) % 2 === 0 ? '#111019' : '#0e0d16';
        ctx.fillRect(wx, wy, this.tileSize, this.tileSize);

        // Stone borders / mortar
        ctx.strokeStyle = '#181622';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(wx, wy, this.tileSize, this.tileSize);

        // Sub-paver grid
        ctx.strokeStyle = '#151320';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx + this.tileSize / 2, wy);
        ctx.lineTo(wx + this.tileSize / 2, wy + this.tileSize);
        ctx.moveTo(wx, wy + this.tileSize / 2);
        ctx.lineTo(wx + this.tileSize, wy + this.tileSize / 2);
        ctx.stroke();

        // Variations
        if (tileType === 1 || tileType === 2) {
          // Moss / sludge patch
          ctx.fillStyle = 'rgba(22, 101, 52, 0.15)';
          ctx.beginPath();
          ctx.arc(wx + this.tileSize * 0.4, wy + this.tileSize * 0.4, 28, 0, Math.PI * 2);
          ctx.fill();
        } else if (tileType === 3) {
          // Blood stain / rune
          ctx.fillStyle = 'rgba(153, 27, 27, 0.18)';
          ctx.beginPath();
          ctx.ellipse(wx + this.tileSize * 0.6, wy + this.tileSize * 0.6, 24, 14, 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (tileType === 4) {
          // Cracked stone line
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

    // Render destructibles
    for (const d of this.destructibles) {
      if (camera.isVisible(d.position, d.radius + 20)) {
        d.render(ctx);
      }
    }
  }
}
