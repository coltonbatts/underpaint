import { describe, expect, it } from "vitest";
import { hexToOklab } from "@/lib/color/conversions";
import { PIGMENT_MAP, PIGMENTS } from "@/lib/data/pigments";
import { getActivePigments } from "@/lib/data/palettes";
import type { MixRecipe, Pigment } from "@/lib/types";
import { defaultMixingEngine } from "../spectralAdapter";
import {
  clearSolverCache,
  normalizeParts,
  selectRankedRecipes,
  solveMixRecipes,
} from "../solver";

describe("Kubelka-Munk mixing engine & solver", () => {
  it("mixes Titanium White + Ultramarine Blue into a cool blue (never warm)", () => {
    const white = PIGMENT_MAP["titanium-white"]!;
    const ultra = PIGMENT_MAP["ultramarine-blue"]!;
    const mixed = defaultMixingEngine.mix([
      { pigment: white, weight: 3 },
      { pigment: ultra, weight: 1 },
    ]);

    // OKLab b < 0 is blue, b > 0 is yellow/warm
    expect(mixed.b).toBeLessThan(-0.04);
    expect(mixed.L).toBeGreaterThan(0.5);
  });

  it("mixes Cadmium Yellow Light + Ultramarine Blue into a subtractive green", () => {
    const yellow = PIGMENT_MAP["cadmium-yellow-light"]!;
    const ultra = PIGMENT_MAP["ultramarine-blue"]!;
    const mixed = defaultMixingEngine.mix([
      { pigment: yellow, weight: 2 },
      { pigment: ultra, weight: 1 },
    ]);

    // OKLab a < 0 is green (RGB averaging would yield muddy neutral gray ~0)
    expect(mixed.a).toBeLessThan(-0.03);
  });

  it("solves recipes with <= 4 pigments, valid integer/trace parts, under 300ms", () => {
    clearSolverCache();
    const target = hexToOklab("#6d8a68"); // muted sage green
    const start = performance.now();
    const recipes = solveMixRecipes(target, PIGMENTS);
    const elapsed = performance.now() - start;

    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes.length).toBeLessThanOrEqual(3);
    expect(elapsed).toBeLessThan(300);

    for (const r of recipes) {
      expect(r.parts.length).toBeGreaterThan(0);
      expect(r.parts.length).toBeLessThanOrEqual(4);
      for (const p of r.parts) {
        if (p.isTrace) {
          expect(p.parts).toBeLessThan(1);
        } else {
          expect(Number.isInteger(p.parts)).toBe(true);
          expect(p.parts).toBeGreaterThanOrEqual(1);
          expect(p.parts).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it("works with the 4-tube Zorn palette and flags gamut limits on vivid blue", () => {
    clearSolverCache();
    const zorn = getActivePigments("zorn");
    const vividBlue = hexToOklab("#1e52d8");
    const recipes = solveMixRecipes(vividBlue, zorn);

    expect(recipes.length).toBeGreaterThan(0);
    // Zorn has no blue pigment, so ΔE should reflect gamut limitation
    expect(recipes[0]!.deltaE2000).toBeGreaterThan(8);
  });

  it("returns multiple alternatives even after a maxResults=1 solve warms the cache", () => {
    clearSolverCache();
    const target = hexToOklab("#6d8a68");
    const single = solveMixRecipes(target, PIGMENTS, { maxResults: 1 });
    const multi = solveMixRecipes(target, PIGMENTS, { maxResults: 3 });

    expect(single).toHaveLength(1);
    expect(multi.length).toBeGreaterThan(1);
    expect(multi.length).toBeLessThanOrEqual(3);
  });

  it("ranks recipes deterministically without non-transitive sort cycles", () => {
    const makeRecipe = (ids: string[], deltaE2000: number): MixRecipe => ({
      target: { L: 0.5, a: 0, b: 0 },
      parts: ids.map((pigmentId) => ({ pigmentId, parts: 1 })),
      result: { L: 0.5, a: 0, b: 0 },
      deltaE2000,
      valueDelta: 0,
      notes: [],
    });

    const a = { recipe: makeRecipe(["p1", "p2", "p3"], 1.0), score: 1.0 };
    const b = { recipe: makeRecipe(["p4", "p5"], 2.0), score: 2.0 };
    const c = { recipe: makeRecipe(["p6"], 3.0), score: 3.0 };

    // Regardless of input order, B (within 1.5 of best score 1.0, simpler than A) wins #1,
    // A wins #2, and C (outside 1.0 + 1.5) stays #3.
    const permutations = [
      [a, b, c],
      [c, b, a],
      [b, c, a],
      [c, a, b],
    ];
    for (const perm of permutations) {
      const picked = selectRankedRecipes(perm, 3, 1.5);
      expect(picked.map((r) => r.parts.length)).toEqual([2, 3, 1]);
    }
  });

  it("reduces integer parts by GCD while preserving trace ratios", () => {
    const white = PIGMENT_MAP["titanium-white"]!;
    const ultra = PIGMENT_MAP["ultramarine-blue"]!;
    const red = PIGMENT_MAP["cadmium-red-light"]!;

    // 4:2 reduces to 2:1
    const simplified = normalizeParts([white, ultra], [4, 2]);
    expect(simplified).toEqual([
      { pigmentId: "titanium-white", parts: 2 },
      { pigmentId: "ultramarine-blue", parts: 1 },
    ]);

    // 4:2:trace keeps 4:2:0.25 so trace ratio is not doubled
    const withTrace = normalizeParts([white, ultra, red], [4, 2, 0.25]);
    expect(withTrace).toEqual([
      { pigmentId: "titanium-white", parts: 4 },
      { pigmentId: "ultramarine-blue", parts: 2 },
      { pigmentId: "cadmium-red-light", parts: 0.25, isTrace: true },
    ]);
  });

  it("recognizes any role='white' pigment without relying on hardcoded IDs", () => {
    clearSolverCache();
    const zincWhite: Pigment = {
      id: "zinc-white",
      name: "Zinc White",
      role: "white",
      spectral: "#f4f5f6",
      opacity: "semi",
      tintingStrength: "low",
      dryingSpeed: "slow",
    };
    const ultra = PIGMENT_MAP["ultramarine-blue"]!;
    const skyBlue = hexToOklab("#92b8e4");
    const recipes = solveMixRecipes(skyBlue, [zincWhite, ultra]);

    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes[0]!.parts.some((p) => p.pigmentId === "zinc-white")).toBe(true);
    expect(recipes[0]!.deltaE2000).toBeLessThan(8);
  });
});
