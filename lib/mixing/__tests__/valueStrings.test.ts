import { describe, expect, it } from "vitest";
import { hexToOklab } from "@/lib/color/conversions";
import { oklabToValue } from "@/lib/color/valueScale";
import type { KeyColor } from "@/lib/types";
import { buildValueStringTargets } from "../valueStrings";

function makeKeyColor(hex: string, coverage: number): KeyColor {
  const oklab = hexToOklab(hex);
  return {
    oklab,
    hex,
    value: oklabToValue(oklab),
    coverage,
    firstStageId: "color-block-in",
  };
}

describe("buildValueStringTargets", () => {
  it("groups key colors into families ordered by coverage (max 4) with monotonic 5-step dark->light strings", () => {
    const keyColors: KeyColor[] = [
      makeKeyColor("#2d4e8c", 28), // blues
      makeKeyColor("#7896c8", 12), // blues (combined 40%)
      makeKeyColor("#c48f32", 25), // ochres-yellows
      makeKeyColor("#5a7c4d", 15), // greens
      makeKeyColor("#b84b36", 12), // warm-reds
      makeKeyColor("#7a7874", 8),  // neutrals (5th -> truncated to top 4)
    ];

    const families = buildValueStringTargets(keyColors);

    expect(families).toHaveLength(4);
    expect(families[0]!.id).toBe("blues");
    expect(families[0]!.coverage).toBe(40);
    expect(families[1]!.id).toBe("ochres-yellows");

    for (const fam of families) {
      expect(fam.steps).toHaveLength(5);
      for (let i = 1; i < fam.steps.length; i++) {
        expect(fam.steps[i]!.value).toBeGreaterThan(fam.steps[i - 1]!.value);
      }
    }
  });
});
