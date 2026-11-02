import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { iepPdfExportSchema } from '../schemas/iepPdfExport.js'
import { generateIepPdf } from '../services/iepPdfExport.js'
import { IepPdfDocument, PdfExportError } from '../services/iepPdf/layout.js'

test('reference extensions reach the PDF: team names, item notes, subskills, execution and both semester eighth periods', async () => {
  const course = { id: 'extra-course', courseName: '測試溝通課', courseType: '特殊需求領域課程', teachingMethod: '個別教學', placement: '外加', referenceCategory: '高中：彈性學習時間', weeklyPeriods: 1, startDate: '2026-09-01', endDate: '2027-01-20' }
  const input = request({
    specialEducationSupport: { referenceDetails: { supportNeed: '有需求', groups: { aids: { status: '有需求', selected: ['溝通輔具'], notes: { 溝通輔具: '測試平板輔具' } } } } },
    assessmentSelections: { 'sensory-hearing-classImpact': ['有影響'] }, assessmentDetails: { 'sensory-hearing-classImpactDescription': '測試聽覺影響' },
    inclusiveEducationPlan: { referenceRows: [{ item: '班級性融合', selected: true, execution: '測試合作閱讀', frequency: '每週', responsible: '測試負責人' }] },
    curriculumAdjustment: { subjectDetails: { 國語: { teacher: '測試授課者', content: '無須調整', process: '須調整' } } },
    coursePlanItems: [course], weeklySchedule: ['第一學期', '第二學期'].map(semester => ({ semester, day: '星期二', period: '第八節', courseId: course.id })),
    behaviorIntervention: { needStatus: '有需求', planStatus: '建立新的行為功能介入方案', behaviorFunctions: { selected: ['獲得他人注意'], notes: { 獲得他人注意: '測試注意功能' } }, executionDetails: { antecedent: { executionMethod: '測試每日執行', implementers: '測試執行者', progress: '測試執行進度' } } },
    transitionSupport: { crossStagePlan: { enabled: true, educationStage: '國中', juniorHighPlan: { employment: { caregiver: { selected: ['職場'] }, student: { selected: ['在家'] } } }, employmentDetails: { 國中: { caregiverWorkplace: '測試圖書館', studentHome: '測試居家安排' } } } },
  }, { teamMembers: [{ id: 'teacher', role: '班級導師', name: '測試團隊老師', title: '' }] })
  const { text, pdf } = await exportedText((await generateIepPdf(input)).bytes)
  for (const marker of ['測試團隊老師', '測試平板輔具', '測試聽覺影響', '測試合作閱讀', '測試負責人', '測試授課者', '測試注意功能', '測試每日執行', '測試執行者', '測試執行進度', '測試圖書館', '測試居家安排']) assert.ok(text.includes(marker), marker)
  assert.ok((text.match(/測試溝通課/g) ?? []).length >= 4, 'course plan, detail and both timetable semesters')
  assert.ok(pdf.getPageCount() >= 20)
})

test('certificate images are embedded into the original front/back attachment page', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64')
  const output = await generateIepPdf(request(), [], ['certificate-front', 'certificate-back'].map(kind => ({ kind: kind as 'certificate-front' | 'certificate-back', mimeType: 'image/png', fileName: 'test.png', bytes: png, updatedAt: '' })))
  const pdf = await PDFDocument.load(output.bytes)
  const objects = pdf.getPage(2).node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
  const images = objects?.entries().map(([, ref]) => pdf.context.lookup(ref)).filter(object => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') ?? []
  assert.equal(images.length, 2)
  assert.equal(output.pageCount, 20)
})

test('inactive new support groups and execution/transition drafts never leak into the PDF', async () => {
  const hidden = '隱藏草稿不應匯出'
  const output = await generateIepPdf(request({
    specialEducationSupport: { referenceDetails: { groups: { aids: { status: '無需求', selected: ['溝通輔具'], notes: { 溝通輔具: hidden }, description: hidden } } } },
    behaviorIntervention: { needStatus: '暫無需求', executionDetails: { antecedent: { executionMethod: hidden, progress: hidden } } },
    transitionSupport: { noTransitionNeed: true, crossStagePlan: { enabled: true, employmentDetails: { 國中: { caregiverWorkplace: hidden } } } },
  }))
  assert.ok(!(await exportedText(output.bytes)).text.includes(hidden))
})

