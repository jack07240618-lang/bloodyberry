import { Vector2 } from '../core/Vector2';
import { Entity } from '../entities/Entity';
import { SkillTag, WEAPON_DEFAULT_TAGS } from '../systems/BuildSystem';

export enum ProjectileType {
  DIRECT_BOLT = 'DIRECT_BOLT',
  PIERCING_DAGGER = 'PIERCING_DAGGER',
  ORBITING_ORB = 'ORBITING_ORB',
  GROUND_FIRE = 'GROUND_FIRE',
  LIGHTNING_BOLT = 'LIGHTNING_BOLT',
  BOOMERANG = 'BOOMERANG',
  GARLIC_AURA = 'GARLIC_AURA',
  PENTAGRAM_WIPE = 'PENTAGRAM_WIPE',
  WHIP_SLASH = 'WHIP_SLASH',
  ARCBALLISTIC_AXE = 'ARCBALLISTIC_AXE',
  FIREBALL = 'FIREBALL',
  RUNETRACER_LASER = 'RUNETRACER_LASER'
}

export class Projectile extends Entity {
  public type: ProjectileType;
  public weaponId: string;
  public damage: number;
  public isCrit: boolean;
  public pierce: number;
  public lifetime: number;
  public maxLifetime: number;
  public hitEnemies: Set<number> = new Set(); // enemy ids already hit (for pierce / ticks)
  public hitCooldownTimer = 0; // for periodic AoE damage (e.g. fire/garlic)
  public hitInterval = 0.25;

  // Orbiting specific
  public orbitAngle = 0;
  public orbitRadius = 80;
  public orbitSpeed = 4.0;

  // Boomerang specific
  public isReturning = false;
  public originalSourcePos: Vector2 = new Vector2();
  public returnSpeed = 450;

  // Custom visual color/style
  public color = '#60a5fa';
  public glowColor = '#3b82f6';
  public rotation = 0;
  public isEvolved = false;
  public elapsed = 0;

  // Motion trail points for commercial VFX ribbons
  public trailPoints: Vector2[] = [];

  // 多维标签与机制改造状态 (Tag & Mechanic Modifier State)
  public tags: Set<SkillTag> = new Set();
  public wallBounces = 0;
  public isSingularityStrike = false;
  public isDecoratedClone = false;
  public hasTriggeredPyroBurst = false;

  constructor(
    type: ProjectileType,
    weaponId: string,
    x: number,
    y: number,
    radius: number,
    damage: number,
    pierce = 1,
    lifetime = 2.0
  ) {
    super(x, y, radius);
    this.type = type;
    this.weaponId = weaponId;
    this.damage = damage;
    this.isCrit = false;
    this.pierce = pierce;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;

    const defaultTags = WEAPON_DEFAULT_TAGS[weaponId];
    if (defaultTags) {
      for (const t of defaultTags) {
        this.tags.add(t);
      }
    }
  }

  public update(dt: number): void {
    if (!this.active) return;

    this.elapsed += dt;
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.active = false;
      return;
    }

    // Record motion trail for high-speed projectiles
    if (
      this.type === ProjectileType.DIRECT_BOLT ||
      this.type === ProjectileType.PIERCING_DAGGER ||
      this.type === ProjectileType.BOOMERANG ||
      this.type === ProjectileType.ARCBALLISTIC_AXE ||
      this.type === ProjectileType.FIREBALL ||
      this.type === ProjectileType.RUNETRACER_LASER ||
      this.type === ProjectileType.ORBITING_ORB
    ) {
      this.trailPoints.unshift(this.position.clone());
      if (this.trailPoints.length > 11) {
        this.trailPoints.pop();
      }
    }

    if (this.hitCooldownTimer > 0) {
      this.hitCooldownTimer -= dt;
      if (this.hitCooldownTimer <= 0) {
        this.hitEnemies.clear();
        this.hitCooldownTimer = this.hitInterval;
      }
    }

