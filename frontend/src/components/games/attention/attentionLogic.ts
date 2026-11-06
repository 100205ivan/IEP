import type { AttentionDurations, AttentionPhase, AttentionReport, ExpressionLabel, HeadObservation, PrototypeReport } from '../../../types/attention'

export const MODEL_VERSION = '0.10.32'
export const YAW_THRESHOLD = 25
export const PITCH_THRESHOLD = 20
export const SAMPLE_FRESH_MS = 700
const empty = (): AttentionDurations => ({ durationMs: 0, forwardMs: 0, turnedMs: 0, unknownMs: 0 })
export function emptyPrototypeReport(): PrototypeReport {
  return { model: 'eyeep-vision-prototypes-v1', available: false, sampleCount: 0,
    expressionCounts: { angry: 0, disgust: 0, fear: 0, happy: 0, sad: 0, surprise: 0, neutral: 0, contempt: 0, uncertain: 0 } }
}

// Short names for summaries, where the 表情 heading already says what is counted.
export const expressionShortLabels: Record<ExpressionLabel, string> = { angry: '生氣', disgust: '厭惡', fear: '害怕', happy: '開心', sad: '難過', surprise: '驚訝', neutral: '中性', contempt: '輕蔑', uncertain: '不確定' }

/** Non-zero classes only, most frequent first: e.g. 中性 134 次、難過 2 次. */
export function countsText<T extends string>(counts: Record<T, number>, labels: Record<T, string>) {
  return (Object.entries(counts) as [T, number][]).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).map(([label, count]) => `${labels[label]} ${count} 次`).join('、')
}

/** One sentence for the assessment summary: what a teacher needs, with zero
 * counts left out and the caveat stated once. Details stay in the result. */
export function attentionSummaryText(report?: AttentionReport) {
  if (!report) return ''
  const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} 秒`
  const parts = [report.calibrated ? `面向螢幕 ${seconds(report.forwardMs)}、轉頭 ${seconds(report.turnedMs)}、無法判讀 ${seconds(report.unknownMs)}` : '未完成正面校準，無法判讀頭部朝向']
  const prototype = report.prototypes
  if (prototype?.available && prototype.sampleCount > 0) {
    const expression = countsText(prototype.expressionCounts, expressionShortLabels)
    if (expression) parts.push(`表情：${expression}`)
  }
  return ` 攝影機觀察（僅供參考，非專注度或情緒判斷）：${parts.join('；')}。`
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
