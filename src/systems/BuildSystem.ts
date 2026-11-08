import { Vector2 } from '../core/Vector2';
import type { Player } from '../entities/Player';
import type { Enemy } from '../enemies/Enemy';
import type { CombatSystem } from './CombatSystem';
import { Projectile, ProjectileType } from '../weapons/Projectile';
import type { Weapon } from '../weapons/Weapon';

/**
 * 多维技能与构筑标签系统 (Multi-Dimensional Tag System)
 */
export enum SkillTag {
  PROJECTILE = 'PROJECTILE', // [投射物]
  MELEE = 'MELEE',           // [近战]
  FIRE = 'FIRE',             // [火焰]
  CHAIN = 'CHAIN',           // [连锁]
  OVERLOAD = 'OVERLOAD',     // [过载]
  SUMMON = 'SUMMON',         // [召唤]
  DASH = 'DASH',             // [位移]
  SINGULARITY = 'SINGULARITY'// [奇点]
}

export interface TagMeta {
  id: SkillTag;
  label: string;
  color: string;
  bgColor: string;
}

export const TAG_METADATA: Record<SkillTag, TagMeta> = {
  [SkillTag.PROJECTILE]: {
    id: SkillTag.PROJECTILE,
    label: '[投射物]',
    color: '#38bdf8',
    bgColor: 'rgba(56, 189, 248, 0.18)'
  },
  [SkillTag.MELEE]: {
    id: SkillTag.MELEE,
    label: '[近战]',
    color: '#f87171',
    bgColor: 'rgba(248, 113, 113, 0.18)'
  },
  [SkillTag.FIRE]: {
    id: SkillTag.FIRE,
    label: '[火焰]',
    color: '#fb923c',
    bgColor: 'rgba(251, 146, 60, 0.18)'
  },
  [SkillTag.CHAIN]: {
    id: SkillTag.CHAIN,
    label: '[连锁]',
    color: '#c084fc',
    bgColor: 'rgba(192, 132, 252, 0.18)'
  },
  [SkillTag.OVERLOAD]: {
    id: SkillTag.OVERLOAD,
    label: '[过载]',
    color: '#facc15',
    bgColor: 'rgba(250, 204, 21, 0.18)'
  },
  [SkillTag.SUMMON]: {
    id: SkillTag.SUMMON,
    label: '[召唤]',
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.18)'
  },
  [SkillTag.DASH]: {
    id: SkillTag.DASH,
    label: '[位移]',
    color: '#67e8f9',
    bgColor: 'rgba(103, 232, 249, 0.18)'
  },
  [SkillTag.SINGULARITY]: {
    id: SkillTag.SINGULARITY,
    label: '[奇点]',
    color: '#e879f9',
    bgColor: 'rgba(232, 121, 249, 0.18)'
  }
};

/**
 * 默认武器多维标签映射表 (2~3个标签/武器)
 */
export const WEAPON_DEFAULT_TAGS: Record<string, SkillTag[]> = {
  magic_wand: [SkillTag.PROJECTILE, SkillTag.CHAIN],
  knife: [SkillTag.PROJECTILE, SkillTag.MELEE],
  fire_wand: [SkillTag.PROJECTILE, SkillTag.FIRE, SkillTag.OVERLOAD],
  runetracer: [SkillTag.PROJECTILE, SkillTag.CHAIN, SkillTag.OVERLOAD],
  cross: [SkillTag.PROJECTILE, SkillTag.MELEE],
  whip: [SkillTag.MELEE],
  axe: [SkillTag.MELEE, SkillTag.PROJECTILE, SkillTag.OVERLOAD],
  spinning_orbs: [SkillTag.SUMMON, SkillTag.MELEE],
  holy_water: [SkillTag.FIRE, SkillTag.SUMMON, SkillTag.OVERLOAD],
  lightning_ring: [SkillTag.CHAIN, SkillTag.OVERLOAD],
  garlic: [SkillTag.OVERLOAD, SkillTag.MELEE]
};

/**
 * 事件监听节点枚举 (Event Bus Hook Nodes)
 */
export enum BuildEventType {
  ON_SHOOT = 'ON_SHOOT',     // 攻击发射时 (OnShoot / OnAttack)
  ON_HIT = 'ON_HIT',         // 命中敌人时 (OnHit)
  ON_KILL = 'ON_KILL',       // 击杀敌人时 (OnKill)
  ON_DODGE = 'ON_DODGE',     // 玩家冲刺/位移时 (OnDodge)
  ON_DAMAGED = 'ON_DAMAGED'  // 玩家受伤时 (OnDamaged)
}

