declare module "spectral.js" {
  export class Color {
    constructor(input: string | number[]);
    readonly sRGB: [number, number, number];
    readonly lRGB: [number, number, number];
    readonly XYZ: [number, number, number];
    readonly OKLab: [number, number, number];
    readonly OKLCh: [number, number, number];
    readonly R: number[];
    readonly KS: number[];
    readonly luminance: number;
    tintingStrength: number;
    toString(format?: "hex" | "rgb"): string;
  }

  export function mix(...colors: Array<[Color, number]>): Color;
  export function palette(a: Color, b: Color, size: number): Color[];
  export function gradient(
    t: number,
    ...stops: Array<[Color, number]>
  ): Color;

  const spectral: {
    Color: typeof Color;
    mix: typeof mix;
    palette: typeof palette;
    gradient: typeof gradient;
  };
  export default spectral;
}
