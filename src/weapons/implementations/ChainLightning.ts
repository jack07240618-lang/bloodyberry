import { Weapon } from '../Weapon';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';
import { Vector2 } from '../../core/Vector2';

export class ChainLightning extends Weapon {
  constructor() {
    super('lightning_ring', 'Lightning Ring', 'lightning_ring');
    this.evolutionPairPassive = 'duplicator';
    this.evolvedName = 'Thunder Loop';
    this.evolvedDescription = 'Strikes twice per thunderbolt, generating explosive electrical shockwaves.';
    this.damage = 35;
    this.cooldown = 3.5;
    this.projectileCount = 2;
    this.area = 30; // strike radius
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    const totalStrikes = this.projectileCount + player.projectileCountBonus;
    const enemies = combatSystem.getNearestEnemies(player.position, 650, totalStrikes * 3);

    if (enemies.length === 0) return;

    for (let i = 0; i < totalStrikes; i++) {
      const delay = i * 0.12;
      setTimeout(() => {
        if (!player.active || player.isDead) return;

        // Pick random enemy from candidates
        const target = enemies[Math.floor(Math.random() * enemies.length)];
        if (!target || !target.active) return;

        this.strikeAt(target.position, player, combatSystem, sound);

        if (this.isEvolved) {
          // Double strike after 0.18s
          setTimeout(() => {
            if (target.active) {
              this.strikeAt(target.position, player, combatSystem, sound, true);
            }
          }, 180);
        }
      }, delay * 1000);
    }
  }

  private strikeAt(pos: Vector2, player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer, isSecondary = false): void {
    const strikeRadius = this.area * player.areaMult * (this.isEvolved ? 1.5 : 1.0);
    const damage = Math.round(this.damage * player.damageMult * (isSecondary ? 0.75 : 1.0));

    // Deal damage to all enemies in blast radius
    combatSystem.dealAreaDamage(pos, strikeRadius, damage, this.id);

    // Spawn visual lightning bolt & ground blast particles
    combatSystem.spawnLightningVisual(pos, strikeRadius, this.isEvolved);
    sound.playShoot('lightning');
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
        this.area += 6;
        break;
      case 4:
        this.projectileCount += 1;
        break;
      case 5:
        this.damage += 15;
        break;
      case 6:
        this.projectileCount += 1;
        break;
      case 7:
        this.cooldown *= 0.85;
        this.damage += 10;
        break;
      case 8:
        this.projectileCount += 1;
        this.area += 10;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Strikes 1 additional enemy';
      case 3: return 'Base Damage +10, Area +20%';
      case 4: return 'Strikes 1 additional enemy';
      case 5: return 'Base Damage +15';
      case 6: return 'Strikes 1 additional enemy';
      case 7: return 'Cooldown -15%, Base Damage +10';
      case 8: return 'Strikes 1 additional enemy, Area +25%';
      default: return 'Upgrades Lightning Ring power';
    }
  }

  protected onEvolve(): void {
    this.damage += 30;
    this.projectileCount += 2;
    this.area += 20;
    this.cooldown = 2.4;
  }
}
