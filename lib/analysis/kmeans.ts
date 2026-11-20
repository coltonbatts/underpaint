import type { KeyColor, OKLab } from "@/lib/types";
import { oklabToHex } from "@/lib/color/conversions";
import { oklabToValue } from "@/lib/color/valueScale";

/**
 * Small deterministic PRNG (Mulberry32) so k-means++ D² sampling is 100% reproducible.
 */
function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic seeded k-means++ (D²-weighted sampling) in OKLab space to extract
 * the image's key palette colors without letting 1-pixel outliers hijack seeds.
 */
export function extractKeyColors(
  okL: Float32Array,
  okA: Float32Array,
  okB: Float32Array,
  k = 12,
  maxIterations = 16
): KeyColor[] {
  const n = okL.length;
  if (n === 0 || k <= 0) return [];

  // Deterministic stride sample (~12k pixels) for fast clustering
  const targetSamples = 12000;
  const step = Math.max(1, Math.floor(n / targetSamples));
  const sampleCount = Math.ceil(n / step);
  const actualK = Math.min(k, sampleCount);

  const sL = new Float32Array(sampleCount);
  const sA = new Float32Array(sampleCount);
  const sB = new Float32Array(sampleCount);
  let meanL = 0;
  let meanA = 0;
  let meanB = 0;
  for (let s = 0, idx = 0; idx < n && s < sampleCount; s++, idx += step) {
    const l = okL[idx] ?? 0;
    const a = okA[idx] ?? 0;
    const b = okB[idx] ?? 0;
    sL[s] = l;
    sA[s] = a;
    sB[s] = b;
    meanL += l;
    meanA += a;
    meanB += b;
  }
  meanL /= sampleCount;
  meanA /= sampleCount;
  meanB /= sampleCount;

  // Seeded k-means++ initialization:
  // Centroid 0 = sample closest to the image mean (guaranteed major body color, never a speck).
  const cL = new Float32Array(actualK);
  const cA = new Float32Array(actualK);
  const cB = new Float32Array(actualK);

  let firstIdx = 0;
  let firstBestDist = Infinity;
  for (let s = 0; s < sampleCount; s++) {
    const dL = (sL[s] ?? 0) - meanL;
    const dA = (sA[s] ?? 0) - meanA;
    const dB = (sB[s] ?? 0) - meanB;
    const d2 = dL * dL + dA * dA + dB * dB;
    if (d2 < firstBestDist) {
      firstBestDist = d2;
      firstIdx = s;
    }
  }

  cL[0] = sL[firstIdx] ?? 0.5;
  cA[0] = sA[firstIdx] ?? 0;
  cB[0] = sB[firstIdx] ?? 0;

  const minDistSq = new Float32Array(sampleCount);
  minDistSq.fill(Infinity);
  const rng = createSeededRng(0x5eed1234 ^ sampleCount);

  for (let c = 1; c < actualK; c++) {
    const prevL = cL[c - 1] ?? 0;
    const prevA = cA[c - 1] ?? 0;
    const prevB = cB[c - 1] ?? 0;

    let totalWeight = 0;
    for (let s = 0; s < sampleCount; s++) {
      const dL = (sL[s] ?? 0) - prevL;
      const dA = (sA[s] ?? 0) - prevA;
      const dB = (sB[s] ?? 0) - prevB;
      const d2 = dL * dL + dA * dA + dB * dB;
      if (d2 < (minDistSq[s] ?? Infinity)) {
        minDistSq[s] = d2;
      }
      totalWeight += minDistSq[s] ?? 0;
    }

    let chosenIdx = c % sampleCount;
    if (totalWeight > 1e-12) {
      let threshold = rng() * totalWeight;
      for (let s = 0; s < sampleCount; s++) {
        threshold -= minDistSq[s] ?? 0;
        if (threshold <= 0) {
          chosenIdx = s;
          break;
        }
      }
    }

    cL[c] = sL[chosenIdx] ?? 0.5;
    cA[c] = sA[chosenIdx] ?? 0;
    cB[c] = sB[chosenIdx] ?? 0;
  }

  const assignments = new Int32Array(sampleCount);
  const sumL = new Float64Array(actualK);
  const sumA = new Float64Array(actualK);
  const sumB = new Float64Array(actualK);
  const counts = new Int32Array(actualK);

  for (let iter = 0; iter < maxIterations; iter++) {
    sumL.fill(0);
    sumA.fill(0);
    sumB.fill(0);
    counts.fill(0);

    let changed = 0;
    for (let s = 0; s < sampleCount; s++) {
      const l = sL[s] ?? 0;
      const a = sA[s] ?? 0;
      const b = sB[s] ?? 0;

      let bestC = 0;
      let bestD = Infinity;
      for (let c = 0; c < actualK; c++) {
        const dL = l - (cL[c] ?? 0);
        const dA = a - (cA[c] ?? 0);
        const dB = b - (cB[c] ?? 0);
        const d2 = dL * dL + dA * dA + dB * dB;
        if (d2 < bestD) {
          bestD = d2;
          bestC = c;
        }
      }

      if (assignments[s] !== bestC) {
        assignments[s] = bestC;
        changed++;
      }
      sumL[bestC] = (sumL[bestC] ?? 0) + l;
      sumA[bestC] = (sumA[bestC] ?? 0) + a;
      sumB[bestC] = (sumB[bestC] ?? 0) + b;
      counts[bestC] = (counts[bestC] ?? 0) + 1;
    }

    for (let c = 0; c < actualK; c++) {
      const cnt = counts[c] ?? 0;
      if (cnt > 0) {
        cL[c] = (sumL[c] ?? 0) / cnt;
        cA[c] = (sumA[c] ?? 0) / cnt;
        cB[c] = (sumB[c] ?? 0) / cnt;
      }
    }

    if (changed < sampleCount * 0.002) break;
  }

  const results: KeyColor[] = [];
  for (let c = 0; c < actualK; c++) {
    const cnt = counts[c] ?? 0;
    if (cnt === 0) continue;
    const oklab: OKLab = {
      L: cL[c] ?? 0,
      a: cA[c] ?? 0,
      b: cB[c] ?? 0,
    };
    const coverage = (cnt / sampleCount) * 100;
    const value = oklabToValue(oklab);

    let firstStageId = "develop-forms";
    if (coverage >= 8 || (value <= 3.5 && coverage >= 3)) {
      firstStageId = "color-block-in";
    } else if (coverage < 4 && (value >= 8.2 || value <= 1.2)) {
      firstStageId = "accents-highlights";
    }

    results.push({
      oklab,
      hex: oklabToHex(oklab),
      value,
      coverage,
      firstStageId,
    });
  }

  results.sort((a, b) => b.coverage - a.coverage);
  return results;
}
