import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIepWordModel } from '../services/iepWordModel.js'
import { generateIepWord } from '../services/iepWordExport.js'
import { iepPdfExportSchema } from '../schemas/iepPdfExport.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

async function inspectWord(bytes: Uint8Array) {
  const directory = await mkdtemp(join(tmpdir(), 'eyeep-word-test-'))
  try {
    const file = join(directory, 'test.docx')
    await writeFile(file, bytes)
    const python = process.env.IEP_WORD_PYTHON_PATH || (process.platform === 'win32' ? join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe') : 'python3')
    const code = `import json,sys,zipfile
from lxml import etree as E
x=E.fromstring(zipfile.ZipFile(sys.argv[1]).read('word/document.xml'))
n={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','v':'urn:schemas-microsoft-com:vml','wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
print(json.dumps(dict(text=''.join(x.xpath('//w:t/text()',namespaces=n)),paragraphs=[''.join(p.xpath('.//w:t/text()',namespaces=n)) for p in x.xpath('//w:p',namespaces=n)],textboxes=len(x.xpath('//w:txbxContent',namespaces=n)),floating=len(x.xpath('//v:rect|//v:shape|//wp:anchor',namespaces=n)),inlinePictures=len(x.xpath('//wp:inline',namespaces=n)),firstGrid=[int(c.get('{'+n['w']+'}w')) for c in x.xpath('(//w:tbl)[1]/w:tblGrid/w:gridCol',namespaces=n)],exactRows=len(x.xpath('//w:trHeight[@w:hRule="exact"]',namespaces=n)),minimumRows=len(x.xpath('//w:trHeight[@w:hRule="atLeast"]',namespaces=n)),emptyBreaks=len(x.xpath('//w:p[w:pPr/w:pageBreakBefore and not(.//w:t)]',namespaces=n)),tables=len(x.xpath('//w:tbl',namespaces=n)),eastAsiaFonts=sorted(set(x.xpath('//w:rFonts/@w:eastAsia',namespaces=n))),goalRows=[len(r)-1-[i for i,w in enumerate(r) if '方式' in w and '標準' in w][0] for r in [[''.join(tr.xpath('.//w:t/text()',namespaces=n)) for tr in t.xpath('w:tr',namespaces=n)] for t in x.xpath('//w:tbl',namespaces=n)] if any('起訖日期' in w for w in r)])))`
    const { stdout } = await promisify(execFile)(python, ['-X', 'utf8', '-c', code, file], { timeout: 30_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 })
    return JSON.parse(stdout) as { text: string; paragraphs: string[]; textboxes: number; floating: number; inlinePictures: number; firstGrid: number[]; exactRows: number; minimumRows: number; emptyBreaks: number; tables: number; eastAsiaFonts: string[]; goalRows: number[] }
  } finally { await rm(directory, { recursive: true, force: true }) }
}

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

const blankForm = () => readFile(new URL('../../assets/iep-form-template.docx', import.meta.url)).then(inspectWord)
const TIMETABLE_ROWS = 24 // two semester timetables of 12 fixed rows each

test('Word export fills the official blank IEP form', async () => {
  const input = iepPdfExportSchema.parse({ academicYear: 115, content: { studentFamilyForm: { values: { studentName: '測試學生', guardianName: '測試家長', guardianPhone: '0912345678', guardianAge: '38' }, checks: {}, medications: [] } } })
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64')
  const output = await generateIepWord(input, [], ['certificate-front', 'certificate-back'].map(kind => ({ kind: kind as 'certificate-front' | 'certificate-back', mimeType: 'image/png', fileName: 'test.png', bytes: png, updatedAt: '2026-11-03' })))
  assert.equal(output.bytes.subarray(0, 2).toString(), 'PK')
  assert.equal(output.fileName, '測試學生_115學年度_IEP.docx')
  assert.equal(output.formCount, 20)
  assert.equal(output.unplaced, 0, 'every value has its place in the form')
  const [document, form] = await Promise.all([inspectWord(output.bytes), blankForm()])
  assert.equal(document.textboxes, form.textboxes, 'values are ordinary text, never added text boxes')
  assert.equal(document.inlinePictures, 2, 'certificate images are ordinary inline pictures')
  assert.equal(document.exactRows, TIMETABLE_ROWS, 'only the weekly timetables keep fixed rows; Word grows every other row')
  assert.ok(document.tables >= 20, 'the form remains native Word tables')
  assert.ok(document.paragraphs.some(paragraph => paragraph.includes('0912345678') && paragraph.includes('電話')), 'telephone label and value are ordinary text in the same paragraph')
  assert.ok(document.text.includes('團隊合作方式訂定個別化教育計畫'), 'the official form wording is retained')
  assert.ok(!document.text.includes('國-J-A2'), 'sample answers of the source form are never exported')
  assert.deepEqual(document.eastAsiaFonts, ['標楷體'], 'Chinese text prints in 標楷體 as in the reference PDF')
})

test('every field and check of a filled IEP reaches its place in the form', async () => {
  const input = iepPdfExportSchema.parse(JSON.parse(await readFile(new URL('./fixtures/iep-word-sample.json', import.meta.url), 'utf8')))
  const model = await buildIepWordModel(input)
  const output = await generateIepWord(input)
  assert.equal(output.unplaced, 0, 'nothing falls back to supplement paragraphs')
  const [document, form] = await Promise.all([inspectWord(output.bytes), blankForm()])
  const ticks = (text: string) => (text.match(/■/g) ?? []).length
  const boxes = model.pages.reduce((sum, page) => sum + new Set(page.checks.map(check => `${check.x},${check.y}`)).size, 0)
  assert.equal(ticks(document.text) - ticks(form.text), boxes, 'each ticked option becomes ■')
  assert.ok(document.text.includes('擬訂日期：115年8月31日'), 'dates fill the printed 年月日 writing lines')
  assert.ok(document.text.includes('第二學期目標'), 'a second semester repeats the goal rows with its own heading')
  // Two rows per goal; the fixture's semesters hold 2, 1 and 1 goals.
  assert.deepEqual(document.goalRows, [6, 6, 6], 'blank goal blocks beyond the filled goals and three for handwriting are dropped')
  assert.ok(document.text.includes('※1（達成標準）：【測試資料】依情境觀察紀錄判斷。'), 'long text in a narrow column moves to a ※ note')
  assert.ok(!/[☑☐]/.test(document.text), 'ticks use the form font rather than symbols it lacks')
})

test('Word retains full long cell content while reference export stays available for PDF', async () => {
  const long = '編輯測試起點' + '長文字須在原表格內完整保留。'.repeat(140) + '編輯測試終點'
  const input = iepPdfExportSchema.parse({ academicYear: 115, content: { studentFamilyForm: { values: { studentName: '測試學生', registeredAddress: long }, checks: {}, medications: [] } } })
  const before = JSON.stringify(input)
  const document = await inspectWord((await generateIepWord(input)).bytes)
  assert.ok(document.text.includes(long), 'the original cell contains the complete value without ellipsis')
  assert.equal(document.exactRows, TIMETABLE_ROWS)
  assert.equal(JSON.stringify(input), before)
  const reference = await inspectWord((await generateIepWord(input, [], [], 'reference')).bytes)
  assert.ok(reference.textboxes > 0, 'the fixed source layout remains isolated to the PDF path')
})
