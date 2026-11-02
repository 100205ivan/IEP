import { PDFDocument } from 'pdf-lib'
import type { RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'

export const attachmentKinds = ['certificate-front', 'certificate-back'] as const
export type AttachmentKind = typeof attachmentKinds[number]
export type IepAttachment = { kind: AttachmentKind; mimeType: 'image/png' | 'image/jpeg'; fileName: string; bytes: Buffer; updatedAt: string }
export const maximumAttachmentBytes = 5 * 1024 * 1024
export async function validateAttachment(bytes: Buffer, mimeType: string) {
  if (!bytes.length || bytes.length > maximumAttachmentBytes) throw new Error('影本須為 5 MB 以內的 PNG 或 JPEG 圖片。')
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const jpeg = bytes[0] === 255 && bytes[1] === 216
  if (!(png && mimeType === 'image/png') && !(jpeg && mimeType === 'image/jpeg')) throw new Error('檔案內容與圖片格式不符，請選擇 PNG 或 JPEG 圖片。')
  if (png && (bytes.length < 24 || bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 25_000_000)) throw new Error('圖片解析度不可超過 2,500 萬像素。')
  try {
    const pdf = await PDFDocument.create()
    const picture = png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
    if (picture.width * picture.height > 25_000_000) throw new Error('large')
    await pdf.save()
  } catch { throw new Error('圖片無法讀取或解析度過大，請改用 2,500 萬像素以內的有效圖片。') }
}
export async function listIepAttachments(iepId: string): Promise<IepAttachment[]> {
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT kind, mime_type, file_name, image_bytes, updated_at FROM iep_attachments WHERE iep_id = ?', [iepId])
  return rows.map(row => ({ kind: row.kind, mimeType: row.mime_type, fileName: row.file_name, bytes: row.image_bytes, updatedAt: row.updated_at }))
}
export async function saveIepAttachment(iepId: string, kind: AttachmentKind, mimeType: string, fileName: string, bytes: Buffer) {
  await pool.execute('INSERT INTO iep_attachments (iep_id, kind, mime_type, file_name, image_bytes, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_name = VALUES(file_name), image_bytes = VALUES(image_bytes), updated_at = CURRENT_TIMESTAMP(3)', [iepId, kind, mimeType, fileName, bytes])
}
export async function deleteIepAttachment(iepId: string, kind: AttachmentKind) { await pool.execute('DELETE FROM iep_attachments WHERE iep_id = ? AND kind = ?', [iepId, kind]) }
