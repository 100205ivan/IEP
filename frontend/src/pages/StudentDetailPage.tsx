import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createAnnualIep, deleteStudentIep, getStudent, getStudentIeps } from '../services/studentIepApi'
import { initialBehaviorIntervention, initialCurriculumAdjustment, initialInclusiveEducationPlan, initialSpecialEducationSupport, initialStudentFamilyFormValue, initialTransitionSupport } from '../components/iep/iepInitialValues'
import type { IepContent, IepRecord, StudentProfile } from '../types/studentIep'

function formatDate(value: string) { return new Date(value).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' }) }
function genderLabel(value: string) { return value === 'male' ? '男' : value === 'female' ? '女' : '—' }
function currentAcademicYear() { return String(new Date().getFullYear() - 1911) }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function buildBlankIepContent(student: StudentProfile): IepContent {
  return {
    studentFamilyForm: { values: { ...clone(initialStudentFamilyFormValue.values), studentName: student.name, gender: student.gender, birthDate: student.birthDate ?? '', studentId: student.studentNumber }, checks: {}, medications: [] },
    goalDomains: [], semesterGoals: [], learningNotes: '', behaviorIntervention: clone(initialBehaviorIntervention), transitionSupport: clone(initialTransitionSupport), meetingRecords: [], specialEducationSupport: clone(initialSpecialEducationSupport), inclusiveEducationPlan: clone(initialInclusiveEducationPlan), curriculumAdjustment: clone(initialCurriculumAdjustment), coursePlanItems: [], weeklySchedule: [], assessmentSelections: {}, assessmentDetails: {}, strengthWeaknessSummary: { strengths: [], weaknesses: [], strengthNotes: '', weaknessNotes: '', overallNeeds: '' },
  }
}

export function StudentDetailPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [ieps, setIeps] = useState<IepRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createYear, setCreateYear] = useState(currentAcademicYear)
  const [createMode, setCreateMode] = useState<'copy-basic' | 'blank'>('blank')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdIep, setCreatedIep] = useState<IepRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IepRecord | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deletedYear, setDeletedYear] = useState<number | null>(null)

  const loadStudent = useCallback(() => {
    if (!studentId) { setError('找不到學生識別碼。'); setLoading(false); return }
    setLoading(true)
    setError('')
    Promise.all([getStudent(studentId), getStudentIeps(studentId)]).then(([profile, records]) => { setStudent(profile); setIeps(records) }).catch((reason: unknown) => { setError(reason instanceof Error ? reason.message : '無法載入學生資料。') }).finally(() => setLoading(false))
  }, [studentId])

  useEffect(() => { loadStudent() }, [loadStudent])

  const sourceIep = useMemo(() => {
    const targetYear = Number(createYear)
    return ieps.filter((iep) => Number.isInteger(targetYear) && iep.academicYear < targetYear).sort((a, b) => b.academicYear - a.academicYear)[0] ?? null
  }, [createYear, ieps])
  const updateCreateYear = (value: string) => {
    setCreateYear(value)
    const targetYear = Number(value)
    const nextSource = ieps.filter((iep) => Number.isInteger(targetYear) && iep.academicYear < targetYear).sort((a, b) => b.academicYear - a.academicYear)[0]
    setCreateMode(nextSource ? 'copy-basic' : 'blank')
    setCreateError('')
  }
  const openCreateDialog = () => {
    const year = currentAcademicYear()
    const targetYear = Number(year)
    const source = ieps.filter((iep) => iep.academicYear < targetYear).sort((a, b) => b.academicYear - a.academicYear)[0]
    setCreateYear(year); setCreateMode(source ? 'copy-basic' : 'blank'); setCreateError(''); setCreatedIep(null); setCreateOpen(true)
  }
  const submitCreateIep = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!student) return
    const academicYear = Number(createYear)
    if (!Number.isInteger(academicYear) || academicYear < 1 || academicYear > 999) { setCreateError('請輸入有效的學年度。'); return }
    if (ieps.some((iep) => iep.academicYear === academicYear)) { setCreateError(`此學生已有${academicYear}學年度 IEP，請直接開啟既有紀錄。`); return }
    if (createMode === 'copy-basic' && !sourceIep) { setCreateError('沒有早於目標學年度的 IEP 可沿用，請改用建立空白年度 IEP。'); return }
    setCreating(true); setCreateError('')
    try {
      const record = await createAnnualIep(student.id, academicYear, createMode, sourceIep?.id, createMode === 'blank' ? buildBlankIepContent(student) : undefined)
      setIeps((current) => [record, ...current].sort((a, b) => b.academicYear - a.academicYear))
      setCreatedIep(record); setCreateOpen(false); navigate(`/students/${student.id}/ieps/${record.id}`)
    } catch (reason: unknown) { setCreateError(reason instanceof Error ? reason.message : '建立 IEP 失敗，請稍後再試。') } finally { setCreating(false) }
  }

  const openDeleteDialog = (iep: IepRecord) => {
    setDeleteTarget(iep)
    setDeleteConfirmation('')
    setDeleteError('')
    setDeletedYear(null)
  }
  const closeDeleteDialog = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteConfirmation('')
    setDeleteError('')
  }
  const submitDeleteIep = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!deleteTarget || deleteConfirmation !== '刪除') return
    setDeleting(true)
    setDeleteError('')
    try {
      const deleted = await deleteStudentIep(deleteTarget.id, deleteConfirmation)
      setIeps((current) => current.filter((iep) => iep.id !== deleted.id))
      setDeletedYear(deleted.academicYear)
      setDeleteTarget(null)
      setDeleteConfirmation('')
    } catch (reason: unknown) { setDeleteError(reason instanceof Error ? reason.message : '刪除 IEP 失敗，請稍後再試。') } finally { setDeleting(false) }
  }

  if (loading) return <main className="page-container student-detail-page"><p className="student-list-status">載入中…</p></main>

  return <div className="student-management-shell">
    <header className="site-header"><div className="header-content page-container"><div className="brand"><span className="brand-name">EyeEP</span><span className="brand-subtitle">個別化教育計畫</span></div><span className="student-management-header-label">學生管理</span></div></header>
    <main className="page-container student-detail-page">
      <Link className="back-link" to="/students">← 返回學生管理</Link>
      {error ? <section className="student-detail-error" role="alert"><h1>無法載入學生資料</h1><p>{error}</p><div><button className="button button--primary" type="button" onClick={loadStudent}>重新載入</button></div></section> : student && <>
        <div className="student-detail-heading"><div><p className="eyebrow">學生資料</p><h1>{student.name}</h1><p>查看基本資料與歷年 IEP。</p></div></div>
        <section className="student-profile-card"><h2>基本資料</h2><dl><div><dt>學生姓名</dt><dd>{student.name}</dd></div><div><dt>學號</dt><dd>{student.studentNumber || '—'}</dd></div><div><dt>性別</dt><dd>{genderLabel(student.gender)}</dd></div><div><dt>出生日期</dt><dd>{student.birthDate || '—'}</dd></div></dl></section>
        {createdIep && <p className="student-create-success" role="status">已建立 {createdIep.academicYear} 學年度 IEP。<Link to={`/students/${student.id}/ieps/${createdIep.id}`}>開啟新年度 IEP</Link></p>}
        {deletedYear && <p className="student-delete-success" role="status">{deletedYear}學年度 IEP 已刪除。</p>}
        <section className="student-iep-history"><div className="student-detail-section-heading"><div><h2>歷年 IEP</h2><p>共 {ieps.length} 份年度 IEP 紀錄</p></div><button className="button button--primary" type="button" onClick={openCreateDialog}>＋ 新增學年度 IEP</button></div>{ieps.length === 0 ? <div className="student-detail-empty"><h3>目前尚無 IEP 紀錄</h3><p>此學生尚未建立年度 IEP。</p></div> : <div className="student-iep-table-wrap"><table className="student-iep-table"><thead><tr><th>學年度</th><th>建立時間</th><th>最後更新</th><th>操作</th></tr></thead><tbody>{ieps.map((iep) => <tr key={iep.id}><td>{iep.academicYear}</td><td>{formatDate(iep.createdAt)}</td><td>{formatDate(iep.updatedAt)}</td><td><div className="student-iep-actions"><Link className="text-button" to={`/students/${student.id}/ieps/${iep.id}`}>開啟 IEP</Link><button className="text-button student-iep-delete" type="button" onClick={() => openDeleteDialog(iep)}>刪除</button></div></td></tr>)}</tbody></table></div>}</section>
        {createOpen && <div className="student-create-backdrop"><section className="student-create-dialog" role="dialog" aria-modal="true" aria-labelledby="student-create-title"><div className="student-create-dialog-heading"><h2 id="student-create-title">新增學年度 IEP</h2><button className="icon-button" type="button" onClick={() => setCreateOpen(false)} aria-label="關閉">×</button></div><form onSubmit={submitCreateIep}><label>學生姓名<input value={student.name} readOnly /></label><label>欲建立的學年度<input type="number" min="1" max="999" value={createYear} onChange={(event) => updateCreateYear(event.target.value)} required /></label><fieldset><legend>建立方式</legend><label className="student-create-method"><input type="radio" name="create-mode" checked={createMode === 'copy-basic' && Boolean(sourceIep)} onChange={() => setCreateMode('copy-basic')} disabled={!sourceIep} />沿用上一學年度資料（推薦）</label>{sourceIep ? <p>帶入 {sourceIep.academicYear} 學年度的學生基本資料、鑑定、醫療及家庭資料。</p> : <p>沒有可沿用的較早學年度資料。</p>}<label className="student-create-method"><input type="radio" name="create-mode" checked={createMode === 'blank'} onChange={() => setCreateMode('blank')} />建立空白 IEP</label><p>只帶入學生基本身分資料。</p></fieldset>{createError && <p className="student-create-error" role="alert">{createError}</p>}<footer><button className="button button--secondary" type="button" onClick={() => setCreateOpen(false)}>取消</button><button className="button button--primary" type="submit" disabled={creating}>{creating ? '建立中…' : '建立 IEP'}</button></footer></form></section></div>}
        {deleteTarget && <div className="student-create-backdrop"><section className="student-create-dialog student-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="student-delete-title"><div className="student-create-dialog-heading"><h2 id="student-delete-title">確定刪除這份 IEP？</h2><button className="icon-button" type="button" onClick={closeDeleteDialog} disabled={deleting} aria-label="關閉">×</button></div><form onSubmit={submitDeleteIep}><p>即將刪除{student.name}的 {deleteTarget.academicYear} 學年度 IEP。</p><p>刪除後將無法復原，其他學年度 IEP 與學生基本資料不受影響。</p><label>請輸入「刪除」以確認<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" disabled={deleting} /></label>{deleteError && <p className="student-create-error" role="alert">{deleteError}</p>}<footer><button className="button button--secondary" type="button" onClick={closeDeleteDialog} disabled={deleting}>取消</button><button className="button student-delete-confirm" type="submit" disabled={deleteConfirmation !== '刪除' || deleting}>{deleting ? '刪除中…' : '確認刪除'}</button></footer></form></section></div>}
      </>}
    </main>
  </div>
}
