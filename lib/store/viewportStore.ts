import { create } from "zustand";
import type { GridConfig, OKLab } from "@/lib/types";
import type { ValueStepCount } from "@/lib/color/valueScale";

export type InspectedPixel = {
  /** Normalized 0..1 coordinates on the canvas */
  nx: number;
  ny: number;
  oklab: OKLab;
  hex: string;
  value: number;
  firstStageId: string;
};

/** Default starting slider value: completed state of Step 1 (Tone Canvas: 0..20) */
export const INITIAL_STEP_SLIDER_VALUE = 19.5;

interface ViewportState {
  sliderValue: number; // 0..100 continuous process slider
  proMode: boolean; // reveals advanced studio controls
  hintDismissed: boolean; // dismissible "Click anywhere to mix" hint
  grayscale: boolean;
  squint: boolean;
  splitView: boolean;
  splitPosition: number; // 0.05..0.95
  canvasWeave: boolean;
  showAchievable: boolean;
  showGamutWarning: boolean;
  peekSource: boolean;
  valueMapSteps: ValueStepCount | null;
  cropMode: boolean;
  focalPointMode: boolean;
  grid: GridConfig;
  hoveredValue: number | null; // 0..10 scale from pointer hover
  stripMarkerValue: number | null; // 0..10 draggable marker on ValueStrip
  inspectedPixel: InspectedPixel | null;
  valueWeight: number;

  setSliderValue: (val: number) => void;
  setProMode: (val: boolean) => void;
  toggleProMode: () => void;
  dismissHint: () => void;
  resetForProject: () => void;
  setGrayscale: (val: boolean) => void;
  toggleGrayscale: () => void;
  toggleSquint: () => void;
  toggleSplitView: () => void;
  setSplitPosition: (pos: number) => void;
  toggleCanvasWeave: () => void;
  toggleShowAchievable: () => void;
  toggleShowGamutWarning: () => void;
  setPeekSource: (val: boolean) => void;
  setValueMapSteps: (steps: ValueStepCount | null) => void;
  cycleValueMap: () => void;
  setCropMode: (val: boolean) => void;
  toggleCropMode: () => void;
  setFocalPointMode: (val: boolean) => void;
  toggleFocalPointMode: () => void;
  updateGrid: (patch: Partial<GridConfig>) => void;
  toggleGrid: () => void;
  setHoveredValue: (val: number | null) => void;
  setStripMarkerValue: (val: number | null) => void;
  setInspectedPixel: (pixel: InspectedPixel | null) => void;
  setValueWeight: (weight: number) => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  sliderValue: INITIAL_STEP_SLIDER_VALUE,
  proMode: false,
  hintDismissed: false,
  grayscale: false,
  squint: false,
  splitView: false,
  splitPosition: 0.5,
  canvasWeave: false,
  showAchievable: true,
  showGamutWarning: false,
  peekSource: false,
  valueMapSteps: null,
  cropMode: false,
  focalPointMode: false,
  grid: {
    mode: "off",
    cols: 4,
    rows: 4,
    inchStep: 2,
    showLabels: true,
    opacity: 0.45,
    color: "light",
  },
  hoveredValue: null,
  stripMarkerValue: null,
  inspectedPixel: null,
  valueWeight: 2.0,

  setSliderValue: (val) =>
    set({ sliderValue: Math.max(0, Math.min(100, val)) }),

  setProMode: (proMode) =>
    set((s) => ({
      proMode,
      // When turning off Pro mode, clear pro-only overlays so canvas stays clean
      ...(proMode
        ? {}
        : {
            valueMapSteps: null,
            showGamutWarning: false,
            canvasWeave: false,
            focalPointMode: false,
            stripMarkerValue: s.stripMarkerValue,
          }),
    })),

  toggleProMode: () =>
    set((s) => {
      const next = !s.proMode;
      return {
        proMode: next,
        ...(next
          ? {}
          : {
              valueMapSteps: null,
              showGamutWarning: false,
              canvasWeave: false,
              focalPointMode: false,
            }),
      };
    }),

  dismissHint: () => set({ hintDismissed: true }),

  resetForProject: () =>
    set({
      sliderValue: INITIAL_STEP_SLIDER_VALUE,
      inspectedPixel: null,
      cropMode: false,
      focalPointMode: false,
      stripMarkerValue: null,
      peekSource: false,
      splitView: false,
    }),

  setGrayscale: (grayscale) => set({ grayscale }),
  toggleGrayscale: () => set((s) => ({ grayscale: !s.grayscale })),

  toggleSquint: () => set((s) => ({ squint: !s.squint })),
  toggleSplitView: () => set((s) => ({ splitView: !s.splitView })),
  setSplitPosition: (pos) =>
    set({ splitPosition: Math.max(0.05, Math.min(0.95, pos)) }),
  toggleCanvasWeave: () => set((s) => ({ canvasWeave: !s.canvasWeave })),
  toggleShowAchievable: () =>
    set((s) => ({ showAchievable: !s.showAchievable })),
  toggleShowGamutWarning: () =>
    set((s) => ({ showGamutWarning: !s.showGamutWarning })),
  setPeekSource: (peekSource) => set({ peekSource }),

  setValueMapSteps: (valueMapSteps) => set({ valueMapSteps }),
  cycleValueMap: () =>
    set((s) => {
      if (s.valueMapSteps === null) return { valueMapSteps: 5 };
      if (s.valueMapSteps === 5) return { valueMapSteps: 3 };
      if (s.valueMapSteps === 3) return { valueMapSteps: 9 };
      return { valueMapSteps: null };
    }),

  setCropMode: (cropMode) =>
    set((s) => ({
      cropMode,
      focalPointMode: cropMode ? false : s.focalPointMode,
    })),
  toggleCropMode: () =>
    set((s) => ({
      cropMode: !s.cropMode,
      focalPointMode: !s.cropMode ? false : s.focalPointMode,
    })),
  setFocalPointMode: (focalPointMode) =>
    set((s) => ({
      focalPointMode,
      cropMode: focalPointMode ? false : s.cropMode,
      inspectedPixel: focalPointMode ? null : s.inspectedPixel,
    })),
  toggleFocalPointMode: () =>
    set((s) => {
      const next = !s.focalPointMode;
      return {
        focalPointMode: next,
        cropMode: next ? false : s.cropMode,
        inspectedPixel: next ? null : s.inspectedPixel,
      };
    }),

  updateGrid: (patch) =>
    set((s) => ({
      grid: { ...s.grid, ...patch },
    })),

  toggleGrid: () =>
    set((s) => ({
      grid: {
        ...s.grid,
        mode: s.grid.mode === "off" ? "inches" : "off",
      },
    })),

  setHoveredValue: (hoveredValue) => set({ hoveredValue }),
  setStripMarkerValue: (stripMarkerValue) => set({ stripMarkerValue }),
  setInspectedPixel: (inspectedPixel) => set({ inspectedPixel }),
  setValueWeight: (valueWeight) => set({ valueWeight }),
}));
