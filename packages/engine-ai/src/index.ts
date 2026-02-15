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

// ── Optimizer ───────────────────────────────────────────────────
export { createMeshOptimizer } from "./optimizer";
export type {
  MeshOptimizer,
  OptimizerConfig,
  OptimizationResult,
  OptimizationRecommendation,
} from "./optimizer";
