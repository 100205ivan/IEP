import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIepWordModel } from '../services/iepWordModel.js'
import { generateIepWord } from '../services/iepWordExport.js'
import { iepPdfExportSchema } from '../schemas/iepPdfExport.js'

test('Word mappings retain full long text and do not change the saved input', async () => {
  const long = '長文字起點' + '完整保留在原本欄位並自動分頁。'.repeat(120) + '長文字終點'
  const input = iepPdfExportSchema.parse({ academicYear: 115, content: {
    studentFamilyForm: { values: { studentName: '測試學生', registeredAddress: long, specialDisease: 'none', diseaseDescription: '隱藏病史' }, checks: {}, medications: [] },
    assessmentDetails: { 'sensory-needsAssessment': long },
    strengthWeaknessSummary: { overallNeeds: long },
    inclusiveEducationPlan: { referenceRows: [
      { item: '行政支持', selected: true, execution: '行政執行方式' },
      { item: '同儕協助', selected: true, execution: '同儕執行方式' },
    ] },
  } })
  const before = JSON.stringify(input), model = await buildIepWordModel(input)
  assert.equal(JSON.stringify(input), before)
  assert.ok(model.pages.find(p => p.source === 2)?.fields.some(f => f.value === long))
  assert.ok(model.pages.find(p => p.source === 4)?.fields.some(f => f.value === long))
  assert.ok(model.pages.find(p => p.source === 7)?.notes.some(n => n.text === long))
  assert.ok(!JSON.stringify(model).includes('隱藏病史'))
  assert.equal(model.pages.length, 20)
  const coverHeading = model.pages.find(p => p.source === 1)?.fields.find(f => f.label === '學校與學年度')
  assert.equal(coverHeading?.style?.size, 16, 'retain the reference heading font size')
  assert.equal(coverHeading?.style?.align, 'center', 'retain the reference heading alignment')
  const inclusive = model.pages.find(p => p.source === 9)!
  const administrative = inclusive.fields.find(f => f.value === '行政執行方式')!
  const peer = inclusive.fields.find(f => f.value === '同儕執行方式')!
  assert.ok(administrative.box[1] >= 128 && administrative.box[1] < 146, 'administrative text belongs in its selected row')
  assert.ok(peer.box[1] >= 239 && peer.box[1] < 258, 'peer text belongs in its selected row')
  assert.equal(model.pages.find(p => p.source === 15)?.checks.length, 0, 'blank status must never tick every option')
})

test('Word export creates a real editable OOXML document', async () => {
  const input = iepPdfExportSchema.parse({ academicYear: 115, content: { studentFamilyForm: { values: { studentName: '測試學生' }, checks: {}, medications: [] } } })
  const output = await generateIepWord(input)
  assert.equal(output.bytes.subarray(0, 2).toString(), 'PK')
  assert.equal(output.fileName, '測試學生_115學年度_IEP.docx')
  assert.equal(output.formCount, 20)
  assert.ok(output.bytes.length > 30_000)
})
