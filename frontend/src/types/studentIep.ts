import type { StudentFamilyFormValue } from '../components/iep/StudentFamilyForm'

export interface IepContent {
  studentFamilyForm: StudentFamilyFormValue
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
