import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { AssessmentScope } from '../../context/assessmentRecordsStore'
import { generateEducationSummary } from '../../services/educationSummaryApi'
import { buildEducationSummaryInput } from '../../services/educationSummaryInput'
import type { KnownAssessmentIdentifiers } from '../../types/assessmentDocument'
import type { EducationSummaryDraft, SummaryField } from '../../types/educationSummary'
import { useAssessmentReferences } from '../../context/assessmentReferencesContext'
import type { AssessmentDetails, AssessmentSelections, StrengthWeaknessSummary } from './EducationalNeedsAssessment'

interface Props {
  selected: AssessmentSelections
  details: AssessmentDetails
  summary: StrengthWeaknessSummary
  setSummary: Dispatch<SetStateAction<StrengthWeaknessSummary>>
  identifiers: KnownAssessmentIdentifiers
  scope: AssessmentScope
  scopeActive: boolean
  isCurrentScope: (scope: AssessmentScope) => boolean
}

const fields: { key: SummaryField; label: string }[] = [
  { key: 'strengthNotes', label: '優勢能力補充說明' },
  { key: 'weaknessNotes', label: '弱勢能力補充說明' },
  { key: 'overallNeeds', label: '整體需求摘要' },
]

export function EducationSummaryAssistant({ selected, details, summary, setSummary, identifiers, scope, scopeActive, isCurrentScope }: Props) {
  const { records, documents, loading, error: referenceError, retry } = useAssessmentReferences()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState<EducationSummaryDraft | null>(null)
  const [source, setSource] = useState('')
  const [appliedFields, setAppliedFields] = useState<SummaryField[]>([])
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => { controller.current?.abort() }, [])
  const input = buildEducationSummaryInput(selected, details, summary, records, documents, identifiers)
  const stale = draft !== null && source !== input
  const tooLong = input.length > 40_000
  const disabled = busy || !scopeActive || loading || Boolean(referenceError) || !input.trim() || tooLong

  const generate = async () => {
    if (disabled) return
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setBusy(true); setError(''); setNotice('')
    const timeout = window.setTimeout(() => request.abort('timeout'), 40_000)
    try {
      const result = await generateEducationSummary(input, request.signal)
      if (request.signal.aborted || !isCurrentScope(scope)) return
      setDraft(result); setSource(input)
      setAppliedFields(fields.filter(field => field.key === 'overallNeeds' || !summary[field.key].trim()).map(field => field.key))
    } catch (reason) {
      if (!isCurrentScope(scope)) return
      if (request.signal.aborted) { if (request.signal.reason === 'timeout') setError('AI 產生摘要逾時，請稍後再試。'); return }
      setError(reason instanceof Error ? reason.message : '無法產生摘要，請稍後再試。')
    } finally {
      window.clearTimeout(timeout)
      if (controller.current === request) { controller.current = null; setBusy(false) }
    }
  }

  const apply = () => {
    if (!draft || stale || busy || !appliedFields.length || !scopeActive || !isCurrentScope(scope)) return
    const updates = Object.fromEntries(appliedFields.map(key => [key, draft[key]]))
    setSummary(current => ({ ...current, ...updates }))
    setDraft(null); setNotice('已套用勾選的摘要欄位，請按上方「儲存 IEP」保存。')
  }

  return <section className="education-summary-assistant" aria-labelledby="summary-assistant-title" aria-busy={busy}>
    <h4 id="summary-assistant-title">AI 協助產生摘要</h4>
    <p>依目前填寫的能力現況、優弱勢及已儲存的評量資料產生草稿。先核對內容，再選擇要套用的欄位。</p>
    <div className="summary-assistant-actions">
      <button className="button button--secondary" type="button" disabled={disabled} onClick={() => void generate()}>{busy ? '正在產生摘要…' : draft ? '重新產生摘要' : 'AI 協助產生摘要'}</button>
      {busy && <button className="text-button" type="button" onClick={() => { controller.current?.abort(); setBusy(false); setNotice('已取消產生摘要。') }}>取消產生</button>}
    </div>
    {loading && <p role="status">正在載入評量參考資料…</p>}
    {referenceError && <p className="summary-assistant-error" role="alert">評量參考資料尚未完整載入。<button className="text-button" type="button" onClick={retry}>重新載入</button></p>}
    {!loading && !input.trim() && <p>請先填寫能力觀察、優弱勢說明，或建立評量紀錄，再產生摘要。</p>}
    {tooLong && <p className="summary-assistant-error" role="alert">參考資料超過 40,000 字，請先精簡較長的紀錄後再試。</p>}
    {input.trim() && <details className="summary-assistant-source"><summary>查看送出的參考資料</summary><p>已遮蔽已知的學生及家長姓名、聯絡資料等識別資訊；請核對自由填寫的文字。</p><pre>{input}</pre></details>}
    {error && <p className="summary-assistant-error" role="alert">{error}</p>}
    {notice && <p className="summary-assistant-notice" role="status">{notice}</p>}
    {draft && <div className="summary-assistant-draft">
      <h4>摘要草稿</h4><p>可直接修改草稿。只有勾選的欄位會被套用，優弱勢向度的勾選維持原樣。</p>
      {draft.warnings.length > 0 && <div className="summary-assistant-warnings"><strong>需核對的資料</strong><ul>{draft.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
      {fields.map(field => <div className="summary-assistant-field" key={field.key}>
        <label className="summary-assistant-choice"><input type="checkbox" checked={appliedFields.includes(field.key)} onChange={event => setAppliedFields(current => event.target.checked ? [...current, field.key] : current.filter(key => key !== field.key))} />套用{field.label}</label>
        <label><span className="summary-assistant-label">{field.label}草稿</span><textarea value={draft[field.key]} maxLength={5000} rows={field.key === 'overallNeeds' ? 7 : 4} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} /></label>
      </div>)}
      {stale && <p className="summary-assistant-error" role="alert">能力現況、摘要或參考資料已更新，請重新產生草稿後再套用。</p>}
      <div className="summary-assistant-actions"><button className="button button--primary" type="button" disabled={stale || busy || !appliedFields.length || !scopeActive || appliedFields.some(key => !draft[key].trim())} onClick={apply}>套用勾選欄位</button><button className="text-button" type="button" onClick={() => setDraft(null)}>捨棄草稿</button></div>
    </div>}
  </section>
}
