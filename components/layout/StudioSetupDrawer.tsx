"use client";

import { useEffect, useRef } from "react";
import { ArrowLeftRight, Crop, Frame, X } from "lucide-react";
import { CANVAS_SIZE_PRESETS, type Project } from "@/lib/types";
import { useProjectStore } from "@/lib/store/projectStore";
import { useViewportStore } from "@/lib/store/viewportStore";
import { PaletteEditor } from "@/components/mixing/PaletteEditor";

interface StudioSetupDrawerProps {
  project: Project;
  open: boolean;
  onClose: () => void;
}

export function StudioSetupDrawer({
  project,
  open,
  onClose,
}: StudioSetupDrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const updateCanvasSize = useProjectStore((s) => s.updateCanvasSize);
  const swapOrientation = useProjectStore((s) => s.swapOrientation);
  const updateGroundColor = useProjectStore((s) => s.updateGroundColor);
  const updatePalette = useProjectStore((s) => s.updatePalette);
  const updateCustomPigments = useProjectStore((s) => s.updateCustomPigments);

  const cropMode = useViewportStore((s) => s.cropMode);
  const toggleCropMode = useViewportStore((s) => s.toggleCropMode);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const groundHex =
    project.canvas.groundColor ??
    project.analysis?.suggestedGroundColor ??
    "#9c7a5b";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-setup-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Subtle backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="flex-1 bg-black/50 backdrop-blur-[2px]"
      />

      {/* Slide-over drawer */}
      <div className="flex h-full w-full max-w-[380px] flex-col border-l border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-float)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2
              id="studio-setup-title"
              className="text-base font-semibold text-[var(--text-primary)]"
            >
              Canvas &amp; Palette
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Match your real canvas size, wash tone, and paint tubes
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Canvas Size & Crop */}
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <Frame className="h-4 w-4 text-[var(--accent)]" />
                Canvas Size
              </h3>
              <button
                type="button"
                onClick={() => void swapOrientation()}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Flip Portrait / Landscape
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {CANVAS_SIZE_PRESETS.map((preset) => {
                const isMatch =
                  (project.canvas.widthIn === preset.widthIn &&
                    project.canvas.heightIn === preset.heightIn) ||
                  (project.canvas.widthIn === preset.heightIn &&
                    project.canvas.heightIn === preset.widthIn);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      const isLandscape =
                        project.canvas.widthIn >= project.canvas.heightIn;
                      const w = isLandscape
                        ? Math.max(preset.widthIn, preset.heightIn)
                        : Math.min(preset.widthIn, preset.heightIn);
                      const h = isLandscape
                        ? Math.min(preset.widthIn, preset.heightIn)
                        : Math.max(preset.widthIn, preset.heightIn);
                      void updateCanvasSize(w, h);
                    }}
                    className={`rounded-[var(--radius-sm)] border px-2.5 py-2 text-[13px] font-medium transition-colors ${
                      isMatch
                        ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--text-primary)]"
                        : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="block text-xs text-[var(--text-muted)]">
                  Width (inches)
                </span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  step={0.5}
                  value={project.canvas.widthIn}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v > 0) {
                      void updateCanvasSize(v, project.canvas.heightIn);
                    }
                  }}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs text-[var(--text-muted)]">
                  Height (inches)
                </span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  step={0.5}
                  value={project.canvas.heightIn}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v > 0) {
                      void updateCanvasSize(project.canvas.widthIn, v);
                    }
                  }}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                toggleCropMode();
                onClose();
              }}
              className={`flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border px-4 py-2.5 text-sm font-medium transition-colors ${
                cropMode
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[#141210]"
                  : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <Crop className="h-4 w-4" />
              {cropMode ? "Finish Adjusting Crop" : "Adjust Photo Crop"}
            </button>

            {/* Toned Canvas Base Wash */}
            <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-3">
              <div className="space-y-0.5 pr-3">
                <span className="block text-[13.5px] font-medium text-[var(--text-primary)]">
                  Step 1 Canvas Wash Color
                </span>
                <span className="block text-xs text-[var(--text-muted)]">
                  The thin warm brown stain you start with
                </span>
              </div>
              <label className="relative h-9 w-12 shrink-0 cursor-pointer overflow-hidden rounded-[8px] border border-[var(--border-strong)]">
                <input
                  type="color"
                  value={groundHex}
                  onChange={(e) => void updateGroundColor(e.target.value)}
                  aria-label="Choose Step 1 canvas wash color"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span
                  className="block h-full w-full"
                  style={{ backgroundColor: groundHex }}
                />
              </label>
            </div>
          </section>

          {/* Paint Tubes */}
          <PaletteEditor
            paletteId={project.palette}
            customPigmentIds={project.customPigmentIds}
            onSelectPreset={(id) => void updatePalette(id)}
            onUpdateCustom={(ids) => void updateCustomPigments(ids)}
          />
        </div>
      </div>
    </div>
  );
}
