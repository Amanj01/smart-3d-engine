/**
 * AI Mesh Generator — converts text prompts to 3D geometry.
 *
 * This module provides the interface and built-in procedural generators.
 * For production use, connect to an external AI model API (e.g., OpenAI Shap-E,
 * Point-E, or a custom mesh generation endpoint).
 */

// ── Types ───────────────────────────────────────────────────────

export interface GeneratedMesh {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export interface GeneratorConfig {
  /** External API endpoint for AI mesh generation */
  apiEndpoint?: string;

  /** API key for authentication */
  apiKey?: string;

  /** Maximum polygon count for generated meshes */
  maxPolygons?: number;

  /** Quality preset */
  quality?: "draft" | "standard" | "high";

  /** Timeout in ms */
  timeout?: number;
}

export interface MeshGenerator {
  generate(prompt: string): Promise<GeneratedMesh>;
  isAvailable(): boolean;
}

// ── Procedural generator (built-in, no API needed) ──────────────

/**
 * Hash a string to a deterministic number.
 */
function hashPrompt(prompt: string): number {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const chr = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Seeded pseudo-random number generator.
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Generate a procedural mesh based on prompt keywords.
 * This is a deterministic, offline generator — same prompt always produces same mesh.
 */
export function createProceduralGenerator(config?: GeneratorConfig): MeshGenerator {
  const maxPolys = config?.maxPolygons ?? 2000;

  return {
    isAvailable(): boolean {
      return true;
    },

    async generate(prompt: string): Promise<GeneratedMesh> {
      const hash = hashPrompt(prompt);
      const random = seededRandom(hash);
      const lower = prompt.toLowerCase();

      // Determine shape type from keywords
      if (lower.includes("sphere") || lower.includes("ball") || lower.includes("globe")) {
        return generateSphere(random, maxPolys);
      }
      if (lower.includes("cylinder") || lower.includes("pillar") || lower.includes("column")) {
        return generateCylinder(random, maxPolys);
      }
      if (lower.includes("torus") || lower.includes("ring") || lower.includes("donut")) {
        return generateTorus(random, maxPolys);
      }
      if (lower.includes("terrain") || lower.includes("landscape") || lower.includes("island")) {
        return generateTerrain(random, maxPolys);
      }
      if (lower.includes("tree") || lower.includes("plant")) {
        return generateTree(random, maxPolys);
      }
      if (lower.includes("rock") || lower.includes("stone") || lower.includes("boulder")) {
        return generateRock(random, maxPolys);
      }
      if (lower.includes("pyramid") || lower.includes("crystal")) {
        return generatePyramid(random);
      }

      // Default: generate a displaced sphere (organic shape)
      return generateOrganicShape(random, maxPolys);
    },
  };
}

// ── API-backed generator ────────────────────────────────────────

export function createAPIGenerator(config: GeneratorConfig): MeshGenerator {
  const { apiEndpoint, apiKey, timeout = 30000, quality = "standard" } = config;

  return {
    isAvailable(): boolean {
      return !!apiEndpoint;
    },

    async generate(prompt: string): Promise<GeneratedMesh> {
      if (!apiEndpoint) {
        throw new Error("API endpoint not configured");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ prompt, quality }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        return {
          positions: new Float32Array(data.positions),
          normals: new Float32Array(data.normals),
          uvs: new Float32Array(data.uvs),
          indices: new Uint32Array(data.indices),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ── Shape generators ────────────────────────────────────────────

function generateSphere(
  random: () => number,
  _maxPolys: number,
): GeneratedMesh {
  const segments = 24;
  const rings = 16;
  const radius = 0.5 + random() * 0.3;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;

      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);

      positions.push(nx * radius, ny * radius, nz * radius);
      normals.push(nx, ny, nz);
      uvs.push(u, v);
    }
  }

  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}

function generateCylinder(
  random: () => number,
  _maxPolys: number,
): GeneratedMesh {
  const segments = 24;
  const heightSegments = 8;
  const radius = 0.3 + random() * 0.2;
  const height = 1.0 + random() * 0.5;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= heightSegments; y++) {
    const v = y / heightSegments;
    const py = v * height - height / 2;
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      const nx = Math.cos(theta);
      const nz = Math.sin(theta);
      positions.push(nx * radius, py, nz * radius);
      normals.push(nx, 0, nz);
      uvs.push(u, v);
    }
  }

  for (let y = 0; y < heightSegments; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}

function generateTorus(
  random: () => number,
  _maxPolys: number,
): GeneratedMesh {
  const majorR = 0.4 + random() * 0.2;
  const minorR = 0.1 + random() * 0.1;
  const majorSeg = 32;
  const minorSeg = 16;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= majorSeg; j++) {
    const u = j / majorSeg;
    const theta = u * Math.PI * 2;
    for (let i = 0; i <= minorSeg; i++) {
      const v = i / minorSeg;
      const phi = v * Math.PI * 2;

      const x = (majorR + minorR * Math.cos(phi)) * Math.cos(theta);
      const y = minorR * Math.sin(phi);
      const z = (majorR + minorR * Math.cos(phi)) * Math.sin(theta);

      const nx = Math.cos(phi) * Math.cos(theta);
      const ny = Math.sin(phi);
      const nz = Math.cos(phi) * Math.sin(theta);

      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      uvs.push(u, v);
    }
  }

  for (let j = 0; j < majorSeg; j++) {
    for (let i = 0; i < minorSeg; i++) {
      const a = j * (minorSeg + 1) + i;
      const b = a + minorSeg + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}

function generateTerrain(
  random: () => number,
  _maxPolys: number,
): GeneratedMesh {
  const size = 4;
  const segments = 32;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Generate heightmap using layered noise
  const heights: number[][] = [];
  for (let y = 0; y <= segments; y++) {
    heights[y] = [];
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const v = y / segments;
      let h = 0;
      h += Math.sin(u * 4 + random() * 0.5) * 0.3;
      h += Math.cos(v * 3 + random() * 0.5) * 0.2;
      h += Math.sin((u + v) * 6) * 0.1;
      h += (random() - 0.5) * 0.1;
      heights[y][x] = h;
    }
  }

  for (let y = 0; y <= segments; y++) {
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const v = y / segments;
      positions.push(
        (u - 0.5) * size,
        heights[y][x],
        (v - 0.5) * size,
      );
      // Approximate normal from neighbors
      const hL = x > 0 ? heights[y][x - 1] : heights[y][x];
      const hR = x < segments ? heights[y][x + 1] : heights[y][x];
      const hD = y > 0 ? heights[y - 1][x] : heights[y][x];
      const hU = y < segments ? heights[y + 1][x] : heights[y][x];
      const nx = hL - hR;
      const nz = hD - hU;
      const len = Math.sqrt(nx * nx + 1 + nz * nz);
      normals.push(nx / len, 1 / len, nz / len);
      uvs.push(u, v);
    }
  }

  for (let y = 0; y < segments; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}

function generateTree(
  random: () => number,
  _maxPolys: number,
): GeneratedMesh {
  // Simple tree: cylinder trunk + sphere canopy
  const trunkR = 0.08;
  const trunkH = 0.6;
  const canopyR = 0.35 + random() * 0.15;
  const segments = 12;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Trunk
  for (let y = 0; y <= 4; y++) {
    const py = (y / 4) * trunkH;
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      positions.push(Math.cos(theta) * trunkR, py, Math.sin(theta) * trunkR);
      normals.push(Math.cos(theta), 0, Math.sin(theta));
      uvs.push(u, y / 4);
    }
  }

  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  // Canopy (sphere offset upward)
  const canopyOffset = positions.length / 3;
  const rings = 10;
  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      positions.push(
        nx * canopyR,
        ny * canopyR + trunkH + canopyR * 0.6,
        nz * canopyR,
      );
      normals.push(nx, ny, nz);
      uvs.push(u, v);
    }
  }

  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = canopyOffset + y * (segments + 1) + x;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}

