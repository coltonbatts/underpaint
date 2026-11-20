"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProcessPreset } from "@/lib/types";
import { getStageSnapValue, resolveSliderPosition } from "@/lib/presets";
import { useViewportStore } from "@/lib/store/viewportStore";

interface ProcessSliderProps {
  preset: ProcessPreset;
  disabled?: boolean;
}

export function ProcessSlider({ preset, disabled = false }: ProcessSliderProps) {
  const sliderValue = useViewportStore((s) => s.sliderValue);
  const setSliderValue = useViewportStore((s) => s.setSliderValue);
  const proMode = useViewportStore((s) => s.proMode);

  const resolved = resolveSliderPosition(preset, sliderValue);
  const totalSteps = preset.stages.length;
  const currentIdx = resolved.stageIndex;
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === totalSteps - 1;

  const goToStep = (idx: number) => {
    setSliderValue(getStageSnapValue(preset, idx));
  };

  const progressPct =
    totalSteps > 1 ? (currentIdx / (totalSteps - 1)) * 100 : 100;

  return (
    <footer className="shrink-0 select-none border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-3.5">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        {/* Main 5-Step Progress Row + Prev / Next Controls */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={disabled || isFirst}
            onClick={() => goToStep(currentIdx - 1)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* 5-Step Progress Bar */}
          <div className="relative flex flex-1 items-center justify-between px-2">
            {/* Background & filled track */}
            <div className="pointer-events-none absolute left-6 right-6 top-4 h-[2px] rounded-full bg-[var(--border-default)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {preset.stages.map((stage, i) => {
              const isActive = i === currentIdx;
              const isCompleted = i < currentIdx;

              return (
                <button
                  key={stage.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => goToStep(i)}
                  aria-current={isActive ? "step" : undefined}
                  title={`Step ${i + 1}: ${stage.name}`}
                  className="group relative z-10 flex flex-col items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-0.5 transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? "scale-105 border-[var(--accent)] bg-[var(--accent)] text-[#141210] shadow-[0_0_0_4px_var(--accent-muted)]"
                        : isCompleted
                          ? "border-[var(--accent)] bg-[var(--bg-elevated)] text-[var(--accent)] group-hover:bg-[var(--accent-muted)]"
                          : "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)] group-hover:border-[var(--border-strong)] group-hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    ) : (
                      i + 1
                    )}
                  </span>

                  <span
                    className={`hidden whitespace-nowrap text-[12px] transition-colors md:block ${
                      isActive
                        ? "font-semibold text-[var(--text-primary)]"
                        : isCompleted
                          ? "font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {stage.name}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={disabled || isLast}
            onClick={() => goToStep(currentIdx + 1)}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              isLast
                ? "border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                : "bg-[var(--accent)] text-[#141210] hover:bg-[var(--accent-hover)]"
            }`}
          >
            <span className="hidden sm:inline">
              {isLast ? "Final Step" : "Next Step"}
            </span>
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {/* Optional Pro Mode smooth scrub slider */}
        {proMode && (
          <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] pt-2.5">
            <span className="shrink-0 text-xs font-medium text-[var(--text-muted)]">
              Smooth Scrub
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              disabled={disabled}
              value={sliderValue}
              onChange={(e) => setSliderValue(parseFloat(e.target.value))}
              aria-label="Smooth stage scrub slider"
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--bg-elevated)] accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="w-11 shrink-0 text-right font-mono-num text-xs text-[var(--text-secondary)]">
              {Math.round(sliderValue)}%
            </span>
          </div>
        )}
      </div>
    </footer>
  );
}
