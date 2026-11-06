import { domainAnalysisJsonSchema, domainAnalysisResponseSchema, type DomainAnalysisRequest, type DomainAnalysisResponse } from '../schemas/domainAnalysis.js'
import { GeminiResponseInvalidError, requestStructuredGemini, zodResponseInvalidDiagnostic } from './geminiDocumentAnalysis.js'

const instruction = `你是協助教師撰寫 IEP 能力現況與教育需求的專業分析助手。只使用輸入資料，不可捏造學生表現、數字、診斷、頻率、時間、正確率或未觀察事實。
本次只分析指定的單一能力向度；不可把單一分項擴大為整體能力困難。已明確填寫「正常」「不需要」「無影響」的項目，應尊重其現況，不強迫追問量化資料；未勾選的項目不可推定為正常。
第一階段若資料不足，只回傳真正需要補充的問題，問題數量依缺漏動態決定，最多 5 題，可以是 0 題。追問優先補足：發生課堂／活動／指令情境、可觀察行為、發生頻率、持續時間、是否需要提示及提示後反應、對學習／課堂參與／指令理解的影響，以及教師已確認的次數、時間、正確率或完成程度。問題必須是單選或多選，每題必須有 2 至 9 個具體且互不重複的選項；不可加入尚未觀察、跳過、跳過此題等選項。只保留一個「不確定」選項，且可允許其他。問題要針對目前向度與目前缺漏，不使用所有向度共用的固定問題。
若資料足夠，questions 必須是空陣列並直接產生草稿。能力現況結語要求具體、客觀、可觀察；有資料時才引用頻率、持續時間、次數、正確率或完成程度。教育需求只能根據已知影響與支持需求。班級適應影響必須是一段可直接填入 IEP 的專業說明：以已知能力現況、教師觀察及確認的補充回答，說明在何種班級或學習情境可能出現何種可觀察表現及其影響；不可把未填資料當正常、不可自行推論診斷或捏造數字。若資訊仍不足，仍須提供保守、可編輯的初步說明，清楚指出未確認處，不能只回傳資料不足或分析依據。SMART 草稿只供參考，若缺少基準、改善程度、條件或期限，對應欄位必須是 null 且 incomplete=true，不得自行填值。
遊戲及攝影機資料只能作該次任務或觀察參考，不得作為診斷或整體能力結論。輸出必須完全符合 JSON Schema。`

function prompt(input: DomainAnalysisRequest) {
  const hasSupplementalAnswers = input.supplementalAnswers.length > 0
  const stageInstruction = hasSupplementalAnswers
    ? '教師已完成補充問答。questions 必須為空陣列；現在必須產生 professionalCurrentStatus、classAdaptationImpact 與 educationNeeds。即使回答為未知或資料不足，classAdaptationImpact 也必須提供可編輯的保守初步說明，並將未知處放在 warnings，不可只回傳依據或限制。'
    : '請先檢查資料完整性；若不足，questions 只問必要缺漏，結語欄位可為 null。若不需追問，請直接產生所有結語。'
  return `指定向度：${input.domain}（${input.domainLabel}）\n教師勾選：${JSON.stringify(input.selections)}\n教師說明：${JSON.stringify(input.details)}\n對應評量參考：${JSON.stringify(input.references)}\n教師補充回答：${JSON.stringify(input.supplementalAnswers)}\n${stageInstruction}`
}

export async function generateDomainAnalysis(input: DomainAnalysisRequest): Promise<DomainAnalysisResponse> {
  const raw = await requestStructuredGemini(prompt(input), domainAnalysisJsonSchema, instruction, { source: 'domain', schemaName: 'domain-analysis-v1', referenceCount: input.references.length })
  if (!raw?.trim()) throw new GeminiResponseInvalidError('Gemini returned an empty domain analysis.', { kind: 'EMPTY_RESPONSE' })

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new GeminiResponseInvalidError('Gemini returned malformed domain analysis JSON.', { kind: 'JSON_PARSE_FAILED' })
  }

  const validated = domainAnalysisResponseSchema.safeParse(value)
  if (!validated.success) {
    throw new GeminiResponseInvalidError('Gemini returned a domain analysis that failed schema validation.', zodResponseInvalidDiagnostic(validated.error.issues))
  }

  if (validated.data.domain !== input.domain) {
    throw new GeminiResponseInvalidError('Gemini returned an analysis for a different domain.', { kind: 'DOMAIN_MISMATCH' })
  }

  const questions = validated.data.questions.map(question => ({ ...question, options: normalizeQuestionOptions(question), allowOther: true }))
  return { ...validated.data, questions }
}

export function normalizeQuestionOptions(question: DomainAnalysisResponse['questions'][number]) {
  const isSkipLike = (value: string) => /^(not_?observed|skip|skipped)$/i.test(value) || /(尚未觀察|未觀察|跳過|略過)/.test(value)
  const isUnknown = (value: string) => /^(unknown|uncertain)$/i.test(value) || /(未知|不確定|無法確認|無法判斷|未確認)/.test(value)
  const seen = new Set<string>()
  const options = question.options.flatMap(option => {
    if (isSkipLike(option.semanticValue) || isSkipLike(option.label)) return []
    const normalized = isUnknown(option.semanticValue) || isUnknown(option.label) ? { ...option, semanticValue: 'uncertain', label: '不確定' } : option
    const key = normalized.semanticValue === 'uncertain' ? 'uncertain' : normalized.label.trim().replace(/\s+/g, '').toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)
    return [normalized]
  })
  const uncertain = options.find(option => option.semanticValue === 'uncertain')
  const ordinary = options.filter(option => option.semanticValue !== 'uncertain').slice(0, 8)
  return [...ordinary, uncertain ?? { id: `${question.id}-uncertain`, label: '不確定', semanticValue: 'uncertain' }]
}
