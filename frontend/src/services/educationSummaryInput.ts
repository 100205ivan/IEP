import type { AssessmentDetails, AssessmentSelections, StrengthWeaknessSummary } from '../components/iep/EducationalNeedsAssessment'
import { referenceOptions } from '../models/referenceForms'
import type { KnownAssessmentIdentifiers } from '../types/assessmentDocument'
import type { StoredDocumentAnalysis } from '../types/assessmentAnalysis'
import type { AssessmentRecord } from '../types/assessmentRecord'
import { deidentifyAssessmentReport } from './assessmentReportDeidentification'

export function summaryIdentifiers(values: Record<string, string>, school: string): KnownAssessmentIdentifiers {
  return {
    studentName: [values.studentName], nationalId: [values.nationalId], birthDate: [values.birthDate],
    guardianName: [values.guardianName, values.caregiverName, values.emergencyContact],
    phone: [values.guardianPhone, values.caregiverPhone, values.emergencyPhone],
    address: [values.registeredAddress, values.residentialAddress], school: [school],
    doctorName: [values.hospitalDoctor], medicalInstitution: [values.hospitalName],
  }
}

const domains = [
  { id: 'sensory', title: '感官功能', groups: ['leftEar', 'rightEar', 'hearingAid', 'leftEye', 'rightEye', 'visionAid'] },
  { id: 'motor', title: '知覺動作與行動能力', groups: ['fineMotor', 'fineAidUse', 'mobility', 'mobilityAid'] },
  { id: 'selfCare', title: '生活自理能力', groups: ['independent', 'partialAssistance', 'fullAssistance'] },
  { id: 'cognition', title: '認知能力', groups: ['attention', 'memory', 'thinking'] },
  { id: 'communication', title: '溝通能力', groups: ['communicationMode', 'nonverbalMethod', 'verbal', 'communicationAid'] },
  { id: 'socialEmotional', title: '情緒與社會行為', groups: ['emotion', 'social', 'genderInteraction'] },
  { id: 'academic', title: '學業學習能力', groups: ['reading', 'writing', 'math', 'learningBehavior'] },
]
const labels: Record<string, string> = { leftEar: '左耳', rightEar: '右耳', hearingAid: '聽覺輔具', leftEye: '左眼', rightEye: '右眼', visionAid: '視覺輔具', fineMotor: '精細動作', fineAidUse: '輔具用途', mobility: '獨立行動', mobilityAid: '行動輔具', independent: '能獨立完成', partialAssistance: '需部分協助', fullAssistance: '需完全協助', attention: '注意力', memory: '記憶力', thinking: '思考能力', communicationMode: '慣用溝通方式', nonverbalMethod: '非口語溝通', verbal: '口語溝通', communicationAid: '溝通輔具', emotion: '情緒', social: '社會行為', genderInteraction: '兩性互動', reading: '閱讀', writing: '書寫', math: '算術', learningBehavior: '學習行為' }

export function buildEducationSummaryInput(selected: AssessmentSelections, details: AssessmentDetails, summary: StrengthWeaknessSummary, records: AssessmentRecord[], documents: StoredDocumentAnalysis[], identifiers: KnownAssessmentIdentifiers) {
  const sections: string[] = []
  const values = (key: string) => (selected[key] ?? []).filter(Boolean)
  const has = (key: string, value: string) => values(key).includes(value)
  const add = (target: string[], label: string, value: string | undefined) => { if (value?.trim()) target.push(`${label}：${value.trim()}`) }
  for (const domain of domains) {
    const rows: string[] = []
    for (const key of domain.groups) {
      if ((key === 'fineAidUse' && !has('fineMotor', '需使用輔具操作')) || (key === 'mobilityAid' && !has('mobility', '需使用輔具行動')) || (key === 'nonverbalMethod' && !has('communicationMode', '非口語')) || (key === 'verbal' && !has('communicationMode', '口語'))) continue
      const choices = has(key, 'peer-level') ? [key === 'emotion' ? '情緒穩定' : '與一般同儕無異'] : values(key)
      add(rows, labels[key], choices.join('、'))
      if (has(key, '異常') || has(key, '需要')) add(rows, labels[key] + '說明', details[key + 'Detail'])
    }
    if (has('fineMotor', '需使用輔具操作') && domain.id === 'motor') add(rows, '其他精細動作輔具', details.fineAidOther)
    if (has('mobility', '需使用輔具行動') && domain.id === 'motor') add(rows, '其他行動輔具', details.mobilityAidOther)
    if (has('communicationMode', '非口語') && domain.id === 'communication') add(rows, '其他非口語方式', details.nonverbalOther)
    const impact = domain.id + '-classImpact'
    add(rows, '班級適應影響', values(impact).join('、'))
    if (has(impact, '有影響')) add(rows, '影響說明', details[impact + 'Description'])
    for (const skill of (referenceOptions.impactGroups as Record<string, { id: string; title: string }[]>)[domain.id] ?? []) {
      const key = `${domain.id}-${skill.id}-classImpact`
      add(rows, skill.title + '影響', values(key).join('、'))
      if (has(key, '有影響')) add(rows, skill.title + '影響說明', details[key + 'Description'])
    }
    add(rows, '其他觀察', details[domain.id + '-otherObservation'])
    add(rows, '需求評估', details[domain.id + '-needsAssessment'])
    if (rows.length) sections.push(`【${domain.title}】\n${rows.join('\n')}`)
  }
  const notes: string[] = []
  add(notes, '教師勾選優勢向度', summary.strengths.join('、'))
  add(notes, '教師勾選弱勢向度', summary.weaknesses.join('、'))
  add(notes, '教師優勢補充', summary.strengthNotes)
  add(notes, '教師弱勢補充', summary.weaknessNotes)
  add(notes, '目前整體需求摘要', summary.overallNeeds)
  if (notes.length) sections.push(`【教師優弱勢與需求紀錄】\n${notes.join('\n')}`)
  for (const record of records) {
    const analysis = documents.find(document => document.assessmentRecordId === record.id)
    const rows: string[] = []
    add(rows, '評量工具', record.assessmentTool)
    add(rows, '評量摘要', record.summary)
    if (analysis) {
      for (const domain of Object.values(analysis.domains)) if (domain.hasEvidence) {
        add(rows, domain.domain, [domain.summary, ...domain.evidence.map(item => item.content)].filter(Boolean).join('\n'))
      }
      if (analysis.warnings.length) add(rows, '文件分析注意事項', analysis.warnings.join('\n'))
    }
    if (record.summary.trim() || analysis) sections.push(`【${record.source === 'monkey' || record.source === 'cpt' ? '遊戲表現參考（非診斷）' : record.source === 'document' ? '評估文件參考' : '人工評量參考'}】\n${rows.join('\n')}`)
  }
  // Only selected observations and reference summaries leave the browser. Names,
  // dates of birth, contact details and full family/medical forms are not inputs.
  const known = Object.fromEntries(Object.entries(identifiers).map(([key, values]) => [key, values.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))])) as KnownAssessmentIdentifiers
  return deidentifyAssessmentReport(sections.join('\n\n'), known).deidentifiedText
}
