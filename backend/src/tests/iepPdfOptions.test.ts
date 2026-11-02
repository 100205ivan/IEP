import assert from 'node:assert/strict'
import { test } from 'node:test'
import { iepPdfOptionsSchema } from '../schemas/iepPdfOptions.js'
import { createAnnualIepSchema, createStudentIepSchema, updateIepSchema } from '../schemas/studentIep.js'
import { remainingIepContent } from '../db/iepChapterTables.js'
import { iepPdfExportSchema } from '../schemas/iepPdfExport.js'

const options = { schoolName: '測試國民小學', caseManager: '測試個管教師', caseManagerTitle: '特教教師', studentStatus: '轉學生', draftedDate: '2026-08-31', committeeApprovalDate: '2026-09-01', curriculumApprovalDate: '2026-09-02', newStudentReviewDate: '2026-09-15', firstReviewDate: '2027-01-15', secondReviewDate: '2027-06-15', weeklyScheduleSemester: '第二學期' }
const content = { pdfExportOptions: options, studentFamilyForm: { values: { studentName: '王曉明' } }, learningNotes: '其他章節維持原值' }
const parseContent = (value: Record<string, unknown>) => [
  createStudentIepSchema.parse({ student: { name: '王曉明' }, academicYear: 115, content: value }).content,
  createAnnualIepSchema.parse({ academicYear: 115, content: value }).content,
  updateIepSchema.parse({ content: value }).content,
]

test('all cover options survive every IEP write entry point and remain on the parent', () => {
  for (const saved of parseContent(content)) {
    assert.deepEqual(saved, content)
    assert.deepEqual(remainingIepContent(saved), { pdfExportOptions: options })
    assert.deepEqual(JSON.parse(JSON.stringify(saved)).pdfExportOptions, options)
  }
})

test('stored cover enums, field lengths and dates are validated before persistence', () => {
  for (const invalid of [{ studentStatus: '畢業生' }, { weeklyScheduleSemester: '第三學期' }, { draftedDate: '2026-02-30' }, { firstReviewDate: 123 }, { schoolName: '字'.repeat(201) }]) {
    assert.throws(() => parseContent({ pdfExportOptions: invalid }))
  }
  for (const status of ['', '新生', '轉學生', '舊生']) assert.equal(iepPdfOptionsSchema.parse({ studentStatus: status }).studentStatus, status)
})

test('old IEPs keep settings absent, partial settings get defaults, and cleared values remain cleared', () => {
  for (const saved of parseContent({ learningNotes: '' })) assert.equal(saved.pdfExportOptions, undefined)
  for (const saved of parseContent({ pdfExportOptions: { schoolName: '測試學校' } })) {
    assert.equal(saved.pdfExportOptions?.schoolName, '測試學校')
    assert.equal(saved.pdfExportOptions?.studentStatus, '')
    assert.equal(saved.pdfExportOptions?.weeklyScheduleSemester, '第一學期')
  }
  for (const saved of parseContent({ pdfExportOptions: {} })) assert.deepEqual(saved.pdfExportOptions, iepPdfOptionsSchema.parse({}))
})

test('export uses saved options by default and respects an explicit preview override', () => {
  assert.deepEqual(iepPdfExportSchema.parse({ academicYear: 115, content }).options, options)
  const overridden = iepPdfExportSchema.parse({ academicYear: 115, content, options: { studentStatus: '新生' } })
  assert.equal(overridden.options.studentStatus, '新生')
  assert.equal(overridden.content.pdfExportOptions?.studentStatus, '轉學生')
  assert.equal(iepPdfExportSchema.parse({ academicYear: 115, content, options: {} }).options.schoolName, '')
})

test('frontend hydrates saved settings and resets missing/invalid settings for another IEP', async () => {
  const moduleUrl = new URL('../../../frontend/src/models/iepPdfOptions.ts', import.meta.url).href
  const { normalizeIepPdfOptions, initialIepPdfOptions } = await import(moduleUrl)
  assert.deepEqual(normalizeIepPdfOptions(options), options)
  for (const value of [undefined, null, [], false, 1]) assert.deepEqual(normalizeIepPdfOptions(value), initialIepPdfOptions)
  assert.deepEqual(normalizeIepPdfOptions({ studentStatus: 'invalid', weeklyScheduleSemester: 'invalid', schoolName: false }), initialIepPdfOptions)
  const first = normalizeIepPdfOptions(options), second = normalizeIepPdfOptions(undefined)
  second.schoolName = '另外一份的學校'
  assert.equal(first.schoolName, options.schoolName)
  assert.equal(initialIepPdfOptions.schoolName, '')
})
