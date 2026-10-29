import { useEffect, useRef, useState, type FormEvent, type ReactNode, type SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AssessmentScope } from '../../context/assessmentRecordsStore'
import { createDocumentAnalysis, createManualAssessment, deleteDocumentAnalysis, deleteGameAssessment, deleteManualAssessment, getDocumentAnalysis, getGameAssessmentResult, listPersistedAssessments, updateManualAssessment } from '../../services/assessmentRecordsApi'
import type { AssessmentRecord, AssessmentSource, ManualAssessmentPayload } from '../../types/assessmentRecord'
import type { DocumentAnalysisResult, StoredDocumentAnalysis } from '../../types/assessmentAnalysis'
import { AssessmentDocumentAnalysisDialog } from './AssessmentDocumentAnalysisDialog'
import { DocumentAnalysisResultDialog } from './DocumentAnalysisResultDialog'
import { GameAssessmentResultDialog } from './GameAssessmentResultDialog'
import type { StoredGameAssessmentResult } from '../../types/gameAssessment'

export type { AssessmentRecord, AssessmentSource } from '../../types/assessmentRecord'

const types = ['標準化測驗', '非標準化評量', '課堂觀察', '訪談', '作業／作品分析', '其他']
const labels: Record<AssessmentSource, string> = { manual: '人工紀錄', document: '評估文件', monkey: 'Monkey', cpt: 'CPT' }
const blank = (): AssessmentRecord => ({ id: '', assessmentDate: '', assessmentType: '', otherAssessmentType: '', assessmentTool: '', evaluator: '', summary: '', source: 'manual' })
type ScopedRecordUpdater = (scope: AssessmentScope, update: SetStateAction<AssessmentRecord[]>) => boolean
type ScopedDocumentUpdater = (scope: AssessmentScope, update: SetStateAction<StoredDocumentAnalysis[]>) => boolean
type Props = { studentName: string; scope: AssessmentScope; scopeActive: boolean; isCurrentScope: (scope: AssessmentScope) => boolean; manualRecords: AssessmentRecord[]; updateManualRecords: ScopedRecordUpdater; transientRecords: AssessmentRecord[]; updateTransientRecords: ScopedRecordUpdater; documentAnalyses: StoredDocumentAnalysis[]; updateDocumentAnalyses: ScopedDocumentUpdater }
const payload = (record: AssessmentRecord): ManualAssessmentPayload => ({ assessmentDate: record.assessmentDate, assessmentType: record.assessmentType, otherAssessmentType: record.otherAssessmentType, assessmentTool: record.assessmentTool, evaluator: record.evaluator, summary: record.summary })

