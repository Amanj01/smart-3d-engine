/**
 * Lighting system — directional, point, and ambient lights.
 */

import type { Vec3 } from "../scene/transform";
import { vec3Normalize } from "../scene/transform";

export type LightType = "directional" | "point" | "ambient";

export interface Light {
  type: LightType;
  color: Vec3;
  intensity: number;
  direction: Vec3;        // Used by directional lights
  position: Vec3;         // Used by point lights
  ambientIntensity: number;
  range: number;          // Used by point lights
  castShadow: boolean;
  shadowMapSize: number;
}

export interface LightOptions {
  type?: LightType;
  color?: Vec3;
  intensity?: number;
  direction?: Vec3;
  position?: Vec3;
  ambientIntensity?: number;
  range?: number;
  castShadow?: boolean;
  shadowMapSize?: number;
}

export function createLight(options: LightOptions = {}): Light {
  return {
    type: options.type ?? "directional",
    color: options.color ?? [1, 1, 1],
    intensity: options.intensity ?? 1.0,
    direction: vec3Normalize(options.direction ?? [0.3, -0.8, -0.5]),
    position: options.position ?? [0, 5, 0],
    ambientIntensity: options.ambientIntensity ?? 0.15,
    range: options.range ?? 50,
    castShadow: options.castShadow ?? false,
    shadowMapSize: options.shadowMapSize ?? 1024,
  };
}

// ── Light presets ───────────────────────────────────────────────

export const LIGHTS = {
  sun: () =>
    createLight({
      type: "directional",
      color: [1.0, 0.95, 0.85],
      intensity: 1.2,
      direction: [0.3, -0.8, -0.5],
      ambientIntensity: 0.2,
      castShadow: true,
    }),

  moonlight: () =>
    createLight({
      type: "directional",
      color: [0.6, 0.7, 1.0],
      intensity: 0.4,
      direction: [-0.2, -0.9, 0.3],
      ambientIntensity: 0.05,
    }),

  pointWarm: (position: Vec3 = [0, 3, 0]) =>
    createLight({
      type: "point",
      color: [1.0, 0.8, 0.5],
      intensity: 2.0,
      position,
      range: 20,
    }),

  ambient: (intensity = 0.3) =>
    createLight({
      type: "ambient",
      ambientIntensity: intensity,
    }),
};