export interface ShootEventContext {
  player: Player;
  weapon: Weapon;
  projectiles: Projectile[];
  combatSystem: CombatSystem;
  attackIndex: number;
}

export interface HitEventContext {
  player: Player;
  projectile: Projectile;
  enemy: Enemy;
  damage: number;
  isFourthStroke: boolean;
  combatSystem: CombatSystem;
}

export interface KillEventContext {
  player: Player;
  enemy: Enemy;
  killerProjectile?: Projectile;
  combatSystem: CombatSystem;
}

export interface DodgeEventContext {
  player: Player;
  startPosition: Vector2;
  dashDirection: Vector2;
  combatSystem: CombatSystem;
}

export interface DamagedEventContext {
  player: Player;
  damageTaken: number;
  attackerPosition?: Vector2;
  combatSystem: CombatSystem;
}

/**
 * 延迟引爆炸弹数据结构 (用于 示例B：冲刺留弹并继承主武器属性标签)
 */
export interface DelayedTraitBomb {
  position: Vector2;
  timer: number;
  maxTimer: number;
  radius: number;
  damage: number;
  inheritedTags: Set<SkillTag>;
  sourceWeaponId: string;
}

/**
 * 房间内基于事件总线 + 装饰器模式的构筑触发管理器 (BuildEventBus)
 */
export class BuildEventBus {
  private attackCounter = 0;

  public reset(): void {
    this.attackCounter = 0;
  }

  /**
   * 检测武器或投射物是否包含指定标签
   */
  public static hasTag(tags: Set<SkillTag> | SkillTag[], target: SkillTag): boolean {
    if (Array.isArray(tags)) return tags.includes(target);
    return tags.has(target);
  }

