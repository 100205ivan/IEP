import { z } from 'zod'

const id = z.string().trim().min(1, '目標識別碼不可空白。').max(100)
const notes = z.string().max(20_000, '目標或評量說明不可超過 20,000 字。').default('')
const text = z.string().max(2_000, '目標補充欄位不可超過 2,000 字。').default('')
const date = z.union([z.literal(''), z.iso.date({ error: '請填寫有效的目標或評量日期。' })]).default('')
const count = z.string().trim().max(32).refine(value => value === '' || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value))), '機會與成功次數須為非負整數。').default('')
const percentage = z.string().trim().max(32).refine(value => value === '' || (/^\d+(?:\.\d+)?$/.test(value) && Number(value) <= 100), '達成率須介於 0 至 100。').default('')

export const goalDomainSchema = z.object({
  id,
  domainType: z.enum(['部定／校訂課程領域', '特殊需求領域', '其他'], { error: '請選擇有效的目標領域類型。' }).default('部定／校訂課程領域'),
  domainName: z.string().trim().min(1, '請填寫領域／科目名稱。').max(255),
  teacher: text,
  specialEducationTeacher: text,
  coreCompetencies: notes,
  learningPerformance: notes,
  learningContent: notes,
  integratedIssues: notes,
  annualGoals: z.array(z.object({ id, content: z.string().trim().min(1, '學年目標不可空白。').max(20_000) }).passthrough()).default([]),
}).passthrough()

const criterionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('次數／機會'), total: count, successful: count }).passthrough().superRefine((value, context) => {
    if (value.total !== '' && value.successful !== '' && Number(value.successful) > Number(value.total)) {
      context.addIssue({ code: 'custom', path: ['successful'], message: '至少成功次數不可超過總機會次數。' })
    }
  }),
  z.object({ type: z.literal('百分比'), percentage }).passthrough(),
  z.object({ type: z.literal('等級'), passingLevel: z.enum(['1', '2', '3', '4', '5'], { error: '通過等級須介於 1 至 5。' }).default('3') }).passthrough(),
  z.object({ type: z.literal('自訂'), text: notes }).passthrough(),
])

export const semesterGoalSchema = z.object({
  id,
  domainId: id,
  annualGoalId: id,
  semester: z.enum(['第一學期', '第二學期'], { error: '請選擇有效的學期。' }).default('第一學期'),
  content: z.string().trim().min(1, '學期目標不可空白。').max(20_000),
  startDate: date,
  endDate: date,
  assessmentMethods: z.array(z.enum(['書面／紙筆', '口語發表', '觀察', '操作', '動作指認', '作品', '實作', '其他'], { error: '目標評量方式選項無效。' })).default([]),
  otherAssessmentMethod: text,
  assessmentSupport: z.enum(['獨立完成', '部分協助', '高度協助'], { error: '請選擇有效的評量支持。' }).default('獨立完成'),
  achievementCriterion: criterionSchema.prefault({ type: '次數／機會' }),
  evaluationRecords: z.array(z.object({ id, date, result: text, notes }).passthrough()).default([]),
  teachingDecision: z.enum(['尚未決定', '通過', '修正', '繼續'], { error: '請選擇有效的教學決定。' }).default('尚未決定'),
  teachingDecisionNotes: notes,
}).passthrough().superRefine((value, context) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: '學期目標結束日期不可早於開始日期。' })
  }
  const recordIds = new Set<string>()
  for (const [index, record] of value.evaluationRecords.entries()) {
    if (recordIds.has(record.id)) context.addIssue({ code: 'custom', path: ['evaluationRecords', index, 'id'], message: '同一學期目標的評量紀錄識別碼不可重複。' })
    recordIds.add(record.id)
  }
})

export function validateEducationGoalLinks(content: { goalDomains?: z.infer<typeof goalDomainSchema>[]; semesterGoals?: z.infer<typeof semesterGoalSchema>[] }, context: z.RefinementCtx) {
  const domainIds = new Set<string>()
  const annualOwners = new Map<string, string>()
  for (const [domainIndex, domain] of (content.goalDomains ?? []).entries()) {
    if (domainIds.has(domain.id)) context.addIssue({ code: 'custom', path: ['goalDomains', domainIndex, 'id'], message: '領域識別碼不可重複。' })
    domainIds.add(domain.id)
    for (const [annualIndex, annual] of domain.annualGoals.entries()) {
      if (annualOwners.has(annual.id)) context.addIssue({ code: 'custom', path: ['goalDomains', domainIndex, 'annualGoals', annualIndex, 'id'], message: '同份 IEP 的學年目標識別碼不可重複。' })
      annualOwners.set(annual.id, domain.id)
    }
  }
  const semesterIds = new Set<string>()
  for (const [index, goal] of (content.semesterGoals ?? []).entries()) {
    if (semesterIds.has(goal.id)) context.addIssue({ code: 'custom', path: ['semesterGoals', index, 'id'], message: '學期目標識別碼不可重複。' })
    semesterIds.add(goal.id)
    if (!domainIds.has(goal.domainId)) context.addIssue({ code: 'custom', path: ['semesterGoals', index, 'domainId'], message: '學期目標須對應目前 IEP 的領域。' })
    if (annualOwners.get(goal.annualGoalId) !== goal.domainId) context.addIssue({ code: 'custom', path: ['semesterGoals', index, 'annualGoalId'], message: '學期目標須對應所選領域內的學年目標。' })
  }
}
