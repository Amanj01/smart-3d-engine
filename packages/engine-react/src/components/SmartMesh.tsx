/**
 * <SmartMesh> — AI-powered declarative mesh component.
 * Generates geometry from text prompts using the AI plugin.
 *
 * Usage:
 *   <SmartMesh
 *     prompt="ancient dragon statue"
 *     importance="high"
 *     budget="8ms"
 *   />
 */

import { useEffect, useRef } from "react";
import {
  createMesh,
  createBoxMesh,
  createMaterial,
  generateLODLevels,
  type Vec3,
  type Quat,
  type MaterialOptions,
  type SceneNode,
} from "@3d-engine/core";
import { useEngine } from "../context";
import { useScene } from "./Scene";

export interface SmartMeshProps {
  /** Text prompt describing the desired geometry */
  prompt: string;

  /** Material properties */
  material?: MaterialOptions;

  /** Position in world space */
  position?: Vec3;

  /** Rotation as quaternion */
  rotation?: Quat;

  /** Scale */
  scale?: Vec3;

  /** Importance for adaptive quality */
  importance?: "low" | "medium" | "high";

  /** GPU budget (e.g., "8ms") */
  budget?: string;

  /** Placeholder while generating */
  placeholder?: boolean;

  /** AI generation callback (provided by engine-ai plugin) */
  onGenerate?: (prompt: string) => Promise<{
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
  }>;
}

export function SmartMesh({
  prompt,
  material,
  position,
  rotation,
  scale,
  importance = "medium",
  budget,
  placeholder = true,
  onGenerate,
}: SmartMeshProps): null {
  const engine = useEngine();
  const { scene, parentNode } = useScene();
  const nodeRef = useRef<SceneNode | null>(null);

  // Keep a stable ref for onGenerate so it doesn't trigger the effect
  const onGenerateRef = useRef(onGenerate);
  onGenerateRef.current = onGenerate;

  const budgetMs = budget ? parseFloat(budget) : 4;

  // Create the scene node once (on mount or when engine/scene changes)
  useEffect(() => {
    const placeholderOptions = createBoxMesh(0.5, 0.5, 0.5);
    const mesh = createMesh(placeholderOptions);
    mesh.uploadToGPU(engine.ctx);

    const node = scene.addNodeTo(parentNode, {
      name: `smart_${prompt.slice(0, 20)}`,
      mesh,
      material: material
        ? createMaterial(material)
        : createMaterial({ baseColor: [0.5, 0.5, 0.5, placeholder ? 0.5 : 1] }),
      visible: true,
      importance,
      gpuBudgetMs: budgetMs,
    });

    if (position) node.transform.position = position;
    if (rotation) node.transform.rotation = rotation;
    if (scale) node.transform.scale = scale;
    node.setDirty();
    nodeRef.current = node;

    return () => {
      node.mesh?.destroy(engine.ctx);
      scene.removeNode(node);
      nodeRef.current = null;
    };
  }, [engine, scene, parentNode]);

  // Run generation only when prompt changes (not when onGenerate ref changes)
  useEffect(() => {
    if (!prompt) return;
    const gen = onGenerateRef.current;
    if (!gen) return;

    let cancelled = false;

    gen(prompt)
      .then((generated) => {
        if (cancelled || !nodeRef.current) return;

        const node = nodeRef.current;
        node.mesh?.destroy(engine.ctx);

        const aiMesh = createMesh({
          name: `ai_${prompt.slice(0, 20)}`,
          positions: generated.positions,
          normals: generated.normals,
          uvs: generated.uvs,
          indices: generated.indices,
        });

        aiMesh.lodLevels = generateLODLevels(aiMesh.geometryData);
        aiMesh.uploadToGPU(engine.ctx);

        node.mesh = aiMesh;
        if (material) {
          node.material = createMaterial(material);
        }
        node.setDirty();
      })
      .catch((err) => {
        console.error("[SmartMesh] Generation failed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [prompt, engine]);

  // Update transform
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    if (position) node.transform.position = position;
    if (rotation) node.transform.rotation = rotation;
    if (scale) node.transform.scale = scale;
    node.setDirty();
  }, [position, rotation, scale]);

  return null;
}
