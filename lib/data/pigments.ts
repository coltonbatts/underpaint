import type { Pigment } from "@/lib/types";

/**
 * Curated oil painting tube pigments.
 * `spectral` holds the representative masstone sRGB hex fed into Kubelka-Munk spectral.js
 * (can be swapped for measured 38-band reflectance arrays without changing callers).
 */
export const PIGMENTS: Pigment[] = [
  {
    id: "titanium-white",
    name: "Titanium White",
    colorIndex: "PW6",
    role: "white",
    spectral: "#f6f5f0",
    opacity: "opaque",
    tintingStrength: "med",
    dryingSpeed: "slow",
  },
  {
    id: "cadmium-yellow-light",
    name: "Cadmium Yellow Light",
    colorIndex: "PY35",
    role: "chromatic",
    spectral: "#f3d126",
    opacity: "opaque",
    tintingStrength: "med",
    dryingSpeed: "med",
  },
  {
    id: "yellow-ochre",
    name: "Yellow Ochre",
    colorIndex: "PY43",
    role: "earth",
    spectral: "#c48f32",
    opacity: "semi",
    tintingStrength: "low",
    dryingSpeed: "fast",
  },
  {
    id: "cadmium-red-light",
    name: "Cadmium Red Light",
    colorIndex: "PR108",
    role: "chromatic",
    spectral: "#d43627",
    opacity: "opaque",
    tintingStrength: "high",
    dryingSpeed: "med",
  },
  {
    id: "alizarin-crimson",
    name: "Alizarin Crimson",
    colorIndex: "PR83",
    role: "chromatic",
    spectral: "#761427",
    opacity: "transparent",
    tintingStrength: "high",
    dryingSpeed: "slow",
  },
  {
    id: "ultramarine-blue",
    name: "Ultramarine Blue",
    colorIndex: "PB29",
    role: "chromatic",
    spectral: "#1a2f7d",
    opacity: "transparent",
    tintingStrength: "high",
    dryingSpeed: "med",
  },
  {
    id: "burnt-sienna",
    name: "Burnt Sienna",
    colorIndex: "PBr7",
    role: "earth",
    spectral: "#7a351e",
    opacity: "transparent",
    tintingStrength: "med",
    dryingSpeed: "fast",
  },
  {
    id: "burnt-umber",
    name: "Burnt Umber",
    colorIndex: "PBr7",
    role: "earth",
    spectral: "#3a261a",
    opacity: "semi",
    tintingStrength: "med",
    dryingSpeed: "fast",
  },
  {
    id: "ivory-black",
    name: "Ivory Black",
    colorIndex: "PBk9",
    role: "black",
    spectral: "#191817",
    opacity: "semi",
    tintingStrength: "med",
    dryingSpeed: "slow",
  },
];

export const PIGMENT_MAP: Record<string, Pigment> = Object.fromEntries(
  PIGMENTS.map((p) => [p.id, p])
);

export function getPigmentSwatchHex(pigment: Pigment): string {
  return typeof pigment.spectral === "string" ? pigment.spectral : "#888888";
}