export function AbilityAssessment({ studentName, scope, scopeActive, isCurrentScope, manualRecords, updateManualRecords, transientRecords, updateTransientRecords, documentAnalyses, updateDocumentAnalyses }: Props) {
  const [doc, setDoc] = useState(false), [edit, setEdit] = useState<AssessmentRecord | null>(null), [view, setView] = useState<AssessmentRecord | null>(null), [documentAnalysis, setDocumentAnalysis] = useState<StoredDocumentAnalysis | null>(null), [gameResult, setGameResult] = useState<StoredGameAssessmentResult | null>(null), [remove, setRemove] = useState<AssessmentRecord | null>(null)
  const [loadError, setLoadError] = useState(''), [saving, setSaving] = useState(false), [deleting, setDeleting] = useState(false), [actionError, setActionError] = useState('')
  const navigate = useNavigate()
  const records = scopeActive ? [...manualRecords, ...transientRecords] : []

  useEffect(() => {
    if (!scope.iepId) return
    let active = true
    listPersistedAssessments(scope.iepId).then((records) => {
      if (!active || !updateManualRecords(scope, records)) return []
      return Promise.allSettled(records.filter((record) => record.source === 'document').map((record) => getDocumentAnalysis(record.id)))
    }).then((results) => {
      if (!active || !isCurrentScope(scope)) return
      const analyses = results.filter((result): result is PromiseFulfilledResult<StoredDocumentAnalysis> => result.status === 'fulfilled').map((result) => result.value)
      updateDocumentAnalyses(scope, analyses)
      if (results.some((result) => result.status === 'rejected')) setLoadError('部分文件分析詳情暫時無法載入；可點選「查看」重試。')
    }).catch((reason: unknown) => {
      if (active && isCurrentScope(scope)) {
        updateManualRecords(scope, [])
        updateDocumentAnalyses(scope, [])
        setLoadError(reason instanceof Error ? reason.message : '無法載入手動評量紀錄。')
      }
    })
    return () => { active = false }
  }, [isCurrentScope, scope, updateDocumentAnalyses, updateManualRecords])

  const openRecord = async (record: AssessmentRecord) => {
    if (record.source === 'manual') { setView(record); return }
    if (record.source === 'monkey' || record.source === 'cpt') {
      if (!scope.iepId) { setActionError('找不到目前 IEP，無法載入遊戲評量結果。'); return }
      setActionError('')
      try {
        const result = await getGameAssessmentResult(record.id, scope.iepId)
        if (isCurrentScope(scope)) setGameResult(result)
      } catch (reason: unknown) { if (isCurrentScope(scope)) setActionError(reason instanceof Error ? reason.message : '無法載入完整遊戲評量結果。') }
      return
    }
    const existing = documentAnalyses.find((analysis) => analysis.assessmentRecordId === record.id)
    if (existing) { setDocumentAnalysis(existing); return }
    setActionError('')
    try {
      const analysis = await getDocumentAnalysis(record.id)
      if (updateDocumentAnalyses(scope, (current) => current.some((item) => item.assessmentRecordId === analysis.assessmentRecordId) ? current : [...current, analysis])) setDocumentAnalysis(analysis)
    } catch (reason: unknown) { if (isCurrentScope(scope)) setActionError(reason instanceof Error ? reason.message : '無法載入完整文件分析結果。') }
  }

  const saveManual = async (record: AssessmentRecord) => {
    if (!scope.iepId || !scopeActive) { setActionError('請先儲存學生與 IEP，才能建立永久評量紀錄。'); return }
    setSaving(true); setActionError('')
    try {
      const saved = record.id ? await updateManualAssessment(record.id, scope.iepId, payload(record)) : await createManualAssessment(scope.iepId, payload(record))
      if (updateManualRecords(scope, (current) => record.id ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved])) {
        setEdit(null)
      }
    } catch (reason: unknown) { if (isCurrentScope(scope)) setActionError(reason instanceof Error ? reason.message : '儲存手動評量紀錄失敗。') } finally { if (isCurrentScope(scope)) setSaving(false) }
  }
  const saveDocumentAnalysis = async (analysis: DocumentAnalysisResult) => {
    if (!scope.iepId || !scopeActive) throw new Error('請先儲存學生與 IEP，才能永久儲存文件分析結果。')
    const saved = await createDocumentAnalysis(scope.iepId, analysis)
    if (updateManualRecords(scope, (current) => [...current, saved.record])) {
      updateDocumentAnalyses(scope, (current) => [...current, saved.analysis])
      setDoc(false)
    }
  }
  const deleteRecord = async () => {
    if (!remove) return
    if (!scopeActive) return
    setDeleting(true); setActionError('')
    try {
      if (remove.source === 'manual') {
        if (!scope.iepId) throw new Error('找不到目前 IEP，無法刪除手動評量紀錄。')
        await deleteManualAssessment(remove.id, scope.iepId)
        updateManualRecords(scope, (current) => current.filter((item) => item.id !== remove.id))
      } else if (remove.source === 'document') {
        if (!scope.iepId) throw new Error('找不到目前 IEP，無法刪除 AI 評估文件。')
        await deleteDocumentAnalysis(remove.id, scope.iepId)
        updateManualRecords(scope, (current) => current.filter((item) => item.id !== remove.id))
        updateDocumentAnalyses(scope, (current) => current.filter((item) => item.assessmentRecordId !== remove.id))
      } else if (remove.source === 'monkey' || remove.source === 'cpt') {
        if (!scope.iepId) throw new Error('找不到目前 IEP，無法刪除遊戲評量紀錄。')
        await deleteGameAssessment(remove.id, scope.iepId)
        updateManualRecords(scope, (current) => current.filter((item) => item.id !== remove.id))
      } else {
        updateTransientRecords(scope, (current) => current.filter((item) => item.id !== remove.id))
        updateDocumentAnalyses(scope, (current) => current.filter((item) => item.assessmentRecordId !== remove.id))
      }
      if (isCurrentScope(scope)) setRemove(null)
    } catch (reason: unknown) { if (isCurrentScope(scope)) setActionError(reason instanceof Error ? reason.message : '刪除評量紀錄失敗。') } finally { if (isCurrentScope(scope)) setDeleting(false) }
  }
  const openManualDialog = () => { if (scope.iepId && scopeActive) { setActionError(''); setEdit(blank()) } else setActionError('請先儲存學生與 IEP，才能建立永久評量紀錄。') }
  const openGames = () => {
    if (scope.studentId && scope.iepId && scopeActive) navigate(`/students/${scope.studentId}/ieps/${scope.iepId}/game-assessment`)
    else setActionError('請先儲存學生與 IEP，才能進行並永久匯入遊戲評量。')
  }

  return <section className="ability-page" id="assessment-ability-record" role="tabpanel" aria-labelledby="assessment-tab-ability-record">
    {doc && <AssessmentDocumentAnalysisDialog studentName={studentName} onClose={() => setDoc(false)} onConfirmAnalysis={saveDocumentAnalysis} />}
    {edit && <RecordDialog record={edit} onClose={() => setEdit(null)} onSave={saveManual} saving={saving} error={actionError} />}
    {view && <ViewDialog record={view} onClose={() => setView(null)} />}
    {documentAnalysis && <DocumentAnalysisResultDialog analysis={documentAnalysis} onClose={() => setDocumentAnalysis(null)} />}
    {gameResult && <GameAssessmentResultDialog result={gameResult} onClose={() => setGameResult(null)} />}
    {remove && <DeleteDialog record={remove} onClose={() => setRemove(null)} onConfirm={deleteRecord} deleting={deleting} error={actionError} />}
    <div className="section-heading"><h2>二、學生能力現況評量紀錄</h2><p>彙整老師紀錄、評估文件與 EyeEP 遊戲評量結果。</p></div>
    <section className="ability-card"><h3>（一）評量資料與紀錄</h3><div className="assessment-actions"><button className="button button--secondary" type="button" onClick={openManualDialog}>＋ 新增評量紀錄</button><button className="button button--secondary" type="button" onClick={() => setDoc(true)}>AI 辨識評估文件</button><button className="button button--primary" type="button" onClick={openGames}>EyeEP 遊戲評量</button></div>
      {loadError && <p className="student-list-error" role="alert">{loadError}</p>}{actionError && !edit && !remove && <p className="student-list-error" role="alert">{actionError}</p>}
      {records.length === 0 ? <div className="assessment-empty"><h4>目前尚無評量紀錄</h4><p>可新增人工評量紀錄，或透過評估文件與 EyeEP 遊戲評量建立資料。</p></div> : <div className="assessment-table"><div className="assessment-table-head"><span>日期</span><span>類型</span><span>評量工具／方式</span><span>評量者</span><span>摘要</span><span>來源</span><span>操作</span></div>{records.map((record) => <div className="assessment-table-row" key={record.id}><span>{record.assessmentDate}</span><span>{record.assessmentType === '其他' ? record.otherAssessmentType : record.assessmentType}</span><span>{record.assessmentTool}</span><span>{record.evaluator}</span><span className="assessment-summary">{record.summary}</span><span><b className="assessment-source">{labels[record.source]}</b></span><span className="assessment-row-actions"><button className="text-button" type="button" onClick={() => { void openRecord(record) }}>查看</button>{record.source === 'manual' && <button className="text-button" type="button" onClick={() => { setActionError(''); setEdit(record) }}>編輯</button>}<button className="text-button goal-danger" type="button" onClick={() => { setActionError(''); setRemove(record) }}>刪除</button></span></div>)}</div>}
    </section>
  </section>
}

