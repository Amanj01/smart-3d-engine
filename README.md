# 3D Engine

A production-ready, AI-native 3D rendering engine for React and Next.js. WebGPU-first with automatic WebGL2 fallback, declarative React components, AI-powered mesh generation, and real-time adaptive quality control.

## Quick Start

```bash
# Install packages
npm install @3d-engine/core @3d-engine/react @3d-engine/ai
```

```tsx
import { EngineProvider, Scene, MeshComponent, CameraController } from "@3d-engine/react";

function App() {
  return (
    <EngineProvider adaptive targetFPS={60} shaderTier="high">
      <Scene>
        <MeshComponent
          geometry="box"
          material={{ baseColor: [0.8, 0.2, 0.3, 1.0], roughness: 0.3, metallic: 0.8 }}
          position={[0, 0.5, 0]}
        />
        <MeshComponent
          geometry="plane"
          material={{ baseColor: [0.2, 0.2, 0.25, 1.0], roughness: 0.9 }}
          position={[0, 0, 0]}
          scale={[10, 1, 10]}
        />
        <CameraController radius={5} />
      </Scene>
    </EngineProvider>
  );
}
```

---

## Run the Demo

The repo includes a full showcase demo inside `apps/demo`.

```bash
# Clone and install
git clone <repo-url>
cd 3d-engine
pnpm install

# Build all packages
pnpm build

# Start the demo
pnpm --filter demo dev
```

Open `http://localhost:5173` — you'll see:

- A floating, spinning gem on a rotating pedestal
- Three orbiting spheres at different speeds and colors
- A glass-like transparent sphere and a gold metallic sphere
- Six colored pillars arranged in a circle
- An AI-generated mesh (switchable: torus, crystal, island, rock, blob, tree)
- Real-time performance stats overlay
- Interactive camera (drag to orbit, scroll to zoom)
- Control panel to toggle adaptive quality, shader tier, pillars, and AI mesh type

---

## Packages

| Package | Description |
|---|---|
| `@3d-engine/core` | Rendering engine, scene graph, geometry, materials, camera, lighting, performance monitoring |
| `@3d-engine/react` | Declarative React components and hooks |
| `@3d-engine/ai` | AI-powered procedural mesh generation and scene optimization |

---

## Integration Guide

### React Project

```tsx
import { EngineProvider, Scene, MeshComponent, CameraController, PerformanceOverlay } from "@3d-engine/react";

function My3DScene() {
  return (
    <div style={{ width: "100%", height: "500px" }}>
      <EngineProvider adaptive targetFPS={60} shaderTier="high">
        <Scene>
          <MeshComponent
            geometry="sphere"
            material={{ baseColor: [0.1, 0.6, 0.9, 1.0], roughness: 0.2, metallic: 0.9 }}
            position={[0, 1, 0]}
            name="my-sphere"
            importance="high"
            lod
          />
          <CameraController radius={6} rotateSpeed={0.004} zoomSpeed={0.4} />
          <PerformanceOverlay position="top-right" detailed />
        </Scene>
      </EngineProvider>
    </div>
  );
}
```

### Adding Animation

```tsx
import { useFrame } from "@3d-engine/react";
import { useState } from "react";

function SpinningBox() {
  const [angle, setAngle] = useState(0);

  useFrame((_engine, dt) => {
    setAngle((a) => a + dt * 0.001);
  });

  // Y-axis rotation as quaternion
  const h = angle / 2;
  const rotation: [number, number, number, number] = [0, Math.sin(h), 0, Math.cos(h)];

  return (
    <MeshComponent
      geometry="box"
      material={{ baseColor: [1, 0.5, 0.2, 1], roughness: 0.3, metallic: 0.7 }}
      position={[0, 0.5, 0]}
      rotation={rotation}
      name="spinner"
    />
  );
}
```

### AI-Generated Meshes

```tsx
import { SmartMesh } from "@3d-engine/react";
import { createProceduralGenerator } from "@3d-engine/ai";

const generator = createProceduralGenerator({ maxPolygons: 3000 });

function AIScene() {
  return (
    <SmartMesh
      prompt="crystal pyramid"
      position={[0, 1, 0]}
      scale={[1.5, 1.5, 1.5]}
      importance="high"
      budget="8ms"
      onGenerate={(prompt) => generator.generate(prompt)}
      material={{ baseColor: [0.6, 0.4, 0.9, 1.0], roughness: 0.3, metallic: 0.5 }}
    />
  );
}
```

### Scene Optimization

```tsx
import { createMeshOptimizer } from "@3d-engine/ai";

const optimizer = createMeshOptimizer({ targetBudgetMs: 16 });

// Analyze scene for optimization opportunities
const recommendations = optimizer.analyze(engine);

// Auto-optimize: simplifies meshes, adjusts LOD, culls distant objects
optimizer.autoOptimize(engine);
```

### Using the Core Engine Directly

