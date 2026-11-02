import { z } from 'zod'

const notes = z.string().max(20_000, '服務說明不可超過 20,000 字。').default('')
const text = z.string().max(2_000, '服務欄位不可超過 2,000 字。').default('')
const date = z.union([z.literal(''), z.iso.date({ error: '請填寫有效的專業服務日期。' })]).default('')
const professionalService = z.enum(['語言治療', '職能治療', '物理治療', '心理服務', '社會工作服務', '其他'])

const professionalDetail = z.object({
  provider: text,
  frequency: z.enum(['請選擇', '每週一次', '每週兩次', '每兩週一次', '每月一次', '依需求提供', '其他']).default('請選擇'),
  otherFrequency: text,
  startDate: date,
  endDate: date,
  notes,
  serviceName: text,
}).passthrough()

// Empty fields remain valid so teachers can save a partially completed IEP.
export const specialEducationSupportSchema = z.object({
  specialEducation: z.array(z.enum(['資源班', '巡迴輔導', '集中式特殊教育班', '普通班接受特殊教育服務', '在家教育', '其他'])).default([]),
  specialOther: text,
  specialFrequency: z.enum(['請選擇', '每日', '每週 1 節', '每週 2 節', '每週 3 節', '每週 4 節以上', '依需求提供', '其他']).default('請選擇'),
  specialFrequencyOther: text,
  specialNotes: notes,
  professional: z.array(professionalService).default([]),
  professionalDetails: z.partialRecord(professionalService, professionalDetail).default({}),
  familySupport: z.array(z.enum(['親職教育', '家庭諮詢', '教育資訊', '社會福利資訊', '經濟補助資訊', '協助連結相關資源', '其他'])).default([]),
  familyOther: text,
  familyNotes: notes,
  staffSupport: z.array(z.enum(['特教學生助理人員', '教師助理', '護理人員', '其他'])).default([]),
  staffHours: z.string().trim().max(32).refine(value => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0), '人力支持時數須為大於或等於 0 的數字。').default(''),
  staffOther: text,
  administrativeSupport: z.array(z.enum(['輔具', '無障礙環境', '教室設備調整', '特教宣導', '其他'])).default([]),
  administrativeOther: text,
  transportSupport: z.array(z.enum(['交通服務', '交通費補助', '教育補助', '其他'])).default([]),
  transportOther: text,
  otherSupportNotes: notes,
}).passthrough().superRefine((value, context) => {
  for (const service of value.professional) {
    const detail = value.professionalDetails[service]
    if (detail?.startDate && detail.endDate && detail.endDate < detail.startDate) {
      context.addIssue({ code: 'custom', path: ['professionalDetails', service, 'endDate'], message: `${service}：結束日期不可早於開始日期。` })
    }
  }
})

// Keep other chapters and future fields intact when validating this section.
export const iepContentSchema = z.object({
  specialEducationSupport: specialEducationSupportSchema.optional(),
}).catchall(z.unknown())
