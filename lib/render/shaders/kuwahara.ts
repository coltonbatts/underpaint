/**
 * Tasteful Anisotropic Kuwahara filter for painterly oil-study shapes.
 *
 * Tuning parameters (passed as uniforms):
 * - uRadius: filter radius in pixels (3.0 - 8.0). Larger = broader brushwork.
 * - uSharpness: sector weighting exponent q (4.0 - 10.0). Higher = crisper edges.
 * - uAnisotropy: how strongly brushstrokes elongate along local contours (0.0 - 1.0).
 */

export const KUWAHARA_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform float uRadius;
uniform float uSharpness;
uniform float uAnisotropy;

in vec2 vUv;
out vec4 fragColor;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  // 1. Estimate local structure tensor (Sobel gradients) for brushstroke orientation
  vec2 t = uTexelSize;
  float tl = luma(texture(uSource, vUv + vec2(-t.x, -t.y)).rgb);
  float tc = luma(texture(uSource, vUv + vec2( 0.0, -t.y)).rgb);
  float tr = luma(texture(uSource, vUv + vec2( t.x, -t.y)).rgb);
  float ml = luma(texture(uSource, vUv + vec2(-t.x,  0.0)).rgb);
  float mr = luma(texture(uSource, vUv + vec2( t.x,  0.0)).rgb);
  float bl = luma(texture(uSource, vUv + vec2(-t.x,  t.y)).rgb);
  float bc = luma(texture(uSource, vUv + vec2( 0.0,  t.y)).rgb);
  float br = luma(texture(uSource, vUv + vec2( t.x,  t.y)).rgb);

  float gx = -tl + tr - 2.0 * ml + 2.0 * mr - bl + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;

  // Tangent direction (perpendicular to gradient)
  float angle = atan(gx, -gy);
  float ca = cos(angle);
  float sa = sin(angle);
  mat2 rot = mat2(ca, -sa, sa, ca);

  // Stretch sampling ellipse along the edge tangent
  float mag = clamp(length(vec2(gx, gy)) * 2.5, 0.0, 1.0);
  float stretch = 1.0 + uAnisotropy * mag * 0.85;
  vec2 scale = vec2(stretch, 1.0 / stretch);

  // 2. Accumulate mean and variance in 4 oriented quadrants (fast & clean)
  vec3 mean[4];
  vec3 sqMean[4];
  float count[4];
  for (int i = 0; i < 4; i++) {
    mean[i] = vec3(0.0);
    sqMean[i] = vec3(0.0);
    count[i] = 0.0;
  }

  int r = int(clamp(round(uRadius), 2.0, 8.0));
  for (int y = -8; y <= 8; y++) {
    if (y < -r || y > r) continue;
    for (int x = -8; x <= 8; x++) {
      if (x < -r || x > r) continue;

      vec2 offset = vec2(float(x), float(y));
      vec2 oriented = rot * (offset * scale);
      vec3 c = texture(uSource, clamp(vUv + oriented * uTexelSize, 0.0, 1.0)).rgb;

      // Assign to quadrant (overlapping at 0 axes for smooth continuity)
      if (x <= 0 && y <= 0) { mean[0] += c; sqMean[0] += c * c; count[0] += 1.0; }
      if (x >= 0 && y <= 0) { mean[1] += c; sqMean[1] += c * c; count[1] += 1.0; }
      if (x <= 0 && y >= 0) { mean[2] += c; sqMean[2] += c * c; count[2] += 1.0; }
      if (x >= 0 && y >= 0) { mean[3] += c; sqMean[3] += c * c; count[3] += 1.0; }
    }
  }

  // 3. Soft variance-weighted average (generalized Kuwahara avoids harsh blocky artifacts)
  vec3 accum = vec3(0.0);
  float weightSum = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 m = mean[i] / max(count[i], 1.0);
    vec3 v = abs(sqMean[i] / max(count[i], 1.0) - m * m);
    float sigma2 = v.r + v.g + v.b;
    float w = 1.0 / (1.0 + pow(sigma2 * 180.0, uSharpness * 0.5));
    accum += m * w;
    weightSum += w;
  }

  fragColor = vec4(accum / max(weightSum, 1e-5), 1.0);
}
`;
