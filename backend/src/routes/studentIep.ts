import { Router, type Response } from 'express'
import { createAnnualIepSchema, createStudentIepSchema, deleteIepSchema, updateIepSchema } from '../schemas/studentIep.js'
import { createIepForStudent, createStudentWithIep, deleteIep, getIep, getStudent, getStudentIeps, listStudents, updateIep } from '../services/studentIepService.js'

export const studentIepRouter = Router()
const idPattern = /^[0-9a-f-]{36}$/i
function validId(value: string) { return idPattern.test(value) }
function invalidId(response: Response) { return response.status(400).json({ ok: false, error: { code: 'INVALID_ID', message: '識別碼格式錯誤。' } }) }

studentIepRouter.get('/students', async (_request, response, next) => { try { return response.json({ ok: true, data: await listStudents() }) } catch (error) { next(error) } })
studentIepRouter.post('/students', async (request, response, next) => {
  const parsed = createStudentIepSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? '請提供有效資料。' } })
  try { return response.status(201).json({ ok: true, data: await createStudentWithIep(parsed.data.student, parsed.data.academicYear, parsed.data.content) }) }
  catch (error) { if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return response.status(409).json({ ok: false, error: { code: 'DUPLICATE_RECORD', message: '學生身分或該學年度 IEP 已存在。' } }); next(error) }
})
studentIepRouter.post('/students/:studentId/ieps', async (request, response, next) => {
  if (!validId(request.params.studentId)) return invalidId(response)
  const parsed = createAnnualIepSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? '請提供有效資料。' } })
  try {
    if (parsed.data.mode === 'copy-basic' && !parsed.data.copyFromIepId) return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: '沿用基本資料時必須指定來源 IEP。' } })
    const result = await createIepForStudent(request.params.studentId, parsed.data.academicYear, parsed.data.mode, parsed.data.copyFromIepId, parsed.data.content)
    if (result.kind === 'not_found') return response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到學生。' } })
    if (result.kind === 'duplicate') return response.status(409).json({ ok: false, error: { code: 'DUPLICATE_IEP_YEAR', message: `此學生已有${parsed.data.academicYear}學年度 IEP，請直接開啟既有紀錄。`, iepId: result.iepId } })
    if (result.kind === 'source_required') return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: '沿用基本資料時必須指定來源 IEP。' } })
    if (result.kind === 'source_not_found') return response.status(404).json({ ok: false, error: { code: 'SOURCE_NOT_FOUND', message: '找不到屬於此學生的來源 IEP。' } })
    if (result.kind === 'source_not_earlier') return response.status(400).json({ ok: false, error: { code: 'INVALID_SOURCE_YEAR', message: `來源 IEP 為${result.sourceAcademicYear}學年度，必須早於目標學年度。` } })
    if (result.kind === 'source_invalid') return response.status(422).json({ ok: false, error: { code: 'INVALID_SOURCE_CONTENT', message: '來源 IEP 缺少可沿用的學生基本資料。' } })
    return response.status(201).json({ ok: true, data: result.record })
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return response.status(409).json({ ok: false, error: { code: 'DUPLICATE_IEP_YEAR', message: `此學生已有${parsed.data.academicYear}學年度 IEP，請直接開啟既有紀錄。` } })
    next(error)
  }
})
studentIepRouter.get('/students/:studentId', async (request, response, next) => { if (!validId(request.params.studentId)) return invalidId(response); try { const data = await getStudent(request.params.studentId); return data ? response.json({ ok: true, data }) : response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到學生。' } }) } catch (error) { next(error) } })
studentIepRouter.get('/students/:studentId/ieps', async (request, response, next) => { if (!validId(request.params.studentId)) return invalidId(response); try { return response.json({ ok: true, data: await getStudentIeps(request.params.studentId) }) } catch (error) { next(error) } })
studentIepRouter.get('/ieps/:iepId', async (request, response, next) => { if (!validId(request.params.iepId)) return invalidId(response); try { const data = await getIep(request.params.iepId); return data ? response.json({ ok: true, data }) : response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到 IEP。' } }) } catch (error) { next(error) } })
studentIepRouter.delete('/ieps/:iepId', async (request, response, next) => {
  if (!validId(request.params.iepId)) return invalidId(response)
  const parsed = deleteIepSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ ok: false, error: { code: 'INVALID_CONFIRMATION', message: parsed.error.issues[0]?.message ?? '請輸入「刪除」以確認。' } })
  try {
    const data = await deleteIep(request.params.iepId)
    return data ? response.json({ ok: true, data }) : response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到 IEP，可能已被刪除。' } })
  } catch (error) { next(error) }
})
studentIepRouter.put('/ieps/:iepId', async (request, response, next) => {
  if (!validId(request.params.iepId)) return invalidId(response)
  const parsed = updateIepSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ ok: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? '請提供有效資料。' } })
  try { const data = await updateIep(request.params.iepId, parsed.data.content, parsed.data.student, parsed.data.academicYear); return data ? response.json({ ok: true, data }) : response.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '找不到 IEP。' } }) }
  catch (error) { if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return response.status(409).json({ ok: false, error: { code: 'DUPLICATE_RECORD', message: '學生身分或該學年度 IEP 已存在。' } }); next(error) }
})

