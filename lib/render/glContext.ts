import { FULLSCREEN_VERT } from "./shaders/common";
import { KUWAHARA_FRAG } from "./shaders/kuwahara";
import { BLUR_FRAG } from "./shaders/blur";
import {
  ACCENTS_FRAG,
  DISPLAY_POST_FRAG,
  FOCAL_BLEND_FRAG,
} from "./shaders/composite";

type ShaderProgramId =
  | "kuwahara"
  | "blur"
  | "focalBlend"
  | "accents"
  | "displayPost";

const FRAG_SOURCES: Record<ShaderProgramId, string> = {
  kuwahara: KUWAHARA_FRAG,
  blur: BLUR_FRAG,
  focalBlend: FOCAL_BLEND_FRAG,
  accents: ACCENTS_FRAG,
  displayPost: DISPLAY_POST_FRAG,
};

type CachedR8Slot = {
  tex: WebGLTexture;
  dataRef: Uint8Array | null;
  width: number;
  height: number;
};

export type DisplayPostOptions = {
  blurRadius?: number;
  contrastDrop?: number;
  weaveStrength?: number;
  grayscale?: boolean;
  valueMapSteps?: 3 | 5 | 9 | null;
  valueMapData?: Uint8Array | null;
  isolateValue?: number | null;
  valueContinuousData?: Uint8Array | null;
  gamutMaskData?: Uint8Array | null;
};

/**
 * Shared offscreen WebGL2 rendering pipeline for fast per-pixel painting filters.
 * - Serializes async GPU passes to avoid FBO/canvas races
 * - Keeps compiled shader programs, uniform locations, and FBOs alive
 * - Chains multi-pass stages on the GPU without intermediate ImageBitmap round-trips
 * - Handles WebGL context loss gracefully
 */
export class StudioGLPipeline {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private programs = new Map<ShaderProgramId, WebGLProgram>();
  private uniformCache = new Map<
    ShaderProgramId,
    Map<string, WebGLUniformLocation | null>
  >();
  private vao: WebGLVertexArrayObject;

  private fboA: WebGLFramebuffer | null = null;
  private texA: WebGLTexture | null = null;
  private fboB: WebGLFramebuffer | null = null;
  private texB: WebGLTexture | null = null;
  private fboC: WebGLFramebuffer | null = null;
  private texC: WebGLTexture | null = null;
  private fboWidth = 0;
  private fboHeight = 0;

  private dummyR8Tex: WebGLTexture;
  private r8Slots = new Map<"valueMap" | "valueCont" | "gamutMask", CachedR8Slot>();

  private queue: Promise<unknown> = Promise.resolve();
  private contextLost = false;
  private onContextLostCallback?: () => void;

