import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { criterion, date, lines } from './format.js'

export async function drawGoals(pdf: IepPdfDocument, input: IepPdfRequest) {
  const domains = input.content.goalDomains ?? []
  for (const domain of domains.length ? domains : [undefined]) {
    const name = domain?.domainName || '____________'
    const p = await pdf.page(13, `參、${name}學年教育目標`)
    p.field([34, 78, 520, 16], `${name}領域／科目（${domain?.domainType ?? ''}）`, '領域名稱', { size: 11 })
    p.field([205, 96, 349, 17], domain ? `${domain.teacher}　特教教師：${domain.specialEducationTeacher}` : '', '教學者', { size: 10 })
    p.field([205, 115, 349, 113], domain?.coreCompetencies, name + '：核心素養')
    p.field([205, 231, 349, 254], domain?.learningPerformance, name + '：學習表現')
    p.field([205, 488, 349, 269], domain?.learningContent, name + '：學習內容')
    const goals = (input.content.semesterGoals ?? []).filter(g => g.domainId === domain?.id)
    const semesters = goals.some(g => g.semester === '第二學期') ? ['第一學期', '第二學期'] as const : ['第一學期'] as const
    for (const semester of semesters) {
      const semesterGoals = goals.filter(g => g.semester === semester)
      for (let offset = 0; offset < Math.max(1, semesterGoals.length); offset += 10) {
        const q = await pdf.page(14, `參、${name}${semester}教育目標與達成情形`)
        q.clear([205, 37, 349, 56])
        q.field([205, 95, 349, 14], domain?.integratedIssues, name + '：融入議題', { size: 9, min: 8 })
        q.field([205, 111, 349, 35], domain?.annualGoals.map((goal, index) => `${index + 1}. ${goal.content}`).join('\n'), name + '：學年教育目標')
        q.field([34, 151, 168, 33], `${semester}目標`, '學期', { size: 11, align: 'center' })
        const bounds = [187.7, 226, 257.9, 287.7, 316.4, 344.9, 380.2, 414.3, 446.9, 476.7, 504.7]
        // Remove every sample answer, including empty rows and example evaluation results.
        for (let i = 0; i < 10; i++) {
          const y = bounds[i], height = bounds[i + 1] - y - .7
          for (const [x, width] of [[34, 168], [205, 81], [290, 32], [326, 32], [362, 32], [398, 38], [440, 38], [482, 38], [524, 30]]) q.clear([x, y, width, height])
        }
        semesterGoals.slice(offset, offset + 10).forEach((goal, index) => {
          const top = bounds[index], height = bounds[index + 1] - top - .7
          const annualIndex = (domain?.annualGoals.findIndex(a => a.id === goal.annualGoalId) ?? 0) + 1
          const label = `${name} ${semester}目標 ${offset + index + 1}`
          q.field([34, top, 168, height], `${annualIndex}-${offset + index + 1} ${goal.content}`, label, { size: 9, min: 8 })
          q.field([205, top, 81, height], `${date(goal.startDate)}\n${date(goal.endDate)}`, label + '：起訖日期', { size: 8.5, min: 7.5 })
          const methodCodes: Record<string, string> = { '書面／紙筆': 'A', 口語發表: 'B', 觀察: 'C', 操作: 'D', 實作: 'D' }
          q.field([290, top, 32, height], [...new Set(goal.assessmentMethods.map(method => methodCodes[method] || 'E'))].join('、'), label + '：評量方式', { size: 9, min: 8 })
          q.field([326, top, 32, height], criterion(goal.achievementCriterion), label + '：達成標準', { size: 8, min: 7 })
          q.field([362, top, 32, height], ({ 獨立完成: 'V', 部分協助: '△', 高度協助: 'O' })[goal.assessmentSupport], label + '：評量支持', { size: 10, align: 'center' })
          for (const [i, record] of goal.evaluationRecords.entries()) {
            const full = lines([['日期', date(record.date)], ['結果', record.result], ['備註', record.notes]])
            if (i < 3) {
              const middle = [206.2, 241.9, 272.8, 301.6, 330.2, 365.4, 396.9, 430.6, 461.5, 490.5][index]
              q.field([398 + i * 42, top, 38, middle - top - 1], date(record.date, false), `${label}：評量 ${i + 1}日期`, { size: 8, min: 7 })
              q.field([398 + i * 42, middle + 1, 38, top + height - middle - 1], record.result, `${label}：評量 ${i + 1}結果`, { size: 8, min: 7 })
            }
            if (i >= 3 || record.notes) q.supplement(`${label}：評量 ${i + 1}`, full)
          }
          q.field([524, top, 30, height], ({ 通過: 'P', 繼續: 'C', 修正: 'A', 尚未決定: '' })[goal.teachingDecision], label + '：教學決定', { size: 10, align: 'center' })
          q.supplement(label + '：評量及教學說明', lines([['評量方式', goal.assessmentMethods.join('、')], ['其他方式', goal.assessmentMethods.includes('其他') ? goal.otherAssessmentMethod : ''], ['教學決定說明', goal.teachingDecisionNotes]]))
        })
        // Re-stroke source table rules after clearing sample cells, including the date/result dividers.
        for (const y of [187.2, 225.5, 257.4, 287.2, 315.9, 344.4, 379.7, 413.8, 446.5, 476.2, 505.2]) q.line(32.8, y, 555.9, y, .4)
        for (const y of [206.2, 241.9, 272.8, 301.6, 330.2, 365.4, 396.9, 430.6, 461.5, 490.5]) q.line(396.3, y, 522.4, y, .4)
        q.field([33, 691, 520, 14], `${name}（${semester}）學期目標達成情形及學生學習狀況說明`, '達成情形標題', { size: 10 })
        const passed = semesterGoals.filter(g => g.teachingDecision === '通過').length
        q.field([130, 707, 53, 14], semesterGoals.length ? passed : '', '通過目標數', { size: 9 })
        q.field([130, 724, 53, 14], semesterGoals.length || '', '全部目標數', { size: 9 })
        q.field([130, 740, 53, 14], semesterGoals.length ? `${Math.round(passed / semesterGoals.length * 100)}%` : '', '達成率', { size: 9 })
        q.field([188, 707, 365, 46], input.content.learningNotes, '學生學習狀況說明')
      }
    }
  }
}
