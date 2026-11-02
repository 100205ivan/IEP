import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { lines } from './format.js'
import { drawSupportReference, drawInclusiveReference, drawCoursePlan } from './referenceServices.js'

export async function drawServices(pdf: IepPdfDocument, input: IepPdfRequest) {
  const p = await pdf.page(8, '貳、一、特殊教育及支持服務需求')
  const support = input.content.specialEducationSupport
  const courses = input.content.coursePlanItems ?? []
  const specialNames = ['生活管理', '社會技巧', '學習策略', '職業教育', '溝通訓練', '點字', '定向行動', '功能性動作訓練', '輔助科技應用', '情意發展', '領導才能', '創造力', '獨立研究']
  for (const [index, name] of (support?.referenceDetails?.curriculumNeed === '無需求' ? [] : specialNames).entries()) {
    const matching = courses.filter(course => course.courseName.includes(name))
    if (!matching.length) continue
    const top = 143 + index * 16.06
    p.choices([name], [72, top - 2, 132, 17])
    for (const [x, method] of [[206, '原班上課'], [294, '抽離式'], [382, '外加式']] as const) {
      const count = matching.filter(course => (course.placement ?? ({ 原班上課: '原班', 抽離式: '抽離', 外加式: '外加' } as Record<string, string>)[course.teachingMethod]) === ({ 原班上課: '原班', 抽離式: '抽離', 外加式: '外加' } as Record<string, string>)[method]).reduce((sum, course) => sum + course.weeklyPeriods, 0)
      if (count) p.field([x, top, 85, 14], count, name + method + '節數', { size: 9 })
    }
    p.field([470, top, 85, 14], matching.map(course => course.teacher).filter(Boolean).join('、'), name + '教師', { size: 9 })
  }
  if (support && support.referenceDetails?.supportNeed !== '無需求') {
    p.supplement('特殊教育服務', lines([['服務型態', support.specialEducation.join('、')], ['其他服務', support.specialEducation.includes('其他') ? support.specialOther : ''], ['頻率', support.specialFrequency === '其他' ? support.specialFrequencyOther : support.specialFrequency === '請選擇' ? '' : support.specialFrequency], ['服務說明', support.specialNotes]]))
    // Exact provider qualifications are selected in referenceDetails; generic legacy service names remain in the supplement.
    for (const service of support.professional) {
      const detail = support.professionalDetails[service]
      p.supplement(`專業服務：${service}`, detail ? lines([['服務名稱', service === '其他' ? detail.serviceName : service], ['提供者', detail.provider], ['頻率', detail.frequency === '其他' ? detail.otherFrequency : detail.frequency === '請選擇' ? '' : detail.frequency], ['開始日期', detail.startDate], ['結束日期', detail.endDate], ['說明', detail.notes]]) : service)
    }
    if (!support.referenceDetails) p.choices(support.familySupport, [206, 593, 350, 46], { 家庭諮詢: '家庭諮詢', 教育資訊: '教育', 社會福利資訊: '社會福利' })
    p.supplement('家庭支持', lines([['服務', support.familySupport.join('、')], ['其他', support.familySupport.includes('其他') ? support.familyOther : ''], ['說明', support.familyNotes]]))
    if (!support.referenceDetails) p.choices(support.staffSupport, [206, 458, 350, 75], { 教師助理: '教師助理', 特教學生助理人員: '特教學生助理' })
    p.supplement('人力支持', lines([['人員', support.staffSupport.join('、')], ['每週時數', support.staffHours], ['其他人力', support.staffSupport.includes('其他') ? support.staffOther : '']]))
    if (!support.referenceDetails && support.administrativeSupport.includes('無障礙環境')) p.choices(['校園無障礙環境'], [72, 669, 134, 30])
    p.supplement('行政支持', lines([['支持項目', support.administrativeSupport.join('、')], ['其他', support.administrativeSupport.includes('其他') ? support.administrativeOther : '']]))
    if (!support.referenceDetails) p.choices(support.transportSupport, [206, 699, 350, 46])
    p.supplement('交通與其他支持服務', lines([['交通／其他支持', support.transportSupport.join('、')], ['其他', support.transportSupport.includes('其他') ? support.transportOther : ''], ['說明', support.otherSupportNotes]]))
  }
  drawSupportReference(p, input)
  const inclusive = input.content.inclusiveEducationPlan
  const adjustment = input.content.curriculumAdjustment
  const subjects = [...new Set([...Object.values(adjustment ?? {}).flatMap(group => group && typeof group === 'object' && 'applicableSubjects' in group ? (group as { applicableSubjects: string[] }).applicableSubjects : []), ...Object.keys(adjustment?.subjectDetails ?? {})])]
  for (let offset = 0; offset < Math.max(1, subjects.length); offset += 4) {
    const q = await pdf.page(9, '貳、二至三、融合教育及課程調整')
    if (inclusive && offset === 0) {
      drawInclusiveReference(q, input)
      if (!inclusive.referenceRows) q.choices(inclusive.strategies, [94, 202, 111, 75], { 同儕協助: '同儕協助' })
      if (!inclusive.referenceRows) q.field([208, 75, 124, 51], lines([['班級', `${inclusive.grade} ${inclusive.className}`.trim()], ['方式', inclusive.participation], ['活動', inclusive.activities.join('、')]]), '融合教育參與規劃')
      if (!inclusive.referenceRows) q.field([208, 130, 124, 70], inclusive.activityNotes, '融合活動說明')
      if (!inclusive.referenceRows) q.field([208, 204, 124, 70], inclusive.strategyNotes || inclusive.strategies.join('、'), '融合支持策略')
      q.supplement('融合教育參與', lines([['班級', `${inclusive.grade} ${inclusive.className}`.trim()], ['參與方式', inclusive.participation], ['活動說明', inclusive.activityNotes], ['支持策略說明', inclusive.strategyNotes],['參與說明', inclusive.participationNotes], ['抽離課程', inclusive.participation === '部分時間抽離' ? inclusive.withdrawalSubjects.join('、') : ''], ['其他抽離課程', inclusive.participation === '部分時間抽離' && inclusive.withdrawalSubjects.includes('其他') ? inclusive.withdrawalOther : ''], ['其他參與方式', inclusive.participation === '其他方式' ? inclusive.otherParticipationNotes : '']]))
      q.supplement('融合活動與支持', lines([['活動', inclusive.activities.join('、')], ['其他活動', inclusive.activities.includes('其他') ? inclusive.activityOther : ''], ['支持策略', inclusive.strategies.join('、')], ['其他策略', inclusive.strategies.includes('其他') ? inclusive.strategyOther : '']]))
    }
    subjects.slice(offset, offset + 4).forEach((subject, i) => {
      const top = 516 + i * 61.05
      q.field([33, top, 83, 58], subject, '課程調整適用科目', { align: 'center' })
      for (const [key, x, title] of [['content', 120, '學習內容'], ['process', 208, '學習歷程'], ['environment', 296, '學習環境'], ['assessment', 383, '學習評量']] as const) {
        const group = adjustment?.[key]
        if (!group) continue
        const state = adjustment?.subjectDetails?.[subject]?.[key] ?? (group.applicableSubjects.includes(subject as never) && (group.selectedStrategies.length || group.description) ? '須調整' : '')
        if (!state) continue
        q.choices([state === '無須調整' ? '與一般生相同' : '須調整'], [x - 1, top - 1, 86, 59])
        if (state === '無須調整') continue
        const description = lines([['策略', group.selectedStrategies.join('、')], ['其他策略', group.selectedStrategies.includes('其他') ? group.otherStrategy : ''], ['其他課程', subject === '其他' ? group.otherSubject : ''], ['說明', group.description]])
        q.field([x, top + 42, 83, 14], description, `${subject}：${title}調整`, { size: 9, min: 8 })
      }
      const teacher = adjustment?.subjectDetails?.[subject]?.teacher ?? [...new Set(courses.filter(course => course.courseName.includes(subject)).map(course => course.teacher).filter(Boolean))].join('、')
      q.field([471, top, 83, 58], teacher, subject + '：授課教師')
    })
    if (offset === 0 && adjustment) for (const [key, title] of [['content', '學習內容'], ['process', '學習歷程'], ['environment', '學習環境'], ['assessment', '學習評量']] as const) {
      const group = adjustment[key]
      if (!group.applicableSubjects.length) q.supplement(title + '調整（尚未指定課程）', lines([['策略', group.selectedStrategies.join('、')], ['其他', group.selectedStrategies.includes('其他') ? group.otherStrategy : ''], ['說明', group.description]]))
    }
  }
  const plan = await pdf.page(10, '貳、四、學生課程規劃表')
  drawCoursePlan(plan, input)
  const week = await pdf.page(11, '貳、五、學生每週課表')
  const days = ['星期一', '星期二', '星期三', '星期四', '星期五']
  const periods = ['早自習', '第一節', '第二節', '第三節', '第四節', '午休', '第五節', '第六節', '第七節', '第八節']
  const tops = [160, 181, 202, 223, 245, 266, 290, 311, 332, 354]
  for (const entry of input.content.weeklySchedule ?? []) {
    const course = courses.find(c => c.id === entry.courseId)
    if (!course) continue
    const second = (entry.semester ?? input.options.weeklyScheduleSemester) === '第二學期' ? 314.2 : 0
    const index = periods.indexOf(entry.period), x = 109 + days.indexOf(entry.day) * 82.2
    const box = [x, tops[index] + second, 79, index === 5 ? 22 : 19] as const
    const shaded = course.courseType === '特殊需求領域課程' || ['抽離', '外加'].includes(course.placement ?? ({ 抽離式: '抽離', 外加式: '外加' } as Record<string, string>)[course.teachingMethod])
    if (shaded) week.shade(box)
    week.field(box, [course.courseName, course.teacher].filter(Boolean).join('\n'), `${entry.day} ${entry.period}`, { size: 8, min: 7, clear: !shaded })
  }
  await pdf.page(12, '學生教育需求評估項目說明（參考）')
}
