/**
 * Scene graph — root container for all scene nodes.
 */

import { SceneNode, type SceneNodeOptions } from "./node";

export class SceneGraph {
  readonly root: SceneNode;
  private _nodeMap = new Map<number, SceneNode>();

  constructor() {
    this.root = new SceneNode({ name: "__root__" });
    this._nodeMap.set(this.root.id, this.root);
  }

  addNode(options?: SceneNodeOptions): SceneNode {
    const node = new SceneNode(options);
    this.root.addChild(node);
    this._registerNode(node);
    return node;
  }

  addNodeTo(parent: SceneNode, options?: SceneNodeOptions): SceneNode {
    const node = new SceneNode(options);
    parent.addChild(node);
    this._registerNode(node);
    return node;
  }

  removeNode(node: SceneNode): void {
    if (node === this.root) return;
    if (node.parent) {
      node.parent.removeChild(node);
    }
    node.traverse((n) => this._nodeMap.delete(n.id));
  }

  getNode(id: number): SceneNode | undefined {
    return this._nodeMap.get(id);
  }

  findByName(name: string): SceneNode | undefined {
    for (const node of this._nodeMap.values()) {
      if (node.name === name) return node;
    }
    return undefined;
  }

  /** Yields all visible nodes that have a mesh attached */
  *renderableNodes(): IterableIterator<SceneNode> {
    const stack: SceneNode[] = [this.root];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (!node.visible) continue;
      if (node.mesh) {
        yield node;
      }
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }

  get nodeCount(): number {
    return this._nodeMap.size;
  }

  private _registerNode(node: SceneNode): void {
    node.traverse((n) => this._nodeMap.set(n.id, n));
  }
}
