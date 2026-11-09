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
  let parrySounds = 0, hitStop = 0;
  const sound = new Proxy({}, { get: (_, key) => key === 'playParry' ? () => { parrySounds++; } : noop });
  const combat = new CombatSystem(new ParticleSystem(), new DamageTextSystem(),
    { shrines: [], destructibles: [], mysteryDoor: null } as any, sound as any, new Camera(1280, 720));
  const player = new Player();
  const tick = (dt = 1 / 60) => {
    player.update(dt);
    combat.update(dt, player, noop, noop, duration => { hitStop = duration; });
  };
  return { combat, player, tick, sounds: () => parrySounds, stop: () => hitStop };
}

// Whiffs consume the cooldown without granting health, invulnerability, or a success effect.
{
  const p = new Player();
  assert.ok(p.tryParry());
  assert.equal(p.tryParry(), false);
  assert.equal(p.tryDash(), false);
  p.update(0.25);
  assert.equal(p.parryActiveTimer, 0);
  assert.equal(p.parrySuccessTimer, 0);
  assert.equal(p.iFrameTimer, 0);
  assert.equal(p.completeParry(), false);
  p.update(4.25);
  assert.ok(p.tryParry());
  const dashing = new Player();
  assert.ok(dashing.tryDash());
  assert.equal(dashing.tryParry(), false);
  dashing.isDead = true;
  assert.equal(dashing.tryParry(), false);
}

// Every ordinary melee archetype has harmless windup, committed aim, then one damaging strike.
for (const type of [EnemyType.WALKER, EnemyType.DASHER, EnemyType.SWARMER, EnemyType.TANK,
  EnemyType.GHOST, EnemyType.SLIME_LARGE, EnemyType.SLIME_MEDIUM, EnemyType.SLIME_SMALL]) {
  const f = fixture();
  const e = createEnemy(type, 18, 0);
  e.spawnTimer = 0;
  f.combat.enemies.push(e);
  f.tick();
  assert.equal(e.attackState, 'WINDUP', type);
  for (let i = 0; i < 30; i++) f.tick();
  assert.equal(f.player.hp, 100, `${type}: no damage during windup`);
  assert.ok(f.player.tryParry());
  for (let i = 0; i < 5; i++) f.tick();
  assert.equal(f.player.hp, 100, `${type}: successful guard prevents damage`);
  assert.ok(e.staggerTimer > 0, type);
  assert.equal(f.sounds(), 1, type);
  assert.ok(f.player.parrySuccessTimer > 0);
  assert.ok(f.player.parryCooldown > 4);
  assert.ok(f.stop() > 0);
}

// Without a guard, the attack lands only once, even if invulnerability is cleared.
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

// A manual guard reflects hostile flying bullets once, with sound, hitstop and feedback.
{
  const f = fixture();
  const bullet = new EnemyProjectile(20, 0, new Vector2(-1, 0), 100, 12);
  f.combat.enemyProjectiles.push(bullet);
  f.player.tryParry(); f.tick();
  assert.ok(bullet.isReflected);
  assert.ok(bullet.velocity.x > 0);
  assert.equal(f.player.hp, 100);
  assert.equal(f.sounds(), 1);
  f.tick();
  assert.equal(f.sounds(), 1);
}
// Expired guards and ground hazards cannot be used as free invulnerability.
for (const meteor of [false, true]) {
  const f = fixture(); f.player.tryParry();
  if (!meteor) f.player.update(0.25);
  const bullet = new EnemyProjectile(0, 0, new Vector2(), 0, 12, '#ef4444', meteor ? 'METEOR_ZONE' : 'ORB');
  if (meteor) bullet.lifetime = 0.16;
  f.combat.enemyProjectiles.push(bullet); f.tick();
  assert.ok(f.player.hp < 100);
  assert.equal(f.sounds(), 0);
  assert.equal(bullet.isReflected, false);
}
// Minotaur charge has safe anticipation and can be interrupted on impact.
{
  const f = fixture();
  const e = createEnemy(EnemyType.MINOTAUR, 18, 0); e.spawnTimer = 0;
  e.chargeState = 'TELEGRAPH'; e.chargeTimer = 0.5;
  assert.equal(e.canStrikePlayer(f.player), false);
  e.chargeState = 'CHARGING'; e.chargeTimer = 0.5; e.chargeDirection.set(-1, 0);
  f.combat.enemies.push(e); f.player.tryParry(); f.tick();
  assert.ok(e.staggerTimer > 0);
  assert.equal(e.chargeState, 'COOLDOWN');
  assert.equal(f.player.hp, 100);
}

for (const width of [320, 375, 768, 1280]) {
  const layout = getSkillBarLayout(width, 720);
  assert.ok(layout.startX >= 0);
  assert.ok(layout.startX + layout.count * layout.slotW + (layout.count - 1) * layout.gap <= width);
}
console.log('Parry checks passed: whiff, cooldown, 8 melee tells, one-hit strikes, dodge, ranged tell, reflection, hazards, charge, HUD layout.');
