/**
 * GPU rendering context — abstracts WebGPU with WebGL fallback.
 */

export type RendererBackend = "webgpu" | "webgl";

export interface RendererContextOptions {
  canvas: HTMLCanvasElement;
  preferredBackend?: RendererBackend;
  powerPreference?: GPUPowerPreference;
  antialias?: boolean;
}

export interface RendererContext {
  readonly backend: RendererBackend;
  readonly canvas: HTMLCanvasElement;

  // WebGPU handles (null if WebGL)
  readonly device: GPUDevice | null;
  readonly gpuContext: GPUCanvasContext | null;
  readonly format: GPUTextureFormat | null;

  // WebGL handles (null if WebGPU)
  readonly gl: WebGL2RenderingContext | null;

  configure(width: number, height: number): void;
  destroy(): void;
}

// ── WebGPU context ──────────────────────────────────────────────

class WebGPUContext implements RendererContext {
  readonly backend: RendererBackend = "webgpu";
  readonly device: GPUDevice;
  readonly gpuContext: GPUCanvasContext;
  readonly format: GPUTextureFormat;
  readonly gl = null;

  constructor(
    readonly canvas: HTMLCanvasElement,
    device: GPUDevice,
    gpuContext: GPUCanvasContext,
    format: GPUTextureFormat,
  ) {
    this.device = device;
    this.gpuContext = gpuContext;
    this.format = format;
  }

  configure(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gpuContext.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });
  }

  destroy(): void {
    this.device.destroy();
  }
}

// ── WebGL2 fallback context ─────────────────────────────────────

class WebGL2Context implements RendererContext {
  readonly backend: RendererBackend = "webgl";
  readonly device = null;
  readonly gpuContext = null;
  readonly format = null;
  readonly gl: WebGL2RenderingContext;

  constructor(
    readonly canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
  ) {
    this.gl = gl;
  }

  configure(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  destroy(): void {
    const ext = this.gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
  }
}

// ── Factory ─────────────────────────────────────────────────────

async function initWebGPU(
  canvas: HTMLCanvasElement,
  powerPreference?: GPUPowerPreference,
): Promise<WebGPUContext> {
  const adapter = await navigator.gpu.requestAdapter({ powerPreference });
  if (!adapter) throw new Error("WebGPU adapter unavailable");

  const device = await adapter.requestDevice();
  const gpuContext = canvas.getContext("webgpu");
  if (!gpuContext) throw new Error("WebGPU canvas context unavailable");

  const format = navigator.gpu.getPreferredCanvasFormat();

  gpuContext.configure({
    device,
    format,
    alphaMode: "premultiplied",
  });

  return new WebGPUContext(canvas, device, gpuContext, format);
}

function initWebGL2(
  canvas: HTMLCanvasElement,
  antialias: boolean,
): WebGL2Context {
  const gl = canvas.getContext("webgl2", { antialias });
  if (!gl) throw new Error("WebGL2 unavailable");
  return new WebGL2Context(canvas, gl);
}

export async function createRendererContext(
  options: RendererContextOptions,
): Promise<RendererContext> {
  const { canvas, preferredBackend = "webgpu", powerPreference, antialias = true } = options;

  if (preferredBackend === "webgpu" && typeof navigator !== "undefined" && navigator.gpu) {
    try {
      return await initWebGPU(canvas, powerPreference);
    } catch {
      // fall through to WebGL
    }
  }

  return initWebGL2(canvas, antialias);
}
