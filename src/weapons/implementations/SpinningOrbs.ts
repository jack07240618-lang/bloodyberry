import { Weapon } from '../Weapon';
import { Projectile, ProjectileType } from '../Projectile';
import { Player } from '../../entities/Player';
import { CombatSystem } from '../../systems/CombatSystem';
import { SoundSynthesizer } from '../../core/SoundSynthesizer';
import { Vector2 } from '../../core/Vector2';

export class SpinningOrbs extends Weapon {
  private activeOrbs: Projectile[] = [];

  constructor() {
    super('spinning_orbs', 'King Bible', 'spinning_orbs');
    this.evolutionPairPassive = 'hollow_heart';
    this.evolvedName = 'Unholy Vespers';
    this.evolvedDescription = 'Creates a permanent, endless orbital vortex of demonic scripture.';
    this.damage = 18;
    this.cooldown = 3.2;
    this.projectileCount = 1;
    this.speed = 3.5; // orbit angular speed
    this.duration = 3.0;
    this.area = 75; // orbit radius
  }

  public update(dt: number, player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    // If evolved, maintain permanent books
    if (this.isEvolved) {
      const targetCount = this.projectileCount + player.projectileCountBonus;
      // Filter dead ones
      this.activeOrbs = this.activeOrbs.filter(p => p.active);
      if (this.activeOrbs.length < targetCount) {
        this.spawnOrbs(player, combatSystem, sound, true);
      }
      this.updateOrbPositions(player);
      return;
    }

    // Normal cyclical behavior
    super.update(dt, player, combatSystem, sound);
    this.updateOrbPositions(player);
  }

  private updateOrbPositions(player: Player): void {
    const orbitRadius = this.area * player.areaMult;
    for (const orb of this.activeOrbs) {
      if (!orb.active) continue;
      orb.position.x = player.position.x + Math.cos(orb.orbitAngle) * orbitRadius;
      orb.position.y = player.position.y + Math.sin(orb.orbitAngle) * orbitRadius;
    }
  }

  public attack(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer): void {
    this.spawnOrbs(player, combatSystem, sound, false);
  }

  private spawnOrbs(player: Player, combatSystem: CombatSystem, sound: SoundSynthesizer, isPermanent: boolean): void {
    // Clean old
    for (const orb of this.activeOrbs) {
      orb.active = false;
    }
    this.activeOrbs = [];

    const totalCount = this.projectileCount + player.projectileCountBonus;
    const angleStep = (Math.PI * 2) / totalCount;
    const lifetime = isPermanent ? 999999 : this.duration;

    for (let i = 0; i < totalCount; i++) {
      const angle = i * angleStep;
      const proj = new Projectile(
        ProjectileType.ORBITING_ORB,
        this.id,
        player.position.x,
        player.position.y,
        this.isEvolved ? 12 : 9,
        Math.round(this.damage * player.damageMult),
        999, // high pierce
        lifetime
      );

      proj.orbitAngle = angle;
      proj.orbitSpeed = this.speed;
      proj.orbitRadius = this.area * player.areaMult;
      proj.hitInterval = 0.35;
      proj.color = this.isEvolved ? '#ef4444' : '#f59e0b';
      proj.glowColor = this.isEvolved ? '#991b1b' : '#d97706';

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
        this.duration += 0.6;
        this.damage += 4;
        break;
      case 4:
        this.projectileCount += 1;
        this.speed += 0.5;
        break;
      case 5:
        this.area += 15;
        this.damage += 6;
        break;
      case 6:
        this.projectileCount += 1;
        break;
      case 7:
        this.duration += 0.8;
        this.cooldown *= 0.85;
        break;
      case 8:
        this.damage += 10;
        this.projectileCount += 1;
        break;
    }
  }

  public getUpgradeDescription(level: number): string {
    switch (level) {
      case 2: return 'Fires 1 additional book';
      case 3: return 'Effect lasts 0.6 seconds longer, Base Damage +4';
      case 4: return 'Fires 1 additional book, Rotation speed increases';
      case 5: return 'Area +20%, Base Damage +6';
      case 6: return 'Fires 1 additional book';
      case 7: return 'Effect lasts 0.8 seconds longer, Cooldown -15%';
      case 8: return 'Base Damage +10, Fires 1 additional book';
      default: return 'Upgrades King Bible power';
    }
  }

  protected onEvolve(): void {
    this.damage += 16;
    this.speed = 5.2;
    this.projectileCount += 2;
    this.area += 20;
  }
}
