/* The export's automatic layout check, from the command line.
   npm run check:word-layout [-- path/to/request.json]
   Exports the request (default: the fictional test fixture) exactly as the API
   does, prints the same layout report the PDF preview shows, and saves page
   images to backend/data/layout-check/pages for a final look by eye. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { iepPdfExportSchema } from '../schemas/iepPdfExport.js'
import { checkPdfLayout, generateIepWord, generateIepWordPdf } from '../services/iepWordExport.js'

const backend = fileURLToPath(new URL('../../', import.meta.url))
const out = join(backend, 'data/layout-check')
const requestPath = process.argv[2] ? resolve(process.argv[2]) : join(backend, 'src/tests/fixtures/iep-word-sample.json')
const request = iepPdfExportSchema.parse(JSON.parse(await readFile(requestPath, 'utf8')))

await mkdir(out, { recursive: true })
console.log(`匯出中：${requestPath}`)
const [pdf, word] = await Promise.all([generateIepWordPdf(request), generateIepWord(request)])
const pdfPath = join(out, 'export.pdf')
await writeFile(pdfPath, pdf.bytes)
const report = await checkPdfLayout(pdfPath, word.values, word.unplaced, join(out, 'pages'))
if (!report) throw new Error('版面檢查無法執行，請確認 Python 與 pdfplumber 已安裝。')

console.log(`\n頁數：${report.pages}；未放入表單的欄位：${report.unplaced}`)
for (const issue of report.issues) console.log(`${issue.level === 'error' ? '✗ 需修正' : '△ 提醒'}  ${issue.page ? `第 ${issue.page} 頁 ` : ''}${issue.kind}：${issue.detail}`)
if (!report.issues.length) console.log('✓ 沒有發現版面問題')
await writeFile(join(out, 'layout-report.json'), JSON.stringify(report, null, 1))
console.log(`\n報告：${join(out, 'layout-report.json')}\n逐頁圖片：${report.pngFolder}`)
process.exitCode = report.issues.some(issue => issue.level === 'error') ? 1 : 0
