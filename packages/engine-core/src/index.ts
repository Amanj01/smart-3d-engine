// ── Engine ───────────────────────────────────────────────────────
export { createEngine } from "./engine";
export type { Engine, EngineOptions } from "./engine";

// ── Renderer ────────────────────────────────────────────────────
export { createRendererContext } from "./renderer/context";
export type {
  RendererContext,
  RendererContextOptions,
  RendererBackend,
} from "./renderer/context";

export { createRenderPipeline } from "./renderer/pipeline";
export type { RenderPipeline, RenderPipelineOptions } from "./renderer/pipeline";

export type { ShaderTier } from "./renderer/shader";

// ── Scene ───────────────────────────────────────────────────────
export { SceneGraph } from "./scene/scene";
export { SceneNode } from "./scene/node";
export type { SceneNodeOptions } from "./scene/node";

// ── Transform / Math ────────────────────────────────────────────
export {
  mat4Identity,
  mat4Translation,
  mat4Scaling,
  mat4RotationX,
  mat4RotationY,
  mat4RotationZ,
  mat4FromQuat,
  mat4Multiply,
  mat4Transpose,
  mat4Invert,
  mat4Perspective,
  mat4LookAt,
  createTransform,
  transformToMatrix,
  vec3Normalize,
  vec3Distance,
} from "./scene/transform";
export type { Mat4, Vec3, Vec4, Quat, Transform } from "./scene/transform";

// ── Geometry ────────────────────────────────────────────────────
export {
  createMesh,
  createBoxMesh,
  createSphereMesh,
  createPlaneMesh,
} from "./geometry/mesh";
export type { Mesh, MeshOptions } from "./geometry/mesh";

export { interleaveVertexData, createGPUBuffers, createGLBuffers } from "./geometry/buffer";
export type { GeometryData, VertexLayout } from "./geometry/buffer";

export {
  generateLODLevels,
  generateSimplifiedGeometry,
  selectLODLevel,
  DEFAULT_LOD_CONFIG,
} from "./geometry/lod";
export type { LODLevel, LODConfig } from "./geometry/lod";

// ── Materials ───────────────────────────────────────────────────
export { createMaterial, createDefaultMaterial, MATERIALS } from "./materials/material";
export type { Material, MaterialOptions } from "./materials/material";

// ── Camera ──────────────────────────────────────────────────────
export { createCamera, createOrbitController } from "./camera/camera";
export type { Camera, CameraOptions, OrbitController } from "./camera/camera";

// ── Lighting ────────────────────────────────────────────────────
export { createLight, LIGHTS } from "./lighting/light";
export type { Light, LightOptions, LightType } from "./lighting/light";

// ── Performance ─────────────────────────────────────────────────
export { createPerformanceMonitor } from "./performance/monitor";
export type { PerformanceMonitor, PerformanceSnapshot } from "./performance/monitor";

export { createAdaptiveController } from "./performance/adaptive-controller";
export type {
  AdaptiveController,
  AdaptiveControllerConfig,
  QualityState,
} from "./performance/adaptive-controller";
