import type { CIELab, OKLab, OKLCH, RGB } from "@/lib/types";

export type XYZ = {
  x: number;
  y: number;
  z: number;
};

// D65 reference white (CIE 1931 2-degree standard observer)
const D65_X = 0.95047;
const D65_Y = 1.0;
const D65_Z = 1.08883;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function srgbChannelToLinear(c: number): number {
  const v = clamp(c, 0, 1);
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linearChannelToSrgb(c: number): number {
  const v = clamp(c, 0, 1);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export function srgbToLinear(rgb: RGB): RGB {
  return {
    r: srgbChannelToLinear(rgb.r),
    g: srgbChannelToLinear(rgb.g),
    b: srgbChannelToLinear(rgb.b),
  };
}

export function linearToSrgb(lin: RGB): RGB {
  return {
    r: linearChannelToSrgb(lin.r),
    g: linearChannelToSrgb(lin.g),
    b: linearChannelToSrgb(lin.b),
  };
}

export function linearSrgbToXyz(lin: RGB): XYZ {
  return {
    x: 0.4124564 * lin.r + 0.3575761 * lin.g + 0.1804375 * lin.b,
    y: 0.2126729 * lin.r + 0.7151522 * lin.g + 0.072175 * lin.b,
    z: 0.0193339 * lin.r + 0.119192 * lin.g + 0.9503041 * lin.b,
  };
}

export function xyzToLinearSrgb(xyz: XYZ): RGB {
  return {
    r: 3.2404542 * xyz.x - 1.5371385 * xyz.y - 0.4985314 * xyz.z,
    g: -0.969266 * xyz.x + 1.8760108 * xyz.y + 0.041556 * xyz.z,
    b: 0.0556434 * xyz.x - 0.2040259 * xyz.y + 1.0572252 * xyz.z,
  };
}

export function srgbToXyz(rgb: RGB): XYZ {
  return linearSrgbToXyz(srgbToLinear(rgb));
}

export function xyzToSrgb(xyz: XYZ): RGB {
  return linearToSrgb(xyzToLinearSrgb(xyz));
}

const LAB_EPSILON = 216 / 24389; // 0.008856...
const LAB_KAPPA = 24389 / 27; // 903.296...

function labF(t: number): number {
  return t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116;
}

function labFInv(f: number): number {
  const f3 = f * f * f;
  return f3 > LAB_EPSILON ? f3 : (116 * f - 16) / LAB_KAPPA;
}

export function xyzToLab(xyz: XYZ): CIELab {
  const fx = labF(xyz.x / D65_X);
  const fy = labF(xyz.y / D65_Y);
  const fz = labF(xyz.z / D65_Z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function labToXyz(lab: CIELab): XYZ {
  const fy = (lab.L + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;
  return {
    x: labFInv(fx) * D65_X,
    y: labFInv(fy) * D65_Y,
    z: labFInv(fz) * D65_Z,
  };
}

export function srgbToLab(rgb: RGB): CIELab {
  return xyzToLab(srgbToXyz(rgb));
}

export function labToSrgb(lab: CIELab): RGB {
  return xyzToSrgb(labToXyz(lab));
}

// Björn Ottosson's OKLab (linear sRGB <-> OKLab)
export function linearSrgbToOklab(lin: RGB): OKLab {
  const l = 0.4122214708 * lin.r + 0.5363325363 * lin.g + 0.0514459929 * lin.b;
  const m = 0.2119034982 * lin.r + 0.6806995451 * lin.g + 0.1073969566 * lin.b;
  const s = 0.0883024619 * lin.r + 0.2817188376 * lin.g + 0.6299787005 * lin.b;

  const l_ = Math.cbrt(Math.max(0, l));
  const m_ = Math.cbrt(Math.max(0, m));
  const s_ = Math.cbrt(Math.max(0, s));

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklabToLinearSrgb(lab: OKLab): RGB {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export function srgbToOklab(rgb: RGB): OKLab {
  return linearSrgbToOklab(srgbToLinear(rgb));
}

export function oklabToSrgb(lab: OKLab): RGB {
  return linearToSrgb(oklabToLinearSrgb(lab));
}

export function oklabToOklch(lab: OKLab): OKLCH {
  const C = Math.hypot(lab.a, lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L: lab.L, C, h: C < 1e-6 ? 0 : h };
}

export function oklchToOklab(lch: OKLCH): OKLab {
  const rad = (lch.h * Math.PI) / 180;
  return {
    L: lch.L,
    a: lch.C * Math.cos(rad),
    b: lch.C * Math.sin(rad),
  };
}

export function oklabToLab(ok: OKLab): CIELab {
  return xyzToLab(linearSrgbToXyz(oklabToLinearSrgb(ok)));
}

export function labToOklab(lab: CIELab): OKLab {
  return linearSrgbToOklab(xyzToLinearSrgb(labToXyz(lab)));
}

export function srgbToHex(rgb: RGB): string {
  const toByte = (v: number) =>
    Math.round(clamp(v, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toByte(rgb.r)}${toByte(rgb.g)}${toByte(rgb.b)}`;
}

export function hexToSrgb(hex: string): RGB {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

export function oklabToHex(ok: OKLab): string {
  return srgbToHex(oklabToSrgb(ok));
}

export function hexToOklab(hex: string): OKLab {
  return srgbToOklab(hexToSrgb(hex));
}
