import { Entity } from '../entities/Entity';
import { Vector2 } from '../core/Vector2';
import { Player } from '../entities/Player';
import { DropType } from '../entities/DropItem';
import { SpriteRenderer } from '../renderer/SpriteRenderer';

export enum EnemyType {
  WALKER = 'WALKER',         // Zombie / Ghoul
  DASHER = 'DASHER',         // Bat / Hound
  SWARMER = 'SWARMER',       // Spider / Rat
  TANK = 'TANK',             // Armored Golem
  MINOTAUR = 'MINOTAUR',     // Charge mechanic
  RANGED_SPITTER = 'RANGED', // Fires dark orbs
  SLIME_LARGE = 'SLIME_L',   // Splits on death
  SLIME_MEDIUM = 'SLIME_M',  // Splits on death
  SLIME_SMALL = 'SLIME_S',
  GHOST = 'GHOST',           // High speed phantom
  BOSS_DEMON = 'BOSS_DEMON'  // Elite mini-boss / wave boss
}

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  xpValue: number;
  knockbackResist: number; // 0 = full knockback, 1 = immune
  color: string;
  isBoss?: boolean;
}

export class Enemy extends Entity {
  public type: EnemyType;
  public enemyName: string;
  public maxHp: number;
  public hp: number;
  public moveSpeed: number;
  public attackDamage: number;
  public xpValue: number;
  public knockbackResist: number;
  public isBoss: boolean;

  // Knockback physics
  public knockback: Vector2 = new Vector2();
  public hitFlashTimer = 0;
  public animTimer = 0;
  public facingDirection = 1;

  // Special mechanics
  public chargeState: 'IDLE' | 'TELEGRAPH' | 'CHARGING' | 'COOLDOWN' = 'IDLE';
  public chargeTimer = 0;
  public chargeDirection: Vector2 = new Vector2();
  public attackCooldown = 0;

  // Boss mechanics
  public bossPhase = 1;
  public bossSkillTimer = 0;

  constructor(config: EnemyConfig, x: number, y: number) {
    super(x, y, config.radius);
    this.type = config.type;
    this.enemyName = config.name;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
    this.moveSpeed = config.speed;
    this.attackDamage = config.damage;
    this.xpValue = config.xpValue;
    this.knockbackResist = config.knockbackResist;
    this.isBoss = !!config.isBoss;
    this.animTimer = Math.random() * 10;
  }

  public updateEnemy(dt: number, player: Player, separationForce: Vector2, spawnProjectileCallback?: (proj: EnemyProjectile) => void): void {
    if (!this.active) return;

    this.animTimer += dt * 6;

    // Decay hit flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }

    // Decay knockback
    if (this.knockback.lengthSq() > 1) {
      this.position.addScaled(this.knockback, dt);
      this.knockback.multiplyScalar(Math.pow(0.85, dt * 60));
    } else {
      this.knockback.set(0, 0);
    }

    // AI Behaviors
    switch (this.type) {
      case EnemyType.MINOTAUR:
        this.updateMinotaurAI(dt, player, separationForce);
        break;

      case EnemyType.RANGED_SPITTER:
        this.updateRangedSpitterAI(dt, player, separationForce, spawnProjectileCallback);
        break;

      case EnemyType.BOSS_DEMON:
        this.updateBossAI(dt, player, separationForce, spawnProjectileCallback);
        break;

      default:
        this.updateStandardSwarmAI(dt, player, separationForce);
        break;
    }

    // Direction facing
    if (player.position.x > this.position.x) {
      this.facingDirection = 1;
    } else {
      this.facingDirection = -1;
    }
  }

  public update(dt: number): void {
    // Basic fallback if called directly
  }

  private updateStandardSwarmAI(dt: number, player: Player, separation: Vector2): void {
    const toPlayer = player.position.clone().sub(this.position);
    const dist = toPlayer.length();

    if (dist > 1) {
      toPlayer.normalize();
      // Combine seek player + separation from flock
      const finalDir = toPlayer.multiplyScalar(0.75).addScaled(separation, 0.25).normalize();
      this.position.addScaled(finalDir, this.moveSpeed * dt);
    }
  }

