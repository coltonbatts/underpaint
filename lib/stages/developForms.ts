import { oklabToSrgb } from "@/lib/color/conversions";
import type { StageRenderer } from "./types";
import { clampByte } from "./helpers";

/**
 * Stage 5: Develop Forms (55-75%)
 * Finer SLIC segmentation (~150) blended toward the source image, then run through
 * the anisotropic Kuwahara shader (radius shrinks 6.2 -> 4.0 across t) to turn forms,
 * half-tones, and temperature shifts with painterly brushwork.
 */
export const renderDevelopForms: StageRenderer = async (ctx, _params, t) => {
  const { w, h } = ctx.analysis.workingRes;
  const fine = ctx.analysis.segments[1] ?? ctx.analysis.segments[0];
  if (!fine) {
    return createImageBitmap(ctx.sourceBitmap);
  }

  const palette = ctx.achievableColors?.fine ?? fine.meanColors;
  const rgbTable = palette.map((ok) => {
    const rgb = oklabToSrgb(ok);
    return { r: rgb.r * 255, g: rgb.g * 255, b: rgb.b * 255 };
  });

  const srcData = ctx.sourceImageData.data;
  const img = new ImageData(w, h);
  const out = img.data;
  const labels = fine.labels;
  const n = w * h;

  // Interpolate from fine segment masses (t=0) toward richer form modeling (t=1)
  const sourceWeight = 0.2 + 0.55 * t;
  const segWeight = 1 - sourceWeight;

  for (let i = 0; i < n; i++) {
    const c = rgbTable[labels[i] ?? 0];
    const off = i * 4;
    if (c) {
      out[off] = clampByte(c.r * segWeight + (srcData[off] ?? 0) * sourceWeight);
      out[off + 1] = clampByte(
        c.g * segWeight + (srcData[off + 1] ?? 0) * sourceWeight
      );
      out[off + 2] = clampByte(
        c.b * segWeight + (srcData[off + 2] ?? 0) * sourceWeight
      );
      out[off + 3] = 255;
    } else {
      out[off] = srcData[off] ?? 0;
      out[off + 1] = srcData[off + 1] ?? 0;
      out[off + 2] = srcData[off + 2] ?? 0;
      out[off + 3] = 255;
    }
  }

  if (ctx.gl) {
    const rawBmp = await createImageBitmap(img);
    try {
      const radius = 6.2 - 2.2 * t; // 6.2 -> 4.0
      const focal = ctx.analysis.focalPoint ?? { x: 0.5, y: 0.46 };
      // Keep brushwork crisper near the focal point and gently softer toward the periphery
      return await ctx.gl.renderRefinementPipeline(
        rawBmp,
        w,
        h,
        focal,
        radius,
        2.6,
        0.72
      );
    } finally {
      rawBmp.close();
    }
  }

  return createImageBitmap(img);
};
