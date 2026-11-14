import { Entity } from './Entity';
import { Vector2 } from '../core/Vector2';
import { Weapon } from '../weapons/Weapon';
import { PASSIVE_DEFINITIONS } from '../passives/PassiveRegistry';
import { SpriteRenderer } from '../renderer/SpriteRenderer';
import { SkillTag } from '../systems/BuildSystem';

export class Player extends Entity {
  public characterId = 'antonio';
  public selectedBranch: string | null = null;
  public branchColor: string | null = null;
  public branchTriggered = false;
  public branchAscendFlashTimer = 0;
  public shadowClones: { x: number; y: number; timer: number; fireTimer: number; facing: number }[] = [];
  // Base stats (unmodified)
  public baseMaxHp = 100;
  public baseSpeed = 190;
  public basePickupRadius = 90;

  // Effective stats (calculated from passives)
  public maxHp = 100;
  public hp = 100;
  public moveSpeed = 190;
  public pickupRadius = 90;
  public damageMult = 0.9;
  public armor = 0;
  public cooldownMult = 1.0;
  public areaMult = 1.0;
  public projectileCountBonus = 0;
  public critChance = 0.05;
  public xpMult = 1.0;
  public hpRegen = 0.1;
  public luck = 1.0;

  // Progression
  public level = 1;
  public xp = 0;
  public nextLevelXp = 24;
  public pendingLevelUps = 0;
  public gold = 0;
  public kills = 0;
  public totalDamageDealt = 0;
  public timeSurvived = 0;

  // Inventory & Slots
  public readonly maxWeaponSlots = 6;
  public readonly maxPassiveSlots = 6;
  public weapons: Weapon[] = [];
  public passives: Map<string, number> = new Map(); // passiveId -> level (1-5)

  // Meta Level-Up & Room Reward Manipulations (局内微调杠杆：重随与封印/剔除)
  public rerollsRemaining = 3;
  public skipsRemaining = 2;
  public banishesRemaining = 3;
  public banishedItemIds: Set<string> = new Set();

  // 记录冲刺起点供示例B (OnDodge 留弹) 使用
  public lastDashStartPosition: Vector2 = new Vector2(0, 0);

  // Combat status & feedback
  public iFrameDuration = 0.45;
  public iFrameTimer = 0;
  public hurtFlashTimer = 0;
  public isDead = false;

  // Movement & Animation
  public moveDirection: Vector2 = new Vector2(0, 0);
  public facingDirection = 1; // 1 = right, -1 = left
  public walkAnimTimer = 0;
  public isMoving = false;
  private hpRegenAccumulator = 0;

  // Active Skill 1: Shadow Dash (Spacebar)
  public dashCooldown = 0;
  public maxDashCooldown = 2.8;
  public dashActiveTimer = 0;
  public dashDuration = 0.22;
  public dashDirection: Vector2 = new Vector2(1, 0);
  public dashSpeedMultiplier = 3.4;
  public dashGhosts: { x: number; y: number; facing: number; frame: number; alpha: number }[] = [];

  // Active Skill 2: Ultimate Screen-Nuke (Q / E Key - Pentagram / Gorgeous Moon)
  public ultimateCooldown = 18.0; // Starts partially charged so player can test it after 18s!
  public maxUltimateCooldown = 45.0;

  constructor(x = 0, y = 0) {
    super(x, y, 14);
    this.recalculateStats();
    this.hp = this.maxHp;
  }

