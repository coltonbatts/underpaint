"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import type { MixPart, MixRecipe, Pigment } from "@/lib/types";
import type { InspectedPixel } from "@/lib/store/viewportStore";
import { useViewportStore } from "@/lib/store/viewportStore";
import { oklabToHex, oklabToOklch } from "@/lib/color/conversions";
import { oklabToValue } from "@/lib/color/valueScale";
import { getPigmentSwatchHex, PIGMENT_MAP } from "@/lib/data/pigments";
import { solveColorInWorker } from "@/lib/mixing/runMixing";
import { ValueCheckCard } from "./ValueCheckCard";

interface ColorInspectorProps {
  pixel: InspectedPixel;
  pigments: Pigment[];
  valueWeight: number;
  onClose: () => void;
}

const STAGE_NAMES: Record<string, string> = {
  "toned-ground": "Step 1 · Tone Canvas",
  drawing: "Step 2 · Sketch & Shadows",
  "monochrome-block-in": "Step 2 · Sketch & Shadows",
  "color-block-in": "Step 3 · Big Color Shapes",
  "develop-forms": "Step 4 · Build Form",
  "refinement-edges": "Step 4 · Build Form",
  "accents-highlights": "Step 5 · Final Highlights",
};

function formatPartAmount(part: MixPart): string {
  if (part.isTrace) return "tiny dab";
  return `${part.parts} ${part.parts === 1 ? "part" : "parts"}`;
}

function formatPlainNote(note: string): string {
  // Strip parenthetical technical ΔE codes from plain-English tips
  return note.replace(/\s*\(ΔE[^)]*\)/g, "");
}

