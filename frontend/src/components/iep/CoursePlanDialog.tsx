import { useEffect, useRef, useState } from 'react'
import type { CoursePlanDraft, CoursePlanItem } from './StudentCoursePlan'
import { referenceOptions, placementOf } from '../../models/referenceForms'

const courseTypes = ['普通教育課程', '特殊教育課程', '特殊需求領域課程', '其他']
const teachingMethods = ['原班上課', '抽離式', '外加式', '小組教學', '個別教學', '協同教學', '其他']
const locations = ['原班教室', '資源教室', '特教班', '專科教室', '其他']
const emptyDraft: CoursePlanDraft = { courseName: '', courseType: '', otherCourseType: '', teachingMethod: '', otherTeachingMethod: '', teacher: '', location: '', otherLocation: '', weeklyPeriods: '', notes: '' }

export function CoursePlanDialog({ item, onClose, onSave }: { item: CoursePlanItem | null; onClose: () => void; onSave: (draft: CoursePlanDraft) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<CoursePlanDraft>(item ? { ...item, placement: placementOf(item), weeklyPeriods: String(item.weeklyPeriods) } : { ...emptyDraft, placement: '', referenceCategory: '', startDate: '', endDate: '' })
  const [error, setError] = useState('')
  useEffect(() => { const dialogNode = dialog.current; dialogNode?.showModal(); return () => dialogNode?.close() }, [])
  const update = <K extends keyof CoursePlanDraft>(key: K, value: CoursePlanDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const save = () => {
    if (!draft.courseName.trim()) return setError('請填寫課程名稱。')
    if (!draft.courseType) return setError('請選擇課程／領域類型。')
    if (!draft.teachingMethod) return setError('請選擇授課方式。')
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) return setError('結束日期不可早於開始日期。')
    const periods = Number(draft.weeklyPeriods)
    if (draft.weeklyPeriods === '' || !Number.isFinite(periods) || periods < 0) return setError('每週節數須為 0 或正數。')
    setError(''); onSave({ ...draft, courseName: draft.courseName.trim(), weeklyPeriods: String(periods) })
  }
  return <dialog ref={dialog} className="course-plan-dialog" aria-labelledby="course-plan-dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }}><header><h2 id="course-plan-dialog-title">{item ? '編輯課程' : '新增課程'}</h2><button type="button" className="text-button" onClick={onClose}>關閉</button></header><div className="course-plan-dialog-body"><label>課程名稱<input value={draft.courseName} onChange={(event) => update('courseName', event.target.value)} /></label><label>課程／領域類型<select value={draft.courseType} onChange={(event) => update('courseType', event.target.value)}><option value="">請選擇</option>{courseTypes.map((type) => <option key={type}>{type}</option>)}</select></label>{draft.courseType === '其他' && <label>其他類型<input value={draft.otherCourseType} onChange={(event) => update('otherCourseType', event.target.value)} /></label>}<label>排課方式<select value={draft.placement ?? ''} onChange={e => update('placement', e.target.value)}><option value="">尚未指定</option>{['原班', '抽離', '外加'].map(v => <option key={v}>{v}</option>)}</select></label><label>原表課程分類<select value={draft.referenceCategory ?? ''} onChange={e => update('referenceCategory', e.target.value)}><option value="">依課程名稱對應</option>{referenceOptions.courseCategories.map(row => <option key={row.name}>{row.name}</option>)}</select></label><label>開始日期<input type="date" value={draft.startDate ?? ''} onChange={e => update('startDate', e.target.value)} /></label><label>結束日期<input type="date" value={draft.endDate ?? ''} onChange={e => update('endDate', e.target.value)} /></label><label>教學方式<select value={draft.teachingMethod} onChange={(event) => update('teachingMethod', event.target.value)}><option value="">請選擇</option>{teachingMethods.map((method) => <option key={method}>{method}</option>)}</select></label>{draft.teachingMethod === '其他' && <label>其他授課方式說明<input value={draft.otherTeachingMethod} onChange={(event) => update('otherTeachingMethod', event.target.value)} /></label>}<label>授課教師<input value={draft.teacher} onChange={(event) => update('teacher', event.target.value)} /></label><label>授課地點<select value={draft.location} onChange={(event) => update('location', event.target.value)}><option value="">請選擇</option>{locations.map((location) => <option key={location}>{location}</option>)}</select></label>{draft.location === '其他' && <label>其他授課地點<input value={draft.otherLocation} onChange={(event) => update('otherLocation', event.target.value)} /></label>}<label>每週節數<input type="number" min="0" value={draft.weeklyPeriods} onChange={(event) => update('weeklyPeriods', event.target.value)} /></label><label className="course-dialog-full">備註<textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} /></label>{error && <p className="course-dialog-error" role="alert">{error}</p>}<footer><button className="button button--secondary" type="button" onClick={onClose}>取消</button><button className="button button--primary" type="button" onClick={save}>儲存課程</button></footer></div></dialog>
}
