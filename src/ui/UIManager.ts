import { Player } from '../entities/Player';
import { Enemy } from '../enemies/Enemy';
import { Camera } from '../core/Camera';
import { SoundSynthesizer } from '../core/SoundSynthesizer';
import { ALL_WEAPON_DEFINITIONS } from '../weapons/WeaponRegistry';
import { PASSIVE_DEFINITIONS } from '../passives/PassiveRegistry';
import { CHARACTERS, CharacterInfo } from '../persistence/CharacterSelect';
import { SaveManager } from '../persistence/SaveManager';
import { SpriteRenderer } from '../renderer/SpriteRenderer';
import { SkillTag, TAG_METADATA } from '../systems/BuildSystem';
import { CompanionSystem } from '../systems/CompanionSystem';
import { i18n, t, getCharacterText, getWeaponDisplayName, getBossText } from '../core/I18n';

export interface UpgradeOption {
  type: 'WEAPON' | 'PASSIVE' | 'EVOLUTION';
  id: string;
  name: string;
  levelText: string;
  description: string;
  iconName: string;
  tags?: SkillTag[];
}

const UI_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "PingFang SC", "Helvetica Neue", sans-serif';
const MONO_FONT = 'ui-monospace, "SF Mono", "JetBrains Mono", "Menlo", monospace';

export class UIManager {
  public hoveredUpgradeIndex = -1;
  public hoveredCharacterIndex = -1;
  public hoveredButton: string | null = null;

  // Chest animation
  public chestOpenProgress = 0;
  public chestRewardOptions: UpgradeOption[] = [];

  // Card hover animation progress (for smooth GSAP-like interpolation)
  private cardHoverProgress: number[] = [0, 0, 0, 0];

  // Screen-Space Boss HUD & Cinematic Entrance / Slain Decrescendo State
  private bossHudSlide = 0; // 0 = hidden above screen, 1 = fully deployed
  private bossWarningTimer = 0; // 1.8s duration when Boss spawns
  private bossSlainShatterTimer = 0; // 0.9s shatter fade-out when Boss dies
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

  // --- HUD Rendering ---
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

    const nowMs = performance.now();
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

