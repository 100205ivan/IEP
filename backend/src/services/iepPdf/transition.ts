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
      p.choices(['跨階段'], [31, 280, 525, 20])
      const stage = cross.educationStage
      const top = stage === '國小' ? 303.16 : stage === '國中' ? 396.16 : 527.7
      if (stage !== '其他') {
        p.check(36, top)
        p.field([78, top, 26, 15], cross.grade.replace(/年級/g, ''), '跨階段轉銜年級', { size: 9, min: 8 })
      }
      if (stage === '國小') {
        for (const [key, x, label] of [['caregiver', 36, '照顧者'], ['student', 277.27, '學生']] as const) {
          const pref = cross.elementaryPlan[key]
          if (pref.selected.some(value => ['國中普通班', '國中資源班', '國中特教班'].includes(value))) {
            p.check(x, 339.52)
            p.field([x + 13, 339, 37, 15], pref.selected.filter(value => ['國中普通班', '國中資源班', '國中特教班'].includes(value)).map(value => value.replace('國中', '')).join('、'), `國小升學規劃：${label}`, { size: 8, min: 7 })
          }
          if (pref.selected.includes('特殊學校國中部')) p.check(x, 357.4)
          if (pref.selected.includes('其他')) { p.check(x, 375.4); p.field([x + 38, 375, 190, 15], pref.other, `國小其他升學規劃：${label}`, { size: 9 }) }
        }
      } else if (stage === '國中' || stage === '高中') {
        const plan = stage === '國中' ? cross.juniorHighPlan : cross.seniorHighPlan
        const rows = stage === '國中' ? [452.1, 479.46, 506.82] : [583.5, 601.98, 620.49, 638.85]
        const educationOptions = stage === '國中' ? ['高級中等學校', '高級中等學校集中式特教班', '特殊教育學校'] : ['一般大學', '科技大學', '專科學校', '其他']
        const header = stage === '國中' ? 415.12 : 546.66
        if (plan.furtherEducation.caregiver.selected.length || plan.furtherEducation.student.selected.length) p.check(36, header)
        if (plan.employment.caregiver.selected.length || plan.employment.student.selected.length) p.check(278.47, header)
        if (plan.otherPlan) { p.check(484.06, header); p.supplement(stage + '其他生涯規劃', plan.otherPlan) }
        for (const [key, x, jobX, label] of [['caregiver', 171.77, 343.03, '照顧者'], ['student', 239.09, 417.58, '學生']] as const) {
          const education = plan.furtherEducation[key], employment = plan.employment[key]
          educationOptions.forEach((option, index) => { if (education.selected.includes(option)) p.check(x, rows[index]) })
          if (education.selected.includes('其他')) p.supplement(stage + '其他升學規劃：' + label, education.other)
          for (const [index, option, field] of [[0, '職場', 'Workplace'], [1, '在家', 'Home']] as const) {
            if (!employment.selected.includes(option)) continue
            p.check(jobX, rows[index])
            const detail = cross.employmentDetails?.[stage]?.[`${key}${field}`]
            p.field([jobX + 13, rows[index], key === 'caregiver' ? 59 : 49, 15], detail, `${stage}：${label}${option}規劃`, { size: 8, min: 7 })
          }
          if (employment.selected.includes('其他')) p.supplement(stage + '其他就業規劃：' + label, employment.other)
        }
        if (plan.employment.caregiver.selected.includes('其他') || plan.employment.student.selected.includes('其他')) p.field([285, rows[2], 195, 15], lines([['照顧者', plan.employment.caregiver.other], ['學生', plan.employment.student.other]]).replace(/\n/g, '　'), stage + '其他就業規劃', { size: 8, min: 7 })
      } else p.supplement('其他教育階段轉銜規劃', cross.otherStageNotes)
    }
  }
  const followUps = t && !t.noTransitionNeed && t.followUp.enabled ? t.followUp.records : []
  for (let offset = 0; offset < Math.max(1, followUps.length); offset += 2) {
    const q = await pdf.page(18, '伍、轉銜服務及離校後追蹤輔導')
    if (t && !t.noTransitionNeed && offset === 0) {
      for (const [i, [key, label, start, end]] of ([['education', '升學輔導', 93, 132], ['dailyLiving', '生活輔導', 139, 182], ['employment', '就業輔導', 193, 232], ['psychological', '心理輔導', 239, 276], ['welfare', '福利服務', 282, 318], ['professional', '相關專業服務', 323, 359]] as const).entries()) {
        const service = t.services[key]
        q.choices([service.needStatus], [92, start - 2, 82, end - start])
        if (service.needStatus !== '有需求') continue
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
