import { Vector2 } from '../core/Vector2';
import { Camera } from '../core/Camera';
import { Destructible } from '../entities/Destructible';
import { Player } from '../entities/Player';
import { CombatSystem } from './CombatSystem';

export interface BloodDecal {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  seed: number;
  rotation: number;
  stretchX: number;
  stretchY: number;
  lobeRadii: number[];
  droplets: { dx: number; dy: number; r: number; rx: number; ry: number; ang: number }[];
}

export type ShrineType = 'FRENZY' | 'GREED' | 'BLESSING';

export type RoomType = 'NORMAL' | 'ELITE' | 'BLACKSMITH' | 'EVENT';

export interface MysteryDoor {
  x: number;
  y: number;
  radius: number;
  hiddenRoomType: RoomType;
  active: boolean;
  pulseTimer: number;
}

export interface BloodShrine {
  x: number;
  y: number;
  radius: number;
  type: ShrineType;
  active: boolean;
  pulseTimer: number;
}

export class MapSystem {
  public destructibles: Destructible[] = [];
  public shrines: BloodShrine[] = [];
  public mysteryDoor: MysteryDoor | null = null;
  public currentRoomType: RoomType = 'NORMAL';
  public currentStageNumber = 1;
  public currentBiomeIndex = 0; // 0: Crimson, 1: Frostbite, 2: Verdant, 3: Infernal, 4: Astral
  private roundsSinceBlacksmith = 99;
  private roundsSinceEvent = 99;
  private spawnedChunks: Set<string> = new Set();
  private readonly chunkSize = 512;
  private readonly tileSize = 64;
  private bloodDecals: BloodDecal[] = [];
  private biomeAtlases: HTMLCanvasElement[][] = [];
  private bossEclipseFactor = 0;

  constructor() {
    this.buildTileAtlas();
  }

