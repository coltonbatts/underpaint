"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ValueCheckCardProps {
  targetValue: number; // 0..10
  mixedValue: number; // 0..10
}

function valueToGrayCss(val0to10: number): string {
  const pct = Math.max(0, Math.min(1, val0to10 / 10));
  const byte = Math.round(Math.pow(pct, 1 / 1.15) * 248);
  return `rgb(${byte}, ${byte}, ${byte})`;
}

export function ValueCheckCard({
  targetValue,
  mixedValue,
}: ValueCheckCardProps) {
  const delta = mixedValue - targetValue;
  const absDelta = Math.abs(delta);

  const status: "spot-on" | "too-light" | "too-dark" =
    absDelta <= 0.45
      ? "spot-on"
      : delta > 0
        ? "too-light"
        : "too-dark";

  const badgeLabel =
    status === "spot-on"
      ? "Spot on"
      : status === "too-light"
        ? "A little too light"
        : "A little too dark";

  const tipText =
    status === "spot-on"
      ? "Brightness matches the photo well — just fine-tune warmth or coolness by eye."
      : status === "too-light"
        ? "Use slightly less Titanium White, or add a tiny dab of Burnt Umber to darken it."
        : "Add a tiny dab more Titanium White (or Yellow Ochre for warm areas) to brighten it.";

  return (
    <div className="space-y-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Lightness Check
        </span>
        {status === "spot-on" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ok-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ok)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {badgeLabel}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warn-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--warn)]">
            <AlertCircle className="h-3.5 w-3.5" />
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Abutting grayscale swatches so the eye compares brightness directly */}
      <div className="flex h-9 w-full overflow-hidden rounded-[8px] border border-[var(--border-default)]">
        <div
          className="flex flex-1 items-center justify-start px-2.5"
          style={{ backgroundColor: valueToGrayCss(targetValue) }}
        >
          <span className="rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">
            Photo
          </span>
        </div>
        <div
          className="flex flex-1 items-center justify-end px-2.5"
          style={{ backgroundColor: valueToGrayCss(mixedValue) }}
        >
          <span className="rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">
            Your Mix
          </span>
        </div>
      </div>

      <p className="text-[13px] leading-snug text-[var(--text-secondary)]">
        {tipText}
      </p>
    </div>
  );
}
