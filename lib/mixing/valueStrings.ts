import type { KeyColor, MixRecipe, OKLab } from "@/lib/types";
import { oklabToHex, oklabToOklch, oklchToOklab } from "@/lib/color/conversions";
import { oklabToValue } from "@/lib/color/valueScale";

export type ValueStringStep = {
  targetOklab: OKLab;
  targetHex: string;
  value: number; // 0..10
  recipe?: MixRecipe;
};

export type ValueStringFamily = {
  id: string;
  name: string;
  coverage: number; // combined % of image
  firstStageId: string;
  steps: ValueStringStep[]; // ordered dark -> light
};

type FamilyBucket = {
  id: string;
  name: string;
  colors: KeyColor[];
};

function classifyFamily(kc: KeyColor): { id: string; name: string } {
  const lch = oklabToOklch(kc.oklab);
  if (lch.C < 0.032) {
    return { id: "neutrals", name: "Neutrals & Grays" };
  }
  const h = lch.h;
  if (h >= 15 && h < 68) {
    return { id: "warm-reds", name: "Warm Reds & Terracotta" };
  }
  if (h >= 68 && h < 118) {
    return { id: "ochres-yellows", name: "Ochres & Golds" };
  }
  if (h >= 118 && h < 195) {
    return { id: "greens", name: "Greens & Foliage" };
  }
  if (h >= 195 && h < 285) {
    return { id: "blues", name: "Blues & Cool Shadows" };
  }
  return { id: "violets-crimsons", name: "Crimsons & Violets" };
}

/**
 * Builds alla prima premix value strings (up to 5 steps dark -> light per major color family)
 * from the image's extracted k-means key colors.
 */
export function buildValueStringTargets(
  keyColors: KeyColor[]
): ValueStringFamily[] {
  const bucketMap = new Map<string, FamilyBucket>();

  for (const kc of keyColors) {
    const fam = classifyFamily(kc);
    const existing = bucketMap.get(fam.id);
    if (existing) {
      existing.colors.push(kc);
    } else {
      bucketMap.set(fam.id, { id: fam.id, name: fam.name, colors: [kc] });
    }
  }

  // Sort families by total image coverage and keep top 4 most important families
  const buckets = Array.from(bucketMap.values())
    .map((b) => ({
      ...b,
      coverage: b.colors.reduce((s, c) => s + c.coverage, 0),
    }))
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, 4);

  const families: ValueStringFamily[] = [];

  for (const b of buckets) {
    // Weighted average chroma & hue of this family
    let totalCov = 0;
    let sumA = 0;
    let sumB = 0;
    let minL = 1;
    let maxL = 0;
    let firstStageId = "develop-forms";

    for (const c of b.colors) {
      totalCov += c.coverage;
      sumA += c.oklab.a * c.coverage;
      sumB += c.oklab.b * c.coverage;
      if (c.oklab.L < minL) minL = c.oklab.L;
      if (c.oklab.L > maxL) maxL = c.oklab.L;
      if (c.firstStageId === "color-block-in") {
        firstStageId = "color-block-in";
      }
    }

    const avgA = sumA / Math.max(1e-4, totalCov);
    const avgB = sumB / Math.max(1e-4, totalCov);
    const baseLch = oklabToOklch({ L: 0.55, a: avgA, b: avgB });

    // Span a realistic 5-step dark -> light string across the family's observed value range
    const loL = Math.max(0.22, Math.min(minL, 0.34));
    const hiL = Math.min(0.92, Math.max(maxL, 0.78));
    const stepCount = 5;

    const steps: ValueStringStep[] = [];
    for (let i = 0; i < stepCount; i++) {
      const u = i / (stepCount - 1);
      const L = loL + (hiL - loL) * u;
      // Gently taper chroma at very dark and very light ends (matches real oil paint)
      const chromaScale = 1 - Math.pow((u - 0.5) * 1.4, 2) * 0.45;
      const targetOklab: OKLab = oklchToOklab({
        L,
        C: Math.max(0, baseLch.C * Math.max(0.35, chromaScale)),
        h: baseLch.h,
      });

      steps.push({
        targetOklab,
        targetHex: oklabToHex(targetOklab),
        value: oklabToValue(targetOklab),
      });
    }

    families.push({
      id: b.id,
      name: b.name,
      coverage: b.coverage,
      firstStageId,
      steps,
    });
  }

  return families;
}
