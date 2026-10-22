import { createContext, type Dispatch, type SetStateAction } from 'react'
import type { AssessmentRecord } from '../components/iep/AbilityAssessment'
import type { StoredDocumentAnalysis } from '../types/assessmentAnalysis'

export type AssessmentRecordsContextValue = {
  records: AssessmentRecord[]
  setRecords: Dispatch<SetStateAction<AssessmentRecord[]>>
  documentAnalyses: StoredDocumentAnalysis[]
  setDocumentAnalyses: Dispatch<SetStateAction<StoredDocumentAnalysis[]>>
  studentName: string
  schoolYear: string
  semester: string
}

export const AssessmentRecordsContext = createContext<AssessmentRecordsContextValue | null>(null)
