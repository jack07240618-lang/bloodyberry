import { Weapon } from '../Weapon';
import { Projectile, ProjectileType } from '../Projectile';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';
import { Vector2 } from '../../core/Vector2';

export class Whip extends Weapon {
  constructor() {
    super('whip', 'Whip', 'whip');
    this.evolutionPairPassive = 'hollow_heart';
    this.evolvedName = 'Bloody Tear';
    this.evolvedDescription = 'Deals devastating critical strikes and recovers health on impact.';
    this.damage = 20;
    this.cooldown = 1.35;
    this.projectileCount = 1;
    this.area = 55;
    this.duration = 0.22;
    this.pierce = 999;
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    const totalCount = this.projectileCount + player.projectileCountBonus;

    for (let i = 0; i < totalCount; i++) {
      // Alternate front / back
      const dir = (i % 2 === 0) ? player.facingDirection : -player.facingDirection;
      const offsetX = dir * (this.area * 0.8);
      const isCrit = this.isEvolved || Math.random() < player.critChance;
      const dmg = Math.round(this.damage * player.damageMult * (isCrit ? 2.0 : 1.0));

      const proj = new Projectile(
        ProjectileType.WHIP_SLASH,
        this.id,
        player.position.x + offsetX,
        player.position.y - 4,
        this.area * player.areaMult,
        dmg,
        this.pierce,
        this.duration
      );

      proj.isCrit = isCrit;
      proj.color = this.isEvolved ? '#ef4444' : '#f59e0b';
      proj.glowColor = this.isEvolved ? '#b91c1c' : '#b45309';

      combatSystem.addProjectile(proj);

      // Bloody Tear life leech
      if (this.isEvolved && isCrit) {
        player.heal(4);
      }
    }

    sound.playShoot('dagger');
  }

  public levelUp(): void {
    if (this.level >= this.maxLevel) return;
    this.level++;

    switch (this.level) {
      case 2:
        this.damage += 5;
        this.area += 8;
        break;
      case 3:
        this.projectileCount += 1;
        break;
      case 4:
        this.damage += 8;
        break;
      case 5:
        this.area += 10;
        this.cooldown *= 0.85;
        break;
      case 6:
        this.damage += 10;
        break;
      case 7:
        this.projectileCount += 1;
        break;
      case 8:
        this.damage += 15;
        this.area += 12;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Base Damage +5, Area +15%';
      case 3: return 'Strikes behind as well (+1 Strike)';
      case 4: return 'Base Damage +8';
      case 5: return 'Area +20%, Cooldown -15%';
      case 6: return 'Base Damage +10';
      case 7: return 'Strikes +1 additional time';
      case 8: return 'Base Damage +15, Area +25%';
      default: return 'Upgrades Whip power';
    }
  }

  protected onEvolve(): void {
    this.damage += 25;
    this.cooldown = 1.0;
    this.area += 20;
  }
}
