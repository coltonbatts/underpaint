"use client";

import { useEffect, useRef, useState } from "react";
import {
  Columns2,
  Contrast,
  Eye,
  Grid3X3,
  SlidersHorizontal,
} from "lucide-react";
import { useViewportStore } from "@/lib/store/viewportStore";
import { GridSettingsPopover } from "./GridSettingsPopover";

export function CanvasToolbar() {
  const holdTimerRef = useRef<number | null>(null);
  const heldPeekRef = useRef(false);
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

  const grayscale = useViewportStore((s) => s.grayscale);
  const toggleGrayscale = useViewportStore((s) => s.toggleGrayscale);
  const squint = useViewportStore((s) => s.squint);
  const toggleSquint = useViewportStore((s) => s.toggleSquint);
  const splitView = useViewportStore((s) => s.splitView);
  const toggleSplitView = useViewportStore((s) => s.toggleSplitView);
  const peekSource = useViewportStore((s) => s.peekSource);
  const setPeekSource = useViewportStore((s) => s.setPeekSource);
  const grid = useViewportStore((s) => s.grid);
  const toggleGrid = useViewportStore((s) => s.toggleGrid);
  const updateGrid = useViewportStore((s) => s.updateGrid);

  useEffect(() => {
    if (grid.mode === "off") {
      setGridSettingsOpen(false);
    }
  }, [grid.mode]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  // Compare to Photo button supports both quick click (toggle split) & hold (peek original photo)
  const handleComparePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    heldPeekRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      heldPeekRef.current = true;
      setPeekSource(true);
    }, 240);
  };

  const handleComparePointerUp = (
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (heldPeekRef.current) {
      heldPeekRef.current = false;
      setPeekSource(false);
    } else {
      toggleSplitView();
    }
  };

  const handleComparePointerCancel = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (heldPeekRef.current) {
      heldPeekRef.current = false;
      setPeekSource(false);
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 z-20 max-w-[calc(100%-1.5rem)] -translate-x-1/2">
      {gridSettingsOpen && grid.mode !== "off" && (
        <div className="flex justify-center">
          <GridSettingsPopover
            grid={grid}
            onUpdate={updateGrid}
            onClose={() => setGridSettingsOpen(false)}
          />
        </div>
      )}

      <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/92 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-md">
        <button
          type="button"
          onPointerDown={handleComparePointerDown}
          onPointerUp={handleComparePointerUp}
          onPointerCancel={handleComparePointerCancel}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              toggleSplitView();
            }
          }}
          title="Click to split compare, or hold to peek at the original photo"
          className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
            splitView || peekSource
              ? "bg-[var(--accent)] text-[#141210]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Columns2 className="h-4 w-4" />
          <span>Compare to Photo</span>
        </button>

        <button
          type="button"
          onClick={toggleGrayscale}
          title="View in black & white to check lights and darks (G)"
          className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
            grayscale
              ? "bg-[var(--accent)] text-[#141210]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Contrast className="h-4 w-4" />
          <span>Black &amp; White</span>
        </button>

        <button
          type="button"
          onClick={toggleSquint}
          title="Blur away tiny details to see big shapes (S)"
          className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
            squint
              ? "bg-[var(--accent)] text-[#141210]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Eye className="h-4 w-4" />
          <span>Squint Blur</span>
        </button>

        <div className="flex items-center">
          <button
            type="button"
            onClick={toggleGrid}
            title="Toggle measuring grid overlay (#)"
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
              grid.mode !== "off"
                ? "bg-[var(--accent)] text-[#141210]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
            <span>Grid</span>
          </button>

          {grid.mode !== "off" && (
            <button
              type="button"
              onClick={() => setGridSettingsOpen((v) => !v)}
              title="Grid settings"
              aria-label="Grid settings"
              className={`ml-0.5 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                gridSettingsOpen
                  ? "bg-[var(--bg-elevated)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
