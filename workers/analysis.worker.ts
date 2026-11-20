/// <reference lib="webworker" />

import type { ImageAnalysis } from "@/lib/types";
import { extractLightnessAndValueMaps } from "@/lib/analysis/lightness";
import { extractKeyColors } from "@/lib/analysis/kmeans";
import { computeSlicLevel } from "@/lib/analysis/slic";
import { computeEdgeMap } from "@/lib/analysis/edges";
import { estimateFocalPoint } from "@/lib/analysis/saliency";
import { suggestGroundColor } from "@/lib/analysis/groundColor";

export type AnalysisWorkerRequest = {
  id: string;
  rgbaBuffer: ArrayBuffer;
  width: number;
  height: number;
};

export type AnalysisWorkerResponse =
  | {
      type: "progress";
      id: string;
      stage: string;
      percent: number;
    }
  | {
      type: "done";
      id: string;
      analysis: ImageAnalysis;
      durationMs: number;
    }
  | {
      type: "error";
      id: string;
      message: string;
    };

const ctx: DedicatedWorkerGlobalScope =
  self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<AnalysisWorkerRequest>) => {
  const { id, rgbaBuffer, width, height } = event.data;
  const start = performance.now();

  try {
    const rgba = new Uint8ClampedArray(rgbaBuffer);
    const pixelCount = width * height;

    const postProgress = (stage: string, percent: number) => {
      const msg: AnalysisWorkerResponse = { type: "progress", id, stage, percent };
      ctx.postMessage(msg);
    };

    postProgress("Measuring values", 15);
    const { okL, okA, okB, valueContinuous, valueMap3, valueMap5, valueMap9 } =
      extractLightnessAndValueMaps(rgba, pixelCount);

    postProgress("Extracting key colors", 35);
    const keyColors = extractKeyColors(okL, okA, okB, 12);
    const suggestedGroundColor = suggestGroundColor(okA, okB);

    postProgress("Detecting contours", 55);
    const edges = computeEdgeMap(okL, width, height);
    const focalPoint = estimateFocalPoint(okL, edges, width, height);

    postProgress("Grouping masses", 72);
    const coarseSegments = computeSlicLevel(okL, okA, okB, width, height, 24, 0, 0.14, 6);

    postProgress("Refining forms", 90);
    const fineSegments = computeSlicLevel(okL, okA, okB, width, height, 150, 1, 0.14, 6);

    const analysis: ImageAnalysis = {
      workingRes: { w: width, h: height },
      lightness: okL,
      valueContinuous,
      valueMap3,
      valueMap5,
      valueMap9,
      segments: [coarseSegments, fineSegments],
      edges,
      keyColors,
      focalPoint,
      suggestedGroundColor,
    };

    const transferables: Transferable[] = [
      okL.buffer,
      valueContinuous.buffer,
      valueMap3.buffer,
      valueMap5.buffer,
      valueMap9.buffer,
      edges.buffer,
      coarseSegments.labels.buffer,
      fineSegments.labels.buffer,
    ];

    const doneMsg: AnalysisWorkerResponse = {
      type: "done",
      id,
      analysis,
      durationMs: Math.round(performance.now() - start),
    };

    ctx.postMessage(doneMsg, transferables);
  } catch (err) {
    const errMsg: AnalysisWorkerResponse = {
      type: "error",
      id,
      message: err instanceof Error ? err.message : "Image analysis failed.",
    };
    ctx.postMessage(errMsg);
  }
};
