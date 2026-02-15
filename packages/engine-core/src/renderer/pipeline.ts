/**
 * Render pipeline — orchestrates the draw loop for both backends.
 */

import type { RendererContext } from "./context";
import type { SceneGraph } from "../scene/scene";
import type { Camera } from "../camera/camera";
import type { Light } from "../lighting/light";
import type { ShaderTier } from "./shader";
import {
  DEFAULT_VERTEX_WGSL,
  FRAGMENT_SHADERS_WGSL,
  DEFAULT_VERTEX_GLSL,
  DEFAULT_FRAGMENT_GLSL,
  createGLProgram,
} from "./shader";
import { mat4Multiply, mat4Transpose, mat4Invert } from "../scene/transform";

// ── Types ───────────────────────────────────────────────────────

export interface RenderPipelineOptions {
  shaderTier?: ShaderTier;
  shadowMapSize?: number;
}

export interface RenderPipeline {
  readonly shaderTier: ShaderTier;
  setShaderTier(tier: ShaderTier): void;
  render(scene: SceneGraph, camera: Camera, lights: Light[]): void;
  destroy(): void;
}

// ── WebGPU pipeline ─────────────────────────────────────────────

class WebGPURenderPipeline implements RenderPipeline {
  private pipeline: GPURenderPipeline | null = null;
  private _shaderTier: ShaderTier;
  private depthTexture: GPUTexture | null = null;

  get shaderTier(): ShaderTier {
    return this._shaderTier;
  }

  constructor(
    private ctx: RendererContext,
    options: RenderPipelineOptions = {},
  ) {
    this._shaderTier = options.shaderTier ?? "medium";
    this.buildPipeline();
  }

  private buildPipeline(): void {
    const { device, format } = this.ctx;
    if (!device || !format) return;

    const vertexModule = device.createShaderModule({ code: DEFAULT_VERTEX_WGSL });
    const fragmentModule = device.createShaderModule({
      code: FRAGMENT_SHADERS_WGSL[this._shaderTier],
    });

    this.pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: vertexModule,
        entryPoint: "main",
        buffers: [
          {
            // Position
            arrayStride: 32, // 3 + 3 + 2 floats = 8 * 4 bytes
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },  // position
              { shaderLocation: 1, offset: 12, format: "float32x3" }, // normal
              { shaderLocation: 2, offset: 24, format: "float32x2" }, // uv
            ],
          },
        ],
      },
      fragment: {
        module: fragmentModule,
        entryPoint: "main",
        targets: [{ format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
  }

  private ensureDepthTexture(): GPUTexture {
    const { device, canvas } = this.ctx;
    if (!device) throw new Error("No GPU device");

    if (
      this.depthTexture &&
      this.depthTexture.width === canvas.width &&
      this.depthTexture.height === canvas.height
    ) {
      return this.depthTexture;
    }

    this.depthTexture?.destroy();
    this.depthTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    return this.depthTexture;
  }

  setShaderTier(tier: ShaderTier): void {
    if (tier === this._shaderTier) return;
    this._shaderTier = tier;
    this.buildPipeline();
  }

  render(scene: SceneGraph, camera: Camera, lights: Light[]): void {
    const { device, gpuContext } = this.ctx;
    if (!device || !gpuContext || !this.pipeline) return;

    const colorTexture = gpuContext.getCurrentTexture();
    const depthTexture = this.ensureDepthTexture();

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorTexture.createView(),
          clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    passEncoder.setPipeline(this.pipeline);

    const viewMatrix = camera.viewMatrix;
    const projMatrix = camera.projectionMatrix;
    const vpMatrix = mat4Multiply(projMatrix, viewMatrix);
    const primaryLight = lights[0];

    for (const node of scene.renderableNodes()) {
      const mesh = node.mesh;
      if (!mesh || !mesh.gpuVertexBuffer || !mesh.gpuIndexBuffer) continue;

      const modelMatrix = node.worldMatrix;
      const mvpMatrix = mat4Multiply(vpMatrix, modelMatrix);
      const normalMatrix = mat4Transpose(mat4Invert(modelMatrix));

      // Uniforms: MVP + Model + NormalMatrix
      const uniformData = new Float32Array(48); // 3 mat4
      uniformData.set(mvpMatrix, 0);
      uniformData.set(modelMatrix, 16);
      uniformData.set(normalMatrix, 32);

      const uniformBuffer = device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // Light uniforms
      const lightData = new Float32Array(8); // direction(3) + pad + color(3) + ambient
      if (primaryLight) {
        lightData.set(primaryLight.direction, 0);
        lightData.set(primaryLight.color, 4);
        lightData[7] = primaryLight.ambientIntensity;
      } else {
        lightData.set([0, -1, 0], 0);
        lightData.set([1, 1, 1], 4);
        lightData[7] = 0.3;
      }

      const lightBuffer = device.createBuffer({
        size: lightData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(lightBuffer, 0, lightData);

      // Material uniforms
      const mat = node.material;
      const matData = new Float32Array(8); // baseColor(4) + roughness + metallic + pad(2)
      matData.set(mat.baseColor, 0);
      matData[4] = mat.roughness;
      matData[5] = mat.metallic;

      const matBuffer = device.createBuffer({
        size: matData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(matBuffer, 0, matData);

      const bindGroup = device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: lightBuffer } },
          { binding: 2, resource: { buffer: matBuffer } },
        ],
      });

      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.setVertexBuffer(0, mesh.gpuVertexBuffer);
      passEncoder.setIndexBuffer(mesh.gpuIndexBuffer, "uint32");
      passEncoder.drawIndexed(mesh.indexCount);
    }

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
  }

  destroy(): void {
    this.depthTexture?.destroy();
  }
}

