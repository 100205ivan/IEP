import { GEMINI_DOCUMENT_ANALYSIS_MODEL } from '../config/gemini.js'
import { GeminiRequestError, GeminiResponseInvalidError, analyzeDeidentifiedDocument } from '../services/geminiDocumentAnalysis.js'
import { generateDomainAnalysis } from '../services/geminiDomainAnalysis.js'

type Target = 'document-d1' | 'document-d2' | 'document-d4' | 'domain-a1' | 'domain-a2' | 'domain-a3' | 'domain-a4'

const target = process.argv[2] as Target | undefined

function textOfLength(length: number) {
  const unit = '匿名觀察：學生在課堂活動中依口頭提示完成指定步驟。'
  return unit.repeat(Math.ceil(length / unit.length)).slice(0, length)
}

function print(value: unknown) {
  console.log(JSON.stringify(value))
}

function failure(test: Target, startedAt: number, error: unknown) {
  const durationMs = Math.round(performance.now() - startedAt)
  if (error instanceof GeminiRequestError) return print({ test, ok: false, model: GEMINI_DOCUMENT_ANALYSIS_MODEL, durationMs, schemaValidation: 'NOT_REACHED', error: error.diagnostic })
  if (error instanceof GeminiResponseInvalidError) return print({ test, ok: false, model: GEMINI_DOCUMENT_ANALYSIS_MODEL, durationMs, schemaValidation: 'FAILED', error: { reason: error.diagnostic?.kind ?? 'RESPONSE_INVALID', issues: error.diagnostic?.issues } })
  return print({ test, ok: false, model: GEMINI_DOCUMENT_ANALYSIS_MODEL, durationMs, schemaValidation: 'NOT_REACHED', error: { errorName: error instanceof Error ? error.name : 'UnknownError', reason: 'UNEXPECTED_LOCAL_ERROR' } })
}

async function run(test: Target) {
  const startedAt = performance.now()
  if (test === 'document-d1' || test === 'document-d2' || test === 'document-d4') {
    const testDataCharacterCount = test === 'document-d1' ? 1_000 : test === 'document-d2' ? 5_000 : 30_000
    await analyzeDeidentifiedDocument(textOfLength(testDataCharacterCount))
    return print({ test, ok: true, model: GEMINI_DOCUMENT_ANALYSIS_MODEL, testDataCharacterCount, referenceCount: 0, durationMs: Math.round(performance.now() - startedAt), schemaValidation: 'PASSED' })
  }

  const references = test === 'domain-a4'
    ? Array.from({ length: 4 }, () => ({ source: 'document' as const, text: textOfLength(2_000) }))
    : test === 'domain-a3' ? [{ source: 'document' as const, text: textOfLength(2_000) }] : []
  await generateDomainAnalysis({
    domain: 'cognitive',
    domainLabel: '認知能力',
    selections: test === 'domain-a1' ? { attention: ['教師觀察到需要口頭提醒'] } : { attention: ['教師觀察到需要口頭提醒'], memory: ['需重複提示'], thinking: ['需分段說明'] },
    details: { 'cognitive-classImpactDescription': '在團體活動中經一次口頭提醒後可回到作業。' },
    references,
    supplementalAnswers: [],
  })
  const testDataCharacterCount = references.reduce((total, reference) => total + reference.text.length, 0)
  return print({ test, ok: true, model: GEMINI_DOCUMENT_ANALYSIS_MODEL, testDataCharacterCount, referenceCount: references.length, durationMs: Math.round(performance.now() - startedAt), schemaValidation: 'PASSED' })
}

if (target !== 'document-d1' && target !== 'document-d2' && target !== 'document-d4' && target !== 'domain-a1' && target !== 'domain-a2' && target !== 'domain-a3' && target !== 'domain-a4') {
  print({ ok: false, error: { reason: 'INVALID_TARGET', message: 'Use one of: document-d1, document-d2, document-d4, domain-a1, domain-a2, domain-a3, domain-a4.' } })
  process.exitCode = 1
} else {
  const startedAt = performance.now()
  void run(target).catch(error => {
    failure(target, startedAt, error)
    process.exitCode = 1
  })
}
