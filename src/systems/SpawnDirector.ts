import { CombatSystem } from './CombatSystem';
import { Player } from '../entities/Player';
import { Vector2 } from '../core/Vector2';
import { EnemyType } from '../enemies/Enemy';
import { createEnemy } from '../enemies/EnemyRegistry';

export class SpawnDirector {
  public elapsedSeconds = 0;
  private spawnInterval = 0.8;
  private spawnTimer = 0;
  private maxActiveEnemies = 450;

  // Wave event flags
  private bossSpawned3Min = false;
  private bossSpawned7Min = false;
  private bossSpawned10Min = false;
  private lastCircleEvent = 0;

  constructor(private combatSystem: CombatSystem) {}

  public reset(): void {
    this.elapsedSeconds = 0;
    this.spawnTimer = 0;
    this.bossSpawned3Min = false;
    this.bossSpawned7Min = false;
    this.bossSpawned10Min = false;
    this.lastCircleEvent = 0;
  }

  public update(dt: number, player: Player): void {
    this.elapsedSeconds += dt;
    this.spawnTimer += dt;

    // Difficulty scaling: spawn rate speeds up over time
    // At 0m: interval ~ 0.8s, at 5m: interval ~ 0.25s, at 10m: interval ~ 0.12s
    this.spawnInterval = Math.max(0.1, 0.85 / (1 + this.elapsedSeconds * 0.007));

    // Wave Events
    this.checkTimedEvents(player);

    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      if (this.combatSystem.enemies.length < this.maxActiveEnemies) {
        this.spawnNormalWave(player);
      }
    }
  }

  private checkTimedEvents(player: Player): void {
    // 3 Minute Mini-Boss: Dread Minotaur
    if (this.elapsedSeconds >= 180 && !this.bossSpawned3Min) {
      this.bossSpawned3Min = true;
      this.spawnBossAt(player.position, EnemyType.MINOTAUR, 1.5);
    }

    // 7 Minute Mini-Boss: Armored Golem King
    if (this.elapsedSeconds >= 420 && !this.bossSpawned7Min) {
      this.bossSpawned7Min = true;
      this.spawnBossAt(player.position, EnemyType.TANK, 2.5);
    }

    // 10 Minute Arch-Demon: Malakor the Defiler
    if (this.elapsedSeconds >= 600 && !this.bossSpawned10Min) {
      this.bossSpawned10Min = true;
      this.spawnBossAt(player.position, EnemyType.BOSS_DEMON, 3.0);
    }

    // Encircling swarm event every 2.5 minutes (150s, 300s, 450s, etc.)
    if (this.elapsedSeconds >= 90 && this.elapsedSeconds - this.lastCircleEvent >= 150) {
      this.lastCircleEvent = this.elapsedSeconds;
      this.triggerCircleFormation(player);
    }
  }

  private spawnNormalWave(player: Player): void {
    // Determine pool based on elapsed minutes
    const minutes = this.elapsedSeconds / 60;
    const waveMultiplier = 1.0 + minutes * 0.22;

    let pool: { type: EnemyType; weight: number }[] = [];

    if (minutes < 1.0) {
      pool = [{ type: EnemyType.WALKER, weight: 100 }];
    } else if (minutes < 2.0) {
      pool = [
        { type: EnemyType.WALKER, weight: 60 },
        { type: EnemyType.DASHER, weight: 40 }
      ];
    } else if (minutes < 4.0) {
      pool = [
        { type: EnemyType.WALKER, weight: 40 },
        { type: EnemyType.DASHER, weight: 30 },
        { type: EnemyType.SWARMER, weight: 30 }
      ];
    } else if (minutes < 6.0) {
      pool = [
        { type: EnemyType.SLIME_LARGE, weight: 25 },
        { type: EnemyType.SWARMER, weight: 35 },
        { type: EnemyType.TANK, weight: 20 },
        { type: EnemyType.RANGED_SPITTER, weight: 20 }
      ];
    } else if (minutes < 8.0) {
      pool = [
        { type: EnemyType.GHOST, weight: 30 },
        { type: EnemyType.MINOTAUR, weight: 15 },
        { type: EnemyType.TANK, weight: 25 },
        { type: EnemyType.RANGED_SPITTER, weight: 30 }
      ];
    } else {
      // Endgame 8+ minutes: full onslaught
      pool = [
        { type: EnemyType.GHOST, weight: 25 },
        { type: EnemyType.MINOTAUR, weight: 20 },
        { type: EnemyType.TANK, weight: 25 },
        { type: EnemyType.SLIME_LARGE, weight: 15 },
        { type: EnemyType.RANGED_SPITTER, weight: 15 }
      ];
    }

    // Pick random from weighted pool
    const totalWeight = pool.reduce((acc, p) => acc + p.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosenType = pool[0].type;
    for (const entry of pool) {
      if (roll < entry.weight) {
        chosenType = entry.type;
        break;
      }
      roll -= entry.weight;
    }

    // Spawn 1 to 3 enemies per trigger
    const batchSize = minutes > 4 ? (Math.random() < 0.6 ? 2 : 3) : 1;
    for (let i = 0; i < batchSize; i++) {
      const spawnPos = this.getRandomOffscreenPosition(player.position);
      const enemy = createEnemy(chosenType, spawnPos.x, spawnPos.y, waveMultiplier);
      this.combatSystem.addEnemy(enemy);
    }
  }

  private triggerCircleFormation(player: Player): void {
    const ringRadius = 550;
    const count = 36;
    const waveMult = 1.0 + (this.elapsedSeconds / 60) * 0.2;

    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count;
      const x = player.position.x + Math.cos(angle) * ringRadius;
      const y = player.position.y + Math.sin(angle) * ringRadius;
      const enemy = createEnemy(EnemyType.WALKER, x, y, waveMult);
      this.combatSystem.addEnemy(enemy);
    }
  }

  private spawnBossAt(playerPos: Vector2, type: EnemyType, waveMultiplier: number): void {
    const spawnPos = this.getRandomOffscreenPosition(playerPos);
    const boss = createEnemy(type, spawnPos.x, spawnPos.y, waveMultiplier);
    boss.isBoss = true;
    this.combatSystem.addEnemy(boss);
  }

  private getRandomOffscreenPosition(playerPos: Vector2): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    const dist = 520 + Math.random() * 150;
    return new Vector2(playerPos.x + Math.cos(angle) * dist, playerPos.y + Math.sin(angle) * dist);
  }
}
