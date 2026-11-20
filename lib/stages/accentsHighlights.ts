import type { StageRenderer } from "./types";
import { buildAchievableSourceBitmap } from "./helpers";

/**
 * Stage 7: Accents & Highlights (90-100%)
 * Final painterly finish: brightest impasto highlights and deepest dark accents
 * pop in last on top of the focal-refined painting.
 */
export const renderAccentsHighlights: StageRenderer = async (
  ctx,
  _params,
  t
) => {
  const { w, h } = ctx.analysis.workingRes;
  const focal = ctx.analysis.focalPoint ?? { x: 0.5, y: 0.46 };

  const customSrc = ctx.achievableColors?.fine
    ? await buildAchievableSourceBitmap(
        ctx.sourceImageData,
        ctx.analysis,
        ctx.achievableColors.fine
      )
    : null;
  const srcBmp = customSrc ?? ctx.sourceBitmap;

  if (!ctx.gl) {
    if (customSrc) return customSrc;
    return createImageBitmap(ctx.sourceBitmap);
  }

  // Tight painterly base with preserved focal edge hierarchy + final impasto accents
  try {
    return await ctx.gl.renderAccentsPipeline(srcBmp, w, h, focal, t, 0.35);
  } finally {
    customSrc?.close();
  }
};
