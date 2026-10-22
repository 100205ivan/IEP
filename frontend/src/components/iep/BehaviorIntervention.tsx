import type { Dispatch, SetStateAction } from 'react'

export type NeedStatus = '暫無需求' | '有需求'
export interface ChoiceGroup { selected: string[]; other: string }
export interface BehaviorFunction { selected: string[]; notes: Record<string, string> }
export interface BehaviorInterventionValue {
  needStatus: NeedStatus
  planStatus: string
  planPeriod: { startDate: string; endDate: string }
  behaviorAssessment: { definition: string; time: string; location: string; triggers: string; frequency: string; duration: string }
  behaviorFunctions: BehaviorFunction
  interventionGoal: string
  antecedentStrategies: { environment: ChoiceGroup; curriculum: ChoiceGroup; interaction: ChoiceGroup; notes: string }
  teachingStrategies: ChoiceGroup & { notes: string }
  consequenceStrategies: { increase: ChoiceGroup; reduce: ChoiceGroup; notes: string }
  individualFactors: string
  administrativeSupports: ChoiceGroup
  implementers: ChoiceGroup
  outcomeEvaluation: { date: string; methods: ChoiceGroup; result: string; resultOther: string; recommendation: string; recommendationOther: string; notes: string }
}

const functions = ['獲得內在刺激', '獲得外在刺激', '逃避內在刺激', '逃避外在刺激', '其他']
const environment = ['提供示範', '預告或提示', '調整座位／活動地點', '調整物理環境', '建立結構化環境', '提供豐富多元環境', '安排同儕支持', '調整班規', '提供學習／溝通輔具', '其他']
const curriculum = ['調整份量', '調整時間表', '調整完成方式', '調整呈現方式', '調整評量方式', '調整內容', '調整難度', '其他']
const interaction = ['提供正向回饋與鼓勵', '建立正向社會關係', '親職教育', '溝通教養觀念', '其他']
const teaching = ['功能等值替代／替代行為', '社會技巧', '生活管理', '學習策略', '溝通訓練', '科技輔具應用', '自我管理訓練', '放鬆訓練', '支持性心理治療', '行為治療', '休閒生活訓練', '其他']
const increase = ['原級增強', '活動增強', '代幣系統', '社會性增強', '自我增強', '其他']
const reduce = ['消弱', '反應代價', '隔離', '過度矯正', '其他']
const administrative = ['尋求特教專業諮詢', '提供家長諮詢', '安排認輔教師', '安排小團體輔導', '社會團體協助', '社工介入', '安排專業治療', '校園危機處理小組協助', '提供個案班級學生輔導', '加強親職教育', '提供人力支持', '連結校內／外資源', '提供教材教具資源', '召開個案會議', '其他']
const implementers = ['班級教師／教保員', '巡迴輔導教師', '家長', '教師助理員', '行政人員', '其他']
const evaluationMethods = ['行為檢核表', '訪談紀錄', '入班觀察紀錄表', '學生自我評估', '其他']

function Checklist({ options, value, onChange }: { options: string[]; value: ChoiceGroup; onChange: (next: ChoiceGroup) => void }) {
  const toggle = (item: string) => onChange({ ...value, selected: value.selected.includes(item) ? value.selected.filter((x) => x !== item) : [...value.selected, item] })
  return <><div className="behavior-checks">{options.map((item) => <label key={item}><input type="checkbox" checked={value.selected.includes(item)} onChange={() => toggle(item)} />{item}</label>)}</div>{value.selected.includes('其他') && <label className="behavior-other">其他具體內容<input value={value.other} onChange={(event) => onChange({ ...value, other: event.target.value })} /></label>}</>
}

function StrategyGroup({ title, options, value, onChange }: { title: string; options: string[]; value: ChoiceGroup; onChange: (next: ChoiceGroup) => void }) { return <section className="strategy-option-group"><h4>{title}</h4><Checklist options={options} value={value} onChange={onChange} /></section> }

