import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument } from './layout.js'
import { FormFlow } from './flow.js'
import { date, lines, object, strings, text } from './format.js'
import { referenceOptions } from '../../schemas/referenceForms.js'
import type { IepAttachment } from '../iepAttachmentService.js'
import { drawAssessmentTable } from './assessmentTable.js'

export interface PdfAssessment { source?: string; assessmentDate: string; assessmentType: string; otherAssessmentType?: string; assessmentTool: string; evaluator: string; summary: string; detail?: string }
export async function drawAssessments(pdf: IepPdfDocument, input: IepPdfRequest, assessments: PdfAssessment[], attachments: IepAttachment[] = []) {
  await drawAssessmentTable(pdf, input, assessments, attachments)
  const selected = object(input.content.assessmentSelections), details = object(input.content.assessmentDetails), summary = object(input.content.strengthWeaknessSummary)
  const domains = [
    { id: 'sensory', title: '感官功能', groups: ['leftEar', 'rightEar', 'hearingAid', 'leftEye', 'rightEye', 'visionAid'] },
    { id: 'motor', title: '知覺動作與行動能力', groups: ['fineMotor', 'fineAidUse', 'mobility', 'mobilityAid'], extras: [['fineAidOther', '其他精細動作輔具'], ['mobilityAidOther', '其他行動輔具']] },
    { id: 'selfCare', title: '生活自理能力', groups: ['independent', 'partialAssistance', 'fullAssistance'] },
    { id: 'cognition', title: '認知能力', groups: ['attention', 'memory', 'thinking'] },
    { id: 'communication', title: '溝通能力', groups: ['communicationMode', 'nonverbalMethod', 'verbal', 'communicationAid'], extras: [['nonverbalOther', '其他非口語方式']] },
    { id: 'socialEmotional', title: '情緒與社會行為', groups: ['emotion', 'social', 'genderInteraction'] },
    { id: 'academic', title: '學業學習能力', groups: ['reading', 'writing', 'math', 'learningBehavior'] },
  ]
  const labels: Record<string, string> = { leftEar: '左耳', rightEar: '右耳', leftEye: '左眼', rightEye: '右眼', hearingAid: '聽覺輔具', visionAid: '視覺輔具', fineMotor: '精細動作', fineAidUse: '精細動作輔具用途', mobility: '獨立行動', mobilityAid: '行動輔具', independent: '能獨立完成', partialAssistance: '需部分協助', fullAssistance: '需完全協助', attention: '注意力', memory: '記憶力', thinking: '思考能力', communicationMode: '慣用溝通方式', nonverbalMethod: '非口語溝通', verbal: '口語溝通', communicationAid: '溝通輔具', emotion: '情緒', social: '社會行為', genderInteraction: '兩性互動', reading: '閱讀', writing: '書寫', math: '算術', learningBehavior: '學習行為' }
  const choices = (key: string) => strings(selected[key]).filter(Boolean).map(value => value === 'peer-level' ? key === 'emotion' ? '情緒穩定' : '與一般同儕無異' : value).join('、')
  const hasSummary = Object.values(summary).some(value => Array.isArray(value) ? value.length : text(value).trim())
  for (const [source, ids] of [[4, ['sensory', 'motor']], [5, ['selfCare', 'cognition']], [6, ['communication', 'socialEmotional']], [7, ['academic']]] as const) {
    const active = domains.filter(domain => (ids as readonly string[]).includes(domain.id)).filter(domain => domain.groups.some(key => choices(key) || text(details[key + 'Detail'])) || Object.keys(details).some(key => key.startsWith(domain.id + '-') && text(details[key])) || Object.keys(selected).some(key => key.startsWith(domain.id + '-') && choices(key)) || domain.extras?.some(([key]) => text(details[key])))
    if (!active.length && !(source === 7 && hasSummary)) { await pdf.page(source, '壹、三、學生教育需求評估與能力優弱勢分析'); continue }
    const f = await FormFlow.create(pdf, input, '壹、三、學生教育需求評估與能力優弱勢分析')
    for (const domain of active) {
      await f.heading(domain.title + '現況')
      const rows = domain.groups.flatMap(key => {
        const values = strings(selected[key]), description = values.some(value => value === '異常' || value === '需要') ? text(details[key + 'Detail']) : ''
        const value = [choices(key), description].filter(Boolean).join('\n')
        return value ? [[labels[key], value]] : []
      })
      if (rows.length) await f.table(['評估項目', '能力現況與觀察'], [120, 400], rows)
      for (const [key, label] of domain.extras ?? []) await f.paragraph(label, details[key])
      await f.fields([['整體班級適應影響', choices(domain.id + '-classImpact')], ['整體影響說明', details[domain.id + '-classImpactDescription']]])
      const impact = referenceOptions.impactGroups[domain.id] ?? []
      const impactRows = impact.flatMap(skill => {
        const key = `${domain.id}-${skill.id}-classImpact`
        const value = lines([['影響判斷', choices(key)], ['影響說明', details[key + 'Description']]])
        return value ? [[skill.title, value]] : []
      })
      if (impactRows.length) { await f.heading('分項的班級適應影響'); await f.table(['分項', '評估與說明'], [120, 400], impactRows) }
      await f.paragraph('其他觀察紀錄', details[domain.id + '-otherObservation'])
      await f.paragraph('需求評估說明', details[domain.id + '-needsAssessment'])
      await f.info([['評估者', details[domain.id + '-evaluator']], ['評估日期', date(details[domain.id + '-evaluationDate'])]])
    }
    if (source === 7 && hasSummary) {
      await f.heading('能力優弱勢分析')
      await f.fields([['優勢能力', strings(summary.strengths).join('、')], ['弱勢能力', strings(summary.weaknesses).join('、')]])
      await f.paragraph('優勢能力補充說明', summary.strengthNotes)
      await f.paragraph('弱勢能力補充說明', summary.weaknessNotes)
      await f.paragraph('整體需求摘要', summary.overallNeeds)
    }
  }
}
