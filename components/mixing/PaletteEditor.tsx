"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Palette } from "lucide-react";
import type { PaletteId } from "@/lib/types";
import { getPigmentSwatchHex, PIGMENTS } from "@/lib/data/pigments";
import { getActivePigmentIds } from "@/lib/data/palettes";
import { useViewportStore } from "@/lib/store/viewportStore";

interface PaletteEditorProps {
  paletteId: PaletteId;
  customPigmentIds?: string[];
  onSelectPreset: (id: PaletteId) => void;
  onUpdateCustom: (pigmentIds: string[]) => void;
}

export function PaletteEditor({
  paletteId,
  customPigmentIds,
  onSelectPreset,
  onUpdateCustom,
}: PaletteEditorProps) {
  const proMode = useViewportStore((s) => s.proMode);
  const [expanded, setExpanded] = useState(false);
  const activeIds = new Set(getActivePigmentIds(paletteId, customPigmentIds));

  const togglePigment = (id: string) => {
    const next = new Set(activeIds);
    if (next.has(id)) {
      if (next.size <= 1) return; // keep at least 1 tube
      next.delete(id);
    } else {
      next.add(id);
    }
    onUpdateCustom(Array.from(next));
  };

  return (
    <section className="space-y-3 border-t border-[var(--border-subtle)] pt-5">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <Palette className="h-4 w-4 text-[var(--accent)]" />
          Your Paint Tubes
        </h3>
        <span className="text-xs text-[var(--text-muted)]">
          {activeIds.size} of {PIGMENTS.length} active
        </span>
      </div>

      {/* Preset switcher */}
      <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-md)] bg-[var(--bg-canvas)] p-1">
        {(
          [
            { id: "standard-limited", label: "Standard (9)" },
            { id: "zorn", label: "Zorn (4)" },
            { id: "custom", label: "Custom" },
          ] as { id: PaletteId; label: string }[]
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              if (opt.id === "custom") {
                setExpanded(true);
                onUpdateCustom(Array.from(activeIds));
              } else {
                onSelectPreset(opt.id);
              }
            }}
            className={`rounded-[var(--radius-sm)] py-1.5 text-xs font-medium transition-colors duration-150 ${
              paletteId === opt.id
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Compact pigment swatch strip + expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {PIGMENTS.filter((p) => activeIds.has(p.id)).map((p) => (
            <span
              key={p.id}
              title={p.name}
              className="h-4 w-4 rounded-[4px] border border-white/15"
              style={{ backgroundColor: getPigmentSwatchHex(p) }}
            />
          ))}
        </div>
        <span className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs text-[var(--text-muted)]">
          {expanded ? "Hide" : "Edit"}
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>

      {/* Tube checklist */}
      {expanded && (
        <div className="space-y-1 pt-0.5">
          {PIGMENTS.map((pig) => {
            const checked = activeIds.has(pig.id);
            return (
              <label
                key={pig.id}
                className="flex cursor-pointer items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13.5px] transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePigment(pig.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-[4px] border border-white/15"
                    style={{ backgroundColor: getPigmentSwatchHex(pig) }}
                  />
                  <span
                    className={
                      checked
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] line-through"
                    }
                  >
                    {pig.name}
                  </span>
                </span>
                {proMode && pig.colorIndex && (
                  <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                    {pig.colorIndex}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
