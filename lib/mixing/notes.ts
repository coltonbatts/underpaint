import type { MixPart, Pigment } from "@/lib/types";

/**
 * Generates concise, practical studio notes for a mixing recipe based on
 * pigment traits, gamut distance, and value error.
 */
export function generateRecipeNotes(
  parts: MixPart[],
  pigmentById: Map<string, Pigment>,
  deltaE2000: number,
  valueDelta: number
): string[] {
  const notes: string[] = [];

  const pigments = parts
    .map((p) => ({ part: p, pigment: pigmentById.get(p.pigmentId) }))
    .filter(
      (x): x is { part: MixPart; pigment: Pigment } => x.pigment !== undefined
    );

  // 1. High tinting strength warning
  const highTint = pigments
    .filter((x) => x.pigment.tintingStrength === "high")
    .map((x) => x.pigment.name);
  if (highTint.length > 0 && pigments.length > 1) {
    notes.push(
      `Add ${highTint.join(" & ")} in tiny increments — high tinting strength.`
    );
  }

  // 2. Value accuracy feedback
  if (Math.abs(valueDelta) > 0.5) {
    const dir = valueDelta > 0 ? "lighter" : "darker";
    notes.push(
      `Mix runs ${Math.abs(valueDelta).toFixed(1)} steps ${dir} than target — adjust value before hue.`
    );
  }

  // 3. Gamut edge warning
  if (deltaE2000 > 6.5) {
    notes.push(
      `Near your palette's gamut edge (ΔE ${deltaE2000.toFixed(1)}) — closest achievable mix.`
    );
  }

  // 4. Ivory black tip in chromatic darks
  const hasBlack = pigments.some((x) => x.pigment.id === "ivory-black");
  const hasUltra = pigmentById.has("ultramarine-blue");
  const hasUmberOrSienna =
    pigmentById.has("burnt-umber") || pigmentById.has("burnt-sienna");
  if (hasBlack && hasUltra && hasUmberOrSienna && pigments.length >= 2) {
    notes.push(
      "For a livelier chromatic dark, you can substitute Ultramarine + Burnt Umber for Ivory Black."
    );
  }

  // 5. Slow drying reminder when Alizarin/Black dominate (white is handled by fat-over-lean guidance)
  const slowDriers = pigments.filter(
    (x) =>
      x.pigment.dryingSpeed === "slow" &&
      x.pigment.role !== "white" &&
      x.pigment.id !== "titanium-white"
  );
  if (slowDriers.length > 0 && notes.length < 3) {
    const verb = slowDriers.length === 1 ? "dries" : "dry";
    notes.push(
      `${slowDriers.map((x) => x.pigment.name).join(" & ")} ${verb} slowly — keep thin in early layers.`
    );
  }

  return notes.slice(0, 3);
}