  public update(dt: number): void {
    if (this.isDead) return;

    this.timeSurvived += dt;

    // Handle i-frames & visual flash
    if (this.iFrameTimer > 0) {
      this.iFrameTimer -= dt;
    }
    if (this.hurtFlashTimer > 0) {
      this.hurtFlashTimer -= dt;
    }
    if (this.branchAscendFlashTimer > 0) {
      this.branchAscendFlashTimer = Math.max(0, this.branchAscendFlashTimer - dt);
    }

    // Dynamic Berserker low-HP attack speed scaling
    if (this.selectedBranch === 'antonio_berserker') {
      this.recalculateStats();
    }

    // Health Regeneration
    if (this.hp < this.maxHp && this.hpRegen > 0) {
      this.hpRegenAccumulator += this.hpRegen * dt;
      if (this.hpRegenAccumulator >= 1.0) {
        const healAmt = Math.floor(this.hpRegenAccumulator);
        this.heal(healAmt);
        this.hpRegenAccumulator -= healAmt;
      }
    }

    // Active Skill Cooldowns (Dash & Ultimate)
    if (this.dashCooldown > 0) {
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    }
    if (this.ultimateCooldown > 0) {
      this.ultimateCooldown = Math.max(0, this.ultimateCooldown - dt);
    }

    // Decay Dash Ghost Afterimages
    for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
      this.dashGhosts[i].alpha -= dt * 4.2;
      if (this.dashGhosts[i].alpha <= 0) {
        this.dashGhosts.splice(i, 1);
      }
    }

    // Handle Active Shadow Dash Burst
    if (this.dashActiveTimer > 0) {
      this.dashActiveTimer -= dt;
      this.isMoving = true;
      this.velocity.copy(this.dashDirection).multiplyScalar(this.moveSpeed * this.dashSpeedMultiplier);
      this.position.addScaled(this.velocity, dt);
      this.walkAnimTimer += dt * 18;

      // Record translucent dash afterimage ghost
      if (this.dashGhosts.length === 0 || Math.hypot(this.position.x - this.dashGhosts[0].x, this.position.y - this.dashGhosts[0].y) > 14) {
        this.dashGhosts.unshift({
          x: this.position.x,
          y: this.position.y,
          facing: this.facingDirection,
          frame: Math.floor(this.walkAnimTimer) % 4,
          alpha: 0.65
        });
      }
      return;
    }

