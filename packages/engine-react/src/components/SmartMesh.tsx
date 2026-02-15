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

  const budgetMs = budget ? parseFloat(budget) : 4;

  useEffect(() => {
    // Start with a placeholder mesh
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

    // Try AI generation
    if (onGenerate) {

      onGenerate(prompt)
        .then((generated) => {
          if (!nodeRef.current) return;

          mesh.destroy(engine.ctx);

          const aiMesh = createMesh({
            name: `ai_${prompt.slice(0, 20)}`,
            positions: generated.positions,
            normals: generated.normals,
            uvs: generated.uvs,
            indices: generated.indices,
          });

          // Generate LOD for AI meshes (they tend to be heavy)
          aiMesh.lodLevels = generateLODLevels(aiMesh.geometryData);
          aiMesh.uploadToGPU(engine.ctx);

          nodeRef.current.mesh = aiMesh;
          if (material) {
            nodeRef.current.material = createMaterial(material);
          }
          nodeRef.current.setDirty();
        })
        .catch(() => {
          // Keep placeholder
        });
    }

    return () => {
      node.mesh?.destroy(engine.ctx);
      scene.removeNode(node);
      nodeRef.current = null;
    };
  }, [prompt, onGenerate, engine, scene, parentNode, importance, budgetMs, placeholder]);

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
