import { oklabToHex } from "@/lib/color/conversions";

/**
 * Auto-suggests an imprimatura (toned ground) color:
 * - Mid-value (~value 5–6, OKLab L ≈ 0.60)
 * - Warm earth default (Burnt Sienna / Raw Umber / Yellow Ochre family)
 * - Shifts slightly warmer for cool-dominant images (complementary glow under blues/greens)
 *   or more neutral raw umber for very warm images so highlights & warms still pop.
 */
export function suggestGroundColor(
  okA: Float32Array,
  okB: Float32Array
): string {
  const n = okA.length;
  if (n === 0) return "#9c7a5b";

  const step = Math.max(1, Math.floor(n / 8000));
  let sumA = 0;
  let sumB = 0;
  let count = 0;
  for (let i = 0; i < n; i += step) {
    sumA += okA[i] ?? 0;
    sumB += okB[i] ?? 0;
    count++;
  }

  const meanA = sumA / Math.max(1, count);
  const meanB = sumB / Math.max(1, count);

  // Warmth score: positive for warm (reds/yellows), negative for cool (blues/cyans)
  const warmth = meanA * 0.7 + meanB * 0.9;

  if (warmth < -0.015) {
    // Cool image -> warm Burnt Sienna / Terracotta imprimatura for complementary vibration
    return oklabToHex({ L: 0.58, a: 0.055, b: 0.068 });
  }
  if (warmth > 0.035) {
    // Very warm image -> cooler Neutral Raw Umber / Olive-Umber ground
    return oklabToHex({ L: 0.57, a: 0.008, b: 0.034 });
  }
  // Balanced image -> classic warm Raw Sienna / Yellow Ochre wash
  return oklabToHex({ L: 0.61, a: 0.028, b: 0.062 });
}
