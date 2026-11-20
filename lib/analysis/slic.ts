import type { OKLab, SegmentLevel } from "@/lib/types";

/**
 * Absorbs tiny disconnected superpixel islands (< minComponentSize) into their
 * most-frequent 4-connected neighbor so flat regions and gamut masks stay clean
 * without inflating the total superpixel count.
 */
export function enforceSlicConnectivity(
  labels: Int32Array,
  width: number,
  height: number,
  numLabels: number,
  minComponentSize: number
): void {
  const n = width * height;
  if (n === 0 || numLabels <= 1 || minComponentSize <= 1) return;

  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  const neighborHits = new Int32Array(numLabels);
  const touchedNeighbors = new Int32Array(numLabels);

  for (let start = 0; start < n; start++) {
    if (visited[start] === 1) continue;

    const origLabel = labels[start] ?? 0;
    visited[start] = 1;
    queue[0] = start;
    let head = 0;
    let tail = 1;
    let touchedCount = 0;

    while (head < tail) {
      const idx = queue[head++]!;
      const x = idx % width;
      const y = (idx - x) / width;

      // Check 4-connected neighbors
      const checkNeighbor = (nIdx: number) => {
        const nLabel = labels[nIdx] ?? 0;
        if (nLabel === origLabel) {
          if (visited[nIdx] === 0) {
            visited[nIdx] = 1;
            queue[tail++] = nIdx;
          }
        } else if (nLabel >= 0 && nLabel < numLabels) {
          if (neighborHits[nLabel] === 0) {
            touchedNeighbors[touchedCount++] = nLabel;
          }
          neighborHits[nLabel] = (neighborHits[nLabel] ?? 0) + 1;
        }
      };

      if (x > 0) checkNeighbor(idx - 1);
      if (x + 1 < width) checkNeighbor(idx + 1);
      if (y > 0) checkNeighbor(idx - width);
      if (y + 1 < height) checkNeighbor(idx + width);
    }

    if (tail < minComponentSize && touchedCount > 0) {
      let bestNeighbor = touchedNeighbors[0]!;
      let bestHits = neighborHits[bestNeighbor] ?? 0;
      for (let t = 1; t < touchedCount; t++) {
        const cand = touchedNeighbors[t]!;
        const hits = neighborHits[cand] ?? 0;
        if (hits > bestHits) {
          bestHits = hits;
          bestNeighbor = cand;
        }
      }
      for (let i = 0; i < tail; i++) {
        labels[queue[i]!] = bestNeighbor;
      }
    }

    // Reset only the neighbor counters touched by this component
    for (let t = 0; t < touchedCount; t++) {
      neighborHits[touchedNeighbors[t]!] = 0;
    }
  }
}

/**
 * Fast SLIC superpixel segmentation in OKLab space.
 * Runs on an internal downsampled grid (~360px long edge) for speed (<100ms),
 * enforces connected components to remove tiny specks, then maps labels back
 * to workingRes and computes exact mean OKLab colors.
 */
