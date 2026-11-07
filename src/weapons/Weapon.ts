import type { Player } from '../entities/Player';
import type { CombatSystem } from '../systems/CombatSystem';
import type { SoundSynthesizer } from '../core/SoundSynthesizer';

export interface WeaponUpgradeInfo {
  level: number;
  description: string;
}

export abstract class Weapon {
  public id: string;
  public name: string;
  public level = 1;
  public maxLevel = 8;
  public isEvolved = false;
  public evolutionPairPassive: string | null = null;
  public evolvedName: string | null = null;
  public evolvedDescription: string | null = null;
  public iconName: string;

  // Base Combat stats
  public cooldown = 1.0; // seconds
  public cooldownTimer = 0;
  public damage = 10;
  public projectileCount = 1;
  public pierce = 1;
  public speed = 350;
  public duration = 1.5;
  public area = 1.0;

  // Analytics
  public totalDamageDealt = 0;
  public totalKills = 0;

  constructor(id: string, name: string, iconName: string) {
    this.id = id;
    this.name = name;
    this.iconName = iconName;
  }

  public update(dt: number, player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    const effectiveCooldown = Math.max(0.08, this.cooldown * player.cooldownMult);
    this.cooldownTimer -= dt;

    if (this.cooldownTimer <= 0) {
      this.attack(player, combatSystem, sound);
      this.cooldownTimer = effectiveCooldown;
    }
  }

  public abstract attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void;
  public abstract levelUp(): void;
  public abstract getUpgradeDescription(level: number): string;

  public canEvolve(player: Player): boolean {
    if (this.isEvolved || this.level < this.maxLevel || !this.evolutionPairPassive) {
      return false;
    }
    return player.hasPassive(this.evolutionPairPassive);
  }

  public evolve(): void {
    if (this.isEvolved) return;
    this.isEvolved = true;
    if (this.evolvedName) {
      this.name = this.evolvedName;
    }
    this.onEvolve();
  }

  protected abstract onEvolve(): void;
}
