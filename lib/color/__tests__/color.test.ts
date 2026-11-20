import { describe, expect, it } from "vitest";
import {
  hexToSrgb,
  labToSrgb,
  oklabToOklch,
  oklabToSrgb,
  oklchToOklab,
  srgbToHex,
  srgbToLab,
  srgbToOklab,
  srgbToXyz,
  xyzToSrgb,
} from "../conversions";
import { deltaE2000 } from "../deltaE2000";
import {
  labLToValue,
  quantizeValue,
  rgbBytesToPerceptualGrayByte,
  rgbBytesToValue,
  srgbToValue,
} from "../valueScale";
import { extractLightnessAndValueMaps } from "@/lib/analysis/lightness";

describe("color conversions", () => {
  const samples = [
    { r: 0, g: 0, b: 0 },
    { r: 1, g: 1, b: 1 },
    { r: 0.5, g: 0.5, b: 0.5 },
    { r: 0.85, g: 0.22, b: 0.14 },
    { r: 0.12, g: 0.25, b: 0.68 },
    { r: 0.78, g: 0.64, b: 0.28 },
  ];

  it("round-trips sRGB <-> XYZ <-> CIELAB accurately", () => {
    for (const c of samples) {
      const xyz = srgbToXyz(c);
      const backXyz = xyzToSrgb(xyz);
      expect(backXyz.r).toBeCloseTo(c.r, 5);
      expect(backXyz.g).toBeCloseTo(c.g, 5);
      expect(backXyz.b).toBeCloseTo(c.b, 5);

      const lab = srgbToLab(c);
      const backLab = labToSrgb(lab);
      expect(backLab.r).toBeCloseTo(c.r, 5);
      expect(backLab.g).toBeCloseTo(c.g, 5);
      expect(backLab.b).toBeCloseTo(c.b, 5);
    }
  });

  it("round-trips sRGB <-> OKLab <-> OKLCH accurately", () => {
    for (const c of samples) {
      const ok = srgbToOklab(c);
      const back = oklabToSrgb(ok);
      expect(back.r).toBeCloseTo(c.r, 5);
      expect(back.g).toBeCloseTo(c.g, 5);
      expect(back.b).toBeCloseTo(c.b, 5);

      const lch = oklabToOklch(ok);
      const backOk = oklchToOklab(lch);
      expect(backOk.L).toBeCloseTo(ok.L, 5);
      expect(backOk.a).toBeCloseTo(ok.a, 5);
      expect(backOk.b).toBeCloseTo(ok.b, 5);
    }
  });

  it("round-trips hex <-> sRGB", () => {
    expect(srgbToHex(hexToSrgb("#c9945b"))).toBe("#c9945b");
    expect(srgbToHex(hexToSrgb("#000000"))).toBe("#000000");
    expect(srgbToHex(hexToSrgb("#ffffff"))).toBe("#ffffff");
  });
});

describe("CIEDE2000 (Sharma, Wu & Dalal 2005 reference pairs)", () => {
  // Standard reference pairs from Table 1 of Sharma et al. (2005)
  const sharmaPairs: Array<
    [[number, number, number], [number, number, number], number]
  > = [
    [[50.0, 2.6772, -79.7751], [50.0, 0.0, -82.7485], 2.0425],
    [[50.0, 3.1571, -77.2803], [50.0, 0.0, -82.7485], 2.8615],
    [[50.0, 2.8361, -74.02], [50.0, 0.0, -82.7485], 3.4412],
    [[50.0, -1.3802, -84.2814], [50.0, 0.0, -82.7485], 1.0],
    [[50.0, -1.1848, -84.8006], [50.0, 0.0, -82.7485], 1.0],
    [[50.0, -0.9009, -85.5211], [50.0, 0.0, -82.7485], 1.0],
    [[50.0, 0.0, 0.0], [50.0, -1.0, 2.0], 2.3669],
    [[50.0, -1.0, 2.0], [50.0, 0.0, 0.0], 2.3669],
    [[50.0, 2.49, -0.001], [50.0, -2.49, 0.0009], 7.1792],
    [[50.0, 2.49, -0.001], [50.0, -2.49, 0.001], 7.1792],
    [[50.0, -0.001, 2.49], [50.0, 0.0009, -2.49], 4.8045],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
    [[50.0, 2.5, 0.0], [73.0, 25.0, -18.0], 27.1492],
    [[50.0, 2.5, 0.0], [61.0, -5.0, 29.0], 22.8977],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];

  it("matches Sharma et al. test pairs within 0.001", () => {
    for (const [c1, c2, expected] of sharmaPairs) {
      const actual = deltaE2000(
        { L: c1[0], a: c1[1], b: c1[2] },
        { L: c2[0], a: c2[1], b: c2[2] }
      );
      expect(Math.abs(actual - expected)).toBeLessThan(0.001);
    }
  });

  it("returns 0 for identical colors", () => {
    expect(deltaE2000({ L: 50, a: 20, b: -30 }, { L: 50, a: 20, b: -30 })).toBe(
      0
    );
  });
});

describe("value scale (0-10)", () => {
  it("maps pure black, mid-gray, and pure white to 0 / ~5 / 10", () => {
    expect(srgbToValue({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 4);
    expect(srgbToValue({ r: 1, g: 1, b: 1 })).toBeCloseTo(10, 4);
    // Mid-gray in sRGB (~#777777) has CIELAB L* ≈ 50
    const mid = srgbToValue(hexToSrgb("#777777"));
    expect(mid).toBeGreaterThan(4.8);
    expect(mid).toBeLessThan(5.2);
    expect(labLToValue(50)).toBe(5);
  });

  it("quantizes into 3, 5, and 9 value buckets cleanly", () => {
    expect(quantizeValue(0, 3)).toBe(0);
    expect(quantizeValue(5, 3)).toBe(1);
    expect(quantizeValue(10, 3)).toBe(2);

    expect(quantizeValue(0, 5)).toBe(0);
    expect(quantizeValue(5, 5)).toBe(2);
    expect(quantizeValue(10, 5)).toBe(4);

    expect(quantizeValue(0, 9)).toBe(0);
    expect(quantizeValue(5, 9)).toBe(4);
    expect(quantizeValue(10, 9)).toBe(8);
  });

  it("keeps rgbBytesToValue and extracted valueContinuous aligned with CIELAB L*/10", () => {
    // Mid-gray #777777 (119,119,119): CIELAB L*/10 ≈ 5.0 (whereas OKLab L*10 ≈ 5.7)
    const rgba = new Uint8ClampedArray([
      119, 119, 119, 255,
      30, 82, 216, 255,
      243, 209, 38, 255,
    ]);
    const extracted = extractLightnessAndValueMaps(rgba, 3);

    for (let i = 0; i < 3; i++) {
      const r = rgba[i * 4]!;
      const g = rgba[i * 4 + 1]!;
      const b = rgba[i * 4 + 2]!;
      const expected = srgbToValue({ r: r / 255, g: g / 255, b: b / 255 });
      const fast = rgbBytesToValue(r, g, b);
      const stored = (extracted.valueContinuous[i]! / 255) * 10;

      expect(fast).toBeCloseTo(expected, 5);
      expect(Math.abs(stored - expected)).toBeLessThan(0.05);

      // Perceptual grayscale must preserve CIELAB value (unlike naive sRGB byte weighting)
      const grayByte = rgbBytesToPerceptualGrayByte(r, g, b);
      const grayVal = rgbBytesToValue(grayByte, grayByte, grayByte);
      expect(Math.abs(grayVal - expected)).toBeLessThan(0.06);
    }
  });
});