export function ColorInspector({
  pixel,
  pigments,
  valueWeight,
  onClose,
}: ColorInspectorProps) {
  const proMode = useViewportStore((s) => s.proMode);
  const [recipes, setRecipes] = useState<MixRecipe[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [solving, setSolving] = useState(true);
  const [solveMs, setSolveMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSolving(true);
    setError(null);
    setSelectedIdx(0);

    void solveColorInWorker(pixel.oklab, pigments, valueWeight)
      .then(({ recipes: res, durationMs }) => {
        if (cancelled) return;
        setRecipes(res);
        setSolveMs(durationMs);
        setSolving(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not find a paint mix.");
        setSolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pixel.oklab, pigments, valueWeight]);

  const lch = oklabToOklch(pixel.oklab);
  const activeRecipe = recipes[selectedIdx] ?? recipes[0];
  const activeMixedHex = activeRecipe ? oklabToHex(activeRecipe.result) : pixel.hex;
  const totalWeight = activeRecipe
    ? activeRecipe.parts.reduce((sum, p) => sum + p.parts, 0)
    : 0;

  return (
    <div className="w-[356px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[var(--shadow-float)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
            How to Mix This Color
          </h3>
          <p className="text-xs text-[var(--accent)]">
            Best painted in{" "}
            {STAGE_NAMES[pixel.firstStageId] ?? "Step 3 · Big Color Shapes"}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close color recipe"
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="max-h-[68vh] space-y-4 overflow-y-auto p-4">
        {/* Large side-by-side Photo Color vs Your Paint Mix swatches */}
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)]">
          <div className="flex h-20 w-full">
            <div
              className="flex flex-1 items-end p-2.5"
              style={{ backgroundColor: pixel.hex }}
            >
              <span className="rounded-md bg-black/65 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-xs">
                Photo Color
              </span>
            </div>
            <div
              className="flex flex-1 items-end justify-end p-2.5"
              style={{ backgroundColor: activeMixedHex }}
            >
              <span className="rounded-md bg-black/65 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-xs">
                Your Paint Mix
              </span>
            </div>
          </div>
        </div>

        {solving ? (
          <div className="flex items-center gap-2.5 py-4 text-sm text-[var(--text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
            Finding the best paint mix…
          </div>
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : !activeRecipe ? (
          <p className="text-sm text-[var(--text-muted)]">
            No mix found with your current paint tubes.
          </p>
        ) : (
          <>
            {/* Proportional paint bar + Plain-English recipe */}
            <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Paint Recipe
                  {selectedIdx > 0 ? ` (Option #${selectedIdx + 1})` : ""}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {activeRecipe.parts.length}{" "}
                  {activeRecipe.parts.length === 1 ? "tube" : "tubes"}
                </span>
              </div>

              {/* Visual proportional bar */}
              <div className="flex h-3.5 w-full overflow-hidden rounded-full border border-white/10 bg-[var(--bg-canvas)]">
                {activeRecipe.parts.map((part) => {
                  const pig = PIGMENT_MAP[part.pigmentId];
                  const pct =
                    totalWeight > 0 ? (part.parts / totalWeight) * 100 : 0;
                  return (
                    <div
                      key={part.pigmentId}
                      title={`${formatPartAmount(part)} ${pig?.name ?? part.pigmentId}`}
                      style={{
                        width: `${Math.max(5, pct)}%`,
                        backgroundColor: pig
                          ? getPigmentSwatchHex(pig)
                          : "#888",
                      }}
                    />
                  );
                })}
              </div>

              {/* Readable ingredient list */}
              <ul className="space-y-2 pt-0.5">
                {activeRecipe.parts.map((part) => {
                  const pig = PIGMENT_MAP[part.pigmentId];
                  return (
                    <li
                      key={part.pigmentId}
                      className="flex items-center justify-between gap-2 text-[14px]"
                    >
                      <span className="inline-flex items-center gap-2.5 font-medium text-[var(--text-primary)]">
                        <span
                          className="h-4 w-4 shrink-0 rounded-[4px] border border-white/15"
                          style={{
                            backgroundColor: pig
                              ? getPigmentSwatchHex(pig)
                              : "#888",
                          }}
                        />
                        {pig?.name ?? part.pigmentId}
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--bg-surface)] px-2.5 py-0.5 text-[13px] font-semibold text-[var(--accent)]">
                        {formatPartAmount(part)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Friendly Lightness / Value Check */}
            <ValueCheckCard
              targetValue={pixel.value}
              mixedValue={oklabToValue(activeRecipe.result)}
            />

            {/* Practical studio tips */}
            {activeRecipe.notes.length > 0 && (
              <ul className="space-y-1.5 rounded-[var(--radius-md)] bg-[var(--bg-elevated)]/60 px-3.5 py-2.5 text-[13px] leading-snug text-[var(--text-secondary)]">
                {activeRecipe.notes.map((note, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[var(--accent)]">&bull;</span>
                    <span>{proMode ? note : formatPlainNote(note)}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Collapsible "More options & color stats" */}
            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70">
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <span>More options &amp; color stats</span>
                {showMore ? (
                  <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                )}
              </button>

              {showMore && (
                <div className="space-y-3 border-t border-[var(--border-subtle)] px-3.5 py-3">
                  {/* Alternative recipes */}
                  {recipes.length > 1 && (
                    <div className="space-y-2">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Alternative Mixes
                      </span>
                      <div className="space-y-1.5">
                        {recipes.map((recipe, idx) => {
                          const mixedHex = oklabToHex(recipe.result);
                          const isSelected = idx === selectedIdx;
                          const summary = recipe.parts
                            .map((p) => {
                              const name =
                                PIGMENT_MAP[p.pigmentId]?.name ?? p.pigmentId;
                              return `${formatPartAmount(p)} ${name}`;
                            })
                            .join(", ");

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedIdx(idx)}
                              className={`flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border p-2 text-left transition-colors ${
                                isSelected
                                  ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                                  : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-default)]"
                              }`}
                            >
                              <span
                                className="h-6 w-6 shrink-0 rounded-[4px] border border-white/15"
                                style={{ backgroundColor: mixedHex }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between text-xs font-medium text-[var(--text-primary)]">
                                  <span>Mix #{idx + 1}</span>
                                  <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                                    &Delta;E {recipe.deltaE2000.toFixed(1)}
                                  </span>
                                </div>
                                <p className="text-xs leading-snug text-[var(--text-secondary)]">
                                  {summary}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Technical Color Stats */}
                  <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-2.5 font-mono-num text-xs text-[var(--text-secondary)]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Hex</span>
                      <span>{pixel.hex.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Value (0–10)</span>
                      <span>
                        {pixel.value.toFixed(1)} (&Delta;V{" "}
                        {activeRecipe.valueDelta >= 0 ? "+" : ""}
                        {activeRecipe.valueDelta.toFixed(2)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Match (&Delta;E2000)</span>
                      <span>{activeRecipe.deltaE2000.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">OKLCH</span>
                      <span>
                        {lch.L.toFixed(2)} / {lch.C.toFixed(3)} /{" "}
                        {Math.round(lch.h)}&deg;
                      </span>
                    </div>
                    {solveMs !== null && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Solve time</span>
                        <span>{solveMs}ms</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
