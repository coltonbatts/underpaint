import spectral, { type Color as SpectralColor } from "spectral.js";
import type { OKLab, Pigment } from "@/lib/types";
import type { MixingEngine, MixInput } from "./types";

// Calibrated against real artist-grade oil pigment tinting behavior in spectral.js:
// weak earths (Yellow Ochre ~0.65), balanced mediums (White/Cad Yellow ~1.0),
// and strong tinters (Ultramarine/Alizarin/Cad Red ~2.0).
const TINT_MULTIPLIER: Record<Pigment["tintingStrength"], number> = {
  low: 0.65,
  med: 1.0,
  high: 2.0,
};

/**
 * Kubelka-Munk mixing adapter backed by spectral.js v3.
 * Caches spectral.Color instances keyed by pigment identity & optical specs
 * for fast inner-loop evaluation.
 */
export class SpectralMixingEngine implements MixingEngine {
  readonly id = "spectral-js-km-v2";
  private colorCache = new Map<string, SpectralColor>();

  private toSpectralColor(pigment: Pigment): SpectralColor {
    const specKey =
      typeof pigment.spectral === "string"
        ? pigment.spectral
        : pigment.spectral.join(",");
    const key = `${pigment.id}|${specKey}|${pigment.tintingStrength}`;
    const existing = this.colorCache.get(key);
    if (existing) return existing;

    const color = new spectral.Color(pigment.spectral);
    color.tintingStrength = TINT_MULTIPLIER[pigment.tintingStrength];
    this.colorCache.set(key, color);
    return color;
  }

  getPigmentOklab(pigment: Pigment): OKLab {
    const [L, a, b] = this.toSpectralColor(pigment).OKLab;
    return { L, a, b };
  }

  mix(inputs: MixInput[]): OKLab {
    const active = inputs.filter((i) => i.weight > 0);
    if (active.length === 0) {
      return { L: 0.5, a: 0, b: 0 };
    }
    if (active.length === 1) {
      return this.getPigmentOklab(active[0]!.pigment);
    }

    const pairs: Array<[SpectralColor, number]> = active.map((i) => [
      this.toSpectralColor(i.pigment),
      i.weight,
    ]);
    const mixed = spectral.mix(...pairs);
    const [L, a, b] = mixed.OKLab;
    return { L, a, b };
  }
}

export const defaultMixingEngine = new SpectralMixingEngine();
