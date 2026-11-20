import type { StageRenderer } from "./types";
import { clampByte, fillTonedGroundBuffer, getGroundRgb } from "./helpers";

/**
 * Stage 2: Drawing / Placement (12-22%)
 * Simplified contour lines (coarse shape boundaries + strong thinned edges)
 * drawn in thin darkened ground paint over Stage 1's imprimatura.
 * Lines become progressively more complete as t moves 0 -> 1.
 */
export const renderDrawing: StageRenderer = async (ctx, _params, t) => {
  const { w, h } = ctx.analysis.workingRes;
  const img = new ImageData(w, h);
  const data = img.data;
  const ground = getGroundRgb(ctx.canvasSpec, ctx.analysis);

  // Base: full imprimatura ground
  fillTonedGroundBuffer(data, w, h, ground, 0.88);

  // Darkened ground pigment for thin brush drawing (e.g. burnt umber / dark sienna)
  const lineR = ground.r * 0.26 * 255;
  const lineG = ground.g * 0.22 * 255;
  const lineB = ground.b * 0.18 * 255;

  const edges = ctx.analysis.edges;
  const coarseLabels = ctx.analysis.segments[0]?.labels;

  // Threshold drops as t rises: big silhouette contours first, secondary placement lines second
  const edgeThreshold = 0.44 - t * 0.24; // 0.44 -> 0.20

  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = row + x;
      let ink = 0;

      // 1. Coarse mass boundaries (big compositional shapes)
      if (coarseLabels) {
        const c = coarseLabels[idx] ?? 0;
        const isCoarseBoundary =
          coarseLabels[idx + 1] !== c || coarseLabels[idx + w] !== c;
        if (isCoarseBoundary) {
          ink = Math.max(ink, 0.28 + 0.34 * t);
        }
      }

      // 2. Strong thinned image contours (dilated slightly by 1px for brush feel)
      const e = Math.max(
        edges[idx] ?? 0,
        (edges[idx - 1] ?? 0) * 0.75,
        (edges[idx + 1] ?? 0) * 0.75,
        (edges[idx - w] ?? 0) * 0.75,
        (edges[idx + w] ?? 0) * 0.75
      );

      if (e > edgeThreshold) {
        const strength = Math.min(1, (e - edgeThreshold) / (1 - edgeThreshold));
        ink = Math.max(ink, strength * (0.55 + 0.35 * t));
      }

      if (ink > 0.01) {
        const off = idx * 4;
        const alpha = Math.min(0.88, ink);
        data[off] = clampByte((data[off] ?? 0) * (1 - alpha) + lineR * alpha);
        data[off + 1] = clampByte(
          (data[off + 1] ?? 0) * (1 - alpha) + lineG * alpha
        );
        data[off + 2] = clampByte(
          (data[off + 2] ?? 0) * (1 - alpha) + lineB * alpha
        );
      }
    }
  }

  return createImageBitmap(img);
};
