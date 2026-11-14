import { Entity } from '../entities/Entity';
import { Vector2 } from '../core/Vector2';
import { Player } from '../entities/Player';
import { DropType } from '../entities/DropItem';
import { SpriteRenderer } from '../renderer/SpriteRenderer';
import {
  drawCathedralRoseWeb,
  drawConcentricRuneHalo,
  drawFiligreeSpikeRing,
  drawFourPointStar,
  drawGothicCrossEmblem
} from '../vfx/GothicVFX';

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

  // Knockback physics & Soul Knight Spawn Portal Animation
  public knockback: Vector2 = new Vector2();
  public hitFlashTimer = 0;
  public animTimer = 0;
  public facingDirection = 1;
  public spawnTimer = 0.65;
  public maxSpawnTimer = 0.65;

  // Special mechanics
  public chargeState: 'IDLE' | 'TELEGRAPH' | 'CHARGING' | 'COOLDOWN' = 'IDLE';
  public chargeTimer = 0;
  public chargeDirection: Vector2 = new Vector2();
  public attackCooldown = 0;
  public attackState: 'IDLE' | 'WINDUP' | 'STRIKE' | 'RECOVERY' = 'IDLE';
  public attackStateTimer = 0;
  public readonly attackWindupDuration = 0.55;
  public attackDirection = new Vector2(1, 0);
  public attackHasHit = false;
  public staggerTimer = 0;

  // Elemental Status Effects (Synergy Reactions)
  public burnTimer = 0;
  public burnTickTimer = 0;
  public shockTimer = 0;
  public bleedTimer = 0;
  public freezeTimer = 0;
  public chillTimer = 0;

  // Boss mechanics (Soul Knight High-Mobility Multi-Skill State Machine)
  public bossPhase = 1;
  public bossVariant = 0; // 0: Dark Grand Knight, 1: Frost Archlich, 2: Venom Queen, 3: Infernal Balrog
  public bossSkillTimer = 0;
  public bossState:
    | 'STRAFE'
    | 'DASH_TELEGRAPH'
    | 'DASHING'
    | 'LEAP_TELEGRAPH'
    | 'SPIRAL_HELL'
    | 'LASER_TELEGRAPH'
    | 'LASER_SWEEP'
    | 'SHOTGUN_BLITZ'
    | 'BLOOD_NOVA'
    | 'FROST_RING'
    | 'VENOM_WEB'
    | 'CATACLYSM_NOVA' = 'STRAFE';
  public bossStateTimer = 1.6;
  public bossSubTimer = 0;
  public bossDashRemaining = 0;
  public bossSpiralAngle = 0;
  public bossLaserAngle = 0;
  public bossStrafeSign = 1;
  public bossTargetPos: Vector2 = new Vector2();
  public bossAfterimages: { x: number; y: number; alpha: number; facing: number }[] = [];
  public bossSkillIndex = 0;
  public displayLagHp = 0;
  public bossMuzzleFlashTimer = 0;
  public bossMuzzleAngle = 0;
  public bossSlamWaveTimer = 0;

  constructor(config: EnemyConfig, x: number, y: number) {
    super(x, y, config.radius);
    this.type = config.type;
    this.enemyName = config.name;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
    this.displayLagHp = config.maxHp;
    this.moveSpeed = config.speed;
    this.attackDamage = config.damage;
    this.xpValue = config.xpValue;
    this.knockbackResist = config.knockbackResist;
    this.isBoss = !!config.isBoss;
    this.animTimer = Math.random() * 10;
    this.bossVariant = Math.floor(Math.random() * 4);
    this.maxSpawnTimer = this.isBoss ? 0.85 : 0.62;
    this.spawnTimer = this.maxSpawnTimer;
  }

  public isSpawning(): boolean {
    return this.spawnTimer > 0;
  }

  public updateEnemy(dt: number, player: Player, separationForce: Vector2, spawnProjectileCallback?: (proj: EnemyProjectile) => void): void {
    if (!this.active) return;

    this.animTimer += dt * 6;

    // Soul Knight Summoning Portal Animation: Enemy materializes before acting
    if (this.spawnTimer > 0) {
      this.spawnTimer = Math.max(0, this.spawnTimer - dt);
      if (player.position.x > this.position.x) {
        this.facingDirection = 1;
      } else {
        this.facingDirection = -1;
      }
      return;
    }

    // Decay hit flash & smooth lag HP bar for punchy hit feedback
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }
    if (this.displayLagHp > this.hp) {
      const diff = this.displayLagHp - this.hp;
      this.displayLagHp = Math.max(this.hp, this.displayLagHp - Math.max(this.maxHp * 0.18, diff * 4.2) * dt);
    } else {
      this.displayLagHp = this.hp;
    }
    if (this.bossMuzzleFlashTimer > 0) {
      this.bossMuzzleFlashTimer = Math.max(0, this.bossMuzzleFlashTimer - dt);
    }
    if (this.bossSlamWaveTimer > 0) {
      this.bossSlamWaveTimer = Math.max(0, this.bossSlamWaveTimer - dt);
    }

    // Decay elemental status timers
    if (this.burnTimer > 0) this.burnTimer = Math.max(0, this.burnTimer - dt);
    if (this.shockTimer > 0) this.shockTimer = Math.max(0, this.shockTimer - dt);
    if (this.bleedTimer > 0) this.bleedTimer = Math.max(0, this.bleedTimer - dt);
    if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    if (this.chillTimer > 0) this.chillTimer = Math.max(0, this.chillTimer - dt);

    // Permafrost freeze halts non-boss enemies (slows bosses by 45%)
    const effectiveDt = this.freezeTimer > 0
      ? (this.isBoss ? dt * 0.55 : 0)
      : this.chillTimer > 0
        ? dt * 0.65
        : dt;

    // Decay knockback
    if (this.knockback.lengthSq() > 1) {
      this.position.addScaled(this.knockback, dt);
      this.knockback.multiplyScalar(Math.pow(0.85, dt * 60));
    } else {
      this.knockback.set(0, 0);
    }

    if (this.staggerTimer > 0) {
      this.staggerTimer = Math.max(0, this.staggerTimer - dt);
      return;
    }

    // Non-boss attacks commit to a direction before their damaging frames.
    if (!this.isBoss && this.type !== EnemyType.MINOTAUR && this.attackState !== 'IDLE') {
      this.attackStateTimer = Math.max(0, this.attackStateTimer - dt);
      if (this.attackStateTimer <= 0) {
        if (this.attackState === 'WINDUP') {
          this.attackState = 'STRIKE';
          this.attackStateTimer = 0.16;
          if (this.type === EnemyType.RANGED_SPITTER && spawnProjectileCallback) {
            spawnProjectileCallback(new EnemyProjectile(this.position.x, this.position.y, this.attackDirection, 180, this.attackDamage));
          }
        } else if (this.attackState === 'STRIKE') {
          this.attackState = 'RECOVERY';
          this.attackStateTimer = this.type === EnemyType.RANGED_SPITTER ? 1.7 : 0.9;
        } else {
          this.attackState = 'IDLE';
        }
      }
      return;
    }

    // AI Behaviors
    if (effectiveDt > 0) {
      switch (this.type) {
        case EnemyType.MINOTAUR:
          this.updateMinotaurAI(effectiveDt, player, separationForce);
          break;

        case EnemyType.RANGED_SPITTER:
          this.updateRangedSpitterAI(effectiveDt, player, separationForce, spawnProjectileCallback);
          break;

        case EnemyType.BOSS_DEMON:
          this.updateBossAI(effectiveDt, player, separationForce, spawnProjectileCallback);
          break;

        default:
          this.updateStandardSwarmAI(effectiveDt, player, separationForce);
          break;
      }
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

    if (this.type !== EnemyType.MINOTAUR && dist <= this.radius + player.radius + 12) {
      this.beginAttack(player);
      return;
    }

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

    if (dist < 380 && spawnProjectileCallback) {
      this.beginAttack(player);
    }
  }

  private beginAttack(player: Player): void {
    this.attackState = 'WINDUP';
    this.attackStateTimer = this.attackWindupDuration;
    this.attackHasHit = false;
    this.attackDirection.copy(player.position).sub(this.position);
    if (this.attackDirection.lengthSq() < 0.001) this.attackDirection.set(this.facingDirection, 0);
    this.attackDirection.normalize();
    this.facingDirection = this.attackDirection.x >= 0 ? 1 : -1;
  }

  public canStrikePlayer(player: Player): boolean {
    if (!this.active || this.isSpawning() || this.staggerTimer > 0) return false;
    const offset = player.position.clone().sub(this.position);
    if (this.isBoss) return offset.length() <= this.radius + player.radius;
    if (this.type === EnemyType.MINOTAUR) {
      return this.chargeState === 'CHARGING' && offset.length() <= this.radius + player.radius;
    }
    return this.type !== EnemyType.RANGED_SPITTER && this.attackState === 'STRIKE' && !this.attackHasHit &&
      offset.length() <= this.radius + player.radius + 16 &&
      (offset.lengthSq() < 1 || offset.normalize().dot(this.attackDirection) >= 0.2);
  }

  private updateBossAI(dt: number, player: Player, separation: Vector2, spawnProjectileCallback?: (proj: EnemyProjectile) => void): void {
    // Phase 2 Enrage check (< 50% HP)
    if (this.bossPhase === 1 && this.hp <= this.maxHp * 0.5) {
      this.bossPhase = 2;
      this.bossSlamWaveTimer = 0.52;
      this.bossMuzzleFlashTimer = 0.24;
      // Enrage shockwave ring on phase transition
      if (spawnProjectileCallback) {
        const ringCount = 16;
        for (let i = 0; i < ringCount; i++) {
          const ang = (i * Math.PI * 2) / ringCount;
          spawnProjectileCallback(
            new EnemyProjectile(this.position.x, this.position.y, Vector2.fromAngle(ang), 210, 16, '#fbbf24', 'STAR')
          );
        }
      }
    }

    // Decay dash/leap afterimages
    for (let i = this.bossAfterimages.length - 1; i >= 0; i--) {
      this.bossAfterimages[i].alpha -= dt * 3.2;
      if (this.bossAfterimages[i].alpha <= 0) {
        this.bossAfterimages.splice(i, 1);
      }
    }

    const enrageMult = this.bossPhase === 2 ? 1.35 : 1.0;
    const toPlayer = player.position.clone().sub(this.position);
    const dist = toPlayer.length();
    const dirToPlayer = dist > 1 ? toPlayer.clone().normalize() : new Vector2(1, 0);

    // Palette per Boss Variant
    const primaryColors = ['#ef4444', '#38bdf8', '#10b981', '#f97316'];
    const accentColors = ['#fbbf24', '#c084fc', '#a3e635', '#fef08a'];
    const pColor = primaryColors[this.bossVariant % 4];
    const aColor = accentColors[this.bossVariant % 4];

    this.bossStateTimer -= dt;
    this.bossSubTimer -= dt;

    switch (this.bossState) {
      // ====================================================================
      // 1. HIGH-SPEED TACTICAL STRAFE & SUPPRESSION FIRE (元气骑士高机动走位压制)
      // ====================================================================
      case 'STRAFE': {
        // Orbit + maintain tactical combat distance (190px) at high mobility
        const perp = new Vector2(-dirToPlayer.y * this.bossStrafeSign, dirToPlayer.x * this.bossStrafeSign);
        const radialWeight = dist > 230 ? 0.65 : dist < 135 ? -0.55 : 0.15;
        const moveVec = dirToPlayer.clone().multiplyScalar(radialWeight).addScaled(perp, 0.95).normalize();
        this.position.addScaled(moveVec, this.moveSpeed * 1.55 * enrageMult * dt);

        // Periodic aimed 3-way suppression burst while moving
        if (this.bossSubTimer <= 0 && spawnProjectileCallback) {
          this.bossSubTimer = this.bossPhase === 2 ? 0.52 : 0.72;
          const baseAng = dirToPlayer.angle();
          this.bossMuzzleFlashTimer = 0.16;
          this.bossMuzzleAngle = baseAng;
          const spread = this.bossPhase === 2 ? 4 : 3;
          for (let i = 0; i < spread; i++) {
            const offset = (i - (spread - 1) / 2) * 0.22;
            const d = Vector2.fromAngle(baseAng + offset);
            spawnProjectileCallback(
              new EnemyProjectile(this.position.x, this.position.y, d, 235 * enrageMult, 14, pColor, 'CRESCENT')
            );
          }
        }

        // Transition to next Variant- & Phase-Specific Boss Skill!
        if (this.bossStateTimer <= 0) {
          this.bossStrafeSign *= -1;
          type BossSkill =
            | 'DASH_TELEGRAPH'
            | 'SPIRAL_HELL'
            | 'SHOTGUN_BLITZ'
            | 'LEAP_TELEGRAPH'
            | 'LASER_TELEGRAPH'
            | 'BLOOD_NOVA'
            | 'FROST_RING'
            | 'VENOM_WEB'
            | 'CATACLYSM_NOVA';
          const v = this.bossVariant % 4;
          const p2 = this.bossPhase === 2;
          const skillCycles: Record<number, BossSkill[]> = {
            0: p2
              ? ['DASH_TELEGRAPH', 'BLOOD_NOVA', 'LEAP_TELEGRAPH', 'SHOTGUN_BLITZ']
              : ['DASH_TELEGRAPH', 'SHOTGUN_BLITZ', 'LEAP_TELEGRAPH'],
            1: p2
              ? ['LASER_TELEGRAPH', 'FROST_RING', 'SPIRAL_HELL', 'SHOTGUN_BLITZ']
              : ['SPIRAL_HELL', 'FROST_RING', 'LASER_TELEGRAPH'],
            2: p2
              ? ['VENOM_WEB', 'DASH_TELEGRAPH', 'SPIRAL_HELL', 'LEAP_TELEGRAPH']
              : ['VENOM_WEB', 'LEAP_TELEGRAPH', 'SHOTGUN_BLITZ'],
            3: p2
              ? ['CATACLYSM_NOVA', 'LEAP_TELEGRAPH', 'LASER_TELEGRAPH', 'DASH_TELEGRAPH']
              : ['LEAP_TELEGRAPH', 'DASH_TELEGRAPH', 'LASER_TELEGRAPH']
          };
          const cycle = skillCycles[v];
          const nextSkill = cycle[this.bossSkillIndex % cycle.length];
          this.bossSkillIndex++;
          this.bossState = nextSkill;

          if (nextSkill === 'DASH_TELEGRAPH') {
            this.bossDashRemaining = p2 ? 3 : 2;
            this.bossStateTimer = 0.36;
            this.chargeDirection.copy(dirToPlayer);
          } else if (nextSkill === 'SPIRAL_HELL') {
            this.bossStateTimer = p2 ? 3.0 : 2.5;
            this.bossSubTimer = 0.08;
            this.bossSpiralAngle = dirToPlayer.angle();
          } else if (nextSkill === 'SHOTGUN_BLITZ') {
            this.bossStateTimer = 2.1;
            this.bossSubTimer = 0.15;
          } else if (nextSkill === 'LEAP_TELEGRAPH') {
            this.bossStateTimer = 0.62;
            this.bossTargetPos.copy(player.position);
          } else if (nextSkill === 'LASER_TELEGRAPH') {
            this.bossStateTimer = 0.55;
            this.bossLaserAngle = dirToPlayer.angle() - 0.55;
          } else if (nextSkill === 'BLOOD_NOVA') {
            this.bossStateTimer = 1.65;
            this.bossSubTimer = 0.25;
            this.chargeDirection.copy(dirToPlayer);
          } else if (nextSkill === 'FROST_RING') {
            this.bossStateTimer = 1.85;
            this.bossSubTimer = 0.12;
          } else if (nextSkill === 'VENOM_WEB') {
            this.bossStateTimer = 2.2;
            this.bossSubTimer = 0.16;
          } else if (nextSkill === 'CATACLYSM_NOVA') {
            this.bossStateTimer = 2.6;
            this.bossSubTimer = 0.12;
            this.bossSpiralAngle = dirToPlayer.angle();
          }
        }
        break;
      }

      // ====================================================================
      // 2. MULTI-DASH CHAIN WITH AFTERIMAGES & TRAIL BULLETS (多段残影疾风突刺)
      // ====================================================================
      case 'DASH_TELEGRAPH': {
        // Track player slightly during lock-on
        this.chargeDirection.copy(dirToPlayer);
        if (this.bossStateTimer <= 0) {
          this.bossState = 'DASHING';
          this.bossStateTimer = 0.42;
          this.bossSubTimer = 0.07;
        }
        break;
      }

      case 'DASHING': {
        // Blazing high-speed dash across the arena
        this.position.addScaled(this.chargeDirection, this.moveSpeed * 5.2 * enrageMult * dt);

        // Leave glowing phantom afterimage & fire perpendicular sword-qi bolts
        if (this.bossSubTimer <= 0) {
          this.bossSubTimer = 0.08;
          this.bossAfterimages.push({
            x: this.position.x,
            y: this.position.y,
            alpha: 0.78,
            facing: this.facingDirection
          });
          if (spawnProjectileCallback) {
            const leftDir = new Vector2(-this.chargeDirection.y, this.chargeDirection.x);
            const rightDir = new Vector2(this.chargeDirection.y, -this.chargeDirection.x);
            spawnProjectileCallback(
              new EnemyProjectile(this.position.x, this.position.y, leftDir, 175, 13, aColor, 'STAR')
            );
            spawnProjectileCallback(
              new EnemyProjectile(this.position.x, this.position.y, rightDir, 175, 13, aColor, 'STAR')
            );
          }
        }

        if (this.bossStateTimer <= 0) {
          this.bossDashRemaining--;
          // Burst of crescent waves at the end of each dash
          if (spawnProjectileCallback) {
            for (let k = -2; k <= 2; k++) {
              const d = Vector2.fromAngle(this.chargeDirection.angle() + k * 0.26);
              spawnProjectileCallback(
                new EnemyProjectile(this.position.x, this.position.y, d, 250, 15, pColor, 'CRESCENT')
              );
            }
          }
          if (this.bossDashRemaining > 0) {
            this.bossState = 'DASH_TELEGRAPH';
            this.bossStateTimer = 0.26;
            this.chargeDirection.copy(dirToPlayer);
          } else {
            this.bossState = 'STRAFE';
            this.bossStateTimer = this.bossPhase === 2 ? 1.15 : 1.55;
          }
        }
        break;
      }

      // ====================================================================
      // 3. PHANTOM LEAP SLAM + METEOR HAZARD ZONES (凌空跃击震地 + 陨石轰炸区)
      // ====================================================================
      case 'LEAP_TELEGRAPH': {
        // Surge rapidly toward locked target reticle while leaving afterimages
        const toTarget = this.bossTargetPos.clone().sub(this.position);
        const tDist = toTarget.length();
        if (tDist > 12) {
          this.position.addScaled(toTarget.normalize(), Math.min(tDist, this.moveSpeed * 4.6 * enrageMult * dt));
        }
        if (this.bossSubTimer <= 0) {
          this.bossSubTimer = 0.09;
          this.bossAfterimages.push({
            x: this.position.x,
            y: this.position.y,
            alpha: 0.65,
            facing: this.facingDirection
          });
        }

        if (this.bossStateTimer <= 0 && spawnProjectileCallback) {
          this.bossSlamWaveTimer = 0.48;
          this.bossMuzzleFlashTimer = 0.22;
          // 1. 14-way radial shockwave burst on slam impact!
          const count = this.bossPhase === 2 ? 18 : 14;
          for (let i = 0; i < count; i++) {
            const ang = (i * Math.PI * 2) / count;
            spawnProjectileCallback(
              new EnemyProjectile(this.position.x, this.position.y, Vector2.fromAngle(ang), 205, 16, pColor, 'ORB')
            );
          }
          // 2. Spawn 4 Soul Knight Delayed Meteor Hazard Zones around the player!
          const meteorCount = this.bossPhase === 2 ? 5 : 3;
          for (let m = 0; m < meteorCount; m++) {
            const mAng = (m * Math.PI * 2) / meteorCount + Math.random() * 0.5;
            const mDist = m === 0 ? 25 : 95 + Math.random() * 65;
            const mx = player.position.x + Math.cos(mAng) * mDist;
            const my = player.position.y + Math.sin(mAng) * mDist;
            const meteor = new EnemyProjectile(mx, my, new Vector2(0, 0), 0, 22, '#f97316', 'METEOR_ZONE');
            meteor.radius = 44;
            meteor.lifetime = 0.95;
            meteor.maxLifetime = 0.95;
            spawnProjectileCallback(meteor);
          }

          this.bossState = 'STRAFE';
          this.bossStateTimer = this.bossPhase === 2 ? 1.2 : 1.6;
        }
        break;
      }

      // ====================================================================
      // 4. ROTATING 4/6-ARM SPIRAL BULLET CURTAIN (元气骑士经典旋转弹幕大风车)
      // ====================================================================
      case 'SPIRAL_HELL': {
        // Slowly advance on player while spinning the bullet-hell curtain
        this.position.addScaled(dirToPlayer, this.moveSpeed * 0.65 * dt);
        this.bossSpiralAngle += (this.bossPhase === 2 ? 3.4 : 2.6) * dt;

        if (this.bossSubTimer <= 0 && spawnProjectileCallback) {
          this.bossSubTimer = this.bossPhase === 2 ? 0.11 : 0.14;
          this.bossMuzzleFlashTimer = 0.11;
          this.bossMuzzleAngle = this.bossSpiralAngle;
          const arms = this.bossPhase === 2 ? 6 : 4;
          for (let a = 0; a < arms; a++) {
            const ang = this.bossSpiralAngle + (a * Math.PI * 2) / arms;
            const d = Vector2.fromAngle(ang);
            spawnProjectileCallback(
              new EnemyProjectile(
                this.position.x,
                this.position.y,
                d,
                185 * enrageMult,
                14,
                a % 2 === 0 ? pColor : aColor,
                a % 2 === 0 ? 'STAR' : 'ORB'
              )
            );
          }
        }

        if (this.bossStateTimer <= 0) {
          this.bossState = 'STRAFE';
          this.bossStateTimer = this.bossPhase === 2 ? 1.1 : 1.5;
        }
        break;
      }

      // ====================================================================
      // 5. SWEEPING TWIN PLASMA LASER BEAMS (元气骑士横扫激光束 + 追踪浮游弹)
      // ====================================================================
      case 'LASER_TELEGRAPH': {
        // Hold position & charge twin laser sightlines
        if (this.bossStateTimer <= 0) {
          this.bossState = 'LASER_SWEEP';
          this.bossStateTimer = 1.55;
          this.bossSubTimer = 0.38;
        }
        break;
      }

      case 'LASER_SWEEP': {
        // Sweep twin opposing laser beams across 120 degrees
        const sweepSpeed = (this.bossPhase === 2 ? 1.35 : 1.05) * dt;
        this.bossLaserAngle += sweepSpeed;

        // Check laser beam line-of-sight damage against player (2 opposing beams of length 380px)
        const beamCount = this.bossPhase === 2 ? 3 : 2;
        const beamLen = 380;
        for (let b = 0; b < beamCount; b++) {
          const bAng = this.bossLaserAngle + (b * Math.PI * 2) / beamCount;
          const bx = Math.cos(bAng);
          const by = Math.sin(bAng);
          const relX = player.position.x - this.position.x;
          const relY = player.position.y - this.position.y;
          const proj = relX * bx + relY * by;
          if (proj > 0 && proj < beamLen) {
            const perpDist = Math.abs(relX * -by + relY * bx);
            if (perpDist < player.radius + 10) {
              player.takeDamage(Math.round(this.attackDamage * 0.65));
            }
          }
        }

        // Also launch homing orbs during the laser sweep
        if (this.bossSubTimer <= 0 && spawnProjectileCallback) {
          this.bossSubTimer = 0.48;
          const hDir = Vector2.fromAngle(this.bossLaserAngle + Math.PI * 0.5);
          spawnProjectileCallback(
            new EnemyProjectile(this.position.x, this.position.y, hDir, 155, 15, '#c084fc', 'HOMING')
          );
        }

        if (this.bossStateTimer <= 0) {
          this.bossState = 'STRAFE';
          this.bossStateTimer = this.bossPhase === 2 ? 1.15 : 1.55;
        }
        break;
      }

      // ====================================================================
      // 6. HIGH-SPEED LATERAL BLITZ + MULTI-WAVE SHOTGUN FAN + HOMING ORBS
      // ====================================================================
      case 'SHOTGUN_BLITZ': {
        // Rapidly circle-strafe around the player while unleashing alternating fan curtains
        const blitzPerp = new Vector2(-dirToPlayer.y * this.bossStrafeSign, dirToPlayer.x * this.bossStrafeSign);
        this.position.addScaled(blitzPerp, this.moveSpeed * 2.15 * enrageMult * dt);

        if (this.bossSubTimer <= 0 && spawnProjectileCallback) {
          this.bossSubTimer = this.bossPhase === 2 ? 0.38 : 0.48;
          const baseAng = dirToPlayer.angle();
          this.bossMuzzleFlashTimer = 0.18;
          this.bossMuzzleAngle = baseAng;
          const fanCount = this.bossPhase === 2 ? 9 : 7;
          for (let i = 0; i < fanCount; i++) {
            const ang = baseAng + (i - (fanCount - 1) / 2) * 0.19;
            spawnProjectileCallback(
              new EnemyProjectile(
                this.position.x,
                this.position.y,
                Vector2.fromAngle(ang),
                225 * enrageMult,
                14,
                i % 2 === 0 ? pColor : aColor,
                'CRESCENT'
              )
            );
          }
          // Pair with 1 homing soul orb
          spawnProjectileCallback(
            new EnemyProjectile(this.position.x, this.position.y, dirToPlayer, 150, 15, '#c084fc', 'HOMING')
          );
        }

        if (this.bossStateTimer <= 0) {
          this.bossState = 'STRAFE';
          this.bossStateTimer = this.bossPhase === 2 ? 1.1 : 1.5;
        }
        break;
      }

      // ====================================================================
      // 7. VARIANT 0 (PHASE 2): BLOOD SERAPH NOVA (猩红圣剑十字爆发)
      // ====================================================================
      case 'BLOOD_NOVA': {
        this.position.addScaled(dirToPlayer, this.moveSpeed * 1.45 * dt);
        if (this.bossSubTimer <= 0 && spawnProjectileCallback) {
          this.bossSubTimer = 0.42;
          this.bossMuzzleFlashTimer = 0.16;
          this.bossMuzzleAngle = dirToPlayer.angle();
          const blades = 8;
          const rotOffset = this.bossSkillIndex * 0.25 + this.bossStateTimer;
          for (let i = 0; i < blades; i++) {
            const ang = rotOffset + (i * Math.PI * 2) / blades;
            spawnProjectileCallback(
              new EnemyProjectile(
                this.position.x,
                this.position.y,
                Vector2.fromAngle(ang),
                265,
                16,
                i % 2 === 0 ? '#ef4444' : '#fef08a',
                i % 2 === 0 ? 'CRESCENT' : 'STAR'
              )
            );
          }
        }
        if (this.bossStateTimer <= 0) {
          this.bossState = 'STRAFE';
          this.bossStateTimer = 1.05;
        }
        break;
      }

      // ====================================================================
      // 8. VARIANT 1: GLACIAL FROST RING & ICE GEYSERS (霜骸寒冰环 + 冰暴区)
      // ====================================================================
      case 'FROST_RING': {
        if (this.bossSubTimer <= 0 && spawnProjectileCallback) {
          this.bossSubTimer = this.bossPhase === 2 ? 0.55 : 0.72;
          this.bossMuzzleFlashTimer = 0.18;
          this.bossMuzzleAngle = dirToPlayer.angle();
          const shards = this.bossPhase === 2 ? 12 : 8;
          for (let i = 0; i < shards; i++) {
            const ang = (i * Math.PI * 2) / shards + this.bossStateTimer;
            spawnProjectileCallback(
              new EnemyProjectile(this.position.x, this.position.y, Vector2.fromAngle(ang), 195 * enrageMult, 14, '#38bdf8', 'STAR')
            );
          }
          const geyser = new EnemyProjectile(
            player.position.x + (Math.random() - 0.5) * 70,
            player.position.y + (Math.random() - 0.5) * 70,
            new Vector2(0, 0),
            0,
            18,
            '#38bdf8',
            'METEOR_ZONE'
          );
          geyser.radius = 40;
          geyser.lifetime = 0.9;
          geyser.maxLifetime = 0.9;
          spawnProjectileCallback(geyser);
        }
        if (this.bossStateTimer <= 0) {
          this.bossState = 'STRAFE';
          this.bossStateTimer = this.bossPhase === 2 ? 1.1 : 1.45;
        }
        break;
      }

      // ====================================================================
      // 9. VARIANT 2: VENOM WEB SCURRY (毒渊女皇交织毒网弹幕)
      // ====================================================================
      case 'VENOM_WEB': {
        const scurryPerp = new Vector2(-dirToPlayer.y * this.bossStrafeSign, dirToPlayer.x * this.bossStrafeSign);
        this.position.addScaled(scurryPerp, this.moveSpeed * 2.35 * enrageMult * dt);
        if (this.bossSubTimer <= 0 && spawnProjectileCallback) {
          this.bossSubTimer = this.bossPhase === 2 ? 0.24 : 0.32;
          const baseAng = dirToPlayer.angle();
          this.bossMuzzleFlashTimer = 0.12;
          this.bossMuzzleAngle = baseAng;
          for (const off of [-0.45, -0.15, 0.15, 0.45]) {
            spawnProjectileCallback(
              new EnemyProjectile(
                this.position.x,
                this.position.y,
                Vector2.fromAngle(baseAng + off),
                220 * enrageMult,
                13,
                Math.abs(off) > 0.3 ? '#a3e635' : '#10b981',
                'ORB'
              )
            );
          }
        }
        if (this.bossStateTimer <= 0) {
          this.bossState = 'STRAFE';
          this.bossStateTimer = this.bossPhase === 2 ? 1.05 : 1.4;
        }
        break;
      }

      // ====================================================================
      // 10. VARIANT 3 (PHASE 2): HELLFIRE CATACLYSM (炼狱炎魔陨石漩涡)
      // ====================================================================
      case 'CATACLYSM_NOVA': {
        this.bossSpiralAngle += 3.6 * dt;
        if (this.bossSubTimer <= 0 && spawnProjectileCallback) {
          this.bossSubTimer = 0.14;
          this.bossMuzzleFlashTimer = 0.12;
          this.bossMuzzleAngle = this.bossSpiralAngle;
          for (let a = 0; a < 6; a++) {
            const ang = this.bossSpiralAngle + (a * Math.PI * 2) / 6;
            spawnProjectileCallback(
              new EnemyProjectile(
                this.position.x,
                this.position.y,
                Vector2.fromAngle(ang),
                210,
                15,
                a % 2 === 0 ? '#f97316' : '#fef08a',
                'ORB'
              )
            );
          }
          if (Math.random() < 0.28) {
            const crater = new EnemyProjectile(
              player.position.x + (Math.random() - 0.5) * 110,
              player.position.y + (Math.random() - 0.5) * 110,
              new Vector2(0, 0),
              0,
              22,
              '#f97316',
              'METEOR_ZONE'
            );
            crater.radius = 46;
            crater.lifetime = 0.95;
            crater.maxLifetime = 0.95;
            spawnProjectileCallback(crater);
          }
        }
        if (this.bossStateTimer <= 0) {
          this.bossState = 'STRAFE';
          this.bossStateTimer = 1.15;
        }
        break;
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

    // 0. Render Boss High-Speed Dash/Leap Afterimages & World-Space Telegraphs
    if (this.isBoss) {
      // Leap Slam Target Reticle in World Space (2.5D Gothic Astrolabe Lock Mandala & Converging Spikes)
      if (this.bossState === 'LEAP_TELEGRAPH') {
        ctx.save();
        ctx.translate(this.bossTargetPos.x, this.bossTargetPos.y);
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.86 + Math.sin(this.animTimer * 5) * 0.14;

        // Outer warning glow dome
        const tGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 62);
        tGrad.addColorStop(0, 'rgba(254, 240, 138, 0.48)');
        tGrad.addColorStop(0.6, 'rgba(239, 68, 68, 0.3)');
        tGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 62, 0, Math.PI * 2);
        ctx.fill();

        drawConcentricRuneHalo(ctx, {
          x: 0,
          y: 0,
          r: 52 * pulse,
          primaryColor: '#ef4444',
          accentColor: '#fef08a',
          rotation: this.animTimer * 1.4,
          spokes: 8,
          polygonSides: 8,
          polygonStep: 3,
          ringWidth: 2.2
        });
        drawFiligreeSpikeRing(ctx, 0, 0, 52 * pulse, 8, 9, '#fef08a', -this.animTimer * 1.8, 1.8);
        drawFourPointStar(ctx, 0, 0, 18 * pulse, 4, '#fef08a', '#ffffff', this.animTimer * 2);
        ctx.restore();
      }

      // Phantom Afterimages along Dash / Leap trajectory
      const ghostKey = `boss_v${this.bossVariant % 4}_p${this.bossPhase === 2 ? 2 : 1}_strike`;
      for (const ghost of this.bossAfterimages) {
        ctx.save();
        ctx.translate(ghost.x, ghost.y);
        ctx.scale(ghost.facing, 1);
        ctx.globalAlpha = ghost.alpha * 0.55;
        ctx.globalCompositeOperation = 'lighter';
        const frame = Math.floor(this.animTimer) % 4;
        SpriteRenderer.getInstance().drawSprite(ctx, ghostKey, frame, 0, 0, 104, 104, 1, true);
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(this.position.x, this.position.y);

    // =========================================================================
    // SOUL KNIGHT (元气骑士) ENEMY & BOSS SUMMONING LIGHT/SHADOW PHENOMENON
    // =========================================================================
    if (this.spawnTimer > 0) {
      const spawnProgress = Math.max(0, Math.min(1, 1 - this.spawnTimer / this.maxSpawnTimer));
      const r = this.radius * 1.35;

      if (this.isBoss) {
        // Boss 降临：深渊蚀变暗影扩散池 + 穹顶体积光柱（无简笔线条，纯光影体积感）
        const shadowSpread = r * (0.8 + spawnProgress * 2.4);
        const abyssGrad = ctx.createRadialGradient(0, this.radius * 0.65, 2, 0, this.radius * 0.65, shadowSpread);
        abyssGrad.addColorStop(0, 'rgba(2, 1, 8, 0.94)');
        abyssGrad.addColorStop(0.55, 'rgba(8, 3, 18, 0.76)');
        abyssGrad.addColorStop(0.85, 'rgba(45, 7, 14, 0.32)');
        abyssGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = abyssGrad;
        ctx.beginPath();
        ctx.ellipse(0, this.radius * 0.65, shadowSpread, shadowSpread * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();

        // 地面熔岩暗金蚀环光晕 + 哥特大阵仪轨
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rimR = r * (0.68 + spawnProgress * 1.2);
        const rimGrad = ctx.createRadialGradient(0, this.radius * 0.65, rimR * 0.4, 0, this.radius * 0.65, rimR * 1.3);
        rimGrad.addColorStop(0, 'rgba(220, 38, 38, 0.5)');
        rimGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.36)');
        rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rimGrad;
        ctx.beginPath();
        ctx.ellipse(0, this.radius * 0.65, rimR * 1.3, rimR * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(0, this.radius * 0.65);
        ctx.scale(1, 0.54);
        drawCathedralRoseWeb(ctx, 0, 0, rimR * 1.1, 10, this.animTimer * 0.7, 'rgba(248, 113, 113, 0.65)', 'rgba(254, 240, 138, 0.6)', 1.6);
        drawConcentricRuneHalo(ctx, {
          x: 0,
          y: 0,
          r: rimR,
          primaryColor: 'rgba(251, 191, 36, 0.8)',
          accentColor: '#ef4444',
          rotation: -this.animTimer * 0.9,
          spokes: 8,
          polygonSides: 8,
          polygonStep: 3,
          ringWidth: 2.0
        });
        ctx.restore();
      } else {
        // 普通怪物召唤哥特六芒星法阵
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.scale(1, 0.55);
        ctx.translate(0, this.radius * 1.2);

        const ringScale = spawnProgress < 0.3 ? spawnProgress / 0.3 : 1.0 + Math.sin(spawnProgress * Math.PI * 3) * 0.08;
        drawConcentricRuneHalo(ctx, {
          x: 0,
          y: 0,
          r: r * 1.15 * ringScale,
          primaryColor: '#c084fc',
          accentColor: '#f43f5e',
          rotation: this.animTimer * 1.6,
          spokes: 6,
          polygonSides: 6,
          polygonStep: 2,
          ringWidth: 2.0
        });
        drawFourPointStar(ctx, 0, 0, r * 0.55 * ringScale, 2.5, '#f43f5e', '#fde047', -this.animTimer * 2);
        ctx.restore();
      }

      // 2. Rising Volumetric Portal Energy Pillar & Converging Particles
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beamAlpha = Math.sin(spawnProgress * Math.PI) * (this.isBoss ? 0.85 : 0.65);
      const beamW = this.radius * (this.isBoss ? 1.65 - spawnProgress * 0.45 : 1.2 - spawnProgress * 0.45);
      const beamH = this.radius * (this.isBoss ? 5.2 : 3.6);
      const beamGrad = ctx.createLinearGradient(-beamW, 0, beamW, 0);
      beamGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      beamGrad.addColorStop(0.28, this.isBoss ? 'rgba(185, 28, 28, 0.45)' : 'rgba(192, 132, 252, 0.35)');
      beamGrad.addColorStop(0.5, this.isBoss ? 'rgba(254, 240, 138, 0.85)' : 'rgba(244, 63, 94, 0.68)');
      beamGrad.addColorStop(0.72, this.isBoss ? 'rgba(185, 28, 28, 0.45)' : 'rgba(192, 132, 252, 0.35)');
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = beamAlpha;
      ctx.fillStyle = beamGrad;
      ctx.fillRect(-beamW, -beamH, beamW * 2, beamH + this.radius);

      // Rising volumetric ember motes
      const moteCount = this.isBoss ? 8 : 4;
      for (let s = 0; s < moteCount; s++) {
        const sparkT = (spawnProgress * 2.2 + s * (1 / moteCount)) % 1;
        const sx = Math.sin(s * 2.1 + spawnProgress * 8) * (this.radius * (this.isBoss ? 1.15 : 0.75));
        const sy = this.radius * 0.6 - sparkT * (this.radius * (this.isBoss ? 3.8 : 2.8));
        ctx.fillStyle = s % 2 === 0 ? '#fef08a' : '#ffffff';
        ctx.globalAlpha = (1 - sparkT) * 0.88;
        ctx.beginPath();
        ctx.arc(sx, sy, this.isBoss ? 2.6 * (1 - sparkT * 0.4) : 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3. Elastic Materialization of Enemy Sprite during second half of spawn (0.32 -> 1.0)
      if (spawnProgress > 0.32) {
        const emergeT = Math.min(1, (spawnProgress - 0.32) / 0.68);
        const stretchY = emergeT < 0.7 ? 1.45 - (emergeT / 0.7) * 0.55 : 0.9 + ((emergeT - 0.7) / 0.3) * 0.1;
        const stretchX = emergeT < 0.7 ? 0.35 + (emergeT / 0.7) * 0.75 : 1.1 - ((emergeT - 0.7) / 0.3) * 0.1;
        const dropOffsetY = (1 - Math.pow(emergeT, 0.65)) * -22;

        ctx.save();
        ctx.translate(0, dropOffsetY);
        ctx.scale(this.facingDirection * stretchX, stretchY);
        ctx.globalAlpha = Math.min(1, emergeT * 1.35);
        const prevFlash = this.hitFlashTimer;
        if (emergeT < 0.55) {
          this.hitFlashTimer = 0.1;
        }
        this.renderProceduralGraphic(ctx);
        this.hitFlashTimer = prevFlash;
        ctx.restore();
      }

      ctx.restore();
      return;
    }

    // Directional Ground Shadow (Bosses cast a wide, oppressive abyssal eclipse shadow that swallows nearby floor light)
    if (this.isBoss) {
      const eclipseR = this.bossPhase === 2 ? this.radius * 3.1 : this.radius * 2.6;
      const eclipseGrad = ctx.createRadialGradient(0, this.radius * 0.75, this.radius * 0.2, 0, this.radius * 0.75, eclipseR);
      eclipseGrad.addColorStop(0, 'rgba(1, 0, 5, 0.92)');
      eclipseGrad.addColorStop(0.48, 'rgba(4, 2, 12, 0.74)');
      eclipseGrad.addColorStop(0.78, 'rgba(15, 4, 14, 0.36)');
      eclipseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = eclipseGrad;
      ctx.beginPath();
      ctx.ellipse(0, this.radius * 0.75, eclipseR, eclipseR * 0.54, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
      ctx.beginPath();
      ctx.ellipse(2, this.radius * 0.95, this.radius * 1.05, this.radius * 0.45, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    this.renderAttackTelegraph(ctx);

    // Boss Volumetric Rim-Light Halo, Rising Shadow-Embers & Skill Telegraphs
    if (this.isBoss) {
      const pulse = 0.86 + Math.sin(this.animTimer * 3.2) * 0.14;
      const auraR = (this.bossPhase === 2 ? this.radius * 2.35 : this.radius * 1.95) * pulse;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const auraGrad = ctx.createRadialGradient(0, 8, 4, 0, 8, auraR);
      if (this.bossPhase === 2) {
        auraGrad.addColorStop(0, 'rgba(254, 240, 138, 0.46)');
        auraGrad.addColorStop(0.42, 'rgba(249, 115, 22, 0.30)');
        auraGrad.addColorStop(0.75, 'rgba(185, 28, 28, 0.14)');
      } else {
        auraGrad.addColorStop(0, 'rgba(239, 68, 68, 0.36)');
        auraGrad.addColorStop(0.5, 'rgba(153, 27, 27, 0.18)');
        auraGrad.addColorStop(0.82, 'rgba(88, 28, 135, 0.08)');
      }
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.ellipse(0, 8, auraR, auraR * 0.54, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rising volumetric embers & shadow sparks around the Boss body
      const emberCount = this.bossPhase === 2 ? 7 : 4;
      for (let eIdx = 0; eIdx < emberCount; eIdx++) {
        const cycle = (this.animTimer * 0.55 + eIdx * (1 / emberCount)) % 1;
        const angle = eIdx * 1.7 + this.animTimer * 0.9;
        const dist = this.radius * (0.45 + Math.sin(eIdx * 2.3) * 0.45);
        const ex = Math.cos(angle) * dist;
        const ey = this.radius * 0.55 - cycle * (this.radius * 2.1);
        const er = (1 - cycle) * (this.bossPhase === 2 ? 3.2 : 2.4);
        ctx.fillStyle = eIdx % 2 === 0 ? '#fde047' : '#ef4444';
        ctx.globalAlpha = Math.sin(cycle * Math.PI) * 0.72;
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 0b. Heavy Ground-Slam Tectonic Shockwave & Radial Cracks (落地重砸与二阶段狂暴震地冲击波)
      if (this.bossSlamWaveTimer > 0) {
        const prog = 1 - this.bossSlamWaveTimer / 0.52;
        const slamR = this.radius * (1.2 + prog * 4.2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - prog) * 0.92;
        ctx.scale(1, 0.58);

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 5 * (1 - prog);
        ctx.beginPath();
        ctx.arc(0, 12, slamR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 9 * (1 - prog);
        ctx.beginPath();
        ctx.arc(0, 12, slamR * 0.78, 0, Math.PI * 2);
        ctx.stroke();

        // 8 Tectonic Radial Ground Fissures
        for (let f = 0; f < 8; f++) {
          const fang = (f * Math.PI) / 4 + 0.2;
          ctx.strokeStyle = f % 2 === 0 ? '#fde047' : '#f97316';
          ctx.lineWidth = 2.5 * (1 - prog);
          ctx.beginPath();
          ctx.moveTo(Math.cos(fang) * 18, 12 + Math.sin(fang) * 18);
          ctx.lineTo(Math.cos(fang) * slamR * 1.08, 12 + Math.sin(fang) * slamR * 1.08);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 0c. Boss Weapon Firing Muzzle Shockwave & Recoil Flash (BOSS 发射机关时的枪口风暴冲击光环)
      if (this.bossMuzzleFlashTimer > 0) {
        const mProg = 1 - this.bossMuzzleFlashTimer / 0.2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.rotate(this.bossMuzzleAngle);
        ctx.globalAlpha = Math.max(0, 1 - mProg);

        // Directional muzzle blast cone
        const mGrad = ctx.createRadialGradient(22, 0, 2, 22, 0, 34);
        mGrad.addColorStop(0, '#ffffff');
        mGrad.addColorStop(0.45, '#fde047');
        mGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.arc(22, 0, 34 * (0.6 + mProg * 0.6), 0, Math.PI * 2);
        ctx.fill();

        // Sonic muzzle ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.4 * (1 - mProg);
        ctx.beginPath();
        ctx.ellipse(26 + mProg * 14, 0, 8, 22 * (0.6 + mProg * 0.5), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 1. Boss Multi-Dash Lock-On Sightline (带脉冲箭头的锁定冲锋轨道)
      if (this.bossState === 'DASH_TELEGRAPH') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const dashAng = this.chargeDirection.angle();
        ctx.rotate(dashAng);

        // Glowing corridor strip
        const trackGrad = ctx.createLinearGradient(0, 0, 280, 0);
        trackGrad.addColorStop(0, 'rgba(239, 68, 68, 0.38)');
        trackGrad.addColorStop(0.8, 'rgba(251, 191, 36, 0.18)');
        trackGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = trackGrad;
        ctx.fillRect(0, -16, 280, 32);

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.8;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(275, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated Chevron Arrows along Dash Path
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.4;
        for (let c = 1; c <= 4; c++) {
          const cx = ((c * 58 + this.animTimer * 45) % 250) + 15;
          ctx.beginPath();
          ctx.moveTo(cx - 10, -10);
          ctx.lineTo(cx, 0);
          ctx.lineTo(cx - 10, 10);
          ctx.stroke();
        }
        ctx.restore();
      }

        // 2. Boss Laser Sweep Telegraph & High-Impact Helical Plasma Beams (螺旋高压电浆巨炮与地面熔岩灼痕)
      if (this.bossState === 'LASER_TELEGRAPH' || this.bossState === 'LASER_SWEEP') {
        const beamCount = this.bossPhase === 2 ? 3 : 2;
        const beamLen = 380;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Converging Gothic Octagonal Muzzle Mandala during Laser Telegraph
        if (this.bossState === 'LASER_TELEGRAPH') {
          const telProg = Math.max(0, Math.min(1, 1 - this.bossStateTimer / 0.55));
          const shrinkR = this.radius * (2.6 - telProg * 1.75);
          drawConcentricRuneHalo(ctx, {
            x: 0,
            y: 0,
            r: shrinkR,
            primaryColor: 'rgba(254, 240, 138, 0.88)',
            accentColor: '#ef4444',
            rotation: telProg * 3.2,
            spokes: 8,
            polygonSides: 8,
            polygonStep: 3,
            ringWidth: 2.2
          });
        } else {
          drawFiligreeSpikeRing(ctx, 0, 0, 24, 8, 8, '#fde047', this.animTimer * 4, 2.0);
        }

        // Central Arcane Cannon Muzzle Core on Boss
        const coreR = this.bossState === 'LASER_SWEEP' ? 24 + Math.sin(this.animTimer * 12) * 4 : 15;
        const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, coreR);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.5, '#fbbf24');
        coreGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.fill();
        drawFourPointStar(ctx, 0, 0, coreR * 0.9, 4, '#fde047', '#ffffff', this.animTimer * 5);

        for (let b = 0; b < beamCount; b++) {
          const bAng = this.bossLaserAngle + (b * Math.PI * 2) / beamCount;
          const ex = Math.cos(bAng) * beamLen;
          const ey = Math.sin(bAng) * beamLen;
          if (this.bossState === 'LASER_TELEGRAPH') {
            const telProg = Math.max(0, Math.min(1, 1 - this.bossStateTimer / 0.55));
            // Narrowing Laser Sight Corridor
            const corridorHalfW = Math.max(2, (1 - telProg) * 18);
            ctx.save();
            ctx.rotate(bAng);
            ctx.fillStyle = `rgba(239, 68, 68, ${0.12 + telProg * 0.22})`;
            ctx.fillRect(0, -corridorHalfW, beamLen, corridorHalfW * 2);
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(0, -corridorHalfW);
            ctx.lineTo(beamLen, -corridorHalfW);
            ctx.moveTo(0, corridorHalfW);
            ctx.lineTo(beamLen, corridorHalfW);
            ctx.stroke();
            ctx.restore();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2.2;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            // Layer 1: Wide outer crimson plasma heat-haze
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.42)';
            ctx.lineWidth = 26 + Math.sin(this.animTimer * 18 + b) * 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            // Layer 2: Golden-amber high-voltage plasma body
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            // Layer 3: Helical spiraling energy wave wrapping along the laser shaft
            ctx.save();
            ctx.rotate(bAng);
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            for (let d = 0; d <= beamLen; d += 14) {
              const waveY = Math.sin(d * 0.08 - this.animTimer * 16) * 9;
              if (d === 0) ctx.moveTo(d, waveY);
              else ctx.lineTo(d, waveY);
            }
            ctx.stroke();
            ctx.restore();

            // Layer 4: White-hot blinding laser core
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4.2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            // Layer 5: Molten Ground-Scorch Star Flare at Beam Tip
            const tipGrad = ctx.createRadialGradient(ex, ey, 2, ex, ey, 28);
            tipGrad.addColorStop(0, '#ffffff');
            tipGrad.addColorStop(0.4, '#fde047');
            tipGrad.addColorStop(0.75, 'rgba(239, 68, 68, 0.65)');
            tipGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = tipGrad;
            ctx.beginPath();
            ctx.arc(ex, ey, 28, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    // Direction flip
    ctx.scale(this.facingDirection, 1);

    // Pull back/compress during the tell, then snap forward on release.
    ctx.save();
    if (!this.isBoss) {
      const winding = this.attackState === 'WINDUP' || this.chargeState === 'TELEGRAPH';
      const p = this.chargeState === 'TELEGRAPH'
        ? 1 - Math.max(0, this.chargeTimer) / 0.75
        : 1 - this.attackStateTimer / this.attackWindupDuration;
      if (winding) {
        ctx.translate(-5 * p, 2 * p);
        ctx.scale(1 + p * 0.12, 1 - p * 0.12);
      } else if (this.attackState === 'STRIKE') {
        ctx.translate(6, -2);
      }
    }
    this.renderProceduralGraphic(ctx);
    ctx.restore();

    // Render Boss Stunned / Frozen Gothic Shackles & Orbiting Daze Sigils
    if (this.isBoss && (this.freezeTimer > 0 || this.staggerTimer > 0)) {
      const isIce = this.freezeTimer > 0;
      const t = this.animTimer;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // 1. Perspective Ground Frost/Arcane Binding Seal
      ctx.save();
      ctx.translate(0, this.radius * 0.55);
      ctx.scale(1, 0.5);
      drawConcentricRuneHalo(ctx, {
        x: 0,
        y: 0,
        r: this.radius * 1.5,
        primaryColor: isIce ? 'rgba(56, 189, 248, 0.8)' : 'rgba(251, 191, 36, 0.8)',
        accentColor: '#ffffff',
        rotation: t * 0.45,
        spokes: 6,
        polygonSides: 6,
        polygonStep: 2,
        ringWidth: 2.0
      });
      drawFiligreeSpikeRing(
        ctx,
        0,
        0,
        this.radius * 1.52,
        8,
        7,
        isIce ? 'rgba(125, 211, 252, 0.7)' : 'rgba(254, 240, 138, 0.7)',
        -t * 0.35,
        1.5
      );
      ctx.restore();

      // 2. Faceted Translucent Ice Shards around Boss lower body when frozen
      if (isIce) {
        for (let s = 0; s < 4; s++) {
          const sx = (s - 1.5) * 18;
          const sh = 18 + (s % 2) * 8;
          const sy = this.radius * 0.45;
          ctx.fillStyle = 'rgba(125, 211, 252, 0.28)';
          ctx.strokeStyle = 'rgba(224, 242, 254, 0.72)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(sx - 6, sy);
          ctx.lineTo(sx, sy - sh);
          ctx.lineTo(sx + 6, sy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }

      // 3. Three Orbiting Gothic Stun Rune Stars above Boss Head
      for (let i = 0; i < 3; i++) {
        const ang = t * 1.35 + (i * Math.PI * 2) / 3;
        const ox = Math.cos(ang) * (this.radius * 0.88);
        const oy = -this.radius * 1.35 + Math.sin(ang) * 7;
        drawFourPointStar(ctx, ox, oy, 6.2, 1.8, isIce ? '#7dd3fc' : '#fef08a', '#ffffff', ang);
      }
      ctx.restore();
    }

    // Render Elemental Status Indicators (Burn / Shock / Bleed)
    if (this.burnTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(249, 115, 22, 0.55)';
      ctx.beginPath();
      ctx.arc(0, -4, this.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (this.shockTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Overhead 3D Health Bar (Bosses always show; normal/elite enemies show when damaged)
    if (this.active) {
      if (this.isBoss) {
        this.renderBossHealthBar(ctx);
      } else if (this.hp < this.maxHp) {
        this.renderEnemyMicroHealthBar(ctx);
      }
    }
  }

  private renderAttackTelegraph(ctx: CanvasRenderingContext2D): void {
    if (this.isBoss) return;
    const charging = this.type === EnemyType.MINOTAUR && this.chargeState === 'TELEGRAPH';
    const winding = this.attackState === 'WINDUP' || charging;
    const striking = this.attackState === 'STRIKE';
    if (!winding && !striking && this.staggerTimer <= 0) return;
    const p = charging ? 1 - Math.max(0, this.chargeTimer) / 0.75
      : winding ? 1 - this.attackStateTimer / this.attackWindupDuration : 1;
    const direction = charging ? this.chargeDirection : this.attackDirection;
    const r = this.radius + 16;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = this.staggerTimer > 0 ? this.staggerTimer / 0.8 : 0.4 + p * 0.6;
    // Feathered ground bounce with an obsidian-red body and warm metallic rim.
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.5);
    glow.addColorStop(0, this.staggerTimer > 0 ? 'rgba(52,211,153,0.4)' : 'rgba(127,29,29,0.16)');
    glow.addColorStop(0.5, this.staggerTimer > 0 ? 'rgba(16,185,129,0.28)' : 'rgba(239,68,68,0.28)');
    glow.addColorStop(0.75, 'rgba(251,191,36,0.22)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(0, this.radius * 0.5); ctx.scale(1, 0.48);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (this.staggerTimer <= 0) {
      // A soft directional light tongue communicates the committed attack vector.
      ctx.save(); ctx.rotate(direction.angle()); ctx.translate(r * 0.6, 0); ctx.scale(charging ? 3.2 : 1.6, 0.48);
      const cone = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      cone.addColorStop(0, 'rgba(254,240,138,0.42)');
      cone.addColorStop(0.4, 'rgba(239,68,68,0.24)'); cone.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = cone; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      // Converging, filled gold lancet at the striking hand/mouth.
      const fx = direction.x * (this.radius + 4), fy = direction.y * (this.radius + 4) - 5;
      const flareR = 5 + p * 9;
      const flare = ctx.createRadialGradient(fx, fy, 0, fx, fy, flareR);
      flare.addColorStop(0, 'rgba(255,251,235,0.95)');
      flare.addColorStop(0.2, 'rgba(251,191,36,0.8)');
      flare.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = flare; ctx.beginPath(); ctx.arc(fx, fy, flareR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  private renderProceduralGraphic(ctx: CanvasRenderingContext2D): void {
    const isHit = this.hitFlashTimer > 0;
    const anim = this.animTimer;
    const mobPose: 'move' | 'windup' | 'strike' =
      this.attackState === 'WINDUP' || (this.type === EnemyType.MINOTAUR && this.chargeState === 'TELEGRAPH')
        ? 'windup'
        : this.attackState === 'STRIKE' || (this.type === EnemyType.MINOTAUR && this.chargeState === 'CHARGING')
        ? 'strike'
        : 'move';
    const mobFrame = mobPose === 'move' ? Math.floor(anim * 2.0) % 6 : Math.floor(anim * 3.0) % 4;

    switch (this.type) {
      case EnemyType.WALKER: {
        SpriteRenderer.getInstance().drawSprite(ctx, `ghoul_${mobPose}`, mobFrame, 0, 0, 42, 42, 1, isHit);
        break;
      }

      case EnemyType.DASHER: {
        SpriteRenderer.getInstance().drawSprite(ctx, `bat_${mobPose}`, mobFrame, 0, 0, 42, 42, 1, isHit);
        break;
      }

      case EnemyType.SWARMER: {
        SpriteRenderer.getInstance().drawSprite(ctx, `spider_${mobPose}`, mobFrame, 0, 0, 34, 34, 1, isHit);
        break;
      }

      case EnemyType.TANK: {
        SpriteRenderer.getInstance().drawSprite(ctx, `golem_${mobPose}`, mobFrame, 0, 0, 58, 58, 1, isHit);
        break;
      }

      case EnemyType.MINOTAUR: {
        SpriteRenderer.getInstance().drawSprite(ctx, `minotaur_${mobPose}`, mobFrame, 0, 0, 58, 58, 1, isHit);
        break;
      }

      case EnemyType.RANGED_SPITTER: {
        SpriteRenderer.getInstance().drawSprite(ctx, `gargoyle_${mobPose}`, mobFrame, 0, 0, 44, 44, 1, isHit);
        break;
      }

      case EnemyType.SLIME_LARGE:
      case EnemyType.SLIME_MEDIUM:
      case EnemyType.SLIME_SMALL: {
        const size = this.radius * 2.5;
        SpriteRenderer.getInstance().drawSprite(ctx, `slime_${mobPose}`, mobFrame, 0, 0, size, size, 1, isHit);
        break;
      }

      case EnemyType.GHOST: {
        ctx.globalAlpha = 0.78;
        SpriteRenderer.getInstance().drawSprite(ctx, `ghost_${mobPose}`, mobFrame, 0, 0, 42, 42, 1, isHit);
        break;
      }

      case EnemyType.BOSS_DEMON: {
        const isBossStunned = this.freezeTimer > 0 || this.staggerTimer > 0;
        const bossPose: 'move' | 'windup' | 'strike' | 'stunned' = isBossStunned
          ? 'stunned'
          : this.bossState === 'DASH_TELEGRAPH' ||
            this.bossState === 'LEAP_TELEGRAPH' ||
            this.bossState === 'LASER_TELEGRAPH'
          ? 'windup'
          : this.bossState === 'STRAFE'
          ? 'move'
          : 'strike';
        const bossFrame =
          bossPose === 'move'
            ? Math.floor(anim * 1.6) % 6
            : bossPose === 'stunned'
            ? Math.floor(anim * 2.2) % 4
            : Math.floor(anim * 2.8) % 4;
        const bossSize = this.bossPhase === 2 ? 116 : 104;
        const bossKey = `boss_v${this.bossVariant % 4}_p${this.bossPhase === 2 ? 2 : 1}_${bossPose}`;
        SpriteRenderer.getInstance().drawSprite(
          ctx,
          bossKey,
          bossFrame,
          0,
          0,
          bossSize,
          bossSize,
          1,
          isBossStunned ? false : isHit
        );
        break;
      }
    }
  }

  /**
   * 受伤普通/精英怪物的立体微缩血条 (3D Beveled Micro-Bar with Drop Shadow & Cylindrical Ruby Fill)
   */
  private renderEnemyMicroHealthBar(ctx: CanvasRenderingContext2D): void {
    const barW = Math.max(24, Math.min(44, this.radius * 1.9));
    const barH = 4;
    const bx = this.position.x - barW / 2;
    const by = this.position.y - this.radius - 12;

    ctx.save();
    // 1. 3D 悬浮投影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(bx - 1, by + 1.5, barW + 2, barH + 2);

    // 2. 斜切黑铁底槽与铜边
    ctx.fillStyle = '#090d16';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    ctx.strokeStyle = 'rgba(180, 83, 9, 0.75)';
    ctx.lineWidth = 0.9;
    ctx.strokeRect(bx - 1, by - 1, barW + 2, barH + 2);

    // 3. 3D 圆柱玻璃血槽渐变
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    const fillW = barW * pct;
    if (fillW > 0.5) {
      const grad = ctx.createLinearGradient(0, by, 0, by + barH);
      grad.addColorStop(0, '#fecaca');
      grad.addColorStop(0.4, '#ef4444');
      grad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, fillW, barH);

      // 顶部高光反光带
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(bx, by, fillW, 1.2);
    }
    ctx.restore();
  }

  /**
   * 极简克制的首领微缩血条（无浮夸大边框、王冠或文字，适配同屏多 Boss 战斗，保留受击白金残影反馈）
   */
  private renderBossHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 64;
    const barHeight = 4.5;
    const barX = this.position.x - barWidth / 2;
    const barY = this.position.y - this.radius - 18;
    const isEnraged = this.bossPhase === 2;

    const shakeX = this.hitFlashTimer > 0 ? (Math.random() - 0.5) * 2.5 : 0;
    const shakeY = this.hitFlashTimer > 0 ? (Math.random() - 0.5) * 1.8 : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. 柔和悬浮底影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(barX - 1.5, barY + 1.5, barWidth + 3, barHeight + 2);

    // 2. 极简黑曜暗槽与细线外框
    ctx.fillStyle = '#05070e';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
    ctx.strokeStyle = isEnraged ? 'rgba(251, 191, 36, 0.75)' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 0.9;
    ctx.strokeRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    // 3. 延迟受击白金残影条
    const lagPct = Math.max(0, Math.min(1, this.displayLagHp / this.maxHp));
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    if (lagPct > pct + 0.004) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.88)';
      ctx.fillRect(barX, barY, barWidth * lagPct, barHeight);
    }

    // 4. 主血量填充
    const fillW = barWidth * pct;
    if (fillW > 0.5) {
      const bossGrad = ctx.createLinearGradient(0, barY, 0, barY + barHeight);
      if (isEnraged) {
        bossGrad.addColorStop(0, '#fef08a');
        bossGrad.addColorStop(0.45, '#f97316');
        bossGrad.addColorStop(1, '#9a3412');
      } else {
        bossGrad.addColorStop(0, '#fca5a5');
        bossGrad.addColorStop(0.4, '#ef4444');
        bossGrad.addColorStop(1, '#7f1d1d');
      }
      ctx.fillStyle = bossGrad;
      ctx.fillRect(barX, barY, fillW, barHeight);

      // 1px 顶部微高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.fillRect(barX, barY, fillW, 1.2);
    }

    // 5. 50% 阶段极细分割线
    ctx.fillStyle = 'rgba(5, 7, 14, 0.85)';
    ctx.fillRect(barX + barWidth * 0.5 - 0.5, barY, 1, barHeight);

    ctx.restore();
  }
}

export type EnemyProjectileStyle = 'ORB' | 'STAR' | 'CRESCENT' | 'HOMING' | 'METEOR_ZONE';

export class EnemyProjectile extends Entity {
  public damage: number;
  public lifetime = 4.0;
  public maxLifetime = 4.0;
  public elapsed = 0;
  public color = '#ef4444';
  public visualType: EnemyProjectileStyle = 'ORB';
  public hasDetonated = false;
  public hasImpactBurst = false;
  public isReflected = false;
  public hitEnemyIds: Set<number> = new Set();

  constructor(
    x: number,
    y: number,
    dir: Vector2,
    speed: number,
    damage: number,
    color = '#ef4444',
    visualType: EnemyProjectileStyle = 'ORB'
  ) {
    super(x, y, visualType === 'CRESCENT' ? 9.5 : visualType === 'STAR' ? 8 : 7);
    this.velocity.copy(dir).multiplyScalar(speed);
    this.damage = damage;
    this.color = color;
    this.visualType = visualType;
    if (visualType === 'HOMING') {
      this.lifetime = 3.4;
      this.maxLifetime = 3.4;
    }
  }

  /**
   * Deflects this enemy projectile via Player Sword Qi!
   * Reverses/aims toward enemies, boosts speed & damage, and switches to Friendly Emerald-Gold visual color.
   */
  public reflect(newDir: Vector2, reflectedDamage: number): void {
    this.isReflected = true;
    const newSpeed = Math.max(380, this.velocity.length() * 1.75);
    this.velocity.copy(newDir).normalize().multiplyScalar(newSpeed);
    this.damage = reflectedDamage;
    this.color = '#10b981'; // Emerald-Jade friendly signature!
    this.radius = Math.max(this.radius, 8.5);
    this.lifetime = 3.0;
    this.maxLifetime = 3.0;
  }

  public update(dt: number, player?: Player): void {
    if (!this.active) return;
    this.elapsed += dt;
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.active = false;
      return;
    }

    // Homing steering for first 1.5s (only while hostile)
    if (!this.isReflected && this.visualType === 'HOMING' && player && this.elapsed < 1.5) {
      const toPlayer = player.position.clone().sub(this.position);
      if (toPlayer.lengthSq() > 4) {
        const desiredDir = toPlayer.normalize();
        const curSpeed = this.velocity.length() || 155;
        const curDir = this.velocity.clone().normalize();
        curDir.addScaled(desiredDir, dt * 2.6).normalize();
        this.velocity.copy(curDir).multiplyScalar(curSpeed);
      }
    }

    this.position.addScaled(this.velocity, dt);
  }

  public canDamagePlayer(): boolean {
    if (this.isReflected) return false;
    if (this.visualType === 'METEOR_ZONE') {
      return this.lifetime <= 0.18 && !this.hasDetonated;
    }
    return true;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.position.x, this.position.y);

    // Smooth spawn & fade-out alpha transition
    const spawnAlpha = Math.min(1, this.elapsed / 0.06);
    const fadeAlpha = Math.min(1, this.lifetime / 0.14);

    // =========================================================================
    // REFLECTED FRIENDLY PROJECTILE (Emerald-Jade & Holy Gold — Zero Player Harm)
    // =========================================================================
    if (this.isReflected) {
      ctx.globalAlpha = fadeAlpha;
      ctx.globalCompositeOperation = 'lighter';

      // 1. Consecrated Emerald-Gold Halo Mandala (Instantly readable friendly parry projectile)
      drawConcentricRuneHalo(ctx, {
        x: 0,
        y: 0,
        r: this.radius * 1.8,
        primaryColor: '#34d399',
        accentColor: '#fef08a',
        rotation: this.elapsed * 7,
        spokes: 4,
        polygonSides: 4,
        polygonStep: 1,
        ringWidth: 1.6,
        showNodes: true,
        dashedInner: false
      });

      ctx.save();
      ctx.rotate(this.velocity.angle());

      // 2. Long Emerald-Turquoise Comet Wake
      const wakeGrad = ctx.createLinearGradient(-this.radius * 5.0, 0, this.radius, 0);
      wakeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      wakeGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.7)');
      wakeGrad.addColorStop(1, 'rgba(254, 240, 138, 0.95)');
      ctx.fillStyle = wakeGrad;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 5.0, 0);
      ctx.lineTo(0, -this.radius * 1.2);
      ctx.lineTo(this.radius * 1.4, 0);
      ctx.lineTo(0, this.radius * 1.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3. Radial Jade-Gold Aura
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, this.radius * 2.8);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.4, '#34d399');
      glow.addColorStop(0.75, 'rgba(250, 204, 21, 0.48)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 2.8, 0, Math.PI * 2);
      ctx.fill();

      // 4. Spinning Consecrated Patonce Cross + White Star Core
      drawGothicCrossEmblem(ctx, 0, 0, this.radius * 1.65, 2.2, '#fef08a', '#ffffff', this.elapsed * 14);

      ctx.restore();
      return;
    }

    if (this.visualType === 'METEOR_ZONE') {
      const progress = Math.max(0, Math.min(1, 1 - this.lifetime / this.maxLifetime));
      ctx.globalCompositeOperation = 'lighter';

      // 1. Tactical Ground Hazard Mandala (双层旋转哥特星盘预警法阵 + 聚焦收缩尖刺环)
      drawCathedralRoseWeb(
        ctx,
        0,
        0,
        this.radius * 0.94,
        8,
        -this.elapsed * 1.2,
        progress > 0.8 ? '#ffffff' : 'rgba(249, 115, 22, 0.72)',
        'rgba(254, 240, 138, 0.6)',
        1.5
      );
      drawConcentricRuneHalo(ctx, {
        x: 0,
        y: 0,
        r: this.radius,
        primaryColor: progress > 0.8 ? '#ffffff' : 'rgba(249, 115, 22, 0.92)',
        accentColor: '#fef08a',
        rotation: this.elapsed * 2.4,
        spokes: 8,
        polygonSides: 8,
        polygonStep: 3,
        ringWidth: 2.1
      });

      // Focusing Contraction Ring with Spikes (聚焦收缩环：从外向圆心急速收拢)
      const shrinkRadius = Math.max(5, this.radius * (1.35 - progress * 1.15));
      drawFiligreeSpikeRing(
        ctx,
        0,
        0,
        shrinkRadius,
        8,
        7,
        progress > 0.75 ? '#ffffff' : '#fef08a',
        this.elapsed * 3,
        2.0
      );

      // Runic Charge Ripple (符文充能波纹)
      const ripplePhase = (this.elapsed * 3.5) % 1;
      ctx.strokeStyle = `rgba(251, 191, 36, ${(1 - ripplePhase) * 0.75})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * (0.25 + ripplePhase * 0.75), 0, Math.PI * 2);
      ctx.stroke();

      // Inner expanding magma charge circle
      const fillGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, this.radius * progress);
      fillGrad.addColorStop(0, 'rgba(254, 240, 138, 0.68)');
      fillGrad.addColorStop(0.65, 'rgba(239, 68, 68, 0.45)');
      fillGrad.addColorStop(1, 'rgba(220, 38, 38, 0.16)');
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * progress, 0, Math.PI * 2);
      ctx.fill();

      // 2. Falling Skyfall Meteor Boulder & Twin Plasma Wake OR Violent Tectonic Crater Eruption!
      const dropY = -210 * (1 - Math.pow(progress, 1.85));
      if (progress < 0.83) {
        // Outer wide fire wake
        const outerWake = ctx.createLinearGradient(18 * (1 - progress), dropY - 76, 0, dropY);
        outerWake.addColorStop(0, 'rgba(0, 0, 0, 0)');
        outerWake.addColorStop(0.5, 'rgba(239, 68, 68, 0.68)');
        outerWake.addColorStop(1, '#fbbf24');
        ctx.strokeStyle = outerWake;
        ctx.lineWidth = 16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(18 * (1 - progress), dropY - 76);
        ctx.lineTo(0, dropY);
        ctx.stroke();

        // Inner white-hot core streak
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(10 * (1 - progress), dropY - 40);
        ctx.lineTo(0, dropY);
        ctx.stroke();

        // Crowned Molten Meteorhead Boulder
        drawFiligreeSpikeRing(ctx, 0, dropY, 10, 6, 6, '#f97316', this.elapsed * 8, 1.6);
        drawFourPointStar(ctx, 0, dropY, 13, 3.5, '#fef08a', '#ffffff', this.elapsed * 5);
      } else {
        // Detonation Impact Dome + 12 Radiating Gothic Lava Spikes!
        const impactT = Math.min(1, (progress - 0.83) / 0.17);
        const domeGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, this.radius * (1.08 + impactT * 0.25));
        domeGrad.addColorStop(0, '#ffffff');
        domeGrad.addColorStop(0.45, 'rgba(254, 240, 138, 0.94)');
        domeGrad.addColorStop(0.8, 'rgba(239, 68, 68, 0.78)');
        domeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = domeGrad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * (1.08 + impactT * 0.25), 0, Math.PI * 2);
        ctx.fill();

        drawFiligreeSpikeRing(ctx, 0, 0, this.radius * 0.9, 12, this.radius * (0.4 + impactT * 0.3), '#fef08a', 0.2, 2.4);
      }

      ctx.restore();
      return;
    }

    ctx.globalAlpha = spawnAlpha * fadeAlpha;
    ctx.rotate(this.velocity.angle());
    ctx.globalCompositeOperation = 'lighter';

    // 1. Multi-Stop High-Velocity Kinetic Ribbon Wake (流线型高动能破空尾迹)
    const wakeLen = this.visualType === 'CRESCENT' ? this.radius * 4.4 : this.radius * 3.9;
    const wakeGrad = ctx.createLinearGradient(-wakeLen, 0, this.radius * 0.5, 0);
    wakeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    wakeGrad.addColorStop(0.55, `${this.color}88`);
    wakeGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = wakeGrad;
    ctx.beginPath();
    ctx.moveTo(-wakeLen, 0);
    ctx.lineTo(-this.radius * 0.4, -this.radius * 0.98);
    ctx.lineTo(this.radius * 0.85, 0);
    ctx.lineTo(-this.radius * 0.4, this.radius * 0.98);
    ctx.closePath();
    ctx.fill();

    // 2. Outer Hellfire / Arcane Radial Corona
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, this.radius * 2.8);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.38, this.color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 2.8, 0, Math.PI * 2);
    ctx.fill();

    if (this.visualType === 'CRESCENT') {
      // Heavy 3-Layer Boss Crescent Slash Wave + Gothic Spike Filaments
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.arc(4, 0, this.radius * 1.72, -Math.PI * 0.44, Math.PI * 0.44);
      ctx.stroke();

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(2, 0, this.radius * 1.6, -Math.PI * 0.56, Math.PI * 0.56, false);
      ctx.arc(-4.5, 0, this.radius * 1.3, Math.PI * 0.48, -Math.PI * 0.48, true);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(3, 0, this.radius * 1.45, -Math.PI * 0.5, Math.PI * 0.5, false);
      ctx.arc(-2, 0, this.radius * 1.24, Math.PI * 0.42, -Math.PI * 0.42, true);
      ctx.closePath();
      ctx.fill();
    } else if (this.visualType === 'STAR') {
      // Ornate Rotating Gothic Saw-Wheel / Pinwheel Rune
      ctx.rotate(this.elapsed * 14);
      drawConcentricRuneHalo(ctx, {
        x: 0,
        y: 0,
        r: this.radius * 1.48,
        primaryColor: this.color,
        accentColor: '#ffffff',
        rotation: 0,
        spokes: 4,
        polygonSides: 4,
        polygonStep: 1,
        ringWidth: 1.5,
        showNodes: true,
        dashedInner: false
      });
      drawFourPointStar(ctx, 0, 0, this.radius * 1.72, 2.8, this.color, '#ffffff');
    } else if (this.visualType === 'HOMING') {
      // Homing Abyssal Eye Seeker inside Counter-Rotating Hex Seal
      drawConcentricRuneHalo(ctx, {
        x: 0,
        y: 0,
        r: this.radius * 1.65,
        primaryColor: '#e879f9',
        accentColor: '#fde047',
        rotation: this.elapsed * 7.5,
        spokes: 6,
        polygonSides: 6,
        polygonStep: 2,
        ringWidth: 1.5
      });

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.88, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#581c87';
      ctx.beginPath();
      ctx.arc(this.radius * 0.25, 0, this.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Heavy Beveled Gothic Rune Bolt + Mini Halo
      drawFiligreeSpikeRing(ctx, 0, 0, this.radius * 1.15, 4, 3.2, this.color, this.elapsed * 8, 1.2);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(this.radius * 1.5, 0);
      ctx.lineTo(0, -this.radius * 0.95);
      ctx.lineTo(-this.radius * 1.2, 0);
      ctx.lineTo(0, this.radius * 0.95);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(this.radius * 1.05, 0);
      ctx.lineTo(0, -this.radius * 0.55);
      ctx.lineTo(-this.radius * 0.75, 0);
      ctx.lineTo(0, this.radius * 0.55);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
