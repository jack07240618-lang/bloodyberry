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
      description: "三发散射：主弹60%伤害，侧弹较弱，射程缩短32%",
      perLevel: [
        "侧弹伤害 20.5% · 触墙反弹 1 次",
        "侧弹伤害 23% · 触墙反弹 1 次",
        "侧弹伤害 25.5% · 触墙反弹 2 次",
        "侧弹伤害 28% · 触墙反弹 2 次",
        "侧弹伤害 30.5% · 触墙反弹 3 次"
      ]
    },
    en: {
      name: 'Prism Splitter',
      description: "3-shot fan: 60% main damage, weaker side shots, -32% range.",
      perLevel: [
        "Side shot damage 20.5% · 1 wall bounce(s)",
        "Side shot damage 23% · 1 wall bounce(s)",
        "Side shot damage 25.5% · 2 wall bounce(s)",
        "Side shot damage 28% · 2 wall bounce(s)",
        "Side shot damage 30.5% · 3 wall bounce(s)"
      ]
    }
  },
  wings: {
    zh: {
      name: '跃迁余烬',
      description: "冲刺留下较小晶核，继承主武器标签；每级冲刺冷却减少3%",
      perLevel: [
        "晶核伤害 110% · 半径 70 · 冲刺冷却 -3%",
        "晶核伤害 130% · 半径 80 · 冲刺冷却 -6%",
        "晶核伤害 150% · 半径 90 · 冲刺冷却 -9%",
        "晶核伤害 170% · 半径 100 · 冲刺冷却 -12%",
        "晶核伤害 190% · 半径 110 · 冲刺冷却 -15%"
      ]
    },
    en: {
      name: 'Volatile Dash',
      description: "Dash leaves a smaller core with main weapon tags; -3% dash cooldown per rank.",
      perLevel: [
        "Core damage 110% · Radius 70 · Dash cooldown -3%",
        "Core damage 130% · Radius 80 · Dash cooldown -6%",
        "Core damage 150% · Radius 90 · Dash cooldown -9%",
        "Core damage 170% · Radius 100 · Dash cooldown -12%",
        "Core damage 190% · Radius 110 · Dash cooldown -15%"
      ]
    }
  },
  clover: {
    zh: {
      name: '湮灭律令',
      description: "移除随机暴击，每第4次攻击转为穿透奇点，降低增伤与聚怪范围",
      perLevel: [
        "第4击伤害倍率 1.10 · 聚怪半径 112 · 溅射15%",
        "第4击伤害倍率 1.15 · 聚怪半径 124 · 溅射15%",
        "第4击伤害倍率 1.20 · 聚怪半径 136 · 溅射15%",
        "第4击伤害倍率 1.25 · 聚怪半径 148 · 溅射15%",
        "第4击伤害倍率 1.30 · 聚怪半径 160 · 溅射15%"
      ]
    },
    en: {
      name: 'Singularity Edict',
      description: "Removes random crits; every 4th attack pierces, with reduced damage and pull.",
      perLevel: [
        "4th strike damage x1.10 · Pull radius 112 · 15% splash",
        "4th strike damage x1.15 · Pull radius 124 · 15% splash",
        "4th strike damage x1.20 · Pull radius 136 · 15% splash",
        "4th strike damage x1.25 · Pull radius 148 · 15% splash",
        "4th strike damage x1.30 · Pull radius 160 · 15% splash"
      ]
    }
  },
  empty_tome: {
    zh: {
      name: '炎爆烙印',
      description: "投射物首次命中触发小范围炎爆，附加2秒灼烧",
      perLevel: [
        "炎爆伤害 16% · 半径 41 · 灼烧2秒",
        "炎爆伤害 20% · 半径 46 · 灼烧2秒",
        "炎爆伤害 24% · 半径 51 · 灼烧2秒",
        "炎爆伤害 28% · 半径 56 · 灼烧2秒",
        "炎爆伤害 32% · 半径 61 · 灼烧2秒"
      ]
    },
    en: {
      name: 'Pyro Brand',
      description: "First projectile hit triggers a small blast and 2s burn.",
      perLevel: [
        "Blast damage 16% · Radius 41 · 2s burn",
        "Blast damage 20% · Radius 46 · 2s burn",
        "Blast damage 24% · Radius 51 · 2s burn",
        "Blast damage 28% · Radius 56 · 2s burn",
        "Blast damage 32% · Radius 61 · 2s burn"
      ]
    }
  },
  duplicator: {
    zh: {
      name: '幻影剑气',
      description: "近战附加一道低伤害剑气，降低穿透数量",
      perLevel: [
        "剑气伤害 32% · 穿透 1",
        "剑气伤害 39% · 穿透 2",
        "剑气伤害 46% · 穿透 2"
      ]
    },
    en: {
      name: 'Phantom Blade Qi',
      description: "Melee adds one weaker sword wave with limited pierce.",
      perLevel: [
        "Wave damage 32% · Pierce 1",
        "Wave damage 39% · Pierce 2",
        "Wave damage 46% · Pierce 2"
      ]
    }
  },
  attractorb: {
    zh: {
      name: '电弧导管',
      description: "连锁或过载命中弹射较弱电弧，感电持续2秒",
      perLevel: [
        "电弧伤害 15.5% · 最多 1 个额外目标 · 拾取范围 +10%",
        "电弧伤害 19% · 最多 1 个额外目标 · 拾取范围 +20%",
        "电弧伤害 22.5% · 最多 2 个额外目标 · 拾取范围 +30%",
        "电弧伤害 26% · 最多 2 个额外目标 · 拾取范围 +40%",
        "电弧伤害 29.5% · 最多 3 个额外目标 · 拾取范围 +50%"
      ]
    },
    en: {
      name: 'Arc Conductor',
      description: "Chain/Overload hits create weaker arcs with 2s shock.",
      perLevel: [
        "Arc damage 15.5% · Up to 1 extra targets · Pickup +10%",
        "Arc damage 19% · Up to 1 extra targets · Pickup +20%",
        "Arc damage 22.5% · Up to 2 extra targets · Pickup +30%",
        "Arc damage 26% · Up to 2 extra targets · Pickup +40%",
        "Arc damage 29.5% · Up to 3 extra targets · Pickup +50%"
      ]
    }
  },
  hollow_heart: {
    zh: {
      name: '缚魂灵瓮',
      description: "累积击杀生成较弱缚魂弹，每级生命上限增加5",
      perLevel: [
        "每击杀 10 名敌人生成缚魂弹 · 生命上限 +5 · 穿透 1",
        "每击杀 9 名敌人生成缚魂弹 · 生命上限 +10 · 穿透 2",
        "每击杀 8 名敌人生成缚魂弹 · 生命上限 +15 · 穿透 2",
        "每击杀 7 名敌人生成缚魂弹 · 生命上限 +20 · 穿透 3",
        "每击杀 6 名敌人生成缚魂弹 · 生命上限 +25 · 穿透 3"
      ]
    },
    en: {
      name: 'Soul Vessel',
      description: "Accumulated kills spawn weaker soul bolts; +5 Max HP per rank.",
      perLevel: [
        "Soul bolt every 10 kills · +5 Max HP · Pierce 1",
        "Soul bolt every 9 kills · +10 Max HP · Pierce 2",
        "Soul bolt every 8 kills · +15 Max HP · Pierce 2",
        "Soul bolt every 7 kills · +20 Max HP · Pierce 3",
        "Soul bolt every 6 kills · +25 Max HP · Pierce 3"
      ]
    }
  },
  crown: {
    zh: {
      name: '链式殉爆',
      description: "仅灼烧或感电敌人阵亡时，概率触发小范围殉爆",
      perLevel: [
        "异常敌人阵亡殉爆概率 30% · 半径 46",
        "异常敌人阵亡殉爆概率 35% · 半径 52",
        "异常敌人阵亡殉爆概率 40% · 半径 58",
        "异常敌人阵亡殉爆概率 45% · 半径 64",
        "异常敌人阵亡殉爆概率 50% · 半径 70"
      ]
    },
    en: {
      name: 'Chain Detonation',
      description: "Only burning/shocked foes can trigger a small death blast.",
      perLevel: [
        "Status death blast chance 30% · Radius 46",
        "Status death blast chance 35% · Radius 52",
        "Status death blast chance 40% · Radius 58",
        "Status death blast chance 45% · Radius 64",
        "Status death blast chance 50% · Radius 70"
      ]
    }
  },
  pummarola: {
    zh: {
      name: '鲜血圣杯',
      description: "近战与召唤附加2秒流血，低概率恢复1点生命",
      perLevel: [
        "汲取概率 8% · 每次恢复1点生命 · 流血2秒",
        "汲取概率 10% · 每次恢复1点生命 · 流血2秒",
        "汲取概率 12% · 每次恢复1点生命 · 流血2秒",
        "汲取概率 14% · 每次恢复1点生命 · 流血2秒",
        "汲取概率 16% · 每次恢复1点生命 · 流血2秒"
      ]
    },
    en: {
      name: 'Crimson Chalice',
      description: "Melee/Summon inflicts 2s Bleed with a low chance to heal 1 HP.",
      perLevel: [
        "8% leech chance · Heal 1 HP · 2s Bleed",
        "10% leech chance · Heal 1 HP · 2s Bleed",
        "12% leech chance · Heal 1 HP · 2s Bleed",
        "14% leech chance · Heal 1 HP · 2s Bleed",
        "16% leech chance · Heal 1 HP · 2s Bleed"
      ]
    }
  },
  armor: {
    zh: {
      name: '逆鳞寒霜',
      description: "受击触发较弱寒霜新星与短暂冻结，每两级增加1护甲",
      perLevel: [
        "新星半径 110 · 冻结 0.75 秒 · 护甲 +0",
        "新星半径 125 · 冻结 0.90 秒 · 护甲 +1",
        "新星半径 140 · 冻结 1.05 秒 · 护甲 +1",
        "新星半径 155 · 冻结 1.20 秒 · 护甲 +2",
        "新星半径 170 · 冻结 1.35 秒 · 护甲 +2"
      ]
    },
    en: {
      name: 'Frost Aegis',
      description: "Taking damage triggers a weaker frost nova and brief freeze; +1 Armor per 2 ranks.",
      perLevel: [
        "Nova radius 110 · Freeze 0.75s · +0 Armor",
        "Nova radius 125 · Freeze 0.90s · +1 Armor",
        "Nova radius 140 · Freeze 1.05s · +1 Armor",
        "Nova radius 155 · Freeze 1.20s · +2 Armor",
        "Nova radius 170 · Freeze 1.35s · +2 Armor"
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

// --- 首领双语字典 (Boss Variants Localization) ---
export interface LocalizedBossText {
  name: string;
  title: string;
}

export const BOSS_I18N: Record<number, { zh: LocalizedBossText; en: LocalizedBossText }> = {
  0: {
    zh: {
      name: '「深渊领主 · 玛拉考斯」',
      title: '炼狱守门人'
    },
    en: {
      name: 'ARCH-DEMON MALAKOR',
      title: 'WARDEN OF THE ABYSS'
    }
  },
  1: {
    zh: {
      name: '「凛冬巫妖 · 维萨里奥」',
      title: '极寒王座执政官'
    },
    en: {
      name: 'FROST ARCHLICH VESARIO',
      title: 'SOVEREIGN OF RIME'
    }
  },
  2: {
    zh: {
      name: '「腐化圣母 · 塞拉菲娜」',
      title: '翡翠剧毒织网者'
    },
    en: {
      name: 'VENOM MATRIARCH SERAPHINA',
      title: 'WEAVER OF BLIGHT'
    }
  },
  3: {
    zh: {
      name: '「焚世炎魔 · 巴尔洛格」',
      title: '熔炉深渊暴君'
    },
    en: {
      name: 'INFERNAL BALROG IGNIS',
      title: 'TYRANT OF THE FORGE'
    }
  }
};

export function getBossText(variant = 0): LocalizedBossText {
  const entry = BOSS_I18N[((variant % 4) + 4) % 4] || BOSS_I18N[0];
  return entry[i18n.lang];
}

