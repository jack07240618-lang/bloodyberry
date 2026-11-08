import { Vector2 } from '../core/Vector2';
import { Player } from '../entities/Player';
import { CombatSystem } from './CombatSystem';
import { Projectile, ProjectileType } from '../weapons/Projectile';
import { PASSIVE_DEFINITIONS } from '../passives/PassiveRegistry';
import { SkillTag, TAG_METADATA } from './BuildSystem';

export type CompanionMode = 'ORBIT' | 'ANCHOR';

export interface ActiveTagBond {
  tag: SkillTag;
  count: number;
  tier: 0 | 1 | 2; // 0: 未激活, 1: 2件套初级共鸣, 2: 4件套高阶共鸣
  title: string;
  effectText: string;
  color: string;
}

/**
 * 《相依肉鸽》核心系统：双生灵魂伙伴 + 灵能相依连线 (Soul Tether) + 多维标签共鸣羁绊 (Tag Bonds)
 */
export class CompanionSystem {
  public position: Vector2 = new Vector2(60, 0);
  public mode: CompanionMode = 'ORBIT';
  public orbitAngle = 0;
  public radius = 13;

  // 连线切割与协同射击计时器
  private tetherTickTimer = 0;
  private attackTimer = 0;
  private syncedVolleyTimer = 0;
  private pulseTime = 0;

  // 当前激活的多维标签共鸣羁绊列表
  public activeBonds: ActiveTagBond[] = [];
  public tagCounts: Map<SkillTag, number> = new Map();

  public reset(playerPos: Vector2): void {
    this.position.set(playerPos.x + 64, playerPos.y);
    this.mode = 'ORBIT';
    this.orbitAngle = 0;
    this.tetherTickTimer = 0;
    this.attackTimer = 0.5;
    this.syncedVolleyTimer = 3.0;
    this.activeBonds = [];
    this.tagCounts.clear();
  }

  /**
   * 切换伙伴姿态：[ORBIT 环绕共生] <-> [ANCHOR 定点锚定拉线]
   */
  public toggleMode(player: Player, combatSystem: CombatSystem): void {
    if (this.mode === 'ORBIT') {
      this.mode = 'ANCHOR';
      combatSystem.particleSystem.emitHit(this.position.x, this.position.y, '#67e8f9', 10);
    } else {
      this.mode = 'ORBIT';
      combatSystem.particleSystem.emitHit(player.position.x, player.position.y, '#34d399', 10);
    }
  }

  /**
   * 统计玩家当前所有武器 + 机制遗物的多维标签数量，并计算激活的【相依标签羁绊】
   */
  public recalculateTagBonds(player: Player): void {
    this.tagCounts.clear();

    for (const w of player.weapons) {
      for (const t of w.tags) {
        this.tagCounts.set(t, (this.tagCounts.get(t) || 0) + 1);
      }
    }

    for (const [pid, lvl] of player.passives.entries()) {
      const def = PASSIVE_DEFINITIONS[pid];
      if (def && lvl > 0) {
        for (const t of def.tags) {
          this.tagCounts.set(t, (this.tagCounts.get(t) || 0) + 1);
        }
      }
    }

    const bonds: ActiveTagBond[] = [];
    const definitions: { tag: SkillTag; title: string; tier1Desc: string; tier2Desc: string }[] = [
      {
        tag: SkillTag.PROJECTILE,
        title: '双子穿云共鸣',
        tier1Desc: '(2) 伙伴攻速+35%且弹幕反弹',
        tier2Desc: '(4) 每3秒同步倾泻双子扇形齐射'
      },
      {
        tag: SkillTag.FIRE,
        title: '赤焰锁链共鸣',
        tier1Desc: '(2) 相依连线化为火链点燃敌人',
        tier2Desc: '(4) 連线切割引发烈焰新星爆燃'
      },
      {
        tag: SkillTag.CHAIN,
        title: '超导雷网共鸣',
        tier1Desc: '(2) 相依连线释放高压连锁电弧',
        tier2Desc: '(4) 连线触敌触发全房跳跃雷暴'
      },
      {
        tag: SkillTag.OVERLOAD,
        title: '双星过载共鸣',
        tier1Desc: '(2) 相依连线张力伤害提升45%',
        tier2Desc: '(4) 伙伴位置周期性引发镜像过载爆炸'
      },
      {
        tag: SkillTag.MELEE,
        title: '血脉绞杀共鸣',
        tier1Desc: '(2) 伙伴展开近战剑刃旋风领域',
        tier2Desc: '(4) 连线切割敌人时按比例恢复生命'
      },
      {
        tag: SkillTag.SUMMON,
        title: '万灵统御共鸣',
        tier1Desc: '(2) 伙伴协同发射追踪噬魂弹',
        tier2Desc: '(4) 锚定状态下伙伴化为双倍速炮台'
      }
    ];

    for (const d of definitions) {
      const count = this.tagCounts.get(d.tag) || 0;
      if (count >= 2) {
        const tier: 1 | 2 = count >= 4 ? 2 : 1;
        bonds.push({
          tag: d.tag,
          count,
          tier,
          title: d.title,
          effectText: tier === 2 ? d.tier2Desc : d.tier1Desc,
          color: TAG_METADATA[d.tag].color
        });
      }
    }

    this.activeBonds = bonds;
  }

