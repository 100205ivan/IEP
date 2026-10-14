import { useState, type Dispatch, type SetStateAction } from 'react'
import { CoursePlanDialog } from './CoursePlanDialog'

export interface CoursePlanItem { id: string; courseName: string; courseType: string; otherCourseType: string; teachingMethod: string; otherTeachingMethod: string; teacher: string; location: string; otherLocation: string; weeklyPeriods: number; notes: string }
export type CoursePlanDraft = Omit<CoursePlanItem, 'id' | 'weeklyPeriods'> & { weeklyPeriods: string }

export function StudentCoursePlan({ courses, setCourses }: { courses: CoursePlanItem[]; setCourses: Dispatch<SetStateAction<CoursePlanItem[]>> }) {
  const [editingItem, setEditingItem] = useState<CoursePlanItem | null | undefined>(undefined)
  const [deletingItem, setDeletingItem] = useState<CoursePlanItem | null>(null)
  const save = (draft: CoursePlanDraft) => {
    const next = { ...draft, weeklyPeriods: Number(draft.weeklyPeriods) }
    if (editingItem) setCourses((current) => current.map((item) => item.id === editingItem.id ? { ...next, id: item.id } : item))
    else setCourses((current) => [...current, { ...next, id: crypto.randomUUID() }])
    setEditingItem(undefined)
  }
  return <section className="student-course-plan" id="services-curriculum-plan" role="tabpanel" aria-labelledby="services-tab-curriculum-plan"><div className="course-plan-heading"><div><h2>四、學生課程規劃表</h2><p>規劃學生本學期實際參與之普通教育、特殊教育及特殊需求領域課程。</p></div><button className="button button--primary course-add-button" type="button" onClick={() => setEditingItem(null)}>＋ 新增課程</button></div>{courses.length === 0 ? <section className="course-empty-state"><h3>尚未建立課程規劃</h3><p>新增課程後，將顯示於此處。</p><button className="button button--primary" type="button" onClick={() => setEditingItem(null)}>＋ 新增第一筆課程</button></section> : <div className="course-table-wrap"><table className="course-table"><thead><tr><th>課程名稱</th><th>課程／領域類型</th><th>授課方式</th><th>授課教師</th><th>授課地點</th><th>每週節數</th><th>操作</th></tr></thead><tbody>{courses.map((item) => <tr key={item.id}><td>{item.courseName}</td><td>{item.courseType === '其他' ? item.otherCourseType || '其他' : item.courseType}</td><td>{item.teachingMethod === '其他' ? item.otherTeachingMethod || '其他' : item.teachingMethod}</td><td>{item.teacher || '—'}</td><td>{item.location === '其他' ? item.otherLocation || '其他' : item.location || '—'}</td><td>{item.weeklyPeriods}</td><td className="course-table-actions"><button className="text-button" type="button" onClick={() => setEditingItem(item)}>編輯</button><button className="text-button course-delete-button" type="button" onClick={() => setDeletingItem(item)}>刪除</button></td></tr>)}</tbody></table></div>}{editingItem !== undefined && <CoursePlanDialog item={editingItem} onClose={() => setEditingItem(undefined)} onSave={save} />}{deletingItem && <DeleteCourseDialog item={deletingItem} onClose={() => setDeletingItem(null)} onConfirm={() => { setCourses((current) => current.filter((item) => item.id !== deletingItem.id)); setDeletingItem(null) }} />}</section>
}

function DeleteCourseDialog({ item, onClose, onConfirm }: { item: CoursePlanItem; onClose: () => void; onConfirm: () => void }) { return <div className="course-delete-backdrop" role="presentation"><section className="course-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-course-title"><h2 id="delete-course-title">刪除課程</h2><p>確定要刪除「{item.courseName}」嗎？此操作無法復原。</p><div><button className="button button--secondary" type="button" onClick={onClose}>取消</button><button className="button course-confirm-delete" type="button" onClick={onConfirm}>刪除課程</button></div></section></div> }
