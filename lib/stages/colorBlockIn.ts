import { oklabToSrgb } from "@/lib/color/conversions";
import type { StageRenderer } from "./types";
import { clampByte, fillTonedGroundBuffer, getGroundRgb } from "./helpers";

/**
 * Stage 4: Big Masses / Color Block-in (35-55%)
 * Coarse SLIC segments (~24) filled with each segment's mean (or achievable) color.
 * Real alla prima order across t (0 -> 1):
 * - Darks go in first, thin & semi-transparent (toned ground breathes through)
 * - Midtones follow with medium body
 * - Lights go in last, thicker & more opaque
 */
export const renderColorBlockIn: StageRenderer = async (ctx, _params, t) => {
  const { w, h } = ctx.analysis.workingRes;
  const img = new ImageData(w, h);
  const data = img.data;

  const ground = getGroundRgb(ctx.canvasSpec, ctx.analysis);
  fillTonedGroundBuffer(data, w, h, ground, 0.85);

  const coarse = ctx.analysis.segments[0];
  if (!coarse) {
    return createImageBitmap(img);
  }

  const palette = ctx.achievableColors?.coarse ?? coarse.meanColors;
  const rgbTable = palette.map((ok) => {
    const rgb = oklabToSrgb(ok);
    return {
      r: rgb.r * 255,
      g: rgb.g * 255,
      b: rgb.b * 255,
      L: ok.L,
    };
  });

  const labels = coarse.labels;
  const n = w * h;

  for (let i = 0; i < n; i++) {
    const segIdx = labels[i] ?? 0;
    const c = rgbTable[segIdx];
    if (!c) continue;

    // Order of application: darks (L≈0) start at t=0, midtones ~0.3, lights ~0.55
    const onset = Math.max(0, Math.min(0.6, c.L * 0.65));
    const localProgress = Math.max(0, Math.min(1, (t - onset) / 0.42));

    // Darks stay leaner/more transparent (~0.72 max opacity), lights lay thicker (~0.96)
    const maxOpacity = 0.72 + c.L * 0.25;
    const alpha = localProgress * maxOpacity;

    if (alpha > 0.005) {
      const off = i * 4;
      data[off] = clampByte((data[off] ?? 0) * (1 - alpha) + c.r * alpha);
      data[off + 1] = clampByte(
        (data[off + 1] ?? 0) * (1 - alpha) + c.g * alpha
      );
      data[off + 2] = clampByte(
        (data[off + 2] ?? 0) * (1 - alpha) + c.b * alpha
      );
    }
  }

  // Broad painterly Kuwahara pass turns raw superpixel boundaries into flat-brush masses
  if (ctx.gl) {
    const rawBmp = await createImageBitmap(img);
    try {
      return await ctx.gl.renderKuwahara(rawBmp, w, h, 5.0, 5.5, 0.65);
    } finally {
      rawBmp.close();
    }
  }

  return createImageBitmap(img);
};
