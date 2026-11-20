import type { CIELab, MixPart, MixRecipe, OKLab, Pigment } from "@/lib/types";
import { oklabToLab } from "@/lib/color/conversions";
import { deltaE2000 } from "@/lib/color/deltaE2000";
import { labLToValue } from "@/lib/color/valueScale";
import type { MixingEngine } from "./types";
import { defaultMixingEngine } from "./spectralAdapter";
import { generateRecipeNotes } from "./notes";

export type SolverOptions = {
  /** Extra penalty multiplier on value error vs hue error (default: 2.0). */
  valueWeight?: number;
  /** Number of top recipes to return (default: 3). */
  maxResults?: number;
  /** Prefer fewer pigments when two mixes are within this ΔE threshold (default: 1.5). */
  simplicityToleranceDE?: number;
  /** Swappable Kubelka-Munk engine (default: spectral.js adapter). */
  engine?: MixingEngine;
};

// Allowed discrete part quantities (0.25 = "trace", 1..10 = integer palette parts)
const TRACE_WEIGHT = 0.25;
const PART_LEVELS = [TRACE_WEIGHT, 1, 2, 3, 4, 5, 6, 8, 10] as const;

type EvaluatedMix = {
  pigments: Pigment[];
  weights: number[];
  result: OKLab;
  deltaE: number;
  valueDelta: number;
  score: number;
};

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Simplifies integer parts by dividing by their GCD.
 * When a trace (0.25) is present, integer parts are kept unscaled so the
 * trace-to-part ratio stays exact.
 */
export function normalizeParts(pigments: Pigment[], weights: number[]): MixPart[] {
  const active: { pigmentId: string; w: number }[] = [];
  for (let i = 0; i < pigments.length; i++) {
    const w = weights[i] ?? 0;
    const p = pigments[i];
    if (p && w > 0) {
      active.push({ pigmentId: p.id, w });
    }
  }

  const intWeights = active
    .filter((a) => a.w >= 1)
    .map((a) => Math.round(a.w));
  let divisor = intWeights[0] ?? 1;
  for (let i = 1; i < intWeights.length; i++) {
    divisor = gcd(divisor, intWeights[i] ?? 1);
  }
  if (divisor < 1) divisor = 1;

  // Keep integer weights unscaled whenever a trace is present so trace ratio is preserved
  const hasTrace = active.some((a) => a.w < 1);
  const effectiveDivisor = hasTrace ? 1 : divisor;

  const parts: MixPart[] = active.map((a) => {
    if (a.w < 1) {
      return { pigmentId: a.pigmentId, parts: TRACE_WEIGHT, isTrace: true };
    }
    return {
      pigmentId: a.pigmentId,
      parts: Math.max(1, Math.round(a.w / effectiveDivisor)),
    };
  });

  // Sort largest part first for clean reading at the easel
  parts.sort((a, b) => b.parts - a.parts);
  return parts;
}

function recipeSignature(parts: MixPart[]): string {
  return parts
    .map((p) => `${p.pigmentId}:${p.isTrace ? "T" : p.parts}`)
    .join("|");
}

/**
 * Quantized cache key for fast repeated lookups.
 */
function buildCacheKey(
  target: OKLab,
  pigments: Pigment[],
  valueWeight: number,
  simplicityToleranceDE: number,
  engineId: string
): string {
  const qL = Math.round(target.L * 100);
  const qA = Math.round(target.a * 200);
  const qB = Math.round(target.b * 200);
  const palKey = pigments
    .map((p) => p.id)
    .sort()
    .join(",");
  return `${engineId}|${palKey}|${valueWeight.toFixed(1)}|${simplicityToleranceDE.toFixed(2)}|${qL},${qA},${qB}`;
}

type CachedSolveEntry = {
  maxComputed: number;
  recipes: MixRecipe[];
};

const solverCache = new Map<string, CachedSolveEntry>();
const MAX_CACHE_ENTRIES = 2500;
const MIN_CACHED_RESULTS = 3;

export function clearSolverCache(): void {
  solverCache.clear();
}

export type ScoredRecipeCandidate = {
  recipe: MixRecipe;
  score: number;
};

/**
 * Deterministically ranks recipes using a strictly transitive sort by score,
 * then iteratively picks the simplest recipe (fewest pigments) within
 * `simplicityToleranceDE` of the best remaining candidate, preferring distinct
 * pigment sets.
 */
