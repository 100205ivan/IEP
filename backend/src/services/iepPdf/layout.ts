import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

export type Box = readonly [x: number, top: number, width: number, height: number]
type TemplateLayout = { width: number; height: number; checks: { x: number; y: number; size: number; label: string; note?: Box }[] }
export type Supplement = { title: string; text: string }
const normalize = (text: string) => text.normalize('NFKC').replace(/[\s_，、。:：()（）/／,\-]/g, '')
const black = rgb(0, 0, 0), white = rgb(1, 1, 1)
const assets = new URL('../../../assets/', import.meta.url)
let resources: Promise<{ template: Uint8Array; layout: TemplateLayout[]; font: Uint8Array }> | undefined

export class PdfExportError extends Error {}

async function loadResources() {
  resources ??= (async () => {
    const fontPath = process.env.IEP_PDF_FONT_PATH || join(process.env.SystemRoot || 'C:\\Windows', 'Fonts', 'kaiu.ttf')
    const [template, layout, font] = await Promise.all([
      readFile(new URL('iep-reference.pdf', assets)), readFile(new URL('iep-reference-layout.json', assets), 'utf8'),
      readFile(fontPath).catch(() => { throw new PdfExportError('找不到 PDF 匯出中文字型，請設定 IEP_PDF_FONT_PATH。') }),
    ])
    return { template, layout: JSON.parse(layout) as TemplateLayout[], font }
  })()
  try { return await resources } catch (error) { resources = undefined; throw error }
}

