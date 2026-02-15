/**
 * Camera system — perspective and orthographic projection.
 */

import type { Mat4, Vec3 } from "../scene/transform";
import { mat4Perspective, mat4LookAt, mat4Identity } from "../scene/transform";

export interface Camera {
  readonly viewMatrix: Mat4;
  readonly projectionMatrix: Mat4;
  position: Vec3;
  target: Vec3;
  up: Vec3;
  fov: number;
  aspect: number;
  near: number;
  far: number;
  update(): void;
}

export interface CameraOptions {
  position?: Vec3;
  target?: Vec3;
  up?: Vec3;
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
}

export function createCamera(options: CameraOptions = {}): Camera {
  const camera: Camera = {
    position: options.position ?? [0, 2, 5],
    target: options.target ?? [0, 0, 0],
    up: options.up ?? [0, 1, 0],
    fov: options.fov ?? (Math.PI / 4),   // 45 degrees
    aspect: options.aspect ?? 16 / 9,
    near: options.near ?? 0.1,
    far: options.far ?? 1000,

    viewMatrix: mat4Identity(),
    projectionMatrix: mat4Identity(),

    update(): void {
      (camera as { viewMatrix: Mat4 }).viewMatrix = mat4LookAt(
        camera.position,
        camera.target,
        camera.up,
      );
      (camera as { projectionMatrix: Mat4 }).projectionMatrix = mat4Perspective(
        camera.fov,
        camera.aspect,
        camera.near,
        camera.far,
      );
    },
  };

  camera.update();
  return camera;
}

/**
 * Simple orbit camera controller.
 */
export interface OrbitController {
  radius: number;
  azimuth: number;    // horizontal angle (radians)
  elevation: number;  // vertical angle (radians)
  target: Vec3;
  update(camera: Camera): void;
  rotate(deltaAzimuth: number, deltaElevation: number): void;
  zoom(delta: number): void;
}

export function createOrbitController(
  radius = 5,
  azimuth = 0,
  elevation = 0.5,
): OrbitController {
  const controller: OrbitController = {
    radius,
    azimuth,
    elevation,
    target: [0, 0, 0],

    update(camera: Camera): void {
      const clampedElev = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, controller.elevation));
      const x = controller.target[0] + controller.radius * Math.cos(clampedElev) * Math.sin(controller.azimuth);
      const y = controller.target[1] + controller.radius * Math.sin(clampedElev);
      const z = controller.target[2] + controller.radius * Math.cos(clampedElev) * Math.cos(controller.azimuth);

      camera.position = [x, y, z];
      camera.target = [...controller.target];
      camera.update();
    },

    rotate(deltaAzimuth: number, deltaElevation: number): void {
      controller.azimuth += deltaAzimuth;
      controller.elevation += deltaElevation;
    },

    zoom(delta: number): void {
      controller.radius = Math.max(0.5, controller.radius + delta);
    },
  };

  return controller;
}