    // Standard Movement
    if (this.moveDirection.lengthSq() > 0.0001) {
      this.isMoving = true;
      this.velocity.copy(this.moveDirection).multiplyScalar(this.moveSpeed);
      this.position.addScaled(this.velocity, dt);

      if (this.moveDirection.x > 0.05) this.facingDirection = 1;
      else if (this.moveDirection.x < -0.05) this.facingDirection = -1;

      this.walkAnimTimer += dt * 10;
    } else {
      this.isMoving = false;
      this.velocity.set(0, 0);
      this.walkAnimTimer = 0;
    }
  }

  public tryDash(): boolean {
    if (this.isDead || this.dashCooldown > 0 || this.dashActiveTimer > 0) return false;

    this.lastDashStartPosition.copy(this.position);

    if (this.moveDirection.lengthSq() > 0.001) {
      this.dashDirection.copy(this.moveDirection).normalize();
    } else {
      this.dashDirection.set(this.facingDirection, 0);
    }

    const dashRank = this.getPassiveLevel('wings');
    const dashCdFactor = Math.max(0.85, 1.0 - dashRank * 0.03);
    const branchDashFactor = this.selectedBranch === 'gennaro_phantom' ? 0.62 : 1.0;
    this.dashActiveTimer = this.dashDuration;
    this.dashCooldown = Math.max(0.55, this.maxDashCooldown * this.cooldownMult * dashCdFactor * branchDashFactor);
    this.iFrameTimer = Math.max(this.iFrameTimer, this.dashDuration + 0.14); // Invulnerable during dash!
    return true;
  }

  public isUltimateReady(): boolean {
    return !this.isDead && this.ultimateCooldown <= 0;
  }

  public triggerUltimate(): boolean {
    if (!this.isUltimateReady()) return false;
    this.ultimateCooldown = Math.max(15.0, this.maxUltimateCooldown * this.cooldownMult);
    this.iFrameTimer = Math.max(this.iFrameTimer, 0.8);
    return true;
  }

  public reduceUltimateCooldown(seconds: number): void {
    if (this.ultimateCooldown > 0) {
      this.ultimateCooldown = Math.max(0, this.ultimateCooldown - seconds);
    }
  }

  public takeDamage(rawDamage: number): number {
    if (this.iFrameTimer > 0 || this.isDead) return 0;

    const netDamage = Math.max(1, Math.round(rawDamage - this.armor));
    this.hp -= netDamage;
    this.iFrameTimer = this.iFrameDuration;
    this.hurtFlashTimer = 0.15;

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }

    return netDamage;
  }

  public heal(amount: number): void {
    if (this.isDead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  public gainXp(amount: number): boolean {
    if (this.isDead) return false;

    const scaledAmount = amount * this.xpMult;
    this.xp += scaledAmount;

    let leveledUp = false;
    while (this.xp >= this.nextLevelXp) {
      this.xp -= this.nextLevelXp;
      this.level++;
      // Slower progression: higher entry cost and steeper late-run requirements.
      this.nextLevelXp = Math.floor(18 * Math.pow(1.27, this.level - 1) + (this.level * 10));
      this.pendingLevelUps++;
      leveledUp = true;
    }

    return leveledUp;
  }

  public addWeapon(weapon: Weapon): boolean {
    if (this.weapons.length >= this.maxWeaponSlots) return false;
    this.weapons.push(weapon);
    return true;
  }

  public getWeapon(id: string): Weapon | undefined {
    return this.weapons.find(w => w.id === id);
  }

  public addPassive(passiveId: string): boolean {
    const currentLvl = this.passives.get(passiveId) || 0;
    const def = PASSIVE_DEFINITIONS[passiveId];
    if (!def) return false;

    if (currentLvl === 0) {
      if (this.passives.size >= this.maxPassiveSlots) return false;
      this.passives.set(passiveId, 1);
    } else if (currentLvl < def.maxLevel) {
      this.passives.set(passiveId, currentLvl + 1);
    } else {
      return false;
    }

    this.recalculateStats();
    return true;
  }

  public hasPassive(passiveId: string): boolean {
    return this.passives.has(passiveId);
  }

  public getPassiveLevel(passiveId: string): number {
    return this.passives.get(passiveId) || 0;
  }

  public getWeaponsByTag(tag: SkillTag): Weapon[] {
    return this.weapons.filter(w => w.hasTag(tag));
  }

  public useReroll(): boolean {
    if (this.rerollsRemaining <= 0) return false;
    this.rerollsRemaining--;
    return true;
  }

  public useBanish(itemId: string): boolean {
    if (this.banishesRemaining <= 0) return false;
    this.banishesRemaining--;
    this.banishedItemIds.add(itemId);
    return true;
  }

  public recalculateStats(): void {
    // 机制驱动构筑：不再通过被动词条无脑堆叠纯攻击力/攻速百分比，而是由 BuildEventBus 触发多标签机制联动！
    const soulRank = this.getPassiveLevel('hollow_heart');
    const armorRank = this.getPassiveLevel('armor');
    const attractRank = this.getPassiveLevel('attractorb');
    const singularityRank = this.getPassiveLevel('clover');

    const prevMaxHp = this.maxHp;
    this.maxHp = Math.round(this.baseMaxHp + soulRank * 5);
    if (this.maxHp > prevMaxHp && prevMaxHp > 0) {
      this.hp += (this.maxHp - prevMaxHp);
    }

    this.moveSpeed = this.baseSpeed;
    this.armor = Math.max(
      this.characterId === 'antonio' ? 1 : 0,
      Math.floor(armorRank / 2) + (this.selectedBranch === 'antonio_arbiter' ? 2 : 0)
    );
    this.pickupRadius = this.basePickupRadius * (1 + attractRank * 0.1);

    // Branch-specific stat transformations
    if (this.selectedBranch === 'antonio_berserker') {
      const missingHpRatio = Math.max(0, Math.min(1, 1 - this.hp / Math.max(1, this.maxHp)));
      this.cooldownMult = Math.max(0.55, 1.0 - missingHpRatio * 0.42);
      this.damageMult = 1.18 + missingHpRatio * 0.25;
    } else if (this.selectedBranch === 'gennaro_executioner') {
      this.critChance = 0.30;
    } else if (this.selectedBranch === 'arca_pyro') {
      this.areaMult = 1.50;
      this.cooldownMult = 0.85;
    }

    // 【示例 C（风险与机制转化）】：若拥有“湮灭第四律令”，彻底取消随机暴击率概念（归零），转化为每第4次攻击必触发范围穿透奇点！
    if (singularityRank > 0) {
      this.critChance = 0;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    const spriteKey = `hero_${this.characterId}`;

    // Render Dash Ghost Afterimages in World Space
    for (const g of this.dashGhosts) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = g.alpha * 0.65;
      SpriteRenderer.getInstance().drawSprite(
        ctx,
        spriteKey,
        g.frame,
        g.x,
        g.y - 2,
        40,
        40,
        g.facing,
        true
      );
      ctx.restore();
    }

    // Render Gennaro Phantom Shadow Clones in World Space
    for (const clone of this.shadowClones) {
      ctx.save();
      ctx.translate(clone.x, clone.y);
      ctx.globalAlpha = Math.min(0.75, clone.timer * 0.8);
      const cloneAura = ctx.createRadialGradient(0, 6, 2, 0, 6, 22);
      cloneAura.addColorStop(0, 'rgba(52, 211, 153, 0.45)');
      cloneAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cloneAura;
      ctx.beginPath();
      ctx.ellipse(0, 6, 22, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      SpriteRenderer.getInstance().drawSprite(ctx, spriteKey, 1, 0, -2, 38, 38, clone.facing, false);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.position.x, this.position.y);

    // Ascendancy Transformation Pillar Burst (pure optical feedback upon choosing late-game branch)
    if (this.branchAscendFlashTimer > 0 && this.branchColor) {
      const p = this.branchAscendFlashTimer / 1.1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = p * 0.72;
      const colGrad = ctx.createLinearGradient(0, -180, 0, 20);
      colGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      colGrad.addColorStop(0.5, this.branchColor);
      colGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = colGrad;
      ctx.fillRect(-26 * p, -180, 52 * p, 200);
      ctx.restore();
    }

    // Soft radial aura glow beneath player feet (Branch color when ascended, Golden/Purple when Ultimate is Ready!)
    const ultReady = this.isUltimateReady();
    const auraGrad = ctx.createRadialGradient(0, 6, 2, 0, 6, this.radius * (ultReady ? 2.8 : 2.2));
    if (this.branchColor) {
      auraGrad.addColorStop(0, ultReady ? 'rgba(250, 204, 21, 0.42)' : `${this.branchColor}55`);
      auraGrad.addColorStop(0.55, `${this.branchColor}28`);
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else if (ultReady) {
      auraGrad.addColorStop(0, 'rgba(250, 204, 21, 0.42)');
      auraGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.22)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      auraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
      auraGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.10)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.ellipse(0, 6, this.radius * (ultReady ? 2.8 : 2.2), this.radius * (ultReady ? 1.4 : 1.1), 0, 0, Math.PI * 2);
    ctx.fill();

    // Gothic Hunter's Sacred Compass Ring beneath feet (unified reliquary filigree)
    ctx.save();
    ctx.scale(1, 0.52);
    ctx.translate(0, 14);
    ctx.strokeStyle = ultReady ? 'rgba(251, 191, 36, 0.55)' : 'rgba(125, 211, 252, 0.32)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 1.65, 0, Math.PI * 2);
    ctx.stroke();
    for (let c = 0; c < 4; c++) {
      const cAng = (c * Math.PI) / 2 + (this.walkAnimTimer * 0.08);
      const cx = Math.cos(cAng) * this.radius * 1.65;
      const cy = Math.sin(cAng) * this.radius * 1.65;
      ctx.fillStyle = ultReady ? '#fde047' : '#bae6fd';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Directional Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(3, this.radius + 1, this.radius * 1.15, this.radius * 0.48, 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Render Continuous Sacred Golden Orbit Ring when King Bible / Holy Shield is equipped!
    const shieldWeapon = this.getWeapon('spinning_orbs');
    if (shieldWeapon) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const orbitR = shieldWeapon.area * this.areaMult;
      ctx.strokeStyle = shieldWeapon.isEvolved ? 'rgba(244, 63, 94, 0.35)' : 'rgba(251, 191, 36, 0.28)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, orbitR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Invulnerability blinking
    if (this.iFrameTimer > 0 && this.dashActiveTimer <= 0 && Math.floor(this.iFrameTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    const animFrame = this.isMoving ? Math.floor(this.walkAnimTimer) % 4 : 0;
    const isHit = this.hurtFlashTimer > 0;

    // Draw High-Res Gothic Hero Sprite
    SpriteRenderer.getInstance().drawSprite(
      ctx,
      spriteKey,
      animFrame,
      0,
      -2,
      40,
      40,
      this.facingDirection,
      isHit
    );

    ctx.restore();

    // Overhead Health Bar
    this.renderHealthBar(ctx);
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 42;
    const barHeight = 6;
    const barX = this.position.x - barWidth / 2;
    const barY = this.position.y - this.radius - 18;

    ctx.save();

    // 1. 3D Floating Drop Shadow beneath the gauge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    ctx.roundRect(barX - 2, barY + 1.5, barWidth + 4, barHeight + 4, 3);
    ctx.fill();

    // 2. Sculpted Metallic Outer Casing (Top Light Bevel + Bottom Bronze Shadow)
    const caseGrad = ctx.createLinearGradient(0, barY - 2, 0, barY + barHeight + 2);
    caseGrad.addColorStop(0, '#334155');
    caseGrad.addColorStop(0.5, '#0f172a');
    caseGrad.addColorStop(1, '#020617');
    ctx.fillStyle = caseGrad;
    ctx.beginPath();
    ctx.roundRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 3);
    ctx.fill();

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Left & Right 3D Gold Diamond Studs
    ctx.fillStyle = '#fde047';
    for (const sx of [barX - 3, barX + barWidth + 3]) {
      ctx.beginPath();
      ctx.moveTo(sx, barY + barHeight / 2 - 2.5);
      ctx.lineTo(sx + 2.5, barY + barHeight / 2);
      ctx.lineTo(sx, barY + barHeight / 2 + 2.5);
      ctx.lineTo(sx - 2.5, barY + barHeight / 2);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Recessed Dark Inner Well
    ctx.fillStyle = '#04060d';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpPercent = Math.max(0, Math.min(1, this.hp / this.maxHp));
    const fillWidth = barWidth * hpPercent;

    // 4. Cylindrical 3D Liquid Glass Fill (4-stop vertical curvature gradient)
    if (fillWidth > 0.5) {
      const cylGrad = ctx.createLinearGradient(0, barY, 0, barY + barHeight);
      if (hpPercent > 0.5) {
        cylGrad.addColorStop(0, '#bbf7d0');
        cylGrad.addColorStop(0.35, '#22c55e');
        cylGrad.addColorStop(0.8, '#15803d');
        cylGrad.addColorStop(1, '#052e16');
      } else if (hpPercent > 0.25) {
        cylGrad.addColorStop(0, '#fef08a');
        cylGrad.addColorStop(0.35, '#f59e0b');
        cylGrad.addColorStop(0.8, '#b45309');
        cylGrad.addColorStop(1, '#451a03');
      } else {
        cylGrad.addColorStop(0, '#fecaca');
        cylGrad.addColorStop(0.35, '#ef4444');
        cylGrad.addColorStop(0.8, '#991b1b');
        cylGrad.addColorStop(1, '#450a0a');
      }
      ctx.fillStyle = cylGrad;
      ctx.fillRect(barX, barY, fillWidth, barHeight);

      // Top Specular Glass Tube Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.fillRect(barX, barY, fillWidth, 1.8);

      // Glowing Liquid Meniscus Tip
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(barX + Math.max(0, fillWidth - 1.5), barY, 1.5, barHeight);
    }

    // 5. Subtle 3D Dash Stamina Micro-Bar directly under HP gauge
    const dashReady = this.dashCooldown <= 0;
    const dashPct = dashReady
      ? 1
      : 1 - Math.min(1, this.dashCooldown / Math.max(0.1, this.maxDashCooldown * this.cooldownMult));
    const dashY = barY + barHeight + 3;
    ctx.fillStyle = 'rgba(4, 6, 13, 0.85)';
    ctx.fillRect(barX + 2, dashY, barWidth - 4, 2);
    ctx.fillStyle = dashReady ? '#38bdf8' : '#0284c7';
    ctx.fillRect(barX + 2, dashY, (barWidth - 4) * dashPct, 2);

    ctx.restore();
  }
}
