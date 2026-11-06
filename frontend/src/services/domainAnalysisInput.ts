import type { StoredDocumentAnalysis } from '../types/assessmentAnalysis'
import type { StoredGameAssessmentResult } from '../types/gameAssessment'
import type { AssessmentDetails, AssessmentSelections } from '../components/iep/EducationalNeedsAssessment'
import type { DomainAnalysisPayload, DomainKey } from '../types/domainAnalysis'

const map: Record<string, DomainKey> = { sensory: 'sensory', motor: 'perceptualMotor', selfCare: 'selfCare', cognition: 'cognitive', communication: 'communication', socialEmotional: 'socialEmotional', academic: 'academicLearning' }
const groups: Record<string, string[]> = {
  sensory: ['leftEar', 'rightEar', 'hearingAid', 'leftEye', 'rightEye', 'visionAid'],
  motor: ['fineMotor', 'fineAidUse', 'fineAidOther', 'mobility', 'mobilityAid', 'mobilityAidOther'],
  selfCare: ['independent', 'partialAssistance', 'fullAssistance'],
  cognition: ['attention', 'memory', 'thinking'],
  communication: ['communicationMode', 'nonverbalMethod', 'nonverbalOther', 'verbal', 'communicationAid'],
  socialEmotional: ['emotion', 'social', 'genderInteraction'],
  academic: ['reading', 'writing', 'math', 'learningBehavior'],
}

export function buildDomainAnalysisInput(domainId: string, domainLabel: string, selected: AssessmentSelections, details: AssessmentDetails, documents: StoredDocumentAnalysis[], games: StoredGameAssessmentResult[]): DomainAnalysisPayload {
  const domain = map[domainId] ?? 'sensory'
  const prefix = `${domainId}-`
  const selections: Record<string, string[]> = {}
  const allowed = new Set(groups[domainId] ?? [])
  for (const [key, values] of Object.entries(selected)) if (allowed.has(key) || key === domainId || key.startsWith(prefix)) selections[key] = values
  const detailValues: Record<string, string> = {}
  for (const [key, value] of Object.entries(details)) if (allowed.has(key.replace(/Detail$/, '')) || key === domainId || key.startsWith(prefix)) if (value.trim()) detailValues[key] = value
  const references: DomainAnalysisPayload['references'] = []
  for (const document of documents) {
    const analysis = document.domains[domain]
    if (analysis?.hasEvidence) references.push({ source: 'document', text: [analysis.summary, ...analysis.evidence.map(item => item.content)].filter(Boolean).join('\n') })
  }
  if (domain === 'cognitive') for (const game of games) references.push({ source: game.gameType, text: `${game.gameType === 'monkey' ? 'Monkey 工作記憶' : 'CPT 持續注意力'}：${game.summary}（僅供該次任務參考，非診斷）` })
  return { domain, domainLabel, selections, details: detailValues, references }
}
