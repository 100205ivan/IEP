import { Router, type Response } from 'express'
import { createDocumentAnalysisSchema, createGameAssessmentSchema, createManualAssessmentSchema, deleteManualAssessmentSchema, updateManualAssessmentSchema } from '../schemas/assessmentRecord.js'
import { createDocumentAnalysis, createGameAssessment, createManualAssessment, deleteDocumentAnalysis, deleteGameAssessment, deleteManualAssessment, getDocumentAnalysis, getGameAssessmentResult, listPersistedAssessments, updateManualAssessment } from '../services/assessmentRecordService.js'
import { getIep } from '../services/studentIepService.js'

export const assessmentRecordRouter = Router()
const idPattern = /^[0-9a-f-]{36}$/i
function validId(value: string) { return idPattern.test(value) }
function invalidId(response: Response) { return response.status(400).json({ ok: false, error: { code: 'INVALID_ID', message: '識別碼格式錯誤。' } }) }
function invalidRequest(response: Response, message: string) { return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message } }) }

assessmentRecordRouter.get('/ieps/:iepId/assessments', async (request, response, next) => {
  if (!validId(request.params.iepId)) return invalidId(response)
  try {
    if (!await getIep(request.params.iepId)) return response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到 IEP。' } })
    return response.json({ ok: true, data: await listPersistedAssessments(request.params.iepId) })
  } catch (error) { next(error) }
})
assessmentRecordRouter.post('/ieps/:iepId/assessments', async (request, response, next) => {
  if (!validId(request.params.iepId)) return invalidId(response)
  const parsed = createManualAssessmentSchema.safeParse(request.body)
  if (!parsed.success) return invalidRequest(response, parsed.error.issues[0]?.message ?? '請提供有效評量資料。')
  try {
    const data = await createManualAssessment(request.params.iepId, parsed.data)
    return data ? response.status(201).json({ ok: true, data }) : response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到 IEP。' } })
  } catch (error) { next(error) }
})
assessmentRecordRouter.post('/ieps/:iepId/document-analyses', async (request, response, next) => {
  if (!validId(request.params.iepId)) return invalidId(response)
  const parsed = createDocumentAnalysisSchema.safeParse(request.body)
  if (!parsed.success) return invalidRequest(response, parsed.error.issues[0]?.message ?? '請提供有效的文件分析結果。')
  try {
    const result = await createDocumentAnalysis(request.params.iepId, parsed.data)
    if (result.kind === 'not_found') return response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到 IEP。' } })
    return response.status(201).json({ ok: true, data: result })
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return response.status(409).json({ ok: false, error: { code: 'DUPLICATE_DOCUMENT_ANALYSIS', message: '此分析結果已匯入目前 IEP。' } })
    next(error)
  }
})
assessmentRecordRouter.post('/ieps/:iepId/game-results', async (request, response, next) => {
  if (!validId(request.params.iepId)) return invalidId(response)
  const parsed = createGameAssessmentSchema.safeParse(request.body)
  if (!parsed.success) return invalidRequest(response, parsed.error.issues[0]?.message ?? '請提供有效的遊戲評量結果。')
  try {
    const result = await createGameAssessment(request.params.iepId, parsed.data)
    if (result.kind === 'not_found') return response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到 IEP。' } })
    return response.status(201).json({ ok: true, data: result })
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return response.status(409).json({ ok: false, error: { code: 'DUPLICATE_GAME_RESULT', message: '此遊戲結果已匯入目前 IEP。' } })
    next(error)
  }
})
assessmentRecordRouter.get('/assessments/:assessmentId/document-analysis', async (request, response, next) => {
  if (!validId(request.params.assessmentId)) return invalidId(response)
  try {
    const data = await getDocumentAnalysis(request.params.assessmentId)
    return data ? response.json({ ok: true, data }) : response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到文件分析結果。' } })
  } catch (error) { next(error) }
})
assessmentRecordRouter.get('/assessments/:assessmentId/game-result', async (request, response, next) => {
  if (!validId(request.params.assessmentId)) return invalidId(response)
  const iepId = request.query.iepId
  if (typeof iepId !== 'string' || !validId(iepId)) return invalidRequest(response, '請提供目前 IEP。')
  try {
    const data = await getGameAssessmentResult(request.params.assessmentId, iepId)
    return data ? response.json({ ok: true, data }) : response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到遊戲評量結果。' } })
  } catch (error) { next(error) }
})
assessmentRecordRouter.put('/assessments/:assessmentId', async (request, response, next) => {
  if (!validId(request.params.assessmentId)) return invalidId(response)
  const parsed = updateManualAssessmentSchema.safeParse(request.body)
  if (!parsed.success) return invalidRequest(response, parsed.error.issues[0]?.message ?? '請提供有效評量資料。')
  try {
    const result = await updateManualAssessment(request.params.assessmentId, parsed.data.iepId, parsed.data)
    if (result.kind === 'not_found') return response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到評量紀錄。' } })
    if (result.kind === 'wrong_iep') return response.status(409).json({ ok: false, error: { code: 'WRONG_IEP', message: '評量紀錄不屬於目前 IEP。' } })
    if (result.kind === 'not_manual') return response.status(409).json({ ok: false, error: { code: 'SOURCE_NOT_MANUAL', message: '僅能修改手動評量紀錄。' } })
    return response.json({ ok: true, data: result.record })
  } catch (error) { next(error) }
})
assessmentRecordRouter.delete('/assessments/:assessmentId/document-analysis', async (request, response, next) => {
  if (!validId(request.params.assessmentId)) return invalidId(response)
  const parsed = deleteManualAssessmentSchema.safeParse(request.body)
  if (!parsed.success) return invalidRequest(response, parsed.error.issues[0]?.message ?? '請提供目前 IEP。')
  try {
    const result = await deleteDocumentAnalysis(request.params.assessmentId, parsed.data.iepId)
    if (result.kind === 'not_found') return response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到評量紀錄。' } })
    if (result.kind === 'wrong_iep') return response.status(409).json({ ok: false, error: { code: 'WRONG_IEP', message: '評量紀錄不屬於目前 IEP。' } })
    if (result.kind === 'not_document') return response.status(409).json({ ok: false, error: { code: 'SOURCE_NOT_DOCUMENT', message: '僅能刪除 AI 評估文件紀錄。' } })
    if (result.kind === 'analysis_missing') return response.status(409).json({ ok: false, error: { code: 'ANALYSIS_MISSING', message: '找不到完整分析結果；為保護評量資料，未執行刪除。' } })
    return response.json({ ok: true, data: { id: result.id } })
  } catch (error) { next(error) }
})
assessmentRecordRouter.delete('/assessments/:assessmentId/game-result', async (request, response, next) => {
  if (!validId(request.params.assessmentId)) return invalidId(response)
  const parsed = deleteManualAssessmentSchema.safeParse(request.body)
  if (!parsed.success) return invalidRequest(response, parsed.error.issues[0]?.message ?? '請提供目前 IEP。')
  try {
    const result = await deleteGameAssessment(request.params.assessmentId, parsed.data.iepId)
    if (result.kind === 'not_found') return response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到評量紀錄。' } })
    if (result.kind === 'wrong_iep') return response.status(409).json({ ok: false, error: { code: 'WRONG_IEP', message: '評量紀錄不屬於目前 IEP。' } })
    if (result.kind === 'not_game') return response.status(409).json({ ok: false, error: { code: 'SOURCE_NOT_GAME', message: '僅能刪除 Monkey 或 CPT 遊戲評量紀錄。' } })
    if (result.kind === 'result_missing') return response.status(409).json({ ok: false, error: { code: 'RESULT_MISSING', message: '找不到完整遊戲結果；為保護評量資料，未執行刪除。' } })
    return response.json({ ok: true, data: { id: result.id } })
  } catch (error) { next(error) }
})
assessmentRecordRouter.delete('/assessments/:assessmentId', async (request, response, next) => {
  if (!validId(request.params.assessmentId)) return invalidId(response)
  const parsed = deleteManualAssessmentSchema.safeParse(request.body)
  if (!parsed.success) return invalidRequest(response, parsed.error.issues[0]?.message ?? '請提供目前 IEP。')
  try {
    const result = await deleteManualAssessment(request.params.assessmentId, parsed.data.iepId)
    if (result.kind === 'not_found') return response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到評量紀錄。' } })
    if (result.kind === 'wrong_iep') return response.status(409).json({ ok: false, error: { code: 'WRONG_IEP', message: '評量紀錄不屬於目前 IEP。' } })
    if (result.kind === 'not_manual') return response.status(409).json({ ok: false, error: { code: 'SOURCE_NOT_MANUAL', message: '僅能刪除手動評量紀錄。' } })
    return response.json({ ok: true, data: { id: result.id } })
  } catch (error) { next(error) }
})
