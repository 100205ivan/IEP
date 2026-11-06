import { Router } from 'express'
import { cptCommentRequestSchema } from '../schemas/cptComment.js'
import { generateCptComment } from '../services/geminiCptComment.js'
import { GeminiRequestError, GeminiResponseInvalidError } from '../services/geminiDocumentAnalysis.js'

/** POST /api/cpt-comment: a short AI comment on a CPT result against the norms. */
export function createCptCommentRouter(generate = generateCptComment) {
  const router = Router()
  router.post('/', async (request, response) => {
    const parsed = cptCommentRequestSchema.safeParse(request.body)
    if (!parsed.success) return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: '請提供有效的 CPT 結果。' } })
    try {
      return response.json({ ok: true, data: { comment: await generate(parsed.data) } })
    } catch (error) {
      if (error instanceof GeminiResponseInvalidError) {
        console.error('CPT comment response invalid', { code: 'AI_RESPONSE_INVALID', kind: error.diagnostic?.kind ?? 'UNKNOWN_RESPONSE_INVALID' })
        return response.status(502).json({ ok: false, error: { code: 'AI_RESPONSE_INVALID', message: 'AI 評語格式不完整。' } })
      }
      if (error instanceof GeminiRequestError) {
        console.error('CPT comment failed', { code: 'AI_UNAVAILABLE', ...error.diagnostic })
        const missing = error.diagnostic.reason === 'MISSING_API_KEY'
        return response.status(503).json({ ok: false, error: { code: missing ? 'AI_NOT_CONFIGURED' : 'AI_UNAVAILABLE', message: missing ? '尚未設定 AI 服務。' : 'AI 服務暫時無法使用。' } })
      }
      console.error('CPT comment failed', { code: 'AI_COMMENT_FAILED' })
      return response.status(502).json({ ok: false, error: { code: 'AI_COMMENT_FAILED', message: '暫時無法產生評語。' } })
    }
  })
  return router
}

export const cptCommentRouter = createCptCommentRouter()
