import type { StageRenderer } from "./types";
import { fillTonedGroundBuffer, getGroundRgb } from "./helpers";

/**
 * Stage 1: Toned Ground / Imprimatura (4-12%)
 * Thin, wiped wash of burnt sienna / raw umber / ochre over gesso.
 */
export const renderTonedGround: StageRenderer = async (ctx, _params, t) => {
  const { w, h } = ctx.analysis.workingRes;
  const img = new ImageData(w, h);
  const ground = getGroundRgb(ctx.canvasSpec, ctx.analysis);

  // Across t (0 -> 1), build the wash from a light veil to a classic semi-transparent imprimatura
  const washOpacity = 0.25 + 0.63 * t;
  fillTonedGroundBuffer(img.data, w, h, ground, washOpacity);

  return createImageBitmap(img);
};
