/**
 * 3D math utilities — matrices and vectors.
 * Lightweight, no external dependencies. All matrices are column-major Float32Array(16).
 */

export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export type Quat = [number, number, number, number]; // [x, y, z, w]

// ── Matrix creation ─────────────────────────────────────────────

export function mat4Identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function mat4Translation(x: number, y: number, z: number): Mat4 {
  const m = mat4Identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

export function mat4Scaling(x: number, y: number, z: number): Mat4 {
  const m = new Float32Array(16);
  m[0] = x;
  m[5] = y;
  m[10] = z;
  m[15] = 1;
  return m;
}

export function mat4RotationX(rad: number): Mat4 {
  const m = mat4Identity();
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

export function mat4RotationY(rad: number): Mat4 {
  const m = mat4Identity();
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

export function mat4RotationZ(rad: number): Mat4 {
  const m = mat4Identity();
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}

export function mat4FromQuat(q: Quat): Mat4 {
  const [x, y, z, w] = q;
  const m = new Float32Array(16);

  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  m[0] = 1 - (yy + zz); m[1] = xy + wz;        m[2] = xz - wy;        m[3] = 0;
  m[4] = xy - wz;        m[5] = 1 - (xx + zz);  m[6] = yz + wx;        m[7] = 0;
  m[8] = xz + wy;        m[9] = yz - wx;         m[10] = 1 - (xx + yy); m[11] = 0;
  m[12] = 0;             m[13] = 0;              m[14] = 0;             m[15] = 1;

  return m;
}

// ── Matrix operations ───────────────────────────────────────────

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[j * 4 + i] =
        a[i] * b[j * 4] +
        a[4 + i] * b[j * 4 + 1] +
        a[8 + i] * b[j * 4 + 2] +
        a[12 + i] * b[j * 4 + 3];
    }
  }
  return out;
}

export function mat4Transpose(m: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] = m[j * 4 + i];
    }
  }
  return out;
}

export function mat4Invert(m: Mat4): Mat4 {
  const inv = new Float32Array(16);
  const a = m;

  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return mat4Identity();
  det = 1.0 / det;

  inv[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  inv[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  inv[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  inv[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  inv[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  inv[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  inv[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  inv[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  inv[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  inv[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  inv[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  inv[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  inv[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  inv[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  inv[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  inv[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

  return inv;
}

// ── Projection matrices ─────────────────────────────────────────

export function mat4Perspective(
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): Mat4 {
  const m = new Float32Array(16);
  const f = 1.0 / Math.tan(fovY / 2);
  const rangeInv = 1 / (near - far);

  m[0] = f / aspect;
  m[5] = f;
  m[10] = (near + far) * rangeInv;
  m[11] = -1;
  m[14] = 2 * near * far * rangeInv;

  return m;
}

export function mat4LookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  let len = 1 / Math.sqrt(zx * zx + zy * zy + zz * zz);
  const fz: Vec3 = [zx * len, zy * len, zz * len];

  // cross(up, forward)
  const sx = up[1] * fz[2] - up[2] * fz[1];
  const sy = up[2] * fz[0] - up[0] * fz[2];
  const sz = up[0] * fz[1] - up[1] * fz[0];
  len = 1 / Math.sqrt(sx * sx + sy * sy + sz * sz);
  const fx: Vec3 = [sx * len, sy * len, sz * len];

  // cross(forward, right)
  const fy: Vec3 = [
    fz[1] * fx[2] - fz[2] * fx[1],
    fz[2] * fx[0] - fz[0] * fx[2],
    fz[0] * fx[1] - fz[1] * fx[0],
  ];

  const m = new Float32Array(16);
  m[0] = fx[0]; m[1] = fy[0]; m[2] = fz[0]; m[3] = 0;
  m[4] = fx[1]; m[5] = fy[1]; m[6] = fz[1]; m[7] = 0;
  m[8] = fx[2]; m[9] = fy[2]; m[10] = fz[2]; m[11] = 0;
  m[12] = -(fx[0] * eye[0] + fx[1] * eye[1] + fx[2] * eye[2]);
  m[13] = -(fy[0] * eye[0] + fy[1] * eye[1] + fy[2] * eye[2]);
  m[14] = -(fz[0] * eye[0] + fz[1] * eye[1] + fz[2] * eye[2]);
  m[15] = 1;

  return m;
}

// ── Transform component ─────────────────────────────────────────

export interface Transform {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

export function createTransform(): Transform {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
  };
}

export function transformToMatrix(t: Transform): Mat4 {
  const translation = mat4Translation(...t.position);
  const rotation = mat4FromQuat(t.rotation);
  const scale = mat4Scaling(...t.scale);
  return mat4Multiply(mat4Multiply(translation, rotation), scale);
}

// ── Vec3 helpers ────────────────────────────────────────────────

export function vec3Normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len === 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function vec3Distance(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
