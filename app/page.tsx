"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Brush,
  ImagePlus,
  Layers,
  Loader2,
  Pipette,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ProjectSummary } from "@/lib/types";
import {
  createProjectFromBlob,
  deleteProject,
  listProjects,
} from "@/lib/db/projectsDb";
import { generateSampleStudyBlob } from "@/lib/sampleStudy";

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectSummary;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!project.thumbnail) {
      setThumbUrl(null);
      return;
    }
    const url = URL.createObjectURL(project.thumbnail);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [project.thumbnail]);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-left shadow-[var(--shadow-card)] transition-all duration-150 hover:border-[var(--border-strong)]">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 cursor-pointer flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--bg-canvas)]">
          {thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt={project.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          )}
        </div>

        <div className="flex w-full items-center justify-between gap-2 px-4 py-3.5">
          <span className="truncate text-[15px] font-medium text-[var(--text-primary)]">
            {project.name}
          </span>
          <span className="shrink-0 rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
            {project.canvas.widthIn}&times;{project.canvas.heightIn}&Prime;
          </span>
        </div>
      </button>

      {/* Sibling delete button (valid HTML — not nested inside another button) */}
      {!confirmingDelete && (
        <button
          type="button"
          title="Delete study"
          aria-label={`Delete ${project.name}`}
          onClick={() => setConfirmingDelete(true)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-black/65 text-[var(--text-secondary)] opacity-80 backdrop-blur-xs transition-all duration-150 hover:bg-[var(--danger)] hover:text-white focus:opacity-100 sm:opacity-50 sm:group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {/* Inline confirmation overlay before deleting */}
      {confirmingDelete && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center backdrop-blur-xs">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Delete &ldquo;{project.name}&rdquo;?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(false);
                onDelete();
              }}
              className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingSample, setCreatingSample] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    try {
      const items = await listProjects();
      setProjects(items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load your saved studies."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please choose a PNG, WebP, or JPEG photo.");
        return;
      }
      setError(null);
      setCreating(true);
      try {
        const project = await createProjectFromBlob(file, file.name);
        router.push(`/project/${project.id}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not open that image."
        );
        setCreating(false);
      }
    },
    [router]
  );

  const handleTrySample = useCallback(async () => {
    if (creating || creatingSample) return;
    setError(null);
    setCreatingSample(true);
    try {
      const blob = await generateSampleStudyBlob();
      const project = await createProjectFromBlob(
        blob,
        "Still Life with Citrus"
      );
      router.push(`/project/${project.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create sample study."
      );
      setCreatingSample(false);
    }
  }, [creating, creatingSample, router]);

  // Support Cmd+V / Ctrl+V clipboard image paste anywhere on the home page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const ext = blob.type.split("/")[1] || "png";
            const file = new File([blob], `Pasted Study.${ext}`, {
              type: blob.type,
            });
            void handleImportFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleImportFile]);

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-5xl px-6 py-12 sm:py-14">
        {/* Clean Modern Header */}
        <header className="mb-10 flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent-muted)] text-[var(--accent)]">
                <Brush className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                Underpaint
              </h1>
            </div>
            <p className="max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
              Your quiet oil painting companion at the easel — turn any photo
              into simple step-by-step guides and real paint-mixing recipes.
            </p>
          </div>

          <span className="shrink-0 text-xs text-[var(--text-muted)]">
            Private &middot; Saved on this device
          </span>
        </header>

        {/* Concise 3-Step Visual Strip */}
        <section
          aria-label="How it works"
          className="mb-8 grid grid-cols-1 gap-3.5 sm:grid-cols-3"
        >
          {[
            {
              num: "1",
              icon: ImagePlus,
              title: "Drop a photo",
              desc: "Upload any reference photo or paste one from your clipboard.",
            },
            {
              num: "2",
              icon: Layers,
              title: "Follow 5 simple painting steps",
              desc: "Move from a toned canvas to shadows, big color shapes, and highlights.",
            },
            {
              num: "3",
              icon: Pipette,
              title: "Click any color for a paint mix",
              desc: "Tap anywhere on the painting to get an easy tube-paint recipe.",
            },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="flex items-start gap-3.5 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] text-[var(--accent)]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="space-y-1">
                  <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                    <span className="mr-1.5 text-[var(--accent)]">
                      {step.num}.
                    </span>
                    {step.title}
                  </p>
                  <p className="text-[13px] leading-snug text-[var(--text-secondary)]">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        {/* Inviting Dropzone + Try a Sample Study */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void handleImportFile(file);
          }}
          onClick={(e) => {
            // Allow clicking empty dropzone background without nesting interactive roles
            if (e.target === e.currentTarget) {
              fileInputRef.current?.click();
            }
          }}
          className={`mb-12 flex flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed px-6 py-12 text-center transition-all duration-150 ${
            dragging
              ? "border-[var(--accent)] bg-[var(--accent-muted)]"
              : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
            }}
          />

          <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[var(--accent)]">
            {creating ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
          </div>

          <p className="text-base font-semibold text-[var(--text-primary)]">
            {creating
              ? "Setting up your canvas…"
              : "Drop a reference photo here, click to browse, or paste (⌘V)"}
          </p>
          <p className="mt-1.5 text-[13.5px] text-[var(--text-secondary)]">
            Works with PNG, WebP, or JPEG &middot; Your photos stay private on
            your device
          </p>

          <div
            className="mt-6 flex flex-wrap items-center justify-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={creating || creatingSample}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#141210] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              Choose a Photo
            </button>

            <button
              type="button"
              disabled={creating || creatingSample}
              onClick={() => void handleTrySample()}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
            >
              {creatingSample ? (
                <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
              ) : (
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              )}
              {creatingSample ? "Opening Sample…" : "Try a Sample Study"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-[var(--radius-md)] border border-[var(--danger)]/40 bg-[var(--danger-muted)] px-4 py-3 text-sm text-[var(--text-primary)]">
            {error}
          </div>
        )}

        {/* Saved Studies */}
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Your Studies
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              {projects.length} {projects.length === 1 ? "study" : "studies"}
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">
              Loading your studies…
            </p>
          ) : projects.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-8 text-center">
              <p className="text-[14px] text-[var(--text-secondary)]">
                No studies yet. Drop a photo above or click{" "}
                <button
                  type="button"
                  onClick={() => void handleTrySample()}
                  className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                >
                  Try a Sample Study
                </button>{" "}
                to explore the 5-step studio guide.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onOpen={() => router.push(`/project/${p.id}`)}
                  onDelete={() => void handleDelete(p.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
