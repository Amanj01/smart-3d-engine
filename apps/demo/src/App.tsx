import { useState, useCallback } from "react";
import {
  EngineProvider,
  Scene,
  MeshComponent,
  SmartMesh,
  CameraController,
  PerformanceOverlay,
  useFrame,
} from "@3d-engine/react";
import { createProceduralGenerator } from "@3d-engine/ai";
import type { Engine } from "@3d-engine/core";

// ── AI Generator ────────────────────────────────────────────────

const aiGenerator = createProceduralGenerator({ maxPolygons: 3000 });

// ── Helper: Y-axis rotation to quaternion ───────────────────────

function yRotation(angle: number): [number, number, number, number] {
  const h = angle / 2;
  return [0, Math.sin(h), 0, Math.cos(h)];
}

function xzRotation(xAngle: number, yAngle: number): [number, number, number, number] {
  // Combined XY rotation via quaternion multiplication
  const hx = xAngle / 2;
  const hy = yAngle / 2;
  const sx = Math.sin(hx), cx = Math.cos(hx);
  const sy = Math.sin(hy), cy = Math.cos(hy);
  return [
    sx * cy,
    cx * sy,
    -sx * sy,
    cx * cy,
  ];
}

// ── Animated floating & spinning showcase piece ─────────────────

function FloatingGem() {
  const [time, setTime] = useState(0);

  useFrame((_eng, dt) => {
    setTime((t) => t + dt * 0.001);
  });

  const bobY = 1.8 + Math.sin(time * 1.2) * 0.3;
  const spin = xzRotation(time * 0.7, time * 1.1);

  return (
    <MeshComponent
      geometry="box"
      material={{
        baseColor: [0.3, 0.85, 1.0, 1.0],
        roughness: 0.05,
        metallic: 1.0,
        emissive: [0.05, 0.15, 0.25],
      }}
      position={[0, bobY, 0]}
      rotation={spin}
      scale={[0.55, 0.55, 0.55]}
      name="floating-gem"
      importance="high"
      lod
    />
  );
}

// ── Orbiting sphere ─────────────────────────────────────────────

function OrbitingSphere({ radius, speed, yOffset, color }: {
  radius: number;
  speed: number;
  yOffset: number;
  color: [number, number, number, number];
}) {
  const [angle, setAngle] = useState(Math.random() * Math.PI * 2);

  useFrame((_eng, dt) => {
    setAngle((a) => a + dt * 0.001 * speed);
  });

  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  return (
    <MeshComponent
      geometry="sphere"
      material={{ baseColor: color, roughness: 0.2, metallic: 0.9 }}
      position={[x, yOffset, z]}
      scale={[0.25, 0.25, 0.25]}
      name={`orbit-sphere-${color[0].toFixed(1)}`}
    />
  );
}

// ── Slow-rotating pedestal ──────────────────────────────────────

function RotatingPedestal() {
  const [angle, setAngle] = useState(0);

  useFrame((_eng, dt) => {
    setAngle((a) => a + dt * 0.0003);
  });

  return (
    <MeshComponent
      geometry="box"
      material={{
        baseColor: [0.25, 0.22, 0.3, 1.0],
        roughness: 0.7,
        metallic: 0.1,
      }}
      position={[0, -0.15, 0]}
      rotation={yRotation(angle)}
      scale={[1.8, 0.3, 1.8]}
      name="pedestal"
    />
  );
}

// ── Control panel ───────────────────────────────────────────────

