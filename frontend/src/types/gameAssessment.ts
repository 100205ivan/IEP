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
}

export interface CptMetrics {
  hitRate: number
  omissionCount: number
  omissionRate: number
  commissionCount: number
  commissionRate: number
  meanReactionTime: number
  reactionTimeSD: number
}

export interface CptResults {
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
