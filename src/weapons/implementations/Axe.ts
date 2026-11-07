import { Weapon } from '../Weapon';
import { Projectile, ProjectileType } from '../Projectile';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';
import { Vector2 } from '../../core/Vector2';

export class Axe extends Weapon {
  constructor() {
    super('axe', 'Axe', 'axe');
    this.evolutionPairPassive = 'spinach';
    this.evolvedName = 'Death Spiral';
    this.evolvedDescription = 'Unleashes an expanding vortex of piercing death scythes in all directions.';
    this.damage = 30;
    this.cooldown = 2.2;
    this.projectileCount = 1;
    this.duration = 2.0;
    this.pierce = 999;
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    if (this.isEvolved) {
      // 8-way radiating death scythes
      const scytheCount = 8;
      for (let i = 0; i < scytheCount; i++) {
        const angle = (i * Math.PI * 2) / scytheCount;
        const dir = Vector2.fromAngle(angle);

        const proj = new Projectile(
          ProjectileType.ARCBALLISTIC_AXE,
          this.id,
          player.position.x,
          player.position.y,
          16,
          Math.round(this.damage * player.damageMult),
          999,
          2.5
        );

        proj.velocity.copy(dir).multiplyScalar(320);
        proj.color = '#dc2626';
        proj.glowColor = '#991b1b';
        combatSystem.addProjectile(proj);
      }
      sound.playShoot('dagger');
      return;
    }

    // Normal high arc lob
    const totalCount = this.projectileCount + player.projectileCountBonus;
    for (let i = 0; i < totalCount; i++) {
      const spreadX = (i - (totalCount - 1) / 2) * 90;
      const proj = new Projectile(
        ProjectileType.ARCBALLISTIC_AXE,
        this.id,
        player.position.x,
        player.position.y,
        12,
        Math.round(this.damage * player.damageMult),
        this.pierce,
        this.duration
      );

      // Launch up and slightly outward
      proj.velocity.set(player.facingDirection * 120 + spreadX, -420);
      proj.color = '#94a3b8';
      proj.glowColor = '#cbd5e1';

      combatSystem.addProjectile(proj);
    }

    sound.playShoot('dagger');
  }

  public levelUp(): void {
    if (this.level >= this.maxLevel) return;
    this.level++;

    switch (this.level) {
      case 2:
        this.projectileCount += 1;
        break;
      case 3:
        this.damage += 10;
        break;
      case 4:
        this.projectileCount += 1;
        break;
      case 5:
        this.damage += 15;
        this.cooldown *= 0.85;
        break;
      case 6:
        this.projectileCount += 1;
        break;
      case 7:
        this.damage += 20;
        break;
      case 8:
        this.projectileCount += 1;
        this.damage += 25;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Throws 1 additional axe';
      case 3: return 'Base Damage +10';
      case 4: return 'Throws 1 additional axe';
      case 5: return 'Base Damage +15, Cooldown -15%';
      case 6: return 'Throws 1 additional axe';
      case 7: return 'Base Damage +20';
      case 8: return 'Throws 1 additional axe, Base Damage +25';
      default: return 'Upgrades Axe destruction';
    }
  }

  protected onEvolve(): void {
    this.damage += 35;
    this.cooldown = 1.6;
  }
}
