import { Router } from 'express'
import type { ZodType } from 'zod'
import { cptCommentRequestSchema, monkeyCommentRequestSchema } from '../schemas/cptComment.js'
import { generateCptComment, generateMonkeyComment } from '../services/geminiCptComment.js'
import { GeminiRequestError, GeminiResponseInvalidError } from '../services/geminiDocumentAnalysis.js'

/** POST / : a short comment on a game result against its norms. */
export function createGameCommentRouter<T>(schema: ZodType<T>, generate: (request: T) => Promise<string>, label: string) {
  const router = Router()
  router.post('/', async (request, response) => {
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: `請提供有效的${label}結果。` } })
    try {
      return response.json({ ok: true, data: { comment: await generate(parsed.data) } })
    } catch (error) {
      if (error instanceof GeminiResponseInvalidError) {
        console.error(`${label} comment response invalid`, { code: 'AI_RESPONSE_INVALID', kind: error.diagnostic?.kind ?? 'UNKNOWN_RESPONSE_INVALID' })
        return response.status(502).json({ ok: false, error: { code: 'AI_RESPONSE_INVALID', message: '評語格式不完整。' } })
      }
      if (error instanceof GeminiRequestError) {
        console.error(`${label} comment failed`, { code: 'AI_UNAVAILABLE', ...error.diagnostic })
        const missing = error.diagnostic.reason === 'MISSING_API_KEY'
        return response.status(503).json({ ok: false, error: { code: missing ? 'AI_NOT_CONFIGURED' : 'AI_UNAVAILABLE', message: missing ? '尚未設定評語服務。' : '評語服務暫時無法使用。' } })
      }
      console.error(`${label} comment failed`, { code: 'AI_COMMENT_FAILED' })
      return response.status(502).json({ ok: false, error: { code: 'AI_COMMENT_FAILED', message: '暫時無法產生評語。' } })
    }
  })
  return router
}

export const createCptCommentRouter = (generate = generateCptComment) => createGameCommentRouter(cptCommentRequestSchema, generate, 'CPT')
export const cptCommentRouter = createCptCommentRouter()
export const monkeyCommentRouter = createGameCommentRouter(monkeyCommentRequestSchema, request => generateMonkeyComment(request), 'Monkey')
