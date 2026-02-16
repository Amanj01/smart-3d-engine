// ── Generator ───────────────────────────────────────────────────
export {
  createProceduralGenerator,
  createAPIGenerator,
} from "./generator";
export type {
  GeneratedMesh,
  GeneratorConfig,
  MeshGenerator,
} from "./generator";

// ── Tripo3D ─────────────────────────────────────────────────────
export { createTripoGenerator } from "./tripo";
export type { TripoConfig } from "./tripo";

// ── GLB Parser ──────────────────────────────────────────────────
export { parseGLB } from "./glb-parser";

// ── Optimizer ───────────────────────────────────────────────────
export { createMeshOptimizer } from "./optimizer";
export type {
  MeshOptimizer,
  OptimizerConfig,
  OptimizationResult,
  OptimizationRecommendation,
} from "./optimizer";
