import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { choiceText, date, lines } from './format.js'

export async function drawBehavior(pdf: IepPdfDocument, input: IepPdfRequest) {
  const p = await pdf.page(15, '肆、行為功能介入方案及行政支援')
  const b = input.content.behaviorIntervention
  if (!b) { await pdf.page(16, '行為功能介入策略（參考）'); return }
  p.choices([b.needStatus], [36, 73, 520, 36])
  if (b.needStatus === '有需求') {
    p.choices([b.planStatus], [36, 109, 520, 55])
    p.field([145, 181, 393, 21], [date(b.planPeriod.startDate), date(b.planPeriod.endDate)].filter(Boolean).join(' ～ '), '介入計畫期程', { size: 11 })
    p.field([144, 205, 394, 22], b.behaviorAssessment.definition, '行為定義')
    p.field([144, 229, 167, 22], b.behaviorAssessment.time, '行為發生時間')
    p.field([399, 229, 139, 22], b.behaviorAssessment.location, '行為發生地點')
    p.field([144, 253, 394, 22], b.behaviorAssessment.triggers, '引發因素')
    p.supplement('行為頻率與持續時間', lines([['頻率', b.behaviorAssessment.frequency], ['持續時間', b.behaviorAssessment.duration]]))
    // The system uses internal/external stimulation categories, which must not be inferred as specific functions in the reference form.
    p.field([144, 277, 394, 127], b.behaviorFunctions.selected.map(value => `${value}：${b.behaviorFunctions.notes[value] || ''}`).join('\n'), '行為功能評估')
    p.field([57, 442, 83, 104], b.interventionGoal, '行為介入目標')
    const antecedent = lines([['環境策略', choiceText(b.antecedentStrategies.environment)], ['課程策略', choiceText(b.antecedentStrategies.curriculum)], ['互動策略', choiceText(b.antecedentStrategies.interaction)], ['說明', b.antecedentStrategies.notes]])
    const teaching = lines([['策略', choiceText(b.teachingStrategies)], ['說明', b.teachingStrategies.notes]])
    const consequence = lines([['增強適當行為', choiceText(b.consequenceStrategies.increase)], ['減少不當行為', choiceText(b.consequenceStrategies.reduce)], ['說明', b.consequenceStrategies.notes]])
    for (const [top, height, title, value] of [[442, 35, 'A 前事控制策略', antecedent], [480, 32, 'B 行為教導策略', teaching], [515, 32, 'C 後果處理策略', consequence]] as const) {
      p.field([314, top, 82, height], value, title, { size: 9, min: 8 })
      p.field([400, top, 77, height], choiceText(b.implementers), title + '執行人員', { size: 9, min: 8 })
    }
    p.supplement('個別因素與注意事項', b.individualFactors)
    p.field([144, 551, 394, 28], choiceText(b.administrativeSupports), '行政支援')
    const result = b.outcomeEvaluation
    p.field([57, 583, 481, 19], `執行成效評估及後續建議${result.date ? `（${date(result.date)}檢討）` : ''}`, '成效評估日期', { size: 11, align: 'center' })
    p.choices(result.methods.selected, [57, 629, 158, 115])
    p.choices([result.result], [218, 629, 158, 115])
    p.choices([result.recommendation], [380, 629, 158, 115])
    p.supplement('成效評估與建議說明', lines([['評估方式', choiceText(result.methods)], ['評估結果', result.result === '其他' ? result.resultOther : result.result], ['後續建議', result.recommendation === '其他' ? result.recommendationOther : result.recommendation], ['說明', result.notes]]))
  }
  await pdf.page(16, '行為功能介入策略（參考）')
}
