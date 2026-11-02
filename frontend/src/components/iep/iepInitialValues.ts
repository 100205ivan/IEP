import type { BehaviorInterventionValue } from './BehaviorIntervention'
import type { CurriculumAdjustmentValue } from './CurriculumAdjustment'
import type { InclusiveEducationPlanValue } from './InclusiveEducationPlan'
import type { ProfessionalServiceDetail, SpecialEducationSupportValue } from './SpecialEducationSupport'
import type { StudentFamilyFormValue } from './StudentFamilyForm'
import type { TransitionSupportValue } from './TransitionSupport'

export const initialBehaviorIntervention: BehaviorInterventionValue = {
  needStatus: '', planStatus: '', planPeriod: { startDate: '', endDate: '' },
  behaviorAssessment: { definition: '', time: '', location: '', triggers: '', frequency: '', duration: '' },
  behaviorFunctions: { selected: [], notes: {} }, interventionGoal: '',
  antecedentStrategies: { environment: { selected: [], other: '' }, curriculum: { selected: [], other: '' }, interaction: { selected: [], other: '' }, notes: '' },
  teachingStrategies: { selected: [], other: '', notes: '' }, consequenceStrategies: { increase: { selected: [], other: '' }, reduce: { selected: [], other: '' }, notes: '' },
  individualFactors: '', administrativeSupports: { selected: [], other: '' }, implementers: { selected: [], other: '' },
  outcomeEvaluation: { date: '', methods: { selected: [], other: '' }, result: '', resultOther: '', recommendation: '', recommendationOther: '', notes: '' },
}

const emptyCurriculumAdjustment = () => ({ selectedStrategies: [], otherStrategy: '', applicableSubjects: [], otherSubject: '', description: '' })
export const initialCurriculumAdjustment: CurriculumAdjustmentValue = {
  environment: emptyCurriculumAdjustment(),
  content: emptyCurriculumAdjustment(),
  process: emptyCurriculumAdjustment(),
  assessment: emptyCurriculumAdjustment(),
}

export const initialInclusiveEducationPlan: InclusiveEducationPlanValue = {
  grade: '', className: '', participation: '', withdrawalSubjects: [], withdrawalOther: '', otherParticipationNotes: '', participationNotes: '', activities: [], activityOther: '', activityNotes: '', strategies: [], strategyOther: '', strategyNotes: '',
}

export function normalizeInclusiveEducationPlan(value: unknown): InclusiveEducationPlanValue {
  const plan: Record<string, unknown> = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const text = (key: string): string => typeof plan[key] === 'string' ? plan[key] : ''
  const choices = (key: string): string[] => Array.isArray(plan[key]) ? plan[key].filter((item): item is string => typeof item === 'string') : []
  return {
    ...plan,
    grade: text('grade'), className: text('className'), participation: text('participation'),
    withdrawalSubjects: choices('withdrawalSubjects'), withdrawalOther: text('withdrawalOther'),
    otherParticipationNotes: text('otherParticipationNotes'), participationNotes: text('participationNotes'),
    activities: choices('activities'), activityOther: text('activityOther'), activityNotes: text('activityNotes'),
    strategies: choices('strategies'), strategyOther: text('strategyOther'), strategyNotes: text('strategyNotes'),
  }
}

export const initialSpecialEducationSupport: SpecialEducationSupportValue = {
  specialEducation: [], specialOther: '', specialFrequency: '請選擇', specialFrequencyOther: '', specialNotes: '', professional: [], professionalDetails: {}, familySupport: [], familyOther: '', familyNotes: '', staffSupport: [], staffHours: '', staffOther: '', administrativeSupport: [], administrativeOther: '', transportSupport: [], transportOther: '', otherSupportNotes: '',
}

export const createProfessionalServiceDetail = (): ProfessionalServiceDetail => ({
  provider: '', frequency: '請選擇', otherFrequency: '', startDate: '', endDate: '', notes: '', serviceName: '',
})

export function normalizeSpecialEducationSupport(value?: Partial<SpecialEducationSupportValue>): SpecialEducationSupportValue {
  return {
    ...initialSpecialEducationSupport,
    ...value,
    professionalDetails: Object.fromEntries(Object.entries(value?.professionalDetails ?? {}).map(([service, detail]) => [
      service, { ...createProfessionalServiceDetail(), ...detail },
    ])),
  }
}

const initialStudentFamilyValues: Record<string, string> = {
  studentName: '', gender: '', birthDate: '', nationalId: '', studentId: '', grade: '', className: '', homeroomTeacher: '', classEntryDate: '', registeredAddress: '', residentialAddress: '',
  committeeAssessmentDate: '', committeeReassessmentDate: '', committeeDocumentNumber: '', committeeSpecialEducationNumber: '', committeeDisabilityCategory: '', committeeSeverity: '',
  proofAssessmentDate: '', proofReassessmentDate: '', icfCategory: '', icfOther: '', icfLevel: '', icdDiagnosis: '', diseaseDescription: '', diseaseOther: '',
  foodRestrictionDescription: '', foodAllergyDescription: '', drugAllergyDescription: '', otherSpecialCondition: '', hospitalName: '', hospitalDepartment: '', hospitalFrequency: '', hospitalDoctor: '',
  guardianName: '', guardianRelationship: '', guardianPhone: '', guardianAge: '', guardianEducation: '', guardianOccupation: '', caregiverName: '', caregiverRelationship: '', caregiverPhone: '', caregiverAge: '', caregiverEducation: '', caregiverOccupation: '',
  economicStatus: '', emergencyContact: '', emergencyPhone: '', emergencyRelationship: '', siblingsOlderBrother: '', siblingsYoungerBrother: '', siblingsOlderSister: '', siblingsYoungerSister: '',
  fatherNationality: '', motherNationality: '', fatherIndigenousGroup: '', motherIndigenousGroup: '', familyDisabilityRelationship: '', familyDisabilityDescription: '', familySupportSituation: '', otherSupportDescription: '',
  specialDisease: 'none', regularMedication: 'none', foodRestriction: 'none', foodAllergy: 'none', drugAllergy: 'none', hospital: 'none', foreignParent: 'no', indigenousParent: 'no', familyDisability: 'none',
}
export const initialStudentFamilyFormValue: StudentFamilyFormValue = {
  values: { ...initialStudentFamilyValues },
  checks: {},
  medications: [],
}

const transitionChoice = () => ({ selected: [], other: '' })
const transitionPreference = () => ({ caregiver: transitionChoice(), student: transitionChoice() })
const transitionService = () => ({ needStatus: '' as const, options: transitionChoice(), needsDescription: '', startDate: '', endDate: '', provider: '', progress: '' })
export const initialTransitionSupport: TransitionSupportValue = {
  noTransitionNeed: false,
  transitionReasons: transitionChoice(),
  transitionFocus: transitionChoice(),
  generalServiceContent: '',
  receivingUnit: '',
  specialNotes: '',
  crossStagePlan: {
    enabled: false, educationStage: '國小', grade: '', elementaryPlan: transitionPreference(),
    juniorHighPlan: { furtherEducation: transitionPreference(), employment: transitionPreference(), otherPlan: '' },
    seniorHighPlan: { furtherEducation: transitionPreference(), employment: transitionPreference(), otherPlan: '' },
    otherStageNotes: '',
  },
  services: { education: transitionService(), dailyLiving: transitionService(), employment: transitionService(), psychological: transitionService(), welfare: transitionService(), professional: transitionService() },
  followUp: { enabled: false, records: [] },
}
