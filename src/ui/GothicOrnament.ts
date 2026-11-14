// Reusable procedural Canvas 2D Dark Gothic Maximalist ornaments and architectural motifs.
// All offscreen canvas caches are lazily initialized during render calls so headless Node tests remain safe.

export const GOTHIC_DISPLAY_FONT = '"Cinzel", "Noto Serif SC", "Songti SC", "STSong", Georgia, serif';
export const GOTHIC_BODY_FONT = '"Noto Serif SC", "Songti SC", "STSong", "PingFang SC", Georgia, serif';
export const GOTHIC_MONO_FONT = '"Cinzel", ui-monospace, "SF Mono", "JetBrains Mono", monospace';

let damaskPatternCache: CanvasPattern | null = null;
let damaskCanvasCache: HTMLCanvasElement | null = null;
const roseWindowCache = new Map<string, HTMLCanvasElement>();

function getDamaskCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (damaskCanvasCache) return damaskCanvasCache;

  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return null;

  g.clearRect(0, 0, size, size);
  g.strokeStyle = 'rgba(255, 255, 255, 0.032)';
  g.fillStyle = 'rgba(180, 30, 58, 0.035)';
  g.lineWidth = 1;

  // Draw interlocking Gothic diamond lattice + subtle quatrefoil motif at tile center & corners
  const drawQuatrefoil = (cx: number, cy: number, r: number) => {
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.quadraticCurveTo(cx + r * 0.42, cy - r * 0.42, cx + r, cy);
    g.quadraticCurveTo(cx + r * 0.42, cy + r * 0.42, cx, cy + r);
    g.quadraticCurveTo(cx - r * 0.42, cy + r * 0.42, cx - r, cy);
    g.quadraticCurveTo(cx - r * 0.42, cy - r * 0.42, cx, cy - r);
    g.closePath();
    g.fill();
    g.stroke();

    // Inner petal lobes
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      g.moveTo(cx + Math.cos(ang) * r * 0.55 + r * 0.18, cy + Math.sin(ang) * r * 0.55);
      g.arc(cx + Math.cos(ang) * r * 0.55, cy + Math.sin(ang) * r * 0.55, r * 0.18, 0, Math.PI * 2);
    }
    g.stroke();
  };

  drawQuatrefoil(size / 2, size / 2, 16);
  drawQuatrefoil(0, 0, 14);
  drawQuatrefoil(size, 0, 14);
  drawQuatrefoil(0, size, 14);
  drawQuatrefoil(size, size, 14);

  // Subtle crosshatch hairline
  g.strokeStyle = 'rgba(251, 191, 36, 0.018)';
  g.beginPath();
  g.moveTo(0, size / 2);
  g.lineTo(size / 2, 0);
  g.lineTo(size, size / 2);
  g.lineTo(size / 2, size);
  g.closePath();
  g.stroke();

  damaskCanvasCache = c;
  return c;
}

export function applyDamaskFill(ctx: CanvasRenderingContext2D): void {
  const dc = getDamaskCanvas();
  if (!dc) return;
  if (!damaskPatternCache) {
    damaskPatternCache = ctx.createPattern(dc, 'repeat');
  }
  if (damaskPatternCache) {
    ctx.fillStyle = damaskPatternCache;
    ctx.fill();
  }
}

export interface GothicTabletOptions {
  topColor?: string;
  bottomColor?: string;
  borderOuter?: string;
  borderInner?: string;
  accentColor?: string;
  cornerSize?: number;
  chamfer?: number;
  showSpikes?: boolean;
  showDamask?: boolean;
  glowAlpha?: number;
}

/**
 * Traces a Gothic chamfered-corner tablet path (sharp architectural bevels rather than soft modern roundRect).
 */
