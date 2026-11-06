import type { CptMetrics, CptResults, CptTrial } from '../../../types/gameAssessment'

// CPT-X as in Kanaka et al. (2008): 400 digits 1–9, target 7 at 20% (80),
// 1500 ± 500 ms per stimulus (about 13 min 20 s in total).
export const TOTAL_TRIALS = 400
export const TARGET_RATIO = .20
/** A press sooner than this after onset is anticipatory (a "cancellation"). */
export const CANCEL_MS = 150
export const TARGET_NUMBER = 7
export const PRACTICE_TRIALS = 10
export const PRACTICE_TARGETS = 3
export const STIMULUS_MIN_MS = 1000
export const STIMULUS_MAX_MS = 2000

export function buildStimuli(total: number, targetCount: number): number[] {
  const nonTargetCount = total - targetCount
  if (targetCount > Math.ceil(total / 2)) throw new Error('目標數過多，無法避免相鄰的相同數字。')
  const gaps: number[] = Array(targetCount + 1).fill(0)
  for (let i = 1; i < targetCount; i++) gaps[i] = 1
  let remainingNonTargets = nonTargetCount - Math.max(0, targetCount - 1)
  while (remainingNonTargets-- > 0) gaps[Math.floor(Math.random() * gaps.length)]++
  const stimuli: number[] = []
  const nonTargets = Array.from({ length: 9 }, (_, i) => i + 1).filter(n => n !== TARGET_NUMBER)
  for (let gapIndex = 0; gapIndex < gaps.length; gapIndex++) {
    for (let i = 0; i < gaps[gapIndex]; i++) {
      const previous = stimuli[stimuli.length - 1]
      const allowed = nonTargets.filter(n => n !== previous)
      stimuli.push(allowed[Math.floor(Math.random() * allowed.length)])
    }
    if (gapIndex < targetCount) stimuli.push(TARGET_NUMBER)
  }
  return stimuli
}

export function randomDuration() {
  return Math.round(STIMULUS_MIN_MS + Math.random() * (STIMULUS_MAX_MS - STIMULUS_MIN_MS))
}

/** Inverse standard normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
export function inverseNormal(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-.007784894002430293, -.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [.007784695709041462, .3224671290700398, 2.445134137142996, 3.754408661907416]
  const low = .02425
  if (p < low) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) }
  if (p > 1 - low) return -inverseNormal(1 - p)
  const q = p - .5, r = q * q
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/** The Kanaka et al. (2008) parameters. d′ = z(Hit) − z(False) and
 * lnβ = ln(φ(z(Hit)) / φ(z(False))); rates of exactly 0 or 1 use the
 * standard 1/(2N) correction so both stay finite. */
export function summarizeTrials(trials: CptTrial[]): CptMetrics {
  const targets = trials.filter(t => t.isTarget), nonTargets = trials.filter(t => !t.isTarget)
  const hits = trials.filter(t => t.hit), omissions = trials.filter(t => t.omission), commissions = trials.filter(t => t.commission)
  const targetCancels = targets.filter(t => t.anticipatory).length, nonTargetCancels = nonTargets.filter(t => t.anticipatory).length
  const rts = hits.map(t => t.reactionTime!)
  const mean = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0
  const sd = rts.length ? Math.sqrt(rts.reduce((sum, v) => sum + (v - mean) ** 2, 0) / rts.length) : 0
  const hitRate = targets.length ? hits.length / targets.length : 0
  const falseAlarmRate = nonTargets.length ? (nonTargetCancels + commissions.length) / nonTargets.length : 0
  const bounded = (rate: number, n: number) => Math.min(1 - 1 / (2 * n), Math.max(1 / (2 * n), rate))
  const zHit = targets.length ? inverseNormal(bounded(hitRate, targets.length)) : 0
  const zFalse = nonTargets.length ? inverseNormal(bounded(falseAlarmRate, nonTargets.length)) : 0
  return {
    hitRate,
    omissionCount: omissions.length, omissionRate: targets.length ? omissions.length / targets.length : 0,
    commissionCount: commissions.length, commissionRate: nonTargets.length ? commissions.length / nonTargets.length : 0,
    meanReactionTime: mean, reactionTimeSD: sd,
    targetCancelCount: targetCancels, nonTargetCancelCount: nonTargetCancels, falseAlarmRate,
    cvrt: mean ? sd / mean * 100 : 0,
    dPrime: zHit - zFalse,
    lnBeta: (zFalse ** 2 - zHit ** 2) / 2,
  }
}

