"use client";

import { useEffect, useMemo, useRef } from "react";
import { Check, Crosshair, Pipette, X } from "lucide-react";
import type { Project } from "@/lib/types";
import { useViewportStore } from "@/lib/store/viewportStore";
import { useProjectStore } from "@/lib/store/projectStore";
import { GAMUT_WARNING_DE, useMixingStore } from "@/lib/store/mixingStore";
import {
  rgbBytesToPerceptualGrayByte,
  srgbToValue,
  valueBucketToGrayByte,
} from "@/lib/color/valueScale";
import { srgbToHex, srgbToOklab } from "@/lib/color/conversions";
import { getActivePigments } from "@/lib/data/palettes";
import { getPreset, resolveSliderPosition } from "@/lib/presets";
import { getStudioGLPipeline } from "@/lib/render/glContext";
import { renderStageCached } from "@/lib/stages/registry";
import type { StageRenderContext } from "@/lib/stages/types";
import { GridOverlay } from "./GridOverlay";
import { CropTool } from "./CropTool";
import { CanvasToolbar } from "./CanvasToolbar";
import { usePreparedSource } from "./usePreparedSource";
import { ColorInspector } from "@/components/mixing/ColorInspector";

interface CanvasViewProps {
  project: Project;
}

export function CanvasView({ project }: CanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const renderSeqRef = useRef(0);
  const draggingFocalRef = useRef(false);

  const sliderValue = useViewportStore((s) => s.sliderValue);
  const hintDismissed = useViewportStore((s) => s.hintDismissed);
  const dismissHint = useViewportStore((s) => s.dismissHint);
  const grayscale = useViewportStore((s) => s.grayscale);
  const squint = useViewportStore((s) => s.squint);
  const splitView = useViewportStore((s) => s.splitView);
  const splitPosition = useViewportStore((s) => s.splitPosition);
  const setSplitPosition = useViewportStore((s) => s.setSplitPosition);
  const canvasWeave = useViewportStore((s) => s.canvasWeave);
  const showAchievable = useViewportStore((s) => s.showAchievable);
  const showGamutWarning = useViewportStore((s) => s.showGamutWarning);
  const peekSource = useViewportStore((s) => s.peekSource);
  const valueMapSteps = useViewportStore((s) => s.valueMapSteps);
  const cropMode = useViewportStore((s) => s.cropMode);
  const setCropMode = useViewportStore((s) => s.setCropMode);
  const focalPointMode = useViewportStore((s) => s.focalPointMode);
  const setFocalPointMode = useViewportStore((s) => s.setFocalPointMode);
  const grid = useViewportStore((s) => s.grid);
  const stripMarkerValue = useViewportStore((s) => s.stripMarkerValue);
  const setHoveredValue = useViewportStore((s) => s.setHoveredValue);
  const inspectedPixel = useViewportStore((s) => s.inspectedPixel);
  const setInspectedPixel = useViewportStore((s) => s.setInspectedPixel);
  const valueWeight = useViewportStore((s) => s.valueWeight);

  const updateCrop = useProjectStore((s) => s.updateCrop);
  const updateFocalPoint = useProjectStore((s) => s.updateFocalPoint);

  const coarseAchievable = useMixingStore((s) => s.coarseAchievable);
  const fineAchievable = useMixingStore((s) => s.fineAchievable);
  const fineDeltaE = useMixingStore((s) => s.fineDeltaE);
  const outOfGamutPercent = useMixingStore((s) => s.outOfGamutPercent);
  const mixingSignature = useMixingStore((s) => s.signature);

  const activePigments = useMemo(
    () => getActivePigments(project.palette, project.customPigmentIds),
    [project.palette, project.customPigmentIds]
  );

  const {
    preparedRef,
    imageUrl,
    sourceReadyTick,
    gamutMask,
    valueContinuousBuffer,
  } = usePreparedSource(project, fineDeltaE);

  // Render current painting stage + crossfade + split + GPU post-process overlays
  useEffect(() => {
    if (cropMode) return;
    const prepared = preparedRef.current;
    const canvas = canvasRef.current;
    if (!prepared || !canvas) return;

    const seq = ++renderSeqRef.current;
    const { w, h } = prepared;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analysis = project.analysis;
    const preset = getPreset(project.processPresetId);
    const gl = getStudioGLPipeline();

    const drawFrame = async () => {
      // A. Determine base image: peek source OR rendered painting stage (with crossfade)
      if (peekSource || !analysis) {
        ctx.globalAlpha = 1;
        ctx.drawImage(prepared.bitmap, 0, 0, w, h);
      } else {
        const resolved = resolveSliderPosition(preset, sliderValue);
        const stageCtx: StageRenderContext = {
          analysis,
          canvasSpec: project.canvas,
          sourceImageData: prepared.imageData,
          sourceBitmap: prepared.bitmap,
          gl,
          achievableColors:
            showAchievable && coarseAchievable && fineAchievable
              ? { coarse: coarseAchievable, fine: fineAchievable }
              : undefined,
        };

        const mixCacheKey =
          showAchievable && mixingSignature ? `ach:${mixingSignature}` : "ideal";

        const primaryBmp = await renderStageCached(
          project.id,
          resolved.stage,
          stageCtx,
          resolved.t,
          mixCacheKey
        );
        if (seq !== renderSeqRef.current) return;

        if (resolved.crossfade) {
          const fromBmp = await renderStageCached(
            project.id,
            resolved.crossfade.fromStage,
            stageCtx,
            resolved.crossfade.fromT,
            mixCacheKey
          );
          if (seq !== renderSeqRef.current) return;

          ctx.globalAlpha = 1;
          ctx.drawImage(fromBmp, 0, 0, w, h);
          ctx.globalAlpha = resolved.crossfade.alpha;
          ctx.drawImage(primaryBmp, 0, 0, w, h);
          ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = 1;
          ctx.drawImage(primaryBmp, 0, 0, w, h);
        }

        // B. Split view: right side shows the reference source image
        if (splitView) {
          const splitX = Math.round(splitPosition * w);
          ctx.save();
          ctx.beginPath();
          ctx.rect(splitX, 0, w - splitX, h);
          ctx.clip();
          ctx.drawImage(prepared.bitmap, 0, 0, w, h);
          ctx.restore();
        }
      }

      // C. Display post-processing (Squint, Canvas Weave, Value Map, Grayscale, Value Isolation, Gamut Warning)
      const activeValueMap =
        valueMapSteps !== null && analysis
          ? valueMapSteps === 3
            ? analysis.valueMap3
            : valueMapSteps === 5
              ? analysis.valueMap5
              : analysis.valueMap9
          : null;
      const activeGamutMask =
        showGamutWarning && gamutMask ? gamutMask : null;
      const activeIsolate =
        stripMarkerValue !== null && analysis ? stripMarkerValue : null;

      const needsPostPass =
        squint ||
        canvasWeave ||
        grayscale ||
        activeValueMap !== null ||
        activeIsolate !== null ||
        activeGamutMask !== null;

      if (!needsPostPass) return;

      // Fast path: run all post-processing on the GPU with zero getImageData readback
      if (gl) {
        const postBmp = await gl.renderDisplayPost(canvas, w, h, {
          blurRadius: squint ? 10.0 : 0,
          contrastDrop: squint ? 0.16 : 0,
          weaveStrength: canvasWeave ? 0.7 : 0,
          grayscale,
          valueMapSteps: activeValueMap ? valueMapSteps : null,
          valueMapData: activeValueMap ?? null,
          isolateValue: activeIsolate,
          valueContinuousData: valueContinuousBuffer,
          gamutMaskData: activeGamutMask,
        });
        if (seq !== renderSeqRef.current) {
          postBmp.close();
          return;
        }
        ctx.drawImage(postBmp, 0, 0, w, h);
        postBmp.close();
        return;
      }

      // 2D fallback when WebGL2 is unavailable
      const currentData = ctx.getImageData(0, 0, w, h);
      const data = currentData.data;
      const pixelCount = w * h;

      if (
        valueMapSteps !== null &&
        activeValueMap &&
        activeValueMap.length === pixelCount
      ) {
        for (let i = 0; i < pixelCount; i++) {
          const byte = valueBucketToGrayByte(
            activeValueMap[i] ?? 0,
            valueMapSteps
          );
          const off = i * 4;
          data[off] = byte;
          data[off + 1] = byte;
          data[off + 2] = byte;
        }
      } else if (grayscale) {
        for (let i = 0; i < pixelCount; i++) {
          const off = i * 4;
          const lum = rgbBytesToPerceptualGrayByte(
            data[off] ?? 0,
            data[off + 1] ?? 0,
            data[off + 2] ?? 0
          );
          data[off] = lum;
          data[off + 1] = lum;
          data[off + 2] = lum;
        }
      }

      if (
        activeIsolate !== null &&
        valueContinuousBuffer &&
        valueContinuousBuffer.length === pixelCount
      ) {
        for (let i = 0; i < pixelCount; i++) {
          const v = ((valueContinuousBuffer[i] ?? 0) / 255) * 10;
          if (Math.abs(v - activeIsolate) <= 0.45) {
            const off = i * 4;
            data[off] = Math.min(
              255,
              Math.round((data[off] ?? 0) * 0.45 + 216 * 0.55)
            );
            data[off + 1] = Math.min(
              255,
              Math.round((data[off + 1] ?? 0) * 0.45 + 154 * 0.55)
            );
            data[off + 2] = Math.min(
              255,
              Math.round((data[off + 2] ?? 0) * 0.45 + 91 * 0.55)
            );
          }
        }
      }

      if (activeGamutMask && activeGamutMask.length === pixelCount) {
        for (let y = 0; y < h; y++) {
          const row = y * w;
          for (let x = 0; x < w; x++) {
            const i = row + x;
            if ((activeGamutMask[i] ?? 0) > 127) {
              const off = i * 4;
              const stripe = ((x + y) & 7) < 3 ? 0.62 : 0.24;
              data[off] = Math.round(
                (data[off] ?? 0) * (1 - stripe) + 230 * stripe
              );
              data[off + 1] = Math.round(
                (data[off + 1] ?? 0) * (1 - stripe) + 64 * stripe
              );
              data[off + 2] = Math.round(
                (data[off + 2] ?? 0) * (1 - stripe) + 128 * stripe
              );
            }
          }
        }
      }

      ctx.putImageData(currentData, 0, 0);
    };

    void drawFrame();
  }, [
    preparedRef,
    sourceReadyTick,
    project.id,
    project.canvas,
    project.analysis,
    project.processPresetId,
    sliderValue,
    grayscale,
    squint,
    splitView,
    splitPosition,
    canvasWeave,
    showAchievable,
    showGamutWarning,
    coarseAchievable,
    fineAchievable,
    gamutMask,
    valueContinuousBuffer,
    mixingSignature,
    peekSource,
    valueMapSteps,
    stripMarkerValue,
    cropMode,
  ]);

  const placeFocalPointAtEvent = (
    e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    void updateFocalPoint({ x: nx, y: ny });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!focalPointMode) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingFocalRef.current = true;
    placeFocalPointAtEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (focalPointMode && draggingFocalRef.current) {
      placeFocalPointAtEvent(e);
      return;
    }

    const canvas = canvasRef.current;
    const prepared = preparedRef.current;
    if (!canvas || !prepared) return;

    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
      setHoveredValue(null);
      return;
    }

    const px = Math.min(
      prepared.w - 1,
      Math.max(0, Math.floor(nx * prepared.w))
    );
    const py = Math.min(
      prepared.h - 1,
      Math.max(0, Math.floor(ny * prepared.h))
    );
    const off = (py * prepared.w + px) * 4;
    const r = (prepared.imageData.data[off] ?? 0) / 255;
    const g = (prepared.imageData.data[off + 1] ?? 0) / 255;
    const b = (prepared.imageData.data[off + 2] ?? 0) / 255;

    setHoveredValue(srgbToValue({ r, g, b }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingFocalRef.current) {
      draggingFocalRef.current = false;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (focalPointMode) {
      placeFocalPointAtEvent(e);
      return;
    }

    const canvas = canvasRef.current;
    const prepared = preparedRef.current;
    if (!canvas || !prepared) return;

    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const px = Math.min(prepared.w - 1, Math.floor(nx * prepared.w));
    const py = Math.min(prepared.h - 1, Math.floor(ny * prepared.h));

    const off = (py * prepared.w + px) * 4;
    const rgb = {
      r: (prepared.imageData.data[off] ?? 0) / 255,
      g: (prepared.imageData.data[off + 1] ?? 0) / 255,
      b: (prepared.imageData.data[off + 2] ?? 0) / 255,
    };

    const oklab = srgbToOklab(rgb);
    const hex = srgbToHex(rgb);
    const value = srgbToValue(rgb);

    // Determine which stage this color first appears in from nearest key color
    let firstStageId = "color-block-in";
    if (project.analysis && project.analysis.keyColors.length > 0) {
      let bestDist = Infinity;
      for (const kc of project.analysis.keyColors) {
        const dL = kc.oklab.L - oklab.L;
        const dA = kc.oklab.a - oklab.a;
        const dB = kc.oklab.b - oklab.b;
        const d = dL * dL + dA * dA + dB * dB;
        if (d < bestDist) {
          bestDist = d;
          firstStageId = kc.firstStageId;
        }
      }
    } else if (value >= 8.5 || value <= 1.0) {
      firstStageId = "accents-highlights";
    }

    dismissHint();
    setInspectedPixel({ nx, ny, oklab, hex, value, firstStageId });
  };

  const handleSplitDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const frame = frameRef.current;
    if (!frame) return;

    const update = (clientX: number) => {
      const rect = frame.getBoundingClientRect();
      setSplitPosition((clientX - rect.left) / rect.width);
    };

    update(e.clientX);
    const onMove = (ev: PointerEvent) => update(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const aspectRatio = project.canvas.widthIn / project.canvas.heightIn;
  const sourceAspect = project.sourceWidth / project.sourceHeight;
  const focalPoint = project.analysis?.focalPoint ?? { x: 0.5, y: 0.46 };

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[var(--bg-canvas)] px-4 pb-20 pt-10 sm:px-6">
      {/* Interactive Focal Point placement banner */}
      {!cropMode && focalPointMode && (
        <div className="absolute top-3 z-20 flex items-center gap-3 rounded-full border border-[var(--accent)]/60 bg-[var(--bg-surface)]/95 px-4 py-1.5 text-[13px] text-[var(--text-primary)] shadow-[var(--shadow-card)] backdrop-blur-md">
          <Crosshair className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          <span>
            Click or drag to place your focal point (crisp edges here, softer
            edges around it)
          </span>
          <button
            type="button"
            onClick={() => setFocalPointMode(false)}
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-semibold text-[#141210] transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Check className="h-3 w-3" />
            Done
          </button>
        </div>
      )}

      {/* Subtle dismissible beginner hint */}
      {!cropMode && !focalPointMode && !inspectedPixel && !hintDismissed && (
        <div className="absolute top-3 z-20 flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/90 px-3.5 py-1.5 text-[13px] text-[var(--text-secondary)] shadow-[var(--shadow-card)] backdrop-blur-md">
          <Pipette className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          <span>Click anywhere on the image to see how to mix that color.</span>
          <button
            type="button"
            onClick={dismissHint}
            aria-label="Dismiss hint"
            className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {cropMode ? (
        <div className="relative flex max-h-full max-w-full flex-col items-center gap-4">
          <div
            className="relative max-h-[calc(100vh-16rem)] max-w-full overflow-hidden rounded-[8px] border border-[var(--border-default)] shadow-2xl"
            style={{ aspectRatio: `${sourceAspect}` }}
          >
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={project.name}
                className="block h-full w-full object-contain"
                draggable={false}
              />
            )}
            <CropTool
              crop={project.canvas.crop}
              sourceWidth={project.sourceWidth}
              sourceHeight={project.sourceHeight}
              canvasWidthIn={project.canvas.widthIn}
              canvasHeightIn={project.canvas.heightIn}
              onChange={updateCrop}
            />
          </div>

          <button
            type="button"
            onClick={() => setCropMode(false)}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#141210] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Check className="h-4 w-4" />
            Done Cropping
          </button>
        </div>
      ) : (
        <div
          ref={frameRef}
          className="relative max-h-[calc(100vh-15.5rem)] max-w-full overflow-hidden rounded-[6px] border border-[var(--border-default)] bg-[#141311] shadow-[0_22px_60px_rgba(0,0,0,0.6)]"
          style={{ aspectRatio: `${aspectRatio}` }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => setHoveredValue(null)}
            onClick={handleCanvasClick}
            className={`block h-full w-full object-contain ${
              focalPointMode ? "cursor-grab active:cursor-grabbing touch-none" : "cursor-crosshair"
            }`}
          />

          {/* Interactive Focal Point indicator (visible while placing focal point) */}
          {focalPointMode && project.analysis && (
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${focalPoint.x * 100}%`,
                top: `${focalPoint.y * 100}%`,
              }}
            >
              {/* Inner crisp-focus radius visual guide */}
              <div className="flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-[var(--accent)]/80 bg-[var(--accent)]/8 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]">
                <div className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-black/55 shadow-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                </div>
              </div>
            </div>
          )}

          {/* Clicked pixel sample reticle */}
          {inspectedPixel && !focalPointMode && (
            <div
              className="pointer-events-none absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.75)]"
              style={{
                left: `${inspectedPixel.nx * 100}%`,
                top: `${inspectedPixel.ny * 100}%`,
              }}
            />
          )}

          <GridOverlay
            config={grid}
            canvasWidthIn={project.canvas.widthIn}
            canvasHeightIn={project.canvas.heightIn}
          />

          {/* Interactive Split divider */}
          {splitView && !peekSource && (
            <div
              onPointerDown={handleSplitDrag}
              style={{ left: `${splitPosition * 100}%` }}
              className="absolute inset-y-0 z-20 w-5 -translate-x-1/2 cursor-ew-resize select-none touch-none"
            >
              <div className="mx-auto h-full w-0.5 bg-[var(--accent)] shadow-[0_0_8px_rgba(0,0,0,0.9)]" />
              <div className="absolute left-1/2 top-1/2 flex h-8 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs text-[var(--accent)] shadow-md">
                &#8596;
              </div>
              <span className="pointer-events-none absolute right-4 top-3 whitespace-nowrap rounded-full bg-black/75 px-2.5 py-0.5 text-xs font-medium text-[var(--text-primary)] backdrop-blur-xs">
                Painting Step
              </span>
              <span className="pointer-events-none absolute left-4 top-3 whitespace-nowrap rounded-full bg-black/75 px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)] backdrop-blur-xs">
                Original Photo
              </span>
            </div>
          )}

          {/* Peek source badge */}
          {peekSource && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-[var(--text-primary)] backdrop-blur-xs">
              Original Photo
            </div>
          )}

          {/* Gamut warning legend (only visible when Pro Gamut Warning is turned on) */}
          {showGamutWarning && !peekSource && (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/80 px-3 py-1 text-xs text-[#f27ca8] backdrop-blur-xs">
              Outside paint gamut (&Delta;E &gt; {GAMUT_WARNING_DE}):{" "}
              {outOfGamutPercent.toFixed(1)}%
            </div>
          )}
        </div>
      )}

      {/* Floating Bottom Pill Bar for the 4 Everyday Easel Tools */}
      {!cropMode && <CanvasToolbar />}

      {/* Floating Color Inspector Popover */}
      {!cropMode && !focalPointMode && inspectedPixel && (
        <div className="absolute right-4 top-4 z-30">
          <ColorInspector
            pixel={inspectedPixel}
            pigments={activePigments}
            valueWeight={valueWeight}
            onClose={() => setInspectedPixel(null)}
          />
        </div>
      )}
    </div>
  );
}
