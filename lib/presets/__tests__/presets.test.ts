import { describe, expect, it } from "vitest";
import {
  ALLA_PRIMA_PRESET,
} from "../alla-prima";
import {
  getPreset,
  getStageSnapValue,
  resolveSliderPosition,
} from "../index";

describe("process presets & slider resolution", () => {
  it("falls back to alla-prima for unknown preset IDs", () => {
    expect(getPreset("nonexistent").id).toBe("alla-prima");
  });

  it("snaps every stage cleanly inside its own slider range without crossing boundaries", () => {
    for (let i = 0; i < ALLA_PRIMA_PRESET.stages.length; i++) {
      const snap = getStageSnapValue(ALLA_PRIMA_PRESET, i);
      const resolved = resolveSliderPosition(ALLA_PRIMA_PRESET, snap);
      expect(resolved.stageIndex).toBe(i);
      expect(resolved.crossfade).toBeUndefined();
      expect(resolved.t).toBeGreaterThan(0.9);
    }
  });

  it("clamps out-of-range slider values to [0, 100]", () => {
    const lo = resolveSliderPosition(ALLA_PRIMA_PRESET, -25);
    expect(lo.stageIndex).toBe(0);
    expect(lo.t).toBe(0);

    const hi = resolveSliderPosition(ALLA_PRIMA_PRESET, 150);
    expect(hi.stageIndex).toBe(ALLA_PRIMA_PRESET.stages.length - 1);
    expect(hi.t).toBe(1);
  });

  it("computes smooth boundary crossfades right after crossing into a new stage", () => {
    // Stage 1 starts at 20; 20.8 is halfway through CROSSFADE_SPAN (1.6)
    const crossing = resolveSliderPosition(ALLA_PRIMA_PRESET, 20.8);
    expect(crossing.stageIndex).toBe(1);
    expect(crossing.crossfade).toBeDefined();
    expect(crossing.crossfade!.fromStage.id).toBe(ALLA_PRIMA_PRESET.stages[0]!.id);
    expect(crossing.crossfade!.fromT).toBe(1);
    expect(crossing.crossfade!.alpha).toBeCloseTo(0.5, 4);

    // Well past the crossfade span -> no crossfade
    const steady = resolveSliderPosition(ALLA_PRIMA_PRESET, 30);
    expect(steady.stageIndex).toBe(1);
    expect(steady.crossfade).toBeUndefined();
  });
});