export function selectRankedRecipes(
  candidates: ScoredRecipeCandidate[],
  maxResults: number,
  simplicityToleranceDE: number
): MixRecipe[] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.recipe.parts.length - b.recipe.parts.length;
  });

  const picked: MixRecipe[] = [];
  const pickedSet = new Set<MixRecipe>();
  const seenPigmentSets = new Set<string>();

  const pigmentSetKey = (recipe: MixRecipe): string =>
    recipe.parts
      .map((p) => p.pigmentId)
      .sort()
      .join(",");

  const pickNext = (requireDistinctSet: boolean): boolean => {
    const eligible = sorted.filter(
      (item) =>
        !pickedSet.has(item.recipe) &&
        (!requireDistinctSet || !seenPigmentSets.has(pigmentSetKey(item.recipe)))
    );
    if (eligible.length === 0) return false;

    const bestScore = eligible[0]!.score;
    let chosen = eligible[0]!;
    for (const item of eligible) {
      if (item.score > bestScore + simplicityToleranceDE) break;
      if (item.recipe.parts.length < chosen.recipe.parts.length) {
        chosen = item;
      }
    }

    picked.push(chosen.recipe);
    pickedSet.add(chosen.recipe);
    seenPigmentSets.add(pigmentSetKey(chosen.recipe));
    return true;
  };

  while (picked.length < maxResults && pickNext(true)) {
    // Prefer distinct pigment sets for varied choices at the easel
  }
  while (picked.length < maxResults && pickNext(false)) {
    // Fallback fill if fewer than maxResults distinct pigment sets exist
  }

  return picked;
}

/**
 * Finds the top 1..3 physically-mixed oil paint recipes (1-3 chromatic pigments + optional white,
 * max 4 pigments total) in small integer parts + trace.
 */
