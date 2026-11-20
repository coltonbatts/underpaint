"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { GAMUT_WARNING_DE } from "@/lib/store/mixingStore";
import { rgbBytesToValue } from "@/lib/color/valueScale";

export type PreparedSource = {
  imageData: ImageData;
  bitmap: ImageBitmap;
  w: number;
  h: number;
};

/**
 * Decodes the project's source Blob, prepares a cropped working-resolution
 * ImageData + ImageBitmap (only recomputing when crop or workingRes changes),
 * and derives reusable R8 overlay buffers for the GPU display pipeline.
 */
export function usePreparedSource(
  project: Project,
  fineDeltaE: Float32Array | null
) {
  const preparedRef = useRef<PreparedSource | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [sourceReadyTick, setSourceReadyTick] = useState(0);

  const cropX = project.canvas.crop.x;
  const cropY = project.canvas.crop.y;
  const cropW = project.canvas.crop.w;
  const cropH = project.canvas.crop.h;
  const analysisW = project.analysis?.workingRes.w;
  const analysisH = project.analysis?.workingRes.h;
  const fineLabels = project.analysis?.segments[1]?.labels;

  // 1. Decode project.sourceImage into an HTMLImageElement
  useEffect(() => {
    const url = URL.createObjectURL(project.sourceImage);
    setImageUrl(url);

    const img = new Image();
    img.onload = () => setLoadedImage(img);
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
      setLoadedImage(null);
    };
  }, [project.sourceImage]);

  // 2. Prepare cropped working-resolution ImageData + ImageBitmap once per crop / workingRes
  useEffect(() => {
    if (!loadedImage) return;
    let cancelled = false;

    const sx = Math.round(cropX * loadedImage.naturalWidth);
    const sy = Math.round(cropY * loadedImage.naturalHeight);
    const sw = Math.max(1, Math.round(cropW * loadedImage.naturalWidth));
    const sh = Math.max(1, Math.round(cropH * loadedImage.naturalHeight));

    const dw = analysisW ?? Math.min(1024, sw);
    const dh = analysisH ?? Math.max(1, Math.round((dw / sw) * sh));

    const offscreen = document.createElement("canvas");
    offscreen.width = dw;
    offscreen.height = dh;
    const octx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!octx) return;

    octx.drawImage(loadedImage, sx, sy, sw, sh, 0, 0, dw, dh);
    const imageData = octx.getImageData(0, 0, dw, dh);

    void createImageBitmap(offscreen).then((bitmap) => {
      if (cancelled) {
        bitmap.close();
        return;
      }
      preparedRef.current?.bitmap.close();
      preparedRef.current = { imageData, bitmap, w: dw, h: dh };
      setSourceReadyTick((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [loadedImage, cropX, cropY, cropW, cropH, analysisW, analysisH]);

  // Cleanup prepared bitmap on unmount
  useEffect(() => {
    return () => {
      preparedRef.current?.bitmap.close();
      preparedRef.current = null;
    };
  }, []);

  // Precompute binary out-of-gamut mask once per palette/analysis change (for GPU R8 texture)
  const gamutMask = useMemo(() => {
    if (!fineLabels || !fineDeltaE) return null;
    const mask = new Uint8Array(fineLabels.length);
    for (let i = 0; i < fineLabels.length; i++) {
      const seg = fineLabels[i] ?? 0;
      mask[i] = (fineDeltaE[seg] ?? 0) > GAMUT_WARNING_DE ? 255 : 0;
    }
    return mask;
  }, [fineLabels, fineDeltaE]);

  // Fallback CIELAB continuous value buffer for legacy v1-saved studies missing analysis.valueContinuous
  const valueContinuousBuffer = useMemo(() => {
    const existing = project.analysis?.valueContinuous;
    if (existing) return existing;
    const prepared = preparedRef.current;
    if (!prepared) return null;
    const pixelCount = prepared.w * prepared.h;
    const src = prepared.imageData.data;
    const buf = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const off = i * 4;
      const v = rgbBytesToValue(
        src[off] ?? 0,
        src[off + 1] ?? 0,
        src[off + 2] ?? 0
      );
      buf[i] = Math.min(255, Math.max(0, Math.round((v / 10) * 255)));
    }
    return buf;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.analysis?.valueContinuous, sourceReadyTick]);

  return {
    preparedRef,
    imageUrl,
    sourceReadyTick,
    gamutMask,
    valueContinuousBuffer,
  };
}
