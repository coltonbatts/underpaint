/// <reference lib="webworker" />

import type { MixRecipe, OKLab, Pigment } from "@/lib/types";
import { solveMixRecipes } from "@/lib/mixing/solver";

export type MixingWorkerRequest =
  | {
      type: "solve";
      id: string;
      target: OKLab;
      pigments: Pigment[];
      valueWeight?: number;
    }
  | {
      type: "solveBatch";
      id: string;
      targets: OKLab[];
      pigments: Pigment[];
      valueWeight?: number;
      maxResults?: number;
    };

export type MixingWorkerResponse =
  | {
      type: "solveDone";
      id: string;
      recipes: MixRecipe[];
      durationMs: number;
    }
  | {
      type: "solveBatchDone";
      id: string;
      results: MixRecipe[][];
      durationMs: number;
    }
  | {
      type: "error";
      id: string;
      message: string;
    };

const ctx: DedicatedWorkerGlobalScope =
  self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<MixingWorkerRequest>) => {
  const req = event.data;
  const start = performance.now();

  try {
    if (req.type === "solve") {
      const recipes = solveMixRecipes(req.target, req.pigments, {
        valueWeight: req.valueWeight ?? 2.0,
        maxResults: 3,
      });
      const res: MixingWorkerResponse = {
        type: "solveDone",
        id: req.id,
        recipes,
        durationMs: Math.round(performance.now() - start),
      };
      ctx.postMessage(res);
      return;
    }

    if (req.type === "solveBatch") {
      const results = req.targets.map((target) =>
        solveMixRecipes(target, req.pigments, {
          valueWeight: req.valueWeight ?? 2.0,
          maxResults: req.maxResults ?? 1,
        })
      );
      const res: MixingWorkerResponse = {
        type: "solveBatchDone",
        id: req.id,
        results,
        durationMs: Math.round(performance.now() - start),
      };
      ctx.postMessage(res);
    }
  } catch (err) {
    const res: MixingWorkerResponse = {
      type: "error",
      id: req.id,
      message: err instanceof Error ? err.message : "Mixing solver error.",
    };
    ctx.postMessage(res);
  }
};
