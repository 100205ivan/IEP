import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { FormFlow } from './flow.js'
import { criterion, date } from './format.js'

export async function drawGoals(pdf: IepPdfDocument, input: IepPdfRequest) {
  const domains = input.content.goalDomains ?? []
  if (!domains.length && !input.content.learningNotes) { await pdf.page(13, '參、學年教育目標'); await pdf.page(14, '參、學期教育目標'); return }
  for (const domain of domains.length ? domains : [undefined]) {
    const name = domain?.domainName || '未指定領域'
    const annual = await FormFlow.create(pdf, input, `參、${name}學年教育目標`)
    await annual.grid([['領域／科目', name], ['領域類型', domain?.domainType], ['教學者', domain?.teacher], ['特教教師', domain?.specialEducationTeacher]])
    await annual.paragraph('核心素養', domain?.coreCompetencies)
    await annual.paragraph('學習表現', domain?.learningPerformance)
    await annual.paragraph('學習內容', domain?.learningContent)
    if (domain?.annualGoals.length) { await annual.heading('學年目標'); await annual.table(['編號', '目標內容'], [60, 460], domain.annualGoals.map((goal, i) => [String(i + 1), goal.content])) }
    const goals = (input.content.semesterGoals ?? []).filter(goal => goal.domainId === domain?.id)
    const semesters = goals.some(goal => goal.semester === '第二學期') ? ['第一學期', '第二學期'] : ['第一學期']
    for (const semester of semesters) {
      const f = await FormFlow.create(pdf, input, `參、${name}${semester}教育目標與達成情形`)
      await f.paragraph('融入之議題', domain?.integratedIssues)
      const items = goals.filter(goal => goal.semester === semester)
      for (const [i, goal] of items.entries()) {
        const annualIndex = (domain?.annualGoals.findIndex(item => item.id === goal.annualGoalId) ?? -1) + 1
        await f.heading(`第 ${i + 1} 項學期目標（連結學年目標 ${annualIndex}）`)
        await f.paragraph('目標內容', goal.content)
        await f.grid([['開始日期', date(goal.startDate)], ['結束日期', date(goal.endDate)], ['評量支持', goal.assessmentSupport], ['達成標準', criterion(goal.achievementCriterion)]])
        await f.fields([['評量方式', goal.assessmentMethods.map(method => method === '其他' ? goal.otherAssessmentMethod || '其他' : method).join('、')], ['教學決定', goal.teachingDecision], ['教學決定說明', goal.teachingDecisionNotes]])
        if (goal.evaluationRecords.length) {
          await f.heading(`第 ${i + 1} 項目標：形成性評量紀錄`)
          await f.table(['次數／日期', '評量結果', '評量備註'], [90, 150, 280], goal.evaluationRecords.map((record, index) => [`第 ${index + 1} 次\n${date(record.date)}`, record.result, record.notes]))
        }
      }
      const passed = items.filter(goal => goal.teachingDecision === '通過').length
      await f.heading('學期目標達成情形')
      await f.info([['通過目標數', String(passed)], ['全部目標數', String(items.length)], ['達成率', items.length ? `${Math.round(passed / items.length * 100)}%` : '尚無目標']])
      await f.paragraph('學生學習狀況說明', input.content.learningNotes)
    }
  }
}