  /**
   * Pre-renders 5 x 8 richly textured 64x64 Biome tile atlases (Crimson Catacombs, Frostbite Glacier,
   * Verdant Blight, Infernal Forge, Astral Void) onto offscreen canvases for zero-overhead 60 FPS blitting.
   */
  private buildTileAtlas(): void {
    const biomePalettes = [
      // 0: 绯红地牢 (Crimson Catacombs)
      {
        mortar: '#08070e',
        shades: ['#13111c', '#161421', '#100e18'],
        bevelLight: '#252138',
        bevelDark: '#09080f',
        veinColor: 'rgba(185, 28, 28, 0.28)',
        patchColor1: 'rgba(127, 29, 29, 0.26)',
        patchColor2: 'rgba(220, 38, 38, 0.18)',
        runeColor: 'rgba(239, 68, 68, 0.25)',
        pebbleColor: '#475569'
      },
      // 1: 极寒冰渊 (Frostbite Glacier)
      {
        mortar: '#040b14',
        shades: ['#0c192c', '#0f2036', '#091424'],
        bevelLight: '#1e3a5f',
        bevelDark: '#050c16',
        veinColor: 'rgba(56, 189, 248, 0.35)',
        patchColor1: 'rgba(14, 165, 233, 0.24)',
        patchColor2: 'rgba(186, 230, 253, 0.22)',
        runeColor: 'rgba(56, 189, 248, 0.28)',
        pebbleColor: '#7dd3fc'
      },
      // 2: 翡翠腐林 (Verdant Blight)
      {
        mortar: '#050e0a',
        shades: ['#0d1c14', '#112319', '#0a1610'],
        bevelLight: '#1f3d2c',
        bevelDark: '#050c08',
        veinColor: 'rgba(16, 185, 129, 0.30)',
        patchColor1: 'rgba(21, 128, 61, 0.34)',
        patchColor2: 'rgba(74, 222, 128, 0.22)',
        runeColor: 'rgba(52, 211, 153, 0.26)',
        pebbleColor: '#34d399'
      },
      // 3: 炼狱熔炉 (Infernal Forge)
      {
        mortar: '#140704',
        shades: ['#1c100d', '#22130f', '#160c09'],
        bevelLight: '#3b2119',
        bevelDark: '#0c0503',
        veinColor: 'rgba(249, 115, 22, 0.42)',
        patchColor1: 'rgba(194, 65, 12, 0.28)',
        patchColor2: 'rgba(251, 191, 36, 0.24)',
        runeColor: 'rgba(249, 115, 22, 0.30)',
        pebbleColor: '#f59e0b'
      },
      // 4: 星界虚空 (Astral Void)
      {
        mortar: '#090416',
        shades: ['#150d2a', '#191032', '#110a22'],
        bevelLight: '#2e1d54',
        bevelDark: '#070310',
        veinColor: 'rgba(192, 132, 252, 0.34)',
        patchColor1: 'rgba(126, 34, 206, 0.26)',
        patchColor2: 'rgba(232, 121, 249, 0.22)',
        runeColor: 'rgba(192, 132, 252, 0.28)',
        pebbleColor: '#d8b4fe'
      }
    ];

    this.biomeAtlases = [];

    for (let bIdx = 0; bIdx < biomePalettes.length; bIdx++) {
      const pal = biomePalettes[bIdx];
      const atlas: HTMLCanvasElement[] = [];

      for (let variant = 0; variant < 8; variant++) {
        const c = document.createElement('canvas');
        c.width = this.tileSize;
        c.height = this.tileSize;
        const ctx = c.getContext('2d')!;

        // Deep mortar / magma / ice vein base
        ctx.fillStyle = pal.mortar;
        ctx.fillRect(0, 0, 64, 64);

        const blocks =
          variant % 2 === 0
            ? [
                { x: 2, y: 2, w: 28, h: 28 },
                { x: 32, y: 2, w: 30, h: 28 },
                { x: 2, y: 32, w: 30, h: 30 },
                { x: 34, y: 32, w: 28, h: 30 }
              ]
            : [
                { x: 2, y: 2, w: 38, h: 26 },
                { x: 42, y: 2, w: 20, h: 26 },
                { x: 2, y: 30, w: 22, h: 32 },
                { x: 26, y: 30, w: 36, h: 32 }
              ];

        for (let b = 0; b < blocks.length; b++) {
          const blk = blocks[b];
          const shade = (variant + b) % 3;
          ctx.fillStyle = pal.shades[shade];
          ctx.fillRect(blk.x, blk.y, blk.w, blk.h);

          // Top-left specular stone bevel
          ctx.fillStyle = pal.bevelLight;
          ctx.fillRect(blk.x, blk.y, blk.w, 1.5);
          ctx.fillRect(blk.x, blk.y, 1.5, blk.h);

          // Bottom-right deep shadow bevel
          ctx.fillStyle = pal.bevelDark;
          ctx.fillRect(blk.x, blk.y + blk.h - 2, blk.w, 2);
          ctx.fillRect(blk.x + blk.w - 2, blk.y, 2, blk.h);

          // Subtle surface grain speckles
          ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.fillRect(blk.x + 6, blk.y + 7, 3, 2);
          ctx.fillRect(blk.x + blk.w - 10, blk.y + blk.h - 9, 4, 3);
        }

        // Biome-specific environmental surface details
        if (variant === 1 || variant === 5) {
          // Glowing elemental fissure / frost crack / magma vein
          ctx.strokeStyle = pal.veinColor;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(12, 10);
          ctx.lineTo(24, 22);
          ctx.lineTo(20, 38);
          ctx.lineTo(34, 48);
          ctx.stroke();
        } else if (variant === 2 || variant === 6) {
          // Biome moss / frost rime / ember slag patches in crevices
          ctx.fillStyle = pal.patchColor1;
          ctx.fillRect(26, 25, 10, 8);
          ctx.fillRect(4, 28, 10, 5);
          ctx.fillStyle = pal.patchColor2;
          ctx.fillRect(29, 27, 5, 4);
        } else if (variant === 4) {
          // Engraved biome rune slab
          ctx.strokeStyle = pal.runeColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(32, 32, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(32, 16);
          ctx.lineTo(45, 40);
          ctx.lineTo(19, 40);
          ctx.closePath();
          ctx.stroke();
        } else if (variant === 7) {
          // Crystalline shards / embers / bone fragments on floor
          ctx.fillStyle = pal.pebbleColor;
          ctx.fillRect(14, 44, 5, 2);
          ctx.fillRect(13, 43, 2, 4);
          ctx.fillRect(46, 16, 3, 3);
        }

        atlas.push(c);
      }

      this.biomeAtlases.push(atlas);
    }
  }

  public addBloodDecal(x: number, y: number, color = '#7f1d1d', radius = 14): void {
    const baseR = radius * (0.85 + Math.random() * 0.45);
    const vertexCount = 10;
    const lobeRadii: number[] = [];
    const phase1 = Math.random() * Math.PI * 2;
    const phase2 = Math.random() * Math.PI * 2;

    for (let i = 0; i < vertexCount; i++) {
      const ang = (i * Math.PI * 2) / vertexCount;
      // Organic multi-frequency liquid puddle contour (avoiding any uniform circle)
      const wave =
        1.0 +
        Math.sin(ang * 2 + phase1) * 0.24 +
        Math.cos(ang * 3 + phase2) * 0.18 +
        (Math.random() - 0.5) * 0.26;
      lobeRadii.push(baseR * Math.max(0.52, Math.min(1.42, wave)));
    }

    const dropCount = 4 + Math.floor(Math.random() * 5);
    const droplets: { dx: number; dy: number; r: number; rx: number; ry: number; ang: number }[] = [];
    for (let d = 0; d < dropCount; d++) {
      const dAng = Math.random() * Math.PI * 2;
      const dist = baseR * (0.82 + Math.random() * 0.85);
      const dr = Math.max(1.4, baseR * (0.11 + Math.random() * 0.18));
      const stretch = 1.15 + Math.random() * 0.65;
      droplets.push({
        dx: Math.cos(dAng) * dist,
        dy: Math.sin(dAng) * dist * 0.78,
        r: dr,
        rx: dr * stretch,
        ry: dr / Math.sqrt(stretch),
        ang: dAng + (Math.random() - 0.5) * 0.35
      });
    }

    this.bloodDecals.push({
      x,
      y,
      radius: baseR,
      color,
      alpha: 0.72,
      seed: Math.floor(Math.random() * 100),
      rotation: (Math.random() - 0.5) * 0.7,
      stretchX: 0.95 + Math.random() * 0.32,
      stretchY: 0.64 + Math.random() * 0.22, // 2.5D ground perspective compression
      lobeRadii,
      droplets
    });

    if (this.bloodDecals.length > 260) {
      this.bloodDecals.shift();
    }
  }

  public update(playerPos: Vector2, dt: number): void {
    const cx = Math.floor(playerPos.x / this.chunkSize);
    const cy = Math.floor(playerPos.y / this.chunkSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        if (!this.spawnedChunks.has(key)) {
          this.spawnedChunks.add(key);
          this.populateChunk(cx + dx, cy + dy);
        }
      }
    }

    for (let i = this.destructibles.length - 1; i >= 0; i--) {
      const d = this.destructibles[i];
      if (!d.active) {
        this.destructibles.splice(i, 1);
      } else {
        d.update(dt);
      }
    }
  }

