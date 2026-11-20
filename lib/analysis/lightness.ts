import { quantizeValue } from "@/lib/color/valueScale";

// Precomputed sRGB byte (0..255) -> linear float (0..1) LUT for fast per-pixel conversion
const SRGB_TO_LINEAR_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR_LUT[i] =
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

export type PixelColorBuffers = {
  okL: Float32Array;
  okA: Float32Array;
  okB: Float32Array;
  valueContinuous: Uint8Array;
  valueMap3: Uint8Array;
  valueMap5: Uint8Array;
  valueMap9: Uint8Array;
};

/**
 * Single-pass extraction of OKLab (L, a, b) and CIELAB L*-based continuous & 3/5/9 value maps
 * from RGBA pixel bytes.
 */
export function extractLightnessAndValueMaps(
  rgba: Uint8ClampedArray,
  pixelCount: number
): PixelColorBuffers {
  const okL = new Float32Array(pixelCount);
  const okA = new Float32Array(pixelCount);
  const okB = new Float32Array(pixelCount);
  const valueContinuous = new Uint8Array(pixelCount);
  const valueMap3 = new Uint8Array(pixelCount);
  const valueMap5 = new Uint8Array(pixelCount);
  const valueMap9 = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    const r = SRGB_TO_LINEAR_LUT[rgba[off] ?? 0] ?? 0;
    const g = SRGB_TO_LINEAR_LUT[rgba[off + 1] ?? 0] ?? 0;
    const b = SRGB_TO_LINEAR_LUT[rgba[off + 2] ?? 0] ?? 0;

    // OKLab from linear sRGB
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const l_ = Math.cbrt(l > 0 ? l : 0);
    const m_ = Math.cbrt(m > 0 ? m : 0);
    const s_ = Math.cbrt(s > 0 ? s : 0);

    okL[i] = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
    okA[i] = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
    okB[i] = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

    // Exact CIELAB L* from XYZ Y (D65 Yn = 1.0) -> 0..10 value scale
    const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    const fy = Y > LAB_EPSILON ? Math.cbrt(Y) : (LAB_KAPPA * Y + 16) / 116;
    const labL = 116 * fy - 16;
    const val = labL / 10;

    valueContinuous[i] = Math.min(255, Math.max(0, Math.round(labL * 2.55)));
    valueMap3[i] = quantizeValue(val, 3);
    valueMap5[i] = quantizeValue(val, 5);
    valueMap9[i] = quantizeValue(val, 9);
  }

  return { okL, okA, okB, valueContinuous, valueMap3, valueMap5, valueMap9 };
}
