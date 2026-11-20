import { create } from "zustand";
import type {
  CanvasSpec,
  CropRect,
  ImageAnalysis,
  PaletteId,
  Project,
} from "@/lib/types";
import {
  computeCenteredCrop,
  getProject,
  saveProjectAnalysis,
  saveProjectMetadata,
} from "@/lib/db/projectsDb";
import { runImageAnalysis } from "@/lib/analysis/runAnalysis";
import { stageBitmapCache } from "@/lib/render/cache";

interface ProjectState {
  project: Project | null;
  loading: boolean;
  error: string | null;
  analyzing: boolean;
  analysisError: string | null;
  analysisStage: string;
  analysisPercent: number;
  analysisDurationMs: number | null;
  loadProject: (id: string) => Promise<void>;
  analyzeProject: (force?: boolean) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  updateCanvasSize: (widthIn: number, heightIn: number) => Promise<void>;
  swapOrientation: () => Promise<void>;
  updateCrop: (crop: CropRect) => Promise<void>;
  updateGroundColor: (hex: string | undefined) => Promise<void>;
  updateFocalPoint: (pt: { x: number; y: number }) => Promise<void>;
  updatePalette: (palette: PaletteId) => Promise<void>;
  updateCustomPigments: (pigmentIds: string[]) => Promise<void>;
  clearProject: () => void;
}

// Monotonic request token to discard stale analysis completions after crop/project changes
let activeAnalysisToken = 0;

// Serialized DB write queue + optional coalescing debounce for continuous drags
let writeChain: Promise<void> = Promise.resolve();
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let pendingMetaProject: Project | null = null;
let pendingAnalysisSave: { id: string; analysis: ImageAnalysis | undefined } | null = null;

function enqueueDbWrite(task: () => Promise<void>): Promise<void> {
  const next = writeChain.then(task, task);
  writeChain = next.catch(() => {});
  return next;
}

function flushPendingWrites(): Promise<void> {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  const metaToSave = pendingMetaProject;
  const analysisToSave = pendingAnalysisSave;
  pendingMetaProject = null;
  pendingAnalysisSave = null;
  if (!metaToSave && !analysisToSave) return writeChain;

  return enqueueDbWrite(async () => {
    if (metaToSave) {
      await saveProjectMetadata(metaToSave);
    }
    if (analysisToSave) {
      await saveProjectAnalysis(analysisToSave.id, analysisToSave.analysis);
    }
  });
}

function scheduleProjectWrite(
  project: Project,
  options: { debounceMs?: number; persistAnalysis?: boolean } = {}
): Promise<void> {
  pendingMetaProject = project;
  if (options.persistAnalysis) {
    pendingAnalysisSave = { id: project.id, analysis: project.analysis };
  }

  const debounceMs = options.debounceMs ?? 0;
  if (debounceMs <= 0) {
    return flushPendingWrites();
  }

  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
  }
  return new Promise<void>((resolve) => {
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      void flushPendingWrites().finally(resolve);
    }, debounceMs);
  });
}

function cropSignature(crop: CropRect): string {
  return `${crop.x.toFixed(5)},${crop.y.toFixed(5)},${crop.w.toFixed(5)},${crop.h.toFixed(5)}`;
}

