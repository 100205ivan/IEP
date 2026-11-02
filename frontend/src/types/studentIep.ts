import type { StudentFamilyFormValue } from '../components/iep/StudentFamilyForm'
import type { SpecialEducationSupportValue } from '../components/iep/SpecialEducationSupport'
import type { InclusiveEducationPlanValue } from '../components/iep/InclusiveEducationPlan'
import type { CurriculumAdjustmentValue } from '../components/iep/CurriculumAdjustment'
import type { CoursePlanItem } from '../components/iep/StudentCoursePlan'
import type { WeeklyScheduleEntry } from '../components/iep/StudentWeeklySchedule'
import type { GoalDomain, SemesterGoal } from '../components/iep/GoalsChapter'

export interface IepContent {
  studentFamilyForm: StudentFamilyFormValue
  specialEducationSupport?: SpecialEducationSupportValue
  inclusiveEducationPlan?: InclusiveEducationPlanValue
  curriculumAdjustment?: CurriculumAdjustmentValue
  coursePlanItems?: CoursePlanItem[]
  weeklySchedule?: WeeklyScheduleEntry[]
  goalDomains?: GoalDomain[]
  semesterGoals?: SemesterGoal[]
  learningNotes?: string
  basicInfoReviewNotice?: {
    inheritedFromAcademicYear: number
    requiresReview: true
    message: string
  }
  [key: string]: unknown
}

export interface StudentSummary {
  id: string
  name: string
  gender: string
  birthDate: string | null
  nationalId: string | null
  studentNumber: string
  createdAt: string
  updatedAt: string
  ieps: Array<{ id: string; academicYear: number }>
}

export interface StudentProfile {
  id: string
  name: string
  gender: string
  birthDate: string | null
  nationalId: string | null
  studentNumber: string
  createdAt: string
  updatedAt: string
}

export interface IepRecord {
  id: string
  studentId: string
  academicYear: number
  content: IepContent
  createdAt: string
  updatedAt: string
}
