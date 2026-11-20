import type { CIELab } from "@/lib/types";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const POW25_7 = Math.pow(25, 7);

export type DeltaEWeights = {
  kL?: number;
  kC?: number;
  kH?: number;
};

/**
 * Full CIEDE2000 perceptual color difference (Sharma, Wu, Dalal 2005).
 */
export function deltaE2000(
  lab1: CIELab,
  lab2: CIELab,
  weights: DeltaEWeights = {}
): number {
  const kL = weights.kL ?? 1;
  const kC = weights.kC ?? 1;
  const kH = weights.kH ?? 1;

  const C1 = Math.hypot(lab1.a, lab1.b);
  const C2 = Math.hypot(lab2.a, lab2.b);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW25_7)));

  const a1Prime = (1 + G) * lab1.a;
  const a2Prime = (1 + G) * lab2.a;

  const C1Prime = Math.hypot(a1Prime, lab1.b);
  const C2Prime = Math.hypot(a2Prime, lab2.b);

  const h1Prime =
    C1Prime === 0 ? 0 : (Math.atan2(lab1.b, a1Prime) * RAD2DEG + 360) % 360;
  const h2Prime =
    C2Prime === 0 ? 0 : (Math.atan2(lab2.b, a2Prime) * RAD2DEG + 360) % 360;

  const dLPrime = lab2.L - lab1.L;
  const dCPrime = C2Prime - C1Prime;

  let dhPrime = 0;
  if (C1Prime * C2Prime !== 0) {
    const diff = h2Prime - h1Prime;
    if (Math.abs(diff) <= 180) {
      dhPrime = diff;
    } else if (diff > 180) {
      dhPrime = diff - 360;
    } else {
      dhPrime = diff + 360;
    }
  }

  const dHPrime =
    2 * Math.sqrt(C1Prime * C2Prime) * Math.sin((dhPrime / 2) * DEG2RAD);

  const LbarPrime = (lab1.L + lab2.L) / 2;
  const CbarPrime = (C1Prime + C2Prime) / 2;

  let hbarPrime = h1Prime + h2Prime;
  if (C1Prime * C2Prime !== 0) {
    if (Math.abs(h1Prime - h2Prime) <= 180) {
      hbarPrime = (h1Prime + h2Prime) / 2;
    } else if (h1Prime + h2Prime < 360) {
      hbarPrime = (h1Prime + h2Prime + 360) / 2;
    } else {
      hbarPrime = (h1Prime + h2Prime - 360) / 2;
    }
  }

  const T =
    1 -
    0.17 * Math.cos((hbarPrime - 30) * DEG2RAD) +
    0.24 * Math.cos(2 * hbarPrime * DEG2RAD) +
    0.32 * Math.cos((3 * hbarPrime + 6) * DEG2RAD) -
    0.2 * Math.cos((4 * hbarPrime - 63) * DEG2RAD);

  const dTheta = 30 * Math.exp(-Math.pow((hbarPrime - 275) / 25, 2));
  const CbarPrime7 = Math.pow(CbarPrime, 7);
  const RC = 2 * Math.sqrt(CbarPrime7 / (CbarPrime7 + POW25_7));

  const LbarMinus50Sq = Math.pow(LbarPrime - 50, 2);
  const SL = 1 + (0.015 * LbarMinus50Sq) / Math.sqrt(20 + LbarMinus50Sq);
  const SC = 1 + 0.045 * CbarPrime;
  const SH = 1 + 0.015 * CbarPrime * T;
  const RT = -Math.sin(2 * dTheta * DEG2RAD) * RC;

  const termL = dLPrime / (kL * SL);
  const termC = dCPrime / (kC * SC);
  const termH = dHPrime / (kH * SH);

  return Math.sqrt(
    termL * termL + termC * termC + termH * termH + RT * termC * termH
  );
}
