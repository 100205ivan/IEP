import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { iepPdfExportSchema } from '../schemas/iepPdfExport.js'
import { generateIepPdf } from '../services/iepPdfExport.js'
import { PdfExportError } from '../services/iepPdf/layout.js'

// Read actual embedded Unicode text, rather than checking renderer calls or mocks.
async function exportedText(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes)
  let result = ''
  const decode = (stream: PDFRawStream) => new TextDecoder().decode(decodePDFRawStream(stream).decode())
  for (const page of pdf.getPages()) {
    const fonts = page.node.Resources()?.lookup(PDFName.of('Font'), PDFDict)
    const maps = new Map<string, Map<string, string>>()
    for (const [name, ref] of fonts?.entries() ?? []) {
      const font = pdf.context.lookup(ref, PDFDict), unicode = font.lookup(PDFName.of('ToUnicode'))
      if (!(unicode instanceof PDFRawStream)) continue
      const map = new Map<string, string>()
      for (const match of decode(unicode).matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) {
        const chars = match[2].match(/.{4}/g)?.map(code => parseInt(code, 16)) ?? []
        map.set(match[1].toUpperCase(), String.fromCharCode(...chars))
      }
      maps.set(name.decodeText(), map)
    }
    const contents = page.node.Contents(), streams = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : []
    let selected = ''
    for (const ref of streams) {
      const stream = pdf.context.lookup(ref)
      if (!(stream instanceof PDFRawStream)) continue
      for (const token of decode(stream).matchAll(/\/([\w-]+)\s+[\d.]+\s+Tf|<([0-9a-f]+)>\s*Tj/gi)) {
        if (token[1]) selected = token[1]
        else result += token[2].match(/.{4}/g)?.map(code => maps.get(selected)?.get(code.toUpperCase()) ?? '').join('') || ''
      }
    }
    result += '\n'
  }
  return { pdf, text: result }
}
const request = (content: Record<string, unknown> = {}, options = {}) => iepPdfExportSchema.parse({ academicYear: 115, content: { studentFamilyForm: { values: { studentName: '王曉明' }, checks: {}, medications: [] }, ...content }, options })

test('blank IEP keeps all 20 A4 source pages with an embedded student name', async () => {
  const output = await generateIepPdf(request())
  const { pdf, text } = await exportedText(output.bytes)
  assert.equal(output.pageCount, 20)
  assert.equal(output.supplementPageCount, 0)
  assert.equal(pdf.getTitle(), '王曉明 115 學年度個別化教育計畫')
  assert.ok(text.includes('王曉明'))
  for (const page of pdf.getPages()) { assert.ok(Math.abs(page.getWidth() - 595.32) < 1); assert.ok(Math.abs(page.getHeight() - 841.92) < 1) }
})

test('long multiline text survives across section continuations without truncation', async () => {
  const value = '起點' + '完整內容測試。'.repeat(1800) + '\n終點保留'
  const output = await generateIepPdf(request({ strengthWeaknessSummary: { overallNeeds: value } }))
  const { text } = await exportedText(output.bytes)
  assert.ok(output.supplementPageCount >= 3)
  assert.ok(text.includes('起點'))
  assert.ok(text.includes('終點保留'))
  // Individual characters remain countable even when a phrase spans a page boundary.
  assert.equal((text.match(/測/g) ?? []).length, 1800)
})

test('extra assessment records and their evaluators are retained', async () => {
  const records = Array.from({ length: 9 }, (_, i) => ({ assessmentDate: '2026-11-02', assessmentType: '觀察', assessmentTool: `工具${i}`, evaluator: `評量人${i}`, summary: `摘要第${i}筆`, detail: `參考內容${i}` }))
  const output = await generateIepPdf(request(), records)
  const { text } = await exportedText(output.bytes)
  for (let i = 0; i < 9; i++) { assert.ok(text.includes(`摘要第${i}筆`)); assert.ok(text.includes(`評量人${i}`)); assert.ok(text.includes(`參考內容${i}`)) }
  assert.ok(output.pageCount > 20)
})

test('both semesters, extra goal rows, annual links and fourth evaluations survive', async () => {
  const domain = { id: 'domain', domainName: '語文測試領域', annualGoals: [{ id: 'annual', content: '學年目標保留' }] }
  const goals = Array.from({ length: 12 }, (_, i) => ({ id: `goal${i}`, domainId: 'domain', annualGoalId: 'annual', semester: i === 11 ? '第二學期' : '第一學期', content: `學期目標第${i}筆`, evaluationRecords: Array.from({ length: 4 }, (_, n) => ({ id: `${i}-${n}`, date: '2026-11-02', result: `結果${i}之${n}`, notes: `備註${i}之${n}` })) }))
  const output = await generateIepPdf(request({ goalDomains: [domain], semesterGoals: goals }))
  const { text } = await exportedText(output.bytes)
  assert.ok(text.includes('學年目標保留'))
  assert.ok(text.includes('第二學期目標'))
  for (let i = 0; i < 12; i++) { assert.ok(text.includes(`學期目標第${i}筆`)); assert.ok(text.includes(`結果${i}之3`)); assert.ok(text.includes(`備註${i}之3`)) }
})

