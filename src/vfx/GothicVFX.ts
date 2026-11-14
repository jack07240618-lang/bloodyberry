// Procedural Dark Gothic Maximalist Canvas 2D VFX primitives.
// Pure vector/gradient drawing helpers — zero DOM dependencies so headless Node tests remain safe.

export interface RuneHaloOptions {
  x: number;
  y: number;
  r: number;
  primaryColor: string;
  accentColor?: string;
  rotation?: number;
  counterRotation?: number;
  spokes?: number;
  polygonSides?: number;
  polygonStep?: number;
  ringWidth?: number;
  showNodes?: boolean;
  dashedInner?: boolean;
}

/**
 * Draws a razor-sharp 4-pointed concave Gothic star flare with optional bright core.
 */
export function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  innerR: number,
  color: string,
  coreColor?: string,
  rotation = 0
): void {
  ctx.save();
  ctx.translate(x, y);
  if (rotation !== 0) ctx.rotate(rotation);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -outerR);
  ctx.quadraticCurveTo(innerR, -innerR, outerR, 0);
  ctx.quadraticCurveTo(innerR, innerR, 0, outerR);
  ctx.quadraticCurveTo(-innerR, innerR, -outerR, 0);
  ctx.quadraticCurveTo(-innerR, -innerR, 0, -outerR);
  ctx.closePath();
  ctx.fill();

  if (coreColor) {
    const cr = outerR * 0.56;
    const ci = innerR * 0.52;
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.moveTo(0, -cr);
    ctx.quadraticCurveTo(ci, -ci, cr, 0);
    ctx.quadraticCurveTo(ci, ci, 0, cr);
    ctx.quadraticCurveTo(-ci, ci, -cr, 0);
    ctx.quadraticCurveTo(-ci, -ci, 0, -cr);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws a sculpted Gothic patonce/beveled cross emblem (crusader blades, holy parries, relic seals).
 */
export function drawGothicCrossEmblem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  armLen: number,
  waistWidth: number,
  color: string,
  coreColor?: string,
  rotation = 0
): void {
  ctx.save();
  ctx.translate(x, y);
  if (rotation !== 0) ctx.rotate(rotation);

  const drawCross = (len: number, waist: number, flare: number) => {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      if (i === 0) {
        ctx.moveTo(-waist, -waist);
      }
      ctx.lineTo(-flare, -len * 0.82);
      ctx.lineTo(0, -len);
      ctx.lineTo(flare, -len * 0.82);
      ctx.lineTo(waist, -waist);
    }
    ctx.closePath();
  };

  ctx.fillStyle = color;
  drawCross(armLen, waistWidth, waistWidth * 1.45);
  ctx.fill();

  if (coreColor) {
    ctx.fillStyle = coreColor;
    drawCross(armLen * 0.72, waistWidth * 0.5, waistWidth * 0.76);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws a spiked iron-and-gold Gothic crown ring with radial thorns and cardinal diamonds.
 */
export function drawFiligreeSpikeRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  spikeCount: number,
  spikeLen: number,
  color: string,
  rotation = 0,
  ringWidth = 1.6
): void {
  ctx.save();
  ctx.translate(x, y);
  if (rotation !== 0) ctx.rotate(rotation);

  ctx.strokeStyle = color;
  ctx.lineWidth = ringWidth;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  for (let i = 0; i < spikeCount; i++) {
    const ang = (i * Math.PI * 2) / spikeCount;
    const isCardinal = spikeCount >= 8 && i % 2 === 0;
    const len = isCardinal ? spikeLen * 1.35 : spikeLen * 0.85;
    const halfBase = isCardinal ? Math.max(1.8, r * 0.055) : Math.max(1.2, r * 0.036);

    ctx.save();
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(r + len, 0);
    ctx.lineTo(r - 1, -halfBase);
    ctx.lineTo(r - 1.5, 0);
    ctx.lineTo(r - 1, halfBase);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draws a rotating concentric Gothic ritual mandala: double circles, polygon/star star-seal, and diamond rune nodes.
 */
export function drawConcentricRuneHalo(ctx: CanvasRenderingContext2D, o: RuneHaloOptions): void {
  const {
    x,
    y,
    r,
    primaryColor,
    accentColor = '#ffffff',
    rotation = 0,
    counterRotation = -rotation * 0.75,
    spokes = 8,
    polygonSides = 6,
    polygonStep = 2,
    ringWidth = 1.6,
    showNodes = true,
    dashedInner = true
  } = o;

  if (r <= 1) return;

  ctx.save();
  ctx.translate(x, y);

  // Outer perimeter track & counter-rotating inner tracery ring
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = ringWidth;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.rotate(counterRotation);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = Math.max(0.8, ringWidth * 0.68);
  if (dashedInner) {
    ctx.setLineDash([Math.max(4, r * 0.14), Math.max(3, r * 0.1)]);
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Radial Gothic mullion spokes between inner & outer rings
  if (spokes > 0) {
    ctx.beginPath();
    for (let i = 0; i < spokes; i++) {
      const a = (i * Math.PI * 2) / spokes;
      ctx.moveTo(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68);
      ctx.lineTo(Math.cos(a) * r * 0.99, Math.sin(a) * r * 0.99);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Inscribed rotating polygon / interlaced star seal
  if (polygonSides >= 3) {
    ctx.save();
    ctx.rotate(rotation);
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = ringWidth * 0.9;
    const starR = r * 0.79;

    if (polygonStep > 1 && polygonSides % polygonStep === 0) {
      // Interlaced compound polygon (e.g., Hexagram = two triangles, Octagram = two squares)
      const subCount = polygonStep;
      const vertsPerSub = polygonSides / subCount;
      for (let s = 0; s < subCount; s++) {
        ctx.beginPath();
        for (let v = 0; v <= vertsPerSub; v++) {
          const ang = ((v * subCount + s) * Math.PI * 2) / polygonSides - Math.PI / 2;
          const px = Math.cos(ang) * starR;
          const py = Math.sin(ang) * starR;
          if (v === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      for (let i = 0; i <= polygonSides; i++) {
        const idx = (i * polygonStep) % polygonSides;
        const ang = (idx * Math.PI * 2) / polygonSides - Math.PI / 2;
        const px = Math.cos(ang) * starR;
        const py = Math.sin(ang) * starR;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Diamond vertex nodes along outer rim
    if (showNodes) {
      ctx.fillStyle = accentColor;
      const nodeSize = Math.max(1.8, Math.min(4.2, r * 0.055));
      for (let i = 0; i < polygonSides; i++) {
        const ang = (i * Math.PI * 2) / polygonSides - Math.PI / 2;
        const nx = Math.cos(ang) * r;
        const ny = Math.sin(ang) * r;
        ctx.save();
        ctx.translate(nx, ny);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(nodeSize * 1.4, 0);
        ctx.lineTo(0, -nodeSize * 0.75);
        ctx.lineTo(-nodeSize * 1.1, 0);
        ctx.lineTo(0, nodeSize * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draws pointed-arch Cathedral Rose Window petal web around (x, y).
 */
export function drawCathedralRoseWeb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  petals: number,
  rotation: number,
  primaryColor: string,
  accentColor: string,
  lineWidth = 1.5
): void {
  if (r <= 2 || petals < 3) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = lineWidth;

  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / petals);
    // Pointed gothic lancet arch loop
    const baseR = r * 0.28;
    const tipR = r * 0.96;
    const bulgeW = r * (Math.PI / petals) * 0.58;
    ctx.beginPath();
    ctx.moveTo(baseR, 0);
    ctx.quadraticCurveTo(r * 0.64, -bulgeW, tipR, 0);
    ctx.quadraticCurveTo(r * 0.64, bulgeW, baseR, 0);
    ctx.stroke();

    // Inner filigree spine & cusp bead
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(0.7, lineWidth * 0.55);
    ctx.beginPath();
    ctx.moveTo(baseR * 1.15, 0);
    ctx.lineTo(tipR * 0.88, 0);
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(tipR * 0.72, 0, Math.max(1.2, r * 0.025), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = lineWidth;
    ctx.restore();
  }

  ctx.restore();
}
