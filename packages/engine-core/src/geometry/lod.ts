/**
 * LOD (Level of Detail) manager — generates simplified geometry levels
 * and selects appropriate LOD based on distance and performance budget.
 */

import type { GeometryData } from "./buffer";
import type { Vec3 } from "../scene/transform";
import { vec3Distance } from "../scene/transform";

export interface LODLevel {
  distance: number;       // Maximum distance this LOD is used
  geometryData: GeometryData;
  triangleReduction: number; // 0-1, percentage of triangles removed
}

export interface LODConfig {
  levels: number;
  distances: number[];       // Threshold distances for each level
  reductionFactors: number[]; // How much to simplify at each level (0-1)
}

export const DEFAULT_LOD_CONFIG: LODConfig = {
  levels: 3,
  distances: [10, 30, 100],
  reductionFactors: [0, 0.5, 0.8],
};

/**
 * Generate simplified geometry by reducing triangles.
 * Uses a vertex-decimation approach (simplified for performance).
 */
export function generateSimplifiedGeometry(
  data: GeometryData,
  reductionFactor: number,
): GeometryData {
  if (reductionFactor <= 0) return data;

  const targetTriCount = Math.max(
    4,
    Math.floor((data.indexCount / 3) * (1 - reductionFactor)),
  );
  const targetIndexCount = targetTriCount * 3;

  if (targetIndexCount >= data.indexCount) return data;

  // Simple decimation: skip every N-th triangle
  const stride = Math.ceil(data.indexCount / targetIndexCount);
  const newIndices: number[] = [];

  for (let i = 0; i < data.indexCount; i += 3) {
    if (newIndices.length >= targetIndexCount) break;
    if ((i / 3) % stride === 0) {
      newIndices.push(data.indices[i], data.indices[i + 1], data.indices[i + 2]);
    }
  }

  // Remap vertices — collect only used vertices
  const usedVertices = new Set(newIndices);
  const vertexMap = new Map<number, number>();
  let newIndex = 0;
  for (const v of usedVertices) {
    vertexMap.set(v, newIndex++);
  }

  const floatsPerVertex = data.layout.stride / 4;
  const newVertices = new Float32Array(vertexMap.size * floatsPerVertex);
  for (const [oldIdx, newIdx] of vertexMap) {
    const srcOffset = oldIdx * floatsPerVertex;
    const dstOffset = newIdx * floatsPerVertex;
    for (let k = 0; k < floatsPerVertex; k++) {
      newVertices[dstOffset + k] = data.vertices[srcOffset + k];
    }
  }

  const remappedIndices = new Uint32Array(
    newIndices.map((idx) => vertexMap.get(idx)!),
  );

  return {
    vertices: newVertices,
    indices: remappedIndices,
    vertexCount: vertexMap.size,
    indexCount: remappedIndices.length,
    layout: data.layout,
  };
}

/**
 * Generate all LOD levels for a base geometry.
 */
export function generateLODLevels(
  baseGeometry: GeometryData,
  config: LODConfig = DEFAULT_LOD_CONFIG,
): GeometryData[] {
  return config.reductionFactors.map((factor) =>
    generateSimplifiedGeometry(baseGeometry, factor),
  );
}

/**
 * Select the appropriate LOD level based on distance from camera.
 */
export function selectLODLevel(
  objectPosition: Vec3,
  cameraPosition: Vec3,
  config: LODConfig = DEFAULT_LOD_CONFIG,
): number {
  const distance = vec3Distance(objectPosition, cameraPosition);

  for (let i = 0; i < config.distances.length; i++) {
    if (distance < config.distances[i]) {
      return i;
    }
  }

  return config.levels - 1;
}
