import type { StageRenderer } from "./types";
import { buildAchievableSourceBitmap } from "./helpers";

/**
 * Stage 6: Refinement & Edges (75-90%)
 * Painterly-filtered source image (constrained to achievable palette colors when active)
 * with detail weighted by distance from the focal point:
 * - Hard/crisp edges and tighter brushwork near focalPoint
 * - Soft and lost edges toward the periphery
 */
export const renderRefinementEdges: StageRenderer = async (ctx, _params, t) => {
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

  const sharpRadius = 3.6 - 1.1 * t; // 3.6 -> 2.5
  const blurRadius = 4.8 - 1.2 * t;

  try {
    return await ctx.gl.renderRefinementPipeline(
      srcBmp,
      w,
      h,
      focal,
      sharpRadius,
      blurRadius,
      0.55 + 0.45 * t
    );
  } finally {
    customSrc?.close();
  }
};
