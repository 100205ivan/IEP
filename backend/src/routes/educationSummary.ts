import { Router } from 'express'
import { educationSummaryRequestSchema } from '../schemas/educationSummary.js'
import { generateEducationSummary } from '../services/geminiEducationSummary.js'
import { GeminiRequestError, GeminiResponseInvalidError } from '../services/geminiDocumentAnalysis.js'

export function createEducationSummaryRouter(generate = generateEducationSummary) {
  const router = Router()
  router.post('/generate', async (request, response) => {
    const parsed = educationSummaryRequestSchema.safeParse(request.body)
    if (!parsed.success) return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? '請提供有效的摘要參考資料。' } })
    try {
      return response.json({ ok: true, data: await generate(parsed.data.deidentifiedText) })
    } catch (error) {
      if (error instanceof GeminiResponseInvalidError) return response.status(502).json({ ok: false, error: { code: 'AI_RESPONSE_INVALID', message: 'AI 摘要格式不完整，請重新產生。' } })
      if (error instanceof GeminiRequestError) {
        console.error('Education summary failed', { code: 'AI_UNAVAILABLE', ...error.diagnostic })
        const missing = error.diagnostic.reason === 'MISSING_API_KEY'
        return response.status(503).json({ ok: false, error: { code: missing ? 'AI_NOT_CONFIGURED' : 'AI_UNAVAILABLE', message: missing ? '尚未設定 AI 摘要服務，請聯絡管理者設定 Gemini API key。' : error.diagnostic.reason === 'PAYMENT_REQUIRED' ? 'Google AI 專案預付額度已用完，請由管理者在 AI Studio 補充額度後再試。' : error.diagnostic.reason === 'TIMEOUT' ? 'AI 產生摘要逾時，請稍後再試。' : error.diagnostic.reason === 'RATE_LIMITED' ? 'AI 服務目前額度不足或請求過多，請稍後再試。' : 'AI 摘要服務暫時無法使用，請稍後再試。' } })
      }
      console.error('Education summary failed', { code: 'AI_SUMMARY_FAILED' })
      return response.status(502).json({ ok: false, error: { code: 'AI_SUMMARY_FAILED', message: '暫時無法產生摘要，請稍後再試。' } })
    }
  })
  return router
}

export const educationSummaryRouter = createEducationSummaryRouter()
