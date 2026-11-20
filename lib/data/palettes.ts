import type { PaletteId, Pigment } from "@/lib/types";
import { PIGMENT_MAP, PIGMENTS } from "./pigments";

export type PalettePreset = {
  id: Exclude<PaletteId, "custom">;
  name: string;
  description: string;
  pigmentIds: string[];
};

export const PALETTE_PRESETS: Record<
  Exclude<PaletteId, "custom">,
  PalettePreset
> = {
  "standard-limited": {
    id: "standard-limited",
    name: "Standard Limited",
    description:
      "Classic 9-tube studio split-warm/cool palette with earth tones.",
    pigmentIds: [
      "titanium-white",
      "cadmium-yellow-light",
      "yellow-ochre",
      "cadmium-red-light",
      "alizarin-crimson",
      "ultramarine-blue",
      "burnt-sienna",
      "burnt-umber",
      "ivory-black",
    ],
  },
  zorn: {
    id: "zorn",
    name: "Zorn Palette",
    description:
      "4-tube figurative palette (White, Yellow Ochre, Cad Red Light, Ivory Black).",
    pigmentIds: [
      "titanium-white",
      "yellow-ochre",
      "cadmium-red-light",
      "ivory-black",
    ],
  },
};

export function getActivePigmentIds(
  paletteId: PaletteId,
  customPigmentIds?: string[]
): string[] {
  if (paletteId === "custom" && customPigmentIds && customPigmentIds.length > 0) {
    return customPigmentIds;
  }
  const preset =
    paletteId === "zorn"
      ? PALETTE_PRESETS.zorn
      : PALETTE_PRESETS["standard-limited"];
  return preset.pigmentIds;
}

export function getActivePigments(
  paletteId: PaletteId,
  customPigmentIds?: string[]
): Pigment[] {
  const ids = getActivePigmentIds(paletteId, customPigmentIds);
  const list = ids
    .map((id) => PIGMENT_MAP[id])
    .filter((p): p is Pigment => p !== undefined);
  return list.length > 0 ? list : PIGMENTS;
}
