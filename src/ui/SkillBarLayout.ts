// Rendering and pointer hit testing share the same responsive geometry.
export function getSkillBarLayout(width: number, height: number, hasCompanion = true) {
  const count = hasCompanion ? 4 : 3;
  const gap = width < 480 ? 6 : 12;
  const slotW = Math.min(108, (width - 20 - gap * (count - 1)) / count);
  const slotH = 36;
  const startX = (width - count * slotW - (count - 1) * gap) / 2;
  return { slotW, slotH, gap, startX, y: height - 52, count };
}