// ── WebGL2 pipeline ─────────────────────────────────────────────

class WebGL2RenderPipeline implements RenderPipeline {
  private program: WebGLProgram | null = null;
  private _shaderTier: ShaderTier;

  get shaderTier(): ShaderTier {
    return this._shaderTier;
  }

  constructor(
    private ctx: RendererContext,
    options: RenderPipelineOptions = {},
  ) {
    this._shaderTier = options.shaderTier ?? "medium";
    this.buildProgram();
  }

  private buildProgram(): void {
    const { gl } = this.ctx;
    if (!gl) return;

    if (this.program) {
      gl.deleteProgram(this.program);
    }

    this.program = createGLProgram(gl, DEFAULT_VERTEX_GLSL, DEFAULT_FRAGMENT_GLSL);
  }

  setShaderTier(tier: ShaderTier): void {
    if (tier === this._shaderTier) return;
    this._shaderTier = tier;
    // For WebGL, we could swap shader programs per tier — simplified here
  }

  render(scene: SceneGraph, camera: Camera, lights: Light[]): void {
    const { gl } = this.ctx;
    if (!gl || !this.program) return;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.05, 0.05, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);

    const viewMatrix = camera.viewMatrix;
    const projMatrix = camera.projectionMatrix;
    const vpMatrix = mat4Multiply(projMatrix, viewMatrix);
    const primaryLight = lights[0];

    // Light uniforms
    const lightDirLoc = gl.getUniformLocation(this.program, "u_lightDirection");
    const lightColorLoc = gl.getUniformLocation(this.program, "u_lightColor");
    const ambientLoc = gl.getUniformLocation(this.program, "u_ambientIntensity");

    if (primaryLight) {
      gl.uniform3fv(lightDirLoc, primaryLight.direction);
      gl.uniform3fv(lightColorLoc, primaryLight.color);
      gl.uniform1f(ambientLoc, primaryLight.ambientIntensity);
    } else {
      gl.uniform3fv(lightDirLoc, [0, -1, 0]);
      gl.uniform3fv(lightColorLoc, [1, 1, 1]);
      gl.uniform1f(ambientLoc, 0.3);
    }

    for (const node of scene.renderableNodes()) {
      const mesh = node.mesh;
      if (!mesh || !mesh.glVAO) continue;

      const modelMatrix = node.worldMatrix;
      const mvpMatrix = mat4Multiply(vpMatrix, modelMatrix);
      const normalMatrix = mat4Transpose(mat4Invert(modelMatrix));

      const mvpLoc = gl.getUniformLocation(this.program, "u_modelViewProjection");
      const modelLoc = gl.getUniformLocation(this.program, "u_model");
      const normalLoc = gl.getUniformLocation(this.program, "u_normalMatrix");
      const baseColorLoc = gl.getUniformLocation(this.program, "u_baseColor");

      gl.uniformMatrix4fv(mvpLoc, false, mvpMatrix);
      gl.uniformMatrix4fv(modelLoc, false, modelMatrix);
      gl.uniformMatrix4fv(normalLoc, false, normalMatrix);
      gl.uniform4fv(baseColorLoc, node.material.baseColor);

      gl.bindVertexArray(mesh.glVAO);
      gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
    }
  }

  destroy(): void {
    const { gl } = this.ctx;
    if (gl && this.program) {
      gl.deleteProgram(this.program);
    }
  }
}

// ── Factory ─────────────────────────────────────────────────────

export function createRenderPipeline(
  ctx: RendererContext,
  options?: RenderPipelineOptions,
): RenderPipeline {
  if (ctx.backend === "webgpu") {
    return new WebGPURenderPipeline(ctx, options);
  }
  return new WebGL2RenderPipeline(ctx, options);
}
