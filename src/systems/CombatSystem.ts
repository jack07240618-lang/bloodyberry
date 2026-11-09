import { SpatialHashGrid } from '../core/SpatialHashGrid';
import { Enemy, EnemyProjectile, EnemyType } from '../enemies/Enemy';
import { createEnemy } from '../enemies/EnemyRegistry';
import { Projectile, ProjectileType } from '../weapons/Projectile';
import { DropItem, DropType } from '../entities/DropItem';
import { Player } from '../entities/Player';
import { Vector2 } from '../core/Vector2';
import { ParticleSystem } from './ParticleSystem';
import { DamageTextSystem } from './DamageTextSystem';
import { MapSystem } from './MapSystem';
import { SoundSynthesizer } from '../core/SoundSynthesizer';
import { Camera } from '../core/Camera';
import { BuildEventBus, DelayedTraitBomb, SkillTag, TAG_METADATA } from './BuildSystem';
import type { Weapon } from '../weapons/Weapon';

export interface VisualLightningEffect {
  position: Vector2;
  radius: number;
  isEvolved: boolean;
  lifetime: number;
  maxLifetime: number;
}

export class CombatSystem {
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public enemyProjectiles: EnemyProjectile[] = [];
  public dropItems: DropItem[] = [];
  public bossChestRolledThisRoom = false;
  public bossChestDroppedThisRoom = false;

  public spatialGrid: SpatialHashGrid<Enemy>;
  public freezeTimer = 0;
  public buildEventBus: BuildEventBus = new BuildEventBus();
  public delayedBombs: DelayedTraitBomb[] = [];

  private visualLightnings: VisualLightningEffect[] = [];
  private screenNukeFlashTimer = 0;
  private activeUltimateHeroId = 'antonio';
  private currentPlayerRef: Player | null = null;
  private globalAttackCounter = 0;
  private activeHitStopCallback?: (duration: number) => void;
  public bossSlainWaveTimer = 0;
  public bossSlainPosition: Vector2 = new Vector2();

  constructor(
    public particleSystem: ParticleSystem,
    public damageTextSystem: DamageTextSystem,
    public mapSystem: MapSystem,
    public sound: SoundSynthesizer,
    public camera: Camera
  ) {
    this.spatialGrid = new SpatialHashGrid<Enemy>(96);
  }

