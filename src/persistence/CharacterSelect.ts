export interface CharacterInfo {
  id: string;
  name: string;
  title: string;
  startingWeapon: string;
  traitDescription: string;
  unlockRequirement: string;
  applyTraits: (player: any) => void;
  color: string;
}

export const CHARACTERS: CharacterInfo[] = [
  {
    id: 'antonio',
    name: 'Antonio',
    title: 'The Belpaese Blade',
    startingWeapon: 'whip',
    traitDescription: '+10% Max HP, +1 Natural Armor',
    unlockRequirement: 'Unlocked by default',
    color: '#3b82f6',
    applyTraits: (player) => {
      player.baseMaxHp = 110;
      player.armor = 1;
      player.recalculateStats();
    }
  },
  {
    id: 'imelda',
    name: 'Imelda',
    title: 'The Arcane Scholar',
    startingWeapon: 'magic_wand',
    traitDescription: '+25% Experience Gain, +5% Move Speed',
    unlockRequirement: 'Unlocked by default',
    color: '#a855f7',
    applyTraits: (player) => {
      player.xpMult = 1.25;
      player.baseSpeed = 200;
      player.recalculateStats();
    }
  },
  {
    id: 'gennaro',
    name: 'Gennaro',
    title: 'The Dual Shadow',
    startingWeapon: 'knife',
    traitDescription: '+1 Permanent Projectile for all weapons',
    unlockRequirement: 'Defeat 200 total lifetime enemies',
    color: '#10b981',
    applyTraits: (player) => {
      player.projectileCountBonus += 1;
      player.recalculateStats();
    }
  },
  {
    id: 'arca',
    name: 'Arca',
    title: 'The Crimson Warlock',
    startingWeapon: 'fire_wand',
    traitDescription: '-15% Weapon Cooldowns, +15% Area Size',
    unlockRequirement: 'Defeat 500 total lifetime enemies',
    color: '#ef4444',
    applyTraits: (player) => {
      player.cooldownMult *= 0.85;
      player.areaMult *= 1.15;
      player.recalculateStats();
    }
  },
  {
    id: 'pasqualina',
    name: 'Pasqualina',
    title: 'The Storm Weaver',
    startingWeapon: 'runetracer',
    traitDescription: '+20% Projectile Speed & Ricochet Force',
    unlockRequirement: 'Defeat 1000 total lifetime enemies',
    color: '#f59e0b',
    applyTraits: (player) => {
      player.damageMult *= 1.2;
      player.critChance += 0.15;
      player.recalculateStats();
    }
  },
  {
    id: 'mortaccio',
    name: 'Mortaccio',
    title: 'The Risen Scythe',
    startingWeapon: 'axe',
    traitDescription: '+1 Additional Projectile & +20% Damage',
    unlockRequirement: 'Defeat 1500 total lifetime enemies',
    color: '#64748b',
    applyTraits: (player) => {
      player.projectileCountBonus += 1;
      player.damageMult *= 1.2;
      player.recalculateStats();
    }
  }
];