    // 1. Top Experience Bar (3D Cylindrical Sapphire Glass Tube)
    const xpPercent = Math.max(0, Math.min(1, player.xp / player.nextLevelXp));
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, width, 10);

    if (xpPercent > 0) {
      const xpGrad = ctx.createLinearGradient(0, 0, 0, 10);
      xpGrad.addColorStop(0, '#bae6fd');
      xpGrad.addColorStop(0.4, '#38bdf8');
      xpGrad.addColorStop(1, '#0284c7');
      ctx.fillStyle = xpGrad;
      ctx.fillRect(0, 0, width * xpPercent, 10);

      // Top Specular Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fillRect(0, 0, width * xpPercent, 2.5);
    }

    // Subtle Slate Bottom Rim
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(width, 10);
    ctx.stroke();

    // 2. Center Timer & Minimalist Counters (Modern Tabular Monospace)
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = Math.floor(elapsedSeconds % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 18px ${MONO_FONT}`;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(timeStr, width / 2, 32);

    // Minimalist Kills & Gold Readouts
    ctx.font = `500 11px ${MONO_FONT}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${player.kills}`, width / 2 - 64, 32);

    ctx.fillStyle = '#fde047';
    ctx.fillText(`${player.gold}G`, width / 2 + 64, 32);

    // 3. Top-Left 3D Sculpted Hero Medallion & Cylindrical Vitality Gauge
    const medX = 40;
    const medY = 50;
    const medR = 22;

    // 3a. 3D Hero Portrait Medallion
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(medX + 1, medY + 3, medR + 2, 0, Math.PI * 2);
    ctx.fill();

    const ringGrad = ctx.createLinearGradient(medX, medY - medR, medX, medY + medR);
    ringGrad.addColorStop(0, '#64748b');
    ringGrad.addColorStop(0.5, '#334155');
    ringGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(medX, medY, medR + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(medX, medY, medR - 1, 0, Math.PI * 2);
    ctx.fill();

    // Draw Hero Sprite inside Medallion
    SpriteRenderer.getInstance().drawSprite(
      ctx,
      `hero_${player.characterId}`,
      0,
      medX,
      medY - 1,
      34,
      34,
      1,
      false
    );

    // 3D Level Pill at Bottom of Medallion
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(medX - 15, medY + medR - 6, 30, 12, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 9px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`LV ${player.level}`, medX, medY + medR);

    // 3b. 3D Cylindrical Vitality Tube (Right of Medallion)
    const hpBarW = 166;
    const hpBarH = 14;
    const hpX = 72;
    const hpY = 26;

    // Floating Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    ctx.roundRect(hpX - 2, hpY + 2, hpBarW + 4, hpBarH + 4, 4);
    ctx.fill();

    // 3D Metallic Beveled Casing
    const hpCaseGrad = ctx.createLinearGradient(0, hpY - 2, 0, hpY + hpBarH + 2);
    hpCaseGrad.addColorStop(0, '#334155');
    hpCaseGrad.addColorStop(0.5, '#0f172a');
    hpCaseGrad.addColorStop(1, '#020617');
    ctx.fillStyle = hpCaseGrad;
    ctx.beginPath();
    ctx.roundRect(hpX - 2, hpY - 2, hpBarW + 4, hpBarH + 4, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Recessed Dark Inner Trough
    ctx.fillStyle = '#04060c';
    ctx.beginPath();
    ctx.roundRect(hpX, hpY, hpBarW, hpBarH, 3);
    ctx.fill();

    // Cylindrical 4-Stop Liquid Fill
    const hpPct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    if (hpPct > 0) {
      const hpGrad = ctx.createLinearGradient(0, hpY, 0, hpY + hpBarH);
      if (hpPct > 0.5) {
        hpGrad.addColorStop(0, '#fca5a5');
        hpGrad.addColorStop(0.3, '#ef4444');
        hpGrad.addColorStop(0.75, '#b91c1c');
        hpGrad.addColorStop(1, '#450a0a');
      } else if (hpPct > 0.25) {
        hpGrad.addColorStop(0, '#fef08a');
        hpGrad.addColorStop(0.35, '#f59e0b');
        hpGrad.addColorStop(0.8, '#b45309');
        hpGrad.addColorStop(1, '#451a03');
      } else {
        hpGrad.addColorStop(0, '#fecaca');
        hpGrad.addColorStop(0.35, '#dc2626');
        hpGrad.addColorStop(0.8, '#7f1d1d');
        hpGrad.addColorStop(1, '#2a0404');
      }
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      ctx.roundRect(hpX, hpY, hpBarW * hpPct, hpBarH, 3);
      ctx.fill();

      // Top Glass Specular Strip
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.beginPath();
      ctx.roundRect(hpX, hpY, hpBarW * hpPct, hpBarH * 0.36, 2);
      ctx.fill();
    }

    // Crisp Numeric HP Readout
    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 9px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(player.hp)} / ${player.maxHp}`, hpX + hpBarW / 2, hpY + hpBarH / 2 + 0.5);

    // Weapon Inventory Slots (Row 1 - 3D Recessed Sockets)
    const slotSize = 24;
    const slotMargin = 4;
    for (let i = 0; i < player.maxWeaponSlots; i++) {
      const sx = hpX + i * (slotSize + slotMargin);
      const sy = hpY + 20;
      this.renderSlot(ctx, sx, sy, slotSize, player.weapons[i]);
    }

    // Passive Inventory Slots (Row 2 - 3D Recessed Sockets)
    const passiveKeys = Array.from(player.passives.entries());
    for (let i = 0; i < player.maxPassiveSlots; i++) {
      const sx = hpX + i * (slotSize + slotMargin);
      const sy = hpY + 20 + slotSize + slotMargin;
      const passiveData = passiveKeys[i];
      this.renderPassiveSlot(ctx, sx, sy, slotSize, passiveData);
    }

    // 3c. Minimalist 3D Resonance Gem Badges
    if (companionSystem && companionSystem.activeBonds.length > 0) {
      const activeOnly = companionSystem.activeBonds.filter(b => b.tier > 0);
      const bondY = hpY + 20 + (slotSize + slotMargin) * 2 + 12;
      for (let i = 0; i < activeOnly.length; i++) {
        const bond = activeOnly[i];
        const meta = TAG_METADATA[bond.tag];
        const gx = hpX + 11 + i * 26;

        ctx.save();
        ctx.translate(gx, bondY);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.arc(0, 2, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = meta.color;
        ctx.lineWidth = bond.tier === 2 ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = meta.color;
        ctx.font = `600 9px ${MONO_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bond.tier === 2 ? 'IV' : 'II', 0, 0.5);
        ctx.restore();
      }
    }

    // 4. Top Right 3D Settings & Sound Buttons
    const btnSize = 30;
    const settingsBtnX = width - 88;
    const soundBtnX = width - 50;
    const topBtnY = 22;

    // 4a. Settings Button (Gear Icon)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(settingsBtnX, topBtnY + 2, btnSize, btnSize, 6);
    ctx.fill();

    ctx.fillStyle = this.hoveredButton === 'settings' ? '#1e293b' : '#0f172a';
    ctx.beginPath();
    ctx.roundRect(settingsBtnX, topBtnY, btnSize, btnSize, 6);
    ctx.fill();
    ctx.strokeStyle = this.hoveredButton === 'settings' ? '#e2e8f0' : 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    this.renderGearIcon(ctx, settingsBtnX + btnSize / 2, topBtnY + btnSize / 2, '#e2e8f0');

    // 4b. Sound Button (Speaker Icon)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(soundBtnX, topBtnY + 2, btnSize, btnSize, 6);
    ctx.fill();

    ctx.fillStyle = this.hoveredButton === 'sound' ? '#1e293b' : '#0f172a';
    ctx.beginPath();
    ctx.roundRect(soundBtnX, topBtnY, btnSize, btnSize, 6);
    ctx.fill();
    ctx.strokeStyle = this.hoveredButton === 'sound' ? '#e2e8f0' : 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Vector Speaker Icon
    ctx.save();
    ctx.translate(soundBtnX + btnSize / 2, topBtnY + btnSize / 2);
    ctx.strokeStyle = this.sound.isMuted ? '#64748b' : '#e2e8f0';
    ctx.fillStyle = this.sound.isMuted ? '#64748b' : '#e2e8f0';
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
      ctx.beginPath();
      ctx.arc(2.5, 0, 3.5, -0.7, 0.7);
      ctx.stroke();
    }
    ctx.restore();

    // Frozen Map Frost Border
    if (isFrozen) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, width, height);
    }

    // 5. Bottom-Center Minimalist 3D Beveled Skill Medallions
    this.renderActiveSkillsBar(ctx, width, height, player, companionSystem);

    // 6. Top-Center Screen-Space Boss Exclusive HUD (3D Obsidian-Gold Gauge & Phase 2 Lava Enrage)
    if (this.bossHudSlide > 0.005) {
      this.renderScreenSpaceBossHUD(ctx, width, activeBoss || null);
    }

    // 7. Full-Screen Crimson Boss Encounter Warning Banner & Vignette Pulse
    if (this.bossWarningTimer > 0) {
      this.renderBossWarningBanner(ctx, width, height);
    }

    ctx.restore();
  }

  /**
   * 屏幕正上方（Screen-Space HUD）全屏级 Boss 专属血条与尊号头衔
   */
  private renderScreenSpaceBossHUD(ctx: CanvasRenderingContext2D, width: number, activeBoss: Enemy | null): void {
    const slideEase = 1 - Math.pow(1 - this.bossHudSlide, 3);
    const yOffset = (1 - slideEase) * -86;
    const isShattering = this.bossSlainShatterTimer > 0 && !activeBoss;
    const shatterProg = isShattering ? 1 - this.bossSlainShatterTimer / 0.95 : 0;
    const alpha = isShattering ? Math.max(0, 1 - Math.pow(shatterProg, 1.4)) : slideEase;

    const isEnraged = this.lastKnownBossPhase === 2 || this.lastKnownBossHpRatio <= 0.5;
    const isHitFlashing = activeBoss ? activeBoss.hitFlashTimer > 0 : false;
    const timeSec = performance.now() * 0.001;

    // 高频狂暴震颤 + 受击钝重抖动
    const enrageTremorX = isEnraged && !isShattering ? Math.sin(timeSec * 46) * 1.15 : 0;
    const enrageTremorY = isEnraged && !isShattering ? Math.cos(timeSec * 52) * 0.85 : 0;
    const hitShakeX = isHitFlashing ? (Math.random() - 0.5) * 4.5 : 0;
    const hitShakeY = isHitFlashing ? (Math.random() - 0.5) * 3.2 : 0;

    const barW = Math.min(460, Math.max(420, width * 0.36));
    const barH = 16;
    const cx = width / 2 + enrageTremorX + hitShakeX;
    const barX = cx - barW / 2;
    const barY = 98 + yOffset + enrageTremorY + hitShakeY;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. 顶部暗黑渐变氛围背板衬底 (Subtle Obsidian Header Backdrop)
    const backGrad = ctx.createRadialGradient(cx, barY - 12, 10, cx, barY - 8, barW * 0.68);
    backGrad.addColorStop(0, isEnraged ? 'rgba(69, 10, 10, 0.72)' : 'rgba(9, 13, 22, 0.76)');
    backGrad.addColorStop(0.65, 'rgba(9, 13, 22, 0.38)');
    backGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = backGrad;
    ctx.fillRect(cx - barW * 0.7, barY - 52, barW * 1.4, 88);

    // 2. Boss 专属名号与副标题（现代无衬线/大写字阶 + 暗金/绯红微光渐变）
    const bossText = getBossText(this.lastKnownBossVariant);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 主名号微光渐变
    const titleGrad = ctx.createLinearGradient(cx - 140, barY - 38, cx + 140, barY - 22);
    if (isEnraged) {
      titleGrad.addColorStop(0, '#fde047');
      titleGrad.addColorStop(0.5, '#ffffff');
      titleGrad.addColorStop(1, '#f97316');
    } else {
      titleGrad.addColorStop(0, '#f8fafc');
      titleGrad.addColorStop(0.5, '#fde68a');
      titleGrad.addColorStop(1, '#fca5a5');
    }
    ctx.font = `700 15px ${UI_FONT}`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillText(bossText.name, cx + 1, barY - 30);
    ctx.fillStyle = titleGrad;
    ctx.fillText(bossText.name, cx, barY - 31);

    // 副标题与装饰细线
    ctx.font = `600 10px ${UI_FONT}`;
    ctx.fillStyle = isEnraged ? '#fb923c' : '#94a3b8';
    const subLabel = isEnraged
      ? `${bossText.title}  ·  ${t('二阶段 · 狂暴觉醒', 'PHASE II · ENRAGED')}`
      : bossText.title;
    ctx.fillText(subLabel, cx, barY - 14);

    const subHalfW = Math.min(180, ctx.measureText(subLabel).width * 0.5 + 16);
    ctx.strokeStyle = isEnraged ? 'rgba(251, 146, 60, 0.45)' : 'rgba(251, 191, 36, 0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - subHalfW - 44, barY - 14);
    ctx.lineTo(cx - subHalfW, barY - 14);
    ctx.moveTo(cx + subHalfW, barY - 14);
    ctx.lineTo(cx + subHalfW + 44, barY - 14);
    ctx.stroke();

    // 3. 二阶段狂暴：外框呼吸烈焰粒子与熔岩热浪光晕 (Phase 2 Breathing Flame Particles)
    if (isEnraged && !isShattering) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flamePulse = 0.65 + Math.sin(timeSec * 8) * 0.35;
      const auraGrad = ctx.createLinearGradient(barX, barY - 10, barX, barY + barH + 10);
      auraGrad.addColorStop(0, `rgba(251, 191, 36, ${0.28 * flamePulse})`);
      auraGrad.addColorStop(0.5, `rgba(239, 68, 68, ${0.36 * flamePulse})`);
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.roundRect(barX - 8, barY - 6, barW + 16, barH + 12, 8);
      ctx.fill();

      // Procedural breathing embers rising along the top edge of the Boss bar
      for (let i = 0; i < 14; i++) {
        const seed = i * 37.3;
        const cycle = (timeSec * (1.4 + (i % 4) * 0.35) + seed) % 1;
        const fx = barX + 14 + ((i * (barW - 28)) / 13) + Math.sin(timeSec * 5 + i) * 6;
        const fy = barY + 2 - cycle * 22;
        const fr = (1 - cycle) * (2.2 + (i % 2) * 1.2);
        ctx.fillStyle = i % 2 === 0 ? '#fef08a' : '#f97316';
        ctx.globalAlpha = alpha * (1 - cycle) * 0.85;
        ctx.beginPath();
        ctx.arc(fx, fy, fr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. 高精 3D 浮雕黑曜鎏金血条外框与凹槽底座
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.beginPath();
    ctx.roundRect(barX - 5, barY + 3, barW + 10, barH + 6, 5);
    ctx.fill();

    const outerGrad = ctx.createLinearGradient(0, barY - 4, 0, barY + barH + 4);
    outerGrad.addColorStop(0, isEnraged ? '#fef08a' : '#475569');
    outerGrad.addColorStop(0.45, '#0f172a');
    outerGrad.addColorStop(1, '#020617');
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.roundRect(barX - 4, barY - 4, barW + 8, barH + 8, 5);
    ctx.fill();

    ctx.strokeStyle = isEnraged ? '#f59e0b' : '#d97706';
    ctx.lineWidth = isEnraged ? 1.8 : 1.4;
    ctx.stroke();

    // 内凹深渊暗槽
    ctx.fillStyle = '#04060c';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();

    // 4a. 白金受击延迟残影槽 (Lag Gauge — 赋予强烈的“削肉”钝重感)
    const hpRatio = this.lastKnownBossHpRatio;
    const lagRatio = this.lastKnownBossLagRatio;
    if (lagRatio > hpRatio + 0.002 && !isShattering) {
      const lagGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
      lagGrad.addColorStop(0, '#ffffff');
      lagGrad.addColorStop(0.45, '#fef08a');
      lagGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = lagGrad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * lagRatio, barH, 3);
      ctx.fill();
    }

    // 4b. 主血条流体填充（一阶段深绯红流体 -> 二阶段 <50% 炽热熔岩金 Orange-Gold Lava）
    const fillW = barW * hpRatio;
    if (fillW > 0.5 && !isShattering) {
      const fillGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
      if (isEnraged) {
        // Phase 2: Orange-Gold Lava
        fillGrad.addColorStop(0, '#fef08a');
        fillGrad.addColorStop(0.28, '#fbbf24');
        fillGrad.addColorStop(0.68, '#f97316');
        fillGrad.addColorStop(1, '#9a3412');
      } else {
        // Phase 1: Deep Crimson Fluid
        fillGrad.addColorStop(0, '#fecaca');
        fillGrad.addColorStop(0.28, '#ef4444');
        fillGrad.addColorStop(0.75, '#991b1b');
        fillGrad.addColorStop(1, '#450a0a');
      }
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, 3);
      ctx.fill();

      // 圆柱玻璃高光反光带
      ctx.fillStyle = isHitFlashing ? 'rgba(255, 255, 255, 0.72)' : 'rgba(255, 255, 255, 0.34)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH * 0.36, 2);
      ctx.fill();
    }

    // 4c. 25% / 75% 暗金刻度线 与 50% 立体金属菱形锁扣刻度 (Phase 2 Threshold Lock)
    ctx.strokeStyle = 'rgba(4, 6, 12, 0.85)';
    ctx.lineWidth = 1.4;
    for (const mark of [0.25, 0.5, 0.75]) {
      const mx = barX + barW * mark;
      ctx.beginPath();
      ctx.moveTo(mx, barY);
      ctx.lineTo(mx, barY + barH);
      ctx.stroke();
    }

    // 50% 立体金属菱形锁扣
    const lockX = barX + barW * 0.5;
    const lockY = barY + barH / 2;
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = isEnraged ? '#fef08a' : '#fbbf24';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(lockX, lockY - 6.5);
    ctx.lineTo(lockX + 5.5, lockY);
    ctx.lineTo(lockX, lockY + 6.5);
    ctx.lineTo(lockX - 5.5, lockY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isEnraged ? '#f97316' : '#ef4444';
    ctx.beginPath();
    ctx.arc(lockX, lockY, 2.1, 0, Math.PI * 2);
    ctx.fill();

    // 5. 左右两端 3D 几何雕花金属护套与红宝石卡扣
    for (const side of [-1, 1]) {
      const capX = side < 0 ? barX - 6 : barX + barW + 6;
      const capY = barY + barH / 2;

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = isEnraged ? '#fef08a' : '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(capX, capY - 10);
      ctx.lineTo(capX + side * 12, capY - 4);
      ctx.lineTo(capX + side * 16, capY);
      ctx.lineTo(capX + side * 12, capY + 4);
      ctx.lineTo(capX, capY + 10);
      ctx.lineTo(capX - side * 5, capY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 3D 切面红宝石卡扣
      ctx.fillStyle = isEnraged ? '#fde047' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(capX + side * 4, capY - 4);
      ctx.lineTo(capX + side * 8, capY);
      ctx.lineTo(capX + side * 4, capY + 4);
      ctx.lineTo(capX, capY);
      ctx.closePath();
      ctx.fill();
    }

    // 6. 中央上方精美矢量黄金双角王冠徽记
    const crownY = barY - 47;
    ctx.fillStyle = isEnraged ? '#fef08a' : '#fbbf24';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - 11, crownY + 3);
    ctx.lineTo(cx - 14, crownY - 6);
    ctx.lineTo(cx - 6, crownY - 1.5);
    ctx.lineTo(cx, crownY - 10);
    ctx.lineTo(cx + 6, crownY - 1.5);
    ctx.lineTo(cx + 14, crownY - 6);
    ctx.lineTo(cx + 11, crownY + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, crownY - 2.5, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 7. 血条中央精确生命数值读数
    if (!isShattering) {
      ctx.font = `600 10px ${MONO_FONT}`;
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pctText = `${Math.ceil(hpRatio * 100)}%`;
      ctx.fillText(
        `${Math.ceil(this.lastKnownBossHp)} / ${this.lastKnownBossMaxHp}  (${pctText})`,
        cx,
        barY + barH / 2 + 0.5
      );
    }

    // 8. Boss 击杀时的血条碎裂消散粒子演出 (Shatter Decrescendo Shards)
    if (isShattering) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const shardCount = 18;
      for (let s = 0; s < shardCount; s++) {
        const ratio = s / (shardCount - 1);
        const startX = barX + ratio * barW;
        const dirX = (ratio - 0.5) * 160 + Math.sin(s * 3.1) * 40;
        const dirY = -35 - (s % 4) * 18 + shatterProg * shatterProg * 140;
        const sx = startX + dirX * shatterProg;
        const sy = barY + barH / 2 + dirY * shatterProg;
        const rot = shatterProg * (s % 2 === 0 ? 5 : -5);

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rot);
        ctx.fillStyle = s % 2 === 0 ? '#fef08a' : '#f97316';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(7, 4);
        ctx.lineTo(-6, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Boss 登场全屏猩红警报横幅与呼吸暗角演出 (1.8s Duration)
   */
  private renderBossWarningBanner(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const totalDur = 1.8;
    const elapsed = totalDur - this.bossWarningTimer;
    const prog = Math.max(0, Math.min(1, elapsed / totalDur));

    // 入场展开 (0~0.18) -> 持续呼吸闪烁 (0.18~0.80) -> 向两侧高速撕裂消散 (0.80~1.0)
    let openScale = 1;
    let splitOffset = 0;
    let alpha = 1;
    if (prog < 0.16) {
      openScale = Math.pow(prog / 0.16, 0.5);
      alpha = prog / 0.16;
    } else if (prog > 0.78) {
      const outT = (prog - 0.78) / 0.22;
      splitOffset = Math.pow(outT, 1.8) * (width * 0.65);
      openScale = 1 - outT * 0.65;
      alpha = 1 - outT;
    }

    ctx.save();

    // 1. 全屏猩红呼吸暗角 (Crimson Vignette Pulse)
    const pulse = 0.55 + Math.sin(elapsed * Math.PI * 5.5) * 0.45;
    const vigGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.26,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75
    );
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(0.65, `rgba(127, 29, 29, ${0.24 * pulse * alpha})`);
    vigGrad.addColorStop(1, `rgba(220, 38, 38, ${0.52 * pulse * alpha})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. 中央半透明黑曜警报带 + 双向鎏金警戒线
    const bannerY = height * 0.34;
    const bannerH = 86 * openScale;

    ctx.globalAlpha = alpha;
    const bandGrad = ctx.createLinearGradient(0, bannerY - bannerH / 2, 0, bannerY + bannerH / 2);
    bandGrad.addColorStop(0, 'rgba(9, 13, 22, 0.82)');
    bandGrad.addColorStop(0.5, 'rgba(45, 7, 14, 0.92)');
    bandGrad.addColorStop(1, 'rgba(9, 13, 22, 0.82)');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(0, bannerY - bannerH / 2, width, bannerH);

    // 上下双向金线与警戒斜纹
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, bannerY - bannerH / 2);
    ctx.lineTo(width, bannerY - bannerH / 2);
    ctx.moveTo(0, bannerY + bannerH / 2);
    ctx.lineTo(width, bannerY + bannerH / 2);
    ctx.stroke();

    // 左右流动警戒斜条纹 (Hazard Chevron Stripes)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, bannerY - bannerH / 2, width, bannerH);
    ctx.clip();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
    const stripeShift = (elapsed * 180) % 48;
    for (let sx = -96 + stripeShift; sx < width + 96; sx += 48) {
      ctx.beginPath();
      ctx.moveTo(sx, bannerY - bannerH / 2);
      ctx.lineTo(sx + 20, bannerY - bannerH / 2);
      ctx.lineTo(sx - 12, bannerY + bannerH / 2);
      ctx.lineTo(sx - 32, bannerY + bannerH / 2);
      ctx.closePath();
      ctx.fill();
    }

    // 3. 闪烁呈现 ⚠️ BOSS ENCOUNTER ⚠️ 与 Boss 专属大字（消散阶段向两侧分离滑出）
    const bossText = getBossText(this.lastKnownBossVariant);
    const warnFlash = Math.sin(elapsed * 22) > -0.25 ? '#fef08a' : '#ef4444';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 13px ${MONO_FONT}`;
    ctx.fillStyle = warnFlash;
    ctx.fillText(
      t('⚠️  首领降临 · BOSS ENCOUNTER  ⚠️', '⚠️  BOSS ENCOUNTER  ⚠️'),
      width / 2 - splitOffset,
      bannerY - 17
    );

    ctx.font = `700 26px ${UI_FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(bossText.name, width / 2 + splitOffset, bannerY + 13);

    ctx.restore();
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
      ctx.lineTo(Math.cos(ang) * 7, Math.sin(ang) * 7);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 4.8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
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
    const slotW = 108;
    const slotH = 36;
    const gap = 12;
    const totalCount = companionSystem ? 3 : 2;
    const totalW = totalCount * slotW + (totalCount - 1) * gap;
    const startX = width / 2 - totalW / 2;
    const y = height - 52;

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
      // 1. 3D Floating Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.beginPath();
      ctx.roundRect(bx + 1, by + 3, slotW, slotH, 6);
      ctx.fill();

      // 2. Dark Steel Outer Casing
      const bgGrad = ctx.createLinearGradient(bx, by, bx, by + slotH);
      bgGrad.addColorStop(0, '#1e293b');
      bgGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.roundRect(bx, by, slotW, slotH, 6);
      ctx.fill();

      // 3. Cylindrical Progress Fill
      if (pct > 0) {
        ctx.fillStyle = ready ? `${accentColor}28` : 'rgba(51, 65, 85, 0.35)';
        ctx.beginPath();
        ctx.roundRect(bx + 1.5, by + 1.5, (slotW - 3) * pct, slotH - 3, 5);
        ctx.fill();
      }

      // 4. Raised Metallic Rim
      ctx.strokeStyle = ready ? 'rgba(226, 232, 240, 0.45)' : 'rgba(71, 85, 105, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(bx, by, slotW, slotH, 6);
      ctx.stroke();

      // 5. Recessed Icon Socket
      ctx.fillStyle = '#050811';
      ctx.beginPath();
      ctx.arc(bx + 19, by + slotH / 2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ready ? accentColor : '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      this.renderVectorIcon(ctx, iconName, bx + 19, by + slotH / 2, 17);

      // 6. Modern Minimalist Key & Cooldown Typography
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ready ? '#f8fafc' : '#94a3b8';
      ctx.font = `600 10px ${UI_FONT}`;
      ctx.fillText(keyLabel, bx + 38, by + 12.5);

      ctx.fillStyle = ready ? accentColor : '#64748b';
      ctx.font = `500 9px ${MONO_FONT}`;
      ctx.fillText(subLabel, bx + 38, by + 24.5);
      ctx.restore();
    };

    // Skill 1: Dash [SPACE]
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
      t('冲刺', 'DASH'),
      dashReady ? 'SPACE' : `${player.dashCooldown.toFixed(1)}s`
    );

    // Skill 2: Ultimate [Q]
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
      t('必杀技', 'ULTIMATE'),
      ultReady ? 'Q / E' : `${Math.ceil(player.ultimateCooldown)}s`
    );

    // Skill 3: Soul Companion Mode [F]
    if (companionSystem) {
      const isAnchored = companionSystem.mode === 'ANCHOR';
      drawSkillPlate(
        startX + (slotW + gap) * 2,
        y,
        1,
        true,
        isAnchored ? '#f43f5e' : '#34d399',
        'attractorb',
        isAnchored ? t('圣灵驻留', 'ANCHOR') : t('圣灵环绕', 'ORBIT'),
        'F'
      );
    }
  }

  private renderSlot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, weapon?: any): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 2, size, size, 4);
    ctx.fill();

    const wellGrad = ctx.createLinearGradient(x, y, x, y + size);
    wellGrad.addColorStop(0, '#04060c');
    wellGrad.addColorStop(1, '#131c31');
    ctx.fillStyle = wellGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 4);
    ctx.fill();

    ctx.strokeStyle = weapon ? (weapon.isEvolved ? '#fbbf24' : 'rgba(148, 163, 184, 0.45)') : 'rgba(51, 65, 85, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (weapon) {
      this.renderVectorIcon(ctx, weapon.iconName, x + size / 2, y + size / 2 - 1, size * 0.68);
      for (let lvl = 0; lvl < weapon.level; lvl++) {
        ctx.fillStyle = weapon.isEvolved ? '#facc15' : '#38bdf8';
        ctx.fillRect(x + 2 + lvl * 2.5, y + size - 3.5, 2, 2);
      }
    }
  }

  private renderPassiveSlot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, passiveEntry?: [string, number]): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 2, size, size, 4);
    ctx.fill();

    const wellGrad = ctx.createLinearGradient(x, y, x, y + size);
    wellGrad.addColorStop(0, '#04060c');
    wellGrad.addColorStop(1, '#131c31');
    ctx.fillStyle = wellGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 4);
    ctx.fill();

    ctx.strokeStyle = passiveEntry ? 'rgba(52, 211, 153, 0.45)' : 'rgba(51, 65, 85, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (passiveEntry) {
      const [id, lvl] = passiveEntry;
      this.renderVectorIcon(ctx, id, x + size / 2, y + size / 2 - 1, size * 0.68);
      for (let l = 0; l < lvl; l++) {
        ctx.fillStyle = '#34d399';
        ctx.fillRect(x + 2 + l * 3.4, y + size - 3.5, 2.5, 2);
      }
    }
  }

  // --- Level Up Modal (Modern Minimalist 3D Slate Cards) ---
  public renderLevelUpModal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: UpgradeOption[],
    selectedIdx: number,
    player?: Player
  ): void {
    ctx.save();

    // 1. Multi-Layer Atmospheric Vignette Backdrop
    const bgGrad = ctx.createRadialGradient(width / 2, height * 0.45, 40, width / 2, height * 0.5, Math.max(width, height) * 0.75);
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.86)');
    bgGrad.addColorStop(0.6, 'rgba(6, 9, 18, 0.94)');
    bgGrad.addColorStop(1, 'rgba(2, 4, 10, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Soft Volumetric Light Shaft descending from top center
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const shaftGrad = ctx.createLinearGradient(width / 2, 0, width / 2, height * 0.82);
    shaftGrad.addColorStop(0, 'rgba(148, 163, 184, 0.10)');
    shaftGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.04)');
    shaftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shaftGrad;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 120, 0);
    ctx.lineTo(width / 2 + 120, 0);
    ctx.lineTo(width / 2 + 300, height * 0.82);
    ctx.lineTo(width / 2 - 300, height * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Modern Minimalist Header Pill
    const crestW = 190;
    const crestH = 32;
    const crestX = width / 2 - crestW / 2;
    const crestY = height * 0.12;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(crestX + 1, crestY + 3, crestW, crestH, 6);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(crestX, crestY, crestW, crestH, 6);
    ctx.fill();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 13px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('选择强化', 'SELECT UPGRADE'), width / 2, crestY + crestH / 2 + 0.5);

    // 4. 3D Sculpted Upgrade Cards
    const cardWidth = Math.min(540, width - 40);
    const cardHeight = 84;
    const cardGap = 14;
    const startY = height * 0.21;

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const cx = width / 2 - cardWidth / 2;
      const cy = startY + i * (cardHeight + cardGap);
      const isHovered = (i === selectedIdx) || (i === this.hoveredUpgradeIndex);

      this.renderUpgradeCard(ctx, cx, cy, cardWidth, cardHeight, opt, i + 1, isHovered);
    }

    // 5. 3D Beveled Meta Control Plates (REROLL [R], SKIP [S], BANISH [B])
    if (player) {
      const bottomY = startY + options.length * (cardHeight + cardGap) + 18;
      const btnW = 148;
      const btnH = 36;
      const btnGap = 18;
      const totalBtnW = btnW * 3 + btnGap * 2;
      const btnStartX = width / 2 - totalBtnW / 2;

      const buttons: Array<{
        id: string;
        label: string;
        count: number;
        key: string;
        x: number;
        accent: string;
      }> = [
        {
          id: 'reroll',
          label: t('重掷', 'REROLL'),
          count: player.rerollsRemaining,
          key: 'R',
          x: btnStartX,
          accent: '#38bdf8'
        },
        {
          id: 'skip',
          label: t('跳过', 'SKIP'),
          count: player.skipsRemaining,
          key: 'S',
          x: btnStartX + btnW + btnGap,
          accent: '#34d399'
        },
        {
          id: 'banish',
          label: t('放逐', 'BANISH'),
          count: player.banishesRemaining,
          key: 'B',
          x: btnStartX + (btnW + btnGap) * 2,
          accent: '#f87171'
        }
      ];

      for (const b of buttons) {
        const isHov = this.hoveredButton === b.id;
        const active = b.count > 0;
        const yOff = isHov && active ? -1.5 : 0;

        // 3D Drop Shadow & Bottom Lip
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.roundRect(b.x + 1, bottomY + 3, btnW, btnH, 6);
        ctx.fill();

        const bGrad = ctx.createLinearGradient(b.x, bottomY + yOff, b.x, bottomY + btnH + yOff);
        bGrad.addColorStop(0, isHov && active ? '#1e293b' : '#131c2e');
        bGrad.addColorStop(1, '#080c16');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.roundRect(b.x, bottomY + yOff, btnW, btnH, 6);
        ctx.fill();

        ctx.strokeStyle = active
          ? isHov
            ? '#e2e8f0'
            : 'rgba(148, 163, 184, 0.35)'
          : 'rgba(51, 65, 85, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Small Minimalist Status Dot on left
        ctx.fillStyle = active ? b.accent : '#475569';
        ctx.beginPath();
        ctx.arc(b.x + 16, bottomY + btnH / 2 + yOff, 3, 0, Math.PI * 2);
        ctx.fill();

        // Button Label & Count
        ctx.fillStyle = active ? '#e2e8f0' : '#475569';
        ctx.font = `600 11px ${UI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${b.label} ${b.count} [${b.key}]`, b.x + btnW / 2 + 4, bottomY + btnH / 2 + yOff);
      }
    }

    ctx.restore();
  }

  private renderUpgradeCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    opt: UpgradeOption,
    keyNum: number,
    isHovered: boolean
  ): void {
    ctx.save();

    const liftY = isHovered ? -2 : 0;
    const cy = y + liftY;

    // 1. Deep Floating Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 5, w, h, 8);
    ctx.fill();

    // 2. 3D Extruded Bottom Lip
    ctx.fillStyle = '#050811';
    ctx.beginPath();
    ctx.roundRect(x, cy + 3, w, h, 8);
    ctx.fill();

    // 3. Beveled Dark-Slate Tablet Body
    const bgGrad = ctx.createLinearGradient(x, cy, x, cy + h);
    if (isHovered) {
      bgGrad.addColorStop(0, '#1e293b');
      bgGrad.addColorStop(1, '#0f172a');
    } else {
      bgGrad.addColorStop(0, '#131c2e');
      bgGrad.addColorStop(1, '#080c17');
    }
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(x, cy, w, h, 8);
    ctx.fill();

    // Top Edge Specular Highlight
    ctx.fillStyle = isHovered ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(x + 8, cy + 1, w - 16, 1);

    // Clean Modern Border
    ctx.strokeStyle = isHovered ? '#e2e8f0' : 'rgba(148, 163, 184, 0.24)';
    ctx.lineWidth = isHovered ? 1.6 : 1;
    ctx.stroke();

    // 4. Key Shortcut Badge
    const coinX = x + 23;
    const coinY = cy + h / 2;
    ctx.fillStyle = isHovered ? '#e2e8f0' : '#090d16';
    ctx.beginPath();
    ctx.arc(coinX, coinY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isHovered ? '#090d16' : '#94a3b8';
    ctx.font = `600 11px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${keyNum}`, coinX, coinY + 0.5);

    // 5. 3D Recessed Icon Socket
    const iconBoxSize = 46;
    const iconBoxX = x + 44;
    const iconBoxY = cy + (h - iconBoxSize) / 2;

    ctx.fillStyle = '#050811';
    ctx.beginPath();
    ctx.roundRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 6);
    ctx.fill();

    ctx.strokeStyle = isHovered ? 'rgba(226, 232, 240, 0.5)' : 'rgba(71, 85, 105, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    this.renderVectorIcon(ctx, opt.iconName, iconBoxX + iconBoxSize / 2, iconBoxY + iconBoxSize / 2, iconBoxSize * 0.7);

    // 6. Modern Minimalist Title & Level Pill
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 15px ${UI_FONT}`;
    ctx.fillText(opt.name, x + 102, cy + 16);

    const isNew = opt.levelText === 'NEW!';
    const nameWidth = ctx.measureText(opt.name).width;
    const badgeX = x + 102 + nameWidth + 8;
    const badgeY = cy + 16;
    ctx.fillStyle = isNew ? 'rgba(34, 197, 94, 0.14)' : 'rgba(56, 189, 248, 0.14)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, 42, 16, 3);
    ctx.fill();

    ctx.fillStyle = isNew ? '#4ade80' : '#38bdf8';
    ctx.font = `600 9px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isNew ? t('新获得', 'NEW') : opt.levelText, badgeX + 21, badgeY + 8.5);

    // 7. Minimalist 3D Faceted Tag Gems on Top-Right
    if (opt.tags && opt.tags.length > 0) {
      let gemX = x + w - 18;
      const gemY = cy + 23;
      for (let tIdx = opt.tags.length - 1; tIdx >= 0; tIdx--) {
        const tag = opt.tags[tIdx];
        const meta = TAG_METADATA[tag];
        if (!meta) continue;

        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(gemX, gemY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = meta.color;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = meta.color;
        ctx.beginPath();
        ctx.moveTo(gemX, gemY - 3.5);
        ctx.lineTo(gemX + 3.5, gemY);
        ctx.lineTo(gemX, gemY + 3.5);
        ctx.lineTo(gemX - 3.5, gemY);
        ctx.closePath();
        ctx.fill();

        gemX -= 18;
      }
    }

    // 8. Clean Single-Line Description
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `400 12px ${UI_FONT}`;
    ctx.fillText(opt.description, x + 102, cy + 44);

    ctx.restore();
  }

  // --- Boss Chest Modal (Modern Minimalist 3D Showcase) ---
  public renderBossChestModal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    reward: UpgradeOption | null
  ): void {
    ctx.save();

    const bgGrad = ctx.createRadialGradient(width / 2, height * 0.45, 30, width / 2, height * 0.45, Math.max(width, height) * 0.75);
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
    bgGrad.addColorStop(0.6, 'rgba(7, 9, 18, 0.95)');
    bgGrad.addColorStop(1, 'rgba(2, 3, 8, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Rotating Volumetric Light Rays
    const rays = 12;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(width / 2, height * 0.44);
    ctx.rotate(this.chestOpenProgress * 1.2);
    for (let r = 0; r < rays; r++) {
      ctx.fillStyle = r % 2 === 0 ? 'rgba(251, 191, 36, 0.06)' : 'rgba(56, 189, 248, 0.03)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 380, (r * Math.PI * 2) / rays, ((r + 0.5) * Math.PI * 2) / rays);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 3D Sculpted Relic Pedestal Card
    const cardW = 360;
    const cardH = 280;
    const cardX = width / 2 - cardW / 2;
    const cardY = height * 0.22;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.beginPath();
    ctx.roundRect(cardX + 3, cardY + 7, cardW, cardH, 10);
    ctx.fill();

    const pGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    pGrad.addColorStop(0, '#1e293b');
    pGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 11px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(t('圣物秘匣奖励', 'RELIQUARY REWARD'), width / 2, cardY + 32);

    if (reward) {
      const isEvo = reward.type === 'EVOLUTION';
      ctx.fillStyle = isEvo ? '#f43f5e' : '#38bdf8';
      ctx.font = `600 11px ${UI_FONT}`;
      ctx.fillText(isEvo ? t('神兵进化', 'WEAPON EVOLVED') : t('装备强化', 'ITEM UPGRADED'), width / 2, cardY + 52);

      // 3D Recessed Icon Medallion Socket
      const sockR = 42;
      const sockY = cardY + 116;
      ctx.fillStyle = '#050811';
      ctx.beginPath();
      ctx.arc(width / 2, sockY, sockR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isEvo ? '#f43f5e' : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      this.renderVectorIcon(ctx, reward.iconName, width / 2, sockY, 52);

      ctx.fillStyle = '#f8fafc';
      ctx.font = `600 18px ${UI_FONT}`;
      ctx.fillText(reward.name, width / 2, cardY + 190);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `400 12px ${UI_FONT}`;
      this.wrapText(ctx, reward.description, cardX + 26, cardY + 216, cardW - 52, 17);
    } else {
      ctx.fillStyle = '#fde047';
      ctx.font = `600 20px ${UI_FONT}`;
      ctx.fillText(t('+250 金币', '+250 GOLD'), width / 2, cardY + 145);
    }

    // 3D Beveled Claim Button
    const btnW = 180;
    const btnH = 44;
    const btnX = width / 2 - btnW / 2;
    const btnY = cardY + cardH + 22;
    const isHov = this.hoveredButton === 'claim';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(btnX + 2, btnY + 4, btnW, btnH, 6);
    ctx.fill();

    ctx.fillStyle = isHov ? '#1e293b' : '#0f172a';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 6);
    ctx.fill();

    ctx.strokeStyle = isHov ? '#e2e8f0' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 13px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('继续 [空格]', 'CONTINUE [SPACE]'), width / 2, btnY + btnH / 2 + 0.5);

    ctx.restore();
  }

  // --- Game Over Screen (Modern Minimalist Summary Tablet & Visual DPS Bars) ---
  public renderGameOver(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: Player
  ): void {
    ctx.save();

    const vGrad = ctx.createRadialGradient(width / 2, height * 0.35, 30, width / 2, height * 0.5, Math.max(width, height) * 0.75);
    vGrad.addColorStop(0, 'rgba(20, 12, 18, 0.92)');
    vGrad.addColorStop(0.6, 'rgba(8, 8, 14, 0.96)');
    vGrad.addColorStop(1, 'rgba(2, 3, 6, 0.98)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, width, height);

    // Clean Modern Title
    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 32px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(t('征途终结', 'RUN ENDED'), width / 2, height * 0.14);

    // 3D Sculpted Summary Tablet
    const boxW = Math.min(540, width - 40);
    const boxH = 340;
    const boxX = width / 2 - boxW / 2;
    const boxY = height * 0.19;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.beginPath();
    ctx.roundRect(boxX + 3, boxY + 6, boxW, boxH, 10);
    ctx.fill();

    const tabGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
    tabGrad.addColorStop(0, '#151e30');
    tabGrad.addColorStop(1, '#080c16');
    ctx.fillStyle = tabGrad;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Recessed Stat Plaques (Top Row of 4 Metrics)
    const mins = Math.floor(player.timeSurvived / 60);
    const secs = Math.floor(player.timeSurvived % 60);
    const metrics = [
      { label: t('存活时间', 'TIME'), val: `${mins}m ${secs}s`, color: '#f8fafc' },
      { label: t('击败敌人', 'SLAIN'), val: `${player.kills}`, color: '#f8fafc' },
      { label: t('最终等级', 'LEVEL'), val: `LV ${player.level}`, color: '#38bdf8' },
      { label: t('获取金币', 'GOLD'), val: `+${player.gold}`, color: '#fde047' }
    ];

    const tileW = (boxW - 48 - 30) / 4;
    const tileH = 54;
    const tileY = boxY + 20;

    for (let m = 0; m < metrics.length; m++) {
      const tx = boxX + 24 + m * (tileW + 10);
      ctx.fillStyle = '#050811';
      ctx.beginPath();
      ctx.roundRect(tx, tileY, tileW, tileH, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = `500 10px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(metrics[m].label, tx + tileW / 2, tileY + 18);

      ctx.fillStyle = metrics[m].color;
      ctx.font = `600 14px ${MONO_FONT}`;
      ctx.fillText(metrics[m].val, tx + tileW / 2, tileY + 40);
    }

    // Weapons Damage Breakdown with Cylindrical Proportion Bars
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = `600 11px ${UI_FONT}`;
    ctx.fillText(t('伤害统计', 'DAMAGE BREAKDOWN'), boxX + 24, boxY + 98);

    let maxWeaponDmg = 1;
    for (const wep of player.weapons) {
      if (wep.totalDamageDealt > maxWeaponDmg) maxWeaponDmg = wep.totalDamageDealt;
    }

    for (let w = 0; w < player.weapons.length; w++) {
      const wep = player.weapons[w];
      const wy = boxY + 114 + w * 34;
      const ratio = Math.max(0.02, Math.min(1, wep.totalDamageDealt / maxWeaponDmg));

      this.renderVectorIcon(ctx, wep.iconName, boxX + 34, wy + 10, 20);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = `500 12px ${UI_FONT}`;
      ctx.textAlign = 'left';
      const wepDisplayName = getWeaponDisplayName(wep.id, wep.isEvolved);
      ctx.fillText(`${wepDisplayName} · LV ${wep.level}`, boxX + 52, wy + 8);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `500 10px ${MONO_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(
        `${wep.totalDamageDealt} ${t('伤害', 'DMG')}  (${wep.totalKills})`,
        boxX + boxW - 24,
        wy + 8
      );

      const barX = boxX + 52;
      const barY = wy + 15;
      const barW = boxW - 76;
      const barH = 5;

      ctx.fillStyle = '#04060c';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 2.5);
      ctx.fill();

      const fillGrad = ctx.createLinearGradient(barX, barY, barX + barW * ratio, barY);
      fillGrad.addColorStop(0, '#38bdf8');
      fillGrad.addColorStop(1, '#818cf8');
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * ratio, barH, 2.5);
      ctx.fill();
    }

    // 3D Beveled Play Again Button
    const btnW = 200;
    const btnH = 46;
    const btnX = width / 2 - btnW / 2;
    const btnY = boxY + boxH + 24;
    const isHov = this.hoveredButton === 'restart';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    ctx.roundRect(btnX + 2, btnY + 4, btnW, btnH, 6);
    ctx.fill();

    ctx.fillStyle = isHov ? '#1e293b' : '#0f172a';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 6);
    ctx.fill();

    ctx.strokeStyle = isHov ? '#e2e8f0' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 13px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('再次出征', 'PLAY AGAIN'), width / 2, btnY + btnH / 2 + 0.5);

    ctx.restore();
  }

  // --- Title & Character Select Screen (Modern Minimalist Dark Sanctuary) ---
  public renderCharacterSelect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    selectedCharId: string
  ): void {
    ctx.save();
    const timeSec = Date.now() * 0.001;

    // 1. Deep Atmospheric Sanctuary Backdrop
    const skyGrad = ctx.createRadialGradient(width / 2, height * 0.2, 20, width / 2, height * 0.45, Math.max(width, height) * 0.85);
    skyGrad.addColorStop(0, '#161b2e');
    skyGrad.addColorStop(0.5, '#0b0e1a');
    skyGrad.addColorStop(1, '#04060c');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Volumetric Cathedral Light Shafts (God Rays)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let s = 0; s < 3; s++) {
      const rayX = width * (0.24 + s * 0.24) + Math.sin(timeSec * 0.4 + s) * 18;
      const rayW = 110 + (s % 2) * 40;
      const rayGrad = ctx.createLinearGradient(rayX, 0, rayX + 180, height * 0.85);
      rayGrad.addColorStop(0, 'rgba(148, 163, 184, 0.07)');
      rayGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.025)');
      rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(rayX - rayW * 0.4, 0);
      ctx.lineTo(rayX + rayW * 0.4, 0);
      ctx.lineTo(rayX + 220 + rayW * 0.7, height * 0.88);
      ctx.lineTo(rayX + 220 - rayW * 0.7, height * 0.88);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Subtle Floating Dust Motes in Background
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let e = 0; e < 18; e++) {
      const ex = ((e * 197 + Math.sin(timeSec + e) * 35) % width + width) % width;
      const ey = ((height - ((timeSec * (18 + (e % 12)) + e * 83) % height)) + height) % height;
      const er = 1.2 + (e % 2) * 0.6;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.22)';
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Top-Right 3D Settings & Audio Buttons on Title Screen
    const topBtnY = 22;
    const btnSize = 30;
    const settingsBtnX = width - 88;
    const isSettingsHov = this.hoveredButton === 'open_settings';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(settingsBtnX + 1, topBtnY + 2, btnSize, btnSize, 5);
    ctx.fill();
    ctx.fillStyle = isSettingsHov ? '#1e293b' : 'rgba(13, 18, 30, 0.85)';
    ctx.beginPath();
    ctx.roundRect(settingsBtnX, topBtnY, btnSize, btnSize, 5);
    ctx.fill();
    ctx.strokeStyle = isSettingsHov ? '#e2e8f0' : 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    this.renderGearIcon(ctx, settingsBtnX + btnSize / 2, topBtnY + btnSize / 2, isSettingsHov ? '#f8fafc' : '#94a3b8');

    const soundBtnX = width - 50;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(soundBtnX + 1, topBtnY + 2, btnSize, btnSize, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(13, 18, 30, 0.85)';
    ctx.beginPath();
    ctx.roundRect(soundBtnX, topBtnY, btnSize, btnSize, 5);
    ctx.fill();
    ctx.strokeStyle = this.sound.isMuted ? 'rgba(239, 68, 68, 0.45)' : 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.translate(soundBtnX + btnSize / 2, topBtnY + btnSize / 2);
    ctx.strokeStyle = this.sound.isMuted ? '#64748b' : '#e2e8f0';
    ctx.fillStyle = this.sound.isMuted ? '#64748b' : '#e2e8f0';
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
      ctx.beginPath();
      ctx.arc(2.5, 0, 3.5, -0.7, 0.7);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Clean, Modern Minimalist Title Typography (Zero yellow-red poster gradients)
    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 38px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(t('血色圣果', 'BLOODYBERRY'), width / 2, height * 0.11);

    // Subtle Minimalist Hairline Divider
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 90, height * 0.138);
    ctx.lineTo(width / 2 + 90, height * 0.138);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = `500 11px ${UI_FONT}`;
    ctx.fillText(t('绯红圣所 · 暗黑幸存者', 'CRIMSON SANCTUARY'), width / 2, height * 0.165);

    // 3. Characters Grid (3D Sculpted Hero Tablets)
    const cardW = 168;
    const cardH = 232;
    const gap = 16;
    const totalW = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
    const startX = Math.max(20, width / 2 - totalW / 2);
    const startY = height * 0.215;

    for (let i = 0; i < CHARACTERS.length; i++) {
      const char = CHARACTERS[i];
      const cx = startX + i * (cardW + gap);
      const cy = startY;
      const isUnlocked = this.saveManager.isCharacterUnlocked(char.id);
      const isSelected = char.id === selectedCharId;
      const isHovered = i === this.hoveredCharacterIndex;

      this.renderCharacterCard(ctx, cx, cy, cardW, cardH, char, isUnlocked, isSelected, isHovered);
    }

    // 4. Modern 3D Beveled Start Button
    const btnW = 240;
    const btnH = 50;
    const btnX = width / 2 - btnW / 2;
    const btnY = startY + cardH + 38;
    const isStartHov = this.hoveredButton === 'start';
    const bLift = isStartHov ? -1.5 : 0;

    // 3D Drop Shadow & Extruded Bottom Lip
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(btnX + 2, btnY + 5, btnW, btnH, 8);
    ctx.fill();

    ctx.fillStyle = '#050811';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY + 3 + bLift, btnW, btnH, 8);
    ctx.fill();

    const btnGrad = ctx.createLinearGradient(btnX, btnY + bLift, btnX, btnY + btnH + bLift);
    if (isStartHov) {
      btnGrad.addColorStop(0, '#26334d');
      btnGrad.addColorStop(1, '#111827');
    } else {
      btnGrad.addColorStop(0, '#1e293b');
      btnGrad.addColorStop(1, '#0f172a');
    }
    ctx.fillStyle = btnGrad;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY + bLift, btnW, btnH, 8);
    ctx.fill();

    // Top Specular Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(btnX + 8, btnY + 1.5 + bLift, btnW - 16, 1);

    ctx.strokeStyle = isStartHov ? '#f8fafc' : 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 14px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('踏入圣所', 'ENTER SANCTUARY'), width / 2, btnY + btnH / 2 + 0.5 + bLift);

    ctx.restore();
  }

  private renderCharacterCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    char: CharacterInfo,
    isUnlocked: boolean,
    isSelected: boolean,
    isHovered: boolean
  ): void {
    ctx.save();

    const liftY = isSelected ? -4 : isHovered ? -2 : 0;
    const cy = y + liftY;

    // 1. Deep Floating Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 6, w, h, 8);
    ctx.fill();

    // 2. 3D Extruded Bottom Lip
    ctx.fillStyle = '#04060c';
    ctx.beginPath();
    ctx.roundRect(x, cy + 3.5, w, h, 8);
    ctx.fill();

    // 3. Beveled Dark-Slate Tablet Body
    const cardGrad = ctx.createLinearGradient(x, cy, x, cy + h);
    if (isSelected) {
      cardGrad.addColorStop(0, '#1e293b');
      cardGrad.addColorStop(1, '#0b1120');
    } else if (isHovered) {
      cardGrad.addColorStop(0, '#172033');
      cardGrad.addColorStop(1, '#090d16');
    } else {
      cardGrad.addColorStop(0, '#111827');
      cardGrad.addColorStop(1, '#060911');
    }
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    ctx.roundRect(x, cy, w, h, 8);
    ctx.fill();

    // Top Edge Specular Highlight
    ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.07)';
    ctx.fillRect(x + 8, cy + 1, w - 16, 1);

    // Clean Modern Frame
    ctx.strokeStyle = isSelected ? '#e2e8f0' : isHovered ? 'rgba(148, 163, 184, 0.5)' : 'rgba(51, 65, 85, 0.5)';
    ctx.lineWidth = isSelected ? 1.8 : 1;
    ctx.stroke();

    // 4. 3D Recessed Portrait Medallion Well
    const pSize = 68;
    const px = x + (w - pSize) / 2;
    const py = cy + 16;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.arc(px + pSize / 2 + 1, py + pSize / 2 + 2, pSize / 2, 0, Math.PI * 2);
    ctx.fill();

    const pGrad = ctx.createRadialGradient(px + pSize / 2, py + pSize / 2, 4, px + pSize / 2, py + pSize / 2, pSize / 2);
    pGrad.addColorStop(0, `${char.color}66`);
    pGrad.addColorStop(1, '#04060c');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(px + pSize / 2, py + pSize / 2, pSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#e2e8f0' : 'rgba(100, 116, 139, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Render animated hero sprite inside portrait
    const animFrame = Math.floor(Date.now() / 200) % 4;
    SpriteRenderer.getInstance().drawSprite(
      ctx,
      `hero_${char.id}`,
      animFrame,
      px + pSize / 2,
      py + pSize / 2 - 2,
      50,
      50,
      1,
      false
    );

    // 3D Starting Weapon Socket on Bottom-Right of Portrait
    ctx.fillStyle = '#060911';
    ctx.beginPath();
    ctx.arc(px + pSize - 6, py + pSize - 6, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    this.renderVectorIcon(ctx, char.startingWeapon, px + pSize - 6, py + pSize - 6, 16);

    const charText = getCharacterText(char.id);

    // Clean Modern Name & Subtitle
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 15px ${UI_FONT}`;
    ctx.fillText(charText.name, x + w / 2, py + pSize + 22);

    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 10px ${UI_FONT}`;
    ctx.fillText(charText.title, x + w / 2, py + pSize + 37);

    // Trait & Ultimate Description
    ctx.font = `400 10.5px ${UI_FONT}`;
    ctx.fillStyle = '#64748b';
    this.wrapText(ctx, charText.traitDescription, x + 12, py + pSize + 55, w - 24, 15);

    ctx.restore();
  }

  // --- Modern Minimalist 3D Settings Modal (Language & Audio & Navigation) ---
  public renderSettingsModal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isInGame: boolean
  ): void {
    ctx.save();

    // 1. Deep Frosted Backdrop
    ctx.fillStyle = 'rgba(3, 6, 14, 0.82)';
    ctx.fillRect(0, 0, width, height);

    const panelW = 396;
    const panelH = isInGame ? 358 : 302;
    const panelX = width / 2 - panelW / 2;
    const panelY = height / 2 - panelH / 2;

    // 2. 3D Drop Shadow & Beveled Dark-Slate Tablet
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.beginPath();
    ctx.roundRect(panelX + 3, panelY + 7, panelW, panelH, 10);
    ctx.fill();

    const pGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    pGrad.addColorStop(0, '#162033');
    pGrad.addColorStop(1, '#080c16');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(panelX + 10, panelY + 1, panelW - 20, 1);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 3. Header Title
    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 16px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('设置', 'SETTINGS'), width / 2, panelY + 32);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 24, panelY + 54);
    ctx.lineTo(panelX + panelW - 24, panelY + 54);
    ctx.stroke();

    // 4. Language Row (语言 / LANGUAGE)
    const row1Y = panelY + 84;
    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 13px ${UI_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(t('语言 / Language', 'Language / 语言'), panelX + 28, row1Y);

    const langBtnW = 92;
    const langBtnH = 32;
    const zhBtnX = panelX + panelW - 28 - langBtnW * 2 - 10;
    const enBtnX = panelX + panelW - 28 - langBtnW;
    const langBtnY = row1Y - langBtnH / 2;

    const renderTogglePill = (
      bx: number,
      by: number,
      bw: number,
      bh: number,
      label: string,
      isActive: boolean,
      isHov: boolean
    ) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(bx + 1, by + 2, bw, bh, 6);
      ctx.fill();

      ctx.fillStyle = isActive ? '#1e293b' : isHov ? '#151e30' : '#090d16';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 6);
      ctx.fill();

      ctx.strokeStyle = isActive
        ? '#38bdf8'
        : isHov
          ? 'rgba(226, 232, 240, 0.5)'
          : 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = isActive ? 1.5 : 1;
      ctx.stroke();

      ctx.fillStyle = isActive ? '#f8fafc' : '#94a3b8';
      ctx.font = `600 12px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + bw / 2, by + bh / 2 + 0.5);
    };

    renderTogglePill(
      zhBtnX,
      langBtnY,
      langBtnW,
      langBtnH,
      '简体中文',
      i18n.lang === 'zh',
      this.hoveredButton === 'lang_zh'
    );
    renderTogglePill(
      enBtnX,
      langBtnY,
      langBtnW,
      langBtnH,
      'English',
      i18n.lang === 'en',
      this.hoveredButton === 'lang_en'
    );

    // 5. Audio Row (音效 / SOUND)
    const row2Y = panelY + 132;
    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 13px ${UI_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(t('音效', 'Sound Effects'), panelX + 28, row2Y);

    const audioBtnW = 194;
    const audioBtnH = 32;
    const audioBtnX = panelX + panelW - 28 - audioBtnW;
    const audioBtnY = row2Y - audioBtnH / 2;
    const isMuted = this.sound.isMuted;
    renderTogglePill(
      audioBtnX,
      audioBtnY,
      audioBtnW,
      audioBtnH,
      isMuted ? t('已静音 (点击开启)', 'MUTED (CLICK TO UNMUTE)') : t('已开启 (点击静音)', 'ON (CLICK TO MUTE)'),
      !isMuted,
      this.hoveredButton === 'toggle_audio'
    );

    // 5b. BGM Style Row (背景音乐曲风 / BGM STYLE)
    const row3Y = panelY + 180;
    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 13px ${UI_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(t('背景音乐', 'BGM Style'), panelX + 28, row3Y);

    const bgmLabels: Record<string, { zh: string; en: string }> = {
      BAROQUE: { zh: '♪ 哥特交响 (默认)', en: '♪ Gothic Symphony (Default)' },
      DEFAULT: { zh: '♪ 经典原版 Classic', en: '♪ Classic Original' },
      SYNTHWAVE: { zh: '♪ 暗潮电音 Synthwave', en: '♪ Dark Synthwave' },
      ETHEREAL: { zh: '♪ 空灵星界 Ethereal', en: '♪ Ethereal Fantasy' },
      CHIPTUNE_PRO: { zh: '♪ 16位街机 Chiptune', en: '♪ 16-Bit Arcade' },
      AUTO: { zh: '♪ 随场景智能轮换', en: '♪ Auto-Biome Cycle' }
    };
    const curStyle = this.sound.bgmStyle || 'BAROQUE';
    const bgmLabel = bgmLabels[curStyle] || bgmLabels.BAROQUE;
    const bgmBtnY = row3Y - audioBtnH / 2;
    renderTogglePill(
      audioBtnX,
      bgmBtnY,
      audioBtnW,
      audioBtnH,
      t(bgmLabel.zh, bgmLabel.en),
      true,
      this.hoveredButton === 'cycle_bgm_style'
    );

    // 6. Bottom Action Buttons
    const actionBtnW = panelW - 56;
    const actionBtnH = 40;
    const actionBtnX = panelX + 28;
    const resumeBtnY = panelY + 232;

    renderTogglePill(
      actionBtnX,
      resumeBtnY,
      actionBtnW,
      actionBtnH,
      t('返回游戏 [ESC]', 'RESUME [ESC]'),
      false,
      this.hoveredButton === 'close_settings'
    );

    if (isInGame) {
      const quitBtnY = panelY + 286;
      renderTogglePill(
        actionBtnX,
        quitBtnY,
        actionBtnW,
        actionBtnH,
        t('返回主菜单', 'RETURN TO TITLE'),
        false,
        this.hoveredButton === 'quit_to_title'
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

  // --- Procedural High-Detail Vector Icons for all Weapons & Passives ---
  private renderVectorIcon(ctx: CanvasRenderingContext2D, icon: string, x: number, y: number, size: number): void {
    ctx.save();
    ctx.translate(x, y);
    const r = size / 2;

    // Subtle radial icon glow backdrop
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

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
