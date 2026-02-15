/**
 * AI Optimizer — performance-aware mesh simplification and optimization.
 *
 * Analyzes scene complexity and GPU budget to recommend:
 * - Which meshes to simplify
 * - Optimal LOD levels per object
 * - Whether to reduce shader complexity
 */

import type {
  Engine,
  SceneNode,
} from "@3d-engine/core";
import {
  generateSimplifiedGeometry,
  vec3Distance,
  type Vec3,
} from "@3d-engine/core";

// ── Types ───────────────────────────────────────────────────────

export interface OptimizationResult {
  meshesSimplified: number;
  trianglesRemoved: number;
  estimatedSavingsMs: number;
  recommendations: OptimizationRecommendation[];
}

export interface OptimizationRecommendation {
  nodeId: number;
  nodeName: string;
  action: "simplify" | "reduce-lod" | "hide" | "merge";
  reason: string;
  estimatedSavingsMs: number;
}

export interface OptimizerConfig {
  /** Target frame budget in ms */
  targetBudgetMs: number;

  /** Minimum importance level to never optimize */
  protectedImportance: "high" | "medium" | "low";

  /** Maximum reduction factor per pass */
  maxReductionPerPass: number;

  /** Distance threshold for culling */
  cullingDistance: number;
}

const DEFAULT_CONFIG: OptimizerConfig = {
  targetBudgetMs: 16,
  protectedImportance: "high",
  maxReductionPerPass: 0.3,
  cullingDistance: 100,
};

// ── Optimizer ───────────────────────────────────────────────────

export interface MeshOptimizer {
  analyze(engine: Engine): OptimizationRecommendation[];
  optimize(engine: Engine): OptimizationResult;
  autoOptimize(engine: Engine): void;
}

export function createMeshOptimizer(
  config: Partial<OptimizerConfig> = {},
): MeshOptimizer {
  const cfg: OptimizerConfig = { ...DEFAULT_CONFIG, ...config };

  function getNodeCost(node: SceneNode): number {
    if (!node.mesh) return 0;
    // Rough estimate: ~0.001ms per 100 triangles
    return (node.mesh.indexCount / 3 / 100) * 0.001;
  }

  function shouldProtect(node: SceneNode): boolean {
    const importanceOrder = ["low", "medium", "high"];
    return (
      importanceOrder.indexOf(node.importance) >=
      importanceOrder.indexOf(cfg.protectedImportance)
    );
  }

  const optimizer: MeshOptimizer = {
    analyze(engine: Engine): OptimizationRecommendation[] {
      const recommendations: OptimizationRecommendation[] = [];
      const cameraPos: Vec3 = engine.camera.position;

      for (const node of engine.scene.renderableNodes()) {
        if (shouldProtect(node)) continue;
        if (!node.mesh) continue;

        const distance = vec3Distance(node.transform.position, cameraPos);

        // Recommend hiding if far away
        if (distance > cfg.cullingDistance) {
          recommendations.push({
            nodeId: node.id,
            nodeName: node.name,
            action: "hide",
            reason: `Distance ${distance.toFixed(0)} exceeds culling threshold`,
            estimatedSavingsMs: getNodeCost(node),
          });
          continue;
        }

        // Recommend LOD reduction for distant objects
        if (distance > cfg.cullingDistance * 0.5) {
          recommendations.push({
            nodeId: node.id,
            nodeName: node.name,
            action: "reduce-lod",
            reason: `Object is at distance ${distance.toFixed(0)}`,
            estimatedSavingsMs: getNodeCost(node) * 0.5,
          });
          continue;
        }

        // Recommend simplification for high-poly objects
        const triCount = node.mesh.indexCount / 3;
        if (triCount > 5000 && node.importance === "low") {
          recommendations.push({
            nodeId: node.id,
            nodeName: node.name,
            action: "simplify",
            reason: `${triCount} triangles with low importance`,
            estimatedSavingsMs: getNodeCost(node) * cfg.maxReductionPerPass,
          });
        }
      }

      return recommendations.sort(
        (a, b) => b.estimatedSavingsMs - a.estimatedSavingsMs,
      );
    },

    optimize(engine: Engine): OptimizationResult {
      const recommendations = optimizer.analyze(engine);
      let meshesSimplified = 0;
      let trianglesRemoved = 0;
      let estimatedSavingsMs = 0;

      for (const rec of recommendations) {
        const node = engine.scene.getNode(rec.nodeId);
        if (!node?.mesh) continue;

        switch (rec.action) {
          case "hide":
            node.visible = false;
            trianglesRemoved += node.mesh.indexCount / 3;
            estimatedSavingsMs += rec.estimatedSavingsMs;
            meshesSimplified++;
            break;

          case "reduce-lod":
            if (node.mesh.lodLevels.length > 1) {
              const newLOD = Math.min(
                node.mesh.currentLOD + 1,
                node.mesh.lodLevels.length - 1,
              );
              const oldTris = node.mesh.indexCount / 3;
              node.mesh.setLOD(newLOD, engine.ctx);
              trianglesRemoved += oldTris - node.mesh.indexCount / 3;
              estimatedSavingsMs += rec.estimatedSavingsMs;
              meshesSimplified++;
            }
            break;

          case "simplify": {
            const simplified = generateSimplifiedGeometry(
              node.mesh.geometryData,
              cfg.maxReductionPerPass,
            );
            const oldTris = node.mesh.indexCount / 3;
            // Add as new LOD level
            node.mesh.lodLevels.push(simplified);
            node.mesh.setLOD(node.mesh.lodLevels.length - 1, engine.ctx);
            trianglesRemoved += oldTris - simplified.indexCount / 3;
            estimatedSavingsMs += rec.estimatedSavingsMs;
            meshesSimplified++;
            break;
          }
        }
      }

      return {
        meshesSimplified,
        trianglesRemoved,
        estimatedSavingsMs,
        recommendations,
      };
    },

    autoOptimize(engine: Engine): void {
      const snapshot = engine.monitor.current;
      if (snapshot.frameTimeMs > cfg.targetBudgetMs) {
        optimizer.optimize(engine);
      }
    },
  };

  return optimizer;
}
