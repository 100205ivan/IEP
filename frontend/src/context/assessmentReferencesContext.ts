import { createContext, useContext } from 'react'
import type { AssessmentRecord } from '../types/assessmentRecord'
import type { StoredDocumentAnalysis } from '../types/assessmentAnalysis'
import type { StoredGameAssessmentResult } from '../types/gameAssessment'

export interface AssessmentReferences {
  records: AssessmentRecord[]
  documents: StoredDocumentAnalysis[]
  games: StoredGameAssessmentResult[]
  loading: boolean
  error: string
  retry: () => void
}

export const AssessmentReferencesContext = createContext<AssessmentReferences | null>(null)
export function useAssessmentReferences() {
  const value = useContext(AssessmentReferencesContext)
  if (!value) throw new Error('Assessment references must be used inside AssessmentReferenceProvider')
  return value
}
