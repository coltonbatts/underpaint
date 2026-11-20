"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Crosshair,
  Layers,
  Loader2,
  Palette,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { Project } from "@/lib/types";
import type { ValueStepCount } from "@/lib/color/valueScale";
import {
  getPreset,
  getStageSnapValue,
  resolveSliderPosition,
} from "@/lib/presets";
import { getActivePigments } from "@/lib/data/palettes";
import { useProjectStore } from "@/lib/store/projectStore";
import { useViewportStore } from "@/lib/store/viewportStore";
import { useMixingStore } from "@/lib/store/mixingStore";
import { StudioSetupDrawer } from "./StudioSetupDrawer";
import { CanvasView } from "@/components/canvas/CanvasView";
import { ValueStrip } from "@/components/canvas/ValueStrip";
import { ProcessSlider } from "@/components/process/ProcessSlider";
import { StageGuidanceCard } from "@/components/process/StageGuidanceCard";
import { MixingPlanPanel } from "@/components/mixing/MixingPlanPanel";

interface WorkspaceShellProps {
  project: Project;
}

type RightTab = "guide" | "colors";

export function WorkspaceShell({ project }: WorkspaceShellProps) {
  const [rightTab, setRightTab] = useState<RightTab>("guide");
  const [setupOpen, setSetupOpen] = useState(false);
  const [guideDrawerOpen, setGuideDrawerOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const advancedPopoverRef = useRef<HTMLDivElement>(null);

  const analyzing = useProjectStore((s) => s.analyzing);
  const analysisError = useProjectStore((s) => s.analysisError);
  const analysisPercent = useProjectStore((s) => s.analysisPercent);
  const analyzeProject = useProjectStore((s) => s.analyzeProject);
  const updateName = useProjectStore((s) => s.updateName);

  const sliderValue = useViewportStore((s) => s.sliderValue);
  const setSliderValue = useViewportStore((s) => s.setSliderValue);
  const proMode = useViewportStore((s) => s.proMode);
  const toggleProMode = useViewportStore((s) => s.toggleProMode);
  const resetForProject = useViewportStore((s) => s.resetForProject);
  const valueMapSteps = useViewportStore((s) => s.valueMapSteps);
  const setValueMapSteps = useViewportStore((s) => s.setValueMapSteps);
  const canvasWeave = useViewportStore((s) => s.canvasWeave);
  const toggleCanvasWeave = useViewportStore((s) => s.toggleCanvasWeave);
  const showAchievable = useViewportStore((s) => s.showAchievable);
  const toggleShowAchievable = useViewportStore((s) => s.toggleShowAchievable);
  const showGamutWarning = useViewportStore((s) => s.showGamutWarning);
  const toggleShowGamutWarning = useViewportStore(
    (s) => s.toggleShowGamutWarning
  );
  const cropMode = useViewportStore((s) => s.cropMode);
  const focalPointMode = useViewportStore((s) => s.focalPointMode);
  const setFocalPointMode = useViewportStore((s) => s.setFocalPointMode);
  const toggleGrayscale = useViewportStore((s) => s.toggleGrayscale);
  const toggleSquint = useViewportStore((s) => s.toggleSquint);
  const cycleValueMap = useViewportStore((s) => s.cycleValueMap);
  const toggleGrid = useViewportStore((s) => s.toggleGrid);
  const setCropMode = useViewportStore((s) => s.setCropMode);
  const setStripMarkerValue = useViewportStore((s) => s.setStripMarkerValue);
  const setInspectedPixel = useViewportStore((s) => s.setInspectedPixel);
  const setPeekSource = useViewportStore((s) => s.setPeekSource);
  const valueWeight = useViewportStore((s) => s.valueWeight);

  const solvingMixing = useMixingStore((s) => s.solving);
  const valueStrings = useMixingStore((s) => s.valueStrings);
  const keyColorRecipes = useMixingStore((s) => s.keyColorRecipes);
  const outOfGamutPercent = useMixingStore((s) => s.outOfGamutPercent);
  const solveForProject = useMixingStore((s) => s.solveForProject);

  const preset = getPreset(project.processPresetId);
  const resolved = resolveSliderPosition(preset, sliderValue);

  // Sync draft title when project changes
  useEffect(() => {
    setNameDraft(project.name);
  }, [project.name]);

  // Reset to Step 1 whenever a new study opens
  useEffect(() => {
    resetForProject();
  }, [project.id, resetForProject]);

  // Close Advanced popover when clicking outside
  useEffect(() => {
    if (!advancedOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        advancedPopoverRef.current &&
        !advancedPopoverRef.current.contains(e.target as Node)
      ) {
        setAdvancedOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [advancedOpen]);

  // Automatically analyze when analysis is missing and user isn't mid-crop
  useEffect(() => {
    if (!project.analysis && !cropMode && !analyzing && !analysisError) {
      void analyzeProject(false);
    }
  }, [project.analysis, cropMode, analyzing, analysisError, analyzeProject]);

  // Automatically solve achievable segment colors + value strings whenever analysis or palette changes
  useEffect(() => {
    if (!project.analysis) return;
    const pigments = getActivePigments(
      project.palette,
      project.customPigmentIds
    );
    void solveForProject(project.id, project.analysis, pigments, valueWeight);
  }, [
    project.id,
    project.analysis,
    project.palette,
    project.customPigmentIds,
    valueWeight,
    solveForProject,
  ]);

  // Studio keyboard shortcuts
  useEffect(() => {
    const isEditable = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      return Boolean(
        el &&
          (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.isContentEditable)
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey && proMode) {
          setSliderValue(Math.min(100, sliderValue + 1));
        } else {
          const nextIdx = Math.min(
            preset.stages.length - 1,
            resolved.stageIndex + 1
          );
          setSliderValue(getStageSnapValue(preset, nextIdx));
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey && proMode) {
          setSliderValue(Math.max(0, sliderValue - 1));
        } else {
          const prevIdx = Math.max(0, resolved.stageIndex - 1);
          setSliderValue(getStageSnapValue(preset, prevIdx));
        }
      } else if (e.key === " ") {
        e.preventDefault();
        setPeekSource(true);
      } else if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        toggleGrayscale();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        toggleSquint();
      } else if ((e.key === "v" || e.key === "V") && proMode) {
        e.preventDefault();
        cycleValueMap();
      } else if (e.key === "#") {
        e.preventDefault();
        toggleGrid();
      } else if (e.key === "Escape") {
        setCropMode(false);
        setFocalPointMode(false);
        setStripMarkerValue(null);
        setInspectedPixel(null);
        setSetupOpen(false);
        setGuideDrawerOpen(false);
        setAdvancedOpen(false);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        setPeekSource(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    sliderValue,
    proMode,
    resolved.stageIndex,
    preset,
    setSliderValue,
    setPeekSource,
    toggleGrayscale,
    toggleSquint,
    cycleValueMap,
    toggleGrid,
    setCropMode,
    setFocalPointMode,
    setStripMarkerValue,
    setInspectedPixel,
  ]);

  const handleNameCommit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== project.name) {
      void updateName(trimmed);
    } else {
      setNameDraft(project.name);
    }
  };

  const analysis = project.analysis;
  const activeProOverlays =
    (valueMapSteps !== null ? 1 : 0) +
    (canvasWeave ? 1 : 0) +
    (showGamutWarning ? 1 : 0) +
    (focalPointMode ? 1 : 0) +
    (!showAchievable ? 1 : 0);

  const handleToggleFocalPlacement = () => {
    const next = !focalPointMode;
    setFocalPointMode(next);
    setAdvancedOpen(false);
    // Jump to Step 4 (Build Form) if currently on Steps 1-3 so edge softness responds immediately
    if (next && resolved.stageIndex < 3 && preset.stages.length >= 4) {
      setSliderValue(getStageSnapValue(preset, 3));
    }
  };

  const renderSidebarContent = (showMobileClose: boolean) => (
    <>
      {/* Clean 2-tab pill switcher */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] p-3">
        <div className="grid flex-1 grid-cols-2 gap-1 rounded-[var(--radius-md)] bg-[var(--bg-canvas)] p-1">
          {(
            [
              { id: "guide", label: "Step Guide" },
              { id: "colors", label: "Main Colors" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setRightTab(t.id)}
              className={`rounded-[var(--radius-sm)] py-2 text-[13.5px] font-semibold transition-colors duration-150 ${
                rightTab === t.id
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {showMobileClose && (
          <button
            type="button"
            onClick={() => setGuideDrawerOpen(false)}
            aria-label="Close guide panel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {rightTab === "guide" ? (
          <StageGuidanceCard
            stageIndex={resolved.stageIndex}
            totalSteps={preset.stages.length}
            stage={resolved.stage}
          />
        ) : (
          <MixingPlanPanel
            stageIndex={resolved.stageIndex}
            stage={resolved.stage}
            analysis={analysis}
            groundHex={
              project.canvas.groundColor ??
              analysis?.suggestedGroundColor ??
              "#9c7a5b"
            }
            solving={solvingMixing}
            valueStrings={valueStrings}
            keyColorRecipes={keyColorRecipes}
            onIsolateValue={(val) => setStripMarkerValue(val)}
            onJumpToColorStep={() =>
              setSliderValue(getStageSnapValue(preset, 2))
            }
          />
        )}
      </div>

      <p className="shrink-0 border-t border-[var(--border-subtle)] px-5 py-3.5 text-xs leading-relaxed text-[var(--text-muted)]">
        Screens glow brighter than oil paint. Use each mix as a helpful starting
        point, then adjust by eye at your easel.
      </p>
    </>
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Clean, Slim Studio Top Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4">
        {/* Left: Back to Studies + Editable Title */}
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Studies</span>
          </Link>

          <span className="h-4 w-px bg-[var(--border-default)]" />

          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={handleNameCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label="Study title"
            className="min-w-0 max-w-[260px] rounded-[var(--radius-sm)] bg-transparent px-2 py-1 text-[15px] font-semibold text-[var(--text-primary)] outline-none transition-colors hover:bg-[var(--bg-elevated)] focus:bg-[var(--bg-elevated)] focus:ring-1 focus:ring-[var(--accent)]"
          />

          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            title="Change canvas size"
            className="hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] md:inline-flex"
          >
            {project.canvas.widthIn}&times;{project.canvas.heightIn}&Prime;
          </button>
        </div>

        {/* Right: Quiet Analysis Status (while running) + Canvas & Palette + Advanced */}
        <div className="flex shrink-0 items-center gap-2">
          {analyzing && (
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-muted)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Preparing guide&hellip; {analysisPercent}%
            </span>
          )}

          {/* Tablet / narrow viewport Step Guide drawer toggle */}
          <button
            type="button"
            onClick={() => {
              setAdvancedOpen(false);
              setSetupOpen(false);
              setGuideDrawerOpen(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-[13.5px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] lg:hidden"
          >
            <BookOpen className="h-4 w-4 text-[var(--accent)]" />
            <span className="hidden sm:inline">Guide</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAdvancedOpen(false);
              setGuideDrawerOpen(false);
              setSetupOpen(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-[13.5px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] sm:px-3.5"
          >
            <Palette className="h-4 w-4 text-[var(--accent)]" />
            <span className="hidden sm:inline">Canvas &amp; Palette</span>
          </button>

          {/* Advanced / Pro Tools Toggle & Popover */}
          <div ref={advancedPopoverRef} className="relative">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
              className={`inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border px-3.5 text-[13.5px] font-medium transition-colors ${
                proMode || advancedOpen
                  ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--text-primary)]"
                  : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Advanced</span>
              {(proMode || activeProOverlays > 0) && (
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              )}
            </button>

            {advancedOpen && (
              <div className="absolute right-0 top-11 z-40 w-[300px] rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-float)]">
                {/* Master Advanced Studio Mode Toggle */}
                <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Advanced Studio Tools
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">
                      Shows the Value Strip, smooth stage scrub, and pigment
                      codes.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={proMode}
                    onClick={toggleProMode}
                    className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                      proMode ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        proMode ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Pro Tools List */}
                <div className="mt-3.5 space-y-3 text-[13px]">
                  {/* 3 / 5 / 9 Value Map */}
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                      <Layers className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      Value Map Posterization
                    </span>
                    <div className="grid grid-cols-4 gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-canvas)] p-1">
                      {(
                        [
                          { id: null, label: "Off" },
                          { id: 3, label: "3" },
                          { id: 5, label: "5" },
                          { id: 9, label: "9" },
                        ] as { id: ValueStepCount | null; label: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setValueMapSteps(opt.id)}
                          className={`rounded-[6px] py-1 text-xs font-medium transition-colors ${
                            valueMapSteps === opt.id
                              ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Achievable vs Ideal Colors */}
                  <button
                    type="button"
                    onClick={toggleShowAchievable}
                    className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors ${
                      showAchievable
                        ? "border-[var(--accent)]/60 bg-[var(--accent-muted)] text-[var(--text-primary)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span>Preview Palette Colors</span>
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      {showAchievable ? "Achievable" : "Ideal"}
                    </span>
                  </button>

                  {/* Gamut Warning */}
                  <button
                    type="button"
                    onClick={toggleShowGamutWarning}
                    className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors ${
                      showGamutWarning
                        ? "border-[#e64080] bg-[#e64080]/15 text-[var(--text-primary)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Gamut Warning
                    </span>
                    {outOfGamutPercent > 0.1 && (
                      <span className="font-mono-num text-xs text-[#f27ca8]">
                        {outOfGamutPercent.toFixed(0)}%
                      </span>
                    )}
                  </button>

                  {/* Interactive Focal Point Placement */}
                  <button
                    type="button"
                    disabled={!analysis}
                    onClick={handleToggleFocalPlacement}
                    className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors disabled:opacity-40 ${
                      focalPointMode
                        ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--text-primary)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Crosshair className="h-3.5 w-3.5" />
                      Set Focal Point
                    </span>
                    <span className="text-xs text-[var(--accent)]">
                      {focalPointMode ? "Placing…" : "Place"}
                    </span>
                  </button>

                  {/* Canvas Weave Texture */}
                  <button
                    type="button"
                    onClick={toggleCanvasWeave}
                    className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors ${
                      canvasWeave
                        ? "border-[var(--accent)]/60 bg-[var(--accent-muted)] text-[var(--text-primary)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5" />
                      Canvas Weave Texture
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {canvasWeave ? "On" : "Off"}
                    </span>
                  </button>

                  {/* Re-analyze photo */}
                  <button
                    type="button"
                    onClick={() => {
                      void analyzeProject(true);
                      setAdvancedOpen(false);
                    }}
                    disabled={analyzing}
                    className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-default)] hover:text-[var(--text-primary)] disabled:opacity-40"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${analyzing ? "animate-spin" : ""}`}
                    />
                    Re-analyze Reference Image
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area: Canvas Hero + Right Guidance Panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Center Canvas Hero + Step Progress Footer */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <CanvasView project={project} />
            {proMode && !cropMode && <ValueStrip />}
          </div>

          <ProcessSlider preset={preset} disabled={!analysis || cropMode} />
        </main>

        {/* Right Panel: Step Guide + Main Colors (docked on lg+ desktop) */}
        <aside className="hidden w-[348px] shrink-0 flex-col justify-between overflow-hidden border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] lg:flex">
          {renderSidebarContent(false)}
        </aside>
      </div>

      {/* Tablet / narrow viewport slide-over Step Guide & Main Colors drawer */}
      {guideDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Step Guide and Main Colors"
          className="fixed inset-0 z-40 flex justify-end lg:hidden"
        >
          <div
            aria-hidden="true"
            onClick={() => setGuideDrawerOpen(false)}
            className="flex-1 bg-black/50 backdrop-blur-[2px]"
          />
          <aside className="flex h-full w-full max-w-[360px] flex-col justify-between overflow-hidden border-l border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-float)]">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* On-demand Canvas & Palette Slide-Over Drawer */}
      <StudioSetupDrawer
        project={project}
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
      />
    </div>
  );
}
