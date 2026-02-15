// ── Components ──────────────────────────────────────────────────
export { EngineProvider } from "./components/EngineProvider";
export type { EngineProviderProps } from "./components/EngineProvider";

export { Scene } from "./components/Scene";
export type { SceneProps } from "./components/Scene";

export { MeshComponent } from "./components/MeshComponent";
export type { MeshComponentProps, PrimitiveGeometry } from "./components/MeshComponent";

export { SmartMesh } from "./components/SmartMesh";
export type { SmartMeshProps } from "./components/SmartMesh";

export { CameraController } from "./components/CameraController";
export type { CameraControllerProps } from "./components/CameraController";

export { PerformanceOverlay } from "./components/PerformanceOverlay";
export type { PerformanceOverlayProps } from "./components/PerformanceOverlay";

// ── Context & Hooks ─────────────────────────────────────────────
export { useEngine, useEngineContext } from "./context";
export { usePerformance, useFrame, useSceneNode, useResize } from "./hooks";
