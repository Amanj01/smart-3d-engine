/**
 * Engine — top-level orchestrator that ties together renderer, scene, camera,
 * lighting, performance monitoring, and adaptive quality.
 */

import {
  createRendererContext,
  type RendererContext,
  type RendererBackend,
} from "./renderer/context";
import {
  createRenderPipeline,
  type RenderPipeline,
} from "./renderer/pipeline";
import { SceneGraph } from "./scene/scene";
import { createCamera, type Camera, type CameraOptions } from "./camera/camera";
import { createLight, type Light, type LightOptions } from "./lighting/light";
import {
  createPerformanceMonitor,
  type PerformanceMonitor,
  type PerformanceSnapshot,
} from "./performance/monitor";
import {
  createAdaptiveController,
  type AdaptiveController,
  type AdaptiveControllerConfig,
} from "./performance/adaptive-controller";
import type { ShaderTier } from "./renderer/shader";

// ── Public API types ────────────────────────────────────────────

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  preferredBackend?: RendererBackend;
  powerPreference?: "high-performance" | "low-power";
  antialias?: boolean;

  // Adaptive quality
  adaptive?: boolean;
  targetFPS?: number;
  adaptiveConfig?: Partial<AdaptiveControllerConfig>;

  // Camera
  camera?: CameraOptions;

  // Pipeline
  shaderTier?: ShaderTier;

  // Callbacks
  onReady?: (engine: Engine) => void;
  onFrame?: (engine: Engine, dt: number) => void;
  onPerformanceUpdate?: (snapshot: PerformanceSnapshot) => void;
}

export interface Engine {
  // Core systems
  readonly ctx: RendererContext;
  readonly pipeline: RenderPipeline;
  readonly scene: SceneGraph;
  readonly camera: Camera;
  readonly lights: Light[];
  readonly monitor: PerformanceMonitor;
  readonly adaptiveController: AdaptiveController;

  // State
  readonly isRunning: boolean;
  readonly backend: RendererBackend;
  readonly frameCount: number;

  // Lifecycle
  start(): void;
  stop(): void;
  resize(width: number, height: number): void;
  destroy(): void;

  // Scene management
  addLight(options?: LightOptions): Light;
  removeLight(light: Light): void;

  // Callbacks
  onFrame: ((engine: Engine, dt: number) => void) | null;
  onPerformanceUpdate: ((snapshot: PerformanceSnapshot) => void) | null;
}

// ── Engine implementation ───────────────────────────────────────

export async function createEngine(options: EngineOptions): Promise<Engine> {
  const ctx = await createRendererContext({
    canvas: options.canvas,
    preferredBackend: options.preferredBackend,
    powerPreference: options.powerPreference,
    antialias: options.antialias,
  });

  const targetFPS = options.targetFPS ?? 60;

  const pipeline = createRenderPipeline(ctx, {
    shaderTier: options.shaderTier,
  });

  const scene = new SceneGraph();
  const camera = createCamera(options.camera);
  const lights: Light[] = [];
  const monitor = createPerformanceMonitor(targetFPS);
  const adaptiveController = createAdaptiveController({
    enabled: options.adaptive ?? true,
    targetFPS,
    ...options.adaptiveConfig,
  });

  // Add default light if none provided
  lights.push(createLight({
    type: "directional",
    direction: [0.3, -0.8, -0.5],
    ambientIntensity: 0.2,
  }));

  let isRunning = false;
  let frameCount = 0;
  let rafId = 0;
  let lastTime = 0;

  function frame(now: number): void {
    if (!isRunning) return;

    const dt = lastTime === 0 ? 16.67 : now - lastTime;
    lastTime = now;
    frameCount++;

    monitor.beginFrame();

    // User update callback
    engine.onFrame?.(engine, dt);

    // Update camera aspect ratio
    camera.aspect = ctx.canvas.width / ctx.canvas.height;
    camera.update();

    // Render
    pipeline.render(scene, camera, lights);

    // Collect stats
    let triangleCount = 0;
    let drawCalls = 0;
    for (const node of scene.renderableNodes()) {
      if (node.mesh) {
        triangleCount += node.mesh.indexCount / 3;
        drawCalls++;
      }
    }

    monitor.endFrame({
      triangleCount,
      drawCalls,
      nodeCount: scene.nodeCount,
    });

    // Adaptive quality adjustment
    adaptiveController.update(monitor, pipeline, scene, ctx);

    // Performance callback
    engine.onPerformanceUpdate?.(monitor.current);

    rafId = requestAnimationFrame(frame);
  }

  const engine: Engine = {
    ctx,
    pipeline,
    scene,
    camera,
    lights,
    monitor,
    adaptiveController,

    get isRunning(): boolean {
      return isRunning;
    },
    get backend(): RendererBackend {
      return ctx.backend;
    },
    get frameCount(): number {
      return frameCount;
    },

    onFrame: options.onFrame ?? null,
    onPerformanceUpdate: options.onPerformanceUpdate ?? null,

    start(): void {
      if (isRunning) return;
      isRunning = true;
      lastTime = 0;
      rafId = requestAnimationFrame(frame);
    },

    stop(): void {
      isRunning = false;
      cancelAnimationFrame(rafId);
    },

    resize(width: number, height: number): void {
      ctx.configure(width, height);
      camera.aspect = width / height;
      camera.update();
    },

    destroy(): void {
      engine.stop();
      pipeline.destroy();
      // Destroy all meshes
      for (const node of scene.renderableNodes()) {
        node.mesh?.destroy(ctx);
      }
      ctx.destroy();
    },

    addLight(lightOptions?: LightOptions): Light {
      const light = createLight(lightOptions);
      lights.push(light);
      return light;
    },

    removeLight(light: Light): void {
      const idx = lights.indexOf(light);
      if (idx !== -1) lights.splice(idx, 1);
    },
  };

  // Call ready callback
  options.onReady?.(engine);

  return engine;
}
