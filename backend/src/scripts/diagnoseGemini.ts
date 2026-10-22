import { GoogleGenAI } from '@google/genai'
import { GEMINI_DOCUMENT_ANALYSIS_TIMEOUT_MS } from '../config/gemini.js'
import { safeGeminiDiagnostic } from '../config/geminiDiagnostic.js'

const DIAGNOSTIC_MODEL = 'gemini-3.5-flash-lite'

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout')), GEMINI_DOCUMENT_ANALYSIS_TIMEOUT_MS)
    promise.then(value => { clearTimeout(timeout); resolve(value) }, error => { clearTimeout(timeout); reject(error) })
  })
}

async function diagnose() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.log(JSON.stringify({ ok: false, error: { model: DIAGNOSTIC_MODEL, errorName: 'ConfigurationError', httpStatus: null, reason: 'MISSING_API_KEY' } }))
    process.exitCode = 1
    return
  }

  try {
    const client = new GoogleGenAI({ apiKey })
    const response = await withTimeout(client.models.generateContent({
      model: DIAGNOSTIC_MODEL,
      contents: '請只回答：測試成功',
    }))
    if (!response.text?.trim()) throw new Error('empty response')
    console.log(JSON.stringify({ ok: true, model: DIAGNOSTIC_MODEL }))
  } catch (error) {
    const diagnostic = error instanceof Error && error.message === 'timeout'
      ? { model: DIAGNOSTIC_MODEL, errorName: 'TimeoutError', httpStatus: null, reason: 'TIMEOUT' as const }
      : safeGeminiDiagnostic(error, DIAGNOSTIC_MODEL)
    console.log(JSON.stringify({ ok: false, error: diagnostic }))
    process.exitCode = 1
  }
}

void diagnose()
