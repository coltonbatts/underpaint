"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useProjectStore } from "@/lib/store/projectStore";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";

export default function ProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const project = useProjectStore((s) => s.project);
  const loading = useProjectStore((s) => s.loading);
  const error = useProjectStore((s) => s.error);
  const loadProject = useProjectStore((s) => s.loadProject);
  const clearProject = useProjectStore((s) => s.clearProject);

  useEffect(() => {
    if (projectId) {
      void loadProject(projectId);
    }
    return () => clearProject();
  }, [projectId, loadProject, clearProject]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2.5 bg-[var(--bg-canvas)] text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
        Opening your study…
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-canvas)] text-center">
        <p className="text-[15px] text-[var(--text-secondary)]">
          {error ?? "We couldn't find that study."}
        </p>
        <Link
          href="/"
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          Back to Studies
        </Link>
      </div>
    );
  }

  return <WorkspaceShell project={project} />;
}
