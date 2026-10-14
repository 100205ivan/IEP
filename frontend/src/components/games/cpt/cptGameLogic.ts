import type { CptMetrics, CptResults, CptTrial } from '../../../types/gameAssessment'

export const TOTAL_TRIALS = 100
export const TARGET_RATIO = .20
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

export function summarizeTrials(trials: CptTrial[]): CptMetrics {
  const targets = trials.filter(t => t.isTarget), nonTargets = trials.filter(t => !t.isTarget)
  const hits = trials.filter(t => t.hit), omissions = trials.filter(t => t.omission), commissions = trials.filter(t => t.commission)
  const rts = hits.map(t => t.reactionTime!)
  const mean = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0
  const sd = rts.length ? Math.sqrt(rts.reduce((sum, v) => sum + (v - mean) ** 2, 0) / rts.length) : 0
  return {
    hitRate: hits.length / targets.length,
    omissionCount: omissions.length, omissionRate: omissions.length / targets.length,
    commissionCount: commissions.length, commissionRate: commissions.length / nonTargets.length,
    meanReactionTime: mean, reactionTimeSD: sd,
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

  constructor(callbacks: Callbacks) { this.callbacks = callbacks }

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
    this.runSequence(buildStimuli(TOTAL_TRIALS, Math.round(TOTAL_TRIALS * TARGET_RATIO)))
  }

  respond() {
    const trial = this.currentTrial
    if (!this.active || !trial || trial.responded) return
    trial.responded = true
    trial.reactionTime = Math.round(performance.now() - trial.startTime)
    if (trial.isTarget) {
      trial.hit = true
      if (this.phase === 'practice') this.callbacks.onFeedback('正確！你抓到 7 了！', 'good')
    } else {
      trial.commission = true
      if (this.phase === 'practice') this.callbacks.onFeedback('誤按：這不是 7 喔！', 'bad')
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
      if (!trial.responded) {
        if (trial.isTarget) {
          trial.omission = true
          if (this.phase === 'practice') this.callbacks.onFeedback('漏按：看到 7 要按下喔！', 'bad')
        } else if (this.phase === 'practice') this.callbacks.onFeedback('正確，其他數字不用按！', 'good')
      }
      this.active = false
      done()
    }, randomDuration())
  }
}
