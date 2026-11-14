import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
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
import { CHARACTERS, CharacterInfo, getBranchById, getCharacterById } from './persistence/CharacterSelect';
import gsap from 'gsap';
import { UIManager, UpgradeOption } from './ui/UIManager';
import { getSkillBarLayout } from './ui/SkillBarLayout';
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
  BRANCH_SELECT = 'BRANCH_SELECT',
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
  private selectedBranchIdx = 0;
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
      } else if (this.state === GameState.BRANCH_SELECT) {
        this.updateBranchSelectHover(mx, my);
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
      } else if (this.state === GameState.BRANCH_SELECT) {
        this.handleBranchSelectClick(mx, my);
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

      case GameState.BRANCH_SELECT:
        this.updateBranchSelectInput();
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

  // --- Level Up & Late-Game Ascendancy Branch Logic ---
  private triggerLevelUp(): void {
    if (this.player.level >= 5 && !this.player.branchTriggered) {
      this.player.branchTriggered = true;
      this.selectedBranchIdx = 0;
      this.uiManager.hoveredBranchIndex = -1;
      this.state = GameState.BRANCH_SELECT;
      return;
    }
    this.levelUpOptions = this.generateUpgradeOptions();
    this.selectedUpgradeIdx = 0;
    this.state = GameState.LEVEL_UP;
  }

  private updateBranchSelectInput(): void {
    if (this.input.wasKeyPressed('Digit1')) {
      this.selectBranch(0);
    } else if (this.input.wasKeyPressed('Digit2')) {
      this.selectBranch(1);
    } else if (this.input.wasKeyPressed('ArrowLeft') || this.input.wasKeyPressed('ArrowRight')) {
      this.selectedBranchIdx = this.selectedBranchIdx === 0 ? 1 : 0;
    } else if (this.input.wasKeyPressed('Enter') || this.input.wasKeyPressed('Space')) {
      this.selectBranch(this.selectedBranchIdx);
    }
  }

  private updateBranchSelectHover(mx: number, my: number): void {
    const { cardW, cardH, gap, startX, startY } = this.uiManager.getBranchSelectLayout(
      this.camera.viewportWidth,
      this.camera.viewportHeight
    );

    this.uiManager.hoveredBranchIndex = -1;
    for (let i = 0; i < 2; i++) {
      const cx = startX + i * (cardW + gap);
      if (mx >= cx && mx <= cx + cardW && my >= startY && my <= startY + cardH) {
        this.uiManager.hoveredBranchIndex = i;
        this.selectedBranchIdx = i;
        break;
      }
    }
  }

  private handleBranchSelectClick(_mx: number, _my: number): void {
    if (this.uiManager.hoveredBranchIndex >= 0) {
      this.selectBranch(this.uiManager.hoveredBranchIndex);
    }
  }

  private selectBranch(index: number): void {
    const char = getCharacterById(this.player.characterId);
    const branch = char.branches[index];
    if (!branch) return;

    this.player.selectedBranch = branch.id;
    this.player.branchColor = branch.color;
    this.player.branchAscendFlashTimer = 1.1;
    this.player.recalculateStats();
    this.sound.playLevelUp();
    this.particleSystem.emitHit(this.player.position.x, this.player.position.y, branch.color, 24);
    this.camera.triggerShake(8);

    this.state = GameState.PLAYING;
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

    // 傻瓜化推荐标记：高亮契合当前分化路线或主武器的选项，并优先保证顺滑成型
    const activeBranch = getBranchById(this.player.characterId, this.player.selectedBranch);
    const charInfo = getCharacterById(this.player.characterId);
    for (const opt of pool) {
      const matchesWeapon = opt.id === charInfo.startingWeapon;
      const matchesBranch = activeBranch && opt.tags
        ? opt.tags.some(tag => activeBranch.recommendedTags.includes(tag))
        : false;
      opt.isRecommended = matchesWeapon || matchesBranch;
    }

    const shuffled = pool.sort((a, b) => {
      const scoreA = (a.isRecommended ? 1 : 0) + Math.random() * 1.4;
      const scoreB = (b.isRecommended ? 1 : 0) + Math.random() * 1.4;
      return scoreB - scoreA;
    });
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
    const isInGame = this.state !== GameState.CHARACTER_SELECT;
    const l = this.uiManager.getSettingsLayout(
      this.camera.viewportWidth,
      this.camera.viewportHeight,
      isInGame
    );

    this.uiManager.hoveredButton = null;

    if (my >= l.langBtnY && my <= l.langBtnY + l.langBtnH) {
      if (mx >= l.zhBtnX && mx <= l.zhBtnX + l.langBtnW) {
        this.uiManager.hoveredButton = 'lang_zh';
        return;
      }
      if (mx >= l.enBtnX && mx <= l.enBtnX + l.langBtnW) {
        this.uiManager.hoveredButton = 'lang_en';
        return;
      }
    }

    if (mx >= l.audioBtnX && mx <= l.audioBtnX + l.audioBtnW && my >= l.audioBtnY && my <= l.audioBtnY + l.audioBtnH) {
      this.uiManager.hoveredButton = 'toggle_audio';
      return;
    }

    if (mx >= l.audioBtnX && mx <= l.audioBtnX + l.audioBtnW && my >= l.bgmBtnY && my <= l.bgmBtnY + l.audioBtnH) {
      this.uiManager.hoveredButton = 'cycle_bgm_style';
      return;
    }

    if (mx >= l.actionBtnX && mx <= l.actionBtnX + l.actionBtnW && my >= l.resumeBtnY && my <= l.resumeBtnY + l.actionBtnH) {
      this.uiManager.hoveredButton = 'close_settings';
      return;
    }

    if (isInGame && mx >= l.actionBtnX && mx <= l.actionBtnX + l.actionBtnW && my >= l.quitBtnY && my <= l.quitBtnY + l.actionBtnH) {
      this.uiManager.hoveredButton = 'quit_to_title';
      return;
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
    const l = this.uiManager.getLevelUpLayout(
      this.camera.viewportWidth,
      this.camera.viewportHeight,
      this.levelUpOptions.length,
      !!this.player
    );

    this.uiManager.hoveredUpgradeIndex = -1;
    this.uiManager.hoveredButton = null;

    for (let i = 0; i < this.levelUpOptions.length; i++) {
      const cy = l.startY + i * (l.cardHeight + l.cardGap);
      if (mx >= l.cardX && mx <= l.cardX + l.cardWidth && my >= cy && my <= cy + l.cardHeight) {
        this.uiManager.hoveredUpgradeIndex = i;
        this.selectedUpgradeIdx = i;
        return;
      }
    }

    if (my >= l.bottomY && my <= l.bottomY + l.btnH) {
      if (mx >= l.btnStartX && mx <= l.btnStartX + l.btnW) {
        this.uiManager.hoveredButton = 'reroll';
      } else if (mx >= l.btnStartX + l.btnW + l.btnGap && mx <= l.btnStartX + l.btnW * 2 + l.btnGap) {
        this.uiManager.hoveredButton = 'skip';
      } else if (mx >= l.btnStartX + (l.btnW + l.btnGap) * 2 && mx <= l.btnStartX + (l.btnW + l.btnGap) * 2 + l.btnW) {
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
    const l = this.uiManager.getCharSelectLayout(
      this.camera.viewportWidth,
      this.camera.viewportHeight
    );

    this.uiManager.hoveredCharacterIndex = -1;
    this.uiManager.hoveredButton = null;

    if (my >= l.topBtnY && my <= l.topBtnY + l.btnSize) {
      if (mx >= l.settingsBtnX && mx <= l.settingsBtnX + l.btnSize) {
        this.uiManager.hoveredButton = 'open_settings';
        return;
      }
      if (mx >= l.soundBtnX && mx <= l.soundBtnX + l.btnSize) {
        this.uiManager.hoveredButton = 'sound';
        return;
      }
    }

    for (let i = 0; i < CHARACTERS.length; i++) {
      const cx = l.startX + i * (l.cardW + l.gap);
      const cy = l.startY;
      if (mx >= cx && mx <= cx + l.cardW && my >= cy && my <= cy + l.cardH) {
        this.uiManager.hoveredCharacterIndex = i;
        break;
      }
    }

    if (mx >= l.btnX && mx <= l.btnX + l.btnW && my >= l.btnY && my <= l.btnY + l.btnH) {
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
    const { btnW, btnH, btnX, btnY } = this.uiManager.getGameOverLayout(
      this.camera.viewportWidth,
      this.camera.viewportHeight
    );

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
    const { btnW, btnH, btnX, btnY } = this.uiManager.getChestModalLayout(
      this.camera.viewportWidth,
      this.camera.viewportHeight
    );

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
    const { topBtnY, btnSize, settingsBtnX, soundBtnX } = this.uiManager.getTopUtilityButtonsLayout(
      this.camera.viewportWidth
    );

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

    const { slotW, slotH, gap, startX, y: skillY } = getSkillBarLayout(
      this.camera.viewportWidth, this.camera.viewportHeight
    );
    const dashX = startX;
    const ultX = startX + slotW + gap;

    if (my >= skillY && my <= skillY + slotH) {
      if (mx >= dashX && mx <= dashX + slotW) {
        this.uiManager.hoveredButton = 'dash_skill';
      } else if (mx >= ultX && mx <= ultX + slotW) {
        this.uiManager.hoveredButton = 'ult_skill';
      } else if (mx >= startX + (slotW + gap) * 2 && mx <= startX + (slotW + gap) * 2 + slotW) {
        this.uiManager.hoveredButton = 'companion_skill';
      }
    }
  }

  private handleHUDClick(mx: number, my: number): void {
    this.updateHUDHover(mx, my);
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
    } else if (this.uiManager.hoveredButton === 'companion_skill') {
      this.companionSystem.toggleMode(this.player, this.combatSystem);
      this.sound.playShoot('wand');
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
    this.ctx.fillStyle = '#05030a';
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

    // 5. Ambient Fog, Embers, Weapon Trails & Overhead Volumetric Ceiling God-Rays
    this.ambientParticles.renderFogAndTrails(this.ctx, this.camera);
    this.roomManager.renderCeilingGodRaysOverlay(this.ctx);

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
        this.player,
        this.companionSystem
      );
    } else if (this.state === GameState.BRANCH_SELECT) {
      this.uiManager.renderBranchSelectModal(
        this.ctx,
        w,
        h,
        getCharacterById(this.player.characterId),
        this.selectedBranchIdx
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
