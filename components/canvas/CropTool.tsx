"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CropRect } from "@/lib/types";

interface CropToolProps {
  crop: CropRect;
  sourceWidth: number;
  sourceHeight: number;
  canvasWidthIn: number;
  canvasHeightIn: number;
  onChange: (next: CropRect) => void;
}

type DragKind = "move" | "nw" | "ne" | "sw" | "se";

interface DragState {
  kind: DragKind;
  startX: number;
  startY: number;
  startCrop: CropRect;
  boxWidth: number;
  boxHeight: number;
}

const MIN_SIZE = 0.08;

export function CropTool({
  crop,
  sourceWidth,
  sourceHeight,
  canvasWidthIn,
  canvasHeightIn,
  onChange,
}: CropToolProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [draftCrop, setDraftCrop] = useState<CropRect | null>(null);
  const draftCropRef = useRef<CropRect | null>(null);

  // Sync draft when external crop changes while not dragging
  useEffect(() => {
    if (!drag) {
      draftCropRef.current = null;
      setDraftCrop(null);
    }
  }, [crop, drag]);

  // Normalized height/width ratio so the crop box matches canvas aspect ratio
  // In pixel space: (w * sourceWidth) / (h * sourceHeight) = canvasWidthIn / canvasHeightIn
  // => w / h = (canvasWidthIn / canvasHeightIn) * (sourceHeight / sourceWidth)
  const normAspect =
    (canvasWidthIn / canvasHeightIn) * (sourceHeight / sourceWidth);

  const startDrag = useCallback(
    (kind: DragKind, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const start = draftCropRef.current ?? crop;
      setDrag({
        kind,
        startX: e.clientX,
        startY: e.clientY,
        startCrop: start,
        boxWidth: rect.width,
        boxHeight: rect.height,
      });
    },
    [crop]
  );

  useEffect(() => {
    if (!drag) return;

    const updateDraft = (next: CropRect) => {
      draftCropRef.current = next;
      setDraftCrop(next);
    };

    const handleMove = (e: PointerEvent) => {
      const dx = (e.clientX - drag.startX) / drag.boxWidth;
      const dy = (e.clientY - drag.startY) / drag.boxHeight;
      const sc = drag.startCrop;

      if (drag.kind === "move") {
        const x = Math.max(0, Math.min(1 - sc.w, sc.x + dx));
        const y = Math.max(0, Math.min(1 - sc.h, sc.y + dy));
        updateDraft({ x, y, w: sc.w, h: sc.h });
        return;
      }

      // Anchor opposite corner and compute aspect-locked dimensions
      let anchorX = sc.x;
      let anchorY = sc.y;
      let rawW = sc.w;

      if (drag.kind === "se") {
        anchorX = sc.x;
        anchorY = sc.y;
        rawW = Math.max(sc.w + dx, (sc.h + dy) * normAspect);
      } else if (drag.kind === "sw") {
        anchorX = sc.x + sc.w;
        anchorY = sc.y;
        rawW = Math.max(sc.w - dx, (sc.h + dy) * normAspect);
      } else if (drag.kind === "ne") {
        anchorX = sc.x;
        anchorY = sc.y + sc.h;
        rawW = Math.max(sc.w + dx, (sc.h - dy) * normAspect);
      } else if (drag.kind === "nw") {
        anchorX = sc.x + sc.w;
        anchorY = sc.y + sc.h;
        rawW = Math.max(sc.w - dx, (sc.h - dy) * normAspect);
      }

      // Max width allowed by container bounds from the anchor corner
      const maxWByX =
        drag.kind === "se" || drag.kind === "ne" ? 1 - anchorX : anchorX;
      const maxHByY =
        drag.kind === "se" || drag.kind === "sw" ? 1 - anchorY : anchorY;
      const maxW = Math.min(maxWByX, maxHByY * normAspect);
      const minW = Math.max(MIN_SIZE, MIN_SIZE * normAspect);

      const w = Math.max(minW, Math.min(maxW, rawW));
      const h = w / normAspect;

      const x =
        drag.kind === "se" || drag.kind === "ne" ? anchorX : anchorX - w;
      const y =
        drag.kind === "se" || drag.kind === "sw" ? anchorY : anchorY - h;

      updateDraft({
        x: Math.max(0, Math.min(1 - w, x)),
        y: Math.max(0, Math.min(1 - h, y)),
        w,
        h,
      });
    };

    const handleUp = () => {
      const committed = draftCropRef.current;
      setDrag(null);
      if (committed) {
        onChange(committed);
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [drag, normAspect, onChange]);

  const activeCrop = draftCrop ?? crop;
  const cropPxW = Math.round(activeCrop.w * sourceWidth);
  const cropPxH = Math.round(activeCrop.h * sourceHeight);
  const pxPerIn = Math.round(cropPxW / canvasWidthIn);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 select-none touch-none"
    >
      {/* Dimmed exterior masks */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 bg-black/65"
        style={{ height: `${activeCrop.y * 100}%` }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/65"
        style={{ height: `${(1 - activeCrop.y - activeCrop.h) * 100}%` }}
      />
      <div
        className="pointer-events-none absolute left-0 bg-black/65"
        style={{
          top: `${activeCrop.y * 100}%`,
          height: `${activeCrop.h * 100}%`,
          width: `${activeCrop.x * 100}%`,
        }}
      />
      <div
        className="pointer-events-none absolute right-0 bg-black/65"
        style={{
          top: `${activeCrop.y * 100}%`,
          height: `${activeCrop.h * 100}%`,
          width: `${(1 - activeCrop.x - activeCrop.w) * 100}%`,
        }}
      />

      {/* Interactive crop frame */}
      <div
        onPointerDown={(e) => startDrag("move", e)}
        className="absolute cursor-move border border-[var(--accent)] shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
        style={{
          left: `${activeCrop.x * 100}%`,
          top: `${activeCrop.y * 100}%`,
          width: `${activeCrop.w * 100}%`,
          height: `${activeCrop.h * 100}%`,
        }}
      >
        {/* Subtle rule-of-thirds guides */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/20" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/20" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/20" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/20" />
        </div>

        {/* Corner resize handles */}
        {(
          [
            { kind: "nw", cls: "-left-1.5 -top-1.5 cursor-nwse-resize" },
            { kind: "ne", cls: "-right-1.5 -top-1.5 cursor-nesw-resize" },
            { kind: "sw", cls: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
            { kind: "se", cls: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
          ] as const
        ).map((h) => (
          <button
            key={h.kind}
            type="button"
            aria-label={`Resize crop ${h.kind}`}
            onPointerDown={(e) => startDrag(h.kind, e)}
            className={`absolute h-3 w-3 rounded-[2px] border border-[var(--bg-canvas)] bg-[var(--accent)] ${h.cls}`}
          />
        ))}

        {/* Readout pill */}
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/75 px-2 py-0.5 font-mono-num text-[11px] text-[var(--text-primary)]">
          {canvasWidthIn}&times;{canvasHeightIn}&Prime; &middot; {cropPxW}&times;
          {cropPxH}px &middot; {pxPerIn} px/in
        </div>
      </div>
    </div>
  );
}