function generateRock(
  random: () => number,
  _maxPolys: number,
): GeneratedMesh {
  // Displaced sphere for organic rock shape
  const segments = 16;
  const rings = 12;
  const baseRadius = 0.4;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;

      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);

      const displacement = baseRadius + (random() - 0.5) * 0.15;
      positions.push(nx * displacement, ny * displacement * 0.7, nz * displacement);
      normals.push(nx, ny, nz);
      uvs.push(u, v);
    }
  }

  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}

function generatePyramid(_random: () => number): GeneratedMesh {
  const h = 1.0;
  const base = 0.6;

  // prettier-ignore
  const positions = new Float32Array([
    // Front face
    0, h, 0,   -base, 0, base,   base, 0, base,
    // Right face
    0, h, 0,   base, 0, base,    base, 0, -base,
    // Back face
    0, h, 0,   base, 0, -base,   -base, 0, -base,
    // Left face
    0, h, 0,   -base, 0, -base,  -base, 0, base,
    // Bottom
    -base, 0, base,  -base, 0, -base,  base, 0, -base,
    base, 0, -base,   base, 0, base,   -base, 0, base,
  ]);

  // Compute normals for each face
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i + 3] - positions[i];
    const ay = positions[i + 4] - positions[i + 1];
    const az = positions[i + 5] - positions[i + 2];
    const bx = positions[i + 6] - positions[i];
    const by = positions[i + 7] - positions[i + 1];
    const bz = positions[i + 8] - positions[i + 2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    nx /= len; ny /= len; nz /= len;
    for (let j = 0; j < 3; j++) {
      normals[i + j * 3] = nx;
      normals[i + j * 3 + 1] = ny;
      normals[i + j * 3 + 2] = nz;
    }
  }

  const uvs = new Float32Array(positions.length / 3 * 2);
  for (let i = 0; i < uvs.length; i += 6) {
    uvs[i] = 0.5; uvs[i + 1] = 1;
    uvs[i + 2] = 0;  uvs[i + 3] = 0;
    uvs[i + 4] = 1;  uvs[i + 5] = 0;
  }

  const indexCount = positions.length / 3;
  const indices = new Uint32Array(indexCount);
  for (let i = 0; i < indexCount; i++) indices[i] = i;

  return { positions, normals, uvs, indices };
}

function generateOrganicShape(
  random: () => number,
  _maxPolys: number,
): GeneratedMesh {
  // Displaced sphere with multi-frequency noise for organic look
  const segments = 20;
  const rings = 14;
  const baseRadius = 0.4;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;

      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);

      // Multi-frequency displacement
      let displacement = baseRadius;
      displacement += Math.sin(phi * 3 + theta * 2) * 0.08;
      displacement += Math.sin(phi * 5 - theta * 3) * 0.04;
      displacement += (random() - 0.5) * 0.03;

      positions.push(nx * displacement, ny * displacement, nz * displacement);
      normals.push(nx, ny, nz);
      uvs.push(u, v);
    }
  }

  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}
