import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { GEMINI_DOCUMENT_ANALYSIS_MODEL, GEMINI_DOCUMENT_ANALYSIS_TIMEOUT_MS } from '../config/gemini.js'
import { safeGeminiDiagnostic } from '../config/geminiDiagnostic.js'
import { GeminiRequestError, GeminiResponseInvalidError, analyzeDeidentifiedDocument, requestStructuredGemini } from '../services/geminiDocumentAnalysis.js'
import { generateDomainAnalysis } from '../services/geminiDomainAnalysis.js'

type Target = 'json-mime' | 'json-schema' | 'structured' | 'document' | 'domain'

const target = process.argv[2] as Target | undefined

function print(value: unknown) {
  console.log(JSON.stringify(value))
}

function failure(test: Target, error: unknown, durationMs: number) {
  if (error instanceof GeminiRequestError) return print({ test, ok: false, durationMs, schemaValidation: 'NOT_REACHED', error: error.diagnostic })
  if (error instanceof GeminiResponseInvalidError) return print({ test, ok: false, durationMs, schemaValidation: 'FAILED', error: { model: GEMINI_DOCUMENT_ANALYSIS_MODEL, httpStatus: null, errorName: error.name, reason: error.diagnostic?.kind ?? 'RESPONSE_INVALID', issues: error.diagnostic?.issues } })
  return print({ test, ok: false, durationMs, schemaValidation: 'NOT_REACHED', error: safeGeminiDiagnostic(error) })
}

function withDiagnosticTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new GeminiRequestError({ model: GEMINI_DOCUMENT_ANALYSIS_MODEL, errorName: 'TimeoutError', httpStatus: null, reason: 'TIMEOUT' })), GEMINI_DOCUMENT_ANALYSIS_TIMEOUT_MS)
    promise.then(value => { clearTimeout(timeout); resolve(value) }, error => { clearTimeout(timeout); reject(error) })
  })
}

async function directJsonDiagnostic(test: 'json-mime' | 'json-schema') {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  const startedAt = performance.now()
  if (!apiKey) throw new GeminiRequestError({ model: GEMINI_DOCUMENT_ANALYSIS_MODEL, errorName: 'ConfigurationError', httpStatus: null, reason: 'MISSING_API_KEY' })
  const baseConfig = { responseMimeType: 'application/json' as const, httpOptions: { timeout: GEMINI_DOCUMENT_ANALYSIS_TIMEOUT_MS } }
  const config = test === 'json-schema'
    ? { ...baseConfig, responseJsonSchema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } } }
    : baseConfig
  const response = await withDiagnosticTimeout(new GoogleGenAI({ apiKey }).models.generateContent({ model: GEMINI_DOCUMENT_ANALYSIS_MODEL, contents: '只回傳 JSON 物件，包含布林欄位 ok，值為 true。', config }))
  const durationMs = Math.round(performance.now() - startedAt)
  if (!response.text?.trim()) throw new GeminiResponseInvalidError('Empty JSON diagnostic response.', { kind: 'EMPTY_RESPONSE' })
  let value: unknown
  try { value = JSON.parse(response.text) } catch { throw new GeminiResponseInvalidError('Malformed JSON diagnostic response.', { kind: 'JSON_PARSE_FAILED' }) }
  const validation = test === 'json-schema' ? z.object({ ok: z.boolean() }).strict().safeParse(value).success : true
  print({ test, ok: validation, model: GEMINI_DOCUMENT_ANALYSIS_MODEL, httpStatus: null, errorName: null, reason: null, durationMs, jsonParse: 'PASSED', schemaValidation: test === 'json-schema' ? (validation ? 'PASSED' : 'FAILED') : 'NOT_APPLIED' })
}

async function diagnoseStructured() {
  const schema = z.object({ ok: z.boolean() }).strict()
  const raw = await requestStructuredGemini(
    '回傳一個只含 ok 欄位的 JSON 物件，值必須為 true。',
    { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
  )
  if (!raw?.trim()) throw new GeminiResponseInvalidError('Empty structured diagnostic response.', { kind: 'EMPTY_RESPONSE' })
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new GeminiResponseInvalidError('Malformed structured diagnostic JSON.', { kind: 'JSON_PARSE_FAILED' }) }
  if (!schema.safeParse(value).success) throw new GeminiResponseInvalidError('Structured diagnostic schema validation failed.', { kind: 'ZOD_VALIDATION_FAILED' })
  print({ test: 'structured', ok: true, model: GEMINI_DOCUMENT_ANALYSIS_MODEL, httpStatus: null, errorName: null, reason: null, schemaValidation: 'PASSED' })
}

async function diagnoseDocument() {
  await analyzeDeidentifiedDocument('匿名學生在課堂活動中，經一次口頭提醒後可完成兩步驟整理作業；未提供其他評量資訊。')
  print({ test: 'document', ok: true, model: GEMINI_DOCUMENT_ANALYSIS_MODEL, httpStatus: null, errorName: null, reason: null, schemaValidation: 'PASSED' })
}

async function diagnoseDomain() {
  await generateDomainAnalysis({
    domain: 'cognitive',
    domainLabel: '認知能力',
    selections: { attention: ['教師觀察到需要口頭提醒'] },
    details: { 'cognitive-classImpactDescription': '在團體活動中經一次口頭提醒後可回到作業。' },
    references: [],
    supplementalAnswers: [],
  })
  print({ test: 'domain', ok: true, model: GEMINI_DOCUMENT_ANALYSIS_MODEL, httpStatus: null, errorName: null, reason: null, schemaValidation: 'PASSED' })
}

if (target !== 'json-mime' && target !== 'json-schema' && target !== 'structured' && target !== 'document' && target !== 'domain') {
  print({ ok: false, error: { reason: 'INVALID_TARGET', message: 'Use one of: json-mime, json-schema, structured, document, domain.' } })
  process.exitCode = 1
} else {
  const startedAt = performance.now()
  const run = target === 'json-mime' || target === 'json-schema' ? () => directJsonDiagnostic(target) : target === 'structured' ? diagnoseStructured : target === 'document' ? diagnoseDocument : diagnoseDomain
  void run().catch(error => {
    failure(target, error, Math.round(performance.now() - startedAt))
    process.exitCode = 1
  })
}
