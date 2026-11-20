import type { ProcessPreset, ProcessStage } from "@/lib/types";
import { ALLA_PRIMA_PRESET } from "./alla-prima";

export const PROCESS_PRESETS: Record<string, ProcessPreset> = {
  "alla-prima": ALLA_PRIMA_PRESET,
};

export function getPreset(id: string): ProcessPreset {
  return PROCESS_PRESETS[id] ?? ALLA_PRIMA_PRESET;
}

/**
 * Returns the slider position representing the completed state of a given stage
 * without accidentally crossing into the next stage's range.
 */
export function getStageSnapValue(
  preset: ProcessPreset,
  stageIndex: number
): number {
  const clampedIdx = Math.max(
    0,
    Math.min(preset.stages.length - 1, stageIndex)
  );
  const stage = preset.stages[clampedIdx];
  if (!stage) return 100;
  const isLast = clampedIdx === preset.stages.length - 1;
  return isLast ? stage.sliderRange[1] : Math.max(stage.sliderRange[0], stage.sliderRange[1] - 0.5);
}

export type ResolvedSliderState = {
  stageIndex: number;
  stage: ProcessStage;
  t: number; // 0..1 within current stage
  /** When crossing a stage boundary, crossfade from the previous stage's end */
  crossfade?: {
    fromStage: ProcessStage;
    fromT: number;
    alpha: number; // 0 = all fromStage, 1 = all current stage
  };
};

const CROSSFADE_SPAN = 1.6; // slider units (0..100) over which boundaries crossfade

export function resolveSliderPosition(
  preset: ProcessPreset,
  rawValue: number
): ResolvedSliderState {
  const value = Math.max(0, Math.min(100, rawValue));
  const stages = preset.stages;

  let idx = stages.length - 1;
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (!stage) continue;
    const [start, end] = stage.sliderRange;
    if (value >= start && (value < end || i === stages.length - 1)) {
      idx = i;
      break;
    }
  }

  const stage = stages[idx]!;
  const [start, end] = stage.sliderRange;
  const span = Math.max(0.0001, end - start);
  const t = Math.max(0, Math.min(1, (value - start) / span));

  // Smooth boundary crossfade right after entering a new stage
  if (idx > 0 && value - start < CROSSFADE_SPAN) {
    const prevStage = stages[idx - 1]!;
    const alpha = Math.max(0, Math.min(1, (value - start) / CROSSFADE_SPAN));
    return {
      stageIndex: idx,
      stage,
      t,
      crossfade: {
        fromStage: prevStage,
        fromT: 1,
        alpha,
      },
    };
  }

  return { stageIndex: idx, stage, t };
}