function RecordDialog({ record, onClose, onSave, saving, error }: { record: AssessmentRecord; onClose: () => void; onSave: (record: AssessmentRecord) => Promise<void>; saving: boolean; error: string }) {
  const ref = useRef<HTMLDialogElement>(null), [value, setValue] = useState(record), [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => { const dialogNode = ref.current; dialogNode?.showModal(); return () => dialogNode?.close() }, [])
  const setField = (key: keyof AssessmentRecord, next: string) => setValue((current) => ({ ...current, [key]: next }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!value.assessmentDate) next.assessmentDate = '請填寫評量日期'
    if (!value.assessmentType) next.assessmentType = '請選擇評量類型'
    if (value.assessmentType === '其他' && !value.otherAssessmentType.trim()) next.otherAssessmentType = '請填寫其他評量類型'
    if (!value.assessmentTool.trim()) next.assessmentTool = '請填寫評量工具／方式'
    if (!value.evaluator.trim()) next.evaluator = '請填寫評量者'
    if (!value.summary.trim()) next.summary = '請填寫評量摘要'
    setErrors(next)
    if (!Object.keys(next).length) void onSave(value)
  }
  return <dialog className="assessment-record-dialog" ref={ref} aria-labelledby="assessment-record-title" onCancel={(event) => { event.preventDefault(); if (!saving) onClose() }}><header><h2 id="assessment-record-title">{record.id ? '編輯' : '新增'}評量紀錄</h2><button className="text-button" type="button" disabled={saving} onClick={onClose}>關閉</button></header><form className="assessment-record-dialog-body" onSubmit={submit}><Field label="評量日期 *" error={errors.assessmentDate}><input type="date" value={value.assessmentDate} onChange={(event) => setField('assessmentDate', event.target.value)} /></Field><Field label="評量類型 *" error={errors.assessmentType}><select value={value.assessmentType} onChange={(event) => setField('assessmentType', event.target.value)}><option value="">請選擇</option>{types.map((type) => <option key={type}>{type}</option>)}</select></Field>{value.assessmentType === '其他' && <Field label="其他評量類型 *" error={errors.otherAssessmentType}><input value={value.otherAssessmentType} onChange={(event) => setField('otherAssessmentType', event.target.value)} /></Field>}<Field label="評量工具／方式 *" error={errors.assessmentTool}><input value={value.assessmentTool} onChange={(event) => setField('assessmentTool', event.target.value)} /></Field><Field label="評量者 *" error={errors.evaluator}><input value={value.evaluator} onChange={(event) => setField('evaluator', event.target.value)} /></Field><Field label="評量摘要 *" error={errors.summary} full><textarea rows={6} value={value.summary} onChange={(event) => setField('summary', event.target.value)} /></Field>{error && <p className="assessment-dialog-error" role="alert">{error}</p>}<footer><button className="button button--secondary" type="button" disabled={saving} onClick={onClose}>取消</button><button className="button button--primary" disabled={saving}>{saving ? '儲存中…' : '儲存'}</button></footer></form></dialog>
}
function Field({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: ReactNode }) { return <label className={full ? 'assessment-dialog-full' : ''}>{label}{children}{error && <small>{error}</small>}</label> }
function ViewDialog({ record, onClose }: { record: AssessmentRecord; onClose: () => void }) { const ref = useRef<HTMLDialogElement>(null); useEffect(() => { const dialogNode = ref.current; dialogNode?.showModal(); return () => dialogNode?.close() }, []); return <dialog className="assessment-record-dialog" ref={ref} onCancel={(event) => { event.preventDefault(); onClose() }}><header><h2>評量紀錄</h2><button className="text-button" type="button" onClick={onClose}>關閉</button></header><dl className="assessment-record-view"><div><dt>評量日期</dt><dd>{record.assessmentDate}</dd></div><div><dt>評量類型</dt><dd>{record.assessmentType === '其他' ? record.otherAssessmentType : record.assessmentType}</dd></div><div><dt>評量工具／方式</dt><dd>{record.assessmentTool}</dd></div><div><dt>評量者</dt><dd>{record.evaluator}</dd></div><div><dt>資料來源</dt><dd>{labels[record.source]}</dd></div><div className="assessment-view-full"><dt>評量摘要</dt><dd>{record.summary}</dd></div></dl></dialog> }
function DeleteDialog({ record, onClose, onConfirm, deleting, error }: { record: AssessmentRecord; onClose: () => void; onConfirm: () => Promise<void>; deleting: boolean; error: string }) { const ref = useRef<HTMLDialogElement>(null); const isDocument = record.source === 'document'; const isGame = record.source === 'monkey' || record.source === 'cpt'; useEffect(() => { const dialogNode = ref.current; dialogNode?.showModal(); return () => dialogNode?.close() }, []); return <dialog className="assessment-delete-dialog" ref={ref} onCancel={(event) => { event.preventDefault(); if (!deleting) onClose() }}><h2>{isDocument ? '確定要刪除此筆 AI 評估文件及其分析結果嗎？' : isGame ? '確定要刪除此筆遊戲評量及其完整結果嗎？' : '刪除評量紀錄？'}</h2><p>{isDocument ? '刪除後將一併移除七大能力分析結果，且無法復原。' : isGame ? '刪除後將一併移除完整遊戲結果，且無法復原。' : '刪除後無法復原。'}</p>{error && <p className="assessment-dialog-error" role="alert">{error}</p>}<footer><button className="button button--secondary" type="button" disabled={deleting} onClick={onClose}>取消</button><button className="button button--danger" type="button" disabled={deleting} onClick={() => { void onConfirm() }}>{deleting ? '刪除中…' : '刪除'}</button></footer></dialog> }