export class PdfPainter {
  readonly supplements: Supplement[] = []
  constructor(readonly page: PDFPage, private font: PDFFont, private layout: TemplateLayout, private measure: (value: string) => number) {}
  clear([x, top, width, height]: Box) {
    if (width <= 0 || height <= 0) return
    this.page.drawRectangle({ x, y: this.page.getHeight() - top - height, width, height, color: white })
  }
  line(x1: number, y1: number, x2: number, y2: number, thickness = 0.6) {
    this.page.drawLine({ start: { x: x1, y: this.page.getHeight() - y1 }, end: { x: x2, y: this.page.getHeight() - y2 }, thickness, color: black })
  }
  text(x: number, top: number, value: string, size = 10, color = black) {
    this.measure(value)
    this.page.drawText(value, { x, y: this.page.getHeight() - top - size * 0.87, size, font: this.font, color })
  }
  textWidth(value: string, size: number) { return this.measure(value) * size }
  wrap(value: string, width: number, size: number): string[] {
    const result: string[] = []
    for (const paragraph of value.replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n')) {
      let line = ''
      const add = (token: string) => {
        if (!line && !token.trim()) return
        if (line && this.measure(line + token) * size > width) { result.push(line.trimEnd()); line = token.trimStart() }
        else line += token
      }
      for (const token of paragraph.match(/[（(][^（）()\n]{1,30}[）)]|[A-Za-z0-9]+(?:[./%_-][A-Za-z0-9]+)*[，。；：？！、]*|[ \t]+|.[，。；：？！、）)]*/gu) ?? []) {
        if (this.measure(token) * size > width) for (const char of token) add(char)
        else add(token)
      }
      result.push(line.trimEnd())
    }
    return result
  }
  field(box: Box, value: unknown, label: string, options: { size?: number; min?: number; clear?: boolean; align?: 'left' | 'center'; spill?: boolean } = {}) {
    const valueText = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
    if (!valueText.trim()) return
    const [x, top, width, height] = box, size = Math.max(11, options.size ?? 11), leading = size * 1.2
    const all = this.wrap(valueText, Math.max(1, width - 4), size)
    const capacity = Math.max(0, Math.floor((height - 2 - size) / leading) + 1)
    const overflow = all.length > capacity
    if (overflow && options.spill === false) throw new PdfExportError(`「${label}」無法在指定欄位完整顯示。`)
    if (overflow) this.supplement(label, valueText)
    if (!capacity) return
    if (options.clear !== false) this.clear(box)
    const lines = all.slice(0, capacity)
    if (overflow && lines.length) {
      let last = lines[lines.length - 1]
      while (last && this.measure(last + '…') * size > width - 4) last = Array.from(last).slice(0, -1).join('')
      lines[lines.length - 1] = last + '…'
    }
    lines.forEach((line, i) => this.text(x + (options.align === 'center' ? Math.max(2, (width - this.measure(line) * size) / 2) : 2), top + 1 + i * leading, line, size))
  }
  check(x: number, top: number, size = 12) {
    this.line(x + 1.8, top + size * .55, x + size * .4, top + size * .78, .9)
    this.line(x + size * .4, top + size * .78, x + size * .91, top + size * .16, .9)
  }
  shade([x, top, width, height]: Box) { this.page.drawRectangle({ x, y: this.page.getHeight() - top - height, width, height, color: rgb(.92, .94, .93) }) }
  async picture(bytes: Uint8Array, mime: string, box: Box) {
    const document = this.page.doc
    const picture = mime === 'image/png' ? await document.embedPng(bytes) : await document.embedJpg(bytes)
    const [x, top, width, height] = box, scale = Math.min(width / picture.width, height / picture.height)
    const w = picture.width * scale, h = picture.height * scale
    this.page.drawImage(picture, { x: x + (width - w) / 2, y: this.page.getHeight() - top - (height + h) / 2, width: w, height: h })
  }
  choiceNotes(values: readonly string[], area: Box, notes: Record<string, string>, label: string, aliases: Record<string, string> = {}) {
    this.choices(values, area, aliases, label)
    for (const value of values) {
      const note = notes[value]
      if (!note?.trim()) continue
      const [x, y, width, height] = area
      const anchor = this.layout.checks.find(check => check.x >= x && check.x < x + width && check.y >= y && check.y < y + height && normalize(check.label).startsWith(normalize(aliases[value] ?? value)))
      if (anchor?.note) this.field(anchor.note, note, `${label}：${value}`, { size: 9, min: 8 })
      else this.supplement(`${label}：${value}`, note)
    }
  }
  choices(values: readonly string[], area: Box, aliases: Record<string, string> = {}, label?: string) {
    const wanted = values.map(value => normalize(aliases[value] ?? value)).filter(Boolean)
    const [x, y, width, height] = area
    const matched = new Set<string>()
    for (const check of this.layout.checks) {
      if (check.x < x || check.x >= x + width || check.y < y || check.y >= y + height) continue
      const label = normalize(check.label)
      const matches = wanted.filter(value => label.startsWith(value))
      if (matches.length) { this.check(check.x, check.y, check.size); matches.forEach(value => matched.add(value)) }
    }
    if (label) this.supplement(label, values.filter(value => !matched.has(normalize(aliases[value] ?? value))).map(value => value === 'peer-level' ? '與一般同儕無異' : value).join('、'))
  }
  supplement(title: string, value: unknown) {
    const text = typeof value === 'string' ? value : ''
    if (text.trim() && !this.supplements.some(item => item.title === title && item.text === text)) this.supplements.push({ title, text })
  }
}

