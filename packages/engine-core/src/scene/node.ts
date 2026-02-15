/**
 * Scene node — a single entity in the scene graph.
 */

import type { Mat4, Vec3 } from "./transform";
import {
  createTransform,
  transformToMatrix,
  mat4Multiply,
  mat4Identity,
  type Transform,
} from "./transform";
import type { Mesh } from "../geometry/mesh";
import type { Material } from "../materials/material";
import { createDefaultMaterial } from "../materials/material";

let nodeIdCounter = 0;

export interface SceneNodeOptions {
  name?: string;
  mesh?: Mesh;
  material?: Material;
  position?: Vec3;
  visible?: boolean;
  importance?: "low" | "medium" | "high";
  gpuBudgetMs?: number;
}

export class SceneNode {
  readonly id: number;
  name: string;
  transform: Transform;
  mesh: Mesh | null;
  material: Material;
  visible: boolean;
  importance: "low" | "medium" | "high";
  gpuBudgetMs: number;

  parent: SceneNode | null = null;
  children: SceneNode[] = [];

  private _worldMatrix: Mat4 = mat4Identity();
  private _dirty = true;

  constructor(options: SceneNodeOptions = {}) {
    this.id = nodeIdCounter++;
    this.name = options.name ?? `node_${this.id}`;
    this.transform = createTransform();
    this.mesh = options.mesh ?? null;
    this.material = options.material ?? createDefaultMaterial();
    this.visible = options.visible ?? true;
    this.importance = options.importance ?? "medium";
    this.gpuBudgetMs = options.gpuBudgetMs ?? 4;

    if (options.position) {
      this.transform.position = options.position;
    }
  }

  get worldMatrix(): Mat4 {
    if (this._dirty) {
      this.updateWorldMatrix();
    }
    return this._worldMatrix;
  }

  setDirty(): void {
    this._dirty = true;
    for (const child of this.children) {
      child.setDirty();
    }
  }

  addChild(child: SceneNode): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
    child.setDirty();
  }

  removeChild(child: SceneNode): void {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parent = null;
      child.setDirty();
    }
  }

  private updateWorldMatrix(): void {
    const localMatrix = transformToMatrix(this.transform);
    if (this.parent) {
      this._worldMatrix = mat4Multiply(this.parent.worldMatrix, localMatrix);
    } else {
      this._worldMatrix = localMatrix;
    }
    this._dirty = false;
  }

  /** Traverse this node and all descendants depth-first */
  traverse(callback: (node: SceneNode) => void): void {
    callback(this);
    for (const child of this.children) {
      child.traverse(callback);
    }
  }
}
