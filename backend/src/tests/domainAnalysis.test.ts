import test from 'node:test'
import assert from 'node:assert/strict'
import { domainAnalysisJsonSchema, domainAnalysisRequestSchema, domainAnalysisResponseSchema } from '../schemas/domainAnalysis.js'
import { normalizeQuestionOptions } from '../services/geminiDomainAnalysis.js'

test('domain analysis request accepts a minimal scoped payload', () => {
  const parsed = domainAnalysisRequestSchema.parse({ domain: 'cognitive', domainLabel: '認知能力', selections: { attention: ['容易受干擾而分心'] }, details: { 'cognition-classImpactDescription': '需要提醒' }, references: [] })
  assert.equal(parsed.domain, 'cognitive')
})

test('domain analysis response requires structured questions and drafts', () => {
  const parsed = domainAnalysisResponseSchema.parse({ domain: 'cognitive', completeness: { sufficient: false, missingItems: ['frequency'], reasons: ['缺少頻率'] }, questions: [{ id: 'q1', category: 'frequency', question: '多久發生一次？', reason: '需要頻率', type: 'single', options: [{ id: 'a', label: '每天', semanticValue: 'daily' }, { id: 'skip', label: '跳過', semanticValue: 'skip' }], allowOther: true, required: false }], professionalCurrentStatus: null, classAdaptationImpact: null, educationNeeds: null, evidence: [], warnings: [], smartGoalDraft: null })
  assert.equal(parsed.questions.length, 1)
})

test('domain analysis rejects an unsupported domain', () => {
  assert.throws(() => domainAnalysisRequestSchema.parse({ domain: 'attention', domainLabel: '注意力' }))
})

test('Gemini schema requires the same smart goal fields as Zod', () => {
  const smartGoal = domainAnalysisJsonSchema.properties.smartGoalDraft as { anyOf: readonly [{ type: 'null' }, { required?: readonly string[] }] }
  assert.equal(smartGoal.anyOf[0].type, 'null')
  assert.deepEqual(smartGoal.anyOf[1].required, ['baseline', 'expectedChange', 'condition', 'timeframe', 'incomplete'])
})

test('domain question options retain at most one uncertain choice and remove skip choices', () => {
  const options = normalizeQuestionOptions({ id: 'q1', category: 'frequency', question: '題目', reason: '原因', type: 'single', required: false, allowOther: true, options: [
    { id: 'a', label: '每天', semanticValue: 'daily' }, { id: 'b', label: '尚未觀察', semanticValue: 'not_observed' }, { id: 'c', label: '跳過此題', semanticValue: 'skip' }, { id: 'd', label: '不確定', semanticValue: 'uncertain' }, { id: 'e', label: '未知', semanticValue: 'unknown' },
  ] })
  assert.deepEqual(options.map(option => option.label), ['每天', '不確定'])
  assert.equal(options.filter(option => option.semanticValue === 'uncertain').length, 1)
})
