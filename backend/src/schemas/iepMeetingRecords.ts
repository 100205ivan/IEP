import { z } from 'zod'

const id = z.string().trim().min(1, '會議及明細識別碼不可空白。').max(100)
const text = z.string().max(2_000, '會議基本欄位不可超過 2,000 字。').default('')
const notes = z.string().max(20_000, '會議討論及內容不可超過 20,000 字。').default('')
const participant = z.object({
  id,
  role: z.enum(['student', 'parent', 'administrator', 'general_teacher', 'special_education_teacher', 'professional', 'other'], { error: '與會人員身分類別無效。' }).default('parent'),
  name: z.string().trim().min(1, '請填寫與會人員姓名。').max(120),
  title: text,
  attended: z.boolean().default(true),
}).passthrough()
const topic = z.object({
  id,
  type: z.enum(['學生能力與學習現況', 'IEP 教育目標執行成果', '特殊教育需求', '課程規劃', '相關服務及支持策略', '行為功能介入方案', '轉銜服務', '家長／學生意見', '其他'], { error: '會議討論事項類型無效。' }),
  enabled: z.boolean().default(false),
  summary: notes,
  otherName: z.string().max(2_000, '其他討論事項名稱不可超過 2,000 字。').optional(),
}).passthrough()
const contentItem = z.object({ id, content: z.string().trim().min(1, '請填寫決議或臨時動議內容。').max(20_000) }).passthrough()

function validateIds(items: { id: string }[], context: z.RefinementCtx, path: (string | number)[], label: string) {
  const ids = new Set<string>()
  for (const [index, item] of items.entries()) {
    if (ids.has(item.id)) context.addIssue({ code: 'custom', path: [...path, index, 'id'], message: `${label}識別碼不可重複。` })
    ids.add(item.id)
  }
}

export const iepMeetingRecordSchema = z.object({
  id,
  meetingType: z.enum(['期初會議', '期末檢討會議', '期末檢討暨下學期期初會議', '期末檢討暨轉銜會議', '轉銜會議', '其他'], { error: '請選擇有效的會議類型。' }).default('期初會議'),
  otherMeetingType: text,
  date: z.iso.date({ error: '請填寫有效的會議日期。' }),
  location: z.string().trim().min(1, '請填寫會議地點。').max(2_000),
  chairperson: text,
  recorder: text,
  participants: z.array(participant).default([]),
  discussionTopics: z.array(topic).default([]),
  decisions: z.array(contentItem).default([]),
  motions: z.array(contentItem).default([]),
  hasMotions: z.boolean().default(false),
}).passthrough().superRefine((meeting, context) => {
  if (meeting.meetingType === '其他' && !meeting.otherMeetingType.trim()) context.addIssue({ code: 'custom', path: ['otherMeetingType'], message: '請填寫其他會議類型。' })
  validateIds(meeting.participants, context, ['participants'], '與會人員')
  validateIds(meeting.discussionTopics, context, ['discussionTopics'], '討論事項')
  validateIds(meeting.decisions, context, ['decisions'], '決議事項')
  validateIds(meeting.motions, context, ['motions'], '臨時動議')
})

export const iepMeetingRecordsSchema = z.array(iepMeetingRecordSchema).superRefine((meetings, context) => validateIds(meetings, context, [], '會議紀錄'))
