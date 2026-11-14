import { Player } from '../entities/Player';
import { getSkillBarLayout } from './SkillBarLayout';
import {
  GOTHIC_BODY_FONT,
  GOTHIC_DISPLAY_FONT,
  GOTHIC_MONO_FONT,
  drawCathedralBackdrop,
  drawGothicCrestBanner,
  drawGothicDivider,
  drawGothicGaugeBar,
  drawGothicTablet,
  drawPointedArchNiche,
  drawRoseWindowMandala,
  drawScreenIronFrame,
  drawWaxSeal,
  traceChamferedRect
} from './GothicOrnament';
import { Enemy } from '../enemies/Enemy';
import { SoundSynthesizer } from '../core/SoundSynthesizer';
import { ALL_WEAPON_DEFINITIONS } from '../weapons/WeaponRegistry';
import { CHARACTERS, CharacterInfo, getBranchById } from '../persistence/CharacterSelect';
import { SaveManager } from '../persistence/SaveManager';
import { SpriteRenderer } from '../renderer/SpriteRenderer';
import { SkillTag, TAG_METADATA } from '../systems/BuildSystem';
import { CompanionSystem } from '../systems/CompanionSystem';
import { i18n, t, getCharacterText, getWeaponDisplayName, getPassiveDisplayName } from '../core/I18n';

export interface UpgradeOption {
  type: 'WEAPON' | 'PASSIVE' | 'EVOLUTION';
  id: string;
  name: string;
  levelText: string;
  description: string;
  iconName: string;
  tags?: SkillTag[];
  isRecommended?: boolean;
}

export class UIManager {
  public hoveredUpgradeIndex = -1;
  public hoveredCharacterIndex = -1;
  public hoveredBranchIndex = -1;
  public hoveredButton: string | null = null;

  // Chest animation
  public chestOpenProgress = 0;
  public chestRewardOptions: UpgradeOption[] = [];

  // Screen-Space Boss HUD & Cinematic Entrance / Slain Decrescendo State
  private bossHudSlide = 0;
  private bossWarningTimer = 0;
  private bossSlainShatterTimer = 0;
  private lastKnownBossVariant = 0;
  private lastKnownBossPhase = 1;
  private lastKnownBossHpRatio = 1;
  private lastKnownBossLagRatio = 1;
  private lastKnownBossMaxHp = 1950;
  private lastKnownBossHp = 1950;
  private lastFrameTimestamp = 0;

  constructor(
    private saveManager: SaveManager,
    private sound: SoundSynthesizer
  ) {}

  public resetBossPresentation(): void {
    this.bossHudSlide = 0;
    this.bossWarningTimer = 0;
    this.bossSlainShatterTimer = 0;
    this.lastFrameTimestamp = 0;
  }

  public triggerBossEntranceWarning(variant: number): void {
    this.lastKnownBossVariant = variant;
    this.bossWarningTimer = 1.8;
    this.bossSlainShatterTimer = 0;
  }

  public triggerBossSlainShatter(): void {
    this.bossSlainShatterTimer = 0.95;
    this.lastKnownBossHp = 0;
    this.lastKnownBossHpRatio = 0;
  }

  // --- Shared Layout Geometry (Single Source of Truth for UI Rendering & Input Hitboxes) ---

  public getTopUtilityButtonsLayout(width: number) {
    const btnSize = 32;
    const topBtnY = 20;
    const settingsBtnX = width - 92;
    const soundBtnX = width - 52;
    return { topBtnY, btnSize, settingsBtnX, soundBtnX };
  }

  public getCharSelectLayout(width: number, height: number) {
    const utils = this.getTopUtilityButtonsLayout(width);
    const maxAvailW = Math.max(320, width - 48);
    const gap = Math.max(12, Math.min(22, Math.round(maxAvailW * 0.024)));
    const cardW = Math.min(214, Math.max(142, Math.floor((maxAvailW - gap * (CHARACTERS.length - 1)) / CHARACTERS.length)));
    const cardH = Math.min(284, Math.max(242, Math.round(height * 0.39)));
    const totalW = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
    const startX = Math.max(20, Math.round(width / 2 - totalW / 2));
    const startY = Math.max(134, Math.round(height * 0.215));
    const btnW = Math.min(264, width - 48);
    const btnH = 50;
    const btnX = Math.round(width / 2 - btnW / 2);
    const btnY = Math.min(height - btnH - 46, startY + cardH + 26);
    return {
      ...utils,
      cardW,
      cardH,
      gap,
      totalW,
      startX,
      startY,
      btnW,
      btnH,
      btnX,
      btnY
    };
  }

  public getLevelUpLayout(width: number, height: number, optionCount: number, hasPlayer: boolean) {
    const crestW = Math.min(268, width - 40);
    const crestH = 38;
    const crestX = width / 2 - crestW / 2;
    const crestY = Math.max(26, Math.round(height * 0.065));
    const loadoutW = Math.min(584, width - 36);
    const loadoutH = hasPlayer ? 38 : 0;
    const loadoutX = width / 2 - loadoutW / 2;
    const loadoutY = crestY + crestH + 10;
    const cardWidth = Math.min(584, width - 36);
    const cardHeight = optionCount >= 4 && height < 680 ? 80 : 88;
    const cardGap = 12;
    const cardX = width / 2 - cardWidth / 2;
    const startY = hasPlayer ? loadoutY + loadoutH + 12 : crestY + crestH + 18;
    const bottomY = startY + optionCount * (cardHeight + cardGap) + 14;
    const btnGap = 14;
    const btnW = Math.min(156, Math.floor((cardWidth - btnGap * 2) / 3));
    const btnH = 38;
    const totalBtnW = btnW * 3 + btnGap * 2;
    const btnStartX = width / 2 - totalBtnW / 2;
    return {
      crestW,
      crestH,
      crestX,
      crestY,
      loadoutW,
      loadoutH,
      loadoutX,
      loadoutY,
      cardWidth,
      cardHeight,
      cardGap,
      cardX,
      startY,
      bottomY,
      btnW,
      btnH,
      btnGap,
      btnStartX
    };
  }

  public getBranchSelectLayout(width: number, height: number) {
    const gap = 28;
    const cardW = Math.min(296, (width - 64) / 2);
    const cardH = Math.min(314, Math.max(268, Math.round(height * 0.44)));
    const totalW = cardW * 2 + gap;
    const startX = width / 2 - totalW / 2;
    const startY = Math.max(136, Math.round(height * 0.24));
    return { cardW, cardH, gap, totalW, startX, startY };
  }

  public getChestModalLayout(width: number, height: number) {
    const cardW = Math.min(392, width - 40);
    const cardH = 304;
    const cardX = width / 2 - cardW / 2;
    const cardY = Math.max(88, Math.round(height * 0.2));
    const btnW = 204;
    const btnH = 46;
    const btnX = width / 2 - btnW / 2;
    const btnY = cardY + cardH + 24;
    return { cardW, cardH, cardX, cardY, btnW, btnH, btnX, btnY };
  }

  public getGameOverLayout(width: number, height: number) {
    const boxW = Math.min(564, width - 40);
    const boxH = 362;
    const boxX = width / 2 - boxW / 2;
    const boxY = Math.max(96, Math.round(height * 0.18));
    const btnW = 220;
    const btnH = 48;
    const btnX = width / 2 - btnW / 2;
    const btnY = boxY + boxH + 24;
    return { boxW, boxH, boxX, boxY, btnW, btnH, btnX, btnY };
  }

  public getSettingsLayout(width: number, height: number, isInGame: boolean) {
    const panelW = Math.min(424, width - 32);
    const panelH = isInGame ? 378 : 322;
    const panelX = width / 2 - panelW / 2;
    const panelY = height / 2 - panelH / 2;
    const row1Y = panelY + 94;
    const langBtnW = 94;
    const langBtnH = 34;
    const zhBtnX = panelX + panelW - 28 - langBtnW * 2 - 10;
    const enBtnX = panelX + panelW - 28 - langBtnW;
    const langBtnY = row1Y - langBtnH / 2;
    const row2Y = panelY + 144;
    const audioBtnW = langBtnW * 2 + 10;
    const audioBtnH = 34;
    const audioBtnX = zhBtnX;
    const audioBtnY = row2Y - audioBtnH / 2;
    const row3Y = panelY + 194;
    const bgmBtnY = row3Y - audioBtnH / 2;
    const actionBtnW = panelW - 56;
    const actionBtnH = 42;
    const actionBtnX = panelX + 28;
    const resumeBtnY = panelY + 246;
    const quitBtnY = panelY + 300;
    return {
      panelW,
      panelH,
      panelX,
      panelY,
      row1Y,
      langBtnW,
      langBtnH,
      zhBtnX,
      enBtnX,
      langBtnY,
      row2Y,
      audioBtnW,
      audioBtnH,
      audioBtnX,
      audioBtnY,
      row3Y,
      bgmBtnY,
      actionBtnW,
      actionBtnH,
      actionBtnX,
      resumeBtnY,
      quitBtnY
    };
  }

  // --- Shared Gothic Ornate Control Helpers ---