  /**
   * 检测当前房间是否存在存活敌人（在没有敌人时不自动发起攻击）
   */
  public hasActiveEnemies(): boolean {
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].active) return true;
    }
    return false;
  }

  /**
   * 武器攻击发射前通知 (OnShoot Hook 前置处理：记录第4击奇点状态 & 触发近战剑气联动)
   */
  public notifyWeaponAttackStart(weapon: Weapon, player: Player): void {
    this.currentPlayerRef = player;
    this.globalAttackCounter++;

    const singularityRank = player.getPassiveLevel('clover');
    weapon.currentAttackIsFourthStroke = singularityRank > 0 && this.globalAttackCounter % 4 === 0;

    // 【标签联动：幻影剑气谐振 (duplicator)】带有 [近战] 标签的武器攻击时，额外发射半圆形穿透剑气波 [投射物]
    const bladeProjRank = player.getPassiveLevel('duplicator');
    if (bladeProjRank > 0 && weapon.hasTag(SkillTag.MELEE)) {
      const target = this.getNearestEnemies(player.position, 480, 1)[0];
      const dir = target
        ? target.position.clone().sub(player.position).normalize()
        : new Vector2(player.facingDirection, 0);

      const waveProj = new Projectile(
        ProjectileType.WHIP_SLASH,
        weapon.id,
        player.position.x + dir.x * 16,
        player.position.y + dir.y * 16,
        62 + bladeProjRank * 7,
        Math.round(weapon.damage * player.damageMult * (0.25 + bladeProjRank * 0.07)),
        1 + Math.floor(bladeProjRank / 2),
        0.48
      );
      waveProj.rotation = dir.angle();
      waveProj.velocity.copy(dir).multiplyScalar(310);
      waveProj.color = '#f43f5e';
      waveProj.glowColor = '#fbbf24';
      weapon.tags.forEach(t => waveProj.tags.add(t));
      waveProj.tags.add(SkillTag.PROJECTILE);
      this.addProjectile(waveProj);
    }
  }

  /**
   * 投射物入场与装饰器改造 (Decorator Pattern for Example A & Example C)
   */
  public addProjectile(proj: Projectile): void {
    const player = this.currentPlayerRef;
    if (player && !proj.isDecoratedClone) {
      const srcWeapon = player.getWeapon(proj.weaponId);
      if (srcWeapon) {
        srcWeapon.tags.forEach(t => proj.tags.add(t));
      }

      // 1. 【示例 C（风险与机制转化）】：每第4次攻击转化为巨型奇点穿透弹并吸附周围敌人
      const singularityRank = player.getPassiveLevel('clover');
      if (singularityRank > 0 && srcWeapon?.currentAttackIsFourthStroke) {
        proj.isSingularityStrike = true;
        proj.isCrit = true;
        proj.pierce = 999;
        proj.radius = Math.round(proj.radius * 1.32);
        proj.damage = Math.round(proj.damage * (1.05 + singularityRank * 0.05));
        proj.color = '#e879f9';
        proj.glowColor = '#a855f7';
        proj.tags.add(SkillTag.SINGULARITY);
        proj.tags.add(SkillTag.OVERLOAD);
      }

      // 2. 【示例 A（改变形态）】：普通攻击/[投射物] 变为散射3发，飞行距离缩短，命中房间墙壁反弹
      const splitRank = player.getPassiveLevel('spinach');
      if (splitRank > 0 && proj.tags.has(SkillTag.PROJECTILE)) {
        proj.wallBounces = Math.max(proj.wallBounces, Math.ceil(splitRank / 2));

        const isFlyingProjectile =
          proj.type !== ProjectileType.ORBITING_ORB &&
          proj.type !== ProjectileType.GARLIC_AURA &&
          proj.type !== ProjectileType.GROUND_FIRE &&
          proj.type !== ProjectileType.WHIP_SLASH &&
          proj.velocity.lengthSq() > 1;

        if (isFlyingProjectile) {
          const durationFactor = 0.68; // 飞行距离缩短 ~32%
          proj.lifetime *= durationFactor;
          proj.maxLifetime *= durationFactor;

          const origDamage = proj.damage;
          proj.damage = Math.max(1, Math.round(origDamage * 0.6));

          const baseSpeed = proj.velocity.length();
          const baseAngle = proj.velocity.angle();
          const sideAngles = [-0.26, 0.26];

          for (const offsetAng of sideAngles) {
            const ang = baseAngle + offsetAng;
            const clone = new Projectile(
              proj.type,
              proj.weaponId,
              proj.position.x,
              proj.position.y,
              Math.max(5, Math.round(proj.radius * 0.88)),
              Math.max(1, Math.round(origDamage * (0.18 + splitRank * 0.025))),
              proj.pierce,
              proj.lifetime
            );
            clone.isDecoratedClone = true;
            clone.isSingularityStrike = proj.isSingularityStrike;
            clone.isCrit = proj.isCrit;
            clone.wallBounces = Math.ceil(splitRank / 2);
            clone.color = proj.color;
            clone.glowColor = '#38bdf8';
            clone.velocity.set(Math.cos(ang) * baseSpeed, Math.sin(ang) * baseSpeed);
            proj.tags.forEach(t => clone.tags.add(t));
            this.projectiles.push(clone);
          }
        }
      }
    }

    this.projectiles.push(proj);
  }

  public spawnDelayedTraitBomb(bomb: DelayedTraitBomb): void {
    this.delayedBombs.push(bomb);
  }

  public addEnemy(enemy: Enemy): void {
    this.enemies.push(enemy);
  }

  public addEnemyProjectile(proj: EnemyProjectile): void {
    this.enemyProjectiles.push(proj);
  }

  public getNearestEnemies(origin: Vector2, maxRadius: number, count = 1): Enemy[] {
    const candidates = this.spatialGrid.queryRadius(origin, maxRadius);
    candidates.sort((a, b) => origin.distanceToSq(a.position) - origin.distanceToSq(b.position));
    return candidates.slice(0, count);
  }

  public dealAreaDamage(origin: Vector2, radius: number, damage: number, weaponId: string): void {
    const enemies = this.spatialGrid.queryRadius(origin, radius);
    for (const enemy of enemies) {
      if (!enemy.active) continue;

      // Apply Elemental Status & Check Synergy Reactions
      if (weaponId === 'lightning_ring') {
        enemy.shockTimer = 4.0;
        if (enemy.burnTimer > 0) {
          enemy.burnTimer = 0;
          this.triggerElementalOverload(enemy.position, damage * 1.5);
        }
      }

      const isDead = enemy.takeDamage(damage);
      this.damageTextSystem.addDamage(enemy.position.x, enemy.position.y, damage, false);
      this.particleSystem.emitHit(enemy.position.x, enemy.position.y, '#eab308', 3);

      const knockDir = enemy.position.clone().sub(origin);
      enemy.applyKnockback(knockDir, 160);

      if (isDead) {
        this.handleEnemyDeath(enemy);
      }
    }
  }

  public triggerElementalOverload(origin: Vector2, explosionDamage: number): void {
    this.damageTextSystem.addStatusText(origin.x, origin.y, '⚡ OVERLOAD! ⚡', '#f97316', 15);
    this.particleSystem.emitHit(origin.x, origin.y, '#f97316', 12);
    this.camera.triggerShake(5);
    this.sound.playExplosion(0.18, 700);

    const nearby = this.spatialGrid.queryRadius(origin, 75);
    for (const e of nearby) {
      if (!e.active) continue;
      const killed = e.takeDamage(Math.round(explosionDamage));
      this.damageTextSystem.addDamage(e.position.x, e.position.y, Math.round(explosionDamage), true);
      if (killed) {
        this.handleEnemyDeath(e);
      }
    }
  }

  public triggerDashShockwave(player: Player): void {
    this.currentPlayerRef = player;
    const origin = player.position;
    const dashDmg = Math.round(28 * player.damageMult);
    this.particleSystem.emitHit(origin.x, origin.y, '#38bdf8', 10);

    // 触发 OnDodge 事件监听节点（示例B：冲刺原地留下继承主武器属性标签的延迟炸弹）
    this.buildEventBus.emitOnDodge({
      player,
      startPosition: player.lastDashStartPosition,
      dashDirection: player.dashDirection,
      combatSystem: this
    });

    const hits = this.spatialGrid.queryRadius(origin, 72);
    for (const enemy of hits) {
      if (!enemy.active) continue;
      const killed = enemy.takeDamage(dashDmg);
      this.damageTextSystem.addDamage(enemy.position.x, enemy.position.y, dashDmg, true);
      const pushDir = enemy.position.clone().sub(origin);
      enemy.applyKnockback(pushDir, 320);
      if (killed) {
        this.handleEnemyDeath(enemy);
      }
    }
  }

  public spawnLightningVisual(pos: Vector2, radius: number, isEvolved: boolean): void {
    this.visualLightnings.push({
      position: pos.clone(),
      radius,
      isEvolved,
      lifetime: 0.22,
      maxLifetime: 0.22
    });
    this.camera.triggerShake(isEvolved ? 8 : 4);
  }

  public triggerCharacterUltimate(player: Player): void {
    this.screenNukeFlashTimer = 0.65;
    this.activeUltimateHeroId = player.characterId;
    this.camera.triggerShake(16);
    this.sound.playExplosion(0.75, 1100);

    // Scaled numeric Ultimate Damage (Strong enough to crush waves & chunk Bosses without instakilling!)
    const baseUltDamage = Math.round((180 + player.level * 22) * player.damageMult);

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const dist = enemy.position.distanceTo(player.position);
      if (dist > 650) continue; // Screen-wide radius around player

      // Apply character-specific elemental effects
      if (player.characterId === 'arca') {
        enemy.burnTimer = 6.0;
      } else if (player.characterId === 'pasqualina') {
        enemy.shockTimer = 6.0;
      } else if (player.characterId === 'antonio' || player.characterId === 'gennaro') {
        enemy.bleedTimer = 6.0;
      }

      const dmg = enemy.isBoss ? Math.round(baseUltDamage * 1.15) : baseUltDamage;
      const isDead = enemy.takeDamage(dmg);
      this.damageTextSystem.addDamage(enemy.position.x, enemy.position.y, dmg, true);
      this.particleSystem.emitHit(enemy.position.x, enemy.position.y, '#fbbf24', 5);

      const kbDir = enemy.position.clone().sub(player.position);
      enemy.applyKnockback(kbDir, 280);

      if (isDead) {
        player.kills++;
        this.handleEnemyDeath(enemy, true);
      }
    }

    // Character-Specific Secondary Ultimate Projectiles & Mechanics!
    switch (player.characterId) {
      case 'antonio': {
        // CRIMSON CROSS: Heals 25% Max HP + launches 4 giant Heaven Swords outward
        const healAmt = Math.round(player.maxHp * 0.25);
        player.heal(healAmt);
        this.damageTextSystem.addHeal(player.position.x, player.position.y, healAmt);
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI * 2) / 8;
          const p = new Projectile(
            ProjectileType.BOOMERANG,
            'cross',
            player.position.x,
            player.position.y,
            20,
            Math.round(baseUltDamage * 0.6),
            999,
            2.2
          );
          p.velocity.set(Math.cos(ang) * 460, Math.sin(ang) * 460);
          p.color = '#ef4444';
          p.glowColor = '#fbbf24';
          this.addProjectile(p);
        }
        break;
      }

      case 'imelda': {
        // STARFALL PENTAGRAM: Freezes all enemies for 3.5s + fires 20 arcane star bolts
        this.freezeEnemies(3.5);
        for (let i = 0; i < 20; i++) {
          const ang = (i * Math.PI * 2) / 20;
          const p = new Projectile(
            ProjectileType.DIRECT_BOLT,
            'magic_wand',
            player.position.x,
            player.position.y,
            10,
            Math.round(baseUltDamage * 0.5),
            4,
            1.8
          );
          p.velocity.set(Math.cos(ang) * 520, Math.sin(ang) * 520);
          p.color = '#c084fc';
          p.glowColor = '#38bdf8';
          this.addProjectile(p);
        }
        break;
      }

      case 'gennaro': {
        // PHANTOM BLADESTORM: Resets Dash cooldown + fires 32 piercing shadow daggers in a spiral
        player.dashCooldown = 0;
        for (let i = 0; i < 32; i++) {
          const ang = (i * Math.PI * 2) / 32;
          const p = new Projectile(
            ProjectileType.PIERCING_DAGGER,
            'knife',
            player.position.x,
            player.position.y,
            9,
            Math.round(baseUltDamage * 0.55),
            8,
            1.6
          );
          p.velocity.set(Math.cos(ang) * 620, Math.sin(ang) * 620);
          p.color = '#34d399';
          p.glowColor = '#10b981';
          this.addProjectile(p);
        }
        break;
      }

      case 'arca': {
        // HELLFIRE CATACLYSM: Spawns 8 lingering magma pools + 12 giant Hellfire meteors
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI * 2) / 8;
          const dist = 110 + (i % 2) * 70;
          const pool = new Projectile(
            ProjectileType.GROUND_FIRE,
            'holy_water',
            player.position.x + Math.cos(ang) * dist,
            player.position.y + Math.sin(ang) * dist,
            62,
            Math.round(baseUltDamage * 0.35),
            9999,
            4.0
          );
          pool.isEvolved = true;
          pool.color = '#f97316';
          pool.glowColor = '#ef4444';
          this.addProjectile(pool);
        }
        for (let i = 0; i < 12; i++) {
          const ang = (i * Math.PI * 2) / 12;
          const fb = new Projectile(
            ProjectileType.FIREBALL,
            'fire_wand',
            player.position.x,
            player.position.y,
            18,
            Math.round(baseUltDamage * 0.7),
            999,
            2.0
          );
          fb.velocity.set(Math.cos(ang) * 420, Math.sin(ang) * 420);
          fb.color = '#f97316';
          fb.glowColor = '#dc2626';
          this.addProjectile(fb);
        }
        break;
      }

      case 'pasqualina': {
        // PRISMATIC THUNDER: Strikes 12 sky thunderbolts + 12 bouncing Runetracer lasers
        for (let i = 0; i < 12; i++) {
          const ang = (i * Math.PI * 2) / 12;
          const lPos = new Vector2(
            player.position.x + Math.cos(ang) * (120 + Math.random() * 180),
            player.position.y + Math.sin(ang) * (120 + Math.random() * 180)
          );
          this.spawnLightningVisual(lPos, 55, true);
        }
        for (let i = 0; i < 12; i++) {
          const ang = (i * Math.PI * 2) / 12;
          const rt = new Projectile(
            ProjectileType.RUNETRACER_LASER,
            'runetracer',
            player.position.x,
            player.position.y,
            12,
            Math.round(baseUltDamage * 0.6),
            999,
            2.6
          );
          rt.velocity.set(Math.cos(ang) * 500, Math.sin(ang) * 500);
          this.addProjectile(rt);
        }
        break;
      }

      case 'mortaccio': {
        // DEATH SPIRAL HARVEST: Hurls 16 giant Grim Reaper Scythes outward + heals 20 HP
        player.heal(20);
        this.damageTextSystem.addHeal(player.position.x, player.position.y, 20);
        for (let i = 0; i < 16; i++) {
          const ang = (i * Math.PI * 2) / 16;
          const sc = new Projectile(
            ProjectileType.ARCBALLISTIC_AXE,
            'axe',
            player.position.x,
            player.position.y,
            26,
            Math.round(baseUltDamage * 0.75),
            999,
            2.2
          );
          sc.isEvolved = true;
          sc.velocity.set(Math.cos(ang) * 380, Math.sin(ang) * 380 - 180);
          sc.color = '#a855f7';
          sc.glowColor = '#c084fc';
          this.addProjectile(sc);
        }
        break;
      }
    }

    // Automatically vacuum all gems across the arena when Ultimate is unleashed!
    this.vacuumAllGems();
  }

  public triggerScreenNuke(isEvolved = false): void {
    this.screenNukeFlashTimer = 0.55;
    this.camera.triggerShake(16);
    this.sound.playExplosion(0.75, 1100);

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const dmg = enemy.isBoss ? 450 : 650;
      const isDead = enemy.takeDamage(dmg);
      this.damageTextSystem.addDamage(enemy.position.x, enemy.position.y, dmg, true);
      if (isDead) {
        this.handleEnemyDeath(enemy, true);
      }
    }

    this.vacuumAllGems();
  }

  public vacuumAllGems(): void {
    for (const drop of this.dropItems) {
      if (drop.active && drop.type !== DropType.BOSS_CHEST) {
        drop.isMagnetized = true;
      }
    }
  }

  public freezeEnemies(duration = 5.0): void {
    this.freezeTimer = duration;
  }

  public update(dt: number, player: Player, onLevelUp: () => void, onBossChestOpen: () => void, onHitStop?: (duration: number) => void): void {
    this.currentPlayerRef = player;
    this.activeHitStopCallback = onHitStop;

    if (this.bossSlainWaveTimer > 0) {
      this.bossSlainWaveTimer = Math.max(0, this.bossSlainWaveTimer - dt);
    }

    // Screen nuke white flash decay
    if (this.screenNukeFlashTimer > 0) {
      this.screenNukeFlashTimer -= dt;
    }

    // Freeze timer decay
    const isFrozen = this.freezeTimer > 0;
    if (isFrozen) {
      this.freezeTimer -= dt;
    }

    // Update Lightning visual effects
    for (let i = this.visualLightnings.length - 1; i >= 0; i--) {
      this.visualLightnings[i].lifetime -= dt;
      if (this.visualLightnings[i].lifetime <= 0) {
        this.visualLightnings.splice(i, 1);
      }
    }

    // 1. Rebuild Spatial Hash Grid
    this.spatialGrid.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].active) {
        this.spatialGrid.insert(this.enemies[i]);
      }
    }

    // 1b. 更新并引爆【示例 B：冲刺延迟引爆炸弹（继承主武器全部标签）】
    for (let i = this.delayedBombs.length - 1; i >= 0; i--) {
      const bomb = this.delayedBombs[i];
      bomb.timer -= dt;
      if (bomb.timer <= 0) {
        this.detonateTraitBomb(bomb, player);
        this.delayedBombs.splice(i, 1);
      }
    }

    // 2. Update Weapons
    for (const weapon of player.weapons) {
      weapon.update(dt, player, this, this.sound);
    }

    // 3. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);
      if (!proj.active) {
        this.projectiles.splice(i, 1);
      }
    }

    // 4. Update Enemy Projectiles (including Sword Qi Deflection & Friendly Counter-Hits!)
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      ep.update(dt, player);
      if (!ep.active) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // 4a. Check if any active Sword Qi (WHIP_SLASH) deflects this hostile projectile
      if (!ep.isReflected && ep.visualType !== 'METEOR_ZONE') {
        for (let j = 0; j < this.projectiles.length; j++) {
          const proj = this.projectiles[j];
          if (!proj.active || proj.type !== ProjectileType.WHIP_SLASH) continue;

          const distToSlash = ep.position.distanceTo(proj.position);
          if (distToSlash <= proj.radius * 1.08 + ep.radius) {
            // Aim reflected projectile directly at the nearest active enemy (or along the Sword Qi cleave angle)
            const nearestEnemy = this.getNearestEnemies(ep.position, 720, 1)[0];
            const reflectDir = nearestEnemy
              ? nearestEnemy.position.clone().sub(ep.position).normalize()
              : Vector2.fromAngle(proj.rotation);

            const reflectedDamage = Math.max(Math.round(ep.damage * 3.2), Math.round(proj.damage * 1.15));
            ep.reflect(reflectDir, reflectedDamage);
            this.sound.playParry();
            this.particleSystem.emitSlashImpact(ep.position.x, ep.position.y, reflectDir.angle(), '#34d399', true);
            this.camera.triggerShake(2.5);
            break;
          }
        }
      }

      // 4b. If reflected (Friendly Emerald-Jade & Gold bullet), check collision against Enemies!
      if (ep.isReflected) {
        const candidateEnemies = this.spatialGrid.queryRadius(ep.position, ep.radius + 36);
        let consumedReflected = false;
        for (const enemy of candidateEnemies) {
          if (!enemy.active || enemy.isSpawning() || ep.hitEnemyIds.has(enemy.id)) continue;
          if (ep.position.distanceTo(enemy.position) <= ep.radius + enemy.radius) {
            ep.hitEnemyIds.add(enemy.id);
            const isDead = enemy.takeDamage(ep.damage);
            this.damageTextSystem.addDamage(enemy.position.x, enemy.position.y, ep.damage, true);
            this.particleSystem.emitSlashImpact(
              enemy.position.x,
              enemy.position.y,
              ep.velocity.angle(),
              '#34d399',
              true
            );
            this.sound.playHit();
            enemy.applyKnockback(ep.velocity.clone().normalize(), 210);

            if (isDead) {
              player.kills++;
              player.reduceUltimateCooldown(0.35);
              this.handleEnemyDeath(enemy);
            }

            ep.active = false;
            this.enemyProjectiles.splice(i, 1);
            consumedReflected = true;
            break;
          }
        }
        if (consumedReflected) continue;
      }

      // 4c. Hostile Enemy Projectile vs Player collision (respecting delayed meteor detonation window)
      if (ep.canDamagePlayer() && ep.position.distanceTo(player.position) <= ep.radius + player.radius) {
        const dmgTaken = player.takeDamage(ep.damage);
        if (dmgTaken > 0) {
          this.damageTextSystem.addPlayerDamage(player.position.x, player.position.y, dmgTaken);
          this.camera.triggerShake(5);
          this.sound.playPlayerHurt();
          this.buildEventBus.emitOnDamaged({
            player,
            damageTaken: dmgTaken,
            attackerPosition: ep.position,
            combatSystem: this
          });
        }
        if (ep.visualType === 'METEOR_ZONE') {
          ep.hasDetonated = true;
        } else {
          ep.active = false;
          this.enemyProjectiles.splice(i, 1);
        }
      }
    }

    // 5. Update Enemies & Boids Separation
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.active) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (!isFrozen) {
        // Fast local flocking separation force from nearby neighbors
        const neighbors = this.spatialGrid.queryRadius(enemy.position, enemy.radius * 2.2);
        const sepForce = new Vector2();
        for (const other of neighbors) {
          if (other !== enemy && other.active) {
            const diff = enemy.position.clone().sub(other.position);
            const dist = diff.length();
            if (dist > 0.001) {
              diff.normalize().divideScalar(dist);
              sepForce.add(diff);
            }
          }
        }

        enemy.updateEnemy(dt, player, sepForce, (proj) => this.addEnemyProjectile(proj));
      }

      // Enemy vs Player collision (enemies still materializing in their Soul Knight summoning portal do not deal contact damage)
      if (!isFrozen && enemy.canStrikePlayer(player)) {
        enemy.attackHasHit = true;
        const dmgTaken = player.takeDamage(enemy.attackDamage);
        if (dmgTaken > 0) {
          this.damageTextSystem.addPlayerDamage(player.position.x, player.position.y, dmgTaken);
          this.camera.triggerShake(6);
          this.sound.playPlayerHurt();
          this.buildEventBus.emitOnDamaged({
            player,
            damageTaken: dmgTaken,
            attackerPosition: enemy.position,
            combatSystem: this
          });

          // Push enemy back slightly on player impact
          const bounceDir = enemy.position.clone().sub(player.position);
          enemy.applyKnockback(bounceDir, 180);
        }
      }
    }

    // 6. Projectile vs Enemy & Destructibles Collision Resolution
    this.resolveProjectileCollisions(player);

    // 7. Update Drop Items & Collection
    for (let i = this.dropItems.length - 1; i >= 0; i--) {
      const drop = this.dropItems[i];
      drop.update(dt);

      const collected = drop.attractTo(player, dt);
      if (collected) {
        this.handleItemPickup(drop, player, onLevelUp, onBossChestOpen);
        this.dropItems.splice(i, 1);
      }
    }

    // 8. Check Interactive Gothic Boss Shrines (High-Rarity Boss Relics)
    for (let i = this.mapSystem.shrines.length - 1; i >= 0; i--) {
      const s = this.mapSystem.shrines[i];
      if (!s.active) continue;
      if (Math.hypot(player.position.x - s.x, player.position.y - s.y) <= s.radius + player.radius) {
        s.active = false;
        this.sound.playShrineInteract('RELIC');
        this.particleSystem.emitLevelUpFanfare(s.x, s.y);

        if (s.type === 'FRENZY') {
          player.damageMult += 0.22;
          player.critChance += 0.08;
          player.areaMult += 0.10;
        } else if (s.type === 'GREED') {
          player.damageMult += 0.15;
          player.gold += 350;
          player.xpMult += 0.20;
        } else {
          player.damageMult += 0.15;
          player.armor += 1;
          player.heal(80);
          player.reduceUltimateCooldown(999);
        }
      }
    }

    // 9. Check Single Unlabeled Mystery Door Entry
    if (this.mapSystem.mysteryDoor && this.mapSystem.mysteryDoor.active) {
      const door = this.mapSystem.mysteryDoor;
      if (Math.hypot(player.position.x - door.x, player.position.y - door.y) <= door.radius + player.radius) {
        const roomType = this.mapSystem.enterMysteryDoor();
        if (roomType) {
          this.handleEnterMysteryRoom(roomType, player, onLevelUp, onBossChestOpen);
        }
      }
    }
  }

  private handleEnterMysteryRoom(
    roomType: 'NORMAL' | 'ELITE' | 'BLACKSMITH' | 'EVENT',
    player: Player,
    onLevelUp: () => void,
    onBossChestOpen: () => void
  ): void {
    this.sound.playPortalTransition();
    this.particleSystem.emitLevelUpFanfare(player.position.x, player.position.y);
    this.camera.triggerShake(8);

    // Clear existing non-boss stragglers for a clean room transition feel
    for (const e of this.enemies) {
      if (!e.isBoss) e.active = false;
    }

    switch (roomType) {
      case 'NORMAL': {
        player.heal(35);
        this.damageTextSystem.addStatusText(
          player.position.x,
          player.position.y - 20,
          '🚪 ENTERED: NORMAL ROOM (+35 HP & FRESH WAVE)',
          '#38bdf8',
          16
        );
        // Spawn a standard wave ring
        for (let i = 0; i < 14; i++) {
          const ang = (i * Math.PI * 2) / 14;
          const ex = player.position.x + Math.cos(ang) * 360;
          const ey = player.position.y + Math.sin(ang) * 360;
          this.addEnemy(createEnemy(EnemyType.WALKER, ex, ey, 1.2));
        }
        break;
      }

      case 'ELITE': {
        player.damageMult += 0.30;
        this.damageTextSystem.addStatusText(
          player.position.x,
          player.position.y - 20,
          '🚪 ENTERED: ELITE ROOM (+30% DMG & ELITE AMBUSH!)',
          '#ef4444',
          16
        );
        // Spawn 3 high-reward Elite Minotaurs/Golems dropping chests & red gems!
        for (let i = 0; i < 3; i++) {
          const ang = (i * Math.PI * 2) / 3;
          const ex = player.position.x + Math.cos(ang) * 300;
          const ey = player.position.y + Math.sin(ang) * 300;
          const elite = createEnemy(i % 2 === 0 ? EnemyType.MINOTAUR : EnemyType.TANK, ex, ey, 1.4);
          elite.xpValue = 35;
          this.addEnemy(elite);
        }
        break;
      }

      case 'BLACKSMITH': {
        // Forges all equipped weapons (+1 level to up to 2 weapons or evolves a ready weapon!) + +50% weapon damage
        let forgedCount = 0;
        for (const w of player.weapons) {
          if (w.canEvolve(player)) {
            w.evolve();
            forgedCount++;
            break;
          } else if (w.level < w.maxLevel && forgedCount < 2) {
            w.levelUp();
            forgedCount++;
          }
        }
        player.damageMult += 0.50;
        this.damageTextSystem.addStatusText(
          player.position.x,
          player.position.y - 20,
          '⚒️ ENTERED: BLACKSMITH ROOM (WEAPONS FORGED & +50% DMG!)',
          '#fbbf24',
          17
        );
        break;
      }

      case 'EVENT': {
        // Mystery Encounter Room: Full heal, +500 Gold, +2 Free Level-Ups & Ultimate Ready!
        player.heal(999);
        player.gold += 500;
        player.critChance += 0.15;
        player.reduceUltimateCooldown(999);
        this.damageTextSystem.addStatusText(
          player.position.x,
          player.position.y - 20,
          '✨ ENTERED: MYSTERY EVENT ROOM (+500 GOLD, +15% CRIT & TREASURE!)',
          '#c084fc',
          17
        );
        onBossChestOpen();
        break;
      }
    }
  }

  private resolveProjectileCollisions(player: Player): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;

      // Query nearby enemies
      const hits = this.spatialGrid.queryRadius(proj.position, proj.radius);
      for (const enemy of hits) {
        if (!enemy.active) continue;
        if (proj.hitEnemies.has(enemy.id)) continue;

        // Apply hit
        proj.hitEnemies.add(enemy.id);
        // 示例 C：若拥有“湮灭第四律令(clover)”，取消随机暴击，仅由第4次攻击奇点触发必定暴击/穿透！
        const hasSingularityRelic = player.getPassiveLevel('clover') > 0;
        const isCrit = proj.isSingularityStrike || (!hasSingularityRelic && (proj.isCrit || Math.random() < player.critChance));
        let totalDamage = Math.round(proj.damage * (isCrit ? 1.85 : 1.0));

        // --- ELEMENTAL & TAG SYNERGY REACTIONS ---
        const wid = proj.weaponId;
        const isFireWep = wid === 'fire_wand' || wid === 'holy_water' || proj.tags.has(SkillTag.FIRE);
        const isHeavyWep = wid === 'axe' || wid === 'cross' || proj.tags.has(SkillTag.OVERLOAD);
        const isBleedWep = wid === 'whip' || wid === 'knife' || proj.tags.has(SkillTag.MELEE);
        const isGarlicWep = wid === 'garlic';

        if (isFireWep) {
          enemy.burnTimer = 4.0;
          if (enemy.shockTimer > 0) {
            enemy.shockTimer = 0;
            this.triggerElementalOverload(enemy.position, totalDamage * 0.8);
          }
        } else if (isBleedWep) {
          enemy.bleedTimer = 4.0;
        } else if (isGarlicWep && enemy.bleedTimer > 0) {
          // Blood + Garlic = Soul Leach (heals 1 HP on proc)
          enemy.bleedTimer = 0;
          player.heal(1);
        }

        // Frozen heavy-hit synergy is limited to a 50% bonus.
        if (this.freezeTimer > 0 && isHeavyWep) {
          totalDamage = Math.round(totalDamage * 1.5);
        }

        const isDead = enemy.takeDamage(totalDamage);
        this.damageTextSystem.addDamage(enemy.position.x, enemy.position.y, totalDamage, isCrit);
        const impactAngle =
          proj.type === ProjectileType.WHIP_SLASH
            ? proj.rotation
            : proj.velocity.lengthSq() > 1
            ? proj.velocity.angle()
            : enemy.position.clone().sub(proj.position).angle();

        if (proj.type === ProjectileType.WHIP_SLASH) {
          this.particleSystem.emitSlashImpact(
            enemy.position.x,
            enemy.position.y,
            impactAngle,
            proj.glowColor || proj.color,
            isCrit || enemy.isBoss
          );
          this.camera.triggerShake(enemy.isBoss ? (isCrit ? 6.5 : 3.6) : isCrit ? 5.5 : 2.2);
        } else if (enemy.isBoss) {
          // 投射物击中 Boss 时触发定向冲击火星与削韧微震
          this.particleSystem.emitSlashImpact(
            enemy.position.x,
            enemy.position.y,
            impactAngle,
            proj.glowColor || proj.color,
            isCrit
          );
          this.particleSystem.emitHit(enemy.position.x, enemy.position.y, '#fef08a', isCrit ? 8 : 5);
          this.camera.triggerShake(isCrit ? 5.5 : 2.8);
        } else {
          this.particleSystem.emitHit(enemy.position.x, enemy.position.y, proj.color, 4);
        }
        this.sound.playHit();

        // 触发事件总线 OnHit 监听节点（处理投射物炎爆、第4击奇点聚怪、电弧传导、近战吸血等）
        this.buildEventBus.emitOnHit({
          player,
          projectile: proj,
          enemy,
          damage: totalDamage,
          isFourthStroke: proj.isSingularityStrike,
          combatSystem: this
        });

        // Track weapon statistics
        const srcWeapon = player.getWeapon(proj.weaponId);
        if (srcWeapon) {
          srcWeapon.totalDamageDealt += totalDamage;
        }

        // Knockback (若为第4击奇点则向中心吸附，否则向外击退)
        if (!proj.isSingularityStrike) {
          const kbDir = enemy.position.clone().sub(proj.position);
          enemy.applyKnockback(kbDir, 200);
        }

        if (isCrit) {
          this.camera.triggerShake(5);
        }

        if (isDead) {
          if (srcWeapon) srcWeapon.totalKills++;
          player.kills++;
          player.reduceUltimateCooldown(0.35); // Every kill speeds up Ultimate charge!
          this.handleEnemyDeath(enemy);
        }

        proj.pierce--;
        if (
          proj.pierce <= 0 &&
          proj.type !== ProjectileType.GARLIC_AURA &&
          proj.type !== ProjectileType.GROUND_FIRE &&
          proj.type !== ProjectileType.ORBITING_ORB
        ) {
          proj.active = false;
          break;
        }
      }

      // Check Destructibles vs Projectiles
      for (const d of this.mapSystem.destructibles) {
        if (d.active && d.position.distanceTo(proj.position) <= d.radius + proj.radius) {
          const broken = d.takeDamage(1);
          if (broken) {
            this.sound.playHit();
            this.particleSystem.emitHit(d.position.x, d.position.y, '#f97316', 8);
            const dropType = d.getRandomDrop();
            this.dropItems.push(new DropItem(dropType, d.position.x, d.position.y));
          }
        }
      }
    }
  }

  /**
   * 【示例 B（跨机制联动）】：引爆冲刺留下的延迟炸弹，并根据继承的主武器属性标签触发对应机制爆发！
   */
  private detonateTraitBomb(bomb: DelayedTraitBomb, player: Player): void {
    const pos = bomb.position;
    const tags = bomb.inheritedTags;
    const tagLabels = Array.from(tags)
      .map(t => TAG_METADATA[t]?.label || `[${t}]`)
      .join('');

    this.sound.playExplosion(0.35, 650);
    this.camera.triggerShake(7);
    this.particleSystem.emitHit(pos.x, pos.y, '#fb923c', 16);

    // 1. 基础范围爆炸伤害 + 触发标签 OnHit 联动
    const victims = this.spatialGrid.queryRadius(pos, bomb.radius);
    const dummyProj = new Projectile(
      ProjectileType.FIREBALL,
      bomb.sourceWeaponId,
      pos.x,
      pos.y,
      bomb.radius,
      bomb.damage,
      999,
      0.1
    );
    dummyProj.isDecoratedClone = true;
    tags.forEach(t => dummyProj.tags.add(t));

    for (const enemy of victims) {
      if (!enemy.active) continue;
      if (tags.has(SkillTag.FIRE)) enemy.burnTimer = 4.5;
      if (tags.has(SkillTag.CHAIN)) enemy.shockTimer = 4.5;
      if (tags.has(SkillTag.MELEE)) enemy.bleedTimer = 4.5;

      const killed = enemy.takeDamage(bomb.damage);
      this.damageTextSystem.addDamage(enemy.position.x, enemy.position.y, bomb.damage, true);

      this.buildEventBus.emitOnHit({
        player,
        projectile: dummyProj,
        enemy,
        damage: bomb.damage,
        isFourthStroke: tags.has(SkillTag.SINGULARITY),
        combatSystem: this
      });

      if (killed) {
        player.kills++;
        this.handleEnemyDeath(enemy);
      }
    }

    // 2. 若继承了主武器的 [火焰] 标签 -> 在爆炸中心留下持续燃烧的熔岩火海
    if (tags.has(SkillTag.FIRE)) {
      const firePool = new Projectile(
        ProjectileType.GROUND_FIRE,
        bomb.sourceWeaponId,
        pos.x,
        pos.y,
        bomb.radius * 0.72,
        Math.round(bomb.damage * 0.2),
        9999,
        2.5
      );
      firePool.isDecoratedClone = true;
      firePool.color = '#f97316';
      tags.forEach(t => firePool.tags.add(t));
      this.projectiles.push(firePool);
    }

    // 3. 若继承了主武器的 [连锁] 标签 -> 降下连锁雷霆轰击
    if (tags.has(SkillTag.CHAIN)) {
      this.spawnLightningVisual(pos, bomb.radius * 0.8, true);
    }

    // 4. 若继承了主武器的 [投射物] 标签 -> 向四周环状迸发 4 枚继承全部标签的子弹
    if (tags.has(SkillTag.PROJECTILE)) {
      const count = 4;
      for (let i = 0; i < count; i++) {
        const ang = (i * Math.PI * 2) / count;
        const shrapnel = new Projectile(
          ProjectileType.DIRECT_BOLT,
          bomb.sourceWeaponId,
          pos.x,
          pos.y,
          7,
          Math.round(bomb.damage * 0.3),
          2,
          1.1
        );
        shrapnel.isDecoratedClone = true;
        shrapnel.velocity.set(Math.cos(ang) * 460, Math.sin(ang) * 460);
        shrapnel.color = tags.has(SkillTag.FIRE) ? '#f97316' : '#38bdf8';
        shrapnel.wallBounces = player.getPassiveLevel('spinach');
        tags.forEach(t => shrapnel.tags.add(t));
        this.projectiles.push(shrapnel);
      }
    }
  }

  public handleEnemyDeath(enemy: Enemy, dropLoot = true, triggerKillHooks = true): void {
    if (enemy.isBoss) {
      const otherBossesAlive = this.enemies.some(e => e !== enemy && e.active && e.isBoss);
      this.sound.playBossSlain();
      this.particleSystem.emitBossSlainBurst(enemy.position.x, enemy.position.y);
      this.camera.triggerShake(otherBossesAlive ? 12 : 18);
      this.bossSlainWaveTimer = 0.85;
      this.bossSlainPosition.copy(enemy.position);
      if (this.activeHitStopCallback) {
        this.activeHitStopCallback(otherBossesAlive ? 0.10 : 0.3);
      }
      // Clear hostile bullets when the final Boss in the room is defeated
      if (!otherBossesAlive) {
        for (const ep of this.enemyProjectiles) {
          if (!ep.isReflected) {
            ep.active = false;
          }
        }
      }
    } else {
      this.sound.playEnemyDeath();
      this.particleSystem.emitDeath(enemy.position.x, enemy.position.y, '#64748b', 10);
    }

    // 触发事件总线 OnKill 监听节点（亡语追踪噬魂弹、异常状态链式殉爆等）
    if (triggerKillHooks && this.currentPlayerRef) {
      this.buildEventBus.emitOnKill({
        player: this.currentPlayerRef,
        enemy,
        combatSystem: this
      });
    }

    // Splatter persistent ground blood decal
    if (enemy.type === EnemyType.SLIME_LARGE || enemy.type === EnemyType.SLIME_MEDIUM || enemy.type === EnemyType.SLIME_SMALL) {
      this.mapSystem.addBloodDecal(enemy.position.x, enemy.position.y, '#065f46', enemy.radius * 1.1);
    } else if (enemy.isBoss) {
      this.mapSystem.addBloodDecal(enemy.position.x, enemy.position.y, '#450a0a', 38);
    } else {
      this.mapSystem.addBloodDecal(enemy.position.x, enemy.position.y, '#7f1d1d', enemy.radius);
    }

    // Splitter Slime mechanics
    if (enemy.type === EnemyType.SLIME_LARGE) {
      for (let s = -1; s <= 1; s += 2) {
        const offset = new Vector2(s * 14, (Math.random() - 0.5) * 10);
        const subSlime = createEnemy(EnemyType.SLIME_MEDIUM, enemy.position.x + offset.x, enemy.position.y + offset.y);
        this.addEnemy(subSlime);
      }
    } else if (enemy.type === EnemyType.SLIME_MEDIUM) {
      for (let s = -1; s <= 1; s += 2) {
        const offset = new Vector2(s * 10, (Math.random() - 0.5) * 8);
        const subSlime = createEnemy(EnemyType.SLIME_SMALL, enemy.position.x + offset.x, enemy.position.y + offset.y);
        this.addEnemy(subSlime);
      }
    }

    // Rule: Every single defeated enemy 100% drops an experience gem!
    if (dropLoot) {
      const gemType = (enemy.xpValue >= 50)
        ? DropType.XP_VIOLET
        : (enemy.xpValue >= 20)
        ? DropType.XP_RED
        : (enemy.xpValue >= 5)
        ? DropType.XP_GREEN
        : DropType.XP_CYAN;

      const gem = new DropItem(gemType, enemy.position.x, enemy.position.y, Math.max(1, enemy.xpValue));
      gem.isMagnetized = true;
      this.dropItems.push(gem);

      // Bosses grant gold and reduced bonus XP; chests use a shared room roll.
      if (enemy.isBoss) {
        // One chest roll per room, including rooms with multiple bosses.
        if (!this.bossChestRolledThisRoom) {
          this.bossChestRolledThisRoom = true;
          if (Math.random() < 0.45) {
            this.bossChestDroppedThisRoom = true;
            this.dropItems.push(new DropItem(DropType.BOSS_CHEST, enemy.position.x, enemy.position.y, 1));
          }
        }
        const goldCount = 12;
        for (let g = 0; g < goldCount; g++) {
          const ang = (g * Math.PI * 2) / goldCount;
          const dist = 32 + (g % 3) * 18;
          const coin = new DropItem(
            DropType.GOLD_COIN,
            enemy.position.x + Math.cos(ang) * dist,
            enemy.position.y + Math.sin(ang) * dist,
            25
          );
          coin.isMagnetized = true;
          this.dropItems.push(coin);
        }
        const bonusGems = 2;
        for (let b = 0; b < bonusGems; b++) {
          const ang = (b * Math.PI * 2) / bonusGems + 0.3;
          const vGem = new DropItem(
            DropType.XP_VIOLET,
            enemy.position.x + Math.cos(ang) * 48,
            enemy.position.y + Math.sin(ang) * 48,
            30
          );
          vGem.isMagnetized = true;
          this.dropItems.push(vGem);
        }
        this.mapSystem.shrines = [];
      }
    }
  }

  private handleItemPickup(drop: DropItem, player: Player, onLevelUp: () => void, onBossChestOpen: () => void): void {
    switch (drop.type) {
      case DropType.XP_CYAN:
      case DropType.XP_GREEN:
      case DropType.XP_RED:
      case DropType.XP_VIOLET: {
        this.sound.playGemPickup();
        const leveledUp = player.gainXp(drop.value);
        if (leveledUp) {
          this.sound.playLevelUp();
          this.particleSystem.emitLevelUpFanfare(player.position.x, player.position.y);
          onLevelUp();
        }
        break;
      }

      case DropType.HEALTH_POTION: {
        const healAmt = 35;
        player.heal(healAmt);
        this.damageTextSystem.addHeal(player.position.x, player.position.y, healAmt);
        this.sound.playItemPickup('POTION');
        break;
      }

      case DropType.MAGNET: {
        this.sound.playItemPickup('RELIC_ITEM');
        this.vacuumAllGems();
        break;
      }

      case DropType.FREEZE_CLOCK: {
        this.sound.playItemPickup('RELIC_ITEM');
        this.freezeEnemies(5.0);
        break;
      }

      case DropType.GOLD_COIN: {
        player.gold += 10;
        this.sound.playItemPickup('GOLD');
        break;
      }

      case DropType.BOSS_CHEST: {
        this.sound.playChestOpen();
        this.particleSystem.emitChestFountain(player.position.x, player.position.y);
        onBossChestOpen();
        break;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // 1. Render Drop Items
    for (const drop of this.dropItems) {
      if (this.camera.isVisible(drop.position, drop.radius + 10)) {
        drop.render(ctx);
      }
    }

    // 1b. Render Delayed Trait Bombs (示例B：冲刺原地留下的延迟引爆炸弹)
    for (const bomb of this.delayedBombs) {
      ctx.save();
      ctx.translate(bomb.position.x, bomb.position.y);
      const progress = 1 - bomb.timer / bomb.maxTimer;
      const pulse = 1 + Math.sin(progress * Math.PI * 6) * 0.18;

      // 预警爆炸半径圈
      ctx.strokeStyle = bomb.inheritedTags.has(SkillTag.FIRE) ? 'rgba(249, 115, 22, 0.55)' : 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, bomb.radius * (0.4 + 0.6 * progress), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 炸弹核心球体
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = bomb.inheritedTags.has(SkillTag.FIRE) ? '#f97316' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, 11 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Render Projectiles
    for (const proj of this.projectiles) {
      if (this.camera.isVisible(proj.position, proj.radius + 20)) {
        proj.render(ctx);
      }
    }

    // 3. Render Enemy Projectiles
    for (const ep of this.enemyProjectiles) {
      if (this.camera.isVisible(ep.position, ep.radius + 10)) {
        ep.render(ctx);
      }
    }

    // 4. Render Enemies
    for (const enemy of this.enemies) {
      if (this.camera.isVisible(enemy.position, enemy.radius + 25)) {
        enemy.render(ctx);
      }
    }

    // 5. Render Lightning Visuals
    for (const l of this.visualLightnings) {
      this.renderLightningEffect(ctx, l);
    }

    // 5b. Boss Slain Radial Shockwave & Sacred Golden Runes (Boss 终结径向冲击波)
    if (this.bossSlainWaveTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const prog = 1 - this.bossSlainWaveTimer / 0.85;
      const alpha = Math.max(0, 1 - prog);
      const bx = this.bossSlainPosition.x;
      const by = this.bossSlainPosition.y;
      const maxR = 460;
      const curR = maxR * Math.pow(prog, 0.55);

      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = Math.max(2, 16 * (1 - prog));
      ctx.beginPath();
      ctx.arc(bx, by, curR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = Math.max(1.5, 8 * (1 - prog));
      ctx.beginPath();
      ctx.arc(bx, by, curR * 0.76, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating 8-Pointed Sacred Runic Seal at Boss Death Epicenter
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(prog * 1.8);
      ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.75})`;
      ctx.lineWidth = 2.5;
      for (let s = 0; s < 2; s++) {
        ctx.rotate(Math.PI / 4);
        const boxS = curR * 0.48;
        ctx.strokeRect(-boxS, -boxS, boxS * 2, boxS * 2);
      }
      ctx.restore();
      ctx.restore();
    }

    // 6. Character-Specific Ultimate Screen Sigil + Flash
    if (this.screenNukeFlashTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const progress = 1 - this.screenNukeFlashTimer / 0.65;
      const alpha = Math.min(1.0, this.screenNukeFlashTimer * 2.5);

      const cx = this.camera.position.x;
      const cy = this.camera.position.y;
      const maxR = Math.max(this.camera.viewportWidth, this.camera.viewportHeight) * 0.62;
      const r = maxR * (0.28 + 0.72 * progress);

      ctx.globalAlpha = alpha;

      if (this.activeUltimateHeroId === 'antonio') {
        // CRIMSON CROSS: Colossal Golden-Crimson Crusader Cross Slash across the arena
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 18 * (1 - progress * 0.5);
        ctx.beginPath();
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx, cy + r);
        ctx.stroke();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 6;
        ctx.stroke();
      } else if (this.activeUltimateHeroId === 'gennaro') {
        // PHANTOM BLADESTORM: Emerald Vortex Blades Ring
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 5;
        for (let b = 0; b < 8; b++) {
          const ang = (b * Math.PI) / 4 + progress * 4;
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.85, ang, ang + 0.45);
          ctx.stroke();
        }
      } else if (this.activeUltimateHeroId === 'arca') {
        // HELLFIRE CATACLYSM: Concentric Solar Magma Rings
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
        ctx.stroke();
      } else if (this.activeUltimateHeroId === 'pasqualina') {
        // PRISMATIC THUNDER: Octagonal Storm Array
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const ang = (i * Math.PI * 2) / 8 + progress;
          const px = cx + Math.cos(ang) * r;
          const py = cy + Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else if (this.activeUltimateHeroId === 'mortaccio') {
        // DEATH SPIRAL HARVEST: Necrotic Purple Reaper Halo
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // IMELDA: STARFALL PENTAGRAM (5-Pointed Celestial Pentagram)
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) {
          const starIdx = (i * 2) % 5;
          const ang = (starIdx * Math.PI * 2) / 5 - Math.PI / 2 + progress * 0.8;
          const px = cx + Math.cos(ang) * r;
          const py = cy + Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Soft Tinted Flash Wash
      ctx.globalAlpha = Math.min(0.45, this.screenNukeFlashTimer * 0.9);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(
        cx - this.camera.viewportWidth,
        cy - this.camera.viewportHeight,
        this.camera.viewportWidth * 2,
        this.camera.viewportHeight * 2
      );
      ctx.restore();
    }
  }

  private renderLightningEffect(ctx: CanvasRenderingContext2D, l: VisualLightningEffect): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const alpha = l.lifetime / l.maxLifetime;
    ctx.globalAlpha = alpha;

    // 1. Ground Impact Scorched Shockwave Halo
    const haloGrad = ctx.createRadialGradient(
      l.position.x, l.position.y, 2,
      l.position.x, l.position.y, l.radius * 1.35
    );
    haloGrad.addColorStop(0, '#ffffff');
    haloGrad.addColorStop(0.35, l.isEvolved ? '#38bdf8' : '#a855f7');
    haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(l.position.x, l.position.y, l.radius * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // Crisp Electric Ring
    ctx.strokeStyle = l.isEvolved ? '#bae6fd' : '#e9d5ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(l.position.x, l.position.y, l.radius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Generate Jagged Bolt Points from Sky to Target
    const pts: { x: number; y: number }[] = [];
    let curX = l.position.x + (Math.random() - 0.5) * 30;
    let curY = l.position.y - 480;
    pts.push({ x: curX, y: curY });

    while (curY < l.position.y) {
      curY += 32 + Math.random() * 28;
      if (curY >= l.position.y) {
        curX = l.position.x;
        curY = l.position.y;
      } else {
        curX += (Math.random() - 0.5) * 42;
      }
      pts.push({ x: curX, y: curY });
    }

    // Outer Thick Glow Pass
    ctx.strokeStyle = l.isEvolved ? '#0284c7' : '#9333ea';
    ctx.lineWidth = l.isEvolved ? 14 : 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    // Midtone Plasma Pass
    ctx.strokeStyle = l.isEvolved ? '#7dd3fc' : '#d8b4fe';
    ctx.lineWidth = l.isEvolved ? 6 : 4.5;
    ctx.stroke();

    // Inner Blinding White Core Pass
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Side Fork Branches
    ctx.strokeStyle = l.isEvolved ? '#bae6fd' : '#f3e8ff';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < pts.length - 1; i += 2) {
      const p = pts[i];
      const forkDir = i % 4 === 1 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + forkDir * (18 + Math.random() * 18), p.y + 20 + Math.random() * 15);
      ctx.stroke();
    }

    ctx.restore();
  }
}
