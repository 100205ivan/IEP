import { useCallback, useRef, useState, type ReactNode, type SetStateAction } from 'react'
import type { AssessmentRecord } from '../types/assessmentRecord'
import type { StoredDocumentAnalysis } from '../types/assessmentAnalysis'
import { AssessmentRecordsContext, type AssessmentScope } from './assessmentRecordsStore'

type ScopeState = AssessmentScope & { studentName: string; schoolYear: string; semester: string }
const initialScope: ScopeState = { studentId: null, iepId: null, studentName: '', schoolYear: '', semester: '年度 IEP' }
const sameScope = (left: AssessmentScope, right: AssessmentScope) => left.studentId === right.studentId && left.iepId === right.iepId

export function AssessmentRecordsProvider({ children }: { children: ReactNode }) {
  const [manualRecords, setManualRecords] = useState<AssessmentRecord[]>([])
  const [transientRecords, setTransientRecords] = useState<AssessmentRecord[]>([])
  const [documentAnalyses, setDocumentAnalyses] = useState<StoredDocumentAnalysis[]>([])
  const [scope, setScope] = useState<ScopeState>(initialScope)
  const scopeRef = useRef<ScopeState>(initialScope)
  const isCurrentScope = useCallback((target: AssessmentScope) => sameScope(scopeRef.current, target), [])
  const resetForIep = useCallback((target: AssessmentScope) => {
    const next: ScopeState = { ...target, studentName: '', schoolYear: '', semester: '年度 IEP' }
    scopeRef.current = next
    setManualRecords([])
    setTransientRecords([])
    setDocumentAnalyses([])
    setScope(next)
  }, [])
  const updateForCurrentScope = useCallback(<T,>(target: AssessmentScope, setter: (update: SetStateAction<T>) => void, update: SetStateAction<T>) => {
    if (!sameScope(scopeRef.current, target)) return false
    setter(update)
    return true
  }, [])
  const updateManualRecords = useCallback((target: AssessmentScope, update: SetStateAction<AssessmentRecord[]>) => updateForCurrentScope(target, setManualRecords, update), [updateForCurrentScope])
  const updateTransientRecords = useCallback((target: AssessmentScope, update: SetStateAction<AssessmentRecord[]>) => updateForCurrentScope(target, setTransientRecords, update), [updateForCurrentScope])
  const updateDocumentAnalyses = useCallback((target: AssessmentScope, update: SetStateAction<StoredDocumentAnalysis[]>) => updateForCurrentScope(target, setDocumentAnalyses, update), [updateForCurrentScope])
  const updateScopeInfo = useCallback((target: AssessmentScope, studentName: string, schoolYear: string, semester: string) => {
    if (!sameScope(scopeRef.current, target)) return
    const next = { ...scopeRef.current, studentName, schoolYear, semester }
    scopeRef.current = next
    setScope(next)
  }, [])
  return <AssessmentRecordsContext.Provider value={{ manualRecords, transientRecords, documentAnalyses, studentName: scope.studentName, schoolYear: scope.schoolYear, semester: scope.semester, activeStudentId: scope.studentId, activeIepId: scope.iepId, resetForIep, isCurrentScope, updateManualRecords, updateTransientRecords, updateDocumentAnalyses, updateScopeInfo }}>{children}</AssessmentRecordsContext.Provider>
}
