/**
 * Shader management — WGSL shaders for WebGPU, GLSL for WebGL.
 */

// ── Default WGSL shaders ────────────────────────────────────────

export const DEFAULT_VERTEX_WGSL = /* wgsl */ `
struct Uniforms {
  modelViewProjection: mat4x4<f32>,
  model: mat4x4<f32>,
  normalMatrix: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldNormal: vec3<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) worldPosition: vec3<f32>,
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.modelViewProjection * vec4<f32>(input.position, 1.0);
  output.worldNormal = (uniforms.normalMatrix * vec4<f32>(input.normal, 0.0)).xyz;
  output.uv = input.uv;
  output.worldPosition = (uniforms.model * vec4<f32>(input.position, 1.0)).xyz;
  return output;
}
`;

export const DEFAULT_FRAGMENT_WGSL = /* wgsl */ `
struct LightUniforms {
  direction: vec3<f32>,
  color: vec3<f32>,
  ambientIntensity: f32,
};

struct MaterialUniforms {
  baseColor: vec4<f32>,
  roughness: f32,
  metallic: f32,
};

@group(0) @binding(1) var<uniform> light: LightUniforms;
@group(0) @binding(2) var<uniform> material: MaterialUniforms;

struct FragmentInput {
  @location(0) worldNormal: vec3<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) worldPosition: vec3<f32>,
};

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
  let N = normalize(input.worldNormal);
  let L = normalize(-light.direction);

  let ambient = light.color * light.ambientIntensity;
  let diffuse = max(dot(N, L), 0.0) * light.color;

  let finalColor = material.baseColor.rgb * (ambient + diffuse);
  return vec4<f32>(finalColor, material.baseColor.a);
}
`;

// ── Default GLSL shaders (WebGL2 fallback) ──────────────────────

export const DEFAULT_VERTEX_GLSL = /* glsl */ `#version 300 es
precision highp float;

uniform mat4 u_modelViewProjection;
uniform mat4 u_model;
uniform mat4 u_normalMatrix;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;

out vec3 v_worldNormal;
out vec2 v_uv;
out vec3 v_worldPosition;

void main() {
  gl_Position = u_modelViewProjection * vec4(a_position, 1.0);
  v_worldNormal = (u_normalMatrix * vec4(a_normal, 0.0)).xyz;
  v_uv = a_uv;
  v_worldPosition = (u_model * vec4(a_position, 1.0)).xyz;
}
`;

export const DEFAULT_FRAGMENT_GLSL = /* glsl */ `#version 300 es
precision highp float;

uniform vec3 u_lightDirection;
uniform vec3 u_lightColor;
uniform float u_ambientIntensity;
uniform vec4 u_baseColor;

in vec3 v_worldNormal;
in vec2 v_uv;
in vec3 v_worldPosition;

out vec4 fragColor;

void main() {
  vec3 N = normalize(v_worldNormal);
  vec3 L = normalize(-u_lightDirection);

  vec3 ambient = u_lightColor * u_ambientIntensity;
  vec3 diffuse = max(dot(N, L), 0.0) * u_lightColor;

  vec3 finalColor = u_baseColor.rgb * (ambient + diffuse);
  fragColor = vec4(finalColor, u_baseColor.a);
}
`;

// ── Shader complexity tiers (for adaptive quality) ──────────────

export type ShaderTier = "low" | "medium" | "high";

export const FRAGMENT_SHADERS_WGSL: Record<ShaderTier, string> = {
  low: /* wgsl */ `
struct MaterialUniforms {
  baseColor: vec4<f32>,
  roughness: f32,
  metallic: f32,
};
@group(0) @binding(2) var<uniform> material: MaterialUniforms;

struct FragmentInput {
  @location(0) worldNormal: vec3<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) worldPosition: vec3<f32>,
};

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
  return material.baseColor;
}
`,
  medium: DEFAULT_FRAGMENT_WGSL,
  high: /* wgsl */ `
struct LightUniforms {
  direction: vec3<f32>,
  color: vec3<f32>,
  ambientIntensity: f32,
};

struct MaterialUniforms {
  baseColor: vec4<f32>,
  roughness: f32,
  metallic: f32,
};

@group(0) @binding(1) var<uniform> light: LightUniforms;
@group(0) @binding(2) var<uniform> material: MaterialUniforms;

struct FragmentInput {
  @location(0) worldNormal: vec3<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) worldPosition: vec3<f32>,
};

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
  let N = normalize(input.worldNormal);
  let L = normalize(-light.direction);
  let V = normalize(-input.worldPosition);
  let H = normalize(L + V);

  let ambient = light.color * light.ambientIntensity;
  let diffuse = max(dot(N, L), 0.0) * light.color;

  let roughness = material.roughness;
  let specPower = mix(16.0, 256.0, 1.0 - roughness);
  let specular = pow(max(dot(N, H), 0.0), specPower) * light.color * (1.0 - roughness);

  let fresnel = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  let reflectivity = mix(0.04, 1.0, material.metallic);
  let fresnelFactor = reflectivity + (1.0 - reflectivity) * fresnel;

  let color = material.baseColor.rgb * (ambient + diffuse) + specular * fresnelFactor;
  return vec4<f32>(color, material.baseColor.a);
}
`,
};

// ── Shader compilation helpers ──────────────────────────────────

export function compileGLShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }

  return shader;
}

export function createGLProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vs = compileGLShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileGLShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }

  gl.deleteShader(vs);
  gl.deleteShader(fs);

  return program;
}
