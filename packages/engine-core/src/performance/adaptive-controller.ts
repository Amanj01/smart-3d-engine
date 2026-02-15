/**
 * Adaptive Quality Controller — automatically adjusts rendering quality
 * based on real-time performance metrics and GPU budget.
 *
 * Every frame:
 *   1. Measure frame time
 *   2. Compare against target (e.g., 16ms for 60fps)
 *   3. Adjust scene quality up or down
 */

import type { PerformanceMonitor } from "./monitor";
import type { RenderPipeline } from "../renderer/pipeline";
import type { SceneGraph } from "../scene/scene";
import type { RendererContext } from "../renderer/context";
import type { ShaderTier } from "../renderer/shader";

export interface QualityState {
  shaderTier: ShaderTier;
  lodBias: number;            // 0 = no bias, positive = prefer lower LOD
  shadowMapSize: number;
  maxDrawCalls: number;
  particleMultiplier: number; // 0-1 scale factor for particle systems
}

export interface AdaptiveControllerConfig {
  enabled: boolean;
  targetFPS: number;

  // Hysteresis: prevent rapid oscillation
  upgradeThresholdMs: number;   // Must be faster than target by this much to upgrade
  downgradeThresholdMs: number; // Must be slower than target by this much to downgrade
  stabilityFrames: number;      // Consecutive frames before adjusting

  // Quality bounds
  minShaderTier: ShaderTier;
  maxShaderTier: ShaderTier;
  minShadowMapSize: number;
  maxShadowMapSize: number;
}

const DEFAULT_CONFIG: AdaptiveControllerConfig = {
  enabled: true,
  targetFPS: 60,
  upgradeThresholdMs: 2,    // 2ms headroom to upgrade
  downgradeThresholdMs: 4,  // 4ms over budget to downgrade
  stabilityFrames: 30,      // ~0.5s of stability before adjusting
  minShaderTier: "low",
  maxShaderTier: "high",
  minShadowMapSize: 256,
  maxShadowMapSize: 2048,
};

const SHADER_TIER_ORDER: ShaderTier[] = ["low", "medium", "high"];
const SHADOW_MAP_SIZES = [256, 512, 1024, 2048];

export interface AdaptiveController {
  readonly config: AdaptiveControllerConfig;
  readonly qualityState: QualityState;
  readonly isAdapting: boolean;
  update(
    monitor: PerformanceMonitor,
    pipeline: RenderPipeline,
    scene: SceneGraph,
    ctx: RendererContext,
  ): void;
  setEnabled(enabled: boolean): void;
  forceQuality(state: Partial<QualityState>): void;
}

