import { create } from "zustand";
import type { ImageAnalysis, MixRecipe, OKLab, Pigment } from "@/lib/types";
import { solveBatchInWorker } from "@/lib/mixing/runMixing";
import {
  buildValueStringTargets,
  type ValueStringFamily,
} from "@/lib/mixing/valueStrings";

export const GAMUT_WARNING_DE = 6.5;

interface MixingIntegrationState {
  signature: string | null;
  solving: boolean;
  coarseAchievable: OKLab[] | null;
  fineAchievable: OKLab[] | null;
  fineDeltaE: Float32Array | null;
  outOfGamutPercent: number;
  keyColorRecipes: MixRecipe[] | null;
  valueStrings: ValueStringFamily[];
  solveForProject: (
    projectId: string,
    analysis: ImageAnalysis,
    pigments: Pigment[],
    valueWeight: number
  ) => Promise<void>;
  reset: () => void;
}

export const useMixingStore = create<MixingIntegrationState>((set, get) => ({
  signature: null,
  solving: false,
  coarseAchievable: null,
  fineAchievable: null,
  fineDeltaE: null,
  outOfGamutPercent: 0,
  keyColorRecipes: null,
  valueStrings: [],

  solveForProject: async (projectId, analysis, pigments, valueWeight) => {
    const palSig = pigments
      .map((p) => p.id)
      .sort()
      .join(",");
    const sig = `${projectId}|${analysis.workingRes.w}x${analysis.workingRes.h}|${palSig}|${valueWeight.toFixed(1)}`;

    if (get().signature === sig && !get().solving && get().coarseAchievable) {
      return;
    }

    set({ signature: sig, solving: true });

    try {
      const coarseTargets = analysis.segments[0]?.meanColors ?? [];
      const fineTargets = analysis.segments[1]?.meanColors ?? [];
      const keyTargets = analysis.keyColors.map((k) => k.oklab);
      const rawFamilies = buildValueStringTargets(analysis.keyColors);
      const stringTargets = rawFamilies.flatMap((f) =>
        f.steps.map((s) => s.targetOklab)
      );

      // Single off-thread batch call leverages the worker's quantized solver cache
      const allTargets = [
        ...coarseTargets,
        ...fineTargets,
        ...keyTargets,
        ...stringTargets,
      ];

      const { results } = await solveBatchInWorker(
        allTargets,
        pigments,
        valueWeight,
        1
      );

      // Ignore stale responses if palette/project changed while solving
      if (get().signature !== sig) return;

      let cursor = 0;

      const coarseAchievable: OKLab[] = coarseTargets.map((orig, i) => {
        const best = results[cursor + i]?.[0];
        return best ? best.result : orig;
      });
      cursor += coarseTargets.length;

      const fineAchievable: OKLab[] = [];
      const fineDeltaE = new Float32Array(fineTargets.length);
      for (let i = 0; i < fineTargets.length; i++) {
        const best = results[cursor + i]?.[0];
        fineAchievable.push(best ? best.result : fineTargets[i]!);
        fineDeltaE[i] = best ? best.deltaE2000 : 0;
      }
      cursor += fineTargets.length;

      // Compute % of canvas pixels whose fine segment exceeds GAMUT_WARNING_DE
      let outCount = 0;
      const fineLabels = analysis.segments[1]?.labels;
      if (fineLabels && fineLabels.length > 0) {
        for (let i = 0; i < fineLabels.length; i++) {
          const seg = fineLabels[i] ?? 0;
          if ((fineDeltaE[seg] ?? 0) > GAMUT_WARNING_DE) {
            outCount++;
          }
        }
      }
      const outOfGamutPercent = fineLabels
        ? (outCount / Math.max(1, fineLabels.length)) * 100
        : 0;

      const keyColorRecipes: MixRecipe[] = keyTargets.map((_, i) => {
        const best = results[cursor + i]?.[0];
        return best!;
      }).filter((r): r is MixRecipe => Boolean(r));
      cursor += keyTargets.length;

      // Attach solved recipes to each value string step
      const valueStrings: ValueStringFamily[] = rawFamilies.map((fam) => ({
        ...fam,
        steps: fam.steps.map((step) => {
          const best = results[cursor++]?.[0];
          return { ...step, recipe: best };
        }),
      }));

      set({
        solving: false,
        coarseAchievable,
        fineAchievable,
        fineDeltaE,
        outOfGamutPercent,
        keyColorRecipes,
        valueStrings,
      });
    } catch {
      if (get().signature === sig) {
        set({ solving: false });
      }
    }
  },

  reset: () =>
    set({
      signature: null,
      solving: false,
      coarseAchievable: null,
      fineAchievable: null,
      fineDeltaE: null,
      outOfGamutPercent: 0,
      keyColorRecipes: null,
      valueStrings: [],
    }),
}));
