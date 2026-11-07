import { Weapon } from '../Weapon';
import { Projectile, ProjectileType } from '../Projectile';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';
import { Vector2 } from '../../core/Vector2';

export class HolyWater extends Weapon {
  private activePuddles: Projectile[] = [];

  constructor() {
    super('holy_water', 'Santa Water', 'holy_water');
    this.evolutionPairPassive = 'attractorb';
    this.evolvedName = 'La Borra';
    this.evolvedDescription = 'Damaging holy vortexes drift toward you and expand in scale.';
    this.damage = 22;
    this.cooldown = 2.8;
    this.projectileCount = 1;
    this.duration = 2.5;
    this.area = 45; // puddle radius
  }

  public update(dt: number, player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    super.update(dt, player, combatSystem, sound);

    // If evolved (La Borra), attract puddles towards player
    if (this.isEvolved) {
      this.activePuddles = this.activePuddles.filter(p => p.active);
      for (const puddle of this.activePuddles) {
        const toPlayer = player.position.clone().sub(puddle.position);
        const dist = toPlayer.length();
        if (dist > 15) {
          toPlayer.normalize();
          puddle.position.addScaled(toPlayer, 85 * dt);
        }
      }
    }
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    const totalCount = this.projectileCount + player.projectileCountBonus;
    const enemies = combatSystem.getNearestEnemies(player.position, 450, totalCount * 2);

    for (let i = 0; i < totalCount; i++) {
      let targetPos: Vector2;
      if (enemies.length > 0) {
        const chosenEnemy = enemies[Math.floor(Math.random() * enemies.length)];
        targetPos = chosenEnemy.position.clone().add(new Vector2((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60));
      } else {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 120;
        targetPos = player.position.clone().add(new Vector2(Math.cos(angle) * dist, Math.sin(angle) * dist));
      }

      const delay = i * 0.12;
      setTimeout(() => {
        if (!player.active || player.isDead) return;

        const radius = Math.round(this.area * player.areaMult * (this.isEvolved ? 1.4 : 1.0));
        const puddle = new Projectile(
          ProjectileType.GROUND_FIRE,
          this.id,
          targetPos.x,
          targetPos.y,
          radius,
          Math.round(this.damage * player.damageMult),
          9999,
          this.isEvolved ? this.duration * 1.5 : this.duration
        );

        puddle.hitInterval = 0.22;
        this.activePuddles.push(puddle);
        combatSystem.addProjectile(puddle);
        sound.playShoot('water');
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
        this.damage += 6;
        this.area += 8;
        break;
      case 4:
        this.projectileCount += 1;
        this.duration += 0.5;
        break;
      case 5:
        this.damage += 10;
        this.area += 10;
        break;
      case 6:
        this.projectileCount += 1;
        break;
      case 7:
        this.cooldown *= 0.85;
        this.duration += 0.5;
        break;
      case 8:
        this.damage += 15;
        this.area += 12;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Spawns 1 additional bottle';
      case 3: return 'Base Damage +6, Area +15%';
      case 4: return 'Spawns 1 additional bottle, lasts 0.5s longer';
      case 5: return 'Base Damage +10, Area +20%';
      case 6: return 'Spawns 1 additional bottle';
      case 7: return 'Cooldown -15%, lasts 0.5s longer';
      case 8: return 'Base Damage +15, Area +25%';
      default: return 'Upgrades Santa Water potency';
    }
  }

  protected onEvolve(): void {
    this.damage += 25;
    this.duration += 1.5;
    this.area += 25;
    this.cooldown = 1.4;
  }
}
