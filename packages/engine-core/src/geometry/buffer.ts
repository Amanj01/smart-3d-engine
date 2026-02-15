/**
 * Vertex and index buffer data structures.
 */

export interface VertexAttribute {
  name: string;
  components: number; // 2 for vec2, 3 for vec3, etc.
  offset: number;     // byte offset within stride
}

export interface VertexLayout {
  stride: number;
  attributes: VertexAttribute[];
}

/** Standard interleaved vertex: position(3) + normal(3) + uv(2) = 8 floats = 32 bytes */
export const STANDARD_VERTEX_LAYOUT: VertexLayout = {
  stride: 32,
  attributes: [
    { name: "position", components: 3, offset: 0 },
    { name: "normal", components: 3, offset: 12 },
    { name: "uv", components: 2, offset: 24 },
  ],
};

export interface GeometryData {
  vertices: Float32Array;   // Interleaved vertex data
  indices: Uint32Array;
  vertexCount: number;
  indexCount: number;
  layout: VertexLayout;
}

/**
 * Create interleaved vertex buffer from separate attribute arrays.
 */
export function interleaveVertexData(
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
): Float32Array {
  const vertexCount = positions.length / 3;
  const data = new Float32Array(vertexCount * 8);

  for (let i = 0; i < vertexCount; i++) {
    const vi = i * 8;
    const pi = i * 3;
    const ui = i * 2;

    data[vi] = positions[pi];
    data[vi + 1] = positions[pi + 1];
    data[vi + 2] = positions[pi + 2];

    data[vi + 3] = normals[pi];
    data[vi + 4] = normals[pi + 1];
    data[vi + 5] = normals[pi + 2];

    data[vi + 6] = uvs[ui];
    data[vi + 7] = uvs[ui + 1];
  }

  return data;
}

/**
 * Create GPU buffers from geometry data.
 */
export function createGPUBuffers(
  device: GPUDevice,
  data: GeometryData,
): { vertexBuffer: GPUBuffer; indexBuffer: GPUBuffer } {
  const vertexBuffer = device.createBuffer({
    size: data.vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(data.vertices);
  vertexBuffer.unmap();

  const indexBuffer = device.createBuffer({
    size: data.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(indexBuffer.getMappedRange()).set(data.indices);
  indexBuffer.unmap();

  return { vertexBuffer, indexBuffer };
}

/**
 * Create WebGL2 VAO from geometry data.
 */
export function createGLBuffers(
  gl: WebGL2RenderingContext,
  data: GeometryData,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");

  gl.bindVertexArray(vao);

  // Vertex buffer
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);

  // Position: location 0
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);

  // Normal: location 1
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);

  // UV: location 2
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);

  // Index buffer
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  return vao;
}
