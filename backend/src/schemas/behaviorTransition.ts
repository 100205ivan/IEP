import { z } from 'zod'
import { behaviorExecutionSchema } from './referenceForms.js'

const text = z.string().max(2_000, '介入／轉銜補充欄位不可超過 2,000 字。').default('')
const notes = z.string().max(20_000, '介入／轉銜說明不可超過 20,000 字。').default('')
const date = z.union([z.literal(''), z.iso.date({ error: '請填寫有效的介入、轉銜或追蹤日期。' })]).default('')
function choiceObject(options: readonly [string, ...string[]]) {
  return z.object({ selected: z.array(z.enum(options, { error: '介入或轉銜選項無效。' })).default([]), other: text }).passthrough()
}
const choice = (options: readonly [string, ...string[]]) => choiceObject(options).prefault({})
const preference = (options: readonly [string, ...string[]]) => z.object({ caregiver: choice(options), student: choice(options) }).passthrough().prefault({})
const focusOptions = ['學習輔導', '升學輔導', '生活輔導', '就業輔導', '心理輔導', '福利服務', '其他'] as const

export const behaviorInterventionSchema = z.object({
  executionDetails: behaviorExecutionSchema.optional(),
  needStatus: z.enum(['', '暫無需求', '有需求'], { error: '請選擇有效的行為介入需求。' }).default(''),
  planStatus: z.enum(['', '建立新的行為功能介入方案', '維持前次行為功能介入方案，繼續執行', '調整前次行為功能介入方案，繼續執行'], { error: '請選擇有效的介入方案狀態。' }).default(''),
  planPeriod: z.object({ startDate: date, endDate: date }).passthrough().prefault({}),
  behaviorAssessment: z.object({ definition: notes, time: text, location: text, triggers: text, frequency: text, duration: text }).passthrough().prefault({}),
  behaviorFunctions: z.object({ selected: z.array(z.enum(['獲得他人注意', '獲得事物／活動', '獲得自我刺激', '逃避要求', '逃避事物／活動', '獲得內在刺激', '獲得外在刺激', '逃避內在刺激', '逃避外在刺激', '其他'])).default([]), notes: z.record(z.string(), text).default({}) }).passthrough().prefault({}),
  interventionGoal: notes,
  antecedentStrategies: z.object({
    environment: choice(['提供示範', '預告或提示', '調整座位／活動地點', '調整物理環境', '建立結構化環境', '提供豐富多元環境', '安排同儕支持', '調整班規', '提供學習／溝通輔具', '其他']),
    curriculum: choice(['調整份量', '調整時間表', '調整完成方式', '調整呈現方式', '調整評量方式', '調整內容', '調整難度', '其他']),
    interaction: choice(['提供正向回饋與鼓勵', '建立正向社會關係', '親職教育', '溝通教養觀念', '其他']),
    notes,
  }).passthrough().prefault({}),
  teachingStrategies: choiceObject(['功能等值替代／替代行為', '社會技巧', '生活管理', '學習策略', '溝通訓練', '科技輔具應用', '自我管理訓練', '放鬆訓練', '支持性心理治療', '行為治療', '休閒生活訓練', '其他']).extend({ notes }).prefault({}),
  consequenceStrategies: z.object({
    increase: choice(['原級增強', '活動增強', '代幣系統', '社會性增強', '自我增強', '其他']),
    reduce: choice(['消弱', '反應代價', '隔離', '過度矯正', '其他']),
    notes,
  }).passthrough().prefault({}),
  individualFactors: notes,
  administrativeSupports: choice(['尋求特教專業諮詢', '提供家長諮詢', '安排認輔教師', '安排小團體輔導', '社會團體協助', '社工介入', '安排專業治療', '校園危機處理小組協助', '提供個案班級學生輔導', '加強親職教育', '提供人力支持', '連結校內／外資源', '提供教材教具資源', '召開個案會議', '其他']),
  implementers: choice(['班級教師／教保員', '巡迴輔導教師', '家長', '教師助理員', '行政人員', '其他']),
  outcomeEvaluation: z.object({
    date,
    methods: choice(['行為檢核表', '訪談紀錄', '入班觀察紀錄表', '學生自我評估', '其他']),
    result: z.enum(['', '行為問題已適當改善', '已建立新的替代行為', '介入未達預期效果', '其他']).default(''),
    resultOther: text,
    recommendation: z.enum(['', '終止介入方案', '繼續執行介入方案', '調整介入方案', '建立新介入方案', '其他']).default(''),
    recommendationOther: text,
    notes,
  }).passthrough().prefault({}),
}).passthrough().superRefine((value, context) => {
  if (value.needStatus === '有需求' && value.planPeriod.startDate && value.planPeriod.endDate && value.planPeriod.endDate < value.planPeriod.startDate) {
    context.addIssue({ code: 'custom', path: ['planPeriod', 'endDate'], message: '行為介入計畫結束日期不可早於開始日期。' })
  }
})

