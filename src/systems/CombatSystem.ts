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

  public spatialGrid: SpatialHashGrid<Enemy>;
  public freezeTimer = 0;

  private visualLightnings: VisualLightningEffect[] = [];
  private screenNukeFlashTimer = 0;

  constructor(
    public particleSystem: ParticleSystem,
    public damageTextSystem: DamageTextSystem,
    public mapSystem: MapSystem,
    public sound: SoundSynthesizer,
    public camera: Camera
  ) {
    this.spatialGrid = new SpatialHashGrid<Enemy>(96);
  }

  public addProjectile(proj: Projectile): void {
    this.projectiles.push(proj);
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

  public triggerScreenNuke(isEvolved = false): void {
    this.screenNukeFlashTimer = 0.4;
    this.camera.triggerShake(14);

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      if (!enemy.isBoss) {
        enemy.takeDamage(99999);
        this.handleEnemyDeath(enemy, false); // pentagram kills
      } else {
        enemy.takeDamage(1200);
        this.damageTextSystem.addDamage(enemy.position.x, enemy.position.y, 1200, true);
      }
    }
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

  public update(dt: number, player: Player, onLevelUp: () => void, onBossChestOpen: () => void): void {
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

    // 4. Update Enemy Projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      ep.update(dt);
      if (!ep.active) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Enemy Projectile vs Player collision
      if (ep.position.distanceTo(player.position) <= ep.radius + player.radius) {
        const dmgTaken = player.takeDamage(ep.damage);
        if (dmgTaken > 0) {
          this.damageTextSystem.addPlayerDamage(player.position.x, player.position.y, dmgTaken);
          this.camera.triggerShake(5);
          this.sound.playPlayerHurt();
        }
        ep.active = false;
        this.enemyProjectiles.splice(i, 1);
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

      // Enemy vs Player collision
      const distToPlayer = enemy.position.distanceTo(player.position);
      if (distToPlayer <= enemy.radius + player.radius) {
        const dmgTaken = player.takeDamage(enemy.attackDamage);
        if (dmgTaken > 0) {
          this.damageTextSystem.addPlayerDamage(player.position.x, player.position.y, dmgTaken);
          this.camera.triggerShake(6);
          this.sound.playPlayerHurt();

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
        const isCrit = proj.isCrit || Math.random() < player.critChance;
        const totalDamage = Math.round(proj.damage * (isCrit ? 2.0 : 1.0));

        const isDead = enemy.takeDamage(totalDamage);
        this.damageTextSystem.addDamage(enemy.position.x, enemy.position.y, totalDamage, isCrit);
        this.particleSystem.emitHit(enemy.position.x, enemy.position.y, proj.color, 4);
        this.sound.playHit();

        // Track weapon statistics
        const srcWeapon = player.getWeapon(proj.weaponId);
        if (srcWeapon) {
          srcWeapon.totalDamageDealt += totalDamage;
        }

        // Knockback
        const kbDir = enemy.position.clone().sub(proj.position);
        enemy.applyKnockback(kbDir, 200);

        if (isDead) {
          if (srcWeapon) srcWeapon.totalKills++;
          this.handleEnemyDeath(enemy);
        }

        proj.pierce--;
        if (proj.pierce <= 0 && proj.type !== ProjectileType.GARLIC_AURA && proj.type !== ProjectileType.GROUND_FIRE) {
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

  public handleEnemyDeath(enemy: Enemy, dropLoot = true): void {
    this.sound.playEnemyDeath();
    this.particleSystem.emitDeath(enemy.position.x, enemy.position.y, '#64748b', enemy.isBoss ? 30 : 10);

    // Splatter persistent ground blood decal
    if (enemy.type === EnemyType.SLIME_LARGE || enemy.type === EnemyType.SLIME_MEDIUM || enemy.type === EnemyType.SLIME_SMALL) {
      this.mapSystem.addBloodDecal(enemy.position.x, enemy.position.y, '#065f46', enemy.radius * 1.1);
    } else if (enemy.isBoss) {
      this.mapSystem.addBloodDecal(enemy.position.x, enemy.position.y, '#450a0a', 32);
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

    if (dropLoot) {
      const dropType = enemy.getDropType();
      this.dropItems.push(new DropItem(dropType, enemy.position.x, enemy.position.y, enemy.xpValue));
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
        this.sound.playGemPickup();
        break;
      }

      case DropType.MAGNET: {
        this.sound.playGemPickup();
        this.vacuumAllGems();
        break;
      }

      case DropType.FREEZE_CLOCK: {
        this.sound.playGemPickup();
        this.freezeEnemies(5.0);
        break;
      }

      case DropType.GOLD_COIN: {
        player.gold += 10;
        this.sound.playGemPickup();
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

    // 6. Screen Nuke Flash
    if (this.screenNukeFlashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1.0, this.screenNukeFlashTimer * 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        this.camera.position.x - this.camera.viewportWidth,
        this.camera.position.y - this.camera.viewportHeight,
        this.camera.viewportWidth * 2,
        this.camera.viewportHeight * 2
      );
      ctx.restore();
    }
  }

  private renderLightningEffect(ctx: CanvasRenderingContext2D, l: VisualLightningEffect): void {
    ctx.save();
    const alpha = l.lifetime / l.maxLifetime;
    ctx.globalAlpha = alpha;

    // Glowing ground circle
    ctx.shadowColor = l.isEvolved ? '#38bdf8' : '#a855f7';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = l.isEvolved ? '#bae6fd' : '#e9d5ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(l.position.x, l.position.y, l.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Jagged vertical lightning bolt from sky
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = l.isEvolved ? 5 : 3;
    ctx.beginPath();
    let curX = l.position.x + (Math.random() - 0.5) * 20;
    let curY = l.position.y - 450;
    ctx.moveTo(curX, curY);

    while (curY < l.position.y) {
      curY += 40 + Math.random() * 30;
      curX += (Math.random() - 0.5) * 35;
      ctx.lineTo(curX, Math.min(l.position.y, curY));
    }
    ctx.stroke();

    ctx.restore();
  }
}