export function solveMixRecipes(
  target: OKLab,
  availablePigments: Pigment[],
  options: SolverOptions = {}
): MixRecipe[] {
  if (availablePigments.length === 0) return [];

  const valueWeight = options.valueWeight ?? 2.0;
  const maxResults = Math.max(1, options.maxResults ?? 3);
  const simplicityToleranceDE = options.simplicityToleranceDE ?? 1.5;
  const engine = options.engine ?? defaultMixingEngine;

  const cacheKey = buildCacheKey(
    target,
    availablePigments,
    valueWeight,
    simplicityToleranceDE,
    engine.id
  );
  const cached = solverCache.get(cacheKey);
  if (cached && cached.maxComputed >= maxResults) {
    // Refresh LRU recency
    solverCache.delete(cacheKey);
    solverCache.set(cacheKey, cached);
    return cached.recipes.slice(0, maxResults);
  }

  const targetLab: CIELab = oklabToLab(target);
  const targetVal = labLToValue(targetLab.L);

  const isWhitePigment = (p: Pigment): boolean =>
    p.role === "white" || p.id === "titanium-white";
  const whites = availablePigments.filter(isWhitePigment);
  const primaryWhite = whites[0];
  const chromatics = availablePigments.filter((p) => !isWhitePigment(p));
  const pigmentById = new Map(availablePigments.map((p) => [p.id, p]));

  const evaluate = (pigments: Pigment[], weights: number[]): EvaluatedMix => {
    const inputs = pigments.map((pigment, idx) => ({
      pigment,
      weight: weights[idx] ?? 0,
    }));
    const result = engine.mix(inputs);
    const resLab = oklabToLab(result);
    const de = deltaE2000(resLab, targetLab);
    const valDelta = labLToValue(resLab.L) - targetVal;
    // Heavier penalty on value error (3.5 * valueWeight per 1.0 value step)
    const score = de + Math.abs(valDelta) * 3.5 * valueWeight;
    return { pigments, weights: [...weights], result, deltaE: de, valueDelta: valDelta, score };
  };

  /**
   * Coordinate-descent refinement over discrete integer parts + trace
   * for a fixed pigment subset (max 4 pigments).
   */
  const optimizeSubset = (subset: Pigment[], initialWeights?: number[]): EvaluatedMix => {
    const weights =
      initialWeights && initialWeights.length === subset.length
        ? [...initialWeights]
        : subset.map(() => 2);

    let best = evaluate(subset, weights);

    // Two sweeps of coordinate descent converge cleanly in ~15-30 evaluations
    for (let pass = 0; pass < 2; pass++) {
      let improved = false;
      for (let i = 0; i < subset.length; i++) {
        const orig = weights[i] ?? 1;
        let bestW = orig;
        for (const candidateW of PART_LEVELS) {
          if (candidateW === orig) continue;
          weights[i] = candidateW;
          const ev = evaluate(subset, weights);
          if (ev.score < best.score) {
            best = ev;
            bestW = candidateW;
            improved = true;
          }
        }
        weights[i] = bestW;
      }
      if (!improved) break;
    }

    return best;
  };

  const candidates: EvaluatedMix[] = [];
  const singleScores = new Map<string, number>();

  // 1. Single pigments (1 pigment)
  for (const p of availablePigments) {
    const ev = evaluate([p], [1]);
    candidates.push(ev);
    singleScores.set(p.id, ev.score);
  }

  // 2. Single chromatic + any available white pigment (2 pigments)
  for (const w of whites) {
    for (const c of chromatics) {
      const ev = optimizeSubset([w, c], [3, 1]);
      candidates.push(ev);
      const prev = singleScores.get(c.id) ?? Infinity;
      if (ev.score < prev) singleScores.set(c.id, ev.score);
    }
  }

  // For large custom libraries (>10 non-white tubes), keep the 10 most relevant
  // chromatics + earths/blacks so O(N^2) pair screening stays fast.
  let pairPool = chromatics;
  if (chromatics.length > 10) {
    const targetChroma = Math.hypot(target.a, target.b);
    const ranked = chromatics
      .map((p) => {
        const ok = engine.getPigmentOklab(p);
        // Dot-product alignment in OKLab (a,b) plane favors hue neighbors & complements
        const dot = target.a * ok.a + target.b * ok.b;
        const hueBonus =
          targetChroma > 0.02
            ? Math.abs(dot) / (targetChroma * Math.max(0.02, Math.hypot(ok.a, ok.b)))
            : 0;
        const baseScore = (singleScores.get(p.id) ?? 100) - hueBonus * 6;
        return { p, baseScore };
      })
      .sort((a, b) => a.baseScore - b.baseScore);
    pairPool = ranked.slice(0, 10).map((x) => x.p);
  }

  // 3. 2-chromatic pairs (with quick coarse screening, then optimize top pairs)
  const pairScores: Array<{
    pair: [Pigment, Pigment];
    score: number;
    withWhite: boolean;
  }> = [];
  const coarseWhiteWeights = primaryWhite ? [0, 2, 6] : [0];

  for (let i = 0; i < pairPool.length; i++) {
    const c1 = pairPool[i]!;
    for (let j = i + 1; j < pairPool.length; j++) {
      const c2 = pairPool[j]!;
      let bestPairScore = Infinity;
      let bestWithWhite = false;

      for (const wAmt of coarseWhiteWeights) {
        const subset = wAmt > 0 && primaryWhite ? [primaryWhite, c1, c2] : [c1, c2];
        const trials: number[][] =
          wAmt > 0
            ? [
                [wAmt, 2, 2],
                [wAmt, 4, 1],
                [wAmt, 1, 4],
              ]
            : [
                [2, 2],
                [4, 1],
                [1, 4],
              ];
        for (const w of trials) {
          const ev = evaluate(subset, w);
          if (ev.score < bestPairScore) {
            bestPairScore = ev.score;
            bestWithWhite = wAmt > 0;
          }
        }
      }

      pairScores.push({
        pair: [c1, c2],
        score: bestPairScore,
        withWhite: bestWithWhite,
      });
    }
  }

  pairScores.sort((a, b) => a.score - b.score);

  // Optimize top 8 chromatic pairs (both straight and + white if white is available)
  const topPairs = pairScores.slice(0, 8);
  for (const item of topPairs) {
    const [c1, c2] = item.pair;
    candidates.push(optimizeSubset([c1, c2], [2, 2]));
    for (const w of whites) {
      candidates.push(optimizeSubset([w, c1, c2], [3, 2, 1]));
    }
  }

  // 4. Promising 3-chromatic mixes (+ optional white = max 4 pigments)
  // Expand the best 3 pairs by adding a third chromatic pigment
  let bestSoFar = candidates.reduce((m, c) => Math.min(m, c.score), Infinity);
  const bestThirdBase = topPairs.slice(0, 3);
  const seenTriplets = new Set<string>();

  for (const item of bestThirdBase) {
    const [c1, c2] = item.pair;
    for (const c3 of pairPool) {
      if (c3.id === c1.id || c3.id === c2.id) continue;
      const key = [c1.id, c2.id, c3.id].sort().join(",");
      if (seenTriplets.has(key)) continue;
      seenTriplets.add(key);

      // Quick coarse check before full refinement
      const baseSubset =
        item.withWhite && primaryWhite ? [primaryWhite, c1, c2, c3] : [c1, c2, c3];
      const initW = item.withWhite && primaryWhite ? [3, 2, 2, 1] : [2, 2, 1];
      const probe = evaluate(baseSubset, initW);

      // Only refine triplets that beat or come close to the best mix so far
      if (probe.score < bestSoFar + 4.5) {
        const refined = optimizeSubset(baseSubset, initW);
        candidates.push(refined);
        if (refined.score < bestSoFar) bestSoFar = refined.score;
      }
    }
  }

  // 5. Deduplicate, sort by score with simpler-mix preference within ΔE 1.5
  const bySig = new Map<string, { recipe: MixRecipe; score: number }>();

  for (const c of candidates) {
    const parts = normalizeParts(c.pigments, c.weights);
    if (parts.length === 0 || parts.length > 4) continue;
    const sig = recipeSignature(parts);
    const existing = bySig.get(sig);
    if (existing && existing.score <= c.score) continue;

    bySig.set(sig, {
      score: c.score,
      recipe: {
        target,
        parts,
        result: c.result,
        deltaE2000: c.deltaE,
        valueDelta: c.valueDelta,
        notes: generateRecipeNotes(parts, pigmentById, c.deltaE, c.valueDelta),
      },
    });
  }

  const unique = Array.from(bySig.values());
  const cacheLimit = Math.max(MIN_CACHED_RESULTS, maxResults);
  const ranked = selectRankedRecipes(unique, cacheLimit, simplicityToleranceDE);

  if (solverCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = solverCache.keys().next().value;
    if (firstKey !== undefined) solverCache.delete(firstKey);
  }
  solverCache.set(cacheKey, { maxComputed: cacheLimit, recipes: ranked });

  return ranked.slice(0, maxResults);
}
