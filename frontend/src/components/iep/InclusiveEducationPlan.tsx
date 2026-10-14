import type { Dispatch, SetStateAction } from 'react'

const withdrawalSubjects = ['國語', '數學', '英語', '自然', '社會', '特殊需求領域', '其他']
const activityOptions = ['班級活動', '校外教學', '體育活動', '團體活動', '學校大型活動', '社團／課外活動', '其他']
const strategyOptions = ['同儕協助', '座位安排', '視覺提示', '活動前預告', '分段指令', '延長作答／反應時間', '降低環境刺激', '提供情緒調節空間', '成人提示／協助', '其他']

export interface InclusiveEducationPlanValue {
  grade: string
  className: string
  participation: string
  withdrawalSubjects: string[]
  withdrawalOther: string
  otherParticipationNotes: string
  participationNotes: string
  activities: string[]
  activityOther: string
  activityNotes: string
  strategies: string[]
  strategyOther: string
  strategyNotes: string
}

export const initialInclusiveEducationPlan: InclusiveEducationPlanValue = { grade: '', className: '', participation: '', withdrawalSubjects: [], withdrawalOther: '', otherParticipationNotes: '', participationNotes: '', activities: [], activityOther: '', activityNotes: '', strategies: [], strategyOther: '', strategyNotes: '' }

interface InclusiveEducationPlanProps { value: InclusiveEducationPlanValue; onChange: Dispatch<SetStateAction<InclusiveEducationPlanValue>> }

function CheckboxList({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (option: string) => void }) {
  return <div className="inclusive-checkbox-list">{options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />{option}</label>)}</div>
}

export function InclusiveEducationPlan({ value, onChange }: InclusiveEducationPlanProps) {
  const update = <K extends keyof InclusiveEducationPlanValue>(key: K, nextValue: InclusiveEducationPlanValue[K]) => onChange((current) => ({ ...current, [key]: nextValue }))
  const toggle = (key: 'withdrawalSubjects' | 'activities' | 'strategies', option: string) => update(key, value[key].includes(option) ? value[key].filter((item) => item !== option) : [...value[key], option])

  return <section className="inclusive-education-plan" id="services-inclusive-education" role="tabpanel" aria-labelledby="services-tab-inclusive-education">
    <div className="inclusive-page-heading"><h2>二、融合教育規劃</h2><p>規劃學生於普通班及校園活動中的參與方式與所需支持。</p></div>
    <section className="inclusive-card"><h3>融合教育參與方式</h3><div className="inclusive-placement-grid"><label className="inclusive-field">年級<select value={value.grade} onChange={(event) => update('grade', event.target.value)}><option value="">請選擇</option>{['一年級', '二年級', '三年級', '四年級', '五年級', '六年級', '七年級', '八年級', '九年級'].map((grade) => <option key={grade}>{grade}</option>)}</select></label><label className="inclusive-field">班級<select value={value.className} onChange={(event) => update('className', event.target.value)}><option value="">請選擇</option>{['1 班', '2 班', '3 班', '4 班', '5 班'].map((className) => <option key={className}>{className}</option>)}</select></label></div><fieldset className="inclusive-radio-group"><legend>參與方式</legend>{['全時參與普通班', '部分時間抽離', '其他方式'].map((option) => <label key={option}><input type="radio" name="participation" checked={value.participation === option} onChange={() => update('participation', option)} />{option}</label>)}</fieldset>{value.participation === '部分時間抽離' && <div className="inclusive-conditional"><h4>抽離課程／領域</h4><CheckboxList options={withdrawalSubjects} selected={value.withdrawalSubjects} onToggle={(option) => toggle('withdrawalSubjects', option)} />{value.withdrawalSubjects.includes('其他') && <label className="inclusive-field conditional-inclusive-field">其他抽離課程／領域<input value={value.withdrawalOther} onChange={(event) => update('withdrawalOther', event.target.value)} /></label>}</div>}{value.participation === '其他方式' && <label className="inclusive-field inclusive-field--full conditional-inclusive-field">其他參與方式說明<textarea value={value.otherParticipationNotes} onChange={(event) => update('otherParticipationNotes', event.target.value)} /></label>}<label className="inclusive-field inclusive-field--full">融合教育參與說明<textarea value={value.participationNotes} onChange={(event) => update('participationNotes', event.target.value)} /></label></section>
    <section className="inclusive-card"><h3>融合活動規劃</h3><p className="inclusive-card-note">勾選學生預計與一般同儕共同參與的活動。</p><CheckboxList options={activityOptions} selected={value.activities} onToggle={(option) => toggle('activities', option)} />{value.activities.includes('其他') && <label className="inclusive-field conditional-inclusive-field">其他活動<input value={value.activityOther} onChange={(event) => update('activityOther', event.target.value)} /></label>}<label className="inclusive-field inclusive-field--full">參與方式與注意事項<textarea placeholder="請說明參與方式、需要協助的情境或相關注意事項" value={value.activityNotes} onChange={(event) => update('activityNotes', event.target.value)} /></label></section>
    <section className="inclusive-card"><h3>融合支持策略</h3><p className="inclusive-card-note">依學生參與普通班及校園活動之需求，勾選適合的支持方式。</p><CheckboxList options={strategyOptions} selected={value.strategies} onToggle={(option) => toggle('strategies', option)} />{value.strategies.includes('其他') && <label className="inclusive-field conditional-inclusive-field">其他支持策略<input value={value.strategyOther} onChange={(event) => update('strategyOther', event.target.value)} /></label>}<label className="inclusive-field inclusive-field--full">支持策略說明<textarea placeholder="請補充支持方式、使用情境或執行注意事項" value={value.strategyNotes} onChange={(event) => update('strategyNotes', event.target.value)} /></label></section>
  </section>
}
