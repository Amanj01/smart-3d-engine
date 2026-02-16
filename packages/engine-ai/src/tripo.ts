/**
 * Tripo3D API integration — text-to-3D mesh generation.
 *
 * Uses the Tripo API (https://platform.tripo3d.ai/docs) to generate
 * high-quality 3D meshes from text prompts. Returns GLB models which
 * are parsed into engine-compatible geometry.
 *
 * API keys start with `tsk_` and can be obtained at https://platform.tripo3d.ai
 */

import type { GeneratedMesh, MeshGenerator } from "./generator";
import { parseGLB } from "./glb-parser";

// ── Types ───────────────────────────────────────────────────────

export interface TripoConfig {
  /** Tripo API key (starts with tsk_) */
  apiKey: string;

  /** Model version to use */
  modelVersion?: "v2.0-20240919" | "v2.5";

  /**
   * Base URL for the Tripo API.
   * Override this when proxying requests through your own server.
   * Default: "https://api.tripo3d.ai/v2/openapi"
   */
  baseUrl?: string;

  /** Timeout in ms for the entire generation (default: 120000 = 2 min) */
  timeout?: number;

  /** Polling interval in ms (default: 3000) */
  pollInterval?: number;

  /** Negative prompt — features to avoid */
  negativePrompt?: string;

  /**
   * Proxy URL for model downloads (GLB files from CDN).
   * When set, model downloads go through: `{modelProxy}?url={encodedCdnUrl}`
   * This avoids CORS issues in browser environments.
   */
  modelProxy?: string;
}

interface TripoTaskResponse {
  code: number;
  data: {
    task_id: string;
  };
}

interface TripoStatusResponse {
  code: number;
  data: {
    task_id: string;
    status: "queued" | "running" | "success" | "failed";
    output?: {
      model?: string;
      pbr_model?: string;
    };
  };
}

// ── Generator ───────────────────────────────────────────────────

export function createTripoGenerator(config: TripoConfig): MeshGenerator {
  const {
    apiKey,
    modelVersion = "v2.0-20240919",
    baseUrl = "https://api.tripo3d.ai/v2/openapi",
    timeout = 120_000,
    pollInterval = 3000,
    negativePrompt,
    modelProxy,
  } = config;

  return {
    isAvailable(): boolean {
      return !!apiKey;
    },

    async generate(prompt: string): Promise<GeneratedMesh> {
      if (!apiKey) {
        throw new Error("Tripo API key is required");
      }

      // ── 1. Create task ──
      const taskRes = await fetch(`${baseUrl}/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          type: "text_to_model",
          prompt,
          ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
          model_version: modelVersion,
        }),
      });

      if (!taskRes.ok) {
        const text = await taskRes.text();
        throw new Error(`Tripo API error (${taskRes.status}): ${text}`);
      }

      const taskData: TripoTaskResponse = await taskRes.json();
      if (taskData.code !== 0) {
        throw new Error(`Tripo task creation failed (code ${taskData.code})`);
      }

      const taskId = taskData.data.task_id;

      // ── 2. Poll for completion ──
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        await sleep(pollInterval);

        const statusRes = await fetch(`${baseUrl}/task/${taskId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!statusRes.ok) {
          throw new Error(`Tripo status check failed (${statusRes.status})`);
        }

        const statusData: TripoStatusResponse = await statusRes.json();
        const status = statusData.data.status;

        if (status === "success") {
          const modelUrl =
            statusData.data.output?.pbr_model ??
            statusData.data.output?.model;

          if (!modelUrl) {
            throw new Error("Tripo task succeeded but no model URL returned");
          }

          // ── 3. Download GLB (via proxy if configured, to avoid CORS) ──
          const downloadUrl = modelProxy
            ? `${modelProxy}?url=${encodeURIComponent(modelUrl)}`
            : modelUrl;
          const glbRes = await fetch(downloadUrl);
          if (!glbRes.ok) {
            throw new Error(`Failed to download model (${glbRes.status})`);
          }
          const glbBuffer = await glbRes.arrayBuffer();

          // ── 4. Parse GLB → GeneratedMesh ──
          return parseGLB(glbBuffer);
        }

        if (status === "failed") {
          throw new Error("Tripo generation failed");
        }

        // "queued" or "running" — keep polling
      }

      throw new Error(`Tripo generation timed out after ${timeout}ms`);
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
