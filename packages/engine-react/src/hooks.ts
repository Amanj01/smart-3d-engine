/**
 * Custom React hooks for engine interaction.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import type {
  Engine,
  PerformanceSnapshot,
  SceneNode,
} from "@3d-engine/core";
import { useEngine } from "./context";

/**
 * Returns the current performance snapshot, updated each frame.
 */
export function usePerformance(): PerformanceSnapshot | null {
  const engine = useEngine();
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);

  useEffect(() => {
    const prev = engine.onPerformanceUpdate;
    engine.onPerformanceUpdate = (snap) => {
      prev?.(snap);
      setSnapshot(snap);
    };
    return () => {
      engine.onPerformanceUpdate = prev;
    };
  }, [engine]);

  return snapshot;
}

/**
 * Executes a callback every frame with delta time.
 */
export function useFrame(callback: (engine: Engine, dt: number) => void): void {
  const engine = useEngine();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const prev = engine.onFrame;
    engine.onFrame = (eng, dt) => {
      prev?.(eng, dt);
      callbackRef.current(eng, dt);
    };
    return () => {
      engine.onFrame = prev;
    };
  }, [engine]);
}

/**
 * Returns a scene node lookup helper.
 */
export function useSceneNode(name: string): SceneNode | undefined {
  const engine = useEngine();
  const [node, setNode] = useState<SceneNode | undefined>();

  useEffect(() => {
    const found = engine.scene.findByName(name);
    setNode(found);
  }, [engine, name]);

  return node;
}

/**
 * Returns a resize handler for the engine canvas.
 */
export function useResize(): (width: number, height: number) => void {
  const engine = useEngine();
  return useCallback(
    (width: number, height: number) => engine.resize(width, height),
    [engine],
  );
}
