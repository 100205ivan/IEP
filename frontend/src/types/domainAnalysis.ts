export type DomainKey = 'sensory' | 'perceptualMotor' | 'selfCare' | 'cognitive' | 'communication' | 'socialEmotional' | 'academicLearning'
export type DomainAnalysisSource = 'document' | 'monkey' | 'cpt' | 'manual'
export interface DomainAnalysisReference { source: DomainAnalysisSource; text: string }
export interface DomainAnalysisQuestionOption { id: string; label: string; semanticValue: string }
export interface DomainAnalysisQuestion { id: string; category: string; question: string; reason: string; type: 'single' | 'multiple'; options: DomainAnalysisQuestionOption[]; allowOther: boolean; required: boolean }
export interface DomainAnalysisResult {
  domain: DomainKey
  completeness: { sufficient: boolean; missingItems: string[]; reasons: string[] }
  questions: DomainAnalysisQuestion[]
  professionalCurrentStatus: string | null
  classAdaptationImpact: string | null
  educationNeeds: string | null
  evidence: { source: 'teacher_observation' | 'assessment_reference' | 'supplemental_answer'; statement: string }[]
  warnings: string[]
  smartGoalDraft: { baseline: string | null; expectedChange: string | null; condition: string | null; timeframe: string | null; incomplete: boolean } | null
}
export interface DomainAnalysisPayload { domain: DomainKey; domainLabel: string; selections: Record<string, string[]>; details: Record<string, string>; references: DomainAnalysisReference[]; supplementalAnswers?: { questionId: string; selectedOptionIds: string[]; otherText?: string; skipped?: boolean }[] }