  private drawGothicButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    accentColor = '#d97706',
    isActive = false,
    isHovered = false,
    disabled = false,
    fontSize = 12
  ): void {
    ctx.save();
    const lift = isHovered && !disabled ? -1.5 : 0;
    const by = y + lift;

    drawGothicTablet(ctx, x, by, w, h, {
      topColor: disabled ? '#0a080f' : isActive ? '#34111d' : isHovered ? '#29152b' : '#180e20',
      bottomColor: disabled ? '#050408' : '#07040b',
      borderOuter: disabled ? '#272030' : isHovered ? '#fbbf24' : '#573b26',
      borderInner: disabled ? '#3b3348' : isActive || isHovered ? accentColor : 'rgba(217, 119, 6, 0.58)',
      accentColor: disabled ? '#475569' : accentColor,
      cornerSize: Math.min(11, Math.floor(h * 0.3)),
      chamfer: 6,
      showDamask: !disabled,
      glowAlpha: isHovered && !disabled ? 0.18 : 0
    });

    ctx.fillStyle = disabled ? '#52525b' : isHovered || isActive ? '#fef3c7' : '#e7d5b8';
    ctx.font = `700 ${fontSize}px ${GOTHIC_DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, by + h / 2 + 0.5, w - 18);
    ctx.restore();
  }

  private drawUtilityButtons(ctx: CanvasRenderingContext2D, width: number, _isTitleScreen: boolean): void {
    const { topBtnY, btnSize, settingsBtnX, soundBtnX } = this.getTopUtilityButtonsLayout(width);
    const isSettingsHov = this.hoveredButton === 'open_settings' || this.hoveredButton === 'settings';
    const isSoundHov = this.hoveredButton === 'sound';

    // Settings octagonal reliquary button
    drawGothicTablet(ctx, settingsBtnX, topBtnY, btnSize, btnSize, {
      topColor: isSettingsHov ? '#2a1630' : '#160d1f',
      bottomColor: '#060309',
      borderOuter: isSettingsHov ? '#fbbf24' : '#523a28',
      borderInner: isSettingsHov ? '#fde047' : 'rgba(217, 119, 6, 0.65)',
      accentColor: '#d97706',
      cornerSize: 6,
      chamfer: 7,
      showDamask: false
    });
    this.renderGearIcon(ctx, settingsBtnX + btnSize / 2, topBtnY + btnSize / 2, isSettingsHov ? '#fef08a' : '#e7d5b8');

    // Audio toggle reliquary button
    drawGothicTablet(ctx, soundBtnX, topBtnY, btnSize, btnSize, {
      topColor: isSoundHov ? '#2a1630' : '#160d1f',
      bottomColor: '#060309',
      borderOuter: this.sound.isMuted ? '#991b1b' : isSoundHov ? '#fbbf24' : '#523a28',
      borderInner: this.sound.isMuted ? '#dc2626' : isSoundHov ? '#fde047' : 'rgba(217, 119, 6, 0.65)',
      accentColor: this.sound.isMuted ? '#ef4444' : '#fbbf24',
      cornerSize: 6,
      chamfer: 7,
      showDamask: false
    });

    ctx.save();
    ctx.translate(soundBtnX + btnSize / 2, topBtnY + btnSize / 2);
    ctx.strokeStyle = this.sound.isMuted ? '#78716c' : '#fef3c7';
    ctx.fillStyle = this.sound.isMuted ? '#78716c' : '#fef3c7';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-5, -2.5);
    ctx.lineTo(-2, -2.5);
    ctx.lineTo(2.5, -6);
    ctx.lineTo(2.5, 6);
    ctx.lineTo(-2, 2.5);
    ctx.lineTo(-5, 2.5);
    ctx.closePath();
    ctx.fill();
    if (this.sound.isMuted) {
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(6, 6);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(2.5, 0, 3.8, -0.7, 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- HUD Rendering (Dark Gothic Maximalist Reliquary Framing) ---
  public renderHUD(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: Player,
    elapsedSeconds: number,
    isFrozen: boolean,
    hasBoss?: boolean,
    companionSystem?: CompanionSystem,
    activeBoss?: Enemy | null
  ): void {
    ctx.save();

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const uiDt = this.lastFrameTimestamp > 0 ? Math.min(0.05, (nowMs - this.lastFrameTimestamp) / 1000) : 0.016;
    this.lastFrameTimestamp = nowMs;

    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer = Math.max(0, this.bossWarningTimer - uiDt);
    }
    if (this.bossSlainShatterTimer > 0) {
      this.bossSlainShatterTimer = Math.max(0, this.bossSlainShatterTimer - uiDt);
    }

    if (activeBoss && activeBoss.active) {
      this.lastKnownBossVariant = activeBoss.bossVariant;
      this.lastKnownBossPhase = activeBoss.bossPhase;
      this.lastKnownBossMaxHp = Math.max(1, activeBoss.maxHp);
      this.lastKnownBossHp = Math.max(0, activeBoss.hp);
      this.lastKnownBossHpRatio = Math.max(0, Math.min(1, activeBoss.hp / this.lastKnownBossMaxHp));
      this.lastKnownBossLagRatio = Math.max(
        this.lastKnownBossHpRatio,
        Math.min(1, activeBoss.displayLagHp / this.lastKnownBossMaxHp)
      );
    }

    const targetSlide = hasBoss || this.bossSlainShatterTimer > 0 ? 1 : 0;
    const lerpSpeed = targetSlide > this.bossHudSlide ? 7.5 : 5.2;
    this.bossHudSlide += (targetSlide - this.bossHudSlide) * Math.min(1, uiDt * lerpSpeed);
    if (Math.abs(targetSlide - this.bossHudSlide) < 0.002) {
      this.bossHudSlide = targetSlide;
    }

    // 1. Top Experience Conduit (Wrought-Iron & Ethereal Amethyst-Sapphire Glass with Brass Notches)
    const xpPercent = Math.max(0, Math.min(1, player.xp / player.nextLevelXp));
    const xpH = 12;
    ctx.fillStyle = '#040207';
    ctx.fillRect(0, 0, width, xpH);

    if (xpPercent > 0) {
      const xpGrad = ctx.createLinearGradient(0, 0, 0, xpH);
      xpGrad.addColorStop(0, '#c4b5fd');
      xpGrad.addColorStop(0.35, '#38bdf8');
      xpGrad.addColorStop(0.75, '#4338ca');
      xpGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = xpGrad;
      ctx.fillRect(0, 1, width * xpPercent, xpH - 2);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
      ctx.fillRect(0, 1, width * xpPercent, 2);

      // Luminous liquid meniscus tip
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(Math.max(0, width * xpPercent - 2), 1, 2, xpH - 2);
    }

    // Brass decile graduation filigree along XP bar
    for (let d = 1; d < 10; d++) {
      const tickX = (width * d) / 10;
      ctx.fillStyle = d === 5 ? '#fbbf24' : 'rgba(217, 119, 6, 0.45)';
      ctx.fillRect(tickX - 0.5, 1, 1, xpH - 2);
    }

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, xpH);
    ctx.lineTo(width, xpH);
    ctx.stroke();

    // 2. Top-Center Sculpted Gothic Chronometer Cartouche (Kills · Time · Gold)
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = Math.floor(elapsedSeconds % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const chronoW = 236;
    const chronoH = 34;
    const chronoX = width / 2 - chronoW / 2;
    const chronoY = 15;
    drawGothicCrestBanner(ctx, width / 2, chronoY + chronoH / 2, chronoW, chronoH, '#d97706', '#dc2626');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 18px ${GOTHIC_DISPLAY_FONT}`;
    ctx.fillStyle = '#fef3c7';
    ctx.fillText(timeStr, width / 2, chronoY + chronoH / 2 + 1);

    // Kills (Crimson Skull Diamond) on left
    ctx.font = `600 11px ${GOTHIC_MONO_FONT}`;
    ctx.fillStyle = '#fca5a5';
    ctx.textAlign = 'right';
    ctx.fillText(`☠ ${player.kills}`, width / 2 - 44, chronoY + chronoH / 2 + 1);

    // Gold (Gilded Sovereign Diamond) on right
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'left';
    ctx.fillText(`✦ ${player.gold}G`, width / 2 + 44, chronoY + chronoH / 2 + 1);

    // 3. Top-Left 8-Spiked Gothic Astrolabe Medallion & Crimson Vitality Phial
    const medX = 42;
    const medY = 52;
    const medR = 23;

    // 8 Compass Finial Spikes around portrait medallion
    ctx.save();
    ctx.translate(medX, medY);
    for (let s = 0; s < 8; s++) {
      const ang = (s * Math.PI) / 4;
      const spikeLen = s % 2 === 0 ? medR + 7 : medR + 4.5;
      ctx.fillStyle = s % 2 === 0 ? '#d97706' : '#573b26';
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang - 0.14) * (medR - 1), Math.sin(ang - 0.14) * (medR - 1));
      ctx.lineTo(Math.cos(ang) * spikeLen, Math.sin(ang) * spikeLen);
      ctx.lineTo(Math.cos(ang + 0.14) * (medR - 1), Math.sin(ang + 0.14) * (medR - 1));
      ctx.closePath();
      ctx.fill();
    }

    // Outer Dark Iron & Antiqued Gold Medallion Ring
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(1, 3, medR + 2.5, 0, Math.PI * 2);
    ctx.fill();

    const ringGrad = ctx.createLinearGradient(0, -medR, 0, medR);
    ringGrad.addColorStop(0, '#92400e');
    ringGrad.addColorStop(0.5, '#291a16');
    ringGrad.addColorStop(1, '#09060c');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(0, 0, medR + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Inner Velvet Recessed Well
    const wellGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, medR - 1);
    wellGrad.addColorStop(0, '#2a0c18');
    wellGrad.addColorStop(1, '#050208');
    ctx.fillStyle = wellGrad;
    ctx.beginPath();
    ctx.arc(0, 0, medR - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw Hero Sprite inside Medallion
    SpriteRenderer.getInstance().drawSprite(
      ctx,
      `hero_${player.characterId}`,
      0,
      medX,
      medY - 1,
      36,
      36,
      1,
      false
    );

    // Ornate Brass Level Scroll Pill beneath Medallion
    const lvlW = 40;
    const lvlH = 14;
    drawGothicTablet(ctx, medX - lvlW / 2, medY + medR - 5, lvlW, lvlH, {
      topColor: '#29152b',
      bottomColor: '#07040b',
      borderOuter: '#78350f',
      borderInner: '#fbbf24',
      accentColor: '#dc2626',
      cornerSize: 0,
      chamfer: 4,
      showDamask: false
    });
    ctx.fillStyle = '#fef3c7';
    ctx.font = `700 9px ${GOTHIC_DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LV ${player.level}`, medX, medY + medR + 2.5);

    // Active Lv.5 Ascendancy Sigil beside Portrait if evolved
    if (player.selectedBranch) {
      const br = getBranchById(player.characterId, player.selectedBranch);
      if (br) {
        drawWaxSeal(ctx, medX - medR + 2, medY - medR + 4, 8, '#1a0c1c', br.color, '✦');
      }
    }

    // 3b. Crimson Vitality Phial (Right of Medallion using shared Gothic Gauge)
    const hpBarW = 174;
    const hpBarH = 15;
    const hpX = 76;
    const hpY = 26;
    const hpPct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    const hpColors =
      hpPct > 0.5
        ? { top: '#fca5a5', mid: '#dc2626', bot: '#450a0a', frame: '#d97706' }
        : hpPct > 0.25
          ? { top: '#fef08a', mid: '#d97706', bot: '#451a03', frame: '#f59e0b' }
          : { top: '#fecaca', mid: '#b91c1c', bot: '#280404', frame: '#ef4444' };

    const lowHpPulse = hpPct <= 0.25 ? 0.5 + 0.5 * Math.sin(nowMs * 0.01) : 0;
    drawGothicGaugeBar(ctx, {
      x: hpX,
      y: hpY,
      w: hpBarW,
      h: hpBarH,
      ratio: hpPct,
      fillTop: hpColors.top,
      fillMid: hpColors.mid,
      fillBot: hpColors.bot,
      frameGold: hpColors.frame,
      segments: 5,
      endCaps: true,
      pulse: lowHpPulse
    });

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.font = `700 9.5px ${GOTHIC_MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hpText = `${Math.round(player.hp)} / ${player.maxHp}`;
    ctx.strokeText(hpText, hpX + hpBarW / 2, hpY + hpBarH / 2 + 0.5);
    ctx.fillStyle = '#fef3c7';
    ctx.fillText(hpText, hpX + hpBarW / 2, hpY + hpBarH / 2 + 0.5);

    // Weapon & Passive Inventory Leaded Sockets
    const slotSize = 25;
    const slotMargin = 4;
    for (let i = 0; i < player.maxWeaponSlots; i++) {
      const sx = hpX + i * (slotSize + slotMargin);
      const sy = hpY + 21;
      this.renderSlot(ctx, sx, sy, slotSize, player.weapons[i]);
    }

    const passiveKeys = Array.from(player.passives.entries());
    for (let i = 0; i < player.maxPassiveSlots; i++) {
      const sx = hpX + i * (slotSize + slotMargin);
      const sy = hpY + 21 + slotSize + slotMargin;
      this.renderPassiveSlot(ctx, sx, sy, slotSize, passiveKeys[i]);
    }

    // 3c. Heraldic Build Bond Wax-Seals
    if (companionSystem && companionSystem.activeBonds.length > 0) {
      const activeOnly = companionSystem.activeBonds.filter((b) => b.tier > 0);
      const bondY = hpY + 21 + (slotSize + slotMargin) * 2 + 13;
      for (let i = 0; i < activeOnly.length; i++) {
        const bond = activeOnly[i];
        const meta = TAG_METADATA[bond.tag];
        const gx = hpX + 11 + i * 26;
        drawWaxSeal(
          ctx,
          gx,
          bondY,
          9.5,
          bond.tier === 2 ? '#581c87' : '#1e1026',
          meta.color,
          bond.tier === 2 ? 'IV' : 'II'
        );
      }
    }

    // 4. Top-Right Utility Buttons
    this.drawUtilityButtons(ctx, width, false);

    // Frozen Map Frost Border with Gothic Crystalline Glint
    if (isFrozen) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, width, height);
    }

    // 5. Bottom-Center Ornate Gothic Skill Tablets
    this.renderActiveSkillsBar(ctx, width, height, player, companionSystem);

    // 6. Boss Arrival Gothic Eclipse Pulse
    if (this.bossWarningTimer > 0) {
      this.renderBossEclipseLightingPulse(ctx, width, height);
    }

    ctx.restore();
  }

  /**
   * Boss 降临瞬间的哥特猩红蚀变光影（边缘荆棘暗角，保持战场中心 100% 通透）
   */
  private renderBossEclipseLightingPulse(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const totalDur = 1.8;
    const elapsed = totalDur - this.bossWarningTimer;
    const prog = Math.max(0, Math.min(1, elapsed / totalDur));
    const envelope = Math.sin(prog * Math.PI);
    const pulse = 0.65 + Math.sin(elapsed * Math.PI * 3.5) * 0.35;

    ctx.save();
    const vigGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.24,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72
    );
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(0.58, `rgba(28, 4, 14, ${0.42 * envelope * pulse})`);
    vigGrad.addColorStop(0.84, `rgba(105, 10, 20, ${0.62 * envelope * pulse})`);
    vigGrad.addColorStop(1, `rgba(2, 1, 6, ${0.88 * envelope})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);

    // Corner filigree flash on pulse
    ctx.globalAlpha = 0.65 * envelope;
    drawScreenIronFrame(ctx, width, height, '#fbbf24', '#dc2626');
    ctx.restore();
  }

  private renderGearIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.6;

    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 4.5, Math.sin(ang) * 4.5);
      ctx.lineTo(Math.cos(ang) * 7.2, Math.sin(ang) * 7.2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 4.8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#09050e';
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderActiveSkillsBar(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: Player,
    companionSystem?: CompanionSystem
  ): void {
    const { slotW, slotH, gap, startX, y } = getSkillBarLayout(width, height, !!companionSystem);

    const drawSkillPlate = (
      bx: number,
      by: number,
      pct: number,
      ready: boolean,
      accentColor: string,
      iconName: string,
      keyLabel: string,
      subLabel: string
    ) => {
      ctx.save();
      drawGothicTablet(ctx, bx, by, slotW, slotH, {
        topColor: ready ? '#231129' : '#110b16',
        bottomColor: '#050308',
        borderOuter: ready ? '#78350f' : '#2f2238',
        borderInner: ready ? accentColor : 'rgba(148, 163, 184, 0.25)',
        accentColor,
        cornerSize: 6,
        chamfer: 5,
        showDamask: false,
        glowAlpha: ready ? 0.12 : 0
      });

      // Vertical liquid glass recharge progress wash
      if (pct > 0) {
        ctx.save();
        traceChamferedRect(ctx, bx + 2, by + 2, slotW - 4, slotH - 4, 4);
        ctx.clip();
        ctx.fillStyle = ready ? `${accentColor}28` : 'rgba(88, 28, 135, 0.24)';
        ctx.fillRect(bx + 2, by + 2, (slotW - 4) * pct, slotH - 4);
        ctx.restore();
      }

      // Recessed Circular Relic Socket
      ctx.fillStyle = '#040207';
      ctx.beginPath();
      ctx.arc(bx + 19, by + slotH / 2, 11.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ready ? accentColor : '#473652';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      this.renderVectorIcon(ctx, iconName, bx + 19, by + slotH / 2, 16);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ready ? '#fef3c7' : '#9ca3af';
      ctx.font = `700 9.5px ${GOTHIC_BODY_FONT}`;
      ctx.fillText(keyLabel, bx + 36, by + 12, slotW - 42);

      ctx.fillStyle = ready ? accentColor : '#71717a';
      ctx.font = `600 8.5px ${GOTHIC_MONO_FONT}`;
      ctx.fillText(subLabel, bx + 36, by + 24.5, slotW - 42);
      ctx.restore();
    };

    const dashReady = player.dashCooldown <= 0;
    const dashPct = dashReady
      ? 1
      : 1 - Math.min(1, player.dashCooldown / Math.max(0.1, player.maxDashCooldown * player.cooldownMult));
    drawSkillPlate(
      startX,
      y,
      dashPct,
      dashReady,
      '#38bdf8',
      'wings',
      t('幻影冲刺', 'DASH'),
      dashReady ? 'SPACE' : `${player.dashCooldown.toFixed(1)}s`
    );

    const ultReady = player.isUltimateReady();
    const maxUlt = Math.max(15.0, player.maxUltimateCooldown * player.cooldownMult);
    const ultPct = ultReady ? 1 : 1 - Math.min(1, player.ultimateCooldown / maxUlt);
    const ultIconMap: Record<string, string> = {
      antonio: 'cross',
      imelda: 'pentagram',
      gennaro: 'knife',
      arca: 'fire_wand',
      pasqualina: 'lightning_ring',
      mortaccio: 'axe'
    };
    drawSkillPlate(
      startX + slotW + gap,
      y,
      ultPct,
      ultReady,
      '#fbbf24',
      ultIconMap[player.characterId] || 'pentagram',
      t('圣裁奥义', 'ULTIMATE'),
      ultReady ? 'Q / E' : `${Math.ceil(player.ultimateCooldown)}s`
    );

    if (companionSystem) {
      const isAnchored = companionSystem.mode === 'ANCHOR';
      drawSkillPlate(
        startX + (slotW + gap) * 2,
        y,
        1,
        true,
        isAnchored ? '#f43f5e' : '#34d399',
        'attractorb',
        isAnchored ? t('香炉驻留', 'ANCHOR') : t('香炉环绕', 'ORBIT'),
        'F'
      );
    }
  }

  private renderSlot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, weapon?: any): void {
    const isEvo = Boolean(weapon?.isEvolved);
    drawGothicTablet(ctx, x, y, size, size, {
      topColor: isEvo ? '#3a1414' : '#140b1c',
      bottomColor: '#040207',
      borderOuter: weapon ? (isEvo ? '#fbbf24' : '#573b26') : '#291e33',
      borderInner: weapon ? (isEvo ? '#fef08a' : '#d97706') : 'rgba(148, 163, 184, 0.16)',
      accentColor: isEvo ? '#ef4444' : '#d97706',
      cornerSize: 0,
      chamfer: 4,
      showDamask: false
    });

    if (weapon) {
      this.renderVectorIcon(ctx, weapon.iconName, x + size / 2, y + size / 2 - 1.5, size * 0.66);
      for (let lvl = 0; lvl < Math.min(8, weapon.level); lvl++) {
        ctx.fillStyle = isEvo ? '#fde047' : '#f59e0b';
        ctx.fillRect(x + 2.5 + lvl * 2.5, y + size - 3.5, 1.8, 2);
      }
    }
  }

  private renderPassiveSlot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    passiveEntry?: [string, number]
  ): void {
    drawGothicTablet(ctx, x, y, size, size, {
      topColor: passiveEntry ? '#0e1d1c' : '#140b1c',
      bottomColor: '#040207',
      borderOuter: passiveEntry ? '#155e4d' : '#291e33',
      borderInner: passiveEntry ? '#34d399' : 'rgba(148, 163, 184, 0.16)',
      accentColor: '#10b981',
      cornerSize: 0,
      chamfer: 4,
      showDamask: false
    });

    if (passiveEntry) {
      const [id, lvl] = passiveEntry;
      this.renderVectorIcon(ctx, id, x + size / 2, y + size / 2 - 1.5, size * 0.66);
      for (let l = 0; l < Math.min(5, lvl); l++) {
        ctx.fillStyle = '#34d399';
        ctx.fillRect(x + 2.5 + l * 3.8, y + size - 3.5, 2.5, 2);
      }
    }
  }

  // --- Level Up Modal (Illuminated Gothic Grimoire & Evolution/Bond Matrix) ---
  public renderLevelUpModal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: UpgradeOption[],
    selectedIdx: number,
    player?: Player,
    companionSystem?: CompanionSystem
  ): void {
    ctx.save();
    const timeSec = Date.now() * 0.001;
    const layout = this.getLevelUpLayout(width, height, options.length, !!player);

    // 1. Cathedral Vignette & Rotating Stained-Glass Rose Window Backdrop
    ctx.fillStyle = 'rgba(4, 2, 8, 0.88)';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.globalAlpha = 0.72;
    drawCathedralBackdrop(ctx, width, height, timeSec, '#b91c1c', '#6d28d9');
    ctx.restore();
    drawRoseWindowMandala(ctx, width / 2, height * 0.45, Math.min(width, height) * 0.34, timeSec * 0.06, '#dc2626', '#d97706', 0.24);
    drawScreenIronFrame(ctx, width, height, 'rgba(217, 119, 6, 0.55)', '#dc2626');

    // 2. Winged Gothic Grimoire Crest Banner
    drawGothicCrestBanner(
      ctx,
      width / 2,
      layout.crestY + layout.crestH / 2,
      layout.crestW,
      layout.crestH,
      '#fbbf24',
      '#dc2626'
    );
    ctx.fillStyle = '#fef3c7';
    ctx.font = `700 13.5px ${GOTHIC_DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('秘典抉择 · 赐福圣物', 'GRIMOIRE · CHOOSE BLESSING'), width / 2, layout.crestY + layout.crestH / 2 + 1);

    // 3. Current Reliquary Loadout Strip (Equipped Weapons, Passives & Bond Count)
    if (player) {
      drawGothicTablet(ctx, layout.loadoutX, layout.loadoutY, layout.loadoutW, layout.loadoutH, {
        topColor: '#160d1f',
        bottomColor: '#060309',
        borderOuter: '#523a28',
        borderInner: 'rgba(217, 119, 6, 0.5)',
        accentColor: '#d97706',
        cornerSize: 8,
        chamfer: 5,
        showDamask: false
      });

      const miniSize = 24;
      let cursorX = layout.loadoutX + 14;
      const midY = layout.loadoutY + layout.loadoutH / 2;

      ctx.fillStyle = '#a89276';
      ctx.font = `600 9px ${GOTHIC_DISPLAY_FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('武装', 'ARMS'), cursorX, midY);
      cursorX += 32;

      for (let i = 0; i < player.maxWeaponSlots; i++) {
        this.renderSlot(ctx, cursorX, midY - miniSize / 2, miniSize, player.weapons[i]);
        cursorX += miniSize + 4;
      }

      cursorX += 8;
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(t('圣遗', 'RELIC'), cursorX, midY);
      cursorX += 34;

      const pEntries = Array.from(player.passives.entries());
      for (let i = 0; i < player.maxPassiveSlots; i++) {
        this.renderPassiveSlot(ctx, cursorX, midY - miniSize / 2, miniSize, pEntries[i]);
        cursorX += miniSize + 4;
      }

      if (companionSystem) {
        const activeCount = companionSystem.activeBonds.filter((b) => b.tier > 0).length;
        ctx.textAlign = 'right';
        ctx.fillStyle = activeCount > 0 ? '#fde047' : '#78716c';
        ctx.font = `600 10px ${GOTHIC_BODY_FONT}`;
        ctx.fillText(
          t(`✦ 羁绊共鸣: ${activeCount}`, `✦ BONDS: ${activeCount}`),
          layout.loadoutX + layout.loadoutW - 14,
          midY
        );
      }
    }

    // 4. Illuminated Gothic Upgrade Cards
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const cy = layout.startY + i * (layout.cardHeight + layout.cardGap);
      const isHovered = i === selectedIdx || i === this.hoveredUpgradeIndex;
      this.renderUpgradeCard(
        ctx,
        layout.cardX,
        cy,
        layout.cardWidth,
        layout.cardHeight,
        opt,
        i + 1,
        isHovered,
        player,
        companionSystem
      );
    }

    // 5. Ornate Meta Control Seals (REROLL [R], SKIP [S], BANISH [B])
    if (player) {
      const buttons = [
        {
          id: 'reroll',
          label: `${t('重掷', 'REROLL')} ${player.rerollsRemaining} [R]`,
          active: player.rerollsRemaining > 0,
          x: layout.btnStartX,
          accent: '#38bdf8'
        },
        {
          id: 'skip',
          label: `${t('跳过', 'SKIP')} ${player.skipsRemaining} [S]`,
          active: player.skipsRemaining > 0,
          x: layout.btnStartX + layout.btnW + layout.btnGap,
          accent: '#34d399'
        },
        {
          id: 'banish',
          label: `${t('放逐', 'BANISH')} ${player.banishesRemaining} [B]`,
          active: player.banishesRemaining > 0,
          x: layout.btnStartX + (layout.btnW + layout.btnGap) * 2,
          accent: '#ef4444'
        }
      ];

      for (const b of buttons) {
        this.drawGothicButton(
          ctx,
          b.x,
          layout.bottomY,
          layout.btnW,
          layout.btnH,
          b.label,
          b.accent,
          false,
          this.hoveredButton === b.id,
          !b.active,
          11
        );
      }
    }

    ctx.restore();
  }

  private getEvolutionHint(opt: UpgradeOption, player?: Player): { text: string; ready: boolean } | null {
    if (opt.type === 'EVOLUTION') {
      return { text: t('✦ 终极超武', '✦ EVOLVED'), ready: true };
    }
    if (opt.type === 'WEAPON') {
      const wDef = ALL_WEAPON_DEFINITIONS[opt.id];
      if (!wDef) return null;
      const pName = getPassiveDisplayName(wDef.evolutionPassive);
      const hasPassive = Boolean(player?.passives.has(wDef.evolutionPassive));
      return {
        text: hasPassive ? t(`✦ 可觉醒超武(${pName})`, `✦ EVO READY (${pName})`) : t(`✧ 进化搭档: ${pName}`, `✧ EVO: ${pName}`),
        ready: hasPassive
      };
    }
    if (opt.type === 'PASSIVE') {
      const matchingWeapons = Object.values(ALL_WEAPON_DEFINITIONS).filter((w) => w.evolutionPassive === opt.id);
      if (matchingWeapons.length === 0) return null;
      const owned = matchingWeapons.find((w) => player?.weapons.some((pw) => pw.id === w.id));
      const target = owned || matchingWeapons[0];
      const wName = getWeaponDisplayName(target.id, false);
      return {
        text: owned ? t(`✦ 助燃进化: ${wName}`, `✦ EVOLVES ${wName}`) : t(`✧ 联动武器: ${wName}`, `✧ PAIR: ${wName}`),
        ready: Boolean(owned)
      };
    }
    return null;
  }

  private renderUpgradeCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    opt: UpgradeOption,
    keyNum: number,
    isHovered: boolean,
    player?: Player,
    companionSystem?: CompanionSystem
  ): void {
    ctx.save();
    const liftY = isHovered ? -2.5 : 0;
    const cy = y + liftY;
    const isEvo = opt.type === 'EVOLUTION';

    // 1. Ornate Gothic Damask Relic Tablet
    drawGothicTablet(ctx, x, cy, w, h, {
      topColor: isEvo ? '#3a111a' : isHovered ? '#2a152e' : '#160d1f',
      bottomColor: '#050308',
      borderOuter: isEvo ? '#fbbf24' : isHovered ? '#d97706' : '#4a3228',
      borderInner: isEvo ? '#fde047' : opt.isRecommended ? '#fbbf24' : isHovered ? '#f59e0b' : 'rgba(217, 119, 6, 0.45)',
      accentColor: isEvo ? '#ef4444' : opt.isRecommended ? '#fbbf24' : '#dc2626',
      cornerSize: 12,
      chamfer: 7,
      showDamask: true,
      glowAlpha: isEvo ? 0.22 : isHovered ? 0.16 : 0
    });

    // 2. Crimson/Gold Wax Seal Key Number
    drawWaxSeal(
      ctx,
      x + 25,
      cy + h / 2,
      11.5,
      isHovered ? '#b91c1c' : '#3a1520',
      isHovered ? '#fef08a' : '#d97706',
      `${keyNum}`
    );

    // 3. Pointed Cathedral Arch Niche for Relic Icon
    const nicheW = 46;
    const nicheH = 54;
    const nicheCx = x + 68;
    const nicheTopY = cy + (h - nicheH) / 2;
    drawPointedArchNiche(
      ctx,
      nicheCx,
      nicheTopY,
      nicheW,
      nicheH,
      isEvo || isHovered ? '#fbbf24' : '#78350f',
      isEvo ? '#4c0d19' : '#261028',
      '#050308'
    );
    this.renderVectorIcon(ctx, opt.iconName, nicheCx, nicheTopY + nicheH * 0.56, 32);

    // 4. Title & Gothic Level / Recommendation Badges
    const textStartX = x + 104;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isEvo ? '#fef08a' : '#fef3c7';
    ctx.font = `700 15px ${GOTHIC_DISPLAY_FONT}`;
    ctx.fillText(opt.name, textStartX, cy + 14);

    const isNew = opt.levelText === 'NEW!';
    const nameWidth = ctx.measureText(opt.name).width;
    let badgeCursorX = textStartX + nameWidth + 10;
    const badgeY = cy + 14;

    const lvlLabel = isEvo ? t('超武', 'EVO') : isNew ? t('新赐福', 'NEW') : opt.levelText;
    const lvlBg = isEvo ? 'rgba(220, 38, 38, 0.25)' : isNew ? 'rgba(16, 185, 129, 0.22)' : 'rgba(56, 189, 248, 0.18)';
    const lvlCol = isEvo ? '#fda4af' : isNew ? '#6ee7b7' : '#7dd3fc';
    ctx.fillStyle = lvlBg;
    traceChamferedRect(ctx, badgeCursorX, badgeY, 46, 17, 3);
    ctx.fill();
    ctx.strokeStyle = lvlCol;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = lvlCol;
    ctx.font = `700 9px ${GOTHIC_DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lvlLabel, badgeCursorX + 23, badgeY + 9);
    badgeCursorX += 52;

    if (opt.isRecommended) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
      traceChamferedRect(ctx, badgeCursorX, badgeY, 54, 17, 3);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.fillText(t('★ 契合', '★ FIT'), badgeCursorX + 27, badgeY + 9);
    }

    // 5. Faceted Tag Gems on Top-Right
    if (opt.tags && opt.tags.length > 0) {
      let gemX = x + w - 20;
      const gemY = cy + 23;
      for (let tIdx = opt.tags.length - 1; tIdx >= 0; tIdx--) {
        const tag = opt.tags[tIdx];
        const meta = TAG_METADATA[tag];
        if (!meta) continue;
        const bondCount = companionSystem?.tagCounts.get(tag) || 0;

        ctx.fillStyle = '#07040b';
        ctx.beginPath();
        ctx.arc(gemX, gemY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = bondCount >= 1 ? '#fbbf24' : meta.color;
        ctx.lineWidth = bondCount >= 1 ? 1.4 : 1;
        ctx.stroke();

        ctx.fillStyle = meta.color;
        ctx.beginPath();
        ctx.moveTo(gemX, gemY - 4);
        ctx.lineTo(gemX + 4, gemY);
        ctx.lineTo(gemX, gemY + 4);
        ctx.lineTo(gemX - 4, gemY);
        ctx.closePath();
        ctx.fill();

        gemX -= 20;
      }
    }

    // 6. Description + Evolution / Bond Synergy Annotation
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#d6c7b2';
    ctx.font = `400 11.5px ${GOTHIC_BODY_FONT}`;
    ctx.fillText(opt.description, textStartX, cy + 40, w - 122);

    const evoHint = this.getEvolutionHint(opt, player);
    if (evoHint) {
      ctx.fillStyle = evoHint.ready ? '#fde047' : '#a89276';
      ctx.font = `600 10px ${GOTHIC_BODY_FONT}`;
      ctx.fillText(evoHint.text, textStartX, cy + h - 22, w - 122);
    }

    ctx.restore();
  }

  // --- Boss Chest Modal (Gothic Stained-Glass Reliquary Pedestal) ---
  public renderBossChestModal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    reward: UpgradeOption | null
  ): void {
    ctx.save();
    const timeSec = Date.now() * 0.001;
    const layout = this.getChestModalLayout(width, height);

    ctx.fillStyle = 'rgba(3, 1, 7, 0.9)';
    ctx.fillRect(0, 0, width, height);
    drawRoseWindowMandala(
      ctx,
      width / 2,
      layout.cardY + layout.cardH * 0.45,
      Math.min(width, height) * 0.36,
      this.chestOpenProgress * 0.8 + timeSec * 0.08,
      '#fbbf24',
      '#dc2626',
      0.42
    );
    drawScreenIronFrame(ctx, width, height, '#fbbf24', '#dc2626');

    // Ornate Spiked Gothic Pedestal Tablet
    drawGothicTablet(ctx, layout.cardX, layout.cardY, layout.cardW, layout.cardH, {
      topColor: '#281123',
      bottomColor: '#06030a',
      borderOuter: '#78350f',
      borderInner: '#fbbf24',
      accentColor: '#dc2626',
      cornerSize: 18,
      chamfer: 10,
      showSpikes: true,
      showDamask: true,
      glowAlpha: 0.2
    });

    ctx.fillStyle = '#fbbf24';
    ctx.font = `700 11.5px ${GOTHIC_DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('圣物秘匣 · 王座赐福', 'RELIQUARY REWARD'), width / 2, layout.cardY + 28);
    drawGothicDivider(ctx, width / 2, layout.cardY + 42, layout.cardW * 0.34, '#d97706', '#dc2626');

    if (reward) {
      const isEvo = reward.type === 'EVOLUTION';
      ctx.fillStyle = isEvo ? '#fda4af' : '#7dd3fc';
      ctx.font = `700 11px ${GOTHIC_DISPLAY_FONT}`;
      ctx.fillText(isEvo ? t('✦ 传奇神兵进化 ✦', '✦ WEAPON EVOLVED ✦') : t('✦ 圣器祝福提升 ✦', '✦ RELIC BLESSED ✦'), width / 2, layout.cardY + 58);

      const archW = 86;
      const archH = 98;
      const archTopY = layout.cardY + 72;
      drawPointedArchNiche(
        ctx,
        width / 2,
        archTopY,
        archW,
        archH,
        isEvo ? '#fbbf24' : '#d97706',
        isEvo ? '#4c0d19' : '#1f1030',
        '#050308'
      );
      this.renderVectorIcon(ctx, reward.iconName, width / 2, archTopY + archH * 0.56, 54);

      ctx.fillStyle = '#fef3c7';
      ctx.font = `700 18px ${GOTHIC_DISPLAY_FONT}`;
      ctx.fillText(reward.name, width / 2, layout.cardY + 194);

      ctx.fillStyle = '#d6c7b2';
      ctx.font = `400 12px ${GOTHIC_BODY_FONT}`;
      ctx.textBaseline = 'top';
      this.wrapText(ctx, reward.description, layout.cardX + 28, layout.cardY + 218, layout.cardW - 56, 17);
    } else {
      ctx.fillStyle = '#fde047';
      ctx.font = `700 22px ${GOTHIC_DISPLAY_FONT}`;
      ctx.fillText(t('✦ +250 圣所金币 ✦', '✦ +250 GOLD ✦'), width / 2, layout.cardY + 155);
    }

    this.drawGothicButton(
      ctx,
      layout.btnX,
      layout.btnY,
      layout.btnW,
      layout.btnH,
      t('收下圣物 [空格]', 'CLAIM RELIC [SPACE]'),
      '#fbbf24',
      true,
      this.hoveredButton === 'claim',
      false,
      12.5
    );

    ctx.restore();
  }

  // --- Game Over Screen (Gothic Requiem Tomb Chronicle & DPS Gauges) ---
  public renderGameOver(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: Player
  ): void {
    ctx.save();
    const timeSec = Date.now() * 0.001;
    const layout = this.getGameOverLayout(width, height);

    drawCathedralBackdrop(ctx, width, height, timeSec, '#991b1b', '#3b0764');
    ctx.fillStyle = 'rgba(2, 1, 5, 0.55)';
    ctx.fillRect(0, 0, width, height);
    drawScreenIronFrame(ctx, width, height, '#d97706', '#dc2626');

    // Monumental Requiem Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef3c7';
    ctx.font = `900 32px ${GOTHIC_DISPLAY_FONT}`;
    ctx.fillText(t('安 魂 终 幕', 'RUN ENDED'), width / 2, layout.boxY - 46);
    drawGothicDivider(ctx, width / 2, layout.boxY - 22, 130, '#d97706', '#dc2626');

    // Gothic Tomb Chronicle Tablet
    drawGothicTablet(ctx, layout.boxX, layout.boxY, layout.boxW, layout.boxH, {
      topColor: '#1f0e1d',
      bottomColor: '#050208',
      borderOuter: '#78350f',
      borderInner: '#d97706',
      accentColor: '#dc2626',
      cornerSize: 18,
      chamfer: 10,
      showSpikes: true,
      showDamask: true,
      glowAlpha: 0.14
    });

    // 4 Pointed-Arch Metric Shrines
    const mins = Math.floor(player.timeSurvived / 60);
    const secs = Math.floor(player.timeSurvived % 60);
    const metrics = [
      { label: t('存活时间', 'SURVIVED'), val: `${mins}m ${secs}s`, color: '#fef3c7' },
      { label: t('斩杀魔物', 'SLAIN'), val: `${player.kills}`, color: '#fda4af' },
      { label: t('最终等级', 'LEVEL'), val: `LV ${player.level}`, color: '#7dd3fc' },
      { label: t('掠夺金币', 'GOLD'), val: `+${player.gold}`, color: '#fde047' }
    ];

    const tileW = (layout.boxW - 48 - 30) / 4;
    const tileH = 60;
    const tileY = layout.boxY + 20;

    for (let m = 0; m < metrics.length; m++) {
      const tx = layout.boxX + 24 + m * (tileW + 10);
      drawPointedArchNiche(ctx, tx + tileW / 2, tileY, tileW, tileH, '#78350f', '#1c0c19', '#050308');

      ctx.fillStyle = '#a89276';
      ctx.font = `600 9.5px ${GOTHIC_BODY_FONT}`;
      ctx.fillText(metrics[m].label, tx + tileW / 2, tileY + 22);

      ctx.fillStyle = metrics[m].color;
      ctx.font = `700 13.5px ${GOTHIC_MONO_FONT}`;
      ctx.fillText(metrics[m].val, tx + tileW / 2, tileY + 44);
    }

    drawGothicDivider(ctx, width / 2, layout.boxY + 95, layout.boxW * 0.4, '#92400e', '#dc2626');

    ctx.textAlign = 'left';
    ctx.fillStyle = '#d97706';
    ctx.font = `700 11px ${GOTHIC_DISPLAY_FONT}`;
    ctx.fillText(t('秘器杀伤录 · DAMAGE BREAKDOWN', 'DAMAGE BREAKDOWN'), layout.boxX + 24, layout.boxY + 112);

    let maxWeaponDmg = 1;
    for (const wep of player.weapons) {
      if (wep.totalDamageDealt > maxWeaponDmg) maxWeaponDmg = wep.totalDamageDealt;
    }

    for (let w = 0; w < player.weapons.length; w++) {
      const wep = player.weapons[w];
      const wy = layout.boxY + 132 + w * 35;
      const ratio = Math.max(0.02, Math.min(1, wep.totalDamageDealt / maxWeaponDmg));

      this.renderVectorIcon(ctx, wep.iconName, layout.boxX + 34, wy + 10, 20);

      ctx.fillStyle = '#fef3c7';
      ctx.font = `600 12px ${GOTHIC_BODY_FONT}`;
      ctx.textAlign = 'left';
      const wepDisplayName = getWeaponDisplayName(wep.id, wep.isEvolved);
      ctx.fillText(`${wepDisplayName} · LV ${wep.level}`, layout.boxX + 54, wy + 7);

      ctx.fillStyle = '#d6c7b2';
      ctx.font = `600 10px ${GOTHIC_MONO_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${wep.totalDamageDealt} ${t('伤害', 'DMG')} (${wep.totalKills})`, layout.boxX + layout.boxW - 24, wy + 7);

      drawGothicGaugeBar(ctx, {
        x: layout.boxX + 54,
        y: wy + 16,
        w: layout.boxW - 80,
        h: 6,
        ratio,
        fillTop: wep.isEvolved ? '#fef08a' : '#fca5a5',
        fillMid: wep.isEvolved ? '#d97706' : '#dc2626',
        fillBot: '#450a0a',
        frameGold: '#78350f',
        segments: 4,
        endCaps: false
      });
    }

    this.drawGothicButton(
      ctx,
      layout.btnX,
      layout.btnY,
      layout.btnW,
      layout.btnH,
      t('重返圣殿 · 再次出征', 'PLAY AGAIN'),
      '#fbbf24',
      true,
      this.hoveredButton === 'restart',
      false,
      13
    );

    ctx.restore();
  }

  // --- Title & Character Select Screen (Dark Gothic Cathedral Maximalism) ---
  public renderCharacterSelect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    selectedCharId: string
  ): void {
    ctx.save();
    const timeSec = Date.now() * 0.001;
    const layout = this.getCharSelectLayout(width, height);

    // 1. Monumental Cathedral Rose-Window & Candelabra Backdrop
    drawCathedralBackdrop(ctx, width, height, timeSec, '#dc2626', '#7c3aed');
    drawScreenIronFrame(ctx, width, height, 'rgba(217, 119, 6, 0.58)', '#dc2626');

    // Top-right octagonal Gothic Settings & Audio Buttons
    this.drawUtilityButtons(ctx, width, true);

    // 2. Crowned Winged Gothic Title Cartouche
    const titleY = Math.max(46, Math.round(height * 0.088));
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${width < 680 ? 28 : 40}px ${GOTHIC_DISPLAY_FONT}`;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillText(t('血 色 圣 果', 'BLOODYBERRY'), width / 2 + 2, titleY + 3);

    const titleGrad = ctx.createLinearGradient(0, titleY - 18, 0, titleY + 18);
    titleGrad.addColorStop(0, '#fef9c3');
    titleGrad.addColorStop(0.5, '#fbbf24');
    titleGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = titleGrad;
    ctx.fillText(t('血 色 圣 果', 'BLOODYBERRY'), width / 2, titleY);
    ctx.restore();

    drawGothicDivider(ctx, width / 2, titleY + 26, Math.min(180, width * 0.22), '#d97706', '#dc2626');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d6c7b2';
    ctx.font = `600 11px ${GOTHIC_DISPLAY_FONT}`;
    ctx.fillText(t('绯 红 圣 所 · 哥 特 深 渊 幸 存 者', 'CRIMSON SANCTUARY · GOTHIC SURVIVOR'), width / 2, titleY + 42);

    // 3. 4 Ornate Gothic Tarot Hero Cards
    for (let i = 0; i < CHARACTERS.length; i++) {
      const char = CHARACTERS[i];
      const cx = layout.startX + i * (layout.cardW + layout.gap);
      const cy = layout.startY;
      const isUnlocked = this.saveManager.isCharacterUnlocked(char.id);
      const isSelected = char.id === selectedCharId;
      const isHovered = i === this.hoveredCharacterIndex;

      this.renderCharacterCard(ctx, cx, cy, layout.cardW, layout.cardH, char, isUnlocked, isSelected, isHovered);
    }

    // 4. Ornate Relic Blade Start Button
    this.drawGothicButton(
      ctx,
      layout.btnX,
      layout.btnY,
      layout.btnW,
      layout.btnH,
      t('✦ 踏 入 绯 红 圣 所 ✦', '✦ ENTER SANCTUARY ✦'),
      '#fbbf24',
      true,
      this.hoveredButton === 'start',
      false,
      14
    );

    // 5. Lifetime Chronicle Bar (SaveManager progression surfaced cleanly)
    const save = this.saveManager.getData();
    const bestM = Math.floor(save.highScoreSeconds / 60);
    const bestS = Math.floor(save.highScoreSeconds % 60);
    const chronY = Math.min(height - 22, layout.btnY + layout.btnH + 22);
    ctx.fillStyle = 'rgba(15, 8, 22, 0.72)';
    const chronW = Math.min(540, width - 48);
    traceChamferedRect(ctx, width / 2 - chronW / 2, chronY - 11, chronW, 22, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.42)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.fillStyle = '#d6c7b2';
    ctx.font = `600 10.5px ${GOTHIC_MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      t(
        `最佳纪录 ${bestM}m${bestS.toString().padStart(2, '0')}s   ·   累计讨伐 ${save.lifetimeKills}   ·   圣库金币 ${save.totalGold}G`,
        `BEST ${bestM}m${bestS.toString().padStart(2, '0')}s   ·   SLAIN ${save.lifetimeKills}   ·   TREASURY ${save.totalGold}G`
      ),
      width / 2,
      chronY + 0.5
    );

    ctx.restore();
  }

  private renderCharacterCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    char: CharacterInfo,
    _isUnlocked: boolean,
    isSelected: boolean,
    isHovered: boolean
  ): void {
    ctx.save();
    const liftY = isSelected ? -5 : isHovered ? -2.5 : 0;
    const cy = y + liftY;

    // 1. Ornate Gothic Damask Tarot Card Slab
    drawGothicTablet(ctx, x, cy, w, h, {
      topColor: isSelected ? '#2c1124' : isHovered ? '#211026' : '#140b1c',
      bottomColor: '#050208',
      borderOuter: isSelected ? '#fbbf24' : isHovered ? '#d97706' : '#4a3228',
      borderInner: isSelected ? '#fef08a' : isHovered ? '#fbbf24' : 'rgba(217, 119, 6, 0.48)',
      accentColor: char.color,
      cornerSize: 14,
      chamfer: 8,
      showSpikes: isSelected,
      showDamask: true,
      glowAlpha: isSelected ? 0.24 : isHovered ? 0.12 : 0
    });

    if (isSelected) {
      drawWaxSeal(ctx, x + w - 18, cy + 20, 10, '#991b1b', '#fbbf24', '✦');
    }

    // 2. Pointed Stained-Glass Cathedral Arch Portrait Niche
    const archW = Math.min(82, Math.round(w * 0.46));
    const archH = Math.min(84, Math.round(h * 0.31));
    const archCx = x + w / 2;
    const archTopY = cy + 16;

    drawPointedArchNiche(
      ctx,
      archCx,
      archTopY,
      archW,
      archH,
      isSelected ? '#fbbf24' : '#78350f',
      `${char.color}44`,
      '#050208'
    );

    const animFrame = Math.floor(Date.now() / 160) % 6;
    SpriteRenderer.getInstance().drawSprite(
      ctx,
      `hero_${char.id}`,
      animFrame,
      archCx,
      archTopY + archH * 0.54,
      54,
      54,
      1,
      false
    );

    // Chained Starting Weapon Bronze Socket
    const wepX = archCx + archW / 2 - 4;
    const wepY = archTopY + archH - 6;
    ctx.fillStyle = '#050308';
    ctx.beginPath();
    ctx.arc(wepX, wepY, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#fbbf24' : '#92400e';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    this.renderVectorIcon(ctx, char.startingWeapon, wepX, wepY, 16);

    const charText = getCharacterText(char.id);

    // 3. Name & Role Crest
    const nameY = archTopY + archH + 17;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isSelected ? '#fef08a' : '#fef3c7';
    ctx.font = `700 ${w < 175 ? 14 : 16}px ${GOTHIC_DISPLAY_FONT}`;
    ctx.fillText(charText.name, archCx, nameY, w - 20);

    const roleLabel = t(char.shortRoleZh, char.shortRoleEn);
    const pillW = Math.min(116, w - 34);
    const pillH = 20;
    const pillY = nameY + 14;
    drawGothicCrestBanner(ctx, archCx, pillY + pillH / 2, pillW, pillH, char.color, '#d97706');
    ctx.fillStyle = '#fef3c7';
    ctx.font = `600 10px ${GOTHIC_BODY_FONT}`;
    ctx.fillText(roleLabel, archCx, pillY + pillH / 2 + 0.5, pillW - 10);

    drawGothicDivider(ctx, archCx, pillY + pillH + 10, w * 0.34, '#78350f', char.color);

    // 4. Twin Pointed-Arch Late Ascendancy Niches
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#a89276';
    ctx.font = `600 9px ${GOTHIC_DISPLAY_FONT}`;
    const branchHeadY = pillY + pillH + 18;
    ctx.fillText(t('Lv.5 命途觉醒双分支', 'LV.5 ASCENDANCY PATHS'), archCx, branchHeadY);

    const bGap = 8;
    const bW = (w - 24 - bGap) / 2;
    const bY = branchHeadY + 14;
    const bH = Math.max(46, cy + h - 14 - bY);
    for (let bi = 0; bi < 2; bi++) {
      const br = char.branches[bi];
      const bx = x + 12 + bi * (bW + bGap);
      drawPointedArchNiche(ctx, bx + bW / 2, bY, bW, bH, `${br.color}99`, '#180c1f', '#050208');

      ctx.fillStyle = br.color;
      ctx.font = `700 9.5px ${GOTHIC_BODY_FONT}`;
      ctx.fillText(t(br.nameZh, br.nameEn.split(' ')[0]), bx + bW / 2, bY + 12, bW - 8);

      ctx.fillStyle = '#d6c7b2';
      ctx.font = `400 8.5px ${GOTHIC_BODY_FONT}`;
      const subTag = t(br.badgeZh.split('·')[1]?.trim() || br.badgeZh, br.badgeEn.split('·')[1]?.trim() || br.badgeEn);
      ctx.fillText(subTag, bx + bW / 2, bY + 28, bW - 8);
    }

    ctx.restore();
  }

  /**
   * 后期命途分化二选一抉择弹窗 (Lv.5 触发：哥特双祭坛抉择)
   */
  public renderBranchSelectModal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    char: CharacterInfo,
    selectedIdx: number
  ): void {
    ctx.save();
    const timeSec = Date.now() * 0.001;
    const layout = this.getBranchSelectLayout(width, height);

    drawCathedralBackdrop(ctx, width, height, timeSec, '#fbbf24', '#7c3aed');
    ctx.fillStyle = 'rgba(3, 1, 7, 0.55)';
    ctx.fillRect(0, 0, width, height);
    drawScreenIronFrame(ctx, width, height, '#fbbf24', '#dc2626');

    // Winged Header Crest
    drawGothicCrestBanner(ctx, width / 2, Math.max(54, height * 0.115), 290, 34, '#fbbf24', '#dc2626');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = `700 11.5px ${GOTHIC_DISPLAY_FONT}`;
    ctx.fillText(t('命途觉醒 · 二选一分化', 'ASCENDANCY · CHOOSE YOUR PATH'), width / 2, Math.max(54, height * 0.115) + 1);

    ctx.fillStyle = '#fef3c7';
    ctx.font = `900 24px ${GOTHIC_DISPLAY_FONT}`;
    ctx.fillText(t('抉择你的后期终极形态', 'EVOLVE YOUR ARCHETYPE'), width / 2, Math.max(96, height * 0.178));

    for (let i = 0; i < 2; i++) {
      const br = char.branches[i];
      const cx = layout.startX + i * (layout.cardW + layout.gap);
      const isHov = i === selectedIdx || i === this.hoveredBranchIndex;
      const cy = layout.startY + (isHov ? -5 : 0);

      drawGothicTablet(ctx, cx, cy, layout.cardW, layout.cardH, {
        topColor: isHov ? '#2a1228' : '#150b1d',
        bottomColor: '#050208',
        borderOuter: isHov ? br.color : '#523a28',
        borderInner: isHov ? '#fef08a' : br.color,
        accentColor: br.color,
        cornerSize: 16,
        chamfer: 9,
        showSpikes: isHov,
        showDamask: true,
        glowAlpha: isHov ? 0.22 : 0.06
      });

      drawWaxSeal(ctx, cx + 26, cy + 26, 12, isHov ? '#b91c1c' : '#2d121d', br.color, `${i + 1}`);

      ctx.textBaseline = 'top';
      ctx.fillStyle = br.color;
      ctx.font = `700 11px ${GOTHIC_DISPLAY_FONT}`;
      ctx.fillText(t(br.badgeZh, br.badgeEn), cx + layout.cardW / 2, cy + 40);

      ctx.fillStyle = '#fef3c7';
      ctx.font = `900 20px ${GOTHIC_DISPLAY_FONT}`;
      ctx.fillText(t(br.nameZh, br.nameEn), cx + layout.cardW / 2, cy + 62);

      drawGothicDivider(ctx, cx + layout.cardW / 2, cy + 94, layout.cardW * 0.34, '#d97706', br.color);

      ctx.fillStyle = '#e7d5b8';
      ctx.font = `400 12px ${GOTHIC_BODY_FONT}`;
      this.wrapText(ctx, t(br.roleSummaryZh, br.roleSummaryEn), cx + 20, cy + 108, layout.cardW - 40, 18);

      // Pointed Arch Ultimate Relic Shrine Box
      const ultBoxY = cy + 174;
      const ultBoxH = layout.cardH - 190;
      drawPointedArchNiche(
        ctx,
        cx + layout.cardW / 2,
        ultBoxY,
        layout.cardW - 32,
        ultBoxH,
        br.color,
        '#200c24',
        '#050208'
      );

      ctx.fillStyle = '#fde047';
      ctx.font = `700 10.5px ${GOTHIC_DISPLAY_FONT}`;
      ctx.fillText(t(`终极技进化 · ${br.ultNameZh}`, `EVOLVED ULT · ${br.ultNameEn}`), cx + layout.cardW / 2, ultBoxY + 18);

      ctx.fillStyle = '#d6c7b2';
      ctx.font = `400 11px ${GOTHIC_BODY_FONT}`;
      this.wrapText(ctx, t(br.ultDescZh, br.ultDescEn), cx + 26, ultBoxY + 40, layout.cardW - 52, 16);
    }

    ctx.fillStyle = '#a89276';
    ctx.font = `600 11px ${GOTHIC_BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      t('点击祭坛卡面或按 [1] / [2] 确认命途觉醒', 'Click an altar or press [1] / [2] to ascend'),
      width / 2,
      layout.startY + layout.cardH + 28
    );

    ctx.restore();
  }

  // --- Ornate Gothic Cathedral Settings Modal ---
  public renderSettingsModal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isInGame: boolean
  ): void {
    ctx.save();
    const layout = this.getSettingsLayout(width, height, isInGame);

    ctx.fillStyle = 'rgba(3, 1, 7, 0.84)';
    ctx.fillRect(0, 0, width, height);

    drawGothicTablet(ctx, layout.panelX, layout.panelY, layout.panelW, layout.panelH, {
      topColor: '#1f1024',
      bottomColor: '#050308',
      borderOuter: '#78350f',
      borderInner: '#d97706',
      accentColor: '#dc2626',
      cornerSize: 16,
      chamfer: 9,
      showSpikes: true,
      showDamask: true,
      glowAlpha: 0.14
    });

    ctx.fillStyle = '#fef3c7';
    ctx.font = `700 17px ${GOTHIC_DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('圣 殿 设 置', 'SANCTUARY SETTINGS'), width / 2, layout.panelY + 34);
    drawGothicDivider(ctx, width / 2, layout.panelY + 56, layout.panelW * 0.36, '#d97706', '#dc2626');

    // Language Row
    ctx.fillStyle = '#d6c7b2';
    ctx.font = `600 12.5px ${GOTHIC_BODY_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(t('语言 / Language', 'Language / 语言'), layout.panelX + 28, layout.row1Y);

    this.drawGothicButton(
      ctx,
      layout.zhBtnX,
      layout.langBtnY,
      layout.langBtnW,
      layout.langBtnH,
      '简体中文',
      '#fbbf24',
      i18n.lang === 'zh',
      this.hoveredButton === 'lang_zh',
      false,
      11.5
    );
    this.drawGothicButton(
      ctx,
      layout.enBtnX,
      layout.langBtnY,
      layout.langBtnW,
      layout.langBtnH,
      'English',
      '#fbbf24',
      i18n.lang === 'en',
      this.hoveredButton === 'lang_en',
      false,
      11.5
    );

    // Audio Row
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d6c7b2';
    ctx.font = `600 12.5px ${GOTHIC_BODY_FONT}`;
    ctx.fillText(t('圣殿音效', 'Sound Effects'), layout.panelX + 28, layout.row2Y);

    const isMuted = this.sound.isMuted;
    this.drawGothicButton(
      ctx,
      layout.audioBtnX,
      layout.audioBtnY,
      layout.audioBtnW,
      layout.audioBtnH,
      isMuted ? t('已静音 (点击开启)', 'MUTED (CLICK TO UNMUTE)') : t('已开启 (点击静音)', 'ON (CLICK TO MUTE)'),
      isMuted ? '#ef4444' : '#34d399',
      !isMuted,
      this.hoveredButton === 'toggle_audio',
      false,
      11
    );

    // BGM Style Row
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d6c7b2';
    ctx.font = `600 12.5px ${GOTHIC_BODY_FONT}`;
    ctx.fillText(t('圣咏乐章', 'BGM Style'), layout.panelX + 28, layout.row3Y);

    const bgmLabels: Record<string, { zh: string; en: string }> = {
      BAROQUE: { zh: '♪ Ⅰ. 哥特交响 (默认)', en: '♪ I. Gothic Symphony' },
      SYNTHWAVE: { zh: '♪ Ⅱ. 暗潮脉动 Darkwave', en: '♪ II. Darkwave Pulse' },
      CINEMATIC_EPIC: { zh: '♪ Ⅲ. 电影交响 · 史诗', en: '♪ III. Cinematic Epic' },
      GOTHIC_REQUIEM: { zh: '♪ Ⅳ. 哥特安魂曲', en: '♪ IV. Gothic Requiem' },
      DARK_INDUSTRIAL: { zh: '♪ Ⅴ. 冷冽暗潮 EBM', en: '♪ V. Cold Darkwave' },
      CINEMATIC_NOCTURNE: { zh: '♪ Ⅵ. 电影夜曲 · 星界', en: '♪ VI. Cinematic Nocturne' }
    };
    const curStyle = this.sound.bgmStyle || 'BAROQUE';
    const bgmLabel = bgmLabels[curStyle] || bgmLabels.BAROQUE;
    this.drawGothicButton(
      ctx,
      layout.audioBtnX,
      layout.bgmBtnY,
      layout.audioBtnW,
      layout.audioBtnH,
      t(bgmLabel.zh, bgmLabel.en),
      '#c084fc',
      true,
      this.hoveredButton === 'cycle_bgm_style',
      false,
      11
    );

    // Bottom Actions
    this.drawGothicButton(
      ctx,
      layout.actionBtnX,
      layout.resumeBtnY,
      layout.actionBtnW,
      layout.actionBtnH,
      t('返回圣战 [ESC]', 'RESUME [ESC]'),
      '#fbbf24',
      false,
      this.hoveredButton === 'close_settings',
      false,
      12
    );

    if (isInGame) {
      this.drawGothicButton(
        ctx,
        layout.actionBtnX,
        layout.quitBtnY,
        layout.actionBtnW,
        layout.actionBtnH,
        t('重返大圣堂主界面', 'RETURN TO TITLE'),
        '#ef4444',
        false,
        this.hoveredButton === 'quit_to_title',
        false,
        12
      );
    }

    ctx.restore();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const isCJK = /[\u4e00-\u9fa5]/.test(text);
    const tokens = isCJK ? Array.from(text) : text.split(' ');
    let line = '';
    let curY = y;

    for (let n = 0; n < tokens.length; n++) {
      const sep = isCJK ? '' : ' ';
      const testLine = line + tokens[n] + sep;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trimEnd(), x + maxWidth / 2, curY);
        line = tokens[n] + sep;
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line.trimEnd(), x + maxWidth / 2, curY);
    }
  }

  // --- Procedural High-Detail Gothic Relic Vector Icons ---
  private renderVectorIcon(ctx: CanvasRenderingContext2D, icon: string, x: number, y: number, size: number): void {
    ctx.save();
    ctx.translate(x, y);
    const r = size / 2;

    // Warm dark-gothic candlelight halo & crisp dark-ink silhouette depth
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.15);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
    glow.addColorStop(0.55, 'rgba(180, 30, 58, 0.12)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
    ctx.shadowBlur = 3.5;
    ctx.shadowOffsetY = 1.5;

    switch (icon) {
      case 'whip':
        // Semicircular Crimson-Gold Sword Cleave & Greatsword (Matches Antonio's Horizontal Cleave)
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, -Math.PI * 0.75, Math.PI * 0.25);
        ctx.stroke();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.62, -Math.PI * 0.65, Math.PI * 0.15);
        ctx.stroke();

        // Diagonal Silver-Gold Greatsword Blade
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-r * 0.65, r * 0.25, r * 0.35, r * 0.18);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.45);
        ctx.lineTo(r * 0.65, -r * 0.65);
        ctx.stroke();
        break;

      case 'axe':
        // Double-Bitted Silver & Gold Executioner Battleaxe
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-2, -r * 0.8, 4, r * 1.6);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-2.5, -r * 0.85, 5, 3);
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(-2, -r * 0.55);
        ctx.quadraticCurveTo(-r * 0.85, -r * 0.8, -r * 0.8, -r * 0.1);
        ctx.quadraticCurveTo(-r * 0.85, r * 0.4, -2, r * 0.15);
        ctx.moveTo(2, -r * 0.55);
        ctx.quadraticCurveTo(r * 0.85, -r * 0.8, r * 0.8, -r * 0.1);
        ctx.quadraticCurveTo(r * 0.85, r * 0.4, 2, r * 0.15);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        break;

      case 'fire_wand':
        // Ruby Solar Staff with Blazing Flame Crown
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.65, r * 0.65);
        ctx.lineTo(r * 0.35, -r * 0.35);
        ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(r * 0.45, -r * 0.45, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(r * 0.45, -r * 0.45, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'runetracer':
        // Prismatic Faceted Diamond Gem
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.8);
        ctx.lineTo(r * 0.65, 0);
        ctx.lineTo(0, r * 0.8);
        ctx.lineTo(-r * 0.65, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.4);
        ctx.lineTo(r * 0.3, 0);
        ctx.lineTo(0, r * 0.4);
        ctx.lineTo(-r * 0.3, 0);
        ctx.closePath();
        ctx.fill();
        break;

      case 'magic_wand':
        // Sapphire Arcane Scepter with Star Tip
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.65, r * 0.65);
        ctx.lineTo(r * 0.35, -r * 0.35);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(r * 0.45, -r * 0.45, r * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(r * 0.45, -r * 0.45, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'knife':
        // Gleaming Assassin Throwing Dagger with Gold Crossguard
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-r * 0.75, -2, r * 0.4, 4);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-r * 0.35, -5, 3, 10);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, -3.5);
        ctx.lineTo(r * 0.85, 0);
        ctx.lineTo(-r * 0.2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, 3.5);
        ctx.lineTo(r * 0.85, 0);
        ctx.lineTo(-r * 0.2, 0);
        ctx.closePath();
        ctx.fill();
        break;

      case 'spinning_orbs':
        // Golden Crusader Heater Shield with Radiant Cross
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r * 0.65);
        ctx.lineTo(r * 0.6, -r * 0.65);
        ctx.lineTo(r * 0.6, 0);
        ctx.quadraticCurveTo(r * 0.6, r * 0.6, 0, r * 0.8);
        ctx.quadraticCurveTo(-r * 0.6, r * 0.6, -r * 0.6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-r * 0.14, -r * 0.45, r * 0.28, r * 0.95);
        ctx.fillRect(-r * 0.4, -r * 0.2, r * 0.8, r * 0.26);
        break;

      case 'holy_water':
        // Ornate Crystal Flask with Glowing Sacred Azure Water
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(0, r * 0.2, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath();
        ctx.arc(-r * 0.12, r * 0.15, r * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-r * 0.2, -r * 0.65, r * 0.4, r * 0.35);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-r * 0.25, -r * 0.78, r * 0.5, 3);
        break;

      case 'lightning_ring':
        // Golden Signet Ring with Crackling Thunderbolt
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, r * 0.1, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(2, -r * 0.8);
        ctx.lineTo(-4, -1);
        ctx.lineTo(1, -1);
        ctx.lineTo(-2, r * 0.6);
        ctx.lineTo(5, -2);
        ctx.lineTo(0, -2);
        ctx.closePath();
        ctx.fill();
        break;

      case 'cross':
        // Celestial Golden-Cyan Bladed Cross
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-r * 0.2, -r * 0.8, r * 0.4, r * 1.6);
        ctx.fillRect(-r * 0.7, -r * 0.35, r * 1.4, r * 0.4);
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, -r * 0.15, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'garlic':
        // Sacred Glowing Bulb with Golden Aura Rings
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 1, r * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-r * 0.2, 2, r * 0.42, 0, Math.PI * 2);
        ctx.arc(r * 0.2, 2, r * 0.42, 0, Math.PI * 2);
        ctx.arc(0, 1, r * 0.48, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-2, -r * 0.75, 4, 6);
        break;

      case 'pentagram':
        // Inscribed Golden-Crimson Pentagram Seal
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const px = Math.cos(a) * r * 0.78;
          const py = Math.sin(a) * r * 0.78;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        break;

      case 'spinach':
        // Emerald Power Leaf with Veins
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.55, r * 0.78, 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.15, r * 0.6);
        ctx.lineTo(r * 0.15, -r * 0.55);
        ctx.stroke();
        break;

      case 'wings':
        // Feathered Celestial Angel Wing
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(-r * 0.75, r * 0.3);
        ctx.quadraticCurveTo(-r * 0.2, -r * 0.85, r * 0.8, -r * 0.45);
        ctx.quadraticCurveTo(r * 0.4, r * 0.1, r * 0.6, r * 0.25);
        ctx.quadraticCurveTo(0, r * 0.4, -r * 0.75, r * 0.3);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        break;

      case 'empty_tome':
        // Illuminated Grimoire with Gold Clasp
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(-r * 0.62, -r * 0.72, r * 1.24, r * 1.44);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(-r * 0.44, -r * 0.55, r * 0.88, r * 1.1);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-r * 0.62, -r * 0.72, r * 1.24, r * 1.44);
        break;

      case 'duplicator':
        // Twin Interlocked Arcane Rings
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(-r * 0.25, 0, r * 0.46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(r * 0.25, 0, r * 0.46, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'crown':
        // Royal Jeweled Golden Crown
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-r * 0.72, r * 0.45);
        ctx.lineTo(-r * 0.78, -r * 0.35);
        ctx.lineTo(-r * 0.32, r * 0.05);
        ctx.lineTo(0, -r * 0.62);
        ctx.lineTo(r * 0.32, r * 0.05);
        ctx.lineTo(r * 0.78, -r * 0.35);
        ctx.lineTo(r * 0.72, r * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, r * 0.2, 2.2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'hollow_heart':
        // Crystalline Ruby Heart with Specular Glint
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.2, r * 0.4, Math.PI, 0, false);
        ctx.arc(r * 0.3, -r * 0.2, r * 0.4, Math.PI, 0, false);
        ctx.lineTo(0, r * 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fecdd3';
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.25, r * 0.14, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'armor':
        // Beveled Steel Cuirass Shield Plate
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.75);
        ctx.lineTo(r * 0.7, -r * 0.4);
        ctx.lineTo(r * 0.52, r * 0.55);
        ctx.lineTo(0, r * 0.8);
        ctx.lineTo(-r * 0.52, r * 0.55);
        ctx.lineTo(-r * 0.7, -r * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;

      case 'pummarola':
        // Glowing Vitality Heart Fruit
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(0, 2, r * 0.68, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fda4af';
        ctx.beginPath();
        ctx.arc(-r * 0.22, 0, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-2, -r * 0.72, 4, 5);
        break;

      case 'attractorb':
        // Swirling Magnetic Void Sphere
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-r * 0.14, -r * 0.14, r * 0.14, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'clover':
        // Four-Leaf Lucky Emerald Clover
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(-r * 0.28, -r * 0.28, r * 0.34, 0, Math.PI * 2);
        ctx.arc(r * 0.28, -r * 0.28, r * 0.34, 0, Math.PI * 2);
        ctx.arc(-r * 0.28, r * 0.28, r * 0.34, 0, Math.PI * 2);
        ctx.arc(r * 0.28, r * 0.28, r * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a7f3d0';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;

      default:
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-r * 0.5, -r * 0.5, r, r);
        break;
    }

    ctx.restore();
  }
}
