import { hexToSrgb, oklabToSrgb } from "@/lib/color/conversions";
import type { CanvasSpec, ImageAnalysis, OKLab, RGB } from "@/lib/types";

export const GESSO_RGB: RGB = { r: 238 / 255, g: 233 / 255, b: 223 / 255 };

export function getGroundRgb(
  canvasSpec: CanvasSpec,
  analysis: ImageAnalysis
): RGB {
  const hex =
    canvasSpec.groundColor ?? analysis.suggestedGroundColor ?? "#9c7a5b";
  return hexToSrgb(hex);
}

/**
 * Fast deterministic linen tooth + subtle organic wash variation at pixel (x, y).
 * Returns value in roughly [-1, 1].
 */
export function linenTooth(x: number, y: number): number {
  const warp = Math.sin(x * 1.45);
  const weft = Math.sin(y * 1.45);
  const checker = ((x >> 1) + (y >> 1)) & 1;
  return checker === 0 ? warp * 0.6 + weft * 0.25 : weft * 0.6 + warp * 0.25;
}

/**
 * Broad rag-wipe / imprimatura wash unevenness in [0.88, 1.12].
 */
export function washVariation(nx: number, ny: number): number {
  const w1 = Math.sin(nx * 9.5 + ny * 3.2) * 0.045;
  const w2 = Math.cos(ny * 13.0 - nx * 4.7) * 0.035;
  const w3 = Math.sin((nx + ny) * 21.0) * 0.02;
  return 1 + w1 + w2 + w3;
}

export function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/**
 * Paints the imprimatura toned ground directly into an RGBA buffer.
 * Shared base for Stages 1, 2, 3, and 4 (where thin darks let the ground breathe).
 */
export function fillTonedGroundBuffer(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ground: RGB,
  washOpacity: number
): void {
  const gr = GESSO_RGB.r * 255;
  const gg = GESSO_RGB.g * 255;
  const gb = GESSO_RGB.b * 255;

  const tr = ground.r * 255;
  const tg = ground.g * 255;
  const tb = ground.b * 255;

  for (let y = 0; y < h; y++) {
    const ny = y / h;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const tooth = linenTooth(x, y) * 4.5;
      const wipe = washVariation(nx, ny);
      const alpha = Math.max(0, Math.min(1, washOpacity * wipe));

      const r = gr * (1 - alpha) + tr * alpha + tooth;
      const g = gg * (1 - alpha) + tg * alpha + tooth;
      const b = gb * (1 - alpha) + tb * alpha + tooth * 0.9;

      const off = (row + x) * 4;
      data[off] = clampByte(r);
      data[off + 1] = clampByte(g);
      data[off + 2] = clampByte(b);
      data[off + 3] = 255;
    }
  }
}

/**
 * Remaps the source ImageData toward the palette's achievable fine-segment colors
 * by applying each segment's (achievable - ideal) RGB shift. Preserves fine texture
 * and value modeling while constraining hues/saturation to what the tube palette can mix.
 */
export async function buildAchievableSourceBitmap(
  sourceImageData: ImageData,
  analysis: ImageAnalysis,
  achievableFine: OKLab[]
): Promise<ImageBitmap> {
  const fine = analysis.segments[1];
  const { w, h } = analysis.workingRes;
  if (!fine || achievableFine.length !== fine.meanColors.length) {
    return createImageBitmap(sourceImageData);
  }

  const dr = new Float32Array(fine.meanColors.length);
  const dg = new Float32Array(fine.meanColors.length);
  const db = new Float32Array(fine.meanColors.length);

  for (let i = 0; i < fine.meanColors.length; i++) {
    const ideal = oklabToSrgb(fine.meanColors[i]!);
    const ach = oklabToSrgb(achievableFine[i]!);
    dr[i] = (ach.r - ideal.r) * 255;
    dg[i] = (ach.g - ideal.g) * 255;
    db[i] = (ach.b - ideal.b) * 255;
  }

  const out = new ImageData(w, h);
  const dst = out.data;
  const src = sourceImageData.data;
  const labels = fine.labels;
  const n = w * h;

  for (let i = 0; i < n; i++) {
    const seg = labels[i] ?? 0;
    const off = i * 4;
    dst[off] = clampByte((src[off] ?? 0) + (dr[seg] ?? 0));
    dst[off + 1] = clampByte((src[off + 1] ?? 0) + (dg[seg] ?? 0));
    dst[off + 2] = clampByte((src[off + 2] ?? 0) + (db[seg] ?? 0));
    dst[off + 3] = 255;
  }

  return createImageBitmap(out);
}