  public getBondTier(tag: SkillTag): 0 | 1 | 2 {
    const count = this.tagCounts.get(tag) || 0;
    return count >= 4 ? 2 : count >= 2 ? 1 : 0;
  }

  public update(dt: number, player: Player, combatSystem: CombatSystem): void {
    this.pulseTime += dt * 4;
    this.recalculateTagBonds(player);

    // 1. 更新伙伴位置（环绕共生 vs 定点锚定）
    if (this.mode === 'ORBIT') {
      this.orbitAngle += dt * 2.6;
      const orbitR = 68;
      const targetX = player.position.x + Math.cos(this.orbitAngle) * orbitR;
      const targetY = player.position.y + Math.sin(this.orbitAngle) * orbitR;
      this.position.x += (targetX - this.position.x) * Math.min(1, dt * 12);
      this.position.y += (targetY - this.position.y) * Math.min(1, dt * 12);
    } else {
      // 定点锚定模式下，若玩家与伙伴距离超过 560（超出最大张力极限），自动弹性牵引防断连
      const dist = this.position.distanceTo(player.position);
      if (dist > 540) {
        const pullDir = player.position.clone().sub(this.position).normalize();
        this.position.addScaled(pullDir, (dist - 540));
      }
    }

    // 在没有敌人时不发起攻击或触发连线爆炸
    if (!combatSystem.hasActiveEnemies()) {
      this.attackTimer = 0.25;
      return;
    }

    // 2. 【相依灵能连线切割判定 (Soul Tether Line-Segment Collision)】
    this.tetherTickTimer -= dt;
    if (this.tetherTickTimer <= 0) {
      this.tetherTickTimer = 0.36;
      this.resolveTetherLineDamage(player, combatSystem);
    }

    // 3. 【伙伴协同射击（继承主武器全部标签）】
    const projBondTier = this.getBondTier(SkillTag.PROJECTILE);
    const summonBondTier = this.getBondTier(SkillTag.SUMMON);
    const anchorSpeedBoost = (this.mode === 'ANCHOR' && summonBondTier >= 2) ? 0.65 : 1.0;
    const baseInterval = (projBondTier >= 1 ? 0.85 : 1.2) * anchorSpeedBoost;

    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = baseInterval;
      this.fireCompanionShot(player, combatSystem);
    }

