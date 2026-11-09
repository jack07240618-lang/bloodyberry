/** Static, stone-worn cult paint. Rasterized once on room entry, never animated. */
export function createFloorSigil(variant: number, seed: number, biome: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 440;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(220, 220);
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  type Point = [number, number];
  const tau = Math.PI * 2;
  const pigment = ['#985b50', '#9b9690', '#969675', '#b27c59', '#a68b99'][biome % 5];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // A loaded brush leaves uneven pigment, a dark edge and parallel dry bristles.
  const brush = (points: Point[], width = 4) => {
    const worn = points.map(([x, y]) => [x + (random() - 0.5) * 1.6, y + (random() - 0.5) * 1.6] as Point);
    for (let pass = 0; pass < 5; pass++) {
      ctx.strokeStyle = pass === 0 ? '#301e21' : pigment;
      ctx.globalAlpha = pass === 0 ? 0.65 : 0.19 + random() * 0.15;
      ctx.lineWidth = pass === 0 ? width + 1.8 : width * (0.45 + random() * 0.5);
      const offset = (random() - 0.5) * width * 0.6;
      ctx.beginPath();
      worn.forEach(([x, y], i) => {
        if (i === 0 || (pass > 1 && random() < 0.045)) ctx.moveTo(x + offset, y);
        else ctx.lineTo(x + offset, y);
      });
      ctx.stroke();
    }
  };
  const arc = (x: number, y: number, radius: number, start: number, end: number, width = 4) => {
    const count = Math.ceil(Math.abs(end - start) * radius / 3);
    const points: Point[] = [];
    for (let i = 0; i <= count; i++) {
      const angle = start + (end - start) * i / count;
      const r = radius + Math.sin(angle * 7 + seed) * 0.7 + Math.sin(angle * 13) * 0.4;
      points.push([x + Math.cos(angle) * r, y + Math.sin(angle) * r]);
    }
    brush(points, width);
  };
  const curve = (a: Point, b: Point, c: Point, d: Point, width = 4) => {
    const points: Point[] = [];
    for (let i = 0; i <= 45; i++) {
      const t = i / 45, u = 1 - t;
      points.push([u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0],
        u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1]]);
    }
    brush(points, width);
  };

  // Slightly misregistered brush laps, rather than immaculate concentric geometry.
  arc(0, 0, 170, -1.6, 4.58, 6);
  arc(2, -1, 155, -0.3, 5.87, 2.8);
  for (let i = 0; i < 19; i++) {
    const angle = i * tau / 19 + 0.07;
    ctx.save();
    ctx.rotate(angle);
    // Unequal hooked liturgical marks along the circular border.
    const h = 7 + random() * 7;
    brush([[160, -4], [177, -2], [183, -h]], 2.8);
    if (i % 3 !== 0) brush([[173, -2], [178, 5], [184, 7]], 2.2);
    ctx.restore();
  }

  if (variant === 0) {
    // Thorn reliquary: a long-jawed skull in a circular bramble wreath.
    arc(0, 0, 129, 0.12, tau - 0.16, 5);
    for (let i = 0; i < 13; i++) {
      ctx.save(); ctx.rotate(i * tau / 13);
      curve([119, -23], [147, -12], [107, 12], [133, 29], 3.5);
      brush([[128, -6], [146, -19], [135, 1]], 3);
      ctx.restore();
    }
    curve([-49, 17], [-91, -83], [80, -99], [52, 14], 6);
    brush([[-49, 17], [-33, 28], [-28, 62], [-13, 73], [20, 70], [32, 30], [52, 14]], 5);
    curve([-41, -12], [-33, -26], [-14, -23], [-12, -3], 5);
    curve([12, -3], [17, -28], [37, -26], [42, -14], 5);
    brush([[-39, -10], [-28, 4], [-12, -3]], 6);
    brush([[12, -3], [29, 3], [42, -14]], 6);
    brush([[-7, 23], [0, 9], [8, 24]], 4);
    for (let i = 0; i < 5; i++) brush([[-20 + i * 10, 40], [-17 + i * 9, 60]], 3);
    curve([-37, -52], [-74, -56], [-78, -90], [-65, -105], 5);
    curve([37, -52], [74, -56], [78, -90], [65, -105], 5);
  } else if (variant === 1) {
    // Vigil of the blind moon: an organic eye, crescent and hanging votive marks.
    arc(-8, -9, 119, 0.56, 5.72, 6);
    curve([93, -73], [-25, -118], [-81, 63], [91, 68], 5);
    curve([-85, 0], [-28, -56], [27, -57], [87, 0], 5);
    curve([-85, 0], [-21, 50], [33, 53], [87, 0], 5);
    arc(0, -2, 28, 0, tau, 4);
    curve([0, -25], [-13, -3], [-10, 11], [0, 24], 7);
    curve([0, -25], [10, -4], [12, 12], [0, 24], 4);
    for (let i = -2; i <= 2; i++) {
      const x = i * 23;
      brush([[x, 36 - Math.abs(i) * 4], [x + 2, 77 - Math.abs(i) * 8]], 3);
      arc(x + 2, 83 - Math.abs(i) * 8, 4, 0, tau, 2.5);
      brush([[x, -39 + Math.abs(i) * 7], [x * 1.15, -63 + Math.abs(i) * 4]], 3);
    }
  } else {
    // Sepulchral rose: pointed cathedral tracery and a twisting central bloom.
    for (let i = 0; i < 7; i++) {
      ctx.save(); ctx.rotate(i * tau / 7);
      curve([0, -137], [-56, -97], [-49, -58], [0, -34], 4.5);
      curve([0, -34], [45, -55], [51, -103], [0, -137], 4.5);
      curve([0, -119], [-19, -93], [-17, -75], [0, -61], 2.5);
      brush([[-8, -143], [0, -153], [8, -143]], 3);
      ctx.restore();
    }
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.rotate(i * tau / 5);
      curve([-7, -5], [-56, -42], [31, -69], [33, -13], 5);
      ctx.restore();
    }
    arc(0, 0, 12, -0.5, 4.7, 4);
  }

  // Spattered pigment and short dragged drips remain fixed with the painted motif.
  ctx.fillStyle = pigment;
  for (let i = 0; i < 115; i++) {
    const angle = random() * tau;
    const radius = 146 + random() * 53;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    ctx.globalAlpha = 0.16 + random() * 0.35;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.4 + random() * 2, 0.5 + random() * 1.3, angle, 0, tau);
    ctx.fill();
    if (i % 17 === 0) brush([[x, y], [x + 2, y + 5 + random() * 7]], 2);
  }

  // Remove pigment to expose stone pores, scuffs and the existing tile mortar.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 3600; i++) {
    ctx.globalAlpha = 0.12 + random() * 0.5;
    ctx.fillRect(random() * 410 - 205, random() * 410 - 205, 0.5 + random() * 2.2, 0.5 + random());
  }
  ctx.globalAlpha = 0.4;
  for (let tile = -192; tile <= 192; tile += 64) {
    ctx.fillRect(tile - 0.5, -210, 2, 420);
    ctx.fillRect(-210, tile - 0.5, 420, 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}
