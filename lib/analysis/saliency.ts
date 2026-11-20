/**
 * Estimates a primary focal point (normalized 0..1) from local luminance contrast,
 * edge density, and a gentle compositional center-bias. User can override in UI.
 */
export function estimateFocalPoint(
  lightness: Float32Array,
  edges: Float32Array,
  width: number,
  height: number
): { x: number; y: number } {
  const grid = 24;
  const cellW = width / grid;
  const cellH = height / grid;

  let bestScore = -1;
  let bestX = 0.5;
  let bestY = 0.45;

  for (let gy = 0; gy < grid; gy++) {
    const y0 = Math.floor(gy * cellH);
    const y1 = Math.min(height, Math.floor((gy + 1) * cellH));
    for (let gx = 0; gx < grid; gx++) {
      const x0 = Math.floor(gx * cellW);
      const x1 = Math.min(width, Math.floor((gx + 1) * cellW));

      let sumL = 0;
      let sumL2 = 0;
      let sumEdge = 0;
      let count = 0;

      for (let y = y0; y < y1; y += 2) {
        const row = y * width;
        for (let x = x0; x < x1; x += 2) {
          const idx = row + x;
          const l = lightness[idx] ?? 0;
          sumL += l;
          sumL2 += l * l;
          sumEdge += edges[idx] ?? 0;
          count++;
        }
      }

      if (count === 0) continue;
      const meanL = sumL / count;
      const variance = Math.max(0, sumL2 / count - meanL * meanL);
      const contrast = Math.sqrt(variance);
      const edgeDensity = sumEdge / count;

      const nx = (gx + 0.5) / grid;
      const ny = (gy + 0.5) / grid;

      // Gentle center/rule-of-thirds prior so borders/vignettes don't steal focus
      const dx = nx - 0.5;
      const dy = ny - 0.46;
      const centerPrior = Math.exp(-(dx * dx + dy * dy) / 0.28);

      const score = (contrast * 1.6 + edgeDensity * 2.4) * (0.45 + 0.55 * centerPrior);
      if (score > bestScore) {
        bestScore = score;
        bestX = nx;
        bestY = ny;
      }
    }
  }

  return { x: bestX, y: bestY };
}
