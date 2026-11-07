export interface PassiveDefinition {
  id: string;
  name: string;
  description: string;
  iconName: string;
  maxLevel: number;
  perLevelDescription: string[];
}

export const PASSIVE_DEFINITIONS: Record<string, PassiveDefinition> = {
  spinach: {
    id: 'spinach',
    name: 'Spinach',
    description: 'Increases damage dealt by 10% per rank.',
    iconName: 'spinach',
    maxLevel: 5,
    perLevelDescription: [
      'Raises damage dealt by 10%',
      'Raises damage dealt by 20%',
      'Raises damage dealt by 30%',
      'Raises damage dealt by 40%',
      'Raises damage dealt by 50%'
    ]
  },
  wings: {
    id: 'wings',
    name: 'Wings',
    description: 'Increases movement speed by 10% per rank.',
    iconName: 'wings',
    maxLevel: 5,
    perLevelDescription: [
      'Character moves 10% faster',
      'Character moves 20% faster',
      'Character moves 30% faster',
      'Character moves 40% faster',
      'Character moves 50% faster'
    ]
  },
  empty_tome: {
    id: 'empty_tome',
    name: 'Empty Tome',
    description: 'Reduces weapon attack cooldowns by 8% per rank.',
    iconName: 'empty_tome',
    maxLevel: 5,
    perLevelDescription: [
      'Reduces weapon cooldowns by 8%',
      'Reduces weapon cooldowns by 16%',
      'Reduces weapon cooldowns by 24%',
      'Reduces weapon cooldowns by 32%',
      'Reduces weapon cooldowns by 40%'
    ]
  },
  duplicator: {
    id: 'duplicator',
    name: 'Duplicator',
    description: 'Fires additional projectiles for projectile weapons.',
    iconName: 'duplicator',
    maxLevel: 2,
    perLevelDescription: [
      'Weapons fire +1 additional projectile',
      'Weapons fire +2 additional projectiles'
    ]
  },
  crown: {
    id: 'crown',
    name: 'Crown',
    description: 'Increases experience gained by 15% per rank.',
    iconName: 'crown',
    maxLevel: 5,
    perLevelDescription: [
      'Gains 15% more experience',
      'Gains 30% more experience',
      'Gains 45% more experience',
      'Gains 60% more experience',
      'Gains 75% more experience'
    ]
  },
  hollow_heart: {
    id: 'hollow_heart',
    name: 'Hollow Heart',
    description: 'Augments max health by 20% per rank.',
    iconName: 'hollow_heart',
    maxLevel: 5,
    perLevelDescription: [
      'Max health increased by 20%',
      'Max health increased by 40%',
      'Max health increased by 60%',
      'Max health increased by 80%',
      'Max health increased by 100%'
    ]
  },
  armor: {
    id: 'armor',
    name: 'Armor',
    description: 'Reduces incoming enemy damage by 1 per rank.',
    iconName: 'armor',
    maxLevel: 5,
    perLevelDescription: [
      'Reduces incoming damage by 1',
      'Reduces incoming damage by 2',
      'Reduces incoming damage by 3',
      'Reduces incoming damage by 4',
      'Reduces incoming damage by 5'
    ]
  },
  pummarola: {
    id: 'pummarola',
    name: 'Pummarola',
    description: 'Recovers 0.6 HP per rank each second.',
    iconName: 'pummarola',
    maxLevel: 5,
    perLevelDescription: [
      'Heals 0.6 HP every second',
      'Heals 1.2 HP every second',
      'Heals 1.8 HP every second',
      'Heals 2.4 HP every second',
      'Heals 3.0 HP every second'
    ]
  },
  attractorb: {
    id: 'attractorb',
    name: 'Attractorb',
    description: 'Increases gem and item pickup radius by 30% per rank.',
    iconName: 'attractorb',
    maxLevel: 5,
    perLevelDescription: [
      'Item pickup radius increased by 30%',
      'Item pickup radius increased by 60%',
      'Item pickup radius increased by 90%',
      'Item pickup radius increased by 120%',
      'Item pickup radius increased by 150%'
    ]
  },
  clover: {
    id: 'clover',
    name: 'Clover',
    description: 'Increases critical strike chance and luck by 10% per rank.',
    iconName: 'clover',
    maxLevel: 5,
    perLevelDescription: [
      'Crit chance +10%, lucky item drops up',
      'Crit chance +20%, lucky item drops up',
      'Crit chance +30%, lucky item drops up',
      'Crit chance +40%, lucky item drops up',
      'Crit chance +50%, lucky item drops up'
    ]
  }
};
