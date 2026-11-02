import { rgb } from 'pdf-lib'
import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import type { IepAttachment } from '../iepAttachmentService.js'
import type { PdfAssessment } from './assessment.js'
import { date, object, text } from './format.js'
import { IepPdfDocument, PdfPainter } from './layout.js'

const columns = [44, 114, 228, 314, 540], size = 11, leading = 14, padding = 6, bottom = 750

/** Keep Latin words intact while still allowing CJK text and long identifiers to wrap. */
function wrap(p: PdfPainter, value: string, width: number) {
  const lines: string[] = []
  for (const paragraph of value.replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n')) {
    let line = ''
    const add = (token: string) => {
      if (!line && !token.trim()) return
      if (line && p.textWidth(line + token, size) > width) { lines.push(line.trimEnd()); line = token.trimStart() }
      else line += token
    }
    for (const token of paragraph.match(/[（(][^（）()\n]{1,30}[）)]|[A-Za-z0-9]+(?:[./%_-][A-Za-z0-9]+)*[，。；：？！、]*|[ \t]+|.[，。；：？！、）)]*/gu) ?? []) {
      if (p.textWidth(token, size) > width) for (const char of token) add(char)
      else add(token)
    }
    lines.push(line.trimEnd())
  }
  return lines
}

export async function drawAssessmentTable(pdf: IepPdfDocument, input: IepPdfRequest, records: PdfAssessment[], attachments: IepAttachment[]) {
  const section = '壹、二、學生能力現況評量紀錄'
  let p = await pdf.page(3, section), headerTop = 472, y = 508, rows = 0
  for (const attachment of attachments) await p.picture(attachment.bytes, attachment.mimeType, [attachment.kind === 'certificate-front' ? 40 : 294, 91, 246, 187])
  p.clear([43, 471, 498, 282])
  const center = (value: string, left: number, right: number, top: number, fontSize: number, color = rgb(0, 0, 0)) => p.text(left + (right - left - p.textWidth(value, fontSize)) / 2, top, value, fontSize, color)
  const header = () => {
    for (let i = 0; i < 3; i++) center(['評量日期', '評量工具或方式', '評量者'][i], columns[i], columns[i + 1], headerTop + 12, 12)
    center('評量結果摘要', columns[3], columns[4], headerTop + 5, 12)
    center('（建議包含量化結果及質性解釋）', columns[3], columns[4], headerTop + 22, 11, rgb(0, .44, .75))
    p.line(columns[0], headerTop, columns[4], headerTop, .8)
    p.line(columns[0], y, columns[4], y, .6)
  }
  const finish = () => { for (const x of columns) p.line(x, headerTop, x, y, x === columns[0] || x === columns[4] ? .8 : .45) }
  const next = async () => {
    finish()
    p = await pdf.blankPage(section)
    p.text(36, 38, section + '（續頁）', 14)
    const family = object(input.content.studentFamilyForm)
    const subtitle = p.wrap(`${text(object(family.values).studentName)}　${input.academicYear} 學年度`, 520, 11)
    subtitle.forEach((line, i) => p.text(36, 63 + i * 15, line, 11))
    headerTop = 79 + subtitle.length * 15; y = headerTop + 36; rows = 0; header()
  }
  header()
  for (const record of records) {
    const method = record.assessmentType === '其他' ? record.otherAssessmentType : record.assessmentType
    const tool = [record.assessmentTool, method && method !== record.assessmentTool ? `（${method}）` : ''].filter(Boolean).join('\n')
    const summary = record.source === 'cpt' || record.source === 'monkey' ? record.summary.replace(/[;；]\s*/g, '\n') : record.summary
    const evaluatorWidth = columns[3] - columns[2] - padding * 2
    const evaluator = record.evaluator.replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n').map(line => p.textWidth(line, size) > evaluatorWidth ? line.trim().replace(/\s+/g, '\n') : line).join('\n')
    const cells = [date(record.assessmentDate), tool, evaluator, summary].map((value, i) => wrap(p, value, columns[i + 1] - columns[i] - padding * 2))
    const total = Math.max(1, ...cells.map(lines => lines.length))
    let offset = 0
    while (offset < total) {
      const fullHeight = Math.max(44, (total - offset) * leading + padding * 2)
      if (bottom - y < 44 || offset === 0 && rows > 0 && fullHeight > bottom - y && fullHeight <= 620) await next()
      const count = Math.min(total - offset, Math.floor((bottom - y - padding * 2) / leading))
      const height = Math.max(44, count * leading + padding * 2)
      cells.forEach((lines, column) => {
        // Repeat the record identity when a very long row spans several pages.
        const shown = offset < lines.length ? lines.slice(offset, offset + count) : column < 3 ? lines.slice(0, count) : []
        const top = column === 3 ? y + padding : y + (height - shown.length * leading) / 2
        shown.forEach((line, index) => {
          const left = column === 0 || column === 2 ? columns[column] + (columns[column + 1] - columns[column] - p.textWidth(line, size)) / 2 : columns[column] + padding
          p.text(left, top + index * leading + 1, line, size)
        })
      })
      y += height; rows++; offset += count
      p.line(columns[0], y, columns[4], y, .45)
      if (offset < total) await next()
    }
  }
  if (!records.length) for (let row = 0; row < 7; row++) { y += 32; p.line(columns[0], y, columns[4], y, .45) }
  finish()
  // Keep the summary table contiguous; longer analysis details follow its last page.
  records.forEach((record, index) => p.supplement(`評量 ${index + 1}：${record.assessmentTool}詳細結果`, record.detail))
}
