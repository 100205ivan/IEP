import { rgb } from 'pdf-lib'
import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { object, text } from './format.js'
import { IepPdfDocument, PdfPainter } from './layout.js'

export type FieldRow = [label: string, value: unknown]
const size = 11, leading = 15, left = 36, right = 556, bottom = 752, padding = 7

/** Readable A4 forms: fixed type size, expandable rows, repeated headers and no clipped text. */
export class FormFlow {
  private y = 92
  private constructor(private pdf: IepPdfDocument, private input: IepPdfRequest, private section: string, private p: PdfPainter) {}
  static async create(pdf: IepPdfDocument, input: IepPdfRequest, section: string) {
    const flow = new FormFlow(pdf, input, section, await pdf.blankPage(section, false))
    flow.pageHeading(false)
    return flow
  }
  private pageHeading(continued: boolean) {
    const heading = this.p.wrap(this.section + (continued ? '（續頁）' : ''), 520, 14)
    heading.forEach((line, i) => this.p.text(left, 34 + i * 18, line, 14, rgb(.78, 0, 0)))
    const family = object(this.input.content.studentFamilyForm)
    const subtitleTop = 34 + heading.length * 18 + 7
    const subtitle = this.p.wrap(`${text(object(family.values).studentName) || '未填姓名'}　${this.input.academicYear} 學年度`, 520, 11)
    subtitle.forEach((line, i) => this.p.text(left, subtitleTop + i * 15, line, 11))
    const rule = subtitleTop + subtitle.length * 15 + 7
    this.p.line(left, rule, right, rule, .6)
    this.y = rule + 13
  }
  async pageBreak() {
    this.p = await this.pdf.blankPage(this.section)
    this.pageHeading(true)
  }
  private async room(height: number) { if (this.y + height > bottom) await this.pageBreak() }
  async heading(value: string, requiredAfter = 32) {
    const lines = this.p.wrap(value, 520, 12)
    await this.room(Math.min(lines.length * 17 + 16 + requiredAfter, 120))
    this.y += 7
    let offset = 0
    while (offset < lines.length) {
      if (bottom - this.y < 49) await this.pageBreak()
      const count = Math.min(lines.length - offset, Math.floor((bottom - this.y - 32) / 17))
      lines.slice(offset, offset + count).forEach((line, i) => this.p.text(left, this.y + i * 17, line, 12))
      this.y += count * 17; offset += count
      if (offset < lines.length) await this.pageBreak()
    }
    this.y += 9
  }
  async paragraph(label: string, value: unknown) {
    const content = text(value)
    if (!content.trim()) return
    const lines = this.p.wrap(content, 506, size)
    await this.heading(label, Math.min(2, lines.length) * leading + 9)
    let offset = 0
    while (offset < lines.length) {
      await this.room(leading + 4)
      const count = Math.min(lines.length - offset, Math.floor((bottom - this.y) / leading))
      lines.slice(offset, offset + count).forEach((line, i) => this.p.text(left + 7, this.y + i * leading, line, size))
      this.y += count * leading; offset += count
      if (offset < lines.length) { await this.pageBreak(); await this.heading(label + '（續）') }
    }
    this.y += 9
  }
  async info(rows: FieldRow[]) {
    const value = rows.filter(([, value]) => text(value).trim()).map(([label, value]) => `${label}：${text(value)}`).join('　')
    if (!value) return
    const lines = this.p.wrap(value, 520, size)
    let offset = 0
    while (offset < lines.length) {
      await this.room(leading)
      const count = Math.min(lines.length - offset, Math.floor((bottom - this.y) / leading))
      lines.slice(offset, offset + count).forEach((line, i) => this.p.text(left, this.y + i * leading, line, size))
      this.y += count * leading; offset += count
      if (offset < lines.length) await this.pageBreak()
    }
    this.y += 8
  }
  async fields(rows: FieldRow[], caption?: string) {
    const active = rows.filter(([, value]) => text(value).trim())
    if (active.length) await this.table(['項目', '內容'], [120, 400], active.map(([label, value]) => [label, text(value)]), { caption })
  }
  async grid(rows: FieldRow[]) {
    const active = rows.filter(([, value]) => text(value).trim())
    let pairs: string[][] = []
    const flush = async () => { if (pairs.length) { await this.table(['項目', '資料', '項目', '資料'], [80, 180, 80, 180], pairs); pairs = [] } }
    for (let i = 0; i < active.length;) {
      const [label, value] = active[i]
      if (text(value).length > 28 || text(value).includes('\n')) { await flush(); await this.fields([[label, value]]); i++; continue }
      const next = active[i + 1]
      if (next && (text(next[1]).length > 28 || text(next[1]).includes('\n'))) { pairs.push([label, text(value), '', '']); i++ }
      else { pairs.push([label, text(value), next?.[0] ?? '', text(next?.[1])]); i += next ? 2 : 1 }
    }
    await flush()
  }
  async table(headers: string[], widths: number[], values: string[][], options: { minHeight?: number; center?: number[]; shade?: Set<string>; caption?: string } = {}) {
    if (!values.length) return
    const x = [left]; widths.forEach(width => x.push(x[x.length - 1] + width))
    const headerLines = headers.map((value, i) => this.p.wrap(value, widths[i] - padding * 2, size))
    const headerHeight = Math.max(32, Math.max(...headerLines.map(lines => lines.length)) * leading + padding * 2)
    const minimum = Math.max(32, options.minHeight ?? 32)
    let tableTop = 0, rowCount = 0
    const start = async (firstHeight = minimum) => {
      await this.room(headerHeight + (firstHeight <= 620 - headerHeight ? firstHeight : minimum))
      tableTop = this.y
      rowCount = 0
      headerLines.forEach((lines, column) => lines.forEach((line, i) => this.p.text(x[column] + (widths[column] - this.p.textWidth(line, size)) / 2, this.y + (headerHeight - lines.length * leading) / 2 + i * leading + 1, line, size)))
      this.p.line(left, this.y, right, this.y, .7)
      this.y += headerHeight
      this.p.line(left, this.y, right, this.y, .6)
    }
    const finish = () => { x.forEach((column, i) => this.p.line(column, tableTop, column, this.y, i === 0 || i === x.length - 1 ? .7 : .4)) }
    const continueTable = async () => { finish(); await this.pageBreak(); if (options.caption) await this.heading(options.caption + '（續）'); await start() }
    const firstHeight = Math.max(minimum, Math.max(...widths.map((width, i) => this.p.wrap(values[0][i] ?? '', width - padding * 2, size).length)) * leading + padding * 2)
    await start(firstHeight)
    for (const [rowIndex, row] of values.entries()) {
      const cells = widths.map((width, i) => this.p.wrap(row[i] ?? '', width - padding * 2, size))
      const total = Math.max(1, ...cells.map(lines => lines.length))
      let offset = 0
      while (offset < total) {
        const full = Math.max(minimum, (total - offset) * leading + padding * 2)
        const nextPageHeight = 620 - headerHeight
        if (bottom - this.y < minimum || offset === 0 && rowCount > 0 && full > bottom - this.y && full <= nextPageHeight) await continueTable()
        const count = Math.min(total - offset, Math.floor((bottom - this.y - padding * 2) / leading))
        const height = Math.max(minimum, count * leading + padding * 2)
        cells.forEach((lines, column) => {
          if (options.shade?.has(`${rowIndex}:${column}`)) this.p.shade([x[column] + .5, this.y + .5, widths[column] - 1, height - 1])
          const shown = offset < lines.length ? lines.slice(offset, offset + count) : column === 0 ? lines.slice(0, count) : []
          shown.forEach((line, i) => this.p.text(options.center?.includes(column) ? x[column] + (widths[column] - this.p.textWidth(line, size)) / 2 : x[column] + padding, this.y + padding + i * leading, line, size))
        })
        this.y += height; offset += count; rowCount++
        this.p.line(left, this.y, right, this.y, .4)
        if (offset < total) await continueTable()
      }
    }
    finish(); this.y += 12
  }
}