export function rateLabel(z: number) {
  const direction = z >= 0 ? '高於' : '低於'
  const amount = Math.abs(z).toFixed(1)
  if (Math.abs(z) < .5) return '與同齡研究平均接近'
  return `${direction}同齡研究平均 ${amount} SD`
}

export type CptPhase = 'practice' | 'test'
export interface CptFrame { phase: CptPhase; index: number; total: number; stimulus: number }
interface Callbacks {
  onTrial: (frame: CptFrame) => void
  onFeedback: (message: string, type: 'good' | 'bad') => void
  onPracticeComplete: () => void
  onTestComplete: (result: CptResults) => void
}

// Event-driven, like the HTML sequence: responding never advances a trial.
// Refs in CptGame keep this controller independent of React render cycles.
export class CptSession {
  private trials: CptTrial[] = []
  private currentTrial: CptTrial | null = null
  private trialTimer: ReturnType<typeof setTimeout> | undefined
  private active = false
  private phase: CptPhase = 'practice'
  private testStartedAt = 0
  private callbacks: Callbacks
  private testTrials: number
  private testFeedback: boolean

  /** The demo uses a short test with practice-style feedback. */
  constructor(callbacks: Callbacks, options: { testTrials?: number; testFeedback?: boolean } = {}) {
    this.callbacks = callbacks
    this.testTrials = options.testTrials ?? TOTAL_TRIALS
    this.testFeedback = options.testFeedback ?? false
  }

  private get showFeedback() { return this.phase === 'practice' || this.testFeedback }

  reset() {
    clearTimeout(this.trialTimer)
    this.trials = []
    this.currentTrial = null
    this.active = false
    this.testStartedAt = 0
  }

  beginPractice() {
    this.reset()
    this.phase = 'practice'
    this.runSequence(buildStimuli(PRACTICE_TRIALS, PRACTICE_TARGETS))
  }

  beginTest() {
    this.phase = 'test'
    this.trials = []
    this.testStartedAt = Date.now()
    this.runSequence(buildStimuli(this.testTrials, Math.round(this.testTrials * TARGET_RATIO)))
  }

  respond() {
    const trial = this.currentTrial
    if (!this.active || !trial || trial.responded) return
    trial.responded = true
    trial.reactionTime = Math.round(performance.now() - trial.startTime)
    if (trial.reactionTime < CANCEL_MS) {
      // Too fast to have seen the digit: counted apart, as in the paper.
      trial.anticipatory = true
      if (this.showFeedback) this.callbacks.onFeedback('太快了！看清楚數字再按喔！', 'bad')
    } else if (trial.isTarget) {
      trial.hit = true
      if (this.showFeedback) this.callbacks.onFeedback('正確！你抓到 7 了！', 'good')
    } else {
      trial.commission = true
      if (this.showFeedback) this.callbacks.onFeedback('誤按：這不是 7 喔！', 'bad')
    }
  }

  private runSequence(stimuli: number[]) {
    let index = 0
    const next = () => {
      if (index >= stimuli.length) {
        if (this.phase === 'practice') this.callbacks.onPracticeComplete()
        else {
          this.active = false
          const testFinishedAt = Date.now()
          this.callbacks.onTestComplete({
            testStartedAt: this.testStartedAt, testFinishedAt,
            durationMs: testFinishedAt - this.testStartedAt,
            metrics: summarizeTrials(this.trials), trials: this.trials,
          })
        }
        return
      }
      this.startTrial(stimuli[index], index + 1, stimuli.length, () => { index++; next() })
    }
    next()
  }

  private startTrial(stimulus: number, index: number, total: number, done: () => void) {
    this.active = true
    const trial: CptTrial = {
      trialIndex: index, stimulus, isTarget: stimulus === TARGET_NUMBER,
      responded: false, hit: false, omission: false, commission: false,
      reactionTime: null, startTime: performance.now(),
    }
    this.currentTrial = trial
    this.trials.push(trial)
    // onTrial synchronously commits the stimulus before scheduling its timeout,
    // preserving the HTML order: timestamp -> DOM stimulus -> setTimeout.
    this.callbacks.onTrial({ phase: this.phase, index, total, stimulus })
    this.trialTimer = setTimeout(() => {
      let message: [string, 'good' | 'bad'] | null = null
      if (!trial.responded) {
        if (trial.isTarget) {
          trial.omission = true
          message = ['漏按：剛剛的 7 要按下喔！', 'bad']
        } else message = ['正確，其他數字不用按！', 'good']
      }
      this.active = false
      done()
      // After done(): the next number clears feedback when it appears, so a
      // message about the number that just ended is shown alongside the next one.
      if (message && this.showFeedback) this.callbacks.onFeedback(...message)
    }, randomDuration())
  }
}
