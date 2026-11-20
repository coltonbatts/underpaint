import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  CropRect,
  ImageAnalysis,
  Project,
  ProjectSummary,
} from "@/lib/types";

// Legacy v1 record shape (before blobs and analysis were split into separate stores)
type LegacyProjectRecord = ProjectSummary & {
  sourceImage?: Blob;
  analysis?: ImageAnalysis;
};

interface UnderpaintDB extends DBSchema {
  projects: {
    key: string;
    value: ProjectSummary;
    indexes: { "by-updated": number };
  };
  projectImages: {
    key: string;
    value: Blob;
  };
  projectAnalyses: {
    key: string;
    value: ImageAnalysis;
  };
}

const DB_NAME = "underpaint-studio-db";
const DB_VERSION = 2;
const THUMBNAIL_MAX_EDGE = 480;

let dbPromise: Promise<IDBPDatabase<UnderpaintDB>> | null = null;

function getDb(): Promise<IDBPDatabase<UnderpaintDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("IndexedDB is only available in the browser.")
    );
  }
  if (!dbPromise) {
    dbPromise = openDB<UnderpaintDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (!db.objectStoreNames.contains("projects")) {
          const store = db.createObjectStore("projects", { keyPath: "id" });
          store.createIndex("by-updated", "updatedAt");
        }
        if (!db.objectStoreNames.contains("projectImages")) {
          db.createObjectStore("projectImages");
        }
        if (!db.objectStoreNames.contains("projectAnalyses")) {
          db.createObjectStore("projectAnalyses");
        }

        // Migrate v1 monolithic project records into normalized stores
        if (oldVersion > 0 && oldVersion < 2) {
          const projectStore = tx.objectStore("projects");
          const imageStore = tx.objectStore("projectImages");
          const analysisStore = tx.objectStore("projectAnalyses");

          const all = (await projectStore.getAll()) as LegacyProjectRecord[];
          for (const rec of all) {
            const { sourceImage, analysis, ...summary } = rec;
            if (sourceImage) {
              await imageStore.put(sourceImage, rec.id);
            }
            if (analysis) {
              await analysisStore.put(analysis, rec.id);
            }
            await projectStore.put(summary);
          }
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Computes the largest centered normalized crop rect inside an image of size
 * (imgW, imgH) that matches the physical aspect ratio (canvasW / canvasH).
 */
export function computeCenteredCrop(
  imgW: number,
  imgH: number,
  canvasW: number,
  canvasH: number
): CropRect {
  if (imgW <= 0 || imgH <= 0 || canvasW <= 0 || canvasH <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  const imgAspect = imgW / imgH;
  const targetAspect = canvasW / canvasH;

  if (Math.abs(imgAspect - targetAspect) < 1e-4) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }

  if (imgAspect > targetAspect) {
    // Image is wider than canvas: crop width
    const w = targetAspect / imgAspect;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  } else {
    // Image is taller than canvas: crop height
    const h = imgAspect / targetAspect;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
}

/**
 * Generates a small thumbnail Blob (~480px long edge) for fast home-page listing.
 */
async function generateThumbnailBlob(blob: Blob): Promise<Blob | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    try {
      const scale = Math.min(
        1,
        THUMBNAIL_MAX_EDGE / Math.max(1, bitmap.width, bitmap.height)
      );
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));

      if (typeof OffscreenCanvas !== "undefined") {
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext("2d");
        if (!ctx) return undefined;
        ctx.drawImage(bitmap, 0, 0, w, h);
        return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      ctx.drawImage(bitmap, 0, 0, w, h);
      return await new Promise<Blob | undefined>((resolve) =>
        canvas.toBlob((b) => resolve(b ?? undefined), "image/jpeg", 0.82)
      );
    } finally {
      bitmap.close();
    }
  } catch {
    return undefined;
  }
}

function toProjectSummary(
  project: Project,
  thumbnail?: Blob
): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    sourceWidth: project.sourceWidth,
    sourceHeight: project.sourceHeight,
    canvas: project.canvas,
    palette: project.palette,
    customPigmentIds: project.customPigmentIds,
    processPresetId: project.processPresetId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    ...(thumbnail ? { thumbnail } : {}),
  };
}

/**
 * Lists saved studies using only lightweight metadata + thumbnails (never loads
 * full-resolution source photos or multi-MB ImageAnalysis buffers).
 * Lazily backfills thumbnails for legacy v1-migrated studies.
 */