  private populateChunk(cx: number, cy: number): void {
    const hash = Math.abs(Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453);
    const count = 1 + Math.floor((hash % 1) * 2.5);

    for (let i = 0; i < count; i++) {
      const rx = ((hash * (i + 1) * 1.37) % 1) * this.chunkSize;
      const ry = ((hash * (i + 2) * 2.91) % 1) * this.chunkSize;
      const worldX = cx * this.chunkSize + rx;
      const worldY = cy * this.chunkSize + ry;

      if (Math.hypot(worldX, worldY) > 160) {
        this.destructibles.push(new Destructible(worldX, worldY));
      }
    }
  }

  /**
   * Spawns a rare, high-powered Gothic Blood Shrine exclusively at the location where a Boss was defeated!
   */
  public spawnBossShrine(_x: number, _y: number): void {
    // Disabled standalone labeled shrines on Boss death so ONLY the single unlabeled Mystery Door appears!
    this.shrines = [];
  }

  /**
   * Spawns a single unlabeled Mystery Door upon clearing a stage / boss.
   * Enforces the 2-round cooldown rule for BLACKSMITH and EVENT rooms:
   * If BLACKSMITH or EVENT was entered in the previous round (roundsSince < 2), it CANNOT be rolled.
   */
  public spawnMysteryDoor(x: number, y: number): void {
    const pool: { type: RoomType; weight: number }[] = [
      { type: 'NORMAL', weight: 35 },
      { type: 'ELITE', weight: 25 }
    ];

    if (this.roundsSinceBlacksmith >= 2) {
      pool.push({ type: 'BLACKSMITH', weight: 20 });
    }
    if (this.roundsSinceEvent >= 2) {
      pool.push({ type: 'EVENT', weight: 20 });
    }

    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen: RoomType = 'NORMAL';
    for (const entry of pool) {
      if (roll < entry.weight) {
        chosen = entry.type;
        break;
      }
      roll -= entry.weight;
    }

    // Replace any existing door so there is strictly only ONE door at a time
    this.mysteryDoor = {
      x,
      y,
      radius: 30,
      hiddenRoomType: chosen,
      active: true,
      pulseTimer: 0
    };
  }

  /**
   * Advances round cooldown trackers when the player steps into the Mystery Door.
   */
  public enterMysteryDoor(): RoomType | null {
    if (!this.mysteryDoor || !this.mysteryDoor.active) return null;
    const enteredType = this.mysteryDoor.hiddenRoomType;
    this.mysteryDoor.active = false;
    this.mysteryDoor = null;
    this.currentRoomType = enteredType;
    this.currentStageNumber++;

    // Update 2-round cooldown counters
    this.roundsSinceBlacksmith++;
    this.roundsSinceEvent++;

    if (enteredType === 'BLACKSMITH') {
      this.roundsSinceBlacksmith = 0; // Cannot spawn in the next round!
    } else if (enteredType === 'EVENT') {
      this.roundsSinceEvent = 0;      // Cannot spawn in the next round!
    }

    return enteredType;
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const halfW = camera.viewportWidth / 2;
    const halfH = camera.viewportHeight / 2;

    const startX = Math.floor((camera.position.x - halfW) / this.tileSize) * this.tileSize;
    const endX = Math.ceil((camera.position.x + halfW) / this.tileSize) * this.tileSize;
    const startY = Math.floor((camera.position.y - halfH) / this.tileSize) * this.tileSize;
    const endY = Math.ceil((camera.position.y + halfH) / this.tileSize) * this.tileSize;

    // 1. Blit Pre-Rendered Biome Cobblestone / Slate / Magma / Glacier Atlas Tiles
    const activeAtlas = this.biomeAtlases[this.currentBiomeIndex % this.biomeAtlases.length] || this.biomeAtlases[0];
    for (let x = startX; x <= endX; x += this.tileSize) {
      for (let y = startY; y <= endY; y += this.tileSize) {
        const tx = Math.floor(x / this.tileSize);
        const ty = Math.floor(y / this.tileSize);
        const hash = Math.abs((tx * 73856093) ^ (ty * 19349663));
        const variant = hash % 13 === 0 ? 4 : hash % 9 === 0 ? 7 : hash % 4;
        ctx.drawImage(activeAtlas[variant], x, y);

        // Occasional Sanctuary Floor Pillar Medallion at Chunk Intersections
        if (tx % 8 === 0 && ty % 8 === 0) {
          this.renderSanctuaryFloorMedallion(ctx, x, y);
        }
      }
    }

    // 2. Render Persistent Battle Scars / Organic Liquid Puddle Blood Splatters
    for (const decal of this.bloodDecals) {
      if (camera.isVisible(new Vector2(decal.x, decal.y), decal.radius * 1.8 + 12)) {
        this.renderOrganicBloodPuddle(ctx, decal);
      }
    }

    // 3. Render Destructible Braziers
    for (const d of this.destructibles) {
      if (camera.isVisible(d.position, d.radius + 30)) {
        d.render(ctx);
      }
    }

    // 4. Render Interactive Gothic Shrines
    for (const s of this.shrines) {
      if (!s.active) continue;
      if (camera.isVisible(new Vector2(s.x, s.y), 60)) {
        this.renderShrine(ctx, s);
      }
    }

    // 5. Render Single Unlabeled Mystery Door (if active)
    if (this.mysteryDoor && this.mysteryDoor.active) {
      if (camera.isVisible(new Vector2(this.mysteryDoor.x, this.mysteryDoor.y), 80)) {
        this.renderMysteryDoor(ctx, this.mysteryDoor);
      }
    }
  }

