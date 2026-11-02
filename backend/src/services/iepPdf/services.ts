import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { referenceOptions } from '../../schemas/referenceForms.js'
import { IepPdfDocument } from './layout.js'
import { FormFlow } from './flow.js'
import { date, lines } from './format.js'

type Course = NonNullable<IepPdfRequest['content']['coursePlanItems']>[number]
const placement = (course: Course) => course.placement ?? ({ 原班上課: '原班', 抽離式: '抽離', 外加式: '外加' } as Record<string, string>)[course.teachingMethod] ?? ''
const specialNames = ['生活管理', '社會技巧', '學習策略', '職業教育', '溝通訓練', '點字', '定向行動', '功能性動作訓練', '輔助科技應用', '情意發展', '領導才能', '創造力', '獨立研究']
const category = (course: Course) => {
  if (course.referenceCategory) return course.referenceCategory
  const name = course.courseName
  return /國語|英語|語文/.test(name) ? '部定：語文' : /數學/.test(name) ? '部定：數學' : /生活/.test(name) && course.courseType === '普通教育課程' ? '部定：生活' : /社會/.test(name) && course.courseType === '普通教育課程' ? '部定：社會' : /自然/.test(name) ? '部定：自然科學' : /藝術/.test(name) ? '部定：藝術' : /綜合/.test(name) ? '部定：綜合活動' : /科技/.test(name) ? '部定：科技' : /健康|體育/.test(name) ? '部定：健康與體育' : course.courseType === '特殊需求領域課程' ? '校訂彈性：特殊需求領域課程' : '校訂彈性：其他類課程'
}
const frequency = (value: string, other = '') => value === '其他' ? other : value === '請選擇' ? '' : value

