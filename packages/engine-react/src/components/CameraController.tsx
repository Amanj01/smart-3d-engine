/**
 * <CameraController> — adds interactive orbit camera controls.
 */

import { useEffect, useRef } from "react";
import { createOrbitController } from "@3d-engine/core";
import { useEngine } from "../context";

export interface CameraControllerProps {
  /** Initial radius from target */
  radius?: number;

  /** Rotation speed multiplier */
  rotateSpeed?: number;

  /** Zoom speed multiplier */
  zoomSpeed?: number;

  /** Enable/disable controls */
  enabled?: boolean;
}

export function CameraController({
  radius = 5,
  rotateSpeed = 0.005,
  zoomSpeed = 0.5,
  enabled = true,
}: CameraControllerProps): null {
  const engine = useEngine();
  const controllerRef = useRef(createOrbitController(radius));

  useEffect(() => {
    controllerRef.current.radius = radius;
  }, [radius]);

  useEffect(() => {
    if (!enabled) return;

    const canvas = engine.ctx.canvas;
    const controller = controllerRef.current;
    let isDragging = false;

    function onPointerDown(e: PointerEvent): void {
      isDragging = true;
      canvas.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent): void {
      if (!isDragging) return;
      controller.rotate(
        -e.movementX * rotateSpeed,
        -e.movementY * rotateSpeed,
      );
    }

    function onPointerUp(e: PointerEvent): void {
      isDragging = false;
      canvas.releasePointerCapture(e.pointerId);
    }

    function onWheel(e: WheelEvent): void {
      e.preventDefault();
      controller.zoom(e.deltaY * zoomSpeed * 0.01);
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // Connect to frame loop
    const prevOnFrame = engine.onFrame;
    engine.onFrame = (eng, dt) => {
      prevOnFrame?.(eng, dt);
      controller.update(eng.camera);
    };

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      engine.onFrame = prevOnFrame;
    };
  }, [engine, enabled, rotateSpeed, zoomSpeed]);

  return null;
}