test('inactive clinical branches, unselected professional drafts and motions stay private', async () => {
  const input = request({
    studentFamilyForm: { values: { studentName: '王曉明', specialDisease: 'none', diseaseDescription: 'HIDDEN_DISEASE', regularMedication: 'none' }, checks: {}, medications: [{ name: 'HIDDEN_MEDICINE' }] },
    behaviorIntervention: { needStatus: '暫無需求', interventionGoal: 'HIDDEN_BEHAVIOR' },
    transitionSupport: { noTransitionNeed: true, generalServiceContent: 'HIDDEN_TRANSITION', followUp: { enabled: true, records: [] } },
    specialEducationSupport: { professional: [], professionalDetails: { 語言治療: { notes: 'HIDDEN_PROFESSIONAL' } } },
    meetingRecords: [{ id: 'meeting', date: '2026-11-02', location: '測試會議室', hasMotions: false, motions: [{ id: 'motion', content: 'HIDDEN_MOTION' }], discussionTopics: [{ id: 'topic', type: '特殊教育需求', enabled: false, summary: 'HIDDEN_TOPIC' }] }],
  })
  const before = JSON.stringify(input)
  const { text } = await exportedText((await generateIepPdf(input)).bytes)
  assert.equal(JSON.stringify(input), before)
  assert.ok(!text.includes('HIDDEN_'))
  assert.ok(text.includes('無臨時動議'))
})

test('all meetings, enabled topics and participants are included without fabricated signatures', async () => {
  const meetingRecords = Array.from({ length: 3 }, (_, i) => ({ id: `meeting${i}`, date: '2026-11-02', location: `測試地點${i}`, participants: [{ id: `person${i}`, name: `與會者${i}`, role: 'other', title: '測試角色', attended: false }], discussionTopics: [{ id: `topic${i}`, type: '其他', otherName: `議題${i}`, enabled: true, summary: `討論摘要${i}` }], hasMotions: true, motions: [{ id: `motion${i}`, content: `臨時動議${i}` }] }))
  const { text } = await exportedText((await generateIepPdf(request({ meetingRecords }))).bytes)
  for (let i = 0; i < 3; i++) { assert.ok(text.includes(`與會者${i}`)); assert.ok(text.includes(`討論摘要${i}`)); assert.ok(text.includes(`臨時動議${i}`)) }
})

test('invalid export settings and orphaned timetable entries are rejected', () => {
  assert.throws(() => request({}, { draftedDate: '2026-02-30' }))
  assert.throws(() => request({}, { weeklyScheduleSemester: '第三學期' }))
  assert.throws(() => request({ weeklySchedule: [{ day: '星期一', period: '第一節', courseId: 'missing' }] }))
})

test('unsupported characters produce a readable error instead of broken glyphs', async () => {
  await assert.rejects(generateIepPdf(request({ learningNotes: '不支援字元測試😀' })), PdfExportError)
})

test('active service, curriculum, behavior and transition fields reach the PDF', async () => {
  const input = request({
    specialEducationSupport: { specialEducation: ['其他'], specialOther: '服務型態保留', specialNotes: '特殊服務說明保留', professional: ['語言治療'], professionalDetails: { 語言治療: { provider: '專業人員保留', notes: '專業說明保留' } }, familyNotes: '家庭支持說明保留', staffHours: '4.5' },
    inclusiveEducationPlan: { participation: '其他方式', otherParticipationNotes: '參與方式保留', activityNotes: '融合活動說明保留', strategyNotes: '融合支持說明保留' },
    curriculumAdjustment: { content: { applicableSubjects: ['國語'], description: '教材調整說明保留' } },
    coursePlanItems: [{ id: 'course', courseName: '測試課程保留', courseType: '普通教育課程', teachingMethod: '個別教學', teacher: '測試教師保留', weeklyPeriods: 2, notes: '課程備註保留' }],
    weeklySchedule: [{ day: '星期五', period: '第七節', courseId: 'course' }],
    behaviorIntervention: { needStatus: '有需求', interventionGoal: '介入目標保留', behaviorFunctions: { selected: ['獲得內在刺激'], notes: { 獲得內在刺激: '行為功能說明保留' } }, antecedentStrategies: { notes: '前事策略說明保留' }, outcomeEvaluation: { notes: '介入成效說明保留' } },
    transitionSupport: { transitionFocus: { selected: ['其他'], other: '轉銜重點保留' }, generalServiceContent: '轉銜服務說明保留', services: { education: { needStatus: '有需求', needsDescription: '轉銜需求說明保留', progress: '轉銜進度保留' } }, followUp: { enabled: true, records: Array.from({ length: 3 }, (_, i) => ({ id: `follow${i}`, summary: `追蹤摘要第${i}筆`, serviceDisposition: '須轉介', dispositionDetails: `轉介說明第${i}筆` })) } },
  })
  const { text } = await exportedText((await generateIepPdf(input)).bytes)
  for (const value of ['服務型態保留', '特殊服務說明保留', '專業人員保留', '專業說明保留', '家庭支持說明保留', '參與方式保留', '融合活動說明保留', '融合支持說明保留', '教材調整說明保留', '課程備註保留', '介入目標保留', '行為功能說明保留', '前事策略說明保留', '介入成效說明保留', '轉銜重點保留', '轉銜需求說明保留', '轉銜進度保留', '追蹤摘要第2筆', '轉介說明第2筆']) assert.ok(text.includes(value), value)
})