  /**
   * Renders an irregular, organic liquid puddle stain with smooth Bezier lobes, coagulated dark rim,
   * directional splatter droplets, and subtle wet liquid surface sheen.
   */
  private renderOrganicBloodPuddle(ctx: CanvasRenderingContext2D, decal: BloodDecal): void {
    ctx.save();
    ctx.translate(decal.x, decal.y);
    ctx.rotate(decal.rotation);
    ctx.scale(decal.stretchX, decal.stretchY);

    const n = decal.lobeRadii.length;
    const buildOrganicPath = (scale = 1.0, offsetX = 0, offsetY = 0) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const angCurr = (i * Math.PI * 2) / n;
        const angNext = (((i + 1) % n) * Math.PI * 2) / n;
        const rCurr = decal.lobeRadii[i] * scale;
        const rNext = decal.lobeRadii[(i + 1) % n] * scale;

        const xCurr = offsetX + Math.cos(angCurr) * rCurr;
        const yCurr = offsetY + Math.sin(angCurr) * rCurr;
        const xNext = offsetX + Math.cos(angNext) * rNext;
        const yNext = offsetY + Math.sin(angNext) * rNext;

        const midX = (xCurr + xNext) * 0.5;
        const midY = (yCurr + yNext) * 0.5;

        if (i === 0) {
          const prevAng = (((n - 1) * Math.PI * 2) / n);
          const prevR = decal.lobeRadii[n - 1] * scale;
          const xPrev = offsetX + Math.cos(prevAng) * prevR;
          const yPrev = offsetY + Math.sin(prevAng) * prevR;
          ctx.moveTo((xPrev + xCurr) * 0.5, (yPrev + yCurr) * 0.5);
        }
        ctx.quadraticCurveTo(xCurr, yCurr, midX, midY);
      }
      ctx.closePath();
    };

    // 1. Outer Seeping Liquid Stain & Coagulated Rim (深色水渍浸润边缘)
    ctx.globalAlpha = decal.alpha * 0.58;
    ctx.fillStyle = '#230509';
    buildOrganicPath(1.06, 0, 1);
    ctx.fill();

    // 2. Main Viscous Puddle Body (主水洼不规则流体层)
    ctx.globalAlpha = decal.alpha * 0.88;
    ctx.fillStyle = decal.color;
    buildOrganicPath(0.95, 0, 0);
    ctx.fill();

    // 3. Deeper Coagulated Core Pool (中心浓稠深潭)
    ctx.globalAlpha = decal.alpha * 0.65;
    ctx.fillStyle = 'rgba(15, 2, 6, 0.55)';
    buildOrganicPath(0.56, (decal.seed % 3) - 1, -0.5);
    ctx.fill();

    // 4. Subtle Wet Liquid Specular Highlight (水迹表面湿润反光弧)
    ctx.globalAlpha = decal.alpha * 0.26;
    ctx.fillStyle = 'rgba(255, 228, 230, 0.42)';
    buildOrganicPath(0.32, -decal.radius * 0.18, -decal.radius * 0.16);
    ctx.fill();

    // 5. Peripheral Splatter Droplets & Trails (四周飞溅的小水滴与拖拽液滴)
    ctx.globalAlpha = decal.alpha * 0.82;
    ctx.fillStyle = decal.color;
    for (const drop of decal.droplets) {
      ctx.save();
      ctx.translate(drop.dx, drop.dy);
      ctx.rotate(drop.ang);
      ctx.beginPath();
      ctx.ellipse(0, 0, drop.rx, drop.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Renders the ancient Gothic Mystery Door WITHOUT any room-type label or color hint.
   * The player only sees a mysterious sealed archway portal and discovers the room upon entering.
   */
  private renderMysteryDoor(ctx: CanvasRenderingContext2D, door: MysteryDoor): void {
    ctx.save();
    ctx.translate(door.x, door.y);
    door.pulseTimer += 0.05;

    // 1. Ground Shadow & Stone Threshold Steps
    // 1. Deep Ground Ambient Occlusion & 3D Beveled Stone Plinth
    const aoGrad = ctx.createRadialGradient(0, 18, 4, 0, 18, 46);
    aoGrad.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
    aoGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.45)');
    aoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aoGrad;
    ctx.beginPath();
    ctx.ellipse(0, 18, 46, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#09080f';
    ctx.fillRect(-30, 13, 60, 7);
    ctx.fillStyle = '#181526';
    ctx.fillRect(-29, 13, 58, 5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(-29, 13, 58, 1.5);

    // 2. Volumetric Portal Spill Glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glowR = 52 + Math.sin(door.pulseTimer * 2) * 5;
    const pGrad = ctx.createRadialGradient(0, -8, 3, 0, -8, glowR);
    pGrad.addColorStop(0, 'rgba(233, 213, 255, 0.72)');
    pGrad.addColorStop(0.45, 'rgba(139, 92, 246, 0.32)');
    pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(0, -8, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. 3D Shaded Stone Archway Pylons & Voussoirs (No thin sketch strokes)
    const archGrad = ctx.createLinearGradient(-32, -48, 32, 16);
    archGrad.addColorStop(0, '#2a243d');
    archGrad.addColorStop(0.5, '#171424');
    archGrad.addColorStop(1, '#090710');
    ctx.fillStyle = archGrad;
    ctx.beginPath();
    ctx.moveTo(-32, 15);
    ctx.lineTo(-32, -20);
    ctx.arc(0, -20, 32, Math.PI, 0);
    ctx.lineTo(32, 15);
    ctx.closePath();
    ctx.fill();

    // Stone Pylon Relief Blocks
    for (const side of [-1, 1]) {
      const bx = side < 0 ? -34 : 24;
      for (let row = 0; row < 4; row++) {
        const by = -20 + row * 8.5;
        ctx.fillStyle = row % 2 === 0 ? '#1e1a2e' : '#151221';
        ctx.fillRect(bx, by, 10, 8);
        ctx.fillStyle = '#332d4d';
        ctx.fillRect(bx, by, 10, 1.5);
        ctx.fillStyle = '#08060e';
        ctx.fillRect(bx, by + 6.5, 10, 1.5);
      }
    }

    // 4. Inner Volumetric Dimensional Singularity & Swirling Plasma Clouds
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-22, 13);
    ctx.lineTo(-22, -18);
    ctx.arc(0, -18, 22, Math.PI, 0);
    ctx.lineTo(22, 13);
    ctx.closePath();
    ctx.fillStyle = '#020107';
    ctx.fill();
    ctx.clip();

    ctx.globalCompositeOperation = 'lighter';
    for (let c = 0; c < 6; c++) {
      const ang = door.pulseTimer * 1.4 + (c * Math.PI) / 3;
      const cx = Math.cos(ang) * 9;
      const cy = -8 + Math.sin(ang) * 11;
      const cGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, 20);
      cGrad.addColorStop(0, c % 2 === 0 ? 'rgba(221, 214, 254, 0.55)' : 'rgba(251, 191, 36, 0.42)');
      cGrad.addColorStop(0.55, c % 2 === 0 ? 'rgba(124, 58, 237, 0.28)' : 'rgba(185, 28, 28, 0.22)');
      cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Event Horizon Core
    ctx.globalCompositeOperation = 'source-over';
    const voidCore = ctx.createRadialGradient(0, -8, 1, 0, -8, 11);
    voidCore.addColorStop(0, '#010004');
    voidCore.addColorStop(0.65, 'rgba(4, 2, 12, 0.85)');
    voidCore.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = voidCore;
    ctx.beginPath();
    ctx.arc(0, -8, 11, 0, Math.PI * 2);
    ctx.fill();

    // Volumetric Rising Energy Motes
    ctx.globalCompositeOperation = 'lighter';
    for (let m = 0; m < 8; m++) {
      const mProg = (door.pulseTimer * 0.75 + m * 0.125) % 1;
      const mRad = (1 - mProg) * 20;
      const mAng = -door.pulseTimer * 1.9 + m * 0.9;
      const mx = Math.cos(mAng) * mRad;
      const my = -8 + Math.sin(mAng) * mRad * 1.15;
      const mGlow = ctx.createRadialGradient(mx, my, 0.2, mx, my, 4.5);
      mGlow.addColorStop(0, '#ffffff');
      mGlow.addColorStop(0.45, m % 2 === 0 ? '#e9d5ff' : '#fde047');
      mGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mGlow;
      ctx.globalAlpha = Math.sin(mProg * Math.PI) * 0.95;
      ctx.beginPath();
      ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }

  private renderShrine(ctx: CanvasRenderingContext2D, s: BloodShrine): void {
    ctx.save();
    ctx.translate(s.x, s.y);
    s.pulseTimer += 0.05;

    const color =
      s.type === 'FRENZY' ? '#ef4444' : s.type === 'GREED' ? '#fbbf24' : '#34d399';
    const subColor =
      s.type === 'FRENZY' ? '#f97316' : s.type === 'GREED' ? '#fef08a' : '#38bdf8';
    const glowRgb =
      s.type === 'FRENZY' ? '239, 68, 68' : s.type === 'GREED' ? '251, 191, 36' : '52, 211, 153';
    const facetDark =
      s.type === 'FRENZY' ? '#7f1d1d' : s.type === 'GREED' ? '#92400e' : '#065f46';
    const facetLight =
      s.type === 'FRENZY' ? '#fca5a5' : s.type === 'GREED' ? '#fef08a' : '#a7f3d0';
    const pulse = 0.88 + Math.sin(s.pulseTimer * 2.4) * 0.12;

    // 1. 2.5D Ground Contact Shadow & Perspective Ritual Sigil
    ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
    ctx.beginPath();
    ctx.ellipse(2, 10, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(0, 6);
    ctx.scale(1, 0.5);
    ctx.globalCompositeOperation = 'lighter';

    const sigilGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, s.radius * 1.15);
    sigilGlow.addColorStop(0, `rgba(${glowRgb}, ${0.26 * pulse})`);
    sigilGlow.addColorStop(0.65, `rgba(${glowRgb}, ${0.08 * pulse})`);
    sigilGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sigilGlow;
    ctx.beginPath();
    ctx.arc(0, 0, s.radius * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(s.pulseTimer * 0.35);
    ctx.strokeStyle = `rgba(${glowRgb}, 0.55)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, s.radius * 0.92, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = subColor;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, s.radius * 0.68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4 Cardinal Rune Ticks
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (s.radius * 0.72), Math.sin(a) * (s.radius * 0.72));
      ctx.lineTo(Math.cos(a) * (s.radius * 0.98), Math.sin(a) * (s.radius * 0.98));
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    // 2. Feathered Volumetric Light Column (No hard rectangle edges)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(0, -45);
    ctx.scale(1, 3.6);
    const beamGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 32 * pulse);
    beamGrad.addColorStop(0, `rgba(${glowRgb}, ${0.22 * pulse})`);
    beamGrad.addColorStop(0.45, `rgba(${glowRgb}, ${0.09 * pulse})`);
    beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 32 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Sculpted 2.5D Gothic Stepped Obsidian Altar with Gold Filigree
    // Lower chamfered plinth
    const plinthGrad = ctx.createLinearGradient(-20, 2, 20, 10);
    plinthGrad.addColorStop(0, '#1e293b');
    plinthGrad.addColorStop(0.5, '#0f172a');
    plinthGrad.addColorStop(1, '#060913');
    ctx.fillStyle = plinthGrad;
    ctx.beginPath();
    ctx.moveTo(-17, 0);
    ctx.lineTo(17, 0);
    ctx.lineTo(21, 9);
    ctx.lineTo(-21, 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Main altar body with 3D side shading
    const bodyGrad = ctx.createLinearGradient(-14, -20, 14, 0);
    bodyGrad.addColorStop(0, '#27344a');
    bodyGrad.addColorStop(0.35, '#172033');
    bodyGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(-13, -19);
    ctx.lineTo(13, -19);
    ctx.lineTo(15, 1);
    ctx.lineTo(-15, 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Recessed Gothic pointed-arch niche
    ctx.fillStyle = '#04060c';
    ctx.beginPath();
    ctx.moveTo(-6, -1);
    ctx.lineTo(-6, -10);
    ctx.quadraticCurveTo(-6, -15, 0, -17);
    ctx.quadraticCurveTo(6, -15, 6, -10);
    ctx.lineTo(6, -1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${glowRgb}, 0.55)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Glowing inlaid rune inside niche
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(0, -4);
    ctx.moveTo(-3, -9);
    ctx.lineTo(3, -9);
    ctx.stroke();
    ctx.restore();

    // Top beveled altar capital & specular lip
    const capGrad = ctx.createLinearGradient(-16, -24, 16, -18);
    capGrad.addColorStop(0, '#334155');
    capGrad.addColorStop(0.5, '#1e293b');
    capGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.moveTo(-16, -22);
    ctx.lineTo(16, -22);
    ctx.lineTo(14, -18);
    ctx.lineTo(-14, -18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(-14, -22, 28, 1.5);

    // 4. Floating Multi-Faceted Volumetric Relic Crystal & Orbiting Motes
    const bob = Math.sin(s.pulseTimer * 2.6) * 3.5;
    const cy = -33 + bob;

    // Soft crystal halo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const haloGrad = ctx.createRadialGradient(0, cy, 1, 0, cy, 20 * pulse);
    haloGrad.addColorStop(0, `rgba(${glowRgb}, 0.55)`);
    haloGrad.addColorStop(0.5, `rgba(${glowRgb}, 0.18)`);
    haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(0, cy, 20 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Top-left bright facet
    ctx.fillStyle = facetLight;
    ctx.beginPath();
    ctx.moveTo(0, cy - 13);
    ctx.lineTo(0, cy);
    ctx.lineTo(-9, cy);
    ctx.closePath();
    ctx.fill();

    // Top-right mid facet
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, cy - 13);
    ctx.lineTo(9, cy);
    ctx.lineTo(0, cy);
    ctx.closePath();
    ctx.fill();

    // Bottom-left mid facet
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-9, cy);
    ctx.lineTo(0, cy);
    ctx.lineTo(0, cy + 12);
    ctx.closePath();
    ctx.fill();

    // Bottom-right deep shadow facet
    ctx.fillStyle = facetDark;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(9, cy);
    ctx.lineTo(0, cy + 12);
    ctx.closePath();
    ctx.fill();

    // Specular ridge & gold collar
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy - 13);
    ctx.lineTo(0, cy + 12);
    ctx.stroke();

    // Orbiting rune sparks
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const ang = s.pulseTimer * 1.4 + (i * Math.PI * 2) / 3;
      const mx = Math.cos(ang) * 14;
      const my = cy + Math.sin(ang) * 5;
      ctx.fillStyle = subColor;
      ctx.beginPath();
      ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5. Minimalist Gothic Crest Label
    ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.font = '700 9px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 5;
    const label =
      s.type === 'FRENZY'
        ? 'WARLORD SHRINE'
        : s.type === 'GREED'
        ? 'ASCENSION SHRINE'
        : 'IMMORTAL SHRINE';
    ctx.fillText(label, 0, -54);

    ctx.restore();
  }

  private renderSanctuaryFloorMedallion(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(220, 38, 38, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.stroke();

    // 8-Pointed Gothic Cathedral Compass Star
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renders multi-layered atmospheric gothic darkness vignette + real-time 2.5D additive colored light pools
   * with multi-radius volumetric falloff for the Player, flickering Torch Braziers, Projectiles, and Bosses.
   */
  public renderLighting(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    player: Player,
    combatSystem?: CombatSystem
  ): void {
    const w = camera.viewportWidth;
    const h = camera.viewportHeight;
    const halfW = w / 2;
    const halfH = h / 2;

    ctx.save();

    // Check if any Boss is active or spawning to drive oppressive dynamic eclipse lighting & shadow
    let activeBossCount = 0;
    let anyBossEnraged = false;
    if (combatSystem) {
      for (const e of combatSystem.enemies) {
        if (e.active && e.isBoss) {
          activeBossCount++;
          if (e.bossPhase === 2) anyBossEnraged = true;
        }
      }
    }
    const targetEclipse = activeBossCount > 0 ? Math.min(1.25, 0.85 + (activeBossCount - 1) * 0.2) : 0;
    this.bossEclipseFactor += (targetEclipse - this.bossEclipseFactor) * 0.06;
    const eclipse = Math.max(0, Math.min(1.25, this.bossEclipseFactor));

    // 1. Multi-Stop Layered Atmospheric Darkness Vignette Centered on Player (Deepens dramatically during Boss Eclipse!)
    const playerScreenX = player.position.x - camera.position.x + halfW;
    const playerScreenY = player.position.y - camera.position.y + halfH;

    const innerClearR = Math.max(58, 85 - eclipse * 22);
    const outerDarkR = Math.max(w, h) * (0.74 - eclipse * 0.10);
    const vignette = ctx.createRadialGradient(
      playerScreenX,
      playerScreenY,
      innerClearR,
      playerScreenX,
      playerScreenY,
      outerDarkR
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.36, `rgba(7, 4, 18, ${(0.22 + eclipse * 0.22).toFixed(3)})`);
    vignette.addColorStop(0.68, `rgba(4, 2, 12, ${(0.54 + eclipse * 0.24).toFixed(3)})`);
    vignette.addColorStop(1, `rgba(1, 0, 5, ${Math.min(0.96, 0.84 + eclipse * 0.11).toFixed(3)})`);

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // 1b. Boss Abyssal Peripheral Shadow Rings (Darkens the room around each Boss before the additive light pass)
    if (combatSystem && eclipse > 0.02) {
      for (const enemy of combatSystem.enemies) {
        if (!enemy.active || !enemy.isBoss || !camera.isVisible(enemy.position, 280)) continue;
        const bsx = enemy.position.x - camera.position.x + halfW;
        const bsy = enemy.position.y - camera.position.y + halfH;
        const shadowRing = ctx.createRadialGradient(bsx, bsy, 42, bsx, bsy, 240);
        shadowRing.addColorStop(0, 'rgba(0, 0, 0, 0)');
        shadowRing.addColorStop(0.55, 'rgba(2, 1, 7, 0.42)');
        shadowRing.addColorStop(0.85, 'rgba(2, 1, 7, 0.22)');
        shadowRing.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadowRing;
        ctx.beginPath();
        ctx.arc(bsx, bsy, 240, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Additive Multi-Layered Dynamic Point Lights ('lighter')
    ctx.globalCompositeOperation = 'lighter';

    // 2a. Player Dual-Layer Heroic Lantern Aura (Wide Warm Bounce + Crisp Inner Core)
    const pOuter = ctx.createRadialGradient(playerScreenX, playerScreenY, 12, playerScreenX, playerScreenY, 210);
    pOuter.addColorStop(0, 'rgba(251, 191, 36, 0.08)');
    pOuter.addColorStop(0.5, 'rgba(56, 189, 248, 0.05)');
    pOuter.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pOuter;
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, 210, 0, Math.PI * 2);
    ctx.fill();

    const pInner = ctx.createRadialGradient(playerScreenX, playerScreenY, 4, playerScreenX, playerScreenY, 95);
    pInner.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    pInner.addColorStop(0.45, 'rgba(56, 189, 248, 0.09)');
    pInner.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pInner;
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, 95, 0, Math.PI * 2);
    ctx.fill();

    // 2a-ii. North Sanctuary Portal Volumetric Point Light (Casts atmospheric glow onto the north wall & floor)
    const portalWorldPos = new Vector2(0, -372);
    if (camera.isVisible(portalWorldPos, 240)) {
      const psx = portalWorldPos.x - camera.position.x + halfW;
      const psy = portalWorldPos.y - camera.position.y + halfH;
      const isRoomLocked = combatSystem && combatSystem.enemies.some(e => e.active);
      const timeNow = performance.now() * 0.001;
      const pPulse = 0.88 + Math.sin(timeNow * 3.2) * 0.12;
      const pRad = (isRoomLocked ? 145 : 215) * pPulse;
      const portalLight = ctx.createRadialGradient(psx, psy, 6, psx, psy + 18, pRad);
      if (isRoomLocked) {
        portalLight.addColorStop(0, 'rgba(248, 113, 113, 0.24)');
        portalLight.addColorStop(0.45, 'rgba(185, 28, 28, 0.12)');
        portalLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        portalLight.addColorStop(0, 'rgba(243, 232, 255, 0.34)');
        portalLight.addColorStop(0.38, 'rgba(168, 85, 247, 0.18)');
        portalLight.addColorStop(0.72, 'rgba(251, 191, 36, 0.08)');
        portalLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = portalLight;
      ctx.beginPath();
      ctx.arc(psx, psy + 18, pRad, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2b. Flickering Torch Brazier Volumetric Point Lights (Core + Atmospheric Scatter)
    for (const d of this.destructibles) {
      if (!d.active || !camera.isVisible(d.position, 160)) continue;
      const sx = d.position.x - camera.position.x + halfW;
      const sy = d.position.y - camera.position.y + halfH;
      const radius = 135 + Math.sin(d.flameTimer) * 14;

      const tGlow = ctx.createRadialGradient(sx, sy, 3, sx, sy, radius);
      tGlow.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
      tGlow.addColorStop(0.35, 'rgba(251, 146, 60, 0.18)');
      tGlow.addColorStop(0.7, 'rgba(185, 28, 28, 0.07)');
      tGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = tGlow;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2c. Dynamic Projectile & Boss Volumetric Lighting & God-Ray Spotlights
    if (combatSystem) {
      // Limit to up to 24 active projectiles on screen for locked 60 FPS
      let lightCount = 0;
      for (const proj of combatSystem.projectiles) {
        if (!proj.active || !camera.isVisible(proj.position, 90)) continue;
        if (lightCount >= 24) break;
        lightCount++;

        const sx = proj.position.x - camera.position.x + halfW;
        const sy = proj.position.y - camera.position.y + halfH;
        const lRadius = Math.min(110, Math.max(48, proj.radius * 2.4));

        const projGlow = ctx.createRadialGradient(sx, sy, 2, sx, sy, lRadius);
        projGlow.addColorStop(0, proj.glowColor || proj.color);
        projGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = projGlow;
        ctx.beginPath();
        ctx.arc(sx, sy, lRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Boss Volumetric Rim-Light, Variant Hellfire Pool & Overhead Eclipse Spotlight Shaft
      const bossPalettes = [
        { core: 'rgba(254, 202, 202, 0.36)', mid: 'rgba(220, 38, 38, 0.22)', outer: 'rgba(127, 29, 29, 0.08)' },
        { core: 'rgba(233, 213, 255, 0.36)', mid: 'rgba(147, 51, 234, 0.22)', outer: 'rgba(88, 28, 135, 0.08)' },
        { core: 'rgba(254, 240, 138, 0.34)', mid: 'rgba(234, 88, 12, 0.20)', outer: 'rgba(154, 52, 18, 0.08)' },
        { core: 'rgba(167, 243, 208, 0.34)', mid: 'rgba(16, 185, 129, 0.20)', outer: 'rgba(6, 95, 70, 0.08)' }
      ];

      for (const enemy of combatSystem.enemies) {
        if (!enemy.active || !enemy.isBoss || !camera.isVisible(enemy.position, 260)) continue;
        const sx = enemy.position.x - camera.position.x + halfW;
        const sy = enemy.position.y - camera.position.y + halfH;
        const pal = bossPalettes[enemy.bossVariant % bossPalettes.length];
        const isP2 = enemy.bossPhase === 2 || anyBossEnraged;
        const pulse = 0.88 + Math.sin(enemy.animTimer * 3.6) * 0.12;
        const lightR = (isP2 ? 235 : 195) * pulse;

        // 1. Wide Volumetric Boss Light Pool
        const bGlow = ctx.createRadialGradient(sx, sy, 6, sx, sy, lightR);
        bGlow.addColorStop(0, isP2 ? 'rgba(254, 240, 138, 0.42)' : pal.core);
        bGlow.addColorStop(0.38, isP2 ? 'rgba(239, 68, 68, 0.26)' : pal.mid);
        bGlow.addColorStop(0.75, pal.outer);
        bGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bGlow;
        ctx.beginPath();
        ctx.arc(sx, sy, lightR, 0, Math.PI * 2);
        ctx.fill();

        // 2. Angled Overhead Eclipse Spotlight Shaft descending onto each Boss
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(-0.22);
        const shaftGrad = ctx.createLinearGradient(0, -280, 0, 45);
        shaftGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        shaftGrad.addColorStop(0.55, isP2 ? 'rgba(251, 191, 36, 0.09)' : 'rgba(220, 38, 38, 0.07)');
        shaftGrad.addColorStop(0.88, isP2 ? 'rgba(239, 68, 68, 0.16)' : pal.mid);
        shaftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shaftGrad;
        ctx.beginPath();
        ctx.moveTo(-24, -280);
        ctx.lineTo(24, -280);
        ctx.lineTo(68, 45);
        ctx.lineTo(-68, 45);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }
}
