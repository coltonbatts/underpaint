import type { CanvasSpec, ImageAnalysis, OKLab } from "@/lib/types";
import type { StudioGLPipeline } from "@/lib/render/glContext";

export type StageRenderContext = {
  analysis: ImageAnalysis;
  canvasSpec: CanvasSpec;
  sourceImageData: ImageData;
  sourceBitmap: ImageBitmap;
  gl: StudioGLPipeline | null;
  /** Optional segment-index -> achievable OKLab map (populated in Milestone 5). */
  achievableColors?: {
    coarse?: OKLab[];
    fine?: OKLab[];
  };
};

export type StageParams = Record<string, number | string | boolean>;

export type StageRenderer = (
  ctx: StageRenderContext,
  params: StageParams,
  t: number
) => Promise<ImageBitmap>;
