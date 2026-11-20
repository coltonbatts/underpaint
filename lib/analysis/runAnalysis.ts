import type { CropRect, ImageAnalysis } from "@/lib/types";
import type {
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
} from "@/workers/analysis.worker";

const WORKING_LONG_EDGE = 1024;

let sharedWorker: Worker | null = null;

function getAnalysisWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL("../../workers/analysis.worker.ts", import.meta.url),
      { type: "module" }
    );
  }
  return sharedWorker;
}

function resetAnalysisWorker(failedWorker: Worker): void {
  if (sharedWorker === failedWorker) {
    sharedWorker = null;
  }
  try {
    failedWorker.terminate();
  } catch {
    // ignore termination errors
  }
}

/**
 * Crops the source Blob and scales it to working resolution (~1024px long edge),
 * returning raw RGBA pixel data ready for the analysis worker and stage renderers.
 */
export async function extractWorkingImageData(
  blob: Blob,
  crop: CropRect,
  maxLongEdge = WORKING_LONG_EDGE
): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    const sx = Math.round(crop.x * bitmap.width);
    const sy = Math.round(crop.y * bitmap.height);
    const sw = Math.max(1, Math.round(crop.w * bitmap.width));
    const sh = Math.max(1, Math.round(crop.h * bitmap.height));

    const scale = Math.min(1, maxLongEdge / Math.max(sw, sh));
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));

    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(dw, dh);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to acquire 2D context.");
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);
      return ctx.getImageData(0, 0, dw, dh);
    }

    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to acquire 2D context.");
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);
    return ctx.getImageData(0, 0, dw, dh);
  } finally {
    bitmap.close();
  }
}

export async function runImageAnalysis(
  blob: Blob,
  crop: CropRect,
  onProgress?: (stage: string, percent: number) => void
): Promise<{ analysis: ImageAnalysis; durationMs: number }> {
  const imageData = await extractWorkingImageData(blob, crop);
  const worker = getAnalysisWorker();
  const id = crypto.randomUUID();

  // Copy into a dedicated transferable buffer
  const copy = new Uint8ClampedArray(imageData.data);
  const req: AnalysisWorkerRequest = {
    id,
    rgbaBuffer: copy.buffer,
    width: imageData.width,
    height: imageData.height,
  };

  return new Promise((resolve, reject) => {
    const handleMessage = (e: MessageEvent<AnalysisWorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== id) return;

      if (msg.type === "progress") {
        onProgress?.(msg.stage, msg.percent);
      } else if (msg.type === "done") {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        resolve({ analysis: msg.analysis, durationMs: msg.durationMs });
      } else if (msg.type === "error") {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        reject(new Error(msg.message));
      }
    };

    const handleError = (err: ErrorEvent) => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      resetAnalysisWorker(worker);
      reject(new Error(err.message || "Analysis worker crashed."));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage(req, [req.rgbaBuffer]);
  });
}
