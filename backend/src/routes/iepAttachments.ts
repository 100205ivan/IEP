import express, { Router } from 'express'
import { z } from 'zod'
import { getIep } from '../services/studentIepService.js'
import { attachmentKinds, deleteIepAttachment, listIepAttachments, maximumAttachmentBytes, saveIepAttachment, validateAttachment, type AttachmentKind } from '../services/iepAttachmentService.js'

export const iepAttachmentsRouter = Router()
iepAttachmentsRouter.use('/students/:studentId/ieps/:iepId/attachments', async (request, response, next) => {
  const { studentId, iepId } = request.params
  if (!z.uuid().safeParse(studentId).success || !z.uuid().safeParse(iepId).success) return response.status(400).json({ ok: false, error: { message: '識別碼格式錯誤。' } })
  try {
    const iep = await getIep(iepId)
    if (!iep || iep.studentId !== studentId) return response.status(404).json({ ok: false, error: { message: '找不到屬於此學生的 IEP。' } })
    next()
  } catch (error) { next(error) }
})
const base = '/students/:studentId/ieps/:iepId/attachments'
iepAttachmentsRouter.get(base, async (request, response, next) => {
  try { response.set('Cache-Control', 'no-store').json({ ok: true, data: (await listIepAttachments(request.params.iepId)).map(({ bytes, ...record }) => ({ ...record, size: bytes.length })) }) } catch (error) { next(error) }
})
iepAttachmentsRouter.all(`${base}/:kind`, (request, response, next) => attachmentKinds.includes(request.params.kind as AttachmentKind) ? next() : response.status(400).json({ ok: false, error: { message: '影本類型無效。' } }))
iepAttachmentsRouter.get(`${base}/:kind`, async (request, response, next) => {
  try {
    const record = (await listIepAttachments(request.params.iepId)).find(row => row.kind === request.params.kind)
    if (!record) return response.status(404).json({ ok: false, error: { message: '尚未上傳此影本。' } })
    response.set({ 'Content-Type': record.mimeType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).send(record.bytes)
  } catch (error) { next(error) }
})
iepAttachmentsRouter.put(`${base}/:kind`, express.raw({ type: () => true, limit: maximumAttachmentBytes }), async (request, response, next) => {
  const mimeType = request.headers['content-type']?.split(';')[0] ?? ''
  const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0)
  try { await validateAttachment(bytes, mimeType) } catch (error) { return response.status(400).json({ ok: false, error: { message: (error as Error).message } }) }
  let fileName = 'certificate'
  try { fileName = decodeURIComponent(String(request.headers['x-file-name'] ?? fileName)).replace(/[\x00-\x1f\\/]/g, '').slice(0, 255) } catch { /* Use a safe fallback for malformed metadata. */ }
  try { await saveIepAttachment(request.params.iepId, request.params.kind as AttachmentKind, mimeType, fileName, bytes); response.json({ ok: true }) } catch (error) { next(error) }
})
iepAttachmentsRouter.delete(`${base}/:kind`, async (request, response, next) => {
  try { await deleteIepAttachment(request.params.iepId, request.params.kind as AttachmentKind); response.json({ ok: true }) } catch (error) { next(error) }
})
