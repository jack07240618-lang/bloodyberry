import { Weapon } from '../Weapon';
import { Projectile, ProjectileType } from '../Projectile';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';

export class SpinningOrbs extends Weapon {
  private activeOrbs: Projectile[] = [];
  private masterAngle = 0;

  constructor() {
    super('spinning_orbs', 'King Bible', 'spinning_orbs');
    this.evolutionPairPassive = 'hollow_heart';
    this.evolvedName = 'Unholy Vespers';
    this.evolvedDescription = 'Creates a permanent, endless orbital vortex of golden crusader shields & scriptures.';
    this.damage = 18;
    this.cooldown = 3.2;
    this.projectileCount = 1;
    this.speed = 3.6; // continuous orbit angular speed
    this.duration = 999999; // Seamless continuous orbit without disappearing!
    this.area = 78; // orbit radius
  }

  public update(dt: number, player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    if (!player.active || player.isDead || !combatSystem.hasActiveEnemies()) {
      for (const orb of this.activeOrbs) {
        orb.active = false;
      }
      this.activeOrbs = [];
      return;
    }

    this.masterAngle += this.speed * dt;
    const targetCount = this.projectileCount + player.projectileCountBonus;

    // Filter out any deactivated orbs
    this.activeOrbs = this.activeOrbs.filter((p) => p.active);

    // If count changed (e.g. leveled up or picked up Duplicator), rebuild seamless ring
    if (this.activeOrbs.length !== targetCount) {
      this.spawnOrbs(player, combatSystem, sound);
    }

    // Continuously update orbital positions, damage, and radius with zero flicker
    const orbitRadius = this.area * player.areaMult;
    const angleStep = (Math.PI * 2) / Math.max(1, this.activeOrbs.length);
    const currentDamage = Math.round(this.damage * player.damageMult);

    for (let i = 0; i < this.activeOrbs.length; i++) {
      const orb = this.activeOrbs[i];
      const angle = this.masterAngle + i * angleStep;
      orb.orbitAngle = angle;
      orb.orbitRadius = orbitRadius;
      orb.damage = currentDamage;
      orb.lifetime = 999999; // Keep alive indefinitely
      orb.maxLifetime = 999999;
      orb.isEvolved = this.isEvolved;
      orb.color = this.isEvolved ? '#ef4444' : '#fbbf24';
      orb.glowColor = this.isEvolved ? '#f43f5e' : '#f59e0b';
      orb.position.x = player.position.x + Math.cos(angle) * orbitRadius;
      orb.position.y = player.position.y + Math.sin(angle) * orbitRadius;
    }
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    // Handled seamlessly in update()
  }

  private spawnOrbs(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    for (const orb of this.activeOrbs) {
      orb.active = false;
    }
    this.activeOrbs = [];

    const totalCount = this.projectileCount + player.projectileCountBonus;
    const angleStep = (Math.PI * 2) / totalCount;
    const orbitRadius = this.area * player.areaMult;

    for (let i = 0; i < totalCount; i++) {
      const angle = this.masterAngle + i * angleStep;
      const proj = new Projectile(
        ProjectileType.ORBITING_ORB,
        this.id,
        player.position.x + Math.cos(angle) * orbitRadius,
        player.position.y + Math.sin(angle) * orbitRadius,
        this.isEvolved ? 14 : 11,
        Math.round(this.damage * player.damageMult),
        999999, // Infinite pierce so shields never vanish on enemy contact!
        999999  // Infinite lifetime for continuous smooth rotation!
      );

      proj.orbitAngle = angle;
      proj.orbitSpeed = this.speed;
      proj.orbitRadius = orbitRadius;
      proj.hitInterval = 0.32;
      proj.hitCooldownTimer = 0.32;
      proj.isEvolved = this.isEvolved;
      proj.color = this.isEvolved ? '#ef4444' : '#fbbf24';
      proj.glowColor = this.isEvolved ? '#f43f5e' : '#f59e0b';

      this.activeOrbs.push(proj);
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
        this.speed += 0.6;
        this.damage += 5;
        break;
      case 4:
        this.projectileCount += 1;
        this.speed += 0.5;
        break;
      case 5:
        this.area += 15;
        this.damage += 7;
        break;
      case 6:
        this.projectileCount += 1;
        break;
      case 7:
        this.speed += 0.8;
        this.damage += 8;
        break;
      case 8:
        this.damage += 12;
        this.projectileCount += 1;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Adds +1 permanent orbiting Holy Cross Shield';
      case 3: return 'Rotation Speed +18%, Base Damage +5';
      case 4: return 'Adds +1 permanent orbiting Shield, Speed +15%';
      case 5: return 'Orbit Radius +20%, Base Damage +7';
      case 6: return 'Adds +1 permanent orbiting Holy Cross Shield';
      case 7: return 'Rotation Speed +22%, Base Damage +8';
      case 8: return 'Base Damage +12, Adds +1 orbiting Shield';
      default: return 'Upgrades Holy Cross Shield power';
    }
  }

  protected onEvolve(): void {
    this.damage += 18;
    this.speed = 5.4;
    this.projectileCount += 2;
    this.area += 18;
  }
}
