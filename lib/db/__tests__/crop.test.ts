import { describe, expect, it } from "vitest";
import { computeCenteredCrop } from "../projectsDb";

describe("computeCenteredCrop", () => {
  it("returns full frame when image and canvas aspect ratios match", () => {
    expect(computeCenteredCrop(1600, 1200, 16, 12)).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("crops width symmetrically when image is wider than canvas", () => {
    // 2:1 image onto 1:1 square canvas -> centered 50% width
    const crop = computeCenteredCrop(2000, 1000, 10, 10);
    expect(crop.x).toBeCloseTo(0.25, 6);
    expect(crop.y).toBe(0);
    expect(crop.w).toBeCloseTo(0.5, 6);
    expect(crop.h).toBe(1);
  });

  it("crops height symmetrically when image is taller than canvas", () => {
    // 1:2 image onto 1:1 square canvas -> centered 50% height
    const crop = computeCenteredCrop(1000, 2000, 10, 10);
    expect(crop.x).toBe(0);
    expect(crop.y).toBeCloseTo(0.25, 6);
    expect(crop.w).toBe(1);
    expect(crop.h).toBeCloseTo(0.5, 6);
  });

  it("guards against zero or negative dimensions", () => {
    expect(computeCenteredCrop(0, 1000, 11, 14)).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
    expect(computeCenteredCrop(1000, 1000, -4, 10)).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });
});
