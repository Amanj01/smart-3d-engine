/**
 * <EngineProvider> — initializes the core engine and provides it via context.
 * This is the root component for the 3D engine in React.
 *
 * Usage:
 *   <EngineProvider adaptive targetFPS={60}>
 *     <Scene>
 *       ...
 *     </Scene>
 *   </EngineProvider>
 */

import React, {
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createEngine,
  type Engine,
  type RendererBackend,
  type PerformanceSnapshot,
  type ShaderTier,
} from "@3d-engine/core";
import { EngineContext } from "../context";

export interface EngineProviderProps {
  children?: ReactNode;

  /** Preferred GPU backend */
  backend?: RendererBackend;

  /** Enable adaptive quality control */
  adaptive?: boolean;

  /** Target frames per second */
  targetFPS?: number;

  /** Initial shader quality tier */
  shaderTier?: ShaderTier;

  /** Canvas width (default: 100%) */
  width?: number | string;

  /** Canvas height (default: 100%) */
  height?: number | string;

  /** Canvas CSS style override */
  style?: React.CSSProperties;

  /** Canvas class name */
  className?: string;

  /** Called when engine is ready */
  onReady?: (engine: Engine) => void;

  /** Called each frame */
  onFrame?: (engine: Engine, dt: number) => void;

  /** Called with performance snapshots */
  onPerformance?: (snapshot: PerformanceSnapshot) => void;
}

export function EngineProvider({
  children,
  backend,
  adaptive = true,
  targetFPS = 60,
  shaderTier,
  width = "100%",
  height = "100%",
  style,
  className,
  onReady,
  onFrame,
  onPerformance,
}: EngineProviderProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [isReady, setIsReady] = useState(false);

  const onFrameRef = useRef(onFrame);
  const onPerformanceRef = useRef(onPerformance);
  onFrameRef.current = onFrame;
  onPerformanceRef.current = onPerformance;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;

    async function init() {
      const engine = await createEngine({
        canvas: canvas!,
        preferredBackend: backend,
        adaptive,
        targetFPS,
        shaderTier,
        onFrame: (eng, dt) => onFrameRef.current?.(eng, dt),
        onPerformanceUpdate: (snap) => onPerformanceRef.current?.(snap),
      });

      if (destroyed) {
        engine.destroy();
        return;
      }

      // Set initial size
      const rect = canvas!.getBoundingClientRect();
      engine.resize(rect.width * devicePixelRatio, rect.height * devicePixelRatio);

      engineRef.current = engine;
      setIsReady(true);
      onReady?.(engine);
      engine.start();
    }

    init();

    return () => {
      destroyed = true;
      engineRef.current?.destroy();
      engineRef.current = null;
      setIsReady(false);
    };
  }, [backend, adaptive, targetFPS, shaderTier, onReady]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        engineRef.current?.resize(w * devicePixelRatio, h * devicePixelRatio);
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const canvasStyle: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    display: "block",
    ...style,
  };

  return (
    <EngineContext.Provider value={{ engine: engineRef.current, isReady }}>
      <canvas ref={canvasRef} style={canvasStyle} className={className} />
      {isReady && children}
    </EngineContext.Provider>
  );
}
