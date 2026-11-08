import { Weapon } from './Weapon';
import { MagicWand } from './implementations/MagicWand';
import { SpinningOrbs } from './implementations/SpinningOrbs';
import { HolyWater } from './implementations/HolyWater';
import { PiercingDagger } from './implementations/PiercingDagger';
import { ChainLightning } from './implementations/ChainLightning';
import { CrossBoomerang } from './implementations/CrossBoomerang';
import { GarlicAura } from './implementations/GarlicAura';
import { Whip } from './implementations/Whip';
import { Axe } from './implementations/Axe';
import { FireWand } from './implementations/FireWand';
import { Runetracer } from './implementations/Runetracer';

export interface WeaponDefinition {
  id: string;
  name: string;
  description: string;
  evolutionPassive: string;
  evolvedName: string;
  create: () => Weapon;
}

export const ALL_WEAPON_DEFINITIONS: Record<string, WeaponDefinition> = {
  whip: {
    id: 'whip',
    name: 'Whip',
    description: 'Strikes horizontally in front and behind.',
    evolutionPassive: 'hollow_heart',
    evolvedName: 'Bloody Tear',
    create: () => new Whip()
  },
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
  axe: {
    id: 'axe',
    name: 'Axe',
    description: 'Hurls axes in a high arc dealing heavy damage.',
    evolutionPassive: 'spinach',
    evolvedName: 'Death Spiral',
    create: () => new Axe()
  },
  fire_wand: {
    id: 'fire_wand',
    name: 'Fire Wand',
    description: 'Launches heavy fireballs dealing catastrophic damage.',
    evolutionPassive: 'spinach',
    evolvedName: 'Hellfire',
    create: () => new FireWand()
  },
  runetracer: {
    id: 'runetracer',
    name: 'Runetracer',
    description: 'Emits piercing lasers that ricochet off screen boundaries.',
    evolutionPassive: 'armor',
    evolvedName: 'NO FUTURE',
    create: () => new Runetracer()
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
  }
};
