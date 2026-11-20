/**
 * Shared fullscreen vertex shader and GLSL utility functions.
 * All shaders use WebGL2 (#version 300 es) with normalized UV in [0, 1].
 */

export const FULLSCREEN_VERT = `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  // Oversized single triangle covering [-1, 1] clip space.
  // Textures are uploaded with UNPACK_FLIP_Y_WEBGL=true so UV (0,1) is top-left
  // across both uploaded textures and FBO attachments for any number of passes.
  vec2 pos = vec2(
    float((gl_VertexID & 1) << 2) - 1.0,
    float((gl_VertexID & 2) << 1) - 1.0
  );
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const GLSL_NOISE_HELPERS = `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Subtle procedural linen canvas weave (warp + weft threads)
float canvasWeave(vec2 fragCoord, float scale) {
  vec2 p = fragCoord * scale;
  float warp = sin(p.x * 6.2831853) * 0.5 + 0.5;
  float weft = sin(p.y * 6.2831853) * 0.5 + 0.5;
  float checker = mod(floor(p.x) + floor(p.y), 2.0);
  float weave = mix(warp, weft, checker);
  float grain = valueNoise(p * 0.35) * 0.35;
  return (weave * 0.65 + grain) - 0.5;
}
`;