export function computeSlicLevel(
  okL: Float32Array,
  okA: Float32Array,
  okB: Float32Array,
  width: number,
  height: number,
  targetSegments: number,
  levelIndex: number,
  compactness = 0.14,
  iterations = 6
): SegmentLevel {
  const maxSlicEdge = 360;
  const scale = Math.min(1, maxSlicEdge / Math.max(width, height));
  const sw = Math.max(16, Math.round(width * scale));
  const sh = Math.max(16, Math.round(height * scale));
  const sn = sw * sh;

  // Downsample OKLab onto SLIC grid
  const sL = new Float32Array(sn);
  const sA = new Float32Array(sn);
  const sB = new Float32Array(sn);

  for (let y = 0; y < sh; y++) {
    const srcY = Math.min(height - 1, Math.floor((y * height) / sh));
    const srcRow = srcY * width;
    const dstRow = y * sw;
    for (let x = 0; x < sw; x++) {
      const srcX = Math.min(width - 1, Math.floor((x * width) / sw));
      const srcIdx = srcRow + srcX;
      const dstIdx = dstRow + x;
      sL[dstIdx] = okL[srcIdx] ?? 0;
      sA[dstIdx] = okA[srcIdx] ?? 0;
      sB[dstIdx] = okB[srcIdx] ?? 0;
    }
  }

  const S = Math.max(4, Math.round(Math.sqrt(sn / Math.max(4, targetSegments))));
  const halfS = Math.floor(S / 2);

  // Initialize cluster centers on regular grid
  const centersL: number[] = [];
  const centersA: number[] = [];
  const centersB: number[] = [];
  const centersX: number[] = [];
  const centersY: number[] = [];

  for (let y = halfS; y < sh; y += S) {
    for (let x = halfS; x < sw; x += S) {
      const idx = y * sw + x;
      centersL.push(sL[idx] ?? 0);
      centersA.push(sA[idx] ?? 0);
      centersB.push(sB[idx] ?? 0);
      centersX.push(x);
      centersY.push(y);
    }
  }

  const k = centersL.length;
  const sLabels = new Int32Array(sn);
  const dists = new Float32Array(sn);
  const invS2 = (compactness * compactness) / (S * S);

  const accL = new Float64Array(k);
  const accA = new Float64Array(k);
  const accB = new Float64Array(k);
  const accX = new Float64Array(k);
  const accY = new Float64Array(k);
  const accN = new Int32Array(k);

  for (let iter = 0; iter < iterations; iter++) {
    dists.fill(Infinity);

    for (let c = 0; c < k; c++) {
      const cx = Math.round(centersX[c] ?? 0);
      const cy = Math.round(centersY[c] ?? 0);
      const cl = centersL[c] ?? 0;
      const ca = centersA[c] ?? 0;
      const cb = centersB[c] ?? 0;

      const x0 = Math.max(0, cx - S);
      const x1 = Math.min(sw - 1, cx + S);
      const y0 = Math.max(0, cy - S);
      const y1 = Math.min(sh - 1, cy + S);

      for (let y = y0; y <= y1; y++) {
        const dy = y - cy;
        const dy2 = dy * dy;
        const row = y * sw;
        for (let x = x0; x <= x1; x++) {
          const idx = row + x;
          const dL = (sL[idx] ?? 0) - cl;
          const dA = (sA[idx] ?? 0) - ca;
          const dB = (sB[idx] ?? 0) - cb;
          const dx = x - cx;
          const dColor = dL * dL + dA * dA + dB * dB;
          const dSpace = (dx * dx + dy2) * invS2;
          const d = dColor + dSpace;
          if (d < (dists[idx] ?? Infinity)) {
            dists[idx] = d;
            sLabels[idx] = c;
          }
        }
      }
    }

    // Recompute centers
    accL.fill(0);
    accA.fill(0);
    accB.fill(0);
    accX.fill(0);
    accY.fill(0);
    accN.fill(0);

    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let x = 0; x < sw; x++) {
        const idx = row + x;
        const c = sLabels[idx] ?? 0;
        accL[c] = (accL[c] ?? 0) + (sL[idx] ?? 0);
        accA[c] = (accA[c] ?? 0) + (sA[idx] ?? 0);
        accB[c] = (accB[c] ?? 0) + (sB[idx] ?? 0);
        accX[c] = (accX[c] ?? 0) + x;
        accY[c] = (accY[c] ?? 0) + y;
        accN[c] = (accN[c] ?? 0) + 1;
      }
    }

    for (let c = 0; c < k; c++) {
      const cnt = accN[c] ?? 0;
      if (cnt > 0) {
        centersL[c] = (accL[c] ?? 0) / cnt;
        centersA[c] = (accA[c] ?? 0) / cnt;
        centersB[c] = (accB[c] ?? 0) / cnt;
        centersX[c] = (accX[c] ?? 0) / cnt;
        centersY[c] = (accY[c] ?? 0) / cnt;
      }
    }
  }

  // Enforce spatial connectivity on the SLIC grid so small disconnected specks are absorbed
  const minComponentSize = Math.max(4, Math.floor(S * S * 0.2));
  enforceSlicConnectivity(sLabels, sw, sh, k, minComponentSize);

  // Upsample labels to full working resolution and accumulate exact mean colors
  const fullN = width * height;
  const labels = new Int32Array(fullN);
  const fullSumL = new Float64Array(k);
  const fullSumA = new Float64Array(k);
  const fullSumB = new Float64Array(k);
  const fullCnt = new Int32Array(k);

  for (let y = 0; y < height; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / height));
    const sRow = sy * sw;
    const dRow = y * width;
    for (let x = 0; x < width; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / width));
      const c = sLabels[sRow + sx] ?? 0;
      const idx = dRow + x;
      labels[idx] = c;
      fullSumL[c] = (fullSumL[c] ?? 0) + (okL[idx] ?? 0);
      fullSumA[c] = (fullSumA[c] ?? 0) + (okA[idx] ?? 0);
      fullSumB[c] = (fullSumB[c] ?? 0) + (okB[idx] ?? 0);
      fullCnt[c] = (fullCnt[c] ?? 0) + 1;
    }
  }

  const meanColors: OKLab[] = new Array<OKLab>(k);
  for (let c = 0; c < k; c++) {
    const cnt = fullCnt[c] ?? 0;
    meanColors[c] =
      cnt > 0
        ? {
            L: (fullSumL[c] ?? 0) / cnt,
            a: (fullSumA[c] ?? 0) / cnt,
            b: (fullSumB[c] ?? 0) / cnt,
          }
        : { L: 0.5, a: 0, b: 0 };
  }

  return {
    level: levelIndex,
    labels,
    meanColors,
  };
}
