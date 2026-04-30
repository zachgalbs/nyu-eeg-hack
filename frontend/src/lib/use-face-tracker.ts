import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// MediaPipe FaceLandmarker (478 landmarks) — eye-aspect-ratio indices.
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 390, 374];
const EAR_CLOSED_THRESHOLD = 0.2;
const HEAD_YAW_LIMIT_DEG = 25;
const HEAD_PITCH_LIMIT_DEG = 30;

const TARGET_FPS = 10;
const MIN_FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

export type DistractionKind = 'no_face' | 'eyes_closed' | 'head_turned';

export interface UseFaceTrackerOptions {
  enabled: boolean;
  noFaceThresholdMs?: number;
  eyesClosedThresholdMs?: number;
  headTurnedThresholdMs?: number;
  onSuspectedDistraction: (kind: DistractionKind, durationMs: number) => void;
}

export interface FaceTrackerStatus {
  ready: boolean;
  error: string | null;
  facePresent: boolean;
}

let cachedLandmarker: Promise<FaceLandmarker> | null = null;

function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (cachedLandmarker) return cachedLandmarker;
  cachedLandmarker = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    });
  })();
  cachedLandmarker.catch(() => {
    cachedLandmarker = null;
  });
  return cachedLandmarker;
}

function eyeAspectRatio(lm: { x: number; y: number }[], idx: number[]): number {
  const dist = (a: number, b: number) =>
    Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
  const v1 = dist(idx[1], idx[5]);
  const v2 = dist(idx[2], idx[4]);
  const h = dist(idx[0], idx[3]);
  return h > 0 ? (v1 + v2) / (2 * h) : 0;
}

// MediaPipe transformation matrix is column-major 4x4.
function headPoseDegFromMatrix(matrix: ArrayLike<number>): {
  pitch: number;
  yaw: number;
  roll: number;
} {
  const r = (i: number, j: number) => matrix[j * 4 + i];
  const sy = Math.sqrt(r(0, 0) ** 2 + r(1, 0) ** 2);
  const singular = sy < 1e-6;
  let pitch: number;
  let yaw: number;
  let roll: number;
  if (!singular) {
    pitch = Math.atan2(r(2, 1), r(2, 2));
    yaw = Math.atan2(-r(2, 0), sy);
    roll = Math.atan2(r(1, 0), r(0, 0));
  } else {
    pitch = Math.atan2(-r(1, 2), r(1, 1));
    yaw = Math.atan2(-r(2, 0), sy);
    roll = 0;
  }
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  return { pitch: toDeg(pitch), yaw: toDeg(yaw), roll: toDeg(roll) };
}

export function useFaceTracker(
  videoRef: RefObject<HTMLVideoElement | null>,
  options: UseFaceTrackerOptions
): FaceTrackerStatus {
  const {
    enabled,
    noFaceThresholdMs = 10_000,
    eyesClosedThresholdMs = 5_000,
    headTurnedThresholdMs = 5_000,
    onSuspectedDistraction,
  } = options;

  const [status, setStatus] = useState<FaceTrackerStatus>({
    ready: false,
    error: null,
    facePresent: false,
  });

  // Latest callback in a ref so the rAF loop never re-binds.
  const callbackRef = useRef(onSuspectedDistraction);
  callbackRef.current = onSuspectedDistraction;

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let rafId: number | null = null;
    let landmarker: FaceLandmarker | null = null;

    const startMs = {
      no_face: null as number | null,
      eyes_closed: null as number | null,
      head_turned: null as number | null,
    };
    const fired = { no_face: false, eyes_closed: false, head_turned: false };
    let lastDetectTs = 0;
    let lastFacePresent = false;

    const handleSignal = (
      kind: DistractionKind,
      active: boolean,
      thresholdMs: number,
      now: number
    ) => {
      if (active) {
        if (startMs[kind] == null) startMs[kind] = now;
        const duration = now - (startMs[kind] ?? now);
        if (!fired[kind] && duration >= thresholdMs) {
          fired[kind] = true;
          callbackRef.current(kind, duration);
        }
      } else {
        startMs[kind] = null;
        fired[kind] = false;
      }
    };

    const tick = () => {
      if (stopped) return;
      rafId = window.requestAnimationFrame(tick);

      const video = videoRef.current;
      if (!video || !landmarker) return;
      if (video.readyState < 2 || video.paused || video.ended) return;
      if (video.videoWidth === 0) return;

      const perfNow = performance.now();
      if (perfNow - lastDetectTs < MIN_FRAME_INTERVAL_MS) return;
      lastDetectTs = perfNow;

      let result;
      try {
        result = landmarker.detectForVideo(video, perfNow);
      } catch {
        return;
      }

      const wallNow = Date.now();
      const facePresent =
        !!result.faceLandmarks && result.faceLandmarks.length > 0;

      let eyesClosed = false;
      let headTurned = false;

      if (facePresent) {
        const lm = result.faceLandmarks[0];
        const earL = eyeAspectRatio(lm, LEFT_EYE);
        const earR = eyeAspectRatio(lm, RIGHT_EYE);
        const ear = (earL + earR) / 2;
        eyesClosed = ear < EAR_CLOSED_THRESHOLD;

        const matrix = result.facialTransformationMatrixes?.[0]?.data;
        if (matrix) {
          const pose = headPoseDegFromMatrix(matrix);
          headTurned =
            Math.abs(pose.yaw) > HEAD_YAW_LIMIT_DEG ||
            Math.abs(pose.pitch) > HEAD_PITCH_LIMIT_DEG;
        }
      }

      handleSignal('no_face', !facePresent, noFaceThresholdMs, wallNow);
      handleSignal('eyes_closed', facePresent && eyesClosed, eyesClosedThresholdMs, wallNow);
      handleSignal('head_turned', facePresent && headTurned, headTurnedThresholdMs, wallNow);

      if (facePresent !== lastFacePresent) {
        lastFacePresent = facePresent;
        setStatus((s) => ({ ...s, facePresent }));
      }
    };

    loadFaceLandmarker()
      .then((lm) => {
        if (stopped) return;
        landmarker = lm;
        setStatus({ ready: true, error: null, facePresent: false });
        rafId = window.requestAnimationFrame(tick);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({ ready: false, error: msg, facePresent: false });
      });

    return () => {
      stopped = true;
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, [enabled, videoRef, noFaceThresholdMs, eyesClosedThresholdMs, headTurnedThresholdMs]);

  return status;
}
