import { GEMINI_DOCUMENT_ANALYSIS_MODEL } from './gemini.js'

export type GeminiDiagnostic = {
  model: string
  errorName: string
  httpStatus: number | null
  reason: 'MISSING_API_KEY' | 'TIMEOUT' | 'BAD_REQUEST' | 'AUTHENTICATION_FAILED' | 'PERMISSION_DENIED' | 'MODEL_NOT_FOUND' | 'RATE_LIMITED' | 'UPSTREAM_ERROR' | 'SDK_OR_NETWORK_ERROR'
}

export function safeGeminiDiagnostic(error: unknown, model = GEMINI_DOCUMENT_ANALYSIS_MODEL): GeminiDiagnostic {
  const object = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {}
  const statusValue = object.status ?? object.statusCode
  const httpStatus = typeof statusValue === 'number' && Number.isInteger(statusValue) && statusValue >= 100 && statusValue <= 599 ? statusValue : null
  const errorName = error instanceof Error && error.name ? error.name : 'UnknownError'
  const reason = httpStatus === 400 ? 'BAD_REQUEST'
    : httpStatus === 401 ? 'AUTHENTICATION_FAILED'
      : httpStatus === 403 ? 'PERMISSION_DENIED'
        : httpStatus === 404 ? 'MODEL_NOT_FOUND'
          : httpStatus === 429 ? 'RATE_LIMITED'
            : httpStatus !== null && httpStatus >= 500 ? 'UPSTREAM_ERROR'
              : 'SDK_OR_NETWORK_ERROR'
  return { model, errorName, httpStatus, reason }
}