```typescript
import { createEngine, createBoxMesh, createMesh, createMaterial, MATERIALS, LIGHTS } from "@3d-engine/core";

const engine = await createEngine({
  canvas: document.getElementById("canvas") as HTMLCanvasElement,
  adaptive: true,
  targetFPS: 60,
  shaderTier: "high",
});

// Add a mesh to the scene
const node = engine.scene.addNode({
  name: "my-box",
  mesh: createMesh(createBoxMesh(1, 1, 1)),
  material: MATERIALS.metal(),
  position: [0, 0.5, 0],
  importance: "high",
});

// Add lighting
engine.addLight(LIGHTS.sun());
engine.addLight(LIGHTS.ambient(0.3));

// Start the render loop
engine.start();
```

---

## API Reference

### React Components

#### `<EngineProvider>`

Root component that initializes the rendering engine and provides context to child components.

| Prop | Type | Default | Description |
|---|---|---|---|
| `backend` | `"webgpu" \| "webgl"` | Auto-detected | Preferred rendering backend |
| `adaptive` | `boolean` | `false` | Enable adaptive quality control |
| `targetFPS` | `number` | `60` | Target frame rate for adaptive controller |
| `shaderTier` | `"low" \| "medium" \| "high"` | `"high"` | Shader quality tier |
| `width` | `number \| string` | `"100%"` | Canvas width |
| `height` | `number \| string` | `"100%"` | Canvas height |
| `style` | `CSSProperties` | — | Container style |
| `className` | `string` | — | Container class |
| `onReady` | `(engine: Engine) => void` | — | Called when engine is initialized |
| `onFrame` | `(engine: Engine, dt: number) => void` | — | Called every frame |
| `onPerformance` | `(snapshot: PerformanceSnapshot) => void` | — | Performance stats callback |

#### `<Scene>`

Provides a scene graph context. Must be inside `<EngineProvider>`.

#### `<MeshComponent>`

Renders a 3D mesh. Must be inside `<Scene>`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `geometry` | `"box" \| "sphere" \| "plane" \| MeshOptions` | — | Geometry type or custom mesh data |
| `material` | `MaterialOptions` | Default gray | PBR material properties |
| `position` | `[x, y, z]` | `[0, 0, 0]` | World position |
| `rotation` | `[x, y, z, w]` | `[0, 0, 0, 1]` | Quaternion rotation |
| `scale` | `[x, y, z]` | `[1, 1, 1]` | Scale factor |
| `name` | `string` | — | Node name for lookups |
| `visible` | `boolean` | `true` | Visibility toggle |
| `importance` | `"low" \| "medium" \| "high"` | `"medium"` | Priority for adaptive quality |
| `budget` | `number` | — | GPU time budget in ms |
| `lod` | `boolean` | `false` | Enable automatic LOD generation |

#### `<SmartMesh>`

AI-powered mesh that generates geometry from a text prompt.

| Prop | Type | Default | Description |
|---|---|---|---|
| `prompt` | `string` | — | Text description of desired shape |
| `material` | `MaterialOptions` | — | PBR material properties |
| `position` | `[x, y, z]` | `[0, 0, 0]` | World position |
| `rotation` | `[x, y, z, w]` | `[0, 0, 0, 1]` | Quaternion rotation |
| `scale` | `[x, y, z]` | `[1, 1, 1]` | Scale factor |
| `importance` | `"low" \| "medium" \| "high"` | `"medium"` | Adaptive quality priority |
| `budget` | `string` | — | GPU time budget (e.g. `"8ms"`) |
| `onGenerate` | `(prompt: string) => Promise<GeneratedMesh>` | — | Generator function |

#### `<CameraController>`

Interactive orbit camera with mouse/touch controls.

| Prop | Type | Default | Description |
|---|---|---|---|
| `radius` | `number` | `5` | Orbit distance |
| `rotateSpeed` | `number` | `0.004` | Mouse rotation sensitivity |
| `zoomSpeed` | `number` | `0.4` | Scroll zoom sensitivity |
| `enabled` | `boolean` | `true` | Enable/disable controls |

#### `<PerformanceOverlay>`

Real-time stats display showing FPS, frame time, draw calls, and more.

| Prop | Type | Default | Description |
|---|---|---|---|
| `position` | `"top-left" \| "top-right" \| "bottom-left" \| "bottom-right"` | `"top-right"` | Screen position |
| `detailed` | `boolean` | `false` | Show extended stats |
| `style` | `CSSProperties` | — | Custom styling |

### Hooks

```tsx
// Get the engine instance (must be inside EngineProvider)
const engine = useEngine();

// Get engine context with ready state
const { engine, isReady } = useEngineContext();

// Run code every frame
useFrame((engine, deltaTimeMs) => {
  // Animation logic here
});

// Get live performance data
const perf = usePerformance();
// perf.fps, perf.frameTimeMs, perf.drawCalls, perf.triangleCount, ...

// Look up a scene node by name
const node = useSceneNode("my-mesh");

// Get resize handler
const resize = useResize();
```

### Material Properties

