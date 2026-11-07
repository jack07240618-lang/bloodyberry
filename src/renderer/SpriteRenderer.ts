export class SpriteRenderer {
  private static instance: SpriteRenderer;
  private cache: Map<string, HTMLCanvasElement> = new Map();

  constructor() {
    this.generateAllSprites();
  }

  public static getInstance(): SpriteRenderer {
    if (!SpriteRenderer.instance) {
      SpriteRenderer.instance = new SpriteRenderer();
    }
    return SpriteRenderer.instance;
  }

  private generateAllSprites(): void {
    this.createHunterSprite();
    this.createGhoulSprite();
    this.createBatSprite();
    this.createSpiderSprite();
    this.createGolemSprite();
    this.createMinotaurSprite();
    this.createGargoyleSprite();
    this.createSlimeSprite();
    this.createGhostSprite();
    this.createDemonBossSprite();
  }

  // --- 1. Gothic Vampire Hunter 32x32 (4-frame walk cycle) ---
  private createHunterSprite(): void {
    const frameW = 32, frameH = 32, frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const legOffset = (f === 1) ? 2 : (f === 3) ? -2 : 0;
      const cloakWave = (f % 2 === 1) ? 3 : 0;

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(ox + 16, 29, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Flowing Trenchcoat / Cloak
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(ox + 10, 10);
      ctx.lineTo(ox + 4 - cloakWave, 26);
      ctx.lineTo(ox + 14, 24);
      ctx.closePath();
      ctx.fill();

      // Boots & Legs
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(ox + 11 + legOffset, 22, 4, 7);
      ctx.fillRect(ox + 17 - legOffset, 22, 4, 7);

      // Body Coat & Leather Belts
      ctx.fillStyle = '#312e81';
      ctx.fillRect(ox + 11, 12, 10, 11);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(ox + 11, 18, 10, 2); // Belt
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(ox + 15, 17, 3, 3); // Gold Buckle

      // Silver Rapier Sword at hip
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox + 20, 16);
      ctx.lineTo(ox + 27, 25);
      ctx.stroke();

      // Hood & Face
      ctx.fillStyle = '#4338ca';
      ctx.beginPath();
      ctx.arc(ox + 16, 9, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Shadow in hood & glowing Cyan Hunter eyes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(ox + 16, 8, 4, 3);
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(ox + 17, 9, 2.5, 1.5);
    }

    this.cache.set('hunter_walk', canvas);
  }

  // --- 2. Rotting Ghoul / Skeleton 32x32 ---
  private createGhoulSprite(): void {
    const frameW = 32, frameH = 32, frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const bob = (f % 2 === 1) ? 1 : 0;
      const reach = (f === 1 || f === 2) ? 3 : 0;

      // Ribcage
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(ox + 13, 12 + bob, 6, 9);
      ctx.fillStyle = '#334155';
      ctx.fillRect(ox + 12, 18 + bob, 8, 4);

      // Rusty Meat Cleaver
      ctx.fillStyle = '#78350f';
      ctx.fillRect(ox + 18, 14 + bob, 6 + reach, 2.5);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(ox + 23 + reach, 11 + bob, 3, 7);

      // Skull
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(ox + 16, 9 + bob, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(ox + 17, 8 + bob, 2, 2);
    }

    this.cache.set('ghoul_walk', canvas);
  }

  // --- 3. Vampiric Bat 32x32 ---
  private createBatSprite(): void {
    const frameW = 32, frameH = 32, frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const wingY = (f === 0 || f === 2) ? 4 : (f === 1) ? 10 : -2;

      ctx.fillStyle = '#831843';
      ctx.beginPath();
      ctx.ellipse(ox + 16, 16, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing membranes
      ctx.fillStyle = '#be123c';
      ctx.beginPath();
      ctx.moveTo(ox + 16, 14);
      ctx.lineTo(ox + 29, 10 + wingY);
      ctx.lineTo(ox + 22, 22);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(ox + 16, 14);
      ctx.lineTo(ox + 3, 10 + wingY);
      ctx.lineTo(ox + 10, 22);
      ctx.closePath();
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(ox + 14, 14, 1.5, 1.5);
      ctx.fillRect(ox + 17, 14, 1.5, 1.5);
    }

    this.cache.set('bat_fly', canvas);
  }

  // --- 4. Cave Spider 32x32 ---
  private createSpiderSprite(): void {
    const frameW = 32, frameH = 32, frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const legSpread = (f % 2 === 1) ? 2 : -2;

      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(ox + 16, 16, 6, 0, Math.PI * 2);
      ctx.fill();

      // Red venom abdomen
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.ellipse(ox + 10, 16, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 2;
      for (let l = -1; l <= 1; l++) {
        ctx.beginPath();
        ctx.moveTo(ox + 16 + l * 3, 16);
        ctx.lineTo(ox + 16 + l * 5 + 6 + legSpread, 8);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(ox + 16 + l * 3, 16);
        ctx.lineTo(ox + 16 + l * 5 + 6 + legSpread, 24);
        ctx.stroke();
      }
    }

    this.cache.set('spider_walk', canvas);
  }

  // --- 5. Armored Iron Golem 48x48 ---
  private createGolemSprite(): void {
    const frameW = 48, frameH = 48, frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const bob = (f % 2 === 1) ? 1 : 0;

      // Heavy Iron Armor
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(ox + 14, 12 + bob, 20, 26, 4);
      ctx.fill();

      // Riveted Plates
      ctx.fillStyle = '#475569';
      ctx.fillRect(ox + 16, 15 + bob, 16, 10);

      // Glowing Molten Core
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(ox + 21, 27 + bob, 6, 6);

      // Glowing Visor
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ox + 18, 16 + bob, 12, 2.5);
    }

    this.cache.set('golem_walk', canvas);
  }

  // --- 6. Dread Minotaur 48x48 ---
  private createMinotaurSprite(): void {
    const frameW = 48, frameH = 48, frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const bob = (f % 2 === 1) ? 2 : 0;

      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.roundRect(ox + 16, 14 + bob, 16, 24, 4);
      ctx.fill();

      // Golden Horns
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(ox + 24, 15 + bob);
      ctx.quadraticCurveTo(ox + 34, 4 + bob, ox + 36, 14 + bob);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(ox + 24, 15 + bob);
      ctx.quadraticCurveTo(ox + 14, 4 + bob, ox + 12, 14 + bob);
      ctx.stroke();

      // Red Eyes
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ox + 26, 18 + bob, 2.5, 2);
    }

    this.cache.set('minotaur_walk', canvas);
  }

  // --- 7. Abyssal Gargoyle 32x32 ---
  private createGargoyleSprite(): void {
    const frameW = 32, frameH = 32, frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const wing = (f % 2 === 1) ? 3 : -2;

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(ox + 16, 16, 7, 0, Math.PI * 2);
      ctx.fill();

      // Stone Wings
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(ox + 14, 12);
      ctx.lineTo(ox + 28, 6 + wing);
      ctx.lineTo(ox + 22, 22);
      ctx.closePath();
      ctx.fill();

      // Purple Eye
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(ox + 18, 14, 2.5, 2.5);
    }

    this.cache.set('gargoyle_fly', canvas);
  }

  // --- 8. Toxic Slime 32x32 ---
  private createSlimeSprite(): void {
    const frameW = 32, frameH = 32, frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const squish = (f % 2 === 1) ? 1.2 : 0.85;

      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.ellipse(ox + 16, 18, 11 * squish, 9 / squish, 0, 0, Math.PI * 2);
      ctx.fill();

      // Slime Gloss highlight
      ctx.fillStyle = '#6ee7b7';
      ctx.beginPath();
      ctx.arc(ox + 13, 14, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    this.cache.set('slime_squish', canvas);
  }

  // --- 9. Spectral Ghost 32x32 ---
  private createGhostSprite(): void {
    const frameW = 32, frameH = 32, frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const wave = Math.sin((f * Math.PI) / 2) * 3;

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(ox + 16, 13, 7, Math.PI, 0);
      ctx.lineTo(ox + 23, 24);
      ctx.quadraticCurveTo(ox + 16, 28 + wave, ox + 9, 24);
      ctx.closePath();
      ctx.fill();

      // Cyan hollow eyes
      ctx.fillStyle = '#082f49';
      ctx.fillRect(ox + 14, 12, 2, 3);
      ctx.fillRect(ox + 18, 12, 2, 3);
    }

    this.cache.set('ghost_float', canvas);
  }

  // --- 10. Demon Lord Boss 64x64 ---
  private createDemonBossSprite(): void {
    const frameW = 64, frameH = 64, frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const breath = Math.sin((f * Math.PI) / 2) * 2;

      // Massive Demon Wings
      ctx.fillStyle = '#450a0a';
      ctx.beginPath();
      ctx.moveTo(ox + 32, 28);
      ctx.lineTo(ox + 58, 8 - breath);
      ctx.lineTo(ox + 48, 48);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(ox + 32, 28);
      ctx.lineTo(ox + 6, 8 - breath);
      ctx.lineTo(ox + 16, 48);
      ctx.closePath();
      ctx.fill();

      // Muscular Crimson Torso
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.roundRect(ox + 20, 20 - breath, 24, 34, 6);
      ctx.fill();

      // Obsidian Horns
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.moveTo(ox + 26, 16 - breath);
      ctx.lineTo(ox + 18, 4 - breath);
      ctx.lineTo(ox + 29, 12 - breath);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(ox + 38, 16 - breath);
      ctx.lineTo(ox + 46, 4 - breath);
      ctx.lineTo(ox + 35, 12 - breath);
      ctx.closePath();
      ctx.fill();

      // Flaming Yellow Slit Eyes
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(ox + 27, 18 - breath, 3, 2);
      ctx.fillRect(ox + 34, 18 - breath, 3, 2);
    }

    this.cache.set('demon_boss', canvas);
  }

  public drawSprite(
    ctx: CanvasRenderingContext2D,
    sheetName: string,
    frameIndex: number,
    dx: number,
    dy: number,
    width: number,
    height: number,
    facing = 1,
    isHitFlash = false
  ): void {
    const sheet = this.cache.get(sheetName);
    if (!sheet) return;

    const is64 = (sheetName === 'demon_boss');
    const is48 = (sheetName === 'golem_walk' || sheetName === 'minotaur_walk');
    const frameW = is64 ? 64 : is48 ? 48 : 32;
    const frameH = is64 ? 64 : is48 ? 48 : 32;

    const totalFrames = sheet.width / frameW;
    const f = Math.floor(frameIndex) % totalFrames;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.scale(facing, 1);

    if (isHitFlash) {
      ctx.filter = 'brightness(350%)';
    }

    ctx.drawImage(
      sheet,
      f * frameW,
      0,
      frameW,
      frameH,
      -width / 2,
      -height / 2,
      width,
      height
    );

    ctx.restore();
  }
}