  /**
   * 节点 1：当武器发射投射物时触发 (OnShoot / Decorator Pattern)
   * 可直接对发射出的投射物进行形态分裂、射程修改、墙壁反弹赋能或第4击奇点转化
   */
  public emitOnShoot(
    player: Player,
    weapon: Weapon,
    spawnedProjectiles: Projectile[],
    combatSystem: CombatSystem
  ): Projectile[] {
    this.attackCounter++;
    const currentAttackIndex = this.attackCounter;
    let finalProjectiles = [...spawnedProjectiles];

    // 确保所有投射物都继承其所属武器的多维标签
    for (const p of finalProjectiles) {
      for (const t of weapon.tags) {
        p.tags.add(t);
      }
    }

    // =========================================================================
    // 【示例 A（改变形态）】：棱镜散射核心 (spinach / prism_split)
    // "普通攻击与[投射物]技能变为散射3发，但飞行距离缩短30%，且命中墙壁会反弹1~2次"
    // =========================================================================
    const splitRank = player.getPassiveLevel('spinach');
    if (splitRank > 0 && weapon.hasTag(SkillTag.PROJECTILE)) {
      const scattered: Projectile[] = [];
      const spreadAngles = [-0.26, 0, 0.26]; // 3发扇形散射角度 (~15度)
      const bounceCount = splitRank; // 1级反弹1次，2级反弹2次...
      const durationFactor = 0.68;   // 飞行距离/持续时间缩短

      for (const orig of finalProjectiles) {
        // 对非环绕、非固定地火的飞行投射物应用3发散射改造
        if (
          orig.type !== ProjectileType.ORBITING_ORB &&
          orig.type !== ProjectileType.GARLIC_AURA &&
          orig.type !== ProjectileType.GROUND_FIRE &&
          orig.velocity.lengthSq() > 1
        ) {
          const baseSpeed = orig.velocity.length();
          const baseAngle = orig.velocity.angle();

          for (let s = 0; s < spreadAngles.length; s++) {
            const ang = baseAngle + spreadAngles[s];
            const clone = s === 1
              ? orig
              : new Projectile(
                  orig.type,
                  orig.weaponId,
                  orig.position.x,
                  orig.position.y,
                  orig.radius * 0.92,
                  Math.round(orig.damage * (0.75 + splitRank * 0.1)),
                  orig.pierce,
                  orig.maxLifetime * durationFactor
                );

            clone.lifetime = orig.maxLifetime * durationFactor;
            clone.maxLifetime = orig.maxLifetime * durationFactor;
            clone.velocity.set(Math.cos(ang) * baseSpeed, Math.sin(ang) * baseSpeed);
            clone.color = orig.color;
            clone.glowColor = '#38bdf8';
            clone.wallBounces = Math.max(clone.wallBounces, bounceCount);
            orig.tags.forEach(t => clone.tags.add(t));
            scattered.push(clone);
          }
        } else {
          orig.wallBounces = Math.max(orig.wallBounces, bounceCount);
          scattered.push(orig);
        }
      }
      finalProjectiles = scattered;
    }

    // =========================================================================
    // 【示例 C（风险与机制转化）】：湮灭第四击 (clover / fourth_stroke_singularity)
    // "取消暴击率概念(暴击率归零)，改为每第4次攻击必定造成范围穿透伤害，并吸附周围敌人"
    // =========================================================================
    const singularityRank = player.getPassiveLevel('clover');
    const isFourthAttack = singularityRank > 0 && currentAttackIndex % 4 === 0;
    if (isFourthAttack) {
      for (const p of finalProjectiles) {
        p.isSingularityStrike = true;
        p.isCrit = true;
        p.pierce = 999; // 必定无限穿透
        p.radius = Math.round(p.radius * 1.45);
        p.damage = Math.round(p.damage * (1.35 + singularityRank * 0.25));
        p.color = '#e879f9';
        p.glowColor = '#a855f7';
        p.tags.add(SkillTag.SINGULARITY);
        p.tags.add(SkillTag.OVERLOAD);
      }
      combatSystem.particleSystem.emitHit(player.position.x, player.position.y, '#e879f9', 6);
    }

    // =========================================================================
    // 【标签联动：近战剑气投射化】(duplicator / blade_projection)
    // "所有带有 [近战] 标签的武器攻击时，额外发射一道继承其标签的半圆形穿透剑气 [投射物]"
    // =========================================================================
    const bladeProjRank = player.getPassiveLevel('duplicator');
    if (bladeProjRank > 0 && weapon.hasTag(SkillTag.MELEE)) {
      const target = combatSystem.getNearestEnemies(player.position, 480, 1)[0];
      const dir = target
        ? target.position.clone().sub(player.position).normalize()
        : new Vector2(player.facingDirection, 0);

      const waveProj = new Projectile(
        ProjectileType.WHIP_SLASH,
        weapon.id,
        player.position.x + dir.x * 18,
        player.position.y + dir.y * 18,
        58 + bladeProjRank * 8,
        Math.round(weapon.damage * player.damageMult * (0.65 + bladeProjRank * 0.2)),
        3 + bladeProjRank,
        0.55
      );
      waveProj.rotation = dir.x >= 0 ? 1 : -1;
      waveProj.velocity.copy(dir).multiplyScalar(340);
      waveProj.color = '#f43f5e';
      waveProj.glowColor = '#fbbf24';
      weapon.tags.forEach(t => waveProj.tags.add(t));
      waveProj.tags.add(SkillTag.PROJECTILE);
      if (splitRank > 0) waveProj.wallBounces = splitRank;
      finalProjectiles.push(waveProj);
    }

    return finalProjectiles;
  }

