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

  // Elemental Status Effects (Synergy Reactions)
  public burnTimer = 0;
  public burnTickTimer = 0;
  public shockTimer = 0;
  public bleedTimer = 0;

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
    | 'SHOTGUN_BLITZ' = 'STRAFE';
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

        // Transition to next Soul Knight Boss Skill!
        if (this.bossStateTimer <= 0) {
          this.bossStrafeSign *= -1;
          const skillCycle: Array<'DASH_TELEGRAPH' | 'SPIRAL_HELL' | 'SHOTGUN_BLITZ' | 'LEAP_TELEGRAPH' | 'LASER_TELEGRAPH'> = [
            'DASH_TELEGRAPH',
            'SPIRAL_HELL',
            'SHOTGUN_BLITZ',
            'LEAP_TELEGRAPH',
            'LASER_TELEGRAPH'
          ];
          const nextSkill = skillCycle[(this.bossSkillIndex + this.bossVariant) % skillCycle.length];
          this.bossSkillIndex++;
          this.bossState = nextSkill;

          if (nextSkill === 'DASH_TELEGRAPH') {
            this.bossDashRemaining = this.bossPhase === 2 ? 3 : 2;
            this.bossStateTimer = 0.36;
            this.chargeDirection.copy(dirToPlayer);
          } else if (nextSkill === 'SPIRAL_HELL') {
            this.bossStateTimer = this.bossPhase === 2 ? 3.0 : 2.5;
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
      // Leap Slam Target Reticle in World Space (2.5D Octagonal Target Lock & Converging Wave)
      if (this.bossState === 'LEAP_TELEGRAPH') {
        ctx.save();
        ctx.translate(this.bossTargetPos.x, this.bossTargetPos.y);
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.85 + Math.sin(this.animTimer * 5) * 0.15;

        // Outer warning glow dome
        const tGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 56);
        tGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
        tGrad.addColorStop(0.6, 'rgba(239, 68, 68, 0.28)');
        tGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 56, 0, Math.PI * 2);
        ctx.fill();

        // Rotating dashed lock ring
        ctx.save();
        ctx.rotate(this.animTimer * 1.2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.6;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, 50 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Crosshair lock spikes
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.2;
        for (let k = 0; k < 4; k++) {
          const ka = (k * Math.PI) / 2 + Math.PI * 0.25;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ka) * 18, Math.sin(ka) * 18);
          ctx.lineTo(Math.cos(ka) * 38 * pulse, Math.sin(ka) * 38 * pulse);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Phantom Afterimages along Dash / Leap trajectory
      for (const ghost of this.bossAfterimages) {
        ctx.save();
        ctx.translate(ghost.x, ghost.y);
        ctx.scale(ghost.facing, 1);
        ctx.globalAlpha = ghost.alpha * 0.55;
        ctx.globalCompositeOperation = 'lighter';
        const frame = Math.floor(this.animTimer) % 4;
        SpriteRenderer.getInstance().drawSprite(ctx, 'demon_boss', frame, 0, 0, 72, 72, ghost.alpha * 0.55, true);
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(this.position.x, this.position.y);

    // =========================================================================
    // SOUL KNIGHT (元气骑士) ENEMY SUMMONING PORTAL ANIMATION
    // =========================================================================
    if (this.spawnTimer > 0) {
      const spawnProgress = Math.max(0, Math.min(1, 1 - this.spawnTimer / this.maxSpawnTimer));
      const portalColor = this.isBoss ? '#fbbf24' : '#c084fc';
      const crossColor = this.isBoss ? '#ef4444' : '#f43f5e';
      const r = this.radius * 1.35;

      // 1. Rotating Dark-Arcane Summoning Circle & Pulsing '✖' Cross Reticle on Ground
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.scale(1, 0.55); // 2.5D ground perspective
      ctx.translate(0, this.radius * 1.2);

      const ringScale = spawnProgress < 0.3 ? spawnProgress / 0.3 : 1.0 + Math.sin(spawnProgress * Math.PI * 3) * 0.08;
      ctx.rotate(this.animTimer * 1.4);
      ctx.strokeStyle = portalColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * ringScale, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = crossColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72 * ringScale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Soul Knight Signature '✖' Summoning Cross-Mark inside Circle
      const crossLen = r * 0.68 * ringScale;
      ctx.strokeStyle = crossColor;
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-crossLen, -crossLen);
      ctx.lineTo(crossLen, crossLen);
      ctx.moveTo(crossLen, -crossLen);
      ctx.lineTo(-crossLen, crossLen);
      ctx.stroke();
      ctx.restore();

      // 2. Rising Vertical Portal Energy Pillar & Converging Particles
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beamAlpha = Math.sin(spawnProgress * Math.PI) * 0.65;
      const beamW = this.radius * (1.2 - spawnProgress * 0.45);
      const beamH = this.radius * 3.6;
      const beamGrad = ctx.createLinearGradient(0, this.radius, 0, -beamH);
      beamGrad.addColorStop(0, this.isBoss ? 'rgba(239, 68, 68, 0.75)' : 'rgba(192, 132, 252, 0.72)');
      beamGrad.addColorStop(0.5, this.isBoss ? 'rgba(251, 191, 36, 0.35)' : 'rgba(244, 63, 94, 0.32)');
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = beamAlpha;
      ctx.fillStyle = beamGrad;
      ctx.fillRect(-beamW, -beamH, beamW * 2, beamH + this.radius);

      // Rising portal sparks
      for (let s = 0; s < 4; s++) {
        const sparkT = (spawnProgress * 2 + s * 0.25) % 1;
        const sx = Math.sin(s * 2.1 + spawnProgress * 8) * (this.radius * 0.75);
        const sy = this.radius * 0.6 - sparkT * (this.radius * 2.8);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = (1 - sparkT) * 0.85;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3. Elastic Materialization of Enemy Sprite during second half of spawn (0.35 -> 1.0)
      if (spawnProgress > 0.32) {
        const emergeT = Math.min(1, (spawnProgress - 0.32) / 0.68);
        // Elastic ease-out pop-in
        const stretchY = emergeT < 0.7 ? 1.45 - (emergeT / 0.7) * 0.55 : 0.9 + ((emergeT - 0.7) / 0.3) * 0.1;
        const stretchX = emergeT < 0.7 ? 0.35 + (emergeT / 0.7) * 0.75 : 1.1 - ((emergeT - 0.7) / 0.3) * 0.1;
        const dropOffsetY = (1 - Math.pow(emergeT, 0.65)) * -22;

        ctx.save();
        ctx.translate(0, dropOffsetY);
        ctx.scale(this.facingDirection * stretchX, stretchY);
        ctx.globalAlpha = Math.min(1, emergeT * 1.35);
        const prevFlash = this.hitFlashTimer;
        if (emergeT < 0.55) {
          this.hitFlashTimer = 0.1; // White-hot teleport silhouette on arrival!
        }
        this.renderProceduralGraphic(ctx);
        this.hitFlashTimer = prevFlash;
        ctx.restore();
      }

      ctx.restore();
      return;
    }

    // Directional Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.beginPath();
    ctx.ellipse(2, this.radius * 0.95, this.radius * 1.05, this.radius * 0.45, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Minotaur Charge Telegraph Indicator (Glowing Red Line + Warning Ring)
    if (this.type === EnemyType.MINOTAUR && this.chargeState === 'TELEGRAPH') {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(this.chargeDirection.x * 160, this.chargeDirection.y * 160);
      ctx.stroke();
      ctx.restore();
    }

    // Boss Demonic Ground Aura & Soul Knight Skill Telegraphs
    if (this.isBoss) {
      const auraR = this.bossPhase === 2 ? this.radius * 2.3 : this.radius * 1.9;
      const auraGrad = ctx.createRadialGradient(0, 10, 4, 0, 10, auraR);
      auraGrad.addColorStop(0, this.bossPhase === 2 ? 'rgba(251, 191, 36, 0.48)' : 'rgba(220, 38, 38, 0.35)');
      auraGrad.addColorStop(0.55, 'rgba(220, 38, 38, 0.18)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.ellipse(0, 10, auraR, auraR * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();

      // Enrage Rotating Runic Ring (Phase 2)
      if (this.bossPhase === 2) {
        ctx.save();
        ctx.rotate(this.animTimer * 0.4);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(0, 4, this.radius * 1.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

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

        // Central Arcane Cannon Muzzle Core on Boss
        const coreR = this.bossState === 'LASER_SWEEP' ? 22 + Math.sin(this.animTimer * 12) * 4 : 14;
        const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, coreR);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.5, '#fbbf24');
        coreGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.fill();

        for (let b = 0; b < beamCount; b++) {
          const bAng = this.bossLaserAngle + (b * Math.PI * 2) / beamCount;
          const ex = Math.cos(bAng) * beamLen;
          const ey = Math.sin(bAng) * beamLen;
          if (this.bossState === 'LASER_TELEGRAPH') {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.78)';
            ctx.lineWidth = 2.5;
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

    // Render crisp pixel-art sprite (automatically swaps to white silhouette when hitFlashTimer > 0)
    this.renderProceduralGraphic(ctx);

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
   * 首领级 3D 浮雕黑曜鎏金血条（含延迟受击白金残影条、二阶段狂暴双翼王冠、50%狂暴锁扣与宝石端帽）
   */
  private renderBossHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 104;
    const barHeight = 9;
    const barX = this.position.x - barWidth / 2;
    const barY = this.position.y - this.radius - 26;
    const isEnraged = this.bossPhase === 2;

    // 受击震动微偏移
    const shakeX = this.hitFlashTimer > 0 ? (Math.random() - 0.5) * 3.5 : 0;
    const shakeY = this.hitFlashTimer > 0 ? (Math.random() - 0.5) * 2.5 : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. 3D 悬浮深邃暗影与外层暗金/绯红呼吸光晕
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.beginPath();
    ctx.roundRect(barX - 4, barY + 2.5, barWidth + 8, barHeight + 6, 4);
    ctx.fill();

    // 2. 立体斜切黑曜金属外框底座
    const frameGrad = ctx.createLinearGradient(0, barY - 3, 0, barY + barHeight + 3);
    frameGrad.addColorStop(0, isEnraged ? '#fef08a' : '#64748b');
    frameGrad.addColorStop(0.5, '#0f172a');
    frameGrad.addColorStop(1, '#020617');
    ctx.fillStyle = frameGrad;
    ctx.beginPath();
    ctx.roundRect(barX - 3, barY - 3, barWidth + 6, barHeight + 6, 3.5);
    ctx.fill();

    ctx.strokeStyle = isEnraged ? '#f59e0b' : '#fbbf24';
    ctx.lineWidth = isEnraged ? 1.8 : 1.4;
    ctx.stroke();

    // 3. 内凹暗槽
    ctx.fillStyle = '#04060c';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // 3a. 延迟追赶的受击白金残影条 (Delayed White-Gold Impact Lag Gauge — 凸显打击分量感)
    const lagPct = Math.max(0, Math.min(1, this.displayLagHp / this.maxHp));
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    if (lagPct > pct + 0.005) {
      const lagGrad = ctx.createLinearGradient(0, barY, 0, barY + barHeight);
      lagGrad.addColorStop(0, '#ffffff');
      lagGrad.addColorStop(0.5, '#fef08a');
      lagGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = lagGrad;
      ctx.fillRect(barX, barY, barWidth * lagPct, barHeight);
    }

    // 3b. 主血量 4 段立体圆柱流体填充
    const fillW = barWidth * pct;
    if (fillW > 0.5) {
      const bossGrad = ctx.createLinearGradient(0, barY, 0, barY + barHeight);
      if (isEnraged) {
        bossGrad.addColorStop(0, '#fef08a');
        bossGrad.addColorStop(0.3, '#f97316');
        bossGrad.addColorStop(0.75, '#dc2626');
        bossGrad.addColorStop(1, '#450a0a');
      } else {
        bossGrad.addColorStop(0, '#fca5a5');
        bossGrad.addColorStop(0.28, '#ef4444');
        bossGrad.addColorStop(0.75, '#991b1b');
        bossGrad.addColorStop(1, '#450a0a');
      }
      ctx.fillStyle = bossGrad;
      ctx.fillRect(barX, barY, fillW, barHeight);

      // 玻璃管顶部高光带
      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.fillRect(barX, barY, fillW, 2.4);
    }

    // 4. 25% / 50% / 75% 立体金属刻度分割线 & 50% 狂暴阶段菱形锁扣
    ctx.strokeStyle = 'rgba(9, 13, 22, 0.88)';
    ctx.lineWidth = 1.2;
    for (let k = 1; k <= 3; k++) {
      const tx = barX + (barWidth * k) / 4;
      ctx.beginPath();
      ctx.moveTo(tx, barY);
      ctx.lineTo(tx, barY + barHeight);
      ctx.stroke();
    }

    // 50% 中点二阶段狂暴小菱形标记
    const midX = barX + barWidth * 0.5;
    const midY = barY + barHeight / 2;
    ctx.fillStyle = isEnraged ? '#fef08a' : '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(midX, midY - 3);
    ctx.lineTo(midX + 2.5, midY);
    ctx.lineTo(midX, midY + 3);
    ctx.lineTo(midX - 2.5, midY);
    ctx.closePath();
    ctx.fill();

    // 5. 左右两端立体双翼切面红宝石端帽
    for (const side of [-1, 1]) {
      const ex = side < 0 ? barX - 5 : barX + barWidth + 5;
      const ey = barY + barHeight / 2;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ex, ey - 5.5);
      ctx.lineTo(ex + side * 6, ey);
      ctx.lineTo(ex, ey + 5.5);
      ctx.lineTo(ex - side * 4, ey);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isEnraged ? '#fde047' : '#ef4444';
      ctx.beginPath();
      ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. 顶部中央纯矢量立体黄金双角王冠徽记
    const cx = this.position.x;
    const cy = barY - 8;
    ctx.fillStyle = isEnraged ? '#fef08a' : '#fbbf24';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 2.5);
    ctx.lineTo(cx - 10, cy - 5.5);
    ctx.lineTo(cx - 4.5, cy - 1.2);
    ctx.lineTo(cx, cy - 8.5);
    ctx.lineTo(cx + 4.5, cy - 1.2);
    ctx.lineTo(cx + 10, cy - 5.5);
    ctx.lineTo(cx + 8, cy + 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 王冠中心镶嵌红宝石
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 1.8, 0, Math.PI * 2);
    ctx.fill();

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

      // 1. Distinct Emerald-Gold Friendly Halo Ring (Player immediately recognizes it's safe!)
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.65, 0, Math.PI * 2);
      ctx.stroke();

      ctx.save();
      ctx.rotate(this.velocity.angle());

      // 2. Long Emerald-Turquoise Comet Wake
      const wakeGrad = ctx.createLinearGradient(-this.radius * 4.5, 0, this.radius, 0);
      wakeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      wakeGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.65)');
      wakeGrad.addColorStop(1, 'rgba(254, 240, 138, 0.95)');
      ctx.fillStyle = wakeGrad;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 4.5, 0);
      ctx.lineTo(0, -this.radius * 1.15);
      ctx.lineTo(this.radius * 1.3, 0);
      ctx.lineTo(0, this.radius * 1.15);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3. Radial Jade-Gold Aura
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, this.radius * 2.6);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.4, '#34d399');
      glow.addColorStop(0.75, 'rgba(250, 204, 21, 0.45)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // 4. Spinning Golden-White 4-Pointed Reflected Star Core ('✦')
      ctx.rotate(this.elapsed * 16);
      ctx.fillStyle = '#fef08a';
      const sr = this.radius * 1.55;
      ctx.beginPath();
      ctx.moveTo(0, -sr);
      ctx.quadraticCurveTo(2.5, -2.5, sr, 0);
      ctx.quadraticCurveTo(2.5, 2.5, 0, sr);
      ctx.quadraticCurveTo(-2.5, 2.5, -sr, 0);
      ctx.quadraticCurveTo(-2.5, -2.5, 0, -sr);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    if (this.visualType === 'METEOR_ZONE') {
      const progress = Math.max(0, Math.min(1, 1 - this.lifetime / this.maxLifetime));
      ctx.globalCompositeOperation = 'lighter';

      // 1. Tactical Ground Hazard Ring (旋转符文锁定法阵 + 十字准星)
      ctx.save();
      ctx.rotate(this.elapsed * 2.2);
      ctx.strokeStyle = progress > 0.8 ? '#ffffff' : 'rgba(249, 115, 22, 0.9)';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Inner expanding magma charge circle
      const fillGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, this.radius * progress);
      fillGrad.addColorStop(0, 'rgba(254, 240, 138, 0.65)');
      fillGrad.addColorStop(0.65, 'rgba(239, 68, 68, 0.42)');
      fillGrad.addColorStop(1, 'rgba(220, 38, 38, 0.14)');
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * progress, 0, Math.PI * 2);
      ctx.fill();

      // 2. Falling Skyfall Meteor Boulder & Twin Plasma Wake OR Violent Tectonic Crater Eruption!
      const dropY = -210 * (1 - Math.pow(progress, 1.85));
      if (progress < 0.83) {
        // Outer wide fire wake
        const outerWake = ctx.createLinearGradient(18 * (1 - progress), dropY - 68, 0, dropY);
        outerWake.addColorStop(0, 'rgba(0, 0, 0, 0)');
        outerWake.addColorStop(0.5, 'rgba(239, 68, 68, 0.65)');
        outerWake.addColorStop(1, '#fbbf24');
        ctx.strokeStyle = outerWake;
        ctx.lineWidth = 15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(18 * (1 - progress), dropY - 68);
        ctx.lineTo(0, dropY);
        ctx.stroke();

        // Inner white-hot core streak
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(10 * (1 - progress), dropY - 38);
        ctx.lineTo(0, dropY);
        ctx.stroke();

        // Spinning Molten Meteorhead Boulder
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, dropY, 9.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Detonation Impact Dome + 8 Radiating Tectonic Lava Spikes!
        const impactT = Math.min(1, (progress - 0.83) / 0.17);
        const domeGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, this.radius * (1.05 + impactT * 0.25));
        domeGrad.addColorStop(0, '#ffffff');
        domeGrad.addColorStop(0.45, 'rgba(254, 240, 138, 0.92)');
        domeGrad.addColorStop(0.8, 'rgba(239, 68, 68, 0.75)');
        domeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = domeGrad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * (1.05 + impactT * 0.25), 0, Math.PI * 2);
        ctx.fill();

        // 8 Jagged Lava Shockwave Spikes erupting outward
        ctx.fillStyle = '#fef08a';
        for (let s = 0; s < 8; s++) {
          const sa = (s * Math.PI) / 4 + 0.15;
          const spikeLen = this.radius * (0.95 + impactT * 0.45);
          ctx.save();
          ctx.rotate(sa);
          ctx.beginPath();
          ctx.moveTo(10, -4.5 * (1 - impactT * 0.5));
          ctx.lineTo(spikeLen, 0);
          ctx.lineTo(10, 4.5 * (1 - impactT * 0.5));
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();
      return;
    }

    ctx.globalAlpha = spawnAlpha * fadeAlpha;
    ctx.rotate(this.velocity.angle());
    ctx.globalCompositeOperation = 'lighter';

    // 1. Multi-Stop High-Velocity Kinetic Ribbon Wake (流线型高动能破空尾迹)
    const wakeLen = this.visualType === 'CRESCENT' ? this.radius * 4.2 : this.radius * 3.8;
    const wakeGrad = ctx.createLinearGradient(-wakeLen, 0, this.radius * 0.5, 0);
    wakeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    wakeGrad.addColorStop(0.55, `${this.color}88`);
    wakeGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = wakeGrad;
    ctx.beginPath();
    ctx.moveTo(-wakeLen, 0);
    ctx.lineTo(-this.radius * 0.4, -this.radius * 0.95);
    ctx.lineTo(this.radius * 0.8, 0);
    ctx.lineTo(-this.radius * 0.4, this.radius * 0.95);
    ctx.closePath();
    ctx.fill();

    // 2. Outer Hellfire / Arcane Radial Corona
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, this.radius * 2.7);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.38, this.color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 2.7, 0, Math.PI * 2);
    ctx.fill();

    if (this.visualType === 'CRESCENT') {
      // Heavy 3-Layer Boss Crescent Slash Wave (立体三层重型破空月牙斩波 + 音障气浪弧)
      // Outer sonic bow-wave arc ahead of the blade
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(4, 0, this.radius * 1.65, -Math.PI * 0.42, Math.PI * 0.42);
      ctx.stroke();

      // Colored plasma crescent body
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(2, 0, this.radius * 1.55, -Math.PI * 0.54, Math.PI * 0.54, false);
      ctx.arc(-4.5, 0, this.radius * 1.28, Math.PI * 0.48, -Math.PI * 0.48, true);
      ctx.closePath();
      ctx.fill();

      // Razor-sharp white-hot leading edge
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(3, 0, this.radius * 1.42, -Math.PI * 0.48, Math.PI * 0.48, false);
      ctx.arc(-2, 0, this.radius * 1.22, Math.PI * 0.42, -Math.PI * 0.42, true);
      ctx.closePath();
      ctx.fill();
    } else if (this.visualType === 'STAR') {
      // High-Speed 3D Mechanical Sawblade / 4-Point Shuriken (高速旋转十字机械飞轮)
      ctx.rotate(this.elapsed * 14);

      // Outer spinning energy ring
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.38, 0, Math.PI * 2);
      ctx.stroke();

      const sr = this.radius * 1.68;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0, -sr);
      ctx.quadraticCurveTo(3, -3, sr, 0);
      ctx.quadraticCurveTo(3, 3, 0, sr);
      ctx.quadraticCurveTo(-3, 3, -sr, 0);
      ctx.quadraticCurveTo(-3, -3, 0, -sr);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      const innerSr = sr * 0.72;
      ctx.beginPath();
      ctx.moveTo(0, -innerSr);
      ctx.quadraticCurveTo(1.8, -1.8, innerSr, 0);
      ctx.quadraticCurveTo(1.8, 1.8, 0, innerSr);
      ctx.quadraticCurveTo(-1.8, 1.8, -innerSr, 0);
      ctx.quadraticCurveTo(-1.8, -1.8, 0, -innerSr);
      ctx.fill();
    } else if (this.visualType === 'HOMING') {
      // Homing Void-Eye Seeker Orb (双环旋转噬魂追踪魔眼法球)
      ctx.save();
      ctx.rotate(this.elapsed * 8);
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.85, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#581c87';
      ctx.beginPath();
      ctx.arc(this.radius * 0.25, 0, this.radius * 0.38, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Heavy Beveled Diamond Energy Bolt (重型棱晶能量弹)
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(this.radius * 1.45, 0);
      ctx.lineTo(0, -this.radius * 0.92);
      ctx.lineTo(-this.radius * 1.15, 0);
      ctx.lineTo(0, this.radius * 0.92);
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
