import type { StageRenderer } from "./types";
import {
  clampByte,
  GESSO_RGB,
  getGroundRgb,
  linenTooth,
  washVariation,
} from "./helpers";

/**
 * Stage 3: Wipe-out / Monochrome Block-in (22-35%)
 * Brunaille-style lean underpainting rendered strictly in the ground color's value range:
 * - Darks painted in deep darkened ground pigment
 * - Midtones stay near the toned ground
 * - Lights wiped back with a rag/OMS toward the warm gesso canvas
 * Transitions smoothly from 3-value notan (t=0) to 5-value grouping (t=1).
 */
export const renderMonochromeBlockIn: StageRenderer = async (
  ctx,
  _params,
  t
) => {
  const { w, h } = ctx.analysis.workingRes;
  const img = new ImageData(w, h);
  const data = img.data;

  const ground = getGroundRgb(ctx.canvasSpec, ctx.analysis);
  const v3 = ctx.analysis.valueMap3;
  const v5 = ctx.analysis.valueMap5;
  const lightness = ctx.analysis.lightness;

  // Deepest dark in the ground's own earth family
  const darkR = ground.r * 0.17 * 255;
  const darkG = ground.g * 0.14 * 255;
  const darkB = ground.b * 0.12 * 255;

  // Midtone = toned ground
  const midR = ground.r * 255;
  const midG = ground.g * 255;
  const midB = ground.b * 255;

  // Wiped light = near-gesso with a whisper of warm ground stain
  const lightR = (GESSO_RGB.r * 0.88 + ground.r * 0.12) * 255;
  const lightG = (GESSO_RGB.g * 0.88 + ground.g * 0.12) * 255;
  const lightB = (GESSO_RGB.b * 0.88 + ground.b * 0.12) * 255;

  for (let y = 0; y < h; y++) {
    const ny = y / h;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const idx = row + x;

      const b3 = ((v3 ? v3[idx] : Math.floor((v5[idx] ?? 2) * 0.6)) ?? 1) / 2; // 0, 0.5, 1
      const b5 = (v5[idx] ?? 2) / 4; // 0, 0.25, 0.5, 0.75, 1
      const lCont = lightness[idx] ?? 0.5;

      // Blend from 3-value notan (t=0) -> 5-value block-in (t=1) with subtle continuous modeling
      const val = b3 * (1 - t) + b5 * t;
      const shaped = val * 0.82 + lCont * 0.18;

      let r: number;
      let g: number;
      let b: number;
      if (shaped < 0.5) {
        const u = shaped * 2;
        r = darkR + (midR - darkR) * u;
        g = darkG + (midG - darkG) * u;
        b = darkB + (midB - darkB) * u;
      } else {
        const u = (shaped - 0.5) * 2;
        r = midR + (lightR - midR) * u;
        g = midG + (lightG - midG) * u;
        b = midB + (lightB - midB) * u;
      }

      const tooth = linenTooth(x, y) * 4.5;
      const wipe = (washVariation(nx, ny) - 1) * 22;

      const off = idx * 4;
      data[off] = clampByte(r + tooth + wipe);
      data[off + 1] = clampByte(g + tooth + wipe);
      data[off + 2] = clampByte(b + tooth * 0.9 + wipe);
      data[off + 3] = 255;
    }
  }

  // Soften pixel-sharp value-bucket edges with a gentle WebGL blur for a rag/brush feel
  if (ctx.gl) {
    const rawBmp = await createImageBitmap(img);
    try {
      return await ctx.gl.renderBlur(rawBmp, w, h, 2.2, 0, 0.25);
    } finally {
      rawBmp.close();
    }
  }

  return createImageBitmap(img);
};