export class IepPdfDocument {
  private pages: { painter: PdfPainter; section: string }[] = []
  private continuationPages = 0
  private widths = new Map<string, number>()
  private characters: Set<number>
  private constructor(private document: PDFDocument, private source: PDFDocument, private font: PDFFont, private layouts: TemplateLayout[]) { this.characters = new Set(font.getCharacterSet()) }
  static async create() {
    const resource = await loadResources()
    const document = await PDFDocument.create()
    document.registerFontkit(fontkit)
    const font = await document.embedFont(resource.font, { subset: true })
    return new IepPdfDocument(document, await PDFDocument.load(resource.template), font, resource.layout)
  }
  private measure = (value: string): number => {
    let width = 0
    for (const char of value) {
      const code = char.codePointAt(0)!
      if (!this.characters.has(code)) throw new PdfExportError(`中文字型無法顯示字元「${char}」，請更換支援該字元的 IEP_PDF_FONT_PATH。`)
      if (!this.widths.has(char)) this.widths.set(char, this.font.widthOfTextAtSize(char, 1))
      width += this.widths.get(char)!
    }
    return width
  }
  async page(templatePage: number, section: string): Promise<PdfPainter> {
    const [page] = await this.document.copyPages(this.source, [templatePage - 1])
    this.document.addPage(page)
    const painter = new PdfPainter(page, this.font, this.layouts[templatePage - 1], this.measure)
    this.pages.push({ painter, section })
    return painter
  }
  async blankPage(section: string, continuation = true): Promise<PdfPainter> {
    const source = this.source.getPage(0)
    const page = this.document.addPage([source.getWidth(), source.getHeight()])
    const painter = new PdfPainter(page, this.font, { width: page.getWidth(), height: page.getHeight(), checks: [] }, this.measure)
    this.pages.push({ painter, section })
    if (continuation) this.continuationPages++
    return painter
  }
  async finish(studentName: string, academicYear: number) {
    // Insert each section's overflow immediately after its source form page.
    let additions = 0
    for (const { painter, section } of this.pages) {
      if (!painter.supplements.length) continue
      let index = this.document.getPages().indexOf(painter.page) + 1
      let page: PDFPage, cursor = 0, writer: PdfPainter
      const nextPage = () => {
        page = this.document.insertPage(index++, [painter.page.getWidth(), painter.page.getHeight()]); additions++
        writer = new PdfPainter(page, this.font, { width: page.getWidth(), height: page.getHeight(), checks: [] }, this.measure)
        const heading = writer.wrap(section + '（續頁）', 520, 14)
        heading.forEach((line, i) => writer.text(36, 34 + i * 18, line, 14, rgb(.78, 0, 0)))
        const top = 34 + heading.length * 18 + 7
        const subtitle = writer.wrap(`${studentName}　${academicYear} 學年度`, 520, 11)
        subtitle.forEach((line, i) => writer.text(36, top + i * 15, line, 11))
        const rule = top + subtitle.length * 15 + 7
        writer.line(36, rule, 556, rule, .6)
        cursor = rule + 13
      }
      nextPage()
      for (const supplement of painter.supplements) {
        const lines = painter.wrap(supplement.text, 506, 11)
        let offset = 0
        while (offset < lines.length) {
          const heading = painter.wrap(supplement.title + (offset ? '（續）' : ''), 520, 12)
          const titleHeight = heading.length * 17 + 10
          if (cursor + titleHeight + 30 > 752) nextPage()
          heading.forEach((line, i) => writer!.text(36, cursor + i * 17, line, 12))
          cursor += titleHeight
          const count = Math.min(lines.length - offset, Math.floor((752 - cursor) / 15))
          lines.slice(offset, offset + count).forEach((line, i) => writer!.text(43, cursor + i * 15, line, 11))
          offset += count; cursor += count * 15 + 18
          if (offset < lines.length) nextPage()
        }
      }
    }
    this.document.getPages().forEach((page, i) => {
      page.drawRectangle({ x: 279, y: page.getHeight() - 790, width: 45, height: 24, color: white })
      page.drawText(String(i + 1), { x: 293, y: page.getHeight() - 781, font: this.font, size: 9, color: black })
    })
    this.document.setTitle(`${studentName} ${academicYear} 學年度個別化教育計畫`)
    this.document.setAuthor('EyeEP')
    this.document.setCreator('EyeEP IEP PDF Export')
    this.document.setSubject('學生個別化教育計畫與 IEP 會議紀錄')
    return { bytes: await this.document.save(), pageCount: this.document.getPageCount(), supplementPageCount: additions + this.continuationPages }
  }
}
