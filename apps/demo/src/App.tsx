import { useState, useCallback } from "react";
import {
  EngineProvider,
  Scene,
  MeshComponent,
  SmartMesh,
  CameraController,
  PerformanceOverlay,
  useFrame,
  useEngine,
} from "@3d-engine/react";
import { createProceduralGenerator } from "@3d-engine/ai";
import type { Engine, PerformanceSnapshot } from "@3d-engine/core";

// ── AI Generator (shared instance) ─────────────────────────────

const aiGenerator = createProceduralGenerator({ maxPolygons: 2000 });

// ── Animated mesh that rotates each frame ───────────────────────

function RotatingBox() {
  const engine = useEngine();
  const [rotation, setRotation] = useState(0);

  useFrame((_eng, dt) => {
    setRotation((r) => r + dt * 0.001);
  });

  // Convert Y rotation to quaternion
  const halfAngle = rotation / 2;
  const quat: [number, number, number, number] = [
    0,
    Math.sin(halfAngle),
    0,
    Math.cos(halfAngle),
  ];

  return (
    <MeshComponent
      geometry="box"
      material={{ baseColor: [0.2, 0.6, 1.0, 1.0], roughness: 0.3, metallic: 0.8 }}
      position={[-2, 0.5, 0]}
      rotation={quat}
      name="rotating-box"
      lod
    />
  );
}

// ── Control panel UI ────────────────────────────────────────────

function ControlPanel({
  adaptive,
  setAdaptive,
  shaderTier,
  setShaderTier,
  showSphere,
  setShowSphere,
  smartPrompt,
  setSmartPrompt,
}: {
  adaptive: boolean;
  setAdaptive: (v: boolean) => void;
  shaderTier: "low" | "medium" | "high";
  setShaderTier: (v: "low" | "medium" | "high") => void;
  showSphere: boolean;
  setShowSphere: (v: boolean) => void;
  smartPrompt: string;
  setSmartPrompt: (v: string) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        background: "rgba(0,0,0,0.8)",
        color: "#fff",
        padding: "16px 20px",
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 2,
        zIndex: 10000,
        minWidth: 260,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
        Engine Controls
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={adaptive}
          onChange={(e) => setAdaptive(e.target.checked)}
        />
        Adaptive Quality
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>Shader:</span>
        {(["low", "medium", "high"] as const).map((tier) => (
          <button
            key={tier}
            onClick={() => setShaderTier(tier)}
            style={{
              padding: "2px 10px",
              border: shaderTier === tier ? "2px solid #4af" : "1px solid #555",
              borderRadius: 4,
              background: shaderTier === tier ? "#1a3a5a" : "#222",
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {tier}
          </button>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={showSphere}
          onChange={(e) => setShowSphere(e.target.checked)}
        />
        Show Sphere
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>AI Mesh:</span>
        <select
          value={smartPrompt}
          onChange={(e) => setSmartPrompt(e.target.value)}
          style={{
            padding: "2px 8px",
            background: "#222",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          <option value="floating island">Floating Island</option>
          <option value="ancient rock">Ancient Rock</option>
          <option value="crystal pyramid">Crystal Pyramid</option>
          <option value="torus ring">Torus Ring</option>
          <option value="organic blob">Organic Blob</option>
          <option value="tree plant">Tree</option>
        </select>
      </div>

      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
        Drag to orbit / Scroll to zoom
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────

export function App() {
  const [adaptive, setAdaptive] = useState(true);
  const [shaderTier, setShaderTier] = useState<"low" | "medium" | "high">("medium");
  const [showSphere, setShowSphere] = useState(true);
  const [smartPrompt, setSmartPrompt] = useState("floating island");

  const handleReady = useCallback((engine: Engine) => {
    console.log(`[3D Engine] Ready — backend: ${engine.backend}`);
  }, []);

  const handleGenerate = useCallback(
    async (prompt: string) => aiGenerator.generate(prompt),
    [],
  );

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <EngineProvider
        adaptive={adaptive}
        targetFPS={60}
        shaderTier={shaderTier}
        onReady={handleReady}
      >
        <Scene>
          {/* Ground plane */}
          <MeshComponent
            geometry="plane"
            material={{ baseColor: [0.15, 0.2, 0.12, 1.0], roughness: 0.95 }}
            position={[0, -0.5, 0]}
            scale={[10, 1, 10]}
            name="ground"
          />

          {/* Rotating metallic box */}
          <RotatingBox />

          {/* Sphere (toggleable) */}
          {showSphere && (
            <MeshComponent
              geometry="sphere"
              material={{ baseColor: [1.0, 0.3, 0.2, 1.0], roughness: 0.15, metallic: 1.0 }}
              position={[2, 0.5, 0]}
              name="sphere"
              importance="high"
              lod
            />
          )}

          {/* Static box */}
          <MeshComponent
            geometry="box"
            material={{ baseColor: [0.9, 0.8, 0.2, 1.0], roughness: 0.6 }}
            position={[0, 0.5, -2]}
            scale={[0.7, 0.7, 0.7]}
            name="yellow-box"
          />

          {/* AI-generated mesh */}
          <SmartMesh
            prompt={smartPrompt}
            position={[0, 0.5, 2]}
            importance="high"
            budget="8ms"
            onGenerate={handleGenerate}
            material={{ baseColor: [0.5, 0.7, 0.9, 1.0], roughness: 0.4, metallic: 0.3 }}
          />

          {/* Camera controls */}
          <CameraController radius={6} rotateSpeed={0.005} zoomSpeed={0.5} />

          {/* Performance stats */}
          <PerformanceOverlay position="top-right" detailed />
        </Scene>
      </EngineProvider>

      <ControlPanel
        adaptive={adaptive}
        setAdaptive={setAdaptive}
        shaderTier={shaderTier}
        setShaderTier={setShaderTier}
        showSphere={showSphere}
        setShowSphere={setShowSphere}
        smartPrompt={smartPrompt}
        setSmartPrompt={setSmartPrompt}
      />
    </div>
  );
}