export function traceChamferedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut = 8
): void {
  const c = Math.min(cut, w * 0.25, h * 0.25);
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/**
 * Draws an ornate wrought-iron & gilded-bronze corner scroll bracket with thorn barb & ruby/gem rivet.
 */
export function drawFiligreeCorner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sx: 1 | -1,
  sy: 1 | -1,
  size: number,
  goldColor = '#d97706',
  gemColor = '#dc2626'
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);

  // Dark wrought-iron backing scroll
  ctx.strokeStyle = '#0a0710';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, size * 0.95);
  ctx.lineTo(2, 4);
  ctx.lineTo(size * 0.95, 4);
  ctx.stroke();

  // Gilded filigree arms
  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(3, size);
  ctx.lineTo(3, 3);
  ctx.lineTo(size, 3);
  // Inner spiral volutes
  ctx.moveTo(3, size * 0.56);
  ctx.quadraticCurveTo(size * 0.34, size * 0.54, size * 0.36, size * 0.28);
  ctx.quadraticCurveTo(size * 0.36, size * 0.14, size * 0.22, size * 0.16);
  ctx.moveTo(size * 0.56, 3);
  ctx.quadraticCurveTo(size * 0.54, size * 0.34, size * 0.28, size * 0.36);
  ctx.quadraticCurveTo(size * 0.14, size * 0.36, size * 0.16, size * 0.22);
  // Diagonal gothic thorn barb
  ctx.moveTo(3, 3);
  ctx.lineTo(size * 0.32, size * 0.32);
  ctx.stroke();

  // Corner jewel rivet
  ctx.fillStyle = '#09060e';
  ctx.beginPath();
  ctx.arc(5.5, 5.5, 2.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = gemColor;
  ctx.beginPath();
  ctx.arc(5.5, 5.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.fillRect(4.7, 4.7, 0.9, 0.9);

  ctx.restore();
}

/**
 * Draws a rich Dark Gothic Maximalist reliquary tablet with damask texture, beveled stone/iron lip,
 * double gilded pinstripes, corner filigree scrolls, and optional top/bottom spearhead spires.
 */
export function drawGothicTablet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: GothicTabletOptions = {}
): void {
  const {
    topColor = '#191022',
    bottomColor = '#07040b',
    borderOuter = '#523a28',
    borderInner = '#d97706',
    accentColor = '#dc2626',
    cornerSize = 15,
    chamfer = 8,
    showSpikes = false,
    showDamask = true,
    glowAlpha = 0
  } = opts;

  ctx.save();

  // 1. Optional atmospheric aura glow behind tablet
  if (glowAlpha > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, w * 0.15, x + w / 2, y + h / 2, Math.max(w, h) * 0.78);
    g.addColorStop(0, accentColor);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = glowAlpha;
    ctx.fillStyle = g;
    ctx.fillRect(x - 28, y - 28, w + 56, h + 56);
    ctx.restore();
  }

  // 2. Deep drop shadow & 3D extruded dark-iron bottom lip
  ctx.fillStyle = 'rgba(0, 0, 0, 0.84)';
  traceChamferedRect(ctx, x + 2, y + 6, w, h, chamfer);
  ctx.fill();

  ctx.fillStyle = '#030206';
  traceChamferedRect(ctx, x, y + 3.5, w, h, chamfer);
  ctx.fill();

  // 3. Main Obsidian-Velvet Gradient Body
  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  bodyGrad.addColorStop(0, topColor);
  bodyGrad.addColorStop(0.5, '#0e0814');
  bodyGrad.addColorStop(1, bottomColor);
  ctx.fillStyle = bodyGrad;
  traceChamferedRect(ctx, x, y, w, h, chamfer);
  ctx.fill();

  // 4. Engraved Gothic Damask Texture overlay inside clipped tablet
  if (showDamask) {
    ctx.save();
    traceChamferedRect(ctx, x, y, w, h, chamfer);
    ctx.clip();
    applyDamaskFill(ctx);

    // Subtle top interior crimson vignette sheen
    const innerGlow = ctx.createRadialGradient(x + w / 2, y + 10, 4, x + w / 2, y + 10, w * 0.7);
    innerGlow.addColorStop(0, 'rgba(220, 38, 38, 0.08)');
    innerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = innerGlow;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // 5. Outer Wrought-Iron Frame & Top Specular Bevel
  ctx.strokeStyle = borderOuter;
  ctx.lineWidth = 2.0;
  traceChamferedRect(ctx, x, y, w, h, chamfer);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 240, 215, 0.14)';
  ctx.fillRect(x + chamfer + 4, y + 1, Math.max(0, w - (chamfer + 4) * 2), 1);

  // 6. Inner Antiqued-Gold Pinstripe Frame
  const inset = 4.5;
  ctx.strokeStyle = borderInner;
  ctx.lineWidth = 1.0;
  traceChamferedRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(3, chamfer - 2));
  ctx.stroke();

  // 7. Four Filigree Corner Scroll Brackets
  if (cornerSize > 0) {
    const pad = 2;
    drawFiligreeCorner(ctx, x + pad, y + pad, 1, 1, cornerSize, borderInner, accentColor);
    drawFiligreeCorner(ctx, x + w - pad, y + pad, -1, 1, cornerSize, borderInner, accentColor);
    drawFiligreeCorner(ctx, x + pad, y + h - pad, 1, -1, cornerSize, borderInner, accentColor);
    drawFiligreeCorner(ctx, x + w - pad, y + h - pad, -1, -1, cornerSize, borderInner, accentColor);
  }

  // 8. Optional Top & Bottom Gothic Finial Spires
  if (showSpikes) {
    const cx = x + w / 2;
    for (const dir of [-1, 1]) {
      const baseY = dir === -1 ? y : y + h;
      const tipY = baseY + dir * 9;
      ctx.fillStyle = '#09060d';
      ctx.strokeStyle = borderInner;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx - 10, baseY);
      ctx.lineTo(cx, tipY);
      ctx.lineTo(cx + 10, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(cx, baseY + dir * 2.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Draws a pointed Gothic Cathedral Lancet Arch Niche (for portraits, cards, and shrines).
 */
export function drawPointedArchNiche(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  w: number,
  h: number,
  borderColor = '#d97706',
  fillTop = '#220b1a',
  fillBot = '#050308'
): void {
  const hw = w / 2;
  const springY = topY + h * 0.42;
  const botY = topY + h;

  const traceArch = (inset = 0) => {
    const ahw = hw - inset;
    const atop = topY + inset * 1.1;
    const abot = botY - inset;
    ctx.beginPath();
    ctx.moveTo(cx - ahw, abot);
    ctx.lineTo(cx - ahw, springY);
    ctx.quadraticCurveTo(cx - ahw * 0.92, atop + h * 0.12, cx, atop);
    ctx.quadraticCurveTo(cx + ahw * 0.92, atop + h * 0.12, cx + ahw, springY);
    ctx.lineTo(cx + ahw, abot);
    ctx.closePath();
  };

  ctx.save();
  // Recessed stone shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  traceArch(-2);
  ctx.fill();

  // Interior lancet stained-glass gradient
  const grad = ctx.createLinearGradient(cx, topY, cx, botY);
  grad.addColorStop(0, fillTop);
  grad.addColorStop(0.6, '#0b0612');
  grad.addColorStop(1, fillBot);
  ctx.fillStyle = grad;
  traceArch(0);
  ctx.fill();

  // Subtle gothic trefoil mullion lines inside arch
  ctx.save();
  traceArch(1);
  ctx.clip();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, springY - h * 0.08, hw * 0.62, Math.PI, 0, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, topY + 4);
  ctx.lineTo(cx, botY);
  ctx.stroke();
  ctx.restore();

  // Outer gilded arch molding + keystone diamond
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.6;
  traceArch(0);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 0.8;
  traceArch(3);
  ctx.stroke();

  // Apex finial diamond
  ctx.fillStyle = borderColor;
  ctx.beginPath();
  ctx.moveTo(cx, topY - 4);
  ctx.lineTo(cx + 3.5, topY + 1.5);
  ctx.lineTo(cx, topY + 6.5);
  ctx.lineTo(cx - 3.5, topY + 1.5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draws an ornamental Gothic horizontal divider with spearhead tips, scroll volutes & center gem.
 */
export function drawGothicDivider(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  halfWidth: number,
  goldColor = '#d97706',
  gemColor = '#dc2626'
): void {
  ctx.save();
  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 1.1;

  // Main winged bar
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, y);
  ctx.lineTo(cx - 10, y);
  ctx.moveTo(cx + 10, y);
  ctx.lineTo(cx + halfWidth, y);
  ctx.stroke();

  // Subtle inner twin hairline
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth * 0.72, y + 3);
  ctx.lineTo(cx - 14, y + 3);
  ctx.moveTo(cx + 14, y + 3);
  ctx.lineTo(cx + halfWidth * 0.72, y + 3);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // End spearheads & scroll hooks
  for (const dir of [-1, 1] as const) {
    const ex = cx + dir * halfWidth;
    ctx.fillStyle = goldColor;
    ctx.beginPath();
    ctx.moveTo(ex + dir * 6, y);
    ctx.lineTo(ex, y - 2.6);
    ctx.lineTo(ex - dir * 3, y);
    ctx.lineTo(ex, y + 2.6);
    ctx.closePath();
    ctx.fill();

    // Inner curl near gem
    ctx.beginPath();
    ctx.arc(cx + dir * 13, y - 3, 3, 0, Math.PI * 1.4, dir < 0);
    ctx.stroke();
  }

  // Center gothic diamond bezel + glowing ruby
  ctx.fillStyle = '#09060d';
  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, y - 6);
  ctx.lineTo(cx + 6, y);
  ctx.lineTo(cx, y + 6);
  ctx.lineTo(cx - 6, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = gemColor;
  ctx.beginPath();
  ctx.moveTo(cx, y - 3.6);
  ctx.lineTo(cx + 3.6, y);
  ctx.lineTo(cx, y + 3.6);
  ctx.lineTo(cx - 3.6, y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a stamped Gothic crimson/gold wax seal badge.
 */
export function drawWaxSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  fillColor = '#991b1b',
  rimColor = '#fbbf24',
  label = ''
): void {
  ctx.save();
  ctx.translate(cx, cy);

  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.beginPath();
  ctx.arc(1, 2, radius + 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Scalloped gothic wax perimeter (10 lobes)
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  const lobes = 10;
  for (let i = 0; i <= lobes * 4; i++) {
    const a = (i / (lobes * 4)) * Math.PI * 2;
    const r = radius + Math.sin(a * lobes) * 1.5;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = rimColor;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.76, 0, Math.PI * 2);
  ctx.stroke();

  if (label) {
    ctx.fillStyle = '#fef3c7';
    ctx.font = `700 ${Math.max(8, Math.round(radius * 0.88))}px ${GOTHIC_DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0.5);
  }

  ctx.restore();
}

/**
 * Draws a pre-rendered intricate Gothic Cathedral Stained-Glass Rose Window Mandala centered at (cx, cy).
 */
export function drawRoseWindowMandala(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotation: number,
  primaryHex = '#dc2626',
  secondaryHex = '#7c3aed',
  alpha = 0.55
): void {
  if (typeof document === 'undefined') return;
  const key = `${Math.round(radius)}_${primaryHex}_${secondaryHex}`;
  let offscreen = roseWindowCache.get(key);

  if (!offscreen) {
    const dim = Math.ceil(radius * 2 + 24);
    const c = document.createElement('canvas');
    c.width = dim;
    c.height = dim;
    const g = c.getContext('2d');
    if (g) {
      const mid = dim / 2;
      g.translate(mid, mid);

      // Outer stone tracery ring & cusps
      g.fillStyle = 'rgba(7, 4, 13, 0.72)';
      g.beginPath();
      g.arc(0, 0, radius, 0, Math.PI * 2);
      g.fill();

      // 16 Stained-glass lancet petals
      const petals = 16;
      for (let i = 0; i < petals; i++) {
        const a0 = (i * Math.PI * 2) / petals;
        const a1 = ((i + 1) * Math.PI * 2) / petals;
        const amid = (a0 + a1) * 0.5;
        const col = i % 2 === 0 ? primaryHex : secondaryHex;

        const pGrad = g.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 0.94);
        pGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
        pGrad.addColorStop(0.45, col);
        pGrad.addColorStop(1, 'rgba(10, 5, 18, 0.85)');

        g.fillStyle = pGrad;
        g.globalAlpha = 0.52;
        g.beginPath();
        g.moveTo(Math.cos(a0) * radius * 0.24, Math.sin(a0) * radius * 0.24);
        g.lineTo(Math.cos(a0) * radius * 0.84, Math.sin(a0) * radius * 0.84);
        g.quadraticCurveTo(
          Math.cos(amid) * radius * 0.98,
          Math.sin(amid) * radius * 0.98,
          Math.cos(a1) * radius * 0.84,
          Math.sin(a1) * radius * 0.84
        );
        g.lineTo(Math.cos(a1) * radius * 0.24, Math.sin(a1) * radius * 0.24);
        g.closePath();
        g.fill();

        // Lead came iron dividers & outer trefoil cusps
        g.globalAlpha = 0.88;
        g.strokeStyle = '#07040b';
        g.lineWidth = 3;
        g.stroke();

        g.strokeStyle = 'rgba(217, 119, 6, 0.42)';
        g.lineWidth = 0.9;
        g.beginPath();
        g.arc(Math.cos(amid) * radius * 0.72, Math.sin(amid) * radius * 0.72, radius * 0.085, 0, Math.PI * 2);
        g.stroke();
      }

      // Concentric ironwork & gilded astrolabe rings
      g.globalAlpha = 1;
      for (const frac of [0.96, 0.88, 0.56, 0.34, 0.22]) {
        g.strokeStyle = frac === 0.88 || frac === 0.34 ? 'rgba(251, 191, 36, 0.52)' : 'rgba(148, 163, 184, 0.28)';
        g.lineWidth = frac === 0.96 ? 3.5 : 1.3;
        g.beginPath();
        g.arc(0, 0, radius * frac, 0, Math.PI * 2);
        g.stroke();
      }

      // 8-pointed Gothic cathedral compass star in core
      g.strokeStyle = 'rgba(251, 191, 36, 0.65)';
      g.lineWidth = 1.4;
      for (let s = 0; s < 8; s++) {
        const ang = (s * Math.PI) / 4;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(ang) * radius * 0.54, Math.sin(ang) * radius * 0.54);
        g.stroke();
      }

      // 24 outer gothic spire ticks
      for (let k = 0; k < 24; k++) {
        const ka = (k * Math.PI * 2) / 24;
        g.strokeStyle = 'rgba(217, 119, 6, 0.45)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(Math.cos(ka) * radius * 0.96, Math.sin(ka) * radius * 0.96);
        g.lineTo(Math.cos(ka) * (radius + 7), Math.sin(ka) * (radius + 7));
        g.stroke();
      }
    }
    roseWindowCache.set(key, c);
    offscreen = c;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.drawImage(offscreen, -offscreen.width / 2, -offscreen.height / 2);
  ctx.restore();
}

/**
 * Draws an animated candle flame + radial halo for Gothic chandeliers & altar candles.
 */
export function drawCandelabraFlame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  timeSec: number,
  phase: number,
  coreColor = '#fef08a',
  outerColor = 'rgba(239, 68, 68, 0.55)'
): void {
  const flicker = 0.88 + Math.sin(timeSec * 9.5 + phase) * 0.12;
  const sway = Math.sin(timeSec * 11 + phase * 1.7) * 1.6 * scale;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const haloR = 24 * scale * flicker;
  const halo = ctx.createRadialGradient(x, y - 3 * scale, 1, x, y - 3 * scale, haloR);
  halo.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  halo.addColorStop(0.3, outerColor);
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y - 3 * scale, haloR, 0, Math.PI * 2);
  ctx.fill();

  // Outer flame tongue
  ctx.fillStyle = outerColor;
  ctx.beginPath();
  ctx.moveTo(x - 3 * scale, y);
  ctx.quadraticCurveTo(x - 2.5 * scale, y - 7 * scale, x + sway, y - 11 * scale * flicker);
  ctx.quadraticCurveTo(x + 2.5 * scale, y - 7 * scale, x + 3 * scale, y);
  ctx.closePath();
  ctx.fill();

  // Bright core
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.ellipse(x + sway * 0.35, y - 3.2 * scale, 1.5 * scale, 3.2 * scale * flicker, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a monumental Dark Gothic Cathedral backdrop (vaulted arches, stained-glass lancets,
 * central rotating Rose Window, and twin hanging iron candle chandeliers).
 */
export function drawCathedralBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  primaryHex = '#dc2626',
  secondaryHex = '#7c3aed'
): void {
  ctx.save();

  // 1. Abyssal Crimson-Obsidian Cathedral Vault Gradient
  const skyGrad = ctx.createRadialGradient(
    width / 2,
    height * 0.24,
    24,
    width / 2,
    height * 0.48,
    Math.max(width, height) * 0.88
  );
  skyGrad.addColorStop(0, '#220b1b');
  skyGrad.addColorStop(0.38, '#100716');
  skyGrad.addColorStop(0.75, '#07040c');
  skyGrad.addColorStop(1, '#020105');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Towering Pointed Gothic Lancet Windows & Ribbed Vault Columns in Background
  const archXs = [0.1, 0.26, 0.74, 0.9];
  for (let i = 0; i < archXs.length; i++) {
    const ax = width * archXs[i];
    const aw = Math.min(118, width * 0.12);
    const ah = height * 0.56;
    const topY = height * 0.08;

    // Distant stained-glass glow
    ctx.save();
    ctx.globalAlpha = 0.28;
    drawPointedArchNiche(
      ctx,
      ax,
      topY,
      aw,
      ah,
      'rgba(180, 120, 60, 0.35)',
      i % 2 === 0 ? 'rgba(153, 27, 27, 0.35)' : 'rgba(109, 40, 217, 0.32)',
      'rgba(4, 2, 8, 0.95)'
    );
    ctx.restore();

    // Ribbed masonry column shafts flanking each bay
    ctx.fillStyle = 'rgba(4, 2, 8, 0.86)';
    ctx.fillRect(ax - aw * 0.65, 0, 12, height);
    ctx.fillRect(ax + aw * 0.65 - 12, 0, 12, height);
  }

  // 3. Colossal Rotating Stained-Glass Rose Window behind center
  const roseR = Math.min(width, height) * 0.34;
  drawRoseWindowMandala(ctx, width / 2, height * 0.38, roseR, timeSec * 0.035, primaryHex, secondaryHex, 0.52);

  // 4. Diagonal Volumetric Cathedral God-Rays passing through the Rose Window
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let s = 0; s < 3; s++) {
    const rayX = width * (0.28 + s * 0.22) + Math.sin(timeSec * 0.38 + s) * 16;
    const rayW = 105 + (s % 2) * 42;
    const rayGrad = ctx.createLinearGradient(rayX, 0, rayX + 160, height * 0.9);
    rayGrad.addColorStop(0, s === 1 ? 'rgba(251, 191, 36, 0.08)' : 'rgba(220, 38, 38, 0.06)');
    rayGrad.addColorStop(0.5, s === 1 ? 'rgba(192, 132, 252, 0.03)' : 'rgba(251, 191, 36, 0.025)');
    rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(rayX - rayW * 0.35, 0);
    ctx.lineTo(rayX + rayW * 0.35, 0);
    ctx.lineTo(rayX + 210 + rayW * 0.72, height * 0.92);
    ctx.lineTo(rayX + 210 - rayW * 0.72, height * 0.92);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 5. Twin Hanging Wrought-Iron Candle Chandeliers (Left & Right upper corners)
  if (width >= 680) {
    for (const side of [-1, 1]) {
      const sway = Math.sin(timeSec * 0.8 + side) * 2.5;
      const cx = side < 0 ? Math.max(76, width * 0.09) : Math.min(width - 76, width * 0.91);
      const cy = Math.min(115, height * 0.16);

      // Hanging chain
      ctx.strokeStyle = '#33293a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx + sway, cy);
      ctx.stroke();

      // Iron chandelier ring & arms
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx + sway - 28, cy + 8);
      ctx.quadraticCurveTo(cx + sway, cy + 16, cx + sway + 28, cy + 8);
      ctx.stroke();

      // 3 candles
      for (const ox of [-24, 0, 24]) {
        const candX = cx + sway + ox;
        const candY = cy + (ox === 0 ? 11 : 7);
        ctx.fillStyle = '#e7dcc8';
        ctx.fillRect(candX - 2, candY - 9, 4, 9);
        drawCandelabraFlame(ctx, candX, candY - 10, 0.72, timeSec, ox + side * 3);
      }
    }
  }

  // 6. Floating Gothic Embers & Incense Ash Motes
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let e = 0; e < 28; e++) {
    const ex = ((e * 173 + Math.sin(timeSec * 0.85 + e) * 42) % width + width) % width;
    const ey = ((height - ((timeSec * (16 + (e % 14)) + e * 67) % height)) + height) % height;
    const er = 1.1 + (e % 3) * 0.55;
    ctx.fillStyle = e % 3 === 0 ? 'rgba(251, 191, 36, 0.34)' : e % 2 === 0 ? 'rgba(239, 68, 68, 0.30)' : 'rgba(226, 232, 240, 0.18)';
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 7. Deep Cathedral Edge Vignette
  const edgeVig = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.3,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  );
  edgeVig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  edgeVig.addColorStop(1, 'rgba(2, 1, 5, 0.72)');
  ctx.fillStyle = edgeVig;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

/**
 * Draws a delicate wrought-iron Gothic border around full-screen title/modal overlays.
 */
export function drawScreenIronFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  goldColor = 'rgba(217, 119, 6, 0.58)',
  gemColor = '#dc2626'
): void {
  const m = 10;
  ctx.save();
  ctx.strokeStyle = 'rgba(82, 58, 40, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(m, m, width - m * 2, height - m * 2);

  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(m + 4, m + 4, width - (m + 4) * 2, height - (m + 4) * 2);

  const cSize = 24;
  drawFiligreeCorner(ctx, m + 1, m + 1, 1, 1, cSize, goldColor, gemColor);
  drawFiligreeCorner(ctx, width - m - 1, m + 1, -1, 1, cSize, goldColor, gemColor);
  drawFiligreeCorner(ctx, m + 1, height - m - 1, 1, -1, cSize, goldColor, gemColor);
  drawFiligreeCorner(ctx, width - m - 1, height - m - 1, -1, -1, cSize, goldColor, gemColor);
  ctx.restore();
}

export interface GothicGaugeOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  ratio: number;
  lagRatio?: number;
  fillTop: string;
  fillMid: string;
  fillBot: string;
  frameGold?: string;
  segments?: number;
  endCaps?: boolean;
  pulse?: number;
}

/**
 * Shared Dark Gothic sculpted metal & liquid-glass gauge bar (used for HP, Boss HP, and DPS meters).
 */
export function drawGothicGaugeBar(ctx: CanvasRenderingContext2D, o: GothicGaugeOptions): void {
  const {
    x,
    y,
    w,
    h,
    ratio,
    lagRatio,
    fillTop,
    fillMid,
    fillBot,
    frameGold = '#d97706',
    segments = 4,
    endCaps = true,
    pulse = 0
  } = o;

  const pct = Math.max(0, Math.min(1, ratio));
  const lag = lagRatio !== undefined ? Math.max(pct, Math.min(1, lagRatio)) : pct;

  ctx.save();

  // 1. Drop Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  traceChamferedRect(ctx, x - 2, y + 1.5, w + 4, h + 4, 3);
  ctx.fill();

  // 2. Sculpted Iron & Bronze Casing
  const caseGrad = ctx.createLinearGradient(0, y - 2, 0, y + h + 2);
  caseGrad.addColorStop(0, '#3d2c2e');
  caseGrad.addColorStop(0.5, '#130c18');
  caseGrad.addColorStop(1, '#040207');
  ctx.fillStyle = caseGrad;
  traceChamferedRect(ctx, x - 2, y - 2, w + 4, h + 4, 3);
  ctx.fill();

  ctx.strokeStyle = frameGold;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 3. Recessed Obsidian Inner Trough
  ctx.fillStyle = '#030206';
  ctx.fillRect(x, y, w, h);

  // 4. Lag Ghost Bar (White-Gold Flash Decay)
  if (lag > pct + 0.004) {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.86)';
    ctx.fillRect(x, y, w * lag, h);
  }

  // 5. Cylindrical 3-Stop Liquid Glass Fill
  const fillW = w * pct;
  if (fillW > 0.6) {
    const fGrad = ctx.createLinearGradient(0, y, 0, y + h);
    fGrad.addColorStop(0, fillTop);
    fGrad.addColorStop(0.42, fillMid);
    fGrad.addColorStop(1, fillBot);
    ctx.fillStyle = fGrad;
    ctx.fillRect(x, y, fillW, h);

    // Top specular glass highlight
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.34 + pulse * 0.16).toFixed(2)})`;
    ctx.fillRect(x, y, fillW, Math.max(1.2, h * 0.28));

    // Glowing meniscus edge
    ctx.fillStyle = 'rgba(255, 250, 230, 0.85)';
    ctx.fillRect(x + Math.max(0, fillW - 1.5), y, 1.5, h);
  }

  // 6. Gothic Brass Ribbed Segment Notches
  if (segments > 1) {
    ctx.fillStyle = 'rgba(3, 2, 6, 0.72)';
    for (let s = 1; s < segments; s++) {
      const sx = x + (w * s) / segments;
      ctx.fillRect(sx - 0.6, y, 1.2, h);
    }
  }

  // 7. Spiked Gold Diamond End-Caps
  if (endCaps) {
    ctx.fillStyle = frameGold;
    for (const dir of [-1, 1] as const) {
      const ex = dir < 0 ? x - 2.5 : x + w + 2.5;
      const ey = y + h / 2;
      ctx.beginPath();
      ctx.moveTo(ex + dir * 4.5, ey);
      ctx.lineTo(ex, ey - 3.2);
      ctx.lineTo(ex - dir * 2.5, ey);
      ctx.lineTo(ex, ey + 3.2);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Draws a winged Gothic cartouche header banner (for Modal titles, Floor crest, etc.).
 */
export function drawGothicCrestBanner(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  accentColor = '#d97706',
  gemColor = '#dc2626'
): void {
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.save();

  // Left & Right pointed banner wings
  for (const dir of [-1, 1] as const) {
    const sx = cx + dir * (w / 2 - 2);
    ctx.fillStyle = '#09050e';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(sx, y + 4);
    ctx.lineTo(sx + dir * 18, cy);
    ctx.lineTo(sx, y + h - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawGothicTablet(ctx, x, y, w, h, {
    topColor: '#1f1126',
    bottomColor: '#07040b',
    borderOuter: '#4a3228',
    borderInner: accentColor,
    accentColor: gemColor,
    cornerSize: 9,
    chamfer: 6,
    showDamask: false
  });

  ctx.restore();
}
