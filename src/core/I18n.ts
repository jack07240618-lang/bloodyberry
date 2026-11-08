export type Language = 'zh' | 'en';

const LANG_STORAGE_KEY = 'bloodyberry_lang_v1';

class I18nManager {
  private currentLang: Language = 'zh';

  constructor() {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'zh' || saved === 'en') {
        this.currentLang = saved;
      }
    } catch {
      // Fallback to zh
    }
  }

  public get lang(): Language {
    return this.currentLang;
  }

  public setLanguage(lang: Language): void {
    this.currentLang = lang;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }
  }

  public toggleLanguage(): Language {
    const next: Language = this.currentLang === 'zh' ? 'en' : 'zh';
    this.setLanguage(next);
    return next;
  }

  public t(zh: string, en: string): string {
    return this.currentLang === 'zh' ? zh : en;
  }
}

export const i18n = new I18nManager();
export const t = (zh: string, en: string): string => i18n.t(zh, en);

// --- 角色双语字典 (Characters Localization) ---
export interface LocalizedCharacterText {
  name: string;
  title: string;
  traitDescription: string;
  ultimateName: string;
}

export const CHARACTER_I18N: Record<string, { zh: LocalizedCharacterText; en: LocalizedCharacterText }> = {
  antonio: {
    zh: {
      name: '安东尼奥',
      title: '圣堂剑卫',
      traitDescription: '生命上限 +10% · 护甲 +1 · 终极技：绯红十字斩',
      ultimateName: '绯红十字斩'
    },
    en: {
      name: 'Antonio',
      title: 'Sanctuary Blade',
      traitDescription: '+10% Max HP · +1 Armor · Ult: Crimson Cross',
      ultimateName: 'CRIMSON CROSS'
    }
  },
  imelda: {
    zh: {
      name: '伊梅尔达',
      title: '星秘学者',
      traitDescription: '经验获取 +25% · 移速 +5% · 终极技：星陨五芒星',
      ultimateName: '星陨五芒星'
    },
    en: {
      name: 'Imelda',
      title: 'Arcane Scholar',
      traitDescription: '+25% XP · +5% Speed · Ult: Starfall Pentagram',
      ultimateName: 'STARFALL PENTAGRAM'
    }
  },
  gennaro: {
    zh: {
      name: '杰纳罗',
      title: '双影刺客',
      traitDescription: '投射物数量 +1 · 终极技：幻影刃风暴',
      ultimateName: '幻影刃风暴'
    },
    en: {
      name: 'Gennaro',
      title: 'Dual Shadow',
      traitDescription: '+1 Projectile · Ult: Phantom Bladestorm',
      ultimateName: 'PHANTOM BLADESTORM'
    }
  },
  arca: {
    zh: {
      name: '阿尔卡',
      title: '赤焰术士',
      traitDescription: '冷却缩减 -15% · 范围 +15% · 终极技：炼狱天灾',
      ultimateName: '炼狱天灾'
    },
    en: {
      name: 'Arca',
      title: 'Crimson Warlock',
      traitDescription: '-15% Cooldown · +15% Area · Ult: Hellfire Cataclysm',
      ultimateName: 'HELLFIRE CATACLYSM'
    }
  },
  pasqualina: {
    zh: {
      name: '帕斯夸琳娜',
      title: '织雷使徒',
      traitDescription: '伤害 +20% · 暴击率 +15% · 终极技：棱光雷罚',
      ultimateName: '棱光雷罚'
    },
    en: {
      name: 'Pasqualina',
      title: 'Storm Weaver',
      traitDescription: '+20% DMG · +15% Crit · Ult: Prismatic Thunder',
      ultimateName: 'PRISMATIC THUNDER'
    }
  },
  mortaccio: {
    zh: {
      name: '莫塔乔',
      title: '骸骨死神',
      traitDescription: '投射物 +1 · 伤害 +20% · 终极技：死神收割',
      ultimateName: '死神收割'
    },
    en: {
      name: 'Mortaccio',
      title: 'Risen Scythe',
      traitDescription: '+1 Projectile · +20% DMG · Ult: Death Harvest',
      ultimateName: 'DEATH HARVEST'
    }
  }
};

export function getCharacterText(id: string): LocalizedCharacterText {
  const entry = CHARACTER_I18N[id];
  if (!entry) {
    return { name: id, title: '', traitDescription: '', ultimateName: '' };
  }
  return entry[i18n.lang];
}

