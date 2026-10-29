export type AssessmentSource = 'manual' | 'document' | 'monkey' | 'cpt'

export interface AssessmentRecord {
  id: string
  assessmentDate: string
  assessmentType: string
  otherAssessmentType: string
  assessmentTool: string
  evaluator: string
  summary: string
  source: AssessmentSource
  createdAt?: string
  updatedAt?: string
}

export interface ManualAssessmentPayload {
  assessmentDate: string
  assessmentType: string
  otherAssessmentType: string
  assessmentTool: string
  evaluator: string
  summary: string
}
