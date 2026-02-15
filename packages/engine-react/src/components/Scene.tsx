/**
 * <Scene> — provides declarative scene graph management.
 * Children are rendered into the engine's scene.
 */

import React, {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { SceneGraph, SceneNode } from "@3d-engine/core";
import { useEngine } from "../context";

interface SceneContextValue {
  scene: SceneGraph;
  parentNode: SceneNode;
}

const SceneContext = createContext<SceneContextValue | null>(null);

export function useScene(): SceneContextValue {
  const ctx = useContext(SceneContext);
  if (!ctx) {
    throw new Error("useScene must be used within a <Scene>");
  }
  return ctx;
}

export interface SceneProps {
  children?: ReactNode;
}

export function Scene({ children }: SceneProps): React.JSX.Element {
  const engine = useEngine();

  return (
    <SceneContext.Provider
      value={{ scene: engine.scene, parentNode: engine.scene.root }}
    >
      {children}
    </SceneContext.Provider>
  );
}