// --- 武器双语字典 (Weapons Localization) ---
export interface LocalizedWeaponText {
  name: string;
  evolvedName: string;
  description: string;
  evolvedDescription: string;
  upgrades: Record<number, string>;
}

export const WEAPON_I18N: Record<string, { zh: LocalizedWeaponText; en: LocalizedWeaponText }> = {
  whip: {
    zh: {
      name: '斩月重剑',
      evolvedName: '泣血断罪刃',
      description: '向前方挥出半圆形横劈剑气，贯穿范围内敌人',
      evolvedDescription: '刀刀暴击并迸发绯红半月剑气，命中时汲取生命值',
      upgrades: {
        2: '基础伤害 +5 · 挥砍范围 +15%',
        3: '挥砍次数 +1（前后双向横劈）',
        4: '基础伤害 +8',
        5: '挥砍范围 +20% · 冷却 -15%',
        6: '基础伤害 +10',
        7: '挥砍次数 +1',
        8: '基础伤害 +15 · 挥砍范围 +25%'
      }
    },
    en: {
      name: 'Crescent Greatsword',
      evolvedName: 'Bloody Tear',
      description: 'Unleashes a semicircular horizontal sword cleave in front.',
      evolvedDescription: 'Deals guaranteed critical strikes and leeches health on impact.',
      upgrades: {
        2: 'Base Damage +5 · Area +15%',
        3: 'Strikes behind as well (+1 Strike)',
        4: 'Base Damage +8',
        5: 'Area +20% · Cooldown -15%',
        6: 'Base Damage +10',
        7: 'Strikes +1 additional time',
        8: 'Base Damage +15 · Area +25%'
      }
    }
  },
  magic_wand: {
    zh: {
      name: '奥术法杖',
      evolvedName: '神圣权杖',
      description: '向最近的敌人自动发射追踪奥术光弹',
      evolvedDescription: '无冷却高速连射神圣穿透光弹，持续压制敌群',
      upgrades: {
        2: '发射弹体数量 +1',
        3: '冷却时间 -20%',
        4: '发射弹体数量 +1',
        5: '基础伤害 +10 · 穿透 +1',
        6: '发射弹体数量 +1',
        7: '穿透 +1 · 弹速 +25%',
        8: '基础伤害 +15 · 冷却 -15%'
      }
    },
    en: {
      name: 'Magic Wand',
      evolvedName: 'Holy Wand',
      description: 'Fires arcane bolts at the nearest enemy.',
      evolvedDescription: 'Fires sacred piercing bolts with zero cooldown delay.',
      upgrades: {
        2: 'Fires +1 additional projectile',
        3: 'Cooldown -20%',
        4: 'Fires +1 additional projectile',
        5: 'Base Damage +10 · Pierce +1',
        6: 'Fires +1 additional projectile',
        7: 'Pierce +1 · Speed +25%',
        8: 'Base Damage +15 · Cooldown -15%'
      }
    }
  },
  knife: {
    zh: {
      name: '暗影飞刀',
      evolvedName: '千刃幻影',
      description: '朝移动方向高速投掷穿透飞刀',
      evolvedDescription: '化为无间断的高速暗影刀流，撕裂前方一切目标',
      upgrades: {
        2: '飞刀数量 +1',
        3: '飞刀数量 +1 · 基础伤害 +5',
        4: '冷却时间 -15%',
        5: '穿透敌人数量 +1',
        6: '飞刀数量 +1',
        7: '基础伤害 +8 · 穿透 +1',
        8: '飞刀数量 +1 · 冷却 -15%'
      }
    },
    en: {
      name: 'Shadow Knife',
      evolvedName: 'Thousand Edge',
      description: 'Throws fast piercing daggers in the facing direction.',
      evolvedDescription: 'Unleashes an endless stream of high-velocity shadow blades.',
      upgrades: {
        2: 'Fires +1 additional dagger',
        3: 'Fires +1 dagger · Base Damage +5',
        4: 'Cooldown -15%',
        5: 'Passes through +1 more enemy',
        6: 'Fires +1 additional dagger',
        7: 'Base Damage +8 · Pierce +1',
        8: 'Fires +1 dagger · Cooldown -15%'
      }
    }
  },
  axe: {
    zh: {
      name: '处决战斧',
      evolvedName: '死神镰刀阵',
      description: '高抛投出重型战斧，对路径上的敌人造成高额伤害',
      evolvedDescription: '向四周环状发射巨型死神镰刀，无限穿透整片战场',
      upgrades: {
        2: '投掷战斧数量 +1',
        3: '基础伤害 +15',
        4: '穿透敌人数量 +2',
        5: '投掷战斧数量 +1',
        6: '基础伤害 +20 · 范围 +15%',
        7: '穿透敌人数量 +2',
        8: '基础伤害 +25 · 冷却 -15%'
      }
    },
    en: {
      name: 'Executioner Axe',
      evolvedName: 'Death Spiral',
      description: 'Hurls heavy battleaxes in a high arc dealing massive damage.',
      evolvedDescription: 'Hurls colossal scythes in a full circle that pierce all enemies.',
      upgrades: {
        2: 'Throws +1 additional axe',
        3: 'Base Damage +15',
        4: 'Passes through +2 more enemies',
        5: 'Throws +1 additional axe',
        6: 'Base Damage +20 · Area +15%',
        7: 'Passes through +2 more enemies',
        8: 'Base Damage +25 · Cooldown -15%'
      }
    }
  },
  fire_wand: {
    zh: {
      name: '赤炎法杖',
      evolvedName: '地狱火陨',
      description: '发射高伤烈焰火球，命中造成范围灼烧',
      evolvedDescription: '召唤巨型地狱陨石贯穿全屏，融化沿途所有敌人',
      upgrades: {
        2: '基础伤害 +12',
        3: '火球数量 +1',
        4: '基础伤害 +15 · 爆炸范围 +15%',
        5: '穿透 +1 · 冷却 -12%',
        6: '火球数量 +1',
        7: '基础伤害 +20',
        8: '基础伤害 +25 · 穿透 +2'
      }
    },
    en: {
      name: 'Fire Wand',
      evolvedName: 'Hellfire',
      description: 'Launches heavy fireballs dealing high AoE burn damage.',
      evolvedDescription: 'Launches colossal meteors that burn and pierce through all foes.',
      upgrades: {
        2: 'Base Damage +12',
        3: 'Fires +1 additional fireball',
        4: 'Base Damage +15 · Area +15%',
        5: 'Pierce +1 · Cooldown -12%',
        6: 'Fires +1 additional fireball',
        7: 'Base Damage +20',
        8: 'Base Damage +25 · Pierce +2'
      }
    }
  },
  runetracer: {
    zh: {
      name: '棱光符文石',
      evolvedName: '次元裂光',
      description: '发射在墙壁与边界间高速弹射的穿透光束',
      evolvedDescription: '折射激光在命中与反弹时引发连环次元爆破',
      upgrades: {
        2: '弹道速度 +20% · 持续时间 +0.4 秒',
        3: '基础伤害 +8',
        4: '发射光束数量 +1',
        5: '基础伤害 +10 · 持续时间 +0.5 秒',
        6: '发射光束数量 +1',
        7: '冷却时间 -15%',
        8: '基础伤害 +15 · 持续时间 +0.6 秒'
      }
    },
    en: {
      name: 'Runetracer',
      evolvedName: 'NO FUTURE',
      description: 'Emits piercing beams that ricochet off walls and boundaries.',
      evolvedDescription: 'Lasers trigger dimensional explosions upon rebound and impact.',
      upgrades: {
        2: 'Speed +20% · Duration +0.4s',
        3: 'Base Damage +8',
        4: 'Fires +1 additional beam',
        5: 'Base Damage +10 · Duration +0.5s',
        6: 'Fires +1 additional beam',
        7: 'Cooldown -15%',
        8: 'Base Damage +15 · Duration +0.6s'
      }
    }
  },
  spinning_orbs: {
    zh: {
      name: '圣殿十字盾',
      evolvedName: '永夜圣咏盾',
      description: '召唤围绕周身持续旋转的黄金十字圣盾，击退靠近的敌人',
      evolvedDescription: '化为永不停歇的高速圣盾风暴，形成绝对防御领域',
      upgrades: {
        2: '环绕圣盾数量 +1',
        3: '旋转速度 +25% · 范围 +15%',
        4: '基础伤害 +8',
        5: '环绕圣盾数量 +1',
        6: '旋转速度 +25% · 基础伤害 +10',
        7: '环绕圣盾数量 +1',
        8: '基础伤害 +15 · 范围 +20%'
      }
    },
    en: {
      name: 'Crusader Shield',
      evolvedName: 'Unholy Vespers',
      description: 'Continuously orbits golden cross shields around the character.',
      evolvedDescription: 'Forms a permanent high-velocity ring of sacred shields.',
      upgrades: {
        2: 'Orbits +1 additional shield',
        3: 'Speed +25% · Area +15%',
        4: 'Base Damage +8',
        5: 'Orbits +1 additional shield',
        6: 'Speed +25% · Base Damage +10',
        7: 'Orbits +1 additional shield',
        8: 'Base Damage +15 · Area +20%'
      }
    }
  },
  holy_water: {
    zh: {
      name: '净世圣水',
      evolvedName: '深渊圣泉',
      description: '在地面生成持续灼烧敌人的神圣火海区域',
      evolvedDescription: '圣火领域向角色周围聚拢并大幅扩大灼烧范围',
      upgrades: {
        2: '生成圣火区域数量 +1',
        3: '持续时间 +0.5 秒 · 范围 +20%',
        4: '基础伤害 +8',
        5: '生成圣火区域数量 +1',
        6: '范围 +25% · 冷却 -15%',
        7: '基础伤害 +12',
        8: '生成圣火区域数量 +1 · 范围 +25%'
      }
    },
    en: {
      name: 'Sanctified Water',
      evolvedName: 'La Borra',
      description: 'Creates damaging pools of sacred flame on the ground.',
      evolvedDescription: 'Sacred flame pools converge toward you and expand in size.',
      upgrades: {
        2: 'Spawns +1 additional flame zone',
        3: 'Duration +0.5s · Area +20%',
        4: 'Base Damage +8',
        5: 'Spawns +1 additional flame zone',
        6: 'Area +25% · Cooldown -15%',
        7: 'Base Damage +12',
        8: 'Spawns +1 zone · Area +25%'
      }
    }
  },
  lightning_ring: {
    zh: {
      name: '雷霆戒律',
      evolvedName: '九霄雷环',
      description: '召唤落雷随机劈击视野内的敌人并造成范围溅射',
      evolvedDescription: '落雷在原位引发二次连锁雷暴，麻痹并摧毁敌群',
      upgrades: {
        2: '落雷劈击次数 +1',
        3: '雷暴波及范围 +25% · 伤害 +8',
        4: '落雷劈击次数 +1',
        5: '基础伤害 +12 · 冷却 -15%',
        6: '落雷劈击次数 +1',
        7: '雷暴波及范围 +25% · 伤害 +15',
        8: '落雷劈击次数 +2'
      }
    },
    en: {
      name: 'Lightning Ring',
      evolvedName: 'Thunder Loop',
      description: 'Strikes random enemies with sky thunderbolts.',
      evolvedDescription: 'Lightning bolts strike twice and unleash chain shockwaves.',
      upgrades: {
        2: 'Strikes +1 additional target',
        3: 'Area +25% · Base Damage +8',
        4: 'Strikes +1 additional target',
        5: 'Base Damage +12 · Cooldown -15%',
        6: 'Strikes +1 additional target',
        7: 'Area +25% · Base Damage +15',
        8: 'Strikes +2 additional targets'
      }
    }
  },
  cross: {
    zh: {
      name: '回旋圣十字',
      evolvedName: '天界裁决剑',
      description: '投出高暴击的回旋十字刃，飞出后折返穿透整排敌人',
      evolvedDescription: '化为天界巨剑往返斩击，具备极高暴击倍率',
      upgrades: {
        2: '基础伤害 +8 · 弹速 +20%',
        3: '投掷十字数量 +1',
        4: '范围 +20% · 基础伤害 +8',
        5: '投掷十字数量 +1',
        6: '基础伤害 +12 · 冷却 -15%',
        7: '范围 +25%',
        8: '基础伤害 +18 · 投掷数量 +1'
      }
    },
    en: {
      name: 'Sacred Cross',
      evolvedName: 'Heaven Sword',
      description: 'Throws boomeranging crosses with high critical chance.',
      evolvedDescription: 'Transforms into a celestial greatsword with massive critical hits.',
      upgrades: {
        2: 'Base Damage +8 · Speed +20%',
        3: 'Throws +1 additional cross',
        4: 'Area +20% · Base Damage +8',
        5: 'Throws +1 additional cross',
        6: 'Base Damage +12 · Cooldown -15%',
        7: 'Area +25%',
        8: 'Base Damage +18 · Throws +1 cross'
      }
    }
  },
  garlic: {
    zh: {
      name: '圣洁气场',
      evolvedName: '噬魂领域',
      description: '展开环绕周身的神圣力场，持续伤害靠近的敌人并削弱抗性',
      evolvedDescription: '汲取领域内敌人的生命精华，治疗自身并提升伤害',
      upgrades: {
        2: '气场半径 +20% · 伤害 +3',
        3: '触发间隔缩短 15% · 伤害 +4',
        4: '气场半径 +20% · 伤害 +4',
        5: '触发间隔缩短 15% · 伤害 +5',
        6: '气场半径 +20% · 伤害 +6',
        7: '触发间隔缩短 15% · 伤害 +6',
        8: '气场半径 +25% · 伤害 +10'
      }
    },
    en: {
      name: 'Sacred Aura',
      evolvedName: 'Soul Eater',
      description: 'Damages nearby enemies and weakens their knockback resistance.',
      evolvedDescription: 'Drains life from nearby foes and grows stronger as you heal.',
      upgrades: {
        2: 'Area +20% · Base Damage +3',
        3: 'Cooldown -15% · Base Damage +4',
        4: 'Area +20% · Base Damage +4',
        5: 'Cooldown -15% · Base Damage +5',
        6: 'Area +20% · Base Damage +6',
        7: 'Cooldown -15% · Base Damage +6',
        8: 'Area +25% · Base Damage +10'
      }
    }
  }
};

