import type { Criterion, EvaluationRecord, GoalDomain, SemesterGoal } from '../components/iep/GoalsChapter'

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function objects(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item)) : [] }

export function normalizeGoalDomains(value: unknown): GoalDomain[] {
  return objects(value).map(domain => ({
    ...domain,
    id: text(domain.id), domainType: text(domain.domainType) || '部定／校訂課程領域', domainName: text(domain.domainName),
    teacher: text(domain.teacher), specialEducationTeacher: text(domain.specialEducationTeacher), coreCompetencies: text(domain.coreCompetencies),
    learningPerformance: text(domain.learningPerformance), learningContent: text(domain.learningContent), integratedIssues: text(domain.integratedIssues),
    annualGoals: objects(domain.annualGoals).map(goal => ({ ...goal, id: text(goal.id), content: text(goal.content) })),
  }))
}

function normalizeCriterion(value: unknown): Criterion {
  const criterion = record(value)
  if (criterion.type === '百分比') return { ...criterion, type: '百分比', percentage: text(criterion.percentage) }
  if (criterion.type === '等級') return { ...criterion, type: '等級', passingLevel: text(criterion.passingLevel) || '3' }
  if (criterion.type === '自訂') return { ...criterion, type: '自訂', text: text(criterion.text) }
  return { ...criterion, type: '次數／機會', total: text(criterion.total), successful: text(criterion.successful) }
}

export function normalizeSemesterGoals(value: unknown, domains: GoalDomain[]): SemesterGoal[] {
  const byId = new Map(domains.map(domain => [domain.id, domain]))
  return objects(value).filter(goal => byId.get(text(goal.domainId))?.annualGoals.some(annual => annual.id === goal.annualGoalId)).map(goal => ({
    ...goal,
    id: text(goal.id), domainId: text(goal.domainId), annualGoalId: text(goal.annualGoalId), semester: goal.semester === '第二學期' ? '第二學期' : '第一學期',
    content: text(goal.content), startDate: text(goal.startDate), endDate: text(goal.endDate),
    assessmentMethods: Array.isArray(goal.assessmentMethods) ? goal.assessmentMethods.filter((method): method is string => typeof method === 'string') : [],
    otherAssessmentMethod: text(goal.otherAssessmentMethod), assessmentSupport: (text(goal.assessmentSupport) || '獨立完成') as SemesterGoal['assessmentSupport'],
    achievementCriterion: normalizeCriterion(goal.achievementCriterion),
    evaluationRecords: objects(goal.evaluationRecords).map((entry): EvaluationRecord => ({ ...entry, id: text(entry.id), date: text(entry.date), result: text(entry.result), notes: text(entry.notes) })),
    teachingDecision: (text(goal.teachingDecision) || '尚未決定') as SemesterGoal['teachingDecision'], teachingDecisionNotes: text(goal.teachingDecisionNotes),
  }))
}
