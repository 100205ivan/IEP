import type { AttentionReport } from './attention'

export type MonkeyWord = '貓' | '狗' | '魚' | '月亮' | '房子' | '花' | '車子' | '蘋果' | '星星'

export interface MonkeyQuestion {
  id: number
  level: number
  sequence: MonkeyWord[]
}

export interface MonkeyQuestionResult extends MonkeyQuestion {
  correctAnswer: MonkeyWord[]
  playerAnswer: MonkeyWord[]
  correctPositions: number
  totalPositions: number
  score: number
}

export interface MonkeyResults {
  attention?: AttentionReport
  /** School grade 1–6, compared with Van de Weijer-Bergsma et al. (2016); absent from earlier age-based results. */
  grade?: number
  /** Mean of each question's proportion correct (the paper's outcome measure). */
  totalScore: number
  correctPositions: number
  totalPositions: number
  levelScores: number[]
  questionResults: MonkeyQuestionResult[]
}

export interface CptTrial {
  trialIndex: number
  stimulus: number
  isTarget: boolean
  responded: boolean
  hit: boolean
  omission: boolean
  commission: boolean
  reactionTime: number | null
  startTime: number
  /** Responded within 150 ms of onset: a cancellation, neither hit nor commission (Kanaka et al., 2008). */
  anticipatory?: boolean
}

export interface CptMetrics {
  hitRate: number
  omissionCount: number
  omissionRate: number
  commissionCount: number
  commissionRate: number
  meanReactionTime: number
  reactionTimeSD: number
  // Kanaka et al. (2008) parameters; absent from results saved before they were added.
  targetCancelCount?: number
  nonTargetCancelCount?: number
  falseAlarmRate?: number
  /** Coefficient of variation of correct-response RT, in percent. */
  cvrt?: number
  dPrime?: number
  lnBeta?: number
}

export interface CptResults {
  attention?: AttentionReport
  testStartedAt: number
  testFinishedAt: number
  durationMs: number
  metrics: CptMetrics
  trials: CptTrial[]
}

export type GameAssessmentType = 'monkey' | 'cpt'
export type GameAssessmentResult = MonkeyResults | CptResults

export interface GameAssessmentPayload {
  resultId: string
  gameType: GameAssessmentType
  assessmentDate: string
  completedAt: string
  summary: string
  age: number
  result: GameAssessmentResult
}

export interface StoredGameAssessmentResult extends GameAssessmentPayload {
  assessmentRecordId: string
  createdAt?: string
}
