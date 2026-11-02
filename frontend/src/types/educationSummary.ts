export interface EducationSummaryDraft {
  strengthNotes: string
  weaknessNotes: string
  overallNeeds: string
  warnings: string[]
}

export type SummaryField = 'strengthNotes' | 'weaknessNotes' | 'overallNeeds'
