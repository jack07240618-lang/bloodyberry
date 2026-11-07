import { Weapon } from '../Weapon';
import { Projectile, ProjectileType } from '../Projectile';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';
import { Vector2 } from '../../core/Vector2';

export class FireWand extends Weapon {
  constructor() {
    super('fire_wand', 'Fire Wand', 'fire_wand');
    this.evolutionPairPassive = 'spinach';
    this.evolvedName = 'Hellfire';
    this.evolvedDescription = 'Launches catastrophic blazing meteors that pierce all obstacles.';
    this.damage = 35;
    this.cooldown = 2.4;
    this.projectileCount = 1;
    this.speed = 280;
    this.duration = 2.2;
    this.pierce = 2;
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    const totalCount = this.projectileCount + player.projectileCountBonus;
    const enemies = combatSystem.getNearestEnemies(player.position, 550, totalCount);

    for (let i = 0; i < totalCount; i++) {
      let targetPos: Vector2;
      if (enemies[i]) {
        targetPos = enemies[i].position.clone();
      } else {
        const angle = Math.random() * Math.PI * 2;
        targetPos = player.position.clone().add(new Vector2(Math.cos(angle) * 300, Math.sin(angle) * 300));
      }

      const dir = targetPos.clone().sub(player.position).normalize();
      const delay = i * 0.12;

      setTimeout(() => {
        if (!player.active || player.isDead) return;

        const proj = new Projectile(
          ProjectileType.FIREBALL,
          this.id,
          player.position.x,
          player.position.y,
          this.isEvolved ? 22 : 14,
          Math.round(this.damage * player.damageMult),
          this.isEvolved ? 999 : this.pierce,
          this.duration
        );

        proj.velocity.copy(dir).multiplyScalar(this.isEvolved ? this.speed * 1.3 : this.speed);
        proj.color = this.isEvolved ? '#7f1d1d' : '#ea580c';
        combatSystem.addProjectile(proj);
        sound.playShoot('wand');
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
        this.damage += 12;
        break;
      case 4:
        this.projectileCount += 1;
        break;
      case 5:
        this.damage += 15;
        this.speed += 40;
        break;
      case 6:
        this.projectileCount += 1;
        break;
      case 7:
        this.damage += 20;
        this.cooldown *= 0.85;
        break;
      case 8:
        this.projectileCount += 1;
        this.damage += 25;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Fires 1 additional fireball';
      case 3: return 'Base Damage +12';
      case 4: return 'Fires 1 additional fireball';
      case 5: return 'Base Damage +15, Projectile Speed +15%';
      case 6: return 'Fires 1 additional fireball';
      case 7: return 'Base Damage +20, Cooldown -15%';
      case 8: return 'Fires 1 additional fireball, Base Damage +25';
      default: return 'Upgrades Fire Wand destruction';
    }
  }

  protected onEvolve(): void {
    this.damage += 45;
    this.pierce = 999;
    this.cooldown = 1.6;
  }
}
