export interface CharacterInfo {
  id: string;
  name: string;
  title: string;
  startingWeapon: string;
  ultimateName: string;
  ultimateDescription: string;
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
    ultimateName: 'CRIMSON CROSS',
    ultimateDescription: 'Unleashes a giant Sacred Crusader Cross Slash across the arena + heals 25% HP.',
    traitDescription: '+10% Max HP, +1 Armor | Ult: Crimson Cross',
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
    ultimateName: 'STARFALL PENTAGRAM',
    ultimateDescription: 'Summons an Arcane Pentagram & 24 homing star comets + freezes foes 3s.',
    traitDescription: '+25% XP, +5% Speed | Ult: Starfall Pentagram',
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
    ultimateName: 'PHANTOM BLADESTORM',
    ultimateDescription: 'Spiral barrage of 36 piercing shadow daggers + resets Dash cooldown.',
    traitDescription: '+1 Projectile | Ult: Phantom Bladestorm',
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
    ultimateName: 'HELLFIRE CATACLYSM',
    ultimateDescription: 'Calls down 12 solar meteors & infernal magma pools that ignite all foes.',
    traitDescription: '-15% Cooldown, +15% Area | Ult: Hellfire Cataclysm',
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
    ultimateName: 'PRISMATIC THUNDER',
    ultimateDescription: 'Strikes 15 enemies with sky lightning + fires 12 prismatic laser beams.',
    traitDescription: '+20% DMG, +15% Crit | Ult: Prismatic Thunder',
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
    ultimateName: 'DEATH SPIRAL HARVEST',
    ultimateDescription: 'Hurls 16 colossal Grim Reaper Scythes outward + drains soul essence.',
    traitDescription: '+1 Projectile, +20% DMG | Ult: Death Harvest',
    unlockRequirement: 'Defeat 1500 total lifetime enemies',
    color: '#64748b',
    applyTraits: (player) => {
      player.projectileCountBonus += 1;
      player.damageMult *= 1.2;
      player.recalculateStats();
    }
  }
];
