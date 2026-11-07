import { Entity } from './Entity';
import { Vector2 } from '../core/Vector2';
import { Weapon } from '../weapons/Weapon';
import { PASSIVE_DEFINITIONS } from '../passives/PassiveRegistry';

export class Player extends Entity {
  // Base stats (unmodified)
  public baseMaxHp = 100;
  public baseSpeed = 190;
  public basePickupRadius = 90;

  // Effective stats (calculated from passives)
  public maxHp = 100;
  public hp = 100;
  public moveSpeed = 190;
  public pickupRadius = 90;
  public damageMult = 1.0;
  public armor = 0;
  public cooldownMult = 1.0;
  public areaMult = 1.0;
  public projectileCountBonus = 0;
  public critChance = 0.05;
  public xpMult = 1.0;
  public hpRegen = 0.2;
  public luck = 1.0;

  // Progression
  public level = 1;
  public xp = 0;
  public nextLevelXp = 5;
  public gold = 0;
  public kills = 0;
  public totalDamageDealt = 0;
  public timeSurvived = 0;

  // Equipment slots
  public readonly maxWeaponSlots = 6;
  public readonly maxPassiveSlots = 6;
  public weapons: Weapon[] = [];
  public passives: Map<string, number> = new Map(); // passiveId -> level (1-5)

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

    // Health Regeneration
    if (this.hp < this.maxHp && this.hpRegen > 0) {
      this.hpRegenAccumulator += this.hpRegen * dt;
      if (this.hpRegenAccumulator >= 1.0) {
        const healAmt = Math.floor(this.hpRegenAccumulator);
        this.heal(healAmt);
        this.hpRegenAccumulator -= healAmt;
      }
    }

    // Movement
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

    if (this.xp >= this.nextLevelXp) {
      this.xp -= this.nextLevelXp;
      this.level++;
      // Exponential curve matching classic horde survivor formulas
      this.nextLevelXp = Math.floor(5 * Math.pow(1.18, this.level - 1) + (this.level * 3));
      return true; // Leveled up!
    }

    return false;
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

  public recalculateStats(): void {
    let speedBonus = 0;
    let damageBonus = 0;
    let cdReduction = 0;
    let projBonus = 0;
    let xpBonus = 0;
    let hpBonus = 0;
    let armorBonus = 0;
    let regenBonus = 0;
    let pickupBonus = 0;
    let cloverBonus = 0;

    for (const [id, lvl] of this.passives.entries()) {
      switch (id) {
        case 'spinach':
          damageBonus += lvl * 0.1;
          break;
        case 'wings':
          speedBonus += lvl * 0.1;
          break;
        case 'empty_tome':
          cdReduction += lvl * 0.08;
          break;
        case 'duplicator':
          projBonus += lvl * 1;
          break;
        case 'crown':
          xpBonus += lvl * 0.15;
          break;
        case 'hollow_heart':
          hpBonus += lvl * 0.2;
          break;
        case 'armor':
          armorBonus += lvl * 1;
          break;
        case 'pummarola':
          regenBonus += lvl * 0.6;
          break;
        case 'attractorb':
          pickupBonus += lvl * 0.3;
          break;
        case 'clover':
          cloverBonus += lvl * 0.1;
          break;
      }
    }

    const prevMaxHp = this.maxHp;
    this.maxHp = Math.round(this.baseMaxHp * (1 + hpBonus));
    if (this.maxHp > prevMaxHp && prevMaxHp > 0) {
      // Increase current HP proportionally with max HP gain
      this.hp += (this.maxHp - prevMaxHp);
    }

    this.moveSpeed = this.baseSpeed * (1 + speedBonus);
    this.damageMult = 1.0 + damageBonus;
    this.cooldownMult = Math.max(0.3, 1.0 - cdReduction);
    this.projectileCountBonus = projBonus;
    this.xpMult = 1.0 + xpBonus;
    this.armor = armorBonus;
    this.hpRegen = 0.2 + regenBonus;
    this.pickupRadius = this.basePickupRadius * (1 + pickupBonus);
    this.critChance = 0.05 + cloverBonus;
    this.luck = 1.0 + cloverBonus;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.position.x, this.position.y);

    // Subtle drop shadow underneath
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius + 1, this.radius * 1.1, this.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Invulnerability blinking
    if (this.iFrameTimer > 0 && Math.floor(this.iFrameTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Direction flip
    ctx.scale(this.facingDirection, 1);

    const bob = this.isMoving ? Math.sin(this.walkAnimTimer) * 2.5 : 0;

    if (this.hurtFlashTimer > 0) {
      // Red flash on damage
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -bob, this.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Procedural Gothic Vampire Hunter Sprite

      // Cape / Cloak flowing behind
      ctx.fillStyle = '#1e1b4b'; // Deep midnight violet
      ctx.beginPath();
      ctx.moveTo(-6, -4 - bob);
      ctx.lineTo(-14 - (this.isMoving ? 4 : 0), 12 - bob);
      ctx.lineTo(2, 10 - bob);
      ctx.closePath();
      ctx.fill();

      // Body coat
      ctx.fillStyle = '#312e81'; // Dark royal blue-violet
      ctx.beginPath();
      ctx.roundRect(-8, -10 - bob, 16, 20, 4);
      ctx.fill();

      // Belt & Golden Buckle
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-8, 1 - bob, 16, 3);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-2, 0 - bob, 4, 5);

      // Head / Hood
      ctx.fillStyle = '#4338ca';
      ctx.beginPath();
      ctx.arc(0, -12 - bob, 8, 0, Math.PI * 2);
      ctx.fill();

      // Face shadow & Glowing Silver/Cyan eyes
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(2, -11 - bob, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.arc(3, -12 - bob, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Crimson Amulet / Pendant on chest
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(1, -3 - bob, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Overhead Health Bar
    this.renderHealthBar(ctx);
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 32;
    const barHeight = 4;
    const barX = this.position.x - barWidth / 2;
    const barY = this.position.y - this.radius - 14;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    const hpPercent = Math.max(0, Math.min(1, this.hp / this.maxHp));
    const fillWidth = barWidth * hpPercent;

    // Green to yellow to red gradient
    ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(barX, barY, fillWidth, barHeight);
  }
}
