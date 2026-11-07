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
    this.createDemonBossSprite();
  }

  // --- 1. Gothic Vampire Hunter 32x32 (4-frame walk cycle) ---
  private createHunterSprite(): void {
    const frameW = 32;
    const frameH = 32;
    const frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const legOffset = (f === 1) ? 2 : (f === 3) ? -2 : 0;
      const cloakWave = (f % 2 === 1) ? 2 : 0;

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(ox + 16, 29, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Flowing Crimson/Midnight Cloak
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(ox + 10, 10);
      ctx.lineTo(ox + 5 - cloakWave, 26);
      ctx.lineTo(ox + 14, 24);
      ctx.closePath();
      ctx.fill();

      // Boots & Legs
      ctx.fillStyle = '#18181b';
      ctx.fillRect(ox + 11 + legOffset, 22, 4, 7);
      ctx.fillRect(ox + 17 - legOffset, 22, 4, 7);

      // Belt & Body coat
      ctx.fillStyle = '#312e81';
      ctx.fillRect(ox + 11, 12, 10, 11);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(ox + 11, 18, 10, 2); // Belt
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(ox + 15, 17, 3, 3); // Gold Buckle

      // Silver Rapier Sword at hip
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox + 20, 16);
      ctx.lineTo(ox + 27, 25);
      ctx.stroke();

      // Hood & Face
      ctx.fillStyle = '#4338ca';
      ctx.beginPath();
      ctx.arc(ox + 16, 9, 6, 0, Math.PI * 2);
      ctx.fill();

      // Shadow in hood & glowing Cyan Hunter eyes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(ox + 16, 8, 4, 3);
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(ox + 17, 9, 2, 1.5);
    }

    this.cache.set('hunter_walk', canvas);
  }

  // --- 2. Rotting Ghoul 32x32 (4-frame shuffle cycle) ---
  private createGhoulSprite(): void {
    const frameW = 32;
    const frameH = 32;
    const frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const bob = (f % 2 === 1) ? 1 : 0;
      const reach = (f === 1 || f === 2) ? 3 : 0;

      // Tattered Body
      ctx.fillStyle = '#3f6212'; // Rot green
      ctx.fillRect(ox + 12, 12 + bob, 8, 12);

      // Rags
      ctx.fillStyle = '#334155';
      ctx.fillRect(ox + 11, 16 + bob, 10, 6);

      // Reaching Arms
      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(ox + 18, 14 + bob, 6 + reach, 3);

      // Head with glowing red eye socket
      ctx.fillStyle = '#365314';
      ctx.beginPath();
      ctx.arc(ox + 16, 9 + bob, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ox + 18, 8 + bob, 2, 2);
    }

    this.cache.set('ghoul_walk', canvas);
  }

  // --- 3. Vampiric Bat 32x32 (4-frame flap cycle) ---
  private createBatSprite(): void {
    const frameW = 32;
    const frameH = 32;
    const frames = 4;
    const canvas = document.createElement('canvas');
    canvas.width = frameW * frames;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d')!;

    for (let f = 0; f < frames; f++) {
      const ox = f * frameW;
      const wingY = (f === 0 || f === 2) ? 4 : (f === 1) ? 10 : -2;

      // Furry Body
      ctx.fillStyle = '#831843';
      ctx.beginPath();
      ctx.ellipse(ox + 16, 16, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Leathery Wings with bones
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

      // Glowing Eyes
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(ox + 14, 14, 1.5, 1.5);
      ctx.fillRect(ox + 17, 14, 1.5, 1.5);
    }

    this.cache.set('bat_fly', canvas);
  }

  // --- 4. Demon Lord Boss 64x64 (4-frame pulsating stance) ---
  private createDemonBossSprite(): void {
    const frameW = 64;
    const frameH = 64;
    const frames = 4;
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

    const frameW = (sheetName === 'demon_boss') ? 64 : 32;
    const frameH = (sheetName === 'demon_boss') ? 64 : 32;
    const totalFrames = sheet.width / frameW;
    const f = Math.floor(frameIndex) % totalFrames;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.scale(facing, 1);

    if (isHitFlash) {
      ctx.filter = 'brightness(300%)';
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
