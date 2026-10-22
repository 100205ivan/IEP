import { Router } from 'express'
import { documentAnalysisRequestSchema } from '../schemas/documentAnalysis.js'
import { analyzeDeidentifiedDocument, GeminiRequestError, GeminiResponseInvalidError } from '../services/geminiDocumentAnalysis.js'

export const assessmentDocumentRouter = Router()

assessmentDocumentRouter.post('/analyze', async (request, response) => {
  const requestResult = documentAnalysisRequestSchema.safeParse(request.body)
  if (!requestResult.success) {
    return response.status(400).json({
      ok: false,
      error: { code: 'INVALID_REQUEST', message: requestResult.error.issues[0]?.message ?? '請提供有效的去識別化文字。' },
    })
  }

  try {
    const analysis = await analyzeDeidentifiedDocument(requestResult.data.deidentifiedText)
    return response.status(200).json({ ok: true, data: analysis })
  } catch (error) {
    if (error instanceof GeminiResponseInvalidError) {
      console.error('Document analysis failed', { code: 'AI_RESPONSE_INVALID' })
      return response.status(502).json({ ok: false, error: { code: 'AI_RESPONSE_INVALID', message: '分析結果格式不符合要求，請重新分析。' } })
    }
    if (error instanceof GeminiRequestError) {
      console.error('Document analysis failed', { code: 'AI_UNAVAILABLE', ...error.diagnostic })
      return response.status(503).json({ ok: false, error: { code: 'AI_UNAVAILABLE', message: 'AI 文件分析服務暫時無法使用，請稍後再試。' } })
    }
    console.error('Document analysis failed', { code: 'AI_ANALYSIS_FAILED' })
    return response.status(502).json({ ok: false, error: { code: 'AI_ANALYSIS_FAILED', message: 'AI 文件分析暫時無法完成，請稍後再試。' } })
  }
})
