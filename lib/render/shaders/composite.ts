import { GLSL_NOISE_HELPERS } from "./common";

/**
 * Focal-weighted blend shader (Stage 6: Refinement & Edges).
 * Sharp painterly detail near uFocalPoint; soft/lost edges toward the periphery.
 */
export const FOCAL_BLEND_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSharp;
uniform sampler2D uSoft;
uniform vec2 uFocalPoint;   // normalized 0..1
uniform float uAspect;      // width / height
uniform float uFocusRadius; // inner sharp radius (default ~0.22)
uniform float uFalloff;     // transition width (default ~0.48)
uniform float uStrength;    // 0..1 overall refinement strength

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec2 delta = vUv - uFocalPoint;
  delta.x *= uAspect;
  float dist = length(delta);

  // 1 near focal point, 0 at periphery
  float focusMask = 1.0 - smoothstep(uFocusRadius, uFocusRadius + uFalloff, dist);
  float blend = mix(0.22, 1.0, focusMask) * uStrength;

  vec3 softCol = texture(uSoft, vUv).rgb;
  vec3 sharpCol = texture(uSharp, vUv).rgb;
  fragColor = vec4(mix(softCol, sharpCol, clamp(blend, 0.0, 1.0)), 1.0);
}
`;

/**
 * Accents & Highlights shader (Stage 7).
 * Pops brightest impasto lights and deepest dark accents on top of the refined painting.
 */
export const ACCENTS_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uBase;
uniform sampler2D uSource;
uniform float uProgress;     // 0..1 within Stage 7
uniform float uWeaveAmount;  // subtle impasto / canvas tooth

in vec2 vUv;
out vec4 fragColor;

${GLSL_NOISE_HELPERS}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec3 baseCol = texture(uBase, vUv).rgb;
  vec3 srcCol = texture(uSource, vUv).rgb;
  float l = luma(srcCol);

  // Highlight mask (top values) and deep dark accent mask (bottom values)
  float hiMask = smoothstep(0.76, 0.93, l);
  float loMask = 1.0 - smoothstep(0.06, 0.22, l);
  float accentMask = clamp(max(hiMask, loMask), 0.0, 1.0) * uProgress;

  // Slightly richer punch on final accents
  vec3 boosted = mix(srcCol, clamp(srcCol * 1.06, 0.0, 1.0), hiMask * 0.5);
  boosted = mix(boosted, boosted * 0.88, loMask * 0.45);

  vec3 col = mix(baseCol, boosted, accentMask * 0.92);

  if (uWeaveAmount > 0.001) {
    float tooth = canvasWeave(gl_FragCoord.xy, 0.28);
    // Impasto lights catch slightly more directional tooth
    col += tooth * uWeaveAmount * (0.025 + hiMask * 0.02);
  }

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * Final display post-process:
 * - Optional Squint contrast drop (after blur)
 * - Optional canvas-weave texture overlay (without blurring when Squint is off)
 * - Optional Value Map posterization (3 / 5 / 9 steps) OR perceptually accurate linear-light Grayscale
 * - Optional Value Strip marker isolation band (±0.45 on 0..10 CIELAB scale)
 * - Optional Out-of-Gamut diagonal magenta striping
 */
export const DISPLAY_POST_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform sampler2D uValueMapTex;   // R8 bucket indices (0..steps-1)
uniform sampler2D uValueContTex;  // R8 continuous CIELAB L* (0..1 -> 0..10)
uniform sampler2D uGamutMaskTex;  // R8 binary mask (0 or 1)

uniform float uWeaveStrength;     // 0..1
uniform float uContrastDrop;      // 0 for normal, ~0.16 for squint
uniform int uGrayscale;           // 0 or 1
uniform int uValueMapSteps;       // 0 = off, else 3 / 5 / 9
uniform float uIsolateValue;      // < 0 = off, else 0..10
uniform int uShowGamut;           // 0 or 1

in vec2 vUv;
out vec4 fragColor;

${GLSL_NOISE_HELPERS}

float srgbToLin(float c) {
  return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}

float linToSrgb(float c) {
  float v = clamp(c, 0.0, 1.0);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1.0 / 2.4) - 0.055;
}

float valueBucketGray(float bucket, int steps) {
  if (steps == 3) {
    if (bucket < 0.5) return 24.0 / 255.0;
    if (bucket < 1.5) return 126.0 / 255.0;
    return 232.0 / 255.0;
  }
  float denom = max(1.0, float(steps - 1));
  float t = clamp(bucket, 0.0, denom) / denom;
  return (14.0 + t * 232.0) / 255.0;
}

void main() {
  vec3 col = texture(uSource, vUv).rgb;

  if (uContrastDrop > 0.001) {
    col = mix(col, vec3(0.5), uContrastDrop);
  }

  if (uWeaveStrength > 0.001) {
    float tooth = canvasWeave(gl_FragCoord.xy, 0.26);
    col += tooth * uWeaveStrength * 0.035;
  }

  if (uValueMapSteps > 0) {
    float bucket = floor(texture(uValueMapTex, vUv).r * 255.0 + 0.5);
    float g = valueBucketGray(bucket, uValueMapSteps);
    col = vec3(g);
  } else if (uGrayscale == 1) {
    // Exact linear-light luminance -> sRGB neutral gray (preserves CIELAB L*)
    float Y = 0.2126729 * srgbToLin(col.r)
            + 0.7151522 * srgbToLin(col.g)
            + 0.0721750 * srgbToLin(col.b);
    float g = linToSrgb(Y);
    col = vec3(g);
  }

  if (uIsolateValue >= 0.0) {
    float v = texture(uValueContTex, vUv).r * 10.0;
    if (abs(v - uIsolateValue) <= 0.45) {
      vec3 accent = vec3(216.0, 154.0, 91.0) / 255.0;
      col = mix(col, accent, 0.55);
    }
  }

  if (uShowGamut == 1) {
    float ogg = texture(uGamutMaskTex, vUv).r;
    if (ogg > 0.5) {
      int diag = int(floor(gl_FragCoord.x) + floor(gl_FragCoord.y));
      float stripe = (diag & 7) < 3 ? 0.62 : 0.24;
      vec3 warnCol = vec3(230.0, 64.0, 128.0) / 255.0;
      col = mix(col, warnCol, stripe);
    }
  }

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