function ControlPanel({
  adaptive,
  setAdaptive,
  shaderTier,
  setShaderTier,
  showPillars,
  setShowPillars,
  smartPrompt,
  setSmartPrompt,
}: {
  adaptive: boolean;
  setAdaptive: (v: boolean) => void;
  shaderTier: "low" | "medium" | "high";
  setShaderTier: (v: "low" | "medium" | "high") => void;
  showPillars: boolean;
  setShowPillars: (v: boolean) => void;
  smartPrompt: string;
  setSmartPrompt: (v: string) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        background: "linear-gradient(135deg, rgba(15,15,25,0.92), rgba(10,10,20,0.95))",
        color: "#dde",
        padding: "18px 22px",
        borderRadius: 12,
        fontSize: 13,
        lineHeight: 2,
        zIndex: 10000,
        minWidth: 280,
        border: "1px solid rgba(100,120,255,0.15)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "#8af" }}>
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

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#999" }}>Shader:</span>
        {(["low", "medium", "high"] as const).map((tier) => (
          <button
            key={tier}
            onClick={() => setShaderTier(tier)}
            style={{
              padding: "3px 12px",
              border: shaderTier === tier ? "1px solid #6af" : "1px solid #333",
              borderRadius: 6,
              background: shaderTier === tier
                ? "linear-gradient(135deg, #1a3a6a, #0d2040)"
                : "#181820",
              color: shaderTier === tier ? "#8cf" : "#888",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: shaderTier === tier ? 600 : 400,
              transition: "all 0.15s",
            }}
          >
            {tier}
          </button>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={showPillars}
          onChange={(e) => setShowPillars(e.target.checked)}
        />
        Corner Pillars
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#999" }}>AI Mesh:</span>
        <select
          value={smartPrompt}
          onChange={(e) => setSmartPrompt(e.target.value)}
          style={{
            padding: "3px 10px",
            background: "#181820",
            color: "#ccd",
            border: "1px solid #333",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          <option value="torus ring">Torus Ring</option>
          <option value="crystal pyramid">Crystal Pyramid</option>
          <option value="floating island">Floating Island</option>
          <option value="ancient rock">Ancient Rock</option>
          <option value="organic blob">Organic Shape</option>
          <option value="tree plant">Tree</option>
        </select>
      </div>

      <div style={{ fontSize: 11, color: "#556", marginTop: 6 }}>
        Drag to orbit &middot; Scroll to zoom
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────

export function App() {
  const [adaptive, setAdaptive] = useState(true);
  const [shaderTier, setShaderTier] = useState<"low" | "medium" | "high">("high");
  const [showPillars, setShowPillars] = useState(true);
  const [smartPrompt, setSmartPrompt] = useState("torus ring");

  const handleReady = useCallback((engine: Engine) => {
    console.log(`[3D Engine] Ready | backend: ${engine.backend}`);
  }, []);

  const handleGenerate = useCallback(
    async (prompt: string) => aiGenerator.generate(prompt),
    [],
  );

  // Pillar positions in a circle
  const pillarCount = 6;
  const pillarRadius = 3.5;

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <EngineProvider
        adaptive={adaptive}
        targetFPS={60}
        shaderTier={shaderTier}
        onReady={handleReady}
      >
        <Scene>
          {/* ── Ground ── */}
          <MeshComponent
            geometry="plane"
            material={{ baseColor: [0.08, 0.09, 0.12, 1.0], roughness: 0.9, metallic: 0.1 }}
            position={[0, -0.5, 0]}
            scale={[16, 1, 16]}
            name="ground"
          />

          {/* ── Central pedestal (slow rotation) ── */}
          <RotatingPedestal />

          {/* ── Floating gem — the hero piece ── */}
          <FloatingGem />

          {/* ── Orbiting spheres around the center ── */}
          <OrbitingSphere radius={2} speed={0.8} yOffset={1.0} color={[1.0, 0.35, 0.2, 1.0]} />
          <OrbitingSphere radius={2.4} speed={-0.6} yOffset={1.5} color={[0.2, 1.0, 0.5, 1.0]} />
          <OrbitingSphere radius={1.6} speed={1.2} yOffset={2.1} color={[1.0, 0.85, 0.15, 1.0]} />

          {/* ── Large accent sphere — glass-like ── */}
          <MeshComponent
            geometry="sphere"
            material={{
              baseColor: [0.85, 0.9, 1.0, 0.6],
              roughness: 0.02,
              metallic: 0.0,
              opacity: 0.6,
            }}
            position={[-3, 0.6, -2]}
            scale={[1.2, 1.2, 1.2]}
            name="glass-sphere"
            importance="medium"
            lod
          />

          {/* ── Warm metallic sphere ── */}
          <MeshComponent
            geometry="sphere"
            material={{
              baseColor: [0.85, 0.55, 0.2, 1.0],
              roughness: 0.1,
              metallic: 1.0,
            }}
            position={[3.2, 0.3, -1.5]}
            scale={[0.8, 0.8, 0.8]}
            name="gold-sphere"
            importance="high"
            lod
          />

          {/* ── Pillars arranged in a circle ── */}
          {showPillars &&
            Array.from({ length: pillarCount }).map((_, i) => {
              const angle = (i / pillarCount) * Math.PI * 2;
              const x = Math.cos(angle) * pillarRadius;
              const z = Math.sin(angle) * pillarRadius;
              const height = 0.8 + Math.sin(i * 1.5) * 0.4;
              const hue = i / pillarCount;
              // HSL-ish color from index
              const r = 0.3 + 0.4 * Math.sin(hue * Math.PI * 2);
              const g = 0.3 + 0.4 * Math.sin(hue * Math.PI * 2 + 2.1);
              const b = 0.3 + 0.4 * Math.sin(hue * Math.PI * 2 + 4.2);

              return (
                <MeshComponent
                  key={i}
                  geometry="box"
                  material={{
                    baseColor: [r, g, b, 1.0] as [number, number, number, number],
                    roughness: 0.35,
                    metallic: 0.6,
                  }}
                  position={[x, height / 2 - 0.5, z]}
                  scale={[0.3, height, 0.3]}
                  name={`pillar-${i}`}
                />
              );
            })}

          {/* ── AI-generated mesh — front and center ── */}
          <SmartMesh
            prompt={smartPrompt}
            position={[0, 0.6, 3]}
            scale={[1.5, 1.5, 1.5]}
            importance="high"
            budget="8ms"
            onGenerate={handleGenerate}
            material={{
              baseColor: [0.55, 0.45, 0.85, 1.0],
              roughness: 0.3,
              metallic: 0.5,
            }}
          />

          {/* ── Scattered small accent boxes ── */}
          <MeshComponent
            geometry="box"
            material={{ baseColor: [0.9, 0.2, 0.35, 1.0], roughness: 0.2, metallic: 0.9 }}
            position={[-1.5, -0.2, 2.5]}
            rotation={xzRotation(0.4, 0.7)}
            scale={[0.35, 0.35, 0.35]}
            name="accent-1"
          />
          <MeshComponent
            geometry="box"
            material={{ baseColor: [0.2, 0.9, 0.6, 1.0], roughness: 0.25, metallic: 0.85 }}
            position={[2, -0.3, 3]}
            rotation={xzRotation(-0.3, 1.2)}
            scale={[0.25, 0.25, 0.25]}
            name="accent-2"
          />
          <MeshComponent
            geometry="box"
            material={{ baseColor: [1.0, 0.65, 0.1, 1.0], roughness: 0.15, metallic: 0.95 }}
            position={[1.8, -0.35, -3]}
            rotation={xzRotation(0.8, -0.5)}
            scale={[0.2, 0.4, 0.2]}
            name="accent-3"
          />

          {/* ── Camera ── */}
          <CameraController radius={7} rotateSpeed={0.004} zoomSpeed={0.4} />

          {/* ── Stats ── */}
          <PerformanceOverlay position="top-right" detailed />
        </Scene>
      </EngineProvider>

      {/* ── Title ── */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 20,
          color: "#fff",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 1,
          opacity: 0.7,
          pointerEvents: "none",
          textShadow: "0 2px 12px rgba(0,0,0,0.6)",
        }}
      >
        3D Engine
        <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8, opacity: 0.5 }}>
          WebGPU / WebGL
        </span>
      </div>

      <ControlPanel
        adaptive={adaptive}
        setAdaptive={setAdaptive}
        shaderTier={shaderTier}
        setShaderTier={setShaderTier}
        showPillars={showPillars}
        setShowPillars={setShowPillars}
        smartPrompt={smartPrompt}
        setSmartPrompt={setSmartPrompt}
      />
    </div>
  );
}
