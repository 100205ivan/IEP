import options from './referenceFormOptions.json'
export { options as referenceOptions }
export type ReferenceNeed = '' | '無需求' | '有需求'
export interface ReferenceSupportGroup { status: ReferenceNeed; selected: string[]; notes: Record<string, string>; description: string }
export interface ReferenceSupport { curriculumNeed: ReferenceNeed; supportNeed: ReferenceNeed; groups: Record<string, ReferenceSupportGroup> }
export interface InclusiveReferenceRow { item: string; selected: boolean; execution: string; startDate: string; endDate: string; frequency: string; responsible: string }
export interface AdjustmentSubjectDetail { teacher: string; content: '' | '無須調整' | '須調整'; process: '' | '無須調整' | '須調整'; environment: '' | '無須調整' | '須調整'; assessment: '' | '無須調整' | '須調整' }
export interface BehaviorExecution { executionMethod: string; implementers: string; progress: string }
export interface TeamMember { id: string; role: string; name: string; title: string }
export const emptySupportGroup = (): ReferenceSupportGroup => ({ status: '', selected: [], notes: {}, description: '' })
export function supportReference(value?: Partial<ReferenceSupport>): ReferenceSupport { return { curriculumNeed: value?.curriculumNeed ?? '', supportNeed: value?.supportNeed ?? '', groups: Object.fromEntries(options.supportGroups.map(group => [group.id, { ...emptySupportGroup(), ...value?.groups?.[group.id], notes: { ...value?.groups?.[group.id]?.notes } }])) } }
export function inclusiveReferenceRows(value?: InclusiveReferenceRow[]): InclusiveReferenceRow[] { return options.inclusiveGroups.flatMap(group => group.options.map(item => ({ item, selected: false, execution: '', startDate: '', endDate: '', frequency: '', responsible: '', ...value?.find(row => row.item === item) }))) }
export const placementOf = (course: { placement?: string; teachingMethod: string }) => course.placement ?? ({ 原班上課: '原班', 抽離式: '抽離', 外加式: '外加' } as Record<string, string>)[course.teachingMethod] ?? ''
