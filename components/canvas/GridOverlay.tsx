"use client";

import type { GridConfig } from "@/lib/types";

interface GridOverlayProps {
  config: GridConfig;
  canvasWidthIn: number;
  canvasHeightIn: number;
}

const STROKE_MAP: Record<GridConfig["color"], string> = {
  light: "#f5f1ea",
  dark: "#141311",
  accent: "#d8a56d",
};

function colLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function GridOverlay({
  config,
  canvasWidthIn,
  canvasHeightIn,
}: GridOverlayProps) {
  if (config.mode === "off") return null;

  const stroke = STROKE_MAP[config.color];
  const verticalLines: { pct: number; label: string }[] = [];
  const horizontalLines: { pct: number; label: string }[] = [];

  if (config.mode === "divisions") {
    const cols = Math.max(1, Math.min(24, Math.round(config.cols)));
    const rows = Math.max(1, Math.min(24, Math.round(config.rows)));

    for (let i = 1; i < cols; i++) {
      verticalLines.push({ pct: (i / cols) * 100, label: "" });
    }
    for (let j = 1; j < rows; j++) {
      horizontalLines.push({ pct: (j / rows) * 100, label: "" });
    }

    return (
      <div
        className="pointer-events-none absolute inset-0 select-none overflow-hidden"
        aria-hidden="true"
      >
        <svg className="h-full w-full" preserveAspectRatio="none">
          {verticalLines.map((line, i) => (
            <line
              key={`v-${i}`}
              x1={`${line.pct}%`}
              y1="0%"
              x2={`${line.pct}%`}
              y2="100%"
              stroke={stroke}
              strokeOpacity={config.opacity}
              strokeWidth={1}
            />
          ))}
          {horizontalLines.map((line, i) => (
            <line
              key={`h-${i}`}
              x1="0%"
              y1={`${line.pct}%`}
              x2="100%"
              y2={`${line.pct}%`}
              stroke={stroke}
              strokeOpacity={config.opacity}
              strokeWidth={1}
            />
          ))}
        </svg>

        {config.showLabels && (
          <>
            {/* Top column labels A, B, C... */}
            <div className="absolute inset-x-0 top-1 flex">
              {Array.from({ length: cols }).map((_, i) => (
                <div
                  key={`cl-${i}`}
                  className="flex-1 text-center font-mono-num text-[10px] font-medium"
                  style={{
                    color: stroke,
                    opacity: Math.min(1, config.opacity + 0.35),
                    textShadow: "0 1px 2px rgba(0,0,0,0.85)",
                  }}
                >
                  {colLabel(i)}
                </div>
              ))}
            </div>
            {/* Left row labels 1, 2, 3... */}
            <div className="absolute inset-y-0 left-1.5 flex flex-col">
              {Array.from({ length: rows }).map((_, i) => (
                <div
                  key={`rl-${i}`}
                  className="flex flex-1 items-center font-mono-num text-[10px] font-medium"
                  style={{
                    color: stroke,
                    opacity: Math.min(1, config.opacity + 0.35),
                    textShadow: "0 1px 2px rgba(0,0,0,0.85)",
                  }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Physical inches mode
  const step = Math.max(0.5, config.inchStep);
  const xCount = Math.floor(canvasWidthIn / step);
  const yCount = Math.floor(canvasHeightIn / step);

  for (let i = 1; i <= xCount; i++) {
    const inch = i * step;
    if (inch < canvasWidthIn - 1e-3) {
      verticalLines.push({
        pct: (inch / canvasWidthIn) * 100,
        label: `${inch}"`,
      });
    }
  }
  for (let j = 1; j <= yCount; j++) {
    const inch = j * step;
    if (inch < canvasHeightIn - 1e-3) {
      horizontalLines.push({
        pct: (inch / canvasHeightIn) * 100,
        label: `${inch}"`,
      });
    }
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      aria-hidden="true"
    >
      <svg className="h-full w-full" preserveAspectRatio="none">
        {verticalLines.map((line, i) => (
          <line
            key={`vi-${i}`}
            x1={`${line.pct}%`}
            y1="0%"
            x2={`${line.pct}%`}
            y2="100%"
            stroke={stroke}
            strokeOpacity={config.opacity}
            strokeWidth={1}
          />
        ))}
        {horizontalLines.map((line, i) => (
          <line
            key={`hi-${i}`}
            x1="0%"
            y1={`${line.pct}%`}
            x2="100%"
            y2={`${line.pct}%`}
            stroke={stroke}
            strokeOpacity={config.opacity}
            strokeWidth={1}
          />
        ))}
      </svg>

      {config.showLabels && (
        <>
          {verticalLines.map((line, i) => (
            <span
              key={`vil-${i}`}
              className="absolute top-1 -translate-x-1/2 font-mono-num text-[10px] font-medium"
              style={{
                left: `${line.pct}%`,
                color: stroke,
                opacity: Math.min(1, config.opacity + 0.35),
                textShadow: "0 1px 2px rgba(0,0,0,0.85)",
              }}
            >
              {line.label}
            </span>
          ))}
          {horizontalLines.map((line, i) => (
            <span
              key={`hil-${i}`}
              className="absolute left-1.5 -translate-y-1/2 font-mono-num text-[10px] font-medium"
              style={{
                top: `${line.pct}%`,
                color: stroke,
                opacity: Math.min(1, config.opacity + 0.35),
                textShadow: "0 1px 2px rgba(0,0,0,0.85)",
              }}
            >
              {line.label}
            </span>
          ))}
        </>
      )}
    </div>
  );
}
