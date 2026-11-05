import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import type { IepPdfRequest } from '../schemas/iepPdfExport.js'
import type { IepAttachment } from './iepAttachmentService.js'
import type { PdfAssessment } from './iepPdf/assessment.js'
import { PdfExportError } from './iepPdf/layout.js'
import { buildIepWordModel } from './iepWordModel.js'

const run = promisify(execFile)
async function convertOffice(executable: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = execFile(executable, args, { windowsHide: true, maxBuffer: 1024 * 1024 }, error => {
      clearTimeout(timer)
      if (error) reject(error)
      else resolve()
    })
    // The Windows launcher starts soffice.bin; killing only the launcher leaves
    // the conversion running and its sensitive temporary files locked.
    const timer = setTimeout(() => {
      if (process.platform === 'win32' && child.pid) {
        execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => reject(new Error('Word conversion timed out')))
      } else { child.kill('SIGKILL'); reject(new Error('Word conversion timed out')) }
    }, 300_000)
  })
}
const backend = fileURLToPath(new URL('../../', import.meta.url))
async function find(paths: string[], message: string) {
  for (const path of paths.filter(Boolean)) { try { await access(path); return path } catch { /* Try next configured location. */ } }
  throw new PdfExportError(message)
}
export async function python() {
  if (process.env.IEP_WORD_PYTHON_PATH) return process.env.IEP_WORD_PYTHON_PATH
  if (process.platform !== 'win32') return 'python3'
  return find([join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')], '請設定 IEP_WORD_PYTHON_PATH，並安裝 python-docx。')
}
async function soffice() {
  if (process.env.IEP_SOFFICE_PATH) return process.env.IEP_SOFFICE_PATH
  if (process.platform !== 'win32') return 'soffice'
  return find([
    join(backend, 'data/libreoffice/program/soffice.exe'),
    join(backend, 'data/libreoffice/LibreOffice/program/soffice.exe'),
    'C:/Program Files/LibreOffice/program/soffice.exe',
  ], '尚未設定 Word 轉 PDF 引擎。請設定 IEP_SOFFICE_PATH；仍可匯出 Word。')
}

export async function generateIepWord(input: IepPdfRequest, records: PdfAssessment[] = [], attachments: IepAttachment[] = [], layout: 'form' | 'reference' = 'form') {
  const model = await buildIepWordModel(input, records, attachments)
  const directory = await mkdtemp(join(tmpdir(), 'eyeep-word-'))
  try {
    const modelPath = join(directory, 'data.json'), output = join(directory, 'IEP.docx')
    await writeFile(modelPath, JSON.stringify(model), { mode: 0o600 })
    const { stdout } = await run(await python(), [join(backend, 'scripts/iep_word.py'), '--model', modelPath, '--output', output, '--layout', layout], { timeout: 120_000, windowsHide: true, maxBuffer: 1024 * 1024 })
    // Values the blank form has no place for are kept as supplement paragraphs.
    const unplaced = Number(JSON.parse(stdout.trim().split('\n').pop() || '{}').unplaced ?? 0)
    const values = model.pages.flatMap(page => page.fields.map(field => field.value))
    return { bytes: await readFile(output), fileName: `${model.studentName}_${input.academicYear}學年度_IEP.docx`, formCount: model.pages.length, unplaced, values }
  } catch (error) {
    if (error instanceof PdfExportError) throw error
    throw new PdfExportError('Word 產生失敗，請檢查 Python、requirements-word.txt 套件與範本字型設定。')
  } finally { await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }) }
}

export interface LayoutIssue { level: 'error' | 'warning'; page: number | null; kind: string; detail: string }
export interface LayoutReport { pages: number; unplaced: number; issues: LayoutIssue[]; pngFolder?: string }

/** Reads the exported PDF for squeezed values, overflow, near-empty pages and
 * unplaced fields. A failed check never fails the export: it returns null. */
export async function checkPdfLayout(pdfPath: string, values: string[], unplaced: number, pngDir?: string): Promise<LayoutReport | null> {
  try {
    const valuesPath = `${pdfPath}.values.json`
    await writeFile(valuesPath, JSON.stringify(values), { mode: 0o600 })
    const args = [join(backend, 'scripts/check_layout.py'), '--pdf', pdfPath, '--values', valuesPath, '--unplaced', String(unplaced), ...(pngDir ? ['--png-dir', pngDir] : [])]
    const { stdout } = await run(await python(), ['-X', 'utf8', ...args], { timeout: 120_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 })
    return JSON.parse(stdout.trim().split('\n').pop() || 'null') as LayoutReport
  } catch (error) {
    console.error('EyeEP layout check failed', { message: error instanceof Error ? error.message.slice(0, 200) : 'unknown' })
    return null
  }
}

export async function generateIepWordPdf(input: IepPdfRequest, records: PdfAssessment[] = [], attachments: IepAttachment[] = []) {
  const executable = await soffice()
  // The PDF prints the same filled official form as the Word download, so both
  // keep the original form's styling without fixed-position text overlays.
  const word = await generateIepWord(input, records, attachments)
  const directory = await mkdtemp(join(tmpdir(), 'eyeep-word-pdf-'))
  try {
    await writeFile(join(directory, 'IEP.docx'), word.bytes, { mode: 0o600 })
    await convertOffice(executable, [`-env:UserInstallation=${pathToFileURL(resolve(directory, 'profile')).href}`, '--headless', '--norestore', '--convert-to', 'pdf:writer_pdf_Export', '--outdir', directory, join(directory, 'IEP.docx')])
    const bytes = await readFile(join(directory, 'IEP.pdf'))
    const pdf = await PDFDocument.load(bytes), pageCount = pdf.getPageCount()
    const layout = await checkPdfLayout(join(directory, 'IEP.pdf'), word.values, word.unplaced)
    // Long values flow within the form, so there are no continuation pages.
    return { bytes, pageCount, supplementPageCount: 0, unplaced: word.unplaced, layout, fileName: word.fileName.replace(/\.docx$/, '.pdf') }
  } catch (error) {
    if (error instanceof PdfExportError) throw error
    throw new PdfExportError('Word 轉 PDF 失敗，請檢查本機 LibreOffice 排版引擎；可先匯出 Word。')
  } finally { await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }) }
}