```typescript
interface MaterialOptions {
  baseColor?: [r, g, b, a];  // RGBA, 0–1
  roughness?: number;         // 0 = mirror, 1 = matte
  metallic?: number;          // 0 = plastic, 1 = metal
  emissive?: [r, g, b];      // Self-illumination color
  opacity?: number;           // 0 = invisible, 1 = opaque
  doubleSided?: boolean;      // Render both faces
}
```

**Built-in presets** (from `@3d-engine/core`):

```typescript
import { MATERIALS } from "@3d-engine/core";

MATERIALS.metal()                          // Shiny metallic surface
MATERIALS.plastic()                        // Smooth plastic
MATERIALS.wood()                           // Rough wooden surface
MATERIALS.glass()                          // Transparent glass-like
MATERIALS.emissive([0.2, 0.5, 1.0])       // Glowing material
```

### Light Presets

```typescript
import { LIGHTS } from "@3d-engine/core";

LIGHTS.sun()                   // Bright directional sunlight
LIGHTS.moonlight()             // Dim blue-tinted directional
LIGHTS.pointWarm([2, 3, 0])   // Warm point light at position
LIGHTS.ambient(0.3)            // Ambient fill light
```

### AI Generators

```typescript
import { createProceduralGenerator, createAPIGenerator } from "@3d-engine/ai";

// Offline procedural generator — no API needed
const procedural = createProceduralGenerator({ maxPolygons: 3000 });
const mesh = await procedural.generate("torus ring");
// Supported keywords: sphere, ball, cylinder, pillar, torus, ring,
// terrain, landscape, tree, plant, rock, stone, pyramid, crystal, organic, blob

// API-backed generator — connects to an external AI service
const apiGen = createAPIGenerator({
  apiEndpoint: "https://your-mesh-api.com/generate",
  apiKey: "your-key",
  maxPolygons: 5000,
  quality: "high",
  timeout: 30000,
});
const aiMesh = await apiGen.generate("detailed medieval castle");
```

### Shader Tiers

The engine supports three shader quality levels that can be set globally or adjusted automatically by the adaptive controller:

| Tier | Description |
|---|---|
| `"low"` | Flat color only — fastest, lowest quality |
| `"medium"` | Diffuse lighting — good balance |
| `"high"` | Full PBR with specular highlights and Fresnel — best quality |

---

## Adaptive Quality System

When `adaptive={true}` is set on `<EngineProvider>`, the engine automatically adjusts rendering quality to maintain the target frame rate. The system downgrades in this priority order:

1. Shadow map resolution
2. LOD bias (push objects to lower detail)
3. Shader tier (high → medium → low)
4. Particle multiplier

Upgrades happen in reverse order. Hysteresis prevents flickering — the system waits 30 frames before downgrading and 60 frames before upgrading.

---

## Architecture

```
@3d-engine/core
├── renderer/     WebGPU + WebGL2 context, shaders, render pipeline
├── scene/        Scene graph, transform math (Mat4, Vec3, Quat)
├── geometry/     Mesh creation, vertex buffers, LOD generation
├── materials/    PBR materials with presets
├── camera/       Camera + orbit controller
├── lighting/     Directional, point, and ambient lights
├── performance/  FPS monitor + adaptive quality controller
└── engine.ts     Main orchestrator tying everything together

@3d-engine/react
├── context.ts              Engine React context
├── hooks.ts                useFrame, usePerformance, useSceneNode, useResize
└── components/
    ├── EngineProvider.tsx   Root provider — creates canvas + engine
    ├── Scene.tsx            Scene graph context
    ├── MeshComponent.tsx    Declarative mesh rendering
    ├── SmartMesh.tsx        AI-powered mesh from text prompts
    ├── CameraController.tsx Orbit camera controls
    └── PerformanceOverlay.tsx Real-time stats HUD

@3d-engine/ai
├── generator.ts   Procedural + API mesh generators
└── optimizer.ts   Scene analysis + automatic optimization
```

---

## Project Structure

```
3d-engine/
├── packages/
│   ├── engine-core/       @3d-engine/core
│   ├── engine-react/      @3d-engine/react
│   └── engine-ai/         @3d-engine/ai
├── apps/
│   └── demo/              Vite + React showcase app
├── package.json           Monorepo root (pnpm + Turborepo)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the demo
pnpm --filter demo dev

# Build a specific package
pnpm --filter @3d-engine/core build
```

## Build Output

Each package produces:

- `dist/index.mjs` — ESM module
- `dist/index.js` — CommonJS module
- `dist/index.d.ts` — TypeScript declarations
- Source maps included

## Browser Support

| Browser | Backend |
|---|---|
| Chrome 113+ | WebGPU (preferred) |
| Edge 113+ | WebGPU (preferred) |
| Firefox | WebGL2 fallback |
| Safari 18+ | WebGPU (preferred) |
| Older browsers | WebGL2 fallback |

The engine automatically detects the best available backend at runtime.

## License

MIT