// Read actual embedded Unicode text, rather than checking renderer calls or mocks.
async function exportedText(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes)
  let result = ''
  const runs: { page: number; text: string; size: number; x: number; top: number; font: string }[] = []
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
    let selected = '', size = 0, x = 0, y = 0
    for (const ref of streams) {
      const stream = pdf.context.lookup(ref)
      if (!(stream instanceof PDFRawStream)) continue
      for (const token of decode(stream).matchAll(/\/([\w-]+)\s+([\d.]+)\s+Tf|1 0 0 1 ([-\d.]+) ([-\d.]+) Tm|<([0-9a-f]+)>\s*Tj/gi)) {
        if (token[1]) { selected = token[1]; size = Number(token[2]) }
        else if (token[3]) { x = Number(token[3]); y = Number(token[4]) }
        else {
          const value = token[5].match(/.{4}/g)?.map(code => maps.get(selected)?.get(code.toUpperCase()) ?? '').join('') || ''
          result += value
          runs.push({ page: pdf.getPages().indexOf(page), text: value, size, x, top: page.getHeight() - y, font: selected })
        }
      }
    }
    result += '\n'
  }
  const body = runs.filter(run => run.font.startsWith('DFKaiShu') && run.top < 765 && run.text.trim())
  assert.ok(body.every(run => run.size >= 11), 'all generated form content remains at least 11pt')
  assert.ok(!result.includes('詳續頁') && !result.includes('詳本節續頁'), 'no placeholder-only overflow cells remain')
  assert.ok(body.every(run => run.top > 20 && run.top < 765 && run.x >= 32 && run.x < 557), 'form text starts inside the printable area')
  return { pdf, text: result, runs }
}
const request = (content: Record<string, unknown> = {}, options = {}) => iepPdfExportSchema.parse({ academicYear: 115, content: { studentFamilyForm: { values: { studentName: '王曉明' }, checks: {}, medications: [] }, ...content }, options })

test('cover team names remain readable and centered while signature cells stay empty', async () => {
  const input = request({}, { teamMembers: [
    { id: 'homeroom', role: '班級導師', name: '測試導師' },
    { id: 'special', role: '特教教師', name: '測試特教老師' },
    { id: 'therapist', role: '物理治療師', name: '陳測試治療師' },
    { id: 'parent', role: '法定代理人', name: '王家長' },
    { id: 'student', role: '學生本人', name: '王曉明' },
  ] })
  const { runs, text } = await exportedText((await generateIepPdf(input)).bytes)
  const cells = runs.filter(run => run.page === 0 && run.top > 474 && run.top < 692 && run.font.startsWith('DFKaiShu'))
  for (const member of input.options.teamMembers!) assert.ok(text.includes(member.name), member.name)
  for (const run of cells) {
    assert.equal(run.size, 11)
    assert.ok(run.x >= 150 && run.x + run.text.length * 11 <= 197 || run.x >= 399 && run.x + run.text.length * 11 <= 459, 'name preview stays in the original source name column')
  }
  assert.ok(!cells.some(run => run.x >= 197 && run.x < 278 || run.x >= 459 && run.x < 534), 'source signature cells remain blank')
})

test('long or multiple team names keep full details without reducing the cover font', async () => {
  const names = ['王曉明', '陳小華', '這是一個超過姓名欄寬度的測試姓名']
  const { text, runs } = await exportedText((await generateIepPdf(request({}, { teamMembers: names.map((name, i) => ({ id: String(i), role: '特教教師', name })) }))).bytes)
  for (const name of names) assert.ok(text.includes(name))
  const preview = runs.find(run => run.page === 0 && run.text.startsWith('王') && run.text.endsWith('…'))
  assert.ok(preview, 'the cover shows a meaningful name preview')
  assert.equal(preview.size, 11)
  assert.ok(!text.includes('詳續頁'), 'complete names continue without a placeholder-only cell')
})

