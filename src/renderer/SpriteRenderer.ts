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

    // 2. Monster Sprites (64x64 2.5D Dark Gothic Multi-Pose: move x6, windup x4, strike x4)
    const mobDefs: Array<{
      id: string;
      legacyKey: string;
      builder: (frame: number, pose: 'move' | 'windup' | 'strike') => HTMLCanvasElement;
    }> = [
      { id: 'ghoul', legacyKey: 'ghoul_walk', builder: (f, p) => this.createGhoulSprite(f, p) },
      { id: 'bat', legacyKey: 'bat_fly', builder: (f, p) => this.createBatSprite(f, p) },
      { id: 'spider', legacyKey: 'spider_walk', builder: (f, p) => this.createSpiderSprite(f, p) },
      { id: 'golem', legacyKey: 'golem_walk', builder: (f, p) => this.createGolemSprite(f, p) },
      { id: 'minotaur', legacyKey: 'minotaur_walk', builder: (f, p) => this.createMinotaurSprite(f, p) },
      { id: 'gargoyle', legacyKey: 'gargoyle_fly', builder: (f, p) => this.createGargoyleSprite(f, p) },
      { id: 'slime', legacyKey: 'slime_squish', builder: (f, p) => this.createSlimeSprite(f, p) },
      { id: 'ghost', legacyKey: 'ghost_float', builder: (f, p) => this.createGhostSprite(f, p) }
    ];

    for (const mob of mobDefs) {
      const moveFrames = [0, 1, 2, 3, 4, 5].map((f) => mob.builder(f, 'move'));
      this.registerFrames(`${mob.id}_move`, moveFrames);
      this.registerFrames(mob.legacyKey, moveFrames);
      this.registerFrames(`${mob.id}_windup`, [0, 1, 2, 3].map((f) => mob.builder(f, 'windup')));
      this.registerFrames(`${mob.id}_strike`, [0, 1, 2, 3].map((f) => mob.builder(f, 'strike')));
    }

    // 3. Boss Sprites (128x128 4 Variants x 2 Phases x 3 Poses)
    for (let v = 0; v < 4; v++) {
      for (const phase of [1, 2] as const) {
        const moveFrames = [0, 1, 2, 3, 4, 5].map((f) => this.createDemonBossSprite(f, v, phase, 'move'));
        this.registerFrames(`boss_v${v}_p${phase}_move`, moveFrames);
        this.registerFrames(`boss_v${v}_p${phase}_windup`, [0, 1, 2, 3].map((f) => this.createDemonBossSprite(f, v, phase, 'windup')));
        this.registerFrames(`boss_v${v}_p${phase}_strike`, [0, 1, 2, 3].map((f) => this.createDemonBossSprite(f, v, phase, 'strike')));
      }
    }
    this.registerFrames('demon_boss', this.spriteSheets.get('boss_v0_p1_move')!);
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

  private makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    return [c, c.getContext('2d')!];
  }

  private getPoseParams(frame: number, pose: 'move' | 'windup' | 'strike'): {
    phase: number;
    bob: number;
    stride: number;
    lean: number;
    armRaise: number;
    lunge: number;
    glow: number;
  } {
    if (pose === 'windup') {
      const p = frame / 3;
      return {
        phase: p,
        bob: 2 * p,
        stride: -3,
        lean: -0.18 - p * 0.14,
        armRaise: -0.7 - p * 0.55,
        lunge: -3 - p * 3,
        glow: 0.65 + p * 0.35
      };
    }
    if (pose === 'strike') {
      const p = frame / 3;
      return {
        phase: p,
        bob: -2 * (1 - p),
        stride: 5,
        lean: 0.24 - p * 0.12,
        armRaise: 0.95 - p * 0.35,
        lunge: 6 - p * 3,
        glow: 1.0 - p * 0.3
      };
    }
    const ang = (frame / 6) * Math.PI * 2;
    return {
      phase: frame / 6,
      bob: Math.sin(ang * 2) * 2.2,
      stride: Math.sin(ang) * 5.5,
      lean: Math.sin(ang) * 0.06,
      armRaise: Math.sin(ang + 1.2) * 0.22,
      lunge: 0,
      glow: 0.4 + Math.sin(ang * 2) * 0.15
    };
  }

  // ============================================================================
  // 1. GHOUL / RISEN CRYPT SHROUD (64x64, 2.5D Gothic)
  // ============================================================================
  private createGhoulSprite(frame: number, pose: 'move' | 'windup' | 'strike' = 'move'): HTMLCanvasElement {
    const [c, ctx] = this.makeCanvas(64);
    const p = this.getPoseParams(frame, pose);

    ctx.save();
    ctx.translate(32 + p.lunge, 36 + p.bob);
    ctx.rotate(p.lean);

    // Tattered obsidian-indigo shroud
    const cloakGrad = ctx.createLinearGradient(-14, -18, 12, 22);
    cloakGrad.addColorStop(0, '#312e81');
    cloakGrad.addColorStop(0.55, '#1e1b4b');
    cloakGrad.addColorStop(1, '#090714');
    ctx.fillStyle = cloakGrad;
    ctx.beginPath();
    ctx.moveTo(-12, -14);
    ctx.lineTo(-16, 18);
    ctx.lineTo(-9, 14);
    ctx.lineTo(-4, 20);
    ctx.lineTo(2, 15);
    ctx.lineTo(8, 19);
    ctx.lineTo(13, 13);
    ctx.lineTo(10, -12);
    ctx.closePath();
    ctx.fill();

    // Bony legs with stride
    ctx.fillStyle = '#475569';
    ctx.fillRect(-7 - p.stride * 0.6, 11, 4.5, 11);
    ctx.fillRect(3 + p.stride * 0.6, 11, 4.5, 11);

    // Torso & exposed ribcage
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.roundRect(-9, -12, 18, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    for (let r = 0; r < 3; r++) {
      ctx.fillRect(-5, -8 + r * 4, 10, 1.8);
    }

    // Hunched pale-moss skull
    const skullGrad = ctx.createRadialGradient(2, -19, 1, 1, -17, 10);
    skullGrad.addColorStop(0, '#d9f99d');
    skullGrad.addColorStop(0.6, '#65a30d');
    skullGrad.addColorStop(1, '#365314');
    ctx.fillStyle = skullGrad;
    ctx.beginPath();
    ctx.arc(2, -17, 8.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye sockets + crimson glare
    ctx.fillStyle = '#07060c';
    ctx.beginPath();
    ctx.arc(0, -17, 2.2, 0, Math.PI * 2);
    ctx.arc(6, -17, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pose === 'windup' ? '#fef08a' : '#ef4444';
    ctx.fillRect(-0.5, -17.5, 1.8, 1.8);
    ctx.fillRect(5.5, -17.5, 1.8, 1.8);

    // Bloodied Cleaver Arm
    ctx.save();
    ctx.translate(8, -6);
    ctx.rotate(p.armRaise);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, -2, 9, 3.5);
    const bladeGrad = ctx.createLinearGradient(7, -10, 18, 6);
    bladeGrad.addColorStop(0, '#f1f5f9');
    bladeGrad.addColorStop(0.6, '#64748b');
    bladeGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(7, -9);
    ctx.lineTo(18, -6);
    ctx.lineTo(16, 6);
    ctx.lineTo(7, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return this.applyPixelOutline(c, '#06050b');
  }

  // ============================================================================
  // 2. CRIMSON DREADWING BAT (64x64, 2.5D Gothic)
  // ============================================================================
  private createBatSprite(frame: number, pose: 'move' | 'windup' | 'strike' = 'move'): HTMLCanvasElement {
    const [c, ctx] = this.makeCanvas(64);
    const p = this.getPoseParams(frame, pose);
    const wingBeat =
      pose === 'windup' ? -13 : pose === 'strike' ? 12 : Math.sin((frame / 6) * Math.PI * 2) * 12;

    ctx.save();
    ctx.translate(32 + p.lunge, 34 + p.bob * 0.7);
    ctx.rotate(p.lean);

    // Ribbed Leathery Wings (both sides)
    for (const side of [-1, 1]) {
      const wingGrad = ctx.createLinearGradient(0, -4, side * 26, wingBeat);
      wingGrad.addColorStop(0, '#581c87');
      wingGrad.addColorStop(0.6, '#3b0764');
      wingGrad.addColorStop(1, '#1e0536');
      ctx.fillStyle = wingGrad;
      ctx.beginPath();
      ctx.moveTo(side * 4, -2);
      ctx.lineTo(side * 26, -10 + wingBeat);
      ctx.lineTo(side * 22, 6 + wingBeat * 0.6);
      ctx.lineTo(side * 14, 3 + wingBeat * 0.3);
      ctx.lineTo(side * 5, 7);
      ctx.closePath();
      ctx.fill();

      // Crimson membrane highlight
      ctx.fillStyle = '#9f1239';
      ctx.beginPath();
      ctx.moveTo(side * 5, 0);
      ctx.lineTo(side * 20, -6 + wingBeat * 0.85);
      ctx.lineTo(side * 14, 4 + wingBeat * 0.4);
      ctx.closePath();
      ctx.fill();

      // Bone wing ridge
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(side * 4, -2);
      ctx.lineTo(side * 26, -10 + wingBeat);
      ctx.stroke();
    }

    // Furred torso & horned head
    const bodyGrad = ctx.createRadialGradient(-2, -3, 1, 0, 0, 11);
    bodyGrad.addColorStop(0, '#6d28d9');
    bodyGrad.addColorStop(0.7, '#2e1065');
    bodyGrad.addColorStop(1, '#0f0720');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 1, 7.5, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pointed Ears
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#3b0764';
      ctx.beginPath();
      ctx.moveTo(side * 3, -7);
      ctx.lineTo(side * 8, -16);
      ctx.lineTo(side * 7, -4);
      ctx.closePath();
      ctx.fill();
    }

    // Glowing amber eyes & fangs
    ctx.fillStyle = pose === 'strike' ? '#ffffff' : '#facc15';
    ctx.fillRect(-4, -3, 2.5, 2.5);
    ctx.fillRect(1.5, -3, 2.5, 2.5);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-2.5, 2, 1.5, 3);
    ctx.fillRect(1, 2, 1.5, 3);

    ctx.restore();
    return this.applyPixelOutline(c, '#06040a');
  }

  // ============================================================================
  // 3. ABYSSAL BROODLING SPIDER (64x64, 2.5D Gothic)
  // ============================================================================
  private createSpiderSprite(frame: number, pose: 'move' | 'windup' | 'strike' = 'move'): HTMLCanvasElement {
    const [c, ctx] = this.makeCanvas(64);
    const p = this.getPoseParams(frame, pose);
    const legWave = pose === 'windup' ? -4 : pose === 'strike' ? 5 : Math.sin((frame / 6) * Math.PI * 2) * 4;

    ctx.save();
    ctx.translate(32 + p.lunge, 34 + p.bob * 0.6);

    // 8 Articulated Chitinous Legs
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const yOff = -7 + i * 5;
      const s = (i % 2 === 0 ? 1 : -1) * legWave;
      for (const side of [-1, 1]) {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(side * 5, yOff);
        ctx.lineTo(side * 16, yOff - 6 + s * side);
        ctx.lineTo(side * 23, yOff + 4 + s * side);
        ctx.stroke();

        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(side * 6, yOff - 1);
        ctx.lineTo(side * 16, yOff - 6 + s * side);
        ctx.stroke();
      }
    }

    // Glossy Obsidian Abdomen with Crimson Hourglass
    const abdGrad = ctx.createRadialGradient(-3, -7, 2, 0, -4, 13);
    abdGrad.addColorStop(0, '#334155');
    abdGrad.addColorStop(0.5, '#0f172a');
    abdGrad.addColorStop(1, '#02040a');
    ctx.fillStyle = abdGrad;
    ctx.beginPath();
    ctx.ellipse(0, -4, 11, 12.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-3, -9);
    ctx.lineTo(3, -9);
    ctx.lineTo(0, -4);
    ctx.lineTo(3, 1);
    ctx.lineTo(-3, 1);
    ctx.lineTo(0, -4);
    ctx.closePath();
    ctx.fill();

    // Cephalothorax & Venom Fangs
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(0, 9, 7.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f87171';
    ctx.fillRect(-3.5, 9, 2, 2);
    ctx.fillRect(1.5, 9, 2, 2);
    ctx.fillRect(-1, 11, 2, 1.5);

    const fangSpread = pose === 'strike' ? 2 : 0;
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(-4 - fangSpread, 13);
    ctx.lineTo(-2 - fangSpread, 20);
    ctx.lineTo(-1 - fangSpread, 14);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4 + fangSpread, 13);
    ctx.lineTo(2 + fangSpread, 20);
    ctx.lineTo(1 + fangSpread, 14);
    ctx.fill();

    ctx.restore();
    return this.applyPixelOutline(c, '#040408');
  }

  // ============================================================================
  // 4. OBSIDIAN SANCTUARY COLOSSUS GOLEM (64x64, 2.5D Gothic)
  // ============================================================================
  private createGolemSprite(frame: number, pose: 'move' | 'windup' | 'strike' = 'move'): HTMLCanvasElement {
    const [c, ctx] = this.makeCanvas(64);
    const p = this.getPoseParams(frame, pose);

    ctx.save();
    ctx.translate(32 + p.lunge * 0.7, 35 + p.bob * 0.8);
    ctx.rotate(p.lean * 0.7);

    // Heavy Iron Greaves
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-13, 12 - Math.max(0, p.stride * 0.5), 9, 12);
    ctx.fillRect(4, 12 - Math.max(0, -p.stride * 0.5), 9, 12);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-12, 13 - Math.max(0, p.stride * 0.5), 5, 4);
    ctx.fillRect(5, 13 - Math.max(0, -p.stride * 0.5), 5, 4);

    // Sculpted Obsidian Plate Torso
    const armorGrad = ctx.createLinearGradient(-16, -16, 16, 14);
    armorGrad.addColorStop(0, '#475569');
    armorGrad.addColorStop(0.45, '#1e293b');
    armorGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = armorGrad;
    ctx.beginPath();
    ctx.roundRect(-16, -14, 32, 27, 5);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Recessed Gothic Arch Furnace Core
    const coreGrad = ctx.createRadialGradient(0, -1, 1, 0, -1, 8);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.45, pose === 'windup' ? '#fef08a' : '#f97316');
    coreGrad.addColorStop(1, '#7c2d12');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.roundRect(-7, -7, 14, 11, 3);
    ctx.fill();
    ctx.fillStyle = '#090d16';
    ctx.fillRect(-3, -7, 2, 11);
    ctx.fillRect(1, -7, 2, 11);

    // Spiked Brass-Trimmed Pauldrons
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(side < 0 ? -24 : 13, -16, 11, 14, 3);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(side * 18, -16);
      ctx.lineTo(side * 20, -23);
      ctx.lineTo(side * 15, -16);
      ctx.fill();
    }

    // Juggernaut Helm & Visor
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-8, -24, 16, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-5, -19, 10, 2.5);

    // Runed Warhammer
    ctx.save();
    ctx.translate(18, -4);
    ctx.rotate(p.armRaise);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-1.5, -14, 3, 28);
    const hamGrad = ctx.createLinearGradient(-7, -18, 7, -10);
    hamGrad.addColorStop(0, '#cbd5e1');
    hamGrad.addColorStop(1, '#475569');
    ctx.fillStyle = hamGrad;
    ctx.beginPath();
    ctx.roundRect(-7, -18, 14, 9, 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return this.applyPixelOutline(c, '#05050a');
  }

  // ============================================================================
  // 5. HELLFORGED MINOTAUR EXECUTIONER (64x64, 2.5D Gothic)
  // ============================================================================
  private createMinotaurSprite(frame: number, pose: 'move' | 'windup' | 'strike' = 'move'): HTMLCanvasElement {
    const [c, ctx] = this.makeCanvas(64);
    const p = this.getPoseParams(frame, pose);

    ctx.save();
    ctx.translate(32 + p.lunge, 36 + p.bob);
    ctx.rotate(p.lean);

    // Muscular Legs & Fiery Cloven Hooves
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-12 - p.stride * 0.4, 10, 8, 12);
    ctx.fillRect(4 + p.stride * 0.4, 10, 8, 12);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-12 - p.stride * 0.4, 19, 8, 4);
    ctx.fillRect(4 + p.stride * 0.4, 19, 8, 4);

    // Crimson-Brown Beast Torso & Iron Belt
    const torsoGrad = ctx.createLinearGradient(-14, -14, 14, 12);
    torsoGrad.addColorStop(0, '#9a3412');
    torsoGrad.addColorStop(0.5, '#78350f');
    torsoGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = torsoGrad;
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 25, 5);
    ctx.fill();

    // Brass Skull Buckle
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-14, 6, 28, 4);
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(0, 8, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bull Head & Swept Ivory Horns
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.roundRect(-10, -24, 20, 14, 4);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-7, -21, 14, 10);

    for (const side of [-1, 1]) {
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(side * 9, -20);
      ctx.quadraticCurveTo(side * 22, -28, side * 19, -31);
      ctx.quadraticCurveTo(side * 16, -20, side * 9, -15);
      ctx.closePath();
      ctx.fill();
    }

    // Glowing Rage Eyes & Gold Nose Ring
    ctx.fillStyle = pose === 'windup' ? '#fef08a' : '#ef4444';
    ctx.fillRect(-5, -18, 3, 2.5);
    ctx.fillRect(2, -18, 3, 2.5);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -11, 3.5, 0, Math.PI * 2);
    ctx.stroke();

    // Double-Bitted Executioner Battleaxe
    ctx.save();
    ctx.translate(15, -4);
    ctx.rotate(p.armRaise);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-1.5, -18, 3, 32);
    const axeGrad = ctx.createLinearGradient(0, -18, 13, -4);
    axeGrad.addColorStop(0, '#e2e8f0');
    axeGrad.addColorStop(0.6, '#64748b');
    axeGrad.addColorStop(1, '#dc2626');
    ctx.fillStyle = axeGrad;
    ctx.beginPath();
    ctx.moveTo(1, -12);
    ctx.lineTo(13, -20);
    ctx.quadraticCurveTo(15, -11, 13, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return this.applyPixelOutline(c, '#07050a');
  }

  // ============================================================================
  // 6. CATHEDRAL ARCANE GARGOYLE (64x64, 2.5D Gothic)
  // ============================================================================
  private createGargoyleSprite(frame: number, pose: 'move' | 'windup' | 'strike' = 'move'): HTMLCanvasElement {
    const [c, ctx] = this.makeCanvas(64);
    const p = this.getPoseParams(frame, pose);
    const wingY = pose === 'windup' ? -10 : pose === 'strike' ? 9 : Math.sin((frame / 6) * Math.PI * 2) * 8;

    ctx.save();
    ctx.translate(32 + p.lunge * 0.6, 34 + p.bob);
    ctx.rotate(p.lean);

    // Sculpted Stone/Violet Wings
    for (const side of [-1, 1]) {
      const wGrad = ctx.createLinearGradient(0, -4, side * 24, wingY);
      wGrad.addColorStop(0, '#6b21a8');
      wGrad.addColorStop(1, '#2e1065');
      ctx.fillStyle = wGrad;
      ctx.beginPath();
      ctx.moveTo(side * 6, -4);
      ctx.lineTo(side * 25, -13 + wingY);
      ctx.lineTo(side * 21, 5 + wingY * 0.6);
      ctx.lineTo(side * 8, 6);
      ctx.closePath();
      ctx.fill();
    }

    // Stone-Violet Torso & Talons
    const stoneGrad = ctx.createLinearGradient(-10, -14, 10, 14);
    stoneGrad.addColorStop(0, '#9333ea');
    stoneGrad.addColorStop(0.5, '#581c87');
    stoneGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = stoneGrad;
    ctx.beginPath();
    ctx.roundRect(-10, -14, 20, 24, 5);
    ctx.fill();

    // Swept Stone Horns & Glowing Eyes
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(-6, -13);
    ctx.lineTo(-12, -23);
    ctx.lineTo(-3, -15);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -13);
    ctx.lineTo(12, -23);
    ctx.lineTo(3, -15);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(-5, -10, 3, 2.5);
    ctx.fillRect(2, -10, 3, 2.5);

    // Pulsing Arcane Spell Orb Held in Claws
    const orbR = pose === 'windup' ? 7 : pose === 'strike' ? 8 : 5.5;
    const orbGrad = ctx.createRadialGradient(0, 6, 1, 0, 6, orbR);
    orbGrad.addColorStop(0, '#ffffff');
    orbGrad.addColorStop(0.5, '#c084fc');
    orbGrad.addColorStop(1, '#6b21a8');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(0, 6, orbR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return this.applyPixelOutline(c, '#06040c');
  }

  // ============================================================================
  // 7. ALCHEMICAL BLOOD-ACID SLIME (64x64, 2.5D Gothic)
  // ============================================================================
  private createSlimeSprite(frame: number, pose: 'move' | 'windup' | 'strike' = 'move'): HTMLCanvasElement {
    const [c, ctx] = this.makeCanvas(64);
    const sx = pose === 'windup' ? 5 : pose === 'strike' ? -4 : Math.sin((frame / 6) * Math.PI * 2) * 4;
    const sy = -sx * 0.85;

    ctx.save();
    ctx.translate(32, 38);

    // Outer Translucent Emerald Mass
    const outerGrad = ctx.createRadialGradient(-4, -8 - sy * 0.5, 3, 0, -2, 22);
    outerGrad.addColorStop(0, '#34d399');
    outerGrad.addColorStop(0.55, '#059669');
    outerGrad.addColorStop(1, '#022c22');
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.ellipse(0, -sy * 0.4, 20 + sx, 16 + sy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Suspended Skull Core Inside Gel
    ctx.fillStyle = '#d1fae5';
    ctx.beginPath();
    ctx.arc(0, -3 - sy * 0.4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(-3.5, -4 - sy * 0.4, 2.2, 2.5);
    ctx.fillRect(1.3, -4 - sy * 0.4, 2.2, 2.5);

    // Wet Glass Specular Crescent
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(-4, -3 - sy * 0.4, 12, Math.PI * 1.08, Math.PI * 1.48);
    ctx.stroke();

    ctx.restore();
    return this.applyPixelOutline(c, '#032218');
  }

  // ============================================================================
  // 8. WAILING SPECTRAL WRAITH (64x64, 2.5D Gothic)
  // ============================================================================
  private createGhostSprite(frame: number, pose: 'move' | 'windup' | 'strike' = 'move'): HTMLCanvasElement {
    const [c, ctx] = this.makeCanvas(64);
    const p = this.getPoseParams(frame, pose);
    const wave = Math.sin((frame / 6) * Math.PI * 2) * 3;

    ctx.save();
    ctx.translate(32 + p.lunge, 34 + p.bob);
    ctx.rotate(p.lean);

    // Ectoplasmic Shroud & Wispy Tails
    const cowlGrad = ctx.createLinearGradient(0, -20, 0, 22);
    cowlGrad.addColorStop(0, '#67e8f9');
    cowlGrad.addColorStop(0.5, '#0891b2');
    cowlGrad.addColorStop(1, '#083344');
    ctx.fillStyle = cowlGrad;
    ctx.beginPath();
    ctx.arc(0, -8, 13, Math.PI, 0);
    ctx.lineTo(14 + wave, 18);
    ctx.lineTo(7, 13);
    ctx.lineTo(0 - wave, 22);
    ctx.lineTo(-7, 13);
    ctx.lineTo(-14 + wave, 18);
    ctx.closePath();
    ctx.fill();

    // Deep Void Face Inside Hood
    ctx.fillStyle = '#04121c';
    ctx.beginPath();
    ctx.ellipse(0, -7, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Soul-Fire Eyes
    ctx.fillStyle = pose === 'windup' ? '#ffffff' : '#fef08a';
    ctx.fillRect(-4.5, -9, 3, 2.5);
    ctx.fillRect(1.5, -9, 3, 2.5);

    // Ethereal Brass Soul Lantern
    ctx.save();
    ctx.translate(14, 2);
    ctx.rotate(p.armRaise * 0.6);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-4, -5, 8, 10);
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(-2.5, -3, 5, 6);
    ctx.restore();

    ctx.restore();
    return this.applyPixelOutline(c, '#041e2b');
  }

  // ============================================================================
  // 9. 4-VARIANT x 2-PHASE x 3-POSE DARK GOTHIC BOSSES (128x128)
  // 0: Crimson Fallen Grand Knight | 1: Frost Archlich
  // 2: Venom Brood Empress         | 3: Infernal Solar Balrog
  // ============================================================================
  private createDemonBossSprite(
    frame: number,
    variant = 0,
    phase: 1 | 2 = 1,
    pose: 'move' | 'windup' | 'strike' = 'move'
  ): HTMLCanvasElement {
    const [c, ctx] = this.makeCanvas(128);
    const p = this.getPoseParams(frame, pose);
    const isP2 = phase === 2;
    const wingBeat =
      pose === 'windup' ? -18 : pose === 'strike' ? 16 : Math.sin((frame / 6) * Math.PI * 2) * 14;

    ctx.save();
    ctx.translate(64 + p.lunge * 1.4, 70 + p.bob * 1.4);
    ctx.rotate(p.lean * 0.85);

    if (variant === 0) {
      // --- VARIANT 0: CRIMSON FALLEN GRAND KNIGHT (P2: 4-Winged Blood Seraph) ---
      const wingSets = isP2 ? [1, 0.65] : [0.8];
      for (let wIdx = 0; wIdx < wingSets.length; wIdx++) {
        const sc = wingSets[wIdx];
        const yOff = wIdx === 0 ? -12 : 4;
        for (const side of [-1, 1]) {
          const wGrad = ctx.createLinearGradient(0, yOff, side * 52 * sc, yOff + wingBeat);
          wGrad.addColorStop(0, isP2 ? '#dc2626' : '#7f1d1d');
          wGrad.addColorStop(0.65, '#450a0a');
          wGrad.addColorStop(1, '#180408');
          ctx.fillStyle = wGrad;
          ctx.beginPath();
          ctx.moveTo(side * 10, yOff);
          ctx.lineTo(side * 54 * sc, yOff - 24 + wingBeat * (wIdx === 0 ? 1 : -0.6));
          ctx.lineTo(side * 46 * sc, yOff + 14 + wingBeat * 0.4);
          ctx.lineTo(side * 24 * sc, yOff + 8);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = isP2 ? '#fbbf24' : '#b45309';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }

      // Flowing Tattered Royal Cape
      ctx.fillStyle = '#450a0a';
      ctx.beginPath();
      ctx.moveTo(-18, -14);
      ctx.lineTo(-28, 40);
      ctx.lineTo(-10, 34);
      ctx.lineTo(0, 44);
      ctx.lineTo(10, 34);
      ctx.lineTo(28, 40);
      ctx.lineTo(18, -14);
      ctx.closePath();
      ctx.fill();

      // Armored Greaves
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-15 - p.stride * 0.5, 22, 11, 22);
      ctx.fillRect(4 + p.stride * 0.5, 22, 11, 22);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-15 - p.stride * 0.5, 39, 11, 4);
      ctx.fillRect(4 + p.stride * 0.5, 39, 11, 4);

      // Obsidian & Gold Plate Torso
      const plateGrad = ctx.createLinearGradient(-20, -22, 20, 24);
      plateGrad.addColorStop(0, '#334155');
      plateGrad.addColorStop(0.5, '#1e293b');
      plateGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = plateGrad;
      ctx.beginPath();
      ctx.roundRect(-20, -20, 40, 44, 6);
      ctx.fill();
      ctx.strokeStyle = isP2 ? '#fef08a' : '#d97706';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glowing Blood-Core Fissure
      ctx.fillStyle = isP2 ? '#fef08a' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(8, 2);
      ctx.lineTo(0, 14);
      ctx.lineTo(-8, 2);
      ctx.closePath();
      ctx.fill();

      // Spiked Pauldrons & Horned Dread Helm
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.roundRect(side < 0 ? -31 : 17, -23, 14, 17, 4);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-12, -40, 24, 21, 5);
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(side * 10, -35);
        ctx.lineTo(side * 26, -54);
        ctx.lineTo(side * 13, -25);
        ctx.fill();
      }
      if (isP2) {
        // Shattered Golden Seraph Halo
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, -36, 17, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      ctx.fillStyle = isP2 ? '#fef08a' : '#ef4444';
      ctx.fillRect(-7, -31, 5, 3);
      ctx.fillRect(2, -31, 5, 3);

      // Runed Blood-Greatsword
      ctx.save();
      ctx.translate(25, -4);
      ctx.rotate(p.armRaise);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-9, -2, 18, 4);
      const swGrad = ctx.createLinearGradient(-4, -46, 4, 0);
      swGrad.addColorStop(0, isP2 ? '#ffffff' : '#fca5a5');
      swGrad.addColorStop(0.5, '#ef4444');
      swGrad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = swGrad;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(-5, -40);
      ctx.lineTo(0, -50);
      ctx.lineTo(5, -40);
      ctx.lineTo(4, -2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (variant === 1) {
      // --- VARIANT 1: FROST ARCHLICH (P2: Abyssal Blizzard Ascendant) ---
      if (isP2) {
        for (const side of [-1, 1]) {
          const iceWing = ctx.createLinearGradient(0, -10, side * 52, wingBeat);
          iceWing.addColorStop(0, '#38bdf8');
          iceWing.addColorStop(0.6, '#1e3a8a');
          iceWing.addColorStop(1, '#090d16');
          ctx.fillStyle = iceWing;
          ctx.beginPath();
          ctx.moveTo(side * 10, -12);
          ctx.lineTo(side * 54, -28 + wingBeat);
          ctx.lineTo(side * 42, 16 + wingBeat * 0.5);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Floating Tattered Midnight Funerary Vestments
      const robeGrad = ctx.createLinearGradient(0, -24, 0, 48);
      robeGrad.addColorStop(0, '#312e81');
      robeGrad.addColorStop(0.55, '#1e1b4b');
      robeGrad.addColorStop(1, '#04060e');
      ctx.fillStyle = robeGrad;
      ctx.beginPath();
      ctx.moveTo(-18, -20);
      ctx.lineTo(-27, 42);
      ctx.lineTo(-12, 34);
      ctx.lineTo(0, 48);
      ctx.lineTo(12, 34);
      ctx.lineTo(27, 42);
      ctx.lineTo(18, -20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = isP2 ? '#7dd3fc' : '#818cf8';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Skeletal Ribcage & Glacial Phylactery Core
      ctx.fillStyle = '#cbd5e1';
      for (let r = 0; r < 4; r++) {
        ctx.fillRect(-10, -12 + r * 6, 20, 2.5);
      }
      ctx.fillStyle = isP2 ? '#ffffff' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -2, 6, 0, Math.PI * 2);
      ctx.fill();

      // Horned Bone-Crown Skull
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(0, -30, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#090d16';
      ctx.fillRect(-6, -32, 4, 4);
      ctx.fillRect(2, -32, 4, 4);
      ctx.fillStyle = isP2 ? '#ffffff' : '#38bdf8';
      ctx.fillRect(-5, -31, 2.5, 2.5);
      ctx.fillRect(3, -31, 2.5, 2.5);

      // Ice Crown Spires
      ctx.fillStyle = isP2 ? '#7dd3fc' : '#c084fc';
      for (const ox of [-10, 0, 10]) {
        ctx.beginPath();
        ctx.moveTo(ox - 3, -39);
        ctx.lineTo(ox, -54 - (ox === 0 ? 5 : 0));
        ctx.lineTo(ox + 3, -39);
        ctx.closePath();
        ctx.fill();
      }

      // Glacial Phylactery Staff
      ctx.save();
      ctx.translate(24, 0);
      ctx.rotate(p.armRaise * 0.7);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-2, -32, 4, 62);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.lineTo(9, -36);
      ctx.lineTo(0, -26);
      ctx.lineTo(-9, -36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (variant === 2) {
      // --- VARIANT 2: VENOM BROOD EMPRESS (P2: 6-Scythe Spore-Winged Queen) ---
      if (isP2) {
        for (const side of [-1, 1]) {
          const spWing = ctx.createLinearGradient(0, -14, side * 52, wingBeat);
          spWing.addColorStop(0, 'rgba(52, 211, 153, 0.85)');
          spWing.addColorStop(1, 'rgba(6, 78, 59, 0.9)');
          ctx.fillStyle = spWing;
          ctx.beginPath();
          ctx.moveTo(side * 8, -16);
          ctx.lineTo(side * 52, -30 + wingBeat);
          ctx.lineTo(side * 40, 10 + wingBeat * 0.4);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Articulated Arachnid Scythe-Legs (2 pairs in P1, 3 pairs in P2)
      const legCount = isP2 ? 3 : 2;
      for (let i = 0; i < legCount; i++) {
        const yB = -4 + i * 11;
        const s = (i % 2 === 0 ? 1 : -1) * p.stride * 0.9;
        for (const side of [-1, 1]) {
          ctx.strokeStyle = '#064e3b';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(side * 12, yB);
          ctx.lineTo(side * 34, yB - 12 + s);
          ctx.lineTo(side * 44, yB + 16 + s);
          ctx.stroke();
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Bioluminescent Emerald Abdomen & Obsidian Corset
      const sacGrad = ctx.createRadialGradient(-4, 16, 3, 0, 18, 22);
      sacGrad.addColorStop(0, '#a3e635');
      sacGrad.addColorStop(0.5, '#059669');
      sacGrad.addColorStop(1, '#022c22');
      ctx.fillStyle = sacGrad;
      ctx.beginPath();
      ctx.ellipse(0, 18, 19, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-14, -20, 28, 28, 6);
      ctx.fill();
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Venom Crowned Empress Visage & Mantis Scythes
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.arc(0, -30, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isP2 ? '#fef08a' : '#a3e635';
      ctx.fillRect(-5, -32, 3, 3);
      ctx.fillRect(2, -32, 3, 3);
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#a3e635';
        ctx.beginPath();
        ctx.moveTo(side * 6, -38);
        ctx.lineTo(side * 18, -50);
        ctx.lineTo(side * 10, -34);
        ctx.fill();
      }

      // Dual Venom Scythe Claws
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * 16, -12);
        ctx.rotate(side * (0.2 + p.armRaise * 0.6));
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(side * 22, -20, side * 14, 16);
        ctx.lineTo(side * 6, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else {
      // --- VARIANT 3: INFERNAL BALROG PYRELORD (P2: Cataclysmic Solar Fiend) ---
      for (const side of [-1, 1]) {
        const dWing = ctx.createLinearGradient(0, -14, side * 56, wingBeat);
        dWing.addColorStop(0, isP2 ? '#fbbf24' : '#991b1b');
        dWing.addColorStop(0.6, '#450a0a');
        dWing.addColorStop(1, '#120305');
        ctx.fillStyle = dWing;
        ctx.beginPath();
        ctx.moveTo(side * 12, -16);
        ctx.lineTo(side * 56, -30 + wingBeat);
        ctx.lineTo(side * 50, 14 + wingBeat * 0.5);
        ctx.lineTo(side * 24, 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = isP2 ? '#fef08a' : '#f97316';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // Armored Demon Legs
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-16 - p.stride * 0.4, 22, 12, 22);
      ctx.fillRect(4 + p.stride * 0.4, 22, 12, 22);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-16 - p.stride * 0.4, 39, 12, 5);
      ctx.fillRect(4 + p.stride * 0.4, 39, 12, 5);

      // Volcanic Basalt & Magma Torso
      const magGrad = ctx.createLinearGradient(-22, -22, 22, 24);
      magGrad.addColorStop(0, isP2 ? '#f97316' : '#7f1d1d');
      magGrad.addColorStop(0.5, '#450a0a');
      magGrad.addColorStop(1, '#180507');
      ctx.fillStyle = magGrad;
      ctx.beginPath();
      ctx.roundRect(-22, -22, 44, 46, 7);
      ctx.fill();

      // Glowing Magma Fissures
      ctx.fillStyle = isP2 ? '#ffffff' : '#fbbf24';
      ctx.fillRect(-10, -12, 20, 4);
      ctx.fillRect(-7, -2, 14, 4);
      ctx.fillRect(-4, 8, 8, 6);

      // Swept Obsidian Horns & Blazing Head
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.roundRect(-13, -40, 26, 20, 5);
      ctx.fill();
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(side * 11, -34);
        ctx.quadraticCurveTo(side * 32, -48, side * 26, -56);
        ctx.quadraticCurveTo(side * 20, -36, side * 12, -25);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-7, -32, 5, 3.5);
      ctx.fillRect(2, -32, 5, 3.5);

      // Molten Cleaver (Dual-Wield in P2)
      const bladeSides = isP2 ? [-1, 1] : [1];
      for (const side of bladeSides) {
        ctx.save();
        ctx.translate(side * 25, -6);
        ctx.rotate(side * p.armRaise);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-7, -2, 14, 4);
        ctx.fillStyle = isP2 ? '#fef08a' : '#ef4444';
        ctx.fillRect(-3.5, -42, 7, 40);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1.5, -38, 3, 32);
        ctx.restore();
      }
    }

    ctx.restore();
    return this.applyPixelOutline(c, '#050205');
  }
}