  private updateMinotaurAI(dt: number, player: Player, separation: Vector2): void {
    if (this.chargeState === 'IDLE') {
      const dist = this.position.distanceTo(player.position);
      if (dist < 320 && dist > 100) {
        // Begin telegraph
        this.chargeState = 'TELEGRAPH';
        this.chargeTimer = 0.75;
        this.chargeDirection = player.position.clone().sub(this.position).normalize();
      } else {
        this.updateStandardSwarmAI(dt, player, separation);
      }
    } else if (this.chargeState === 'TELEGRAPH') {
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.chargeState = 'CHARGING';
        this.chargeTimer = 0.9;
      }
    } else if (this.chargeState === 'CHARGING') {
      this.chargeTimer -= dt;
      this.position.addScaled(this.chargeDirection, this.moveSpeed * 2.8 * dt);
      if (this.chargeTimer <= 0) {
        this.chargeState = 'COOLDOWN';
        this.chargeTimer = 1.2;
      }
    } else if (this.chargeState === 'COOLDOWN') {
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.chargeState = 'IDLE';
      }
    }
  }

  private updateRangedSpitterAI(dt: number, player: Player, separation: Vector2, spawnProjectileCallback?: (proj: EnemyProjectile) => void): void {
    const toPlayer = player.position.clone().sub(this.position);
    const dist = toPlayer.length();
    const idealDist = 260;

    if (dist < idealDist - 40) {
      // Back away slightly
      const backDir = toPlayer.clone().normalize().multiplyScalar(-1);
      this.position.addScaled(backDir, this.moveSpeed * 0.8 * dt);
    } else if (dist > idealDist + 40) {
      toPlayer.normalize();
      this.position.addScaled(toPlayer, this.moveSpeed * dt);
    }

    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0 && dist < 380 && spawnProjectileCallback) {
      this.attackCooldown = 2.4;
      const spitDir = player.position.clone().sub(this.position).normalize();
      spawnProjectileCallback(new EnemyProjectile(this.position.x, this.position.y, spitDir, 180, 12));
    }
  }

  private updateBossAI(dt: number, player: Player, separation: Vector2, spawnProjectileCallback?: (proj: EnemyProjectile) => void): void {
    // Steady approach + periodic bullet ring burst
    const toPlayer = player.position.clone().sub(this.position).normalize();
    this.position.addScaled(toPlayer, this.moveSpeed * dt);

    this.bossSkillTimer += dt;
    if (this.bossSkillTimer >= 3.5 && spawnProjectileCallback) {
      this.bossSkillTimer = 0;
      // Fire 8-way projectile ring!
      const count = 8;
      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count;
        const dir = Vector2.fromAngle(angle);
        spawnProjectileCallback(new EnemyProjectile(this.position.x, this.position.y, dir, 160, 15, '#a855f7'));
      }
    }
  }

  public applyKnockback(dir: Vector2, force: number): void {
    const effectiveForce = force * (1 - this.knockbackResist);
    if (effectiveForce > 0) {
      this.knockback.addScaled(dir.clone().normalize(), effectiveForce);
    }
  }

  public takeDamage(amount: number): boolean {
    this.hp -= amount;
    this.hitFlashTimer = 0.12;

    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      return true; // Enemy died!
    }
    return false;
  }

  public getDropType(): DropType {
    if (this.isBoss) {
      return DropType.BOSS_CHEST;
    }
    if (this.xpValue >= 20) {
      return DropType.XP_RED;
    }
    if (this.xpValue >= 5) {
      return DropType.XP_GREEN;
    }
    return DropType.XP_CYAN;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();
    ctx.translate(this.position.x, this.position.y);

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius, this.radius * 0.9, this.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Direction flip
    ctx.scale(this.facingDirection, 1);

    if (this.hitFlashTimer > 0) {
      // White hit flash
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      this.renderProceduralGraphic(ctx);
    }

    ctx.restore();

    // Overhead Boss Health Bar
    if (this.isBoss && this.active) {
      this.renderBossHealthBar(ctx);
    }
  }

  private renderProceduralGraphic(ctx: CanvasRenderingContext2D): void {
    const isHit = this.hitFlashTimer > 0;
    const anim = this.animTimer;

    switch (this.type) {
      case EnemyType.WALKER: {
        const frame = Math.floor(anim * 1.5) % 4;
        SpriteRenderer.getInstance().drawSprite(ctx, 'ghoul_walk', frame, 0, 0, 32, 32, 1, isHit);
        break;
      }

      case EnemyType.DASHER: {
        const frame = Math.floor(anim * 2.5) % 4;
        SpriteRenderer.getInstance().drawSprite(ctx, 'bat_fly', frame, 0, 0, 32, 32, 1, isHit);
        break;
      }

      case EnemyType.SWARMER: {
        const frame = Math.floor(anim * 2.0) % 4;
        SpriteRenderer.getInstance().drawSprite(ctx, 'spider_walk', frame, 0, 0, 26, 26, 1, isHit);
        break;
      }

      case EnemyType.TANK: {
        const frame = Math.floor(anim * 1.2) % 4;
        SpriteRenderer.getInstance().drawSprite(ctx, 'golem_walk', frame, 0, 0, 48, 48, 1, isHit);
        break;
      }

      case EnemyType.MINOTAUR: {
        const frame = Math.floor(anim * 1.8) % 4;
        SpriteRenderer.getInstance().drawSprite(ctx, 'minotaur_walk', frame, 0, 0, 48, 48, 1, isHit);
        break;
      }

      case EnemyType.RANGED_SPITTER: {
        const frame = Math.floor(anim * 1.6) % 4;
        SpriteRenderer.getInstance().drawSprite(ctx, 'gargoyle_fly', frame, 0, 0, 34, 34, 1, isHit);
        break;
      }

      case EnemyType.SLIME_LARGE:
      case EnemyType.SLIME_MEDIUM:
      case EnemyType.SLIME_SMALL: {
        const frame = Math.floor(anim * 1.4) % 4;
        const size = this.radius * 2.2;
        SpriteRenderer.getInstance().drawSprite(ctx, 'slime_squish', frame, 0, 0, size, size, 1, isHit);
        break;
      }

      case EnemyType.GHOST: {
        const frame = Math.floor(anim * 1.5) % 4;
        ctx.globalAlpha = 0.72;
        SpriteRenderer.getInstance().drawSprite(ctx, 'ghost_float', frame, 0, 0, 32, 32, 1, isHit);
        break;
      }

      case EnemyType.BOSS_DEMON: {
        const frame = Math.floor(anim) % 4;
        SpriteRenderer.getInstance().drawSprite(ctx, 'demon_boss', frame, 0, 0, 72, 72, 1, isHit);
        break;
      }
    }
  }

  private renderBossHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 64;
    const barHeight = 6;
    const barX = this.position.x - barWidth / 2;
    const barY = this.position.y - this.radius - 18;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    const pct = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(barX, barY, barWidth * pct, barHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.enemyName, this.position.x, barY - 3);
  }
}

export class EnemyProjectile extends Entity {
  public damage: number;
  public lifetime = 4.0;
  public color = '#ef4444';

  constructor(x: number, y: number, dir: Vector2, speed: number, damage: number, color = '#ef4444') {
    super(x, y, 6);
    this.velocity.copy(dir).multiplyScalar(speed);
    this.damage = damage;
    this.color = color;
  }

  public update(dt: number): void {
    if (!this.active) return;
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.active = false;
      return;
    }
    this.position.addScaled(this.velocity, dt);
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
