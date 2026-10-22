import { useState, type ReactNode } from 'react'
import type { AssessmentRecord } from '../components/iep/AbilityAssessment'
import type { StoredDocumentAnalysis } from '../types/assessmentAnalysis'
import { AssessmentRecordsContext } from './assessmentRecordsStore'

export function AssessmentRecordsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  const [documentAnalyses, setDocumentAnalyses] = useState<StoredDocumentAnalysis[]>([])
  return <AssessmentRecordsContext.Provider value={{ records, setRecords, documentAnalyses, setDocumentAnalyses, studentName: '王小明', schoolYear: '115', semester: '第一學期' }}>{children}</AssessmentRecordsContext.Provider>
}