export function createAdaptiveController(
  config: Partial<AdaptiveControllerConfig> = {},
): AdaptiveController {
  const fullConfig: AdaptiveControllerConfig = { ...DEFAULT_CONFIG, ...config };

  const qualityState: QualityState = {
    shaderTier: "medium",
    lodBias: 0,
    shadowMapSize: 1024,
    maxDrawCalls: Infinity,
    particleMultiplier: 1,
  };

  let framesOverBudget = 0;
  let framesUnderBudget = 0;
  let isAdapting = false;

  function downgrade(pipeline: RenderPipeline, scene: SceneGraph, ctx: RendererContext): void {
    isAdapting = true;

    // Priority 1: Reduce shadow map
    const shadowIdx = SHADOW_MAP_SIZES.indexOf(qualityState.shadowMapSize);
    const minShadowIdx = SHADOW_MAP_SIZES.indexOf(fullConfig.minShadowMapSize);
    if (shadowIdx > minShadowIdx) {
      qualityState.shadowMapSize = SHADOW_MAP_SIZES[shadowIdx - 1];
      return;
    }

    // Priority 2: Increase LOD bias (use simpler meshes)
    if (qualityState.lodBias < 2) {
      qualityState.lodBias++;
      for (const node of scene.renderableNodes()) {
        if (node.mesh && node.mesh.lodLevels.length > 1) {
          const targetLOD = Math.min(
            node.mesh.currentLOD + 1,
            node.mesh.lodLevels.length - 1,
          );
          node.mesh.setLOD(targetLOD, ctx);
        }
      }
      return;
    }

    // Priority 3: Reduce shader quality
    const tierIdx = SHADER_TIER_ORDER.indexOf(qualityState.shaderTier);
    const minTierIdx = SHADER_TIER_ORDER.indexOf(fullConfig.minShaderTier);
    if (tierIdx > minTierIdx) {
      qualityState.shaderTier = SHADER_TIER_ORDER[tierIdx - 1];
      pipeline.setShaderTier(qualityState.shaderTier);
      return;
    }

    // Priority 4: Reduce particles
    if (qualityState.particleMultiplier > 0.1) {
      qualityState.particleMultiplier = Math.max(0.1, qualityState.particleMultiplier - 0.25);
    }
  }

  function upgrade(pipeline: RenderPipeline, scene: SceneGraph, ctx: RendererContext): void {
    isAdapting = true;

    // Reverse priority: upgrade particles first, then shaders, then LOD, then shadows.

    // Priority 1: Increase particles
    if (qualityState.particleMultiplier < 1) {
      qualityState.particleMultiplier = Math.min(1, qualityState.particleMultiplier + 0.25);
      return;
    }

    // Priority 2: Increase shader quality
    const tierIdx = SHADER_TIER_ORDER.indexOf(qualityState.shaderTier);
    const maxTierIdx = SHADER_TIER_ORDER.indexOf(fullConfig.maxShaderTier);
    if (tierIdx < maxTierIdx) {
      qualityState.shaderTier = SHADER_TIER_ORDER[tierIdx + 1];
      pipeline.setShaderTier(qualityState.shaderTier);
      return;
    }

    // Priority 3: Reduce LOD bias (use more detailed meshes)
    if (qualityState.lodBias > 0) {
      qualityState.lodBias--;
      for (const node of scene.renderableNodes()) {
        if (node.mesh && node.mesh.currentLOD > 0) {
          node.mesh.setLOD(node.mesh.currentLOD - 1, ctx);
        }
      }
      return;
    }

    // Priority 4: Increase shadow map
    const shadowIdx = SHADOW_MAP_SIZES.indexOf(qualityState.shadowMapSize);
    const maxShadowIdx = SHADOW_MAP_SIZES.indexOf(fullConfig.maxShadowMapSize);
    if (shadowIdx < maxShadowIdx) {
      qualityState.shadowMapSize = SHADOW_MAP_SIZES[shadowIdx + 1];
    }
  }

  const controller: AdaptiveController = {
    config: fullConfig,

    get qualityState(): QualityState {
      return qualityState;
    },

    get isAdapting(): boolean {
      return isAdapting;
    },

    update(monitor, pipeline, scene, ctx): void {
      if (!fullConfig.enabled) return;

      const targetMs = 1000 / fullConfig.targetFPS;
      const frameMs = monitor.current.frameTimeMs;

      if (frameMs === 0) return; // No data yet

      if (frameMs > targetMs + fullConfig.downgradeThresholdMs) {
        framesOverBudget++;
        framesUnderBudget = 0;

        if (framesOverBudget >= fullConfig.stabilityFrames) {
          downgrade(pipeline, scene, ctx);
          framesOverBudget = 0;
        }
      } else if (frameMs < targetMs - fullConfig.upgradeThresholdMs) {
        framesUnderBudget++;
        framesOverBudget = 0;

        if (framesUnderBudget >= fullConfig.stabilityFrames * 2) {
          // More conservative about upgrading
          upgrade(pipeline, scene, ctx);
          framesUnderBudget = 0;
        }
      } else {
        // Within budget — stabilize
        framesOverBudget = Math.max(0, framesOverBudget - 1);
        framesUnderBudget = Math.max(0, framesUnderBudget - 1);
        isAdapting = false;
      }
    },

    setEnabled(enabled: boolean): void {
      fullConfig.enabled = enabled;
      if (!enabled) {
        framesOverBudget = 0;
        framesUnderBudget = 0;
        isAdapting = false;
      }
    },

    forceQuality(state: Partial<QualityState>): void {
      Object.assign(qualityState, state);
    },
  };

  return controller;
}
