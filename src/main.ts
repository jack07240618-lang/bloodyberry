import { GameLoop } from './core/GameLoop';
import { InputController } from './core/Input';
import { Camera } from './core/Camera';
import { SoundSynthesizer } from './core/SoundSynthesizer';
import { Player } from './entities/Player';
import { CombatSystem } from './systems/CombatSystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { DamageTextSystem } from './systems/DamageTextSystem';
import { MapSystem } from './systems/MapSystem';
import { RoomManager, RoomType } from './systems/RoomManager';
import { WEAPON_DEFAULT_TAGS } from './systems/BuildSystem';
import { CompanionSystem } from './systems/CompanionSystem';
import { SaveManager } from './persistence/SaveManager';
import { CHARACTERS, CharacterInfo } from './persistence/CharacterSelect';
import gsap from 'gsap';
import { UIManager, UpgradeOption } from './ui/UIManager';
import { ALL_WEAPON_DEFINITIONS } from './weapons/WeaponRegistry';
import { PASSIVE_DEFINITIONS } from './passives/PassiveRegistry';
import { AmbientParticleSystem } from './systems/AmbientParticleSystem';
import {
  i18n,
  t,
  getWeaponDisplayName,
  getWeaponDescription,
  getWeaponUpgradeDescription,
  getPassiveDisplayName,
  getPassiveLevelDescription
} from './core/I18n';

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
  private roomManager: RoomManager;
  private companionSystem: CompanionSystem;
  private gameLoop: GameLoop;
  private ambientParticles: AmbientParticleSystem;

  // State
  private state: GameState = GameState.CHARACTER_SELECT;
  private isSettingsOpen = false;
  private selectedCharacter: CharacterInfo = CHARACTERS[0];
  private player: Player;
  private levelUpOptions: UpgradeOption[] = [];
  private selectedUpgradeIdx = 0;
  private chestReward: UpgradeOption | null = null;
  private hitStopTimer = 0;
  private wasBossPresent = false;

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
    this.roomManager = new RoomManager(this.combatSystem);
    this.companionSystem = new CompanionSystem();
    this.ambientParticles = new AmbientParticleSystem();
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
    };

    window.addEventListener('resize', resize);
    resize();
  }

  private setupMouseEvents(): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.isSettingsOpen || this.state === GameState.PAUSED) {
        this.updateSettingsHover(mx, my);
      } else if (this.state === GameState.LEVEL_UP) {
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

      if (this.isSettingsOpen || this.state === GameState.PAUSED) {
        this.handleSettingsClick(mx, my);
      } else if (this.state === GameState.CHARACTER_SELECT) {
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
    this.player.characterId = charInfo.id;

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
    this.roomManager = new RoomManager(this.combatSystem);
    this.roomManager.loadRoom(1, RoomType.COMBAT, this.player);
    this.companionSystem = new CompanionSystem();
    this.companionSystem.reset(this.player.position);

    this.camera.position.copy(this.player.position);
    this.sound.playBGM('BATTLE');
    this.isSettingsOpen = false;
    this.wasBossPresent = false;
    this.uiManager.resetBossPresentation();
    this.state = GameState.PLAYING;
  }

  // --- Main Update ---
  private update(dt: number): void {
    if (this.isSettingsOpen) {
      if (this.input.wasKeyPressed('Escape') || this.input.wasKeyPressed('KeyP')) {
        this.isSettingsOpen = false;
        if (this.state === GameState.PAUSED) {
          this.state = GameState.PLAYING;
        }
      }
      this.input.endFrame();
      return;
    }

    switch (this.state) {
      case GameState.CHARACTER_SELECT:
        if (this.input.wasKeyPressed('Escape')) {
          this.isSettingsOpen = true;
        } else if (this.input.wasKeyPressed('Enter') || this.input.wasKeyPressed('Space')) {
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
          this.isSettingsOpen = false;
          this.state = GameState.PLAYING;
        }
        break;
    }

    this.input.endFrame();
  }

  private updatePlaying(dt: number): void {
    if (this.input.wasKeyPressed('Escape') || this.input.wasKeyPressed('KeyP')) {
      this.isSettingsOpen = true;
      this.state = GameState.PAUSED;
      return;
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      // Keep particles, damage numbers, and camera shake alive during cinematic hit-stop / time dilation
      this.camera.update(dt);
      this.particleSystem.update(dt * 0.45);
      this.damageTextSystem.update(dt * 0.45);
      if (this.combatSystem.bossSlainWaveTimer > 0) {
        this.combatSystem.bossSlainWaveTimer = Math.max(0, this.combatSystem.bossSlainWaveTimer - dt);
      }
      return;
    }

    // Movement direction from input
    this.player.moveDirection = this.input.getMovementVector();

    // Active Skill 1: Shadow Dash [Space or Shift]
    if (this.input.wasKeyPressed('Space') || this.input.wasKeyPressed('ShiftLeft') || this.input.wasKeyPressed('ShiftRight')) {
      this.activatePlayerDash();
    }

    // Active Skill 2: Ultimate Screen-Nuke (Pentagram / Gorgeous Moon) [KeyQ / KeyE / KeyR]
    if (this.input.wasKeyPressed('KeyQ') || this.input.wasKeyPressed('KeyE') || this.input.wasKeyPressed('KeyR')) {
      this.activatePlayerUltimate();
    }

    // Active Skill 3: 相依灵体锚定 / 召回切换 [KeyF]
    if (this.input.wasKeyPressed('KeyF')) {
      this.companionSystem.toggleMode(this.player, this.combatSystem);
      this.sound.playShoot('wand');
    }

    this.player.update(dt);
    this.companionSystem.update(dt, this.player, this.combatSystem);

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

    // Camera follow player with smooth interpolation
    this.camera.follow(this.player.position, 0.12);
    this.camera.update(dt);

    // Map & Destructibles
    this.mapSystem.update(this.player.position, dt);

    // 独立房间制状态机与波次/门推进管理 (RoomManager)
    this.roomManager.update(dt, this.player, () => this.triggerLevelUp());

    // Combat system
    this.combatSystem.update(
      dt,
      this.player,
      () => this.triggerLevelUp(),
      () => this.triggerBossChest(),
      (dur) => { this.hitStopTimer = dur; }
    );

    // Dynamic Boss BGM switch & Cinematic Entrance / Slain Presentation
    const activeBoss = this.combatSystem.enemies.find(e => e.isBoss && e.active) || null;
    const hasBoss = activeBoss !== null;
    if (hasBoss && !this.wasBossPresent) {
      this.wasBossPresent = true;
      this.hitStopTimer = Math.max(this.hitStopTimer, 0.15);
      this.sound.playBossWarning();
      this.uiManager.triggerBossEntranceWarning(activeBoss.bossVariant);
    } else if (!hasBoss && this.wasBossPresent) {
      this.wasBossPresent = false;
      this.uiManager.triggerBossSlainShatter();
    }

    if (hasBoss) {
      this.sound.playBGM('BOSS');
    } else {
      this.sound.playBGM('BATTLE');
    }

    // Particle & Damage Text Systems
    this.particleSystem.update(dt);
    this.damageTextSystem.update(dt);
    this.ambientParticles.update(dt, this.player.position);
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
          name: getWeaponDisplayName(w.id, w.isEvolved),
          levelText: `LV ${w.level + 1}`,
          description: getWeaponUpgradeDescription(w.id, w.level + 1, w.getUpgradeDescription(w.level + 1)),
          iconName: w.iconName,
          tags: w.tags
        });
      }
    }

    // 2. New weapons (if slots available)
    if (this.player.weapons.length < this.player.maxWeaponSlots) {
      for (const [id] of Object.entries(ALL_WEAPON_DEFINITIONS)) {
        if (this.player.banishedItemIds.has(id)) continue;
        if (!this.player.getWeapon(id)) {
          pool.push({
            type: 'WEAPON',
            id,
            name: getWeaponDisplayName(id, false),
            levelText: 'NEW!',
            description: getWeaponDescription(id, false),
            iconName: id,
            tags: WEAPON_DEFAULT_TAGS[id] || []
          });
        }
      }
    }

    // 3. Existing passives upgrades (机制改变与标签联动遗物)
    for (const [id, lvl] of this.player.passives.entries()) {
      if (this.player.banishedItemIds.has(id)) continue;
      const def = PASSIVE_DEFINITIONS[id];
      if (def && lvl < def.maxLevel) {
        pool.push({
          type: 'PASSIVE',
          id,
          name: getPassiveDisplayName(id),
          levelText: `LV ${lvl + 1}`,
          description: getPassiveLevelDescription(id, lvl),
          iconName: id,
          tags: def.tags
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
            name: getPassiveDisplayName(id),
            levelText: 'NEW!',
            description: getPassiveLevelDescription(id, 0),
            iconName: id,
            tags: def.tags
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
          name: t('圣所烤鸡', 'Floor Chicken'),
          levelText: t('恢复', 'HEAL'),
          description: t('立即恢复 40 点生命值。', 'Restores 40 Health immediately.'),
          iconName: 'pummarola'
        },
        {
          type: 'PASSIVE',
          id: 'coin_bag',
          name: t('金币钱袋', 'Treasure Bag'),
          levelText: t('金币', 'GOLD'),
          description: t('立即获得 +100 金币。', 'Awards +100 Golden Coins.'),
          iconName: 'crown'
        }
      ];
    }

    // 三选一构筑界面：优先保证至少有1~2项机制遗物(PASSIVE)以凸显标签联动体验
    const shuffled = pool.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(3, shuffled.length));
  }

  private updateLevelUpInput(): void {
    if (this.input.wasKeyPressed('KeyR') && this.player.useReroll()) {
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

    if (this.input.wasKeyPressed('KeyB') && this.levelUpOptions[this.selectedUpgradeIdx]) {
      const opt = this.levelUpOptions[this.selectedUpgradeIdx];
      if (this.player.useBanish(opt.id)) {
        this.sound.playExplosion(0.2, 500);
        this.levelUpOptions = this.generateUpgradeOptions();
        this.selectedUpgradeIdx = 0;
        return;
      }
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

    this.sound.playUIConfirm();

    // Check if player has more stacked level ups
    if (this.player.pendingLevelUps > 1) {
      this.player.pendingLevelUps--;
      this.levelUpOptions = this.generateUpgradeOptions();
      this.selectedUpgradeIdx = 0;
      this.state = GameState.LEVEL_UP;
    } else {
      this.player.pendingLevelUps = 0;
      this.state = GameState.PLAYING;
    }
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
        name: getWeaponDisplayName(evolvableWeapon.id, true),
        levelText: t('已进化!', 'EVOLVED!'),
        description: getWeaponDescription(evolvableWeapon.id, true),
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
    this.sound.playUIConfirm();
    this.state = GameState.PLAYING;
  }

  // --- Mouse / Touch Interactivity ---
  private updateSettingsHover(mx: number, my: number): void {
    const w = this.camera.viewportWidth;
    const h = this.camera.viewportHeight;
    const isInGame = this.state !== GameState.CHARACTER_SELECT;
    const panelW = 396;
    const panelH = isInGame ? 358 : 302;
    const panelX = w / 2 - panelW / 2;
    const panelY = h / 2 - panelH / 2;

    this.uiManager.hoveredButton = null;

    // Language Buttons
    const row1Y = panelY + 84;
    const langBtnW = 92;
    const langBtnH = 32;
    const zhBtnX = panelX + panelW - 28 - langBtnW * 2 - 10;
    const enBtnX = panelX + panelW - 28 - langBtnW;
    const langBtnY = row1Y - langBtnH / 2;

    if (my >= langBtnY && my <= langBtnY + langBtnH) {
      if (mx >= zhBtnX && mx <= zhBtnX + langBtnW) {
        this.uiManager.hoveredButton = 'lang_zh';
        return;
      }
      if (mx >= enBtnX && mx <= enBtnX + langBtnW) {
        this.uiManager.hoveredButton = 'lang_en';
        return;
      }
    }

    // Audio Toggle Button
    const row2Y = panelY + 132;
    const audioBtnW = 194;
    const audioBtnH = 32;
    const audioBtnX = panelX + panelW - 28 - audioBtnW;
    const audioBtnY = row2Y - audioBtnH / 2;
    if (mx >= audioBtnX && mx <= audioBtnX + audioBtnW && my >= audioBtnY && my <= audioBtnY + audioBtnH) {
      this.uiManager.hoveredButton = 'toggle_audio';
      return;
    }

    // BGM Style Cycle Button
    const row3Y = panelY + 180;
    const bgmBtnY = row3Y - audioBtnH / 2;
    if (mx >= audioBtnX && mx <= audioBtnX + audioBtnW && my >= bgmBtnY && my <= bgmBtnY + audioBtnH) {
      this.uiManager.hoveredButton = 'cycle_bgm_style';
      return;
    }

    // Bottom Action Buttons
    const actionBtnW = panelW - 56;
    const actionBtnH = 40;
    const actionBtnX = panelX + 28;
    const resumeBtnY = panelY + 232;
    if (mx >= actionBtnX && mx <= actionBtnX + actionBtnW && my >= resumeBtnY && my <= resumeBtnY + actionBtnH) {
      this.uiManager.hoveredButton = 'close_settings';
      return;
    }

    if (isInGame) {
      const quitBtnY = panelY + 286;
      if (mx >= actionBtnX && mx <= actionBtnX + actionBtnW && my >= quitBtnY && my <= quitBtnY + actionBtnH) {
        this.uiManager.hoveredButton = 'quit_to_title';
        return;
      }
    }
  }

  private handleSettingsClick(_mx: number, _my: number): void {
    const hov = this.uiManager.hoveredButton;
    if (hov === 'lang_zh') {
      i18n.setLanguage('zh');
      this.sound.playUIConfirm();
    } else if (hov === 'lang_en') {
      i18n.setLanguage('en');
      this.sound.playUIConfirm();
    } else if (hov === 'toggle_audio') {
      this.sound.toggleMute();
    } else if (hov === 'cycle_bgm_style') {
      this.sound.cycleBGMStyle();
      this.sound.playUIConfirm();
    } else if (hov === 'close_settings') {
      this.sound.playUIConfirm();
      this.isSettingsOpen = false;
      this.uiManager.hoveredButton = null;
      if (this.state === GameState.PAUSED) {
        this.state = GameState.PLAYING;
      }
    } else if (hov === 'quit_to_title') {
      this.sound.playUIConfirm();
      this.isSettingsOpen = false;
      this.uiManager.hoveredButton = null;
      this.sound.playBGM('TITLE');
      this.state = GameState.CHARACTER_SELECT;
    }
  }

  private updateLevelUpHover(mx: number, my: number): void {
    const cardWidth = Math.min(540, this.camera.viewportWidth - 40);
    const cardHeight = 84;
    const cardGap = 14;
    const startY = this.camera.viewportHeight * 0.21;
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
    const bottomY = startY + this.levelUpOptions.length * (cardHeight + cardGap) + 18;
    const btnW = 148;
    const btnH = 38;
    const btnGap = 18;
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

  private handleLevelUpClick(_mx: number, _my: number): void {
    if (this.uiManager.hoveredButton === 'reroll' && this.player.useReroll()) {
      this.sound.playUIConfirm();
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
    if (this.uiManager.hoveredButton === 'banish' && this.levelUpOptions[this.selectedUpgradeIdx]) {
      const opt = this.levelUpOptions[this.selectedUpgradeIdx];
      if (this.player.useBanish(opt.id)) {
        this.sound.playExplosion(0.2, 500);
        this.levelUpOptions = this.generateUpgradeOptions();
        this.selectedUpgradeIdx = 0;
        return;
      }
    }

    if (this.uiManager.hoveredUpgradeIndex >= 0) {
      this.selectUpgrade(this.uiManager.hoveredUpgradeIndex);
    }
  }

  private updateCharSelectHover(mx: number, my: number): void {
    const w = this.camera.viewportWidth;
    const h = this.camera.viewportHeight;

    // Top-right Settings & Audio buttons
    const topBtnY = 22;
    const btnSize = 30;
    const settingsBtnX = w - 88;
    const soundBtnX = w - 50;

    this.uiManager.hoveredCharacterIndex = -1;
    this.uiManager.hoveredButton = null;

    if (my >= topBtnY && my <= topBtnY + btnSize) {
      if (mx >= settingsBtnX && mx <= settingsBtnX + btnSize) {
        this.uiManager.hoveredButton = 'open_settings';
        return;
      }
      if (mx >= soundBtnX && mx <= soundBtnX + btnSize) {
        this.uiManager.hoveredButton = 'sound';
        return;
      }
    }

    const cardW = 168;
    const cardH = 232;
    const gap = 16;
    const totalW = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
    const startX = Math.max(20, w / 2 - totalW / 2);
    const startY = h * 0.215;

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
    const btnH = 50;
    const btnX = w / 2 - btnW / 2;
    const btnY = startY + cardH + 38;
    if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
      this.uiManager.hoveredButton = 'start';
    }
  }

  private handleCharSelectClick(_mx: number, _my: number): void {
    if (this.uiManager.hoveredButton === 'open_settings') {
      this.isSettingsOpen = true;
      this.uiManager.hoveredButton = null;
      return;
    }
    if (this.uiManager.hoveredButton === 'sound') {
      this.sound.toggleMute();
      return;
    }

    if (this.uiManager.hoveredCharacterIndex >= 0) {
      const char = CHARACTERS[this.uiManager.hoveredCharacterIndex];
      if (this.saveManager.isCharacterUnlocked(char.id)) {
        this.selectedCharacter = char;
        this.sound.playUIConfirm();
      }
    }

    if (this.uiManager.hoveredButton === 'start') {
      this.startNewGame(this.selectedCharacter);
    }
  }

  private updateGameOverHover(mx: number, my: number): void {
    const btnW = 200;
    const btnH = 46;
    const btnX = this.camera.viewportWidth / 2 - btnW / 2;
    const btnY = this.camera.viewportHeight * 0.19 + 340 + 24;

    if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
      this.uiManager.hoveredButton = 'restart';
    } else {
      this.uiManager.hoveredButton = null;
    }
  }

  private handleGameOverClick(_mx: number, _my: number): void {
    if (this.uiManager.hoveredButton === 'restart') {
      this.sound.playBGM('TITLE');
      this.state = GameState.CHARACTER_SELECT;
    }
  }

  private updateChestHover(mx: number, my: number): void {
    const btnW = 180;
    const btnH = 44;
    const btnX = this.camera.viewportWidth / 2 - btnW / 2;
    const btnY = this.camera.viewportHeight * 0.22 + 280 + 22;

    if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
      this.uiManager.hoveredButton = 'claim';
    } else {
      this.uiManager.hoveredButton = null;
    }
  }

  private handleChestClick(_mx: number, _my: number): void {
    if (this.uiManager.hoveredButton === 'claim') {
      this.claimChestReward();
    }
  }

  private activatePlayerDash(): void {
    if (this.player.tryDash()) {
      this.sound.playShoot('dagger');
      this.combatSystem.triggerDashShockwave(this.player);
    }
  }

  private activatePlayerUltimate(): void {
    if (this.player.triggerUltimate()) {
      this.combatSystem.triggerCharacterUltimate(this.player);
    }
  }

  private updateHUDHover(mx: number, my: number): void {
    const topBtnY = 22;
    const btnSize = 30;
    const settingsBtnX = this.camera.viewportWidth - 88;
    const soundBtnX = this.camera.viewportWidth - 50;

    this.uiManager.hoveredButton = null;

    if (my >= topBtnY && my <= topBtnY + btnSize) {
      if (mx >= settingsBtnX && mx <= settingsBtnX + btnSize) {
        this.uiManager.hoveredButton = 'open_settings';
        return;
      }
      if (mx >= soundBtnX && mx <= soundBtnX + btnSize) {
        this.uiManager.hoveredButton = 'sound';
        return;
      }
    }

    // Check Bottom-Center Active Skill Buttons (Dash & Ultimate & Companion)
    const slotW = 128;
    const slotH = 38;
    const gap = 14;
    const totalW = slotW * 3 + gap * 2;
    const startX = this.camera.viewportWidth / 2 - totalW / 2;
    const dashX = startX;
    const ultX = startX + slotW + gap;
    const skillY = this.camera.viewportHeight - 54;

    if (my >= skillY && my <= skillY + slotH) {
      if (mx >= dashX && mx <= dashX + slotW) {
        this.uiManager.hoveredButton = 'dash_skill';
      } else if (mx >= ultX && mx <= ultX + slotW) {
        this.uiManager.hoveredButton = 'ult_skill';
      }
    }
  }

  private handleHUDClick(_mx: number, _my: number): void {
    if (this.uiManager.hoveredButton === 'open_settings') {
      this.isSettingsOpen = true;
      this.uiManager.hoveredButton = null;
      this.state = GameState.PAUSED;
    } else if (this.uiManager.hoveredButton === 'sound') {
      this.sound.toggleMute();
    } else if (this.uiManager.hoveredButton === 'dash_skill') {
      this.activatePlayerDash();
    } else if (this.uiManager.hoveredButton === 'ult_skill') {
      this.activatePlayerUltimate();
    }
  }

  // --- Main Render ---
  private render(_alpha: number): void {
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
      if (this.isSettingsOpen) {
        this.uiManager.renderSettingsModal(this.ctx, w, h, false);
      }
      this.ctx.restore();
      return;
    }

    // World Rendering (with Camera Transform)
    this.camera.applyTransform(this.ctx);

    // 1. Tiled Procedural Gothic Map & Room Arena Walls/Doors/Interactables
    this.mapSystem.render(this.ctx, this.camera);
    this.roomManager.renderRoomArena(this.ctx, this.camera);

    // 2. Combat Entities (Gems, Projectiles, Enemies)
    this.combatSystem.render(this.ctx);

    // 3. Player Entity & Symbiotic Soul Companion (相依灵体与连线)
    this.companionSystem.render(this.ctx, this.player);
    this.player.render(this.ctx);

    // 4. Particle Effects
    this.particleSystem.render(this.ctx);

    // 5. Ambient Fog, Embers & Weapon Trails
    this.ambientParticles.renderFogAndTrails(this.ctx, this.camera);

    // 6. Damage Numbers
    this.damageTextSystem.render(this.ctx);

    this.camera.restoreTransform(this.ctx);

    // Dynamic Darkness Vignette & Torch/Projectile Illumination
    this.mapSystem.renderLighting(this.ctx, this.camera, this.player, this.combatSystem);

    // Screen-space UI Overlays
    const activeBoss = this.combatSystem.enemies.find(e => e.isBoss && e.active) || null;
    const hasBoss = activeBoss !== null;
    this.uiManager.renderHUD(
      this.ctx,
      w,
      h,
      this.player,
      this.roomManager.elapsedSeconds,
      this.combatSystem.freezeTimer > 0,
      hasBoss,
      this.companionSystem,
      activeBoss
    );
    this.roomManager.renderRoomOverlayHUD(this.ctx, w, h);

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
    } else if (this.state === GameState.PAUSED || this.isSettingsOpen) {
      this.uiManager.renderSettingsModal(this.ctx, w, h, true);
    }

    this.ctx.restore();
  }
}

// Bootstrap Game Engine on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  new GameEngine();
});
