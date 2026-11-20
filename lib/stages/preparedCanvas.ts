import type { StageRenderer } from "./types";
import { clampByte, GESSO_RGB, linenTooth, washVariation } from "./helpers";

/**
 * Stage 0: Prepared Canvas (0-4%)
 * Warm off-white gessoed linen panel with subtle canvas tooth.
 */
export const renderPreparedCanvas: StageRenderer = async (ctx, _params, t) => {
  const { w, h } = ctx.analysis.workingRes;
  const img = new ImageData(w, h);
  const data = img.data;

  // Gently transition from slightly warmer raw primed linen into crisp warm gesso
  const baseR = (GESSO_RGB.r - 0.03 * (1 - t)) * 255;
  const baseG = (GESSO_RGB.g - 0.035 * (1 - t)) * 255;
  const baseB = (GESSO_RGB.b - 0.045 * (1 - t)) * 255;

  for (let y = 0; y < h; y++) {
    const ny = y / h;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const tooth = linenTooth(x, y) * 5.0;
      const brush = (washVariation(nx, ny) - 1) * 30;
      const off = (row + x) * 4;
      data[off] = clampByte(baseR + tooth + brush);
      data[off + 1] = clampByte(baseG + tooth + brush);
      data[off + 2] = clampByte(baseB + tooth * 0.9 + brush);
      data[off + 3] = 255;
    }
  }

  return createImageBitmap(img);
};