export function BehaviorIntervention({ value, onChange }: { value: BehaviorInterventionValue; onChange: Dispatch<SetStateAction<BehaviorInterventionValue>> }) {
  const update = <K extends keyof BehaviorInterventionValue>(key: K, next: BehaviorInterventionValue[K]) => onChange((current) => ({ ...current, [key]: next }))
  const updateAssessment = <K extends keyof BehaviorInterventionValue['behaviorAssessment']>(key: K, next: string) => update('behaviorAssessment', { ...value.behaviorAssessment, [key]: next })
  const updateOutcome = <K extends keyof BehaviorInterventionValue['outcomeEvaluation']>(key: K, next: BehaviorInterventionValue['outcomeEvaluation'][K]) => update('outcomeEvaluation', { ...value.outcomeEvaluation, [key]: next })
  const toggleFunction = (item: string) => update('behaviorFunctions', { ...value.behaviorFunctions, selected: value.behaviorFunctions.selected.includes(item) ? value.behaviorFunctions.selected.filter((x) => x !== item) : [...value.behaviorFunctions.selected, item] })

  return <section className="behavior-page" id="chapter-intervention" role="tabpanel" aria-labelledby="chapter-tab-intervention">
    <div className="section-heading"><p className="eyebrow">肆</p><h1>具情緒與行為問題學生所需之行為功能介入方案及行政支援</h1><p>依行為功能評估結果，規劃適切介入策略、行政支援及後續評估。</p></div>
    <section className="behavior-card"><h2>行為功能介入需求</h2><div className="behavior-radios">{(['暫無需求', '有需求'] as NeedStatus[]).map((item) => <label key={item}><input type="radio" name="behavior-need" checked={value.needStatus === item} onChange={() => update('needStatus', item)} />經評估，學生{item === '暫無需求' ? '暫無此需求' : '有需求'}</label>)}</div></section>
    {value.needStatus === '有需求' && <div className="behavior-plan">
      <section className="behavior-card"><h2>方案狀態</h2><div className="behavior-radios">{['建立新的行為功能介入方案', '維持前次行為功能介入方案，繼續執行', '調整前次行為功能介入方案，繼續執行'].map((item) => <label key={item}><input type="radio" name="behavior-plan-status" checked={value.planStatus === item} onChange={() => update('planStatus', item)} />{item}</label>)}</div></section>
      <section className="behavior-card"><h2>行為功能評估</h2><div className="behavior-fields"><label>計畫開始日期<input type="date" value={value.planPeriod.startDate} onChange={(e) => update('planPeriod', { ...value.planPeriod, startDate: e.target.value })} /></label><label>計畫結束日期<input type="date" value={value.planPeriod.endDate} onChange={(e) => update('planPeriod', { ...value.planPeriod, endDate: e.target.value })} /></label><label className="behavior-full">行為界定／問題行為（含情境）<textarea value={value.behaviorAssessment.definition} onChange={(e) => updateAssessment('definition', e.target.value)} /></label><label>發生時間<input value={value.behaviorAssessment.time} onChange={(e) => updateAssessment('time', e.target.value)} /></label><label>發生地點<input value={value.behaviorAssessment.location} onChange={(e) => updateAssessment('location', e.target.value)} /></label><label>引發因素<input value={value.behaviorAssessment.triggers} onChange={(e) => updateAssessment('triggers', e.target.value)} /></label><label>行為頻率<input value={value.behaviorAssessment.frequency} onChange={(e) => updateAssessment('frequency', e.target.value)} /></label><label>持續時間<input value={value.behaviorAssessment.duration} onChange={(e) => updateAssessment('duration', e.target.value)} /></label></div><fieldset className="behavior-functions"><legend>行為功能分析</legend>{functions.map((item) => <div className="function-row" key={item}><label><input type="checkbox" checked={value.behaviorFunctions.selected.includes(item)} onChange={() => toggleFunction(item)} />{item}</label>{value.behaviorFunctions.selected.includes(item) && <input aria-label={`${item}說明`} placeholder={`${item}說明`} value={value.behaviorFunctions.notes[item] ?? ''} onChange={(e) => update('behaviorFunctions', { ...value.behaviorFunctions, notes: { ...value.behaviorFunctions.notes, [item]: e.target.value } })} />}</div>)}</fieldset></section>
      <section className="behavior-card"><h2>行為介入目標</h2><label className="behavior-field"><textarea placeholder="例如：以口語詢問並經過他人同意後再拿取物品。" value={value.interventionGoal} onChange={(e) => update('interventionGoal', e.target.value)} /></label></section>
      <section className="behavior-card"><h2>介入策略</h2><section className="strategy-section"><h3>A. 前事處理與先兆控制</h3><div className="strategy-grid"><StrategyGroup title="環境／情境調整" options={environment} value={value.antecedentStrategies.environment} onChange={(next) => update('antecedentStrategies', { ...value.antecedentStrategies, environment: next })} /><StrategyGroup title="課程／作業調整" options={curriculum} value={value.antecedentStrategies.curriculum} onChange={(next) => update('antecedentStrategies', { ...value.antecedentStrategies, curriculum: next })} /><StrategyGroup title="互動／支持調整" options={interaction} value={value.antecedentStrategies.interaction} onChange={(next) => update('antecedentStrategies', { ...value.antecedentStrategies, interaction: next })} /></div><label className="behavior-field">具體策略說明<textarea value={value.antecedentStrategies.notes} onChange={(e) => update('antecedentStrategies', { ...value.antecedentStrategies, notes: e.target.value })} /></label></section><section className="strategy-section"><h3>B. 行為教導</h3><Checklist options={teaching} value={value.teachingStrategies} onChange={(next) => update('teachingStrategies', { ...next, notes: value.teachingStrategies.notes })} /><label className="behavior-field">具體策略說明<textarea value={value.teachingStrategies.notes} onChange={(e) => update('teachingStrategies', { ...value.teachingStrategies, notes: e.target.value })} /></label></section><section className="strategy-section"><h3>C. 後果處理</h3><div className="strategy-grid"><StrategyGroup title="增加適當行為" options={increase} value={value.consequenceStrategies.increase} onChange={(next) => update('consequenceStrategies', { ...value.consequenceStrategies, increase: next })} /><StrategyGroup title="減少不當行為" options={reduce} value={value.consequenceStrategies.reduce} onChange={(next) => update('consequenceStrategies', { ...value.consequenceStrategies, reduce: next })} /></div><label className="behavior-field">具體策略說明<textarea value={value.consequenceStrategies.notes} onChange={(e) => update('consequenceStrategies', { ...value.consequenceStrategies, notes: e.target.value })} /></label></section><label className="behavior-field behavior-individual">其他個體背景因素介入策略<textarea placeholder="例如：依學生生理狀況、服藥情形或其他個別因素進行調整。" value={value.individualFactors} onChange={(e) => update('individualFactors', e.target.value)} /></label></section>
      <section className="behavior-card"><h2>行政支援</h2><Checklist options={administrative} value={value.administrativeSupports} onChange={(next) => update('administrativeSupports', next)} /><div className="implementer-section"><h3>執行人員</h3><Checklist options={implementers} value={value.implementers} onChange={(next) => update('implementers', next)} /></div></section>
      <section className="behavior-card"><h2>執行成效評估及後續建議</h2><div className="behavior-fields"><label>成效評估日期<input type="date" value={value.outcomeEvaluation.date} onChange={(e) => updateOutcome('date', e.target.value)} /></label></div><fieldset><legend>評估方式</legend><Checklist options={evaluationMethods} value={value.outcomeEvaluation.methods} onChange={(next) => updateOutcome('methods', next)} /></fieldset><div className="outcome-grid"><fieldset><legend>執行結果</legend>{['行為問題已適當改善', '已建立新的替代行為', '介入未達預期效果', '其他'].map((item) => <label className="behavior-radio" key={item}><input type="radio" name="behavior-result" checked={value.outcomeEvaluation.result === item} onChange={() => updateOutcome('result', item)} />{item}</label>)}{value.outcomeEvaluation.result === '其他' && <input aria-label="其他執行結果" value={value.outcomeEvaluation.resultOther} onChange={(e) => updateOutcome('resultOther', e.target.value)} />}</fieldset><fieldset><legend>後續建議</legend>{['終止介入方案', '繼續執行介入方案', '調整介入方案', '建立新介入方案', '其他'].map((item) => <label className="behavior-radio" key={item}><input type="radio" name="behavior-recommendation" checked={value.outcomeEvaluation.recommendation === item} onChange={() => updateOutcome('recommendation', item)} />{item}</label>)}{value.outcomeEvaluation.recommendation === '其他' && <input aria-label="其他後續建議" value={value.outcomeEvaluation.recommendationOther} onChange={(e) => updateOutcome('recommendationOther', e.target.value)} />}</fieldset></div><label className="behavior-field">執行結果／相關說明<textarea value={value.outcomeEvaluation.notes} onChange={(e) => updateOutcome('notes', e.target.value)} /></label></section>
    </div>}
  </section>
}
