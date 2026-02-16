/**
 * Lightweight GLB (binary glTF 2.0) parser.
 *
 * Extracts positions, normals, UVs, and indices from the first mesh primitive
 * in a .glb file. This is intentionally minimal — it covers the subset of
 * glTF needed for Tripo3D / similar API outputs.
 */

import type { GeneratedMesh } from "./generator";

// ── glTF JSON types (subset) ────────────────────────────────────

interface GltfJson {
  meshes?: GltfMesh[];
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
}

interface GltfMesh {
  primitives: GltfPrimitive[];
}

interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
}

interface GltfAccessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}

// ── Component type sizes ────────────────────────────────────────

const COMPONENT_SIZES: Record<number, number> = {
  5120: 1, // int8
  5121: 1, // uint8
  5122: 2, // int16
  5123: 2, // uint16
  5125: 4, // uint32
  5126: 4, // float32
};

// ── Parser ──────────────────────────────────────────────────────

/**
 * Parse a GLB binary buffer and extract the first mesh primitive as a GeneratedMesh.
 */
export function parseGLB(buffer: ArrayBuffer): GeneratedMesh {
  const view = new DataView(buffer);

  // ── Header (12 bytes) ──
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) {
    throw new Error("Not a valid GLB file");
  }
  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`Unsupported glTF version: ${version}`);
  }

  // ── Chunk 0: JSON ──
  const chunk0Length = view.getUint32(12, true);
  const chunk0Type = view.getUint32(16, true);
  if (chunk0Type !== 0x4e4f534a) {
    throw new Error("First chunk is not JSON");
  }

  const jsonBytes = new Uint8Array(buffer, 20, chunk0Length);
  const jsonStr = new TextDecoder().decode(jsonBytes);
  const gltf: GltfJson = JSON.parse(jsonStr);

  // ── Chunk 1: Binary ──
  const chunk1Offset = 20 + chunk0Length;
  const chunk1Length = view.getUint32(chunk1Offset, true);
  const chunk1Type = view.getUint32(chunk1Offset + 4, true);
  if (chunk1Type !== 0x004e4942) {
    throw new Error("Second chunk is not BIN");
  }
  const binOffset = chunk1Offset + 8;
  const binBuffer = buffer.slice(binOffset, binOffset + chunk1Length);

  // ── Find first mesh primitive ──
  if (!gltf.meshes?.length) {
    throw new Error("GLB contains no meshes");
  }
  const primitive = gltf.meshes[0].primitives[0];
  if (!primitive) {
    throw new Error("Mesh has no primitives");
  }
  if (!gltf.accessors || !gltf.bufferViews) {
    throw new Error("GLB missing accessors or bufferViews");
  }

  // ── Read attributes ──
  const positions = readAccessorFloat32(
    gltf,
    binBuffer,
    primitive.attributes["POSITION"],
  );

  let normals: Float32Array;
  if (primitive.attributes["NORMAL"] !== undefined) {
    normals = readAccessorFloat32(
      gltf,
      binBuffer,
      primitive.attributes["NORMAL"],
    );
  } else {
    // Generate flat normals if missing
    normals = generateFlatNormals(positions);
  }

  let uvs: Float32Array;
  if (primitive.attributes["TEXCOORD_0"] !== undefined) {
    uvs = readAccessorFloat32(
      gltf,
      binBuffer,
      primitive.attributes["TEXCOORD_0"],
    );
  } else {
    // Generate zero UVs if missing
    uvs = new Float32Array((positions.length / 3) * 2);
  }

  // ── Read indices ──
  let indices: Uint32Array;
  if (primitive.indices !== undefined) {
    indices = readAccessorUint32(gltf, binBuffer, primitive.indices);
  } else {
    // Non-indexed: create sequential indices
    indices = new Uint32Array(positions.length / 3);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
  }

  return { positions, normals, uvs, indices };
}

// ── Accessor readers ────────────────────────────────────────────

function readAccessorFloat32(
  gltf: GltfJson,
  bin: ArrayBuffer,
  accessorIndex: number,
): Float32Array {
  const accessor = gltf.accessors![accessorIndex];
  const bufferView = gltf.bufferViews![accessor.bufferView];

  const byteOffset =
    (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const componentCount = typeToComponentCount(accessor.type);
  const totalFloats = accessor.count * componentCount;
  const stride = bufferView.byteStride ?? 0;

  // Always read via DataView to avoid alignment issues and handle strides
  const result = new Float32Array(totalFloats);
  const view = new DataView(bin);
  const compSize = COMPONENT_SIZES[accessor.componentType] ?? 4;
  const elementByteSize = componentCount * compSize;
  const actualStride = stride > 0 ? stride : elementByteSize;

  for (let elem = 0; elem < accessor.count; elem++) {
    const elemOffset = byteOffset + elem * actualStride;
    for (let c = 0; c < componentCount; c++) {
      const offset = elemOffset + c * compSize;
      const idx = elem * componentCount + c;
      switch (accessor.componentType) {
        case 5126:
          result[idx] = view.getFloat32(offset, true);
          break;
        case 5120:
          result[idx] = view.getInt8(offset);
          break;
        case 5121:
          result[idx] = view.getUint8(offset);
          break;
        case 5122:
          result[idx] = view.getInt16(offset, true);
          break;
        case 5123:
          result[idx] = view.getUint16(offset, true);
          break;
        default:
          result[idx] = view.getFloat32(offset, true);
      }
    }
  }

  return result;
}

function readAccessorUint32(
  gltf: GltfJson,
  bin: ArrayBuffer,
  accessorIndex: number,
): Uint32Array {
  const accessor = gltf.accessors![accessorIndex];
  const bufferView = gltf.bufferViews![accessor.bufferView];

  const byteOffset =
    (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const compSize = COMPONENT_SIZES[accessor.componentType] ?? 2;

  // Always read via DataView to avoid alignment issues
  const result = new Uint32Array(accessor.count);
  const view = new DataView(bin);

  for (let i = 0; i < accessor.count; i++) {
    const offset = byteOffset + i * compSize;
    switch (accessor.componentType) {
      case 5121:
        result[i] = view.getUint8(offset);
        break;
      case 5123:
        result[i] = view.getUint16(offset, true);
        break;
      case 5125:
        result[i] = view.getUint32(offset, true);
        break;
      default:
        result[i] = view.getUint32(offset, true);
    }
  }

  return result;
}

// ── Helpers ─────────────────────────────────────────────────────

function typeToComponentCount(type: string): number {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC2":
      return 2;
    case "VEC3":
      return 3;
    case "VEC4":
      return 4;
    case "MAT2":
      return 4;
    case "MAT3":
      return 9;
    case "MAT4":
      return 16;
    default:
      return 1;
  }
}

function generateFlatNormals(positions: Float32Array): Float32Array {
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
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    for (let j = 0; j < 3; j++) {
      normals[i + j * 3] = nx;
      normals[i + j * 3 + 1] = ny;
      normals[i + j * 3 + 2] = nz;
    }
  }

  return normals;
}
