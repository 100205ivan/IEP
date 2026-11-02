import type { IepPdfRequest } from '../schemas/iepPdfExport.js'
import { IepPdfDocument } from './iepPdf/layout.js'
import { drawFamily } from './iepPdf/family.js'
import { drawAssessments, type PdfAssessment } from './iepPdf/assessment.js'
import { drawServices } from './iepPdf/services.js'
import { drawGoals } from './iepPdf/goals.js'
import { drawBehavior } from './iepPdf/behavior.js'
import { drawTransition } from './iepPdf/transition.js'
import { drawMeetings } from './iepPdf/meetings.js'
import type { IepAttachment } from './iepAttachmentService.js'

/** Pure document rendering: exporting never changes saved IEPs or assessment records. */
export async function generateIepPdf(input: IepPdfRequest, assessments: PdfAssessment[] = [], attachments: IepAttachment[] = []) {
  const pdf = await IepPdfDocument.create()
  const student = await drawFamily(pdf, input)
  await drawAssessments(pdf, input, assessments, attachments)
  await drawServices(pdf, input)
  await drawGoals(pdf, input)
  await drawBehavior(pdf, input)
  await drawTransition(pdf, input)
  await drawMeetings(pdf, input, student)
  return { ...await pdf.finish(student.studentName, input.academicYear), fileName: `${student.studentName}_${input.academicYear}學年度_IEP.pdf` }
}
