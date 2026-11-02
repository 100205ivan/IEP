import { useState } from 'react'
import { referenceOptions, supportReference, inclusiveReferenceRows, type ReferenceSupport, type InclusiveReferenceRow, type AdjustmentSubjectDetail, type BehaviorExecution } from '../../models/referenceForms'
import type { CurriculumAdjustmentValue } from './CurriculumAdjustment'
import type { CoursePlanItem } from './StudentCoursePlan'

function NeedSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: '' | '無需求' | '有需求') => void }) { return <label>{label}<select value={value} onChange={e => onChange(e.target.value as '' | '無需求' | '有需求')}><option value="">尚未評估／未填</option><option>無需求</option><option>有需求</option></select></label> }

export function SupportReferenceFields({ value, onChange }: { value?: ReferenceSupport; onChange: (value: ReferenceSupport) => void }) {
  const data = supportReference(value)
  return <section className="reference-fields"><h3>支持服務提供方式</h3><p>逐項填寫原表中的服務細項。「未填」與「無需求」分開記錄；選擇無需求時會保留草稿，匯出不列出該區細項。</p><div className="reference-grid"><NeedSelect label="特殊需求領域課程" value={data.curriculumNeed} onChange={curriculumNeed => onChange({ ...data, curriculumNeed })} /><NeedSelect label="支持服務整體需求" value={data.supportNeed} onChange={supportNeed => onChange({ ...data, supportNeed })} /></div>{data.supportNeed !== '無需求' && referenceOptions.supportGroups.map(group => {
    const current = data.groups[group.id]
    const update = (next: Partial<typeof current>) => onChange({ ...data, groups: { ...data.groups, [group.id]: { ...current, ...next } } })
    return <details className="reference-detail" key={group.id}><summary>{group.title} {current.status || '未填'}</summary><NeedSelect label={`${group.title}需求`} value={current.status} onChange={status => update({ status })} />{current.status !== '無需求' && <><div className="reference-checks">{group.options.map(item => <label key={item}><input type="checkbox" checked={current.selected.includes(item)} onChange={() => update({ selected: current.selected.includes(item) ? current.selected.filter(v => v !== item) : [...current.selected, item] })} />{item}</label>)}</div>{current.selected.map(item => <label key={item}>{item}說明<input value={current.notes[item] ?? ''} maxLength={2000} onChange={e => update({ notes: { ...current.notes, [item]: e.target.value } })} /></label>)}<label>{group.title}補充說明<textarea value={current.description} onChange={e => update({ description: e.target.value })} /></label></>}</details>
  })}</section>
}

export function InclusiveReferenceFields({ value, onChange }: { value?: InclusiveReferenceRow[]; onChange: (value: InclusiveReferenceRow[]) => void }) {
  const rows = inclusiveReferenceRows(value)
  return <section className="reference-fields"><h3>融合教育執行明細</h3><p>記錄各項執行方式、起訖時間、頻率及負責單位，直接填入融合教育規劃表。</p>{referenceOptions.inclusiveGroups.map(group => <fieldset key={group.id}><legend>{group.title}</legend>{group.options.map(item => {
    const row = rows.find(row => row.item === item)!
    const update = (next: Partial<InclusiveReferenceRow>) => onChange(rows.map(value => value.item === item ? { ...value, ...next } : value))
    return <div className="reference-detail" key={item}><label className="reference-check"><input type="checkbox" checked={row.selected} onChange={e => update({ selected: e.target.checked })} />{item}</label>{row.selected && <div className="reference-grid"><label className="reference-full">執行方式<textarea value={row.execution} onChange={e => update({ execution: e.target.value })} /></label><label>開始日期<input type="date" value={row.startDate} onChange={e => update({ startDate: e.target.value })} /></label><label>結束日期<input type="date" value={row.endDate} onChange={e => update({ endDate: e.target.value })} /></label><label>頻率<input value={row.frequency} onChange={e => update({ frequency: e.target.value })} /></label><label>負責單位／人<input value={row.responsible} onChange={e => update({ responsible: e.target.value })} /></label></div>}</div>
  })}</fieldset>)}</section>
}

