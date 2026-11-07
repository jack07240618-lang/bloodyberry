import { Weapon } from './Weapon';
import { MagicWand } from './implementations/MagicWand';
import { SpinningOrbs } from './implementations/SpinningOrbs';
import { HolyWater } from './implementations/HolyWater';
import { PiercingDagger } from './implementations/PiercingDagger';
import { ChainLightning } from './implementations/ChainLightning';
import { CrossBoomerang } from './implementations/CrossBoomerang';
import { GarlicAura } from './implementations/GarlicAura';
import { Pentagram } from './implementations/Pentagram';

export interface WeaponDefinition {
  id: string;
  name: string;
  description: string;
  evolutionPassive: string;
  evolvedName: string;
  create: () => Weapon;
}

export const ALL_WEAPON_DEFINITIONS: Record<string, WeaponDefinition> = {
  magic_wand: {
    id: 'magic_wand',
    name: 'Magic Wand',
    description: 'Fires energy bolts at the nearest enemy.',
    evolutionPassive: 'empty_tome',
    evolvedName: 'Holy Wand',
    create: () => new MagicWand()
  },
  knife: {
    id: 'knife',
    name: 'Knife',
    description: 'Fires piercing daggers in facing direction.',
    evolutionPassive: 'wings',
    evolvedName: 'Thousand Edge',
    create: () => new PiercingDagger()
  },
  spinning_orbs: {
    id: 'spinning_orbs',
    name: 'King Bible',
    description: 'Orbits books around the character.',
    evolutionPassive: 'hollow_heart',
    evolvedName: 'Unholy Vespers',
    create: () => new SpinningOrbs()
  },
  holy_water: {
    id: 'holy_water',
    name: 'Santa Water',
    description: 'Generates damaging zones of holy flame.',
    evolutionPassive: 'attractorb',
    evolvedName: 'La Borra',
    create: () => new HolyWater()
  },
  lightning_ring: {
    id: 'lightning_ring',
    name: 'Lightning Ring',
    description: 'Strikes random enemies with thunderbolts.',
    evolutionPassive: 'duplicator',
    evolvedName: 'Thunder Loop',
    create: () => new ChainLightning()
  },
  cross: {
    id: 'cross',
    name: 'Cross',
    description: 'Throws boomeranging crosses with high critical chance.',
    evolutionPassive: 'clover',
    evolvedName: 'Heaven Sword',
    create: () => new CrossBoomerang()
  },
  garlic: {
    id: 'garlic',
    name: 'Garlic',
    description: 'Damages nearby enemies and reduces knockback resistance.',
    evolutionPassive: 'pummarola',
    evolvedName: 'Soul Eater',
    create: () => new GarlicAura()
  },
  pentagram: {
    id: 'pentagram',
    name: 'Pentagram',
    description: 'Erases all enemies on screen on a long recharge.',
    evolutionPassive: 'crown',
    evolvedName: 'Gorgeous Moon',
    create: () => new Pentagram()
  }
};
