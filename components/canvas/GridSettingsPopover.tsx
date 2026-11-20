"use client";

import { X } from "lucide-react";
import type { GridConfig, GridMode } from "@/lib/types";

interface GridSettingsPopoverProps {
  grid: GridConfig;
  onUpdate: (patch: Partial<GridConfig>) => void;
  onClose: () => void;
}

export function GridSettingsPopover({
  grid,
  onUpdate,
  onClose,
}: GridSettingsPopoverProps) {
  return (
    <div className="mb-2.5 w-72 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-float)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Grid Options
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close grid options"
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3 text-[13px]">
        <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-canvas)] p-1">
          {(
            [
              { id: "inches", label: "By Inches" },
              { id: "divisions", label: "Equal Squares" },
            ] as { id: GridMode; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onUpdate({ mode: opt.id })}
              className={`rounded-[6px] py-1.5 text-xs font-medium transition-colors ${
                grid.mode === opt.id
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {grid.mode === "inches" ? (
          <div className="space-y-1.5">
            <span className="block text-xs text-[var(--text-muted)]">
              Square size on your canvas
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((inch) => (
                <button
                  key={inch}
                  type="button"
                  onClick={() => onUpdate({ inchStep: inch })}
                  className={`rounded-[8px] border py-1.5 text-xs font-medium transition-colors ${
                    grid.inchStep === inch
                      ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--text-primary)]"
                      : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {inch}&Prime;
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <label className="space-y-1">
              <span className="block text-xs text-[var(--text-muted)]">
                Columns
              </span>
              <input
                type="number"
                min={1}
                max={24}
                value={grid.cols}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) {
                    onUpdate({ cols: Math.max(1, Math.min(24, v)) });
                  }
                }}
                className="w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-[var(--text-muted)]">
                Rows
              </span>
              <input
                type="number"
                min={1}
                max={24}
                value={grid.rows}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) {
                    onUpdate({ rows: Math.max(1, Math.min(24, v)) });
                  }
                }}
                className="w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">Line opacity</span>
            <span className="text-[var(--text-secondary)]">
              {Math.round(grid.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.15}
            max={0.9}
            step={0.05}
            value={grid.opacity}
            onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
            className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
          />
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={grid.showLabels}
              onChange={(e) => onUpdate({ showLabels: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Edge labels
          </label>

          <div className="flex items-center gap-1.5">
            {(
              [
                { id: "light", swatch: "#f5f1ea" },
                { id: "accent", swatch: "#d8a56d" },
                { id: "dark", swatch: "#1c1a17" },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                title={`Grid color: ${c.id}`}
                aria-label={`Grid color: ${c.id}`}
                onClick={() => onUpdate({ color: c.id })}
                className={`h-5 w-5 rounded-full border transition-transform ${
                  grid.color === c.id
                    ? "scale-110 border-[var(--accent)]"
                    : "border-[var(--border-strong)]"
                }`}
                style={{ backgroundColor: c.swatch }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
