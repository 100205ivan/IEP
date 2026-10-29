import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAssessmentRecords } from '../../context/useAssessmentRecords'
import { createGameAssessment } from '../../services/assessmentRecordsApi'
import type { GameAssessmentPayload } from '../../types/gameAssessment'

type Props = { result: GameAssessmentPayload; tool: string }

export function GameAssessmentImport({ result, tool }: Props) {
  const [open, setOpen] = useState(false)
  const [importedResultId, setImportedResultId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { studentId: routeStudentId, iepId: routeIepId } = useParams()
  const { updateManualRecords, activeStudentId, activeIepId, studentName, schoolYear, semester } = useAssessmentRecords()
  const navigate = useNavigate()
  const scope = { studentId: routeStudentId ?? activeStudentId, iepId: routeIepId ?? activeIepId }
  const canImport = Boolean(scope.iepId)
  const imported = importedResultId === result.resultId
  const returnToIep = scope.studentId && scope.iepId ? `/students/${scope.studentId}/ieps/${scope.iepId}?subTab=ability-record` : '/iep?subTab=ability-record'

  const confirm = async () => {
    if (!scope.iepId || saving) return
    setSaving(true); setError('')
    try {
      const saved = await createGameAssessment(scope.iepId, result)
      updateManualRecords(scope, current => current.some(record => record.id === saved.record.id) ? current : [...current, saved.record])
      setImportedResultId(result.resultId)
      setOpen(false)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '匯入遊戲評量紀錄失敗。')
    } finally { setSaving(false) }
  }

  return <>
    <div className="game-import-info">目前評量學生：{studentName || '未選擇學生'} IEP：{schoolYear || '—'} 學年度 {semester}</div>
    {!canImport && <p className="game-import-error" role="alert">請先儲存學生與 IEP，才能永久匯入遊戲評量紀錄。</p>}
    <button type="button" className="primary-btn" disabled={imported || !canImport} onClick={() => { setError(''); setOpen(true) }}>{imported ? '✓ 已匯入 IEP 評量紀錄' : '匯入 IEP 評量紀錄'}</button>
    {imported && <button type="button" className="text" onClick={() => navigate(returnToIep)}>返回 IEP 評量紀錄</button>}
    {open && <Dialog onClose={() => !saving && setOpen(false)} onConfirm={confirm} student={studentName || '目前學生'} date={result.assessmentDate} tool={tool} summary={result.summary} saving={saving} error={error} />}
  </>
}

function Dialog({ onClose, onConfirm, student, date, tool, summary, saving, error }: { onClose: () => void; onConfirm: () => Promise<void>; student: string; date: string; tool: string; summary: string; saving: boolean; error: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialogNode = ref.current; dialogNode?.showModal(); return () => dialogNode?.close() }, [])
  return <dialog ref={ref} className="game-import-dialog" onCancel={event => { event.preventDefault(); if (!saving) onClose() }}><h2>匯入 IEP 評量紀錄</h2><p>評量學生：{student}</p><p>評量日期：{date}</p><p>評量工具：{tool}</p><p>評量摘要：{summary}</p>{error && <p className="game-import-error" role="alert">{error}</p>}<footer><button type="button" disabled={saving} onClick={onClose}>取消</button><button type="button" disabled={saving} onClick={() => { void onConfirm() }}>{saving ? '匯入中…' : '確認匯入'}</button></footer></dialog>
}
