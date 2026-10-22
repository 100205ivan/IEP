import type { DocumentAnalysisResult } from '../types/assessmentAnalysis'

export type DocumentAnalysisApiErrorCode = 'AI_UNAVAILABLE' | 'AI_RESPONSE_INVALID' | 'INVALID_REQUEST' | 'UNKNOWN'

export class DocumentAnalysisApiError extends Error {
  constructor(readonly code: DocumentAnalysisApiErrorCode) {
    super(code)
  }
}

function isDocumentAnalysisResult(value: unknown): value is DocumentAnalysisResult {
  return typeof value === 'object' && value !== null && 'id' in value && 'documentInfo' in value && 'overallSummary' in value && 'domains' in value && 'warnings' in value
}

export async function analyzeAssessmentDocument(deidentifiedText: string, signal?: AbortSignal): Promise<DocumentAnalysisResult> {
  let response: Response
  try {
    response = await fetch('/api/assessment-document/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deidentifiedText }),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new DocumentAnalysisApiError('AI_UNAVAILABLE')
  }

  let payload: unknown
  try { payload = await response.json() } catch { throw new DocumentAnalysisApiError('AI_RESPONSE_INVALID') }
  if (typeof payload !== 'object' || payload === null) throw new DocumentAnalysisApiError('AI_RESPONSE_INVALID')

  if (!response.ok) {
    const code = 'error' in payload && typeof payload.error === 'object' && payload.error !== null && 'code' in payload.error && typeof payload.error.code === 'string' ? payload.error.code : 'UNKNOWN'
    if (code === 'AI_UNAVAILABLE' || code === 'AI_RESPONSE_INVALID' || code === 'INVALID_REQUEST') throw new DocumentAnalysisApiError(code)
    throw new DocumentAnalysisApiError('UNKNOWN')
  }

  if (!('ok' in payload) || payload.ok !== true || !('data' in payload) || !isDocumentAnalysisResult(payload.data)) throw new DocumentAnalysisApiError('AI_RESPONSE_INVALID')
  return payload.data
}
