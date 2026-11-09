import { BuildEventType, SkillTag } from '../systems/BuildSystem';

export interface PassiveDefinition {
  id: string;
  name: string;
  description: string;
  iconName: string;
  maxLevel: number;
  tags: SkillTag[];
  triggerHook: BuildEventType;
  perLevelDescription: string[];
}

/**
 * 机制改变与多维标签联动遗物注册表 (Mechanic Modifier & Tag Synergy Relics)
 * 已彻底移除旧版单纯增加面板数值的无聊词条，全面替换为事件驱动+标签联动的机制改变型词条！
 * 同时保留原 ID 以完美兼容全部 11 把武器的神话超武进化配方。
 */
export const PASSIVE_DEFINITIONS: Record<string, PassiveDefinition> = {
  spinach: {
    id: 'spinach',
    name: '棱镜折射',
    description: "三发散射：主弹60%伤害，侧弹较弱，射程缩短32%",
    iconName: 'spinach',
    maxLevel: 5,
    tags: [SkillTag.PROJECTILE, SkillTag.CHAIN],
    triggerHook: BuildEventType.ON_SHOOT,
    perLevelDescription: [
      "侧弹伤害 20.5% · 触墙反弹 1 次",
      "侧弹伤害 23% · 触墙反弹 1 次",
      "侧弹伤害 25.5% · 触墙反弹 2 次",
      "侧弹伤害 28% · 触墙反弹 2 次",
      "侧弹伤害 30.5% · 触墙反弹 3 次"
    ]
  },

  wings: {
    id: 'wings',
    name: '跃迁余烬',
    description: "冲刺留下较小晶核，继承主武器标签；每级冲刺冷却减少3%",
    iconName: 'wings',
    maxLevel: 5,
    tags: [SkillTag.DASH, SkillTag.OVERLOAD, SkillTag.PROJECTILE],
    triggerHook: BuildEventType.ON_DODGE,
    perLevelDescription: [
      "晶核伤害 110% · 半径 70 · 冲刺冷却 -3%",
      "晶核伤害 130% · 半径 80 · 冲刺冷却 -6%",
      "晶核伤害 150% · 半径 90 · 冲刺冷却 -9%",
      "晶核伤害 170% · 半径 100 · 冲刺冷却 -12%",
      "晶核伤害 190% · 半径 110 · 冲刺冷却 -15%"
    ]
  },

  clover: {
    id: 'clover',
    name: '湮灭律令',
    description: "移除随机暴击，每第4次攻击转为穿透奇点，降低增伤与聚怪范围",
    iconName: 'clover',
    maxLevel: 5,
    tags: [SkillTag.SINGULARITY, SkillTag.OVERLOAD],
    triggerHook: BuildEventType.ON_SHOOT,
    perLevelDescription: [
      "第4击伤害倍率 1.10 · 聚怪半径 112 · 溅射15%",
      "第4击伤害倍率 1.15 · 聚怪半径 124 · 溅射15%",
      "第4击伤害倍率 1.20 · 聚怪半径 136 · 溅射15%",
      "第4击伤害倍率 1.25 · 聚怪半径 148 · 溅射15%",
      "第4击伤害倍率 1.30 · 聚怪半径 160 · 溅射15%"
    ]
  },

  empty_tome: {
    id: 'empty_tome',
    name: '炎爆烙印',
    description: "投射物首次命中触发小范围炎爆，附加2秒灼烧",
    iconName: 'empty_tome',
    maxLevel: 5,
    tags: [SkillTag.PROJECTILE, SkillTag.FIRE, SkillTag.OVERLOAD],
    triggerHook: BuildEventType.ON_HIT,
    perLevelDescription: [
      "炎爆伤害 16% · 半径 41 · 灼烧2秒",
      "炎爆伤害 20% · 半径 46 · 灼烧2秒",
      "炎爆伤害 24% · 半径 51 · 灼烧2秒",
      "炎爆伤害 28% · 半径 56 · 灼烧2秒",
      "炎爆伤害 32% · 半径 61 · 灼烧2秒"
    ]
  },

  duplicator: {
    id: 'duplicator',
    name: '幻影剑气',
    description: "近战附加一道低伤害剑气，降低穿透数量",
    iconName: 'duplicator',
    maxLevel: 3,
    tags: [SkillTag.MELEE, SkillTag.PROJECTILE],
    triggerHook: BuildEventType.ON_SHOOT,
    perLevelDescription: [
      "剑气伤害 32% · 穿透 1",
      "剑气伤害 39% · 穿透 2",
      "剑气伤害 46% · 穿透 2"
    ]
  },

  attractorb: {
    id: 'attractorb',
    name: '电弧导管',
    description: "连锁或过载命中弹射较弱电弧，感电持续2秒",
    iconName: 'attractorb',
    maxLevel: 5,
    tags: [SkillTag.CHAIN, SkillTag.OVERLOAD],
    triggerHook: BuildEventType.ON_HIT,
    perLevelDescription: [
      "电弧伤害 15.5% · 最多 1 个额外目标 · 拾取范围 +10%",
      "电弧伤害 19% · 最多 1 个额外目标 · 拾取范围 +20%",
      "电弧伤害 22.5% · 最多 2 个额外目标 · 拾取范围 +30%",
      "电弧伤害 26% · 最多 2 个额外目标 · 拾取范围 +40%",
      "电弧伤害 29.5% · 最多 3 个额外目标 · 拾取范围 +50%"
    ]
  },

  hollow_heart: {
    id: 'hollow_heart',
    name: '缚魂灵瓮',
    description: "累积击杀生成较弱缚魂弹，每级生命上限增加5",
    iconName: 'hollow_heart',
    maxLevel: 5,
    tags: [SkillTag.SUMMON, SkillTag.PROJECTILE],
    triggerHook: BuildEventType.ON_KILL,
    perLevelDescription: [
      "每击杀 10 名敌人生成缚魂弹 · 生命上限 +5 · 穿透 1",
      "每击杀 9 名敌人生成缚魂弹 · 生命上限 +10 · 穿透 2",
      "每击杀 8 名敌人生成缚魂弹 · 生命上限 +15 · 穿透 2",
      "每击杀 7 名敌人生成缚魂弹 · 生命上限 +20 · 穿透 3",
      "每击杀 6 名敌人生成缚魂弹 · 生命上限 +25 · 穿透 3"
    ]
  },

  crown: {
    id: 'crown',
    name: '链式殉爆',
    description: "仅灼烧或感电敌人阵亡时，概率触发小范围殉爆",
    iconName: 'crown',
    maxLevel: 5,
    tags: [SkillTag.OVERLOAD, SkillTag.FIRE],
    triggerHook: BuildEventType.ON_KILL,
    perLevelDescription: [
      "异常敌人阵亡殉爆概率 30% · 半径 46",
      "异常敌人阵亡殉爆概率 35% · 半径 52",
      "异常敌人阵亡殉爆概率 40% · 半径 58",
      "异常敌人阵亡殉爆概率 45% · 半径 64",
      "异常敌人阵亡殉爆概率 50% · 半径 70"
    ]
  },

  pummarola: {
    id: 'pummarola',
    name: '鲜血圣杯',
    description: "近战与召唤附加2秒流血，低概率恢复1点生命",
    iconName: 'pummarola',
    maxLevel: 5,
    tags: [SkillTag.MELEE, SkillTag.SUMMON],
    triggerHook: BuildEventType.ON_HIT,
    perLevelDescription: [
      "汲取概率 8% · 每次恢复1点生命 · 流血2秒",
      "汲取概率 10% · 每次恢复1点生命 · 流血2秒",
      "汲取概率 12% · 每次恢复1点生命 · 流血2秒",
      "汲取概率 14% · 每次恢复1点生命 · 流血2秒",
      "汲取概率 16% · 每次恢复1点生命 · 流血2秒"
    ]
  },

  armor: {
    id: 'armor',
    name: '逆鳞寒霜',
    description: "受击触发较弱寒霜新星与短暂冻结，每两级增加1护甲",
    iconName: 'armor',
    maxLevel: 5,
    tags: [SkillTag.OVERLOAD, SkillTag.SINGULARITY],
    triggerHook: BuildEventType.ON_DAMAGED,
    perLevelDescription: [
      "新星半径 110 · 冻结 0.75 秒 · 护甲 +0",
      "新星半径 125 · 冻结 0.90 秒 · 护甲 +1",
      "新星半径 140 · 冻结 1.05 秒 · 护甲 +1",
      "新星半径 155 · 冻结 1.20 秒 · 护甲 +2",
      "新星半径 170 · 冻结 1.35 秒 · 护甲 +2"
    ]
  }
};
