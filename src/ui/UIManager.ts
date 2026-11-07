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
    isFrozen: boolean
  ): void {
    ctx.save();

    // 1. Top Experience Bar
    const xpPercent = Math.max(0, Math.min(1, player.xp / player.nextLevelXp));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, width, 18);

    const xpGrad = ctx.createLinearGradient(0, 0, width, 0);
    xpGrad.addColorStop(0, '#0284c7');
    xpGrad.addColorStop(0.5, '#38bdf8');
    xpGrad.addColorStop(1, '#67e8f9');
    ctx.fillStyle = xpGrad;
    ctx.fillRect(0, 0, width * xpPercent, 18);

    // XP text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(`LV ${player.level}  -  ${Math.floor(player.xp)} / ${player.nextLevelXp} XP`, width / 2, 9);

    // 2. Timer & Counters (Center below XP bar)
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = Math.floor(elapsedSeconds % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(timeStr, width / 2, 40);

    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`💀 ${player.kills}`, width / 2 - 75, 40);

    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`💰 ${player.gold}`, width / 2 + 75, 40);

    // 3. Top Left Health Bar & Inventory Slots
    const hpBarW = 160;
    const hpBarH = 16;
    const hpX = 20;
    const hpY = 30;

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.roundRect(hpX, hpY, hpBarW, hpBarH, 4);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // HP Fill
    const hpPct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    const hpGrad = ctx.createLinearGradient(hpX, 0, hpX + hpBarW, 0);
    if (hpPct > 0.5) {
      hpGrad.addColorStop(0, '#16a34a');
      hpGrad.addColorStop(1, '#22c55e');
    } else if (hpPct > 0.25) {
      hpGrad.addColorStop(0, '#ca8a04');
      hpGrad.addColorStop(1, '#eab308');
    } else {
      hpGrad.addColorStop(0, '#b91c1c');
      hpGrad.addColorStop(1, '#ef4444');
    }
    ctx.fillStyle = hpGrad;
    ctx.beginPath();
    ctx.roundRect(hpX + 1, hpY + 1, (hpBarW - 2) * hpPct, hpBarH - 2, 3);
    ctx.fill();

    // HP Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(player.hp)} / ${player.maxHp} HP`, hpX + 6, hpY + 9);

    // Weapon Inventory Slots (Row 1)
    const slotSize = 24;
    const slotMargin = 4;
    for (let i = 0; i < player.maxWeaponSlots; i++) {
      const sx = hpX + i * (slotSize + slotMargin);
      const sy = hpY + 24;
      this.renderSlot(ctx, sx, sy, slotSize, player.weapons[i]);
    }

    // Passive Inventory Slots (Row 2)
    const passiveKeys = Array.from(player.passives.entries());
    for (let i = 0; i < player.maxPassiveSlots; i++) {
      const sx = hpX + i * (slotSize + slotMargin);
      const sy = hpY + 24 + slotSize + slotMargin;
      const passiveData = passiveKeys[i];
      this.renderPassiveSlot(ctx, sx, sy, slotSize, passiveData);
    }

    // 4. Top Right Buttons (Sound & Pause)
    const btnSize = 32;
    const soundBtnX = width - 85;
    const soundBtnY = 28;

    // Sound button
    ctx.fillStyle = this.hoveredButton === 'sound' ? '#334155' : 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(soundBtnX, soundBtnY, btnSize, btnSize, 6);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    ctx.fillStyle = player.isDead ? '#64748b' : '#38bdf8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.sound.isMuted ? '🔇' : '🔊', soundBtnX + btnSize / 2, soundBtnY + btnSize / 2);

    // Frozen Map Visual Frame
    if (isFrozen) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, width, height);
    }

    ctx.restore();
  }

  private renderSlot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, weapon?: any): void {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = weapon ? (weapon.isEvolved ? '#f59e0b' : '#3b82f6') : '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, size, size);

    if (weapon) {
      this.renderVectorIcon(ctx, weapon.iconName, x + size / 2, y + size / 2, size * 0.7);
      // Level dots
      for (let lvl = 0; lvl < weapon.level; lvl++) {
        ctx.fillStyle = weapon.isEvolved ? '#fbbf24' : '#60a5fa';
        ctx.fillRect(x + 2 + lvl * 2.5, y + size - 3, 2, 2);
      }
    }
  }

  private renderPassiveSlot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, passiveEntry?: [string, number]): void {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = passiveEntry ? '#10b981' : '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, size, size);

    if (passiveEntry) {
      const [id, lvl] = passiveEntry;
      this.renderVectorIcon(ctx, id, x + size / 2, y + size / 2, size * 0.7);
      for (let l = 0; l < lvl; l++) {
        ctx.fillStyle = '#34d399';
        ctx.fillRect(x + 2 + l * 3.5, y + size - 3, 2.5, 2);
      }
    }
  }

  // --- Level Up Modal ---
  public renderLevelUpModal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: UpgradeOption[],
    selectedIdx: number
  ): void {
    ctx.save();

    // Dark backdrop overlay
    ctx.fillStyle = 'rgba(5, 5, 10, 0.82)';
    ctx.fillRect(0, 0, width, height);

    // Title Banner
    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 36px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#d97706';
    ctx.shadowBlur = 18;
    ctx.fillText('LEVEL UP!', width / 2, height * 0.16);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillText('Choose an enhancement (Press 1-4 or Click):', width / 2, height * 0.22);

    // Card dimensions
    const cardWidth = Math.min(460, width - 40);
    const cardHeight = 82;
    const cardGap = 16;
    const totalHeight = options.length * cardHeight + (options.length - 1) * cardGap;
    const startY = height * 0.28;

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const cx = width / 2 - cardWidth / 2;
      const cy = startY + i * (cardHeight + cardGap);
      const isHovered = (i === selectedIdx) || (i === this.hoveredUpgradeIndex);

      this.renderUpgradeCard(ctx, cx, cy, cardWidth, cardHeight, opt, i + 1, isHovered);
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

    // Card background
    ctx.fillStyle = isHovered ? '#1e1b4b' : '#0f172a';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();

    ctx.strokeStyle = isHovered ? '#818cf8' : '#334155';
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    if (isHovered) {
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 14;
    }
    ctx.stroke();

    // Key shortcut badge
    ctx.fillStyle = isHovered ? '#6366f1' : '#1e293b';
    ctx.beginPath();
    ctx.roundRect(x + 10, y + h / 2 - 12, 24, 24, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${keyNum}`, x + 22, y + h / 2);

    // Icon Box
    const iconBoxSize = 44;
    const iconBoxX = x + 44;
    const iconBoxY = y + (h - iconBoxSize) / 2;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 6);
    ctx.fill();
    this.renderVectorIcon(ctx, opt.iconName, iconBoxX + iconBoxSize / 2, iconBoxY + iconBoxSize / 2, iconBoxSize * 0.7);

    // Name & Level text
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.fillText(opt.name, x + 100, y + 14);

    // Level tag
    ctx.fillStyle = opt.levelText === 'NEW!' ? '#22c55e' : '#38bdf8';
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.fillText(opt.levelText, x + 100 + ctx.measureText(opt.name).width + 12, y + 15);

    // Description
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText(opt.description, x + 100, y + 38);

    ctx.restore();
  }

  // --- Boss Chest Modal ---
  public renderBossChestModal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    reward: UpgradeOption | null
  ): void {
    ctx.save();

    // Dim background
    ctx.fillStyle = 'rgba(5, 5, 12, 0.88)';
    ctx.fillRect(0, 0, width, height);

    // Rotating Rays
    const rays = 16;
    ctx.save();
    ctx.translate(width / 2, height * 0.42);
    ctx.rotate(this.chestOpenProgress * 2.5);
    for (let r = 0; r < rays; r++) {
      ctx.fillStyle = r % 2 === 0 ? 'rgba(251, 191, 36, 0.08)' : 'rgba(251, 191, 36, 0.02)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 400, (r * Math.PI * 2) / rays, ((r + 1) * Math.PI * 2) / rays);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Title
    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 32px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#d97706';
    ctx.shadowBlur = 18;
    ctx.fillText('TREASURE CHEST!', width / 2, height * 0.18);

    // Reward Details
    if (reward) {
      const isEvo = reward.type === 'EVOLUTION';
      ctx.fillStyle = isEvo ? '#f43f5e' : '#38bdf8';
      ctx.font = 'bold 20px -apple-system, sans-serif';
      ctx.fillText(isEvo ? '★ WEAPON EVOLVED! ★' : 'ITEM UPGRADE!', width / 2, height * 0.3);

      // Icon
      this.renderVectorIcon(ctx, reward.iconName, width / 2, height * 0.44, 60);

      // Name & Description
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px -apple-system, sans-serif';
      ctx.fillText(reward.name, width / 2, height * 0.58);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.fillText(reward.description, width / 2, height * 0.64);
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 22px -apple-system, sans-serif';
      ctx.fillText('+250 GOLD COINS!', width / 2, height * 0.52);
    }

    // Done button
    const btnW = 160;
    const btnH = 46;
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
    ctx.font = 'bold 16px -apple-system, sans-serif';
    ctx.fillText('CLAIM (SPACE)', width / 2, btnY + 28);

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
    ctx.fillStyle = 'rgba(5, 5, 8, 0.92)';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#ef4444';
    ctx.font = '900 42px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#991b1b';
    ctx.shadowBlur = 24;
    ctx.fillText('YOU DIED', width / 2, height * 0.16);

    // Summary Box
    const boxW = Math.min(520, width - 40);
    const boxH = 340;
    const boxX = width / 2 - boxW / 2;
    const boxY = height * 0.22;

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Stats Grid
    const mins = Math.floor(player.timeSurvived / 60);
    const secs = Math.floor(player.timeSurvived % 60);
    const timeFormatted = `${mins}m ${secs}s`;

    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px -apple-system, sans-serif';

    const statRows = [
      ['Time Survived:', timeFormatted],
      ['Enemies Defeated:', `${player.kills}`],
      ['Level Reached:', `LV ${player.level}`],
      ['Gold Collected:', `+${player.gold}`],
      ['Lifetime Kills:', `${this.saveManager.getData().lifetimeKills}`]
    ];

    for (let r = 0; r < statRows.length; r++) {
      const sy = boxY + 32 + r * 26;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(statRows[r][0], boxX + 24, sy);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(statRows[r][1], boxX + 220, sy);
    }

    // Weapons DPS Breakdown
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.fillText('WEAPONS DAMAGE BREAKDOWN:', boxX + 24, boxY + 175);

    for (let w = 0; w < player.weapons.length; w++) {
      const wep = player.weapons[w];
      const wy = boxY + 198 + w * 20;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText(`${wep.name} (LV ${wep.level}):`, boxX + 24, wy);
      ctx.fillStyle = '#facc15';
      ctx.fillText(`${wep.totalDamageDealt} dmg  (${wep.totalKills} kills)`, boxX + 220, wy);
    }

    // Play Again Button
    const btnW = 200;
    const btnH = 50;
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
    ctx.font = 'bold 16px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLAY AGAIN', width / 2, btnY + 30);

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
    ctx.fillStyle = '#090810';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 40px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#7f1d1d';
    ctx.shadowBlur = 20;
    ctx.fillText('BLOODYBERRY', width / 2, height * 0.12);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillText('VAMPIRE SURVIVORS AUTO-SHOOTER', width / 2, height * 0.17);

    // Characters Grid
    const cardW = 170;
    const cardH = 220;
    const gap = 16;
    const totalW = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
    const startX = Math.max(20, width / 2 - totalW / 2);
    const startY = height * 0.24;

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
    const btnW = 240;
    const btnH = 54;
    const btnX = width / 2 - btnW / 2;
    const btnY = startY + cardH + 40;

    ctx.fillStyle = this.hoveredButton === 'start' ? '#b91c1c' : '#dc2626';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 15;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 18px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('START SURVIVAL (ENTER)', width / 2, btnY + 34);

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

    ctx.strokeStyle = isSelected ? '#a855f7' : isHovered ? '#64748b' : '#334155';
    ctx.lineWidth = isSelected ? 3 : 1.5;
    if (isSelected) {
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 12;
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
      // Lock overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.arc(px + pSize / 2, py + pSize / 2, pSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', px + pSize / 2, py + pSize / 2);
    } else {
      // Weapon icon underneath portrait
      this.renderVectorIcon(ctx, char.startingWeapon, px + pSize / 2, py + pSize / 2, 32);
    }

    // Name & Title
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.fillStyle = isUnlocked ? '#f8fafc' : '#64748b';
    ctx.font = 'bold 16px -apple-system, sans-serif';
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
