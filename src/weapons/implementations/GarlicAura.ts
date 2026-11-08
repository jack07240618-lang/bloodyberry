import { Weapon } from '../Weapon';
import { Projectile, ProjectileType } from '../Projectile';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';

export class GarlicAura extends Weapon {
  private auraProjectile: Projectile | null = null;

  constructor() {
    super('garlic', 'Garlic', 'garlic');
    this.evolutionPairPassive = 'pummarola';
    this.evolvedName = 'Soul Eater';
    this.evolvedDescription = 'Expands into a massive vortex that absorbs life essence from defeated foes.';
    this.damage = 10;
    this.cooldown = 0.5;
    this.area = 60; // radius
  }

  public update(dt: number, player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    if (!player.active || player.isDead || !combatSystem.hasActiveEnemies()) {
      if (this.auraProjectile) {
        this.auraProjectile.active = false;
        this.auraProjectile = null;
      }
      return;
    }

    const currentRadius = this.area * player.areaMult * (this.isEvolved ? 1.5 : 1.0);
    const damage = Math.round(this.damage * player.damageMult);

    if (!this.auraProjectile || !this.auraProjectile.active) {
      this.auraProjectile = new Projectile(
        ProjectileType.GARLIC_AURA,
        this.id,
        player.position.x,
        player.position.y,
        currentRadius,
        damage,
        99999,
        99999
      );
      this.auraProjectile.hitInterval = 0.35;
      this.auraProjectile.color = this.isEvolved ? '#a855f7' : '#eab308';
      combatSystem.addProjectile(this.auraProjectile);
    } else {
      this.auraProjectile.position.copy(player.position);
      this.auraProjectile.radius = currentRadius;
      this.auraProjectile.damage = damage;
      this.auraProjectile.color = this.isEvolved ? '#a855f7' : '#eab308';
    }
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    // Garlic is continuous aura handled in update
  }

  public levelUp(): void {
    if (this.level >= this.maxLevel) return;
    this.level++;

    switch (this.level) {
      case 2:
        this.area += 10;
        this.damage += 3;
        break;
      case 3:
        this.damage += 4;
        break;
      case 4:
        this.area += 12;
        break;
      case 5:
        this.damage += 5;
        break;
      case 6:
        this.area += 15;
        this.damage += 6;
        break;
      case 7:
        this.damage += 8;
        break;
      case 8:
        this.area += 20;
        this.damage += 10;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Area +15%, Base Damage +3';
      case 3: return 'Base Damage +4';
      case 4: return 'Area +20%';
      case 5: return 'Base Damage +5';
      case 6: return 'Area +20%, Base Damage +6';
      case 7: return 'Base Damage +8';
      case 8: return 'Area +25%, Base Damage +10';
      default: return 'Upgrades Garlic potency';
    }
  }

  protected onEvolve(): void {
    this.damage += 25;
    this.area += 30;
  }
}