export async function drawServices(pdf: IepPdfDocument, input: IepPdfRequest) {
  const support = input.content.specialEducationSupport, courses = input.content.coursePlanItems ?? []
  if (support || courses.some(course => specialNames.some(name => course.courseName.includes(name)))) {
    const f = await FormFlow.create(pdf, input, '貳、一、特殊教育及支持服務需求')
    const ref = support?.referenceDetails
    await f.fields([['特殊需求領域課程', ref?.curriculumNeed || '尚未評估／未填']])
    if (ref?.curriculumNeed !== '無需求') {
      const matching = specialNames.flatMap(name => {
        const items = courses.filter(course => course.courseName.includes(name))
        return items.length ? [[name, ...['原班', '抽離', '外加'].map(method => String(items.filter(course => placement(course) === method).reduce((sum, course) => sum + course.weeklyPeriods, 0))), [...new Set(items.map(course => course.teacher))].filter(Boolean).join('、')]] : []
      })
      if (matching.length) await f.table(['課程', '原班節數', '抽離節數', '外加節數', '提供者'], [160, 65, 65, 65, 165], matching)
    }
    if (support) {
      await f.fields([['支持服務整體需求', ref?.supportNeed || '尚未評估／未填']])
      if (ref?.supportNeed !== '無需求') {
        await f.paragraph('特殊教育服務', lines([['服務型態', support.specialEducation.join('、')], ['其他服務', support.specialEducation.includes('其他') ? support.specialOther : ''], ['頻率', frequency(support.specialFrequency, support.specialFrequencyOther)], ['服務說明', support.specialNotes]]))
        for (const service of support.professional) {
          const detail = support.professionalDetails[service]
          await f.paragraph(`相關專業服務：${service}`, detail ? lines([['服務名稱', service === '其他' ? detail.serviceName : service], ['提供者', detail.provider], ['頻率', frequency(detail.frequency, detail.otherFrequency)], ['開始日期', date(detail.startDate)], ['結束日期', date(detail.endDate)], ['說明', detail.notes]]) : service)
        }
        await f.paragraph('家庭支持', lines([['服務', support.familySupport.join('、')], ['其他', support.familySupport.includes('其他') ? support.familyOther : ''], ['說明', support.familyNotes]]))
        await f.paragraph('人力支持', lines([['人員', support.staffSupport.join('、')], ['每週時數', support.staffHours], ['其他人力', support.staffSupport.includes('其他') ? support.staffOther : '']]))
        await f.paragraph('行政支持', lines([['支持項目', support.administrativeSupport.join('、')], ['其他', support.administrativeSupport.includes('其他') ? support.administrativeOther : '']]))
        await f.paragraph('交通及其他支持', lines([['項目', support.transportSupport.join('、')], ['其他', support.transportSupport.includes('其他') ? support.transportOther : ''], ['說明', support.otherSupportNotes]]))
        if (ref) for (const config of referenceOptions.supportGroups) {
          const group = ref.groups[config.id]
          if (!group) continue
          await f.paragraph(config.title, group.status === '無需求' ? '無需求' : lines([['需求', group.status || '尚未評估／未填'], ['提供方式', group.selected.map(option => option + (group.notes[option] ? '：' + group.notes[option] : '')).join('\n')], ['補充說明', group.description]]))
        }
      }
    }
  } else await pdf.page(8, '貳、一、特殊教育及支持服務需求')

  const inclusive = input.content.inclusiveEducationPlan, adjustment = input.content.curriculumAdjustment
  if (inclusive || adjustment) {
    const f = await FormFlow.create(pdf, input, '貳、二、融合教育規劃及三、課程調整方式')
    if (inclusive) {
      await f.heading('二、融合教育規劃')
      await f.fields([['就讀班級', `${inclusive.grade} ${inclusive.className}`.trim()], ['參與方式', inclusive.participation], ['參與說明', inclusive.participationNotes], ['抽離課程', inclusive.participation === '部分時間抽離' ? inclusive.withdrawalSubjects.join('、') : ''], ['其他抽離課程', inclusive.participation === '部分時間抽離' && inclusive.withdrawalSubjects.includes('其他') ? inclusive.withdrawalOther : ''], ['其他參與方式', inclusive.participation === '其他方式' ? inclusive.otherParticipationNotes : '']])
      const active = inclusive.referenceRows?.filter(row => row.selected) ?? []
      if (active.length) await f.table(['項目', '執行方式', '起訖時間／頻率', '負責單位／人'], [100, 160, 130, 130], active.map(row => [row.item, row.execution, [date(row.startDate), date(row.endDate), row.frequency].filter(Boolean).join('\n'), row.responsible]))
      await f.paragraph('融合活動與支持策略', lines([['活動', inclusive.activities.join('、')], ['其他活動', inclusive.activities.includes('其他') ? inclusive.activityOther : ''], ['活動說明', inclusive.activityNotes], ['支持策略', inclusive.strategies.join('、')], ['其他策略', inclusive.strategies.includes('其他') ? inclusive.strategyOther : ''], ['策略說明', inclusive.strategyNotes]]))
    }
    if (adjustment) {
      await f.heading('三、課程調整方式')
      const keys = [['content', '學習內容'], ['process', '學習歷程'], ['environment', '學習環境'], ['assessment', '學習評量']] as const
      const subjects = [...new Set([...keys.flatMap(([key]) => adjustment[key].applicableSubjects), ...Object.keys(adjustment.subjectDetails ?? {})])]
      for (const subject of subjects) {
        await f.heading(subject)
        const detail = adjustment.subjectDetails?.[subject]
        await f.info([['授課教師', detail?.teacher ?? [...new Set(courses.filter(course => course.courseName.includes(subject)).map(course => course.teacher))].filter(Boolean).join('、')]])
        const unfilled: string[] = []
        for (const [key, label] of keys) {
          const group = adjustment[key]
          const state = detail?.[key] ?? (group.applicableSubjects.includes(subject as never) && (group.selectedStrategies.length || group.description) ? '須調整' : '')
          if (!state) { unfilled.push(label); continue }
          await f.paragraph(subject + '：' + label, state === '須調整' ? lines([['調整判斷', state], ['策略', group.selectedStrategies.join('、')], ['其他策略', group.selectedStrategies.includes('其他') ? group.otherStrategy : ''], ['其他課程', subject === '其他' ? group.otherSubject : ''], ['說明', group.description]]) : state === '無須調整' ? '與一般生相同，無須調整。' : '尚未填寫調整判斷。')
        }
        if (unfilled.length) await f.info([[subject + '未填判斷', unfilled.join('、')]])
      }
      for (const [key, label] of keys) {
        const group = adjustment[key]
        if (!group.applicableSubjects.length) await f.paragraph(label + '調整（尚未指定課程）', lines([['策略', group.selectedStrategies.join('、')], ['其他', group.selectedStrategies.includes('其他') ? group.otherStrategy : ''], ['說明', group.description]]))
      }
    }
  } else await pdf.page(9, '貳、二至三、融合教育及課程調整')

  if (courses.length) {
    const f = await FormFlow.create(pdf, input, '貳、四、學生課程規劃表')
    await f.fields([['每週合計節數', String(courses.reduce((sum, course) => sum + course.weeklyPeriods, 0)) + ' 節']])
    await f.table(['課程／原表分類', '排課方式／節數', '起訖日期', '教師／地點'], [155, 95, 120, 150], courses.map(course => [course.courseName + '\n' + category(course), [placement(course), `${course.weeklyPeriods} 節／週`].filter(Boolean).join('\n'), [date(course.startDate), date(course.endDate)].filter(Boolean).join('\n'), [course.teacher, course.location === '其他' ? course.otherLocation : course.location].filter(Boolean).join('\n')]))
    for (const course of courses) await f.paragraph(course.courseName + '課程補充', lines([['課程類型', course.courseType === '其他' ? course.otherCourseType : course.courseType], ['教學方式', course.teachingMethod === '其他' ? course.otherTeachingMethod : course.teachingMethod], ['備註', course.notes]]))
  } else await pdf.page(10, '貳、四、學生課程規劃表')

  const schedule = input.content.weeklySchedule ?? []
  if (courses.length && schedule.length) {
    const f = await FormFlow.create(pdf, input, '貳、五、學生每週課表')
    const days = ['星期一', '星期二', '星期三', '星期四', '星期五'], periods = ['早自習', '第一節', '第二節', '第三節', '第四節', '午休', '第五節', '第六節', '第七節', '第八節']
    for (const [index, semester] of ['第一學期', '第二學期'].entries()) {
      if (index) await f.pageBreak()
      await f.heading(semester + '（灰底表示抽離、外加或特殊需求課程）')
      const shade = new Set<string>()
      const rows = periods.map((period, row) => [period, ...days.map((day, column) => {
        const entry = schedule.find(entry => entry.day === day && entry.period === period && (entry.semester ?? input.options.weeklyScheduleSemester) === semester)
        const course = courses.find(course => course.id === entry?.courseId)
        if (!course) return ''
        if (course.courseType === '特殊需求領域課程' || ['抽離', '外加'].includes(placement(course))) shade.add(`${row}:${column + 1}`)
        return [course.courseName, course.teacher, placement(course)].filter(Boolean).join('\n')
      })])
      await f.table(['節次', ...days], [52, 93.6, 93.6, 93.6, 93.6, 93.6], rows, { minHeight: 40, center: [0, 1, 2, 3, 4, 5], shade })
    }
  } else await pdf.page(11, '貳、五、學生每週課表')
  await pdf.page(12, '學生教育需求評估項目說明（參考）')
}