  /**
   * 节点 2：当投射物或技能命中敌人时触发 (OnHit)
   */
  public emitOnHit(ctx: HitEventContext): void {
    const { player, projectile, enemy, damage, combatSystem } = ctx;

    // 1. 【示例 C 命中效果】：第4次攻击触发范围穿透震荡波 + 强力吸附周围敌人 (Singularity Vacuum)
    if (projectile.isSingularityStrike) {
      const pullRadius = 155 + player.getPassiveLevel('clover') * 20;
      const nearby = combatSystem.spatialGrid.queryRadius(enemy.position, pullRadius);
      combatSystem.particleSystem.emitHit(enemy.position.x, enemy.position.y, '#e879f9', 8);

      for (const other of nearby) {
        if (!other.active) continue;
        // 向命中中心强力吸附聚怪
        if (other !== enemy) {
          const pullDir = enemy.position.clone().sub(other.position);
          const dist = pullDir.length();
          if (dist > 8) {
            pullDir.normalize();
            other.position.addScaled(pullDir, Math.min(dist * 0.45, 52));
          }
          // 造成范围穿透溅射伤害
          const splashDmg = Math.max(1, Math.round(damage * 0.35));
          const killed = other.takeDamage(splashDmg);
          combatSystem.damageTextSystem.addDamage(other.position.x, other.position.y, splashDmg, true);
          if (killed) {
            player.kills++;
            combatSystem.handleEnemyDeath(other);
          }
        }
      }
    }

    // 2. 【多标签联动 1】：炎爆烙印 (empty_tome / pyro_payload)
    // "所有带有 [投射物] 标签的技能，在命中时会触发 [火焰] 爆炸并附加灼烧"
    const pyroRank = player.getPassiveLevel('empty_tome');
    if (pyroRank > 0 && projectile.tags.has(SkillTag.PROJECTILE) && !projectile.hasTriggeredPyroBurst) {
      projectile.hasTriggeredPyroBurst = true; // 每颗投射物首次命中触发炎爆，避免无限递归
      const blastRadius = 52 + pyroRank * 8;
      const blastDmg = Math.max(1, Math.round(damage * (0.28 + pyroRank * 0.08)));
      enemy.burnTimer = 3.5;
      combatSystem.particleSystem.emitHit(enemy.position.x, enemy.position.y, '#f97316', 6);

      const victims = combatSystem.spatialGrid.queryRadius(enemy.position, blastRadius);
      for (const v of victims) {
        if (!v.active) continue;
        v.burnTimer = 3.5;
        const killed = v.takeDamage(blastDmg);
        combatSystem.damageTextSystem.addDamage(v.position.x, v.position.y, blastDmg, false);
        if (killed) {
          player.kills++;
          combatSystem.handleEnemyDeath(v);
        }
      }
    }

    // 3. 【多标签联动 2】：电弧导管 (attractorb / arc_conductor)
    // "带有 [连锁] 或 [过载] 标签的技能命中时，向周围额外弹射雷电链；若目标处于 [火焰] 灼烧则触发电磁过载爆炸"
    const arcRank = player.getPassiveLevel('attractorb');
    if (arcRank > 0 && (projectile.tags.has(SkillTag.CHAIN) || projectile.tags.has(SkillTag.OVERLOAD))) {
      enemy.shockTimer = 3.5;
      const neighbors = combatSystem.getNearestEnemies(enemy.position, 140, 1 + arcRank);
      for (const n of neighbors) {
        if (n === enemy || !n.active) continue;
        const arcDmg = Math.max(1, Math.round(damage * (0.26 + arcRank * 0.08)));
        n.shockTimer = 3.0;
        combatSystem.spawnLightningVisual(n.position, 22, false);
        const killed = n.takeDamage(arcDmg);
        combatSystem.damageTextSystem.addDamage(n.position.x, n.position.y, arcDmg, false);
        if (killed) {
          player.kills++;
          combatSystem.handleEnemyDeath(n);
        }
      }
    }

    // 4. 【多标签联动 3】：噬魂血契 (pummarola / crimson_leech)
    // "带有 [近战] 或 [召唤] 标签的攻击命中流血/灼烧敌人时，汲取生命精华并释放血色新星"
    const leechRank = player.getPassiveLevel('pummarola');
    if (leechRank > 0 && (projectile.tags.has(SkillTag.MELEE) || projectile.tags.has(SkillTag.SUMMON))) {
      enemy.bleedTimer = 3.5;
      if (Math.random() < 0.16 + leechRank * 0.05) {
        player.heal(1 + Math.floor(leechRank / 3));
        combatSystem.particleSystem.emitHit(enemy.position.x, enemy.position.y, '#f43f5e', 4);
      }
    }
  }

