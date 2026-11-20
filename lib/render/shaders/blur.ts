/**
 * Separable 1D Gaussian blur shader (run horizontally then vertically).
 * Used for Squint mode, soft peripheral edges (Stage 6), and smooth underpainting transitions.
 */

export const BLUR_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform vec2 uDirection; // (1/w, 0) for horizontal, (0, 1/h) for vertical
uniform float uRadius;   // blur radius in pixels (1..18)

in vec2 vUv;
out vec4 fragColor;

void main() {
  int r = int(clamp(round(uRadius), 1.0, 18.0));
  float sigma = max(uRadius * 0.45, 0.75);
  float inv2Sigma2 = 1.0 / (2.0 * sigma * sigma);

  vec4 sum = vec4(0.0);
  float wSum = 0.0;

  for (int i = -18; i <= 18; i++) {
    if (i < -r || i > r) continue;
    float fi = float(i);
    float w = exp(-fi * fi * inv2Sigma2);
    vec2 uv = clamp(vUv + uDirection * fi, 0.0, 1.0);
    sum += texture(uSource, uv) * w;
    wSum += w;
  }

  fragColor = sum / max(wSum, 1e-5);
}
`;
