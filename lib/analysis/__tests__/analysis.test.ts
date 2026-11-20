import { describe, expect, it } from "vitest";
import { extractKeyColors } from "../kmeans";
import { enforceSlicConnectivity } from "../slic";

describe("image analysis algorithms", () => {
  it("seeded k-means++ is deterministic and resists single-pixel noise outliers", () => {
    // Construct 4,000 pixels across 3 strong color masses + 3 isolated noise specks
    const n = 4000;
    const okL = new Float32Array(n);
    const okA = new Float32Array(n);
    const okB = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      if (i < 1600) {
        // Warm shadow
        okL[i] = 0.28;
        okA[i] = 0.04;
        okB[i] = 0.05;
      } else if (i < 3000) {
        // Muted sage midtone
        okL[i] = 0.58;
        okA[i] = -0.05;
        okB[i] = 0.06;
      } else {
        // Warm light
        okL[i] = 0.85;
        okA[i] = 0.02;
        okB[i] = 0.08;
      }
    }

    // Inject 3 extreme 1-pixel outlier specks
    okL[10] = 0.99;
    okA[10] = 0.35;
    okB[10] = -0.35;
    okL[500] = 0.01;
    okA[500] = -0.3;
    okB[500] = 0.3;
    okL[2000] = 0.5;
    okA[2000] = 0.4;
    okB[2000] = 0.4;

    const run1 = extractKeyColors(okL, okA, okB, 3);
    const run2 = extractKeyColors(okL, okA, okB, 3);

    expect(run1).toEqual(run2);
    expect(run1).toHaveLength(3);
    // All 3 clusters should represent the real color masses (>20% coverage each),
    // not 0.025% single-pixel outliers
    for (const kc of run1) {
      expect(kc.coverage).toBeGreaterThan(20);
    }
  });

  it("enforceSlicConnectivity absorbs tiny disconnected islands into surrounding neighbor", () => {
    // 10x10 grid: left half = label 0, right half = label 1,
    // plus a 2-pixel island of label 1 stranded inside label 0
    const w = 10;
    const h = 10;
    const labels = new Int32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        labels[y * w + x] = x < 5 ? 0 : 1;
      }
    }
    // Stranded 2-pixel island of label 1 inside region 0
    labels[2 * w + 1] = 1;
    labels[2 * w + 2] = 1;

    enforceSlicConnectivity(labels, w, h, 2, 6);

    // Island should be absorbed into surrounding label 0
    expect(labels[2 * w + 1]).toBe(0);
    expect(labels[2 * w + 2]).toBe(0);
    // Main right-half region (50 pixels >= 6) must remain intact
    expect(labels[5 * w + 8]).toBe(1);
  });
});
