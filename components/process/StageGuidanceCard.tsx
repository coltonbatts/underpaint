"use client";

import {
  AlertCircle,
  Brush,
  CheckCircle2,
  Droplets,
  Layers,
  Palette,
} from "lucide-react";
import type { ProcessStage } from "@/lib/types";

interface StageGuidanceCardProps {
  stageIndex: number;
  totalSteps?: number;
  stage: ProcessStage;
}

export function StageGuidanceCard({
  stageIndex,
  totalSteps = 5,
  stage,
}: StageGuidanceCardProps) {
  const { guidance } = stage;

  return (
    <div className="space-y-5 text-[14px]">
      {/* Step Header + Goal */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[var(--accent-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
            Step {stageIndex + 1} of {totalSteps}
          </span>
        </div>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          {stage.name}
        </h2>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Goal
          </h3>
          <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
            {guidance.goal}
          </p>
        </div>
      </section>

      {/* What You Need */}
      <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          What You Need
        </h3>

        <dl className="space-y-3 text-[13.5px]">
          <div className="flex gap-2.5">
            <Palette className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Paint</dt>
              <dd className="mt-0.5 leading-snug text-[var(--text-secondary)]">
                {guidance.paints}
              </dd>
            </div>
          </div>

          <div className="flex gap-2.5">
            <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <div>
              <dt className="font-medium text-[var(--text-primary)]">
                Thinner / Medium
              </dt>
              <dd className="mt-0.5 leading-snug text-[var(--text-secondary)]">
                {guidance.medium}
              </dd>
            </div>
          </div>

          <div className="flex gap-2.5">
            <Brush className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <div>
              <dt className="font-medium text-[var(--text-primary)]">
                Brushes
              </dt>
              <dd className="mt-0.5 leading-snug text-[var(--text-secondary)]">
                {guidance.brushes}
              </dd>
            </div>
          </div>

          <div className="flex gap-2.5 border-t border-[var(--border-subtle)] pt-2.5">
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <div>
              <dt className="font-medium text-[var(--text-primary)]">
                Paint Thickness
              </dt>
              <dd className="mt-0.5 leading-snug text-[var(--text-secondary)]">
                {guidance.fatOverLean}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      {/* Quick Tips */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Quick Tips
        </h3>

        <ul className="space-y-2.5 text-[13.5px] leading-snug text-[var(--text-secondary)]">
          {guidance.lookFor.map((item, i) => (
            <li key={`tip-${i}`} className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ok)]" />
              <span>{item}</span>
            </li>
          ))}
          {guidance.commonMistakes.map((item, i) => (
            <li key={`watch-${i}`} className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warn)]" />
              <span>
                <strong className="font-medium text-[var(--text-primary)]">
                  Avoid:{" "}
                </strong>
                {item}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
