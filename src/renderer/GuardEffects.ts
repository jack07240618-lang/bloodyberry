/** Feathered light volumes and beveled sigils in the existing emerald/gold palette. */
export function renderGuardEffect(ctx: CanvasRenderingContext2D, active: number, success: number): void {
  if (active <= 0 && success <= 0) return;
  const won = success > 0;
  const progress = won ? 1 - success / 0.5 : 1 - active / 0.24;
  const radius = won ? 28 + progress * 62 : 31 + Math.sin(progress * Math.PI) * 5;
  ctx.save();
  ctx.globalAlpha = won ? Math.pow(1 - progress, 0.8) : 0.8;
  // Dark backing gives the translucent shield depth against bright floor lights.
  const shadow = ctx.createRadialGradient(0, 4, 5, 0, 4, radius);
  shadow.addColorStop(0, 'rgba(2,6,12,0.05)');
  shadow.addColorStop(0.7, 'rgba(2,6,12,0.6)');
  shadow.addColorStop(1, 'rgba(2,6,12,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath(); ctx.ellipse(0, 4, radius, radius * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, radius * 1.3);
  halo.addColorStop(0, won ? 'rgba(254,243,199,0.65)' : 'rgba(52,211,153,0.06)');
  halo.addColorStop(0.55, 'rgba(16,185,129,0.1)');
  halo.addColorStop(0.76, 'rgba(52,211,153,0.36)');
  halo.addColorStop(1, 'rgba(16,185,129,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.3, radius, 0, 0, Math.PI * 2); ctx.fill();
  // A filled, shaded annulus rather than a bare outline.
  const rim = ctx.createLinearGradient(0, -radius, 0, radius);
  rim.addColorStop(0, '#fff7d6'); rim.addColorStop(0.35, '#a7f3d0');
  rim.addColorStop(0.7, '#059669'); rim.addColorStop(1, '#fbbf24');
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.ellipse(0, 0, radius, radius * 0.72, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 0, radius - 2.5, (radius - 2.5) * 0.72, 0, 0, Math.PI * 2, true); ctx.fill();
  // Small cathedral lancets fracture outward only on success.
  for (let i = 0; i < (won ? 8 : 4); i++) {
    const angle = i * Math.PI / (won ? 4 : 2) + progress * 0.2;
    ctx.save(); ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = i % 2 ? '#fef3c7' : '#a7f3d0';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(2.5, 0); ctx.lineTo(0, 5); ctx.lineTo(-2.5, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
