/**
 * React context — provides engine instance to the component tree.
 */

import { createContext, useContext } from "react";
import type { Engine } from "@3d-engine/core";

export interface EngineContextValue {
  engine: Engine | null;
  isReady: boolean;
}

export const EngineContext = createContext<EngineContextValue>({
  engine: null,
  isReady: false,
});

export function useEngine(): Engine {
  const { engine } = useContext(EngineContext);
  if (!engine) {
    throw new Error("useEngine must be used within an <EngineProvider>");
  }
  return engine;
}

export function useEngineContext(): EngineContextValue {
  return useContext(EngineContext);
}
