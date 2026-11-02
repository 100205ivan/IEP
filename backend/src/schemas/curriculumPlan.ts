import { z } from 'zod'

const text = z.string().max(2_000, '課程補充欄位不可超過 2,000 字。').default('')
const notes = z.string().max(20_000, '課程說明不可超過 20,000 字。').default('')
const courseId = z.string().trim().min(1, '課程識別碼不可空白。').max(100)
const subjects = ['全部課程', '國語', '英語', '數學', '自然', '社會', '藝術', '健康與體育', '綜合活動', '特殊需求領域', '其他'] as const

function adjustmentGroup(options: readonly [string, ...string[]]) {
  return z.object({
    selectedStrategies: z.array(z.enum(options, { error: '課程調整策略選項無效。' })).default([]),
    otherStrategy: text,
    applicableSubjects: z.array(z.enum(subjects, { error: '適用課程／領域選項無效。' })).default([]),
    otherSubject: text,
    description: notes,
  }).passthrough().superRefine((value, context) => {
    if (value.applicableSubjects.includes('全部課程') && value.applicableSubjects.length > 1) {
      context.addIssue({ code: 'custom', path: ['applicableSubjects'], message: '全部課程不可與個別課程同時勾選。' })
    }
  }).prefault({})
}

export const curriculumAdjustmentSchema = z.object({
  environment: adjustmentGroup(['座位調整', '同儕協助', '教室動線調整', '減少環境干擾刺激', '提供獨立／安靜學習空間', '調整教室光線或聲音', '提供視覺提示', '輔具或學習設備', '其他']),
  content: adjustmentGroup(['個別化教材', '教材內容簡化', '調整學習內容難度', '減少學習內容份量', '提供重點整理', '提供圖像／視覺化教材', '將抽象內容具體化', '增加生活化或實作內容', '其他']),
  process: adjustmentGroup(['工作分析／步驟化教學', '分段指令', '重複或簡化指令', '多感官教學', '示範後操作', '增加練習機會', '延長學習時間', '調整學習速度', '合作學習', '同儕示範／協助', '視覺流程提示', '提供立即回饋', '其他']),
  assessment: adjustmentGroup(['延長評量時間', '分段評量', '減少題量', '調整題目難度', '口語評量', '操作評量', '實作評量', '動作／圖片指認', '提供題目語音或報讀', '提供較清楚的作答提示', '調整評量環境', '其他']),
}).passthrough()

export const coursePlanItemSchema = z.object({
  id: courseId,
  courseName: z.string().trim().min(1, '請填寫課程名稱。').max(255, '課程名稱不可超過 255 字。'),
  courseType: z.enum(['普通教育課程', '特殊教育課程', '特殊需求領域課程', '其他'], { error: '請選擇有效的課程／領域類型。' }),
  otherCourseType: text,
  teachingMethod: z.enum(['原班上課', '抽離式', '外加式', '小組教學', '個別教學', '協同教學', '其他'], { error: '請選擇有效的授課方式。' }),
  otherTeachingMethod: text,
  teacher: z.string().max(120, '授課教師不可超過 120 字。').default(''),
  location: z.enum(['', '原班教室', '資源教室', '特教班', '專科教室', '其他'], { error: '請選擇有效的授課地點。' }).default(''),
  otherLocation: text,
  weeklyPeriods: z.number({ error: '每週節數須為數字。' }).finite().nonnegative('每週節數須為 0 或正數。'),
  notes,
}).passthrough()

export const weeklyScheduleEntrySchema = z.object({
  day: z.enum(['星期一', '星期二', '星期三', '星期四', '星期五'], { error: '請選擇有效的上課日。' }),
  period: z.enum(['早自習', '第一節', '第二節', '第三節', '第四節', '午休', '第五節', '第六節', '第七節'], { error: '請選擇有效的課表節次。' }),
  courseId,
}).passthrough()
