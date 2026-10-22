import { useContext } from 'react'
import { AssessmentRecordsContext } from './assessmentRecordsStore'

export function useAssessmentRecords() {
  const value = useContext(AssessmentRecordsContext)
  if (!value) throw new Error('AssessmentRecordsProvider is required')
  return value
}
