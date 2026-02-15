/**
 * Performance monitor — real-time FPS, frame time, and GPU budget tracking.
 */

export interface PerformanceSnapshot {
  fps: number;
  frameTimeMs: number;       // Average frame time
  frameTimeMin: number;
  frameTimeMax: number;
  gpuTimeMs: number;         // Estimated GPU time
  triangleCount: number;
  drawCalls: number;
  nodeCount: number;
  memoryUsageMB: number;
}

export interface PerformanceMonitor {
  readonly current: PerformanceSnapshot;
  readonly history: PerformanceSnapshot[];

  targetFPS: number;
  targetFrameTimeMs: number;
  readonly isOverBudget: boolean;
  readonly budgetRatio: number;  // < 1 = under budget, > 1 = over budget

  beginFrame(): void;
  endFrame(stats: { triangleCount: number; drawCalls: number; nodeCount: number }): void;
  reset(): void;
}

const HISTORY_SIZE = 120; // ~2 seconds at 60fps
const SMOOTHING_WINDOW = 10;

export function createPerformanceMonitor(targetFPS = 60): PerformanceMonitor {
  const frameTimes: number[] = [];
  let frameStart = 0;
  const historyBuffer: PerformanceSnapshot[] = [];
  let currentSnapshot: PerformanceSnapshot = createEmptySnapshot();

  function createEmptySnapshot(): PerformanceSnapshot {
    return {
      fps: 0,
      frameTimeMs: 0,
      frameTimeMin: Infinity,
      frameTimeMax: 0,
      gpuTimeMs: 0,
      triangleCount: 0,
      drawCalls: 0,
      nodeCount: 0,
      memoryUsageMB: 0,
    };
  }

  const monitor: PerformanceMonitor = {
    targetFPS,

    get targetFrameTimeMs(): number {
      return 1000 / monitor.targetFPS;
    },

    get current(): PerformanceSnapshot {
      return currentSnapshot;
    },

    get history(): PerformanceSnapshot[] {
      return historyBuffer;
    },

    get isOverBudget(): boolean {
      return currentSnapshot.frameTimeMs > monitor.targetFrameTimeMs;
    },

    get budgetRatio(): number {
      if (currentSnapshot.frameTimeMs === 0) return 0;
      return currentSnapshot.frameTimeMs / monitor.targetFrameTimeMs;
    },

    beginFrame(): void {
      frameStart = performance.now();
    },

    endFrame(stats): void {
      const elapsed = performance.now() - frameStart;
      frameTimes.push(elapsed);

      if (frameTimes.length > SMOOTHING_WINDOW) {
        frameTimes.shift();
      }

      const avg =
        frameTimes.reduce((sum, t) => sum + t, 0) / frameTimes.length;
      const min = Math.min(...frameTimes);
      const max = Math.max(...frameTimes);

      currentSnapshot = {
        fps: avg > 0 ? 1000 / avg : 0,
        frameTimeMs: avg,
        frameTimeMin: min,
        frameTimeMax: max,
        gpuTimeMs: avg * 0.7, // Estimate: ~70% of frame is GPU
        triangleCount: stats.triangleCount,
        drawCalls: stats.drawCalls,
        nodeCount: stats.nodeCount,
        memoryUsageMB: getMemoryUsage(),
      };

      historyBuffer.push({ ...currentSnapshot });
      if (historyBuffer.length > HISTORY_SIZE) {
        historyBuffer.shift();
      }
    },

    reset(): void {
      frameTimes.length = 0;
      historyBuffer.length = 0;
      currentSnapshot = createEmptySnapshot();
    },
  };

  return monitor;
}

function getMemoryUsage(): number {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number };
  };
  if (perf.memory) {
    return perf.memory.usedJSHeapSize / (1024 * 1024);
  }
  return 0;
}
