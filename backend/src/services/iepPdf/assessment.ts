import type { IepPdfRequest } from '../../schemas/iepPdfExport.js'
import { IepPdfDocument, type Box } from './layout.js'
import { date, lines, object, strings, text } from './format.js'

export interface PdfAssessment { assessmentDate: string; assessmentType: string; otherAssessmentType?: string; assessmentTool: string; evaluator: string; summary: string; detail?: string }
export async function drawAssessments(pdf: IepPdfDocument, input: IepPdfRequest, assessments: PdfAssessment[]) {
  for (let offset = 0; offset < Math.max(1, assessments.length); offset += 7) {
    const p = await pdf.page(3, '壹、二、學生能力現況評量紀錄')
    assessments.slice(offset, offset + 7).forEach((record, index) => {
      const top = 506 + index * 31.7
      const values = [date(record.assessmentDate), record.assessmentTool, record.evaluator, record.summary]
      const cols = [[45, 60], [109, 95], [208, 80], [292, 245]]
      values.forEach((value, i) => p.field([cols[i][0], top, cols[i][1], 29], value, `評量 ${offset + index + 1}：${['日期', '工具', '評量者', '摘要'][i]}`, { size: 9.5, min: 8 }))
      p.supplement(`評量 ${offset + index + 1}：${record.assessmentTool}`, lines([['評量類型', record.assessmentType === '其他' ? record.otherAssessmentType : record.assessmentType], ['詳細結果', record.detail]]))
    })
  }
  const selections = object(input.content.assessmentSelections), details = object(input.content.assessmentDetails)
  // Areas scope repeated checkbox labels to the correct skill and observation.
  const pages: { source: number; groups: [string, Box][]; domains: [string, string, number, number, number, number][] }[] = [
    { source: 4, groups: [['leftEar', [38, 144, 250, 18]], ['rightEar', [38, 162, 250, 18]], ['hearingAid', [38, 180, 250, 36]], ['leftEye', [38, 234, 250, 18]], ['rightEye', [38, 252, 250, 18]], ['visionAid', [38, 270, 250, 36]], ['fineMotor', [38, 450, 250, 112]], ['fineAidUse', [38, 505, 250, 19]], ['mobility', [38, 577, 250, 112]], ['mobilityAid', [38, 631, 250, 19]]], domains: [['sensory', '感官功能', 128, 325, 340, 361], ['motor', '知覺動作與行動能力', 436, 705, 719, 742]] },
    { source: 5, groups: [['independent', [38, 104, 250, 20]], ['partialAssistance', [38, 151, 250, 20]], ['fullAssistance', [38, 198, 250, 20]], ['attention', [38, 377, 250, 111]], ['memory', [38, 503, 250, 76]], ['thinking', [38, 593, 250, 73]]], domains: [['selfCare', '生活自理能力', 92, 249, 263, 303], ['cognition', '認知能力', 380, 685, 701, 732]] },
    { source: 6, groups: [['communicationMode', [38, 104, 250, 70]], ['nonverbalMethod', [38, 120, 250, 35]], ['verbal', [38, 182, 250, 99]], ['communicationAid', [38, 294, 250, 38]], ['emotion', [38, 449, 250, 68]], ['social', [38, 543, 250, 99]], ['genderInteraction', [38, 668, 250, 20]]], domains: [['communication', '溝通能力', 92, 348, 362, 371], ['socialEmotional', '情緒與社會行為', 452, 719, 733, 743]] },
    { source: 7, groups: [['reading', [38, 93, 250, 38]], ['writing', [38, 147, 250, 57]], ['math', [38, 219, 250, 57]], ['learningBehavior', [38, 292, 250, 111]]], domains: [['academic', '學業學習能力', 96, 438, 453, 497]] },
  ]
  const labels: Record<string, string> = { leftEar: '左耳', rightEar: '右耳', leftEye: '左眼', rightEye: '右眼', hearingAid: '聽覺輔具', visionAid: '視覺輔具', fineMotor: '精細動作', fineAidUse: '精細動作輔具用途', mobility: '獨立行動', mobilityAid: '行動輔具', independent: '能獨立完成', partialAssistance: '需部分協助', fullAssistance: '需完全協助', attention: '注意力', memory: '記憶力', thinking: '思考能力', communicationMode: '慣用溝通方式', nonverbalMethod: '非口語溝通', verbal: '口語溝通', communicationAid: '溝通輔具', emotion: '情緒', social: '社會行為', genderInteraction: '兩性互動', reading: '閱讀', writing: '書寫', math: '算術', learningBehavior: '學習行為' }
  for (const config of pages) {
    const p = await pdf.page(config.source, '壹、三、教育需求評估與能力優弱勢分析')
    config.groups.forEach(([key, box]) => {
      p.choices(strings(selections[key]), [box[0] - 2, box[1], box[2] + 2, box[3]], { 'peer-level': key === 'emotion' ? '情緒穩定' : '與一般同儕無異', 枴杖: '柺杖' }, labels[key])
      if (strings(selections[key]).some(value => value === '異常' || value === '需要')) p.supplement(`${labels[key]}說明`, details[key + 'Detail'])
    })
    for (const [id, label, impactTop, observationTop, needsTop, evaluatorTop] of config.domains) {
      p.choices(strings(selections[id + '-classImpact']), [290, impactTop - 1, 253, 36], {}, label + '：班級適應影響')
      // A single overall impact is recorded by the system, rather than inferred for each sub-skill.
      p.field([293, impactTop + 37, 248, 38], details[id + '-classImpactDescription'], label + '：班級適應影響')
      const lowerHeight = evaluatorTop + 17 - observationTop
      p.field([39, observationTop, 248, lowerHeight], details[id + '-otherObservation'], label + '：其他觀察紀錄')
      p.field([293, needsTop, 248, Math.max(14, evaluatorTop - needsTop - 1)], details[id + '-needsAssessment'], label + '：需求評估說明')
      p.field([293, evaluatorTop, 248, 16], lines([['評估者', details[id + '-evaluator']], ['日期', date(details[id + '-evaluationDate'])]]).replace(/\n/g, '　'), label + '：評估者及日期', { size: 9 })
    }
    const extra: [string, string][] = config.source === 4 ? [['fineAidOther', '其他精細動作輔具'], ['mobilityAidOther', '其他行動輔具']] : config.source === 6 ? [['nonverbalOther', '其他非口語方式']] : []
    extra.forEach(([key, label]) => p.supplement(label, details[key]))
    if (config.source === 7) {
      const summary = object(input.content.strengthWeaknessSummary)
      const aliases = { '其他特殊才能／狀況': '其他特殊才能' }
      for (const [key, x, note] of [['strengths', 35, 'strengthNotes'], ['weaknesses', 296, 'weaknessNotes']] as const) {
        const values = strings(summary[key])
        p.choices(values.flatMap(v => v === '健康／感官相關' ? ['健康情況', '感官功能'] : [v]), [x, 589, 259, 99], key === 'strengths' ? aliases : { '其他特殊才能／狀況': '其他特殊狀況' })
        p.field([x + 2, 700, 254, 54], summary[note], key === 'strengths' ? '優勢能力補充說明' : '弱勢能力補充說明')
      }
      p.supplement('整體需求摘要', summary.overallNeeds)
    }
  }
}
