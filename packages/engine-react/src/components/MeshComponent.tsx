/**
 * <MeshComponent> — declaratively adds a mesh to the scene.
 *
 * Usage:
 *   <MeshComponent
 *     geometry="box"
 *     material={{ baseColor: [1, 0, 0, 1] }}
 *     position={[0, 1, 0]}
 *   />
 */

import { useEffect, useRef, type ReactNode } from "react";
import {
  createMesh,
  createBoxMesh,
  createSphereMesh,
  createPlaneMesh,
  createMaterial,
  type Vec3,
  type Quat,
  type MaterialOptions,
  type MeshOptions,
  type SceneNode,
  generateLODLevels,
} from "@3d-engine/core";
import { useEngine } from "../context";
import { useScene } from "./Scene";

export type PrimitiveGeometry = "box" | "sphere" | "plane";

export interface MeshComponentProps {
  children?: ReactNode;

  /** Primitive geometry type or custom mesh options */
  geometry: PrimitiveGeometry | MeshOptions;

  /** Material properties */
  material?: MaterialOptions;

  /** Position in world space */
  position?: Vec3;

  /** Rotation as quaternion [x, y, z, w] */
  rotation?: Quat;

  /** Scale */
  scale?: Vec3;

  /** Node name */
  name?: string;

  /** Visibility */
  visible?: boolean;

  /** Importance for adaptive quality */
  importance?: "low" | "medium" | "high";

  /** GPU budget in ms */
  budget?: number;

  /** Enable LOD generation */
  lod?: boolean;
}

function resolveMeshOptions(geometry: PrimitiveGeometry | MeshOptions): MeshOptions {
  if (typeof geometry === "string") {
    switch (geometry) {
      case "box":
        return createBoxMesh();
      case "sphere":
        return createSphereMesh();
      case "plane":
        return createPlaneMesh();
    }
  }
  return geometry;
}

export function MeshComponent({
  geometry,
  material,
  position,
  rotation,
  scale,
  name,
  visible = true,
  importance = "medium",
  budget,
  lod = false,
}: MeshComponentProps): null {
  const engine = useEngine();
  const { scene, parentNode } = useScene();
  const nodeRef = useRef<SceneNode | null>(null);

  // Create node and mesh on mount
  useEffect(() => {
    const meshOptions = resolveMeshOptions(geometry);
    const mesh = createMesh(meshOptions);

    // Generate LOD levels if requested
    if (lod) {
      const lodLevels = generateLODLevels(mesh.geometryData);
      mesh.lodLevels = lodLevels;
    }

    mesh.uploadToGPU(engine.ctx);

    const node = scene.addNodeTo(parentNode, {
      name,
      mesh,
      material: material ? createMaterial(material) : undefined,
      visible,
      importance,
      gpuBudgetMs: budget,
    });

    if (position) node.transform.position = position;
    if (rotation) node.transform.rotation = rotation;
    if (scale) node.transform.scale = scale;
    node.setDirty();

    nodeRef.current = node;

    return () => {
      mesh.destroy(engine.ctx);
      scene.removeNode(node);
      nodeRef.current = null;
    };
  }, [geometry, lod, engine, scene, parentNode, name, importance, budget]);

  // Update transform when props change
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    if (position) node.transform.position = position;
    if (rotation) node.transform.rotation = rotation;
    if (scale) node.transform.scale = scale;
    node.visible = visible;
    node.setDirty();
  }, [position, rotation, scale, visible]);

  // Update material when props change
  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !material) return;
    node.material = createMaterial(material);
  }, [material]);

  return null;
}
