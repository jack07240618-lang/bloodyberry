export class SpriteRenderer {
  private static instance: SpriteRenderer;
  private spriteSheets: Map<string, HTMLCanvasElement[]> = new Map();
  private whiteFlashSheets: Map<string, HTMLCanvasElement[]> = new Map();

  private constructor() {
    this.generateAllSprites();
  }

  public static getInstance(): SpriteRenderer {
    if (!SpriteRenderer.instance) {
      SpriteRenderer.instance = new SpriteRenderer();
    }
    return SpriteRenderer.instance;
  }

  public drawSprite(
    ctx: CanvasRenderingContext2D,
    spriteKey: string,
    frame: number,
    x: number,
    y: number,
    width: number,
    height: number,
    flipX = 1,
    isHit = false
  ): void {
    const sheets = isHit ? this.whiteFlashSheets.get(spriteKey) : this.spriteSheets.get(spriteKey);
    if (!sheets || sheets.length === 0) return;

    const canvas = sheets[Math.abs(frame) % sheets.length];

    ctx.save();
    ctx.translate(x, y);
    if (flipX < 0) {
      ctx.scale(-1, 1);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  private registerFrames(key: string, frames: HTMLCanvasElement[]): void {
    this.spriteSheets.set(key, frames);
    const whiteFrames = frames.map((f) => this.createWhiteSilhouette(f));
    this.whiteFlashSheets.set(key, whiteFrames);
  }

  private createWhiteSilhouette(source: HTMLCanvasElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /**
   * Post-processes an offscreen sprite canvas to add a crisp 1px dark gothic pixel outline
   * around all opaque pixels, giving sprites commercial indie pixel-art readability.
   */
  private applyPixelOutline(canvas: HTMLCanvasElement, outlineColor = '#07060c'): HTMLCanvasElement {
    const w = canvas.width;
    const h = canvas.height;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d')!;

    // Draw 4-neighbor shifted copies in outline color
    const temp = document.createElement('canvas');
    temp.width = w;
    temp.height = h;
    const tctx = temp.getContext('2d')!;
    tctx.drawImage(canvas, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = outlineColor;
    tctx.fillRect(0, 0, w, h);

    ctx.drawImage(temp, -1, 0);
    ctx.drawImage(temp, 1, 0);
    ctx.drawImage(temp, 0, -1);
    ctx.drawImage(temp, 0, 1);

    // Draw original crisp sprite on top
    ctx.drawImage(canvas, 0, 0);
    return out;
  }

  private generateAllSprites(): void {
    // 1. Playable Hero Archetypes (and default hunter_walk)
    this.registerFrames('hunter_walk', [0, 1, 2, 3].map((f) => this.createHeroSprite('antonio', f)));
    this.registerFrames('hero_antonio', [0, 1, 2, 3].map((f) => this.createHeroSprite('antonio', f)));
    this.registerFrames('hero_imelda', [0, 1, 2, 3].map((f) => this.createHeroSprite('imelda', f)));
    this.registerFrames('hero_gennaro', [0, 1, 2, 3].map((f) => this.createHeroSprite('gennaro', f)));
    this.registerFrames('hero_arca', [0, 1, 2, 3].map((f) => this.createHeroSprite('arca', f)));
    this.registerFrames('hero_pasqualina', [0, 1, 2, 3].map((f) => this.createHeroSprite('pasqualina', f)));
    this.registerFrames('hero_mortaccio', [0, 1, 2, 3].map((f) => this.createHeroSprite('mortaccio', f)));

    // 2. Monster Sprites
    this.registerFrames('ghoul_walk', [0, 1, 2, 3].map((f) => this.createGhoulSprite(f)));
    this.registerFrames('bat_fly', [0, 1, 2, 3].map((f) => this.createBatSprite(f)));
    this.registerFrames('spider_walk', [0, 1, 2, 3].map((f) => this.createSpiderSprite(f)));
    this.registerFrames('golem_walk', [0, 1, 2, 3].map((f) => this.createGolemSprite(f)));
    this.registerFrames('minotaur_walk', [0, 1, 2, 3].map((f) => this.createMinotaurSprite(f)));
    this.registerFrames('gargoyle_fly', [0, 1, 2, 3].map((f) => this.createGargoyleSprite(f)));
    this.registerFrames('slime_squish', [0, 1, 2, 3].map((f) => this.createSlimeSprite(f)));
    this.registerFrames('ghost_float', [0, 1, 2, 3].map((f) => this.createGhostSprite(f)));
    this.registerFrames('demon_boss', [0, 1, 2, 3].map((f) => this.createDemonBossSprite(f)));
  }

  // ============================================================================
  // HERO SPRITES (32x32 Crisp Pixel-Art Canvas + Automatic Dark Outlines)
  // ============================================================================
  private createHeroSprite(heroId: string, frame: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d')!;
    const bob = frame % 2 === 1 ? -1 : 0;
    const stride = frame === 1 ? 2 : frame === 3 ? -2 : 0;
    const capeWave = Math.sin(frame * Math.PI * 0.5) * 2;

    // Palette configuration per character
    let capeDark = '#7f1d1d';
    let capeMid = '#b91c1c';
    let capeLight = '#ef4444';
    let armorDark = '#1e293b';
    let armorMid = '#475569';
    let armorLight = '#94a3b8';
    let trimGold = '#f59e0b';
    let eyeGlow = '#38bdf8';

    if (heroId === 'imelda') {
      capeDark = '#4c1d95'; capeMid = '#7e22ce'; capeLight = '#c084fc';
      armorDark = '#1e1b4b'; armorMid = '#312e81'; armorLight = '#818cf8';
      eyeGlow = '#f0abfc';
    } else if (heroId === 'gennaro') {
      capeDark = '#064e3b'; capeMid = '#047857'; capeLight = '#34d399';
      armorDark = '#0f172a'; armorMid = '#334155'; armorLight = '#64748b';
      eyeGlow = '#6ee7b7';
    } else if (heroId === 'arca') {
      capeDark = '#450a0a'; capeMid = '#991b1b'; capeLight = '#f97316';
      armorDark = '#27272a'; armorMid = '#52525b'; armorLight = '#fbbf24';
      eyeGlow = '#fde047';
    } else if (heroId === 'pasqualina') {
      capeDark = '#78350f'; capeMid = '#d97706'; capeLight = '#fde047';
      armorDark = '#1e3a8a'; armorMid = '#2563eb'; armorLight = '#93c5fd';
      eyeGlow = '#38bdf8';
    } else if (heroId === 'mortaccio') {
      capeDark = '#1e1b4b'; capeMid = '#4338ca'; capeLight = '#818cf8';
      armorDark = '#cbd5e1'; armorMid = '#e2e8f0'; armorLight = '#ffffff';
      eyeGlow = '#ef4444';
    }

    // 1. Billowing Back Cloak (3-tone shaded folds)
    ctx.fillStyle = capeDark;
    ctx.beginPath();
    ctx.moveTo(11, 10 + bob);
    ctx.lineTo(5 + capeWave, 26);
    ctx.lineTo(19 + capeWave * 0.5, 27);
    ctx.lineTo(18, 11 + bob);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = capeMid;
    ctx.beginPath();
    ctx.moveTo(12, 11 + bob);
    ctx.lineTo(7 + capeWave, 25);
    ctx.lineTo(15 + capeWave * 0.5, 26);
    ctx.lineTo(16, 11 + bob);
    ctx.closePath();
    ctx.fill();

    // Cloak rim highlight
    ctx.fillStyle = capeLight;
    ctx.fillRect(7 + Math.round(capeWave), 18 + bob, 2, 6);

    // 2. Animated Armored Boots & Greaves
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(11 - stride, 24, 4, 6);
    ctx.fillRect(17 + stride, 24, 4, 6);
    // Steel knee guards
    ctx.fillStyle = armorLight;
    ctx.fillRect(11 - stride, 24, 3, 2);
    ctx.fillRect(17 + stride, 24, 3, 2);

    // 3. Torso / Cuirass / Tunic
    ctx.fillStyle = armorDark;
    ctx.fillRect(11, 12 + bob, 10, 12);
    ctx.fillStyle = armorMid;
    ctx.fillRect(12, 13 + bob, 8, 10);
    // Specular chest plate & belt
    ctx.fillStyle = armorLight;
    ctx.fillRect(13, 13 + bob, 6, 4);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(11, 20 + bob, 10, 2);
    // Golden Belt Buckle
    ctx.fillStyle = trimGold;
    ctx.fillRect(15, 20 + bob, 3, 2);

    // 4. Pauldrons (Shoulder Armor with Gold Trim)
    ctx.fillStyle = capeLight;
    ctx.fillRect(9, 11 + bob, 4, 4);
    ctx.fillRect(19, 11 + bob, 4, 4);
    ctx.fillStyle = trimGold;
    ctx.fillRect(9, 14 + bob, 4, 1);
    ctx.fillRect(19, 14 + bob, 4, 1);

    // 5. Head & Distinct Class Headgear
    if (heroId === 'mortaccio') {
      // Detailed Undead Skull Head with Jaw
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(12, 5 + bob, 8, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(13, 5 + bob, 6, 3);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(13, 10 + bob, 6, 2); // Teeth
      ctx.fillStyle = '#090d16';
      ctx.fillRect(14, 7 + bob, 2, 2);
      ctx.fillRect(18, 7 + bob, 2, 2);
      ctx.fillStyle = eyeGlow;
      ctx.fillRect(15, 7 + bob, 1, 1);
      ctx.fillRect(19, 7 + bob, 1, 1);
    } else if (heroId === 'imelda' || heroId === 'arca') {
      // Pointed Battlemage / Warlock Hat + Glowing Eyes under Brim
      ctx.fillStyle = '#fde68a'; // Face
      ctx.fillRect(13, 7 + bob, 6, 5);
      // Hat Brim
      ctx.fillStyle = capeDark;
      ctx.fillRect(8, 6 + bob, 16, 2);
      // Hat Cone
      ctx.fillStyle = capeMid;
      ctx.beginPath();
      ctx.moveTo(10, 6 + bob);
      ctx.lineTo(15, 1 + bob);
      ctx.lineTo(21, 6 + bob);
      ctx.closePath();
      ctx.fill();
      // Gold hat band
      ctx.fillStyle = trimGold;
      ctx.fillRect(11, 5 + bob, 10, 1);
      // Glowing eyes
      ctx.fillStyle = eyeGlow;
      ctx.fillRect(15, 8 + bob, 2, 2);
      ctx.fillRect(18, 8 + bob, 2, 2);
    } else {
      // Gothic Vampire Hunter Hood / Wide-Brimmed Hat + Flowing Hair
      ctx.fillStyle = '#fcd34d'; // Skin shadow
      ctx.fillRect(13, 6 + bob, 6, 5);
      // Dark Hood / Hunter Hat
      ctx.fillStyle = armorDark;
      ctx.fillRect(9, 5 + bob, 14, 2); // Wide brim
      ctx.fillRect(11, 2 + bob, 10, 4); // Crown
      ctx.fillStyle = capeMid;
      ctx.fillRect(11, 4 + bob, 10, 1); // Crimson hat ribbon
      // Glowing Hunter Eyes
      ctx.fillStyle = eyeGlow;
      ctx.fillRect(15, 7 + bob, 2, 2);
      ctx.fillRect(18, 7 + bob, 2, 2);
    }

    // 6. Signature Hand Weapon in Right Hand
    const wepY = 14 + bob + (frame % 2);
    if (heroId === 'imelda' || heroId === 'arca') {
      // Ornate Gem Staff
      ctx.fillStyle = '#78350f';
      ctx.fillRect(23, 8 + bob, 2, 18);
      ctx.fillStyle = trimGold;
      ctx.fillRect(22, 7 + bob, 4, 2);
      ctx.fillStyle = eyeGlow;
      ctx.fillRect(23, 4 + bob, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(24, 5 + bob, 1, 1);
    } else if (heroId === 'gennaro') {
      // Twin Silver Daggers
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(22, wepY, 7, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(23, wepY, 5, 1);
      ctx.fillStyle = trimGold;
      ctx.fillRect(21, wepY - 1, 2, 4);
    } else {
      // Vampire Killer Whip / Broadsword with Silver Blade Glint
      ctx.fillStyle = trimGold;
      ctx.fillRect(21, wepY - 2, 2, 6); // Crossguard
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(23, wepY - 1, 8, 3); // Blade body
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(23, wepY - 1, 7, 1); // Razor top highlight
    }

    return this.applyPixelOutline(c, '#05050a');
  }

  // ============================================================================
  // 1. GHOUL / UNDEAD SKELETON WARRIOR (32x32)
  // ============================================================================
  private createGhoulSprite(frame: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d')!;
    const bob = frame % 2 === 1 ? -1 : 0;
    const step = frame === 1 ? 2 : frame === 3 ? -2 : 0;
    const swing = frame === 2 ? 3 : 0;

    // Tattered Dark Necrotic Cloak Shroud
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(9, 11 + bob);
    ctx.lineTo(6, 26);
    ctx.lineTo(11, 24);
    ctx.lineTo(14, 27);
    ctx.lineTo(19, 25);
    ctx.lineTo(22, 27);
    ctx.lineTo(21, 12 + bob);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#312e81';
    ctx.fillRect(11, 12 + bob, 8, 10);

    // Exposed Ribcage Bones
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(13, 14 + bob, 5, 1);
    ctx.fillRect(13, 16 + bob, 5, 1);
    ctx.fillRect(14, 18 + bob, 4, 1);

    // Shuffling Bony Legs
    ctx.fillStyle = '#64748b';
    ctx.fillRect(11 - step, 24, 3, 5);
    ctx.fillRect(17 + step, 24, 3, 5);

    // Decayed Greenish-Bone Skull Head (Hunched Forward)
    ctx.fillStyle = '#65a30d'; // Rotting flesh shadow
    ctx.fillRect(12, 5 + bob, 9, 8);
    ctx.fillStyle = '#bef264'; // Skull highlight
    ctx.fillRect(13, 5 + bob, 7, 5);

    // Deep Dark Eye Sockets + Glowing Red Pupils
    ctx.fillStyle = '#090d16';
    ctx.fillRect(15, 7 + bob, 2, 2);
    ctx.fillRect(19, 7 + bob, 2, 2);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(16, 7 + bob, 1, 1);
    ctx.fillRect(20, 7 + bob, 1, 1);

    // Grinning Jaw & Blood Drip
    ctx.fillStyle = '#4d7c0f';
    ctx.fillRect(15, 11 + bob, 5, 2);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(17, 12 + bob, 2, 3);

    // Rusted Blood-Stained Cleaver in Outstretched Claw
    ctx.fillStyle = '#78350f';
    ctx.fillRect(21, 15 + bob + swing, 4, 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(24, 10 + bob + swing, 5, 7);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(27, 10 + bob + swing, 2, 7);
    ctx.fillStyle = '#dc2626'; // Blood on blade edge
    ctx.fillRect(26, 14 + bob + swing, 3, 3);

    return this.applyPixelOutline(c, '#07060e');
  }

  // ============================================================================
  // 2. GIANT VAMPIRE BAT (32x32)
  // ============================================================================
  private createBatSprite(frame: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d')!;
    const wingY = frame === 0 ? -7 : frame === 1 ? 0 : frame === 2 ? 6 : -2;

    // Ribbed Leathery Wings (Outer Dark Membrane + Inner Crimson Membrane)
    ctx.fillStyle = '#3b0764';
    ctx.beginPath();
    ctx.moveTo(14, 15);
    ctx.lineTo(2, 10 + wingY);
    ctx.lineTo(5, 19 + wingY * 0.6);
    ctx.lineTo(9, 17 + wingY * 0.3);
    ctx.lineTo(14, 20);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(18, 15);
    ctx.lineTo(30, 10 + wingY);
    ctx.lineTo(27, 19 + wingY * 0.6);
    ctx.lineTo(23, 17 + wingY * 0.3);
    ctx.lineTo(18, 20);
    ctx.closePath();
    ctx.fill();

    // Inner Wing Crimson Vein Shading
    ctx.fillStyle = '#9f1239';
    ctx.beginPath();
    ctx.moveTo(14, 16);
    ctx.lineTo(5, 13 + wingY);
    ctx.lineTo(8, 18 + wingY * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(18, 16);
    ctx.lineTo(27, 13 + wingY);
    ctx.lineTo(24, 18 + wingY * 0.5);
    ctx.closePath();
    ctx.fill();

    // Wing Bone Claws (Top Ridge)
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, 15);
    ctx.lineTo(2, 10 + wingY);
    ctx.moveTo(18, 15);
    ctx.lineTo(30, 10 + wingY);
    ctx.stroke();

    // Furry Bat Body & Pointed Ears
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(12, 12, 8, 9);
    ctx.fillStyle = '#4c1d95';
    ctx.fillRect(13, 13, 6, 7);

    // Pointed Ears
    ctx.fillStyle = '#3b0764';
    ctx.fillRect(12, 8, 2, 4);
    ctx.fillRect(18, 8, 2, 4);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(13, 9, 1, 2);
    ctx.fillRect(18, 9, 1, 2);

    // Glowing Yellow/Red Eyes & White Vampire Fangs
    ctx.fillStyle = '#facc15';
    ctx.fillRect(13, 13, 2, 2);
    ctx.fillRect(17, 13, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14, 16, 1, 2);
    ctx.fillRect(17, 16, 1, 2);

    return this.applyPixelOutline(c, '#06040a');
  }

  // ============================================================================
  // 3. BLACK WIDOW ARACHNID (28x28)
  // ============================================================================
  private createSpiderSprite(frame: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 28;
    c.height = 28;
    const ctx = c.getContext('2d')!;
    const legShift = frame % 2 === 0 ? 2 : -2;

    // 8 Jointed Chitinous Legs
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const yOff = 9 + i * 3;
      const s = (i % 2 === 0 ? 1 : -1) * legShift;
      // Left jointed leg
      ctx.beginPath();
      ctx.moveTo(11, yOff);
      ctx.lineTo(5, yOff - 3 + s);
      ctx.lineTo(2, yOff + 3 + s);
      ctx.stroke();
      // Right jointed leg
      ctx.beginPath();
      ctx.moveTo(17, yOff);
      ctx.lineTo(23, yOff - 3 - s);
      ctx.lineTo(26, yOff + 3 - s);
      ctx.stroke();
    }

    // Swollen Glossy Black Abdomen
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(14, 11, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Specular Chitin Highlight + Crimson Widow Hourglass
    ctx.fillStyle = '#475569';
    ctx.fillRect(11, 7, 2, 3);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(13, 8, 2, 2);
    ctx.fillRect(13, 11, 2, 2);

    // Cephalothorax (Head) & Venomous Mandibles
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(11, 16, 6, 5);
    // Cluster of 6 Glowing Red Spider Eyes
    ctx.fillStyle = '#f87171';
    ctx.fillRect(12, 18, 1, 1);
    ctx.fillRect(15, 18, 1, 1);
    ctx.fillRect(13, 19, 2, 1);
    // Dripping Green Venom Fangs
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(11, 21, 2, 3);
    ctx.fillRect(15, 21, 2, 3);

    return this.applyPixelOutline(c, '#040408');
  }

  // ============================================================================
  // 4. ARMORED DREADNOUGHT GOLEM KNIGHT (48x48)
  // ============================================================================
  private createGolemSprite(frame: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    const stomp = frame % 2 === 1 ? -2 : 0;
    const legL = frame === 1 ? -3 : 0;
    const legR = frame === 3 ? -3 : 0;

    // Massive Iron Greaves
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(13, 34 + legL, 8, 10);
    ctx.fillRect(27, 34 + legR, 8, 10);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(14, 35 + legL, 4, 4);
    ctx.fillRect(28, 35 + legR, 4, 4);

    // Colossal Dark-Steel Plate Torso
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(10, 14 + stomp, 28, 22);
    ctx.fillStyle = '#334155';
    ctx.fillRect(12, 16 + stomp, 24, 18);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(14, 17 + stomp, 20, 6); // Upper chest bevel

    // Glowing Molten Furnace Core Grate in Chest
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(18, 24 + stomp, 12, 7);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(20, 25 + stomp, 8, 5);
    // Iron bars across furnace chest
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(21, 24 + stomp, 2, 7);
    ctx.fillRect(25, 24 + stomp, 2, 7);

    // Spiked Giant Pauldrons
    ctx.fillStyle = '#475569';
    ctx.fillRect(4, 12 + stomp, 9, 12);
    ctx.fillRect(35, 12 + stomp, 9, 12);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(5, 13 + stomp, 6, 4);
    ctx.fillRect(36, 13 + stomp, 6, 4);
    // Shoulder Spikes
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(6, 8 + stomp, 3, 4);
    ctx.fillRect(39, 8 + stomp, 3, 4);

    // Horned Juggernaut Greathelm
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(17, 6 + stomp, 14, 10);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(19, 7 + stomp, 10, 4);
    // Glowing Visor Slit
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(19, 11 + stomp, 10, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(22, 11 + stomp, 4, 1);

    // Heavy Spiked Warhammer in Right Fist
    ctx.fillStyle = '#78350f';
    ctx.fillRect(39, 10 + stomp, 3, 28);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(34, 8 + stomp, 13, 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(35, 9 + stomp, 11, 3);

    return this.applyPixelOutline(c, '#05050a');
  }

  // ============================================================================
  // 5. INFERNAL MINOTAUR BERZERKER (48x48)
  // ============================================================================
  private createMinotaurSprite(frame: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    const bounce = frame % 2 === 1 ? -2 : 0;
    const swing = frame === 2 ? 4 : 0;

    // Cloven Hooves & Muscular Furred Legs
    ctx.fillStyle = '#451a03';
    ctx.fillRect(13, 33, 8, 11);
    ctx.fillRect(27, 33, 8, 11);
    ctx.fillStyle = '#f59e0b'; // Fiery hooves
    ctx.fillRect(13, 41, 8, 3);
    ctx.fillRect(27, 41, 8, 3);

    // Muscular Beast Torso (3-tone Crimson-Brown Fur & Pectorals)
    ctx.fillStyle = '#451a03';
    ctx.fillRect(11, 14 + bounce, 26, 20);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(13, 15 + bounce, 22, 17);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(15, 16 + bounce, 8, 8);
    ctx.fillRect(25, 16 + bounce, 8, 8);

    // Skull Waist Belt
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(21, 30 + bounce, 6, 5);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(22, 32 + bounce, 1, 1);
    ctx.fillRect(25, 32 + bounce, 1, 1);

    // Bull Snout & Mane
    ctx.fillStyle = '#27272a';
    ctx.fillRect(15, 6 + bounce, 18, 12);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(18, 8 + bounce, 12, 10);

    // Giant Curved Ivory Bull Horns
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(16, 10 + bounce);
    ctx.lineTo(5, 3 + bounce);
    ctx.lineTo(10, 13 + bounce);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(32, 10 + bounce);
    ctx.lineTo(43, 3 + bounce);
    ctx.lineTo(38, 13 + bounce);
    ctx.fill();

    // Glowing Rage Eyes & Golden Brass Nose Ring
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(19, 10 + bounce, 3, 2);
    ctx.fillRect(26, 10 + bounce, 3, 2);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(24, 18 + bounce, 3.5, 0, Math.PI * 2);
    ctx.stroke();

    // Double-Bitted Bloodied Executioner Battleaxe
    ctx.fillStyle = '#78350f';
    ctx.fillRect(37, 10 + bounce + swing, 3, 26);
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(38, 16 + bounce + swing);
    ctx.lineTo(47, 9 + bounce + swing);
    ctx.lineTo(47, 25 + bounce + swing);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(44, 12 + bounce + swing, 3, 10);

    return this.applyPixelOutline(c, '#07050a');
  }

  // ============================================================================
  // 6. ARCANE GARGOYLE SPITTER (34x34)
  // ============================================================================
  private createGargoyleSprite(frame: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 34;
    c.height = 34;
    const ctx = c.getContext('2d')!;
    const wingOff = frame % 2 === 0 ? -5 : 4;

    // Winged Demon Wings
    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.moveTo(13, 15);
    ctx.lineTo(2, 8 + wingOff);
    ctx.lineTo(5, 21 + wingOff * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(21, 15);
    ctx.lineTo(32, 8 + wingOff);
    ctx.lineTo(29, 21 + wingOff * 0.5);
    ctx.closePath();
    ctx.fill();

    // Muscular Imp Body & Tail
    ctx.fillStyle = '#6b21a8';
    ctx.fillRect(12, 11, 10, 12);
    ctx.fillStyle = '#9333ea';
    ctx.fillRect(13, 12, 8, 9);

    // Horns & Glowing Arcane Mouth Orb
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(11, 6, 2, 5);
    ctx.fillRect(21, 6, 2, 5);

    ctx.fillStyle = '#facc15';
    ctx.fillRect(14, 12, 2, 2);
    ctx.fillRect(18, 12, 2, 2);

    // Pulsing Arcane Energy Orb Held Between Claws
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(17, 20, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(16, 19, 2, 2);

    return this.applyPixelOutline(c, '#06040c');
  }

  // ============================================================================
  // 7. TOXIC ACID SLIME WITH FLOATING SKULL INSIDE (32x32)
  // ============================================================================
  private createSlimeSprite(frame: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d')!;
    const squishX = frame === 1 ? 3 : frame === 3 ? -2 : 0;
    const squishY = frame === 1 ? -3 : frame === 3 ? 2 : 0;

    // Outer Dark Emerald Jelly Mass
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.ellipse(16, 19 - squishY * 0.5, 11 + squishX, 9 + squishY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Midtone Acid Green Body
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.ellipse(16, 18 - squishY * 0.5, 9 + squishX * 0.8, 7.5 + squishY * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Floating Undigested Bone / Skull Core Inside Slime!
    ctx.fillStyle = '#d1fae5';
    ctx.fillRect(13, 14 - squishY * 0.5, 6, 5);
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(14, 15 - squishY * 0.5, 1, 2);
    ctx.fillRect(17, 15 - squishY * 0.5, 1, 2);

    // Acid Bubbles & Specular Glass Gloss
    ctx.fillStyle = '#6ee7b7';
    ctx.fillRect(10, 13 - squishY, 3, 2);
    ctx.fillRect(20, 19, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(11, 13 - squishY, 2, 1);

    return this.applyPixelOutline(c, '#032218');
  }

  // ============================================================================
  // 8. SPECTRAL GRIM REAPER WRAITH (32x32)
  // ============================================================================
  private createGhostSprite(frame: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d')!;
    const floatY = Math.sin(frame * Math.PI * 0.5) * 2;

    // Outer Spectral Cyan Cowl & Wispy Tail
    ctx.fillStyle = '#0e7490';
    ctx.beginPath();
    ctx.arc(16, 12 + floatY, 8, Math.PI, 0);
    ctx.lineTo(24, 26 + floatY);
    ctx.lineTo(20, 22 + floatY);
    ctx.lineTo(16, 28 + floatY);
    ctx.lineTo(12, 22 + floatY);
    ctx.lineTo(8, 26 + floatY);
    ctx.closePath();
    ctx.fill();

    // Inner Bright Ectoplasm Highlight
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(11, 9 + floatY, 10, 12);

    // Deep Void Face Inside Hood
    ctx.fillStyle = '#083344';
    ctx.fillRect(13, 10 + floatY, 7, 6);

    // Glowing Soul-Fire Eyes
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(14, 12 + floatY, 2, 2);
    ctx.fillRect(18, 12 + floatY, 2, 2);

    // Ethereal Soul Lantern Held in Front
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(24, 15 + floatY, 5, 6);
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(25, 16 + floatY, 3, 4);

    return this.applyPixelOutline(c, '#041e2b');
  }

  // ============================================================================
  // 9. ARCH-DEMON OVERLORD BOSS - MALAKOR (64x64)
  // ============================================================================
  private createDemonBossSprite(frame: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const wingBeat = frame % 2 === 0 ? -6 : 5;
    const breathe = frame % 2 === 1 ? -1 : 0;

    // 1. Colossal Ribbed Dragon Wings
    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.moveTo(24, 24);
    ctx.lineTo(2, 6 + wingBeat);
    ctx.lineTo(4, 38 + wingBeat * 0.5);
    ctx.lineTo(14, 34);
    ctx.lineTo(24, 38);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(40, 24);
    ctx.lineTo(62, 6 + wingBeat);
    ctx.lineTo(60, 38 + wingBeat * 0.5);
    ctx.lineTo(50, 34);
    ctx.lineTo(40, 38);
    ctx.closePath();
    ctx.fill();

    // Inner Wing Magma Membrane
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.moveTo(22, 26);
    ctx.lineTo(6, 12 + wingBeat);
    ctx.lineTo(8, 34 + wingBeat * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(42, 26);
    ctx.lineTo(58, 12 + wingBeat);
    ctx.lineTo(56, 34 + wingBeat * 0.5);
    ctx.closePath();
    ctx.fill();

    // 2. Armored Demon Legs & Talons
    ctx.fillStyle = '#18181b';
    ctx.fillRect(20, 44, 9, 15);
    ctx.fillRect(35, 44, 9, 15);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(19, 56, 10, 3);
    ctx.fillRect(35, 56, 10, 3);

    // 3. Titan Obsidian & Crimson Armor Torso
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(18, 20 + breathe, 28, 26);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(20, 22 + breathe, 24, 22);

    // Glowing Hellfire Magma Fissures in Chest
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(26, 25 + breathe, 12, 3);
    ctx.fillRect(28, 30 + breathe, 8, 3);
    ctx.fillRect(30, 35 + breathe, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(29, 26 + breathe, 6, 1);

    // Spiked Golden Demon Pauldrons
    ctx.fillStyle = '#b45309';
    ctx.fillRect(12, 18 + breathe, 9, 11);
    ctx.fillRect(43, 18 + breathe, 9, 11);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(14, 13 + breathe, 4, 5);
    ctx.fillRect(46, 13 + breathe, 4, 5);

    // 4. Horned Arch-Demon Head & Crown of Flame
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(23, 10 + breathe, 18, 13);

    // Giant Swept Obsidian Horns
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(23, 14 + breathe);
    ctx.lineTo(9, 2 + breathe);
    ctx.lineTo(18, 18 + breathe);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(41, 14 + breathe);
    ctx.lineTo(55, 2 + breathe);
    ctx.lineTo(46, 18 + breathe);
    ctx.fill();

    // 4 Blazing Hellfire Eyes & Fanged Maw
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(25, 14 + breathe, 4, 3);
    ctx.fillRect(35, 14 + breathe, 4, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(26, 20 + breathe, 2, 3);
    ctx.fillRect(30, 20 + breathe, 2, 3);
    ctx.fillRect(34, 20 + breathe, 2, 3);

    // 5. Runed Hellfire Greatsword
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(49, 28 + breathe, 10, 3); // Crossguard
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(52, 6 + breathe, 5, 24); // Molten blade
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(53, 8 + breathe, 2, 20); // White-hot core

    return this.applyPixelOutline(c, '#050205');
  }
}
