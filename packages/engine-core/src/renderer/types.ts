/** Rendering backend type */
export type RendererBackend = "webgpu" | "webgl";

/** Configuration for initializing the renderer */
export interface RendererConfig {
  canvas: HTMLCanvasElement;
  preferredBackend?: RendererBackend;
  antialias?: boolean;
  powerPreference?: "high-performance" | "low-power" | "default";
  pixelRatio?: number;
  maxTextureSize?: number;
}

/** Resolved renderer capabilities after initialization */
export interface RendererCapabilities {
  backend: RendererBackend;
  maxTextureSize: number;
  maxBufferSize: number;
  supportsCompute: boolean;
  supportsStorageBuffers: boolean;
  maxSampleCount: number;
}

/** Uniform buffer data for the global render pass */
export interface GlobalUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  viewProjectionMatrix: Float32Array;
  cameraPosition: Float32Array;
  time: number;
  deltaTime: number;
  resolution: [number, number];
}

/** A render target (framebuffer) */
export interface RenderTarget {
  width: number;
  height: number;
  colorTexture: GPUTexture | WebGLTexture | null;
  depthTexture: GPUTexture | WebGLTexture | null;
}

/** Vertex attribute layout */
export interface VertexAttribute {
  name: string;
  format: string;
  offset: number;
  shaderLocation: number;
}

/** Vertex buffer layout */
export interface VertexBufferLayout {
  arrayStride: number;
  stepMode: "vertex" | "instance";
  attributes: VertexAttribute[];
}