async function persistMetadataUpdate(
  current: Project,
  patch: Partial<Project>,
  set: (partial: Partial<ProjectState>) => void,
  options: { debounceMs?: number; persistAnalysis?: boolean } = {}
): Promise<Project> {
  const updated: Project = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  set({ project: updated });
  await scheduleProjectWrite(updated, options);
  return updated;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  loading: false,
  error: null,
  analyzing: false,
  analysisError: null,
  analysisStage: "",
  analysisPercent: 0,
  analysisDurationMs: null,

  loadProject: async (id: string) => {
    activeAnalysisToken++;
    await flushPendingWrites();
    stageBitmapCache.clear();
    set({
      loading: true,
      error: null,
      analyzing: false,
      analysisError: null,
      analysisDurationMs: null,
    });
    try {
      const found = await getProject(id);
      if (!found) {
        set({ project: null, loading: false, error: "Project not found." });
        return;
      }
      set({ project: found, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load project.";
      set({ project: null, loading: false, error: message });
    }
  },

  analyzeProject: async (force = false) => {
    const current = get().project;
    if (!current) return;
    if (!force && get().analyzing) return;
    if (current.analysis && !force) return;

    const token = ++activeAnalysisToken;
    const targetId = current.id;
    const targetCropSig = cropSignature(current.canvas.crop);

    set({
      analyzing: true,
      analysisError: null,
      analysisStage: "Preparing image",
      analysisPercent: 5,
    });

    try {
      const { analysis, durationMs } = await runImageAnalysis(
        current.sourceImage,
        current.canvas.crop,
        (stage, percent) => {
          if (token === activeAnalysisToken && get().project?.id === targetId) {
            set({ analysisStage: stage, analysisPercent: percent });
          }
        }
      );

      if (token !== activeAnalysisToken) return;

      const latest = get().project;
      if (
        !latest ||
        latest.id !== targetId ||
        cropSignature(latest.canvas.crop) !== targetCropSig
      ) {
        set({ analyzing: false });
        return;
      }

      const nextCanvas: CanvasSpec = {
        ...latest.canvas,
        groundColor:
          latest.canvas.groundColor ?? analysis.suggestedGroundColor,
      };

      stageBitmapCache.clear();

      await persistMetadataUpdate(
        latest,
        {
          canvas: nextCanvas,
          analysis,
        },
        set,
        { persistAnalysis: true }
      );

      if (token !== activeAnalysisToken) return;

      set({
        analyzing: false,
        analysisError: null,
        analysisStage: "Ready",
        analysisPercent: 100,
        analysisDurationMs: durationMs,
      });
    } catch (err) {
      if (token !== activeAnalysisToken) return;
      const message = err instanceof Error ? err.message : "Analysis failed";
      set({
        analyzing: false,
        analysisError: message,
        analysisStage: message,
        analysisPercent: 0,
      });
    }
  },

  updateName: async (name: string) => {
    const current = get().project;
    if (!current) return;
    await persistMetadataUpdate(current, { name }, set);
  },

  updateCanvasSize: async (widthIn: number, heightIn: number) => {
    const current = get().project;
    if (!current) return;
    activeAnalysisToken++;
    stageBitmapCache.clear();
    set({ analyzing: false, analysisError: null });
    const safeW = Math.max(1, Math.min(120, widthIn));
    const safeH = Math.max(1, Math.min(120, heightIn));
    const nextCrop = computeCenteredCrop(
      current.sourceWidth,
      current.sourceHeight,
      safeW,
      safeH
    );
    const canvas: CanvasSpec = {
      ...current.canvas,
      widthIn: safeW,
      heightIn: safeH,
      crop: nextCrop,
    };
    await persistMetadataUpdate(current, { canvas, analysis: undefined }, set, {
      persistAnalysis: true,
    });
  },

  swapOrientation: async () => {
    const current = get().project;
    if (!current) return;
    await get().updateCanvasSize(
      current.canvas.heightIn,
      current.canvas.widthIn
    );
  },

  updateCrop: async (crop: CropRect) => {
    const current = get().project;
    if (!current) return;
    activeAnalysisToken++;
    stageBitmapCache.clear();
    set({ analyzing: false, analysisError: null });
    const canvas: CanvasSpec = {
      ...current.canvas,
      crop,
    };
    await persistMetadataUpdate(current, { canvas, analysis: undefined }, set, {
      persistAnalysis: true,
    });
  },

  updateGroundColor: async (hex: string | undefined) => {
    const current = get().project;
    if (!current) return;
    const canvas: CanvasSpec = {
      ...current.canvas,
      groundColor: hex,
    };
    // Debounce DB writes while user drags the OS color picker
    await persistMetadataUpdate(current, { canvas }, set, { debounceMs: 180 });
  },

  updateFocalPoint: async (pt: { x: number; y: number }) => {
    const current = get().project;
    if (!current?.analysis) return;
    const clamped = {
      x: Math.max(0, Math.min(1, pt.x)),
      y: Math.max(0, Math.min(1, pt.y)),
    };
    const nextAnalysis: ImageAnalysis = {
      ...current.analysis,
      focalPoint: clamped,
    };
    await persistMetadataUpdate(current, { analysis: nextAnalysis }, set, {
      debounceMs: 200,
      persistAnalysis: true,
    });
  },

  updatePalette: async (palette: PaletteId) => {
    const current = get().project;
    if (!current) return;
    await persistMetadataUpdate(current, { palette }, set);
  },

  updateCustomPigments: async (pigmentIds: string[]) => {
    const current = get().project;
    if (!current || pigmentIds.length === 0) return;
    await persistMetadataUpdate(
      current,
      { palette: "custom", customPigmentIds: pigmentIds },
      set
    );
  },

  clearProject: () => {
    activeAnalysisToken++;
    void flushPendingWrites();
    stageBitmapCache.clear();
    set({
      project: null,
      loading: false,
      error: null,
      analyzing: false,
      analysisError: null,
      analysisStage: "",
      analysisPercent: 0,
      analysisDurationMs: null,
    });
  },
}));
