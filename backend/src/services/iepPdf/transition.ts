import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { FormFlow, type FieldRow } from './flow.js'
import { choiceText, date } from './format.js'

export async function drawTransition(pdf: IepPdfDocument, input: IepPdfRequest) {
  const t = input.content.transitionSupport
  if (!t) { await pdf.page(17, '伍、學生之轉銜輔導及服務內容'); await pdf.page(18, '伍、轉銜服務及離校後追蹤輔導'); return }
  const f = await FormFlow.create(pdf, input, '伍、學生之轉銜輔導及服務內容')
  await f.fields([['轉銜需求', t.noTransitionNeed ? '經評估，目前無轉銜需求。' : '轉銜輔導與服務規劃']])
  if (!t.noTransitionNeed) {
    await f.fields([['轉銜原因', choiceText(t.transitionReasons)], ['轉銜輔導重點', choiceText(t.transitionFocus)], ['轉銜服務內容', t.generalServiceContent], ['受理轉銜單位', t.receivingUnit], ['特殊記載事項', t.specialNotes]])
    const cross = t.crossStagePlan
    if (cross.enabled) {
      await f.heading('跨階段生涯轉銜計畫')
      await f.info([['目前教育階段', cross.educationStage], ['目前年級', cross.grade]])
      if (cross.educationStage === '國小') await f.table(['規劃項目', '法定代理人／實際照顧者期望', '學生意願'], [110, 205, 205], [['升學／安置', choiceText(cross.elementaryPlan.caregiver), choiceText(cross.elementaryPlan.student)]])
      else if (cross.educationStage === '國中' || cross.educationStage === '高中') {
        const stage = cross.educationStage, plan = stage === '國中' ? cross.juniorHighPlan : cross.seniorHighPlan
        await f.table(['規劃項目', '法定代理人／實際照顧者期望', '學生意願'], [110, 205, 205], [['升學', choiceText(plan.furtherEducation.caregiver), choiceText(plan.furtherEducation.student)], ['就業／在家', choiceText(plan.employment.caregiver), choiceText(plan.employment.student)]])
        const employmentRows: FieldRow[] = []
        for (const [key, label] of [['caregiver', '照顧者'], ['student', '學生']] as const) {
          const options = plan.employment[key].selected, detail = cross.employmentDetails?.[stage]
          employmentRows.push([label + '職場規劃', options.includes('職場') ? detail?.[`${key}Workplace`] : ''], [label + '在家規劃', options.includes('在家') ? detail?.[`${key}Home`] : ''])
        }
        await f.fields(employmentRows)
        await f.paragraph('其他生涯規劃', plan.otherPlan)
      } else await f.paragraph('其他教育階段轉銜規劃', cross.otherStageNotes)
    }
  }
  if (t.noTransitionNeed) { await pdf.page(18, '伍、轉銜服務及離校後追蹤輔導'); return }
  const services = await FormFlow.create(pdf, input, '伍、轉銜服務及離校後追蹤輔導')
  for (const [key, title] of [['education', '升學輔導'], ['dailyLiving', '生活輔導'], ['employment', '就業輔導'], ['psychological', '心理輔導'], ['welfare', '福利服務'], ['professional', '相關專業服務']] as const) {
    const service = t.services[key]
    await services.heading(title)
    const rows: FieldRow[] = [['需求評估', service.needStatus || '尚未評估／未填']]
    if (service.needStatus === '有需求') rows.push(['服務內容', choiceText(service.options)], ['需求說明', service.needsDescription], ['開始日期', date(service.startDate)], ['結束日期', date(service.endDate)], ['受理單位／執行者', service.provider], ['執行狀況', service.progress])
    await services.fields(rows, title)
  }
  if (t.followUp.enabled) {
    await services.heading('離校後追蹤輔導（六個月）')
    for (const [index, record] of t.followUp.records.entries()) {
      await services.heading(`第 ${index + 1} 筆追蹤輔導紀錄`)
      await services.fields([['追蹤日期', date(record.date)], ['追蹤方式', record.methods.join('、')], ['社群平台', record.methods.includes('社群平台') ? record.socialPlatform : ''], ['其他方式', record.methods.includes('其他') ? record.otherMethod : ''], ['輔導重點', record.focusAreas.join('、')], ['其他重點', record.focusAreas.includes('其他') ? record.otherFocus : ''], ['內容摘要', record.summary], ['服務處理', record.serviceDisposition], ['轉介／通報說明', record.serviceDisposition !== '適應良好' ? record.dispositionDetails : ''], ['受理單位聯繫', record.receivingUnitContact], ['特殊記載事項', record.specialNotes]], `第 ${index + 1} 筆追蹤輔導`)
    }
  }
}