  /**
   * 节点 3：当击杀敌人时触发 (OnKill)
   */
  public emitOnKill(ctx: KillEventContext): void {
    const { player, enemy, combatSystem } = ctx;

    // 1. 【击杀联动】：亡语幽灵召唤 (hollow_heart / soul_remnant)
    // "每击杀 5 名敌人，在尸体处召唤一颗具有 [召唤][投射物] 标签的追踪噬魂弹"
    const soulRank = player.getPassiveLevel('hollow_heart');
    if (soulRank > 0 && player.kills % Math.max(3, 7 - soulRank) === 0) {
      const target = combatSystem.getNearestEnemies(enemy.position, 500, 1)[0];
      const dir = target
        ? target.position.clone().sub(enemy.position).normalize()
        : Vector2.fromAngle(Math.random() * Math.PI * 2);

      const wraithBolt = new Projectile(
        ProjectileType.DIRECT_BOLT,
        'soul_remnant',
        enemy.position.x,
        enemy.position.y,
        9,
        Math.round((14 + player.level * 2.2) * (1 + soulRank * 0.18)),
        1 + soulRank,
        2.0
      );
      wraithBolt.velocity.copy(dir).multiplyScalar(430);
      wraithBolt.color = '#34d399';
      wraithBolt.glowColor = '#10b981';
      wraithBolt.tags.add(SkillTag.SUMMON);
      wraithBolt.tags.add(SkillTag.PROJECTILE);
      combatSystem.addProjectile(wraithBolt);
    }

    // 2. 【击杀联动】：过载链式尸爆 (crown / overload_detonation)
    // "被带有 [火焰] 或 [过载] 标签状态影响下的敌人死亡时，原地引发过载殉爆"
    const detonateRank = player.getPassiveLevel('crown');
    if (detonateRank > 0 && (enemy.burnTimer > 0 || enemy.shockTimer > 0 || Math.random() < 0.25)) {
      const radius = 58 + detonateRank * 10;
      const blastDmg = Math.round((12 + player.level * 2) * (1 + detonateRank * 0.18));
      combatSystem.particleSystem.emitHit(enemy.position.x, enemy.position.y, '#facc15', 10);

      const nearby = combatSystem.spatialGrid.queryRadius(enemy.position, radius);
      for (const other of nearby) {
        if (!other.active || other === enemy) continue;
        const killed = other.takeDamage(blastDmg);
        combatSystem.damageTextSystem.addDamage(other.position.x, other.position.y, blastDmg, false);
        if (killed) {
          player.kills++;
          // 不递归触发，直接处理基础掉落
          combatSystem.handleEnemyDeath(other, true, false);
        }
      }
    }
  }

  /**
   * 节点 4：当玩家使用冲刺/位移技能时触发 (OnDodge)
   * 【示例 B（跨机制联动）】：跃迁余烬炸弹 (wings / volatile_dash_bomb)
   * "玩家每次使用冲刺/位移技能时，在原地留下一颗延迟引爆的炸弹，炸弹继承当前主武器的属性标签"
   */
  public emitOnDodge(ctx: DodgeEventContext): void {
    const { player, startPosition, combatSystem } = ctx;
    const bombRank = player.getPassiveLevel('wings');
    if (bombRank <= 0) return;

    // 获取当前主武器（第一把武器）的所有属性标签
    const primaryWeapon = player.weapons[0];
    const inheritedTags = new Set<SkillTag>([SkillTag.DASH, SkillTag.OVERLOAD]);
    if (primaryWeapon) {
      for (const tag of primaryWeapon.tags) {
        inheritedTags.add(tag);
      }
    }

    const baseDmg = primaryWeapon
      ? Math.round(primaryWeapon.damage * player.damageMult * (1.6 + bombRank * 0.45))
      : Math.round(45 * (1 + bombRank * 0.4));

    combatSystem.spawnDelayedTraitBomb({
      position: startPosition.clone(),
      timer: 0.85,
      maxTimer: 0.85,
      radius: 85 + bombRank * 18,
      damage: baseDmg,
      inheritedTags,
      sourceWeaponId: primaryWeapon ? primaryWeapon.id : 'dash_bomb'
    });
  }

  /**
   * 节点 5：当玩家受到伤害时触发 (OnDamaged)
   * 荆棘极寒新星反击 (armor / aegis_retaliation)
   */
  public emitOnDamaged(ctx: DamagedEventContext): void {
    const { player, combatSystem } = ctx;
    const aegisRank = player.getPassiveLevel('armor');
    if (aegisRank <= 0) return;

    const novaRadius = 150 + aegisRank * 25;
    const novaDamage = Math.round((35 + player.level * 6) * (1 + aegisRank * 0.3));
    combatSystem.freezeEnemies(1.8 + aegisRank * 0.4);
    combatSystem.particleSystem.emitHit(player.position.x, player.position.y, '#38bdf8', 18);

    const nearby = combatSystem.spatialGrid.queryRadius(player.position, novaRadius);
    for (const e of nearby) {
      if (!e.active) continue;
      const pushDir = e.position.clone().sub(player.position);
      e.applyKnockback(pushDir, 340);
      const killed = e.takeDamage(novaDamage);
      combatSystem.damageTextSystem.addDamage(e.position.x, e.position.y, novaDamage, true);
      if (killed) {
        player.kills++;
        combatSystem.handleEnemyDeath(e);
      }
    }
  }
}
