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
    this.damage = 22;
    this.cooldown = 1.25;
    this.projectileCount = 1;
    this.area = 90;
    this.duration = 0.36;
    this.pierce = 999;
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    const totalCount = this.projectileCount + player.projectileCountBonus;
    const targets = combatSystem.getNearestEnemies(player.position, 950, Math.max(4, totalCount));
    const primaryTarget = targets[0];
    const baseAngle = primaryTarget
      ? Math.atan2(primaryTarget.position.y - player.position.y, primaryTarget.position.x - player.position.x)
      : player.facingDirection >= 0
      ? 0
      : Math.PI;

    // Face toward the enemy being cleaved
    if (primaryTarget) {
      player.facingDirection = Math.cos(baseAngle) >= 0 ? 1 : -1;
    }

    for (let i = 0; i < totalCount; i++) {
      // Aim 1st cleave directly at nearest enemy (full 360-degree directional cleave!);
      // subsequent cleaves target other nearby enemies or fan/reverse around baseAngle
      let aimAngle = baseAngle;
      if (i > 0) {
        const secondaryTarget = targets[i];
        if (secondaryTarget) {
          aimAngle = Math.atan2(
            secondaryTarget.position.y - player.position.y,
            secondaryTarget.position.x - player.position.x
          );
        } else {
          aimAngle = i % 2 === 1 ? baseAngle + Math.PI : baseAngle + (i % 4 === 2 ? 0.55 : -0.55);
        }
      }

      const cosA = Math.cos(aimAngle);
      const sinA = Math.sin(aimAngle);
      const offsetX = cosA * 20;
      const offsetY = sinA * 20;
      const isCrit = this.isEvolved || Math.random() < player.critChance;
      const dmg = Math.round(this.damage * player.damageMult * (isCrit ? 2.0 : 1.0));

      const proj = new Projectile(
        ProjectileType.WHIP_SLASH,
        this.id,
        player.position.x + offsetX,
        player.position.y + offsetY,
        this.area * player.areaMult * 1.18,
        dmg,
        this.pierce,
        0.38
      );

      proj.rotation = aimAngle; // Full 360-degree radian angle toward target!
      proj.velocity.set(cosA * 185, sinA * 185); // High-velocity directional Sword Qi wave!
      proj.isCrit = isCrit;
      proj.isEvolved = this.isEvolved;
      proj.color = this.isEvolved ? '#ef4444' : '#38bdf8';
      proj.glowColor = this.isEvolved ? '#fbbf24' : '#7dd3fc';

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