test('blank IEP keeps all 20 A4 source pages with an embedded student name', async () => {
  const output = await generateIepPdf(request())
  const { pdf, text } = await exportedText(output.bytes)
  assert.equal(output.pageCount, 20)
  assert.equal(output.supplementPageCount, 0)
  assert.equal(pdf.getTitle(), '王曉明 115 學年度個別化教育計畫')
  assert.ok(text.includes('王曉明'))
  for (const page of pdf.getPages()) { assert.ok(Math.abs(page.getWidth() - 595.32) < 1); assert.ok(Math.abs(page.getHeight() - 841.92) < 1) }
})

test('each student status ticks exactly its own source checkbox; blank ticks none', async () => {
  const sourceBoxes = { 新生: 238.97, 轉學生: 309.19, 舊生: 393.22 }
  for (const status of ['', '新生', '轉學生', '舊生'] as const) {
    const output = await generateIepPdf(request({}, { studentStatus: status }))
    const pdf = await PDFDocument.load(output.bytes), page = pdf.getPage(0)
    const contents = page.node.Contents()!
    const streams = contents instanceof PDFArray ? contents.asArray() : [contents]
    const strokes: number[] = []
    for (const ref of streams) {
      const stream = pdf.context.lookup(ref)
      if (!(stream instanceof PDFRawStream)) continue
      const text = new TextDecoder().decode(decodePDFRawStream(stream).decode())
      for (const match of text.matchAll(/([-\d.]+) ([-\d.]+) m\s+([-\d.]+) ([-\d.]+) l/g)) {
        const x = Number(match[1]), top = page.getHeight() - Number(match[2])
        if (x > 237 && x < 420 && top >= 162.53 && top <= 176.57) strokes.push(x)
      }
    }
    assert.equal(strokes.length, status ? 2 : 0, status || 'blank')
    if (status) assert.ok(strokes.every(x => x > sourceBoxes[status] && x < sourceBoxes[status] + 14.04), status)
  }
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

test('long values in all dense forms preserve their start and end through readable pagination', async () => {
  const narrative = (start: string, end: string) => start + '完整保留內容。'.repeat(90) + end
  const content = {
    studentFamilyForm: { values: { studentName: '王曉明', registeredAddress: narrative('地址起點', '地址終點'), regularMedication: 'has' }, checks: {}, medications: [{ name: '測試藥物', directions: narrative('用法起點', '用法終點') }] },
    specialEducationSupport: { specialNotes: narrative('服務起點', '服務終點') },
    curriculumAdjustment: { content: { applicableSubjects: ['國語'], description: narrative('調整起點', '調整終點') } },
    goalDomains: [{ id: 'domain', domainName: '國語', annualGoals: [{ id: 'annual', content: narrative('學年起點', '學年終點') }] }],
    semesterGoals: [{ id: 'goal', domainId: 'domain', annualGoalId: 'annual', content: narrative('目標起點', '目標終點'), evaluationRecords: [{ id: 'evaluation', result: narrative('結果起點', '結果終點'), notes: narrative('備註起點', '備註終點') }] }],
    behaviorIntervention: { needStatus: '有需求', executionDetails: { antecedent: { executionMethod: narrative('執行起點', '執行終點') } } },
    transitionSupport: { services: { education: { needStatus: '有需求', progress: narrative('轉銜起點', '轉銜終點') } } },
    meetingRecords: [{ id: 'meeting', date: '2026-11-02', location: '測試會議室', discussionTopics: [{ id: 'topic', type: '特殊教育需求', enabled: true, summary: narrative('會議起點', '會議終點') }] }],
  }
  const input = request(content), original = JSON.stringify(input)
  const { text } = await exportedText((await generateIepPdf(input)).bytes)
  for (const label of ['地址', '用法', '服務', '調整', '學年', '目標', '結果', '備註', '執行', '轉銜', '會議']) {
    assert.ok(text.includes(label + '起點'), label + ' start retained')
    assert.ok(text.includes(label + '終點'), label + ' end retained')
  }
  assert.equal((text.match(/完整保留內容。/g) ?? []).length >= 11 * 89, true, 'paragraphs and table cells remain complete across page boundaries')
  assert.equal(JSON.stringify(input), original, 'formatting never changes the IEP data')
})

test('extra assessment records and their evaluators are retained', async () => {
  const records = Array.from({ length: 9 }, (_, i) => ({ assessmentDate: '2026-11-02', assessmentType: '觀察', assessmentTool: `工具${i}`, evaluator: `評量人${i}`, summary: `摘要第${i}筆`, detail: `參考內容${i}` }))
  const output = await generateIepPdf(request(), records)
  const { text } = await exportedText(output.bytes)
  for (let i = 0; i < 9; i++) { assert.ok(text.includes(`摘要第${i}筆`)); assert.ok(text.includes(`評量人${i}`)); assert.ok(text.includes(`參考內容${i}`)) }
  assert.ok(output.pageCount > 20)
})

test('assessment summaries retain the original fixed table and continue in full when cells fill', async () => {
  const records = Array.from({ length: 5 }, (_, i) => ({ assessmentDate: '2026-11-02', assessmentType: '觀察', assessmentTool: `課堂觀察表${i}`, evaluator: `測試教師${i}`, summary: `摘要起點${i}` + '觀察學生參與課堂並完成任務。'.repeat(5) + `摘要終點${i}` }))
  const output = await generateIepPdf(request(), records)
  const { text, runs } = await exportedText(output.bytes)
  assert.equal(output.supplementPageCount, output.pageCount - 20, 'table continuation pages are included in the preview count')
  assert.ok(output.pageCount > 20)
  assert.ok(!text.includes('詳續頁'))
  for (let i = 0; i < records.length; i++) {
    assert.ok(text.includes(`摘要起點${i}`) && text.includes(`摘要終點${i}`))
    const content = runs.filter(run => run.text.startsWith(`摘要起點${i}`))
    assert.ok(content.length)
    assert.ok(content.every(run => run.size === 11))
  }
  assert.ok(runs.some(run => run.page > 2 && run.text.includes('（續頁）')), 'overflow is visibly identified as a continuation')
})

test('a very long assessment preserves all summary content and keeps CPT units together', async () => {
  const output = await generateIepPdf(request(), [
    { source: 'cpt', assessmentDate: '2026-11-02', assessmentType: '注意力遊戲評量', assessmentTool: 'CPT', evaluator: 'EyeEP 遊戲評量', summary: 'Hit 10%；Omission 18 次；Commission 3 次；RT 473 ms；RTV 381 ms。' },
    { assessmentDate: '2026-11-02', assessmentType: '觀察', assessmentTool: '長篇觀察表', evaluator: '測試教師', summary: '長篇摘要起點' + '內容完整保留。'.repeat(400) + '\n長篇摘要結束' },
  ])
  const { text, runs } = await exportedText(output.bytes)
  assert.ok(text.includes('長篇摘要起點') && text.includes('長篇摘要結束'))
  assert.ok(runs.filter(run => run.x === 43 && run.size === 11).map(run => run.text).join('').includes('長篇摘要起點' + '內容完整保留。'.repeat(400) + '長篇摘要結束'), 'full summary is retained across continuation page headers')
  assert.equal(output.supplementPageCount, output.pageCount - 20)
  for (const value of ['RT 473 ms', 'RTV 381 ms。', 'Commission 3 次']) assert.ok(text.includes(value), value)
  assert.ok(runs.filter(run => run.font.startsWith('DFKaiShu')).every(run => run.size >= 11 || run.size === 9), 'content is readable; page numbers may use 9pt')
})

test('both semesters, extra goal rows, annual links and fourth evaluations survive', async () => {
  const domain = { id: 'domain', domainName: '語文測試領域', annualGoals: [{ id: 'annual', content: '學年目標保留' }] }
  const goals = Array.from({ length: 12 }, (_, i) => ({ id: `goal${i}`, domainId: 'domain', annualGoalId: 'annual', semester: i === 11 ? '第二學期' : '第一學期', content: `學期目標第${i}筆`, evaluationRecords: Array.from({ length: 4 }, (_, n) => ({ id: `${i}-${n}`, date: '2026-11-02', result: `結果${i}之${n}`, notes: `備註${i}之${n}` })) }))
  const output = await generateIepPdf(request({ goalDomains: [domain], semesterGoals: goals }))
  const { text } = await exportedText(output.bytes)
  assert.ok(text.includes('學年目標保留'))
  assert.ok(text.includes('第二學期教育目標'), 'the second-semester goal section is retained')
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
  const inactiveSupport = request({ specialEducationSupport: { specialNotes: 'HIDDEN_SUPPORT', referenceDetails: { supportNeed: '無需求' } } })
  const { text: supportText } = await exportedText((await generateIepPdf(inactiveSupport)).bytes)
  assert.ok(!supportText.includes('HIDDEN_SUPPORT'), 'inactive support drafts remain excluded')
})

test('all meetings, enabled topics and participants are included without fabricated signatures', async () => {
  const meetingRecords = Array.from({ length: 3 }, (_, i) => ({ id: `meeting${i}`, date: '2026-11-02', location: `測試地點${i}`, participants: [{ id: `person${i}`, name: `與會者${i}`, role: 'other', title: '測試角色', attended: false }], discussionTopics: [{ id: `topic${i}`, type: '其他', otherName: `議題${i}`, enabled: true, summary: `討論摘要${i}` }], hasMotions: true, motions: [{ id: `motion${i}`, content: `臨時動議${i}` }] }))
  const { text } = await exportedText((await generateIepPdf(request({ meetingRecords }))).bytes)
  for (let i = 0; i < 3; i++) { assert.ok(text.includes(`與會者${i}`)); assert.ok(text.includes(`議題${i}`)); assert.ok(text.includes(`討論摘要${i}`)); assert.ok(text.includes(`臨時動議${i}`)) }
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


test('filled exports preserve every source form page instead of replacing it with reflowed tables', async () => {
  const source = await PDFDocument.load(await readFile(new URL('../../assets/iep-reference.pdf', import.meta.url)))
  const output = await PDFDocument.load((await generateIepPdf(request({
    studentFamilyForm: { values: { studentName: '王曉明', registeredAddress: '格式比對地址' }, checks: {}, medications: [] },
    assessmentDetails: { 'sensory-otherObservation': '格式比對觀察' },
    specialEducationSupport: { specialNotes: '格式比對支持' },
    goalDomains: [{ id: 'domain', domainName: '語文', annualGoals: [] }],
    behaviorIntervention: { needStatus: '有需求' },
    transitionSupport: { generalServiceContent: '格式比對轉銜' },
  }))).bytes)
  const streams = (pdf: PDFDocument) => pdf.getPages().flatMap(page => {
    const content = page.node.Contents()
    return (content instanceof PDFArray ? content.asArray() : content ? [content] : []).flatMap(ref => {
      const stream = pdf.context.lookup(ref)
      return stream instanceof PDFRawStream ? [Buffer.from(decodePDFRawStream(stream).decode()).toString('base64')] : []
    })
  })
  const actual = new Set(streams(output))
  for (const stream of streams(source)) assert.ok(actual.has(stream), 'original headings, tables, instructions and reference pages retained')
})

test('fixed-cell text and overflow markers stay inside their allocated rectangles', async () => {
  const pdf = await IepPdfDocument.create(), p = await pdf.page(2, '欄位邊界測試')
  const cells = [[100, 100, 5, 16], [100, 130, 38, 14], [100, 160, 82, 31], [100, 210, 245, 29]] as const
  const original = p.text.bind(p)
  let active: readonly [number, number, number, number] | undefined
  let emitted = 0
  p.text = (x, top, value, size = 10, color) => {
    if (active) {
      assert.ok(x >= active[0] && x + p.textWidth(value, size) <= active[0] + active[2], value)
      assert.ok(top >= active[1] && top + size <= active[1] + active[3], value)
      emitted++
    }
    original(x, top, value, size, color)
  }
  const value = '長姓名與日期115/11/2 ABCDEFGHIJKLMNOPQRSTUVWXYZ' + '完整保留。'.repeat(30)
  for (const box of cells) { active = box; p.field(box, value, `欄位${box[1]}`) }
  assert.ok(emitted > 0)
  assert.equal(p.supplements.length, cells.length)
  assert.ok(p.supplements.every(item => item.text === value))
})
