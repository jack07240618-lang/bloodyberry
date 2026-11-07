import { Weapon } from '../Weapon';
import { Projectile, ProjectileType } from '../Projectile';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';
import { Vector2 } from '../../core/Vector2';

export class MagicWand extends Weapon {
  constructor() {
    super('magic_wand', 'Magic Wand', 'magic_wand');
    this.evolutionPairPassive = 'empty_tome';
    this.evolvedName = 'Holy Wand';
    this.evolvedDescription = 'Fires without interruption with piercing holy beams.';
    this.damage = 15;
    this.cooldown = 1.2;
    this.projectileCount = 1;
    this.speed = 460;
    this.duration = 1.8;
    this.pierce = 1;
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    const totalCount = this.projectileCount + player.projectileCountBonus;
    const enemies = combatSystem.getNearestEnemies(player.position, 600, totalCount);

    for (let i = 0; i < totalCount; i++) {
      let targetPos: Vector2;
      if (enemies[i]) {
        targetPos = enemies[i].position.clone();
      } else if (enemies.length > 0) {
        targetPos = enemies[0].position.clone().add(new Vector2((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40));
      } else {
        // Fire forward if no enemy in range
        targetPos = player.position.clone().add(new Vector2(player.facingDirection * 200, (Math.random() - 0.5) * 60));
      }

      const dir = targetPos.clone().sub(player.position).normalize();
      const delay = i * 0.08; // slight staggering for multi-shot

      setTimeout(() => {
        if (!player.active || player.isDead) return;

        const proj = new Projectile(
          ProjectileType.DIRECT_BOLT,
          this.id,
          player.position.x,
          player.position.y,
          this.isEvolved ? 8 : 6,
          Math.round(this.damage * player.damageMult),
          this.pierce,
          this.duration
        );

        proj.velocity.copy(dir).multiplyScalar(this.speed);
        proj.color = this.isEvolved ? '#38bdf8' : '#818cf8';
        proj.glowColor = this.isEvolved ? '#0284c7' : '#4f46e5';

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
        this.cooldown *= 0.85;
        this.damage += 5;
        break;
      case 4:
        this.projectileCount += 1;
        break;
      case 5:
        this.damage += 8;
        this.speed += 50;
        break;
      case 6:
        this.projectileCount += 1;
        break;
      case 7:
        this.pierce += 1;
        this.cooldown *= 0.85;
        break;
      case 8:
        this.damage += 12;
        this.projectileCount += 1;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Fires 1 additional projectile';
      case 3: return 'Base Damage up by 5, Cooldown reduced by 15%';
      case 4: return 'Fires 1 additional projectile';
      case 5: return 'Base Damage up by 8, Projectile Speed up';
      case 6: return 'Fires 1 additional projectile';
      case 7: return 'Passes through 1 additional enemy';
      case 8: return 'Base Damage up by 12, Fires 1 additional projectile';
      default: return 'Upgrades Magic Wand efficiency';
    }
  }

  protected onEvolve(): void {
    this.cooldown = 0.22; // Rapid fire
    this.damage += 20;
    this.pierce += 2;
    this.speed += 120;
  }
}
