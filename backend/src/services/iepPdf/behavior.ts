import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { FormFlow } from './flow.js'
import { choiceText, date, lines } from './format.js'
import { drawBehaviorReference } from './reference.js'

export async function drawBehavior(pdf: IepPdfDocument, input: IepPdfRequest) {
  const b = input.content.behaviorIntervention
  if (!b || !b.needStatus) await pdf.page(15, '肆、行為功能介入方案及行政支援')
  else {
    const f = await FormFlow.create(pdf, input, '肆、行為功能介入方案及行政支援')
    await f.fields([['介入需求', b.needStatus === '暫無需求' ? '經評估，學生暫無此需求。' : '經評估，學生有需求。']])
    if (b.needStatus === '有需求') {
      await f.fields([['方案狀態', b.planStatus], ['計畫執行期間', [date(b.planPeriod.startDate), date(b.planPeriod.endDate)].filter(Boolean).join(' ～ ')]])
      await f.heading('行為評估')
      await f.fields([['行為定義', b.behaviorAssessment.definition], ['發生時間', b.behaviorAssessment.time], ['發生地點', b.behaviorAssessment.location], ['引發因素', b.behaviorAssessment.triggers], ['發生頻率', b.behaviorAssessment.frequency], ['持續時間', b.behaviorAssessment.duration]])
      if (b.behaviorFunctions.selected.length) { await f.heading('行為功能分析'); await f.table(['行為功能', '說明'], [150, 370], b.behaviorFunctions.selected.map(value => [value, b.behaviorFunctions.notes[value] || ''])) }
      await f.paragraph('行為介入目標', b.interventionGoal)
      const strategies = [
        ['antecedent', 'A 前事處理與先兆控制', lines([['環境策略', choiceText(b.antecedentStrategies.environment)], ['課程策略', choiceText(b.antecedentStrategies.curriculum)], ['互動策略', choiceText(b.antecedentStrategies.interaction)], ['說明', b.antecedentStrategies.notes]])],
        ['teaching', 'B 行為教導策略', lines([['策略', choiceText(b.teachingStrategies)], ['說明', b.teachingStrategies.notes]])],
        ['consequence', 'C 後果處理策略', lines([['增強適當行為', choiceText(b.consequenceStrategies.increase)], ['減少不當行為', choiceText(b.consequenceStrategies.reduce)], ['說明', b.consequenceStrategies.notes]])],
      ] as const
      for (const [key, title, value] of strategies) {
        await f.heading(title)
        await f.paragraph('介入策略', value)
        const execution = b.executionDetails?.[key]
        await f.fields([['執行方式', execution?.executionMethod], ['執行人員', execution?.implementers ?? choiceText(b.implementers)], ['執行狀況', execution?.progress]])
      }
      await f.paragraph('個別因素與注意事項', b.individualFactors)
      await f.paragraph('行政支援', choiceText(b.administrativeSupports))
      const result = b.outcomeEvaluation
      await f.heading('執行成效評估及後續建議')
      await f.fields([['檢討日期', date(result.date)], ['評估方式', choiceText(result.methods)], ['評估結果', result.result === '其他' ? result.resultOther : result.result], ['後續建議', result.recommendation === '其他' ? result.recommendationOther : result.recommendation], ['補充說明', result.notes]])
    }
  }
  if (b?.needStatus) await drawBehaviorReference(pdf, input)
  else await pdf.page(16, '行為功能介入策略（參考）')
}
