/**
 * <PerformanceOverlay> — renders real-time performance stats as an overlay.
 */

import React, { useEffect, useState } from "react";
import type { PerformanceSnapshot } from "@3d-engine/core";
import { useEngine } from "../context";

export interface PerformanceOverlayProps {
  /** Position on screen */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";

  /** Show extended stats */
  detailed?: boolean;

  /** Custom styling */
  style?: React.CSSProperties;
}

const POSITION_STYLES: Record<string, React.CSSProperties> = {
  "top-left": { top: 8, left: 8 },
  "top-right": { top: 8, right: 8 },
  "bottom-left": { bottom: 8, left: 8 },
  "bottom-right": { bottom: 8, right: 8 },
};

export function PerformanceOverlay({
  position = "top-left",
  detailed = false,
  style,
}: PerformanceOverlayProps): React.JSX.Element {
  const engine = useEngine();
  const [stats, setStats] = useState<PerformanceSnapshot | null>(null);

  useEffect(() => {
    const prevCallback = engine.onPerformanceUpdate;
    engine.onPerformanceUpdate = (snapshot) => {
      prevCallback?.(snapshot);
      setStats(snapshot);
    };

    return () => {
      engine.onPerformanceUpdate = prevCallback;
    };
  }, [engine]);

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    ...POSITION_STYLES[position],
    background: "rgba(0, 0, 0, 0.75)",
    color: "#0f0",
    fontFamily: "monospace",
    fontSize: 12,
    padding: "8px 12px",
    borderRadius: 4,
    pointerEvents: "none",
    zIndex: 9999,
    lineHeight: 1.6,
    ...style,
  };

  if (!stats) {
    return <div style={baseStyle}>Initializing...</div>;
  }

  const fpsColor =
    stats.fps >= 55 ? "#0f0" : stats.fps >= 30 ? "#ff0" : "#f00";

  return (
    <div style={baseStyle}>
      <div style={{ color: fpsColor }}>
        FPS: {stats.fps.toFixed(0)}
      </div>
      <div>Frame: {stats.frameTimeMs.toFixed(1)}ms</div>
      <div>Draws: {stats.drawCalls}</div>
      {detailed && (
        <>
          <div>Tris: {(stats.triangleCount / 1000).toFixed(1)}K</div>
          <div>Nodes: {stats.nodeCount}</div>
          <div>GPU~: {stats.gpuTimeMs.toFixed(1)}ms</div>
          <div>
            Range: {stats.frameTimeMin.toFixed(1)}-
            {stats.frameTimeMax.toFixed(1)}ms
          </div>
          {stats.memoryUsageMB > 0 && (
            <div>Mem: {stats.memoryUsageMB.toFixed(0)}MB</div>
          )}
          <div>
            Quality: {engine.adaptiveController.qualityState.shaderTier}
            {engine.adaptiveController.isAdapting ? " (adapting)" : ""}
          </div>
          <div>Backend: {engine.backend}</div>
        </>
      )}
    </div>
  );
}
