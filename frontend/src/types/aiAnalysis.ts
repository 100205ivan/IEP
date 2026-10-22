import type { AbilityDomain } from './assessmentAnalysis'

export interface SelectedEvidence {
  assessmentRecordId: string
  assessmentRecordTitle: string
  evidence: Array<{ evidenceId?: string; content: string }>
}

export interface FollowUpAnswer {
  questionId: string
  selectedOptions: string[]
  otherText?: string
}

export interface AIAnalysisRequest {
  domain: AbilityDomain
  teacherInput: {
    abilityDescription: string
    classroomImpact: string
    otherObservation: string
    currentNeedsAssessment: string
  }
  selectedEvidence: SelectedEvidence[]
  followUpAnswers: FollowUpAnswer[]
}

export interface FollowUpQuestion {
  id: string
  target: string
  question: string
  type: 'single_choice' | 'multiple_choice' | 'text'
  options: string[]
  allowOther: boolean
}

export interface AIAnalysisResult {
  status: 'needs_more_information' | 'ready'
  missingInformation: string[]
  followUpQuestions: FollowUpQuestion[]
  analysis: {
    currentAbilityDescription: string
    educationalNeeds: string
    suggestedObjectiveDescription: string | null
  } | null
  usedEvidence: Array<{ assessmentRecordId: string; evidenceIds: string[] }>
}
