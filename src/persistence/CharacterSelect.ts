import { SkillTag } from '../systems/BuildSystem';

export interface CharacterBranch {
  id: string;
  nameZh: string;
  nameEn: string;
  badgeZh: string;
  badgeEn: string;
  roleSummaryZh: string;
  roleSummaryEn: string;
  ultNameZh: string;
  ultNameEn: string;
  ultDescZh: string;
  ultDescEn: string;
  color: string;
  recommendedTags: SkillTag[];
}

export interface CharacterInfo {
  id: string;
  name: string;
  title: string;
  shortRoleZh: string;
  shortRoleEn: string;
  startingWeapon: string;
  ultimateName: string;
  ultimateDescription: string;
  traitDescription: string;
  unlockRequirement: string;
  applyTraits: (player: any) => void;
  color: string;
  branches: [CharacterBranch, CharacterBranch];
}

export const CHARACTERS: CharacterInfo[] = [
  {
    id: 'antonio',
    name: 'Antonio',
    title: 'The Belpaese Blade',
    shortRoleZh: '近战吸血',
    shortRoleEn: 'Melee Leech',
    startingWeapon: 'whip',
    ultimateName: 'CRIMSON CROSS',
    ultimateDescription: 'Unleashes a giant Sacred Crusader Cross Slash across the arena + heals 25% HP.',
    traitDescription: '+10% Max HP, +1 Armor | Ult: Crimson Cross',
    unlockRequirement: 'Unlocked by default',
    color: '#ef4444',
    applyTraits: (player) => {
      player.baseMaxHp = 115;
      player.armor = 1;
      player.recalculateStats();
    },
    branches: [
      {
        id: 'antonio_berserker',
        nameZh: '猩红狂战士',
        nameEn: 'Crimson Berserker',
        badgeZh: '狂战 · 吸血暴走',
        badgeEn: 'Berserk · Blood Burst',
        roleSummaryZh: '血越少攻速越快，近战附带血爆与击杀回血',
        roleSummaryEn: 'Lower HP grants faster attacks, blood bursts & heal on kill',
        ultNameZh: '血海狂岚',
        ultNameEn: 'BLOODSTORM CLEAVE',
        ultDescZh: '爆发超大范围吸血血爆并回复 40% 生命',
        ultDescEn: 'Massive crimson shockwave + heals 40% Max HP',
        color: '#dc2626',
        recommendedTags: [SkillTag.MELEE, SkillTag.OVERLOAD]
      },
      {
        id: 'antonio_arbiter',
        nameZh: '圣光裁决者',
        nameEn: 'Light Arbiter',
        badgeZh: '裁决 · 弹反反击',
        badgeEn: 'Arbiter · Holy Parry',
        roleSummaryZh: '护甲 +2，剑气弹反弹幕回血并射出追踪圣剑',
        roleSummaryEn: '+2 Armor; parrying bullets heals & fires homing holy swords',
        ultNameZh: '神圣庇护所',
        ultNameEn: 'SANCTUARY AEGIS',
        ultDescZh: '2.5秒无敌圣盾 + 向四周射出 12 把黄金圣剑',
        ultDescEn: '2.5s Invulnerability + 12 Sacred Heaven Swords',
        color: '#fbbf24',
        recommendedTags: [SkillTag.MELEE, SkillTag.SUMMON]
      }
    ]
  },
  {
    id: 'imelda',
    name: 'Imelda',
    title: 'The Arcane Scholar',
    shortRoleZh: '奥术追踪',
    shortRoleEn: 'Homing Magic',
    startingWeapon: 'magic_wand',
    ultimateName: 'STARFALL PENTAGRAM',
    ultimateDescription: 'Summons an Arcane Pentagram & 24 homing star comets + freezes foes 3s.',
    traitDescription: '+25% XP, +5% Speed | Ult: Starfall Pentagram',
    unlockRequirement: 'Unlocked by default',
    color: '#a855f7',
    applyTraits: (player) => {
      player.xpMult = 1.25;
      player.baseSpeed = 200;
      player.recalculateStats();
    },
    branches: [
      {
        id: 'imelda_frost',
        nameZh: '永冻星灵',
        nameEn: 'Permafrost Astral',
        badgeZh: '冰霜 · 冻结碎裂',
        badgeEn: 'Frost · Shatter',
        roleSummaryZh: '法术概率冻结敌人，击杀冰冻目标碎裂出追踪冰晶',
        roleSummaryEn: 'Spells chill/freeze foes; frozen kills shatter into ice shards',
        ultNameZh: '绝对零度',
        ultNameEn: 'ABSOLUTE ZERO',
        ultDescZh: '全屏冻结 4.5 秒并释放 24 枚追踪冰霜陨星',
        ultDescEn: 'Freezes all foes 4.5s + 24 homing frost comets',
        color: '#38bdf8',
        recommendedTags: [SkillTag.PROJECTILE, SkillTag.SINGULARITY]
      },
      {
        id: 'imelda_storm',
        nameZh: '棱镜雷霆',
        nameEn: 'Prismatic Storm',
        badgeZh: '雷电 · 连锁弹射',
        badgeEn: 'Storm · Chain Arc',
        roleSummaryZh: '攻击触发连锁天雷电弧，清怪效率随怪群翻倍',
        roleSummaryEn: 'Hits arc chain lightning across nearby enemies',
        ultNameZh: '天罚矩阵',
        ultNameEn: 'PRISMATIC THUNDER',
        ultDescZh: '降下 18 道天雷并射出 12 道全屏弹射棱镜激光',
        ultDescEn: '18 sky thunderbolts + 12 ricochet prism lasers',
        color: '#facc15',
        recommendedTags: [SkillTag.CHAIN, SkillTag.OVERLOAD]
      }
    ]
  },
  {
    id: 'gennaro',
    name: 'Gennaro',
    title: 'The Dual Shadow',
    shortRoleZh: '高速影刃',
    shortRoleEn: 'Rapid Blades',
    startingWeapon: 'knife',
    ultimateName: 'PHANTOM BLADESTORM',
    ultimateDescription: 'Spiral barrage of 36 piercing shadow daggers + resets Dash cooldown.',
    traitDescription: '+1 Projectile | Ult: Phantom Bladestorm',
    unlockRequirement: 'Unlocked by default',
    color: '#10b981',
    applyTraits: (player) => {
      player.projectileCountBonus += 1;
      player.baseSpeed = 205;
      player.recalculateStats();
    },
    branches: [
      {
        id: 'gennaro_phantom',
        nameZh: '千刃幻影',
        nameEn: 'Thousand Phantoms',
        badgeZh: '幻影 · 冲刺分身',
        badgeEn: 'Phantom · Clones',
        roleSummaryZh: '冲刺冷却大幅缩短并在原地留下自动射刀的暗影分身',
        roleSummaryEn: 'Faster Dash leaves shadow clones that fire daggers',
        ultNameZh: '无限刃雨',
        ultNameEn: 'INFINITE BLADES',
        ultDescZh: '重置冲刺并向四周狂飙 40 把穿透影刃风暴',
        ultDescEn: 'Resets Dash + 40 piercing shadow daggers',
        color: '#34d399',
        recommendedTags: [SkillTag.DASH, SkillTag.PROJECTILE]
      },
      {
        id: 'gennaro_executioner',
        nameZh: '暗影处决者',
        nameEn: 'Shadow Executioner',
        badgeZh: '处决 · 叠层爆破',
        badgeEn: 'Execute · Crit Mark',
        roleSummaryZh: '暴击率 +25%，连续命中同一目标 5 次触发高额处决斩杀',
        roleSummaryEn: '+25% Crit; every 5th hit on a foe triggers heavy execution',
        ultNameZh: '瞬影处决',
        ultNameEn: 'PHANTOM EXECUTE',
        ultDescZh: '对视野内首领与精英目标造成多段高额暴击斩杀',
        ultDescEn: 'Multi-hit critical execution barrage on priority targets',
        color: '#a3e635',
        recommendedTags: [SkillTag.PROJECTILE, SkillTag.MELEE]
      }
    ]
  },
  {
    id: 'arca',
    name: 'Arca',
    title: 'The Crimson Warlock',
    shortRoleZh: '爆破轰炸',
    shortRoleEn: 'Blast & Summon',
    startingWeapon: 'fire_wand',
    ultimateName: 'HELLFIRE CATACLYSM',
    ultimateDescription: 'Calls down 12 solar meteors & infernal magma pools that ignite all foes.',
    traitDescription: '-15% Cooldown, +15% Area | Ult: Hellfire Cataclysm',
    unlockRequirement: 'Unlocked by default',
    color: '#f97316',
    applyTraits: (player) => {
      player.cooldownMult *= 0.85;
      player.areaMult *= 1.15;
      player.recalculateStats();
    },
    branches: [
      {
        id: 'arca_pyro',
        nameZh: '末日爆破狂',
        nameEn: 'Doomsday Pyromancer',
        badgeZh: '爆破 · 熔岩火海',
        badgeEn: 'Pyro · Magma Sea',
        roleSummaryZh: '攻击范围 +35%，命中概率在地面留下持续灼烧的熔岩池',
        roleSummaryEn: '+35% Area; blasts spawn lingering burning magma pools',
        ultNameZh: '太阳陨石雨',
        ultNameEn: 'SOLAR CATACLYSM',
        ultDescZh: '召唤 10 处持久熔岩火海与 16 颗毁灭太阳火球',
        ultDescEn: '10 lingering magma pools + 16 solar meteors',
        color: '#fb923c',
        recommendedTags: [SkillTag.FIRE, SkillTag.OVERLOAD]
      },
      {
        id: 'arca_necro',
        nameZh: '深渊死灵师',
        nameEn: 'Abyssal Necromancer',
        badgeZh: '死灵 · 镰刀收割',
        badgeEn: 'Necro · Soul Scythe',
        roleSummaryZh: '击杀敌人概率唤出自动追踪的死神飞镰为你收割战场',
        roleSummaryEn: 'Kills summon homing Grim Reaper Scythes to reap foes',
        ultNameZh: '亡灵天灾',
        ultNameEn: 'DEATH HARVEST',
        ultDescZh: '抛出 16 把巨型死神镰刀收割全场并回复 25 生命',
        ultDescEn: 'Hurls 16 colossal Grim Scythes + heals 25 HP',
        color: '#c084fc',
        recommendedTags: [SkillTag.SUMMON, SkillTag.OVERLOAD]
      }
    ]
  }
];

export function getCharacterById(id: string): CharacterInfo {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

export function getBranchById(charId: string, branchId: string | null): CharacterBranch | null {
  if (!branchId) return null;
  const char = getCharacterById(charId);
  return char.branches.find(b => b.id === branchId) || null;
}
