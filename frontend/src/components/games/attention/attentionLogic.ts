import type { AttentionDurations, AttentionPhase, AttentionReport, HeadObservation, PrototypeReport } from '../../../types/attention'

export const MODEL_VERSION = '0.10.32'
export const YAW_THRESHOLD = 25
export const PITCH_THRESHOLD = 20
export const SAMPLE_FRESH_MS = 700
const empty = (): AttentionDurations => ({ durationMs: 0, forwardMs: 0, turnedMs: 0, unknownMs: 0 })
export function emptyPrototypeReport(): PrototypeReport {
  return { model: 'eyeep-vision-prototypes-v1', available: false, sampleCount: 0,
    expressionCounts: { angry: 0, disgust: 0, fear: 0, happy: 0, sad: 0, surprise: 0, neutral: 0, contempt: 0, uncertain: 0 },
    engagementCounts: { disengaged: 0, engaged: 0, uncertain: 0 } }
}

export function attentionSummaryText(report?: AttentionReport) {
  if (!report) return ''
  const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} 秒`
  const prototype = report.prototypes
  return ` 攝影機頭部朝向觀察：面向螢幕 ${seconds(report.forwardMs)}、轉頭 ${seconds(report.turnedMs)}、資料不足 ${seconds(report.unknownMs)}；不作為專注度分數。` + (prototype ? ` 表情／參與樣態研究原型：${prototype.sampleCount} 次取樣，表情不確定 ${prototype.expressionCounts.uncertain} 次，參與樣態不確定 ${prototype.engagementCounts.uncertain} 次。` : '')
}

export function headAngles(matrix: number[]): { yaw: number; pitch: number } | null {
  if (matrix.length !== 16 || !matrix.every(Number.isFinite)) return null
  // MediaPipe's column-major transform: the third column is the face normal.
  if (Math.hypot(matrix[8], matrix[9], matrix[10]) < .01) return null
  return {
    yaw: Math.atan2(matrix[8], matrix[10]) * 180 / Math.PI,
    pitch: Math.atan2(-matrix[9], Math.hypot(matrix[8], matrix[10])) * 180 / Math.PI,
  }
}

export function classifyHead(yaw: number, pitch: number, baseline: { yaw: number; pitch: number }): HeadObservation {
  if (![yaw, pitch, baseline.yaw, baseline.pitch].every(Number.isFinite)) return 'unknown'
  const yawDelta = Math.abs(((yaw - baseline.yaw + 540) % 360) - 180)
  return yawDelta <= YAW_THRESHOLD && Math.abs(pitch - baseline.pitch) <= PITCH_THRESHOLD ? 'forward' : 'turned'
}

/** Integrates elapsed time, not sample counts. Stale/missing observations remain unknown. */
export class AttentionRecorder {
  private lastTime: number | null = null
  private phase: AttentionPhase = 'cpt'
  private observation: HeadObservation = 'unknown'
  private observedAt = -Infinity
  private phases: Partial<Record<AttentionPhase, AttentionDurations>> = {}
  private startedAt = ''

  begin(now: number, phase: AttentionPhase, startedAt: string) {
    this.lastTime = now
    this.phase = phase
    this.observation = 'unknown'
    this.observedAt = -Infinity
    this.phases = {}
    this.startedAt = startedAt
  }

  private flush(now: number) {
    if (this.lastTime === null || now < this.lastTime) return
    const row = this.phases[this.phase] ??= empty()
    const elapsed = now - this.lastTime
    const valid = this.observation === 'unknown' ? 0 : Math.max(0, Math.min(now, this.observedAt + SAMPLE_FRESH_MS) - this.lastTime)
    row.durationMs += elapsed
    if (this.observation === 'forward') row.forwardMs += valid
    if (this.observation === 'turned') row.turnedMs += valid
    row.unknownMs += elapsed - valid
    this.lastTime = now
  }

  observe(now: number, observation: HeadObservation, capturedAt = now) {
    this.flush(now)
    this.observation = observation
    this.observedAt = Math.min(now, capturedAt)
  }

  setPhase(now: number, phase: AttentionPhase) {
    this.flush(now)
    this.phase = phase
  }

  finish(now: number, calibrated: boolean): AttentionReport {
    this.flush(now)
    this.lastTime = null
    const total = Object.values(this.phases).reduce((sum, row) => ({
      durationMs: sum.durationMs + row.durationMs, forwardMs: sum.forwardMs + row.forwardMs,
      turnedMs: sum.turnedMs + row.turnedMs, unknownMs: sum.unknownMs + row.unknownMs,
    }), empty())
    return {
      ...total, version: 1, model: 'mediapipe-face-landmarker', modelVersion: MODEL_VERSION,
      startedAt: this.startedAt, calibrated, yawThresholdDegrees: YAW_THRESHOLD,
      pitchThresholdDegrees: PITCH_THRESHOLD, phases: structuredClone(this.phases),
    }
  }
}
