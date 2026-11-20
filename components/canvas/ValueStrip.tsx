"use client";

import { useCallback, useRef } from "react";
import { X } from "lucide-react";
import { useViewportStore } from "@/lib/store/viewportStore";
import { describeValue } from "@/lib/color/valueScale";

const STEPS_DESC = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

export function ValueStrip() {
  const trackRef = useRef<HTMLDivElement>(null);
  const hoveredValue = useViewportStore((s) => s.hoveredValue);
  const stripMarkerValue = useViewportStore((s) => s.stripMarkerValue);
  const setStripMarkerValue = useViewportStore((s) => s.setStripMarkerValue);

  const updateFromClientY = useCallback(
    (clientY: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const norm = 1 - (clientY - rect.top) / rect.height;
      const clamped = Math.max(0, Math.min(10, Math.round(norm * 100) / 10));
      setStripMarkerValue(clamped);
    },
    [setStripMarkerValue]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientY(e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    updateFromClientY(e.clientY);
  };

  const activeDisplay =
    hoveredValue !== null ? hoveredValue : stripMarkerValue;

  return (
    <div className="flex w-12 shrink-0 select-none flex-col items-center justify-between border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] py-3">
      {/* Top readout */}
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Val
        </span>
        <span className="font-mono-num text-xs font-medium text-[var(--text-primary)]">
          {activeDisplay !== null ? activeDisplay.toFixed(1) : "—"}
        </span>
      </div>

      {/* Interactive 10 -> 0 vertical strip */}
      <div className="relative my-3 flex flex-1 items-center">
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onDoubleClick={() => setStripMarkerValue(null)}
          title="Drag to isolate a value range on the canvas (double-click to clear)"
          className="relative flex h-full w-5 cursor-ns-resize flex-col overflow-hidden rounded-[2px] border border-[var(--border-default)] touch-none"
        >
          {STEPS_DESC.map((step) => {
            const pct = step / 10;
            // Approximate perceptual grayscale for strip display
            const byte = Math.round(Math.pow(pct, 1 / 1.15) * 245);
            return (
              <div
                key={step}
                className="flex-1"
                style={{ backgroundColor: `rgb(${byte},${byte},${byte})` }}
              />
            );
          })}

          {/* Hovered pixel indicator */}
          {hoveredValue !== null && (
            <div
              className="pointer-events-none absolute inset-x-0 h-[2px] bg-[var(--accent)] shadow-[0_0_4px_rgba(0,0,0,0.9)]"
              style={{ top: `${(1 - hoveredValue / 10) * 100}%` }}
            />
          )}

          {/* Draggable pinned marker */}
          {stripMarkerValue !== null && (
            <div
              className="pointer-events-none absolute -left-0.5 -right-0.5 h-2 -translate-y-1/2 rounded-[1px] border border-[#141210] bg-[var(--accent)]"
              style={{ top: `${(1 - stripMarkerValue / 10) * 100}%` }}
            />
          )}
        </div>

        {/* Numeric scale ticks on the left of the bar */}
        <div className="pointer-events-none absolute -left-3.5 inset-y-0 flex flex-col justify-between py-0.5 font-mono-num text-[9px] text-[var(--text-muted)]">
          <span>10</span>
          <span>5</span>
          <span>0</span>
        </div>
      </div>

      {/* Footer status / clear button */}
      <div className="flex min-h-[28px] flex-col items-center justify-center px-1 text-center">
        {stripMarkerValue !== null ? (
          <button
            type="button"
            onClick={() => setStripMarkerValue(null)}
            title="Clear value isolation marker"
            className="inline-flex items-center gap-0.5 rounded bg-[var(--accent-muted)] px-1.5 py-0.5 font-mono-num text-[10px] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[#141210]"
          >
            {stripMarkerValue.toFixed(1)}
            <X className="h-2.5 w-2.5" />
          </button>
        ) : (
          <span className="text-[9px] leading-tight text-[var(--text-muted)]">
            {hoveredValue !== null ? describeValue(hoveredValue) : "0–10"}
          </span>
        )}
      </div>
    </div>
  );
}
