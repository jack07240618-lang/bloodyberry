import { GameLoop } from './core/GameLoop';
import { InputController } from './core/Input';
import { Camera } from './core/Camera';
import { SoundSynthesizer } from './core/SoundSynthesizer';
import { Player } from './entities/Player';
import { CombatSystem } from './systems/CombatSystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { DamageTextSystem } from './systems/DamageTextSystem';
import { MapSystem } from './systems/MapSystem';
import { SpawnDirector } from './systems/SpawnDirector';
import { SaveManager } from './persistence/SaveManager';
import { CHARACTERS, CharacterInfo } from './persistence/CharacterSelect';
import { UIManager, UpgradeOption } from './ui/UIManager';
import { ALL_WEAPON_DEFINITIONS } from './weapons/WeaponRegistry';
import { PASSIVE_DEFINITIONS } from './passives/PassiveRegistry';
import { WebGLPostProcessor } from './renderer/WebGLPostProcessor';
import { AmbientParticleSystem } from './systems/AmbientParticleSystem';

enum GameState {
  CHARACTER_SELECT = 'CHARACTER_SELECT',
  PLAYING = 'PLAYING',
  LEVEL_UP = 'LEVEL_UP',
  CHEST_REWARD = 'CHEST_REWARD',
  GAME_OVER = 'GAME_OVER',
  PAUSED = 'PAUSED'
}

