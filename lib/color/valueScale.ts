import type { OKLab, RGB } from "@/lib/types";
import { clamp, oklabToLab, srgbToLab } from "./conversions";

export type ValueStepCount = 3 | 5 | 9;

// Precomputed sRGB byte (0..255) -> linear float (0..1) LUT for fast per-pixel value math
const SRGB_TO_LINEAR_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR_LUT[i] =
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

/**
 * Maps CIELAB L* (0..100) to the painter's 0..10 value scale (0 = black, 10 = white).
 */
export function labLToValue(labL: number): number {
  return clamp(labL / 10, 0, 10);
}

/**
 * Fast CIELAB L* -> 0..10 value lookup from 8-bit sRGB bytes (0..255).
 * Matches `srgbToValue({ r: r/255, g: g/255, b: b/255 })` without object allocations.
 */
export function rgbBytesToValue(rByte: number, gByte: number, bByte: number): number {
  const r = SRGB_TO_LINEAR_LUT[rByte & 255] ?? 0;
  const g = SRGB_TO_LINEAR_LUT[gByte & 255] ?? 0;
  const b = SRGB_TO_LINEAR_LUT[bByte & 255] ?? 0;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const fy = Y > LAB_EPSILON ? Math.cbrt(Y) : (LAB_KAPPA * Y + 16) / 116;
  return clamp((116 * fy - 16) / 10, 0, 10);
}

/**
 * Converts 8-bit sRGB bytes to an 8-bit perceptual neutral gray byte whose
 * CIELAB L* matches the source color (linear-light Rec.709 Y -> sRGB).
 */
export function rgbBytesToPerceptualGrayByte(
  rByte: number,
  gByte: number,
  bByte: number
): number {
  const r = SRGB_TO_LINEAR_LUT[rByte & 255] ?? 0;
  const g = SRGB_TO_LINEAR_LUT[gByte & 255] ?? 0;
  const b = SRGB_TO_LINEAR_LUT[bByte & 255] ?? 0;
  const Y = clamp(0.2126729 * r + 0.7151522 * g + 0.072175 * b, 0, 1);
  const srgb = Y <= 0.0031308 ? 12.92 * Y : 1.055 * Math.pow(Y, 1 / 2.4) - 0.055;
  return Math.round(clamp(srgb, 0, 1) * 255);
}

/**
 * Maps sRGB (0..1) to the 0..10 value scale using CIELAB L*.
 */
export function srgbToValue(rgb: RGB): number {
  return labLToValue(srgbToLab(rgb).L);
}

/**
 * Maps OKLab to the 0..10 value scale using CIELAB L*.
 */
export function oklabToValue(ok: OKLab): number {
  return labLToValue(oklabToLab(ok).L);
}

/**
 * Quantizes a 0..10 value into an integer bucket index 0..(steps - 1).
 * 3-step: dark (0), mid (1), light (2)
 * 5-step: 0..4
 * 9-step: Munsell-style 0..8 (displayed as 1..9)
 */
export function quantizeValue(value0to10: number, steps: ValueStepCount): number {
  const norm = clamp(value0to10 / 10, 0, 1);
  const idx = Math.floor(norm * steps);
  return idx >= steps ? steps - 1 : idx;
}

/**
 * Converts a quantized bucket index 0..(steps - 1) to an sRGB grayscale byte (0..255)
 * for crisp value-map visualization.
 */
export function valueBucketToGrayByte(
  bucket: number,
  steps: ValueStepCount
): number {
  if (steps <= 1) return 128;
  // Slightly compressed endpoints for 3-value notan so darks & lights read cleanly on dark UI
  if (steps === 3) {
    const table = [24, 126, 232];
    return table[clamp(bucket, 0, 2)] ?? 126;
  }
  const t = clamp(bucket, 0, steps - 1) / (steps - 1);
  return Math.round(14 + t * 232);
}

/**
 * Returns a painter-friendly label for a 0..10 value.
 */
export function describeValue(value0to10: number): string {
  if (value0to10 < 1.5) return "Deep Dark";
  if (value0to10 < 3.0) return "Dark";
  if (value0to10 < 4.5) return "Mid-Dark";
  if (value0to10 < 6.0) return "Midtone";
  if (value0to10 < 7.5) return "Mid-Light";
  if (value0to10 < 9.0) return "Light";
  return "Highlight";
}
