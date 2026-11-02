import { readFile } from 'node:fs/promises'
import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { FormFlow } from './flow.js'
import type { IepPdfDocument } from './layout.js'

export async function drawBehaviorReference(pdf: IepPdfDocument, input: IepPdfRequest) {
  const sections = JSON.parse(await readFile(new URL('../../../assets/iep-behavior-reference.json', import.meta.url), 'utf8')) as { title: string; content: string }[]
  const flow = await FormFlow.create(pdf, input, '參考資料：行為功能介入策略')
  for (const section of sections) await flow.paragraph(section.title, section.title === '行政支援方式建議' ? section.content.replace(/^行政支援方式建議：\n/, '') : section.content)
}