class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: InputController;
  private camera: Camera;
  private sound: SoundSynthesizer;
  private saveManager: SaveManager;
  private uiManager: UIManager;

  // Systems
  private particleSystem: ParticleSystem;
  private damageTextSystem: DamageTextSystem;
  private mapSystem: MapSystem;
  private combatSystem: CombatSystem;
  private spawnDirector: SpawnDirector;
  private gameLoop: GameLoop;
  private postProcessor: WebGLPostProcessor;
  private ambientParticles: AmbientParticleSystem;

  // State
  private state: GameState = GameState.CHARACTER_SELECT;
  private selectedCharacter: CharacterInfo = CHARACTERS[0];
  private player: Player;
  private levelUpOptions: UpgradeOption[] = [];
  private selectedUpgradeIdx = 0;
  private chestReward: UpgradeOption | null = null;
  private hitStopTimer = 0;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('2D context unsupported');
    this.ctx = context;

    this.input = new InputController(this.canvas);
    this.camera = new Camera(window.innerWidth, window.innerHeight);
    this.sound = new SoundSynthesizer();
    this.saveManager = new SaveManager();
    this.uiManager = new UIManager(this.saveManager, this.sound);

    this.particleSystem = new ParticleSystem();
    this.damageTextSystem = new DamageTextSystem();
    this.mapSystem = new MapSystem();
    this.combatSystem = new CombatSystem(
      this.particleSystem,
      this.damageTextSystem,
      this.mapSystem,
      this.sound,
      this.camera
    );
    this.spawnDirector = new SpawnDirector(this.combatSystem);
    this.ambientParticles = new AmbientParticleSystem();
    this.postProcessor = new WebGLPostProcessor(window.innerWidth, window.innerHeight);

    const container = document.getElementById('game-container');
    if (container && this.postProcessor.enabled) {
      container.appendChild(this.postProcessor.glCanvas);
    }

    this.player = new Player(0, 0);

    this.setupResizeHandler();
    this.setupMouseEvents();

    this.gameLoop = new GameLoop(
      (dt) => this.update(dt),
      (alpha) => this.render(alpha)
    );
    this.gameLoop.start();
  }

  private setupResizeHandler(): void {
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;

      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;

      this.camera.resize(w, h);
      this.postProcessor.resize(w, h);
    };

    window.addEventListener('resize', resize);
    resize();
  }

  private setupMouseEvents(): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.state === GameState.LEVEL_UP) {
        this.updateLevelUpHover(mx, my);
      } else if (this.state === GameState.CHARACTER_SELECT) {
        this.updateCharSelectHover(mx, my);
      } else if (this.state === GameState.GAME_OVER) {
        this.updateGameOverHover(mx, my);
      } else if (this.state === GameState.CHEST_REWARD) {
        this.updateChestHover(mx, my);
      } else if (this.state === GameState.PLAYING) {
        this.updateHUDHover(mx, my);
      }
    });

    this.canvas.addEventListener('click', (e) => {
      this.sound.unlock();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.state === GameState.CHARACTER_SELECT) {
        this.handleCharSelectClick(mx, my);
      } else if (this.state === GameState.LEVEL_UP) {
        this.handleLevelUpClick(mx, my);
      } else if (this.state === GameState.CHEST_REWARD) {
        this.handleChestClick(mx, my);
      } else if (this.state === GameState.GAME_OVER) {
        this.handleGameOverClick(mx, my);
      } else if (this.state === GameState.PLAYING) {
        this.handleHUDClick(mx, my);
      }
    });
  }

  // --- Start / Reset Game Session ---
  private startNewGame(charInfo: CharacterInfo): void {
    this.selectedCharacter = charInfo;
    this.player = new Player(0, 0);

    // Apply starting character traits
    charInfo.applyTraits(this.player);

    // Add starting weapon
    const weaponDef = ALL_WEAPON_DEFINITIONS[charInfo.startingWeapon];
    if (weaponDef) {
      this.player.addWeapon(weaponDef.create());
    }

    // Reset systems
    this.particleSystem = new ParticleSystem();
    this.damageTextSystem = new DamageTextSystem();
    this.mapSystem = new MapSystem();
    this.combatSystem = new CombatSystem(
      this.particleSystem,
      this.damageTextSystem,
      this.mapSystem,
      this.sound,
      this.camera
    );
    this.spawnDirector = new SpawnDirector(this.combatSystem);

    this.camera.position.set(0, 0);
    this.sound.playBGM('BATTLE');
    this.state = GameState.PLAYING;
  }

  // --- Main Update ---
  private update(dt: number): void {
    switch (this.state) {
      case GameState.CHARACTER_SELECT:
        if (this.input.wasKeyPressed('Enter') || this.input.wasKeyPressed('Space')) {
          this.sound.unlock();
          this.startNewGame(this.selectedCharacter);
        }
        break;

      case GameState.PLAYING:
        this.updatePlaying(dt);
        break;

      case GameState.LEVEL_UP:
        this.updateLevelUpInput();
        break;

      case GameState.CHEST_REWARD:
        this.uiManager.chestOpenProgress += dt;
        if (this.input.wasKeyPressed('Space') || this.input.wasKeyPressed('Enter')) {
          this.claimChestReward();
        }
        break;

      case GameState.GAME_OVER:
        if (this.input.wasKeyPressed('Enter') || this.input.wasKeyPressed('Space')) {
          this.sound.playBGM('TITLE');
          this.state = GameState.CHARACTER_SELECT;
        }
        break;

      case GameState.PAUSED:
        if (this.input.wasKeyPressed('Escape') || this.input.wasKeyPressed('KeyP')) {
          this.state = GameState.PLAYING;
        }
        break;
    }

    this.input.endFrame();
  }

  private updatePlaying(dt: number): void {
    if (this.input.wasKeyPressed('Escape') || this.input.wasKeyPressed('KeyP')) {
      this.state = GameState.PAUSED;
      return;
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    // Movement direction from input
    this.player.moveDirection = this.input.getMovementVector();
    this.player.update(dt);

    if (this.player.isMoving) {
      this.ambientParticles.recordTrailPoint(this.player.id, this.player.position, 12);
    }

    if (this.player.isDead) {
      this.state = GameState.GAME_OVER;
      this.sound.stopBGM();
      this.sound.playGameOver();
      this.saveManager.recordRun(this.player.timeSurvived, this.player.kills, this.player.gold);
      return;
    }

    // Dynamic Boss BGM switch
    const hasBoss = this.combatSystem.enemies.some(e => e.isBoss && e.active);
    if (hasBoss) {
      this.sound.playBGM('BOSS');
    } else {
      this.sound.playBGM('BATTLE');
    }

    // Camera follow player with smooth interpolation
    this.camera.follow(this.player.position, 0.12);
    this.camera.update(dt);

    // Map & Destructibles
    this.mapSystem.update(this.player.position, dt);

    // Spawn director
    this.spawnDirector.update(dt, this.player);

    // Combat system
    this.combatSystem.update(
      dt,
      this.player,
      () => this.triggerLevelUp(),
      () => this.triggerBossChest(),
      (dur) => { this.hitStopTimer = dur; }
    );

    // Particle & Damage Text Systems
    this.particleSystem.update(dt);
    this.damageTextSystem.update(dt);
    this.ambientParticles.update(dt, this.player.position);
    this.postProcessor.update(dt);
  }

  // --- Level Up Logic ---
  private triggerLevelUp(): void {
    this.levelUpOptions = this.generateUpgradeOptions();
    this.selectedUpgradeIdx = 0;
    this.state = GameState.LEVEL_UP;
  }

  private generateUpgradeOptions(): UpgradeOption[] {
    const pool: UpgradeOption[] = [];

    // 1. Existing weapon upgrades
    for (const w of this.player.weapons) {
      if (this.player.banishedItemIds.has(w.id)) continue;
      if (w.level < w.maxLevel) {
        pool.push({
          type: 'WEAPON',
          id: w.id,
          name: w.name,
          levelText: `LV ${w.level + 1}`,
          description: w.getUpgradeDescription(w.level + 1),
          iconName: w.iconName
        });
      }
    }

    // 2. New weapons (if slots available)
    if (this.player.weapons.length < this.player.maxWeaponSlots) {
      for (const [id, def] of Object.entries(ALL_WEAPON_DEFINITIONS)) {
        if (this.player.banishedItemIds.has(id)) continue;
        if (!this.player.getWeapon(id)) {
          pool.push({
            type: 'WEAPON',
            id,
            name: def.name,
            levelText: 'NEW!',
            description: def.description,
            iconName: id
          });
        }
      }
    }

    // 3. Existing passives upgrades
    for (const [id, lvl] of this.player.passives.entries()) {
      if (this.player.banishedItemIds.has(id)) continue;
      const def = PASSIVE_DEFINITIONS[id];
      if (def && lvl < def.maxLevel) {
        pool.push({
          type: 'PASSIVE',
          id,
          name: def.name,
          levelText: `LV ${lvl + 1}`,
          description: def.perLevelDescription[lvl] || def.description,
          iconName: id
        });
      }
    }

    // 4. New passives (if slots available)
    if (this.player.passives.size < this.player.maxPassiveSlots) {
      for (const [id, def] of Object.entries(PASSIVE_DEFINITIONS)) {
        if (this.player.banishedItemIds.has(id)) continue;
        if (!this.player.hasPassive(id)) {
          pool.push({
            type: 'PASSIVE',
            id,
            name: def.name,
            levelText: 'NEW!',
            description: def.perLevelDescription[0] || def.description,
            iconName: id
          });
        }
      }
    }

    // Fallback if everything maxed
    if (pool.length === 0) {
      return [
        {
          type: 'PASSIVE',
          id: 'roast_chicken',
          name: 'Floor Chicken',
          levelText: 'HEAL',
          description: 'Restores 40 Health immediately.',
          iconName: 'pummarola'
        },
        {
          type: 'PASSIVE',
          id: 'coin_bag',
          name: 'Treasure Bag',
          levelText: 'GOLD',
          description: 'Awards +100 Golden Coins.',
          iconName: 'crown'
        }
      ];
    }

    // Shuffle and pick 3 to 4 distinct options
    const shuffled = pool.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(4, shuffled.length));
  }

  private updateLevelUpInput(): void {
    if (this.input.wasKeyPressed('KeyR') && this.player.rerollsRemaining > 0) {
      this.player.rerollsRemaining--;
      this.sound.playShoot('wand');
      this.levelUpOptions = this.generateUpgradeOptions();
      this.selectedUpgradeIdx = 0;
      return;
    }

    if (this.input.wasKeyPressed('KeyS') && this.player.skipsRemaining > 0) {
      this.player.skipsRemaining--;
      this.player.gainXp(35);
      this.sound.playGemPickup();
      this.state = GameState.PLAYING;
      return;
    }

    if (this.input.wasKeyPressed('KeyB') && this.player.banishesRemaining > 0 && this.levelUpOptions[this.selectedUpgradeIdx]) {
      const opt = this.levelUpOptions[this.selectedUpgradeIdx];
      this.player.banishesRemaining--;
      this.player.banishedItemIds.add(opt.id);
      this.sound.playExplosion(0.2, 500);
      this.levelUpOptions = this.generateUpgradeOptions();
      this.selectedUpgradeIdx = 0;
      return;
    }

    if (this.input.wasKeyPressed('Digit1') && this.levelUpOptions[0]) {
      this.selectUpgrade(0);
    } else if (this.input.wasKeyPressed('Digit2') && this.levelUpOptions[1]) {
      this.selectUpgrade(1);
    } else if (this.input.wasKeyPressed('Digit3') && this.levelUpOptions[2]) {
      this.selectUpgrade(2);
    } else if (this.input.wasKeyPressed('Digit4') && this.levelUpOptions[3]) {
      this.selectUpgrade(3);
    } else if (this.input.wasKeyPressed('ArrowDown')) {
      this.selectedUpgradeIdx = (this.selectedUpgradeIdx + 1) % this.levelUpOptions.length;
    } else if (this.input.wasKeyPressed('ArrowUp')) {
      this.selectedUpgradeIdx = (this.selectedUpgradeIdx - 1 + this.levelUpOptions.length) % this.levelUpOptions.length;
    } else if (this.input.wasKeyPressed('Enter') || this.input.wasKeyPressed('Space')) {
      this.selectUpgrade(this.selectedUpgradeIdx);
    }
  }

  private selectUpgrade(index: number): void {
    const opt = this.levelUpOptions[index];
    if (!opt) return;

    if (opt.id === 'roast_chicken') {
      this.player.heal(40);
    } else if (opt.id === 'coin_bag') {
      this.player.gold += 100;
    } else if (opt.type === 'WEAPON') {
      const existing = this.player.getWeapon(opt.id);
      if (existing) {
        existing.levelUp();
      } else {
        const def = ALL_WEAPON_DEFINITIONS[opt.id];
        if (def) {
          this.player.addWeapon(def.create());
        }
      }
    } else if (opt.type === 'PASSIVE') {
      this.player.addPassive(opt.id);
    }

    this.sound.playShoot('wand');
    this.state = GameState.PLAYING;
  }

  // --- Boss Chest Logic ---
  private triggerBossChest(): void {
    this.uiManager.chestOpenProgress = 0;

    // Check if any weapon can evolve!
    let evolvableWeapon = this.player.weapons.find((w) => w.canEvolve(this.player));

    if (evolvableWeapon) {
      evolvableWeapon.evolve();
      this.chestReward = {
        type: 'EVOLUTION',
        id: evolvableWeapon.id,
        name: evolvableWeapon.name,
        levelText: 'EVOLVED!',
        description: evolvableWeapon.evolvedDescription || 'Weapon evolved to legendary form!',
        iconName: evolvableWeapon.iconName
      };
    } else {
      // Award random upgrade or gold
      const options = this.generateUpgradeOptions();
      if (options.length > 0 && options[0].id !== 'roast_chicken' && options[0].id !== 'coin_bag') {
        const chosen = options[0];
        if (chosen.type === 'WEAPON') {
          const w = this.player.getWeapon(chosen.id);
          if (w) w.levelUp();
          else {
            const def = ALL_WEAPON_DEFINITIONS[chosen.id];
            if (def) this.player.addWeapon(def.create());
          }
        } else {
          this.player.addPassive(chosen.id);
        }
        this.chestReward = chosen;
      } else {
        this.player.gold += 250;
        this.chestReward = null;
      }
    }

    this.state = GameState.CHEST_REWARD;
  }

  private claimChestReward(): void {
    this.sound.playGemPickup();
    this.state = GameState.PLAYING;
  }

  // --- Mouse / Touch Interactivity ---
  private updateLevelUpHover(mx: number, my: number): void {
    const cardWidth = Math.min(460, this.camera.viewportWidth - 40);
    const cardHeight = 76;
    const cardGap = 12;
    const startY = this.camera.viewportHeight * 0.23;
    const cx = this.camera.viewportWidth / 2 - cardWidth / 2;

    this.uiManager.hoveredUpgradeIndex = -1;
    this.uiManager.hoveredButton = null;

    for (let i = 0; i < this.levelUpOptions.length; i++) {
      const cy = startY + i * (cardHeight + cardGap);
      if (mx >= cx && mx <= cx + cardWidth && my >= cy && my <= cy + cardHeight) {
        this.uiManager.hoveredUpgradeIndex = i;
        this.selectedUpgradeIdx = i;
        return;
      }
    }

    // Check bottom action buttons (Reroll, Skip, Banish)
    const bottomY = startY + this.levelUpOptions.length * (cardHeight + cardGap) + 16;
    const btnW = 120;
    const btnH = 34;
    const btnGap = 16;
    const totalBtnW = btnW * 3 + btnGap * 2;
    const btnStartX = this.camera.viewportWidth / 2 - totalBtnW / 2;

    if (my >= bottomY && my <= bottomY + btnH) {
      if (mx >= btnStartX && mx <= btnStartX + btnW) {
        this.uiManager.hoveredButton = 'reroll';
      } else if (mx >= btnStartX + btnW + btnGap && mx <= btnStartX + btnW * 2 + btnGap) {
        this.uiManager.hoveredButton = 'skip';
      } else if (mx >= btnStartX + (btnW + btnGap) * 2 && mx <= btnStartX + (btnW + btnGap) * 2 + btnW) {
        this.uiManager.hoveredButton = 'banish';
      }
    }
  }

  private handleLevelUpClick(mx: number, my: number): void {
    if (this.uiManager.hoveredButton === 'reroll' && this.player.rerollsRemaining > 0) {
      this.player.rerollsRemaining--;
      this.sound.playShoot('wand');
      this.levelUpOptions = this.generateUpgradeOptions();
      this.selectedUpgradeIdx = 0;
      return;
    }
    if (this.uiManager.hoveredButton === 'skip' && this.player.skipsRemaining > 0) {
      this.player.skipsRemaining--;
      this.player.gainXp(35);
      this.sound.playGemPickup();
      this.state = GameState.PLAYING;
      return;
    }
    if (this.uiManager.hoveredButton === 'banish' && this.player.banishesRemaining > 0 && this.levelUpOptions[this.selectedUpgradeIdx]) {
      const opt = this.levelUpOptions[this.selectedUpgradeIdx];
      this.player.banishesRemaining--;
      this.player.banishedItemIds.add(opt.id);
      this.sound.playExplosion(0.2, 500);
      this.levelUpOptions = this.generateUpgradeOptions();
      this.selectedUpgradeIdx = 0;
      return;
    }

    if (this.uiManager.hoveredUpgradeIndex >= 0) {
      this.selectUpgrade(this.uiManager.hoveredUpgradeIndex);
    }
  }

  private updateCharSelectHover(mx: number, my: number): void {
    const cardW = 170;
    const cardH = 220;
    const gap = 16;
    const totalW = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
    const startX = Math.max(20, this.camera.viewportWidth / 2 - totalW / 2);
    const startY = this.camera.viewportHeight * 0.24;

    this.uiManager.hoveredCharacterIndex = -1;
    for (let i = 0; i < CHARACTERS.length; i++) {
      const cx = startX + i * (cardW + gap);
      const cy = startY;
      if (mx >= cx && mx <= cx + cardW && my >= cy && my <= cy + cardH) {
        this.uiManager.hoveredCharacterIndex = i;
        break;
      }
    }

    // Start button hover
    const btnW = 240;
    const btnH = 54;
    const btnX = this.camera.viewportWidth / 2 - btnW / 2;
    const btnY = startY + cardH + 40;
    if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
      this.uiManager.hoveredButton = 'start';
    } else {
      this.uiManager.hoveredButton = null;
    }
  }

  private handleCharSelectClick(mx: number, my: number): void {
    if (this.uiManager.hoveredCharacterIndex >= 0) {
      const char = CHARACTERS[this.uiManager.hoveredCharacterIndex];
      if (this.saveManager.isCharacterUnlocked(char.id)) {
        this.selectedCharacter = char;
        this.sound.playShoot('wand');
      }
    }

    if (this.uiManager.hoveredButton === 'start') {
      this.startNewGame(this.selectedCharacter);
    }
  }

  private updateGameOverHover(mx: number, my: number): void {
    const btnW = 200;
    const btnH = 50;
    const btnX = this.camera.viewportWidth / 2 - btnW / 2;
    const btnY = this.camera.viewportHeight * 0.22 + 340 + 24;

    if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
      this.uiManager.hoveredButton = 'restart';
    } else {
      this.uiManager.hoveredButton = null;
    }
  }

  private handleGameOverClick(mx: number, my: number): void {
    if (this.uiManager.hoveredButton === 'restart') {
      this.sound.playBGM('TITLE');
      this.state = GameState.CHARACTER_SELECT;
    }
  }

  private updateChestHover(mx: number, my: number): void {
    const btnW = 160;
    const btnH = 46;
    const btnX = this.camera.viewportWidth / 2 - btnW / 2;
    const btnY = this.camera.viewportHeight * 0.74;

    if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
      this.uiManager.hoveredButton = 'claim';
    } else {
      this.uiManager.hoveredButton = null;
    }
  }

  private handleChestClick(mx: number, my: number): void {
    if (this.uiManager.hoveredButton === 'claim') {
      this.claimChestReward();
    }
  }

  private updateHUDHover(mx: number, my: number): void {
    const btnSize = 32;
    const soundBtnX = this.camera.viewportWidth - 85;
    const soundBtnY = 28;

    if (mx >= soundBtnX && mx <= soundBtnX + btnSize && my >= soundBtnY && my <= soundBtnY + btnSize) {
      this.uiManager.hoveredButton = 'sound';
    } else {
      this.uiManager.hoveredButton = null;
    }
  }

  private handleHUDClick(mx: number, my: number): void {
    if (this.uiManager.hoveredButton === 'sound') {
      this.sound.toggleMute();
    }
  }

  // --- Main Render ---
  private render(alpha: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.camera.viewportWidth;
    const h = this.camera.viewportHeight;

    this.ctx.save();
    this.ctx.scale(dpr, dpr);

    // Clear background
    this.ctx.fillStyle = '#0a0812';
    this.ctx.fillRect(0, 0, w, h);

    if (this.state === GameState.CHARACTER_SELECT) {
      this.uiManager.renderCharacterSelect(this.ctx, w, h, this.selectedCharacter.id);
      this.ctx.restore();
      return;
    }

    // World Rendering (with Camera Transform)
    this.camera.applyTransform(this.ctx);

    // 1. Tiled Procedural Gothic Map
    this.mapSystem.render(this.ctx, this.camera);

    // 2. Combat Entities (Gems, Projectiles, Enemies)
    this.combatSystem.render(this.ctx);

    // 3. Player Entity
    this.player.render(this.ctx);

    // 4. Particle Effects
    this.particleSystem.render(this.ctx);

    // 5. Ambient Fog, Embers & Weapon Trails
    this.ambientParticles.renderFogAndTrails(this.ctx, this.camera);

    // 6. Damage Numbers
    this.damageTextSystem.render(this.ctx);

    this.camera.restoreTransform(this.ctx);

    // Dynamic Darkness Vignette & Torch Illumination
    this.mapSystem.renderLighting(this.ctx, this.camera, this.player);

    // Screen-space UI Overlays
    const hasBoss = this.combatSystem.enemies.some(e => e.isBoss && e.active);
    this.uiManager.renderHUD(
      this.ctx,
      w,
      h,
      this.player,
      this.spawnDirector.elapsedSeconds,
      this.combatSystem.freezeTimer > 0,
      hasBoss
    );

    if (this.state === GameState.LEVEL_UP) {
      this.uiManager.renderLevelUpModal(
        this.ctx,
        w,
        h,
        this.levelUpOptions,
        this.selectedUpgradeIdx,
        this.player
      );
    } else if (this.state === GameState.CHEST_REWARD) {
      this.uiManager.renderBossChestModal(
        this.ctx,
        w,
        h,
        this.chestReward
      );
    } else if (this.state === GameState.GAME_OVER) {
      this.uiManager.renderGameOver(this.ctx, w, h, this.player);
    } else if (this.state === GameState.PAUSED) {
      this.renderPauseOverlay(w, h);
    }

    this.ctx.restore();

    // 7. Full-Screen WebGL Post-Processing Pass (Bloom, Chromatic Aberration & CRT Scanlines)
    if (this.state === GameState.PLAYING) {
      this.postProcessor.render(this.canvas, this.spawnDirector.elapsedSeconds);
    }
  }

  private renderPauseOverlay(w: number, h: number): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 5, 12, 0.75)';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = '900 36px -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PAUSED', w / 2, h / 2 - 10);

    this.ctx.font = '14px -apple-system, sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText('Press ESC or P to Resume', w / 2, h / 2 + 30);
    this.ctx.restore();
  }
}

// Bootstrap Game Engine on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  new GameEngine();
});
