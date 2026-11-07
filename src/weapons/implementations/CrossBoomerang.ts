import { Weapon } from '../Weapon';
import { Projectile, ProjectileType } from '../Projectile';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';
import { Vector2 } from '../../core/Vector2';

export class CrossBoomerang extends Weapon {
  private activeBoomerangs: Projectile[] = [];

  constructor() {
    super('cross', 'Cross', 'cross');
    this.evolutionPairPassive = 'clover';
    this.evolvedName = 'Heaven Sword';
    this.evolvedDescription = 'Unleashes massive celestial swords that deal lethal critical strikes.';
    this.damage = 25;
    this.cooldown = 2.0;
    this.projectileCount = 1;
    this.speed = 420;
    this.duration = 2.2;
    this.pierce = 999;
  }

  public update(dt: number, player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    super.update(dt, player, combatSystem, sound);

    // Update returning boomerangs
    this.activeBoomerangs = this.activeBoomerangs.filter(b => b.active);
    for (const b of this.activeBoomerangs) {
      if (b.isReturning) {
        const toPlayer = player.position.clone().sub(b.position);
        const dist = toPlayer.length();
        if (dist < 20) {
          b.active = false; // caught
        } else {
          toPlayer.normalize();
          b.velocity.copy(toPlayer).multiplyScalar(b.returnSpeed);
          b.position.addScaled(b.velocity, dt);
        }
      }
    }
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    const totalCount = this.projectileCount + player.projectileCountBonus;
    const enemies = combatSystem.getNearestEnemies(player.position, 500, totalCount);

    for (let i = 0; i < totalCount; i++) {
      let targetPos: Vector2;
      if (enemies[i]) {
        targetPos = enemies[i].position.clone();
      } else {
        const angle = (player.facingDirection > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.8;
        targetPos = player.position.clone().add(new Vector2(Math.cos(angle) * 300, Math.sin(angle) * 300));
      }

      const dir = targetPos.clone().sub(player.position).normalize();
      const delay = i * 0.1;

      setTimeout(() => {
        if (!player.active || player.isDead) return;

        const isCrit = this.isEvolved || Math.random() < player.critChance;
        const damage = Math.round(this.damage * player.damageMult * (isCrit ? 2.5 : 1.0));

        const proj = new Projectile(
          ProjectileType.BOOMERANG,
          this.id,
          player.position.x,
          player.position.y,
          this.isEvolved ? 18 : 12,
          damage,
          this.pierce,
          this.duration
        );

        proj.isCrit = isCrit;
        proj.velocity.copy(dir).multiplyScalar(this.speed);
        proj.originalSourcePos.copy(player.position);
        proj.returnSpeed = this.speed * 1.3;
        proj.hitInterval = 0.2;
        proj.color = this.isEvolved ? '#38bdf8' : '#3b82f6';

        this.activeBoomerangs.push(proj);
        combatSystem.addProjectile(proj);
        sound.playShoot('dagger');
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
        this.damage += 8;
        this.speed += 40;
        break;
      case 4:
        this.projectileCount += 1;
        break;
      case 5:
        this.damage += 12;
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
        this.damage += 15;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Fires 1 additional cross';
      case 3: return 'Base Damage +8, Velocity +10%';
      case 4: return 'Fires 1 additional cross';
      case 5: return 'Base Damage +12';
      case 6: return 'Fires 1 additional cross';
      case 7: return 'Cooldown -15%, Base Damage +10';
      case 8: return 'Fires 1 additional cross, Base Damage +15';
      default: return 'Upgrades Cross Boomerang power';
    }
  }

  protected onEvolve(): void {
    this.damage += 40;
    this.projectileCount += 1;
    this.speed += 80;
    this.cooldown = 1.3;
  }
}
