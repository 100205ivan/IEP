export type AbilityDomain =
  | 'sensory'
  | 'perceptualMotor'
  | 'selfCare'
  | 'cognitive'
  | 'communication'
  | 'socialEmotional'
  | 'academicLearning'

export const ABILITY_DOMAIN_LABELS: Record<AbilityDomain, string> = {
  sensory: '感官功能',
  perceptualMotor: '知覺動作與行動能力',
  selfCare: '生活自理',
  cognitive: '認知能力',
  communication: '溝通能力',
  socialEmotional: '情緒與社會行為',
  academicLearning: '學業學習能力',
}

export const ABILITY_DOMAINS: readonly AbilityDomain[] = [
  'sensory',
  'perceptualMotor',
  'selfCare',
  'cognitive',
  'communication',
  'socialEmotional',
  'academicLearning',
]

export interface DocumentEvidence {
  id: string
  content: string
}

export interface DomainAnalysis {
  domain: AbilityDomain
  hasEvidence: boolean
  summary: string | null
  evidence: DocumentEvidence[]
}

export interface DocumentAnalysisResult {
  id: string
  documentInfo: {
    documentType: string | null
    assessmentDate: string | null
    assessmentTools: string[]
    evaluator: string | null
  }
  overallSummary: string
  domains: Record<AbilityDomain, DomainAnalysis>
  warnings: string[]
}

export interface StoredDocumentAnalysis extends DocumentAnalysisResult {
  assessmentRecordId: string
  analyzedAt?: string
  createdAt?: string
}