export function getWeaponDisplayName(id: string, isEvolved = false): string {
  const entry = WEAPON_I18N[id];
  if (!entry) return id;
  const langData = entry[i18n.lang];
  return isEvolved ? langData.evolvedName : langData.name;
}

export function getWeaponDescription(id: string, isEvolved = false): string {
  const entry = WEAPON_I18N[id];
  if (!entry) return '';
  const langData = entry[i18n.lang];
  return isEvolved ? langData.evolvedDescription : langData.description;
}

export function getWeaponUpgradeDescription(id: string, level: number, fallback = ''): string {
  const entry = WEAPON_I18N[id];
  if (!entry) return fallback;
  return entry[i18n.lang].upgrades[level] || entry[i18n.lang].description || fallback;
}

// --- 圣物/被动双语字典 (Passives / Relics Localization) ---
export interface LocalizedPassiveText {
  name: string;
  description: string;
  perLevel: string[];
}

export const PASSIVE_I18N: Record<string, { zh: LocalizedPassiveText; en: LocalizedPassiveText }> = {
  spinach: {
    zh: {
      name: '棱镜折射',
      description: '投射物变为 3 发扇形散射，射程缩短 30%，触墙可反弹',
      perLevel: [
        '投射物散射 3 发 · 射程 -30% · 触墙反弹 1 次',
        '散射伤害提升 · 触墙连续反弹 2 次',
        '散射伤害提升 · 触墙连续反弹 3 次',
        '散射伤害提升 · 触墙连续反弹 4 次',
        '全额散射伤害 · 触墙连续反弹 5 次'
      ]
    },
    en: {
      name: 'Prism Splitter',
      description: 'Projectiles split into a 3-shot fan, -30% range, ricochet off walls.',
      perLevel: [
        'Projectiles split into 3 · -30% range · 1 wall bounce',
        'Increased split damage · 2 wall bounces',
        'Increased split damage · 3 wall bounces',
        'Increased split damage · 4 wall bounces',
        'Full split damage · 5 wall bounces'
      ]
    }
  },
  wings: {
    zh: {
      name: '跃迁余烬',
      description: '冲刺时在原地留下延迟晶核，继承主武器属性并引爆',
      perLevel: [
        '冲刺原地留下延迟晶核 · 继承主武器属性引爆',
        '晶核爆炸范围 +18 · 冲刺冷却加快',
        '晶核爆炸范围 +36 · 引爆时环状发射 8 枚弹体',
        '晶核爆炸范围 +54 · 引爆时附加持续火海与雷暴',
        '超大范围元素奇点引爆 · 全额触发命中特效'
      ]
    },
    en: {
      name: 'Volatile Dash',
      description: 'Dashing leaves a delayed core that inherits main weapon traits.',
      perLevel: [
        'Dash leaves a delayed blast core with main weapon tags',
        'Blast radius +18 · Faster dash cooldown',
        'Blast radius +36 · Emits 8 radial projectiles on detonation',
        'Blast radius +54 · Leaves lingering fire & lightning',
        'Massive singularity blast · Triggers all on-hit effects'
      ]
    }
  },
  clover: {
    zh: {
      name: '湮灭律令',
      description: '移除暴击率，每第 4 次攻击转化为无限穿透的引力奇点',
      perLevel: [
        '暴击率归零 · 每第 4 次攻击造成穿透伤害并聚拢敌人',
        '第 4 击引力半径扩大至 225 · 穿透伤害提升',
        '第 4 击引力半径扩大至 250 · 聚怪力度提升',
        '第 4 击引力半径扩大至 275 · 附加破甲震荡波',
        '每第 4 次攻击化为大范围引力深渊'
      ]
    },
    en: {
      name: 'Singularity Edict',
      description: 'Removes Crit Chance; every 4th attack becomes a piercing gravity well.',
      perLevel: [
        '0% Crit · Every 4th attack pierces and pulls nearby foes',
        '4th strike pull radius 225 · Increased pierce damage',
        '4th strike pull radius 250 · Stronger vortex pull',
        '4th strike pull radius 275 · Sunder shockwave on hit',
        'Every 4th attack triggers an abyssal gravity singularity'
      ]
    }
  },
  empty_tome: {
    zh: {
      name: '炎爆烙印',
      description: '投射物命中时引发范围烈焰爆炸并点燃目标',
      perLevel: [
        '投射物命中触发范围炎爆 · 附加 4 秒灼烧',
        '炎爆半径扩大 · 爆炸伤害提升至 60%',
        '炎爆半径扩大 · 爆炸伤害提升至 75%',
        '炎爆半径扩大 · 爆炸伤害提升至 90%',
        '投射物命中引发连锁烈焰新星'
      ]
    },
    en: {
      name: 'Pyro Brand',
      description: 'Projectiles trigger fiery explosions on impact and ignite foes.',
      perLevel: [
        'Projectile hits trigger AoE fire blast · 4s burn',
        'Larger blast radius · 60% blast damage',
        'Larger blast radius · 75% blast damage',
        'Larger blast radius · 90% blast damage',
        'Projectile hits unleash chained solar novas'
      ]
    }
  },
  duplicator: {
    zh: {
      name: '幻影剑气',
      description: '近战挥砍时额外发射穿透剑气，继承投射物联动',
      perLevel: [
        '近战攻击额外激发 1 道穿透剑气',
        '剑气穿透 +2 · 伤害提升 · 可触发反弹与炎爆',
        '近战挥砍激发巨型次元刃贯穿直线敌人'
      ]
    },
    en: {
      name: 'Phantom Blade Qi',
      description: 'Melee attacks fire an extra piercing sword wave with Projectile tags.',
      perLevel: [
        'Melee swings launch 1 piercing sword wave',
        'Wave pierce +2 · Higher damage · Triggers bounces & blasts',
        'Melee swings unleash a giant dimensional blade beam'
      ]
    }
  },
  attractorb: {
    zh: {
      name: '电弧导管',
      description: '连锁或过载命中时弹射闪电链，遇火触发超载爆炸',
      perLevel: [
        '命中弹射 2 道雷电链 · 遇火触发超载爆破',
        '弹射目标 +1 · 感电延长 · 牵引范围扩大',
        '弹射目标 +2 · 连锁电弧伤害提升',
        '弹射目标 +3 · 连锁电弧伤害大幅提升',
        '命中时在敌群间形成瞬发雷电网'
      ]
    },
    en: {
      name: 'Arc Conductor',
      description: 'Chain/Overload hits bounce lightning arcs and overload burning foes.',
      perLevel: [
        'Hits bounce 2 lightning arcs · Overloads burning targets',
        '+1 arc bounce · Longer shock · Wider pickup magnet',
        '+2 arc bounces · Increased chain lightning damage',
        '+3 arc bounces · High chain lightning damage',
        'Hits weave an instant lightning grid across enemies'
      ]
    }
  },
  hollow_heart: {
    zh: {
      name: '缚魂灵瓮',
      description: '击杀敌人时在原地生成追踪缚魂弹攻击周围目标',
      perLevel: [
        '每击杀 5 名敌人生成追踪缚魂弹',
        '每击杀 4 名敌人生成缚魂弹 · 穿透 +1 · 生命上限提升',
        '每击杀 3 名敌人生成缚魂弹 · 伤害 +50%',
        '每击杀 2 名敌人生成缚魂弹 · 联动散射与炎爆',
        '每次击杀均释放高穿透缚魂弹幕'
      ]
    },
    en: {
      name: 'Soul Vessel',
      description: 'Defeating enemies spawns homing soul bolts from their remains.',
      perLevel: [
        'Every 5 kills spawns a homing soul bolt',
        'Every 4 kills spawns bolt · +1 Pierce · +Max HP',
        'Every 3 kills spawns bolt · +50% bolt damage',
        'Every 2 kills spawns bolt · Synergizes with split & pyro',
        'Every kill unleashes high-pierce soul barrages'
      ]
    }
  },
  crown: {
    zh: {
      name: '链式殉爆',
      description: '处于灼烧或感电的敌人阵亡时引发范围殉爆',
      perLevel: [
        '异常状态敌人阵亡时 100% 引发范围殉爆',
        '殉爆半径扩大 · 普通敌人阵亡有 45% 概率殉爆',
        '殉爆伤害 +50% · 点燃波及目标',
        '殉爆半径大幅扩大 · 可连环引爆敌群',
        '阵亡目标引发全房连环超新星爆破'
      ]
    },
    en: {
      name: 'Chain Detonation',
      description: 'Burning or shocked enemies detonate violently when slain.',
      perLevel: [
        'Slain burning/shocked foes 100% detonate in an AoE',
        'Wider blast · Normal foes have 45% chance to detonate',
        'Blast damage +50% · Ignites all affected enemies',
        'Massive blast radius · Chains across dense hordes',
        'Slain foes trigger room-wide supernova chain reactions'
      ]
    }
  },
  pummarola: {
    zh: {
      name: '鲜血圣杯',
      description: '近战与召唤命中时附加流血，并按概率汲取生命',
      perLevel: [
        '命中附加流血 · 28% 概率汲取恢复生命',
        '流血伤害提升 · 汲取概率提升至 34%',
        '每次触发鲜血汲取恢复 2 点生命',
        '汲取概率提升至 46% · 溢出治疗转化为护盾',
        '近战与召唤攻击化为持续吸血领域'
      ]
    },
    en: {
      name: 'Crimson Chalice',
      description: 'Melee and Summon hits inflict Bleed and leech health.',
      perLevel: [
        'Inflicts Bleed on hit · 28% chance to leech HP',
        'Higher Bleed damage · 34% leech chance',
        'Restores 2 HP per life-leech proc',
        '46% leech chance · Overheal grants barrier',
        'Melee & Summon attacks become a perpetual vampiric field'
      ]
    }
  },
  armor: {
    zh: {
      name: '逆鳞寒霜',
      description: '受到伤害时爆发极寒新星，冻结并震退周围敌人',
      perLevel: [
        '受击爆发极寒新星 · 冻结敌人 2.2 秒并反击',
        '新星范围扩大 · 冻结 2.6 秒 · 护甲减伤 +1',
        '反击伤害 +60% · 冻结延长至 3.0 秒',
        '新星范围大幅扩大 · 冻结目标受重击伤害翻倍',
        '受击瞬间冰封全房并重置冲刺冷却'
      ]
    },
    en: {
      name: 'Frost Aegis',
      description: 'Taking damage unleashes a Frost Nova that freezes all nearby foes.',
      perLevel: [
        'Taking damage triggers Frost Nova · Freezes foes 2.2s',
        'Larger nova radius · 2.6s freeze · +1 Armor',
        '+60% nova damage · 3.0s freeze duration',
        'Massive nova · Frozen foes take 2.5x heavy shatter damage',
        'Freezes entire room on hit & resets Dash cooldown'
      ]
    }
  }
};

export function getPassiveDisplayName(id: string): string {
  const entry = PASSIVE_I18N[id];
  if (!entry) return id;
  return entry[i18n.lang].name;
}

export function getPassiveLevelDescription(id: string, levelIndex: number): string {
  const entry = PASSIVE_I18N[id];
  if (!entry) return '';
  const data = entry[i18n.lang];
  return data.perLevel[levelIndex] || data.description;
}
