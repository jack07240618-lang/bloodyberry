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
    this.bloodDecals.push({
      x,
      y,
      radius: radius * (0.85 + Math.random() * 0.45),
      color,
      alpha: 0.65,
      seed: Math.floor(Math.random() * 100)
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

    // 2. Render Persistent Battle Scars / Blood Splatters
    for (const decal of this.bloodDecals) {
      if (camera.isVisible(new Vector2(decal.x, decal.y), decal.radius + 10)) {
        ctx.save();
        ctx.globalAlpha = decal.alpha;
        ctx.fillStyle = decal.color;
        ctx.beginPath();
        ctx.arc(decal.x, decal.y, decal.radius, 0, Math.PI * 2);
        ctx.arc(
          decal.x + ((decal.seed % 9) - 4),
          decal.y + (((decal.seed * 3) % 9) - 4),
          decal.radius * 0.6,
          0,
          Math.PI * 2
        );
        ctx.arc(
          decal.x - ((decal.seed % 7) - 3),
          decal.y + ((decal.seed % 5) - 2),
          decal.radius * 0.4,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
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
   * Renders the ancient Gothic Mystery Door WITHOUT any room-type label or color hint.
   * The player only sees a mysterious sealed archway portal and discovers the room upon entering.
   */
  private renderMysteryDoor(ctx: CanvasRenderingContext2D, door: MysteryDoor): void {
    ctx.save();
    ctx.translate(door.x, door.y);
    door.pulseTimer += 0.05;

    // 1. Ground Shadow & Stone Threshold Steps
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    ctx.ellipse(0, 20, 34, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-28, 14, 56, 5);
    ctx.fillStyle = '#334155';
    ctx.fillRect(-25, 11, 50, 4);

    // 2. Mysterious Swirl Portal Glow (Uniform neutral silver-arcane mist — never reveals room type!)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glowR = 44 + Math.sin(door.pulseTimer * 2) * 4;
    const pGrad = ctx.createRadialGradient(0, -10, 4, 0, -10, glowR);
    pGrad.addColorStop(0, 'rgba(241, 245, 249, 0.85)');
    pGrad.addColorStop(0.45, 'rgba(148, 163, 184, 0.35)');
    pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(0, -10, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Heavy Carved Gothic Cathedral Stone Archway Frame & Keystone
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-25, 14);
    ctx.lineTo(-25, -18);
    ctx.arc(0, -18, 25, Math.PI, 0);
    ctx.lineTo(25, 14);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top Keystone Block
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(-6, -46);
    ctx.lineTo(6, -46);
    ctx.lineTo(4, -37);
    ctx.lineTo(-4, -37);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. Inner Dark Iron-Bound Mystery Door Leaf (Strictly NO text or room icon!)
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.moveTo(-18, 13);
    ctx.lineTo(-18, -16);
    ctx.arc(0, -16, 18, Math.PI, 0);
    ctx.lineTo(18, 13);
    ctx.closePath();
    ctx.fill();

    // Swirling Neutral Mist Spirals on the Door Surface
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.32)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -6, 9 + Math.sin(door.pulseTimer * 3) * 2, door.pulseTimer, door.pulseTimer + Math.PI * 1.3);
    ctx.stroke();
    ctx.restore();

    // Wrought-Iron Straps & Center Seam
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(0, 13);
    ctx.moveTo(-18, -7);
    ctx.lineTo(18, -7);
    ctx.moveTo(-18, 5);
    ctx.lineTo(18, 5);
    ctx.stroke();

    // Twin Ornate Brass Knockers
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-5.5, -1, 2.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5.5, -1, 2.8, 0, Math.PI * 2);
    ctx.stroke();

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

    // 1. Vertical Celestial Pillar Beam from Sky (High Rarity Boss Relic Indicator)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beamW = 22 + Math.sin(s.pulseTimer * 2.5) * 4;
    const beamGrad = ctx.createLinearGradient(-beamW, 0, beamW, 0);
    beamGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    beamGrad.addColorStop(0.5, s.type === 'FRENZY' ? 'rgba(239, 68, 68, 0.28)' : s.type === 'GREED' ? 'rgba(251, 191, 36, 0.28)' : 'rgba(52, 211, 153, 0.28)');
    beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(-beamW, -280, beamW * 2, 288);

    // 2. Double Rotating Sacred Ritual Rings on Ground
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 4, s.radius + Math.sin(s.pulseTimer * 2) * 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = subColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 4, s.radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 3. Ornate Gothic Stepped Stone Altar Base with Gold Trim
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-16, 0, 32, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-12, -20, 24, 22);
    ctx.fillStyle = '#334155';
    ctx.fillRect(-9, -18, 18, 18);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-12, -20, 24, 22);

    // 4. Floating Multi-Faceted Boss Relic Crystal & Orbiting Runes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bob = Math.sin(s.pulseTimer * 3) * 4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -38 + bob);
    ctx.lineTo(11, -24 + bob);
    ctx.lineTo(0, -12 + bob);
    ctx.lineTo(-11, -24 + bob);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -34 + bob);
    ctx.lineTo(5, -24 + bob);
    ctx.lineTo(0, -16 + bob);
    ctx.lineTo(-5, -24 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 5. Golden Crown Title Above Boss Altar
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 10px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    const label =
      s.type === 'FRENZY'
        ? '★ BOSS ALTAR: WARLORD (+75% DMG) ★'
        : s.type === 'GREED'
        ? '★ BOSS ALTAR: ASCENSION (+40% DMG & GOLD) ★'
        : '★ BOSS ALTAR: IMMORTAL (+35% DMG & FULL HEAL) ★';
    ctx.fillText(label, 0, -45);

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

    // 1. Multi-Stop Layered Atmospheric Darkness Vignette Centered on Player
    const playerScreenX = player.position.x - camera.position.x + halfW;
    const playerScreenY = player.position.y - camera.position.y + halfH;

    const vignette = ctx.createRadialGradient(
      playerScreenX,
      playerScreenY,
      85,
      playerScreenX,
      playerScreenY,
      Math.max(w, h) * 0.74
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.38, 'rgba(8, 6, 20, 0.22)');
    vignette.addColorStop(0.70, 'rgba(5, 3, 14, 0.54)');
    vignette.addColorStop(1, 'rgba(2, 1, 6, 0.84)');

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

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

    // 2c. Dynamic Projectile & Boss Point Lights
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

      // Boss Crimson Hellfire Point Light
      for (const enemy of combatSystem.enemies) {
        if (!enemy.active || !enemy.isBoss || !camera.isVisible(enemy.position, 180)) continue;
        const sx = enemy.position.x - camera.position.x + halfW;
        const sy = enemy.position.y - camera.position.y + halfH;
        const bGlow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 160);
        bGlow.addColorStop(0, 'rgba(239, 68, 68, 0.28)');
        bGlow.addColorStop(0.6, 'rgba(153, 27, 27, 0.10)');
        bGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bGlow;
        ctx.beginPath();
        ctx.arc(sx, sy, 160, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