  constructor(onContextLost?: () => void) {
    this.onContextLostCallback = onContextLost;
    this.canvas = document.createElement("canvas");
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);

    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      throw new Error("WebGL2 is not supported in this browser.");
    }
    this.gl = gl;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create WebGL2 VAO.");
    this.vao = vao;

    this.dummyR8Tex = this.createR8Texture(1, 1, new Uint8Array([0]));
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.programs.clear();
    this.uniformCache.clear();
    this.fboA = null;
    this.texA = null;
    this.fboB = null;
    this.texB = null;
    this.fboC = null;
    this.texC = null;
    this.fboWidth = 0;
    this.fboHeight = 0;
    this.r8Slots.clear();
    this.onContextLostCallback?.();
  };

  isHealthy(): boolean {
    return !this.contextLost && !this.gl.isContextLost();
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => {
      if (!this.isHealthy()) {
        throw new Error("WebGL2 context was lost.");
      }
      return fn();
    });
    // Keep queue alive even if a single render rejects
    this.queue = run.catch(() => {});
    return run;
  }

  private getProgram(id: ShaderProgramId): WebGLProgram {
    const existing = this.programs.get(id);
    if (existing) return existing;

    const gl = this.gl;
    const vert = this.compileShader(gl.VERTEX_SHADER, FULLSCREEN_VERT);
    const frag = this.compileShader(gl.FRAGMENT_SHADER, FRAG_SOURCES[id]);

    const prog = gl.createProgram();
    if (!prog) throw new Error("Failed to create WebGL2 program.");
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);

    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) ?? "Unknown link error";
      gl.deleteProgram(prog);
      throw new Error(`Shader link failed (${id}): ${log}`);
    }

    this.programs.set(id, prog);
    this.uniformCache.set(id, new Map());
    return prog;
  }

  private getUniform(
    id: ShaderProgramId,
    prog: WebGLProgram,
    name: string
  ): WebGLUniformLocation | null {
    let map = this.uniformCache.get(id);
    if (!map) {
      map = new Map();
      this.uniformCache.set(id, map);
    }
    if (map.has(name)) {
      return map.get(name) ?? null;
    }
    const loc = this.gl.getUniformLocation(prog, name);
    map.set(name, loc);
    return loc;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create WebGL2 shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? "Unknown compile error";
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${log}`);
    }
    return shader;
  }

  private ensureSize(width: number, height: number): void {
    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (
      this.fboWidth === width &&
      this.fboHeight === height &&
      this.fboA &&
      this.fboB &&
      this.fboC
    ) {
      return;
    }

    if (this.fboA) gl.deleteFramebuffer(this.fboA);
    if (this.texA) gl.deleteTexture(this.texA);
    if (this.fboB) gl.deleteFramebuffer(this.fboB);
    if (this.texB) gl.deleteTexture(this.texB);
    if (this.fboC) gl.deleteFramebuffer(this.fboC);
    if (this.texC) gl.deleteTexture(this.texC);

    const makeTarget = () => {
      const tex = gl.createTexture();
      const fbo = gl.createFramebuffer();
      if (!tex || !fbo) throw new Error("Failed to allocate FBO.");
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        tex,
        0
      );
      return { tex, fbo };
    };

    const a = makeTarget();
    const b = makeTarget();
    const c = makeTarget();
    this.texA = a.tex;
    this.fboA = a.fbo;
    this.texB = b.tex;
    this.fboB = b.fbo;
    this.texC = c.tex;
    this.fboC = c.fbo;
    this.fboWidth = width;
    this.fboHeight = height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private uploadTexture(source: TexImageSource): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error("Failed to create texture.");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return tex;
  }

  private createR8Texture(
    width: number,
    height: number,
    data: Uint8Array
  ): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error("Failed to create R8 texture.");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      data
    );
    return tex;
  }

  private getOrUploadR8Slot(
    slotName: "valueMap" | "valueCont" | "gamutMask",
    data: Uint8Array | null | undefined,
    width: number,
    height: number
  ): WebGLTexture {
    if (!data || data.length !== width * height) {
      return this.dummyR8Tex;
    }
    const existing = this.r8Slots.get(slotName);
    if (
      existing &&
      existing.dataRef === data &&
      existing.width === width &&
      existing.height === height
    ) {
      return existing.tex;
    }

    const gl = this.gl;
    if (existing) {
      gl.bindTexture(gl.TEXTURE_2D, existing.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        width,
        height,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        data
      );
      existing.dataRef = data;
      existing.width = width;
      existing.height = height;
      return existing.tex;
    }

    const tex = this.createR8Texture(width, height, data);
    this.r8Slots.set(slotName, { tex, dataRef: data, width, height });
    return tex;
  }

  private drawQuad(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private passKuwahara(
    srcTex: WebGLTexture,
    targetFbo: WebGLFramebuffer | null,
    width: number,
    height: number,
    radius: number,
    sharpness: number,
    anisotropy: number
  ): void {
    const gl = this.gl;
    const prog = this.getProgram("kuwahara");
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
    gl.viewport(0, 0, width, height);
    gl.useProgram(prog);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this.getUniform("kuwahara", prog, "uSource"), 0);
    gl.uniform2f(
      this.getUniform("kuwahara", prog, "uTexelSize"),
      1 / width,
      1 / height
    );
    gl.uniform1f(this.getUniform("kuwahara", prog, "uRadius"), radius);
    gl.uniform1f(this.getUniform("kuwahara", prog, "uSharpness"), sharpness);
    gl.uniform1f(this.getUniform("kuwahara", prog, "uAnisotropy"), anisotropy);
    this.drawQuad();
  }

  private passSeparableBlur(
    srcTex: WebGLTexture,
    midFbo: WebGLFramebuffer,
    midTex: WebGLTexture,
    dstFbo: WebGLFramebuffer | null,
    width: number,
    height: number,
    radius: number
  ): void {
    const gl = this.gl;
    const prog = this.getProgram("blur");
    gl.viewport(0, 0, width, height);
    gl.useProgram(prog);

    // Horizontal pass -> midFbo
    gl.bindFramebuffer(gl.FRAMEBUFFER, midFbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this.getUniform("blur", prog, "uSource"), 0);
    gl.uniform2f(this.getUniform("blur", prog, "uDirection"), 1 / width, 0);
    gl.uniform1f(this.getUniform("blur", prog, "uRadius"), radius);
    this.drawQuad();

    // Vertical pass -> dstFbo
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFbo);
    gl.bindTexture(gl.TEXTURE_2D, midTex);
    gl.uniform2f(this.getUniform("blur", prog, "uDirection"), 0, 1 / height);
    this.drawQuad();
  }

  private passFocalBlend(
    sharpTex: WebGLTexture,
    softTex: WebGLTexture,
    targetFbo: WebGLFramebuffer | null,
    width: number,
    height: number,
    focalPoint: { x: number; y: number },
    strength: number
  ): void {
    const gl = this.gl;
    const prog = this.getProgram("focalBlend");
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
    gl.viewport(0, 0, width, height);
    gl.useProgram(prog);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sharpTex);
    gl.uniform1i(this.getUniform("focalBlend", prog, "uSharp"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, softTex);
    gl.uniform1i(this.getUniform("focalBlend", prog, "uSoft"), 1);

    // UV y=1 is top of image, whereas focalPoint.y=0 is top
    gl.uniform2f(
      this.getUniform("focalBlend", prog, "uFocalPoint"),
      focalPoint.x,
      1.0 - focalPoint.y
    );
    gl.uniform1f(this.getUniform("focalBlend", prog, "uAspect"), width / height);
    gl.uniform1f(this.getUniform("focalBlend", prog, "uFocusRadius"), 0.22);
    gl.uniform1f(this.getUniform("focalBlend", prog, "uFalloff"), 0.5);
    gl.uniform1f(this.getUniform("focalBlend", prog, "uStrength"), strength);
    this.drawQuad();
  }

  private passDisplayPost(
    srcTex: WebGLTexture,
    width: number,
    height: number,
    opts: DisplayPostOptions
  ): void {
    const gl = this.gl;
    const prog = this.getProgram("displayPost");
    const valueMapTex = this.getOrUploadR8Slot(
      "valueMap",
      opts.valueMapSteps ? opts.valueMapData : null,
      width,
      height
    );
    const valueContTex = this.getOrUploadR8Slot(
      "valueCont",
      opts.isolateValue != null ? opts.valueContinuousData : null,
      width,
      height
    );
    const gamutMaskTex = this.getOrUploadR8Slot(
      "gamutMask",
      opts.gamutMaskData ?? null,
      width,
      height
    );

    const hasValueMap =
      Boolean(opts.valueMapSteps) && valueMapTex !== this.dummyR8Tex;
    const hasIsolate =
      opts.isolateValue != null && valueContTex !== this.dummyR8Tex;
    const hasGamut = gamutMaskTex !== this.dummyR8Tex;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(prog);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this.getUniform("displayPost", prog, "uSource"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, valueMapTex);
    gl.uniform1i(this.getUniform("displayPost", prog, "uValueMapTex"), 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, valueContTex);
    gl.uniform1i(this.getUniform("displayPost", prog, "uValueContTex"), 2);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, gamutMaskTex);
    gl.uniform1i(this.getUniform("displayPost", prog, "uGamutMaskTex"), 3);

    gl.uniform1f(
      this.getUniform("displayPost", prog, "uContrastDrop"),
      opts.contrastDrop ?? 0
    );
    gl.uniform1f(
      this.getUniform("displayPost", prog, "uWeaveStrength"),
      opts.weaveStrength ?? 0
    );
    gl.uniform1i(
      this.getUniform("displayPost", prog, "uGrayscale"),
      opts.grayscale ? 1 : 0
    );
    gl.uniform1i(
      this.getUniform("displayPost", prog, "uValueMapSteps"),
      hasValueMap ? (opts.valueMapSteps ?? 0) : 0
    );
    gl.uniform1f(
      this.getUniform("displayPost", prog, "uIsolateValue"),
      hasIsolate ? (opts.isolateValue ?? -1) : -1
    );
    gl.uniform1i(
      this.getUniform("displayPost", prog, "uShowGamut"),
      hasGamut ? 1 : 0
    );

    this.drawQuad();
  }

  /**
   * Runs the Anisotropic Kuwahara painterly filter on an ImageData / ImageBitmap.
   */
  renderKuwahara(
    source: TexImageSource,
    width: number,
    height: number,
    radius: number,
    sharpness = 6.5,
    anisotropy = 0.75
  ): Promise<ImageBitmap> {
    return this.enqueue(async () => {
      this.ensureSize(width, height);
      const srcTex = this.uploadTexture(source);
      try {
        this.passKuwahara(
          srcTex,
          null,
          width,
          height,
          radius,
          sharpness,
          anisotropy
        );
        return await createImageBitmap(this.canvas);
      } finally {
        this.gl.deleteTexture(srcTex);
      }
    });
  }

  /**
   * Separable Gaussian blur + optional contrast drop / weave.
   */
  renderBlur(
    source: TexImageSource,
    width: number,
    height: number,
    radius: number,
    contrastDrop = 0,
    weaveStrength = 0
  ): Promise<ImageBitmap> {
    return this.renderDisplayPost(source, width, height, {
      blurRadius: radius,
      contrastDrop,
      weaveStrength,
    });
  }

  /**
   * Unified display post-processing pass on the GPU:
   * optional blur (skipped when blurRadius <= 0), contrast drop, weave,
   * value map posterization, perceptual linear-light grayscale, value isolation,
   * and gamut warning stripes.
   */
  renderDisplayPost(
    source: TexImageSource,
    width: number,
    height: number,
    opts: DisplayPostOptions
  ): Promise<ImageBitmap> {
    return this.enqueue(async () => {
      this.ensureSize(width, height);
      const srcTex = this.uploadTexture(source);
      try {
        const blurRadius = opts.blurRadius ?? 0;
        let postInput = srcTex;
        if (blurRadius > 0.001 && this.fboA && this.texA && this.fboB && this.texB) {
          this.passSeparableBlur(
            srcTex,
            this.fboA,
            this.texA,
            this.fboB,
            width,
            height,
            blurRadius
          );
          postInput = this.texB;
        }
        this.passDisplayPost(postInput, width, height, opts);
        return await createImageBitmap(this.canvas);
      } finally {
        this.gl.deleteTexture(srcTex);
      }
    });
  }

  /**
   * Chained GPU pipeline for Stage 6 (Refinement & Edges):
   * Kuwahara -> Blur -> Focal Blend in a single bitmap readback.
   */
  renderRefinementPipeline(
    source: TexImageSource,
    width: number,
    height: number,
    focalPoint: { x: number; y: number },
    sharpRadius: number,
    blurRadius: number,
    strength: number
  ): Promise<ImageBitmap> {
    return this.enqueue(async () => {
      this.ensureSize(width, height);
      if (
        !this.fboA ||
        !this.texA ||
        !this.fboB ||
        !this.texB ||
        !this.fboC ||
        !this.texC
      ) {
        throw new Error("FBO targets unavailable.");
      }

      const srcTex = this.uploadTexture(source);
      try {
        // 1. Sharp Kuwahara -> fboA
        this.passKuwahara(srcTex, this.fboA, width, height, sharpRadius, 7.2, 0.85);
        // 2. Soft blur of sharp -> fboB (H) -> fboC (V)
        this.passSeparableBlur(
          this.texA,
          this.fboB,
          this.texB,
          this.fboC,
          width,
          height,
          blurRadius
        );
        // 3. Focal-weighted blend -> screen
        this.passFocalBlend(
          this.texA,
          this.texC,
          null,
          width,
          height,
          focalPoint,
          strength
        );
        return await createImageBitmap(this.canvas);
      } finally {
        this.gl.deleteTexture(srcTex);
      }
    });
  }

  /**
   * Chained GPU pipeline for Stage 7 (Accents & Highlights):
   * Kuwahara -> Blur -> Focal Blend -> Accents in a single bitmap readback.
   */
  renderAccentsPipeline(
    source: TexImageSource,
    width: number,
    height: number,
    focalPoint: { x: number; y: number },
    progress: number,
    weaveAmount: number
  ): Promise<ImageBitmap> {
    return this.enqueue(async () => {
      this.ensureSize(width, height);
      if (
        !this.fboA ||
        !this.texA ||
        !this.fboB ||
        !this.texB ||
        !this.fboC ||
        !this.texC
      ) {
        throw new Error("FBO targets unavailable.");
      }

      const gl = this.gl;
      const srcTex = this.uploadTexture(source);
      try {
        // 1. Tight painterly base -> fboA
        this.passKuwahara(srcTex, this.fboA, width, height, 2.4, 7.5, 0.85);
        // 2. Soft periphery -> fboB (H) -> fboC (V)
        this.passSeparableBlur(
          this.texA,
          this.fboB,
          this.texB,
          this.fboC,
          width,
          height,
          3.2
        );
        // 3. Focal blend -> fboB
        this.passFocalBlend(
          this.texA,
          this.texC,
          this.fboB,
          width,
          height,
          focalPoint,
          1.0
        );
        // 4. Accents & highlights -> screen
        const prog = this.getProgram("accents");
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texB);
        gl.uniform1i(this.getUniform("accents", prog, "uBase"), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, srcTex);
        gl.uniform1i(this.getUniform("accents", prog, "uSource"), 1);

        gl.uniform1f(this.getUniform("accents", prog, "uProgress"), progress);
        gl.uniform1f(
          this.getUniform("accents", prog, "uWeaveAmount"),
          weaveAmount
        );
        this.drawQuad();

        return await createImageBitmap(this.canvas);
      } finally {
        gl.deleteTexture(srcTex);
      }
    });
  }
}

let sharedPipeline: StudioGLPipeline | null = null;

export function getStudioGLPipeline(): StudioGLPipeline | null {
  if (typeof window === "undefined") return null;
  if (sharedPipeline && !sharedPipeline.isHealthy()) {
    sharedPipeline = null;
  }
  if (!sharedPipeline) {
    try {
      sharedPipeline = new StudioGLPipeline(() => {
        sharedPipeline = null;
      });
    } catch {
      return null;
    }
  }
  return sharedPipeline;
}
