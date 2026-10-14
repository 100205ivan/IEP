import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { AssessmentRecord } from '../components/iep/AbilityAssessment'

type Value = { records: AssessmentRecord[]; setRecords: Dispatch<SetStateAction<AssessmentRecord[]>>; studentName: string; schoolYear: string; semester: string }
const Context = createContext<Value | null>(null)

export function AssessmentRecordsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  return <Context.Provider value={{ records, setRecords, studentName: '王小明', schoolYear: '115', semester: '第一學期' }}>{children}</Context.Provider>
}

export function useAssessmentRecords() {
  const value = useContext(Context)
  if (!value) throw new Error('AssessmentRecordsProvider is required')
  return value
}
