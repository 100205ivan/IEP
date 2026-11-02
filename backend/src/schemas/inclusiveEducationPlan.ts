import { z } from 'zod'
import { inclusiveReferenceRowsSchema } from './referenceForms.js'

const other = z.string().max(2_000, '融合教育補充欄位不可超過 2,000 字。').default('')
const notes = z.string().max(20_000, '融合教育說明不可超過 20,000 字。').default('')

// Allow empty fields for drafts. Keep the saved values aligned with the form.
export const inclusiveEducationPlanSchema = z.object({
  referenceRows: inclusiveReferenceRowsSchema.optional(),
  grade: z.enum(['', '一年級', '二年級', '三年級', '四年級', '五年級', '六年級', '七年級', '八年級', '九年級'], { error: '請選擇有效的融合教育年級。' }).default(''),
  className: z.enum(['', '1 班', '2 班', '3 班', '4 班', '5 班'], { error: '請選擇有效的融合教育班級。' }).default(''),
  participation: z.enum(['', '全時參與普通班', '部分時間抽離', '其他方式'], { error: '請選擇有效的融合教育參與方式。' }).default(''),
  withdrawalSubjects: z.array(z.enum(['國語', '數學', '英語', '自然', '社會', '特殊需求領域', '其他'], { error: '抽離課程／領域選項無效。' })).default([]),
  withdrawalOther: other,
  otherParticipationNotes: notes,
  participationNotes: notes,
  activities: z.array(z.enum(['班級活動', '校外教學', '體育活動', '團體活動', '學校大型活動', '社團／課外活動', '其他'], { error: '融合活動選項無效。' })).default([]),
  activityOther: other,
  activityNotes: notes,
  strategies: z.array(z.enum(['同儕協助', '座位安排', '視覺提示', '活動前預告', '分段指令', '延長作答／反應時間', '降低環境刺激', '提供情緒調節空間', '成人提示／協助', '其他'], { error: '融合支持策略選項無效。' })).default([]),
  strategyOther: other,
  strategyNotes: notes,
}).passthrough()
