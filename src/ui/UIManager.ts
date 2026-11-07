import { Player } from '../entities/Player';
import { Camera } from '../core/Camera';
import { SoundSynthesizer } from '../core/SoundSynthesizer';
import { ALL_WEAPON_DEFINITIONS } from '../weapons/WeaponRegistry';
import { PASSIVE_DEFINITIONS } from '../passives/PassiveRegistry';
import { CHARACTERS, CharacterInfo } from '../persistence/CharacterSelect';
import { SaveManager } from '../persistence/SaveManager';

export interface UpgradeOption {
  type: 'WEAPON' | 'PASSIVE' | 'EVOLUTION';
  id: string;
  name: string;
  levelText: string;
  description: string;
  iconName: string;
}

export class UIManager {
  public hoveredUpgradeIndex = -1;
  public hoveredCharacterIndex = -1;
  public hoveredButton: string | null = null;

  // Chest animation
  public chestOpenProgress = 0;
  public chestRewardOptions: UpgradeOption[] = [];

  // Card hover animation progress (for smooth GSAP-like interpolation)
  private cardHoverProgress: number[] = [0, 0, 0, 0];

  constructor(
    private saveManager: SaveManager,
    private sound: SoundSynthesizer
  ) {}

  // --- HUD Rendering ---
  public renderHUD(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: Player,
    elapsedSeconds: number,
    isFrozen: boolean,
    hasBoss?: boolean
  ): void {
    ctx.save();

    // 1. Top Experience Bar (Crystal Neon Bar)
    const xpPercent = Math.max(0, Math.min(1, player.xp / player.nextLevelXp));
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, 20);

    const xpGrad = ctx.createLinearGradient(0, 0, width, 0);
    xpGrad.addColorStop(0, '#0284c7');
    xpGrad.addColorStop(0.5, '#38bdf8');
    xpGrad.addColorStop(1, '#67e8f9');
    ctx.fillStyle = xpGrad;
    ctx.fillRect(0, 0, width * xpPercent, 20);

    // XP Bar Glass Gloss Highlight (top 40%)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(0, 0, width * xpPercent, 8);

    // XP Bar Golden Border
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(width, 20);
    ctx.stroke();

    // XP text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Cinzel", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(`LEVEL ${player.level}   ✦   ${Math.floor(player.xp)} / ${player.nextLevelXp} XP`, width / 2, 10);

