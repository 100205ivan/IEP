import type { BehaviorInterventionValue } from '../components/iep/BehaviorIntervention'
import type { FollowUpRecord, TransitionSupportValue } from '../components/iep/TransitionSupport'
import { initialBehaviorIntervention, initialTransitionSupport } from '../components/iep/iepInitialValues'

function object(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {} }

// Most nested arrays are checkbox selections. Follow-up records are hydrated
// separately because each item is an object with its own default fields.
function hydrate<T>(defaults: T, value: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(value) ? value.filter(item => typeof item === 'string') : []) as T
  if (typeof defaults === 'object' && defaults !== null) {
    const source = object(value)
    const result = { ...source }
    for (const [key, fallback] of Object.entries(defaults)) result[key] = hydrate(fallback, source[key])
    return result as T
  }
  return typeof value === typeof defaults ? value as T : defaults
}

export function normalizeBehaviorIntervention(value: unknown): BehaviorInterventionValue {
  const normalized = hydrate(initialBehaviorIntervention, value)
  normalized.behaviorFunctions.notes = Object.fromEntries(Object.entries(normalized.behaviorFunctions.notes).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  return normalized
}

const followUpDefaults: FollowUpRecord = { id: '', date: '', methods: [], socialPlatform: '', otherMethod: '', focusAreas: [], otherFocus: '', summary: '', serviceDisposition: '適應良好', dispositionDetails: '', receivingUnitContact: '', specialNotes: '' }
export function normalizeTransitionSupport(value: unknown): TransitionSupportValue {
  const normalized = hydrate(initialTransitionSupport, value)
  const records = object(object(value).followUp).records
  normalized.followUp.records = Array.isArray(records) ? records.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item)).map(record => hydrate(followUpDefaults, record)) : []
  return normalized
}
