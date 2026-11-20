# Underpaint

**Your quiet oil painting companion at the easel.**

Underpaint turns any reference photo into a clear, step-by-step oil painting guide with real tube-paint mixing recipes — built to stay private, fast, and entirely local on your device.

---

## Features

### 5-Step Alla Prima Painting Guide
Move smoothly from a bare panel to final highlights with stage-specific brushwork, medium, and fat-over-lean guidance:
1. **Tone Canvas** — Auto-suggested complementary imprimatura wash (customizable to any earth tone).
2. **Sketch & Shadows** — Monochrome brunaille value block-in transitioning from 3-value notan to 5-value grouping.
3. **Big Color Shapes** — Coarse superpixel color masses painted in traditional order (lean darks → midtones → fuller lights) constrained to your real paint tubes.
4. **Build Form** — Finer painterly form modeling with anisotropic Kuwahara brushwork and focal-weighted edge softness.
5. **Final Highlights** — Crisp impasto highlights and deepest dark accents anchored around your focal point.

### Real Paint-Mixing Recipes (Kubelka-Munk)
- **Click anywhere on the canvas** to inspect a color and get up to 3 practical recipes in simple ratios (`1–10 parts` + `tiny dab`, max 4 tubes).
- Uses **Kubelka-Munk subtractive pigment mixing** (`spectral.js`) calibrated for pigment tinting strength, scored with **CIEDE2000** and weighted for value accuracy.
- **Value Strings & Main Colors** — Automatically groups the reference into up to 4 major color families with 5-step dark-to-light premix strips.
- **Palettes** — Built-in **Standard Limited (9 tubes)**, **Zorn (4 tubes)**, and fully customizable tube checklists.

### Easel & Advanced Studio Tools
- **Compare to Photo** — Click to drag a split-screen divider, or hold (or press `Space`) to peek at the original reference.
- **Perceptual Black & White** — True linear-light luminance grayscale preserving CIELAB $L^*$ value relationships.
- **Squint Blur** — Separable Gaussian blur + subtle contrast drop to check big shapes.
- **Measuring Grid** — Physical canvas inches (`1"`, `2"`, `3"`, `4"`) or equal divisions with customizable opacity, labels, and color.
- **Canvas Size & Aspect-Locked Crop** — Match standard stretcher sizes (`9×12"`, `11×14"`, `12×16"`, `16×20"`, `18×24"`, or custom dimensions) with instant portrait/landscape flipping.
- **Advanced Studio Mode** — Unlocks the interactive 0–10 **Value Strip** (hover readout + drag-to-isolate value bands), **3 / 5 / 9 Value Map** posterization, **Achievable vs. Ideal** palette preview, **Out-of-Gamut** warning stripes, **Canvas Weave** overlay, **Interactive Focal Point** placement, smooth stage scrubbing, and pigment Color Index codes (`PW6`, `PB29`, `PY43`, etc.).

### Private & Local-First
- Photos, crops, and analysis caches stay in your browser's **IndexedDB** (`underpaint-studio-db`) — nothing is uploaded to a server.
- Supports drag-and-drop, file browse, clipboard paste (`⌘V` / `Ctrl+V`), and a built-in **Still Life with Citrus** sample study.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `←` / `→` | Previous / Next painting step |
| `Shift` + `←` / `→` | Fine-scrub slider *(Advanced Mode)* |
| Hold `Space` | Peek at original photo |
| `G` | Toggle Black & White (value check) |
| `S` | Toggle Squint Blur |
| `#` | Toggle measuring grid |
| `V` | Cycle 3 / 5 / 9 Value Map *(Advanced Mode)* |
| `Esc` | Exit crop / focal-point mode, clear markers, close popovers |

---

## Under the Hood

- **WebGL2 Pipeline (`lib/render/`):** Chained multi-pass FBO shaders for anisotropic Kuwahara brushwork, separable Gaussian blur, focal-weighted edge blending, impasto accents, and zero-readback GPU display overlays (`R8` textures for value maps, value isolation, and gamut masks).
- **Off-Thread Workers (`workers/`):**
  - `analysis.worker.ts` — Single-pass OKLab + CIELAB $L^*$ extraction, deterministic seeded k-means++ key color extraction, Sobel + non-maximum suppression edge detection, saliency focal-point estimation, and connectivity-enforced SLIC superpixels using Transferable buffers.
  - `mixing.worker.ts` — Coordinate-descent discrete pigment solver over Kubelka-Munk mixtures with an LRU quantized lookup cache.
- **Normalized IndexedDB (`lib/db/projectsDb.ts`):** Separates lightweight study metadata + thumbnails from full-resolution photo blobs and cached `ImageAnalysis` TypedArrays so listing studies and editing settings stay instant.
- **Responsive Studio UI:** Docked sidebar on desktop (`lg+`) with a slide-over **Guide** drawer on portrait tablets and narrow screens.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript (strict + `noUncheckedIndexedAccess`)
- **Styling:** Tailwind CSS v4 + Lucide icons
- **State & Storage:** Zustand v5 + `idb` (IndexedDB)
- **Color & Mixing:** `spectral.js` v3 (Kubelka-Munk) + custom OKLab / CIELAB / CIEDE2000 math
- **Testing:** Vitest

---

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Scripts

```bash
npm run dev        # Start local dev server
npm run build      # Production build
npm run start      # Serve production build
npm run typecheck  # Run TypeScript compiler checks
npm test           # Run Vitest unit test suite
npm run test:watch # Run Vitest in watch mode
```
