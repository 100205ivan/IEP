import { Router } from 'express'
import { domainAnalysisRequestSchema } from '../schemas/domainAnalysis.js'
import { GeminiRequestError, GeminiResponseInvalidError } from '../services/geminiDocumentAnalysis.js'
import { generateDomainAnalysis } from '../services/geminiDomainAnalysis.js'
import { getIep } from '../services/studentIepService.js'
import { getDocumentAnalysis, getGameAssessmentResult, listPersistedAssessments } from '../services/assessmentRecordService.js'

export const domainAnalysisRouter = Router()
const uuid = /^[0-9a-f-]{36}$/i

domainAnalysisRouter.post('/ieps/:iepId/domain-analysis', async (request, response, next) => {
  if (!uuid.test(request.params.iepId)) return response.status(400).json({ ok: false, error: { code: 'INVALID_ID', message: 'IEP 識別碼格式錯誤。' } })
  const parsed = domainAnalysisRequestSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? '請提供有效的能力向度資料。' } })
  try {
    if (!await getIep(request.params.iepId)) return response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到目前 IEP。' } })
    // References are rebuilt from the route-scoped IEP. Client-supplied references
    // are intentionally ignored so another IEP cannot be smuggled into analysis.
    const records = await listPersistedAssessments(request.params.iepId)
    const references: typeof parsed.data.references = []
    for (const record of records) {
      if (record.source === 'document') {
        const analysis = await getDocumentAnalysis(record.id, request.params.iepId)
        const domain = analysis?.domains[parsed.data.domain]
        if (domain?.hasEvidence) references.push({ source: 'document', text: [domain.summary, ...domain.evidence.map(item => item.content)].filter(Boolean).join('\n') })
      } else if (parsed.data.domain === 'cognitive' && (record.source === 'monkey' || record.source === 'cpt')) {
        const game = await getGameAssessmentResult(record.id, request.params.iepId)
        if (game) references.push({ source: game.gameType, text: `${game.gameType === 'monkey' ? 'Monkey 工作記憶' : 'CPT 持續注意力'}：${game.summary}（僅供該次任務參考，非診斷）` })
      }
    }
    const result = await generateDomainAnalysis({ ...parsed.data, references })
    return response.json({ ok: true, data: result })
  } catch (error) {
    if (error instanceof GeminiResponseInvalidError) {
      console.error('Domain analysis response invalid', {
        route: 'POST /api/ieps/:iepId/domain-analysis',
        httpStatus: 502,
        code: 'AI_RESPONSE_INVALID',
        kind: error.diagnostic?.kind ?? 'UNKNOWN_RESPONSE_INVALID',
        issues: error.diagnostic?.issues,
      })
      return response.status(502).json({ ok: false, error: { code: 'AI_RESPONSE_INVALID', message: 'AI 分析結果格式異常，請重新分析。' } })
    }
    if (error instanceof GeminiRequestError) {
      console.error('Domain analysis failed', {
        route: 'POST /api/ieps/:iepId/domain-analysis',
        httpStatus: 503,
        code: 'AI_UNAVAILABLE',
        model: error.diagnostic.model,
        errorName: error.diagnostic.errorName,
        reason: error.diagnostic.reason,
      })
      return response.status(503).json({ ok: false, error: { code: 'AI_UNAVAILABLE', message: 'AI 分析服務暫時無法使用，請稍後再試。' } })
    }
    return next(error)
  }
})
