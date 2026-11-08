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
    description: '投射物变为 3 发扇形散射，射程缩短 30%，触墙可反弹',
    iconName: 'spinach',
    maxLevel: 5,
    tags: [SkillTag.PROJECTILE, SkillTag.CHAIN],
    triggerHook: BuildEventType.ON_SHOOT,
    perLevelDescription: [
      '投射物散射 3 发 · 射程 -30% · 触墙反弹 1 次',
      '散射伤害提升 · 触墙连续反弹 2 次',
      '散射伤害提升 · 触墙连续反弹 3 次',
      '散射伤害提升 · 触墙连续反弹 4 次',
      '全额散射伤害 · 触墙连续反弹 5 次'
    ]
  },

  wings: {
    id: 'wings',
    name: '跃迁余烬',
    description: '冲刺时在原地留下延迟晶核，继承主武器属性并引爆',
    iconName: 'wings',
    maxLevel: 5,
    tags: [SkillTag.DASH, SkillTag.OVERLOAD, SkillTag.PROJECTILE],
    triggerHook: BuildEventType.ON_DODGE,
    perLevelDescription: [
      '冲刺原地留下延迟晶核 · 继承主武器属性引爆',
      '晶核爆炸范围 +18 · 冲刺冷却加快',
      '晶核爆炸范围 +36 · 引爆时环状发射 8 枚弹体',
      '晶核爆炸范围 +54 · 引爆时附加持续火海与雷暴',
      '超大范围元素奇点引爆 · 全额触发命中特效'
    ]
  },

  clover: {
    id: 'clover',
    name: '湮灭律令',
    description: '移除暴击率，每第 4 次攻击转化为无限穿透的引力奇点',
    iconName: 'clover',
    maxLevel: 5,
    tags: [SkillTag.SINGULARITY, SkillTag.OVERLOAD],
    triggerHook: BuildEventType.ON_SHOOT,
    perLevelDescription: [
      '暴击率归零 · 每第 4 次攻击造成穿透伤害并聚拢敌人',
      '第 4 击引力半径扩大至 225 · 穿透伤害提升',
      '第 4 击引力半径扩大至 250 · 聚怪力度提升',
      '第 4 击引力半径扩大至 275 · 附加破甲震荡波',
      '每第 4 次攻击化为大范围引力深渊'
    ]
  },

  empty_tome: {
    id: 'empty_tome',
    name: '炎爆烙印',
    description: '投射物命中时引发范围烈焰爆炸并点燃目标',
    iconName: 'empty_tome',
    maxLevel: 5,
    tags: [SkillTag.PROJECTILE, SkillTag.FIRE, SkillTag.OVERLOAD],
    triggerHook: BuildEventType.ON_HIT,
    perLevelDescription: [
      '投射物命中触发范围炎爆 · 附加 4 秒灼烧',
      '炎爆半径扩大 · 爆炸伤害提升至 60%',
      '炎爆半径扩大 · 爆炸伤害提升至 75%',
      '炎爆半径扩大 · 爆炸伤害提升至 90%',
      '投射物命中引发连锁烈焰新星'
    ]
  },

  duplicator: {
    id: 'duplicator',
    name: '幻影剑气',
    description: '近战挥砍时额外发射穿透剑气，继承投射物联动',
    iconName: 'duplicator',
    maxLevel: 3,
    tags: [SkillTag.MELEE, SkillTag.PROJECTILE],
    triggerHook: BuildEventType.ON_SHOOT,
    perLevelDescription: [
      '近战攻击额外激发 1 道穿透剑气',
      '剑气穿透 +2 · 伤害提升 · 可触发反弹与炎爆',
      '近战挥砍激发巨型次元刃贯穿直线敌人'
    ]
  },

  attractorb: {
    id: 'attractorb',
    name: '电弧导管',
    description: '连锁或过载命中时弹射闪电链，遇火触发超载爆炸',
    iconName: 'attractorb',
    maxLevel: 5,
    tags: [SkillTag.CHAIN, SkillTag.OVERLOAD],
    triggerHook: BuildEventType.ON_HIT,
    perLevelDescription: [
      '命中弹射 2 道雷电链 · 遇火触发超载爆破',
      '弹射目标 +1 · 感电延长 · 牵引范围扩大',
      '弹射目标 +2 · 连锁电弧伤害提升',
      '弹射目标 +3 · 连锁电弧伤害大幅提升',
      '命中时在敌群间形成瞬发雷电网'
    ]
  },

  hollow_heart: {
    id: 'hollow_heart',
    name: '缚魂灵瓮',
    description: '击杀敌人时在原地生成追踪缚魂弹攻击周围目标',
    iconName: 'hollow_heart',
    maxLevel: 5,
    tags: [SkillTag.SUMMON, SkillTag.PROJECTILE],
    triggerHook: BuildEventType.ON_KILL,
    perLevelDescription: [
      '每击杀 5 名敌人生成追踪缚魂弹',
      '每击杀 4 名敌人生成缚魂弹 · 穿透 +1 · 生命上限提升',
      '每击杀 3 名敌人生成缚魂弹 · 伤害 +50%',
      '每击杀 2 名敌人生成缚魂弹 · 联动散射与炎爆',
      '每次击杀均释放高穿透缚魂弹幕'
    ]
  },

  crown: {
    id: 'crown',
    name: '链式殉爆',
    description: '处于灼烧或感电的敌人阵亡时引发范围殉爆',
    iconName: 'crown',
    maxLevel: 5,
    tags: [SkillTag.OVERLOAD, SkillTag.FIRE],
    triggerHook: BuildEventType.ON_KILL,
    perLevelDescription: [
      '异常状态敌人阵亡时 100% 引发范围殉爆',
      '殉爆半径扩大 · 普通敌人阵亡有 45% 概率殉爆',
      '殉爆伤害 +50% · 点燃波及目标',
      '殉爆半径大幅扩大 · 可连环引爆敌群',
      '阵亡目标引发全房连环超新星爆破'
    ]
  },

  pummarola: {
    id: 'pummarola',
    name: '鲜血圣杯',
    description: '近战与召唤命中时附加流血，并按概率汲取生命',
    iconName: 'pummarola',
    maxLevel: 5,
    tags: [SkillTag.MELEE, SkillTag.SUMMON],
    triggerHook: BuildEventType.ON_HIT,
    perLevelDescription: [
      '命中附加流血 · 28% 概率汲取恢复生命',
      '流血伤害提升 · 汲取概率提升至 34%',
      '每次触发鲜血汲取恢复 2 点生命',
      '汲取概率提升至 46% · 溢出治疗转化为护盾',
      '近战与召唤攻击化为持续吸血领域'
    ]
  },

  armor: {
    id: 'armor',
    name: '逆鳞寒霜',
    description: '受到伤害时爆发极寒新星，冻结并震退周围敌人',
    iconName: 'armor',
    maxLevel: 5,
    tags: [SkillTag.OVERLOAD, SkillTag.SINGULARITY],
    triggerHook: BuildEventType.ON_DAMAGED,
    perLevelDescription: [
      '受击爆发极寒新星 · 冻结敌人 2.2 秒并反击',
      '新星范围扩大 · 冻结 2.6 秒 · 护甲减伤 +1',
      '反击伤害 +60% · 冻结延长至 3.0 秒',
      '新星范围大幅扩大 · 冻结目标受重击伤害翻倍',
      '受击瞬间冰封全房并重置冲刺冷却'
    ]
  }
};