    // Motion physics
    if (
      this.type === ProjectileType.DIRECT_BOLT ||
      this.type === ProjectileType.PIERCING_DAGGER ||
      this.type === ProjectileType.FIREBALL
    ) {
      this.position.addScaled(this.velocity, dt);
      this.rotation = this.velocity.angle();
    } else if (this.type === ProjectileType.RUNETRACER_LASER) {
      this.position.addScaled(this.velocity, dt);
      this.rotation += 10 * dt;
    } else if (this.type === ProjectileType.ARCBALLISTIC_AXE) {
      this.velocity.y += 650 * dt; // gravity
      this.position.addScaled(this.velocity, dt);
      this.rotation += 14 * dt;
    } else if (this.type === ProjectileType.BOOMERANG) {
      if (!this.isReturning) {
        this.position.addScaled(this.velocity, dt);
        if (this.lifetime < this.maxLifetime * 0.55) {
          this.isReturning = true;
          this.hitEnemies.clear();
        }
      }
      this.rotation += 15 * dt;
    } else if (this.type === ProjectileType.ORBITING_ORB) {
      this.orbitAngle += this.orbitSpeed * dt;
    } else if (this.type === ProjectileType.WHIP_SLASH) {
      // Semicircular Sword Qi surges forward fast at launch, then smoothly decelerates due to air drag
      this.position.addScaled(this.velocity, dt);
      this.velocity.multiplyScalar(Math.pow(0.91, dt * 60));
    }
  }

  private renderMotionRibbon(ctx: CanvasRenderingContext2D, ribbonColor: string, maxW: number, lifeAlpha = 1.0): void {
    if (this.trailPoints.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.trailPoints.length - 1; i++) {
      const p1 = this.trailPoints[i];
      const p2 = this.trailPoints[i + 1];
      const ratio = Math.pow(1 - i / this.trailPoints.length, 1.35);
      // Outer soft Qi glow
      ctx.globalAlpha = ratio * 0.38 * lifeAlpha;
      ctx.strokeStyle = ribbonColor;
      ctx.lineWidth = Math.max(1.2, maxW * 1.45 * ratio);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x - this.position.x, p1.y - this.position.y);
      ctx.lineTo(p2.x - this.position.x, p2.y - this.position.y);
      ctx.stroke();

      // Inner white-hot core filament
      ctx.globalAlpha = ratio * 0.62 * lifeAlpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(0.6, maxW * 0.45 * ratio);
      ctx.beginPath();
      ctx.moveTo(p1.x - this.position.x, p1.y - this.position.y);
      ctx.lineTo(p2.x - this.position.x, p2.y - this.position.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();
    ctx.translate(this.position.x, this.position.y);

    // Smooth universal spawn ease-in & expiration fade-out for ranged projectiles
    const spawnEase = Math.min(1, this.elapsed / 0.055);
    const endFade = Math.min(1, this.lifetime / 0.14);
    const lifeAlpha = spawnEase * endFade;

    switch (this.type) {
      // ======================================================================
      // 1. GARLIC / SOUL EATER: Intricate Rotating Sacred Seal & Energy Ripples
      // ======================================================================
      case ProjectileType.GARLIC_AURA: {
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.95 + Math.sin(this.elapsed * 7) * 0.05;
        const r = this.radius * pulse;
        const isCrimson = this.color === '#f43f5e' || this.isEvolved;

        // Soft Radial Energy Field
        const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.7, isCrimson ? 'rgba(244, 63, 94, 0.08)' : 'rgba(253, 224, 71, 0.07)');
        grad.addColorStop(0.95, isCrimson ? 'rgba(225, 29, 72, 0.28)' : 'rgba(250, 204, 21, 0.24)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Outer & Inner Sacred Rune Rings
        ctx.rotate(this.elapsed * 0.8);
        ctx.strokeStyle = isCrimson ? 'rgba(251, 113, 133, 0.55)' : 'rgba(254, 240, 138, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 8-Pointed Geometric Star Sigil Nodes on Perimeter
        const nodes = 8;
        for (let i = 0; i < nodes; i++) {
          const ang = (i * Math.PI * 2) / nodes;
          const nx = Math.cos(ang) * r * 0.88;
          const ny = Math.sin(ang) * r * 0.88;
          ctx.fillStyle = isCrimson ? '#fda4af' : '#fef08a';
          ctx.beginPath();
          ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      // ======================================================================
      // 2. SANTA WATER / LA BORRA: Swirling Holy/Abyssal Vortex & Rising Flames
      // ======================================================================
      case ProjectileType.GROUND_FIRE: {
        ctx.globalCompositeOperation = 'lighter';
        const fade = Math.min(1, this.lifetime * 2);
        ctx.globalAlpha = fade;

        // Multi-stop Glowing Ground Pool
        const poolGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, this.radius);
        poolGrad.addColorStop(0, '#ffffff');
        poolGrad.addColorStop(0.35, this.color || '#38bdf8');
        poolGrad.addColorStop(0.75, 'rgba(2, 132, 199, 0.50)');
        poolGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = poolGrad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Rotating Inscribed Hexagram / Magic Circle inside the pool
        ctx.save();
        ctx.rotate(this.elapsed * 2.2);
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.72, 0, Math.PI * 2);
        ctx.stroke();

        for (let t = 0; t < 2; t++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          for (let v = 0; v < 3; v++) {
            const a = (v * Math.PI * 2) / 3;
            const vx = Math.cos(a) * this.radius * 0.72;
            const vy = Math.sin(a) * this.radius * 0.72;
            if (v === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();

        // Rising Sacred Flame Tongues
        for (let i = 0; i < 5; i++) {
          const seed = i * 1.7 + this.elapsed * 5;
          const fx = Math.sin(seed) * (this.radius * 0.55);
          const fy = Math.cos(seed * 0.8) * (this.radius * 0.45) - ((this.elapsed * 30 + i * 12) % 18);
          const flameH = 10 + Math.sin(seed * 2) * 4;

          ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#7dd3fc';
          ctx.beginPath();
          ctx.moveTo(fx - 3, fy);
          ctx.quadraticCurveTo(fx, fy - flameH, fx, fy - flameH - 3);
          ctx.quadraticCurveTo(fx + 3, fy - flameH * 0.5, fx + 3, fy);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      // ======================================================================
      // 3. WHIP / SWORD CLEAVE: 3-Phase Progressive 180-Degree Sword Qi Wave!
      //    Phase 1 (0.00-0.16): Rapid blade carve & arc expansion (0 -> 1 alpha)
      //    Phase 2 (0.16-0.48): Full blazing crescent wave surges forward
      //    Phase 3 (0.48-1.00): Inner edge thins into a razor Qi silk & dissolves into motes (1 -> 0 alpha)
      // ======================================================================
      case ProjectileType.WHIP_SLASH: {
        ctx.globalCompositeOperation = 'lighter';
        const progress = Math.max(0, Math.min(1, 1 - this.lifetime / this.maxLifetime));

        // Smooth lifecycle opacity envelope (strictly 0 -> 1 -> 0 with zero hard pop!)
        const fadeIn = Math.min(1, progress / 0.11);
        const fadeOut = progress < 0.36 ? 1.0 : Math.pow(Math.max(0, 1 - (progress - 0.36) / 0.64), 1.75);
        const alpha = fadeIn * fadeOut;
        if (alpha <= 0.01) break;
        ctx.globalAlpha = alpha;

        // Progressive swing curve (carves across the 180-degree arc during first 42% of lifetime)
        const swingProgress = Math.min(1, progress / 0.42);
        const swingEase = 1 - Math.pow(1 - swingProgress, 3.4);
        const expandEase = 1 - Math.pow(1 - progress, 2.4);

        // Full 360-degree directional cleave toward the target enemy!
        ctx.rotate(this.rotation);

        const isCrimson =
          this.color === '#ef4444' ||
          this.color === '#dc2626' ||
          this.color === '#f43f5e' ||
          this.isEvolved;
        const isSingularity = this.isSingularityStrike;

        // Radius expands smoothly as the Qi wave travels forward; inner radius thins out during dissolve
        const r = this.radius * (0.78 + expandEase * 0.34);
        const dissolveThinning = progress > 0.38 ? Math.pow((progress - 0.38) / 0.62, 1.35) * 0.50 : 0;
        const innerR = r * (0.26 + dissolveThinning);

        // Progressive 180-degree cleave span: starts from (-98 deg) and carves to (+98 deg) around the aim vector
        const fullStartAng = -Math.PI * 0.54;
        const fullEndAng = Math.PI * 0.54;
        const tailTrim = progress > 0.42 ? ((progress - 0.42) / 0.58) * 0.40 : 0;
        const curStartAng = fullStartAng + (fullEndAng - fullStartAng) * tailTrim;
        const curEndAng = fullStartAng + (fullEndAng - fullStartAng) * (0.20 + 0.80 * swingEase);
        const midAng = (curStartAng + curEndAng) * 0.5;
        const halfSpan = (curEndAng - curStartAng) * 0.5;

        // 0. Outer Sonic Air-Break Shockwave Arc (外层破空音障气浪弧)
        ctx.save();
        ctx.strokeStyle = isSingularity
          ? 'rgba(245, 208, 254, 0.55)'
          : isCrimson
          ? 'rgba(254, 240, 138, 0.55)'
          : 'rgba(224, 242, 254, 0.55)';
        ctx.lineWidth = Math.max(1.0, 4.2 * (1 - progress * 0.7));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, r * (1.07 + progress * 0.08), midAng - halfSpan * 0.82, midAng + halfSpan * 0.82);
        ctx.stroke();
        ctx.restore();

        // 1. Wide Semicircular Sword Qi Vacuum Fan (渐进式半圆破空剑罡扇面)
        const fanGrad = ctx.createRadialGradient(0, 0, innerR * 0.45, 0, 0, r * 1.08);
        fanGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        fanGrad.addColorStop(
          0.32,
          isSingularity
            ? 'rgba(168, 85, 247, 0.20)'
            : isCrimson
            ? 'rgba(185, 28, 28, 0.22)'
            : 'rgba(2, 132, 199, 0.20)'
        );
        fanGrad.addColorStop(
          0.72,
          isSingularity
            ? 'rgba(232, 121, 249, 0.76)'
            : isCrimson
            ? 'rgba(239, 68, 68, 0.78)'
            : 'rgba(56, 189, 248, 0.76)'
        );
        fanGrad.addColorStop(0.92, isSingularity ? '#f5d0fe' : isCrimson ? '#fde047' : '#bae6fd');
        fanGrad.addColorStop(1, 'rgba(255, 255, 255, 0.98)');

        ctx.fillStyle = fanGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r, curStartAng, curEndAng, false);
        ctx.arc(0, 0, innerR, curEndAng, curStartAng, true);
        ctx.closePath();
        ctx.fill();

        // 2. 18-Segment Dual-Layer Tapered Crescent Moon Qi Ribbon (18段双层流线月牙刀光，首尾锋利收尖)
        const segments = 18;
        const span = curEndAng - curStartAng;
        for (let s = 0; s < segments; s++) {
          const t0 = s / segments;
          const t1 = (s + 1) / segments;
          const tMid = (t0 + t1) * 0.5;
          // Sine taper so both tips of the crescent are razor-sharp and fade smoothly
          const tipTaper = Math.sin(tMid * Math.PI);
          const a0 = curStartAng + span * t0;
          const a1 = curStartAng + span * t1 + 0.014;
          const segOuterR = r * (0.95 + tipTaper * 0.09);
          const segMidR = Math.max(innerR, segOuterR - (r - innerR) * tipTaper * 0.42);
          const segInnerR = Math.max(innerR, segOuterR - (r - innerR) * tipTaper * 0.88);

          // Inner glowing plasma body
          ctx.save();
          ctx.globalAlpha = alpha * (0.30 + tipTaper * 0.58);
          ctx.fillStyle = isSingularity ? '#e879f9' : isCrimson ? '#fb7185' : '#38bdf8';
          ctx.beginPath();
          ctx.arc(0, 0, segMidR, a0, a1, false);
          ctx.arc(0, 0, segInnerR, a1, a0, true);
          ctx.closePath();
          ctx.fill();

          // Razor-sharp white-gold outer crescent edge
          ctx.globalAlpha = alpha * (0.45 + tipTaper * 0.55);
          ctx.fillStyle =
            tipTaper > 0.65
              ? '#ffffff'
              : isSingularity
              ? '#f5d0fe'
              : isCrimson
              ? '#fef08a'
              : '#e0f2fe';
          ctx.beginPath();
          ctx.arc(0, 0, segOuterR, a0, a1, false);
          ctx.arc(0, 0, segMidR, a1, a0, true);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // 3. Concentric Semicircular Sword Qi Echo Waves & Crackling Qi Lightning (层叠剑气波纹与雷音裂纹)
        const qiRings = [
          { radiusMult: 1.03, spanMult: 0.96, width: 3.5 * (1 - progress * 0.52), color: '#ffffff' },
          {
            radiusMult: 0.85 + progress * 0.08,
            spanMult: 0.85,
            width: 2.6 * (1 - progress * 0.48),
            color: isSingularity
              ? 'rgba(232, 121, 249, 0.86)'
              : isCrimson
              ? 'rgba(251, 191, 36, 0.86)'
              : 'rgba(125, 211, 252, 0.86)'
          },
          {
            radiusMult: 0.65 + progress * 0.14,
            spanMult: 0.72,
            width: 1.9 * (1 - progress * 0.58),
            color: isSingularity
              ? 'rgba(168, 85, 247, 0.62)'
              : isCrimson
              ? 'rgba(248, 113, 113, 0.62)'
              : 'rgba(56, 189, 248, 0.62)'
          }
        ];
        for (const ring of qiRings) {
          ctx.strokeStyle = ring.color;
          ctx.lineWidth = Math.max(0.6, ring.width);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(
            0,
            0,
            r * ring.radiusMult,
            midAng - halfSpan * ring.spanMult,
            midAng + halfSpan * ring.spanMult
          );
          ctx.stroke();
        }

        // 3b. Crackling Sword-Qi Energy Filaments along the Crescent Spine (剑气雷音电弧)
        if (span > 0.25) {
          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(0.8, 1.8 * (1 - progress * 0.5));
          ctx.beginPath();
          const boltSteps = 9;
          for (let b = 0; b <= boltSteps; b++) {
            const bt = b / boltSteps;
            const bAng = curStartAng + span * (0.1 + bt * 0.8);
            const jitter = Math.sin(progress * 38 + b * 2.7) * (r * 0.065) * Math.sin(bt * Math.PI);
            const bRad = r * 0.86 + jitter;
            const bx = Math.cos(bAng) * bRad;
            const by = Math.sin(bAng) * bRad;
            if (b === 0) ctx.moveTo(bx, by);
            else ctx.lineTo(bx, by);
          }
          ctx.stroke();
          ctx.restore();
        }

        // 4. Sweeping Physical Greatsword, Afterimage Blades & Star-Burst Tip Flare
        const bladeAlpha = alpha * Math.max(0, 1 - Math.max(0, (progress - 0.56) / 0.44));
        if (bladeAlpha > 0.02) {
          const swingAngle = curEndAng;

          // 4a. Ghost Afterimage Blades along the cleave arc
          for (let g = 1; g <= 5; g++) {
            const ghostT = Math.max(0, swingEase - g * 0.095);
            const ghostAng = fullStartAng + (fullEndAng - fullStartAng) * ghostT;
            ctx.save();
            ctx.rotate(ghostAng);
            ctx.globalAlpha = bladeAlpha * Math.max(0.04, 0.42 - g * 0.075);
            ctx.fillStyle = isSingularity ? '#e879f9' : isCrimson ? '#fbbf24' : '#7dd3fc';
            ctx.beginPath();
            ctx.moveTo(innerR * 0.32, -2.4);
            ctx.lineTo(r * 1.05, 0);
            ctx.lineTo(innerR * 0.32, 2.4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }

          // 4b. Main Rune Greatsword Blade + Golden Crossguard + Star-Burst Tip Flare
          ctx.save();
          ctx.rotate(swingAngle);
          ctx.globalAlpha = bladeAlpha;
          ctx.fillStyle = isSingularity ? '#f5d0fe' : isCrimson ? '#fde047' : '#bae6fd';
          ctx.beginPath();
          ctx.moveTo(innerR * 0.22, -5.0);
          ctx.lineTo(r * 1.14, 0);
          ctx.lineTo(innerR * 0.22, 5.0);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(innerR * 0.22, -2.4);
          ctx.lineTo(r * 1.10, 0);
          ctx.lineTo(innerR * 0.22, 2.4);
          ctx.closePath();
          ctx.fill();

          // Ornate Golden Crossguard
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(innerR * 0.20, -8.5, 4.2, 17);

          // 4-Pointed Star-Burst Flare at the Greatsword Tip (剑尖破空星芒)
          const tipX = r * 1.04;
          const starSize = 9 * (1 - progress * 0.4);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(tipX + starSize * 1.4, 0);
          ctx.lineTo(tipX + starSize * 0.28, starSize * 0.28);
          ctx.lineTo(tipX, starSize * 1.4);
          ctx.lineTo(tipX - starSize * 0.28, starSize * 0.28);
          ctx.lineTo(tipX - starSize * 1.4, 0);
          ctx.lineTo(tipX - starSize * 0.28, -starSize * 0.28);
          ctx.lineTo(tipX, -starSize * 1.4);
          ctx.lineTo(tipX + starSize * 0.28, -starSize * 0.28);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // 5. Dispersing Sword Qi Wind-Shear Filaments & Dissolving Star Motes (剑气破空流光与消散微粒)
        ctx.strokeStyle = isSingularity ? '#f5d0fe' : isCrimson ? '#fef08a' : '#e0f2fe';
        ctx.lineWidth = Math.max(0.7, 1.6 * (1 - progress * 0.5));
        ctx.lineCap = 'round';
        for (let s = -3; s <= 3; s++) {
          const sAng = s * 0.28 + Math.sin(progress * 5 + s) * 0.05;
          if (sAng < curStartAng || sAng > curEndAng) continue;
          const driftR = r * (0.92 + progress * 0.22 + (Math.abs(s) % 2) * 0.05);

          // Curved wind-shear arc filament
          ctx.beginPath();
          ctx.arc(0, 0, driftR, sAng - 0.11 * (1 - progress * 0.4), sAng + 0.11 * (1 - progress * 0.4));
          ctx.stroke();

          // Drifting Sword Qi Mote
          const moteX = Math.cos(sAng) * (driftR + progress * 14);
          const moteY = Math.sin(sAng) * (driftR + progress * 14);
          const moteR = Math.max(0.6, 2.2 * (1 - progress * 0.65));
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(moteX, moteY, moteR, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      // ======================================================================
      // 4. KNIFE / THOUSAND EDGE: Metallic Throwing Blade + Curved Arrow Qi Wake
      // ======================================================================
      case ProjectileType.PIERCING_DAGGER: {
        this.renderMotionRibbon(ctx, this.glowColor || '#38bdf8', 7.5, lifeAlpha);
        ctx.globalAlpha = lifeAlpha;
        ctx.rotate(this.rotation);
        ctx.scale(0.7 + 0.3 * spawnEase, 0.7 + 0.3 * spawnEase);

        // Additive Speed Aura + Curved Sonic Arrow-Qi Wake (破空箭气弧光)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const wakeGrad = ctx.createLinearGradient(-22, 0, 18, 0);
        wakeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        wakeGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.28)');
        wakeGrad.addColorStop(1, 'rgba(224, 242, 254, 0.75)');
        ctx.fillStyle = wakeGrad;
        ctx.beginPath();
        ctx.moveTo(17, 0);
        ctx.quadraticCurveTo(2, -9, -20, -12);
        ctx.quadraticCurveTo(-4, -3, -14, 0);
        ctx.quadraticCurveTo(-4, 3, -20, 12);
        ctx.quadraticCurveTo(2, 9, 17, 0);
        ctx.fill();

        // Twin Sonic Bow-Wave Arcs at Tip
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.72)';
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(4, 0, 12, -0.58, 0.58);
        ctx.stroke();
        ctx.restore();

        // Pommel & Wrapped Grip
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(-13, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-11, -2, 6, 4);

        // Ornate Golden Crossguard
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-5, -5, 2.5, 10);

        // Two-Tone Steel Dagger Blade (Light Top Edge, Dark Bottom Bevel)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-2.5, -3.5);
        ctx.lineTo(14, 0);
        ctx.lineTo(-2.5, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(-2.5, 3.5);
        ctx.lineTo(14, 0);
        ctx.lineTo(-2.5, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }

      // ======================================================================
      // 5. CROSS / HEAVEN SWORD: Spinning Celestial Cruciform Blade + Halo
      // ======================================================================
      case ProjectileType.BOOMERANG: {
        this.renderMotionRibbon(ctx, this.glowColor || '#fbbf24', 12, lifeAlpha);
        ctx.globalAlpha = lifeAlpha;
        ctx.globalCompositeOperation = 'lighter';

        // Circular Spinning Halo Ring
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 1.15, 0, Math.PI * 2);
        ctx.stroke();

        ctx.rotate(this.rotation);
        const s = this.radius * 1.25;

        // 4 Bladed Cross Arms
        ctx.fillStyle = this.color || '#f59e0b';
        for (let arm = 0; arm < 4; arm++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, -3);
          ctx.lineTo(s, -5);
          ctx.lineTo(s + 5, 0);
          ctx.lineTo(s, 5);
          ctx.lineTo(0, 3);
          ctx.closePath();
          ctx.fill();

          // White core inlay
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(2, -1.5, s - 2, 3);
          ctx.fillStyle = this.color || '#f59e0b';
        }

        // Center Sapphire / Ruby Gem
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      // ======================================================================
      // 6. AXE / DEATH SPIRAL: Executioner Battleaxe & Grim Reaper Scythe
      // ======================================================================
      case ProjectileType.ARCBALLISTIC_AXE: {
        const isScythe = this.radius >= 22 || this.color === '#a855f7';
        this.renderMotionRibbon(ctx, isScythe ? '#c084fc' : '#94a3b8', 10, lifeAlpha);
        ctx.globalAlpha = lifeAlpha;
        ctx.rotate(this.rotation);

        if (isScythe) {
          // DEATH SPIRAL: Giant Glowing Grim Reaper Scythe
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, this.radius * 1.1, 0, Math.PI * 1.4);
          ctx.stroke();

          // Scythe Shaft
          ctx.fillStyle = '#d8b4fe';
          ctx.fillRect(-2, -18, 4, 36);

          // Sweeping Crescent Reaper Blade
          ctx.fillStyle = '#f3e8ff';
          ctx.beginPath();
          ctx.moveTo(0, -16);
          ctx.quadraticCurveTo(24, -18, 22, 8);
          ctx.quadraticCurveTo(12, -8, 0, -8);
          ctx.closePath();
          ctx.fill();
        } else {
          // Double-Bitted Steel Executioner Axe
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-2.5, -14, 5, 28);
          // Gold haft rings
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-3, -12, 6, 2);
          ctx.fillRect(-3, 8, 6, 2);

          // Left & Right Curved Blades
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(-2, -9);
          ctx.quadraticCurveTo(-16, -14, -15, 0);
          ctx.quadraticCurveTo(-16, 14, -2, 6);
          ctx.moveTo(2, -9);
          ctx.quadraticCurveTo(16, -14, 15, 0);
          ctx.quadraticCurveTo(16, 14, 2, 6);
          ctx.fill();

          // Bright Razor Edges
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(-6, -1.5, 9, Math.PI * 0.65, Math.PI * 1.35);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(6, -1.5, 9, -Math.PI * 0.35, Math.PI * 0.35);
          ctx.stroke();
        }
        break;
      }

      // ======================================================================
      // 7. KING BIBLE / UNHOLY VESPERS: Ornate Golden Cross Crusader Shield
      // ======================================================================
      case ProjectileType.ORBITING_ORB: {
        const isUnholy = this.color === '#ef4444' || this.color === '#f43f5e' || this.isEvolved;
        this.renderMotionRibbon(ctx, isUnholy ? '#ef4444' : '#fbbf24', 10, lifeAlpha);
        ctx.globalAlpha = lifeAlpha;

        // 1. Continuous Connecting Sacred Orbit Ring (Drawn relative to orb)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, this.radius * 2.1);
        halo.addColorStop(0, '#ffffff');
        halo.addColorStop(0.35, isUnholy ? 'rgba(244, 63, 94, 0.72)' : 'rgba(251, 191, 36, 0.68)');
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. Heraldic Gothic Heater Shield Body (3-Tone Metallic Gold / Crimson)
        ctx.fillStyle = isUnholy ? '#450a0a' : '#78350f';
        ctx.beginPath();
        ctx.moveTo(-10, -11);
        ctx.lineTo(10, -11);
        ctx.lineTo(10, 0);
        ctx.quadraticCurveTo(10, 10, 0, 14);
        ctx.quadraticCurveTo(-10, 10, -10, 0);
        ctx.closePath();
        ctx.fill();

        // Inner Shield Plate
        ctx.fillStyle = isUnholy ? '#dc2626' : '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(-8, -9);
        ctx.lineTo(8, -9);
        ctx.lineTo(8, 0);
        ctx.quadraticCurveTo(8, 8, 0, 11.5);
        ctx.quadraticCurveTo(-8, 8, -8, 0);
        ctx.closePath();
        ctx.fill();

        // Specular Metallic Bevel Rim
        ctx.strokeStyle = isUnholy ? '#fda4af' : '#fef08a';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // 3. Radiant White-Gold Crusader Cross Emblem on Shield Center
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -7, 4, 15);
        ctx.fillRect(-6, -3, 12, 4);
        break;
      }

      // ======================================================================
      // 8. FIRE WAND / HELLFIRE: Blazing Solar Meteor & Corona
      // ======================================================================
      case ProjectileType.FIREBALL: {
        this.renderMotionRibbon(ctx, this.glowColor || '#f97316', this.radius * 1.5, lifeAlpha);
        ctx.globalAlpha = lifeAlpha;
        ctx.globalCompositeOperation = 'lighter';
        ctx.rotate(this.rotation);

        // Swept Comet Tail
        const tailGrad = ctx.createLinearGradient(-this.radius * 3.2, 0, this.radius, 0);
        tailGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        tailGrad.addColorStop(0.5, '#dc2626');
        tailGrad.addColorStop(0.85, '#f97316');
        tailGrad.addColorStop(1, '#ffffff');

        ctx.fillStyle = tailGrad;
        ctx.beginPath();
        ctx.moveTo(-this.radius * 3.2, 0);
        ctx.quadraticCurveTo(-this.radius * 0.5, -this.radius * 1.3, this.radius, 0);
        ctx.quadraticCurveTo(-this.radius * 0.5, this.radius * 1.3, -this.radius * 3.2, 0);
        ctx.fill();

        // White-Hot Core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      // ======================================================================
      // 9. RUNETRACER / NO FUTURE: Prismatic Diamond Crystal Laser
      // ======================================================================
      case ProjectileType.RUNETRACER_LASER: {
        const hue = (Date.now() * 0.4 + this.id * 50) % 360;
        const prismColor = `hsl(${hue}, 95%, 65%)`;
        this.renderMotionRibbon(ctx, prismColor, 11, lifeAlpha);
        ctx.globalAlpha = lifeAlpha;

        ctx.globalCompositeOperation = 'lighter';
        ctx.rotate(this.rotation);

        // Outer Prismatic Diamond
        ctx.fillStyle = prismColor;
        const r = this.radius * 1.4;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.fill();

        // Inner White Star Core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      // ======================================================================
      // 10. MAGIC WAND / HOLY WAND: Arcane Star Comet with Sonic Arrow-Qi Wake
      // ======================================================================
      default: {
        this.renderMotionRibbon(ctx, this.glowColor || '#38bdf8', this.radius * 1.4, lifeAlpha);
        ctx.globalAlpha = lifeAlpha;
        ctx.globalCompositeOperation = 'lighter';

        // Directional Sonic Arrow-Qi Wake (流线型破空箭气尾羽)
        ctx.save();
        ctx.rotate(this.rotation);
        const wakeGrad = ctx.createLinearGradient(-this.radius * 3.4, 0, this.radius * 1.6, 0);
        wakeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        wakeGrad.addColorStop(0.55, this.color || '#60a5fa');
        wakeGrad.addColorStop(1, '#ffffff');
        ctx.fillStyle = wakeGrad;
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.5, 0);
        ctx.quadraticCurveTo(0, -this.radius * 1.15, -this.radius * 3.2, -this.radius * 1.5);
        ctx.quadraticCurveTo(-this.radius * 0.9, 0, -this.radius * 3.2, this.radius * 1.5);
        ctx.quadraticCurveTo(0, this.radius * 1.15, this.radius * 1.5, 0);
        ctx.fill();
        ctx.restore();

        // Radial Arcane Aura
        const boltGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, this.radius * 2.2);
        boltGrad.addColorStop(0, '#ffffff');
        boltGrad.addColorStop(0.4, this.color || '#60a5fa');
        boltGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = boltGrad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // 4-Pointed Star Flare
        ctx.rotate(this.elapsed * 12);
        ctx.fillStyle = '#ffffff';
        const sr = this.radius * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -sr);
        ctx.quadraticCurveTo(2, -2, sr, 0);
        ctx.quadraticCurveTo(2, 2, 0, sr);
        ctx.quadraticCurveTo(-2, 2, -sr, 0);
        ctx.quadraticCurveTo(-2, -2, 0, -sr);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }
}