    // 2. Timer & Counters (Center below XP bar)
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = Math.floor(elapsedSeconds % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    ctx.font = '900 24px "Cinzel", serif';
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.fillText(timeStr, width / 2, 44);

    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`💀 ${player.kills}`, width / 2 - 80, 44);

    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`💰 ${player.gold}`, width / 2 + 80, 44);

    // 3. Top Left Health Bar & Inventory Slots
    const hpBarW = 175;
    const hpBarH = 18;
    const hpX = 22;
    const hpY = 32;

    // Dark Ornate Beveled Plate
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(hpX - 2, hpY - 2, hpBarW + 4, hpBarH + 4, 6);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // HP Fill Gradient
    const hpPct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    const hpGrad = ctx.createLinearGradient(hpX, 0, hpX + hpBarW, 0);
    if (hpPct > 0.5) {
      hpGrad.addColorStop(0, '#15803d');
      hpGrad.addColorStop(1, '#22c55e');
    } else if (hpPct > 0.25) {
      hpGrad.addColorStop(0, '#b45309');
      hpGrad.addColorStop(1, '#f59e0b');
    } else {
      hpGrad.addColorStop(0, '#7f1d1d');
      hpGrad.addColorStop(1, '#ef4444');
    }
    ctx.fillStyle = hpGrad;
    ctx.beginPath();
    ctx.roundRect(hpX, hpY, hpBarW * hpPct, hpBarH, 4);
    ctx.fill();

    // Glass specular gloss on HP bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.roundRect(hpX, hpY, hpBarW * hpPct, hpBarH * 0.45, 3);
    ctx.fill();

    // HP Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Cinzel", -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowBlur = 4;
    ctx.fillText(`${Math.round(player.hp)} / ${player.maxHp} HP`, hpX + 8, hpY + 11);

    // Weapon Inventory Slots (Row 1)
    const slotSize = 25;
    const slotMargin = 5;
    for (let i = 0; i < player.maxWeaponSlots; i++) {
      const sx = hpX + i * (slotSize + slotMargin);
      const sy = hpY + 26;
      this.renderSlot(ctx, sx, sy, slotSize, player.weapons[i]);
    }

    // Passive Inventory Slots (Row 2)
    const passiveKeys = Array.from(player.passives.entries());
    for (let i = 0; i < player.maxPassiveSlots; i++) {
      const sx = hpX + i * (slotSize + slotMargin);
      const sy = hpY + 26 + slotSize + slotMargin;
      const passiveData = passiveKeys[i];
      this.renderPassiveSlot(ctx, sx, sy, slotSize, passiveData);
    }

    // 4. Top Right Buttons (Sound & Pause)
    const btnSize = 34;
    const soundBtnX = width - 85;
    const soundBtnY = 30;

    // Sound button with beveled dark fantasy border
    ctx.fillStyle = this.hoveredButton === 'sound' ? '#1e293b' : 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(soundBtnX, soundBtnY, btnSize, btnSize, 6);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = player.isDead ? '#64748b' : '#38bdf8';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.sound.isMuted ? '🔇' : '🔊', soundBtnX + btnSize / 2, soundBtnY + btnSize / 2);

    // Frozen Map Frost Border
    if (isFrozen) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 12;
      ctx.strokeRect(0, 0, width, height);
    }

    // Flashing Boss Warning Banner
    if (hasBoss) {
      const pulse = (Math.sin(Date.now() * 0.008) + 1) / 2;
      ctx.fillStyle = `rgba(185, 28, 28, ${0.5 + pulse * 0.4})`;
      ctx.fillRect(0, 24, width, 28);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, 24, width, 28);

      ctx.fillStyle = '#fef08a';
      ctx.font = '900 14px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 8;
      ctx.fillText('⚔ WARNING: ELITE DEMON LORD DETECTED ⚔', width / 2, 38);
    }

    ctx.restore();
  }

  private renderSlot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, weapon?: any): void {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 4);
    ctx.fill();

    ctx.strokeStyle = weapon ? (weapon.isEvolved ? '#fbbf24' : '#38bdf8') : '#334155';
    ctx.lineWidth = weapon ? 2 : 1;
    ctx.stroke();

    if (weapon) {
      this.renderVectorIcon(ctx, weapon.iconName, x + size / 2, y + size / 2, size * 0.72);
      // Level dots
      for (let lvl = 0; lvl < weapon.level; lvl++) {
        ctx.fillStyle = weapon.isEvolved ? '#facc15' : '#60a5fa';
        ctx.fillRect(x + 2 + lvl * 2.6, y + size - 3.5, 2.2, 2.2);
      }
    }
  }

  private renderPassiveSlot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, passiveEntry?: [string, number]): void {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 4);
    ctx.fill();

    ctx.strokeStyle = passiveEntry ? '#10b981' : '#334155';
    ctx.lineWidth = passiveEntry ? 2 : 1;
    ctx.stroke();

    if (passiveEntry) {
      const [id, lvl] = passiveEntry;
      this.renderVectorIcon(ctx, id, x + size / 2, y + size / 2, size * 0.72);
      for (let l = 0; l < lvl; l++) {
        ctx.fillStyle = '#34d399';
        ctx.fillRect(x + 2 + l * 3.6, y + size - 3.5, 2.8, 2.2);
      }
    }
  }

  // --- Level Up Modal (AAA Commercial Dark Fantasy Cards) ---
  public renderLevelUpModal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: UpgradeOption[],
    selectedIdx: number,
    player?: Player
  ): void {
    ctx.save();

    // Dark gothic vignette backdrop
    ctx.fillStyle = 'rgba(4, 4, 10, 0.88)';
    ctx.fillRect(0, 0, width, height);

    // Title Banner with Gothic Typography
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 42px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#d97706';
    ctx.shadowBlur = 24;
    ctx.fillText('LEVEL UP', width / 2, height * 0.13);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px "Cinzel", sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillText('SELECT YOUR ENHANCEMENT (PRESS 1-4 OR CLICK)', width / 2, height * 0.18);

    // Card dimensions
    const cardWidth = Math.min(480, width - 40);
    const cardHeight = 78;
    const cardGap = 13;
    const startY = height * 0.22;

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const cx = width / 2 - cardWidth / 2;
      const cy = startY + i * (cardHeight + cardGap);
      const isHovered = (i === selectedIdx) || (i === this.hoveredUpgradeIndex);

      this.renderUpgradeCard(ctx, cx, cy, cardWidth, cardHeight, opt, i + 1, isHovered);
    }

    // Meta Control Buttons (REROLL, SKIP, BANISH)
    if (player) {
      const bottomY = startY + options.length * (cardHeight + cardGap) + 16;
      const btnW = 125;
      const btnH = 36;
      const btnGap = 18;
      const totalBtnW = btnW * 3 + btnGap * 2;
      const btnStartX = width / 2 - totalBtnW / 2;

      // 1. Reroll Button
      const rX = btnStartX;
      ctx.fillStyle = this.hoveredButton === 'reroll' ? '#1d4ed8' : '#0f172a';
      ctx.beginPath();
      ctx.roundRect(rX, bottomY, btnW, btnH, 6);
      ctx.fill();
      ctx.strokeStyle = player.rerollsRemaining > 0 ? '#38bdf8' : '#475569';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = player.rerollsRemaining > 0 ? '#ffffff' : '#64748b';
      ctx.font = 'bold 12px "Cinzel", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🎲 REROLL (${player.rerollsRemaining}) [R]`, rX + btnW / 2, bottomY + btnH / 2);

      // 2. Skip Button
      const sX = btnStartX + btnW + btnGap;
      ctx.fillStyle = this.hoveredButton === 'skip' ? '#047857' : '#0f172a';
      ctx.beginPath();
      ctx.roundRect(sX, bottomY, btnW, btnH, 6);
      ctx.fill();
      ctx.strokeStyle = player.skipsRemaining > 0 ? '#34d399' : '#475569';
      ctx.stroke();

      ctx.fillStyle = player.skipsRemaining > 0 ? '#ffffff' : '#64748b';
      ctx.fillText(`⏩ SKIP (${player.skipsRemaining}) [S]`, sX + btnW / 2, bottomY + btnH / 2);

      // 3. Banish Button
      const bX = btnStartX + (btnW + btnGap) * 2;
      ctx.fillStyle = this.hoveredButton === 'banish' ? '#991b1b' : '#0f172a';
      ctx.beginPath();
      ctx.roundRect(bX, bottomY, btnW, btnH, 6);
      ctx.fill();
      ctx.strokeStyle = player.banishesRemaining > 0 ? '#f87171' : '#475569';
      ctx.stroke();

      ctx.fillStyle = player.banishesRemaining > 0 ? '#ffffff' : '#64748b';
      ctx.fillText(`🚫 BANISH (${player.banishesRemaining}) [B]`, bX + btnW / 2, bottomY + btnH / 2);
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

    // 3D Card Hover & Scale
    if (isHovered) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(1.028, 1.028);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    // Beveled Obsidian Card Base
    const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
    if (isHovered) {
      bgGrad.addColorStop(0, '#1e1b4b');
      bgGrad.addColorStop(1, '#0f172a');
    } else {
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
    }
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();

    // Holographic Foil Shimmer Streak on Hover
    if (isHovered) {
      const shimmerGrad = ctx.createLinearGradient(x, y, x + w, y + h);
      shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      shimmerGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.18)');
      shimmerGrad.addColorStop(1, 'rgba(56, 189, 248, 0.15)');
      ctx.fillStyle = shimmerGrad;
      ctx.fill();
    }

    // Card Ornate Border (Golden Filigree when hovered)
    ctx.strokeStyle = isHovered ? '#fbbf24' : '#334155';
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    if (isHovered) {
      ctx.shadowColor = '#d97706';
      ctx.shadowBlur = 18;
    }
    ctx.stroke();

    // Key shortcut coin badge
    ctx.fillStyle = isHovered ? '#f59e0b' : '#1e293b';
    ctx.beginPath();
    ctx.arc(x + 22, y + h / 2, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#fbbf24' : '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Cinzel", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${keyNum}`, x + 22, y + h / 2);

    // Icon Box with Golden Bevel
    const iconBoxSize = 46;
    const iconBoxX = x + 44;
    const iconBoxY = y + (h - iconBoxSize) / 2;
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 6);
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#f59e0b' : '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    this.renderVectorIcon(ctx, opt.iconName, iconBoxX + iconBoxSize / 2, iconBoxY + iconBoxSize / 2, iconBoxSize * 0.72);

    // Name with Gothic Typography
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Cinzel", serif';
    ctx.fillText(opt.name, x + 102, y + 14);

    // Level badge tag
    const isNew = opt.levelText === 'NEW!';
    ctx.fillStyle = isNew ? '#22c55e' : '#38bdf8';
    ctx.font = 'bold 12px "Cinzel", sans-serif';
    ctx.fillText(opt.levelText, x + 102 + ctx.measureText(opt.name).width + 12, y + 16);

    // Description
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText(opt.description, x + 102, y + 42);

    ctx.restore();
  }

  // --- Boss Chest Modal (Ornate Golden Fanfare) ---
  public renderBossChestModal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    reward: UpgradeOption | null
  ): void {
    ctx.save();

    // Dim background
    ctx.fillStyle = 'rgba(5, 5, 12, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // Rotating Sunburst Rays
    const rays = 18;
    ctx.save();
    ctx.translate(width / 2, height * 0.42);
    ctx.rotate(this.chestOpenProgress * 2.2);
    for (let r = 0; r < rays; r++) {
      ctx.fillStyle = r % 2 === 0 ? 'rgba(251, 191, 36, 0.10)' : 'rgba(251, 191, 36, 0.02)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 450, (r * Math.PI * 2) / rays, ((r + 1) * Math.PI * 2) / rays);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Title
    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 36px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#d97706';
    ctx.shadowBlur = 22;
    ctx.fillText('TREASURE CHEST', width / 2, height * 0.17);

    // Reward Details
    if (reward) {
      const isEvo = reward.type === 'EVOLUTION';
      ctx.fillStyle = isEvo ? '#f43f5e' : '#38bdf8';
      ctx.font = 'bold 22px "Cinzel", serif';
      ctx.fillText(isEvo ? '★ WEAPON EVOLVED ★' : 'ITEM UPGRADED', width / 2, height * 0.29);

      // Icon
      this.renderVectorIcon(ctx, reward.iconName, width / 2, height * 0.44, 64);

      // Name & Description
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px "Cinzel", serif';
      ctx.fillText(reward.name, width / 2, height * 0.58);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.fillText(reward.description, width / 2, height * 0.64);
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 24px "Cinzel", serif';
      ctx.fillText('+250 GOLD COINS', width / 2, height * 0.52);
    }

    // Done button
    const btnW = 180;
    const btnH = 48;
    const btnX = width / 2 - btnW / 2;
    const btnY = height * 0.74;

    ctx.fillStyle = this.hoveredButton === 'claim' ? '#047857' : '#059669';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Cinzel", sans-serif';
    ctx.fillText('CLAIM (SPACE)', width / 2, btnY + 29);

    ctx.restore();
  }

  // --- Game Over Screen ---
  public renderGameOver(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: Player
  ): void {
    ctx.save();

    // Dark gothic vignette overlay
    ctx.fillStyle = 'rgba(5, 5, 8, 0.94)';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#ef4444';
    ctx.font = '900 48px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#991b1b';
    ctx.shadowBlur = 28;
    ctx.fillText('YOU DIED', width / 2, height * 0.15);

    // Summary Box
    const boxW = Math.min(540, width - 40);
    const boxH = 340;
    const boxX = width / 2 - boxW / 2;
    const boxY = height * 0.21;

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Stats Grid
    const mins = Math.floor(player.timeSurvived / 60);
    const secs = Math.floor(player.timeSurvived % 60);
    const timeFormatted = `${mins}m ${secs}s`;

    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Cinzel", sans-serif';

    const statRows = [
      ['TIME SURVIVED:', timeFormatted],
      ['ENEMIES DEFEATED:', `${player.kills}`],
      ['LEVEL REACHED:', `LEVEL ${player.level}`],
      ['GOLD COLLECTED:', `+${player.gold}`],
      ['LIFETIME KILLS:', `${this.saveManager.getData().lifetimeKills}`]
    ];

    for (let r = 0; r < statRows.length; r++) {
      const sy = boxY + 34 + r * 26;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(statRows[r][0], boxX + 24, sy);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(statRows[r][1], boxX + 240, sy);
    }

    // Weapons DPS Breakdown
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px "Cinzel", serif';
    ctx.fillText('WEAPONS DAMAGE BREAKDOWN:', boxX + 24, boxY + 180);

    for (let w = 0; w < player.weapons.length; w++) {
      const wep = player.weapons[w];
      const wy = boxY + 204 + w * 20;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText(`${wep.name} (LV ${wep.level}):`, boxX + 24, wy);
      ctx.fillStyle = '#facc15';
      ctx.fillText(`${wep.totalDamageDealt} dmg  (${wep.totalKills} kills)`, boxX + 240, wy);
    }

    // Play Again Button
    const btnW = 220;
    const btnH = 52;
    const btnX = width / 2 - btnW / 2;
    const btnY = boxY + boxH + 24;

    ctx.fillStyle = this.hoveredButton === 'restart' ? '#2563eb' : '#1d4ed8';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px "Cinzel", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLAY AGAIN', width / 2, btnY + 32);

    ctx.restore();
  }

  // --- Title & Character Select Screen ---
  public renderCharacterSelect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    selectedCharId: string
  ): void {
    ctx.save();

    // Dark blood-red gothic backdrop
    ctx.fillStyle = '#08070e';
    ctx.fillRect(0, 0, width, height);

    // Title with AAA Gothic Typography
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 46px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#7f1d1d';
    ctx.shadowBlur = 24;
    ctx.fillText('BLOODYBERRY', width / 2, height * 0.11);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 14px "Cinzel", sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillText('VAMPIRE SURVIVORS AUTO-SHOOTER', width / 2, height * 0.16);

    // Characters Grid
    const cardW = 165;
    const cardH = 225;
    const gap = 16;
    const totalW = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
    const startX = Math.max(20, width / 2 - totalW / 2);
    const startY = height * 0.22;

    for (let i = 0; i < CHARACTERS.length; i++) {
      const char = CHARACTERS[i];
      const cx = startX + i * (cardW + gap);
      const cy = startY;
      const isUnlocked = this.saveManager.isCharacterUnlocked(char.id);
      const isSelected = char.id === selectedCharId;
      const isHovered = i === this.hoveredCharacterIndex;

      this.renderCharacterCard(ctx, cx, cy, cardW, cardH, char, isUnlocked, isSelected, isHovered);
    }

    // Start Game Button
    const btnW = 260;
    const btnH = 56;
    const btnX = width / 2 - btnW / 2;
    const btnY = startY + cardH + 38;

    ctx.fillStyle = this.hoveredButton === 'start' ? '#b91c1c' : '#dc2626';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 18;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 19px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText('START SURVIVAL (ENTER)', width / 2, btnY + 35);

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

    ctx.fillStyle = isSelected ? '#1e1b4b' : isHovered ? '#1e293b' : '#0f172a';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();

    ctx.strokeStyle = isSelected ? '#fbbf24' : isHovered ? '#64748b' : '#334155';
    ctx.lineWidth = isSelected ? 3 : 1.5;
    if (isSelected) {
      ctx.shadowColor = '#d97706';
      ctx.shadowBlur = 14;
    }
    ctx.stroke();

    // Portrait box
    const pSize = 64;
    const px = x + (w - pSize) / 2;
    const py = y + 16;
    ctx.fillStyle = char.color;
    ctx.beginPath();
    ctx.arc(px + pSize / 2, py + pSize / 2, pSize / 2, 0, Math.PI * 2);
    ctx.fill();

    if (!isUnlocked) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.beginPath();
      ctx.arc(px + pSize / 2, py + pSize / 2, pSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', px + pSize / 2, py + pSize / 2);
    } else {
      this.renderVectorIcon(ctx, char.startingWeapon, px + pSize / 2, py + pSize / 2, 34);
    }

    // Name & Title
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.fillStyle = isUnlocked ? '#f8fafc' : '#64748b';
    ctx.font = 'bold 16px "Cinzel", serif';
    ctx.fillText(char.name, x + w / 2, py + pSize + 22);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(char.title, x + w / 2, py + pSize + 38);

    // Trait Description
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = isUnlocked ? '#38bdf8' : '#ef4444';
    const descText = isUnlocked ? char.traitDescription : char.unlockRequirement;
    this.wrapText(ctx, descText, x + 8, py + pSize + 56, w - 16, 13);

    ctx.restore();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let curY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x + maxWidth / 2, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x + maxWidth / 2, curY);
  }

  // --- Procedural Vector Icons for all Weapons & Passives ---
  private renderVectorIcon(ctx: CanvasRenderingContext2D, icon: string, x: number, y: number, size: number): void {
    ctx.save();
    ctx.translate(x, y);
    const r = size / 2;

    switch (icon) {
      case 'whip':
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, -r * 0.5);
        ctx.quadraticCurveTo(0, r * 0.8, r * 0.6, -r * 0.2);
        ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(r * 0.6, -r * 0.2, 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'axe':
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-2, -r * 0.8, 4, r * 1.6);
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(r * 0.3, -r * 0.3, r * 0.5, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        break;

      case 'fire_wand':
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, r * 0.6);
        ctx.lineTo(r * 0.6, -r * 0.6);
        ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(r * 0.6, -r * 0.6, 5, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'runetracer':
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.7);
        ctx.lineTo(r * 0.5, 0);
        ctx.lineTo(0, r * 0.7);
        ctx.lineTo(-r * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        break;

      case 'magic_wand':
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, r * 0.6);
        ctx.lineTo(r * 0.6, -r * 0.6);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(r * 0.6, -r * 0.6, 4, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'knife':
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(r * 0.8, 0);
        ctx.lineTo(-r * 0.4, -r * 0.3);
        ctx.lineTo(-r * 0.4, r * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#b45309';
        ctx.fillRect(-r * 0.8, -r * 0.15, r * 0.4, r * 0.3);
        break;

      case 'spinning_orbs':
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-r * 0.2, -r * 0.5, r * 0.4, r);
        ctx.fillRect(-r * 0.5, -r * 0.2, r, r * 0.4);
        break;

      case 'holy_water':
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 2, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -r * 0.7, 4, 4);
        break;

      case 'lightning_ring':
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.5);
        ctx.lineTo(-3, 0);
        ctx.lineTo(2, 0);
        ctx.lineTo(-1, r * 0.5);
        ctx.stroke();
        break;

      case 'cross':
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-r * 0.2, -r * 0.8, r * 0.4, r * 1.6);
        ctx.fillRect(-r * 0.7, -r * 0.4, r * 1.4, r * 0.4);
        break;

      case 'garlic':
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, 2, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(-2, -r * 0.8, 4, 6);
        break;

      case 'pentagram':
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const px = Math.cos(a) * r * 0.8;
          const py = Math.sin(a) * r * 0.8;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        break;

      case 'spinach':
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.6, r * 0.8, 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'wings':
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, 0);
        ctx.quadraticCurveTo(0, -r * 0.8, r * 0.8, 0);
        ctx.quadraticCurveTo(0, r * 0.4, -r * 0.8, 0);
        ctx.fill();
        break;

      case 'empty_tome':
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-r * 0.6, -r * 0.7, r * 1.2, r * 1.4);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-r * 0.4, -r * 0.5, r * 0.8, r);
        break;

      case 'duplicator':
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(-4, 0, r * 0.5, 0, Math.PI * 2);
        ctx.arc(4, 0, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'crown':
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, r * 0.4);
        ctx.lineTo(-r * 0.7, -r * 0.4);
        ctx.lineTo(-r * 0.3, 0);
        ctx.lineTo(0, -r * 0.6);
        ctx.lineTo(r * 0.3, 0);
        ctx.lineTo(r * 0.7, -r * 0.4);
        ctx.lineTo(r * 0.7, r * 0.4);
        ctx.closePath();
        ctx.fill();
        break;

      case 'hollow_heart':
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.2, r * 0.4, Math.PI, 0, false);
        ctx.arc(r * 0.3, -r * 0.2, r * 0.4, Math.PI, 0, false);
        ctx.lineTo(0, r * 0.6);
        ctx.closePath();
        ctx.fill();
        break;

      case 'armor':
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.7);
        ctx.lineTo(r * 0.7, -r * 0.4);
        ctx.lineTo(r * 0.5, r * 0.6);
        ctx.lineTo(0, r * 0.8);
        ctx.lineTo(-r * 0.5, r * 0.6);
        ctx.lineTo(-r * 0.7, -r * 0.4);
        ctx.closePath();
        ctx.fill();
        break;

      case 'pummarola':
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(0, 2, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(-2, -r * 0.7, 4, 5);
        break;

      case 'attractorb':
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'clover':
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(-3, -3, 5, 0, Math.PI * 2);
        ctx.arc(3, -3, 5, 0, Math.PI * 2);
        ctx.arc(0, 3, 5, 0, Math.PI * 2);
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