export function AdjustmentSubjectFields({ value, courses, onChange }: { value: CurriculumAdjustmentValue; courses: CoursePlanItem[]; onChange: (details: Record<string, AdjustmentSubjectDetail>) => void }) {
  const [newSubject, setNewSubject] = useState('')
  const kinds = [['content', '學習內容'], ['process', '學習歷程'], ['environment', '學習環境'], ['assessment', '學習評量']] as const
  const subjects = [...new Set([...kinds.flatMap(([key]) => value[key].applicableSubjects), ...Object.keys(value.subjectDetails ?? {})])]
  const defaultRow = (subject: string): AdjustmentSubjectDetail => ({ teacher: [...new Set(courses.filter(course => course.courseName.includes(subject)).map(course => course.teacher).filter(Boolean))].join('、'), ...Object.fromEntries(kinds.map(([key]) => [key, value[key].applicableSubjects.includes(subject) && (value[key].selectedStrategies.length || value[key].description) ? '須調整' : ''])), ...value.subjectDetails?.[subject] }) as AdjustmentSubjectDetail
  return <section className="reference-fields"><h3>各科目調整判斷與授課教師</h3><p>可分別記錄無須調整、須調整或尚未填寫。教師會先從課程規劃帶入，也可在此修改。</p><div className="reference-inline"><label>新增科目<input value={newSubject} onChange={e => setNewSubject(e.target.value)} list="reference-subjects" maxLength={255} /></label><datalist id="reference-subjects">{[...new Set(['全部課程', '國語', '英語', '數學', ...courses.map(course => course.courseName)])].map(name => <option key={name}>{name}</option>)}</datalist><button className="button button--secondary" type="button" disabled={!newSubject.trim()} onClick={() => { const subject = newSubject.trim(); onChange({ ...value.subjectDetails, [subject]: defaultRow(subject) }); setNewSubject('') }}>加入科目</button></div>{subjects.map(subject => {
    const row = defaultRow(subject)
    const update = (next: Partial<AdjustmentSubjectDetail>) => onChange({ ...value.subjectDetails, [subject]: { ...row, ...next } })
    return <fieldset key={subject}><legend>{subject}</legend><div className="reference-grid"><label>授課教師<input value={row.teacher} onChange={e => update({ teacher: e.target.value })} /></label>{kinds.map(([key, label]) => <label key={key}>{label}<select value={row[key]} onChange={e => update({ [key]: e.target.value })}><option value="">尚未填寫</option><option>無須調整</option><option>須調整</option></select></label>)}</div></fieldset>
  })}</section>
}

export function BehaviorExecutionFields({ value, commonPeople, onChange }: { value?: Partial<Record<'antecedent' | 'teaching' | 'consequence', BehaviorExecution>>; commonPeople: string; onChange: (value: Partial<Record<'antecedent' | 'teaching' | 'consequence', BehaviorExecution>>) => void }) {
  return <section className="reference-fields"><h3>各策略執行紀錄</h3>{([['antecedent', 'A. 前事處理與先兆控制'], ['teaching', 'B. 行為教導'], ['consequence', 'C. 後果處理']] as const).map(([key, label]) => {
    const row = { executionMethod: '', implementers: commonPeople, progress: '', ...value?.[key] }
    const update = (next: Partial<BehaviorExecution>) => onChange({ ...value, [key]: { ...row, ...next } })
    return <fieldset key={key}><legend>{label}</legend><div className="reference-grid"><label>執行方式<textarea value={row.executionMethod} onChange={e => update({ executionMethod: e.target.value })} /></label><label>執行人員<input value={row.implementers} onChange={e => update({ implementers: e.target.value })} /></label><label className="reference-full">執行狀況<textarea value={row.progress} onChange={e => update({ progress: e.target.value })} /></label></div></fieldset>
  })}</section>
}

export function SubskillImpactFields({ domain, selected, details, choose, text }: { domain: string; selected: Record<string, string[]>; details: Record<string, string>; choose: (key: string, value: string) => void; text: (key: string, value: string) => void }) {
  const groups = (referenceOptions.impactGroups as Record<string, { id: string; title: string }[]>)[domain]
  if (!groups) return null
  return <details className="reference-detail"><summary>分項的班級適應影響</summary>{groups.map(group => { const key = `${domain}-${group.id}-classImpact`; return <fieldset key={key}><legend>{group.title}</legend><label>影響判斷<select value={selected[key]?.[0] ?? ''} onChange={e => choose(key, e.target.value)}><option value="">尚未填寫</option><option>無影響</option><option>有影響</option></select></label><label>影響說明<textarea value={details[key + 'Description'] ?? ''} onChange={e => text(key + 'Description', e.target.value)} /></label></fieldset> })}</details>
}
