import { Weapon } from '../Weapon';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';

export class Pentagram extends Weapon {
  constructor() {
    super('pentagram', 'Pentagram', 'pentagram');
    this.evolutionPairPassive = 'crown';
    this.evolvedName = 'Gorgeous Moon';
    this.evolvedDescription = 'Triggers celestial lunar pulses, obliterates waves, and vacuums all XP gems.';
    this.damage = 99999;
    this.cooldown = 45.0; // long cooldown
    this.area = 1.0;
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    // Screen wipe effect!
    combatSystem.triggerScreenNuke(this.isEvolved);
    sound.playExplosion(0.8, 1200);

    if (this.isEvolved) {
      // Vacuum all gems
      setTimeout(() => {
        combatSystem.vacuumAllGems();
      }, 500);
    }
  }

  public levelUp(): void {
    if (this.level >= this.maxLevel) return;
    this.level++;

    switch (this.level) {
      case 2:
        this.cooldown -= 3;
        break;
      case 3:
        this.cooldown -= 3;
        break;
      case 4:
        this.cooldown -= 4;
        break;
      case 5:
        this.cooldown -= 4;
        break;
      case 6:
        this.cooldown -= 5;
        break;
      case 7:
        this.cooldown -= 5;
        break;
      case 8:
        this.cooldown -= 6;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Cooldown reduced by 3s';
      case 3: return 'Cooldown reduced by 3s';
      case 4: return 'Cooldown reduced by 4s';
      case 5: return 'Cooldown reduced by 4s';
      case 6: return 'Cooldown reduced by 5s';
      case 7: return 'Cooldown reduced by 5s';
      case 8: return 'Cooldown reduced by 6s';
      default: return 'Reduces Pentagram recharge time';
    }
  }

  protected onEvolve(): void {
    this.cooldown = 15.0;
  }
}
