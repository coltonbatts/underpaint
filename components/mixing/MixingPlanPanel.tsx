"use client";

import { useState } from "react";
import { ArrowRight, Eye, Loader2, X } from "lucide-react";
import type { ImageAnalysis, MixPart, MixRecipe, ProcessStage } from "@/lib/types";
import type { ValueStringFamily } from "@/lib/mixing/valueStrings";
import { useViewportStore } from "@/lib/store/viewportStore";
import { oklabToHex } from "@/lib/color/conversions";
import { getPigmentSwatchHex, PIGMENT_MAP } from "@/lib/data/pigments";

interface MixingPlanPanelProps {
  stageIndex: number;
  stage: ProcessStage;
  analysis: ImageAnalysis | undefined;
  groundHex: string;
  solving: boolean;
  valueStrings: ValueStringFamily[];
  keyColorRecipes: MixRecipe[] | null;
  onIsolateValue: (val: number | null) => void;
  onJumpToColorStep?: () => void;
}

const TONE_LABELS = ["Dark", "Mid-Dark", "Mid", "Light", "Bright"];

function formatPartAmount(part: MixPart): string {
  if (part.isTrace) return "tiny dab";
  return `${part.parts} ${part.parts === 1 ? "part" : "parts"}`;
}

function formatRecipePlain(recipe: MixRecipe): string {
  return recipe.parts
    .map((p) => {
      const name = PIGMENT_MAP[p.pigmentId]?.name ?? p.pigmentId;
      const short = name
        .replace("Titanium White", "White")
        .replace("Cadmium ", "Cad ")
        .replace("Ultramarine Blue", "Ultramarine")
        .replace("Alizarin Crimson", "Alizarin");
      return p.isTrace ? `tiny dab ${short}` : `${p.parts} ${short}`;
    })
    .join(" + ");
}

function describeLightness(val: number): string {
  if (val < 2.2) return "Deep dark";
  if (val < 4.2) return "Dark tone";
  if (val < 6.0) return "Midtone";
  if (val < 7.8) return "Light tone";
  return "Bright light";
}

