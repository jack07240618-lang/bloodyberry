import { Enemy, EnemyType, EnemyConfig } from './Enemy';

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  [EnemyType.WALKER]: {
    type: EnemyType.WALKER,
    name: 'Rotting Ghoul',
    maxHp: 22,
    speed: 70,
    damage: 8,
    radius: 12,
    xpValue: 1,
    knockbackResist: 0.1,
    color: '#4ade80'
  },
  [EnemyType.DASHER]: {
    type: EnemyType.DASHER,
    name: 'Vampiric Bat',
    maxHp: 12,
    speed: 135,
    damage: 6,
    radius: 10,
    xpValue: 1,
    knockbackResist: 0,
    color: '#f43f5e'
  },
  [EnemyType.SWARMER]: {
    type: EnemyType.SWARMER,
    name: 'Cave Spider',
    maxHp: 9,
    speed: 100,
    damage: 5,
    radius: 9,
    xpValue: 1,
    knockbackResist: 0,
    color: '#78716c'
  },
  [EnemyType.TANK]: {
    type: EnemyType.TANK,
    name: 'Iron Golem',
    maxHp: 140,
    speed: 48,
    damage: 18,
    radius: 18,
    xpValue: 5,
    knockbackResist: 0.75,
    color: '#64748b'
  },
  [EnemyType.MINOTAUR]: {
    type: EnemyType.MINOTAUR,
    name: 'Dread Minotaur',
    maxHp: 220,
    speed: 75,
    damage: 24,
    radius: 20,
    xpValue: 8,
    knockbackResist: 0.6,
    color: '#b45309'
  },
  [EnemyType.RANGED_SPITTER]: {
    type: EnemyType.RANGED_SPITTER,
    name: 'Abyssal Gargoyle',
    maxHp: 48,
    speed: 60,
    damage: 12,
    radius: 14,
    xpValue: 4,
    knockbackResist: 0.2,
    color: '#9333ea'
  },
  [EnemyType.SLIME_LARGE]: {
    type: EnemyType.SLIME_LARGE,
    name: 'Toxic Slime (L)',
    maxHp: 80,
    speed: 52,
    damage: 12,
    radius: 16,
    xpValue: 5,
    knockbackResist: 0.3,
    color: '#10b981'
  },
  [EnemyType.SLIME_MEDIUM]: {
    type: EnemyType.SLIME_MEDIUM,
    name: 'Toxic Slime (M)',
    maxHp: 35,
    speed: 68,
    damage: 8,
    radius: 12,
    xpValue: 2,
    knockbackResist: 0.15,
    color: '#10b981'
  },
  [EnemyType.SLIME_SMALL]: {
    type: EnemyType.SLIME_SMALL,
    name: 'Toxic Slime (S)',
    maxHp: 15,
    speed: 88,
    damage: 5,
    radius: 8,
    xpValue: 1,
    knockbackResist: 0,
    color: '#10b981'
  },
  [EnemyType.GHOST]: {
    type: EnemyType.GHOST,
    name: 'Spectral Phantom',
    maxHp: 40,
    speed: 115,
    damage: 10,
    radius: 13,
    xpValue: 3,
    knockbackResist: 0.1,
    color: '#38bdf8'
  },
  [EnemyType.BOSS_DEMON]: {
    type: EnemyType.BOSS_DEMON,
    name: 'Malakor the Defiler',
    maxHp: 2800,
    speed: 62,
    damage: 32,
    radius: 28,
    xpValue: 100,
    knockbackResist: 0.9,
    color: '#dc2626',
    isBoss: true
  }
};

export function createEnemy(type: EnemyType, x: number, y: number, waveMultiplier = 1.0): Enemy {
  const baseConfig = ENEMY_CONFIGS[type];
  const scaledConfig: EnemyConfig = {
    ...baseConfig,
    maxHp: Math.round(baseConfig.maxHp * waveMultiplier),
    damage: Math.round(baseConfig.damage * (1 + (waveMultiplier - 1) * 0.4))
  };

  return new Enemy(scaledConfig, x, y);
}