function transitionService(options: readonly [string, ...string[]]) {
  return z.object({ needStatus: z.enum(['', '無需求', '有需求']).default(''), options: choice(options), needsDescription: notes, startDate: date, endDate: date, provider: text, progress: notes }).passthrough().prefault({})
}
const followUpRecord = z.object({
  id: z.string().trim().min(1, '追蹤紀錄識別碼不可空白。').max(100),
  date,
  methods: z.array(z.enum(['面談', '電話', '視訊', '電子郵件', '社群平台', '其他'], { error: '追蹤輔導方式選項無效。' })).default([]),
  socialPlatform: text, otherMethod: text,
  focusAreas: z.array(z.enum(focusOptions, { error: '追蹤輔導重點選項無效。' })).default([]),
  otherFocus: text, summary: notes,
  serviceDisposition: z.enum(['適應良好', '須轉介', '須通報'], { error: '請選擇有效的轉銜服務處理狀態。' }).default('適應良好'),
  dispositionDetails: text, receivingUnitContact: notes, specialNotes: notes,
}).passthrough()

export const transitionSupportSchema = z.object({
  noTransitionNeed: z.boolean().default(false),
  transitionReasons: choice(['新生入學轉銜輔導', '轉學或轉換安置型態', '跨年段或階段內更換導師', '其他']),
  transitionFocus: choice(focusOptions),
  generalServiceContent: notes, receivingUnit: text, specialNotes: notes,
  crossStagePlan: z.object({
    employmentDetails: z.partialRecord(z.enum(['國中', '高中']), z.object({ caregiverWorkplace: text, studentWorkplace: text, caregiverHome: text, studentHome: text }).passthrough()).optional(),
    enabled: z.boolean().default(false),
    educationStage: z.enum(['國小', '國中', '高中', '其他'], { error: '請選擇有效的轉銜教育階段。' }).default('國小'),
    grade: text,
    elementaryPlan: preference(['國中普通班', '國中資源班', '國中特教班', '特殊學校國中部', '其他']),
    juniorHighPlan: z.object({ furtherEducation: preference(['高級中等學校', '高級中等學校集中式特教班', '特殊教育學校', '其他']), employment: preference(['職場', '在家', '其他']), otherPlan: notes }).passthrough().prefault({}),
    seniorHighPlan: z.object({ furtherEducation: preference(['一般大學', '科技大學', '專科學校', '其他']), employment: preference(['職場', '在家', '其他']), otherPlan: notes }).passthrough().prefault({}),
    otherStageNotes: notes,
  }).passthrough().prefault({}),
  services: z.object({
    education: transitionService(['認識新學校環境', '提供考試資訊', '熟悉新學校上學路線', '生涯探索', '提供升學／安置資訊', '其他']),
    dailyLiving: transitionService(['加強生活自理能力', '社區資源使用能力', '表現適當的社會行為', '交通使用能力', '自我保護能力', '金錢使用', '其他']),
    employment: transitionService(['職業興趣評估', '工作安全的認識', '工作行為的訓練', '自身權益的維護', '其他']),
    psychological: transitionService(['強化情緒管理能力', '調整學習態度', '加強自我決策', '提升自我接納', '其他']),
    welfare: transitionService(['社工服務', '就學相關福利申請', '福利的認識與申請', '其他']),
    professional: transitionService(['專業團隊服務', '輔具移撥', '醫療訊息與資源提供', '其他']),
  }).passthrough().prefault({}),
  followUp: z.object({ enabled: z.boolean().default(false), records: z.array(followUpRecord).default([]) }).passthrough().prefault({}),
}).passthrough().superRefine((value, context) => {
  if (!value.noTransitionNeed) {
    for (const key of ['education', 'dailyLiving', 'employment', 'psychological', 'welfare', 'professional'] as const) {
      const service = value.services[key]
      if (service.needStatus === '有需求' && service.startDate && service.endDate && service.endDate < service.startDate) {
        context.addIssue({ code: 'custom', path: ['services', key, 'endDate'], message: '有需求的轉銜服務結束日期不可早於開始日期。' })
      }
    }
  }
  const ids = new Set<string>()
  for (const [index, record] of value.followUp.records.entries()) {
    if (ids.has(record.id)) context.addIssue({ code: 'custom', path: ['followUp', 'records', index, 'id'], message: '追蹤紀錄識別碼不可重複。' })
    ids.add(record.id)
  }
})
