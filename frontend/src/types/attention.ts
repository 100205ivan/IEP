export type AttentionPhase = 'listening' | 'answering' | 'cpt'
export type HeadObservation = 'forward' | 'turned' | 'unknown'
export type ExpressionLabel = 'angry' | 'disgust' | 'fear' | 'happy' | 'sad' | 'surprise' | 'neutral' | 'contempt' | 'uncertain'
export interface PrototypeReport {
  model: 'eyeep-vision-prototypes-v1'
  available: boolean
  modelIds?: { emotion: string }
  sampleCount: number
  expressionCounts: Record<ExpressionLabel, number>
}
export interface PrototypePrediction {
  emotion: { label: ExpressionLabel; confidence: number }
}

export interface AttentionDurations {
  durationMs: number
  forwardMs: number
  turnedMs: number
  unknownMs: number
}

/** Head orientation observations only; not an attention score or gaze location. */
export interface AttentionReport extends AttentionDurations {
  prototypes?: PrototypeReport
  version: 1
  model: 'mediapipe-face-landmarker'
  modelVersion: string
  startedAt: string
  calibrated: boolean
  yawThresholdDegrees: number
  pitchThresholdDegrees: number
  phases: Partial<Record<AttentionPhase, AttentionDurations>>
}

/** A detected face's extent as fractions (0–1) of the camera frame. */
export interface FaceBox { x: number; y: number; width: number; height: number }

export type TrackerMessage =
  | { type: 'loading'; stage: string }
  | { type: 'ready'; prototypesAvailable?: boolean; prototypeModelIds?: { emotion: string } }
  | { type: 'error'; message: string }
  | { type: 'sample'; capturedAt?: number; faces: number; yaw: number | null; pitch: number | null; prototypes?: PrototypePrediction; boxes?: FaceBox[] }
