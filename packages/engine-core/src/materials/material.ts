/**
 * Material system — PBR-style material definitions.
 */

import type { Vec4 } from "../scene/transform";

export interface Material {
  name: string;
  baseColor: Vec4;        // RGBA
  roughness: number;      // 0 (smooth) to 1 (rough)
  metallic: number;       // 0 (dielectric) to 1 (metallic)
  emissive: [number, number, number]; // RGB emissive color
  opacity: number;
  doubleSided: boolean;
}

export interface MaterialOptions {
  name?: string;
  baseColor?: Vec4;
  roughness?: number;
  metallic?: number;
  emissive?: [number, number, number];
  opacity?: number;
  doubleSided?: boolean;
}

export function createMaterial(options: MaterialOptions = {}): Material {
  return {
    name: options.name ?? "material",
    baseColor: options.baseColor ?? [0.8, 0.8, 0.8, 1.0],
    roughness: options.roughness ?? 0.5,
    metallic: options.metallic ?? 0.0,
    emissive: options.emissive ?? [0, 0, 0],
    opacity: options.opacity ?? 1.0,
    doubleSided: options.doubleSided ?? false,
  };
}

export function createDefaultMaterial(): Material {
  return createMaterial({ name: "default" });
}

// ── Preset materials ────────────────────────────────────────────

export const MATERIALS = {
  metal: () =>
    createMaterial({
      name: "metal",
      baseColor: [0.7, 0.7, 0.75, 1.0],
      roughness: 0.2,
      metallic: 1.0,
    }),

  plastic: () =>
    createMaterial({
      name: "plastic",
      baseColor: [0.9, 0.1, 0.1, 1.0],
      roughness: 0.4,
      metallic: 0.0,
    }),

  wood: () =>
    createMaterial({
      name: "wood",
      baseColor: [0.55, 0.35, 0.15, 1.0],
      roughness: 0.8,
      metallic: 0.0,
    }),

  glass: () =>
    createMaterial({
      name: "glass",
      baseColor: [0.9, 0.95, 1.0, 0.3],
      roughness: 0.05,
      metallic: 0.0,
      opacity: 0.3,
    }),

  emissive: (color: [number, number, number] = [1, 0.8, 0.3]) =>
    createMaterial({
      name: "emissive",
      baseColor: [color[0], color[1], color[2], 1.0],
      roughness: 1.0,
      metallic: 0.0,
      emissive: color,
    }),
};
