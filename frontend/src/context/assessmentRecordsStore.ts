import { createContext, type SetStateAction } from 'react'
import type { AssessmentRecord } from '../types/assessmentRecord'
import type { StoredDocumentAnalysis } from '../types/assessmentAnalysis'

export type AssessmentScope = { studentId: string | null; iepId: string | null }

export type AssessmentRecordsContextValue = {
  manualRecords: AssessmentRecord[]
  transientRecords: AssessmentRecord[]
  documentAnalyses: StoredDocumentAnalysis[]
  studentName: string
  schoolYear: string
  semester: string
  activeStudentId: string | null
  activeIepId: string | null
  resetForIep: (scope: AssessmentScope) => void
  isCurrentScope: (scope: AssessmentScope) => boolean
  updateManualRecords: (scope: AssessmentScope, update: SetStateAction<AssessmentRecord[]>) => boolean
  updateTransientRecords: (scope: AssessmentScope, update: SetStateAction<AssessmentRecord[]>) => boolean
  updateDocumentAnalyses: (scope: AssessmentScope, update: SetStateAction<StoredDocumentAnalysis[]>) => boolean
  updateScopeInfo: (scope: AssessmentScope, studentName: string, schoolYear: string, semester: string) => void
}

export const AssessmentRecordsContext = createContext<AssessmentRecordsContextValue | null>(null)
