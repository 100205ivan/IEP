import type { AdjustmentKind, CurriculumAdjustmentValue } from '../components/iep/CurriculumAdjustment'
import type { CoursePlanItem } from '../components/iep/StudentCoursePlan'
import type { WeeklyScheduleEntry } from '../components/iep/StudentWeeklySchedule'
import { weekdays, periods, type Weekday, type PeriodId } from '../components/iep/weeklyScheduleConstants'

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function choices(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [] }

export function normalizeCurriculumAdjustment(value: unknown): CurriculumAdjustmentValue {
  const adjustment = record(value)
  const groups = (['environment', 'content', 'process', 'assessment'] as const).map((kind: AdjustmentKind) => {
    const group = record(adjustment[kind])
    return [kind, { ...group, selectedStrategies: choices(group.selectedStrategies), otherStrategy: text(group.otherStrategy), applicableSubjects: choices(group.applicableSubjects), otherSubject: text(group.otherSubject), description: text(group.description) }]
  })
  return { ...adjustment, ...Object.fromEntries(groups) } as CurriculumAdjustmentValue
}

export function normalizeCoursePlanItems(value: unknown): CoursePlanItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item)).map(item => {
    const course = record(item)
    const count = typeof course.weeklyPeriods === 'number' || typeof course.weeklyPeriods === 'string' ? Number(course.weeklyPeriods) : 0
    return {
      ...course,
      id: text(course.id), courseName: text(course.courseName), courseType: text(course.courseType), otherCourseType: text(course.otherCourseType),
      teachingMethod: text(course.teachingMethod), otherTeachingMethod: text(course.otherTeachingMethod), teacher: text(course.teacher),
      location: text(course.location), otherLocation: text(course.otherLocation), weeklyPeriods: Number.isFinite(count) && count >= 0 ? count : 0, notes: text(course.notes),
    }
  })
}

export function normalizeWeeklySchedule(value: unknown, courses: CoursePlanItem[]): WeeklyScheduleEntry[] {
  if (!Array.isArray(value)) return []
  const courseIds = new Set(courses.map(course => course.id))
  const slots = new Set<string>()
  return value.flatMap(value => {
    const entry = record(value)
    if (!weekdays.includes(entry.day as Weekday) || !periods.includes(entry.period as PeriodId) || !courseIds.has(text(entry.courseId))) return []
    const slot = `${entry.day}/${entry.period}`
    if (slots.has(slot)) return []
    slots.add(slot)
    return [{ ...entry, day: entry.day as Weekday, period: entry.period as PeriodId, courseId: text(entry.courseId) }]
  })
}
