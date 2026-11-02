import { readFile } from 'node:fs/promises'
import type { IepPdfRequest } from '../schemas/iepPdfExport.js'
import type { IepAttachment } from './iepAttachmentService.js'
import type { IepPdfDocument, Box } from './iepPdf/layout.js'
import { drawFamily } from './iepPdf/family.js'
import { drawAssessments, type PdfAssessment } from './iepPdf/assessment.js'
import { drawServices } from './iepPdf/services.js'
import { drawGoals } from './iepPdf/goals.js'
import { drawBehavior } from './iepPdf/behavior.js'
import { drawTransition } from './iepPdf/transition.js'
import { drawMeetings } from './iepPdf/meetings.js'

type Anchor = { x: number; y: number; size: number; label: string; note?: Box }
type Layout = { checks: Anchor[] }
export interface WordPage {
  source: number; section: string
  fields: { box: Box; value: string; label: string; style?: { size?: number; min?: number; align?: string } }[]
  checks: { x: number; y: number }[]
  notes: { title: string; text: string }[]
  images: { box: Box; base64: string; mime: string }[]
}
const normalize = (s: string) => s.normalize('NFKC').replace(/[\s_，、。:：()（）/／,\-]/g, '')

/** Capture the existing validated field mappings as semantic Word data, without
 * drawing, truncating or measuring text against fixed PDF rectangles. */
class WordPageWriter {
  constructor(readonly data: WordPage, readonly layout: Layout) {}
  field(box: Box, value: unknown, label: string, style?: { size?: number; min?: number; align?: string }) {
    // The source form separates the gender label and value at x=241.52.
    // Fill the actual value cell, rather than erasing part of its label.
    if (this.data.source === 2 && label === '性別') box = [243, 99, 39, 32]
    if (this.data.source === 2 && label === '姓名') box = [94, 99, 102, 32]
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) this.data.fields.push({ box, value: String(value), label, style })
  }
  supplement(title: string, value: unknown) {
    if (typeof value === 'string' && value.trim() && !this.data.notes.some(n => n.title === title && n.text === value)) this.data.notes.push({ title, text: value })
  }
  check(x: number, y: number) { this.data.checks.push({ x, y }) }
  choices(values: string[], area: Box, aliases: Record<string, string> = {}, label?: string) {
    values = values.filter(value => normalize(value).length > 0)
    const [x, y, w, h] = area, matched = new Set<string>()
    for (const anchor of this.layout.checks) {
      if (anchor.x < x || anchor.x >= x + w || anchor.y < y || anchor.y >= y + h) continue
      for (const value of values) if (normalize(anchor.label).startsWith(normalize(aliases[value] ?? value))) { this.check(anchor.x, anchor.y); matched.add(value) }
    }
    if (label) this.supplement(label, values.filter(value => !matched.has(value)).map(value => value === 'peer-level' ? '與一般同儕無異' : value).join('、'))
  }
  choiceNotes(values: string[], area: Box, notes: Record<string, string>, label: string, aliases: Record<string, string> = {}) {
    this.choices(values, area, aliases, label)
    const [x, y, w, h] = area
    for (const value of values) if (notes[value]?.trim()) {
      const anchor = this.layout.checks.find(a => a.x >= x && a.x < x + w && a.y >= y && a.y < y + h && normalize(a.label).startsWith(normalize(aliases[value] ?? value)))
      if (anchor?.note) this.field(anchor.note, notes[value], `${label}：${value}`)
      else this.supplement(`${label}：${value}`, notes[value])
    }
  }
  async picture(bytes: Uint8Array, mime: string, box: Box) { this.data.images.push({ box, mime, base64: Buffer.from(bytes).toString('base64') }) }
  clear() { /* Source template already has sample answers removed. */ }
  line() { /* Word owns the continuous table rules. */ }
  shade() { /* Table geometry stays native and editable. */ }
}

export async function buildIepWordModel(input: IepPdfRequest, records: PdfAssessment[] = [], attachments: IepAttachment[] = []) {
  const layouts = JSON.parse(await readFile(new URL('../../assets/iep-reference-layout.json', import.meta.url), 'utf8')) as Layout[]
  const pages: WordPage[] = []
  const recorder = { async page(source: number, section: string) {
    const data: WordPage = { source, section, fields: [], checks: [], notes: [], images: [] }
    pages.push(data)
    return new WordPageWriter(data, layouts[source - 1])
  } } as unknown as IepPdfDocument
  const student = await drawFamily(recorder, input)
  await drawAssessments(recorder, input, records, attachments)
  await drawServices(recorder, input)
  await drawGoals(recorder, input)
  await drawBehavior(recorder, input)
  await drawTransition(recorder, input)
  await drawMeetings(recorder, input, student)
  return { academicYear: input.academicYear, studentName: student.studentName, pages }
}
