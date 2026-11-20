import type { MixRecipe, OKLab, Pigment } from "@/lib/types";
import type {
  MixingWorkerRequest,
  MixingWorkerResponse,
} from "@/workers/mixing.worker";

let sharedMixingWorker: Worker | null = null;

function getMixingWorker(): Worker {
  if (!sharedMixingWorker) {
    sharedMixingWorker = new Worker(
      new URL("../../workers/mixing.worker.ts", import.meta.url),
      { type: "module" }
    );
  }
  return sharedMixingWorker;
}

function resetMixingWorker(failedWorker: Worker): void {
  if (sharedMixingWorker === failedWorker) {
    sharedMixingWorker = null;
  }
  try {
    failedWorker.terminate();
  } catch {
    // ignore termination errors
  }
}

export function solveColorInWorker(
  target: OKLab,
  pigments: Pigment[],
  valueWeight = 2.0
): Promise<{ recipes: MixRecipe[]; durationMs: number }> {
  const worker = getMixingWorker();
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<MixingWorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== id) return;
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);

      if (msg.type === "solveDone") {
        resolve({ recipes: msg.recipes, durationMs: msg.durationMs });
      } else if (msg.type === "error") {
        reject(new Error(msg.message));
      }
    };

    const onError = (err: ErrorEvent) => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      resetMixingWorker(worker);
      reject(new Error(err.message || "Mixing worker crashed."));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);

    const req: MixingWorkerRequest = {
      type: "solve",
      id,
      target,
      pigments,
      valueWeight,
    };
    worker.postMessage(req);
  });
}

export function solveBatchInWorker(
  targets: OKLab[],
  pigments: Pigment[],
  valueWeight = 2.0,
  maxResults = 1
): Promise<{ results: MixRecipe[][]; durationMs: number }> {
  const worker = getMixingWorker();
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<MixingWorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== id) return;
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);

      if (msg.type === "solveBatchDone") {
        resolve({ results: msg.results, durationMs: msg.durationMs });
      } else if (msg.type === "error") {
        reject(new Error(msg.message));
      }
    };

    const onError = (err: ErrorEvent) => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      resetMixingWorker(worker);
      reject(new Error(err.message || "Mixing worker crashed."));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);

    const req: MixingWorkerRequest = {
      type: "solveBatch",
      id,
      targets,
      pigments,
      valueWeight,
      maxResults,
    };
    worker.postMessage(req);
  });
}
