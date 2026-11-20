import type { ProcessStage, StageRendererId } from "@/lib/types";
import { stageBitmapCache } from "@/lib/render/cache";
import type { StageRenderContext, StageRenderer } from "./types";
import { renderPreparedCanvas } from "./preparedCanvas";
import { renderTonedGround } from "./tonedGround";
import { renderDrawing } from "./drawing";
import { renderMonochromeBlockIn } from "./monochromeBlockIn";
import { renderColorBlockIn } from "./colorBlockIn";
import { renderDevelopForms } from "./developForms";
import { renderRefinementEdges } from "./refinementEdges";
import { renderAccentsHighlights } from "./accentsHighlights";

export const STAGE_RENDERERS: Record<StageRendererId, StageRenderer> = {
  "prepared-canvas": renderPreparedCanvas,
  "toned-ground": renderTonedGround,
  drawing: renderDrawing,
  "monochrome-block-in": renderMonochromeBlockIn,
  "color-block-in": renderColorBlockIn,
  "develop-forms": renderDevelopForms,
  "refinement-edges": renderRefinementEdges,
  "accents-highlights": renderAccentsHighlights,
};

/**
 * Renders a stage with quantized-t LRU caching so scrubbing stays 60fps.
 */
export async function renderStageCached(
  projectKey: string,
  stage: ProcessStage,
  ctx: StageRenderContext,
  t: number,
  extraKey = ""
): Promise<ImageBitmap> {
  // Quantize t into 5 discrete keyframes per stage (0, 0.25, 0.5, 0.75, 1.0)
  // — keeps scrubbing instant and avoids redundant GPU passes while remaining smooth.
  const qT = Math.round(Math.max(0, Math.min(1, t)) * 4) / 4;
  const groundKey =
    ctx.canvasSpec.groundColor ?? ctx.analysis.suggestedGroundColor ?? "";
  const focalKey = ctx.analysis.focalPoint
    ? `${ctx.analysis.focalPoint.x.toFixed(2)},${ctx.analysis.focalPoint.y.toFixed(2)}`
    : "";

  const cacheKey = `${projectKey}|${stage.id}|${qT.toFixed(2)}|${groundKey}|${focalKey}|${extraKey}`;
  const cached = stageBitmapCache.get(cacheKey);
  if (cached) return cached;

  const renderer = STAGE_RENDERERS[stage.render];
  const bitmap = await renderer(ctx, stage.params, qT);
  stageBitmapCache.set(cacheKey, bitmap);
  return bitmap;
}
