import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { referenceOptions } from '../../schemas/referenceForms.js'
import { PdfPainter } from './layout.js'
import { date, lines } from './format.js'

export function drawSupportReference(p: PdfPainter, input: IepPdfRequest) {
  const ref = input.content.specialEducationSupport?.referenceDetails
  if (!ref) return
  if (ref.curriculumNeed === '無需求') p.check(51.98, 276.16)
  if (ref.supportNeed === '無需求') { p.check(51.98, 451.5); return }
  const parents: Record<string, string> = { aids: '教育及運動輔具', materials: '適性教材', assistance: '學習及生活人力協助', personnel: '學習及生活人力協助', rehabilitation: '復健', family: '家庭支持', physicalEducation: '適應體育', accessibility: '校園無障礙環境', other: '其他支持' }
  for (const config of referenceOptions.supportGroups) {
    const group = ref.groups[config.id]
    if (!group || group.status === '無需求') continue
    if (group.status === '有需求' || group.selected.length) p.choices([parents[config.id]], [72, config.top - 1, 134, config.bottom - config.top])
    p.choiceNotes(group.selected, [206, config.top - 1, 350, config.bottom - config.top], group.notes, config.title)
    p.supplement(config.title + '補充說明', group.description)
  }
}

export function drawInclusiveReference(p: PdfPainter, input: IepPdfRequest) {
  const rows = input.content.inclusiveEducationPlan?.referenceRows
  if (!rows) return
  for (const config of referenceOptions.inclusiveGroups) {
    const active = rows.filter(row => row.selected && config.options.includes(row.item))
    p.choices(active.map(row => row.item), [94, config.top - 1, 111, config.bottom - config.top])
    const join = (key: 'execution' | 'responsible') => active.map(row => row[key] ? `${row.item}：${row[key]}` : '').filter(Boolean).join('\n')
    p.field([208, config.top + 1, 124, config.bottom - config.top - 3], join('execution'), config.title + '：執行方式', { size: 9, min: 8 })
    p.field([336, config.top + 1, 87, config.bottom - config.top - 3], active.map(row => lines([['項目', row.item], ['期程', [date(row.startDate), date(row.endDate)].filter(Boolean).join('～')], ['頻率', row.frequency]])).join('\n'), config.title + '：起訖時間及頻率', { size: 8.5, min: 8 })
    p.field([427, config.top + 1, 128, config.bottom - config.top - 3], join('responsible'), config.title + '：負責單位／人', { size: 9, min: 8 })
  }
}

export function drawCoursePlan(p: PdfPainter, input: IepPdfRequest) {
  const courses = input.content.coursePlanItems ?? []
  p.field([465, 36, 40, 17], courses.length ? courses.reduce((sum, course) => sum + course.weeklyPeriods, 0) : '', '每週總節數')
  const groups = new Map<string, typeof courses>()
  for (const course of courses) {
    const name = course.courseName
    const fallback = /國語|英語|語文/.test(name) ? '部定：語文' : /數學/.test(name) ? '部定：數學' : /生活/.test(name) && course.courseType === '普通教育課程' ? '部定：生活' : /社會/.test(name) && course.courseType === '普通教育課程' ? '部定：社會' : /自然/.test(name) ? '部定：自然科學' : /藝術/.test(name) ? '部定：藝術' : /綜合/.test(name) ? '部定：綜合活動' : /科技/.test(name) ? '部定：科技' : /健康|體育/.test(name) ? '部定：健康與體育' : course.courseType === '特殊需求領域課程' ? '校訂彈性：特殊需求領域課程' : '校訂彈性：其他類課程'
    const category = course.referenceCategory || fallback
    groups.set(category, [...groups.get(category) ?? [], course])
    p.supplement(`課程：${name}`, lines([['原表分類', category], ['類型', course.courseType === '其他' ? course.otherCourseType : course.courseType], ['教學方式', course.teachingMethod === '其他' ? course.otherTeachingMethod : course.teachingMethod], ['排課方式', course.placement ?? ({ 原班上課: '原班', 抽離式: '抽離', 外加式: '外加' } as Record<string, string>)[course.teachingMethod]], ['每週節數', course.weeklyPeriods], ['開始日期', date(course.startDate)], ['結束日期', date(course.endDate)], ['授課教師', course.teacher], ['授課地點', course.location === '其他' ? course.otherLocation : course.location], ['備註', course.notes]]))
  }
  for (const [category, items] of groups) {
    const row = referenceOptions.courseCategories.find(row => row.name === category)!
    const top = row.top, height = row.height - 2
    p.field([92, top, 62, height], items.map(course => course.courseName).join('、'), category + '：課程名稱', { size: 8.5, min: 7.5 })
    for (const [x, placement] of [[158, '原班'], [214, '抽離'], [271, '外加']] as const) {
      const matching = items.filter(course => (course.placement ?? ({ 原班上課: '原班', 抽離式: '抽離', 外加式: '外加' } as Record<string, string>)[course.teachingMethod]) === placement)
      if (matching.length) p.field([x, top, 53, height], matching.reduce((sum, course) => sum + course.weeklyPeriods, 0), category + placement + '節數', { size: 9, min: 8 })
    }
    p.field([328, top, 60, height], items.map(course => [date(course.startDate), date(course.endDate)].filter(Boolean).join('～')).filter(Boolean).join('\n'), category + '：起迄日期', { size: 8, min: 7 })
    p.field([392, top, 60, height], [...new Set(items.map(course => course.location === '其他' ? course.otherLocation : course.location))].join('、'), category + '：上課地點', { size: 8.5, min: 7.5 })
    p.field([455, top, 54, height], [...new Set(items.map(course => course.teacher))].join('、'), category + '：授課教師', { size: 8.5, min: 7.5 })
  }
}
