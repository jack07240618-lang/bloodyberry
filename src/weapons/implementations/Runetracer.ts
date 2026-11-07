import { Weapon } from '../Weapon';
import { Projectile, ProjectileType } from '../Projectile';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';
import { Vector2 } from '../../core/Vector2';

export class Runetracer extends Weapon {
  private activePrisms: Projectile[] = [];

  constructor() {
    super('runetracer', 'Runetracer', 'runetracer');
    this.evolutionPairPassive = 'armor';
    this.evolvedName = 'NO FUTURE';
    this.evolvedDescription = 'Bouncing lasers detonate with massive explosive shockwaves on ricochet.';
    this.damage = 18;
    this.cooldown = 2.6;
    this.projectileCount = 1;
    this.speed = 380;
    this.duration = 3.5;
    this.pierce = 999;
  }

  public update(dt: number, player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    super.update(dt, player, combatSystem, sound);

    // Update bouncing physics
    this.activePrisms = this.activePrisms.filter(p => p.active);
    const boxRadius = 420; // bounding radius relative to player

    for (const p of this.activePrisms) {
      const relX = p.position.x - player.position.x;
      const relY = p.position.y - player.position.y;

      let bounced = false;
      if (Math.abs(relX) > boxRadius) {
        p.velocity.x *= -1;
        p.position.x = player.position.x + Math.sign(relX) * boxRadius;
        bounced = true;
      }
      if (Math.abs(relY) > boxRadius) {
        p.velocity.y *= -1;
        p.position.y = player.position.y + Math.sign(relY) * boxRadius;
        bounced = true;
      }

      if (bounced && this.isEvolved) {
        // NO FUTURE explosion on ricochet
        combatSystem.dealAreaDamage(p.position, 60, Math.round(this.damage * 0.8), this.id);
        sound.playExplosion(0.15, 600);
      }
    }
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    const totalCount = this.projectileCount + player.projectileCountBonus;

    for (let i = 0; i < totalCount; i++) {
      const angle = (i * Math.PI * 2) / totalCount + (Math.random() - 0.5) * 0.5;
      const dir = Vector2.fromAngle(angle);

      const proj = new Projectile(
        ProjectileType.RUNETRACER_LASER,
        this.id,
        player.position.x,
        player.position.y,
        this.isEvolved ? 14 : 10,
        Math.round(this.damage * player.damageMult),
        this.pierce,
        this.isEvolved ? this.duration * 1.3 : this.duration
      );

      proj.velocity.copy(dir).multiplyScalar(this.speed);
      proj.color = this.isEvolved ? '#f43f5e' : '#38bdf8';
      proj.hitInterval = 0.25;

      this.activePrisms.push(proj);
      combatSystem.addProjectile(proj);
    }

    sound.playShoot('wand');
  }

  public levelUp(): void {
    if (this.level >= this.maxLevel) return;
    this.level++;

    switch (this.level) {
      case 2:
        this.projectileCount += 1;
        break;
      case 3:
        this.speed += 50;
        this.damage += 4;
        break;
      case 4:
        this.projectileCount += 1;
        break;
      case 5:
        this.duration += 0.8;
        this.damage += 6;
        break;
      case 6:
        this.projectileCount += 1;
        break;
      case 7:
        this.cooldown *= 0.85;
        this.speed += 60;
        break;
      case 8:
        this.projectileCount += 1;
        this.damage += 10;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Fires 1 additional laser';
      case 3: return 'Laser Speed +15%, Base Damage +4';
      case 4: return 'Fires 1 additional laser';
      case 5: return 'Lasers last 0.8s longer, Base Damage +6';
      case 6: return 'Fires 1 additional laser';
      case 7: return 'Cooldown -15%, Speed +20%';
      case 8: return 'Fires 1 additional laser, Base Damage +10';
      default: return 'Upgrades Runetracer ricochets';
    }
  }

  protected onEvolve(): void {
    this.damage += 25;
    this.speed += 80;
    this.duration += 1.5;
    this.cooldown = 1.8;
  }
}
