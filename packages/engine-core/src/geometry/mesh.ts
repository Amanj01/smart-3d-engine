/**
 * Mesh — geometry container with LOD support and GPU buffer handles.
 */

import type { GeometryData } from "./buffer";
import {
  interleaveVertexData,
  STANDARD_VERTEX_LAYOUT,
  createGPUBuffers,
  createGLBuffers,
} from "./buffer";
import type { RendererContext } from "../renderer/context";

export interface MeshOptions {
  name?: string;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export interface Mesh {
  readonly name: string;
  readonly geometryData: GeometryData;
  readonly indexCount: number;

  // GPU handles (set after upload)
  gpuVertexBuffer: GPUBuffer | null;
  gpuIndexBuffer: GPUBuffer | null;
  glVAO: WebGLVertexArrayObject | null;

  /** Current LOD level (0 = highest detail) */
  currentLOD: number;
  lodLevels: GeometryData[];

  uploadToGPU(ctx: RendererContext): void;
  setLOD(level: number, ctx: RendererContext): void;
  destroy(ctx: RendererContext): void;
}

export function createMesh(options: MeshOptions): Mesh {
  const vertices = interleaveVertexData(options.positions, options.normals, options.uvs);
  const geometryData: GeometryData = {
    vertices,
    indices: options.indices,
    vertexCount: options.positions.length / 3,
    indexCount: options.indices.length,
    layout: STANDARD_VERTEX_LAYOUT,
  };

  const mesh: Mesh = {
    name: options.name ?? "mesh",
    geometryData,
    indexCount: geometryData.indexCount,
    gpuVertexBuffer: null,
    gpuIndexBuffer: null,
    glVAO: null,
    currentLOD: 0,
    lodLevels: [geometryData],

    uploadToGPU(ctx: RendererContext): void {
      if (ctx.backend === "webgpu" && ctx.device) {
        const { vertexBuffer, indexBuffer } = createGPUBuffers(ctx.device, geometryData);
        mesh.gpuVertexBuffer = vertexBuffer;
        mesh.gpuIndexBuffer = indexBuffer;
      } else if (ctx.backend === "webgl" && ctx.gl) {
        mesh.glVAO = createGLBuffers(ctx.gl, geometryData);
      }
    },

    setLOD(level: number, ctx: RendererContext): void {
      const clamped = Math.min(level, mesh.lodLevels.length - 1);
      if (clamped === mesh.currentLOD) return;

      mesh.currentLOD = clamped;
      const lodData = mesh.lodLevels[clamped];

      // Re-upload with the LOD geometry
      if (ctx.backend === "webgpu" && ctx.device) {
        mesh.gpuVertexBuffer?.destroy();
        mesh.gpuIndexBuffer?.destroy();
        const { vertexBuffer, indexBuffer } = createGPUBuffers(ctx.device, lodData);
        mesh.gpuVertexBuffer = vertexBuffer;
        mesh.gpuIndexBuffer = indexBuffer;
      } else if (ctx.backend === "webgl" && ctx.gl) {
        if (mesh.glVAO) {
          ctx.gl.deleteVertexArray(mesh.glVAO);
        }
        mesh.glVAO = createGLBuffers(ctx.gl, lodData);
      }

      (mesh as { indexCount: number }).indexCount = lodData.indexCount;
    },

    destroy(ctx: RendererContext): void {
      mesh.gpuVertexBuffer?.destroy();
      mesh.gpuIndexBuffer?.destroy();
      if (ctx.backend === "webgl" && ctx.gl && mesh.glVAO) {
        ctx.gl.deleteVertexArray(mesh.glVAO);
      }
    },
  };

  return mesh;
}

// ── Primitive generators ────────────────────────────────────────

export function createBoxMesh(
  width = 1,
  height = 1,
  depth = 1,
): MeshOptions {
  const w = width / 2, h = height / 2, d = depth / 2;

  // prettier-ignore
  const positions = new Float32Array([
    // Front
    -w, -h,  d,  w, -h,  d,  w,  h,  d, -w,  h,  d,
    // Back
     w, -h, -d, -w, -h, -d, -w,  h, -d,  w,  h, -d,
    // Top
    -w,  h,  d,  w,  h,  d,  w,  h, -d, -w,  h, -d,
    // Bottom
    -w, -h, -d,  w, -h, -d,  w, -h,  d, -w, -h,  d,
    // Right
     w, -h,  d,  w, -h, -d,  w,  h, -d,  w,  h,  d,
    // Left
    -w, -h, -d, -w, -h,  d, -w,  h,  d, -w,  h, -d,
  ]);

  // prettier-ignore
  const normals = new Float32Array([
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
   -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);

  // prettier-ignore
  const uvs = new Float32Array([
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1,
  ]);

  // prettier-ignore
  const indices = new Uint32Array([
     0, 1, 2,  0, 2, 3,
     4, 5, 6,  4, 6, 7,
     8, 9,10,  8,10,11,
    12,13,14, 12,14,15,
    16,17,18, 16,18,19,
    20,21,22, 20,22,23,
  ]);

  return { name: "box", positions, normals, uvs, indices };
}

export function createSphereMesh(
  radius = 0.5,
  segments = 32,
  rings = 16,
): MeshOptions {
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
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    name: "sphere",
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}

export function createPlaneMesh(
  width = 1,
  height = 1,
  segW = 1,
  segH = 1,
): MeshOptions {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= segH; y++) {
    for (let x = 0; x <= segW; x++) {
      const u = x / segW;
      const v = y / segH;
      positions.push((u - 0.5) * width, 0, (v - 0.5) * height);
      normals.push(0, 1, 0);
      uvs.push(u, v);
    }
  }

  for (let y = 0; y < segH; y++) {
    for (let x = 0; x < segW; x++) {
      const a = y * (segW + 1) + x;
      const b = a + segW + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    name: "plane",
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}
