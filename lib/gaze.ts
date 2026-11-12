"use client";

/**
 * On-device eye contact estimate. Camera frames are analysed in the browser by
 * MediaPipe Face Landmarker and are never uploaded. No face template or
 * identifier is created or kept: each frame yields one boolean sample.
 */
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type P = { x: number; y: number };

function ratio(v: number, a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return hi - lo < 1e-6 ? 0.5 : (v - lo) / (hi - lo);
}

export function isLookingAtCamera(lm: P[]): boolean {
  if (lm.length < 478) return false;
  // Horizontal iris position within each eye (0..1, ~0.5 when centred).
  const rh = ratio(lm[468].x, lm[33].x, lm[133].x);
  const lh = ratio(lm[473].x, lm[362].x, lm[263].x);
  // Vertical iris position between eyelids.
  const rv = ratio(lm[468].y, lm[159].y, lm[145].y);
  const lv = ratio(lm[473].y, lm[386].y, lm[374].y);
  // Head yaw proxy: nose tip relative to the cheek landmarks.
  const yaw = ratio(lm[1].x, lm[234].x, lm[454].x);
  const h = (rh + lh) / 2;
  const v = (rv + lv) / 2;
  return h > 0.36 && h < 0.64 && v > 0.3 && v < 0.7 && yaw > 0.34 && yaw < 0.66;
}

export class GazeTracker {
  private landmarker: FaceLandmarker | null = null;
  private raf = 0;
  private last = 0;
  private stopped = false;
  private active = false;

  constructor(
    private video: HTMLVideoElement,
    private onSample: (looking: boolean) => void,
  ) {}

  async init() {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
    });
  }

  /** Only sample while the participant is answering. */
  setActive(active: boolean) {
    this.active = active;
  }

  start() {
    const tick = (t: number) => {
      if (this.stopped) return;
      this.raf = requestAnimationFrame(tick);
      if (!this.landmarker || !this.active || this.video.readyState < 2) return;
      if (t - this.last < 200) return; // ~5 samples per second
      this.last = t;
      try {
        const res = this.landmarker.detectForVideo(this.video, t);
        const lm = res.faceLandmarks?.[0];
        this.onSample(lm ? isLookingAtCamera(lm) : false);
      } catch {
        /* skip frame */
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.landmarker?.close();
    this.landmarker = null;
  }
}
