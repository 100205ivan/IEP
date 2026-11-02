export interface IepPdfOptions {
  schoolName: string
  caseManager: string
  caseManagerTitle: string
  studentStatus: '' | '新生' | '轉學生' | '舊生'
  draftedDate: string
  committeeApprovalDate: string
  curriculumApprovalDate: string
  newStudentReviewDate: string
  firstReviewDate: string
  secondReviewDate: string
  weeklyScheduleSemester: '第一學期' | '第二學期'
}

export const initialIepPdfOptions: IepPdfOptions = { schoolName: '', caseManager: '', caseManagerTitle: '', studentStatus: '', draftedDate: '', committeeApprovalDate: '', curriculumApprovalDate: '', newStudentReviewDate: '', firstReviewDate: '', secondReviewDate: '', weeklyScheduleSemester: '第一學期' }

export function normalizeIepPdfOptions(value: unknown): IepPdfOptions {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const result = { ...initialIepPdfOptions }
  for (const key of ['schoolName', 'caseManager', 'caseManagerTitle', 'draftedDate', 'committeeApprovalDate', 'curriculumApprovalDate', 'newStudentReviewDate', 'firstReviewDate', 'secondReviewDate'] as const) {
    if (typeof source[key] === 'string') result[key] = source[key]
  }
  if (source.studentStatus === '' || source.studentStatus === '新生' || source.studentStatus === '轉學生' || source.studentStatus === '舊生') result.studentStatus = source.studentStatus
  if (source.weeklyScheduleSemester === '第一學期' || source.weeklyScheduleSemester === '第二學期') result.weeklyScheduleSemester = source.weeklyScheduleSemester
  return result
}