    // 4. 【4阶 [投射物] 或 [过载] 共鸣大招触发】
    if (projBondTier >= 2 || this.getBondTier(SkillTag.OVERLOAD) >= 2) {
      this.syncedVolleyTimer -= dt;
      if (this.syncedVolleyTimer <= 0) {
        this.syncedVolleyTimer = 4.2;
        this.triggerBondResonanceBurst(player, combatSystem);
      }
    }
  }

  /**
   * 计算玩家与伙伴之间的【相依连线】线段，对所有触碰连线的敌人造成张力切割与元素共鸣伤害
   */
  private resolveTetherLineDamage(player: Player, combatSystem: CombatSystem): void {
    const p1 = player.position;
    const p2 = this.position;
    const tetherLen = p1.distanceTo(p2);
    if (tetherLen < 5) return;

    // 连线拉得越长（尤其在 ANCHOR 定点模式下），张力倍率越高（最高 1.85 倍）
    const tensionMult = 1.0 + Math.min(0.85, (tetherLen / 380) * 0.85);
    const overloadTier = this.getBondTier(SkillTag.OVERLOAD);
    const fireTier = this.getBondTier(SkillTag.FIRE);
    const chainTier = this.getBondTier(SkillTag.CHAIN);
    const meleeTier = this.getBondTier(SkillTag.MELEE);

    const baseDmg = Math.round(
      (6 + player.level * 1.4) *
      player.damageMult *
      tensionMult *
      (overloadTier >= 1 ? 1.28 : 1.0)
    );

    const primaryWeapon = player.weapons[0];
    const mainTags = primaryWeapon ? primaryWeapon.tags : [SkillTag.PROJECTILE];

    for (const enemy of combatSystem.enemies) {
      if (!enemy.active) continue;

      // 计算敌人圆心到线段 p1-p2 的最短距离
      const distToSegment = this.pointToSegmentDistance(enemy.position, p1, p2);
      const hitThreshold = enemy.radius + 10;

      // 1. 连线切割命中
      const hitByTether = distToSegment <= hitThreshold;
      // 2. 若激活 [近战] 2件套共鸣，伙伴自身周围 80 半径还会形成刀刃旋风领域
      const hitByCompanionAura = meleeTier >= 1 && enemy.position.distanceTo(p2) <= enemy.radius + 75;

      if (hitByTether || hitByCompanionAura) {
        if (fireTier >= 1 || mainTags.includes(SkillTag.FIRE)) {
          enemy.burnTimer = 3.5;
        }
        if (chainTier >= 1 || mainTags.includes(SkillTag.CHAIN)) {
          enemy.shockTimer = 3.5;
        }
        if (meleeTier >= 1 || mainTags.includes(SkillTag.MELEE)) {
          enemy.bleedTimer = 3.5;
        }

        const killed = enemy.takeDamage(baseDmg);
        combatSystem.damageTextSystem.addDamage(enemy.position.x, enemy.position.y, baseDmg, tensionMult > 1.5);
        combatSystem.particleSystem.emitHit(enemy.position.x, enemy.position.y, '#67e8f9', 2);

        // [连锁] 共鸣：连线触敌释放跳跃闪电
        if (chainTier >= 1 && Math.random() < (chainTier >= 2 ? 0.55 : 0.28)) {
          combatSystem.spawnLightningVisual(enemy.position, 32, chainTier >= 2);
        }

        // [火焰] 4阶共鸣：连线切割引发爆燃
        if (fireTier >= 2 && Math.random() < 0.3) {
          combatSystem.triggerElementalOverload(enemy.position, baseDmg * 1.2);
        }

        // [近战] 4阶共鸣：连线切割生命汲取
        if (meleeTier >= 2 && Math.random() < 0.18) {
          player.heal(1);
        }

        if (killed) {
          player.kills++;
          combatSystem.handleEnemyDeath(enemy);
        }
      }
    }
  }

  private fireCompanionShot(player: Player, combatSystem: CombatSystem): void {
    const targets = combatSystem.getNearestEnemies(this.position, 520, 1);
    if (targets.length === 0) return;

    const target = targets[0];
    const dir = target.position.clone().sub(this.position).normalize();
    const mainWep = player.weapons[0];
    const dmg = Math.round((mainWep ? mainWep.damage * 0.65 : 12) * player.damageMult);

    const proj = new Projectile(
      ProjectileType.DIRECT_BOLT,
      mainWep ? mainWep.id : 'magic_wand',
      this.position.x,
      this.position.y,
      7,
      dmg,
      2,
      1.6
    );
    proj.velocity.copy(dir).multiplyScalar(480);
    proj.color = '#67e8f9';
    proj.glowColor = '#38bdf8';

    // 伙伴子弹完全继承主武器标签 + [召唤] 标签
    if (mainWep) {
      mainWep.tags.forEach(t => proj.tags.add(t));
    }
    proj.tags.add(SkillTag.SUMMON);
    proj.tags.add(SkillTag.PROJECTILE);

    if (this.getBondTier(SkillTag.PROJECTILE) >= 1) {
      proj.wallBounces = Math.max(proj.wallBounces, 1);
    }

    combatSystem.addProjectile(proj);
  }

  private triggerBondResonanceBurst(player: Player, combatSystem: CombatSystem): void {
    // 4阶 [投射物] 双子扇形齐射
    if (this.getBondTier(SkillTag.PROJECTILE) >= 2) {
      const target = combatSystem.getNearestEnemies(this.position, 550, 1)[0];
      const baseAngle = target
        ? target.position.clone().sub(this.position).angle()
        : this.orbitAngle;

      for (let i = -2; i <= 2; i++) {
        const ang = baseAngle + i * 0.18;
        const p = new Projectile(
          ProjectileType.PIERCING_DAGGER,
          'companion_volley',
          this.position.x,
          this.position.y,
          8,
          Math.round((18 + player.level * 3) * player.damageMult),
          3,
          1.4
        );
        p.isDecoratedClone = true;
        p.velocity.set(Math.cos(ang) * 540, Math.sin(ang) * 540);
        p.color = '#38bdf8';
        p.glowColor = '#67e8f9';
        p.wallBounces = 1;
        p.tags.add(SkillTag.PROJECTILE);
        p.tags.add(SkillTag.SUMMON);
        combatSystem.projectiles.push(p);
      }
    }

    // 4阶 [过载] 伙伴位置镜像过载震爆
    if (this.getBondTier(SkillTag.OVERLOAD) >= 2) {
      combatSystem.triggerElementalOverload(this.position, (24 + player.level * 4) * player.damageMult);
    }
  }

  private pointToSegmentDistance(p: Vector2, a: Vector2, b: Vector2): number {
    const abX = b.x - a.x;
    const abY = b.y - a.y;
    const lenSq = abX * abX + abY * abY;
    if (lenSq < 0.0001) return p.distanceTo(a);

    let t = ((p.x - a.x) * abX + (p.y - a.y) * abY) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * abX;
    const projY = a.y + t * abY;
    return Math.hypot(p.x - projX, p.y - projY);
  }

  /**
   * 渲染哥特圣物风格的相依灵能锁链 (Gothic Soul Tether) 与六翼圣火提灯伙伴 (Seraphic Reliquary Thurible)
   */
  public render(ctx: CanvasRenderingContext2D, player: Player): void {
    const p1 = player.position;
    const p2 = this.position;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 确定连线主色调（根据最高阶共鸣标签动态变色）
    const fireTier = this.getBondTier(SkillTag.FIRE);
    const chainTier = this.getBondTier(SkillTag.CHAIN);
    const tetherColor = fireTier >= 1 ? '#fb923c' : chainTier >= 1 ? '#c084fc' : '#38bdf8';

    // 1. 绘制哥特相依灵能连线：外层圣光带 + 波动能量弦 + 鎏金锁链节点
    ctx.strokeStyle = tetherColor;
    ctx.lineWidth = this.mode === 'ANCHOR' ? 7 : 4.5;
    ctx.globalAlpha = 0.38;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // 正弦能量波纹弦线与链节菱形
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const steps = 14;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wave = Math.sin(t * Math.PI * 3 + this.pulseTime * 2.5) * Math.sin(t * Math.PI) * 6;
      const wx = p1.x + dx * t + nx * wave;
      const wy = p1.y + dy * t + ny * wave;
      if (i === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();

    // 连线上的哥特鎏金符文节点
    ctx.fillStyle = '#fbbf24';
    for (let k = 1; k < 4; k++) {
      const kt = ((k / 4) + (this.pulseTime * 0.15)) % 1;
      const kx = p1.x + dx * kt;
      const ky = p1.y + dy * kt;
      ctx.beginPath();
      ctx.arc(kx, ky, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. 若激活 [近战] 共鸣，绘制伙伴周围的旋转哥特剑刃法阵
    if (this.getBondTier(SkillTag.MELEE) >= 1) {
      ctx.save();
      ctx.translate(p2.x, p2.y);
      ctx.rotate(this.pulseTime);
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 3. 绘制六翼哥特圣物提灯伙伴本体 (Seraphic Astral Reliquary Lantern)
    ctx.translate(p2.x, p2.y);
    const bob = Math.sin(this.pulseTime * 1.5) * 3;
    const wingFlap = Math.sin(this.pulseTime * 3.2) * 0.25;

    if (this.mode === 'ANCHOR') {
      // 定点锚定哥特八芒星法阵
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 24 + Math.sin(this.pulseTime * 2) * 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 灵魂核心光晕
    const aura = ctx.createRadialGradient(0, bob, 2, 0, bob, 26);
    aura.addColorStop(0, '#ffffff');
    aura.addColorStop(0.4, tetherColor);
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, bob, 26, 0, Math.PI * 2);
    ctx.fill();

    // 左右拍动的鎏金圣翼 (Golden Seraph Wings)
    ctx.fillStyle = '#fde047';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(wingFlap);
      ctx.beginPath();
      ctx.moveTo(4, bob - 2);
      ctx.quadraticCurveTo(15, bob - 12, 18, bob - 4);
      ctx.quadraticCurveTo(13, bob + 2, 4, bob + 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 哥特黄铜提灯外框与炽白圣火核心
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -12 + bob);
    ctx.lineTo(9, bob);
    ctx.lineTo(0, 12 + bob);
    ctx.lineTo(-9, bob);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8 + bob);
    ctx.lineTo(6, bob);
    ctx.lineTo(0, 8 + bob);
    ctx.lineTo(-6, bob);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
