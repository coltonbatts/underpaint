/**
 * Computes smoothed Sobel edge magnitude + 4-direction non-maximum suppression (thinning).
 * Returns normalized edge strength in [0, 1] for Stage 2 drawing & saliency.
 */
export function computeEdgeMap(
  lightness: Float32Array,
  width: number,
  height: number
): Float32Array {
  const n = width * height;
  const smoothed = new Float32Array(n);

  // 3x3 Gaussian blur [1 2 1; 2 4 2; 1 2 1] / 16 to suppress fine sensor/AI noise
  for (let y = 1; y < height - 1; y++) {
    const r0 = (y - 1) * width;
    const r1 = y * width;
    const r2 = (y + 1) * width;
    for (let x = 1; x < width - 1; x++) {
      smoothed[r1 + x] =
        ((lightness[r0 + x - 1] ?? 0) +
          2 * (lightness[r0 + x] ?? 0) +
          (lightness[r0 + x + 1] ?? 0) +
          2 * (lightness[r1 + x - 1] ?? 0) +
          4 * (lightness[r1 + x] ?? 0) +
          2 * (lightness[r1 + x + 1] ?? 0) +
          (lightness[r2 + x - 1] ?? 0) +
          2 * (lightness[r2 + x] ?? 0) +
          (lightness[r2 + x + 1] ?? 0)) /
        16;
    }
  }

  const mag = new Float32Array(n);
  const angleBin = new Uint8Array(n); // 0: 0deg, 1: 45deg, 2: 90deg, 3: 135deg
  let maxMag = 1e-6;

  for (let y = 1; y < height - 1; y++) {
    const r0 = (y - 1) * width;
    const r1 = y * width;
    const r2 = (y + 1) * width;
    for (let x = 1; x < width - 1; x++) {
      const tl = smoothed[r0 + x - 1] ?? 0;
      const tc = smoothed[r0 + x] ?? 0;
      const tr = smoothed[r0 + x + 1] ?? 0;
      const ml = smoothed[r1 + x - 1] ?? 0;
      const mr = smoothed[r1 + x + 1] ?? 0;
      const bl = smoothed[r2 + x - 1] ?? 0;
      const bc = smoothed[r2 + x] ?? 0;
      const br = smoothed[r2 + x + 1] ?? 0;

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const m = Math.hypot(gx, gy);

      const idx = r1 + x;
      mag[idx] = m;
      if (m > maxMag) maxMag = m;

      // Quantize gradient direction into 4 bins
      let deg = (Math.atan2(gy, gx) * 180) / Math.PI;
      if (deg < 0) deg += 180;
      if (deg < 22.5 || deg >= 157.5) angleBin[idx] = 0;
      else if (deg < 67.5) angleBin[idx] = 1;
      else if (deg < 112.5) angleBin[idx] = 2;
      else angleBin[idx] = 3;
    }
  }

  // Non-maximum suppression for cleaner pencil/brush-like contours
  const thinned = new Float32Array(n);
  const invMax = 1 / maxMag;

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const m = mag[idx] ?? 0;
      if (m === 0) continue;

      let n1 = 0;
      let n2 = 0;
      const bin = angleBin[idx] ?? 0;
      if (bin === 0) {
        n1 = mag[idx - 1] ?? 0;
        n2 = mag[idx + 1] ?? 0;
      } else if (bin === 1) {
        n1 = mag[idx - width + 1] ?? 0;
        n2 = mag[idx + width - 1] ?? 0;
      } else if (bin === 2) {
        n1 = mag[idx - width] ?? 0;
        n2 = mag[idx + width] ?? 0;
      } else {
        n1 = mag[idx - width - 1] ?? 0;
        n2 = mag[idx + width + 1] ?? 0;
      }

      if (m >= n1 && m >= n2) {
        // Gentle power curve so medium contours remain visible
        thinned[idx] = Math.pow(m * invMax, 0.75);
      }
    }
  }

  return thinned;
}
