import { Weapon } from '../Weapon';
import { Projectile, ProjectileType } from '../Projectile';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';
import { Vector2 } from '../../core/Vector2';

export class PiercingDagger extends Weapon {
  constructor() {
    super('knife', 'Knife', 'knife');
    this.evolutionPairPassive = 'wings';
    this.evolvedName = 'Thousand Edge';
    this.evolvedDescription = 'Fires a relentless, unbroken volley of throwing daggers without delay.';
    this.damage = 12;
    this.cooldown = 1.0;
    this.projectileCount = 1;
    this.speed = 520;
    this.duration = 1.6;
    this.pierce = 2;
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    const totalCount = this.projectileCount + player.projectileCountBonus;
    const baseDir = player.moveDirection.lengthSq() > 0.001
      ? player.moveDirection.clone()
      : new Vector2(player.facingDirection, 0);

    for (let i = 0; i < totalCount; i++) {
      const delay = i * 0.05;
      const spreadAngle = (i - (totalCount - 1) / 2) * 0.08;

      setTimeout(() => {
        if (!player.active || player.isDead) return;

        const dir = baseDir.clone().rotate(spreadAngle).normalize();
        const proj = new Projectile(
          ProjectileType.PIERCING_DAGGER,
          this.id,
          player.position.x,
          player.position.y,
          this.isEvolved ? 10 : 7,
          Math.round(this.damage * player.damageMult),
          this.pierce,
          this.duration
        );

        proj.velocity.copy(dir).multiplyScalar(this.speed);
        combatSystem.addProjectile(proj);
        sound.playShoot('dagger');
      }, delay * 1000);
    }
  }

  public levelUp(): void {
    if (this.level >= this.maxLevel) return;
    this.level++;

    switch (this.level) {
      case 2:
        this.projectileCount += 1;
        break;
      case 3:
        this.projectileCount += 1;
        this.damage += 3;
        break;
      case 4:
        this.pierce += 1;
        this.speed += 60;
        break;
      case 5:
        this.projectileCount += 1;
        break;
      case 6:
        this.damage += 5;
        this.pierce += 1;
        break;
      case 7:
        this.projectileCount += 1;
        this.cooldown *= 0.85;
        break;
      case 8:
        this.damage += 8;
        this.pierce += 2;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Fires 1 additional knife';
      case 3: return 'Fires 1 additional knife, Base Damage +3';
      case 4: return 'Passes through 1 additional enemy, Speed up';
      case 5: return 'Fires 1 additional knife';
      case 6: return 'Base Damage +5, Pierce +1';
      case 7: return 'Fires 1 additional knife, Cooldown -15%';
      case 8: return 'Base Damage +8, Pierce +2';
      default: return 'Upgrades Knife capability';
    }
  }

  protected onEvolve(): void {
    this.cooldown = 0.15; // Rapid stream
    this.pierce += 3;
    this.damage += 15;
    this.speed += 120;
  }
}
