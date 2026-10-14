import type { Dispatch, SetStateAction } from 'react'

const subjects = ['全部課程', '國語', '英語', '數學', '自然', '社會', '藝術', '健康與體育', '綜合活動', '特殊需求領域', '其他']
const adjustmentGroups = [
  { id: 'environment', title: '學習環境調整', options: ['座位調整', '同儕協助', '教室動線調整', '減少環境干擾刺激', '提供獨立／安靜學習空間', '調整教室光線或聲音', '提供視覺提示', '輔具或學習設備', '其他'], placeholder: '請說明學習環境的具體調整方式或使用情境' },
  { id: 'content', title: '學習內容調整', options: ['個別化教材', '教材內容簡化', '調整學習內容難度', '減少學習內容份量', '提供重點整理', '提供圖像／視覺化教材', '將抽象內容具體化', '增加生活化或實作內容', '其他'], placeholder: '請說明學習內容的具體調整方式或使用情境' },
  { id: 'process', title: '學習歷程調整', options: ['工作分析／步驟化教學', '分段指令', '重複或簡化指令', '多感官教學', '示範後操作', '增加練習機會', '延長學習時間', '調整學習速度', '合作學習', '同儕示範／協助', '視覺流程提示', '提供立即回饋', '其他'], placeholder: '請說明學習歷程的具體調整方式或使用情境' },
  { id: 'assessment', title: '學習評量調整', options: ['延長評量時間', '分段評量', '減少題量', '調整題目難度', '口語評量', '操作評量', '實作評量', '動作／圖片指認', '提供題目語音或報讀', '提供較清楚的作答提示', '調整評量環境', '其他'], placeholder: '請說明學習評量的具體調整方式或使用情境' },
] as const

export type AdjustmentKind = typeof adjustmentGroups[number]['id']
export interface AdjustmentValue { selectedStrategies: string[]; otherStrategy: string; applicableSubjects: string[]; otherSubject: string; description: string }
export type CurriculumAdjustmentValue = Record<AdjustmentKind, AdjustmentValue>
const emptyAdjustment = (): AdjustmentValue => ({ selectedStrategies: [], otherStrategy: '', applicableSubjects: [], otherSubject: '', description: '' })
export const initialCurriculumAdjustment: CurriculumAdjustmentValue = { environment: emptyAdjustment(), content: emptyAdjustment(), process: emptyAdjustment(), assessment: emptyAdjustment() }

function CheckboxList({ options, selected, onToggle }: { options: readonly string[]; selected: string[]; onToggle: (option: string) => void }) { return <div className="adjustment-checkbox-list">{options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />{option}</label>)}</div> }

function AdjustmentCard({ group, value, onChange }: { group: typeof adjustmentGroups[number]; value: AdjustmentValue; onChange: (next: AdjustmentValue) => void }) {
  const toggleStrategy = (option: string) => onChange({ ...value, selectedStrategies: value.selectedStrategies.includes(option) ? value.selectedStrategies.filter((item) => item !== option) : [...value.selectedStrategies, option] })
  const toggleSubject = (option: string) => {
    const selected = value.applicableSubjects
    const next = option === '全部課程' ? (selected.includes(option) ? [] : [option]) : (selected.includes(option) ? selected.filter((item) => item !== option) : [...selected.filter((item) => item !== '全部課程'), option])
    onChange({ ...value, applicableSubjects: next })
  }
  return <section className="adjustment-card"><h2>{group.title}</h2><div className="adjustment-section"><h3>調整策略</h3><CheckboxList options={group.options} selected={value.selectedStrategies} onToggle={toggleStrategy} />{value.selectedStrategies.includes('其他') && <label className="adjustment-field conditional-adjustment-field">其他調整策略<input value={value.otherStrategy} onChange={(event) => onChange({ ...value, otherStrategy: event.target.value })} /></label>}</div><div className="adjustment-section"><h3>適用課程／領域</h3><CheckboxList options={subjects} selected={value.applicableSubjects} onToggle={toggleSubject} />{value.applicableSubjects.includes('其他') && <label className="adjustment-field conditional-adjustment-field">其他課程／領域<input value={value.otherSubject} onChange={(event) => onChange({ ...value, otherSubject: event.target.value })} /></label>}</div><label className="adjustment-field adjustment-field--full">調整說明<textarea placeholder={group.placeholder} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></label></section>
}

export function CurriculumAdjustment({ value, onChange }: { value: CurriculumAdjustmentValue; onChange: Dispatch<SetStateAction<CurriculumAdjustmentValue>> }) {
  return <section className="curriculum-adjustment" id="services-curriculum-adjustment" role="tabpanel" aria-labelledby="services-tab-curriculum-adjustment"><div className="curriculum-adjustment-heading"><h2>三、課程調整方式</h2><p>依學生學習需求，規劃學習環境、學習內容、學習歷程及學習評量之調整方式。</p></div><div className="adjustment-card-grid">{adjustmentGroups.map((group) => <AdjustmentCard key={group.id} group={group} value={value[group.id]} onChange={(next) => onChange((current) => ({ ...current, [group.id]: next }))} />)}</div></section>
}
