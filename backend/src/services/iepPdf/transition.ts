import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { choiceText, date, lines } from './format.js'

export async function drawTransition(pdf: IepPdfDocument, input: IepPdfRequest) {
  const p = await pdf.page(17, '伍、學生之轉銜輔導及服務內容')
  const t = input.content.transitionSupport
  if (t?.noTransitionNeed) p.field([123, 193, 432, 20], '經評估，目前無轉銜需求。', '轉銜需求')
  if (t && !t.noTransitionNeed) {
    p.choices(t.transitionReasons.selected, [31, 148, 525, 19])
    p.choices(t.transitionFocus.selected, [31, 167, 525, 19])
    p.field([123, 193, 432, 20], t.generalServiceContent, '轉銜服務內容')
    p.field([123, 217, 432, 20], t.receivingUnit, '接收單位')
    p.field([123, 241, 432, 20], t.specialNotes, '轉銜特別注意事項')
    p.supplement('轉銜原因與重點', lines([['原因', choiceText(t.transitionReasons)], ['重點', choiceText(t.transitionFocus)]]))
    const cross = t.crossStagePlan
    if (cross.enabled) {
      p.choices(['跨教育階段'], [31, 280, 525, 20])
      const top = cross.educationStage === '國小' ? 302 : cross.educationStage === '國中' ? 395 : 526
      p.field([34, top, 235, 17], `${cross.educationStage}　${cross.grade}`, '跨階段轉銜年級', { size: 11 })
      if (cross.educationStage === '國小') {
        for (const [key, x, label] of [['caregiver', 34, '照顧者'], ['student', 279, '學生']] as const) {
          p.field([x, 339, key === 'caregiver' ? 240 : 275, 52], choiceText(cross.elementaryPlan[key]), `國小升學規劃：${label}`, { size: 10 })
        }
      } else if (cross.educationStage === '國中' || cross.educationStage === '高中') {
        const plan = cross.educationStage === '國中' ? cross.juniorHighPlan : cross.seniorHighPlan
        const start = cross.educationStage === '國中' ? 450 : 581
        for (const [key, x, label] of [['caregiver', 144, '照顧者'], ['student', 215, '學生']] as const) {
          p.field([x, start, 59, cross.educationStage === '國中' ? 54 : 68], choiceText(plan.furtherEducation[key]), '升學意願：' + label, { size: 8, min: 7 })
          p.field([key === 'caregiver' ? 418 : 485, start, 67, 54], choiceText(plan.employment[key]), '就業意願：' + label, { size: 8, min: 7 })
        }
        p.supplement(cross.educationStage + '其他生涯規劃', plan.otherPlan)
      } else p.supplement('其他教育階段轉銜規劃', cross.otherStageNotes)
    }
  }
  const followUps = t && !t.noTransitionNeed && t.followUp.enabled ? t.followUp.records : []
  for (let offset = 0; offset < Math.max(1, followUps.length); offset += 2) {
    const q = await pdf.page(18, '伍、轉銜服務及離校後追蹤輔導')
    if (t && !t.noTransitionNeed && offset === 0) {
      for (const [i, [key, label, start, end]] of ([['education', '學習輔導', 93, 132], ['dailyLiving', '生活輔導', 139, 182], ['employment', '就業輔導', 193, 232], ['psychological', '心理輔導', 239, 276], ['welfare', '福利服務', 282, 318], ['professional', '相關專業服務', 323, 359]] as const).entries()) {
        const service = t.services[key]
        q.choices([service.needStatus], [92, start - 2, 82, end - start])
        if (service.needStatus === '無需求') continue
        q.choices(service.options.selected, [178, start - 2, 223, end - start], { 熟悉新學校上學路線: '熟悉新學校上學的路線' })
        q.field([404, start, 52, end - start - 1], [date(service.startDate), date(service.endDate)].filter(Boolean).join('\n～\n'), label + '服務日期', { size: 8, min: 7 })
        q.field([460, start, 52, end - start - 1], service.provider, label + '提供者', { size: 9, min: 8 })
        q.field([515, start, 40, end - start - 1], service.progress, label + '執行狀況', { size: 9, min: 8 })
        q.supplement(`${i + 1}. ${label}需求`, lines([['需求說明', service.needsDescription], ['服務內容', choiceText(service.options)]]))
      }
    }
    if (followUps.length) q.choices(['離校後追蹤輔導'], [31, 374, 525, 20])
    followUps.slice(offset, offset + 2).forEach((record, index) => {
      const delta = index * 163.4, label = `追蹤輔導 ${offset + index + 1}`
      q.field([123, 398 + delta, 432, 14], date(record.date), label + '日期', { size: 10 })
      q.choices(record.methods, [123, 413 + delta, 432, 17])
      q.choices(record.focusAreas, [123, 429 + delta, 432, 17])
      q.field([123, 447 + delta, 432, 43], record.summary, label + '內容摘要')
      q.choices([record.serviceDisposition], [123, 491 + delta, 432, 17])
      q.field([123, 510 + delta, 432, 14], record.receivingUnitContact, label + '受理單位聯繫', { size: 9, min: 8 })
      q.field([123, 527 + delta, 432, 12], record.specialNotes, label + '特殊記載事項', { size: 8, min: 7 })
      q.supplement(label + '方式及處理說明', lines([['追蹤方式', record.methods.join('、')], ['社群平台', record.methods.includes('社群平台') ? record.socialPlatform : ''], ['其他方式', record.methods.includes('其他') ? record.otherMethod : ''], ['輔導重點', record.focusAreas.join('、')], ['其他重點', record.focusAreas.includes('其他') ? record.otherFocus : ''], ['轉介／通報說明', record.serviceDisposition !== '適應良好' ? record.dispositionDetails : '']]))
    })
  }
}
