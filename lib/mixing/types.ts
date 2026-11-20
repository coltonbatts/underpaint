import type { OKLab, Pigment } from "@/lib/types";

export type MixInput = {
  pigment: Pigment;
  weight: number;
};

/**
 * Swappable Kubelka-Munk (or physical spectral) pigment mixing interface.
 */
export interface MixingEngine {
  readonly id: string;
  getPigmentOklab(pigment: Pigment): OKLab;
  mix(inputs: MixInput[]): OKLab;
}