export function MixingPlanPanel({
  stageIndex,
  stage,
  analysis,
  groundHex,
  solving,
  valueStrings,
  keyColorRecipes,
  onIsolateValue,
  onJumpToColorStep,
}: MixingPlanPanelProps) {
  const proMode = useViewportStore((s) => s.proMode);
  const stripMarkerValue = useViewportStore((s) => s.stripMarkerValue);
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(null);
  const [previewEarly, setPreviewEarly] = useState(false);

  if (!analysis) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Preparing your main paint colors…
      </p>
    );
  }

  const isMonochromeStep =
    stageIndex < 2 ||
    stage.id === "toned-ground" ||
    stage.id === "monochrome-block-in" ||
    stage.id === "drawing" ||
    stage.id === "prepared-canvas";

  if (isMonochromeStep && !previewEarly) {
    return (
      <div className="space-y-4 text-[14px]">
        <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <div className="flex items-center gap-3">
            <span
              className="h-11 w-11 shrink-0 rounded-[var(--radius-sm)] border border-white/15 shadow-sm"
              style={{ backgroundColor: groundHex }}
            />
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                Just One Earth Color Right Now
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Step {stageIndex + 1} &middot; {stage.name}
              </p>
            </div>
          </div>

          <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
            No color mixing needed yet! For Steps 1 and 2, stick with a single
            warm brown paint (like Burnt Umber or Burnt Sienna) thinned with
            odorless mineral spirits (paint thinner).
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {onJumpToColorStep && (
            <button
              type="button"
              onClick={onJumpToColorStep}
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#141210] transition-colors hover:bg-[var(--accent-hover)]"
            >
              Jump to Step 3: Big Color Shapes
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setPreviewEarly(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview main colors anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-[14px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Main Colors to Premix
          </h3>
          <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
            Click any swatch to see its tube recipe and where it sits on your
            painting.
          </p>
        </div>
        {solving && (
          <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-[var(--accent)]" />
        )}
      </div>

      {/* Clear highlight pill when a value is isolated on the canvas */}
      {stripMarkerValue !== null && (
        <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--accent)]/40 bg-[var(--accent-muted)] px-3 py-2 text-xs text-[var(--text-primary)]">
          <span>Highlighting matching brightness on canvas</span>
          <button
            type="button"
            onClick={() => {
              onIsolateValue(null);
              setSelectedStepKey(null);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2 py-0.5 font-medium text-[var(--accent)] hover:bg-[var(--bg-elevated)]"
          >
            Clear
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Color Family Swatch Strips */}
      {valueStrings.length === 0 && solving ? (
        <p className="text-sm text-[var(--text-muted)]">
          Building your main paint piles…
        </p>
      ) : (
        <div className="space-y-3.5">
          {valueStrings.map((fam) => {
            const activeStepIdx = fam.steps.findIndex(
              (_, i) => selectedStepKey === `${fam.id}:${i}`
            );
            const activeStep =
              activeStepIdx >= 0 ? fam.steps[activeStepIdx] : null;

            return (
              <div
                key={fam.id}
                className="space-y-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                    {fam.name}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    ~{Math.round(fam.coverage)}% of painting
                  </span>
                </div>

                {/* 5-step dark -> light large swatches */}
                <div className="grid grid-cols-5 gap-1.5">
                  {fam.steps.map((step, i) => {
                    const key = `${fam.id}:${i}`;
                    const isSelected = selectedStepKey === key;
                    const displayHex = step.recipe
                      ? oklabToHex(step.recipe.result)
                      : step.targetHex;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStepKey(null);
                            onIsolateValue(null);
                          } else {
                            setSelectedStepKey(key);
                            onIsolateValue(Math.round(step.value * 10) / 10);
                          }
                        }}
                        title={`${TONE_LABELS[i] ?? `Tone ${i + 1}`} — click for paint mix`}
                        className={`group flex flex-col overflow-hidden rounded-[8px] border transition-all ${
                          isSelected
                            ? "border-[var(--accent)] ring-2 ring-[var(--accent-ring)]"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <span
                          className="block h-9 w-full"
                          style={{ backgroundColor: displayHex }}
                        />
                        <span className="bg-[var(--bg-surface)] py-1 text-center text-[10px] font-medium text-[var(--text-secondary)]">
                          {proMode
                            ? step.value.toFixed(1)
                            : TONE_LABELS[i] ?? `Tone ${i + 1}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Expanded plain-English recipe for clicked swatch */}
                {activeStep?.recipe && (
                  <div className="space-y-2 border-t border-[var(--border-subtle)] pt-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--accent)]">
                        {TONE_LABELS[activeStepIdx] ?? "Selected"} Mix
                      </span>
                      {proMode && (
                        <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                          Val {activeStep.value.toFixed(1)} &middot; &Delta;E{" "}
                          {activeStep.recipe.deltaE2000.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {activeStep.recipe.parts.map((part) => {
                        const pig = PIGMENT_MAP[part.pigmentId];
                        return (
                          <div
                            key={part.pigmentId}
                            className="flex items-center justify-between text-[13px]"
                          >
                            <span className="inline-flex items-center gap-2 text-[var(--text-primary)]">
                              <span
                                className="h-3.5 w-3.5 rounded-[4px] border border-white/15"
                                style={{
                                  backgroundColor: pig
                                    ? getPigmentSwatchHex(pig)
                                    : "#888",
                                }}
                              />
                              {pig?.name ?? part.pigmentId}
                            </span>
                            <span className="font-medium text-[var(--accent)]">
                              {formatPartAmount(part)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Key Color Piles */}
      <div className="space-y-2.5 border-t border-[var(--border-subtle)] pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Quick Reference Swatches
        </h4>
        <div className="space-y-2">
          {analysis.keyColors.map((kc, idx) => {
            const recipe = keyColorRecipes?.[idx];
            const mixedHex = recipe ? oklabToHex(recipe.result) : kc.hex;
            return (
              <button
                key={`${kc.hex}-${idx}`}
                type="button"
                onClick={() => onIsolateValue(Math.round(kc.value * 10) / 10)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
              >
                <div className="flex h-10 w-12 shrink-0 overflow-hidden rounded-[8px] border border-white/15">
                  <span
                    className="flex-1"
                    style={{ backgroundColor: kc.hex }}
                    title="Photo color"
                  />
                  <span
                    className="flex-1"
                    style={{ backgroundColor: mixedHex }}
                    title="Paint mix"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {describeLightness(kc.value)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {Math.round(kc.coverage)}%
                      {proMode && recipe
                        ? ` · ΔE ${recipe.deltaE2000.toFixed(1)}`
                        : ""}
                    </span>
                  </div>
                  {recipe && (
                    <p className="text-xs leading-snug text-[var(--text-secondary)]">
                      {formatRecipePlain(recipe)}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