export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("projects", "by-updated");
  const reversed = all.reverse();

  // Lazily backfill thumbnails for v1-migrated studies that don't have one yet
  const needsThumb = reversed.filter((p) => !p.thumbnail);
  if (needsThumb.length > 0) {
    await Promise.all(
      needsThumb.map(async (item) => {
        const fullBlob = await db.get("projectImages", item.id);
        if (!fullBlob) return;
        const thumb = await generateThumbnailBlob(fullBlob);
        if (!thumb) return;
        item.thumbnail = thumb;
        await db.put("projects", { ...item, thumbnail: thumb });
      })
    );
  }

  return reversed;
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDb();
  const tx = db.transaction(
    ["projects", "projectImages", "projectAnalyses"],
    "readonly"
  );
  const [summary, sourceImage, analysis] = await Promise.all([
    tx.objectStore("projects").get(id),
    tx.objectStore("projectImages").get(id),
    tx.objectStore("projectAnalyses").get(id),
    tx.done,
  ]);

  if (!summary || !sourceImage) return undefined;

  return {
    id: summary.id,
    name: summary.name,
    sourceImage,
    sourceWidth: summary.sourceWidth,
    sourceHeight: summary.sourceHeight,
    canvas: summary.canvas,
    palette: summary.palette,
    customPigmentIds: summary.customPigmentIds,
    processPresetId: summary.processPresetId,
    analysis,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
  };
}

/**
 * Writes ONLY the lightweight project metadata (preserving its thumbnail).
 * Never re-serializes sourceImage or ImageAnalysis buffers.
 */
export async function saveProjectMetadata(project: Project): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("projects", "readwrite");
  const existing = await tx.store.get(project.id);
  const summary = toProjectSummary(
    { ...project, updatedAt: Date.now() },
    existing?.thumbnail
  );
  await tx.store.put(summary);
  await tx.done;
}

/**
 * Writes or deletes ONLY the cached ImageAnalysis buffer for a project.
 */
export async function saveProjectAnalysis(
  projectId: string,
  analysis: ImageAnalysis | undefined
): Promise<void> {
  const db = await getDb();
  if (analysis) {
    await db.put("projectAnalyses", analysis, projectId);
  } else {
    await db.delete("projectAnalyses", projectId);
  }
}

/**
 * Full save helper (writes metadata, image, and optional analysis across normalized stores).
 */
export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  const existing = await db.get("projects", project.id);
  const thumb =
    existing?.thumbnail ?? (await generateThumbnailBlob(project.sourceImage));

  const tx = db.transaction(
    ["projects", "projectImages", "projectAnalyses"],
    "readwrite"
  );
  const summary = toProjectSummary(
    { ...project, updatedAt: Date.now() },
    thumb
  );
  await tx.objectStore("projects").put(summary);
  await tx.objectStore("projectImages").put(project.sourceImage, project.id);
  if (project.analysis) {
    await tx.objectStore("projectAnalyses").put(project.analysis, project.id);
  } else {
    await tx.objectStore("projectAnalyses").delete(project.id);
  }
  await tx.done;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ["projects", "projectImages", "projectAnalyses"],
    "readwrite"
  );
  await Promise.all([
    tx.objectStore("projects").delete(id),
    tx.objectStore("projectImages").delete(id),
    tx.objectStore("projectAnalyses").delete(id),
    tx.done,
  ]);
}

export async function createProjectFromBlob(
  blob: Blob,
  name: string
): Promise<Project> {
  const [dims, thumbnail] = await Promise.all([
    readImageDimensions(blob),
    generateThumbnailBlob(blob),
  ]);

  // Pick a default canvas orientation matching the uploaded image
  const isLandscape = dims.width >= dims.height;
  const widthIn = isLandscape ? 14 : 11;
  const heightIn = isLandscape ? 11 : 14;

  const now = Date.now();
  const project: Project = {
    id: crypto.randomUUID(),
    name: name.replace(/\.[^.]+$/, "") || "Untitled Study",
    sourceImage: blob,
    sourceWidth: dims.width,
    sourceHeight: dims.height,
    canvas: {
      widthIn,
      heightIn,
      crop: computeCenteredCrop(dims.width, dims.height, widthIn, heightIn),
    },
    palette: "standard-limited",
    processPresetId: "alla-prima",
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  const tx = db.transaction(["projects", "projectImages"], "readwrite");
  await tx.objectStore("projects").put(toProjectSummary(project, thumbnail));
  await tx.objectStore("projectImages").put(blob, project.id);
  await tx.done;

  return project;
}

export function readImageDimensions(
  blob: Blob
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image file."));
    };
    img.src = url;
  });
}
