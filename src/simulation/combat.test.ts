import assert from 'node:assert/strict';
import { Player } from '../entities/Player';
import { EnemyProjectile, EnemyType } from '../enemies/Enemy';
import { createEnemy } from '../enemies/EnemyRegistry';
import { Vector2 } from '../core/Vector2';
import { CombatSystem } from '../systems/CombatSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { DamageTextSystem } from '../systems/DamageTextSystem';
import { Camera } from '../core/Camera';
import { getSkillBarLayout } from '../ui/SkillBarLayout';

const noop = () => {};
function fixture() {
  const sound = new Proxy({}, { get: () => noop });
  const combat = new CombatSystem(new ParticleSystem(), new DamageTextSystem(),
    { shrines: [], destructibles: [], mysteryDoor: null } as any, sound as any, new Camera(1280, 720));
  const player = new Player();
  const tick = (dt = 1 / 60) => {
    player.update(dt);
    combat.update(dt, player, noop, noop);
  };
  return { combat, player, tick };
}

// Ordinary melee attacks retain harmless anticipation after removing active guard.
for (const type of [EnemyType.WALKER, EnemyType.DASHER, EnemyType.SWARMER, EnemyType.TANK,
  EnemyType.GHOST, EnemyType.SLIME_LARGE, EnemyType.SLIME_MEDIUM, EnemyType.SLIME_SMALL]) {
  const f = fixture();
  const e = createEnemy(type, 18, 0); e.spawnTimer = 0;
  f.combat.enemies.push(e);
  for (let i = 0; i < 31; i++) f.tick();
  assert.equal(e.attackState, 'WINDUP', type);
  assert.equal(f.player.hp, 100, type);
  for (let i = 0; i < 5; i++) f.tick();
  assert.ok(f.player.hp < 100, type);
}

// Flying bullets deal normal damage without an active guard.
{
  const f = fixture();
  const bullet = new EnemyProjectile(0, 0, new Vector2(), 0, 12);
  f.combat.enemyProjectiles.push(bullet); f.tick();
  assert.ok(f.player.hp < 100);
  assert.equal(bullet.isReflected, false);
}

// Attacks land only once, even if invulnerability is cleared.
{
  const f = fixture();
  const e = createEnemy(EnemyType.WALKER, 18, 0); e.spawnTimer = 0;
  f.combat.enemies.push(e);
  for (let i = 0; i < 36; i++) f.tick();
  assert.ok(f.player.hp < 100);
  const hp = f.player.hp;
  f.player.iFrameTimer = 0;
  f.tick();
  assert.equal(f.player.hp, hp);
}

// Windup aim is locked; stepping out of the committed swing avoids damage.
{
  const p = new Player();
  const e = createEnemy(EnemyType.WALKER, 18, 0); e.spawnTimer = 0;
  e.updateEnemy(0.01, p, new Vector2());
  p.position.set(36, 0);
  e.updateEnemy(0.56, p, new Vector2());
  assert.equal(e.canStrikePlayer(p), false);
}

// Ranged units telegraph before firing and do not track a dodge during the tell.
{
  const p = new Player();
  const e = createEnemy(EnemyType.RANGED_SPITTER, 250, 0); e.spawnTimer = 0;
  const shots: EnemyProjectile[] = [];
  const fire = (shot: EnemyProjectile) => shots.push(shot);
  e.updateEnemy(0.01, p, new Vector2(), fire);
  assert.equal(e.attackState, 'WINDUP');
  assert.equal(shots.length, 0);
  p.position.set(500, 0);
  e.updateEnemy(0.54, p, new Vector2(), fire);
  assert.equal(shots.length, 0);
  e.updateEnemy(0.02, p, new Vector2(), fire);
  assert.equal(shots.length, 1);
  assert.ok(shots[0].velocity.x < 0);
  assert.equal(e.canStrikePlayer(p), false);
}

for (const width of [320, 375, 768, 1280]) {
  const layout = getSkillBarLayout(width, 720);
  assert.ok(layout.startX >= 0);
  assert.ok(layout.startX + layout.count * layout.slotW + (layout.count - 1) * layout.gap <= width);
}
console.log('Combat checks passed: single-hit strikes, windup dodge, ranged tell, HUD layout.');
