import assert from 'node:assert/strict';
import { Player } from '../entities/Player';
import { DropType } from '../entities/DropItem';
import { CombatSystem } from '../systems/CombatSystem';
import { RoomManager, RoomType, RoomState } from '../systems/RoomManager';
import { BuildEventBus, SkillTag } from '../systems/BuildSystem';
import { createEnemy } from '../enemies/EnemyRegistry';
import { EnemyType } from '../enemies/Enemy';
import { Projectile, ProjectileType } from '../weapons/Projectile';
import { ALL_WEAPON_DEFINITIONS } from '../weapons/WeaponRegistry';

const noop = () => {};
function combatFixture(): CombatSystem {
  return new CombatSystem(
    { emitBossSlainBurst: noop, emitDeath: noop, emitLevelUpFanfare: noop, emitHit: noop } as any,
    { addDamage: noop } as any,
    { addBloodDecal: noop, shrines: [] } as any,
    { playBossSlain: noop, playEnemyDeath: noop, playLevelUp: noop, setBiomeBGMHint: noop } as any,
    { triggerShake: noop } as any
  );
}
function withRandom<T>(value: number, run: () => T): T {
  const saved = Math.random;
  Math.random = () => value;
  try { return run(); } finally { Math.random = saved; }
}
function clearRoom(combat: CombatSystem, type: RoomType) {
  const manager = Object.create(RoomManager.prototype) as any;
  manager.combatSystem = combat;
  manager.currentRoom = { type, state: RoomState.ACTIVE_LOCKED, doors: [{ isOpen: false }], interactables: [] };
  manager.onRoomCleared(new Player());
  assert.equal(manager.currentRoom.state, RoomState.CLEARED);
  assert.ok(manager.currentRoom.doors.every((door: any) => door.isOpen));
  return manager.currentRoom.interactables.length;
}

// Identical XP budgets must produce fewer upgrades than the saved baseline.
for (const budget of [12, 24, 100, 300, 1000, 5000]) {
  const player = new Player();
  player.gainXp(budget);
  let oldLevel = 1, oldXp = budget, oldThreshold = 12;
  while (oldXp >= oldThreshold) {
    oldXp -= oldThreshold;
    oldLevel++;
    oldThreshold = Math.floor(12 * Math.pow(1.24, oldLevel - 1) + oldLevel * 7);
  }
  assert.ok(player.level <= oldLevel, `XP ${budget}: new level ${player.level}, old ${oldLevel}`);
  assert.equal(player.pendingLevelUps, player.level - 1);
}
const earlyPlayer = new Player();
assert.equal(earlyPlayer.gainXp(12), false);
assert.equal(earlyPlayer.gainXp(12), true);
const player = new Player();
for (let i = 0; i < 5; i++) {
  player.addPassive('hollow_heart'); player.addPassive('armor'); player.addPassive('attractorb');
}
assert.equal(player.maxHp, 125);
assert.equal(player.armor, 2);
assert.equal(player.pickupRadius, 135);

// Deterministic probability boundaries; a failed roll must still unlock every exit.
for (const [type, chance] of [[RoomType.COMBAT, 0.35], [RoomType.ELITE, 0.6]] as const) {
  assert.equal(withRandom(chance - 0.001, () => clearRoom(combatFixture(), type)), 1);
  assert.equal(withRandom(chance, () => clearRoom(combatFixture(), type)), 0);
}
for (const roll of [0.449, 0.45]) {
  const combat = combatFixture();
  withRandom(roll, () => {
    for (let i = 0; i < 3; i++) combat.handleEnemyDeath(createEnemy(EnemyType.BOSS_DEMON, 0, 0));
  });
  const expected = roll < 0.45 ? 1 : 0;
  assert.equal(combat.dropItems.filter(d => d.type === DropType.BOSS_CHEST).length, expected);
  assert.equal(withRandom(0, () => clearRoom(combat, RoomType.ELITE)), expected ? 0 : 1);
  // Room transition must restore the opportunity to roll a chest.
  withRandom(0.9, () => new RoomManager(combat));
  assert.equal(combat.bossChestRolledThisRoom, false);
  assert.equal(combat.bossChestDroppedThisRoom, false);
}

// Exercise the active projectile decorator, not only the passive registry text.
const combat = combatFixture();
const shooter = new Player();
shooter.addPassive('spinach');
const weapon = ALL_WEAPON_DEFINITIONS.magic_wand.create();
shooter.addWeapon(weapon);
combat.notifyWeaponAttackStart(weapon, shooter);
const shot = new Projectile(ProjectileType.DIRECT_BOLT, weapon.id, 0, 0, 8, 100, 1, 2);
shot.velocity.set(100, 0);
combat.addProjectile(shot);
assert.equal(combat.projectiles.length, 3);
assert.deepEqual(combat.projectiles.map(p => p.damage), [21, 21, 60]);

// Life leech no longer heals 2 HP or succeeds at the old high proc rates.
const bus = new BuildEventBus();
const leech = new Player();
for (let i = 0; i < 5; i++) leech.addPassive('pummarola');
const target = createEnemy(EnemyType.WALKER, 0, 0);
const hit = new Projectile(ProjectileType.DIRECT_BOLT, 'whip', 0, 0, 8, 10, 1, 1);
hit.tags.add(SkillTag.MELEE);
leech.hp = 50;
withRandom(0.1, () => bus.emitOnHit({ player: leech, projectile: hit, enemy: target, damage: 10, isFourthStroke: false, combatSystem: combat }));
assert.equal(leech.hp, 51);
withRandom(0.2, () => bus.emitOnHit({ player: leech, projectile: hit, enemy: target, damage: 10, isFourthStroke: false, combatSystem: combat }));
assert.equal(leech.hp, 51);
console.log('Balance regression checks passed: progression, reward boundaries, multi-boss cap, reset, scatter, leech.');
