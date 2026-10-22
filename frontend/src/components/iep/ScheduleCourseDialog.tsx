import { useEffect, useRef, useState } from 'react'
import type { CoursePlanItem } from './StudentCoursePlan'
import type { PeriodId, Weekday } from './weeklyScheduleConstants'

export function ScheduleCourseDialog({ day, period, courses, currentCourseId, onClose, onSave, onRemove }: { day: Weekday; period: PeriodId; courses: CoursePlanItem[]; currentCourseId?: string; onClose: () => void; onSave: (courseId: string) => void; onRemove: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [selectedCourseId, setSelectedCourseId] = useState(currentCourseId ?? '')
  useEffect(() => {
    const dialogNode = dialog.current
    dialogNode?.showModal()
    return () => dialogNode?.close()
  }, [])
  const current = courses.find((course) => course.id === currentCourseId)
  return <dialog ref={dialog} className="schedule-course-dialog" aria-labelledby="schedule-dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }}><header><h2 id="schedule-dialog-title">安排課程</h2><button type="button" className="text-button" onClick={onClose}>關閉</button></header><div className="schedule-dialog-body"><p className="schedule-slot-label">{day}・{period}</p>{current && <p className="schedule-current-course">目前課程：<strong>{current.courseName}</strong></p>}<fieldset><legend>{current ? '更換課程' : '選擇課程'}</legend>{courses.map((course) => <label className="schedule-course-option" key={course.id}><input type="radio" name="schedule-course" checked={selectedCourseId === course.id} onChange={() => setSelectedCourseId(course.id)} /><span><strong>{course.courseName}</strong><small>{course.courseType === '其他' ? course.otherCourseType || '其他' : course.courseType}｜{course.teachingMethod === '其他' ? course.otherTeachingMethod || '其他' : course.teachingMethod}{course.teacher ? `｜${course.teacher}` : ''}</small></span></label>)}</fieldset><footer>{currentCourseId && <button className="button schedule-remove-button" type="button" onClick={onRemove}>移除此時段安排</button>}<span /><button className="button button--secondary" type="button" onClick={onClose}>取消</button><button className="button button--primary" type="button" disabled={!selectedCourseId} onClick={() => onSave(selectedCourseId)}>儲存安排</button></footer></div></dialog>
}
